import { rnd, shuffle } from './random.js';

/* ============================================================
   Kytičky - doplň lístek

   Na louce rostou dvě kytičky. Uprostřed každé je číslo a čísla na
   lístcích dají dohromady přesně tohle číslo. Jeden lístek je prázdný
   a dítě ho doplní (na lehčích úrovních vybírá z nabídky čísel).

   Trénuje se doplňování do celku: kolik chybí do 100, když už mám
   20 + 10 + 30? Číslo uprostřed se losuje pro každou kytičku zvlášť
   a jak velké je, řídí obtížnost (`lo`-`hi`, krok `step`). Karta
   „Do kolika počítáme?“ je u kytiček schovaná - dřív byl střed vždycky
   přesně rozsah a uživateli vadilo, že je pořád 20 (7. 11. 2026).

   Úloha má stejný tvar jako rozklad přes desítku: několik políček
   (jedno prázdné za každou kytičku), odpovědí je řetězec jejich hodnot
   spojený ', ' - `PART_SEL` v app.js se o zbytek postará.
   ============================================================ */

export const KVET_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'tři lístky po desítkách, uprostřed 30 až 60, a nabídka čísel', petals: 3, step: 10, lo: 30, hi: 60, hint: 'choices' },
  medium: { label: 'Střední', emoji: '🟡', note: 'čtyři lístky po desítkách, uprostřed 50 až 100, a nabídka čísel', petals: 4, step: 10, lo: 50, hi: 100, hint: 'choices' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'čtyři lístky s jakýmikoli čísly, uprostřed 20 až 100, píšeš sama', petals: 4, step: 1, lo: 20, hi: 100, hint: 'none' },
};
export const KVET_LEVEL_KEYS = Object.keys(KVET_LEVELS);

export const KVET_FLOWERS = 2;

/* Rozdělí `units` kroků do `n` lístků. Nula na lístku nesmí být nikde -
   lístek „0“ i doplnění „chybí 0“ uživateli vadilo (7. 11. 2026). */
function split(units, n) {
  for (let i = 0; units >= n && i < 200; i++) {
    const cuts = Array.from({ length: n - 1 }, () => rnd(1, units - 1)).sort((x, y) => x - y);
    const parts = [...cuts, units].map((c, k) => c - (k ? cuts[k - 1] : 0));
    if (parts.includes(0)) continue;
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
  const pool = shuffle(Array.from({ length: target / step }, (_, k) => (k + 1) * step))
    .sort((x, y) => Math.min(...answers.map((a) => Math.abs(x - a))) - Math.min(...answers.map((a) => Math.abs(y - a))));
  for (const n of pool) {
    if (out.length >= 6) break;
    if (!out.includes(n)) out.push(n);
  }
  /* Do 40 po desítkách jsou jen čtyři čísla (10 až 40) - uživatel chce vždycky
     šest tlačítek, takže se jedno špatné číslo zopakuje. */
  const spare = pool.filter((n) => !answers.includes(n));
  for (let i = 0; out.length < 6; i++) out.push(spare.length ? spare[i % spare.length] : pool[i % pool.length]);
  return shuffle(out);
}

/* Střed jedné kytičky - násobek kroku mezi `lo` a `hi`. */
const rollTarget = ({ lo, hi, step }) => rnd(lo / step, hi / step) * step;

export function makeKvet(levelKey = 'easy') {
  const level = KVET_LEVELS[levelKey] ? levelKey : 'easy';
  const cfg = KVET_LEVELS[level];
  const { petals, hint, step } = cfg;
  // dvě kytičky se stejným středem by vypadaly jako opakování
  const targets = [rollTarget(cfg)];
  while (targets.length < KVET_FLOWERS) {
    const t = rollTarget(cfg);
    if (!targets.includes(t)) targets.push(t);
  }
  const flowers = targets.map((target) => ({ target, ...flower(target, petals, step) }));
  const values = flowers.map((f) => f.values[f.empty]);
  const top = Math.max(...targets);
  const ex = {
    level, hint, flowers, step, top,
    hidden: flowers.map((_, i) => i),
    values,
    key: flowers.map((f) => `${f.target}:${f.values.join('-')}@${f.empty}`).join('|'),
  };
  if (hint === 'choices') ex.numbers = choices(values, top, step);
  return ex;
}

export function kvetExplain(ex) {
  return ex.flowers.map((f, i) => {
    const known = f.values.filter((_, k) => k !== f.empty);
    const sum = known.reduce((s, v) => s + v, 0);
    const x = f.target - sum;
    return `${i + 1}. kytička: ${known.join(' + ')} = ${sum}. Do ${f.target} chybí ${f.target} − ${sum} = **${x}**.`;
  });
}

export function kvetText(ex, reveal) {
  const flowers = ex.flowers
    .map((f) => `${f.values.map((v, k) => (k === f.empty && !reveal ? '?' : v)).join(' + ')} = ${f.target}`)
    .join(', ');
  return `kytičky: ${flowers}`;
}
