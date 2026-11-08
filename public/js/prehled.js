/* Stranka prehled.html - vysledky dohranych kol pro rodice.
 *
 * Data taha z /api/kola (worker/index.js) s heslem v hlavicce. Heslo se
 * nikam neuklada, drzi se jen v pameti stranky - po zavreni karty se zadava
 * znovu. Aplikaci samotne se tahle stranka nedotyka.
 */

const el = (id) => document.getElementById(id);

let heslo = '';
let kola = [];

/* Prvek s textem pres textContent - data z databaze se nikdy nevkladaji jako HTML. */
function h(tag, trida, ...deti) {
  const e = document.createElement(tag);
  if (trida) e.className = trida;
  for (const d of deti.flat()) {
    if (d === null || d === undefined || d === false || d === '') continue;
    e.append(d instanceof Node ? d : String(d));
  }
  return e;
}

function cas(sekundy) {
  if (sekundy < 60) return `${sekundy} s`;
  const m = Math.floor(sekundy / 60);
  const s = sekundy % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

const DEN = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
const HODINY = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });
const denKlic = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

async function nacti() {
  const dny = el('phDays').value;
  const res = await fetch(`/api/kola?dny=${encodeURIComponent(dny)}`, {
    headers: { Authorization: `Bearer ${heslo}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('Špatné heslo.');
  if (!res.ok) throw new Error(`Přehled se nepodařilo načíst (chyba ${res.status}).`);
  kola = (await res.json()).kola || [];
  naplnVyber('phDevice', kola.map((k) => k.zarizeni?.jmeno));
  naplnVyber('phGame', kola.map((k) => k.hra));
  vykresli();
}

function naplnVyber(id, hodnoty) {
  const sel = el(id);
  const puvodni = sel.value;
  const prvni = sel.options[0];
  sel.replaceChildren(prvni, ...[...new Set(hodnoty.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'))
    .map((v) => h('option', '', v)));
  sel.value = [...sel.options].some((o) => o.value === puvodni) ? puvodni : '';
}

function vykresli() {
  const zar = el('phDevice').value;
  const hra = el('phGame').value;
  const vyber = kola.filter((k) => (!zar || k.zarizeni?.jmeno === zar) && (!hra || k.hra === hra));

  const celkem = vyber.reduce((s, k) => s + k.celkem, 0);
  const spravne = vyber.reduce((s, k) => s + k.spravne, 0);
  const minut = Math.round(vyber.reduce((s, k) => s + k.sekundy, 0) / 60);
  const bez = vyber.filter((k) => k.celkem && k.spravne === k.celkem).length;
  el('phSummary').replaceChildren(
    vyber.length
      ? h('p', '', h('strong', '', `${vyber.length} kol`), ` · úloh ${celkem}, správně ${spravne}`,
        celkem ? ` (${Math.round((spravne / celkem) * 100)} %)` : '',
        ` · bez chyby ${bez} kol · celkem asi ${minut} min`)
      : h('p', '', 'V tomhle období nic není.'),
  );

  const dny = new Map();
  for (const k of vyber) {
    const klic = denKlic(k.at);
    if (!dny.has(klic)) dny.set(klic, []);
    dny.get(klic).push(k);
  }
  el('phList').replaceChildren(...[...dny.values()].map((den) => {
    const sp = den.reduce((s, k) => s + k.spravne, 0);
    const ce = den.reduce((s, k) => s + k.celkem, 0);
    return h('section', 'ph-day',
      h('h2', '', DEN.format(new Date(den[0].at)), h('span', 'ph-day-sum', ` · ${den.length} kol · ${sp}/${ce}`)),
      den.map(karta));
  }));
}

function karta(k) {
  const bezChyby = k.celkem > 0 && k.spravne === k.celkem;
  const popis = [k.uroven, (k.volby || []).join(', '), k.rozsah ? `do ${k.rozsah}` : ''].filter(Boolean).join(' · ');
  const chyby = k.chyby?.length
    ? h('details', 'ph-errors',
      h('summary', '', `Chyby (${k.chyby.length})`),
      h('ul', '', k.chyby.map((c) => h('li', '', h('span', '', c.zadani), ' ',
        h('span', 'ph-good', `→ ${c.spravne}`), ' ', h('span', 'ph-bad', `dala ${c.dala}`)))))
    : null;
  return h('article', `ph-card ph-round${bezChyby ? ' is-perfect' : ''}`,
    h('div', 'ph-round-head',
      h('span', 'ph-time', HODINY.format(new Date(k.at))),
      h('span', 'ph-device', k.zarizeni?.jmeno || ''),
      h('strong', 'ph-game', k.hra)),
    popis ? h('p', 'ph-desc', popis) : null,
    h('p', 'ph-score',
      h('strong', '', `${bezChyby ? '✅' : '📝'} ${k.spravne}/${k.celkem}`), ` (${k.procent} %) · ${cas(k.sekundy)}`,
      k.odmena ? ` · 🎁 ${k.odmena.kategorie}` : ''),
    k.jde?.length ? h('p', 'ph-good-text', '👍 ', k.jde.join(' ')) : null,
    k.pozor?.length ? h('p', 'ph-bad-text', '🔎 ', k.pozor.join(' ')) : null,
    chyby);
}

el('phGate').addEventListener('submit', async (e) => {
  e.preventDefault();
  const chyba = el('phError');
  chyba.hidden = true;
  heslo = el('phPass').value;
  try {
    await nacti();
    el('phGate').hidden = true;
    el('phPanel').hidden = false;
  } catch (err) {
    chyba.textContent = err.message;
    chyba.hidden = false;
    el('phPass').select();
  }
});

for (const id of ['phDevice', 'phGame']) el(id).addEventListener('change', vykresli);
el('phDays').addEventListener('change', () => nacti().catch((err) => alert(err.message)));
el('phReload').addEventListener('click', () => nacti().catch((err) => alert(err.message)));
