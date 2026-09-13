/* Sprite sheet s postavickami odmen.
 *
 * Souradnice jsou prevzate doslova ze zadani a NESMI se odhadovat ani upravovat.
 * Popisuji vyrez v obrazku 1254x1254: [0, 0] je levy horni roh, x/y je levy horni
 * roh vyrezu, width/height jeho rozmer. Vsech 40 postavicek i 5 grafickych nadpisu
 * se kresli z jednoho souboru - zadne samostatne obrazky nevznikaji.
 *
 * Tenhle modul je cista data, nic neimportuje. Zavislosti jdou jednim smerem:
 * rewards-data.js -> rewards.js -> rewards-ui.js -> app.js
 */

export const SPRITE = {
  file: 'img/dumplings.png',
  width: 1254,
  height: 1254,
};

/* Poradi kategorii od nejbeznejsi po nejvzacnejsi. Pouziva ho stranka sbirky
   i poradi, v jakem se odmeny odhaluji po dokonceni kola. */
export const CATEGORY_ORDER = ['basic', 'uncommon', 'rare', 'epic', 'legendary'];

export const CATEGORIES = {
  basic: {
    label: 'Základní',
    header: { x: 513, y: 25, width: 229, height: 54 },
    items: [
      { id: 'basic_01', x: 12, y: 101, width: 145, height: 151, name: 'Modráček' },
      { id: 'basic_02', x: 157, y: 103, width: 157, height: 149, name: 'Růženka' },
      { id: 'basic_03', x: 314, y: 101, width: 156, height: 151, name: 'Zelenáč' },
      { id: 'basic_04', x: 475, y: 101, width: 152, height: 151, name: 'Žluťásek' },
      { id: 'basic_05', x: 629, y: 101, width: 155, height: 151, name: 'Fialka' },
      { id: 'basic_06', x: 785, y: 102, width: 156, height: 150, name: 'Smetánek' },
      { id: 'basic_07', x: 941, y: 101, width: 156, height: 151, name: 'Pomerančík' },
      { id: 'basic_08', x: 1097, y: 103, width: 143, height: 149, name: 'Tyrkysáček' },
    ],
  },
  uncommon: {
    label: 'Neobvyklé',
    header: { x: 497, y: 270, width: 260, height: 55 },
    items: [
      { id: 'uncommon_01', x: 10, y: 340, width: 147, height: 158, name: 'Duháček' },
      { id: 'uncommon_02', x: 157, y: 344, width: 157, height: 154, name: 'Malinový třpyt' },
      { id: 'uncommon_03', x: 314, y: 341, width: 157, height: 157, name: 'Duhový oceán' },
      { id: 'uncommon_04', x: 471, y: 341, width: 156, height: 157, name: 'Květinka' },
      { id: 'uncommon_05', x: 627, y: 341, width: 157, height: 157, name: 'Perleťáček' },
      { id: 'uncommon_06', x: 784, y: 344, width: 153, height: 154, name: 'Měděňák' },
      { id: 'uncommon_07', x: 941, y: 343, width: 156, height: 158, name: 'Brejloun' },
      { id: 'uncommon_08', x: 1097, y: 343, width: 151, height: 156, name: 'Cukrová posypka' },
    ],
  },
  rare: {
    label: 'Raritní',
    header: { x: 519, y: 515, width: 216, height: 55 },
    items: [
      { id: 'rare_01', x: 7, y: 596, width: 150, height: 166, name: 'Železný strážce' },
      { id: 'rare_02', x: 157, y: 596, width: 157, height: 166, name: 'Dračí bojovník' },
      { id: 'rare_03', x: 314, y: 570, width: 157, height: 194, name: 'Punkový válečník' },
      { id: 'rare_04', x: 471, y: 569, width: 156, height: 193, name: 'Parní vynálezce' },
      { id: 'rare_05', x: 627, y: 569, width: 157, height: 193, name: 'Radioaktivní slizoun' },
      { id: 'rare_06', x: 784, y: 595, width: 157, height: 169, name: 'Lávový démon' },
      { id: 'rare_07', x: 941, y: 593, width: 156, height: 172, name: 'Pirát' },
      { id: 'rare_08', x: 1097, y: 597, width: 149, height: 169, name: 'Dobrodruh' },
    ],
  },
  epic: {
    label: 'Epické',
    header: { x: 529, y: 774, width: 196, height: 53 },
    items: [
      { id: 'epic_01', x: 0, y: 832, width: 157, height: 187, name: 'Malý kouzelník' },
      { id: 'epic_02', x: 157, y: 832, width: 157, height: 189, name: 'Ledová královna' },
      { id: 'epic_03', x: 314, y: 852, width: 157, height: 167, name: 'Stavebnicový hrdina' },
      { id: 'epic_04', x: 471, y: 856, width: 156, height: 157, name: 'Pan učitel' },
      { id: 'epic_05', x: 627, y: 849, width: 157, height: 166, name: 'Neonový kyberbojovník' },
      { id: 'epic_06', x: 784, y: 849, width: 157, height: 169, name: 'Vesmírný průzkumník' },
      { id: 'epic_07', x: 941, y: 846, width: 156, height: 169, name: 'Křišťálová víla' },
      { id: 'epic_08', x: 1097, y: 848, width: 154, height: 165, name: 'Hvězdný snílek' },
    ],
  },
  legendary: {
    label: 'Legendární',
    header: { x: 497, y: 1024, width: 259, height: 49 },
    items: [
      { id: 'legendary_01', x: 14, y: 1077, width: 143, height: 163, name: 'Zlatý král' },
      { id: 'legendary_02', x: 157, y: 1079, width: 157, height: 161, name: 'Zlatý výherce' },
      { id: 'legendary_03', x: 314, y: 1080, width: 157, height: 161, name: 'Rubínový král' },
      { id: 'legendary_04', x: 471, y: 1082, width: 156, height: 158, name: 'Duhová císařovna' },
      { id: 'legendary_05', x: 627, y: 1084, width: 157, height: 156, name: 'Měsíční čarodějka' },
      { id: 'legendary_06', x: 784, y: 1074, width: 157, height: 167, name: 'Velký kouzelník' },
      { id: 'legendary_07', x: 941, y: 1082, width: 156, height: 159, name: 'Robotický titán' },
      { id: 'legendary_08', x: 1097, y: 1074, width: 156, height: 166, name: 'Ledová císařovna' },
    ],
  },
};

/* Ploche seznamy a rejstrik - usetri opakovane prochazeni kategorii. */
export const ALL_ITEMS = CATEGORY_ORDER.flatMap((key) =>
  CATEGORIES[key].items.map((item) => ({ ...item, category: key })),
);

export const ITEM_BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item]));

export const ALL_IDS = ALL_ITEMS.map((item) => item.id);

/* Text pro dosud neobjevenou postavicku. Skutecne jmeno se u ni nikde
   nevypisuje - ani do popisku, ani do title nebo aria-label. */
export const UNKNOWN_NAME = 'Neobjevený dumpling';

export const categoryLabel = (key) => CATEGORIES[key]?.label ?? '';
