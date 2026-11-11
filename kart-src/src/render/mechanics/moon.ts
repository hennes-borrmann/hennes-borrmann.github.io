// Mondbasis: Sprungplatten und Meteoriten.
//
// Die Physik (game/sim.ts, game/mechanics.ts „Geringe Schwerkraft“) kennt nur
// Zahlen: eine Sprungplatte (track.launchers) gibt dem Kart, das über sie
// fährt, die Steiggeschwindigkeit power; ein Meteorit (PULSE_METEOR) trifft
// wie eine Lavabombe im Umkreis p.radius, solange pulseCycle(p, time) < p.on.
// Hier bekommen sie ein Gesicht:
//   * Sprungplatte: erhabene, leuchtend orange Platte mit Winkeln, über die ein
//     Lauflicht nach vorn läuft; an den Seiten Federpakete, die im Takt atmen;
//     davor zwei Baken mit „Pfeil hoch“. Dahinter immer eine Lücke: Warnstreifen
//     und gelbe Lauflichter an der Absprungkante, Leuchtbojen in der Flugbahn
//     eines normalen Sprungs, an der Landekante Schwelle, Pfeile, grüne Lauflichter
//     und zwei Blitzmasten.
//   * Meteorit: in der Vorwarnung wächst am Boden ein dunkelroter Zielkreis mit
//     laufendem Rand, am Himmel erscheint ein heller Punkt, der zum Feuerball mit
//     Schweif wird und schräg herabfällt – Einschlag genau bei Zyklus 0. Dann
//     Lichtblitz, Staub in Zeitlupe (fx), und der kleine Krater glüht, solange die
//     Stelle gefährlich ist; danach verlischt er.
//
// Alles läuft im Takt der Rennzeit (time / 60), nicht der Uhr des Bildschirms.
//
// Zeichenaufrufe (höchstens 6): Feste Teile (toon) samt Kontur, Glut (ungeschattet,
// pro Bild neu geschrieben: Lichter, Winkel, Federn, Zielkreise, Schweife, Krater),
// Leuchten (additiv), Feuerbälle samt Kontur. Ohne detail: keine Konturen, keine
// Teilchen.

import * as THREE from 'three';
import { PULSE_METEOR, pulseCycle, pulseWarning, type Pulse } from '../../game/mechanics';
import { EDGE_GAP, rightX, rightZ, type Launcher, type Track } from '../../game/track';
import { MeshBuilder, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { INK, addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { boxT, cylT, face, stripedFace, type Xform } from './machineKit';

// --- Farben ------------------------------------------------------------------------

const C_INK = rgb(INK);
const C_YEL = rgb(0xffcf1f);
const C_ORANGE = rgb(0xff8414);
const C_ORANGE_D = rgb(0xc85a0c);
const C_FRAME = rgb(0x2d3550);
const C_FRAME_D = rgb(0x222842);
const C_STEEL = rgb(0x8d98b0);
const C_MARK = rgb(0xf4f6ff);
const C_GREEN_MARK = rgb(0x2fd97a);
/** Winkel auf der Platte, wenn das Lauflicht nicht darüber läuft. */
const C_CHEV = rgb(0x9a3206);
const C_RIM = rgb(0x8a8798);
const C_RIM_D = rgb(0x6a6779);
const C_PIT = rgb(0x3a3846);

const WHITE_HOT = rgb(0xfff2b0);
const HOT_Y = rgb(0xffe27a);
const HOT_O = rgb(0xff9a1f);
const HOT_R = rgb(0xff4d0f);
const EMBER = rgb(0xa2300f);
const CRUST = rgb(0x4a1a18);
/** Zielkreis */
const TARGET = rgb(0x5a0d14);
const TARGET_HI = rgb(0x8c1420);
const TARGET_RIM = rgb(0xff3b2a);
/** Lichter: an und aus. */
const L_YEL = rgb(0xffd21f);
const L_WHITE = rgb(0xfff6d8);
const L_GREEN = rgb(0x36ff7a);
const L_GREEN_HI = rgb(0xe8fff0);
const L_ORANGE = rgb(0xff8a1a);
/** Additive Leuchtfarben (werden mit der Stärke multipliziert). */
const GLOW_ORANGE = rgb(0xff6a1a);
const GLOW_YELLOW = rgb(0xffc050);
const GLOW_WHITE = rgb(0xfff4e0);
const GLOW_GREEN = rgb(0x2aff6a);
const GLOW_RED = rgb(0xff2a1a);
const BLACK: RGB = [0, 0, 0];
/** Schweif: Breite, Länge und Farbe der drei Flammenzungen (außen → innen). */
const TAIL_W = [0.95, 0.7, 0.42];
const TAIL_L = [1, 0.72, 0.42];
const TAIL_C = [HOT_R, HOT_O, WHITE_HOT];

// --- Maße und Ablauf ---------------------------------------------------------------

/** Höhe der Platte über der Fahrbahn und Länge der Auffahrschräge (m). */
const PLATE_H = 0.17;
const BEVEL = 0.7;
/** Tempo eines normalen Sprungs (m/s) – für die Flugbahn der Bojen. */
const JUMP_SPEED = 24;
/** Abstand der Baken vor der Platte (m). */
const BEACON_BACK = 16;
/** Meteorit: Herkunft relativ zum Einschlag (m voraus, seitlich, hoch). */
const MET_AHEAD = 80;
const MET_SIDE = 16;
const MET_UP = 58;
/** Lichtblitz und Spritzer beim Einschlag (Ticks); Nachglimmen nach der Gefahr (Ticks). */
const FLASH = 16;
const AFTER = 10;
/** Pro Bild geschrieben wird nur bis zu dieser Entfernung von der Kamera; Teilchen nur bis FX_NEAR. */
const DRAW_FAR = 280;
const PLATE_FAR = 340;
const FX_NEAR = 150;

// --- Dynamische Flächen ----------------------------------------------------------------

/** Ein Netz, dessen Dreiecke jedes Bild neu geschrieben werden (feste Obergrenze, keine neuen Puffer). */
class Dyn {
  readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly pa: THREE.BufferAttribute;
  private readonly ca: THREE.BufferAttribute;
  private n = 0;
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

  get tris(): number {
    return Math.floor(this.n / 3);
  }

  end(): void {
    const n = this.tris * 3;
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

// --- Bodenstellen ---------------------------------------------------------------------

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

function siteAt(t: Track, seg: number, x: number, y: number, z: number): Site {
  const a = t.prev[seg];
  const b = t.next[seg];
  return { x, y, z, rx: rightX(t, seg), rz: rightZ(t, seg), fx: t.tx[seg], fz: t.tz[seg], bank: t.bank[seg], slope: (t.py[b] - t.py[a]) / (2 * t.step) };
}

const SEG = 16;
/** Schrittweite durch die SEG Winkel: 1 nah, 2 fern (halbe Dreieckszahl). */
let st = 1;
const COS = new Float32Array(SEG + 1);
const SIN = new Float32Array(SEG + 1);
for (let i = 0; i <= SEG; i++) {
  COS[i] = Math.cos((i / SEG) * Math.PI * 2);
  SIN[i] = Math.sin((i / SEG) * Math.PI * 2);
}

/** Ecke auf dem Boden einer Stelle: u nach rechts, w nach vorn, lift darüber. */
function gv(d: Dyn, s: Site, u: number, w: number, lift: number, c: RGB, f = 1): void {
  d.v(s.x + s.rx * u + s.fx * w, s.y + u * s.bank + w * s.slope + lift, s.z + s.rz * u + s.fz * w, c, f);
}

/** Scheibe auf dem Boden. */
function disc(d: Dyn, s: Site, r: number, lift: number, c: RGB, cEdge: RGB = c): void {
  for (let i = 0; i < SEG; i += st) {
    gv(d, s, 0, 0, lift, c);
    gv(d, s, COS[i] * r, SIN[i] * r, lift, cEdge);
    gv(d, s, COS[i + st] * r, SIN[i + st] * r, lift, cEdge);
  }
}

/** Ring auf dem Boden zwischen r0 und r1; col(i) wählt die Farbe je Stück. */
function ring(d: Dyn, s: Site, r0: number, r1: number, lift: number, c: RGB): void {
  for (let i = 0; i < SEG; i += st) {
    quadRing(d, s, i, r0, r1, lift, c);
  }
}

function quadRing(d: Dyn, s: Site, i: number, r0: number, r1: number, lift: number, c: RGB, f = 1): void {
  const ca = COS[i];
  const sa = SIN[i];
  const cb = COS[i + st];
  const sb = SIN[i + st];
  gv(d, s, ca * r0, sa * r0, lift, c, f);
  gv(d, s, ca * r1, sa * r1, lift, c, f);
  gv(d, s, cb * r1, sb * r1, lift, c, f);
  gv(d, s, ca * r0, sa * r0, lift, c, f);
  gv(d, s, cb * r1, sb * r1, lift, c, f);
  gv(d, s, cb * r0, sb * r0, lift, c, f);
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

/** Leuchtender Vorhang (additiv) am Rand radius r: unten hell, nach oben verlaufend. */
function curtain(d: Dyn, s: Site, r: number, h: number, c: RGB, f: number): void {
  if (f <= 0.01 || h <= 0.01) return;
  for (let i = 0; i < SEG; i += st) {
    const ca = COS[i] * r;
    const sa = SIN[i] * r;
    const cb = COS[i + st] * r;
    const sb = SIN[i + st] * r;
    const ha = (i / st) % 2 === 0 ? h : h * 0.5;
    const hb = (i / st) % 2 === 0 ? h * 0.5 : h;
    gv(d, s, ca, sa, 0.04, c, f);
    gv(d, s, cb, sb, 0.04, c, f);
    gv(d, s, cb, sb, hb, BLACK);
    gv(d, s, ca, sa, 0.04, c, f);
    gv(d, s, cb, sb, hb, BLACK);
    gv(d, s, ca, sa, ha, BLACK);
  }
}

/** Leuchtpunkt: Doppelpyramide mit Radius r (Spitzen etwas länger). */
function lamp(d: Dyn, x: number, y: number, z: number, r: number, c: RGB, f = 1): void {
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

/**
 * Quader im Rahmen (rechts rx/rz, vorn fx/fz, oben y): halbe Breite hw, halbe Länge hl,
 * von y0 bis y1, ohne Boden. Die Schattierung ist fest eingebacken (Comic-Stufen).
 */
function boxD(d: Dyn, x: number, z: number, rx: number, rz: number, fx: number, fz: number, hw: number, hl: number, y0: number, y1: number, c: RGB): void {
  const ax = rx * hw;
  const az = rz * hw;
  const bx = fx * hl;
  const bz = fz * hl;
  // Vier Seiten: Ecken (sa, sb) → (sa2, sb2), Helligkeit
  for (let k = 0; k < 4; k++) {
    const s0a = BOX_SIDES[k * 5];
    const s0b = BOX_SIDES[k * 5 + 1];
    const s1a = BOX_SIDES[k * 5 + 2];
    const s1b = BOX_SIDES[k * 5 + 3];
    const f = BOX_SIDES[k * 5 + 4];
    const x0 = x + ax * s0a + bx * s0b;
    const z0 = z + az * s0a + bz * s0b;
    const x1 = x + ax * s1a + bx * s1b;
    const z1 = z + az * s1a + bz * s1b;
    d.v(x0, y0, z0, c, f);
    d.v(x1, y0, z1, c, f);
    d.v(x1, y1, z1, c, f);
    d.v(x0, y0, z0, c, f);
    d.v(x1, y1, z1, c, f);
    d.v(x0, y1, z0, c, f);
  }
  d.v(x - ax - bx, y1, z - az - bz, c);
  d.v(x + ax - bx, y1, z + az - bz, c);
  d.v(x + ax + bx, y1, z + az + bz, c);
  d.v(x - ax - bx, y1, z - az - bz, c);
  d.v(x + ax + bx, y1, z + az + bz, c);
  d.v(x - ax + bx, y1, z - az + bz, c);
}
/** Seiten eines Quaders: Ecke a (±rechts, ±vorn), Ecke b, Helligkeit. */
const BOX_SIDES = new Float32Array([-1, -1, 1, -1, 0.82, 1, 1, -1, 1, 0.82, -1, 1, -1, -1, 0.62, 1, -1, 1, 1, 0.62]);

interface Board {
  x: number;
  y: number;
  z: number;
  ux: number;
  uz: number;
  nx: number;
  nz: number;
}
/** Viereck auf einer Tafel: Ecken (u nach rechts, v nach oben), dd vor der Tafel. */
function signQuad(d: Dyn, b: Board, u0: number, v0: number, u1: number, v1: number, u2: number, v2: number, u3: number, v3: number, dd: number, c: RGB): void {
  const ox = b.x + b.nx * dd;
  const oz = b.z + b.nz * dd;
  d.v(ox + b.ux * u0, b.y + v0, oz + b.uz * u0, c);
  d.v(ox + b.ux * u1, b.y + v1, oz + b.uz * u1, c);
  d.v(ox + b.ux * u2, b.y + v2, oz + b.uz * u2, c);
  d.v(ox + b.ux * u0, b.y + v0, oz + b.uz * u0, c);
  d.v(ox + b.ux * u2, b.y + v2, oz + b.uz * u2, c);
  d.v(ox + b.ux * u3, b.y + v3, oz + b.uz * u3, c);
}

/** Glutstufe 0..1 → Farbe in klaren Comic-Stufen. */
function heatCol(h: number): RGB {
  return h < 0.15 ? CRUST : h < 0.35 ? EMBER : h < 0.55 ? HOT_R : h < 0.75 ? HOT_O : h < 0.92 ? HOT_Y : WHITE_HOT;
}

/** k Abschnitte vor (k > 0) bzw. zurück (k < 0). */
function walkSeg(t: Track, s: number, k: number): number {
  let i = s;
  for (let n = 0; n < Math.abs(k); n++) i = k > 0 ? t.next[i] : t.prev[i];
  return i;
}

// --- Zustände --------------------------------------------------------------------------

/** Rahmen einer Sprungplatte: Abschnitt je ganzem Meter ab BACK Meter vor der Platte. */
const BACK = 22;

interface Lamp {
  x: number;
  y: number;
  z: number;
  r: number;
  kind: number;
  k: number;
}
const K_TAKE = 0;
const K_LAND = 1;
const K_MAST = 2;
const K_BUOY = 3;

interface Piston {
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
  fx: number;
  fz: number;
  ph: number;
}

interface Pad {
  l: Launcher;
  /** Abschnitt je Meter: segs[a + BACK] für a = −BACK … */
  segs: Int32Array;
  cx: number;
  cz: number;
  lamps: Lamp[];
  pistons: Piston[];
  /** Winkel: Spalten und Reihen. */
  cols: number;
  rows: number;
  /** Baken: Mitte der Tafel, Normale zum Fahrer, Achse nach rechts. */
  beacons: Board[];
}

interface MeteorState {
  p: Pulse;
  s: Site;
  /** Herkunft (Himmel). */
  sx: number;
  sy: number;
  sz: number;
  acc: number;
  lastCycle: number;
}

export function buildMoon(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'mond';
  const disposables: { dispose(): void }[] = [];
  const UP: V3 = [0, 1, 0];
  const G = 30 * t.gravity;

  /** Punkt im Rahmen eines Abschnitts: seitlich lat, dy über der Fahrbahn, fwd voraus. */
  const P = (s: number, lat: number, dy: number, fwd = 0): V3 => [
    t.px[s] + rightX(t, s) * lat + t.tx[s] * fwd,
    t.py[s] + lat * t.bank[s] + dy,
    t.pz[s] + rightZ(t, s) * lat + t.tz[s] * fwd,
  ];
  /** Punkt auf der Fahrbahn, along Meter ab Abschnitt s (über mehrere Abschnitte hinweg). */
  const A = (s: number, along: number, lat: number, dy: number): V3 => {
    const k = Math.floor(along);
    return P(walkSeg(t, s, k), lat, dy, along - k);
  };

  const solid = new MeshBuilder();
  const flat = new MeshBuilder();

  // === Sprungplatten ====================================================================
  const pads: Pad[] = [];
  for (const l of t.launchers) {
    const s0 = l.seg;
    const L = l.length;
    const c = l.lat;
    const hw = l.halfWidth;
    const segs = new Int32Array(BACK + L + 4);
    for (let a = -BACK; a < L + 4; a++) segs[a + BACK] = walkSeg(t, s0, a);
    const lamps: Lamp[] = [];
    const pistons: Piston[] = [];

    // --- Platte: Schräge, Deckel, Seiten, Stirn ---
    face(solid, A(s0, -BEVEL, c - hw, 0.01), A(s0, -BEVEL, c + hw, 0.01), A(s0, 0, c + hw, PLATE_H), A(s0, 0, c - hw, PLATE_H), [-t.tx[s0] * 0.3, 1, -t.tz[s0] * 0.3], C_YEL);
    for (let a = 0; a < L; a++) {
      const s = walkSeg(t, s0, a);
      const rx = rightX(t, s);
      const rz = rightZ(t, s);
      // Deckel: orange, an den Rändern ein gelb-schwarzes Band.
      const band = 0.42;
      face(solid, A(s0, a, c - hw + band, PLATE_H), A(s0, a, c + hw - band, PLATE_H), A(s0, a + 1, c + hw - band, PLATE_H), A(s0, a + 1, c - hw + band, PLATE_H), UP, C_ORANGE);
      for (const sd of [-1, 1]) {
        const i0 = c + sd * (hw - band);
        const i1 = c + sd * hw;
        stripedFace(solid, A(s0, a, i0, PLATE_H), A(s0, a, i1, PLATE_H), A(s0, a + 1, i1, PLATE_H), A(s0, a + 1, i0, PLATE_H), UP, C_YEL, C_INK, 0.35);
        // Seite
        face(solid, A(s0, a, i1, 0), A(s0, a + 1, i1, 0), A(s0, a + 1, i1, PLATE_H), A(s0, a, i1, PLATE_H), [rx * sd, 0, rz * sd], C_ORANGE_D);
      }
    }
    face(solid, A(s0, L, c - hw, 0), A(s0, L, c + hw, 0), A(s0, L, c + hw, PLATE_H), A(s0, L, c - hw, PLATE_H), [t.tx[s0], 0, t.tz[s0]], C_ORANGE_D);

    // --- Federpakete an den Seiten: Gehäuse fest, Kolben pro Bild ---
    const housingW = 0.78;
    for (const sd of [-1, 1]) {
      const lc = c + sd * (hw + housingW / 2 + 0.02);
      for (let a = 0; a < L; a++) {
        const s = walkSeg(t, s0, a);
        const F: Xform = (x, y, z) => {
          const p = P(s, lc + x, 0, z);
          return [p[0], p[1] + y, p[2]];
        };
        boxT(solid, F, -housingW / 2, housingW / 2, -0.25, 0.3, 0, 1, a % 2 === 0 ? C_FRAME : C_FRAME_D, { noBottom: true, top: C_FRAME_D });
      }
      for (let k = 0; k < 3; k++) {
        const along = 0.9 + k * ((L - 1.8) / 2);
        const s = walkSeg(t, s0, Math.floor(along));
        const p = A(s0, along, lc, 0.3);
        pistons.push({ x: p[0], y: p[1], z: p[2], rx: rightX(t, s), rz: rightZ(t, s), fx: t.tx[s], fz: t.tz[s], ph: k * 0.9 + (sd > 0 ? 0.45 : 0) });
      }
    }

    // --- Baken mit „Pfeil hoch“ vor der Platte ---
    const beacons: Pad['beacons'] = [];
    {
      const s = walkSeg(t, s0, -BEACON_BACK);
      const rx = rightX(t, s);
      const rz = rightZ(t, s);
      for (const sd of [-1, 1]) {
        const lat = sd * (t.wh[s] + 0.9);
        const base = P(s, lat, 0);
        // Etwas zur Fahrbahnmitte gedreht.
        const yaw = 0.25;
        let nx = -t.tx[s] * Math.cos(yaw) - sd * rx * Math.sin(yaw);
        let nz = -t.tz[s] * Math.cos(yaw) - sd * rz * Math.sin(yaw);
        const nl = Math.hypot(nx, nz);
        nx /= nl;
        nz /= nl;
        const ux = -nz;
        const uz = nx;
        const F: Xform = (x, y, z) => [base[0] + ux * x - nx * z, base[1] + y, base[2] + uz * x - nz * z];
        cylT(solid, F, 0, 0.1, 0.14, -3, 2.0, C_STEEL, undefined, 6);
        boxT(solid, F, -0.9, 0.9, 1.9, 4.3, 0, 0.22, C_FRAME_D, { top: C_FRAME });
        boxT(solid, F, -0.95, 0.95, 1.65, 1.92, -0.02, 0.24, C_YEL, { stripes: [C_INK, 0.25] });
        const cy = base[1] + 3.1;
        beacons.push({ x: base[0], y: cy, z: base[2], ux, uz, nx, nz });
        // Blinklicht oben auf der Tafel
        lamps.push({ x: base[0] - nx * 0.25, y: base[1] + 4.55, z: base[2] - nz * 0.25, r: 0.26, kind: K_MAST, k: 1 });
      }
    }

    // --- Lücke dahinter: Absprung- und Landekante ---
    let gapFirst = -1;
    {
      let i = s0;
      for (let k = 0; k < 60; k++) {
        if (t.edge[i] & EDGE_GAP) {
          gapFirst = i;
          break;
        }
        i = t.next[i];
      }
    }
    if (gapFirst >= 0) {
      const e = t.prev[gapFirst];
      let land = gapFirst;
      let gapLen = 0;
      while (t.edge[land] & EDGE_GAP && gapLen < 400) {
        land = t.next[land];
        gapLen++;
      }
      const wh = t.wh[e];
      // Warnstreifen über die ganze Breite bis an die Kante (die Fahrbahn endet bei fwd 0.5) und an der Stirnseite hinab.
      stripedFace(flat, P(e, -wh, 0.035, -1.3), P(e, wh, 0.035, -1.3), P(e, wh, 0.035, 0.5), P(e, -wh, 0.035, 0.5), UP, C_YEL, C_INK, 0.6);
      const fwdOut: V3 = [t.tx[e], 0, t.tz[e]];
      stripedFace(flat, P(e, -wh, 0.035, 0.52), P(e, wh, 0.035, 0.52), P(e, wh, -1.8, 0.52), P(e, -wh, -1.8, 0.52), fwdOut, C_YEL, C_INK, 0.6);
      // Gelbe Lauflichter am Rand von den Baken bis zur Kante.
      const run = Math.max(4, Math.round((BEACON_BACK + segDeltaLocal(t, s0, e)) / 2.4));
      for (let k = 0; k < run; k++) {
        const along = 0.3 - k * 2.4;
        for (const sd of [-1, 1]) {
          const p = A(e, along, sd * (t.rh[e] + t.wh[e]) * 0.5, 0.24);
          lamps.push({ x: p[0], y: p[1], z: p[2], r: 0.24, kind: K_TAKE, k: run - 1 - k });
        }
      }
      // Kantenlichter an der Stirn.
      for (let k = 0; k < 7; k++) {
        const lat = -wh + ((k + 0.5) / 7) * 2 * wh;
        const p = P(e, lat, -0.15, 0.62);
        lamps.push({ x: p[0], y: p[1], z: p[2], r: 0.28, kind: K_TAKE, k: run });
      }

      // Landung: Schwellenbalken, Pfeile, grüner Randstreifen, Lauflichter, Blitzmasten.
      const s = land;
      const rh = t.rh[s];
      const lwh = t.wh[s];
      const bars = 8;
      const bw = (2 * rh) / (bars * 2 - 1);
      for (let b = 0; b < bars; b++) {
        const l0 = -rh + b * 2 * bw;
        for (let a = 0; a < 4; a++) {
          const al = -0.2 + a;
          face(flat, A(s, al, l0, 0.025), A(s, al, l0 + bw, 0.025), A(s, al + 1, l0 + bw, 0.025), A(s, al + 1, l0, 0.025), UP, C_MARK);
        }
      }
      for (const a0 of [8, 15]) {
        const W = rh * 0.75;
        const head = 3.6;
        const thick = 1.5;
        for (const sd of [-1, 1]) {
          const N = 4;
          for (let q = 0; q < N; q++) {
            const f0 = q / N;
            const f1 = (q + 1) / N;
            const la0 = sd * W * (1 - f0);
            const la1 = sd * W * (1 - f1);
            face(flat, A(s, a0 + head * f0, la0, 0.025), A(s, a0 + head * f1, la1, 0.025), A(s, a0 + head * f1 + thick, la1, 0.025), A(s, a0 + head * f0 + thick, la0, 0.025), UP, C_GREEN_MARK);
          }
        }
      }
      for (const sd of [-1, 1]) {
        for (let a = 0; a < 26; a += 2) face(flat, A(s, a - 0.4, sd * (rh + 0.05), 0.03), A(s, a - 0.4, sd * (rh + 0.45), 0.03), A(s, a + 1.6, sd * (rh + 0.45), 0.03), A(s, a + 1.6, sd * (rh + 0.05), 0.03), UP, C_GREEN_MARK);
      }
      for (let k = 0; k < 10; k++) {
        for (const sd of [-1, 1]) {
          const p = A(s, 0.2 + k * 2.6, sd * (lwh - 0.35), 0.3);
          lamps.push({ x: p[0], y: p[1], z: p[2], r: 0.4, kind: K_LAND, k });
        }
      }
      for (const sd of [-1, 1]) {
        const lat = sd * (lwh + 1.0);
        const base = P(s, lat, 0);
        const F: Xform = (x, y, z) => [base[0] + rightX(t, s) * x + t.tx[s] * z, y, base[2] + rightZ(t, s) * x + t.tz[s] * z];
        cylT(solid, F, 0, 0, 0.18, base[1] - 4, base[1] + 4.6, C_FRAME, C_FRAME, 6);
        boxT(solid, F, -0.55, 0.55, base[1] + 4.5, base[1] + 4.75, -0.55, 0.55, C_FRAME_D);
        lamps.push({ x: base[0], y: base[1] + 5.5, z: base[2], r: 0.75, kind: K_MAST, k: 0 });
      }

      // Leuchtbojen auf der Bahn eines normalen Sprungs (Start auf der Platte, 24 m/s, power nach oben).
      const y0 = t.py[s0] + l.lat * t.bank[s0] + 0.55;
      const gapStart = segDeltaLocal(t, s0, gapFirst);
      const off = Math.max(4, Math.min(hw + 0.6, 7.2));
      for (let q = 0; q < 3; q++) {
        const along = gapStart + ((q + 0.5) / 3) * gapLen;
        const tau = (along * t.step) / JUMP_SPEED;
        const y = y0 + l.power * tau - 0.5 * G * tau * tau;
        const sg = walkSeg(t, s0, Math.round(along));
        for (const sd of [-1, 1]) {
          const lat = c + sd * off;
          lamps.push({ x: t.px[sg] + rightX(t, sg) * lat, y, z: t.pz[sg] + rightZ(t, sg) * lat, r: 0.55, kind: K_BUOY, k: q });
        }
      }
    }

    // Winkel auf der Platte: Spalten zu etwa 3 m, Reihen je gut einen Meter.
    const cols = Math.max(1, Math.round((2 * hw - 0.9) / 3.1));
    const rows = Math.max(2, Math.round(L / 1.25));
    const mid = A(s0, L / 2, c, 0);
    pads.push({ l, segs, cx: mid[0], cz: mid[2], lamps, pistons, cols, rows, beacons });
  }

  // === Meteoriten: Krater (fest) und Herkunft ===========================================
  const meteors: MeteorState[] = [];
  for (const p of t.pulses) {
    if (p.kind !== PULSE_METEOR) continue;
    const s = siteAt(t, p.seg, p.x, p.y, p.z);
    const R = p.radius;
    // Kleiner Krater: dunkler Grund, flacher Wall – zeigt auch in Ruhe, wo es einschlägt.
    const Q = (i: number, r: number, lift: number): V3 => {
      const k = i % SEG;
      const u = COS[k] * r;
      const w = SIN[k] * r;
      return [s.x + s.rx * u + s.fx * w, s.y + u * s.bank + w * s.slope + lift, s.z + s.rz * u + s.fz * w];
    };
    const center: V3 = [s.x, s.y + 0.012, s.z];
    for (let i = 0; i < SEG; i++) {
      const j = i + 1;
      triUp(flat, center, Q(i, R * 0.42, 0.012), Q(j, R * 0.42, 0.012), C_PIT);
      face(flat, Q(i, R * 0.42, 0.012), Q(i, R * 0.5, 0.07), Q(j, R * 0.5, 0.07), Q(j, R * 0.42, 0.012), UP, C_RIM_D);
      face(flat, Q(i, R * 0.5, 0.07), Q(i, R * 0.64, 0.015), Q(j, R * 0.64, 0.015), Q(j, R * 0.5, 0.07), UP, i % 3 === 0 ? C_RIM_D : C_RIM);
    }
    // Herkunft: schräg voraus (den Anfahrenden entgegen) und etwas seitlich, hoch oben.
    const side = p.lat >= 0 ? 1 : -1;
    meteors.push({
      p,
      s,
      sx: p.x + s.fx * MET_AHEAD + s.rx * side * MET_SIDE,
      sy: p.y + MET_UP,
      sz: p.z + s.fz * MET_AHEAD + s.rz * side * MET_SIDE,
      acc: 0,
      lastCycle: -1e9,
    });
  }

  // === Feste Netze ======================================================================
  let tris = 0;
  {
    const solidGeo = solid.build();
    const flatGeo = flat.build();
    const allGeo = mergeColored([solidGeo, flatGeo]);
    const mat = toonMaterial({ vertexColors: true });
    // Markierungen liegen wenige Zentimeter über der Fahrbahn: etwas nach vorn ziehen, sonst flimmern sie.
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -4;
    const mesh = new THREE.Mesh(allGeo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(allGeo, flatGeo, mat);
    tris += allGeo.getAttribute('position').count / 3;
    if (detail && !solid.empty) {
      addSmoothNormals(solidGeo);
      const ol = new THREE.Mesh(solidGeo, outlineMaterial(0.045));
      ol.name = 'outline';
      ol.frustumCulled = false;
      group.add(ol);
      tris += solid.triangles;
    }
    disposables.push(solidGeo);
  }

  // === Pro Bild geschriebene Flächen ===================================================
  const glow = new Dyn(9000);
  const light = new Dyn(3000);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  // Additiv ohne Nebel; die Ferne dämpft update().
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const glowMesh = new THREE.Mesh(glow.geo, glowMat);
  const lightMesh = new THREE.Mesh(light.geo, lightMat);
  glowMesh.frustumCulled = false;
  lightMesh.frustumCulled = false;
  lightMesh.renderOrder = 2;
  group.add(glowMesh, lightMesh);
  disposables.push(glow, light, glowMat, lightMat);

  // === Feuerbälle (instanziert) =======================================================
  const ballGeo = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  {
    const p = ballGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let f = 0; f < p.count / 3; f++) {
      const c = f % 4 === 0 ? HOT_O : f % 4 === 1 ? WHITE_HOT : f % 4 === 2 ? HOT_Y : rgb(0xffb64a);
      for (let k = 0; k < 3; k++) col.set(c, (f * 3 + k) * 3);
    }
    ballGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  addSmoothNormals(ballGeo);
  const ballMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const nBalls = Math.max(1, meteors.length);
  const balls = new THREE.InstancedMesh(ballGeo, ballMat, nBalls);
  balls.frustumCulled = false;
  balls.count = 0;
  group.add(balls);
  disposables.push(ballGeo, ballMat, balls);
  let ballOl: THREE.InstancedMesh | null = null;
  if (detail) {
    ballOl = new THREE.InstancedMesh(ballGeo, outlineMaterial(0.07), nBalls);
    ballOl.instanceMatrix = balls.instanceMatrix;
    ballOl.frustumCulled = false;
    ballOl.count = 0;
    ballOl.name = 'outline';
    group.add(ballOl);
    disposables.push(ballOl);
  }
  group.userData.triangles = tris;

  // === Hilfsobjekte für update() (kein Garbage pro Bild) ================================
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const rq = new THREE.Quaternion();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const farFade = (d: number): number => Math.max(0, Math.min(1, 1 - (d - 160) / 260));
  const fxOn = detail;
  const pt: [number, number, number] = [0, 0, 0];
  /** Punkt auf einer Platte: along Meter ab Plattenanfang, lat, dy → pt. */
  const padPt = (pd: Pad, along: number, lat: number, dy: number): void => {
    let k = Math.floor(along);
    if (k < -BACK) k = -BACK;
    if (k > pd.segs.length - BACK - 1) k = pd.segs.length - BACK - 1;
    const s = pd.segs[k + BACK];
    const f = along - k;
    pt[0] = t.px[s] + -t.tz[s] * lat + t.tx[s] * f;
    pt[1] = t.py[s] + lat * t.bank[s] + dy;
    pt[2] = t.pz[s] + t.tx[s] * lat + t.tz[s] * f;
  };
  const padV = (d: Dyn, pd: Pad, along: number, lat: number, dy: number, c: RGB, f = 1): void => {
    padPt(pd, along, lat, dy);
    d.v(pt[0], pt[1], pt[2], c, f);
  };
  /** Viereck auf der Platte (along/lat-Ecken). */
  const padQuad = (d: Dyn, pd: Pad, a0: number, l0: number, a1: number, l1: number, a2: number, l2: number, a3: number, l3: number, dy: number, c: RGB): void => {
    padV(d, pd, a0, l0, dy, c);
    padV(d, pd, a1, l1, dy, c);
    padV(d, pd, a2, l2, dy, c);
    padV(d, pd, a0, l0, dy, c);
    padV(d, pd, a2, l2, dy, c);
    padV(d, pd, a3, l3, dy, c);
  };
  /** Winkel „>“ in Fahrtrichtung: Spitze bei along a + head, Breite 2·w, Schenkeldicke th. */
  const chevron = (d: Dyn, pd: Pad, a: number, lc: number, w: number, head: number, th: number, dy: number, c: RGB): void => {
    for (let sd = -1; sd <= 1; sd += 2) padQuad(d, pd, a, lc + sd * w, a + head, lc, a + head + th, lc, a + th, lc + sd * w, dy, c);
  };

  // --- Sprungplatte ---------------------------------------------------------------------
  const updatePad = (pd: Pad, rs: number, cam: THREE.Vector3, dist: number): void => {
    const l = pd.l;
    const L = l.length;
    const hw = l.halfWidth;
    const c = l.lat;
    const ff = farFade(dist);
    const near = dist < 120;
    // Winkel: Lauflicht in Fahrtrichtung (2,4 Durchläufe je Sekunde).
    const colW = (2 * hw - 0.9) / pd.cols;
    const rowL = (L - 0.3) / pd.rows;
    const dy = PLATE_H + 0.012;
    for (let r = 0; r < pd.rows; r++) {
      const ph = (((rs * 2.4 - r / pd.rows) % 1) + 1) % 1;
      const step = 1 / pd.rows;
      const col = ph < step ? L_WHITE : ph < 2 * step ? C_YEL : C_CHEV;
      const a = 0.15 + r * rowL;
      for (let k = 0; k < pd.cols; k++) {
        const lc = c - hw + 0.45 + (k + 0.5) * colW;
        const w = colW * 0.34;
        const head = Math.min(rowL * 0.5, w * 0.8);
        const th = rowL * 0.27;
        if (detail) chevron(glow, pd, a - 0.07, lc, w + 0.1, head, th + 0.14, dy - 0.004, C_INK);
        chevron(glow, pd, a, lc, w, head, th, dy, col);
      }
    }
    // Federpakete: Balg und Deckel heben und senken sich (atmen) – eine Welle läuft nach vorn.
    for (const ps of pd.pistons) {
      const b = 0.5 + 0.5 * Math.sin(rs * Math.PI * 2 * 1.3 - ps.ph);
      const h = 0.35 + 0.65 * b;
      const n = near ? 4 : 2;
      const lh = h / n;
      for (let k = 0; k < n; k++) {
        const wide = k % 2 === 0;
        boxD(glow, ps.x, ps.z, ps.rx, ps.rz, ps.fx, ps.fz, wide ? 0.34 : 0.25, wide ? 0.52 : 0.4, ps.y + k * lh, ps.y + (k + 1) * lh, wide ? C_INK : C_ORANGE);
      }
      boxD(glow, ps.x, ps.z, ps.rx, ps.rz, ps.fx, ps.fz, 0.4, 0.6, ps.y + h, ps.y + h + 0.14, b > 0.7 ? C_YEL : C_ORANGE_D);
    }
    // Baken: „Pfeil hoch“ aus drei Winkeln, die von unten nach oben aufleuchten.
    for (const bc of pd.beacons) {
      signQuad(glow, bc, -0.82, -1.12, 0.82, -1.12, 0.82, 1.12, -0.82, 1.12, 0.012, C_INK);
      for (let k = 0; k < 3; k++) {
        const ph = (((rs * 1.8 - k / 3) % 1) + 1) % 1;
        const col = ph < 0.4 ? L_WHITE : ph < 0.7 ? L_YEL : C_ORANGE_D;
        const v0 = -0.95 + k * 0.62;
        const w = 0.66;
        const th = 0.26;
        const hh = 0.42;
        // Winkel ^
        signQuad(glow, bc, -w, v0, -w + th, v0, th / 2, v0 + hh + th, -th / 2, v0 + hh + th, 0.03, col);
        signQuad(glow, bc, w - th, v0, w, v0, th / 2, v0 + hh + th, -th / 2, v0 + hh + th, 0.03, col);
      }
      glowBlob(light, bc.x + bc.nx * 0.3, bc.y, bc.z + bc.nz * 0.3, cam, 1.3, 1.5, GLOW_ORANGE, 0.22 * ff);
    }
    // Lichter
    for (const lp of pd.lamps) {
      let col: RGB;
      let f = 1;
      if (lp.kind === K_TAKE) {
        const ph = (((rs * 1.6 - lp.k / 10) % 1) + 1) % 1;
        col = ph < 0.2 ? L_WHITE : L_YEL;
        f = ph < 0.2 ? 1 : 0.8;
      } else if (lp.kind === K_LAND) {
        const ph = (((rs * 1.4 - lp.k / 10) % 1) + 1) % 1;
        col = ph < 0.2 ? L_GREEN_HI : L_GREEN;
        f = ph < 0.2 ? 1 : 0.6;
      } else if (lp.kind === K_MAST) {
        const ph = (rs * 1.2 + lp.k * 0.5) % 1;
        col = lp.k === 0 ? (ph < 0.18 ? L_GREEN_HI : L_GREEN) : ph < 0.25 ? L_WHITE : L_ORANGE;
        f = ph < 0.5 ? 1 : 0.4;
      } else {
        // Bojen: ein Puls läuft die Linie in Flugrichtung entlang.
        const ph = (((rs * 1.1 - lp.k / 4) % 1) + 1) % 1;
        col = ph < 0.25 ? L_WHITE : L_ORANGE;
        f = ph < 0.25 ? 1 : 0.75;
      }
      if (lp.kind === K_BUOY) {
        // Kragen aus Tusche um die Boje.
        const r0 = lp.r * 1.2;
        const r1 = lp.r * 1.75;
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * Math.PI * 2;
          const a1 = ((k + 1) / 8) * Math.PI * 2;
          glow.v(lp.x + Math.cos(a0) * r0, lp.y, lp.z + Math.sin(a0) * r0, C_INK);
          glow.v(lp.x + Math.cos(a0) * r1, lp.y, lp.z + Math.sin(a0) * r1, C_INK);
          glow.v(lp.x + Math.cos(a1) * r1, lp.y, lp.z + Math.sin(a1) * r1, C_INK);
          glow.v(lp.x + Math.cos(a0) * r0, lp.y, lp.z + Math.sin(a0) * r0, C_INK);
          glow.v(lp.x + Math.cos(a1) * r1, lp.y, lp.z + Math.sin(a1) * r1, C_INK);
          glow.v(lp.x + Math.cos(a1) * r0, lp.y, lp.z + Math.sin(a1) * r0, C_INK);
        }
        glowBlob(light, lp.x, lp.y, lp.z, cam, 1.1, 1.1, GLOW_ORANGE, (f > 0.9 ? 0.45 : 0.2) * ff);
      } else if (lp.kind === K_MAST) {
        glowBlob(light, lp.x, lp.y, lp.z, cam, 1.0, 1.0, lp.k === 0 ? GLOW_GREEN : GLOW_ORANGE, f * 0.5 * ff);
      }
      lamp(glow, lp.x, lp.y, lp.z, lp.r, col, f);
    }
    // Schein über der Platte: orange, pulsiert im Takt des Lauflichts.
    const pulse = 0.5 + 0.5 * Math.sin(rs * Math.PI * 2 * 2.4);
    const gf = (0.28 + 0.2 * pulse) * ff;
    const gh = 0.5 + 0.3 * pulse + 1.2 * Math.max(0, Math.min(1, (dist - 40) / 60));
    // Vorderkante
    padV(light, pd, 0, c - hw, PLATE_H, GLOW_YELLOW, gf);
    padV(light, pd, 0, c + hw, PLATE_H, GLOW_YELLOW, gf);
    padV(light, pd, 0, c + hw, PLATE_H + gh, BLACK);
    padV(light, pd, 0, c - hw, PLATE_H, GLOW_YELLOW, gf);
    padV(light, pd, 0, c + hw, PLATE_H + gh, BLACK);
    padV(light, pd, 0, c - hw, PLATE_H + gh, BLACK);
  };

  // --- Meteorit ---------------------------------------------------------------------
  let nDrawn = 0;
  const updateMeteor = (m: MeteorState, time: number, rs: number, dt: number, cam: THREE.Vector3, dist: number, fx: FxSink): void => {
    const p = m.p;
    const s = m.s;
    const R = p.radius;
    const c = pulseCycle(p, time);
    const w = pulseWarning(p, time);
    const active = c < p.on;
    const post = !active && c - p.on < AFTER ? 1 - (c - p.on) / AFTER : 0;
    const ff = farFade(dist);
    const near = fxOn && dist < FX_NEAR;
    st = dist > 80 ? 2 : 1;

    if (w > 0) {
      const ws = (w * p.warn) / 60;
      // Zielkreis: wächst bis an den Rand der Gefahr; der Rand läuft um, immer schneller.
      const g = smooth(Math.min(1, w * 1.3));
      const rr = R * (0.18 + 0.82 * g);
      disc(glow, s, rr, 0.045, w > 0.75 && Math.floor(rs * 8) % 2 === 0 ? TARGET_HI : TARGET);
      const spin = Math.floor((ws * 6 + ws * ws * 5) * 1.5);
      const rw = 0.24 + 0.2 * g;
      for (let i = 0; i < SEG; i += st) {
        const on = ((i / st + spin) & 3) < 2;
        quadRing(glow, s, i, rr, rr + rw, 0.05, on ? TARGET_RIM : C_INK);
      }
      ring(glow, s, rr + rw, rr + rw + 0.08, 0.05, C_INK);
      // Fadenkreuz: vier Zacken zur Mitte.
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const pa = -sa * 0.22;
        const pb = ca * 0.22;
        gv(glow, s, ca * rr + pa, sa * rr + pb, 0.055, TARGET_RIM);
        gv(glow, s, ca * rr - pa, sa * rr - pb, 0.055, TARGET_RIM);
        gv(glow, s, ca * rr * 0.62, sa * rr * 0.62, 0.055, TARGET_RIM);
      }
      curtain(light, s, rr + 0.1, 0.15 + 0.45 * w, GLOW_RED, (0.1 + 0.25 * w) * ff);

      // Der Feuerball: vom Himmelspunkt schräg herab, schneller werdend; Einschlag genau bei Zyklus 0.
      const k = Math.pow(w, 1.7);
      const x = m.sx + (p.x - m.sx) * k;
      const y = m.sy + (p.y + 0.4 - m.sy) * k;
      const z = m.sz + (p.z - m.sz) * k;
      const size = 0.22 + 1.0 * smooth(w);
      // Flugrichtung (Einheitsvektor) und Sicht quer dazu.
      let dx = p.x - m.sx;
      let dy = p.y - m.sy;
      let dz = p.z - m.sz;
      const dl = Math.hypot(dx, dy, dz);
      dx /= dl;
      dy /= dl;
      dz /= dl;
      let vx = x - cam.x;
      let vy = y - cam.y;
      let vz = z - cam.z;
      const vd = Math.hypot(vx, vy, vz) || 1;
      vx /= vd;
      vy /= vd;
      vz /= vd;
      // Seite = Flug × Sicht
      let sx = dy * vz - dz * vy;
      let sy = dz * vx - dx * vz;
      let sz = dx * vy - dy * vx;
      const sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl;
      sy /= sl;
      sz /= sl;
      if (w > 0.12) {
        pv.set(x, y, z);
        q.setFromAxisAngle(yAxis, rs * 5 + p.seg);
        q.multiply(rq.setFromAxisAngle(xAxis, rs * 3.7));
        sv.setScalar(size);
        m4.compose(pv, q, sv);
        balls.setMatrixAt(nDrawn, m4);
        nDrawn++;
        // Schweif: drei Flammenzungen, zur Kamera gedreht, nach hinten spitz (opak).
        const len = (3 + 13 * smooth(w)) * Math.min(1, w * 3);
        const layers = detail ? 4 : 3;
        for (let ly = 0; ly < layers; ly++) {
          const ink = detail && ly === 0;
          const li = detail ? ly - 1 : ly;
          const wide = ink ? 1.12 : TAIL_W[li];
          const lf = ink ? 1.04 : TAIL_L[li];
          const col = ink ? C_INK : TAIL_C[li];
          // Etwas zur Kamera gerückt, je innerer, desto näher.
          const push = -0.05 * ly - (ink ? 0 : 0.05);
          const ox = x + vx * push;
          const oy = y + vy * push;
          const oz = z + vz * push;
          const N = 4;
          for (let n = 0; n < N; n++) {
            const f0 = n / N;
            const f1 = (n + 1) / N;
            const zig0 = n % 2 === 0 ? 1 : 0.8;
            const zig1 = n % 2 === 0 ? 0.8 : 1;
            const w0 = size * wide * (1 - f0) * zig0;
            const w1 = size * wide * (1 - f1) * zig1;
            const b0 = -len * lf * f0;
            const b1 = -len * lf * f1;
            const ax = ox + dx * b0;
            const ay = oy + dy * b0;
            const az = oz + dz * b0;
            const bx = ox + dx * b1;
            const by = oy + dy * b1;
            const bz = oz + dz * b1;
            glow.v(ax - sx * w0, ay - sy * w0, az - sz * w0, col);
            glow.v(ax + sx * w0, ay + sy * w0, az + sz * w0, col);
            glow.v(bx + sx * w1, by + sy * w1, bz + sz * w1, col);
            glow.v(ax - sx * w0, ay - sy * w0, az - sz * w0, col);
            glow.v(bx + sx * w1, by + sy * w1, bz + sz * w1, col);
            glow.v(bx - sx * w1, by - sy * w1, bz - sz * w1, col);
          }
        }
      }
      // Heller Punkt bzw. Schein um den Feuerball – aus der Ferne mindestens ein deutlicher Fleck.
      const bd = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
      const pr = Math.max(size * 2.6, bd * 0.016);
      glowBlob(light, x, y, z, cam, pr, pr, w < 0.3 ? GLOW_WHITE : GLOW_YELLOW, 0.9 * Math.min(1, w * 6));
      if (w < 0.45) {
        // Funkeln: ein Kreuz aus zwei Strahlen.
        const L2 = pr * 2.2;
        const th = pr * 0.12;
        const fl = (0.6 + 0.4 * Math.sin(rs * 30)) * Math.min(1, w * 8) * (1 - w / 0.45);
        let hx = cam.z - z;
        let hz = x - cam.x;
        const hl = Math.hypot(hx, hz) || 1;
        hx /= hl;
        hz /= hl;
        light.v(x - hx * L2, y, z - hz * L2, BLACK);
        light.v(x, y + th, z, GLOW_WHITE, fl);
        light.v(x, y - th, z, GLOW_WHITE, fl);
        light.v(x + hx * L2, y, z + hz * L2, BLACK);
        light.v(x, y + th, z, GLOW_WHITE, fl);
        light.v(x, y - th, z, GLOW_WHITE, fl);
        light.v(x, y - L2, z, BLACK);
        light.v(x - hx * th, y, z - hz * th, GLOW_WHITE, fl);
        light.v(x + hx * th, y, z + hz * th, GLOW_WHITE, fl);
        light.v(x, y + L2, z, BLACK);
        light.v(x - hx * th, y, z - hz * th, GLOW_WHITE, fl);
        light.v(x + hx * th, y, z + hz * th, GLOW_WHITE, fl);
      }
      if (near && w > 0.3) {
        // Glutfunken hinter dem Feuerball.
        m.acc -= dt * 24;
        while (m.acc <= 0) {
          m.acc += 1;
          fx.spark(x - dx * size, y - dy * size, z - dz * size, -dx * 3 + (Math.random() - 0.5) * 2, -dy * 3 + (Math.random() - 0.5) * 2, -dz * 3 + (Math.random() - 0.5) * 2, 0.5, size * 0.9, Math.random() < 0.5 ? 0xffe27a : 0xff8a2a, 0);
        }
      }
    }

    if (active || post > 0) {
      const k = c / p.on;
      // Glühender Krater: erst weißglühend, dann gelb, orange, rot – bis zuletzt klar glühend.
      const hot = active ? 1 - 0.62 * smooth(k) : 0.25 * post;
      const sc = active ? Math.min(1, 0.6 + c / 5) : 1;
      disc(glow, s, R * 0.42 * sc, 0.03, heatCol(hot), heatCol(hot * 0.82));
      // Glutadern bis an den Rand der Gefahr.
      const reach = R * (0.55 + 0.4 * Math.min(1, c / 6));
      for (let i = 0; i < SEG; i += 2) {
        const a = ((i + 0.3) / SEG) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const da = 0.1;
        const rr = (i % 4 === 0 ? 1 : 0.8) * reach;
        gv(glow, s, Math.cos(a - da) * R * 0.4, Math.sin(a - da) * R * 0.4, 0.035, heatCol(hot * 0.85));
        gv(glow, s, Math.cos(a + da) * R * 0.4, Math.sin(a + da) * R * 0.4, 0.035, heatCol(hot * 0.85));
        gv(glow, s, ca * rr, sa * rr, 0.035, heatCol(hot * 0.6));
      }
      if (active) {
        // Rand der Gefahr: dünner glühender Ring.
        ring(glow, s, R - 0.16, R, 0.04, k < 0.7 ? HOT_R : EMBER);
        curtain(light, s, R * 0.95, 0.3 + 0.8 * (1 - k), GLOW_ORANGE, (0.18 + 0.3 * (1 - k)) * ff);
        glowBlob(light, s.x, s.y + 0.5, s.z, cam, R * 1.1, 1.4, GLOW_ORANGE, 0.5 * (1 - k) * ff);
      }
      // Einschlag: Lichtblitz und eine helle Druckwelle bis an den Rand.
      if (active && c < FLASH) {
        const e = c / FLASH;
        const fl = (1 - e) * (1 - e);
        glowBlob(light, s.x, s.y + 1.5, s.z, cam, R * (2.2 + 2 * e), R * (2 + 1.6 * e), GLOW_WHITE, 1.2 * fl * Math.max(ff, 0.4));
        glowBlob(light, s.x, s.y + 1, s.z, cam, R * 3.5, R * 2.4, GLOW_YELLOW, 0.4 * fl * Math.max(ff, 0.4));
        const rw = R * (0.4 + 0.6 * Math.min(1, e * 1.6));
        if (e < 0.6) ring(glow, s, rw - 0.35, rw, 0.06, e < 0.3 ? WHITE_HOT : HOT_Y);
      }
      if (near) {
        const cyc = Math.floor((time + p.phase) / p.period);
        if (cyc !== m.lastCycle && c < 8) {
          m.lastCycle = cyc;
          // Staub in Zeitlupe: hoch hinauf und langsam wieder herab (geringe Schwerkraft).
          const gd = G * 0.3;
          for (let k2 = 0; k2 < 10; k2++) {
            const a = (k2 / 10) * Math.PI * 2 + Math.random() * 0.4;
            const sp = 1.8 + Math.random() * 2.8;
            fx.puff(s.x + Math.cos(a) * R * 0.4, s.y + 0.3, s.z + Math.sin(a) * R * 0.4, Math.cos(a) * sp, 4 + Math.random() * 5, Math.sin(a) * sp, 2.0 + Math.random() * 0.6, 0.7 + Math.random() * 0.5, k2 % 3 === 0 ? 0x8d8a9a : 0xc4c1cd, 0.5, gd);
          }
          // Gesteinsbrocken und Funken im hohen Bogen.
          for (let k2 = 0; k2 < 14; k2++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 4;
            fx.spark(s.x, s.y + 0.5, s.z, Math.cos(a) * sp, 6 + Math.random() * 6, Math.sin(a) * sp, 1.6, 0.3 + Math.random() * 0.25, Math.random() < 0.5 ? 0xffe27a : 0xff8a2a, G);
          }
          for (let k2 = 0; k2 < 6; k2++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 3;
            fx.puff(s.x, s.y + 0.5, s.z, Math.cos(a) * sp, 5 + Math.random() * 4, Math.sin(a) * sp, 1.8, 0.35, 0x3a3846, 0, G);
          }
        }
        if (active && c < p.on - 30) {
          // Rauch über dem Krater, steigt langsam.
          m.acc -= dt * 2;
          while (m.acc <= 0) {
            m.acc += 1;
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * R * 0.35;
            fx.puff(s.x + Math.cos(a) * r, s.y + 0.2, s.z + Math.sin(a) * r, 0, 1.1, 0, 1.2, 0.45, 0x6a6476, 0.4, -0.6);
          }
        }
      }
    }
  };

  return {
    group,
    update(time, _seconds, dt, cam, fx) {
      const rs = time / 60;
      glow.begin();
      light.begin();
      nDrawn = 0;
      st = 1;
      for (const pd of pads) {
        const dist = Math.hypot(pd.cx - cam.x, pd.cz - cam.z);
        if (dist < PLATE_FAR) updatePad(pd, rs, cam, dist);
      }
      for (const m of meteors) {
        const dist = Math.hypot(m.p.x - cam.x, m.p.z - cam.z);
        if (dist < DRAW_FAR) updateMeteor(m, time, rs, dt, cam, dist, fx);
      }
      glow.end();
      light.end();
      balls.count = nDrawn;
      if (ballOl) ballOl.count = nDrawn;
      if (nDrawn > 0) balls.instanceMatrix.needsUpdate = true;
      // Leere Netze gar nicht erst zeichnen.
      glowMesh.visible = glow.tris > 0;
      lightMesh.visible = light.tris > 0;
      balls.visible = nDrawn > 0;
      if (ballOl) ballOl.visible = nDrawn > 0;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Dreieck, sichtbar von oben. */
function triUp(mb: MeshBuilder, a: V3, b: V3, c: V3, col: RGB): void {
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny >= 0) mb.tri(a, b, c, col);
  else mb.tri(a, c, b, col);
}

/** Abschnitte von a bis b in Fahrtrichtung (auf demselben Weg; höchstens 400). */
function segDeltaLocal(t: Track, a: number, b: number): number {
  let i = a;
  for (let k = 0; k < 400; k++) {
    if (i === b) return k;
    i = t.next[i];
  }
  return 0;
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
