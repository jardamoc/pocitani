import { rnd, pick, shuffle } from './random.js';

/* ============================================================
   Pexeso

   Kartičky lícem dolů, dvojice je příklad a jeho výsledek:

       ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
       │ 7+5 │ │  12 │ │ 9+4 │ │  13 │
       └─────┘ └─────┘ └─────┘ └─────┘

   Co je na kartičkách, řídí zapnuté operace - zapnout jen × znamená
   pexeso na násobilku, funguje i − a ÷.

   Tři věci, na kterých to stojí:

   1. VŠECHNY VÝSLEDKY NA PLOŠE MUSÍ BÝT RŮZNÉ. `7 + 5` i `8 + 4` dají 12;
      na ploše by pak byly dvě vizuálně stejné kartičky "12" a dítě by
      správně spojenou dvojici vidělo jako chybu. Proto se výsledky
      nelosují a pak nekontrolují - nejdřív se spočítá množina výsledků,
      kterých se dá při daných operacích a rozsahu vůbec dosáhnout,
      a teprve z ní se jich potřebný počet vybere.

   2. PLOCHA SE MŮŽE ZMENŠIT. Do rozsahu "do 10" se deset různých výsledků
      nevejde a mlčky porušit rozsah nejde. Místo toho se ubere dvojice
      a `pexesoRangeNote()` to dopředu napíše. O tom, co se stane, rozhoduje
      jediná funkce `pexesoPlan()` - používá ji nastavení i generátor,
      takže se hláška a skutečná plocha nemůžou rozejít.

   3. OBTÍŽNOST = VELIKOST PLOCHY (6 / 8 / 10 dvojic). Jak velká jsou čísla,
      řídí výhradně rozsah - dvě nezávislé osy, stejně jako u mřížky.

   Kolik chybných otočení se ještě počítá za bezchybné kolo, sem nepatří -
   je to hranice odměn a bydlí v `REWARD_RULES` v rewards.js.
   ============================================================ */

/* Symboly si modul drží vlastní schválně. Import z generator.js by udělal
   kruh v závislostech - generator.js si importuje tenhle soubor. */
const SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷' };

export const PEXESO_LEVELS = {
  easy: {
    label: 'Lehká', emoji: '🟢', pairs: 6, cols: 3, note: '6 dvojic, 12 kartiček',
  },
  medium: {
    label: 'Střední', emoji: '🟡', pairs: 8, cols: 4, note: '8 dvojic, 16 kartiček',
  },
  hard: {
    label: 'Těžká', emoji: '🔴', pairs: 10, cols: 4, note: '10 dvojic, 20 kartiček',
  },
};

export const PEXESO_LEVEL_KEYS = Object.keys(PEXESO_LEVELS);

/* Pod tři dvojice už to není hra. Když se do rozsahu nevejdou ani ty,
   spadneme na sčítání - to se vejde do každého povoleného rozsahu. */
const MIN_PAIRS = 3;

/* Násobilka, ve které se aplikace pohybuje všude jinde. */
const FACTOR_MIN = 2;
const FACTOR_MAX = 10;

/* Největší rozsah, který si jde v nastavení zvolit. Slouží jen ke kontrole,
   jestli má smysl radit "zvedni rozsah". */
const MAX_RANGE = 1000;

/* Množina výsledků, kterých se při daných operacích a rozsahu dá dosáhnout.
   Každá operace přispěje právě těmi výsledky, ke kterým k ní umí
   `buildExample()` složit příklad - díky tomu nemůže vypadnout výsledek,
   na který by se pak nenašlo zadání. */
function resultPool(ops, max) {
  const out = new Set();
  if (ops.includes('add')) for (let c = 2; c <= max; c++) out.add(c);
  if (ops.includes('sub')) for (let c = 1; c < max; c++) out.add(c);
  if (ops.includes('mul') || ops.includes('div')) {
    for (let x = FACTOR_MIN; x <= FACTOR_MAX; x++) {
      for (let y = FACTOR_MIN; y <= FACTOR_MAX; y++) {
        if (x * y > max) continue;
        if (ops.includes('mul')) out.add(x * y);
        if (ops.includes('div')) out.add(x); // a ÷ y = x, tedy x je výsledek
      }
    }
  }
  return [...out];
}

/* Jediné místo, které rozhoduje, jak bude plocha vypadat. Volá ho nastavení
   (kvůli hlášce) i generátor (kvůli stavbě), takže se text a skutečnost
   nemůžou rozejít. */
export function pexesoPlan(levelKey, ops = ['add'], max = 20) {
  const key = PEXESO_LEVELS[levelKey] ? levelKey : 'easy';
  const level = PEXESO_LEVELS[key];
  const wanted = Array.isArray(ops) && ops.length ? ops : ['add'];

  let useOps = wanted;
  let pool = resultPool(useOps, max);
  let note = null;

  if (pool.length < MIN_PAIRS) {
    useOps = ['add'];
    pool = resultPool(useOps, max);
    note = `Z vybraných operací se do ${max} skoro žádný příklad nevejde – tohle pexeso bude na sčítání. `
      + 'Zvedni si rozsah, nebo přidej sčítání.';
  }

  const pairs = Math.min(level.pairs, pool.length);
  if (!note && pairs < level.pairs) {
    /* Radu "zvedni rozsah" smíme dát jen tehdy, když opravdu pomůže. Samotné
       dělení dá v násobilce nejvýš devět různých výsledků (2 až 10) a větší
       rozsah s tím nehne - tam se musí přidat operace. */
    const pomuzeVetsiRozsah = resultPool(useOps, MAX_RANGE).length > pool.length;
    note = `${pomuzeVetsiRozsah ? `Do ${max} vyjde` : 'Z vybraných operací vyjde'} jen ${pairs} různých `
      + `výsledků a na ploše nesmí být dva stejné – místo ${level.pairs} dvojic jich tedy bude ${pairs}. `
      + (pomuzeVetsiRozsah ? 'Zvedni rozsah a plocha se zvětší.' : 'Přidej další operaci a plocha se zvětší.');
  }

  return { level: key, pairs, cols: level.cols, ops: useOps, pool, note };
}

/* Hláška do nastavení. `null` znamená, že je všechno v pořádku. */
export function pexesoRangeNote(levelKey, ops, max) {
  return pexesoPlan(levelKey, ops, max).note;
}

/* Ke známému výsledku dolosuje zadání. Operace se vybírá až tady, takže
   na jedné ploše můžou být příklady od všech zapnutých operací. */
function buildExample(c, ops, max) {
  const cand = [];

  if (ops.includes('add') && c >= 2) {
    const a = rnd(1, c - 1);
    cand.push({ op: 'add', a, b: c - a });
  }
  if (ops.includes('sub') && c < max) {
    const b = rnd(1, max - c);
    cand.push({ op: 'sub', a: c + b, b });
  }
  if (ops.includes('mul')) {
    const dels = [];
    for (let y = FACTOR_MIN; y <= FACTOR_MAX; y++) {
      const x = c / y;
      if (Number.isInteger(x) && x >= FACTOR_MIN && x <= FACTOR_MAX) dels.push(y);
    }
    if (dels.length) {
      const y = pick(dels);
      cand.push({ op: 'mul', a: c / y, b: y });
    }
  }
  if (ops.includes('div') && c >= FACTOR_MIN && c <= FACTOR_MAX) {
    const ys = [];
    for (let y = FACTOR_MIN; y <= FACTOR_MAX; y++) if (c * y <= max) ys.push(y);
    if (ys.length) {
      const y = pick(ys);
      cand.push({ op: 'div', a: c * y, b: y });
    }
  }

  // sem se to nedostane: každý výsledek v poolu má aspoň jedno zadání
  if (!cand.length) return { op: 'add', a: 1, b: Math.max(1, c - 1) };
  return pick(cand);
}

/* Zadání na kartičce je bez mezer (`7+5`). Na 320 px je kartička ~62 px
   a "100 ÷ 10" s mezerami by se na ni nevešlo. */
const cardText = (item) => `${item.a}${SYMBOL[item.op]}${item.b}`;

/* Zadání do vysvětlení už mezery má - tam je místa dost. */
const fullText = (item) => `${item.a} ${SYMBOL[item.op]} ${item.b} = ${item.c}`;

export function makePexeso(max, levelKey = 'easy', ops = ['add']) {
  const plan = pexesoPlan(levelKey, ops, max);

  const items = shuffle(plan.pool)
    .slice(0, plan.pairs)
    .map((c, i) => ({ pair: i, c, ...buildExample(c, plan.ops, max) }));

  const cards = shuffle(items.flatMap((item) => [
    { pair: item.pair, face: 'task', text: cardText(item) },
    { pair: item.pair, face: 'result', text: String(item.c) },
  ]));

  return {
    level: plan.level,
    pairs: items.length,
    cols: plan.cols,
    rows: Math.ceil(cards.length / plan.cols),
    items,
    cards,
    note: plan.note,
    key: items.map((it) => `${it.a}${it.op}${it.b}`).sort().join(','),
  };
}

/* Po dohrané ploše s velkým počtem chyb: co k čemu patřilo. */
export function pexesoExplain(ex) {
  return [
    'Takhle k sobě kartičky patřily:',
    ...ex.items.map((item) => fullText(item)),
  ];
}

export function pexesoText(ex, reveal) {
  return `pexeso ${ex.pairs} ${ex.pairs <= 4 ? 'dvojice' : 'dvojic'}${reveal ? ` (${ex.cols}×${ex.rows})` : ''}`;
}
