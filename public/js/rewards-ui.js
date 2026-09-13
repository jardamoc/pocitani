import { CATEGORIES, CATEGORY_ORDER, ITEM_BY_ID, SPRITE, UNKNOWN_NAME } from './rewards-data.js';
import { collectionSummary, howToGet, newCount, plural } from './rewards.js';

/* Vykresleni odmen. Tenhle modul se stara o DOM a animace, zadne pravidlo
 * odmen tu neni - ta jsou vsechna v rewards.js.
 *
 * Zavislosti: rewards-data.js -> rewards.js -> TENHLE MODUL -> app.js
 */

const el = (id) => document.getElementById(id);

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* Texty od nas, ale prochazi pres innerHTML - radsi je poctive escapujeme. */
const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const pieces = (n) => `${n} ${plural(n, 'kus', 'kusy', 'kusů')}`;

/* ---------------- sprite ----------------
 * Cely obrazek je jeden sprite sheet. Pri zmene velikosti se musi prepocitat
 * najednou rozmer prvku, background-position i background-size, jinak by se
 * vyrez rozjel. Pomer stran 1254x1254 zustava 1:1. */

const px = (n) => `${Math.round(n * 100) / 100}px`;

/* Postavicky na sprite sheetu se dotykaji, takze pri zmenseni na necele
   pixely prohlizec pri vyhlazovani natahne i prvni sloupec souseda - u
   kolecka to bylo videt jako barevny prouzek u hrany. Zobrazeny vyrez proto
   o pixel z kazde strany orizneme. Souradnice v rewards-data.js se NEMENI,
   tohle je ciste zobrazovaci pojistka. */
const TRIM = 1;

function spriteVars(rect, scale) {
  return [
    `--sw:${px(Math.max(1, rect.width * scale - 2 * TRIM))}`,
    `--sh:${px(Math.max(1, rect.height * scale - 2 * TRIM))}`,
    `--bx:${px(-(rect.x * scale + TRIM))}`,
    `--by:${px(-(rect.y * scale + TRIM))}`,
    `--bs:${px(SPRITE.width * scale)}`,
  ].join(';');
}

/* Postavicka se vepise do ctverce `box` - meritko urcuje delsi strana vyrezu,
   aby vysoke i siroke postavicky vysly opticky stejne velke. */
export function dumplingHTML(id, box, locked) {
  const item = ITEM_BY_ID.get(id);
  if (!item) return '';
  const scale = box / Math.max(item.width, item.height);
  return `<span class="dumpling-box" style="--box:${box}px"><span class="dumpling" data-locked="${locked ? 'true' : 'false'}" style="${spriteVars(item, scale)}"></span></span>`;
}

/* Graficky nadpis kategorie - stejny sprite sheet, meritko podle vysky. */
function headerHTML(key, height) {
  const rect = CATEGORIES[key].header;
  const scale = height / rect.height;
  return `<span class="dumpling-header" role="img" aria-label="${esc(CATEGORIES[key].label)}" style="${spriteVars(rect, scale)}"></span>`;
}

/* ---------------- odznak u tlacitka ---------------- */

export function updateBadge(data) {
  const badge = el('rewardsBadge');
  if (!badge) return;
  const n = newCount(data);
  badge.textContent = String(n);
  badge.hidden = n === 0;
  const btn = el('rewardsBtn');
  if (btn) {
    btn.setAttribute('aria-label', n ? `Otevřít sbírku odměn – ${n} nových` : 'Otevřít sbírku odměn');
  }
}

/* ---------------- stranka sbirky ---------------- */

function summaryCardHTML(s) {
  const pct = Math.round((s.activeDays / s.activeDaysNeeded) * 100);
  const level = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low';
  const left = s.activeDaysNeeded - s.activeDays;
  const note = left <= 0
    ? 'Máš nasbíráno! Legendární dumpling přijde hned po dalším kole.'
    : left === 1
      ? 'Ještě jeden den procvičování a přijde legendární dumpling.'
      : `Ještě ${left} ${left <= 4 ? 'dny' : 'dnů'} procvičování a přijde legendární dumpling.`;

  return `<div class="card">
    <h2 class="card-title"><span aria-hidden="true">📦</span> Jak na tom jsem</h2>
    <div class="rew-stats">
      <div class="rew-stat"><span class="rew-stat-num">${s.totalOwned}</span><span class="rew-stat-label">získaných dumplingů</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.uniqueOwned} / ${s.uniqueTotal}</span><span class="rew-stat-label">objevených postaviček</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.practiceDays}</span><span class="rew-stat-label">${plural(s.practiceDays, 'den procvičování', 'dny procvičování', 'dnů procvičování')}</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.legendaryOwned}</span><span class="rew-stat-label">${plural(s.legendaryOwned, 'legendární odměna', 'legendární odměny', 'legendárních odměn')}</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.dailyCorrect}</span><span class="rew-stat-label">${s.dailyCorrect >= s.nextVolumeStep ? 'příkladů dnes – bonus máš' : `příkladů dnes, bonus od ${s.nextVolumeStep}`}</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.perfectSets}</span><span class="rew-stat-label">${plural(s.perfectSets, 'sada bez chyby', 'sady bez chyby', 'sad bez chyby')}</span></div>
    </div>
    <div class="rew-progress">
      <p class="rew-progress-label">Aktivní dny: ${s.activeDays} z ${s.activeDaysNeeded}</p>
      <span class="bar-track"><span class="bar-fill" data-level="${level}" style="width:${pct}%"></span></span>
      <p class="field-note">${note}</p>
    </div>
  </div>`;
}

function slotHTML(item, category, count) {
  const locked = !(count > 0);
  // u neobjevene postavicky se skutecne jmeno nikde neobjevi - ani v title
  const name = locked ? UNKNOWN_NAME : item.name;
  const label = CATEGORIES[category].label;
  const tip = locked ? `${UNKNOWN_NAME} · ${label}` : `${item.name} · ${label} · ${pieces(count)}`;

  return `<button class="rew-slot" type="button" data-locked="${locked}" data-cat="${category}" data-id="${item.id}" data-count="${count}" data-tip="${esc(tip)}" title="${esc(tip)}" aria-label="${esc(tip)}, klepni pro návod">
    ${dumplingHTML(item.id, 76, locked)}
    ${count > 1 ? `<span class="rew-count">× ${count}</span>` : ''}
    <span class="rew-name">${esc(name)}</span>
  </button>`;
}

function categoryCardHTML(key, data) {
  const cat = CATEGORIES[key];
  const owned = cat.items.filter((item) => data.rewardInventory[item.id] > 0).length;
  const slots = cat.items
    .map((item) => slotHTML(item, key, data.rewardInventory[item.id] || 0))
    .join('');
  const hint = owned ? 'Klepni na dumplinga a ukáže se, kolik ho máš.' : 'Tuhle kategorii ještě čeká objevení.';

  return `<div class="card rew-cat" data-cat="${key}">
    <div class="rew-cat-head">
      ${headerHTML(key, 40)}
      <p class="rew-cat-sub">${esc(cat.label)} · ${owned} z ${cat.items.length}</p>
    </div>
    <div class="rew-grid">${slots}</div>
    <p class="rew-detail" aria-live="polite">${esc(hint)}</p>
  </div>`;
}

export function renderCollection(data) {
  const summary = el('rewardsSummary');
  const collection = el('rewardsCollection');
  if (summary) summary.innerHTML = summaryCardHTML(collectionSummary(data));
  if (collection) collection.innerHTML = CATEGORY_ORDER.map((key) => categoryCardHTML(key, data)).join('');
}

/* ---------------- popup nad jednou postavickou ---------------- */

/* Kliknuti na kolecko otevre okno: kdo to je, kolik jich dite ma a hlavne
   jak se takovy dumpling ziskava. Navod se bere z pravidel, takze nikdy
   nelze proti skutecnemu chovani. */
function popupHTML(id, category, count) {
  const item = ITEM_BY_ID.get(id);
  const locked = !(count > 0);
  const label = CATEGORIES[category].label;
  const navod = howToGet(category);
  const jmeno = locked ? UNKNOWN_NAME : item.name;

  return `<div class="popup-head" data-cat="${category}">
      ${dumplingHTML(id, cardBox() + 24, locked)}
      <p id="popupName" class="popup-name">${esc(jmeno)}</p>
      <p class="popup-cat">${esc(label)}</p>
      <p class="popup-count">${locked
        ? 'Tuhle postavičku ještě nemáš'
        : `Máš ${pieces(count)}`}</p>
    </div>
    <div class="popup-how">
      <h3 class="popup-how-title">Jak ho získat</h3>
      <p class="popup-lead">${esc(navod.lead)}</p>
      <ul class="list">${navod.bullets.map((b) => `<li><span aria-hidden="true">→</span><span>${esc(b)}</span></li>`).join('')}</ul>
      <p class="popup-tail">${esc(navod.tail)}</p>
    </div>`;
}

let closePopup = null;

function openPopup(slot) {
  const overlay = el('dumplingPopup');
  const body = el('popupBody');
  if (!overlay || !body) return;

  body.innerHTML = popupHTML(slot.dataset.id, slot.dataset.cat, Number(slot.dataset.count) || 0);
  overlay.hidden = false;
  el('dumplingDialog')?.focus();

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('click', onClick);
    overlay.hidden = true;
    body.innerHTML = '';
    closePopup = null;
    slot.focus();
  };

  // klik mimo dialog i krizek zaviraji; uvnitr se da bez obav vybirat text
  function onClick(e) {
    if (e.target.closest('#popupCloseBtn') || !e.target.closest('#dumplingDialog')) close();
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      close();
    }
  }

  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', onClick);
  closePopup = close;
}

export function dismissPopup() {
  closePopup?.();
}

/* Najeti mysi jen napise podrobnost do radku pod mrizkou (v normalnim toku,
   takze nemuze roztahnout stranku); kliknuti otevre cely navod. */
export function bindCollectionTaps() {
  const root = el('rewardsCollection');
  if (!root) return;

  const showTip = (slot) => {
    const detail = slot?.closest('.rew-cat')?.querySelector('.rew-detail');
    if (!detail) return;
    detail.textContent = slot.dataset.tip;
    detail.dataset.active = 'true';
  };

  root.addEventListener('click', (e) => {
    const slot = e.target.closest('.rew-slot');
    if (!slot) return;
    for (const on of root.querySelectorAll('.rew-slot.is-open')) on.classList.remove('is-open');
    slot.classList.add('is-open');
    showTip(slot);
    openPopup(slot);
  });

  for (const type of ['mouseover', 'focusin']) {
    root.addEventListener(type, (e) => showTip(e.target.closest?.('.rew-slot')));
  }
}

/* ---------------- zaverecne okno ---------------- */

/* Kolik jiskricek doprovodi kterou kategorii. Zakladni dumpling ma jen
   objeveni a poskoceni, u vzacnejsich castic pribyva. */
const SPARK_COUNT = { basic: 0, uncommon: 4, rare: 7, epic: 9, legendary: 12 };

function sparksHTML(category, order) {
  const n = SPARK_COUNT[category] || 0;
  if (!n || reducedMotion()) return '<span class="reward-sparks" aria-hidden="true"></span>';
  let out = '';
  for (let i = 0; i < n; i += 1) {
    const angle = (Math.PI * 2 * i) / n + order * 0.4;
    const dist = 34 + (i % 3) * 13;
    const delay = (order * 0.28 + 0.25 + i * 0.05).toFixed(2);
    out += `<span class="spark" style="--dx:${Math.round(Math.cos(angle) * dist)}px;--dy:${Math.round(Math.sin(angle) * dist)}px;--d:${delay}s"></span>`;
  }
  return `<span class="reward-sparks" aria-hidden="true">${out}</span>`;
}

/* Na uzkem displeji musi postavicka ustoupit, jinak zbyde na duvod odmeny
   sotva sto pixelu a text se lame po slabikach. */
const cardBox = () => (window.innerWidth <= 380 ? 68 : 96);

function grantedCardHTML(granted, order) {
  const label = CATEGORIES[granted.category].label;
  // pribytek u uz vlastnene postavicky se kratce zvyrazni
  const bump = granted.isNew
    ? ''
    : ` class="reward-num is-bumped" style="animation-delay:calc(var(--i, 0) * .28s + .45s)"`;

  return `<div class="reward-card" data-cat="${granted.category}" data-new="${granted.isNew}" style="--i:${order}">
    <span class="reward-halo" aria-hidden="true"></span>
    ${sparksHTML(granted.category, order)}
    ${dumplingHTML(granted.id, cardBox(), false)}
    <span class="reward-new">Nová</span>
    <div class="reward-info">
      <p class="reward-name">${esc(granted.name)}</p>
      <p class="reward-cat">${esc(label)}</p>
      <p class="reward-why">${esc(granted.reason)}</p>
      <p class="reward-count">Máš ${granted.owned === 1 ? 'ji poprvé' : `jich <span${bump || ' class="reward-num"'}>${granted.owned}</span>`}</p>
    </div>
  </div>`;
}

let closeOverlay = null;

/* Ukaze okno se ziskanymi odmenami. Do sbirky uz jsou v tuhle chvili zapsane -
   okno je jen oslava, nic v nem se nepocita. Vraci true, kdyz se ukazalo. */
export function showGranted(granted, onClose) {
  const overlay = el('rewardOverlay');
  const list = el('rewardList');
  if (!overlay || !list || !granted?.length) return false;

  list.classList.remove('is-instant');
  list.innerHTML = granted.map((g, i) => grantedCardHTML(g, i)).join('');
  overlay.hidden = false;
  el('rewardDialog')?.focus();

  let settled = reducedMotion();
  if (settled) list.classList.add('is-instant');

  const settle = () => {
    settled = true;
    list.classList.add('is-instant');
  };

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('click', onClick);
    overlay.hidden = true;
    list.innerHTML = '';
    closeOverlay = null;
    onClose?.();
  };

  /* Prvni kliknuti nebo Enter animaci dosadi na konec, druhe okno zavre.
     Escape a tlacitko Pokracovat zaviraji rovnou. */
  function onClick(e) {
    if (e.target.closest('#rewardCloseBtn')) return close();
    if (!settled) return settle();
    close();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      return close();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest?.('#rewardCloseBtn')) return undefined;
      e.preventDefault();
      return settled ? close() : settle();
    }
    return undefined;
  }

  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', onClick);
  closeOverlay = close;
  return true;
}

/* Pojistka pro pripad, ze se okno musi zavrit zvenku (odchod z obrazovky). */
export function dismissGranted() {
  closeOverlay?.();
}
