import { rnd, pick, shuffle } from './random.js';

/* ============================================================
   Hudební nauka

   Pět úloh (vybírá se v nastavení, když je jich zapnutých víc, kolo se
   mezi ně rozdělí rovnoměrně):

   - `znak`   - Co je to? Osnova, klíče, noty a pomlky. Buď je vidět
                obrázek a vybírá se název, nebo naopak.
   - `nazev`  - Poznej notu: nota na osnově, tlačítka c d e f g a h.
   - `umisti` - Umísti notu: klepnutím na linku nebo mezeru. Správně je
                každé místo s tím písmenem - oktávy se netrénují.
   - `vyska`  - Která nota je vyšší (nižší)?
   - `takt`   - Kolik dob trvá takt / Doplň takt pomlkou / Najdi takt,
                který nesedí.

   Klavír je samostatná hra (`config.mode = 'klavir'`), ale úlohy má taky
   odsud - `makeKlavirRound()` dole, `ex.task = 'klavir'`.

   Obtížnost = osnova a takt: lehká houslová a 4/4, střední basová a 3/4,
   těžká obě osnovy najednou a oba takty.

   Výška noty je celé číslo `d` - „kolikátý tón od začátku“, c1 = 28
   (c d e f g a h = 0 až 6, jedna oktáva = 7). Na osnově se z ní počítá
   krok `step` od spodní linky: 0 spodní linka, 1 první mezera, 2 druhá
   linka … 8 horní linka. Žádné zlomky, nikde.

   DESETINNÁ ČÍSLA NE: osminové noty jsou vždycky ve dvojici („dvě osminové
   = jedna doba“), osminová pomlka se v taktech nepoužívá, jen v úloze `znak`.
   ============================================================ */

export const NOTE_LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'h'];
export const letterOf = (d) => NOTE_LETTERS[d % 7];

/* `bottom` je tón na spodní lince, `low`/`high` rozsah, který se zkouší.
   Houslová: c1 (pomocná linka dole) až g2. Basová: velké G až c1
   (pomocná linka nahoře). Kotva je nota, kterou klíč „ukazuje“. */
export const CLEFS = {
  treble: {
    label: 'houslový klíč', bottom: 30, low: 28, high: 39,
    anchor: 32, anchorText: 'Houslový klíč se točí kolem **druhé linky** – tam bydlí nota **g**.',
  },
  bass: {
    label: 'basový klíč', bottom: 18, low: 18, high: 28,
    anchor: 24, anchorText: 'Basový klíč má dvě tečky kolem **čtvrté linky** – tam bydlí nota **f**.',
  },
};
export const stepOf = (clef, d) => d - CLEFS[clef].bottom;

export const HUDBA_TASKS = {
  znak: { label: 'Co je to?', emoji: '🎼' },
  nazev: { label: 'Poznej notu', emoji: '🔤' },
  umisti: { label: 'Umísti notu', emoji: '👆' },
  vyska: { label: 'Vyšší a nižší', emoji: '↕️' },
  takt: { label: 'Takt', emoji: '🥁' },
};
export const HUDBA_TASK_KEYS = Object.keys(HUDBA_TASKS);

export const HUDBA_COUNTS = [10, 20, 30];

export const HUDBA_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'houslová osnova a takt 4/4' },
  medium: { label: 'Střední', emoji: '🟡', note: 'basová osnova a takt 3/4' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'obě osnovy najednou a takty 4/4 i 3/4' },
};
export const HUDBA_LEVEL_KEYS = Object.keys(HUDBA_LEVELS);

/* Značky z úlohy „Co je to?“. `n:` nota, `r:` pomlka. */
export const SYMBOLS = {
  staff: 'notová osnova',
  treble: 'houslový klíč',
  bass: 'basový klíč',
  'n:whole': 'celá nota',
  'n:half': 'půlová nota',
  'n:dhalf': 'tečkovaná půlová nota',
  'n:quarter': 'čtvrťová nota',
  'n:eighth': 'osminová nota',
  'n:sixteenth': 'šestnáctinová nota',
  'r:whole': 'celá pomlka',
  'r:half': 'půlová pomlka',
  'r:quarter': 'čtvrťová pomlka',
  'r:eighth': 'osminová pomlka',
  'r:sixteenth': 'šestnáctinová pomlka',
};

const SYMBOL_POOL = {
  easy: ['staff', 'treble', 'n:whole', 'n:half', 'n:quarter', 'n:eighth', 'r:whole', 'r:half', 'r:quarter'],
  medium: Object.keys(SYMBOLS).filter((s) => s !== 'n:dhalf'),
  // tečkovaná půlová patří k taktu 3/4 a ten je naplno až na těžké
  hard: Object.keys(SYMBOLS),
};

/* Se kterou značkou se ta hledaná nejčastěji plete - od nejčastější.
   Osnova mezi špatnými možnostmi u ostatních není, protože se noty
   a pomlky kreslí na kousku osnovy a „notová osnova“ by byla taky pravda. */
const CONFUSE = {
  staff: ['treble', 'bass'],
  treble: ['bass', 'n:eighth', 'r:quarter'],
  bass: ['treble', 'r:quarter', 'n:eighth'],
  'n:whole': ['r:whole', 'n:half', 'n:quarter'],
  'n:half': ['n:dhalf', 'n:whole', 'r:half', 'n:quarter'],
  'n:dhalf': ['n:half', 'n:whole', 'n:quarter'],
  'n:quarter': ['n:eighth', 'n:half', 'r:quarter'],
  'n:eighth': ['n:sixteenth', 'n:quarter', 'r:eighth', 'n:half'],
  'n:sixteenth': ['n:eighth', 'r:sixteenth', 'n:quarter'],
  'r:whole': ['r:half', 'n:whole', 'r:quarter'],
  'r:half': ['r:whole', 'n:half', 'r:quarter'],
  'r:quarter': ['r:eighth', 'n:quarter', 'r:half'],
  'r:eighth': ['r:sixteenth', 'r:quarter', 'n:eighth', 'r:half'],
  'r:sixteenth': ['r:eighth', 'n:sixteenth', 'r:quarter'],
};

const isClef = (s) => s === 'treble' || s === 'bass';
const family = (s) => (s.startsWith('n:') ? 'n' : s.startsWith('r:') ? 'r' : s);

function symbolTag(target, other) {
  if (isClef(target) && isClef(other)) return 'hudbaKlic';
  if (family(target) === family(other) && (family(target) === 'n' || family(target) === 'r')) return 'hudbaHodnota';
  return 'hudbaZnak';
}

/* Proč je značka taková, jaká je - do vysvětlení po chybě. */
const SYMBOL_RULE = {
  staff: 'Notová osnova je **pět linek** nad sebou. Linky se počítají **zdola**.',
  treble: 'Houslový klíč se točí kolem **druhé linky** jako šnek a nahoře přečuhuje přes osnovu.',
  bass: 'Basový klíč vypadá jako obrácené **C** a má vedle sebe **dvě tečky** kolem čtvrté linky.',
  'n:whole': 'Celá nota je **prázdné kolečko bez nožičky**. Trvá **4 doby**.',
  'n:half': 'Půlová nota je **prázdné kolečko s nožičkou**. Trvá **2 doby**.',
  'n:dhalf': 'Tečkovaná půlová nota je půlová nota s **tečkou** vedle. Tečka přidá ještě půlku délky: 2 + 1 = **3 doby**.',
  'n:quarter': 'Čtvrťová nota je **plné kolečko s nožičkou**. Trvá **1 dobu**.',
  'n:eighth': 'Osminová nota je plné kolečko s nožičkou a **praporkem**. Dvě osminové trvají **1 dobu**.',
  'r:whole': 'Celá pomlka je obdélníček, který **visí pod čtvrtou linkou**. Trvá **4 doby**.',
  'r:half': 'Půlová pomlka je obdélníček, který **sedí na prostřední lince**. Trvá **2 doby**.',
  'r:quarter': 'Čtvrťová pomlka je **klikatá čárka** jako blesk. Trvá **1 dobu**.',
  'n:sixteenth': 'Šestnáctinová nota je plné kolečko s nožičkou a **dvěma praporky**. Čtyři šestnáctinové trvají **1 dobu**.',
  'r:eighth': 'Osminová pomlka je **tečka s šikmou čárkou** jako číslice 7. Dvě osminové pomlky trvají **1 dobu**.',
  'r:sixteenth': 'Šestnáctinová pomlka má **dvě tečky** na šikmé čárce. Čtyři šestnáctinové pomlky trvají **1 dobu**.',
};

/* Tagy chyb - popisky jsou v `TAGS` v generator.js. */
export const HUDBA_TAGS = {
  hudbaSoused: 'záměna se sousední notou',
  hudbaKlic: 'čtení v druhém klíči',
  hudbaNazev: 'jiná nota',
  hudbaHodnota: 'záměna délky noty nebo pomlky',
  hudbaZnak: 'záměna noty, pomlky nebo klíče',
  hudbaVyska: 'záměna vyšší a nižší noty',
  hudbaDoby: 'špatně spočítané doby',
  hudbaPosuvka: 'přehlédnutý křížek nebo béčko',
  hudbaSmer: 'záměna křížku a béčka',
  hudbaSluch: 'špatně rozpoznaný tón',
};

/* ---------------- místa na osnově ---------------- */

const ORD = ['první', 'druhé', 'třetí', 'čtvrté', 'páté'];

/* Slovní popis místa na osnově. Linky i mezery se počítají zdola. */
export function placeText(step) {
  if (step <= -2) return 'na pomocné lince pod osnovou';
  if (step === -1) return 'pod první linkou';
  if (step === 9) return 'nad pátou linkou';
  if (step >= 10) return 'na pomocné lince nad osnovou';
  if (step % 2 === 0) return `na ${ORD[step / 2]} lince`;
  const n = (step + 1) / 2;
  return `${n === 1 ? 'v' : 've'} ${ORD[n - 1]} mezeře`;
}

/* Cesta od kotvy klíče k notě po krocích: „g → a → h“. */
function walk(from, to) {
  const out = [];
  const dir = to >= from ? 1 : -1;
  for (let d = from; d !== to + dir; d += dir) out.push(letterOf(d));
  return out.join(' → ');
}

function noteSteps(clef, d) {
  const c = CLEFS[clef];
  const steps = [c.anchorText];
  if (d === c.anchor) {
    steps.push(`Tahle nota sedí přesně tam – je to **${letterOf(d)}**.`);
  } else {
    steps.push(`Tahle nota je ${placeText(stepOf(clef, d))}. Počítej od klíče po krocích – linka, mezera, linka…`);
    steps.push(`${d > c.anchor ? 'Nahoru' : 'Dolů'}: ${walk(c.anchor, d)}. Je to **${letterOf(d)}**.`);
  }
  return steps;
}

/* Tag špatně pojmenované noty: o krok vedle, přečtená v druhém klíči
   (basová o 12 kroků posunutá oproti houslové), nebo jiná. */
function nameTag(clef, d, letter) {
  if (letter === letterOf(d + 1) || letter === letterOf(d - 1)) return 'hudbaSoused';
  const other = clef === 'bass' ? d + 12 : d - 12;
  if (letter === letterOf(other)) return 'hudbaKlic';
  return 'hudbaNazev';
}

const clefFor = (level) => (level === 'easy' ? 'treble' : level === 'medium' ? 'bass' : pick(['treble', 'bass']));
const stavesFor = (level, clef) => (level === 'hard' ? ['treble', 'bass'] : [clef]);

/* ---------------- úlohy ---------------- */

function znakExercise(level) {
  const pool = SYMBOL_POOL[level];
  const target = pick(pool);
  const n = level === 'easy' ? 3 : 4;
  let others = CONFUSE[target].filter((s) => pool.includes(s));
  if (others.length < n - 1) {
    others = others.concat(shuffle(pool.filter((s) => s !== target && s !== 'staff' && !others.includes(s))));
  }
  others = others.slice(0, n - 1);
  const form = target === 'staff' ? 'show' : pick(['show', 'find']);
  return {
    level, task: 'znak', form, sym: target,
    text: SYMBOLS[target],
    answer: SYMBOLS[target],
    options: shuffle([target, ...others]).map((s) => ({
      text: SYMBOLS[s], key: s, sym: s, ok: s === target, tag: s === target ? null : symbolTag(target, s),
    })),
    key: `znak|${form}|${target}`,
  };
}

function nazevExercise(level) {
  const clef = clefFor(level);
  const { low, high } = CLEFS[clef];
  const d = rnd(low, high);
  return {
    level, task: 'nazev', clef, d, staves: stavesFor(level, clef),
    text: `${CLEFS[clef].label}, nota ${placeText(stepOf(clef, d))}`,
    answer: letterOf(d),
    options: NOTE_LETTERS.map((l) => ({
      text: l, key: l, ok: l === letterOf(d), tag: l === letterOf(d) ? null : nameTag(clef, d, l),
    })),
    key: `nazev|${clef}|${d}`,
  };
}

/* Místa, kam jde notu položit: všechny kroky z rozsahu klíče, na těžké
   úrovni na obou osnovách. Správné je každé místo s hledaným písmenem. */
function umistiExercise(level) {
  const clef = clefFor(level);
  const staves = stavesFor(level, clef);
  const letter = letterOf(rnd(CLEFS[clef].low, CLEFS[clef].high));
  const options = [];
  for (const staff of staves) {
    const { low, high } = CLEFS[staff];
    for (let d = low; d <= high; d++) {
      const step = stepOf(staff, d);
      const l = letterOf(d);
      const where = placeText(step) + (staves.length > 1 ? (staff === 'treble' ? ' (houslová osnova)' : ' (basová osnova)') : '');
      options.push({
        text: `${l} – ${where}`, key: `${staff}:${step}`, staff, step, d,
        ok: l === letter, tag: l === letter ? null : nameTag(staff, d, letter) === 'hudbaSoused' ? 'hudbaSoused' : 'hudbaNazev',
      });
    }
  }
  const right = options.filter((o) => o.ok);
  return {
    level, task: 'umisti', clef, staves, letter, retry: true,
    text: `Umísti notu ${letter}`,
    answer: right.map((o) => o.text).join(' nebo '),
    options,
    key: `umisti|${staves.join('+')}|${letter}`,
  };
}

function vyskaExercise(level) {
  const clef = clefFor(level);
  const { low, high } = CLEFS[clef];
  const gap = level === 'easy' ? 3 : level === 'medium' ? 2 : 1;
  let a;
  let b;
  do {
    a = rnd(low, high);
    b = rnd(low, high);
  } while (Math.abs(a - b) < gap);
  const ask = pick(['higher', 'lower']);
  const hi = a > b ? 0 : 1;
  const okIdx = ask === 'higher' ? hi : 1 - hi;
  return {
    level, task: 'vyska', clef, ask, notes: [a, b],
    text: ask === 'higher' ? 'Která nota je vyšší?' : 'Která nota je nižší?',
    answer: `${okIdx + 1}. nota`,
    options: [0, 1].map((i) => ({ text: `${i + 1}. nota`, key: String(i), ok: i === okIdx, tag: i === okIdx ? null : 'hudbaVyska' })),
    key: `vyska|${clef}|${a}|${b}|${ask}`,
  };
}

/* ---------------- klavír ----------------
   Nota na osnově (případně s křížkem nebo béčkem) a pod ní klávesnice
   s jednou oktávou c až c. Oktáva se netrénuje, takže u noty c jsou
   správně obě krajní bílé klávesy.

   Posuvky podle obtížnosti: lehká jen křížky, střední a těžká křížky
   i béčka. Zápisy, které na klávesnici padnou na bílou klávesu (eis,
   his, ces, fes), se nepoužívají - na 1. až 3. třídu jsou moc záludné. */

/* Výška tónu v rámci oktávy (0 až 11) pro c d e f g a h. */
const LETTER_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, h: 11 };

/* České názvy: křížek přidá -is, béčko -es (e → es, a → as, h → b). */
const SHARP_NAME = { c: 'cis', d: 'dis', f: 'fis', g: 'gis', a: 'ais' };
const FLAT_NAME = { d: 'des', e: 'es', g: 'ges', a: 'as', h: 'b' };

export function noteName(letter, acc) {
  if (acc === 1) return SHARP_NAME[letter];
  if (acc === -1) return FLAT_NAME[letter];
  return letter;
}

/* Klávesy jedné oktávy: osm bílých (c až c) a pět černých. `after` je
   index bílé klávesy, za kterou černá leží. */
export const PIANO_KEYS = [
  ...['c', 'd', 'e', 'f', 'g', 'a', 'h', 'c'].map((l, i) => ({ white: true, pos: i, pc: LETTER_PC[l], text: l, midi: 60 + (i === 7 ? 12 : LETTER_PC[l]) })),
  ...[[0, 'cis / des'], [1, 'dis / es'], [3, 'fis / ges'], [4, 'gis / as'], [5, 'ais / b']]
    .map(([after, text]) => ({ white: false, pos: after, pc: LETTER_PC['cdefgah'[after]] + 1, text, midi: 61 + LETTER_PC['cdefgah'[after]] })),
];

const PIANO_ACC = { easy: [0, 1, 1], medium: [0, 1, -1], hard: [0, 1, -1] };

function pianoTag(clef, d, acc, pc) {
  const target = (LETTER_PC[letterOf(d)] + acc + 12) % 12;
  if (acc !== 0 && pc === LETTER_PC[letterOf(d)]) return 'hudbaPosuvka';
  if (acc !== 0 && pc === (LETTER_PC[letterOf(d)] - acc + 12) % 12) return 'hudbaSmer';
  if (pc === LETTER_PC[letterOf(d + 1)] || pc === LETTER_PC[letterOf(d - 1)]) return 'hudbaSoused';
  const other = clef === 'bass' ? d + 12 : d - 12;
  if (pc === (LETTER_PC[letterOf(other)] + acc + 12) % 12) return 'hudbaKlic';
  return target === pc ? null : 'hudbaNazev';
}

function klavirExercise(level, form) {
  const clef = clefFor(level);
  const { low, high } = CLEFS[clef];
  let d;
  let acc;
  do {
    d = rnd(low, high);
    acc = pick(PIANO_ACC[level]);
  } while (!noteName(letterOf(d), acc));
  const name = noteName(letterOf(d), acc);
  const pc = (LETTER_PC[letterOf(d)] + acc + 12) % 12;
  const sign = acc === 1 ? ' s křížkem' : acc === -1 ? ' s béčkem' : '';
  if (form === 'naosnovu') return klavirReverse(level, clef, d, pc, name);
  return {
    level, task: 'klavir', form: 'naklavir', clef, d, acc, name, staves: stavesFor(level, clef), retry: true,
    labels: level === 'easy',
    text: `${CLEFS[clef].label}, nota ${placeText(stepOf(clef, d))}${sign}`,
    answer: name,
    options: PIANO_KEYS.map((k) => ({
      ...k, key: `${k.white ? 'w' : 'b'}${k.pos}`,
      ok: k.pc === pc, tag: k.pc === pc ? null : pianoTag(clef, d, acc, k.pc),
    })),
    key: `klavir|key|${clef}|${d}|${acc}`,
  };
}

/* Obráceně: na klávesnici svítí klávesa a dítě umístí notu na osnovu.
   Napřed si (u černé klávesy) vybere křížek nebo béčko, pak klepne na
   linku nebo mezeru. Možnost je proto dvojice místo + posuvka; správně
   je každá, která zní stejně jako klávesa (fis i ges, c dole i nahoře). */
const REVERSE_ACC = { easy: [0, 1], medium: [0, 1, -1], hard: [0, 1, -1] };

function klavirReverse(level, clef, d, pc, name) {
  const staves = stavesFor(level, clef);
  // u c svítí náhodně dolní, nebo horní klávesa - losuje se jednou, ne pro každou klávesu
  const cPos = pick([0, 7]);
  const keyIdx = PIANO_KEYS.findIndex((k) => k.pc === pc && (pc !== 0 || k.pos === cPos));
  const options = [];
  for (const staff of staves) {
    const { low, high } = CLEFS[staff];
    for (let dd = low; dd <= high; dd++) {
      for (const acc of REVERSE_ACC[level]) {
        const nm = noteName(letterOf(dd), acc);
        if (!nm) continue;
        const where = placeText(stepOf(staff, dd)) + (staves.length > 1 ? (staff === 'treble' ? ' (houslová osnova)' : ' (basová osnova)') : '');
        const opc = (LETTER_PC[letterOf(dd)] + acc + 12) % 12;
        options.push({ text: `${nm} – ${where}`, key: `${staff}:${dd}:${acc}`, staff, step: stepOf(staff, dd), d: dd, acc, ok: opc === pc });
      }
    }
  }
  const okLetters = new Set(options.filter((o) => o.ok).map((o) => letterOf(o.d)));
  for (const o of options) {
    if (o.ok) o.tag = null;
    else if (okLetters.has(letterOf(o.d))) o.tag = o.acc === 0 ? 'hudbaPosuvka' : 'hudbaSmer';
    else o.tag = 'hudbaNazev';
  }
  const black = !PIANO_KEYS[keyIdx].white;
  return {
    level, task: 'klavir', form: 'naosnovu', clef, staves, keyIdx, name, retry: true,
    accs: REVERSE_ACC[level], labels: level === 'easy',
    text: `Klávesa ${black ? PIANO_KEYS[keyIdx].text : name} na osnovu`,
    answer: [...new Set(options.filter((o) => o.ok).map((o) => o.text.split(' – ')[0]))].join(' nebo '),
    options,
    key: `klavir|rev|${staves.join('+')}|${pc}`,
  };
}

function klavirExplain(ex) {
  if (ex.form === 'naosnovu') {
    const key = PIANO_KEYS[ex.keyIdx];
    const right = ex.options.filter((o) => o.ok);
    const steps = [];
    if (key.white) {
      steps.push(`Svítí bílá klávesa **${key.text}**. Bílé klávesy se píšou bez křížku i béčka.`);
    } else {
      const [sharp, flat] = key.text.split(' / ');
      steps.push(`Svítí černá klávesa. Má dvě jména: **${sharp}** (bílá vlevo s křížkem ♯) a **${flat}** (bílá vpravo s béčkem ♭).`);
      steps.push(ex.accs.includes(-1)
        ? 'Na osnovu ji zapíšeš oběma způsoby – vyber křížek nebo béčko a pak klepni na místo.'
        : `Na osnovu ji zapíšeš jako **${sharp}**: vyber křížek a klepni na místo noty ${sharp[0]}.`);
    }
    for (const s of [...new Set(right.map((o) => o.staff))]) steps.push(CLEFS[s].anchorText);
    const places = [...new Set(right.map((o) => `${o.text.split(' – ')[0]} ${o.text.split(' – ')[1]}`))];
    steps.push(`Správně je třeba: ${places.slice(0, 3).join(', ')}.`);
    return steps;
  }
  const letter = letterOf(ex.d);
  const steps = noteSteps(ex.clef, ex.d);
  if (ex.acc === 1) {
    steps.push(`Před notou je **křížek ♯**. Ten ji posune o jednu klávesu **doprava** – z ${letter} je **${ex.name}**.`);
  } else if (ex.acc === -1) {
    steps.push(`Před notou je **béčko ♭**. To ji posune o jednu klávesu **doleva** – z ${letter} je **${ex.name}**.`);
  }
  steps.push('Na klavíru jsou černé klávesy ve skupinkách **po dvou a po třech**. Bílá klávesa hned vlevo od dvojice černých je **c**.');
  return steps;
}

/* ---------------- takty ----------------
   Položka taktu: nota nebo pomlka a kolik dob trvá. `n:eighth2` je
   dvojice osminových not spojená trámcem - jedna doba. */
export const BAR_ITEMS = {
  'n:whole': { beats: 4, label: 'celá' },
  'n:half': { beats: 2, label: 'půlová' },
  'n:dhalf': { beats: 3, label: 'tečkovaná půlová' },
  'n:quarter': { beats: 1, label: 'čtvrťová' },
  'n:eighth2': { beats: 1, label: 'dvě osminové' },
  'r:whole': { beats: 4, label: 'celá pomlka' },
  'r:half': { beats: 2, label: 'půlová pomlka' },
  'r:quarter': { beats: 1, label: 'čtvrťová pomlka' },
};

/* Noty padají třikrát častěji než pomlky. Celá nota nebo pomlka jen jako
   jediná věc v taktu o čtyřech dobách. */
function fillBar(beats, dotted = false) {
  if (beats === 4 && Math.random() < 0.12) return [{ k: pick(['n:whole', 'n:whole', 'r:whole']), step: rnd(2, 6) }];
  const out = [];
  let left = beats;
  while (left > 0) {
    const cand = Object.keys(BAR_ITEMS).filter((k) => BAR_ITEMS[k].beats <= left && BAR_ITEMS[k].beats < 4
      && (k !== 'n:dhalf' || dotted));
    const weighted = cand.flatMap((k) => (k.startsWith('n:') ? [k, k, k] : [k]));
    const k = pick(weighted);
    out.push({ k, step: rnd(1, 7) });
    left -= BAR_ITEMS[k].beats;
  }
  return out;
}

const barSum = (items) => items.reduce((s, it) => s + BAR_ITEMS[it.k].beats, 0);
const dobaWord = (n) => (n === 1 ? 'doba' : n >= 2 && n <= 4 ? 'doby' : 'dob');
const barText = (items) => `${items.map((it) => `${BAR_ITEMS[it.k].label} ${BAR_ITEMS[it.k].beats}`).join(' + ')} = ${barSum(items)}`;

const meterFor = (level) => (level === 'easy' ? 4 : level === 'medium' ? 3 : pick([3, 4]));

function taktExercise(level) {
  const clef = clefFor(level);
  const form = pick(['doby', 'dopln', 'chyba']);

  if (form === 'doby') {
    const sum = level === 'easy' ? pick([3, 4]) : rnd(2, 4);
    const items = fillBar(sum, level === 'hard');
    const choices = [2, 3, 4, 5];
    return {
      level, task: 'takt', form, clef, items,
      text: 'Kolik dob trvá tenhle takt?',
      answer: `${sum} ${dobaWord(sum)}`,
      options: choices.map((n) => ({ text: `${n} ${dobaWord(n)}`, key: String(n), ok: n === sum, tag: n === sum ? null : 'hudbaDoby' })),
      key: `takt|doby|${items.map((it) => it.k).join(',')}`,
    };
  }

  const meter = meterFor(level);

  if (form === 'dopln') {
    const missing = pick([1, 2]);
    const items = fillBar(meter - missing);
    const rests = ['r:whole', 'r:half', 'r:quarter'];
    return {
      level, task: 'takt', form, clef, meter, items, missing,
      text: `Která pomlka doplní takt ${meter}/4?`,
      answer: SYMBOLS[missing === 2 ? 'r:half' : 'r:quarter'],
      options: shuffle(rests).map((s) => ({
        text: SYMBOLS[s], key: s, sym: s, ok: BAR_ITEMS[s].beats === missing, tag: BAR_ITEMS[s].beats === missing ? null : 'hudbaDoby',
      })),
      key: `takt|dopln|${meter}|${items.map((it) => it.k).join(',')}`,
    };
  }

  // chyba: tři takty, jeden má o dobu víc nebo míň
  const wrongIdx = rnd(0, 2);
  const wrongSum = meter === 3 ? pick([2, 4]) : pick([3, 5]);
  const bars = [0, 1, 2].map((i) => fillBar(i === wrongIdx ? wrongSum : meter, level === 'hard' && meter === 3));
  return {
    level, task: 'takt', form, clef, meter, bars, wrongIdx,
    text: `Takty jsou ve ${meter}/4. Který z nich nesedí?`,
    answer: `${wrongIdx + 1}. takt`,
    options: bars.map((_, i) => ({ text: `${i + 1}. takt`, key: String(i), ok: i === wrongIdx, tag: i === wrongIdx ? null : 'hudbaDoby' })),
    key: `takt|chyba|${bars.map((b) => b.map((it) => it.k).join(',')).join('|')}`,
  };
}

const MAKERS = { znak: znakExercise, nazev: nazevExercise, umisti: umistiExercise, vyska: vyskaExercise, takt: taktExercise };

export function makeHudbaRound(levelKey = 'easy', tasks = HUDBA_TASK_KEYS, count = 10) {
  const level = HUDBA_LEVELS[levelKey] ? levelKey : 'easy';
  const n = HUDBA_COUNTS.includes(count) ? count : HUDBA_COUNTS[0];
  const use = tasks.filter((t) => t in HUDBA_TASKS);
  const keys = use.length ? use : ['nazev'];
  const plan = shuffle(Array.from({ length: n }, (_, i) => keys[i % keys.length]));
  const seen = new Set();
  return plan.map((task) => {
    let ex = MAKERS[task](level);
    for (let t = 0; t < 12 && seen.has(ex.key); t++) ex = MAKERS[task](level);
    seen.add(ex.key);
    return ex;
  });
}

/* ---------------- hra Klavír ----------------
   Samostatná hra pod záložkou Hudba. Směr si dítě vybírá v nastavení:
   `naklavir` - nota na osnově, klepne na klávesu; `naosnovu` - svítí
   klávesa, zapíše notu na osnovu (i s křížkem nebo béčkem). */
export const KLAVIR_FORMS = {
  naklavir: { label: 'Najdi klávesu', emoji: '🎹' },
  naosnovu: { label: 'Zapiš notu', emoji: '🎼' },
};
export const KLAVIR_FORM_KEYS = Object.keys(KLAVIR_FORMS);

export const KLAVIR_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'houslová osnova, jen křížky' },
  medium: { label: 'Střední', emoji: '🟡', note: 'basová osnova, křížky i béčka' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'obě osnovy najednou, křížky i béčka' },
};
export const KLAVIR_LEVEL_KEYS = Object.keys(KLAVIR_LEVELS);

export function makeKlavirRound(levelKey = 'easy', forms = KLAVIR_FORM_KEYS, count = 10) {
  const level = KLAVIR_LEVELS[levelKey] ? levelKey : 'easy';
  const n = HUDBA_COUNTS.includes(count) ? count : HUDBA_COUNTS[0];
  const use = forms.filter((f) => f in KLAVIR_FORMS);
  const keys = use.length ? use : ['naklavir'];
  const plan = shuffle(Array.from({ length: n }, (_, i) => keys[i % keys.length]));
  const seen = new Set();
  return plan.map((form) => {
    let ex = klavirExercise(level, form);
    for (let t = 0; t < 12 && seen.has(ex.key); t++) ex = klavirExercise(level, form);
    seen.add(ex.key);
    return ex;
  });
}

/* ---------------- hra Sluch ----------------
   Tóny hraje zvuk.js (syntéza v prohlížeči). Tady jsou jen čísla kláves
   MIDI (c1 = 60) a úlohy. Absolutní sluch nemá skoro nikdo, proto úlohy,
   kde se hledá konkrétní tón, nejdřív zahrají **c** jako kotvu. */
export const SLUCH_FORMS = {
  vyssi: { label: 'Vyšší, nebo nižší?', emoji: '↕️' },
  odc: { label: 'Najdi tón od c', emoji: '🎹' },
  melodie: { label: 'Zahraj, co slyšíš', emoji: '🎶' },
  nota: { label: 'Která nota zazněla?', emoji: '🎼' },
};
export const SLUCH_FORM_KEYS = Object.keys(SLUCH_FORMS);

export const SLUCH_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'velké skoky, jen bílé klávesy, melodie ze dvou tónů' },
  medium: { label: 'Střední', emoji: '🟡', note: 'menší skoky, melodie ze tří tónů' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'i černé klávesy a tóny těsně vedle sebe' },
};
export const SLUCH_LEVEL_KEYS = Object.keys(SLUCH_LEVELS);

const PC_NAME = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'ais', 'h'];
export const midiName = (m) => PC_NAME[((m % 12) + 12) % 12];
// horní c na klávesnici zní o oktávu výš než dolní - ve vysvětlení se nesmí plést
export const toneName = (m) => (m === 72 ? 'vysoké c' : midiName(m));

const keysFor = (level) => PIANO_KEYS.map((k, i) => ({ ...k, i })).filter((k) => k.white || level === 'hard');

function sluchVyssi(level) {
  const minGap = { easy: 5, medium: 3, hard: 1 }[level];
  const a = rnd(57, 77);
  let b = a;
  if (Math.random() >= 0.2) {
    do { b = a + pick([-1, 1]) * rnd(minGap, 12); } while (b < 55 || b > 81);
  }
  const rel = b > a ? 'up' : b < a ? 'down' : 'same';
  const opts = [['up', '⬆️ vyšší'], ['down', '⬇️ nižší'], ['same', '🟰 stejný']];
  return {
    level, task: 'sluch', form: 'vyssi', tones: [a, b], rel,
    text: 'Je druhý tón vyšší, nebo nižší než první?',
    answer: opts.find((o) => o[0] === rel)[1].split(' ')[1],
    options: opts.map(([key, text]) => ({ key, text, ok: key === rel, tag: key === rel ? null : 'hudbaSluch' })),
    key: `sluch|vyssi|${a}|${b}`,
  };
}

function sluchOdc(level) {
  const pool = keysFor(level).filter((k) => k.midi !== 60);
  const target = pick(pool);
  return {
    level, task: 'sluch', form: 'odc', tones: [60, target.midi], targetIdx: target.i, retry: true,
    labels: level === 'easy',
    text: `Najdi tón od c (${toneName(target.midi)})`,
    answer: toneName(target.midi),
    options: PIANO_KEYS.map((k) => ({ ...k, key: String(k.midi), ok: k.midi === target.midi, tag: k.midi === target.midi ? null : 'hudbaSluch' })),
    key: `sluch|odc|${target.midi}`,
  };
}

function sluchMelodie(level) {
  const pool = keysFor(level);
  const n = level === 'easy' ? 2 : 3;
  const seq = [pick(pool)];
  while (seq.length < n) {
    const prev = seq[seq.length - 1];
    const next = pick(pool.filter((k) => k.midi !== prev.midi && Math.abs(k.midi - prev.midi) <= 7));
    seq.push(next);
  }
  const names = seq.map((k) => toneName(k.midi)).join(' – ');
  return {
    level, task: 'sluch', form: 'melodie', tones: seq.map((k) => k.midi), seq: seq.map((k) => k.i), retry: true,
    labels: level === 'easy',
    text: `Zahraj melodii (${names})`,
    answer: names,
    options: PIANO_KEYS.map((k) => ({ ...k, key: String(k.midi), ok: false, tag: 'hudbaSluch' })),
    key: `sluch|melodie|${seq.map((k) => k.midi).join(',')}`,
  };
}

/* Na jedné houslové osnově stojí všechny noty c1 až c2 bez posuvek
   (stupnice zleva doprava) a dítě klepne na tu, která zazněla. */
function sluchNota(level) {
  const whites = PIANO_KEYS.filter((k) => k.white);
  const target = pick(whites.filter((k) => k.midi !== 60));
  const name = (k) => toneName(k.midi);
  return {
    level, task: 'sluch', form: 'nota', tones: [60, target.midi],
    text: `Která nota zazněla? (${name(target)})`,
    answer: name(target),
    options: whites.map((k) => ({
      text: name(k), key: String(k.pos), d: 28 + k.pos, midi: k.midi,
      ok: k === target, tag: k === target ? null : 'hudbaSluch',
    })),
    key: `sluch|nota|${target.pos}`,
  };
}

const SLUCH_MAKERS = { vyssi: sluchVyssi, odc: sluchOdc, melodie: sluchMelodie, nota: sluchNota };

export function makeSluchRound(levelKey = 'easy', forms = SLUCH_FORM_KEYS, count = 10) {
  const level = SLUCH_LEVELS[levelKey] ? levelKey : 'easy';
  const n = HUDBA_COUNTS.includes(count) ? count : HUDBA_COUNTS[0];
  const use = forms.filter((f) => f in SLUCH_FORMS);
  const keys = use.length ? use : ['vyssi'];
  const plan = shuffle(Array.from({ length: n }, (_, i) => keys[i % keys.length]));
  const seen = new Set();
  return plan.map((form) => {
    let ex = SLUCH_MAKERS[form](level);
    for (let t = 0; t < 12 && seen.has(ex.key); t++) ex = SLUCH_MAKERS[form](level);
    seen.add(ex.key);
    return ex;
  });
}

function sluchExplain(ex) {
  const [a, b] = ex.tones;
  if (ex.form === 'vyssi') {
    return [
      `První tón byl **${toneName(a)}**, druhý **${toneName(b)}**.`,
      ex.rel === 'same' ? 'Byly to **stejné** tóny.'
        : `Druhý byl **${ex.answer}** – na klavíru leží víc ${ex.rel === 'up' ? 'vpravo' : 'vlevo'}.`,
      'Poslechni si je ještě jednou tlačítkem 🔊.',
    ];
  }
  if (ex.form === 'melodie') {
    return [`Melodie byla: **${ex.answer}**.`, 'Poslechni si ji tlačítkem 🔊 a zkus si ji potichu zazpívat.'];
  }
  const steps = [`Nejdřív zazněl tón **c**, potom tón **${ex.answer}**.`];
  steps.push(b > 60 ? 'Druhý tón byl vyšší než c – na klavíru leží vpravo od něj. Čím dál vpravo, tím vyšší.' : '');
  if (ex.form === 'nota') steps.push(`Nota **${ex.answer}** sedí na osnově ${placeText(stepOf('treble', ex.options.find((o) => o.ok).d))}.`);
  steps.push('Poslechni si oba tóny ještě jednou tlačítkem 🔊.');
  return steps.filter(Boolean);
}

/* ---------------- vysvětlení ---------------- */

export function hudbaExplain(ex) {
  if (ex.task === 'znak') {
    const steps = [SYMBOL_RULE[ex.sym]];
    return steps.concat(`Tohle je **${SYMBOLS[ex.sym]}**.`);
  }
  if (ex.task === 'nazev') return noteSteps(ex.clef, ex.d);
  if (ex.task === 'klavir') return klavirExplain(ex);
  if (ex.task === 'sluch') return sluchExplain(ex);
  if (ex.task === 'umisti') {
    const right = ex.options.filter((o) => o.ok);
    const staves = [...new Set(right.map((o) => o.staff))];
    const steps = staves.map((s) => CLEFS[s].anchorText);
    steps.push(`Nota **${ex.letter}** je ${right.map((o) => o.text.replace(/^\S+ – /, '')).join(' a také ')}.`);
    if (right.length > 1) steps.push('Stejné písmeno se na osnově opakuje – správně je kterékoli z těch míst.');
    return steps;
  }
  if (ex.task === 'vyska') {
    const ok = ex.options.findIndex((o) => o.ok);
    return [
      'Čím **výš** nota na osnově sedí, tím je **vyšší** tón. Dole jsou hluboké tóny, nahoře vysoké.',
      `${ex.ask === 'higher' ? 'Výš' : 'Níž'} sedí **${ok + 1}. nota**.`,
    ];
  }
  // takt
  if (ex.form === 'doby') {
    return [
      `Celá nota trvá 4 doby, ${ex.level === 'hard' ? 'tečkovaná půlová 3, ' : ''}půlová 2, čtvrťová 1 a dvě osminové dohromady 1. Pomlky trvají stejně jako noty.`,
      `Sečti to: ${barText(ex.items)}.`,
      `Takt trvá **${ex.answer}**.`,
    ];
  }
  if (ex.form === 'dopln') {
    const have = barSum(ex.items);
    return [
      `V taktu ${ex.meter}/4 musí být **${ex.meter} ${dobaWord(ex.meter)}**.`,
      `Teď v něm je: ${barText(ex.items)}. Chybí ještě **${ex.missing} ${dobaWord(ex.missing)}**.`,
      `${ex.missing === 2 ? 'Dvě doby' : 'Jednu dobu'} trvá **${ex.answer}**.`,
      `Celá pomlka trvá 4 doby, půlová 2, čtvrťová 1.`,
    ].filter((s, i) => i !== 1 || have > 0);
  }
  const steps = [`V taktu ${ex.meter}/4 musí být **${ex.meter} ${dobaWord(ex.meter)}**.`];
  ex.bars.forEach((b, i) => {
    const s = barSum(b);
    steps.push(`${i + 1}. takt: ${barText(b)} ${s === ex.meter ? '✔' : `– to **nesedí**`}`);
  });
  return steps;
}

export function hudbaText(ex, reveal) {
  if (!reveal) return ex.text;
  return `${ex.text} → ${ex.answer}`;
}
