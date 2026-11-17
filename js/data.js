/* data.js — the seven spheres, geometry of every figure and the user-facing texts.
   Ported from WYRD/wyrd_data.py. Model space: x right, y UP, z toward the viewer. */

export const PAPER = '#f2efe8';
export const RED = '#d3122a';
export const RED_HI = '#ff3349';
export const INK = '#050505';

// Glyphs get U+FE0E so phones draw them as text, not as colour emoji.
const T = (c) => c + '︎';

export const SPHERES = [
  { key: 'moon', name: 'Луна', glyph: T('☾'), word: 'Nox', process: 'Прокаливание', star: 'Сириус', stone: 'Кварц', incense: 'Петрихор', form: 'Ночь' },
  { key: 'mercury', name: 'Меркурий', glyph: T('☿'), word: 'Satan', process: 'Разделение', star: 'Арктур', stone: 'Опал', incense: 'Сера', form: 'Потворство' },
  { key: 'venus', name: 'Венера', glyph: T('♀'), word: 'Hriliu', process: 'Слияние / коагуляция', star: 'Мира', stone: 'Изумруд', incense: 'Сандаловое дерево', form: 'Экстаз' },
  { key: 'sun', name: 'Солнце', glyph: T('☉'), word: 'Lux', process: 'Разложение', star: 'Антарес', stone: 'Аметист', incense: 'Дуб', form: 'Видение' },
  { key: 'mars', name: 'Марс', glyph: T('♂'), word: 'Azif', process: 'Возгонка', star: 'Ригель', stone: 'Рубин', incense: 'Мускус', form: 'Кровь' },
  { key: 'jupiter', name: 'Юпитер', glyph: T('♃'), word: 'Azoth', process: 'Ферментация', star: 'Денеб', stone: 'Янтарь', incense: 'Цибет', form: 'Azoth' },
  { key: 'saturn', name: 'Сатурн', glyph: T('♄'), word: 'Chaos', process: 'Экзальтация', star: 'Наос', stone: 'Алмаз', incense: 'Белена', form: 'Мысль' },
];
export const NAMES = SPHERES.map((s) => s.name);
export const INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i]));

/* Monochrome ramp: Moon is pearl white, Saturn is black obsidian. Red stays for accents only. */
export function tone(i) { return 1 - i / 6; }            // 1 = white … 0 = black
export function toneHex(i) {
  const v = Math.round(0x16 + (0xf2 - 0x16) * tone(i));
  const h = v.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

// ---------- Tree of Wyrd (Moon at the bottom, Saturn on top) ----------
export const TREE = [
  [0.00, -1.30, 0], [-0.92, -0.74, 0], [0.92, -0.74, 0], [0.00, 0.00, 0],
  [-0.92, 0.74, 0], [0.92, 0.74, 0], [0.00, 1.30, 0],
];
export const EDGES = [];
for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) EDGES.push([i, j]);
export const PATH_NO = new Map(EDGES.map((e, n) => [e.join('-'), n + 1]));
export const HIDDEN = new Set(['0-6', '1-5', '2-4']);
export const ROUTE = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]];
export const ROUTE_SET = new Set(ROUTE.map((e) => e.join('-')));
export const ABYSS = [3, 4];
export const SHORT_EDGES = [...ROUTE, [0, 2], [1, 3], [3, 5], [4, 6]];

// ---------- Septenary sigil: same seven on a circle ----------
const ANG = { 'Луна': 90, 'Меркурий': 45, 'Венера': 0, 'Солнце': -45, 'Марс': -135, 'Юпитер': 180, 'Сатурн': 135 };
export const SIGIL_R = 1.28;
export const SIGIL = NAMES.map((n) => {
  const a = (ANG[n] * Math.PI) / 180;
  return [Math.cos(a) * SIGIL_R, -Math.sin(a) * SIGIL_R, 0];
});
export const CHORDS = [
  ['Марс', 'Меркурий'], ['Сатурн', 'Солнце'], ['Юпитер', 'Меркурий'],
  ['Юпитер', 'Солнце'], ['Марс', 'Венера'], ['Сатурн', 'Венера'],
  ['Марс', 'Луна'], ['Солнце', 'Луна'], ['Сатурн', 'Меркурий'],
].map(([a, b]) => [INDEX[a], INDEX[b]]);

// Depth of the arc each sphere follows when it leaves the plane of the Tree.
export const MORPH_DEPTH = [-0.74, 0.60, -0.50, 0.88, -0.68, 0.56, -0.40];
export const MORPH_HOLD = 2.2;    // seconds the figure rests on each end
export const MORPH_RATE = 23;     // percent per second

// ---------- Sigil of the Nine ----------
const nine = (nx, ny) => [(nx - 0.5) * 2.72, -(ny - 0.5) * 2.0, 0];
export const NINE_NODES = {
  'Луна': nine(0.54, 0.94), 'Меркурий': nine(0.17, 0.91), 'Венера': nine(0.89, 0.60),
  'Солнце': nine(0.52, 0.47), 'Марс': nine(0.12, 0.43), 'Сатурн': nine(0.51, 0.02), 'Юпитер': nine(0.90, 0.17),
};
export const NINE_EARTH = nine(0.12, 0.15);
export const NINE_STAR = nine(1.02, 1.05);
export const NINE_X1 = nine(0.42, 0.34);
export const NINE_X2 = nine(0.61, 0.59);
const NINE_CORNER = nine(0.88, 0.90);
const N = NINE_NODES;
export const NINE_POLY = [
  [NINE_EARTH, N['Марс']],
  [N['Марс'], NINE_X1, N['Юпитер']],
  [NINE_EARTH, NINE_X1, N['Солнце'], NINE_X2, NINE_CORNER],
  [N['Сатурн'], NINE_X1, N['Луна']],
  [N['Юпитер'], NINE_X2, N['Меркурий']],
  [N['Меркурий'], NINE_X2, N['Венера']],
  [N['Венера'], NINE_CORNER, NINE_X2],
];
export const NINE_SEGS = NINE_POLY.flatMap((l) => l.slice(0, -1).map((p, i) => [p, l[i + 1]]));

// ---------- Double tetrahedron ----------
export const TETRA_BASE = [[-1, 0, -0.78], [1, 0, -0.78], [0, 0, 1.18]];
export const TETRA_TOP = [0, 1.48, 0];
export const TETRA_BOTTOM = [0, -1.48, 0];

// ---------- scenes, stages, texts ----------
export const SCENES = [
  { key: 'tree', title: 'Древо', full: 'Древо Вирд' },
  { key: 'sigil', title: 'Сигил', full: 'Септенарный сигил' },
  { key: 'morph', title: 'Переход', full: 'Переход Древо ↔ сигил' },
  { key: 'nine', title: 'Девять', full: 'Сигил Девяти' },
  { key: 'tetra', title: 'Тетраэдр', full: 'Двойной тетраэдр' },
];

export const SIGIL_STAGES = ['Полная эмблема', 'Семь точек', 'Девять линий'];
export const NINE_STAGES = ['Полная форма', 'Семь сфер', 'Пересечения линий', 'Земные Врата', 'Звёздные Врата', 'Порядок инвокации', 'Земной цикл'];
export const NINE_HINTS = [
  'Подсветка ведёт по отрезкам знака',
  'Семь подписанных точек — сферы септенария',
  'Две внутренние точки — пересечения линий, не сферы',
  'Земные Врата: последовательность завершается на Юпитере',
  'Звёздные Врата — отдельный знак с кругом внутри',
  'Порядок инвокации: от Луны к Сатурну',
  'Земной цикл: начало и конец у Земных Врат',
];
export const STAGED = { sigil: SIGIL_STAGES, nine: NINE_STAGES };

// One line per scene for the 💡 hint inside the atlas.
export const SCENE_HINT = {
  tree: 'Семь сфер и все 21 путь. Пунктир — три скрытых пути, красный порог — Бездна. Коснитесь сферы — откроется её карточка.',
  sigil: 'Шкала внизу ведёт по этапам: эмблема целиком, семь точек по очереди, девять линий по очереди.',
  morph: 'Те же семь сфер уходят из плоскости Древа по объёмным дугам и собираются на окружности сигила. На концах — упор.',
  nine: 'Семь этапов: форма, сферы, пересечения, Земные и Звёздные Врата, порядок инвокации, земной цикл.',
  tetra: 'Два тетраэдра с общим основанием в плоскости Солнца. Красная вершина — акаузальное, белая — каузальное.',
};
