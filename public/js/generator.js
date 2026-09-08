export const OPS = {
  add: { symbol: '+', label: 'Sčítání', name: 'sčítání', emoji: '➕' },
  sub: { symbol: '−', label: 'Odčítání', name: 'odčítání', emoji: '➖' },
  mul: { symbol: '×', label: 'Násobení', name: 'násobení', emoji: '✖️' },
  div: { symbol: '÷', label: 'Dělení', name: 'dělení', emoji: '➗' },
};

export const MISSING_LABEL = {
  a: 'chybí první číslo',
  b: 'chybí druhé číslo',
  c: 'chybí výsledek',
};

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const chance = (p) => Math.random() < p;

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function crossesTen(op, a, b) {
  if (op === 'add') return a > 0 && b > 0 && (a % 10) + (b % 10) >= 10;
  if (op === 'sub') return a % 10 < b % 10;
  return false;
}

const pairCache = new Map();
function factorPairs(max) {
  if (pairCache.has(max)) return pairCache.get(max);
  const out = [];
  for (let x = 2; x <= 10; x++) {
    for (let y = 2; y <= 10; y++) {
      if (x * y <= max) out.push([x, y]);
    }
  }
  // u malého rozsahu je dvojic se dvěma faktory ≥ 2 příliš málo, přibereme i násobení jedničkou
  if (out.length < 6) {
    for (let y = 1; y <= Math.min(10, max); y++) {
      out.push([1, y]);
      if (y !== 1) out.push([y, 1]);
    }
  }
  pairCache.set(max, out);
  return out;
}

function rawTriple(op, max) {
  if (op === 'add') {
    const c = rnd(2, max);
    const a = rnd(0, c);
    return { a, b: c - a, c };
  }
  if (op === 'sub') {
    const a = rnd(2, max);
    const b = rnd(0, a);
    return { a, b, c: a - b };
  }
  const [x, y] = pick(factorPairs(max));
  if (op === 'mul') return { a: x, b: y, c: x * y };
  return { a: x * y, b: y, c: x };
}

function makeTriple(op, max, wantCross) {
  let fallback = null;
  for (let i = 0; i < 30; i++) {
    const t = rawTriple(op, max);
    if (!fallback) fallback = t;
    if ((t.a === 0 || t.b === 0) && !chance(0.08)) continue;
    if (wantCross !== null && (op === 'add' || op === 'sub') && crossesTen(op, t.a, t.b) !== wantCross) continue;
    return t;
  }
  return fallback;
}

function makeBond(family, max) {
  if (family === 'mul') {
    const [x, y] = pick(factorPairs(max));
    return { a: x, b: y, c: x * y };
  }
  const c = rnd(Math.min(5, max), max);
  const a = rnd(1, Math.max(1, c - 1));
  return { a, b: c - a, c };
}

function pickMissing(kind) {
  const r = Math.random();
  if (kind === 'bond') return r < 0.4 ? 'c' : r < 0.7 ? 'a' : 'b';
  return r < 0.45 ? 'c' : r < 0.75 ? 'b' : 'a';
}

function finalize(ex) {
  ex.answer = ex[ex.missing];
  ex.cross = crossesTen(ex.op, ex.a, ex.b);
  ex.skill = `${ex.op}:${ex.kind}:${ex.missing}:${ex.cross ? 'cross' : 'plain'}`;
  return ex;
}

export function signature(ex) {
  return `${ex.op}|${ex.kind}|${ex.missing}|${ex.a}|${ex.b}`;
}

function bondFamily(op) {
  return op === 'mul' || op === 'div' ? 'mul' : 'add';
}

function makeExercise(op, max, opts = {}) {
  const kind = opts.kind || 'equation';
  if (kind === 'bond') {
    const family = bondFamily(op);
    const t = makeBond(family, max);
    return finalize({ op: family, kind: 'bond', missing: opts.missing || pickMissing('bond'), ...t });
  }
  const wantCross = op === 'add' || op === 'sub' ? chance(0.55) : null;
  const t = makeTriple(op, max, wantCross);
  return finalize({ op, kind: 'equation', missing: opts.missing || pickMissing('equation'), ...t });
}

function randomExercise(ops, max) {
  const op = pick(ops);
  return makeExercise(op, max, { kind: chance(0.18) ? 'bond' : 'equation' });
}

function focusAllowed(m, ops) {
  if (m.kind === 'bond') {
    return m.op === 'mul'
      ? ops.includes('mul') || ops.includes('div')
      : ops.includes('add') || ops.includes('sub');
  }
  return ops.includes(m.op);
}

function similarTo(m, max) {
  const original = signature(m);
  let fallback = null;
  for (let t = 0; t < 40; t++) {
    const ex = makeExercise(m.op, max, { kind: m.kind, missing: m.missing });
    if (!fallback) fallback = ex;
    if (signature(ex) === original) continue;
    const closeResult = Math.abs(ex.c - m.c) <= 3;
    const sameStyle = ex.cross === !!m.cross && Math.abs(ex.c - m.c) <= 6;
    if (closeResult || sameStyle) return ex;
  }
  return fallback;
}

export function buildRound(config, missed = []) {
  const { ops, count, max } = config;
  const usable = missed.filter((m) => focusAllowed(m, ops));
  const focusCount = Math.min(usable.length, Math.round(count * 0.4));
  const chosen = shuffle(usable.slice(0, 12)).slice(0, focusCount);

  const items = [];
  const seen = new Set();
  const push = (ex) => {
    if (!ex) return false;
    const sig = signature(ex);
    if (seen.has(sig)) return false;
    seen.add(sig);
    items.push(ex);
    return true;
  };

  for (const m of chosen) {
    for (let t = 0; t < 6; t++) if (push(similarTo(m, max))) break;
  }

  let guard = 0;
  while (items.length < count && guard++ < count * 60) push(randomExercise(ops, max));
  while (items.length < count) items.push(randomExercise(ops, max));

  return shuffle(items).slice(0, count);
}

export function exToText(ex, reveal = false) {
  const shown = (key) => (ex.missing === key ? (reveal ? String(ex.answer) : '__') : String(ex[key]));
  if (ex.kind === 'bond') {
    const sym = ex.op === 'mul' ? '×' : '+';
    return `pyramida ${shown('c')} = ${shown('a')} ${sym} ${shown('b')}`;
  }
  return `${shown('a')} ${OPS[ex.op].symbol} ${shown('b')} = ${shown('c')}`;
}

function tenStrategyAdd(a, b, c) {
  const t = (10 - (a % 10)) % 10;
  const rest = b - t;
  if (t <= 0 || rest <= 0) return [];
  return [
    `Nejdřív dopočítej do desítky: ${a} + ${t} = ${a + t}.`,
    `Zbývá přidat ${rest}: ${a + t} + ${rest} = ${c}.`,
  ];
}

function tenStrategySub(a, b, c) {
  const r = a % 10;
  const rest = b - r;
  if (r <= 0 || rest <= 0) return [];
  return [
    `Nejdřív odečti k desítce: ${a} − ${r} = ${a - r}.`,
    `Zbývá odečíst ${rest}: ${a - r} − ${rest} = ${c}.`,
  ];
}

function repeatedAdditionStep(a, b, c) {
  const count = Math.min(a, b);
  const value = Math.max(a, b);
  if (count > 6) return [`Z násobilky: ${a} × ${b} = ${c}.`];
  return [
    `${a} × ${b} znamená sečíst ${value} celkem ${count}krát.`,
    `${Array(count).fill(value).join(' + ')} = ${c}.`,
  ];
}

export function explain(ex) {
  const { op, kind, missing, a, b, c } = ex;

  if (kind === 'bond') {
    if (op === 'add') {
      if (missing === 'c') {
        return ['Spodní čísla dáme dohromady.', ...tenStrategyAdd(a, b, c), `${a} + ${b} = ${c}.`];
      }
      const known = missing === 'a' ? b : a;
      return [
        `Nahoře je celek ${c}, dole je jedna část ${known}.`,
        `Druhou část dopočítáš odčítáním: ${c} − ${known} = ${ex.answer}.`,
        `Zkouška: ${a} + ${b} = ${c}. ✔`,
      ];
    }
    if (missing === 'c') return [`Spodní čísla vynásobíme: ${a} × ${b} = ${c}.`];
    const known = missing === 'a' ? b : a;
    return [
      `Nahoře je celek ${c}, dole je jeden díl ${known}.`,
      `Druhý díl dopočítáš dělením: ${c} ÷ ${known} = ${ex.answer}.`,
      `Zkouška: ${a} × ${b} = ${c}. ✔`,
    ];
  }

  if (op === 'add') {
    if (missing === 'c') return [...tenStrategyAdd(a, b, c), `${a} + ${b} = ${c}.`];
    const known = missing === 'a' ? b : a;
    return [
      `Ptáme se: kolik chybí z ${known} do ${c}?`,
      `Chybějící číslo najdeš odčítáním: ${c} − ${known} = ${ex.answer}.`,
      `Zkouška: ${a} + ${b} = ${c}. ✔`,
    ];
  }

  if (op === 'sub') {
    if (missing === 'c') return [...tenStrategySub(a, b, c), `${a} − ${b} = ${c}.`];
    if (missing === 'b') {
      return [
        `Z ${a} zbylo ${c}. Ptáme se, kolik ubylo.`,
        `Odečteme: ${a} − ${c} = ${b}.`,
        `Zkouška: ${a} − ${b} = ${c}. ✔`,
      ];
    }
    return [
      `Víme jen konec: po odečtení ${b} zbylo ${c}.`,
      `Odečtené číslo přidáme zpátky: ${c} + ${b} = ${a}.`,
      `Zkouška: ${a} − ${b} = ${c}. ✔`,
    ];
  }

  if (op === 'mul') {
    if (missing === 'c') return repeatedAdditionStep(a, b, c);
    const known = missing === 'a' ? b : a;
    return [
      `Ptáme se: kolikrát ${known}, abychom měli ${c}?`,
      `Chybějící číslo najdeš dělením: ${c} ÷ ${known} = ${ex.answer}.`,
      `Zkouška: ${a} × ${b} = ${c}. ✔`,
    ];
  }

  if (missing === 'c') {
    return [
      `Kolikrát se ${b} vejde do ${a}?`,
      `Z násobilky: ${b} × ${c} = ${a}, takže ${a} ÷ ${b} = ${c}.`,
    ];
  }
  if (missing === 'b') {
    return [
      `Číslo ${a} jsme rozdělili na díly a vyšlo ${c}.`,
      `Dělitele najdeš dělením: ${a} ÷ ${c} = ${b}.`,
      `Zkouška: ${b} × ${c} = ${a}. ✔`,
    ];
  }
  return [
    `Hledáme číslo, které po dělení ${b} dá ${c}.`,
    `Vynásobíme zpátky: ${c} × ${b} = ${a}.`,
    `Zkouška: ${a} ÷ ${b} = ${c}. ✔`,
  ];
}

export const TAGS = {
  swapOp: 'zaměněná operace',
  inverse: 'obrácený postup',
  offOne: 'chyba o jedničku',
  offTen: 'chyba o desítku',
  other: 'jiná chyba',
};

export function diagnose(ex, given) {
  const { op, kind, missing, a, b, c, answer } = ex;
  if (given === answer) return null;

  if (kind === 'equation') {
    if (op === 'add' && missing === 'c' && given === Math.abs(a - b)) return 'swapOp';
    if (op === 'sub' && missing === 'c' && given === a + b) return 'swapOp';
    if (op === 'mul' && missing === 'c' && given === a + b) return 'swapOp';
    if (op === 'add' && missing !== 'c' && given === (missing === 'a' ? b : a) + c) return 'inverse';
    if (op === 'sub' && missing === 'b' && given === a + c) return 'inverse';
    if (op === 'sub' && missing === 'a' && given === Math.abs(c - b)) return 'inverse';
    if (op === 'mul' && missing !== 'c' && given === (missing === 'a' ? b : a) * c) return 'inverse';
    if (op === 'div' && missing === 'c' && given === a * b) return 'inverse';
  }
  if (kind === 'bond') {
    if (op === 'add' && missing === 'c' && given === Math.abs(a - b)) return 'swapOp';
    if (op === 'add' && missing !== 'c' && given === (missing === 'a' ? b : a) + c) return 'inverse';
  }

  const diff = Math.abs(given - answer);
  if (diff === 1) return 'offOne';
  if (diff === 10) return 'offTen';
  return 'other';
}
