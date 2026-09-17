import { OPS, COMPARES, EXTRA_KINDS, MISSING_LABEL, kindOps, buildRound, buildRiddleRound, buildGridRound, buildOver10Round, buildPexesoRound, explain, diagnose } from './generator.js';
import { RIDDLE_LEVELS, RIDDLE_LEVEL_KEYS } from './riddle.js';
import { GRID_LEVELS, GRID_LEVEL_KEYS, gridOpsNote, gridRangeNote } from './grid.js';
import { OVER10_LEVELS, OVER10_LEVEL_KEYS, over10RangeNote } from './over10.js';
import { PEXESO_LEVELS, PEXESO_LEVEL_KEYS, pexesoRangeNote } from './pexeso.js';
import * as store from './stats.js';
import * as rewards from './rewards.js';
import * as storage from './storage.js';
import { bindCollectionTaps, dismissGranted, dismissPopup, renderCollection, showGranted, updateBadge } from './rewards-ui.js';
import { dismissExport, openExport } from './export-ui.js';
import { mergePayload, readIncoming } from './transfer.js';

const el = (id) => document.getElementById(id);
const screens = {
  config: el('screen-config'),
  quiz: el('screen-quiz'),
  result: el('screen-result'),
  rewards: el('screen-rewards'),
};

const COUNT_PRESETS = [10, 20, 30];
const MAX_PRESETS = [10, 15, 20, 30, 50, 100];

/* Režimy hry. Počítání je původní trénink, ostatní tři mají místo výběru
   druhů úloh vlastní obtížnost. Společné zůstává "kolik příkladů" a
   "do kolika" - u mřížky je kolo jediná úloha, tak tam počet odpadá. */
const MODES = {
  calc: { label: 'Počítání', icon: '🧮', sub: 'Příklady, slovní úlohy, pyramidy' },
  over10: { label: 'Počítej přes 10', icon: '🔟', sub: 'Rozlož si příklad krok za krokem' },
  riddle: { label: 'Obrázkové hádanky', icon: '🧩', sub: 'Zjisti, kolik je který obrázek' },
  grid: { label: 'Mřížka', icon: '🔳', sub: 'Doplň čísla, ať sedí doprava i dolů' },
  /* Vnitřní klíč zůstal `pexeso` z doby, kdy kartičky ležely lícem dolů.
     Uživatel si pak vyžádal, aby byly vidět všechny - je z toho spojovačka,
     ne paměťová hra. Klíč se schválně nepřejmenovává: je v uloženém
     nastavení i v historii kol. */
  pexeso: { label: 'Najdi dvojice', icon: '🔗', sub: 'Spoj příklad s jeho výsledkem' },
};

/* Tabulky obtížností podle režimu - klíče (easy/medium/hard) jsou schválně
   společné, takže `config.level` přežije přepnutí režimu. */
const LEVEL_TABLES = { riddle: RIDDLE_LEVELS, grid: GRID_LEVELS, over10: OVER10_LEVELS, pexeso: PEXESO_LEVELS };
const LEVEL_KEYS = {
  riddle: RIDDLE_LEVEL_KEYS, grid: GRID_LEVEL_KEYS, over10: OVER10_LEVEL_KEYS, pexeso: PEXESO_LEVEL_KEYS,
};

/* Společná množina klíčů obtížnosti. Tabulky výš ji musí mít všechny stejnou,
   aby přepnutí režimu nastavení nezahodilo. */
const LEVEL_ALL = ['easy', 'medium', 'hard'];

/* Hádanka, mřížka i rozklad přes desítku se luští déle než příklad, tak na ně
   dáváme jeden pokus navíc - první špatná odpověď ještě neukáže řešení. */
const RETRY_KINDS = new Set(['riddle', 'grid', 'over10']);

/* Políčka, do kterých píše klávesnice. Kromě odpovědi jsou to poznámky pod
   hádankou, kolečka mřížky a políčka rozkladu. */
const FIELD_SEL = '#answerInput, .riddle-note-input, .grid-input, .o10-input';

/* Úlohy, které místo jednoho políčka na odpověď mají několik dílčích.
   Odpovědí je u nich řetězec hodnot spojený ', ' v pořadí `ex.hidden`. */
const PART_SEL = { grid: '.grid-input', over10: '.o10-input' };

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

/* Vychozi nastaveni na jednom miste - pouziva ho start aplikace i mazani. */
const VYCHOZI_CONFIG = () => ({
  mode: 'calc', level: 'easy', ops: ['add', 'sub'], kinds: ['word', 'bond'], count: 10, max: 20,
});

/* Stav se jen deklaruje. Naplni ho `boot()` na konci souboru, protoze
   nacteni je asynchronni - dnes z localStorage, pozdeji ze serveru. */
let state = store.emptyState();
let config = VYCHOZI_CONFIG();

let round = [];
let index = 0;
let attempts = [];
let locked = false;
let shownAt = 0;
let advanceTimer = null;
let clockTimer = null;
let retriesLeft = 0;
let retried = false;
let activeField = null; // políčko, do kterého píše klávesnice (odpověď / poznámka)

/* Sbirka odmen a identifikator rozehraneho kola. `gameId` vznika pri startu
   kola a zajistuje, ze se tataz dokoncena sada nezapocita dvakrat - ani po
   obnoveni stranky, ani pri navratu na vysledek. */
let rewardData = rewards.emptyData();
let gameId = null;

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
    // starší uložené nastavení režim nezná a bylo vždycky "počítání"
    mode: raw.mode in MODES ? raw.mode : 'calc',
    /* Obtížnost se hlídá proti společné množině klíčů, ne proti tabulce
       jednoho režimu - všechny tři tabulky mají easy/medium/hard. */
    level: LEVEL_ALL.includes(raw.level) ? raw.level : 'easy',
    ops,
    kinds,
    count: clamp(Number(raw.count) || 10, 3, 60),
    max: clamp(Number(raw.max) || 20, 5, 1000),
  };
}

/* Volby se ukladaji hned pri kazde zmene, ne az po dohranem kole. Bez toho
   se prenastaveni ztratilo vzdycky, kdyz se kolo nezacalo - pri dalsim
   spusteni tam bylo zase to stare. Zapisy jsou ve fronte (300 ms), takze
   proklikani vsech chipu skonci stejne jednim zapisem. */
function saveConfig() {
  state.config = config;
  storage.saveState(state);
}

const isRiddleMode = () => config.mode === 'riddle';
const isGridMode = () => config.mode === 'grid';
const isOver10Mode = () => config.mode === 'over10';
const isPexesoMode = () => config.mode === 'pexeso';
/* Režimy, které mají obtížnost místo výběru druhů úloh. */
const usesLevel = () => config.mode !== 'calc';
const levelTable = () => LEVEL_TABLES[config.mode] || RIDDLE_LEVELS;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function show(name) {
  if (name !== 'result') dismissGranted();
  if (name !== 'rewards') dismissPopup();
  if (name !== 'config') dismissExport();
  for (const [key, node] of Object.entries(screens)) node.classList.toggle('is-active', key === name);
  document.body.classList.toggle('is-quiz', name === 'quiz');
  /* Na sbirce se misto tlacitka "Odmeny" ukaze plovouci sipka zpet -
     tlacitko do sbirky by tam vedlo samo na sebe. */
  document.body.classList.toggle('is-rewards', name === 'rewards');
  if (name !== 'quiz') document.body.classList.remove('is-wide-grid');
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

/* U hádanek nemá výběr operací ani "něco navíc" smysl, tak ty dvě karty
   schováme. Nastavení v nich ale zůstane, aby se po přepnutí zpátky
   všechno vrátilo tak, jak to bylo. */
/* Které karty nastavení dávají v daném režimu smysl. Mřížka na rozdíl od
   hádanek potřebuje výběr operací (rozhodne, jestli bude sčítací, nebo
   násobící) a naopak nemá počet úloh - jedna mřížka je celé kolo. */
function renderModeCards() {
  const grid = isGridMode();
  const over10 = isOver10Mode();
  const pexeso = isPexesoMode();
  // rozklad přes desítku je vždycky sčítání, výběr operací by tam nedával smysl
  el('card-ops').hidden = isRiddleMode() || over10;
  el('card-kinds').hidden = usesLevel();
  el('card-level').hidden = !usesLevel();
  // jedna mřížka i jedna plocha pexesa jsou celé kolo - počet příkladů odpadá
  el('card-count').hidden = grid || pexeso;
  el('countTitle').innerHTML = isRiddleMode()
    ? '<span aria-hidden="true">🔢</span> Kolik hádanek?'
    : '<span aria-hidden="true">🔢</span> Kolik příkladů?';

  const maxNote = el('maxNote');
  const opsNote = el('opsNote');
  opsNote.hidden = true;
  maxNote.hidden = !usesLevel();
  if (!usesLevel()) return;

  const level = levelTable()[config.level];

  if (over10) {
    /* Upozornění na malý rozsah patří k rozsahu, ne k operacím - karta
       s operacemi je v tomhle režimu schovaná. */
    maxNote.textContent = over10RangeNote(config.max)
      || 'Rozsah řídí, jak velká čísla se budou rozkládat. Kolik nápovědy dostaneš, si vybíráš výš u obtížnosti.';
    el('levelNote').textContent = `${level.label} – ${level.note}. Čísla do ${config.max}.`;
    return;
  }

  if (pexeso) {
    /* Na ploše nesmí být dva stejné výsledky, takže rozsah rozhoduje i o tom,
       kolik dvojic se na ni vejde. Hláška o tom patří k rozsahu, hláška
       o operacích k operacím - obě si říká `pexesoPlan()`. */
    maxNote.textContent = 'Rozsah řídí, jak velká čísla na kartičkách budou. Kolik je kartiček, si vybíráš výš u obtížnosti.';
    el('levelNote').textContent = `${level.label} – ${level.note}. Čísla do ${config.max}.`;
    const note = pexesoRangeNote(config.level, config.ops, config.max);
    if (note) {
      opsNote.textContent = note;
      opsNote.hidden = false;
    }
    return;
  }

  if (grid) {
    maxNote.textContent = 'Rozsah je strop pro všechna čísla v mřížce – i pro roh, ve kterém se všechno sejde.';
    el('levelNote').textContent = `${level.label} – ${level.note}. Čísla do ${config.max}.`;
    // upozornění na kombinace, které do zvolené mřížky nesednou
    const note = gridOpsNote(config.level, config.ops, config.max) || gridRangeNote(config.level, config.max);
    if (note) {
      opsNote.textContent = note;
      opsNote.hidden = false;
    }
    return;
  }

  /* Obtížnost říká, jak hádanka vypadá, rozsah jak velká jsou čísla -
     dvě nezávislé věci, tak to u obou rovnou napíšeme. */
  maxNote.textContent = 'Rozsah řídí, jak velká čísla v hádankách budou. Kolik je v nich obrázků, si vybíráš výš u obtížnosti.';
  el('levelNote').textContent = `${level.label} – ${level.note}, třeba ${level.example}. Čísla do ${config.max}.`;
}

function renderConfigScreen() {
  updateBadge(rewardData);
  el('modeChips').innerHTML = Object.entries(MODES)
    .map(([key, mode]) => {
      const on = key === config.mode;
      return `<button type="button" class="chip chip-mode${on ? ' is-on' : ''}" data-value="${key}" aria-pressed="${on}">
          <span class="chip-icon" aria-hidden="true">${mode.icon}</span>
          <span class="chip-main">${mode.label}</span>
          <span class="chip-sub">${mode.sub}</span>
        </button>`;
    })
    .join('');

  const levels = levelTable();
  el('levelChips').innerHTML = (LEVEL_KEYS[config.mode] || RIDDLE_LEVEL_KEYS)
    .map((key) => chipHTML(key, `${levels[key].emoji} ${levels[key].label}`, config.level === key))
    .join('');

  renderModeCards();

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
  const reasons = config.kinds
    .map((k) => {
      const kind = EXTRA_KINDS[k];
      const have = kindOps(k, config.ops).length;
      if (have >= (kind.minOps || 1)) return null;
      // druh vypadne buď kvůli nevhodné operaci, nebo protože je zapnutá jen jedna
      return kind.minOps > 1 && have > 0
        ? `${kind.label} potřebuje aspoň ${kind.minOps} operace, ať je z čeho vybírat.`
        : `${kind.label} jdou jen u ${kind.ops.map((o) => OPS[o].name).join(', ')}.`;
    })
    .filter(Boolean);

  if (!reasons.length) {
    note.hidden = true;
    return;
  }
  note.textContent = `${reasons.join(' ')} Uprav si výběr nahoře, jinak se v kole neobjeví.`;
  note.hidden = false;
}

/* Připomínka posledního kola. Ukazujeme jen kolo ze stejného režimu -
   procenta z hádanek a z příkladů se srovnávat nedají. */
function renderLastHint() {
  const hint = el('lastRoundHint');
  const last = state.rounds.find((r) => (r.mode || 'calc') === config.mode);
  if (!last) {
    hint.hidden = true;
    return;
  }
  /* U mřížky i u pexesa je kolo jediná úloha, takže procenta nic neřeknou -
     zajímavější je série z posledních kol. */
  if (isGridMode() || isPexesoMode()) {
    const mode = config.mode;
    const recent = state.rounds.filter((r) => r.mode === mode).slice(0, 5);
    const done = recent.filter((r) => r.correct === r.total).length;
    const kolik = mode === 'grid'
      ? (recent.length === 1 ? 'mřížky' : `${recent.length} mřížek`)
      : (recent.length === 1 ? 'plochy' : `${recent.length} ploch`);
    hint.textContent = `Z posledních ${kolik} jsi zvládla ${done}.`;
    hint.hidden = false;
    return;
  }

  const pct = Math.round((last.correct / last.total) * 100);
  const what = isRiddleMode() ? 'hádanek' : isOver10Mode() ? 'rozkladů' : 'příkladů';
  const focus = isRiddleMode()
    ? ' Každá hádanka je pokaždé nová.'
    : isOver10Mode()
      ? ' Každý rozklad je pokaždé nový.'
      : state.missed.length
        ? ` Do dalšího kola zařadím ${Math.min(state.missed.length, 12)} podobných příkladů, které minule nevyšly.`
        : ' Minule ti nic neuteklo. 🎉';
  hint.textContent = `Naposledy ${what}: ${last.correct} z ${last.total} (${pct} %).${focus}`;
  hint.hidden = false;
}

for (const id of ['darkBtn', 'darkBtnQuiz']) {
  el(id).addEventListener('click', () => {
    state.dark = !state.dark;
    storage.saveState(state);
    applyTheme();
  });
}

el('modeChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  config.mode = chip.dataset.value;
  saveConfig();
  renderConfigScreen();
});

el('levelChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  config.level = chip.dataset.value;
  saveConfig();
  renderConfigScreen();
});

el('themeChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.theme = chip.dataset.value;
  storage.saveState(state);
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
  saveConfig();
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
  saveConfig();
  renderConfigScreen();
});

el('countChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  config.count = Number(chip.dataset.value);
  saveConfig();
  renderConfigScreen();
});

el('maxChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  config.max = Number(chip.dataset.value);
  saveConfig();
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
    renderModeCards(); // u hádanek se s rozsahem mění i obtížnost
    saveConfig();
  });
  input.addEventListener('blur', () => renderConfigScreen());
}

bindCustomField('countCustom', 'countChips', 'count', 3, 60);
bindCustomField('maxCustom', 'maxChips', 'max', 5, 1000);

el('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  storage.saveState(state);
  renderConfigScreen();
  if (state.sound) beep('correct');
});

/* Mazani historie uz na uvodni obrazovce neni - patri do dialogu "Nastaveni"
   za heslem, aby se k nemu dite nedostalo omylem. Viz wipe() nize. */

el('startBtn').addEventListener('click', startRound);

/* ---------------- odměny ---------------- */
/* Prepnuti obrazovky je jen trida v CSS, takze rozehrana hra ani nic
   ulozeneho se otevrenim sbirky neztrati. */
el('rewardsBtn').addEventListener('click', () => {
  rewards.markCollectionSeen(rewardData);
  storage.saveRewards(rewardData);
  renderCollection(rewardData);
  updateBadge(rewardData);
  show('rewards');
});

el('rewardsBackBtn').addEventListener('click', () => {
  show('config');
  renderConfigScreen();
});

/* Tlacitko "Pokracovat" obsluhuje primo vrstva s odmenami (rewards-ui.js),
   tady se uz nic vazat nemusi. */
bindCollectionTaps();

/* ---------------- export a prenos ---------------- */

el('exportBtn').addEventListener('click', () => {
  openExport({ state, rewardData, onWipe: wipe });
});

/* Tri rozsahy mazani. Vsechny jsou nevratne, proto se kazdy jeste potvrzuje
   v dialogu (export-ui.js) - sem uz prijde jen rozhodnuti. */
async function wipe(scope) {
  /* `clear()` zahodi i cekajici zapis, takze se o par set milisekund
     pozdeji nevrati zpatky to, co se prave smazalo. */
  await storage.clear(scope);

  if (scope === 'progress') {
    // nastaveni a tema zustavaji, maze se jen to, co se nacitalo
    state.skills = {};
    state.missed = [];
    state.rounds = [];
    storage.saveState(state);
  }

  const data = await storage.load();
  rewardData = data.rewards;
  if (scope === 'all') {
    state = data.state;
    config = VYCHOZI_CONFIG();
  }
  applyTheme();
  renderScenery();
  show('config');
  renderConfigScreen();
}

/* Prenos z druheho zarizeni: parametr v adrese se slouci s tim, co uz tady
   je. Slucovani je idempotentni, takze tyz odkaz podruhe nic nezdvoji. */
async function acceptIncoming() {
  const payload = await readIncoming();
  if (!payload) return;
  const zmeny = mergePayload(state, rewardData, payload);
  if (!zmeny) return;

  /* `mergePayload` uz sama neuklada - zapis patri sem, aby na uloziste
     vedla jedina cesta. */
  storage.saveState(state);
  storage.saveRewards(rewardData);

  config = normalizeConfig(state.config) || config;
  applyTheme();
  renderScenery();
  renderConfigScreen();

  const casti = [];
  if (zmeny.dumplingu) {
    casti.push(`${zmeny.dumplingu} ${rewards.plural(zmeny.dumplingu, 'dumpling', 'dumplingy', 'dumplingů')}`
      + (zmeny.novych ? ` (z toho ${zmeny.novych} ${rewards.plural(zmeny.novych, 'nový', 'nové', 'nových')})` : ''));
  }
  if (zmeny.chyb) casti.push(`${zmeny.chyb} ${rewards.plural(zmeny.chyb, 'příklad', 'příklady', 'příkladů')} k procvičení`);
  if (zmeny.kol) casti.push(`${zmeny.kol} ${rewards.plural(zmeny.kol, 'výsledek', 'výsledky', 'výsledků')}`);

  const hint = el('lastRoundHint');
  hint.hidden = false;
  hint.textContent = casti.length
    ? `📥 Přenos z druhého zařízení: přibylo ${casti.join(', ')}.`
    : '📥 Přenos z druhého zařízení: všechno už jsi tady měla.';
}

/* ---------------- kvíz ---------------- */
function startRound() {
  gameId = rewards.makeGameId();
  config.max = clamp(config.max, 5, 1000);
  config.count = clamp(config.count, 3, 60);
  const build = {
    calc: () => buildRound(config, state.missed),
    riddle: () => buildRiddleRound(config),
    grid: () => buildGridRound(config),   // jedna mřížka je celé kolo
    over10: () => buildOver10Round(config),
    pexeso: () => buildPexesoRound(config), // jedna plocha je celé kolo
  };
  round = (build[config.mode] || build.calc)();
  index = 0;
  attempts = [];
  el('dots').innerHTML = round.map(() => '<span class="dot"></span>').join('');
  el('quizScore').textContent = '0';
  /* Nad jedinou úlohou nemá tečka ani počitadlo hvězd co říct. */
  const solo = round.length === 1;
  el('dots').hidden = solo;
  el('quizScore').hidden = solo;
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

  el('quizCounter').textContent = ex.kind === 'grid'
    ? `Mřížka ${ex.size}×${ex.size}`
    /* Rozměry plochy, ne počet dvojic: "Dvojice · 8 dvojic" je na 320 px
       delší, než se do horní lišty vejde, a roztáhlo by stránku. */
    : ex.kind === 'pexeso'
      ? `Dvojice ${ex.cols}×${ex.rows}`
      : `${index + 1} / ${round.length}`;
  el('dots').querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('is-current', i === index));
  el('exerciseHint').textContent = hintFor(ex);
  el('exerciseBody').innerHTML = (BODY_HTML[ex.kind] || equationHTML)(ex);
  /* Mřížka 5×5 a plocha pexesa o čtyřech sloupcích jsou nejširší, co
     aplikace kreslí. Na úzkém telefonu jim uvolníme okraje, ať nemusíme
     zmenšovat kolečka a kartičky pod dotykový cíl. */
  document.body.classList.toggle(
    'is-wide-grid',
    (ex.kind === 'grid' && ex.size >= 5) || (ex.kind === 'pexeso' && ex.cols >= 4),
  );
  el('feedback').hidden = true;
  el('feedback').innerHTML = '';
  /* Pexeso se ovládá klepáním na kartičky, žádná klávesnice u něj není. */
  el('keypad').hidden = ex.kind === 'pexeso';
  if (ex.kind !== 'pexeso') renderKeypad(ex);
  el('keypad').dataset.disabled = 'false';
  retriesLeft = RETRY_KINDS.has(ex.kind) ? 1 : 0;
  retried = false;
  activeField = null;

  if (ex.kind === 'pexeso') startPexeso(ex);

  /* U pexesa žádné políčko na odpověď není - `#answerInput` v DOM chybí
     a slepé sáhnutí na něj by tady spadlo. */
  const input = el('answerInput');
  if (input) {
    input.maxLength = String(config.max).length + 1;
    input.focus({ preventScroll: true });
  }
  shownAt = Date.now();
  startClock();
}

function hintFor(ex) {
  if (ex.kind === 'grid') return 'Doplň čísla tak, aby vyšlo každé počítání doprava i dolů. Pak klepni na ✓.';
  if (ex.kind === 'over10') {
    return 'Rozděl druhé číslo na dvě části: do rámečku dej tolik, aby s prvním číslem byla rovná desítka, '
      + 'vedle zbytek. Nahoře doplň výsledek a klepni na ✓.';
  }
  if (ex.kind === 'pexeso') {
    return 'Ke každému příkladu najdi jeho výsledek a klepni na obě kartičky. '
      + 'Když k sobě patří, spojí se. Takhle najdi všechny dvojice.';
  }
  if (ex.kind === 'riddle') return 'Zjisti z rovnic, kolik je který obrázek, a dopočítej poslední řádek.';
  if (ex.kind === 'sign') return 'Doplň chybějící znaménko, aby příklad vyšel.';
  if (ex.kind === 'compare') return 'Co je větší? Klepni na správné znaménko – zobáček se otevírá k většímu číslu.';
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

/* Doplň znaménko: čísla i výsledek jsou vidět, chybí operace. Políčko je
   znovu `.slot` s `#answerInput`, jen je readonly - hodnotu do něj vkládají
   tlačítka se znaménky, takže potvrzení i vyhodnocení běží stejnou cestou
   jako u ostatních úloh. */
function signHTML(ex) {
  return `<div class="equation">
      <span class="num">${ex.a}</span>
      <span class="slot slot-op" id="answerSlot">
        <input id="answerInput" type="text" inputmode="none" autocomplete="off" readonly
               aria-label="Doplň chybějící znaménko">
      </span>
      <span class="num">${ex.b}</span>
      <span class="eq-op">=</span>
      <span class="num">${ex.c}</span>
    </div>`;
}

/* Porovnavani je stejny tvar jako doplneni znamenka, jen bez vysledku -
   dve cisla a mezi nimi policko na zobacek. */
function compareHTML(ex) {
  return `<div class="equation">
      <span class="num">${ex.a}</span>
      <span class="slot slot-op" id="answerSlot">
        <input id="answerInput" type="text" inputmode="none" autocomplete="off" readonly
               aria-label="Doplň znaménko porovnání">
      </span>
      <span class="num">${ex.b}</span>
    </div>`;
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

/* Obrázková hádanka: pomocné rovnice pod sebou a poslední řádek s políčkem
   na odpověď. Políčko je stejný `.slot` jako u ostatních úloh, takže
   klávesnice, potvrzení i vyhodnocení fungují beze změny. */
function riddleHTML(ex) {
  const face = (t) => (t.sym !== undefined
    ? `<span class="riddle-sym">${ex.symbols[t.sym]}</span>`
    : `<span class="riddle-total riddle-inline">${t.num}</span>`);

  const row = (r) => {
    const parts = [`${r.terms[0].sign < 0 ? '<span class="riddle-op">−</span>' : ''}${face(r.terms[0])}`];
    for (const t of r.terms.slice(1)) parts.push(`<span class="riddle-op">${t.sign < 0 ? '−' : '+'}</span>`, face(t));
    parts.push('<span class="riddle-op riddle-eq">=</span>');
    parts.push(!r.rhs ? slotHTML() : r.rhs.sym !== undefined ? face(r.rhs) : `<span class="riddle-total">${r.rhs.num}</span>`);
    return `<div class="riddle-row${r.rhs ? '' : ' riddle-row-q'}">${parts.join('')}</div>`;
  };

  return `<div class="riddle">${ex.rows.map(row).join('')}${row(ex.question)}</div>${riddleNotesHTML(ex)}`;
}

/* Poznámkový blok pod hádankou. Dítě si sem může zapsat, co mu u kterého
   obrázku vyšlo - je to jen tahák pro něj, na vyhodnocení odpovědi to nemá
   žádný vliv a nic se z toho nekontroluje. */
function riddleNotesHTML(ex) {
  const items = ex.symbols
    .map((s) => `<label class="riddle-note">
        <span class="riddle-sym riddle-sym-sm" aria-hidden="true">${s}</span>
        <span class="riddle-note-eq" aria-hidden="true">=</span>
        <input class="riddle-note-input" type="text" inputmode="none" autocomplete="off"
               maxlength="3" aria-label="Poznámka: kolik je tenhle obrázek">
      </label>`)
    .join('');
  return `<div class="riddle-notes">
      <p class="riddle-notes-title">Můžeš si poznamenat, co ti vyšlo:</p>
      <div class="riddle-notes-row">${items}</div>
    </div>`;
}

/* Mřížka: kolečka a mezi nimi operátory, vodorovně i svisle. Vykresluje se
   jako CSS grid o (2·size−1) sloupcích, kde liché pozice jsou kolečka a sudé
   operátory; na průsečících operátorových pruhů je prázdno.

   První skryté kolečko dostane `id="answerInput"` a jeho obal `answerSlot`,
   stejně jako to dělá `signHTML` - tím dál funguje focus, `maxLength`,
   třesení prázdné odpovědi i Enter, aniž by se muselo sahat do společné
   cesty vyhodnocení. */
function gridHTML(ex) {
  const { size, cells, colOps, rowOps, hidden } = ex;
  const holeAt = (r, c) => hidden.findIndex((h) => h.r === r && h.c === c);
  const digits = String(config.max).length;
  const out = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const idx = holeAt(r, c);
      if (idx < 0) {
        out.push(`<span class="gcell gnum">${cells[r][c]}</span>`);
      } else {
        const first = idx === 0 ? ' id="answerSlot"' : '';
        const id = idx === 0 ? ' id="answerInput"' : '';
        /* `maxlength` musí mít KAŽDÉ kolečko. `renderExercise` ho nastavuje
           jen tomu s id="answerInput"; bez atributu vrací `input.maxLength`
           −1 a klávesnice by do zbylých koleček nenapsala ani číslici. */
        out.push(`<span class="gcell slot"${first}><input${id} class="grid-input" type="text"
          inputmode="none" autocomplete="off" data-idx="${idx}" maxlength="${digits}"
          aria-label="Doplň číslo, ${r + 1}. řádek, ${c + 1}. sloupec"></span>`);
      }
      if (c < size - 2) out.push(`<span class="gop">${colOps[c]}</span>`);
      else if (c === size - 2) out.push('<span class="gop gop-eq">=</span>');
    }
    if (r === size - 1) break;
    for (let c = 0; c < size; c++) {
      out.push(`<span class="gop">${r < size - 2 ? rowOps[r] : '='}</span>`);
      if (c < size - 1) out.push('<span></span>');
    }
  }
  return `<div class="grid" data-size="${size}" data-digits="${String(config.max).length}">${out.join('')}</div>`;
}

/* Počítej přes 10: příklad na jednom řádku a pod druhým číslem větvička,
   která ho rozdělí. Levá větev míří do rámečku k prvnímu číslu - spolu dají
   rovnou desítku; pravá je zbytek přes ni.

   Políčka jsou ve všech obtížnostech stejná (`ex.hidden`) a jejich `data-idx`
   je pozice v `ex.answer`. `maxlength` musí mít KAŽDÉ z nich: `renderExercise`
   ho nastavuje jen tomu s id="answerInput" a bez atributu vrací `maxLength`
   −1, takže by klávesnice do zbylých nenapsala ani číslici. */
const O10_LABEL = {
  ten: 'Kolik chybí prvnímu číslu do desítky',
  rest: 'Kolik zbývá přidat přes desítku',
  c: 'Výsledek',
};

function over10HTML(ex) {
  const digits = String(config.max).length;
  const cell = (key) => {
    const idx = ex.hidden.indexOf(key);
    const slotId = idx === 0 ? ' id="answerSlot"' : '';
    const inputId = idx === 0 ? ' id="answerInput"' : '';
    return `<span class="o10-cell slot o10b-${key}"${slotId}><input${inputId} class="o10-input" type="text"
      inputmode="none" autocomplete="off" data-idx="${idx}" maxlength="${digits}"
      aria-label="${O10_LABEL[key]}"></span>`;
  };

  return `${over10FrameHTML(ex)}
    <div class="o10b">
      <span class="o10b-box" aria-hidden="true"></span>
      <span class="o10-num o10b-a">${ex.a}</span>
      <span class="o10-op o10b-plus">+</span>
      <span class="o10-num o10b-b">${ex.b}</span>
      <span class="o10-op o10b-eq">=</span>
      ${cell('c')}
      <span class="o10b-leg o10b-leg-l" aria-hidden="true"></span>
      <span class="o10b-leg o10b-leg-r" aria-hidden="true"></span>
      ${cell('ten')}
      ${cell('rest')}
    </div>`;
}

/* Kroužky jako nápověda (lehká a střední úroveň): prvních deset v řadě,
   zbytek přeteče do druhé - je tak vidět, kde se desítka láme. Nad dvacet
   se rámec nekreslí, tolik koleček se na řádek nevejde. */
function over10FrameHTML(ex) {
  if (ex.hint === 'none' || ex.c > 20) return '';
  const cells = [];
  for (let i = 0; i < 20; i++) {
    const cls = i < ex.a ? 'tf-cell tf-a' : i < ex.c ? 'tf-cell tf-b' : 'tf-cell';
    cells.push(`<span class="${cls}"></span>`);
  }
  return `<div class="tenframe tenframe-hint" aria-hidden="true">${cells.join('')}</div>`;
}

/* Najdi dvojice: všechny kartičky jsou vidět od začátku a dítě klepnutím
   spojuje příklad s jeho výsledkem. **Není to paměťová hra a kartičky se
   neotáčejí** - uživatel si to takhle výslovně vyžádal a otáčení už
   nevracej. Trénuje se tím počítání, ne paměť.

   Příklady a výsledky mají každý svou barvu (`data-face`), aby bylo na první
   pohled vidět, co se s čím spojuje. `<button>` nedědí barvu textu, takže si
   ji kartička nastavuje sama - jinak by byl v tmavém režimu černý text
   na tmavém podkladu. */
function pexesoHTML(ex) {
  const cards = ex.cards
    .map((card, i) => `<button type="button" class="pex-card" data-i="${i}" data-pair="${card.pair}"
        data-face="${card.face}"
        aria-label="${card.face === 'task' ? 'Příklad' : 'Výsledek'} ${card.text}">${card.text}</button>`)
    .join('');
  return `<div class="pex" data-cols="${ex.cols}">${cards}</div>
    <p id="pexStatus" class="pex-status" aria-live="polite"></p>`;
}

const BODY_HTML = {
  bond: bondHTML, word: wordHTML, riddle: riddleHTML, sign: signHTML, grid: gridHTML,
  compare: compareHTML, over10: over10HTML, pexeso: pexesoHTML,
};

/* ---------------- ovladač plochy s dvojicemi ----------------
   Plocha se neodpovídá políčkem, takže společnou cestou `submit()` neprochází.
   Po spojení poslední dvojice si ovladač sám zapíše záznam do `attempts` -
   přesně v tom tvaru, jaký čekají `finish()`, `recordRound()` i `applyRound()`,
   takže se zbytek aplikace kvůli tomuhle režimu neměnil.

   Chybou je spojení dvou kartiček, které k sobě nepatří. Protože jsou všechny
   vidět, je to skutečně špatně spočítaný příklad, ne odhad - hranice je proto
   přísná. Kolik chyb kolo ještě snese, bydlí v `REWARD_RULES`, ne tady. */
let pexPicked = null;    // první vybraná kartička, dokud nepřijde druhá
let pexFound = 0;        // spojené dvojice
let pexMiss = 0;         // chybná spojení
let pexBusy = false;     // krátká pauza, než z neshodné dvojice zmizí červená

const PEX_MISS_MS = 700;

const pexAllowance = () => rewards.REWARD_RULES.pexesoMismatchAllowance[config.level] ?? 0;

function startPexeso(ex) {
  pexPicked = null;
  pexFound = 0;
  pexMiss = 0;
  pexBusy = false;
  renderPexStatus(ex);
}

function renderPexStatus(ex) {
  const status = el('pexStatus');
  if (!status) return;
  if (pexFound >= ex.pairs) {
    status.textContent = `Všech ${ex.pairs} dvojic máš spojených!`;
    return;
  }
  status.textContent = `Spojeno ${pexFound} z ${ex.pairs}`
    + (pexMiss ? ` · chyb: ${pexMiss}` : '');
}

el('exerciseBody').addEventListener('click', (e) => {
  const card = e.target.closest('.pex-card');
  if (card) pexTap(card);
});

function pexTap(card) {
  const ex = round[index];
  if (locked || pexBusy || ex?.kind !== 'pexeso') return;
  if (card.classList.contains('is-done')) return;

  // druhé klepnutí na tutéž kartičku výběr zruší - dítě si to smí rozmyslet
  if (card === pexPicked) {
    card.classList.remove('is-picked');
    pexPicked = null;
    return;
  }

  if (!pexPicked) {
    card.classList.add('is-picked');
    pexPicked = card;
    return;
  }

  const first = pexPicked;
  pexPicked = null;

  if (first.dataset.pair === card.dataset.pair) {
    for (const c of [first, card]) {
      c.classList.remove('is-picked');
      c.classList.add('is-done');
      c.disabled = true;
    }
    pexFound += 1;
    beep('correct');
    renderPexStatus(ex);
    if (pexFound >= ex.pairs) finishPexeso(ex);
    return;
  }

  // neshoda: obě kartičky chvilku zčervenají, ať je vidět, co spolu nešlo
  pexMiss += 1;
  pexBusy = true;
  card.classList.add('is-picked');
  for (const c of [first, card]) c.classList.add('is-miss');
  beep('wrong');
  renderPexStatus(ex);
  advanceTimer = setTimeout(() => {
    for (const c of [first, card]) c.classList.remove('is-picked', 'is-miss');
    pexBusy = false;
  }, PEX_MISS_MS);
}

/* Plocha se vždycky nakonec dohraje, takže "nevyšlo" tu neznamená
   nevyřešeno, ale "s moc chybnými spojeními" - texty tomu musí odpovídat,
   jinak to dítě zmate. */
function finishPexeso(ex) {
  locked = true;
  stopClock();
  const limit = pexAllowance();
  const correct = pexMiss <= limit;

  attempts.push({
    ex,
    given: pexMiss,
    correct,
    retried: false,
    ms: Date.now() - shownAt,
    tag: correct ? null : diagnose(ex, pexMiss),
  });

  const fb = el('feedback');
  fb.dataset.state = correct ? 'correct' : 'wrong';
  fb.innerHTML = correct
    ? `<div class="fb-badge"><span aria-hidden="true">🎉</span> Všechny dvojice máš spojené!</div>
       <p class="fb-retry-note">${pexMiss ? `Spletla ses ${pexMiss}× – a to se ještě počítá.` : 'A bez jediné chyby.'}</p>
       <button type="button" class="btn btn-primary">Hotovo <span aria-hidden="true">➜</span></button>`
    : `<div class="fb-badge"><span aria-hidden="true">🤔</span> Dvojice máš, ale s chybami</div>
       <p class="fb-retry-note">Špatně spojených bylo ${pexMiss}, vejít ses měla do ${limit}.
         Spočítej si příklad celý, než klepneš na výsledek.</p>
       <button type="button" class="btn btn-primary">Rozumím <span aria-hidden="true">➜</span></button>`;
  fb.hidden = false;
  fb.querySelector('.btn').addEventListener('click', next);
  beep(correct ? 'correct' : 'wrong');
  if (correct) confetti();
}

/* klávesnice - číselná, nebo se znaménky u úlohy "doplň znaménko" */
const DEL_KEY = '<button type="button" class="key key-del" data-key="del" aria-label="Smazat">⌫</button>';
const OK_KEY = '<button type="button" class="key key-ok" data-key="ok" aria-label="Potvrdit">✓</button>';

const DIGIT_KEYS = [...'123456789']
  .map((d) => `<button type="button" class="key" data-key="${d}">${d}</button>`)
  .concat([DEL_KEY, '<button type="button" class="key" data-key="0">0</button>', OK_KEY])
  .join('');

/* Nabízíme právě ty operace, které má uživatel zapnuté - podle stejné sady
   se v generátoru hlídá, že je správná odpověď jen jedna. */
function signKeys(ex) {
  const ops = (ex.choices || [ex.op])
    .map((o) => `<button type="button" class="key key-op" data-key="op:${o}" aria-label="${OPS[o].label}">${OPS[o].symbol}</button>`)
    .join('');
  return `<div class="key-ops">${ops}</div>${DEL_KEY}${OK_KEY}`;
}

/* Porovnavani ma vlastni trojici tlacitek. Prefix klice je zamerne jiny nez
   u operaci (`cmp:` misto `op:`) - podle nej se v `handleKey` pozna, ze se
   symbol bere z `COMPARES`, ne z `OPS`. */
function compareKeys() {
  const btns = Object.entries(COMPARES)
    .map(([key, c]) => `<button type="button" class="key key-op" data-key="cmp:${key}" aria-label="${c.label}">${c.symbol}</button>`)
    .join('');
  return `<div class="key-ops">${btns}</div>${DEL_KEY}${OK_KEY}`;
}

/* Nabídka hotových čísel pro lehký rozklad přes desítku. Tlačítko píše celé
   číslo najednou (`num:`), ne po číslicích - dítě vybírá z možností, nezadává
   je. Fyzická klávesnice dál funguje beze změny. */
function numberKeys(ex) {
  const btns = (ex.numbers || [])
    .map((n) => `<button type="button" class="key key-num" data-key="num:${n}">${n}</button>`)
    .join('');
  return `<div class="key-ops key-nums">${btns}</div>${DEL_KEY}${OK_KEY}`;
}

const CHOICE_KINDS = new Set(['sign', 'compare']);

function renderKeypad(ex) {
  const keypad = el('keypad');
  const numbers = ex.kind === 'over10' && ex.hint === 'choices';
  keypad.dataset.mode = CHOICE_KINDS.has(ex.kind) || numbers ? 'sign' : 'digits';
  if (ex.kind === 'sign') keypad.innerHTML = signKeys(ex);
  else if (ex.kind === 'compare') keypad.innerHTML = compareKeys();
  else if (numbers) keypad.innerHTML = numberKeys(ex);
  else keypad.innerHTML = DIGIT_KEYS;
}

el('keypad').addEventListener('click', (e) => {
  const key = e.target.closest('.key');
  if (!key) return;
  handleKey(key.dataset.key);
});

/* Klávesnice píše do políčka, na které dítě naposledy klaplo - buď do
   odpovědi, nebo do poznámky pod hádankou. ✓ ale potvrzuje vždycky
   odpověď, ať je kurzor kdekoli. */
function currentField() {
  return activeField?.isConnected ? activeField : el('answerInput');
}

function handleKey(key) {
  if (locked) return;
  if (key === 'ok') return submit();

  // volba znaménka - vybraná operace se drží v datasetu, aby ji submit našel
  if (key.startsWith('op:')) {
    const slot = el('answerInput');
    if (!slot) return;
    slot.dataset.op = key.slice(3);
    slot.value = OPS[key.slice(3)].symbol;
    return;
  }

  // totéž pro porovnávání, jen se symbol bere z tabulky zobáčků
  if (key.startsWith('cmp:')) {
    const slot = el('answerInput');
    if (!slot) return;
    slot.dataset.op = key.slice(4);
    slot.value = COMPARES[key.slice(4)].symbol;
    return;
  }

  // celé číslo z nabídky - přepíše políčko naráz, ne po číslicích
  if (key.startsWith('num:')) {
    const slot = currentField();
    if (!slot) return;
    slot.value = key.slice(4);
    slot.closest('.gcell, .o10-cell')?.classList.remove('is-wrong');
    return;
  }

  const input = currentField();
  if (!input) return;
  if (key === 'del') {
    input.value = input.value.slice(0, -1);
    delete input.dataset.op;
    return;
  }
  // maxLength je −1, když atribut chybí; brát to jako "žádný limit"
  if (input.maxLength > 0 && input.value.length >= input.maxLength) return;
  input.value += key;
}

el('exerciseBody').addEventListener('focusin', (e) => {
  if (e.target.matches(FIELD_SEL)) activeField = e.target;
});

// do odpovědi i do poznámek pustíme jen číslice - i při vložení ze schránky
document.addEventListener('input', (e) => {
  if (!e.target.matches?.(FIELD_SEL)) return;
  const cap = e.target.maxLength > 0 ? e.target.maxLength : undefined;
  const digits = e.target.value.replace(/\D+/g, '').slice(0, cap);
  if (digits !== e.target.value) e.target.value = digits;
  // jakmile dítě začne přepisovat, červená z políčka zmizí
  e.target.closest('.gcell, .o10-cell')?.classList.remove('is-wrong');
});

/* Znaménka jdou zadat i z fyzické klávesnice; `x` a `:` bereme taky,
   protože × a ÷ na běžné klávesnici nejsou. */
const SIGN_KEYS = { '+': 'add', '-': 'sub', '−': 'sub', '*': 'mul', x: 'mul', X: 'mul', '/': 'div', ':': 'div' };

/* Zobáčky z fyzické klávesnice. */
const COMPARE_KEYS = { '<': 'lt', ',': 'lt', '>': 'gt', '.': 'gt', '=': 'eq' };

document.addEventListener('keydown', (e) => {
  if (!screens.quiz.classList.contains('is-active')) return;
  /* Pexeso nemá políčko na odpověď - Enter by šel do `submit()` a ten by na
     chybějícím `#answerInput` spadl. Hotovou plochu potvrzuje tlačítko
     ve vyhodnocení, takže se tu jen odejde. */
  if (round[index]?.kind === 'pexeso') {
    if (e.key === 'Enter' && locked) el('feedback').querySelector('.btn')?.click();
    return;
  }
  if (round[index]?.kind === 'compare' && COMPARE_KEYS[e.key]) {
    handleKey(`cmp:${COMPARE_KEYS[e.key]}`);
    e.preventDefault();
    return;
  }
  if (round[index]?.kind === 'sign' && SIGN_KEYS[e.key]) {
    const op = SIGN_KEYS[e.key];
    if ((round[index].choices || []).includes(op)) handleKey(`op:${op}`);
    e.preventDefault();
    return;
  }
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

/* Dílčí políčka úlohy (kolečka mřížky, kroky rozkladu) setříděná podle
   `data-idx`, tedy ve stejném pořadí, v jakém generátor skládá `ex.answer`. */
const partInputs = (ex) => [...el('exerciseBody').querySelectorAll(PART_SEL[ex.kind] || PART_SEL.grid)]
  .sort((a, b) => Number(a.dataset.idx) - Number(b.dataset.idx));

const hasParts = (ex) => ex.kind in PART_SEL;

/* Očekávaná hodnota i-tého dílčího políčka. */
function partValue(ex, i) {
  if (ex.kind !== 'grid') return ex.values[i];
  const { r, c } = ex.hidden[i];
  return ex.cells[r][c];
}

/* Jak se z obrazovky přečte odpověď. `null` znamená "ještě není hotovo".
   U mřížky i u rozkladu je odpovědí řetězec hodnot v pořadí `ex.hidden` -
   generátor skládá `ex.answer` stejně, takže porovnání níž zůstává
   obyčejné ===. */
function readAnswer(ex) {
  if (hasParts(ex)) {
    const vals = partInputs(ex).map((i) => i.value.trim());
    return vals.some((v) => v === '') ? null : vals.join(', ');
  }
  const raw = el('answerInput').value.trim();
  if (raw === '') return null;
  // u znaménka i u porovnávání je odpovědí klíč z datasetu, ne číslo
  return CHOICE_KINDS.has(ex.kind) ? (el('answerInput').dataset.op || null) : Number(raw);
}

/* Co zatřese, když odpověď chybí. U dílčích políček jen ta nevyplněná. */
function shakeEmpty(ex) {
  const spots = hasParts(ex)
    ? partInputs(ex).filter((i) => i.value.trim() === '').map((i) => i.closest('.slot'))
    : [el('answerSlot')];
  for (const s of spots) s?.classList.add('is-wrong');
  setTimeout(() => spots.forEach((s) => s?.classList.remove('is-wrong')), 450);
}

/* Obarvení po vyhodnocení. U dílčích políček se každé soudí samo za sebe. */
function markResult(ex, correct) {
  if (!hasParts(ex)) {
    el('answerSlot').classList.add(correct ? 'is-correct' : 'is-wrong');
    return;
  }
  partInputs(ex).forEach((input, i) => {
    const ok = Number(input.value) === partValue(ex, i);
    input.closest('.slot').classList.add(ok ? 'is-correct' : 'is-wrong');
  });
}

function submit() {
  if (locked) return;
  const ex = round[index];
  const given = readAnswer(ex);
  if (given === null) {
    shakeEmpty(ex);
    return;
  }

  const correct = given === ex.answer;

  /* Druhý pokus: hádanku ani mřížku ještě nevyhodnocujeme, jen jemně
     pošťouchneme. Hodiny běží dál, takže čas opravu poctivě započítá. */
  if (!correct && retriesLeft > 0) {
    retriesLeft -= 1;
    retried = true;
    if (hasParts(ex)) partRetry(ex); else softRetry(given);
    return;
  }

  locked = true;
  stopClock();
  el('keypad').dataset.disabled = 'true';

  attempts.push({
    ex,
    given,
    correct,
    retried,
    ms: Date.now() - shownAt,
    tag: correct ? null : diagnose(ex, given),
  });

  markResult(ex, correct);
  el('dots').querySelectorAll('.dot')[index]?.classList.add(correct ? 'is-correct' : 'is-wrong');
  el('quizScore').textContent = String(attempts.filter((a) => a.correct).length);

  renderFeedback(ex, given, correct);
  beep(correct ? 'correct' : 'wrong');
  if (correct) confetti();
}

/* Druhý pokus u úloh s dílčími políčky. Správně vyplněná necháme být - mazat
   je by bylo trestání. Vyprázdní se jen ta chybná a zčervenají; červená
   zmizí, jakmile do políčka dítě začne psát. */
const RETRY_NOTE = {
  grid: (wrong) => {
    const kolecka = wrong === 1 ? 'kolečko ještě nesedí' : wrong <= 4 ? 'kolečka ještě nesedí' : 'koleček ještě nesedí';
    return `${wrong} ${kolecka} (červená). Hledej řádek nebo sloupec,
      kde chybí jediné číslo – od něj se rozmotá zbytek.`;
  },
  over10: (wrong) => {
    const policka = wrong === 1 ? 'políčko ještě nesedí' : wrong <= 4 ? 'políčka ještě nesedí' : 'políček ještě nesedí';
    return `${wrong} ${policka} (červená). Začni rámečkem: kolik chybí prvnímu číslu do desítky?
      Přesně tolik si uber z toho druhého a zbytek napiš do pravé větve.`;
  },
};

function partRetry(ex) {
  let wrong = 0;
  partInputs(ex).forEach((input, i) => {
    if (Number(input.value) === partValue(ex, i)) return;
    wrong += 1;
    input.value = '';
    input.closest('.slot').classList.add('is-wrong');
  });

  const fb = el('feedback');
  fb.dataset.state = 'retry';
  fb.innerHTML = `<div class="fb-badge"><span aria-hidden="true">💪</span> Ještě ne – zkus to znovu!</div>
    <p class="fb-retry-note">${RETRY_NOTE[ex.kind](wrong)}</p>`;
  fb.hidden = false;
  beep('wrong');
  partInputs(ex)[0]?.focus({ preventScroll: true });
}

/* Špatná odpověď u hádanky ještě neznamená konec - políčko se vyprázdní
   a dítě to zkusí znovu. Řešení se ukáže až po druhém pokusu. */
function softRetry(given) {
  const slot = el('answerSlot');
  const input = el('answerInput');
  input.value = '';
  slot.classList.add('is-wrong');
  setTimeout(() => el('answerSlot')?.classList.remove('is-wrong'), 500);
  input.focus({ preventScroll: true });
  beep('wrong');

  const fb = el('feedback');
  fb.dataset.state = 'retry';
  fb.innerHTML = `<div class="fb-badge"><span aria-hidden="true">💪</span> Ještě ne – zkus to znovu!</div>
    <p class="fb-retry-note">${given} to není. Jdi po řádcích odshora – v prvním je jen jeden druh obrázku
    a v každém dalším ti pak chybí dopočítat jediný.</p>`;
  fb.hidden = false;
}

/* Grafické vysvětlení pro rozsah do 20: dva řádky po deseti kroužcích.
   Zlom řádku je přesně desítka, takže je vidět přechod přes ni. */
function tenFrameHTML(ex) {
  // mřížka, porovnávání i pexeso mají op:'add' jen zástupně - rámec by byl nesmysl
  if (ex.kind === 'grid' || ex.kind === 'compare' || ex.kind === 'pexeso') return '';
  // u hádanky jen tehdy, když je poslední řádek prostý součet dvou obrázků
  if (ex.kind === 'riddle' && !ex.simpleSum) return '';
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

/* Po druhé chybě řešení dopíšeme rovnou do políček - dítě ho tak vidí na
   místě, kde ho hledalo, a ne jako seznam čísel pod tím. Vlastní špatnou
   hodnotu ukážeme pod správnou, přeškrtnutou. */
const REVEAL_CLASS = { grid: 'gnum', over10: 'o10-revealed' };

function revealParts(ex) {
  partInputs(ex).forEach((input, i) => {
    const right = partValue(ex, i);
    const mine = input.value.trim();
    const cell = input.closest('.slot');
    cell.classList.remove('slot');
    cell.classList.add(REVEAL_CLASS[ex.kind], 'is-revealed');
    cell.innerHTML = Number(mine) === right
      ? `<span class="gval">${right}</span>`
      : `<span class="gval">${right}</span><span class="gwas">${mine}</span>`;
  });
}

function riddleRevealHTML(ex) {
  const items = ex.symbols
    .map((s, i) => `<span><span class="riddle-sym riddle-sym-sm">${s}</span> = ${ex.values[i]}</span>`)
    .join('');
  return `<div class="riddle-reveal">${items}</div>`;
}

function renderFeedback(ex, given, correct) {
  const fb = el('feedback');
  fb.dataset.state = correct ? 'correct' : 'wrong';

  if (correct) {
    const praise = ['Správně!', 'Výborně!', 'Přesně tak!', 'Paráda!', 'Skvěle!'];
    /* U hádanky ještě ukážeme, co který obrázek znamenal - dítě si potvrdí,
       že to vyluštilo, a ne jen trefilo. Na přečtení je potřeba chvilku víc. */
    const reveal = ex.kind === 'riddle' ? riddleRevealHTML(ex) : '';
    fb.innerHTML = `<div class="fb-badge"><span aria-hidden="true">🎉</span> ${praise[index % praise.length]}</div>${reveal}`;
    fb.hidden = false;
    advanceTimer = setTimeout(next, reveal ? 2000 : 1100);
    return;
  }

  const steps = explain(ex).map((s) => `<li>${s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</li>`).join('');
  // u znaménka i u porovnávání je odpovědí klíč, ne číslo - ukážeme symbol
  const symbol = (v) => (ex.kind === 'compare' ? COMPARES[v]?.symbol : OPS[v]?.symbol);
  const shown = (v) => (CHOICE_KINDS.has(ex.kind) ? symbol(v) : v);
  const gave = CHOICE_KINDS.has(ex.kind) ? symbol(given) : (Number.isFinite(given) ? given : null);
  /* U mřížky by výpis "Správně je 2, 3, 4" nic neřekl - správné hodnoty už
     jsou vidět v kolečkách, která se právě doplnila. */
  const PARTS_HEAD = {
    grid: 'Takhle měla mřížka vyjít – doplnila jsem ji nahoře.',
    over10: 'Takhle se příklad rozloží – doplnila jsem ho nahoře.',
  };
  const head = hasParts(ex)
    ? `<div class="fb-answer">${PARTS_HEAD[ex.kind]}</div>`
    : `<div class="fb-answer">Správně je <b>${shown(ex.answer)}</b>${gave ? ` <span class="retry-given">(napsala jsi ${gave})</span>` : ''}</div>`;
  if (hasParts(ex)) revealParts(ex);
  fb.innerHTML = `
    <div class="fb-badge"><span aria-hidden="true">🤔</span> Tentokrát ne</div>
    ${head}
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
  storage.saveState(state); // recordRound uz sam neuklada
  renderResult(report);
  show('result');
  if (report.pct >= 70) confetti(46);
  grantRewards(report);
}

/* Odmeny se zapisou do sbirky hned tady, jeste pred spustenim animace. Okno
   je pak uz jen oslava - zavreni, obnoveni stranky ani navrat zpet o odmenu
   nepripravi a `gameId` hlida, aby se tataz sada nezapocitala podruhe. */
function grantRewards(report) {
  if (!gameId) return;
  const solveMs = attempts.reduce((sum, at) => sum + (at.ms > 0 ? at.ms : 0), 0);
  /* Rozpis druhu uloh - z nej si odmeny spoctou casovy rozpocet sady. Slovni
     uloha nebo pyramida trva dyl nez bezny priklad a v prumeru za celou sadu
     by se ten delsi cas rozredil. */
  const kindCounts = attempts.reduce((acc, at) => {
    const kind = at.ex?.kind || 'equation';
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, {});
  const granted = rewards.applyRound(rewardData, {
    gameId,
    mode: config.mode,
    level: rewards.difficultyOf(config),
    max: config.max,
    // druhy navic (slovni ulohy, pyramidy, znamenka) - podminka raritniho
    extras: Array.isArray(config.kinds) ? config.kinds.length : 0,
    kindCounts,
    total: report.total,
    correct: report.correct,
    solveMs,
    nowMs: Date.now(),
  });
  gameId = null; // totez kolo uz se znovu vyhodnotit nemuze
  /* Zapis hned tady, jeste pred animaci - `applyRound` uz sam neuklada.
     Ulozit se musi i kdyz kolo zadnou odmenu neprineslo: pribyl dokonceny
     set, denni objem i zaznam o zpracovanem gameId. */
  storage.saveRewards(rewardData);
  updateBadge(rewardData);
  if (!granted?.length) return;
  showGranted(granted, () => {
    updateBadge(rewardData);
    if (screens.rewards.classList.contains('is-active')) renderCollection(rewardData);
  });
}

function verdictFor(pct) {
  if (pct >= 95) return { mascot: '🏆', text: 'Perfektní!' };
  if (pct >= 80) return { mascot: '🎉', text: 'Moc dobře!' };
  if (pct >= 60) return { mascot: '💪', text: 'Dobrá práce!' };
  if (pct >= 40) return { mascot: '🌱', text: 'Zlepšuješ se!' };
  return { mascot: THEMES[currentTheme()].mascot, text: 'Nevzdávej to!' };
}

/* Mřížka je jediná úloha za kolo, takže prstenec s procenty, hvězdičky ani
   graf podle obtížnosti nad ní nedávají smysl - vyšla, nebo nevyšla. */
function renderGridResult(r) {
  const ok = r.correct === r.total;
  const solved = attempts[0]?.retried && ok;
  const ex = round[0];
  const recent = [...state.rounds.filter((x) => x.mode === 'grid')].slice(0, 5);
  const done = recent.filter((x) => x.correct === x.total).length;

  const listCard = (title, emoji, items, icon) =>
    items.length
      ? `<div class="card">
          <h2 class="card-title"><span aria-hidden="true">${emoji}</span> ${title}</h2>
          <ul class="list">${items.map((t) => `<li><span aria-hidden="true">${icon}</span><span>${t}</span></li>`).join('')}</ul>
        </div>`
      : '';

  el('resultBody').innerHTML = `
    <div class="result-head">
      <div class="result-mascot" aria-hidden="true">${ok ? '🎉' : '🌱'}</div>
      <p class="result-verdict">${ok ? 'Vyluštila jsi ji!' : 'Tahle nevyšla'}</p>
      <div class="grid-verdict" data-ok="${ok}">${ok ? '✓' : '✗'}</div>
      ${solved ? '<p class="score-sub">Napodruhé – a to se počítá.</p>' : ''}
      <p class="score-sub">Mřížka ${ex.size}×${ex.size} · ${ex.family === 'mul' ? 'násobení a dělení' : 'sčítání a odčítání'} · čísla do ${config.max}</p>
      ${r.avgMs ? `<p class="score-sub">Trvalo ti to ${(r.avgMs / 1000).toFixed(1)} s</p>` : ''}
      ${recent.length > 1 ? `<p class="trend">Z posledních ${recent.length} mřížek jsi zvládla ${done}.</p>` : ''}
    </div>
    ${listCard('Co zkusit dál', '💡', r.tips, '→')}`;
}

/* Plocha se vždycky dohraje do konce, takže prstenec s procenty nedává smysl
   a "nevyšlo" tu neznamená nevyřešeno, ale "s moc chybnými spojeními".
   Vlastní obrazovka to říká přesně tak. */
function renderPexesoResult(r) {
  const ok = r.correct === r.total;
  const ex = round[0];
  const misses = attempts[0]?.given ?? 0;
  const limit = pexAllowance();
  const recent = [...state.rounds.filter((x) => x.mode === 'pexeso')].slice(0, 5);
  const done = recent.filter((x) => x.correct === x.total).length;

  const listCard = (title, emoji, items, icon) =>
    items.length
      ? `<div class="card">
          <h2 class="card-title"><span aria-hidden="true">${emoji}</span> ${title}</h2>
          <ul class="list">${items.map((t) => `<li><span aria-hidden="true">${icon}</span><span>${t}</span></li>`).join('')}</ul>
        </div>`
      : '';

  el('resultBody').innerHTML = `
    <div class="result-head">
      <div class="result-mascot" aria-hidden="true">${ok ? '🎉' : '🌱'}</div>
      <p class="result-verdict">${ok ? 'Všechny dvojice máš spojené!' : 'Spojené jsou, ale s chybami'}</p>
      <div class="grid-verdict" data-ok="${ok}">${ok ? '✓' : '✗'}</div>
      <p class="score-sub">${!misses ? 'Bez jediné chyby'
        : ok ? `Špatně spojených: ${misses} – vešla ses do ${limit}`
          : `Špatně spojených: ${misses} · vejít ses měla do ${limit}`}</p>
      <p class="score-sub">${ex.pairs} ${ex.pairs <= 4 ? 'dvojice' : 'dvojic'} · čísla do ${config.max}</p>
      ${r.avgMs ? `<p class="score-sub">Trvalo ti to ${(r.avgMs / 1000).toFixed(1)} s</p>` : ''}
      ${recent.length > 1 ? `<p class="trend">Z posledních ${recent.length} ploch jsi zvládla ${done}.</p>` : ''}
    </div>
    ${listCard('Co zkusit dál', '💡', r.tips, '→')}`;
}

function renderResult(r) {
  if (isGridMode()) return renderGridResult(r);
  if (isPexesoMode()) return renderPexesoResult(r);
  const verdict = verdictFor(r.pct);
  const stars = '⭐'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
  const trend =
    r.trend === null
      ? ''
      : `<p class="trend">${r.trend > 0 ? `📈 O ${r.trend} % lepší než minule!` : r.trend < 0 ? `📉 O ${Math.abs(r.trend)} % méně než minule – nic se neděje.` : '➡️ Stejně jako minule.'}</p>`;

  /* U hádanek ani u rozkladu přes desítku nemá rozpad podle operací co říct
     (všechno je sčítání), zajímavější je, jak šly jednotlivé obtížnosti. */
  const riddle = isRiddleMode();
  const byLevels = usesLevel();
  const levels = levelTable();
  const groups = byLevels
    ? r.byLevel.map((g) => ({ ...g, name: `${levels[g.key].emoji} ${levels[g.key].label}` }))
    : r.byOp.map((g) => ({ ...g, name: `${OPS[g.key].emoji} ${OPS[g.key].label}` }));

  const bars = groups
    .map(
      (g) => `<div class="bar-row">
        <span>${g.name}</span>
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

  const retryNote = riddle
    ? 'Příště přijdou nové hádanky s jinými obrázky.'
    : isOver10Mode()
      ? 'Příště přijdou nové příklady na rozklad.'
      : 'Podobné příklady se objeví v dalším kole.';

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
        <p class="fb-steps-title">${retryNote}</p>
      </div>`
    : `<div class="card"><h2 class="card-title"><span aria-hidden="true">✨</span> Bez jediné chyby!</h2>
        <p style="margin:0;font-weight:700;color:var(--ink-soft)">Nic k procvičení – tohle byla čistá práce.</p></div>`;

  const jednotka = riddle ? 'hádanku' : isOver10Mode() ? 'rozklad' : 'příklad';
  const avg = r.avgMs
    ? `<p class="score-sub">Průměrně ${(r.avgMs / 1000).toFixed(1)} s na ${jednotka}</p>`
    : '';

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
      <h2 class="card-title"><span aria-hidden="true">📊</span> ${byLevels ? 'Podle obtížnosti' : 'Podle operací'}</h2>
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

/* Start aplikace. Nacteni uloziste je asynchronni, takze se vsechno, co
   potrebuje data, deje az tady - posluchace vyse se navazaly hned, ale
   spusti se nejdriv po kliknuti, tedy davno po `boot()`. */
async function boot() {
  const data = await storage.load();
  state = data.state;
  rewardData = data.rewards;
  config = normalizeConfig(state.config) || VYCHOZI_CONFIG();

  applyTheme();
  renderConfigScreen();
  await acceptIncoming(); // prenos z QR kodu az nad nactenym stavem
}

boot();
