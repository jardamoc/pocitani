import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABC_COUNTS, ABC_LEVEL_KEYS, WORDS, abcCompare, abcEmptyBoard, dropBetween, dropOnSlot, dropToPool, makeAbc, wrongSlots,
} from '../public/js/abc.js';

const board = (slots, pool = []) => ({ slots: [...slots], pool: [...pool] });

test('vymena: puvodni slovo spadne dolu', () => {
  const b = dropOnSlot(board([0, 1, 2], [3]), 3, 1);
  assert.deepEqual(b.slots, [0, 3, 2]);
  assert.deepEqual(b.pool, [1]);
});

test('vymena z jineho okenka: puvodni okenko zustane prazdne', () => {
  const b = dropOnSlot(board([0, 1, 2]), 0, 2);
  assert.deepEqual(b.slots, [null, 1, 0]);
  assert.deepEqual(b.pool, [2]);
});

test('vsunuti posune slova az k volnemu okenku', () => {
  const b = dropBetween(board([0, 1, null, 2], [3]), 3, 0);
  assert.deepEqual(b.slots, [3, 0, 1, 2]);
  assert.deepEqual(b.pool, []);
});

test('vsunuti bez volneho okenka: posledni spadne dolu', () => {
  const b = dropBetween(board([0, 1, 2], [3]), 3, 1);
  assert.deepEqual(b.slots, [0, 3, 1]);
  assert.deepEqual(b.pool, [2]);
});

test('vsunuti za posledni okenko je vymena na poslednim', () => {
  const b = dropBetween(board([0, 1, 2], [3]), 3, 3);
  assert.deepEqual(b.slots, [0, 1, 3]);
  assert.deepEqual(b.pool, [2]);
});

test('presun uvnitr rady: uvolnene okenko pohlti posun', () => {
  const b = dropBetween(board([0, 1, 2, 3]), 3, 0);
  assert.deepEqual(b.slots, [3, 0, 1, 2]);
  assert.deepEqual(b.pool, []);
});

test('vraceni dolu a puvodni stav se nemeni', () => {
  const start = board([0, 1], []);
  const b = dropToPool(start, 1);
  assert.deepEqual(b.slots, [0, null]);
  assert.deepEqual(b.pool, [1]);
  assert.deepEqual(start.slots, [0, 1]);
});

test('ceske poradi: ch za h, c pred c s hackem', () => {
  const sorted = ['chata', 'hrad', 'čaj', 'cukr', 'ryba', 'řeka', 'iglú'].sort(abcCompare);
  assert.deepEqual(sorted, ['cukr', 'čaj', 'hrad', 'chata', 'iglú', 'ryba', 'řeka']);
});

test('slova jsou mala pismena, nejvys 8 znaku, bez duplicit', () => {
  assert.equal(new Set(WORDS).size, WORDS.length);
  for (const w of WORDS) {
    assert.match(w, /^[a-záčďéěíňóřšťúůýž]+$/);
    assert.ok(w.length <= 8, w);
  }
});

test('2000 ploch: pocet sedi, poradi jednoznacne a spravne, uroven dodrzena', () => {
  const base = new Intl.Collator('cs', { sensitivity: 'base' });
  const first = (w) => (w.startsWith('ch') ? 'ch' : w[0]);
  const TRAPS = [['c', 'č'], ['r', 'ř'], ['s', 'š'], ['z', 'ž'], ['h', 'ch']];
  for (let n = 0; n < 2000; n++) {
    const level = ABC_LEVEL_KEYS[n % 3];
    const count = ABC_COUNTS[n % ABC_COUNTS.length];
    const ex = makeAbc(level, count);
    assert.equal(ex.words.length, count);
    assert.equal(new Set(ex.order).size, count);
    const sorted = ex.order.map((i) => ex.words[i]);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(abcCompare(sorted[i - 1], sorted[i]) < 0, `${sorted[i - 1]} / ${sorted[i]}`);
      assert.notEqual(base.compare(sorted[i - 1], sorted[i]), 0);
    }
    const initials = new Set(ex.words.map(first));
    const traps = TRAPS.filter(([x, y]) => initials.has(x) && initials.has(y)).length;
    if (level === 'hard') assert.ok(traps >= 2, sorted.join(' '));
    else assert.equal(traps, 0, sorted.join(' '));
    if (level === 'medium') assert.ok(initials.size < count, sorted.join(' '));
    if (level === 'easy' && count <= 21) assert.equal(initials.size, count, sorted.join(' '));

    const full = { slots: [...ex.order], pool: [] };
    assert.deepEqual(wrongSlots(full, ex.order), []);
    assert.equal(wrongSlots(abcEmptyBoard(ex), ex.order).length, count);
  }
});
