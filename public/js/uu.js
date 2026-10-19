import { shuffle } from './random.js';

/* ============================================================
   Doplň u, ú, ů

   Věta s mezerami, dítě klepne na mezeru a pak na u / ú / ů. Až jsou
   vyplněné všechny, potvrdí to Hotovo. Co věta, to úloha.

   Věty se NEGENERUJÍ - jsou ručně sepsané. Zápis:

       'Ve vlak[u] [u]kaž pr[ů]kazk[u].'

   V hranatých závorkách je písmeno, které dítě doplňuje (velké, když je
   na začátku věty nebo jména). `+` před mezerou říká, že slovo je složené
   z předpony a slova na ú (`ne+[ú]roda`) - do věty se nevypisuje, jen se
   z něj ve vysvětlení udělá „ne + úroda“. Ú uprostřed slova bez `+` je
   výjimka, kterou si dítě musí pamatovat (`t[ú]ra`, `sk[ú]tr`).

   Při doplňování pozor, aby šlo doplnit jen jedno písmeno: „u domu“
   i „jdu domů“ jsou obě správně, takže věta musí jasně říct které.
   Ů nikdy nestojí na začátku slova.
   ============================================================ */

export const UU_LETTERS = ['u', 'ú', 'ů'];

export const UU_COUNTS = [5, 10, 15];

export const UU_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'krátké věty, v každé jedno nebo dvě písmena' },
  medium: { label: 'Střední', emoji: '🟡', note: 'delší věty a víc písmen, i na konci slov (lvů, slonů)' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'slova jako neúroda nebo trojúhelník, jména měst a výjimky (túra)' },
};
export const UU_LEVEL_KEYS = Object.keys(UU_LEVELS);

const SENTENCES = {
  easy: [
    'V [ú]terý jdu do školy.',
    'Na stole je s[ů]l.',
    'Tatínek jde dom[ů].',
    'Náš d[ů]m je žlutý.',
    'K[ů]ň běží po louce.',
    'Na zahradě je [ú]l.',
    'Babička má r[ů]že.',
    'Máma mi dala p[ů]l jablka.',
    'Pes má velké [u]ši.',
    'Bolí mě [u]cho.',
    'Na [u]lici svítí lampy.',
    'V [ú]noru padá sníh.',
    'Dnes máme velký [ú]klid.',
    'Ve škole píšeme [ú]lohu.',
    'Na nebi je [ú]plněk.',
    'Děda má nový v[ů]z.',
    'Na stole leží n[ů]ž.',
    'Petr je m[ů]j kamarád.',
    'Máma peče b[u]chty.',
    'Mám nový k[u]fr.',
    'Dědeček má h[ů]l.',
    'Ta cesta je [ú]zká.',
    'Vypadly mi dva z[u]by.',
    'V kuchyni je st[ů]l.',
    'Na stromě rostou hr[u]šky.',
    'Po škole jdu dom[ů] psát [ú]kol.',
    'K[ů]ň má dlouhé [u]ši.',
    'V [ú]terý jdeme s babičkou dom[ů].',
    'Ema má na tváři [ú]směv.',
    'Na st[ů]l dej talíře.',
  ],
  medium: [
    'Kdo zapomněl cvičební [ú]bor?',
    'O Vánocích nás čeká velký [ú]klid.',
    'V [ú]noru jedeme do Orlických hor.',
    'Na zahradě kvetou r[ů]že a t[u]lipány.',
    'Na nebi je spousta mrak[ů].',
    'V parku roste hodně strom[ů].',
    'Na střeše sedí pět holub[ů].',
    'Na zahradě máme tři [ú]ly.',
    'Dědeček nese z lesa koš h[u]b.',
    'Pod stolem leží m[ů]j míček.',
    'Babička mi [u]pletla svetr.',
    'Naše [u]čitelka má krásný [ú]směv.',
    'Tatínek [u]vařil dobrou polévk[u].',
    'Sníh zakryl celé [ú]dolí.',
    'K[ů]ň táhne těžký v[ů]z.',
    'Hasiči přijeli k požár[u] za pár min[u]t.',
    'Kuba má [ú]zké boty.',
    'Jdeme na procházk[u] kolem rybník[u].',
    'Ondra si [u]myl r[u]ce.',
    'Po k[ů]ře stromu leze brouk.',
    'Holky skákaly přes švihadlo a kl[u]ci hráli fotbal.',
    'Malý Vašek se [u]čí psát [ú]hledně.',
    'Na saních jsme jeli z kopce dol[ů].',
    'Pták sedí na vrcholk[u] strom[u].',
    'Máme [ú]plně nové kolo.',
    'Domácí [ú]kol napiš [ú]hledně.',
    'Na dvoře běhá hodně kohout[ů] a slepic.',
    'Kluci si v [ú]terý zahrají fotbal.',
    'Máma přinesla dom[ů] dva chleby.',
    'V lese jsme viděli spoustu brouk[ů].',
  ],
  hard: [
    'Ve vlak[u] [u]kaž pr[ů]kazk[u].',
    '[U]ršula Nová má nový [ú]čes.',
    'V Africe žije hodně lv[ů], slon[ů], buvol[ů].',
    'Kde teče pr[ů]zračná voda?',
    'Babička jede do [Ú]stí nad Labem.',
    'V Boh[u]slavicích nad [Ú]pou byla slavnost.',
    'Už aby skončila ta pr[ů]trž mračen.',
    'Kolik stojí na louce včelích [ú]l[ů]?',
    'K[u]p pr[ů]svitný papír.',
    'Na poli byla letos ne+[ú]roda.',
    'Nakresli troj+[ú]helník a pěti+[ú]helník.',
    'Chci se z+[ú]častnit závod[u].',
    'Hledali jsme klíče bez+[ú]spěšně.',
    'O prázdninách jedeme na t[ú]r[u] do hor.',
    'Bratr má nový sk[ú]tr.',
    'V [Ú]stí nad Labem bydlí moje teta.',
    'Pr[ů]vodce nám [u]kázal starý hrad.',
    'V[ů]ně r[ů]ží se nesla celou zahradou.',
    'Z[ů]stali jsme doma, protože pršelo.',
    'Ve čtverci jsou čtyři pravé [ú]hly.',
    'Po [ú]raz[u] musel Petr chodit o berlích.',
    'Pr[ů]chod do zahrady je [ú]zký.',
    'Chlapci se [ú]častnili závod[u] v plavání.',
    'Jedeme na výlet do [Ú]štěku.',
    'Ne+[ú]spěch tě nemusí mrzet.',
    'Při [ú]klid[u] jsme našli ztracený klíč.',
    'Strýc jezdí do práce na sk[ú]tru.',
    'Na t[ú]ře nás bolely nohy.',
    'Z [ú]st mu v zimě šla pára.',
    'V [ú]terý jsme byli na t[ú]ře v Krkonoších.',
  ],
};

const isLetter = (ch) => /\p{L}/u.test(ch);

/* Jeden zápis věty → tokeny k vykreslení a seznam mezer. Token je slovo
   i s interpunkcí; mezera uvnitř nesmí slovo roztrhnout na dva řádky. */
export function parseUu(src) {
  const gaps = [];
  const tokens = src.split(' ').map((raw) => {
    const parts = [];
    let word = '';      // celé slovo bez závorek a `+`, s doplněnými písmeny
    let joinAt = -1;    // kde ve slově byl `+`
    const local = [];   // mezery tohohle slova a jejich pozice ve slově
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '+') {
        joinAt = word.length;
        continue;
      }
      if (ch === '[') {
        const end = raw.indexOf(']', i);
        const letter = raw.slice(i + 1, end);
        local.push({ g: gaps.length + local.length, pos: word.length, letter, join: joinAt === word.length });
        parts.push({ g: gaps.length + local.length - 1 });
        word += letter;
        i = end;
        continue;
      }
      const last = parts[parts.length - 1];
      if (last && 's' in last) last.s += ch;
      else parts.push({ s: ch });
      if (isLetter(ch)) word += ch;
    }
    const clean = word;
    for (const l of local) {
      const answer = l.letter.toLowerCase();
      const start = l.pos === 0;
      const kind = answer === 'u' ? 'short'
        : answer === 'ů' ? 'ring'
          : start ? 'start'
            : l.join ? 'join'
              : 'except';
      gaps.push({
        answer,
        upper: l.letter !== answer,
        word: clean,
        kind,
        split: l.join ? `${clean.slice(0, l.pos)} + ${clean.slice(l.pos)}` : '',
      });
    }
    return parts;
  });
  const text = src.replace(/\+/g, '').replace(/\[[^\]]+\]/g, '_');
  const full = src.replace(/\+/g, '').replace(/\[([^\]]+)\]/g, '$1');
  return { tokens, gaps, text, full };
}

export function makeUuRound(levelKey = 'easy', count = 10) {
  const level = UU_LEVELS[levelKey] ? levelKey : 'easy';
  const n = UU_COUNTS.includes(count) ? count : UU_COUNTS[1];
  return shuffle(SENTENCES[level]).slice(0, n).map((src) => {
    const p = parseUu(src);
    return { level, ...p, answer: p.gaps.map((g) => g.answer).join(', '), key: src };
  });
}

/* Písmeno do mezery tak, jak se ukáže ve větě - velké na začátku věty. */
export const uuShown = (gap, letter) => (gap.upper ? letter.toUpperCase() : letter);

/* Tag chyby podle první špatně doplněné mezery. */
export function uuTag(ex, picks) {
  const i = ex.gaps.findIndex((g, k) => picks[k] !== g.answer);
  if (i < 0) return null;
  const g = ex.gaps[i];
  if (g.kind === 'start') return 'uuStart';
  // obě dlouhá, jen jiná čárka / kroužek
  if (g.answer !== 'u' && picks[i] !== 'u') return 'uuMark';
  return 'uuLength';
}

const RULE = {
  short: (g) => `**${g.word}** – tady se u čte **krátce**, píše se bez čárky i bez kroužku: **u**.`,
  start: (g) => `**${g.word}** – na **začátku slova** se dlouhé ú píše s čárkou: **ú**.`,
  ring: (g) => `**${g.word}** – **uprostřed** nebo **na konci** slova se dlouhé ú píše s kroužkem: **ů**.`,
  join: (g) => `**${g.word}** – slovo se skládá ze dvou částí (${g.split}) a druhá část začíná na ú. Proto **ú** s čárkou.`,
  except: (g) => `**${g.word}** – tohle slovo si musíš pamatovat: píše se v něm **ú** s čárkou, i když je uprostřed.`,
};

/* Kroky vysvětlení po chybě, **tučné** převádí app.js na <b>. Když přijdou
   doplněná písmena, vysvětlí se jen ta špatná. */
export function uuExplain(ex, picks = null) {
  const gaps = picks ? ex.gaps.filter((g, i) => picks[i] !== g.answer) : ex.gaps;
  const steps = [];
  const seen = new Set();
  for (const g of gaps) {
    const line = RULE[g.kind](g);
    if (seen.has(line)) continue;
    seen.add(line);
    steps.push(line);
  }
  steps.push(`Celá věta: **${ex.full}**`);
  return steps;
}

export function uuText(ex, reveal) {
  return reveal ? ex.full : ex.text;
}
