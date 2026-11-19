import { rnd, pick, shuffle } from './random.js';

/* ============================================================
   Malá násobilka

   Násobilka čísel 1 až 10 (výsledky do 100). Předlohou byl modul
   „Násobení a dělení I“ na umimematiku.cz: pexeso, rozhodovačka (výběr
   ze dvou možností) a psaná odpověď. Tři úlohy na kartě „Co budeme dělat?“
   (`config.nasobTasks`), počet `config.nasobCount`:

     pexeso   plocha s dvojicemi `7×8` ↔ `56` - jede přes ovladač
              „Najdi dvojice“ (`ex.kind = 'pexeso'`), v kole nejvýš jedna
              a stojí na začátku (jako spojování ve „Význam slov“)
     napis    obyčejný příklad s políčkem (`ex.kind = 'equation'`)
     vyber    příklad a dvě možnosti (`ex.kind = 'nasob'`, ovladač výběru)

   OBTÍŽNOST = KTERÉ NÁSOBILKY (jako bloky na umimematiku):
   lehká 2, 3, 4, 5 a 10; střední 6 až 9; těžká všechny 1 až 10 a u „Napiš“
   občas chybí činitel (? × 7 = 56).

   Bez DOM a bez importu z generator.js (ten si importuje tenhle soubor).
   ============================================================ */

export const NASOB_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'násobilka 2, 3, 4, 5 a 10', tables: [2, 3, 4, 5, 10], pairs: 6, cols: 3 },
  medium: { label: 'Střední', emoji: '🟡', note: 'násobilka 6, 7, 8 a 9', tables: [6, 7, 8, 9], pairs: 8, cols: 4 },
  hard: { label: 'Těžká', emoji: '🔴', note: 'všechny násobilky 1 až 10 a doplňování činitele', tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], pairs: 8, cols: 4, missing: true },
};
export const NASOB_LEVEL_KEYS = Object.keys(NASOB_LEVELS);

export const NASOB_TASKS = {
  pex: { label: 'Pexeso', emoji: '🃏' },
  napis: { label: 'Napiš výsledek', emoji: '✏️' },
  vyber: { label: 'Vyber si', emoji: '👆' },
};
export const NASOB_TASK_KEYS = Object.keys(NASOB_TASKS);
export const NASOB_COUNTS = [10, 20, 30];

const levelOf = (key) => NASOB_LEVELS[key] || NASOB_LEVELS.easy;

/* Činitel z násobilky (t) a druhý činitel (k). Pořadí na obrazovce se
   losuje - „7 × 3“ i „3 × 7“ jsou násobilka sedmi. */
function roll(level, kMin = 1) {
  const t = pick(level.tables);
  const k = rnd(kMin, 10);
  return Math.random() < 0.5 ? { a: t, b: k, t, k } : { a: k, b: t, t, k };
}

/* Plocha pexesa: všechny výsledky musí být různé (dvě kartičky „24“ by
   dítě nerozlišilo), proto se nejdřív seskupí podle výsledku a teprve
   z různých výsledků se vybírá. Násobení jedničkou na plochu nepatří. */
function makeBoard(levelKey) {
  const level = levelOf(levelKey);
  const byResult = new Map();
  for (const t of level.tables) {
    if (t === 1) continue;
    for (let k = 2; k <= 10; k++) {
      const c = t * k;
      if (!byResult.has(c)) byResult.set(c, []);
      byResult.get(c).push(Math.random() < 0.5 ? [t, k] : [k, t]);
    }
  }
  const items = shuffle([...byResult.keys()])
    .slice(0, level.pairs)
    .map((c, i) => {
      const [a, b] = pick(byResult.get(c));
      return { pair: i, c, op: 'mul', a, b };
    });
  const cards = shuffle(items.flatMap((it) => [
    { pair: it.pair, face: 'task', text: `${it.a}×${it.b}` },
    { pair: it.pair, face: 'result', text: String(it.c) },
  ]));
  return {
    task: 'pex',
    pairs: items.length,
    cols: level.cols,
    rows: Math.ceil(cards.length / level.cols),
    items,
    cards,
    note: null,
    key: items.map((it) => `${it.a}mul${it.b}`).sort().join(','),
  };
}

function makeNapis(levelKey) {
  const level = levelOf(levelKey);
  const { a, b } = roll(level);
  // chybějící činitel jen na těžké; u nuly by nebyl jednoznačný, ta tu ale není
  const missing = level.missing && Math.random() < 0.4 ? pick(['a', 'b']) : 'c';
  return { task: 'napis', a, b, c: a * b, missing };
}

/* Špatná možnost je typická chyba: o jeden násobek vedle (7 × 8 = 48 nebo 63),
   sousední násobilka, nebo prohozené číslice (56 → 65). */
function wrongFor(t, k, c) {
  const cand = [t * (k + 1), t * (k - 1), (t + 1) * k, (t - 1) * k];
  if (c >= 10) cand.push(Number(String(c).split('').reverse().join('')));
  const ok = cand.filter((v) => Number.isInteger(v) && v >= 1 && v <= 100 && v !== c);
  return ok.length ? pick(ok) : c + 1;
}

function makeVyber(levelKey) {
  const level = levelOf(levelKey);
  const { a, b, t, k } = roll(level, 2);
  const c = a * b;
  const wrong = wrongFor(t, k, c);
  const options = shuffle([
    { text: String(c), ok: true },
    { text: String(wrong), ok: false, tag: 'nasobVedle' },
  ]);
  return { task: 'vyber', a, b, c, missing: 'c', answer: String(c), options, key: `${Math.min(a, b)}x${Math.max(a, b)}` };
}

/* Kolo: plocha pexesa (je-li zapnutá) na začátku, za ní `count` příkladů
   rozdělených rovným dílem mezi zapnuté „Napiš“ a „Vyber“. Samotné pexeso
   = kolo je jediná plocha. Tentýž příklad se v kole neopakuje. */
export function makeNasobRound(levelKey = 'easy', tasks = NASOB_TASK_KEYS, count = 10) {
  const level = NASOB_LEVELS[levelKey] ? levelKey : 'easy';
  const on = NASOB_TASK_KEYS.filter((t) => tasks.includes(t));
  const use = on.length ? on : NASOB_TASK_KEYS;
  const out = [];
  if (use.includes('pex')) out.push({ ...makeBoard(level), level });
  const rest = use.filter((t) => t !== 'pex');
  if (!rest.length) return out;
  const seen = new Set();
  const list = [];
  for (let i = 0; i < count; i++) {
    const task = rest[i % rest.length];
    let item;
    for (let tries = 0; tries < 20; tries++) {
      item = task === 'vyber' ? makeVyber(level) : makeNapis(level);
      const sig = `${task}|${Math.min(item.a, item.b)}x${Math.max(item.a, item.b)}`;
      if (!seen.has(sig)) { seen.add(sig); break; }
    }
    list.push(item);
  }
  return out.concat(shuffle(list));
}

/* Vysvětlení po chybě u „Vyber si“ (u „Napiš“ ho dělá společná cesta
   příkladů s násobením). */
export function nasobExplain(ex) {
  const { a, b, c } = ex;
  const count = Math.min(a, b);
  const value = Math.max(a, b);
  const steps = [];
  if (count <= 5) steps.push(`${a} × ${b} znamená sečíst ${value} celkem ${count}krát: ${Array(count).fill(value).join(' + ')} = ${c}.`);
  else steps.push(`Počítej po ${value}: ${Array.from({ length: count }, (_, i) => value * (i + 1)).join(', ')}.`);
  steps.push(`Takže **${a} × ${b} = ${c}**.`);
  return steps;
}

export function nasobText(ex, reveal) {
  return `${ex.a} × ${ex.b} = ${reveal ? ex.c : '__'}`;
}
