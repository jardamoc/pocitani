import { OPS, signature, exToText, TAGS } from './generator.js';

const KEY = 'pocitani.v1';

const emptyState = () => ({
  config: null,
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

  const solved = new Set(attempts.filter((a) => a.correct).map((a) => signature(a.ex)));
  const fresh = attempts.filter((a) => !a.correct).map((a) => descriptor(a.ex));

  state.missed = [...fresh, ...state.missed.filter((m) => !solved.has(signature(m)))]
    .filter((m, i, arr) => arr.findIndex((x) => signature(x) === signature(m)) === i)
    .slice(0, 40);

  const correct = attempts.filter((a) => a.correct).length;
  state.rounds = [
    { at: Date.now(), total: attempts.length, correct, max: config.max, ops: config.ops },
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

const KIND_LABEL = {
  'equation:c': 'příklady s chybějícím výsledkem',
  'equation:a': 'příklady s chybějícím prvním číslem',
  'equation:b': 'příklady s chybějícím druhým číslem',
  'bond:c': 'pyramidy s chybějícím celkem',
  'bond:a': 'pyramidy s chybějící částí',
  'bond:b': 'pyramidy s chybějící částí',
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

export function analyze(state, config, attempts) {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;

  const byOp = group(attempts, (a) => a.ex.op).sort((x, y) => y.seen - x.seen);
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

  for (const g of byOp) {
    if (g.seen >= 3 && g.pct >= 85) strengths.push(`${OPS[g.key].label} ti jde výborně – ${g.correct} z ${g.seen} správně.`);
    if (g.seen >= 2 && g.pct < 70) watchOuts.push(`${OPS[g.key].label} ještě dře – ${g.correct} z ${g.seen}.`);
  }
  for (const g of byKind) {
    const label = KIND_LABEL[g.key];
    if (!label) continue;
    if (g.seen >= 3 && g.pct === 100) strengths.push(`Zvládla jsi všechny ${label} bez chyby.`);
    if (g.seen >= 3 && g.pct < 60) watchOuts.push(`Nejvíc chyb máš u ${label}.`);
  }
  if (cross && cross.seen >= 3) {
    if (cross.pct >= 85) strengths.push(`Přechod přes desítku ti jde (${cross.correct} z ${cross.seen}). To je ta nejtěžší část!`);
    else if (cross.pct < 65) watchOuts.push(`Přechod přes desítku dělá potíže – ${cross.correct} z ${cross.seen}.`);
  }
  if (pct >= 80 && avgMs > 0 && avgMs < 7000) strengths.push('Počítáš rychle a přesně zároveň.');

  if (tags.get('offOne') >= 2) watchOuts.push('Několikrát ti výsledek utekl jen o jedničku – vyplatí se na konci zkontrolovat.');
  if (tags.get('inverse') >= 2) watchOuts.push('U příkladů s chybějícím číslem se občas počítalo opačně (sčítalo se místo odčítání).');
  if (tags.get('swapOp') >= 1) watchOuts.push('Někdy se popletlo znaménko – vždycky se podívej, jestli je tam + nebo −.');
  if (tags.get('offTen') >= 2) watchOuts.push('Občas se spletla desítka (např. 24 místo 14).');

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
  if (!tips.length) tips.push('Jsi na dobré cestě. Klidně dej ještě jedno kolo se stejným nastavením.');

  const missedList = attempts.filter((a) => !a.correct).map((a) => ({
    text: exToText(a.ex, false),
    answer: a.ex.answer,
    given: a.given,
    tag: a.tag ? TAGS[a.tag] : null,
  }));

  const previous = state.rounds[0] || null;
  const trend = previous && previous.total
    ? pct - Math.round((previous.correct / previous.total) * 100)
    : null;

  return {
    total,
    correct,
    pct,
    stars: starsFor(pct),
    byOp,
    byKind: byKind.map((g) => ({ ...g, label: KIND_LABEL[g.key] || g.key })),
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
