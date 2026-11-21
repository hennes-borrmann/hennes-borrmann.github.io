// Die vier Karts samt Fahrerfiguren – vollständig prozedural, ohne fremde
// Modelle oder Bilder.
//
// Aufbau: Jedes Kart ist EIN Netz mit Vertexfarben, das an einem kleinen
// Skelett hängt (THREE.SkinnedMesh). Räder, Lenkrad, Kopf, Arme, Ohren, Schal
// und Schwanz sind Knochen – so bewegt sich alles einzeln und kostet trotzdem
// nur einen Zeichenaufruf fürs Netz und einen für die Tuschekontur. Dazu
// kommt ein Aufruf für die Aufkleber (Augen, Ziffer der Startnummer) und – nur
// solange sichtbar – je einer für die Flammen sowie zwei für die Effekte
// (Schutzring, Blitze, Qualm samt Kontur). Macht 3 Aufrufe im Normalfall,
// höchstens 6. Items kommen nur bei Bedarf dazu: der Gegenstand in der Hand
// (2 Aufrufe samt Kontur), im Drachenzug Drache (2) und Leine (1), als
// Roboter, mit ausgeklappter Klebepistole oder mit Kleber im Gesicht ein
// eigenes Netz am selben Skelett (2 samt Kontur).
//
// Die Kontur ist eine umgestülpte Hülle (siehe toon.ts). Ihr Netz enthält nur
// die Teile, die eine Linie bekommen sollen; die Dicke steckt je Ecke in der
// Länge von "onormal" – so bleiben kleine Teile fein und nichts verklumpt.
//
// Koordinaten: y oben, das Kart schaut nach +z, die Räder stehen auf y = 0.
// „Links“ ist +x, „rechts“ −x.

import * as THREE from 'three';
import { DRILL_FORE, DRILL_SIDE } from '../game/sim';
import { INK, outlineMaterial, rgb, toonMaterial, withSkinnedOutline } from './toon';

export interface KartPose {
  /** Vorwärtstempo in m/s (negativ = rückwärts); 26 = Höchsttempo, bis 34 mit Schub. */
  speed: number;
  /** -1..1, rechts positiv (schon geglättet). */
  steer: number;
  /** -1 links, 0 kein Drift, 1 rechts. */
  driftDir: number;
  /** 0..3 Mini-Turbo-Stufe. */
  driftStage: number;
  /** Schub aktiv → Auspuffflammen. */
  boost: boolean;
  /** In der Luft. */
  air: boolean;
  /** 0 = normal, sonst 0..1 Fortschritt des Schleuderns nach einem Treffer. */
  spin: number;
  /** Item „Stoßfänger“ aktiv: Schutzring kreist ums Kart. */
  guard: boolean;
  /** Item „Kurzschluss“ erwischt: Blitze, Qualm, verdatterte Figur. */
  stall: boolean;
  offroad: boolean;
  /** Im Ziel: jubeln bzw. Kopf hängen lassen. */
  emote: 'none' | 'win' | 'lose';
  /** Item in der Hand: 0 = keins, sonst 1..9 (Nummern wie in game/sim.ts). */
  held: number;
  /** Der Abschleppdrache zieht gerade. */
  tow: boolean;
  /** Gleitflug über einer Flugstrecke: die Flügel sind ausgeklappt. */
  glide: boolean;
  /** Unter Wasser (Tauchstrecke). */
  dive: boolean;
  /** Im luftleeren Raum (Mondbasis): Raumhelm und Steuerdüsen. */
  space: boolean;
  /** Rakete: 0 = Kart, bis 1 Fortschritt der Verwandlung (1 = fertige Rakete, die Achse zeigt nach +y). */
  rocket?: number;
  /** Rakete: Stärke des Düsenfeuers 0..1. */
  rocketFlame?: number;
  /** Schwebeband (Neonhochbahn): 0 = auf Rädern, 1 = die Räder sind waagerecht weggeklappt, das Kart schwebt. */
  hover?: number;
  /** Get Gold: Fortschritt des Austrinkens 0..1 (0 = es wird gerade nicht getrunken). */
  drink?: number;
  /** Get Gold: das Kart ist gold (Fahrer und Kart, mit Glanz). */
  gold?: boolean;
  /** Get Gold läuft gleich ab: die Goldfarbe blinkt. */
  goldBlink?: boolean;
  /**
   * Roboter: Sekunden seit dem Auslösen (0 = Kart) – verwandeln (bis 0,5), rennen, Satz (ab 0,9), im Sprung zurück.
   * Wird es 0, solange noch etwas ausgeklappt ist (Treffer, frühe Landung), klappt alles zügig ein.
   */
  robot?: number;
  /** Kleber: Sekunden seit dem Auslösen der Klebepistole (0 = eingeklappt). */
  glueGun?: number;
  /** Kleber: worauf die Pistole zielt – Punkt im Raum von root (null = einfach nach hinten auf die Fahrbahn). */
  glueAim?: THREE.Vector3 | null;
  /** Kleber: so viele Sekunden klebt dem Fahrer noch Kleber auf Gesicht und Haube (0 = keiner). */
  glue?: number;
  /** Bohrer: Fortschritt des Einsteckens 0..1 (0 = es wird gerade keiner eingesteckt; bei 1 steckt er im Boden). */
  plant?: number;
}

/** Cockpit-Ansicht: so weit rückt das Lenkrad höher und zur Figur (Meter) und so viel steiler steht es (rad). */
export const COCKPIT_STEER: [number, number, number] = [0.2, -0.12, -0.42];
/**
 * Cockpit-Ansicht im Drift und in Kurven: welcher Anteil der sichtbaren Schrägstellung der Karosserie bleibt, welcher
 * Anteil des Blicks in die Kurve und welcher Anteil der Neigung des Oberkörpers (von hinten jeweils 1). Wenig: Sonst
 * dreht und verschiebt sich die ganze Sicht weit in die Driftrichtung.
 */
export const COCKPIT_DRIFT: [number, number, number] = [0, 0.15, 0.3];

/** Cockpit-Ansicht: Grundhaltung mit Item (raus, hoch, vor – wie HOLD): vor der rechten Schulter, über dem Lenkrad. */
export const COCKPIT_HOLD: [number, number, number] = [0.08, 0.12, 0.36];
/** Cockpit-Ansicht: Hand-Ziel der Arme gegenüber dem Griff am Kranz – nach außen, zur Figur hin (Meter). */
export const COCKPIT_WRIST: [number, number] = [0.03, 0.07];
/** Cockpit-Ansicht: Richtung, in die die Ellbogen knicken (außen, oben, vorn – wie in solveArm). */
export const COCKPIT_ELBOW: [number, number, number] = [0.5, -0.75, -0.35];

/** Was die Cockpit-Ansicht (firstPerson.ts) vom eigenen Kart braucht. Knochen im Raum der Karosserie bzw. des Oberkörpers. */
export interface CockpitRig {
  root: THREE.Object3D;
  chassis: THREE.Bone;
  torso: THREE.Bone;
  head: THREE.Bone;
  steer: THREE.Bone;
  handL: THREE.Bone;
  handR: THREE.Bone;
  steerR: number;
  /** Mitte des Lenkrads (Raum der Karosserie). */
  steerAt: readonly [number, number, number];
  /** Radius der Kugelhand. */
  hand: number;
  hip: readonly [number, number, number];
  torsoLen: number;
  /** 0 … 1: rechte Hand weg vom Lenkrad (Item, Geste, Leine) / linke Hand weg (Trinken, Arme hoch, Schwimmen). */
  holdR: number;
  holdL: number;
  /** Item in der Hand (Nummer wie in game/sim.ts), Geste läuft für dieses Item (0 = keine). */
  held: number;
  gesture: number;
  /** Fortschritt Austrinken / Bohrer einstecken / Roboter (Sekunden) / Rakete (0 … 1). */
  drink: number;
  plant: number;
  robot: number;
  /** Wie weit das Kart gerade ein Roboter ist (0 … 1) und wie gold es ist (0 … 1). */
  robotLook: number;
  rocket: number;
  gold: number;
  /** Der Gegenstand in der Hand (sein Netz). */
  prop: THREE.Object3D;
}

/** 0 niedrig (ohne Konturen, weniger Segmente), 1 mittel, 2 hoch. */
export type KartDetail = 0 | 1 | 2;

/** Name der Figur (Index = character), z. B. für die Lobby. */
export const DRIVER_NAMES: string[] = ['Kolben-Kalle', 'Vera Vergaser', 'Bremsen-Bert', 'Zünd-Zoe'];

// ───────────────────────────── Grundlagen ─────────────────────────────

type V3 = readonly [number, number, number];

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Nähert cur exponentiell an target an – unabhängig von der Bildrate. */
function damp(cur: number, target: number, lambda: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}

/** Pseudo-Zufall 0..1 aus einer Zahl (für Flackern ohne Math.random). */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// Knochen des Skeletts. Alle vier Karts benutzen dieselbe Liste; was eine
// Figur nicht braucht, bleibt einfach ungenutzt.
const B = {
  spin: 0, // Schleudern + Hüpfen
  drift: 1, // Schrägstellen im Drift
  chassis: 2, // Karosserie: Rollen, Nicken, Stauchen
  wFL: 3,
  wFR: 4,
  wRL: 5,
  wRR: 6,
  steer: 7, // Lenkrad
  torso: 8,
  head: 9,
  earL: 10,
  earR: 11,
  armLU: 12,
  armLF: 13,
  handL: 14,
  armRU: 15,
  armRF: 16,
  handR: 17,
  c0: 18, // Kette: Schal (Vera) bzw. Schwanz (Zoe)
  c1: 19,
  c2: 20,
  c3: 21,
  aux0: 22, // je Figur: Motor/Kiefer, Schnauzbart, Antennen
  aux1: 23,
  flameL: 24,
  flameR: 25,
  guard: 26,
  bolt0: 27,
  bolt1: 28,
  puff0: 29,
  puff1: 30,
  wingL: 31, // Gleitflügel: Gelenk an der Karosserie …
  wingR: 32,
  tipL: 33, // … und Außenteil (federt im Flug)
  tipR: 34,
  wtail: 35, // Leitwerk bzw. Propeller am Heck
  dHead: 36, // Tauchausrüstung am Kopf (Maske, Brille, Kuppel)
  dBody: 37, // … an der Karosserie (Schraubenhalter, Flossen, Außenborder)
  dPropL: 38, // Schiffsschrauben (dreht sich unter Wasser)
  dPropR: 39,
  bub0: 40, // drei aufsteigende Blasen
  bub1: 41,
  bub2: 42,
  jetL: 43, // Blasenstrahl statt Auspuffflamme
  jetR: 44,
  sHead: 45, // Raumausrüstung: Helm am Kopf (Drehpunkt = Mitte der Glaskugel) …
  sPack: 46, // … Tornister am Oberkörper …
  sAnt: 47, // … dessen Antenne (wippt träge) …
  sBody: 48, // … Steuerdüsen und Positionsleuchte an der Karosserie …
  sLamp: 49, // … deren leuchtendes Glas (blinkt) …
  sJet0: 50, // … und vier Düsenstöße: vorn links, vorn rechts, hinten links, hinten rechts
  sJet1: 51,
  sJet2: 52,
  sJet3: 53,
  rThighL: 54, // Roboter: Oberschenkel (Hüftgelenk am Becken) …
  rThighR: 55,
  rShinL: 56, // … Unterschenkel (Knie) …
  rShinR: 57,
  rArmL: 58, // … Oberarm (Schulter an der Karosserie) …
  rArmR: 59,
  gun: 60, // Kleber: Klebepistole am Heck (Scharnier)
  glueHead: 61, // Kleberklecks auf dem Gesicht …
  glueBody: 62, // … und auf der Haube vor dem Lenkrad
  rPelvis: 63, // Roboter: Becken (unter dem Heck) …
  rFootL: 64, // … Fuß (Sprunggelenk) …
  rFootR: 65,
  rToeL: 66, // … Zehen (Ballen) …
  rToeR: 67,
  rForeL: 68, // … Unterarm (Ellbogen) …
  rForeR: 69,
  rHandL: 70, // … und Faust (Handgelenk)
  rHandR: 71,
} as const;
const BONE_COUNT = 72;

// Farben, die alle Karts teilen.
const DARK = 0x2d2a36; // Gummi, Rahmen
const STEEL = 0x5a6173;
const CHROME = 0xe3ebf4;
const WHITE = 0xfdf9f0;
const LEMON = 0xfff48a;
const INK_CSS = '#16131c';

// ───────────────────────────── Lackfarben ─────────────────────────────
//
// Die Figur wählt jeder frei, die Lackfarbe hängt am Spielerplatz. Alles, was
// am Kart „Lack“ ist – Karosserie, Helm, Kappe, Felgen, Streifen –, kommt aus
// einer Palette, die aus der Lackfarbe abgeleitet wird. Fell, Gesichter,
// Reifen und Chrom bleiben bei der Figur.

/** Lackfarbe je Platz – dieselben Werte wie PLAYER_COLORS in util/players.ts. */
const PAINT_BASE = [0xff5a4e, 0x1fc8b6, 0xffd23f, 0x9b87ff];

interface Paint {
  /** Lack. */
  base: number;
  /** Dunklere Variante: Unterkante, Kappenrand, Flosse, Schirm, Felgenring. */
  dark: number;
  /** Hellere Variante: Fasen und Glanzkanten. */
  light: number;
  /** Sehr dunkler Ton der Teamfarbe: Anzug, Polster. */
  deep: number;
  /** Noch dunkler: Sitzmulde, Lenkradkranz. */
  deeper: number;
  /** Zweite Akzentfarbe (Blitze, Zündkerzenkappen) – kontrastiert zum Lack. */
  accent: number;
  /** Zierlinie auf zu hellem Lack (statt Weiß/Creme). */
  ink: number;
}

function hexToHsl(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): number {
  h = ((h % 1) + 1) % 1;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number): number => {
    t = ((t % 1) + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  return (ch(h + 1 / 3) << 16) | (ch(h) << 8) | ch(h - 1 / 3);
}

/** Relative Helligkeit (wie bei WCAG), 0..1. */
function luminance(hex: number): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
}

/** Kontrastverhältnis zweier Farben (1 = gleich hell, 21 = Schwarz auf Weiß). */
function contrast(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Unterhalb davon verschwimmt eine Zierlinie auf dem Lack (Weiß auf Gelb ≈ 1,45). */
const MIN_TRIM_CONTRAST = 1.7;

// Handabgestimmte Töne der angestammten Kombinationen – damit Figur i im Lack
// von Platz i genau so aussieht wie bisher. Alles Übrige wird abgeleitet.
const TUNED: Record<number, Partial<Paint>> = {
  0xff5a4e: { dark: 0xc93b35 },
  0x1fc8b6: { dark: 0x13968a },
  0xffd23f: { dark: 0xe0a41c },
  0x9b87ff: { dark: 0x6a55d4, light: 0xb3a4ff, deep: 0x3b2f66, deeper: 0x2a2440, accent: LEMON },
};

function makePaint(base: number): Paint {
  const [h, s, l] = hexToHsl(base);
  // Gelb wird abgedunkelt schnell oliv – die dunklen Töne dort Richtung Braun drehen.
  const hd = h > 0.08 && h < 0.21 ? h - 0.045 : h;
  const derived: Paint = {
    base,
    dark: hslToHex(h, s * 0.72, l * 0.74),
    light: hslToHex(h, s * 0.95, l + (1 - l) * 0.45),
    deep: hslToHex(hd, Math.min(s, 0.42), 0.28),
    deeper: hslToHex(hd, Math.min(s, 0.3), 0.2),
    // Zitronengelb, solange es sich vom Lack abhebt; sonst die Gegenfarbe.
    accent: contrast(LEMON, base) >= 1.6 ? LEMON : hslToHex(h + 0.5, 0.68, 0.46),
    ink: hslToHex(hd, 0.22, 0.17),
  };
  return { ...derived, ...TUNED[base] };
}

const PAINTS: Paint[] = PAINT_BASE.map(makePaint);

// ───────────────────────────── Netz-Bausteine ─────────────────────────────

function rawGeo(pos: number[], nor: number[], col: number[] | null, idx: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Ein Querschnitt für loft(): Punkte (x, y) gegen den Uhrzeigersinn, bei z. */
interface Ring {
  z: number;
  p: number[];
}

interface LoftOpts {
  /** Kantige Flächen statt weicher Rundung. */
  flat?: boolean;
  /** Farbe je Viereck (Band zwischen zwei Querschnitten, Segment im Ring). */
  color?: (band: number, k: number) => number;
  capA?: boolean;
  capB?: boolean;
  capColor?: number;
}

/**
 * Spannt eine Haut über mehrere Querschnitte (entlang z). Jedes Viereck hat
 * eigene Ecken, damit Farbgrenzen scharf bleiben; die Schattierung ist
 * trotzdem weich, weil die Normalen vom gemeinsamen Gitter stammen.
 */
function loft(rings: Ring[], o: LoftOpts = {}): THREE.BufferGeometry {
  const m = rings.length;
  const n = rings[0].p.length / 2;
  const P = new Float32Array(m * n * 3);
  for (let j = 0; j < m; j++) {
    for (let k = 0; k < n; k++) {
      const i = (j * n + k) * 3;
      P[i] = rings[j].p[k * 2];
      P[i + 1] = rings[j].p[k * 2 + 1];
      P[i + 2] = rings[j].z;
    }
  }
  const N = new Float32Array(m * n * 3);
  for (let j = 0; j < m; j++) {
    for (let k = 0; k < n; k++) {
      const a = (j * n + ((k + 1) % n)) * 3;
      const b = (j * n + ((k + n - 1) % n)) * 3;
      const c = (Math.min(j + 1, m - 1) * n + k) * 3;
      const d = (Math.max(j - 1, 0) * n + k) * 3;
      const ax = P[a] - P[b];
      const ay = P[a + 1] - P[b + 1];
      const az = P[a + 2] - P[b + 2];
      const zx = P[c] - P[d];
      const zy = P[c + 1] - P[d + 1];
      const zz = P[c + 2] - P[d + 2];
      let nx = ay * zz - az * zy;
      let ny = az * zx - ax * zz;
      let nz = ax * zy - ay * zx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) {
        // Zu einem Punkt geschrumpfter Ring (Spitze): Normale entlang der Achse.
        nx = 0;
        ny = 0;
        nz = j * 2 < m ? -1 : 1;
      } else {
        nx /= l;
        ny /= l;
        nz /= l;
      }
      const i = (j * n + k) * 3;
      N[i] = nx;
      N[i + 1] = ny;
      N[i + 2] = nz;
    }
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] | null = o.color ? [] : null;
  const idx: number[] = [];
  const corner = [0, 0, 0, 0];
  for (let j = 0; j < m - 1; j++) {
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      corner[0] = j * n + k;
      corner[1] = j * n + k1;
      corner[2] = (j + 1) * n + k;
      corner[3] = (j + 1) * n + k1;
      let fx = 0;
      let fy = 0;
      let fz = 0;
      if (o.flat) {
        const a = corner[0] * 3;
        const b = corner[1] * 3;
        const c = corner[2] * 3;
        const d = corner[3] * 3;
        const ux = P[d] - P[a];
        const uy = P[d + 1] - P[a + 1];
        const uz = P[d + 2] - P[a + 2];
        const vx = P[c] - P[b];
        const vy = P[c + 1] - P[b + 1];
        const vz = P[c + 2] - P[b + 2];
        fx = uy * vz - uz * vy;
        fy = uz * vx - ux * vz;
        fz = ux * vy - uy * vx;
        const l = Math.hypot(fx, fy, fz) || 1;
        fx /= l;
        fy /= l;
        fz /= l;
      }
      const base = pos.length / 3;
      const rgbQ = col && o.color ? rgb(o.color(j, k)) : null;
      for (let q = 0; q < 4; q++) {
        const g = corner[q] * 3;
        pos.push(P[g], P[g + 1], P[g + 2]);
        if (o.flat) nor.push(fx, fy, fz);
        else nor.push(N[g], N[g + 1], N[g + 2]);
        if (col && rgbQ) col.push(rgbQ[0], rgbQ[1], rgbQ[2]);
      }
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const cap = (j: number, dir: number): void => {
    let cx = 0;
    let cy = 0;
    for (let k = 0; k < n; k++) {
      cx += P[(j * n + k) * 3];
      cy += P[(j * n + k) * 3 + 1];
    }
    const base = pos.length / 3;
    const band = dir < 0 ? 0 : m - 2;
    const capRgb = col ? rgb(o.capColor ?? (o.color ? o.color(band, 0) : 0xffffff)) : null;
    pos.push(cx / n, cy / n, rings[j].z);
    nor.push(0, 0, dir);
    if (col && capRgb) col.push(capRgb[0], capRgb[1], capRgb[2]);
    for (let k = 0; k < n; k++) {
      const g = (j * n + k) * 3;
      pos.push(P[g], P[g + 1], P[g + 2]);
      nor.push(0, 0, dir);
      if (col && capRgb) col.push(capRgb[0], capRgb[1], capRgb[2]);
    }
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      if (dir < 0) idx.push(base, base + 1 + k1, base + 1 + k);
      else idx.push(base, base + 1 + k, base + 1 + k1);
    }
  };
  if (o.capA !== false) cap(0, -1);
  if (o.capB !== false) cap(m - 1, 1);
  return rawGeo(pos, nor, col, idx);
}

/**
 * Querschnitt als Superellipse: e = 2 ist rund, größere Werte werden kastig.
 * Oben und unten dürfen verschieden hoch sein. stripe > 0 rückt die beiden
 * Ecken neben der Mitte oben auf ±stripe – für einen gleich breiten Streifen.
 */
function sring(z: number, cy: number, hw: number, ht: number, hb: number, e: number, segs: number, stripe = 0): Ring {
  const p: number[] = [];
  const q = 2 / e;
  for (let k = 0; k < segs; k++) {
    let a = (k / segs) * TAU;
    if (stripe > 0 && hw > stripe * 1.2) {
      const off = Math.asin(Math.pow(stripe / hw, 1 / q));
      if (k === segs / 4 - 1) a = HALF_PI - off;
      else if (k === segs / 4 + 1) a = HALF_PI + off;
    }
    const c = Math.cos(a);
    const s = Math.sin(a);
    p.push(Math.sign(c) * Math.pow(Math.abs(c), q) * hw, cy + Math.sign(s) * Math.pow(Math.abs(s), q) * (s >= 0 ? ht : hb));
  }
  return { z, p };
}

/** Profilpunkt für lathe(): Radius, Höhe, Farbe des Bandes ab hier, harte Kante. */
type LP = readonly [r: number, y: number, color?: number, hard?: boolean];

/**
 * Drehkörper um die y-Achse. Das Profil läuft außen von unten nach oben.
 * Jedes Band kann eine eigene Farbe haben; Radius 0 ergibt einen Fächer.
 */
function lathe(prof: LP[], segs: number, colorAt?: (band: number, j: number) => number | undefined): THREE.BufferGeometry {
  const m = prof.length;
  const bandN: number[] = [];
  for (let i = 0; i < m - 1; i++) {
    const dr = prof[i + 1][0] - prof[i][0];
    const dy = prof[i + 1][1] - prof[i][1];
    const l = Math.hypot(dr, dy) || 1;
    bandN.push(dy / l, -dr / l);
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  let color = 0xffffff;
  for (let i = 0; i < m - 1; i++) {
    color = prof[i][2] ?? color;
    // Normale am Anfang und am Ende des Bandes (über die Nachbarn gemittelt).
    let sr = bandN[i * 2];
    let sy = bandN[i * 2 + 1];
    if (i > 0 && !prof[i][3]) {
      sr += bandN[(i - 1) * 2];
      sy += bandN[(i - 1) * 2 + 1];
    } else if (i === 0 && prof[0][0] === 0 && !prof[0][3] && Math.abs(sy) > 1e-6) {
      sr = 0;
    }
    let l = Math.hypot(sr, sy) || 1;
    sr /= l;
    sy /= l;
    let er = bandN[i * 2];
    let ey = bandN[i * 2 + 1];
    if (i < m - 2 && !prof[i + 1][3]) {
      er += bandN[(i + 1) * 2];
      ey += bandN[(i + 1) * 2 + 1];
    } else if (i === m - 2 && prof[m - 1][0] === 0 && !prof[m - 1][3] && Math.abs(ey) > 1e-6) {
      er = 0;
    }
    l = Math.hypot(er, ey) || 1;
    er /= l;
    ey /= l;
    const r0 = prof[i][0];
    const y0 = prof[i][1];
    const r1 = prof[i + 1][0];
    const y1 = prof[i + 1][1];
    for (let j = 0; j < segs; j++) {
      const c0 = Math.cos((j / segs) * TAU);
      const s0 = Math.sin((j / segs) * TAU);
      const c1 = Math.cos(((j + 1) / segs) * TAU);
      const s1 = Math.sin(((j + 1) / segs) * TAU);
      const [cr, cg, cb] = rgb(colorAt?.(i, j) ?? color);
      const base = pos.length / 3;
      pos.push(r0 * c0, y0, r0 * s0, r1 * c0, y1, r1 * s0, r0 * c1, y0, r0 * s1, r1 * c1, y1, r1 * s1);
      nor.push(sr * c0, sy, sr * s0, er * c0, ey, er * s0, sr * c1, sy, sr * s1, er * c1, ey, er * s1);
      for (let q = 0; q < 4; q++) col.push(cr, cg, cb);
      if (r0 > 1e-9) idx.push(base, base + 1, base + 2);
      if (r1 > 1e-9) idx.push(base + 1, base + 3, base + 2);
    }
  }
  return rawGeo(pos, nor, col, idx);
}

/** Schlauch entlang eines Pfades, Radius fest oder je Stelle (t = 0..1). */
function sweep(path: readonly V3[], radius: number | ((t: number) => number), radSegs: number, smooth = 0): THREE.BufferGeometry {
  let pts = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  if (smooth > 0) pts = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getPoints(smooth);
  const m = pts.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const T = new THREE.Vector3();
  const Nv = new THREE.Vector3(0, 1, 0);
  const Bv = new THREE.Vector3();
  const firstT = new THREE.Vector3();
  const lastT = new THREE.Vector3();
  for (let i = 0; i < m; i++) {
    T.subVectors(pts[Math.min(i + 1, m - 1)], pts[Math.max(i - 1, 0)]).normalize();
    if (i === 0) {
      if (Math.abs(T.y) > 0.9) Nv.set(1, 0, 0);
      firstT.copy(T);
    }
    if (i === m - 1) lastT.copy(T);
    Nv.addScaledVector(T, -Nv.dot(T)).normalize();
    Bv.crossVectors(T, Nv);
    const r = typeof radius === 'number' ? radius : radius(i / (m - 1));
    for (let k = 0; k < radSegs; k++) {
      const a = (k / radSegs) * TAU;
      const dx = Math.cos(a) * Nv.x + Math.sin(a) * Bv.x;
      const dy = Math.cos(a) * Nv.y + Math.sin(a) * Bv.y;
      const dz = Math.cos(a) * Nv.z + Math.sin(a) * Bv.z;
      pos.push(pts[i].x + dx * r, pts[i].y + dy * r, pts[i].z + dz * r);
      nor.push(dx, dy, dz);
    }
  }
  for (let i = 0; i < m - 1; i++) {
    for (let k = 0; k < radSegs; k++) {
      const k1 = (k + 1) % radSegs;
      const a = i * radSegs + k;
      const b = i * radSegs + k1;
      const c = (i + 1) * radSegs + k;
      const d = (i + 1) * radSegs + k1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // Deckel an beiden Enden.
  for (let e = 0; e < 2; e++) {
    const i = e === 0 ? 0 : m - 1;
    const t = e === 0 ? firstT : lastT;
    const s = e === 0 ? -1 : 1;
    const base = pos.length / 3;
    pos.push(pts[i].x, pts[i].y, pts[i].z);
    nor.push(t.x * s, t.y * s, t.z * s);
    for (let k = 0; k < radSegs; k++) {
      const g = (i * radSegs + k) * 3;
      pos.push(pos[g], pos[g + 1], pos[g + 2]);
      nor.push(t.x * s, t.y * s, t.z * s);
    }
    for (let k = 0; k < radSegs; k++) {
      const k1 = (k + 1) % radSegs;
      if (e === 0) idx.push(base, base + 1 + k1, base + 1 + k);
      else idx.push(base, base + 1 + k, base + 1 + k1);
    }
  }
  return rawGeo(pos, nor, null, idx);
}

/** Flaches Vieleck (x, y) mit Dicke entlang z – für Flossen, Blitze, Zacken. */
function prism(poly: readonly number[], depth: number): THREE.BufferGeometry {
  let pts: THREE.Vector2[] = [];
  for (let i = 0; i < poly.length; i += 2) pts.push(new THREE.Vector2(poly[i], poly[i + 1]));
  if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.reverse();
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  const n = pts.length;
  const h = depth / 2;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (const p of pts) {
    pos.push(p.x, p.y, h);
    nor.push(0, 0, 1);
  }
  for (const p of pts) {
    pos.push(p.x, p.y, -h);
    nor.push(0, 0, -1);
  }
  for (const t of tris) {
    const a = pts[t[0]];
    const b = pts[t[1]];
    const c = pts[t[2]];
    const ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
    if (ccw) idx.push(t[0], t[1], t[2], n + t[0], n + t[2], n + t[1]);
    else idx.push(t[0], t[2], t[1], n + t[0], n + t[1], n + t[2]);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const du = b.x - a.x;
    const dv = b.y - a.y;
    const l = Math.hypot(du, dv) || 1;
    const base = pos.length / 3;
    pos.push(a.x, a.y, h, a.x, a.y, -h, b.x, b.y, -h, b.x, b.y, h);
    for (let q = 0; q < 4; q++) nor.push(dv / l, -du / l, 0);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return rawGeo(pos, nor, null, idx);
}

function sphere(rx: number, ry: number, rz: number, ws: number, hs: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** Zylinder entlang y. */
function cyl(rTop: number, rBot: number, h: number, segs: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBot, h, segs, 1);
}

/** Kegel mit dem Boden im Ursprung, Spitze nach +y. */
function cone(r: number, h: number, segs: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, segs, 1);
  g.translate(0, h / 2, 0);
  return g;
}

/** Kapsel vom Ursprung nach +y (für Arme). */
function limb(r: number, len: number, segs: number, capSegs: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, capSegs, segs, 1);
  g.translate(0, len / 2, 0);
  return g;
}

/** Kissenförmiger Quader mit weichen Kanten (entlang z gespannt). */
function pillow(w: number, h: number, d: number, r: number, segs: number, e = 4): THREE.BufferGeometry {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  return loft([
    sring(-hd, 0, hw - r, hh - r, hh - r, e, segs),
    sring(-hd + r, 0, hw, hh, hh, e, segs),
    sring(hd - r, 0, hw, hh, hh, e, segs),
    sring(hd, 0, hw - r, hh - r, hh - r, e, segs),
  ]);
}

const TIRE = 0x3a3745;
const TIRE_2 = 0x4b4857;

/** Rad: Achse entlang x, Außenseite bei +x. Die Lauffläche ist zweifarbig, damit man die Drehung sieht. */
function wheel(r: number, w: number, segs: number, wall: number, rim: number, rim2: number, hub: number): THREE.BufferGeometry {
  const h = w / 2;
  const prof: LP[] = [
    [0, -h, TIRE],
    [r, -h + w * 0.14, TIRE],
    [r, h - w * 0.26, TIRE],
    [r * 0.83, h, wall],
    [r * 0.62, h - 0.012, rim, true],
    [r * 0.25, h - Math.min(0.075, w * 0.3), hub, true],
    [0, h - Math.min(0.03, w * 0.12)],
  ];
  const g = lathe(prof, segs, (band, j) => (j % 2 === 1 ? (band === 4 ? rim2 : band === 1 ? TIRE_2 : undefined) : undefined));
  g.rotateZ(-HALF_PI);
  return g;
}

/** Vereinfachte Hülle des Rads für die Kontur (ohne Felge). */
function wheelHull(r: number, w: number, segs: number): THREE.BufferGeometry {
  const h = w / 2;
  const g = lathe(
    [
      [0, -h],
      [r, -h + w * 0.14],
      [r, h - w * 0.26],
      [r * 0.83, h],
      [0, h],
    ],
    segs,
  );
  g.rotateZ(-HALF_PI);
  return g;
}

// ───────────────────────────── Zusammenbau ─────────────────────────────

/** Weiche Bindung: liefert zu einem Ort (Ruhelage) zwei Knochen mit Gewichten. */
type SkinFn = (x: number, y: number, z: number, out: number[]) => void;

interface Put {
  bone: number;
  color?: number;
  pos?: V3;
  /** Drehung als Euler-Winkel … */
  rot?: V3;
  order?: THREE.EulerOrder;
  /** … oder: die +y-Achse des Teils zeigt in diese Richtung. */
  aim?: V3;
  scale?: V3 | number;
  /** Dicke der Kontur relativ (1 = normal, 0 = keine). */
  outline?: number;
  /** Vereinfachte Form nur für die Kontur (gleiche Lage wie das Teil selbst). */
  hull?: THREE.BufferGeometry;
  /** Konturdicke je Ecke (0..1), ausgewertet an der unverschobenen Geometrie. */
  taper?: (x: number, y: number, z: number) => number;
  /** Zusätzlich an x gespiegelt, gebunden an diesen Knochen. */
  mirror?: number;
  skin?: SkinFn;
}

/** Grunddicke aller Konturen relativ zur Vorgabe aus toon.ts. */
const LINE = 0.8;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Sammelt Einzelteile zu einem Netz. Jedes Teil wird im Ruhe-Koordinatensystem
 * seines Knochens angegeben, bekommt Farbe und Knochen in die Ecken geschrieben
 * und – wenn gewünscht – einen Eintrag im Kontur-Netz.
 */
class Builder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly uv: number[] = [];
  private readonly si: number[] = [];
  private readonly sw: number[] = [];
  private readonly idx: number[] = [];
  private readonly oPos: number[] = [];
  private readonly oNor: number[] = [];
  private readonly oSi: number[] = [];
  private readonly oSw: number[] = [];
  private readonly oIdx: number[] = [];
  private readonly tmp = [0, 0, 0, 0];

  constructor(
    private readonly rest: THREE.Matrix4[],
    readonly detail: KartDetail,
    private readonly outlines: boolean,
    private readonly withUv = false,
  ) {}

  /** Segmentzahl passend zur Detailstufe. */
  s(n: number, min = 4): number {
    const f = this.detail === 2 ? 1 : this.detail === 1 ? 0.8 : 0.55;
    return Math.max(min, Math.round(n * f));
  }

  /** Wie s(), aber durch vier teilbar (für symmetrische Querschnitte). */
  s4(n: number): number {
    return Math.max(8, Math.round(this.s(n) / 4) * 4);
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /** Feinheiten (kleine Zierteile) gibt es erst ab Detailstufe 1. */
  get fine(): boolean {
    return this.detail > 0;
  }

  /** Polster: weich gerundet, auf der niedrigsten Stufe ein schlichter Quader. */
  soft(w: number, h: number, d: number, r: number, segs: number): THREE.BufferGeometry {
    return this.fine ? pillow(w, h, d, r, segs) : box(w, h, d);
  }

  /** Fügt ein Teil hinzu (die Geometrie wird dabei verbraucht). */
  put(geo: THREE.BufferGeometry, o: Put): void {
    if (o.aim) {
      _p.set(o.aim[0], o.aim[1], o.aim[2]).normalize();
      _q.setFromUnitVectors(Y_AXIS, _p);
    } else if (o.rot) {
      _q.setFromEuler(_e.set(o.rot[0], o.rot[1], o.rot[2], o.order ?? 'XYZ'));
    } else {
      _q.identity();
    }
    if (o.pos) _p.set(o.pos[0], o.pos[1], o.pos[2]);
    else _p.set(0, 0, 0);
    if (typeof o.scale === 'number') _s.setScalar(o.scale);
    else if (o.scale) _s.set(o.scale[0], o.scale[1], o.scale[2]);
    else _s.set(1, 1, 1);
    _m.compose(_p, _q, _s).premultiply(this.rest[o.bone]);
    const hull = o.hull ?? geo;
    let weights: number[] | null = null;
    if (o.taper) {
      const hp = hull.getAttribute('position');
      weights = [];
      for (let i = 0; i < hp.count; i++) weights.push(o.taper(hp.getX(i), hp.getY(i), hp.getZ(i)));
    }
    geo.applyMatrix4(_m);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    if (o.hull) {
      o.hull.applyMatrix4(_m);
      if (!o.hull.getAttribute('normal')) o.hull.computeVertexNormals();
    }
    const thick = this.outlines ? (o.outline ?? 1) * LINE : 0;
    this.appendMain(geo, o, o.bone, false);
    if (thick > 0) this.appendHull(hull, o, o.bone, false, thick, weights);
    if (o.mirror !== undefined) {
      this.appendMain(geo, o, o.mirror, true);
      if (thick > 0) this.appendHull(hull, o, o.mirror, true, thick, weights);
    }
    geo.dispose();
    o.hull?.dispose();
  }

  private appendMain(geo: THREE.BufferGeometry, o: Put, bone: number, mirrored: boolean): void {
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    const c = geo.getAttribute('color');
    const u = geo.getAttribute('uv');
    const index = geo.getIndex();
    const base = this.pos.length / 3;
    const sx = mirrored ? -1 : 1;
    const [cr, cg, cb] = rgb(o.color ?? 0xffffff);
    const tmp = this.tmp;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * sx;
      const y = p.getY(i);
      const z = p.getZ(i);
      this.pos.push(x, y, z);
      this.nor.push(n.getX(i) * sx, n.getY(i), n.getZ(i));
      if (c) this.col.push(c.getX(i), c.getY(i), c.getZ(i));
      else this.col.push(cr, cg, cb);
      if (this.withUv) this.uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      if (o.skin) {
        o.skin(x, y, z, tmp);
        this.si.push(tmp[0], tmp[2], 0, 0);
        this.sw.push(tmp[1], tmp[3], 0, 0);
      } else {
        this.si.push(bone, 0, 0, 0);
        this.sw.push(1, 0, 0, 0);
      }
    }
    const count = index ? index.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const a = base + (index ? index.getX(i) : i);
      const b = base + (index ? index.getX(i + 1) : i + 1);
      const d = base + (index ? index.getX(i + 2) : i + 2);
      if (mirrored) this.idx.push(a, d, b);
      else this.idx.push(a, b, d);
    }
  }

  /**
   * Kontur: Ecken am selben Ort bekommen dieselbe (gemittelte) Richtung, sonst
   * reißt die Hülle an harten Kanten auf. An Kanten wird sie etwas verlängert,
   * damit die Linie dort nicht dünner ausfällt als auf Flächen.
   */
  private appendHull(
    geo: THREE.BufferGeometry,
    o: Put,
    bone: number,
    mirrored: boolean,
    thick: number,
    weights: number[] | null,
  ): void {
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    const index = geo.getIndex();
    const sx = mirrored ? -1 : 1;
    const groups = new Map<string, number[]>();
    const keys: string[] = [];
    for (let i = 0; i < p.count; i++) {
      const key = `${Math.round(p.getX(i) * 4000)},${Math.round(p.getY(i) * 4000)},${Math.round(p.getZ(i) * 4000)}`;
      keys.push(key);
      const nx = n.getX(i);
      const ny = n.getY(i);
      const nz = n.getZ(i);
      const g = groups.get(key);
      if (!g) {
        groups.set(key, [nx, ny, nz]);
        continue;
      }
      let known = false;
      for (let k = 0; k < g.length; k += 3) {
        if (g[k] * nx + g[k + 1] * ny + g[k + 2] * nz > 0.995) {
          known = true;
          break;
        }
      }
      if (!known) g.push(nx, ny, nz);
    }
    const dirs = new Map<string, [number, number, number]>();
    for (const [key, g] of groups) {
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (let k = 0; k < g.length; k += 3) {
        ax += g[k];
        ay += g[k + 1];
        az += g[k + 2];
      }
      const l = Math.hypot(ax, ay, az) || 1;
      ax /= l;
      ay /= l;
      az /= l;
      let minDot = 1;
      for (let k = 0; k < g.length; k += 3) minDot = Math.min(minDot, ax * g[k] + ay * g[k + 1] + az * g[k + 2]);
      const f = thick / clamp(minDot, 0.6, 1);
      dirs.set(key, [ax * f, ay * f, az * f]);
    }
    const base = this.oPos.length / 3;
    const tmp = this.tmp;
    for (let i = 0; i < p.count; i++) {
      const d = dirs.get(keys[i])!;
      const x = p.getX(i) * sx;
      const y = p.getY(i);
      const z = p.getZ(i);
      const w = weights ? weights[i] : 1;
      this.oPos.push(x, y, z);
      this.oNor.push(d[0] * sx * w, d[1] * w, d[2] * w);
      if (o.skin) {
        o.skin(x, y, z, tmp);
        this.oSi.push(tmp[0], tmp[2], 0, 0);
        this.oSw.push(tmp[1], tmp[3], 0, 0);
      } else {
        this.oSi.push(bone, 0, 0, 0);
        this.oSw.push(1, 0, 0, 0);
      }
    }
    const count = index ? index.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const a = base + (index ? index.getX(i) : i);
      const b = base + (index ? index.getX(i + 1) : i + 1);
      const d = base + (index ? index.getX(i + 2) : i + 2);
      if (mirrored) this.oIdx.push(a, d, b);
      else this.oIdx.push(a, b, d);
    }
  }

  finish(): { main: THREE.BufferGeometry; outline: THREE.BufferGeometry | null } {
    const main = new THREE.BufferGeometry();
    main.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    main.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    main.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.withUv) main.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    main.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    main.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    main.setIndex(this.idx);
    main.boundingSphere = BOUNDS.clone();
    let outline: THREE.BufferGeometry | null = null;
    if (this.oIdx.length > 0) {
      outline = new THREE.BufferGeometry();
      outline.setAttribute('position', new THREE.Float32BufferAttribute(this.oPos, 3));
      outline.setAttribute('onormal', new THREE.Float32BufferAttribute(this.oNor, 3));
      outline.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.oSi, 4));
      outline.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.oSw, 4));
      outline.setIndex(this.oIdx);
      outline.boundingSphere = BOUNDS.clone();
    }
    return { main, outline };
  }
}

/** Drehpunkt des Drifts: ein Stück vor der Mitte, damit das Heck ausbricht. */
const DRIFT_PIVOT = 0.3;

/** Großzügige Hülle fürs Sichtbarkeits-Culling (Kart samt Schal, Ring, Flammen). */
const BOUNDS = new THREE.Sphere(new THREE.Vector3(0, 0.7, 0), 2.6);

// ───────────────────────────── Maße je Kart ─────────────────────────────

interface WheelSpec {
  x: number;
  z: number;
  r: number;
  w: number;
}

interface Spec {
  wf: WheelSpec;
  wr: WheelSpec;
  /** Hüfte: Drehpunkt des Oberkörpers. */
  hip: V3;
  /** Hüfte → Hals. */
  torsoLen: number;
  /** Linke Schulter relativ zur Hüfte. */
  shoulder: V3;
  armR: number;
  upper: number;
  fore: number;
  hand: number;
  /** Lenkrad: Mitte, Neigung, Radius. */
  steer: V3;
  steerTilt: number;
  steerR: number;
  /** Linke Auspuffmündung und Steigung der Flamme. */
  exhaust: V3;
  exhaustUp: number;
  /** Linker Ohransatz im Kopf, Neigung nach außen. */
  ear: V3;
  earTilt: number;
  /** Kette (Schal/Schwanz): Elternknochen, erstes Gelenk, Schritt zum nächsten. */
  chainParent: number;
  chain: V3;
  chainStep: V3;
  /** Zwei freie Knochen je Figur (Motor/Kiefer, Schnauzbart, Antennen): Elternknochen und Lage. */
  auxParent: number;
  aux: V3;
  aux1Parent: number;
  aux1: V3;
  /** Wo es bei „Kurzschluss“ qualmt. */
  smoke: V3;
  /** Gleitflügel: linkes Gelenk, Abstand zum Außenteil, V-Stellung (rad), Leitwerk. */
  wing: V3;
  wingTip: number;
  wingUp: number;
  wingTail: V3;
  /** Tauchen: Drehpunkt der Kopf-Ausrüstung (im Kopf), Gelenk an der Karosserie, linke Schraube, Blasenquelle (im Kopf). */
  diveHead: V3;
  diveBody: V3;
  diveProp: V3;
  diveBub: V3;
  /** Raum: Mitte der Helmkugel (im Kopf), ihre Halbachsen und wie weit sie unten offen ist (Winkel vom Scheitel). */
  spaceHelm: V3;
  spaceHelmR: V3;
  spaceCut: number;
  /** Tornister (relativ zur Hüfte) und Fuß der Antenne (relativ zum Tornister). */
  spacePack: V3;
  spaceAnt: V3;
  /** Linke Düsenmündungen vorn und hinten, Positionsleuchte (alles an der Karosserie). */
  spaceJetF: V3;
  spaceJetR: V3;
  spaceLamp: V3;
}

const SPECS: Spec[] = [
  // 0 – Kolben-Kalle: Hot-Rod, hinten riesige Räder, vorn kleine
  {
    wf: { x: 0.585, z: 0.7, r: 0.25, w: 0.22 },
    wr: { x: 0.575, z: -0.56, r: 0.37, w: 0.36 },
    hip: [0, 0.47, -0.3],
    torsoLen: 0.37,
    shoulder: [0.26, 0.26, 0.02],
    armR: 0.07,
    upper: 0.25,
    fore: 0.25,
    hand: 0.072,
    steer: [0, 0.67, 0.13],
    steerTilt: 0.62,
    steerR: 0.15,
    exhaust: [0.25, 0.335, -1.06],
    exhaustUp: 0.3,
    ear: [0.285, 0.455, -0.03],
    earTilt: 0.5,
    chainParent: B.chassis,
    chain: [0, 0.5, -0.9],
    chainStep: [0, 0, -0.1],
    auxParent: B.chassis, // Motorblock (zittert)
    aux: [0, 0.4, 0.58],
    aux1Parent: B.head, // Unterkiefer
    aux1: [0, 0.15, 0.08],
    smoke: [0, 0.85, 0.6],
    wing: [0.33, 0.47, 0.05],
    wingTip: 0.62,
    wingUp: 0.02,
    wingTail: [0, 0.62, -0.9],
    diveHead: [0, 0.345, 0.29],
    diveBody: [0, 0.27, -1.0],
    diveProp: [0, 0.27, -1.13],
    diveBub: [0.34, 0.77, 0.07],
    spaceHelm: [0, 0.32, 0.1],
    spaceHelmR: [0.5, 0.5, 0.5],
    spaceCut: 2.5,
    spacePack: [0, 0.43, -0.3],
    spaceAnt: [0.11, 0.15, -0.02],
    spaceJetF: [0.25, 0.62, 0.9],
    spaceJetR: [0.36, 0.56, -0.9],
    spaceLamp: [0, 0.63, -0.85],
  },
  // 1 – Vera Vergaser: schlanker Renner
  {
    wf: { x: 0.625, z: 0.68, r: 0.29, w: 0.18 },
    wr: { x: 0.63, z: -0.58, r: 0.32, w: 0.21 },
    hip: [0, 0.44, -0.2],
    torsoLen: 0.35,
    shoulder: [0.19, 0.25, 0.02],
    armR: 0.05,
    upper: 0.23,
    fore: 0.23,
    hand: 0.06,
    steer: [0, 0.63, 0.2],
    steerTilt: 0.6,
    steerR: 0.14,
    exhaust: [0.33, 0.34, -1.0],
    exhaustUp: 0.06,
    ear: [0.15, 0.49, -0.02],
    earTilt: 0.28,
    chainParent: B.torso, // Schal
    chain: [0.13, 0.36, -0.13],
    chainStep: [0, 0, -0.21],
    auxParent: B.chassis,
    aux: [0, 0.5, 0],
    aux1Parent: B.chassis,
    aux1: [0, 0.5, 0],
    smoke: [0, 0.8, -0.75],
    wing: [0.24, 0.47, -0.05],
    wingTip: 0.78,
    wingUp: 0.1,
    wingTail: [0, 0.6, -0.86],
    diveHead: [0, 0.28, 0],
    diveBody: [0, 0.34, -1.0],
    diveProp: [0.33, 0.34, -1.04],
    diveBub: [0, 0.16, 0.44],
    spaceHelm: [0, 0.3, 0.08],
    spaceHelmR: [0.38, 0.45, 0.47],
    spaceCut: 2.45,
    spacePack: [-0.1, 0.3, -0.27],
    spaceAnt: [0, 0.2, 0],
    spaceJetF: [0.13, 0.4, 0.85],
    spaceJetR: [0.25, 0.6, -0.72],
    spaceLamp: [0, 1.09, -0.96],
  },
  // 2 – Bremsen-Bert: Badewanne auf Rädern
  {
    wf: { x: 0.6, z: 0.6, r: 0.27, w: 0.27 },
    wr: { x: 0.6, z: -0.62, r: 0.29, w: 0.29 },
    hip: [0, 0.52, -0.22],
    torsoLen: 0.33,
    shoulder: [0.29, 0.22, 0.02],
    armR: 0.075,
    upper: 0.27,
    fore: 0.27,
    hand: 0.078,
    steer: [0, 0.69, 0.3],
    steerTilt: 0.72,
    steerR: 0.15,
    exhaust: [0.2, 0.2, -1.03],
    exhaustUp: 0.1,
    ear: [0.3, 0.3, 0],
    earTilt: 0,
    chainParent: B.chassis,
    chain: [0, 0.5, -0.9],
    chainStep: [0, 0, -0.1],
    auxParent: B.head, // Schnauzbart links/rechts
    aux: [0.1, 0.19, 0.27],
    aux1Parent: B.head,
    aux1: [-0.1, 0.19, 0.27],
    smoke: [0, 0.75, -0.85],
    wing: [0.44, 0.45, -0.02],
    wingTip: 0.5,
    wingUp: 0.12,
    wingTail: [0, 0.62, -1.0],
    diveHead: [0, 0.375, 0.3],
    diveBody: [-0.34, 0.62, -0.86],
    diveProp: [-0.34, 0.17, -1.1],
    diveBub: [0, 0.07, 0.44],
    spaceHelm: [0, 0.24, 0.06],
    spaceHelmR: [0.5, 0.52, 0.52],
    spaceCut: 2.35,
    spacePack: [0, 0.3, -0.36],
    spaceAnt: [0.2, 0.08, 0],
    spaceJetF: [0.36, 0.63, 0.66],
    spaceJetR: [0.36, 0.63, -0.66],
    spaceLamp: [0, 0.64, -0.86],
  },
  // 3 – Zünd-Zoe: kantiger Keil mit Zündkerzen
  {
    wf: { x: 0.6, z: 0.7, r: 0.26, w: 0.22 },
    wr: { x: 0.6, z: -0.58, r: 0.31, w: 0.28 },
    hip: [0, 0.45, -0.18],
    torsoLen: 0.34,
    shoulder: [0.18, 0.25, 0.02],
    armR: 0.046,
    upper: 0.21,
    fore: 0.21,
    hand: 0.058,
    steer: [0, 0.63, 0.2],
    steerTilt: 0.6,
    steerR: 0.135,
    exhaust: [0.22, 0.38, -1.04],
    exhaustUp: 0.1,
    ear: [0.165, 0.5, -0.02],
    earTilt: 0.34,
    chainParent: B.chassis, // Schwanz
    chain: [0.0, 0.62, -0.6],
    chainStep: [0, 0.24, -0.06],
    auxParent: B.chassis, // Zündkerzen-Antennen
    aux: [0.3, 0.648, -0.86],
    aux1Parent: B.chassis,
    aux1: [-0.3, 0.648, -0.86],
    smoke: [0, 0.8, -0.8],
    wing: [0.38, 0.36, -0.05],
    wingTip: 0.72,
    wingUp: 0.06,
    wingTail: [0, 0.5, -0.5],
    diveHead: [0, 0.36, 0],
    diveBody: [0, 0.4, -0.9],
    diveProp: [0.22, 0.38, -1.1],
    diveBub: [0, 0.8, -0.2],
    spaceHelm: [0, 0.3, 0.03],
    spaceHelmR: [0.43, 0.43, 0.43],
    spaceCut: 2.4,
    spacePack: [0.1, 0.33, -0.25],
    spaceAnt: [0.06, 0.14, -0.02],
    spaceJetF: [0.2, 0.27, 0.99],
    spaceJetR: [0.42, 0.56, -0.98],
    spaceLamp: [0, 0.67, -0.99],
  },
];

/** Alles, was die Baufunktionen einer Figur brauchen. */
interface Ctx {
  b: Builder;
  /** Aufkleber (Augen, Startnummer) – eigenes Netz mit Textur. */
  d: Builder;
  sp: Spec;
  /** Lackfarben des Platzes. */
  p: Paint;
  /** Angestammte Kombination (Figur i im Lack von Platz i): handabgestimmt, keine Kontrastregel. */
  native: boolean;
  /** Erste Ecke der Augen im Aufkleber-Netz (setzt addEyes). */
  eyeStart: number;
}

/**
 * Helle Zierlinie (Weiß/Creme) der Figur – oder, wenn sie sich vom Lack nicht
 * abhebt (Gelb), ein dunkler Strich in der Teamfarbe.
 */
function trim(c: Ctx, light: number): number {
  return c.native || contrast(light, c.p.base) >= MIN_TRIM_CONTRAST ? light : c.p.ink;
}

// ───────────────────────────── Aufkleber: Augen und Startnummer ─────────────────────────────

const EYE = { OPEN: 0, BLINK: 1, DIZZY: 2, STUN: 3, HAPPY: 4, SAD: 5, FIERCE: 6, WOW: 7 } as const;
const ATLAS_COLS = 4;
const ATLAS_ROWS = 3;
const CELL = 192;

interface EyeStyle {
  iris: string;
  irisRim: string;
  /** Halbachsen des Augapfels als Anteil der Zelle. */
  rx: number;
  ry: number;
  /** Wie weit das Oberlid im Normalzustand herabhängt (0..1). */
  lid: number;
  /** > 0: zur Nase hin tiefer (grimmig); < 0: außen tiefer (sanft). */
  lidSlope: number;
  /** Breite der Pupille (1 = rund, kleiner = Schlitz). */
  pupil: number;
  irisR: number;
  lashes: number;
}

const EYE_STYLES: EyeStyle[] = [
  { iris: '#8a4f22', irisRim: '#4a2812', rx: 0.4, ry: 0.4, lid: 0.16, lidSlope: 0.3, pupil: 1, irisR: 0.25, lashes: 0 },
  { iris: '#35c46c', irisRim: '#12733a', rx: 0.43, ry: 0.37, lid: 0.12, lidSlope: 0.1, pupil: 0.9, irisR: 0.25, lashes: 2 },
  { iris: '#4a86d8', irisRim: '#1f4a8c', rx: 0.38, ry: 0.36, lid: 0.4, lidSlope: -0.14, pupil: 1, irisR: 0.24, lashes: 0 },
  { iris: '#c3f23c', irisRim: '#5d9a10', rx: 0.41, ry: 0.45, lid: 0.04, lidSlope: 0.06, pupil: 0.62, irisR: 0.3, lashes: 3 },
];

function drawOpenEye(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  S: number,
  st: EyeStyle,
  lid: number,
  slope: number,
  irisScale: number,
  lookY: number,
  sparkle: boolean,
): void {
  const rx = st.rx * S;
  const ry = st.ry * S;
  const lw = S * 0.05;
  const yl = cy - ry + 2 * ry * lid;
  const k = slope * rx * 0.55;
  const dx = rx * 1.5;
  g.save();
  // Alles unterhalb der Lidlinie ist Auge.
  g.beginPath();
  g.moveTo(cx - dx, yl + k);
  g.lineTo(cx + dx, yl - k);
  g.lineTo(cx + dx, cy + ry * 2);
  g.lineTo(cx - dx, cy + ry * 2);
  g.closePath();
  g.clip();
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.fillStyle = '#ffffff';
  g.fill();
  g.save();
  g.clip();
  // Iris, leicht zur Nase hin versetzt (die Zelle zeigt das linke Auge; die
  // Nase liegt links).
  const ix = cx - rx * 0.1;
  const iy = cy + ry * 0.08 + lookY * ry;
  const ir = st.irisR * S * irisScale;
  if (irisScale > 0.3) {
    g.beginPath();
    g.arc(ix, iy, ir, 0, TAU);
    g.fillStyle = st.iris;
    g.fill();
    g.lineWidth = lw * 0.7;
    g.strokeStyle = st.irisRim;
    g.stroke();
    // dunklerer oberer Rand der Iris
    g.beginPath();
    g.arc(ix, iy - ir * 0.55, ir, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fill();
  }
  g.beginPath();
  const pr = irisScale > 0.3 ? ir * 0.62 : S * 0.045;
  g.ellipse(ix, iy, pr * (irisScale > 0.3 ? st.pupil : 1), pr, 0, 0, TAU);
  g.fillStyle = INK_CSS;
  g.fill();
  if (irisScale > 0.3) {
    // Glanzpunkte
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(ix + ir * 0.38, iy - ir * 0.42, ir * (sparkle ? 0.4 : 0.32), 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(ix - ir * 0.4, iy + ir * 0.42, ir * (sparkle ? 0.22 : 0.15), 0, TAU);
    g.fill();
  }
  // Schatten des Oberlids
  g.fillStyle = 'rgba(70,60,110,0.22)';
  g.beginPath();
  g.moveTo(cx - dx, yl + k);
  g.lineTo(cx + dx, yl - k);
  g.lineTo(cx + dx, yl - k + ry * 0.28);
  g.lineTo(cx - dx, yl + k + ry * 0.28);
  g.closePath();
  g.fill();
  g.restore();
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.lineWidth = lw;
  g.strokeStyle = INK_CSS;
  g.stroke();
  g.restore();
  // Oberlid als kräftiger Tuschestrich
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, rx + lw * 0.5, ry + lw * 0.5, 0, 0, TAU);
  g.clip();
  g.strokeStyle = INK_CSS;
  g.lineWidth = lw * 1.9;
  g.beginPath();
  if (lid > 0.06) {
    g.moveTo(cx - dx, yl + k);
    g.lineTo(cx + dx, yl - k);
  } else {
    g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
  }
  g.stroke();
  g.restore();
  // Wimpern am äußeren Augenwinkel
  if (st.lashes > 0) {
    g.strokeStyle = INK_CSS;
    g.lineWidth = lw * 1.1;
    g.lineCap = 'round';
    for (let i = 0; i < st.lashes; i++) {
      const a = -0.25 - i * 0.33;
      const ex = cx + Math.cos(a) * rx;
      const ey = Math.max(cy + Math.sin(a) * ry, yl - (k * (ex - cx)) / dx);
      g.beginPath();
      g.moveTo(ex - S * 0.01, ey);
      g.lineTo(ex + S * 0.07, ey - S * (0.035 + i * 0.022));
      g.stroke();
    }
  }
}

function drawEye(g: CanvasRenderingContext2D, x0: number, y0: number, st: EyeStyle, state: number): void {
  const S = CELL;
  // Mit Wimpern rückt das Auge etwas zur Nase, damit sie in der Zelle Platz haben.
  const cx = x0 + S / 2 - (st.lashes > 0 ? S * 0.035 : 0);
  const cy = y0 + S / 2;
  const rx = st.rx * S;
  const ry = st.ry * S;
  const lw = S * 0.05;
  // Nichts darf in die Nachbarzelle ragen (dort gäbe es sonst Flecken neben dem Auge).
  g.save();
  g.beginPath();
  g.rect(x0 + 3, y0 + 3, S - 6, S - 6);
  g.clip();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = INK_CSS;
  switch (state) {
    case EYE.BLINK:
      g.lineWidth = lw * 2;
      g.beginPath();
      g.ellipse(cx, cy - ry * 0.2, rx * 0.9, ry * 0.5, 0, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
      // Wimpern am geschlossenen Auge
      g.lineWidth = lw * 1.1;
      for (let i = 0; i < st.lashes; i++) {
        const a = Math.PI * (0.14 + i * 0.1);
        const ex = cx + Math.cos(a) * rx * 0.9;
        const ey = cy - ry * 0.2 + Math.sin(a) * ry * 0.5;
        g.beginPath();
        g.moveTo(ex, ey);
        g.lineTo(ex + S * 0.05, ey + S * 0.055);
        g.stroke();
      }
      break;
    case EYE.HAPPY:
      g.lineWidth = lw * 2.2;
      g.beginPath();
      g.ellipse(cx, cy + ry * 0.4, rx * 0.88, ry * 0.8, 0, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      break;
    case EYE.DIZZY: {
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = lw;
      g.stroke();
      g.lineWidth = lw * 1.25;
      g.beginPath();
      const turns = 2.4;
      for (let i = 0; i <= 80; i++) {
        const f = i / 80;
        const a = f * turns * TAU;
        const r = f * 0.74;
        const px = cx + Math.cos(a) * r * rx;
        const py = cy + Math.sin(a) * r * ry;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
      break;
    }
    case EYE.STUN:
      drawOpenEye(g, cx, cy, S, st, 0, 0, 0.2, 0, false);
      break;
    case EYE.SAD:
      drawOpenEye(g, cx, cy, S, st, 0.44, -0.42, 0.95, 0.22, false);
      break;
    case EYE.FIERCE:
      drawOpenEye(g, cx, cy, S, st, Math.max(st.lid, 0.26) + 0.1, 0.42, 0.95, 0, false);
      break;
    case EYE.WOW:
      drawOpenEye(g, cx, cy, S, st, 0, 0, 1.12, -0.04, true);
      break;
    default:
      drawOpenEye(g, cx, cy, S, st, st.lid, st.lidSlope, 1, 0, false);
  }
  g.restore();
}

/** Zeichnet alle Augenzustände einer Figur und die Startnummer ihres Platzes in ein Bild. */
function makeAtlas(character: number, slot: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CELL * ATLAS_COLS;
  canvas.height = CELL * ATLAS_ROWS;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const st = EYE_STYLES[character];
  for (let s = 0; s < 8; s++) drawEye(g, (s % ATLAS_COLS) * CELL, Math.floor(s / ATLAS_COLS) * CELL, st, s);
  // Startnummer: kräftige, schräge Ziffer
  g.save();
  g.translate(CELL / 2, CELL * 2.5);
  g.transform(1, 0, -0.14, 1, 0, 0);
  g.font = `900 ${Math.round(CELL * 0.74)}px "Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK_CSS;
  g.fillText(String(slot + 1), CELL * 0.03, CELL * 0.04);
  g.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Gewölbter Flicken auf dem Schädel für ein Auge. uv läuft 0..1 über die
 * Zelle; u = 0 liegt an der Nase (das rechte Auge wird dafür gespiegelt).
 */
function eyePatch(
  c: V3,
  r: V3,
  phi0: number,
  psi0: number,
  dphi: number,
  dpsi: number,
  tilt: number,
  n: number,
  flipU: boolean,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const lift = 1.02;
  for (let iy = 0; iy <= n; iy++) {
    for (let ix = 0; ix <= n; ix++) {
      const u = ix / n;
      const v = iy / n;
      const du = (u - 0.5) * 2 * dphi;
      const dv = (v - 0.5) * 2 * dpsi;
      const phi = phi0 + du * ct - dv * st;
      const psi = psi0 + du * st + dv * ct;
      pos.push(
        c[0] + r[0] * lift * Math.sin(phi) * Math.cos(psi),
        c[1] + r[1] * lift * Math.sin(psi),
        c[2] + r[2] * lift * Math.cos(phi) * Math.cos(psi),
      );
      uv.push(flipU ? 1 - u : u, v);
    }
  }
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const a = iy * (n + 1) + ix;
      idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface EyePlace {
  c: V3;
  r: V3;
  phi: number;
  psi: number;
  dphi: number;
  dpsi: number;
  tilt: number;
}

/** Beide Augen; merkt sich, wo sie im Aufkleber-Netz liegen (für setEyes). */
function addEyes(c: Ctx, e: EyePlace): void {
  const n = c.d.detail === 0 ? 2 : 4;
  c.eyeStart = c.d.vertexCount;
  c.d.put(eyePatch(e.c, e.r, e.phi, e.psi, e.dphi, e.dpsi, e.tilt, n, false), { bone: B.head });
  c.d.put(eyePatch(e.c, e.r, -e.phi, e.psi, e.dphi, e.dpsi, -e.tilt, n, true), { bone: B.head });
}

/**
 * Startnummernschild: helle Scheibe im Netz, Ziffer als Aufkleber darüber.
 * Die Scheibe schaut entlang ihrer +y-Achse; turn dreht die Ziffer in der
 * Scheibenebene (0: Oberkante der Ziffer nach −z, π: nach +z, ±π/2: seitlich).
 * flat: ohne eigene Kontur (für Schilder, die bündig auf einer Fläche liegen).
 */
function addNumber(c: Ctx, pos: V3, rot: V3, r: number, turn: number, flat = false): void {
  c.b.put(cyl(r, r, 0.016, c.b.s(12, 8)), { bone: B.chassis, color: WHITE, pos, rot, outline: flat ? 0 : 0.55 });
  const a = r * 0.86;
  const co = Math.cos(turn);
  const si = Math.sin(turn);
  const h = 0.0135;
  const u0 = 0;
  const u1 = 1 / ATLAS_COLS;
  const v0 = 0;
  const v1 = 1 / ATLAS_ROWS;
  const g = new THREE.BufferGeometry();
  const corner = (x: number, z: number): number[] => [x * co + z * si, h, -x * si + z * co];
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([...corner(-a, a), ...corner(a, a), ...corner(a, -a), ...corner(-a, -a)], 3),
  );
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  c.d.put(g, { bone: B.chassis, pos, rot });
}

// ───────────────────────────── gemeinsame Teile ─────────────────────────────

interface WheelLook {
  wall: number;
  rim: number;
  rim2: number;
  hub: number;
}

function addWheels(c: Ctx, look: WheelLook): void {
  const { b, sp } = c;
  const segs = b.s(12, 8);
  b.put(wheel(sp.wf.r, sp.wf.w, segs, look.wall, look.rim, look.rim2, look.hub), {
    bone: B.wFL,
    mirror: B.wFR,
    hull: wheelHull(sp.wf.r, sp.wf.w, segs),
  });
  b.put(wheel(sp.wr.r, sp.wr.w, segs, look.wall, look.rim, look.rim2, look.hub), {
    bone: B.wRL,
    mirror: B.wRR,
    hull: wheelHull(sp.wr.r, sp.wr.w, segs),
  });
}

/** Achse zwischen zwei Rädern (sichtbar, wo die Karosserie schmal ist). */
function addAxle(c: Ctx, w: WheelSpec, r: number): void {
  c.b.put(cyl(r, r, w.x * 2, 5), { bone: B.chassis, color: DARK, pos: [0, w.r, w.z], rot: [0, 0, HALF_PI], outline: 0.6 });
}

function addSteering(c: Ctx, rimColor: number, spoke: number): void {
  const { b, sp } = c;
  const R = sp.steerR;
  b.put(new THREE.TorusGeometry(R, 0.02, 4, b.s(10, 8)), { bone: B.steer, color: rimColor, outline: 0.6 });
  b.put(box(R * 2, 0.03, 0.014), { bone: B.steer, color: spoke, outline: 0 });
  if (!b.fine) return;
  b.put(box(0.03, R, 0.014), { bone: B.steer, color: spoke, pos: [0, R / 2, 0], outline: 0 });
  // Lenksäule nach vorn-unten ins Armaturenbrett
  b.put(cyl(0.016, 0.016, 0.34, 4), { bone: B.steer, color: DARK, pos: [0, 0, -0.17], rot: [HALF_PI, 0, 0], outline: 0 });
}

interface BodyLook {
  /** Rumpf: Halbbreite x, Halbtiefe z. */
  rx: number;
  rz: number;
  /** Farben des Rumpfs von unten nach oben (ein Eintrag = einfarbig). */
  suit: number[];
  sleeve: number;
  cuff: number;
  glove: number;
}

function addDriverBody(c: Ctx, look: BodyLook): void {
  const { b, sp } = c;
  const h = sp.torsoLen;
  const rx = look.rx;
  // Rumpf als Fass mit runden Schultern; unten steckt er in der Karosserie.
  const rows: [number, number][] = [
    [0, -0.14],
    [rx * 0.85, -0.12],
    [rx, 0.0],
    [rx, h * 0.3],
    [rx * 0.98, h * 0.55],
    [rx * 0.88, h * 0.78],
    [rx * 0.6, h * 0.95],
    [0, h + 0.02],
  ];
  const stripes = look.suit;
  const prof: LP[] = rows.map((row, i) => [row[0], row[1], stripes[Math.min(i, stripes.length - 1)]] as const);
  const torso = lathe(prof, b.s(10, 8));
  torso.scale(1, 1, look.rz / rx);
  b.put(torso, { bone: B.torso });
  // Arme: Oberarm, Unterarm, Hand – jeweils eigener Knochen.
  const segs = b.s(6, 5);
  // Die runden Enden bekommen keine Kontur – sonst zeichnen sich an den Gelenken Ringe ab.
  const shaft =
    (len: number) =>
    (_x: number, y: number): number =>
      y < -1e-4 || y > len + 1e-4 ? 0 : 1;
  b.put(limb(sp.armR, sp.upper, segs, b.detail === 0 ? 1 : 2), {
    bone: B.armLU,
    color: look.sleeve,
    mirror: B.armRU,
    outline: 0.8,
    taper: shaft(sp.upper),
  });
  b.put(limb(sp.armR * 0.88, sp.fore, segs, 1), {
    bone: B.armLF,
    color: look.cuff,
    mirror: B.armRF,
    outline: 0.8,
    taper: shaft(sp.fore),
  });
  b.put(sphere(sp.hand, sp.hand * 0.9, sp.hand, 6, b.s(5, 4)), {
    bone: B.handL,
    color: look.glove,
    pos: [0, sp.hand * 0.3, 0],
    mirror: B.handR,
    outline: 0.8,
  });
}

interface HelmetOpts {
  stripe?: number;
  stripeHalf?: number;
  rim?: number;
  ws?: number;
  /** Glanzlicht: Richtung (Winkel um die Hochachse, 0 = vorn, positiv = links). */
  gloss?: number;
}

/**
 * Helmschale: Kugelkappe bis zum Winkel cut (vom Scheitel), um tilt nach
 * hinten gekippt, mit Wulst an der Kante und optionalem Mittelstreifen.
 */
function addHelmet(b: Builder, c: V3, r: V3, cut: number, tilt: number, color: number, o: HelmetOpts = {}): void {
  const ws = b.s(o.ws ?? 14, 8);
  const hs = b.s(5, 3);
  const rot: V3 = [tilt, 0, 0];
  b.put(new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, cut), { bone: B.head, color, pos: c, rot, scale: r });
  if (o.rim !== undefined && b.fine) {
    const ring = new THREE.TorusGeometry(Math.sin(cut), 0.055, 3, ws);
    ring.rotateX(HALF_PI);
    ring.translate(0, Math.cos(cut), 0);
    b.put(ring, { bone: B.head, color: o.rim, pos: c, rot, scale: r, outline: 0 });
  }
  if (o.stripe !== undefined) {
    const half = o.stripeHalf ?? 0.2;
    const band = new THREE.SphereGeometry(1.014, b.s(8, 5), 1, Math.PI - cut, cut * 2, HALF_PI - half, half * 2);
    band.rotateZ(HALF_PI);
    b.put(band, { bone: B.head, color: o.stripe, pos: c, rot, scale: r, outline: 0 });
  }
  if (o.gloss !== undefined && b.fine) {
    // Comic-Glanzlicht: kleiner heller Fleck schräg oben auf der Schale
    const spot = new THREE.SphereGeometry(1.016, 3, 2, HALF_PI + o.gloss - 0.3, 0.6, 0.42, 0.26);
    b.put(spot, { bone: B.head, color: 0xffffff, pos: c, rot, scale: r, outline: 0 });
  }
}

/** Spitzes Ohr (Fuchs, Katze): flacher Kegel mit hellem Innenohr und dunkler Spitze. */
function addPointedEars(b: Builder, r: number, h: number, fur: number, inner: number, tip: number | null): void {
  const segs = b.s(6, 5);
  b.put(cone(r, h, segs), { bone: B.earL, color: fur, scale: [1, 1, 0.5], mirror: B.earR, outline: 0.9 });
  if (b.fine)
    b.put(cone(r * 0.62, h * 0.66, 4), {
      bone: B.earL,
      color: inner,
      pos: [0, h * 0.04, r * 0.24],
      scale: [1, 1, 0.3],
      mirror: B.earR,
      outline: 0,
    });
  if (tip !== null) {
    const th = h * 0.4;
    b.put(cone((r * th) / h + 0.006, th + 0.006, segs), {
      bone: B.earL,
      color: tip,
      pos: [0, h - th, 0],
      scale: [1, 1, 0.56],
      mirror: B.earR,
      outline: 0,
    });
  }
}

/** Auspuffmündung: dunkles Loch am Rohrende. */
function addPipeHole(c: Ctx, r: number): void {
  const e = c.sp.exhaust;
  if (!c.b.fine) return;
  c.b.put(sphere(r, r, r * 0.35, 6, 3), {
    bone: B.chassis,
    color: 0x1c1920,
    pos: [e[0], e[1], e[2] + 0.004],
    rot: [-c.sp.exhaustUp, 0, 0],
    mirror: B.chassis,
    outline: 0,
  });
}

/** Scheinwerfer: Chromtopf mit hellem Glas nach vorn. */
function addLamp(c: Ctx, pos: V3, r: number): void {
  const b = c.b;
  b.put(sphere(r, r, r * 0.95, b.s(8, 6), b.s(5, 4)), { bone: B.chassis, color: CHROME, pos, mirror: B.chassis, outline: 0.75 });
  if (b.fine)
    b.put(sphere(r * 0.76, r * 0.76, r * 0.36, b.s(8, 6), 3), {
      bone: B.chassis,
      color: 0xfff3b0,
      pos: [pos[0], pos[1], pos[2] + r * 0.72],
      mirror: B.chassis,
      outline: 0,
    });
}

// ───────────────────────────── 0: Kolben-Kalle ─────────────────────────────

function buildKalle(c: Ctx): void {
  const { b, sp } = c;
  const RED = c.p.base;
  const RED_D = c.p.dark;
  const CREAM = trim(c, 0xffefd2);
  const LEATHER = 0x6a4230;
  const CH = B.chassis;

  // — Karosserie: gedrungene Wanne mit steilem Heckblech —
  const S = b.s4(16);
  const rr = (z: number, hw: number, ht: number, hb: number, cy = 0.4): Ring => sring(z, cy, hw, ht, hb, 3.2, S, 0.07);
  b.put(
    loft(
      [
        rr(-1.0, 0.31, 0.165, 0.175, 0.415),
        rr(-0.92, 0.365, 0.205, 0.215, 0.41),
        rr(-0.66, 0.385, 0.22, 0.24),
        rr(-0.3, 0.39, 0.22, 0.25),
        rr(0.08, 0.37, 0.21, 0.25),
        rr(0.3, 0.32, 0.18, 0.23),
      ],
      {
        color: (_j, k) => (k === S / 4 - 1 || k === S / 4 ? CREAM : RED),
        capColor: RED_D,
      },
    ),
    { bone: CH },
  );
  // Sitzmulde und Lehne
  b.put(sphere(0.27, 0.035, 0.25, b.s(10, 8), 3), { bone: CH, color: 0x3a2a26, pos: [0, 0.612, -0.27], outline: 0 });
  b.put(b.soft(0.5, 0.4, 0.12, 0.045, 8), { bone: CH, color: LEATHER, pos: [0, 0.77, -0.6], rot: [-0.2, 0, 0] });
  // Kühlermaske mit Chromstreben
  const gs = b.s4(12);
  b.put(
    loft([
      sring(0.84, 0.42, 0.17, 0.2, 0.21, 3, gs),
      sring(0.93, 0.42, 0.2, 0.235, 0.23, 3, gs),
      sring(0.975, 0.42, 0.185, 0.22, 0.215, 3, gs),
    ]),
    { bone: CH, color: RED },
  );
  b.put(loft([sring(0.97, 0.42, 0.14, 0.17, 0.165, 3, gs), sring(0.99, 0.42, 0.125, 0.155, 0.15, 3, gs)], { capA: false }), {
    bone: CH,
    color: 0x3b3f4d,
    outline: 0,
  });
  if (b.fine)
    for (let i = -1; i <= 1; i++)
      b.put(box(0.022, 0.3, 0.012), { bone: CH, color: CHROME, pos: [i * 0.065, 0.42, 0.992], outline: 0 });
  addLamp(c, [0.295, 0.5, 0.9], 0.08);
  // Rahmen und Vorderachse
  b.put(box(0.06, 0.07, 0.72), { bone: CH, color: DARK, pos: [0.19, 0.25, 0.62], mirror: CH, outline: 0.6 });
  addAxle(c, sp.wf, 0.03);

  // — freiliegender Motor (eigener Knochen: er zittert) —
  const EN = B.aux0;
  b.put(box(0.3, 0.22, 0.44), { bone: EN, color: STEEL });
  b.put(box(0.11, 0.08, 0.4), { bone: EN, color: CHROME, pos: [0.125, 0.13, 0], rot: [0, 0, -0.6], mirror: EN, outline: 0.7 });
  b.put(box(0.2, 0.12, 0.3), { bone: EN, color: CHROME, pos: [0, 0.2, 0], outline: 0.7 });
  // Lufthutze: Keil mit dunklem Schlund nach vorn
  const sc = (z: number, hw: number, h: number): Ring => ({
    z,
    p: [hw, 0, hw, h * 0.7, hw * 0.7, h, -hw * 0.7, h, -hw, h * 0.7, -hw, 0],
  });
  b.put(
    loft([sc(-0.16, 0.06, 0.04), sc(-0.02, 0.095, 0.1), sc(0.15, 0.105, 0.12)], {
      flat: true,
      color: (_j, k) => (k === 2 ? CREAM : RED),
      capColor: 0x241f26,
    }),
    {
      bone: EN,
      pos: [0, 0.255, 0],
    },
  );
  if (b.fine)
    for (let i = -1; i <= 1; i++)
      b.put(box(0.016, 0.085, 0.012), { bone: EN, color: CHROME, pos: [i * 0.05, 0.31, 0.152], outline: 0 });
  // Krümmer: drei Stummel je Seite
  for (let i = 0; i < 3; i++) {
    b.put(box(0.055, 0.24, 0.055), {
      bone: EN,
      color: CHROME,
      pos: [0.24, 0.02, -0.17 + i * 0.13],
      aim: [0.75, -0.4, -0.55],
      mirror: EN,
      outline: 0.6,
    });
  }

  // — Auspuff: zwei dicke Rohre aus dem Heckblech —
  b.put(
    sweep(
      [
        [0.25, 0.3, -0.8],
        [0.25, 0.315, -0.96],
        [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]],
      ],
      (t) => 0.058 + 0.03 * t * t,
      b.s(8, 6),
    ),
    {
      bone: CH,
      color: CHROME,
      mirror: CH,
    },
  );
  addPipeHole(c, 0.07);
  addNumber(c, [0, 0.455, -1.01], [-(HALF_PI - 0.1), 0, 0], 0.115, Math.PI);

  addWheels(c, { wall: TIRE, rim: CHROME, rim2: 0xb7c2d2, hub: RED });
  addSteering(c, 0x2b2530, CHROME);
  addDriverBody(c, { rx: 0.275, rz: 0.2, suit: [0x33456e], sleeve: 0x33456e, cuff: 0x9b6238, glove: 0x74472a });

  // — Kopf: Bär mit offener Halbschale —
  const H = B.head;
  const FUR = 0x9b6238;
  const FUR_D = 0x74472a;
  const TAN = 0xf3cf9c;
  const C: V3 = [0, 0.3, 0];
  const R: V3 = [0.33, 0.29, 0.3];
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: FUR, pos: C });
  // Schnauze und Nase
  b.put(sphere(0.165, 0.11, 0.13, b.s(8, 6), b.s(6, 4)), { bone: H, color: TAN, pos: [0, 0.225, 0.26], outline: 0.7 });
  b.put(sphere(0.068, 0.048, 0.045, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.285, 0.38], outline: 0 });
  // dunkler Mundraum hinter dem Kiefer
  if (b.fine) b.put(sphere(0.14, 0.03, 0.11, 6, 3), { bone: H, color: 0x3a1418, pos: [0, 0.165, 0.25], outline: 0 });
  // kräftiger Unterkiefer mit zwei Hauern (klappt beim Jubeln auf)
  const J = B.aux1;
  const js = b.s4(8);
  b.put(
    loft(
      [
        sring(-0.02, -0.035, 0.15, 0.05, 0.06, 3, js),
        sring(0.1, -0.03, 0.185, 0.055, 0.075, 3.4, js),
        sring(0.25, -0.02, 0.17, 0.05, 0.07, 3.4, js),
        sring(0.325, -0.015, 0.11, 0.035, 0.05, 3, js),
      ],
      { capA: false },
    ),
    {
      bone: J,
      color: FUR_D,
      outline: 0.8,
    },
  );
  b.put(cone(0.03, 0.075, 4), { bone: J, color: WHITE, pos: [0.095, 0.015, 0.265], mirror: J, outline: 0.4 });
  // runde Ohren
  b.put(sphere(0.115, 0.115, 0.055, b.s(8, 6), b.s(5, 4)), {
    bone: B.earL,
    color: FUR,
    pos: [0, 0.07, 0],
    mirror: B.earR,
    outline: 0.9,
  });
  if (b.fine)
    b.put(sphere(0.068, 0.068, 0.03, 6, 3), { bone: B.earL, color: TAN, pos: [0, 0.07, 0.04], mirror: B.earR, outline: 0 });
  // Augenbrauen: dicke Tuschebalken, innen tiefer → grimmig, aber gutmütig
  b.put(box(0.15, 0.042, 0.035), {
    bone: H,
    color: INK,
    pos: [0.135, 0.463, 0.24],
    rot: [-0.35, 0.42, 0.33],
    mirror: H,
    outline: 0,
  });
  // Halbschale mit Streifen und Kinnriemen
  addHelmet(b, C, [0.352, 0.312, 0.322], 1.02, -0.3, RED, { stripe: CREAM, stripeHalf: 0.17, rim: 0x2b2530 });
  if (b.fine)
    b.put(box(0.03, 0.2, 0.012), {
      bone: H,
      color: 0x2b2530,
      pos: [0.305, 0.25, 0.085],
      rot: [0.25, 0, -0.16],
      mirror: H,
      outline: 0,
    });
  addEyes(c, { c: C, r: R, phi: 0.41, psi: 0.14, dphi: 0.27, dpsi: 0.3, tilt: 0 });
}

// ───────────────────────────── 1: Vera Vergaser ─────────────────────────────

function buildVera(c: Ctx): void {
  const { b, sp } = c;
  const TURQ = c.p.base;
  const TURQ_D = c.p.dark;
  // Zierweiß am Kart (Bug, Streifen, Flossenkappe, Felgen)
  const TRIM = trim(c, WHITE);
  const CH = B.chassis;

  // — Karosserie: Zigarre mit spitzer Nase und Kopfstütze —
  const S = b.s4(16);
  const rr = (z: number, cy: number, hw: number, ht: number, hb: number): Ring => sring(z, cy, hw, ht, hb, 2.3, S, 0.055);
  const rings = [
    rr(-1.03, 0.47, 0.055, 0.05, 0.05),
    rr(-0.9, 0.46, 0.14, 0.13, 0.11),
    rr(-0.63, 0.44, 0.255, 0.27, 0.19),
    rr(-0.45, 0.42, 0.29, 0.24, 0.21),
    rr(-0.3, 0.41, 0.3, 0.19, 0.21),
    rr(0.1, 0.4, 0.29, 0.19, 0.2),
    rr(0.45, 0.385, 0.225, 0.155, 0.16),
    rr(0.78, 0.365, 0.135, 0.1, 0.1),
    rr(0.97, 0.355, 0.06, 0.05, 0.05),
    rr(1.05, 0.352, 0.024, 0.02, 0.02),
  ];
  b.put(loft(rings, { color: (j, k) => (j >= 7 || k === S / 4 - 1 || k === S / 4 ? TRIM : TURQ) }), { bone: CH });
  b.put(sphere(0.215, 0.03, 0.2, b.s(10, 8), 3), { bone: CH, color: 0x2e2630, pos: [0, 0.598, -0.2], outline: 0 });
  b.put(b.soft(0.34, 0.2, 0.08, 0.03, 8), { bone: CH, color: 0x6a4230, pos: [0, 0.71, -0.46], rot: [-0.25, 0, 0], outline: 0.8 });
  // kleine Windschutzscheibe
  const glass: number[] = [];
  for (let i = 0; i <= 5; i++) glass.push(Math.cos((i / 5) * Math.PI) * 0.19, Math.sin((i / 5) * Math.PI) * 0.13);
  if (b.fine) b.put(prism(glass, 0.02), { bone: CH, color: 0xc6efff, pos: [0, 0.585, 0.13], rot: [-0.5, 0, 0], outline: 0.6 });
  // Heckflosse mit heller Kappe
  b.put(prism([-0.46, 0.6, -1.02, 0.5, -1.04, 0.97, -0.83, 0.97], 0.05), { bone: CH, color: TURQ_D, rot: [0, -HALF_PI, 0] });
  b.put(prism([-0.83, 0.97, -1.04, 0.97, -1.045, 1.07, -0.885, 1.07], 0.05), { bone: CH, color: TRIM, rot: [0, -HALF_PI, 0] });
  addNumber(c, [0.024, 0.8, -0.88], [0, 0, -HALF_PI], 0.115, HALF_PI, true);
  addNumber(c, [-0.024, 0.8, -0.88], [0, 0, HALF_PI], 0.115, -HALF_PI, true);
  if (b.fine) addNumber(c, [0, 0.527, 0.5], [0.13, 0, 0], 0.105, 0);
  // … und eine aufs Heck neben die Flosse: die sieht man aus der Verfolgerkamera
  addNumber(c, [-0.135, 0.612, -0.74], [-0.42, 0, 0.6], 0.088, Math.PI);
  // Achsen und seitliche Auspuffrohre mit Trichter
  addAxle(c, sp.wf, 0.028);
  addAxle(c, sp.wr, 0.028);
  b.put(
    sweep(
      [
        [0.2, 0.33, 0.34],
        [0.32, 0.335, -0.2],
        [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]],
      ],
      (t) => 0.034 + 0.034 * Math.max(0, (t - 0.65) / 0.35),
      b.s(6, 5),
      3,
    ),
    {
      bone: CH,
      color: CHROME,
      mirror: CH,
      outline: 0.8,
    },
  );
  addPipeHole(c, 0.052);

  addWheels(c, { wall: TIRE, rim: TRIM, rim2: TURQ, hub: TURQ_D });
  addSteering(c, 0x4a332a, CHROME);
  addDriverBody(c, { rx: 0.2, rz: 0.15, suit: [0x8a5632], sleeve: 0x8a5632, cuff: 0x8a5632, glove: 0xf4dfb4 });

  // — Schal: Wulst um den Hals, ein breites Ende weht nach hinten —
  const SCARF = 0xfff6e4;
  const wrap = new THREE.TorusGeometry(0.115, 0.052, 4, b.s(9, 8));
  wrap.rotateX(HALF_PI);
  b.put(wrap, { bone: B.torso, color: SCARF, pos: [0, sp.torsoLen - 0.005, 0.01], scale: [1.1, 1, 1] });
  const len = 0.84;
  const strip: Ring[] = [];
  const sn8 = b.fine ? 8 : 4;
  for (let i = sn8; i >= 0; i--) {
    const w = 0.06 + 0.03 * Math.sin((i / sn8) * Math.PI) + (i === sn8 ? 0.012 : 0);
    strip.push({ z: (-i / sn8) * len, p: [w, -0.016, w, 0.016, -w, 0.016, -w, -0.016] });
  }
  const zBase = sp.hip[2] + sp.chain[2];
  b.put(loft(strip, { flat: true, color: (j) => (j === 0 || (b.fine && j === 2) ? TURQ : SCARF) }), {
    bone: B.c0,
    outline: 0.8,
    skin: (_x, _y, z, out) => {
      // Vier Gelenke im Abstand von 0,21 m; an den Gelenken weich überblenden.
      const f = clamp(((zBase - z) / len) * 4, 0, 3.999);
      const i = Math.floor(f);
      const fr = f - i;
      const j = fr < 0.5 ? Math.max(i - 1, 0) : Math.min(i + 1, 3);
      const wj = i === j ? 0 : fr < 0.5 ? 0.5 - fr : fr - 0.5;
      out[0] = B.c0 + i;
      out[1] = 1 - wj;
      out[2] = B.c0 + j;
      out[3] = wj;
    },
  });

  // — Kopf: Füchsin mit Fliegerkappe —
  const H = B.head;
  const ORANGE = 0xf5822a;
  const CREAM = 0xfff3e0;
  const TIP = 0x3b2824;
  const C: V3 = [0, 0.28, 0];
  const R: V3 = [0.29, 0.265, 0.28];
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: ORANGE, pos: C });
  // helle Maske: Wangen und Kinn
  b.put(sphere(0.255, 0.15, 0.235, b.s(9, 8), b.s(5, 4)), { bone: H, color: CREAM, pos: [0, 0.165, 0.045], outline: 0.8 });
  b.put(cone(0.085, 0.21, b.s(6, 5)), {
    bone: H,
    color: CREAM,
    pos: [0.2, 0.15, 0.03],
    aim: [1, -0.3, -0.2],
    scale: [1, 1, 0.55],
    mirror: H,
    outline: 0.8,
  });
  // spitze Schnauze: oben fuchsrot, unten hell
  const SS = b.s4(8);
  const sn = (z: number, hw: number, ht: number, hb: number, cy: number): Ring => sring(z, cy, hw, ht, hb, 2, SS);
  b.put(
    loft(
      [
        sn(0.14, 0.13, 0.095, 0.085, 0.215),
        sn(0.3, 0.095, 0.07, 0.06, 0.205),
        sn(0.42, 0.055, 0.042, 0.04, 0.2),
        sn(0.47, 0.03, 0.024, 0.024, 0.2),
      ],
      { color: (_j, k) => (k < SS / 2 ? ORANGE : CREAM), capA: false },
    ),
    {
      bone: H,
      outline: 0.7,
    },
  );
  b.put(sphere(0.042, 0.036, 0.036, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.213, 0.475], outline: 0 });
  addPointedEars(b, 0.105, 0.3, ORANGE, CREAM, TIP);
  // feine Brauen
  b.put(box(0.1, 0.02, 0.026), {
    bone: H,
    color: INK,
    pos: [0.125, 0.425, 0.228],
    rot: [-0.4, 0.45, -0.22],
    mirror: H,
    outline: 0,
  });
  // Fliegerkappe mit Ohrenklappen
  const CAP_R: V3 = [0.306, 0.281, 0.296];
  addHelmet(b, C, CAP_R, 1.15, -0.38, TURQ, { rim: TURQ_D, gloss: 2.4 });
  b.put(sphere(0.055, 0.13, 0.1, 6, 4), { bone: H, color: TURQ, pos: [0.272, 0.21, -0.03], mirror: H, outline: 0.8 });
  // Fliegerbrille auf der Stirn, Riemen um die Kappe. Sie hängt an einem eigenen
  // Knochen (Drehpunkt Kopfmitte): unter Wasser rutscht sie über die Augen.
  const G = B.dHead;
  const gy = sp.diveHead[1];
  const strap = new THREE.TorusGeometry(0.247, 0.016, 3, b.s(12, 8));
  if (b.fine)
    b.put(strap, { bone: G, color: 0x4a332a, pos: [0, 0.4265 - gy, -0.0525], rot: [-1.876, 0, 0], scale: [1.075, 1, 1], outline: 0 });
  const gx = 0.082;
  const gPos: V3 = [gx, 0.508 - gy, 0.174];
  const gRot: V3 = [0.66, 0.38, 0];
  b.put(cyl(0.066, 0.074, 0.05, b.s(8, 5)), {
    bone: G,
    color: CREAM,
    pos: gPos,
    rot: gRot,
    order: 'YXZ',
    mirror: G,
    outline: 0.55,
  });
  b.put(cyl(0.048, 0.048, 0.058, b.s(8, 5)), {
    bone: G,
    color: 0x2b4a73,
    pos: gPos,
    rot: gRot,
    order: 'YXZ',
    mirror: G,
    outline: 0,
  });
  if (b.fine)
    b.put(sphere(0.018, 0.006, 0.012, 4, 2), {
      bone: G,
      color: WHITE,
      pos: [gx + 0.018, 0.546 - gy, 0.19],
      rot: gRot,
      order: 'YXZ',
      mirror: G,
      outline: 0,
    });
  addEyes(c, { c: C, r: R, phi: 0.43, psi: 0.17, dphi: 0.26, dpsi: 0.27, tilt: 0.2 });
}

// ───────────────────────────── 2: Bremsen-Bert ─────────────────────────────

function buildBert(c: Ctx): void {
  const { b, sp } = c;
  const YEL = c.p.base;
  const YEL_D = c.p.dark;
  const CREAM = 0xfff6e2;
  // heller Wannenrand und Helmstreifen
  const RIM = trim(c, CREAM);
  const STRIPE = trim(c, WHITE);
  const INSIDE = 0x5a4a52;
  const CH = B.chassis;
  const E = 2.7;

  // — Wanne: stehend gespannt (Ringe von unten außen über den Rand nach innen) —
  const S = b.s4(20);
  const zc = -0.02;
  // Im Loft ist „oben“ (ht) das Heck und „unten“ (hb) der Bug.
  const tr = (y: number, hw: number, back: number, front: number): Ring => sring(y, -zc, hw, back, front, E, S);
  const tub = loft(
    [
      tr(0.16, 0.36, 0.68, 0.7),
      tr(0.23, 0.455, 0.83, 0.85),
      tr(0.38, 0.5, 0.9, 0.925),
      tr(0.53, 0.49, 0.9, 0.92),
      tr(0.585, 0.515, 0.93, 0.95),
      tr(0.635, 0.49, 0.905, 0.925),
      tr(0.6, 0.45, 0.865, 0.885),
      tr(0.5, 0.425, 0.84, 0.86),
    ],
    { color: (j) => (j === 0 ? YEL_D : j < 3 ? YEL : j < 6 ? RIM : INSIDE), capColor: INSIDE },
  );
  b.put(tub, { bone: CH, rot: [-HALF_PI, 0, 0] });
  // Rückenlehne
  b.put(b.soft(0.56, 0.3, 0.1, 0.04, 8), { bone: CH, color: 0x7a5a48, pos: [0, 0.66, -0.56], rot: [-0.22, 0, 0], outline: 0.8 });

  // — dicke Stoßstangen vorn und hinten —
  for (const dir of [1, -1]) {
    const pts: V3[] = [];
    const half = dir > 0 ? 0.925 : 0.9;
    for (let i = -2; i <= 2; i++) {
      const a = (i / 2) * 0.95;
      const cx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / E) * 0.58;
      const cz = Math.pow(Math.cos(a), 2 / E) * (half + 0.08);
      pts.push([cx, 0.3, zc + dir * cz]);
    }
    if (dir < 0) pts.reverse();
    b.put(sweep(pts, 0.062, b.s(6, 5), 4), { bone: CH, color: CHROME });
    b.put(box(0.09, 0.19, 0.08), { bone: CH, color: DARK, pos: [0.2, 0.3, zc + dir * (half + 0.085)], mirror: CH, outline: 0.7 });
  }
  // Scheinwerfer auf dem Wannenrand, Rücklichter
  addLamp(c, [0.25, 0.7, 0.74], 0.09);
  if (b.fine)
    b.put(sphere(0.05, 0.05, 0.035, 6, 3), { bone: CH, color: 0xff7a3c, pos: [0.3, 0.57, -0.84], mirror: CH, outline: 0.6 });
  // Auspuffstummel
  b.put(cyl(0.055, 0.048, 0.2, 6), {
    bone: CH,
    color: CHROME,
    pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] + 0.1],
    rot: [HALF_PI - sp.exhaustUp, 0, 0],
    mirror: CH,
    outline: 0.8,
  });
  addPipeHole(c, 0.046);
  addAxle(c, sp.wf, 0.035);
  addAxle(c, sp.wr, 0.035);
  addNumber(c, [0, 0.455, -0.927], [-(HALF_PI - 0.06), 0, 0], 0.12, Math.PI);
  addNumber(c, [0, 0.455, 0.912], [HALF_PI - 0.06, 0, 0], 0.12, 0);

  addWheels(c, { wall: CREAM, rim: YEL, rim2: YEL_D, hub: CHROME });
  addSteering(c, 0x4a332a, CHROME);
  // gestreifter Badeanzug
  const NAVY = 0x2e4372;
  addDriverBody(c, {
    rx: 0.31,
    rz: 0.24,
    suit: [NAVY, NAVY, WHITE, NAVY, WHITE, NAVY, WHITE],
    sleeve: 0x8fa3c2,
    cuff: 0x8fa3c2,
    glove: 0x7389ab,
  });

  // — Kopf: Walross mit Schnauzbart, Stoßzähnen und Schirmhelm —
  const H = B.head;
  const SKIN = 0x8fa3c2;
  const SKIN_D = 0x7389ab;
  const C: V3 = [0, 0.29, 0];
  const R: V3 = [0.35, 0.3, 0.31];
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: SKIN, pos: C });
  // Speckrolle im Nacken
  b.put(sphere(0.28, 0.085, 0.15, b.s(8, 6), 4), { bone: H, color: SKIN_D, pos: [0, 0.07, -0.19], outline: 0.8 });
  // Stoßzähne (hängen am Kopf), Schnauzbart-Polster (eigene Knochen: sie flattern)
  b.put(
    sweep(
      [
        [0.09, 0.14, 0.3],
        [0.1, 0.01, 0.355],
        [0.115, -0.13, 0.375],
      ],
      (t) => 0.046 - 0.03 * t,
      b.s(6, 5),
    ),
    { bone: H, color: 0xfffbe6, mirror: H, outline: 0.7 },
  );
  b.put(sphere(0.16, 0.12, 0.12, b.s(7, 6), b.s(5, 4)), {
    bone: B.aux0,
    color: CREAM,
    pos: [0.035, -0.035, 0.035],
    rot: [0, 0.25, -0.3],
    mirror: B.aux1,
    outline: 0.8,
  });
  b.put(sphere(0.075, 0.05, 0.045, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.262, 0.385], outline: 0 });
  // buschige Brauen
  b.put(sphere(0.075, 0.03, 0.035, 6, 3), {
    bone: H,
    color: CREAM,
    pos: [0.135, 0.468, 0.243],
    rot: [-0.3, 0.4, -0.3],
    mirror: H,
    outline: 0.45,
  });
  // Helm mit Schirm
  const HR: V3 = [0.372, 0.322, 0.332];
  addHelmet(b, C, HR, 0.92, -0.25, YEL, { stripe: STRIPE, stripeHalf: 0.16, rim: YEL_D });
  b.put(sphere(0.215, 0.034, 0.17, b.s(8, 6), 4), {
    bone: H,
    color: YEL_D,
    pos: [0, 0.5, 0.295],
    rot: [0.3, 0, 0],
    outline: 0.8,
  });
  addEyes(c, { c: C, r: R, phi: 0.33, psi: 0.27, dphi: 0.22, dpsi: 0.23, tilt: -0.05 });
}

// ───────────────────────────── 3: Zünd-Zoe ─────────────────────────────

/** Blitz-Zickzack als Vieleck (Höhe etwa 1, Spitze unten). */
const BOLT: readonly number[] = [-0.04, 0.5, 0.24, 0.5, 0.07, 0.08, 0.26, 0.08, -0.16, -0.5, -0.03, -0.04, -0.22, -0.04];

function buildZoe(c: Ctx): void {
  const { b, sp } = c;
  const VIO = c.p.base;
  const VIO_D = c.p.dark;
  const VIO_L = c.p.light;
  const DEEP = c.p.deep;
  const DEEPER = c.p.deeper;
  const ACC = c.p.accent;
  const CH = B.chassis;

  // — Karosserie: kantiger Keil, bewusst mit harten Flächen —
  const wr = (z: number, hw: number, yt: number, yb: number, ch: number, sw: number): Ring => ({
    z,
    p: [
      hw,
      yb + ch,
      hw,
      yt - ch,
      hw - ch,
      yt,
      sw,
      yt,
      -sw,
      yt,
      -hw + ch,
      yt,
      -hw,
      yt - ch,
      -hw,
      yb + ch,
      -hw + ch,
      yb,
      hw - ch,
      yb,
    ],
  });
  b.put(
    loft(
      [
        wr(-1.03, 0.39, 0.6, 0.27, 0.05, 0.1),
        wr(-0.95, 0.43, 0.66, 0.2, 0.06, 0.1),
        wr(-0.45, 0.43, 0.63, 0.16, 0.07, 0.1),
        wr(-0.05, 0.41, 0.57, 0.15, 0.07, 0.1),
        wr(0.55, 0.34, 0.41, 0.15, 0.06, 0.09),
        wr(0.95, 0.24, 0.275, 0.16, 0.04, 0.07),
        wr(1.05, 0.18, 0.225, 0.17, 0.02, 0.05),
      ],
      {
        flat: true,
        color: (_j, k) => (k === 3 ? VIO_D : k === 1 || k === 5 ? VIO_L : VIO),
        capColor: VIO_D,
      },
    ),
    { bone: CH },
  );
  // Frontlippe, Seitenkästen, Sitzmulde, Kopfstütze
  b.put(box(0.6, 0.035, 0.22), { bone: CH, color: DARK, pos: [0, 0.145, 0.97], outline: 0.7 });
  b.put(box(0.1, 0.16, 0.5), { bone: CH, color: VIO_D, pos: [0.43, 0.3, -0.02], rot: [0, 0.06, 0], mirror: CH, outline: 0.8 });
  b.put(sphere(0.24, 0.03, 0.22, b.s(10, 8), 3), { bone: CH, color: DEEPER, pos: [0, 0.604, -0.2], outline: 0 });
  b.put(box(0.36, 0.24, 0.09), { bone: CH, color: DEEP, pos: [0, 0.74, -0.46], rot: [-0.2, 0, 0], outline: 0.8 });
  // Blitz auf der Haube
  b.put(prism(BOLT, 0.016), {
    bone: CH,
    color: ACC,
    pos: [0, 0.502, 0.24],
    rot: [-(HALF_PI - 0.262), 0, 0],
    scale: [0.5, 0.62, 1],
    outline: 0,
  });
  // eckige Auspuffblenden
  b.put(box(0.17, 0.12, 0.1), {
    bone: CH,
    color: CHROME,
    pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] + 0.045],
    mirror: CH,
    outline: 0.7,
  });
  if (b.fine)
    b.put(box(0.12, 0.075, 0.02), {
      bone: CH,
      color: 0x1c1920,
      pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] - 0.008],
      mirror: CH,
      outline: 0,
    });
  addAxle(c, sp.wf, 0.03);
  addNumber(c, [0, 0.666, -0.875], [-0.05, 0, 0], 0.125, Math.PI);
  addNumber(c, [0, 0.3, 0.985], [0.86, 0, 0], 0.085, 0);

  // — Zündkerzen als Antennen (eigene Knochen: sie federn) —
  const plug: LP[] = [
    [0, 0, STEEL],
    [0.068, 0, STEEL, true],
    [0.068, 0.07, WHITE, true],
    [0.042, 0.08, WHITE],
    [0.056, 0.14, WHITE],
    [0.042, 0.17, WHITE],
    [0.034, 0.35, STEEL, true],
    [0.02, 0.36, STEEL],
    [0.02, 0.44, STEEL],
    [0, 0.45],
  ];
  b.put(lathe(plug, 6), { bone: B.aux0, mirror: B.aux1, outline: 0.7 });
  b.put(sphere(0.04, 0.04, 0.04, 6, 4), { bone: B.aux0, color: ACC, pos: [0, 0.475, 0], mirror: B.aux1, outline: 0.55 });

  addWheels(c, { wall: TIRE, rim: VIO_D, rim2: ACC, hub: WHITE });
  addSteering(c, DEEPER, ACC);
  addDriverBody(c, { rx: 0.19, rz: 0.145, suit: [DEEP], sleeve: DEEP, cuff: DEEP, glove: WHITE });

  // — Schwanz: Blitz-Zickzack, schräg gestellt – von hinten und von der Seite zu erkennen —
  const FUR = 0xfaf6ff;
  const tail: number[] = [
    0.0, 0.0, 0.1, 0.0, 0.16, 0.23, 0.035, 0.25, 0.15, 0.5, 0.007, 0.51, 0.11, 0.84, -0.108, 0.46, 0.027, 0.445, -0.1, 0.2, 0.032,
    0.195,
  ];
  const y0 = sp.chain[1];
  b.put(prism(tail, 0.07), {
    bone: B.c0,
    color: FUR,
    pos: [-0.05, -0.04, 0],
    rot: [-0.18, 0.75, 0],
    order: 'YXZ',
    skin: (_x, y, _z, out) => {
      const f = clamp((y - y0) / 0.24, 0, 2.999);
      const i = Math.floor(f);
      const fr = f - i;
      const j = fr < 0.5 ? Math.max(i - 1, 0) : Math.min(i + 1, 2);
      const wj = i === j ? 0 : fr < 0.5 ? 0.5 - fr : fr - 0.5;
      out[0] = B.c0 + i;
      out[1] = 1 - wj;
      out[2] = B.c0 + j;
      out[3] = wj;
    },
  });

  // — Kopf: Katze, die Ohren ragen durch den Helm —
  const H = B.head;
  const PINK = 0xff9ec4;
  const C: V3 = [0, 0.28, 0];
  const R: V3 = [0.31, 0.27, 0.28];
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: FUR, pos: C });
  // Wangenfell
  b.put(cone(0.075, 0.16, b.s(6, 5)), {
    bone: H,
    color: FUR,
    pos: [0.24, 0.17, 0.05],
    aim: [1, -0.22, -0.1],
    scale: [1, 1, 0.55],
    mirror: H,
    outline: 0.8,
  });
  // Schnäuzchen, Nase, Mund
  b.put(sphere(0.062, 0.05, 0.05, 6, 4), { bone: H, color: WHITE, pos: [0.047, 0.165, 0.262], mirror: H, outline: 0.5 });
  b.put(sphere(0.028, 0.02, 0.02, 5, 3), { bone: H, color: PINK, pos: [0, 0.2, 0.305], outline: 0 });
  if (b.fine) b.put(sphere(0.035, 0.022, 0.02, 5, 3), { bone: H, color: 0x7a3550, pos: [0, 0.133, 0.262], outline: 0 });
  // Schnurrhaare als Tuschestriche
  if (b.fine) {
    for (const dy of [0.025, -0.02]) {
      b.put(box(0.17, 0.009, 0.009), {
        bone: H,
        color: INK,
        pos: [0.19, 0.165 + dy, 0.245],
        rot: [0, 0.5, dy * 9],
        mirror: H,
        outline: 0,
      });
    }
  }
  addPointedEars(b, 0.1, 0.24, FUR, PINK, null);
  // Helm mit Blitz am Hinterkopf
  const HR: V3 = [0.333, 0.292, 0.302];
  addHelmet(b, C, HR, 1.12, -0.32, VIO, { rim: VIO_D, gloss: 2.4 });
  b.put(prism(BOLT, 0.014), {
    bone: H,
    color: ACC,
    pos: [0, 0.37, -0.287],
    rot: [0.3, Math.PI, 0],
    scale: [0.4, 0.3, 1],
    outline: 0,
  });
  addEyes(c, { c: C, r: R, phi: 0.4, psi: 0.1, dphi: 0.3, dpsi: 0.36, tilt: 0.06 });
}

const BUILDERS = [buildKalle, buildVera, buildBert, buildZoe];

// ───────────────────────────── Roboter ─────────────────────────────
//
// Das Item „Roboter“: Das Kart federt ein und springt hoch, ganz hinten unter dem Heck klappt ein Becken heraus, daran Beine
// mit Hüft-, Knie- und Sprunggelenk, Fuß und Zehen; die Hinterräder sitzen danach außen auf den Kniegelenken (die Nabe ist
// die Achse), die Vorderräder wandern als Schulterpanzer an die Schultern, aus denen Arme mit Ellbogen und Fäusten klappen.
// Die Karosserie steht schräg als Oberkörper über dem Becken, der Fahrer richtet sich im Sitz auf und gleicht die Neigung
// aus – er ist der Kopf. Dann rennt der Roboter wie ein Sprinter: Ferse aufsetzen, abrollen, über den Ballen abdrücken,
// Flugphase, das Schwungbein mit stark gebeugtem Knie nach vorn; die Arme schwingen gegengleich mit angewinkelten Ellbogen,
// Becken und Oberkörper verdrehen sich gegeneinander. Der fünfte Fußaufsatz ist der Absprung: tief in die Knie, explosiv
// strecken, Arme hochreißen – im Sprung klappt alles der Reihe nach wieder ein.
//
// Die Gliedmaßen stecken im Zusatz-Netz (nur sichtbar, solange gebraucht) und hängen an Knochenketten: Becken →
// Oberschenkel (Hüfte, Kugelgelenk) → Unterschenkel (Knie, Scharnier) → Fuß (Sprunggelenk) → Zehen (Ballen) und Oberarm
// (Schulter, Kugelgelenk) → Unterarm (Ellbogen, Scharnier) → Faust (Handgelenk). Eingeklappt sind sie geschrumpft und
// angelegt. Knochen-Koordinaten in Ruhe: Bein und Arm hängen senkrecht nach unten (−y), +z nach vorn, links bei +x (rechts
// gespiegelt); das Becken steht aufrecht, sein Ursprung liegt mitten zwischen den Hüftgelenken.

/** Bein (m): Oberschenkel, Unterschenkel, Sprunggelenk über der Sohle, Ferse dahinter, Ballen davor, Zehen. */
const ROBOT_THIGH = 0.66;
const ROBOT_SHIN = 0.66;
const ROBOT_ANKLE = 0.15;
const ROBOT_HEEL = 0.11;
const ROBOT_BALL = 0.22;
const ROBOT_TOE = 0.14;
/** Halber Abstand der Hüftgelenke. */
const ROBOT_HIP_X = 0.37;
/** Arm (m): Oberarm, Unterarm (Ellbogen bis Handgelenk). */
const ROBOT_UPPER = 0.42;
const ROBOT_FORE = 0.4;
/** Laufhaltung: Höhe des Beckens, Neigung der Karosserie (rad, Nase hoch), Becken vor der Mitte des Karts. */
const ROBOT_HIP_Y = ROBOT_THIGH + ROBOT_SHIN + ROBOT_ANKLE - 0.1;
const ROBOT_PITCH = 0.72;
const ROBOT_FWD = -0.08;
/** So weit richtet sich der Fahrer je Figur im Sitz auf (m) – Bert sitzt tief in seiner Wanne. */
const ROBOT_RISE = [0.15, 0.12, 0.3, 0.12];
/**
 * Zeitplan (Sekunden seit dem Auslösen, wie im Spiel: ROBOT_LEAP_AT / 60 = 0,9). Die Schritte kommen in festem Takt: der
 * erste Fuß setzt bei ROBOT_TD0 auf, alle ROBOT_STEP der nächste, abwechselnd links und rechts – der fünfte (links) ist der
 * Absprung. So viel Weg legt ein aufgesetzter Fuß höchstens unter dem Roboter zurück (von der Ferse bis zum Abdruck).
 */
const ROBOT_T_LEAP = 0.9;
const ROBOT_STEP = 0.156;
const ROBOT_TD0 = ROBOT_T_LEAP - 0.045 - 4 * ROBOT_STEP;
const ROBOT_GROUND = 1.2;
/** Laufphase (Anteil am Doppelschritt nach dem linken Fußaufsatz), bei der der linke Arm am weitesten vorn ist. */
const ROBOT_ARM_PHASE = 0.1;

/** Becken (Mitte zwischen den Hüftgelenken) im Raum der Karosserie: ganz hinten unter dem Heck – darüber steht der Oberkörper. */
function robotPelvis(sp: Spec): V3 {
  return [0, 0.16, sp.wr.z - 0.28];
}

/** Schultergelenk (links) im Raum der Karosserie: oben an der Seite neben dem Fahrer. */
function robotShoulder(sp: Spec): V3 {
  return [sp.wf.x - 0.12, 0.44, sp.hip[2] + 0.3];
}

/** Vorderrad als Schulterpanzer: Maßstab. */
const ROBOT_SHOULDER_WHEEL = 0.85;

/** Hinterrad am Knie: Maßstab und Abstand seiner Mitte von der Mitte des Kniegelenks (außen) – die Nabe ist die Achse. */
const ROBOT_KNEE_WHEEL = 0.6;
function robotKneeWheel(sp: Spec): number {
  return 0.125 + sp.wr.w * 0.5 * ROBOT_KNEE_WHEEL;
}

/** Querschnitt für loft(): Rechteck (halbe Breite, halbe Höhe) mit Fasen c an den Ecken, gegen den Uhrzeigersinn. */
function chamRing(z: number, hw: number, hh: number, c: number): Ring {
  if (c <= 0) return { z, p: [hw, -hh, hw, hh, -hw, hh, -hw, -hh] };
  return { z, p: [hw, -hh + c, hw, hh - c, hw - c, hh, -hw + c, hh, -hw, hh - c, -hw, -hh + c, -hw + c, -hh, hw - c, -hh] };
}

/**
 * Panzerteil eines Glieds: kantiger Block von y = 0 abwärts bis y = −len, oben w0 × d0, unten w1 × d1 (Breite x, Tiefe z),
 * die Längskanten gefast (c), flach schattiert wie gekantetes Blech. Ohne Feinheiten ein schlichter, verjüngter Quader.
 */
function plate(w0: number, d0: number, w1: number, d1: number, len: number, c: number, fine: boolean): THREE.BufferGeometry {
  const f = fine ? Math.min(c, w1 * 0.3, d1 * 0.3) : 0;
  const g = loft([chamRing(0, w0 / 2, d0 / 2, f), chamRing(len, w1 / 2, d1 / 2, f)], { flat: true });
  g.rotateX(HALF_PI);
  return g;
}

/** Scharnier quer zur Bewegung: Achse entlang x (Länge len, Radius r), mit Feinheiten verchromte Bolzenköpfe an den Enden. */
function robotHinge(b: Builder, bone: number, mirror: number, at: V3, r: number, len: number, color: number): void {
  b.put(cyl(r, r, len, b.s(8, 6)), { bone, color, pos: at, rot: [0, 0, HALF_PI], mirror, outline: 0.7 });
  if (!b.fine) return;
  for (const s of [1, -1]) {
    b.put(cyl(r * 0.52, r * 0.6, 0.035, 6), { bone, color: CHROME, pos: [at[0] + s * (len / 2 + 0.012), at[1], at[2]], rot: [0, 0, HALF_PI], mirror, outline: 0.45 });
  }
}

/**
 * Hydraulikschlauch über ein Gelenk: oben am Elternknochen, unten am Kind festgemacht, dazwischen weich verteilt – so biegt
 * und staucht er sich mit, wenn das Gelenk einknickt. Pfad im Raum des Elternknochens (Ruhelage), y0/y1: Bereich der
 * Überblendung (im Raum der Karosserie).
 */
function robotHose(b: Builder, path: readonly V3[], parent: number, child: number, parentR: number, childR: number, y0: number, y1: number): void {
  b.put(sweep(path, 0.024, 5, 6), {
    bone: parent,
    color: DARK,
    mirror: parentR,
    outline: 0.4,
    skin: (x, y, _z, out) => {
      const w = smooth01((y0 - y) / (y0 - y1));
      const left = x >= 0;
      out[0] = left ? parent : parentR;
      out[1] = 1 - w;
      out[2] = left ? child : childR;
      out[3] = w;
    },
  });
}

/**
 * Gliedmaßen des Roboters: Lack für die Panzerplatten (Grundton, dunkel, hell, Akzent an Kniescheibe und Gürtelschnalle),
 * Stahl und Chrom für Kugelgelenke, Scharnierachsen, Bolzen und Kolben, Gummi für die Sohlen. Die Arme sind dunkler als die
 * Karosserie, vor der sie schwingen.
 */
function buildRobot(c: Ctx): void {
  const b = c.b;
  const P = c.p;
  const sp = c.sp;
  const fine = b.fine;
  const n = b.s(8, 6);
  const PV = B.rPelvis;
  const TH = B.rThighL;
  const SH = B.rShinL;
  const FT = B.rFootL;
  const TO = B.rToeL;
  const AR = B.rArmL;
  const FO = B.rForeL;
  const HA = B.rHandL;
  const RT = B.rThighR;
  const RS = B.rShinR;
  const RF = B.rFootR;
  const RO = B.rToeR;
  const RA = B.rArmR;
  const RFo = B.rForeR;
  const RH = B.rHandR;

  // Becken: Gürtel im Lack mit Schnalle, darunter der dunkle Kern, vorn eine Stahlplatte, seitlich die Lagerschalen der
  // Hüftgelenke.
  const hx = ROBOT_HIP_X;
  b.put(plate(2 * hx + 0.1, 0.36, 2 * hx + 0.1, 0.36, 0.11, 0.035, fine), { bone: PV, color: P.base, pos: [0, 0.17, 0] });
  b.put(plate(2 * hx - 0.04, 0.32, 0.34, 0.26, 0.26, 0.05, fine), { bone: PV, color: P.dark, pos: [0, 0.07, -0.01] });
  b.put(plate(0.17, 0.08, 0.11, 0.06, 0.2, 0.025, fine), { bone: PV, color: STEEL, pos: [0, 0.02, 0.15], rot: [0.12, 0, 0], outline: 0.6 });
  b.put(box(0.13, 0.085, 0.05), { bone: PV, color: P.accent, pos: [0, 0.115, 0.185], outline: 0.5 });
  b.put(cyl(0.12, 0.12, 0.09, n), { bone: PV, color: DARK, pos: [hx - 0.13, 0, 0], rot: [0, 0, HALF_PI], mirror: PV, outline: 0.6 });

  // Oberschenkel: Kugelgelenk, Panzer im Lack mit heller Platte vorn und dunkler Seitenplatte, hinten ein Hydraulikzylinder
  b.put(sphere(0.125, 0.125, 0.125, n, 4), { bone: TH, color: STEEL, mirror: RT, outline: 0.7 });
  b.put(plate(0.3, 0.31, 0.24, 0.25, 0.48, 0.055, fine), { bone: TH, color: P.base, pos: [0, -0.07, 0], mirror: RT });
  if (fine) {
    b.put(plate(0.18, 0.05, 0.14, 0.045, 0.32, 0.018, fine), { bone: TH, color: P.light, pos: [0, -0.15, 0.155], rot: [-0.06, 0, 0], mirror: RT, outline: 0.5 });
    b.put(box(0.04, 0.3, 0.17), { bone: TH, color: P.dark, pos: [0.14, -0.3, 0], mirror: RT, outline: 0 });
    b.put(cyl(0.045, 0.045, 0.26, 6), { bone: TH, color: STEEL, pos: [0, -0.32, -0.145], mirror: RT, outline: 0.5 });
  }

  // Knie: Scharnierachse mit Bolzen (das Hinterrad sitzt außen darauf), Kniescheibe im Akzentton (dreht mit dem Unterschenkel)
  robotHinge(b, SH, RS, [0, 0, 0], 0.09, 0.27, DARK);
  b.put(plate(0.2, 0.07, 0.16, 0.06, 0.18, 0.025, fine), { bone: SH, color: P.accent, pos: [0, 0.07, 0.125], rot: [-0.18, 0, 0], mirror: RS, outline: 0.6 });

  // Unterschenkel: dunkler Kern, Schienbeinplatte im Lack, Wade, unten der Ring über dem Sprunggelenk
  b.put(plate(0.26, 0.27, 0.2, 0.22, 0.5, 0.05, fine), { bone: SH, color: P.dark, pos: [0, -0.08, -0.005], mirror: RS });
  b.put(plate(0.18, 0.05, 0.13, 0.04, 0.42, 0.016, fine), { bone: SH, color: P.base, pos: [0, -0.12, 0.135], rot: [0.05, 0, 0], mirror: RS, outline: 0.5 });
  if (fine) b.put(plate(0.18, 0.09, 0.13, 0.06, 0.28, 0.02, fine), { bone: SH, color: P.deep, pos: [0, -0.14, -0.145], rot: [-0.08, 0, 0], mirror: RS, outline: 0.4 });
  b.put(cyl(0.105, 0.105, 0.06, n), { bone: SH, color: STEEL, pos: [0, -ROBOT_SHIN + 0.09, 0], mirror: RS, outline: 0.5 });
  // Schlauch hinter dem Knie: vom Zylinder am Oberschenkel zur Wade (nur auf der höchsten Stufe, ebenso am Ellbogen)
  if (b.detail > 1) {
    const ky = robotPelvis(sp)[1] - ROBOT_THIGH;
    robotHose(b, [[0, -0.45, -0.145], [0, -0.62, -0.18], [0, -0.8, -0.17], [0, -0.9, -0.14]], TH, SH, RT, RS, ky + 0.12, ky - 0.16);
  }

  // Sprunggelenk und Fuß: Achse mit Bolzen, Fußblock (dunkel, oben eine Lackplatte), Gummisohle, Ferse aus Stahl
  robotHinge(b, FT, RF, [0, 0, 0], 0.07, 0.23, STEEL);
  const fl = ROBOT_HEEL + ROBOT_BALL;
  const fz = (ROBOT_BALL - ROBOT_HEEL) / 2;
  b.put(plate(0.24, 0.11, 0.23, 0.08, fl, 0.03, fine), { bone: FT, color: P.dark, pos: [0, -ROBOT_ANKLE + 0.095, -ROBOT_HEEL], rot: [-HALF_PI, 0, 0], mirror: RF });
  b.put(box(0.25, 0.04, fl + 0.02), { bone: FT, color: DARK, pos: [0, -ROBOT_ANKLE + 0.02, fz], mirror: RF, outline: 0.6 });
  if (fine) {
    b.put(plate(0.18, 0.045, 0.2, 0.04, 0.22, 0.015, fine), { bone: FT, color: P.base, pos: [0, -0.02, 0], rot: [-HALF_PI + 0.55, 0, 0], mirror: RF, outline: 0.5 });
    b.put(box(0.18, 0.07, 0.05), { bone: FT, color: STEEL, pos: [0, -ROBOT_ANKLE + 0.075, -ROBOT_HEEL - 0.005], mirror: RF, outline: 0.5 });
  }
  // Zehen: Kappe im Lack mit Gummisohle
  b.put(plate(0.23, 0.075, 0.2, 0.05, ROBOT_TOE, 0.02, fine), { bone: TO, color: P.base, pos: [0, 0.0225, 0], rot: [-HALF_PI, 0, 0], mirror: RO });
  if (fine) b.put(box(0.23, 0.035, ROBOT_TOE), { bone: TO, color: DARK, pos: [0, -0.0325, ROBOT_TOE / 2], mirror: RO, outline: 0.6 });

  // Oberarm: Kugelgelenk, Panzer in Dunkellack, außen eine helle Platte, vorn ein Kolben
  b.put(sphere(0.11, 0.11, 0.11, n, 4), { bone: AR, color: STEEL, mirror: RA, outline: 0.7 });
  b.put(plate(0.2, 0.21, 0.17, 0.18, 0.28, 0.04, fine), { bone: AR, color: P.dark, pos: [0, -0.07, 0], mirror: RA });
  if (fine) {
    b.put(box(0.035, 0.2, 0.14), { bone: AR, color: P.light, pos: [0.1, -0.2, 0], mirror: RA, outline: 0.4 });
    b.put(cyl(0.03, 0.03, 0.2, 6), { bone: AR, color: CHROME, pos: [0, -0.22, 0.11], mirror: RA, outline: 0.45 });
  }

  // Ellbogen: Scharnier mit Bolzen, hinten ein Ellbogenschutz
  robotHinge(b, FO, RFo, [0, 0, 0], 0.075, 0.22, DARK);
  b.put(plate(0.15, 0.06, 0.11, 0.05, 0.13, 0.02, fine), { bone: FO, color: P.base, pos: [0, 0.06, -0.095], rot: [0.25, 0, 0], mirror: RFo, outline: 0.6 });

  // Unterarm: Stulpe aus Stahl, zum Handgelenk hin breiter, außen eine Lackplatte
  b.put(plate(0.17, 0.19, 0.21, 0.22, 0.3, 0.045, fine), { bone: FO, color: STEEL, pos: [0, -0.06, 0], mirror: RFo });
  b.put(box(0.04, 0.22, 0.15), { bone: FO, color: P.base, pos: [0.11, -0.22, 0], mirror: RFo, outline: 0.4 });
  if (b.detail > 1) robotHose(b, [[0, -0.24, 0.11], [0, -0.38, 0.14], [0, -0.52, 0.125]], AR, FO, RA, RFo, robotShoulder(sp)[1] - ROBOT_UPPER + 0.1, robotShoulder(sp)[1] - ROBOT_UPPER - 0.1);

  // Handgelenk und Faust: Stahlgelenk, Faust aus Gummi-Dunkel mit Knöchelplatte im Lack, Fingerglieder, Daumen innen
  b.put(cyl(0.065, 0.065, 0.16, n), { bone: HA, color: STEEL, rot: [0, 0, HALF_PI], mirror: RH, outline: 0.5 });
  b.put(plate(0.2, 0.18, 0.19, 0.18, 0.18, 0.035, fine), { bone: HA, color: DARK, pos: [0, -0.04, 0.01], mirror: RH });
  b.put(box(0.2, 0.11, 0.05), { bone: HA, color: P.base, pos: [0, -0.115, 0.105], mirror: RH, outline: 0.5 });
  if (fine) {
    for (const x of [-0.065, 0, 0.065]) b.put(box(0.05, 0.05, 0.04), { bone: HA, color: P.deep, pos: [x, -0.19, 0.075], mirror: RH, outline: 0 });
    b.put(box(0.06, 0.11, 0.08), { bone: HA, color: DARK, pos: [-0.115, -0.1, 0.05], rot: [0, 0, -0.2], mirror: RH, outline: 0.5 });
  }
}

// Bewegung des Roboters (moveRobot): Anteile beim Aus- und Einklappen je Teil, in dieser Reihenfolge.
const RK_BODY = 0; // Karosserie hebt sich und richtet sich auf
const RK_PELVIS = 1;
const RK_THIGH = 2;
const RK_SHIN = 3;
const RK_FOOT = 4;
const RK_REAR = 5; // Hinterräder an die Knie
const RK_FRONT = 6; // Vorderräder an die Schultern
const RK_UPPER = 7;
const RK_FORE = 8;
const RK_HAND = 9;
const RK_COUNT = 10;

/**
 * Schwungbein: Stützstellen der Bahn des Sprunggelenks relativ zur Hüfte (Anteil am Schwung, vor/zurück und Höhe in
 * Beinlängen, Neigung des Fußes in rad, + = Zehen runter): Ferse hoch zum Gesäß, unter der Hüfte durch, Knie hoch,
 * Unterschenkel nach vorn gestreckt – dazwischen weich, Anfang (Abheben) und Ende (Fersenaufsatz) rechnet moveRobot.
 */
// prettier-ignore
const SWING_KEYS = [
  0.1, -0.5, -0.6, 1.1,
  0.27, -0.36, -0.3, 1.4,
  0.46, -0.02, -0.31, 0.8,
  0.66, 0.33, -0.48, -0.05,
  0.85, 0.45, -0.74, -0.22,
];
/** Zahl der Stützstellen samt Abheben und Fersenaufsatz. */
const SWING_N = SWING_KEYS.length / 4 + 2;
/** Wo der Schwung beginnt, solange noch kein Fuß abgehoben hat (je Bein: vor/zurück, Höhe relativ zur Hüfte). */
const ROBOT_OFF0 = [-0.5, 0.25 - ROBOT_HIP_Y, -0.5, 0.25 - ROBOT_HIP_Y];

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Q_ID = new THREE.Quaternion();
/** Eingeklappt: Oberschenkel nach hinten unter den Boden, Unterschenkel ganz eingeknickt, Fuß angelegt; Arme an der Seite. */
const R_FOLD_THIGH = new THREE.Quaternion().setFromAxisAngle(X_AXIS, 1.45);
const R_FOLD_SHIN = new THREE.Quaternion().setFromAxisAngle(X_AXIS, 2.7);
const R_FOLD_FOOT = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -0.9);
const R_FOLD_ARM = new THREE.Quaternion().setFromAxisAngle(X_AXIS, 1.5);
const R_FOLD_FORE = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -2.6);
const R_FOLD_HAND = new THREE.Quaternion().setFromAxisAngle(X_AXIS, -0.8);

/** Größe eines Glieds beim Ausklappen: wächst in der ersten Hälfte heraus, rastet mit dem Überschwinger ein. */
function robotGrow(k: number): number {
  if (k <= 0) return 1e-4;
  return Math.max(1e-4, k >= 1 ? 1 + (k - 1) * 0.6 : smooth01(k / 0.45));
}

/** Maßstab eines Knochens, damit sein Glied die Größe g hat, obwohl der Elternknochen gp groß ist. */
function robotRatio(g: number, gp: number): number {
  return Math.min(g / Math.max(gp, 1e-4), 60);
}

/** Fersenaufsatz vor der Hüfte (m), damit ein Fuß, der so weit unter dem Roboter durchwandert, um die Mitte abrollt. */
function robotHeelAhead(travel: number): number {
  return -0.1 - ROBOT_HEEL - (ROBOT_BALL - 0.06) / 2 + travel / 2;
}

/** Weiche Kurve durch Stützstellen: x ab buf[xo], y ab buf[yo], je n Werte (x aufsteigend); Tangenten aus den Nachbarn. */
function spline(buf: ArrayLike<number>, xo: number, yo: number, n: number, s: number): number {
  let i = 0;
  while (i < n - 2 && s > buf[xo + i + 1]) i++;
  const x0 = buf[xo + i];
  const x1 = buf[xo + i + 1];
  const h = x1 - x0 || 1;
  const t = clamp((s - x0) / h, 0, 1);
  const y0 = buf[yo + i];
  const y1 = buf[yo + i + 1];
  const m0 = i > 0 ? ((y1 - buf[yo + i - 1]) / (x1 - buf[xo + i - 1])) * h : y1 - y0;
  const m1 = i < n - 2 ? ((buf[yo + i + 2] - y0) / (buf[xo + i + 2] - x0)) * h : y1 - y0;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

const _bm = new THREE.Matrix4();
const _by = new THREE.Vector3();
const _bz = new THREE.Vector3();

/** Drehung eines Glieds: x = Achse des Scharniers, das Glied zeigt in Richtung down (−y des Knochens). */
function robotBasis(x: THREE.Vector3, down: THREE.Vector3, out: THREE.Quaternion): void {
  _by.copy(down).negate();
  _bz.crossVectors(x, _by);
  _bm.makeBasis(x, _by, _bz);
  out.setFromRotationMatrix(_bm);
}

// ───────────────────────────── Kleber ─────────────────────────────
//
// Die Klebepistole steckt hinten im Kart (eigener Knochen, eingeklappt auf null geschrumpft): Sie klappt am Scharnier hoch,
// schwenkt aufs Ziel, zieht zusammen, schießt und klappt wieder ein. Der Kleber, der einen trifft, klebt als Klecks auf
// Gesicht und Haube (zwei Knochen), mit Laufnasen.
//
// Pistole: Scharnier im Ursprung, der Lauf zeigt nach −z (nach hinten), Griff unten.

/** Scharnier der Klebepistole im Raum der Karosserie, je Figur (hinten rechts über dem Heck – neben dem Fahrer zu sehen). */
const GUN_AT: readonly V3[] = [
  [-0.3, 0.56, -0.9],
  [-0.3, 0.54, -0.86],
  [-0.32, 0.56, -0.95],
  [-0.3, 0.5, -0.8],
];
/** Größe der Pistole und Mündung der Düse im Raum der Pistole. */
const GUN_K = 1.45;
const GUN_MUZZLE: V3 = [0, 0.4 * GUN_K, -0.56 * GUN_K];
/** Zeitplan der Pistole (Sekunden seit dem Auslösen, wie im Spiel: GLUE_FIRE / 60): Schuss, Beginn des Einklappens. */
const GUN_FIRE_AT = 0.45;
const GUN_BACK_AT = 0.95;
/** Kleber: Rahmweiß, mit hellen Glanzpunkten. */
const GLUE = 0xfff1c2;
const GLUE_SHINE = 0xfffdf4;

function buildGlueGun(c: Ctx): void {
  const b = c.b;
  const G = B.gun;
  const n = b.s(12, 8);
  const k = GUN_K;
  const BODY = c.p.accent;
  const Y = 0.13 * k;
  const at = (x: number, y: number, z: number): V3 => [x * k, Y + y * k, z * k];
  // Scharnier und Stiel
  b.put(box(0.16 * k, 0.07 * k, 0.16 * k), { bone: G, color: DARK, pos: [0, 0.035 * k, 0], outline: 0.6 });
  b.put(cyl(0.035 * k, 0.035 * k, Y + 0.16 * k, 8), { bone: G, color: STEEL, pos: [0, (Y + 0.16 * k) / 2, 0], outline: 0.5 });
  // Gehäuse mit Griff und Abzug
  b.put(b.soft(0.2 * k, 0.19 * k, 0.36 * k, 0.06 * k, 5), { bone: G, color: BODY, pos: at(0, 0.27, -0.02) });
  b.put(box(0.08 * k, 0.17 * k, 0.09 * k), { bone: G, color: DARK, pos: at(0, 0.16, 0.08), rot: [0.35, 0, 0], outline: 0.6 });
  b.put(box(0.03 * k, 0.07 * k, 0.03 * k), { bone: G, color: CHROME, pos: at(0, 0.16, -0.01), rot: [0.5, 0, 0], outline: 0.4 });
  // Lauf und Düse (Messing), vorn hängt ein Rest Kleber
  b.put(cyl(0.046 * k, 0.05 * k, 0.2 * k, n), { bone: G, color: STEEL, pos: at(0, 0.27, -0.3), rot: [HALF_PI, 0, 0], outline: 0.6 });
  b.put(cone(0.06 * k, 0.12 * k, n), { bone: G, color: 0xffc23a, pos: at(0, 0.27, -0.42), rot: [-HALF_PI, 0, 0], outline: 0.6 });
  b.put(sphere(0.045 * k, 0.06 * k, 0.045 * k, 8, 6), { bone: G, color: GLUE, pos: at(0, 0.235, -0.53), outline: 0.5 });
  // Kleberstange steckt hinten heraus, dazu ein Farbring
  b.put(cyl(0.052 * k, 0.052 * k, 0.2 * k, n), { bone: G, color: GLUE, pos: at(0, 0.29, 0.22), rot: [HALF_PI, 0, 0], outline: 0.6 });
  b.put(cyl(0.062 * k, 0.062 * k, 0.035 * k, n), { bone: G, color: c.p.dark, pos: at(0, 0.29, 0.15), rot: [HALF_PI, 0, 0], outline: 0.5 });
  if (b.fine) {
    // Glanzstreifen auf dem Gehäuse
    b.put(box(0.022 * k, 0.03 * k, 0.26 * k), { bone: G, color: WHITE, pos: at(0.075, 0.33, -0.03), outline: 0 });
  }
}

/** Ein Klecks Kleber: flacher Batzen aus Beulen, darunter Laufnasen mit dicken Tropfen. size = Durchmesser des Batzens. */
function glueSplat(b: Builder, bone: number, size: number, front: V3, drips: readonly number[]): void {
  const r = size / 2;
  const n = b.s(10, 6);
  b.put(sphere(r, r * 0.85, r * 0.42, n, n >> 1), { bone, color: GLUE, outline: 0.75 });
  const lumps: readonly V3[] = [
    [0.62, 0.32, 0.46],
    [-0.58, 0.18, 0.5],
    [0.18, -0.55, 0.42],
    [-0.3, 0.6, 0.4],
  ];
  for (const [x, y, k] of lumps) b.put(sphere(r * k, r * k, r * k * 0.7, n, n >> 1), { bone, color: GLUE, pos: [x * r, y * r, 0], outline: 0.75 });
  for (let i = 0; i < drips.length; i++) {
    const x = drips[i] * r;
    const len = r * (0.55 + 0.35 * ((i * 7) % 3));
    b.put(cyl(r * 0.13, r * 0.16, len, 6), { bone, color: GLUE, pos: [x, -r * 0.55 - len / 2, r * 0.05], outline: 0.6 });
    b.put(sphere(r * 0.2, r * 0.24, r * 0.2, 7, 5), { bone, color: GLUE, pos: [x, -r * 0.55 - len, r * 0.05], outline: 0.6 });
  }
  if (b.fine) {
    b.put(sphere(r * 0.2, r * 0.13, r * 0.05, 6, 4), { bone, color: GLUE_SHINE, pos: [front[0] - r * 0.3, front[1] + r * 0.35, front[2] + r * 0.38], outline: 0 });
    b.put(sphere(r * 0.08, r * 0.08, r * 0.04, 5, 3), { bone, color: GLUE_SHINE, pos: [front[0] + r * 0.1, front[1] + r * 0.5, front[2] + r * 0.36], outline: 0 });
  }
}

/** Höhe der Kleberkappe über dem Klecks im Gesicht und wie weit sie nach hinten reicht, je Figur (Kopfgröße, Helm, Ohren). */
const GLUE_CAP: readonly V3[] = [
  [0, 0.26, -0.33],
  [0, 0.21, -0.38],
  [0, 0.27, -0.32],
  [0, 0.25, -0.26],
];

/** Kleber auf Gesicht (über den Augen) samt Kappe über den Kopf (von hinten zu sehen) und auf der Haube. */
function buildGlueSplats(c: Ctx): void {
  const b = c.b;
  glueSplat(b, B.glueHead, 0.36, [0, 0, 0], [-0.55, 0.7]);
  // Über den Kopf geschwappt: eine flache Kappe, an der es hinten und seitlich herunterläuft.
  const cap = GLUE_CAP[c.sp === SPECS[0] ? 0 : c.sp === SPECS[1] ? 1 : c.sp === SPECS[2] ? 2 : 3];
  const n = b.s(10, 6);
  b.put(sphere(0.25, 0.085, 0.26, n, n >> 1), { bone: B.glueHead, color: GLUE, pos: cap, outline: 0.75 });
  b.put(sphere(0.12, 0.07, 0.12, n, n >> 1), { bone: B.glueHead, color: GLUE, pos: [cap[0] + 0.1, cap[1] + 0.04, cap[2] - 0.05], outline: 0.75 });
  if (b.fine) b.put(sphere(0.06, 0.02, 0.04, 6, 4), { bone: B.glueHead, color: GLUE_SHINE, pos: [cap[0] - 0.08, cap[1] + 0.075, cap[2] + 0.02], outline: 0 });
  for (const [x, len] of [
    [0.17, 0.16],
    [-0.06, 0.24],
    [-0.2, 0.11],
  ] as const) {
    const z = cap[2] - 0.2;
    b.put(cyl(0.025, 0.03, len, 6), { bone: B.glueHead, color: GLUE, pos: [x, cap[1] - len / 2, z], outline: 0.6 });
    b.put(sphere(0.038, 0.045, 0.038, 7, 5), { bone: B.glueHead, color: GLUE, pos: [x, cap[1] - len, z], outline: 0.6 });
  }
  glueSplat(b, B.glueBody, 0.4, [0, 0, 0], [-0.7, 0.1, 0.8]);
}

// ───────────────────────────── Gleitflügel ─────────────────────────────
//
// Über Flugstrecken klappt jedes Kart Flügel aus. Sie stecken im selben Netz
// wie das Kart (kein zusätzlicher Zeichenaufruf) und hängen an eigenen
// Knochen: Gelenk links/rechts an der Karosserie, daran das federnde
// Außenteil, dazu ein Knochen fürs Leitwerk. Eingeklappt sind diese Knochen
// auf null geschrumpft – dann ist nichts zu sehen.
//
// Flügel-Koordinaten (Knochen wingL): +x nach außen, +z nach vorn, y oben.
// Der rechte Flügel ist gespiegelt.

/** Flügelgrundriss: Punkte (x, z) in der Ebene y = 0, Dicke entlang y. */
function plan(pts: readonly number[], depth: number): THREE.BufferGeometry {
  const poly: number[] = [];
  for (let i = 0; i < pts.length; i += 2) poly.push(pts[i], -pts[i + 1]);
  const g = prism(poly, depth);
  g.rotateX(-HALF_PI);
  return g;
}

/** Kalle: Doppeldecker-Stummel mit Chromstreben, hinten ein Höhenruder auf zwei Stelzen. */
function wingsKalle(c: Ctx): void {
  const b = c.b;
  const RED = c.p.base;
  const RED_D = c.p.dark;
  const CREAM = trim(c, 0xffefd2);
  const W = B.wingL;
  const T = B.tipL;
  const UP = 0.28;
  // runde Flügelenden
  const end = [0, -0.16, 0.36, -0.16, 0.43, -0.06, 0.41, 0.13, 0.32, 0.22, 0, 0.22];
  b.put(box(0.62, 0.045, 0.38), { bone: W, color: RED_D, pos: [0.31, 0, 0.03], mirror: B.wingR, outline: 0.7 });
  b.put(box(0.4, 0.045, 0.38), { bone: W, color: RED, pos: [0.42, UP, 0.03], mirror: B.wingR, outline: 0.7 });
  b.put(plan(end, 0.045), { bone: T, color: RED_D, mirror: B.tipR, outline: 0.7 });
  b.put(plan(end, 0.045), { bone: T, color: RED, pos: [0, UP, 0], mirror: B.tipR, outline: 0.7 });
  if (b.fine) b.put(box(0.07, 0.05, 0.385), { bone: T, color: CREAM, pos: [0.12, UP, 0.03], mirror: B.tipR, outline: 0 });
  const strut = (bone: number, mirror: number, x: number): void =>
    b.put(box(0.034, UP, 0.034), { bone, color: CHROME, pos: [x, UP / 2, 0.03], mirror, outline: 0.55 });
  strut(W, B.wingR, 0.25);
  strut(T, B.tipR, 0.27);
  // Höhenruder hinter der Lehne
  const TL = B.wtail;
  b.put(box(0.034, 0.22, 0.034), { bone: TL, color: CHROME, pos: [0.2, 0.11, 0], mirror: TL, outline: 0.55 });
  b.put(box(0.78, 0.045, 0.2), { bone: TL, color: RED_D, pos: [0, 0.23, -0.02], outline: 0.7 });
}

/** Vera: schlanke, nach außen spitz zulaufende Tragflächen mit hellen Enden, Höhenflosse an der Heckflosse. */
function wingsVera(c: Ctx): void {
  const b = c.b;
  const TURQ = c.p.base;
  const TURQ_D = c.p.dark;
  const TRIM = trim(c, WHITE);
  b.put(plan([0, -0.18, 0.78, -0.18, 0.78, 0.08, 0, 0.32], 0.035), { bone: B.wingL, color: TURQ, mirror: B.wingR, outline: 0.7 });
  b.put(plan([0, -0.18, 0.26, -0.17, 0.33, -0.11, 0.33, -0.04, 0, 0.08], 0.035), {
    bone: B.tipL,
    color: TRIM,
    mirror: B.tipR,
    outline: 0.7,
  });
  // Zierstreifen an der Vorderkante
  if (b.fine)
    b.put(plan([0.1, 0.27, 0.78, 0.065, 0.78, 0.025, 0.1, 0.235], 0.04), { bone: B.wingL, color: TURQ_D, mirror: B.wingR, outline: 0 });
  b.put(plan([0, -0.1, 0.38, -0.16, 0.4, -0.09, 0, 0.13], 0.03), { bone: B.wtail, color: TURQ_D, mirror: B.wtail, outline: 0.6 });
  if (b.fine)
    b.put(plan([0.3, -0.15, 0.38, -0.16, 0.4, -0.09, 0.3, -0.06], 0.034), { bone: B.wtail, color: TRIM, mirror: B.wtail, outline: 0 });
}

/** Bert: breite Flossen wie Walross-Flossen, hinten ein Schubpropeller aus Holz. */
function wingsBert(c: Ctx): void {
  const b = c.b;
  const YEL = c.p.base;
  const YEL_D = c.p.dark;
  const RIM = trim(c, 0xfff6e2);
  b.put(plan([0, -0.1, 0.5, -0.2, 0.5, 0.18, 0, 0.1], 0.05), { bone: B.wingL, color: YEL, mirror: B.wingR, outline: 0.75 });
  const paddle = [0, -0.2, 0.2, -0.27, 0.38, -0.24, 0.48, -0.12, 0.5, 0.0, 0.46, 0.13, 0.32, 0.24, 0.14, 0.24, 0, 0.18];
  b.put(plan(paddle, 0.05), { bone: B.tipL, color: YEL, mirror: B.tipR, outline: 0.75 });
  // Zehenstriche
  if (b.fine)
    for (const z of [-0.09, 0.07])
      b.put(box(0.22, 0.056, 0.026), { bone: B.tipL, color: YEL_D, pos: [0.3, 0, z], rot: [0, z * 1.6, 0], mirror: B.tipR, outline: 0 });
  // Propeller: Welle, Nabe, drei verdrehte Holzblätter mit hellen Spitzen
  const P = B.wtail;
  b.put(cyl(0.03, 0.03, 0.16, 5), { bone: P, color: DARK, pos: [0, 0, -0.06], rot: [HALF_PI, 0, 0], outline: 0.55 });
  b.put(cone(0.07, 0.13, b.s(8, 6)), { bone: P, color: CHROME, pos: [0, 0, -0.14], rot: [-HALF_PI, 0, 0], outline: 0.6 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const s = Math.sin(a);
    const co = Math.cos(a);
    b.put(box(0.085, 0.27, 0.02), { bone: P, color: 0xc98a4b, pos: [s * 0.165, co * 0.165, -0.15], rot: [0, 0.5, -a], order: 'ZYX', outline: 0.6 });
    if (b.fine)
      b.put(box(0.087, 0.06, 0.024), { bone: P, color: RIM, pos: [s * 0.27, co * 0.27, -0.15], rot: [0, 0.5, -a], order: 'ZYX', outline: 0 });
  }
}

/** Zoe: kantiges Delta mit Blitz-Zacken an der Hinterkante und hochgestellten Winglets. */
function wingsZoe(c: Ctx): void {
  const b = c.b;
  const VIO = c.p.base;
  const VIO_D = c.p.dark;
  const ACC = c.p.accent;
  // prettier-ignore
  const inner = [0, -0.22, 0.12, -0.22, 0.2, -0.13, 0.3, -0.22, 0.42, -0.22, 0.5, -0.13, 0.6, -0.22, 0.72, -0.22, 0.72, 0.057, 0, 0.38];
  b.put(plan(inner, 0.04), { bone: B.wingL, color: VIO, mirror: B.wingR, outline: 0.7 });
  b.put(plan([0, -0.22, 0.26, -0.22, 0.26, -0.06, 0, 0.057], 0.04), { bone: B.tipL, color: VIO_D, mirror: B.tipR, outline: 0.7 });
  // Winglet: senkrechte Platte, leicht nach außen gekippt
  b.put(prism([-0.24, 0, -0.02, 0, -0.15, 0.24, -0.26, 0.26], 0.03), {
    bone: B.tipL,
    color: ACC,
    pos: [0.26, 0, 0],
    rot: [0, -HALF_PI, -0.25],
    order: 'ZYX',
    mirror: B.tipR,
    outline: 0.65,
  });
  // heller Keil an der Vorderkante
  if (b.fine) b.put(plan([0.06, 0.34, 0.6, 0.11, 0.6, 0.06, 0.06, 0.29], 0.046), { bone: B.wingL, color: c.p.light, mirror: B.wingR, outline: 0 });
}

const WING_BUILDERS = [wingsKalle, wingsVera, wingsBert, wingsZoe];

// ───────────────────────────── Tauchausrüstung ─────────────────────────────
//
// Unter Wasser legt jede Figur ihre Ausrüstung an – nach dem Muster der
// Gleitflügel: alles steckt im Netz des Karts und hängt an eigenen Knochen,
// die außerhalb des Wassers auf null geschrumpft sind. Kopf-Ausrüstung am
// Knochen dHead (Koordinaten relativ zu seinem Drehpunkt spec.diveHead im
// Kopf), Karosserie-Teile an dBody, Schrauben an dPropL/R. Dazu kommen drei
// aufsteigende Blasen und je Auspuff ein Blasenstrahl (bei Schub statt der
// Flammen).

const BUBBLE = 0xe8fbff;

/**
 * Riemen um den Hinterkopf: Bogen auf dem (etwas aufgeblähten) Kopf-Ellipsoid
 * in Höhe y, von Winkel phi0 (0 = vorn) links über hinten nach rechts. Die
 * Lage ist relativ zur Kopfmitte; o verschiebt sie in den Raum von dHead.
 */
function headBand(b: Builder, R: V3, y: number, phi0: number, color: number, o: V3, r = 0.016): void {
  const pts: V3[] = [];
  const n = 4;
  const k = 1.05;
  const f = Math.sqrt(Math.max(1 - (y / (R[1] * k)) ** 2, 0.05));
  for (let i = 0; i <= n; i++) {
    const a = phi0 + ((TAU - 2 * phi0) * i) / n;
    pts.push([R[0] * k * f * Math.sin(a) + o[0], y + o[1], R[2] * k * f * Math.cos(a) + o[2]]);
  }
  b.put(sweep(pts, r, 3), { bone: B.dHead, color, outline: 0 });
}

/** Schiffsschraube am Knochen dPropL (gespiegelt an dPropR): Nabe nach hinten, zwei gekreuzte, angestellte Blätter. */
function propeller(b: Builder, r: number, blade: number, color: number, twin: boolean): void {
  const mirror = twin ? B.dPropR : undefined;
  b.put(cone(r * 0.3, r * 0.55, b.s(6, 5)), { bone: B.dPropL, color: CHROME, rot: [-HALF_PI, 0, 0], mirror, outline: 0 });
  for (const a of [0, HALF_PI])
    b.put(box(blade, r * 2, 0.016), { bone: B.dPropL, color, pos: [0, 0, -0.02], rot: [0, 0.55, a], order: 'ZYX', mirror, outline: 0.5 });
}

/** Kalle: Taucherbrille (Gummirahmen um beide Augen, sitzt auf der Schnauze), Schnorchel, Heckschraube. */
function diveKalle(c: Ctx): void {
  const b = c.b;
  const G = B.dHead;
  const R: V3 = [0.33, 0.29, 0.3];
  // Alles relativ zur Kopfmitte angegeben; dHead sitzt vorn auf dem Gesicht,
  // damit die Ausrüstung beim Auf- und Abploppen nicht im Kopf verschwindet.
  const h = c.sp.diveHead;
  const o: V3 = [-h[0], 0.3 - h[1], -h[2]];
  const at = (x: number, y: number, z: number): V3 => [x + o[0], y + o[1], z + o[2]];
  // Rahmen: Ring auf dem Kopf-Ellipsoid rund um beide Augen
  const loop: V3[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * TAU;
    const x = 0.235 * Math.cos(a);
    const y = 0.045 + 0.085 * Math.sin(a);
    const q = 1 - (x / (R[0] * 1.07)) ** 2 - (y / (R[1] * 1.07)) ** 2;
    loop.push(at(x, y, R[2] * 1.07 * Math.sqrt(Math.max(q, 0.05))));
  }
  b.put(sweep(loop, 0.027, 3), { bone: G, color: DARK, outline: 0 });
  // Glanzstrich auf dem Glas
  b.put(box(0.065, 0.014, 0.008), { bone: G, color: WHITE, pos: at(0.205, 0.1, 0.25), rot: [-0.3, 0.6, 0.55], outline: 0 });
  headBand(b, R, 0.045, 0.79, DARK, o);
  // Schnorchel: Mundstück in der Schnauze, steigt links vor dem Ohr auf
  b.put(
    sweep(
      [
        at(0.12, -0.09, 0.33),
        at(0.29, -0.07, 0.2),
        at(0.36, 0.15, 0.12),
        at(0.34, 0.47, 0.07),
      ],
      0.03,
      4,
    ),
    { bone: G, color: c.p.accent, outline: 0.7 },
  );
  // Heckschraube auf kurzer Welle unter der Startnummer
  b.put(box(0.04, 0.04, 0.14), { bone: B.dBody, color: DARK, pos: [0, 0, -0.07], outline: 0 });
  propeller(b, 0.16, 0.07, trim(c, 0xffefd2), false);
}

/** Vera: die Fliegerbrille rutscht über die Augen (siehe buildVera), Schrauben in den Auspufftrichtern, Flossen obenauf. */
function diveVera(c: Ctx): void {
  const b = c.b;
  b.put(prism([0.24, 0.03, -0.03, 0.03, -0.06, 0.17, 0.04, 0.17], 0.03), {
    bone: B.dBody,
    color: c.p.dark,
    pos: [0.33, 0, 0],
    rot: [0, -HALF_PI, 0],
    mirror: B.dBody,
    outline: 0.6,
  });
  propeller(b, 0.105, 0.05, trim(c, WHITE), true);
}

/** Bert: nur eine Schwimmbrille – und ein Außenborder an der Wanne. */
function diveBert(c: Ctx): void {
  const b = c.b;
  const G = B.dHead;
  const NAVY = 0x2e4372;
  const R: V3 = [0.35, 0.3, 0.31];
  // relativ zur Kopfmitte, dHead sitzt vorn zwischen den Augen (siehe Kalle)
  const h = c.sp.diveHead;
  const o: V3 = [-h[0], 0.29 - h[1], -h[2]];
  const at = (x: number, y: number, z: number): V3 => [x + o[0], y + o[1], z + o[2]];
  // Brillengläser: Ringe um die Augen, Steg über der Nase, Riemen nach hinten
  const lens = new THREE.TorusGeometry(0.07, 0.019, 3, b.s(7, 6));
  lens.rotateX(-HALF_PI);
  b.put(lens, { bone: G, color: NAVY, pos: at(0.116, 0.085, 0.3), aim: [0.28, 0.28, 0.92], mirror: G, outline: 0 });
  b.put(box(0.06, 0.022, 0.022), { bone: G, color: NAVY, pos: at(0, 0.095, 0.322), outline: 0 });
  headBand(b, R, 0.085, 0.62, NAVY, o);
  // Außenborder: Klemme am Wannenrand, Motorhaube, Schaft, Schraube
  const D = B.dBody;
  b.put(box(0.18, 0.17, 0.26), { bone: D, color: c.p.dark, pos: [0, 0.11, -0.17], outline: 0.75 });
  b.put(box(0.06, 0.46, 0.08), { bone: D, color: DARK, pos: [0, -0.21, -0.17], outline: 0.6 });
  propeller(b, 0.12, 0.06, trim(c, 0xfff6e2), false);
}

/** Zoe: Glaskuppel über Kopf und Ohren – Katzen und Wasser … –, oben ein Ventil. */
function diveZoe(c: Ctx): void {
  const b = c.b;
  const G = B.dHead;
  const r = 0.47;
  const hole = 1.0;
  // Kuppel: Kugel mit runder Öffnung vorn (das Gesicht schaut heraus)
  const ws = b.s(10, 6);
  // Beginn bei −90°: eine Kante der Facetten läuft genau über den Scheitel (dort sitzt die Naht).
  const dome = new THREE.SphereGeometry(r, ws, b.s(4, 3), -HALF_PI, TAU, hole, Math.PI - hole);
  dome.rotateX(HALF_PI);
  b.put(dome, { bone: G, color: 0xc4ecff });
  const rim = new THREE.TorusGeometry(r * Math.sin(hole), 0.032, 3, ws);
  b.put(rim, { bone: G, color: c.p.dark, pos: [0, 0, r * Math.cos(hole)], outline: 0 });
  // Naht vom Rand über den Scheitel nach hinten – gibt der Kuppel von hinten Halt
  const seam = new THREE.TorusGeometry(r + 0.006, 0.022, 3, b.s(6, 4), Math.PI - 0.25);
  seam.rotateY(-HALF_PI);
  seam.rotateX(-hole);
  b.put(seam, { bone: G, color: c.p.dark, outline: 0 });
  // Glanzstriche vorn links und hinten rechts (auf Höhe der Facetten, nicht der Ecken)
  const gr = r * Math.cos(Math.PI / ws) + 0.006;
  const glints = [
    [0.62, 0.66, 0.36],
    [-0.45, 0.7, -0.55],
  ] as const;
  if (b.fine)
    for (const d of glints) {
      const l = Math.hypot(d[0], d[1], d[2]);
      b.put(box(0.17, 0.008, 0.035), { bone: G, color: WHITE, pos: [(d[0] / l) * gr, (d[1] / l) * gr, (d[2] / l) * gr], aim: d, outline: 0 });
    }
  const vd: V3 = [0, 0.906, -0.423];
  b.put(cyl(0.028, 0.04, 0.07, 5), { bone: G, color: c.p.accent, pos: [0, vd[1] * (r + 0.025), vd[2] * (r + 0.025)], aim: vd, outline: 0 });
}

const DIVE_BUILDERS = [diveKalle, diveVera, diveBert, diveZoe];

/** Drei Blasen, die aus Schnorchel, Mund oder Ventil aufsteigen. */
function diveBubbles(b: Builder): void {
  for (let i = 0; i < 3; i++) b.put(sphere(0.045, 0.045, 0.045, 6, 3), { bone: B.bub0 + i, color: BUBBLE, outline: 0 });
}

/**
 * Blasenstrahl bei Schub unter Wasser: steckt im Netz der Flammen (leuchtend,
 * nur bei Bedarf sichtbar) – kostet also weder Dreiecke im Normalfall noch
 * einen eigenen Zeichenaufruf. Entlang +z der Knochen jetL/R, wie die Flammen.
 */
function buildJets(b: Builder): void {
  for (const bone of [B.jetL, B.jetR]) {
    b.put(sphere(0.065, 0.065, 0.065, 6, 3), { bone, color: 0x8fd6ea, pos: [0, 0, 0.08] });
    b.put(sphere(0.05, 0.05, 0.05, 6, 3), { bone, color: 0x76c4dc, pos: [0.03, 0.02, 0.2] });
    b.put(sphere(0.038, 0.038, 0.038, 5, 3), { bone, color: 0x5fb0cc, pos: [-0.02, 0.035, 0.31] });
  }
}

// ───────────────────────────── Raumausrüstung ─────────────────────────────
//
// Auf dem Mond tragen alle Raumhelm und Tornister, am Kart sitzen Steuerdüsen
// und eine blinkende Positionsleuchte – wieder nach dem Muster der
// Gleitflügel: alles im Netz des Karts, an eigenen Knochen, die sonst auf
// null geschrumpft sind.
//
// Der Helm ist eine Glaskugel, deren Dreiecke nach innen zeigen: von außen
// fällt die zugewandte Hälfte weg, sichtbar bleibt nur die Innenseite der
// abgewandten Wand. So sieht man das Gesicht „durch das Glas“ – mit einem
// einzigen, undurchsichtigen Material. Die Kontur kommt von einer normalen
// Kugel als Hülle und zeichnet nur den Rand.

const GLASS = 0xbfe6fb;
const JET_HOT = 0xfffbe8;
const JET_WARM = 0xffd86a;

/** Dreht alle Dreiecke um (Innenseite sichtbar). flat: kantige Facetten statt runder Schattierung. */
function inward(g: THREE.BufferGeometry, flat: boolean): THREE.BufferGeometry {
  if (flat) {
    const f = g.toNonIndexed();
    g.dispose();
    const p = f.getAttribute('position') as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    for (let i = 0; i < a.length; i += 9)
      for (let k = 0; k < 3; k++) {
        const v = a[i + 3 + k];
        a[i + 3 + k] = a[i + 6 + k];
        a[i + 6 + k] = v;
      }
    f.deleteAttribute('normal');
    f.computeVertexNormals();
    return f;
  }
  const idx = g.getIndex()!;
  for (let i = 0; i < idx.count; i += 3) {
    const v = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, v);
  }
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

interface HelmLook {
  /** Segmente rundum und vom Scheitel bis zum Halsring. */
  ws: number;
  hs: number;
  /** Kantige Facetten (Zoe). */
  flat?: boolean;
  /** Halsring. */
  ring: number;
  /** Richtungen der Glanzlichter (je zwei Striche), vom Kugelmittelpunkt aus. */
  glints: readonly V3[];
}

/** Glaskugel am Knochen sHead (Ursprung = Kugelmitte), unten offen, mit Halsring und Glanzstrichen. */
function spaceHelmet(c: Ctx, o: HelmLook): void {
  const b = c.b;
  const G = B.sHead;
  const R = c.sp.spaceHelmR;
  const cut = c.sp.spaceCut;
  const ws = b.s(o.ws, 6);
  const hs = b.s(o.hs, 3);
  // Naht der Segmente hinten (−z)
  const ball = (): THREE.BufferGeometry => new THREE.SphereGeometry(1, ws, hs, -HALF_PI, TAU, 0, cut);
  b.put(inward(ball(), o.flat === true), { bone: G, color: GLASS, scale: R, hull: ball(), outline: 0.75 });
  // Halsring an der Öffnung (Ellipse aus den Halbachsen)
  const s = Math.sin(cut);
  const ring = new THREE.TorusGeometry(R[0] * s, 0.04, 3, ws);
  ring.rotateX(HALF_PI);
  b.put(ring, { bone: G, color: o.ring, pos: [0, R[1] * Math.cos(cut), 0], scale: [1, 1, R[2] / R[0]], outline: 0 });
  // Glanzstriche: zwei Streifen dicht über der Kugel, nur von außen sichtbar
  if (!b.fine) return;
  for (const d of o.glints) {
    const l = Math.hypot(d[0], d[1], d[2]);
    const nx = d[0] / l;
    const ny = d[1] / l;
    const nz = d[2] / l;
    const k = 1 / Math.hypot(nx / R[0], ny / R[1], nz / R[2]) + 0.008;
    for (let i = 0; i < 2; i++) {
      const strip = new THREE.PlaneGeometry(i === 0 ? 0.17 : 0.07, 0.03);
      strip.rotateX(-HALF_PI);
      strip.translate(i === 0 ? 0 : -0.03, 0, i * 0.055);
      b.put(strip, { bone: G, color: WHITE, pos: [nx * k, ny * k, nz * k], aim: [nx, ny, nz], outline: 0 });
    }
  }
}

/** Antenne am Knochen sAnt: Stab nach oben, Kugel an der Spitze. */
function spaceAntenna(b: Builder, len: number, tip: number): void {
  b.put(cone(0.018, len, 3), { bone: B.sAnt, color: STEEL, outline: 0.45 });
  b.put(sphere(0.034, 0.034, 0.034, 4, 2), { bone: B.sAnt, color: tip, pos: [0, len + 0.02, 0], outline: 0.55 });
}

/**
 * Steuerdüsen an den vier Ecken (Glocke zeigt seitlich nach außen), die
 * Positionsleuchte mit rotem Glas und darüber dem leuchtenden (eigener
 * Knochen, blinkt) – und die vier Düsenstöße: helle Kegel entlang ±x.
 */
function spaceThrusters(c: Ctx, nozzle: number): void {
  const b = c.b;
  const sp = c.sp;
  const S = B.sBody;
  // Glocken ohne Kontur, dafür dunkel gegen den Lack
  for (const m of [sp.spaceJetF, sp.spaceJetR]) {
    b.put(cone(0.05, 0.1, 4), { bone: S, color: nozzle, pos: [m[0] + 0.005, m[1], m[2]], aim: [-1, 0, 0], mirror: S, outline: 0 });
  }
  const L = sp.spaceLamp;
  b.put(sphere(0.042, 0.05, 0.042, 4, 2), { bone: S, color: 0xc0392b, pos: [L[0], L[1] + 0.05, L[2]], outline: 0.5 });
  b.put(sphere(0.054, 0.062, 0.054, 4, 2), { bone: B.sLamp, color: 0xfff1d6, outline: 0 });
  // Düsenstöße: kurzer heller Kern, warmer Saum – Spitze bei x = 0.42 (Knochen skaliert die Länge)
  const jet: LP[] = [
    [0, 0, JET_HOT],
    [0.085, 0.06, JET_WARM],
    [0, 0.42],
  ];
  for (const [bone, mirror] of [
    [B.sJet0, B.sJet1],
    [B.sJet2, B.sJet3],
  ]) {
    const g = lathe(jet, 4);
    g.rotateZ(-HALF_PI);
    b.put(g, { bone, mirror, outline: 0 });
  }
}

/** Kalle: runde Goldfischglas-Kugel, kantiger Tornister mit Lackdeckel, Antenne mit Kugel in Lackfarbe. */
function spaceKalle(c: Ctx): void {
  const b = c.b;
  spaceHelmet(c, { ws: 9, hs: 4, ring: c.p.accent, glints: [[0.55, 0.62, 0.55], [-0.6, 0.55, -0.55]] });
  const P = B.sPack;
  b.put(box(0.36, 0.3, 0.15), { bone: P, color: trim(c, 0xffefd2), outline: 0.8 });
  b.put(box(0.37, 0.07, 0.16), { bone: P, color: c.p.base, pos: [0, 0.13, 0], outline: 0 });
  spaceAntenna(b, 0.34, c.p.base);
  spaceThrusters(c, DARK);
}

/** Vera: hohes Ei, das die Schnauze umschließt; schlanke Sauerstoffflasche, Peitschenantenne. */
function spaceVera(c: Ctx): void {
  const b = c.b;
  spaceHelmet(c, { ws: 8, hs: 4, ring: trim(c, WHITE), glints: [[0.5, 0.7, 0.5], [-0.55, 0.6, -0.6]] });
  const P = B.sPack;
  b.put(cyl(0.085, 0.085, 0.34, b.s(5, 4)), { bone: P, color: trim(c, WHITE), outline: 0.8 });
  b.put(sphere(0.05, 0.04, 0.05, 4, 2), { bone: P, color: CHROME, pos: [0, 0.18, 0], outline: 0 });
  spaceAntenna(b, 0.42, c.p.base);
  spaceThrusters(c, c.p.dark);
}

/** Bert: breite Glocke, unten weit offen (die Stoßzähne schauen heraus); dicker Tank quer auf dem Rücken. */
function spaceBert(c: Ctx): void {
  const b = c.b;
  spaceHelmet(c, { ws: 8, hs: 4, ring: c.p.dark, glints: [[0.6, 0.6, 0.5], [-0.6, 0.6, -0.5]] });
  // Tank quer: Lack mit hellen Enden, ein Drehkörper (Kontur über einen schlichten Zylinder)
  const RIM = trim(c, 0xfff6e2);
  const ts = b.s(5, 4);
  const tank: LP[] = [
    [0, -0.25, RIM],
    [0.11, -0.25, RIM, true],
    [0.11, -0.18, c.p.base],
    [0.11, 0.18, RIM],
    [0.11, 0.25, RIM, true],
    [0, 0.25],
  ];
  b.put(lathe(tank, ts), { bone: B.sPack, rot: [0, 0, HALF_PI], hull: cyl(0.11, 0.11, 0.5, ts), outline: 0.8 });
  spaceAntenna(b, 0.3, 0xff7a3c);
  spaceThrusters(c, DARK);
}

/** Zoe: kantiger Kristallhelm aus wenigen Facetten, Keil-Tornister mit Blitz, Antenne in der Akzentfarbe. */
function spaceZoe(c: Ctx): void {
  const b = c.b;
  spaceHelmet(c, { ws: 7, hs: 4, flat: true, ring: c.p.accent, glints: [[0.55, 0.65, 0.5], [-0.55, 0.6, -0.55]] });
  const P = B.sPack;
  b.put(prism([-0.15, -0.14, 0.15, -0.14, 0.11, 0.15, -0.11, 0.15], 0.13), { bone: P, color: c.p.light, outline: 0.8 });
  if (b.fine) b.put(prism(BOLT, 0.012), { bone: P, color: c.p.accent, pos: [0, 0, -0.068], rot: [0, Math.PI, 0], scale: [0.4, 0.22, 1], outline: 0 });
  spaceAntenna(b, 0.32, c.p.accent);
  spaceThrusters(c, c.p.deeper);
}

const SPACE_BUILDERS = [spaceKalle, spaceVera, spaceBert, spaceZoe];

/** Wie weit die Ohren im Helm nach hinten angelegt werden (rad). */
const SPACE_EARS = [0.3, 1.2, 0, 1.05];

// ───────────────────────────── Effekte ─────────────────────────────

/** Schutzring, Blitze und Qualm – ein Netz, sichtbar nur bei Bedarf. */
function buildFx(b: Builder, color: number): void {
  // Stoßfänger: verchromter Ring mit drei Gummipuffern in Spielerfarbe
  const ring = new THREE.TorusGeometry(1.2, 0.058, 4, b.s(22, 12));
  ring.rotateX(HALF_PI);
  b.put(ring, { bone: B.guard, color: CHROME });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const pos: V3 = [Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2];
    b.put(sphere(0.24, 0.115, 0.1, 6, 4), { bone: B.guard, color, pos, rot: [0, a, 0], hull: box(0.36, 0.17, 0.14) });
    if (b.fine)
      b.put(box(0.26, 0.045, 0.02), {
        bone: B.guard,
        color: WHITE,
        pos: [Math.sin(a) * 1.292, 0, Math.cos(a) * 1.292],
        rot: [0, a, 0],
        outline: 0,
      });
  }
  // Kurzschluss: zwei Blitze …
  b.put(prism(BOLT, 0.035), { bone: B.bolt0, color: 0xfff06a, scale: 0.5, outline: 0.6 });
  b.put(prism(BOLT, 0.035), { bone: B.bolt1, color: 0xfff06a, scale: 0.42, outline: 0.6 });
  // … und zwei Qualmwölkchen
  for (const bone of [B.puff0, B.puff1]) {
    const dark = bone === B.puff1;
    b.put(sphere(0.15, 0.13, 0.14, 6, 4), { bone, color: dark ? 0x8f8898 : 0xb5afbf, outline: 0.6 });
    b.put(sphere(0.115, 0.1, 0.11, 6, 4), { bone, color: dark ? 0x9e97a8 : 0xc6c1ce, pos: [0.13, 0.05, 0.02], outline: 0.6 });
    if (b.fine)
      b.put(sphere(0.1, 0.09, 0.1, 5, 3), { bone, color: dark ? 0x8f8898 : 0xb5afbf, pos: [-0.12, 0.06, -0.03], outline: 0.6 });
  }
}

/** Auspuffflammen: zwei Tropfen entlang +z ihres Knochens, außen orange, innen hell. */
function buildFlames(b: Builder): void {
  const outer: LP[] = [
    [0, 0, 0xff8a1c],
    [0.1, 0.1, 0xff6a14],
    [0.085, 0.3, 0xf2380c],
    [0.04, 0.55, 0xb81c08],
    [0, 0.78],
  ];
  const inner: LP[] = [
    [0, 0.01, 0xfff0b0],
    [0.055, 0.1, 0xffd060],
    [0.04, 0.26, 0xff9a28],
    [0, 0.44],
  ];
  for (const bone of [B.flameL, B.flameR]) {
    const o = lathe(outer, b.s(8, 6));
    o.rotateX(HALF_PI);
    b.put(o, { bone });
    const i = lathe(inner, b.s(6, 5));
    i.rotateX(HALF_PI);
    b.put(i, { bone });
  }
}

// ───────────────────────────── Items ─────────────────────────────
//
// Gegenstände in der Hand und der Abschleppdrache. Sie hängen nicht im
// Netz der Figur: jeder Gegenstand ist ein eigenes kleines Netz (+ Kontur),
// dessen Geometrie sich alle Karts teilen. Gebaut wird mit demselben Builder
// wie die Karts, nur mit einem einzigen (ruhenden) Knochen.
//
// Gegenstand: Ursprung = Griff (dort sitzt die Faust), +y oben, +z vorn,
// −x außen – gehalten wird immer rechts.

// Item-Nummern wie in game/sim.ts (3 Ölfleck und 7 Nebelkerze brauchen hier keinen Namen)
const I_BOOST = 1;
const I_TIRE = 2;
const I_TOP = 4;
const I_GUARD = 5;
const I_EMP = 6;
const I_ROBOT = 8;
const I_KITE = 9;
const I_ROCKET = 10;
const I_GOLD = 12;
const I_DRILL = 13;
// (14 ist der Kleber.)
const I_COUNT = 15;

// Farben des Brummkreisels auf der Strecke (things.ts) – auch sonst die Item-Farben.
const I_RED = 0xff5a4e;
const I_YEL = 0xffd23f;
const I_TURQ = 0x1fc8b6;
const I_INK = 0x2d2a36;

export interface ItemGeo {
  main: THREE.BufferGeometry;
  line: THREE.BufferGeometry | null;
}

const ONE_BONE = [new THREE.Matrix4()];

function finishItem(b: Builder): ItemGeo {
  const { main, outline } = b.finish();
  // Kein Skelett: Knochen-Attribute weg, echte Hülle fürs Culling.
  main.deleteAttribute('skinIndex');
  main.deleteAttribute('skinWeight');
  main.computeBoundingSphere();
  if (outline) {
    outline.deleteAttribute('skinIndex');
    outline.deleteAttribute('skinWeight');
    outline.computeBoundingSphere();
  }
  return { main, line: outline };
}

/** Zisch: Sprudelflasche mit Blitz auf dem Etikett und Korken. */
function buildBottle(b: Builder): void {
  const GLASS = 0x3fd08c;
  b.put(
    lathe(
      [
        [0, -0.07, GLASS],
        [0.1, -0.07],
        [0.124, -0.04],
        [0.126, 0.0, I_RED, true],
        [0.126, 0.15, GLASS, true],
        [0.118, 0.19],
        [0.078, 0.255],
        [0.047, 0.3],
        [0.045, 0.335],
        [0, 0.335],
      ],
      14,
    ),
    { bone: 0 },
  );
  b.put(
    lathe(
      [
        [0, 0.32, 0xc98a4b],
        [0.042, 0.32],
        [0.058, 0.37],
        [0.056, 0.415],
        [0, 0.42],
      ],
      10,
    ),
    { bone: 0 },
  );
  for (const s of [1, -1])
    b.put(prism(BOLT, 0.02), {
      bone: 0,
      color: I_YEL,
      pos: [0, 0.075, s * 0.128],
      rot: [0, s > 0 ? 0 : Math.PI, 0],
      scale: [0.2, 0.17, 1],
      outline: 0.45,
    });
  // Glanzlicht
  b.put(box(0.022, 0.1, 0.01), { bone: 0, color: 0xdffbea, pos: [0.055, 0.21, -0.1], rot: [-0.45, 0, -0.5], outline: 0 });
}

/** Rollreifen: Gummi mit Profilstollen, gelbe Nabe; Achse entlang z (Ring zeigt zur Kamera). */
function buildTire(b: Builder): void {
  const C: V3 = [-0.07, 0.21, 0];
  b.put(new THREE.TorusGeometry(0.165, 0.08, 8, 18), { bone: 0, color: 0x3a3745, pos: C });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    b.put(box(0.06, 0.05, 0.15), {
      bone: 0,
      color: 0x2a2733,
      pos: [C[0] + Math.sin(a) * 0.236, C[1] + Math.cos(a) * 0.236, 0],
      rot: [0, 0, -a],
      outline: 0.55,
    });
  }
  b.put(cyl(0.095, 0.095, 0.11, 12), { bone: 0, color: I_YEL, pos: C, rot: [HALF_PI, 0, 0], outline: 0.6 });
  b.put(cyl(0.035, 0.035, 0.13, 8), { bone: 0, color: WHITE, pos: C, rot: [HALF_PI, 0, 0], outline: 0.4 });
}

/** Ölfleck: Ölkanne mit langer Tülle, der Tropfen hängt schon dran. Griff innen, Tülle nach außen. */
function buildOilCan(b: Builder): void {
  const X = -0.2;
  b.put(
    lathe(
      [
        [0, -0.06, 0xe8473d],
        [0.13, -0.06],
        [0.136, -0.035],
        [0.136, 0.0, I_YEL, true],
        [0.136, 0.045, 0xe8473d, true],
        [0.136, 0.1],
        [0.124, 0.122, 0xc9d2de, true],
        [0.05, 0.2],
        [0.036, 0.222],
        [0, 0.224],
      ],
      14,
    ),
    { bone: 0, pos: [X, 0, 0] },
  );
  b.put(
    sweep(
      [
        [X, 0.19, 0],
        [X - 0.05, 0.25, 0],
        [X - 0.14, 0.3, 0],
        [X - 0.24, 0.33, 0],
      ],
      (t) => 0.026 - 0.013 * t,
      6,
      8,
    ),
    { bone: 0, color: 0xb7c2d2, outline: 0.7 },
  );
  b.put(sphere(0.032, 0.045, 0.032, 8, 6), { bone: 0, color: 0x2c2440, pos: [X - 0.255, 0.285, 0], outline: 0.7 });
  b.put(sphere(0.01, 0.014, 0.01, 5, 4), { bone: 0, color: 0xcfc6ee, pos: [X - 0.265, 0.295, -0.026], outline: 0 });
  // Henkel: Halbring auf der Innenseite
  b.put(new THREE.TorusGeometry(0.072, 0.02, 5, 10, Math.PI), {
    bone: 0,
    color: I_INK,
    pos: [X + 0.128, 0.03, 0],
    rot: [0, 0, -HALF_PI],
    outline: 0.7,
  });
}

/** Brummkreisel: wie auf der Strecke, nur klein; steht auf seiner Spitze in der Hand. */
function buildTop(b: Builder): void {
  const k = 0.27;
  const prof: LP[] = [
    [0, 0, I_RED],
    [0.5 * k, 0.45 * k],
    [0.78 * k, 0.72 * k, I_YEL],
    [0.8 * k, 0.86 * k],
    [0.6 * k, 1.02 * k, I_TURQ],
    [0.14 * k, 1.1 * k],
    [0.11 * k, 1.5 * k],
    [0.2 * k, 1.56 * k],
    [0, 1.62 * k],
  ];
  // Streifen auf dem roten Bauch – damit man das Drehen sieht.
  b.put(
    lathe(prof, 16, (band, j) => (band < 2 && j % 4 === 1 ? WHITE : band === 2 && j % 4 === 3 ? I_RED : undefined)),
    { bone: 0, pos: [0, 0.03, 0] },
  );
}

/** Stoßfänger: Wappenschild mit Chromrand und Gummi-Stoßleiste quer darüber. */
function buildShield(b: Builder): void {
  const SHIELD = [0, 1, 0.85, 0.74, 0.85, 0.05, 0.72, -0.38, 0.42, -0.74, 0, -1, -0.42, -0.74, -0.72, -0.38, -0.85, 0.05, -0.85, 0.74];
  const C: V3 = [0, 0.23, 0];
  b.put(prism(SHIELD, 0.06), { bone: 0, color: 0xdfe6f2, pos: C, scale: [0.21, 0.21, 1] });
  b.put(prism(SHIELD, 0.085), { bone: 0, color: 0x4aa6ff, pos: C, scale: [0.16, 0.16, 1], outline: 0.4 });
  b.put(prism(BOLT, 0.1), { bone: 0, color: WHITE, pos: [0, C[1] - 0.06, 0], scale: [0.16, 0.13, 1], outline: 0 });
  b.put(b.soft(0.44, 0.07, 0.12, 0.025, 10), { bone: 0, color: I_INK, pos: [0, C[1] + 0.05, 0], outline: 0.75 });
}

/** Kurzschluss: Stecker mit zwei Stiften und abgerissenem Kabel. */
function buildPlug(b: Builder): void {
  const BODY = 0x9b87ff;
  b.put(b.soft(0.25, 0.21, 0.17, 0.045, 12), { bone: 0, color: BODY, pos: [0, 0.15, 0] });
  b.put(cyl(0.06, 0.08, 0.08, 10), { bone: 0, color: 0x6b5bd6, pos: [0, 0.02, 0], outline: 0.7 });
  b.put(box(0.036, 0.13, 0.016), { bone: 0, color: CHROME, pos: [0.058, 0.31, 0], outline: 0.6, mirror: 0 });
  for (const s of [1, -1])
    b.put(prism(BOLT, 0.012), {
      bone: 0,
      color: I_YEL,
      pos: [0, 0.15, s * 0.088],
      rot: [0, s > 0 ? 0 : Math.PI, 0],
      scale: [0.16, 0.14, 1],
      outline: 0.4,
    });
  b.put(
    sweep(
      [
        [0, 0.0, 0],
        [0, -0.06, -0.01],
        [-0.04, -0.11, -0.03],
        [-0.1, -0.13, -0.06],
      ],
      0.022,
      6,
      10,
    ),
    { bone: 0, color: I_INK, outline: 0.7 },
  );
  // Kupferlitzen am Kabelende
  b.put(cone(0.024, 0.06, 5), { bone: 0, color: 0xe08a3c, pos: [-0.1, -0.13, -0.06], aim: [-0.8, -0.3, -0.5], outline: 0.5 });
}

/** Nebelkerze: Dose mit Streifen, Lunte und Funken. */
function buildSmokeCan(b: Builder): void {
  const GREY = 0xe4e0ec;
  b.put(
    lathe(
      [
        [0, -0.05, GREY],
        [0.1, -0.05],
        [0.106, -0.03],
        [0.106, 0.05, 0xff8a3c, true],
        [0.106, 0.12, GREY, true],
        [0.106, 0.21],
        [0.096, 0.232, 0x8f8898, true],
        [0.058, 0.25],
        [0, 0.252],
      ],
      14,
    ),
    { bone: 0 },
  );
  // Wölkchen auf dem Etikett, vorn und hinten
  for (const s of [1, -1])
    for (let i = 0; i < 3; i++)
      b.put(sphere(0.032 + (i === 1 ? 0.012 : 0), 0.026 + (i === 1 ? 0.01 : 0), 0.012, 6, 4), {
        bone: 0,
        color: WHITE,
        pos: [(i - 1) * 0.04, 0.085 + (i === 1 ? 0.008 : 0), s * 0.104],
        outline: 0.3,
      });
  b.put(
    sweep(
      [
        [0, 0.24, 0],
        [0.018, 0.29, 0],
        [-0.02, 0.34, 0.01],
        [-0.006, 0.39, 0],
      ],
      0.012,
      5,
      10,
    ),
    { bone: 0, color: 0x6b4a2e, outline: 0.5 },
  );
  // Funke: Stern aus zwei gekreuzten Scheiben
  const star: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const r = i % 2 === 0 ? 1 : 0.42;
    star.push(Math.sin(a) * r, Math.cos(a) * r);
  }
  for (const ry of [0, HALF_PI])
    b.put(prism(star, 0.02), { bone: 0, color: 0xffe04a, pos: [-0.006, 0.405, 0], rot: [0, ry, 0], scale: [0.075, 0.075, 1], outline: 0.45 });
  b.put(sphere(0.026, 0.026, 0.026, 6, 4), { bone: 0, color: 0xff8a1c, pos: [-0.006, 0.405, 0], outline: 0 });
}

/** Roboter: kleiner Blechroboter – Kopf mit Antenne und Augen, Kasten mit rotem Knopf, Ärmchen, Räder als Füße. */
function buildToyRobot(b: Builder): void {
  const TIN = 0xd9e2ee;
  b.put(b.soft(0.21, 0.17, 0.15, 0.035, 6), { bone: 0, color: I_TURQ, pos: [0, 0.16, 0] });
  b.put(b.soft(0.17, 0.13, 0.14, 0.04, 6), { bone: 0, color: TIN, pos: [0, 0.31, 0] });
  for (const x of [-0.042, 0.042]) b.put(sphere(0.024, 0.024, 0.012, 8, 6), { bone: 0, color: I_YEL, pos: [x, 0.32, 0.07], outline: 0.45 });
  b.put(box(0.07, 0.014, 0.01), { bone: 0, color: I_INK, pos: [0, 0.278, 0.071], outline: 0 });
  b.put(cyl(0.009, 0.009, 0.07, 5), { bone: 0, color: STEEL, pos: [0, 0.41, 0], outline: 0.4 });
  b.put(sphere(0.024, 0.024, 0.024, 8, 6), { bone: 0, color: I_RED, pos: [0, 0.45, 0], outline: 0.5 });
  b.put(cyl(0.03, 0.03, 0.03, 10), { bone: 0, color: I_RED, pos: [0, 0.17, 0.078], rot: [HALF_PI, 0, 0], outline: 0.5 });
  b.put(box(0.045, 0.13, 0.055), { bone: 0, color: TIN, pos: [0.13, 0.15, 0], rot: [0, 0, 0.2], mirror: 0, outline: 0.6 });
  b.put(cyl(0.05, 0.05, 0.04, 10), { bone: 0, color: I_INK, pos: [0.06, 0.05, 0], rot: [0, 0, HALF_PI], mirror: 0, outline: 0.6 });
  // Aufziehschlüssel im Rücken
  b.put(cyl(0.008, 0.008, 0.05, 5), { bone: 0, color: CHROME, pos: [0, 0.17, -0.1], rot: [HALF_PI, 0, 0], outline: 0.3 });
  b.put(box(0.09, 0.035, 0.012), { bone: 0, color: I_YEL, pos: [0, 0.17, -0.13], outline: 0.4 });
}

/** Kleber: weiße Tube mit gelbem Etikett, die rote Tülle offen – vorn quillt schon Kleber heraus. */
function buildGlueTube(b: Builder): void {
  const TUBE = 0xf3f1fb;
  b.put(cyl(0.072, 0.07, 0.24, 14), { bone: 0, color: TUBE, pos: [0, 0.17, 0] });
  b.put(box(0.16, 0.035, 0.03), { bone: 0, color: TUBE, pos: [0, 0.04, 0], outline: 0.6 });
  b.put(cyl(0.074, 0.074, 0.1, 14), { bone: 0, color: I_YEL, pos: [0, 0.18, 0], outline: 0 });
  b.put(sphere(0.026, 0.034, 0.012, 8, 6), { bone: 0, color: I_RED, pos: [0, 0.18, 0.074], outline: 0.35 });
  b.put(cone(0.072, 0.045, 14), { bone: 0, color: TUBE, pos: [0, 0.29, 0], outline: 0.6 });
  b.put(cone(0.03, 0.07, 10), { bone: 0, color: I_RED, pos: [0, 0.32, 0], outline: 0.5 });
  b.put(sphere(0.035, 0.04, 0.035, 8, 6), { bone: 0, color: GLUE, pos: [0.012, 0.395, 0.006], outline: 0.5 });
  b.put(sphere(0.016, 0.03, 0.016, 6, 5), { bone: 0, color: GLUE, pos: [0.03, 0.36, 0.02], outline: 0.4 });
}

/** Abschleppdrache, zusammengefaltet: schmale Raute mit Augen, Schwanz aufgerollt. */
function buildKiteFolded(b: Builder): void {
  const RHOMB = [0, 0.46, 0.13, 0.22, 0, 0.04, -0.13, 0.22];
  b.put(prism(RHOMB, 0.035), { bone: 0, color: I_YEL, pos: [0, -0.022, 0], scale: [1.18, 1.1, 1] });
  b.put(prism(RHOMB, 0.05), { bone: 0, color: I_RED, outline: 0.5 });
  for (const s of [1, -1]) {
    b.put(sphere(0.032, 0.036, 0.012, 6, 4), { bone: 0, color: WHITE, pos: [0.046, 0.26, s * 0.026], mirror: 0, outline: 0.5 });
    b.put(sphere(0.014, 0.02, 0.008, 5, 3), { bone: 0, color: I_INK, pos: [0.04, 0.255, s * 0.035], mirror: 0, outline: 0 });
  }
  b.put(cone(0.022, 0.08, 6), { bone: 0, color: I_TURQ, pos: [0.04, 0.39, 0], aim: [0.5, 1, 0], mirror: 0, outline: 0.5 });
  b.put(cyl(0.011, 0.011, 0.5, 5), { bone: 0, color: 0x6b4a2e, pos: [0, 0.23, 0.032], outline: 0.4 });
  b.put(
    sweep(
      [
        [0, 0.04, 0],
        [-0.04, 0.0, 0],
        [-0.08, -0.05, 0],
        [-0.07, -0.11, 0],
      ],
      0.01,
      5,
      8,
    ),
    { bone: 0, color: I_INK, outline: 0.4 },
  );
  b.put(prism([0, 0, -0.06, 0.035, -0.06, -0.035], 0.02), { bone: 0, color: I_YEL, pos: [-0.07, -0.11, 0], mirror: 0, outline: 0.5 });
}

/** Gleiter: kleines Fluggerät in der Hand – Rumpfstab mit zwei geschwungenen Flügeln und Leitwerk. */
function buildGlider(b: Builder): void {
  const WING = [0, 0, 0.3, 0.06, 0.34, 0.12, 0.06, 0.1];
  for (const s of [1, -1]) {
    b.put(prism(WING, 0.02), { bone: 0, color: I_YEL, pos: [0, 0.26, 0], rot: [HALF_PI, 0, s > 0 ? 0 : Math.PI], outline: 0.6 });
    b.put(prism([0.24, 0.06, 0.34, 0.12, 0.3, 0.07], 0.024), { bone: 0, color: I_RED, pos: [0, 0.26, 0], rot: [HALF_PI, 0, s > 0 ? 0 : Math.PI], outline: 0.4 });
  }
  b.put(cyl(0.018, 0.024, 0.34, 6), { bone: 0, color: I_INK, pos: [0, 0.14, 0], outline: 0.5 });
  b.put(prism([0, 0, 0.09, -0.02, 0.09, 0.03], 0.016), { bone: 0, color: I_TURQ, pos: [0, 0.0, 0], rot: [HALF_PI, 0, 0], outline: 0.4, mirror: 0 });
  b.put(sphere(0.04, 0.05, 0.04, 8, 5), { bone: 0, color: I_RED, pos: [0, 0.32, 0], outline: 0.5 });
}

/** Rakete: weißer Rumpf mit roter Spitze und rotem Band, Bullauge, vier Flossen, dunkle Düse. */
function buildRocket(b: Builder): void {
  b.put(
    lathe(
      [
        [0, 0.0, I_INK],
        [0.062, 0.0],
        [0.07, 0.03, WHITE, true],
        [0.082, 0.09],
        [0.084, 0.15, I_RED, true],
        [0.084, 0.2, WHITE, true],
        [0.082, 0.32],
        [0.074, 0.36, I_RED, true],
        [0.05, 0.43],
        [0.022, 0.475],
        [0, 0.49],
      ],
      14,
    ),
    { bone: 0, pos: [0, 0.02, 0] },
  );
  // Bullauge vorn: Chromring, Glas
  b.put(cyl(0.036, 0.036, 0.02, 12), { bone: 0, color: CHROME, pos: [0, 0.29, 0.078], rot: [HALF_PI, 0, 0], outline: 0.5 });
  b.put(sphere(0.026, 0.026, 0.012, 8, 5), { bone: 0, color: I_TURQ, pos: [0, 0.29, 0.088], outline: 0 });
  // Vier Flossen am Heck
  const FIN = [0.06, 0.2, 0.15, 0.06, 0.155, -0.02, 0.06, 0.04];
  for (let i = 0; i < 4; i++)
    b.put(prism(FIN, 0.02), { bone: 0, color: I_RED, pos: [0, 0.0, 0], rot: [0, (i * Math.PI) / 2 + Math.PI / 4, 0], outline: 0.5 });
  // Düse
  b.put(cyl(0.05, 0.062, 0.05, 12), { bone: 0, color: 0x5a5566, pos: [0, -0.005, 0], outline: 0.6 });
}

/** Fünfzackiger Stern mit Radius 1 (für prism). */
const STAR: readonly number[] = (() => {
  const out: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = HALF_PI + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 1 : 0.45;
    out.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return out;
})();

/** Get Gold: bauchige Goldflasche mit Korken, rotem Etikett mit Goldstern (vorn und hinten) und Glanzlicht. */
function buildGoldBottle(b: Builder): void {
  const GOLD = 0xffc62a;
  const GOLD_D = 0xcf8a12;
  const GOLD_L = 0xffeb9a;
  b.put(
    lathe(
      [
        [0, -0.07, GOLD_D],
        [0.108, -0.07],
        [0.146, -0.035],
        [0.156, 0.01, GOLD, true],
        [0.156, 0.04, I_RED, true],
        [0.156, 0.15, GOLD, true],
        [0.152, 0.18],
        [0.13, 0.235],
        [0.09, 0.28, GOLD_L, true],
        [0.056, 0.315],
        [0.05, 0.35, GOLD_D, true],
        [0.062, 0.362],
        [0.062, 0.385],
        [0, 0.385],
      ],
      16,
    ),
    { bone: 0 },
  );
  // Korken
  b.put(
    lathe(
      [
        [0, 0.37, 0xa8683a],
        [0.046, 0.37],
        [0.055, 0.41],
        [0.053, 0.445],
        [0, 0.452],
      ],
      10,
    ),
    { bone: 0 },
  );
  for (const sd of [1, -1])
    b.put(prism(STAR, 0.02), { bone: 0, color: GOLD_L, pos: [0, 0.095, sd * 0.158], rot: [0, sd > 0 ? 0 : Math.PI, 0], scale: [0.05, 0.05, 1], outline: 0.4 });
  // Glanzlicht
  b.put(box(0.026, 0.11, 0.01), { bone: 0, color: 0xfffbe6, pos: [0.07, 0.2, -0.13], rot: [-0.45, 0, -0.5], outline: 0 });
  b.put(box(0.02, 0.05, 0.01), { bone: 0, color: 0xfffbe6, pos: [0.09, 0.005, -0.12], rot: [-0.3, 0, -0.5], outline: 0 });
}

/**
 * Bohrer: Griff oben (dort sitzt die Faust), darunter das rote Motorgehäuse mit gelbem Band, Lüftungsschlitzen und
 * Auspuffstummel, dann das Bohrfutter und der stählerne Bohrkopf – ein Kegel mit dunklen Spiralstreifen und einer
 * aufgesetzten Bohrwendel, damit man das Drehen sieht. Die Spitze zeigt nach unten (−y), DRILL_LEN unter dem Griff.
 * (Drehkörper laufen von unten nach oben.)
 */
function buildDrill(b: Builder): void {
  const STEEL_L = 0xd3dbe6;
  const STEEL_D = 0x737d91;
  // Griff quer (entlang z) mit roten Enden, obenauf ein gelber Knauf
  b.put(cyl(0.032, 0.032, 0.16, b.s(8)), { bone: 0, color: I_INK, rot: [HALF_PI, 0, 0], outline: 0.6 });
  for (const z of [-0.09, 0.09]) b.put(sphere(0.042, 0.042, 0.032, b.s(8), 5), { bone: 0, color: I_RED, pos: [0, 0, z], outline: 0.6 });
  b.put(sphere(0.046, 0.034, 0.046, b.s(10), 6), { bone: 0, color: I_YEL, pos: [0, 0.045, 0], outline: 0.6 });
  // Bügel vom Griff zum Gehäuse
  for (const z of [-0.07, 0.07]) b.put(box(0.032, 0.05, 0.024), { bone: 0, color: I_INK, pos: [0, -0.03, z], outline: 0.5 });
  // Motorgehäuse
  b.put(
    lathe(
      [
        [0, -0.232, STEEL],
        [0.064, -0.232],
        [0.064, -0.218, I_RED, true],
        [0.112, -0.192],
        [0.118, -0.14, I_YEL, true],
        [0.118, -0.104, I_RED, true],
        [0.112, -0.072],
        [0.084, -0.05],
        [0, -0.044],
      ],
      b.s4(16),
    ),
    { bone: 0 },
  );
  // Lüftungsschlitze vorn und hinten, Auspuffstummel außen
  for (const sd of [1, -1]) for (let k = 0; k < 3; k++) b.put(box(0.014, 0.05, 0.014), { bone: 0, color: I_INK, pos: [-0.03 + k * 0.03, -0.17, sd * 0.114], outline: 0 });
  b.put(cyl(0.018, 0.022, 0.07, b.s(6)), { bone: 0, color: STEEL, pos: [-0.13, -0.16, 0], rot: [0, 0, HALF_PI + 0.5], outline: 0.5 });
  // Bohrfutter
  b.put(
    lathe(
      [
        [0.046, -0.272, STEEL],
        [0.056, -0.26],
        [0.06, -0.246, CHROME],
        [0.064, -0.232],
      ],
      b.s4(12),
    ),
    { bone: 0 },
  );
  // Bohrkopf: Kegel mit Spiralstreifen (Farbe je Band und Spalte versetzt – die Streifen laufen schräg herum)
  const TOP = -0.27;
  const TIP = -DRILL_LEN;
  const R = 0.084;
  const BANDS = 8;
  const prof: LP[] = [];
  for (let i = 0; i <= BANDS; i++) {
    const u = i / BANDS;
    prof.push([R * u * (1 + 0.12 * u * (1 - u)), TIP + u * (TOP - TIP), i === 0 ? STEEL_L : undefined]);
  }
  prof.push([0, TOP]);
  const segs = b.s4(16);
  b.put(
    lathe(prof, segs, (band, j) => (band < BANDS && ((((j - band * 2) % 8) + 8) % 8) < 3 ? STEEL_D : undefined)),
    { bone: 0 },
  );
  // Bohrwendel: ein Wulst, der sich zweieinhalbmal um den Kegel windet und zur Spitze hin dünner wird
  const helix: V3[] = [];
  const N = 32;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const y = TOP - 0.008 - u * (TOP - TIP - 0.04);
    const r = R * ((y - TIP) / (TOP - TIP)) + 0.007;
    const a = u * 2.5 * TAU;
    helix.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  b.put(
    sweep(helix, (u) => 0.019 * (1 - u * 0.7), b.s(6, 4)),
    { bone: 0, color: STEEL_L, outline: 0.45 },
  );
}

/** Bohrer: Länge vom Griff bis zur Spitze (Maßstab 1) – und so groß wird er beim Einstecken (siehe things.ts). */
export const DRILL_LEN = 0.56;
export const DRILL_GROW = 2.2;
/** Bohrer: so tief steckt die Spitze im Boden, wenn die Figur ihn losgelassen hat (Meter). */
export const DRILL_SINK = 0.35;
/** Bohrer: Stelle rechts neben dem Kart (x nach links positiv), an der er in den Boden kommt – wie im Spiel (sim.ts). */
const PLANT_X = -DRILL_SIDE;
const PLANT_Z = DRILL_FORE;
/**
 * Bohrer, Einstecken: Schlüsselbilder über den Fortschritt – Griff im Raum des Karts (x links, y hoch, z vor; Meter),
 * Neigung der Spitze nach außen (rad), Maßstab. Hochnehmen (er wächst dabei), über die Bande hinaus nach rechts
 * schwenken, senkrecht hoch ausholen, kurz halten – und mit einem Ruck in den Boden rammen (dabei wächst er noch ein
 * Stück). Die Spitze bleibt bis dahin immer gut über dem Boden.
 */
// prettier-ignore
const PLANT_KEYS: readonly number[] = [
  0, -0.56, 1.05, -0.2, 0.15, 1,
  0.22, -0.62, 1.45, 0, 0.55, 1.6,
  0.5, -0.95, 1.64, 0.22, 0.25, 1.8,
  0.74, -1.05, 1.76, 0.3, 0.06, 1.8,
  0.8, -1.07, 1.78, 0.32, 0.04, 1.85,
  0.93, PLANT_X, DRILL_LEN * DRILL_GROW - DRILL_SINK, PLANT_Z, 0, DRILL_GROW,
  1, PLANT_X, DRILL_LEN * DRILL_GROW - DRILL_SINK - 0.02, PLANT_Z, 0, DRILL_GROW,
];
const PLANT_KEY = 6;
/** Bohrer: das Schlüsselbild, ab dem er in den Boden gerammt wird (immer schneller, kein Abbremsen vor dem Boden). */
const PLANT_RAM = 4;

let drillShared: ItemGeo | null = null;

/** Netz des Bohrers (wie in der Hand) – für den Bohrer, der in der Welt steckt und hochbricht (things.ts). */
export function getDrillGeo(): ItemGeo {
  return (drillShared ??= getItemGeos()[I_DRILL]);
}

// ───────────────────────────── Rakete (Verwandlung) ─────────────────────────────
//
// Das Kart klappt die Räder ein, stellt sich auf und wird Stück für Stück mit einer
// Raketenhülle in seiner Lackfarbe verkleidet. Jedes Teil ist ein eigenes kleines Netz
// mit Ruhelage (Achse der Rakete = +y von root) und rastet in seinem Zeitfenster der
// Verwandlung ein: es gleitet aus `from` heran und schnappt mit Überschwinger fest.

interface RocketPiece {
  geo: ItemGeo;
  /** Ruhelage. */
  pos: V3;
  /** Drehung der Ruhelage um die Achse der Rakete. */
  turn: number;
  /** Woher es kommt (Versatz zur Ruhelage). */
  from: V3;
  /** Maßstab beim Erscheinen. */
  grow: number;
  /** Zeitfenster in der Verwandlung (Anteile 0..1). */
  a: number;
  b: number;
}

/** Halbmesser der Raketenhülle; die Rakete reicht von y ≈ −0,1 (Düse) bis 3,4 (Spitze). */
const ROCKET_R = 0.8;
const rocketCache: (RocketPiece[] | null)[] = [null, null, null, null];
let rocketFlameGeo: THREE.BufferGeometry | null = null;

function rocketPart(fill: (b: Builder) => void): ItemGeo {
  const b = new Builder(ONE_BONE, 2, true);
  fill(b);
  return finishItem(b);
}

/** Halbe Röhre (Mantelstück) von Winkel a0 über π, mit Deckeln; x = sin, z = cos wie bei three.js. */
function halfShell(r0: number, r1: number, h: number, a0: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(r1, r0, h, 14, 1, false, a0, Math.PI);
}

function rocketPieces(slot: number): RocketPiece[] {
  const hit = rocketCache[slot];
  if (hit) return hit;
  const pt = PAINTS[slot];
  const R = ROCKET_R;
  const out: RocketPiece[] = [];
  const add = (geo: ItemGeo, pos: V3, from: V3, a: number, b: number, grow = 0.3, turn = 0): void => {
    out.push({ geo, pos, from, a, b, grow, turn });
  };
  // Düse: Glocke aus dunklem Stahl mit Chromkragen
  add(
    rocketPart((b) => {
      b.put(
        lathe(
          [
            [0.52, -0.32, 0x4a4656],
            [0.44, -0.12],
            [0.3, 0.05],
            [0.42, 0.12, CHROME, true],
            [0.42, 0.24],
            [0, 0.26],
          ],
          16,
        ),
        { bone: 0 },
      );
      b.put(cyl(0.3, 0.3, 0.02, 12), { bone: 0, color: 0x1e1b26, pos: [0, -0.3, 0], outline: 0 });
    }),
    [0, 0.1, 0],
    [0, -1.4, 0],
    0.27,
    0.4,
  );
  // Vier Flossen
  const FIN = [R - 0.1, 1.15, R + 0.62, 0.25, R + 0.62, -0.2, R - 0.1, 0.12];
  for (let i = 0; i < 4; i++) {
    const turn = (i * Math.PI) / 2 + Math.PI / 4;
    add(
      rocketPart((b) => {
        b.put(prism(FIN, 0.08), { bone: 0, color: pt.dark, rot: [0, -HALF_PI, 0] });
        b.put(prism([R + 0.5, 0.2, R + 0.64, 0.2, R + 0.64, -0.2, R + 0.5, -0.2], 0.1), { bone: 0, color: pt.accent, rot: [0, -HALF_PI, 0], outline: 0.5 });
      }),
      [0, 0.15, 0],
      [Math.sin(turn) * -0.7, 0.2, Math.cos(turn) * -0.7],
      0.33 + i * 0.035,
      0.47 + i * 0.035,
      0.2,
      turn,
    );
  }
  // Untere Hülle: zwei Hälften, die sich von links und rechts schließen
  for (const side of [1, -1]) {
    add(
      rocketPart((b) => {
        b.put(halfShell(R * 0.92, R, 1.15, side > 0 ? 0 : Math.PI), { bone: 0, color: pt.base });
        // Nieten in der Hülle
        if (b.fine)
          for (let k = 0; k < 3; k++) {
            const ang = (side > 0 ? 0.6 : Math.PI + 0.6) + k * 0.9;
            b.put(sphere(0.035, 0.035, 0.02, 6, 4), { bone: 0, color: pt.light, pos: [Math.sin(ang) * R * 0.99, 0.4, Math.cos(ang) * R * 0.99], outline: 0 });
          }
      }),
      [0, 0.78, 0],
      [side * 1.5, 0.1, 0],
      side > 0 ? 0.42 : 0.47,
      side > 0 ? 0.56 : 0.61,
      0.6,
    );
  }
  // Ring mit Akzentfarbe zwischen unterer und oberer Hülle: legt sich von außen um die Naht
  add(
    rocketPart((b) => {
      b.put(cyl(R * 1.05, R * 1.05, 0.18, 18), { bone: 0, color: pt.accent });
    }),
    [0, 1.44, 0],
    [0, 0, 0],
    0.56,
    0.66,
    1.9,
  );
  // Obere Hülle: vorn und hinten, vorn mit Bullauge
  for (const side of [1, -1]) {
    add(
      rocketPart((b) => {
        b.put(halfShell(R, R * 0.96, 1.05, side > 0 ? -HALF_PI : HALF_PI), { bone: 0, color: pt.base });
        if (side > 0) {
          b.put(cyl(0.3, 0.3, 0.06, 16), { bone: 0, color: CHROME, pos: [0, 0.05, R * 0.98], rot: [HALF_PI, 0, 0], outline: 0.6 });
          b.put(sphere(0.23, 0.23, 0.06, 12, 6), { bone: 0, color: 0x7fe3ff, pos: [0, 0.05, R * 1.01], outline: 0 });
          b.put(sphere(0.06, 0.06, 0.02, 6, 4), { bone: 0, color: WHITE, pos: [0.08, 0.13, R * 1.05], outline: 0 });
        } else {
          // hinten ein Streifen in Akzentfarbe
          b.put(box(0.16, 0.95, 0.04), { bone: 0, color: pt.accent, pos: [0, 0, -R * 0.98], outline: 0.4 });
        }
      }),
      [0, 2.06, 0],
      [0, 0.3, side * 1.5],
      side > 0 ? 0.6 : 0.64,
      side > 0 ? 0.73 : 0.77,
      0.6,
    );
  }
  // Spitze: fällt von oben auf die Hülle
  add(
    rocketPart((b) => {
      b.put(
        lathe(
          [
            [R * 0.96, 0, pt.light],
            [R * 0.86, 0.32],
            [R * 0.6, 0.66],
            [R * 0.3, 0.9, pt.accent, true],
            [0.08, 1.04],
            [0, 1.07],
          ],
          18,
        ),
        { bone: 0 },
      );
    }),
    [0, 2.58, 0],
    [0, 2.2, 0],
    0.72,
    0.86,
    0.5,
  );
  rocketCache[slot] = out;
  return out;
}

/** Düsenfeuer: zwei ineinander steckende Kegel nach unten (heller Kern, orange Hülle). */
function getRocketFlameGeo(): THREE.BufferGeometry {
  if (rocketFlameGeo) return rocketFlameGeo;
  const b = new Builder(ONE_BONE, 2, false);
  b.put(
    lathe(
      [
        [0, 0, 0xff8a1c],
        [0.42, -0.08],
        [0.36, -0.7],
        [0.16, -1.5],
        [0, -2.1],
      ],
      14,
    ),
    { bone: 0, outline: 0 },
  );
  b.put(
    lathe(
      [
        [0, 0.02, 0xfff4c2],
        [0.26, -0.06],
        [0.2, -0.5],
        [0, -1.1],
      ],
      12,
    ),
    { bone: 0, outline: 0 },
  );
  rocketFlameGeo = finishItem(b).main;
  return rocketFlameGeo;
}

let itemGeos: ItemGeo[] | null = null;

/** Alle Gegenstände – einmal gebaut, von allen Karts geteilt. Index = Item. */
function getItemGeos(): ItemGeo[] {
  if (itemGeos) return itemGeos;
  const fns: (((b: Builder) => void) | null)[] = [
    buildBottle,
    buildTire,
    buildOilCan,
    buildTop,
    buildShield,
    buildPlug,
    buildSmokeCan,
    buildToyRobot,
    buildKiteFolded,
    buildRocket,
    buildGlider,
    buildGoldBottle,
    buildDrill,
    buildGlueTube,
  ];
  const out: ItemGeo[] = [];
  for (let i = 0; i < I_COUNT; i++) {
    const b = new Builder(ONE_BONE, 2, true);
    const fn = i > 0 ? fns[i - 1] : null;
    if (fn) fn(b);
    else b.put(box(0.001, 0.001, 0.001), { bone: 0, outline: 0 });
    const g = finishItem(b);
    // Die Rakete ist schlank – etwas größer, damit man sie in der Hand erkennt.
    if (i === I_ROCKET) {
      g.main.scale(1.35, 1.35, 1.35);
      g.line?.scale(1.35, 1.35, 1.35);
      g.main.computeBoundingSphere();
      g.line?.computeBoundingSphere();
    }
    out.push(g);
  }
  itemGeos = out;
  return out;
}

// Der fliegende Drache: eigenes kleines Skelett – Knochen 0 der Drache,
// 1..6 der Schwanz (Kette von der unteren Spitze abwärts).
const KITE_BONES = 7;
const KITE_TIP = 1.0;
const KITE_STEP = 0.3;
/** Wo die Leine angeknotet ist (Knochen 0, Vorderseite). */
const KITE_BRIDLE: V3 = [0, -0.14, -0.045];
const KITE_REST: THREE.Matrix4[] = [];
for (let i = 0; i < KITE_BONES; i++)
  KITE_REST.push(new THREE.Matrix4().makeTranslation(0, i === 0 ? 0 : -KITE_TIP - (i - 1) * KITE_STEP, 0));
/** Großzügige Hülle (im Raum von root) für Start, Flug und Abflug. */
/** Größe des fliegenden Drachens: aus der Fahrkamera muss er auch bei vollem Tempo auffallen. */
const KITE_SCALE = 2.1;
const KITE_BOUNDS = new THREE.Sphere(new THREE.Vector3(0, 4, 6), 13);

let kiteGeo: { main: THREE.BufferGeometry; outline: THREE.BufferGeometry | null } | null = null;

/**
 * Großer Comic-Drachen, Gesicht nach −z (zum Kart hin): Raute mit gelbem
 * Rand, Drachenaugen, Hörner, Zacken, Barteln und Maul; dahinter das Kreuz.
 */
function getKiteGeo(): { main: THREE.BufferGeometry; outline: THREE.BufferGeometry | null } {
  if (kiteGeo) return kiteGeo;
  const b = new Builder(KITE_REST, 2, true);
  const DIAMOND = [0, 0.6, 0.64, 0, 0, -KITE_TIP, -0.64, 0];
  const F = -0.03; // Vorderseite
  b.put(prism(DIAMOND, 0.03), { bone: 0, color: I_YEL, pos: [0, -0.02, 0.008], scale: [1.09, 1.06, 1] });
  b.put(prism(DIAMOND, 0.05), { bone: 0, color: I_RED, outline: 0.6 });
  // heller Bauch unten
  b.put(prism([0, -0.3, 0.3, -0.53, 0, -0.9, -0.3, -0.53], 0.054), { bone: 0, color: 0xff8a6a, outline: 0 });
  // Augen: weiß, gelbe Iris, Schlitzpupille, böse Brauen
  b.put(sphere(0.17, 0.15, 0.05, 12, 8), { bone: 0, color: WHITE, pos: [0.22, 0.06, F], mirror: 0, outline: 0.9 });
  b.put(sphere(0.105, 0.105, 0.03, 10, 6), { bone: 0, color: I_YEL, pos: [0.2, 0.04, F - 0.035], mirror: 0, outline: 0 });
  b.put(sphere(0.026, 0.085, 0.02, 6, 6), { bone: 0, color: I_INK, pos: [0.2, 0.04, F - 0.058], mirror: 0, outline: 0 });
  b.put(sphere(0.022, 0.022, 0.01, 5, 4), { bone: 0, color: WHITE, pos: [0.24, 0.09, F - 0.07], mirror: 0, outline: 0 });
  b.put(box(0.3, 0.065, 0.04), { bone: 0, color: I_INK, pos: [0.21, 0.25, F - 0.02], rot: [0, 0, 0.38], mirror: 0, outline: 0.5 });
  // Nüstern
  b.put(sphere(0.035, 0.025, 0.02, 6, 4), { bone: 0, color: 0x8a2028, pos: [0.075, -0.2, F - 0.02], mirror: 0, outline: 0 });
  // Maul mit Zähnen
  b.put(prism([-0.3, -0.33, 0.3, -0.33, 0.2, -0.47, 0, -0.53, -0.2, -0.47], 0.02), {
    bone: 0,
    color: 0x6b1f2a,
    pos: [0, 0, F - 0.005],
    outline: 0.5,
  });
  b.put(prism([-0.045, 0, 0.045, 0, 0, -0.1], 0.02), { bone: 0, color: WHITE, pos: [0.14, -0.335, F - 0.016], mirror: 0, outline: 0.35 });
  b.put(prism([-0.03, 0, 0.03, 0, 0, -0.06], 0.02), { bone: 0, color: WHITE, pos: [0.04, -0.335, F - 0.016], mirror: 0, outline: 0.35 });
  // Hörner auf den oberen Kanten, Zacken an den unteren, eine Spitze oben
  b.put(cone(0.075, 0.3, 8), { bone: 0, color: I_TURQ, pos: [0.22, 0.38, 0], aim: [0.55, 1, 0], mirror: 0 });
  b.put(cone(0.06, 0.2, 4), { bone: 0, color: I_TURQ, pos: [0, 0.58, 0], scale: [1, 1, 0.45] });
  const ex = 0.64;
  const ey = KITE_TIP;
  const nl = Math.hypot(ey, ex);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    b.put(cone(0.075, 0.17, 4), {
      bone: 0,
      color: I_TURQ,
      pos: [ex * (1 - t), -ey * t, 0],
      aim: [ey / nl, -ex / nl, 0],
      scale: [1, 1, 0.45],
      mirror: 0,
    });
  }
  // Barteln aus den Mundwinkeln
  b.put(
    sweep(
      [
        [0.29, -0.36, F],
        [0.44, -0.42, F],
        [0.52, -0.56, F],
        [0.45, -0.68, F],
      ],
      (t) => 0.022 - 0.01 * t,
      5,
      10,
    ),
    { bone: 0, color: I_YEL, mirror: 0, outline: 0.6 },
  );
  // Kreuz hinten
  b.put(cyl(0.02, 0.02, 1.58, 5), { bone: 0, color: 0x6b4a2e, pos: [0, -0.2, 0.045], outline: 0.5 });
  b.put(cyl(0.02, 0.02, 1.26, 5), { bone: 0, color: 0x6b4a2e, pos: [0, 0, 0.045], rot: [0, 0, HALF_PI], outline: 0.5 });
  // Schwanz: Schnur je Knochen, an jedem Gelenk eine Schleife
  for (let i = 1; i < KITE_BONES; i++) {
    b.put(cyl(0.012, 0.012, KITE_STEP, 4), { bone: i, color: I_INK, pos: [0, -KITE_STEP / 2, 0], outline: 0.35 });
    const k = 1 - (i - 1) * 0.07;
    const color = i % 2 === 0 ? I_YEL : I_TURQ;
    const at = i === KITE_BONES - 1 ? -KITE_STEP : 0;
    if (i > 1 || at !== 0) {
      b.put(prism([0, 0, 0.15, 0.08, 0.15, -0.08], 0.025), { bone: i, color, pos: [0, at, 0], scale: k, mirror: i, outline: 0.6 });
      b.put(sphere(0.035, 0.035, 0.025, 6, 4), { bone: i, color, pos: [0, at, 0], scale: k, outline: 0.5 });
    }
    if (i === KITE_BONES - 1)
      b.put(prism([0, 0, 0.15, 0.08, 0.15, -0.08], 0.025), { bone: i, color: I_YEL, scale: k, mirror: i, outline: 0.6 });
  }
  kiteGeo = b.finish();
  return kiteGeo;
}

let leashGeo: THREE.BufferGeometry | null = null;
let leashMat: THREE.MeshBasicMaterial | null = null;

/** Gesten beim Einsetzen. Schlüsselbilder je Zeile: Anteil der Dauer, dann
 *  rechte Hand relativ zur Schulter (raus in Metern; hoch, vor in Metern für
 *  einen Arm von 0,5 m), Oberkörper (vorbeugen, eindrehen = rechte Schulter vor,
 *  nach rechts kippen) und Kopf (nicken). */
interface Gesture {
  dur: number;
  keys: readonly number[];
  /** Loslassen (Anteil der Dauer); −1: bleibt in der Hand und verpufft. */
  release: number;
  /** Flug nach dem Loslassen: raus, hoch, vor in m/s, Schwerkraft, Dauer. */
  fly?: readonly [number, number, number, number, number];
  /** Verpuffen in der Hand: von, bis (Anteil). */
  vanish?: readonly [number, number];
}

const KEY = 8;
/** Grundhaltung: Item neben dem Kopf (raus in Metern, hoch/vor für einen Arm von 0,5 m). */
const HOLD: V3 = [0.3, 0.3, 0.06];
/** Grundhaltung im Drachenzug: Hand an der Leine, vorn oben. */
const LEASH: V3 = [0.2, 0.16, 0.34];

const G_THROW: Gesture = {
  dur: 0.5,
  // prettier-ignore
  keys: [
    0, ...HOLD, 0, 0, 0, 0,
    0.3, 0.28, 0.32, -0.26, -0.12, -0.5, 0.06, -0.15,
    0.44, 0.1, 0.2, 0.34, 0.2, 0.4, -0.02, 0.15,
    0.62, 0.04, 0.04, 0.4, 0.24, 0.45, 0, 0.18,
    1, 0.14, 0.1, 0.24, 0, 0, 0, 0,
  ],
  release: 0.44,
  fly: [-1.6, 1.6, 9, 0, 0.15],
};
const G_BACK: Gesture = {
  dur: 0.55,
  // prettier-ignore
  keys: [
    0, ...HOLD, 0, 0, 0, 0,
    0.22, 0.12, 0.18, 0.3, 0.16, 0.3, 0, 0.12,
    0.46, 0.2, 0.44, -0.16, -0.16, -0.4, 0.06, -0.22,
    0.66, 0.26, 0.3, -0.3, -0.1, -0.45, 0.06, -0.1,
    1, 0.16, 0.1, 0.06, 0, 0, 0, 0,
  ],
  release: 0.46,
  fly: [0.6, 2.4, -5.5, 14, 0.2],
};
const GESTURES: (Gesture | null)[] = [
  null,
  // Zisch: Flasche hochreißen, Korken knallt, dann ducken in den Schub
  {
    dur: 0.6,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.18, 0.2, 0.5, 0.06, -0.14, 0, -0.06, -0.3,
      0.36, 0.2, 0.48, 0.06, -0.1, 0, -0.04, -0.25,
      0.6, 0.1, 0.12, 0.26, 0.32, 0, 0, 0.3,
      1, 0.12, 0.06, 0.22, 0, 0, 0, 0,
    ],
    release: -1,
    vanish: [0.3, 0.42],
  },
  G_THROW, // Rollreifen
  G_BACK, // Ölfleck
  G_THROW, // Brummkreisel
  // Stoßfänger: in die Knie, dann nach oben stoßen
  {
    dur: 0.5,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.2, 0.28, 0.1, 0.1, 0.06, 0, 0.1, 0.06,
      0.38, 0.2, 0.54, 0.06, -0.16, 0, -0.06, -0.28,
      0.6, 0.2, 0.46, 0.05, -0.08, 0, 0, -0.14,
      1, 0.16, 0.1, 0.1, 0, 0, 0, 0,
    ],
    release: 0.38,
    fly: [0, 6, 0.5, 0, 0.15],
  },
  // Kurzschluss: Stecker in den Himmel recken
  {
    dur: 0.6,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.18, 0.18, 0.56, 0.1, -0.2, 0, -0.08, -0.36,
      0.7, 0.18, 0.56, 0.1, -0.2, 0, -0.08, -0.36,
      1, 0.16, 0.1, 0.1, 0, 0, 0, 0,
    ],
    release: -1,
    vanish: [0.7, 0.86],
  },
  G_BACK, // Nebelkerze
  // Roboter: hochhalten und kräftig aufs Armaturenbrett drücken – das Blechspielzeug verpufft, das Kart verwandelt sich
  {
    dur: 0.5,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.18, 0.2, 0.46, 0.06, -0.1, 0, -0.06, -0.16,
      0.42, 0.34, -0.08, 0.04, 0.24, 0, 0.24, 0.24,
      0.62, 0.32, -0.04, 0.04, 0.18, 0, 0.18, 0.18,
      1, 0.18, 0.08, 0.08, 0, 0, 0, 0,
    ],
    release: -1,
    vanish: [0.46, 0.58],
  },
  // Abschleppdrache: ausholen, nach vorn-oben werfen, dann an die Leine
  {
    dur: 0.5,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.16, 0.22, 0.16, -0.18, -0.08, -0.3, 0, -0.05,
      0.3, 0.12, 0.5, 0.26, 0.14, 0.25, -0.04, -0.28,
      0.55, 0.18, 0.3, 0.32, -0.12, 0.1, 0, -0.2,
      1, ...LEASH, -0.2, 0, 0, -0.14,
    ],
    release: 0.3,
    fly: [-0.5, 5, 6, 0, 0.15],
  },
  // Rakete: hochreißen und aufs Armaturenbrett schlagen – die kleine Rakete verpufft, das Kart beginnt sich zu verwandeln
  {
    dur: 0.45,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.3, 0.16, 0.6, 0.08, -0.18, 0, -0.06, -0.34,
      0.55, 0.1, -0.05, 0.3, 0.2, 0, 0.1, 0.25,
      1, 0.14, 0.08, 0.2, 0, 0, 0, 0,
    ],
    release: -1,
    vanish: [0.5, 0.62],
  },
  // Gleiter: hoch über den Kopf werfen – er klappt auf und wird zu den großen Flügeln am Kart
  {
    dur: 0.5,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.2, 0.2, 0.2, -0.05, 0.1, 0, 0.04, 0.1,
      0.42, 0.14, 0.62, 0.08, -0.2, 0, -0.08, -0.36,
      0.7, 0.16, 0.5, 0.06, -0.1, 0, 0, -0.2,
      1, 0.16, 0.1, 0.1, 0, 0, 0, 0,
    ],
    release: 0.42,
    fly: [0, 7, 0.5, 0, 0.25],
  },
  // Get Gold: keine Geste – das Austrinken folgt dem Spielstand (pose.drink, siehe planItem und drinkHands).
  null,
  // Bohrer: ebenso – das Einstecken folgt dem Spielstand (pose.plant, siehe planItem und plantHands).
  null,
  // Kleber: die Tube über die Schulter nach hinten werfen – hinten klappt die Klebepistole aus
  G_BACK,
];

// ───────────────────────────── Get Gold ─────────────────────────────
//
// Austrinken: Die Figur nimmt die Flasche in beide Hände, setzt sie an den Mund, kippt sie (Kopf in den Nacken), setzt ab
// und wirft sie über die Schulter weg. Danach wird alles gold – vom Mund aus breitet sich die Farbe über Figur und Kart
// aus; im Gold läuft ab und zu ein Glanzstreifen darüber. Kein eigener Shader: Die Eckenfarben des Netzes werden
// umgeschrieben (Gold = Helligkeit der Originalfarbe auf einer Goldskala), dazu ein goldenes Glimmen (emissive).

/** Mund im Raum des Kopfknochens, je Figur (dort sitzt beim Trinken der Flaschenhals). */
const MOUTH: readonly V3[] = [
  [0, 0.17, 0.37],
  [0, 0.17, 0.42],
  [0, 0.16, 0.36],
  [0, 0.14, 0.3],
];
/** Flasche beim Trinken: Maßstab, Höhe des Griffs und des Halses über dem Boden der Flasche (Meter bei Maßstab 1). */
const DRINK_SCALE = 1.3;
const DRINK_GRIP = 0.16;
const DRINK_NECK = 0.37;
/** So weit darf sich ein Arm beim Trinken strecken (Vielfaches seiner Länge) – Gummiarme, aber nicht endlos. */
const DRINK_STRETCH = 1.3;
/** Anteile des Austrinkens: Flasche loslassen (Wurf über die Schulter). */
const DRINK_THROW = 0.84;
/** Goldskala: Schatten, Mitte, Licht, Glanz (Farben als lineares RGB). */
const GOLD_RAMP = [rgb(0x4e2a02), rgb(0xc27a0c), rgb(0xffc93a), rgb(0xffeaa0)];
/** Ausbreiten und Zurückweichen der Goldfarbe (Sekunden), Breite der Front (Anteil des Wegs). */
const GOLD_IN = 0.5;
const GOLD_OUT = 0.45;
const GOLD_EDGE = 0.22;
/** Glanzstreifen: alle so viele Sekunden, so lange, so breit (Meter). */
const GLINT_EVERY = 1.7;
const GLINT_DUR = 0.42;
const GLINT_W = 0.26;

/** Goldfarbe zu einer Eckenfarbe (lineares RGB): Helligkeit auf der Goldskala, dunkle Teile bleiben dunkles Gold. */
function goldOf(r: number, g: number, b: number, out: Float32Array, o: number): void {
  const v = Math.sqrt(Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b));
  const x = clamp(0.06 + v * 1.12, 0, 1) * (GOLD_RAMP.length - 2);
  const i = Math.min(GOLD_RAMP.length - 3, Math.floor(x));
  const f = x - i;
  const a = GOLD_RAMP[i];
  const c = GOLD_RAMP[i + 1];
  out[o] = a[0] + (c[0] - a[0]) * f;
  out[o + 1] = a[1] + (c[1] - a[1]) * f;
  out[o + 2] = a[2] + (c[2] - a[2]) * f;
}

function smooth01(x: number): number {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
}

/** Schießt etwas über 1 hinaus und federt zurück. */
function easeOutBack(x: number): number {
  const c = clamp(x, 0, 1) - 1;
  return 1 + 2.70158 * c * c * c + 1.70158 * c * c;
}

// ───────────────────────────── KartVisual ─────────────────────────────

// Zwischenspeicher für update() – dort wird nichts neu angelegt.
const _sh = new THREE.Vector3();
const _hd = new THREE.Vector3();
const _el = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _iv = new THREE.Vector3();
const _iw = new THREE.Vector3();
const _iq = new THREE.Quaternion();
const _ie = new THREE.Euler();
const _ik = new Float32Array(KEY);
const _dv = new THREE.Vector3();
const _dg = new THREE.Vector3();
const _dc = new THREE.Vector3();
const _dx = new THREE.Vector3();
const _rv = new THREE.Vector3();
const _pm = new THREE.Matrix4();
const _pp = new THREE.Vector3();
const _pq = new THREE.Quaternion();
const _ps = new THREE.Vector3();
const _pk = new Float32Array(PLANT_KEY);
// Roboter (moveRobot): Drehungen, Punkte und eine Matrix im Raum des Karts
const _rq = new THREE.Quaternion();
const _rq2 = new THREE.Quaternion();
const _rq3 = new THREE.Quaternion();
const _rm = new THREE.Matrix4();
const _rm2 = new THREE.Matrix4();
const _re = new THREE.Euler();
const _rp = new THREE.Vector3();
const _rf = new THREE.Vector3();
const _rh = new THREE.Vector3();
const _ra = new THREE.Vector3();
const _rd = new THREE.Vector3();
const _rx = new THREE.Vector3();
const _ry = new THREE.Vector3();
const _rz = new THREE.Vector3();
const _rk = new THREE.Vector3();

export class KartVisual {
  /** Wurzel: Position/Ausrichtung setzt das Spiel. */
  readonly root = new THREE.Group();
  /** Punkte im Koordinatensystem von root für Effekte (Funken, Flammen, Staub). */
  readonly anchors = {
    wheelRearL: new THREE.Vector3(),
    wheelRearR: new THREE.Vector3(),
    wheelFrontL: new THREE.Vector3(),
    wheelFrontR: new THREE.Vector3(),
    exhaustL: new THREE.Vector3(),
    exhaustR: new THREE.Vector3(),
    head: new THREE.Vector3(),
    /** Kleber: Mündung der Klebepistole (nur gültig, solange sie ausgeklappt ist). */
    gunMuzzle: new THREE.Vector3(),
  };
  /** Roboter: zählt die Schritte (jeder aufgesetzte Fuß) – das Spiel lässt dort Staub aufwirbeln. */
  robotSteps = 0;
  /**
   * Cockpit-Ansicht des eigenen Karts: Kopf und Kugelhände sind ausgeblendet (die Kamera sitzt im Kopf, die
   * Handschuhe zeichnet firstPerson.ts), Item-Gesten nehmen die Fassungen, die man aus dem Fahrersitz sieht.
   */
  firstPerson = false;
  private fpWas = false;
  private fpSteerK = 0;
  /** Roboter: wo der letzte Fuß aufgesetzt hat (Raum von root). */
  readonly robotFoot = new THREE.Vector3();

  /** Figur und Kartform (0..3, siehe DRIVER_NAMES). */
  readonly character: number;
  /** Spielerplatz (0..3): Lackfarbe und Startnummer (slot + 1). */
  readonly slot: number;
  private readonly spec: Spec;
  private readonly paint: Paint;
  private detail: KartDetail;
  private readonly bones: THREE.Bone[] = [];
  private readonly rest: THREE.Matrix4[] = [];
  private readonly restPos = new Float32Array(BONE_COUNT * 3);
  private readonly restRot = new Float32Array(BONE_COUNT * 3);
  private readonly skeleton: THREE.Skeleton;
  private readonly toon: THREE.MeshToonMaterial;
  private readonly flameMat: THREE.MeshBasicMaterial;
  private readonly decalMat: THREE.MeshBasicMaterial;
  private readonly atlas: THREE.CanvasTexture | null;
  private readonly body: THREE.SkinnedMesh;
  private readonly fx: THREE.SkinnedMesh;
  private readonly flames: THREE.SkinnedMesh;
  /** Das Netz der Flammen zeigt an Land die Flammen, unter Wasser den Blasenstrahl. */
  private flameGeo: THREE.BufferGeometry | null = null;
  private jetGeo: THREE.BufferGeometry | null = null;
  private readonly decals: THREE.SkinnedMesh;
  private bodyOutline: THREE.SkinnedMesh | null = null;
  private fxOutline: THREE.SkinnedMesh | null = null;
  /** Roboter-Beine und -Arme, Klebepistole, Kleckse: eigenes Netz am selben Skelett, nur sichtbar, solange etwas davon gebraucht wird. */
  private readonly extra: THREE.SkinnedMesh;
  private extraOutline: THREE.SkinnedMesh | null = null;
  private readonly geos: THREE.BufferGeometry[] = [];
  /** uv der Augen innerhalb ihrer Zelle (0..1) und ihre erste Ecke im Aufkleber-Netz. */
  private eyeUv = new Float32Array(0);
  private eyeStart = 0;
  private eyeState = -1;

  // Bewegungszustand
  private time = 0;
  private seed: number;
  private lastSpeed = 0;
  private accel = 0;
  private wheelF = 0;
  private wheelR = 0;
  private driftS = 0;
  private roll = 0;
  private rollV = 0;
  private pitch = 0;
  private pitchV = 0;
  private lean = 0;
  private headX = 0;
  private headXV = 0;
  private headZ = 0;
  private headZV = 0;
  private headY = 0;
  private boostS = 0;
  private airS = 0;
  private winS = 0;
  private loseS = 0;
  private stallS = 0;
  private spinS = 0;
  private offS = 0;
  private armsUp = 0;
  private flameS = 0;
  private sq = 0;
  private sqV = 0;
  private guardS = 0;
  private guardV = 0;
  private blinkT = 2;
  // Nachschwingen von Zubehör: straff (Ohren, Antennen) und weich (Schal, Schwanz)
  private swayX = 0;
  private swayXV = 0;
  private swayZ = 0;
  private swayZV = 0;
  private flopX = 0;
  private flopXV = 0;
  private flopZ = 0;
  private flopZV = 0;
  // Zwischenwerte für die Ankerpunkte
  private aCd = 1;
  private aSd = 0;
  private aCs = 1;
  private aSs = 0;
  // Werte des laufenden Bildes, die sich die Teilschritte von update() teilen
  private fDt = 0;
  private fSteer = 0;
  private fStage = 0;
  private fSpin = 0;
  private fV = 0;
  private fV1 = 0;
  private fWind = 0;
  private fSpinYaw = 0;
  private fDriftYaw = 0;
  private fHop = 0;
  private fIdle = 1;
  private fCough = 0;
  private fHeld = 0;
  private fTow = false;
  private fGlide = false;
  // Gleitflug: Ausklappen (0 eingeklappt … 1 offen, linear in der Zeit), Haltung, Schräglage, Räder
  private wingU = 0;
  private glideS = 0;
  private bank = 0;
  private wheelV = 0;
  private propA = 0;
  // Tauchen: Ausrüstung (0 … 1, linear in der Zeit), Schwimmhaltung, Blasenstrahl, Schrauben
  private fDive = false;
  private diveU = 0;
  private diveS = 0;
  private swimS = 0;
  private jetS = 0;
  private dPropA = 0;
  // Raum: Ausrüstung (0 … 1, linear in der Zeit), geglättet, in der Luft; träge Antenne
  private fSpace = false;
  private spaceU = 0;
  private spaceS = 0;
  private spaceAir = 0;
  private antX = 0;
  private antXV = 0;
  private antZ = 0;
  private antZV = 0;

  // Item in der Hand: eigenes Netz am Karosserie-Knochen, Geometrie wird getauscht
  private readonly prop: THREE.Mesh;
  private readonly propLine: THREE.Mesh;
  /** Welcher Gegenstand gerade im Netz steckt (0 = keiner). */
  private propItem = 0;
  /** Aufploppen mit Überschwinger. */
  private propS = 0;
  private propV = 0;
  private propSpin = 0;
  /** Rechte Hand: 0 am Lenkrad … 1 beim Item. */
  private holdW = 0;
  /** Gewicht der Leinen-Haltung im Drachenzug. */
  private towW = 0;
  // Ziel der rechten Hand (relativ zur Schulter, geglättet) und Zusätze für Oberkörper/Kopf
  private hOut = HOLD[0];
  private hUp = HOLD[1];
  private hFwd = HOLD[2];
  private gTx = 0;
  private gTy = 0;
  private gTz = 0;
  private gHx = 0;
  /** Ziel und tatsächliche Lage der rechten Hand im Raum der Karosserie. */
  private readonly handT = new THREE.Vector3();
  private readonly handP = new THREE.Vector3();
  // Laufende Geste
  private gItem = 0;
  private gT = -1;
  /** Gegenstand ist losgelassen oder verpufft. */
  private gDone = false;
  /** Flugzeit nach dem Loslassen (−1 = nicht im Flug). */
  private gFly = -1;
  private readonly flyP = new THREE.Vector3();
  private readonly flyV = new THREE.Vector3();
  private flyG = 0;
  private flyDur = 0;

  // Get Gold: Austrinken laut Spielstand (0..1, 0 = nicht), beidhändige Haltung (geglättet), Flasche (Mitte, Achse vom
  // Boden zum Hals, Neigung, Hand am Mund), Ziel der linken Hand; die Flasche ist geworfen.
  private fDrink = 0;
  private drinkW = 0;
  private drinkTilt = 0;
  private drinkRaise = 0;
  private drinkThrown = false;
  private readonly gripP = new THREE.Vector3();
  private readonly gripU = new THREE.Vector3(0, 1, 0);
  private readonly handTL = new THREE.Vector3();

  // Bohrer: Einstecken laut Spielstand (0..1, 0 = nicht), Gewicht der Haltung (geglättet), Griff und Ausrichtung des
  // Bohrers im Raum der Karosserie, sein Maßstab, die Drehung des Bohrkopfs; im letzten Bild wurde noch eingesteckt.
  private fPlant = 0;
  private plantW = 0;
  private readonly plantP = new THREE.Vector3();
  private readonly plantQ = new THREE.Quaternion();
  private plantS = 1;
  private plantSpin = 0;
  private plantWas = false;
  // Gold: Ziel, Anteil (0..1, linear in der Zeit), zuletzt gezeigter Stand der Farben, Farben (Original, Gold) und
  // Abstand jeder Ecke vom Mund (0..1, für die Ausbreitung) sowie ihre Lage längs des Glanzstreifens.
  private fGold = false;
  private fGoldBlink = false;
  private goldU = 0;
  private goldShown = 0;
  private goldGlint = -1;
  private goldBase: Float32Array | null = null;
  private goldCol: Float32Array | null = null;
  private goldD: Float32Array | null = null;
  private goldA: Float32Array | null = null;
  // … und für die Gliedmaßen des Roboters im Zusatz-Netz: Originalfarben, Gold (Klebepistole und Kleckse behalten ihre
  // Farbe), zuletzt gezeigter Stand.
  private exBase: Float32Array | null = null;
  private exGold: Float32Array | null = null;
  private exShown = 0;

  // Rakete: Hüllenteile, Düsenfeuer, Stand der Verwandlung
  private readonly rocketForm = new THREE.Group();
  private readonly rocketMeshes: THREE.Mesh[] = [];
  private readonly rocketFlame: THREE.Mesh;
  private fRocket = 0;
  private fRocketFlame = 0;
  private rocketSpin = 0;
  /** Schwebeband: wie weit die Räder weggeklappt sind (0 … 1). */
  private fHover = 0;
  private rocketWas = false;

  // Roboter: Sekunden seit dem Auslösen (laut Spiel); ob gerade etwas davon zu sehen ist; Einklappen nach Abbruch (1 … 0);
  // Anteile beim Aus- und Einklappen je Teil (RK_…); Neigung, die der Fahrer ausgleicht; Lage des Beckens. Je Bein: steht
  // es gerade (seit welchem Aufsatz), Drehpunkt des Fußes auf der Fahrbahn, Sprunggelenk beim Abheben (relativ zur Hüfte)
  // und im letzten Bild; Drehungen von Oberschenkel, Unterschenkel und Fuß im Raum des Karts; Stützstellen des Schwungs.
  private fRobot = 0;
  private robWas = false;
  private robFade = 0;
  private readonly robK = new Float32Array(RK_COUNT);
  private robLean = 0;
  private robRise = 0;
  private readonly robPelvisQ = new THREE.Quaternion();
  private readonly robStand = [false, false];
  private readonly robTd = [0, 0];
  private readonly robPivot = new Float32Array(6);
  private readonly robOff = new Float32Array(ROBOT_OFF0);
  private readonly robAnk = new Float32Array(6);
  private readonly robQ0 = new THREE.Quaternion();
  private readonly robQ1 = new THREE.Quaternion();
  private readonly robQ2 = new THREE.Quaternion();
  private readonly robTmp = new Float32Array(4 * SWING_N);

  // Kleber: Pistole (Sekunden seit dem Auslösen, Ziel, wie weit ausgeklappt, Ausrichtung) und Kleckse (Restzeit, Aufploppen).
  private fGun = 0;
  private fGunAim: THREE.Vector3 | null = null;
  private gunOut = 0;
  private gunYaw = 0;
  private gunPitch = 0.3;
  private fGlue = 0;
  private glueU = 0;
  private glueLast = 0;

  // Abschleppdrache: eigenes Netz mit kleinem Skelett (Drache + Schwanz) und Leine
  private readonly kite: THREE.SkinnedMesh;
  private readonly kiteOutline: THREE.SkinnedMesh | null;
  private readonly kiteBones: THREE.Bone[] = [];
  private readonly kiteSkeleton: THREE.Skeleton;
  private readonly leash: THREE.Mesh;
  /** Zeit seit dem Aufsteigen (−1 = nicht in der Luft). */
  private kiteT = -1;
  /** Zeit seit dem Ende des Zugs (−1 = kein Abflug). */
  private kiteEnd = -1;
  /** Start- bzw. Abflugpunkt im Raum von root. */
  private readonly kiteFrom = new THREE.Vector3();

  /**
   * character wählt Figur und Kart, slot den Platz: Lackfarbe und Startnummer.
   * Ohne slot fährt die Figur in ihrer angestammten Farbe.
   */
  constructor(character: number, detail: KartDetail = 2, slot: number = character) {
    const wrap = (n: number): number => (Number.isFinite(n) ? ((Math.floor(n) % 4) + 4) % 4 : 0);
    this.character = wrap(character);
    this.slot = wrap(slot);
    this.spec = SPECS[this.character];
    this.paint = PAINTS[this.slot];
    this.detail = detail;
    // Zufallsfolge (Blinzeln) je Platz – zwei gleiche Figuren blinzeln nicht im Gleichtakt.
    this.seed = (this.slot + 1) * 7919;
    this.root.name = `kart-${this.slot}`;

    this.makeBones();
    this.skeleton = new THREE.Skeleton(this.bones);

    this.toon = toonMaterial({ vertexColors: true });
    this.flameMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.atlas = makeAtlas(this.character, this.slot);
    this.decalMat = new THREE.MeshBasicMaterial({ map: this.atlas, alphaTest: 0.5 });

    const empty = new THREE.BufferGeometry();
    const bind = new THREE.Matrix4();
    const mesh = (mat: THREE.Material, name: string): THREE.SkinnedMesh => {
      const m = new THREE.SkinnedMesh(empty, mat);
      m.name = name;
      m.matrixAutoUpdate = false;
      m.boundingSphere = BOUNDS.clone();
      m.bind(this.skeleton, bind);
      this.root.add(m);
      return m;
    };
    this.body = mesh(this.toon, 'kart');
    this.decals = mesh(this.decalMat, 'decals');
    this.fx = mesh(this.toon, 'fx');
    this.flames = mesh(this.flameMat, 'flames');
    this.fx.visible = false;
    this.extra = mesh(this.toon, 'extra');
    this.extra.visible = false;
    this.flames.visible = false;
    this.flames.renderOrder = 2;
    empty.dispose();

    // Item in der Hand: hängt an der Karosserie, macht so Drift und Schleudern mit.
    const items = getItemGeos();
    this.prop = new THREE.Mesh(items[0].main, this.toon);
    this.prop.name = 'item';
    this.prop.visible = false;
    this.propLine = new THREE.Mesh(items[0].line ?? items[0].main, outlineMaterial());
    this.propLine.name = 'outline';
    this.propLine.matrixAutoUpdate = false;
    this.prop.add(this.propLine);
    this.bones[B.chassis].add(this.prop);

    // Abschleppdrache samt Schwanz-Kette
    const kg = getKiteGeo();
    for (let i = 0; i < KITE_BONES; i++) {
      const bone = new THREE.Bone();
      if (i === 0) this.root.add(bone);
      else {
        bone.position.set(0, i === 1 ? -KITE_TIP : -KITE_STEP, 0);
        this.kiteBones[i - 1].add(bone);
      }
      this.kiteBones.push(bone);
    }
    this.kiteSkeleton = new THREE.Skeleton(
      this.kiteBones,
      KITE_REST.map((m) => m.clone().invert()),
    );
    this.kite = new THREE.SkinnedMesh(kg.main, this.toon);
    this.kite.name = 'kite';
    this.kite.matrixAutoUpdate = false;
    this.kite.boundingSphere = KITE_BOUNDS.clone();
    this.kite.bind(this.kiteSkeleton, bind);
    this.kite.visible = false;
    this.root.add(this.kite);
    this.kiteOutline = kg.outline ? withSkinnedOutline(this.kite, kg.outline) : null;
    if (this.kiteOutline) this.kiteOutline.boundingSphere = KITE_BOUNDS.clone();
    if (!leashGeo) {
      leashGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
      leashGeo.translate(0, 0.5, 0);
      leashMat = new THREE.MeshBasicMaterial({ color: INK });
    }
    this.leash = new THREE.Mesh(leashGeo, leashMat!);
    this.leash.name = 'leash';
    this.leash.visible = false;
    this.leash.frustumCulled = false;
    this.root.add(this.leash);

    // Rakete: Hüllenteile (geteilt je Lackfarbe) und Düsenfeuer
    this.rocketForm.name = 'rocket';
    this.rocketForm.visible = false;
    for (const piece of rocketPieces(this.slot)) {
      const m = new THREE.Mesh(piece.geo.main, this.toon);
      m.visible = false;
      if (piece.geo.line) {
        const line = new THREE.Mesh(piece.geo.line, outlineMaterial());
        line.name = 'outline';
        m.add(line);
      }
      this.rocketMeshes.push(m);
      this.rocketForm.add(m);
    }
    this.rocketFlame = new THREE.Mesh(getRocketFlameGeo(), this.flameMat);
    this.rocketFlame.position.set(0, -0.12, 0);
    this.rocketFlame.renderOrder = 2;
    this.rocketFlame.visible = false;
    this.rocketForm.add(this.rocketFlame);
    this.root.add(this.rocketForm);

    this.rebuild();
    this.placeAnchors();
  }

  /** Stauchen und Strecken auslösen: amount > 0 staucht (Landung, Treffer), < 0 streckt (Schubbeginn). */
  squash(amount: number): void {
    if (amount !== amount) return;
    this.sq = clamp(amount, -1, 1);
    this.sqV = 0;
  }

  /**
   * Das Item wurde in diesem Moment eingesetzt: passende Bewegung abspielen.
   * Das Spiel ruft das auf, wenn die Hand laut pose.held schon leer ist –
   * welcher Gegenstand fliegt, kommt deshalb von hier.
   */
  useItem(item: number): void {
    // (Get Gold und der Bohrer haben keine Geste: Austrinken und Einstecken kommen aus dem Spielstand.)
    if (!(item >= 1 && item < I_COUNT) || item === I_GOLD || item === I_DRILL) return;
    this.gItem = Math.floor(item);
    this.gT = 0;
    this.gDone = false;
    // Ein noch fliegender Gegenstand der vorigen Geste ist damit weg.
    if (this.gFly >= 0) {
      this.gFly = -1;
      this.propS = 0;
    }
  }

  /** Wie gold das Kart gerade gezeigt wird (0 … 1) – für Tests. */
  get goldLook(): number {
    return this.goldShown;
  }

  /** Roboter: wie weit das Kart gerade verwandelt gezeigt wird (0 … 1, Beine) – für Tests. */
  get robotLook(): number {
    return this.robWas ? clamp(Math.min(this.robK[RK_THIGH], this.robK[RK_SHIN]), 0, 1) : 0;
  }

  /** Kleber: wie weit die Pistole ausgeklappt ist (0 … 1) und wie groß die Kleckse gerade sind (0 … 1) – für Tests. */
  get gunLook(): number {
    return clamp(this.gunOut, 0, 1);
  }

  get glueLook(): number {
    return clamp(this.bones[B.glueHead].scale.x, 0, 1);
  }

  setDetail(detail: KartDetail): void {
    if (detail === this.detail) return;
    this.detail = detail;
    this.rebuild();
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
    this.toon.dispose();
    this.flameMat.dispose();
    this.decalMat.dispose();
    this.atlas?.dispose();
    this.skeleton.dispose();
    this.kiteSkeleton.dispose();
    this.root.removeFromParent();
    // Die Kontur-Materialien gehören toon.ts (dort geteilt) und bleiben bestehen,
    // ebenso die Netze der Items, des Drachens und der Leine (alle Karts teilen sie).
  }

  // ── Aufbau ──

  private makeBones(): void {
    const sp = this.spec;
    for (let i = 0; i < BONE_COUNT; i++) this.bones.push(new THREE.Bone());
    const set = (i: number, parent: number, pos: V3, rot?: V3): void => {
      const bone = this.bones[i];
      bone.position.set(pos[0], pos[1], pos[2]);
      if (rot) bone.rotation.set(rot[0], rot[1], rot[2]);
      if (parent < 0) this.root.add(bone);
      else this.bones[parent].add(bone);
    };
    const sx = sp.shoulder[0];
    const sy = sp.hip[1] + sp.shoulder[1];
    const sz = sp.hip[2] + sp.shoulder[2];
    set(B.spin, -1, [0, 0, 0]);
    set(B.drift, B.spin, [0, 0, 0]);
    set(B.chassis, B.drift, [0, 0, 0]);
    set(B.wFL, B.drift, [sp.wf.x, sp.wf.r, sp.wf.z]);
    set(B.wFR, B.drift, [-sp.wf.x, sp.wf.r, sp.wf.z]);
    set(B.wRL, B.drift, [sp.wr.x, sp.wr.r, sp.wr.z]);
    set(B.wRR, B.drift, [-sp.wr.x, sp.wr.r, sp.wr.z]);
    set(B.steer, B.chassis, sp.steer, [Math.PI + sp.steerTilt, 0, 0]);
    set(B.torso, B.chassis, sp.hip);
    set(B.head, B.torso, [0, sp.torsoLen, 0.015]);
    set(B.earL, B.head, sp.ear, [0, 0, -sp.earTilt]);
    set(B.earR, B.head, [-sp.ear[0], sp.ear[1], sp.ear[2]], [0, 0, sp.earTilt]);
    // Arme hängen an der Karosserie und werden pro Bild zwischen Schulter und Hand gespannt.
    set(B.armLU, B.chassis, [sx, sy, sz]);
    set(B.armLF, B.chassis, [sx, sy + sp.upper, sz]);
    set(B.handL, B.chassis, [sx, sy + sp.upper + sp.fore, sz]);
    set(B.armRU, B.chassis, [-sx, sy, sz]);
    set(B.armRF, B.chassis, [-sx, sy + sp.upper, sz]);
    set(B.handR, B.chassis, [-sx, sy + sp.upper + sp.fore, sz]);
    set(B.c0, sp.chainParent, sp.chain);
    set(B.c1, B.c0, sp.chainStep);
    set(B.c2, B.c1, sp.chainStep);
    set(B.c3, B.c2, sp.chainStep);
    set(B.aux0, sp.auxParent, sp.aux);
    set(B.aux1, sp.aux1Parent, sp.aux1);
    const ex = sp.exhaust;
    set(B.flameL, B.chassis, ex, [Math.PI + sp.exhaustUp, 0, 0]);
    set(B.flameR, B.chassis, [-ex[0], ex[1], ex[2]], [Math.PI + sp.exhaustUp, 0, 0]);
    set(B.guard, B.spin, [0, 0.42, 0]);
    set(B.bolt0, B.spin, [0.6, 0.8, 0]);
    set(B.bolt1, B.spin, [-0.6, 0.8, 0]);
    set(B.puff0, B.spin, sp.smoke);
    set(B.puff1, B.spin, sp.smoke);
    const wg = sp.wing;
    set(B.wingL, B.chassis, wg);
    set(B.wingR, B.chassis, [-wg[0], wg[1], wg[2]]);
    set(B.tipL, B.wingL, [sp.wingTip, 0, 0]);
    set(B.tipR, B.wingR, [-sp.wingTip, 0, 0]);
    set(B.wtail, B.chassis, sp.wingTail);
    set(B.dHead, B.head, sp.diveHead);
    const db = sp.diveBody;
    const dp = sp.diveProp;
    set(B.dBody, B.chassis, db);
    set(B.dPropL, B.dBody, [dp[0] - db[0], dp[1] - db[1], dp[2] - db[2]]);
    set(B.dPropR, B.dBody, [-dp[0] - db[0], dp[1] - db[1], dp[2] - db[2]]);
    for (let i = 0; i < 3; i++) set(B.bub0 + i, B.chassis, [0, 1.2, -0.3]);
    set(B.jetL, B.chassis, ex, [Math.PI + sp.exhaustUp, 0, 0]);
    set(B.jetR, B.chassis, [-ex[0], ex[1], ex[2]], [Math.PI + sp.exhaustUp, 0, 0]);
    set(B.sHead, B.head, sp.spaceHelm);
    set(B.sPack, B.torso, sp.spacePack);
    set(B.sAnt, B.sPack, sp.spaceAnt);
    set(B.sBody, B.chassis, [0, 0, 0]);
    const sl = sp.spaceLamp;
    set(B.sLamp, B.sBody, [sl[0], sl[1] + 0.055, sl[2]]);
    const jf = sp.spaceJetF;
    const jr = sp.spaceJetR;
    set(B.sJet0, B.chassis, [jf[0] + 0.01, jf[1], jf[2]]);
    set(B.sJet1, B.chassis, [-jf[0] - 0.01, jf[1], jf[2]]);
    set(B.sJet2, B.chassis, [jr[0] + 0.01, jr[1], jr[2]]);
    set(B.sJet3, B.chassis, [-jr[0] - 0.01, jr[1], jr[2]]);
    // Roboter: Becken unter dem Heck, daran die Beine (Hüfte, Knie, Sprunggelenk, Ballen); Arme an den Schultern der
    // Karosserie (Schulter, Ellbogen, Handgelenk)
    const pv = robotPelvis(sp);
    const sh = robotShoulder(sp);
    set(B.rPelvis, B.chassis, pv);
    set(B.rThighL, B.rPelvis, [ROBOT_HIP_X, 0, 0]);
    set(B.rThighR, B.rPelvis, [-ROBOT_HIP_X, 0, 0]);
    set(B.rShinL, B.rThighL, [0, -ROBOT_THIGH, 0]);
    set(B.rShinR, B.rThighR, [0, -ROBOT_THIGH, 0]);
    set(B.rFootL, B.rShinL, [0, -ROBOT_SHIN, 0]);
    set(B.rFootR, B.rShinR, [0, -ROBOT_SHIN, 0]);
    set(B.rToeL, B.rFootL, [0, -ROBOT_ANKLE + 0.05, ROBOT_BALL]);
    set(B.rToeR, B.rFootR, [0, -ROBOT_ANKLE + 0.05, ROBOT_BALL]);
    set(B.rArmL, B.chassis, sh);
    set(B.rArmR, B.chassis, [-sh[0], sh[1], sh[2]]);
    set(B.rForeL, B.rArmL, [0, -ROBOT_UPPER, 0]);
    set(B.rForeR, B.rArmR, [0, -ROBOT_UPPER, 0]);
    set(B.rHandL, B.rForeL, [0, -ROBOT_FORE, 0]);
    set(B.rHandR, B.rForeR, [0, -ROBOT_FORE, 0]);
    // Kleber: Pistole am Heck; Kleckse vorn am Kopf (über den Augen) und auf der Haube vor dem Lenkrad (zur Fahrt hin gekippt)
    set(B.gun, B.chassis, GUN_AT[this.character]);
    const mo = MOUTH[this.character];
    set(B.glueHead, B.head, [0.03, mo[1] + 0.16, mo[2] - 0.06]);
    set(B.glueBody, B.chassis, [0.06, sp.steer[1] - 0.04, sp.steer[2] + 0.3], [-0.95, 0, 0]);
    this.bones[B.gun].rotation.order = 'YXZ';
    this.bones[B.wFL].rotation.order = 'YXZ';
    this.bones[B.wFR].rotation.order = 'YXZ';
    // Flügel: erst um die eigene Längsachse verwinden, dann V-Stellung, dann nach hinten anklappen.
    this.bones[B.wingL].rotation.order = 'YZX';
    this.bones[B.wingR].rotation.order = 'YZX';

    this.root.updateMatrixWorld(true);
    for (let i = 0; i < BONE_COUNT; i++) {
      const bone = this.bones[i];
      this.rest.push(bone.matrixWorld.clone());
      this.restPos[i * 3] = bone.position.x;
      this.restPos[i * 3 + 1] = bone.position.y;
      this.restPos[i * 3 + 2] = bone.position.z;
      this.restRot[i * 3] = bone.rotation.x;
      this.restRot[i * 3 + 1] = bone.rotation.y;
      this.restRot[i * 3 + 2] = bone.rotation.z;
    }
    // Eingeklappt: Flügel und Leitwerk auf null geschrumpft (erst nach der Ruhelage, sonst stimmt die Bindung nicht).
    this.bones[B.wingL].scale.setScalar(0);
    this.bones[B.wingR].scale.setScalar(0);
    this.bones[B.wtail].scale.setScalar(0);
    // Ebenso die Tauchausrüstung (Veras Brille ist immer da und klappt nur herunter).
    this.hideDive();
    this.hideSpace();
    // … Becken (samt Beinen) und Arme des Roboters, die Klebepistole und die Kleckse.
    for (const i of [B.rPelvis, B.rArmL, B.rArmR, B.gun, B.glueHead, B.glueBody]) this.bones[i].scale.setScalar(0);
  }

  private hideSpace(): void {
    const bn = this.bones;
    bn[B.sHead].scale.setScalar(0);
    bn[B.sPack].scale.setScalar(0);
    bn[B.sBody].scale.setScalar(0);
    for (let i = 0; i < 4; i++) bn[B.sJet0 + i].scale.setScalar(0);
  }

  private hideDive(): void {
    const bn = this.bones;
    if (this.character === 1) bn[B.dHead].rotation.x = 0;
    else bn[B.dHead].scale.setScalar(0);
    bn[B.dBody].scale.setScalar(0);
    for (let i = 0; i < 3; i++) bn[B.bub0 + i].scale.setScalar(0);
    bn[B.jetL].scale.setScalar(0);
    bn[B.jetR].scale.setScalar(0);
  }

  /** Baut alle Netze für die aktuelle Detailstufe neu. */
  private rebuild(): void {
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
    const lines = this.detail > 0;
    const main = new Builder(this.rest, this.detail, lines);
    const decal = new Builder(this.rest, this.detail, false, true);
    const ctx: Ctx = {
      b: main,
      d: decal,
      sp: this.spec,
      p: this.paint,
      native: this.character === this.slot,
      eyeStart: 0,
    };
    BUILDERS[this.character](ctx);
    WING_BUILDERS[this.character](ctx);
    DIVE_BUILDERS[this.character](ctx);
    diveBubbles(main);
    SPACE_BUILDERS[this.character](ctx);
    // Roboter und Kleber: ein eigenes Netz, das nur gezeichnet wird, solange es gebraucht wird – sonst kostet es nichts.
    const ex = new Builder(this.rest, this.detail, lines);
    const exCtx: Ctx = { ...ctx, b: ex };
    buildRobot(exCtx);
    buildGlueGun(exCtx);
    buildGlueSplats(exCtx);
    const fx = new Builder(this.rest, this.detail, lines);
    buildFx(fx, this.paint.base);
    const fl = new Builder(this.rest, this.detail, false);
    buildFlames(fl);
    const jt = new Builder(this.rest, this.detail, false);
    buildJets(jt);

    const mainGeo = main.finish();
    const fxGeo = fx.finish();
    const exGeo = ex.finish();
    this.geos.push(exGeo.main);
    this.extra.geometry = exGeo.main;
    this.extraOutline = this.swapOutline(this.extra, this.extraOutline, exGeo.outline);
    const decalGeo = decal.finish().main;
    const flameGeo = fl.finish().main;
    this.flameGeo = flameGeo;
    this.jetGeo = jt.finish().main;
    this.geos.push(mainGeo.main, fxGeo.main, decalGeo, flameGeo, this.jetGeo);
    this.body.geometry = mainGeo.main;
    this.fx.geometry = fxGeo.main;
    this.decals.geometry = decalGeo;
    this.flames.geometry = flameGeo;
    this.decals.visible = this.atlas !== null;
    this.propLine.visible = lines;
    if (this.kiteOutline) this.kiteOutline.visible = lines;

    this.bodyOutline = this.swapOutline(this.body, this.bodyOutline, mainGeo.outline);
    this.fxOutline = this.swapOutline(this.fx, this.fxOutline, fxGeo.outline);

    // uv der Augen innerhalb ihrer Zelle merken (setEyes rechnet daraus die Zelle im Bild aus).
    const n = this.detail === 0 ? 2 : 4;
    const eyeVerts = (n + 1) * (n + 1) * 2;
    const uv = decalGeo.getAttribute('uv');
    this.eyeStart = ctx.eyeStart;
    this.eyeUv = new Float32Array(eyeVerts * 2);
    for (let i = 0; i < eyeVerts; i++) {
      this.eyeUv[i * 2] = uv.getX(this.eyeStart + i);
      this.eyeUv[i * 2 + 1] = uv.getY(this.eyeStart + i);
    }
    const state = this.eyeState < 0 ? EYE.OPEN : this.eyeState;
    this.eyeState = -1;
    this.setEyes(state);
    this.prepareGold();
  }

  /** Goldfarben zum neu gebauten Netz: Gold je Ecke, Abstand vom Mund, Lage längs des Glanzstreifens. */
  private prepareGold(): void {
    const geo = this.body.geometry;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = col.count;
    const base = new Float32Array(col.array as Float32Array);
    const gold = new Float32Array(n * 3);
    const dist = new Float32Array(n);
    const along = new Float32Array(n);
    const sp = this.spec;
    const m = MOUTH[this.character];
    const mx = 0;
    const my = sp.hip[1] + sp.torsoLen + m[1];
    const mz = sp.hip[2] + m[2];
    let far = 1e-3;
    for (let i = 0; i < n; i++) {
      goldOf(base[i * 3], base[i * 3 + 1], base[i * 3 + 2], gold, i * 3);
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // (Weiter unten zählt etwas mehr: die Farbe läuft am Fahrer herab und dann übers Kart.)
      const d = Math.hypot(x - mx, (y - my) * 1.25, z - mz);
      dist[i] = d;
      if (d > far) far = d;
      // Glanzstreifen: schräg von vorn unten nach hinten oben
      along[i] = z * 0.62 - y * 0.78;
    }
    for (let i = 0; i < n; i++) dist[i] /= far;
    this.goldBase = base;
    this.goldCol = gold;
    this.goldD = dist;
    this.goldA = along;
    // Neu gebaut, also in den Originalfarben: beim nächsten Bild wird der Stand wieder hergestellt.
    this.goldShown = 0;
    this.goldGlint = -1;
    // Zusatz-Netz: nur die Ecken an Knochen des Roboters werden gold.
    const ex = this.extra.geometry;
    const exCol = ex.getAttribute('color') as THREE.BufferAttribute;
    const exSkin = ex.getAttribute('skinIndex') as THREE.BufferAttribute;
    const eb = new Float32Array(exCol.array as Float32Array);
    const eg = new Float32Array(eb);
    for (let i = 0; i < exCol.count; i++) {
      const bone = exSkin.getX(i);
      if ((bone >= B.rThighL && bone <= B.rArmR) || bone >= B.rPelvis) goldOf(eb[i * 3], eb[i * 3 + 1], eb[i * 3 + 2], eg, i * 3);
    }
    this.exBase = eb;
    this.exGold = eg;
    this.exShown = 0;
  }

  /**
   * Färbt das Netz: k = 0 Original … 1 ganz gold (dazwischen breitet sich das Gold vom Mund aus); glint = Lage des
   * Glanzstreifens (Meter, −99 = keiner).
   */
  private paintGold(k: number, glint: number): void {
    const base = this.goldBase;
    const gold = this.goldCol;
    const dist = this.goldD;
    const along = this.goldA;
    if (!base || !gold || !dist || !along) return;
    const attr = this.body.geometry.getAttribute('color') as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    const n = dist.length;
    const hi = GOLD_RAMP[3];
    if (k <= 0) out.set(base);
    else if (k >= 1 && glint < -50) out.set(gold);
    else {
      const front = k * (1 + GOLD_EDGE);
      for (let i = 0; i < n; i++) {
        let w = k >= 1 ? 1 : clamp((front - dist[i]) / GOLD_EDGE, 0, 1);
        w = w * w * (3 - 2 * w);
        const o = i * 3;
        let r = base[o] + (gold[o] - base[o]) * w;
        let g = base[o + 1] + (gold[o + 1] - base[o + 1]) * w;
        let b = base[o + 2] + (gold[o + 2] - base[o + 2]) * w;
        // Die Front selbst leuchtet hell auf.
        let shine = k < 1 ? Math.max(0, 1 - Math.abs(front - GOLD_EDGE * 0.5 - dist[i]) / (GOLD_EDGE * 0.5)) * 0.5 : 0;
        if (glint > -50) shine = Math.max(shine, Math.max(0, 1 - Math.abs(along[i] - glint) / GLINT_W) * w);
        if (shine > 0) {
          r += (hi[0] - r) * shine;
          g += (hi[1] - g) * shine;
          b += (hi[2] - b) * shine;
        }
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
      }
    }
    attr.needsUpdate = true;
    // Gliedmaßen des Roboters: ohne Ausbreitung und Glanz, nur der Anteil.
    const eb = this.exBase;
    const eg = this.exGold;
    const ek = clamp(k, 0, 1);
    if (eb && eg && ek !== this.exShown) {
      const ea = this.extra.geometry.getAttribute('color') as THREE.BufferAttribute;
      const eo = ea.array as Float32Array;
      for (let i = 0; i < eo.length; i++) eo[i] = eb[i] + (eg[i] - eb[i]) * ek;
      ea.needsUpdate = true;
      this.exShown = ek;
    }
  }

  private swapOutline(
    mesh: THREE.SkinnedMesh,
    old: THREE.SkinnedMesh | null,
    geo: THREE.BufferGeometry | null,
  ): THREE.SkinnedMesh | null {
    if (!geo) {
      // Ohne Kontur ganz aus dem Baum nehmen, damit sie niemand versehentlich einblendet.
      if (old) mesh.remove(old);
      return null;
    }
    this.geos.push(geo);
    if (old) {
      old.geometry = geo;
      if (old.parent !== mesh) mesh.add(old);
      return old;
    }
    const outline = withSkinnedOutline(mesh, geo);
    outline.boundingSphere = BOUNDS.clone();
    return outline;
  }

  private setEyes(state: number): void {
    if (state === this.eyeState) return;
    this.eyeState = state;
    const attr = this.decals.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const arr = attr.array as Float32Array;
    const col = state % ATLAS_COLS;
    const row = Math.floor(state / ATLAS_COLS);
    const src = this.eyeUv;
    const o = this.eyeStart * 2;
    for (let i = 0; i < src.length; i += 2) {
      arr[o + i] = (col + src[i]) / ATLAS_COLS;
      arr[o + i + 1] = 1 - (row + 1 - src[i + 1]) / ATLAS_ROWS;
    }
    attr.needsUpdate = true;
  }

  // ── Bewegung ──

  /** Pro Bild: Räder drehen/einschlagen, Karosserie neigt sich, Figur lebt. */
  update(dtSec: number, pose: KartPose): void {
    const dt = dtSec > 0 ? Math.min(dtSec, 0.05) : 0;
    this.fDt = dt;
    this.time += dt;

    // — Eingaben (NaN abfangen) —
    const speed = pose.speed === pose.speed ? pose.speed : 0;
    const steer = clamp(pose.steer === pose.steer ? pose.steer : 0, -1, 1);
    const drift = pose.driftDir > 0 ? 1 : pose.driftDir < 0 ? -1 : 0;
    const spin = clamp(pose.spin === pose.spin ? pose.spin : 0, 0, 1);
    const v = Math.min(Math.abs(speed) / 26, 1.35);
    const v1 = Math.min(v, 1);
    this.fSteer = steer;
    this.fStage = clamp(pose.driftStage === pose.driftStage ? pose.driftStage : 0, 0, 3);
    this.fSpin = spin;
    this.fV = v;
    this.fV1 = v1;
    this.fWind = v1 * v1 * (3 - 2 * v1);
    // Ältere Aufrufer kennen held/tow nicht (undefined → 0/false, NaN → 0).
    const held = pose.held;
    this.fHeld = held >= 1 && held < I_COUNT ? Math.floor(held) : 0;
    this.fTow = pose.tow === true;
    // Ältere Aufrufer kennen glide nicht (undefined → false).
    const glide = pose.glide === true;
    this.fGlide = glide;
    const dive = pose.dive === true;
    this.fDive = dive;
    const space = pose.space === true;
    this.fSpace = space;
    const rocket = pose.rocket ?? 0;
    this.fRocket = rocket === rocket ? clamp(rocket, 0, 1) : 0;
    const rf = pose.rocketFlame ?? 0;
    this.fRocketFlame = rf === rf ? clamp(rf, 0, 1) : 0;
    const hv = pose.hover ?? 0;
    this.fHover = hv === hv ? clamp(hv, 0, 1) : 0;
    const dk = pose.drink ?? 0;
    this.fDrink = dk === dk ? clamp(dk, 0, 1) : 0;
    const pl = pose.plant ?? 0;
    this.fPlant = pl === pl ? clamp(pl, 0, 1) : 0;
    this.fGold = pose.gold === true;
    this.fGoldBlink = pose.goldBlink === true;
    const rb = pose.robot ?? 0;
    this.fRobot = rb === rb ? Math.max(0, rb) : 0;
    const gg = pose.glueGun ?? 0;
    this.fGun = gg === gg ? Math.max(0, gg) : 0;
    this.fGunAim = pose.glueAim ?? null;
    const gl = pose.glue ?? 0;
    this.fGlue = gl === gl ? Math.max(0, gl) : 0;

    // — geglättete Größen —
    if (dt > 0) this.accel = damp(this.accel, clamp((speed - this.lastSpeed) / dt, -45, 45), 7, dt);
    this.lastSpeed = speed;
    this.boostS = damp(this.boostS, pose.boost ? 1 : 0, 9, dt);
    this.airS = damp(this.airS, pose.air ? 1 : 0, 10, dt);
    this.winS = damp(this.winS, pose.emote === 'win' ? 1 : 0, 8, dt);
    this.loseS = damp(this.loseS, pose.emote === 'lose' ? 1 : 0, 5, dt);
    this.stallS = damp(this.stallS, pose.stall ? 1 : 0, 10, dt);
    this.spinS = damp(this.spinS, spin > 0 ? 1 : 0, 12, dt);
    this.offS = damp(this.offS, pose.offroad ? 1 : 0, 8, dt);
    this.driftS = damp(this.driftS, drift, 9, dt);
    // Im Gleitflug bleiben die Hände am Lenkrad – gesteuert wird ja weiter.
    // Unter Wasser schwebt die Figur mit Schwimmzügen statt hochgerissener Arme.
    // Im Raum hält sie sich in der Luft am Lenkrad fest.
    this.armsUp = damp(this.armsUp, (pose.air && !glide && !dive && !space) || pose.emote === 'win' ? 1 : pose.stall ? 0.5 : 0, 10, dt);
    this.wingU = glide ? Math.min(1, this.wingU + dt / 0.25) : Math.max(0, this.wingU - dt / 0.2);
    this.glideS = damp(this.glideS, glide ? 1 : 0, 6, dt);
    // In die Kurve legen: etwa 0,35 rad bei vollem Einschlag
    // Im Raum dreht sich das Kart in der Luft mit der Lenkung leicht um die Längsachse.
    this.bank = damp(this.bank, glide ? steer * 0.35 : space && pose.air ? steer * 0.22 : 0, space && !glide ? 3 : 5, dt);
    // Räder laufen in der Luft langsam aus und drehen bei der Landung sofort wieder mit.
    // Unter Wasser drehen sie gemächlicher.
    this.wheelV = glide ? damp(this.wheelV, 0, 0.8, dt) : dive ? speed * 0.55 : speed;
    // Unter Wasser keine Flammen – dort bläst der Schub einen Blasenstrahl.
    const flame = pose.boost && !dive;
    this.flameS = damp(this.flameS, flame ? 1 : 0, flame ? 18 : 11, dt);
    this.diveU = dive ? Math.min(1, this.diveU + dt / 0.25) : Math.max(0, this.diveU - dt / 0.2);
    this.diveS = damp(this.diveS, dive ? 1 : 0, 4, dt);
    this.swimS = damp(this.swimS, dive && pose.air ? 1 : 0, 6, dt);
    this.jetS = damp(this.jetS, dive && pose.boost ? 1 : 0, pose.boost ? 14 : 9, dt);
    this.spaceU = space ? Math.min(1, this.spaceU + dt / 0.3) : Math.max(0, this.spaceU - dt / 0.2);
    this.spaceS = damp(this.spaceS, space ? 1 : 0, 4, dt);
    this.spaceAir = damp(this.spaceAir, space && pose.air ? 1 : 0, 6, dt);
    // In die Kurve legen – aus dem Cockpit viel weniger: Die Kamera sitzt im Kopf, mit der Neigung rutschte sie seitlich
    // weg, und das Lenkrad stünde im Drift weit neben der Bildmitte.
    this.lean = damp(this.lean, (steer * 0.2 * (0.3 + 0.7 * v1) + this.driftS * 0.22) * (1 - (1 - COCKPIT_DRIFT[2]) * this.fpSteerK), 8, dt);

    // Nachschwingen: seitlich (Kurve) und längs (Beschleunigung)
    const latT = -(steer * v1 + this.driftS * 0.5);
    const lonT = clamp(-this.accel * 0.02, -0.5, 0.5);
    // Geringe Schwerkraft: alles federt weicher und langsamer nach (ohne Raum genau 1).
    const soft = 1 - 0.55 * this.spaceS;
    const slow = 1 - 0.35 * this.spaceS;
    this.swayXV += ((latT - this.swayX) * 150 * soft - this.swayXV * 9 * slow) * dt;
    this.swayX += this.swayXV * dt;
    this.swayZV += ((lonT - this.swayZ) * 150 * soft - this.swayZV * 9 * slow) * dt;
    this.swayZ += this.swayZV * dt;
    this.flopXV += ((latT - this.flopX) * 46 * soft - this.flopXV * 4.5 * slow) * dt;
    this.flopX += this.flopXV * dt;
    this.flopZV += ((lonT - this.flopZ) * 46 * soft - this.flopZV * 4.5 * slow) * dt;
    this.flopZ += this.flopZV * dt;
    // Antenne: sehr weiche Feder, die Landungen spürt sie als Wippen
    if (this.spaceU > 0) {
      const ak = 30 * soft;
      const ac = 2.2 * slow;
      this.antXV += ((latT * 0.5 - this.antX) * ak - this.antXV * ac) * dt;
      this.antX += this.antXV * dt;
      this.antZV += ((lonT * 0.6 - this.sq * 0.5 - this.antZ) * ak - this.antZV * ac) * dt;
      this.antZ += this.antZV * dt;
    }

    // Die Teilschritte lesen ihre Werte aus den Feldern – so wandern keine
    // Fließkommazahlen als Argumente durch die Aufrufe.
    this.moveWheels();
    this.foldWheels();
    this.moveBody();
    this.moveRobot();
    this.planItem();
    this.moveDriver();
    this.moveExtras();
    this.moveEffects(pose.guard);
    this.moveWings();
    this.moveDive();
    this.moveSpace();
    this.moveItem();
    this.moveRocket();
    this.moveGold();
    this.moveGlue();
    this.extra.visible = this.robWas || this.gunOut > 0.0005 || this.bones[B.glueHead].scale.x > 0;
    this.pickEyes(pose);
    this.placeAnchors();
    if (this.firstPerson || this.fpWas) {
      // (Auf fast null, nicht null: so bleiben die Matrizen umkehrbar.)
      const s = this.firstPerson ? 1e-4 : 1;
      this.bones[B.head].scale.setScalar(s);
      this.bones[B.handL].scale.setScalar(s);
      this.bones[B.handR].scale.setScalar(s);
      this.fpWas = this.firstPerson;
    }
  }

  /** Für die Cockpit-Ansicht (firstPerson.ts): die Knochen, an denen Kamera, Handschuhe und Armaturen hängen, und Maße. */
  get cockpit(): CockpitRig {
    const bn = this.bones;
    const sp = this.spec;
    return {
      root: this.root,
      chassis: bn[B.chassis],
      torso: bn[B.torso],
      head: bn[B.head],
      steer: bn[B.steer],
      handL: bn[B.handL],
      handR: bn[B.handR],
      steerR: sp.steerR,
      steerAt: sp.steer,
      hand: sp.hand,
      hip: sp.hip,
      torsoLen: sp.torsoLen,
      holdR: this.holdW,
      holdL: Math.max(this.drinkW, this.armsUp, this.swimS),
      held: this.fHeld,
      gesture: this.gT >= 0 ? this.gItem : 0,
      drink: this.fDrink,
      plant: this.fPlant,
      robot: this.fRobot,
      robotLook: this.robotLook,
      rocket: this.fRocket,
      gold: this.goldLook,
      prop: this.prop,
    };
  }

  /** Gold: ausbreiten, glänzen, blinken, zurückweichen – und ein goldenes Glimmen. */
  private moveGold(): void {
    const dt = this.fDt;
    const t = this.time;
    this.goldU = this.fGold ? Math.min(1, this.goldU + dt / GOLD_IN) : Math.max(0, this.goldU - dt / GOLD_OUT);
    // Kurz vor dem Ende blinkt es (acht Wechsel je Sekunde), sonst zeigt es den Stand der Ausbreitung.
    const k = this.fGold && this.fGoldBlink && Math.floor(t * 8) % 2 === 1 ? 0 : this.goldU;
    let glint = -99;
    if (k >= 1 && !this.fGoldBlink) {
      const ph = (t % GLINT_EVERY) / GLINT_DUR;
      if (ph < 1) glint = -2.4 + ph * 3.6;
    }
    if (k !== this.goldShown || glint !== this.goldGlint) {
      this.paintGold(k, glint);
      this.goldShown = k;
      this.goldGlint = glint;
    }
    // Glimmen: lässt auch die Schattenseite golden wirken; pulsiert sacht.
    const e = this.toon.emissive;
    if (k > 0) {
      const pulse = k * (0.8 + 0.2 * Math.sin(t * 5.3));
      e.setRGB(0.1 * pulse, 0.05 * pulse, 0);
    } else if (e.r !== 0 || e.g !== 0) e.setRGB(0, 0, 0);
  }

  /**
   * Rakete: Räder einklappen, das Kart aufstellen, Hüllenteile nacheinander einrasten lassen, am Ende verschwindet das
   * Kart in der Hülle und die Düse zündet. Überschreibt dafür, was moveWheels/moveBody gesetzt haben.
   */
  private moveRocket(): void {
    const r = this.fRocket;
    const bn = this.bones;
    const rp = this.restPos;
    if (r <= 0) {
      if (this.rocketWas) {
        // Wieder ein Kart: alles, was moveWheels/moveBody nicht selbst jedes Bild setzen, zurück in die Ruhelage.
        this.rocketWas = false;
        this.rocketForm.visible = false;
        bn[B.spin].scale.set(1, 1, 1);
        for (let i = 0; i < 4; i++) bn[B.wFL + i].position.x = rp[(B.wFL + i) * 3];
      }
      return;
    }
    this.rocketWas = true;
    const t = this.time;
    // Räder klappen unter das Kart, es hebt ein Stück ab.
    const fold = smooth01(r / 0.22);
    for (let i = 0; i < 4; i++) {
      const w = bn[B.wFL + i];
      const side = rp[(B.wFL + i) * 3] > 0 ? 1 : -1;
      w.rotation.z = side * fold * HALF_PI;
      w.position.x = rp[(B.wFL + i) * 3] * (1 - 0.32 * fold);
      w.position.y = rp[(B.wFL + i) * 3 + 1] + 0.12 * fold;
    }
    // Aufstellen: die Nase zeigt nach oben, das Heck bleibt über dem Boden.
    const pitch = smooth01((r - 0.14) / 0.34);
    const sb = bn[B.spin];
    sb.rotation.set(-HALF_PI * pitch, 0, 0);
    sb.position.set(0, 0.2 * fold + 1.2 * Math.sin(pitch * HALF_PI), 0.5 * pitch);
    // In der Hülle zusammenrücken und am Ende ganz darin verschwinden.
    const shrink = r >= 0.9 ? 0.0001 : 1 - 0.32 * smooth01((r - 0.45) / 0.35);
    sb.scale.setScalar(shrink);
    this.prop.visible = false;

    // Hüllenteile
    this.rocketForm.visible = r > 0.25;
    const pieces = rocketPieces(this.slot);
    for (let i = 0; i < pieces.length; i++) {
      const pc = pieces[i];
      const m = this.rocketMeshes[i];
      const u = (r - pc.a) / (pc.b - pc.a);
      if (u <= 0) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const e = easeOutBack(u);
      const k = 1 - Math.min(1, e);
      m.position.set(pc.pos[0] + pc.from[0] * k, pc.pos[1] + pc.from[1] * k, pc.pos[2] + pc.from[2] * k);
      m.rotation.set(0, pc.turn + k * 1.2, 0);
      m.scale.setScalar(pc.grow + (1 - pc.grow) * Math.max(0, e));
    }
    // Im Flug dreht sich die Rakete langsam um ihre Achse; das Feuer flackert.
    const flame = this.fRocketFlame;
    this.rocketSpin = flame > 0.5 ? (this.rocketSpin + this.fDt * 3.2) % TAU : this.rocketSpin * Math.max(0, 1 - this.fDt * 4);
    this.rocketForm.rotation.y = this.rocketSpin;
    this.rocketFlame.visible = flame > 0.02;
    if (this.rocketFlame.visible) {
      const fl = 0.85 + 0.15 * Math.sin(t * 61) + 0.1 * hash(Math.floor(t * 40));
      this.rocketFlame.scale.set(flame * (0.9 + 0.1 * Math.sin(t * 47)), flame * fl * (0.6 + 0.6 * flame), flame * (0.9 + 0.1 * Math.cos(t * 43)));
    }
  }

  /**
   * Roboter: Verwandeln (das Kart federt ein, springt hoch, Becken, Beine und Arme klappen der Reihe nach heraus, die Räder
   * wandern an Knie und Schultern), Rennen, Absprung und Zurückklappen im Sprung. Läuft nach moveBody und überschreibt
   * Räder und Karosserie. Alles wird im Raum des Karts (unter dem Drift-Knochen) gerechnet und dann in die Knochen
   * übersetzt; die Beine löst eine Zwei-Knochen-Rechnung (Knie nach vorn), ein aufgesetzter Fuß steht fest auf der Fahrbahn.
   */
  private moveRobot(): void {
    const T = this.fRobot;
    const dt = this.fDt;
    const k = this.robK;
    const L = ROBOT_T_LEAP;
    const at = (a: number, d: number): number => clamp((T - a) / d, 0, 1);
    if (T > 0) {
      // Ausfahren der Reihe nach, jedes Teil rastet mit einem kleinen Überschwinger ein; im Sprung umgekehrt wieder ein.
      const out = (a: number, d: number, b: number, e: number): number => (T < b ? easeOutBack(at(a, d)) : 1 - smooth01(at(b, e)));
      const glide = (a: number, d: number, b: number, e: number): number => (T < b ? smooth01(at(a, d)) : 1 - smooth01(at(b, e)));
      k[RK_BODY] = glide(0.04, 0.2, 1.0, 0.26);
      k[RK_PELVIS] = out(0.03, 0.1, 1.15, 0.1);
      k[RK_THIGH] = out(0.06, 0.12, 1.11, 0.12);
      k[RK_SHIN] = out(0.09, 0.12, 1.08, 0.12);
      k[RK_FOOT] = out(0.13, 0.1, 1.05, 0.1);
      k[RK_REAR] = glide(0.05, 0.16, 1.06, 0.14);
      k[RK_FRONT] = glide(0.13, 0.18, 1.05, 0.16);
      k[RK_UPPER] = out(0.17, 0.12, 1.02, 0.12);
      k[RK_FORE] = out(0.23, 0.1, 0.99, 0.1);
      k[RK_HAND] = out(0.29, 0.1, 0.96, 0.1);
      this.robFade = 1;
    } else if (this.robFade > 0) {
      // Abgebrochen (Treffer) oder früher gelandet: alles klappt zügig ein.
      const was = this.robFade;
      this.robFade = Math.max(0, was - dt / 0.22);
      const f = this.robFade / was;
      for (let i = 0; i < RK_COUNT; i++) k[i] *= f;
    }
    const bn = this.bones;
    const rp = this.restPos;
    let any = 0;
    for (let i = 0; i < RK_COUNT; i++) any = Math.max(any, k[i]);
    if (this.robFade <= 0 || any < 1e-3 || this.fRocket > 0) {
      if (this.robWas) this.robotReset();
      return;
    }
    this.robWas = true;
    const sp = this.spec;
    const ch = bn[B.chassis];
    const fade = this.robFade >= 1;
    // Räder: moveWheels setzt nur Drehung und Höhe – vor dem Mischen auch den Rest der Ruhelage.
    for (let i = 0; i < 4; i++) {
      const o = (B.wFL + i) * 3;
      bn[B.wFL + i].position.x = rp[o];
      bn[B.wFL + i].position.z = rp[o + 2];
    }

    // — Anteile der Bewegungsarten —
    // Laufen (ab dem ersten Schritt), Ducken vor dem Absprung, explosives Strecken, Flug, Anhocken im Sprung.
    const run = T > 0 ? smooth01(at(0.13, 0.1)) : 0;
    const crouch = T > 0 ? smooth01(at(0.68, 0.17)) * (1 - smooth01(at(0.858, 0.035))) : 0;
    const spring = T > 0 ? smooth01(at(0.852, 0.05)) * (1 - smooth01(at(0.99, 0.1))) : 0;
    const airW = T > 0 ? smooth01(at(L - 0.01, 0.05)) : 1;
    const tuck = T > 0 ? smooth01(at(0.97, 0.12)) : 1;
    const S2 = 2 * ROBOT_STEP;
    // Tempo im Raum des Karts (bei Get Gold ist das Kart größer, die Fahrbahn zieht darunter also langsamer durch).
    const sc = Math.abs(this.root.scale.z) > 1e-3 ? Math.abs(this.root.scale.z) : 1;
    const v = Math.max(0, this.lastSpeed) / sc;
    const ts = Math.min(ROBOT_GROUND / Math.max(v, 1e-3), 0.8 * ROBOT_STEP);
    // Schrittphase je Bein (0 = eigener Fußaufsatz) und des ganzen Laufs (0 = irgendein Aufsatz)
    const tauL = (((T - ROBOT_TD0) % S2) + S2) % S2;
    const phL = tauL / S2;
    const tauS = (((T - ROBOT_TD0) % ROBOT_STEP) + ROBOT_STEP) % ROBOT_STEP;
    const stanceS = Math.min(ts / ROBOT_STEP, 0.8);
    // Wippen: im Stand federt das Becken ein, in der Flugphase steigt es.
    const ps = tauS / ROBOT_STEP;
    const bounce = ps < stanceS ? -0.06 * Math.sin((Math.PI * ps) / stanceS) : 0.08 * Math.sin((Math.PI * (ps - stanceS)) / (1 - stanceS));
    // Schwung des linken Arms (+1 vorn): vorn, wenn das linke Bein hinten abgedrückt hat, hinten, wenn sein Knie vorn hochkommt.
    // Die Schultern drehen mit den Armen, das Becken dagegen (die Hüfte des Schwungbeins kommt mit dem Knie nach vorn).
    const sw = Math.cos(TAU * (phL - ROBOT_ARM_PHASE));

    // — Becken (Raum des Karts): Höhe, Kippen nach vorn, Verdrehen zum Schwungbein, Absenken der Schwungseite —
    const hipY = ROBOT_HIP_Y + run * (1 - airW) * bounce - 0.32 * crouch + 0.12 * spring;
    const yawP = 0.15 * sw * run * (1 - airW);
    const rollP = 0.05 * Math.cos(TAU * (phL - 0.06)) * run * (1 - airW);
    this.robPelvisQ.setFromEuler(_re.set(0.1 + 0.12 * crouch - 0.1 * spring, yawP, rollP, 'YXZ'));
    // — Karosserie als Oberkörper: aufgerichtet, nickt mit jedem Schritt, dreht gegen das Becken, legt sich vor dem Absprung vor —
    const pitchUp = ROBOT_PITCH - 0.24 * crouch + 0.2 * spring + 0.035 * Math.sin(TAU * ps) * run * (1 - airW);
    _rq.setFromEuler(_re.set(-pitchUp, -0.09 * sw * run * (1 - airW), -0.035 * Math.cos(TAU * (phL - 0.06)) * run * (1 - airW), 'YXZ'));
    const pk = robotPelvis(sp);
    _rp.set(pk[0], pk[1], pk[2]).applyQuaternion(_rq);
    _rv.set(0, hipY, ROBOT_FWD).sub(_rp);
    // Mischen mit der Lage als Kart (moveBody): erst federt es ein, dann springt es hoch.
    const body = k[RK_BODY];
    ch.position.y -= 0.08 * Math.sin(Math.PI * at(0, 0.1)) * (T > 0 ? 1 : 0);
    ch.position.x = 0;
    ch.position.z = 0;
    ch.position.lerp(_rv, body);
    ch.quaternion.slerp(_rq, body);
    ch.scale.lerp(_rv.set(1, 1, 1), Math.min(1, body * 3));
    ch.updateMatrix();
    this.robLean = (pitchUp * 0.95 + 0.12) * body;
    this.robRise = ROBOT_RISE[this.character] * body;
    // Räder: erst fahren sie mit der Karosserie mit (je mehr die sich hebt), unten wandern sie dann an Knie und Schultern.
    for (let i = 0; i < 4; i++) {
      const w = bn[B.wFL + i];
      _rp.copy(w.position).applyMatrix4(ch.matrix);
      w.position.lerp(_rp, body);
      _rq.copy(ch.quaternion).multiply(w.quaternion);
      w.quaternion.slerp(_rq, body);
    }

    // Becken: an der Karosserie, aber selbst aufrecht.
    const pv = bn[B.rPelvis];
    const gP = robotGrow(k[RK_PELVIS]);
    pv.position.set(pk[0], pk[1] + 0.12 * (1 - Math.min(1, k[RK_PELVIS])), pk[2]);
    _rq2.copy(ch.quaternion).invert().multiply(this.robPelvisQ);
    pv.quaternion.copy(Q_ID).slerp(_rq2, clamp(k[RK_PELVIS], 0, 1));
    pv.scale.setScalar(gP);
    pv.updateMatrix();
    // Becken im Raum des Karts
    _rm.multiplyMatrices(ch.matrix, pv.matrix);
    _rq3.copy(ch.quaternion).multiply(pv.quaternion);

    // — Beine —
    const vt = this.robTmp;
    const gT = robotGrow(k[RK_THIGH]);
    const gS = robotGrow(k[RK_SHIN]);
    const gF = robotGrow(k[RK_FOOT]);
    const legL = ROBOT_THIGH + ROBOT_SHIN;
    // Vorwärts für die Knie: die Blickrichtung des Beckens
    _rf.set(0, 0, 1).applyQuaternion(_rq3);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const thigh = bn[i === 0 ? B.rThighL : B.rThighR];
      const shin = bn[i === 0 ? B.rShinL : B.rShinR];
      const foot = bn[i === 0 ? B.rFootL : B.rFootR];
      const toe = bn[i === 0 ? B.rToeL : B.rToeR];
      // Hüftgelenk im Raum des Karts
      _rh.set(side * ROBOT_HIP_X, 0, 0).applyMatrix4(_rm);
      const td0 = ROBOT_TD0 + i * ROBOT_STEP;
      const tau = (((T - td0) % S2) + S2) % S2;
      const tdNow = T - tau;
      // Der Absprung (fünfter Aufsatz) endet spätestens, wenn das Kart abhebt.
      const tsi = Math.abs(tdNow - (ROBOT_TD0 + 4 * ROBOT_STEP)) < 1e-3 ? Math.min(ts, L - tdNow) : ts;
      const stance = fade && T > 0 && tdNow >= td0 - 1e-4 && tdNow < L - 0.01 && tau < tsi && k[RK_FOOT] > 0.9;
      let pitch: number;
      let bend = 0;
      const o3 = i * 3;
      if (stance) {
        const travel = v * tsi;
        if (!this.robStand[i] || Math.abs(this.robTd[i] - tdNow) > 1e-4) {
          // Aufsetzen: die Ferse kommt so weit vor der Hüfte auf, dass der Fuß um die Mitte unter dem Roboter abrollt.
          this.robStand[i] = true;
          this.robTd[i] = tdNow;
          const ztd = robotHeelAhead(travel);
          this.robPivot[o3] = side * (ROBOT_HIP_X - 0.03);
          this.robPivot[o3 + 1] = 0;
          this.robPivot[o3 + 2] = _rh.z + ztd - v * tau;
          if (run > 0.4) {
            this.robotSteps++;
            bn[B.drift].updateMatrix();
            bn[B.spin].updateMatrix();
            this.robotFoot
              .set(this.robPivot[o3], 0, this.robPivot[o3 + 2] + ROBOT_HEEL)
              .applyMatrix4(bn[B.drift].matrix)
              .applyMatrix4(bn[B.spin].matrix);
          }
        } else {
          this.robPivot[o3 + 2] -= v * dt;
        }
        // Abrollen: Ferse (Zehen leicht hoch) → ganze Sohle → Drehen über den Ballen, die Zehen bleiben flach am Boden.
        const u = tau / tsi;
        let lz: number;
        let pz = this.robPivot[o3 + 2];
        if (u < 0.45) {
          pitch = -0.17 * (1 - smooth01(u / 0.22));
          lz = -ROBOT_HEEL;
        } else {
          pitch = 0.9 * smooth01((u - 0.45) / 0.55);
          lz = ROBOT_BALL;
          pz += ROBOT_HEEL + ROBOT_BALL;
          bend = pitch;
        }
        // Sprunggelenk = Drehpunkt − gedrehter Abstand zum Drehpunkt (Sohle liegt bei −ROBOT_ANKLE)
        const cp = Math.cos(pitch);
        const sn = Math.sin(pitch);
        _ra.set(this.robPivot[o3], ROBOT_ANKLE * cp + lz * sn, pz - (-ROBOT_ANKLE * sn + lz * cp));
      } else {
        if (this.robStand[i]) {
          // Abheben: Lage des Sprunggelenks relativ zur Hüfte merken – dort beginnt der Schwung.
          this.robStand[i] = false;
          this.robOff[i * 2] = this.robAnk[o3 + 2] - _rh.z;
          this.robOff[i * 2 + 1] = this.robAnk[o3 + 1] - _rh.y;
        }
        // Schwung: Ferse hoch zum Gesäß, Knie hoch nach vorn, Unterschenkel streckt sich, Fuß greift zurück zur Fahrbahn.
        const s = clamp((tau - Math.min(tsi, tau)) / (S2 - tsi), 0, 1);
        const ztd = robotHeelAhead(v * ts);
        // Sprunggelenk beim nächsten Fersenaufsatz (Zehen 0,17 rad hoch)
        const c0 = Math.cos(-0.17);
        const s0 = Math.sin(-0.17);
        // Puffer: n Stützstellen je für Anteil, vor/zurück, Höhe, Neigung – vorn das Abheben, hinten der Fersenaufsatz.
        const n = SWING_N;
        vt[0] = 0;
        vt[n] = this.robOff[i * 2];
        vt[2 * n] = this.robOff[i * 2 + 1];
        vt[3 * n] = 0.9;
        for (let j = 1; j < n - 1; j++) {
          vt[j] = SWING_KEYS[j * 4 - 4];
          vt[n + j] = SWING_KEYS[j * 4 - 3] * legL;
          vt[2 * n + j] = SWING_KEYS[j * 4 - 2] * legL;
          vt[3 * n + j] = SWING_KEYS[j * 4 - 1];
        }
        vt[n - 1] = 1;
        vt[2 * n - 1] = ztd + ROBOT_ANKLE * s0 + ROBOT_HEEL * c0;
        vt[3 * n - 1] = ROBOT_ANKLE * c0 - ROBOT_HEEL * s0 - _rh.y;
        vt[4 * n - 1] = -0.17;
        let az = spline(vt, 0, n, n, s);
        let ay = spline(vt, 0, 2 * n, n, s);
        pitch = spline(vt, 0, 3 * n, n, s);
        bend = s < 0.15 ? 0.8 * (1 - smooth01(s / 0.15)) : 0;
        // Absprung: das freie Bein reißt das Knie hoch.
        if (i === 1 && spring > 0) {
          az += (0.32 * legL - az) * spring;
          ay += (-0.46 * legL - ay) * spring;
          pitch += (-0.1 - pitch) * spring;
        }
        _ra.set(_rh.x - side * 0.03, _rh.y + ay, _rh.z + az);
        // Nicht in die Fahrbahn treten
        if (_ra.y < 0.17) _ra.y = 0.17;
      }
      // Im Sprung: das Absprungbein hängt gestreckt nach hinten, das andere bleibt vorn angezogen; dann beide anhocken.
      if (airW > 0) {
        const hz = i === 0 ? -0.42 : 0.3;
        const hy = i === 0 ? -0.7 : -0.46;
        const hp = i === 0 ? 0.9 : -0.1;
        _rk.set(_rh.x - side * 0.03, _rh.y + legL * (hy + (-0.4 - hy) * tuck), _rh.z + legL * (hz + (0.02 - hz) * tuck));
        _ra.lerp(_rk, airW);
        pitch += (hp + (0.35 - hp) * tuck - pitch) * airW;
        bend *= 1 - airW;
      }
      this.robAnk[o3] = _ra.x;
      this.robAnk[o3 + 1] = _ra.y;
      this.robAnk[o3 + 2] = _ra.z;

      // Zwei Knochen: Knie im Abstand ROBOT_THIGH von der Hüfte, nach vorn geknickt
      _rd.subVectors(_ra, _rh);
      let D = _rd.length();
      if (D < 1e-5) _rd.set(0, -1, 0);
      else _rd.multiplyScalar(1 / D);
      D = clamp(D, 0.12, legL * 0.998);
      _rx.crossVectors(_rf, _rd);
      if (_rx.lengthSq() < 1e-8) _rx.set(1, 0, 0);
      _rx.normalize();
      _rz.crossVectors(_rd, _rx);
      const ca = clamp((ROBOT_THIGH * ROBOT_THIGH + D * D - ROBOT_SHIN * ROBOT_SHIN) / (2 * ROBOT_THIGH * D), -1, 1);
      const sa = Math.sqrt(1 - ca * ca);
      // Richtung des Oberschenkels, Knie, Richtung des Unterschenkels
      _ry.copy(_rd).multiplyScalar(ca).addScaledVector(_rz, sa);
      _rk.copy(_rh).addScaledVector(_ry, ROBOT_THIGH);
      _rd.multiplyScalar(D).add(_rh).sub(_rk).normalize();
      // Oberschenkel: Achse x = Kniescharnier, −y entlang des Knochens
      robotBasis(_rx, _ry, this.robQ0);
      robotBasis(_rx, _rd, this.robQ1);
      // Fuß: Neigung im Raum des Karts (nach vorn ausgerichtet), Sprunggelenk begrenzt
      this.robQ2.setFromAxisAngle(X_AXIS, pitch);
      _rq2.copy(this.robQ1).invert().multiply(this.robQ2);
      _re.setFromQuaternion(_rq2, 'XYZ');
      _re.x = clamp(_re.x, -0.75, 1.05);
      _rq2.setFromEuler(_re);
      // In die Knochen: jeweils relativ zum (schon gesetzten) Elternknochen, aus der eingeklappten Lage heraus.
      _rq.copy(_rq3).invert().multiply(this.robQ0);
      thigh.quaternion.copy(R_FOLD_THIGH).slerp(_rq, clamp(k[RK_THIGH], 0, 1));
      thigh.scale.setScalar(robotRatio(gT, gP));
      _rq.copy(this.robQ0).invert().multiply(this.robQ1);
      shin.quaternion.copy(R_FOLD_SHIN).slerp(_rq, clamp(k[RK_SHIN], 0, 1));
      shin.scale.setScalar(robotRatio(gS, gT));
      foot.quaternion.copy(R_FOLD_FOOT).slerp(_rq2, clamp(k[RK_FOOT], 0, 1));
      foot.scale.setScalar(robotRatio(gF, gS));
      toe.quaternion.setFromAxisAngle(X_AXIS, -bend * clamp(k[RK_FOOT], 0, 1));

      // Hinterrad: außen am Knie, die Nabe sitzt auf der Achse des Gelenks und dreht mit dem Unterschenkel (kleiner als am Kart)
      const wr = bn[i === 0 ? B.wRL : B.wRR];
      const kr = k[RK_REAR];
      if (kr > 0) {
        thigh.updateMatrix();
        shin.updateMatrix();
        _rm2.multiplyMatrices(_rm, thigh.matrix).multiply(shin.matrix);
        _rv.set(side * robotKneeWheel(sp), 0, 0).applyMatrix4(_rm2);
        _rq.copy(_rq3).multiply(thigh.quaternion).multiply(shin.quaternion);
        wr.position.lerp(_rv, kr);
        wr.quaternion.slerp(_rq, kr);
        wr.scale.setScalar(1 + (ROBOT_KNEE_WHEEL - 1) * Math.min(1, kr));
      }
    }

    // — Arme: schwingen gegengleich zu den Beinen, Ellbogen angewinkelt; vor dem Absprung nach hinten, dann hochreißen —
    const gU = robotGrow(k[RK_UPPER]);
    const gFo = robotGrow(k[RK_FORE]);
    const gH = robotGrow(k[RK_HAND]);
    const shp = robotShoulder(sp);
    const yawC = _re.setFromQuaternion(ch.quaternion, 'YXZ').y;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      // +1: dieser Arm ist vorn (das Bein derselben Seite hinten)
      const a = (i === 0 ? sw : -sw) * run;
      let sig = 0.2 + 1.0 * a;
      let elb = 1.5 + 0.35 * a;
      const abd = 0.22 + 0.1 * crouch;
      const cross = 0.14 * Math.max(0, a);
      sig += (-1.0 - sig) * crouch;
      elb += (1.25 - elb) * crouch;
      sig += (2.5 - sig) * spring;
      elb += (0.45 - elb) * spring;
      sig += (0.75 - sig) * tuck * airW;
      elb += (1.7 - elb) * tuck * airW;
      _rq.setFromEuler(_re.set(0, yawC - side * cross, side * abd, 'YXZ'));
      _rq2.setFromAxisAngle(X_AXIS, -sig);
      _rq.multiply(_rq2);
      const arm = bn[i === 0 ? B.rArmL : B.rArmR];
      _rq2.copy(ch.quaternion).invert().multiply(_rq);
      arm.quaternion.copy(R_FOLD_ARM).slerp(_rq2, clamp(k[RK_UPPER], 0, 1));
      arm.scale.setScalar(gU);
      const fore = bn[i === 0 ? B.rForeL : B.rForeR];
      _rq2.setFromAxisAngle(X_AXIS, -elb);
      fore.quaternion.copy(R_FOLD_FORE).slerp(_rq2, clamp(k[RK_FORE], 0, 1));
      fore.scale.setScalar(robotRatio(gFo, gU));
      const hand = bn[i === 0 ? B.rHandL : B.rHandR];
      _rq2.setFromAxisAngle(X_AXIS, -0.25 - 0.3 * spring);
      hand.quaternion.copy(R_FOLD_HAND).slerp(_rq2, clamp(k[RK_HAND], 0, 1));
      hand.scale.setScalar(robotRatio(gH, gFo));

      // Vorderrad: Schulterpanzer außen am Schultergelenk, dreht mit dem Oberarm
      const w = bn[i === 0 ? B.wFL : B.wFR];
      const kw = k[RK_FRONT];
      if (kw > 0) {
        _rq.copy(ch.quaternion).multiply(arm.quaternion);
        _rp.set(side * shp[0], shp[1], shp[2]).applyMatrix4(ch.matrix);
        _rv.set(side * (0.12 + sp.wf.w * 0.5 * ROBOT_SHOULDER_WHEEL), 0.04, 0).applyQuaternion(_rq).add(_rp);
        w.position.lerp(_rv, kw);
        w.quaternion.slerp(_rq, kw);
        w.scale.setScalar(1 + (ROBOT_SHOULDER_WHEEL - 1) * Math.min(1, kw));
      }
    }
  }

  /** Roboter vorbei: was moveWheels/moveBody nicht selbst jedes Bild setzen, zurück in die Ruhelage. */
  private robotReset(): void {
    const bn = this.bones;
    const rp = this.restPos;
    this.robWas = false;
    this.robLean = 0;
    this.robRise = 0;
    this.robFade = 0;
    this.robK.fill(0);
    this.robStand[0] = this.robStand[1] = false;
    this.robOff.set(ROBOT_OFF0);
    bn[B.chassis].position.set(0, bn[B.chassis].position.y, 0);
    for (const i of [B.rPelvis, B.rArmL, B.rArmR]) bn[i].scale.setScalar(0);
    for (let i = 0; i < 4; i++) {
      const o = (B.wFL + i) * 3;
      bn[B.wFL + i].position.set(rp[o], rp[o + 1], rp[o + 2]);
      bn[B.wFL + i].scale.set(1, 1, 1);
    }
  }

  /**
   * Kleber: Die Pistole klappt am Heck hoch (mit Überschwinger), schwenkt aufs Ziel, zieht sich zusammen, schießt (Rückstoß)
   * und klappt wieder ein; ihre Mündung steht danach in anchors.gunMuzzle. Getroffen: Kleckse auf Gesicht und Haube ploppen
   * auf, sacken langsam nach unten und schrumpfen in der letzten halben Sekunde weg.
   */
  private moveGlue(): void {
    const bn = this.bones;
    const dt = this.fDt;
    const T = this.fGun;
    const gun = bn[B.gun];
    const fire = GUN_FIRE_AT;
    if (T > 0) this.gunOut = T < GUN_BACK_AT ? easeOutBack(clamp((T - 0.1) / 0.24, 0, 1)) : 1 - smooth01((T - GUN_BACK_AT) / 0.2);
    else this.gunOut = Math.max(0, this.gunOut - dt / 0.15);
    const out = this.gunOut;
    if (out <= 0.0005) {
      if (gun.scale.x !== 0) gun.scale.setScalar(0);
    } else {
      const ch = bn[B.chassis];
      const g = GUN_AT[this.character];
      // Ziel: Richtung im Raum von root → Gierung im Raum der Karosserie (Drift und Schleudern herausgerechnet); dazu ein
      // Bogen nach oben, der mit der Entfernung wächst. Ohne Ziel: gerade nach hinten, leicht nach oben.
      let yaw = 0;
      let pitch = 0.32;
      const aim = this.fGunAim;
      if (aim) {
        this.anchor(_rv, g[0], g[1] + 0.27, g[2]);
        const dx = aim.x - _rv.x;
        const dy = aim.y - _rv.y;
        const dz = aim.z - _rv.z;
        const flat = Math.hypot(dx, dz);
        let yr = Math.atan2(-dx, -dz) - this.fDriftYaw - this.fSpinYaw;
        yr -= Math.round(yr / TAU) * TAU;
        yaw = clamp(yr, -1.2, 1.2);
        pitch = Math.atan2(dy, Math.max(flat, 0.5)) + 0.14 + Math.min(0.3, flat * 0.012);
      }
      this.gunYaw = damp(this.gunYaw, yaw, 12, dt);
      this.gunPitch = damp(this.gunPitch, pitch, 12, dt);
      const aimK = smooth01(clamp((T - 0.24) / 0.12, 0, 1));
      // Zusammenziehen vor dem Schuss, Rückstoß danach
      const squeeze = T < fire ? smooth01(clamp((T - fire + 0.1) / 0.1, 0, 1)) : 0;
      const kick = T >= fire && T < fire + 0.45 ? Math.exp(-(T - fire) * 11) : 0;
      gun.rotation.set(-(1 - out) * HALF_PI * 1.05 + (this.gunPitch * aimK - ch.rotation.x) * Math.min(1, out) + kick * 0.25, this.gunYaw * aimK, 0);
      const o = B.gun * 3;
      gun.position.set(this.restPos[o], this.restPos[o + 1], this.restPos[o + 2] + 0.1 * kick);
      const sc = Math.max(out, 1e-4);
      gun.scale.set(sc * (1 + 0.14 * squeeze - 0.06 * kick), sc * (1 - 0.1 * squeeze + 0.12 * kick), sc * (1 - 0.14 * squeeze + 0.18 * kick));
      gun.updateMatrix();
      ch.updateMatrix();
      bn[B.drift].updateMatrix();
      bn[B.spin].updateMatrix();
      this.anchors.gunMuzzle
        .set(GUN_MUZZLE[0], GUN_MUZZLE[1], GUN_MUZZLE[2])
        .applyMatrix4(gun.matrix)
        .applyMatrix4(ch.matrix)
        .applyMatrix4(bn[B.drift].matrix)
        .applyMatrix4(bn[B.spin].matrix);
    }

    // Kleckse: ein neuer Treffer lässt sie wieder aufploppen
    const left = this.fGlue;
    if (left > this.glueLast + 0.05) this.glueU = 0;
    this.glueLast = left;
    this.glueU = Math.min(1, this.glueU + dt / 0.14);
    const k = left > 0 ? easeOutBack(this.glueU) * Math.min(1, left / 0.45) : 0;
    const hb = bn[B.glueHead];
    if (k <= 0) {
      if (hb.scale.x !== 0) {
        hb.scale.setScalar(0);
        bn[B.glueBody].scale.setScalar(0);
      }
      return;
    }
    const sag = 1 + 0.35 * clamp(1 - left / 4, 0, 1);
    for (const i of [B.glueHead, B.glueBody]) {
      const b = bn[i];
      b.scale.set(k, k * sag, k);
      b.position.y = this.restPos[i * 3 + 1] - 0.04 * (sag - 1);
    }
  }

  /**
   * Schwebeband: Die Räder klappen nach außen waagerecht weg (die Lauffläche zeigt dann nach unten aufs Band) und
   * drehen nicht mehr; vorn schlagen sie trotzdem leicht mit der Lenkung ein. Überschreibt, was moveWheels gesetzt hat.
   */
  private foldWheels(): void {
    const k = smooth01(this.fHover);
    if (k <= 0 || this.fRocket > 0) return;
    const bn = this.bones;
    const rp = this.restPos;
    for (let i = 0; i < 4; i++) {
      const w = bn[B.wFL + i];
      const side = rp[(B.wFL + i) * 3] > 0 ? 1 : -1;
      // (Aus dem Rollen heraus erst zur Ruhe kommen, dann wegklappen – sonst taumelt das Rad.)
      w.rotation.x *= 1 - k;
      w.rotation.z = side * k * HALF_PI;
      w.position.x = rp[(B.wFL + i) * 3] * (1 + 0.18 * k);
      w.position.y = rp[(B.wFL + i) * 3 + 1] + 0.1 * k;
    }
  }

  /** Räder: drehen passend zum Tempo, vorn einschlagen, im Gelände rütteln. */
  private moveWheels(): void {
    const sp = this.spec;
    const bn = this.bones;
    const rp = this.restPos;
    const t = this.time;
    const dt = this.fDt;
    this.wheelF += (this.wheelV * dt) / sp.wf.r;
    this.wheelR += (this.wheelV * dt) / sp.wr.r;
    if (Math.abs(this.wheelF) > 6000) this.wheelF %= TAU;
    if (Math.abs(this.wheelR) > 6000) this.wheelR %= TAU;
    const yawF = -this.fSteer * 0.5 + this.driftS * 0.26;
    const bulge = 1 + Math.max(this.sq, 0) * 0.3;
    const hang = this.airS * 0.035;
    const rough = this.offS * this.fV1;
    for (let i = 0; i < 4; i++) {
      const w = bn[B.wFL + i];
      const front = i < 2;
      w.rotation.set(front ? this.wheelF : this.wheelR, front ? yawF : 0, rough * 0.06 * Math.sin(t * 43 + i * 1.9));
      w.position.y = rp[(B.wFL + i) * 3 + 1] - hang + rough * 0.018 * Math.abs(Math.sin(t * 31 + i * 2.3));
      w.scale.x = bulge;
    }
  }

  /** Karosserie: schleudern, im Drift schräg stellen, rollen, nicken, zittern, stauchen. */
  private moveBody(): void {
    const bn = this.bones;
    const t = this.time;
    const dt = this.fDt;
    const { boostS, airS, winS, stallS, driftS } = this;
    const v1 = this.fV1;
    const spin = this.fSpin;

    // Schleudern: zwei volle Umdrehungen, weich auslaufend
    const e = 1 - spin;
    const spinYaw = spin > 0 ? TAU * 2 * (1 - e * e * e) : 0;
    this.fSpinYaw = spinYaw;
    // Gleitflug: das ganze Kart legt sich in die Kurve, gedreht um einen Punkt
    // auf halber Höhe (nicht um die Radaufstandsfläche).
    const sb = bn[B.spin];
    const bank = this.bank;
    sb.rotation.set(0, spinYaw, bank);
    if (bank !== 0) {
      const h = 0.5 * Math.sin(bank);
      sb.position.set(h * Math.cos(spinYaw), 0.5 - 0.5 * Math.cos(bank), -h * Math.sin(spinYaw));
    } else sb.position.set(0, 0, 0);
    // Drift: Drehung um einen Punkt vorn, damit das Heck ausbricht. (Von hinten soll man das deutlich sehen; aus dem
    // Cockpit drehte damit der ganze Blick weit in die Kurve – dort nur ein kleiner Teil, COCKPIT_DRIFT.)
    const driftYaw = -driftS * (0.31 + 0.04 * this.fStage) * (1 - (1 - COCKPIT_DRIFT[0]) * this.fpSteerK);
    this.fDriftYaw = driftYaw;
    const dr = bn[B.drift];
    dr.rotation.y = driftYaw;
    dr.position.set(-DRIFT_PIVOT * Math.sin(driftYaw), 0, DRIFT_PIVOT - DRIFT_PIVOT * Math.cos(driftYaw));

    const hopPhase = t * 8.5;
    const hop = winS * Math.max(0, Math.sin(hopPhase));
    const idle = (1 - 0.7 * v1) * (1 - stallS);
    const rough = this.offS * v1;
    const cough = stallS * Math.pow(Math.max(0, Math.sin(t * 13)), 8);
    this.fHop = hop;
    this.fIdle = idle;
    this.fCough = cough;

    const rollT = -this.fSteer * v1 * 0.075 * (1 - this.glideS) - driftS * 0.11 + (spin > 0 ? Math.sin(spinYaw) * 0.1 : 0);
    const pitchT = clamp(-this.accel * 0.0035, -0.08, 0.09) - boostS * 0.07 + airS * 0.05 + stallS * 0.03;
    const soft = 1 - 0.55 * this.spaceS;
    const slow = 1 - 0.35 * this.spaceS;
    this.rollV += ((rollT - this.roll) * 140 * soft - this.rollV * 13 * slow) * dt;
    this.roll += this.rollV * dt;
    this.pitchV += ((pitchT - this.pitch) * 140 * soft - this.pitchV * 13 * slow) * dt;
    this.pitch += this.pitchV * dt;
    this.sqV += (-this.sq * 190 * soft - this.sqV * 8.5 * slow) * dt;
    this.sq += this.sqV * dt;
    // Stauchen: Höhe runter, Breite und Länge rauf (Volumen bleibt etwa gleich)
    const sq = clamp(this.sq + winS * 0.1 * Math.cos(hopPhase), -1, 1);
    const sy = sq > 0 ? 1 - 0.36 * sq : 1 - 0.28 * sq;
    const sxz = 1 / Math.sqrt(sy);
    const ch = bn[B.chassis];
    ch.scale.set(sxz, sy, sxz);
    // Unter Wasser wiegt sich das Kart sanft, als trüge es das Wasser.
    const dv = this.diveS;
    const sway = this.slot * 1.3;
    ch.position.y =
      dv * 0.025 * Math.sin(t * 1.7 + sway) +
      Math.sin(t * 61) * 0.0035 * idle +
      cough * 0.012 +
      hop * 0.07 +
      airS * 0.03 +
      rough * 0.02 * Math.sin(t * 33) * Math.sin(t * 21 + 1);
    ch.rotation.set(
      this.pitch + rough * 0.02 * Math.sin(t * 27) + dv * 0.035 * Math.sin(t * 1.25 + sway),
      0,
      this.roll + dv * 0.045 * Math.sin(t * 0.95 + sway + 1) + Math.sin(t * 47 + 2) * 0.006 * idle + cough * 0.03 * Math.sin(t * 90) + rough * 0.025 * Math.sin(t * 19 + 2),
    );
  }

  /** Fahrer: Oberkörper und Kopf lehnen sich in die Kurve, Ohren, Lenkrad, Arme. */
  private moveDriver(): void {
    const sp = this.spec;
    const bn = this.bones;
    const rp = this.restPos;
    const t = this.time;
    const dt = this.fDt;
    const { boostS, airS, winS, loseS, stallS, spinS, driftS, lean } = this;
    const acc = this.accel;
    const steer = this.fSteer;

    const torso = bn[B.torso];
    torso.rotation.set(
      -boostS * 0.16 + clamp(-acc * 0.004, -0.1, 0.12) + loseS * 0.26 - winS * 0.08 - airS * 0.06 + this.glideS * 0.2 + this.swimS * 0.24 + this.spaceAir * 0.16 + this.gTx + this.robLean,
      this.gTy,
      lean + this.gTz,
    );
    // Als Roboter richtet sich der Fahrer im Sitz auf: er ist der Kopf und schaut über die Brust.
    torso.position.y = rp[B.torso * 3 + 1] + this.fHop * 0.04 + this.robRise;
    torso.position.z = rp[B.torso * 3 + 2] + this.robRise * 0.3;
    torso.updateMatrix();

    // Kopf: federt nach, schaut in die Kurve, wird bei Schub nach hinten gedrückt
    const hxT =
      -boostS * 0.3 +
      loseS * 0.55 -
      winS * 0.2 -
      airS * 0.14 +
      clamp(-acc * 0.006, -0.12, 0.15) +
      stallS * 0.08 -
      this.glideS * 0.1 -
      this.swimS * 0.2 +
      this.spaceAir * 0.16 +
      Math.sin(t * 2.1) * 0.02 +
      this.gHx;
    const hzT = lean * 0.7 + stallS * 0.1 * Math.sin(t * 7) + spinS * 0.22 * Math.sin(t * 14);
    const soft = 1 - 0.55 * this.spaceS;
    const slow = 1 - 0.35 * this.spaceS;
    this.headXV += ((hxT - this.headX) * 110 * soft - this.headXV * 9 * slow) * dt;
    this.headX += this.headXV * dt;
    this.headZV += ((hzT - this.headZ) * 110 * soft - this.headZV * 9 * slow) * dt;
    this.headZ += this.headZV * dt;
    // (Aus dem Cockpit schaut die Figur im Drift nur leicht in die Kurve – die Kamera sitzt im Kopf.)
    const driftLook = 0.3 * (1 - (1 - COCKPIT_DRIFT[1]) * this.fpSteerK);
    const hyT =
      (-steer * 0.32 - driftS * driftLook) * (1 - spinS) + stallS * 0.28 * Math.sin(t * 9.5) + loseS * 0.1 * Math.sin(t * 1.3);
    this.headY = damp(this.headY, hyT, 10, dt);
    bn[B.head].rotation.set(this.headX, this.headY, this.headZ);

    // Ohren: legen sich im Fahrtwind an, zucken ab und zu, hängen bei Niederlage
    const twitch = Math.pow(Math.max(0, Math.sin(t * 1.7 + this.slot * 2)), 24);
    // Im Helm liegen die Ohren angelegt.
    const earBack = -0.32 * this.fWind + this.swayZ * 0.5 - airS * 0.15 - this.swimS * 0.25 - this.spaceS * SPACE_EARS[this.character];
    const earOut = sp.earTilt + loseS * 0.55 + stallS * 0.3 - winS * 0.1;
    bn[B.earL].rotation.set(earBack, 0, -earOut + this.swayX * 0.25 - twitch * 0.22);
    bn[B.earR].rotation.set(earBack, 0, earOut + this.swayX * 0.25);

    // Lenkrad dreht mit, die Hände bleiben dran
    const st = bn[B.steer];
    // Cockpit-Ansicht: Das Lenkrad rückt höher und näher zur Figur und steht steiler – aus dem Kopf der großen
    // Comic-Figuren läge es sonst unter dem Bildrand. (Die Arme folgen über solveArm.)
    const fpk = (this.fpSteerK = damp(this.fpSteerK, this.firstPerson ? 1 : 0, 12, dt));
    st.position.set(
      this.restPos[B.steer * 3],
      this.restPos[B.steer * 3 + 1] + COCKPIT_STEER[0] * fpk,
      this.restPos[B.steer * 3 + 2] + COCKPIT_STEER[1] * fpk,
    );
    st.rotation.set(this.restRot[B.steer * 3] + COCKPIT_STEER[2] * fpk, 0, -steer * 1.15 + driftS * 0.35);
    st.updateMatrix();
    // Rechte Hand: Item halten, Geste, Leine – Ziel relativ zur Schulter, mitgedreht mit dem Oberkörper.
    // Seitlich nicht mit der Armlänge skaliert: auch zierliche Figuren halten den Gegenstand neben den Kopf.
    const reach = (sp.upper + sp.fore) / 0.5;
    this.handT
      .set(-(sp.shoulder[0] + this.hOut), sp.shoulder[1] + this.hUp * reach, sp.shoulder[2] + this.hFwd * reach)
      .applyMatrix4(torso.matrix);
    if (this.drinkW > 0.001 || this.fDrink > 0) this.drinkHands();
    if (this.plantW > 0.001 || this.fPlant > 0) this.plantHands();
    this.solveArm(1);
    this.solveArm(-1);
    this.handP.copy(bn[B.handR].position);
  }

  /**
   * Get Gold: Wo die Flasche gerade ist (Mitte gripP, Achse gripU vom Boden zum Hals) und wohin beide Hände greifen.
   * Erst vor die Brust, dann an den Mund (der Hals sitzt dort, auch wenn der Kopf in den Nacken geht), kippen, absetzen.
   */
  private drinkHands(): void {
    const sp = this.spec;
    const bn = this.bones;
    const torso = bn[B.torso];
    const head = bn[B.head];
    const p = this.fDrink;
    const t = this.time;
    const dt = this.fDt;
    // Neigung (0 = aufrecht, π/2 = waagrecht, Hals zum Gesicht) und wie weit die Flasche schon am Mund ist.
    let tilt = 0;
    if (p < 0.22) tilt = 0.75 * smooth01((p - 0.06) / 0.16);
    else if (p < 0.72) tilt = 0.75 + 1.6 * smooth01((p - 0.22) / 0.5);
    else tilt = 2.35 - 1.45 * smooth01((p - 0.72) / 0.1);
    const raise = p > 0 ? smooth01((p - 0.08) / 0.16) * (1 - smooth01((p - 0.74) / 0.1)) : 0;
    this.drinkTilt = p > 0 ? damp(this.drinkTilt, tilt, 25, dt) : damp(this.drinkTilt, 0, 12, dt);
    this.drinkRaise = p > 0 ? damp(this.drinkRaise, raise, 25, dt) : damp(this.drinkRaise, 0, 12, dt);
    const s = DRINK_SCALE;
    // Mund im Raum der Karosserie (der Kopf ist schon gedreht)
    head.updateMatrix();
    const m = MOUTH[this.character];
    _dv.set(m[0], m[1], m[2]).applyMatrix4(head.matrix).applyMatrix4(torso.matrix);
    // Achse der Flasche
    const a = this.drinkTilt;
    this.gripU.set(0, Math.cos(a), -Math.sin(a)).applyQuaternion(torso.quaternion);
    // Griff, wenn der Hals am Mund liegt (beim Gluckern wackelt die Flasche ein wenig) …
    const glug = p > 0.26 && p < 0.72 ? Math.sin(t * 34) * 0.012 : 0;
    _dg.copy(_dv).addScaledVector(this.gripU, -(DRINK_NECK - DRINK_GRIP) * s);
    _dg.y += glug;
    // … und vor der Brust (Anfang und Ende)
    const reach = (sp.upper + sp.fore) / 0.5;
    _dc.set(0, sp.shoulder[1] + 0.02, sp.shoulder[2] + 0.36 * reach).applyMatrix4(torso.matrix);
    this.gripP.lerpVectors(_dc, _dg, this.drinkRaise);
    // Zu weit für die Arme: die Flasche kommt den Schultern entgegen (bis DRINK_STRETCH dürfen sie sich strecken).
    _dx.set(1, 0, 0).applyQuaternion(torso.quaternion);
    const gw = 0.15 * s + sp.hand * 0.55;
    _sh.set(0, sp.shoulder[1], sp.shoulder[2]).applyMatrix4(torso.matrix);
    const arm = (sp.upper + sp.fore) * DRINK_STRETCH;
    const side = Math.max(0, sp.shoulder[0] - gw);
    _dc.subVectors(this.gripP, _sh);
    const fromMid = _dc.length();
    const can = Math.sqrt(Math.max(0, arm * arm - side * side));
    if (fromMid > can) this.gripP.copy(_sh).addScaledVector(_dc, can / fromMid);
    // Beide Hände links und rechts an der Flasche.
    const w = this.drinkW;
    _dc.copy(this.gripP).addScaledVector(_dx, -gw);
    this.handT.lerp(_dc, w);
    this.handTL.copy(this.gripP).addScaledVector(_dx, gw);
  }

  /**
   * Bohrer: Wo der Griff beim Einstecken gerade ist (Schlüsselbilder PLANT_KEYS im Raum des Karts, umgerechnet in den der
   * Karosserie – Drift, Schleudern und Federn eingerechnet) und wie der Bohrer dort steht; die rechte Hand greift zu.
   */
  private plantHands(): void {
    const bn = this.bones;
    const p = this.fPlant;
    const dt = this.fDt;
    if (p > 0) {
      const keys = PLANT_KEYS;
      const n = keys.length / PLANT_KEY;
      let i = 0;
      while (i < n - 2 && keys[(i + 1) * PLANT_KEY] <= p) i++;
      const a = i * PLANT_KEY;
      const b = a + PLANT_KEY;
      let f = clamp((p - keys[a]) / Math.max(keys[b] - keys[a], 1e-6), 0, 1);
      // Hineinrammen: immer schneller (kein Abbremsen vor dem Boden).
      f = i === PLANT_RAM ? f * f * f : smooth01(f);
      for (let k = 1; k < PLANT_KEY; k++) _pk[k] = keys[a + k] + (keys[b + k] - keys[a + k]) * f;
      // Steckt er, zittert er unter dem anlaufenden Motor.
      const buzz = p > 0.93 ? 0.012 * Math.sin(this.time * 83) : 0;
      _pp.set(_pk[1] + buzz, _pk[2], _pk[3] + buzz * 0.7);
      _pq.setFromAxisAngle(_iw.set(0, 0, 1), -_pk[4]);
      this.plantS = _pk[5];
      // Der Motor läuft an: erst kurz vor dem Ende dreht sich der Bohrkopf.
      this.plantSpin = (this.plantSpin + dt * 14 * smooth01((p - 0.86) / 0.14)) % TAU;
      _iq.setFromAxisAngle(_iw.set(0, 1, 0), this.plantSpin);
      _pq.multiply(_iq);
      // Vom Raum des Karts in den der Karosserie
      bn[B.chassis].updateMatrix();
      bn[B.drift].updateMatrix();
      bn[B.spin].updateMatrix();
      _pm.copy(bn[B.spin].matrix).multiply(bn[B.drift].matrix).multiply(bn[B.chassis].matrix).invert();
      this.plantP.copy(_pp).applyMatrix4(_pm);
      _pm.decompose(_dv, this.plantQ, _ps);
      this.plantQ.multiply(_pq);
    }
    // Die Faust sitzt am Griff.
    this.handT.lerp(this.plantP, this.plantW);
  }

  /** Figur-eigenes Zubehör: Motor und Kiefer, Schal, Schnauzbart, Schwanz und Antennen. */
  private moveExtras(): void {
    const bn = this.bones;
    const t = this.time;
    const { airS, winS, loseS, stallS, spinS, swayX, swayZ, flopX, flopZ } = this;
    const wind = this.fWind;
    switch (this.character) {
      case 0: {
        // Motor zittert, Kiefer klappt auf
        const en = bn[B.aux0];
        const cough = this.fCough;
        const shake = 0.35 + this.fIdle * 0.65 + this.boostS * 0.8;
        en.position.y = this.restPos[B.aux0 * 3 + 1] + Math.sin(t * 58) * 0.006 * shake + cough * 0.02;
        en.rotation.z = Math.sin(t * 58 + 1) * 0.022 * shake + cough * 0.06 * Math.sin(t * 80);
        const sip = this.fDrink > 0.2 && this.fDrink < 0.74 ? 0.7 + 0.3 * Math.sin(t * 34) : 0;
        const open = Math.max(winS * (0.55 + 0.45 * Math.sin(t * 17)), stallS * 0.75, airS * 0.6, spinS * 0.7, sip);
        bn[B.aux1].rotation.x = open * 0.42;
        break;
      }
      case 1: {
        // Schal: liegt im Stand auf dem Heck, weht bei Tempo waagrecht und flattert
        for (let i = 0; i < 4; i++) {
          const wave = Math.sin(t * (8 + 10 * wind) - i * 1.15);
          const hangX = (i === 0 ? -0.5 : -0.2) * (1 - wind);
          const rx = (i === 0 ? 0.14 + airS * 0.2 : 0) + hangX + wave * (0.05 + 0.26 * wind) * (i === 0 ? 0.5 : 1) + flopZ * 0.12;
          const ry =
            (i === 0 ? -0.2 : 0) + flopX * (i === 0 ? 0.3 : 0.12) + Math.sin(t * (6 + 7 * wind) - i * 0.9 + 1.7) * 0.16 * wind;
          bn[B.c0 + i].rotation.set(rx, ry, wave * 0.35 * wind);
        }
        break;
      }
      case 2: {
        // Schnauzbart flattert im Fahrtwind
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 1 : -1;
          const flutter = Math.sin(t * 21 + i * 2.1) * 0.07 * wind;
          bn[B.aux0 + i].rotation.set(
            flutter - loseS * 0.12,
            side * (0.32 * wind - swayZ * 0.5) + flutter,
            side * (-loseS * 0.3 + winS * 0.2) + swayX * 0.2,
          );
        }
        break;
      }
      default: {
        // Schwanz: schwingt gemächlich, peitscht in Kurven; Antennen federn
        for (let i = 0; i < 3; i++) {
          const swish = Math.sin(t * 2.6 - i * 0.8) * 0.13 * (1 - 0.5 * wind) + Math.sin(t * 15 - i) * 0.05 * wind;
          bn[B.c0 + i].rotation.set(
            (i === 0 ? -0.22 : -0.1) * wind +
              flopZ * 0.2 +
              loseS * (i === 0 ? -0.3 : -0.16) +
              spinS * 0.15 * Math.sin(t * 20 + i),
            0,
            swish + flopX * 0.14 + stallS * 0.2 * Math.sin(t * 30 + i * 2),
          );
        }
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 1 : -1;
          bn[B.aux0 + i].rotation.set(
            -0.2 - 0.3 * wind + swayZ * 0.9 + stallS * 0.1 * Math.sin(t * 40 + i),
            0,
            -side * 0.3 + swayX * 0.6,
          );
        }
      }
    }
  }

  /** Flammen, Schutzring, Blitze und Qualm. */
  private moveEffects(guard: boolean): void {
    const sp = this.spec;
    const bn = this.bones;
    const t = this.time;
    const dt = this.fDt;
    const stallS = this.stallS;

    // Flammen: pulsieren, werden mit dem Tempo länger
    const fs = this.flameS;
    const wet = this.fDive;
    const fg = wet ? this.jetGeo : this.flameGeo;
    if (fg && this.flames.geometry !== fg) this.flames.geometry = fg;
    this.flames.visible = wet ? this.jetS > 0.02 : fs > 0.03;
    for (let i = 0; i < 2; i++) {
      const flick = 0.85 + 0.22 * Math.sin(t * 71 + i * 2) + 0.12 * Math.sin(t * 173 + i);
      const wide = fs * (0.92 + 0.16 * Math.sin(t * 53 + i * 1.3));
      bn[B.flameL + i].scale.set(wide, wide, fs * flick * (1 + 0.25 * this.fV));
    }

    // Schutzring: ploppt federnd auf, kreist ums Kart. Ausgeblendet wird er
    // zügig und ohne Nachfedern – so blinkt er sauber, wenn das Spiel ihn kurz
    // vor Ablauf im Takt ein- und ausschaltet.
    if (guard) {
      this.guardV += ((1 - this.guardS) * 260 - this.guardV * 15) * dt;
      this.guardS += this.guardV * dt;
    } else {
      this.guardS = damp(this.guardS, 0, 30, dt);
      this.guardV = 0;
    }
    const gs = this.guardS > 0.004 ? this.guardS : 0;
    const gd = bn[B.guard];
    gd.scale.setScalar(gs);
    gd.rotation.set(Math.sin(t * 2.1) * 0.1, t * 3.4, Math.cos(t * 1.7) * 0.1);
    gd.position.y = this.restPos[B.guard * 3 + 1] + Math.sin(t * 3) * 0.03;

    // Kurzschluss: Blitze zucken an wechselnden Stellen, Qualm steigt auf
    for (let i = 0; i < 2; i++) {
      const ft = t * 11 + i * 0.5;
      const tick = Math.floor(ft);
      const r1 = hash(tick + i * 37.1);
      const r2 = hash(tick * 1.7 + i * 11.3 + 5);
      const r3 = hash(tick * 2.3 + i * 3.7 + 9);
      const on = ft - tick < 0.62 ? 1 : 0;
      const a = r1 * TAU;
      const rad = 0.7 + 0.35 * r2;
      const bo = bn[B.bolt0 + i];
      bo.position.set(Math.cos(a) * rad, 0.5 + 0.7 * r3, Math.sin(a) * rad);
      bo.rotation.set(0, HALF_PI - a, (r2 - 0.5) * 1.6);
      bo.scale.setScalar(stallS > 0.02 ? stallS * on * (0.75 + 0.4 * r3) : 0);
      const p = t * 0.85 + i * 0.5;
      const life = p - Math.floor(p);
      const pf = bn[B.puff0 + i];
      pf.position.set(
        sp.smoke[0] + (i === 0 ? 0.14 : -0.14) * life + Math.sin(t * 3 + i) * 0.03,
        sp.smoke[1] + life * 0.8,
        sp.smoke[2] - life * 0.3,
      );
      pf.rotation.y = life * 2 + i;
      const grow = (0.45 + 0.8 * life) * Math.min(1, (1 - life) * 5) * Math.min(1, life * 8);
      pf.scale.setScalar(stallS > 0.02 ? stallS * grow : 0);
    }
    this.fx.visible = gs > 0 || stallS > 0.02;
  }

  /**
   * Item, erster Teil (vor dem Fahrer): Geste weiterzählen, Ziel der rechten
   * Hand und die Zusätze für Oberkörper und Kopf bestimmen.
   */
  private planItem(): void {
    const dt = this.fDt;
    const t = this.time;
    let g: Gesture | null = null;
    let p = 0;
    if (this.gT >= 0) {
      g = GESTURES[this.gItem];
      if (g) {
        const p0 = this.gT / g.dur;
        this.gT += dt;
        p = this.gT / g.dur;
        if (!this.gDone && g.release >= 0 && p0 < g.release && p >= g.release) this.release(g);
        if (!this.gDone && g.vanish && p >= g.vanish[1]) {
          this.gDone = true;
          this.propS = 0;
          this.propV = 0;
        }
        if (p >= 1) g = null;
      }
      if (!g) this.gT = -1;
    }

    // Grundhaltung: Item neben dem Kopf – im Drachenzug die Hand an der Leine.
    const towing = this.kiteT >= 0;
    const tw = (this.towW = damp(this.towW, towing ? 1 : 0, 6, dt));
    // Die Leine ruckt: Hand nach vorn, die Figur stemmt sich dagegen.
    const tug = tw * (Math.sin(t * 13) * 0.012 + Math.sin(t * 7.7) * 0.01);
    let out = HOLD[0] + (LEASH[0] - HOLD[0]) * tw;
    let up = HOLD[1] + (LEASH[1] - HOLD[1]) * tw + Math.sin(t * 5.2) * 0.012;
    let fwd = HOLD[2] + (LEASH[2] - HOLD[2]) * tw + tug;
    let tx = -0.2 * tw - tug * 2;
    let ty = 0;
    let tz = 0;
    let hx = -0.14 * tw;
    let rate = 14;
    let want = (this.fHeld > 0 && !this.fTow) || towing ? 1 : 0;
    if (g) {
      const keys = g.keys;
      const n = keys.length / KEY;
      let i = 0;
      while (i < n - 2 && keys[(i + 1) * KEY] <= p) i++;
      const a = i * KEY;
      const b = a + KEY;
      const f = smooth01((p - keys[a]) / Math.max(keys[b] - keys[a], 1e-6));
      for (let k = 1; k < KEY; k++) _ik[k] = keys[a + k] + (keys[b + k] - keys[a + k]) * f;
      out = _ik[1];
      up = _ik[2];
      fwd = _ik[3];
      tx = _ik[4];
      ty = _ik[5];
      tz = _ik[6];
      hx = _ik[7];
      if (this.gItem === I_EMP && p > 0.18 && p < 0.7) {
        // Der Stecker zittert vor Spannung
        out += Math.sin(t * 71) * 0.015;
        up += Math.sin(t * 53) * 0.015;
      }
      rate = 30;
      want = 1;
    }
    // Get Gold: Austrinken. Die Hände folgen der Flasche (drinkHands); hier nur Oberkörper, Kopf und Gewichte.
    const dp = this.fDrink;
    if (dp > 0) {
      // Kopf in den Nacken, solange getrunken wird; leicht zurückgelehnt; nach dem Absetzen ein zufriedenes Nicken.
      const sip = smooth01((dp - 0.22) / 0.12) * (1 - smooth01((dp - 0.72) / 0.1));
      hx = -0.42 * sip + 0.12 * smooth01((dp - 0.82) / 0.08) * (1 - smooth01((dp - 0.92) / 0.08));
      tx = -0.12 * sip;
      ty = 0;
      tz = 0;
      // Wurf über die rechte Schulter: Hand nach hinten oben, dann zurück ans Lenkrad.
      const fling = smooth01((dp - 0.76) / 0.08) * (1 - smooth01((dp - 0.93) / 0.07));
      out = 0.32;
      up = 0.34;
      fwd = -0.28;
      ty = -0.35 * fling;
      want = dp < 0.95 ? 1 : 0;
      rate = 30;
      if (fling <= 0 && dp < DRINK_THROW) {
        // (Solange getrunken wird, bestimmt drinkHands die rechte Hand ganz – diese Werte zählen dann nicht.)
        out = HOLD[0];
        up = HOLD[1];
        fwd = HOLD[2];
      }
    }
    // Bohrer: Einstecken. Die rechte Hand folgt dem Griff (plantHands); hier Oberkörper und Kopf: zum Bohrer hochschauen,
    // sich nach rechts über die Bande lehnen, beim Hineinrammen nachdrücken und hinunterschauen.
    const pp = this.fPlant;
    if (pp > 0) {
      const lean = smooth01(pp / 0.45);
      const ram = smooth01((pp - 0.8) / 0.12);
      tx = 0.05 * lean - 0.08 * smooth01((pp - 0.5) / 0.25) * (1 - ram) + 0.26 * ram;
      ty = -0.12 * lean;
      tz = 0.42 * lean + 0.14 * ram;
      hx = -0.32 * smooth01(pp / 0.24) * (1 - ram) + 0.34 * ram;
      want = 1;
      rate = 30;
    }
    this.plantW = damp(this.plantW, pp > 0 ? 1 : 0, pp > 0 ? 18 : 14, dt);
    this.drinkW = damp(this.drinkW, dp > 0 && dp < DRINK_THROW - 0.04 ? 1 : 0, dp > 0 ? 22 : 12, dt);
    if (dp <= 0) this.drinkThrown = false;
    // Cockpit-Ansicht: Neben dem Kopf sähe man das Item nicht. Dort hält die Figur es vor der rechten Schulter über dem
    // Lenkrad, und jede Geste läuft in diesem Raum: Würfe gehen von dort nach vorn ins Bild, Würfe nach hinten über die
    // Schulter aus dem Bild hinaus. Oberkörper und Kopf bewegen sich dabei weniger mit – die Kamera sitzt im Kopf.
    if (this.firstPerson && dp <= 0 && pp <= 0) {
      out = COCKPIT_HOLD[0] + (out - HOLD[0]) * 0.5;
      up = COCKPIT_HOLD[1] + (up - HOLD[1]) * 0.55;
      fwd = COCKPIT_HOLD[2] + (fwd - HOLD[2]) * 0.7;
      tx *= 0.5;
      ty *= 0.5;
      tz *= 0.5;
      hx *= 0.4;
    }
    this.hOut = damp(this.hOut, out, rate, dt);
    this.hUp = damp(this.hUp, up, rate, dt);
    this.hFwd = damp(this.hFwd, fwd, rate, dt);
    this.gTx = damp(this.gTx, tx, rate * 0.6, dt);
    this.gTy = damp(this.gTy, ty, rate * 0.6, dt);
    this.gTz = damp(this.gTz, tz, rate * 0.6, dt);
    this.gHx = damp(this.gHx, hx, rate * 0.6, dt);
    this.holdW = damp(this.holdW, want, g || pp > 0 ? 30 : 9, dt);
  }

  /** Der Gegenstand verlässt die Hand: Flug starten – beim Drachen steigt stattdessen der große auf. */
  private release(g: Gesture): void {
    this.gDone = true;
    if (this.propItem === 0 || this.propS < 0.02) return;
    if (this.gItem === I_KITE && this.fTow) {
      this.kiteFrom.copy(this.prop.position);
      this.toRoot(this.kiteFrom);
      this.kiteT = 0;
      this.kiteEnd = -1;
      this.propS = 0;
      this.propV = 0;
      return;
    }
    const f = g.fly;
    if (!f) return;
    this.flyP.copy(this.prop.position);
    this.flyV.set(-f[0], f[1], f[2]);
    this.flyG = f[3];
    this.flyDur = f[4];
    this.gFly = 0;
  }

  /** Punkt aus dem Raum der Karosserie in den von root (Drift und Schleudern eingerechnet). */
  private toRoot(v: THREE.Vector3): void {
    const bn = this.bones;
    bn[B.chassis].updateMatrix();
    bn[B.drift].updateMatrix();
    bn[B.spin].updateMatrix();
    v.applyMatrix4(bn[B.chassis].matrix).applyMatrix4(bn[B.drift].matrix).applyMatrix4(bn[B.spin].matrix);
  }

  /** Item, zweiter Teil (nach dem Fahrer): Gegenstand an die Hand oder in den Flug, Drache und Leine. */
  private moveItem(): void {
    const sp = this.spec;
    const bn = this.bones;
    const t = this.time;
    const dt = this.fDt;
    const prop = this.prop;
    const g = this.gT >= 0 ? GESTURES[this.gItem] : null;
    const p = g ? this.gT / g.dur : 0;

    // — Gegenstand: welcher, wie groß —
    if (this.gFly >= 0) {
      this.gFly += dt;
      if (this.gFly >= this.flyDur) {
        this.gFly = -1;
        this.propS = 0;
        this.propV = 0;
      }
    }
    // Get Gold: abgesetzt – die Flasche fliegt über die rechte Schulter nach hinten weg und trudelt.
    const drinking = this.fDrink > 0 && !this.drinkThrown;
    if (drinking && this.fDrink >= DRINK_THROW) {
      this.drinkThrown = true;
      if (this.propItem === I_GOLD && this.propS > 0.02) {
        this.flyP.copy(prop.position);
        this.flyV.set(-2.2, 4.2, -6.5);
        this.flyG = 16;
        this.flyDur = 0.55;
        this.gFly = 0;
      }
    }
    // Bohrer: eingesteckt – er steckt jetzt im Boden (things.ts), die Hand ist auf der Stelle leer.
    if (this.plantWas && this.fPlant <= 0 && this.propItem === I_DRILL) {
      this.propS = 0;
      this.propV = 0;
    }
    this.plantWas = this.fPlant > 0;
    if (this.gFly < 0) {
      let want = this.fTow || this.kiteT >= 0 ? 0 : this.fHeld;
      if (g && !this.gDone) want = this.gItem;
      // Beim Austrinken hält die Figur die Goldflasche – auch wenn sie inzwischen schon ein neues Item hat; beim Einstecken
      // ebenso den Bohrer.
      if (this.fDrink > 0 && !this.drinkThrown) want = I_GOLD;
      if (this.fPlant > 0) want = I_DRILL;
      if (want !== this.propItem) {
        if (this.propItem !== 0 && this.propS > 0.02) {
          // erst schnell verschwinden, dann tauschen
          this.propS = damp(this.propS, 0, 28, dt);
          this.propV = 0;
        } else {
          this.propItem = want;
          this.propS = 0;
          this.propV = 0;
          if (want > 0) {
            const ig = getItemGeos()[want];
            prop.geometry = ig.main;
            this.propLine.geometry = ig.line ?? ig.main;
          }
        }
      } else if (want > 0) {
        // Aufploppen mit Überschwinger
        this.propV += ((1 - this.propS) * 320 - this.propV * 14) * dt;
        this.propS += this.propV * dt;
      }
    }
    const item = this.propItem;
    const spinRate = item === I_TOP ? (this.gFly >= 0 ? 48 : g ? 26 : 13) : 0;
    this.propSpin = (this.propSpin + spinRate * dt) % TAU;

    // — Gegenstand: Lage —
    let mul = 1;
    let sy = 1;
    let rx = (this.hFwd - HOLD[2]) * 1.3;
    let rz = 0.18 + Math.sin(t * 4.3) * 0.06;
    if (this.gFly >= 0) {
      const tf = this.gFly;
      prop.position.copy(this.flyP).addScaledVector(this.flyV, tf);
      prop.position.y -= 0.5 * this.flyG * tf * tf;
      const u = tf / this.flyDur;
      mul = u < 0.6 ? 1 : 1 - smooth01((u - 0.6) / 0.4);
      if (item === I_GUARD) mul *= 1 + u * 0.7;
      if (item === I_TIRE) rx += tf * 30;
      else if (item !== I_TOP) rx += this.flyV.z < 0 ? -tf * 16 : tf * 10;
    } else {
      // Griff knapp über der Faust (die Hand sitzt am Ende des Unterarms)
      _iv.set(0, 1, 0).applyQuaternion(bn[B.handR].quaternion);
      prop.position.copy(this.handP).addScaledVector(_iv, sp.hand * 0.6);
      if (g && g.vanish) {
        const a = g.vanish[0];
        const u = clamp((p - a) / (g.vanish[1] - a), 0, 1);
        if (this.gItem === I_BOOST) {
          // Druck baut sich auf (Flasche zittert und bläht sich), dann knallt der Korken
          rz += Math.sin(t * 80) * 0.14 * smooth01((p - 0.14) / 0.16) * (1 - u);
          mul = u < 0.4 ? 1 + 0.35 * smooth01(u / 0.4) : 1.35 * (1 - smooth01((u - 0.4) / 0.6));
        } else if (this.gItem === I_ROBOT) {
          // aufs Armaturenbrett gedrückt: der kleine Roboter wird gestaucht, dann ploppt er weg
          sy = 1 - 0.4 * smooth01((p - 0.28) / 0.14) + 0.6 * smooth01(u / 0.6);
          mul = 1 - smooth01(u);
        } else {
          mul = (1 - smooth01(u)) * (u > 0 ? 0.8 + 0.2 * Math.sin(t * 90) : 1);
        }
      }
    }
    if (item === I_GOLD && this.gFly >= 0) rx -= this.drinkTilt;
    _iq.setFromEuler(_ie.set(rx, this.propSpin, rz, 'XZY'));
    prop.quaternion.multiplyQuaternions(bn[B.torso].quaternion, _iq);
    // (Aus dem Cockpit ist der Gegenstand ganz nah vor der Kamera: dort kleiner – im Flug wächst er zurück.)
    let s = Math.max(this.propS, 0) * mul * (this.firstPerson ? (this.gFly >= 0 ? 0.62 + 0.38 * Math.min(1, this.gFly * 4) : 0.62) : 1);
    if (item === I_GOLD && (this.drinkW > 0.001 || this.gFly >= 0)) {
      // Beim Trinken: in beiden Händen, Hals zum Mund geneigt (Übergang aus der Hand weich, so schnell wie die Hände).
      const w = this.gFly >= 0 ? 1 : this.drinkW;
      s *= 1 + (DRINK_SCALE - 1) * w;
      if (this.gFly < 0) {
        _iv.copy(this.gripP).addScaledVector(this.gripU, -DRINK_GRIP * s);
        prop.position.lerp(_iv, w);
        _iq.setFromAxisAngle(_iw.set(1, 0, 0), -this.drinkTilt);
        _iq.premultiply(bn[B.torso].quaternion);
        prop.quaternion.slerp(_iq, w);
      }
    }
    if (item === I_DRILL && this.fPlant > 0 && this.plantW > 0.001) {
      // Beim Einstecken: am Griff in der Faust, mit eigener Neigung, und er wächst auf DRILL_GROW. (Ein zweiter Bohrer in der
      // Hand danach sitzt wieder ganz normal.)
      const w = this.plantW;
      prop.position.lerp(this.plantP, w);
      prop.quaternion.slerp(this.plantQ, w);
      s *= 1 + (this.plantS - 1) * w;
    }
    prop.scale.set(s, s * sy, s);
    prop.visible = item > 0 && s > 0.01;

    // — Abschleppdrache —
    const kb = this.kiteBones;
    const k0 = kb[0];
    if (this.fTow) {
      if (this.kiteT < 0) {
        // Steigt aus der Wurfbewegung auf; ohne Geste direkt aus der Hand.
        const waiting = g !== null && this.gItem === I_KITE && !this.gDone;
        if (!waiting) {
          this.kiteFrom.copy(this.handP);
          this.toRoot(this.kiteFrom);
          this.kiteT = 0;
          this.kiteEnd = -1;
        }
      } else this.kiteT += dt;
    } else if (this.kiteT >= 0) {
      // Zug vorbei: Leine weg, der Drache flattert davon
      this.kiteFrom.copy(k0.position);
      this.kiteT = -1;
      this.kiteEnd = 0;
    } else if (this.kiteEnd >= 0) {
      this.kiteEnd += dt;
      if (this.kiteEnd > 0.4) this.kiteEnd = -1;
    }
    const flying = this.kiteT >= 0 || this.kiteEnd >= 0;
    this.kite.visible = flying;
    this.leash.visible = this.kiteT >= 0;
    if (!flying) return;

    // Flugbahn: schwankt lebendig hin und her, legt sich dabei in die Kurve
    const ph = t * 1.25 + this.slot;
    const fx = 1.25 * Math.sin(ph) + 0.3 * Math.sin(t * 3.3 + 1);
    const fy = 4.7 + 0.3 * Math.sin(t * 1.9) + 0.1 * Math.sin(t * 5.3);
    const fz = 8.4 + 0.35 * Math.sin(t * 1.1);
    let roll = -0.32 * Math.cos(ph) + 0.08 * Math.sin(t * 4.1);
    let pitch = -0.08 + 0.06 * Math.sin(t * 2.3);
    let ks = 1;
    if (this.kiteT >= 0) {
      const l = this.kiteT / 0.32;
      if (l < 1) {
        const e = easeOutBack(l);
        _iv.set(fx, fy, fz);
        k0.position.lerpVectors(this.kiteFrom, _iv, e);
        ks = 0.16 + 0.84 * e;
        roll += (1 - l) * (1 - l) * 4.5;
      } else k0.position.set(fx, fy, fz);
    } else {
      const u = this.kiteEnd;
      k0.position.set(
        this.kiteFrom.x + Math.sin(u * 14) * 0.35,
        this.kiteFrom.y + u * 6 + u * u * 6,
        this.kiteFrom.z + u * 2.5,
      );
      ks = 1 - smooth01(u / 0.4);
      roll += Math.sin(u * 28) * 0.6;
      pitch -= u * 2;
    }
    k0.rotation.set(pitch, 0.12 * Math.sin(ph), roll);
    k0.scale.setScalar(Math.max(ks * KITE_SCALE, 0.001));
    // Schwanz: weht zum Kart hin und schlägt Wellen
    for (let i = 1; i < KITE_BONES; i++) {
      kb[i].rotation.set(
        i === 1 ? 0.75 + 0.12 * Math.sin(t * 6) : 0.1 + 0.24 * Math.sin(t * 7.5 - i * 0.9),
        0,
        0.3 * Math.sin(t * 5.2 - i * 0.8) + (i === 1 ? -roll * 0.6 : 0),
      );
    }
    if (this.kiteT < 0) return;

    // Leine: straff von der Faust zum Knoten am Drachen
    _iv.set(0, 1, 0).applyQuaternion(bn[B.handR].quaternion).multiplyScalar(sp.hand * 0.3).add(this.handP);
    this.toRoot(_iv);
    k0.updateMatrix();
    _iw.set(KITE_BRIDLE[0], KITE_BRIDLE[1], KITE_BRIDLE[2]).applyMatrix4(k0.matrix).sub(_iv);
    const len = _iw.length();
    if (len > 1e-4) {
      this.leash.position.copy(_iv);
      this.leash.quaternion.setFromUnitVectors(Y_AXIS, _iw.multiplyScalar(1 / len));
      this.leash.scale.set(0.028, len, 0.028);
    } else this.leash.visible = false;
  }

  /** Gleitflügel: ausklappen mit Überschwinger, einklappen ohne; im Flug federn die Enden. */
  private moveWings(): void {
    const bn = this.bones;
    const u = this.wingU;
    const tl = bn[B.wtail];
    if (u <= 0) {
      if (bn[B.wingL].scale.x !== 0) {
        bn[B.wingL].scale.setScalar(0);
        bn[B.wingR].scale.setScalar(0);
        tl.scale.setScalar(0);
      }
      return;
    }
    const sp = this.spec;
    const t = this.time;
    const open = this.fGlide;
    // Ausklappen schießt etwas über, Einklappen läuft weich
    const deploy = open ? easeOutBack(u) : smooth01(u);
    const size = open ? smooth01(u / 0.4) : smooth01(u / 0.5);
    const tail = open ? Math.max(easeOutBack((u - 0.2) / 0.8), 0) : smooth01(u / 0.6);
    const g = this.glideS;
    const sweep = 1.45 * (1 - deploy);
    // Tragen: die Flügel biegen sich leicht nach oben und wippen; ausgeklappt drückt der Fahrtwind
    const lift = sp.wingUp * deploy + g * (0.03 + 0.025 * Math.sin(t * 3.1 + this.slot));
    const twist = g * 0.03 * Math.sin(t * 2.3 + 1);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const w = bn[B.wingL + i];
      w.rotation.set(twist, side * sweep, side * lift);
      w.scale.setScalar(Math.max(size, 0.001));
      // Außenteil: flattert im Wind, die kurvenäußere Seite biegt sich stärker
      const flutter = Math.sin(t * 13 + i * 1.7) * 0.035 + Math.sin(t * 7.3 + i) * 0.025;
      const tip = bn[B.tipL + i];
      tip.rotation.set(g * Math.sin(t * 9.5 + i * 2) * 0.05, 0, side * (g * (0.05 + flutter - side * this.bank * 0.12) + (deploy - 1) * 0.6));
    }
    tl.scale.setScalar(Math.max(tail, 0.001));
    tl.rotation.set(g * Math.sin(t * 4.1) * 0.03, 0, 0);
    if (this.character === 2) {
      // Bert: Propeller dreht im Flug, mit Schub schneller
      this.propA = (this.propA + this.fDt * g * (22 + 18 * this.boostS)) % TAU;
      tl.rotation.z = this.propA;
    }
  }

  /** Tauchausrüstung: ploppt auf bzw. klappt herunter, Schrauben drehen, Blasen steigen, bei Schub ein Blasenstrahl. */
  private moveDive(): void {
    const bn = this.bones;
    const u = this.diveU;
    if (u <= 0) {
      if (bn[B.dBody].scale.x !== 0) this.hideDive();
      return;
    }
    const sp = this.spec;
    const rp = this.restPos;
    const t = this.time;
    const open = this.fDive;
    // Anlegen schießt etwas über, Ablegen läuft weich
    const pop = open ? easeOutBack(u) : smooth01(u);
    const size = open ? smooth01(u / 0.5) : smooth01(u / 0.6);
    const hd = bn[B.dHead];
    if (this.character === 1) hd.rotation.x = 0.78 * pop;
    else if (this.character === 3) {
      // Glaskuppel: wabert ein wenig
      const w = 0.018 * this.diveS * Math.sin(t * 2.3);
      hd.scale.set(Math.max(pop * (1 + w), 0.001), Math.max(pop * (1 - w), 0.001), Math.max(pop, 0.001));
    } else hd.scale.setScalar(Math.max(pop, 0.001));
    const body = bn[B.dBody];
    body.scale.setScalar(Math.max(pop, 0.001));
    // Bert: der Außenborder klappt aus der Waagrechten herunter
    if (this.character === 2) body.rotation.x = 1.4 * (1 - pop);

    // Schrauben: schneller mit Tempo und Schub
    this.dPropA = (this.dPropA + this.fDt * this.diveS * (6 + 24 * this.fV1 + 26 * this.boostS)) % TAU;
    bn[B.dPropL].rotation.z = this.dPropA;
    bn[B.dPropR].rotation.z = -this.dPropA;

    // Blasen: Quelle im Kopf (Schnorchel, Mund, Ventil) in den Raum der Karosserie
    const head = bn[B.head];
    head.updateMatrix();
    const q = sp.diveBub;
    _dv.set(q[0], q[1], q[2]).applyMatrix4(head.matrix).applyMatrix4(bn[B.torso].matrix);
    const rate = 1.1 + 0.7 * this.fV1;
    const drift = 0.12 + 0.6 * this.fV1;
    for (let i = 0; i < 3; i++) {
      const p = t * rate + i / 3;
      const life = p - Math.floor(p);
      const bb = bn[B.bub0 + i];
      bb.position.set(_dv.x + Math.sin(t * 4 + i * 2.1) * 0.04 * life, _dv.y + life * 0.8, _dv.z - life * drift);
      const g = (0.55 + 0.75 * life) * Math.min(1, (1 - life) * 5) * Math.min(1, life * 8) * size;
      bb.scale.setScalar(g);
    }

    // Blasenstrahl aus dem Auspuff (läuft entlang der Flammenrichtung nach hinten)
    const js = this.jetS * size;
    const up = sp.exhaustUp;
    for (let i = 0; i < 2; i++) {
      const jt = bn[B.jetL + i];
      if (js < 0.02) {
        jt.scale.setScalar(0);
        continue;
      }
      const k = t * 6.5 + i * 0.5;
      const run = (k - Math.floor(k)) * 0.13;
      const j = (B.jetL + i) * 3;
      jt.position.set(rp[j], rp[j + 1] + Math.sin(up) * run, rp[j + 2] - Math.cos(up) * run);
      jt.rotation.set(this.restRot[j], 0, Math.sin(t * 9 + i * 2) * 0.6);
      const s = js * (0.85 + 0.25 * Math.sin(t * 37 + i * 2));
      jt.scale.set(s, s, s * (1 + 0.5 * this.fV));
    }
  }

  /** Raumausrüstung: ploppt auf, Antenne wippt, Leuchte blinkt, in der Luft feuern die Steuerdüsen zur Lenkrichtung. */
  private moveSpace(): void {
    const bn = this.bones;
    const u = this.spaceU;
    if (u <= 0) {
      if (bn[B.sHead].scale.x !== 0) this.hideSpace();
      return;
    }
    const t = this.time;
    const open = this.fSpace;
    const pop = Math.max(open ? easeOutBack(u) : smooth01(u), 0.001);
    bn[B.sHead].scale.setScalar(pop);
    bn[B.sPack].scale.setScalar(pop);
    bn[B.sBody].scale.setScalar(pop);
    // Antenne: träge Feder plus langsames Nachwiegen
    bn[B.sAnt].rotation.set(
      this.antZ * 0.9 + 0.05 * Math.sin(t * 1.9 + this.slot),
      0,
      this.antX * 0.8 + 0.06 * Math.sin(t * 1.3 + this.slot * 2),
    );
    // Positionsleuchte: Doppelblitz etwa jede Sekunde
    const k = (t * 0.85 + this.slot * 0.23) % 1;
    bn[B.sLamp].scale.setScalar(k < 0.07 || (k > 0.15 && k < 0.22) ? pop : 0);
    // Steuerdüsen: kurze Stöße. Lenken nach links (steer < 0) feuern vorn rechts
    // und hinten links (die Nase dreht nach links), nach rechts umgekehrt.
    // Geradeaus zuckt ab und zu eine Düse zur Lagekorrektur.
    const air = this.spaceAir;
    const steer = this.fSteer;
    const ph = t * 3.6;
    const f = ph - Math.floor(ph);
    const burst = f < 0.45 ? Math.sin((f / 0.45) * Math.PI) : 0;
    const pick = Math.floor(hash(Math.floor(ph) + this.slot * 7.7) * 4);
    const turn = clamp((Math.abs(steer) - 0.12) * 1.6, 0, 1);
    for (let i = 0; i < 4; i++) {
      const left = i % 2 === 0;
      const front = i < 2;
      const fire = steer < 0 ? left !== front : left === front;
      let s = fire ? turn : 0;
      if (i === pick) s = Math.max(s, (1 - turn) * 0.45);
      s *= air * burst;
      const jt = bn[B.sJet0 + i];
      if (s < 0.02) {
        jt.scale.setScalar(0);
        continue;
      }
      const flick = 0.85 + 0.2 * Math.sin(t * 57 + i * 1.7);
      jt.scale.set(s * flick, 0.6 + 0.4 * s, 0.6 + 0.4 * s);
    }
  }

  /** Augen: Kringel beim Schleudern, verdattert bei Kurzschluss, sonst je nach Lage – und ab und zu blinzeln. */
  private pickEyes(pose: KartPose): void {
    let eye: number = EYE.OPEN;
    // Get Gold: beim Trinken genießerisch geschlossen, danach entschlossen.
    const sipping = this.fDrink > 0.22 && this.fDrink < 0.8;
    if (this.fSpin > 0) eye = EYE.DIZZY;
    else if (sipping) eye = EYE.HAPPY;
    else if (this.fGold && pose.emote === 'none') eye = EYE.FIERCE;
    else if (pose.stall) eye = EYE.STUN;
    else if (pose.emote === 'win') eye = EYE.HAPPY;
    else if (pose.emote === 'lose') eye = EYE.SAD;
    else if (pose.boost) eye = EYE.FIERCE;
    else if (pose.air) eye = EYE.WOW;
    else {
      this.blinkT -= this.fDt;
      if (this.blinkT < 0.11) eye = EYE.BLINK;
      if (this.blinkT < 0) {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        this.blinkT = 2 + (this.seed / 4294967296) * 3.2;
      }
    }
    this.setEyes(eye);
  }

  /**
   * Spannt einen Arm zwischen Schulter und Ziel (Hand am Lenkrad oder oben):
   * Ellbogen aus den beiden Armlängen, Knochen passend gedreht und gestreckt.
   */
  private solveArm(side: number): void {
    const sp = this.spec;
    const t = this.time;
    const bn = this.bones;
    const torso = bn[B.torso];
    const upper = bn[side > 0 ? B.armLU : B.armRU];
    const fore = bn[side > 0 ? B.armLF : B.armRF];
    const hand = bn[side > 0 ? B.handL : B.handR];
    // Schulter im Raum der Karosserie
    _sh.set(side * sp.shoulder[0], sp.shoulder[1], sp.shoulder[2]).applyMatrix4(torso.matrix);
    // Ziel: Griff am Lenkrad …
    // (In der Cockpit-Ansicht endet der Unterarm am Handgelenk des Handschuhs – etwas außen und zur Figur hin –, die Faust
    // um den Kranz zeichnet cockpitKit.ts.)
    const wk = 1 + (this.fpSteerK * COCKPIT_WRIST[0]) / sp.steerR;
    _hd.set(side * sp.steerR * 0.82 * wk, -sp.steerR * 0.5 * wk, 0.03 + this.fpSteerK * COCKPIT_WRIST[1]).applyMatrix4(bn[B.steer].matrix);
    // … oder hochgerissen (Luft, Jubel) – beim Jubeln winkend
    const up = this.armsUp;
    if (up > 0.001) {
      const wave = this.winS * Math.sin(t * 11 + side);
      _t.set(
        side * (sp.shoulder[0] + 0.16 + 0.07 * wave),
        sp.shoulder[1] + 0.36 + 0.03 * this.winS * Math.cos(t * 11),
        sp.shoulder[2] + 0.1,
      ).applyMatrix4(torso.matrix);
      _hd.lerp(_t, up);
    }
    // … oder Brustschwimmen: nach vorn strecken, weit ausholen, zurück
    const sw = this.swimS;
    if (sw > 0.001) {
      const r = (sp.upper + sp.fore) / 0.5;
      const out = Math.max(0, Math.sin(t * 4.4));
      _t.set(
        side * (sp.shoulder[0] + (0.05 + 0.2 * out) * r),
        sp.shoulder[1] + (0.12 - 0.07 * out) * r,
        sp.shoulder[2] + (0.38 - 0.18 * out) * r,
      ).applyMatrix4(torso.matrix);
      _hd.lerp(_t, sw);
    }
    // … oder (nur rechts) beim Item. Hochgerissene Arme haben Vorrang, außer während einer Geste.
    if (side < 0 && this.holdW > 0.001) _hd.lerp(this.handT, this.holdW * (this.gT >= 0 || this.fDrink > 0 || this.fPlant > 0 ? 1 : 1 - up));
    // … oder (links) mit an der Goldflasche.
    if (side > 0 && this.drinkW > 0.001) _hd.lerp(this.handTL, this.drinkW);
    _u.subVectors(_hd, _sh);
    let d = _u.length();
    if (d < 1e-4) {
      _u.set(0, 0, 1);
      d = 1e-4;
    } else {
      _u.multiplyScalar(1 / d);
    }
    const reach = (sp.upper + sp.fore) * 0.995;
    const k = d > reach ? d / reach : 1; // zu weit weg: Arm wird gestreckt
    const l1 = sp.upper * k;
    const l2 = sp.fore * k;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    // Ellbogen knickt nach außen-unten – in der Cockpit-Ansicht nach unten: Dann kommen die Unterarme von unten an den
    // Kranz, und die Hände greifen ihn von außen (mit weit abgespreizten Ellbogen griffen sie aus dem Sitz gesehen von innen).
    const fpk = this.fpSteerK;
    _w.set(side * (0.8 + (COCKPIT_ELBOW[0] - 0.8) * fpk), -0.55 + (COCKPIT_ELBOW[1] + 0.55) * fpk, -0.25 + (COCKPIT_ELBOW[2] + 0.25) * fpk);
    _w.addScaledVector(_u, -_w.dot(_u));
    if (_w.lengthSq() < 1e-8) _w.set(side, 0, 0);
    _w.normalize();
    _el.copy(_sh).addScaledVector(_u, a).addScaledVector(_w, h);

    upper.position.copy(_sh);
    _t.subVectors(_el, _sh);
    let len = _t.length();
    if (len < 1e-5) {
      _t.set(0, 1, 0);
      len = 1e-5;
    } else {
      _t.multiplyScalar(1 / len);
    }
    upper.quaternion.setFromUnitVectors(Y_AXIS, _t);
    // (Aus dem Cockpit sind die Arme ganz nah vor der Kamera: dort etwas schlanker.)
    const thin = 1 - 0.22 * fpk;
    upper.scale.set(thin, len / sp.upper, thin);

    fore.position.copy(_el);
    _t.subVectors(_hd, _el);
    len = _t.length();
    if (len < 1e-5) {
      _t.set(0, 1, 0);
      len = 1e-5;
    } else {
      _t.multiplyScalar(1 / len);
    }
    fore.quaternion.setFromUnitVectors(Y_AXIS, _t);
    fore.scale.set(thin, len / sp.fore, thin);
    hand.position.copy(_hd);
    hand.quaternion.copy(fore.quaternion);
  }

  /** Effekt-Punkte nachführen: sie drehen sich mit Drift und Schleudern mit. */
  private placeAnchors(): void {
    const sp = this.spec;
    const a = this.anchors;
    this.aCd = Math.cos(this.fDriftYaw);
    this.aSd = Math.sin(this.fDriftYaw);
    this.aCs = Math.cos(this.fSpinYaw);
    this.aSs = Math.sin(this.fSpinYaw);
    this.anchor(a.wheelRearL, sp.wr.x, 0, sp.wr.z);
    this.anchor(a.wheelRearR, -sp.wr.x, 0, sp.wr.z);
    this.anchor(a.wheelFrontL, sp.wf.x, 0, sp.wf.z);
    this.anchor(a.wheelFrontR, -sp.wf.x, 0, sp.wf.z);
    this.anchor(a.exhaustL, sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]);
    this.anchor(a.exhaustR, -sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]);
    this.anchor(a.head, 0, sp.hip[1] + sp.torsoLen + 0.3, sp.hip[2]);
  }

  /** Ein Punkt der Ruhelage → root: erst Drift (um den Drehpunkt vorn), dann Schleudern. */
  private anchor(out: THREE.Vector3, x: number, y: number, z: number): void {
    const dz = z - DRIFT_PIVOT;
    const x1 = x * this.aCd + dz * this.aSd;
    const z1 = -x * this.aSd + dz * this.aCd + DRIFT_PIVOT;
    out.set(x1 * this.aCs + z1 * this.aSs, y, -x1 * this.aSs + z1 * this.aCs);
  }
}
