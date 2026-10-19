// Testy obrazku odmen: kazda postavicka i nadpis kategorie ma svuj .webp
// v public/, ID jsou stabilni a poradi pro prenos QR kodem se nerozbilo.
// Zadna zavislost - hlavicka WebP se cte rucne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (rel) => resolve(root, 'public', rel);
const data = await import('../public/js/rewards-data.js');

/* Prvnich 40 ID v poradi, v jakem je posilaly QR kody pred prechodem na .webp.
   Tohle poradi se uz nesmi zmenit, jinak by starsi kod priradil pocty spatnym
   postavickam. */
const PUVODNI_PORADI = data.CATEGORY_ORDER.flatMap((cat) =>
  Array.from({ length: 8 }, (_, i) => `${cat}_${String(i + 1).padStart(2, '0')}`));

/* VP8X hlavicka: priznak alfa kanalu a rozmer platna. */
function webpInfo(path) {
  const b = readFileSync(path);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', `${path}: neni RIFF`);
  assert.equal(b.toString('ascii', 8, 12), 'WEBP', `${path}: neni WebP`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk !== 'VP8X') return { chunk, alpha: chunk === 'VP8L' };
  return {
    chunk,
    alpha: (b[20] & 0x10) !== 0,
    width: 1 + b.readUIntLE(24, 3),
    height: 1 + b.readUIntLE(27, 3),
  };
}

test('kazda postavicka ma .webp s pruhlednym pozadim', () => {
  for (const item of data.ALL_ITEMS) {
    const path = pub(item.src);
    assert.ok(existsSync(path), `${item.id}: chybi ${item.src}`);
    // bez pruhlednosti by z neobjevene postavicky byl misto siluety cerny ctverec
    assert.ok(webpInfo(path).alpha, `${item.id}: obrazek nema pruhledne pozadi`);
  }
});

test('kazda kategorie ma nadpis .webp', () => {
  for (const cat of data.CATEGORY_ORDER) {
    assert.ok(existsSync(pub(data.headerSrc(cat))), `chybi nadpis ${cat}`);
  }
});

/* Predpona ID podle sbirky - dumplingy ji nemaji (byly prvni). */
const ID_PREFIX = { dumplings: '', labubu: 'lab_' };

test('ID ve tvaru <predpona><kategorie>_NN, unikatni, soubory se neopakuji', () => {
  const ids = new Set();
  const srcs = new Set();
  for (const item of data.ALL_ITEMS) {
    assert.ok(item.collection in ID_PREFIX, `${item.id}: sbirka bez predpony v testu`);
    assert.match(item.id, new RegExp(`^${ID_PREFIX[item.collection]}${item.category}_\\d{2}$`));
    assert.match(item.file, /^[a-z0-9_]+$/, `${item.id}: nazev souboru jen bez diakritiky`);
    assert.ok(!ids.has(item.id), `duplicitni ID ${item.id}`);
    assert.ok(!srcs.has(item.src), `duplicitni obrazek ${item.src}`);
    ids.add(item.id);
    srcs.add(item.src);
  }
});

test('ve slozkach neni obrazek, ktery by nikdo nepouzival', () => {
  // pripomenuti, ze novy obrazek potrebuje i radek v rewards-data.js
  const pouzite = new Set(data.ALL_ITEMS.map((i) => i.src));
  for (const key of data.COLLECTION_ORDER) {
    const base = data.COLLECTIONS[key].dir;
    for (const cat of data.CATEGORY_ORDER) {
      const dir = pub(`${base}/${cat}`);
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.webp'))) {
        const src = `${base}/${cat}/${f}`;
        assert.ok(pouzite.has(src), `${src} neni zapsany v rewards-data.js`);
      }
    }
  }
});

test('poradi pro QR prenos: puvodnich 40 na zacatku, pak presne zbytek ID', () => {
  const order = data.TRANSFER_ORDER;
  assert.deepEqual(order.slice(0, 40), PUVODNI_PORADI);
  assert.equal(new Set(order).size, order.length, 'ID se v poradi opakuje');
  assert.deepEqual([...order].sort(), [...data.ALL_IDS].sort(), 'TRANSFER_ORDER musi obsahovat presne vsechna ID');
});

test('puvodnich 40 ID porad existuje - ziskane odmeny se neztrati', () => {
  for (const id of PUVODNI_PORADI) assert.ok(data.ITEM_BY_ID.has(id), `zmizelo ID ${id}`);
});

test('ceske nazvy: neprazdne, unikatni, bez undefined/NaN a bez poskozene diakritiky', () => {
  const names = new Set();
  const brokenPattern = /undefined|NaN|Ã|Å|�/;
  for (const item of data.ALL_ITEMS) {
    assert.ok(typeof item.name === 'string' && item.name.trim().length > 0, `${item.id}: chybi name`);
    assert.ok(!brokenPattern.test(item.name), `${item.id}: podezrely text v name "${item.name}"`);
    assert.ok(!names.has(item.name), `duplicitni nazev "${item.name}"`);
    names.add(item.name);
  }
});
