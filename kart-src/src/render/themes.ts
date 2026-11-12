// Farben und Stimmung der Welten. Jede Strecke nennt ihr Thema; alles,
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
  /** Kein Wetter (Mond): der Himmel bleibt ohne Wolken. */
  noClouds?: boolean;
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
  /**
   * Unterwasserwelt (Tauchstrecken): das Gelände wird auch unter dem Meeresspiegel
   * gezeichnet (Meeresboden), die Wasserfläche bekommt eine Unterseite, und sobald
   * die Kamera abtaucht, wechseln Dunst und Licht auf diese Werte.
   */
  under?: {
    fog: number;
    fogNear: number;
    fogFar: number;
    sunColor: number;
    sunIntensity: number;
    hemiSky: number;
    hemiGround: number;
    /** Wasseroberfläche von unten gesehen: dunkel, mittel, Lichtflecken. */
    surface: [number, number, number];
  };
}

export const THEMES: Record<ThemeId, Theme> = {
  // Vulkaninsel im Ausbruch: tiefe Abendsonne über dem Meer, unten heller Küstenfels und
  // grüne Macchia, oben schwarze Schlacke; über dem Krater ein Aschehimmel mit Glutschein.
  // Die Fahrbahn bleibt überall heller bzw. kühler als das Gelände daneben.
  vulkan: {
    sky: [0x2a1d3c, 0x9a4652, 0xffb066],
    fog: 0xc0786a,
    fogNear: 150,
    fogFar: 640,
    sunDir: [-0.55, 0.36, -0.62],
    sunColor: 0xffcf9a,
    sunIntensity: 2.5,
    hemiSky: 0xd6c0d8,
    hemiGround: 0xff8a4a,
    hemiIntensity: 1.15,
    disc: 0xffe0a8,
    discSize: 30,
    clouds: 0x6a5260,
    cloudShade: 0x3a2a36,
    stars: false,
    road: 0x4d5266,
    roadAlt: 0x565b70,
    line: 0xfff1cc,
    kerbA: 0xff6a1f,
    kerbB: 0xf4efe4,
    shoulder: 0xd9c08c,
    wallA: 0xf4efe4,
    wallB: 0xff6a1f,
    wallCap: 0x2a2430,
    deck: 0x6c6470,
    deckDark: 0x3a333d,
    pillar: 0x2e2a33,
    ground: [0xe6cf98, 0x74a64c, 0xb0806a, 0x2b2429],
    liquidY: -4,
    liquid: [0x173a5c, 0x2a6a96, 0xffc28a],
    liquidGlow: false,
    farY: -11,
    rough: 6,
  },
  // Sturmhafen: tiefe Wolken, nasser Asphalt, graugrüne See mit Schaumkronen.
  hafen: {
    sky: [0x1d2430, 0x46525f, 0x97a6ae],
    fog: 0x84939b,
    fogNear: 90,
    fogFar: 460,
    sunDir: [-0.35, 0.7, 0.45],
    sunColor: 0xdde8ef,
    sunIntensity: 1.6,
    hemiSky: 0xbccbd6,
    hemiGround: 0x4a535b,
    hemiIntensity: 1.35,
    disc: 0xc9d4dc,
    discSize: 18,
    clouds: 0x5d6774,
    cloudShade: 0x39414c,
    stars: false,
    road: 0x3c414c,
    roadAlt: 0x444a56,
    line: 0xffd23f,
    kerbA: 0xe5483a,
    kerbB: 0xf2efe6,
    shoulder: 0x5c626c,
    wallA: 0xf2c230,
    wallB: 0x23262d,
    wallCap: 0x23262d,
    deck: 0x7a8088,
    deckDark: 0x4b5058,
    pillar: 0x3b3f46,
    ground: [0x6b7179, 0x57616b, 0x49515b, 0x8b939b],
    liquidY: -3.2,
    liquid: [0x1d3746, 0x2e5363, 0xcfe3ea],
    liquidGlow: false,
    farY: -10,
    rough: 0.6,
  },
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
  // Werft über den Wolken am Morgen: tiefes Blau oben, warmes Licht von der Seite,
  // unten ein Wolkenmeer (als "Flüssigkeit" gezeichnet) – Gelände gibt es keines.
  wolken: {
    sky: [0x1f5fd0, 0x86c8f5, 0xffe7c4],
    fog: 0xe6f0fb,
    fogNear: 200,
    fogFar: 760,
    sunDir: [0.52, 0.55, 0.42],
    sunColor: 0xfff3da,
    sunIntensity: 2.5,
    hemiSky: 0xd4e9ff,
    hemiGround: 0xffe8c8,
    hemiIntensity: 1.35,
    disc: 0xfff6d8,
    discSize: 40,
    clouds: 0xffffff,
    cloudShade: 0xc2d8f0,
    stars: false,
    road: 0x565a70,
    roadAlt: 0x5e6279,
    line: 0xffffff,
    kerbA: 0xe8483f,
    kerbB: 0xffffff,
    shoulder: 0xc79a62,
    wallA: 0xffffff,
    wallB: 0xe8483f,
    wallCap: 0x2d3550,
    deck: 0xb98652,
    deckDark: 0x7d5632,
    pillar: 0x6d7890,
    ground: [0xf4f8ff, 0xe9f1fb, 0xd9e6f5, 0xffffff],
    liquidY: 9,
    liquid: [0xd3e3f6, 0xf3f8ff, 0xffffff],
    liquidGlow: false,
    farY: -40,
    rough: 0,
  },
  // Tropisches Riff: oben Lagune im Vormittagslicht, unten Türkis und Blau mit Korallenfarben.
  riff: {
    sky: [0x1689e0, 0x79d2f7, 0xe6fbff],
    fog: 0xd2f3fb,
    fogNear: 170,
    fogFar: 640,
    sunDir: [0.35, 0.86, 0.3],
    sunColor: 0xfffbea,
    sunIntensity: 2.6,
    hemiSky: 0xcdeeff,
    hemiGround: 0xe8d9a0,
    hemiIntensity: 1.3,
    disc: 0xfffbe0,
    discSize: 32,
    clouds: 0xffffff,
    cloudShade: 0xbfe3f2,
    stars: false,
    road: 0x6c6480,
    roadAlt: 0x756c8a,
    line: 0xfff6d6,
    kerbA: 0xff6f91,
    kerbB: 0xfff6d6,
    shoulder: 0xe6d6a0,
    wallA: 0xff7a8f,
    wallB: 0xffe9c2,
    wallCap: 0x7a3f6b,
    deck: 0xc08a52,
    deckDark: 0x8a5c33,
    pillar: 0x7a5230,
    ground: [0xead9a2, 0x58c79b, 0x8d76a8, 0xf4ead0],
    liquidY: 0,
    liquid: [0x16a6d8, 0x38c8e6, 0xcdf6ff],
    liquidGlow: false,
    farY: -22,
    rough: 3,
    under: {
      fog: 0x1f8fb5,
      fogNear: 24,
      fogFar: 230,
      sunColor: 0xbfefff,
      sunIntensity: 1.9,
      hemiSky: 0x8fe0ff,
      hemiGround: 0x2f7f9c,
      surface: [0x2aa5cf, 0x63d3ef, 0xe9fdff],
    },
  },
  // Verschneiter Gebirgspass am späten Nachmittag: kaltes Blau im Schatten, warmes Licht auf dem Schnee.
  // Das "Meer" ist hier ein Nebelmeer tief im Tal – so wächst das Gelände als Bergmassiv aus der Strecke.
  eis: {
    sky: [0x2a66c8, 0x9ccdf3, 0xffe3cc],
    fog: 0xe4eefa,
    fogNear: 180,
    fogFar: 700,
    sunDir: [-0.5, 0.5, 0.45],
    sunColor: 0xfff0dc,
    sunIntensity: 2.5,
    hemiSky: 0xcfe4ff,
    hemiGround: 0xbfd2ec,
    hemiIntensity: 1.35,
    disc: 0xfff4d6,
    discSize: 38,
    clouds: 0xffffff,
    cloudShade: 0xc6d9ef,
    stars: false,
    road: 0x5d6276,
    roadAlt: 0x666b80,
    line: 0xffffff,
    kerbA: 0xe8483f,
    kerbB: 0xffffff,
    shoulder: 0xe3ecf6,
    wallA: 0xe8483f,
    wallB: 0xffffff,
    wallCap: 0x2c3550,
    deck: 0xa9825a,
    deckDark: 0x74573a,
    pillar: 0x6b6f80,
    ground: [0xf5f9fe, 0xe7eff9, 0x8b98b0, 0xffffff],
    liquidY: -30,
    liquid: [0xdbe7f5, 0xeef4fb, 0xffffff],
    liquidGlow: false,
    farY: -26,
    rough: 5,
  },
  // Mond: schwarzer Himmel mit Sternen und der Erde, hartes weißes Sonnenlicht, grauer Staub, orange Signalfarbe der Basis.
  mond: {
    sky: [0x02030a, 0x070a18, 0x10142a],
    fog: 0x0c0f1f,
    fogNear: 260,
    fogFar: 900,
    sunDir: [0.55, 0.6, -0.35],
    sunColor: 0xffffff,
    sunIntensity: 2.9,
    hemiSky: 0x6f7fb0,
    hemiGround: 0x9a98a8,
    hemiIntensity: 0.95,
    disc: 0x6fb7ff,
    discSize: 54,
    clouds: 0x10142a,
    cloudShade: 0x0a0d1c,
    noClouds: true,
    stars: true,
    road: 0x4d5063,
    roadAlt: 0x565a6e,
    line: 0xff8a2a,
    kerbA: 0xff8a2a,
    kerbB: 0xe6e9f2,
    shoulder: 0x9d9aa8,
    wallA: 0xe6e9f2,
    wallB: 0xff8a2a,
    wallCap: 0x23263a,
    deck: 0xc9cede,
    deckDark: 0x7d8398,
    pillar: 0x5b6076,
    ground: [0xb9b6c2, 0xaaa7b4, 0x7d7a8a, 0xcfccd8],
    liquidY: null,
    liquid: [0, 0, 0],
    liquidGlow: false,
    farY: 0,
    rough: 3,
  },
};
