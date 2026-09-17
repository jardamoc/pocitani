import { ALL_IDS, CATEGORIES, CATEGORY_ORDER, ITEM_BY_ID, UNKNOWN_NAME } from './rewards-data.js';
import { wholeNumber, textList } from './validate.js';

/* Logika odmen. Cisty modul bez DOM - vsechno se da spustit i v Node, takze
 * vyhodnoceni je testovatelne. Nahodny je jedine vyber konkretni postavicky
 * v dosazene kategorii; generator nahody je proto parametr, ne Math.random
 * zadratovany uvnitr.
 *
 * Zavislosti: rewards-data.js -> TENHLE MODUL -> rewards-ui.js -> app.js
 */

export const STORAGE_KEY = 'pocitani.rewards.v1';
export const DATA_VERSION = 1;

/* ---------------- konfigurace pravidel ----------------
 * Vsechny hranice odmen jsou tady, na jednom miste. Zadne cislo z tehle
 * tabulky nesmi byt zapsane jeste nekde jinde v kodu.
 *
 * ZAKLADNI PRINCIP: za jedno kolo padne nejvys JEDEN dumpling. Nerozhoduje
 * se o poctu kusu, ale o tom, jak vzacny dumpling to bude. Vzacnost se
 * NESCITA z bodu - bere se nejvyssi splnena podminka zebricku:
 *
 *   Zakladni   bezchybna sada, prumer nad 15 s na ulohu
 *   Neobvykly  bezchybna sada, prumer pod 15 s
 *   Raritni    pod 15 s a k tomu vyssi slozitost (ulohy navic, tezka uroven)
 *   Epicky     vic nez 50 prikladu za dnesek, NEBO pod 15 s pri rozsahu 30 a vys
 *   Legendarni bezchybna sada aspon v peti ze sedmi poslednich dnu
 *
 * Drive se stupne scitaly a zakladem byl rozsah - "do 20" tim pridavalo stupen
 * samo o sobe a na Zakladniho se nedalo dostat. Scitani uz nevracej.
 *
 * Objem je tam schvalne jako druha cesta k epickemu: do 100 se rychle pocitat
 * nenaucis, ale vytrvalost se ma ocenit stejne.
 *
 * POZOR na rychlost: porovnava se cas cele sady proti jejimu casovemu
 * ROZPOCTU. Kazda uloha si do nej prispeje vlastnim pridelem podle druhu -
 * slovni uloha se musi nejdriv precist, mrizka je devet kolecek naraz.
 * Pocitat jeden prumer na celou sadu a roztahovat ho jen podle rezimu
 * nestaci: v rezimu Pocitani je v sade nekolik slovnich uloh mezi beznymi
 * priklady, takze delsi cas jedne ulohy se v prumeru zase rozredi a dite
 * na tom prodela. */
export const REWARD_RULES = {
  /* Kolo s chybou neprinese nic - bezchybnost je podminkou vseho. */
  requirePerfectSet: true,
  maxRewardsPerGame: 1,

  /* Hranice rychlosti - sekundy na jeden bezny priklad. */
  fastSeconds: 15,
  /* Kolik beznych prikladu jedna uloha vydá. Nasobek se pricita za KAZDOU
     ulohu zvlast, ne az na hotovy prumer - jedna slovni uloha v sade tak
     opravdu prida cas na tri priklady. Drz cela cisla, nasobek se zobrazuje
     v navodu a desetinne cislo do textu pro dite nepatri. */
  speedKindMultiplier: { equation: 1, word: 3, bond: 2, sign: 2, compare: 1, over10: 2, riddle: 3, grid: 4, pexeso: 6 },
  speedLevelMultiplier: { easy: 1, medium: 1.3, hard: 1.7 },

  /* Rezim "Najdi dvojice" (vnitrni klic `pexeso`): karticky jsou vsechny
     vidma, takze spatne spojeni neni odhad jako u pametove hry, ale skutecne
     spatne spocitany priklad. Hranice je proto prisna - jedno prehlednuti
     odpustime, na tezke plose o deseti dvojicich dve. Meni se JEN tady;
     navod v popupu se z toho generuje sam. */
  pexesoMismatchAllowance: { easy: 1, medium: 1, hard: 2 },

  /* Epicky: bud hodne spocitanych prikladu za dnesek (podminka je "vic nez"),
     nebo rychle a k tomu velka cisla. */
  epicDailyCorrect: 50,
  epicMinRange: 30,

  /* Vykonem se da dojit nejvys k epickemu. Legendarni je jen za pravidelnost. */
  maxPerformanceTier: 3,

  legendaryActiveDaysRequired: 5,
  legendaryWindowDays: 7,
  /* Ochrana proti posunuti systemovych hodin: novy procvicovaci den se zapise
     az po dvou skutecnych hodinach od posledni aktualizace. Pretoceni data
     dopredu tak neumi vyrobit pet "aktivnich dnu" za minutu. */
  minHoursBetweenPracticeDays: 2,
};

/* Poradi kategorii podle vzacnosti - index je stupen (tier). */
export const TIERS = ['basic', 'uncommon', 'rare', 'epic', 'legendary'];

/* ---------------- kalendarni dny ---------------- */

/* Mistni kalendarni datum, ne rozdil 24 hodin - pulnoc deli dny i kdyz je
   mezi dvema koly jen deset minut. */
export function localDateKey(ts = Date.now()) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* Poradove cislo dne, aby sel spocitat rozdil dvou datumu bez casovych pasem. */
function dayNumber(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/* ---------------- ulozena data ---------------- */

export function emptyData() {
  const rewardInventory = {};
  for (const id of ALL_IDS) rewardInventory[id] = 0;
  return {
    version: DATA_VERSION,
    rewardInventory,
    totalCorrectAnswers: 0,
    /* Denni objem - kolik spravnych prikladu padlo dnes. Slouzi k bonusu za
       vytrvalost, proto se pri zmene kalendarniho dne nuluje. */
    dailyDate: null,
    dailyCorrect: 0,
    completedSets: 0,
    perfectSets: 0,
    activePracticeDates: [],
    legendaryDaysUsed: [],
    processedGameIds: [],
    completedMilestones: [],
    newRewardIds: [],
    ultimateRuns: 0,
    lastUpdated: null,
    lastUpdatedMs: 0,
  };
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/* `wholeNumber` a `textList` sdili tenhle modul se stats.js - jsou ve
   validate.js, aby nikde nevznikly dve rozchazejici se kopie. */

/* Kazde pole se validuje zvlast, aby jedna poskozena polozka nevzala ostatni
   platna data. Neznama nebo nesmyslna hodnota spadne na vychozi. */
export function sanitize(raw) {
  const data = emptyData();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return data;

  const inventory = raw.rewardInventory;
  if (inventory && typeof inventory === 'object' && !Array.isArray(inventory)) {
    // projdeme znama id, ne klice z ulozeni - cizi klic se tim proste zahodi
    for (const id of ALL_IDS) data.rewardInventory[id] = wholeNumber(inventory[id]);
  }

  data.totalCorrectAnswers = wholeNumber(raw.totalCorrectAnswers);
  data.dailyDate = DATE_RE.test(raw.dailyDate || '') ? raw.dailyDate : null;
  data.dailyCorrect = data.dailyDate ? wholeNumber(raw.dailyCorrect) : 0;
  data.completedSets = wholeNumber(raw.completedSets);
  data.perfectSets = wholeNumber(raw.perfectSets);
  data.ultimateRuns = wholeNumber(raw.ultimateRuns);

  data.activePracticeDates = textList(raw.activePracticeDates, (x) => DATE_RE.test(x), 120).sort();
  data.legendaryDaysUsed = textList(raw.legendaryDaysUsed, (x) => DATE_RE.test(x), 120).sort();
  data.processedGameIds = textList(raw.processedGameIds, (x) => x.length > 0 && x.length <= 64, 50);
  data.completedMilestones = textList(raw.completedMilestones, (x) => x.length > 0 && x.length <= 64, 400);
  data.newRewardIds = textList(raw.newRewardIds, (x) => ITEM_BY_ID.has(x), 40);

  data.lastUpdated = typeof raw.lastUpdated === 'string' ? raw.lastUpdated : null;
  data.lastUpdatedMs = wholeNumber(raw.lastUpdatedMs);
  return data;
}

/* Cteni ani zapis tady uz nejsou - oboji obstarava storage.js, ktery si
   `sanitize()` a `emptyData()` odsud zavola. Modul tim zustava cisty:
   zadny DOM, zadne uloziste, cela logika spustitelna v Node. */

/* ---------------- odvozena obtiznost ---------------- */

/* Rezimy hadanky a mrizka maji obtiznost primo v nastaveni. Rezim "pocitani"
   zadnou nema, takze ji odvodime z toho, co ma dite zapnute - odmena pak
   odpovida skutecne narocnosti prikladu. */
export function difficultyOf(config) {
  if (!config) return 'easy';
  if (config.mode && config.mode !== 'calc') {
    return ['easy', 'medium', 'hard'].includes(config.level) ? config.level : 'easy';
  }
  const ops = Array.isArray(config.ops) ? config.ops : [];
  const kinds = Array.isArray(config.kinds) ? config.kinds : [];
  const hasDiv = ops.includes('div');
  const hasMul = ops.includes('mul');
  if (hasDiv || (hasMul && kinds.length)) return 'hard';
  if (hasMul || kinds.length) return 'medium';
  return 'easy';
}

/* 'hard' je zaroven nejtezsi dostupna uroven. */
export const TOP_LEVEL = 'hard';

/* ---------------- jednotlive kategorie ---------------- */

/* Kolik beznych prikladu vyda jedna uloha daneho druhu. */
const kindWeight = (kind) => REWARD_RULES.speedKindMultiplier[kind] ?? 1;

/* Druh, kterym nahradime ulohy bez rozpisu - stara ulozena data i souhrn,
   ktery `kindCounts` neposlal. */
const DEFAULT_KIND_BY_MODE = { riddle: 'riddle', grid: 'grid', over10: 'over10', pexeso: 'pexeso' };
const defaultKind = (mode) => DEFAULT_KIND_BY_MODE[mode] || 'equation';

/* Casovy rozpocet cele sady v sekundach. Kazda uloha si prispeje vlastnim
   pridelem podle druhu, takze slovni uloha mezi beznymi priklady rozpocet
   opravdu zvedne - kdybychom roztahovali az hotovy prumer, delsi cas te jedne
   ulohy by se mezi ostatni rozredil. */
export function speedBudget(summary) {
  const total = Math.max(0, Math.floor(summary.total || 0));
  const byLevel = REWARD_RULES.speedLevelMultiplier[summary.level] ?? 1;
  const counts = summary.kindCounts && typeof summary.kindCounts === 'object' ? summary.kindCounts : {};

  let zbyva = total;
  let jednotek = 0;
  for (const [kind, pocet] of Object.entries(counts)) {
    const n = Math.min(zbyva, Math.max(0, Math.floor(Number(pocet) || 0)));
    jednotek += n * kindWeight(kind);
    zbyva -= n;
  }
  jednotek += zbyva * kindWeight(defaultKind(summary.mode));

  return REWARD_RULES.fastSeconds * byLevel * jednotek;
}

/* Prumerny pridel na jednu ulohu - jen do textu, aby dite vedelo, o jaky cas
   slo. U sady ze samych beznych prikladu vyjde presne `fastSeconds`. */
export const speedLimitPerExercise = (summary) => {
  const total = Math.max(0, Math.floor(summary.total || 0));
  return total ? speedBudget(summary) / total : REWARD_RULES.fastSeconds;
};

/* Vesla se cela sada do sveho rozpoctu? Bez zmereneho casu vracime false -
   chybejici udaj nesmi vyrobit bonus. */
export function isFast(summary) {
  const total = Math.max(0, Math.floor(summary.total || 0));
  const solveMs = Number(summary.solveMs);
  if (!total || !Number.isFinite(solveMs) || solveMs <= 0) return false;

  return solveMs / 1000 < speedBudget(summary);
}

/* Vzacnost dumplinga za jedno kolo. Vraci stupen 0-3 (zakladni az epicky)
   a rozpis, z ceho vysel - z nej se pak sklada cesky duvod.

   `extras` je pocet zapnutych druhu navic (slovni ulohy, pyramidy, znamenka).
   Tezka uroven se pocita jako totez, aby Raritni sel ziskat i v hadankach
   a mrizkach, kde zadne "neco navic" neni. */
export function performanceTier(summary, dailyCorrect) {
  const fast = isFast(summary);
  const extras = Number(summary.extras) > 0 || summary.level === TOP_LEVEL;
  const bigRange = Math.max(0, Math.floor(Number(summary.max) || 0)) >= REWARD_RULES.epicMinRange;
  const bigVolume = dailyCorrect > REWARD_RULES.epicDailyCorrect;

  let tier = 0;
  if (bigVolume || (fast && bigRange)) tier = 3;
  else if (fast && extras) tier = 2;
  else if (fast) tier = 1;

  return {
    tier: Math.min(REWARD_RULES.maxPerformanceTier, tier),
    fast,
    extras,
    bigRange,
    bigVolume,
  };
}

/* Nazev jedne ulohy podle rezimu - do vety o rychlosti. */
const UNIT_BY_MODE = { riddle: 'hádanku', grid: 'mřížku', over10: 'rozklad', pexeso: 'celou plochu' };
const unitName = (mode) => UNIT_BY_MODE[mode] || 'příklad';

/* Cesky duvod: rekne presne tu podminku, ktera dumplinga vynesla nejvys. */
function reasonFor(parts, summary, dailyCorrect) {
  const rychle = `rychleji než ${Math.round(speedLimitPerExercise(summary))} s na ${unitName(summary.mode)}`;

  if (parts.bigVolume) return `Za sadu bez chyby a ${dailyCorrect} spočítaných příkladů za dnešek`;
  if (parts.fast && parts.bigRange) return `Za sadu bez chyby ${rychle}, a k tomu do ${summary.max}`;
  if (parts.fast && parts.extras) return `Za sadu bez chyby ${rychle}, a k tomu z těžších úloh`;
  if (parts.fast) return `Za sadu bez chyby ${rychle}`;
  return `Za počítání do ${summary.max} bez jediné chyby`;
}

/* ---------------- ferovy vyber postavicky ---------------- */

/* Nejdriv se losuje ze seznamu dosud neziskanych postavicek dane kategorie.
   Teprve kdyz uz dite vlastni vsech osm, muze dostat duplikat. */
export function pickDumpling(category, inventory, rng = Math.random) {
  const ids = (CATEGORIES[category]?.items ?? []).map((item) => item.id);
  if (!ids.length) return null;
  const fresh = ids.filter((id) => !(inventory?.[id] > 0));
  const pool = fresh.length ? fresh : ids;
  const roll = Number(rng());
  const index = Number.isFinite(roll) ? Math.floor(roll * pool.length) : 0;
  return pool[Math.min(pool.length - 1, Math.max(0, index))];
}

/* ---------------- procvicovaci dny ---------------- */

function addPracticeDate(data, dateKey, nowMs) {
  if (data.activePracticeDates.includes(dateKey)) return;

  const newest = data.activePracticeDates[data.activePracticeDates.length - 1];
  // datum starsi nez posledni zapsane znamena posunute hodiny - ignorujeme ho
  if (newest && dayNumber(dateKey) < dayNumber(newest)) return;

  const gap = REWARD_RULES.minHoursBetweenPracticeDays * 3600000;
  if (data.lastUpdatedMs && nowMs - data.lastUpdatedMs < gap) return;

  data.activePracticeDates = [...data.activePracticeDates, dateKey].sort().slice(-120);
}

/* Aktivni dny v poslednich sedmi kalendarnich dnech, ktere jeste nebyly
   promenene v legendarniho dumplinga. Vynechany den tim nerusi cely postup -
   staci pet dnu ze sedmi, nemusi jit po sobe. */
export function readyPracticeDays(data, todayKey = localDateKey()) {
  const today = dayNumber(todayKey);
  const from = today - (REWARD_RULES.legendaryWindowDays - 1);
  return data.activePracticeDates.filter((day) => {
    const n = dayNumber(day);
    return n >= from && n <= today && !data.legendaryDaysUsed.includes(day);
  });
}

/* ---------------- legendarni milniky ---------------- */

const countMilestones = (data, prefix) =>
  data.completedMilestones.filter((m) => m.startsWith(prefix)).length;

/* Legendarni se neprida navic - povysi ten jediny dumpling za kolo na
   nejvyssi stupen. Cesta je jedina: pravidelnost, tedy pet aktivnich dnu
   v poslednich sedmi. Vykonem se legendarni ziskat neda.

   Drive tu byly jeste tri dalsi milniky (rekordni cas, kazdych deset
   bezchybnych sad, dumpling ze vsech ctyr kategorii) - legendarnich tim
   padalo moc a uzivatel je zrusil. Nevracej je. */
function takeLegendary(data, ctx) {
  const ready = readyPracticeDays(data, ctx.dateKey);
  const needed = REWARD_RULES.legendaryActiveDaysRequired;
  if (ready.length < needed) return null;

  const id = `days:${countMilestones(data, 'days:') + 1}`;
  if (data.completedMilestones.includes(id)) return null;

  // spotrebovane dny uz nesmi udelat legendarniho podruhe
  data.legendaryDaysUsed = [...new Set([...data.legendaryDaysUsed, ...ready.slice(0, needed)])]
    .sort()
    .slice(-120);
  data.completedMilestones.push(id);

  return { why: `Za procvičování v ${needed} různých dnech`, milestone: id };
}

/* ---------------- vyhodnoceni kola ---------------- */

/* Vstup je cisty souhrn kola:
   { gameId, mode, level, max, total, correct, solveMs, dateKey, nowMs }
   `solveMs` je soucet dob nad jednotlivymi priklady, ne cely cas na obrazovce -
   pauza na precteni vysvetleni po chybe se nezapocitava.

   Vraci pole ziskanych dumplingu (nejvys jeden), prazdne pole kdyz kolo nic
   neprineslo, nebo null, kdyz uz bylo tohle gameId vyhodnocene (obnoveni
   stranky, navrat zpet, znovuotevreni vysledku). */
export function applyRound(data, summary, rng = Math.random) {
  if (!data || !summary || typeof summary.gameId !== 'string' || !summary.gameId) return null;
  if (data.processedGameIds.includes(summary.gameId)) return null;

  const total = Math.max(0, Math.floor(Number(summary.total) || 0));
  const correct = Math.min(total, Math.max(0, Math.floor(Number(summary.correct) || 0)));
  const level = ['easy', 'medium', 'hard'].includes(summary.level) ? summary.level : 'easy';
  const max = Math.max(0, Math.floor(Number(summary.max) || 0));
  const mode = summary.mode || 'calc';
  const perfect = total > 0 && correct === total;
  const nowMs = Number.isFinite(Number(summary.nowMs)) ? Number(summary.nowMs) : Date.now();
  const dateKey = DATE_RE.test(summary.dateKey || '') ? summary.dateKey : localDateKey(nowMs);
  const extras = Math.max(0, Math.floor(Number(summary.extras) || 0));
  const kindCounts = summary.kindCounts && typeof summary.kindCounts === 'object' ? summary.kindCounts : {};
  const shaped = { mode, level, max, total, correct, extras, kindCounts, solveMs: Number(summary.solveMs) || 0 };

  data.totalCorrectAnswers += correct;
  data.completedSets += 1;
  if (perfect) data.perfectSets += 1;

  // denni objem se pocita ke kalendarnimu dni, pri zmene dne se zacina znovu
  if (data.dailyDate !== dateKey) {
    data.dailyDate = dateKey;
    data.dailyCorrect = 0;
  }
  data.dailyCorrect += correct;

  const zaver = () => {
    data.processedGameIds = [summary.gameId, ...data.processedGameIds.filter((g) => g !== summary.gameId)]
      .slice(0, 50);
    data.lastUpdatedMs = Math.max(data.lastUpdatedMs, nowMs);
    data.lastUpdated = new Date(data.lastUpdatedMs).toISOString();
    /* Ulozeni resi volajici pres storage.js - i kdyz kolo zadnou odmenu
       neprinese, zapsat se musi (pribyl dokonceny set i denni objem). */
  };

  /* Bezchybna sada je podminkou vseho. Kolo s chybou dumplinga neprinese -
     dite ale nic neztraci, jen nedostane bonus. */
  if (REWARD_RULES.requirePerfectSet && !perfect) {
    zaver();
    return [];
  }

  // vzacnost urcuje nejvyssi splnena podminka zebricku, nescitaji se body
  const parts = performanceTier(shaped, data.dailyCorrect);
  let tier = parts.tier;
  let why = reasonFor(parts, { ...shaped, max }, data.dailyCorrect);

  // aktivni den se zapise, jen kdyz kolo opravdu dumplinga prineslo
  addPracticeDate(data, dateKey, nowMs);

  /* Splnena pravidelnost dumplinga nepridava - povysi ten jediny na
     nejvyssi stupen. Za kolo tak padne porad jen jeden. */
  const legendary = takeLegendary(data, { dateKey });
  if (legendary) {
    tier = TIERS.indexOf('legendary');
    why = legendary.why;
  }

  const category = TIERS[tier];
  const id = pickDumpling(category, data.rewardInventory, rng);
  if (!id) {
    zaver();
    return [];
  }

  const isNew = !(data.rewardInventory[id] > 0);
  data.rewardInventory[id] += 1;
  if (!data.newRewardIds.includes(id)) data.newRewardIds.push(id);
  zaver();

  return [{
    id,
    category,
    name: ITEM_BY_ID.get(id).name,
    reason: why,
    isNew,
    owned: data.rewardInventory[id],
  }];
}

/* ---------------- podklady pro rozhrani ---------------- */

/* Cesky plural: 1 -> jednotne cislo, 2 az 4 -> mnozne, 0 a 5 a vic -> 2. pad.
   Nula patri k druhemu padu ("nula bodu"), ne k mnoznemu cislu. */
export const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

/* Popis, jak se dumpling dane kategorie ziskava. Vsechna cisla se berou
   z REWARD_RULES, aby text nikdy nelhal proti skutecnym pravidlum. Zadne
   scitani bodu - rekne se rovnou podminka, ktera pro tu kategorii plati. */
export function howToGet(category) {
  const s = REWARD_RULES.fastSeconds;
  const casovy = `v průměru do ${s} s na jeden běžný příklad`;
  /* Delsi ulohy maji vlastni pridel casu. Nasobky se berou z REWARD_RULES,
     aby text po jejich zmene nelhal. */
  const nasobek = (kind, jmeno) => {
    const n = REWARD_RULES.speedKindMultiplier[kind];
    return `${jmeno} za ${n} ${plural(n, 'příklad', 'příklady', 'příkladů')}`;
  };
  const delsiUlohy = `Delší úlohy mají času víc: ${[
    nasobek('word', 'slovní úloha se počítá'),
    nasobek('bond', 'pyramida'),
    nasobek('over10', 'rozklad přes desítku'),
    nasobek('riddle', 'hádanka'),
    nasobek('grid', 'mřížka'),
    nasobek('pexeso', 'plocha s dvojicemi'),
  ].join(', ')}.`;
  /* U "Najdi dvojice" je chybou spojeni dvou karticek, ktere k sobe nepatri.
     Jedno prehlednuti se odpousti. Cisla se berou z REWARD_RULES, aby text
     po jejich zmene nelhal. */
  const p = REWARD_RULES.pexesoMismatchAllowance;
  const pexesoNote = `U „Najdi dvojice“ je chybou spojení dvou kartiček, které k sobě nepatří – `
    + `splést se smíš ${p.easy}krát na lehké ploše, ${p.medium}krát na střední a ${p.hard}krát na těžké.`;
  const tail = `Za jedno kolo přijde nejvýš jeden dumpling. Sada s chybou nepřinese žádný. ${pexesoNote}`;

  if (category === 'legendary') {
    return {
      lead: 'Legendárního si nevypočítáš. Přijde za pravidelnost a povýší dumplinga, kterého sis v tom kole zasloužila:',
      bullets: [
        `spočítej sadu bez jediné chyby aspoň v ${REWARD_RULES.legendaryActiveDaysRequired} z posledních ${REWARD_RULES.legendaryWindowDays} dnů`,
        'dny nemusí jít po sobě – jeden vynechaný ti postup nezruší',
      ],
      tail: 'Je to jediná cesta k legendárnímu. Za jedno kolo přijde nejvýš jeden dumpling.',
    };
  }

  if (category === 'epic') {
    return {
      lead: 'Epický přijde za sadu bez jediné chyby a k tomu jednu z těchhle dvou věcí:',
      bullets: [
        `spočítej za dnešek víc než ${REWARD_RULES.epicDailyCorrect} příkladů`,
        `nebo počítej do ${REWARD_RULES.epicMinRange} a výš, a k tomu ${casovy}`,
        delsiUlohy,
      ],
      tail,
    };
  }

  if (category === 'rare') {
    return {
      lead: 'Raritní přijde za sadu bez jediné chyby, když k tomu zvládneš obojí:',
      bullets: [
        `stihni to ${casovy}`,
        'a měj zapnuté těžší úlohy – slovní úlohy, pyramidy nebo doplň znaménko (u hádanek a mřížek stačí těžká úroveň)',
        delsiUlohy,
      ],
      tail,
    };
  }

  if (category === 'uncommon') {
    return {
      lead: 'Neobvyklý přijde za sadu bez jediné chyby, když ti to půjde rychle:',
      bullets: [
        `stihni to ${casovy}`,
        delsiUlohy,
      ],
      tail,
    };
  }

  return {
    lead: 'Základní přijde za každou sadu bez jediné chyby:',
    bullets: [
      'stačí spočítat celou sadu a nic neuhodnout špatně',
      `když ti to zabere víc než ${s} s na příklad, dostaneš právě tenhle`,
    ],
    tail,
  };
}

export const makeGameId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid || `g${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/* U neobjevene postavicky se skutecne jmeno nevraci nikde - ani do popisku,
   ani do title nebo aria-label. */
export const displayName = (id, owned) => (owned > 0 ? ITEM_BY_ID.get(id)?.name ?? UNKNOWN_NAME : UNKNOWN_NAME);

export const newCount = (data) => data.newRewardIds.length;

export function markCollectionSeen(data) {
  data.newRewardIds = [];
  return data; // zapis obstara volajici pres storage.js
}

export function collectionSummary(data, todayKey = localDateKey()) {
  const perCategory = {};
  let totalOwned = 0;
  let uniqueOwned = 0;

  for (const key of CATEGORY_ORDER) {
    let owned = 0;
    let pieces = 0;
    for (const item of CATEGORIES[key].items) {
      const n = data.rewardInventory[item.id] || 0;
      if (n > 0) owned += 1;
      pieces += n;
    }
    perCategory[key] = { owned, pieces, total: CATEGORIES[key].items.length };
    totalOwned += pieces;
    uniqueOwned += owned;
  }

  const activeDays = readyPracticeDays(data, todayKey).length;
  const needed = REWARD_RULES.legendaryActiveDaysRequired;

  return {
    totalOwned,
    uniqueOwned,
    uniqueTotal: ALL_IDS.length,
    perCategory,
    activeDays: Math.min(activeDays, needed),
    activeDaysNeeded: needed,
    practiceDays: data.activePracticeDates.length,
    legendaryOwned: perCategory.legendary.pieces,
    perfectSets: data.perfectSets,
    dailyCorrect: data.dailyDate === todayKey ? data.dailyCorrect : 0,
    /* "vic nez 50" znamena, ze bonus zabere od 51. */
    nextVolumeStep: REWARD_RULES.epicDailyCorrect + 1,
  };
}
