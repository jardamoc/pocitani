# Počítání pro Alžbětu

Hravý trenažér matematiky pro **konkrétní dítě** — dceru majitele repozitáře, školačku
**1. až 3. třídy**. Není to obecný produkt; když se rozhoduješ mezi „správně obecně" a
„srozumitelně pro sedmiletou holku", vyhrává druhé.

GitHub `jardamoc/pocitani`, běží na Cloudflare Workers jako `pocitani`
(https://pocitani.jarda-moc.workers.dev), účet `Jarda.moc@gmail.com`.

## Dvě nepřekročitelná pravidla

**1. Všechny texty v UI jsou v ženském rodě.** „Zvládla jsi", „napsala jsi", „spletla ses".
Nikdy neutrální ani mužský tvar, nikdy podtržítkové dvojtvary typu „Zvládl_a jsi".

**2. Žádná záporná ani desetinná čísla.** Nikde — ani v zadání, ani v mezivýsledku, ani ve
vysvětlení po chybě. Když nějaká varianta vyjde záporně, popiš to slovy
(„to nejde, odčítá se větší číslo"), nevypisuj `-12`. Platí to i pro časy na výsledkové
obrazovce — sekundy se zaokrouhlují na celé (dřív tam bylo „6.9 s").

## Spuštění a nasazení

```powershell
npm run dev                     # http://localhost:8000
npm run publish                 # git push + nasazení + ověření
npm test                        # testy odměn a obrázků
npm run publish -- --dry-run    # jen kontroly, nic se neodešle
```

**Žádné sestavování ani závislosti nepřibyly.** `package.json` je tu jen kvůli těmhle
zkratkám — `dependencies` je prázdné, `npm install` není potřeba, `public/` se
pořád servíruje tak, jak leží. Co ale **nesmíš odstranit, je `"type": "module"`**: bez
něj by Node považoval `public/js/*.js` za staré CommonJS moduly a každý testovací
skript by spadl na `export`.

Jméno skriptu `publish` je zároveň npm lifecycle hook. Nevadí to, protože `private: true`
zakazuje `npm publish` — nic se nikam nepublikuje.

**Vývojový server** `server.mjs` stojí jen na `node:http`. Obsazený port si sám posune
o jedna dál a vypíše, kde nakonec běží. Odpovědi mají `Cache-Control: no-store`, aby
byly změny vidět bez `Ctrl+F5`. Cesty mimo `public/` vrací 403 (ověřeno i na tvarech
`%2e%2e` a `..%2f`).

Dvojklik na `index.html` **nefunguje** — aplikace je z ES modulů a ty prohlížeč
z `file:///` odmítne načíst. Musí to jít přes `localhost`.

**Nasazení** `publish.mjs` je ruční postup zabalený do skriptu, i s pojistkami:
zastaví se na jiné větvi než `main` a na neuložených změnách (jinak by se nasadilo
něco jiného, než je v gitu), pak odešle commity, spustí nasazení a **nakonec si stáhne
živý web a zkontroluje ho** — hláška o úspěšném nasazení sama o sobě nestačí.

**Hostuje to Cloudflare Workers**, ne Pages: `public/` se nahraje jako statická aktiva.
Od 8. 11. 2026 má Worker i malý kód na serveru (`worker/index.js`, `main` v `wrangler.jsonc`),
který dostane jen adresy mimo `public/` — viz *Hlášení rodičům*. Bezpečnostní
hlavičky jsou v `public/_headers` — wrangler ten soubor přečte a samotný ho neservíruje.

## Hlášení rodičům

Po každém dohraném kole pošle `hlaseni.js` shrnutí na `POST /api/kolo` (jméno a typ zařízení, hra,
obtížnost, volby, rozsah, výsledek, čas, odměna, co jde / na co pozor, chyby). Worker ho uloží
do D1 (`pocitani`, tabulka v `worker/schema.sql`, `id` = `gameId`, takže dvojí odeslání nic
nezdvojí) a pošle upozornění přes **ntfy.sh** do telefonu. IP adresu (`CF-Connecting-IP`)
a přibližné město (`request.cf`) doplňuje server, od prohlížeče se neberou. Stránka `public/prehled.html`
ukáže kola po dnech; data tahá z `GET /api/kola` s heslem v hlavičce.

- **Tajemství nejsou v gitu:** `NTFY_TOPIC` (tajný název kanálu) a `PREHLED_HESLO` se
  nastavují `npx wrangler secret put <JMENO>`.
  Za `put` patří **jméno** (`PREHLED_HESLO`), hodnota se zadává až na výzvu — napsané
  heslo v příkazu vytvoří tajemství pojmenované heslem (stalo se 8. 11. 2026).
  Chyba „latest version of your Worker isn't currently deployed" se spraví
  `npx wrangler deploy` a novým `secret put`. Jednodušší je dashboard:
  Workers & Pages → pocitani → Settings → Variables and Secrets.
- **Přehled je tabulka** (`SLOUPCE` v `prehled.js`): řádek = kolo, pod záhlavím filtr
  každého sloupce (výběr u sloupců s `vyber`, jinak hledání textu), klik na záhlaví řadí.
- Bez sítě zůstane zpráva ve frontě (`pocitani.hlaseni.v1` přes `storage.js`, QR ho
  nepřenáší) a odejde při dalším spuštění nebo události `online`. Na `localhost` se nic neposílá.
- Jméno zařízení se zadává v dialogu Nastavení za heslem, jinak se odhadne z prohlížeče.
- `hlasKolo()` v `app.js` je celé v `try` — chyba hlášení nesmí shodit konec hry.
- Server bere jen známá pole ve známých mezích (`ocistiKolo()`) a víc než 120 kol za hodinu
  odmítne; adresa `/api/kolo` je veřejná, heslo mít nemůže (bylo by vidět ve zdrojáku).

`wrangler` **není v PATH**, jede se přes `npx`. Přihlášení je jednorázové
(`npx wrangler login`, otevře prohlížeč) a ukládá se do `%APPDATA%\xdg.config\.wrangler`.
`publish.mjs` si ho ověřuje **předem** přes `wrangler whoami`, aby nasazení nespadlo
uprostřed na nesrozumitelné hlášce.

Před odesláním si `publish.mjs` **orazítkuje verzi**: do `public/js/version.js` zapíše
dnešní datum a pořadí nasazení v rámci dne (stejný den = další vydání, jiný den = zase
od jedničky) a soubor rovnou zacommituje. Musí to být **až po kontrole čistého stromu** —
jinak by se nasadilo něco jiného, než je v gitu. Aplikace razítko ukazuje dole v dialogu
„Nastavení", aby šlo poznat, jestli má zařízení skutečně novou verzi. V režimu
`--dry-run` se razítko nemění.

Skript se pouští jako `node --use-system-ca publish.mjs` a ten přepínač **nesmíš
odstranit**. Firemní síť rozbaluje HTTPS vlastním certifikátem; Node na rozdíl od
PowerShellu úložiště certifikátů Windows sám nečte, takže závěrečné ověření webu
padalo na `fetch failed` / „unable to get local issuer certificate", přestože web
běžel. Vypadalo to jako chyba nasazení, a nebyla.

**Před commitem zkontroluj `git status` na cizí změny.** Na repozitáři může souběžně
pracovat jiná session (7. 11. 2026 rozpracovaný Pravopis). `git add <soubor>` pak vezme
i její půlku a nasazená verze spadne na chybějícím importu. Cizí rozpracované změny
neodklízej (`stash`, `checkout`) — zeptej se uživatele.

## Struktura

| Soubor | Co v něm je |
|---|---|
| `public/index.html` | čtyři obrazovky (nastavení / kvíz / výsledek / odměny), přepínají se třídou `is-active`, plus vrstva `#rewardOverlay` |
| `public/js/app.js` | veškeré UI — vykreslení úloh, klávesnice, vyhodnocení, výsledková obrazovka |
| `public/js/generator.js` | generování příkladů, vysvětlení po chybě, rozbor chyby |
| `public/js/riddle.js` | generátor obrázkových hádanek (samostatný, generator.js si ho importuje) |
| `public/js/grid.js` | generátor mřížek (stejně samostatný jako `riddle.js`) |
| `public/js/over10.js` | generátor rozkladů přes desítku (stejně samostatný jako `grid.js`) |
| `public/js/bigadd.js` | generátor velkého sčítání do 100 — rozklad na desítky a jednotky, skoky po ose |
| `public/js/kvet.js` | generátor Kytiček — lístky, které dají dohromady číslo uprostřed |
| `public/js/pexeso.js` | generátor ploch pro „Najdi dvojice" (stejně samostatný jako `grid.js`) |
| `public/js/bigmul.js` | generátor velkého násobení — rozklad a tři kroky s dvojí volbou |
| `public/js/abc.js` | Abeceda: seznam slov, výběr podle obtížnosti, čisté funkce přesunu kartiček |
| `public/js/pos.js` | Slovní druhy: ručně určené věty podle obtížnosti, výběr kola, vyhodnocení a vysvětlení |
| `public/js/vety.js` | Druhy vět: ručně sepsané věty, výběr kola, možnosti k otázce a vysvětlení |
| `public/js/vyznam.js` | Význam slov: ručně sepsaná slova a skupiny, tři úlohy, vysvětlení |
| `public/js/uu.js` | téma u, ú, ů Pravopisu: ručně sepsaná slova a věty se zápisem `[ů]`, rozbor mezer, tag chyby, pravidla |
| `public/js/pravopis.js` | Pravopis: ručně sepsaná slova a věty po tématech (i/y, dě/tě/ně, bě/pě/vě/mě, párové, velká písmena), nabídka kláves podle mezery, vysvětlení |
| `public/js/hudba.js` | Hudební nauka a Klavír: tabulky, generátory úloh, vysvětlení — bez DOM |
| `public/js/zvuk.js` | tóny klavíru pro hru Sluch — syntéza Web Audio, bez nahrávek |
| `public/js/notace.js` | kreslení not jako SVG text (osnova, klíče, noty, pomlky, takty) — bez knihovny |
| `public/js/geometrie.js` | Geometrie: útvary, tělesa, čáry, věci kolem nás, výběr možností podle obtížnosti, vysvětlení — bez DOM |
| `public/js/geokresba.js` | kreslení útvarů, těles a čar jako SVG text z parametrů `fig` — bez knihovny, nic neimportuje |
| `public/js/stats.js` | rozbor kola, rady, `sanitizeState()` — **na úložiště nesahá** |
| `public/js/storage.js` | **jediná vrstva nad úložištěm** — načtení, fronta zápisů, mazání, vyměnitelný backend |
| `public/js/validate.js` | `wholeNumber` / `textList` — sdílené kousky validace, bez DOM |
| `public/js/random.js` | `rnd` / `pick` / `chance` / `shuffle` / `range` |
| `public/js/rewards-data.js` | sbírky (78 dumplingů, 121 labubáků): soubory obrázků, česká jména, pevná ID, pořadí pro QR — čistá data |
| `public/js/rewards.js` | pravidla odměn, vyhodnocení kola, výběr postavičky — **bez DOM a bez úložiště** |
| `public/js/rewards-ui.js` | vykreslení odměn: obrázky, sbírka, závěrečné okno, animace |
| `public/js/version.js` | razítko posledního nasazení (datum + pořadí v rámci dne) — **přepisuje ho `publish.mjs`**, ručně se needituje |
| `public/js/qr.js` | generátor QR kódu podle normy — bez knihovny |
| `public/js/transfer.js` | přenos postupu mezi zařízeními: zabalení, adresa, slučování |
| `public/js/export-ui.js` | dialog „Export" — heslo, jméno zařízení, QR kód, tři mazací tlačítka |
| `public/js/hlaseni.js` | hlášení rodičům: jméno zařízení, fronta zpráv, odeslání na `/api/kolo` |
| `public/prehled.html`, `js/prehled.js`, `css/prehled.css` | přehled výsledků pro rodiče, za heslem ze serveru |
| `worker/index.js`, `worker/schema.sql` | kód na serveru: příjem kol do D1, ntfy, `/api/kola` pro přehled |
| `public/img/odmeny/dumplings/` | 78 postaviček (`.webp`, složka podle kategorie) a 5 nadpisů v `_category_titles/` (sdílí je všechny sbírky) |
| `public/img/odmeny/labubu/` | 121 labubáků (`.webp`, složka podle kategorie) |
| `public/css/styles.css` | vše včetně devíti barevných témat, tmavého režimu a odměn |
| `server.mjs` | vývojový server (`npm run dev`) — mimo `public/`, nenasazuje se |
| `publish.mjs` | nasazení i s kontrolami a ověřením (`npm run publish`) |
| `tools/odmeny/` | Python skripty na rozřezání listu postaviček na `.webp` — mimo `public/`, nenasazují se |
| `wrangler.jsonc` | nastavení Cloudflare Workers — jméno služby a složka s aktivy |
| `public/_headers` | bezpečnostní hlavičky pro živý web; wrangler ho sám neservíruje |
| `tests/*.test.mjs` | testy pro `node --test`, bez frameworku i bez závislostí |
| `README.md` | popis projektu pro GitHub; podrobná pravidla zůstávají tady |

**Obrázky v repozitáři jsou vypnuté.** `.gitignore` vyřazuje `*.jpeg`, `*.jpg` i `*.png` —
jsou to lokální podklady (fotky zadání), ne obsah aplikace. Obrázky odměn jsou `.webp`,
na ty se pravidlo nevztahuje. **Do README proto nedávej snímky obrazovky**, odkaz by na GitHubu ukazoval
na neexistující soubor. Když je tam někdy mít chceš, přidej napřed vlastní výjimku
(např. `!docs/*.png`) a obrázky ukládej tam.
| `package.json` | jen ty tři zkratky a `"type": "module"`; žádné závislosti |

Prosté ES moduly, žádný framework, žádné závislosti. Závislosti jdou jedním směrem:
`random.js → riddle.js / grid.js / over10.js / bigadd.js / kvet.js / pexeso.js / bigmul.js / abc.js / pos.js / vety.js / vyznam.js / uu.js / pravopis.js / hudba.js → generator.js → app.js`
(`notace.js → app.js` a `geokresba.js → app.js` nezávisle, nic neimportují; `geometrie.js` jde cestou `random.js → … → generator.js`)
(`stats.js` si z `vety.js` a `vyznam.js` bere jen názvy pro výpis chyb)
(`app.js` si z `abc.js` bere navíc funkce přesunu a z `pos.js` tabulky a `posCheck` / `posTag`),
`rewards-data.js → rewards.js → rewards-ui.js → app.js`,
`validate.js → stats.js / rewards.js → storage.js → app.js` a
`qr.js / transfer.js → export-ui.js → app.js` a `storage.js → hlaseni.js → export-ui.js / app.js`. Kruh nezaváděj.

## Ukládání dat

**Na `localStorage` smí sahat jedině `storage.js`.** Nikde jinde v aplikaci se
`localStorage` už neobjevuje a nevracej ho tam — ani „jen na jedno místo".

Rozhraní je **asynchronní schválně**, přestože uvnitř běží synchronní `localStorage`.
Server ani databáze synchronní být nemůže, a dokud si data tahal `app.js` přímo, znamenal
by jejich příchod přepsat celý soubor. Takhle se vymění jediný backend
(`setBackend()`) a zbytek aplikace se nezmění.

Co z toho plyne pro psaní kódu:

- **`stats.js` ani `rewards.js` neukládají.** Dřív si `recordRound()`, `applyRound()`
  i `markCollectionSeen()` volaly `save()` samy; zápis teď patří volajícímu v `app.js`.
  Když přidáš funkci, která mění stav, ulož ho **v `app.js`**, ne uvnitř modulu.
- **Zápisy se sbírají do fronty** (300 ms) a vždy se uloží poslední stav — deset kliknutí
  po sobě skončí jedním zápisem. U serveru je to rozdíl mezi jedním požadavkem a deseti.
  **Na `saveState` / `saveRewards` se nečeká** (`await` ne), aby se UI kvůli ukládání
  nezaseklo. `flush()` je navázaný na `visibilitychange`, takže zavření karty nic neztratí.
- **`clear()` zahodí i čekající zápis.** Bez toho by se pár set milisekund po smazání
  vrátilo zpátky to, co se právě smazalo.
- **Start aplikace je `boot()`** na konci `app.js`. Načtení je asynchronní, takže všechno,
  co potřebuje data (`applyTheme`, `renderConfigScreen`, `acceptIncoming`), se volá až
  odtamtud. Posluchače se dál váží na úrovni modulu — spustí se stejně až po kliknutí.
- **Data se při načtení validují.** `rewards.js` má `sanitize()`, `stats.js` má
  `sanitizeState()`; obojí validuje každé pole zvlášť, takže jedna poškozená položka
  nevezme ostatní platná data. Sdílené kousky jsou ve `validate.js` — **nekopíruj je**.
  Obě funkce jsou bez DOM i bez úložiště schválně: až data začnou chodit po síti, bude
  tentýž soubor potřeba i na serveru.
- `sanitizeState()` **neověřuje `config`** — jeho pravidla zná `normalizeConfig()` v
  `app.js` a import odsud by udělal kruh. `boot()` si ho proto prožene sám. Téma se
  z téhož důvodu kontroluje jen jako tvar slova; neznámý klíč nic nerozbije, protože
  `currentTheme()` spadne na výchozí pandu.
- **Volby z úvodní obrazovky se ukládají hned při každé změně** (`saveConfig()` v `app.js`).
  Dřív je do stavu zapisoval až `recordRound()` po dokončeném kole, takže přenastavení
  před zavřením aplikace se ztratilo a příště tam bylo zase to staré. **Nevracej to zpátky.**
- **`mergePayload()` v `transfer.js` neukládá.** Slučování je čistá operace v paměti,
  která vrátí souhrn změn; zapisuje až `acceptIncoming()` v `app.js`.

## Sedmnáct režimů hry

Na úvodní obrazovce se vybírá karta **„Co si zahrajeme?"**. Nad kartami jsou tři
záložky **🔢 Matematika / 📖 Čeština / 🎵 Hudba** (`SUBJECTS`, u každého režimu `subject` v `MODES`).
Pod 400 px se ikony záložek schovají, jinak se tři vedle sebe nevejdou.
Otevřená záložka se neukládá, odvodí se z `config.mode`; přepnutí záložky rovnou vybere
hru (naposledy hranou pod ní, jinak první) — bez toho by dole zůstalo nastavení z druhé
záložky.

| režim | `config.mode` | co se v nastavení skryje |
|---|---|---|
| **Počítání** | `calc` | — (vybírají se operace i druhy úloh navíc) |
| **Počítej přes 10** | `over10` | „něco navíc" (v operacích zůstává jen ➕ a ➖) |
| **Velké sčítání** | `bigadd` | „něco navíc" (v operacích jen ➕ a ➖, sdílí `config.over10Ops`) |
| **Kytičky** | `kvet` | operace, „něco navíc", **rozsah** (číslo uprostřed řídí obtížnost) |
| **Obrázkové hádanky** | `riddle` | operace, „něco navíc" |
| **Mřížka** | `grid` | „něco navíc", **počet příkladů** (jedna mřížka = jedno kolo) |
| **Najdi dvojice** | `pexeso` | „něco navíc", **počet příkladů** (jedna plocha = jedno kolo) |
| **Velké násobení** | `bigmul` | operace (je to vždy násobení), „něco navíc" |
| **Geometrie** | `geom` | „něco navíc", **rozsah**; karta s operacemi vybírá úlohy; počet = počet úloh |
| **Abeceda** (Čeština) | `abc` | operace, „něco navíc", **rozsah „Do kolika"**; počet se vybírá ze slov |
| **Slovní druhy** (Čeština) | `pos` | „něco navíc", **rozsah**; karta s operacemi vybírá, co se hledá; počet = počet vět |
| **Druhy vět** (Čeština) | `vety` | „něco navíc", **rozsah**; karta s operacemi vybírá úlohu; počet = počet vět |
| **Význam slov** (Čeština) | `vyznam` | „něco navíc", **rozsah**; karta s operacemi vybírá úlohu; jen se spojováním i **počet** |
| **Pravopis** (Čeština) | `prav` | „něco navíc", **rozsah**; karta s operacemi vybírá témata; počet = slova (lehká) / věty |
| **Hudební nauka** (Hudba) | `hudba` | „něco navíc", **rozsah**; karta s operacemi vybírá úlohy; počet = počet úloh |
| **Klavír** (Hudba) | `klavir` | „něco navíc", **rozsah**; karta s operacemi vybírá směr; počet = počet úloh |
| **Sluch** (Hudba) | `sluch` | „něco navíc", **rozsah**; karta s operacemi vybírá úlohy; počet = počet úloh |

Větve se rozcházejí až v `startRound()`, kde je tabulka builderů. Všechno ostatní —
klávesnice, vyhodnocení, statistiky — je společné, protože každá úloha má stejný tvar:
`{ op, kind, missing, a, b, c, answer, skill }`.

`config.level` je **společný pro všech šest režimů s obtížností** (klíče
`easy`/`medium`/`hard`), takže přepnutí režimu obtížnost neztratí. Hlídá se proti společné
množině `LEVEL_ALL` v `normalizeConfig()`, ne proti tabulce jednoho režimu. Tabulku
popisků vybírá `levelTable()` podle režimu.

**Úlohy s víc políčky mají společnou cestu.** Mřížka i rozklad přes desítku mají místo
jednoho políčka na odpověď několik dílčích; odpovědí je u obou **řetězec** hodnot spojený
`', '` v pořadí `ex.hidden`. V `app.js` je na to tabulka `PART_SEL` a nad ní
`partInputs()` / `partValue()` / `hasParts()` — čtení odpovědi, třesení prázdných políček,
obarvení, druhý pokus i dopsání řešení jedou přes ně. **Když přidáš třetí takovou úlohu,
stačí řádek v `PART_SEL`**, ne nová větev na pěti místech.

**Když přidáváš nový druh úlohy, drž se tohohle tvaru.** Ušetří ti to práci na pěti místech.
Stačí pak: položka v `EXTRA_KINDS`, větev v `makeExercise()`, funkce v `BODY_HTML`,
větev v `hintFor()` / `explain()` / `exToText()` a popisek v `KIND_LABEL` ve `stats.js`.

Všechny tři etapy plánu `~/.claude/plans/dynamic-swimming-sparkle.md` (Větší/menší,
Počítej přes 10, Pexeso) jsou hotové a nasazené. Třetí etapa se během práce
na uživatelovo přání změnila z pexesa na spojovačku „Najdi dvojice" (viz níž).
Šestý režim „Velké násobení" podle plánu `~/.claude/plans/lexical-rolling-floyd.md`
je hotový, ověřený a nasazený (viz níž).

## Obrázkové hádanky — jak se staví

Rovnice se **nelosují a pak neověřují**; staví se jako **žebřík**:

```
🐘 + 🐘 = 18        1. řádek prozradí jeden obrázek
🐘 − 🦓 = 1         každý další přidá právě jeden nový
🦓 − 🐒 = 2         a ostatní v něm dítě už zná
🐒 + 🐒 = 🦒
🦓 + 🐘 − 🦒 = ?    poslední řádek je otázka
```

**V žádném řádku nikdy nesmí být dvě neznámé.** Soustava dvou rovnic je na 1.–3. třídu moc;
uživatel to výslovně odmítl. Řešitel `solveRiddle()` proto umí jediné pravidlo — dosadit,
co už víme — a hádanku, která tím neprojde, zahazujeme. Zároveň to dává jednoznačnost
řešení: když je každý krok vynucený, jiné řešení neexistuje.

Hodnoty obrázků se nelosují dopředu, protože některé tvary rovnic hodnotu samy určují
(`🍎 + 🍎 = 🍐`). `buildLadder()` proto staví rovnice a hodnoty současně.

**Obtížnost a rozsah jsou dvě nezávislé osy — nepleť je dohromady.**

- **Obtížnost** = jaké tvary rovnic se smí objevit a kolik je v hádance obrázků.
  O velikosti čísel nerozhoduje vůbec; `RIDDLE_LEVELS` proto žádnou mez čísel neobsahuje.
- **Rozsah** („do kolika počítáme", presety 10/15/20/30/50/100) = jak velká čísla vzniknou.
  Je to tvrdý strop na všechno: hodnoty obrázků, součty i výsledek. Největší hodnota
  jednoho obrázku se z něj odvozuje v `riddleMaxValue()`.

Dřív měla každá úroveň vlastní strop (12 / 20 / 30), který uživatelovu volbu přebíjel —
„do 100" na lehké úrovni dělalo čísla do 12. Tohle už tam **nevracej**.

Tvary v `RIDDLE_LEVELS[].shapes`, od nejjednoduššího:

| tvar | příklad | od úrovně |
|---|---|---|
| `num` | `🍉 − 5 = 2` | lehká |
| `sum` | `🍎 + 🍌 = 9` | lehká |
| `symrhs` | `🍍 − 2 = 🍌` | střední |
| `symsum` | `🍎 + 🍎 = 🍐` | těžká |
| `symdiff` | `🍌 − 🥥 = 2` | těžká |

Další pravidla, která hlídají testy:

- Symboly v jedné hádance jsou vždy z jedné tematické sady (`RIDDLE_SETS`) a stejná sada
  se neopakuje čtyřikrát za sebou.
- Žádný obrázek se neodvozuje zbytečně — když se už v dalších rovnicích neobjeví, musí
  být v poslední rovnici (`danglingSymbols()`).
- Průběžný součet zleva nesmí klesnout pod 1 a v poslední rovnici je nejvýš jeden minus.
- Hádanka dá dítěti **jeden pokus navíc** (`RETRY_KINDS`); řešení se ukáže až po druhé chybě.

## Mřížka

Kolečka s čísly, kde platí rovnice vodorovně i svisle. Tři věci, bez kterých to nefunguje:

**Operátor patří mezeře, ne rovnici.** Znaménko mezi prvním a druhým sloupcem platí ve
všech řádcích, znaménko mezi prvním a druhým řádkem ve všech sloupcích.

**Mřížka se staví, ne hádá.** Vylosuje se blok volných čísel vlevo nahoře a poslední
sloupec s řádkem se dopočítají. Roh pak vyjde stejně oběma směry, protože obě cesty
vedou na tutéž dvojnou sumu.

**Rodiny se nesmí míchat.** Násobení se nedá prohodit se sčítáním. Mřížka 5×5
s operátory `+ × +` v obou směrech (samé jedničky a jedna dvojka) dá v rohu **22 po
řádku, ale 24 po sloupci** — dvě různé hodnoty pro totéž kolečko. Mřížka je proto buď
celá sčítací (`+ −`), nebo celá násobící (`× ÷`), nikdy obojí.

Z toho plyne omezení: **násobící mřížka jde jen 3×3**, protože roh je součinem *všech*
volných buněk. U 3×3 jsou čtyři (`3·4·2·4 = 96`), u 4×4 devět — i samé dvojky dají 512,
tedy mimo jakýkoli rozsah, který jde zvolit.

Další pravidla:

- **Obtížnost = velikost** (3×3 / 4×4 / 5×5). Jak velká jsou čísla, řídí výhradně rozsah.
- Volný blok se **nelosuje celý naslepo** (`buildFreeBlock`) — odčítané buňky drží čísla
  dole, takže mřížka se samými minusy by se náhodou skoro nikdy netrefila. Vnitřek se
  vylosuje malý a první řádek se sloupcem se dopočítají tak, aby nic nespadlo pod nulu.
- Strop na jedno číslo se zkouší **odshora dolů** (`SCALES`). Bez toho by „do 100"
  u velké mřížky dávalo jednociferná čísla, protože odhad musí počítat s nejhorším.
- Losuje se **od jedničky**; nula se povolí až když se jinak velká mřížka do těsného
  rozsahu nevejde (5×5 má 16 volných buněk, takže roh nemůže být menší než 16).
- **Jedna mřížka = jedno kolo.** Karta „Kolik příkladů?" se v tomhle režimu schová
  a výsledková obrazovka má vlastní, zkrácenou podobu (`renderGridResult`).
- Odpověď je **řetězec** hodnot skrytých koleček spojený `', '` v pořadí `ex.hidden`.
  Díky tomu funguje `given === ex.answer` v `submit()` beze změny. `ex.op` je `'add'`
  jen jako zástupná hodnota, aby `OPS[ex.op]` nikde nespadlo — proto `tenFrameHTML`
  musí mřížku hned na začátku vyloučit, jinak nakreslí prázdný desítkový rámec.

## Počítej přes 10

```
○○○○○ ○○○○○   ○          kroužky jako nápověda (lehká a střední)
┌───────┐
│   6   │  +  7  =  [13]
│       │    ╱   ╲
│  [4]  │  [4]   [3]
└───────┘
```

Rozklad se **staví, ne hádá**: vylosuje se první číslo, z jeho jednotek plyne, kolik chybí
do desítky (`ten`), a teprve k tomu se dolosuje zbytek. Druhé číslo tak vždycky vyjde
jednociferné a přes desítku se opravdu přejde. Jednotky prvního čísla musí být **aspoň 2** —
při jedničce by do desítky chybělo 9 a druhé číslo by bylo dvojciferné.

### Odčítání přes desítku

Týž zápis jde i opačným směrem (`rollSub()` v `over10.js`):

```
○○○○○ ○○○○   ⊗⊗          odebraná kolečka jsou přeškrtnutá (.tf-gone)
                        ┌──────┐
 16   −   8    =        │ [8]  │   rámeček je vpravo: 10 − 2 = 8
          ╱   ╲         │      │
        [6]   ─────────→│ [2]  │
                        └──────┘
```

`ten` jsou tu **jednotky prvního čísla** (16 − 6 = 10), `rest` se odečte od desítky.
**Rámeček (`.o10b-box`) se u odčítání přesouvá na pravý sloupec** — obepíná ta dvě
čísla, která spolu dají rovnou desítku, tedy výsledek a zbytek. Řídí to
`data-op` na `.o10b` a jediné pravidlo v CSS; uživatel si to takhle vyžádal
podle školní předlohy.
**Od 7. 11. 2026 (přání uživatele):** obě části rozkladu stojí **pod druhým číslem** (8 pod
devítkou, ne pod osmnáctkou), z nich vedou šipky do zápisu (8 → „18 − 8“, 1 → „− 1“) a
z rámečku „18 − 8“ šipka dolů na desítku; výsledek je i na konci prvního řádku zápisu.
**Šipky a výsledek v prvním řádku jsou sjednocené** pro sčítání i odčítání přes 10 a pro
Velké sčítání (střední/těžká). Kreslí je jako SVG podle skutečné polohy prvků `drawArrows()`
v `app.js`, odkud kam říká tabulka `ARROWS` podle atributu `data-arrows` (prvky jsou ve dvou
různých mřížkách, z CSS to nejde). U sčítání přes 10 zůstává doplněk pod prvním číslem v rámečku.
Jednotky musí být **1 až 8**: při nule není co rozkládat, při devítce by na zbytek
nic nezbylo. Rozsah hlídá **první číslo** — u odčítání je to to největší, kdežto
u sčítání je největší výsledek.

**Volba sčítání/odčítání má vlastní klíč `config.over10Ops`** (jen `add`/`sub`,
prázdné spadne na `add`). Do `config.ops` ji **nedávej** — tam patří i × a ÷ pro
režim Počítání a filtrováním by se uživateli rozbilo nastavení běžného počítání.
Karta „Co budeme počítat?" se v tomhle režimu **ukazuje** (na rozdíl od hádanek
a velkého násobení), ale jen se dvěma chipy; `renderConfigScreen()` i posluchač
`#opChips` mají větev podle `isOver10Mode()`. Když jsou zapnuté obě, losuje se
operace u každého příkladu zvlášť (`pick()` v `over10Exercise()`).

Dvě věci, které se snadno rozbijí:

- **Znaménko musí být v `ex.key`**, jinak dedup v `buildOver10Round()` považuje
  `16 + 8` a `16 − 8` za tentýž příklad.
- `tenFrameHTML()` ve vysvětlení odčítání uměl už předtím (`removing`, `tf-gone`),
  ale `over10FrameHTML()` v zadání má vlastní kopii — ta strop počítá z `ex.a`,
  ne z `ex.c`.

Čtyřřádkový zápis rovnic (`= 6 + [4] + [3]` …) tu **byl a nevracej ho** — uživateli
nebyl srozumitelný. Obrázek s větvičkou říká totéž a dítě z něj hned vidí, proč se
druhé číslo dělí zrovna takhle.

**Obtížnost = kolik nápovědy dítě dostane**, ne kolik políček doplňuje ani jak velká
jsou čísla (ta řídí výhradně rozsah). Všechny úrovně mají čtyři políčka
(`OVER10_FIELDS_STEPS` = `ten`, `rest`, `sum`, `c`; `sum` je rovná desítka v zápisu pod
větvičkou — dítě ji doplní samo, přání uživatele). Zápis pod větvičkou je i na těžké. Pořadí je zároveň
pořadím hodnot v odpovědi. Nápovědu řídí `hint` v `OVER10_LEVELS`:

| úroveň | `hint` | co dítě vidí navíc |
|---|---|---|
| lehká | `choices` | kroužky a k tomu klávesnici s pěti čísly na výběr |
| střední | `frame` | jen kroužky |
| těžká | `none` | nic, počítá zpaměti |

Nabídka čísel je **po políčkách** (`over10Choices()` vrací pětici pro každé políčko
v pořadí `ex.hidden`): správné číslo, typické chyby (u odčítání 18 − 9 doplněk 2 místo 8)
a sousedé, seřazené. Klávesnice ukáže pětici pro políčko s kurzorem a po výběru se
přepne na další (`fieldNumbers()`, překreslení ve `focusin` a v `handleKey`). Kytičky
mají dál jednu společnou nabídku.
Tlačítko posílá klíč **`num:13`** a `handleKey()` ho zapíše do políčka **celý naráz** —
ne po číslicích jako běžná klávesnice. Sada se jmenuje `ex.numbers`, ne `choices`:
tak se jmenuje nabídka operací u „Doplň znaménko" a míchat je dohromady by se vymstilo.

**U sčítání je doplněk do desítky pod prvním číslem v rámečku a zbytek přímo pod druhým
číslem** (82 + 9: [8] pod 82, [1] pod 9), ne pod výsledkem — přání uživatele, „součet
musí být 82 + 8“. Políčko zbytku se rozkládá přes sloupce `+`, číslo a `=`, aby nerozšířilo
sloupec druhého čísla. Odčítání zůstává po staru (rámeček kolem výsledku a zbytku).

**Na všech úrovních (od 6. 11. 2026 i na těžké) jsou pod větvičkou dva řádky** (`over10SumHTML()`, podoba podle uživatele):
`[7 + 3] + 1 =` (dvojice v růžovém rámečku jako nahoře) a `10 + 1 = 11`. Jsou to dva
sloupce (mřížka `.o10-sum`): 10 uprostřed pod rámečkem, „+ 1 =“ přesně pod sebou. Píše se jen
rovná desítka (políčko `sum`, vidět hned); ostatní čísla jsou ozvěna políček
(`syncBigaddEcho()`, `data-cell`). Schovávání druhého řádku přes `data-after` zůstalo jen
pro úlohy bez políčka `sum`.

**Mezery kolem `+` / `−` a `=` jsou stejné.** První číslo stojí **uprostřed rámečku**
(uživatel to tak chce) ve sloupci širokém jako políčko pod ním, takže vpravo od něj zbývá
volné místo `--slack` (počítá se z počtu číslic `--ad`). Stejnou mezeru navíc dostanou
i ostatní znaménka. Přisunout číslo doprava se zkoušelo a uživatel ho chtěl zpátky na střed;
záporný okraj znaménka ho zase posadí na okraj rámečku.

Kroužky v zadání kreslí `over10FrameHTML()` v `app.js` (třída `.tenframe-hint`), což je
něco jiného než `tenFrameHTML()` ve vysvětlení po chybě. Nad dvacet se nekreslí,
tolik koleček se na dva řádky nevejde (u sčítání rozhoduje výsledek, u odčítání
první číslo).

Větvička je **mřížka 5 × 3** bez jediného obrázku a bez SVG: šikmé čáry jsou pruh
v `linear-gradient` (CSS vede osu přechodu tak, že pruh padne přesně na úhlopříčku),
rámeček kolem prvního čísla je samostatný prvek přes celý první sloupec. Odsazení nohou
o půl políčka (`margin-left`/`margin-right`) posune spodní konec čáry na střed kolečka.

Pár věcí, které se snadno rozbijí:

- **Do 10 se přes desítku přejít nedá** — nejmenší takový součet je 11. Pod hranicí
  `OVER10_MIN_MAX` (12) se místo tichého porušení rozsahu počítá do 20 a `over10RangeNote()`
  to napíše. Hláška patří pod **„Do kolika počítáme?"**, ne k operacím — u operací se
  v tomhle režimu vybírá jen směr rozkladu. (Platí i pro odčítání: nejmenší takový
  příklad je `12 − 3`.)
- `op` je tu **skutečné sčítání nebo odčítání**, ne zástupná hodnota jako u mřížky.
  Desítkový rámec (`tenFrameHTML`) se proto schválně kreslí a `cross` je natvrdo `true`.
- **`diagnose()` musí tenhle druh vyloučit hned na začátku** jako mřížku — odpovědí je
  řetězec a `Math.abs(given − answer)` by dal `NaN`.
- Rozklad se **neukládá do „k procvičení"** (`NO_REPEAT` ve `stats.js`) — `makeExercise()`
  ho neumí a z descriptoru by se nesložil.
- Ve `stats.js` patří do `levelMode` (rozpad podle obtížnosti, ne podle operací) —
  „sčítání ti jde" by u režimu, kde je sčítání úplně všude, neřeklo nic.
- **Vlastní hodnota po druhé chybě je v toku pod správnou**, ne absolutně umístěná jako
  u mřížky. Políčko rozkladu je nižší než kolečko mřížky a obě čísla by se překryla.

## Velké sčítání

```
   47  +  25
          ╱ ╲              modrá = desítky, oranžová = jednotky
       [20]  [5]

47 + 20 + 5 =        zápis po krocích (střední a těžká), jako na Umíme to
[67] + 5 = [72]      výsledek za rovná se, ne na zvláštním řádku (přání uživatele)
```

Skoky po číselné ose tu byly a uživatel je nahradil zápisem po krocích — nevracet.
**První řádek zápisu („48 − 30“) je v rámečku** (`.ba-pair`) a pod ním drobně
„8 si schováme, počítáme 40 − 30 a pak 8 přidáme zpátky.“ (`bigaddNoteHTML()`, přání uživatele 7. 11. 2026) — dítě
má vidět, že se odčítají jen desítky. Výsledek tam schválně není, ten píše o řádek níž.
Desítky a jednotky v zápisu jsou **ozvěna** políček z větvičky (`syncBigaddEcho()`
v `app.js`); hodnota políčka se mění bez události `input`, proto se volá z `handleKey`,
`partRetry` i `revealParts`.

Sčítání a odčítání dvojciferných čísel do 100 tak, jak se učí ve 2.–3. třídě: druhé
číslo se rozloží na desítky a jednotky a jde se po krocích (nejdřív desítky, pak
jednotky). Pořadí obtížností odpovídá modulu „Sčítání a odčítání do 100“ na
umimematiku.cz. **Lehká jde krok po kroku s výběrem ze dvou možností.** Podoba od
7. 11. 2026 (přání uživatele, `bigaddTaskHTML()` + `bigaddPlanHTML()` v `app.js`):

```
Vypočítej 62 + 35          3 modře, 5 oranžově; pod 35 hotová větvička 30 a 5
Rozepíšeme: [62 + 30] + 5  rámeček kolem dvojice, pod ním „Nejdřív spočítáme čísla v rámečku."
Z 62 si 2 schováme a sečteme jen desítky: 60 + 30 =   (90 / 80)
Schovanou 2 přidáme zpátky: 90 + 2 =                 (92 / 90 - zapomenutá schovaná)
                           → rámeček zezelená: [92] + 5
Ještě zbývá přičíst jednotky: 92 + 5 =               (97 / 96)
```

Dřív byl první krok „Rozdělíme 23 na: 20 a 3 / 2 a 3" a pod zadáním kostičky — uživateli
to na lehkou úroveň přišlo nejasné, kostičky patří k přechodu přes desítku. **Nevracet.**
Poznámka „8 si schováme…" jako zvláštní řádek pod otázkou se taky zkoušela a opakovala
otázku. Je to druh **`bigaddstep`** a jede přes ovladač velkého
násobení (`STEP_KINDS`, `bigTap`, `bigmulHTML`). Na rozdíl od násobení je popisek kroku
**nad** výsledkem — je to začátek věty, ne komentář. **Střední** je obrázek
s větvičkou a psaním, přes desítku napůl; **těžká** totéž, ale vždycky přes desítku.
Rozsah je strop, ale nejvýš 100. **V nastavení jsou jen chipy do 50 a do 100**
(`BIGADD_MAX_PRESETS`); uložený menší rozsah z jiné hry se nemění, jen se ukáže jako
„do 100“ (`bigaddMax`). Hláška o malém rozsahu tam byla a uživatel ji odmítl — nevracet.

- Stejný tvar jako rozklad přes desítku: čtyři políčka `tens, ones, mid, c`
  (`BIGADD_FIELDS`), odpovědí je řetězec hodnot. Řádek v `PART_SEL` má vlastní třídu
  `.ba-input`, vzhled políček je půjčený z rozkladu (`.o10-cell`, `.o10-revealed`).
- **Směr + / − sdílí s „Počítej přes 10“ klíč `config.over10Ops`** (`isAddSubMode()`).
- Obě čísla jsou dvojciferná a nikdy nekončí nulou u prvního čísla — „přes desítku
  po kouscích“ ve vysvětlení by jinak bylo „− 0“.
- Tagy chyb `bigaddSplit` / `bigaddTens` / `bigaddOnes` podle prvního špatného kroku.
- Barvy desítek a jednotek jsou `--pair-task` / `--pair-result` (mimo témata).
- **Nápověda s korunami** (lehká a střední, 7. 11. 2026, `coinsHelpHTML()` v `app.js`): otazník nad
  zadáním, po klepnutí mince (vlastní kresba podobná skutečným, ne fotky — rozhodl uživatel).
  Postup krok po kroku: co máme → odebereme/přidáme desetikoruny → koruny (při nedostatku
  rozměníme desetikorunu) → co zůstane → „Celkem máme …, to je … Kč“. Koruny po pěti pod sebou.
  Slova ve 4. pádě (`tensAcc`/`onesAcc`). Nic nestojí, na odměny nemá vliv. Stav otevření drží
  `coinsOpen` (lehká se po každém kroku překresluje).
## Kytičky

Dvě kytičky na louce, uprostřed každé číslo a čísla na lístcích ho dají dohromady.
**Číslo uprostřed se losuje pro každou kytičku zvlášť a jeho velikost řídí obtížnost**
(`lo`/`hi`/`step` v `KVET_LEVELS`): lehká 30–60 po desítkách, střední 50–100 po desítkách,
těžká 20–100 libovolně. Karta „Do kolika počítáme?" je schovaná. Dřív byl střed vždycky
přesně rozsah a uživateli vadilo, že je pořád 20 (7. 11. 2026) — **nevracet**. Do odměn jde
jako `max` horní mez úrovně. Políčko odpovědi má stejné písmo jako ostatní lístky
(`.kv .kv-input`), jinak by si vzalo velké písmo z `.slot input`. Jeden lístek je prázdný, dítě doplní, kolik chybí. Předlohou byly
čtyřlístky z Umíme to; uživatel chtěl **jiný obrázek, aby to nebylo stejné** — proto
kytička s barevnými lístky, žlutým středem, stonkem a trávou.

- Lehká 3 lístky po desítkách, střední 4 po desítkách — obě s nabídkou šesti čísel
  (`ex.numbers`, klávesa `num:`); těžká 4 lístky s libovolnými čísly a psaní. Po desítkách
  jen při součtu dělitelném deseti a aspoň 40. Nabídka má **vždycky šest tlačítek** — do 40
  po desítkách existují jen čtyři čísla, takže se špatná zopakují (přání uživatele).
  **Nula na lístku ani v nabídce není** (lístek „0“ a „chybí 0“ uživateli vadily, 7. 11. 2026).
- Stejná cesta jako rozklad: jedno políčko na kytičku, `PART_SEL.kvet = '.kv-input'`.
  `op: 'add'` je **jen zástupné** — kytičky proto musí ven z `tenFrameHTML()` a jsou
  v `PLACEHOLDER_OP` ve `stats.js`.
- Lístky se rozmísťují otočením kolem středu a obsah se otáčí zpátky (`--back`).
  **Třesení prázdného lístku je vypnuté** — animace `shake` přepisuje `transform`
  a lístek by uskočil do středu.
- Barvy lístků jsou pevné a světlé i v tmavém režimu, text na nich je vždycky tmavý.
- Výběr čísla z nabídky (`num:`) u všech úloh s víc políčky skočí na další prázdné
  políčko — platí i pro „Počítej přes 10".

## Najdi dvojice

Kartičky s příklady a výsledky (`7+5` ↔ `12`). Dítě klepne na dvě; když k sobě patří,
spojí se, jinak obě zčervenají a jde to zkusit znovu. **Jedna plocha = jedno kolo**,
stejně jako mřížka.

**Kartičky se neotáčejí a všechny jsou vidět od začátku** — uživatel si to takhle
výslovně vyžádal. Původně to bylo pexeso (kartičky lícem dolů), ale trénovat se má
počítání, ne paměť. **Otáčení sem nevracej.** Vnitřní klíč režimu zůstal `pexeso`
(`config.mode`, `ex.kind`, soubor `pexeso.js`), protože je v uloženém nastavení
i v historii kol — mění se jen viditelný název.

**Příklady a výsledky mají každý svou barvu** (`--pair-task` modrá, `--pair-result`
oranžová). Jsou schválně mimo tabulku témat: musí být čitelné ve světlém i tmavém režimu
a rozlišitelné ve všech devíti tématech.

**Co je na kartičkách, řídí karta „Co budeme počítat?"** — v tomhle režimu zůstává
viditelná (na rozdíl od hádanek a rozkladu). Zapnout jen × znamená pexeso na násobilku;
funguje i − a ÷.

**Všechny výsledky na ploše musí být různé.** `7 + 5` i `8 + 4` dají 12; na ploše by pak
byly dvě vizuálně stejné kartičky „12" a dítě by správně spojenou dvojici vidělo jako
chybu. Výsledky se proto **nelosují a pak neověřují**: nejdřív se spočítá množina
výsledků, kterých se dá při zapnutých operacích a daném rozsahu vůbec dosáhnout
(`resultPool`), a teprve z ní se jich potřebný počet vybere. Ke známému výsledku se pak
dolosuje zadání (`buildExample`), takže na jedné ploše můžou být příklady od všech
zapnutých operací.

**Plocha se smí zmenšit.** Do rozsahu „do 5" se deset různých výsledků nevejde a mlčky
porušit rozsah nejde — ubere se tedy dvojice a `pexesoRangeNote()` to dopředu napíše.
Rozhoduje o tom **jediná funkce `pexesoPlan()`**, kterou používá nastavení i generátor;
hláška a skutečná plocha se tím nemůžou rozejít. Rada „zvedni rozsah" se dává jen tehdy,
když opravdu pomůže: samotné dělení dá v násobilce nejvýš devět různých výsledků (2 až 10)
a větší rozsah s tím nehne — tam se musí přidat operace.

**Obtížnost = velikost plochy** (6 / 8 / 10 dvojic, tedy 3×4 / 4×4 / 4×5). Jak velká jsou
čísla, řídí výhradně rozsah.

**Chybou je spojení dvou kartiček, které k sobě nepatří.** Protože jsou všechny vidět,
není to odhad jako u paměťové hry, ale skutečně špatně spočítaný příklad — hranice je
proto přísná: `REWARD_RULES.pexesoMismatchAllowance` = **1 / 1 / 2**. Jedno přehlédnutí
se odpouští, na těžké ploše o deseti dvojicích dvě. **Mění se jen na tom jednom místě**
a návod v popupu se z něj generuje (`howToGet()`).

Pár věcí, které se snadno rozbijí:

- **Ovladač plochy je v `app.js` a společnou cestou `submit()` neprochází.** Po spojení
  poslední dvojice si sám zapíše záznam do `attempts` v témž tvaru jako ostatní úlohy,
  takže `next()`, `finish()`, `recordRound()` i `applyRound()` běží beze změny.
  `given` je počet chybných spojení, ne číslo z políčka.
- **Čtyři místa, která bez ošetření spadnou:** `renderExercise()` nesmí slepě sahat na
  `#answerInput` (v tomhle režimu v DOM není), posluchač `keydown` musí hned odejít
  (Enter by šel do `submit()`), `diagnose()` i `tenFrameHTML()` musí tenhle druh vyloučit
  hned na začátku jako mřížku — `ex.op` je jen zástupné `'add'`.
- **Klávesnice se v tomhle režimu schová** (`#keypad.hidden`), `renderKeypad()` se nevolá.
- **Druhé klepnutí na vybranou kartičku výběr zruší** — dítě si to smí rozmyslet.
- **Text v horní liště je `Dvojice 4×5`, ne „Dvojice · 8 dvojic"** — delší text se na
  320 px do lišty nevejde a roztáhne celou stránku. Ověřeno měřením.
- **Výsledková obrazovka je vlastní** (`renderPexesoResult`), protože prstenec s procenty
  nad jedinou úlohou nic neřekne. **Pozor na formulaci:** plocha se vždycky nakonec
  dohraje, takže „nevyšlo" tam neznamená nevyřešeno, ale „s moc chybnými spojeními".
- **Zadání je na kartičce bez mezer** (`7+5`, `100÷10`) — s mezerami se na 320 px
  do kartičky nevejde ani při nejmenším písmu. Ve vysvětlení po chybě mezery má.
- `<button>` **nedědí barvu textu**, takže si ji kartička nastavuje sama.

## Velké násobení

```
Vypočítej 85 × 5
  80 × 5 + 5 × 5        ← vybráno, zelený řádek
Rozdělíme si to.
  400 + 25
Roznásobíme.
  425
Sečteme.
```

Zápis roste shora dolů a v každém ze **tří kroků** dítě vybírá ze **dvou možností**.
Netrénuje se výsledek, ale rozklad na desítky a jednotky — tedy proč se velké
násobení dá spočítat zpaměti. Dítě nic nepíše, jen rozhoduje.

**Rozkládá se víceciferný činitel; když jsou víceciferní oba, rozkládá se druhý.**
Jedno pravidlo, dá se dítěti vysvětlit jednou větou:

| úroveň | tvar | příklad | rozklad | `minMax` |
|---|---|---|---|---|
| lehká | 2cif × 1cif | `85 × 5` | `80 × 5 + 5 × 5` | 100 |
| střední | 3cif × 1cif | `238 × 4` | `200 × 4 + 30 × 4 + 8 × 4` | 500 |
| těžká | 2cif × 2cif | `24 × 13` | `24 × 10 + 24 × 3` | 200 |

**Obtížnost = velikost činitelů, rozsah = tvrdý strop na výsledek.** Dvě nezávislé osy
jako všude jinde. Pod `minMax` by nevyšel jediný příklad, takže se počítá do minima
a `bigmulRangeNote()` to **napíše nahlas** — stejná pojistka jako `over10RangeNote()`.
Hláška patří pod **„Do kolika počítáme?"**, ne k operacím: karta s operacemi je
v tomhle režimu schovaná.

**Špatná možnost není náhodná — je to typická chyba.** Jinak by se dala poznat od oka,
aniž by dítě cokoli počítalo:

| krok | popisek | správně (`85 × 5`) | špatně | typická chyba |
|---|---|---|---|---|
| 1 | `Rozdělíme si to.` | `80 × 5 + 5 × 5` | `80 × 5 + 5 × 1` | v posledním členu se ztratí činitel |
| 2 | `Roznásobíme.` | `400 + 25` | `40 + 25` | v prvním součinu se ztratí nula |
| 3 | `Sečteme.` | `425` | `452` | prohozené číslice v druhém sčítanci |

Pár věcí, které se snadno rozbijí:

- **Pořadí obou tlačítek se losuje** a je uložené v `step.options`, ne dolosované při
  vykreslení. Zápis se po každém kroku překresluje celý, takže by se možnosti při
  každém překreslení přeházely.
- **Jednotky druhého činitele u těžké úrovně musí být aspoň 2.** Špatná možnost v prvním
  kroku nahrazuje jednotky jedničkou — při `b = 21` by vyšla stejně jako správná.
  Z téhož důvodu mají u střední úrovně **všechny tři číslice být 1 až 9**: nula by
  dala nesmyslný člen `0 × 4`.
- **Žádné číslo nesmí přerůst rozsah, ani to špatné.** Špatný součet se proto hledá
  ze seznamu záložních hodnot (prohozené číslice → `+10` → `−10` → `−1`) a bere se
  první, která je kladná, liší se od správné a do stropu se vejde.
- `op: 'mul'` je tu **poctivé násobení**, ne zástupná hodnota jako u mřížky — nemusí se
  tedy nikde z aritmetiky vylučovat. `tenFrameHTML()` u něj vrací prázdno samo od sebe
  (`relation` vyjde `null`), nový řádek tam nepatří.
- **Ovladač je v `app.js` (`bigTap`) a společnou cestou `submit()` neprochází.** Po
  posledním kroku si sám zapíše záznam do `attempts` v témž tvaru jako ostatní úlohy;
  `given` je text první špatně zvolené možnosti, `tag` je tag toho kroku.
- **Do `RETRY_KINDS`, `RETRY_NOTE`, `FIELD_SEL`, `PART_SEL` ani `REVEAL_CLASS` tenhle
  druh nepatří** — ty cesty počítají s políčkem na odpověď. Druhý pokus se řeší uvnitř
  kroku: špatné tlačítko zčervená a **zůstane nefunkční**, dítě musí klepnout na to druhé.
- **Klávesnice se v tomhle režimu schová** (`#keypad.hidden`), `renderKeypad()` se nevolá,
  a posluchač `keydown` musí hned odejít — Enter by šel do `submit()` a spadl na
  chybějícím `#answerInput`. Klávesy `1` a `2` vyberou možnost.
- **Stav zápisu (`bigStep`) se nuluje ještě před vykreslením těla úlohy**, jinak by nová
  úloha začala s krokem od předchozí.
- Rozklad se **neukládá do „k procvičení"** (`NO_REPEAT` ve `stats.js`) — z descriptoru
  by se nesložil. Ve `stats.js` patří do `levelMode`: násobení je tu všude, takže
  „násobení ti jde" by neřeklo nic.
- **Křížek je tentýž jako všude jinde** (`OPS.mul.symbol`), jen se do `bigmul.js` nedá
  naimportovat — `generator.js` si tenhle soubor importuje a byl by z toho kruh.
  Tečka `·` z předlohy se zkoušela a uživatel ji zamítl: dítě má vidět pořád týž znak.
- **Plus je odsazené od členů, křížek ne.** Uvnitř členu je úzká mezera `U+2009`
  (`100 × 2`), mezi členy obyčejná; `word-spacing: .45em` na `.bm-value` a `.bm-opt`
  pak roztáhne jedině tu obyčejnou. Kdyby byly všude obyčejné mezery, odsadil by se
  i křížek od svých čísel. Nejdelší možný zápis (`900 × 9 + 90 × 9 + 9 × 9`) měří
  na 320 px **192 px** proti 243 px místa v tlačítku — rezerva tam je, ale
  při dalším zvětšování mezer si to znovu změř.

## Abeceda

První hra mimo matematiku. Kartičky se slovy se přetahují do očíslovaných okének
tak, aby šla slova podle abecedy. **Jedna plocha = jedno kolo**, stejně jako mřížka.

**Pravidla přesunu si vyžádal uživatel a jsou to čisté funkce v `abc.js`** (testuje je
`tests/abc.test.mjs`):

- puštění **na** okénko = výměna, původní slovo spadne dolů mezi ostatní,
- puštění **mezi** okénka (levá/pravá čtvrtina okénka nebo mezera) = vsunutí; další slova se
  posunou o jedno dál až k nejbližšímu volnému okénku, a když volné není, poslední spadne dolů,
- okénka jsou po řádcích a „mezi" platí i přes konec řádku (za 4 = před 5),
- místo tažení jde i klepnout na kartičku a pak na okénko.

**Pořadí řadí `Intl.Collator('cs')`** — zná CH za H i č/ř/š/ž jako samostatná písmena.
Vlastní řazení nepiš. Plocha, kde by dvě slova byla stejná v základním porovnání
(liší se jen čárkou), se zahodí.

**Obtížnost = záludnost slov, počet slov se volí zvlášť** (`config.abcCount`, 10/20,
vlastní klíč — `config.count` patří příkladům). Lehká: každé slovo jiným písmenem, bez pastí.
Střední: aspoň čtvrtina slov sdílí první písmeno, rozhoduje druhé. Těžká: navíc pasti
c/č, r/ř, s/š, z/ž, h/ch. Různých prvních písmen bez pastí je jen 21 (`ABC_SAFE_LETTERS`),
takže lehká u 25 slov musí opakovat — `abcCountNote()` to napíše pod počet.

**Sloupce (3–5) a písmo počítá `fitAbc()` z nejdelšího slova a skutečné šířky**, ne generátor.
Slova mají nejvýš 8 písmen, jinak by se na 320 px nevešla ani do tří sloupců.

Pár věcí, které se snadno rozbijí:

- Ovladač je v `app.js` a `submit()` neprochází, záznam do `attempts` zapíše `finishAbc()`
  (`given` = počet špatných okének). První Hotovo s chybou jen označí okénka červeně,
  druhé ukáže správné pořadí; oprava napodruhé se počítá jako správně (jako u mřížky).
- Kartičky mají `touch-action: none`, jinak prst posouvá stránku místo kartičky. U okraje
  obrazovky se při tažení stránka sama posune (25 slov se na telefon nevejde).
- Po tažení prohlížeč pošle ještě `click` — `abcNoClick` ho zahodí.
- Do odměn jde `max: 0` — rozsah čísel by abecedě jinak přidával epického.
- Text v liště je `25 slov`; `Abeceda · 12` už na 320 px přeteklo (změřeno).
- Okénko má `min-height`, ne pevnou `height` — kartička je vyšší o padding a rámeček
  a při pevné výšce zakryla spodní okraj (zelený/červený rámeček chyběl dole).

## Slovní druhy

Druhá hra pod záložkou Čeština (`config.mode` = `pos`). Ukáže se věta a dítě v ní klepne
na **všechna slovesa**, nebo na **všechna podstatná jména**, a dá Hotovo. Předlohou byly
„Rozbory – určování sloves / podstatných jmen" na umimecesky.cz. **Co věta, to úloha**
(na rozdíl od abecedy) — kolo má 10 / 20 / 30 vět (`config.posCount`, vlastní klíč).

**Věty jsou ručně sepsané a ručně určené** v `pos.js` (asi 60 na každou úroveň). Uživatel
zvolil tuhle cestu místo skládání vět ze šablon (kostrbatá čeština) i místo jazykového
nástroje (běží na serveru a plete se). Zápis: `'*Kočka ^pije *mléko.'` — `*` podstatné
jméno, `^` sloveso. Každá věta má určené **oba** druhy, aby šla použít na kterýkoli.

Při doplňování vět **se vyhni** tomu, o čem by se dalo s učitelkou přít: zvratným
slovesům (`se`, `si`), minulému času v 1. a 2. osobě (`jsem šla`), podmiňovacímu způsobu
(`by`) a slovům, která jsou podle věty podstatné jméno i příslovce (`ráno`, `večer`,
`doma`). **Složené tvary mají slovesa obě slova** (`chce jít`, `budeme stavět`).

**Co se hledá, vybírá karta „Co budeme hledat?"** — je to karta s operacemi (`#card-ops`)
s jiným nadpisem a chipy z `POS_TYPES`. Hodnota je ve vlastním klíči `config.posTypes`,
**do `config.ops` nepatří** (stejný důvod jako u `over10Ops`). Když jsou zapnuté oba druhy,
rozdělí se věty v kole půl na půl a zamíchají; nad větou je barevně napsané, co hledat.

**Obtížnost = záludnost slov:** lehká krátké věty v přítomném čase, střední delší věty
a minulý čas, těžká pasti (neurčitek, `bude` + neurčitek, podstatná jména činnosti jako
`plavání` a `zpěv`, a `ráda`, které sloveso není).

Pár věcí, které se snadno rozbijí:

- Ovladač je v `app.js` (`posTap` / `posSubmit` / `finishPos`) a `submit()` neprochází.
  První Hotovo s chybou jen obarví červeně slova navíc a napíše, jestli nějaké chybí;
  druhé ukáže řešení (zelená = správně, přerušovaný rámeček = přehlédnuté, červená = navíc).
  Oprava napodruhé se počítá jako správně, stejně jako u abecedy.
- **Označí-li přesně všechna slova opačného druhu** (místo sloves všechna podstatná
  jména), jednou za větu dostane jen upozornění „Našla jsi správně … – jenže tady hledáme
  …", označení se smaže a nadpis zatřese. Opravu to nespotřebuje a chybou to není —
  uživatel si to tak vyžádal, druhy přece poznala.
- `ex.missing` nese hledaný druh (`noun` / `verb`), takže `KIND_LABEL` ve `stats.js` má
  klíče `pos:noun` a `pos:verb` a výsledek umí říct „Nejvíc chyb máš u sloves".
- Tag chyby počítá `posTag()`: `posSwap` (vybrala druhý druh), `posExtra`, `posMissed`.
- Do odměn jde `max: 0` jako u abecedy; čas jsou 2 běžné příklady na větu
  (`speedKindMultiplier.pos`).
- Klávesnice se schová, Enter potvrdí Hotovo.

## Druhy vět

Třetí hra pod záložkou Čeština (`config.mode` = `vety`). Tři úlohy (třetí je list
„Označ písmenem", viz níž), vybírají se na kartě s operacemi (nadpis „Co budeme dělat?",
vlastní klíč `config.vetyTasks`, **do `config.ops` nepatří**); když jsou zapnuté první
dvě, kolo se rozdělí půl na půl. Počet vět 10 / 20 / 30
(`config.vetyCount`). Co věta, to úloha.

- **Urči druh věty** (`task: 'type'`) — čtyři školní druhy: oznamovací, tázací,
  rozkazovací, přací. **Zvolací tam není**, uživatel zvolil čtyři. Tlačítka mají pevné
  pořadí, druhy se v kole rozdělí rovnoměrně.
- **Udělej otázku** (`task: 'ask'`) — oznamovací věta a hotové věty na výběr. Uživatel
  zvolil **výběr**, ne skládání ze slov ani psaní. Špatné možnosti jsou typické chyby
  (`ASK_WRONG`): zapomenutý otazník (`vetyMark`), rozkaz (`vetyType`), otázka na něco
  jiného (`vetyChange`). Lehká má 3 možnosti, střední 3 záludnější, těžká 4.

**Věty jsou ručně sepsané** v `vety.js`. Řádek `ASK` je čtveřice
`oznamovací | tázací | rozkazovací | otázka na něco jiného` a slouží oběma úlohám;
`base` hlídá, aby v jednom kole nepadla dvě věty z téže čtveřice. Přací věty, otázky
s tázacím slovem a pasti těžké úrovně jsou v `EXTRA` (za `|` je poznámka do vysvětlení).

Na co si dát při doplňování pozor:

- **„Petr jde domů?" je taky správná otázka** (jen otazník, slova stejně). Mezi špatné
  možnosti proto nesmí přijít nic, co končí otazníkem a říká totéž.
- **„Ať" + třetí osoba je rozkaz** („Ať přijde!"). Přací věta s `Ať` / `Kéž` jen tam, kde
  jde o přání, které rozkazem splnit nejde („Ať se ti daří!").
- „Přeju ti hodně zdraví." a „Chtěla bych, aby…" tam schválně nejsou — učebnice je řadí
  různě.

Pár věcí, které se snadno rozbijí:

- Ovladač je v `app.js` (`vetyHTML` / `vetyTap`), `submit()` neprochází. **Jedno klepnutí
  rozhoduje**, druhý pokus není — ze dvou až čtyř možností by to bylo tipování. Po chybě
  zčervená zvolená možnost, zezelená správná a pod tím je vysvětlení.
- Pořadí možností u otázky se losuje **v generátoru** (`ex.options`), ne při vykreslení —
  po klepnutí se plocha překresluje.
- U druhu věty je `ex.answer` i `given` **klíč** (`ozn`); `asShown()` ve `stats.js` ho
  do výpisu chyb přeloží na název.
- Klávesnice se schová, klávesy `1` až `4` vyberou možnost.
- Do odměn jde `max: 0` jako u ostatní češtiny; čas jsou 2 běžné příklady na větu
  (`speedKindMultiplier.vety`).

### Označ písmenem (třetí úloha, `task: 'list'`)

Podle školního listu: 10 vět pod sebou (`VETY_LIST_SIZE`), u každé okénko. **Dítě písmeno
nevybírá z nabídky — klepáním na okénko se střídá O → T → R → P** (`VETY_LETTERS`), uživatel
si to tak vyžádal. Hotovo jde až s vyplněnými všemi okénky, první Hotovo s chybou jen
obarví špatná okénka, druhé ukáže řešení (oprava napodruhé se počítá jako správně).

- **Druh se losuje u každé věty zvlášť, ne rovnoměrně** — uživatel nechtěl, aby na listu
  byly vždycky všechny čtyři druhy (poslední by se dal dopočítat). `spread()` sem nepatří.
- Vlastní druh **`ex.kind = 'vetylist'`**; list je v kole nejvýš jeden a stojí na začátku
  (jako plocha ve „Význam slov"). Se samotným listem je kolo jediná úloha a karta
  s počtem se schová (`isVetyBoardOnly()`).
- Ovladač je společný s „Doplň u, ú, ů" (`FILL`, `fillTap`, `finishFill` v `app.js`).
- Čas se počítá **za každou větu** (`speedPerUnitKinds`, počet vět posílá `kindUnits`).

## Doplň u, ú, ů (téma Pravopisu)

**Od 7. 11. 2026 není samostatná hra, ale téma `uu` v Pravopisu** (dohoda s uživatelem).
Uložené nastavení s `mode: 'uu'` převede `normalizeConfig()` na Pravopis jen s tímhle
tématem a se stejným počtem. Lehká = slova (`UU_WORDS`), střední = krátké věty,
těžká = delší věty a pasti. `parseUuPrav()` v `pravopis.js` převede mezery na tvar
pravopisu (`opts` u/ú/ů, u velkého písmene U/Ú/Ů). Předlohou cvičení „Doplň u, ú, ů" ze sešitu.

**Slova a věty jsou ručně sepsané** v `uu.js`, doplňované písmeno je v hranatých závorkách:
`'Ve vlak[u] [u]kaž pr[ů]kazk[u].'`. Velké písmeno (`[Ú]stí`) se doplňuje velké.
`+` označí složené slovo (`ne+[ú]roda`) — nevypisuje se, jen z něj vysvětlení udělá
„ne + úroda". Ú uprostřed slova bez `+` je výjimka (`t[ú]ra`, `sk[ú]tr`). Druh pravidla
(`short` / `start` / `ring` / `join` / `except`) si `parseUu()` odvodí sám.

Při doplňování vět hlídej, **aby šlo doplnit jen jedno písmeno** („u domu" × „jdu domů")
a aby slovo bylo opravdu s u (stádo **koz**, ne kůz; kamz**í**ky).

Tagy chyb: `uuStart` (začátek slova), `uuMark` (ú × ů), `uuLength` (krátké × dlouhé).

## Pravopis

Pátá hra pod záložkou Čeština (`config.mode` = `prav`, `ex.kind` = `prav`), předlohou byly
doplňovačky z umimecesky.cz pro 2. třídu. Ovladač je `FILL.prav`, `uuHTML`, `fillTap`;
**klávesy určuje vybraná mezera** (`gap.opts`):
i/y nebo í/ý, u/ú/ů, e/ě, ě/je, mě/mně, dvojice párových souhlásek, malé/velké písmeno.
U, ú, ů je jedno z témat (viz výš), samostatná hra už není.

Témata na kartě „Co budeme procvičovat?" (`config.pravTopics`, **do `config.ops` nepatří**),
počet 10 / 20 / 30 (`config.pravCount`): `iy` tvrdé a měkké souhlásky (vč. dy-ty-ny × di-ti-ni),
`dtn` dě/tě/ně, `bpvm` bě/pě/vě/mě (je u předpon ob-/v-, mně u příbuzného slova s mn),
`par` párové souhlásky, `velka` velká písmena. Když je zapnutých víc, rozdělí se kolo rovnoměrně
a nad slovem je napsané, co se doplňuje. `ex.missing` nese téma (`KIND_LABEL` `prav:iy` …),
tag chyby je podle tématu první špatné mezery (`pravIY`, `pravDTN`, `pravBPV`, `pravPar`, `pravVelka`).

**Obtížnost:** lehká = jednotlivá slova (přání uživatele, jako umimecesky), střední krátké věty,
těžká delší věty s víc mezerami a pastmi (párové uprostřed slova, dny a měsíce malým, Ústí nad Labem).

**Slova a věty jsou ručně sepsané** v `pravopis.js`, zápis `'du[b|duby]'` — za `|` je poznámka
do vysvětlení (u párových povinně slovo, kde je souhláska slyšet; u velkých písmen důvod
`jmeno`/`zvire`/`mesto`/`reka`/`hora`/`stat`/`hrad`/`svatek`, u malých `cas`). Při doplňování:
i/y **jen po tvrdých a měkkých souhláskách** — po obojetných jsou to vyjmenovaná slova (3. třída,
další várka); žádná přejatá slova (kino); velká písmena bez slov, která jsou jménem i obyčejným
slovem. **Každé slovo si ověř ve slovníku** — v první verzi bylo „věčer“ (správně večer bez ě)
a kontrolní skript to nechytí, hlídá jen tvar zápisu. **Pozor:** uživatel měl v zadání tvrdé a měkké souhlásky prohozené — tvrdé jsou h, ch, k,
r, d, t, n, měkké ž, š, č, ř, c, j, ď, ť, ň.

## Třída v rohu karty

Každá hra matematiky a češtiny má v `MODES` pole `grade` (1–3) a karta ho ukazuje jako kolečko
vpravo nahoře (`gradeHTML()`, `.chip-grade`) — přání uživatele, „co je pro druhou třídu, dej 2".
Témata pravopisu mají `grade` taky (`PRAV_TOPICS`), aby šla přidat témata pro 3. třídu
(vyjmenovaná slova, předpony s-/z-/vz-). Hudba třídu nemá.

## Význam slov

Čtvrtá hra pod záložkou Čeština (`config.mode` = `vyznam`), předlohou byla cvičení
na umimecesky.cz. Tři úlohy na kartě „Co budeme dělat?" (`config.vyznamTasks`,
**do `config.ops` nepatří**), počet 10 / 20 / 30 (`config.vyznamCount`):

- **Doplň vztah** (`vztah`) — „Slovo **savec** je ___ slovu **zvíře**." a tlačítka se
  vztahy ve středním rodě (souznačné, protikladné, nadřazené, podřazené, souřadné,
  souzvučné). **Kolik tlačítek, řídí obtížnost** (`VYZNAM_LEVEL_RELS`): lehká jen
  souznačné/protikladné, střední + nad-/pod-/souřadné, těžká + souzvučné. Souzvučná
  slova mají pod sebou nápovědu významu (`zámek` 🏰 hrad / 🔒 na dveřích), jinak by
  obě slova vypadala stejně.
- **Spoj souřadná** (`spoj`) — plocha 12 slov, spojují se do 6 dvojic. Má vlastní druh
  **`ex.kind = 'slova'`** a jede přes ovladač „Najdi dvojice" (`PAIR_BOARDS` v `app.js`),
  včetně `pexesoMismatchAllowance`. **V kole je nejvýš jedna plocha a stojí na začátku**;
  když je zapnuté jen spojování, je kolo jediná plocha a karta s počtem se schová.
- **Najdi nadřazené** (`nad`) — čtyři slova a tři možnosti: správná skupina (`měsíce`),
  **souřadné slovo** z téže skupiny (`červen`, tag `vyznamSour`) a jiná skupina
  (na těžké blízká: `dny`). Uživatel zvolil **výběr, ne psaní**.

Vztah i nadřazené slovo jdou přes společný ovladač s druhy vět (`choiceTap`,
`CHOICE_HTML`): jedno klepnutí rozhoduje, klávesy 1–6. U vztahu je `given` klíč
(`pod`), `asShown()` ve `stats.js` ho přeloží na název.

**Slova jsou ručně sepsaná** v `vyznam.js`. Při doplňování:

- **Skupiny v `CATS` se nesmí překrývat ani být jedna v druhé** — žádná „zvířata" vedle
  „ptáků". Jinak by špatná možnost u „Najdi nadřazené" byla taky správně a na ploše
  by šlo slovo spojit se dvěma. Proto tam „zvířata" ani „obuv" (× oblečení) nejsou.
- Slovo na plochu má **nejvýš 9 písmen**, víc se na 320 px do kartičky nevejde.
- Žádné sporné dvojice (ráno – večer, teplý – horký). Slova mnohoznačná, která učebnice
  neřadí mezi souzvučná (`jazyk`), do `HOM` nepatří.
- Skupina má aspoň 5 slov (4 v řadě + 1 souřadné jako špatná možnost).

## Hudební nauka

Jediná hra pod záložkou Hudba (`config.mode` = `hudba`, `ex.kind` = `hudba`). Předlohou
byly musictheory.net (poznej notu / umísti notu) a sešity ZUŠ pro 1. ročník (doplň takt,
najdi chybný takt). Pět úloh na kartě „Co budeme dělat?" (`config.hudbaTasks`,
**do `config.ops` nepatří**), počet 10 / 20 / 30 (`config.hudbaCount`):

| `task` | úloha | ovládání |
|---|---|---|
| `znak` | Co je to? — osnova, klíče, noty a pomlky celá–šestnáctinová (šestnáctinové až od střední); obrázek → název, nebo naopak | výběr |
| `nazev` | Poznej notu — tlačítka c d e f g a h | výběr |
| `umisti` | Umísti notu — klepnutí na linku/mezeru, **jediná s druhým pokusem** (`ex.retry`) | pruhy v SVG |
| `vyska` | Která nota je vyšší/nižší — klepe se přímo na notu | výběr |
| `takt` | podtyp `form`: `doby` (kolik dob), `dopln` (která pomlka doplní takt), `chyba` (který ze tří taktů nesedí) | výběr |

**Obtížnost = osnova a takt** (rozhodl uživatel): lehká houslová + 4/4, střední basová + 3/4,
těžká obě osnovy najednou (velká osnova) + oba takty. Rozsah: houslová c1–g2, basová G–c1.
**Názvy not jen písmeny** — oktávy se netrénují, proto je u „Umísti notu" správně
každé místo s tím písmenem (i na obou osnovách).

**Kreslí se vlastním SVG** (`notace.js`), žádná knihovna ani notové písmo (rozhodl uživatel).
Barva je všude `currentColor`, nese ji CSS. Klíče jsou ručně kreslené cesty. Výška noty je
celé číslo `d` (c1 = 28), krok na osnově `step` od spodní linky — žádné zlomky.

Pár věcí, které se snadno rozbijí:

- **Žádná desetinná čísla:** osminové noty jsou v taktech jen ve dvojici s trámcem
  (`n:eighth2` = 1 doba), osminová pomlka se v taktech nepoužívá. Celá nota/pomlka jen
  jako jediná věc v taktu 4/4.
- **Tečkovaná půlová** (`n:dhalf`, 3 doby) jen na **těžké** úrovni: v taktech 3/4, v „Kolik
  dob" a v „Co je to?". Uživatel ji chtěl do stávající těžké, ne do nové čtvrté úrovně.
  Tečka se kreslí vždy do mezery.
- Celá a půlová pomlka se liší **jen polohou** (visí pod 4. linkou × sedí na 3.), proto
  se značky kreslí na kousku osnovy. Osnova je mezi špatnými možnostmi jen u klíčů,
  jinak by „notová osnova" byla taky pravda.
- Všechno jede přes `choiceTap()` (`CHOICE_HTML.hudba`); obrázkové možnosti, noty
  i pruhy v osnově mají třídu `vt-opt` a `data-i`. Druhý pokus drží `choiceMiss`.
- Linky a mezery se v textech počítají **zdola** (jak se učí ve škole).
- Klávesy 1–7 vyberou možnost, kromě „Umísti notu".
- Do odměn jde `max: 0` jako u češtiny, čas 2 běžné příklady na úlohu.

## Klavír

Druhá hra pod záložkou Hudba (`config.mode` = `klavir`). Uživatel ji chtěl **jako samostatnou
hru vedle Hudební nauky**, ne jako její úlohu. Úlohy ale generuje `hudba.js` (`makeKlavirRound()`)
a jedou stejnou cestou: `ex.kind = 'hudba'`, `ex.task = 'klavir'`, směr v `ex.form`. Směry jsou
na kartě „Co budeme dělat?" (`config.klavirForms`), počet `config.klavirCount`:

- `naklavir` — nota na osnově (i s ♯ / ♭), dítě klepne na klávesu.
- `naosnovu` — na klávesnici svítí klávesa, dítě vybere **bez / ♯ / ♭** a klepne na linku
  nebo mezeru. Možnost je dvojice místo + posuvka; správně je všechno, co zní jako klávesa
  (fis i ges, e na první lince i ve čtvrté mezeře).

Klávesnice má jednu oktávu **c až c** (8 bílých, 5 černých); oktáva se netrénuje, u c platí obě
krajní. Obtížnost: lehká houslová a jen křížky, střední basová s křížky i béčky, těžká obě osnovy.

- **České názvy:** -is / -es, ale `es`, `as` a `b` (= h s béčkem). Zápisy, které padnou na bílou
  klávesu (eis, his, ces, fes), se nepoužívají.
- Svítící klávesa nemá třídu `vt-opt` (`pianoSVG({ tap: false })`), jinak by ji `choiceTap()`
  vzal jako odpověď. Volbu posuvky drží `hudbaAcc` v `app.js`.
- Druhý pokus v obou směrech (`ex.retry`).
- Tři tlačítka posuvek jsou mřížka 3 × `minmax(0, 1fr)` s krátkými popisky — „bez posuvky"
  v volném řazení přeteklo na 320 px z karty.

## Sluch

Třetí hra pod záložkou Hudba (`config.mode` = `sluch`), stejný tvar jako Klavír:
`ex.kind = 'hudba'`, `ex.task = 'sluch'`, úloha v `ex.form`, generátor `makeSluchRound()`
v `hudba.js`. Úlohy (`config.sluchForms`, počet `config.sluchCount`):

- `vyssi` — dva tóny, druhý je vyšší / nižší / stejný (stejný zhruba v 20 %).
- `odc` — zazní c, pak jiný tón, dítě klepne na klávesu (druhý pokus).
- `melodie` — 2 tóny (lehká) nebo 3, dítě je zahraje po klávesách (`melodyTap()`, druhý pokus).
- `nota` — zazní c a tón, na jedné houslové osnově (klíč na začátku) stojí všech osm not c až vysoké c bez posuvek, dítě klepne na tu, která zazněla.

**Hledaný tón se vždycky ohlašuje kotvou c** — absolutní sluch nemá skoro nikdo. Obtížnost:
lehká velké skoky a jen bílé klávesy, střední menší skoky a melodie ze tří tónů, těžká i černé
klávesy a tóny těsně vedle sebe.

- **Zvuk je syntéza v prohlížeči** (`zvuk.js`, Web Audio), rozhodl uživatel; žádné nahrávky.
  Tóny jsou čísla MIDI, klávesnice c1 = 60 až c2 = 72 (`PIANO_KEYS[].midi`).
- Tóny hrají **i při vypnutém „Zvuku"** — ten patří efektům, bez tónů by hra nešla.
- Úloha zahraje sama po zobrazení; tlačítko 🔊 (`.hd-play`) funguje i po odpovědi.
- Horní c se ve vysvětlení jmenuje **„vysoké c"** (`toneName()`), jinak by „c" bylo dvojznačné.
- Klávesy zahrají tón při klepnutí i ve hře Klavír.

## Geometrie

Hra pod Matematikou pro 2. třídu (`config.mode` = `geom`, `ex.kind` = `geom`), přidaná
9. 11. 2026. Stejný tvar jako Hudební nauka: ovladač s výběrem (`CHOICE_HTML.geom`,
`choiceTap`), jedno klepnutí rozhoduje, druhý pokus není. Úlohy (`config.geomTasks`,
**do `config.ops` nepatří**), počet 10 / 20 / 30 (`config.geomCount`):

- `utvar` Poznej útvar — obrázek → název (čtverec, obdélník, trojúhelník, kruh, kružnice,
  pětiúhelník, šestiúhelník, krychle, kvádr, koule, válec, kužel, jehlan),
- `najdi` Najdi obrázek — „Kde je kružnice?“ a 3–4 obrázky,
- `cary` Čáry — bod, úsečka, přímka, polopřímka, lomená, křivá; jednou obrázek → název, jindy naopak,
- `kolem` Tělesa kolem nás — věc jako emoji s popiskem (míč, plechovka…) → těleso.
  Jen věci bez sporu: jehlan tam není (pyramida nemá emoji), krabice taky ne (krychle i kvádr).

**Obtížnost = záludnost** (rozhodl uživatel): lehká 3 možnosti z téže rodiny (útvary s útvary,
tělesa s tělesy) a bez záludných dvojic z `TRAP`, rovné obrázky; střední 4 náhodné možnosti,
natočené a různě velké obrázky; těžká dává záludné dvojice přednostně (čtverec × obdélník
× krychle, kruh × kružnice × koule, přímka × polopřímka × úsečka, míč × kruh).

- **Parametry obrázku (`fig`) losuje generátor**, kreslení nic nelosuje — plocha se po
  klepnutí překresluje a obrázek nesmí poskočit.
- **Bod se značí křížkem**, ne tečkou (přání uživatele) — i na konci úsečky a na začátku polopřímky.
- Kruh je plocha (výplň), kružnice jen čára. Tělesa ve volném promítání, neviditelné hrany
  čárkovaně. Konec přímky a polopřímky, který pokračuje dál, je **řada teček** (`.geo-tail`);
  malé tečky byly na telefonu nečitelné, proto jsou tlusté.
- Plochy jsou průhledně modré a čáry `currentColor` — sedí ve světlém i tmavém režimu.
- `op: 'add'` je jen zástupné (`PLACEHOLDER_OP`, `NO_REPEAT`, `levelMode` ve `stats.js`).
- Tagy chyb `geomPlocha` (útvar × těleso), `geomCtyr`, `geomKruh`, `geomKonce`, `geomTeleso`,
  `geomUtvar`, `geomCara`. Do odměn `max: 0`, čas 1 běžný příklad na úlohu.

## Doplň znaménko

`7 __ 3 = 10`. Nabídka tlačítek je přesně ta sada operací, kterou má uživatel zapnutou,
a **proti téhle sadě se hlídá jednoznačnost** — `2 __ 2 = 4` sedí na `+` i `×`, takže
takový příklad se zahodí. Druh proto potřebuje aspoň dvě operace (`minOps: 2`).
Odpovědí je klíč operace (`'add'`), ne číslo; `submit()` na to má větev.

## Větší/menší

`12 __ 9`, dítě vybírá `<`, `>` nebo `=`. Druh úlohy navíc v režimu Počítání
(`kind: 'compare'`), ne samostatný režim.

Odpovědí je klíč znaménka (`'lt'`), ne číslo — stejný princip jako u „Doplň znaménko“,
kde odpovědí je klíč operace. Znaménka jsou ve vlastní tabulce **`COMPARES`, ne v `OPS`** —
nejsou to operace, nic se jimi nepočítá. Na klávesnici mají vlastní prefix `cmp:`, aby se
v `handleKey()` poznalo, ze které tabulky se bere symbol.

Tři věci, které se snadno rozbijí:

- **`op: 'add'` je jen zástupná hodnota**, aby `OPS[ex.op]` nikde nespadlo. Proto musí
  porovnávání vypadnout z `tenFrameHTML()` (desítkový rámec) a ve `stats.js` z rozpadu
  podle operací i z „přechodu přes desítku“ (proměnná `scored`). Jinak by „sčítání ti jde“
  stálo z poloviny na úlohách, kde se nic nesčítá.
- **`focusAllowed()` v `generator.js`** má pro porovnávání vlastní větev. Bez ní by úloha
  z „k procvičení“ tiše mizela pokaždé, když má dítě vypnuté sčítání.
- **Vysvětlení po chybě je slovy, ne odečtením** — rozdíl by při obráceném pořadí vyšel
  záporně a záporná čísla se v aplikaci neobjevují.

Shoda obou čísel (odpověď `=`) padá zhruba v **16 %** úloh — dost na to, aby ji dítě
vidělo, málo na to, aby se dala tipnout. Řídí to `chance(0.12)` v `makeCompare()`;
zbytek dodají náhodné shody při malém rozsahu.

## Odměny — sbírka dumplingů

Za dokončené kolo může Alžběta získat sběratelskou postavičku. Je jich 78 v pěti
kategoriích (Základní 26 / Neobvyklé 16 / Raritní 13 / Epické 12 / Legendární 11), každá je samostatný
obrázek `.webp` (viz *Obrázky odměn*).

**Za jedno kolo padne nejvýš JEDEN dumpling.** Nerozhoduje se o počtu kusů, ale o tom,
jak vzácný ten jeden bude. Uživatel to takhle výslovně chtěl — šest dumplingů za kolo
bylo příliš. Vzácnost se **nesčítá z bodů** — bere se nejvyšší splněná podmínka žebříčku:

| kategorie | podmínka |
|---|---|
| Základní | bezchybná sada, čas nad limitem |
| Neobvyklý | bezchybná sada pod limitem |
| Raritní | pod limitem a k tomu úlohy navíc (slovní úlohy, pyramidy, doplň znaménko; u hádanek a mřížek zastoupí těžká úroveň) |
| Epický | víc než 50 správných příkladů za dnešek, **nebo** pod limitem při rozsahu 30 a výš |
| Legendární | bezchybná sada aspoň v 5 z posledních 7 dnů |

Dřív se stupně sčítaly ze čtyř nezávislých příspěvků (základ podle rozsahu + bonus za
rychlost + objem + obtížnost) a kvůli tomu se na Základního dumplinga nedalo dostat —
rozsah „do 20" přidával stupeň sám o sobě. **Ke sčítání bodů se už nevracej.**

Objem je tam schválně jako **druhá cesta k Epickému**: do 100 se rychle počítat
nenaučíš, ale vytrvalost se má ocenit stejně. Bez toho by velký rozsah nikdy nedosáhl
na epického.

**Bezchybná sada je podmínkou všeho.** Kolo s chybou dumplinga nepřinese. Chyba ale nic
neodebírá — už získané postavičky se **nikdy** neztrácejí a „Smazat historii" se jich
nedotkne. Jedinou výjimkou je režim „Najdi dvojice": tam se odpustí jedno přehlédnutí
(`pexesoMismatchAllowance` = 1 / 1 / 2, viz *Najdi dvojice*).

Legendárního nelze získat výkonem. Má **jedinou cestu — pravidelnost**: bezchybná sada
aspoň v pěti z posledních sedmi kalendářních dnů. Dřív tu byly ještě tři další milníky
(nejtěžší sada v rekordním čase, každých deset bezchybných sad, dumpling ze všech čtyř
nižších kategorií) — uživatel je zrušil, protože legendárních padalo příliš mnoho.
**Nevracej je zpátky.** Legendární se **nepřidává navíc** — povýší ten jediný dumpling
za kolo na nejvyšší stupeň. Splněný milník se nikdy neuděluje dvakrát; použitých pět dnů
se zapisuje do `legendaryDaysUsed` a „spotřebuje", takže stejnou pětici dnů nejde proměnit
v milník podruhé.

**Všechny hranice jsou v `REWARD_RULES` v `rewards.js`** — jedno místo, žádné číslo
z té tabulky nesmí být zapsané ještě někde jinde.

Pár věcí, které se snadno rozbijí:

- **Rychlost se měří časovým rozpočtem celé sady, ne průměrem na jeden příklad.** Základ
  je 15 s na jeden běžný příklad (`REWARD_RULES.fastSeconds`). Každá úloha si do rozpočtu
  přispěje vlastním přídělem podle druhu (`speedKindMultiplier`): běžný příklad 1×, slovní
  úloha 3×, pyramida 2×, doplňování znaménka 2×, rozklad přes desítku 2×, hádanka 3×,
  mřížka 4×, plocha s dvojicemi 6×, velké násobení 3×, abeceda 1× **za každé slovo**
  (`speedPerUnitKinds`; počet slov posílá `app.js` v `kindUnits`). Rozpočet ještě
  násobí obtížnost (`speedLevelMultiplier`: lehká 1, střední 1,3, těžká 1,7). Porovnává se
  součet skutečného času celé sady proti součtu těchhle přídělů (`speedBudget()`).
  Dřív se počítal jeden průměr na celou sadu a roztahoval se jen podle režimu (hádanka ×3,
  mřížka ×4). V režimu „Počítání" je ale slovní úloha jen pár kusů mezi běžnými příklady —
  její delší čas se v průměru rozředil a dítě na tom prodělalo. Příklad: sada 8 běžných
  příkladů a 2 slovních má rozpočet 8 + 2×3 = 14 příkladů, tedy 14 × 15 s = 210 s; dřív by
  měla jen 150 s. **Násobky v `speedKindMultiplier` musí zůstat celá čísla** — zobrazují se
  v návodu v popupu a desetinné číslo do textu pro dítě nepatří.
- **Rozpis druhů úloh posílá `app.js` v poli `kindCounts`** (spočítané z `attempts[].ex.kind`).
  Když `kindCounts` chybí (stará uložená data), doplní se podle režimu — sada se tím
  nerozbije.
- **`extras`** v souhrnu kola je počet zapnutých druhů úloh navíc (`config.kinds.length`) —
  je to podmínka Raritního. **Posílá se jen v režimu Počítání**, jinde je 0: karta „něco
  navíc" je tam schovaná, ale výběr v nastavení zůstává, a ostatní hry z něj dřív dostávaly
  Raritního zadarmo. Mimo Počítání ho zastoupí těžká úroveň.
- **Režim „Počítání" nemá `config.level`**, obtížnost se odvozuje z operací a úloh navíc
  (`difficultyOf()`): dělení nebo násobení s úlohami navíc = těžká, násobení nebo samotné
  úlohy navíc = střední, jinak lehká.
- **Čas se bere jako součet `attempts[].ms`**, ne jako doba na obrazovce. Pauza na přečtení
  vysvětlení po chybě se nezapočítává — dítě se nesmí trestat za to, že si přečte, kde
  chybovalo. (Kolo s chybou stejně nic nedostane, ale u hádanek a mřížek s opravou to hraje.)
- **`gameId`** vzniká v `startRound()` a hlídá, aby se táž sada nezapočítala dvakrát —
  po obnovení stránky, návratu zpět ani opakovaném otevření výsledku. Odměna se zapisuje
  do úložiště hned ve `finish()`, ještě **před** animací; okno je jen oslava.
- **Vlastní klíč v localStorage** `pocitani.rewards.v1`, oddělený od `pocitani.v1`. Poškození
  jednoho nesmí vzít druhé. `sanitize()` validuje každé pole zvlášť — vadná položka spadne
  na výchozí, ostatní platná data zůstanou.
- **Den se bere z místního kalendářního data**, ne z rozdílu 24 hodin. Nový aktivní den se
  zapíše až po dvou skutečných hodinách od poslední aktualizace a datum starší než poslední
  zapsané se ignoruje — přetočení systémových hodin tak neumí vyrobit pět dnů za minutu.
- **Náhodný je jedině výběr konkrétní postavičky.** Nejdřív se losuje ze seznamu dosud
  neobjevených v dané kategorii, teprve když má dítě všechny z kategorie, může padnout duplikát.
  Generátor náhody je parametr `applyRound(data, summary, rng)`, aby šly testy zopakovat.
- **U neobjevené postavičky se skutečné jméno nesmí objevit nikde** — ani v popisku, ani
  v `title` nebo `aria-label`, ani v popupu. Je tam `Neobjevený dumpling` / `Neobjevený labubák`
  (`COLLECTIONS[…].unknown`).
- **Návod v popupu se generuje z `REWARD_RULES`** (`howToGet()`), nikdy se nepíše ručně.
  Jinak by text po změně hranice tiše lhal proti skutečnému chování.

Na stránce sbírky je místo tlačítka „Odměny" plovoucí šipka zpět (`.rewards-back`,
`position: fixed`, přepíná se třídou `body.is-rewards`). Tlačítko do sbírky by tam vedlo
samo na sebe, tak se skrývá. Kliknutí na kolečko otevře popup s návodem, najetí myší jen
napíše podrobnost do řádku pod mřížkou — ten je v normálním toku, takže nemůže roztáhnout
stránku do šířky. **Plovoucí bublinu tam nevracej**, na 320 px přetékala.

### Obrázky odměn

Od 15. 10. 2026 je **každá postavička samostatný `.webp`** s průhledným pozadím
(dřív jeden sprite sheet `dumplings.png`; stav před změnou je v tagu
`zaloha-pred-webp-2026-10-15`). Cesta je
`public/img/odmeny/<sbírka>/<kategorie>/<soubor>.webp`, nadpisy kategorií
v `…/_category_titles/<kategorie>.webp`. Zdrojové originály leží v `Odmeny/`
(mimo git), aplikace bere kopie z `public/`.

**ID (`basic_01` …) jsou to, co si sbírka dítěte ukládá — nikdy je neměň ani
nepřečíslovávej.** Obrázek i jméno se k ID vyměnit dají kdykoli; tak proběhla i výměna
na webp a dětem žádná odměna nezmizela.

**Nová postavička** = soubor do složky kategorie + řádek v `items` v `rewards-data.js`
s dalším volným ID + to ID **na konec `TRANSFER_ORDER`**. QR přenos posílá sbírku jako
pole čísel v tomhle pořadí; vložení doprostřed by starším kódům přiřadilo počty jiným
postavičkám. `tests/images.test.mjs` hlídá existenci souborů, průhlednost (bez ní by
neobjevená postavička byla černý čtverec místo siluety), původní pořadí 40 ID
a i to, že ve složce neleží obrázek bez řádku v datech.

**Druhá várka (19. 10. 2026, 38 postaviček podobných pohádkovým)** vznikla rozřezáním
jednoho listu `dumplings/Designer.png` (vygenerovaný obrázek, dlaždice na krémovém
podkladu). Krémový podklad se odstraňoval vyplněním od okraje dlaždice s **těsnou mezí
barvy** a maskou předem zúženou o 2 px — sněhulák, králík a bílé čepice mají místy
přesně barvu podkladu a volnější mez je „prožrala". Mají 286–594 px (zvětšené 2× z listu,
takže méně detailu než první várka s 640 px). Víc takových listů = stejný postup, skript se dá
napsat znovu podle téhle poznámky.

### Víc sbírek: dumplingy a labubáci (19. 10. 2026)

Dítě si nahoře na stránce sbírky vybere **„Co sbírám?"** — Dumplingy, Labubáky, nebo obojí
(`rewardData.collections`, výchozí `['dumplings']`, aspoň jedna musí zůstat). Pod tím jsou
záložky, kterou sbírku si prohlíží; ukazují se i sbírky, které už nesbírá, ale něco z nich má.

- **Pravidla vzácnosti jsou pro všechny sbírky společná** a `REWARD_RULES` o sbírkách nic neví.
  Legendární za pravidelnost je jeden společný postup (uživatel to tak zvolil).
- **Při obou sbírkách si dítě po kole vybere samo.** `applyRound()` pak nevybere postavičku,
  ale uloží vzácnost do `pendingRewards` a vrátí `{ pending: true, category, choices }`;
  závěrečné okno ukáže 🎁 a tlačítka „Dumpling / Labubák", klepnutí volá `claimPending()`.
  Zavřené okno odměnu nezahodí — počká nahoře na stránce sbírky a svítí v čísle u tlačítka.
  `pendingRewards` se **nepřenáší QR kódem** (slučování by nebylo idempotentní).
- **ID labubáků mají předponu `lab_`** (`lab_basic_01`); ID jsou unikátní napříč sbírkami.
  Na konci `TRANSFER_ORDER` je jich 121.
- Labubáci vznikli rozřezáním `labubaci/Designer.png` (mimo git) — to PNG má **skutečnou
  průhlednost**, takže stačilo rozdělit souvislé oblasti; dvě postavičky, které se dotýkaly,
  se dělily v nejužším sloupci. Jsou malé (zhruba 160–230 px, zvětšené 2×).
  **Skripty jsou v `tools/odmeny/`** (Python + Pillow, mimo `public/`, nenasazují se):
  `cut.py` rozřeže list, `contact.py` udělá náhled k pojmenování, `towebp.py` podle
  mapování (`labubu.json`) uloží `.webp` a vypíše řádky do `rewards-data.js`.
- Rozdělení do kategorií odpovídá dumplingům (39 / 25 / 21 / 19 / 17): barvy, povolání
  a sport základní, zvířátka a muzikanti neobvyklí, dobrodruzi a strašidla raritní,
  kouzla a princezny epické, hrdinové, draci a králové legendární.
- **Nadpisy kategorií jsou obecné a sdílené** (`headerSrc()` míří do `dumplings/_category_titles`).
- Texty pro dítě berou tvary jména ze `COLLECTIONS[…].words` (dumplinga / labubáka). Obě jména
  jsou mužská životná, takže „Epický", „nový" sedí. **Sbírka s jiným rodem** (např. „auta")
  bude potřebovat upravit i texty v `howToGet()` a na stránce sbírky.

**Nová sbírka** (autíčka, motorky, rakety): řádek v `COLLECTIONS` s vlastní předponou ID,
klíč v `COLLECTION_ORDER`, složka `public/img/odmeny/<sbírka>/<kategorie>/`, ID na konec
`TRANSFER_ORDER`, předpona do `ID_PREFIX` v `tests/images.test.mjs` a barva zapnutého chipu
(`.chips-collect .chip.is-on[data-value="…"]`). S víc než dvěma sbírkami se volba po kole
nabídne ze všech zapnutých.

## Nastavení, export a přenos na druhé zařízení

Ve spodní liště úvodní obrazovky je vedle „Zvuk" tlačítko **„🔒 Nastavení"**. Otevře dialog
za statickým heslem `190417` — je to zámek na dvířka od spíže, ne trezor: má zabránit tomu,
aby si Alžběta omylem smazala sbírku. Kdo otevře zdrojový kód, dostane se dál, a to je
v pořádku.

**Tlačítko „Smazat historii" na úvodní obrazovce už není** a nevracej ho tam. Mazání patří
do tohohle dialogu za heslo, aby se k němu dítě nedostalo omylem.

Potvrzovací tlačítko u hesla **není** — dialog se odemkne sám, jakmile zadané znaky sedí.
Chyba se hlásí až po Enteru, ne během psaní. Vlevo nahoře je šipka **„‹"**, stejné gesto
jako na stránce sbírky.

Za heslem jsou dvě věci:

**QR kód s přenosem.** Celý postup se zabalí do jednoho řetězce, ten se vloží do adresy
jako parametr `p` a z adresy se udělá QR kód. Na druhém zařízení se kód vyfotí **běžnou
aplikací Fotoaparát** — telefon nabídne otevřít odkaz a aplikace si při načtení parametr
přečte. Čtečka QR v aplikaci tedy není potřeba a nepiš ji.

**Tři mazací tlačítka**, každé se ještě jednou potvrzuje:
jen sbírka odměn → sbírka i historie počítání (nastavení zůstane) → úplně všechno.

### Co se přenáší a jak se to slučuje

Sbírka dumplingů celá, úspěšnost podle dovedností (`skills`), seznam chyb k procvičení
(`missed`), výsledky kol **za posledních 5 dnů** (`ROUNDS_DAYS`) a nastavení.

**Slučování je schválně idempotentní** — u počtů se bere vyšší hodnota, u seznamů
sjednocení. Naskenování téhož kódu podruhé nic nezdvojí; ověřeno. Nikdy se nic nepřepisuje
směrem dolů, takže o už získané dumplingy se nedá přijít.

Jedna výjimka: **nastavení (téma, rozsah, operace) se přenese jen na zařízení, které ještě
nic neodehrálo.** Jinak by příchozí kód přepsal vzhled někomu, kdo si ho právě nastavil.
Jestli je zařízení čerstvé, se musí zjistit **ještě před** slučováním — po sloučení kol už
je seznam plný z příchozích dat a podmínka by nikdy neplatila. Na tomhle jsem se spálil.

Data se komprimují vestavěným `CompressionStream('deflate-raw')` a kódují do base64url bez
výplňových `=`. Žádná knihovna. Realistický stav (5 dumplingů, 3 dovednosti, 2 chyby,
2 kola, nastavení) dá adresu dlouhou **492 znaků** — kapacita QR na úrovni L je 2953, takže
je velká rezerva. Když by se přenos přesto nevešel, dialog to napíše místo kódu.

### `qr.js`

Vlastní generátor QR podle ISO/IEC 18004: režim byte, verze 1–40, všechny čtyři úrovně
opravy, Reed-Solomon nad GF(256), všech osm masek s penalizací podle normy.

**Tabulky `EC_CODEWORDS_PER_BLOCK` a `EC_BLOCKS` jsou z normy a neopravuj je od oka.**
Jsou správně, když `qrCapacity()` vrátí přesně 2953 / 2331 / 1663 / 1273 pro L / M / Q / H.

Ověřoval jsem to jednorázovým skriptem ve scratchpadu, který matici čte zpátky a kontroluje
**Reed-Solomonovy syndromy** — u nepoškozených dat musí vyjít všechny nulové. Když budeš
něco podobného psát znovu, pozor na past, do které jsem spadl: do mapy funkčních modulů
patří i **tmavý modul** na `[size - 8][8]`. Bez něj se bitový proud posune o jeden modul,
text se ještě přečte správně, ale poslední kódová slova nesedí a syndromy vyjdou nenulové.

QR se kreslí **vždy černý na bílém**, i v tmavém režimu — čtečky potřebují kontrast
a invertovaný kód spousta telefonů nepřečte.

## Testy

Externí testovací framework tu není a nepřibude. Testy má logika odměn, obrázky odměn a
ukládací vrstva (`storage.test.mjs`: fronta zápisů, sanitizace, tři rozsahy mazání,
výměna backendu) — všechno ve vestavěném běhu Node, bez jediné závislosti:

```powershell
npm test          # node --test "tests/*.test.mjs"
```

Pozor: holé `node --test tests/` na tomhle stroji spadne na `Cannot find module`.
Runner bere pozicní argument jako cestu ke spuštění, ne jako adresář ke skenu —
proto je ve skriptu glob `"tests/*.test.mjs"`.

Generátory úloh testy nemají a ověřují se dál **jednorázovými skripty v Node**, které
si napiš do scratchpadu. U čehokoli, co generuje úlohy, testuj vždycky tohle:

- **jednoznačnost řešení** — u hádanek nezávisle dvakrát (hodnost soustavy i hrubou silou
  přes všechny kombinace), u znamének proti nabízené sadě operací,
- žádné záporné/desetinné číslo nikde včetně textů vysvětlení,
- výsledek v nastaveném rozsahu,
- texty neobsahují `undefined` / `NaN`.

Projeď aspoň pár tisíc vygenerovaných úloh, ne deset. Většina vad se objeví jednou za sto.

**Úlohy s vlastním ovládáním testuj přes klávesnici, ne zápisem do `.value`.** Test mřížky
mi prošel zeleně, přestože psát šlo jen do jednoho z devíti koleček — hodnoty zapisoval
přímo do `input.value` a `handleKey()` úplně obešel. Chyba byla přesně v té funkci.

## Rozvržení

Musí fungovat **od 320 px** (nejužší reálný telefon) po desktop. Nejkritičtější je poslední
řádek těžké hádanky: čtyři obrázky, čtyři znaménka a políčko na odpověď. Celý blok proto
škáluje z proměnných `--sym` / `--op` / `--gap` na `.riddle`.

**Pozor na `<input>` ve flexovém řádku** — drží si vlastní vnitřní šířku přes 300 px a
roztáhne celou stránku. Proto má `.riddle-row-q .slot` pevnou `width` a `min-width: 0`.

Přetečení neměř přes `scrollWidth > clientWidth`; řádek se místo rolování roztáhne a tahle
kontrola projde. Porovnávej **součet šířek dětí** proti vnitřní šířce řádku, nebo sleduj
`document.documentElement.scrollWidth > window.innerWidth`.

**Každé nové políčko na odpověď potřebuje v HTML vlastní `maxlength`.** `renderExercise()`
ho nastavuje jen tomu s `id="answerInput"`. Bez atributu vrací `input.maxLength` hodnotu
−1, podmínka `value.length >= maxLength` je pak vždycky splněná a klávesnice do políčka
nenapíše ani číslici. Takhle se rozbila mřížka — psát šlo jen do prvního kolečka.

**Hlídej si specificitu.** Obecné `.slot input` (0,1,1) přebije vlastní `.grid-input`
(0,1,0), takže si kolečko vzalo velikost písma z běžného příkladu a dvojciferné číslo
přeteklo z kroužku ven. Nový selektor musí mít aspoň dvě třídy (`.gcell .grid-input`)
a nastavit i `line-height`, jinak číslo nesedí na střed.

### Barva textu — dvě pasti, na které jsem se spálil

**`<button>` nedědí barvu textu.** Bere si výchozí černou z prohlížeče, takže každé nové
tlačítko potřebuje vlastní `color`. Ve světlém režimu si toho nikdo nevšimne; v tmavém je
z toho černý text na tmavém podkladu. Přesně takhle se rozbila jména dumplingů ve sbírce
(`.rew-slot`). `.chip` i `.btn` si proto barvu nastavují samy — drž se toho.

**Každá nová volba na kartě s operacemi (`#card-ops`) potřebuje vlastní barvu zapnutého
stavu** (`.chips .chip.is-on[data-value="…"]` ve `styles.css`). Zapnutý chip má bílé písmo
a obecný modrý podklad na tuhle kartu nedosáhne (`.chips:not(.chips-ops)`). Bez vlastní
barvy volba splyne s kartou — stalo se to u Slovních druhů i u Významu slov.

**`--on-bg` není `--ink`.** `--on-bg` je barva textu na kulise, `--ink` barva textu na
kartě. Cokoli s `background: var(--card)` musí mít i `color: var(--ink)`, jinak si to
zdědí `--on-bg` z `body`. U většiny témat to projde náhodou, ale téma **Hudba** má tmavou
kulisu a `--on-bg: #fdf4ff` — ve světlém režimu z toho byl bílý text na bílém dialogu.
Takhle byly neviditelné všechny tři dialogy (odměny, popup, Nastavení), než dostaly
`color: var(--ink)` na `.reward-dialog`.

**Tmavá barva na tintu v tmavém režimu nesvítí.** `--good-tint` a `--bad-tint` se
v tmavém režimu přepnou na tmavé (`#0f3d31`, `#45162a`), ale `--good-dark` a `--bad-dark`
zůstávají stejné — tmavě zelená na tmavě zelené má kontrast **2,2**. Barvu proto nech
nést **podklad a rámeček** a text dej `var(--ink)`; ten se přepíná spolu s tintem a vyjde
v obou režimech přes 10. Takhle byl nečitelný zápis velkého násobení, než dostal
`color: var(--ink)` a zelený proužek vlevo.

Po zásahu do barev projeď **všech osm témat × oba režimy** a změř kontrast, ne jen mrkni
na jedno téma. Po opravě vycházelo: dialog 13,3–13,5, jméno ve slotu 5,3–6,8, podnadpis
kategorie 4,8–6,1 (hranice čitelnosti je 4,5).

## Pozor na `npx skills add`

Instalátor dovedností používá **aktuální adresář**, ne globální složku. Když ho pustíš
odsud, nasype 20 cizích dovedností rovnou do repozitáře s aplikací (`.agents/`,
`.claude/skills/`, `skills-lock.json`) — přesně to se stalo 12. 9. 2026. Dovednosti
patří do `~/.claude/skills/`, kam byly ručně přesunuty; ty tři cesty zůstávají
v `.gitignore` jako pojistka, kdyby se to opakovalo.

Do repozitáře s aplikací pro dceru cizí kód nepatří. Kdyby se tu znovu objevil,
přesuň ho do `~/.claude/skills/` a smaž odsud, nebo rovnou odinstaluj.

## Komunikace s uživatelem

Uživatel nemusí být programátor. Vysvětluj česky a bez žargonu, na konci shrň, co se změnilo
a jak si to ověřit. Čísla, která tvrdíš, si nejdřív změř.
