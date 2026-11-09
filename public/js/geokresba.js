/* ============================================================
   Kreslení útvarů, těles a čar pro hru Geometrie - SVG jako text,
   bez knihovny (stejně jako notace.js). Nic neimportuje.

   Barvy nese CSS: čáry jsou `currentColor`, plochy průhledně modré
   (`.geo-f1` až `.geo-f3`), takže obrázek sedí na světlém i tmavém
   podkladu. Neviditelné hrany těles jsou čárkované, jak se kreslí ve
   škole. Konec přímky a polopřímky, který pokračuje dál, je z teček.

   Vstupem je `fig` z geometrie.js - všechny náhodné hodnoty jsou už
   v něm, kreslení samo nic nelosuje.
   ============================================================ */

const W = 120;
const H = 100;
const r1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${r1(p[0])},${r1(p[1])}`;

function svg(inner, w = W, h = H) {
  return `<svg class="geo-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/* Mnohoúhelník: body kolem nuly, otočení o `tilt` stupňů, pak se celý
   zvětší, aby se vešel do plochy (`size` = kolik plochy zabere). */
function polygon(points, tilt, size) {
  const t = (tilt * Math.PI) / 180;
  const rot = points.map(([x, y]) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]);
  const xs = rot.map((p) => p[0]);
  const ys = rot.map((p) => p[1]);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const s = Math.min((W - 16) * size / bw, (H - 12) * size / bh);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const out = rot.map(([x, y]) => [W / 2 + (x - cx) * s, H / 2 + (y - cy) * s]);
  return `<polygon class="geo-f1" points="${out.map(pt).join(' ')}"/>`;
}

const regular = (n) => Array.from({ length: n }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [Math.cos(a), Math.sin(a)];
});

const TRIANGLES = {
  eq: regular(3),
  right: [[-1, 1], [1, 1], [-1, -1]],
  any: [[-1, 1], [1.3, 1], [0.2, -1]],
};

function flat(fig) {
  const { shape, tilt = 0, size = 0.8 } = fig;
  if (shape === 'ctverec') return polygon([[-1, -1], [1, -1], [1, 1], [-1, 1]], tilt, size);
  if (shape === 'obdelnik') {
    const r = fig.ratio;
    return polygon([[-r, -1], [r, -1], [r, 1], [-r, 1]], tilt, size);
  }
  if (shape === 'trojuhelnik') return polygon(TRIANGLES[fig.kind] || TRIANGLES.eq, tilt, size);
  if (shape === 'petiuhelnik') return polygon(regular(5), tilt, size);
  if (shape === 'sestiuhelnik') return polygon(regular(6), tilt, size);
  const r = 44 * size;
  // kruh je plocha, kružnice jen čára - rozdíl musí být vidět na první pohled
  return shape === 'kruh'
    ? `<circle class="geo-f1" cx="${W / 2}" cy="${H / 2}" r="${r1(r)}"/>`
    : `<circle class="geo-line geo-thick" cx="${W / 2}" cy="${H / 2}" r="${r1(r)}"/>`;
}

/* ---------------- tělesa ----------------
   Volné rovnoběžné promítání: hloubka jde šikmo vpravo nahoru a je
   zkrácená na polovinu, jak se tělesa kreslí ve škole. */
const DEPTH = 0.5 * Math.SQRT1_2;

function box(w, h, d) {
  const dx = d * DEPTH;
  const dy = -d * DEPTH;
  const x0 = W / 2 - (w + dx) / 2;
  const y0 = H / 2 - (h + dy) / 2;
  const A = [x0, y0 + h];
  const B = [x0 + w, y0 + h];
  const C = [x0 + w, y0];
  const D = [x0, y0];
  const back = (p) => [p[0] + dx, p[1] + dy];
  const [A2, B2, C2, D2] = [A, B, C, D].map(back);
  return [
    `<polyline class="geo-hid" points="${[D2, A2, B2].map(pt).join(' ')}"/>`,
    `<line class="geo-hid" x1="${r1(A[0])}" y1="${r1(A[1])}" x2="${r1(A2[0])}" y2="${r1(A2[1])}"/>`,
    `<polygon class="geo-f2" points="${[D, C, C2, D2].map(pt).join(' ')}"/>`,
    `<polygon class="geo-f3" points="${[B, C, C2, B2].map(pt).join(' ')}"/>`,
    `<polygon class="geo-f1" points="${[A, B, C, D].map(pt).join(' ')}"/>`,
  ].join('');
}

/* Půlka elipsy zleva doprava: přední (dolní) plnou čarou, zadní čárkovaně. */
const arc = (cx, cy, rx, ry, front) =>
  `M${r1(cx - rx)},${r1(cy)} A${r1(rx)},${r1(ry)} 0 0 ${front ? 0 : 1} ${r1(cx + rx)},${r1(cy)}`;

function solid(fig) {
  const cx = W / 2;
  switch (fig.shape) {
    case 'krychle': return box(fig.a, fig.a, fig.a);
    case 'kvadr': return box(fig.w, fig.h, fig.d);
    case 'koule': {
      const r = fig.r;
      const cy = H / 2;
      const ry = r * 0.3;
      return `<circle class="geo-f1" cx="${cx}" cy="${cy}" r="${r}"/>`
        + `<path class="geo-hid" d="${arc(cx, cy, r, ry, false)}"/>`
        + `<path class="geo-line geo-thin" d="${arc(cx, cy, r, ry, true)}"/>`;
    }
    case 'valec': {
      const { h, rx } = fig;
      const ry = rx * 0.3;
      const yt = H / 2 - h / 2;
      const yb = H / 2 + h / 2;
      const xl = cx - rx;
      const xr = cx + rx;
      return `<path class="geo-f1" d="M${r1(xl)},${r1(yt)} L${r1(xl)},${r1(yb)} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(xr)},${r1(yb)} L${r1(xr)},${r1(yt)} Z"/>`
        + `<path class="geo-hid" d="${arc(cx, yb, rx, ry, false)}"/>`
        + `<ellipse class="geo-f2" cx="${cx}" cy="${r1(yt)}" rx="${r1(rx)}" ry="${r1(ry)}"/>`;
    }
    case 'kuzel': {
      const { h, rx } = fig;
      const ry = rx * 0.3;
      const yb = H / 2 + h / 2;
      const top = H / 2 - h / 2;
      return `<path class="geo-f1" d="M${cx},${r1(top)} L${r1(cx - rx)},${r1(yb)} A${r1(rx)},${r1(ry)} 0 0 0 ${r1(cx + rx)},${r1(yb)} Z"/>`
        + `<path class="geo-hid" d="${arc(cx, yb, rx, ry, false)}"/>`;
    }
    case 'jehlan': {
      const { a, h } = fig;
      const dx = a * DEPTH;
      const dy = -a * DEPTH;
      const x0 = cx - (a + dx) / 2;
      // podstava dole, špička nad jejím středem
      const yb = H / 2 + (h - dy / 2) / 2;
      const A = [x0, yb];
      const B = [x0 + a, yb];
      const A2 = [A[0] + dx, A[1] + dy];
      const B2 = [B[0] + dx, B[1] + dy];
      const V = [x0 + a / 2 + dx / 2, yb + dy / 2 - h];
      return `<polyline class="geo-hid" points="${[A, A2, B2].map(pt).join(' ')}"/>`
        + `<line class="geo-hid" x1="${r1(A2[0])}" y1="${r1(A2[1])}" x2="${r1(V[0])}" y2="${r1(V[1])}"/>`
        + `<polygon class="geo-f3" points="${[B, B2, V].map(pt).join(' ')}"/>`
        + `<polygon class="geo-f1" points="${[A, B, V].map(pt).join(' ')}"/>`;
    }
    default: return '';
  }
}

/* ---------------- čáry ----------------
   Širší obrázek. Body jsou tečky s velkým písmenem, přímka má malé p.
   Pokračování za okraj je řada teček (`.geo-tail`). */
const LW = 160;
const LH = 70;

function lineFig(fig) {
  const cx = LW / 2;
  const cy = LH / 2;
  const t = ((fig.tilt || 0) * Math.PI) / 180;
  const P = (s) => [cx + s * Math.cos(t), cy + s * Math.sin(t)];
  const seg = (a, b, cls = 'geo-line') => `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
  const dot = (p) => `<circle class="geo-dot" cx="${r1(p[0])}" cy="${r1(p[1])}" r="4"/>`;
  const label = (p, text) => `<text class="geo-label" x="${r1(p[0])}" y="${r1(p[1] - 10)}" text-anchor="middle">${text}</text>`;

  switch (fig.shape) {
    case 'bod': {
      const p = [cx, cy + 6];
      return dot(p) + label(p, 'A');
    }
    case 'usecka': {
      const a = P(-fig.len / 2);
      const b = P(fig.len / 2);
      return seg(a, b) + dot(a) + dot(b) + label(a, 'A') + label(b, 'B');
    }
    case 'primka': {
      const a = P(-46);
      const b = P(46);
      return seg(P(-78), a, 'geo-tail') + seg(a, b) + seg(b, P(78), 'geo-tail') + label(P(-30), 'p');
    }
    case 'polopr': {
      const s = fig.dir;
      const a = P(-60 * s);
      const b = P(46 * s);
      return seg(a, b) + seg(b, P(78 * s), 'geo-tail') + dot(a) + label(a, 'A');
    }
    case 'lomena': {
      const n = fig.ys.length;
      const pts = fig.ys.map((y, i) => [14 + (i * (LW - 28)) / (n - 1), y]);
      return `<polyline class="geo-line" points="${pts.map(pt).join(' ')}"/>`;
    }
    case 'kriva':
      return fig.kind
        ? '<path class="geo-line" d="M14,50 C40,0 62,70 86,34 S130,8 146,46"/>'
        : '<path class="geo-line" d="M14,30 C34,70 70,66 80,36 S120,4 146,40"/>';
    default: return '';
  }
}

export const isLine = (shape) => ['bod', 'usecka', 'primka', 'polopr', 'lomena', 'kriva'].includes(shape);

export function geoSVG(fig) {
  if (isLine(fig.shape)) return svg(lineFig(fig), LW, LH);
  const inner = ['krychle', 'kvadr', 'koule', 'valec', 'kuzel', 'jehlan'].includes(fig.shape) ? solid(fig) : flat(fig);
  return svg(inner);
}
