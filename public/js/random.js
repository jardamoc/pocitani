/* Drobní pomocníci na náhodu. Používá je generátor příkladů i generátor
   hádanek, proto sedí zvlášť - ať je nemá každý modul svoje. */

export const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export const pick = (arr) => arr[rnd(0, arr.length - 1)];

export const chance = (p) => Math.random() < p;

export function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* Souvislá řada čísel včetně obou konců: range(1, 4) → [1, 2, 3, 4] */
export const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
