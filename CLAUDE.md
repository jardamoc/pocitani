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

Není žádný build ani `package.json` — je to statický web, `public/` se servíruje tak, jak je.

```powershell
node server.mjs                 # http://localhost:8000
node server.mjs 8080            # jiný port
```

`server.mjs` v kořeni je vývojový server bez závislostí (jen `node:http`). Obsazený port
si sám posune o jedna dál a vypíše, na které adrese nakonec běží. Nasazuje se jen
`public/`, takže tenhle soubor na Netlify nikdy nejde.

Dvojklik na `index.html` **nefunguje** — aplikace je z ES modulů a ty prohlížeč
z `file:///` odmítne načíst. Musí to jít přes `localhost`.

Nasazení je ruční, ve dvou krocích:

```powershell
git push                                  # commit na main
npx --yes netlify-cli@latest deploy --prod --dir=public
```

`netlify` **není v PATH** — samotný příkaz `netlify` spadne na „není rozpoznán jako
název rutiny". Přihlášení ale platí (je uložené v `%APPDATA%\netlify`), takže verze
přes `npx` projde bez ptaní na účet.

## Struktura

| Soubor | Co v něm je |
|---|---|
| `public/index.html` | tři obrazovky (nastavení / kvíz / výsledek), přepínají se třídou `is-active` |
| `public/js/app.js` | veškeré UI — vykreslení úloh, klávesnice, vyhodnocení, výsledková obrazovka |
| `public/js/generator.js` | generování příkladů, vysvětlení po chybě, rozbor chyby |
| `public/js/riddle.js` | generátor obrázkových hádanek (samostatný, generator.js si ho importuje) |
| `public/js/grid.js` | generátor mřížek (stejně samostatný jako `riddle.js`) |
| `public/js/stats.js` | ukládání do localStorage, rozbor kola, rady |
| `public/js/random.js` | `rnd` / `pick` / `chance` / `shuffle` / `range` |
| `public/css/styles.css` | vše včetně devíti barevných témat a tmavého režimu |

Prosté ES moduly, žádný framework, žádné závislosti. Závislosti jdou jedním směrem:
`random.js → riddle.js / grid.js → generator.js → app.js`. Kruh nezaváděj.

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

## Testy

Testovací framework tu není. Generátory se ověřují **jednorázovými skripty v Node**, které
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
