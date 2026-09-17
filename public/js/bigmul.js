import { rnd, shuffle } from './random.js';

/* ============================================================
   Velké násobení

   Zápis roste shora dolů a dítě v každém kroku vybírá z dvou možností:

       Vypočítej 85 × 5
         80 × 5 + 5 × 5      ← vybráno
       Rozdělíme si to.
         400 + 25
       Roznásobíme.
         425
       Sečteme.

   Netrénuje se výsledek, ale ROZKLAD NA DESÍTKY A JEDNOTKY - tedy proč
   se velké násobení dá spočítat zpaměti. Dítě nic nepíše, jen rozhoduje;
   přesně tam se dělá chyba (ztracená nula, špatný činitel).

   Tři věci, na kterých to stojí:

   1. ROZKLÁDÁ SE VÍCECIFERNÝ ČINITEL; když jsou víceciferní oba, rozkládá
      se druhý. Jedno pravidlo, dá se vysvětlit jednou větou:
        85 × 5  → 80 × 5 + 5 × 5      (dělí se první)
        238 × 4 → 200 × 4 + 30 × 4 + 8 × 4
        24 × 13 → 24 × 10 + 24 × 3    (dělí se druhý)

   2. ŠPATNÁ MOŽNOST NENÍ NÁHODNÁ, je to typická chyba - jinak by se dala
      poznat od oka, aniž by dítě cokoli počítalo.

   3. OBTÍŽNOST = VELIKOST ČINITELŮ, rozsah = strop na výsledek. Dvě
      nezávislé osy, stejně jako u mřížky a hádanek. Pod minimem úrovně
      by nevyšel jediný příklad, tak se počítá do minima a `bigmulRangeNote()`
      to napíše nahlas - stejně jako u rozkladu přes desítku.
   ============================================================ */

/* Stejný křížek jako všude jinde v aplikaci (`OPS.mul.symbol`) - dítě má
   vidět pořád tentýž znak. Sem se importovat nedá, generator.js si importuje
   tenhle soubor a byl by z toho kruh. */
const MUL = '×';

export const BIGMUL_LEVELS = {
  easy: {
    label: 'Lehká', emoji: '🟢',
    note: 'dvojciferné číslo krát jednociferné', example: `85 ${MUL} 5`,
    minMax: 100,
  },
  medium: {
    label: 'Střední', emoji: '🟡',
    note: 'trojciferné číslo krát jednociferné', example: `238 ${MUL} 4`,
    minMax: 500,
  },
  hard: {
    label: 'Těžká', emoji: '🔴',
    note: 'dvojciferné číslo krát dvojciferné', example: `24 ${MUL} 13`,
    minMax: 200,
  },
};

export const BIGMUL_LEVEL_KEYS = Object.keys(BIGMUL_LEVELS);

const levelKeyOf = (key) => (BIGMUL_LEVELS[key] ? key : 'easy');

/* Strop, se kterým se opravdu počítá. Pod minimem úrovně se rozsah mlčky
   porušit nedá, tak se zvedne na minimum a řekne se to nahlas. */
export function bigmulMax(levelKey, max) {
  const { minMax } = BIGMUL_LEVELS[levelKeyOf(levelKey)];
  return max >= minMax ? max : minMax;
}

export function bigmulRangeNote(levelKey, max) {
  const level = BIGMUL_LEVELS[levelKeyOf(levelKey)];
  if (max >= level.minMax) return null;
  return `Takhle velké násobení se do ${max} nevejde – i ten nejmenší příklad je větší. `
    + `Počítat budeme do ${level.minMax} – nebo si rozsah zvedni sama.`;
}

/* ---------------- losování činitelů ----------------
   Losuje se v cyklu s omezeným počtem pokusů a záchranným příkladem pro
   nejtěsnější rozsah, stejně jako `rollPair()` v over10.js. Druhý činitel
   se bere první, protože z něj plyne strop pro ten první. */
function rollNumbers(levelKey, hi) {
  if (levelKey === 'medium') {
    for (let i = 0; i < 400; i++) {
      const b = rnd(2, 9);
      /* Všechny tři číslice musí být 1 až 9 - nula v rozkladu by dala
         nesmyslný člen `0 · 4`. */
      const a = rnd(1, 9) * 100 + rnd(1, 9) * 10 + rnd(1, 9);
      if (a * b <= hi) return { a, b };
    }
    return { a: 111, b: 2 }; // 222 se vejde do každého povoleného rozsahu
  }

  if (levelKey === 'hard') {
    for (let i = 0; i < 400; i++) {
      const b = rnd(11, 29);
      /* Jednotky druhého činitele musí být aspoň 2: rozkládá se na desítky
         a jednotky a špatná možnost v prvním kroku nahrazuje jednotky
         jedničkou - při jednotkách 1 by vyšla stejně jako ta správná. */
      if (b % 10 < 2) continue;
      const hiA = Math.min(49, Math.floor(hi / b));
      if (hiA < 11) continue;
      return { a: rnd(11, hiA), b };
    }
    return { a: 11, b: 12 }; // 132, tedy pod minimem úrovně (200)
  }

  for (let i = 0; i < 400; i++) {
    const b = rnd(2, 9);
    const hiA = Math.min(99, Math.floor(hi / b));
    if (hiA < 11) continue;
    const a = rnd(11, hiA);
    // bez jednotek není co rozkládat: `80 · 5` sám o sobě není rozklad
    if (a % 10 < 1) continue;
    return { a, b };
  }
  return { a: 11, b: 2 };
}

/* Dvojice na roznásobení. Vrací i `splitFirst`, protože vysvětlení po chybě
   musí říct, které z obou čísel se rozdělilo. */
function splitTerms(levelKey, a, b) {
  if (levelKey === 'hard') {
    return { splitFirst: false, terms: [[a, Math.floor(b / 10) * 10], [a, b % 10]] };
  }
  if (levelKey === 'medium') {
    return {
      splitFirst: true,
      terms: [
        [Math.floor(a / 100) * 100, b],
        [Math.floor(a / 10) % 10 * 10, b],
        [a % 10, b],
      ],
    };
  }
  return { splitFirst: true, terms: [[Math.floor(a / 10) * 10, b], [a % 10, b]] };
}

/* Uvnitř členu je úzká mezera U+2009, mezi členy obyčejná. CSS `word-spacing`
   na `.bm-value` / `.bm-opt` platí jen pro obyčejnou mezeru, takže se plus
   odsadí od okolí, ale `×` zůstane u svých čísel natěsno. Kdyby tu byly
   všude obyčejné mezery, roztáhlo by se i okolí křížku. */
const TIGHT = ' ';
const termsText = (terms) => terms.map(([x, y]) => `${x}${TIGHT}${MUL}${TIGHT}${y}`).join(' + ');

/* Prohození desítek a jednotek - typická chyba při sčítání zpaměti.
   `null` znamená, že by vyšlo totéž (jednociferné číslo nebo 33, 44 …). */
function swapTensUnits(n) {
  const u = n % 10;
  const t = Math.floor(n / 10) % 10;
  if (n < 10 || u === t) return null;
  return n + (u - t) * 10 + (t - u);
}

/* ---------------- tři kroky ----------------
   Špatná možnost je vždycky typická chyba, ne náhodné číslo:
     1. v posledním členu se ztratí činitel  (80 × 5 + 5 × 1)
     2. v prvním součinu se ztratí nula      (40 + 25)
     3. v druhém sčítanci se prohodí číslice (452)
   Pořadí obou tlačítek se losuje, ať správná není pořád vpravo. */
function buildSteps(terms, products, c, cap) {
  const last = terms[terms.length - 1];
  const wrongSplit = [...terms.slice(0, -1), [last[0], 1]];

  const wrongProducts = [products[0] / 10, ...products.slice(1)];

  /* Součet: nejdřív prohozené číslice, a když to nejde nebo by výsledek
     přerostl rozsah, posuneme o desítku (a jako poslední záchranu o jedničku
     dolů - to se do rozsahu vejde vždycky). */
  const swapped = swapTensUnits(products[1]);
  const sumCandidates = [
    swapped === null ? null : c - products[1] + swapped,
    c + 10,
    c - 10,
    c - 1,
  ];
  const wrongSum = sumCandidates.find((n) => n !== null && n > 0 && n !== c && n <= cap);

  const step = (label, correct, wrong, tag) => ({
    label, correct, wrong, tag, options: shuffle([correct, wrong]),
  });

  return [
    step('Rozdělíme si to.', termsText(terms), termsText(wrongSplit), 'bigmulSplit'),
    step('Roznásobíme.', products.join(' + '), wrongProducts.join(' + '), 'bigmulProduct'),
    step('Sečteme.', String(c), String(wrongSum), 'bigmulSum'),
  ];
}

export function makeBigmul(max, levelKey = 'easy') {
  const level = levelKeyOf(levelKey);
  const cap = bigmulMax(level, max);
  const { a, b } = rollNumbers(level, cap);
  const { splitFirst, terms } = splitTerms(level, a, b);
  const products = terms.map(([x, y]) => x * y);
  const c = a * b;

  return {
    a, b, c, level, splitFirst, terms, products,
    task: `${a} ${MUL} ${b}`,
    steps: buildSteps(terms, products, c, cap),
    key: `${a}x${b}`,
  };
}

/* Vysvětlení po chybě. Mluví se o konkrétním čísle, které se rozdělilo -
   u `24 · 13` je to ta třináctka, ne dvacet čtyři. */
export function bigmulExplain(ex) {
  const { c, terms, products, splitFirst } = ex;
  const cele = splitFirst ? ex.a : ex.b;
  const casti = terms.map((t) => (splitFirst ? t[0] : t[1]));
  const vyjmenuj = casti.length > 2
    ? `${casti.slice(0, -1).join(', ')} a ${casti[casti.length - 1]}`
    : `${casti[0]} a ${casti[1]}`;

  return [
    `Číslo ${cele} si rozděl na ${vyjmenuj}.`,
    `Každou část vynásob zvlášť: ${termsText(terms)}.`,
    `Roznásob a hlídej si nuly: ${terms[0][0]} ${MUL} ${terms[0][1]} je **${products[0]}**.`,
    `Nakonec sečti: ${products.join(' + ')} = **${c}**.`,
  ];
}

export function bigmulText(ex, reveal) {
  return `velké násobení ${ex.task}${reveal ? ` = ${ex.c}` : ''}`;
}
