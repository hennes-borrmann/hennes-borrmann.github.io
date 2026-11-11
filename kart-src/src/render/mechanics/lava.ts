// Glutkessel: Geysire, Lavabomben, der Lavaschwall in der Höhle und die Ampel
// an der Gabelung davor.
//
// Ort, Größe und Takt kommen ausschließlich aus der Physik (game/mechanics.ts):
// gefährlich ist es genau, solange pulseCycle(p, time) < p.on, im Umkreis
// p.radius. Deshalb hängt alles, was nach Gefahr aussieht, an `time` (Ticks
// der Rennzeit) und bleibt innerhalb von p.radius; `seconds` dient nur zum
// Flackern.
//
// Bildsprache der Gefahr – überall gleich:
//   * Glutring auf dem Boden plus ein leuchtender Vorhang am Rand = hier wird
//     es gleich bzw. ist es heiß, und zwar genau bis zu diesem Rand.
//   * Je schneller etwas pulsiert, desto näher der Ausbruch.
//
// Zeichenaufrufe (höchstens 10): Fels und Tafeln (toon) samt Kontur, Glut
// (ungeschattet, Flächen werden pro Bild neu geschrieben), Schatten
// (halbdurchsichtig), Leuchten (additiv), Fontänen samt Kontur, Bomben samt
// Kontur, Leuchtspuren. Was pro Bild neu entsteht, wird nur in Kameranähe
// geschrieben – entfernte Stellen kosten keine Dreiecke.

import * as THREE from 'three';
import {
  FLOOD_DEPTH,
  FLOOD_FROM,
  PULSE_VENT,
  floodLevel,
  floodPeak,
  pulseCycle,
  pulseWarning,
  type Flood,
  type Pulse,
} from '../../game/mechanics';
import { rightX, rightZ, wrapSeg, type Track } from '../../game/track';
import { MeshBuilder, noise, seeded, shade, smooth, type RGB } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { INK, addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';

// --- Farben ------------------------------------------------------------------------

const C_INK = rgb(INK);
const HOLE = rgb(0x0e090f);
const CRUST_DARK = rgb(0x2a1418);
const CRUST = rgb(0x5a1a14);
const EMBER = rgb(0xa2300f);
const LAVA0 = rgb(0xff4d0f);
const LAVA1 = rgb(0xff9a1f);
const LAVA2 = rgb(0xffe27a);
const WHITE_HOT = rgb(0xfff2b0);
const ROCK = rgb(0x2a2331);
const ROCK_LIGHT = rgb(0x4a3a48);
const ASH = rgb(0x2b2230);
const ASH_LIGHT = rgb(0x352b3a);
const SHADOW = rgb(0x07040a);
/** Additive Leuchtfarben (werden mit der Stärke multipliziert). */
const GLOW_ORANGE = rgb(0xff6a1a);
const GLOW_YELLOW = rgb(0xffb040);
const GLOW_GREEN = rgb(0x2aff5a);
const GLOW_RED = rgb(0xff2010);
/** Ampel */
const SIG_GREEN = rgb(0x3dff6a);
const SIG_GREEN_DARK = rgb(0x0b2a14);
const SIG_GREEN_LIGHT = rgb(0xc8ffd2);
const SIG_RED = rgb(0xff2414);
const SIG_RED_DARK = rgb(0x3a0806);
const BLACK: RGB = [0, 0, 0];

/** Glutstufe 0..1 → Farbe in klaren Comic-Stufen (keine weichen Verläufe). */
function heatCol(h: number): RGB {
  return h < 0.12 ? CRUST_DARK : h < 0.3 ? CRUST : h < 0.48 ? EMBER : h < 0.66 ? LAVA0 : h < 0.85 ? LAVA1 : h < 0.97 ? LAVA2 : WHITE_HOT;
}

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

  constructor(capTris: number, private readonly k: 3 | 4) {
    this.max = capTris * 3;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * k);
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, k).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pa);
    this.geo.setAttribute('color', this.ca);
    this.geo.setDrawRange(0, 0);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  }

  begin(): void {
    this.n = 0;
  }

  /** Eine Ecke; je drei ergeben ein Dreieck. Über der Obergrenze wird still verworfen. */
  v(x: number, y: number, z: number, c: RGB, a = 1, f = 1): void {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    const o = i * this.k;
    this.col[o] = c[0] * f;
    this.col[o + 1] = c[1] * f;
    this.col[o + 2] = c[2] * f;
    if (this.k === 4) this.col[o + 3] = a;
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
    this.ca.addUpdateRange(0, n * this.k);
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
  /** Höhe pro Meter nach rechts bzw. nach vorn. */
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
function gv(d: Dyn, s: Site, u: number, w: number, lift: number, c: RGB, a = 1, f = 1): void {
  d.v(s.x + s.rx * u + s.fx * w, s.y + u * s.bank + w * s.slope + lift, s.z + s.rz * u + s.fz * w, c, a, f);
}

/** Ring auf dem Boden zwischen r0 und r1 (je Ecke eigene Höhe und Farbe). */
function ring(d: Dyn, s: Site, r0: number, r1: number, l0: number, l1: number, c0: RGB, c1: RGB, a0 = 1, a1 = 1, f0 = 1, f1 = 1): void {
  for (let i = 0; i < SEG; i += st) {
    const ca = COS[i];
    const sa = SIN[i];
    const cb = COS[i + st];
    const sb = SIN[i + st];
    gv(d, s, ca * r0, sa * r0, l0, c0, a0, f0);
    gv(d, s, ca * r1, sa * r1, l1, c1, a1, f1);
    gv(d, s, cb * r1, sb * r1, l1, c1, a1, f1);
    gv(d, s, ca * r0, sa * r0, l0, c0, a0, f0);
    gv(d, s, cb * r1, sb * r1, l1, c1, a1, f1);
    gv(d, s, cb * r0, sb * r0, l0, c0, a0, f0);
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
    // Oberkante als Zacken – wie gezeichnete Flammenzungen.
    const ha = (i / st) % 2 === 0 ? h : h * 0.5;
    const hb = (i / st) % 2 === 0 ? h * 0.5 : h;
    gv(d, s, ca, sa, 0.04, c, 1, f);
    gv(d, s, cb, sb, 0.04, c, 1, f);
    gv(d, s, cb, sb, hb, BLACK);
    gv(d, s, ca, sa, 0.04, c, 1, f);
    gv(d, s, cb, sb, hb, BLACK);
    gv(d, s, ca, sa, ha, BLACK);
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
    d.v(x, y, z, c, 1, f);
    d.v(x + hx * Math.cos(a0) * w, y + Math.sin(a0) * h, z + hz * Math.cos(a0) * w, BLACK);
    d.v(x + hx * Math.cos(a1) * w, y + Math.sin(a1) * h, z + hz * Math.cos(a1) * w, BLACK);
  }
}

/** Halbkugel (Blase, Lavabeule) auf dem Boden. */
function dome(d: Dyn, s: Site, u: number, w: number, lift: number, r: number, h: number, cTop: RGB, cSide: RGB): void {
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    // unterer Gürtel
    gv(d, s, u + c0 * r, w + s0 * r, lift, cSide);
    gv(d, s, u + c1 * r, w + s1 * r, lift, cSide);
    gv(d, s, u + c1 * r * 0.62, w + s1 * r * 0.62, lift + h * 0.78, cSide);
    gv(d, s, u + c0 * r, w + s0 * r, lift, cSide);
    gv(d, s, u + c1 * r * 0.62, w + s1 * r * 0.62, lift + h * 0.78, cSide);
    gv(d, s, u + c0 * r * 0.62, w + s0 * r * 0.62, lift + h * 0.78, cSide);
    // Kappe
    gv(d, s, u + c0 * r * 0.62, w + s0 * r * 0.62, lift + h * 0.78, cTop);
    gv(d, s, u + c1 * r * 0.62, w + s1 * r * 0.62, lift + h * 0.78, cTop);
    gv(d, s, u, w, lift + h, cTop);
  }
}

// --- Ablauf ---------------------------------------------------------------------------

/** Höhe der Fontäne (m) und Ticks, in denen sie hochschießt bzw. in sich zusammenfällt. */
const JET_H = 7.2;
const JET_UP = 9;
const JET_DOWN = 16;
/** Nachglimmen nach dem Ende der Gefahr (Ticks, höchstens 0,2 s). */
const AFTER = 10;
/** Schwerkraft der Bomben (überzeichnet: hoher, zügiger Bogen). */
const BOMB_G = 24;
/** Spritzer beim Einschlag (Ticks). */
const SPLASH = 18;
/** Pro Bild geschrieben wird nur bis zu dieser Entfernung von der Kamera; Teilchen nur bis FX_NEAR. */
const DRAW_FAR = 230;
/** Ab hier werden Ringe und Scheiben mit halber Segmentzahl geschrieben. */
const LOD_NEAR = 70;
const FX_NEAR = 150;

interface VentState {
  p: Pulse;
  s: Site;
  /** Zackiger Felsrand: Radiusfaktor je Winkel. */
  jag: Float32Array;
  acc: number;
  acc2: number;
  lastCycle: number;
}

interface BombState {
  p: Pulse;
  s: Site;
  /** Umriss der Glutpfütze: Radius je Winkel (≤ radius). */
  blob: Float32Array;
  /** Abwurf: Startpunkt und Anfangsgeschwindigkeit nach oben. */
  sx: number;
  sy: number;
  sz: number;
  vy: number;
  T: number;
  acc: number;
  lastCycle: number;
  /** Krustenschollen je Segment (0..1, fest). */
  plate: Float32Array;
}

interface Sign {
  flood: Flood;
  /** Mitte der Tafel, Achsen (u = rechts aus Sicht des Fahrers, n = zum Fahrer hin). */
  cx: number;
  cy: number;
  cz: number;
  ux: number;
  uz: number;
  nx: number;
  nz: number;
  w: number;
  h: number;
  side: number;
  /** Fahrzeit von der Tafel bis zur Gabelung (Ticks; hinter der Gabelung negativ). */
  extra: number;
}

export function buildLava(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(7300 + t.index * 31);

  // === Feste Teile: Felsränder der Schlote, Ascheringe, Tafelgerüste ===================
  const rock = new MeshBuilder();
  const vents: VentState[] = [];
  const bombs: BombState[] = [];

  for (const p of t.pulses) {
    // Nur Geysire und Bomben gehören hierher (Pressen und Blasenschlote zeichnen andere).
    if (p.kind !== PULSE_VENT && p.kind !== 1) continue;
    const s = siteAt(t, p.seg, p.x, p.y, p.z);
    const R = p.radius;
    if (p.kind === PULSE_VENT) {
      const jag = new Float32Array(SEG);
      for (let i = 0; i < SEG; i++) jag[i] = 0.92 + rnd() * 0.16;
      vents.push({ p, s, jag, acc: rnd(), acc2: rnd(), lastCycle: -1e9 });
      const P = (i: number, r: number, lift: number): [number, number, number] => {
        const k = i % SEG;
        const u = COS[k] * r;
        const w = SIN[k] * r;
        return [s.x + s.rx * u + s.fx * w, s.y + u * s.bank + w * s.slope + lift, s.z + s.rz * u + s.fz * w];
      };
      for (let i = 0; i < SEG; i++) {
        const j = i + 1;
        const ji = jag[i];
        const jj = jag[j % SEG];
        const hi = 0.15 + (ji - 0.92) * 0.4;
        const hj = 0.15 + (jj - 0.92) * 0.4;
        // Schlund
        rock.tri(P(i, 0, 0.012), P(j, 0.44 * R, 0.012), P(i, 0.44 * R, 0.012), HOLE);
        // Krone des Felsrands und äußere Flanke
        const top = i % 3 === 0 ? ROCK_LIGHT : ROCK;
        rock.quad(P(i, 0.52 * R * ji, hi), P(i, 0.6 * R * ji, hi), P(j, 0.6 * R * jj, hj), P(j, 0.52 * R * jj, hj), top);
        rock.quad(P(i, 0.6 * R * ji, hi), P(i, 0.78 * R, 0.015), P(j, 0.78 * R, 0.015), P(j, 0.6 * R * jj, hj), shade(ROCK, 0.85));
        // Aschering bis an den Rand der Gefahr: der Fußabdruck des Geysirs
        rock.quad(P(i, 0.78 * R, 0.012), P(i, R, 0.01), P(j, R, 0.01), P(j, 0.78 * R, 0.012), i % 2 === 0 ? ASH : ASH_LIGHT);
      }
    } else {
      const blob = new Float32Array(SEG);
      const plate = new Float32Array(SEG);
      for (let i = 0; i < SEG; i++) {
        blob[i] = R * (0.86 + 0.14 * noise(i * 0.7 + p.seg, 3.1));
        plate[i] = rnd();
      }
      // Abwurf von schräg vorn oben, auf der Seite der Bahn, auf der die Bombe einschlägt.
      const side = p.lat > 0.3 ? 1 : p.lat < -0.3 ? -1 : bombs.length % 2 === 0 ? 1 : -1;
      let dx = s.rx * side * 0.55 + s.fx * 0.85;
      let dz = s.rz * side * 0.55 + s.fz * 0.85;
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl;
      dz /= dl;
      const T = p.warn / 60;
      const sx = p.x + dx * 58;
      const sy = p.y + 10;
      const sz = p.z + dz * 58;
      const vy = (p.y - sy + 0.5 * BOMB_G * T * T) / T;
      bombs.push({ p, s, blob, sx, sy, sz, vy, T, acc: rnd(), lastCycle: -1e9, plate });
    }
  }

  // --- Lavaschwall: Raster über die Fahrbahn ---
  const NC = 6;
  interface FloodView {
    f: Flood;
    /** Gefälle: +1 = die Strecke steigt in Fahrtrichtung (Lava fließt den Fahrern entgegen). */
    down: number;
    mx: number;
    mz: number;
    span: number;
    bubbles: { k: number; lat: number; r: number; per: number; off: number; last: number }[];
    steamT: number;
  }
  const floods: FloodView[] = t.floods.map((f) => {
    const a = f.first;
    const b = f.first + f.count - 1;
    const mid = f.first + Math.floor(f.count / 2);
    const brnd = seeded(51 + f.first);
    const bubbles: FloodView['bubbles'] = [];
    for (let q = 0; q < 12; q++) {
      const k = 7 + Math.floor(brnd() * Math.max(1, f.count - 14));
      bubbles.push({ k, lat: (brnd() * 2 - 1) * t.wh[f.first + k] * 0.8, r: 0.35 + brnd() * 0.3, per: 1.1 + brnd() * 0.9, off: brnd() * 5, last: -1 });
    }
    return { f, down: t.py[b] >= t.py[a] ? 1 : -1, mx: t.px[mid], mz: t.pz[mid], span: f.count * t.step * 0.5, bubbles, steamT: 0 };
  });

  // --- Ampel: große Tafel vor der Gabelung, kleine am Höhlenweg ---
  const signs: Sign[] = [];
  /** Quader der Tafelgerüste: cx, cy, cz, sx, sy, sz, Farbe, Drehung – sie kommen ins Felsnetz und bekommen als Einzige eine Kontur. */
  const signBoxes: [number, number, number, number, number, number, RGB, number][] = [];
  const signAt = (f: Flood, seg: number, side: number, w: number, h: number, above: number, extra: number): void => {
    const lat = side * (t.wh[seg] + 2);
    const bx = t.px[seg] + rightX(t, seg) * lat;
    const bz = t.pz[seg] + rightZ(t, seg) * lat;
    const by = t.py[seg];
    // Zum Fahrer hin, leicht zur Fahrbahnmitte gedreht.
    const yaw = 0.22;
    let nx = -t.tx[seg] * Math.cos(yaw) - side * rightX(t, seg) * Math.sin(yaw);
    let nz = -t.tz[seg] * Math.cos(yaw) - side * rightZ(t, seg) * Math.sin(yaw);
    const nl = Math.hypot(nx, nz);
    nx /= nl;
    nz /= nl;
    const ux = nz;
    const uz = -nx;
    const cy = by + above + h / 2;
    signs.push({ flood: f, cx: bx, cy, cz: bz, ux, uz, nx, nz, w, h, side, extra });
    // Gerüst: zwei Pfosten, Rahmen, Dach, Warnstreifen.
    const rotY = Math.atan2(-uz, ux);
    const depth = 0.34;
    const pH = above + 0.6;
    for (const k of [-1, 1]) {
      const pu = k * (w / 2 - 0.35);
      signBoxes.push([bx + ux * pu - nx * 0.25, by - 0.6 + pH / 2, bz + uz * pu - nz * 0.25, 0.32, pH, 0.32, ROCK, rotY]);
    }
    signBoxes.push([bx, cy, bz, w + 0.5, h + 0.5, depth, ROCK, rotY]);
    signBoxes.push([bx + nx * 0.25, cy + h / 2 + 0.38, bz + nz * 0.25, w + 0.9, 0.22, depth + 0.7, rgb(0x17121d), rotY]);
    const nS = 7;
    for (let k = 0; k < nS; k++) {
      const pu = -w / 2 - 0.25 + ((k + 0.5) / nS) * (w + 0.5);
      signBoxes.push([bx + ux * pu + nx * 0.02, cy - h / 2 - 0.5, bz + uz * pu + nz * 0.02, (w + 0.5) / nS, 0.5, depth, k % 2 === 0 ? rgb(0xff7a1f) : rgb(0x1c1622), rotY]);
    }
  };
  for (const f of t.floods) {
    if (f.branch < 0) continue;
    const br = t.branches[f.branch];
    const side = br.side >= 0 ? 1 : -1;
    const back = Math.round(45 / t.step);
    const seg = wrapSeg(t, br.from - back);
    signAt(f, seg, side, 6.2, 3.8, 3.2, (back * t.step * 60) / 25);
    const k = Math.min(br.count - 1, Math.round(12 / t.step));
    signAt(f, br.first + k, side, 3.8, 2.4, 2.4, -(k * t.step * 60) / 25);
  }

  const frame = new MeshBuilder();
  for (const b of signBoxes) {
    rock.box(...b);
    frame.box(...b);
  }
  const rockGeo = rock.build();
  const rockMat = toonMaterial({ vertexColors: true });
  const rockMesh = new THREE.Mesh(rockGeo, rockMat);
  rockMesh.frustumCulled = false;
  group.add(rockMesh);
  disposables.push(rockGeo, rockMat);
  // Kontur nur um die Tafeln: die flachen Felsränder hätten kaum eine, kosteten aber Dreiecke.
  if (detail && !frame.empty) {
    const frameGeo = addSmoothNormals(frame.build());
    const ol = new THREE.Mesh(frameGeo, outlineMaterial(0.05));
    ol.name = 'outline';
    ol.frustumCulled = false;
    group.add(ol);
    disposables.push(frameGeo);
  }

  // === Pro Bild geschriebene Flächen ===================================================
  const glow = new Dyn(14000, 3);
  const shadow = new Dyn(800, 4);
  const light = new Dyn(5000, 3);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const shadowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  // Additiv ohne Nebel: sonst würde der Nebel jede Leuchtfläche rosa aufhellen. Die Ferne dämpft update().
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const glowMesh = new THREE.Mesh(glow.geo, glowMat);
  const shadowMesh = new THREE.Mesh(shadow.geo, shadowMat);
  const lightMesh = new THREE.Mesh(light.geo, lightMat);
  for (const m of [glowMesh, shadowMesh, lightMesh]) m.frustumCulled = false;
  shadowMesh.renderOrder = 1;
  lightMesh.renderOrder = 2;
  group.add(glowMesh, shadowMesh, lightMesh);
  disposables.push(glow, shadow, light, glowMat, shadowMat, lightMat);

  // === Fontänen ==========================================================================
  // Säule mit aufgeplatzter Krone; breiteste Stelle 0.92 × radius.
  const prof = [
    [0.62, 0],
    [0.5, 0.14],
    [0.42, 0.4],
    [0.4, 0.62],
    [0.5, 0.76],
    [0.78, 0.86],
    [0.92, 0.93],
    [0.66, 1.0],
    [0.32, 1.05],
    [0.001, 1.07],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const JS = 10;
  const lathe = new THREE.LatheGeometry(prof, JS);
  {
    // Zackige Lippe der Krone
    const p = lathe.getAttribute('position');
    for (let i = 0; i <= JS; i++) {
      const v = i * prof.length + 6;
      const f = i % 2 === 0 ? 1.0 : 0.82;
      p.setX(v, p.getX(v) * f);
      p.setZ(v, p.getZ(v) * f);
      p.setY(v, p.getY(v) + (i % 2 === 0 ? -0.05 : 0.03));
    }
  }
  const jetGeo = lathe.toNonIndexed();
  lathe.dispose();
  {
    const p = jetGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let f = 0; f < p.count / 3; f++) {
      const y = (p.getY(f * 3) + p.getY(f * 3 + 1) + p.getY(f * 3 + 2)) / 3;
      // Spalte (für Streifen, die sich mit der Drehung der Säule bewegen)
      const a = Math.atan2(p.getZ(f * 3) + p.getZ(f * 3 + 1) + p.getZ(f * 3 + 2), p.getX(f * 3) + p.getX(f * 3 + 1) + p.getX(f * 3 + 2));
      const col3 = Math.floor(((a + Math.PI) / (Math.PI * 2)) * JS) % 3;
      let c: RGB = y < 0.2 ? WHITE_HOT : y < 0.55 ? LAVA2 : y < 0.8 ? LAVA1 : y < 0.97 ? LAVA0 : LAVA1;
      if (col3 === 0 && y > 0.12 && y < 0.8) c = y < 0.55 ? LAVA1 : LAVA0;
      if (y > 0.98) c = LAVA2;
      for (let k = 0; k < 3; k++) col.set(c, (f * 3 + k) * 3);
    }
    jetGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  jetGeo.computeVertexNormals();
  addSmoothNormals(jetGeo);
  const jetMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const nVents = Math.max(1, vents.length);
  const jets = new THREE.InstancedMesh(jetGeo, jetMat, nVents);
  jets.frustumCulled = false;
  jets.count = 0;
  group.add(jets);
  disposables.push(jetGeo, jetMat, jets);
  let jetOl: THREE.InstancedMesh | null = null;
  if (detail) {
    jetOl = new THREE.InstancedMesh(jetGeo, outlineMaterial(0.06), nVents);
    jetOl.instanceMatrix = jets.instanceMatrix;
    jetOl.frustumCulled = false;
    jetOl.count = 0;
    group.add(jetOl);
    disposables.push(jetOl);
  }

  // === Bomben und ihre Leuchtspur ===========================================================
  const bombGeo = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  {
    const p = bombGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let f = 0; f < p.count / 3; f++) {
      const c = f % 3 === 0 ? rgb(0x3a1e26) : f % 3 === 1 ? LAVA2 : rgb(0xff7a1f);
      for (let k = 0; k < 3; k++) col.set(c, (f * 3 + k) * 3);
    }
    bombGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  addSmoothNormals(bombGeo);
  const bombMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const nBombs = Math.max(1, bombs.length);
  const bombMesh = new THREE.InstancedMesh(bombGeo, bombMat, nBombs);
  bombMesh.frustumCulled = false;
  bombMesh.count = 0;
  group.add(bombMesh);
  disposables.push(bombGeo, bombMat, bombMesh);
  let bombOl: THREE.InstancedMesh | null = null;
  if (detail) {
    bombOl = new THREE.InstancedMesh(bombGeo, outlineMaterial(0.08), nBombs);
    bombOl.instanceMatrix = bombMesh.instanceMatrix;
    bombOl.frustumCulled = false;
    bombOl.count = 0;
    group.add(bombOl);
    disposables.push(bombOl);
  }
  const trailGeo = new THREE.CylinderGeometry(1, 0.06, 1, 7, 2, true);
  trailGeo.translate(0, -0.5, 0);
  {
    const p = trailGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) col.set(p.getY(i) > -0.1 ? WHITE_HOT : p.getY(i) > -0.6 ? LAVA1 : LAVA0, i * 3);
    trailGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const trailMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const trails = new THREE.InstancedMesh(trailGeo, trailMat, nBombs);
  trails.frustumCulled = false;
  trails.count = 0;
  group.add(trails);
  disposables.push(trailGeo, trailMat, trails);

  // === Hilfsobjekte für update() ==========================================================
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const rq = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);
  /** Ferne dämpft das additive Leuchten (es hat keinen Nebel). */
  const farFade = (d: number): number => Math.max(0, Math.min(1, 1 - (d - 140) / 220));
  const fxOn = detail;

  // --- Geysir --------------------------------------------------------------------------
  let nJets = 0;
  const updateVent = (v: VentState, time: number, seconds: number, dt: number, cam: THREE.Vector3, dist: number, fx: FxSink): void => {
    const p = v.p;
    const s = v.s;
    const R = p.radius;
    const c = pulseCycle(p, time);
    const w = pulseWarning(p, time);
    const active = c < p.on;
    const post = !active && c - p.on < AFTER ? 1 - (c - p.on) / AFTER : 0;
    const ff = farFade(dist);
    const near = fxOn && dist < FX_NEAR;
    st = dist > LOD_NEAR ? 2 : 1;
    // Glut im Schlund: Ruhe 0.2 (glimmt), Vorwarnung steigt bis 0.95, Ausbruch 1.
    const flick = 0.04 * Math.sin(seconds * 3.1 + p.seg);
    const heat = active ? 1 : post > 0 ? 0.3 + 0.7 * post : 0.2 + flick + 0.78 * w;
    // Puls der Vorwarnung: beschleunigt von 2 auf 7 Hz (Phase integriert, ohne Sprünge).
    const ws = (w * p.warn) / 60;
    const wT = p.warn / 60;
    const pulse = w > 0 ? 0.5 + 0.5 * Math.sin(Math.PI * 2 * (2 * ws + (2.5 * ws * ws) / wT)) : 0;

    // Lava im Schlund – steigt mit der Vorwarnung.
    const rl = R * (0.38 + 0.06 * w);
    const ll = 0.03 + 0.1 * w + (active ? 0.06 : 0);
    const cIn = heatCol(Math.min(1, heat + 0.18 + (pulse - 0.5) * 0.2 * w));
    const cOut = heatCol(heat);
    for (let i = 0; i < SEG; i += st) {
      gv(glow, s, 0, 0, ll, cIn);
      gv(glow, s, COS[i] * rl, SIN[i] * rl, ll * 0.7, cOut);
      gv(glow, s, COS[i + st] * rl, SIN[i + st] * rl, ll * 0.7, cOut);
    }
    // Innere Flanke des Felsrands: Kruste, deren Risse mit der Hitze aufglühen.
    for (let i = 0; i < SEG; i += st) {
      const j = i + st;
      const crack = (i * 7) % 3 === 0;
      const col = crack && heat > 0.3 ? heatCol(heat * 0.95) : heat > 0.75 && i % 2 === 0 ? EMBER : CRUST_DARK;
      const ri = R * 0.4;
      const ro0 = R * 0.52 * v.jag[i];
      const ro1 = R * 0.52 * v.jag[j % SEG];
      const h0 = 0.15 + (v.jag[i] - 0.92) * 0.4;
      const h1 = 0.15 + (v.jag[j % SEG] - 0.92) * 0.4;
      gv(glow, s, COS[i] * ri, SIN[i] * ri, 0.03, col);
      gv(glow, s, COS[i] * ro0, SIN[i] * ro0, h0, col);
      gv(glow, s, COS[j] * ro1, SIN[j] * ro1, h1, col);
      gv(glow, s, COS[i] * ri, SIN[i] * ri, 0.03, col);
      gv(glow, s, COS[j] * ro1, SIN[j] * ro1, h1, col);
      gv(glow, s, COS[j] * ri, SIN[j] * ri, 0.03, col);
    }

    if (w > 0) {
      // Glutbeule im Schlund (letztes Drittel der Vorwarnung).
      if (w > 0.45) {
        const k = (w - 0.45) / 0.55;
        dome(glow, s, 0, 0, ll * 0.7, rl * (0.75 + 0.15 * pulse), 0.15 + 0.55 * k + 0.08 * pulse, heatCol(0.9 + 0.1 * pulse), LAVA1);
      } else {
        // Blasen, die aufplatzen.
        for (let b = 0; b < 2; b++) {
          const k = (seconds * (1.4 + b * 0.5) + b * 0.37) % 1;
          const r = 0.12 + 0.18 * k;
          dome(glow, s, (b === 0 ? 0.3 : -0.25) * R * 0.3, (b === 0 ? -0.2 : 0.25) * R * 0.3, ll * 0.7, r, r * 0.8, LAVA2, LAVA1);
        }
      }
      // Leuchtender Ring: wächst nach außen bis an den Rand der Gefahr und pulsiert immer schneller.
      const g = smooth(w);
      const ro = R * (0.84 + 0.16 * g);
      const ri = ro - 0.12 - 0.22 * g;
      const rc = pulse > 0.5 ? LAVA2 : LAVA1;
      ring(glow, s, ri, ro - 0.07, 0.05, 0.05, rc, rc);
      ring(glow, s, ro - 0.07, ro, 0.05, 0.05, C_INK, C_INK);
      // Glutadern vom Rand des Schlunds zum Ring: werden mit der Vorwarnung länger.
      const reach = R * 0.78 + (ri - R * 0.78) * Math.min(1, w * 1.6);
      if (reach > R * 0.79) {
        for (let i = 0; i < SEG; i += 2) {
          const a = ((i + 0.5) / SEG) * Math.PI * 2 + 0.2;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const da = 0.09;
          gv(glow, s, Math.cos(a - da) * R * 0.76, Math.sin(a - da) * R * 0.76, 0.04, LAVA0);
          gv(glow, s, Math.cos(a + da) * R * 0.76, Math.sin(a + da) * R * 0.76, 0.04, LAVA0);
          gv(glow, s, ca * reach, sa * reach, 0.04, LAVA1);
        }
      }
      // Aus der Ferne wird der Flammenkranz höher (nicht breiter): so bleibt er auch aus 50 m lesbar.
      const tall = 1 + 0.7 * Math.max(0, Math.min(1, (dist - 25) / 35));
      curtain(light, s, ro - 0.04, (0.35 + 1.6 * g) * tall, GLOW_ORANGE, (0.25 + 0.55 * g) * (0.6 + 0.4 * pulse) * ff);
      glowBlob(light, s.x, s.y + 0.3, s.z, cam, R * (0.5 + 0.3 * w), 0.8 + 2.4 * w, GLOW_YELLOW, (0.12 + 0.4 * w) * (0.6 + 0.4 * pulse) * ff);

      if (near) {
        // Dampf und erste Glutspritzer – dichter, je näher der Ausbruch.
        v.acc -= dt * (1.5 + 4 * w);
        while (v.acc <= 0) {
          v.acc += 1;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * R * 0.3;
          fx.puff(s.x + Math.cos(a) * r, s.y + 0.3, s.z + Math.sin(a) * r, Math.cos(a) * 0.3, 1.5 + w * 2, Math.sin(a) * 0.3, 1.1, 0.45 + w * 0.35, Math.random() < 0.5 ? 0xa898a8 : 0x8a7a8a, 0.8, -1.5);
        }
        if (w > 0.5) {
          v.acc2 -= dt * 10 * w;
          while (v.acc2 <= 0) {
            v.acc2 += 1;
            const a = Math.random() * Math.PI * 2;
            fx.spark(s.x, s.y + 0.4, s.z, Math.cos(a) * 1.2, 3 + Math.random() * 3, Math.sin(a) * 1.2, 0.6, 0.25 + Math.random() * 0.2, Math.random() < 0.5 ? 0xffe27a : 0xff9a1f, 12);
          }
        }
      }
    } else if (!active && post === 0) {
      // Ruhe: kleines Glimmen über dem Schlund.
      glowBlob(light, s.x, s.y + 0.25, s.z, cam, R * 0.45, 0.5, GLOW_ORANGE, (0.16 + flick) * ff);
    }

    if (active || post > 0) {
      // Lavasee bis an den Rand der Gefahr, mit Wellen, die nach außen laufen.
      const k = active ? 1 : post;
      const rp = R * 0.98 * (active ? 1 : 0.85 + 0.15 * post);
      const lift = 0.1 * k;
      const hot = active ? 1 : 0.35 + 0.5 * post;
      const wave = ((c / 22) % 1) * 0.7 + 0.25;
      ring(glow, s, 0, rp * wave, lift + 0.02, lift + 0.02, heatCol(hot), heatCol(hot * 0.97));
      ring(glow, s, rp * wave, Math.min(rp * 0.94, rp * wave + 0.25), lift + 0.02, lift + 0.02, heatCol(hot * 0.75), heatCol(hot * 0.75));
      ring(glow, s, Math.min(rp * 0.94, rp * wave + 0.25), rp * 0.94, lift + 0.02, lift, heatCol(hot * 0.97), heatCol(hot * 0.8));
      ring(glow, s, rp * 0.94, rp, lift, 0.04, active ? EMBER : CRUST, CRUST);
      curtain(light, s, rp - 0.05, active ? 1.6 : 0.8 * post, GLOW_ORANGE, (active ? 0.75 : 0.5 * post) * ff);
    }

    if (active) {
      // Fontäne: schießt hoch, brodelt, fällt am Ende in sich zusammen.
      let h = JET_H;
      let r = 1;
      if (c < JET_UP) {
        const k = c / JET_UP;
        h *= 1 - (1 - k) * (1 - k);
        r = 0.75 + 0.25 * k;
      }
      if (c > p.on - JET_DOWN) {
        const k = (c - (p.on - JET_DOWN)) / JET_DOWN;
        h *= Math.pow(1 - k, 1.4);
        r *= 1 - 0.3 * k;
      }
      h *= 1 + 0.06 * Math.sin(seconds * 17 + p.seg) + 0.04 * Math.sin(seconds * 6.3);
      r *= 0.97 + 0.03 * Math.sin(seconds * 23 + p.seg);
      pv.set(s.x, s.y, s.z);
      q.setFromAxisAngle(yAxis, time * 0.09 + p.seg);
      sv.set(R * r, Math.max(0.01, h), R * r);
      m4.compose(pv, q, sv);
      jets.setMatrixAt(nJets++, m4);
      glowBlob(light, s.x, s.y + h * 0.55, s.z, cam, R * 1.25, h * 0.7 + 0.5, GLOW_YELLOW, 0.55 * ff);

      if (near) {
        // Spritzer aus der Krone – sie fallen innerhalb des Radius herunter.
        // In den letzten Ticks keine neuen Spritzer: nichts soll nach dem Ende noch herabregnen.
        if (c < p.on - 24) v.acc -= dt * 26;
        while (v.acc <= 0) {
          v.acc += 1;
          const a = Math.random() * Math.PI * 2;
          const sp = 0.4 + Math.random() * 1.1;
          const top = s.y + h * 0.95;
          if (Math.random() < 0.7) {
            fx.spark(s.x + Math.cos(a) * R * 0.3, top, s.z + Math.sin(a) * R * 0.3, Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp, 0.55, 0.35 + Math.random() * 0.3, Math.random() < 0.4 ? 0xfff2b0 : Math.random() < 0.5 ? 0xffb52e : 0xff6a1f, 14);
          } else {
            fx.puff(s.x + Math.cos(a) * R * 0.35, top, s.z + Math.sin(a) * R * 0.35, Math.cos(a) * sp, 3 + Math.random() * 2, Math.sin(a) * sp, 0.55, 0.45 + Math.random() * 0.25, Math.random() < 0.5 ? 0xff7a1f : 0xffb52e, -0.3, 16);
          }
        }
        // Zu Beginn ein Stoß aus Dampf und Funken.
        const cyc = Math.floor((time + p.phase) / p.period);
        if (cyc !== v.lastCycle && c < 6) {
          v.lastCycle = cyc;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            fx.puff(s.x + Math.cos(a) * R * 0.6, s.y + 0.3, s.z + Math.sin(a) * R * 0.6, Math.cos(a) * 1.5, 2, Math.sin(a) * 1.5, 0.9, 0.6, k % 2 === 0 ? 0x6a5866 : 0x8a4a3a, 0.8, -1.2);
          }
        }
      }
    }
  };

  // --- Lavabombe ---------------------------------------------------------------------
  let nBombsDrawn = 0;
  const updateBomb = (b: BombState, time: number, seconds: number, dt: number, cam: THREE.Vector3, dist: number, fx: FxSink): void => {
    const p = b.p;
    const s = b.s;
    const R = p.radius;
    const c = pulseCycle(p, time);
    const w = pulseWarning(p, time);
    const active = c < p.on;
    const post = !active && c - p.on < AFTER ? 1 - (c - p.on) / AFTER : 0;
    const ff = farFade(dist);
    const near = fxOn && dist < FX_NEAR;
    st = dist > LOD_NEAR ? 2 : 1;

    if (w > 0) {
      // Schatten wächst bis auf den Radius; der Zielring steht von Anfang an auf dem Radius.
      const ws = (w * p.warn) / 60;
      const wT = p.warn / 60;
      const pulse = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (1.5 * ws + (2.5 * ws * ws) / wT));
      const rs = R * (0.25 + 0.7 * Math.pow(w, 0.8));
      for (let i = 0; i < SEG; i += st) {
        gv(shadow, s, 0, 0, 0.03, SHADOW, 0.35 + 0.45 * w);
        gv(shadow, s, COS[i] * rs, SIN[i] * rs, 0.03, SHADOW, 0.15 + 0.35 * w);
        gv(shadow, s, COS[i + st] * rs, SIN[i + st] * rs, 0.03, SHADOW, 0.15 + 0.35 * w);
      }
      const rc = pulse > 0.5 ? LAVA2 : LAVA0;
      ring(glow, s, R - 0.34, R - 0.08, 0.05, 0.05, rc, rc);
      ring(glow, s, R - 0.08, R, 0.05, 0.05, C_INK, C_INK);
      // Vier Zacken, die zur Mitte zeigen und sich langsam drehen (Fadenkreuz).
      const rot = time * 0.02;
      for (let k = 0; k < 4; k++) {
        const a = rot + (k / 4) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const pa = -sa * 0.32;
        const pb = ca * 0.32;
        gv(glow, s, ca * (R - 0.3) + pa, sa * (R - 0.3) + pb, 0.055, rc);
        gv(glow, s, ca * (R - 0.3) - pa, sa * (R - 0.3) - pb, 0.055, rc);
        gv(glow, s, ca * (R - 1.0 - 0.15 * pulse), sa * (R - 1.0 - 0.15 * pulse), 0.055, rc);
      }
      curtain(light, s, R - 0.1, 0.3 + 0.7 * w, GLOW_ORANGE, (0.2 + 0.5 * w) * (0.6 + 0.4 * pulse) * ff);

      // Die Bombe im Anflug: Flugzeit = Vorwarnung, Einschlag genau bei Zyklus 0.
      const tt = ws;
      const k = tt / b.T;
      const x = b.sx + (p.x - b.sx) * k;
      const z = b.sz + (p.z - b.sz) * k;
      const y = b.sy + b.vy * tt - 0.5 * BOMB_G * tt * tt;
      const size = 0.95 * Math.min(1, ws / 0.12);
      pv.set(x, y, z);
      q.setFromAxisAngle(yAxis, tt * 4 + p.seg);
      q.multiply(rq.setFromAxisAngle(xAxis, tt * 5.3));
      sv.setScalar(Math.max(0.01, size));
      m4.compose(pv, q, sv);
      bombMesh.setMatrixAt(nBombsDrawn, m4);
      // Leuchtspur entgegen der Flugrichtung.
      dir.set((p.x - b.sx) / b.T, b.vy - BOMB_G * tt, (p.z - b.sz) / b.T);
      const speed = dir.length();
      dir.multiplyScalar(1 / speed);
      q.setFromUnitVectors(yAxis, dir);
      const len = Math.min(9, Math.max(3, speed * 0.22));
      sv.set(size * 0.85, len, size * 0.85);
      m4.compose(pv, q, sv);
      trails.setMatrixAt(nBombsDrawn, m4);
      nBombsDrawn++;
      glowBlob(light, x, y, z, cam, 2.4, 2.4, GLOW_ORANGE, 0.55 * Math.min(1, ws / 0.12) * farFade(Math.hypot(x - cam.x, z - cam.z)));
      if (near) {
        b.acc -= dt * 14;
        while (b.acc <= 0) {
          b.acc += 1;
          fx.spark(x - dir.x * len * 0.4, y - dir.y * len * 0.4, z - dir.z * len * 0.4, 0, 0, 0, 0.6, size * 1.1, 0xff8a2a, -1);
        }
      }
    }

    if (active || post > 0) {
      const k = c / p.on;
      // Glut der Pfütze: erst gelb, dann orange, zum Ende rot – aber bis zuletzt klar glühend.
      const hot = active ? 1 - 0.4 * smooth((k - 0.3) / 0.7) + 0.03 * Math.sin(seconds * 9 + p.seg) * k : 0.25 + 0.3 * post;
      const lift = 0.05;
      const sc = active ? Math.min(1, 0.75 + c / 6) : 0.9 + 0.1 * post;
      const crustK = active ? Math.max(0, (k - 0.35) * 1.1) : 1;
      // Mitte, Gürtel mit Krustenschollen, dunkler Rand.
      for (let i = 0; i < SEG; i += st) {
        const j = (i + st) % SEG;
        const r0 = b.blob[i] * sc;
        const r1 = b.blob[j] * sc;
        const cC = heatCol(hot);
        const cM = b.plate[i] < crustK ? CRUST : heatCol(hot * 0.86);
        gv(glow, s, 0, 0, lift + 0.02, cC);
        gv(glow, s, COS[i] * r0 * 0.5, SIN[i] * r0 * 0.5, lift + 0.015, cC);
        gv(glow, s, COS[i + st] * r1 * 0.5, SIN[i + st] * r1 * 0.5, lift + 0.015, cC);
        gv(glow, s, COS[i] * r0 * 0.5, SIN[i] * r0 * 0.5, lift + 0.015, cM);
        gv(glow, s, COS[i] * r0 * 0.86, SIN[i] * r0 * 0.86, lift + 0.01, cM);
        gv(glow, s, COS[i + st] * r1 * 0.86, SIN[i + st] * r1 * 0.86, lift + 0.01, cM);
        gv(glow, s, COS[i] * r0 * 0.5, SIN[i] * r0 * 0.5, lift + 0.015, cM);
        gv(glow, s, COS[i + st] * r1 * 0.86, SIN[i + st] * r1 * 0.86, lift + 0.01, cM);
        gv(glow, s, COS[i + st] * r1 * 0.5, SIN[i + st] * r1 * 0.5, lift + 0.015, cM);
        const cE = active ? EMBER : CRUST_DARK;
        gv(glow, s, COS[i] * r0 * 0.86, SIN[i] * r0 * 0.86, lift + 0.01, cE);
        gv(glow, s, COS[i] * r0, SIN[i] * r0, lift, CRUST);
        gv(glow, s, COS[i + st] * r1, SIN[i + st] * r1, lift, CRUST);
        gv(glow, s, COS[i] * r0 * 0.86, SIN[i] * r0 * 0.86, lift + 0.01, cE);
        gv(glow, s, COS[i + st] * r1, SIN[i + st] * r1, lift, CRUST);
        gv(glow, s, COS[i + st] * r1 * 0.86, SIN[i + st] * r1 * 0.86, lift + 0.01, cE);
      }
      // Brodelnde Blasen
      if (active) {
        for (let q2 = 0; q2 < 3; q2++) {
          const kk = (seconds * (0.9 + q2 * 0.35) + q2 * 0.31) % 1;
          const a = q2 * 2.1 + p.seg;
          const rr = R * 0.4 * (0.4 + q2 * 0.3);
          const br = (0.12 + 0.22 * kk) * (1 - 0.5 * k);
          dome(glow, s, Math.cos(a) * rr, Math.sin(a) * rr, lift, br, br * 0.8, heatCol(Math.min(1, hot + 0.1)), heatCol(hot * 0.9));
        }
      }
      curtain(light, s, R * 0.9, active ? 0.4 + 0.9 * (1 - k) : 0.3 * post, GLOW_ORANGE, (active ? 0.3 + 0.35 * (1 - k) : 0.2 * post) * ff);

      // Einschlag: Krone aus Spritzern, Blitz.
      if (active && c < SPLASH) {
        const e = c / SPLASH;
        const hh = 1.8 * Math.sin(Math.PI * Math.min(1, e * 1.3)) + 0.05;
        const rr = R * (0.45 + 0.4 * e);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + p.seg;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const pa = -sa * 0.28;
          const pb = ca * 0.28;
          const tip = Math.min(R * 0.95, rr + 0.4);
          const hi = hh * (i % 2 === 0 ? 1 : 0.7);
          gv(glow, s, ca * rr + pa, sa * rr + pb, 0.06, LAVA0);
          gv(glow, s, ca * rr - pa, sa * rr - pb, 0.06, LAVA0);
          gv(glow, s, ca * tip, sa * tip, hi, LAVA2);
        }
        glowBlob(light, s.x, s.y + 0.8, s.z, cam, R * 1.6, 2.5, GLOW_YELLOW, (1 - e) * ff);
      }
      if (near) {
        const cyc = Math.floor((time + p.phase) / p.period);
        if (cyc !== b.lastCycle && c < 8) {
          b.lastCycle = cyc;
          for (let k2 = 0; k2 < 12; k2++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 1 + Math.random() * 2;
            fx.spark(s.x, s.y + 0.4, s.z, Math.cos(a) * sp, 4 + Math.random() * 5, Math.sin(a) * sp, 0.8, 0.4 + Math.random() * 0.3, Math.random() < 0.5 ? 0xffe27a : 0xff9a1f, 14);
          }
          for (let k2 = 0; k2 < 4; k2++) {
            const a = (k2 / 4) * Math.PI * 2 + Math.random();
            fx.puff(s.x + Math.cos(a) * R * 0.5, s.y + 0.4, s.z + Math.sin(a) * R * 0.5, Math.cos(a) * 1.2, 2.5, Math.sin(a) * 1.2, 1.0, 0.8, k2 % 2 === 0 ? 0x3b2d42 : 0x6a4a4a, 0.9, -1);
          }
        }
        if (active && c < p.on - 40) {
          // Dampf über der Pfütze (endet rechtzeitig, damit nach der Gefahr nichts mehr qualmt).
          b.acc -= dt * 3;
          while (b.acc <= 0) {
            b.acc += 1;
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * R * 0.6;
            fx.puff(s.x + Math.cos(a) * r, s.y + 0.2, s.z + Math.sin(a) * r, 0, 1.2, 0, 1.1, 0.4, 0xa898a8, 0.6, -1);
          }
        }
      }
    }
  };

  // --- Lavaschwall ---------------------------------------------------------------------
  const updateFlood = (fv: FloodView, time: number, seconds: number, dt: number, cam: THREE.Vector3, fx: FxSink): void => {
    const f = fv.f;
    const L0 = floodLevel(f, time);
    if (L0 <= 0.003) return;
    const dist = Math.hypot(fv.mx - cam.x, fv.mz - cam.z) - fv.span;
    if (dist > DRAW_FAR) return;
    const ff = farFade(Math.max(0, dist));
    const ts = time / 60;
    const strong = L0 >= FLOOD_FROM;
    const lastK = f.count - 1;
    const lvl = (k: number): number => L0 * Math.min(1, (Math.min(k, lastK - k) + 1) / 6);
    /** Höhe der Lava über der Fahrbahn bei Pegel L (unter 0 = noch im Boden). */
    const lift = (L: number): number => -0.12 + L * (FLOOD_DEPTH + 0.12);
    for (let k = 0; k < lastK; k++) {
      const i0 = f.first + k;
      const i1 = i0 + 1;
      const La = lvl(k);
      const Lb = lvl(k + 1);
      if (La < 0.01 && Lb < 0.01) continue;
      const ya = lift(La);
      const yb = lift(Lb);
      const sm = (k + 0.5) * t.step;
      for (let j = 0; j < NC; j++) {
        const fa = -1 + (2 * j) / NC;
        const fb = -1 + (2 * (j + 1)) / NC;
        // Bänder wandern bergab; quer verzogen von Rauschen (Glutadern).
        const latm = ((fa + fb) / 2) * t.wh[i0];
        const ph = sm * 0.11 + fv.down * ts * 0.75 + 0.7 * noise(latm * 0.45 + 3, sm * 0.06);
        const kk = ph - Math.floor(ph);
        const vein = noise(sm * 0.32 + fv.down * ts * 2.2, latm * 0.7) > 0.7;
        const Lm = (La + Lb) / 2;
        let col: RGB;
        if (Lm >= FLOOD_FROM) col = vein ? LAVA2 : kk < 0.2 ? CRUST : kk < 0.3 ? EMBER : kk < 0.62 ? LAVA0 : kk < 0.88 ? LAVA1 : LAVA2;
        else col = vein ? LAVA0 : kk < 0.4 ? CRUST : kk < 0.8 ? EMBER : LAVA0;
        const P = (i: number, fr: number, y: number): void => {
          const lat = fr * t.wh[i];
          glow.v(t.px[i] + rightX(t, i) * lat, t.py[i] + lat * t.bank[i] + y, t.pz[i] + rightZ(t, i) * lat, col);
        };
        P(i0, fa, ya);
        P(i0, fb, ya);
        P(i1, fb, yb);
        P(i0, fa, ya);
        P(i1, fb, yb);
        P(i1, fa, yb);
      }
      // Glut an den Wänden des Tunnels (additiv).
      const ga = Math.min(1, La * 1.3) * ff;
      const gb = Math.min(1, Lb * 1.3) * ff;
      for (const sd of [-1, 1]) {
        const la = sd * (t.wh[i0] - 0.05);
        const lb = sd * (t.wh[i1] - 0.05);
        const xa = t.px[i0] + rightX(t, i0) * la;
        const za = t.pz[i0] + rightZ(t, i0) * la;
        const xb = t.px[i1] + rightX(t, i1) * lb;
        const zb = t.pz[i1] + rightZ(t, i1) * lb;
        const y0a = t.py[i0] + la * t.bank[i0] + Math.max(0, ya);
        const y0b = t.py[i1] + lb * t.bank[i1] + Math.max(0, yb);
        const hA = 0.4 + 2.2 * La;
        const hB = 0.4 + 2.2 * Lb;
        light.v(xa, y0a, za, GLOW_ORANGE, 1, 0.5 * ga);
        light.v(xb, y0b, zb, GLOW_ORANGE, 1, 0.5 * gb);
        light.v(xb, y0b + hB, zb, BLACK);
        light.v(xa, y0a, za, GLOW_ORANGE, 1, 0.5 * ga);
        light.v(xb, y0b + hB, zb, BLACK);
        light.v(xa, y0a + hA, za, BLACK);
      }
    }
    // Leuchten über der Lava (weicher Schein, in Abständen).
    if (strong) {
      for (let k = 6; k < lastK - 6; k += 14) {
        const i = f.first + k;
        glowBlob(light, t.px[i], t.py[i] + lift(lvl(k)) + 0.6, t.pz[i], cam, t.wh[i] * 0.9, 1.6, GLOW_ORANGE, 0.22 * ff * Math.min(1, L0 * 1.5));
      }
    }
    // Blasen (nur, wo die Lava steht).
    const near = fxOn && dist < FX_NEAR;
    for (const bu of fv.bubbles) {
      const L = lvl(bu.k);
      if (L < FLOOD_FROM) continue;
      const i = f.first + bu.k;
      const cyc = (seconds + bu.off) / bu.per;
      const n = Math.floor(cyc);
      const kk = cyc - n;
      const s = siteAt(t, i, t.px[i] + rightX(t, i) * bu.lat, t.py[i] + bu.lat * t.bank[i] + lift(L), t.pz[i] + rightZ(t, i) * bu.lat);
      if (kk < 0.8) {
        const r = bu.r * Math.pow(kk / 0.8, 0.6);
        dome(glow, s, 0, 0, -0.02, r, r * 0.75, LAVA2, LAVA1);
      }
      if (n !== bu.last) {
        if (bu.last >= 0 && near) {
          for (let q2 = 0; q2 < 2; q2++) {
            const a = Math.random() * Math.PI * 2;
            fx.spark(s.x, s.y + 0.2, s.z, Math.cos(a) * 1.2, 3 + Math.random() * 2, Math.sin(a) * 1.2, 0.7, 0.3, Math.random() < 0.5 ? 0xffe27a : 0xff9a1f, 12);
          }
        }
        bu.last = n;
      }
    }
    // Dampf
    if (near && strong) {
      fv.steamT -= dt * 5;
      while (fv.steamT <= 0) {
        fv.steamT += 1;
        const k = Math.floor(Math.random() * f.count);
        const i = f.first + k;
        const lat = (Math.random() * 2 - 1) * t.wh[i] * 0.85;
        fx.puff(t.px[i] + rightX(t, i) * lat, t.py[i] + lat * t.bank[i] + lift(lvl(k)) + 0.2, t.pz[i] + rightZ(t, i) * lat, 0, 1.0, 0, 1.4, 0.6, Math.random() < 0.5 ? 0xa898a8 : 0x8a7a8a, 0.7, -0.8);
      }
    }
  };

  // --- Ampel -------------------------------------------------------------------------
  /** Ecke auf der Tafel: u nach rechts, v nach oben (Meter ab Mitte), d vor der Tafel. */
  const sv3 = (sg: Sign, u: number, v: number, d: number, c: RGB): void => {
    glow.v(sg.cx + sg.ux * u + sg.nx * d, sg.cy + v, sg.cz + sg.uz * u + sg.nz * d, c);
  };
  const sQuad = (sg: Sign, u0: number, v0: number, u1: number, v1: number, d: number, c: RGB): void => {
    sv3(sg, u0, v0, d, c);
    sv3(sg, u1, v0, d, c);
    sv3(sg, u1, v1, d, c);
    sv3(sg, u0, v0, d, c);
    sv3(sg, u1, v1, d, c);
    sv3(sg, u0, v1, d, c);
  };
  /** Pfeil zur Höhle: Spitze nach außen, leicht nach oben (Punkte im Einheitsmaß). */
  const ARROW = [
    [-0.5, -0.13],
    [0.08, -0.13],
    [0.08, -0.34],
    [0.52, 0],
    [0.08, 0.34],
    [0.08, 0.13],
    [-0.5, 0.13],
  ];
  const ARROW_TRIS = [
    [0, 1, 5],
    [0, 5, 6],
    [2, 3, 4],
  ];
  const arrow = (sg: Sign, scale: number, grow: number, d: number, c: RGB): void => {
    const a = 0.42;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const tr of ARROW_TRIS) {
      for (const idx of tr) {
        const [x0, y0] = ARROW[idx];
        // Für die Kontur leicht aufgeblasen (vom Schwerpunkt aus).
        const x = x0 * (1 + grow);
        const y = y0 * (1 + grow * 1.6);
        const xr = (x * ca - y * sa) * scale * sg.side;
        const yr = (x * sa + y * ca) * scale;
        sv3(sg, xr, yr, d, c);
      }
    }
  };
  /** Lava-Symbol: Tropfen über zwei Wellen. */
  const lavaSymbol = (sg: Sign, d: number, drop: RGB, rim: RGB, waves: RGB): void => {
    const H = sg.h;
    const W = sg.w;
    const cy = H * 0.08;
    const DR = H * 0.2;
    const N = 12;
    for (const [rr, col, dd] of [
      [DR * 1.18, rim, d],
      [DR, drop, d + 0.02],
    ] as [number, RGB, number][]) {
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2;
        const a1 = ((i + 1) / N) * Math.PI * 2;
        sv3(sg, 0, cy, dd, col);
        sv3(sg, Math.cos(a0) * rr, cy + Math.sin(a0) * rr, dd, col);
        sv3(sg, Math.cos(a1) * rr, cy + Math.sin(a1) * rr, dd, col);
      }
      // Spitze nach oben
      const ta = Math.PI / 6;
      sv3(sg, -Math.cos(ta) * rr, cy + Math.sin(ta) * rr, dd, col);
      sv3(sg, Math.cos(ta) * rr, cy + Math.sin(ta) * rr, dd, col);
      sv3(sg, 0, cy + rr * 2.05, dd, col);
    }
    // Glanzpunkt
    sQuad(sg, -DR * 0.45, cy + DR * 0.05, -DR * 0.2, cy + DR * 0.5, d + 0.04, WHITE_HOT);
    // Zwei Wellen
    const M = 8;
    for (let row = 0; row < 2; row++) {
      const y0 = -H * 0.26 - row * H * 0.15;
      const th = H * 0.065;
      for (let m = 0; m < M; m++) {
        const u0 = -W * 0.36 + (m / M) * W * 0.72;
        const u1 = -W * 0.36 + ((m + 1) / M) * W * 0.72;
        const w0 = y0 + Math.sin((m / M) * Math.PI * 4) * H * 0.04;
        const w1 = y0 + Math.sin(((m + 1) / M) * Math.PI * 4) * H * 0.04;
        sv3(sg, u0, w0 - th, d, waves);
        sv3(sg, u1, w1 - th, d, waves);
        sv3(sg, u1, w1 + th, d, waves);
        sv3(sg, u0, w0 - th, d, waves);
        sv3(sg, u1, w1 + th, d, waves);
        sv3(sg, u0, w0 + th, d, waves);
      }
    }
  };
  const updateSign = (sg: Sign, time: number, seconds: number, cam: THREE.Vector3): void => {
    const f = sg.flood;
    const arrive = time + f.lead + sg.extra;
    const free = floodPeak(f, arrive - 30, arrive + (f.count * t.step * 60) / 22) <= FLOOD_FROM;
    const flash = !free && (seconds * 2.6) % 1 < 0.55;
    const W = sg.w;
    const H = sg.h;
    const d = 0.18;
    const ff = farFade(Math.hypot(sg.cx - cam.x, sg.cz - cam.z) * 0.6);
    // Grund und Leuchtrahmen
    const bg = free ? SIG_GREEN_DARK : flash ? SIG_RED : SIG_RED_DARK;
    const frame = free ? SIG_GREEN : flash ? LAVA2 : SIG_RED;
    sQuad(sg, -W / 2, -H / 2, W / 2, H / 2, d, bg);
    const fw = 0.16;
    sQuad(sg, -W / 2, -H / 2, W / 2, -H / 2 + fw, d + 0.01, frame);
    sQuad(sg, -W / 2, H / 2 - fw, W / 2, H / 2, d + 0.01, frame);
    sQuad(sg, -W / 2, -H / 2, -W / 2 + fw, H / 2, d + 0.01, frame);
    sQuad(sg, W / 2 - fw, -H / 2, W / 2, H / 2, d + 0.01, frame);
    if (free) {
      const sc = Math.min(W * 0.95, H * 1.5);
      arrow(sg, sc, 0.1, d + 0.02, C_INK);
      arrow(sg, sc, 0, d + 0.04, SIG_GREEN);
      arrow(sg, sc * 0.6, -0.25, d + 0.06, SIG_GREEN_LIGHT);
    } else {
      if (flash) lavaSymbol(sg, d + 0.02, LAVA2, C_INK, C_INK);
      else lavaSymbol(sg, d + 0.02, LAVA1, rgb(0x1a0604), LAVA0);
    }
    // Leuchthof um die Tafel (additiv).
    const gc = free ? GLOW_GREEN : GLOW_RED;
    const gf = (free ? 0.35 : flash ? 0.9 : 0.2) * ff;
    if (gf > 0.01) {
      const m = 1.1;
      const corners = [
        [-W / 2, -H / 2, -W / 2 - m, -H / 2 - m],
        [W / 2, -H / 2, W / 2 + m, -H / 2 - m],
        [W / 2, H / 2, W / 2 + m, H / 2 + m],
        [-W / 2, H / 2, -W / 2 - m, H / 2 + m],
      ];
      const L = (u: number, v: number, c: RGB, k: number): void => {
        light.v(sg.cx + sg.ux * u + sg.nx * (d - 0.05), sg.cy + v, sg.cz + sg.uz * u + sg.nz * (d - 0.05), c, 1, k);
      };
      for (let e = 0; e < 4; e++) {
        const a = corners[e];
        const b = corners[(e + 1) % 4];
        L(a[0], a[1], gc, gf);
        L(b[0], b[1], gc, gf);
        L(b[2], b[3], BLACK, 0);
        L(a[0], a[1], gc, gf);
        L(b[2], b[3], BLACK, 0);
        L(a[2], a[3], BLACK, 0);
      }
    }
  };

  return {
    group,
    update(time, seconds, dt, cam, fx) {
      glow.begin();
      shadow.begin();
      light.begin();
      nJets = 0;
      nBombsDrawn = 0;
      for (const v of vents) {
        const dist = Math.hypot(v.p.x - cam.x, v.p.z - cam.z);
        if (dist < DRAW_FAR) updateVent(v, time, seconds, dt, cam, dist, fx);
      }
      for (const b of bombs) {
        const dist = Math.hypot(b.p.x - cam.x, b.p.z - cam.z);
        if (dist < DRAW_FAR) updateBomb(b, time, seconds, dt, cam, dist, fx);
      }
      st = 1;
      for (const fv of floods) updateFlood(fv, time, seconds, dt, cam, fx);
      for (const sg of signs) {
        if (Math.hypot(sg.cx - cam.x, sg.cz - cam.z) < DRAW_FAR + 60) updateSign(sg, time, seconds, cam);
      }
      glow.end();
      shadow.end();
      light.end();
      jets.count = nJets;
      if (jetOl) jetOl.count = nJets;
      if (nJets > 0) jets.instanceMatrix.needsUpdate = true;
      bombMesh.count = nBombsDrawn;
      trails.count = nBombsDrawn;
      if (bombOl) bombOl.count = nBombsDrawn;
      if (nBombsDrawn > 0) {
        bombMesh.instanceMatrix.needsUpdate = true;
        trails.instanceMatrix.needsUpdate = true;
      }
      // Leere Netze gar nicht erst zeichnen.
      glowMesh.visible = glow.tris > 0;
      shadowMesh.visible = shadow.tris > 0;
      lightMesh.visible = light.tris > 0;
      jets.visible = nJets > 0;
      if (jetOl) jetOl.visible = nJets > 0;
      bombMesh.visible = nBombsDrawn > 0;
      trails.visible = nBombsDrawn > 0;
      if (bombOl) bombOl.visible = nBombsDrawn > 0;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
