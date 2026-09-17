/* Razitko posledniho nasazeni. Soubor PREPISUJE `publish.mjs` pred kazdym
 * nasazenim - rucne se needituje. `poradi` je pocet nasazeni v ramci toho
 * dne, takze dve vydani za den jdou od sebe rozeznat.
 *
 * Zavislosti: cista data, nic neimportuje -> export-ui.js
 */

export const VERZE = { datum: '2026-09-17', poradi: 6 };

/* "2026-09-17" -> "17. 9. 2026". Bez Intl, at je to jiste ceske i na
   zarizeni nastavenem na jiny jazyk. */
export function verzeText() {
  const [rok, mesic, den] = String(VERZE.datum).split('-').map(Number);
  if (!rok || !mesic || !den) return '';
  const datum = `${den}. ${mesic}. ${rok}`;
  return VERZE.poradi > 1
    ? `Poslední aktualizace: ${datum} (${VERZE.poradi}. vydání toho dne)`
    : `Poslední aktualizace: ${datum}`;
}
