import { shuffle } from './random.js';

/* ============================================================
   Slovní druhy

   Dítě dostane větu a klepne v ní na všechna slovesa (nebo na všechna
   podstatná jména). Každá věta se ptá na jeden druh; když jsou zapnuté
   oba, losuje se u každé věty zvlášť.

   Věty se NEGENERUJÍ - jsou ručně sepsané a ručně určené. Skládání vět
   ze šablon by v češtině dávalo kostrbaté tvary a automatické určování
   slovních druhů se plete. Zápis jedné věty:

       '*Kočka ^pije *mléko.'      * = podstatné jméno, ^ = sloveso

   Každá věta má určené OBA druhy, takže se dá použít na kterýkoli z nich.

   Na co si dát při doplňování pozor (ať se dítěti nevyčítá chyba,
   kterou neudělalo):
   - žádná zvratná slovesa (`se`, `si`) - jestli patří ke slovesu, by se
     muselo vysvětlovat,
   - žádný minulý čas v 1. a 2. osobě (`jsem šla`) ani podmiňovací způsob
     (`by`), stejný důvod,
   - žádná slova, která jsou podle věty jednou podstatné jméno a jednou
     příslovce (`ráno`, `večer`, `doma`),
   - složené tvary (`budeme stavět`, `chce jít`) mají slovesa OBĚ slova.
   ============================================================ */

export const POS_TYPES = {
  noun: {
    label: 'Podstatná jména', emoji: '🧸', find: 'Najdi podstatná jména',
    one: 'podstatné jméno', acc: 'podstatná jména', gen: 'podstatných jmen',
  },
  verb: {
    label: 'Slovesa', emoji: '🏃', find: 'Najdi slovesa',
    one: 'sloveso', acc: 'slovesa', gen: 'sloves',
  },
};
export const POS_TYPE_KEYS = Object.keys(POS_TYPES);

export const POS_COUNTS = [5, 10, 15];

export const POS_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'krátké věty, kdo a co dělá' },
  medium: { label: 'Střední', emoji: '🟡', note: 'delší věty a minulý čas, hledaných slov je víc' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'pasti jako „chce jít“, „budeme stavět“, „plavání“ nebo „zpěv“' },
};
export const POS_LEVEL_KEYS = Object.keys(POS_LEVELS);

/* Krátké věty: kdo + co dělá (+ co / kde). Přítomný čas, jasná slova. */
const EASY = [
  '*Pes ^štěká.',
  '*Kočka ^spí.',
  '*Ptáček ^zpívá.',
  '*Slunce ^svítí.',
  '*Ryba ^plave.',
  '*Vlak ^jede.',
  '*Sova ^houká.',
  '*Kohout ^kokrhá.',
  '*Tygr ^řve.',
  '*Vítr ^fouká.',
  '*Strom ^roste.',
  '*Sníh ^padá.',
  '*Moucha ^letí.',
  '*Miminko ^pláče.',
  '*Zvonek ^zvoní.',
  '*Hodiny ^tikají.',
  '*Máma ^vaří *polévku.',
  '*Táta ^čte *noviny.',
  '*Eva ^kreslí *koně.',
  '*Babička ^peče *koláč.',
  '*Kráva ^žere *trávu.',
  '*Holčička ^nese *panenku.',
  '*Pejsek ^hryže *kost.',
  '*Myš ^jí *sýr.',
  '*Bratr ^píše *úkol.',
  '*Sestra ^zalévá *kytky.',
  '*Učitelka ^čte *pohádku.',
  '*Medvěd ^loví *ryby.',
  '*Zajíc ^hryže *mrkev.',
  '*Kočka ^pije *mléko.',
  '*Děti ^staví *hrad.',
  '*Petr ^má *kolo.',
  '*Anna ^jí *jablko.',
  '*Alžběta ^počítá *příklady.',
  '*Hasič ^hasí *oheň.',
  '*Pekař ^peče *chleba.',
  '*Kuře ^zobe *zrní.',
  '*Tomáš ^hraje *fotbal.',
  '*Dědeček ^sbírá *houby.',
  '*Máma ^věší *prádlo.',
  '*Pták ^staví *hnízdo.',
  '*Veverka ^schovává *oříšky.',
  '*Jana ^nosí *brýle.',
  '*Kocour ^chytá *myš.',
  '*Pes ^hlídá *dům.',
  '*Ježek ^nese *jablko.',
  '*Teta ^šije *šaty.',
  '*Lékař ^léčí *děti.',
  '*Řidič ^řídí *autobus.',
  '*Klaun ^dělá *legraci.',
  '*Dědeček ^sedí na *lavičce.',
  '*Kůň ^běží po *louce.',
  '*Žába ^skáče do *vody.',
  '*Auto ^stojí u *domu.',
  '*Kluk ^kope do *míče.',
  '*Liška ^běží *lesem.',
  '*Kachna ^plave na *rybníku.',
  '*Lev ^spí pod *stromem.',
  '*Opice ^leze na *strom.',
  '*Holub ^sedí na *střeše.',
];

/* Delší věty, minulý čas (jen 3. osoba - bez `jsem`), víc podstatných jmen
   i sloves, přídavná jména a předložky jako slova navíc. */
const MEDIUM = [
  'Malý *pes ^běžel přes *zahradu.',
  'Včera ^pršelo celý *den.',
  '*Babička ^upekla pro *vnučku *buchty.',
  '*Alžběta ^nakreslila velkého *slona.',
  '*Děti ^šly do *školy a ^zpívaly.',
  'Na *stole ^leží červené *jablko.',
  '*Tatínek ^opravil *kolo a ^umyl *auto.',
  'V *lese ^rostou *houby i *borůvky.',
  '*Kočka ^vyskočila na *okno.',
  '*Petr ^dostal k *narozeninám *knihu.',
  '*Maminka ^koupila *mléko a *chleba.',
  'Za *domem ^teče malá *řeka.',
  '*Alička ^má novou *aktovku.',
  '*Vlaštovky ^odletěly na *jih.',
  '*Strýc ^jel *vlakem do *Prahy.',
  '*Kamarádka ^půjčila *Evě *pastelky.',
  'Venku ^je *zima a ^fouká *vítr.',
  '*Psík ^štěkal na *pošťáka.',
  '*Rybář ^chytil velkého *kapra.',
  '*Žáci ^píšou do *sešitů.',
  'Na *louce ^kvetou *kopretiny.',
  '*Slepice ^snesla *vajíčko.',
  '*Ondra ^hodil *míč přes *plot.',
  '*Dědeček ^vyprávěl *pohádku o *drakovi.',
  '*Ptáci ^sedí na *drátech.',
  'V *zimě ^stavíme *sněhuláka.',
  '*Medvěd ^spí celou *zimu v *brlohu.',
  '*Sousedka ^zalila *květiny na *balkoně.',
  '*Vojta ^snědl celý *koláč.',
  '*Kuchař ^vaří *oběd pro *děti.',
  '*Autobus ^zastavil u *školy.',
  '*Lucie ^zpívá ve *sboru.',
  'Malá *myška ^utekla do *díry.',
  '*Holky ^skákaly přes *švihadlo.',
  '*Měsíc ^svítí na *nebi.',
  '*Brácha ^postavil z *kostek *věž.',
  '*Jirka ^ztratil *klíče od *domu.',
  '*Pavouk ^upletl *síť.',
  'Na *rybníku ^plavou *labutě.',
  '*Teta ^přinesla *dárky pro *děti.',
  '*Kluci ^hráli *fotbal na *hřišti.',
  '*Kocour ^ležel na *gauči a ^předl.',
  '*Mamka ^uklízí *kuchyň.',
  '*Slunce ^zapadlo za *kopec.',
  '*Farmář ^krmí *prasata a *slepice.',
  '*Eliška ^napsala *dopis *babičce.',
  'Ve *třídě ^visí *mapa.',
  '*Bouřka ^přišla v *noci.',
  '*Pes ^vrtí *ocasem.',
  '*Princezna ^bydlí na *zámku.',
  '*Kominík ^čistí *komín.',
  '*Šnek ^leze pomalu po *listu.',
  '*Táta ^zatloukl *hřebík *kladivem.',
  '*Děti ^pouštějí *draka.',
  '*Zahradník ^stříhá *keře.',
  '*Kamarádi ^jeli na *výlet.',
  '*Kapr ^plave v *kádi.',
  '*Sova ^sedí v *dutině *stromu.',
];

/* Pasti: neurčitek a složené tvary (obě slova jsou sloveso), podstatná
   jména, která znamenají činnost (plavání, zpěv, běh), zájmena, přídavná
   jména a `ráda`, které vypadá jako sloveso, ale není. */
const HARD = [
  '*Alžběta ^chce ^jít do *kina.',
  '*Plavání ^je zdravé.',
  'Zítra ^budeme ^stavět *bunkr.',
  '*Zpěv *ptáků ^zní *lesem.',
  '*Petr ^musí ^uklidit *pokoj.',
  '*Běh ^je můj oblíbený *sport.',
  '*Mamka nás ^učí ^plavat.',
  '*Smích *dětí ^byl ^slyšet až na *ulici.',
  'Po *obědě ^půjdeme ^hrát *kuličky.',
  '*Babička ráda ^peče *bábovku.',
  '*Skok do *vody ^byl odvážný.',
  '*Kreslení ji moc ^baví.',
  '*Tonda ^nemůže ^najít svou *čepici.',
  'Ve *škole ^budou ^psát *diktát.',
  '*Hra s *míčem ^trvala dlouho.',
  'Naše *kočka ^umí ^otevřít *dveře.',
  '*Ryby ^nemohou ^dýchat na *suchu.',
  '*Večeře ^bude za *chvíli.',
  '*Učitelka ^dovolila *dětem ^jít ven.',
  '*Pomoc *kamarádovi ^je důležitá.',
  '*Jízda na *kole ji ^bavila.',
  '*Kuba ^dostal *chuť na *zmrzlinu.',
  'Dnes ^budu ^číst *knihu o *dinosaurech.',
  '*Tatínek ^začal ^opravovat *plot.',
  '*Let *letadlem ^trval dvě *hodiny.',
  '*Hledání *pokladu ^bylo napínavé.',
  '*Pes ^přestal ^štěkat.',
  '*Mirunka ^nechtěla ^vstávat do *školy.',
  '*Vaření s *babičkou ^je *zábava.',
  '*Dědeček ^potřebuje nové *brýle.',
  '*Lyžování na *horách ^bylo skvělé.',
  '*Kamarádi ^budou ^čekat u *školy.',
  '*Úkol z *češtiny ^byl lehký.',
  '*Ptáci ^začali ^stavět *hnízda.',
  '*Psaní *dopisů ^dá *práci.',
  '*Malování *obrázků ji ^těší.',
  '*Honza ^nesmí ^jíst *bonbony před *večeří.',
  '*Kočka ^chtěla ^chytit *motýla.',
  'Její *radost ^byla veliká.',
  'Celá *rodina ^pojede k *moři.',
  '*Strach ze *tmy ^má *Vašek.',
  '*Ježek ^musel ^přežít *zimu.',
  '*Čtení ^pomáhá ^poznávat *svět.',
  'Brzy ^začne ^padat *sníh.',
  '*Slon ^dokáže ^nést těžký *náklad.',
  '*Zvonění *budíku ^vzbudilo celý *dům.',
  '*Sestra ^bude ^slavit *narozeniny.',
  '*Myšlenka na *prázdniny ji ^potěšila.',
  '*Lékař ^poradil *mamince ^odpočívat.',
  '*Výlet do *zoo ^byl nejlepší.',
  '*Kluci ^neuměli ^postavit *stan.',
  '*Dárek pro *maminku ^budeme ^balit spolu.',
  '*Pomeranč ^chutná sladce.',
  'Naše *třída ^pojede na *výlet.',
];

export const POS_SENTENCES = { easy: EASY, medium: MEDIUM, hard: HARD };

/* Rozloží zapsanou větu na slova a určení. Interpunkce zůstává u slova,
   na které se klepe (`mléko.`), do výpisů se ale bere bez ní. */
export function parseSentence(src) {
  const words = [];
  const noun = [];
  const verb = [];
  src.split(' ').forEach((token, i) => {
    if (token.startsWith('*')) noun.push(i);
    else if (token.startsWith('^')) verb.push(i);
    words.push(token.replace(/^[*^]/, ''));
  });
  return { words, noun, verb };
}

/* Slovo bez interpunkce - do vysvětlení a do výpisu chyb. */
export const bareWord = (w) => w.replace(/[.,!?;:]+$/, '');

/* Druhy, na které se bude kolo ptát: půl na půl, zamíchané. Kdyby se
   druh losoval u každé věty zvlášť, mohlo by z deseti vět vyjít devět
   na slovesa. */
function targetsFor(types, n) {
  const list = types.filter((t) => t in POS_TYPES);
  const use = list.length ? list : ['verb'];
  return shuffle(Array.from({ length: n }, (_, i) => use[i % use.length]));
}

/* Jedno kolo: `count` různých vět z dané úrovně. Zásoba má na každé úrovni
   přes padesát vět, takže se v kole nic neopakuje. */
export function makePosRound(levelKey = 'easy', types = ['verb'], count = 10) {
  const level = POS_LEVELS[levelKey] ? levelKey : 'easy';
  const n = POS_COUNTS.includes(count) ? count : POS_COUNTS[1];
  const pool = shuffle(POS_SENTENCES[level]).slice(0, n);
  const targets = targetsFor(types, pool.length);
  return pool.map((src, i) => {
    const p = parseSentence(src);
    const target = targets[i];
    return {
      level,
      target,
      words: p.words,
      noun: p.noun,
      verb: p.verb,
      marks: p[target],
      key: `${target}|${src}`,
    };
  });
}

/* Hledaná slova bez interpunkce, v pořadí ve větě. */
export const posAnswer = (ex) => ex.marks.map((i) => bareWord(ex.words[i])).join(', ');

/* Které slovo je ve větě špatně: označená slova navíc a přehlédnutá.
   `picked` jsou indexy slov, na která dítě klepnulo. */
export function posCheck(ex, picked) {
  const want = new Set(ex.marks);
  const have = new Set(picked);
  return {
    extra: [...have].filter((i) => !want.has(i)).sort((x, y) => x - y),
    missed: ex.marks.filter((i) => !have.has(i)),
  };
}

/* Tag chyby do statistiky. Záměna druhů je nejčastější a nejvíc o ní
   řekne: dítě vybralo podstatné jméno, když hledalo slovesa (nebo naopak). */
export function posTag(ex, picked) {
  const { extra, missed } = posCheck(ex, picked);
  const other = ex.target === 'verb' ? ex.noun : ex.verb;
  if (extra.some((i) => other.includes(i))) return 'posSwap';
  if (extra.length) return 'posExtra';
  return missed.length ? 'posMissed' : null;
}

export function posExplain(ex) {
  const found = ex.marks.map((i) => `**${bareWord(ex.words[i])}**`).join(', ');
  if (ex.target === 'verb') {
    const steps = [
      'Sloveso říká, **co kdo dělá** nebo co se děje. Zeptej se: Co dělá?',
    ];
    if (ex.level === 'hard') {
      steps.push('Slovesem je i slovo, které končí na **-t** (hrát, jít, psát), a taky bude, budeme, je, byl.');
    }
    steps.push(`Slovesa v téhle větě: ${found}.`);
    return steps;
  }
  const steps = [
    'Podstatné jméno je **osoba, zvíře, věc nebo místo** – a taky jméno, třeba Eva nebo Praha.',
    'Zkus před slovo říct **ten, ta, to**: ten pes, ta kočka, to auto.',
  ];
  if (ex.level === 'hard') {
    steps.push('Podstatným jménem je i činnost nebo pocit, když před ně jde říct ten, ta, to: to plavání, ten zpěv, ta radost.');
  }
  steps.push(`Podstatná jména v téhle větě: ${found}.`);
  return steps;
}

export function posText(ex, reveal) {
  const sentence = ex.words.join(' ');
  return reveal ? `${sentence} → ${posAnswer(ex)}` : sentence;
}
