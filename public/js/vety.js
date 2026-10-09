import { shuffle } from './random.js';

/* ============================================================
   Druhy vět

   Dvě úlohy v jedné hře (vybírá se v nastavení, když jsou zapnuté obě,
   kolo se rozdělí půl na půl):

   - `type` - Urči druh věty: věta a čtyři tlačítka (oznamovací, tázací,
     rozkazovací, přací). Tlačítka mají pořád stejné pořadí, ať je dítě
     hledá na stejném místě.
   - `ask`  - Udělej otázku: oznamovací věta a dvě až tři hotové věty na
     výběr. Správná je ta tázací, špatné jsou typické chyby: zapomenutý
     otazník, rozkaz místo otázky, otázka na něco jiného.

   Věty se NEGENERUJÍ - jsou ručně sepsané. Jeden řádek `ASK` je čtveřice

       'oznamovací | tázací | rozkazovací | tázací, ale na něco jiného'

   a slouží oběma úlohám: v `type` se z ní bere oznamovací, tázací
   i rozkazovací věta (nikdy dvě z téže čtveřice v jednom kole).

   Pozor při doplňování: věta „Petr jde domů?“ (jen otazník, slova stejně)
   je v češtině taky správná otázka. Mezi špatnými možnostmi proto nesmí
   být nic, co končí otazníkem a říká totéž. Přací věty začínají `Kéž`
   nebo `Ať` jen tam, kde jde o přání, které nikdo nemůže splnit
   rozkazem - „Ať přijde!“ by byl rozkaz třetí osobě.
   ============================================================ */

export const VETY_TYPES = {
  ozn: {
    label: 'oznamovací', emoji: '💬',
    rule: 'Oznamovací věta něco **oznamuje** – říká, co se děje nebo jak to je. Na konci má **tečku**.',
  },
  taz: {
    label: 'tázací', emoji: '❓',
    rule: 'Tázací věta se **ptá**. Na konci má **otazník**.',
  },
  roz: {
    label: 'rozkazovací', emoji: '📢',
    rule: 'Rozkazovací věta někomu říká, **ať něco udělá** – přikazuje nebo prosí. Na konci má **vykřičník** nebo tečku.',
  },
  pra: {
    label: 'přací', emoji: '🌠',
    rule: 'Přací věta něco **přeje**. Často začíná slovem **Kéž** nebo **Ať** a na konci má většinou **vykřičník**.',
  },
};
export const VETY_TYPE_KEYS = Object.keys(VETY_TYPES);

export const VETY_TASKS = {
  type: { label: 'Urči druh věty', emoji: '🏷️', ask: 'Jaká je to věta?' },
  ask: { label: 'Udělej otázku', emoji: '❓', ask: 'Udělej z věty otázku. Která je správně?' },
};
export const VETY_TASK_KEYS = Object.keys(VETY_TASKS);

export const VETY_COUNTS = [5, 10, 15];

export const VETY_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'krátké věty, druh se pozná podle znaménka na konci' },
  medium: { label: 'Střední', emoji: '🟡', note: 'delší věty, rozkaz může končit i tečkou' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'pasti jako „Nevím, kde je klíč.“ nebo „Řekni mi, kdo to byl.“' },
};
export const VETY_LEVEL_KEYS = Object.keys(VETY_LEVELS);

/* oznamovací | tázací | rozkazovací | tázací na něco jiného */
const ASK = {
  easy: [
    'Pes štěká. | Štěká pes? | Štěkej, pejsku! | Vrčí pes?',
    'Kočka spí. | Spí kočka? | Spi, kočičko! | Spí pes?',
    'Máma vaří polévku. | Vaří máma polévku? | Vař, mami, polévku! | Vaří máma knedlíky?',
    'Táta čte noviny. | Čte táta noviny? | Čti, tati, noviny! | Čte táta knihu?',
    'Eva kreslí koně. | Kreslí Eva koně? | Kresli, Evo, koně! | Kreslí Eva psa?',
    'Petr jde domů. | Jde Petr domů? | Jdi, Petře, domů! | Jde Petr do školy?',
    'Anna jí jablko. | Jí Anna jablko? | Jez, Anno, jablko! | Jí Anna hrušku?',
    'Děti zpívají. | Zpívají děti? | Zpívejte, děti! | Tancují děti?',
    'Babička peče koláč. | Peče babička koláč? | Peč, babičko, koláč! | Peče babička chleba?',
    'Tomáš hraje fotbal. | Hraje Tomáš fotbal? | Hraj, Tomáši, fotbal! | Hraje Tomáš hokej?',
    'Pejsek nese míček. | Nese pejsek míček? | Nes, pejsku, míček! | Nese pejsek kost?',
    'Jana zalévá kytky. | Zalévá Jana kytky? | Zalévej, Jano, kytky! | Trhá Jana kytky?',
    'Bratr píše úkol. | Píše bratr úkol? | Piš, bratře, úkol! | Píše bratr dopis?',
    'Kuba leží v posteli. | Leží Kuba v posteli? | Lež, Kubo, v posteli! | Leží Kuba na gauči?',
    'Ema myje nádobí. | Myje Ema nádobí? | Myj, Emo, nádobí! | Myje Ema okna?',
    'Anička skáče přes švihadlo. | Skáče Anička přes švihadlo? | Skákej, Aničko, přes švihadlo! | Skáče Anička přes kaluž?',
    'Vojta staví hrad. | Staví Vojta hrad? | Stav, Vojto, hrad! | Staví Vojta most?',
    'Lucka uklízí pokoj. | Uklízí Lucka pokoj? | Uklízej, Lucko, pokoj! | Uklízí Lucka kuchyň?',
    'Dědeček sbírá houby. | Sbírá dědeček houby? | Sbírej, dědečku, houby! | Sbírá dědeček jahody?',
    'Kocour chytá myš. | Chytá kocour myš? | Chytej, kocoure, myš! | Chytá kocour ptáčka?',
    'Ptáček zpívá. | Zpívá ptáček? | Zpívej, ptáčku! | Spí ptáček?',
    'Honza pije čaj. | Pije Honza čaj? | Pij, Honzo, čaj! | Pije Honza mléko?',
  ],
  medium: [
    'Malý pes běžel přes zahradu. | Běžel malý pes přes zahradu? | Běž, pejsku, přes zahradu! | Běžel malý pes přes louku?',
    'Babička upekla buchty. | Upekla babička buchty? | Upeč, babičko, buchty. | Upekla babička bábovku?',
    'Děti šly do školy. | Šly děti do školy? | Jděte, děti, do školy! | Šly děti do kina?',
    'Tatínek opravil kolo. | Opravil tatínek kolo? | Oprav, tati, kolo. | Opravil tatínek auto?',
    'Kočka vyskočila na okno. | Vyskočila kočka na okno? | Vyskoč, kočičko, na okno! | Vyskočila kočka na stůl?',
    'Petr dostal novou knihu. | Dostal Petr novou knihu? | Přečti si, Petře, novou knihu. | Dostal Petr nové kolo?',
    'Maminka koupila mléko. | Koupila maminka mléko? | Kup, mami, mléko. | Koupila maminka chleba?',
    'Vlaštovky odletěly na jih. | Odletěly vlaštovky na jih? | Leťte, vlaštovky, na jih! | Odletěly vlaštovky na sever?',
    'Strýc jel vlakem do Prahy. | Jel strýc vlakem do Prahy? | Jeď, strýčku, vlakem do Prahy. | Jel strýc autem do Prahy?',
    'Rybář chytil velkého kapra. | Chytil rybář velkého kapra? | Chyť, rybáři, velkého kapra! | Chytil rybář malou rybku?',
    'Slepice snesla vajíčko. | Snesla slepice vajíčko? | Snes, slepičko, vajíčko! | Snesla slepice dvě vajíčka?',
    'Ondra hodil míč přes plot. | Hodil Ondra míč přes plot? | Hoď, Ondro, míč přes plot. | Hodil Ondra míč do okna?',
    'Dědeček vyprávěl pohádku. | Vyprávěl dědeček pohádku? | Vyprávěj, dědečku, pohádku! | Vyprávěl dědeček vtip?',
    'Sousedka zalila květiny. | Zalila sousedka květiny? | Zalij, sousedko, květiny. | Utrhla sousedka květiny?',
    'Vojta snědl celý koláč. | Snědl Vojta celý koláč? | Sněz, Vojto, celý koláč! | Snědl Vojta celou pizzu?',
    'Autobus zastavil u školy. | Zastavil autobus u školy? | Zastav, řidiči, u školy! | Zastavil autobus u obchodu?',
    'Holky skákaly přes švihadlo. | Skákaly holky přes švihadlo? | Skákejte, holky, přes švihadlo! | Skákaly holky přes kaluže?',
    'Brácha postavil věž z kostek. | Postavil brácha věž z kostek? | Postav, bráško, věž z kostek. | Postavil brácha věž z písku?',
    'Jirka ztratil klíče. | Ztratil Jirka klíče? | Najdi, Jirko, klíče! | Ztratil Jirka čepici?',
    'Kluci hráli fotbal na hřišti. | Hráli kluci fotbal na hřišti? | Hrajte, kluci, fotbal na hřišti. | Hráli kluci fotbal na zahradě?',
    'Eliška napsala dopis babičce. | Napsala Eliška dopis babičce? | Napiš, Eliško, dopis babičce! | Napsala Eliška dopis dědečkovi?',
    'Táta zatloukl hřebík. | Zatloukl táta hřebík? | Zatluč, tati, hřebík. | Vytáhl táta hřebík?',
  ],
  hard: [
    'Alžběta chce jít do kina. | Chce Alžběta jít do kina? | Pojď, Alžběto, do kina! | Chce Alžběta jít do divadla?',
    'Zítra budeme stavět bunkr. | Budeme zítra stavět bunkr? | Pojďme zítra stavět bunkr! | Budeme zítra stavět sněhuláka?',
    'Petr musí uklidit pokoj. | Musí Petr uklidit pokoj? | Ukliď, Petře, pokoj. | Musí Petr uklidit kuchyň?',
    'Po obědě půjdeme hrát kuličky. | Půjdeme po obědě hrát kuličky? | Pojďme po obědě hrát kuličky. | Půjdeme po obědě hrát fotbal?',
    'Tonda nemůže najít čepici. | Nemůže Tonda najít čepici? | Najdi, Tondo, čepici! | Nemůže Tonda najít rukavice?',
    'Ve škole budou psát diktát. | Budou ve škole psát diktát? | Pište, děti, diktát. | Budou ve škole psát písemku?',
    'Naše kočka umí otevřít dveře. | Umí naše kočka otevřít dveře? | Otevři, kočičko, dveře! | Umí naše kočka otevřít okno?',
    'Ema bude číst knihu o dinosaurech. | Bude Ema číst knihu o dinosaurech? | Čti, Emo, knihu o dinosaurech. | Bude Ema číst knihu o princeznách?',
    'Tatínek začal opravovat plot. | Začal tatínek opravovat plot? | Oprav, tati, plot. | Začal tatínek natírat plot?',
    'Mirunka nechtěla vstávat do školy. | Nechtěla Mirunka vstávat do školy? | Vstávej, Mirunko, do školy! | Nechtěla Mirunka jít do školy?',
    'Kamarádi budou čekat u školy. | Budou kamarádi čekat u školy? | Čekejte, kamarádi, u školy. | Budou kamarádi čekat u hřiště?',
    'Honza nesmí jíst bonbony před večeří. | Nesmí Honza jíst bonbony před večeří? | Nejez, Honzo, bonbony před večeří! | Nesmí Honza jíst bonbony po večeři?',
    'Kočka chtěla chytit motýla. | Chtěla kočka chytit motýla? | Chyť, kočičko, motýla! | Chtěla kočka chytit myš?',
    'Sestra bude slavit narozeniny. | Bude sestra slavit narozeniny? | Pozvi, sestřičko, kamarádky na narozeniny. | Bude sestra slavit svátek?',
    'Kluci neuměli postavit stan. | Neuměli kluci postavit stan? | Postavte, kluci, stan! | Neuměli kluci postavit bunkr?',
    'Celá rodina pojede k moři. | Pojede celá rodina k moři? | Jeďte všichni k moři! | Pojede celá rodina na hory?',
    'Slon dokáže nést těžký náklad. | Dokáže slon nést těžký náklad? | Nes, slone, těžký náklad. | Dokáže kůň nést těžký náklad?',
    'Brzy začne padat sníh. | Začne brzy padat sníh? | Padej, sněhu! | Začne brzy padat déšť?',
    'Lékař poradil mamince odpočívat. | Poradil lékař mamince odpočívat? | Odpočívej, maminko. | Poradil lékař mamince cvičit?',
    'Ptáci začali stavět hnízda. | Začali ptáci stavět hnízda? | Stavějte, ptáčci, hnízda! | Začali ptáci stavět budky?',
  ],
};

/* Věty jen pro „Urči druh věty“, které ze čtveřic nevyjdou: otázky
   s tázacím slovem, krátké rozkazy, všechny přací věty a na těžké úrovni
   pasti. Za `|` je volitelná poznámka do vysvětlení po chybě - u pasti
   řekne, proč to tak je. */
const EXTRA = {
  easy: {
    taz: [
      'Kde je máma?', 'Co děláš?', 'Kdo zvoní?', 'Jak se jmenuješ?',
      'Kolik je hodin?', 'Kam jdeš?', 'Proč pláčeš?', 'Kdy půjdeme ven?',
    ],
    roz: [
      'Zavři okno!', 'Pojď sem!', 'Nekřič!', 'Ukaž mi to!', 'Sedni si!', 'Umyj si ruce!',
    ],
    pra: [
      'Kéž by už byly prázdniny!', 'Ať se ti daří!', 'Hodně štěstí!', 'Ať je zítra hezky!',
      'Kéž by sněžilo!', 'Dobrou chuť!', 'Ať se brzy uzdravíš!', 'Krásné narozeniny!',
      'Kéž bych měla pejska!', 'Ať ti to ve škole jde!', 'Šťastnou cestu!', 'Dobrou noc!',
    ],
  },
  medium: {
    taz: [
      'Kdo snědl můj rohlík?', 'Kam jste dali míč?', 'Proč dnes nejdeš do školy?',
      'Kolik jablek je v košíku?', 'Kde jsi nechala aktovku?', 'Čím pojedeme na výlet?',
    ],
    roz: [
      'Podej mi, prosím, pastelku.', 'Zavři za sebou dveře.', 'Nezapomeň si svačinu.',
      'Pojďte všichni ke mně.', 'Nesahej na kamna!',
    ],
    pra: [
      'Kéž by už bylo léto.', 'Ať se vám výlet vydaří!', 'Ať tě nebolí bříško.',
      'Kéž by babička přijela na návštěvu!', 'Ať máš pěkné prázdniny!', 'Kéž by dnes nepršelo!',
      'Ať se ti dárek líbí!', 'Kéž by se nám podařilo vyhrát!', 'Ať se ti dobře spinká.',
      'Veselé Vánoce!', 'Kéž by kočička našla cestu domů!',
    ],
  },
  hard: {
    ozn: [
      'Nevím, kde je klíč.|Slovo **kde** tu není otázka. Věta se na nic neptá, jen oznamuje, že to nevím – a končí tečkou.',
      'Máma se ptala, kdo přišel.|Věta jen **vypráví**, že se máma ptala. Sama se neptá – a končí tečkou.',
      'Petr se zeptal, jestli může jít ven.|Věta jen **vypráví**, na co se Petr zeptal. Sama se neptá – a končí tečkou.',
      'Táta řekl, ať si uklidím.|Věta jen **vypráví**, co táta řekl. Sama nikomu nepřikazuje.',
      'Babička mi přeje hodně štěstí.|Věta jen **oznamuje**, co babička dělá. Sama nic nepřeje – a končí tečkou.',
      'Paní učitelka chce, abychom byli potichu.|Věta jen **oznamuje**, co paní učitelka chce. Sama nikomu nepřikazuje.',
    ],
    taz: [
      'A ty půjdeš s námi?|Ptá se, i když nezačíná slovem kdo nebo kde. Poznáš to podle **otazníku**.',
      'Ty už umíš plavat?|Ptá se, i když slova jdou jako v oznamovací větě. Poznáš to podle **otazníku**.',
      'Máma už přišla?|Ptá se, i když slova jdou jako v oznamovací větě. Poznáš to podle **otazníku**.',
      'Tohle je tvoje pastelka?|Ptá se, i když slova jdou jako v oznamovací větě. Poznáš to podle **otazníku**.',
      'Ten pes kouše?|Ptá se, i když slova jdou jako v oznamovací větě. Poznáš to podle **otazníku**.',
    ],
    roz: [
      'Řekni mi, kde bydlíš.|Je v ní slovo **kde**, ale věta se neptá – říká, ať mi to řekneš. Proto je rozkazovací.',
      'Zeptej se paní učitelky, kdy pojedeme.|Je v ní slovo **kdy**, ale věta se neptá – říká, ať se zeptáš. Proto je rozkazovací.',
      'Vezmi si bundu, venku je zima.|Věta říká, **ať si vezmeš bundu**. Proto je rozkazovací, i když končí tečkou.',
      'Pojďme si hrát na schovávanou.|Rozkazovat se dá i všem naráz, včetně sebe: **pojďme**.',
      'Nezapomeňte si zítra pastelky.|Věta říká, **ať nezapomenete**. Proto je rozkazovací, i když končí tečkou.',
      'Buď hodná na sestru.|Věta říká, **ať jsi hodná**. Proto je rozkazovací, i když končí tečkou.',
    ],
    pra: [
      'Kéž by se táta brzy vrátil.', 'Ať se ti zítra test povede.', 'Kéž bychom vyhráli!',
      'Ať vám to spolu dlouho vydrží!', 'Kéž by už bylo ráno.', 'Ať se ti splní všechna přání!',
      'Kéž bych uměla létat!', 'Ať tě nic nebolí.', 'Kéž by sníh vydržel až do Vánoc!',
      'Ať se máte na horách krásně!',
    ],
  },
};

const splitAsk = (line) => {
  const [ozn, taz, roz, jinak] = line.split(' | ');
  return { ozn, taz, roz, jinak };
};

/* Všechny věty pro „Urči druh věty“ na dané úrovni. `base` spojuje věty
   z téže čtveřice, aby v jednom kole nepadlo „Pes štěká.“ i „Štěká pes?“. */
function typePool(level) {
  const pool = [];
  ASK[level].forEach((line, i) => {
    const q = splitAsk(line);
    for (const type of ['ozn', 'taz', 'roz']) pool.push({ text: q[type], type, note: '', base: `a${i}` });
  });
  for (const [type, list] of Object.entries(EXTRA[level])) {
    list.forEach((src, i) => {
      const [text, note = ''] = src.split('|');
      pool.push({ text, type, note, base: `${type}${i}` });
    });
  }
  return pool;
}

/* `n` položek z `keys`, rozdělených co nejrovnoměrněji, zamíchaných. */
const spread = (keys, n) => shuffle(Array.from({ length: n }, (_, i) => keys[i % keys.length]));

/* Otázka bez otazníku - typická chyba. */
const withDot = (q) => q.replace(/\?$/, '.');

/* Špatné možnosti podle úrovně. Na lehké je rozkaz poznat od oka, na
   těžké jsou obě špatné možnosti hodně podobné správné. */
const ASK_WRONG = {
  easy: ['roz', 'dot'],
  medium: ['dot', 'jinak'],
  hard: ['dot', 'jinak', 'roz'],
};

function askOptions(q, level) {
  const wrong = {
    dot: { text: withDot(q.taz), tag: 'vetyMark' },
    roz: { text: q.roz, tag: 'vetyType' },
    jinak: { text: q.jinak, tag: 'vetyChange' },
  };
  return shuffle([
    { text: q.taz, ok: true, tag: null },
    ...ASK_WRONG[level].map((k) => ({ ...wrong[k], ok: false })),
  ]);
}

/* Jedno kolo: `count` vět. Úlohy (určit druh / udělat otázku) se rozdělí
   půl na půl a u určování se i druhy vět rozdělí rovnoměrně - jinak by
   z pěti vět mohly vyjít čtyři oznamovací. Pořadí možností se losuje
   tady, ne při vykreslení: obrazovka se po klepnutí překresluje. */
export function makeVetyRound(levelKey = 'easy', tasks = ['type', 'ask'], count = 10) {
  const level = VETY_LEVELS[levelKey] ? levelKey : 'easy';
  const n = VETY_COUNTS.includes(count) ? count : VETY_COUNTS[1];
  const use = tasks.filter((t) => t in VETY_TASKS);
  const plan = spread(use.length ? use : ['type'], n);

  const usedBase = new Set();
  const askQueue = shuffle(ASK[level].map((line, i) => ({ ...splitAsk(line), base: `a${i}` })));
  const typeTargets = spread(VETY_TYPE_KEYS, plan.filter((t) => t === 'type').length);
  const pool = shuffle(typePool(level));

  return plan.map((task) => {
    if (task === 'ask') {
      const q = askQueue.find((x) => !usedBase.has(x.base)) || askQueue[0];
      usedBase.add(q.base);
      return {
        level, task, text: q.ozn, answer: q.taz, options: askOptions(q, level), note: '',
        key: `ask|${q.ozn}`,
      };
    }
    const type = typeTargets.pop();
    const pick = pool.find((p) => p.type === type && !usedBase.has(p.base))
      || pool.find((p) => !usedBase.has(p.base));
    usedBase.add(pick.base);
    return {
      level, task, text: pick.text, answer: pick.type, note: pick.note,
      options: VETY_TYPE_KEYS.map((k) => ({ text: VETY_TYPES[k].label, key: k, ok: k === pick.type, tag: 'vetyType' })),
      key: `type|${pick.text}`,
    };
  });
}

/* Kroky vysvětlení po chybě, **tučné** převádí app.js na <b>. */
export function vetyExplain(ex) {
  if (ex.task === 'ask') {
    return [
      'Z oznamovací věty uděláš tázací takhle: slovo, které říká, **co se děje**, dáš dopředu a na konec napíšeš **otazník**.',
      'Otázka se ptá na **totéž**, co říká věta – žádné jiné slovo se nemění.',
      `${ex.text} → **${ex.answer}**`,
    ];
  }
  const type = VETY_TYPES[ex.answer];
  const steps = [type.rule];
  if (ex.note) steps.push(ex.note);
  steps.push(`Věta „${ex.text}“ je **${type.label}**.`);
  return steps;
}

export function vetyText(ex, reveal) {
  if (!reveal) return ex.text;
  return ex.task === 'ask' ? `${ex.text} → ${ex.answer}` : `${ex.text} → ${VETY_TYPES[ex.answer].label}`;
}
