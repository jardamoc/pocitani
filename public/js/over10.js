import { rnd } from './random.js';

/* ============================================================
   Počítej přes 10

   Rozklad krok za krokem, přesně jak se to učí ve škole:

       8 + 5
       = 8 + [2] + [3]      2 doplní osmičku do desítky, 3 zbývá
       = 10 + [3]
       = [13]

   Dvě věci, na kterých to stojí:

   1. OBTÍŽNOST ŘÍDÍ POČET DOPLŇOVANÝCH KROKŮ, ne velikost čísel.
      Jak velká čísla vyjdou, rozhoduje výhradně rozsah ("do kolika
      počítáme") - dvě nezávislé osy, stejně jako u mřížky a hádanek.

   2. ROZKLAD SE POČÍTÁ, NEHÁDÁ. Vylosuje se první číslo, z jeho
      jednotek plyne, kolik chybí do desítky, a teprve k tomu se
      dolosuje zbytek. Druhé číslo tak vždycky vyjde jednociferné
      a přes desítku se opravdu přejde.

   Rozklad je stejný, jaký umí `tenStrategyAdd()` v generator.js:
   `ten = (10 - a % 10) % 10`, `rest = b - ten`.
   ============================================================ */

/* `fields` je zároveň pořadí políček na obrazovce i pořadí hodnot
   v odpovědi - `app.js` je čte setříděné podle `data-idx`. */
export const OVER10_LEVELS = {
  easy: {
    label: 'Lehká', emoji: '🟢', note: 'doplníš jen rozklad druhého čísla',
    fields: ['ten', 'rest'],
  },
  medium: {
    label: 'Střední', emoji: '🟡', note: 'rozklad a k tomu výsledek',
    fields: ['ten', 'rest', 'c'],
  },
  hard: {
    label: 'Těžká', emoji: '🔴', note: 'celý zápis včetně mezisoučtu',
    fields: ['ten', 'rest', 'sum', 'rest2', 'c'],
  },
};

export const OVER10_LEVEL_KEYS = Object.keys(OVER10_LEVELS);

/* Do deseti se přes desítku přejít nedá: nejmenší takový součet je 11.
   Pod touhle mezí rozsah potichu nedodržet nejde, tak to raději řekneme
   nahlas a počítáme do dvaceti. */
export const OVER10_MIN_MAX = 12;
export const OVER10_FALLBACK_MAX = 20;

export const over10Max = (max) => (max >= OVER10_MIN_MAX ? max : OVER10_FALLBACK_MAX);

export function over10RangeNote(max) {
  if (max >= OVER10_MIN_MAX) return null;
  return `Přes desítku se dá přejít až nad deset, takže do ${max} by nevyšel jediný příklad. `
    + `Počítat budeme do ${OVER10_FALLBACK_MAX} – nebo si rozsah zvedni sama.`;
}

/* Poskládá jeden příklad. `a` musí mít jednotky aspoň 2, jinak by do desítky
   chybělo 9 a druhé číslo by vyšlo dvojciferné - rozklad 1 + 9 + něco už
   není přechod přes desítku, ale jiná úloha. */
function rollPair(hi) {
  for (let i = 0; i < 300; i++) {
    const a = rnd(2, hi - 2);
    const unit = a % 10;
    if (unit < 2) continue;
    const ten = 10 - unit;
    const maxRest = Math.min(9 - ten, hi - a - ten);
    if (maxRest < 1) continue;
    return { a, ten, rest: rnd(1, maxRest) };
  }
  // záchrana pro nejtěsnější rozsah; 8 + 4 = 12 se vejde do každého povoleného
  return { a: 8, ten: 2, rest: 2 };
}

export function makeOver10(max, levelKey = 'easy') {
  const level = OVER10_LEVELS[levelKey] ? levelKey : 'easy';
  const { a, ten, rest } = rollPair(over10Max(max));
  const b = ten + rest;
  const sum = a + ten;
  const c = a + b;

  const parts = { ten, rest, sum, rest2: rest, c };
  const fields = OVER10_LEVELS[level].fields;

  return {
    a, b, c, ten, rest, sum, level,
    hidden: fields.slice(),
    values: fields.map((f) => parts[f]),
    key: `${a}+${b}|${level}`,
  };
}

/* Vysvětlení po chybě. Mluví se o konkrétní desítce (`sum`), ne obecně -
   u 37 + 6 je cílem čtyřicítka, ne deset. */
export function over10Explain(ex) {
  const { a, b, c, ten, rest, sum } = ex;
  return [
    `Kolik chybí ${a} do ${sum}? Chybí **${ten}**.`,
    `Tolik si uber z druhého čísla: ${b} rozdělíš na ${ten} a ${rest}.`,
    `Nejdřív dopočítej do desítky: ${a} + ${ten} = ${sum}.`,
    `Pak přidej zbytek: ${sum} + ${rest} = **${c}**.`,
  ];
}

export function over10Text(ex, reveal) {
  return `rozklad ${ex.a} + ${ex.b}${reveal ? ` = ${ex.c}` : ''}`;
}
