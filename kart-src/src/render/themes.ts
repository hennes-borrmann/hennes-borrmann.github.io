// Farben und Stimmung der vier Welten. Jede Strecke nennt ihr Thema; alles,
// was die Szene daraus baut (Himmel, Licht, Gelände, Kulissen), richtet sich
// nach diesen Werten.

import type { ThemeId } from '../game/track';

export interface Theme {
  /** Himmel: oben, Mitte, Horizont. */
  sky: [number, number, number];
  fog: number;
  fogNear: number;
  fogFar: number;
  /** Richtung zur Sonne (bzw. zum Mond). */
  sunDir: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  /** Himmelslicht von oben / Rückstrahlung von unten. */
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  /** Scheibe am Himmel. */
  disc: number;
  discSize: number;
  clouds: number;
  cloudShade: number;
  stars: boolean;

  road: number;
  roadAlt: number;
  line: number;
  kerbA: number;
  kerbB: number;
  shoulder: number;
  wallA: number;
  wallB: number;
  wallCap: number;
  /** Brücken, Stege, Schanzen. */
  deck: number;
  deckDark: number;
  pillar: number;

  /** Gelände: flach, mittel, steil, hoch. */
  ground: [number, number, number, number];
  /** Wasser- bzw. Lavaspiegel (null = keiner) und dessen Farben. */
  liquidY: number | null;
  liquid: [number, number, number];
  liquidGlow: boolean;
  /** Höhe des Geländes weit weg von der Strecke. */
  farY: number;
  /** Buckel im Gelände abseits der Strecke (Meter). */
  rough: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  // Industriehof in der Abendsonne: warmes Orange, lange Schatten, Türkis als Gegenfarbe.
  werkshof: {
    sky: [0x3f6fc4, 0xf2a765, 0xffe2a8],
    fog: 0xf6c592,
    fogNear: 140,
    fogFar: 520,
    sunDir: [-0.55, 0.62, 0.35],
    sunColor: 0xfff0d4,
    sunIntensity: 2.3,
    hemiSky: 0xbfd6ff,
    hemiGround: 0x8a5a3c,
    hemiIntensity: 1.25,
    disc: 0xfff3c4,
    discSize: 46,
    clouds: 0xfff1dc,
    cloudShade: 0xf0a988,
    stars: false,
    road: 0x4a4855,
    roadAlt: 0x52505e,
    line: 0xf7f2e4,
    kerbA: 0xff5a4e,
    kerbB: 0xf7f2e4,
    shoulder: 0x7f9a55,
    wallA: 0xffd23f,
    wallB: 0x2f2c39,
    wallCap: 0x2a2733,
    deck: 0x8d8a96,
    deckDark: 0x5e5b69,
    pillar: 0x6c6976,
    ground: [0x8fae58, 0x7b9a4c, 0x9a8a6a, 0xb7a584],
    liquidY: null,
    liquid: [0, 0, 0],
    liquidGlow: false,
    farY: 0,
    rough: 1.4,
  },
  // Steilküste am Mittag: sattes Blau, Sand, weißer Fels.
  klippe: {
    sky: [0x1f7fe0, 0x6fc3f5, 0xdff4ff],
    fog: 0xcdeeff,
    fogNear: 170,
    fogFar: 640,
    sunDir: [0.4, 0.82, -0.3],
    sunColor: 0xffffff,
    sunIntensity: 2.6,
    hemiSky: 0xcfe9ff,
    hemiGround: 0xcdb98a,
    hemiIntensity: 1.3,
    disc: 0xfffbe0,
    discSize: 34,
    clouds: 0xffffff,
    cloudShade: 0xb9daf2,
    stars: false,
    road: 0x565768,
    roadAlt: 0x5e5f71,
    line: 0xffffff,
    kerbA: 0x1fa7e0,
    kerbB: 0xffffff,
    shoulder: 0xe6cf8f,
    wallA: 0xffffff,
    wallB: 0xff7a59,
    wallCap: 0x30364a,
    deck: 0xc08a52,
    deckDark: 0x8a5c33,
    pillar: 0x7a5230,
    ground: [0xe9d596, 0x7cc05a, 0xd9d2c2, 0xf2efe6],
    liquidY: -2.2,
    liquid: [0x1e9bd8, 0x35c1e8, 0xc9f4ff],
    liquidGlow: false,
    farY: -9,
    rough: 2.2,
  },
  // Vulkan in der Dämmerung: Violett und Schwarz, Lava als einzige warme Lichtquelle.
  glut: {
    sky: [0x1d1338, 0x7a2f5a, 0xff8a3c],
    fog: 0x6b2c4a,
    fogNear: 120,
    fogFar: 480,
    sunDir: [0.5, 0.45, 0.55],
    sunColor: 0xffb787,
    sunIntensity: 1.9,
    hemiSky: 0x8a6ac9,
    hemiGround: 0xff5a1f,
    hemiIntensity: 1.35,
    disc: 0xffd9a0,
    discSize: 30,
    clouds: 0x56304f,
    cloudShade: 0x2c1a33,
    stars: true,
    road: 0x3a3442,
    roadAlt: 0x423b4b,
    line: 0xffd9a0,
    kerbA: 0xff7a1f,
    kerbB: 0x2a2331,
    shoulder: 0x5a4654,
    wallA: 0x2a2331,
    wallB: 0xff7a1f,
    wallCap: 0x17121d,
    deck: 0x6b5565,
    deckDark: 0x40323f,
    pillar: 0x4a3a48,
    ground: [0x4f3c4c, 0x5f4757, 0x35283a, 0x7a5a62],
    liquidY: -3.5,
    liquid: [0xff4d0f, 0xff9a1f, 0xffe27a],
    liquidGlow: true,
    farY: -10,
    rough: 5,
  },
  // Stadt bei Nacht: tiefes Blau, Fensterlicht in Gelb und Magenta.
  nacht: {
    sky: [0x070b1f, 0x1a1f52, 0x4a2f7a],
    fog: 0x1a1a44,
    fogNear: 110,
    fogFar: 460,
    sunDir: [-0.35, 0.75, 0.5],
    sunColor: 0xb9c8ff,
    sunIntensity: 1.5,
    hemiSky: 0x7f8cff,
    hemiGround: 0xff5aa8,
    hemiIntensity: 1.5,
    disc: 0xf2f5ff,
    discSize: 26,
    clouds: 0x2a2f6a,
    cloudShade: 0x151a44,
    stars: true,
    road: 0x33364d,
    roadAlt: 0x3a3d56,
    line: 0xfff1a8,
    kerbA: 0xff3d9a,
    kerbB: 0x1fd6c8,
    shoulder: 0x4a4e6c,
    wallA: 0x23263c,
    wallB: 0x1fd6c8,
    wallCap: 0x12142a,
    deck: 0x545878,
    deckDark: 0x2d3050,
    pillar: 0x3d4060,
    ground: [0x20233c, 0x262a46, 0x1a1c33, 0x2c3050],
    liquidY: null,
    liquid: [0, 0, 0],
    liquidGlow: false,
    farY: 0,
    rough: 0,
  },
};
