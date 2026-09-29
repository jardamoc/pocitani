import { pick, shuffle } from './random.js';

/* ============================================================
   Abeceda

   Dítě dostane hromádku kartiček se slovy a přetahuje je do očíslovaných
   okének tak, aby šla slova podle abecedy:

       ┌───┐ ┌───┐ ┌───┐ ┌───┐
       │ 1 │ │ 2 │ │ 3 │ │ 4 │     okénka po řádcích, 3 až 5 sloupců
       └───┘ └───┘ └───┘ └───┘     podle délky slov
         kočka   auto   myš        kartičky dole

   Tři věci, na kterých to stojí:

   1. POŘADÍ MUSÍ BÝT JEDNOZNAČNÉ. Řadí se vestavěným `Intl.Collator('cs')`,
      který zná CH za H i č, ř, š, ž jako samostatná písmena. Dvě slova, která
      se liší jen čárkou (`pas` × `pás`), by collator v základním porovnání
      považoval za stejná - taková plocha se zahodí.

   2. OBTÍŽNOST = ZÁLUDNOST SLOV, ne jejich počet. Lehká: každé slovo začíná
      jiným písmenem. Střední: některá začínají stejně a rozhoduje druhé
      písmeno. Těžká: k tomu pasti c/č, r/ř, s/š, z/ž a h/ch. Počet slov se
      volí zvlášť (`ABC_COUNTS`).

   3. PRAVIDLA PŘESOUVÁNÍ jsou čisté funkce nad stavem `{ slots, pool }`
      (bez DOM), aby šly otestovat:
      - puštění NA okénko = výměna, původní kartička spadne dolů,
      - puštění MEZI okénka = vsunutí, další slova se posunou o jedno dál
        až k nejbližšímu volnému okénku; když volné není, poslední spadne dolů.
   ============================================================ */

/* Běžná podstatná jména pro 1. až 3. třídu. Nejvýš 8 písmen, aby se kartička
   vešla i do tří sloupců na 320 px. Seskupená podle prvního písmene jen kvůli
   přehledu - generátor si skupiny počítá sám. */
export const WORDS = [
  'auto', 'ananas', 'anděl', 'adresa', 'aktovka',
  'banán', 'beruška', 'bota', 'brýle', 'buben', 'bláto', 'borůvka', 'bouřka',
  'cibule', 'citron', 'cukr', 'cesta', 'cihla', 'cirkus',
  'čaj', 'čepice', 'čokoláda', 'čert', 'čočka', 'čtverec',
  'dům', 'dort', 'deka', 'delfín', 'dudlík', 'dveře', 'dýně', 'dárek',
  'fazole', 'fotbal', 'flétna', 'fialka', 'fixa',
  'guma', 'garáž', 'gorila', 'guláš', 'glóbus',
  'hrad', 'hruška', 'houba', 'hora', 'hvězda', 'hasič', 'husa', 'hodiny', 'holub',
  'chleba', 'chata', 'chodník', 'chalupa', 'chůdy', 'chobot',
  'iglú', 'indián', 'inkoust',
  'jablko', 'jahoda', 'jezero', 'ježek', 'jelen', 'jogurt',
  'kočka', 'koza', 'kolo', 'klobouk', 'kniha', 'kráva', 'kytara', 'kuře', 'kaktus',
  'les', 'lev', 'liška', 'loď', 'lampa', 'lopata', 'lžíce', 'list',
  'myš', 'mrkev', 'med', 'míč', 'motýl', 'mléko', 'most', 'mapa',
  'nos', 'noha', 'nůžky', 'nebe', 'nanuk', 'noviny',
  'okno', 'ovce', 'oblak', 'orel', 'oběd', 'ořech',
  'pes', 'papoušek', 'pero', 'pavouk', 'prase', 'polštář', 'ponožka', 'pták',
  'ryba', 'ruka', 'rohlík', 'raketa', 'rak', 'robot',
  'řeka', 'řepa', 'řetěz', 'řízek', 'řidič',
  'sýr', 'slon', 'slunce', 'sova', 'strom', 'sníh', 'srdce', 'sešit',
  'šnek', 'škola', 'šála', 'šipka', 'švestka', 'šaty',
  'tužka', 'tráva', 'tygr', 'talíř', 'telefon', 'taška', 'tatínek',
  'ucho', 'ulice', 'uzel', 'ubrus', 'učitel',
  'vlak', 'voda', 'vrána', 'veverka', 'víla', 'váza', 'vajíčko', 'vlk',
  'zajíc', 'zebra', 'zámek', 'zmrzlina', 'zub', 'zelí', 'zvon',
  'žába', 'žirafa', 'želva', 'žížala', 'židle', 'žalud',
];

export const ABC_COUNTS = [9, 12, 16, 20, 25];

export const ABC_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'každé slovo začíná jiným písmenem' },
  medium: { label: 'Střední', emoji: '🟡', note: 'některá slova začínají stejně, rozhoduje druhé písmeno' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'pozor na c a č, s a š, r a ř, z a ž, h a ch' },
};

export const ABC_LEVEL_KEYS = Object.keys(ABC_LEVELS);

const collator = new Intl.Collator('cs');
const baseCollator = new Intl.Collator('cs', { sensitivity: 'base' });
export const abcCompare = (x, y) => collator.compare(x, y);

/* Čárka ani kroužek o pořadí písmen nerozhodují (á je v abecedě jako a),
   háček ano - č je samostatné písmeno za c. */
const PLAIN = { á: 'a', é: 'e', ě: 'e', í: 'i', ó: 'o', ú: 'u', ů: 'u', ý: 'y' };

/* Slovo rozdělené na písmena abecedy - CH je jedno písmeno. */
function letters(word) {
  const out = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] === 'c' && word[i + 1] === 'h') {
      out.push('ch');
      i += 1;
    } else out.push(PLAIN[word[i]] || word[i]);
  }
  return out;
}

const initialOf = (word) => letters(word)[0];
const secondOf = (word) => letters(word)[1] || '';

/* Dvojice písmen, které si děti pletou. V lehké a střední úrovni se na ploše
   nesmí sejít obě půlky jedné dvojice, v těžké jsou naopak schválně. */
const TRAPS = [['c', 'č'], ['r', 'ř'], ['s', 'š'], ['z', 'ž'], ['h', 'ch']];
const PARTNER = new Map(TRAPS.flatMap(([x, y]) => [[x, y], [y, x]]));

const BY_INITIAL = (() => {
  const map = new Map();
  for (const w of WORDS) {
    const k = initialOf(w);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(w);
  }
  return map;
})();

/* Kolik slov se dá položit bez opakování prvního písmene a bez pasti:
   ze dvojice c/č a spol. smí být jen jedna půlka. */
export const ABC_SAFE_LETTERS = [...BY_INITIAL.keys()].filter((k) => {
  const p = PARTNER.get(k);
  return !p || !BY_INITIAL.has(p) || TRAPS.some(([x]) => x === k);
}).length;

/* Kolik slov na ploše sdílí první písmeno s jiným. Lehká opakuje jen tehdy,
   když už písmena došla; střední aspoň čtvrtinu. */
function repeatsFor(levelKey, count) {
  const forced = Math.max(0, count - ABC_SAFE_LETTERS);
  return levelKey === 'easy' ? forced : Math.max(forced, Math.ceil(count / 4));
}

/* Hláška pod volbou počtu - lehká úroveň při velkém počtu slov nemůže
   dodržet "každé jiným písmenem" a má se to říct dopředu. */
export function abcCountNote(levelKey, count) {
  if (levelKey !== 'easy' || count <= ABC_SAFE_LETTERS) return '';
  return `Při ${count} slovech už se některá první písmena opakují – pak rozhoduje druhé písmeno.`;
}

function tryPick(levelKey, count) {
  const hard = levelKey === 'hard';
  const chosen = [];
  const used = new Set();
  const take = (w) => {
    chosen.push(w);
    used.add(initialOf(w));
  };

  // těžká: nejdřív pasti, obě půlky dvojice naráz
  if (hard) {
    const traps = shuffle(TRAPS.filter(([x, y]) => BY_INITIAL.has(x) && BY_INITIAL.has(y)))
      .slice(0, count >= 16 ? 3 : 2);
    for (const [x, y] of traps) {
      take(pick(BY_INITIAL.get(x)));
      take(pick(BY_INITIAL.get(y)));
    }
  }

  const repeats = repeatsFor(levelKey, count);
  const blocked = (k) => used.has(k) || (!hard && used.has(PARTNER.get(k)));
  for (const k of shuffle([...BY_INITIAL.keys()])) {
    if (chosen.length >= count - repeats) break;
    if (blocked(k)) continue;
    take(pick(BY_INITIAL.get(k)));
  }

  /* Opakovaná první písmena. Mimo těžkou úroveň musí rozhodnout druhé
     písmeno, takže se druhé písmeno ve skupině nesmí opakovat. */
  while (chosen.length < count) {
    const options = [];
    for (const k of used) {
      const group = chosen.filter((w) => initialOf(w) === k);
      const seconds = new Set(group.map(secondOf));
      for (const w of BY_INITIAL.get(k)) {
        if (chosen.includes(w)) continue;
        if (!hard && seconds.has(secondOf(w))) continue;
        options.push(w);
      }
    }
    if (!options.length) return null;
    chosen.push(pick(options));
  }
  return chosen;
}

/* Pořadí je jednoznačné, když žádná dvě slova nejsou v základním porovnání
   stejná. */
function unambiguous(words) {
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      if (baseCollator.compare(words[i], words[j]) === 0) return false;
    }
  }
  return true;
}

export function makeAbc(levelKey = 'easy', count = 9) {
  const level = ABC_LEVELS[levelKey] ? levelKey : 'easy';
  const n = ABC_COUNTS.includes(count) ? count : ABC_COUNTS[0];
  for (let attempt = 0; attempt < 200; attempt++) {
    const chosen = tryPick(level, n);
    if (!chosen || !unambiguous(chosen)) continue;
    const words = shuffle(chosen);
    const order = words.map((_, i) => i).sort((x, y) => abcCompare(words[x], words[y]));
    return {
      level,
      words,
      order,
      key: [...chosen].sort(abcCompare).join(','),
    };
  }
  throw new Error(`abc: nepodařilo se složit ${n} slov (${level})`);
}

/* ---------------- plocha ----------------
   Stav je `{ slots: [id | null, ...], pool: [id, ...] }`, `id` je index do
   `ex.words`. Funkce vrací nový stav a původní nemění. */

export const abcEmptyBoard = (ex) => ({
  slots: ex.words.map(() => null),
  pool: ex.words.map((_, i) => i),
});

function without(board, id) {
  return {
    slots: board.slots.map((s) => (s === id ? null : s)),
    pool: board.pool.filter((p) => p !== id),
  };
}

/* Puštění NA okénko: kartička ho obsadí, původní spadne dolů mezi slova. */
export function dropOnSlot(board, id, i) {
  const b = without(board, id);
  const old = b.slots[i];
  b.slots[i] = id;
  if (old !== null && old !== undefined) b.pool.push(old);
  return b;
}

/* Puštění MEZI okénka: kartička skončí na pozici `pos` a slova od ní se
   posunou o jedno dál, až k nejbližšímu volnému okénku. Když volné není,
   poslední slovo spadne dolů. Za posledním okénkem už žádné není, takže
   tam je vsunutí totéž co výměna na posledním. */
export function dropBetween(board, id, pos) {
  const n = board.slots.length;
  if (pos >= n) return dropOnSlot(board, id, n - 1);
  const b = without(board, id);
  if (b.slots[pos] === null) {
    b.slots[pos] = id;
    return b;
  }
  let free = b.slots.indexOf(null, pos + 1);
  if (free === -1) {
    b.pool.push(b.slots[n - 1]);
    free = n - 1;
  }
  for (let k = free; k > pos; k--) b.slots[k] = b.slots[k - 1];
  b.slots[pos] = id;
  return b;
}

export function dropToPool(board, id) {
  const b = without(board, id);
  b.pool.push(id);
  return b;
}

/* Okénka, ve kterých je jiné slovo, než tam patří. */
export const wrongSlots = (board, order) =>
  board.slots.map((s, i) => (s === order[i] ? -1 : i)).filter((i) => i >= 0);

export const abcFull = (board) => board.slots.every((s) => s !== null);

/* Po druhé chybě: jak mělo pořadí vypadat. */
export function abcExplain(ex) {
  return [
    'Takhle jdou slova podle abecedy:',
    ex.order.map((id, i) => `${i + 1}. ${ex.words[id]}`).join(', '),
  ];
}

export function abcText(ex, reveal) {
  const n = ex.words.length;
  return `abeceda, ${n} slov${reveal ? `: ${ex.order.map((id) => ex.words[id]).join(', ')}` : ''}`;
}
