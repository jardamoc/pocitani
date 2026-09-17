import * as store from './stats.js';
import * as rewards from './rewards.js';

/* Jedina vrstva nad ulozistem. Krome tohohle souboru uz na localStorage
 * nesaha nikdo - stats.js i rewards.js si nechaly jen cistou logiku.
 *
 * Rozhrani je asynchronni schvalne, i kdyz uvnitr bezi synchronni
 * localStorage. Server ani databaze synchronni byt nemuze, takze az prijdou
 * ucty, vymeni se jedine `backend` a zadny jiny soubor se kvuli tomu
 * neprepisuje.
 *
 * Zavislosti: stats.js / rewards.js -> TENHLE MODUL -> app.js
 */

/* Kolik se ceka, nez se nasbirane zmeny zapisou. Na localStorage je to
   jedno, u serveru je to rozdil mezi jednim pozadavkem a deseti. */
const DAVKA_MS = 300;

/* ---------------- uloziste v prohlizeci ---------------- */

/* Klice zustavaji stejne jako drive, takze nikdo o ulozena data neprijde. */
const localBackend = {
  async load() {
    return {
      state: store.sanitizeState(precti(store.KEY)),
      rewards: rewards.sanitize(precti(rewards.STORAGE_KEY)),
    };
  },

  async saveState(state) {
    zapis(store.KEY, state);
  },

  async saveRewards(data) {
    zapis(rewards.STORAGE_KEY, data);
  },

  /* Tri rozsahy podle tlacitek v dialogu Nastaveni:
       'rewards'  = jen sbirka odmen
       'progress' = sbirka i historie pocitani (nastaveni zustane)
       'all'      = uplne vsechno
     Sbirku maze i 'progress' - tak to delal puvodni wipe() a tak to
     odpovida popisku tlacitka. Vlastni stav pri 'progress' vycisti app.js
     a ulozi ho znovu, aby v nem zustalo nastaveni a tema. */
  async clear(scope) {
    smaz(rewards.STORAGE_KEY);
    if (scope === 'all') smaz(store.KEY);
  },
};

function precti(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    /* prazdne, poskozene nebo zakazane uloziste - sanitizace z toho udela
       vychozi stav a aplikace se spusti */
    return null;
  }
}

function zapis(key, hodnota) {
  try {
    localStorage.setItem(key, JSON.stringify(hodnota));
  } catch {
    /* privatni rezim nebo plne uloziste - hra funguje dal i bez ulozeni */
  }
}

function smaz(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* viz vyse */
  }
}

/* Vychozi uloziste je exportovane, aby se dalo po vymene vratit zpatky -
   vyuzivaji to testy. */
export const LOCAL_BACKEND = localBackend;

let backend = localBackend;

export function setBackend(b) {
  backend = b;
}

/* ---------------- fronta zapisu ---------------- */

/* Drzi se vzdy jen POSLEDNI stav, ne seznam zmen. Deset kliknuti po sobe
   tak skonci jednim zapisem toho, co plati ted. */
const cekajici = { state: null, rewards: null };
let timer = null;

function naplanuj() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, DAVKA_MS);
}

export async function load() {
  return backend.load();
}

export function saveState(state) {
  cekajici.state = state;
  naplanuj();
}

export function saveRewards(data) {
  cekajici.rewards = data;
  naplanuj();
}

/* Dokonci cekajici zapis okamzite. Vola se pri odchodu ze stranky a vsude,
   kde se stav pak hned znovu nacita (mazani). */
export async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const state = cekajici.state;
  const data = cekajici.rewards;
  cekajici.state = null;
  cekajici.rewards = null;

  if (state) await backend.saveState(state);
  if (data) await backend.saveRewards(data);
}

/* Tri rozsahy mazani. Cekajici zapis se nejdriv zahodi - jinak by se
   o par set milisekund pozdeji vratil zpatky to, co se prave smazalo. */
export async function clear(scope) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  cekajici.state = null;
  cekajici.rewards = null;
  await backend.clear(scope);
}

/* Zavreni karty, prepnuti na jinou aplikaci nebo zhasnuti telefonu. Podle
   `visibilitychange` se pozna i zavreni na mobilu, kde se `beforeunload`
   casto vubec nespusti. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
