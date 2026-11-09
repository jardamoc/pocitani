import { pick, shuffle } from './random.js';

/* ============================================================
   Geometrie (2. třída)

   Čtyři úlohy, všechny jedním klepnutím (ovladač s výběrem v app.js):

   - `utvar` - Poznej útvar: obrázek → název (rovinné útvary i tělesa).
   - `najdi` - Najdi obrázek: název → klepnout na správný obrázek.
   - `cary`  - Čáry: bod, úsečka, přímka, polopřímka, lomená, křivá čára;
               jednou obrázek → název, jindy naopak.
   - `kolem` - Tělesa kolem nás: věc (míč, plechovka…) → jaké je to těleso.

   Obtížnost = záludnost (rozhodl uživatel):
   - lehká: tři možnosti, žádné záludné dvojice, útvary rovně,
   - střední: víc tvarů, čtyři možnosti, natočené a různě velké obrázky,
   - těžká: špatné možnosti jsou schválně ty záludné (čtverec × obdélník,
     kruh × kružnice × koule, krychle × kvádr, přímka × polopřímka × úsečka),
     čtverec natočený až na kosočtverec, obdélník skoro čtvercový.

   Obrázek se popisuje parametry (`fig`) už tady, ne až při kreslení -
   plocha se po klepnutí překresluje a obrázek nesmí poskočit.
   Kreslí je geokresba.js.
   ============================================================ */

export const GEOM_TASKS = {
  utvar: { label: 'Poznej útvar', emoji: '🔷' },
  najdi: { label: 'Najdi obrázek', emoji: '👆' },
  cary: { label: 'Čáry', emoji: '📏' },
  kolem: { label: 'Tělesa kolem nás', emoji: '⚽' },
};
export const GEOM_TASK_KEYS = Object.keys(GEOM_TASKS);

export const GEOM_COUNTS = [10, 20, 30];

export const GEOM_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'jasně odlišné tvary a tři možnosti' },
  medium: { label: 'Střední', emoji: '🟡', note: 'víc tvarů, natočené obrázky a čtyři možnosti' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'záludné dvojice – čtverec a obdélník, kruh a kružnice, přímka a úsečka' },
};
export const GEOM_LEVEL_KEYS = Object.keys(GEOM_LEVELS);

/* `dim`: 2 rovinný útvar, 3 těleso, 1 čára. */
export const SHAPES = {
  ctverec: { name: 'čtverec', dim: 2 },
  obdelnik: { name: 'obdélník', dim: 2 },
  trojuhelnik: { name: 'trojúhelník', dim: 2 },
  kruh: { name: 'kruh', dim: 2 },
  kruznice: { name: 'kružnice', dim: 2 },
  petiuhelnik: { name: 'pětiúhelník', dim: 2 },
  sestiuhelnik: { name: 'šestiúhelník', dim: 2 },
  krychle: { name: 'krychle', dim: 3 },
  kvadr: { name: 'kvádr', dim: 3 },
  koule: { name: 'koule', dim: 3 },
  valec: { name: 'válec', dim: 3 },
  kuzel: { name: 'kužel', dim: 3 },
  jehlan: { name: 'jehlan', dim: 3 },
  bod: { name: 'bod', dim: 1 },
  usecka: { name: 'úsečka', dim: 1 },
  primka: { name: 'přímka', dim: 1 },
  polopr: { name: 'polopřímka', dim: 1 },
  lomena: { name: 'lomená čára', dim: 1 },
  kriva: { name: 'křivá čára', dim: 1 },
};
const nameOf = (s) => SHAPES[s].name;

const POOL = {
  easy: {
    flat: ['ctverec', 'obdelnik', 'trojuhelnik', 'kruh'],
    solid: ['krychle', 'kvadr', 'koule', 'valec', 'kuzel'],
    line: ['bod', 'usecka', 'primka', 'lomena', 'kriva'],
  },
  medium: {
    flat: ['ctverec', 'obdelnik', 'trojuhelnik', 'kruh', 'kruznice', 'petiuhelnik', 'sestiuhelnik'],
    solid: ['krychle', 'kvadr', 'koule', 'valec', 'kuzel', 'jehlan'],
    line: ['bod', 'usecka', 'primka', 'polopr', 'lomena', 'kriva'],
  },
};
POOL.hard = POOL.medium;

/* Se kterým tvarem se ten hledaný nejčastěji plete - od nejčastějšího.
   Na lehké se tyhle dvojice mezi možnostmi schválně neobjeví, na těžké
   jdou mezi špatné možnosti přednostně. */
const TRAP = {
  ctverec: ['obdelnik', 'krychle'],
  obdelnik: ['ctverec', 'kvadr'],
  trojuhelnik: ['jehlan', 'kuzel'],
  kruh: ['kruznice', 'koule'],
  kruznice: ['kruh', 'koule'],
  petiuhelnik: ['sestiuhelnik'],
  sestiuhelnik: ['petiuhelnik'],
  krychle: ['kvadr', 'ctverec'],
  kvadr: ['krychle', 'obdelnik'],
  koule: ['kruh', 'valec'],
  valec: ['kuzel', 'koule'],
  kuzel: ['jehlan', 'valec', 'trojuhelnik'],
  jehlan: ['kuzel', 'trojuhelnik', 'krychle'],
  bod: ['usecka'],
  usecka: ['primka', 'polopr', 'lomena'],
  primka: ['polopr', 'usecka'],
  polopr: ['primka', 'usecka'],
  lomena: ['usecka', 'kriva'],
  kriva: ['lomena'],
};

/* Věci kolem nás. Jen takové, kde o tělese není sporu - jehlan tu proto
   není (pyramida nemá obrázek), krabice taky ne (bývá krychle i kvádr). */
const OBJECTS = {
  koule: [
    { name: 'míč', emoji: '⚽' }, { name: 'basketbalový míč', emoji: '🏀' }, { name: 'tenisák', emoji: '🎾' },
    { name: 'pomeranč', emoji: '🍊' }, { name: 'skleněná koule', emoji: '🔮' },
  ],
  valec: [
    { name: 'plechovka', emoji: '🥫' }, { name: 'svíčka', emoji: '🕯️' }, { name: 'buben', emoji: '🥁' },
    { name: 'role papíru', emoji: '🧻' }, { name: 'baterie', emoji: '🔋' },
  ],
  krychle: [{ name: 'hrací kostka', emoji: '🎲' }, { name: 'kostka ledu', emoji: '🧊' }],
  kvadr: [{ name: 'cihla', emoji: '🧱' }, { name: 'kniha', emoji: '📕' }, { name: 'máslo', emoji: '🧈' }],
  kuzel: [{ name: 'kornout zmrzliny', emoji: '🍦' }],
};

/* Pravidlo ke každému tvaru - do vysvětlení po chybě. */
const RULE = {
  ctverec: 'Čtverec má **čtyři stejně dlouhé strany** a rohy jako sešit. I když je natočený, pořád je to čtverec.',
  obdelnik: 'Obdélník má **dvě delší a dvě kratší strany** a rohy jako sešit.',
  trojuhelnik: 'Trojúhelník má **tři strany a tři rohy**.',
  kruh: 'Kruh je **celá plocha** uvnitř kulaté čáry – jako mince nebo talíř.',
  kruznice: 'Kružnice je **jen ta kulatá čára**, uvnitř je prázdno – jako obruč.',
  petiuhelnik: 'Pětiúhelník má **pět stran a pět rohů**.',
  sestiuhelnik: 'Šestiúhelník má **šest stran a šest rohů** – jako buňka včelí plástve.',
  krychle: 'Krychle je těleso a **všech šest stěn má stejné čtverce** – jako hrací kostka.',
  kvadr: 'Kvádr je těleso se šesti stěnami a **některé jsou obdélníky** – jako cihla.',
  koule: 'Koule je **kulatá ze všech stran** a nemá žádnou hranu – jako míč.',
  valec: 'Válec má **dvě kulaté podstavy**, nahoře a dole, a kulatý bok – jako plechovka.',
  kuzel: 'Kužel má **jednu kulatou podstavu** a nahoře **špičku** – jako kornout.',
  jehlan: 'Jehlan má **hranatou podstavu** a boky z **trojúhelníků**, které se sbíhají do špičky – jako pyramida.',
  bod: 'Bod je jen **malá tečka**. Pojmenujeme ho velkým písmenem, třeba A.',
  usecka: 'Úsečka je rovná čára, která **začíná v jednom bodě a končí v druhém**. Dá se změřit pravítkem.',
  primka: 'Přímka je rovná čára **bez začátku i bez konce** – pokračuje na obě strany pořád dál.',
  polopr: 'Polopřímka **začíná v bodě**, ale **nekončí** – na druhou stranu pokračuje pořád dál.',
  lomena: 'Lomená čára je složená z **rovných kousků**, které se lámou v rozích.',
  kriva: 'Křivá čára je **zahnutá** – nemá žádný rovný kousek ani roh.',
};

const FLAT_VS_SOLID = 'Rovinný útvar je **placatý jako papír** (čtverec, kruh, trojúhelník). '
  + '**Těleso** můžeš vzít do ruky a ze všech stran ho obejít (krychle, koule, kužel).';

const TAIL_NOTE = 'Tečky na konci čáry ukazují, že pokračuje pořád dál.';

/* Tagy chyb - popisky jsou v `TAGS` v generator.js. */
export const GEOM_TAGS = {
  geomPlocha: 'záměna rovinného útvaru a tělesa',
  geomCtyr: 'záměna čtverce a obdélníku',
  geomKruh: 'záměna kruhu a kružnice',
  geomTeleso: 'záměna těles',
  geomUtvar: 'záměna rovinných útvarů',
  geomKonce: 'záměna přímky, polopřímky a úsečky',
  geomCara: 'záměna čar',
};

const KONCE = ['usecka', 'primka', 'polopr'];

function geomTag(target, chosen) {
  const a = SHAPES[target].dim;
  const b = SHAPES[chosen].dim;
  if (a !== b) return 'geomPlocha';
  const both = (x, y) => (target === x && chosen === y) || (target === y && chosen === x);
  if (both('ctverec', 'obdelnik') || both('krychle', 'kvadr')) return 'geomCtyr';
  if (both('kruh', 'kruznice')) return 'geomKruh';
  if (a === 1) return KONCE.includes(target) && KONCE.includes(chosen) ? 'geomKonce' : 'geomCara';
  return a === 3 ? 'geomTeleso' : 'geomUtvar';
}

/* Špatné možnosti podle obtížnosti - viz úvod souboru. */
function others(target, pool, n, level) {
  const rest = pool.filter((s) => s !== target);
  const traps = (TRAP[target] || []).filter((s) => rest.includes(s));
  const plain = rest.filter((s) => !traps.includes(s));
  const order = level === 'easy'
    ? [...shuffle(plain), ...shuffle(traps)]
    : level === 'hard'
      ? [...shuffle(traps), ...shuffle(plain)]
      : shuffle(rest);
  return order.slice(0, n - 1);
}

function optionsFor(target, pool, level, withFig = false) {
  const n = level === 'easy' ? 3 : 4;
  return shuffle([target, ...others(target, pool, n, level)]).map((s) => ({
    key: s,
    text: nameOf(s),
    ok: s === target,
    tag: s === target ? null : geomTag(target, s),
    ...(withFig ? { fig: figFor(s, level) } : {}),
  }));
}

/* ---------------- parametry obrázku ----------------
   Úhly ve stupních, velikost jako podíl plochy obrázku. Desetinná čísla
   tu nevadí - dítě je nikde neuvidí, jen tvar. */
function figFor(shape, level) {
  const easy = level === 'easy';
  const tilt = easy ? 0 : level === 'medium' ? pick([0, 0, 10, 20, -15]) : pick([0, 15, 30, 45, -20]);
  const size = easy ? 0.8 : pick([0.65, 0.75, 0.85]);
  const lineTilt = easy ? 0 : pick([-20, -10, 0, 10, 20]);
  switch (shape) {
    case 'ctverec': return { shape, tilt, size };
    case 'obdelnik': {
      const ratio = easy ? 1.8 : level === 'medium' ? pick([1.5, 1.7, 2]) : pick([1.25, 1.3, 1.4]);
      // obdélník může stát i na výšku
      return { shape, tilt: tilt + (easy ? 0 : pick([0, 90])), size, ratio };
    }
    case 'trojuhelnik': return { shape, tilt, size, kind: easy ? 'eq' : pick(['eq', 'right', 'any']) };
    case 'petiuhelnik':
    case 'sestiuhelnik': return { shape, tilt: easy ? 0 : pick([0, 15, 30]), size };
    case 'kruh':
    case 'kruznice': return { shape, size };
    case 'krychle': return { shape, a: easy ? 46 : pick([38, 44, 50]) };
    case 'kvadr': {
      const boxes = easy
        ? [{ w: 66, h: 34, d: 40 }, { w: 34, h: 58, d: 30 }]
        : level === 'medium'
          ? [{ w: 66, h: 34, d: 40 }, { w: 34, h: 58, d: 30 }, { w: 58, h: 30, d: 60 }, { w: 30, h: 50, d: 50 }]
          : [{ w: 52, h: 40, d: 44 }, { w: 40, h: 52, d: 40 }, { w: 54, h: 42, d: 54 }];
      return { shape, ...pick(boxes) };
    }
    case 'koule': return { shape, r: easy ? 40 : pick([34, 38, 42]) };
    case 'valec': return { shape, h: easy ? 54 : pick([40, 50, 60]), rx: easy ? 28 : pick([22, 28, 34]) };
    case 'kuzel': return { shape, h: easy ? 60 : pick([50, 60, 66]), rx: easy ? 32 : pick([24, 30, 36]) };
    case 'jehlan': return { shape, a: easy ? 50 : pick([44, 50, 56]), h: pick([52, 60]) };
    case 'bod': return { shape };
    case 'usecka': return { shape, tilt: lineTilt, len: easy ? 100 : pick([60, 80, 100]) };
    case 'primka': return { shape, tilt: lineTilt };
    case 'polopr': return { shape, tilt: lineTilt, dir: pick([1, -1]) };
    case 'lomena': {
      const n = pick([3, 4]);
      return { shape, ys: Array.from({ length: n + 1 }, (_, i) => (i % 2 ? pick([12, 18, 24]) : pick([46, 52, 58]))) };
    }
    case 'kriva': return { shape, kind: pick([0, 1]) };
    default: return { shape };
  }
}

/* ---------------- úlohy ---------------- */

function utvarExercise(level) {
  const fam = pick(['flat', 'solid']);
  const target = pick(POOL[level][fam]);
  // na lehké jen z téže rodiny - placaté s placatými, tělesa s tělesy
  const pool = level === 'easy' ? POOL[level][fam] : [...POOL[level].flat, ...POOL[level].solid];
  return {
    level, task: 'utvar', form: 'show', shape: target, fig: figFor(target, level),
    text: 'Co je na obrázku?', answer: nameOf(target),
    options: optionsFor(target, pool, level),
    key: `utvar|${target}`,
  };
}

function najdiExercise(level) {
  const fam = pick(['flat', 'solid']);
  const target = pick(POOL[level][fam]);
  const pool = level === 'easy' ? POOL[level][fam] : [...POOL[level].flat, ...POOL[level].solid];
  return {
    level, task: 'najdi', form: 'find', shape: target,
    text: `Kde je ${nameOf(target)}?`, answer: nameOf(target),
    options: optionsFor(target, pool, level, true),
    key: `najdi|${target}`,
  };
}

function caryExercise(level) {
  const target = pick(POOL[level].line);
  const form = pick(['show', 'find']);
  return {
    level, task: 'cary', form, shape: target, fig: figFor(target, level),
    text: form === 'show' ? 'Jaká je to čára?' : `Kde je ${nameOf(target)}?`,
    answer: nameOf(target),
    options: optionsFor(target, POOL[level].line, level, form === 'find'),
    key: `cary|${form}|${target}`,
  };
}

function kolemExercise(level) {
  const target = pick(Object.keys(OBJECTS));
  const item = pick(OBJECTS[target]);
  /* Na těžké se mezi možnostmi objeví i rovinný útvar (míč × kruh,
     kostka × čtverec) - plete se často. */
  const pool = level === 'hard'
    ? [...POOL.hard.solid, 'kruh', 'ctverec', 'obdelnik', 'trojuhelnik']
    : POOL[level].solid;
  return {
    level, task: 'kolem', form: 'show', shape: target, item,
    text: `Jaký tvar má ${item.name}?`, answer: nameOf(target),
    options: optionsFor(target, pool, level),
    key: `kolem|${item.name}`,
  };
}

const MAKERS = { utvar: utvarExercise, najdi: najdiExercise, cary: caryExercise, kolem: kolemExercise };

export function makeGeomRound(levelKey = 'easy', tasks = GEOM_TASK_KEYS, count = 10) {
  const level = GEOM_LEVELS[levelKey] ? levelKey : 'easy';
  const n = GEOM_COUNTS.includes(count) ? count : GEOM_COUNTS[0];
  const use = tasks.filter((t) => t in GEOM_TASKS);
  const keys = use.length ? use : ['utvar'];
  const plan = shuffle(Array.from({ length: n }, (_, i) => keys[i % keys.length]));
  const seen = new Set();
  return plan.map((task) => {
    let ex = MAKERS[task](level);
    for (let t = 0; t < 12 && seen.has(ex.key); t++) ex = MAKERS[task](level);
    seen.add(ex.key);
    return ex;
  });
}

/* ---------------- vysvětlení ---------------- */

export function geomExplain(ex) {
  const target = ex.shape;
  const name = nameOf(target);
  const steps = [RULE[target]];
  // záludná dvojice, která v možnostech byla - ať je vidět rozdíl
  const trap = (TRAP[target] || []).find((s) => ex.options.some((o) => o.key === s));
  if (trap) steps.push(SHAPES[trap].dim !== SHAPES[target].dim ? FLAT_VS_SOLID : RULE[trap]);
  if (ex.task === 'cary' && ['primka', 'polopr'].some((s) => s === target || s === trap)) steps.push(TAIL_NOTE);
  if (ex.task === 'kolem') steps.push(`${ex.item.name[0].toUpperCase()}${ex.item.name.slice(1)} má tvar, kterému říkáme **${name}**.`);
  else if (ex.form === 'find') steps.push(`Zelený obrázek je **${name}**.`);
  else steps.push(`Na obrázku je **${name}**.`);
  return steps;
}

export function geomText(ex, reveal) {
  const text = ex.task === 'utvar' ? 'Poznej útvar' : ex.task === 'cary' && ex.form === 'show' ? 'Poznej čáru' : ex.text;
  return reveal ? `${text} → ${ex.answer}` : text;
}
