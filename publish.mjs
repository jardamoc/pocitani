/*
  Nasazení do provozu jedním příkazem:  npm run publish

  Dělá to, co se dosud psalo ručně ve dvou krocích, a navíc si po sobě
  přečte skutečný stav - hláška "Deploy is live" sama o sobě nestačí.

  Kroky:  kontroly -> git push -> netlify deploy -> ověření živého webu

  Nacvičit nanečisto (vše kromě samotného nasazení):
      npm run publish -- --dry-run
*/

import { spawnSync } from 'node:child_process';

const NANECISTO = process.argv.includes('--dry-run');
const WEB = 'https://pocitani-alzbeta.netlify.app';
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

/* ---- 3. Netlify ---- */

if (NANECISTO) {
  info('nanecisto: preskakuji netlify deploy i overeni webu');
  console.log('\n  Kontroly proslo. Ostre nasazeni: npm run publish\n');
  process.exit(0);
}

info('nasazuji na Netlify (napoprve chvili trva, stahuje se CLI)');
// `netlify` neni v PATH, ale prihlaseni v %APPDATA%\netlify plati.
const kod = nahlas('npx', ['--yes', 'netlify-cli@latest', 'deploy', '--prod', '--dir=public']);
if (kod !== 0) konec('Nasazeni na Netlify selhalo (navratovy kod ' + kod + ').');

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
  konec('Netlify hlasi uspech, ale web se neozval podle ocekavani.',
    'Zkontroluj rucne: ' + WEB);
}

console.log('\n  Hotovo:  ' + WEB + '\n');
