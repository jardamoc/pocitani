import { ALL_IDS, CATEGORIES, CATEGORY_ORDER, ITEM_BY_ID, UNKNOWN_NAME } from './rewards-data.js';

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
 * se o poctu kusu, ale o tom, jak vzacny dumpling to bude. Vzacnost se sklada
 * ze ctyr nezavislych prispevku:
 *
 *   zaklad podle rozsahu  (do kolika se pocita)
 * + bonus za rychlost     (prumerny cas na jeden priklad)
 * + bonus za objem        (kolik prikladu uz dite ten den spocitalo)
 * + bonus za obtiznost    (tezka uroven)
 *
 * Objem je tam schvalne jako druha cesta nahoru: do 100 se rychle pocitat
 * nenaucis, ale vytrvalost se ma ocenit stejne.
 *
 * POZOR na rychlost: hranice plati na JEDEN priklad (prumer), ne na celou
 * sadu - sada ma 10 az 30 prikladu. Kratsi sada tim neni zvyhodnena. Nasobky
 * nize limit jeste roztahnou tam, kde jedna uloha trva dele (hadanka, mrizka)
 * nebo je tezsi. */
export const REWARD_RULES = {
  /* Kolo s chybou neprinese nic - bezchybnost je podminkou vseho. */
  requirePerfectSet: true,
  maxRewardsPerGame: 1,

  /* Zaklad: cim vetsi cisla, tim vzacnejsi dumpling. Zkousi se odshora. */
  rangeTiers: [
    { minRange: 50, tier: 2, label: 'Raritní' },
    { minRange: 20, tier: 1, label: 'Neobvyklý' },
    { minRange: 0, tier: 0, label: 'Základní' },
  ],

  /* Bonus za rychlost - sekundy na jeden priklad, zkousi se od nejnizsiho. */
  speedThresholdsSeconds: [
    { under: 10, step: 2 },
    { under: 20, step: 1 },
  ],
  speedModeMultiplier: { calc: 1, riddle: 3, grid: 4 },
  speedLevelMultiplier: { easy: 1, medium: 1.3, hard: 1.7 },

  /* Bonus za objem - kolik spravnych prikladu uz dite ten den spocitalo
     (vcetne prave dokonceneho kola). Zkousi se odshora. */
  dailyVolumeSteps: [
    { atLeast: 60, step: 2 },
    { atLeast: 30, step: 1 },
  ],

  /* Bonus za obtiznost - nasobeni a deleni, nebo tezka hadanka ci mrizka. */
  hardLevelStep: 1,

  /* Vykonem se da dojit nejvys k epickemu. Legendarni je jen za milniky. */
  maxPerformanceTier: 3,

  legendaryActiveDaysRequired: 5,
  legendaryWindowDays: 7,
  perfectSetsMilestoneStep: 10,
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

const wholeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

const textList = (value, isValid, limit) =>
  Array.isArray(value)
    ? [...new Set(value.filter((x) => typeof x === 'string' && isValid(x)))].slice(0, limit)
    : [];

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

export function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    /* prazdne, poskozene nebo zakazane uloziste - sbirka zacne od nuly,
       ale aplikace se musi spustit */
    return emptyData();
  }
}

export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* privatni rezim nebo plne uloziste - hra funguje dal i bez ulozeni */
  }
  return data;
}

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

function speedLimits(mode, level) {
  const byMode = REWARD_RULES.speedModeMultiplier[mode] ?? 1;
  const byLevel = REWARD_RULES.speedLevelMultiplier[level] ?? 1;
  return REWARD_RULES.speedThresholdsSeconds
    .map((t) => ({ under: t.under * byMode * byLevel, step: t.step }))
    .sort((a, b) => a.under - b.under);
}

/* Kolik stupnu prida rychlost. Hranice se zkousi od nejnizsiho casu a bere se
   jen ta nejlepsi - devet sekund je dva stupne, ne 1 + 2. */
export function speedStep(summary) {
  const total = Math.max(0, Math.floor(summary.total || 0));
  const solveMs = Number(summary.solveMs);
  if (!total || !Number.isFinite(solveMs) || solveMs <= 0) return 0;

  const perExercise = solveMs / total / 1000;
  for (const limit of speedLimits(summary.mode, summary.level)) {
    if (perExercise < limit.under) return limit.step;
  }
  return 0;
}

/* Kolik stupnu prida objem odpocitany za dnesek. Druha cesta nahoru pro
   toho, kdo pocita velka cisla - do 100 se rychle pocitat nenauci. */
export function volumeStep(dailyCorrect) {
  for (const rule of REWARD_RULES.dailyVolumeSteps) {
    if (dailyCorrect >= rule.atLeast) return rule.step;
  }
  return 0;
}

function rangeTier(max) {
  for (const rule of REWARD_RULES.rangeTiers) {
    if (max >= rule.minRange) return rule;
  }
  return REWARD_RULES.rangeTiers[REWARD_RULES.rangeTiers.length - 1];
}

/* Vzacnost dumplinga za jedno kolo. Vraci stupen 0-3 (zakladni az epicky)
   a rozpis, z ceho se poskladal - z nej se pak sklada cesky duvod. */
export function performanceTier(summary, dailyCorrect) {
  const base = rangeTier(Math.max(0, Math.floor(Number(summary.max) || 0)));
  const speed = speedStep(summary);
  const volume = volumeStep(dailyCorrect);
  const hard = summary.level === TOP_LEVEL ? REWARD_RULES.hardLevelStep : 0;
  const tier = Math.min(REWARD_RULES.maxPerformanceTier, base.tier + speed + volume + hard);
  return { tier, base, speed, volume, hard };
}

/* Cesky duvod. Zaklad rika, za co dumpling je; pripocteny bonus vysvetli,
   proc je vzacnejsi, nez by cekala. */
function reasonFor(parts, summary, dailyCorrect) {
  const bonusy = [];
  if (parts.speed) {
    const limit = speedLimits(summary.mode, summary.level).find((l) => l.step === parts.speed);
    const unit = summary.mode === 'riddle' ? 'hádanku' : summary.mode === 'grid' ? 'mřížku' : 'příklad';
    bonusy.push(`rychlost pod ${Math.round(limit.under)} s na ${unit}`);
  }
  if (parts.volume) bonusy.push(`${dailyCorrect} spočítaných příkladů za dnešek`);
  if (parts.hard) bonusy.push('těžkou úroveň');

  const zaklad = `Za počítání do ${summary.max} bez chyby`;
  if (!bonusy.length) return zaklad;
  const vypis = bonusy.length === 1 ? bonusy[0] : `${bonusy.slice(0, -1).join(', ')} a ${bonusy[bonusy.length - 1]}`;
  return `${zaklad} – a k tomu za ${vypis}`;
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

const ownedInCategory = (data, category) =>
  CATEGORIES[category].items.some((item) => data.rewardInventory[item.id] > 0);

const countMilestones = (data, prefix) =>
  data.completedMilestones.filter((m) => m.startsWith(prefix)).length;

/* Legendarni se neprida navic - povysi ten jediny dumpling za kolo na
   nejvyssi stupen. Bere se prvni nesplneny milnik v poradi; ostatni splnene
   se neztraci, prijdou na radu v dalsim kole. */
function takeLegendary(data, ctx) {
  const has = (id) => data.completedMilestones.includes(id);
  const claim = (id, why) => {
    data.completedMilestones.push(id);
    return { why, milestone: id };
  };

  // a) nejtezsi uroven bez chyby a zaroven v nejvyssim rychlostnim limitu
  const topSpeed = Math.max(...REWARD_RULES.speedThresholdsSeconds.map((t) => t.step));
  if (ctx.level === TOP_LEVEL && ctx.perfect && ctx.speedStep >= topSpeed) {
    const id = `ultimate:${data.ultimateRuns + 1}`;
    if (!has(id)) {
      data.ultimateRuns += 1;
      return claim(id, 'Za nejtěžší sadu bez chyby a v rekordním čase');
    }
  }

  // b) pet aktivnich dnu v poslednich sedmi kalendarnich dnech
  const ready = readyPracticeDays(data, ctx.dateKey);
  const needed = REWARD_RULES.legendaryActiveDaysRequired;
  if (ready.length >= needed) {
    const id = `days:${countMilestones(data, 'days:') + 1}`;
    if (!has(id)) {
      // spotrebovane dny uz nesmi udelat legendarniho podruhe
      data.legendaryDaysUsed = [...new Set([...data.legendaryDaysUsed, ...ready.slice(0, needed)])]
        .sort()
        .slice(-120);
      return claim(id, `Za procvičování v ${needed} různých dnech`);
    }
  }

  // c) kazdych deset sad bez jedine chyby
  const step = REWARD_RULES.perfectSetsMilestoneStep;
  const reached = Math.floor(data.perfectSets / step) * step;
  if (reached >= step && !has(`perfect:${reached}`)) {
    return claim(`perfect:${reached}`, `Za ${reached} sad bez jediné chyby`);
  }

  // d) aspon jeden dumpling ze vsech ctyr nizsich kategorii, jednou za zivot
  const lower = CATEGORY_ORDER.filter((key) => key !== 'legendary');
  if (!has('allfour') && lower.every((key) => ownedInCategory(data, key))) {
    return claim('allfour', 'Za dumplinga z každé ze čtyř kategorií');
  }

  return null;
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
  const shaped = { mode, level, max, total, correct, solveMs: Number(summary.solveMs) || 0 };

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
    save(data);
  };

  /* Bezchybna sada je podminkou vseho. Kolo s chybou dumplinga neprinese -
     dite ale nic neztraci, jen nedostane bonus. */
  if (REWARD_RULES.requirePerfectSet && !perfect) {
    zaver();
    return [];
  }

  // vzacnost se sklada z rozsahu, rychlosti, denniho objemu a obtiznosti
  const parts = performanceTier(shaped, data.dailyCorrect);
  let tier = parts.tier;
  let why = reasonFor(parts, { ...shaped, max }, data.dailyCorrect);

  // aktivni den se zapise, jen kdyz kolo opravdu dumplinga prineslo
  addPracticeDate(data, dateKey, nowMs);

  /* Splneny legendarni milnik dumplinga nepridava - povysi ten jediny na
     nejvyssi stupen. Za kolo tak padne porad jen jeden. */
  const legendary = takeLegendary(data, { level, perfect, speedStep: parts.speed, dateKey });
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

const body = (n) => `${n} ${plural(n, 'bod', 'body', 'bodů')}`;

/* Serazene prispevky jedne osy do jedne vety: "pod 20 s … 1 bod, pod 10 s … 2 body". */
const osa = (polozky) => polozky
  .slice()
  .sort((a, b) => a.step - b.step)
  .map((p) => `${p.text} – ${body(p.step)}`)
  .join(', ');

/* Popis, jak se dumpling dane kategorie ziskava. Vsechna cisla se berou
   z REWARD_RULES, aby text nikdy nelhal proti skutecnym pravidlum. */
export function howToGet(category) {
  if (category === 'legendary') {
    return {
      lead: 'Legendárního si nevypočítáš. Přijde za vytrvalost a povýší dumplinga, kterého sis v tom kole zasloužila:',
      bullets: [
        `procvičování v ${REWARD_RULES.legendaryActiveDaysRequired} různých dnech za posledních ${REWARD_RULES.legendaryWindowDays}`,
        `každých ${REWARD_RULES.perfectSetsMilestoneStep} sad bez jediné chyby`,
        'dumpling z každé ze čtyř nižších kategorií',
        'nejtěžší sada bez chyby a k tomu v rekordním čase',
      ],
      tail: 'Za jedno kolo přijde nejvýš jeden.',
    };
  }

  const tier = TIERS.indexOf(category);
  const rozsahy = REWARD_RULES.rangeTiers
    .filter((r) => r.tier > 0)
    .map((r) => ({ step: r.tier, text: `do ${r.minRange} a výš` }));
  const rychlosti = REWARD_RULES.speedThresholdsSeconds
    .map((t) => ({ step: t.step, text: `pod ${t.under} s` }));
  const objemy = REWARD_RULES.dailyVolumeSteps
    .map((v) => ({ step: v.step, text: String(v.atLeast) }));

  return {
    lead: 'Po sadě bez jediné chyby se sečtou body:',
    bullets: [
      `do kolika počítáš: ${osa(rozsahy)}`,
      `čas na jeden příklad: ${osa(rychlosti)}`,
      `příkladů za dnešek: ${osa(objemy)}`,
      `těžká úroveň – ${body(REWARD_RULES.hardLevelStep)}`,
    ],
    tail: tier === 0
      ? 'Základní dumpling přijde za každou bezchybnou sadu, i bez jediného bodu.'
      : `Za ${body(tier)} dostaneš tuhle kategorii. Sada s chybou dumplinga nepřinese.`,
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
  return save(data);
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
    nextVolumeStep: REWARD_RULES.dailyVolumeSteps[REWARD_RULES.dailyVolumeSteps.length - 1].atLeast,
  };
}
