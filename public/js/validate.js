/* Sdilene stavebni kameny pro validaci ulozenych dat.
 *
 * Zamerne bez DOM a bez localStorage, aby sel tentyz soubor pouzit i na
 * serveru - tam bude overovani prichozich dat povinne.
 *
 * Zavislosti: TENHLE MODUL -> stats.js / rewards.js -> storage.js -> app.js
 */

/* Cele nezaporne cislo, nebo nahradni hodnota. Desetinna cast se usekne -
 * v aplikaci se nikde necita s necelym poctem. */
export const wholeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

/* Seznam retezcu bez duplicit, orezany na `limit` poslednich polozek.
 * Cokoliv, co neni pole nebo neprojde `isValid`, se tise zahodi. */
export const textList = (value, isValid, limit) =>
  Array.isArray(value)
    ? [...new Set(value.filter((x) => typeof x === 'string' && isValid(x)))].slice(0, limit)
    : [];
