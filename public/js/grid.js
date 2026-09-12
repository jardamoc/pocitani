import { rnd, pick, chance, shuffle, range } from './random.js';

/* ============================================================
   Mřížka

   Kolečka s čísly, kde platí rovnice vodorovně i svisle. Část koleček
   je prázdná a dítě je doplní tak, aby všechno vyšlo:

       5  +  ?  =  7            5  +  2  =  7
       +     +     +            +     +     +
       ?  +  ?  =  ?     →      3  +  4  =  7
       =     =     =            =     =     =
       8  +  ?  = 14            8  +  6  = 14

   Tři věci, na kterých to celé stojí:

   1. OPERÁTOR PATŘÍ MEZEŘE, ne rovnici. Znaménko mezi prvním a druhým
      sloupcem platí ve všech řádcích, znaménko mezi prvním a druhým
      řádkem ve všech sloupcích. Přesně tak vypadají tyhle hlavolamy.

   2. MŘÍŽKA SE STAVÍ, NE HÁDÁ. Vylosuje se blok volných čísel vlevo
      nahoře a poslední sloupec i řádek se dopočítají. Roh pak vyjde
      stejně oběma směry, protože obě cesty vedou na tutéž dvojnou sumu:
          po řádcích:   Σⱼ sⱼ · (Σᵢ tᵢ xᵢⱼ)  =  Σᵢ Σⱼ tᵢ sⱼ xᵢⱼ
          po sloupcích: Σᵢ tᵢ · (Σⱼ sⱼ xᵢⱼ)  =  totéž
      kde sⱼ, tᵢ ∈ {+1, −1} podle znamének v mezerách.

   3. RODINY SE NESMÍ MÍCHAT. Násobení se nedá prohodit se sčítáním -
      mřížka 5×5 s operátory "+ × +" v obou směrech (samé jedničky a jedna
      dvojka) dá v rohu 22 po řádku, ale 24 po sloupci. Mřížka je proto
      buď celá sčítací (+ −), nebo celá násobící (× ÷). V násobící rodině
      platí tentýž důkaz, jen v exponentech.

   Skrytá kolečka se vybírají tak, aby šla doplňovat jedno po druhém -
   v každém kroku musí existovat rovnice s právě jednou neznámou. Hlídá to
   `solveGrid`, jehož kroky zároveň slouží jako vysvětlení po chybě.
   ============================================================ */

export const GRID_LEVELS = {
  easy: {
    label: 'Lehká', emoji: '🟢', size: 3, hidden: [3, 4],
    families: ['add', 'mul'], note: 'mřížka 3×3',
  },
  medium: {
    label: 'Střední', emoji: '🟡', size: 4, hidden: [5, 6],
    families: ['add'], note: 'mřížka 4×4',
  },
  hard: {
    label: 'Těžká', emoji: '🔴', size: 5, hidden: [7, 9],
    families: ['add'], note: 'mřížka 5×5',
  },
};

export const GRID_LEVEL_KEYS = Object.keys(GRID_LEVELS);

/* Násobící mřížka má v rohu součin VŠECH volných buněk. U 3×3 jsou čtyři
   (3·4·2·4 = 96, pestré), u 4×4 devět - i samé dvojky dají 512, tedy mimo
   jakýkoli rozsah, který si jde zvolit. Proto jen nejmenší mřížka, a i tam
   až od rozsahu, ve kterém se dá s čím pracovat. */
const MUL_MIN_MAX = 16;

export function gridFamilies(levelKey, ops, max) {
  const level = GRID_LEVELS[levelKey] || GRID_LEVELS.easy;
  const out = [];
  if (ops.includes('add') || ops.includes('sub')) out.push('add');
  if ((ops.includes('mul') || ops.includes('div'))
      && level.families.includes('mul') && max >= MUL_MIN_MAX) out.push('mul');
  return out;
}

/* Co se v UI napíše, když si uživatel zapne operace, které do zvolené
   mřížky nejdou. `null` znamená, že je všechno v pořádku. */
export function gridOpsNote(levelKey, ops, max) {
  const level = GRID_LEVELS[levelKey] || GRID_LEVELS.easy;
  const wantsMul = ops.includes('mul') || ops.includes('div');
  const hasAdd = ops.includes('add') || ops.includes('sub');

  if (wantsMul && !level.families.includes('mul')) {
    return `Násobení a dělení se vejdou jen do mřížky 3×3 – ve větší je v rohu součin `
      + `všech čísel a vyšplhal by se do stovek tisíc. Tady budeme sčítat a odčítat.`;
  }
  if (wantsMul && max < MUL_MIN_MAX) {
    return `Na násobící mřížku je rozsah do ${max} malý – v rohu je součin všech čtyř čísel. `
      + `Zvedni ho aspoň na ${MUL_MIN_MAX}, nebo budeme sčítat.`;
  }
  if (!hasAdd && !wantsMul) return 'Vyber aspoň jednu operaci.';
  return null;
}

/* Doporučení k rozsahu. Strop na jedno číslo klesá s velikostí mřížky,
   protože roh je součtem všech volných buněk - viz `cellCeiling`. */
export function gridRangeNote(levelKey, max) {
  const size = (GRID_LEVELS[levelKey] || GRID_LEVELS.easy).size;
  const want = size === 5 ? 50 : size === 4 ? 20 : 0;
  if (!want || max >= want) return null;
  return `Do mřížky ${size}×${size} se při rozsahu do ${max} vejdou skoro samé jedničky – `
    + `pod strop musí i roh, ve kterém se všechno sečte. Doporučuju zvednout rozsah na ${want}.`;
}

/* ---------------- práce s mřížkou ---------------- */

const ADD_OPS = { add: '+', sub: '−' };
const MUL_OPS = { mul: '×', div: '÷' };

const isMinus = (op) => op === '−' || op === '÷';

/* Poskládá řádek zleva doprava. Vrací `null`, jakmile mezivýsledek spadne
   pod nulu nebo dělení nevyjde beze zbytku - takové číslo dítě nezná. */
function fold(values, ops) {
  let acc = values[0];
  for (let i = 1; i < values.length; i++) {
    const op = ops[i - 1];
    if (op === '+') acc += values[i];
    else if (op === '−') acc -= values[i];
    else if (op === '×') acc *= values[i];
    else {
      if (values[i] === 0 || acc % values[i] !== 0) return null;
      acc /= values[i];
    }
    if (acc < 0) return null;
  }
  return acc;
}

/* Kolik volných buněk přispívá do rohu kladně. Čím víc jich je, tím menší
   musí být jednotlivá čísla, aby se roh vešel do rozsahu. */
function cellCeiling(colOps, rowOps, max) {
  let plus = 0;
  for (let i = 0; i <= rowOps.length; i++) {
    for (let j = 0; j <= colOps.length; j++) {
      if (gapSign(rowOps, i) * gapSign(colOps, j) > 0) plus += 1;
    }
  }
  return Math.max(1, Math.floor(max / Math.max(1, plus)));
}

const gapSign = (ops, i) => (i === 0 ? 1 : isMinus(ops[i - 1]) ? -1 : 1);

/* Volný blok se nelosuje celý naslepo. Odčítané buňky drží čísla dole,
   takže u mřížky se samými minusy by se náhodný los skoro nikdy netrefil
   (`a − b − c − d` musí zůstat nezáporné, a to i po sloupcích).

   Postup: vnitřek vylosujeme malý, a první sloupec s prvním řádkem pak
   dopočítáme tak, aby každý řádek i sloupec vyšel nezáporně. Levý horní roh
   musí pokrýt obojí, proto se z obou požadavků bere ten větší. */
function buildFreeBlock(n, colOps, rowOps, hi, lo) {
  /* `lo` je nejmenší losovaná hodnota. Normálně 1 - spousta nul v zadání
     vypadá jako chyba a dítě z nich nic nespočítá. Do těsného rozsahu se
     ale velká mřížka jinak nevejde (5×5 má 16 volných buněk, takže roh
     nemůže být menší než 16), a tam nuly povolíme. */
  const slack = () => rnd(lo, Math.max(lo, Math.floor(hi / 2)));
  const small = Math.max(lo, Math.floor(hi / 2));
  const x = range(0, n - 1).map(() => new Array(n).fill(0));

  for (let i = 1; i < n; i++) {
    for (let j = 1; j < n; j++) x[i][j] = rnd(lo, small);
  }

  // kolik musí vedoucí buňka pokrýt, aby výsledek nespadl pod nulu
  const needRow = (i, from) => {
    let need = 0;
    for (let j = from; j < n; j++) need -= gapSign(colOps, j) * x[i][j];
    return Math.max(0, need);
  };
  const needCol = (j, from) => {
    let need = 0;
    for (let i = from; i < n; i++) need -= gapSign(rowOps, i) * x[i][j];
    return Math.max(0, need);
  };

  for (let i = 1; i < n; i++) x[i][0] = needRow(i, 1) + slack();
  for (let j = 1; j < n; j++) x[0][j] = needCol(j, 1) + slack();
  x[0][0] = Math.max(needRow(0, 1), needCol(0, 1)) + slack();

  return x;
}

/* Dopočítá poslední sloupec, poslední řádek a roh. Roh ověřuje oběma
   směry - když se neshodne, je chyba v kódu, ne v losu. */
function completeGrid(free, colOps, rowOps) {
  const n = free.length;
  const size = n + 1;
  const cells = free.map((row) => row.slice());

  for (let i = 0; i < n; i++) {
    const total = fold(cells[i], colOps);
    if (total === null) return null;
    cells[i].push(total);
  }

  const last = [];
  for (let j = 0; j < size; j++) {
    const total = fold(cells.map((row) => row[j]), rowOps);
    if (total === null) return null;
    last.push(total);
  }
  cells.push(last);

  const byRow = fold(last.slice(0, size - 1), colOps);
  if (byRow === null || byRow !== last[size - 1]) return null;
  return cells;
}

/* Každé zobrazené číslo musí být celé, v rozsahu a nezáporné; u násobící
   rodiny navíc aspoň jedna, protože nulou se nedá dělit. */
function validGrid(cells, max, family) {
  const floor = family === 'mul' ? 1 : 0;
  for (const row of cells) {
    for (const v of row) {
      if (!Number.isInteger(v) || v < floor || v > max) return false;
    }
  }
  return true;
}

/* ---------------- řešitel ---------------- */

const keyOf = (r, c) => `${r},${c}`;

/* Rovnice mřížky: každý zobrazený řádek a každý zobrazený sloupec. */
function equations(size, colOps, rowOps) {
  const out = [];
  for (let r = 0; r < size; r++) {
    out.push({ axis: 'row', index: r, ops: colOps, at: (i) => ({ r, c: i }) });
  }
  for (let c = 0; c < size; c++) {
    out.push({ axis: 'col', index: c, ops: rowOps, at: (i) => ({ r: i, c }) });
  }
  return out;
}

/* Dopočítá jedinou neznámou v rovnici. `pos` je její pozice; poslední
   pozice je výsledkové kolečko, jinak se hodnota přenáší přes rovnítko. */
function solveFor(known, eq, size, pos) {
  const at = (i) => known[keyOf(eq.at(i).r, eq.at(i).c)];
  const result = at(size - 1);

  if (pos === size - 1) {
    return fold(range(0, size - 2).map(at), eq.ops);
  }

  /* Hledané kolečko je vlevo. Nejdřív přičteme všechno, co se přesouvá
     s plusem, a teprve pak odečítáme - tím maximum padne dřív a žádný
     mezivýsledek nespadne pod nulu. U násobící rodiny totéž se součinem. */
  const mul = eq.ops.some((o) => o === '×' || o === '÷');
  const sign = (i) => (i === 0 ? 1 : isMinus(eq.ops[i - 1]) ? -1 : 1);
  const want = sign(pos);

  const plus = [];
  const minus = [];
  for (let i = 0; i < size - 1; i++) {
    if (i === pos) continue;
    (sign(i) === want ? minus : plus).push(at(i));
  }

  let acc = result;
  for (const v of plus) {
    if (mul) acc *= v; else acc += v;
  }
  for (const v of minus) {
    if (mul) {
      if (v === 0 || acc % v !== 0) return null;
      acc /= v;
    } else acc -= v;
    if (acc < 0) return null;
  }
  return want < 0 ? null : acc; // záporně orientované kolečko neřešíme, nepotřebujeme
}

/* Jediné pravidlo: najdi rovnici, kde zbývá právě jedna neznámá, a dopočítej
   ji. Schválně tu není nic dalšího - co neprojde tímhle, je pro dítě moc. */
export function solveGrid(cells, hidden, colOps, rowOps) {
  const size = cells.length;
  const known = {};
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) known[keyOf(r, c)] = cells[r][c];
  }
  const unknown = new Set(hidden.map(({ r, c }) => keyOf(r, c)));
  for (const k of unknown) known[k] = null;

  const eqs = equations(size, colOps, rowOps);
  const steps = [];

  while (unknown.size) {
    let step = null;

    for (const eq of eqs) {
      const open = [];
      for (let i = 0; i < size; i++) {
        const { r, c } = eq.at(i);
        if (known[keyOf(r, c)] === null) open.push(i);
      }
      if (open.length !== 1) continue;

      const pos = open[0];
      const value = solveFor(known, eq, size, pos);
      if (value === null || !Number.isInteger(value) || value < 0) continue;

      const { r, c } = eq.at(pos);
      if (value !== cells[r][c]) continue; // pojistka proti chybě v přenášení
      step = { axis: eq.axis, index: eq.index, r, c, pos, value };
      break;
    }

    if (!step) return null;
    known[keyOf(step.r, step.c)] = step.value;
    unknown.delete(keyOf(step.r, step.c));
    steps.push(step);
  }

  return steps;
}

/* ---------------- skládání hádanky ---------------- */

function pickOps(family, ops, size, wantMinus) {
  const table = family === 'mul' ? MUL_OPS : ADD_OPS;
  let pool = Object.keys(table).filter((k) => ops.includes(k)).map((k) => table[k]);
  /* Když si uživatel zapnul jen násobení a zvolil velkou mřížku, spadneme
     na sčítací rodinu - a ta by tu bez tohohle neměla jediné znaménko. */
  if (!pool.length) pool = [family === 'mul' ? '×' : '+'];
  const gaps = size - 2;
  const out = range(1, gaps).map(() => pick(pool));
  /* U větší mřížky se hodí aspoň jeden minus - uvolní strop na čísla
     (roh pak není součtem úplně všeho) a mřížka je zajímavější. */
  const minus = pool.find(isMinus);
  if (wantMinus && minus && !out.some(isMinus)) out[rnd(0, gaps - 1)] = minus;
  return out;
}

/* Násobící mřížka: postavíme kanonickou samých ×, dělení získáme prohozením
   prvního a posledního sloupce (řádku). Svislé vztahy tím zůstanou platit
   a všechna dělení vyjdou beze zbytku z definice - žádné testování
   dělitelnosti není potřeba. */
function flipForDivision(cells, colOps, rowOps, ops) {
  if (!ops.includes('div')) return { cells, colOps, rowOps };
  const size = cells.length;
  let out = cells.map((row) => row.slice());
  let cOps = colOps.slice();
  let rOps = rowOps.slice();

  if (chance(0.65) || !ops.includes('mul')) {
    out = out.map((row) => { const r = row.slice(); [r[0], r[size - 1]] = [r[size - 1], r[0]]; return r; });
    cOps = cOps.map(() => '÷');
  }
  if (chance(0.5) || !ops.includes('mul')) {
    [out[0], out[size - 1]] = [out[size - 1], out[0]];
    rOps = rOps.map(() => '÷');
  }
  return { cells: out, colOps: cOps, rowOps: rOps };
}

/* `scale` roztahuje strop na jednotlivá čísla. `makeGrid` s ním jde odshora
   dolů, takže vyhraje první mřížka, která se do rozsahu vejde - a ta pak
   rozsah opravdu využije. Bez toho by "do 100" u velké mřížky dávalo
   jednociferná čísla, protože odhad stropu musí počítat s nejhorším. */
function buildAddGrid(size, ops, max, scale, lo) {
  const colOps = pickOps('add', ops, size, size >= 4);
  const rowOps = pickOps('add', ops, size, size >= 4);
  if (!colOps || !rowOps) return null;

  const n = size - 1;
  const hi = Math.max(1, Math.round(cellCeiling(colOps, rowOps, max) * scale));
  const cells = completeGrid(buildFreeBlock(n, colOps, rowOps, hi, lo), colOps, rowOps);
  if (!cells || !validGrid(cells, max, 'add')) return null;
  return { cells, colOps, rowOps, family: 'add' };
}

function buildMulGrid(ops, max) {
  const hi = Math.max(2, Math.floor(Math.pow(max, 0.25)) + 2);
  const free = [[rnd(1, hi), rnd(1, hi)], [rnd(1, hi), rnd(1, hi)]];
  if (free.flat().filter((v) => v > 1).length < 2) return null;

  const base = completeGrid(free, ['×'], ['×']);
  if (!base || !validGrid(base, max, 'mul')) return null;

  const flipped = flipForDivision(base, ['×'], ['×'], ops);
  const check = completeGrid(flipped.cells.slice(0, 2).map((r) => r.slice(0, 2)), flipped.colOps, flipped.rowOps);
  if (!check || !validGrid(check, max, 'mul')) return null;
  return { cells: check, colOps: flipped.colOps, rowOps: flipped.rowOps, family: 'mul' };
}

/* Skrytá kolečka přidáváme po jednom a po každém ověříme řešitelem.
   Je to bezpečné: ubráním známé hodnoty nemůže žádná rovnice získat druhou
   neznámou, takže každá podmnožina řešitelné sady je taky řešitelná. */
function hideCells(cells, colOps, rowOps, target) {
  const size = cells.length;
  const spots = shuffle(range(0, size - 1).flatMap((r) => range(0, size - 1).map((c) => ({ r, c }))));
  const hidden = [];
  let steps = [];

  for (const spot of spots) {
    if (hidden.length >= target) break;
    const next = [...hidden, spot];
    const solved = solveGrid(cells, next, colOps, rowOps);
    if (!solved) continue;
    hidden.push(spot);
    steps = solved;
  }

  if (hidden.length < 2) return null;
  // pořadí skrytých srovnáme podle toho, jak je řešitel odvodil
  return { hidden: steps.map(({ r, c }) => ({ r, c })), steps };
}

export function makeGrid(max, levelKey = 'easy', ops = ['add']) {
  const level = GRID_LEVELS[levelKey] ? levelKey : 'easy';
  const spec = GRID_LEVELS[level];
  const families = gridFamilies(level, ops, max);
  if (!families.length) families.push('add');

  /* Zkoušíme od nejštědřejšího stropu dolů, ať mřížka využije zvolený rozsah
     a nevyjdou z ní jednociferná čísla, když si uživatel zvolil "do 100". */
  const SCALES = [2.4, 1.8, 1.4, 1.1, 0.9, 0.7, 0.5];

  for (let attempt = 0; attempt < 900; attempt++) {
    const family = pick(families);
    const step = Math.floor(attempt / 60);
    const scale = SCALES[Math.min(SCALES.length - 1, step)];
    const lo = step < SCALES.length ? 1 : 0;  // nuly až když jinak nejde
    const built = family === 'mul' ? buildMulGrid(ops, max) : buildAddGrid(spec.size, ops, max, scale, lo);
    if (!built) continue;

    const target = rnd(spec.hidden[0], spec.hidden[1]);
    const hole = hideCells(built.cells, built.colOps, built.rowOps, target);
    if (!hole) continue;

    return {
      size: built.cells.length,
      family: built.family,
      colOps: built.colOps,
      rowOps: built.rowOps,
      cells: built.cells,
      hidden: hole.hidden,
      steps: hole.steps,
      level,
      /* Do otisku patří i to, která kolečka jsou skrytá - při těsném rozsahu
         vyjde čísel jen pár, ale rozmístění děr dělá jinou úlohu. */
      key: `${built.family}|${built.colOps.join('')}|${built.rowOps.join('')}`
        + `|${built.cells.flat().join(',')}|${hole.hidden.map(({ r, c }) => `${r}${c}`).join('')}`,
    };
  }

  return fallbackGrid(level);
}

/* Záchranná mřížka pro případ, že by losování v daném rozsahu nic nenašlo
   (hrozí u hodně těsného rozsahu). Vejde se i "do 5". */
function fallbackGrid(level) {
  const cells = [[1, 1, 2], [1, 1, 2], [2, 2, 4]];
  const colOps = ['+'];
  const rowOps = ['+'];
  const hidden = [{ r: 0, c: 2 }, { r: 2, c: 0 }, { r: 2, c: 2 }];
  const steps = solveGrid(cells, hidden, colOps, rowOps);
  return {
    size: 3, family: 'add', colOps, rowOps, cells,
    hidden: steps.map(({ r, c }) => ({ r, c })), steps, level,
    key: 'fallback',
  };
}

/* ---------------- text ---------------- */

const ORDINAL = ['prvním', 'druhém', 'třetím', 'čtvrtém', 'pátém'];

/* Rovnice jako text, s dosazenými hodnotami a hledaným kolečkem jako "?". */
function equationText(grid, step, reveal) {
  const { cells, size } = { cells: grid.cells, size: grid.size };
  const ops = step.axis === 'row' ? grid.colOps : grid.rowOps;
  const at = (i) => (step.axis === 'row' ? cells[step.index][i] : cells[i][step.index]);
  const parts = [];
  for (let i = 0; i < size; i++) {
    const isTarget = (step.axis === 'row' ? i === step.c : i === step.r);
    parts.push(isTarget && !reveal ? '?' : String(at(i)));
    if (i < size - 2) parts.push(ops[i]);
    else if (i === size - 2) parts.push('=');
  }
  return parts.join(' ');
}

export function gridExplain(ex) {
  const out = ex.steps.map((step) => {
    const kde = step.axis === 'row'
      ? `V ${ORDINAL[step.index]} řádku`
      : `V ${ORDINAL[step.index]} sloupci`;
    return `${kde} zbývá jediné prázdné kolečko: ${equationText(ex, step, false)} `
      + `→ doplň **${step.value}**.`;
  });
  out.push('Až je mřížka plná, vyjde každý součet doprava i dolů stejně – to je na ní to hezké.');
  return out;
}

export function gridText(ex, reveal) {
  const what = ex.family === 'mul' ? 'násobící mřížka' : 'mřížka';
  return `${what} ${ex.size}×${ex.size}${reveal ? ` (${ex.hidden.length} koleček)` : ''}`;
}
