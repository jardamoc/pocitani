import { OPS, signature, exToText, TAGS } from './generator.js';

const KEY = 'pocitani.v1';

const emptyState = () => ({
  config: null,
  theme: 'panda',
  dark: false,
  sound: true,
  skills: {},
  missed: [],
  rounds: [],
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch {
    return emptyState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* privátní režim nebo zakázané ukládání - aplikace funguje i bez historie */
  }
}

/* Druhy úloh, které se nedají z descriptoru znovu poskládat. */
const NO_REPEAT = new Set(['riddle', 'grid']);

const descriptor = (ex) => ({
  op: ex.op,
  kind: ex.kind,
  missing: ex.missing,
  a: ex.a,
  b: ex.b,
  c: ex.c,
  cross: ex.cross,
});

export function recordRound(state, config, attempts) {
  state.config = config;

  for (const at of attempts) {
    const skill = at.ex.skill;
    const s = (state.skills[skill] ||= { seen: 0, wrong: 0 });
    s.seen += 1;
    if (!at.correct) s.wrong += 1;
  }

  /* Hádanky ani mřížky se do "co si zopakovat" neukládají - každá je pokaždé
     jiná, takže by se nedaly znovu složit a jen by vytlačily skutečné
     příklady. `descriptor` z nich navíc uchová jen a, b, c, což nestačí. */
  const solved = new Set(attempts.filter((a) => a.correct).map((a) => signature(a.ex)));
  const fresh = attempts.filter((a) => !a.correct && !NO_REPEAT.has(a.ex.kind)).map((a) => descriptor(a.ex));

  state.missed = [...fresh, ...state.missed.filter((m) => !solved.has(signature(m)))]
    .filter((m, i, arr) => arr.findIndex((x) => signature(x) === signature(m)) === i)
    .slice(0, 40);

  const correct = attempts.filter((a) => a.correct).length;
  state.rounds = [
    { at: Date.now(), total: attempts.length, correct, max: config.max, ops: config.ops, mode: config.mode || 'calc' },
    ...state.rounds,
  ].slice(0, 20);

  save(state);
  return state;
}

function group(attempts, keyFn) {
  const map = new Map();
  for (const at of attempts) {
    const key = keyFn(at);
    if (key === null) continue;
    const g = map.get(key) || { key, seen: 0, correct: 0 };
    g.seen += 1;
    if (at.correct) g.correct += 1;
    map.set(key, g);
  }
  return [...map.values()].map((g) => ({ ...g, pct: Math.round((g.correct / g.seen) * 100) }));
}

/* Dva tvary, protože čeština po předložce "u" žádá 2. pád:
   "všechny pyramidy" × "nejvíc chyb máš u pyramid". */
const KIND_LABEL = {
  'equation:c': { acc: 'příklady s chybějícím výsledkem', gen: 'příkladů s chybějícím výsledkem' },
  'equation:a': { acc: 'příklady s chybějícím prvním číslem', gen: 'příkladů s chybějícím prvním číslem' },
  'equation:b': { acc: 'příklady s chybějícím druhým číslem', gen: 'příkladů s chybějícím druhým číslem' },
  'bond:c': { acc: 'pyramidy s chybějícím celkem', gen: 'pyramid s chybějícím celkem' },
  'bond:a': { acc: 'pyramidy s chybějící částí', gen: 'pyramid s chybějící částí' },
  'bond:b': { acc: 'pyramidy s chybějící částí', gen: 'pyramid s chybějící částí' },
  'word:c': { acc: 'slovní úlohy na výsledek', gen: 'slovních úloh na výsledek' },
  'word:a': { acc: 'slovní úlohy na počátek', gen: 'slovních úloh na počátek' },
  'word:b': { acc: 'slovní úlohy na změnu', gen: 'slovních úloh na změnu' },
  'riddle:c': { acc: 'obrázkové hádanky', gen: 'obrázkových hádanek' },
  'sign:op': { acc: 'příklady s chybějícím znaménkem', gen: 'příkladů s chybějícím znaménkem' },
  'grid:c': { acc: 'mřížky', gen: 'mřížek' },
};

function starsFor(pct) {
  if (pct >= 95) return 5;
  if (pct >= 85) return 4;
  if (pct >= 70) return 3;
  if (pct >= 50) return 2;
  if (pct > 0) return 1;
  return 0;
}

function mostMissedFactor(attempts) {
  const counts = new Map();
  for (const at of attempts) {
    if (at.correct) continue;
    const { op, a, b } = at.ex;
    if (op !== 'mul' && op !== 'div') continue;
    const factors = op === 'mul' ? [a, b] : [b, at.ex.c];
    for (const f of factors) {
      if (f >= 2 && f <= 10) counts.set(f, (counts.get(f) || 0) + 1);
    }
  }
  let best = null;
  for (const [f, n] of counts) if (!best || n > best.n) best = { f, n };
  return best?.f ?? null;
}

const LEVEL_ORDER = ['easy', 'medium', 'hard'];
const LEVEL_NAME = { easy: 'Lehké', medium: 'Střední', hard: 'Těžké' };

export function analyze(state, config, attempts) {
  const riddleMode = config.mode === 'riddle';
  const gridMode = config.mode === 'grid';
  /* Režimy, kde se rozpad podle operací nehodí - hádanky i mřížky mají
     `op: 'add'` jen jako zástupnou hodnotu, takže by "přechod přes desítku"
     i rady k násobilce říkaly nesmysl. Jedeme podle obtížnosti. */
  const levelMode = riddleMode || gridMode;
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;

  const byOp = group(attempts, (a) => a.ex.op).sort((x, y) => y.seen - x.seen);
  const byLevel = group(attempts, (a) => a.ex.level || null)
    .sort((x, y) => LEVEL_ORDER.indexOf(x.key) - LEVEL_ORDER.indexOf(y.key));
  const byKind = group(attempts, (a) => `${a.ex.kind}:${a.ex.missing}`).sort((x, y) => y.seen - x.seen);
  const crossGroup = group(attempts, (a) => (a.ex.op === 'add' || a.ex.op === 'sub' ? (a.ex.cross ? 'cross' : 'plain') : null));
  const cross = crossGroup.find((g) => g.key === 'cross') || null;

  const tags = new Map();
  for (const at of attempts) {
    if (!at.tag) continue;
    tags.set(at.tag, (tags.get(at.tag) || 0) + 1);
  }

  const times = attempts.map((a) => a.ms).filter((ms) => ms > 0 && ms < 120000);
  const avgMs = times.length ? Math.round(times.reduce((s, ms) => s + ms, 0) / times.length) : 0;

  const strengths = [];
  const watchOuts = [];
  const tips = [];

  /* V režimu hádanek je všechno sčítání, takže rozpad podle operací i
     přechod přes desítku by říkaly nesmysl. Místo nich jedeme podle
     obtížnosti. */
  for (const g of levelMode ? byLevel : byOp) {
    // "Sčítání ti jde" × "Lehké hádanky ti jdou" - jiný rod i číslo
    const name = levelMode ? `${LEVEL_NAME[g.key]} ${gridMode ? 'mřížky' : 'hádanky'}` : OPS[g.key].label;
    const goes = levelMode ? 'jdou' : 'jde';
    const hard = levelMode ? 'dřou' : 'dře';
    if (g.seen >= 3 && g.pct >= 85) strengths.push(`${name} ti ${goes} výborně – ${g.correct} z ${g.seen} správně.`);
    if (g.seen >= 2 && g.pct < 70) watchOuts.push(`${name} ještě ${hard} – ${g.correct} z ${g.seen}.`);
  }
  for (const g of byKind) {
    const label = KIND_LABEL[g.key];
    if (!label) continue;
    if (g.seen >= 3 && g.pct === 100) strengths.push(`Zvládla jsi všechny ${label.acc} bez chyby.`);
    if (g.seen >= 3 && g.pct < 60) watchOuts.push(`Nejvíc chyb máš u ${label.gen}.`);
  }
  if (!levelMode && cross && cross.seen >= 3) {
    if (cross.pct >= 85) strengths.push(`Přechod přes desítku ti jde (${cross.correct} z ${cross.seen}). To je ta nejtěžší část!`);
    else if (cross.pct < 65) watchOuts.push(`Přechod přes desítku dělá potíže – ${cross.correct} z ${cross.seen}.`);
  }
  if (pct >= 80 && avgMs > 0 && avgMs < 7000) strengths.push('Počítáš rychle a přesně zároveň.');

  if (tags.get('offOne') >= 2) watchOuts.push('Několikrát ti výsledek utekl jen o jedničku – vyplatí se na konci zkontrolovat.');
  if (tags.get('riddleSymbol') >= 1) watchOuts.push('U hádanky se občas napsalo, kolik je jeden obrázek. Poslední řádek chce součet celého řádku.');
  if (!levelMode) {
    if (tags.get('inverse') >= 2) watchOuts.push('U příkladů s chybějícím číslem se občas počítalo opačně (sčítalo se místo odčítání).');
    if (tags.get('swapOp') >= 1) watchOuts.push('Někdy se popletlo znaménko – vždycky se podívej, jestli je tam + nebo −.');
  }
  if (tags.get('offTen') >= 2) watchOuts.push('Občas se spletla desítka (např. 24 místo 14).');

  if (gridMode) {
    if (pct < 100) {
      tips.push('V mřížce hledej řádek nebo sloupec, kde chybí jediné kolečko – od něj se rozmotá zbytek.');
    }
    if (attempts.some((a) => a.retried)) {
      tips.push('Když ti roh nesedí, přepočítej ho i druhým směrem. Musí vyjít stejně doprava i dolů.');
    }
    if (pct === 100) {
      const harder = { easy: 'střední', medium: 'těžkou' }[config.level];
      tips.push(harder
        ? `Zvládla jsi ji – zkus příště ${harder} obtížnost, mřížka bude o řádek větší.`
        : 'Zvládla jsi největší mřížku. Zkus zvýšit rozsah, čísla budou vyšší.');
    }
  } else if (riddleMode) {
    const weakLevel = byLevel.find((g) => g.seen >= 2 && g.pct < 70);
    if (weakLevel) {
      tips.push('Hádanky luští odshora dolů: první řádek prozradí jeden obrázek a v každém dalším pak zbývá dopočítat už jenom jeden.');
    }
    if (attempts.some((a) => a.retried)) {
      tips.push('Než odpovíš, napiš si u každého obrázku, kolik je. Pak už je poslední řádek jen sčítání.');
    }
    if (pct >= 90) {
      const harder = { easy: 'střední', medium: 'těžkou' }[config.level];
      tips.push(harder
        ? `Šlo ti to skvěle – zkus příště ${harder} obtížnost, přibude obrázek navíc.`
        : 'Šlo ti to skvěle – tohle už je nejtěžší obtížnost hádanek.');
    }
  } else {
    if (cross && cross.pct < 65 && cross.seen >= 3) {
      tips.push('Trénuj rozklad do desítky: 8 + 5 → 8 + 2 = 10, pak 10 + 3 = 13.');
    }
    const weakOp = byOp.find((g) => g.seen >= 2 && g.pct < 70);
    if (weakOp?.key === 'sub') tips.push('U odčítání pomáhá číselná osa – skákej dozadu nejdřív k desítce.');
    if (weakOp?.key === 'add') tips.push('U sčítání zkoušej rozklad na desítku, ať nemusíš počítat po jedné.');
    if (weakOp?.key === 'mul' || weakOp?.key === 'div') {
      const f = mostMissedFactor(attempts);
      tips.push(f ? `Zopakuj si násobilku ${f} – právě u ní se objevilo nejvíc chyb.` : 'Zopakuj si malou násobilku, dělení pak půjde samo.');
    }
    const inverseWeak = byKind.find((g) => g.key.endsWith(':a') || g.key.endsWith(':b'));
    if (tags.get('inverse') >= 2 || (inverseWeak && inverseWeak.seen >= 3 && inverseWeak.pct < 60)) {
      tips.push('Když chybí číslo uprostřed (8 + __ = 17), obrať to na odčítání: 17 − 8.');
    }
    if (pct >= 90) {
      tips.push(`Šlo ti to skvěle – zkus zvýšit rozsah na ${Math.min(1000, config.max * 2)} nebo přidat další operaci.`);
    }
  }
  if (!tips.length) tips.push('Jsi na dobré cestě. Klidně dej ještě jedno kolo se stejným nastavením.');

  // u chybějícího znaménka je odpovědí operace, do výpisu patří její symbol
  const asShown = (ex, value) => (ex.kind === 'sign' ? OPS[value]?.symbol ?? '?' : value);
  const missedList = attempts.filter((a) => !a.correct).map((a) => ({
    text: exToText(a.ex, false),
    answer: asShown(a.ex, a.ex.answer),
    given: asShown(a.ex, a.given),
    tag: a.tag ? TAGS[a.tag] : null,
  }));

  // porovnáváme jen s kolem ze stejného režimu, jinak by trend nedával smysl
  const previous = state.rounds.find((r) => (r.mode || 'calc') === (config.mode || 'calc')) || null;
  const trend = previous && previous.total
    ? pct - Math.round((previous.correct / previous.total) * 100)
    : null;

  return {
    total,
    correct,
    pct,
    stars: starsFor(pct),
    byOp,
    byLevel,
    byKind: byKind.map((g) => ({ ...g, label: KIND_LABEL[g.key]?.acc || g.key })),
    cross,
    avgMs,
    strengths: strengths.slice(0, 3),
    watchOuts: watchOuts.slice(0, 3),
    tips: tips.slice(0, 3),
    missedList,
    trend,
    repeatCount: attempts.filter((a) => a.repeat).length,
  };
}
