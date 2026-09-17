# Počítání pro Alžbětu

Hravy trenazer matematiky pro skolacku 1. az 3. tridy. Bezi na
**https://pocitani.jarda-moc.workers.dev**

Neni to obecny produkt, ale aplikace pro jedno konkretni dite: vsechny texty jsou
v zenskem rode a nikde se neobjevi zaporne ani desetinne cislo.

## Co to umi

**Sest rezimu hry**

| rezim | co se v nem deje |
|---|---|
| **Pocitani** | priklady na scitani, odcitani, nasobeni a deleni, k tomu slovni ulohy, pyramidy, doplnovani znamenka a porovnavani cisel |
| **Pocitej pres 10** | rozklad druheho cisla na cestu k desitce a zbytek, nakresleny jako vetvicka |
| **Obrazkove hadanky** | soustava rovnic z obrazku, kde kazdy radek prozradi prave jeden novy obrazek |
| **Mrizka** | kolecka s cisly, kde rovnice plati vodorovne i svisle |
| **Najdi dvojice** | karticky s priklady a vysledky, dite je spojuje; co je na nich, ridi zapnute operace (jen × = nasobilka) |
| **Velke nasobeni** | rozklad `85 × 5` na desitky a jednotky ve trech krocich, v kazdem se vybira ze dvou moznosti |

Rozsah cisel (do 10 az do 100), pocet prikladu i druhy uloh se vybiraji na uvodni
obrazovce; obtiznost je u peti rezimu samostatna osa, nezavisla na rozsahu.

**Sbirka dumplingu.** Za bezchybne kolo padne jedna sberatelska postavicka z 40
v peti kategoriich. Vzacnost se ridi tim, jak rychle a jak tezke kolo bylo;
legendarniho lze ziskat jedine pravidelnosti, ne vykonem.

**Prenos na druhe zarizeni.** V dialogu za heslem se cely postup zabali do QR kodu.
Ten se na druhem telefonu vyfoti beznou aplikaci Fotoaparat a data se slouci -
nikdy se nic neprepisuje smerem dolu, takze o ziskane dumplingy nejde prijit.

**Data zustavaji v prohlizeci.** Zadny ucet, zadny server, zadne sledovani.
Vsechno je v `localStorage` daneho zarizeni.

## Spusteni

Potreba je jen Node (kvuli vyvojovemu serveru a skriptum). **Zadne zavislosti se
neinstaluji**, `npm install` neni potreba.

```powershell
npm run dev     # http://localhost:8000
npm test        # testy odmen, sprite sheetu a ukladaci vrstvy
npm run publish # git push + nasazeni na Cloudflare + overeni ziveho webu
```

Dvojklik na `index.html` nefunguje - aplikace je z ES modulu a prohlizec je
z `file:///` odmitne nacist. Musi to jit pres `localhost`.

## Jak je to postavene

Prosty staticky web: HTML, CSS a ES moduly. Zadny framework, zadny bundler,
zadne zavislosti - `public/` se servíruje tak, jak lezi.

```
public/
  index.html        ctyri obrazovky prepinane tridou
  css/styles.css    vse vcetne devíti temat a tmaveho rezimu
  js/
    app.js          UI, klavesnice, vyhodnoceni
    generator.js    generovani prikladu a vysvetleni po chybe
    riddle.js       obrazkove hadanky
    grid.js         mrizky
    over10.js       rozklady pres desitku
    pexeso.js       plochy pro "Najdi dvojice"
    bigmul.js       velke nasobeni - rozklad na desitky a jednotky
    stats.js        rozbor kola a rady
    storage.js      jedina vrstva nad ulozistem
    rewards*.js     pravidla odmen, data sprite sheetu, vykresleni
    qr.js           generator QR kodu podle normy, bez knihovny
    transfer.js     zabaleni a slouceni postupu
server.mjs          vyvojovy server (node:http)
publish.mjs         nasazeni vcetne kontrol a overeni
tests/              testy pro vestaveny `node --test`
```

Hostuje to **Cloudflare Workers** jako staticka aktiva, zadny kod na serveru
nebezi. Bezpecnostni hlavicky jsou v `public/_headers`.

## Podrobnosti

Pravidla, na kterych aplikace stoji - tvar uloh, stavba hadanek, hranice odmen,
pasti v rozvrzeni - jsou popsana v [CLAUDE.md](CLAUDE.md).
