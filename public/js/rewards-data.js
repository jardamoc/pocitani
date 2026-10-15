/* Postavicky odmen - kazda je samostatny obrazek .webp.
 *
 * Obrazky lezi v public/img/odmeny/<sbirka>/<kategorie>/<soubor>.webp,
 * graficke nadpisy kategorii v .../<sbirka>/_category_titles/<kategorie>.webp.
 * Staticky web neumi vypsat obsah slozky, proto je kazda postavicka zapsana
 * tady - soubor a ceske jmeno.
 *
 * ID (basic_01 ...) jsou to, co si aplikace uklada do sbirky ditete. NIKDY
 * je nemen ani neprecislovavej - dite by prislo o ziskane postavicky.
 * Obrazek se k ID da vymenit kdykoli, jmeno taky.
 *
 * Nova postavicka = novy obrazek do slozky kategorie + novy radek do `items`
 * s dalsim volnym ID (basic_09 ...) + to ID NA KONEC `TRANSFER_ORDER`.
 *
 * Tenhle modul je cista data, nic neimportuje. Zavislosti jdou jednim smerem:
 * rewards-data.js -> rewards.js -> rewards-ui.js -> app.js
 */

/* Sbirka, ze ktere se odmeny berou. Zatim jedina (dumplingy); dalsi sbirka
   (napr. auta) by mela vlastni slozku a vlastni kategorie. */
export const COLLECTION = {
  key: 'dumplings',
  dir: 'img/odmeny/dumplings',
};

/* Poradi kategorii od nejbeznejsi po nejvzacnejsi. Pouziva ho stranka sbirky
   i poradi, v jakem se odmeny odhaluji po dokonceni kola. */
export const CATEGORY_ORDER = ['basic', 'uncommon', 'rare', 'epic', 'legendary'];

export const CATEGORIES = {
  basic: {
    label: 'Základní',
    items: [
      { id: 'basic_01', file: 'modracek', name: 'Modráček' },
      { id: 'basic_02', file: 'ruzenka', name: 'Růženka' },
      { id: 'basic_03', file: 'zelenac', name: 'Zelenáč' },
      { id: 'basic_04', file: 'zlutasek', name: 'Žluťásek' },
      { id: 'basic_05', file: 'fialka', name: 'Fialka' },
      { id: 'basic_06', file: 'smetanek', name: 'Smetánek' },
      { id: 'basic_07', file: 'pomerancik', name: 'Pomerančík' },
      { id: 'basic_08', file: 'tyrkysacek', name: 'Tyrkysáček' },
    ],
  },
  uncommon: {
    label: 'Neobvyklé',
    items: [
      { id: 'uncommon_01', file: 'duhacek', name: 'Duháček' },
      { id: 'uncommon_02', file: 'malinovy_trpyt', name: 'Malinový třpyt' },
      { id: 'uncommon_03', file: 'duhovy_ocean', name: 'Duhový oceán' },
      { id: 'uncommon_04', file: 'kvetinka', name: 'Květinka' },
      { id: 'uncommon_05', file: 'perletacek', name: 'Perleťáček' },
      { id: 'uncommon_06', file: 'medenak', name: 'Měděňák' },
      { id: 'uncommon_07', file: 'brejloun', name: 'Brejloun' },
      { id: 'uncommon_08', file: 'cukrova_posypka', name: 'Cukrová posypka' },
    ],
  },
  rare: {
    label: 'Raritní',
    items: [
      { id: 'rare_01', file: 'zelezny_strazce', name: 'Železný strážce' },
      { id: 'rare_02', file: 'draci_bojovnik', name: 'Dračí bojovník' },
      { id: 'rare_03', file: 'punkovy_valecnik', name: 'Punkový válečník' },
      { id: 'rare_04', file: 'parni_vynalezce', name: 'Parní vynálezce' },
      { id: 'rare_05', file: 'radioaktivni_slizoun', name: 'Radioaktivní slizoun' },
      { id: 'rare_06', file: 'lavovy_demon', name: 'Lávový démon' },
      { id: 'rare_07', file: 'pirat', name: 'Pirát' },
      { id: 'rare_08', file: 'dobrodruh', name: 'Dobrodruh' },
    ],
  },
  epic: {
    label: 'Epické',
    items: [
      { id: 'epic_01', file: 'maly_kouzelnik', name: 'Malý kouzelník' },
      { id: 'epic_02', file: 'ledova_kralovna', name: 'Ledová královna' },
      { id: 'epic_03', file: 'stavebnicovy_hrdina', name: 'Stavebnicový hrdina' },
      { id: 'epic_04', file: 'pan_ucitel', name: 'Pan učitel' },
      { id: 'epic_05', file: 'neonovy_kyberbojovnik', name: 'Neonový kyberbojovník' },
      { id: 'epic_06', file: 'vesmirny_pruzkumnik', name: 'Vesmírný průzkumník' },
      { id: 'epic_07', file: 'kristalova_vila', name: 'Křišťálová víla' },
      { id: 'epic_08', file: 'hvezdny_snilek', name: 'Hvězdný snílek' },
    ],
  },
  legendary: {
    label: 'Legendární',
    items: [
      { id: 'legendary_01', file: 'zlaty_kral', name: 'Zlatý král' },
      { id: 'legendary_02', file: 'zlaty_vyherce', name: 'Zlatý výherce' },
      { id: 'legendary_03', file: 'rubinovy_kral', name: 'Rubínový král' },
      { id: 'legendary_04', file: 'duhova_cisarovna', name: 'Duhová císařovna' },
      { id: 'legendary_05', file: 'mesicni_carodejka', name: 'Měsíční čarodějka' },
      { id: 'legendary_06', file: 'velky_kouzelnik', name: 'Velký kouzelník' },
      { id: 'legendary_07', file: 'roboticky_titan', name: 'Robotický titán' },
      { id: 'legendary_08', file: 'ledova_cisarovna', name: 'Ledová císařovna' },
    ],
  },
};

/* Adresy obrazku - relativne k index.html. */
export const itemSrc = (item, category) => `${COLLECTION.dir}/${category}/${item.file}.webp`;
export const headerSrc = (category) => `${COLLECTION.dir}/_category_titles/${category}.webp`;

/* Ploche seznamy a rejstrik - usetri opakovane prochazeni kategorii. */
export const ALL_ITEMS = CATEGORY_ORDER.flatMap((key) =>
  CATEGORIES[key].items.map((item) => ({ ...item, category: key, src: itemSrc(item, key) })),
);

export const ITEM_BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item]));

export const ALL_IDS = ALL_ITEMS.map((item) => item.id);

/* Poradi, v jakem se sbirka posila v QR kodu (pole cisel, ne objekt).
   Starsi QR kody pocitaji s timhle poradim, proto se do nej NIKDY nevklada
   doprostred - nove ID patri jen na konec. Test hlida, ze obsahuje presne
   vsechna ID z kategorii. */
export const TRANSFER_ORDER = [
  'basic_01', 'basic_02', 'basic_03', 'basic_04', 'basic_05', 'basic_06', 'basic_07', 'basic_08',
  'uncommon_01', 'uncommon_02', 'uncommon_03', 'uncommon_04', 'uncommon_05', 'uncommon_06', 'uncommon_07', 'uncommon_08',
  'rare_01', 'rare_02', 'rare_03', 'rare_04', 'rare_05', 'rare_06', 'rare_07', 'rare_08',
  'epic_01', 'epic_02', 'epic_03', 'epic_04', 'epic_05', 'epic_06', 'epic_07', 'epic_08',
  'legendary_01', 'legendary_02', 'legendary_03', 'legendary_04', 'legendary_05', 'legendary_06', 'legendary_07', 'legendary_08',
];

/* Text pro dosud neobjevenou postavicku. Skutecne jmeno se u ni nikde
   nevypisuje - ani do popisku, ani do title nebo aria-label. */
export const UNKNOWN_NAME = 'Neobjevený dumpling';

export const categoryLabel = (key) => CATEGORIES[key]?.label ?? '';
