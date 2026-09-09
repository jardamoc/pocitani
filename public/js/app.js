import { OPS, EXTRA_KINDS, MISSING_LABEL, buildRound, explain, diagnose } from './generator.js';
import * as store from './stats.js';

const el = (id) => document.getElementById(id);
const screens = {
  config: el('screen-config'),
  quiz: el('screen-quiz'),
  result: el('screen-result'),
};

const COUNT_PRESETS = [10, 20, 30];
const MAX_PRESETS = [10, 15, 20, 30, 50, 100];

/* `start` je ikona na tlacitku Zacit. Zamerne to neni maskot - ten uz kouka
   z hlavicky, tady se hodi neco, co znamena "jdeme". */
const THEMES = {
  panda: { label: 'Panda', icon: '🐼', mascot: '🐼', start: '🐾' },
  unicorn: { label: 'Jednorožec', icon: '🦄', mascot: '🦄', start: '🌈' },
  ocean: { label: 'Oceán', icon: '🐬', mascot: '🐬', start: '🌊' },
  kawaii: { label: 'Kawaii', icon: '🌸', mascot: '🌸', start: '🎀' },
  aesthetic: { label: 'Aesthetic', icon: '✨', mascot: '✨', start: '✨' },
  music: { label: 'Hudba', icon: '🎧', mascot: '🎧', start: '🎶' },
};

/* Kulisa pro kazde tema. `m` je druh pohybu (viz .decor-* v CSS), `top`/`left`
   jsou procenta okna, `size` px, `dur` sekundy jednoho cyklu, `delay` sekundy
   posunu, aby prvky nesly v zakrytu. Mraky nechavame jen tam, kde je nad
   scenou obloha - pod vodou ani v koncertnim svetle nedavaly smysl. */
const SCENERY = {
  panda: {
    clouds: 2,
    items: [
      { e: '🐼', m: 'walk', top: 74, left: 14, size: 34, dur: 32 },
      { e: '🐼', m: 'walk', top: 83, left: 62, size: 26, dur: 44, delay: 8 },
      { e: '🎍', m: 'walk', top: 79, left: 38, size: 30, dur: 56, delay: 19 },
      { e: '🌿', m: 'sway', top: 86, left: 8, size: 26, dur: 5 },
      { e: '🌿', m: 'sway', top: 88, left: 88, size: 22, dur: 6, delay: 1.5 },
    ],
  },
  unicorn: {
    clouds: 2,
    items: [
      { e: '🦄', m: 'float', top: 11, left: 18, size: 36, dur: 40 },
      { e: '🌈', m: 'float', top: 70, left: 64, size: 34, dur: 58, delay: 12 },
      { e: '⭐', m: 'twinkle', top: 7, left: 78, size: 20, dur: 3.4 },
      { e: '⭐', m: 'twinkle', top: 78, left: 12, size: 16, dur: 4.2, delay: 1.1 },
      { e: '✨', m: 'twinkle', top: 44, left: 46, size: 18, dur: 3.8, delay: 2 },
    ],
  },
  ocean: {
    clouds: 0,
    items: [
      { e: '🐬', m: 'swim', top: 9, left: 22, size: 38, dur: 36 },
      { e: '🐠', m: 'swim', top: 75, left: 66, size: 28, dur: 26, delay: 5 },
      { e: '🐟', m: 'swim', top: 17, left: 34, size: 24, dur: 32, delay: 13 },
      { e: '🐡', m: 'swim', top: 68, left: 78, size: 26, dur: 44, delay: 21 },
      { e: '🫧', m: 'rise', top: 40, left: 16, size: 20, dur: 14 },
      { e: '🫧', m: 'rise', top: 30, left: 84, size: 16, dur: 18, delay: 6 },
      { e: '🪸', m: 'sway', top: 84, left: 50, size: 28, dur: 6 },
    ],
  },
  kawaii: {
    clouds: 1,
    items: [
      { e: '🌸', m: 'fall', top: 20, left: 14, size: 24, dur: 17, sway: -50 },
      { e: '🌸', m: 'fall', top: 44, left: 54, size: 18, dur: 22, delay: 5, sway: 70 },
      { e: '🌷', m: 'fall', top: 66, left: 82, size: 22, dur: 26, delay: 11, sway: -40 },
      { e: '🌼', m: 'sway', top: 84, left: 12, size: 28, dur: 5 },
      { e: '🌷', m: 'sway', top: 86, left: 44, size: 26, dur: 6, delay: 1.2 },
      { e: '🌼', m: 'sway', top: 83, left: 78, size: 24, dur: 5.5, delay: 2.4 },
    ],
  },
  aesthetic: {
    clouds: 1,
    items: [
      { e: '✨', m: 'twinkle', top: 8, left: 20, size: 24, dur: 3.2 },
      { e: '✨', m: 'twinkle', top: 76, left: 76, size: 20, dur: 4, delay: 1.3 },
      { e: '🦋', m: 'float', top: 14, left: 40, size: 28, dur: 42 },
      { e: '🫧', m: 'rise', top: 46, left: 62, size: 18, dur: 20, delay: 4 },
      { e: '🌷', m: 'sway', top: 85, left: 24, size: 24, dur: 6 },
      { e: '🌸', m: 'sway', top: 87, left: 70, size: 22, dur: 5.2, delay: 1.8 },
    ],
  },
  music: {
    clouds: 0,
    items: [
      { e: '🎵', m: 'float', top: 8, left: 22, size: 30, dur: 30 },
      { e: '🎶', m: 'float', top: 73, left: 68, size: 26, dur: 38, delay: 9 },
      { e: '🎸', m: 'float', top: 15, left: 36, size: 34, dur: 52, delay: 18 },
      { e: '🎺', m: 'float', top: 68, left: 84, size: 28, dur: 46, delay: 27 },
      { e: '🥁', m: 'sway', top: 83, left: 18, size: 30, dur: 5 },
      { e: '🎹', m: 'sway', top: 85, left: 72, size: 28, dur: 6.4, delay: 1.6 },
    ],
  },
};

let state = store.load();
let config = normalizeConfig(state.config) || { ops: ['add', 'sub'], kinds: ['word', 'bond'], count: 10, max: 20 };

let round = [];
let index = 0;
let attempts = [];
let locked = false;
let shownAt = 0;
let advanceTimer = null;
let clockTimer = null;

/* Barevne zastavky hodin. Mezi nimi se interpoluje, takze barva prejizdi
   plynule - v 15 s je presne zluta, ve 30 s oranzova, v 60 s cervena.
   Po minute uz zustava cervena. */
const CLOCK_STOPS = [
  { t: 0, rgb: [34, 197, 94] },
  { t: 15, rgb: [234, 179, 8] },
  { t: 30, rgb: [249, 115, 22] },
  { t: 45, rgb: [234, 88, 12] },
  { t: 60, rgb: [220, 38, 38] },
];
const CLOCK_MAX = 60;
const CLOCK_CIRC = 2 * Math.PI * 16; // r=16 ve viewBoxu SVG

function normalizeConfig(raw) {
  if (!raw) return null;
  const ops = Array.isArray(raw.ops) ? raw.ops.filter((o) => o in OPS) : [];
  if (!ops.length) return null;
  // starsi ulozene nastaveni druhy nezna a mivalo je oba zapnute
  const kinds = Array.isArray(raw.kinds)
    ? raw.kinds.filter((k) => k in EXTRA_KINDS)
    : Object.keys(EXTRA_KINDS);
  return {
    ops,
    kinds,
    count: clamp(Number(raw.count) || 10, 3, 60),
    max: clamp(Number(raw.max) || 20, 5, 1000),
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function show(name) {
  for (const [key, node] of Object.entries(screens)) node.classList.toggle('is-active', key === name);
  document.body.classList.toggle('is-quiz', name === 'quiz');
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

function renderScenery() {
  const spec = SCENERY[currentTheme()] || { clouds: 3, items: [] };
  const parts = [];
  for (let i = 0; i < spec.clouds; i++) parts.push(`<div class="cloud cloud-${i + 1}"></div>`);
  for (const it of spec.items) {
    const style = [
      `--top:${it.top}vh`,
      `--left:${it.left}vw`,
      `--size:${it.size}px`,
      `--dur:${it.dur}s`,
      `--delay:-${it.delay || 0}s`,
      `--sway:${it.sway || 0}px`,
    ].join(';');
    parts.push(`<span class="decor decor-${it.m}" style="${style}">${it.e}</span>`);
  }
  el('sceneryDecor').innerHTML = parts.join('');
}

function applyTheme() {
  const key = currentTheme();
  document.body.dataset.theme = key;
  el('heroMascot').textContent = THEMES[key].mascot;
  el('startIcon').textContent = THEMES[key].start;
  renderScenery();

  const dark = !!state.dark;
  document.body.classList.toggle('is-dark', dark);
  // dva prepinace: plovouci na nastaveni a vysledku, druhy v liste kvizu
  for (const btn of [el('darkBtn'), el('darkBtnQuiz')]) {
    btn.textContent = dark ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Přepnout světlý režim' : 'Přepnout tmavý režim');
  }
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

  el('kindChips').innerHTML = Object.entries(EXTRA_KINDS)
    .map(([key, kind]) => chipHTML(key, `${kind.emoji} ${kind.label}`, config.kinds.includes(key)))
    .join('');

  el('countChips').innerHTML = COUNT_PRESETS
    .map((n) => chipHTML(n, `${n} příkladů`, config.count === n))
    .join('');

  el('maxChips').innerHTML = MAX_PRESETS
    .map((n) => chipHTML(n, `do ${n}`, config.max === n))
    .join('');

  renderKindNote();

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

/* Zapnuty druh, ktery se k vybranym operacim nehodi, by tise vypadl.
   Radeji to rekneme nahlas, ať je jasné, proč v kole není. */
function renderKindNote() {
  const note = el('kindNote');
  const blocked = config.kinds.filter((k) => !config.ops.some((o) => EXTRA_KINDS[k].ops.includes(o)));
  if (!blocked.length) {
    note.hidden = true;
    return;
  }
  note.textContent = blocked
    .map((k) => `${EXTRA_KINDS[k].label} jdou jen u ${EXTRA_KINDS[k].ops.map((o) => OPS[o].name).join(' a ')}.`)
    .join(' ') + ' Přidej si je nahoře, jinak se v kole neobjeví.';
  note.hidden = false;
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

for (const id of ['darkBtn', 'darkBtnQuiz']) {
  el(id).addEventListener('click', () => {
    state.dark = !state.dark;
    store.save(state);
    applyTheme();
  });
}

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

/* Na rozdil od operaci je prazdny vyber v poradku - pak jsou v kole
   jen obycejne priklady. */
el('kindChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const value = chip.dataset.value;
  config.kinds = config.kinds.includes(value)
    ? config.kinds.filter((k) => k !== value)
    : [...config.kinds, value];
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

/* ---------------- hodiny ---------------- */
function clockColor(sec) {
  const stops = CLOCK_STOPS;
  if (sec <= stops[0].t) return `rgb(${stops[0].rgb.join(',')})`;
  const last = stops[stops.length - 1];
  if (sec >= last.t) return `rgb(${last.rgb.join(',')})`;
  const i = stops.findIndex((s) => s.t > sec);
  const from = stops[i - 1];
  const to = stops[i];
  const k = (sec - from.t) / (to.t - from.t);
  const mix = from.rgb.map((c, j) => Math.round(c + (to.rgb[j] - c) * k));
  return `rgb(${mix.join(',')})`;
}

function paintClock(sec) {
  const clock = el('quizClock');
  const progress = Math.min(1, sec / CLOCK_MAX);
  clock.style.setProperty('--clock', clockColor(sec));
  clock.querySelector('.clock-progress').style.strokeDashoffset = String(CLOCK_CIRC * (1 - progress));
  // rotace pres SVG atribut, ne CSS - transform-origin u SVG se chova nejednotne
  clock.querySelector('.clock-hand').setAttribute('transform', `rotate(${progress * 360} 20 20)`);
  clock.classList.toggle('is-over', sec >= CLOCK_MAX);
  el('quizClockText').textContent = `${Math.floor(sec)} s`;
}

function startClock() {
  stopClock();
  paintClock(0);
  clockTimer = setInterval(() => paintClock((Date.now() - shownAt) / 1000), 100);
}

/* Hodiny se zastavi, ale zustanou stat na dosazenem case - je videt,
   jak dlouho priklad trval. */
function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
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
  startClock();
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
  stopClock();
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
  stopClock();
  show('config');
  renderConfigScreen();
});

/* ---------------- výsledek ---------------- */
function finish() {
  stopClock();
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
