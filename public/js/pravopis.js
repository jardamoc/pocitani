import { shuffle } from './random.js';

/* ============================================================
   Pravopis

   Stejné ovládání jako „Doplň u, ú, ů": slovo nebo věta s mezerami,
   dítě klepne na mezeru a pak na jednu ze dvou možností. Co je v nabídce,
   říká mezera sama (`opts`) - u i/y je to i/y nebo í/ý, u párových
   souhlásek dvojice z té mezery, u velkých písmen malé a velké.

   Slova a věty se NEGENERUJÍ - jsou ručně sepsané. Zápis:

       'r[y]ba'                 doplňuje se y
       'du[b|duby]'             za `|` je poznámka do vysvětlení
       'ob[je|ob+jet]t'         `+` v poznámce se vypíše jako „ob + jet"
       'Babička bydlí v [P|mesto]raze.'

   Poznámka podle tématu:
     iy     - žádná, pravidlo se pozná z písmene před mezerou
     dtn    - žádná
     bpvm   - u `je` rozklad na předponu (ob+jet), u `mně` příbuzné slovo (jemný)
     par    - slovo, ve kterém je souhláska slyšet (duby) - POVINNÁ
     velka  - proč velké (jmeno, zvire, mesto, reka, hora, stat, hrad, svatek);
              u malého písmene `cas` (dny a měsíce), jinak nic

   Lehká úroveň jsou jednotlivá slova (jako doplňovačky na umimecesky.cz),
   střední krátké věty, těžká delší věty s víc mezerami.

   Na co dát pozor při doplňování:
   - i/y jen po tvrdých (h, ch, k, r, d, t, n) a měkkých (ž, š, č, ř, c, j,
     ď, ť, ň) souhláskách. Po obojetných (b, f, l, m, p, s, v, z) ne - to jsou
     vyjmenovaná slova a ta přijdou až ve 3. třídě.
   - Žádná přejatá slova s di/ti/ni čtenými tvrdě (kino, rádio).
   - Párová souhláska jen tam, kde je opravdu slyšet ta druhá (na konci
     slova, před k). „Stavba" ne - v před b zní pořád v.
   - Velká písmena: žádná slova, která jsou jménem i obyčejným slovem
     (Lev, Jaro, Hora).
   ============================================================ */

export const PRAV_TOPICS = {
  iy: { label: 'Tvrdé a měkké', emoji: '🪨', grade: 2, ask: 'Doplň i, nebo y.' },
  dtn: { label: 'dě, tě, ně', emoji: '🐞', grade: 2, ask: 'Doplň e, nebo ě.' },
  bpvm: { label: 'bě, pě, vě, mě', emoji: '🐝', grade: 2, ask: 'Doplň ě, nebo je – mě, nebo mně.' },
  par: { label: 'Párové souhlásky', emoji: '👯', grade: 2, ask: 'Kterou souhlásku napíšeš?' },
  velka: { label: 'Velká písmena', emoji: '🔠', grade: 2, ask: 'Velké, nebo malé písmeno?' },
};
export const PRAV_TOPIC_KEYS = Object.keys(PRAV_TOPICS);

export const PRAV_COUNTS = [10, 20, 30];

export const PRAV_LEVELS = {
  easy: { label: 'Lehká', emoji: '🟢', note: 'jednotlivá slova' },
  medium: { label: 'Střední', emoji: '🟡', note: 'krátké věty' },
  hard: { label: 'Těžká', emoji: '🔴', note: 'delší věty, víc míst k doplnění a záludnější slova' },
};
export const PRAV_LEVEL_KEYS = Object.keys(PRAV_LEVELS);

const ITEMS = {
  iy: {
    easy: [
      'r[y]ba', 'k[y]tka', 'ch[y]ba', 'h[ý]bat', 'r[y]chle', 'k[y]selý', 'ch[y]trý', 'kr[y]sa',
      'r[y]tíř', 'k[y]blík', 't[y]gr', 'd[ý]ně', 'mot[ý]l', 't[y]kev', 'd[ý]chat', 'd[í]vka',
      't[i]cho', 'n[i]tka', 'rod[i]na', 'd[i]vadlo', 'ž[i]rafa', 'š[i]ška', 'č[í]slo', 'c[i]bule',
      'ž[i]dle', 'j[í]dlo', 'kř[í]da', 'c[i]tron', 'ř[i]d[i]č', 'hod[i]ny',
    ],
    medium: [
      'V řece plave r[y]ba.',
      'Ch[y]tila jsem míč.',
      'Ž[i]rafa má dlouhý krk.',
      'Na zahradě roste velká d[ý]ně.',
      'T[y]gr spí ve stínu.',
      'Děti hrají d[i]vadlo.',
      'Máma krájí c[i]buli.',
      'Babička vaří r[ý]ži.',
      'V lese je t[i]cho.',
      'Na ž[i]dli sedí kočka.',
      'Petr je ch[y]trý kluk.',
      'Na louce létá barevný mot[ý]l.',
      'Napiš na tabuli č[í]slo.',
      'Ř[i]d[i]č jede opatrně.',
      'Ve škole píšeme kř[í]dou.',
      'Na stromě visí š[i]šky.',
      'Kr[y]sa utekla do d[í]ry.',
      'Dědeček ch[y]tá r[y]by.',
      'Ř[í]kej mi pravdu.',
      'Máme novou kn[i]hu.',
      'K[y]selé jablko mi nechutná.',
      'Pij č[i]stou vodu.',
      'Děti si t[i]še čtou.',
      'Mámě nesu k[y]tku.',
      'C[i]tron je k[y]selý.',
      'Celá rod[i]na jede na výlet.',
      'Hod[i]ny ukazují osm.',
      'Pes h[ý]be ocasem.',
      'Mám velkou ž[í]zeň.',
      'Z komína stoupá d[ý]m.',
    ],
    hard: [
      'Hrd[i]na zachránil r[y]tíře.',
      'N[y]n[í] už víme, kdo vyhrál.',
      'Ve tmě se d[í]vám na hvězdy.',
      'Hodn[ý] pes ch[y]til míček.',
      'Na hř[i]šti stojí kovová t[y]č.',
      'Zlatá r[y]bka plave v akváriu.',
      'Děda si vyvrtl kotn[í]k a teď nemůže chodit.',
      'Ř[i]d[i]č autobusu zastavil u školy.',
      'Ch[y]trá liška č[í]há na zajíce.',
      'Babička mi k narozen[i]nám upekla dort.',
      'V kuch[y]ni voní čerstvý chléb.',
      'D[ý]chej zhluboka a počítej do deseti.',
      'T[y]kev a d[ý]ně rostou na zahradě.',
      'Na c[i]zím kole nejezdi.',
      'Kr[y]chle má šest stěn.',
      'Z d[i]ktátu mám jedn[i]čku.',
      'Ž[i]vé r[y]by plavou v kádi.',
      'Teta mi dala k[y]tici růží.',
      'V hod[i]ně čtení jsme četli pohádku.',
      'Ch[ý]še stála na kraji lesa.',
      'Na náměst[í] stojí kostel.',
      'Tat[í]nek opravuje r[ý]č.',
      'Na ř[í]čním břehu ch[y]táme r[y]by.',
      'D[i]vadlo začíná v sedm hod[i]n.',
      'Ve tř[í]dě je t[i]cho.',
      'Č[i]stý ručník leží na ž[i]dli.',
      'Mot[ý]l si sedl na k[y]tku.',
      'Kluci h[ý]bou těžkou skř[í]ní.',
      'Ž[í]zn[i]vý pes pije z kaluže.',
      'Strýc ch[y]tá r[y]by v rybn[í]ku.',
    ],
  },
  dtn: {
    easy: [
      'd[ě]ti', 't[ě]lo', 'n[ě]kdo', 'd[ě]da', 'd[ě]lat', 't[ě]žký', 'kon[ě]', 'hodn[ě]',
      'kot[ě]', 'd[ě]kuji', 'st[ě]na', 'n[ě]kde', 'd[ě]vče', 'pond[ě]lí', 't[ě]sto', 'n[ě]co',
      'lod[ě]', 'd[e]ka', 't[e]ta', 'n[e]be', 'd[e]n', 't[e]plo', 'n[e]se', 't[e]nis',
      'n[e]mocný', 'kot[e]l', 'd[e]ska', 't[e]lefon', 'n[e]vím', 'd[e]šťovka',
    ],
    medium: [
      'D[ě]ti si hrají na hřišti.',
      'T[e]ta má novou d[e]ku.',
      'Na n[e]bi svítí slunce.',
      'D[ě]da opravuje plot.',
      'Ten kufr je moc t[ě]žký.',
      'Venku je t[e]plo.',
      'Na louce se pasou kon[ě].',
      'Kot[ě] pije mléko.',
      'V pond[ě]lí jdeme do školy.',
      'Máma peče z t[ě]sta koláč.',
      'N[ě]kdo zvoní u dveří.',
      'Celý d[e]n pršelo.',
      'Vašek n[e]se tašku.',
      'Na st[ě]n[ě] visí obraz.',
      'D[ě]kuji za dárek.',
      'Bratr hraje t[e]nis.',
      'Na stole zvoní t[e]lefon.',
      'Ema je dnes n[e]mocná.',
      'Pod stromem leží n[ě]co malého.',
      'D[ě]vče si čte knížku.',
      'Vlak jel hodn[ě] rychle.',
      'Na stole leží d[e]ska.',
      'Po řece plují lod[ě].',
      'Kluci d[ě]lají bábovičky.',
      'Bolí mě celé t[ě]lo.',
      'N[e]vím, kde je klíč.',
      'Po d[e]šti je venku mokro.',
      'Na obloze n[e]jsou mraky.',
      'V lese jsme vid[ě]li srnku.',
      'Babička plete t[e]plý svetr.',
    ],
    hard: [
      'D[ě]ti n[e]sly d[ě]dovi d[e]ku.',
      'V pond[ě]lí bylo venku t[e]plo.',
      'Na n[e]bi se objevila d[ě]sivá bouřka.',
      'Kamarád mi n[ě]co šeptal do ucha.',
      'Kot[ě] spí na t[e]plé d[e]ce.',
      'T[e]ta upekla z t[ě]sta n[ě]kolik koláčů.',
      'Vid[ě]la jsem na n[e]bi duhu.',
      'Kon[ě] táhnou t[ě]žký vůz.',
      'Po d[e]šti zůstaly na cest[ě] kaluže.',
      'Na st[ě]n[ě] v pokoji visí d[ě]tské kresby.',
      'N[e]zapomeň pod[ě]kovat babičce.',
      'Maminka hladí miminko po t[ě]le.',
      'D[ě]da je n[e]mocný, leží v posteli.',
      'Ve vod[ě] plave n[ě]kolik kachen.',
      'T[e]lefon zvonil celý d[e]n.',
      'Na hrad[ě] žil statečný rytíř.',
      'Na zahrad[ě] kvetou tulipány.',
      'Po obloze letí n[e]známý pták.',
      'Dávej si pozor na t[ě]žkou tašku.',
      'Kluci hráli t[e]nis až do večera.',
      'V kuchyni se d[ě]lá n[ě]co dobrého.',
      'Ve měst[ě] je hodn[ě] aut.',
      'Kot[e]l hřeje celý dům.',
      'Táta n[e]se t[ě]žké d[e]sky.',
      'Na koupališti jsou d[ě]ti i dospělí.',
      'V n[e]d[ě]li jedeme k babičce.',
      'N[ě]kde v lese houká sova.',
      'Kot[ě] se schovalo v t[e]plém pelíšku.',
      'Odpoledne jsme vid[ě]li d[ě]tské představení.',
      'Hodn[ě] štěstí ti přeje celá rodina.',
    ],
  },
  bpvm: {
    easy: [
      'b[ě]h', 'b[ě]žet', 'p[ě]t', 'p[ě]na', 'v[ě]c', 'v[ě]ž', 'sv[ě]t', 'kv[ě]tina',
      'v[ě]tev', 'zp[ě]v', 'p[ě]kný', 'v[ě]dro', 'hv[ě]zda', 'p[ě]st', 'v[ě]trník', 'b[ě]hat',
      'p[ě]šky', 'v[ě]trovka','[mě]sto', '[mě]síc', '[mě]kký', 'z[mě]na', 'ze[mě]', 'ob[je|ob+jet]t',
      'ob[je|ob+jednat]dnat', 'ob[je|ob+jevit]vit', 'v[je|v+jezd]zd', 'v[je|v+jet]t', 'v[je|v+jela]la', 'b[ě]lásek',
    ],
    medium: [
      'Na hřišti b[ě]háme dokola.',
      'Ve [mě]stě je velký park.',
      'Na nebi svítí [mě]síc.',
      'Máma mi koupila p[ě]knou sukni.',
      'Musíme ob[je|ob+jet]t tu louži.',
      'Do garáže v[je|v+jelo]lo auto.',
      'Na v[ě]tvi sedí pták.',
      'Na zahradě kvete kv[ě]tina.',
      'Polštář je [mě]kký.',
      'Táta ob[je|ob+jednal]dnal pizzu.',
      'Mám p[ě]t pastelek.',
      'Rozhledna je vysoká v[ě]ž.',
      'V noci svítí hv[ě]zdy.',
      'Mluv na kotě je[mně|jemný].',
      'Před domem je v[je|v+jezd]zd do garáže.',
      'Babička má na hlavě p[ě]kný klobouk.',
      'Ve vaně je hodně p[ě]ny.',
      'Kolumbus ob[je|ob+jevil]vil Ameriku.',
      'V lese je příje[mně|příjemný] chladno.',
      'Ze[mě] je kulatá.',
      'Každý den b[ě]žím do školy.',
      'Zp[ě]v ptáků nás budí ráno.',
      'Ve škole je z[mě]na rozvrhu.',
      'Táta nese v[ě]dro vody.',
      'Do školy chodím p[ě]šky.',
      'Malé děti se chovaly rozu[mně|rozumný].',
      'V obchodě je spousta v[ě]cí.',
      'Na sv[ě]tě je mnoho zemí.',
      'Kocour se tváří taje[mně|tajemný].',
      'Po b[ě]hu mám velkou žízeň.',
    ],
    hard: [
      'Ve [mě]stě jsme ob[je|ob+jeli]li celé náměstí.',
      'Po obědě jsme se p[ě]šky vydali do [mě]sta.',
      'Před v[je|v+jezd]zdem nesmí parkovat auta.',
      'Babička mluvila tiše a příje[mně|příjemný].',
      'V[ě]tev se pod těžkým sněhem zlomila.',
      'Na podzim jsme v lese ob[je|ob+jevili]vili spoustu hub.',
      'Na ob[je|ob+jednat]dnávku čekáme už p[ě]t dní.',
      'Celou noc svítí [mě]síc a hv[ě]zdy.',
      'Na sv[ě]tě žije mnoho zvířat.',
      'Zp[ě]vačka zpívala je[mně|jemný].',
      'Na posteli leží [mě]kký polštář.',
      'Kluci se chovali rozu[mně|rozumný] a nikam neb[ě]želi.',
      'Auto v[je|v+jelo]lo do tunelu.',
      'V cukrárně jsme ob[je|ob+jednali]dnali dort s p[ě]ti svíčkami.',
      'Z v[ě]že je krásný výhled na [mě]sto.',
      'Ve tmě vypadal hrad taje[mně|tajemný].',
      'Na zahradě kvetou b[ě]lostné kv[ě]tiny.',
      'Tatínek si ob[je|ob+jednal]dnal kávu.',
      'Holčička b[ě]žela za kotětem.',
      'Když se ochladí, z[mě]ní se déšť ve sníh.',
      'P[ě]na z mýdla mi vlezla do oka.',
      'V létě je u vody příje[mně|příjemný].',
      'Táta nesl dv[ě] plná v[ě]dra.',
      'V lese jsme ob[je|ob+jevili]vili [mě]kký mech.',
      'Sestra se usmívala skro[mně|skromný].',
      'Vlak pomalu v[je|v+jel]l do stanice.',
      'V[ě]trník se točí ve v[ě]tru.',
      'V noci přišla velká z[mě]na počasí.',
      'Ve sv[ě]tě pohádek žijí draci.',
      'Ve [mě]stě stojí p[ě]t vysokých v[ě]ží.',
    ],
  },
  par: {
    easy: [
      'du[b|duby]', 'zu[b|zuby]', 'hra[d|hrady]', 'ha[d|hadi]', 'le[d|ledy]', 'me[d|medu]',
      'plo[t|ploty]', 'chlé[b|chleba]', 'sní[h|sněhu]', 'bře[h|břehy]', 'ro[h|rohy]', 'mrá[z|mrazy]',
      'no[s|nosy]', 'pe[s|psi]', 'vů[z|vozy]', 'nů[ž|nože]', 'my[š|myši]', 'ko[š|koše]',
      'vě[ž|věže]', 'le[v|lvi]', 'kre[v|krve]', 'ze[ď|zdi]', 'lo[ď|lodě]', 'oře[ch|ořechy]',
      'du[ch|duchové]', 'pra[ch|prachu]', 'mu[ž|muži]', 'chla[p|chlapi]', 'ku[s|kusy]', 'obra[z|obrazy]',
    ],
    medium: [
      'Na kopci stojí starý hra[d|hrady].',
      'Na zahradě roste vysoký du[b|duby].',
      'Pe[s|psi] štěká na kočku.',
      'V zimě padá sní[h|sněhu].',
      'Na řece je tlustý le[d|ledy].',
      'Babička peče chlé[b|chleba].',
      'Kolem domu je dřevěný plo[t|ploty].',
      'Malá my[š|myši] utekla do díry.',
      'Venku je velký mrá[z|mrazy].',
      'Na stole leží ostrý nů[ž|nože].',
      'V trávě se plazí ha[d|hadi].',
      'Vypadl mi zu[b|zuby].',
      'Medvě[d|medvědi] má rád me[d|medu].',
      'V zoo spí le[v|lvi].',
      'Po řece pluje lo[ď|lodě].',
      'Kolem zahrady je vysoká ze[ď|zdi].',
      'Do ko[š|koše] dej papír.',
      'U řeky je strmý bře[h|břehy].',
      'Veverka louská oře[ch|ořechy].',
      'Na půdě je hodně pra[ch|prachu].',
      'Táta je silný mu[ž|muži].',
      'Dej mi ku[s|kusy] koláče.',
      'Na stěně visí obra[z|obrazy].',
      'Na náměstí stojí vysoká vě[ž|věže].',
      'Kůň táhne vů[z|vozy].',
      'V pohádce straší du[ch|duchové].',
      'Beran má zatočený ro[h|rohy].',
      'Z rány teče kre[v|krve].',
      'Klaun má červený no[s|nosy].',
      'Přes potok vede dřevěný mos[t|mosty].',
    ],
    hard: [
      'Zlatá ry[b|ryba]ka plave v akváriu.',
      'Ža[b|žába]ka sedí na lekníně.',
      'Na zahrá[d|zahrada]ce roste mrke[v|mrkve].',
      'Ten čaj je moc sla[d|sladit]ký.',
      'Bratr a sestra mají há[d|hádat]ku.',
      'Na stole leží kní[ž|knížečka]ka.',
      'Kluci jedou na výle[t|výlety].',
      'Ten kamínek je hla[d|hladit]ký.',
      'Bato[h|batohy] je le[h|lehoučký]ký.',
      'Ta cesta je moc ú[z|úzoučký]ká.',
      'Plo[t|ploty] kolem zahrady je ní[z|nízoučký]ký.',
      'Na komíně stojí čá[p|čápi].',
      'Na střeše sedí holu[b|holubi].',
      'Nad lesem krouží jestřá[b|jestřábi].',
      'V lese jsme našli velký hři[b|hřiby].',
      'Máma vaří polévku z hrá[ch|hrachu].',
      'Babička má zelenou kone[v|konve].',
      'Ve tmě na mě padl stra[ch|strachu].',
      'Na rohu ulice je nový obcho[d|obchody].',
      'V domě je nový výta[h|výtahy].',
      'Na stromě zpívá droz[d|drozdi].',
      'Ta sukně je moc he[z|hezoučký]ká.',
      'Pe[s|psi] hlídá zahrá[d|zahrada]ku.',
      'Venku je mrá[z|mrazy] a na řece le[d|ledy].',
      'Medvě[d|medvědi] našel v lese me[d|medu].',
      'Kočka chytila my[š|myši] za ocas.',
      'Ko[š|koše] na prádlo je plný.',
      'Loňský sní[h|sněhu] už dávno roztál.',
      'Velká lo[ď|lodě] má vysoký stěžeň.',
      'Le[v|lvi] leží ve stínu.',
    ],
  },
  velka: {
    easy: [
      '[P|jmeno]etr', '[p]es', '[P|mesto]raha', '[m]ěsto', '[E|jmeno]va', '[k]očka',
      '[B|mesto]rno', '[ř]eka', '[V|reka]ltava', '[h]ora', '[S|hora]něžka', '[A|zvire]lík',
      '[M|zvire]icka', '[s]tůl', '[T|jmeno]omáš', '[š]kola', '[L|reka]abe', '[O|mesto]strava',
      '[d]ům', '[J|jmeno]ana', '[k]amarád', '[Č|stat]esko', '[S|stat]lovensko', '[t]atínek',
      '[b]abička', '[Ř|hora]íp', '[K|jmeno]uba', '[l]es', '[O|mesto]lomouc', '[M|jmeno]arie',
    ],
    medium: [
      'Můj pes se jmenuje [A|zvire]lík.',
      'Babička bydlí v [P|mesto]raze.',
      'Kamarádka [E|jmeno]va má nové kolo.',
      'Přes [P|mesto]rahu teče [V|reka]ltava.',
      'Naše [k]očka se jmenuje [M|zvire]icka.',
      '[D]nes jdeme do školy.',
      'Na [S|hora]něžku vede lanovka.',
      'Táta jede do [B|mesto]rna.',
      'U [ř]eky stojí mlýn.',
      'Bratr [T|jmeno]omáš chodí do třetí třídy.',
      'V [Č|stat]esku je hodně hradů.',
      'Na [h]oře leží sníh.',
      'Naše paní učitelka se jmenuje [N|jmeno]ováková.',
      'Na výletě jsme viděli horu [Ř|hora]íp.',
      '[P]o škole jdu za [J|jmeno]anou.',
      'Kůň [B|zvire]lesk běží po louce.',
      'V létě jedeme na [S|stat]lovensko.',
      'Naše [m]ěsto má nové náměstí.',
      'Teta [M|jmeno]arie peče buchty.',
      'Řeka [L|reka]abe teče do Německa.',
      'Můj [k]amarád se jmenuje [K|jmeno]uba.',
      'Morče [F|zvire]ifinka jí mrkev.',
      '[V] [O|mesto]stravě je velká zoo.',
      'Děda chytá ryby v [ř]ece [O|reka]rlici.',
      'Byli jsme na hradě [K|hrad]arlštejn.',
      'Moje sestra [L|jmeno]ucie má ráda koně.',
      'Za [l]esem je malá vesnice.',
      'Na [n]ebi létají ptáci.',
      'Pes [R|zvire]ex hlídá dům.',
      'Do [O|mesto]lomouce jedeme vlakem.',
    ],
    hard: [
      'V [p|cas]ondělí jedeme do [P|mesto]rahy.',
      'Babička bydlí v [Ú|mesto]stí [n]ad [L|mesto]abem.',
      'Na [V|svatek]ánoce pojedeme na [S|stat]lovensko.',
      'V [l|cas]ednu jsme byli v [K|hora]rkonoších.',
      'Pes [A|zvire]rgo a kočka [M|zvire]inda spí spolu.',
      'Řeka [V|reka]ltava teče přes [Č|mesto]eské [B|mesto]udějovice.',
      'Teta [J|jmeno]ana [D|jmeno]voráková je zubařka.',
      'V [ú|cas]terý jedeme k [ř]ece [S|reka]ázavě.',
      'Na [S|hora]něžku jsme šli v [č|cas]ervenci.',
      'Moje [s]estra [E|jmeno]liška chodí do [š]kolky.',
      'Žijeme v [Č|stat]eské [r]epublice.',
      'Na [V|svatek]elikonoce malujeme vajíčka.',
      '[O] prázdninách pojedeme k [m]oři do [C|stat]horvatska.',
      'Hrad [Š|hrad]pilberk stojí v [B|mesto]rně.',
      'Kamarád [O|jmeno]ndra má psa [B|zvire]ena.',
      'V [n|cas]eděli jsme jeli do [N|mesto]ového [M|mesto]ěsta.',
      'Z [Ř|hora]ípu je vidět řeku [L|reka]abe.',
      'Pan [N|jmeno]ovák je náš [s]oused.',
      'Do [O|mesto]lomouce pojedeme v [s|cas]obotu.',
      'V [ú|cas]noru byl na [h]orách sníh.',
      'Naše [k]očka [M|zvire]icka chytila myš.',
      'Babička [M|jmeno]arie bydlí ve [Z|mesto]líně.',
      'V [Č|stat]esku teče řeka [M|reka]orava.',
      'Na [V|svatek]ánoce přijede strýc [K|jmeno]arel.',
      'Na [Š|hora]umavě jsme viděli jelena.',
      'Moje [k]amarádka [T|jmeno]ereza bydlí v [P|mesto]lzni.',
      'V [b|cas]řeznu jsme byli v [O|mesto]stravě.',
      'Želva [Š|zvire]ňupka spí celou zimu.',
      'V [P|stat]olsku žije můj [s]trýc.',
      'Teta [E|jmeno]va jede z [B|mesto]rna do [P|mesto]rahy.',
    ],
  },
};

/* Tvrdé a měkké souhlásky - podle nich se rozhoduje i/y. d, t, n jsou
   zvlášť: ty mají obojí (dy tvrdě, di měkce), poznají se poslechem. */
const HARD = ['h', 'ch', 'k', 'r'];
const SOFT = ['ž', 'š', 'č', 'ř', 'c', 'j', 'ď', 'ť', 'ň'];
const DTN = ['d', 't', 'n'];

/* Párové souhlásky - znělá a neznělá. */
const PAIRS = [['b', 'p'], ['d', 't'], ['ď', 'ť'], ['z', 's'], ['ž', 'š'], ['h', 'ch'], ['v', 'f']];

const isLetter = (ch) => /\p{L}/u.test(ch);

/* Co se nabídne na klávesách u jedné mezery. Vrací null, když se odpověď
   do tématu nehodí - na to upozorní kontrolní skript. */
function optionsFor(topic, answer) {
  if (topic === 'iy') {
    if (answer === 'i' || answer === 'y') return ['i', 'y'];
    if (answer === 'í' || answer === 'ý') return ['í', 'ý'];
    return null;
  }
  if (topic === 'dtn') return answer === 'e' || answer === 'ě' ? ['e', 'ě'] : null;
  if (topic === 'bpvm') {
    if (answer === 'ě' || answer === 'je') return ['ě', 'je'];
    if (answer === 'mě' || answer === 'mně') return ['mě', 'mně'];
    return null;
  }
  if (topic === 'par') return PAIRS.find((p) => p.includes(answer)) || null;
  if (topic === 'velka') {
    const lower = answer.toLowerCase();
    return lower === answer.toUpperCase() ? null : [lower, lower.toUpperCase()];
  }
  return null;
}

/* Souhláska před mezerou - `ch` je jedno písmeno. */
function before(word, pos) {
  const two = word.slice(Math.max(0, pos - 2), pos).toLowerCase();
  if (two === 'ch') return 'ch';
  return word.slice(pos - 1, pos).toLowerCase();
}

/* Jeden zápis → tokeny k vykreslení a seznam mezer, stejně jako `parseUu()`.
   Token je slovo i s interpunkcí, ať se mezera neodtrhne od slova. */
export function parsePrav(src, topic, single = false) {
  const gaps = [];
  const tokens = src.split(' ').map((raw, ti) => {
    const parts = [];
    let word = '';
    const local = [];
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '[') {
        const end = raw.indexOf(']', i);
        const [answer, note = ''] = raw.slice(i + 1, end).split('|');
        local.push({ pos: word.length, answer, note });
        parts.push({ g: gaps.length + local.length - 1 });
        word += answer;
        i = end;
        continue;
      }
      const last = parts[parts.length - 1];
      if (last && 's' in last) last.s += ch;
      else parts.push({ s: ch });
      if (isLetter(ch)) word += ch;
    }
    for (const l of local) {
      gaps.push({
        topic,
        answer: l.answer,
        opts: optionsFor(topic, l.answer),
        word,
        pos: l.pos,
        before: before(word, l.pos),
        note: l.note.replace(/\+/g, ' + '),
        // velké písmeno na začátku věty - u samotného slova to neplatí
        start: !single && ti === 0 && l.pos === 0,
        upper: false, // písmeno se ukazuje přesně tak, jak je v `opts`
      });
    }
    return parts;
  });
  const text = src.replace(/\[[^\]]+\]/g, '_');
  const full = src.replace(/\[([^\]|]+)(\|[^\]]*)?\]/g, '$1');
  return { tokens, gaps, text, full };
}

/* Rozdělí počet úloh mezi zapnutá témata co nejrovnoměrněji. */
function shares(n, k) {
  const base = Math.floor(n / k);
  const extra = shuffle([...Array(k).keys()]).slice(0, n % k);
  return [...Array(k).keys()].map((i) => base + (extra.includes(i) ? 1 : 0));
}

export function makePravRound(levelKey = 'easy', topics = PRAV_TOPIC_KEYS, count = 10) {
  const level = PRAV_LEVELS[levelKey] ? levelKey : 'easy';
  const n = PRAV_COUNTS.includes(count) ? count : PRAV_COUNTS[0];
  const on = PRAV_TOPIC_KEYS.filter((t) => topics.includes(t));
  const list = on.length ? on : PRAV_TOPIC_KEYS;
  const single = level === 'easy';
  const picked = [];
  shares(n, list.length).forEach((k, i) => {
    const topic = list[i];
    for (const src of shuffle(ITEMS[topic][level]).slice(0, k)) picked.push({ topic, src });
  });
  return shuffle(picked).map(({ topic, src }) => {
    const p = parsePrav(src, topic, single);
    return {
      topic,
      level,
      single,
      ...p,
      answer: p.gaps.map((g) => g.answer).join(', '),
      key: `${topic}|${src}`,
    };
  });
}

/* Všechna slova a věty - pro kontrolní skript. */
export const PRAV_ITEMS = ITEMS;

/* Tag chyby podle tématu první špatně doplněné mezery. */
const TOPIC_TAG = { iy: 'pravIY', dtn: 'pravDTN', bpvm: 'pravBPV', par: 'pravPar', velka: 'pravVelka' };
export function pravTag(ex, picks) {
  const g = ex.gaps.find((gap, k) => picks[k] !== gap.answer);
  return g ? TOPIC_TAG[g.topic] : null;
}

const VELKA_WHY = {
  jmeno: 'jména a příjmení lidí',
  zvire: 'jména zvířat',
  mesto: 'názvy měst a vesnic',
  reka: 'názvy řek',
  hora: 'názvy hor a pohoří',
  stat: 'názvy států',
  hrad: 'názvy hradů a zámků',
  svatek: 'názvy svátků',
};

/* Jedna věta vysvětlení k jedné mezeře. **tučné** převádí app.js na <b>. */
function rule(g) {
  const w = `**${g.word}**`;
  const a = g.answer;
  if (g.topic === 'iy') {
    const c = g.before;
    if (HARD.includes(c)) return `${w} – po tvrdé souhlásce **${c}** píšeme tvrdé **${a}**.`;
    if (SOFT.includes(c)) return `${w} – po měkké souhlásce **${c}** píšeme měkké **${a}**.`;
    if (DTN.includes(c)) {
      return a === 'y' || a === 'ý'
        ? `${w} – **${c}${a}** čteme tvrdě, proto píšeme tvrdé **${a}**.`
        : `${w} – **${c}${a}** čteme měkce (jako ${{ d: 'ď', t: 'ť', n: 'ň' }[c]}${a}), proto píšeme měkké **${a}**.`;
    }
    return `${w} – tady se píše **${a}**.`;
  }
  if (g.topic === 'dtn') {
    const c = g.before;
    return a === 'ě'
      ? `${w} – slyšíme **${{ d: 'ďe', t: 'ťe', n: 'ňe' }[c] || 'ďe'}**, ale píšeme **${c}ě**.`
      : `${w} – **${c}e** čteme tvrdě, píšeme jen **e** bez háčku.`;
  }
  if (g.topic === 'bpvm') {
    if (a === 'je') return `${w} – slovo se skládá ze dvou částí (**${g.note}**), proto píšeme **je**.`;
    if (a === 'mně') return `${w} – ve slově **${g.note}** slyšíme **mn**, proto píšeme **mně**.`;
    if (a === 'mě') return `${w} – slyšíme **mňe**, ale píšeme **mě**.`;
    return `${w} – slyšíme **${g.before}je**, ale píšeme **${g.before}ě**.`;
  }
  if (g.topic === 'par') {
    const where = g.pos + a.length >= g.word.length ? 'na konci slova' : 'uprostřed slova';
    // zdi, lodě - ď je slyšet, ale píše se tam d (di, dě)
    if (a === 'ď' || a === 'ť') {
      return `${w} – ${where} to zní jinak. Řekni si **${g.note}** a uslyšíš měkké **${a}**. Proto **${a}**.`;
    }
    return `${w} – ${where} to zní jinak. Řekni si **${g.note}** a uslyšíš **${a}**. Proto **${a}**.`;
  }
  if (g.topic === 'velka') {
    if (g.start) return `${w} – na začátku věty píšeme velké písmeno.`;
    if (a !== a.toLowerCase()) return `${w} – ${VELKA_WHY[g.note] || 'vlastní jména'} píšeme s velkým písmenem.`;
    if (g.note === 'cas') return `${w} – dny v týdnu a měsíce píšeme s malým písmenem.`;
    return `${w} – není to jméno, ale obyčejné slovo. Píšeme ho s malým písmenem.`;
  }
  return `${w} – tady se píše **${a}**.`;
}

/* Kroky vysvětlení po chybě. Když přijdou doplněná písmena, vysvětlí se
   jen ta špatná. */
export function pravExplain(ex, picks = null) {
  const gaps = picks ? ex.gaps.filter((g, i) => picks[i] !== g.answer) : ex.gaps;
  const steps = [];
  const seen = new Set();
  for (const g of gaps) {
    const line = rule(g);
    if (seen.has(line)) continue;
    seen.add(line);
    steps.push(line);
  }
  if (ex.topic === 'iy' && gaps.length) {
    steps.push('Tvrdé souhlásky: **h, ch, k, r, d, t, n**. Měkké souhlásky: **ž, š, č, ř, c, j, ď, ť, ň**.');
  }
  steps.push(`${ex.single ? 'Celé slovo' : 'Celá věta'}: **${ex.full}**`);
  return steps;
}

export function pravText(ex, reveal) {
  return reveal ? ex.full : ex.text;
}
