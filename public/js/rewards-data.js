/* Postavicky odmen - kazda je samostatny obrazek .webp.
 *
 * Sbirek je vic (dumplingy, labubaci, casem treba auticka). Dite si na strance
 * sbirky vybere, kterou sbira - jednu, nebo vic naraz. Kategorie vzacnosti
 * (zakladni az legendarni) jsou pro vsechny sbirky spolecne, pravidla odmen
 * v rewards.js o sbirkach nic nevi.
 *
 * Obrazky lezi v public/img/odmeny/<sbirka>/<kategorie>/<soubor>.webp.
 * Graficke nadpisy kategorii jsou obecne ("Bezne" ...), takze je sbirky
 * sdileji - lezi v .../dumplings/_category_titles/<kategorie>.webp.
 * Staticky web neumi vypsat obsah slozky, proto je kazda postavicka zapsana
 * tady - soubor a ceske jmeno.
 *
 * ID (basic_01, lab_basic_01 ...) jsou to, co si aplikace uklada do sbirky
 * ditete. NIKDY je nemen ani neprecislovavej - dite by prislo o ziskane
 * postavicky. Obrazek se k ID da vymenit kdykoli, jmeno taky. ID jsou
 * unikatni napric vsemi sbirkami; dalsi sbirka dostane vlastni predponu.
 *
 * Nova postavicka = novy obrazek do slozky kategorie + novy radek do seznamu
 * s dalsim volnym ID + to ID NA KONEC `TRANSFER_ORDER`.
 *
 * Nova sbirka = radek v `COLLECTIONS` a jeji klic v `COLLECTION_ORDER`,
 * slozka s obrazky a jeji ID na konec `TRANSFER_ORDER`.
 *
 * Tenhle modul je cista data, nic neimportuje. Zavislosti jdou jednim smerem:
 * rewards-data.js -> rewards.js -> rewards-ui.js -> app.js
 */

/* Poradi kategorii od nejbeznejsi po nejvzacnejsi. Pouziva ho stranka sbirky
   i poradi, v jakem se odmeny odhaluji po dokonceni kola. */
export const CATEGORY_ORDER = ['basic', 'uncommon', 'rare', 'epic', 'legendary'];

export const CATEGORY_LABEL = {
  basic: 'Základní',
  uncommon: 'Neobvyklé',
  rare: 'Raritní',
  epic: 'Epické',
  legendary: 'Legendární',
};

export const categoryLabel = (key) => CATEGORY_LABEL[key] ?? '';

const DUMPLINGS = {
  basic: [
    { id: 'basic_01', file: 'modracek', name: 'Modráček' },
    { id: 'basic_02', file: 'ruzenka', name: 'Růženka' },
    { id: 'basic_03', file: 'zelenac', name: 'Zelenáč' },
    { id: 'basic_04', file: 'zlutasek', name: 'Žluťásek' },
    { id: 'basic_05', file: 'fialka', name: 'Fialka' },
    { id: 'basic_06', file: 'smetanek', name: 'Smetánek' },
    { id: 'basic_07', file: 'pomerancik', name: 'Pomerančík' },
    { id: 'basic_08', file: 'tyrkysacek', name: 'Tyrkysáček' },
    { id: 'basic_09', file: 'puntikatka', name: 'Puntíkatka' },
    { id: 'basic_10', file: 'bzucilka', name: 'Bzučilka' },
    { id: 'basic_11', file: 'hrabacek', name: 'Hrabáček' },
    { id: 'basic_12', file: 'cervena_kapicka', name: 'Červená kapička' },
    { id: 'basic_13', file: 'dreveny_nosanek', name: 'Dřevěný nosánek' },
    { id: 'basic_14', file: 'mechacek', name: 'Mecháček' },
    { id: 'basic_15', file: 'muchomurka', name: 'Muchomůrka' },
    { id: 'basic_16', file: 'kovbojik', name: 'Kovbojík' },
    { id: 'basic_17', file: 'piratek', name: 'Pirátek' },
    { id: 'basic_18', file: 'kuchtik', name: 'Kuchtík' },
    { id: 'basic_19', file: 'hasicik', name: 'Hasičík' },
    { id: 'basic_20', file: 'sestricka', name: 'Sestřička' },
    { id: 'basic_21', file: 'stetecek', name: 'Malíř Štěteček' },
    { id: 'basic_22', file: 'fotbalista', name: 'Fotbalista' },
    { id: 'basic_23', file: 'rytirik', name: 'Rytířík' },
    { id: 'basic_24', file: 'detektiv_lupa', name: 'Detektiv Lupa' },
    { id: 'basic_25', file: 'cestovatel', name: 'Cestovatel' },
    { id: 'basic_26', file: 'farmarik', name: 'Farmářík' },
  ],
  uncommon: [
    { id: 'uncommon_01', file: 'duhacek', name: 'Duháček' },
    { id: 'uncommon_02', file: 'malinovy_trpyt', name: 'Malinový třpyt' },
    { id: 'uncommon_03', file: 'duhovy_ocean', name: 'Duhový oceán' },
    { id: 'uncommon_04', file: 'kvetinka', name: 'Květinka' },
    { id: 'uncommon_05', file: 'perletacek', name: 'Perleťáček' },
    { id: 'uncommon_06', file: 'medenak', name: 'Měděňák' },
    { id: 'uncommon_07', file: 'brejloun', name: 'Brejloun' },
    { id: 'uncommon_08', file: 'cukrova_posypka', name: 'Cukrová posypka' },
    { id: 'uncommon_09', file: 'morska_panenka', name: 'Mořská panenka' },
    { id: 'uncommon_10', file: 'snehulak', name: 'Sněhulák' },
    { id: 'uncommon_11', file: 'beruska', name: 'Beruška' },
    { id: 'uncommon_12', file: 'lesni_lucistnik', name: 'Lesní lučištník' },
    { id: 'uncommon_13', file: 'kostetka', name: 'Čarodějka Koštětka' },
    { id: 'uncommon_14', file: 'spechajici_kralik', name: 'Spěchající králík' },
    { id: 'uncommon_15', file: 'hodny_kral', name: 'Hodný král' },
    { id: 'uncommon_16', file: 'ruzova_kralovna', name: 'Růžová královna' },
  ],
  rare: [
    { id: 'rare_01', file: 'zelezny_strazce', name: 'Železný strážce' },
    { id: 'rare_02', file: 'draci_bojovnik', name: 'Dračí bojovník' },
    { id: 'rare_03', file: 'punkovy_valecnik', name: 'Punkový válečník' },
    { id: 'rare_04', file: 'parni_vynalezce', name: 'Parní vynálezce' },
    { id: 'rare_05', file: 'radioaktivni_slizoun', name: 'Radioaktivní slizoun' },
    { id: 'rare_06', file: 'lavovy_demon', name: 'Lávový démon' },
    { id: 'rare_07', file: 'pirat', name: 'Pirát' },
    { id: 'rare_08', file: 'dobrodruh', name: 'Dobrodruh' },
    { id: 'rare_09', file: 'bazinovy_obr', name: 'Bažinový obr' },
    { id: 'rare_10', file: 'pirko', name: 'Lučištník Pírko' },
    { id: 'rare_11', file: 'loupeznik_z_lesa', name: 'Loupežník z lesa' },
    { id: 'rare_12', file: 'letajici_kluk', name: 'Létající kluk' },
    { id: 'rare_13', file: 'chuva_s_destnikem', name: 'Chůva s deštníkem' },
  ],
  epic: [
    { id: 'epic_01', file: 'maly_kouzelnik', name: 'Malý kouzelník' },
    { id: 'epic_02', file: 'ledova_kralovna', name: 'Ledová královna' },
    { id: 'epic_03', file: 'stavebnicovy_hrdina', name: 'Stavebnicový hrdina' },
    { id: 'epic_04', file: 'pan_ucitel', name: 'Pan učitel' },
    { id: 'epic_05', file: 'neonovy_kyberbojovnik', name: 'Neonový kyberbojovník' },
    { id: 'epic_06', file: 'vesmirny_pruzkumnik', name: 'Vesmírný průzkumník' },
    { id: 'epic_07', file: 'kristalova_vila', name: 'Křišťálová víla' },
    { id: 'epic_08', file: 'hvezdny_snilek', name: 'Hvězdný snílek' },
    { id: 'epic_09', file: 'plesova_princezna', name: 'Plesová princezna' },
    { id: 'epic_10', file: 'namornik', name: 'Námořník' },
    { id: 'epic_11', file: 'nindza', name: 'Nindža' },
    { id: 'epic_12', file: 'viking', name: 'Viking' },
  ],
  legendary: [
    { id: 'legendary_01', file: 'zlaty_kral', name: 'Zlatý král' },
    { id: 'legendary_02', file: 'zlaty_vyherce', name: 'Zlatý výherce' },
    { id: 'legendary_03', file: 'rubinovy_kral', name: 'Rubínový král' },
    { id: 'legendary_04', file: 'duhova_cisarovna', name: 'Duhová císařovna' },
    { id: 'legendary_05', file: 'mesicni_carodejka', name: 'Měsíční čarodějka' },
    { id: 'legendary_06', file: 'velky_kouzelnik', name: 'Velký kouzelník' },
    { id: 'legendary_07', file: 'roboticky_titan', name: 'Robotický titán' },
    { id: 'legendary_08', file: 'ledova_cisarovna', name: 'Ledová císařovna' },
    { id: 'legendary_09', file: 'duch_z_lampy', name: 'Duch z lampy' },
    { id: 'legendary_10', file: 'lvi_kral', name: 'Lví král' },
    { id: 'legendary_11', file: 'drak_poklad', name: 'Drak strážce pokladu' },
  ],
};

/* 19. 10. 2026: rozrezany list labubaci/Designer.png (121 postavicek).
   Rozdeleni do kategorii odpovida dumplingum: barvy a povolani zakladni,
   zviratka a muzikanti neobvykli, dobrodruzi a strasidla raritni, kouzla
   a princezny epicke, hrdinove, draci a kralove legendarni. */
const LABUBU = {
  basic: [
    { id: 'lab_basic_01', file: 'vanilka', name: 'Vanilka' },
    { id: 'lab_basic_02', file: 'ruzovka', name: 'Růžovka' },
    { id: 'lab_basic_03', file: 'blankytka', name: 'Blankytka' },
    { id: 'lab_basic_04', file: 'citronek', name: 'Citrónek' },
    { id: 'lab_basic_05', file: 'mrkalka', name: 'Mrkálka' },
    { id: 'lab_basic_06', file: 'uhlik', name: 'Uhlík' },
    { id: 'lab_basic_07', file: 'vcelka', name: 'Včelka' },
    { id: 'lab_basic_08', file: 'kopacek', name: 'Kopáček' },
    { id: 'lab_basic_09', file: 'lesnicek', name: 'Lesníček' },
    { id: 'lab_basic_10', file: 'belasek', name: 'Bělásek' },
    { id: 'lab_basic_11', file: 'sedivacek', name: 'Šediváček' },
    { id: 'lab_basic_12', file: 'kuchar_varecka', name: 'Kuchař Vařečka' },
    { id: 'lab_basic_13', file: 'hasic', name: 'Hasič' },
    { id: 'lab_basic_14', file: 'zdravotnice', name: 'Zdravotnice' },
    { id: 'lab_basic_15', file: 'malirka', name: 'Malířka' },
    { id: 'lab_basic_16', file: 'doktorka', name: 'Doktorka' },
    { id: 'lab_basic_17', file: 'policista', name: 'Policista' },
    { id: 'lab_basic_18', file: 'stavbar', name: 'Stavbař' },
    { id: 'lab_basic_19', file: 'vyletnik_s_mapou', name: 'Výletník s mapou' },
    { id: 'lab_basic_20', file: 'zahradnik', name: 'Zahradník' },
    { id: 'lab_basic_21', file: 'slidil_s_lupou', name: 'Slídil s lupou' },
    { id: 'lab_basic_22', file: 'lovec_motylu', name: 'Lovec motýlů' },
    { id: 'lab_basic_23', file: 'absolvent', name: 'Absolvent' },
    { id: 'lab_basic_24', file: 'mnisek', name: 'Mníšek' },
    { id: 'lab_basic_25', file: 'zpevak', name: 'Zpěvák' },
    { id: 'lab_basic_26', file: 'elegan', name: 'Elegán' },
    { id: 'lab_basic_27', file: 'strelec_golu', name: 'Střelec gólů' },
    { id: 'lab_basic_28', file: 'cyklista', name: 'Cyklista' },
    { id: 'lab_basic_29', file: 'lyzar', name: 'Lyžař' },
    { id: 'lab_basic_30', file: 'snowboardista', name: 'Snowboardista' },
    { id: 'lab_basic_31', file: 'plavec', name: 'Plavec' },
    { id: 'lab_basic_32', file: 'tenista', name: 'Tenista' },
    { id: 'lab_basic_33', file: 'hokejista', name: 'Hokejista' },
    { id: 'lab_basic_34', file: 'baseballista', name: 'Baseballista' },
    { id: 'lab_basic_35', file: 'basketbalista', name: 'Basketbalista' },
    { id: 'lab_basic_36', file: 'pingpongista', name: 'Pingpongista' },
    { id: 'lab_basic_37', file: 'badmintonista', name: 'Badmintonista' },
    { id: 'lab_basic_38', file: 'sermir', name: 'Šermíř' },
    { id: 'lab_basic_39', file: 'karatista', name: 'Karatista' },
  ],
  uncommon: [
    { id: 'lab_uncommon_01', file: 'puntik', name: 'Puntík' },
    { id: 'lab_uncommon_02', file: 'karkulka', name: 'Karkulka' },
    { id: 'lab_uncommon_03', file: 'nosanek', name: 'Nosánek' },
    { id: 'lab_uncommon_04', file: 'hribek', name: 'Hříbek' },
    { id: 'lab_uncommon_05', file: 'pirat_s_paskou', name: 'Pirát s páskou' },
    { id: 'lab_uncommon_06', file: 'tygrik', name: 'Tygřík' },
    { id: 'lab_uncommon_07', file: 'lvicek', name: 'Lvíček' },
    { id: 'lab_uncommon_08', file: 'pandicka', name: 'Pandička' },
    { id: 'lab_uncommon_09', file: 'medvidek', name: 'Medvídek' },
    { id: 'lab_uncommon_10', file: 'koala', name: 'Koala' },
    { id: 'lab_uncommon_11', file: 'slune', name: 'Slůně' },
    { id: 'lab_uncommon_12', file: 'zirafka', name: 'Žirafka' },
    { id: 'lab_uncommon_13', file: 'zebricka', name: 'Zebřička' },
    { id: 'lab_uncommon_14', file: 'kravicka', name: 'Kravička' },
    { id: 'lab_uncommon_15', file: 'prasatko', name: 'Prasátko' },
    { id: 'lab_uncommon_16', file: 'ovecka', name: 'Ovečka' },
    { id: 'lab_uncommon_17', file: 'listicka', name: 'Lištička' },
    { id: 'lab_uncommon_18', file: 'klavirista', name: 'Klavírista' },
    { id: 'lab_uncommon_19', file: 'kytarista', name: 'Kytarista' },
    { id: 'lab_uncommon_20', file: 'bubenik', name: 'Bubeník' },
    { id: 'lab_uncommon_21', file: 'houslista', name: 'Houslista' },
    { id: 'lab_uncommon_22', file: 'barevny_muzikant', name: 'Barevný muzikant' },
    { id: 'lab_uncommon_23', file: 'cukrar_s_dortem', name: 'Cukrář s dortem' },
    { id: 'lab_uncommon_24', file: 'vedec', name: 'Vědec' },
    { id: 'lab_uncommon_25', file: 'knihomol', name: 'Knihomol' },
  ],
  rare: [
    { id: 'lab_rare_01', file: 'zavodnik', name: 'Závodník' },
    { id: 'lab_rare_02', file: 'motorkar', name: 'Motorkář' },
    { id: 'lab_rare_03', file: 'rocker', name: 'Rocker' },
    { id: 'lab_rare_04', file: 'dj_u_pultu', name: 'DJ u pultu' },
    { id: 'lab_rare_05', file: 'dj_s_ksiltovkou', name: 'DJ s kšiltovkou' },
    { id: 'lab_rare_06', file: 'modry_poutnik', name: 'Modrý poutník' },
    { id: 'lab_rare_07', file: 'lesni_zbojnik', name: 'Lesní zbojník' },
    { id: 'lab_rare_08', file: 'mechovy_strazce', name: 'Mechový strážce' },
    { id: 'lab_rare_09', file: 'trpaslik', name: 'Trpaslík' },
    { id: 'lab_rare_10', file: 'lesni_elf', name: 'Lesní elf' },
    { id: 'lab_rare_11', file: 'kapitan', name: 'Kapitán' },
    { id: 'lab_rare_12', file: 'pilot', name: 'Pilot' },
    { id: 'lab_rare_13', file: 'vynalezce_s_brylemi', name: 'Vynálezce s brýlemi' },
    { id: 'lab_rare_14', file: 'mechanik', name: 'Mechanik' },
    { id: 'lab_rare_15', file: 'piratka', name: 'Pirátka' },
    { id: 'lab_rare_16', file: 'kostlivec', name: 'Kostlivec' },
    { id: 'lab_rare_17', file: 'dynacek', name: 'Dýňáček' },
    { id: 'lab_rare_18', file: 'strasidylko', name: 'Strašidýlko' },
    { id: 'lab_rare_19', file: 'zeleny_obr', name: 'Zelený obr' },
    { id: 'lab_rare_20', file: 'snehulacek', name: 'Sněhuláček' },
    { id: 'lab_rare_21', file: 'kericek', name: 'Keříček' },
  ],
  epic: [
    { id: 'lab_epic_01', file: 'kouzelnik_s_cylindrem', name: 'Kouzelník s cylindrem' },
    { id: 'lab_epic_02', file: 'carodej', name: 'Čaroděj' },
    { id: 'lab_epic_03', file: 'carodejnice', name: 'Čarodějnice' },
    { id: 'lab_epic_04', file: 'rytir_se_stitem', name: 'Rytíř se štítem' },
    { id: 'lab_epic_05', file: 'cerny_nindza', name: 'Černý nindža' },
    { id: 'lab_epic_06', file: 'stinovy_nindza', name: 'Stínový nindža' },
    { id: 'lab_epic_07', file: 'vousaty_viking', name: 'Vousatý viking' },
    { id: 'lab_epic_08', file: 'mimozemstanek', name: 'Mimozemšťánek' },
    { id: 'lab_epic_09', file: 'morska_vila', name: 'Mořská víla' },
    { id: 'lab_epic_10', file: 'ruzova_princezna', name: 'Růžová princezna' },
    { id: 'lab_epic_11', file: 'kvetinova_princezna', name: 'Květinová princezna' },
    { id: 'lab_epic_12', file: 'astronaut', name: 'Astronaut' },
    { id: 'lab_epic_13', file: 'andilek', name: 'Andílek' },
    { id: 'lab_epic_14', file: 'certik', name: 'Čertík' },
    { id: 'lab_epic_15', file: 'upir', name: 'Upír' },
    { id: 'lab_epic_16', file: 'ledacek', name: 'Ledáček' },
    { id: 'lab_epic_17', file: 'ohnicek', name: 'Ohníček' },
    { id: 'lab_epic_18', file: 'modry_plaminek', name: 'Modrý plamínek' },
    { id: 'lab_epic_19', file: 'slunicko', name: 'Sluníčko' },
  ],
  legendary: [
    { id: 'lab_legendary_01', file: 'kral_se_zezlem', name: 'Král se žezlem' },
    { id: 'lab_legendary_02', file: 'kral_v_plasti', name: 'Král v plášti' },
    { id: 'lab_legendary_03', file: 'snehova_princezna', name: 'Sněhová princezna' },
    { id: 'lab_legendary_04', file: 'duhovy_oblacek', name: 'Duhový obláček' },
    { id: 'lab_legendary_05', file: 'hvezdna_noc', name: 'Hvězdná noc' },
    { id: 'lab_legendary_06', file: 'dzin_z_lampy', name: 'Džin z lampy' },
    { id: 'lab_legendary_07', file: 'dracek', name: 'Dráček' },
    { id: 'lab_legendary_08', file: 'jednorozec', name: 'Jednorožec' },
    { id: 'lab_legendary_09', file: 'dinosaurek', name: 'Dinosaurek' },
    { id: 'lab_legendary_10', file: 'superhrdina', name: 'Superhrdina' },
    { id: 'lab_legendary_11', file: 'modra_maska', name: 'Modrá maska' },
    { id: 'lab_legendary_12', file: 'zelena_maska', name: 'Zelená maska' },
    { id: 'lab_legendary_13', file: 'netopyri_hrdina', name: 'Netopýří hrdina' },
    { id: 'lab_legendary_14', file: 'pavouci_hrdina', name: 'Pavoučí hrdina' },
    { id: 'lab_legendary_15', file: 'zelezny_hrdina', name: 'Železný hrdina' },
    { id: 'lab_legendary_16', file: 'stribrny_robot', name: 'Stříbrný robot' },
    { id: 'lab_legendary_17', file: 'tajny_agent', name: 'Tajný agent' },
  ],
};

/* Sbirky. `words` jsou tvary jmena do vet pro dite ("ziskas dumplinga",
   "5 labubaku"); obe dosavadni jmena jsou rodu muzskeho zivotneho, takze
   pridavna jmena kolem nich ("Epicky", "novy") sedi beze zmeny. Nova sbirka
   s jinym rodem by potrebovala upravit i texty v rewards.js. */
export const COLLECTIONS = {
  dumplings: {
    key: 'dumplings',
    label: 'Dumplingy',
    icon: '🥟',
    dir: 'img/odmeny/dumplings',
    words: { one: 'dumpling', acc: 'dumplinga', few: 'dumplingy', many: 'dumplingů' },
    unknown: 'Neobjevený dumpling',
    categories: DUMPLINGS,
  },
  labubu: {
    key: 'labubu',
    label: 'Labubáky',
    icon: '🐰',
    dir: 'img/odmeny/labubu',
    words: { one: 'labubák', acc: 'labubáka', few: 'labubáky', many: 'labubáků' },
    unknown: 'Neobjevený labubák',
    categories: LABUBU,
  },
};

/* Poradi na strance sbirky. Prvni je zaroven vychozi - kdo si nic nevybral,
   sbira dumplingy jako dosud. */
export const COLLECTION_ORDER = ['dumplings', 'labubu'];
export const DEFAULT_COLLECTIONS = ['dumplings'];

export const collectionOf = (key) => COLLECTIONS[key] ?? COLLECTIONS[COLLECTION_ORDER[0]];

/* Postavicky jedne kategorie v dane sbirce. */
export const itemsOf = (collection, category) => COLLECTIONS[collection]?.categories[category] ?? [];

/* Adresy obrazku - relativne k index.html. Nadpisy kategorii jsou obecne
   a sdileji je vsechny sbirky. */
export const itemSrc = (item, collection, category) => `${COLLECTIONS[collection].dir}/${category}/${item.file}.webp`;
export const headerSrc = (category) => `img/odmeny/dumplings/_category_titles/${category}.webp`;

/* Ploche seznamy a rejstrik - usetri opakovane prochazeni kategorii. */
export const ALL_ITEMS = COLLECTION_ORDER.flatMap((collection) =>
  CATEGORY_ORDER.flatMap((category) => itemsOf(collection, category).map((item) => ({
    ...item, collection, category, src: itemSrc(item, collection, category),
  }))));

export const ITEM_BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item]));

export const ALL_IDS = ALL_ITEMS.map((item) => item.id);

/* Poradi, v jakem se sbirka posila v QR kodu (pole cisel, ne objekt).
   Starsi QR kody pocitaji s timhle poradim, proto se do nej NIKDY nevklada
   doprostred - nove ID patri jen na konec. Test hlida, ze obsahuje presne
   vsechna ID ze vsech sbirek. */
export const TRANSFER_ORDER = [
  'basic_01', 'basic_02', 'basic_03', 'basic_04', 'basic_05', 'basic_06', 'basic_07', 'basic_08',
  'uncommon_01', 'uncommon_02', 'uncommon_03', 'uncommon_04', 'uncommon_05', 'uncommon_06', 'uncommon_07', 'uncommon_08',
  'rare_01', 'rare_02', 'rare_03', 'rare_04', 'rare_05', 'rare_06', 'rare_07', 'rare_08',
  'epic_01', 'epic_02', 'epic_03', 'epic_04', 'epic_05', 'epic_06', 'epic_07', 'epic_08',
  'legendary_01', 'legendary_02', 'legendary_03', 'legendary_04', 'legendary_05', 'legendary_06', 'legendary_07', 'legendary_08',
  // 19. 10. 2026: postavicky podobne pohadkovym (Designer.png)
  'basic_09', 'basic_10', 'basic_11', 'basic_12', 'basic_13', 'basic_14', 'basic_15', 'basic_16', 'basic_17',
  'basic_18', 'basic_19', 'basic_20', 'basic_21', 'basic_22', 'basic_23', 'basic_24', 'basic_25', 'basic_26',
  'uncommon_09', 'uncommon_10', 'uncommon_11', 'uncommon_12', 'uncommon_13', 'uncommon_14', 'uncommon_15', 'uncommon_16',
  'rare_09', 'rare_10', 'rare_11', 'rare_12', 'rare_13',
  'epic_09', 'epic_10', 'epic_11', 'epic_12',
  'legendary_09', 'legendary_10', 'legendary_11',
  // 19. 10. 2026: sbirka labubaku
  'lab_basic_01', 'lab_basic_02', 'lab_basic_03', 'lab_basic_04', 'lab_basic_05', 'lab_basic_06', 'lab_basic_07', 'lab_basic_08',
  'lab_basic_09', 'lab_basic_10', 'lab_basic_11', 'lab_basic_12', 'lab_basic_13', 'lab_basic_14', 'lab_basic_15', 'lab_basic_16',
  'lab_basic_17', 'lab_basic_18', 'lab_basic_19', 'lab_basic_20', 'lab_basic_21', 'lab_basic_22', 'lab_basic_23', 'lab_basic_24',
  'lab_basic_25', 'lab_basic_26', 'lab_basic_27', 'lab_basic_28', 'lab_basic_29', 'lab_basic_30', 'lab_basic_31', 'lab_basic_32',
  'lab_basic_33', 'lab_basic_34', 'lab_basic_35', 'lab_basic_36', 'lab_basic_37', 'lab_basic_38', 'lab_basic_39', 'lab_uncommon_01',
  'lab_uncommon_02', 'lab_uncommon_03', 'lab_uncommon_04', 'lab_uncommon_05', 'lab_uncommon_06', 'lab_uncommon_07', 'lab_uncommon_08', 'lab_uncommon_09',
  'lab_uncommon_10', 'lab_uncommon_11', 'lab_uncommon_12', 'lab_uncommon_13', 'lab_uncommon_14', 'lab_uncommon_15', 'lab_uncommon_16', 'lab_uncommon_17',
  'lab_uncommon_18', 'lab_uncommon_19', 'lab_uncommon_20', 'lab_uncommon_21', 'lab_uncommon_22', 'lab_uncommon_23', 'lab_uncommon_24', 'lab_uncommon_25',
  'lab_rare_01', 'lab_rare_02', 'lab_rare_03', 'lab_rare_04', 'lab_rare_05', 'lab_rare_06', 'lab_rare_07', 'lab_rare_08',
  'lab_rare_09', 'lab_rare_10', 'lab_rare_11', 'lab_rare_12', 'lab_rare_13', 'lab_rare_14', 'lab_rare_15', 'lab_rare_16',
  'lab_rare_17', 'lab_rare_18', 'lab_rare_19', 'lab_rare_20', 'lab_rare_21', 'lab_epic_01', 'lab_epic_02', 'lab_epic_03',
  'lab_epic_04', 'lab_epic_05', 'lab_epic_06', 'lab_epic_07', 'lab_epic_08', 'lab_epic_09', 'lab_epic_10', 'lab_epic_11',
  'lab_epic_12', 'lab_epic_13', 'lab_epic_14', 'lab_epic_15', 'lab_epic_16', 'lab_epic_17', 'lab_epic_18', 'lab_epic_19',
  'lab_legendary_01', 'lab_legendary_02', 'lab_legendary_03', 'lab_legendary_04', 'lab_legendary_05', 'lab_legendary_06', 'lab_legendary_07', 'lab_legendary_08',
  'lab_legendary_09', 'lab_legendary_10', 'lab_legendary_11', 'lab_legendary_12', 'lab_legendary_13', 'lab_legendary_14', 'lab_legendary_15', 'lab_legendary_16',
  'lab_legendary_17',
];

/* Text pro dosud neobjevenou postavicku. Skutecne jmeno se u ni nikde
   nevypisuje - ani do popisku, ani do title nebo aria-label. */
export const unknownName = (id) => collectionOf(ITEM_BY_ID.get(id)?.collection).unknown;
