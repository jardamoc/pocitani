import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Testy logiky odmen. Bezi v Node, bez prohlizece a bez zavislosti:
 *   node --test "tests/*.test.mjs"
 *
 * Uloziste nahrazuje pametova atrapa na globalThis - moduly odmen sahaji na
 * localStorage az uvnitr load()/save(), takze staci ji nastavit pred importem. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

globalThis.localStorage = fakeStorage();

const load = (name) => import(pathToFileURL(resolve(root, 'public/js', name)).href);
const rewards = await load('rewards.js');
const data = await load('rewards-data.js');

const { REWARD_RULES } = rewards;

/* ---------------- pomocnici ---------------- */

let counter = 0;
const nextGameId = () => `test-${(counter += 1)}`;

/* Vychozi kolo je zamerne "nudne": lehka uroven, rozsah 10 a pomale tempo,
   takze samo o sobe nespusti rychlostni, raritni ani epickou odmenu.
   Kazdy test si pak zapne jen to, co zkouma. */
const round = (over = {}) => ({
  gameId: nextGameId(),
  mode: 'calc',
  level: 'easy',
  max: 10,
  total: 10,
  correct: 10,
  solveMs: 10 * 30000,
  dateKey: '2026-09-13',
  nowMs: Date.parse('2026-09-13T10:00:00Z'),
  ...over,
});

/* Losovani vzdy prvni polozkou - vyhodnoceni tim zustane deterministicke. */
const firstPick = () => 0;

/* Kategorie jedineho dumplinga, ktery kolo prineslo (nebo null). */
const kategorie = (granted) => (granted.length ? granted[0].category : null);

/* Kolo trvajici zadany pocet sekund na jeden priklad. */
const secondsPerExercise = (seconds, over = {}) =>
  round({ total: 10, correct: 10, solveMs: 10 * seconds * 1000, ...over });

/* ---------------- jeden dumpling za kolo ---------------- */

test('za kolo padne nejvys jeden dumpling', () => {
  const d = rewards.emptyData();
  // nejstedrejsi mozne kolo: velky rozsah, tezka uroven, rekordni cas
  const granted = rewards.applyRound(
    d,
    round({ max: 100, level: 'hard', total: 30, correct: 30, solveMs: 30 * 4000 }),
    firstPick,
  );
  assert.equal(granted.length, 1);
  assert.equal(REWARD_RULES.maxRewardsPerGame, 1);
});

test('kolo s chybou neprinese zadneho dumplinga', () => {
  const d = rewards.emptyData();
  const granted = rewards.applyRound(d, round({ total: 10, correct: 9 }), firstPick);
  assert.deepEqual(granted, []);
  // spravne odpovedi se presto zapocitaji do celkoveho i denniho souctu
  assert.equal(d.totalCorrectAnswers, 9);
  assert.equal(d.dailyCorrect, 9);
  assert.equal(d.completedSets, 1);
  assert.equal(d.perfectSets, 0);
});

test('ani rychla sada s chybou dumplinga nedostane', () => {
  const d = rewards.emptyData();
  const granted = rewards.applyRound(d, round({ total: 10, correct: 9, solveMs: 10 * 3000 }), firstPick);
  assert.deepEqual(granted, []);
});

/* ---------------- zebricek vzacnosti ---------------- */

test('bezchybna sada do 10 v klidnem tempu da zakladniho dumplinga', () => {
  const d = rewards.emptyData();
  assert.equal(kategorie(rewards.applyRound(d, round({ max: 10 }), firstPick)), 'basic');
});

test('rychlost posune stejnou sadu o stupen vys', () => {
  const d = rewards.emptyData();
  assert.equal(kategorie(rewards.applyRound(d, secondsPerExercise(19, { max: 10 }), firstPick)), 'uncommon');
});

test('rekordni cas posune o dva stupne', () => {
  const d = rewards.emptyData();
  assert.equal(kategorie(rewards.applyRound(d, secondsPerExercise(9, { max: 10 }), firstPick)), 'rare');
});

test('vetsi rozsah zvedne zaklad i bez rychlosti', () => {
  const doDvaceti = rewards.emptyData();
  assert.equal(kategorie(rewards.applyRound(doDvaceti, round({ max: 20 }), firstPick)), 'uncommon');
  const doStovky = rewards.emptyData();
  assert.equal(kategorie(rewards.applyRound(doStovky, round({ max: 100 }), firstPick)), 'rare');
});

test('vetsi rozsah a k tomu rychlost da epickeho', () => {
  const d = rewards.emptyData();
  assert.equal(kategorie(rewards.applyRound(d, secondsPerExercise(19, { max: 20 }), firstPick)), 'rare');
  const e = rewards.emptyData();
  assert.equal(kategorie(rewards.applyRound(e, secondsPerExercise(19, { max: 100 }), firstPick)), 'epic');
});

test('tezka uroven posune o stupen vys', () => {
  const d = rewards.emptyData();
  // tezka uroven ma roztazeny i rychlostni limit, takze musime pocitat opravdu
  // pomalu, aby se do vysledku nepromitl jeste bonus za rychlost
  const pomalu = secondsPerExercise(60, { max: 10, level: 'hard' });
  assert.equal(kategorie(rewards.applyRound(d, pomalu, firstPick)), 'uncommon');
});

test('vytrvalost je druha cesta nahoru - do 100 se rychle pocitat nenauci', () => {
  const d = rewards.emptyData();
  // tri pomala bezchybna kola do 100 v jednom dni, po deseti prikladech
  assert.equal(kategorie(rewards.applyRound(d, round({ max: 100 }), firstPick)), 'rare');
  assert.equal(kategorie(rewards.applyRound(d, round({ max: 100 }), firstPick)), 'rare');
  assert.equal(d.dailyCorrect, 20, 'po dvou kolech je za dnesek dvacet prikladu');
  // tretim kolem se prekroci tricet spravnych za den a pribyde stupen za objem
  assert.equal(kategorie(rewards.applyRound(d, round({ max: 100 }), firstPick)), 'epic');
  assert.equal(d.dailyCorrect, 30);
});

test('denni objem se pri zmene kalendarniho dne zacina znovu', () => {
  const d = rewards.emptyData();
  rewards.applyRound(d, round({ max: 100, dateKey: '2026-09-12', nowMs: Date.parse('2026-09-12T10:00:00Z') }), firstPick);
  rewards.applyRound(d, round({ max: 100, dateKey: '2026-09-12', nowMs: Date.parse('2026-09-12T10:30:00Z') }), firstPick);
  assert.equal(d.dailyCorrect, 20);
  rewards.applyRound(d, round({ max: 100, dateKey: '2026-09-13', nowMs: Date.parse('2026-09-13T10:00:00Z') }), firstPick);
  assert.equal(d.dailyCorrect, 10);
});

test('vykonem se nelze dostat vys nez na epickeho', () => {
  const d = rewards.emptyData();
  // rozsah 2 + rychlost 2 + tezka uroven 1 = 5, ale strop je 3
  const parts = rewards.performanceTier({ max: 100, level: 'hard', mode: 'calc', total: 10, correct: 10, solveMs: 10 * 4000 }, 90);
  assert.equal(parts.base.tier + parts.speed + parts.volume + parts.hard > REWARD_RULES.maxPerformanceTier, true);
  assert.equal(parts.tier, REWARD_RULES.maxPerformanceTier);
  // lehka uroven, aby nesahl na milnik za nejtezsi sadu v rekordnim case
  const granted = rewards.applyRound(d, round({ max: 100, solveMs: 10 * 4000 }), firstPick);
  assert.equal(kategorie(granted), 'epic');
});

test('hranice pro hadanky a mrizku jsou roztazene nasobkem podle rezimu', () => {
  // mrizka ma nasobek 4, takze hranice 20/10 s plati jako 80/40 s
  const at = (ms, mode) => rewards.speedStep({ total: 1, solveMs: ms, mode, level: 'easy' });
  assert.equal(at(60000, 'calc'), 0, 'minutu na jeden priklad uz odmena nebere');
  assert.equal(at(60000, 'grid'), 1);
  assert.equal(at(30000, 'grid'), 2);
  assert.equal(at(90000, 'grid'), 0);
  // hadanka ma nasobek 3 - hranice 60/30 s
  assert.equal(at(50000, 'riddle'), 1);
  assert.equal(at(25000, 'riddle'), 2);
});

test('odvozena obtiznost rezimu pocitani odpovida zapnutym operacim', () => {
  assert.equal(rewards.difficultyOf({ mode: 'calc', ops: ['add', 'sub'], kinds: [] }), 'easy');
  assert.equal(rewards.difficultyOf({ mode: 'calc', ops: ['add'], kinds: ['word'] }), 'medium');
  assert.equal(rewards.difficultyOf({ mode: 'calc', ops: ['add', 'mul'], kinds: [] }), 'medium');
  assert.equal(rewards.difficultyOf({ mode: 'calc', ops: ['add', 'div'], kinds: [] }), 'hard');
  assert.equal(rewards.difficultyOf({ mode: 'calc', ops: ['mul'], kinds: ['bond'] }), 'hard');
  // hadanky a mrizka maji obtiznost primo v nastaveni
  assert.equal(rewards.difficultyOf({ mode: 'grid', level: 'hard', ops: ['add'] }), 'hard');
});

/* ---------------- legendarni za pravidelnost ---------------- */

/* Odehraje kolo bez chyby v dany den - kazde takove kolo prinese aspon
   jednoho zakladniho dumplinga, takze se den zapise mezi aktivni. */
function playOn(d, dateKey, over = {}) {
  return rewards.applyRound(
    d,
    round({ dateKey, nowMs: Date.parse(`${dateKey}T10:00:00Z`), ...over }),
    firstPick,
  );
}

test('procvicovani v peti ruznych dnech ze sedmi vytvori legendarni odmenu', () => {
  const d = rewards.emptyData();
  const days = ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
  let last = [];
  for (const day of days) last = playOn(d, day);
  assert.equal(d.activePracticeDates.length, 5);
  assert.equal(kategorie(last), 'legendary');
  assert.equal(last.length, 1, 'legendarni nepribyva navic, jen povysi ten jediny');
});

test('jeden vynechany den nezrusi cely postup', () => {
  const d = rewards.emptyData();
  // 10. zari se necvicilo, presto je pet dnu v sedmidennim okne
  const days = ['2026-09-08', '2026-09-09', '2026-09-11', '2026-09-12', '2026-09-13'];
  let last = [];
  for (const day of days) last = playOn(d, day);
  assert.equal(kategorie(last), 'legendary');
});

test('ctyri dny na legendarni odmenu jeste nestaci', () => {
  const d = rewards.emptyData();
  let last = [];
  for (const day of ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']) last = playOn(d, day);
  assert.notEqual(kategorie(last), 'legendary');
  assert.equal(rewards.collectionSummary(d, '2026-09-13').activeDays, 4);
});

test('posun systemovych hodin neumi vyrobit aktivni dny za minutu', () => {
  const d = rewards.emptyData();
  const base = Date.parse('2026-09-13T10:00:00Z');
  // ctyri "dny" po sobe, ale v realnem case jen po minute
  playOn(d, '2026-09-13', { nowMs: base });
  for (let i = 1; i <= 4; i += 1) {
    rewards.applyRound(
      d,
      round({ dateKey: `2026-09-${13 + i}`, nowMs: base + i * 60000 }),
      firstPick,
    );
  }
  assert.equal(d.activePracticeDates.length, 1);
});

/* ---------------- 10-11. dvoji zapocteni a trvalost ---------------- */

test('tataz dokoncena sada se nezapocita dvakrat', () => {
  const d = rewards.emptyData();
  const summary = round({ total: 10, correct: 10 });
  const first = rewards.applyRound(d, summary, firstPick);
  const again = rewards.applyRound(d, summary, firstPick);
  assert.equal(first.length > 0, true);
  assert.equal(again, null);
  assert.equal(d.totalCorrectAnswers, 10);
  assert.equal(d.completedSets, 1);
});

test('po znovuspusteni aplikace zustanou odmeny ulozene', () => {
  globalThis.localStorage = fakeStorage();
  const d = rewards.load();
  rewards.applyRound(d, round({ total: 10, correct: 10 }), firstPick);

  const reloaded = rewards.load(); // jako po obnoveni stranky
  assert.equal(reloaded.totalCorrectAnswers, 10);
  assert.equal(reloaded.completedSets, 1);
  assert.equal(Object.values(reloaded.rewardInventory).reduce((a, b) => a + b, 0), 1);
});

/* ---------------- 12-13. ferovy vyber postavicky ---------------- */

test('nejdriv se vybiraji dosud neobjevene postavicky', () => {
  const inventory = {};
  for (const id of data.ALL_IDS) inventory[id] = 0;
  inventory.basic_01 = 5;
  inventory.basic_02 = 3;

  // pri libovolnem losu nesmi padnout uz vlastnena postavicka
  for (let roll = 0; roll < 1; roll += 0.01) {
    const id = rewards.pickDumpling('basic', inventory, () => roll);
    assert.equal(inventory[id], 0, `los ${roll.toFixed(2)} vratil uz vlastneneho ${id}`);
  }
});

test('po ziskani vsech osmi postavicek kategorie lze ziskavat duplikaty', () => {
  const inventory = {};
  for (const id of data.ALL_IDS) inventory[id] = 0;
  for (const item of data.CATEGORIES.basic.items) inventory[item.id] = 1;

  const ids = new Set();
  for (let roll = 0; roll < 1; roll += 0.01) ids.add(rewards.pickDumpling('basic', inventory, () => roll));
  assert.equal(ids.size, 8);
  for (const id of ids) assert.equal(inventory[id], 1);
});

test('vyber se drzi uvnitr sve kategorie i pri neplatnem losu', () => {
  const inventory = {};
  for (const id of data.ALL_IDS) inventory[id] = 0;
  const ids = data.CATEGORIES.rare.items.map((i) => i.id);
  assert.equal(ids.includes(rewards.pickDumpling('rare', inventory, () => 0)), true);
  assert.equal(ids.includes(rewards.pickDumpling('rare', inventory, () => 0.999999)), true);
  assert.equal(ids.includes(rewards.pickDumpling('rare', inventory, () => NaN)), true);
});

/* ---------------- 14-15. legendarni milniky ---------------- */

test('jedna sada nevytvori vice nez jednu legendarni odmenu', () => {
  const d = rewards.emptyData();
  d.perfectSets = 9; // desata sada bez chyby prijde prave ted
  d.activePracticeDates = ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];
  d.lastUpdatedMs = Date.parse('2026-09-12T10:00:00Z');

  // splnene jsou naraz dva milniky, presto padne jediny dumpling
  const granted = playOn(d, '2026-09-13');
  assert.equal(granted.length, 1);
  assert.equal(kategorie(granted), 'legendary');
});

test('stejny jednorazovy milnik nelze ziskat opakovane', () => {
  const d = rewards.emptyData();
  for (const day of ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']) playOn(d, day);
  assert.equal(d.completedMilestones.includes('days:1'), true);

  // dalsi kolo uz stejnych pet dnu znovu promenit nemuze
  const next = playOn(d, '2026-09-14');
  assert.equal(d.completedMilestones.filter((m) => m === 'days:1').length, 1);
  assert.equal(next.some((g) => g.reason.includes('různých dnech')), false);
});

test('spotrebovane dny se do dalsiho postupu uz nepocitaji', () => {
  const d = rewards.emptyData();
  for (const day of ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']) playOn(d, day);
  assert.equal(d.legendaryDaysUsed.length, REWARD_RULES.legendaryActiveDaysRequired);
  assert.equal(rewards.collectionSummary(d, '2026-09-13').activeDays, 0);
});

/* ---------------- 18-19. jmena postavicek ---------------- */

test('kazdy ze 40 dumplingu ma neprazdne ceske jmeno', () => {
  assert.equal(data.ALL_ITEMS.length, 40);
  const names = new Set();
  for (const item of data.ALL_ITEMS) {
    assert.equal(typeof item.name, 'string');
    assert.equal(item.name.trim().length > 0, true);
    assert.equal(/undefined|NaN|�/.test(item.name), false, `${item.id} ma poskozene jmeno`);
    names.add(item.name);
  }
  assert.equal(names.size, 40, 'jmena se nesmi opakovat');
});

test('neobjeveny dumpling nezobrazi sve skutecne jmeno', () => {
  assert.equal(rewards.displayName('legendary_01', 0), data.UNKNOWN_NAME);
  assert.equal(rewards.displayName('legendary_01', 1), 'Zlatý král');
  assert.equal(rewards.displayName('legendary_01', 0).includes('Zlatý'), false);
});

/* ---------------- 20. poskozene uloziste ---------------- */

test('pri poskozenem ulozisti se aplikace spusti bez padu', () => {
  for (const broken of ['{', 'null', '[]', '"text"', '{"rewardInventory":42}', '']) {
    globalThis.localStorage = fakeStorage({ [rewards.STORAGE_KEY]: broken });
    const d = rewards.load();
    assert.equal(d.version, rewards.DATA_VERSION);
    assert.equal(Object.keys(d.rewardInventory).length, 40);
    assert.equal(d.totalCorrectAnswers, 0);
  }
});

test('pri poskozeni jednoho udaje zustanou ostatni platna data', () => {
  globalThis.localStorage = fakeStorage({
    [rewards.STORAGE_KEY]: JSON.stringify({
      version: 1,
      rewardInventory: { basic_01: 3, basic_02: -5, vymysleny_klic: 9, basic_03: 'x' },
      totalCorrectAnswers: 42,
      completedSets: 'nesmysl',
      activePracticeDates: ['2026-09-13', 'zitra', 12345],
      newRewardIds: ['basic_01', 'neexistuje'],
    }),
  });
  const d = rewards.load();
  assert.equal(d.rewardInventory.basic_01, 3, 'platna polozka musi prezit');
  assert.equal(d.rewardInventory.basic_02, 0, 'zaporne cislo spadne na nulu');
  assert.equal(d.rewardInventory.basic_03, 0, 'text spadne na nulu');
  assert.equal('vymysleny_klic' in d.rewardInventory, false);
  assert.equal(d.totalCorrectAnswers, 42, 'platne cislo musi prezit');
  assert.equal(d.completedSets, 0);
  assert.deepEqual(d.activePracticeDates, ['2026-09-13']);
  assert.deepEqual(d.newRewardIds, ['basic_01']);
});

test('chybejici uloziste aplikaci neshodi', () => {
  const saved = globalThis.localStorage;
  delete globalThis.localStorage;
  const d = rewards.load();
  assert.equal(d.totalCorrectAnswers, 0);
  assert.doesNotThrow(() => rewards.save(d));
  globalThis.localStorage = saved;
});

/* ---------------- texty odmen ---------------- */

test('duvody odmen jsou cesky a bez zapornych nebo desetinnych cisel', () => {
  const d = rewards.emptyData();
  const granted = [
    ...rewards.applyRound(d, round({ level: 'hard', max: 100, total: 10, correct: 10, solveMs: 10 * 5000 }), firstPick),
    ...rewards.applyRound(d, round({ level: 'medium', max: 50, total: 20, correct: 19 }), firstPick),
  ];
  assert.equal(granted.length > 0, true);
  for (const g of granted) {
    assert.equal(typeof g.reason, 'string');
    assert.equal(/undefined|NaN/.test(g.reason), false, g.reason);
    assert.equal(/-\d|\d+[.,]\d/.test(g.reason), false, `zaporne nebo desetinne cislo: ${g.reason}`);
    assert.equal(g.owned >= 1, true);
    assert.equal(data.ITEM_BY_ID.has(g.id), true);
  }
});

test('navod v popupu je cesky a odpovida pravidlum', () => {
  for (const category of data.CATEGORY_ORDER) {
    const navod = rewards.howToGet(category);
    const text = [navod.lead, ...navod.bullets, navod.tail].join(' ');
    assert.equal(navod.bullets.length > 0, true, category);
    assert.equal(/undefined|NaN|\[object/.test(text), false, `${category}: ${text}`);
    assert.equal(/-\d|\d+[.,]\d/.test(text), false, `zaporne nebo desetinne cislo: ${text}`);
  }
  // cisla v navodu se musi brat z konfigurace, ne byt prepsana v textu
  const zakladni = rewards.howToGet('basic');
  assert.equal(zakladni.bullets.some((b) => b.includes(`do ${REWARD_RULES.rangeTiers[0].minRange} a výš`)), true);
  assert.equal(zakladni.bullets.some((b) => b.includes(`pod ${REWARD_RULES.speedThresholdsSeconds[0].under} s`)), true);
  assert.equal(zakladni.bullets.some((b) => b.includes(String(REWARD_RULES.dailyVolumeSteps[0].atLeast))), true);

  const legendarni = rewards.howToGet('legendary');
  assert.equal(legendarni.bullets.some((b) => b.includes(`${REWARD_RULES.legendaryActiveDaysRequired} různých dnech`)), true);
});

test('cesky plural sklonuje i nulu spravne', () => {
  const p = (n) => rewards.plural(n, 'bod', 'body', 'bodů');
  assert.equal(p(0), 'bodů');
  assert.equal(p(1), 'bod');
  assert.equal(p(2), 'body');
  assert.equal(p(4), 'body');
  assert.equal(p(5), 'bodů');
});

test('souhrn sbirky sedi s inventarem', () => {
  const d = rewards.emptyData();
  d.rewardInventory.basic_01 = 3;
  d.rewardInventory.basic_02 = 1;
  d.rewardInventory.legendary_05 = 2;
  const s = rewards.collectionSummary(d, '2026-09-13');
  assert.equal(s.totalOwned, 6);
  assert.equal(s.uniqueOwned, 3);
  assert.equal(s.uniqueTotal, 40);
  assert.equal(s.perCategory.basic.owned, 2);
  assert.equal(s.legendaryOwned, 2);
});
