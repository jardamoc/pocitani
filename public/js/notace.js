/* ============================================================
   Kreslení not - čisté funkce, které vracejí SVG jako text.
   Žádná knihovna ani písmo s notami: linky, hlavičky, nožičky, pomlky
   i klíče jsou obyčejné tvary SVG.

   Souřadnice: mezera mezi linkami je 10, osnova je vysoká 40. Krok `step`
   se počítá od spodní linky (0), každý krok je 5 (linka → mezera → linka).
   Barva je všude `currentColor`, takže ji nese CSS (`color: var(--ink)`)
   a funguje i v tmavém režimu a v tématu Hudba.

   Velká osnova (těžká úroveň) má houslovou nahoře a basovou dole.
   ============================================================ */

const PAD = 34;        // místo nad osnovou na pomocné linky a nožičky
const GAP = 44;        // mezera mezi houslovou a basovou osnovou
const STAFF_H = 40;
const CLEF_W = 34;

const topOf = (i) => PAD + i * (STAFF_H + GAP);
const yOf = (i, step) => topOf(i) + STAFF_H - step * 5;
const heightOf = (n) => PAD * 2 + n * STAFF_H + (n - 1) * GAP;
const r1 = (n) => Math.round(n * 10) / 10;

function lines(i, x1, x2, cls = '') {
  let out = '';
  for (let k = 0; k < 5; k++) {
    const y = topOf(i) + k * 10;
    out += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"${cls ? ` class="${cls}"` : ''}/>`;
  }
  return `<g class="hd-lines" stroke="currentColor" stroke-width="1.2">${out}</g>`;
}

/* Houslový klíč jako tah perem: ocásek s kuličkou dole, rovná páteř
   nahoru, smyčka přes horní okraj a šnek kolem druhé linky (g). */
function trebleClef(i, x) {
  const t = topOf(i);
  const p = (dx, dy) => `${r1(x + dx)} ${r1(t + dy)}`;
  const d = `M${p(7, 47)} C${p(9, 53)} ${p(15, 52)} ${p(14, 44)} L${p(12.5, -7)} `
    + `C${p(12, -15)} ${p(21, -14)} ${p(19, -4)} C${p(17.5, 6)} ${p(3, 11)} ${p(3, 25)} `
    + `C${p(3, 37)} ${p(22, 38)} ${p(21.5, 27.5)} C${p(21, 19)} ${p(9, 20)} ${p(10, 28.5)} `
    + `C${p(10.5, 32.5)} ${p(15.5, 32.5)} ${p(15.5, 29)}`;
  return `<g class="hd-clef"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<circle cx="${r1(x + 7.5)}" cy="${r1(t + 46)}" r="3" fill="currentColor"/></g>`;
}

/* Basový klíč: tečka na čtvrté lince, oblouk dolů a dvě tečky kolem
   čtvrté linky (f). */
function bassClef(i, x) {
  const t = topOf(i);
  const p = (dx, dy) => `${r1(x + dx)} ${r1(t + dy)}`;
  const d = `M${p(4, 10)} C${p(3, 0)} ${p(20, -1)} ${p(21, 10)} C${p(22, 22)} ${p(12, 32)} ${p(2, 38)}`;
  return `<g class="hd-clef"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`
    + `<circle cx="${r1(x + 5)}" cy="${r1(t + 10)}" r="3.6" fill="currentColor"/>`
    + `<circle cx="${r1(x + 27)}" cy="${r1(t + 5)}" r="2.2" fill="currentColor"/>`
    + `<circle cx="${r1(x + 27)}" cy="${r1(t + 15)}" r="2.2" fill="currentColor"/></g>`;
}

const clefSVG = (clef, i, x) => (clef === 'bass' ? bassClef(i, x) : trebleClef(i, x));

function meterSVG(meter, i, x) {
  const t = topOf(i);
  const txt = (y) => `<text x="${x}" y="${t + y}" text-anchor="middle" dominant-baseline="central" font-size="21" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="currentColor">`;
  return `<g class="hd-meter">${txt(10)}${meter}</text>${txt(30)}4</text></g>`;
}

/* Pomocné linky pro notu mimo osnovu. */
function ledgers(i, x, step) {
  let out = '';
  if (step <= -2) for (let s = -2; s >= step; s -= 2) out += `<line x1="${x - 10}" y1="${yOf(i, s)}" x2="${x + 10}" y2="${yOf(i, s)}"/>`;
  if (step >= 10) for (let s = 10; s <= step; s += 2) out += `<line x1="${x - 10}" y1="${yOf(i, s)}" x2="${x + 10}" y2="${yOf(i, s)}"/>`;
  return out ? `<g stroke="currentColor" stroke-width="1.4">${out}</g>` : '';
}

function head(x, y, filled) {
  return filled
    ? `<ellipse cx="${x}" cy="${y}" rx="6" ry="4.3" transform="rotate(-20 ${x} ${y})" fill="currentColor"/>`
    : `<ellipse cx="${x}" cy="${y}" rx="5.6" ry="3.8" transform="rotate(-20 ${x} ${y})" fill="none" stroke="currentColor" stroke-width="2"/>`;
}

/* Křížek a béčko před notou. Béčko sedí bříškem na místě noty. */
function accidentalSVG(acc, x, y) {
  if (acc === 1) {
    return `<g class="hd-acc" stroke="currentColor" stroke-linecap="round">`
      + `<line x1="${x - 2.2}" y1="${y - 11}" x2="${x - 2.2}" y2="${y + 12}" stroke-width="1.3"/>`
      + `<line x1="${x + 2.2}" y1="${y - 12}" x2="${x + 2.2}" y2="${y + 11}" stroke-width="1.3"/>`
      + `<line x1="${x - 5}" y1="${y - 2}" x2="${x + 5}" y2="${y - 5}" stroke-width="3"/>`
      + `<line x1="${x - 5}" y1="${y + 5}" x2="${x + 5}" y2="${y + 2}" stroke-width="3"/></g>`;
  }
  return `<g class="hd-acc" stroke="currentColor" fill="none" stroke-linecap="round">`
    + `<line x1="${x - 3}" y1="${y - 17}" x2="${x - 3}" y2="${y + 4}" stroke-width="1.5"/>`
    + `<path d="M${x - 3} ${y + 4} C${x + 6} ${y - 1} ${x + 5} ${y - 8} ${x - 3} ${y - 3}" stroke-width="2.2"/></g>`;
}

/* Jedna nota. Nožička nahoru pod prostřední linkou, dolů od ní výš. */
export function noteSVG(value, i, x, step, cls = '', acc = 0) {
  const y = yOf(i, step);
  const up = step < 4;
  let out = ledgers(i, x, step) + (acc ? accidentalSVG(acc, x - 17, y) : '');
  if (value === 'whole') {
    out += `<ellipse cx="${x}" cy="${y}" rx="7.2" ry="4.6" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-25 ${x} ${y})"/>`;
  } else {
    out += head(x, y, value !== 'half');
    const sx = up ? x + 5.4 : x - 5.4;
    const sy = up ? y - 34 : y + 34;
    out += `<line x1="${sx}" y1="${y}" x2="${sx}" y2="${sy}" stroke="currentColor" stroke-width="1.6"/>`;
    if (value === 'eighth') {
      const dir = up ? 1 : -1;
      out += `<path d="M${sx} ${sy} C${sx + 1} ${sy + 8 * dir} ${sx + 10} ${sy + 11 * dir} ${sx + 7} ${sy + 22 * dir}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }
  return `<g class="hd-note${cls ? ` ${cls}` : ''}">${out}</g>`;
}

/* Dvojice osminových not spojená trámcem - v taktu je to jedna doba. */
function eighthPair(i, x1, x2, step) {
  const y = yOf(i, step);
  const up = step < 4;
  const off = up ? 5.4 : -5.4;
  const by = up ? y - 32 : y + 32;
  const beamY = up ? by : by - 5;
  return `<g class="hd-note">${ledgers(i, x1, step)}${ledgers(i, x2, step)}${head(x1, y, true)}${head(x2, y, true)}`
    + `<line x1="${x1 + off}" y1="${y}" x2="${x1 + off}" y2="${by}" stroke="currentColor" stroke-width="1.6"/>`
    + `<line x1="${x2 + off}" y1="${y}" x2="${x2 + off}" y2="${by}" stroke="currentColor" stroke-width="1.6"/>`
    + `<rect x="${x1 + off - 0.8}" y="${beamY}" width="${x2 - x1 + 1.6}" height="5" fill="currentColor"/></g>`;
}

/* Pomlky mají pevné místo na osnově - celá visí pod čtvrtou linkou,
   půlová sedí na prostřední. Podle toho se od sebe poznají. */
export function restSVG(value, i, x) {
  if (value === 'whole') return `<rect class="hd-rest" x="${x - 6}" y="${yOf(i, 6)}" width="12" height="5" fill="currentColor"/>`;
  if (value === 'half') return `<rect class="hd-rest" x="${x - 6}" y="${yOf(i, 4) - 5}" width="12" height="5" fill="currentColor"/>`;
  if (value === 'quarter') {
    const y0 = yOf(i, 7);
    return `<path class="hd-rest" d="M${x - 3} ${y0} L${x + 3} ${y0 + 8} L${x - 2} ${y0 + 15} L${x + 3} ${y0 + 22} C${x - 4} ${y0 + 19} ${x - 5} ${y0 + 26} ${x - 1} ${y0 + 30}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const y = yOf(i, 5);
  return `<g class="hd-rest"><circle cx="${x - 3}" cy="${y}" r="2.4" fill="currentColor"/>`
    + `<path d="M${x - 3} ${y + 1.5} C${x} ${y + 4} ${x + 3} ${y + 2} ${x + 4} ${y - 1} L${x - 1} ${yOf(i, 1)}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></g>`;
}

const svgOpen = (w, h, cls, y0 = 0) => `<svg class="hd-svg ${cls}" viewBox="0 ${y0} ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`;

/* ---------------- složené obrázky ---------------- */

/* Značka z úlohy „Co je to?“ na kousku osnovy. U samotné osnovy jsou
   linky výrazné, jinak jen jemně, aby bylo jasné, co je na obrázku. */
export function symbolSVG(sym) {
  const w = 80;
  const h = 78;
  if (sym === 'staff') return `${svgOpen(w, h, 'hd-sym', 14)}${lines(0, 4, w - 4)}</svg>`;
  let body;
  if (sym === 'treble' || sym === 'bass') body = clefSVG(sym, 0, 26);
  else if (sym.startsWith('n:')) body = noteSVG(sym.slice(2), 0, 40, sym === 'n:whole' ? 3 : 2);
  else body = restSVG(sym.slice(2), 0, 40);
  return `${svgOpen(w, h, 'hd-sym', 14)}<g class="hd-faint">${lines(0, 4, w - 4)}</g>${body}</svg>`;
}

/* Osnova (jedna nebo velká) s klíči a s notami. `notes` je pole
   `{ staff, step, value, cls, hit }`; s `hit` se kolem noty udělá
   klepací plocha s třídou `vt-opt` a `data-i`. */
export function staffSVG({ staves, notes = [], slots = null, width = 0 }) {
  const n = staves.length;
  const w = width || Math.max(130, CLEF_W + 30 + notes.length * 44);
  const h = heightOf(n);
  let out = svgOpen(w, h, n > 1 ? 'hd-staff hd-grand' : 'hd-staff');
  staves.forEach((clef, i) => {
    out += lines(i, 2, w - 2) + clefSVG(clef, i, 6);
  });
  if (n > 1) out += `<line x1="2" y1="${topOf(0)}" x2="2" y2="${topOf(1) + STAFF_H}" stroke="currentColor" stroke-width="1.6"/>`;

  if (slots) out += slotsSVG(staves, slots, w);

  const span = (w - CLEF_W - 20) / Math.max(1, notes.length);
  notes.forEach((nt, k) => {
    const i = staves.indexOf(nt.staff);
    const x = nt.x ?? r1(CLEF_W + 10 + span * (k + 0.5));
    const note = noteSVG(nt.value || 'whole', i, x, nt.step, nt.cls || '', nt.acc || 0);
    if (nt.hit === undefined) {
      out += note;
    } else {
      const label = nt.label ? `<text x="${x}" y="${h - 8}" text-anchor="middle" font-size="12" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="currentColor">${nt.label}</text>` : '';
      out += `<g class="vt-opt hd-hit${nt.cls ? ` ${nt.cls}` : ''}" data-i="${nt.hit}"><rect x="${r1(x - span / 2 + 3)}" y="4" width="${r1(span - 6)}" height="${h - 8}" rx="8" class="hd-hit-bg"/>${note}${label}</g>`;
    }
  });
  return `${out}</svg>`;
}

/* Klepací pruhy pro „Umísti notu“: jeden na každou linku a mezeru,
   těsně na sebe, takže klepnutí kamkoli padne na nejbližší místo.
   Krajní pruhy jsou protažené, ať se dá trefit i kousek vedle. */
function slotsSVG(staves, slots, w) {
  let out = '<g class="hd-slots">';
  staves.forEach((staff, i) => {
    const mine = slots.map((s, k) => ({ ...s, k: s.i ?? k })).filter((s) => s.staff === staff);
    const lo = Math.min(...mine.map((s) => s.step));
    const hi = Math.max(...mine.map((s) => s.step));
    for (const s of mine) {
      const y = yOf(i, s.step);
      const top = s.step === hi ? y - 14 : y - 2.5;
      const bottom = s.step === lo ? y + 14 : y + 2.5;
      out += `<rect class="vt-opt hd-slot" data-i="${s.k}" x="${CLEF_W}" y="${top}" width="${w - CLEF_W - 2}" height="${bottom - top}"/>`;
    }
  });
  return `${out}</g>`;
}

/* Šířka taktu - aby šly tři takty pod sebou nakreslit stejně velké. */
export function barWidth({ meter = null, items }) {
  return CLEF_W + (meter ? 28 : 6) + items.reduce((s, it) => s + (it.k === 'n:eighth2' ? 60 : 30), 0) + 10;
}

/* Jeden takt: (klíč), (předznamenání), noty a pomlky, taktová čára.
   `gap` přidá na konec čárkované okénko pro chybějící pomlku, `fill`
   do něj nakreslí pomlku (po odpovědi). */
export function barSVG({ clef, meter = null, items, gap = false, fill = null, fillCls = '', width = 0 }) {
  const unit = 30;
  const widthOf = (k) => (k === 'n:eighth2' ? 2 * unit : unit);
  let x = CLEF_W + (meter ? 28 : 6);
  const body = [];
  for (const it of items) {
    const wdt = widthOf(it.k);
    if (it.k === 'n:eighth2') body.push(eighthPair(0, x + 14, x + 40, it.step));
    else if (it.k.startsWith('n:')) body.push(noteSVG(it.k.slice(2), 0, x + wdt / 2, it.step));
    else body.push(restSVG(it.k.slice(2), 0, x + wdt / 2));
    x += wdt;
  }
  if (gap) {
    const t = topOf(0);
    body.push(`<rect class="hd-gap${fillCls ? ` ${fillCls}` : ''}" x="${x + 2}" y="${t - 6}" width="${unit + 4}" height="${STAFF_H + 12}" rx="6"/>`);
    if (fill) body.push(`<g class="hd-gap-fill ${fillCls}">${restSVG(fill.slice(2), 0, x + 4 + unit / 2)}</g>`);
    x += unit + 6;
  }
  const w = Math.max(x + 10, width);
  const h = heightOf(1);
  let out = svgOpen(w, h, 'hd-bar') + lines(0, 2, w - 2) + clefSVG(clef, 0, 6);
  if (meter) out += meterSVG(meter, 0, CLEF_W + 14);
  out += body.join('');
  out += `<line x1="${w - 2}" y1="${topOf(0)}" x2="${w - 2}" y2="${topOf(0) + STAFF_H}" stroke="currentColor" stroke-width="1.6"/>`;
  return `${out}</svg>`;
}

/* Klávesnice jedné oktávy (c až c). Klávesy jsou klepací plochy
   s třídou `vt-opt` a `data-i` - indexy do `keys` (bílé napřed, černé
   za nimi, aby se černé kreslily navrch). `state(i)` vrací třídu po
   klepnutí, `labels` napíše na bílé klávesy písmena. */
export function pianoSVG({ keys, state = () => '', labels = false, tap = true }) {
  const opt = tap ? 'vt-opt ' : '';
  const W = 36;
  const H = 124;
  const BW = 22;
  const BH = 78;
  const whites = keys.filter((k) => k.white).length;
  let out = svgOpen(whites * W + 4, H + 4, 'hd-piano');
  keys.forEach((k, i) => {
    if (!k.white) return;
    const x = 2 + k.pos * W;
    out += `<g class="${opt}hd-key hd-white${state(i)}" data-i="${i}"><rect x="${x}" y="2" width="${W}" height="${H}" rx="4"/>`
      + (labels ? `<text x="${x + W / 2}" y="${H - 10}" text-anchor="middle" font-size="16" font-weight="800" font-family="Arial, Helvetica, sans-serif">${k.text}</text>` : '')
      + '</g>';
  });
  keys.forEach((k, i) => {
    if (k.white) return;
    const x = 2 + (k.pos + 1) * W - BW / 2;
    out += `<g class="${opt}hd-key hd-black${state(i)}" data-i="${i}"><rect x="${x}" y="2" width="${BW}" height="${BH}" rx="3"/></g>`;
  });
  return `${out}</svg>`;
}