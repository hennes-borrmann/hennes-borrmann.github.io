// Kulisse des Dschungel-Flusses: ein Regenwald, in dem es brummt.
//
// Vier Stimmungen, deutlich gegeneinander gesetzt:
//  · Stelzendorf am Hochufer (Start/Ziel): Pfahlbauten aus Holz und Palmblatt, ein Hängesteg hoch
//    über der Bohlenstraße, Wimpelketten, Wäsche, Körbe, Trommeln, eine Feuerstelle mit Rauch, ein
//    Bootsbauer am halbfertigen Einbaum, winkende Dorfbewohner, ein Ausguck mit Fahne.
//  · Regenwald (Pfad hinunter und Hang hinauf): Urwaldriesen mit Brettwurzeln und Schirmkronen,
//    Palmen, Baumfarne, Bananenstauden, Farne, Lianen, bemooste Stämme, leuchtende Blüten, Pilze;
//    Lichtkegel fallen schräg durchs Blätterdach, Affen schwingen an Lianen, Tukane und Papageien
//    fliegen auf, Schmetterlinge tanzen, Blätter fallen. Am Hang dazu überwucherte Ruinen, eine
//    Hängebrücke über einen Seitenbach, Nebel in den Kronen und der Blick bis zu fernen Tafelbergen.
//  · Fluss und Wasserfall: Ufer mit Mangroven, Schilf, überhängenden Bäumen, Felsen, Seerosen, einem
//    halb versunkenen Boot, Reihern, einem Krokodil auf der Sandbank, Libellen; am Einstieg das
//    Anleger-Häuschen. Am Fall Felswände, moosige Vorsprünge, zwei steinerne Wächter an der Kante,
//    ein Regenbogen in der Gischt, Uferfelsen ums Becken.
//  · Die Furt: offen und hell – Kiesbänke, Treibholz, hohe Gräser, Reiher, Wasserschweine.
//
// Wasser, Flöße und den fallenden Wasservorhang zeichnet render/mechanics/river.ts – hier nur, was
// drumherum steht. Alles steht auf dem Gelände (world.heightAt), mindestens 3 m neben der
// Fahrbahnkante, am Fluss mindestens 12,4 m von der Mittellinie; über der Fahrbahn nichts tiefer
// als 10 m.
//
// Technik (harte Vorgabe, siehe toon.ts): nur Eckenfarben, Toon-Material mit Kontur,
// MeshBasicMaterial, Instanzen und ein Netz mit je Bild neu gesetzten Ecken – keine eigenen Shader,
// keine Texturen, keine Lichtquellen. Alles, was sich bewegt (Affen, Vögel, Dorfbewohner, Wimpel,
// Reiher, Krokodil …), steckt in EINEM Netz, dessen Ecken je Bild aus einer Grundform und der Lage
// jedes Teils berechnet werden; Schmetterlinge, Libellen und fallende Blätter sind Instanzen eines
// einzigen Flügels. Im Lauf wird nichts angelegt.

import * as THREE from 'three';
import { EDGE_RIVER, rightX, rightZ } from '../../game/track';
import { seeded, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Wasserspiegel des Flusses unter den Floßdecks (wie RIVER_WATER in world.ts). */
const RIVER_WATER = 0.45;
/** So weit von der Mittellinie des Flusses beginnt die Kulisse (4 m außerhalb der äußeren Floßbahn). */
const RIVER_FREE = 12.4;

// --- Werkzeug: Flächen sammeln, mit Lage ------------------------------------------

const tv = new THREE.Vector3();
const tp = new THREE.Vector3();
const ts = new THREE.Vector3();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tm = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/** Wie MeshBuilder, aber jede Fläche geht durch die aktuelle Lage (m). */
class Bau {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly m = new THREE.Matrix4();

  get verts(): number {
    return this.pos.length / 3;
  }

  /** Lage für alle folgenden Flächen: verschoben und um die Hochachse gedreht. */
  lage(x: number, y: number, z: number, rotY = 0): this {
    this.m.makeRotationY(rotY);
    this.m.setPosition(x, y, z);
    return this;
  }

  frei(): this {
    this.m.identity();
    return this;
  }

  private p(x: number, y: number, z: number): void {
    tv.set(x, y, z).applyMatrix4(this.m);
    this.pos.push(tv.x, tv.y, tv.z);
  }

  tri(a: V3, b: V3, c: V3, color: RGB): void {
    this.p(a[0], a[1], a[2]);
    this.p(b[0], b[1], b[2]);
    this.p(c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(color[0], color[1], color[2]);
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: RGB): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Viereck mit eigener Farbe je Ecke (Verläufe: Lichtkegel, Nebel, Regenbogen). */
  quadV(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    const pts: V3[] = [a, b, c, a, c, d];
    const cols: RGB[] = [ca, cb, cc, ca, cc, cd];
    for (let k = 0; k < 6; k++) {
      this.p(pts[k][0], pts[k][1], pts[k][2]);
      this.col.push(cols[k][0], cols[k][1], cols[k][2]);
    }
  }

  /** Dreieck mit eigener Farbe je Ecke. */
  triV(a: V3, b: V3, c: V3, ca: RGB, cb: RGB, cc: RGB): void {
    this.p(a[0], a[1], a[2]);
    this.p(b[0], b[1], b[2]);
    this.p(c[0], c[1], c[2]);
    this.col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
  }

  /** Viereck, dessen Vorderseite von ref weg (aus = true) bzw. zu ref hin zeigt. */
  flaeche(a: V3, b: V3, c: V3, d: V3, color: RGB, ref: V3, aus = true): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const gx = (a[0] + c[0]) / 2 - ref[0];
    const gy = (a[1] + c[1]) / 2 - ref[1];
    const gz = (a[2] + c[2]) / 2 - ref[2];
    if (nx * gx + ny * gy + nz * gz >= 0 === aus) this.quad(a, b, c, d, color);
    else this.quad(d, c, b, a, color);
  }

  /** Dreieck wie flaeche(). */
  dreieck(a: V3, b: V3, c: V3, color: RGB, ref: V3, aus = true): void {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const g = nx * ((a[0] + b[0] + c[0]) / 3 - ref[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - ref[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - ref[2]);
    if (g >= 0 === aus) this.tri(a, b, c, color);
    else this.tri(a, c, b, color);
  }

  /** Quader um (cx, cy, cz), um die Hochachse gedreht. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB, boden = true): void {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const q = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const v = [q(-hx, -hy, -hz), q(hx, -hy, -hz), q(hx, hy, -hz), q(-hx, hy, -hz), q(-hx, -hy, hz), q(hx, -hy, hz), q(hx, hy, hz), q(-hx, hy, hz)];
    this.quad(v[4], v[5], v[6], v[7], color);
    this.quad(v[1], v[0], v[3], v[2], color);
    this.quad(v[5], v[1], v[2], v[6], color);
    this.quad(v[0], v[4], v[7], v[3], color);
    this.quad(v[7], v[6], v[2], v[3], top ?? color);
    if (boden) this.quad(v[0], v[1], v[5], v[4], color);
  }

  /** Quader ohne Boden (steht auf etwas). */
  klotz(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
    this.box(cx, cy, cz, sx, sy, sz, color, rotY, top, false);
  }

  /** Fertige three.js-Geometrie, einfarbig, mit eigener Lage (Euler YXZ) in der aktuellen Lage. */
  geo(g: THREE.BufferGeometry, color: RGB, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): void {
    te.set(rx, ry, rz, 'YXZ');
    tq.setFromEuler(te);
    tm.compose(tp.set(x, y, z), tq, ts.set(sx, sy, sz));
    this.geoM(g, color, tm);
  }

  geoM(g: THREE.BufferGeometry, color: RGB, local: THREE.Matrix4): void {
    local.premultiply(this.m);
    const src = g.index ? g.toNonIndexed() : g;
    const pa = src.getAttribute('position');
    for (let i = 0; i < pa.count; i++) {
      tv.fromBufferAttribute(pa, i).applyMatrix4(local);
      this.pos.push(tv.x, tv.y, tv.z);
      this.col.push(color[0], color[1], color[2]);
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  /** Balken mit n-eckigem Querschnitt (Standard: dreikantig, offen – 6 Dreiecke) von a nach c. */
  stab(a: V3, c: V3, d: number, color: RGB, n = 3): void {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    tq.setFromUnitVectors(UP, tv.set(dx / len, dy / len, dz / len));
    tm.compose(tp.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), tq, ts.set(d, len, d));
    this.geoM(n === 4 ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.5, 0.5, 1, n, 1, true), color, tm);
  }

  /** Sechskantige Säule ohne Boden, Deckel in eigener Farbe (16 Dreiecke). */
  prisma(r0: number, r1: number, h: number, color: RGB, deckel: RGB, rot = 0): void {
    const P = (k: number, r: number, y: number): V3 => [Math.cos(rot + (k * Math.PI) / 3) * r, y, Math.sin(rot + (k * Math.PI) / 3) * r];
    for (let k = 0; k < 6; k++) this.quad(P(k + 1, r0, 0), P(k, r0, 0), P(k, r1, h), P(k + 1, r1, h), k % 2 ? color : [color[0] * 0.88, color[1] * 0.88, color[2] * 0.88]);
    for (let k = 1; k < 5; k++) this.tri(P(0, r1, h), P(k + 1, r1, h), P(k, r1, h), deckel);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Durchscheinendes mit eigener Deckkraft je Ecke (Nebel, Regenbogen): Farben mit Alpha. */
type RGBA = [number, number, number, number];
class Hauch {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  get verts(): number {
    return this.pos.length / 3;
  }

  tri(a: V3, b: V3, c: V3, ca: RGBA, cb: RGBA, cc: RGBA): void {
    this.pos.push(...a, ...b, ...c);
    this.col.push(...ca, ...cb, ...cc);
  }

  quad(a: V3, b: V3, c: V3, d: V3, ca: RGBA, cb: RGBA, cc: RGBA, cd: RGBA): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 4));
    g.computeBoundingSphere();
    return g;
  }
}

// --- Bewegte Teile ------------------------------------------------------------------

/** 0 = starr, 2 = Fahne (am Mast fest, das freie Ende weht), 3 = Kette (am Seil fest, was darunter hängt, weht). */
type Art = 0 | 2 | 3;

interface Teil {
  v0: number;
  v1: number;
  art: Art;
  /** Lage des Teils in der Welt (je Bild gesetzt). */
  m: THREE.Matrix4;
  /** Fahne/Kette: Länge, Ausschlag, Wellenzahl, Takt, Phase. */
  len: number;
  amp: number;
  k: number;
  w: number;
  ph: number;
  /** Kette: Höhenunterschied der Enden und Durchhang (die Seillinie bleibt fest). */
  dy: number;
  sag: number;
}

class Teile extends Bau {
  readonly liste: Teil[] = [];
  private start = 0;

  beginn(): void {
    this.frei();
    this.start = this.verts;
  }

  ende(art: Art, tuch?: { len: number; amp: number; k: number; w: number; ph: number; dy?: number; sag?: number }): number {
    this.liste.push({
      v0: this.start,
      v1: this.verts,
      art,
      m: new THREE.Matrix4(),
      len: tuch?.len ?? 1,
      amp: tuch?.amp ?? 0,
      k: tuch?.k ?? 0,
      w: tuch?.w ?? 0,
      ph: tuch?.ph ?? 0,
      dy: tuch?.dy ?? 0,
      sag: tuch?.sag ?? 0,
    });
    return this.liste.length - 1;
  }
}

/** Geglättete Normalen je Teil (für die Kontur); Tücher bekommen keine. */
function glatteNormalen(pos: Float32Array, nor: Float32Array, teile: Teil[]): Float32Array {
  const out = new Float32Array(pos.length);
  const sums = new Map<string, number[]>();
  const key = (i: number): string => `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
  for (const p of teile) {
    if (p.art !== 0) continue;
    sums.clear();
    for (let i = p.v0; i < p.v1; i++) {
      const k = key(i);
      const s = sums.get(k);
      if (s) {
        s[0] += nor[i * 3];
        s[1] += nor[i * 3 + 1];
        s[2] += nor[i * 3 + 2];
      } else sums.set(k, [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]]);
    }
    for (let i = p.v0; i < p.v1; i++) {
      const s = sums.get(key(i))!;
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      out[i * 3] = s[0] / l;
      out[i * 3 + 1] = s[1] / l;
      out[i * 3 + 2] = s[2] / l;
    }
  }
  return out;
}

// --- Farben -------------------------------------------------------------------------

const C = {
  rinde: rgb(0x6b4a32),
  rindeD: rgb(0x4a3222),
  rindeH: rgb(0x8f6e4c),
  laub: [rgb(0x2f7d3a), rgb(0x3c8f3f), rgb(0x2a6b35), rgb(0x4a9a3a), rgb(0x24602e), rgb(0x3a7a2a)],
  laubD: rgb(0x1f4f28),
  moos: rgb(0x5f9e3a),
  farn: rgb(0x3f9a45),
  farnD: rgb(0x2b7536),
  farnH: rgb(0x6cbf4a),
  palme: rgb(0x8c7655),
  palmeD: rgb(0x6a573c),
  wedel: rgb(0x4f9f3c),
  wedelD: rgb(0x3a8030),
  banane: rgb(0x5fb048),
  lian: rgb(0x40582a),
  holz: rgb(0x9a7048),
  holzD: rgb(0x6a4a2c),
  holzH: rgb(0xc49a66),
  pfahl: rgb(0x5e4230),
  stroh: rgb(0xc9a65a),
  strohD: rgb(0xa08040),
  palmdach: rgb(0x8a9a44),
  palmdachD: rgb(0x6a7a30),
  wand: rgb(0xb8925e),
  wandD: rgb(0x8a6a40),
  tuer: rgb(0x3a2a20),
  fels: rgb(0x6c6a5c),
  felsD: rgb(0x4e4d44),
  felsH: rgb(0x8a8674),
  stein: rgb(0x9c9686),
  steinD: rgb(0x75705f),
  sand: rgb(0xe3d2a2),
  kies: rgb(0xbdb196),
  kiesD: rgb(0x9a907a),
  treib: rgb(0xcdbd9c),
  treibD: rgb(0xa8987a),
  gras: rgb(0x9ab84a),
  grasH: rgb(0xc8cf6a),
  schilf: rgb(0x6f9a3a),
  kolben: rgb(0x6a4628),
  seerose: rgb(0x3f9a4a),
  bach: rgb(0x4aa0b8),
  schaum: rgb(0xeaf6f2),
  haut: [rgb(0x8a5a3a), rgb(0x6a4028), rgb(0xa8744a), rgb(0x7a4a30)],
  stoff: [rgb(0xd8433a), rgb(0xf2c230), rgb(0x2f9a8f), rgb(0xe8642c), rgb(0x7a4ad8), rgb(0xf2efe6), rgb(0x2f6fb0)],
  schwarz: rgb(0x22202a),
  weiss: rgb(0xf4f1e8),
  pilz: rgb(0xe8742c),
  pilzH: rgb(0xf6e7c8),
  affe: rgb(0x6a4a2e),
  affeH: rgb(0xd8b48a),
  reiher: rgb(0xe8eef0),
  reiherD: rgb(0x8a96a0),
  gelb: rgb(0xf2c230),
  orange: rgb(0xf08a2a),
  rot: rgb(0xd8433a),
  blau: rgb(0x2f6fb0),
  kroko: rgb(0x4f6a3a),
  krokoD: rgb(0x3a4f2c),
  krokoH: rgb(0xc8c08a),
  capy: rgb(0x9a6a40),
  capyD: rgb(0x6f4a2c),
  boot: rgb(0x7a5a3a),
  bootD: rgb(0x4f3a26),
};
const BLUETEN = [0xff4f6a, 0xff9a2a, 0xffd23f, 0xd84ad8, 0xff6ab0, 0xff3a2a, 0xffffff];
const WIMPEL = [0xd8433a, 0xf2c230, 0x2f9a8f, 0xe8642c, 0x7a4ad8, 0x2f6fb0, 0xf2efe6];

const jit = (c: RGB, k: number, r: number): RGB => {
  const f = 1 + (r - 0.5) * 2 * k;
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
};
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function buildDschungelLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail === 2;
  const lines = detail > 0;
  /** Wie dicht: niedrige Qualität etwa die Hälfte. */
  const dichte = detail === 0 ? 0.45 : detail === 1 ? 0.8 : 1;
  const anz = (k: number): number => Math.max(1, Math.round(k * dichte));
  const LAKE = th.liquidY ?? -1.2;
  const rnd = seeded(14100 + t.index * 61);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

  // Sammler: große Körper mit Kontur, Kleinkram (Pflanzen) ohne, Leuchtendes ohne Licht, Bewegtes,
  // Lichtkegel (additiv), Durchscheinendes (Nebel, Regenbogen), die fernen Tafelberge (ohne Dunst).
  const gross = new Bau();
  const klein = new Bau();
  // Bei niedriger Qualität weniger Zeichenaufrufe: Leuchtendes geht ins Pflanzennetz, Tücher ins Netz der Körper.
  const glut = detail === 0 ? klein : new Bau();
  const dyn = new Teile();
  const tuch = detail === 0 ? dyn : new Teile();
  const licht = new Bau();
  const hauch = new Hauch();
  const fern = new Bau();

  // --- Strecke ----------------------------------------------------------------------
  const S = (m: number): number => ((Math.round(m / t.step) % t.n) + t.n) % t.n;
  const X = (i: number, lat: number): number => t.px[i] + rightX(t, i) * lat;
  const Z = (i: number, lat: number): number => t.pz[i] + rightZ(t, i) * lat;
  /** Drehung, mit der lokales +z in Fahrtrichtung zeigt (lokales +x zeigt dann nach links). */
  const HD = (i: number): number => Math.atan2(t.tx[i], t.tz[i]);
  /** Drehung, mit der lokales +z von der Seite sgn zur Fahrbahn zeigt. */
  const ZUR = (i: number, sgn: number): number => Math.atan2(-sgn * rightX(t, i), -sgn * rightZ(t, i));
  const G = (x: number, z: number): number => world.heightAt(x, z);
  /** Punkt in lokalen Koordinaten (lx, lz) einer Lage (x, z, rot) – wie Bau.box. */
  const LX = (x: number, rot: number, lx: number, lz: number): number => x + lx * Math.cos(rot) + lz * Math.sin(rot);
  const LZ = (z: number, rot: number, lx: number, lz: number): number => z - lx * Math.sin(rot) + lz * Math.cos(rot);

  // Fluss: Mittellinie (für den Abstand) und Wasserspiegel.
  const flussP: number[] = [];
  for (let i = 0; i < t.n; i++) if (t.edge[i] & EDGE_RIVER) flussP.push(t.px[i], t.pz[i], t.py[i] - RIVER_WATER);
  /** Abstand zur Mittellinie des Flusses und dessen Wasserspiegel dort. */
  let flussY = 0;
  const flussAbst = (x: number, z: number): number => {
    let best = Infinity;
    for (let k = 0; k < flussP.length; k += 3) {
      const d = (x - flussP[k]) ** 2 + (z - flussP[k + 1]) ** 2;
      if (d < best) {
        best = d;
        flussY = flussP[k + 2];
      }
    }
    return Math.sqrt(best);
  };
  /** Höhe der nächsten Fahrbahn. */
  const strY = (x: number, z: number): number => {
    let best = Infinity;
    let y = 0;
    for (let k = 0; k < t.n; k += 2) {
      const d = (x - t.px[k]) ** 2 + (z - t.pz[k]) ** 2;
      if (d < best) {
        best = d;
        y = t.py[k];
      }
    }
    return y;
  };
  /** Steht ein Körper mit Radius r frei: 3 m neben jeder Kante, am Fluss 12,4 m von der Mitte? */
  const frei = (x: number, z: number, r: number): boolean => world.clearance(x, z) >= 3 + r && flussAbst(x, z) >= RIVER_FREE + r;
  /** Darf an (x, y, z) etwas in der Luft sein? Neben der Fahrbahn ja, darüber erst 10 m hoch. */
  const luft = (x: number, y: number, z: number): boolean => (world.clearance(x, z) >= 3 && flussAbst(x, z) >= RIVER_FREE) || y >= strY(x, z) + 10;
  /** Trockener Boden (nicht im Fluss, nicht im See)? */
  const trocken = (x: number, z: number, g: number): boolean => {
    if (g < LAKE + 0.5) return false;
    if (flussAbst(x, z) < 40 && g < flussY + 0.25) return false;
    return true;
  };
  /** Eigene Belegung: Kreise (x, z, r), damit nichts ineinander steht. */
  const belegt: number[] = [];
  const platz = (x: number, z: number, r: number): boolean => {
    for (let k = 0; k < belegt.length; k += 3) if ((x - belegt[k]) ** 2 + (z - belegt[k + 1]) ** 2 < (r + belegt[k + 2]) ** 2) return false;
    return true;
  };
  const merke = (x: number, z: number, r: number): void => {
    belegt.push(x, z, r);
  };
  /** Liegt Meter m (mit Umlauf) im Bereich [a, b)? */
  const inM = (m: number, a: number, b: number): boolean => {
    const L = t.n * t.step;
    const mm = ((m % L) + L) % L;
    return a <= b ? mm >= a && mm < b : mm >= a || mm < b;
  };

  // ==================================================================================
  // Bausteine
  // ==================================================================================

  /** Urwaldriese: Brettwurzeln, schlanker Stamm, Äste, Schirmkrone. Gibt Kronenmitte und -radius zurück. */
  const riese = (b: Bau, x: number, z: number, s: number, H: number, R: number): { y: number; r: number; unter: number } => {
    const g = G(x, z) - 0.3;
    const ry = rnd() * Math.PI * 2;
    b.lage(x, g, z, ry);
    const r = 0.62 * s;
    b.geo(new THREE.CylinderGeometry(r * 0.5, r, H, 6, 1, true), jit(C.rinde, 0.1, rnd()), 0, H / 2, 0);
    // Brettwurzeln: dünne Keile vom Stamm schräg in den Boden.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4 + rnd() * 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = -sa * 0.13;
      const nz = ca * 0.13;
      const top: V3 = [ca * r * 0.7, 2.8 * s + rnd(), sa * r * 0.7];
      const foot: V3 = [ca * (r + 2.2 * s), -0.2, sa * (r + 2.2 * s)];
      const base: V3 = [ca * r * 0.3, -0.2, sa * r * 0.3];
      const A1: V3 = [top[0] + nx, top[1], top[2] + nz];
      const A2: V3 = [top[0] - nx, top[1], top[2] - nz];
      const B1: V3 = [foot[0] + nx, foot[1], foot[2] + nz];
      const B2: V3 = [foot[0] - nx, foot[1], foot[2] - nz];
      const C1: V3 = [base[0] + nx, base[1], base[2] + nz];
      const C2: V3 = [base[0] - nx, base[1], base[2] - nz];
      const mid: V3 = [(top[0] + foot[0] + base[0]) / 3, (top[1] + foot[1] + base[1]) / 3, (top[2] + foot[2] + base[2]) / 3];
      b.dreieck(A1, B1, C1, C.rindeD, mid);
      b.dreieck(A2, B2, C2, C.rindeD, mid);
      b.flaeche(A1, A2, B2, B1, C.rinde, mid);
    }
    // Äste zur Krone
    const cy = H + 0.6 * s;
    for (let k = 0; k < 2; k++) {
      const a = rnd() * Math.PI * 2;
      b.stab([0, H * 0.72, 0], [Math.cos(a) * R * 0.55, cy - 0.4, Math.sin(a) * R * 0.55], 0.32 * s, C.rindeD);
    }
    // Schirmkrone: breite, flache Hauptkrone und zwei Nebenkronen.
    const c0 = pick(C.laub);
    b.geo(new THREE.IcosahedronGeometry(1, 0), c0, 0, cy + 0.6 * s, 0, 0, rnd() * 3, 0, R, 1.7 * s, R * 0.92);
    for (let k = 0; k < 1; k++) {
      const a = rnd() * Math.PI * 2;
      const d = R * (0.55 + rnd() * 0.25);
      b.geo(new THREE.IcosahedronGeometry(1, 0), jit(pick(C.laub), 0.12, rnd()), Math.cos(a) * d, cy + (rnd() - 0.2) * 1.2 * s, Math.sin(a) * d, 0, rnd() * 3, 0, R * 0.55, 1.3 * s, R * 0.5);
    }
    b.frei();
    return { y: g + cy + 0.6 * s, r: R, unter: g + cy - 1.2 * s };
  };

  /** Palme mit gebogenem Stamm und hängenden Wedeln. */
  const palme = (b: Bau, x: number, z: number, H: number, lean: number): boolean => {
    const g = G(x, z) - 0.2;
    const ry = rnd() * Math.PI * 2;
    // Wedel dürfen über die Fahrbahn ragen – aber nur 10 m darüber.
    {
      const ox = lean * H * 0.35;
      const cx = x + ox * Math.cos(ry);
      const cz = z - ox * Math.sin(ry);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        if (!luft(cx + Math.cos(a) * 5, g + H - 2.6, cz + Math.sin(a) * 5)) return false;
        if (!luft(cx + Math.cos(a) * 2.6, g + H + 0.4, cz + Math.sin(a) * 2.6)) return false;
      }
    }
    b.lage(x, g, z, ry);
    const N = 2;
    let px = 0;
    let py = 0;
    for (let k = 0; k < N; k++) {
      const f1 = (k + 1) / N;
      const nx = lean * f1 * f1 * H * 0.35;
      const ny = H * f1;
      b.stab([px, py, 0], [nx, ny, 0], 0.46 - k * 0.12, k % 2 ? C.palmeD : C.palme, 4);
      px = nx;
      py = ny;
    }
    // Kokosnüsse
    b.geo(new THREE.OctahedronGeometry(0.5, 0), C.palmeD, px, py - 0.3, 0);
    // Wedel: zwei Stücke, erst nach oben, dann hängend.
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const L = 3.6 + rnd() * 1.2;
      const w = 0.65;
      const p0: V3 = [px, py, 0];
      const p1: V3 = [px + ca * L * 0.5, py + 0.6, sa * L * 0.5];
      const p2: V3 = [px + ca * L, py - 1.3 - rnd() * 0.6, sa * L];
      const sx = -sa * w;
      const sz = ca * w;
      const c = k % 2 ? C.wedel : C.wedelD;
      b.quad(p0, [p1[0] + sx, p1[1] - 0.1, p1[2] + sz], p1, [p1[0] - sx, p1[1] - 0.1, p1[2] - sz], c);
      b.quad([p1[0] - sx, p1[1] - 0.1, p1[2] - sz], p1, [p1[0] + sx, p1[1] - 0.1, p1[2] + sz], p2, c);
    }
    b.frei();
    return true;
  };

  /** Baumfarn: dünner Stamm, Wedelkrone. */
  const baumfarn = (b: Bau, x: number, z: number, H: number): void => {
    const g = G(x, z) - 0.2;
    b.lage(x, g, z, rnd() * 6);
    b.stab([0, 0, 0], [0, H, 0], 0.34, C.rindeD);
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const L = 2.4 + rnd() * 0.6;
      const p1: V3 = [ca * L * 0.55, H + 0.7, sa * L * 0.55];
      const p2: V3 = [ca * L, H - 0.5, sa * L];
      const sx = -sa * 0.5;
      const sz = ca * 0.5;
      const c = k % 2 ? C.farn : C.farnH;
      b.quad([0, H, 0], [p1[0] + sx, p1[1], p1[2] + sz], p1, [p1[0] - sx, p1[1], p1[2] - sz], c);
      b.tri([p1[0] - sx, p1[1], p1[2] - sz], [p1[0] + sx, p1[1], p1[2] + sz], p2, c);
    }
    b.frei();
  };

  /** Bananenstaude: Scheinstamm, große Paddelblätter, eine Fruchttraube. */
  const banane = (b: Bau, x: number, z: number, H: number): void => {
    const g = G(x, z) - 0.2;
    b.lage(x, g, z, rnd() * 6);
    b.stab([0, 0, 0], [0, H, 0], 0.4, C.farnD);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + rnd() * 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const L = 2.8 + rnd() * 0.8;
      const w = 0.75;
      const p0: V3 = [ca * 0.2, H - 0.2, sa * 0.2];
      const p1: V3 = [ca * L * 0.55, H + 1.1, sa * L * 0.55];
      const p2: V3 = [ca * L, H + 0.3 - rnd() * 0.8, sa * L];
      const sx = -sa * w;
      const sz = ca * w;
      b.quad(p0, [p1[0] + sx, p1[1], p1[2] + sz], p1, [p1[0] - sx, p1[1], p1[2] - sz], C.banane);
      b.quad([p1[0] - sx, p1[1], p1[2] - sz], p1, [p1[0] + sx, p1[1], p1[2] + sz], p2, k % 2 ? C.banane : C.farn);
    }
    b.geo(new THREE.ConeGeometry(0.35, 0.9, 5, 1, true), C.gelb, 0.3, H - 0.6, 0, Math.PI, 0, 0);
    b.frei();
  };

  /** Farn: Rosette aus Wedeln am Boden. */
  const farn = (b: Bau, x: number, z: number, s: number, g: number): void => {
    b.lage(x, g - 0.1, z, rnd() * 6);
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const L = (1.5 + rnd() * 0.6) * s;
      const p1: V3 = [ca * L * 0.5, 0.9 * s, sa * L * 0.5];
      const p2: V3 = [ca * L, 0.25 * s, sa * L];
      const sx = -sa * 0.32 * s;
      const sz = ca * 0.32 * s;
      const c = k % 2 ? C.farn : C.farnD;
      b.tri([0, 0, 0], [p1[0] + sx, p1[1], p1[2] + sz], [p1[0] - sx, p1[1], p1[2] - sz], c);
      b.tri([p1[0] - sx, p1[1], p1[2] - sz], [p1[0] + sx, p1[1], p1[2] + sz], p2, c);
    }
    b.frei();
  };

  /** Busch: flacher Blätterhaufen. */
  const busch = (b: Bau, x: number, z: number, s: number, g: number): void => {
    b.lage(x, g, z, 0);
    b.geo(new THREE.IcosahedronGeometry(1, 0), jit(pick(C.laub), 0.15, rnd()), 0, 0.6 * s, 0, 0, rnd() * 3, 0, 1.6 * s, 1.1 * s, 1.4 * s);
    b.frei();
  };

  /** Leuchtende Blüten: Sterne aus vier Blättern (ohne Licht, also leuchtend). */
  const blueten = (x: number, z: number, g: number, n: number, hoch: number): void => {
    const c = rgb(pick(BLUETEN));
    for (let k = 0; k < n; k++) {
      const bx = x + (rnd() - 0.5) * 1.6;
      const bz = z + (rnd() - 0.5) * 1.6;
      const by = g + hoch + rnd() * 0.5;
      const r = 0.32 + rnd() * 0.18;
      glut.lage(bx, by, bz, rnd() * 6);
      const ctr: V3 = [0, 0.1, 0];
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * Math.PI * 2;
        const a1 = a + 0.5;
        const a2 = a - 0.5;
        glut.tri(ctr, [Math.cos(a1) * r * 0.55, 0.05, Math.sin(a1) * r * 0.55], [Math.cos(a) * r, 0.18, Math.sin(a) * r], k === 0 && p === 0 ? mix(c, [1, 1, 1], 0.3) : c);
        glut.tri(ctr, [Math.cos(a) * r, 0.18, Math.sin(a) * r], [Math.cos(a2) * r * 0.55, 0.05, Math.sin(a2) * r * 0.55], c);
      }
      glut.frei();
    }
  };

  /** Pilzgruppe. */
  const pilze = (x: number, z: number, g: number): void => {
    for (let k = 0; k < 3; k++) {
      const px = x + (rnd() - 0.5) * 1.2;
      const pz = z + (rnd() - 0.5) * 1.2;
      const h = 0.35 + rnd() * 0.4;
      klein.lage(px, g - 0.05, pz, 0);
      klein.stab([0, 0, 0], [0, h, 0], 0.16, C.pilzH);
      klein.geo(new THREE.ConeGeometry(0.28 + h * 0.3, 0.22, 6, 1, true), k === 1 ? C.rot : C.pilz, 0, h + 0.05, 0);
      klein.frei();
    }
  };

  /** Bemooster, umgestürzter Stamm. */
  const stamm = (x: number, z: number, g: number, rot: number, L: number): void => {
    gross.lage(x, g + 0.35, z, rot);
    gross.geo(new THREE.CylinderGeometry(0.6, 0.7, L, 7, 1, false), C.rindeD, 0, 0, 0, 0, 0, Math.PI / 2);
    gross.geo(new THREE.CylinderGeometry(0.62, 0.72, L * 0.7, 7, 1, true), C.moos, L * 0.08, 0.12, 0, 0, 0, Math.PI / 2, 1, 1, 0.9);
    gross.stab([L * 0.2, 0.4, 0], [L * 0.28, 1.6, 0.5], 0.22, C.rindeD);
    gross.frei();
  };

  /** Liane: hängt von (x, y0, z) nach unten bis y1, leicht gewunden, mit ein paar Blättern. */
  const liane = (x: number, z: number, y0: number, y1: number): void => {
    const N = 3;
    let ax = x;
    let az = z;
    for (let k = 0; k < N; k++) {
      const ya = y0 + ((y1 - y0) * k) / N;
      const yb = y0 + ((y1 - y0) * (k + 1)) / N;
      const bx = x + (rnd() - 0.5) * 0.6;
      const bz = z + (rnd() - 0.5) * 0.6;
      const w = 0.09;
      klein.quad([ax - w, ya, az], [ax + w, ya, az], [bx + w, yb, bz], [bx - w, yb, bz], C.lian);
      klein.quad([ax, ya, az - w], [ax, ya, az + w], [bx, yb, bz + w], [bx, yb, bz - w], C.lian);
      if (k > 0) {
        const s = 0.45;
        klein.tri([ax, ya, az], [ax + s, ya - 0.2, az + s * 0.4], [ax + s * 0.3, ya - 0.6, az], C.farnH);
      }
      ax = bx;
      az = bz;
    }
  };

  /** Fels: unregelmäßiger Brocken, oben Moos. */
  const fels = (b: Bau, x: number, y: number, z: number, sx: number, sy: number, sz: number, moos = true): void => {
    b.lage(x, y, z, rnd() * 6);
    b.geo(new THREE.IcosahedronGeometry(1, 0), jit(C.fels, 0.08, rnd()), 0, 0, 0, (rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4, sx, sy, sz);
    if (moos && rnd() < 0.6) b.geo(new THREE.OctahedronGeometry(1, 0), C.moos, 0, sy * 0.66, 0, 0, rnd() * 3, 0, sx * 0.72, sy * 0.4, sz * 0.72);
    b.frei();
  };

  /** Felssäule: sechskantig, oben bemoost. */
  const saeule = (b: Bau, x: number, y0: number, z: number, r: number, h: number, moos: boolean): void => {
    b.lage(x, y0, z, rnd() * 6);
    const c = jit(C.fels, 0.1, rnd());
    b.prisma(r, r * 0.8, h, c, moos ? jit(C.moos, 0.1, rnd()) : jit(C.felsH, 0.05, rnd()), rnd());
    b.frei();
  };

  /** Dorfbewohner: Körper starr, der rechte Arm winkt (bewegtes Teil). Schaut nach rot (+z). */
  const winker: number[] = []; // Teil, x, y, z, Drehung, Phase
  const bewohner = (x: number, y: number, z: number, rot: number, winkt: boolean): void => {
    const haut = pick(C.haut);
    const stoff = pick(C.stoff);
    gross.lage(x, y, z, rot);
    gross.box(0.12, 0.35, 0, 0.16, 0.7, 0.18, C.schwarz);
    gross.box(-0.12, 0.35, 0, 0.16, 0.7, 0.18, C.schwarz);
    gross.geo(new THREE.CylinderGeometry(0.26, 0.4, 0.95, 6, 1, false), stoff, 0, 1.15, 0);
    gross.geo(new THREE.IcosahedronGeometry(0.27, 0), haut, 0, 1.88, 0.02);
    gross.box(0, 2.08, -0.03, 0.46, 0.14, 0.44, C.schwarz);
    // linker Arm hängt
    gross.box(0.38, 1.12, 0, 0.13, 0.62, 0.13, haut);
    gross.frei();
    if (winkt) {
      dyn.beginn();
      dyn.box(0, 0.3, 0, 0.13, 0.62, 0.13, haut);
      dyn.geo(new THREE.IcosahedronGeometry(0.1, 0), haut, 0, 0.64, 0);
      const p = dyn.ende(0);
      winker.push(p, LX(x, rot, -0.36, 0), y + 1.48, LZ(z, rot, -0.36, 0), rot, rnd() * 10);
    } else {
      gross.lage(x, y, z, rot);
      gross.box(-0.38, 1.12, 0, 0.13, 0.62, 0.13, haut);
      gross.frei();
    }
  };

  // Wimpelketten und Wäscheleinen (bewegte Teile, Art 3): zwischen zwei Punkten, Teil, Ursprung, Drehung
  const ketten: number[] = []; // Teil, x, y, z, Gier, Neigung
  const kette = (a: V3, b2: V3, sag: number, art: 'wimpel' | 'waesche'): void => {
    const dx = b2[0] - a[0];
    const dy = b2[1] - a[1];
    const dz = b2[2] - a[2];
    const L = Math.hypot(dx, dz);
    if (L < 1) return;
    tuch.beginn();
    const N = Math.max(4, Math.round(L / (art === 'wimpel' ? 0.9 : 1.4)));
    const yAt = (u: number): number => dy * u - sag * 4 * u * (1 - u);
    // Seil
    for (let k = 0; k < N; k++) {
      const u0 = k / N;
      const u1 = (k + 1) / N;
      const y0 = yAt(u0);
      const y1 = yAt(u1);
      tuch.quad([u0 * L, y0 + 0.04, 0], [u1 * L, y1 + 0.04, 0], [u1 * L, y1 - 0.04, 0], [u0 * L, y0 - 0.04, 0], C.schwarz);
    }
    for (let k = 0; k < N; k++) {
      const u = (k + 0.5) / N;
      const x0 = u * L - 0.32;
      const x1 = u * L + 0.32;
      const y0 = yAt((x0 / L));
      const y1 = yAt((x1 / L));
      if (art === 'wimpel') {
        const c = rgb(WIMPEL[k % WIMPEL.length]);
        tuch.tri([x0, y0, 0], [x1, y1, 0], [u * L, (y0 + y1) / 2 - 0.62, 0], c);
      } else if (rnd() < 0.8) {
        const c = pick(C.stoff);
        const h = 0.6 + rnd() * 0.5;
        tuch.quad([x0, y0, 0], [x0, y0 - h, 0], [x1, y1 - h, 0], [x1, y1, 0], c);
      }
    }
    const p = tuch.ende(3, { len: L, amp: art === 'wimpel' ? 0.5 : 0.25, k: 0.9, w: 2.2 + rnd(), ph: rnd() * 6, dy, sag });
    ketten.push(p, a[0], a[1], a[2], Math.atan2(dx, dz) - Math.PI / 2);
  };

  // Fahnen (Art 2): Teil, x, y, z, Gier
  const fahnen: number[] = [];
  const fahne = (x: number, y: number, z: number, w: number, h: number, c1: RGB, c2: RGB): void => {
    tuch.beginn();
    const N = 4;
    for (let k = 0; k < N; k++) {
      const x0 = (k / N) * w;
      const x1 = ((k + 1) / N) * w;
      const c = k % 2 ? c2 : c1;
      tuch.quad([x0, 0, 0], [x1, 0, 0], [x1, h, 0], [x0, h, 0], c);
    }
    const p = tuch.ende(2, { len: w, amp: 0.45, k: 1.6, w: 4.2, ph: rnd() * 6 });
    fahnen.push(p, x, y, z, rnd() * 0.6 + 2.2);
  };

  /** Pfahlhaus: Plattform auf Pfählen (Oberkante py), Hütte mit Palmdach; Vorderseite (+z) zur Straße. */
  const pfahlhaus = (x: number, z: number, rot: number, py: number, w: number, d: number, opt: { haus?: boolean; leiter?: boolean; dach?: RGB } = {}): void => {
    const b = gross;
    // Pfähle bis in den Boden
    const posts: [number, number][] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) posts.push([sx * (w / 2 - 0.15), sz * (d / 2 - 0.15)]);
    if (w > 4.5) posts.push([0, d / 2 - 0.15], [0, -d / 2 + 0.15]);
    for (const [lx, lz] of posts) {
      const gy = G(LX(x, rot, lx, lz), LZ(z, rot, lx, lz)) - 0.5;
      const h = py - gy;
      if (h <= 0.1) continue;
      b.lage(x, 0, z, rot);
      b.klotz(lx, gy + h / 2, lz, 0.32, h, 0.32, C.pfahl);
      // Querstreben bei hohen Pfählen
      if (h > 5) klein.lage(x, 0, z, rot).stab([lx, gy + h * 0.3, lz], [lx * 0.2, gy + h * 0.75, lz], 0.16, C.pfahl);
    }
    b.lage(x, 0, z, rot);
    b.box(0, py - 0.15, 0, w + 0.6, 0.3, d + 0.6, C.holz, 0, C.holzH);
    // Geländer vorne
    klein.lage(x, 0, z, rot);
    for (const sx of [-1, 1]) klein.stab([sx * (w / 2 + 0.2), py, d / 2 + 0.2], [sx * (w / 2 + 0.2), py + 1, d / 2 + 0.2], 0.12, C.holzD);
    klein.stab([-w / 2 - 0.2, py + 0.95, d / 2 + 0.2], [w / 2 + 0.2, py + 0.95, d / 2 + 0.2], 0.1, C.holzD);
    klein.frei();
    if (opt.haus !== false) {
      const hw = w - 0.6;
      const hd = d - 1.6;
      const hz = -0.6;
      b.klotz(0, py + 1.15, hz, hw, 2.3, hd, C.wand, 0);
      // Tür und Fenster
      b.quad([-0.45, py, hz + hd / 2 + 0.02], [0.45, py, hz + hd / 2 + 0.02], [0.45, py + 1.8, hz + hd / 2 + 0.02], [-0.45, py + 1.8, hz + hd / 2 + 0.02], C.tuer);
      if (hw > 2.6) b.quad([hw / 2 - 0.9, py + 1.0, hz + hd / 2 + 0.02], [hw / 2 - 0.3, py + 1.0, hz + hd / 2 + 0.02], [hw / 2 - 0.3, py + 1.6, hz + hd / 2 + 0.02], [hw / 2 - 0.9, py + 1.6, hz + hd / 2 + 0.02], C.tuer);
      // Satteldach aus Palmblatt, First quer zur Straße (längs x), weit überstehend
      const e = 0.7;
      const y0 = py + 2.3;
      const y1 = py + 4.1;
      const dach = opt.dach ?? C.palmdach;
      const xa = -hw / 2 - e;
      const xb = hw / 2 + e;
      const za = hz - hd / 2 - e;
      const zb = hz + hd / 2 + e;
      const ref: V3 = [0, py + 1, hz];
      b.flaeche([xa, y0 - 0.3, zb], [xb, y0 - 0.3, zb], [xb, y1, hz], [xa, y1, hz], dach, ref);
      b.flaeche([xb, y0 - 0.3, za], [xa, y0 - 0.3, za], [xa, y1, hz], [xb, y1, hz], mix(dach, [0, 0, 0], 0.2), ref);
      b.dreieck([-hw / 2, y0, hz - hd / 2], [-hw / 2, y0, hz + hd / 2], [-hw / 2, y1 - 0.3, hz], C.wandD, ref);
      b.dreieck([hw / 2, y0, hz + hd / 2], [hw / 2, y0, hz - hd / 2], [hw / 2, y1 - 0.3, hz], C.wandD, ref);
      // Firstbündel
      b.box(0, y1 + 0.08, hz, hw + 2 * e + 0.2, 0.22, 0.3, C.strohD);
    }
    if (opt.leiter !== false) {
      // Leiter an der Seite
      const lx = w / 2 + 0.55;
      const gy = G(LX(x, rot, lx, 0.6), LZ(z, rot, lx, 0.6)) - 0.3;
      if (py - gy > 0.8) {
        klein.lage(x, 0, z, rot);
        klein.stab([lx, gy, 0.3 + (py - gy) * 0.25], [lx, py, 0.3], 0.12, C.holzD);
        klein.stab([lx, gy, 0.9 + (py - gy) * 0.25], [lx, py, 0.9], 0.12, C.holzD);
        const n = Math.min(4, Math.floor((py - gy) / 0.8));
        for (let k = 1; k <= n; k++) {
          const f = k / (n + 1);
          const yy = gy + (py - gy) * f;
          const zz = (py - gy) * 0.25 * (1 - f);
          klein.stab([lx, yy, 0.25 + zz], [lx, yy, 0.95 + zz], 0.08, C.holzH);
        }
        klein.frei();
      }
    }
    b.frei();
    merke(x, z, Math.max(w, d) * 0.75);
  };

  /** Korb oder Trommel. */
  const korb = (b: Bau, x: number, y: number, z: number, trommel: boolean): void => {
    b.lage(x, y, z, rnd() * 6);
    if (trommel) {
      b.geo(new THREE.CylinderGeometry(0.34, 0.26, 0.9, 7, 1, false), C.rot, 0, 0.45, 0);
      b.geo(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 7, 1, false), C.holzH, 0, 0.9, 0);
    } else b.geo(new THREE.CylinderGeometry(0.4, 0.28, 0.5, 7, 1, false), C.stroh, 0, 0.25, 0);
    b.frei();
  };

  // ==================================================================================
  // 1. Stelzendorf am Hochufer (−43 … 167 m)
  // ==================================================================================
  const feuer: number[] = []; // x, y, z
  {
    // Südseite (außen, zum See hin): Pfahlhäuser auf langen Stelzen.
    const sued = [-34, -4, 26, 64, 98, 132];
    for (let k = 0; k < sued.length; k++) {
      const i = S(sued[k]);
      const lat = -(15.5 + (k % 2) * 4.5);
      const x = X(i, lat);
      const z = Z(i, lat);
      const rot = ZUR(i, -1);
      const w = 4.2 + rnd() * 1.4;
      const py = t.py[i] + 2.4 + (k % 3) * 0.6;
      pfahlhaus(x, z, rot, py, w, 4.6, { dach: k % 2 ? C.palmdach : C.stroh });
      // Leute auf der Veranda, Körbe, Trommeln
      if (k % 2 === 0 || hi) bewohner(LX(x, rot, -w / 2 + 0.8, 1.9), py, LZ(z, rot, -w / 2 + 0.8, 1.9), rot, true);
      korb(gross, LX(x, rot, w / 2 - 0.5, 1.8), py, LZ(z, rot, w / 2 - 0.5, 1.8), k % 3 === 0);
    }
    // Nordseite (innen): Häuser auf kurzen Pfählen, dazwischen Feuerstelle und Ausguck.
    const nord = [-18, 14, 46, 84, 118];
    for (let k = 0; k < nord.length; k++) {
      const i = S(nord[k]);
      const lat = 15 + (k % 2) * 5;
      const x = X(i, lat);
      const z = Z(i, lat);
      const rot = ZUR(i, 1);
      const w = 4 + rnd() * 1.2;
      const py = Math.max(G(x, z) + 1.6, t.py[i] + 1.2);
      pfahlhaus(x, z, rot, py, w, 4.4, { dach: k % 2 ? C.stroh : C.palmdach });
      if (k !== 2 || hi) bewohner(LX(x, rot, w / 2 - 0.8, 1.9), py, LZ(z, rot, w / 2 - 0.8, 1.9), rot, k % 2 === 0);
      korb(gross, LX(x, rot, -w / 2 + 0.5, 1.8), py, LZ(z, rot, -w / 2 + 0.5, 1.8), k % 2 === 1);
    }

    // Hängesteg hoch über der Bohlenstraße: zwei Baumhaus-Türme, dazwischen ein Steg 12 m über der Fahrbahn.
    for (const m of [40, 108]) {
      const i = S(m);
      const yS = t.py[i] + 12.2;
      const lats = [-15.8, 15.8];
      for (const lat of lats) {
        const sgn = Math.sign(lat);
        const x = X(i, lat);
        const z = Z(i, lat);
        const rot = ZUR(i, sgn);
        pfahlhaus(x, z, rot, yS, 4.2, 4.2, { dach: C.palmdach });
        bewohner(LX(x, rot, 1.2, 1.7), yS, LZ(z, rot, 1.2, 1.7), rot, true);
      }
      // Steg: Bretter quer, Seile als Handlauf, leicht durchhängend (tiefste Stelle 11 m über der Bahn).
      const l0 = -13.5;
      const l1 = 13.5;
      const N = 14;
      const yAt = (u: number): number => yS - 0.9 * 4 * u * (1 - u);
      const rot = HD(i);
      gross.lage(t.px[i], 0, t.pz[i], rot);
      for (let k = 0; k < N; k++) {
        const u0 = k / N;
        const u1 = (k + 0.82) / N;
        // lokales +x zeigt nach links: Seite lat entspricht x = −lat
        const xa = -(l0 + (l1 - l0) * u0);
        const xb = -(l0 + (l1 - l0) * u1);
        const ya = yAt(u0);
        const yb = yAt(u1);
        gross.quad([xa, ya, -0.8], [xa, ya, 0.8], [xb, yb, 0.8], [xb, yb, -0.8], C.holzH);
        gross.quad([xa, ya - 0.12, 0.8], [xa, ya - 0.12, -0.8], [xb, yb - 0.12, -0.8], [xb, yb - 0.12, 0.8], C.holzD);
      }
      gross.frei();
      klein.lage(t.px[i], 0, t.pz[i], rot);
      for (const zz of [-0.85, 0.85]) {
        const M = 6;
        for (let k = 0; k < M; k++) {
          const u0 = k / M;
          const u1 = (k + 1) / M;
          const xa = -(l0 + (l1 - l0) * u0);
          const xb = -(l0 + (l1 - l0) * u1);
          klein.stab([xa, yAt(u0) + 1.0, zz], [xb, yAt(u1) + 1.0, zz], 0.08, C.holzD);
          if (k > 0) klein.stab([xa, yAt(u0), zz], [xa, yAt(u0) + 1.0, zz], 0.06, C.holzD);
        }
      }
      klein.frei();
      // Wimpelkette unter dem Steg (ihr tiefster Wimpel bleibt 10 m über der Bahn)
      const a: V3 = [X(i, l0 + 0.5), yS - 0.35, Z(i, l0 + 0.5)];
      const b2: V3 = [X(i, l1 - 0.5), yS - 0.35, Z(i, l1 - 0.5)];
      kette(a, b2, 0.5, 'wimpel');
    }

    // Wimpelketten und Wäsche zwischen den Häusern einer Seite (nicht über der Fahrbahn).
    for (const [m0, m1, lat, y, art] of [
      [-30, -6, -13.6, 17.2, 'wimpel'],
      [28, 60, -13.6, 17.4, 'wimpel'],
      [66, 96, -13.4, 17.0, 'waesche'],
      [100, 130, -13.6, 17.2, 'wimpel'],
      [-14, 12, 13.4, 16.4, 'waesche'],
      [50, 80, 13.4, 16.6, 'wimpel'],
      [88, 114, 13.4, 16.4, 'wimpel'],
    ] as [number, number, number, number, 'wimpel' | 'waesche'][]) {
      const i0 = S(m0);
      const i1 = S(m1);
      const ya = t.py[i0] + (y - 12);
      const yb = t.py[i1] + (y - 12);
      // Masten an beiden Enden
      for (const [i, yy] of [
        [i0, ya],
        [i1, yb],
      ] as [number, number][]) {
        const x = X(i, lat);
        const z = Z(i, lat);
        const g = G(x, z) - 0.3;
        if (yy - g > 0.5) gross.stab([x, g, z], [x, yy + 0.4, z], 0.16, C.pfahl);
      }
      kette([X(i0, lat), ya, Z(i0, lat)], [X(i1, lat), yb, Z(i1, lat)], art === 'wimpel' ? 0.6 : 0.4, art);
    }

    // Ausguck-Turm mit Fahne (innen, gegen Ende des Dorfs)
    {
      const i = S(150);
      const lat = 17;
      const x = X(i, lat);
      const z = Z(i, lat);
      const rot = ZUR(i, 1);
      const top = t.py[i] + 20;
      pfahlhaus(x, z, rot, top, 3.0, 3.0, { haus: false, leiter: false });
      gross.lage(x, 0, z, rot);
      // Dach auf vier Stützen
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) gross.klotz(sx * 1.4, top + 1.1, sz * 1.4, 0.16, 2.2, 0.16, C.holzD);
      gross.geo(new THREE.ConeGeometry(2.6, 1.8, 4, 1, false), C.stroh, 0, top + 3.1, 0, 0, Math.PI / 4, 0);
      gross.stab([0, top + 3.6, 0], [0, top + 7.5, 0], 0.14, C.holzD);
      gross.frei();
      // Leiter in die Höhe
      const gy = G(x, z);
      klein.lage(x, 0, z, rot);
      klein.stab([1.7, gy, 0.3], [1.7, top, 0.3], 0.12, C.holzD);
      klein.stab([1.7, gy, -0.3], [1.7, top, -0.3], 0.12, C.holzD);
      for (let yy = gy + 0.8; yy < top; yy += 1.6) klein.stab([1.7, yy, -0.32], [1.7, yy, 0.32], 0.08, C.holzH);
      klein.frei();
      bewohner(LX(x, rot, 0.4, 0.8), top, LZ(z, rot, 0.4, 0.8), rot, true);
      fahne(x, top + 6.6, z, 2.4, 1.0, C.rot, C.gelb);
    }

    // Feuerstelle mit Steinkranz, Trommeln drumherum (innen)
    {
      const i = S(66);
      const lat = 24;
      const x = X(i, lat);
      const z = Z(i, lat);
      const g = G(x, z);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        klein.lage(x + Math.cos(a) * 1.3, g, z + Math.sin(a) * 1.3, a);
        klein.geo(new THREE.IcosahedronGeometry(0.35, 0), C.felsD, 0, 0.1, 0, 0, 0, 0, 1, 0.7, 1);
        klein.frei();
      }
      gross.lage(x, g, z, 0.3);
      for (let k = 0; k < 4; k++) gross.stab([Math.cos(k * 1.6) * 0.9, 0.05, Math.sin(k * 1.6) * 0.9], [-Math.cos(k * 1.6) * 0.5, 0.4, -Math.sin(k * 1.6) * 0.5], 0.18, C.rindeD);
      gross.frei();
      glut.lage(x, g, z, 0);
      glut.geo(new THREE.ConeGeometry(0.7, 1.6, 5, 1, true), rgb(0xff8a2a), 0, 0.9, 0);
      glut.geo(new THREE.ConeGeometry(0.42, 1.2, 5, 1, true), rgb(0xffd23f), 0.15, 0.85, 0.1, 0, 1, 0);
      glut.geo(new THREE.ConeGeometry(0.3, 0.9, 5, 1, true), rgb(0xff5a2a), -0.3, 0.6, -0.2, 0, 2, 0);
      glut.frei();
      feuer.push(x, g + 1.4, z);
      for (let k = 0; k < 3; k++) {
        const a = 0.8 + k * 1.9;
        korb(gross, x + Math.cos(a) * 2.6, g, z + Math.sin(a) * 2.6, true);
        if (k < 2) bewohner(x + Math.cos(a + 0.9) * 3.0, g, z + Math.sin(a + 0.9) * 3.0, Math.atan2(-Math.cos(a + 0.9), -Math.sin(a + 0.9)), k === 0);
      }
      merke(x, z, 4);
    }
  }

  // Bootsbauer mit halbfertigem Einbaum am Ufer unterhalb des Dorfs (außen, zum See)
  const bootsbauer: number[] = []; // Teil, x, y, z, Gier
  {
    const i = S(8);
    let lat = -24;
    for (let l = -22; l > -70; l -= 2) {
      const g = G(X(i, l), Z(i, l));
      if (g < LAKE + 2.2) break;
      lat = l;
      if (g < LAKE + 3) break;
    }
    const x = X(i, lat);
    const z = Z(i, lat);
    const g = G(x, z);
    const rot = HD(i);
    // Böcke und Stamm, oben ausgehöhlt
    gross.lage(x, g, z, rot);
    for (const zz of [-2, 2]) {
      gross.stab([-0.6, 0, zz], [0, 0.9, zz], 0.14, C.holzD);
      gross.stab([0.6, 0, zz], [0, 0.9, zz], 0.14, C.holzD);
    }
    gross.geo(new THREE.CylinderGeometry(0.55, 0.55, 6.2, 8, 1, false), C.holzH, 0, 1.4, 0, Math.PI / 2, 0, 0, 1, 1, 0.75);
    gross.quad([-0.38, 1.82, -2.4], [0.38, 1.82, -2.4], [0.38, 1.82, 2.4], [-0.38, 1.82, 2.4], C.holzD);
    gross.geo(new THREE.ConeGeometry(0.42, 1.2, 8, 1, false), C.holzH, 0, 1.4, 3.6, Math.PI / 2, 0, 0, 1, 1, 0.75);
    gross.frei();
    // Späne am Boden
    for (let k = 0; k < 10; k++) klein.box(x + (rnd() - 0.5) * 3, g + 0.03, z + (rnd() - 0.5) * 5, 0.25, 0.04, 0.12, C.holzH, rnd() * 3);
    // Der Bootsbauer selbst: steht neben dem Stamm, schwingt die Dechsel.
    const bx = LX(x, rot, 1.2, 0.5);
    const bz = LZ(z, rot, 1.2, 0.5);
    const brot = rot - Math.PI / 2;
    const haut = pick(C.haut);
    gross.lage(bx, g, bz, brot);
    gross.box(0.12, 0.35, 0, 0.16, 0.7, 0.18, C.schwarz);
    gross.box(-0.12, 0.35, 0, 0.16, 0.7, 0.18, C.schwarz);
    gross.geo(new THREE.CylinderGeometry(0.26, 0.38, 0.95, 6, 1, false), C.stoff[2], 0, 1.15, 0);
    gross.geo(new THREE.IcosahedronGeometry(0.27, 0), haut, 0, 1.88, 0.02);
    gross.frei();
    dyn.beginn();
    dyn.box(0, -0.3, 0.1, 0.13, 0.62, 0.13, haut);
    dyn.stab([0, -0.62, 0.1], [0, -0.62, 0.75], 0.07, C.holzD);
    dyn.box(0, -0.72, 0.78, 0.08, 0.3, 0.16, C.felsD);
    const p = dyn.ende(0);
    bootsbauer.push(p, LX(bx, brot, 0, 0.05), g + 1.5, LZ(bz, brot, 0, 0.05), brot);
    merke(x, z, 4.5);
  }

  // Palmen und Bananen ums Dorf
  for (let k = 0; k < anz(26); k++) {
    const m = -45 + rnd() * 215;
    const i = S(m);
    const sgn = rnd() < 0.5 ? -1 : 1;
    const lat = sgn * (12.5 + rnd() * 22);
    const x = X(i, lat);
    const z = Z(i, lat);
    if (!frei(x, z, 3.8) || !platz(x, z, 1.5)) continue;
    const g = G(x, z);
    if (!trocken(x, z, g)) continue;
    if (rnd() < 0.65) palme(klein, x, z, 8 + rnd() * 5, (rnd() - 0.5) * 1.6);
    else banane(klein, x, z, 1.6 + rnd() * 0.8);
    merke(x, z, 1.2);
  }

  // ==================================================================================
  // 2. Regenwald: Pfad hinunter (167–479) und Hang hinauf (879–1353)
  // ==================================================================================
  const WALD: [number, number][] = [
    [170, 476],
    [884, 1350],
  ];
  const kronen: number[] = []; // x, y, z, r, unter – für Vögel, Affen, Lichtkegel, Blätter
  const affen: number[] = []; // Teil, x, y, z, Gier, Länge, Phase
  const imWald = (m: number): boolean => WALD.some(([a, b]) => inM(m, a, b));
  {
    // Urwaldriesen
    const wantR = anz(42);
    let n = 0;
    for (let tries = 0; tries < wantR * 12 && n < wantR; tries++) {
      const [a, b] = WALD[rnd() < 0.4 ? 0 : 1];
      const m = a + rnd() * (b - a);
      const i = S(m);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const s = 0.9 + rnd() * 0.35;
      const lat = sgn * (t.wh[i] + 3.6 + rnd() * rnd() * 26);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 1.2 + 2.4 * s) || !platz(x, z, 2.6)) continue;
      const g = G(x, z);
      if (!trocken(x, z, g)) continue;
      const H = (15 + rnd() * 7) * s;
      const R = (5.5 + rnd() * 3) * s;
      // Die Krone darf über die Fahrbahn ragen – aber nur 10 m darüber.
      const cy = g - 0.3 + H + 0.6 * s - 1.2 * s;
      let ok = true;
      for (let q = 0; q < 8 && ok; q++) {
        const qa = (q / 8) * Math.PI * 2;
        if (!luft(x + Math.cos(qa) * R, cy, z + Math.sin(qa) * R)) ok = false;
      }
      if (!ok) continue;
      const k = riese(gross, x, z, s, H, R);
      kronen.push(x, k.y, z, k.r, k.unter);
      merke(x, z, 2.4);
      n++;
    }
    const nKr = kronen.length / 5;
    // Lianen unter den Kronen: neben der Fahrbahn bis 2 m über den Boden, darüber nie tiefer als 10 m über der Bahn.
    for (let k = 0; k < nKr; k++) {
      const per = hi && k % 3 !== 0 ? 2 : 1;
      for (let q = 0; q < per; q++) {
        const a = rnd() * Math.PI * 2;
        const d = kronen[k * 5 + 3] * (0.35 + rnd() * 0.5);
        const x = kronen[k * 5] + Math.cos(a) * d;
        const z = kronen[k * 5 + 2] + Math.sin(a) * d;
        const y0 = kronen[k * 5 + 4] + 0.4;
        const g = G(x, z);
        let y1 = g + 2 + rnd() * 5;
        if (world.clearance(x, z) < 4 || flussAbst(x, z) < RIVER_FREE + 1) y1 = Math.max(y1, strY(x, z) + 10.5);
        if (y0 - y1 < 2) continue;
        liane(x, z, y0, y1);
      }
    }
    // Affen an Lianen: unter Kronen dicht an der Fahrbahn, sie schwingen längs der Strecke.
    const wantA = hi ? 7 : detail === 1 ? 5 : 3;
    for (let k = 0; k < nKr && affen.length / 7 < wantA; k++) {
      const kx = kronen[k * 5];
      const kz = kronen[k * 5 + 2];
      const c = world.clearance(kx, kz);
      if (c > 14) continue;
      // Drehpunkt unter der Krone, zur Fahrbahn hin – aber 4 m neben der Kante.
      const p = projectNear(kx, kz);
      const sgn = p.lat < 0 ? -1 : 1;
      const lat = sgn * (t.wh[p.i] + 4.2 + rnd() * 2);
      const x = X(p.i, lat);
      const z = Z(p.i, lat);
      if (Math.hypot(x - kx, z - kz) > kronen[k * 5 + 3] * 0.95) continue;
      if (!frei(x, z, 0.6)) continue;
      const y0 = kronen[k * 5 + 4] + 0.3;
      const g = G(x, z);
      const L = Math.min(7, y0 - g - 4.5);
      if (L < 3) continue;
      dyn.beginn();
      // Liane vom Drehpunkt nach unten, der Affe hält sich mit beiden Armen fest.
      dyn.stab([0, 0, 0], [0, -L, 0], 0.1, C.lian);
      const ab = -L;
      dyn.stab([0.05, ab + 0.15, 0], [0.22, ab - 0.45, 0], 0.11, C.affe);
      dyn.stab([-0.05, ab + 0.15, 0], [-0.22, ab - 0.45, 0], 0.11, C.affe);
      dyn.geo(new THREE.IcosahedronGeometry(1, 0), C.affe, 0, ab - 0.75, 0, 0, 0, 0, 0.32, 0.42, 0.26);
      dyn.geo(new THREE.IcosahedronGeometry(1, 0), C.affeH, 0, ab - 0.72, 0.18, 0, 0, 0, 0.2, 0.28, 0.12);
      dyn.geo(new THREE.IcosahedronGeometry(0.24, 0), C.affe, 0, ab - 0.2, 0.12);
      dyn.tri([0.18, ab - 0.05, 0.1], [0.36, ab - 0.12, 0.1], [0.22, ab - 0.28, 0.1], C.affeH);
      dyn.tri([-0.18, ab - 0.05, 0.1], [-0.22, ab - 0.28, 0.1], [-0.36, ab - 0.12, 0.1], C.affeH);
      dyn.stab([0.12, ab - 1.0, 0], [0.2, ab - 1.45, 0.15], 0.1, C.affe);
      dyn.stab([-0.12, ab - 1.0, 0], [-0.2, ab - 1.45, 0.15], 0.1, C.affe);
      // Ringelschwanz
      dyn.stab([0, ab - 1.0, -0.15], [0, ab - 1.6, -0.5], 0.07, C.affe);
      dyn.stab([0, ab - 1.6, -0.5], [0, ab - 1.4, -0.85], 0.07, C.affe);
      const part = dyn.ende(0);
      affen.push(part, x, y0, z, HD(p.i), L, rnd() * 10);
      liane(x + 0.2, z, y0 + 0.6, y0 - 0.2);
    }

    // Unterholz: Palmen, Baumfarne, Bananen, Farne, Büsche, Blüten, Pilze, Stämme.
    const unter = (want: number, maxOut: number, r: number, f: (x: number, z: number, g: number, i: number, lat: number) => boolean | void): void => {
      let got = 0;
      for (let tries = 0; tries < want * 10 && got < want; tries++) {
        const [a, b] = WALD[rnd() < 0.4 ? 0 : 1];
        const m = a + rnd() * (b - a);
        const i = S(m);
        const sgn = rnd() < 0.5 ? -1 : 1;
        const lat = sgn * (t.wh[i] + 3 + r + rnd() * rnd() * maxOut);
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!frei(x, z, r) || !platz(x, z, r)) continue;
        const g = G(x, z);
        if (!trocken(x, z, g)) continue;
        if (f(x, z, g, i, lat) === false) continue;
        merke(x, z, r * 0.8);
        got++;
      }
    };
    unter(anz(28), 24, 1.2, (x, z) => palme(klein, x, z, 9 + rnd() * 6, (rnd() - 0.5) * 2));
    unter(anz(30), 18, 3.1, (x, z) => baumfarn(klein, x, z, 2.6 + rnd() * 2.2));
    unter(anz(28), 14, 3.7, (x, z) => banane(klein, x, z, 1.4 + rnd() * 0.9));
    unter(anz(82), 16, 2.4, (x, z, g) => farn(klein, x, z, 0.9 + rnd() * 0.3, g));
    unter(anz(60), 22, 2.6, (x, z, g) => busch(klein, x, z, 0.8 + rnd() * 0.8, g));
    unter(anz(32), 10, 2.0, (x, z, g) => {
      busch(klein, x, z, 0.55, g);
      blueten(x, z, g, 3, 0.9);
    });
    unter(anz(16), 12, 0.5, (x, z, g) => pilze(x, z, g));
    unter(anz(10), 14, 5.2, (x, z, g, i) => stamm(x, z, g, HD(i) + (rnd() - 0.5) * 0.8, 6 + rnd() * 3));
  }

  /** Nächster Abschnitt zu (x, z) und die Seitenlage dort. */
  function projectNear(x: number, z: number): { i: number; lat: number } {
    let best = Infinity;
    let bi = 0;
    for (let k = 0; k < t.n; k++) {
      const d = (x - t.px[k]) ** 2 + (z - t.pz[k]) ** 2;
      if (d < best) {
        best = d;
        bi = k;
      }
    }
    return { i: bi, lat: (x - t.px[bi]) * rightX(t, bi) + (z - t.pz[bi]) * rightZ(t, bi) };
  }

  // Lichtkegel: fallen schräg (aus der Sonnenrichtung) durchs Blätterdach in den Wald.
  const kegel: number[] = []; // x, y, z (Fußpunkt) – für die Insektenwolken
  {
    const sd = new THREE.Vector3(th.sunDir[0], th.sunDir[1], th.sunDir[2]).normalize();
    const want = hi ? 18 : detail === 1 ? 13 : 8;
    const hell = rgb(0xe8d898);
    const dunkel = rgb(0x2a2410);
    const schwarz: RGB = [0, 0, 0];
    // Jeder Kegel kommt aus einer Krone: oben steckt er im Laub, unten fällt er auf den Waldboden.
    const nKr = kronen.length / 5;
    for (let tries = 0; tries < nKr * 3 && kegel.length / 3 < want; tries++) {
      const kr = Math.floor(rnd() * nKr);
      const a = rnd() * Math.PI * 2;
      const d = kronen[kr * 5 + 3] * rnd() * 0.5;
      const topY = kronen[kr * 5 + 4] + 0.8;
      const tx0 = kronen[kr * 5] + Math.cos(a) * d;
      const tz0 = kronen[kr * 5 + 2] + Math.sin(a) * d;
      let g = G(tx0, tz0);
      let x = tx0 - (sd.x * (topY - g)) / sd.y;
      let z = tz0 - (sd.z * (topY - g)) / sd.y;
      g = G(x, z);
      x = tx0 - (sd.x * (topY - g)) / sd.y;
      z = tz0 - (sd.z * (topY - g)) / sd.y;
      g = G(x, z);
      if (!frei(x, z, 1.5)) continue;
      if (!trocken(x, z, g)) continue;
      const H = topY - g;
      if (H < 8) continue;
      const L = H / sd.y;
      let ok = true;
      for (let s = 0; s <= L && ok; s += 1) if (!luft(x + sd.x * s, g + sd.y * s, z + sd.z * s)) ok = false;
      if (!ok) continue;
      for (let q = 0; q < kegel.length; q += 3) if (Math.hypot(x - kegel[q], z - kegel[q + 2]) < 9) ok = false;
      if (!ok) continue;
      kegel.push(x, g, z);
      // Querschnitt: Quadrat quer zur Sonnenrichtung, oben schmaler.
      const ux = -sd.z;
      const uz = sd.x;
      const ul = Math.hypot(ux, uz) || 1;
      const u: V3 = [ux / ul, 0, uz / ul];
      // v = sd × u
      const v: V3 = [sd.y * u[2] - sd.z * u[1], sd.z * u[0] - sd.x * u[2], sd.x * u[1] - sd.y * u[0]];
      const w0 = 1.1 + rnd() * 0.8;
      const w1 = w0 * 0.7;
      const top: V3 = [x + sd.x * L, g + H, z + sd.z * L];
      const bot: V3 = [x, g + 0.2, z];
      const corner = (p: V3, w: number, cu: number, cv: number): V3 => [p[0] + (u[0] * cu + v[0] * cv) * w, p[1] + (u[1] * cu + v[1] * cv) * w, p[2] + (u[2] * cu + v[2] * cv) * w];
      const cs: [number, number][] = [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ];
      // Hell in der Mitte, oben (wo er aus dem Laub tritt) und unten verlaufend – vor dem Himmel bleibt er unsichtbar.
      const mid: V3 = [bot[0] + (top[0] - bot[0]) * 0.45, bot[1] + (top[1] - bot[1]) * 0.45, bot[2] + (top[2] - bot[2]) * 0.45];
      const wm = w0 + (w1 - w0) * 0.45;
      for (let k = 0; k < 4; k++) {
        const [a1, b1] = cs[k];
        const [a2, b2] = cs[(k + 1) % 4];
        licht.quadV(corner(bot, w0, a1, b1), corner(bot, w0, a2, b2), corner(mid, wm, a2, b2), corner(mid, wm, a1, b1), dunkel, dunkel, hell, hell);
        licht.quadV(corner(mid, wm, a1, b1), corner(mid, wm, a2, b2), corner(top, w1, a2, b2), corner(top, w1, a1, b1), hell, hell, schwarz, schwarz);
      }
    }
  }

  // ==================================================================================
  // 3. Fluss: Ufer (479–674)
  // ==================================================================================
  const reiher: number[] = []; // Teil (Hals), x, y, z, Gier, Phase
  const krokodil: number[] = []; // Teil Kopf, Teil Schwanz, x, y, z, Gier, Phase
  const libellen: number[] = []; // x, y, z, Phase
  /** Reiher: Körper und Beine starr, Hals mit Kopf nickt und pickt (bewegtes Teil). */
  const reiherBau = (x: number, gy: number, z: number, rot: number): void => {
    gross.lage(x, gy, z, rot);
    gross.stab([0.12, 0, 0], [0.1, 1.1, -0.05], 0.06, C.gelb);
    gross.stab([-0.12, 0, 0], [-0.1, 1.1, -0.05], 0.06, C.gelb);
    gross.geo(new THREE.IcosahedronGeometry(1, 0), C.reiher, 0, 1.35, -0.1, -0.3, 0, 0, 0.34, 0.34, 0.6);
    gross.geo(new THREE.IcosahedronGeometry(1, 0), C.reiherD, 0, 1.42, -0.25, -0.3, 0, 0, 0.3, 0.2, 0.5);
    gross.frei();
    dyn.beginn();
    dyn.stab([0, 0, 0], [0, 0.7, 0.18], 0.1, C.reiher);
    dyn.geo(new THREE.IcosahedronGeometry(0.15, 0), C.reiher, 0, 0.78, 0.22);
    dyn.geo(new THREE.ConeGeometry(0.05, 0.55, 4), C.gelb, 0, 0.78, 0.55, Math.PI / 2, 0, 0);
    dyn.box(0, 0.86, 0.15, 0.04, 0.04, 0.3, C.schwarz);
    const p = dyn.ende(0);
    reiher.push(p, LX(x, rot, 0, 0.2), gy + 1.5, LZ(z, rot, 0, 0.2), rot, rnd() * 10);
  };

  {
    // Ufer je Abschnitt und Seite: wo das Gelände aus dem Wasser steigt.
    const ufer: number[] = []; // i, sgn, Seitenlage der Uferlinie, Wasserspiegel
    for (let i = 482; i < 672; i += 3) {
      const wy = t.py[i] - RIVER_WATER;
      for (const sgn of [-1, 1]) {
        let l = 0;
        for (let lat = RIVER_FREE; lat < 44; lat += 0.75) {
          if (G(X(i, sgn * lat), Z(i, sgn * lat)) > wy + 0.15) {
            l = lat;
            break;
          }
        }
        if (l > 0) ufer.push(i, sgn, l, wy);
      }
    }
    const nU = ufer.length / 4;
    const uferAt = (k: number): { i: number; sgn: number; l: number; wy: number } => ({ i: ufer[k * 4], sgn: ufer[k * 4 + 1], l: ufer[k * 4 + 2], wy: ufer[k * 4 + 3] });

    for (let k = 0; k < nU; k++) {
      const { i, sgn, l, wy } = uferAt(k);
      // Schilf an der Uferlinie
      if (rnd() < 0.55 * dichte) {
        const lat = sgn * (l + (rnd() - 0.6) * 2.2);
        if (Math.abs(lat) >= RIVER_FREE + 0.5) {
          const x = X(i, lat);
          const z = Z(i, lat);
          const g = Math.max(G(x, z), wy - 0.6);
          klein.lage(x, g, z, rnd() * 6);
          for (let q = 0; q < 6; q++) {
            const a = rnd() * Math.PI * 2;
            const r = rnd() * 0.8;
            const h = 1.8 + rnd() * 1.2;
            const bx = Math.cos(a) * r;
            const bz = Math.sin(a) * r;
            const lx = Math.cos(a + 1.3) * 0.1;
            const lz = Math.sin(a + 1.3) * 0.1;
            const tx2 = bx + Math.cos(a) * 0.3;
            const tz2 = bz + Math.sin(a) * 0.3;
            klein.tri([bx - lx, 0, bz - lz], [bx + lx, 0, bz + lz], [tx2, h, tz2], C.schilf);
            if (q % 2 === 0) klein.quad([tx2 - lx * 1.4, h * 0.72, tz2 - lz * 1.4], [tx2 + lx * 1.4, h * 0.72, tz2 + lz * 1.4], [tx2 + lx * 1.4, h * 0.95, tz2 + lz * 1.4], [tx2 - lx * 1.4, h * 0.95, tz2 - lz * 1.4], C.kolben);
          }
          klein.frei();
        }
      }
      // Seerosen im ruhigen Wasser vor dem Ufer
      if (l > RIVER_FREE + 2 && rnd() < 0.5 * dichte) {
        for (let q = 0; q < 3; q++) {
          const lat = sgn * (RIVER_FREE + 0.8 + rnd() * (l - RIVER_FREE - 1.5));
          const x = X(i, lat) + (rnd() - 0.5) * 2;
          const z = Z(i, lat) + (rnd() - 0.5) * 2;
          if (flussAbst(x, z) < RIVER_FREE + 0.6 || G(x, z) > wy - 0.2) continue;
          const r = 0.5 + rnd() * 0.4;
          klein.lage(x, wy + 0.06, z, rnd() * 6);
          const n = 6;
          for (let p = 0; p < n - 1; p++) {
            const a0 = 0.5 + (p / n) * Math.PI * 2;
            const a1 = 0.5 + ((p + 1) / n) * Math.PI * 2;
            klein.tri([0, 0, 0], [Math.cos(a1) * r, 0, Math.sin(a1) * r], [Math.cos(a0) * r, 0, Math.sin(a0) * r], C.seerose);
          }
          klein.frei();
          if (rnd() < 0.4) blueten(x, z, wy + 0.08, 1, 0.02);
        }
      }
    }

    // Felsen im Wasser nahe dem Ufer (ab 12,4 m von der Mitte)
    for (let k = 0; k < anz(26); k++) {
      const { i, sgn, l, wy } = uferAt(Math.floor(rnd() * nU));
      const r = 0.9 + rnd() * 1.1;
      const lat = sgn * Math.max(RIVER_FREE + r * 1.25, l - 1 - rnd() * 3);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (flussAbst(x, z) < RIVER_FREE + r * 1.25 || !platz(x, z, r)) continue;
      fels(gross, x, wy - 0.2, z, r * 1.2, r * 0.75, r);
      merke(x, z, r);
    }

    // Mangroven: Stelzwurzeln bogenförmig ins Wasser, darüber eine dichte Krone.
    for (let k = 0; k < anz(11); k++) {
      const { i, sgn, l, wy } = uferAt(Math.floor(rnd() * nU));
      const lat = sgn * Math.max(RIVER_FREE + 2.6, l - 1 + rnd() * 2);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (flussAbst(x, z) < RIVER_FREE + 2.6 || !platz(x, z, 2.5) || world.clearance(x, z) < 6) continue;
      const base = wy + 1.6;
      gross.lage(x, 0, z, rnd() * 6);
      for (let q = 0; q < 5; q++) {
        const a = (q / 5) * Math.PI * 2 + rnd() * 0.4;
        const r = 1.6 + rnd() * 0.8;
        const mid: V3 = [Math.cos(a) * r * 0.55, base + 0.5, Math.sin(a) * r * 0.55];
        gross.stab([0, base + 1.2, 0], mid, 0.16, C.rindeD);
        gross.stab(mid, [Math.cos(a) * r, wy - 0.5, Math.sin(a) * r], 0.14, C.rindeD);
      }
      const H = 4.5 + rnd() * 2;
      gross.stab([0, base + 1, 0], [0.4, base + H, 0.2], 0.45, C.rinde, 4);
      gross.geo(new THREE.IcosahedronGeometry(1, 0), pick(C.laub), 0.4, base + H + 0.8, 0.2, 0, rnd() * 3, 0, 3.4, 2.0, 3.0);
      gross.geo(new THREE.IcosahedronGeometry(1, 0), C.laubD, -0.8, base + H - 0.2, 0.9, 0, rnd() * 3, 0, 2.0, 1.4, 1.8);
      gross.frei();
      merke(x, z, 2.5);
    }

    // Überhängende Bäume am Ufer: Stamm schräg zum Fluss, Krone über dem Wasser (außerhalb 12,4 m).
    for (let k = 0; k < anz(12); k++) {
      const { i, sgn, l } = uferAt(Math.floor(rnd() * nU));
      const lat = sgn * (l + 2.5 + rnd() * 3);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!platz(x, z, 2) || !frei(x, z, 1)) continue;
      const g = G(x, z);
      if (!trocken(x, z, g)) continue;
      const R = 3.2 + rnd() * 1.2;
      const reach = Math.max(1, Math.abs(lat) - RIVER_FREE - R - 0.5);
      const lean = Math.min(5, reach);
      const tx2 = X(i, lat - sgn * lean);
      const tz2 = Z(i, lat - sgn * lean);
      const H = 7 + rnd() * 3;
      gross.stab([x, g - 0.3, z], [(x + tx2) / 2, g + H * 0.55, (z + tz2) / 2], 0.6, C.rinde, 4);
      gross.stab([(x + tx2) / 2, g + H * 0.55, (z + tz2) / 2], [tx2, g + H, tz2], 0.45, C.rinde, 4);
      gross.lage(tx2, g + H + 0.6, tz2, rnd() * 6);
      gross.geo(new THREE.IcosahedronGeometry(1, 0), pick(C.laub), 0, 0, 0, 0, 0, 0, R, 1.6, R * 0.9);
      gross.frei();
      // Lianen hängen bis knapp übers Wasser
      for (let q = 0; q < 2; q++) {
        const lx = tx2 + (rnd() - 0.5) * R;
        const lz = tz2 + (rnd() - 0.5) * R;
        if (flussAbst(lx, lz) < RIVER_FREE + 0.3) continue;
        liane(lx, lz, g + H - 0.3, Math.max(flussY + 1.0, g + H - 6));
      }
      merke(x, z, 2);
    }

    // Außenrand ohne Ufer (dort fällt das Land zum See ab): eine Kette aus Felsen, Schilf und Mangroven
    // am Rand des Wassers rahmt den Fluss.
    {
      const hatUfer = new Set<number>();
      for (let k = 0; k < nU; k++) if (ufer[k * 4 + 1] < 0) hatUfer.add(ufer[k * 4]);
      let n = 0;
      for (let i = 486; i < 668; i += 6) {
        if (hatUfer.has(i - (i % 3)) || hatUfer.has(i - (i % 3) + 3)) continue;
        const wy = t.py[i] - RIVER_WATER;
        const lat = -(20 + rnd() * 5);
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!platz(x, z, 2)) continue;
        const g = G(x, z);
        const kind = n % 4;
        if (kind === 3 && detail > 0) {
          // Mangrove auf Stelzwurzeln
          gross.lage(x, 0, z, rnd() * 6);
          for (let q = 0; q < 4; q++) {
            const a = (q / 4) * Math.PI * 2 + rnd() * 0.5;
            gross.stab([0, wy + 2.4, 0], [Math.cos(a) * 1.8, Math.max(g, wy - 2), Math.sin(a) * 1.8], 0.16, C.rindeD);
          }
          gross.stab([0, wy + 2, 0], [0.3, wy + 6.5, 0.2], 0.45, C.rinde, 4);
          gross.geo(new THREE.IcosahedronGeometry(1, 0), pick(C.laub), 0.3, wy + 7.2, 0.2, 0, rnd() * 3, 0, 3.2, 1.9, 2.9);
          gross.frei();
        } else if (kind === 1) {
          // Schilf im Wasser
          klein.lage(x, wy - 0.3, z, rnd() * 6);
          for (let q = 0; q < 6; q++) {
            const a = rnd() * Math.PI * 2;
            const r = rnd() * 1.1;
            const h = 1.8 + rnd() * 1.2;
            const bx = Math.cos(a) * r;
            const bz = Math.sin(a) * r;
            const lx = Math.cos(a + 1.3) * 0.1;
            const lz = Math.sin(a + 1.3) * 0.1;
            klein.tri([bx - lx, 0, bz - lz], [bx + lx, 0, bz + lz], [bx + Math.cos(a) * 0.3, h, bz + Math.sin(a) * 0.3], C.schilf);
          }
          klein.frei();
        } else {
          // Fels, der aus dem Wasser ragt und bis zum Grund reicht
          const r = 1.3 + rnd() * 1.1;
          const h = Math.max(1.5, wy - g + r * 0.6);
          gross.lage(x, wy + r * 0.6 - h / 2, z, rnd() * 6);
          gross.geo(new THREE.IcosahedronGeometry(1, 0), jit(C.fels, 0.08, rnd()), 0, 0, 0, 0, 0, 0, r * 1.3, h / 2, r);
          gross.frei();
        }
        merke(x, z, 2);
        n++;
      }
    }

    // Halb versunkenes altes Boot (spitzer Bug, schräg, halb unter Wasser – kein Floß)
    {
      let done = false;
      for (let tries = 0; tries < 60 && !done; tries++) {
        const { i, sgn, l, wy } = uferAt(Math.floor(nU * (0.2 + rnd() * 0.3)));
        if (l < RIVER_FREE + 5) continue;
        const lat = sgn * (RIVER_FREE + 3);
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!platz(x, z, 3)) continue;
        gross.lage(x, wy, z, HD(i) + sgn * 0.5);
        const hull: V3[] = [
          [0, 0.5, 3.2],
          [0.9, 0.55, 0.8],
          [0.85, 0.5, -2.4],
          [-0.85, 0.5, -2.4],
          [-0.9, 0.55, 0.8],
        ];
        const bot: V3[] = [
          [0, -0.6, 2.6],
          [0.5, -0.8, 0.6],
          [0.5, -0.7, -2.2],
          [-0.5, -0.7, -2.2],
          [-0.5, -0.8, 0.6],
        ];
        // gekippt: alles um die Längsachse geneigt, das Heck tiefer
        const tilt = (p: V3): V3 => [p[0] * 0.9 - p[1] * 0.42, p[1] * 0.9 + p[0] * 0.42 - (2.4 - p[2]) * 0.18, p[2]];
        const ref: V3 = [0, 0, 0];
        for (let q = 0; q < 5; q++) {
          const j = (q + 1) % 5;
          gross.flaeche(tilt(bot[q]), tilt(bot[j]), tilt(hull[j]), tilt(hull[q]), q === 2 ? C.bootD : C.boot, tilt(ref));
          gross.flaeche(tilt(bot[j]), tilt(bot[q]), tilt([hull[q][0] * 0.85, hull[q][1] - 0.05, hull[q][2] * 0.92]), tilt([hull[j][0] * 0.85, hull[j][1] - 0.05, hull[j][2] * 0.92]), C.bootD, tilt(ref), false);
        }
        gross.box(0, 0.25, 0, 1.6, 0.1, 0.3, C.bootD, 0.4);
        gross.frei();
        merke(x, z, 3.5);
        done = true;
      }
    }

    // Krokodil auf einer Sandbank – außen, weit vom Fahrweg (mindestens 11 m neben der Kante).
    {
      let done = false;
      for (let k = Math.floor(nU * 0.55); k < nU && !done; k++) {
        const { i, sgn, l, wy } = uferAt(k);
        if (sgn > 0 || l < 21) continue;
        const lat = -(l - 1.2);
        if (Math.abs(lat) < 19.6) continue;
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!platz(x, z, 4)) continue;
        const rot = HD(i) + 0.4;
        // Sandbank
        klein.lage(x, wy - 0.55, z, rot);
        klein.geo(new THREE.IcosahedronGeometry(1, 1), C.sand, 0, 0, 0, 0, 0, 0, 3.4, 0.75, 5.2);
        klein.frei();
        const y = wy + 0.12;
        gross.lage(x, y, z, rot);
        gross.geo(new THREE.IcosahedronGeometry(1, 0), C.kroko, 0, 0.3, 0, 0, 0, 0, 0.75, 0.38, 1.6);
        gross.geo(new THREE.IcosahedronGeometry(1, 0), C.krokoH, 0, 0.12, 0.2, 0, 0, 0, 0.6, 0.18, 1.2);
        for (let q = 0; q < 4; q++) gross.box(0, 0.62, -0.9 + q * 0.5, 0.35, 0.12, 0.25, C.krokoD);
        for (const sx of [-1, 1]) for (const sz of [-0.7, 0.8]) gross.stab([sx * 0.55, 0.25, sz], [sx * 0.95, 0.0, sz + 0.25], 0.18, C.kroko);
        gross.frei();
        dyn.beginn();
        // Kopf: Unterkiefer fest, Oberkiefer klappt (die Teilmatrix dreht den ganzen Kopf leicht hoch)
        dyn.box(0, 0.08, 0.7, 0.62, 0.22, 1.4, C.kroko);
        dyn.box(0, 0.2, 0.25, 0.5, 0.2, 0.4, C.krokoD);
        dyn.box(0.2, 0.34, 0.15, 0.14, 0.14, 0.14, C.gelb);
        dyn.box(-0.2, 0.34, 0.15, 0.14, 0.14, 0.14, C.gelb);
        for (let q = 0; q < 4; q++) {
          dyn.box(0.27, -0.05, 0.4 + q * 0.28, 0.05, 0.1, 0.06, C.weiss);
          dyn.box(-0.27, -0.05, 0.4 + q * 0.28, 0.05, 0.1, 0.06, C.weiss);
        }
        const kopf = dyn.ende(0);
        dyn.beginn();
        dyn.geo(new THREE.ConeGeometry(0.42, 2.8, 5, 1, false), C.kroko, 0, 0, -1.4, -Math.PI / 2, 0, 0, 1, 1, 0.55);
        for (let q = 0; q < 4; q++) dyn.box(0, 0.22 - q * 0.04, -0.3 - q * 0.55, 0.2, 0.1, 0.22, C.krokoD);
        const schwanz = dyn.ende(0);
        krokodil.push(kopf, schwanz, x, y, z, rot, rnd() * 10);
        merke(x, z, 5);
        done = true;
      }
    }

    // Reiher im seichten Wasser an der Uferlinie
    for (let k = 0, got = 0; k < 80 && got < (hi ? 4 : 3); k++) {
      const { i, sgn, l, wy } = uferAt(Math.floor(rnd() * nU));
      const lat = sgn * (l - 0.6);
      if (Math.abs(lat) < RIVER_FREE + 1.5) continue;
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!platz(x, z, 1.2)) continue;
      reiherBau(x, Math.max(wy - 0.35, G(x, z)), z, HD(i) + (rnd() - 0.5) * 2);
      merke(x, z, 1.2);
      got++;
    }

    // Libellen: über dem Wasser vor dem Ufer
    for (let k = 0; k < (hi ? 10 : detail === 1 ? 7 : 4); k++) {
      const { i, sgn, l, wy } = uferAt(Math.floor(rnd() * nU));
      const lat = sgn * (RIVER_FREE + 2.5 + rnd() * Math.max(0.5, l - RIVER_FREE - 2.5));
      libellen.push(X(i, lat), wy + 0.9 + rnd() * 0.8, Z(i, lat), rnd() * 10);
    }

    // Ufersaum: Büsche und Farne auf dem Uferhang, Bananen, ein paar Palmen.
    for (let k = 0; k < nU; k++) {
      const { i, sgn, l } = uferAt(k);
      if (rnd() > 0.7 * dichte) continue;
      const lat = sgn * (l + 1.5 + rnd() * 8);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 3.8) || !platz(x, z, 1)) continue;
      const g = G(x, z);
      if (!trocken(x, z, g)) continue;
      const r = rnd();
      if (r < 0.4) busch(klein, x, z, 0.9 + rnd() * 0.6, g);
      else if (r < 0.7) farn(klein, x, z, 1.1, g);
      else if (r < 0.85) banane(klein, x, z, 1.5);
      else palme(klein, x, z, 8 + rnd() * 4, (rnd() - 0.5) * 2);
      merke(x, z, 0.9);
    }

    // Anleger-Häuschen mit Schild am Einstieg in den Fluss
    {
      const i = S(470);
      const lat = 15.2;
      const x = X(i, lat);
      const z = Z(i, lat);
      const rot = ZUR(i, 1);
      const py = Math.max(G(x, z) + 1.2, t.py[i] - 0.2);
      pfahlhaus(x, z, rot, py, 3.8, 3.8, { dach: C.stroh });
      bewohner(LX(x, rot, -1.1, 1.3), py, LZ(z, rot, -1.1, 1.3), rot, true);
      // Schild an zwei Pfosten, zur ankommenden Fahrt gedreht: gelbe Tafel mit Floß und Welle
      const si = S(462);
      const sl = 14.2;
      const sx = X(si, sl);
      const sz = Z(si, sl);
      const sg = G(sx, sz);
      const srot = HD(si) + Math.PI + 0.35;
      gross.lage(sx, sg, sz, srot);
      gross.klotz(-1.2, 1.4, 0, 0.2, 2.8, 0.2, C.holzD);
      gross.klotz(1.2, 1.4, 0, 0.2, 2.8, 0.2, C.holzD);
      gross.box(0, 2.6, 0, 3.2, 1.6, 0.14, C.gelb);
      gross.box(0, 2.6, 0, 3.0, 0.06, 0.16, C.schwarz);
      gross.frei();
      // Bild: Floß (braune Bohlen) über einer blauen Welle, vorne aufgemalt
      glut.lage(sx, sg, sz, srot);
      const zf = 0.085;
      for (let q = 0; q < 4; q++) glut.quad([-1.0 + q * 0.5, 2.75, zf], [-0.6 + q * 0.5, 2.75, zf], [-0.6 + q * 0.5, 3.15, zf], [-1.0 + q * 0.5, 3.15, zf], rgb(0x7a4a2a));
      glut.quad([-1.2, 2.1, zf], [1.2, 2.1, zf], [1.2, 2.45, zf], [-1.2, 2.45, zf], rgb(0x2f8fd8));
      for (let q = 0; q < 4; q++) glut.tri([-1.2 + q * 0.6, 2.45, zf], [-0.9 + q * 0.6, 2.62, zf], [-0.6 + q * 0.6, 2.45, zf], rgb(0x2f8fd8));
      glut.frei();
      fahne(LX(x, rot, 1.6, -1.6), py + 6.2, LZ(z, rot, 1.6, -1.6), 1.6, 0.8, C.blau, C.weiss);
      gross.stab([LX(x, rot, 1.6, -1.6), py, LZ(z, rot, 1.6, -1.6)], [LX(x, rot, 1.6, -1.6), py + 7.0, LZ(z, rot, 1.6, -1.6)], 0.12, C.holzD);
    }
  }

  // ==================================================================================
  // 4. Wasserfall und Becken (674–735; Wahrzeichen 696)
  // ==================================================================================
  {
    const iK = S(676); // Kante
    const yK = t.py[iK];
    // Felswände links und rechts des Falls: Säulen gestaffelt, oben moosig, mit Farnen auf den Vorsprüngen.
    for (const sgn of [-1, 1]) {
      for (let m = 662; m <= 706; m += 4.2) {
        const i = S(m);
        for (let row = 0; row < 2; row++) {
          const lat = sgn * (RIVER_FREE + 1.4 + row * 4.2 + rnd() * 1.5);
          const x = X(i, lat);
          const z = Z(i, lat);
          const r = 2.6 + rnd() * 1.6;
          if (!frei(x, z, r)) continue;
          const g = Math.min(G(x, z), yK) - 1.5;
          const f = smooth((m - 662) / 12) * (1 - smooth((m - 690) / 16));
          // Oberkante: an der Kante etwas über dem Fluss, flussab zum Becken hin niedriger, außen höher.
          const top = Math.max(g + 2, yK + 0.8 + row * 1.6 - (m > 684 ? (m - 684) * 0.35 : 0) + rnd() * 1.2) - (1 - f) * 2;
          saeule(gross, x, g, z, r, top - g, true);
          if (rnd() < 0.5) farn(klein, x + (rnd() - 0.5) * r, z + (rnd() - 0.5) * r, 0.9, top + 0.2);
        }
      }
    }
    // Fels hinter dem Vorhang: eine Wand quer unter der Kante, vom Becken bis knapp unter die Fahrbahn.
    {
      const i = S(687);
      const rot = HD(i);
      const yTop = Math.min(t.py[i], yK) - 1.4;
      const N = 7;
      for (let k = 0; k < N; k++) {
        const lat = -10.5 + (21 * k) / (N - 1);
        const x = X(i, lat) + t.tx[i] * (-3.6 - rnd());
        const z = Z(i, lat) + t.tz[i] * (-3.6 - rnd());
        const g = Math.min(G(x, z), 0) - 1;
        if (yTop - g < 2) continue;
        gross.lage(x, g, z, rot + (rnd() - 0.5) * 0.3);
        gross.geo(new THREE.CylinderGeometry(2.2, 2.6, yTop - g, 6, 1, false), jit(C.felsD, 0.08, rnd()), 0, (yTop - g) / 2, 0);
        gross.frei();
      }
    }
    // Zwei steinerne Wächter auf den Felsen an der Kante, Blick flussauf zu den Ankommenden.
    for (const sgn of [-1, 1]) {
      const i = S(679);
      const lat = sgn * 15.5;
      const x = X(i, lat);
      const z = Z(i, lat);
      const g = Math.max(G(x, z), yK + 1.2);
      const rot = HD(i) + Math.PI + sgn * 0.35;
      // Sockel aus Fels, der bis ins Gelände reicht
      saeule(gross, x, Math.min(G(x, z), yK) - 2, z, 3.2, g - Math.min(G(x, z), yK) + 2, false);
      gross.lage(x, g, z, rot);
      const s = 1.5;
      gross.klotz(0, 0.5 * s, 0, 2.4 * s, 1.0 * s, 2.0 * s, C.steinD);
      gross.klotz(0, 2.0 * s, -0.1 * s, 1.7 * s, 2.0 * s, 1.3 * s, C.stein);
      // verschränkte Arme
      gross.box(0, 2.1 * s, 0.6 * s, 1.9 * s, 0.5 * s, 0.4 * s, C.steinD);
      // Kopf mit schwerer Stirn, Ohrenscheiben und Federkrone
      gross.box(0, 3.75 * s, 0, 1.9 * s, 1.5 * s, 1.5 * s, C.stein);
      gross.box(0, 4.35 * s, 0.25 * s, 2.1 * s, 0.35 * s, 1.3 * s, C.steinD);
      gross.box(1.15 * s, 3.7 * s, 0, 0.35 * s, 0.9 * s, 0.9 * s, C.steinD);
      gross.box(-1.15 * s, 3.7 * s, 0, 0.35 * s, 0.9 * s, 0.9 * s, C.steinD);
      for (let q = -1; q <= 1; q++) gross.box(q * 0.55 * s, 5.05 * s, -0.2 * s, 0.4 * s, 1.1 * s, 0.3 * s, C.steinD, 0, C.moos);
      // Mund
      gross.box(0, 3.25 * s, 0.76 * s, 1.0 * s, 0.2 * s, 0.05 * s, C.felsD);
      // Moos auf den Schultern
      gross.geo(new THREE.IcosahedronGeometry(1, 0), C.moos, 0.7 * s, 3.0 * s, -0.2 * s, 0, 0, 0, 0.6 * s, 0.25 * s, 0.6 * s);
      gross.frei();
      // Augen glimmen bernsteinfarben (ohne Licht)
      glut.lage(x, g, z, rot);
      glut.box(0.45 * s, 3.85 * s, 0.77 * s, 0.42 * s, 0.26 * s, 0.04 * s, rgb(0xffc23a));
      glut.box(-0.45 * s, 3.85 * s, 0.77 * s, 0.42 * s, 0.26 * s, 0.04 * s, rgb(0xffc23a));
      glut.frei();
      merke(x, z, 3.5);
    }
    // Uferfelsen ums Becken
    for (let k = 0; k < anz(18); k++) {
      const m = 698 + rnd() * 44;
      const i = S(m);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const r = 1.2 + rnd() * 1.8;
      const lat = sgn * (t.wh[i] + 3.5 + r + rnd() * 14);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, r * 1.35) || !platz(x, z, r)) continue;
      fels(gross, x, Math.max(G(x, z), LAKE - 0.4), z, r * 1.3, r * 0.8, r, rnd() < 0.6);
      if (rnd() < 0.4 && frei(x + r, z, 2.2)) farn(klein, x + r, z, 0.9, Math.max(G(x + r, z), LAKE));
      merke(x, z, r);
    }
    // Regenbogen in der Gischt: flacher, halbtransparenter Bogen aus Farbstreifen, neben der Bahn.
    {
      const i = S(712);
      const lat = -27;
      const cx = X(i, lat);
      const cz = Z(i, lat);
      const cy = Math.max(LAKE, G(cx, cz)) - 1;
      const ax = rightX(t, i);
      const az = rightZ(t, i);
      const bands = [0xff4a4a, 0xff9a3a, 0xffe85a, 0x5ae06a, 0x4aa8ff, 0x9a6aff];
      const R0 = 13;
      const W = 0.75;
      const N = 18;
      for (let b = 0; b < bands.length; b++) {
        const r0 = R0 - b * W;
        const r1 = r0 - W;
        const c = rgb(bands[b]);
        for (let k = 0; k < N; k++) {
          const a0 = 0.18 + ((Math.PI - 0.36) * k) / N;
          const a1 = 0.18 + ((Math.PI - 0.36) * (k + 1)) / N;
          // Enden blassen aus
          const c0: RGBA = [c[0], c[1], c[2], 0.5 * Math.sin(a0) ** 1.5];
          const c1: RGBA = [c[0], c[1], c[2], 0.5 * Math.sin(a1) ** 1.5];
          const P = (a: number, r: number): V3 => [cx + ax * Math.cos(a) * r, cy + Math.sin(a) * r, cz + az * Math.cos(a) * r];
          hauch.quad(P(a0, r0), P(a1, r0), P(a1, r1), P(a0, r1), c0, c1, c1, c0);
        }
      }
    }
  }

  // ==================================================================================
  // 5. Die Furt (735–879): offen und hell
  // ==================================================================================
  const capys: number[] = []; // Teil Kopf, x, y, z, Gier, Phase
  {
    // Kiesbänke beidseits im flachen Wasser
    for (let k = 0; k < anz(16); k++) {
      const m = 740 + rnd() * 135;
      const i = S(m);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const lat = sgn * (t.wh[i] + 6 + rnd() * 20);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 3) || !platz(x, z, 3)) continue;
      const y = Math.max(LAKE - 0.25, G(x, z) - 0.25);
      klein.lage(x, y, z, HD(i) + (rnd() - 0.5) * 0.6);
      klein.geo(new THREE.IcosahedronGeometry(1, 0), rnd() < 0.5 ? C.kies : C.sand, 0, 0, 0, 0, rnd(), 0, 2.6 + rnd() * 1.5, 0.55, 5 + rnd() * 3);
      for (let q = 0; q < 3; q++) klein.geo(new THREE.OctahedronGeometry(0.35 + rnd() * 0.3, 0), C.kiesD, (rnd() - 0.5) * 3, 0.42, (rnd() - 0.5) * 6);
      klein.frei();
      merke(x, z, 3);
      // Treibholz auf manchen Bänken
      if (rnd() < 0.55) {
        const rot = rnd() * 6;
        gross.lage(x, y + 0.6, z, rot);
        const L = 4 + rnd() * 3;
        gross.geo(new THREE.CylinderGeometry(0.28, 0.36, L, 6, 1, false), C.treib, 0, 0, 0, 0, 0, Math.PI / 2 + 0.08);
        gross.stab([L * 0.3, 0.1, 0], [L * 0.45, 0.9, 0.4], 0.14, C.treibD);
        gross.stab([-L * 0.5, 0, 0], [-L * 0.65, 0.5, -0.6], 0.16, C.treibD);
        gross.stab([-L * 0.5, 0, 0], [-L * 0.62, -0.1, 0.7], 0.14, C.treibD);
        gross.frei();
      }
    }
    // Hohe Gräser in Büscheln am Rand
    const grasBusch = (x: number, z: number, g: number): void => {
      klein.lage(x, g - 0.05, z, rnd() * 6);
      for (let q = 0; q < 5; q++) {
        const a = (q / 5) * Math.PI * 2 + rnd();
        const h = 1.6 + rnd() * 1.1;
        const r = 0.25;
        const lx = Math.cos(a + 1.57) * 0.12;
        const lz = Math.sin(a + 1.57) * 0.12;
        const tipx = Math.cos(a) * (0.6 + rnd() * 0.4);
        const tipz = Math.sin(a) * (0.6 + rnd() * 0.4);
        klein.tri([Math.cos(a) * r - lx, 0, Math.sin(a) * r - lz], [Math.cos(a) * r + lx, 0, Math.sin(a) * r + lz], [tipx, h, tipz], q % 2 ? C.gras : C.grasH);
      }
      klein.frei();
    };
    for (let k = 0, got = 0; k < 400 && got < anz(70); k++) {
      const m = 736 + rnd() * 150;
      const i = S(m);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const lat = sgn * (t.wh[i] + 3.6 + rnd() * 24);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 0.6)) continue;
      const g = G(x, z);
      if (g < LAKE + 0.15) continue;
      grasBusch(x, z, g);
      got++;
    }
    // Reiher an der Furt
    for (let k = 0, got = 0; k < 60 && got < (hi ? 3 : 2); k++) {
      const i = S(745 + rnd() * 125);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const lat = sgn * (t.wh[i] + 7 + rnd() * 12);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 1) || !platz(x, z, 1.2)) continue;
      reiherBau(x, Math.max(G(x, z), LAKE - 0.3), z, rnd() * 6);
      merke(x, z, 1.2);
      got++;
    }
    // Wasserschweine (eigener, einfacher Entwurf): eine Familie am Ufer, sie grasen.
    {
      let done = 0;
      for (let k = 0; k < 120 && done < (hi ? 4 : detail === 1 ? 3 : 2); k++) {
        const i = S(780 + rnd() * 70);
        const lat = t.wh[i] + 6 + rnd() * 10;
        const x = X(i, lat) + (rnd() - 0.5) * 3;
        const z = Z(i, lat) + (rnd() - 0.5) * 3;
        if (!frei(x, z, 1) || !platz(x, z, 1.2)) continue;
        const g = G(x, z);
        if (g < LAKE + 0.3) continue;
        const rot = rnd() * 6;
        const s = done === 3 ? 0.6 : 1;
        gross.lage(x, g, z, rot);
        gross.geo(new THREE.IcosahedronGeometry(1, 0), C.capy, 0, 0.62 * s, 0, 0, 0, 0, 0.5 * s, 0.45 * s, 0.85 * s);
        for (const sx of [-1, 1]) for (const sz of [-0.45, 0.45]) gross.box(sx * 0.28 * s, 0.18 * s, sz * s, 0.16 * s, 0.4 * s, 0.16 * s, C.capyD);
        gross.frei();
        dyn.beginn();
        dyn.box(0, -0.05 * s, 0.32 * s, 0.42 * s, 0.4 * s, 0.6 * s, C.capy);
        dyn.box(0, -0.12 * s, 0.62 * s, 0.38 * s, 0.3 * s, 0.12 * s, C.capyD);
        dyn.box(0.16 * s, 0.2 * s, 0.1 * s, 0.1 * s, 0.12 * s, 0.06 * s, C.capyD);
        dyn.box(-0.16 * s, 0.2 * s, 0.1 * s, 0.1 * s, 0.12 * s, 0.06 * s, C.capyD);
        dyn.box(0.22 * s, 0.05 * s, 0.4 * s, 0.04 * s, 0.08 * s, 0.08 * s, C.schwarz);
        dyn.box(-0.22 * s, 0.05 * s, 0.4 * s, 0.04 * s, 0.08 * s, 0.08 * s, C.schwarz);
        const p = dyn.ende(0);
        capys.push(p, LX(x, rot, 0, 0.75 * s), g + 0.85 * s, LZ(z, rot, 0, 0.75 * s), rot, rnd() * 10);
        merke(x, z, 1.2);
        done++;
      }
    }
    // Ein paar Palmen weiter draußen (das Tiefland bleibt offen)
    for (let k = 0, got = 0; k < 80 && got < anz(8); k++) {
      const i = S(740 + rnd() * 140);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const lat = sgn * (t.wh[i] + 16 + rnd() * 20);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 1) || !platz(x, z, 2)) continue;
      const g = G(x, z);
      if (g < LAKE + 0.4) continue;
      palme(klein, x, z, 9 + rnd() * 5, (rnd() - 0.5) * 2.4);
      merke(x, z, 1.5);
      got++;
    }
  }

  // ==================================================================================
  // 6. Der Hang hinauf: Ruinen, Hängebrücke über den Seitenbach, Nebel, Fernsicht
  // ==================================================================================
  {
    // Überwucherte Stufen (innen)
    {
      const i = S(1010);
      const lat = 15.5;
      const x = X(i, lat);
      const z = Z(i, lat);
      if (platz(x, z, 4)) {
        const g = G(x, z) - 0.3;
        const rot = ZUR(i, 1);
        gross.lage(x, g, z, rot);
        for (let k = 0; k < 4; k++) gross.klotz(0, 0.3 + k * 0.6, -k * 0.9, 5.2 - k * 0.6, 0.6 + k * 1.2, 1.0, k % 2 ? C.steinD : C.stein, 0, C.moos);
        // Rest einer Mauer
        gross.klotz(2.4, 1.6, -2.6, 0.9, 3.2, 0.9, C.steinD, 0, C.moos);
        gross.frei();
        farn(klein, LX(x, rot, -2.6, 0.5), LZ(z, rot, -2.6, 0.5), 1.1, g + 0.2);
        blueten(LX(x, rot, 1.8, 0.2), LZ(z, rot, 1.8, 0.2), g, 2, 0.6);
        liane(LX(x, rot, 2.4, -2.6), LZ(z, rot, 2.4, -2.6), g + 3.2, g + 1.4);
        merke(x, z, 4);
      }
    }
    // Umgestürzte Stele (außen): liegender Block mit eingemeißeltem Gesicht, der Stumpf steht noch.
    {
      const i = S(1068);
      const lat = -15;
      const x = X(i, lat);
      const z = Z(i, lat);
      if (platz(x, z, 3.5)) {
        const g = G(x, z) - 0.2;
        const rot = HD(i) + 0.5;
        gross.lage(x, g, z, rot);
        gross.klotz(0, 0.5, -2.4, 1.3, 1.0, 1.0, C.steinD, 0, C.moos);
        gross.box(0, 0.5, 0.6, 1.2, 0.9, 4.2, C.stein, 0, C.moos);
        // Gesicht auf der Oberseite des Kopfendes
        gross.box(0.3, 0.97, 2.0, 0.3, 0.05, 0.25, C.felsD);
        gross.box(-0.3, 0.97, 2.0, 0.3, 0.05, 0.25, C.felsD);
        gross.box(0, 0.97, 1.4, 0.6, 0.05, 0.15, C.felsD);
        gross.frei();
        farn(klein, LX(x, rot, 1.2, 0), LZ(z, rot, 1.2, 0), 0.9, g + 0.1);
        merke(x, z, 3.5);
      }
    }
    // Seitenbach mit Hängebrücke (außen, neben der Strecke): der Bach fließt von der Böschung zum See.
    {
      const i = S(1192);
      const sgn = -1;
      const rot = HD(i);
      // Bachlauf: Band quer zur Strecke, von 13 m bis zum See
      const pts: V3[] = [];
      for (let lat = 13; lat < 90; lat += 3) {
        const x = X(i, sgn * lat) + t.tx[i] * Math.sin(lat * 0.15) * 2.5;
        const z = Z(i, sgn * lat) + t.tz[i] * Math.sin(lat * 0.15) * 2.5;
        const g = G(x, z);
        pts.push([x, g + 0.12, z]);
        if (g < LAKE) break;
      }
      const ax = t.tx[i];
      const az = t.tz[i];
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        const w = 1.3 + k * 0.08;
        klein.quad([a[0] - ax * w, a[1], a[2] - az * w], [a[0] + ax * w, a[1], a[2] + az * w], [b[0] + ax * w, b[1], b[2] + az * w], [b[0] - ax * w, b[1], b[2] - az * w], C.bach);
        if (k % 2 === 0) klein.quad([a[0] - ax * 0.3, a[1] + 0.03, a[2] - az * 0.3], [a[0] + ax * 0.5, a[1] + 0.03, a[2] + az * 0.5], [b[0] + ax * 0.2, b[1] + 0.03, b[2] + az * 0.2], [b[0] - ax * 0.4, b[1] + 0.03, b[2] - az * 0.4], C.schaum);
        if (k % 2 === 1 && k < 14) {
          fels(klein, a[0] + ax * (w + 0.4), a[1], a[2] + az * (w + 0.4), 0.6, 0.4, 0.5);
          fels(klein, a[0] - ax * (w + 0.5), a[1], a[2] - az * (w + 0.5), 0.7, 0.45, 0.6);
        }
      }
      // Quelle: Felsen an der Böschung
      if (pts.length > 0) fels(gross, pts[0][0], pts[0][1] + 0.4, pts[0][2], 1.6, 1.2, 1.4);
      // Hängebrücke: längs der Strecke, 18 m lang, über den Bach bei 22 m Seitenabstand
      const bl = 22;
      const m0 = -9;
      const m1 = 9;
      const bx = X(i, sgn * bl);
      const bz = Z(i, sgn * bl);
      const gb = G(bx, bz);
      const yD = gb + 3.6;
      const tower = (lm: number): void => {
        const x = bx + ax * lm;
        const z = bz + az * lm;
        const g = G(x, z) - 0.3;
        gross.lage(x, 0, z, rot);
        for (const sx of [-1, 1]) gross.klotz(sx * 0.9, (g + yD + 1.4) / 2, 0, 0.28, yD + 1.4 - g, 0.28, C.pfahl);
        gross.box(0, yD + 1.3, 0, 2.1, 0.22, 0.22, C.pfahl);
        gross.frei();
        fels(gross, x, g + 0.2, z, 1.6, 1.0, 1.4);
      };
      tower(m0);
      tower(m1);
      const N = 14;
      const yAt = (u: number): number => yD - 0.9 * 4 * u * (1 - u);
      gross.lage(bx, 0, bz, rot);
      for (let k = 0; k < N; k++) {
        const u0 = k / N;
        const u1 = (k + 0.8) / N;
        const za = m0 + (m1 - m0) * u0;
        const zb = m0 + (m1 - m0) * u1;
        gross.quad([-0.75, yAt(u0), za], [0.75, yAt(u0), za], [0.75, yAt(u1), zb], [-0.75, yAt(u1), zb], C.holzH);
        gross.quad([0.75, yAt(u0) - 0.1, za], [-0.75, yAt(u0) - 0.1, za], [-0.75, yAt(u1) - 0.1, zb], [0.75, yAt(u1) - 0.1, zb], C.holzD);
      }
      for (const sx of [-0.85, 0.85]) {
        const M = 6;
        for (let k = 0; k < M; k++) {
          const u0 = k / M;
          const u1 = (k + 1) / M;
          const za = m0 + (m1 - m0) * u0;
          const zb = m0 + (m1 - m0) * u1;
          gross.stab([sx, yAt(u0) + 1.1 - 0.3 * 4 * u0 * (1 - u0), za], [sx, yAt(u1) + 1.1 - 0.3 * 4 * u1 * (1 - u1), zb], 0.07, C.holzD);
          if (k > 0) gross.stab([sx, yAt(u0), za], [sx, yAt(u0) + 1.1 - 0.3 * 4 * u0 * (1 - u0), za], 0.05, C.holzD);
        }
      }
      gross.frei();
      merke(bx, bz, 10);
    }

    // Nebelschwaden in den Baumkronen am Hang
    const nebel = hi ? 22 : detail === 1 ? 16 : 9;
    const mitte: RGBA = [1, 1, 0.96, 0.42];
    const rand0: RGBA = [1, 1, 0.96, 0];
    for (let k = 0, got = 0; k < 300 && got < nebel; k++) {
      const i = S(900 + rnd() * 440);
      const sgn = rnd() < 0.5 ? -1 : 1;
      const lat = sgn * (10 + rnd() * 50);
      const x = X(i, lat);
      const z = Z(i, lat);
      const g = Math.max(G(x, z), LAKE);
      const y = Math.max(g + 13 + rnd() * 6, t.py[i] + 12);
      if (!luft(x, y, z)) continue;
      const rx = 9 + rnd() * 9;
      const rz = 4 + rnd() * 4;
      const a = rnd() * Math.PI;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const N = 10;
      for (let q = 0; q < N; q++) {
        const b0 = (q / N) * Math.PI * 2;
        const b1 = ((q + 1) / N) * Math.PI * 2;
        const P = (b: number, w: number): V3 => {
          const lx = Math.cos(b) * rx * w;
          const lz = Math.sin(b) * rz * w;
          return [x + lx * ca - lz * sa, y + Math.sin(b * 3 + k) * 0.6 * w, z + lx * sa + lz * ca];
        };
        hauch.tri([x, y + 0.2, z], P(b1, 1), P(b0, 1), mitte, rand0, rand0);
      }
      got++;
    }
  }

  // ==================================================================================
  // 7. Blätterdach in der Ferne: Kronen über dem ganzen Land, und Tafelberge am Horizont
  // ==================================================================================
  {
    const want = hi ? 72 : detail === 1 ? 60 : 36;
    let got = 0;
    for (let k = 0; k < want * 8 && got < want; k++) {
      const x = world.center.x + (rnd() - 0.5) * (world.radius * 2 + 160);
      const z = world.center.z + (rnd() - 0.5) * (world.radius * 2 + 160);
      const c = world.clearance(x, z);
      if (c < 22) continue;
      const g = G(x, z);
      if (g < LAKE + 0.8) continue;
      if (!platz(x, z, 4)) continue;
      // Dorf und Furt bleiben offen
      const p = projectNear(x, z);
      const m = p.i * t.step;
      if (c < 45 && !imWald(m) && !inM(m, 479, 680)) continue;
      const R = 5 + rnd() * 5;
      const H = 10 + rnd() * 8;
      klein.lage(x, g - 0.5, z, rnd() * 6);
      klein.stab([0, 0, 0], [0, H, 0], 1.0, C.rindeD);
      klein.geo(new THREE.IcosahedronGeometry(1, 0), jit(pick(C.laub), 0.18, rnd()), 0, H + 1, 0, 0, rnd() * 3, 0, R, 2.4 + rnd() * 1.4, R * 0.9);
      klein.frei();
      merke(x, z, R * 0.6);
      got++;
    }
    // Tafelberge: flache Kuppen mit steilen Wänden, weit hinter dem See (ohne Dunst, dafür blass gefärbt)
    const fog = rgb(th.fog);
    const wand = mix(rgb(0x4f7a6a), fog, 0.5);
    const wandD = mix(rgb(0x3f665a), fog, 0.5);
    const kappe = mix(rgb(0x3f8a4a), fog, 0.5);
    const berge: [number, number, number, number][] = [
      // Winkel (von der Mitte, 0 = +x), Entfernung, Breite, Höhe
      [Math.PI * 1.02, 1150, 170, 70],
      [Math.PI * 0.86, 1250, 120, 52],
      [Math.PI * 1.22, 1100, 130, 85],
      [Math.PI * 0.62, 1300, 180, 60],
      [Math.PI * 1.42, 1250, 150, 55],
      [Math.PI * 0.2, 1350, 170, 65],
      [Math.PI * 1.75, 1300, 140, 58],
    ];
    for (const [a, d, w, h] of detail === 0 ? [] : berge) {
      const cx = world.center.x + Math.cos(a) * d;
      const cz = world.center.z + Math.sin(a) * d;
      const N = 9;
      const y0 = -10;
      const pts: [number, number][] = [];
      for (let q = 0; q < N; q++) {
        const b = (q / N) * Math.PI * 2;
        const r = w * (0.75 + rnd() * 0.3);
        pts.push([cx + Math.cos(b) * r, cz + Math.sin(b) * r * 0.6]);
      }
      const top = h * (0.9 + rnd() * 0.2);
      for (let q = 0; q < N; q++) {
        const [x0, z0] = pts[q];
        const [x1, z1] = pts[(q + 1) % N];
        const shrink = 0.78;
        const t0: V3 = [cx + (x0 - cx) * shrink, top, cz + (z0 - cz) * shrink];
        const t1: V3 = [cx + (x1 - cx) * shrink, top, cz + (z1 - cz) * shrink];
        fern.flaeche([x0, y0, z0], [x1, y0, z1], t1, t0, q % 2 ? wand : wandD, [cx, top / 2, cz]);
        fern.dreieck([cx, top + h * 0.04, cz], t0, t1, kappe, [cx, -100, cz]);
      }
    }
  }

  // ==================================================================================
  // 8. Vögel: Tukane und Papageien sitzen auf den Kronen, fliegen auf und drehen eine Runde
  // ==================================================================================
  const voegel: number[] = []; // Körper, FlügelL, FlügelR, x, y, z (Sitz), Radius, Richtung, Kreiswinkel, Höhe, Takt, Phase
  {
    const nKr = kronen.length / 5;
    const want = hi ? 10 : detail === 1 ? 7 : 4;
    for (let k = 0; k < nKr && voegel.length / 12 < want; k += Math.max(1, Math.floor(nKr / want))) {
      const x = kronen[k * 5];
      const y = kronen[k * 5 + 1] + 0.9;
      const z = kronen[k * 5 + 2];
      const R = 14 + rnd() * 10;
      const th0 = rnd() * Math.PI * 2;
      let H = 6 + rnd() * 6;
      // Flugkreis: wo er die Strecke überquert, mindestens 10 m über der Bahn
      const ccx = x + Math.cos(th0) * R;
      const ccz = z + Math.sin(th0) * R;
      for (let q = 0; q < 16; q++) {
        const b = (q / 16) * Math.PI * 2;
        const px = ccx - Math.cos(th0 + b) * R;
        const pz = ccz - Math.sin(th0 + b) * R;
        const need = strY(px, pz) + 11 - y;
        if (world.clearance(px, pz) < 4 && need > 0) H = Math.max(H, need + 1);
      }
      const tukan = voegel.length / 12 % 2 === 0;
      const body = tukan ? C.schwarz : pick([C.rot, C.blau, rgb(0x3fbf4a)]);
      dyn.beginn();
      dyn.geo(new THREE.IcosahedronGeometry(1, 0), body, 0, 0, 0, 0, 0, 0, 0.28, 0.3, 0.55);
      dyn.geo(new THREE.IcosahedronGeometry(0.22, 0), body, 0, 0.2, 0.42);
      if (tukan) {
        dyn.geo(new THREE.IcosahedronGeometry(1, 0), C.weiss, 0, 0.05, 0.36, 0, 0, 0, 0.2, 0.2, 0.15);
        dyn.geo(new THREE.ConeGeometry(0.14, 0.75, 4), C.orange, 0, 0.18, 0.95, Math.PI / 2, 0, 0, 1, 1.3, 1);
      } else {
        dyn.geo(new THREE.ConeGeometry(0.08, 0.25, 4), C.gelb, 0, 0.15, 0.68, Math.PI / 2 + 0.4, 0, 0);
      }
      dyn.tri([0, 0.05, -0.4], [-0.16, 0.0, -1.0], [0.16, 0.0, -1.0], tukan ? C.schwarz : C.gelb);
      const pb = dyn.ende(0);
      const wing = (): number => {
        dyn.beginn();
        const c = tukan ? C.schwarz : pick([C.gelb, C.blau, C.rot]);
        dyn.quad([0, 0, 0.25], [0.95, 0, 0.1], [0.95, 0, -0.2], [0, 0, -0.3], c);
        return dyn.ende(0);
      };
      const wl = wing();
      const wr = wing();
      voegel.push(pb, wl, wr, x, y, z, R, rnd() < 0.5 ? 1 : -1, th0, H, 20 + rnd() * 14, rnd() * 40);
    }
  }

  // ==================================================================================
  // 9. Flatterndes: Schmetterlinge, Libellen, fallende Blätter (Instanzen eines Flügels)
  // ==================================================================================
  const falter: number[] = []; // x, y, z (Mitte des Schwarms), Phase
  {
    const want = hi ? 12 : detail === 1 ? 9 : 5;
    for (let k = 0, got = 0; k < 400 && got < want; k++) {
      const [a, b] = WALD[rnd() < 0.4 ? 0 : 1];
      const i = S(a + rnd() * (b - a));
      const sgn = rnd() < 0.5 ? -1 : 1;
      const lat = sgn * (t.wh[i] + 6 + rnd() * 6);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 3)) continue;
      const g = G(x, z);
      if (!trocken(x, z, g)) continue;
      falter.push(x, g + 1.6, z, rnd() * 10);
      blueten(x, z, g, 2, 0.4);
      got++;
    }
  }
  const PRO_SCHWARM = 4;
  const nFalter = (falter.length / 4) * PRO_SCHWARM;
  const nLib = libellen.length / 4;
  const blaetter: number[] = []; // x, y (Start), z, Fallhöhe, Takt, Phase
  {
    const nKr = kronen.length / 5;
    const want = hi ? 40 : detail === 1 ? 26 : 12;
    for (let k = 0, got = 0; k < 400 && got < want && nKr > 0; k++) {
      const q = Math.floor(rnd() * nKr);
      const a = rnd() * Math.PI * 2;
      const d = kronen[q * 5 + 3] * rnd() * 0.8;
      const x = kronen[q * 5] + Math.cos(a) * d;
      const z = kronen[q * 5 + 2] + Math.sin(a) * d;
      if (world.clearance(x, z) < 5 || flussAbst(x, z) < RIVER_FREE + 2) continue;
      const g = G(x, z);
      const y = kronen[q * 5 + 4];
      blaetter.push(x, y, z, Math.max(1, y - g - 0.1), 9 + rnd() * 6, rnd() * 20);
      got++;
    }
  }
  const nBlatt = blaetter.length / 6;
  // Instanzen: je Falter zwei Flügel, je Libelle zwei Flügel und ein Leib, je Blatt eins.
  const iFalter = 0;
  const iLib = iFalter + nFalter * 2;
  const iBlatt = iLib + nLib * 3;
  const nInst = iBlatt + nBlatt;
  const flgGeo = new THREE.BufferGeometry();
  flgGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 1, 0, 0.42, 0.95, 0, -0.38, 0, 0, 0.18, 0.95, 0, -0.38, 0.05, 0, -0.2], 3));
  flgGeo.computeVertexNormals();
  const flgMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const flatter = new THREE.InstancedMesh(flgGeo, flgMat, Math.max(1, nInst));
  flatter.count = nInst;
  flatter.frustumCulled = false;
  flatter.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const col = new THREE.Color();
    const falterF = [0xff8a2a, 0x3ac8ff, 0xffe04a, 0xff5ab0, 0x6a4aff, 0xffffff];
    for (let s = 0; s < falter.length / 4; s++) {
      for (let q = 0; q < PRO_SCHWARM; q++) {
        const c = falterF[(s + q * 2) % falterF.length];
        flatter.setColorAt(iFalter + (s * PRO_SCHWARM + q) * 2, col.set(c));
        flatter.setColorAt(iFalter + (s * PRO_SCHWARM + q) * 2 + 1, col.set(c));
      }
    }
    for (let k = 0; k < nLib; k++) {
      flatter.setColorAt(iLib + k * 3, col.set(0xa8e8ff));
      flatter.setColorAt(iLib + k * 3 + 1, col.set(0xa8e8ff));
      flatter.setColorAt(iLib + k * 3 + 2, col.set(k % 2 ? 0x2a6ad8 : 0xd83a5a));
    }
    for (let k = 0; k < nBlatt; k++) flatter.setColorAt(iBlatt + k, col.set(k % 3 === 0 ? 0xc8a03a : k % 3 === 1 ? 0x7ab03a : 0x9a7a3a));
    if (flatter.instanceColor) flatter.instanceColor.needsUpdate = true;
  }
  group.add(flatter);
  disposables.push(flgGeo, flgMat, flatter);

  // ==================================================================================
  // Netze zusammenstellen
  // ==================================================================================
  const toon = toonMaterial({ vertexColors: true });
  const toon2 = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  disposables.push(toon, toon2);
  const add = (b: Bau, mat: THREE.Material, outline: number): THREE.Mesh | null => {
    if (b.verts === 0) return null;
    const geo = b.build();
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    disposables.push(geo);
    if (outline > 0 && lines) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
    }
    return mesh;
  };
  add(gross, toon, 0.05);
  add(klein, toon2, 0);
  const glutMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  disposables.push(glutMat);
  if (glut !== klein && glut.verts > 0) {
    const g = glut.build();
    group.add(new THREE.Mesh(g, glutMat));
    disposables.push(g);
  }
  // Lichtkegel (additiv): ihr Glanz atmet langsam (kein Flackern).
  const lichtMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  disposables.push(lichtMat);
  if (licht.verts > 0) {
    const g = licht.build();
    const mesh = new THREE.Mesh(g, lichtMat);
    mesh.renderOrder = 4;
    group.add(mesh);
    disposables.push(g);
  }
  // Nebel und Regenbogen: durchscheinend, Deckkraft je Ecke.
  const hauchMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  disposables.push(hauchMat);
  if (hauch.verts > 0) {
    const g = hauch.build();
    const mesh = new THREE.Mesh(g, hauchMat);
    mesh.renderOrder = 5;
    group.add(mesh);
    disposables.push(g);
  }
  // Ferne Tafelberge: ohne Dunst (sie sind schon blass gefärbt), hinter allem anderen.
  const fernMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  disposables.push(fernMat);
  if (fern.verts > 0) {
    const g = fern.build();
    const mesh = new THREE.Mesh(g, fernMat);
    mesh.renderOrder = -7;
    group.add(mesh);
    disposables.push(g);
  }

  // Bewegtes: zwei Netze, Ecken je Bild aus der Grundform – Körper mit Kontur, Tücher (Wimpel, Wäsche, Fahnen) ohne.
  const netz = (b: Teile, outline: number): { teile: Teil[]; setze(time: number): void } => {
    const geo = b.build();
    const dPos = geo.getAttribute('position') as THREE.BufferAttribute;
    const dNor = geo.getAttribute('normal') as THREE.BufferAttribute;
    dPos.setUsage(THREE.DynamicDrawUsage);
    dNor.setUsage(THREE.DynamicDrawUsage);
    const basePos = Float32Array.from(dPos.array as Float32Array);
    const baseNor = Float32Array.from(dNor.array as Float32Array);
    const teile = b.liste;
    let on: Float32Array | null = null;
    let dON: THREE.BufferAttribute | null = null;
    const mesh = new THREE.Mesh(geo, toon2);
    mesh.frustumCulled = false;
    if (dPos.count > 0) group.add(mesh);
    disposables.push(geo);
    if (outline > 0 && lines && dPos.count > 0) {
      on = glatteNormalen(basePos, baseNor, teile);
      dON = new THREE.BufferAttribute(Float32Array.from(on), 3);
      dON.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('onormal', dON);
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      ol.frustumCulled = false;
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
    }
    const posA = dPos.array as Float32Array;
    const norA = dNor.array as Float32Array;
    const onA = dON ? (dON.array as Float32Array) : null;
    const setzeTeil = (p: Teil, time: number): void => {
      const el = p.m.elements;
      for (let i = p.v0; i < p.v1; i++) {
        const o = i * 3;
        let x = basePos[o];
        const y = basePos[o + 1];
        let z = basePos[o + 2];
        if (p.art === 2) {
          // Fahne: Welle läuft vom Mast weg und wächst zum freien Ende.
          const u = Math.max(0, x) / p.len;
          z += p.amp * u * (Math.sin(p.k * x - p.w * time + p.ph) + 0.3 * Math.sin(p.k * 2.3 * x - p.w * 1.6 * time + p.ph * 2));
          x *= 1 - 0.05 * u;
        } else if (p.art === 3) {
          // Kette: das Seil bleibt auf seiner Linie, was darunter hängt, pendelt quer.
          const u = Math.max(0, Math.min(1, x / p.len));
          const rope = p.dy * u - p.sag * 4 * u * (1 - u);
          const below = Math.max(0, rope - y - 0.06);
          const s = Math.sin(Math.PI * u);
          z += p.amp * below * Math.sin(p.k * x - p.w * time + p.ph) + 0.06 * s * Math.sin(p.w * 0.5 * time + p.ph);
        }
        posA[o] = el[0] * x + el[4] * y + el[8] * z + el[12];
        posA[o + 1] = el[1] * x + el[5] * y + el[9] * z + el[13];
        posA[o + 2] = el[2] * x + el[6] * y + el[10] * z + el[14];
        const nx = baseNor[o];
        const ny = baseNor[o + 1];
        const nz = baseNor[o + 2];
        norA[o] = el[0] * nx + el[4] * ny + el[8] * nz;
        norA[o + 1] = el[1] * nx + el[5] * ny + el[9] * nz;
        norA[o + 2] = el[2] * nx + el[6] * ny + el[10] * nz;
        if (on && onA) {
          const ax = on[o];
          const ay = on[o + 1];
          const az = on[o + 2];
          onA[o] = el[0] * ax + el[4] * ay + el[8] * az;
          onA[o + 1] = el[1] * ax + el[5] * ay + el[9] * az;
          onA[o + 2] = el[2] * ax + el[6] * ay + el[10] * az;
        }
      }
    };
    return {
      teile,
      setze(time: number): void {
        if (dPos.count === 0) return;
        for (const p of teile) setzeTeil(p, time);
        dPos.needsUpdate = true;
        dNor.needsUpdate = true;
        if (dON) dON.needsUpdate = true;
      },
    };
  };
  const koerper = netz(dyn, 0.04);
  const tuecher = tuch === dyn ? koerper : netz(tuch, 0);
  const teile = koerper.teile;

  // --- Pro Bild ----------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const m5 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const lageIn = (liste: Teil[], p: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number): void => {
    e.set(pitch, yaw, roll, 'YXZ');
    q.setFromEuler(e);
    liste[p].m.compose(v.set(x, y, z), q, sv.set(1, 1, 1));
  };
  const lage = (p: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number): void => lageIn(teile, p, x, y, z, yaw, pitch, roll);

  // Ketten und Fahnen liegen fest – nur ihre Form weht.
  for (let k = 0; k < ketten.length; k += 5) lageIn(tuecher.teile, ketten[k], ketten[k + 1], ketten[k + 2], ketten[k + 3], ketten[k + 4], 0, 0);
  for (let k = 0; k < fahnen.length; k += 5) lageIn(tuecher.teile, fahnen[k], fahnen[k + 1], fahnen[k + 2], fahnen[k + 3], fahnen[k + 4], 0, 0);

  let smokeT = 0;
  let sparkT = 0;
  let insT = 0;
  let pick2 = 0;
  const kegelN = kegel.length / 3;

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Dorfbewohner winken (in Abständen), sonst hängt der Arm ---
      for (let k = 0; k < winker.length; k += 6) {
        const ph = winker[k + 5];
        const want = smooth((Math.sin(time * 0.45 + ph) - 0.1) * 3);
        const wave = 0.35 + 0.35 * Math.sin(time * 7 + ph);
        const roll = Math.PI - 0.15 + (wave - Math.PI + 0.15) * want;
        lage(winker[k], winker[k + 1], winker[k + 2], winker[k + 3], winker[k + 4], 0, roll);
      }
      // --- Bootsbauer: hebt die Dechsel und schlägt zu ---
      for (let k = 0; k < bootsbauer.length; k += 5) {
        const c = (time * 0.9) % 1;
        const lift = c < 0.75 ? smooth(c / 0.75) : 1 - smooth((c - 0.75) / 0.12);
        lage(bootsbauer[k], bootsbauer[k + 1], bootsbauer[k + 2], bootsbauer[k + 3], bootsbauer[k + 4], -0.3 - lift * 1.9, 0);
      }
      // --- Affen schwingen an ihren Lianen (Pendel längs der Strecke) ---
      for (let k = 0; k < affen.length; k += 7) {
        const L = affen[k + 5];
        const w = Math.sqrt(9.8 / (L + 1)) * 0.9;
        const ph = affen[k + 6];
        const amp = 0.45 + 0.2 * Math.sin(time * 0.13 + ph);
        lage(affen[k], affen[k + 1], affen[k + 2], affen[k + 3], affen[k + 4], amp * Math.sin(time * w + ph), 0.05 * Math.sin(time * w * 2 + ph));
      }
      // --- Vögel: sitzen, fliegen auf, drehen eine Runde, landen ---
      for (let k = 0; k < voegel.length; k += 12) {
        const px = voegel[k + 3];
        const py = voegel[k + 4];
        const pz = voegel[k + 5];
        const R = voegel[k + 6];
        const dir = voegel[k + 7];
        const th0 = voegel[k + 8];
        const H = voegel[k + 9];
        const P = voegel[k + 10];
        const u = (((time + voegel[k + 11]) % P) + P) % P;
        const sit = P * 0.45;
        let x = px;
        let y = py;
        let z = pz;
        let yaw = th0 + Math.PI / 2;
        let pitch = 0;
        let roll = 0;
        let flap = 0;
        if (u < sit) {
          // sitzend: schaut sich um, wippt
          yaw += Math.sin(time * 0.7 + k) * 0.8;
          y += Math.abs(Math.sin(time * 2.1 + k)) * 0.05;
        } else {
          const f = (u - sit) / (P - sit);
          const a = Math.PI * 2 * smooth(f);
          const da = Math.PI * 2 * 6 * f * (1 - f);
          const cx = px + Math.cos(th0) * R;
          const cz = pz + Math.sin(th0) * R;
          const b = th0 + dir * a;
          x = cx - Math.cos(b) * R;
          z = cz - Math.sin(b) * R;
          y = py + H * Math.sin(Math.PI * f);
          // Tangente des Kreises (Bewegungsrichtung)
          const tx = Math.sin(b) * dir;
          const tz = -Math.cos(b) * dir;
          yaw = Math.atan2(tx, tz);
          pitch = -Math.cos(Math.PI * f) * 0.35;
          roll = -dir * 0.35 * Math.min(1, da / 3);
          flap = f < 0.2 || f > 0.8 ? 1 : 0.35 + 0.65 * smooth((Math.sin(time * 1.3 + k) + 0.2) * 2);
        }
        lage(voegel[k], x, y, z, yaw, pitch, roll);
        const bm = teile[voegel[k]].m;
        const ang = flap > 0 ? 0.1 + flap * Math.sin(time * 14 + k) * 0.8 : -1.25;
        for (let s = 0; s < 2; s++) {
          // rechter Flügel = gespiegelter linker (Drehung um π und Spiegelung längs)
          e.set(0, s === 0 ? 0 : Math.PI, ang, 'YXZ');
          q2.setFromEuler(e);
          m5.compose(v.set(s === 0 ? 0.2 : -0.2, 0.12, 0.02), q2, sv.set(1, 1, s === 0 ? 1 : -1));
          teile[voegel[k + 1 + s]].m.multiplyMatrices(bm, m5);
        }
      }
      // --- Reiher: stehen still, recken den Hals, picken ab und zu ---
      for (let k = 0; k < reiher.length; k += 6) {
        const ph = reiher[k + 5];
        const peck = Math.max(0, Math.sin(time * 0.6 + ph)) ** 10;
        lage(reiher[k], reiher[k + 1], reiher[k + 2], reiher[k + 3], reiher[k + 4] + Math.sin(time * 0.3 + ph) * 0.3, 0.15 + peck * 1.5, 0);
      }
      // --- Krokodil: öffnet träge das Maul, der Schwanz pendelt ---
      for (let k = 0; k < krokodil.length; k += 7) {
        const ph = krokodil[k + 6];
        const rot = krokodil[k + 5];
        const x = krokodil[k + 2];
        const y = krokodil[k + 3];
        const z = krokodil[k + 4];
        const open = smooth((Math.sin(time * 0.22 + ph) - 0.3) * 2.5);
        lage(krokodil[k], x + Math.sin(rot) * 1.4, y + 0.28, z + Math.cos(rot) * 1.4, rot, -0.5 * open, 0);
        lage(krokodil[k + 1], x - Math.sin(rot) * 1.4, y + 0.3, z - Math.cos(rot) * 1.4, rot + 0.3 * Math.sin(time * 0.5 + ph), 0, 0);
      }
      // --- Wasserschweine grasen ---
      for (let k = 0; k < capys.length; k += 6) {
        const ph = capys[k + 5];
        const graze = smooth((Math.sin(time * 0.35 + ph) + 0.2) * 2);
        lage(capys[k], capys[k + 1], capys[k + 2], capys[k + 3], capys[k + 4] + Math.sin(time * 0.2 + ph) * 0.2, 0.75 * graze + 0.06 * Math.sin(time * 5 + ph) * graze, 0);
      }

      koerper.setze(time);
      tuecher.setze(time);

      // --- Schmetterlinge ---
      for (let s = 0; s < falter.length / 4; s++) {
        const cx = falter[s * 4];
        const cy = falter[s * 4 + 1];
        const cz = falter[s * 4 + 2];
        const ph = falter[s * 4 + 3];
        for (let b = 0; b < PRO_SCHWARM; b++) {
          const p = ph + b * 1.9;
          const x = cx + Math.sin(time * 0.7 + p) * 2.2 + Math.sin(time * 1.9 + p * 2) * 0.5;
          const y = cy + Math.sin(time * 1.1 + p * 1.3) * 0.7;
          const z = cz + Math.cos(time * 0.6 + p * 0.7) * 2.2;
          const vx = Math.cos(time * 0.7 + p) * 0.7 * 2.2;
          const vz = -Math.sin(time * 0.6 + p * 0.7) * 0.6 * 2.2;
          const yaw = Math.atan2(vx, vz);
          const flap = 0.15 + 0.95 * (0.5 + 0.5 * Math.sin(time * 16 + p * 3));
          const idx = iFalter + (s * PRO_SCHWARM + b) * 2;
          for (let w = 0; w < 2; w++) {
            // Flügel: Wurzel am Leib, nach außen; der zweite gespiegelt (Drehung um π, Spiegelung längs)
            e.set(0, yaw + (w === 0 ? 0 : Math.PI), flap, 'YXZ');
            q.setFromEuler(e);
            m4.compose(v.set(x, y, z), q, sv.set(0.42, 0.42, w === 0 ? 0.42 : -0.42));
            flatter.setMatrixAt(idx + w, m4);
          }
        }
      }
      // --- Libellen: stehen in der Luft und schießen dann ein Stück weiter ---
      for (let k = 0; k < nLib; k++) {
        const ph = libellen[k * 4 + 3];
        const c = time * 0.5 + ph;
        const n = Math.floor(c);
        const f = smooth((c - n) * 4);
        const h1 = Math.sin(n * 12.9898 + ph) * 2.5;
        const h0 = Math.sin((n - 1) * 12.9898 + ph) * 2.5;
        const g1 = Math.cos(n * 7.233 + ph) * 2.5;
        const g0 = Math.cos((n - 1) * 7.233 + ph) * 2.5;
        const x = libellen[k * 4] + h0 + (h1 - h0) * f;
        const z = libellen[k * 4 + 2] + g0 + (g1 - g0) * f;
        const y = libellen[k * 4 + 1] + Math.sin(time * 2 + ph) * 0.15;
        const yaw = Math.atan2(h1 - h0, g1 - g0);
        const flap = 0.25 * Math.sin(time * 40 + ph);
        for (let w = 0; w < 2; w++) {
          e.set(0, yaw + (w === 0 ? 0 : Math.PI), 0.1 + flap, 'YXZ');
          q.setFromEuler(e);
          m4.compose(v.set(x, y, z), q, sv.set(0.55, 0.5, w === 0 ? 0.22 : -0.22));
          flatter.setMatrixAt(iLib + k * 3 + w, m4);
        }
        e.set(0, yaw - Math.PI / 2, 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v.set(x - Math.sin(yaw) * 0.4, y, z - Math.cos(yaw) * 0.4), q, sv.set(0.8, 0.5, 0.12));
        flatter.setMatrixAt(iLib + k * 3 + 2, m4);
      }
      // --- Fallende Blätter: trudeln aus den Kronen zu Boden ---
      for (let k = 0; k < nBlatt; k++) {
        const o = k * 6;
        const P = blaetter[o + 4];
        const u = (((time + blaetter[o + 5]) % P) + P) % P / P;
        if (u > 0.94) {
          flatter.setMatrixAt(iBlatt + k, zero);
          continue;
        }
        const y = blaetter[o + 1] - blaetter[o + 3] * u;
        const sw = Math.sin(time * 1.7 + k) * 1.1;
        e.set(Math.sin(time * 2.3 + k) * 0.9, time * 1.2 + k, Math.cos(time * 1.9 + k) * 0.7, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v.set(blaetter[o] + sw, y, blaetter[o + 2] + Math.cos(time * 1.3 + k) * 0.8), q, sv.set(0.35, 0.35, 0.35));
        flatter.setMatrixAt(iBlatt + k, m4);
      }
      if (nInst > 0) flatter.instanceMatrix.needsUpdate = true;

      // --- Lichtkegel atmen ganz langsam ---
      lichtMat.opacity = 0.14 + 0.03 * Math.sin(time * 0.25);

      // --- Teilchen: Rauch aus der Feuerstelle, Funken, Insektenwolken im Gegenlicht ---
      if (feuer.length > 0) {
        const fx0 = feuer[0];
        const fy0 = feuer[1];
        const fz0 = feuer[2];
        const near = Math.abs(fx0 - cam.x) + Math.abs(fz0 - cam.z) < 260;
        smokeT -= dt;
        if (smokeT <= 0) {
          smokeT = detail === 0 ? 0.7 : 0.4;
          if (near) fx.puff(fx0 + (rnd() - 0.5) * 0.4, fy0 + 0.4, fz0 + (rnd() - 0.5) * 0.4, 0.4 + (rnd() - 0.5) * 0.3, 1.6, 0.3, 4.2, 1.0 + rnd() * 0.4, rnd() < 0.5 ? 0x8a8478 : 0xa8a294, 0.75, -0.5);
        }
        sparkT -= dt;
        if (sparkT <= 0) {
          sparkT = 0.5 + rnd() * 0.6;
          if (near && detail > 0) fx.spark(fx0, fy0 - 0.4, fz0, (rnd() - 0.5) * 0.8, 2.2 + rnd(), (rnd() - 0.5) * 0.8, 1.0, 0.16, 0xffb03a, 0.6);
        }
      }
      if (hi && kegelN > 0) {
        insT -= dt;
        while (insT <= 0) {
          insT += 0.05;
          // Einen Lichtkegel in Kameranähe nehmen
          pick2 = (pick2 + 7) % kegelN;
          const x = kegel[pick2 * 3];
          const y = kegel[pick2 * 3 + 1];
          const z = kegel[pick2 * 3 + 2];
          if (Math.abs(x - cam.x) + Math.abs(z - cam.z) > 90) continue;
          const h = 1.2 + rnd() * 5;
          fx.spark(x + (rnd() - 0.5) * 2.4 + h * 0.6, y + h, z + (rnd() - 0.5) * 2.4 + h * 0.4, (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.9, 1.4, 0.13, 0xfff0a0, 0);
        }
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
