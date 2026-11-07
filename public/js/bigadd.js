import { rnd } from './random.js';

/* ============================================================
   Velké sčítání (a odčítání) do 100

   Dvojciferné číslo se zpaměti nesčítá najednou. Ve škole se druhé číslo
   rozloží na desítky a jednotky a jde se po krocích - nejdřív desítky,
   pak jednotky:

          47  +  25
                 ╱ ╲
              [20]  [5]           větvička: rozklad druhého čísla
                ▮▮   ▪▪▪▪▪        kostičky jako nápověda (jen lehká)

       47 + 20 + 5 =                 zápis po krocích (jako na Umíme to)
       [67] + 5 = [72]

   Desítky jsou všude modré, jednotky oranžové - větev, kostičky i zápis.
   U odčítání je to stejné, jen se skáče dolů (72 − 25: 72 → 52 → 47).

   Doplňují se vždycky tatáž čtyři políčka (`BIGADD_FIELDS`), jejich
   pořadí je zároveň pořadím hodnot v odpovědi.

   OBTÍŽNOST: lehká bez přechodu přes desítku (42 + 35), střední s přechodem
   (47 + 25), těžká s přechodem a bez kostiček. Jak velká čísla vyjdou,
   řídí rozsah - ale hra je na čísla do 100, takže víc než 100 se nepočítá
   a pod `BIGADD_MIN_MAX` se počítá do 100. V nastavení jsou jen chipy
   do 50 a do 100 (`BIGADD_MAX_PRESETS` v app.js).
   ============================================================ */

export const BIGADD_FIELDS = ['tens', 'ones', 'mid', 'c'];

/* `carry`: true = vždy přes desítku, false = nikdy, null = napůl.
   Lehká jde krok po kroku s výběrem ze dvou možností (podle cvičení
   „Sčítání dvojciferných čísel s rozkladem“ na umimematiku.cz) a ovládá ji
   ovladač velkého násobení - `ex.kind = 'bigaddstep'`. */
export const BIGADD_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'rozklad je nakreslený, počítáš nejdřív desítky a pak jednotky, vybíráš ze dvou možností', carry: null, steps: true },
  medium: { label: 'Střední', emoji: '🟡', note: 'rozklad a výpočet po krocích, píšeš sama', carry: null },
  hard: { label: 'Těžká', emoji: '🔴', note: 'vždycky přes desítku', carry: true },
};
export const BIGADD_LEVEL_KEYS = Object.keys(BIGADD_LEVELS);

/* Obě čísla jsou dvojciferná a druhé má desítky i jednotky - jinak by
   nebylo co rozkládat. Nejmenší příklad s přechodem je 11 + 19 = 30, ale
   do 30 by jich vyšlo jen pár a pořád by se opakovaly. */
export const BIGADD_MIN_MAX = 40;
export const BIGADD_TOP = 100;

export const bigaddMax = (max) => (max < BIGADD_MIN_MAX ? BIGADD_TOP : Math.min(max, BIGADD_TOP));

/* Rozsahy pod `BIGADD_MIN_MAX` se v nastavení nenabízejí (chipy jsou jen
   do 50 a do 100) a zapnutý je rovnou chip „do 100“ - hláška o malém
   rozsahu by jen mátla, uživatel ji odmítl. */
export function bigaddRangeNote(max) {
  if (max > BIGADD_TOP) return `Velké sčítání je na čísla do ${BIGADD_TOP}, víc se tu nepočítá.`;
  return null;
}

/* Sčítání: `a + b`, kde b = t desítek + o jednotek. Přechod přes desítku
   nastane u jednotek: a % 10 + o ≥ 10. */
function rollAdd(hi, carry) {
  for (let i = 0; i < 500; i++) {
    const t = rnd(1, 8);
    const o = rnd(1, 9);
    const b = 10 * t + o;
    if (hi - b < 11) continue;
    const a = rnd(11, Math.min(99, hi - b));
    const u = a % 10;
    if (u === 0) continue;
    if ((u + o >= 10) !== carry) continue;
    return { a, t, o };
  }
  return carry ? { a: 27, t: 1, o: 5 } : { a: 23, t: 1, o: 4 };
}

/* Odčítání: `a − b`. Přes desítku se jde, když jednotek prvního čísla je
   míň než jednotek druhého. Výsledek musí být aspoň 1. */
function rollSub(hi, carry) {
  for (let i = 0; i < 500; i++) {
    const a = rnd(22, Math.min(99, hi));
    const t = rnd(1, Math.floor(a / 10) - 1);
    const o = rnd(1, 9);
    const b = 10 * t + o;
    if (a - b < 1 || a % 10 === 0) continue;
    if ((a % 10 < o) !== carry) continue;
    return { a, t, o };
  }
  return carry ? { a: 42, t: 1, o: 5 } : { a: 48, t: 1, o: 5 };
}

export function makeBigadd(max, levelKey = 'easy', op = 'add') {
  const level = BIGADD_LEVELS[levelKey] ? levelKey : 'easy';
  const { steps = false } = BIGADD_LEVELS[level];
  const carry = BIGADD_LEVELS[level].carry ?? Math.random() < 0.5;
  const sub = op === 'sub';
  const { a, t, o } = (sub ? rollSub : rollAdd)(bigaddMax(max), carry);
  const tens = 10 * t;
  const b = tens + o;
  const mid = sub ? a - tens : a + tens;
  const c = sub ? mid - o : mid + o;
  const parts = { tens, ones: o, mid, c };
  const ex = {
    a, b, c, tens, ones: o, mid, level, carry, op: sub ? 'sub' : 'add',
    hidden: BIGADD_FIELDS.slice(),
    values: BIGADD_FIELDS.map((f) => parts[f]),
    // znaménko patří do klíče, jinak by 47 + 25 a 47 − 25 byl tentýž příklad
    key: `${a}${sub ? '-' : '+'}${b}|${level}`,
  };
  if (steps) {
    ex.task = `${a} ${sub ? '−' : '+'} ${b}`;
    ex.steps = bigaddSteps(ex);
  }
  return ex;
}

/* Lehká úroveň: rozklad druhého čísla je hotový (větvička pod ním a barvy
   kreslí app.js) a dítě jde třemi kroky, v každém dvě možnosti
   (88 − 34): „Z 88 si 8 schováme a počítáme jen desítky: 80 − 30 =",
   „Schovanou 8 přidáme zpátky: 50 + 8 =", „Ještě zbývá odečíst jednotky: 58 − 4 =".
   Podle uživatele (7. 11. 2026); krok „Rozdělíme 23 na: 20 a 3 / 2 a 3"
   tu byl a na lehkou úroveň byl nejasný.
   Špatná možnost je typická chyba (o desítku vedle, zapomenuté schované
   jednotky, o jedničku vedle).
   Pořadí tlačítek se losuje tady, ne při vykreslení - zápis se po každém
   kroku překresluje celý (stejně jako u velkého násobení). */
function bigaddSteps({ a, c, tens, ones, mid, op }) {
  const sub = op === 'sub';
  const s = sub ? '−' : '+';
  const kept = a % 10;          // první číslo nikdy nekončí nulou
  const round10 = a - kept;
  const tensOnly = sub ? round10 - tens : round10 + tens;
  // o desítku vedle; záporné ani přes 100 nesmí být ani špatné číslo
  let wrongTens = sub ? tensOnly + 10 : tensOnly - 10;
  if (wrongTens <= 0 || wrongTens > 100) wrongTens = sub ? tensOnly - 10 : tensOnly + 10;
  let wrongC = c - 1;
  if (wrongC <= 0) wrongC = c + 1;
  /* `expr` (nepovinný) je příklad, který se v hotovém kroku vypíše před
     zelený výsledek („53 − 40 = 13“); popisek nad ním je pak jen začátek věty. */
  const step = (label, correct, wrong, tag, expr) => ({
    label, expr, correct, wrong, tag, options: Math.random() < 0.5 ? [correct, wrong] : [wrong, correct],
  });
  return [
    step(`Z ${a} si ${kept} schováme a ${sub ? 'odečteme' : 'sečteme'} jen desítky:`, String(tensOnly), String(wrongTens), 'bigaddTens', `${round10} ${s} ${tens} =`),
    // zapomenuté schované jednotky: zůstane jen výsledek desítek
    step(`Schovanou ${kept} přidáme zpátky:`, String(mid), String(tensOnly), 'bigaddTens', `${tensOnly} + ${kept} =`),
    step(`Ještě zbývá ${sub ? 'odečíst' : 'přičíst'} jednotky:`, String(c), String(wrongC), 'bigaddOnes', `${mid} ${s} ${ones} =`),
  ];
}

/* Vysvětlení po chybě. Přechod přes desítku v posledním kroku se rozepíše
   zvlášť - je to přesně to, co dítě umí z hry „Počítej přes 10“. */
export function bigaddExplain(ex) {
  const { a, b, c, tens, ones, mid } = ex;
  const sub = ex.op === 'sub';
  const s = sub ? '−' : '+';
  const steps = [
    `Druhé číslo rozlož na desítky a jednotky: ${b} = **${tens}** + **${ones}**.`,
    `Nejdřív ${sub ? 'uber' : 'přičti'} desítky: ${a} ${s} ${tens} = **${mid}**.`,
    `Pak ${sub ? 'uber' : 'přičti'} jednotky: ${mid} ${s} ${ones} = **${c}**.`,
  ];
  if (ex.carry) {
    if (sub) {
      const k = mid % 10;
      const ten = mid - k;
      steps.push(`Přes desítku po kouscích: ${mid} − ${k} = ${ten}, a pak ${ten} − ${ones - k} = ${c}.`);
    } else {
      const k = 10 - (mid % 10);
      const ten = mid + k;
      // 47 + 23: jednotky dají přesně desítku, druhý kousek by byl „+ 0“
      steps.push(ones === k
        ? `Jednotky doplní přesně do desítky: ${mid} + ${ones} = ${c}.`
        : `Přes desítku po kouscích: ${mid} + ${k} = ${ten}, a pak ${ten} + ${ones - k} = ${c}.`);
    }
  }
  return steps;
}

export function bigaddText(ex, reveal) {
  const sign = ex.op === 'sub' ? '−' : '+';
  return `${ex.a} ${sign} ${ex.b}${reveal ? ` = ${ex.c}` : ''}`;
}

/* Tag chyby podle prvního špatného kroku: rozklad, desítky, nebo jednotky. */
export function bigaddTag(ex, given) {
  const vals = String(given).split(', ').map(Number);
  if (vals[0] !== ex.tens || vals[1] !== ex.ones) return 'bigaddSplit';
  if (vals[2] !== ex.mid) return 'bigaddTens';
  return 'bigaddOnes';
}
