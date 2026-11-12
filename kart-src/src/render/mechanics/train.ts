// Wüstenexpress: Darstellung der Züge – Lok, Keilwagen, vier Flachwagen, Rampenwagen – und des Gleises.
//
// Lesbarkeit geht vor Zierde. Wer sich einem Zug nähert, soll aus 80 m erkennen: Hinten ist eine Rampe
// (helle Fläche, große Pfeil-Winkel in der Kennfarbe des Zugs, gelb-schwarze Wangen, zwei Schlusslichter),
// oben ist eine Fahrbahn (helle, glatte Deckflächen mit durchlaufender Mittellinie und gelben Bordleisten,
// Übergangsbleche über den Kupplungen), von der Seite ist das eine Wand (dunkle, massive Seitenwände bis
// fast auf die Schiene, darunter Fahrgestell und Räder).
//
// Maße und Lage kommen aus der Physik: Jeder Wagen steht dort, wo ihn vehiclePose (track.ts) hat. Die
// Oberseite liegt genau im Dachprofil roofTop (mechanics.ts) – auch in der Steigung: Die Physik rechnet die
// Dachhöhe als pose.y + roofTop(du) + slope·du und dreht den Wagen nur um die Hochachse. Das Bild macht es
// genauso (Scherung statt Kippen), damit Kart und Dach auf den Zentimeter zusammenpassen.
//
// Zeichentechnik – nur, was der Werkshof schon benutzt (siehe machines.ts): Netze mit Eckenfarben, deren
// Ecken je Bild neu gesetzt werden. Alle 28 Wagen stehen zusammen in vier Netzen:
//   Körper   – Toon-Material mit Eckenfarben (beleuchtet),
//   Kontur   – ein schlichter Hüllkörper je Wagen mit der gemeinsamen Tuschekontur (nur mit detail),
//   Kennung  – unbeleuchtete Flächen (Pfeil-Winkel, Mittellinie, gelb-schwarz, Fenster): bleiben auch im
//              Gegenlicht kräftig,
//   Licht    – additive Flächen: Stirnlampe samt gemaltem Lichtkegel auf dem Gleis, Schlusslichter.
// Dazu das Gleis als ein stehendes Netz (Schwellen, Schienen, Gleisbett, Warnlinie). Zusammen fünf
// Zeichenaufrufe (ohne detail vier). Kein eigener Shader, keine Textur, keine Instanzen, keine Lichtquelle.
//
// Reine Funktion der Rennzeit: update() rechnet jede Ecke allein aus time (Lage der Wagen, Drehung der
// Räder). Springt die Zeit, stimmt das Bild sofort. Nur die Abgasstöße (fx.puff, reine Zierde) hängen an
// seconds.

import * as THREE from 'three';
import { roofTop, type Vehicle, type VehicleSpec } from '../../game/mechanics';
import { EDGE_TUNNEL, newVehiclePose, vehiclePose, type Track } from '../../game/track';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';

type V3 = [number, number, number];
type RGB = [number, number, number];

// --- Farben ---------------------------------------------------------------------

const DECK = rgb(0xd3dadc); // Fahrflächen: helles Blech, kühl gegen den warmen Sand
const DECK_RAMPE = rgb(0xf1e9d2); // Rampe: noch heller
const BLECH = rgb(0x8f999f); // Übergangsbleche
const BORD = rgb(0xf0bd1f); // Bordleisten (gelb: Kante der Fahrbahn)
const RAHMEN = rgb(0x1d1b22);
const RAHMEN_OBEN = rgb(0x34313b);
const UNTEN = rgb(0x24222a);
const RUNGE = rgb(0x2b2629);
const RAD = rgb(0x2a2730);
const RAD_LAUF = rgb(0x4a4650);
const RAD_SPEICHE = rgb(0xc9a24a);
const MESSING = rgb(0xd2a542);
const ROT = rgb(0x7b2620);
const ROT_HELL = rgb(0x8c2d25);
const ROT_DUNKEL = rgb(0x5e1c18);
const PLANE = rgb(0x50677a);
const PLANE_DUNKEL = rgb(0x435769);
const GRUEN = rgb(0x1f5a43);
const GRUEN_DUNKEL = rgb(0x18493a);
const KOHLE = rgb(0x2e2c33);
const GELB = rgb(0xf2c21e);
const SCHWARZ = rgb(0x1b1a1f);
const GLAS = rgb(0x1f2c3a);
const GLAS_HELL = rgb(0x5d7d96);
const LINSE = rgb(0xfff1b8);
const SCHLUSS = rgb(0xff2a1a);
const ABGAS = 0x8d8790;

/** Kennfarbe je Zug: Pfeil-Winkel, Mittellinie, Dachkante der Lok, Schienenräumer. */
const KENN = [0xe0401c, 0x0f8fa8, 0xc2307e, 0x2f9e3c];

// Gleis
const SCHOTTER = rgb(0x8f8272);
const SCHWELLE = rgb(0x4a3526);
const SCHIENE = rgb(0xb9bdc4);
const WARN_GELB = rgb(0xf0be1e);
const WARN_SCHWARZ = rgb(0x1e1c22);

// --- Bausteine -------------------------------------------------------------------

/** Seiten eines Quaders (Bitmaske). x zeigt im Wagen nach LINKS, y nach oben, z nach vorn (Fahrtrichtung). */
const PX = 1;
const NX = 2;
const PY = 4;
const NY = 8;
const PZ = 16;
const NZ = 32;
const ALL = 63;

/** Drehung oder Kurbel einer Radachse: 1 = dreht sich mit dem Rad, 2 = Treibstange (verschiebt sich mit dem Kurbelzapfen). */
const DREHT = 1;
const KURBEL = 2;

function normal(a: V3, b: V3, c: V3): V3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/** Sammelt Dreiecke eines Wagens im Wagenraum, je Ecke mit Normale, Farbe und Radachse. */
class Bau {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly axle: number[] = [];
  readonly mode: number[] = [];
  /** Achse und Art für die folgenden Flächen (−1: fest am Wagen). */
  ax = -1;
  md = 0;

  get count(): number {
    return this.pos.length / 3;
  }

  tri(a: V3, b: V3, c: V3, color: RGB): void {
    const n = normal(a, b, c);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.axle.push(this.ax);
      this.mode.push(this.md);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: RGB): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Ebenes Viereck, so gewendet, dass es nach dir zeigt. */
  quadOut(a: V3, b: V3, c: V3, d: V3, color: RGB, dir: V3): void {
    const n = normal(a, b, c);
    if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] < 0) this.quad(a, d, c, b, color);
    else this.quad(a, b, c, d, color);
  }

  /** Vieleck als Fächer um seine erste Ecke, nach dir gewendet; colors: je Dreieck (zyklisch). */
  fanOut(p: V3[], colors: RGB[], dir: V3): void {
    for (let k = 1; k + 1 < p.length; k++) {
      const n = normal(p[0], p[k], p[k + 1]);
      const c = colors[(k - 1) % colors.length];
      if (n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] < 0) this.tri(p[0], p[k + 1], p[k], c);
      else this.tri(p[0], p[k], p[k + 1], c);
    }
  }

  /** Körper aus acht Ecken (Reihenfolge wie beim Quader: Index = xi + 2·yi + 4·zi). */
  hexa(p: V3[], color: RGB | RGB[], faces = ALL): void {
    const c = (x: number, y: number, z: number): V3 => p[x + 2 * y + 4 * z];
    const f = (k: number): RGB => (Array.isArray(color[0]) ? (color as RGB[])[k] : (color as RGB));
    if (faces & PX) this.quad(c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1), f(0));
    if (faces & NX) this.quad(c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0), f(1));
    if (faces & PY) this.quad(c(0, 1, 0), c(0, 1, 1), c(1, 1, 1), c(1, 1, 0), f(2));
    if (faces & NY) this.quad(c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1), f(3));
    if (faces & PZ) this.quad(c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1), f(4));
    if (faces & NZ) this.quad(c(0, 0, 0), c(0, 1, 0), c(1, 1, 0), c(1, 0, 0), f(5));
  }

  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: RGB | RGB[], faces = ALL): void {
    const p: V3[] = [];
    for (let i = 0; i < 8; i++) p.push([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]);
    this.hexa(p, color, faces);
  }

  /** Quader auf der Seite s (+1 links, −1 rechts) zwischen den Abständen a < b von der Mitte; outer/inner meinen die Seiten nach außen/innen. */
  sideBox(s: number, a: number, b: number, y0: number, y1: number, z0: number, z1: number, color: RGB, faces: { out?: boolean; inn?: boolean; top?: boolean; bottom?: boolean; front?: boolean; back?: boolean }): void {
    let m = 0;
    if (faces.out) m |= s > 0 ? PX : NX;
    if (faces.inn) m |= s > 0 ? NX : PX;
    if (faces.top) m |= PY;
    if (faces.bottom) m |= NY;
    if (faces.front) m |= PZ;
    if (faces.back) m |= NZ;
    this.box(Math.min(s * a, s * b), Math.max(s * a, s * b), y0, y1, z0, z1, color, m);
  }
}

/** Ein Wagen im Wagenraum: vier Schichten und seine Radachsen. */
interface Vorlage {
  body: Bau;
  hull: Bau;
  marks: Bau;
  glow: Bau;
  /** Je Achse: Mitte (y, z), Halbmesser, Kurbelhalbmesser. */
  axles: number[];
  /** Ecken der Fahrfläche im Körpernetz: [rechts hinten, links hinten, rechts vorn, links vorn], dazu die Mitte [rechts, links]. */
  ecken: number[];
  mitte: number[];
  /** Auspuff (Wagenraum) – nur an der Lok. */
  auspuff: V3[];
}

function neueVorlage(): Vorlage {
  return { body: new Bau(), hull: new Bau(), marks: new Bau(), glow: new Bau(), axles: [], ecken: [], mitte: [], auspuff: [] };
}

/**
 * Fahrfläche in zwei Hälften (hinten, vorn) über die ganze Breite, genau im Dachprofil.
 * Merkt sich die Ecken, damit der Test sie in Weltkoordinaten nachprüfen kann.
 */
function fahrflaeche(t: Vorlage, spec: VehicleSpec, car: number, color: RGB): void {
  const W = spec.halfWidth;
  const H = spec.half;
  const b = t.body;
  const y = (z: number): number => roofTop(spec, car, z);
  const half = (z0: number, z1: number): number[] => {
    const n = b.count;
    // a = rechts bei z0, b = rechts bei z1, c = links bei z1, d = links bei z0 (x zeigt nach links)
    b.quad([-W, y(z0), z0], [-W, y(z1), z1], [W, y(z1), z1], [W, y(z0), z0], color);
    return [n, n + 1, n + 2, n + 5];
  };
  const r = half(-H, 0);
  const f = half(0, H);
  t.ecken = [r[0], r[3], f[1], f[2]];
  t.mitte = [r[1], r[2]];
}

/** Bordleisten an den Längskanten: kniehoch, dem Dachprofil folgend. */
function bordleisten(t: Vorlage, spec: VehicleSpec, car: number, hoch: number, z0: number, z1: number, color: RGB): void {
  const W = spec.halfWidth;
  const y = (z: number): number => roofTop(spec, car, z);
  for (const s of [1, -1]) {
    const xa = s > 0 ? W - 0.17 : -W;
    const xb = s > 0 ? W : -W + 0.17;
    const p: V3[] = [];
    for (let i = 0; i < 8; i++) {
      const z = i & 4 ? z1 : z0;
      p.push([i & 1 ? xb : xa, y(z) + (i & 2 ? hoch : 0), z]);
    }
    t.body.hexa(p, color, ALL & ~NY);
    t.hull.hexa(p, color, ALL);
  }
}

/** Übergangsbleche über den Kupplungen: vorn bündig mit dem Dach, hinten ein Hauch tiefer (darunter geschoben). */
function bleche(t: Vorlage, spec: VehicleSpec, car: number, vorn: boolean, hinten: boolean): void {
  const W = spec.halfWidth - 0.1;
  const H = spec.half;
  const gap = spec.pitch - 2 * spec.half;
  if (vorn) {
    const y = roofTop(spec, car, H);
    t.body.box(-W, W, y - 0.06, y, H, H + gap + 0.02, BLECH, PY | PZ | PX | NX);
  }
  if (hinten) {
    const y = roofTop(spec, car, -H) - 0.015;
    t.body.box(-W, W, y - 0.06, y, -H - gap, -H, BLECH, PY | NZ | PX | NX);
  }
}

/** Kupplungen (nur Zierde). */
function kupplungen(t: Vorlage, spec: VehicleSpec, vorn: boolean, hinten: boolean): void {
  const H = spec.half;
  if (vorn) t.body.box(-0.18, 0.18, 0.88, 1.12, H, H + 0.3, RAHMEN, PX | NX | PY | PZ);
  if (hinten) t.body.box(-0.18, 0.18, 0.88, 1.12, -H - 0.3, -H, RAHMEN, PX | NX | PY | NZ);
}

/** Ein Rad: Sechseck auf der Außenseite (ein Speichenfeld in Messing zeigt die Drehung), mit Lauffläche bei detail. */
function rad(t: Vorlage, s: number, yc: number, zc: number, R: number, detail: boolean): void {
  const b = t.body;
  const xo = s * 0.96;
  const xi = s * 0.76;
  const ring: V3[] = [];
  const inner: V3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    ring.push([xo, yc + R * Math.cos(a), zc + R * Math.sin(a)]);
    inner.push([xi, yc + R * Math.cos(a), zc + R * Math.sin(a)]);
  }
  b.fanOut(ring, [RAD_SPEICHE, RAD, RAD, RAD], [s, 0, 0]);
  if (detail) {
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 3;
      b.quadOut(ring[k], ring[(k + 1) % 6], inner[(k + 1) % 6], inner[k], RAD_LAUF, [0, Math.cos(a), Math.sin(a)]);
    }
  }
}

/** Fahrgestell: Drehgestelle mit je zwei Achsen (Räder auf der Spur ±0,86 m), Rahmen der Drehgestelle. */
function fahrwerk(t: Vorlage, bogies: number[], R: number, detail: boolean, rahmen: boolean, stangen: number): void {
  const b = t.body;
  const yc = 0.06 + R;
  for (const zc of bogies) {
    const first = t.axles.length / 4;
    for (const dz of [-0.85, 0.85]) {
      const id = t.axles.length / 4;
      t.axles.push(yc, zc + dz, R, stangen);
      b.ax = id;
      b.md = DREHT;
      for (const s of [1, -1]) rad(t, s, yc, zc + dz, R, detail);
    }
    if (stangen > 0 && detail) {
      // Treibstange zwischen den Kurbelzapfen beider Achsen (Zapfen bei Drehwinkel 0 vor der Achse)
      b.ax = first;
      b.md = KURBEL;
      for (const s of [1, -1]) b.sideBox(s, 0.97, 1.05, yc - 0.05, yc + 0.05, zc - 0.85 + stangen - 0.1, zc + 0.85 + stangen + 0.1, MESSING, { out: true, top: true, bottom: true, front: true, back: true });
    }
    b.ax = -1;
    b.md = 0;
    if (rahmen) {
      for (const s of [1, -1]) {
        if (detail) b.sideBox(s, 0.98, 1.12, yc - 0.12, yc + 0.16, zc - 1.3, zc + 1.3, RAHMEN, { out: true, top: true, front: true, back: true });
        else b.sideBox(s, 0.98, 1.12, yc - 0.12, yc + 0.16, zc - 1.3, zc + 1.3, RAHMEN, { out: true });
      }
    }
  }
}

/** Pfeil-Winkel (Spitze nach vorn bei zt) auf einer Fahrfläche, ein Stück darüber gelegt. */
function winkel(t: Vorlage, spec: VehicleSpec, car: number, zt: number, color: RGB, tief = 1.35, dick = 0.55): void {
  const y = (z: number): number => roofTop(spec, car, z) + 0.022;
  const breit = 1.5;
  for (const s of [1, -1]) {
    const p: V3[] = [
      [0, y(zt), zt],
      [s * breit, y(zt - tief), zt - tief],
      [s * breit, y(zt - tief - dick), zt - tief - dick],
      [0, y(zt - dick), zt - dick],
    ];
    t.marks.quadOut(p[0], p[1], p[2], p[3], color, [0, 1, 0]);
  }
}

/** Gestrichelte Mittellinie auf einer Fahrfläche. */
function mittellinie(t: Vorlage, spec: VehicleSpec, car: number, z0: number, z1: number, color: RGB): void {
  const y = (z: number): number => roofTop(spec, car, z) + 0.018;
  for (let z = z0; z + 1.4 <= z1 + 1e-6; z += 3) {
    const a = z;
    const e = z + 1.5;
    t.marks.quadOut([-0.12, y(a), a], [-0.12, y(e), e], [0.12, y(e), e], [0.12, y(a), a], color, [0, 1, 0]);
  }
}

/** Schräge gelb-schwarze Streifen auf einer senkrechten Fläche quer zur Fahrt (Stirn), bei z, von x0 bis x1. */
function warnStirn(t: Vorlage, z: number, dir: number, x0: number, x1: number, y0: number, y1: number, n: number): void {
  const w = (x1 - x0) / n;
  const sh = (y1 - y0) * 0.6;
  for (let k = 0; k < n; k++) {
    const a = x0 + k * w;
    // Parallelogramme, an den Rändern auf das Rechteck beschnitten
    const xa0 = Math.max(x0, Math.min(x1, a));
    const xb0 = Math.max(x0, Math.min(x1, a + w));
    const xa1 = Math.max(x0, Math.min(x1, a + sh));
    const xb1 = Math.max(x0, Math.min(x1, a + w + sh));
    t.marks.quadOut([xa0, y0, z], [xb0, y0, z], [xb1, y1, z], [xa1, y1, z], k % 2 ? SCHWARZ : GELB, [0, 0, dir]);
  }
}

/** Leuchtfläche: Sechseck mit hellem Kern und schwarzem (additiv: unsichtbarem) Rand, bei z nach dir. */
function hof(t: Vorlage, x: number, y: number, z: number, r: number, kern: RGB, dir: number): void {
  const g = t.glow;
  const c: V3 = [x, y, z];
  for (let k = 0; k < 6; k++) {
    const a0 = (k * Math.PI) / 3;
    const a1 = ((k + 1) * Math.PI) / 3;
    const p0: V3 = [x + r * Math.cos(a0), y + r * Math.sin(a0), z];
    const p1: V3 = [x + r * Math.cos(a1), y + r * Math.sin(a1), z];
    const n = normal(c, p0, p1);
    const ord = n[2] * dir >= 0;
    // Eckenfarben: Kern hell, Rand schwarz – von Hand, weil tri() nur eine Farbe je Dreieck kennt
    const pts: V3[] = ord ? [c, p0, p1] : [c, p1, p0];
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      g.pos.push(p[0], p[1], p[2]);
      g.nor.push(0, 0, dir);
      const col = i === 0 ? kern : ([0, 0, 0] as RGB);
      g.col.push(col[0], col[1], col[2]);
      g.axle.push(-1);
      g.mode.push(0);
    }
  }
}

// --- Die Wagen ---------------------------------------------------------------------

function flachwagen(spec: VehicleSpec, car: number, kenn: RGB, detail: boolean): Vorlage {
  const t = neueVorlage();
  const b = t.body;
  const W = spec.halfWidth;
  const H = spec.half;
  const top = roofTop(spec, car, 0);
  // Seitenwand: Langträger unten, darüber Planken in zwei Rottönen
  const bands: [number, number, RGB][] = [
    [0.85, 1.08, RAHMEN],
    [1.08, 1.32, ROT],
    [1.32, 1.56, ROT_HELL],
    [1.56, top, ROT],
  ];
  for (const s of [1, -1]) for (const [y0, y1, c] of bands) b.quadOut([s * W, y0, -H], [s * W, y0, H], [s * W, y1, H], [s * W, y1, -H], c, [s, 0, 0]);
  b.box(-W, W, 0.85, top, -H, H, ROT_DUNKEL, PZ | NZ);
  fahrflaeche(t, spec, car, DECK);
  bordleisten(t, spec, car, 0.3, -H + 0.12, H - 0.12, BORD);
  bleche(t, spec, car, true, true);
  // Unterzug zwischen den Drehgestellen (verdeckt den Durchblick unter dem Wagen)
  b.box(-0.9, 0.9, 0.5, 0.85, -2.6, 2.6, UNTEN, PX | NX | PZ | NZ);
  fahrwerk(t, [-3.9, 3.9], 0.42, detail, true, 0);
  if (detail) {
    for (const z of [-4.4, -1.5, 1.5, 4.4]) for (const s of [1, -1]) b.sideBox(s, W, W + 0.07, 0.9, top, z - 0.1, z + 0.1, RUNGE, { out: true, front: true, back: true });
    kupplungen(t, spec, true, true);
  }
  t.hull.box(-W, W, 0.85, top, -H, H, RAHMEN);
  mittellinie(t, spec, car, -H + 0.75, H - 0.75, kenn);
  return t;
}

function keilwagen(spec: VehicleSpec, car: number, kenn: RGB, detail: boolean): Vorlage {
  const t = neueVorlage();
  const b = t.body;
  const W = spec.halfWidth;
  const H = spec.half;
  const y = (z: number): number => roofTop(spec, car, z);
  const sockel = 1.2;
  // Untergestell
  for (const s of [1, -1]) b.quadOut([s * W, 0.85, -H], [s * W, 0.85, H], [s * W, sockel, H], [s * W, sockel, -H], RAHMEN, [s, 0, 0]);
  b.box(-W, W, 0.85, sockel, -H, H, RAHMEN, PZ | NZ);
  // Ladebrücke unter der Plane: Seiten in Bahnen (Gurte), Stirnseiten
  const bahnen = 4;
  for (const s of [1, -1]) {
    for (let k = 0; k < bahnen; k++) {
      const z0 = -H + (2 * H * k) / bahnen;
      const z1 = -H + (2 * H * (k + 1)) / bahnen;
      b.quadOut([s * W, sockel, z0], [s * W, sockel, z1], [s * W, y(z1), z1], [s * W, y(z0), z0], k % 2 ? PLANE_DUNKEL : PLANE, [s, 0, 0]);
    }
  }
  b.quadOut([-W, sockel, -H], [W, sockel, -H], [W, y(-H), -H], [-W, y(-H), -H], PLANE_DUNKEL, [0, 0, -1]);
  b.quadOut([-W, sockel, H], [W, sockel, H], [W, y(H), H], [-W, y(H), H], PLANE_DUNKEL, [0, 0, 1]);
  fahrflaeche(t, spec, car, DECK);
  bordleisten(t, spec, car, 0.3, -H + 0.12, H - 0.12, BORD);
  bleche(t, spec, car, true, true);
  b.box(-0.9, 0.9, 0.5, 0.85, -2.6, 2.6, UNTEN, PX | NX | PZ | NZ);
  fahrwerk(t, [-3.9, 3.9], 0.42, detail, true, 0);
  if (detail) {
    // Spanngurte über die Plane (an der Seite, nicht auf der Fläche)
    for (const z of [-3, 0, 3]) for (const s of [1, -1]) b.sideBox(s, W, W + 0.04, sockel, y(z) - 0.02, z - 0.08, z + 0.08, MESSING, { out: true, front: true, back: true });
    kupplungen(t, spec, true, true);
  }
  // Hülle für die Kontur: Keil
  const p: V3[] = [];
  for (let i = 0; i < 8; i++) {
    const z = i & 4 ? H : -H;
    p.push([i & 1 ? W : -W, i & 2 ? y(z) : 0.85, z]);
  }
  t.hull.hexa(p, RAHMEN);
  winkel(t, spec, car, -0.6, kenn);
  winkel(t, spec, car, 4.6, kenn);
  return t;
}

function rampenwagen(spec: VehicleSpec, car: number, kenn: RGB, detail: boolean): Vorlage {
  const t = neueVorlage();
  const b = t.body;
  const W = spec.halfWidth;
  const H = spec.half;
  const y = (z: number): number => roofTop(spec, car, z);
  const unten = (z: number): number => 0.03 + ((z + H) / (2 * H)) * 0.82;
  // Wangen: Unterkante von fast auf der Schiene (hinten) bis 0,85 m (vorn), Oberkante = Rampe
  for (const s of [1, -1]) b.quadOut([s * W, unten(-H), -H], [s * W, unten(H), H], [s * W, y(H), H], [s * W, y(-H), -H], KOHLE, [s, 0, 0]);
  b.quadOut([-W, unten(H), H], [W, unten(H), H], [W, y(H), H], [-W, y(H), H], KOHLE, [0, 0, 1]);
  b.quadOut([-W, unten(-H), -H], [W, unten(-H), -H], [W, y(-H), -H], [-W, y(-H), -H], GELB, [0, 0, -1]);
  fahrflaeche(t, spec, car, DECK_RAMPE);
  bordleisten(t, spec, car, 0.26, -H, H - 0.12, BORD);
  bleche(t, spec, car, true, false);
  fahrwerk(t, [3.4], 0.42, detail, true, 0);
  // hinten eine kleine Laufachse unter der Rampe
  fahrwerk(t, [-1.6], 0.24, detail, false, 0);
  if (detail) kupplungen(t, spec, true, false);
  // Hülle: der Keil
  const p: V3[] = [];
  for (let i = 0; i < 8; i++) {
    const z = i & 4 ? H : -H;
    p.push([i & 1 ? W : -W, i & 2 ? y(z) : unten(z), z]);
  }
  t.hull.hexa(p, RAHMEN);
  // Kennung: gelb-schwarze Wangen (senkrechte Bahnen, der Rampe folgend)
  const n = 15;
  for (const s of [1, -1]) {
    for (let k = 0; k < n; k++) {
      const z0 = -H + (2 * H * k) / n;
      const z1 = -H + (2 * H * (k + 1)) / n;
      const x = s * (W + 0.015);
      t.marks.quadOut([x, unten(z0), z0], [x, unten(z1), z1], [x, y(z1) - 0.02, z1], [x, y(z0) - 0.02, z0], k % 2 ? SCHWARZ : GELB, [s, 0, 0]);
    }
  }
  // Auffahrkante: schräge gelb-schwarze Streifen auf den hintersten 0,9 m der Rampe
  const yo = (z: number): number => y(z) + 0.022;
  const zs0 = -H;
  const zs1 = -H + 0.9;
  const m = 8;
  const w = (2 * (W - 0.17)) / m;
  for (let k = 0; k < m; k++) {
    const x0 = -(W - 0.17) + k * w;
    const x1 = x0 + w;
    const sh = 0.45;
    const cl = (x: number): number => Math.max(-(W - 0.17), Math.min(W - 0.17, x));
    t.marks.quadOut([cl(x0), yo(zs0), zs0], [cl(x1), yo(zs0), zs0], [cl(x1 + sh), yo(zs1), zs1], [cl(x0 + sh), yo(zs1), zs1], k % 2 ? SCHWARZ : GELB, [0, 1, 0]);
  }
  // Große Pfeil-Winkel nach vorn-oben
  for (const zt of [-2.0, 1.5, 5.0]) winkel(t, spec, car, zt, kenn, 1.6, 0.8);
  // Schlusslichter an den hinteren Enden der Bordleisten
  for (const s of [1, -1]) {
    const xa = s > 0 ? W - 0.17 : -W;
    const xb = s > 0 ? W : -W + 0.17;
    const z = -H - 0.012;
    t.marks.quadOut([xa, y(-H) + 0.02, z], [xb, y(-H) + 0.02, z], [xb, y(-H) + 0.24, z], [xa, y(-H) + 0.24, z], SCHLUSS, [0, 0, -1]);
    hof(t, s * (W - 0.085), y(-H) + 0.13, -H - 0.03, 0.75, [0.95, 0.12, 0.06], -1);
  }
  return t;
}

function lok(spec: VehicleSpec, car: number, kenn: RGB, detail: boolean): Vorlage {
  const t = neueVorlage();
  const b = t.body;
  const W = spec.halfWidth;
  const H = spec.half;
  const top = roofTop(spec, car, 0);
  const platte = top - 0.22;
  // Rahmen
  b.box(-W, W, 0.75, 1.15, -H, H, [RAHMEN, RAHMEN, RAHMEN_OBEN, RAHMEN, RAHMEN, RAHMEN], PX | NX | PY | NZ);
  // Führerhaus hinten (unter der Dachplatte)
  b.box(-W + 0.05, W - 0.05, 1.15, platte, -H, -2.3, GRUEN, PX | NX | PZ | NZ);
  // Vorbau mit dem Motor
  b.box(-1.42, 1.42, 1.15, 2.45, -2.3, 5.2, [GRUEN, GRUEN, GRUEN_DUNKEL, GRUEN, GRUEN, GRUEN], PX | NX | PY | PZ);
  // Dachplatte = Lauf- und Fahrfläche; Seiten in der Kennfarbe, Stirn schwarz (gelb-schwarz gestreift als Kennung)
  b.box(-W, W, platte, top, -H, H, [kenn, kenn, DECK, RAHMEN_OBEN, SCHWARZ, kenn], PX | NX | NY | PZ | NZ);
  fahrflaeche(t, spec, car, DECK);
  bordleisten(t, spec, car, 0.3, -H + 0.12, H - 0.75, BORD);
  bleche(t, spec, car, false, true);
  // Pufferbohle vorn, Schienenräumer
  b.box(-W, W, 0.75, 1.4, 5.2, H, SCHWARZ, PX | NX | PY | PZ);
  const raeumer: V3[] = [];
  for (let i = 0; i < 8; i++) {
    const vorn = (i & 4) !== 0;
    const hoch = (i & 2) !== 0;
    const x = (i & 1 ? 1 : -1) * (hoch ? 1.6 : 1.25);
    raeumer.push([x, hoch ? 0.75 : 0.1, vorn ? (hoch ? H + 0.05 : H + 0.45) : H - 0.1]);
  }
  b.hexa(raeumer, kenn, PX | NX | PZ);
  // Stützen der Dachplatte vorn
  for (const s of [1, -1]) b.sideBox(s, 1.62, 1.78, 1.4, platte, 5.35, 5.55, RAHMEN, { out: true, inn: true, front: true, back: true });
  // Stirnlampe unter der Dachplatte
  b.box(-0.36, 0.36, 1.72, 2.38, 5.2, 5.7, RAHMEN, PX | NX | PY | PZ);
  const linse: V3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    linse.push([0.26 * Math.cos(a), 2.05 + 0.26 * Math.sin(a), 5.715]);
  }
  t.marks.fanOut(linse, [LINSE], [0, 0, 1]);
  hof(t, 0, 2.05, 5.75, 1.05, [1.0, 0.86, 0.52], 1);
  // Gemalter Lichtkegel auf dem Gleis: hell an der Lok, nach 14 m ausgeblendet
  const kegel: [number, number, number][] = [
    [H + 0.5, 0.75, 0.55],
    [H + 6.5, 1.7, 0.32],
    [H + 14.5, 2.7, 0],
  ];
  for (let k = 0; k + 1 < kegel.length; k++) {
    const [z0, w0, c0] = kegel[k];
    const [z1, w1, c1] = kegel[k + 1];
    const col0: RGB = [c0, c0 * 0.86, c0 * 0.5];
    const col1: RGB = [c1, c1 * 0.86, c1 * 0.5];
    const pts: [V3, RGB][] = [
      [[-w0, 0.07, z0], col0],
      [[w0, 0.07, z0], col0],
      [[w1, 0.07, z1], col1],
      [[-w1, 0.07, z1], col1],
    ];
    for (const i of [0, 2, 1, 0, 3, 2]) {
      const [p, c] = pts[i];
      t.glow.pos.push(p[0], p[1], p[2]);
      t.glow.nor.push(0, 1, 0);
      t.glow.col.push(c[0], c[1], c[2]);
      t.glow.axle.push(-1);
      t.glow.mode.push(0);
    }
  }
  // Fenster des Führerhauses, Messinglinie am Rahmen, Kennung an der Stirn, Absprungkante
  for (const s of [1, -1]) {
    const x = s * (W - 0.035);
    for (const [z0, z1] of [
      [-5.5, -4.3],
      [-3.9, -2.75],
    ]) {
      t.marks.quadOut([x, 1.85, z0], [x, 1.85, z1], [x, 2.45, z1], [x, 2.45, z0], GLAS, [s, 0, 0]);
      t.marks.quadOut([x + s * 0.002, 2.3, z0 + 0.1], [x + s * 0.002, 2.3, z1 - 0.1], [x + s * 0.002, 2.38, z1 - 0.1], [x + s * 0.002, 2.38, z0 + 0.1], GLAS_HELL, [s, 0, 0]);
    }
    t.marks.quadOut([s * (W + 0.012), 1.0, -H + 0.1], [s * (W + 0.012), 1.0, H - 0.1], [s * (W + 0.012), 1.08, H - 0.1], [s * (W + 0.012), 1.08, -H + 0.1], MESSING, [s, 0, 0]);
  }
  // Pufferbohle schlicht schwarz mit zwei kleinen Signallampen; gelb-schwarz nur an der Dachkante (Absprung)
  for (const s of [1, -1]) {
    const l: V3[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      l.push([s * 1.35 + 0.13 * Math.cos(a), 1.08 + 0.13 * Math.sin(a), H + 0.012]);
    }
    t.marks.fanOut(l, [LINSE], [0, 0, 1]);
    hof(t, s * 1.35, 1.08, H + 0.03, 0.42, [0.7, 0.62, 0.4], 1);
  }
  warnStirn(t, H + 0.012, 1, -W, W, platte + 0.02, top - 0.02, 12);
  const yk = top + 0.02;
  t.marks.quadOut([-(W - 0.17), yk, H - 0.55], [-(W - 0.17), yk, H - 0.08], [W - 0.17, yk, H - 0.08], [W - 0.17, yk, H - 0.55], GELB, [0, 1, 0]);
  mittellinie(t, spec, car, -H + 0.75, H - 2.25, kenn);
  // Fahrwerk mit Treibstangen
  fahrwerk(t, [-3.4, 3.0], 0.48, detail, false, 0.18);
  if (detail) {
    // Lüftungsschlitze am Vorbau
    for (const s of [1, -1]) {
      for (const z0 of [-1.6, -0.4, 0.8]) t.marks.quadOut([s * 1.435, 1.6, z0], [s * 1.435, 1.6, z0 + 0.8], [s * 1.435, 2.2, z0 + 0.8], [s * 1.435, 2.2, z0], GRUEN_DUNKEL, [s, 0, 0]);
    }
    // Auspuff: senkrechtes Rohr am Vorbau, oben ein Knie nach außen – unter der Kante der Dachplatte
    for (const s of [1, -1]) {
      b.sideBox(s, 1.42, 1.6, 1.5, 2.5, 3.2, 3.45, MESSING, { out: true, front: true, back: true });
      b.sideBox(s, 1.42, 2.04, 2.42, 2.6, 3.2, 3.45, MESSING, { out: true, top: true, bottom: true, front: true, back: true });
      t.auspuff.push([s * 2.06, 2.52, 3.33]);
    }
    // Glocke unter der Dachplatte
    b.box(0.72, 1.02, 2.3, 2.62, 5.42, 5.74, MESSING, ALL & ~PY);
    b.box(0.84, 0.9, 2.62, platte, 5.55, 5.61, RAHMEN, PX | NX | PZ | NZ);
    kupplungen(t, spec, false, true);
  }
  // Hülle für die Kontur
  t.hull.box(-W, W, 0.75, 1.15, -H, H, RAHMEN);
  t.hull.box(-W + 0.05, W - 0.05, 1.15, platte, -H, -2.3, RAHMEN);
  t.hull.box(-1.42, 1.42, 1.15, 2.45, -2.3, 5.2, RAHMEN);
  t.hull.box(-W, W, platte, top, -H, H, RAHMEN);
  t.hull.box(-W, W, 0.75, 1.4, 5.2, H, RAHMEN);
  return t;
}

// --- Gleis -------------------------------------------------------------------------

interface GleisBau {
  geo: THREE.BufferGeometry;
  /** Ecken von Schwellen und Schienen: [von, bis) – das eigentliche Gleis (ohne Bett und Warnlinie). */
  von: number;
  bis: number;
}

/** Lage des Gleises: Spurmitte, Spurweite und Bett (Meter seitlich, rechts positiv). */
const GLEIS_MITTE = 6.7;
const SPUR = 0.8;
const SCHIENE_BREIT = 0.05;
const SCHWELLE_HALB = 0.88;
const BETT_LINKS = 4.8;
const WARN_BREIT = 0.26;

function buildGleis(t: Track, detail: boolean): GleisBau {
  const n = t.n;
  const pos: number[] = [];
  const col: number[] = [];
  // Punkt bei Abschnitt u (gebrochen), seitlich lat, h über der Fahrbahn
  const pt = (u: number, lat: number, h: number): V3 => {
    const uu = ((u % n) + n) % n;
    const i = Math.floor(uu);
    const f = uu - i;
    const j = t.next[i];
    const tx = t.tx[i] + (t.tx[j] - t.tx[i]) * f;
    const tz = t.tz[i] + (t.tz[j] - t.tz[i]) * f;
    const k = 1 / Math.hypot(tx, tz);
    const rx = -tz * k;
    const rz = tx * k;
    const bank = t.bank[i] + (t.bank[j] - t.bank[i]) * f;
    const along = f * t.step;
    return [t.px[i] + t.tx[i] * along + rx * lat, t.py[i] + (t.py[j] - t.py[i]) * f + lat * bank + h, t.pz[i] + t.tz[i] * along + rz * lat];
  };
  const dunkel = (c: RGB, u: number): RGB => {
    const i = ((Math.floor(u) % n) + n) % n;
    return t.edge[i] & EDGE_TUNNEL ? [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45] : c;
  };
  const quad = (a: V3, b: V3, c: V3, d: V3, color: RGB): void => {
    for (const p of [a, b, c, a, c, d]) {
      pos.push(p[0], p[1], p[2]);
      col.push(color[0], color[1], color[2]);
    }
  };
  // Schwellen
  const abstand = detail ? 1.25 : 2.5;
  const schwellen = Math.floor(n / abstand);
  for (let k = 0; k < schwellen; k++) {
    const u = k * ((n * 1) / schwellen);
    const a = u - 0.14;
    const e = u + 0.14;
    const l0 = GLEIS_MITTE - SCHWELLE_HALB;
    const l1 = GLEIS_MITTE + SCHWELLE_HALB;
    quad(pt(a, l0, 0.03), pt(a, l1, 0.03), pt(e, l1, 0.03), pt(e, l0, 0.03), dunkel(SCHWELLE, u));
  }
  // Schienen (zwei Bänder)
  const schritt = detail ? 3 : 4;
  const stuecke = Math.ceil(n / schritt);
  const us = (k: number): number => (k >= stuecke ? n : k * schritt);
  for (let k = 0; k < stuecke; k++) {
    const a = us(k);
    const e = us(k + 1);
    for (const m of [GLEIS_MITTE - SPUR, GLEIS_MITTE + SPUR]) quad(pt(a, m - SCHIENE_BREIT, 0.055), pt(a, m + SCHIENE_BREIT, 0.055), pt(e, m + SCHIENE_BREIT, 0.055), pt(e, m - SCHIENE_BREIT, 0.055), dunkel(SCHIENE, a));
  }
  const bis = pos.length / 3;
  // Gleisbett bis kurz vor die Bande, links davon die Warnlinie (gelb-schwarz)
  for (let k = 0; k < stuecke; k++) {
    const a = us(k);
    const e = us(k + 1);
    const rand = Math.min(t.wh[((Math.floor(a) % n) + n) % n], t.wh[((Math.floor(e) % n) + n) % n]) - 0.15;
    quad(pt(a, BETT_LINKS + WARN_BREIT, 0.008), pt(a, rand, 0.008), pt(e, rand, 0.008), pt(e, BETT_LINKS + WARN_BREIT, 0.008), dunkel(SCHOTTER, a));
    const mitte = (a + e) / 2;
    quad(pt(a, BETT_LINKS, 0.01), pt(a, BETT_LINKS + WARN_BREIT, 0.01), pt(mitte, BETT_LINKS + WARN_BREIT, 0.01), pt(mitte, BETT_LINKS, 0.01), dunkel(WARN_GELB, a));
    quad(pt(mitte, BETT_LINKS, 0.01), pt(mitte, BETT_LINKS + WARN_BREIT, 0.01), pt(e, BETT_LINKS + WARN_BREIT, 0.01), pt(e, BETT_LINKS, 0.01), dunkel(WARN_SCHWARZ, a));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return { geo, von: 0, bis };
}

// --- Zusammensetzen ----------------------------------------------------------------

/** Eine Schicht aller Wagen: Ecken im Wagenraum und das bewegliche Netz in Weltkoordinaten. */
interface Schicht {
  local: Float32Array;
  lnor: Float32Array | null;
  axle: Int16Array;
  mode: Uint8Array;
  pos: THREE.BufferAttribute;
  nor: THREE.BufferAttribute | null;
  geo: THREE.BufferGeometry;
}

interface Wagen {
  v: Vehicle;
  zug: number;
  car: number;
  /** [von, bis) je Schicht: Körper, Hülle, Kennung, Licht. */
  r: number[];
  axleBase: number;
  axleCount: number;
  auspuff: V3[];
}

/** Daten für den Test: wo die Fahrfläche jedes Wagens im Körpernetz steht. */
export interface ZugDach {
  zug: number;
  car: number;
  v: Vehicle;
  /** Eckindizes im Körpernetz: rechts hinten, links hinten, rechts vorn, links vorn. */
  ecken: number[];
  /** Mitte (du = 0): rechts, links. */
  mitte: number[];
}

function schicht(teile: Bau[], normals: 'flat' | 'smooth' | 'none'): Schicht {
  let count = 0;
  for (const b of teile) count += b.count;
  const local = new Float32Array(count * 3);
  const axle = new Int16Array(count);
  const mode = new Uint8Array(count);
  const color = new Float32Array(count * 3);
  let lnor: Float32Array | null = normals === 'none' ? null : new Float32Array(count * 3);
  let o = 0;
  for (const b of teile) {
    local.set(b.pos, o * 3);
    color.set(b.col, o * 3);
    if (lnor && normals === 'flat') lnor.set(b.nor, o * 3);
    for (let i = 0; i < b.count; i++) {
      axle[o + i] = b.axle[i];
      mode[o + i] = b.mode[i];
    }
    o += b.count;
  }
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  pos.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pos);
  let nor: THREE.BufferAttribute | null = null;
  if (normals === 'smooth') {
    // Geglättete Normalen der Kontur im Wagenraum (wie addSmoothNormals), je Bild mitgedreht
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute('position', new THREE.BufferAttribute(local, 3));
    tmp.computeVertexNormals();
    addSmoothNormals(tmp);
    lnor = (tmp.getAttribute('onormal') as THREE.BufferAttribute).array as Float32Array;
    tmp.deleteAttribute('position');
    tmp.dispose();
    nor = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    nor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('onormal', nor);
  } else if (normals === 'flat') {
    nor = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    nor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('normal', nor);
  }
  if (normals !== 'smooth') geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return { local, lnor, axle, mode, pos, nor, geo };
}

export function buildTrain(track: Track, detail: boolean): MechanicView {
  const group = new THREE.Group();
  group.name = 'zuege';
  const zuege = track.vehicles.filter((v) => v.roofs);
  const wagen: Wagen[] = [];
  const daecher: ZugDach[] = [];
  const teile: Bau[][] = [[], [], [], []];
  const axles: number[] = [];
  const zaehler = [0, 0, 0, 0];

  zuege.forEach((v, zug) => {
    const kenn = rgb(KENN[zug % KENN.length]);
    const vorlagen = new Map<string, Vorlage>();
    for (let car = 0; car < v.cars; car++) {
      const r = v.roofs![Math.min(car, v.roofs!.length - 1)];
      const art = car === 0 ? 'lok' : car === v.cars - 1 ? 'rampe' : r[0] !== r[1] ? 'keil' : 'flach';
      // Flachwagen teilen sich die Vorlage (gleiche Ecken), jeder Wagen bekommt aber eigene Bereiche im Netz
      const key = art === 'flach' ? 'flach' : `${art}${car}`;
      let t = vorlagen.get(key);
      if (!t) {
        t = art === 'lok' ? lok(v, car, kenn, detail) : art === 'rampe' ? rampenwagen(v, car, kenn, detail) : art === 'keil' ? keilwagen(v, car, kenn, detail) : flachwagen(v, car, kenn, detail);
        vorlagen.set(key, t);
      }
      const layers = [t.body, t.hull, t.marks, t.glow];
      const r4: number[] = [];
      layers.forEach((b, k) => {
        r4.push(zaehler[k], zaehler[k] + b.count);
        zaehler[k] += b.count;
      });
      const axleBase = axles.length / 4;
      // Achsnummern der Vorlage auf die gemeinsame Tabelle umrechnen
      const versetzt = (b: Bau): Bau => {
        if (axleBase === 0 || !b.axle.some((a) => a >= 0)) return b;
        const c = new Bau();
        c.pos.push(...b.pos);
        c.nor.push(...b.nor);
        c.col.push(...b.col);
        c.mode.push(...b.mode);
        for (const a of b.axle) c.axle.push(a >= 0 ? a + axleBase : -1);
        return c;
      };
      layers.forEach((b, k) => teile[k].push(versetzt(b)));
      axles.push(...t.axles);
      wagen.push({ v, zug, car, r: r4, axleBase, axleCount: t.axles.length / 4, auspuff: t.auspuff });
      daecher.push({ zug, car, v, ecken: t.ecken.map((i) => i + r4[0]), mitte: t.mitte.map((i) => i + r4[0]) });
    }
  });

  const body = schicht(teile[0], 'flat');
  const hull = detail ? schicht(teile[1], 'smooth') : null;
  const marks = schicht(teile[2], 'none');
  const glow = schicht(teile[3], 'none');
  const axleTab = new Float64Array(axles);
  const axCos = new Float64Array(axles.length / 4);
  const axSin = new Float64Array(axles.length / 4);

  const bodyMat = toonMaterial({ vertexColors: true });
  const bodyMesh = new THREE.Mesh(body.geo, bodyMat);
  bodyMesh.name = 'zug-koerper';
  bodyMesh.frustumCulled = false;
  group.add(bodyMesh);
  let hullMesh: THREE.Mesh | null = null;
  if (hull) {
    hullMesh = new THREE.Mesh(hull.geo, outlineMaterial(0.05));
    hullMesh.name = 'outline';
    hullMesh.frustumCulled = false;
    group.add(hullMesh);
  }
  const marksMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const marksMesh = new THREE.Mesh(marks.geo, marksMat);
  marksMesh.name = 'zug-kennung';
  marksMesh.frustumCulled = false;
  group.add(marksMesh);
  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  const glowMesh = new THREE.Mesh(glow.geo, glowMat);
  glowMesh.name = 'zug-licht';
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 2;
  group.add(glowMesh);

  const gleis = buildGleis(track, detail);
  const gleisMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 });
  const gleisMesh = new THREE.Mesh(gleis.geo, gleisMat);
  gleisMesh.name = 'gleis';
  group.add(gleisMesh);

  group.userData.zugKoerper = bodyMesh;
  group.userData.zugDaecher = daecher;
  group.userData.gleis = { mesh: gleisMesh, von: gleis.von, bis: gleis.bis };

  const pose = newVehiclePose();

  /** Setzt die Ecken [a, b) einer Schicht für einen Wagen (Lage px…, Richtung hx/hz, Steigung sl). */
  function setze(L: Schicht, a: number, b: number, px: number, py: number, pz: number, hx: number, hz: number, sl: number): void {
    const src = L.local;
    const dst = L.pos.array as Float32Array;
    const ns = L.lnor;
    const nd = L.nor ? (L.nor.array as Float32Array) : null;
    for (let i = a; i < b; i++) {
      const i3 = i * 3;
      let x = src[i3];
      let y = src[i3 + 1];
      let z = src[i3 + 2];
      let nx = 0;
      let ny = 0;
      let nz = 0;
      if (ns) {
        nx = ns[i3];
        ny = ns[i3 + 1];
        nz = ns[i3 + 2];
      }
      const k = L.axle[i];
      if (k >= 0) {
        const c = axCos[k];
        const s = axSin[k];
        const yc = axleTab[k * 4];
        const zc = axleTab[k * 4 + 1];
        if (L.mode[i] === DREHT) {
          const dy = y - yc;
          const dz = z - zc;
          y = yc + dy * c - dz * s;
          z = zc + dz * c + dy * s;
          const my = ny * c - nz * s;
          nz = nz * c + ny * s;
          ny = my;
        } else {
          const rc = axleTab[k * 4 + 3];
          y -= rc * s;
          z += rc * (c - 1);
        }
      }
      // Wagenraum → Welt: x nach links, z nach vorn; die Steigung schert (wie die Physik), statt zu kippen
      dst[i3] = px + x * hz + z * hx;
      dst[i3 + 1] = py + y + z * sl;
      dst[i3 + 2] = pz - x * hx + z * hz;
      if (nd) {
        nd[i3] = nx * hz + nz * hx;
        nd[i3 + 1] = ny;
        nd[i3 + 2] = -nx * hx + nz * hz;
      }
    }
  }

  let puffTakt = -1;
  let puffSeite = 0;

  return {
    group,
    update(time, seconds, _dt, cam, fx) {
      const takt = Math.floor(seconds * 7);
      const puffen = detail && takt !== puffTakt;
      puffTakt = takt;
      if (puffen) puffSeite ^= 1;
      for (const w of wagen) {
        const p = vehiclePose(track, w.v, w.car, time, pose);
        const hx = Math.sin(p.heading);
        const hz = Math.cos(p.heading);
        // Räder: Drehwinkel aus dem zurückgelegten Weg (reine Funktion der Rennzeit)
        const weg = w.v.offset + (w.v.speed * time) / 60;
        for (let k = 0; k < w.axleCount; k++) {
          const g = w.axleBase + k;
          const a = (weg / axleTab[g * 4 + 2]) % (2 * Math.PI);
          axCos[g] = Math.cos(a);
          axSin[g] = Math.sin(a);
        }
        setze(body, w.r[0], w.r[1], p.x, p.y, p.z, hx, hz, p.slope);
        if (hull) setze(hull, w.r[2], w.r[3], p.x, p.y, p.z, hx, hz, p.slope);
        setze(marks, w.r[4], w.r[5], p.x, p.y, p.z, hx, hz, p.slope);
        setze(glow, w.r[6], w.r[7], p.x, p.y, p.z, hx, hz, p.slope);
        if (puffen && w.auspuff.length > 0) {
          const dx = p.x - cam.x;
          const dz = p.z - cam.z;
          if (dx * dx + dz * dz < 160 * 160) {
            const q = w.auspuff[puffSeite % w.auspuff.length];
            const out = q[0] > 0 ? 1 : -1;
            const wx = p.x + q[0] * hz + q[2] * hx;
            const wy = p.y + q[1] + q[2] * p.slope;
            const wz = p.z - q[0] * hx + q[2] * hz;
            const v = w.v.speed * 0.8;
            // seitlich weg vom Dach, damit die Stöße niemandem auf dem Zug die Sicht nehmen
            fx.puff(wx, wy, wz, hx * v + out * hz * 3.2, 0.7, hz * v - out * hx * 3.2, 0.75, 0.3, ABGAS, 0.9, -0.8);
          }
        }
      }
      body.pos.needsUpdate = true;
      if (body.nor) body.nor.needsUpdate = true;
      if (hull) {
        hull.pos.needsUpdate = true;
        if (hull.nor) hull.nor.needsUpdate = true;
      }
      marks.pos.needsUpdate = true;
      glow.pos.needsUpdate = true;
    },
    dispose() {
      body.geo.dispose();
      hull?.geo.dispose();
      marks.geo.dispose();
      glow.geo.dispose();
      gleis.geo.dispose();
      bodyMat.dispose();
      marksMat.dispose();
      glowMat.dispose();
      gleisMat.dispose();
      // Die Kontur teilt ihr Material mit der ganzen Szene (outlineMaterial) – nicht freigeben.
    },
  };
}
