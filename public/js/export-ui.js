import { qrMatrix, qrSvg, qrCapacity } from './qr.js';
import { buildTransferUrl } from './transfer.js';
import { verzeText } from './version.js';

/* Dialog "Export" - prenos progresu na druhe zarizeni a mazani.
 *
 * Zavislosti: qr.js / transfer.js -> TENHLE MODUL -> app.js
 */

const el = (id) => document.getElementById(id);

/* Staticke heslo je zamek na dvirka od spizirny, ne trezor: ma zabranit
   tomu, aby si osmileta omylem smazala sbirku. Kdo umi otevrit zdrojovy
   kod, dostane se dal - a to je v poradku. */
const HESLO = '190417';

/* Mazani je nevratne, tak se kazde jeste jednou potvrzuje. */
const MAZANI = [
  {
    id: 'wipeRewardsBtn',
    scope: 'rewards',
    otazka: 'Opravdu smazat celou sbírku dumplingů? Historie počítání a nastavení zůstanou.',
  },
  {
    id: 'wipeProgressBtn',
    scope: 'progress',
    otazka: 'Opravdu smazat sbírku dumplingů i historii počítání? Téma, zvuk a nastavení hry zůstanou.',
  },
  {
    id: 'wipeAllBtn',
    scope: 'all',
    otazka: 'Opravdu smazat úplně všechno? Aplikace bude jako po prvním spuštění. Tohle nejde vzít zpět.',
  },
];

let closeExport = null;

async function renderQr(state, rewardData) {
  const box = el('exportQr');
  const note = el('exportQrNote');
  if (!box || !note) return;

  box.innerHTML = '';
  note.textContent = 'Připravuji kód…';

  try {
    const url = await buildTransferUrl(state, rewardData);
    const kapacita = qrCapacity('L');
    if (url.length > kapacita) {
      note.textContent = `Postup je na jeden QR kód moc velký (${url.length} z ${kapacita} znaků). Zkus napřed smazat sbírku i historii níže.`;
      return;
    }
    /* Cerna na bile bez ohledu na tmavy rezim - ctecky potrebuji kontrast
       a inverzni QR kod spousta telefonu neprecte. */
    box.innerHTML = qrSvg(qrMatrix(url, 'L'), { size: 260, quiet: 4, dark: '#000', light: '#fff' });
    note.textContent = 'Vyfoť tenhle kód běžnou aplikací Fotoaparát na druhém zařízení. Telefon nabídne otevřít odkaz a progres se sloučí s tím, co tam už je.';
  } catch (err) {
    note.textContent = `Kód se nepodařilo vytvořit: ${err.message}`;
  }
}

export function openExport({ state, rewardData, onWipe }) {
  const overlay = el('exportOverlay');
  if (!overlay) return;

  const gate = el('exportGate');
  const panel = el('exportPanel');
  const pass = el('exportPass');
  const error = el('exportError');

  // pokazde se zacina znovu od hesla, at ho nekdo neobejde otevrenim podruhe
  gate.hidden = false;
  panel.hidden = true;
  error.hidden = true;
  pass.value = '';
  overlay.hidden = false;
  el('exportDialog')?.focus();

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('click', onClick);
    gate.removeEventListener('submit', onSubmit);
    pass.removeEventListener('input', onInput);
    overlay.hidden = true;
    el('exportQr').innerHTML = '';
    pass.value = '';
    closeExport = null;
  };

  const odemkni = () => {
    error.hidden = true;
    gate.hidden = true;
    panel.hidden = false;
    // razitko nasazeni uplne dole, at je videt, jestli zarizeni ma novou verzi
    const verze = el('exportVersion');
    if (verze) verze.textContent = verzeText();
    renderQr(state, rewardData);
  };

  /* Potvrzovaci tlacitko tu neni - jakmile heslo sedi, dialog se odemkne sam.
     Chybu proto hlasime az pri Enteru, ne behem psani. */
  function onInput() {
    error.hidden = true;
    if (pass.value.trim() === HESLO) odemkni();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (pass.value.trim() !== HESLO) {
      error.hidden = false;
      pass.select();
      return;
    }
    odemkni();
  }

  function onClick(e) {
    if (e.target.closest('#exportCloseBtn') || !e.target.closest('#exportDialog')) return close();
    const tlacitko = MAZANI.find((m) => e.target.closest(`#${m.id}`));
    if (!tlacitko) return undefined;
    if (!confirm(tlacitko.otazka)) return undefined;
    close();
    onWipe?.(tlacitko.scope);
    return undefined;
  }

  function onKey(e) {
    // Enter uvnitr formulare patri odeslani hesla, ne zavreni okna
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  gate.addEventListener('submit', onSubmit);
  pass.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', onClick);
  closeExport = close;
  pass.focus();
}

export function dismissExport() {
  closeExport?.();
}
