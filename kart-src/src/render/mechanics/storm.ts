// Gewitterkamm: Darstellung des Gewitters – Blitzeinschläge, Blitzableiter mit Ladefeld, Leitpfosten,
// Lampen in Galerie und Stollen und das Wetterleuchten, das Licht und Dunst der ganzen Welt aufhellt.
//
// Die Physik (game/mechanics.ts, game/sim.ts) kennt nur Zahlen; hier bekommen sie ein Gesicht:
//   * Blitz auf die Bahn (PULSE_BOLT) – Gefahr, rot/magenta, eng und rund:
//     Vorwarnung: am Boden ein Zielkreis im Trefferradius, dessen Füllung sich von außen nach innen
//     zuzieht (bei Zyklus 0 ist er voll), ein roter Schein am Rand, violette Funken; ein dünner Leitblitz
//     tastet sich aus der Höhe herab – erst hoch oben, in der letzten halben Sekunde bis kurz über den Boden.
//     Einschlag: dicker, gezackter Blitz aus 90 m (Form je Auslösung aus der Rennzeit gewürfelt), greller
//     Fleck, gemalter Schein auf der Fahrbahn ringsum, Funkenregen. Danach glimmt die Stelle eine Sekunde
//     nach; eine dunkle Narbe auf der Bahn bleibt.
//   * Blitzableiter (PULSE_ROD) – Geschenk, blau-weiß, ein Band quer über die ganze Bahn:
//     Gittermast mit Isolatoren, Kugel, Fangspitze und roter Flugwarnlampe; zwei Kupferschienen quer über
//     die Fahrbahn rahmen das Ladefeld (6 m vor und hinter dem Mast). Vorwarnung: die Kugel glüht cyan und
//     pulsiert schneller, Entladungen laufen den Mast hinab, die Schienen glimmen, von ihnen her wächst ein
//     blasses Feld zur Mitte. Geladen: Blitz in die Spitze, helles Ladefeld mit laufenden Lichtbögen.
//   * Leitpfosten (links rot, rechts weiß, in Kurven enger und mit gelben Richtungstafeln), Lampen und
//     gemalte Lichtflecken in Galerie und Stollen, ein beleuchteter Wegweiser vor der Gabelung.
//   * Wetterleuchten: Dunst, Himmel und Licht der Welt folgen allein stormLight() (game/mechanics.ts).
//
// Licht wird gemalt (additive Flächen, fog: false) – keine Lichtquellen, keine Texturen, keine eigenen Shader.
// Alles Sichtbare ist eine reine Funktion der Rennzeit (nur Teilchen und das Flimmern kleiner Dinge nicht).
//
// Zeichenaufrufe: feste Körper (toon) + Kontur, Reflektoren (Instanzen), feste Leuchtflächen, festes Licht
// (Lampenflecken), Glut (je Bild), Licht (je Bild, additiv), Himmelsschein (nur beim Aufhellen).
// Ohne detail: keine Konturen, keine Teilchen, einfache Blitze (ein Band), weniger Zierde.

import * as THREE from 'three';
import { PULSE_BOLT, PULSE_ROD, pulseCycle, stormLight, type Pulse } from '../../game/mechanics';
import { EDGE_FREE_L, EDGE_FREE_R, EDGE_GAP, EDGE_RAMP, EDGE_TUNNEL, groundAt, projectOnTrack, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { TUNNEL_H, type World } from '../world';

// --- Teile (für Tests: was gerade wo gezeichnet ist) ---------------------------------------

/** Zielkreis am Boden (Vorwarnung eines Blitzes). */
export const PART_ZIEL = 1;
/** Schein am Rand des Zielkreises und Leitblitz (Vorwarnung eines Blitzes). */
export const PART_ZIEL_LICHT = 2;
/** Blitz, greller Fleck, Schein auf der Fahrbahn (Einschlag). */
export const PART_BLITZ = 3;
/** Nachglühen nach dem Einschlag. */
export const PART_GLIMM = 4;
/** Vorglühen eines Blitzableiters: Kugel, Entladungen, Schienen, blasses Feld. */
export const PART_VOR = 5;
/** Ladefeld auf der Fahrbahn (geladen). */
export const PART_FELD = 6;
/** Blitz in die Spitze, Lichtbögen, Schienen und Vorhänge (geladen). */
export const PART_LADUNG = 7;

export interface StormPart {
  kind: number;
  /** Nummer in track.pulses */
  pulse: number;
  mesh: THREE.Mesh;
  /** Ecken a … b (ausschließlich) im Netz. */
  a: number;
  b: number;
}

/** In group.userData.storm: was das letzte update gezeichnet hat und wo die festen Dinge stehen. */
export interface StormProbe {
  parts: StormPart[];
  count: number;
  /** Leitpfosten: je Pfosten x, y, z (Mitte des Reflektors), Abschnitt, seitlicher Abstand von der Mitte. */
  posts: Float32Array;
  /** Fuß jedes Masts (x, y, z) in der Reihenfolge der Blitzableiter in track.pulses. */
  masts: Float32Array;
  triangles: number;
}

// --- Farben ------------------------------------------------------------------------------

const BLACK: RGB = [0, 0, 0];
const C_STEEL = rgb(0x59627a);
const C_STEEL_D = rgb(0x3c4358);
const C_CONCRETE = rgb(0x7a7f8c);
const C_INSUL = rgb(0xe7dfc8);
const C_COPPER = rgb(0xc8743a);
const C_COPPER_D = rgb(0x8a4a24);
const C_POST = rgb(0x22252e);
const C_SCAR = rgb(0x363541);
const C_SCAR_RIM = rgb(0x383640);
const C_HOUSING = rgb(0x3a3f4c);
const C_BOARD = rgb(0x1a2030);

/** Gefahr: Zielkreis. */
const Z_FILL = rgb(0x5c0a30);
const Z_FILL_HI = rgb(0x8e1046);
const Z_RIM = rgb(0xff2a6a);
const Z_RIM_LO = rgb(0xb0123e);
const Z_EDGE = rgb(0xff7ab0);
const G_RED = rgb(0xff1e5a);
const G_VIOLET = rgb(0x9a5cff);
const G_CORE = rgb(0xfff4ff);
const G_BOLT_HALO = rgb(0x8f6cff);
const G_POOL = rgb(0x8c90ff);
const HOT_WHITE = rgb(0xfff8ff);
const HOT_VIOLET = rgb(0xc89cff);
const EMBER = rgb(0xc8401e);
const EMBER_D = rgb(0x5a1c14);
/** Geschenk: Ableiter und Ladefeld. */
const G_CYAN = rgb(0x46d8ff);
const G_FIELD = rgb(0x6fb4ff);
const G_ARC = rgb(0xe6f8ff);
const G_ROD_HALO = rgb(0x5aa8ff);
const L_CYAN_HI = rgb(0xd8fbff);
const L_RED = rgb(0xff2a1e);
const G_LAMP_RED = rgb(0xff2a1e);
/** Lampen. */
const L_WARM = rgb(0xffdc8c);
const G_WARM = rgb(0xffb04a);
const G_WARM_POOL = rgb(0xffc070);
const C_YELLOW = rgb(0xffd23f);
const C_SIGN_CYAN = rgb(0x8fe6ff);

// --- Maße und Ablauf -----------------------------------------------------------------------

/** Mast: Gitter bis LAT_H, Isolatoren, Kugel (Mitte, Radius), Fangspitze. */
const LAT_H = 13.6;
const INS_H = 15.0;
const BALL_Y = 15.9;
const BALL_R = 0.42;
const TIP_Y = 17.6;
/** Ladefeld: so weit vor und hinter dem Mast liegen die Schienen (m, wie radius der Physik). */
const FIELD_K = 6;
/** Raster des Ladefelds: Reihen ab GA0 Meter in Schritten von GSTEP, Spalten über die Breite. */
const GA0 = -6.5;
const GSTEP = 0.5;
const GR = 27;
const GC = 7;
/** Blitz: Höhe des Ursprungs über dem Einschlag. */
const BOLT_TOP = 90;
const ROD_TOP = 75;
/** Punkte des Hauptkanals und der Äste. */
const NP = 18;
const NB = 7;
/** Einschlag steht so viele Ticks voll und verblasst dann bis on. */
const STRIKE_FULL = 12;
/** Nachglühen nach der Gefahr (Ticks). */
const GLIMM = 60;
/** Blitz in den Ableiter: so lange sichtbar (Ticks). */
const ROD_BOLT = 26;
/** Gemalter Schein auf der Fahrbahn um einen Einschlag (m). */
const POOL_R = 11.5;
/** Leitpfosten: Abstand gerade bzw. in Kurven (m), Kurve ab dieser Krümmung (1/m); Richtungstafeln ab CHEV_CURV. */
const POST_GAP = 11;
const POST_GAP_CURVE = 6;
const POST_CURVE = 1 / 70;
const CHEV_CURV = 1 / 48;
/** Reflektor: Höhe der Mitte über der Fahrbahn, Abstand hinter der Bande. */
const REF_Y = 1.2;
const REF_OUT = 0.2;
/** Reflektoren wachsen ab dieser Entfernung mit, damit sie als Punktkette weit zu sehen bleiben. */
const REF_GROW = 65;
/** Lampen in Galerie und Stollen: Abstand (Abschnitte). */
const LAMP_GAP = 13;
/** Pro Bild geschrieben: Bodenzeichen bis GROUND_FAR, Blitze am Himmel bis SKY_FAR, Teilchen bis FX_NEAR. */
const GROUND_FAR = 260;
const SKY_FAR = 900;
const FX_NEAR = 120;

// --- Wetterleuchten: Werte für stormLight = 1 (abgestimmt im Bild) ---------------------------

/** Dunst bei vollem Wetterleuchten: Farbe und zusätzliche Sichtweite (m). */
const FOG_LIT = new THREE.Color(0x8193b8);
const FOG_FAR_ADD = 1650;
const FOG_NEAR_ADD = 70;
/** Zusätzliches Himmels- und Sonnenlicht. */
const HEMI_ADD = 2.3;
const SUN_ADD = 2.1;
/** Hintergrund bei vollem Wetterleuchten. */
const BG_LIT = new THREE.Color(0x9fb2d8);

/**
 * Wie stark die Welt bei stormLight = k aufhellt (0…1, steigt mit k). Die vielen Einschläge (k 0,28–0,38) hellen
 * kaum auf – sonst zuckte die ganze Welt alle paar Augenblicke; erst das Wetterleuchten (k 0,55 und 0,8) zeigt den
 * Kamm. Bei k = 0,8 (dem stärksten Wetterleuchten der Strecke) ist es fast taghell.
 */
export function worldLight(k: number): number {
  const x = Math.max(0, Math.min(1, k));
  const hi = Math.max(0, Math.min(1, (x - 0.3) / 0.5));
  return Math.min(1, 0.22 * x + 0.78 * hi * Math.sqrt(hi) + 0.06 * Math.max(0, x - 0.8) / 0.2);
}

// --- Dynamische Flächen ------------------------------------------------------------------

/** Ein Netz, dessen Dreiecke jedes Bild neu geschrieben werden (feste Obergrenze, keine neuen Puffer). */
class Dyn {
  readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly pa: THREE.BufferAttribute;
  private readonly ca: THREE.BufferAttribute;
  n = 0;
  private readonly max: number;

  constructor(capTris: number) {
    this.max = capTris * 3;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pa);
    this.geo.setAttribute('color', this.ca);
    this.geo.setDrawRange(0, 0);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  }

  begin(): void {
    this.n = 0;
  }

  /** Eine Ecke; je drei ergeben ein Dreieck. Über der Obergrenze wird still verworfen. */
  v(x: number, y: number, z: number, c: RGB, f = 1): void {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.col[i * 3] = c[0] * f;
    this.col[i * 3 + 1] = c[1] * f;
    this.col[i * 3 + 2] = c[2] * f;
  }

  /** Nach einer unterbrochenen Folge: auf ganze Dreiecke zurücksetzen. */
  align(): void {
    this.n -= this.n % 3;
  }

  get tris(): number {
    return Math.floor(this.n / 3);
  }

  end(): void {
    this.align();
    const n = this.n;
    this.geo.setDrawRange(0, n);
    if (n === 0) return;
    this.pa.clearUpdateRanges();
    this.pa.addUpdateRange(0, n * 3);
    this.pa.needsUpdate = true;
    this.ca.clearUpdateRanges();
    this.ca.addUpdateRange(0, n * 3);
    this.ca.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
  }
}

// --- Kleine Helfer -------------------------------------------------------------------------

/** Wiederholbarer Zufall 0…1 aus zwei Zahlen (für Zackenformen aus der Rennzeit). */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233 + a * b * 0.0137) * 43758.5453;
  return s - Math.floor(s);
}

/** k Abschnitte vor (k > 0) bzw. zurück (k < 0). */
function walkSeg(t: Track, s: number, k: number): number {
  let i = s;
  for (let n = 0; n < Math.abs(k); n++) i = k > 0 ? t.next[i] : t.prev[i];
  return i;
}

const SEG = 20;
const COS = new Float32Array(SEG + 1);
const SIN = new Float32Array(SEG + 1);
for (let i = 0; i <= SEG; i++) {
  COS[i] = Math.cos((i / SEG) * Math.PI * 2);
  SIN[i] = Math.sin((i / SEG) * Math.PI * 2);
}

/** Ein Punkt auf der Fahrbahn mit seiner (geneigten) Bodenebene. */
interface Site {
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
  fx: number;
  fz: number;
  bank: number;
  slope: number;
}

/** Ecke auf dem Boden einer Stelle: u nach rechts, w nach vorn, lift darüber. */
function gv(d: Dyn, s: Site, u: number, w: number, lift: number, c: RGB, f = 1): void {
  d.v(s.x + s.rx * u + s.fx * w, s.y + u * s.bank + w * s.slope + lift, s.z + s.rz * u + s.fz * w, c, f);
}

/** Ring auf dem Boden zwischen r0 und r1. */
function ring(d: Dyn, s: Site, r0: number, r1: number, lift: number, c: RGB, f = 1): void {
  if (r1 - r0 < 0.005) return;
  for (let i = 0; i < SEG; i++) {
    const ca = COS[i];
    const sa = SIN[i];
    const cb = COS[i + 1];
    const sb = SIN[i + 1];
    gv(d, s, ca * r0, sa * r0, lift, c, f);
    gv(d, s, ca * r1, sa * r1, lift, c, f);
    gv(d, s, cb * r1, sb * r1, lift, c, f);
    gv(d, s, ca * r0, sa * r0, lift, c, f);
    gv(d, s, cb * r1, sb * r1, lift, c, f);
    gv(d, s, cb * r0, sb * r0, lift, c, f);
  }
}

/** Scheibe auf dem Boden: Mitte c, Rand cEdge. */
function disc(d: Dyn, s: Site, r: number, lift: number, c: RGB, cEdge: RGB, f = 1): void {
  for (let i = 0; i < SEG; i++) {
    gv(d, s, 0, 0, lift, c, f);
    gv(d, s, COS[i] * r, SIN[i] * r, lift, cEdge, f);
    gv(d, s, COS[i + 1] * r, SIN[i + 1] * r, lift, cEdge, f);
  }
}

/** Leuchtender Vorhang (additiv) am Rand radius r: unten hell, nach oben schwarz. */
function curtain(d: Dyn, s: Site, r: number, h: number, c: RGB, f: number): void {
  if (f <= 0.01 || h <= 0.01) return;
  for (let i = 0; i < SEG; i++) {
    const ca = COS[i] * r;
    const sa = SIN[i] * r;
    const cb = COS[i + 1] * r;
    const sb = SIN[i + 1] * r;
    gv(d, s, ca, sa, 0.05, c, f);
    gv(d, s, cb, sb, 0.05, c, f);
    gv(d, s, cb, sb, h, BLACK);
    gv(d, s, ca, sa, 0.05, c, f);
    gv(d, s, cb, sb, h, BLACK);
    gv(d, s, ca, sa, h, BLACK);
  }
}

const BLOB = 10;
/** Weicher Lichtfleck (additiv), zur Kamera gedreht: hell in der Mitte, schwarz am Rand. */
function glowBlob(d: Dyn, x: number, y: number, z: number, cam: THREE.Vector3, w: number, h: number, c: RGB, f: number): void {
  if (f <= 0.01) return;
  let hx = cam.z - z;
  let hz = x - cam.x;
  const l = Math.hypot(hx, hz) || 1;
  hx /= l;
  hz /= l;
  for (let i = 0; i < BLOB; i++) {
    const a0 = (i / BLOB) * Math.PI * 2;
    const a1 = ((i + 1) / BLOB) * Math.PI * 2;
    d.v(x, y, z, c, f);
    d.v(x + hx * Math.cos(a0) * w, y + Math.sin(a0) * h, z + hz * Math.cos(a0) * w, BLACK);
    d.v(x + hx * Math.cos(a1) * w, y + Math.sin(a1) * h, z + hz * Math.cos(a1) * w, BLACK);
  }
}

/** Leuchtpunkt: Doppelpyramide mit Radius r. */
function lampD(d: Dyn, x: number, y: number, z: number, r: number, c: RGB, f = 1): void {
  const h = r * 1.35;
  for (let k = 0; k < 4; k++) {
    const a0 = (k / 4) * Math.PI * 2;
    const a1 = ((k + 1) / 4) * Math.PI * 2;
    const x0 = x + Math.cos(a0) * r;
    const z0 = z + Math.sin(a0) * r;
    const x1 = x + Math.cos(a1) * r;
    const z1 = z + Math.sin(a1) * r;
    d.v(x, y + h, z, c, f);
    d.v(x0, y, z0, c, f * 0.9);
    d.v(x1, y, z1, c, f * 0.9);
    d.v(x, y - h, z, c, f * 0.75);
    d.v(x0, y, z0, c, f * 0.9);
    d.v(x1, y, z1, c, f * 0.9);
  }
}

/** Seitenvektoren eines Bandes (je Punkt), zur Kamera gedreht. */
const SIDE = new Float32Array(64 * 3);
/**
 * Leuchtband durch n Punkte (pts: x, y, z hintereinander), zur Kamera gedreht; Breite w0 am Anfang, w1 am Ende,
 * Helligkeit f0 … f1.
 */
function ribbon(d: Dyn, pts: Float32Array, n: number, cam: THREE.Vector3, w0: number, w1: number, c: RGB, f0: number, f1: number): void {
  if (n < 2 || Math.max(f0, f1) <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 3;
    const b = Math.min(n - 1, i + 1) * 3;
    const dx = pts[b] - pts[a];
    const dy = pts[b + 1] - pts[a + 1];
    const dz = pts[b + 2] - pts[a + 2];
    const vx = pts[i * 3] - cam.x;
    const vy = pts[i * 3 + 1] - cam.y;
    const vz = pts[i * 3 + 2] - cam.z;
    let sx = dy * vz - dz * vy;
    let sy = dz * vx - dx * vz;
    let sz = dx * vy - dy * vx;
    const l = Math.hypot(sx, sy, sz) || 1;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / l;
    sx *= w;
    sy *= w;
    sz *= w;
    SIDE[i * 3] = sx;
    SIDE[i * 3 + 1] = sy;
    SIDE[i * 3 + 2] = sz;
  }
  for (let i = 0; i + 1 < n; i++) {
    const p = i * 3;
    const q = p + 3;
    const fa = f0 + (f1 - f0) * (i / (n - 1));
    const fb = f0 + (f1 - f0) * ((i + 1) / (n - 1));
    d.v(pts[p] - SIDE[p], pts[p + 1] - SIDE[p + 1], pts[p + 2] - SIDE[p + 2], c, fa);
    d.v(pts[p] + SIDE[p], pts[p + 1] + SIDE[p + 1], pts[p + 2] + SIDE[p + 2], c, fa);
    d.v(pts[q] + SIDE[q], pts[q + 1] + SIDE[q + 1], pts[q + 2] + SIDE[q + 2], c, fb);
    d.v(pts[p] - SIDE[p], pts[p + 1] - SIDE[p + 1], pts[p + 2] - SIDE[p + 2], c, fa);
    d.v(pts[q] + SIDE[q], pts[q + 1] + SIDE[q + 1], pts[q + 2] + SIDE[q + 2], c, fb);
    d.v(pts[q] - SIDE[q], pts[q + 1] - SIDE[q + 1], pts[q + 2] - SIDE[q + 2], c, fb);
  }
}

/**
 * Ein Balken als dreiseitiges Prisma von a nach b (Breite w) – für Gittermaste.
 */
function beam(mb: MeshBuilder, a: V3, b: V3, w: number, c: RGB, c2: RGB = c): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  const d: V3 = [dx / l, dy / l, dz / l];
  // Senkrechte: gegen die Hochachse, bei senkrechten Balken gegen x.
  const ref: V3 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let u: V3 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
  const ul = Math.hypot(u[0], u[1], u[2]) || 1;
  u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: V3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const cs: V3[] = [];
  for (let k = 0; k < 3; k++) {
    const an = (k / 3) * Math.PI * 2;
    const ca = Math.cos(an) * w * 0.6;
    const sa = Math.sin(an) * w * 0.6;
    cs.push([u[0] * ca + v[0] * sa, u[1] * ca + v[1] * sa, u[2] * ca + v[2] * sa]);
  }
  for (let k = 0; k < 3; k++) {
    const p = cs[k];
    const q = cs[(k + 1) % 3];
    mb.quad([a[0] + p[0], a[1] + p[1], a[2] + p[2]], [a[0] + q[0], a[1] + q[1], a[2] + q[2]], [b[0] + q[0], b[1] + q[1], b[2] + q[2]], [b[0] + p[0], b[1] + p[1], b[2] + p[2]], k === 0 ? c2 : c);
  }
}

/** Senkrechtes n-Eck-Prisma (Scheibe, Säule) um (x, z) von y0 bis y1, mit Deckel oben und unten. */
function prism(mb: MeshBuilder, x: number, z: number, r: number, y0: number, y1: number, n: number, c: RGB, top: RGB = c): void {
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    const p0: V3 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r];
    const p1: V3 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
    const q0: V3 = [p0[0], y1, p0[2]];
    const q1: V3 = [p1[0], y1, p1[2]];
    mb.quad(p0, q0, q1, p1, c);
    mb.tri([x, y1, z], q1, q0, top);
    mb.tri([x, y0, z], p0, p1, c);
  }
}

// --- Zustände --------------------------------------------------------------------------------

interface BoltState {
  p: Pulse;
  idx: number;
  s: Site;
  /** Abschnitte um die Einschlagstelle: segs[k + 12] für k = −12 … 12. */
  segs: Int32Array;
  path: Float32Array;
  br0: Float32Array;
  br1: Float32Array;
  last: number;
  acc: number;
}

interface RodState {
  p: Pulse;
  idx: number;
  /** Fuß des Masts. */
  x: number;
  y: number;
  z: number;
  /**
   * Feld um den Mast im geraden Rahmen seines Abschnitts (so rechnet die Physik): GR Reihen von GA0 Meter
   * voraus in Schritten von GSTEP, GC Spalten von −wh bis +wh; je Knoten x, y (Fahrbahnhöhe), z.
   */
  grid: Float32Array;
  /** Ecken der drei Beine unten und oben (für die Entladungen): x, z je Bein. */
  legs: Float32Array;
  path: Float32Array;
  last: number;
}

export function buildStorm(track: Track, detail: boolean, world: World): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'gewitter';
  const disposables: { dispose(): void }[] = [];

  /** Punkt im Rahmen eines Abschnitts: seitlich lat, dy über der Fahrbahn, fwd voraus. */
  const P = (s: number, lat: number, dy: number, fwd = 0): V3 => [
    t.px[s] + rightX(t, s) * lat + t.tx[s] * fwd,
    t.py[s] + lat * t.bank[s] + dy,
    t.pz[s] + rightZ(t, s) * lat + t.tz[s] * fwd,
  ];
  const siteAt = (seg: number, x: number, y: number, z: number): Site => {
    const a = t.prev[seg];
    const b = t.next[seg];
    return { x, y, z, rx: rightX(t, seg), rz: rightZ(t, seg), fx: t.tx[seg], fz: t.tz[seg], bank: t.bank[seg], slope: (t.py[b] - t.py[a]) / (2 * t.step) };
  };

  /** Ergebnis von roadAt und gridAt (kein Garbage pro Bild). */
  let ox = 0;
  let oy = 0;
  let oz = 0;
  /** Punkt im Feld eines Masts: a Meter voraus, Spalte c (0 … GC−1, gebrochen), lift über der Fahrbahn → ox, oy, oz. */
  const gridAt = (g: Float32Array, a: number, c: number, lift: number): void => {
    const fr = (a - GA0) / GSTEP;
    const i0 = Math.max(0, Math.min(GR - 2, Math.floor(fr)));
    const u = fr - i0;
    const c0 = Math.max(0, Math.min(GC - 2, Math.floor(c)));
    const v = c - c0;
    const o00 = (i0 * GC + c0) * 3;
    const o01 = o00 + 3;
    const o10 = o00 + GC * 3;
    const o11 = o10 + 3;
    for (let k = 0; k < 3; k++) {
      const val = (g[o00 + k] * (1 - v) + g[o01 + k] * v) * (1 - u) + (g[o10 + k] * (1 - v) + g[o11 + k] * v) * u;
      if (k === 0) ox = val;
      else if (k === 1) oy = val + lift;
      else oz = val;
    }
  };

  const solid = new MeshBuilder(); // mit Kontur
  const flat = new MeshBuilder(); // ohne Kontur (Pfosten, Narben, Schienen)
  const shine = new MeshBuilder(); // selbstleuchtend, ohne Dunst
  const pools = new LightBuilder(); // gemaltes Licht (additiv, Helligkeit je Ecke)

  // === Blitzableiter: Mast, Schienen =========================================================
  const rods: RodState[] = [];
  const bolts: BoltState[] = [];
  const mastPos: number[] = [];
  t.pulses.forEach((p, idx) => {
    if (p.kind === PULSE_ROD) {
      const s = p.seg;
      const grid = new Float32Array(GR * GC * 3);
      for (let a = 0; a < GR; a++) {
        for (let c = 0; c < GC; c++) {
          const along = GA0 + a * GSTEP;
          const lat = -t.wh[s] + (2 * t.wh[s] * c) / (GC - 1);
          const x = t.px[s] + t.tx[s] * along + rightX(t, s) * lat;
          const z = t.pz[s] + t.tz[s] * along + rightZ(t, s) * lat;
          const pr = projectOnTrack(t, x, z, s);
          const o = (a * GC + c) * 3;
          grid[o] = x;
          grid[o + 1] = groundAt(t, pr.seg, pr.along, pr.lat);
          grid[o + 2] = z;
        }
      }
      const rx = rightX(t, s);
      const rz = rightZ(t, s);
      const fx = t.tx[s];
      const fz = t.tz[s];
      const out = p.lat >= 0 ? 1 : -1;
      const by = p.y;
      // Fundament
      solid.box(p.x, by + 0.05, p.z, 2.2, 1.1, 2.2, C_CONCRETE, Math.atan2(fx, fz), shadeC(C_CONCRETE, 1.1));
      // Gitter: drei Beine, die sich nach oben verjüngen, dazwischen Zickzackstreben.
      const legs = new Float32Array(12);
      const legAt = (k: number, h: number): V3 => {
        const r = 0.95 - 0.62 * (h / LAT_H);
        // erstes Bein zur Fahrbahn hin
        const an = (k / 3) * Math.PI * 2 + Math.PI;
        const ux = rx * out;
        const uz = rz * out;
        const cx = Math.cos(an) * r;
        const cz = Math.sin(an) * r;
        return [p.x + ux * cx + fx * cz, by + h, p.z + uz * cx + fz * cz];
      };
      for (let k = 0; k < 3; k++) {
        const a = legAt(k, -2);
        const b = legAt(k, LAT_H);
        beam(solid, a, b, 0.16, C_STEEL, C_STEEL_D);
        legs[k * 4] = a[0];
        legs[k * 4 + 1] = a[2];
        legs[k * 4 + 2] = b[0];
        legs[k * 4 + 3] = b[2];
      }
      const levels = detail ? 8 : 5;
      for (let l = 0; l < levels; l++) {
        const h0 = 0.4 + (l / levels) * (LAT_H - 0.4);
        const h1 = 0.4 + ((l + 1) / levels) * (LAT_H - 0.4);
        for (let k = 0; k < 3; k++) {
          const k2 = (k + 1) % 3;
          if (l % 2 === 0) beam(solid, legAt(k, h0), legAt(k2, h1), 0.08, C_STEEL_D);
          else beam(solid, legAt(k2, h0), legAt(k, h1), 0.08, C_STEEL_D);
        }
      }
      // Plattform oben, Isolatoren, Stab mit Kugel und Fangspitze.
      prism(solid, p.x, p.z, 0.62, by + LAT_H - 0.05, by + LAT_H + 0.2, 6, C_STEEL_D, C_STEEL);
      const ni = detail ? 4 : 3;
      for (let k = 0; k < ni; k++) {
        const y0 = by + LAT_H + 0.25 + (k / ni) * (INS_H - LAT_H - 0.3);
        prism(solid, p.x, p.z, 0.36, y0, y0 + 0.16, detail ? 8 : 6, C_INSUL);
        prismAt(flat, p.x, p.z, 0.1, y0 + 0.16, y0 + (INS_H - LAT_H - 0.3) / ni + 0.01, C_STEEL_D);
      }
      beam(solid, [p.x, by + INS_H - 0.05, p.z], [p.x, by + BALL_Y, p.z], 0.13, C_COPPER, C_COPPER_D);
      {
        const geo = new THREE.IcosahedronGeometry(BALL_R, detail ? 1 : 0);
        const m = new THREE.Matrix4().makeTranslation(p.x, by + BALL_Y, p.z);
        solid.add(geo, C_COPPER, m);
        geo.dispose();
      }
      beam(solid, [p.x, by + BALL_Y, p.z], [p.x, by + TIP_Y, p.z], 0.07, C_COPPER, C_COPPER_D);
      // Arm für die Flugwarnlampe, zur Fahrbahn hin.
      const lampX = p.x - rx * out * 0.75;
      const lampZ = p.z - rz * out * 0.75;
      beam(solid, [p.x, by + LAT_H + 0.1, p.z], [lampX, by + LAT_H + 0.1, lampZ], 0.08, C_STEEL_D);
      prism(solid, lampX, lampZ, 0.13, by + LAT_H + 0.05, by + LAT_H + 0.22, 6, C_HOUSING);
      // Kupferschienen quer über die Fahrbahn, bündig – sie rahmen das Ladefeld.
      for (const k of [-FIELD_K, FIELD_K]) {
        const n = 6;
        for (let q = 0; q < n; q++) {
          const c0 = ((GC - 1) * q) / n;
          const c1 = ((GC - 1) * (q + 1)) / n;
          const G = (a: number, c: number, lift: number): V3 => {
            gridAt(grid, a, c, lift);
            return [ox, oy, oz];
          };
          triQuadUp(flat, G(k - 0.2, c0, 0.022), G(k - 0.2, c1, 0.022), G(k + 0.2, c1, 0.022), G(k + 0.2, c0, 0.022), C_COPPER);
          // dunkle Fassung zu beiden Seiten
          triQuadUp(flat, G(k - 0.32, c0, 0.018), G(k - 0.32, c1, 0.018), G(k - 0.2, c1, 0.018), G(k - 0.2, c0, 0.018), C_COPPER_D);
          triQuadUp(flat, G(k + 0.2, c0, 0.018), G(k + 0.2, c1, 0.018), G(k + 0.32, c1, 0.018), G(k + 0.32, c0, 0.018), C_COPPER_D);
        }
      }
      mastPos.push(p.x, by, p.z);
      rods.push({ p, idx, x: p.x, y: by, z: p.z, grid, legs, path: new Float32Array(NP * 3), last: -1e9 });
    } else if (p.kind === PULSE_BOLT) {
      const segs = new Int32Array(25);
      for (let k = -12; k <= 12; k++) segs[k + 12] = walkSeg(t, p.seg, k);
      const s = siteAt(p.seg, p.x, p.y, p.z);
      // Narbe: ein dunkler, gezackter Stern auf der Fahrbahn – verrät, wo es immer wieder einschlägt.
      const N = 14;
      const R = p.radius;
      const Q = (i: number, r: number): V3 => {
        const a = (i / N) * Math.PI * 2;
        const u = Math.cos(a) * r;
        const w = Math.sin(a) * r;
        return [s.x + s.rx * u + s.fx * w, s.y + u * s.bank + w * s.slope + 0.015, s.z + s.rz * u + s.fz * w];
      };
      const center: V3 = [s.x, s.y + 0.016, s.z];
      for (let i = 0; i < N; i++) {
        const rr = (j: number): number => R * (j % 2 === 0 ? 0.48 : 0.22) * (0.75 + 0.5 * hash(j % N, p.seg));
        triUp(flat, center, Q(i, rr(i)), Q(i + 1, rr(i + 1)), i % 3 === 0 ? C_SCAR_RIM : C_SCAR);
      }
      bolts.push({ p, idx, s, segs, path: new Float32Array(NP * 3), br0: new Float32Array(NB * 3), br1: new Float32Array(NB * 3), last: -1e9, acc: 0 });
    }
  });

  // === Leitpfosten ==========================================================================
  const postList: number[] = [];
  /** je Pfosten: x, y, z, Gierwinkel, Farbe (0 rot, 1 weiß) */
  const refl: number[] = [];
  const placePosts = (from: number, count: number): void => {
    let since = 1e9;
    for (let k = 0; k < count; k++) {
      const i = from + k;
      since += t.step;
      const e = t.edge[i];
      const gap = Math.abs(t.curv[i]) > POST_CURVE ? POST_GAP_CURVE : POST_GAP;
      if (since < gap) continue;
      // nicht im Tunnel und Stollen, nicht auf Schanze und Lücke, nicht an Tunnelmündungen
      let bad = false;
      for (let q = -3; q <= 3; q++) {
        const j = walkSeg(t, i, q);
        if (t.edge[j] & (EDGE_TUNNEL | EDGE_GAP | EDGE_RAMP)) bad = true;
      }
      if (bad || e & (EDGE_TUNNEL | EDGE_GAP | EDGE_RAMP)) continue;
      since = 0;
      const yaw = Math.atan2(t.tx[i], t.tz[i]);
      for (const sgn of [-1, 1]) {
        if (e & (sgn < 0 ? EDGE_FREE_L : EDGE_FREE_R)) continue;
        // Wo die freie Seite gerade endet, liegt der Keil zwischen den Fahrbahnen noch eng an: dort keinen Pfosten.
        if (t.edge[walkSeg(t, i, -4)] & (sgn < 0 ? EDGE_FREE_L : EDGE_FREE_R) || t.edge[walkSeg(t, i, 4)] & (sgn < 0 ? EDGE_FREE_L : EDGE_FREE_R)) continue;
        const lat = sgn * (t.wh[i] + REF_OUT);
        const c = P(i, lat, REF_Y);
        // nicht auf einer anderen Fahrbahn, die hier vorbeiführt
        const pr = projectOnTrack(t, c[0], c[2], i);
        if (Math.abs(pr.lat) < t.wh[pr.seg] + 0.1 || t.edge[pr.seg] & EDGE_TUNNEL) continue;
        // Pfosten: schmale dunkle Säule, unten im Boden
        const base = P(i, lat, -0.4);
        postAt(flat, base[0], base[2], t.tx[i], t.tz[i], 0.06, base[1], c[1] - 0.15, C_POST);
        postList.push(c[0], c[1], c[2], i, lat);
        refl.push(c[0], c[1], c[2], yaw, sgn < 0 ? 0 : 1);
        // Richtungstafel an der Außenseite enger Kurven
        const outer = t.curv[i] > 0 ? -1 : 1;
        if (sgn === outer && Math.abs(t.curv[i]) > CHEV_CURV) chevronBoard(i, sgn);
      }
    }
  };
  /** Gelbe Richtungstafel (Pfeil „>“ in Richtung der Kurve) außen hinter der Bande. */
  const chevronBoard = (i: number, sgn: number): void => {
    const lat = sgn * (t.wh[i] + 0.75);
    const c = P(i, lat, 1.55);
    const rx = rightX(t, i);
    const rz = rightZ(t, i);
    const dir = -sgn; // Kurve geht zur anderen Seite
    const W = 0.42;
    const H = 0.5;
    const q = (u: number, v: number, dd: number): V3 => [c[0] + rx * u - t.tx[i] * dd, c[1] + v, c[2] + rz * u - t.tz[i] * dd];
    shine.quad(q(-W, -H, 0), q(W, -H, 0), q(W, H, 0), q(-W, H, 0), C_BOARD);
    // Winkel aus zwei Schenkeln
    const th = 0.16;
    const tip = 0.26 * dir;
    const back = -0.18 * dir;
    shine.quad(q(back, 0.36, 0.07), q(back + th * dir, 0.36, 0.07), q(tip + th * dir, 0, 0.07), q(tip, 0, 0.07), C_YELLOW);
    shine.quad(q(tip, 0, 0.07), q(tip + th * dir, 0, 0.07), q(back + th * dir, -0.36, 0.07), q(back, -0.36, 0.07), C_YELLOW);
    const base = P(i, lat, -0.4);
    postAt(flat, base[0], base[2], t.tx[i], t.tz[i], 0.06, base[1], c[1] - H, C_POST);
  };
  placePosts(0, t.n);
  for (const b of t.branches) placePosts(b.first, b.count);

  // === Lampen in Galerie und Stollen ========================================================
  const lampRows: { seg: number; lat: number; y: number }[] = [];
  {
    let since = 0;
    let side = 1;
    for (let i = 0; i < t.total; i++) {
      if (!(t.edge[i] & EDGE_TUNNEL)) {
        since = LAMP_GAP - 4;
        continue;
      }
      since++;
      if (since < LAMP_GAP) continue;
      // nicht direkt am Ausgang
      if (!(t.edge[walkSeg(t, i, 3)] & EDGE_TUNNEL)) continue;
      since = 0;
      side = -side;
      const gallery = t.branchOf[i] >= 0;
      // Galerie: an der Decke über der Mitte; Stollen: an der Bergwand, abwechselnd links und rechts.
      lampRows.push(gallery ? { seg: i, lat: 0, y: TUNNEL_H - 0.32 } : { seg: i, lat: side * (t.wh[i] - 0.1), y: 4.1 });
    }
  }
  for (const l of lampRows) {
    const i = l.seg;
    const c = P(i, l.lat, l.y);
    const yaw = Math.atan2(t.tx[i], t.tz[i]);
    const ceiling = l.lat === 0;
    if (ceiling) {
      solid.box(c[0], c[1] + 0.12, c[2], 1.5, 0.22, 0.55, C_HOUSING, yaw);
      shine.box(c[0], c[1] - 0.02, c[2], 1.3, 0.1, 0.38, L_WARM, yaw);
    } else {
      solid.box(c[0], c[1], c[2], 0.5, 0.5, 1.0, C_HOUSING, yaw);
      const inward = -Math.sign(l.lat);
      const g = P(i, l.lat + inward * 0.27, l.y);
      shine.box(g[0], g[1], g[2], 0.06, 0.34, 0.8, L_WARM, yaw);
    }
    // Gemalter Lichtfleck auf der Fahrbahn darunter: hell in der Mitte, zum Rand schwarz.
    const centerLat = ceiling ? 0 : l.lat * 0.55;
    const R = ceiling ? 7.5 : 6.5;
    const rows = 5;
    const cols = 5;
    const wh = t.wh[i];
    const at = (a: number, b: number): { p: V3; f: number } => {
      const along = -R + (2 * R * a) / rows;
      const lat = -wh + (2 * wh * b) / cols;
      const k = Math.round(along);
      const sg = walkSeg(t, i, k);
      const p = P(sg, lat, 0.05, along - k);
      const d = Math.hypot(along, (lat - centerLat) * 1.1) / R;
      return { p, f: Math.max(0, 1 - d) ** 1.6 };
    };
    for (let a = 0; a < rows; a++) {
      for (let b = 0; b < cols; b++) {
        const p00 = at(a, b);
        const p10 = at(a + 1, b);
        const p11 = at(a + 1, b + 1);
        const p01 = at(a, b + 1);
        pools.soft(p00, p10, p11, G_WARM_POOL, 0.42);
        pools.soft(p00, p11, p01, G_WARM_POOL, 0.42);
      }
    }
    // Schein um die Lampe: zwei gekreuzte, weiche Flächen.
    for (const rot of [0, Math.PI / 2]) {
      const ax = Math.sin(yaw + rot);
      const az = Math.cos(yaw + rot);
      const w = ceiling ? 1.6 : 1.1;
      const h = ceiling ? 0.9 : 1.1;
      const n = 8;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        pools.tri([c[0], c[1], c[2]], [c[0] + ax * Math.cos(a0) * w, c[1] + Math.sin(a0) * h, c[2] + az * Math.cos(a0) * w], [c[0] + ax * Math.cos(a1) * w, c[1] + Math.sin(a1) * h, c[2] + az * Math.cos(a1) * w], scaleRgb(G_WARM, 0.5), BLACK, BLACK);
      }
    }
  }
  // Mündungen der Galerie: warmer Schein im Portal – der Eingang leuchtet einladend aus der Nacht.
  for (let i = 0; i < t.total; i++) {
    if (t.branchOf[i] < 0 || !(t.edge[i] & EDGE_TUNNEL)) continue;
    const first = !(t.edge[t.prev[i]] & EDGE_TUNNEL);
    const last = !(t.edge[t.next[i]] & EDGE_TUNNEL);
    if (!first && !last) continue;
    const s = walkSeg(t, i, first ? 2 : -2);
    const W = t.wh[s] + 0.6;
    const ctr = P(s, 0, 2.0);
    const n = 12;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI;
      const a1 = ((k + 1) / n) * Math.PI;
      const e0 = P(s, Math.cos(a0) * W, Math.sin(a0) * (TUNNEL_H - 0.3));
      const e1 = P(s, Math.cos(a1) * W, Math.sin(a1) * (TUNNEL_H - 0.3));
      pools.tri(ctr, e0, e1, scaleRgb(G_WARM, 0.36), BLACK, BLACK);
    }
  }

  // === Wegweiser vor der Gabelung ===========================================================
  for (const b of t.branches) {
    const s = walkSeg(t, b.from, -26);
    const sgn = 1; // rechts der Fahrbahn
    const lat = sgn * (t.wh[s] + 1.3);
    const base = P(s, lat, 0);
    // Die Tafel schaut den Anfahrenden entgegen (auf einen Punkt 40 m vorher auf der Fahrbahnmitte).
    const eye = P(walkSeg(t, s, -40), 0, 0);
    let fx = base[0] - eye[0];
    let fz = base[2] - eye[2];
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const rx = -fz;
    const rz = fx;
    const yaw = Math.atan2(fx, fz);
    // Tafel in Einheiten von S Metern (Zeichen groß genug, um sie aus 40 m zu lesen)
    const S = 1.45;
    const W = 2.0;
    const y0 = 2.2;
    const y1 = y0 + 1.8 * S;
    for (const u of [-1.5 * S, 1.5 * S]) {
      const px = base[0] + rx * u;
      const pz = base[2] + rz * u;
      solid.box(px, base[1] + (y0 + 0.2) / 2 - 0.5, pz, 0.2, y0 + 1.2, 0.2, C_STEEL_D, yaw);
    }
    solid.box(base[0], base[1] + (y0 + y1) / 2, base[2], 2 * W * S + 0.2, y1 - y0 + 0.2, 0.16, C_STEEL_D, yaw);
    const cy = base[1] + (y0 + y1) / 2;
    const q = (u: number, v: number, dd: number): V3 => [base[0] + rx * u * S - fx * dd, cy + v * S, base[2] + rz * u * S - fz * dd];
    const rect = (u0: number, v0: number, u1: number, v1: number, dd: number, c: RGB): void => shine.quad(q(u0, v0, dd), q(u1, v0, dd), q(u1, v1, dd), q(u0, v1, dd), c);
    rect(-W, -0.88, W, 0.88, 0.24, C_BOARD);
    rect(-0.03, -0.8, 0.03, 0.8, 0.27, scaleRgb(C_SIGN_CYAN, 0.4));
    // Links: „Galerie“ – Pfeil nach links oben, darüber ein Dach mit Lampe (warm).
    const L = -W / 2;
    rect(L - 0.13, -0.75, L + 0.13, -0.1, 0.3, L_WARM);
    shine.quad(q(L - 0.13, -0.17, 0.3), q(L + 0.13, -0.03, 0.3), q(L - 0.42, 0.25, 0.3), q(L - 0.6, 0.04, 0.3), L_WARM);
    shine.tri(q(L - 0.86, 0.33, 0.3), q(L - 0.28, 0.45, 0.3), q(L - 0.67, -0.13, 0.3), L_WARM);
    // Dach (Galerie) und Lampe darunter
    shine.tri(q(L + 0.05, 0.55, 0.3), q(L + 0.85, 0.55, 0.3), q(L + 0.45, 0.82, 0.3), L_WARM);
    rect(L + 0.12, 0.2, L + 0.2, 0.55, 0.3, L_WARM);
    rect(L + 0.7, 0.2, L + 0.78, 0.55, 0.3, L_WARM);
    rect(L + 0.36, 0.3, L + 0.54, 0.46, 0.33, rgb(0xfff2c0));
    // Rechts: „Grat“ – Pfeil geradeaus, daneben ein Blitz (Gefahr, magenta).
    const Rr = W / 2;
    rect(Rr - 0.46, -0.75, Rr - 0.2, 0.25, 0.3, C_SIGN_CYAN);
    shine.tri(q(Rr - 0.7, 0.22, 0.3), q(Rr + 0.04, 0.22, 0.3), q(Rr - 0.33, 0.8, 0.3), C_SIGN_CYAN);
    shine.quad(q(Rr + 0.42, 0.75, 0.3), q(Rr + 0.62, 0.75, 0.3), q(Rr + 0.36, 0.05, 0.3), q(Rr + 0.18, 0.05, 0.3), Z_RIM);
    shine.quad(q(Rr + 0.18, 0.3, 0.3), q(Rr + 0.6, 0.3, 0.3), q(Rr + 0.58, -0.02, 0.3), q(Rr + 0.16, -0.02, 0.3), Z_RIM);
    shine.tri(q(Rr + 0.42, 0.05, 0.3), q(Rr + 0.6, 0.05, 0.3), q(Rr + 0.3, -0.72, 0.3), Z_RIM);
    // Lampenleiste über der Tafel, und ihr Schein auf der Tafel
    solid.box(base[0] - fx * 0.35, cy + 1.02 * S, base[2] - fz * 0.35, 2 * W * S, 0.14, 0.4, C_HOUSING, yaw);
    rect(-W + 0.1, 0.98, W - 0.1, 1.04, 0.47, L_WARM);
    const n = 10;
    for (let k = 0; k < n; k++) {
      const u0 = -W + (2 * W * k) / n;
      const u1 = -W + (2 * W * (k + 1)) / n;
      const top = scaleRgb(G_WARM, 0.07);
      pools.tri(q(u0, 0.95, 0.38), q(u1, 0.95, 0.38), q(u1, -0.9, 0.38), top, top, BLACK);
      pools.tri(q(u0, 0.95, 0.38), q(u1, -0.9, 0.38), q(u0, -0.9, 0.38), top, BLACK, BLACK);
    }
  }

  // === Feste Netze ==========================================================================
  let staticTris = 0;
  {
    const solidGeo = solid.build();
    const flatGeo = flat.build();
    const allGeo = mergeColored([solidGeo, flatGeo]);
    const mat = toonMaterial({ vertexColors: true });
    // Narben und Schienen liegen wenige Zentimeter über der Fahrbahn: etwas nach vorn ziehen.
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -4;
    const mesh = new THREE.Mesh(allGeo, mat);
    mesh.name = 'gewitter-koerper';
    mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(allGeo, flatGeo, mat);
    staticTris += allGeo.getAttribute('position').count / 3;
    if (detail && !solid.empty) {
      addSmoothNormals(solidGeo);
      const olMat = outlineMaterial(0.03);
      const ol = new THREE.Mesh(solidGeo, olMat);
      ol.name = 'outline';
      ol.frustumCulled = false;
      group.add(ol);
      disposables.push(olMat);
      staticTris += solid.triangles;
    }
    disposables.push(solidGeo);

    const shineGeo = shine.build();
    const shineMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
    const shineMesh = new THREE.Mesh(shineGeo, shineMat);
    shineMesh.name = 'gewitter-leuchten';
    shineMesh.frustumCulled = false;
    group.add(shineMesh);
    disposables.push(shineGeo, shineMat);
    staticTris += shine.triangles;

    const poolGeo = pools.build();
    const poolMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -10,
    });
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.name = 'gewitter-lampenlicht';
    poolMesh.frustumCulled = false;
    poolMesh.renderOrder = 2;
    group.add(poolMesh);
    disposables.push(poolGeo, poolMat);
    staticTris += pools.triangles;
  }

  // === Reflektoren (Instanzen, wachsen mit der Entfernung) ===================================
  const nRefl = refl.length / 5;
  const reflGeo = new THREE.BufferGeometry();
  {
    // Zwei gekreuzte Plättchen (sichtbar aus jeder Richtung), Mitte im Ursprung.
    const w = 0.11;
    const h = 0.17;
    const pos = [-w, -h, 0, w, -h, 0, w, h, 0, -w, -h, 0, w, h, 0, -w, h, 0, 0, -h, -w, 0, -h, w, 0, h, w, 0, -h, -w, 0, h, w, 0, h, -w];
    reflGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  }
  const reflMat = new THREE.MeshBasicMaterial({ fog: false, side: THREE.DoubleSide });
  const reflMesh = new THREE.InstancedMesh(reflGeo, reflMat, Math.max(1, nRefl));
  reflMesh.name = 'leitpfosten';
  reflMesh.frustumCulled = false;
  reflMesh.count = nRefl;
  {
    const red = new THREE.Color().setRGB(0.95, 0.09, 0.07);
    const white = new THREE.Color().setRGB(0.82, 0.86, 0.95);
    for (let i = 0; i < nRefl; i++) reflMesh.setColorAt(i, refl[i * 5 + 4] === 0 ? red : white);
    if (reflMesh.instanceColor) reflMesh.instanceColor.needsUpdate = true;
  }
  group.add(reflMesh);
  disposables.push(reflGeo, reflMat, reflMesh);
  const reflData = new Float32Array(refl);
  const reflSin = new Float32Array(nRefl);
  const reflCos = new Float32Array(nRefl);
  for (let i = 0; i < nRefl; i++) {
    reflSin[i] = Math.sin(reflData[i * 5 + 3]);
    reflCos[i] = Math.cos(reflData[i * 5 + 3]);
  }
  staticTris += nRefl * 4;

  // === Pro Bild geschriebene Flächen =======================================================
  const glow = new Dyn(5000);
  const light = new Dyn(9000);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const lightMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -12,
  });
  const glowMesh = new THREE.Mesh(glow.geo, glowMat);
  const lightMesh = new THREE.Mesh(light.geo, lightMat);
  glowMesh.name = 'gewitter-glut';
  lightMesh.name = 'gewitter-licht';
  glowMesh.frustumCulled = false;
  lightMesh.frustumCulled = false;
  lightMesh.renderOrder = 4;
  group.add(glowMesh, lightMesh);
  disposables.push(glow, light, glowMat, lightMat);

  // === Himmelsschein beim Wetterleuchten (additive Kuppel hinter allem) ==========================
  const domeGeo = new THREE.SphereGeometry(2300, 18, 9);
  {
    const p = domeGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i) / 2300;
      // am Horizont am hellsten (Wolkenbänke im Gegenlicht), zum Scheitel kühler und dunkler
      const k = h < -0.05 ? 0.25 : 1 - 0.55 * smooth(h / 0.8);
      col[i * 3] = 0.42 * k;
      col[i * 3 + 1] = 0.48 * k;
      col[i * 3 + 2] = 0.66 * k;
    }
    domeGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.name = 'gewitter-himmel';
  dome.frustumCulled = false;
  dome.renderOrder = -9;
  dome.visible = false;
  group.add(dome);
  disposables.push(domeGeo, domeMat);

  // === Licht der Welt: Ausgangswerte ========================================================
  const fog = world.fog;
  const base = {
    color: fog.color.clone(),
    near: fog.near,
    far: fog.far,
    hemi: world.hemi.intensity,
    sun: world.sun.intensity,
    bg: world.background.clone(),
  };

  // === Proben für Tests =====================================================================
  const parts: StormPart[] = [];
  for (let i = 0; i < 160; i++) parts.push({ kind: 0, pulse: -1, mesh: glowMesh, a: 0, b: 0 });
  const probe: StormProbe = { parts, count: 0, posts: new Float32Array(postList), masts: new Float32Array(mastPos), triangles: staticTris };
  group.userData.storm = probe;
  group.userData.triangles = staticTris;
  let partStart = 0;
  let partDyn: Dyn = glow;
  const open = (d: Dyn): void => {
    partDyn = d;
    partStart = d.n;
  };
  const close = (kind: number, pulse: number): void => {
    partDyn.align();
    if (partDyn.n <= partStart || probe.count >= parts.length) return;
    const pt = parts[probe.count++];
    pt.kind = kind;
    pt.pulse = pulse;
    pt.mesh = partDyn === glow ? glowMesh : lightMesh;
    pt.a = partStart;
    pt.b = partDyn.n;
  };

  // === Hilfsrechnungen für update (kein Garbage pro Bild) ===================================
  const ptsA = new Float32Array(64 * 3);
  /** Punkt auf der Fahrbahn: Abschnitt s, Bruchteil f zum nächsten, seitlich lat, lift darüber → ox, oy, oz. */
  const roadAt = (s: number, f: number, lat: number, lift: number): void => {
    const n = t.next[s];
    const ax = t.px[s] + rightX(t, s) * lat;
    const az = t.pz[s] + rightZ(t, s) * lat;
    const ay = t.py[s] + lat * t.bank[s];
    if (f <= 0) {
      ox = ax;
      oy = ay + lift;
      oz = az;
      return;
    }
    const bx = t.px[n] + rightX(t, n) * lat;
    const bz = t.pz[n] + rightZ(t, n) * lat;
    const by = t.py[n] + lat * t.bank[n];
    ox = ax + (bx - ax) * f;
    oy = ay + (by - ay) * f + lift;
    oz = az + (bz - az) * f;
  };
  const farFade = (d: number): number => Math.max(0, Math.min(1, 1 - (d - 140) / 140));

  /** Hauptkanal eines Blitzes: NP Punkte von (sx, top, sz) zur Stelle (x, y, z); Form aus seed. */
  const makePath = (out: Float32Array, seed: number, x: number, y: number, z: number, top: number, spread: number): void => {
    const an = hash(seed, 1.7) * Math.PI * 2;
    const off = spread * (0.5 + 0.5 * hash(seed, 2.3));
    const sx = x + Math.cos(an) * off;
    const sz = z + Math.sin(an) * off;
    let jx = 0;
    let jz = 0;
    for (let i = 0; i < NP; i++) {
      const u = i / (NP - 1);
      // oben lange, unten kurze Stücke (der Kanal knickt zum Boden hin öfter)
      const h = top * (1 - u) ** 1.25;
      jx = jx * 0.5 + (hash(seed + i * 3.1, 4.9) - 0.5) * 7;
      jz = jz * 0.5 + (hash(seed + i * 5.3, 7.7) - 0.5) * 7;
      const damp = i === NP - 1 ? 0 : 1 - u ** 3;
      out[i * 3] = sx + (x - sx) * u + jx * damp;
      out[i * 3 + 1] = y + h;
      out[i * 3 + 2] = sz + (z - sz) * u + jz * damp;
    }
  };
  /** Ast aus dem Hauptkanal (ab Punkt from), NB Punkte, schräg nach außen und unten. */
  const makeBranch = (out: Float32Array, path: Float32Array, seed: number, from: number): void => {
    const an = hash(seed, 9.1) * Math.PI * 2;
    const len = 3 + hash(seed, 3.3) * 2.5;
    let x = path[from * 3];
    let y = path[from * 3 + 1];
    let z = path[from * 3 + 2];
    for (let i = 0; i < NB; i++) {
      out[i * 3] = x;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = z;
      const a = an + (hash(seed + i, 5.5) - 0.5) * 1.4;
      x += Math.cos(a) * len;
      z += Math.sin(a) * len;
      y -= len * (0.6 + hash(seed + i, 6.6) * 0.9);
    }
  };
  /** Die ersten n Punkte eines Pfads in ptsA, der letzte bis zur Höhe stopY gekürzt; Rückgabe: Anzahl. */
  const cutPath = (path: Float32Array, stopY: number, jitter: number, jseed: number): number => {
    let n = 0;
    for (let i = 0; i < NP; i++) {
      const y = path[i * 3 + 1];
      const jx = jitter > 0 && i > 0 ? (hash(jseed + i, 1.1) - 0.5) * jitter : 0;
      const jz = jitter > 0 && i > 0 ? (hash(jseed + i, 2.2) - 0.5) * jitter : 0;
      if (y >= stopY) {
        ptsA[n * 3] = path[i * 3] + jx;
        ptsA[n * 3 + 1] = y;
        ptsA[n * 3 + 2] = path[i * 3 + 2] + jz;
        n++;
        continue;
      }
      if (i === 0) return 0;
      const py = path[(i - 1) * 3 + 1];
      const k = (py - stopY) / (py - y);
      ptsA[n * 3] = path[(i - 1) * 3] + (path[i * 3] - path[(i - 1) * 3]) * k;
      ptsA[n * 3 + 1] = stopY;
      ptsA[n * 3 + 2] = path[(i - 1) * 3 + 2] + (path[i * 3 + 2] - path[(i - 1) * 3 + 2]) * k;
      n++;
      break;
    }
    return n;
  };
  const copyPts = (src: Float32Array, n: number): void => {
    for (let i = 0; i < n * 3; i++) ptsA[i] = src[i];
  };

  // --- Blitz auf die Bahn --------------------------------------------------------------------
  const updateBolt = (b: BoltState, time: number, cam: THREE.Vector3, dist: number, fx: FxSink, dt: number): void => {
    const p = b.p;
    const s = b.s;
    const R = p.radius;
    const c = pulseCycle(p, time);
    const cyc = Math.floor((time + p.phase) / p.period);
    const warnStart = p.period - p.warn;
    const ff = farFade(dist);
    const ground = dist < GROUND_FAR;
    const near = detail && dist < FX_NEAR;

    if (c >= warnStart) {
      const w = (c - warnStart) / p.warn;
      const tt = (w * p.warn) / 60;
      const seed = (cyc + 1) * 7.31 + p.seg;
      if (ground) {
        // Zielkreis: die dunkle Füllung zieht sich von außen nach innen zu; bei Zyklus 0 ist er voll.
        open(glow);
        const rim = 0.32;
        const rIn = (R - rim) * (1 - smooth(w) * 0.92 - w * 0.08);
        const ph = Math.sin(Math.PI * 2 * (1.5 * tt + tt * tt / 3));
        const pulse = 0.5 + 0.5 * ph;
        const fillCol = w > 0.7 ? Z_FILL_HI : Z_FILL;
        ring(glow, s, rIn, R - rim, 0.018, fillCol);
        ring(glow, s, Math.max(0, rIn - 0.14), rIn, 0.022, Z_EDGE, 0.7 + 0.3 * w);
        ring(glow, s, R - rim, R, 0.022, pulse > 0.5 ? Z_RIM : Z_RIM_LO, 0.75 + 0.25 * pulse);
        // vier Zacken nach innen (Fadenkreuz)
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          gv(glow, s, ca * (R - rim) - sa * 0.24, sa * (R - rim) + ca * 0.24, 0.026, Z_RIM);
          gv(glow, s, ca * (R - rim) + sa * 0.24, sa * (R - rim) - ca * 0.24, 0.026, Z_RIM);
          gv(glow, s, ca * (R - rim - 0.7), sa * (R - rim - 0.7), 0.026, Z_RIM);
        }
        close(PART_ZIEL, b.idx);
        // Roter Schein am Rand (aus der Ferne lesbar) und ein Glimmen über der Fläche.
        open(light);
        curtain(light, s, R, 0.5 + 0.9 * w, G_RED, (0.22 + 0.4 * w) * Math.max(ff, 0.35));
        glowBlob(light, s.x, s.y + 0.6, s.z, cam, R * 1.25, 0.9 + 0.6 * w, G_RED, (0.12 + 0.25 * w * (0.7 + 0.3 * pulse)) * Math.max(ff, 0.35));
        close(PART_ZIEL_LICHT, b.idx);
      }
      // Leitblitz: tastet sich aus der Höhe herab – erst hoch oben, in der letzten halben Sekunde bis kurz über den Boden.
      makePath(b.path, seed, p.x, p.y, p.z, BOLT_TOP, 14);
      const t1 = p.warn / 60 - 0.5;
      const tipH = tt < t1 ? BOLT_TOP * (0.97 - 0.5 * (tt / t1)) : BOLT_TOP * 0.47 * (1 - ((tt - t1) / 0.5) ** 1.3) + 1.2 * ((tt - t1) / 0.5);
      const jseed = Math.floor(time / 4) * 3.7 + p.seg;
      const n = cutPath(b.path, p.y + Math.max(1.2, tipH), 1.4, jseed);
      if (n >= 2) {
        open(light);
        const fl = 0.6 + 0.4 * hash(jseed, 8.8);
        ribbon(light, ptsA, n, cam, 0.5, 0.35, G_VIOLET, 0.25 * fl, 0.55 * fl);
        ribbon(light, ptsA, n, cam, 0.09, 0.07, G_CORE, 0.55 * fl, 0.95 * fl);
        glowBlob(light, ptsA[(n - 1) * 3], ptsA[(n - 1) * 3 + 1], ptsA[(n - 1) * 3 + 2], cam, 1.4, 1.4, G_VIOLET, 0.6 * fl);
        close(PART_ZIEL_LICHT, b.idx);
      }
      // Violette Funken tanzen über dem Kreis.
      if (near) {
        b.acc -= dt * (8 + 22 * w);
        while (b.acc <= 0) {
          b.acc += 1;
          const a = Math.random() * Math.PI * 2;
          const r = rIn01(R, w) + Math.random() * 0.4;
          fx.spark(s.x + s.rx * Math.cos(a) * r + s.fx * Math.sin(a) * r, s.y + 0.15, s.z + s.rz * Math.cos(a) * r + s.fz * Math.sin(a) * r, (Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 2.2, (Math.random() - 0.5) * 1.5, 0.35 + Math.random() * 0.25, 0.12 + Math.random() * 0.1, Math.random() < 0.5 ? 0xc77dff : 0xff4fa0, 3);
        }
      }
    } else if (c < p.on) {
      // Einschlag: steht STRIKE_FULL Ticks voll, verblasst bis zum Ende der Gefahr.
      const I = c < STRIKE_FULL ? 1 : (1 - (c - STRIKE_FULL) / (p.on - STRIKE_FULL)) ** 1.4;
      const seed = cyc * 7.31 + p.seg;
      makePath(b.path, seed, p.x, p.y, p.z, BOLT_TOP, 14);
      open(light);
      copyPts(b.path, NP);
      if (detail) ribbon(light, ptsA, NP, cam, 2.6, 2.2, G_BOLT_HALO, 0.35 * I, 0.55 * I);
      ribbon(light, ptsA, NP, cam, 0.5, 0.42, G_CORE, I, I);
      if (detail) {
        // zwei Äste
        makeBranch(b.br0, b.path, seed, 3 + Math.floor(hash(seed, 1.9) * 4));
        makeBranch(b.br1, b.path, seed + 3.3, 8 + Math.floor(hash(seed, 2.9) * 4));
        copyPts(b.br0, NB);
        ribbon(light, ptsA, NB, cam, 0.9, 0.2, G_BOLT_HALO, 0.3 * I, 0.05 * I);
        ribbon(light, ptsA, NB, cam, 0.22, 0.06, G_CORE, 0.85 * I, 0.25 * I);
        copyPts(b.br1, NB);
        ribbon(light, ptsA, NB, cam, 0.8, 0.2, G_BOLT_HALO, 0.3 * I, 0.05 * I);
        ribbon(light, ptsA, NB, cam, 0.2, 0.06, G_CORE, 0.8 * I, 0.2 * I);
      }
      glowBlob(light, p.x, p.y + 1.6, p.z, cam, 6.5, 5, HOT_VIOLET, 0.75 * I);
      glowBlob(light, p.x, p.y + 1, p.z, cam, 2.6, 2.2, HOT_WHITE, 0.9 * I);
      if (ground) {
        // Gemalter Schein auf der Fahrbahn ringsum
        const rows = detail ? 12 : 8;
        const cols = detail ? 8 : 6;
        for (let a = 0; a < rows; a++) {
          for (let q = 0; q < cols; q++) {
            poolCell(light, b, a, q, rows, cols, I);
          }
        }
        close(PART_BLITZ, b.idx);
        // Greller Fleck im Trefferradius
        open(glow);
        const e = c / p.on;
        disc(glow, s, R * (0.55 + 0.45 * Math.min(1, c / 4)), 0.05, e < 0.35 ? HOT_WHITE : HOT_VIOLET, e < 0.5 ? HOT_VIOLET : Z_FILL_HI);
        ring(glow, s, R - 0.18, R, 0.055, Z_RIM, I);
        close(PART_BLITZ, b.idx);
      } else {
        close(PART_BLITZ, b.idx);
      }
      if (near && cyc !== b.last && c < 10) {
        b.last = cyc;
        for (let k = 0; k < 26; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 3 + Math.random() * 6;
          fx.spark(p.x, p.y + 0.4, p.z, Math.cos(a) * sp, 4 + Math.random() * 7, Math.sin(a) * sp, 0.5 + Math.random() * 0.5, 0.22 + Math.random() * 0.2, k % 3 === 0 ? 0xffffff : k % 3 === 1 ? 0xd2a8ff : 0xffe27a, 14);
        }
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2;
          fx.puff(p.x + Math.cos(a) * 0.8, p.y + 0.3, p.z + Math.sin(a) * 0.8, Math.cos(a) * 1.5, 1.5 + Math.random(), Math.sin(a) * 1.5, 1.1, 0.8, 0x3a3846, 0.9, -0.4);
        }
      }
    } else if (c < p.on + GLIMM && ground) {
      // Nachglühen: die Stelle glimmt eine Sekunde und verlischt.
      const g = 1 - (c - p.on) / GLIMM;
      open(glow);
      disc(glow, s, R * (0.3 + 0.25 * g), 0.04, g > 0.5 ? EMBER : EMBER_D, EMBER_D, 0.4 + 0.6 * g);
      close(PART_GLIMM, b.idx);
      open(light);
      glowBlob(light, p.x, p.y + 0.4, p.z, cam, 1.6, 0.8, EMBER, 0.35 * g * ff);
      close(PART_GLIMM, b.idx);
    }
  };
  /** Innenrand des sich zuziehenden Zielkreises (für die Funken). */
  const rIn01 = (R: number, w: number): number => (R - 0.32) * (1 - smooth(w) * 0.92 - w * 0.08);
  /** Eine Zelle des Scheins auf der Fahrbahn um einen Einschlag. */
  const poolCell = (d: Dyn, b: BoltState, a: number, q: number, rows: number, cols: number, I: number): void => {
    const p = b.p;
    for (let k = 0; k < 6; k++) {
      const da = k === 1 || k === 2 || k === 4 ? 1 : 0;
      const dq = k === 2 || k === 4 || k === 5 ? 1 : 0;
      const along = -POOL_R + (2 * POOL_R * (a + da)) / rows;
      const kk = Math.floor(along);
      const sg = b.segs[Math.max(0, Math.min(24, kk + 12))];
      const wh = t.wh[sg];
      const lat = -wh + (2 * wh * (q + dq)) / cols;
      roadAt(sg, along - kk, lat, 0.06);
      const dd = Math.hypot(ox - p.x, oz - p.z) / POOL_R;
      const f = Math.max(0, 1 - dd) ** 1.5;
      d.v(ox, oy, oz, G_POOL, f * 0.85 * I);
    }
  };

  // --- Blitzableiter ------------------------------------------------------------------------
  const updateRod = (r: RodState, time: number, cam: THREE.Vector3, dist: number, fx: FxSink): void => {
    const p = r.p;
    const c = pulseCycle(p, time);
    const cyc = Math.floor((time + p.phase) / p.period);
    const warnStart = p.period - p.warn;
    const rs = time / 60;
    const ground = dist < GROUND_FAR;
    const ballY = r.y + BALL_Y;
    const out = p.lat >= 0 ? 1 : -1;
    const lampX = r.x - rightX(t, p.seg) * out * 0.75;
    const lampZ = r.z - rightZ(t, p.seg) * out * 0.75;

    // Flugwarnlampe: blinkt immer langsam und weich (0,6 Hz).
    {
      const ph = 0.5 + 0.5 * Math.sin(rs * Math.PI * 2 * 0.6 + p.seg);
      const f = 0.25 + 0.75 * smooth(ph * 1.6 - 0.3);
      lampD(glow, lampX, r.y + LAT_H + 0.3, lampZ, 0.16, L_RED, 0.4 + 0.6 * f);
      const sz = Math.max(0.9, dist * 0.011);
      glowBlob(light, lampX, r.y + LAT_H + 0.3, lampZ, cam, sz, sz, G_LAMP_RED, 0.55 * f);
    }

    if (c >= warnStart) {
      const w = (c - warnStart) / p.warn;
      const tt = (w * p.warn) / 60;
      open(light);
      // Kugel glüht cyan und pulsiert schneller (1 → 3 Hz).
      const ph = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (tt + (tt * tt) / 1.5));
      const gs = 0.8 + 1.6 * w;
      glowBlob(light, r.x, ballY, r.z, cam, gs * (0.8 + 0.25 * ph), gs * (0.8 + 0.25 * ph), G_CYAN, 0.35 + 0.5 * w * (0.6 + 0.4 * ph));
      glowBlob(light, r.x, ballY, r.z, cam, Math.max(1.2, dist * 0.012), Math.max(1.2, dist * 0.012), G_ROD_HALO, 0.25 + 0.3 * w);
      // Entladungen laufen den Mast hinunter.
      if (detail) {
        for (let k = 0; k < 3; k++) {
          const u = (((tt * 1.6 + k / 3 + w * 0.5) % 1) + 1) % 1;
          const leg = k;
          const lx = r.legs[leg * 4 + 2] + (r.legs[leg * 4] - r.legs[leg * 4 + 2]) * u;
          const lz = r.legs[leg * 4 + 3] + (r.legs[leg * 4 + 1] - r.legs[leg * 4 + 3]) * u;
          const ly = r.y + LAT_H - u * (LAT_H + 1);
          glowBlob(light, lx, ly, lz, cam, 0.45, 0.7, G_ARC, 0.6 * w + 0.2);
        }
      }
      if (ground) {
        // Schienen glimmen auf; von ihnen her wächst ein blasses Feld zur Mitte.
        const reach = FIELD_K * smooth(Math.min(1, w * 1.1));
        for (let side = -1; side <= 1; side += 2) {
          railGlow(light, r, side, G_CYAN, 0.15 + 0.5 * w);
          const k0 = side * FIELD_K;
          const k1 = side * (FIELD_K - reach);
          fieldBand(light, r, Math.min(k0, k1), Math.max(k0, k1), G_FIELD, side < 0 ? 0.16 * w : 0.03 * w, side < 0 ? 0.03 * w : 0.16 * w, 0.045, -1);
          railCurtain(light, r, side, 0.4 + 0.5 * w, G_CYAN, 0.12 + 0.2 * w);
        }
      }
      close(PART_VOR, r.idx);
    } else if (c < p.on) {
      const e = c / p.on;
      const I = 1 - 0.85 * smooth((e - 0.45) / 0.55);
      if (ground) {
        // Ladefeld quer über die ganze Fahrbahn: hell, blau-weiß, mit laufenden Bändern.
        open(light);
        fieldBand(light, r, -FIELD_K, FIELD_K, G_FIELD, 0.55 * I, 0.55 * I, 0.04, rs);
        close(PART_FELD, r.idx);
      }
      open(light);
      if (ground) {
        // Lichtbögen von Schiene zu Schiene, die über das Feld wandern.
        const nA = detail ? 5 : 3;
        for (let j = 0; j < nA; j++) arc(light, r, j, nA, time, cam, I);
        for (let side = -1; side <= 1; side += 2) {
          railGlow(light, r, side, L_CYAN_HI, 0.9 * I);
          railCurtain(light, r, side, 1.1, G_CYAN, 0.3 * I);
        }
      }
      // Blitz in die Spitze: dünner als der Bahn-Blitz, blau-weiß.
      if (c < ROD_BOLT) {
        const J = c < 8 ? 1 : 1 - (c - 8) / (ROD_BOLT - 8);
        makePath(r.path, cyc * 5.17 + p.seg, r.x, r.y + TIP_Y, r.z, ROD_TOP, 10);
        copyPts(r.path, NP);
        if (detail) ribbon(light, ptsA, NP, cam, 1.4, 1.1, G_ROD_HALO, 0.3 * J, 0.45 * J);
        ribbon(light, ptsA, NP, cam, 0.28, 0.22, G_ARC, 0.95 * J, 0.95 * J);
      }
      glowBlob(light, r.x, ballY, r.z, cam, 3.2, 3.2, L_CYAN_HI, 0.8 * I);
      glowBlob(light, r.x, ballY, r.z, cam, Math.max(2, dist * 0.02), Math.max(2, dist * 0.02), G_ROD_HALO, 0.45 * I);
      close(PART_LADUNG, r.idx);
      if (detail && dist < FX_NEAR && cyc !== r.last && c < 8) {
        r.last = cyc;
        for (let k = 0; k < 18; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 4;
          fx.spark(r.x, r.y + TIP_Y - 0.4, r.z, Math.cos(a) * sp, 1 + Math.random() * 4, Math.sin(a) * sp, 0.6 + Math.random() * 0.4, 0.18 + Math.random() * 0.14, k % 2 === 0 ? 0xffffff : 0x8fe6ff, 12);
        }
      }
    }
  };
  /** Glimmen auf einer Kupferschiene (Seite −1 = hinter dem Mast, 1 = davor). */
  const railGlow = (d: Dyn, r: RodState, side: number, c: RGB, f: number): void => {
    const a = side * FIELD_K;
    const n = GC - 1;
    for (let q = 0; q < n; q++) {
      gridAt(r.grid, a - 0.24, q, 0.04);
      d.v(ox, oy, oz, c, f);
      gridAt(r.grid, a - 0.24, q + 1, 0.04);
      d.v(ox, oy, oz, c, f);
      gridAt(r.grid, a + 0.24, q + 1, 0.04);
      d.v(ox, oy, oz, c, f);
      gridAt(r.grid, a - 0.24, q, 0.04);
      d.v(ox, oy, oz, c, f);
      gridAt(r.grid, a + 0.24, q + 1, 0.04);
      d.v(ox, oy, oz, c, f);
      gridAt(r.grid, a + 0.24, q, 0.04);
      d.v(ox, oy, oz, c, f);
    }
  };
  /** Senkrechter Lichtvorhang über einer Schiene: unten hell, oben schwarz. */
  const railCurtain = (d: Dyn, r: RodState, side: number, h: number, c: RGB, f: number): void => {
    const a = side * FIELD_K;
    for (let q = 0; q < GC - 1; q++) {
      gridAt(r.grid, a, q, 0.05);
      const ax = ox;
      const ay = oy;
      const az = oz;
      gridAt(r.grid, a, q + 1, 0.05);
      d.v(ax, ay, az, c, f);
      d.v(ox, oy, oz, c, f);
      d.v(ox, oy + h, oz, BLACK);
      d.v(ax, ay, az, c, f);
      d.v(ox, oy + h, oz, BLACK);
      d.v(ax, ay + h, az, BLACK);
    }
  };
  /**
   * Feld auf der Fahrbahn zwischen k0 und k1 Meter (voraus vom Mast), über die ganze Breite (±wh).
   * Helligkeit fa bei k0, fb bei k1; rs ≥ 0: laufende Bänder quer über die Bahn.
   */
  const fieldBand = (d: Dyn, r: RodState, k0: number, k1: number, c: RGB, fa: number, fb: number, lift: number, rs: number): void => {
    if (k1 - k0 < 0.01) return;
    const wh = t.wh[r.p.seg];
    const a0 = Math.floor(k0);
    const a1 = Math.ceil(k1);
    for (let a = a0; a < a1; a++) {
      const u0 = Math.max(k0, a);
      const u1 = Math.min(k1, a + 1);
      if (u1 - u0 < 1e-3) continue;
      for (let q = 0; q < GC - 1; q++) {
        for (let k = 0; k < 6; k++) {
          const dk = k === 1 || k === 2 || k === 4 ? 1 : 0;
          const dq = k === 2 || k === 4 || k === 5 ? 1 : 0;
          const u = dk ? u1 : u0;
          gridAt(r.grid, u, q + dq, lift);
          let f = fa + ((fb - fa) * (u - k0)) / (k1 - k0);
          if (rs >= 0) {
            // Bänder laufen quer über die Bahn (1,2 Durchläufe je Sekunde), an den Schienen heller.
            const lat = -wh + (2 * wh * (q + dq)) / (GC - 1);
            const band = 0.5 + 0.5 * Math.sin(lat * 0.9 - rs * 7.5 + u * 0.35);
            const edge = Math.abs(u) / FIELD_K;
            f *= 0.55 + 0.3 * band + 0.35 * edge * edge;
          }
          d.v(ox, oy, oz, c, f);
        }
      }
    }
  };
  /** Ein Lichtbogen von Schiene zu Schiene; wandert quer über die Bahn. */
  const arc = (d: Dyn, r: RodState, j: number, nA: number, time: number, cam: THREE.Vector3, I: number): void => {
    const rs = time / 60;
    const u = (((j / nA + rs * 0.55 * (j % 2 === 0 ? 1 : -0.8)) % 1) + 1) % 1;
    const c0 = 0.3 + (GC - 1.6) * u;
    const jseed = Math.floor(time / 3) * 1.37 + j * 17.1 + r.p.seg;
    const N = 11;
    for (let i = 0; i < N; i++) {
      const a = -FIELD_K + (2 * FIELD_K * i) / (N - 1);
      const end = i === 0 || i === N - 1;
      const c = Math.max(0, Math.min(GC - 1, c0 + (end ? 0 : (hash(jseed + i, 3.1) - 0.5) * 0.5)));
      const hump = Math.sin((Math.PI * i) / (N - 1));
      gridAt(r.grid, a, c, 0.12 + hump * (0.55 + 0.25 * hash(jseed, 4.4)) + (end ? 0 : (hash(jseed + i, 5.7) - 0.5) * 0.3));
      ptsA[i * 3] = ox;
      ptsA[i * 3 + 1] = oy;
      ptsA[i * 3 + 2] = oz;
    }
    if (detail) ribbon(d, ptsA, N, cam, 0.42, 0.42, G_ROD_HALO, 0.35 * I, 0.35 * I);
    ribbon(d, ptsA, N, cam, 0.09, 0.09, G_ARC, 0.95 * I, 0.95 * I);
  };

  // === Reflektoren je Bild: ab REF_GROW wachsen sie mit, damit die Kette weit zu sehen bleibt ===
  const updateReflectors = (cam: THREE.Vector3): void => {
    const arr = reflMesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < nRefl; i++) {
      const x = reflData[i * 5];
      const y = reflData[i * 5 + 1];
      const z = reflData[i * 5 + 2];
      const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
      const s = d > REF_GROW ? Math.min(4, d / REF_GROW) : 1;
      const c = reflCos[i] * s;
      const sn = reflSin[i] * s;
      // Drehung um die Hochachse (lokales z in Fahrtrichtung), gleichmäßig skaliert; Spalten der Matrix.
      const o = i * 16;
      arr[o] = c;
      arr[o + 1] = 0;
      arr[o + 2] = -sn;
      arr[o + 3] = 0;
      arr[o + 4] = 0;
      arr[o + 5] = s;
      arr[o + 6] = 0;
      arr[o + 7] = 0;
      arr[o + 8] = sn;
      arr[o + 9] = 0;
      arr[o + 10] = c;
      arr[o + 11] = 0;
      arr[o + 12] = x;
      arr[o + 13] = y;
      arr[o + 14] = z;
      arr[o + 15] = 1;
    }
    reflMesh.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    update(time, _seconds, dt, cam, fx) {
      // --- Wetterleuchten: Licht, Dunst und Himmel der ganzen Welt folgen allein stormLight ---
      const k = stormLight(t.pulses, t.flashes, time);
      const g = worldLight(k);
      fog.color.copy(base.color).lerp(FOG_LIT, g);
      fog.near = base.near + FOG_NEAR_ADD * g;
      fog.far = base.far + FOG_FAR_ADD * g * g;
      world.hemi.intensity = base.hemi + HEMI_ADD * g;
      world.sun.intensity = base.sun + SUN_ADD * g;
      world.background.copy(base.bg).lerp(BG_LIT, g);
      dome.visible = g > 0.004;
      if (dome.visible) {
        dome.position.set(cam.x, 0, cam.z);
        // im linearen Farbraum wirkt schon wenig Zugabe stark: quadratisch, damit die Einschläge den Himmel kaum anheben
        domeMat.color.setScalar(g * g);
      }

      glow.begin();
      light.begin();
      probe.count = 0;
      for (const b of bolts) {
        const d = Math.hypot(b.p.x - cam.x, b.p.z - cam.z);
        if (d < SKY_FAR) updateBolt(b, time, cam, d, fx, dt);
      }
      for (const r of rods) {
        const d = Math.hypot(r.x - cam.x, r.z - cam.z);
        if (d < SKY_FAR) updateRod(r, time, cam, d, fx);
      }
      glow.end();
      light.end();
      glowMesh.visible = glow.tris > 0;
      lightMesh.visible = light.tris > 0;
      updateReflectors(cam);
    },
    dispose() {
      fog.color.copy(base.color);
      fog.near = base.near;
      fog.far = base.far;
      world.hemi.intensity = base.hemi;
      world.sun.intensity = base.sun;
      world.background.copy(base.bg);
      for (const d of disposables) d.dispose();
    },
  };
}

// --- Bauhelfer (nur beim Aufbau) ----------------------------------------------------------

/** Pfosten: ein schmales Brett quer zur Fahrtrichtung, Vorder- und Rückseite (4 Dreiecke). */
function postAt(mb: MeshBuilder, x: number, z: number, fx: number, fz: number, w: number, y0: number, y1: number, c: RGB): void {
  const ax = -fz * w;
  const az = fx * w;
  mb.quad([x - ax, y0, z - az], [x + ax, y0, z + az], [x + ax, y1, z + az], [x - ax, y1, z - az], c);
  mb.quad([x + ax, y0, z + az], [x - ax, y0, z - az], [x - ax, y1, z - az], [x + ax, y1, z + az], shadeC(c, 1.25));
}

function shadeC(c: RGB, f: number): RGB {
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}

function scaleRgb(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}

/** Dreieck, sichtbar von oben. */
function triUp(mb: MeshBuilder, a: V3, b: V3, c: V3, col: RGB): void {
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny >= 0) mb.tri(a, b, c, col);
  else mb.tri(a, c, b, col);
}

/** Viereck auf dem Boden, sichtbar von oben. */
function triQuadUp(mb: MeshBuilder, a: V3, b: V3, c: V3, d: V3, col: RGB): void {
  triUp(mb, a, b, c, col);
  triUp(mb, a, c, d, col);
}

/** Schlanke senkrechte Säule (dreiseitig, ohne Deckel). */
function prismAt(mb: MeshBuilder, x: number, z: number, r: number, y0: number, y1: number, c: RGB): void {
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * Math.PI * 2;
    const a1 = ((k + 1) / 3) * Math.PI * 2;
    const p0: V3 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r];
    const p1: V3 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
    mb.quad(p0, [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], p1, k === 0 ? shadeC(c, 1.3) : c);
  }
}

/** Gemaltes Licht: Dreiecke mit eigener Farbe je Ecke (additiv gezeichnet: Schwarz = durchsichtig). */
class LightBuilder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];

  get triangles(): number {
    return this.pos.length / 9;
  }

  tri(a: V3, b: V3, c: V3, ca: RGB, cb: RGB, cc: RGB): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
  }

  /** Dreieck eines Lichtflecks mit Helligkeit je Ecke (f · s · col). */
  soft(a: { p: V3; f: number }, b: { p: V3; f: number }, c: { p: V3; f: number }, col: RGB, s: number): void {
    if (a.f + b.f + c.f < 0.003) return;
    this.tri(a.p, b.p, c.p, scaleRgb(col, a.f * s), scaleRgb(col, b.f * s), scaleRgb(col, c.f * s));
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Fügt fertige Netze (Lage, Normale, Farbe) zu einem zusammen. */
function mergeColored(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const g of geos) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const p = g.getAttribute('position').array as Float32Array;
    pos.set(p, o * 3);
    nor.set(g.getAttribute('normal').array as Float32Array, o * 3);
    col.set(g.getAttribute('color').array as Float32Array, o * 3);
    o += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

