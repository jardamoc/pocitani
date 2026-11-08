/* Serverova cast Pocitani na Cloudflare Workers.
 *
 * Staticky web z public/ servíruje Cloudflare sam; sem prijdou jen adresy,
 * ktere v public/ nejsou:
 *
 *   POST /api/kolo   shrnuti dohraneho kola (public/js/hlaseni.js) -> ulozi do
 *                    databaze D1 a posle upozorneni do telefonu pres ntfy
 *   GET  /api/kola   seznam kol pro stranku prehled.html, jen s heslem
 *
 * Tajemstvi (nastavuji se `npx wrangler secret put`, v gitu nejsou):
 *   NTFY_TOPIC      tajny nazev kanalu v ntfy
 *   PREHLED_HESLO   heslo ke strance s prehledem
 */

const MAX_TELO = 16 * 1024;      // shrnuti kola ma par kB, vic je podezrele
const MAX_ZA_HODINU = 120;       // pojistka proti zaplaveni databaze
const DNY_UCHOVANI = 400;        // starsi kola se mazou
const MAX_DNY_PREHLEDU = 400;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/kolo' && request.method === 'POST') return await prijmiKolo(request, env, ctx);
      if (url.pathname === '/api/kola' && request.method === 'GET') return await vydejKola(request, env, url);
      if (url.pathname.startsWith('/api/')) return json({ chyba: 'Neznámá adresa.' }, 404);
    } catch (err) {
      console.error(err);
      return json({ chyba: 'Chyba serveru.' }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* ---------------- prijem kola ---------------- */

const text = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const cislo = (v, max) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0);
const seznam = (v, max, delka) => (Array.isArray(v) ? v.slice(0, max).map((s) => text(s, delka)).filter(Boolean) : []);

/* Vezme z tela jen zname polozky ve znamych mezich. Kdo posle cokoli jineho,
   do databaze se to stejne nedostane. */
function ocistiKolo(k) {
  if (!k || typeof k !== 'object') return null;
  if (typeof k.id !== 'string' || !/^[\w-]{4,80}$/.test(k.id)) return null;
  const z = k.zarizeni && typeof k.zarizeni === 'object' ? k.zarizeni : {};
  return {
    id: k.id,
    at: cislo(k.at, 9e15) || Date.now(),
    zarizeni: { id: text(z.id, 64), jmeno: text(z.jmeno, 40) || 'Neznámé zařízení' },
    mode: text(k.mode, 20),
    hra: text(k.hra, 60),
    uroven: text(k.uroven, 30),
    volby: seznam(k.volby, 12, 60),
    rozsah: cislo(k.rozsah, 10000),
    celkem: cislo(k.celkem, 1000),
    spravne: cislo(k.spravne, 1000),
    procent: cislo(k.procent, 100),
    sekundy: cislo(k.sekundy, 86400),
    odmena: k.odmena && typeof k.odmena === 'object'
      ? { kategorie: text(k.odmena.kategorie, 30), vyber: k.odmena.vyber === true }
      : null,
    jde: seznam(k.jde, 10, 300),
    pozor: seznam(k.pozor, 10, 300),
    chyby: Array.isArray(k.chyby)
      ? k.chyby.slice(0, 10).map((c) => ({ zadani: text(c?.zadani, 200), spravne: text(c?.spravne, 60), dala: text(c?.dala, 60) }))
      : [],
  };
}

async function prijmiKolo(request, env, ctx) {
  const delka = Number(request.headers.get('Content-Length') || 0);
  if (delka > MAX_TELO) return json({ chyba: 'Moc velké.' }, 413);
  const telo = await request.text();
  if (telo.length > MAX_TELO) return json({ chyba: 'Moc velké.' }, 413);

  let kolo;
  try {
    kolo = ocistiKolo(JSON.parse(telo));
  } catch {
    kolo = null;
  }
  if (!kolo) return json({ chyba: 'Vadná data.' }, 400);

  const hodina = Date.now() - 3600 * 1000;
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM kola WHERE prijato > ?').bind(hodina).first();
  if (n >= MAX_ZA_HODINU) return json({ chyba: 'Moc zpráv, zkus to později.' }, 429);

  /* id je gameId z aplikace - stejne kolo poslane dvakrat (fronta, spatne
     spojeni) se ulozi i ohlasi jen jednou. */
  const vysledek = await env.DB.prepare(
    'INSERT OR IGNORE INTO kola (id, at, prijato, zarizeni, data) VALUES (?, ?, ?, ?, ?)',
  ).bind(kolo.id, kolo.at, Date.now(), kolo.zarizeni.jmeno, JSON.stringify(kolo)).run();

  if (vysledek.meta?.changes) {
    ctx.waitUntil(posliNtfy(env, kolo).catch((err) => console.error('ntfy', err)));
    // obcas uklid starych kol, at databaze neroste donekonecna
    if (Math.random() < 0.05) {
      ctx.waitUntil(env.DB.prepare('DELETE FROM kola WHERE at < ?').bind(Date.now() - DNY_UCHOVANI * 86400000).run());
    }
  }
  return json({ ok: true });
}

/* ---------------- upozorneni do telefonu ---------------- */

function cas(sekundy) {
  if (sekundy < 60) return `${sekundy} s`;
  const m = Math.floor(sekundy / 60);
  const s = sekundy % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function zpravaNtfy(k) {
  const bezChyby = k.celkem > 0 && k.spravne === k.celkem;
  const radky = [];
  const popis = [k.uroven, k.volby.join(', '), k.rozsah ? `do ${k.rozsah}` : ''].filter(Boolean).join(' · ');
  if (popis) radky.push(popis);
  radky.push(`${bezChyby ? '✅' : '📝'} ${k.spravne}/${k.celkem} (${k.procent} %) za ${cas(k.sekundy)}`);
  if (k.odmena) radky.push(`🎁 ${k.odmena.kategorie}${k.odmena.vyber ? ' (vybere si sbírku)' : ''}`);
  if (k.jde.length) radky.push(`👍 ${k.jde.join(' ')}`);
  if (k.pozor.length) radky.push(`🔎 ${k.pozor.join(' ')}`);
  return {
    title: `${k.zarizeni.jmeno}: ${k.hra}`,
    message: radky.join('\n'),
    tags: [bezChyby ? 'star' : 'pencil'],
  };
}

async function posliNtfy(env, kolo) {
  if (!env.NTFY_TOPIC) return;
  const z = zpravaNtfy(kolo);
  const res = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // JSON misto hlavicek - hlavicky HTTP neumi diakritiku
    body: JSON.stringify({ topic: env.NTFY_TOPIC, ...z }),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
}

/* ---------------- prehled ---------------- */

/* Porovnani bez predcasneho konce, at se heslo neda uhadovat podle casu odpovedi. */
function shoda(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let rozdil = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) rozdil |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return rozdil === 0;
}

async function vydejKola(request, env, url) {
  const auth = request.headers.get('Authorization') || '';
  const heslo = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.PREHLED_HESLO || !heslo || !shoda(heslo, env.PREHLED_HESLO)) {
    // chvilka cekani zpomali hadani hesla
    await new Promise((r) => setTimeout(r, 400));
    return json({ chyba: 'Špatné heslo.' }, 401);
  }
  const dny = Math.min(MAX_DNY_PREHLEDU, Math.max(1, Number(url.searchParams.get('dny')) || 30));
  const { results } = await env.DB.prepare('SELECT data FROM kola WHERE at >= ? ORDER BY at DESC LIMIT 2000')
    .bind(Date.now() - dny * 86400000).all();
  return json({ kola: results.map((r) => JSON.parse(r.data)) });
}
