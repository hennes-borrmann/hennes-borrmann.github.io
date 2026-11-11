// Eiszapfen-Pass: Lawinen und fallende Eiszapfen.
//
// Ort, Größe und Takt kommen ausschließlich aus der Physik (game/mechanics.ts,
// game/sim.ts): eine Lawine wirkt, solange pulseCycle(p, time) < p.on, in einem
// geraden Streifen p.radius Meter vor und hinter der Stelle über die ganze
// Bahnbreite; das Vorzeichen von p.lat nennt die Bergseite. Ein Eiszapfen
// trifft im Kreis p.radius um (x, z), ebenfalls während der on-Ticks. Alles,
// was nach Gefahr aussieht, hängt deshalb an `time` (Ticks der Rennzeit);
// `seconds` dient nur zum Flackern.
//
// Lawine – drei Zustände, aus 80 m lesbar:
//   * Ruhe: je zwei Warnmasten beidseits mit gelber Leuchte (aus), rot-weiße
//     Pfosten am Rand und Schraffur auf der Fahrbahn genau über den Streifen.
//     Auf der Bergseite steigt eine Lawinenrinne mit Wechte an.
//   * Vorwarnung: die Leuchten blinken immer schneller rot, an der Wechte
//     staubt es, kleine Brocken kullern voraus; in der letzten Sekunde schießt
//     die Masse die Rinne herunter und erreicht die Bahn genau bei Zyklus 0.
//   * Sie läuft: Schneebrocken und eine halbdurchsichtige Staubwalze ziehen
//     quer über die Bahn talwärts, die Fahrbahn im Streifen ist weiß bedeckt.
//     Danach schmilzt ein Rest Schnee in zwei Sekunden weg (nur Zierde).
//
// Eiszapfen: an der Höhlendecke über jeder Stelle ein großer Zapfen. Vorwarnung:
// er wackelt, Splitter rieseln, am Boden wächst der Schatten bis zum Radius,
// ein roter Ring zeigt die Grenze. In den letzten Ticks vor 0 fällt er, bei 0
// zerspringt er; solange es gefährlich ist, liegen Splitter im Kreis. Danach
// wächst oben ein neuer Zapfen nach.
//
// Zeichenaufrufe: Feststehendes (toon) 1 + Kontur 1, flache Flächen 1, Körper
// mit eingebauter Kontur 1, Halbdurchsichtiges 1 – höchstens 5 (ohne detail 4).
// Pro Bild geschrieben wird nur in Kameranähe.

import * as THREE from 'three';
import { PULSE_AVALANCHE, PULSE_ICICLE, pulseCycle, pulseWarning, type Pulse } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, noise, seeded, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { INK, addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { TUNNEL_H } from '../world';

// --- Farben ------------------------------------------------------------------------

const C_INK = rgb(INK);
const SNOW = rgb(0xffffff);
const SNOW_B = rgb(0xdce9fb);
const SNOW_S = rgb(0xa7c0ea);
const SNOW_D = rgb(0x7393cf);
const ICE = rgb(0x8fe6f4);
const ICE_M = rgb(0x4cc0dc);
const ICE_D = rgb(0x2a7fb4);
const ICE_HI = rgb(0xe2fcff);
const ROCK = rgb(0x5d667f);
const ROCK_D = rgb(0x434a61);
const STEEL = rgb(0x39404f);
const STEEL_HI = rgb(0x7d8597);
const RED = rgb(0xe23a2e);
const WHITE = rgb(0xf6f6f2);
const YEL = rgb(0xffc72e);
const YEL_OFF = rgb(0x7a6224);
const LAMP_RED = rgb(0xff2a14);
const LAMP_HOT = rgb(0xffd9b8);
const LAMP_DIM = rgb(0x5a1410);
const SHADOW = rgb(0x0b1430);
const HATCH = rgb(0x8fa9d6);

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
  v(x: number, y: number, z: number, c: RGB, a = 1): void {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    const o = i * this.k;
    this.col[o] = c[0];
    this.col[o + 1] = c[1];
    this.col[o + 2] = c[2];
    if (this.k === 4) this.col[o + 3] = a;
  }

  /** Noch Platz für so viele Dreiecke? (Damit kein halbes Dreieck entsteht.) */
  room(tris: number): boolean {
    return this.n + tris * 3 <= this.max;
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

/**
 * Dreieck eines Körpers mit Umriss: außen richtig herum gewickelt (von der Mitte
 * (mx, my, mz) weg), die Kontur als nach außen versetzte, innen gewickelte Hülle
 * in Tusche – sie erscheint nur am Rand. ol = Dicke der Kontur (0 = keine).
 */
function solidTri(
  d: Dyn,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  mx: number, my: number, mz: number,
  c: RGB,
  ol: number,
): void {
  if (!d.room(ol > 0 ? 2 : 1)) return;
  // Wicklung prüfen: Normale gegen Richtung von der Mitte zur Fläche.
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const out = nx * (ax + bx + cx - 3 * mx) + ny * (ay + by + cy - 3 * my) + nz * (az + bz + cz - 3 * mz) >= 0;
  if (out) {
    d.v(ax, ay, az, c);
    d.v(bx, by, bz, c);
    d.v(cx, cy, cz, c);
  } else {
    d.v(ax, ay, az, c);
    d.v(cx, cy, cz, c);
    d.v(bx, by, bz, c);
  }
  if (ol <= 0) return;
  // Hülle: jede Ecke um ol von der Mitte weg, Wicklung umgekehrt.
  const ea = ol / (Math.hypot(ax - mx, ay - my, az - mz) || 1);
  const eb = ol / (Math.hypot(bx - mx, by - my, bz - mz) || 1);
  const ec = ol / (Math.hypot(cx - mx, cy - my, cz - mz) || 1);
  const pax = ax + (ax - mx) * ea;
  const pay = ay + (ay - my) * ea;
  const paz = az + (az - mz) * ea;
  const pbx = bx + (bx - mx) * eb;
  const pby = by + (by - my) * eb;
  const pbz = bz + (bz - mz) * eb;
  const pcx = cx + (cx - mx) * ec;
  const pcy = cy + (cy - my) * ec;
  const pcz = cz + (cz - mz) * ec;
  if (out) {
    d.v(pax, pay, paz, C_INK);
    d.v(pcx, pcy, pcz, C_INK);
    d.v(pbx, pby, pbz, C_INK);
  } else {
    d.v(pax, pay, paz, C_INK);
    d.v(pbx, pby, pbz, C_INK);
    d.v(pcx, pcy, pcz, C_INK);
  }
}

/** Farbe einer Schneefläche nach ihrer Neigung zum Licht (oben hell, unten blau). */
function snowShade(ny: number): RGB {
  return ny > 0.55 ? SNOW : ny > 0.05 ? SNOW_B : ny > -0.45 ? SNOW_S : SNOW_D;
}

const SEG = 14;
const COS = new Float32Array(SEG + 1);
const SIN = new Float32Array(SEG + 1);
for (let i = 0; i <= SEG; i++) {
  COS[i] = Math.cos((i / SEG) * Math.PI * 2);
  SIN[i] = Math.sin((i / SEG) * Math.PI * 2);
}

/** Zur Kamera gedrehte, gewellte Scheibe (Staubballen, Lichthof): Mitte a0, Rand a1. */
function blob(d: Dyn, x: number, y: number, z: number, cam: THREE.Vector3, r: number, cIn: RGB, cOut: RGB, a0: number, a1: number, wob: number): void {
  if (a0 <= 0.01 && a1 <= 0.01) return;
  if (!d.room(SEG)) return;
  let hx = cam.z - z;
  let hz = x - cam.x;
  const l = Math.hypot(hx, hz) || 1;
  hx /= l;
  hz /= l;
  for (let i = 0; i < SEG; i++) {
    const ra = r * (i % 2 === 0 ? 1 : 0.84 + 0.1 * Math.sin(wob + i));
    const rb = r * ((i + 1) % 2 === 0 ? 1 : 0.84 + 0.1 * Math.sin(wob + i + 1));
    d.v(x, y, z, cIn, a0);
    d.v(x + hx * COS[i] * ra, y + SIN[i] * ra, z + hz * COS[i] * ra, SIN[i] < -0.2 ? SNOW_S : cOut, a1);
    d.v(x + hx * COS[i + 1] * rb, y + SIN[i + 1] * rb, z + hz * COS[i + 1] * rb, SIN[i + 1] < -0.2 ? SNOW_S : cOut, a1);
  }
}

// --- Ablauf ---------------------------------------------------------------------------

/** Lawine: Tempo der Brocken und der Staubwalze (m/s), Nachlauf des liegenden Schnees (Ticks). */
const ROLL_V = 30;
const FRONT_V = 80;
const DUST_V = 34;
const AFTER = 120;
/** Brocken und Staubballen je Lawine, kleine Vorläufer während der Vorwarnung. */
const N_CHUNK = 54;
const N_DUST = 16;
const N_PEBBLE = 7;
/** Raster der Schneedecke auf der Bahn: quer × längs. */
const NU = 16;
const NW = 10;
/** Eiszapfen: lichte Höhe der Höhle (wie TUNNEL_H in world.ts) und Querschnitt ihrer Decke. */
const CAVE_H = TUNNEL_H;
const CAVE_IN: [number, number][] = [
  [0, 1],
  [0.38, 0.95],
  [0.74, 0.78],
  [1, 0.45],
];
/** Fallzeit des Zapfens (Ticks vor Zyklus 0) und Dauer des Nachwachsens (Ticks nach dem Ende der Gefahr). */
const FALL = 14;
const REGROW = 34;
const N_SHARD = 9;
/** Pro Bild geschrieben wird nur bis zu dieser Entfernung von der Kamera; Teilchen nur bis FX_NEAR. */
const DRAW_FAR = 280;
const FX_NEAR = 130;

interface Aval {
  p: Pulse;
  /** Mitte der Fahrbahn am Abschnitt, längs (f) und rechts (r). */
  cx: number;
  cz: number;
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  /** Bergseite: +1 rechts, −1 links. */
  side: number;
  /** Halbe Breite des Rasters (über die Bande hinaus) und Länge, Steigung der Rinne. */
  E: number;
  L: number;
  slope: number;
  R: number;
  /** Bodenhöhe im Raster (NU+1) × (NW+1), u von −E bis E, w von −R bis R. */
  gy: Float32Array;
  /** Fester Zufall je Rasterpunkt (Flecken der schmelzenden Decke). */
  gn: Float32Array;
  /** Brocken: w, Abwurf (Ticks), Größe, Hüpfphase, Drehung um die Hochachse. */
  ch: Float32Array;
  /** Form der Brocken: je 8 Ecken (6 am Gürtel, oben, unten). */
  shape: Float32Array;
  dust: Float32Array;
  /** Masten (Fuß x, z, y) für die Leuchten. */
  lamps: Float32Array;
  acc: number;
  acc2: number;
}

interface Ice {
  p: Pulse;
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
  fx: number;
  fz: number;
  bank: number;
  slope: number;
  /** Höhe der Decke über der Stelle und Länge des Zapfens. */
  top: number;
  len: number;
  /** Splitter: u, w, Höhe, Fußradius, Neigung u, Neigung w, Drehung. */
  sh: Float32Array;
  lastCycle: number;
  acc: number;
}

export function buildSnow(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'schnee';
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(8800 + t.index * 17);

  // --- Bodenhöhe der Fahrbahn an einer beliebigen Stelle (nur beim Aufbau) ---
  let nearLat = 0;
  let nearW = 0;
  const roadY = (x: number, z: number, refY: number): number => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < t.total; i++) {
      if (Math.abs(t.py[i] - refY) > 5) continue;
      const dx = x - t.px[i];
      const dz = z - t.pz[i];
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return refY;
    const lat = (x - t.px[best]) * rightX(t, best) + (z - t.pz[best]) * rightZ(t, best);
    nearLat = lat;
    nearW = t.wh[best];
    return t.py[best] + Math.max(-t.wh[best] - 0.6, Math.min(t.wh[best] + 0.6, lat)) * t.bank[best];
  };

  const solid = new MeshBuilder();
  const frame = new MeshBuilder();
  /** Quader ins feste Netz, mit Kontur. */
  const boxO = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, c: RGB, rot: number, top?: RGB): void => {
    solid.box(cx, cy, cz, sx, sy, sz, c, rot, top);
    frame.box(cx, cy, cz, sx, sy, sz, c, rot, top);
  };

  // === Lawinen ========================================================================
  const avals: Aval[] = [];
  for (const p of t.pulses) {
    if (p.kind !== PULSE_AVALANCHE) continue;
    const seg = p.seg;
    const cx = t.px[seg];
    const cz = t.pz[seg];
    const cy = t.py[seg];
    const fx = t.tx[seg];
    const fz = t.tz[seg];
    const rx = rightX(t, seg);
    const rz = rightZ(t, seg);
    const side = p.lat >= 0 ? 1 : -1;
    const R = p.radius;
    const wh = t.wh[seg];
    const E = wh + 1.6;
    const at = (u: number, w: number): [number, number] => [cx + rx * u + fx * w, cz + rz * u + fz * w];

    // Raster der Bodenhöhen
    const gy = new Float32Array((NU + 1) * (NW + 1));
    const gn = new Float32Array((NU + 1) * (NW + 1));
    for (let iu = 0; iu <= NU; iu++) {
      for (let iw = 0; iw <= NW; iw++) {
        const u = -E + (2 * E * iu) / NU;
        const w = -R + (2 * R * iw) / NW;
        const [x, z] = at(u, w);
        gy[iu * (NW + 1) + iw] = roadY(x, z, cy);
        gn[iu * (NW + 1) + iw] = noise(x * 0.45, z * 0.45) * 0.7 + rnd() * 0.3;
      }
    }
    const gridY = (u: number, w: number): number => {
      const fu = Math.max(0, Math.min(NU - 1e-4, ((u + E) / (2 * E)) * NU));
      const fw = Math.max(0, Math.min(NW - 1e-4, ((w + R) / (2 * R)) * NW));
      const iu = Math.floor(fu);
      const iw = Math.floor(fw);
      const ku = fu - iu;
      const kw = fw - iw;
      const a = gy[iu * (NW + 1) + iw];
      const b = gy[(iu + 1) * (NW + 1) + iw];
      const c = gy[iu * (NW + 1) + iw + 1];
      const d = gy[(iu + 1) * (NW + 1) + iw + 1];
      return a + (b - a) * ku + (c - a) * kw + (a - b - c + d) * ku * kw;
    };

    // Länge der Rinne: so weit, bis eine andere Fahrbahn in die Quere kommt.
    let L = 26;
    for (let s = 4; s <= 26; s += 2) {
      let hit = false;
      for (const w of [-R - 1.5, 0, R + 1.5]) {
        const [x, z] = at(side * (E + s), w);
        for (let i = 0; i < t.total && !hit; i++) {
          if (i < t.n) {
            const di = Math.abs(i - seg);
            if (Math.min(di, t.n - di) * t.step < 40) continue;
          }
          if (Math.hypot(x - t.px[i], z - t.pz[i]) < t.wh[i] + 6) hit = true;
        }
      }
      if (hit) {
        L = Math.max(8, s - 2);
        break;
      }
    }
    const slope = 0.52;

    const av: Aval = {
      p, cx, cz, fx, fz, rx, rz, side, E, L, slope, R, gy, gn,
      ch: new Float32Array(N_CHUNK * 5),
      shape: new Float32Array(N_CHUNK * 24),
      dust: new Float32Array(N_DUST * 4),
      lamps: new Float32Array(4 * 3),
      acc: rnd(),
      acc2: rnd(),
    };
    // Brocken: Abwurf so verteilt, dass der erste genau bei Zyklus 0 die Bahn erreicht
    // und der letzte sie mit dem Ende der Gefahr verlässt.
    const Lt = (L / ROLL_V) * 60;
    const Wt = ((2 * E) / ROLL_V) * 60;
    const r0 = -Lt;
    const r1 = p.on - Lt - Wt;
    for (let k = 0; k < N_CHUNK; k++) {
      const big = k % 7 === 0;
      av.ch[k * 5] = (rnd() * 2 - 1) * (R - 0.9);
      av.ch[k * 5 + 1] = k === 0 ? r0 : r0 + (r1 - r0) * ((k + rnd() * 0.8) / N_CHUNK);
      av.ch[k * 5 + 2] = big ? 0.75 + rnd() * 0.2 : 0.3 + rnd() * 0.32;
      av.ch[k * 5 + 3] = rnd() * 6.28;
      av.ch[k * 5 + 4] = rnd() * 6.28;
      for (let e = 0; e < 6; e++) {
        const a = (e / 6) * Math.PI * 2 + rnd() * 0.3;
        const rr = 0.85 + rnd() * 0.3;
        av.shape[k * 24 + e * 3] = Math.cos(a) * rr;
        av.shape[k * 24 + e * 3 + 1] = (rnd() - 0.5) * 0.3;
        av.shape[k * 24 + e * 3 + 2] = Math.sin(a) * rr;
      }
      av.shape[k * 24 + 18] = (rnd() - 0.5) * 0.3;
      av.shape[k * 24 + 19] = 0.7 + rnd() * 0.3;
      av.shape[k * 24 + 20] = (rnd() - 0.5) * 0.3;
      av.shape[k * 24 + 21] = (rnd() - 0.5) * 0.3;
      av.shape[k * 24 + 22] = -0.6 - rnd() * 0.2;
      av.shape[k * 24 + 23] = (rnd() - 0.5) * 0.3;
    }
    for (let k = 0; k < N_DUST; k++) {
      av.dust[k * 4] = (rnd() * 2 - 1) * (R - 1.5);
      av.dust[k * 4 + 1] = -(L / FRONT_V) * 60 + (p.on - 40 + (L / FRONT_V) * 60) * ((k + rnd() * 0.7) / N_DUST);
      av.dust[k * 4 + 2] = 1.7 + rnd() * 1.1;
      av.dust[k * 4 + 3] = rnd() * 6.28;
    }

    // --- Lawinenrinne auf der Bergseite: Schneehang mit Felsrippen und Wechte ---
    const rot = Math.atan2(fx, fz);
    const chuteY = (s: number, w: number): number => gridY(side * E, Math.max(-R, Math.min(R, w))) + slope * s + 0.55 * (w / R) * (w / R) * Math.min(1, s / 4);
    const P = (s: number, w: number, dy = 0): V3 => {
      const [x, z] = at(side * (E + s), w);
      return [x, chuteY(s, w) + dy, z];
    };
    const rows = Math.max(2, Math.round(L / 2.6));
    const cols = 8;
    const wEdge = R + 0.4;
    /** Viereck so gewickelt, dass es nach oben zeigt (Seite der Rinne spielt keine Rolle). */
    const quadUp = (a: V3, b: V3, c: V3, d: V3, col: RGB): void => {
      const ux = b[0] - a[0];
      const uz = b[2] - a[2];
      const vx = c[0] - a[0];
      const vz = c[2] - a[2];
      if (uz * vx - ux * vz >= 0) solid.quad(a, b, c, d, col);
      else solid.quad(a, d, c, b, col);
    };
    for (let i = 0; i < rows; i++) {
      const s0 = (i / rows) * L;
      const s1 = ((i + 1) / rows) * L;
      for (let j = 0; j < cols; j++) {
        const w0 = -wEdge + (2 * wEdge * j) / cols;
        const w1 = -wEdge + (2 * wEdge * (j + 1)) / cols;
        // Fallinien als Streifen, unten an der Bahn ein bläulicher Schattenfuß
        const col = i === 0 ? SNOW_S : (j + (i % 2)) % 2 === 0 ? SNOW : SNOW_B;
        quadUp(P(s0, w0), P(s1, w0), P(s1, w1), P(s0, w1), col);
      }
    }
    // Felsrippen an beiden Seiten der Rinne, nach außen bis unter das Gelände
    for (const sw of [-1, 1]) {
      for (let i = 0; i < rows; i++) {
        const s0 = (i / rows) * L;
        const s1 = ((i + 1) / rows) * L;
        const h0 = 1.1 + 0.5 * noise(i * 1.7, sw * 3 + p.seg);
        const h1 = 1.1 + 0.5 * noise((i + 1) * 1.7, sw * 3 + p.seg);
        const a0 = P(s0, sw * wEdge);
        const a1 = P(s1, sw * wEdge);
        const t0 = P(s0, sw * (wEdge + 1.2), h0);
        const t1 = P(s1, sw * (wEdge + 1.2), h1);
        // Flanke: erst steiler Fels, dann eine breite verschneite Schulter bis unter das Gelände.
        const foot = gridY(side * E, sw * R) - 1.5;
        const spread0 = 2.6 + 1.05 * slope * s0;
        const spread1 = 2.6 + 1.05 * slope * s1;
        const m0 = P(s0, sw * (wEdge + 1.2 + spread0 * 0.3), h0 - slope * s0 * 0.4 - 0.6);
        const m1 = P(s1, sw * (wEdge + 1.2 + spread1 * 0.3), h1 - slope * s1 * 0.4 - 0.6);
        const [ox0, oz0] = at(side * (E + s0), sw * (wEdge + 1.2 + spread0));
        const [ox1, oz1] = at(side * (E + s1), sw * (wEdge + 1.2 + spread1));
        const b0: V3 = [ox0, foot, oz0];
        const b1: V3 = [ox1, foot, oz1];
        const cRock = i % 2 === 0 ? ROCK : ROCK_D;
        quadUp(a0, a1, t1, t0, cRock);
        quadUp(t0, t1, m1, m0, i % 2 === 0 ? ROCK_D : ROCK);
        quadUp(m0, m1, b1, b0, i % 3 === 0 ? SNOW_S : SNOW_B);
        // Schneekappe auf dem Grat der Rippe
        const k0 = P(s0, sw * (wEdge + 1.2), h0 + 0.25);
        const k1 = P(s1, sw * (wEdge + 1.2), h1 + 0.25);
        solid.tri(t0, t1, k1, SNOW_B);
        solid.tri(t0, k1, k0, SNOW);
      }
    }
    // Stirn unten (zur Bahn) und Rückwand oben bis unter das Gelände
    for (let j = 0; j < cols; j++) {
      const w0 = -wEdge + (2 * wEdge * j) / cols;
      const w1 = -wEdge + (2 * wEdge * (j + 1)) / cols;
      const top0 = P(L, w0);
      const top1 = P(L, w1);
      const [bx0, bz0] = at(side * (E + L + 1 + L * slope * 0.9), w0 * 1.6);
      const [bx1, bz1] = at(side * (E + L + 1 + L * slope * 0.9), w1 * 1.6);
      solid.quad(top0, top1, [bx1, top1[1] - L * slope - 2, bz1], [bx0, top0[1] - L * slope - 2, bz0], j % 2 === 0 ? SNOW_B : SNOW_S);
      const lo0 = P(0, w0);
      const lo1 = P(0, w1);
      solid.quad(lo0, lo1, [lo1[0], lo1[1] - 1.2, lo1[2]], [lo0[0], lo0[1] - 1.2, lo0[2]], SNOW_S);
      solid.quad(lo1, lo0, [lo0[0], lo0[1] - 1.2, lo0[2]], [lo1[0], lo1[1] - 1.2, lo1[2]], SNOW_S);
    }
    // Wechte: überhängender Schneewulst am oberen Ende – von dort bricht die Lawine los.
    {
      const n = 7;
      for (let j = 0; j < n; j++) {
        const w0 = -wEdge + (2 * wEdge * j) / n;
        const w1 = -wEdge + (2 * wEdge * (j + 1)) / n;
        const bump0 = 0.4 * Math.sin(j * 2.1 + p.seg);
        const bump1 = 0.4 * Math.sin((j + 1) * 2.1 + p.seg);
        const back0 = P(L - 0.2, w0, 0);
        const back1 = P(L - 0.2, w1, 0);
        const crest0 = P(L - 1.4, w0, 1.5 + bump0);
        const crest1 = P(L - 1.4, w1, 1.5 + bump1);
        const lip0 = P(L - 3.0, w0, 0.9 + bump0 * 0.5);
        const lip1 = P(L - 3.0, w1, 0.9 + bump1 * 0.5);
        const under0 = P(L - 2.0, w0, 0.2);
        const under1 = P(L - 2.0, w1, 0.2);
        quadUp(back0, back1, crest1, crest0, SNOW);
        quadUp(crest0, crest1, lip1, lip0, SNOW_B);
        solid.quad(lip0, lip1, under1, under0, SNOW_D);
        solid.quad(lip1, lip0, under0, under1, SNOW_D);
      }
    }

    // --- Warnmasten: beidseits je zwei, an den Enden des Streifens ---
    let li = 0;
    for (const su of [-1, 1]) {
      for (const sw of [-1, 1]) {
        const u = su * (wh + 1.1);
        const w = sw * (R + 1.3);
        const [x, z] = at(u, w);
        const y0 = roadY(x, z, cy) - 0.3;
        const H = 4.6;
        boxO(x, y0 + 0.25, z, 0.7, 0.5, 0.7, STEEL, rot);
        boxO(x, y0 + H / 2, z, 0.2, H, 0.2, STEEL_HI, rot);
        // Leuchtengehäuse mit Schirm, Front zu den Ankommenden (−f)
        boxO(x, y0 + H + 0.45, z, 1.05, 1.05, 0.5, STEEL, rot, STEEL_HI);
        boxO(x - fx * 0.35, y0 + H + 1.02, z - fz * 0.35, 1.15, 0.1, 0.45, STEEL, rot);
        // Warnschild darunter: gelbes Dreieck mit schwarzem Rand und Ausrufezeichen
        const sy = y0 + H - 1.15;
        const ox = x - fx * 0.14;
        const oz = z - fz * 0.14;
        const tri = (r: number, dy: number, off: number, c: RGB): void => {
          const a: V3 = [ox + rx * 0 - fx * off, sy + dy + r, oz + rz * 0 - fz * off];
          const b: V3 = [ox - rx * r * 0.87 - fx * off, sy + dy - r * 0.5, oz - rz * r * 0.87 - fz * off];
          const cc: V3 = [ox + rx * r * 0.87 - fx * off, sy + dy - r * 0.5, oz + rz * r * 0.87 - fz * off];
          solid.tri(a, b, cc, c);
          solid.tri(a, cc, b, c);
        };
        tri(0.78, 0, 0, C_INK);
        tri(0.6, 0.02, 0.02, YEL);
        solid.box(ox - fx * 0.05, sy + 0.12, oz - fz * 0.05, 0.12, 0.38, 0.04, C_INK, rot);
        solid.box(ox - fx * 0.05, sy - 0.2, oz - fz * 0.05, 0.12, 0.1, 0.04, C_INK, rot);
        av.lamps[li * 3] = x - fx * 0.27;
        av.lamps[li * 3 + 1] = y0 + H + 0.45;
        av.lamps[li * 3 + 2] = z - fz * 0.27;
        li++;
      }
    }
    // --- Rot-weiße Pfosten am Rand über die Länge des Streifens ---
    for (const su of [-1, 1]) {
      const nP = Math.max(3, Math.round((2 * R) / 3.6) + 1);
      for (let k = 0; k < nP; k++) {
        const w = -R + (2 * R * k) / (nP - 1);
        const u = su * (wh + 0.95);
        const [x, z] = at(u, w);
        const y0 = roadY(x, z, cy) - 0.2;
        const h = 1.7;
        for (let b = 0; b < 4; b++) boxO(x, y0 + (h / 4) * (b + 0.5), z, 0.17, h / 4, 0.17, b % 2 === 0 ? WHITE : RED, rot);
      }
    }
    // --- Schraffur auf der Fahrbahn: rot-weiße Kanten an beiden Enden, dazwischen Schrägstriche ---
    const groundPt = (u: number, w: number, lift: number): V3 | null => {
      const [x, z] = at(u, w);
      const y = roadY(x, z, cy);
      if (Math.abs(nearLat) > nearW - 0.25) return null;
      return [x, y + lift, z];
    };
    const decal = (u0: number, w0: number, u1: number, w1: number, u2: number, w2: number, u3: number, w3: number, c: RGB): void => {
      const a = groundPt(u0, w0, 0.05);
      const b = groundPt(u1, w1, 0.05);
      const cc = groundPt(u2, w2, 0.05);
      const d = groundPt(u3, w3, 0.05);
      if (!a || !b || !cc || !d) return;
      quadUp(a, b, cc, d, c);
    };
    {
      const bw = 0.9;
      const nb = Math.ceil((2 * wh) / 1.2);
      for (const sw of [-1, 1]) {
        for (let k = 0; k < nb; k++) {
          const u0 = -wh + (2 * wh * k) / nb;
          const u1 = -wh + (2 * wh * (k + 1)) / nb;
          const w0 = sw * R;
          const w1 = sw * (R - bw);
          decal(u0, w0, u1, w0, u1, w1, u0, w1, k % 2 === 0 ? RED : WHITE);
        }
      }
      // Schrägstriche (45°), in Stücken, damit sie dem Boden folgen
      const gap = 3.2;
      const sw2 = 0.42;
      const inner = R - 0.9 - 0.15;
      for (let k = -12; k <= 12; k++) {
        for (let u = -wh; u < wh - 0.01; u += 1.3) {
          const ua = u;
          const ub = Math.min(wh, u + 1.3);
          const wa = ua * side + k * gap;
          const wb = ub * side + k * gap;
          if (Math.abs(wa) > inner - sw2 || Math.abs(wb) > inner - sw2) continue;
          decal(ua, wa - sw2, ub, wb - sw2, ub, wb + sw2, ua, wa + sw2, HATCH);
        }
      }
    }
    avals.push(av);
  }

  // === Eiszapfen ========================================================================
  const ices: Ice[] = [];
  for (const p of t.pulses) {
    if (p.kind !== PULSE_ICICLE) continue;
    const seg = p.seg;
    const a = t.prev[seg];
    const b = t.next[seg];
    const W = t.wh[seg] + 0.75;
    const f = Math.min(1, Math.abs(p.lat) / W);
    let prof = CAVE_IN[CAVE_IN.length - 1][1];
    for (let k = 0; k < CAVE_IN.length - 1; k++) {
      if (f <= CAVE_IN[k + 1][0]) {
        const kk = (f - CAVE_IN[k][0]) / (CAVE_IN[k + 1][0] - CAVE_IN[k][0]);
        prof = CAVE_IN[k][1] + (CAVE_IN[k + 1][1] - CAVE_IN[k][1]) * kk;
        break;
      }
    }
    const top = p.y + CAVE_H * prof - 0.15;
    const len = Math.min(2.8, (top - p.y) * 0.42);
    const sh = new Float32Array(N_SHARD * 7);
    for (let k = 0; k < N_SHARD; k++) {
      const ang = (k / N_SHARD) * Math.PI * 2 + rnd() * 0.5;
      const rr = k === 0 ? 0 : p.radius * (0.25 + 0.6 * rnd());
      sh[k * 7] = Math.cos(ang) * rr;
      sh[k * 7 + 1] = Math.sin(ang) * rr;
      sh[k * 7 + 2] = k === 0 ? 1.35 : 0.55 + rnd() * 0.6;
      sh[k * 7 + 3] = k === 0 ? 0.45 : 0.17 + rnd() * 0.15;
      sh[k * 7 + 4] = Math.cos(ang) * (0.25 + rnd() * 0.35);
      sh[k * 7 + 5] = Math.sin(ang) * (0.25 + rnd() * 0.35);
      sh[k * 7 + 6] = rnd() * 6.28;
    }
    const ice: Ice = {
      p,
      x: p.x,
      y: p.y,
      z: p.z,
      rx: rightX(t, seg),
      rz: rightZ(t, seg),
      fx: t.tx[seg],
      fz: t.tz[seg],
      bank: t.bank[seg],
      slope: (t.py[b] - t.py[a]) / (2 * t.step),
      top,
      len,
      sh,
      lastCycle: -1e9,
      acc: rnd(),
    };
    ices.push(ice);
    // Eiskruste an der Decke: kleine Zapfen um den großen herum (stehen immer).
    const cone = (x: number, z: number, y: number, r: number, l: number, sides: number, cols: RGB[]): void => {
      for (let s = 0; s < sides; s++) {
        const a0 = (s / sides) * Math.PI * 2;
        const a1 = ((s + 1) / sides) * Math.PI * 2;
        const A: V3 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r];
        const B: V3 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
        const T: V3 = [x, y - l, z];
        solid.tri(A, T, B, cols[s % cols.length]);
        frame.tri(A, T, B, cols[s % cols.length]);
      }
    };
    // Sockel: flacher, umgedrehter Kegel aus Eis
    cone(p.x, p.z, top + 0.35, 1.05, 0.55, 7, [ICE, ICE_M, ICE_HI]);
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2 + rnd();
      const rr = 1.1 + rnd() * 0.7;
      cone(p.x + Math.cos(ang) * rr, p.z + Math.sin(ang) * rr, top + 0.25, 0.14 + rnd() * 0.1, 0.45 + rnd() * 0.7, 5, [ICE_HI, ICE, ICE_M]);
    }
  }

  // === Feste Netze =======================================================================
  if (!solid.empty) {
    const geo = solid.build();
    const mat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(geo, mat);
  }
  if (detail && !frame.empty) {
    const geo = addSmoothNormals(frame.build());
    const ol = new THREE.Mesh(geo, outlineMaterial(0.05));
    ol.name = 'outline';
    ol.frustumCulled = false;
    group.add(ol);
    disposables.push(geo);
  }

  // === Pro Bild geschriebene Flächen ===================================================
  const flat = new Dyn(4000, 3);
  const body = new Dyn(7000, 3);
  const haze = new Dyn(2500, 4);
  const flatMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide });
  const hazeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const flatMesh = new THREE.Mesh(flat.geo, flatMat);
  const bodyMesh = new THREE.Mesh(body.geo, bodyMat);
  const hazeMesh = new THREE.Mesh(haze.geo, hazeMat);
  for (const m of [flatMesh, bodyMesh, hazeMesh]) m.frustumCulled = false;
  hazeMesh.renderOrder = 2;
  group.add(flatMesh, bodyMesh, hazeMesh);
  disposables.push(flat, body, haze, flatMat, bodyMat, hazeMat);

  const fxOn = detail;
  /** Dicke der eingebauten Kontur, mit der Entfernung etwas kräftiger. */
  const olAt = (dist: number): number => (detail ? 0.045 + Math.min(0.12, dist * 0.0016) : 0);

  // --- Lawine -------------------------------------------------------------------------
  /** Lage eines Brockens auf seinem Weg d (Meter ab der Wechte) – Ergebnis in px, py, pz. */
  let px = 0;
  let py = 0;
  let pz = 0;
  let fade = 1;
  const gridYOf = (av: Aval, u: number, w: number): number => {
    const fu = Math.max(0, Math.min(NU - 1e-4, ((u + av.E) / (2 * av.E)) * NU));
    const fw = Math.max(0, Math.min(NW - 1e-4, ((w + av.R) / (2 * av.R)) * NW));
    const iu = Math.floor(fu);
    const iw = Math.floor(fw);
    const ku = fu - iu;
    const kw = fw - iw;
    const g = av.gy;
    const a = g[iu * (NW + 1) + iw];
    const b = g[(iu + 1) * (NW + 1) + iw];
    const c = g[iu * (NW + 1) + iw + 1];
    const d = g[(iu + 1) * (NW + 1) + iw + 1];
    return a + (b - a) * ku + (c - a) * kw + (a - b - c + d) * ku * kw;
  };
  const pathAt = (av: Aval, d: number, w: number): void => {
    const E = av.E;
    let u: number;
    let y: number;
    fade = 1;
    if (d < av.L) {
      const s = av.L - d;
      u = av.side * (E + s);
      const ww = Math.max(-av.R, Math.min(av.R, w));
      y = gridYOf(av, av.side * E, ww) + av.slope * s + 0.55 * (ww / av.R) * (ww / av.R) * Math.min(1, s / 4);
    } else if (d < av.L + 2 * E) {
      u = av.side * (E - (d - av.L));
      y = gridYOf(av, u, w);
    } else {
      const s = d - av.L - 2 * E;
      u = -av.side * (E + s);
      y = gridYOf(av, -av.side * E, w) - 0.06 * s * s - 0.2 * s;
      fade = Math.max(0, 1 - s / 11);
    }
    px = av.cx + av.rx * u + av.fx * w;
    pz = av.cz + av.rz * u + av.fz * w;
    py = y;
  };

  /** Ein Brocken: sechseckige Doppelpyramide, rollt quer zur Bahn. */
  const chunk = (av: Aval, k: number, d: number, size: number, ol: number): void => {
    const w = av.ch[k * 5] + 0.35 * Math.sin(d * 0.21 + k);
    pathAt(av, d, w);
    const s = size * fade;
    if (s < 0.05) return;
    const hop = Math.abs(Math.sin(d * 0.55 / Math.max(0.35, size) + av.ch[k * 5 + 3])) * 0.55 * size;
    const by = py + s * 0.62 + hop;
    // Achsen: a talwärts, b hoch, c längs der Bahn
    const ax = -av.side * av.rx;
    const az = -av.side * av.rz;
    const th = d / Math.max(0.3, size) + av.ch[k * 5 + 4];
    const ct = Math.cos(th);
    const st = Math.sin(th);
    const yaw = av.ch[k * 5 + 4];
    const cyw = Math.cos(yaw);
    const syw = Math.sin(yaw);
    const sh = av.shape;
    const o = k * 24;
    // Ecken drehen und in die Welt setzen (in einen festen Zwischenspeicher)
    for (let e = 0; e < 8; e++) {
      const lx0 = sh[o + e * 3];
      const ly = sh[o + e * 3 + 1];
      const lz0 = sh[o + e * 3 + 2];
      const lx = lx0 * cyw - lz0 * syw;
      const lz = lx0 * syw + lz0 * cyw;
      const rx = lx * ct + ly * st;
      const ry = -lx * st + ly * ct;
      VX[e] = px + (ax * rx + av.fx * lz) * s;
      VY[e] = by + ry * s;
      VZ[e] = pz + (az * rx + av.fz * lz) * s;
    }
    for (let e = 0; e < 6; e++) {
      const f = (e + 1) % 6;
      for (let pole = 6; pole <= 7; pole++) {
        // Farbe nach Neigung der Fläche: Mittel der Höhen gegen die Mitte
        const ny = (VY[e] + VY[f] + VY[pole]) / 3 - by;
        const c = snowShade((ny / s) * 1.6);
        solidTri(body, VX[e], VY[e], VZ[e], VX[f], VY[f], VZ[f], VX[pole], VY[pole], VZ[pole], px, by, pz, c, ol);
      }
    }
  };
  const VX = new Float32Array(8);
  const VY = new Float32Array(8);
  const VZ = new Float32Array(8);

  const updateAval = (av: Aval, time: number, seconds: number, dt: number, cam: THREE.Vector3, dist: number, fx: FxSink): void => {
    const p = av.p;
    const c = pulseCycle(p, time);
    const w = pulseWarning(p, time);
    const active = c < p.on;
    // Ticks relativ zum Ausbruch: vor ihm negativ (bis zu 4 s zurück).
    const cr = c >= p.period - 240 ? c - p.period : c;
    const after = !active && c - p.on < AFTER ? (c - p.on) / AFTER : -1;
    const ol = olAt(dist);
    const near = fxOn && dist < FX_NEAR;
    const E = av.E;
    const R = av.R;

    // --- Leuchten ---
    // Vorwarnung: rotes Blinken, beschleunigt von 1,5 auf 7 Hz (Phase integriert, ohne Sprünge).
    const ws = (w * p.warn) / 60;
    const wT = p.warn / 60;
    const blinkW = w > 0 ? 0.5 + 0.5 * Math.sin(Math.PI * 2 * (1.5 * ws + (2.75 * ws * ws) / wT)) : 0;
    for (let li = 0; li < 4; li++) {
      const lx = av.lamps[li * 3];
      const ly = av.lamps[li * 3 + 1];
      const lz = av.lamps[li * 3 + 2];
      let on = 0;
      if (active) on = ((c / 4 + li) | 0) % 2 === 0 ? 1 : 0.65;
      else if (w > 0) on = blinkW > 0.45 ? 1 : 0;
      const cl = on > 0 ? (on >= 1 ? LAMP_RED : LAMP_RED) : w > 0 || active ? LAMP_DIM : YEL_OFF;
      const cc = on >= 1 ? LAMP_HOT : cl;
      // Linse: Scheibe zur Anfahrt (−f)
      const r = 0.42;
      for (let i = 0; i < SEG; i++) {
        flat.v(lx - av.fx * 0.02, ly, lz - av.fz * 0.02, cc);
        flat.v(lx + av.rx * COS[i] * r - av.fx * 0.02, ly + SIN[i] * r, lz + av.rz * COS[i] * r - av.fz * 0.02, cl);
        flat.v(lx + av.rx * COS[i + 1] * r - av.fx * 0.02, ly + SIN[i + 1] * r, lz + av.rz * COS[i + 1] * r - av.fz * 0.02, cl);
      }
      if (on > 0) {
        // Lichthof: wächst mit der Entfernung, damit er aus 80 m noch zu sehen ist.
        const ld = Math.hypot(lx - cam.x, lz - cam.z);
        const hr = (1.1 + Math.min(2.6, ld * 0.022)) * (active ? 1.35 : 1);
        blob(haze, lx - av.fx * 0.3, ly, lz - av.fz * 0.3, cam, hr, LAMP_RED, LAMP_RED, 0.62 * on, 0, 0);
      }
    }

    // --- Vorwarnung: Staub an der Wechte, kleine Vorläufer ---
    if (w > 0) {
      const sTop = av.L - 1.5;
      for (let k = 0; k < 3; k++) {
        const ww = (k - 1) * R * 0.55 + Math.sin(seconds * 0.7 + k) * 0.8;
        pathAt(av, av.L - sTop, ww);
        const rr = 1.2 + 2.2 * w + 0.3 * Math.sin(seconds * 2.3 + k * 1.7);
        blob(haze, px, py + 1.6 + rr * 0.4, pz, cam, rr, SNOW, SNOW_B, 0.25 + 0.35 * w, 0.12 + 0.2 * w, seconds * 2 + k);
      }
      for (let k = 0; k < N_PEBBLE; k++) {
        // Abwurf über die Vorwarnung verteilt, langsam die Rinne hinab, an ihrem Fuß bleiben sie liegen.
        const rel = -p.warn + 10 + k * ((p.warn - 40) / N_PEBBLE);
        if (cr < rel) continue;
        const d = Math.min(av.L - 0.6, ((cr - rel) / 60) * (5 + (k % 3) * 2));
        chunk(av, (k * 5) % N_CHUNK, d, 0.2 + (k % 3) * 0.06, ol);
      }
      if (near) {
        av.acc -= dt * (3 + 12 * w);
        while (av.acc <= 0) {
          av.acc += 1;
          const ww = (Math.random() * 2 - 1) * R;
          pathAt(av, 1 + Math.random() * 2, ww);
          fx.puff(px, py + 1.2, pz, -av.side * av.rx * (1 + 3 * w) + (Math.random() - 0.5), 0.5 + Math.random() * 1.5, -av.side * av.rz * (1 + 3 * w) + (Math.random() - 0.5), 1.2, 0.7 + Math.random() * 0.6 + w * 0.6, Math.random() < 0.6 ? 0xffffff : 0xdce9fb, 1.4, -0.3);
        }
      }
    }

    // --- Brocken: von der Wechte quer über die Bahn talwärts ---
    for (let k = 0; k < N_CHUNK; k++) {
      const d = ((cr - av.ch[k * 5 + 1]) / 60) * ROLL_V;
      if (d < 0 || d > av.L + 2 * E + 11) continue;
      chunk(av, k, d, av.ch[k * 5 + 2], ol);
    }

    // --- Schneedecke im Streifen: kommt mit der Walze, schmilzt danach weg ---
    const frontS = active ? Math.min(2 * E, Math.max(0, (cr / 60) * FRONT_V)) : after >= 0 ? 2 * E : 0;
    if (frontS > 0) {
      const D = active ? 0.42 : 0.38 * (1 - after);
      const melt = after >= 0 ? after : 0;
      for (let iu = 0; iu < NU; iu++) {
        for (let iw = 0; iw < NW; iw++) {
          // Ecken der Zelle
          let any = false;
          for (let e = 0; e < 4; e++) {
            const ju = iu + (e === 1 || e === 2 ? 1 : 0);
            const jw = iw + (e >= 2 ? 1 : 0);
            const u = -E + (2 * E * ju) / NU;
            const ww = -R + (2 * R * jw) / NW;
            const q = E - av.side * u;
            const n = av.gn[ju * (NW + 1) + jw];
            let h = 0;
            if (q <= frontS + 1.5) {
              h = D * (0.62 + 0.38 * n);
              if (active) h += 0.13 * Math.sin(q * 1.25 - cr * 0.42 + ww * 0.6);
              h *= smooth((frontS - q) / 1.5 + 0.0001);
              h *= smooth((R - Math.abs(ww)) / 0.7);
              if (melt > 0) h *= smooth((n - melt * 1.05) / 0.22);
            }
            CH[e] = h;
            CX[e] = av.cx + av.rx * u + av.fx * ww;
            CZ[e] = av.cz + av.rz * u + av.fz * ww;
            CY[e] = av.gy[ju * (NW + 1) + jw] + 0.04 + Math.max(0, h);
            if (h > 0.03) any = true;
          }
          if (!any) continue;
          // Zwei Dreiecke, Farbe nach Höhe (Kuppen weiß, Mulden blau) und nach dem Kamm der Wellen
          for (let tri = 0; tri < 2; tri++) {
            const i0 = 0;
            const i1 = tri === 0 ? 1 : 2;
            const i2 = tri === 0 ? 2 : 3;
            const hm = (CH[i0] + CH[i1] + CH[i2]) / 3 / Math.max(0.05, D);
            const cc = hm > 0.78 ? SNOW : hm > 0.5 ? SNOW_B : hm > 0.2 ? SNOW_S : SNOW_D;
            if (!flat.room(1)) break;
            flat.v(CX[i0], CY[i0], CZ[i0], cc);
            flat.v(CX[i1], CY[i1], CZ[i1], cc);
            flat.v(CX[i2], CY[i2], CZ[i2], cc);
          }
        }
      }
    }

    // --- Staubwalze: halbdurchsichtige Ballen, die mit dem Strom ziehen ---
    if (active || (cr < 0 && cr > -(av.L / FRONT_V) * 60 - 4) || (after >= 0 && after < 0.35)) {
      for (let k = 0; k < N_DUST; k++) {
        const rel = av.dust[k * 4 + 1];
        const v = k < 3 ? FRONT_V : DUST_V;
        const d = ((cr - (k < 3 ? -(av.L / FRONT_V) * 60 : rel)) / 60) * v;
        if (d < 0 || d > av.L + 2 * E + 9) continue;
        const ww = av.dust[k * 4] + (k < 3 ? (k - 1) * R * 0.6 : 0);
        pathAt(av, d, ww);
        const grow = Math.min(1, d / 8);
        const r = 1.25 * av.dust[k * 4 + 2] * (0.6 + 0.4 * grow) * (0.4 + 0.6 * fade);
        // Dichte: an der Front kräftig, über der Bahn dünn genug, dass man die Karts sieht.
        const a = (0.42 * fade) * (active ? 1 : 0.6);
        blob(haze, px, py + 0.9 + r * 0.55, pz, cam, r, SNOW, SNOW_B, a, a * 0.55, seconds * 3 + av.dust[k * 4 + 3]);
      }
    }

    // --- Staubfahne über der Rinne, solange sie läuft: auch aus der Ferne zu sehen ---
    if (active || (after >= 0 && after < 0.3)) {
      const k = active ? Math.min(1, c / 20) * (1 - smooth((c - p.on + 30) / 30)) + (active ? 0 : 0) : 0;
      const a = active ? 0.4 * Math.max(0.25, k) : 0.3 * (1 - after / 0.3);
      for (let j = 0; j < 4; j++) {
        const d = av.L * (0.15 + 0.22 * j);
        const ww = (j % 2 === 0 ? -0.35 : 0.35) * R + Math.sin(seconds * 0.9 + j) * 0.8;
        pathAt(av, d, ww);
        const rr = 2.6 + 0.9 * j * 0.5 + 0.4 * Math.sin(seconds * 2.1 + j * 1.3);
        blob(haze, px, py + rr * 0.7, pz, cam, rr, SNOW, SNOW_B, a, a * 0.5, seconds * 2.5 + j);
      }
    }

    // --- Teilchen in Kameranähe ---
    if (near && active) {
      av.acc2 -= dt * 34;
      while (av.acc2 <= 0) {
        av.acc2 += 1;
        const ww = (Math.random() * 2 - 1) * R;
        const q = Math.random() * Math.min(2 * E, ((cr / 60) * FRONT_V));
        pathAt(av, av.L + q, ww);
        const sp = 5 + Math.random() * 6;
        fx.puff(px, py + 0.4 + Math.random() * 1.2, pz, -av.side * av.rx * sp, 1 + Math.random() * 2.5, -av.side * av.rz * sp, 0.7, 0.6 + Math.random() * 0.7, Math.random() < 0.65 ? 0xffffff : 0xcfe0f8, 1.6, 2);
      }
    }
  };

  // --- Eiszapfen ------------------------------------------------------------------------
  /** Kegel des Zapfens: Fuß (bx, by, bz) mit Radius r, Spitze in Richtung (dx, dy, dz) um Länge l. */
  const icicle = (bx: number, by: number, bz: number, r: number, dx: number, dy: number, dz: number, l: number, ol: number, spin: number): void => {
    const N = 7;
    // Zwei Querachsen senkrecht zur Richtung
    let ux = dz;
    let uy = 0;
    let uz = -dx;
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-4) {
      ux = 1;
      uz = 0;
      ul = 1;
    }
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = dy * uz - dz * uy;
    const vy = dz * ux - dx * uz;
    const vz = dx * uy - dy * ux;
    const mx = bx + dx * l * 0.3;
    const my = by + dy * l * 0.3;
    const mz = bz + dz * l * 0.3;
    const tx = bx + dx * l;
    const ty = by + dy * l;
    const tz = bz + dz * l;
    const k1 = 0.42;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2 + spin;
      const a1 = ((i + 1) / N) * Math.PI * 2 + spin;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      // Fußring, Mittelring (schmaler, ein Stück tiefer), Spitze
      const ax = bx + (ux * c0 + vx * s0) * r;
      const ay = by + (uy * c0 + vy * s0) * r;
      const az = bz + (uz * c0 + vz * s0) * r;
      const bbx = bx + (ux * c1 + vx * s1) * r;
      const bby = by + (uy * c1 + vy * s1) * r;
      const bbz = bz + (uz * c1 + vz * s1) * r;
      const mr = r * 0.62;
      const max = bx + dx * l * k1 + (ux * c0 + vx * s0) * mr;
      const may = by + dy * l * k1 + (uy * c0 + vy * s0) * mr;
      const maz = bz + dz * l * k1 + (uz * c0 + vz * s0) * mr;
      const mbx = bx + dx * l * k1 + (ux * c1 + vx * s1) * mr;
      const mby = by + dy * l * k1 + (uy * c1 + vy * s1) * mr;
      const mbz = bz + dz * l * k1 + (uz * c1 + vz * s1) * mr;
      const cA = i % 3 === 0 ? ICE_HI : i % 2 === 0 ? ICE : ICE_M;
      const cB = i % 3 === 0 ? ICE : i % 2 === 0 ? ICE_M : ICE_D;
      solidTri(body, ax, ay, az, bbx, bby, bbz, mbx, mby, mbz, mx, my, mz, cA, ol);
      solidTri(body, ax, ay, az, mbx, mby, mbz, max, may, maz, mx, my, mz, cA, ol);
      solidTri(body, max, may, maz, mbx, mby, mbz, tx, ty, tz, mx, my, mz, cB, ol);
    }
  };

  /** Ecke auf dem Boden an der Eiszapfenstelle: u rechts, w vorn, lift darüber. */
  const iv = (d: Dyn, s: Ice, u: number, w: number, lift: number, c: RGB, a = 1): void => {
    d.v(s.x + s.rx * u + s.fx * w, s.y + u * s.bank + w * s.slope + lift, s.z + s.rz * u + s.fz * w, c, a);
  };
  const ringAt = (d: Dyn, s: Ice, r0: number, r1: number, lift: number, c: RGB, a = 1): void => {
    for (let i = 0; i < SEG; i++) {
      iv(d, s, COS[i] * r0, SIN[i] * r0, lift, c, a);
      iv(d, s, COS[i] * r1, SIN[i] * r1, lift, c, a);
      iv(d, s, COS[i + 1] * r1, SIN[i + 1] * r1, lift, c, a);
      iv(d, s, COS[i] * r0, SIN[i] * r0, lift, c, a);
      iv(d, s, COS[i + 1] * r1, SIN[i + 1] * r1, lift, c, a);
      iv(d, s, COS[i + 1] * r0, SIN[i + 1] * r0, lift, c, a);
    }
  };

  const updateIce = (s: Ice, time: number, seconds: number, dt: number, _cam: THREE.Vector3, dist: number, fx: FxSink): void => {
    const p = s.p;
    const R = p.radius;
    const c = pulseCycle(p, time);
    const w = pulseWarning(p, time);
    const active = c < p.on;
    const ol = olAt(dist);
    const near = fxOn && dist < FX_NEAR;

    // Zapfen an der Decke: wächst nach, wackelt in der Vorwarnung, fällt in den letzten FALL Ticks.
    if (!active) {
      const grow = Math.min(1, (c - p.on) / REGROW);
      const g = smooth(grow);
      let dx = 0;
      let dz = 0;
      let drop = 0;
      if (w > 0) {
        const ws = (w * p.warn) / 60;
        const wT = p.warn / 60;
        const ph = Math.PI * 2 * (3 * ws + (5 * ws * ws) / wT);
        const amp = 0.03 + 0.16 * w * w;
        dx = Math.sin(ph) * amp;
        dz = Math.cos(ph * 0.7) * amp * 0.6;
      }
      const fallFrom = p.period - FALL;
      if (c >= fallFrom) {
        const k = (c - fallFrom) / FALL;
        drop = (s.top - s.len - s.y) * k * k;
      }
      let dy = -1;
      const dl = Math.hypot(dx, 1, dz);
      dx /= dl;
      dy /= dl;
      dz /= dl;
      const l = s.len * (0.12 + 0.88 * g);
      icicle(s.x, s.top - drop, s.z, 0.5 * (0.35 + 0.65 * g), dx, dy, dz, l, ol, p.seg * 0.7);
      if (w > 0) {
        // Schatten wächst bis an den Radius, roter Ring zeigt die Grenze (blinkt zum Ende).
        const rs = R * (0.3 + 0.7 * Math.pow(w, 0.8));
        for (let i = 0; i < SEG; i++) {
          iv(haze, s, 0, 0, 0.04, SHADOW, 0.45 + 0.45 * w);
          iv(haze, s, COS[i] * rs, SIN[i] * rs, 0.04, SHADOW, 0.3 + 0.4 * w);
          iv(haze, s, COS[i + 1] * rs, SIN[i + 1] * rs, 0.04, SHADOW, 0.3 + 0.4 * w);
        }
        const blinkOn = w < 0.55 || (seconds * 7) % 1 < 0.6;
        ringAt(flat, s, R - 0.32, R, 0.05, blinkOn ? LAMP_RED : YEL);
        ringAt(flat, s, R, R + 0.07, 0.05, C_INK);
        if (near) {
          // Es knackt: feine Splitter rieseln von der Decke – dichter, je näher der Fall.
          s.acc -= dt * (2 + 16 * w);
          while (s.acc <= 0) {
            s.acc += 1;
            const a = Math.random() * Math.PI * 2;
            const rr = 0.2 + Math.random() * 0.5;
            fx.spark(s.x + Math.cos(a) * rr, s.top - 0.3, s.z + Math.sin(a) * rr, 0, -1, 0, 0.6, 0.1 + Math.random() * 0.08, Math.random() < 0.5 ? 0xe2fcff : 0x8fe6f4, 12);
          }
        }
      }
    } else {
      // Splitter liegen im Kreis; zum Ende der Gefahr sinken sie weg.
      const k = Math.min(1, (p.on - c) / 12) * Math.min(1, (c + 1) / 3);
      ringAt(flat, s, 0, R * 0.92, 0.035, ICE_HI);
      ringAt(flat, s, R * 0.92, R, 0.035, ICE_M);
      for (let j = 0; j < N_SHARD; j++) {
        const o = j * 7;
        const su = s.sh[o];
        const sw = s.sh[o + 1];
        const h = s.sh[o + 2] * k;
        if (h < 0.03) continue;
        const r = s.sh[o + 3];
        const bx = s.x + s.rx * su + s.fx * sw;
        const bz = s.z + s.rz * su + s.fz * sw;
        const by = s.y + su * s.bank + sw * s.slope;
        const tx = bx + (s.rx * s.sh[o + 4] + s.fx * s.sh[o + 5]) * h;
        const tz = bz + (s.rz * s.sh[o + 4] + s.fz * s.sh[o + 5]) * h;
        const ty = by + h;
        const rot0 = s.sh[o + 6];
        const mx = (bx * 3 + tx) / 4;
        const my = by + h * 0.25;
        const mz = (bz * 3 + tz) / 4;
        for (let e = 0; e < 3; e++) {
          const a0 = rot0 + (e / 3) * Math.PI * 2;
          const a1 = rot0 + ((e + 1) / 3) * Math.PI * 2;
          const cc = e === 0 ? ICE_HI : e === 1 ? ICE : ICE_D;
          solidTri(body, bx + Math.cos(a0) * r, by, bz + Math.sin(a0) * r, bx + Math.cos(a1) * r, by, bz + Math.sin(a1) * r, tx, ty, tz, mx, my, mz, cc, ol);
        }
      }
      if (near) {
        const cyc = Math.floor((time + p.phase) / p.period);
        if (cyc !== s.lastCycle && c < 8) {
          s.lastCycle = cyc;
          for (let q = 0; q < 14; q++) {
            const a = (q / 14) * Math.PI * 2;
            const sp = 2 + Math.random() * 4;
            fx.spark(s.x, s.y + 0.4, s.z, Math.cos(a) * sp, 3 + Math.random() * 4, Math.sin(a) * sp, 0.55, 0.18 + Math.random() * 0.14, q % 2 === 0 ? 0xe2fcff : 0x8fe6f4, 16);
          }
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * Math.PI * 2;
            fx.puff(s.x + Math.cos(a) * 0.6, s.y + 0.3, s.z + Math.sin(a) * 0.6, Math.cos(a) * 2, 1.2, Math.sin(a) * 2, 0.7, 0.6, 0xe8f6ff, 1.2, 1);
          }
        }
      }
    }
  };

  const CX = new Float32Array(4);
  const CY = new Float32Array(4);
  const CZ = new Float32Array(4);
  const CH = new Float32Array(4);

  return {
    group,
    update(time, seconds, dt, cam, fx) {
      flat.begin();
      body.begin();
      haze.begin();
      for (const av of avals) {
        const dist = Math.hypot(av.cx - cam.x, av.cz - cam.z);
        if (dist < DRAW_FAR) updateAval(av, time, seconds, dt, cam, dist, fx);
      }
      for (const s of ices) {
        const dist = Math.hypot(s.x - cam.x, s.z - cam.z);
        if (dist < DRAW_FAR * 0.6) updateIce(s, time, seconds, dt, cam, dist, fx);
      }
      flat.end();
      body.end();
      haze.end();
      // Leere Netze gar nicht erst zeichnen.
      flatMesh.visible = flat.tris > 0;
      bodyMesh.visible = body.tris > 0;
      hazeMesh.visible = haze.tris > 0;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
