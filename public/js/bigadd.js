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

   OBTÍŽNOST: lehká, střední a těžká mají druhé číslo jednociferné (83 + 9),
   „Dvojciferná“ obě dvojciferná (47 + 25), viz `BIGADD_LEVELS`. Jak velká čísla vyjdou,
   řídí rozsah - ale hra je na čísla do 100, takže víc než 100 se nepočítá
   a pod `BIGADD_MIN_MAX` se počítá do 100. V nastavení jsou jen chipy
   do 50 a do 100 (`BIGADD_MAX_PRESETS` v app.js).
   ============================================================ */

export const BIGADD_FIELDS = ['tens', 'ones', 'mid', 'c'];

/* Čtyři obtížnosti (přání uživatele 19. 11. 2026, chip „přes 10“ tu byl
   jeden den a zrušil se). `small` = druhé číslo jednociferné, `carry` =
   přes desítku (true vždy, false nikdy, null napůl).
   Čtvrtá úroveň má klíč `expert` - ostatní hry ho nemají, `normalizeConfig()`
   / `fitLevel()` v app.js ho jinde srazí na `hard`.
   Lehká jde krok po kroku s výběrem ze dvou možností a ovládá ji ovladač
   velkého násobení - `ex.kind = 'bigaddstep'`. */
export const BIGADD_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'druhé číslo jednociferné, rozklad je nakreslený, vybíráš ze dvou možností', small: true, steps: true, carry: null },
  medium: { label: 'Střední', emoji: '🟡', note: 'druhé číslo jednociferné, bez přechodu přes 10 (81 + 7)', small: true, carry: false },
  hard: { label: 'Těžká', emoji: '🔴', note: 'druhé číslo jednociferné, přes 10 (83 + 9)', small: true, carry: true },
  expert: { label: 'Dvojciferná', emoji: '🟣', note: 'obě čísla dvojciferná, vždycky přes 10 (47 + 25)', carry: true },
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

/* Druhé číslo jednociferné (lehká a střední). Jednotky prvního čísla nejsou
   nikdy nula. Bez přechodu: 81 + 7, 76 − 4 (u odčítání zbydou jednotky
   aspoň 1, „70 + 0“ by bylo zbytečné). S přechodem: 83 + 9, 73 − 8 - a vždycky
   opravdu přes desítku, ne přesně na ni (83 + 7), jinak by zbytek byl 0. */
function rollSmall(hi, carry, sub) {
  for (let i = 0; i < 500; i++) {
    const a = rnd(sub ? 21 : 11, Math.min(99, sub ? hi : hi - 2));
    const u = a % 10;
    const b = rnd(2, 9);
    if (u === 0) continue;
    if (sub) {
      if (carry ? b <= u : b >= u) continue;
    } else {
      if (a + b > hi) continue;
      if (carry ? u + b <= 10 : u + b > 9) continue;
    }
    return { a, b };
  }
  if (sub) return carry ? { a: 73, b: 8 } : { a: 76, b: 4 };
  return carry ? { a: 37, b: 5 } : { a: 32, b: 5 };
}

/* `form` říká, jak se příklad rozkládá - podle toho se kreslí větvička
   i zápis pod ní (stejný obrázek, jen jiná čísla):
     tens   47 + 25: 25 = 20 + 5,  [47 + 20] + 5,   [67] + 5 = 72   (těžká)
     ten    83 + 9:   9 =  7 + 2,  [83 + 7] + 2,    [90] + 2 = 92   (s přechodem)
     units  81 + 7:  81 = 80 + 1,  80 + [1 + 7],    80 + [8] = 88   (bez přechodu)
   Políčka se pořád jmenují `tens` / `ones` (levý / pravý díl větvičky),
   `mid` je výsledek rámečku a `c` výsledek. U `units` je větvička pod
   prvním číslem - druhé jednociferné nemá co rozložit. */
export function makeBigadd(max, levelKey = 'easy', op = 'add') {
  const level = BIGADD_LEVELS[levelKey] ? levelKey : 'easy';
  const { steps = false, small = false } = BIGADD_LEVELS[level];
  const carry = BIGADD_LEVELS[level].carry ?? Math.random() < 0.5;
  const sub = op === 'sub';
  const hi = bigaddMax(max);
  let a; let b; let tens; let o; let mid; let form;
  if (small) {
    ({ a, b } = rollSmall(hi, carry, sub));
    const u = a % 10;
    if (carry) {
      form = 'ten';
      tens = sub ? u : 10 - u;      // kolik chybí do desítky (nebo nad ní)
      o = b - tens;
      mid = sub ? a - tens : a + tens;
    } else {
      form = 'units';
      tens = a - u;
      o = u;
      mid = sub ? u - b : u + b;
    }
  } else {
    form = 'tens';
    const r = (sub ? rollSub : rollAdd)(hi, carry);
    a = r.a;
    tens = 10 * r.t;
    o = r.o;
    b = tens + o;
    mid = sub ? a - tens : a + tens;
  }
  const c = sub ? a - b : a + b;
  const parts = { tens, ones: o, mid, c };
  const ex = {
    a, b, c, tens, ones: o, mid, level, carry, form, op: sub ? 'sub' : 'add',
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
function bigaddSteps(ex) {
  const { a, b, c, tens, ones, mid, op, form } = ex;
  const sub = op === 'sub';
  const s = sub ? '−' : '+';
  /* `expr` (nepovinný) je příklad, který se v hotovém kroku vypíše před
     zelený výsledek („53 − 40 = 13“); popisek nad ním je pak jen začátek věty. */
  const step = (label, correct, wrong, tag, expr) => ({
    label, expr, correct: String(correct), wrong: String(wrong), tag,
    options: Math.random() < 0.5 ? [String(correct), String(wrong)] : [String(wrong), String(correct)],
  });
  /* 83 + 9: „Doplníme do celé desítky: 83 + 7 =" (90 / 80 - zapomenutá
     desítka), „Ještě zbývá přičíst: 90 + 2 =" (92 / 91). */
  if (form === 'ten') {
    return [
      step(sub ? 'Ubereme do celé desítky:' : 'Doplníme do celé desítky:', mid, mid - 10, 'bigaddTens', `${a} ${s} ${tens} =`),
      step(`Ještě zbývá ${sub ? 'odečíst' : 'přičíst'}:`, c, c - 1, 'bigaddOnes', `${mid} ${s} ${ones} =`),
    ];
  }
  /* 81 + 7: „Z 81 si 80 schováme a sečteme jen jednotky: 1 + 7 =" (8 / 9),
     „Teď přidáme zpátky 80: 80 + 8 =" (88 / 78 - zapomenuté desítky).
     U odčítání je špatná možnost sečtené jednotky (6 − 4 → 10). */
  if (form === 'units') {
    const wrongMid = sub ? ones + b : (mid < 9 ? mid + 1 : mid - 1);
    return [
      step(`Z ${a} si ${tens} schováme a ${sub ? 'odečteme' : 'sečteme'} jen jednotky:`, mid, wrongMid, 'bigaddOnes', `${ones} ${s} ${b} =`),
      step(`Teď přidáme zpátky ${tens}:`, c, c - 10, 'bigaddTens', `${tens} + ${mid} =`),
    ];
  }
  const kept = a % 10;          // první číslo nikdy nekončí nulou
  const round10 = a - kept;
  const tensOnly = sub ? round10 - tens : round10 + tens;
  // o desítku vedle; záporné ani přes 100 nesmí být ani špatné číslo
  let wrongTens = sub ? tensOnly + 10 : tensOnly - 10;
  if (wrongTens <= 0 || wrongTens > 100) wrongTens = sub ? tensOnly - 10 : tensOnly + 10;
  let wrongC = c - 1;
  if (wrongC <= 0) wrongC = c + 1;
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
  if (ex.form === 'ten') {
    return [
      `Druhé číslo rozlož tak, abys ${sub ? 'ubrala' : 'doplnila'} do celé desítky: ${b} = **${tens}** + **${ones}**.`,
      `Nejdřív ${sub ? 'uber' : 'doplň'} do desítky: ${a} ${s} ${tens} = **${mid}**.`,
      `Pak ${sub ? 'uber' : 'přičti'} zbytek: ${mid} ${s} ${ones} = **${c}**.`,
    ];
  }
  if (ex.form === 'units') {
    return [
      `První číslo rozlož na desítky a jednotky: ${a} = **${tens}** + **${ones}**.`,
      `Nejdřív spočítej jednotky: ${ones} ${s} ${b} = **${mid}**.`,
      `Pak přidej zpátky desítky: ${tens} + ${mid} = **${c}**.`,
    ];
  }
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
