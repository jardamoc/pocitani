/*
  Vývojový server pro `public/`.

  Spuštění:  node server.mjs          (port 8000)
             node server.mjs 8080     (jiný port)

  Proč vůbec server: aplikace je poskládaná z ES modulů a ty prohlížeč
  z `file:///` načíst odmítne. Přes localhost to projde.

  Žádné závislosti - jen to, co Node umí sám. Do `public/` tenhle soubor
  nepatří, na Netlify se nenasazuje.
*/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('./public', import.meta.url)));
const PORT_ZADANY = Number(process.argv[2] || process.env.PORT || 8000);
const POKUSU = 20;   // když je port obsazený, zkusí se následující

/* Bez správného typu prohlížeč modul nespustí - `.mjs` a `.js` musí být
   text/javascript, jinak se aplikace tiše nenačte. */
const TYPY = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/* Cesta z adresy se musí držet uvnitř `public/`. Bez téhle kontroly by
   `/../../neco` vydalo libovolný soubor z disku. */
function cestaKSouboru(url) {
  const bezDotazu = decodeURIComponent(url.split('?')[0].split('#')[0]);
  const cil = resolve(join(ROOT, bezDotazu));
  if (cil !== ROOT && !cil.startsWith(ROOT + sep)) return null;
  return cil;
}

const server = createServer(async (req, res) => {
  let cil = cestaKSouboru(req.url || '/');
  if (!cil) {
    res.writeHead(403, { 'Content-Type': TYPY['.txt'] });
    res.end('Mimo slozku public');
    return;
  }

  try {
    const info = await stat(cil);
    if (info.isDirectory()) cil = join(cil, 'index.html');
    const data = await readFile(cil);
    res.writeHead(200, {
      'Content-Type': TYPY[extname(cil).toLowerCase()] || 'application/octet-stream',
      // Během vývoje chceme vidět změnu hned, ne verzi z cache.
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': TYPY['.txt'] });
    res.end('Nenalezeno: ' + req.url);
  }
});

/* Obsazený port není důvod k pádu - zkus další v řadě. */
let port = PORT_ZADANY;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < PORT_ZADANY + POKUSU) {
    server.listen(++port);
    return;
  }
  console.error('Server se nepodarilo spustit:', e.message);
  process.exit(1);
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log('');
  console.log('  Pocitani pro Alzbetu bezi na  ' + url);
  if (port !== PORT_ZADANY) console.log(`  (port ${PORT_ZADANY} byl obsazeny)`);
  console.log('  Ukoncis stiskem Ctrl+C nebo zavrenim okna.');
  console.log('');
});
