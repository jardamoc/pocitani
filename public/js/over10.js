import { rnd, shuffle } from './random.js';

/* ============================================================
   Počítej přes 10

   Rozklad druhého čísla, nakreslený jako větvička - přesně jak se to
   učí ve škole:

       ┌───────┐                                       ┌──────┐
       │   8   │  +  5  =  [13]         16   −  8   =   │  [8] │
       │       │    ╱   ╲                    ╱   ╲      │      │
       │  [2]  │  [2]   [3]                [6]   ──────→│  [2] │
       └───────┘                                        └──────┘

   Rámeček obepíná dvě čísla, která spolu dají rovnou desítku: u sčítání
   první číslo s levou větví (8 + 2 = 10), u odčítání výsledek s pravou
   větví (10 − 2 = 8). Levá větev odčítání sundá první číslo na desítku
   (16 − 6 = 10). Doplňují se vždycky tatáž tři čísla.

   Dvě věci, na kterých to stojí:

   1. OBTÍŽNOST ŘÍDÍ NÁPOVĚDA, ne velikost čísel ani počet políček.
      Lehká ukáže kroužky i nabídku čísel, střední jen kroužky, těžká
      nic. Jak velká čísla vyjdou, rozhoduje výhradně rozsah ("do kolika
      počítáme") - dvě nezávislé osy, stejně jako u mřížky a hádanek.

   2. ROZKLAD SE POČÍTÁ, NEHÁDÁ. Vylosuje se první číslo, z jeho
      jednotek plyne, kolik se k desítce chybí (sčítání) nebo přebývá
      (odčítání), a teprve k tomu se dolosuje zbytek. Druhé číslo tak
      vždycky vyjde jednociferné a přes desítku se opravdu přejde.

   Rozklad je stejný, jaký umí `tenStrategyAdd()` / `tenStrategySub()`
   v generator.js: u sčítání `ten = (10 - a % 10) % 10`, u odčítání
   `ten = a % 10`, a `rest = b - ten`.
   ============================================================ */

/* Doplňovaná políčka jsou ve všech obtížnostech stejná - pořadí je zároveň
   pořadím hodnot v odpovědi; `app.js` je čte setříděné podle `data-idx`. */
export const OVER10_FIELDS = ['ten', 'rest', 'c'];

/* `hint` řídí, co dostane dítě k ruce:
     choices - kroužky v desítkovém rámci a k tomu nabídka čísel
     frame   - jen kroužky
     none    - nic, počítá zpaměti */
export const OVER10_LEVELS = {
  easy: {
    label: 'Lehká', emoji: '🟢', note: 'poradí kroužky i nabídka čísel',
    hint: 'choices',
  },
  medium: {
    label: 'Střední', emoji: '🟡', note: 'poradí jenom kroužky',
    hint: 'frame',
  },
  hard: {
    label: 'Těžká', emoji: '🔴', note: 'bez nápovědy, počítáš sama',
    hint: 'none',
  },
};

/* Nabídka pro lehkou úroveň: tři správná čísla a k nim dva věrohodní
   sousedé, ať se nedá uhodnout podle počtu tlačítek. Vybírá se jen
   z kladných celých čísel - záporná v aplikaci nejsou. */
const CHOICE_COUNT = 5;

function over10Choices({ a, b, ten, rest, c }) {
  /* `ten` a `rest` můžou vyjít stejně (6 + 8 dělí osmičku na 4 a 4); dvakrát
     tatáž čtyřka na klávesnici vypadá jako chyba, tak se nabídne jednou. */
  const out = [...new Set([ten, rest, c])];
  for (const n of shuffle([10, a, b, ten + 1, rest + 1, c - 1, c + 1])) {
    if (out.length >= CHOICE_COUNT) break;
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return shuffle(out);
}

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

/* Poskládá jedno sčítání. `a` musí mít jednotky aspoň 2, jinak by do desítky
   chybělo 9 a druhé číslo by vyšlo dvojciferné - rozklad 1 + 9 + něco už
   není přechod přes desítku, ale jiná úloha. */
function rollAdd(hi) {
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

/* Odčítání jde opačným směrem: uber jednotky prvního čísla a jsi na rovné
   desítce, zbytek se odečte od ní. Jednotky proto musí být 1 až 8 - při nule
   není co rozkládat a při devítce by na zbytek nic nezbylo (druhé číslo by
   vyšlo dvojciferné). První číslo je tu to největší, takže rozsah hlídá jen
   jeho. */
function rollSub(hi) {
  for (let i = 0; i < 300; i++) {
    const a = rnd(11, hi);
    const unit = a % 10;
    if (unit < 1 || unit > 8) continue;
    return { a, ten: unit, rest: rnd(1, 9 - unit) };
  }
  // záchrana pro nejtěsnější rozsah; 12 − 3 = 9 se vejde do každého povoleného
  return { a: 12, ten: 2, rest: 1 };
}

export function makeOver10(max, levelKey = 'easy', op = 'add') {
  const level = OVER10_LEVELS[levelKey] ? levelKey : 'easy';
  const sub = op === 'sub';
  const { a, ten, rest } = (sub ? rollSub : rollAdd)(over10Max(max));
  const b = ten + rest;
  /* `sum` je vždycky ta rovná desítka, na které se cestou zastavíme -
     u 37 + 6 čtyřicítka, u 34 − 7 třicítka. */
  const sum = sub ? a - ten : a + ten;
  const c = sub ? sum - rest : sum + rest;

  const parts = { ten, rest, c };
  const hint = OVER10_LEVELS[level].hint;
  const ex = {
    a, b, c, ten, rest, sum, level, hint, op: sub ? 'sub' : 'add',
    hidden: OVER10_FIELDS.slice(),
    values: OVER10_FIELDS.map((f) => parts[f]),
    /* Znaménko patří do klíče: bez něj by dedup v `buildOver10Round()`
       považoval 16 + 8 a 16 − 8 za tentýž příklad. */
    key: `${a}${sub ? '-' : '+'}${b}|${level}`,
  };
  if (hint === 'choices') ex.numbers = over10Choices(ex);
  return ex;
}

/* Vysvětlení po chybě. Mluví se o konkrétní desítce (`sum`), ne obecně -
   u 37 + 6 je cílem čtyřicítka, ne deset. */
export function over10Explain(ex) {
  const { a, b, c, ten, rest, sum } = ex;
  if (ex.op === 'sub') {
    return [
      `Kolik musíš ubrat z ${a}, abys byla na ${sum}? Ubereš **${ten}**.`,
      `Tolik si vezmi z druhého čísla: ${b} rozdělíš na ${ten} a ${rest}.`,
      `Nejdřív dolů k desítce: ${a} − ${ten} = ${sum}.`,
      `Pak uber zbytek: ${sum} − ${rest} = **${c}**.`,
    ];
  }
  return [
    `Kolik chybí ${a} do ${sum}? Chybí **${ten}**.`,
    `Tolik si uber z druhého čísla: ${b} rozdělíš na ${ten} a ${rest}.`,
    `Nejdřív dopočítej do desítky: ${a} + ${ten} = ${sum}.`,
    `Pak přidej zbytek: ${sum} + ${rest} = **${c}**.`,
  ];
}

export function over10Text(ex, reveal) {
  const sign = ex.op === 'sub' ? '−' : '+';
  return `rozklad ${ex.a} ${sign} ${ex.b}${reveal ? ` = ${ex.c}` : ''}`;
}
