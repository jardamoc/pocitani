import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Testy ulozne vrstvy. Bezi v Node, bez prohlizece a bez zavislosti:
 *   node --test "tests/*.test.mjs"
 *
 * Uloziste nahrazuje pametova atrapa na globalThis. storage.js na ni saha az
 * uvnitr funkci, takze staci, kdyz tam je pred prvnim volanim. `document`
 * schvalne nedoplnujeme - modul si posluchac navazuje jen kdyz existuje,
 * takze v Node se preskoci. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nacti = (name) => import(pathToFileURL(resolve(root, 'public/js', name)).href);

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

const storage = await nacti('storage.js');
const store = await nacti('stats.js');
const rewards = await nacti('rewards.js');

/* Fronta zapisu ceka 300 ms. Misto cekani zavolame flush(), ktery ji
   dokonci okamzite - test tak nema zadny casovac ani prodlevu. */
const ulozeno = (key) => JSON.parse(globalThis.localStorage.getItem(key));

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

/* ---------------- 1. fronta zapisu ---------------- */

test('nekolik zmen po sobe skonci jednim zapisem posledniho stavu', async () => {
  let zapisu = 0;
  const puvodni = globalThis.localStorage;
  globalThis.localStorage = { ...puvodni, setItem: (k, v) => { zapisu += 1; puvodni.setItem(k, v); } };

  const state = store.emptyState();
  for (const tema of ['panda', 'ocean', 'kawaii']) {
    state.theme = tema;
    storage.saveState(state);
  }
  await storage.flush();

  assert.equal(zapisu, 1, 'tri zmeny se musi slouci do jednoho zapisu');
  assert.equal(ulozeno(store.KEY).theme, 'kawaii', 'zapisuje se posledni stav');
  globalThis.localStorage = puvodni;
});

test('dokud se fronta nedokonci, na ulozisti nic neni', async () => {
  const state = store.emptyState();
  state.theme = 'ocean';
  storage.saveState(state);
  assert.equal(globalThis.localStorage.getItem(store.KEY), null);

  await storage.flush();
  assert.equal(ulozeno(store.KEY).theme, 'ocean');
});

test('flush bez cekajici zmeny nic nezapise ani nespadne', async () => {
  await storage.flush();
  assert.equal(globalThis.localStorage._map.size, 0);
});

/* ---------------- 2. nacteni a ulozeni ---------------- */

test('odmeny prezijou obnoveni stranky', async () => {
  const data = rewards.emptyData();
  data.totalCorrectAnswers = 10;
  data.completedSets = 1;
  data.rewardInventory.basic_01 = 1;
  storage.saveRewards(data);
  await storage.flush();

  const znovu = await storage.load(); // jako po obnoveni stranky
  assert.equal(znovu.rewards.totalCorrectAnswers, 10);
  assert.equal(znovu.rewards.completedSets, 1);
  assert.equal(znovu.rewards.rewardInventory.basic_01, 1);
});

test('nactena data projdou sanitizaci', async () => {
  globalThis.localStorage = fakeStorage({
    [store.KEY]: JSON.stringify({ theme: 'ocean', dark: 'mozna', skills: { add: { seen: 5, wrong: 99 } } }),
    [rewards.STORAGE_KEY]: JSON.stringify({ totalCorrectAnswers: -3 }),
  });

  const { state, rewards: odmeny } = await storage.load();
  assert.equal(state.theme, 'ocean', 'platna hodnota prezije');
  assert.equal(state.dark, false, 'nesmysl spadne na vychozi');
  assert.equal(state.skills.add.wrong, 5, 'chyb nemuze byt vic nez pokusu');
  assert.equal(odmeny.totalCorrectAnswers, 0);
});

test('pri poskozenem ulozisti se aplikace spusti bez padu', async () => {
  for (const rozbite of ['{', 'null', '[]', '"text"', '']) {
    globalThis.localStorage = fakeStorage({ [store.KEY]: rozbite, [rewards.STORAGE_KEY]: rozbite });
    const { state, rewards: odmeny } = await storage.load();
    assert.equal(state.theme, 'panda');
    assert.equal(Object.keys(odmeny.rewardInventory).length, 40);
    assert.equal(odmeny.totalCorrectAnswers, 0);
  }
});

test('chybejici uloziste aplikaci neshodi', async () => {
  const puvodni = globalThis.localStorage;
  delete globalThis.localStorage;

  const { state } = await storage.load();
  assert.equal(state.theme, 'panda');
  storage.saveState(state);
  await assert.doesNotReject(() => storage.flush());

  globalThis.localStorage = puvodni;
});

/* ---------------- 3. mazani ---------------- */

async function naplnUloziste() {
  const state = store.emptyState();
  state.theme = 'ocean';
  state.rounds = [{ at: 1, total: 5, correct: 5, max: 20, ops: ['add'], mode: 'calc' }];
  const data = rewards.emptyData();
  data.rewardInventory.basic_01 = 1;
  storage.saveState(state);
  storage.saveRewards(data);
  await storage.flush();
}

test("clear('rewards') smaze sbirku a historii necha", async () => {
  await naplnUloziste();
  await storage.clear('rewards');

  const { state, rewards: odmeny } = await storage.load();
  assert.equal(state.theme, 'ocean', 'nastaveni zustava');
  assert.equal(state.rounds.length, 1, 'historie zustava');
  assert.equal(odmeny.rewardInventory.basic_01, 0, 'sbirka je prazdna');
});

test("clear('all') smaze uplne vsechno", async () => {
  await naplnUloziste();
  await storage.clear('all');

  const { state, rewards: odmeny } = await storage.load();
  assert.equal(state.theme, 'panda');
  assert.equal(state.rounds.length, 0);
  assert.equal(odmeny.rewardInventory.basic_01, 0);
});

test('mazani zahodi i cekajici zapis', async () => {
  await naplnUloziste();

  const state = store.emptyState();
  state.theme = 'kawaii';
  storage.saveState(state);   // jeste nezapsano
  await storage.clear('all');
  await storage.flush();      // nesmi vratit zpatky to, co se prave smazalo

  assert.equal(globalThis.localStorage.getItem(store.KEY), null);
});

/* ---------------- 4. vymena uloziste ---------------- */

test('setBackend prepne uloziste, aplikace se nemeni', async () => {
  const volani = [];
  const atrapa = {
    load: async () => ({ state: store.emptyState(), rewards: rewards.emptyData() }),
    saveState: async () => { volani.push('state'); },
    saveRewards: async () => { volani.push('rewards'); },
    clear: async (scope) => { volani.push(`clear:${scope}`); },
  };

  storage.setBackend(atrapa);
  storage.saveState(store.emptyState());
  await storage.flush();
  await storage.clear('all');

  assert.deepEqual(volani, ['state', 'clear:all']);
  assert.equal(globalThis.localStorage._map.size, 0, 'na localStorage se nesmelo sahnout');

  storage.setBackend(storage.LOCAL_BACKEND); // at dalsi testy nejedou na atrape
});
