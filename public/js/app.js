import { OPS, MISSING_LABEL, buildRound, explain, diagnose } from './generator.js';
import * as store from './stats.js';

const el = (id) => document.getElementById(id);
const screens = {
  config: el('screen-config'),
  quiz: el('screen-quiz'),
  result: el('screen-result'),
};

const COUNT_PRESETS = [10, 20, 30];
const MAX_PRESETS = [10, 15, 20, 30, 50, 100];

const THEMES = {
  panda: { label: 'Panda', icon: '🐼', mascot: '🐼' },
  unicorn: { label: 'Jednorožec', icon: '🦄', mascot: '🦄' },
  ocean: { label: 'Oceán', icon: '🐬', mascot: '🐬' },
  kawaii: { label: 'Kawaii', icon: '🌸', mascot: '🌸' },
  aesthetic: { label: 'Aesthetic', icon: '✨', mascot: '✨' },
  gamer: { label: 'Gamer', icon: '🎮', mascot: '🎮' },
  skate: { label: 'Skate', icon: '🛹', mascot: '🛹' },
  music: { label: 'Hudba', icon: '🎧', mascot: '🎧' },
  space: { label: 'Vesmír', icon: '🚀', mascot: '🚀' },
};

let state = store.load();
let config = normalizeConfig(state.config) || { ops: ['add', 'sub'], count: 10, max: 20 };

let round = [];
let index = 0;
let attempts = [];
let locked = false;
let shownAt = 0;
let advanceTimer = null;

function normalizeConfig(raw) {
  if (!raw) return null;
  const ops = Array.isArray(raw.ops) ? raw.ops.filter((o) => o in OPS) : [];
  if (!ops.length) return null;
  return {
    ops,
    count: clamp(Number(raw.count) || 10, 3, 60),
    max: clamp(Number(raw.max) || 20, 5, 1000),
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.classList.toggle('is-active', key === name);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ---------------- zvuk ---------------- */
let audio = null;
function beep(kind) {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'correct' ? [523, 659, 784] : [330, 233];
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = kind === 'correct' ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      const start = audio.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    /* zvuk je jen bonus */
  }
}

/* ---------------- konfety ---------------- */
const CONFETTI_COLORS = ['#ffb703', '#ff6b6b', '#0ecfa0', '#7c5cff', '#3fa9f5', '#ff8fc7'];
function confetti(amount = 16) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = el('confetti');
  for (let i = 0; i < amount; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 220}px`);
    piece.style.animationDuration = `${1.1 + Math.random() * 0.9}s`;
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 2600);
  }
}

/* ---------------- nastavení ---------------- */
function currentTheme() {
  return THEMES[state.theme] ? state.theme : 'panda';
}

function applyTheme() {
  const key = currentTheme();
  document.body.dataset.theme = key;
  el('heroMascot').textContent = THEMES[key].mascot;

  const dark = !!state.dark;
  document.body.classList.toggle('is-dark', dark);
  const btn = el('darkBtn');
  btn.textContent = dark ? '☀️' : '🌙';
  btn.setAttribute('aria-pressed', String(dark));
  btn.setAttribute('aria-label', dark ? 'Přepnout světlý režim' : 'Přepnout tmavý režim');
}

function renderConfigScreen() {
  el('themeChips').innerHTML = Object.entries(THEMES)
    .map(([key, theme]) => {
      const on = key === currentTheme();
      return `<button type="button" class="chip${on ? ' is-on' : ''}" data-value="${key}" aria-pressed="${on}"><span aria-hidden="true">${theme.icon}</span><span>${theme.label}</span></button>`;
    })
    .join('');

  el('opChips').innerHTML = Object.entries(OPS)
    .map(([key, op]) => chipHTML(key, `${op.emoji} ${op.label}`, config.ops.includes(key)))
    .join('');

  el('countChips').innerHTML = COUNT_PRESETS
    .map((n) => chipHTML(n, `${n} příkladů`, config.count === n))
    .join('');

  el('maxChips').innerHTML = MAX_PRESETS
    .map((n) => chipHTML(n, `do ${n}`, config.max === n))
    .join('');

  el('countCustom').value = COUNT_PRESETS.includes(config.count) ? '' : config.count;
  el('maxCustom').value = MAX_PRESETS.includes(config.max) ? '' : config.max;

  const soundBtn = el('soundBtn');
  soundBtn.textContent = state.sound ? '🔊 Zvuk' : '🔇 Zvuk';
  soundBtn.setAttribute('aria-pressed', String(state.sound));

  renderLastHint();
}

function chipHTML(value, label, on) {
  return `<button type="button" class="chip${on ? ' is-on' : ''}" data-value="${value}" aria-pressed="${on}">${label}</button>`;
}

function renderLastHint() {
  const hint = el('lastRoundHint');
  const last = state.rounds[0];
  if (!last) {
    hint.hidden = true;
    return;
  }
  const pct = Math.round((last.correct / last.total) * 100);
  const focus = state.missed.length
    ? ` Do dalšího kola zařadím ${Math.min(state.missed.length, 12)} podobných příkladů, které minule nevyšly.`
    : ' Minule ti nic neuteklo. 🎉';
  hint.textContent = `Naposledy: ${last.correct} z ${last.total} (${pct} %).${focus}`;
  hint.hidden = false;
}

el('darkBtn').addEventListener('click', () => {
  state.dark = !state.dark;
  store.save(state);
  applyTheme();
});

el('themeChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.theme = chip.dataset.value;
  store.save(state);
  applyTheme();
  renderConfigScreen();
});

el('opChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const value = chip.dataset.value;
  const next = config.ops.includes(value) ? config.ops.filter((o) => o !== value) : [...config.ops, value];
  if (!next.length) {
    const err = el('opsError');
    err.hidden = false;
    setTimeout(() => { err.hidden = true; }, 2200);
    return;
  }
  config.ops = next;
  renderConfigScreen();
});

el('countChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  config.count = Number(chip.dataset.value);
  renderConfigScreen();
});

el('maxChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  config.max = Number(chip.dataset.value);
  renderConfigScreen();
});

function bindCustomField(inputId, chipsId, key, min, max) {
  const input = el(inputId);
  input.addEventListener('input', (e) => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || value < min) return;
    config[key] = clamp(value, min, max);
    el(chipsId).querySelectorAll('.chip').forEach((chip) => {
      const on = Number(chip.dataset.value) === config[key];
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  });
  input.addEventListener('blur', () => renderConfigScreen());
}

bindCustomField('countCustom', 'countChips', 'count', 3, 60);
bindCustomField('maxCustom', 'maxChips', 'max', 5, 1000);

el('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  store.save(state);
  renderConfigScreen();
  if (state.sound) beep('correct');
});

el('resetBtn').addEventListener('click', () => {
  if (!confirm('Smazat uložené výsledky a chyby z tohoto prohlížeče?')) return;
  const { sound, theme, dark } = state;
  state = store.load();
  state.skills = {};
  state.missed = [];
  state.rounds = [];
  Object.assign(state, { sound, theme, dark });
  store.save(state);
  renderConfigScreen();
});

el('startBtn').addEventListener('click', startRound);

/* ---------------- kvíz ---------------- */
function startRound() {
  config.max = clamp(config.max, 5, 1000);
  config.count = clamp(config.count, 3, 60);
  round = buildRound(config, state.missed);
  index = 0;
  attempts = [];
  el('dots').innerHTML = round.map(() => '<span class="dot"></span>').join('');
  el('quizScore').textContent = '0';
  show('quiz');
  renderExercise();
}

function renderExercise() {
  clearTimeout(advanceTimer);
  locked = false;
  const ex = round[index];

  el('quizCounter').textContent = `${index + 1} / ${round.length}`;
  el('dots').querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('is-current', i === index));
  el('exerciseHint').textContent = hintFor(ex);
  el('exerciseBody').innerHTML =
    ex.kind === 'bond' ? bondHTML(ex) : ex.kind === 'word' ? wordHTML(ex) : equationHTML(ex);
  el('feedback').hidden = true;
  el('feedback').innerHTML = '';
  el('keypad').dataset.disabled = 'false';

  const input = el('answerInput');
  input.maxLength = String(config.max).length + 1;
  input.focus({ preventScroll: true });
  shownAt = Date.now();
}

function hintFor(ex) {
  if (ex.kind === 'word') return `Slovní úloha – ${OPS[ex.op].name}.`;
  if (ex.kind === 'bond') {
    const relation = ex.family === 'mul' ? 'součin' : 'součet';
    return ex.missing === 'c'
      ? `Nahoře doplň ${relation} obou spodních čísel.`
      : `Nahoře je celek, dole chybí jedna část. Dopočítej ${OPS[ex.op].name}m.`;
  }
  return `${OPS[ex.op].label} – ${MISSING_LABEL[ex.missing]}.`;
}

function wordHTML(ex) {
  return `<p class="story">${ex.story}</p>
    <div class="equation equation-single">${slotHTML()}</div>`;
}

function slotHTML() {
  return `<span class="slot" id="answerSlot"><input id="answerInput" type="text" inputmode="none" autocomplete="off" aria-label="Doplň chybějící číslo"></span>`;
}

function equationHTML(ex) {
  const cell = (key) => (ex.missing === key ? slotHTML() : `<span class="num">${ex[key]}</span>`);
  return `<div class="equation">
      ${cell('a')}
      <span class="eq-op">${OPS[ex.op].symbol}</span>
      ${cell('b')}
      <span class="eq-op">=</span>
      ${cell('c')}
    </div>`;
}

function bondHTML(ex) {
  const box = (key) =>
    ex.missing === key
      ? `<span class="box slot" id="answerSlot"><input id="answerInput" type="text" inputmode="none" autocomplete="off" aria-label="Doplň chybějící číslo"></span>`
      : `<span class="box"><span class="box-value">${ex[key]}</span></span>`;
  return `<div class="bond">
      <div class="bond-row">${box('c')}</div>
      <svg class="bond-arms" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
        <line x1="50" y1="2" x2="20" y2="42" vector-effect="non-scaling-stroke"></line>
        <line x1="50" y1="2" x2="80" y2="42" vector-effect="non-scaling-stroke"></line>
      </svg>
      <div class="bond-row bond-row-bottom">${box('a')}<span class="bond-op" aria-hidden="true">${ex.family === 'mul' ? '×' : '+'}</span>${box('b')}</div>
    </div>`;
}

/* klávesnice */
el('keypad').innerHTML = [...'123456789']
  .map((d) => `<button type="button" class="key" data-key="${d}">${d}</button>`)
  .concat([
    '<button type="button" class="key key-del" data-key="del" aria-label="Smazat">⌫</button>',
    '<button type="button" class="key" data-key="0">0</button>',
    '<button type="button" class="key key-ok" data-key="ok" aria-label="Potvrdit">✓</button>',
  ])
  .join('');

el('keypad').addEventListener('click', (e) => {
  const key = e.target.closest('.key');
  if (!key) return;
  handleKey(key.dataset.key);
});

function handleKey(key) {
  if (locked) return;
  const input = el('answerInput');
  if (!input) return;
  if (key === 'ok') return submit();
  if (key === 'del') {
    input.value = input.value.slice(0, -1);
    return;
  }
  if (input.value.length >= input.maxLength) return;
  input.value += key;
}

// do odpovědi pustíme jen číslice - i při vložení ze schránky
document.addEventListener('input', (e) => {
  if (e.target.id !== 'answerInput') return;
  const digits = e.target.value.replace(/\D+/g, '').slice(0, e.target.maxLength);
  if (digits !== e.target.value) e.target.value = digits;
});

document.addEventListener('keydown', (e) => {
  if (!screens.quiz.classList.contains('is-active')) return;
  if (e.key >= '0' && e.key <= '9') {
    handleKey(e.key);
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    handleKey('del');
    e.preventDefault();
  } else if (e.key === 'Enter') {
    if (locked) {
      const next = el('feedback').querySelector('.btn');
      if (next) next.click();
    } else {
      submit();
    }
    e.preventDefault();
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
});

function submit() {
  if (locked) return;
  const input = el('answerInput');
  const raw = input.value.trim();
  if (raw === '') {
    el('answerSlot').classList.add('is-wrong');
    setTimeout(() => el('answerSlot')?.classList.remove('is-wrong'), 450);
    return;
  }

  locked = true;
  el('keypad').dataset.disabled = 'true';

  const ex = round[index];
  const given = Number(raw);
  const correct = given === ex.answer;

  attempts.push({
    ex,
    given,
    correct,
    ms: Date.now() - shownAt,
    tag: correct ? null : diagnose(ex, given),
  });

  el('answerSlot').classList.add(correct ? 'is-correct' : 'is-wrong');
  el('dots').querySelectorAll('.dot')[index].classList.add(correct ? 'is-correct' : 'is-wrong');
  el('quizScore').textContent = String(attempts.filter((a) => a.correct).length);

  renderFeedback(ex, given, correct);
  beep(correct ? 'correct' : 'wrong');
  if (correct) confetti();
}

/* Grafické vysvětlení pro rozsah do 20: dva řádky po deseti kroužcích.
   Zlom řádku je přesně desítka, takže je vidět přechod přes ni. */
function tenFrameHTML(ex) {
  const relation = ex.kind === 'bond' ? ex.family : ex.op === 'add' || ex.op === 'sub' ? 'add' : null;
  if (relation !== 'add') return '';

  const { a, b, c } = ex;
  const removing = ex.op === 'sub' && ex.kind !== 'bond';
  const total = removing ? a : c;
  if (total > 20) return '';

  const cells = [];
  for (let i = 0; i < 20; i++) {
    let cls = 'tf-cell';
    if (removing) {
      if (i < c) cls += ' tf-a';
      else if (i < a) cls += ' tf-gone';
    } else if (i < a) cls += ' tf-a';
    else if (i < c) cls += ' tf-b';
    cells.push(`<span class="${cls}"></span>`);
  }

  // cestina meni tvar podstatneho jmena podle cislovky i padu
  const circlesGen = (n) => `${n} ${n === 1 ? 'kroužku' : 'kroužků'}`;
  const circlesAcc = (n) => `${n} ${n === 1 ? 'kroužek' : n <= 4 ? 'kroužky' : 'kroužků'}`;

  const caption = removing
    ? `Z ${circlesGen(a)} jsi ${b} odebrala (přeškrtnuté). Zbylo ${c}.`
    : ex.cross
      ? `Nejdřív ${circlesAcc(a)} jednou barvou, pak ${circlesAcc(b)} druhou. První řádek se zaplní do deseti a zbytek přeteče do druhého.`
      : `Nejdřív ${circlesAcc(a)} jednou barvou, pak ${circlesAcc(b)} druhou. Dohromady ${c}.`;

  return `<div class="tenframe" aria-hidden="true">${cells.join('')}</div>
    <p class="tenframe-caption">${caption}</p>`;
}

function renderFeedback(ex, given, correct) {
  const fb = el('feedback');
  fb.dataset.state = correct ? 'correct' : 'wrong';

  if (correct) {
    const praise = ['Správně!', 'Výborně!', 'Přesně tak!', 'Paráda!', 'Skvěle!'];
    fb.innerHTML = `<div class="fb-badge"><span aria-hidden="true">🎉</span> ${praise[index % praise.length]}</div>`;
    fb.hidden = false;
    advanceTimer = setTimeout(next, 1100);
    return;
  }

  const steps = explain(ex).map((s) => `<li>${s}</li>`).join('');
  fb.innerHTML = `
    <div class="fb-badge"><span aria-hidden="true">🤔</span> Tentokrát ne</div>
    <div class="fb-answer">Správně je <b>${ex.answer}</b>${Number.isFinite(given) ? ` <span class="retry-given">(napsala jsi ${given})</span>` : ''}</div>
    <p class="fb-steps-title">Jak na to:</p>
    <ul class="fb-steps">${steps}</ul>
    ${tenFrameHTML(ex)}
    <button type="button" class="btn btn-primary">Rozumím, další <span aria-hidden="true">➜</span></button>`;
  fb.hidden = false;
  fb.querySelector('.btn').addEventListener('click', next);
}

function next() {
  clearTimeout(advanceTimer);
  index += 1;
  if (index >= round.length) finish();
  else renderExercise();
}

el('quitBtn').addEventListener('click', () => {
  if (!confirm('Ukončit trénink? Rozpočítané kolo se nezapočítá.')) return;
  clearTimeout(advanceTimer);
  show('config');
  renderConfigScreen();
});

/* ---------------- výsledek ---------------- */
function finish() {
  const report = store.analyze(state, config, attempts);
  store.recordRound(state, config, attempts);
  renderResult(report);
  show('result');
  if (report.pct >= 70) confetti(46);
}

function verdictFor(pct) {
  if (pct >= 95) return { mascot: '🏆', text: 'Perfektní!' };
  if (pct >= 80) return { mascot: '🎉', text: 'Moc dobře!' };
  if (pct >= 60) return { mascot: '💪', text: 'Dobrá práce!' };
  if (pct >= 40) return { mascot: '🌱', text: 'Zlepšuješ se!' };
  return { mascot: THEMES[currentTheme()].mascot, text: 'Nevzdávej to!' };
}

function renderResult(r) {
  const verdict = verdictFor(r.pct);
  const stars = '⭐'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
  const trend =
    r.trend === null
      ? ''
      : `<p class="trend">${r.trend > 0 ? `📈 O ${r.trend} % lepší než minule!` : r.trend < 0 ? `📉 O ${Math.abs(r.trend)} % méně než minule – nic se neděje.` : '➡️ Stejně jako minule.'}</p>`;

  const bars = r.byOp
    .map(
      (g) => `<div class="bar-row">
        <span>${OPS[g.key].emoji} ${OPS[g.key].label}</span>
        <span class="bar-track"><span class="bar-fill" data-level="${g.pct >= 80 ? 'high' : g.pct >= 50 ? 'mid' : 'low'}" style="width:${g.pct}%"></span></span>
        <span class="bar-pct">${g.correct}/${g.seen}</span>
      </div>`,
    )
    .join('');

  const listCard = (title, emoji, items, icon) =>
    items.length
      ? `<div class="card">
          <h2 class="card-title"><span aria-hidden="true">${emoji}</span> ${title}</h2>
          <ul class="list">${items.map((t) => `<li><span aria-hidden="true">${icon}</span><span>${t}</span></li>`).join('')}</ul>
        </div>`
      : '';

  const retry = r.missedList.length
    ? `<div class="card">
        <h2 class="card-title"><span aria-hidden="true">🔁</span> K procvičení (${r.missedList.length})</h2>
        <ul class="retry-list">${r.missedList
          .map(
            (m) => `<li>
              <span class="retry-eq">${m.text}</span>
              <span><span class="retry-right">→ ${m.answer}</span> <span class="retry-given">${m.given} ✗</span></span>
            </li>`,
          )
          .join('')}</ul>
        <p class="fb-steps-title">Podobné příklady se objeví v dalším kole.</p>
      </div>`
    : `<div class="card"><h2 class="card-title"><span aria-hidden="true">✨</span> Bez jediné chyby!</h2>
        <p style="margin:0;font-weight:700;color:var(--ink-soft)">Nic k procvičení – tohle byla čistá práce.</p></div>`;

  const avg = r.avgMs ? `<p class="score-sub">Průměrně ${(r.avgMs / 1000).toFixed(1)} s na příklad</p>` : '';

  el('resultBody').innerHTML = `
    <div class="result-head">
      <div class="result-mascot" aria-hidden="true">${verdict.mascot}</div>
      <p class="result-verdict">${verdict.text}</p>
      <div class="ring" style="--pct:${r.pct}">
        <div class="ring-inner">
          <div>
            <div class="score-big">${r.correct}/${r.total}</div>
            <div class="score-sub">${r.pct} %</div>
          </div>
        </div>
      </div>
      <div class="stars" aria-label="${r.stars} z 5 hvězd">${stars}</div>
      ${trend}
      ${avg}
    </div>

    <div class="card">
      <h2 class="card-title"><span aria-hidden="true">📊</span> Podle operací</h2>
      <div class="bars">${bars}</div>
    </div>

    ${listCard('Co ti šlo dobře', '💚', r.strengths, '✔')}
    ${listCard('Na co si dát pozor', '🔎', r.watchOuts, '•')}
    ${listCard('Co zkusit dál', '💡', r.tips, '→')}
    ${retry}`;
}

el('againBtn').addEventListener('click', startRound);
el('backToConfigBtn').addEventListener('click', () => {
  show('config');
  renderConfigScreen();
});

applyTheme();
renderConfigScreen();
