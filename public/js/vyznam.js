import { pick, shuffle } from './random.js';

/* ============================================================
   Význam slov

   Tři úlohy v jedné hře (vybírá se v nastavení, zapnuté se v kole
   střídají). Předlohou byla cvičení na umimecesky.cz:

   - `vztah` - Doplň vztah: „Slovo savec je ___ slovu zvíře.“ a tlačítka
     se vztahy. Které vztahy se nabízí, řídí obtížnost (`VYZNAM_LEVEL_RELS`).
   - `spoj`  - Spoj souřadná: plocha dvanácti slov, dítě je klepáním spojí
     do šesti dvojic. Ovladač je tentýž jako u „Najdi dvojice“. V kole je
     nejvýš jedna taková plocha.
   - `nad`   - Najdi nadřazené: řada čtyř slov a tři možnosti - správné
     nadřazené slovo, souřadné slovo (typická chyba) a nadřazené slovo
     jiné skupiny.

   Slova se NEGENERUJÍ - jsou ručně sepsaná. Při doplňování:

   - Skupiny v `CATS` se nesmí překrývat ani být jedna v druhé (žádná
     „zvířata“ vedle „ptáků“) - jinak by špatná možnost u „Najdi
     nadřazené“ byla taky správně a na ploše by šlo slovo spojit se dvěma.
   - Slovo na plochu má nejvýš 9 písmen, víc se na 320 px do kartičky nevejde.
   - Žádné dvojice, o kterých by se dalo s učitelkou přít (ráno – večer,
     teplý – horký, boty – oblečení).
   ============================================================ */

export const VYZNAM_TASKS = {
  vztah: { label: 'Doplň vztah', emoji: '🔗', ask: 'Jaké je to slovo?' },
  spoj: { label: 'Spoj souřadná', emoji: '👫', ask: 'Spoj slova, která patří k sobě.' },
  nad: { label: 'Najdi nadřazené', emoji: '⬆️', ask: 'Které slovo je nadřazené všem čtyřem?' },
};
export const VYZNAM_TASK_KEYS = Object.keys(VYZNAM_TASKS);

/* Vztahy v pevném pořadí tlačítek. `label` je ve středním rodě, aby sedělo
   do věty „Slovo savec je podřazené slovu zvíře.“ */
export const VYZNAM_RELS = {
  syn: {
    label: 'souznačné', emoji: '🟰',
    rule: 'Slova **souznačná** (synonyma) znamenají **totéž** nebo skoro totéž: hezký – pěkný.',
  },
  ant: {
    label: 'protikladné', emoji: '🔄',
    rule: 'Slova **protikladná** (antonyma) znamenají **opak**: malý – velký.',
  },
  nad: {
    label: 'nadřazené', emoji: '⬆️',
    rule: 'Slovo **nadřazené** je to **širší** – patří pod něj víc věcí: ovoce → jablko, hruška.',
  },
  pod: {
    label: 'podřazené', emoji: '⬇️',
    rule: 'Slovo **podřazené** je jedna věc **z větší skupiny**: jablko je druh ovoce.',
  },
  sour: {
    label: 'souřadné', emoji: '👫',
    rule: 'Slova **souřadná** patří **do stejné skupiny** a stojí vedle sebe: jablko, hruška, švestka.',
  },
  hom: {
    label: 'souzvučné', emoji: '👂',
    rule: 'Slova **souzvučná** (homonyma) znějí a píšou se **stejně**, ale znamenají něco **jiného**.',
  },
};
export const VYZNAM_REL_KEYS = Object.keys(VYZNAM_RELS);

export const VYZNAM_COUNTS = [5, 10, 15];

export const VYZNAM_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'slova souznačná a protikladná, známé skupiny jako ovoce nebo dny' },
  medium: { label: 'Střední', emoji: '🟡', note: 'přibudou slova nadřazená, podřazená a souřadná' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'přibudou slova souzvučná a skupiny, které si jsou blízko' },
};
export const VYZNAM_LEVEL_KEYS = Object.keys(VYZNAM_LEVELS);

/* Které vztahy se v „Doplň vztah“ objeví - zároveň tlačítka. */
export const VYZNAM_LEVEL_RELS = {
  easy: ['syn', 'ant'],
  medium: ['syn', 'ant', 'nad', 'pod', 'sour'],
  hard: ['syn', 'ant', 'nad', 'pod', 'sour', 'hom'],
};

const SYN = {
  easy: [
    'hezký – pěkný', 'velký – veliký', 'mluvit – povídat', 'běžet – utíkat', 'kluk – chlapec',
    'holka – děvče', 'táta – otec', 'máma – matka', 'doktor – lékař', 'brečet – plakat',
    'kamarád – přítel', 'statečný – odvážný', 'chytrý – bystrý', 'auto – automobil',
    'veselý – radostný', 'koukat – hledět',
  ],
  medium: [
    'spěchat – pospíchat', 'hlídat – střežit', 'dárek – dar', 'jít – kráčet', 'hovořit – mluvit',
    'snadný – lehký', 'těžký – obtížný', 'začátek – počátek', 'obličej – tvář', 'přemýšlet – uvažovat',
    'rychlý – svižný', 'hned – okamžitě', 'skoro – téměř', 'poslouchat – naslouchat',
    'stezka – pěšina', 'nemocný – churavý',
  ],
  hard: [
    'pes – čokl', 'kůň – oř', 'strach – bázeň', 'smutek – žal', 'les – hvozd', 'obr – velikán',
    'líný – lenivý', 'mrzutý – nevrlý', 'zlobit se – hněvat se', 'velmi – tuze', 'pomalu – zvolna',
    'zakopnout – klopýtnout', 'šeptat – špitat', 'bystrý – důvtipný',
  ],
};

const ANT = {
  easy: [
    'malý – velký', 'horký – studený', 'den – noc', 'nahoru – dolů', 'starý – mladý',
    'rychlý – pomalý', 'dobrý – zlý', 'světlo – tma', 'otevřít – zavřít', 'vysoký – nízký',
    'plný – prázdný', 'tlustý – tenký', 'veselý – smutný', 'dlouhý – krátký', 'začátek – konec',
    'přijít – odejít', 'mokrý – suchý', 'čistý – špinavý', 'bílý – černý', 'těžký – lehký',
  ],
  medium: [
    'silný – slabý', 'bohatý – chudý', 'hlasitý – tichý', 'pravda – lež', 'pracovitý – líný',
    'kupovat – prodávat', 'rozsvítit – zhasnout', 'zapnout – vypnout', 'dovnitř – ven',
    'nikdy – vždy', 'blízko – daleko', 'ztratit – najít', 'zdravý – nemocný', 'sladký – hořký',
    'tvrdý – měkký', 'ostrý – tupý', 'široký – úzký', 'hluboký – mělký', 'přítel – nepřítel',
  ],
  hard: [
    'odvážný – bojácný', 'štědrý – lakomý', 'pilný – lenivý', 'mír – válka', 'radost – smutek',
    'jednoduchý – složitý', 'vítězství – porážka', 'přední – zadní', 'příjezd – odjezd',
    'vstup – výstup', 'povolit – zakázat', 'pochválit – pokárat', 'zvednout – položit',
  ],
};

/* slovo | nápověda k prvnímu významu | nápověda k druhému */
const HOM = [
  'zámek|🏰 hrad|🔒 na dveřích',
  'koruna|👑 krále|🪙 peníz',
  'kohoutek|🐓 malý kohout|🚰 na vodu',
  'myš|🐭 zvířátko|🖱️ k počítači',
  'raketa|🚀 do vesmíru|🎾 na tenis',
  'list|🍃 ze stromu|📄 papíru',
  'pero|🪶 ptačí|🖊️ na psaní',
  'klíč|🔑 od dveří|🎼 houslový',
  'los|🦌 zvíře|🎟️ v loterii',
  'vlna|🌊 na moři|🐑 z ovce',
  'hřebínek|🪮 na vlasy|🐓 kohouta',
];

/* Skupiny slov. `one` jde do věty „Slovo ovoce je nadřazené slovu jablko.“,
   `many` je možnost u „Najdi nadřazené“ (leden, květen … → měsíce).
   `group` spojuje skupiny, které si jsou blízko - na těžké úrovni se
   z nich bere špatná možnost i dvojice na plochu. `from` = od které úrovně. */
const CATS = [
  { one: 'ovoce', many: 'ovoce', group: 'jidlo', from: 'easy', words: 'jablko hruška švestka banán třešeň meruňka broskev' },
  { one: 'zelenina', many: 'zelenina', group: 'jidlo', from: 'easy', words: 'mrkev okurka rajče paprika cibule ředkvička' },
  { one: 'pečivo', many: 'pečivo', group: 'jidlo', from: 'easy', words: 'rohlík chleba houska veka bageta loupák' },
  { one: 'nápoj', many: 'nápoje', group: 'jidlo', from: 'easy', words: 'čaj káva mléko džus limonáda kakao' },
  { one: 'den', many: 'dny', group: 'cas', from: 'easy', words: 'pondělí úterý středa čtvrtek pátek sobota neděle' },
  { one: 'měsíc', many: 'měsíce', group: 'cas', from: 'easy', words: 'leden únor březen duben květen červen červenec srpen září říjen listopad prosinec' },
  { one: 'barva', many: 'barvy', group: 'barvy', from: 'easy', words: 'červená modrá zelená žlutá bílá černá' },
  { one: 'hračka', many: 'hračky', group: 'doma', from: 'easy', words: 'panenka míč kostky autíčko medvídek švihadlo' },
  { one: 'oblečení', many: 'oblečení', group: 'doma', from: 'easy', words: 'svetr tričko kalhoty sukně bunda šaty' },
  { one: 'nábytek', many: 'nábytek', group: 'doma', from: 'easy', words: 'stůl židle skříň postel gauč křeslo' },
  { one: 'pták', many: 'ptáci', group: 'zvirata', from: 'easy', words: 'vrabec sýkora kos čáp holub vrána sova' },
  { one: 'květina', many: 'květiny', group: 'priroda', from: 'easy', words: 'tulipán růže kopretina fialka karafiát narcis' },
  { one: 'nádobí', many: 'nádobí', group: 'doma', from: 'medium', words: 'hrnec talíř hrnek mísa pánev konvice' },
  { one: 'nářadí', many: 'nářadí', group: 'doma', from: 'medium', words: 'kladivo pila šroubovák kleště sekera hoblík' },
  { one: 'strom', many: 'stromy', group: 'priroda', from: 'medium', words: 'dub buk lípa bříza smrk borovice javor' },
  { one: 'hmyz', many: 'hmyz', group: 'zvirata', from: 'medium', words: 'moucha včela mravenec beruška komár vosa' },
  { one: 'ryba', many: 'ryby', group: 'zvirata', from: 'medium', words: 'kapr štika pstruh sumec candát losos' },
  { one: 'sport', many: 'sporty', group: 'volno', from: 'medium', words: 'fotbal tenis hokej plavání florbal volejbal' },
  { one: 'vozidlo', many: 'vozidla', group: 'volno', from: 'medium', words: 'autobus tramvaj traktor motorka kamion trolejbus' },
  { one: 'kov', many: 'kovy', group: 'priroda', from: 'hard', words: 'železo zlato stříbro měď cín hliník' },
  { one: 'obilí', many: 'obilí', group: 'jidlo', from: 'hard', words: 'pšenice žito oves ječmen kukuřice' },
].map((c) => ({ ...c, words: c.words.split(' ') }));

const LEVEL_ORDER = VYZNAM_LEVEL_KEYS;
const catsFor = (level) => CATS.filter((c) => LEVEL_ORDER.indexOf(c.from) <= LEVEL_ORDER.indexOf(level));

/* `n` položek z `keys`, rozdělených co nejrovnoměrněji, zamíchaných. */
const spread = (keys, n) => shuffle(Array.from({ length: n }, (_, i) => keys[i % keys.length]));

const splitPair = (line) => line.split(' – ');
const maybeSwap = (pair) => (Math.random() < 0.5 ? pair : [pair[1], pair[0]]);

/* Tag chyby podle toho, co se s čím spletlo. */
function relTag(answer, given) {
  const pairOf = (a, b) => [answer, given].sort().join() === [a, b].sort().join();
  if (pairOf('syn', 'ant')) return 'vyznamSynAnt';
  if (pairOf('nad', 'pod')) return 'vyznamDir';
  return 'vyznamOther';
}

/* Jedna dvojice pro „Doplň vztah“. Slova, která už v kole padla, se
   nepoužijí znovu - jinak by „malý – velký“ napověděl „malý – drobný“. */
function relPair(rel, level, used) {
  const fresh = (words) => words.every((w) => !used.has(w));
  let found = null;
  if (rel === 'syn' || rel === 'ant') {
    const list = shuffle((rel === 'syn' ? SYN : ANT)[level].map(splitPair));
    const [a, b] = maybeSwap(list.find(fresh) || list[0]);
    found = { a, b };
  } else if (rel === 'hom') {
    const list = shuffle(HOM.map((h) => h.split('|')));
    const [word, hintA, hintB] = list.find((h) => !used.has(h[0])) || list[0];
    const [ha, hb] = maybeSwap([hintA, hintB]);
    found = { a: word, b: word, hintA: ha, hintB: hb };
  } else {
    const cats = shuffle(catsFor(level));
    for (const cat of cats) {
      const words = shuffle(cat.words.filter((w) => !used.has(w)));
      if (rel === 'sour' && words.length >= 2) { found = { a: words[0], b: words[1], cat }; break; }
      if (rel !== 'sour' && words.length && !used.has(cat.one)) {
        found = rel === 'nad' ? { a: cat.one, b: words[0], cat } : { a: words[0], b: cat.one, cat };
        break;
      }
    }
    if (!found) {
      const cat = cats[0];
      found = rel === 'sour' ? { a: cat.words[0], b: cat.words[1], cat }
        : rel === 'nad' ? { a: cat.one, b: cat.words[0], cat } : { a: cat.words[0], b: cat.one, cat };
    }
  }
  used.add(found.a);
  used.add(found.b);
  return found;
}

function vztahExercise(level, used) {
  const rels = VYZNAM_LEVEL_RELS[level];
  const rel = pick(rels);
  const p = relPair(rel, level, used);
  return {
    level, task: 'vztah', answer: rel,
    a: p.a, b: p.b, hintA: p.hintA || '', hintB: p.hintB || '', cat: p.cat?.many || '',
    options: rels.map((k) => ({
      key: k, text: VYZNAM_RELS[k].label, ok: k === rel, tag: k === rel ? null : relTag(rel, k),
    })),
    key: `vztah|${p.a}|${p.b}`,
  };
}

/* Špatná skupina pro „Najdi nadřazené“. Na těžké úrovni se bere skupina,
   která má k té správné blízko (měsíce × dny), aby se nedalo jen hádat. */
function otherCat(cat, level) {
  const others = catsFor(level).filter((c) => c !== cat && c.many !== cat.many);
  const near = others.filter((c) => c.group === cat.group);
  return pick(level === 'hard' && near.length ? near : others);
}

function nadExercise(level, used, usedCats) {
  const cats = shuffle(catsFor(level));
  const cat = cats.find((c) => !usedCats.has(c.many) && c.words.filter((w) => !used.has(w)).length >= 5) || cats[0];
  usedCats.add(cat.many);
  const unused = shuffle(cat.words.filter((w) => !used.has(w)));
  const words = unused.length >= 5 ? unused : shuffle(cat.words);
  const shown = words.slice(0, 4);
  const sibling = words[4];
  for (const w of shown) used.add(w);
  const wrong = otherCat(cat, level);
  return {
    level, task: 'nad', answer: cat.many, words: shown, text: shown.join(', '),
    options: shuffle([
      { text: cat.many, ok: true, tag: null },
      { text: sibling, ok: false, tag: 'vyznamSour' },
      { text: wrong.many, ok: false, tag: 'vyznamOther' },
    ]),
    key: `nad|${cat.many}|${shown.join(',')}`,
  };
}

/* Plocha 6 dvojic, každá z jiné skupiny - jinak by šlo slovo spojit se
   dvěma. Na těžké úrovni jdou skupiny po dvou ze stejného okruhu (ovoce
   a zelenina, dny a měsíce), na lehké z co nejrůznějších. */
export const SPOJ_PAIRS = 6;
export const SPOJ_COLS = 3;

function spojExercise(level, used) {
  const cats = shuffle(catsFor(level));
  let order;
  if (level === 'hard') {
    // nejvýš dvě skupiny z jednoho okruhu - blízko, ale pořád rozhodnutelné
    const groups = shuffle([...new Set(cats.map((c) => c.group))]);
    order = groups.flatMap((g) => cats.filter((c) => c.group === g).slice(0, 2));
  } else {
    // každý okruh jednou, pak teprve druhá skupina z téhož okruhu
    const seen = new Set();
    const first = cats.filter((c) => (seen.has(c.group) ? false : seen.add(c.group)));
    order = [...first, ...cats.filter((c) => !first.includes(c))];
  }
  const items = order.slice(0, SPOJ_PAIRS).map((cat, i) => {
    const words = shuffle(cat.words.filter((w) => !used.has(w)));
    const [a, b] = words.length >= 2 ? words : shuffle(cat.words);
    used.add(a);
    used.add(b);
    return { pair: i, cat: cat.many, a, b };
  });
  const cards = shuffle(items.flatMap((it) => [
    { pair: it.pair, face: 'word', text: it.a },
    { pair: it.pair, face: 'word', text: it.b },
  ]));
  return {
    level, task: 'spoj', pairs: items.length, cols: SPOJ_COLS, rows: Math.ceil(cards.length / SPOJ_COLS),
    items, cards,
    key: `spoj|${items.map((it) => `${it.a}+${it.b}`).sort().join(',')}`,
  };
}

/* Jedno kolo. Plocha „Spoj souřadná“ je nejvýš jedna a stojí na začátku
   (kolo s plochou uprostřed by dítě vytrhlo z rytmu); zbytek se rozdělí
   rovnoměrně mezi ostatní zapnuté úlohy. Je-li zapnuté jen spojování,
   je kolo jediná plocha. */
export function makeVyznamRound(levelKey = 'easy', tasks = VYZNAM_TASK_KEYS, count = 10) {
  const level = VYZNAM_LEVELS[levelKey] ? levelKey : 'easy';
  const n = VYZNAM_COUNTS.includes(count) ? count : VYZNAM_COUNTS[1];
  const use = tasks.filter((t) => t in VYZNAM_TASKS);
  const used = new Set();
  const usedCats = new Set();
  const rest = use.filter((t) => t !== 'spoj');
  const out = [];
  if (!use.length || use.includes('spoj')) out.push(spojExercise(level, used));
  if (!rest.length) return out;
  const plan = spread(rest, n - out.length);
  for (const task of plan) {
    out.push(task === 'nad' ? nadExercise(level, used, usedCats) : vztahExercise(level, used));
  }
  return out;
}

/* Kroky vysvětlení po chybě, **tučné** převádí app.js na <b>. */
export function vyznamExplain(ex) {
  if (ex.task === 'spoj') {
    return [
      'Slova **souřadná** patří do stejné skupiny.',
      ...ex.items.map((it) => `${it.a} – ${it.b} (${it.cat})`),
    ];
  }
  if (ex.task === 'nad') {
    return [
      VYZNAM_RELS.nad.rule,
      `Všechna čtyři slova jsou **${ex.answer}** – to je to slovo nadřazené.`,
      'Slovo ze stejné skupiny by bylo **souřadné**, ne nadřazené.',
    ];
  }
  const rel = VYZNAM_RELS[ex.answer];
  const steps = [rel.rule];
  if (ex.answer === 'nad') steps.push(`Slovo **${ex.b}** patří pod slovo **${ex.a}** – ${ex.a} je to širší.`);
  if (ex.answer === 'pod') steps.push(`Slovo **${ex.a}** patří pod slovo **${ex.b}** – ${ex.a} je to užší.`);
  if (ex.answer === 'sour') steps.push(`**${ex.a}** i **${ex.b}** patří mezi ${ex.cat}.`);
  if (ex.answer === 'hom') steps.push(`Slovo **${ex.a}** tu jednou znamená ${ex.hintA}, podruhé ${ex.hintB}.`);
  steps.push(`Slovo **${ex.a}** je **${rel.label}** slovu **${ex.b}**.`);
  return steps;
}

export function vyznamText(ex, reveal) {
  if (ex.task === 'spoj') return `spoj ${ex.pairs} dvojic${reveal ? ` (${ex.cols}×${ex.rows})` : ''}`;
  if (ex.task === 'nad') return reveal ? `${ex.text} → ${ex.answer}` : ex.text;
  const base = `${ex.a} – ${ex.b}`;
  return reveal ? `${base} → ${VYZNAM_RELS[ex.answer].label}` : base;
}
