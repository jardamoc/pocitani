/* Stranka prehled.html - vysledky dohranych kol pro rodice.
 *
 * Tabulka: jedno kolo = jeden radek. Pod zahlavim je filtr pro kazdy sloupec
 * (vyber u sloupcu s malo hodnotami, jinak hledani textu), kliknutim na
 * zahlavi se radi.
 *
 * Data taha z /api/kola (worker/index.js) s heslem v hlavicce. Heslo se
 * nikam neuklada, drzi se jen v pameti stranky - po zavreni karty se zadava
 * znovu. Aplikaci samotne se tahle stranka nedotyka.
 */

const el = (id) => document.getElementById(id);

let heslo = '';
let kola = [];
const filtry = {};                         // klic sloupce -> hodnota filtru
let razeni = { klic: 'datum', smer: -1 };  // nejnovejsi nahore

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

const DATUM = new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
const HODINY = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });

/* Sloupce tabulky. `text` = co se ukaze a podle ceho se filtruje,
   `sort` = podle ceho se radi (vychozi text), `vyber` = filtr jako seznam hodnot. */
const SLOUPCE = [
  { klic: 'datum', nazev: 'Datum', vyber: true, text: (k) => DATUM.format(new Date(k.at)), sort: (k) => k.at },
  { klic: 'cas', nazev: 'Čas', text: (k) => HODINY.format(new Date(k.at)), sort: (k) => new Date(k.at).getHours() * 60 + new Date(k.at).getMinutes() },
  { klic: 'zarizeni', nazev: 'Zařízení', vyber: true, text: (k) => k.zarizeni?.jmeno || '' },
  { klic: 'typ', nazev: 'Typ', vyber: true, text: (k) => k.zarizeni?.typ || '' },
  { klic: 'ip', nazev: 'IP', vyber: true, text: (k) => k.ip || '' },
  { klic: 'misto', nazev: 'Místo', vyber: true, text: (k) => k.misto || '' },
  { klic: 'hra', nazev: 'Hra', vyber: true, text: (k) => k.hra || '' },
  { klic: 'uroven', nazev: 'Obtížnost', vyber: true, text: (k) => k.uroven || '' },
  { klic: 'volby', nazev: 'Volby', text: (k) => (k.volby || []).join(', ') },
  { klic: 'rozsah', nazev: 'Rozsah', vyber: true, text: (k) => (k.rozsah ? `do ${k.rozsah}` : ''), sort: (k) => k.rozsah || 0 },
  { klic: 'vysledek', nazev: 'Správně', text: (k) => `${k.spravne}/${k.celkem}`, sort: (k) => k.spravne },
  { klic: 'procent', nazev: '%', text: (k) => `${k.procent} %`, sort: (k) => k.procent, trida: 'num' },
  { klic: 'doba', nazev: 'Doba', text: (k) => cas(k.sekundy), sort: (k) => k.sekundy, trida: 'num' },
  { klic: 'odmena', nazev: 'Odměna', vyber: true, text: (k) => k.odmena?.kategorie || '' },
  { klic: 'jde', nazev: 'Co jde', text: (k) => (k.jde || []).join(' '), trida: 'long' },
  { klic: 'pozor', nazev: 'Na co pozor', text: (k) => (k.pozor || []).join(' '), trida: 'long' },
  {
    klic: 'chyby', nazev: 'Chyby', trida: 'long',
    text: (k) => (k.chyby || []).map((c) => `${c.zadani} → ${c.spravne} (dala ${c.dala})`).join('; '),
    sort: (k) => (k.chyby || []).length,
    bunka: (k) => (k.chyby?.length
      ? h('details', '', h('summary', '', `${k.chyby.length}`),
        h('ul', '', k.chyby.map((c) => h('li', '', `${c.zadani} `, h('span', 'ph-good', `→ ${c.spravne}`), ' ', h('span', 'ph-bad', `dala ${c.dala}`)))))
      : ''),
  },
];

async function nacti() {
  const dny = el('phDays').value;
  const res = await fetch(`/api/kola?dny=${encodeURIComponent(dny)}`, {
    headers: { Authorization: `Bearer ${heslo}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('Špatné heslo.');
  if (!res.ok) throw new Error(`Přehled se nepodařilo načíst (chyba ${res.status}).`);
  kola = (await res.json()).kola || [];
  vykresliZahlavi();
  vykresli();
}

function vykresliZahlavi() {
  el('phHead').replaceChildren(...SLOUPCE.map((s) => {
    const sipka = razeni.klic === s.klic ? (razeni.smer > 0 ? ' ▲' : ' ▼') : '';
    const th = h('th', s.trida || '', h('button', 'ph-sort', s.nazev + sipka));
    th.dataset.klic = s.klic;
    return th;
  }));

  el('phFilter').replaceChildren(...SLOUPCE.map((s) => {
    let pole;
    if (s.vyber) {
      // hodnoty v poradi podle razeni sloupce (datum od nejnovejsiho)
      const videne = new Map();
      for (const k of kola) {
        const t = s.text(k);
        if (t && !videne.has(t)) videne.set(t, s.sort ? s.sort(k) : t);
      }
      const hodnoty = [...videne.entries()]
        .sort((a, b) => (typeof a[1] === 'number' ? b[1] - a[1] : String(a[1]).localeCompare(String(b[1]), 'cs')))
        .map(([t]) => t);
      pole = h('select', '', h('option', '', ''), hodnoty.map((v) => h('option', '', v)));
      pole.querySelector('option').value = '';
      if (!hodnoty.includes(filtry[s.klic])) delete filtry[s.klic];
    } else {
      pole = h('input', '');
      pole.type = 'search';
      pole.placeholder = 'hledat';
    }
    pole.value = filtry[s.klic] || '';
    pole.dataset.klic = s.klic;
    pole.setAttribute('aria-label', `Filtr: ${s.nazev}`);
    return h('th', s.trida || '', pole);
  }));
}

function vyhovuje(k) {
  return SLOUPCE.every((s) => {
    const f = filtry[s.klic];
    if (!f) return true;
    const t = s.text(k);
    return s.vyber ? t === f : t.toLocaleLowerCase('cs').includes(f.toLocaleLowerCase('cs'));
  });
}

function vykresli() {
  const sloupec = SLOUPCE.find((s) => s.klic === razeni.klic);
  const klicRazeni = sloupec.sort || sloupec.text;
  const vyber = kola.filter(vyhovuje).sort((a, b) => {
    const x = klicRazeni(a);
    const y = klicRazeni(b);
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'cs');
    return r * razeni.smer || b.at - a.at;
  });

  const celkem = vyber.reduce((s, k) => s + k.celkem, 0);
  const spravne = vyber.reduce((s, k) => s + k.spravne, 0);
  const minut = Math.round(vyber.reduce((s, k) => s + k.sekundy, 0) / 60);
  const bez = vyber.filter((k) => k.celkem && k.spravne === k.celkem).length;
  el('phSummary').replaceChildren(
    vyber.length
      ? h('p', '', h('strong', '', `${vyber.length} z ${kola.length} kol`), ` · úloh ${celkem}, správně ${spravne}`,
        celkem ? ` (${Math.round((spravne / celkem) * 100)} %)` : '',
        ` · bez chyby ${bez} kol · celkem asi ${minut} min`)
      : h('p', '', kola.length ? 'Filtrům nic neodpovídá.' : 'V tomhle období nic není.'),
  );

  el('phBody').replaceChildren(...vyber.map((k) => {
    const bezChyby = k.celkem > 0 && k.spravne === k.celkem;
    return h('tr', bezChyby ? 'is-perfect' : '',
      SLOUPCE.map((s) => h('td', s.trida || '', s.bunka ? s.bunka(k) : s.text(k))));
  }));
}

/* ---------------- ovladani ---------------- */

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

el('phHead').addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  const klic = th.dataset.klic;
  razeni = razeni.klic === klic ? { klic, smer: -razeni.smer } : { klic, smer: klic === 'datum' ? -1 : 1 };
  vykresliZahlavi();
  vykresli();
});

el('phFilter').addEventListener('input', (e) => {
  const klic = e.target.dataset?.klic;
  if (!klic) return;
  if (e.target.value) filtry[klic] = e.target.value;
  else delete filtry[klic];
  vykresli();
});

el('phClear').addEventListener('click', () => {
  for (const k of Object.keys(filtry)) delete filtry[k];
  vykresliZahlavi();
  vykresli();
});

el('phDays').addEventListener('change', () => nacti().catch((err) => alert(err.message)));
el('phReload').addEventListener('click', () => nacti().catch((err) => alert(err.message)));
