import { ALL_IDS } from './rewards-data.js';

/* Prenos progresu mezi zarizenimi.
 *
 * Data se zabali do jednoho retezce, ten se vlozi do URL jako parametr `p`
 * a z URL se udela QR kod. Na druhem zarizeni se QR vyfoti bezne aplikaci
 * Fotoaparat, telefon nabidne otevrit odkaz a aplikace si pri nacteni
 * parametr precte a slouci s tim, co uz ma.
 *
 * Slucovani je zamerne **idempotentni** - u poctu se bere vyssi hodnota,
 * u seznamu sjednoceni. Naskenovani tehoz QR podruhe tak nic nezdvoji.
 *
 * Modul sam nic neuklada - `mergePayload()` slouci data v pameti a vrati
 * souhrn zmen. O zapis se stara app.js pres storage.js.
 *
 * Zavislosti: rewards-data.js -> TENHLE MODUL -> app.js
 */

export const PARAM = 'p';
export const FORMAT = 1;

/* Kolik dni zpetne se prenasi vysledky kol. Vic historie se do QR nevejde
   a na pokracovani stejne neni potreba. */
export const ROUNDS_DAYS = 5;

/* ---------------- kodovani ---------------- */

/* Base64url bez vyplnovych '=' - v URL se nemusi nic escapovat a QR kod
   diky tomu zustane kratsi. */
function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* Prohlizec umi deflate sam (CompressionStream), takze se komprimuje bez
   jakekoli knihovny. Kdyz ho nema, posle se JSON nezabaleny - pozna se to
   podle prvniho znaku prefixu. */
const CAN_COMPRESS = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function streamThrough(bytes, stream) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

export async function encodePayload(payload) {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  if (!CAN_COMPRESS) return `r${toBase64Url(json)}`;
  const packed = await streamThrough(json, new CompressionStream('deflate-raw'));
  return `z${toBase64Url(packed)}`;
}

export async function decodePayload(text) {
  if (typeof text !== 'string' || text.length < 2) return null;
  const kind = text[0];
  const bytes = fromBase64Url(text.slice(1));
  const json = kind === 'z'
    ? await streamThrough(bytes, new DecompressionStream('deflate-raw'))
    : bytes;
  const parsed = JSON.parse(new TextDecoder().decode(json));
  return parsed && typeof parsed === 'object' ? parsed : null;
}

/* ---------------- co se prenasi ---------------- */

const dayMs = 86400000;

/* Inventar se posila jako pole cisel v poradi ALL_IDS, ne jako objekt -
   usetri to ctyricet klicu, ktere by jinak zabraly vic nez sama data. */
function packInventory(inventory) {
  return ALL_IDS.map((id) => inventory[id] || 0);
}

function unpackInventory(list) {
  const out = {};
  ALL_IDS.forEach((id, i) => {
    const n = Number(Array.isArray(list) ? list[i] : 0);
    out[id] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  });
  return out;
}

/* Sestavi balicek z aktualniho stavu. Kratke klice jsou schvalne - kazdy
   usetreny bajt se v QR kodu pozna. */
export function buildPayload(state, rewardData, nowMs = Date.now()) {
  const od = nowMs - ROUNDS_DAYS * dayMs;
  return {
    v: FORMAT,
    // sbirka odmen
    i: packInventory(rewardData.rewardInventory),
    tc: rewardData.totalCorrectAnswers,
    cs: rewardData.completedSets,
    ps: rewardData.perfectSets,
    dd: rewardData.dailyDate,
    dc: rewardData.dailyCorrect,
    ad: rewardData.activePracticeDates,
    ld: rewardData.legendaryDaysUsed,
    cm: rewardData.completedMilestones,
    ur: rewardData.ultimateRuns,
    // uspesnost podle dovednosti a seznam chyb k procvicovani
    sk: state.skills,
    ms: state.missed,
    // vysledky kol za poslednich par dni
    rd: state.rounds.filter((r) => Number(r.at) >= od),
    // nastaveni, aby se dalo rovnou pokracovat
    cf: state.config,
    th: state.theme,
    dk: state.dark,
    sn: state.sound,
  };
}

/* ---------------- slucovani ---------------- */

const vyssi = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);

const sjednoceni = (a, b, limit) => [...new Set([...(a || []), ...(b || [])])].slice(-limit);

/* Slouci prichozi balicek do stavu zarizeni. Nic se neprepisuje smerem dolu -
   co uz dite ma, o to neprijde. */
export function mergePayload(state, rewardData, payload) {
  if (!payload || payload.v !== FORMAT) return null;

  const zmeny = { dumplingu: 0, novych: 0, chyb: 0, kol: 0 };

  /* Jestli je zarizeni cerstve, se musi zjistit JESTE PRED slucovanim -
     o par radku niz uz by seznam kol byl plny z prichozich dat a podminka
     by nikdy neplatila. */
  const cerstve = !state.config && !state.rounds.length;

  // inventar: u kazde postavicky plati vyssi pocet, ne soucet - druhe
  // naskenovani tehoz kodu tak nic nezdvoji
  const prichozi = unpackInventory(payload.i);
  for (const id of ALL_IDS) {
    const pred = rewardData.rewardInventory[id] || 0;
    const po = Math.max(pred, prichozi[id]);
    if (po > pred) {
      zmeny.dumplingu += po - pred;
      if (pred === 0) zmeny.novych += 1;
      if (!rewardData.newRewardIds.includes(id)) rewardData.newRewardIds.push(id);
    }
    rewardData.rewardInventory[id] = po;
  }

  rewardData.totalCorrectAnswers = vyssi(rewardData.totalCorrectAnswers, payload.tc);
  rewardData.completedSets = vyssi(rewardData.completedSets, payload.cs);
  rewardData.perfectSets = vyssi(rewardData.perfectSets, payload.ps);
  rewardData.ultimateRuns = vyssi(rewardData.ultimateRuns, payload.ur);
  rewardData.activePracticeDates = sjednoceni(rewardData.activePracticeDates, payload.ad, 120).sort();
  rewardData.legendaryDaysUsed = sjednoceni(rewardData.legendaryDaysUsed, payload.ld, 120).sort();
  rewardData.completedMilestones = sjednoceni(rewardData.completedMilestones, payload.cm, 400);

  // denni objem plati jen pro tentyz kalendarni den
  if (payload.dd && payload.dd === rewardData.dailyDate) {
    rewardData.dailyCorrect = vyssi(rewardData.dailyCorrect, payload.dc);
  } else if (payload.dd && !rewardData.dailyDate) {
    rewardData.dailyDate = payload.dd;
    rewardData.dailyCorrect = Number(payload.dc) || 0;
  }

  // uspesnost podle dovednosti: u kazde bereme vyssi pocty, aby opakovany
  // prenos nenafoukl statistiku
  if (payload.sk && typeof payload.sk === 'object') {
    for (const [skill, hodnoty] of Object.entries(payload.sk)) {
      if (!hodnoty || typeof hodnoty !== 'object') continue;
      const mistni = (state.skills[skill] ||= { seen: 0, wrong: 0 });
      mistni.seen = vyssi(mistni.seen, hodnoty.seen);
      mistni.wrong = Math.min(mistni.seen, vyssi(mistni.wrong, hodnoty.wrong));
    }
  }

  // seznam chyb: sjednoceni podle podpisu ulohy, nejvys ctyricet
  if (Array.isArray(payload.ms)) {
    const pred = state.missed.length;
    const vsechny = [...payload.ms, ...state.missed].filter((m) => m && typeof m === 'object');
    const videne = new Set();
    state.missed = vsechny
      .filter((m) => {
        const klic = JSON.stringify([m.op, m.kind, m.missing, m.a, m.b, m.c, m.cross]);
        if (videne.has(klic)) return false;
        videne.add(klic);
        return true;
      })
      .slice(0, 40);
    zmeny.chyb = Math.max(0, state.missed.length - pred);
  }

  // vysledky kol: spojit podle casu, nejnovejsi napred, nejvys dvacet
  if (Array.isArray(payload.rd)) {
    const pred = state.rounds.length;
    const podleCasu = new Map();
    for (const kolo of [...state.rounds, ...payload.rd]) {
      if (kolo && Number.isFinite(Number(kolo.at))) podleCasu.set(Number(kolo.at), kolo);
    }
    state.rounds = [...podleCasu.values()].sort((a, b) => b.at - a.at).slice(0, 20);
    zmeny.kol = Math.max(0, state.rounds.length - pred);
  }

  /* Nastaveni se prenasi jen na zarizeni, ktere jeste nic neodehralo.
     Jinak by prichozi kod prepsal tema i rozsah nekomu, kdo si je prave
     nastavil - a to by prekvapilo. */
  if (cerstve) {
    if (payload.cf && typeof payload.cf === 'object') state.config = payload.cf;
    if (typeof payload.th === 'string') state.theme = payload.th;
    if (typeof payload.dk === 'boolean') state.dark = payload.dk;
    if (typeof payload.sn === 'boolean') state.sound = payload.sn;
  }

  /* Ulozeni tady neni schvalne - funkce jen slouci data v pameti a vrati
     souhrn. Zapis obstara volajici (acceptIncoming v app.js) pres
     storage.js, takze na uloziste vede jedina cesta. */
  return zmeny;
}

/* ---------------- URL ---------------- */

/* Adresa, ze ktere aplikace bezi, plus zabaleny progres. Bere se aktualni
   origin, takze QR vytvoreny na nasazenem webu vede na nasazeny web. */
export async function buildTransferUrl(state, rewardData, nowMs = Date.now()) {
  const payload = await encodePayload(buildPayload(state, rewardData, nowMs));
  const base = `${location.origin}${location.pathname}`;
  return `${base}?${PARAM}=${payload}`;
}

/* Precte parametr z adresy a rovnou ho z adresy odstrani, aby obnoveni
   stranky uz prenos neopakovalo. Slucovani je sice idempotentni, ale
   dlouha adresa v radku prohlizece je jen na obtiz. */
export async function readIncoming() {
  const params = new URLSearchParams(location.search);
  const raw = params.get(PARAM);
  if (!raw) return null;

  params.delete(PARAM);
  const zbytek = params.toString();
  history.replaceState(null, '', `${location.pathname}${zbytek ? `?${zbytek}` : ''}${location.hash}`);

  try {
    return await decodePayload(raw);
  } catch {
    /* poskozeny nebo cizi odkaz - aplikace musi nabehnout normalne */
    return null;
  }
}
