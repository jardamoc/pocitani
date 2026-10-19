import {
  CATEGORY_ORDER, COLLECTION_ORDER, ITEM_BY_ID, categoryLabel, collectionOf, headerSrc, itemsOf,
} from './rewards-data.js';
import { collectionSummary, howToGet, newCount, ownsAny, plural } from './rewards.js';

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

/* ---------------- obrazky ----------------
 * Kazda postavicka je samostatny ctvercovy obrazek s pruhlednym pozadim,
 * vepise se do ctverce `box`. alt je prazdny schvalne: popisek nese tlacitko
 * kolem a u neobjevene postavicky se jmeno nesmi objevit nikde. */

export function dumplingHTML(id, box, locked) {
  const item = ITEM_BY_ID.get(id);
  if (!item) return '';
  return `<span class="dumpling-box" style="--box:${box}px"><img class="dumpling" src="${esc(item.src)}" alt="" draggable="false" decoding="async" data-locked="${locked ? 'true' : 'false'}"></span>`;
}

/* Graficky nadpis kategorie. Obrazek ma kolem cedulky hodne prazdna,
   CSS ho proto o kus zaporne odsazuje. */
function headerHTML(key) {
  return `<img class="dumpling-header" src="${esc(headerSrc(key))}" alt="${esc(categoryLabel(key))}" draggable="false" decoding="async">`;
}

/* "dumpling" -> "Dumpling" na tlacitko s volbou sbirky. */
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

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
    // ikona podle toho, co dite sbira; u vic sbirek obecny darek
    const icon = btn.querySelector('.rewards-toggle-icon');
    if (icon) icon.textContent = data.collections.length > 1 ? '🎁' : collectionOf(data.collections[0]).icon;
  }
}

/* ---------------- stranka sbirky ---------------- */

/* Kterou sbirku si dite prave prohlizi. Neuklada se - po navratu na stranku
   se ukaze prvni sbirana. */
let viewKey = null;

export function setCollectionView(key) {
  viewKey = key;
}

/* Prohlizet jde sbirku, kterou dite sbira, i tu, kterou uz nesbira, ale neco
   z ni ma - ziskane postavicky se vypnutim sbirky neztrati. */
const viewable = (data) => COLLECTION_ORDER.filter((k) => data.collections.includes(k) || ownsAny(data, k));

function currentView(data) {
  return viewable(data).includes(viewKey) ? viewKey : data.collections[0];
}

function pickerHTML(data, view, note) {
  const chips = COLLECTION_ORDER.map((k) => {
    const c = collectionOf(k);
    const on = data.collections.includes(k);
    return `<button class="chip${on ? ' is-on' : ''}" type="button" data-collect="${k}" data-value="${k}" aria-pressed="${on}"><span aria-hidden="true">${c.icon}</span> ${esc(c.label)}</button>`;
  }).join('');
  const text = note || (data.collections.length > 1
    ? 'Sbíráš obojí. Po každém kole bez chyby si vybereš, co chceš.'
    : 'Klepnutím sbírku zapneš nebo vypneš. Když zapneš obě, po kole si vybereš.');

  const views = viewable(data);
  const tabs = views.length > 1
    ? `<div class="subject-tabs rew-tabs" role="tablist">${views.map((k) => {
      const c = collectionOf(k);
      const on = k === view;
      return `<button class="subject-tab${on ? ' is-on' : ''}" type="button" role="tab" aria-selected="${on}" data-view="${k}"><span aria-hidden="true">${c.icon}</span> ${esc(c.label)}</button>`;
    }).join('')}</div>`
    : '';

  return `<div class="card">
    <h2 class="card-title"><span aria-hidden="true">🎒</span> Co sbírám?</h2>
    <div class="chips chips-collect">${chips}</div>
    <p class="field-note rew-collect-note">${esc(text)}</p>
  </div>${tabs}`;
}

/* Odmena, u ktere si dite jeste nevybralo sbirku (zavrelo okno driv, nez
   klepnulo). Bere se nejstarsi, dalsi prijdou na radu po ni. */
function pendingHTML(data) {
  const p = data.pendingRewards[0];
  if (!p) return '';
  const choices = data.collections.length > 1 ? data.collections : COLLECTION_ORDER;
  const vic = data.pendingRewards.length > 1 ? ` (čekají ${data.pendingRewards.length})` : '';
  return `<div class="card rew-pending" data-cat="${p.category}">
    <h2 class="card-title"><span aria-hidden="true">🎁</span> Čeká na tebe odměna${vic}!</h2>
    <p class="rew-pending-text">${esc(categoryLabel(p.category))} · ${esc(p.reason)}. Vyber si, co chceš:</p>
    <div class="reward-choices">${choicesHTML(choices, 'data-claim')}</div>
  </div>`;
}

function choicesHTML(keys, attr) {
  return keys.map((k) => {
    const c = collectionOf(k);
    return `<button class="btn btn-primary reward-pick" type="button" ${attr}="${k}"><span aria-hidden="true">${c.icon}</span> ${esc(capital(c.words.one))}</button>`;
  }).join('');
}

function summaryCardHTML(s, data, view) {
  const pct = Math.round((s.activeDays / s.activeDaysNeeded) * 100);
  const level = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low';
  const left = s.activeDaysNeeded - s.activeDays;
  const words = collectionOf(view).words;
  // legendarni prijde z te sbirky, kterou dite po kole vybere
  const legend = data.collections.length > 1 ? 'postavička' : collectionOf(data.collections[0]).words.one;
  const note = left <= 0
    ? `Máš nasbíráno! Legendární ${legend} přijde hned po dalším kole.`
    : left === 1
      ? `Ještě jeden den procvičování a přijde legendární ${legend}.`
      : `Ještě ${left} ${left <= 4 ? 'dny' : 'dnů'} procvičování a přijde legendární ${legend}.`;

  return `<div class="card">
    <h2 class="card-title"><span aria-hidden="true">📦</span> Jak na tom jsem</h2>
    <div class="rew-stats">
      <div class="rew-stat"><span class="rew-stat-num">${s.totalOwned}</span><span class="rew-stat-label">získaných ${esc(words.many)}</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.uniqueOwned} / ${s.uniqueTotal}</span><span class="rew-stat-label">objevených postaviček</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.practiceDays}</span><span class="rew-stat-label">${plural(s.practiceDays, 'den procvičování', 'dny procvičování', 'dnů procvičování')}</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.legendaryOwned}</span><span class="rew-stat-label">${plural(s.legendaryOwned, 'legendární odměna', 'legendární odměny', 'legendárních odměn')}</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.dailyCorrect}</span><span class="rew-stat-label">${s.dailyCorrect >= s.nextVolumeStep ? 'příkladů dnes – na epického máš' : `příkladů dnes, epický od ${s.nextVolumeStep}`}</span></div>
      <div class="rew-stat"><span class="rew-stat-num">${s.perfectSets}</span><span class="rew-stat-label">${plural(s.perfectSets, 'sada bez chyby', 'sady bez chyby', 'sad bez chyby')}</span></div>
    </div>
    <div class="rew-progress">
      <p class="rew-progress-label">Aktivní dny: ${s.activeDays} z ${s.activeDaysNeeded}</p>
      <span class="bar-track"><span class="bar-fill" data-level="${level}" style="width:${pct}%"></span></span>
      <p class="field-note">${note}</p>
    </div>
  </div>`;
}

function slotHTML(item, category, count, view) {
  const locked = !(count > 0);
  // u neobjevene postavicky se skutecne jmeno nikde neobjevi - ani v title
  const unknown = collectionOf(view).unknown;
  const name = locked ? unknown : item.name;
  const label = categoryLabel(category);
  const tip = locked ? `${unknown} · ${label}` : `${item.name} · ${label} · ${pieces(count)}`;

  return `<button class="rew-slot" type="button" data-locked="${locked}" data-cat="${category}" data-id="${item.id}" data-count="${count}" data-tip="${esc(tip)}" title="${esc(tip)}" aria-label="${esc(tip)}, klepni pro návod">
    ${dumplingHTML(item.id, 76, locked)}
    ${count > 1 ? `<span class="rew-count">× ${count}</span>` : ''}
    <span class="rew-name">${esc(name)}</span>
  </button>`;
}

function categoryCardHTML(key, data, view) {
  const items = itemsOf(view, key);
  const owned = items.filter((item) => data.rewardInventory[item.id] > 0).length;
  const slots = items
    .map((item) => slotHTML(item, key, data.rewardInventory[item.id] || 0, view))
    .join('');
  const hint = owned ? `Klepni na ${collectionOf(view).words.acc} a ukáže se, kolik ho máš.` : 'Tuhle kategorii ještě čeká objevení.';

  return `<div class="card rew-cat" data-cat="${key}">
    <div class="rew-cat-head">
      ${headerHTML(key)}
      <p class="rew-cat-sub">${esc(categoryLabel(key))} · ${owned} z ${items.length}</p>
    </div>
    <div class="rew-grid">${slots}</div>
    <p class="rew-detail" aria-live="polite">${esc(hint)}</p>
  </div>`;
}

/* `note` je volitelna hlaska pod vyberem sbirek (napr. ze posledni vypnout
   nejde). */
export function renderCollection(data, note) {
  const view = currentView(data);
  const picker = el('rewardsPicker');
  const summary = el('rewardsSummary');
  const collection = el('rewardsCollection');
  const mascot = el('rewardsMascot');
  if (mascot) mascot.textContent = collectionOf(view).icon;
  if (picker) picker.innerHTML = pendingHTML(data) + pickerHTML(data, view, note);
  if (summary) summary.innerHTML = summaryCardHTML(collectionSummary(data, undefined, view), data, view);
  if (collection) collection.innerHTML = CATEGORY_ORDER.map((key) => categoryCardHTML(key, data, view)).join('');
}

/* ---------------- popup nad jednou postavickou ---------------- */

/* Kliknuti na kolecko otevre okno: kdo to je, kolik jich dite ma a hlavne
   jak se takovy dumpling ziskava. Navod se bere z pravidel, takze nikdy
   nelze proti skutecnemu chovani. */
function popupHTML(id, category, count) {
  const item = ITEM_BY_ID.get(id);
  const locked = !(count > 0);
  const label = categoryLabel(category);
  const navod = howToGet(category, item.collection);
  const jmeno = locked ? collectionOf(item.collection).unknown : item.name;

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
   takze nemuze roztahnout stranku); kliknuti otevre cely navod.

   `handlers` obsluhuji vyber sbirek nahore na strance - zmena stavu a zapis
   patri do app.js: onToggle(klic) zapne/vypne sbirku, onView(klic) prepne
   prohlizenou, onClaim(klic) vybere sbirku u cekajici odmeny. */
export function bindCollectionTaps(handlers = {}) {
  el('rewardsPicker')?.addEventListener('click', (e) => {
    const collect = e.target.closest('[data-collect]');
    if (collect) return handlers.onToggle?.(collect.dataset.collect);
    const view = e.target.closest('[data-view]');
    if (view) return handlers.onView?.(view.dataset.view);
    const claim = e.target.closest('[data-claim]');
    if (claim) return handlers.onClaim?.(claim.dataset.claim);
    return undefined;
  });

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

/* Karta odmeny, u ktere si dite teprve vybira sbirku. Vzacnost uz je znama,
   proto ma karta barvy kategorie; misto postavicky je darek. */
function choiceCardHTML(pending, order) {
  return `<div class="reward-card reward-choice" data-cat="${pending.category}" style="--i:${order}">
    <span class="reward-halo" aria-hidden="true"></span>
    ${sparksHTML(pending.category, order)}
    <span class="dumpling-box reward-mystery" style="--box:${cardBox()}px" aria-hidden="true">🎁</span>
    <div class="reward-info">
      <p class="reward-name">Vyber si, co chceš!</p>
      <p class="reward-cat">${esc(categoryLabel(pending.category))}</p>
      <p class="reward-why">${esc(pending.reason)}</p>
      <div class="reward-choices">${choicesHTML(pending.choices, 'data-pick')}</div>
    </div>
  </div>`;
}

function grantedCardHTML(granted, order) {
  if (granted.pending) return choiceCardHTML(granted, order);
  const label = categoryLabel(granted.category);
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
   okno je jen oslava, nic v nem se nepocita. Vraci true, kdyz se ukazalo.

   Vyjimkou je karta s volbou sbirky (`pending`): klepnuti zavola
   onChoose(klic), ktery odmenu v app.js zapise a vrati ziskanou postavicku;
   karta se pak vymeni za obvyklou. Zavrene okno bez volby nic nezahodi,
   odmena pocka na strance sbirky. */
export function showGranted(granted, onClose, onChoose) {
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
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const got = onChoose?.(pick.dataset.pick);
      const card = pick.closest('.reward-card');
      if (got && card) {
        // nova karta si animaci prehraje sama, i po dosazeni ostatnich
        list.classList.remove('is-instant');
        card.outerHTML = grantedCardHTML(got, 0);
      }
      return undefined;
    }
    if (!settled) return settle();
    // dokud se vybira, klepnuti vedle okno nezavre - jen tlacitko Pokracovat
    if (list.querySelector('.reward-choice')) return undefined;
    close();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      return close();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest?.('#rewardCloseBtn, [data-pick]')) return undefined;
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
