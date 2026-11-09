import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeomRound, explain, exToText } from '../public/js/generator.js';
import { geoSVG } from '../public/js/geokresba.js';

/* Generátor Geometrie: projede pár tisíc úloh na každé obtížnosti.
   Vady se objevují jednou za sto, deset úloh by nic neukázalo. */
const ROUNDS = 300; // × 10 úloh × 3 obtížnosti = 9000 úloh
const TASKS = ['utvar', 'najdi', 'cary', 'kolem'];

// záludné dvojice, které se na lehké úrovni nesmí potkat
const EASY_TRAP = {
  ctverec: 'obdelnik', obdelnik: 'ctverec', kruh: 'kruznice',
  krychle: 'kvadr', kvadr: 'krychle', usecka: 'primka', primka: 'usecka',
};

function eachExercise(level, fn) {
  for (let i = 0; i < ROUNDS; i++) {
    for (const ex of buildGeomRound({ level, geomTasks: TASKS, geomCount: 10 })) fn(ex);
  }
}

for (const level of ['easy', 'medium', 'hard']) {
  test(`${level}: prave jedna spravna moznost, zadna dvakrat`, () => {
    const n = level === 'easy' ? 3 : 4;
    eachExercise(level, (ex) => {
      const oks = ex.options.filter((o) => o.ok);
      assert.equal(oks.length, 1, ex.key);
      assert.equal(oks[0].text, ex.answer, ex.key);
      assert.equal(ex.options.length, n, ex.key);
      assert.equal(new Set(ex.options.map((o) => o.text)).size, n, ex.key);
      for (const o of ex.options) if (!o.ok) assert.ok(o.tag, `${ex.key}: chybi tag`);
    });
  });

  test(`${level}: texty bez undefined a NaN`, () => {
    eachExercise(level, (ex) => {
      const texts = [ex.text, ...ex.options.map((o) => o.text), ...explain(ex), exToText(ex, true)];
      for (const t of texts) assert.doesNotMatch(String(t), /undefined|NaN|null/, ex.key);
    });
  });

  test(`${level}: obrazky bez NaN a uvnitr plochy`, () => {
    eachExercise(level, (ex) => {
      const figs = [ex.fig, ...ex.options.map((o) => o.fig)].filter(Boolean);
      for (const s of figs.map(geoSVG)) {
        assert.doesNotMatch(s, /NaN|undefined/, ex.key);
        const nums = [...s.matchAll(/(?:points|d)="([^"]+)"/g)]
          .flatMap((m) => m[1].match(/-?\d+(\.\d+)?/g).map(Number));
        // čáry mají plochu 160 px na šířku, ostatní 120
        for (const v of nums) assert.ok(v >= -2 && v <= 162, `${ex.key}: ${v} mimo plochu`);
      }
    });
  });
}

test('easy: zadna zaludna dvojice mezi moznostmi', () => {
  eachExercise('easy', (ex) => {
    assert.ok(!ex.options.some((o) => o.key === EASY_TRAP[ex.shape]), ex.key);
  });
});

test('hard: zaludna dvojice v moznostech je', () => {
  eachExercise('hard', (ex) => {
    if (!EASY_TRAP[ex.shape]) return;
    assert.ok(ex.options.some((o) => o.key === EASY_TRAP[ex.shape]), ex.key);
  });
});
