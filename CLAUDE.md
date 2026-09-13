# Počítání pro Alžbětu

Hravý trenažér matematiky pro **konkrétní dítě** — dceru majitele repozitáře, školačku
**1. až 3. třídy**. Není to obecný produkt; když se rozhoduješ mezi „správně obecně" a
„srozumitelně pro sedmiletou holku", vyhrává druhé.

GitHub `jardamoc/pocitani`, Netlify site `7de6843d-e093-4d19-8d9e-66fa8c1c4cf7`.

## Dvě nepřekročitelná pravidla

**1. Všechny texty v UI jsou v ženském rodě.** „Zvládla jsi", „napsala jsi", „spletla ses".
Nikdy neutrální ani mužský tvar, nikdy podtržítkové dvojtvary typu „Zvládl_a jsi".

**2. Žádná záporná ani desetinná čísla.** Nikde — ani v zadání, ani v mezivýsledku, ani ve
vysvětlení po chybě. Když nějaká varianta vyjde záporně, popiš to slovy
(„to nejde, odčítá se větší číslo"), nevypisuj `-12`.

## Spuštění a nasazení

```powershell
npm run dev                     # http://localhost:8000
npm run publish                 # git push + nasazení + ověření
npm run publish -- --dry-run    # jen kontroly, nic se neodešle
```

**Žádné sestavování ani závislosti nepřibyly.** `package.json` je tu jen kvůli těmhle
dvěma zkratkám — `dependencies` je prázdné, `npm install` není potřeba, `public/` se
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
něco jiného, než je v gitu), pak odešle commity, spustí Netlify a **nakonec si stáhne
živý web a zkontroluje ho** — hláška „Deploy is live" sama o sobě nestačí.

`netlify` **není v PATH** — samotný příkaz `netlify` spadne na „není rozpoznán jako
název rutiny". Přihlášení ale platí (je uložené v `%APPDATA%\netlify`), takže verze
přes `npx` projde bez ptaní na účet.

## Struktura

| Soubor | Co v něm je |
|---|---|
| `public/index.html` | čtyři obrazovky (nastavení / kvíz / výsledek / odměny), přepínají se třídou `is-active`, plus vrstva `#rewardOverlay` |
| `public/js/app.js` | veškeré UI — vykreslení úloh, klávesnice, vyhodnocení, výsledková obrazovka |
| `public/js/generator.js` | generování příkladů, vysvětlení po chybě, rozbor chyby |
| `public/js/riddle.js` | generátor obrázkových hádanek (samostatný, generator.js si ho importuje) |
| `public/js/grid.js` | generátor mřížek (stejně samostatný jako `riddle.js`) |
| `public/js/stats.js` | ukládání do localStorage, rozbor kola, rady |
| `public/js/random.js` | `rnd` / `pick` / `chance` / `shuffle` / `range` |
| `public/js/rewards-data.js` | souřadnice sprite sheetu a česká jména 40 dumplingů — čistá data |
| `public/js/rewards.js` | pravidla odměn, vyhodnocení kola, výběr postavičky, ukládání — **bez DOM** |
| `public/js/rewards-ui.js` | vykreslení odměn: sprite, sbírka, závěrečné okno, animace |
| `public/js/qr.js` | generátor QR kódu podle normy — bez knihovny |
| `public/js/transfer.js` | přenos postupu mezi zařízeními: zabalení, adresa, slučování |
| `public/js/export-ui.js` | dialog „Export" — heslo, QR kód, tři mazací tlačítka |
| `public/img/dumplings.png` | jeden sprite sheet 1254×1254 se všemi 40 postavičkami i 5 nadpisy |
| `public/css/styles.css` | vše včetně devíti barevných témat, tmavého režimu a odměn |
| `server.mjs` | vývojový server (`npm run dev`) — mimo `public/`, nenasazuje se |
| `publish.mjs` | nasazení i s kontrolami a ověřením (`npm run publish`) |
| `tests/*.test.mjs` | testy pro `node --test`, bez frameworku i bez závislostí |
| `package.json` | jen ty tři zkratky a `"type": "module"`; žádné závislosti |

Prosté ES moduly, žádný framework, žádné závislosti. Závislosti jdou jedním směrem:
`random.js → riddle.js / grid.js → generator.js → app.js`,
`rewards-data.js → rewards.js → rewards-ui.js → app.js` a
`qr.js / transfer.js → export-ui.js → app.js`. Kruh nezaváděj.

## Tři režimy hry

Na úvodní obrazovce se vybírá karta **„Co si zahrajeme?"**:

| režim | `config.mode` | co se v nastavení skryje |
|---|---|---|
| **Počítání** | `calc` | — (vybírají se operace i druhy úloh navíc) |
| **Obrázkové hádanky** | `riddle` | operace, „něco navíc" |
| **Mřížka** | `grid` | „něco navíc", **počet příkladů** (jedna mřížka = jedno kolo) |

Větve se rozcházejí až v `startRound()`, kde je tabulka builderů. Všechno ostatní —
klávesnice, vyhodnocení, statistiky — je společné, protože každá úloha má stejný tvar:
`{ op, kind, missing, a, b, c, answer, skill }`.

`config.level` je **společný pro hádanky i mřížku** (klíče `easy`/`medium`/`hard`), takže
přepnutí režimu obtížnost neztratí. Tabulku popisků vybírá `levelTable()` podle režimu.

**Když přidáváš nový druh úlohy, drž se tohohle tvaru.** Ušetří ti to práci na pěti místech.
Stačí pak: položka v `EXTRA_KINDS`, větev v `makeExercise()`, funkce v `BODY_HTML`,
větev v `hintFor()` / `explain()` / `exToText()` a popisek v `KIND_LABEL` ve `stats.js`.

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

## Doplň znaménko

`7 __ 3 = 10`. Nabídka tlačítek je přesně ta sada operací, kterou má uživatel zapnutou,
a **proti téhle sadě se hlídá jednoznačnost** — `2 __ 2 = 4` sedí na `+` i `×`, takže
takový příklad se zahodí. Druh proto potřebuje aspoň dvě operace (`minOps: 2`).
Odpovědí je klíč operace (`'add'`), ne číslo; `submit()` na to má větev.

## Odměny — sbírka dumplingů

Za dokončené kolo může Alžběta získat sběratelskou postavičku. Je jich 40 v pěti
kategoriích (Základní / Neobvyklé / Raritní / Epické / Legendární) a všechny se kreslí
z **jednoho** sprite sheetu `public/img/dumplings.png`.

**Za jedno kolo padne nejvýš JEDEN dumpling.** Nerozhoduje se o počtu kusů, ale o tom,
jak vzácný ten jeden bude. Uživatel to takhle výslovně chtěl — šest dumplingů za kolo
bylo příliš. Vzácnost se skládá ze čtyř nezávislých příspěvků:

```
základ podle rozsahu   do 20 → +0,  20–49 → +1,  50 a víc → +2
+ bonus za rychlost    pod 20 s na příklad → +1,  pod 10 s → +2
+ bonus za objem       30 správných za den → +1,  60 → +2
+ bonus za obtížnost   těžká úroveň → +1
= stupeň 0–3           Základní / Neobvyklý / Raritní / Epický  (strop je epický)
```

Objem je tam schválně jako **druhá cesta nahoru**: do 100 se rychle počítat nenaučíš,
ale vytrvalost se má ocenit stejně. Bez toho by velký rozsah nikdy nedosáhl na epického.

**Bezchybná sada je podmínkou všeho.** Kolo s chybou dumplinga nepřinese. Chyba ale nic
neodebírá — už získané postavičky se **nikdy** neztrácejí a „Smazat historii" se jich
nedotkne.

Legendárního nelze získat výkonem. Je jen za milníky a **nepřidává se navíc** — povýší
ten jediný dumpling za kolo na nejvyšší stupeň. Milníky v pořadí: nejtěžší sada bez chyby
v rekordním čase → pět aktivních dnů v posledních sedmi → každých deset bezchybných sad →
dumpling z každé ze čtyř nižších kategorií. Splněný milník se nikdy neuděluje dvakrát;
u pravidelnosti se použitých pět dnů „spotřebuje" (`legendaryDaysUsed`), takže postup
běží dál, ale stejné dny se nedají proměnit podruhé.

**Všechny hranice jsou v `REWARD_RULES` v `rewards.js`** — jedno místo, žádné číslo
z té tabulky nesmí být zapsané ještě někde jinde.

Pár věcí, které se snadno rozbijí:

- **Rychlostní hranice platí na jeden příklad, ne na celou sadu.** Sada má 10–30 příkladů,
  takže „pod 20 s za sadu" by bylo nesplnitelné. Porovnává se **průměr**, aby kratší sada
  nebyla zvýhodněná. Násobky `speedModeMultiplier` a `speedLevelMultiplier` limit roztáhnou
  tam, kde jedna úloha trvá déle (hádanka ×3, mřížka ×4) nebo je těžší.
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
  neobjevených v dané kategorii, teprve když má dítě všech osm, může padnout duplikát.
  Generátor náhody je parametr `applyRound(data, summary, rng)`, aby šly testy zopakovat.
- **U neobjevené postavičky se skutečné jméno nesmí objevit nikde** — ani v popisku, ani
  v `title` nebo `aria-label`, ani v popupu. Je tam `Neobjevený dumpling`.
- **Návod v popupu se generuje z `REWARD_RULES`** (`howToGet()`), nikdy se nepíše ručně.
  Jinak by text po změně hranice tiše lhal proti skutečnému chování.

Na stránce sbírky je místo tlačítka „Odměny" plovoucí šipka zpět (`.rewards-back`,
`position: fixed`, přepíná se třídou `body.is-rewards`). Tlačítko do sbírky by tam vedlo
samo na sebe, tak se skrývá. Kliknutí na kolečko otevře popup s návodem, najetí myší jen
napíše podrobnost do řádku pod mřížkou — ten je v normálním toku, takže nemůže roztáhnout
stránku do šířky. **Plovoucí bublinu tam nevracej**, na 320 px přetékala.

### Sprite sheet

Souřadnice v `rewards-data.js` jsou převzaté doslova ze zadání a **neodhaduj je znovu**.
Postavičky se na plátně dotýkají, takže se výřez při vykreslení ořezává o pixel z každé
strany (`TRIM` v `rewards-ui.js`) — bez toho prohlížeč při zmenšení natáhl i první sloupec
souseda a u kolečka byl vidět barevný proužek. Ořez je **zobrazovací pojistka**, souřadnice
se kvůli němu nemění.

Při změně velikosti se musí přepočítat **najednou** rozměr prvku, `background-position`
i `background-size`, jinak se výřez rozjede. Poměr stran 1254×1254 zůstává 1:1.

Dva výřezy mají na levém okraji plný sloupec a `tests/sprite.test.mjs` je vede jako známé,
posouzené odchylky (`ZNAME_ODCHYLKY`): `rare_07` přichází asi o 8 px vlastního levého okraje,
`epic_03` má v sobě asi 6 px sousední postavičky. Je to pod 6 % šířky výřezu a na zobrazené
velikosti to není poznat. Pokud to někdy budeš ladit, **posuň souřadnice, nezměkčuj test.**

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

Externí testovací framework tu není a nepřibude. Logika odměn má testy ve vestavěném
běhu Node (žádná závislost):

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

**`--on-bg` není `--ink`.** `--on-bg` je barva textu na kulise, `--ink` barva textu na
kartě. Cokoli s `background: var(--card)` musí mít i `color: var(--ink)`, jinak si to
zdědí `--on-bg` z `body`. U většiny témat to projde náhodou, ale téma **Hudba** má tmavou
kulisu a `--on-bg: #fdf4ff` — ve světlém režimu z toho byl bílý text na bílém dialogu.
Takhle byly neviditelné všechny tři dialogy (odměny, popup, Nastavení), než dostaly
`color: var(--ink)` na `.reward-dialog`.

Po zásahu do barev projeď **všech šest témat × oba režimy** a změř kontrast, ne jen mrkni
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
