import { rnd, shuffle } from './random.js';

/* ============================================================
   Kytičky - doplň lístek

   Na louce rostou dvě kytičky. Uprostřed každé je číslo a čísla na
   lístcích dají dohromady přesně tohle číslo. Jeden lístek je prázdný
   a dítě ho doplní (na lehčích úrovních vybírá z nabídky čísel).

   Trénuje se doplňování do celku: kolik chybí do 100, když už mám
   20 + 10 + 0? Součet uprostřed je rozsah („do kolika počítáme“),
   nejvýš 100.

   Úloha má stejný tvar jako rozklad přes desítku: několik políček
   (jedno prázdné za každou kytičku), odpovědí je řetězec jejich hodnot
   spojený ', ' - `PART_SEL` v app.js se o zbytek postará.
   ============================================================ */

export const KVET_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'tři lístky, čísla po desítkách a nabídka čísel', petals: 3, tens: true, hint: 'choices' },
  medium: { label: 'Střední', emoji: '🟡', note: 'čtyři lístky po desítkách a nabídka čísel', petals: 4, tens: true, hint: 'choices' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'čtyři lístky s jakýmikoli čísly, píšeš sama', petals: 4, tens: false, hint: 'none' },
};
export const KVET_LEVEL_KEYS = Object.keys(KVET_LEVELS);

export const KVET_FLOWERS = 2;
export const KVET_MIN = 10;
export const KVET_TOP = 100;

export const kvetTarget = (max) => Math.max(KVET_MIN, Math.min(KVET_TOP, Math.round(max)));

/* Po desítkách jen tam, kde to dává smysl - „do 15“ po desítkách nejde. */
const stepFor = (level, target) => (KVET_LEVELS[level].tens && target % 10 === 0 && target >= 40 ? 10 : 1);

export function kvetRangeNote(max) {
  if (max > KVET_TOP) return `V kytičce je nejvýš ${KVET_TOP}, víc se tu nepočítá.`;
  if (max < KVET_MIN) return `V kytičce je aspoň ${KVET_MIN}.`;
  return null;
}

/* Rozdělí `units` kroků do `n` lístků. Žádný lístek nesmí nést celý součet
   (ostatní by byly samé nuly) a nula smí být nejvýš jedna. */
function split(units, n) {
  for (let i = 0; i < 200; i++) {
    const cuts = Array.from({ length: n - 1 }, () => rnd(0, units)).sort((x, y) => x - y);
    const parts = [...cuts, units].map((c, k) => c - (k ? cuts[k - 1] : 0));
    if (Math.max(...parts) === units) continue;
    if (parts.filter((p) => p === 0).length > 1) continue;
    return parts;
  }
  // záchrana pro malé součty: rovnoměrně, zbytek do prvního lístku
  const base = Math.floor(units / n);
  return Array.from({ length: n }, (_, k) => base + (k === 0 ? units - base * n : 0));
}

function flower(target, n, step) {
  const values = split(target / step, n).map((v) => v * step);
  return { values, empty: rnd(0, n - 1) };
}

/* Nabídka: správná čísla a k nim věrohodní sousedé, celkem šest. */
function choices(answers, target, step) {
  const out = [...new Set(answers)];
  const pool = shuffle(Array.from({ length: target / step + 1 }, (_, k) => k * step))
    .sort((x, y) => Math.min(...answers.map((a) => Math.abs(x - a))) - Math.min(...answers.map((a) => Math.abs(y - a))));
  for (const n of pool) {
    if (out.length >= 6) break;
    if (!out.includes(n)) out.push(n);
  }
  /* Do 40 po desítkách je jen pět čísel (0 až 40) - uživatel chce vždycky
     šest tlačítek, takže se jedno špatné číslo zopakuje. */
  const spare = pool.filter((n) => !answers.includes(n));
  for (let i = 0; out.length < 6; i++) out.push(spare.length ? spare[i % spare.length] : pool[i % pool.length]);
  return shuffle(out);
}

export function makeKvet(max, levelKey = 'easy') {
  const level = KVET_LEVELS[levelKey] ? levelKey : 'easy';
  const { petals, hint } = KVET_LEVELS[level];
  const target = kvetTarget(max);
  const step = stepFor(level, target);
  const flowers = Array.from({ length: KVET_FLOWERS }, () => flower(target, petals, step));
  const values = flowers.map((f) => f.values[f.empty]);
  const ex = {
    level, hint, target, flowers, step,
    hidden: flowers.map((_, i) => i),
    values,
    key: flowers.map((f) => `${f.values.join('-')}@${f.empty}`).join('|'),
  };
  if (hint === 'choices') ex.numbers = choices(values, target, step);
  return ex;
}

export function kvetExplain(ex) {
  return ex.flowers.map((f, i) => {
    const known = f.values.filter((_, k) => k !== f.empty);
    const sum = known.reduce((s, v) => s + v, 0);
    const x = ex.target - sum;
    return `${i + 1}. kytička: ${known.join(' + ')} = ${sum}. Do ${ex.target} chybí ${ex.target} − ${sum} = **${x}**.`;
  });
}

export function kvetText(ex, reveal) {
  const flowers = ex.flowers
    .map((f) => f.values.map((v, k) => (k === f.empty && !reveal ? '?' : v)).join(' + '))
    .join(', ');
  return `kytičky do ${ex.target}: ${flowers}`;
}
