import * as storage from './storage.js';

/* Hlaseni rodici: po kazdem dohranem kole posle shrnuti na server
 * (/api/kolo, worker/index.js). Server ho ulozi do prehledu a posle
 * upozorneni do telefonu pres ntfy.
 *
 * Bez internetu se zprava podrzi ve fronte a odejde pri pristim pripojeni
 * nebo pristim spusteni. Na localStorage nesaha - jde pres storage.js.
 *
 * Zavislosti: storage.js -> TENHLE MODUL -> app.js
 */

const ADRESA = '/api/kolo';
// vic zprav se neuklada - kdyby server dlouho nebezel, fronta neporoste donekonecna
const MAX_FRONTA = 50;
const MAX_JMENO = 40;

let data = null; // { id, name, outbox: [] }
let odesilam = false;

/* Vychozi jmeno, dokud si ho rodic v Nastaveni neprepise. Prohlizec vic nez
   druh zarizeni nerekne. */
export function odhadZarizeni(ua = globalThis.navigator?.userAgent || '') {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && globalThis.navigator?.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android telefon' : 'Android tablet';
  if (/Windows/.test(ua)) return 'Počítač s Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Počítač s Linuxem';
  return 'Neznámé zařízení';
}

function noveId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function ocisti(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    id: typeof r.id === 'string' && /^[\w-]{6,64}$/.test(r.id) ? r.id : noveId(),
    name: typeof r.name === 'string' ? r.name.trim().slice(0, MAX_JMENO) : '',
    outbox: Array.isArray(r.outbox) ? r.outbox.filter((k) => k && typeof k === 'object' && typeof k.id === 'string').slice(-MAX_FRONTA) : [],
  };
}

/* Na vyvojovem serveru se nic neposila - zkusebni kola by chodila do telefonu. */
function jeVyvoj() {
  const host = globalThis.location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host === '';
}

export async function nactiHlaseni() {
  const raw = await storage.loadHlaseni();
  data = ocisti(raw);
  if (!raw || raw.id !== data.id) await storage.saveHlaseni(data);
  void odesliFrontu();
}

export function jmenoZarizeni() {
  return data?.name || odhadZarizeni();
}

export function vlastniJmeno() {
  return data?.name || '';
}

export async function nastavJmeno(jmeno) {
  if (!data) data = ocisti(null);
  data.name = String(jmeno || '').trim().slice(0, MAX_JMENO);
  await storage.saveHlaseni(data);
}

/* Prida kolo do fronty a hned zkusi odeslat. Na vysledek se neceka. */
export function odesliKolo(kolo) {
  if (!data) data = ocisti(null);
  data.outbox = [...data.outbox, { ...kolo, zarizeni: { id: data.id, jmeno: jmenoZarizeni(), typ: odhadZarizeni() } }].slice(-MAX_FRONTA);
  void storage.saveHlaseni(data).then(odesliFrontu);
}

export async function odesliFrontu() {
  if (odesilam || !data?.outbox.length || jeVyvoj()) return;
  if (globalThis.navigator?.onLine === false) return;
  odesilam = true;
  try {
    while (data.outbox.length) {
      const kolo = data.outbox[0];
      let res;
      try {
        res = await fetch(ADRESA, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kolo),
          keepalive: true,
        });
      } catch {
        break; // bez site - zkusi se to priste
      }
      /* 2xx = prijato, 4xx = server zpravu nikdy neprijme (vadna data),
         nema smysl ji drzet. 429 a 5xx se zkusi znovu pozdeji. */
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        data.outbox = data.outbox.slice(1);
        await storage.saveHlaseni(data);
      } else {
        break;
      }
    }
  } finally {
    odesilam = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void odesliFrontu());
}
