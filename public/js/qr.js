/* Generator QR kodu podle ISO/IEC 18004. Rezim BYTE, verze 1 az 40,
 * vsechny ctyri urovne opravy. Zadna knihovna, zadna zavislost.
 *
 * Tabulky nize jsou z normy a nesmi se "opravovat od oka" - test
 * tests/qr.test.mjs si vygenerovany kod zpetne precte a zkontroluje
 * Reed-Solomonovy syndromy, takze chyba v tabulce se pozna hned.
 */

/* Pocet opravnych kodovych slov na jeden blok. Index 0 se nepouziva. */
const EC_CODEWORDS_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

/* Pocet bloku, na ktere se data rozdeli. */
const EC_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

/* Dva bity urovne opravy tak, jak jdou do informace o formatu. */
const EC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const LEVELS = ['L', 'M', 'Q', 'H'];

/* Kolik modulu ve verzi zbyde na data a opravu (bez funkcnich vzoru).
   Vzorec nahrazuje ctyricetiradkovou tabulku a da se overit: verze 1 ma
   208 modulu = 26 kodovych slov, verze 40 pak 29648 = 3706. */
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const totalCodewords = (version) => Math.floor(rawDataModules(version) / 8);

function dataCodewords(version, ecLevel) {
  const blocks = EC_BLOCKS[ecLevel][version];
  return totalCodewords(version) - EC_CODEWORDS_PER_BLOCK[ecLevel][version] * blocks;
}

/* Pocet bitu na delku retezce v rezimu byte: do verze 9 osm, dal sestnact. */
const lengthBits = (version) => (version <= 9 ? 8 : 16);

/* Kolik bajtu se do dane verze a urovne jeste vejde. */
function byteCapacity(version, ecLevel) {
  return Math.floor((dataCodewords(version, ecLevel) * 8 - 4 - lengthBits(version)) / 8);
}

export function qrCapacity(ecLevel = 'L') {
  if (!LEVELS.includes(ecLevel)) throw new Error(`Neznama uroven opravy: ${ecLevel}`);
  return byteCapacity(40, ecLevel);
}

/* ---------------- Galoisovo teleso GF(256) ---------------- */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // primitivni polynom
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

/* Delitel pro dany pocet opravnych slov se pocita, netabuluje. */
function rsDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i += 1) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

/* ---------------- data a opravne kody ---------------- */

/* Rozdeli data na bloky, ke kazdemu dopocita opravu a vsechno proloz.
   Kratsi bloky maji o jedno slovo min a ve sloupci se preskakuji. */
function addEccAndInterleave(data, version, ecLevel) {
  const numBlocks = EC_BLOCKS[ecLevel][version];
  const ecLen = EC_CODEWORDS_PER_BLOCK[ecLevel][version];
  const total = totalCodewords(version);
  const shortLen = Math.floor(data.length / numBlocks);
  const numShort = numBlocks - (data.length % numBlocks);

  const divisor = rsDivisor(ecLen);
  const blocks = [];
  for (let i = 0, at = 0; i < numBlocks; i += 1) {
    const len = shortLen + (i < numShort ? 0 : 1);
    const dat = data.slice(at, at + len);
    at += len;
    blocks.push({ dat, ec: rsRemainder(dat, divisor) });
  }

  const out = new Uint8Array(total);
  let i = 0;
  for (let j = 0; j < shortLen + 1; j += 1) {
    for (const block of blocks) {
      // posledni datove slovo maji jen dlouhe bloky
      if (j < block.dat.length) out[i++] = block.dat[j];
    }
  }
  for (let j = 0; j < ecLen; j += 1) {
    for (const block of blocks) out[i++] = block.ec[j];
  }
  return out;
}

/* ---------------- vzory zarovnani a BCH ---------------- */

export function alignmentPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/* Informace o formatu: 5 bitu (uroven + maska), BCH(15,5), XOR 0x5412. */
export function formatBits(ecLevel, mask) {
  const data = (EC_FORMAT_BITS[ecLevel] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/* Informace o verzi (od verze 7): 6 bitu verze, BCH(18,6). */
export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const getBit = (value, i) => ((value >>> i) & 1) !== 0;

/* ---------------- sestaveni matice ---------------- */

const MASKS = [
  (y, x) => (x + y) % 2 === 0,
  (y) => y % 2 === 0,
  (y, x) => x % 3 === 0,
  (y, x) => (x + y) % 3 === 0,
  (y, x) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (y, x) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (y, x) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (y, x) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function makeGrid(size, value) {
  return Array.from({ length: size }, () => new Array(size).fill(value));
}

function drawFunctionPatterns(modules, isFunction, version, size) {
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  // casovaci radek a sloupec
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // tri vyhledavaci vzory i se separatory kolem
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  // zarovnavaci vzory, krome trech rohu obsazenych finderem
  const pos = alignmentPositions(version);
  for (let i = 0; i < pos.length; i += 1) {
    for (let j = 0; j < pos.length; j += 1) {
      const roh = (i === 0 && j === 0)
        || (i === 0 && j === pos.length - 1)
        || (i === pos.length - 1 && j === 0);
      if (roh) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // mista pro informaci o formatu se zatim jen rezervuji
  drawFormat(modules, isFunction, size, 0, true);
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const bit = getBit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }
}

function drawFormat(modules, isFunction, size, bits, reserveOnly = false) {
  const set = (x, y, dark) => {
    modules[y][x] = reserveOnly ? false : dark;
    isFunction[y][x] = true;
  };

  for (let i = 0; i <= 5; i += 1) set(8, i, getBit(bits, i));
  set(8, 7, getBit(bits, 6));
  set(8, 8, getBit(bits, 7));
  set(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, getBit(bits, i));

  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, getBit(bits, i));
  set(8, size - 8, true); // tmavy modul
}

function drawCodewords(modules, isFunction, size, codewords) {
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // casovaci sloupec se preskakuje
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const nahoru = ((right + 1) & 2) === 0;
        const y = nahoru ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < codewords.length * 8) {
          modules[y][x] = getBit(codewords[i >>> 3], 7 - (i & 7));
          i += 1;
        }
      }
    }
  }
}

function applyMask(modules, isFunction, size, mask) {
  const fn = MASKS[mask];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isFunction[y][x] && fn(y, x)) modules[y][x] = !modules[y][x];
    }
  }
}

/* Ctyri pravidla penalizace z normy. Vitezi maska s nejnizsim souctem. */
const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
];

function penalty(modules, size) {
  let body = 0;

  const rada = (cti) => {
    let bezi = 1;
    for (let i = 1; i < size; i += 1) {
      if (cti(i) === cti(i - 1)) {
        bezi += 1;
        if (bezi === 5) body += 3;
        else if (bezi > 5) body += 1;
      } else {
        bezi = 1;
      }
    }
  };

  for (let y = 0; y < size; y += 1) rada((x) => modules[y][x]);
  for (let x = 0; x < size; x += 1) rada((y) => modules[y][x]);

  // bloky 2x2 stejne barvy
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const a = modules[y][x];
      if (a === modules[y][x + 1] && a === modules[y + 1][x] && a === modules[y + 1][x + 1]) body += 3;
    }
  }

  // vzor pripominajici vyhledavaci znacku
  const hleda = (cti) => {
    for (let i = 0; i + 11 <= size; i += 1) {
      for (const vzor of FINDER_LIKE) {
        let sedi = true;
        for (let k = 0; k < 11 && sedi; k += 1) if (cti(i + k) !== vzor[k]) sedi = false;
        if (sedi) body += 40;
      }
    }
  };
  for (let y = 0; y < size; y += 1) hleda((x) => modules[y][x]);
  for (let x = 0; x < size; x += 1) hleda((y) => modules[y][x]);

  // pomer tmavych modulu ma byt blizko polovine
  let tmavych = 0;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (modules[y][x]) tmavych += 1;
  const celkem = size * size;
  const odchylka = Math.floor((Math.abs(tmavych * 20 - celkem * 10) + celkem - 1) / celkem);
  body += Math.max(0, odchylka - 1) * 10;

  return body;
}

/* ---------------- verejne rozhrani ---------------- */

export function qrMatrix(text, ecLevel = 'L') {
  if (!LEVELS.includes(ecLevel)) throw new Error(`Neznama uroven opravy: ${ecLevel}`);
  const bytes = new TextEncoder().encode(String(text));

  let version = 0;
  for (let v = 1; v <= 40; v += 1) {
    if (bytes.length <= byteCapacity(v, ecLevel)) { version = v; break; }
  }
  if (!version) {
    throw new Error(`Data se do QR kodu nevejdou: ${bytes.length} bajtu, nejvic ${qrCapacity(ecLevel)}`);
  }

  // bitovy proud: rezim, delka, data, terminator, doplneni
  const bits = [];
  const push = (value, count) => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, lengthBits(version));
  for (const b of bytes) push(b, 8);

  const kapacitaBitu = dataCodewords(version, ecLevel) * 8;
  push(0, Math.min(4, kapacitaBitu - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let i = 0; bits.length < kapacitaBitu; i += 1) push(i % 2 === 0 ? 0xec : 0x11, 8);

  const data = new Uint8Array(bits.length / 8);
  bits.forEach((bit, i) => { data[i >>> 3] |= bit << (7 - (i & 7)); });

  const codewords = addEccAndInterleave(data, version, ecLevel);

  const size = version * 4 + 17;
  const modules = makeGrid(size, false);
  const isFunction = makeGrid(size, false);
  drawFunctionPatterns(modules, isFunction, version, size);
  drawCodewords(modules, isFunction, size, codewords);

  // vyzkousi se vsech osm masek a zustane ta s nejnizsi penalizaci
  let nejlepsi = 0;
  let nejnizsi = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(modules, isFunction, size, mask);
    drawFormat(modules, isFunction, size, formatBits(ecLevel, mask));
    const body = penalty(modules, size);
    if (body < nejnizsi) { nejnizsi = body; nejlepsi = mask; }
    applyMask(modules, isFunction, size, mask); // XOR podruhe masku sundava
  }
  applyMask(modules, isFunction, size, nejlepsi);
  drawFormat(modules, isFunction, size, formatBits(ecLevel, nejlepsi));

  modules.version = version;
  modules.mask = nejlepsi;
  modules.ecLevel = ecLevel;
  return modules;
}

export function qrSvg(matrix, { size = 256, quiet = 4, dark = '#000', light = '#fff' } = {}) {
  const n = matrix.length;
  const celkem = n + quiet * 2;
  const dily = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (matrix[y][x]) dily.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${celkem} ${celkem}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR kód s přenosem postupu">`
    + `<rect width="${celkem}" height="${celkem}" fill="${light}"/>`
    + `<path d="${dily.join('')}" fill="${dark}"/>`
    + '</svg>';
}
