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
npx --yes serve public          # nebo jakýkoli statický server
```

Nasazení je ruční, ve dvou krocích:

```powershell
git push                                  # commit na main
netlify deploy --prod --dir=public        # CLI je přihlášené
```

## Struktura

| Soubor | Co v něm je |
|---|---|
| `public/index.html` | tři obrazovky (nastavení / kvíz / výsledek), přepínají se třídou `is-active` |
| `public/js/app.js` | veškeré UI — vykreslení úloh, klávesnice, vyhodnocení, výsledková obrazovka |
| `public/js/generator.js` | generování příkladů, vysvětlení po chybě, rozbor chyby |
| `public/js/riddle.js` | generátor obrázkových hádanek (samostatný, generator.js si ho importuje) |
| `public/js/stats.js` | ukládání do localStorage, rozbor kola, rady |
| `public/js/random.js` | `rnd` / `pick` / `chance` / `shuffle` / `range` |
| `public/css/styles.css` | vše včetně devíti barevných témat a tmavého režimu |

Prosté ES moduly, žádný framework, žádné závislosti. Závislosti jdou jedním směrem:
`random.js → riddle.js → generator.js → app.js`. Kruh nezaváděj.

## Dva režimy hry

Na úvodní obrazovce se vybírá karta **„Co si zahrajeme?"**:

- **Počítání** (`config.mode === 'calc'`) — původní trénink. Vybírají se operace a k nim
  druhy úloh navíc (`EXTRA_KINDS`): slovní úlohy, pyramidy, doplň znaménko.
- **Obrázkové hádanky** (`config.mode === 'riddle'`) — samostatná hra s vlastní obtížností.
  Karty s operacemi a „něco navíc" se v tomhle režimu schovají.

Obě větve se rozcházejí až v `startRound()`: `buildRound()` versus `buildRiddleRound()`.
Všechno ostatní — klávesnice, vyhodnocení, statistiky — je společné, protože každá úloha
má stejný tvar: `{ op, kind, missing, a, b, c, answer, skill }`.

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

## Rozvržení

Musí fungovat **od 320 px** (nejužší reálný telefon) po desktop. Nejkritičtější je poslední
řádek těžké hádanky: čtyři obrázky, čtyři znaménka a políčko na odpověď. Celý blok proto
škáluje z proměnných `--sym` / `--op` / `--gap` na `.riddle`.

**Pozor na `<input>` ve flexovém řádku** — drží si vlastní vnitřní šířku přes 300 px a
roztáhne celou stránku. Proto má `.riddle-row-q .slot` pevnou `width` a `min-width: 0`.

Přetečení neměř přes `scrollWidth > clientWidth`; řádek se místo rolování roztáhne a tahle
kontrola projde. Porovnávej **součet šířek dětí** proti vnitřní šířce řádku, nebo sleduj
`document.documentElement.scrollWidth > window.innerWidth`.

## Komunikace s uživatelem

Uživatel nemusí být programátor. Vysvětluj česky a bez žargonu, na konci shrň, co se změnilo
a jak si to ověřit. Čísla, která tvrdíš, si nejdřív změř.
