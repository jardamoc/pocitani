import { rnd, pick, chance, shuffle, range } from './random.js';

/* ============================================================
   Obrázkové hádanky

   Dítě má z několika rovnic se symboly zjistit, kolik je který obrázek,
   a z toho dopočítat poslední řádek.

   Postup generování je schválně obrácený než luštění: nejdřív losujeme
   skryté hodnoty obrázků a teprve z nich skládáme rovnice. Rovnice tím
   nikdy nemůžou vyjít nesmyslně nebo se záporným výsledkem.

   Rovnice skládáme jako žebřík: první řádek určí jeden obrázek a každý
   další přidá právě jeden nový, ostatní už v něm dítě zná. V žádném řádku
   tak nikdy nestojí dvě neznámé - hra je pro 1. až 3. třídu a soustava
   dvou rovnic je na ni moc. Řádky proto necháváme i v tomhle pořadí,
   shora dolů se dají luštit jeden po druhém.

   Jednoznačnost řešení pak hlídá `solveRiddle`, který hádanku doopravdy
   vyluští dosazováním. Když projde, je každá hodnota vynucená, takže jiné
   řešení existovat nemůže; když neprojde, hádanku zahodíme a losujeme
   znovu. Vedlejší užitek: z kroků řešitele rovnou skládáme vysvětlení,
   které se ukáže po chybě.
   ============================================================ */

/* Jedna sada = jedno téma. V rámci hádanky míchá jen symboly z ní, ať
   obrázková řada dává smysl. Uvnitř sady držíme symboly vizuálně odlišné,
   aby je dítě nepletlo - proto v počasí není zároveň ☀️ i 🌤️ a v moři
   ani 🐬 vedle 🐳. */
export const RIDDLE_SETS = [
  { key: 'fruit',   label: 'ovoce',    symbols: ['🍎', '🍊', '🍌', '🍓', '🍐', '🍇'] },
  { key: 'veggie',  label: 'zelenina', symbols: ['🥕', '🌽', '🫑', '🥦', '🍅', '🥒'] },
  { key: 'safari',  label: 'zvířata',  symbols: ['🐒', '🐘', '🐫', '🦁', '🦒', '🦓'] },
  { key: 'pets',    label: 'mazlíčci', symbols: ['🐶', '🐱', '🐰', '🐹', '🐢', '🐦'] },
  { key: 'traffic', label: 'doprava',  symbols: ['🚗', '🚕', '🚚', '🚌', '🚲', '🚂'] },
  { key: 'space',   label: 'vesmír',   symbols: ['🌍', '🌙', '⭐', '🪐', '🚀', '☄️'] },
  { key: 'flowers', label: 'květiny',  symbols: ['🌻', '🌷', '🌹', '🌸', '🌼', '🍀'] },
  { key: 'food',    label: 'jídlo',    symbols: ['🍕', '🍔', '🌭', '🥪', '🍟', '🧁'] },
  { key: 'shapes',  label: 'tvary',    symbols: ['🔴', '🔺', '🟦', '🔶', '🟡', '⬛'] },
  { key: 'sport',   label: 'sport',    symbols: ['⚽', '🏀', '🎾', '🏈', '🏓', '🥏'] },
  { key: 'sea',     label: 'moře',     symbols: ['🐠', '🐙', '🐬', '🦀', '🐚', '🐡'] },
  { key: 'weather', label: 'počasí',   symbols: ['☀️', '🌧️', '❄️', '🌈', '⚡', '💨'] },
  { key: 'tech',    label: 'technika', symbols: ['📱', '💻', '⌚', '🎧', '📷', '🔦'] },
  { key: 'forest',  label: 'les',      symbols: ['🌰', '🍄', '🌲', '🍁', '🐿️', '🦔'] },
];

/* Obtížnost se vybírá na úvodní obrazovce. Řídí, kolik je v hádance
   obrázků a jaké tvary rovnic se smí objevit; "Do kolika počítáme?"
   pak výsledky ještě zastropuje - `ceiling` je nejvýš, kam daná
   obtížnost sama od sebe pustí.

   Obtížnost = jaké TVARY rovnic se smí objevit a kolik je v hádance
   obrázků. Jak velká jsou čísla, řídí výhradně rozsah ("do kolika
   počítáme") - obtížnost do toho vůbec nemluví, takže "do 100" dá velká
   čísla i na lehké úrovni a "do 10" malá i na těžké.

   `shapes` vyjmenovává povolené tvary, od nejjednoduššího:
     num      🍉 − 5 = 2            (obrázek a čísla)
     sum      🍎 + 🍎 + 🍌 = 14     (obrázky dají číslo)
     symrhs   🍍 − 2 = 🍌           (obrázek a číslo dají obrázek)
     symsum   🍎 + 🍎 = 🍐          (obrázky dají obrázek)
     symdiff  🍌 − 🥥 = 2           (rozdíl obrázků)
   `qTerms` je délka posledního řádku, `qMinus` povoluje v něm i minus. */
export const RIDDLE_LEVELS = {
  easy: {
    label: 'Lehká', emoji: '🟢', note: '2 obrázky, obrázky a čísla',
    example: '🍉 − 5 = 2',
    symbols: [2, 2], rowLen: [2, 3], maxRepeat: 2,
    shapes: ['num', 'sum', 'sum'], qTerms: [2, 2], qMinus: false,
  },
  medium: {
    label: 'Střední', emoji: '🟡', note: '3 obrázky, vpravo může být obrázek',
    example: '🍍 − 2 = 🍌',
    symbols: [3, 3], rowLen: [2, 3], maxRepeat: 3,
    shapes: ['num', 'sum', 'sum', 'symrhs'], qTerms: [2, 3], qMinus: false,
  },
  hard: {
    label: 'Těžká', emoji: '🔴', note: '3–4 obrázky, i součet obrázků a odčítání',
    example: '🍎 + 🍎 = 🍐',
    symbols: [3, 4], rowLen: [2, 4], maxRepeat: 3,
    // poslední řádek smí mít i 4 členy, aby se do něj vešly všechny obrázky
    // symsum je uvedený dvakrát schválně - sám o sobě vychází vzácně,
    // protože hodnota nového obrázku musí padnout do rozsahu a být volná
    shapes: ['num', 'sum', 'symrhs', 'symsum', 'symsum', 'symdiff'], qTerms: [2, 4], qMinus: true,
  },
};

export const RIDDLE_LEVEL_KEYS = Object.keys(RIDDLE_LEVELS);

/* Největší hodnota jednoho obrázku. Odvozuje se z rozsahu, ne z obtížnosti -
   zhruba polovina stropu, ať se vejde i dvoučlenný součet a přitom zbyde
   prostor na rozdíly. Spodní mez 3 drží hádanku smysluplnou i "do 5". */
export const riddleMaxValue = (cap) => Math.max(3, Math.min(Math.floor(cap / 2), cap - 1));

/* ---------------- stavební kameny rovnice ----------------
   Řádek je `{ terms, rhs }`. Člen je buď obrázek `{ sym, sign }`, nebo
   číslo `{ num, sign }`. Vpravo stojí číslo `{ num }`, obrázek `{ sym }`,
   nebo u posledního řádku nic (rhs === null → otazník). */

const symTerm = (sym, sign = 1) => ({ sym, sign });
const numTerm = (num, sign = 1) => ({ num, sign });
const isSym = (t) => t.sym !== undefined;

const termValue = (t, values) => (isSym(t) ? values[t.sym] : t.num);
const leftValue = (terms, values) => terms.reduce((s, t) => s + t.sign * termValue(t, values), 0);

const termsKey = (terms) => terms.map((t) => `${t.sign > 0 ? '+' : '-'}${isSym(t) ? `s${t.sym}` : `n${t.num}`}`).join('');
const rowKey = (row) => `${termsKey(row.terms)}=${row.rhs?.sym !== undefined ? `s${row.rhs.sym}` : row.rhs?.num ?? '?'}`;

/* Řádek přepsaný na tvar "součet násobků obrázků = číslo". Čísla zleva
   se přesunou doprava, obrázek zprava doleva. */
function equationOf(row, n) {
  const coeff = new Array(n).fill(0);
  let cons = 0;
  for (const t of row.terms) {
    if (isSym(t)) coeff[t.sym] += t.sign;
    else cons -= t.sign * t.num;
  }
  if (row.rhs.sym !== undefined) coeff[row.rhs.sym] -= 1;
  else cons += row.rhs.num;
  return { coeff, cons };
}

/* ---------------- řešitel ---------------- */

/* Zbývá v rovnici právě jeden neznámý obrázek? Pak je jeho hodnota
   vynucená. Hlídáme, že vyjde celé kladné číslo - jinak hádanku zahodíme. */
function soleUnknown(eq, known) {
  let sym = -1;
  let rest = eq.cons;
  let substituted = 0;
  for (let s = 0; s < eq.coeff.length; s++) {
    const k = eq.coeff[s];
    if (!k) continue;
    if (known[s] === null) {
      if (sym >= 0) return null;
      sym = s;
    } else {
      rest -= k * known[s];
      substituted += 1;
    }
  }
  if (sym < 0) return null;
  const k = eq.coeff[sym];
  if (k === 0 || rest % k !== 0) return null;
  const value = rest / k;
  return value >= 1 ? { sym, coeff: k, rest, value, substituted } : null;
}

function solveRiddle(rows, n) {
  const known = new Array(n).fill(null);
  const eqs = rows.map((r) => equationOf(r, n));
  const steps = [];

  /* Jediné pravidlo: najdi řádek, kde zbývá jeden neznámý obrázek, a dopočítej
     ho. Schválně tu není žádný krok přes dvě rovnice - co neprojde tímhle,
     je pro dítě z 1.-3. třídy moc a hádanku zahodíme. */
  while (known.includes(null)) {
    let step = null;
    for (let i = 0; i < rows.length && !step; i++) {
      const hit = soleUnknown(eqs[i], known);
      if (hit) step = { row: i, known: known.slice(), ...hit };
    }
    if (!step) return null;
    known[step.sym] = step.value;
    steps.push(step);
  }

  return { values: known, steps };
}

/* ---------------- tvary řádků ----------------
   Každý tvar dostane jeden nový obrázek (`fresh`) a ty, které dítě už zná.
   Jinak by v řádku byly dvě neznámé. */

/* Řádek "obrázek (1-3×) a k tomu číslo": 🍉 − 5 = 2, 🍉 + 🍉 + 2 = 12.
   Hodnotu obrázku dostaneme zvenčí, dopočítáme jen pravou stranu. */
function numRow(sym, value, level, cap) {
  const k = rnd(1, level.maxRepeat);
  const base = k * value;
  const plus = chance(0.5);
  const room = plus ? cap - base : base - 1;
  if (room < 1) return null;
  const c = rnd(1, Math.min(9, room));
  const total = plus ? base + c : base - c;
  if (total < 1 || total > cap) return null;
  const terms = range(1, k).map(() => symTerm(sym));
  terms.push(numTerm(c, plus ? 1 : -1));
  return { terms, rhs: { num: total } };
}

/* První řádek musí obrázek prozradit sám o sobě.

   `maxRepeat` drží lehkou úroveň na dvojicích: 🐱 + 🐱 = 6 je pro prvňáka
   zdvojnásobení, které umí zpaměti, kdežto 3× 🐱 = 9 už je násobení. */
function firstRow(value, level, cap) {
  if (level.shapes.includes('num') && chance(0.45)) {
    const row = numRow(0, value, level, cap);
    if (row) return row;
  }
  const k = rnd(2, level.maxRepeat);
  const total = k * value;
  return total >= 2 && total <= cap
    ? { terms: range(1, k).map(() => symTerm(0)), rhs: { num: total } }
    : null;
}

/* Přidá do žebříku řádek, který určí obrázek `fresh`, a vrátí i jeho
   hodnotu. U některých tvarů si hodnotu volíme (🍎 + 🍐 = 9), u jiných ji
   rovnice sama určuje (🍎 + 🍎 = 🍐) - proto se hodnoty nelosují dopředu,
   ale vznikají spolu s rovnicemi. */
function growRow(shape, fresh, values, level, cap, maxValue, used, n) {
  const known = range(0, fresh - 1);
  const freeValue = () => {
    const pool = range(1, maxValue).filter((v) => !used.has(v));
    return pool.length ? pick(pool) : null;
  };

  if (shape === 'symrhs') {
    // 🍍 − 2 = 🍌 : známý obrázek a číslo dají ten nový
    const a = pick(known);
    const plus = chance(0.5);
    const room = plus ? maxValue - values[a] : values[a] - 1;
    if (room < 1) return null;
    const c = rnd(1, Math.min(9, room));
    const value = plus ? values[a] + c : values[a] - c;
    if (value < 1 || value > maxValue || used.has(value)) return null;
    return { row: { terms: [symTerm(a), numTerm(c, plus ? 1 : -1)], rhs: { sym: fresh } }, value };
  }

  if (shape === 'symsum') {
    // 🍎 + 🍎 = 🍐 : součet známých obrázků dá ten nový
    const a = pick(known);
    const b = chance(0.55) ? a : pick(known);
    const value = values[a] + values[b];
    if (value > maxValue || used.has(value)) return null;
    const terms = [symTerm(a), symTerm(b)].sort((x, y) => x.sym - y.sym);
    return { row: { terms, rhs: { sym: fresh } }, value };
  }

  if (shape === 'symdiff') {
    // 🍌 − 🥥 = 2 : rozdíl obrázků, vždy od většího, ať nevyjde záporně
    const a = pick(known);
    const value = freeValue();
    if (value === null || value === values[a]) return null;
    const [x, y] = value > values[a] ? [fresh, a] : [a, fresh];
    const total = Math.abs(value - values[a]);
    if (total < 1 || total > cap) return null;
    return { row: { terms: [symTerm(x), symTerm(y, -1)], rhs: { num: total } }, value };
  }

  if (shape === 'num') {
    const value = freeValue();
    if (value === null) return null;
    const row = numRow(fresh, value, level, cap);
    return row ? { row, value } : null;
  }

  // 'sum': známé obrázky plus ten nový dají číslo
  const value = freeValue();
  if (value === null) return null;
  const counts = new Array(n).fill(0);
  counts[fresh] = chance(0.75) ? 1 : Math.min(2, level.maxRepeat);
  for (let i = 0; i < rnd(1, 2); i++) {
    const s = pick(known);
    if (counts[s] < level.maxRepeat) counts[s] += 1;
  }
  const terms = [];
  counts.forEach((c, s) => { for (let i = 0; i < c; i++) terms.push(symTerm(s)); });
  if (terms.length < 2 || terms.length > level.rowLen[1]) return null;
  const total = terms.reduce((s, t) => s + (t.sym === fresh ? value : values[t.sym]), 0);
  if (total < 1 || total > cap) return null;
  return { row: { terms, rhs: { num: total } }, value };
}

/* Celý žebřík: řádek po řádku přibývá jeden obrázek a jeho hodnota.
   Počet řádků = počet obrázků; s méně rovnicemi by hádanka nemohla mít
   jednoznačné řešení. */
function buildLadder(n, level, cap, maxValue) {
  // jednička jako první hodnota nedává smysl - "🌹 + 🌹 = 2" nic neřekne
  const values = [rnd(2, maxValue)];
  const first = firstRow(values[0], level, cap);
  if (!first) return null;

  const rows = [first];
  const seen = new Set([rowKey(first)]);
  const used = new Set(values);

  for (let i = 1; i < n; i++) {
    let done = false;
    for (let t = 0; t < 120 && !done; t++) {
      const built = growRow(pick(level.shapes), i, values, level, cap, maxValue, used, n);
      if (!built || seen.has(rowKey(built.row))) continue;
      values[i] = built.value;
      used.add(built.value);
      rows.push(built.row);
      seen.add(rowKey(built.row));
      done = true;
    }
    if (!done) return null;
  }
  return { values, rows };
}

/* Poslední řádek - ten, na který dítě odpovídá. Průběžný součet zleva
   nesmí nikdy spadnout pod 1, aby se v hádance neobjevilo záporné číslo
   ani mezivýsledek. */
/* Obrázky, které se po svém odvození už v žádné další rovnici neobjeví.
   Ty musí být v posledním řádku - jinak by je dítě počítalo pro nic. */
function danglingSymbols(rows, n) {
  const seenBefore = new Array(n).fill(false);
  const usedAgain = new Array(n).fill(false);
  for (const row of rows) {
    const inRow = new Set(row.terms.filter(isSym).map((t) => t.sym));
    if (row.rhs.sym !== undefined) inRow.add(row.rhs.sym);
    for (const s of inRow) {
      if (seenBefore[s]) usedAgain[s] = true;
      seenBefore[s] = true;
    }
  }
  return range(0, n - 1).filter((s) => !usedAgain[s]);
}

function riddleQuestion(n, values, rows, level, cap) {
  const used = new Set(rows.map((r) => termsKey(r.terms)));
  const required = danglingSymbols(rows, n);
  if (required.length > level.qTerms[1]) return null; // do řádku by se nevešly
  const found = [];

  for (let attempt = 0; attempt < 80; attempt++) {
    const len = rnd(level.qTerms[0], level.qTerms[1]);
    const terms = [];
    let running = 0;
    let minuses = 0;
    for (let i = 0; i < len; i++) {
      // nejvýš jeden minus v řádku - "🍊 − 🍇 − 🍓" už je na dítě řetěz
      const minus = i > 0 && level.qMinus && minuses === 0 && chance(0.45);
      if (minus) minuses += 1;
      // u minusu vybíráme jen z obrázků, po kterých součet neklesne pod 1
      const choices = minus ? range(0, n - 1).filter((s) => running - values[s] >= 1) : range(0, n - 1);
      if (!choices.length) break;
      const sym = pick(choices);
      running += (minus ? -1 : 1) * values[sym];
      terms.push(symTerm(sym, minus ? -1 : 1));
    }
    if (terms.length !== len || running < 1 || running > cap) continue;

    // obrázek, který se v řádku sám vyruší (🍀 + 🌼 − 🌼), tam nemá co dělat
    const net = new Array(n).fill(0);
    for (const t of terms) net[t.sym] += t.sign;
    if (terms.some((t) => net[t.sym] === 0)) continue;

    // u čistého součtu srovnáme stejné obrázky k sobě, ať se řádek dobře čte
    if (terms.every((t) => t.sign === 1)) terms.sort((x, y) => x.sym - y.sym);
    if (used.has(termsKey(terms))) continue;

    const inQ = new Set(terms.map((t) => t.sym));
    if (!required.every((s) => inQ.has(s))) continue;
    found.push({ terms, rhs: null, total: running });
  }
  if (!found.length) return null;

  // z přípustných bereme ten, který zapojí nejvíc různých obrázků
  const reach = (q) => new Set(q.terms.map((t) => t.sym)).size;
  const best = Math.max(...found.map(reach));
  return pick(found.filter((q) => reach(q) === best));
}

/* ---------------- poskládání hádanky ---------------- */

/* Stejnou sadu nechceme několikrát za sebou - držíme si poslední čtyři. */
let recentSets = [];
function pickRiddleSet() {
  const fresh = RIDDLE_SETS.filter((s) => !recentSets.includes(s.key));
  const set = pick(fresh.length ? fresh : RIDDLE_SETS);
  recentSets = [set.key, ...recentSets.filter((k) => k !== set.key)].slice(0, 4);
  return set;
}

function assemble(set, values, rows, question, steps, level) {
  const n = values.length;
  return {
    set: set.key,
    setLabel: set.label,
    level,
    symbols: shuffle(set.symbols).slice(0, n),
    values,
    rows,
    question,
    steps,
    key: `${rows.map(rowKey).join('|')}#${termsKey(question.terms)}#${values.join(',')}`,
  };
}

/* Záchranná hádanka, kdyby losování nenašlo nic ani na nejmenší počet
   obrázků (hrozí jen u hodně těsného rozsahu, třeba "těžká" a "do 5").
   Platí vždy: 2 ≤ cap, 1 + w ≤ cap i 2w ≤ cap. */
function fallbackRiddle(set, cap, levelKey) {
  const w = Math.max(2, Math.min(Math.floor(cap / 2), 4));
  const values = [1, w];
  const rows = [
    { terms: [symTerm(0), symTerm(0)], rhs: { num: 2 } },
    { terms: [symTerm(0), symTerm(1)], rhs: { num: 1 + w } },
  ];
  const question = { terms: [symTerm(1), symTerm(1)], rhs: null, total: 2 * w };
  return assemble(set, values, rows, question, solveRiddle(rows, 2).steps, levelKey);
}

function tryRiddle(n, level, cap, maxValue) {
  if (maxValue < n) return null; // na tolik různých hodnot už není místo
  const ladder = buildLadder(n, level, cap, maxValue);
  if (!ladder) return null;
  const { values, rows } = ladder;
  const solved = solveRiddle(rows, n);
  if (!solved) return null;
  const question = riddleQuestion(n, values, rows, level, cap);
  return question ? { values, rows, question, steps: solved.steps } : null;
}

export function makeRiddle(max, levelKey = 'easy') {
  const level = RIDDLE_LEVELS[levelKey] ? levelKey : 'easy';
  const spec = RIDDLE_LEVELS[level];
  const cap = max;
  const maxValue = riddleMaxValue(cap);
  const set = pickRiddleSet();

  for (let attempt = 0; attempt < 400; attempt++) {
    const hit = tryRiddle(rnd(spec.symbols[0], spec.symbols[1]), spec, cap, maxValue);
    if (hit) return assemble(set, hit.values, hit.rows, hit.question, hit.steps, level);
  }

  /* Do těsného rozsahu se plný počet obrázků nemusí vejít. Než hádanku
     vzdát, zkusíme jich o kus míň - obtížnost si tím sice trochu ubereme,
     ale pořád je to lepší než záchranná hádanka. */
  for (let n = spec.symbols[0] - 1; n >= 2; n--) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const hit = tryRiddle(n, spec, cap, maxValue);
      if (hit) return assemble(set, hit.values, hit.rows, hit.question, hit.steps, level);
    }
  }

  return fallbackRiddle(set, cap, level);
}

/* ---------------- text ---------------- */

/* Řádek jako text. `known` (nepovinné) nahradí už odvozené obrázky čísly -
   přesně tak, jak si to dítě postupně dosazuje. */
export function riddleRowText(row, symbols, known = null) {
  const shown = (sym) => (known && known[sym] !== null && known[sym] !== undefined ? String(known[sym]) : symbols[sym]);
  const face = (t) => (isSym(t) ? shown(t.sym) : String(t.num));

  let out = `${row.terms[0].sign < 0 ? '−' : ''}${face(row.terms[0])}`;
  for (const t of row.terms.slice(1)) out += ` ${t.sign < 0 ? '−' : '+'} ${face(t)}`;

  const right = !row.rhs ? '?' : row.rhs.sym !== undefined ? shown(row.rhs.sym) : String(row.rhs.num);
  return `${out} = ${right}`;
}

/* Číslo z levé strany se při počítání přesouvá doprava s obráceným
   znaménkem: 🌰 + 2 = 7 → 7 − 2. Právě tuhle úvahu chceme ukázat. */
function constMove(row) {
  if (row.rhs?.num === undefined) return null;
  const shift = row.terms.reduce((s, t) => (isSym(t) ? s : s + t.sign * t.num), 0);
  if (shift === 0) return null;
  return `${row.rhs.num} ${shift > 0 ? '−' : '+'} ${Math.abs(shift)} = ${row.rhs.num - shift}`;
}

/* Vysvětlení skládáme z kroků řešitele, takže popisuje přesně tu cestu,
   kterou hádanku rozlouskne i dítě - řádek po řádku odshora. */
export function riddleExplain(ex) {
  const { symbols } = ex;

  const out = ex.steps.map((step) => {
    const sym = symbols[step.sym];
    const row = ex.rows[step.row];
    const plain = riddleRowText(row, symbols);
    const share = step.coeff > 1 ? ` Na ${step.coeff}× ${sym} zbude ${step.rest}, takže ` : ' Takže ';

    // nic se nedosazovalo - obrázek se dá přečíst rovnou z tohohle řádku
    if (!step.substituted) {
      const move = constMove(row);
      if (move) return `Řádek ${plain}: ${move}.${share}${sym} = ${step.value}.`;
      return `V řádku ${plain} jsou jen stejné obrázky: ${step.coeff}× ${sym} = ${step.rest}, takže ${sym} = ${step.value}.`;
    }
    return `Do řádku ${plain} dosaď, co už víš: ${riddleRowText(row, symbols, step.known)}.${share}${sym} = ${step.value}.`;
  });

  const filled = riddleRowText({ ...ex.question, rhs: { num: ex.question.total } }, symbols, ex.values);
  out.push(`Poslední řádek: ${riddleRowText(ex.question, symbols)} → ${filled}`);
  return out;
}

/* Krátký zápis do seznamu "K procvičení" na výsledkové obrazovce. */
export function riddleText(ex, reveal) {
  const q = riddleRowText(ex.question, ex.symbols).replace(/ = \?$/, '');
  return `hádanka ${q}${reveal ? ` = ${ex.question.total}` : ''}`;
}
