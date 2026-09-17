/*
  Nasazení do provozu jedním příkazem:  npm run publish

  Dělá to, co se dosud psalo ručně ve dvou krocích, a navíc si po sobě
  přečte skutečný stav - hláška "Deploy is live" sama o sobě nestačí.

  Kroky:  kontroly -> git push -> wrangler deploy -> ověření živého webu

  Nacvičit nanečisto (vše kromě samotného nasazení):
      npm run publish -- --dry-run
*/

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const NANECISTO = process.argv.includes('--dry-run');
const WEB = 'https://pocitani.jarda-moc.workers.dev';
const VETEV = 'main';

const ok = (t) => console.log('  [ok]   ' + t);
const info = (t) => console.log('  [..]   ' + t);

function konec(duvod, rada) {
  console.error('\n  [STOP] ' + duvod);
  if (rada) console.error('         ' + rada);
  console.error('');
  process.exit(1);
}

/* Potichu - jen kvůli přečtení výstupu. */
function git(...args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.error) konec('Nepodarilo se spustit git: ' + r.error.message);
  return { kod: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/* Naopak nahlas - uživatel má vidět průběh nasazení. */
function nahlas(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  return r.status;
}

console.log('\n  Nasazeni ' + (NANECISTO ? '(NANECISTO - nic se neodesle)' : 'do provozu') + '\n');

/* ---- 1. Kontroly, at se nenasadi rozdelana prace ---- */

if (git('rev-parse', '--is-inside-work-tree').kod !== 0) {
  konec('Tohle neni git repozitar.');
}

const vetev = git('rev-parse', '--abbrev-ref', 'HEAD').out;
if (vetev !== VETEV) {
  konec(`Jsi na vetvi "${vetev}", ne na "${VETEV}".`,
    `Nasazuje se jen ${VETEV}. Prepni se: git switch ${VETEV}`);
}
ok(`vetev ${VETEV}`);

const zmeny = git('status', '--porcelain').out;
if (zmeny) {
  const pocet = zmeny.split('\n').length;
  konec(`Mas ${pocet} neulozenou zmenu(y) - nasazovalo by se neco jineho, nez mas v gitu.`,
    'Nejdriv: git add -A && git commit -m "..."');
}
ok('pracovni strom je cisty');

/* ---- 1b. Razitko verze ----
   Datum nasazeni a poradi v ramci dne se zapise do public/js/version.js a
   hned zacommituje - jinak by dalsi krok (cisty strom uz probehl) poslal na
   web neco jineho, nez je v gitu. Aplikace to ukazuje dole v "Nastaveni". */

const VERZE_SOUBOR = new URL('./public/js/version.js', import.meta.url);

function dnesniDatum() {
  const d = new Date();
  const dva = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dva(d.getMonth() + 1)}-${dva(d.getDate())}`;
}

function orazitkuj() {
  const datum = dnesniDatum();
  const puvodni = readFileSync(VERZE_SOUBOR, 'utf8');
  const nalez = puvodni.match(/datum: '(\d{4}-\d{2}-\d{2})', poradi: (\d+)/);
  if (!nalez) konec('V public/js/version.js chybi radek s VERZE.', 'Ocekavam tvar: datum: \'RRRR-MM-DD\', poradi: N');
  // stejny den = dalsi vydani, jiny den = zase od jednicky
  const poradi = nalez[1] === datum ? Number(nalez[2]) + 1 : 1;
  const novy = puvodni.replace(
    /export const VERZE = \{[^}]*\};/,
    `export const VERZE = { datum: '${datum}', poradi: ${poradi} };`,
  );
  writeFileSync(VERZE_SOUBOR, novy, 'utf8');
  return { datum, poradi };
}

if (NANECISTO) {
  info('nanecisto: razitko verze se nemeni');
} else {
  const verze = orazitkuj();
  const zapsano = git('status', '--porcelain', 'public/js/version.js').out;
  if (zapsano) {
    git('add', 'public/js/version.js');
    const c = git('commit', '-m', `Oznacit nasazeni ${verze.datum} (${verze.poradi}.)`);
    if (c.kod !== 0) konec('Commit razitka verze selhal.', c.err || c.out);
  }
  ok(`verze ${verze.datum}, vydani ${verze.poradi}. toho dne`);
}

/* ---- 2. Odeslat commity na GitHub ---- */

git('fetch', '--quiet');
const napred = git('rev-list', '--count', `origin/${VETEV}..HEAD`).out;
if (napred !== '0') {
  info(`odesilam ${napred} commit(y) na GitHub`);
  if (!NANECISTO && nahlas('git', ['push']) !== 0) konec('git push selhal.');
  ok('odeslano');
} else {
  ok('GitHub uz je aktualni');
}

/* ---- 3. Cloudflare ---- */

/* Radsi se zeptat dopredu nez nechat spadnout nasazeni na nesrozumitelne hlasce. */
const kdojsem = spawnSync('npx', ['--yes', 'wrangler@latest', 'whoami'],
  { encoding: 'utf8', shell: true });
if (kdojsem.status !== 0) {
  konec('Wrangler neni prihlaseny ke Cloudflare.',
    'Spust jednou rucne:  npx wrangler login   (otevre prohlizec, pak uz to plati)');
}
ok('Cloudflare je prihlaseny');

if (NANECISTO) {
  info('nanecisto: preskakuji wrangler deploy i overeni webu');
  console.log('\n  Kontroly proslo. Ostre nasazeni: npm run publish\n');
  process.exit(0);
}

info('nasazuji na Cloudflare Workers (napoprve chvili trva, stahuje se CLI)');
// `wrangler` neni v PATH, jede se pres npx; nastaveni je ve wrangler.jsonc.
const kod = nahlas('npx', ['--yes', 'wrangler@latest', 'deploy']);
if (kod !== 0) konec('Nasazeni na Cloudflare selhalo (navratovy kod ' + kod + ').');

/* ---- 4. Overit skutecny stav, ne hlasku ---- */

info('overuji, co je opravdu na webu');
let hotovo = false;
for (let pokus = 1; pokus <= 5 && !hotovo; pokus++) {
  try {
    const odpoved = await fetch(WEB + '/index.html?t=' + Date.now(), { cache: 'no-store' });
    const text = await odpoved.text();
    if (odpoved.status === 200 && text.includes('Počítání pro Alžbětu')) {
      ok(`web odpovida HTTP 200 a stranka sedi (pokus ${pokus})`);
      hotovo = true;
    } else {
      info(`pokus ${pokus}: HTTP ${odpoved.status}, zkousim znovu za 3 s`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  } catch (e) {
    info(`pokus ${pokus}: ${e.message}, zkousim znovu za 3 s`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

if (!hotovo) {
  konec('Cloudflare hlasi uspech, ale web se neozval podle ocekavani.',
    'Zkontroluj rucne: ' + WEB);
}

console.log('\n  Hotovo:  ' + WEB + '\n');
