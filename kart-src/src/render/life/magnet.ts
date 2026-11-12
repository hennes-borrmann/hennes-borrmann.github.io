// Kulisse des Magnetwerks: ein Fabrikgelände am späten Abend.
//
// Am Werkstor leuchtet „MAGNETWERK“ über der Bahn, der Pförtner sitzt in seinem
// Häuschen, Arbeiter mit Helmen winken, ein Gabelstapler dreht seine Runden.
// Durch die Montagehalle mit ihrem Sheddach fährt man unter einem Laufkran
// hindurch, an den Seiten stehen halbfertige Spulen und Kabeltrommeln. Neben der
// Magnettrommel (die zeichnet mechanics/drum.ts – hier bleibt um ihre Achse
// Platz) stehen Schaltschränke, Kabelbrücken führen zum Umrichterhaus, ein hoher
// Schornstein raucht. An der Verladerampe stehen Container unter einem Portalkran,
// unter dem Sprung kreuzt der Gleisanschluss, auf dem eine Rangierlok mit ihren
// Wagen hin und her fährt. Danach dampfen die Kühltürme, Rohre queren hoch über
// der Bahn, und am Umspannwerk spannen sich Freileitungen über die Strecke.
// In der Ferne: Stadt, Schornsteine und eine Hochspannungsleitung über den Hügeln.
//
// Licht ohne Lichtquellen: Fenster, Laternen und Leuchtschrift sind unbeleuchtete,
// helle Flächen, Lichtkegel additiv; Signallampen wechseln höchstens etwa zweimal
// je Sekunde. Technik wie in hafen.ts: Eckenfarben, Toon-Körper mit Kontur,
// Instanzen, ein Netz mit je Bild neu gesetzten Ecken für alles Bewegte – keine
// eigenen Shader, keine Texturen. Im Lauf wird nichts angelegt.

import * as THREE from 'three';
import { EDGE_GAP, rightX, rightZ } from '../../game/track';
import { seeded, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** So viel Platz bleibt um die Achse der Magnettrommel frei (Meter). */
const TROMMEL_FREI = 32;

// --- Werkzeug: Flächen sammeln, mit Lage (wie hafen.ts) ------------------------------

const tv = new THREE.Vector3();
const tp = new THREE.Vector3();
const ts = new THREE.Vector3();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tm = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

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

  /** Viereck mit eigener Farbe je Ecke (Verläufe: Lichtkegel, Schein). */
  quadV(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    const pts: [V3, RGB][] = [
      [a, ca],
      [b, cb],
      [c, cc],
      [a, ca],
      [c, cc],
      [d, cd],
    ];
    for (const [p, q] of pts) {
      this.p(p[0], p[1], p[2]);
      this.col.push(q[0], q[1], q[2]);
    }
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
    const out = nx * gx + ny * gy + nz * gz >= 0;
    if (out === aus) this.quad(a, b, c, d, color);
    else this.quad(d, c, b, a, color);
  }

  /** Beide Seiten einer Fläche, mit eigener Farbe je Seite. */
  doppel(a: V3, b: V3, c: V3, d: V3, vorn: RGB, hinten: RGB, ref: V3): void {
    this.flaeche(a, b, c, d, vorn, ref, true);
    this.flaeche(a, b, c, d, hinten, ref, false);
  }

  /** Quader um (cx, cy, cz), um die Hochachse gedreht (wie MeshBuilder.box). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
    this.quader(cx, cy, cz, sx, sy, sz, color, rotY, top, true);
  }

  /** Quader ohne Boden (steht auf etwas – spart zwei Dreiecke). */
  klotz(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
    this.quader(cx, cy, cz, sx, sy, sz, color, rotY, top, false);
  }

  private quader(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY: number, top: RGB | undefined, boden: boolean): void {
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

  /** Fertige three.js-Geometrie, einfarbig, mit eigener Lage (Euler YXZ) in der aktuellen Lage. Die Geometrie wird danach freigegeben. */
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

  /** Stehender Zylinder (Fuß bei y), n Seiten; offen = ohne Deckel. */
  zyl(x: number, y: number, z: number, r0: number, r1: number, h: number, n: number, color: RGB, offen = false): void {
    this.geo(new THREE.CylinderGeometry(r1, r0, h, n, 1, offen), color, x, y + h / 2, z);
  }

  /** Liegender Zylinder mit der Achse entlang z (Lage-Koordinaten), Mitte bei (x, y, z). */
  rolle(x: number, y: number, z: number, r: number, len: number, n: number, color: RGB, offen = false, ry = 0): void {
    this.geo(new THREE.CylinderGeometry(r, r, len, n, 1, offen), color, x, y, z, Math.PI / 2, ry, 0);
  }

  /** Balken mit quadratischem Querschnitt von a nach c. */
  stab(a: V3, c: V3, d: number, color: RGB): void {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    tq.setFromUnitVectors(UP, tv.set(dx / len, dy / len, dz / len));
    tm.compose(tp.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), tq, ts.set(d, len, d));
    this.geoM(new THREE.BoxGeometry(1, 1, 1), color, tm);
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

// --- Bewegte Teile (wie hafen.ts) ----------------------------------------------------

/** 0 = starr (Lage samt Normalen), 1 = starr, nur verschoben (Zug auf geradem Gleis). */
type Art = 0 | 1;

interface Teil {
  v0: number;
  v1: number;
  art: Art;
  /** Lage des Teils in der Welt (je Bild gesetzt). */
  m: THREE.Matrix4;
}

class Teile extends Bau {
  readonly liste: Teil[] = [];
  private start = 0;

  beginn(): void {
    this.frei();
    this.start = this.verts;
  }

  ende(art: Art): number {
    this.liste.push({ v0: this.start, v1: this.verts, art, m: new THREE.Matrix4() });
    return this.liste.length - 1;
  }
}

/** Geglättete Normalen je Teil (für die Kontur) – Teile, die sich am Ursprung überlagern, mischen sich so nicht. */
function glatteNormalen(pos: Float32Array, nor: Float32Array, teile: Teil[]): Float32Array {
  const out = new Float32Array(pos.length);
  const sums = new Map<string, number[]>();
  const key = (i: number): string => `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
  for (const p of teile) {
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

// --- Leuchtschrift: Strichschrift auf einem Raster 2 × 3 ----------------------------

/** Je Buchstabe Striche (u0, v0, u1, v1). */
const SCHRIFT: Record<string, number[]> = {
  M: [0, 0, 0, 3, 0, 3, 1, 1.3, 1, 1.3, 2, 3, 2, 3, 2, 0],
  A: [0, 0, 1, 3, 1, 3, 2, 0, 0.45, 1.15, 1.55, 1.15],
  G: [2, 3, 0, 3, 0, 3, 0, 0, 0, 0, 2, 0, 2, 0, 2, 1.4, 2, 1.4, 1, 1.4],
  N: [0, 0, 0, 3, 0, 3, 2, 0, 2, 0, 2, 3],
  E: [2, 3, 0, 3, 0, 3, 0, 0, 0, 0, 2, 0, 0, 1.5, 1.5, 1.5],
  T: [0, 3, 2, 3, 1, 3, 1, 0],
  W: [0, 3, 0.5, 0, 0.5, 0, 1, 1.9, 1, 1.9, 1.5, 0, 1.5, 0, 2, 3],
  R: [0, 0, 0, 3, 0, 3, 2, 3, 2, 3, 2, 1.5, 2, 1.5, 0, 1.5, 0.8, 1.5, 2, 0],
  K: [0, 0, 0, 3, 0, 1.2, 2, 3, 0.8, 1.9, 2, 0],
};

// --- Farben --------------------------------------------------------------------------

const dimm: RGB = [0.22, 0.15, 0.07];
const C = {
  beton: rgb(0xa8a399),
  betonH: rgb(0xc4bfb3),
  betonD: rgb(0x77736b),
  ziegel: rgb(0x9c5b3e),
  ziegelD: rgb(0x7a4630),
  stahl: rgb(0x6c7480),
  stahlH: rgb(0x9aa2ac),
  stahlD: rgb(0x3e444f),
  blech: rgb(0x8a949c),
  blechD: rgb(0x646d76),
  dach: rgb(0x4c515c),
  dachU: rgb(0x8d939b),
  nacht: rgb(0x2a2f3c),
  kran: rgb(0xe8742a),
  kranD: rgb(0xa9501d),
  gruen: rgb(0x3f7a5a),
  creme: rgb(0xe8dcc0),
  weiss: rgb(0xeeeae0),
  holz: rgb(0x9a6a40),
  holzD: rgb(0x6a4628),
  kupfer: rgb(0xc8783a),
  kupferD: rgb(0x8f4f22),
  reifen: rgb(0x1f2026),
  kabel: rgb(0x23252c),
  haut: rgb(0xf0c09a),
  hautD: rgb(0xb07a52),
  overall: rgb(0x34405e),
  porzellan: rgb(0xe6e2da),
  trafo: rgb(0x5d6b62),
  fensterAus: rgb(0x2c3646),
};
/** Leuchtfarben (unbeleuchtet gezeichnet). */
const L = {
  natrium: rgb(0xffb04a),
  warm: rgb(0xffd79a),
  weiss: rgb(0xfff2dc),
  schrift: rgb(0xfff4e0),
  spule: rgb(0x3a8cff),
  gruen: rgb(0x7dff9a),
};
const CONTAINER = [0x3f8f4f, 0xe8742a, 0x9aa0a6, 0xe6e2d8, 0x2f8f8a, 0x8a5a3a, 0x6a7a3a, 0xb8693a];

export function buildMagnetLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail === 2;
  const lo = detail === 0;
  const lines = detail > 0;
  const rnd = seeded(9700 + t.index * 61);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

  // Sammler: große Körper mit Kontur, Kleinkram ohne, Leuchtendes, Lichtschein (additiv), Bewegtes, Ferne.
  const gross = new Bau();
  const klein = new Bau();
  const glut = new Bau();
  const schein = new Bau();
  const dyn = new Teile();
  const fern = new Bau();

  // --- Strecke ----------------------------------------------------------------------
  const N = t.n;
  const S = (m: number): number => (((Math.round(m / t.step) % N) + N) % N);
  const X = (i: number, lat: number): number => t.px[i] + rightX(t, i) * lat;
  const Z = (i: number, lat: number): number => t.pz[i] + rightZ(t, i) * lat;
  /** Drehung, mit der lokal +x in Fahrtrichtung und +z nach rechts zeigt. */
  const QR = (i: number): number => Math.atan2(t.tx[i], t.tz[i]) - Math.PI / 2;
  /** Drehung, mit der lokal +z in Richtung (dx, dz) zeigt. */
  const vor = (dx: number, dz: number): number => Math.atan2(dx, dz);
  const ground = (x: number, z: number): number => world.heightAt(x, z);
  /** Mindestens 3 m (plus Radius r) von jeder Bande entfernt? */
  const frei = (x: number, z: number, r: number): boolean => world.clearance(x, z) >= 3 + r;
  const belegt: number[] = [];
  const platz = (x: number, z: number, r: number): boolean => {
    for (let k = 0; k < belegt.length; k += 3) if (Math.hypot(x - belegt[k], z - belegt[k + 1]) < r + belegt[k + 2]) return false;
    return true;
  };
  const merke = (x: number, z: number, r: number): void => {
    belegt.push(x, z, r);
  };

  // Achse der Magnettrommel (alle 2 m, an beiden Enden 8 m verlängert für die Portale): x, y, z.
  const achse: number[] = [];
  for (const d of t.drums) {
    for (let k = -8; k <= d.count + 8; k += 2) {
      const kk = Math.max(0, Math.min(d.count - 1, k));
      const seg = d.first + kk;
      const over = k - kk;
      achse.push(t.px[seg] + t.tx[seg] * over, t.py[seg] + d.radius, t.pz[seg] + t.tz[seg] * over);
    }
  }
  /** Bleibt ein senkrechter Körper (Mitte x, z, Radius r, von y0 bis y1) 32 m von der Trommelachse weg? */
  const trommelOk = (x: number, z: number, y0: number, y1: number, r: number): boolean => {
    for (let k = 0; k < achse.length; k += 3) {
      const dh = Math.max(0, Math.hypot(x - achse[k], z - achse[k + 2]) - r);
      if (dh >= TROMMEL_FREI) continue;
      const ay = achse[k + 1];
      const dy = ay < y0 ? y0 - ay : ay > y1 ? ay - y1 : 0;
      if (Math.hypot(dh, dy) < TROMMEL_FREI) return false;
    }
    return true;
  };
  /** Darf hier etwas stehen (Bande, Belegung, Trommel)? */
  const darf = (x: number, z: number, r: number, h: number): boolean => {
    if (!frei(x, z, r) || !platz(x, z, r)) return false;
    const g = ground(x, z);
    return trommelOk(x, z, g, g + h, r);
  };

  // Lampen (Instanzen): x, y, z, Größe, Art, Phase, Teil (−1 = fest), Farbe
  const lichter: number[] = [];
  /** Art: 0 stetig, 1 blinkt ruhig (2,4 s), 2 Flugfeuer (kurz an alle 2 s), 3 Wechselblinker (1,6 s), 4 pulsiert sanft */
  const lampe = (x: number, y: number, z: number, size: number, art: number, phase: number, color: number, teil = -1): void => {
    lichter.push(x, y, z, size, art, phase, teil, color);
  };
  /** Weltpunkt eines Punkts in der aktuellen Lage eines Sammlers. */
  const welt = (b: Bau, x: number, y: number, z: number): THREE.Vector3 => tv.set(x, y, z).applyMatrix4(b.m);

  // --- Bausteine --------------------------------------------------------------------

  /** Lichtkegel (additiv) von (x, y, z) senkrecht hinunter bis yb, oben r0, unten r1, in der aktuellen Lage von schein. */
  const kegel = (x: number, y: number, z: number, yb: number, r0: number, r1: number, c: RGB, k = 0.55): void => {
    const n = 6;
    const top: RGB = [c[0] * k, c[1] * k, c[2] * k];
    const bot: RGB = [0, 0, 0];
    for (let s = 0; s < n; s++) {
      const a0 = (s / n) * Math.PI * 2;
      const a1 = ((s + 1) / n) * Math.PI * 2;
      schein.quadV(
        [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0],
        [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0],
        [x + Math.cos(a1) * r1, yb, z + Math.sin(a1) * r1],
        [x + Math.cos(a0) * r1, yb, z + Math.sin(a0) * r1],
        top,
        top,
        bot,
        bot,
      );
    }
  };

  /** Straßenlaterne mit Natriumlicht: Mast bei (x, z), Ausleger in Richtung (dx, dz). */
  const laterne = (x: number, z: number, dx: number, dz: number, h = 8.5): void => {
    const g = ground(x, z);
    const rot = Math.atan2(-dz, dx); // lokal +x zeigt nach (dx, dz)
    klein.lage(x, g, z, rot);
    klein.klotz(0, h / 2 - 0.3, 0, 0.26, h + 0.6, 0.26, C.stahlD);
    klein.box(1.1, h - 0.05, 0, 2.2, 0.16, 0.16, C.stahlD);
    klein.box(2.15, h - 0.25, 0, 1.0, 0.3, 0.5, C.nacht);
    glut.lage(x, g, z, rot);
    glut.quad([1.7, h - 0.41, -0.2], [2.6, h - 0.41, -0.2], [2.6, h - 0.41, 0.2], [1.7, h - 0.41, 0.2], L.natrium);
    schein.lage(x, g, z, rot);
    kegel(2.15, h - 0.45, 0, 0.05, 0.35, 3.6, L.natrium, 0.06);
    klein.frei();
    glut.frei();
    schein.frei();
  };

  /** Arbeiter mit Helm (Blick nach lokal +z, Maßstab 1,25). Winkt er, ist sein rechter Arm ein bewegtes Teil. */
  const winker: number[] = []; // Teil, Schulter x, y, z, Drehung, Phase
  const arbeiter = (b: Bau, x: number, y: number, z: number, yaw: number, winkt: boolean): void => {
    const s = 1.25;
    const helm = rgb(pick([0xf2efe6, 0xe8742a, 0xf2efe6, 0xe8742a, 0xf0c832]));
    const weste = rgb(pick([0xf08a2a, 0xe8e4da, 0xf08a2a, 0x8fd04a]));
    const haut = rnd() < 0.5 ? C.haut : C.hautD;
    b.lage(x, y, z, yaw);
    b.klotz(0, 0.45 * s, 0, 0.56 * s, 0.9 * s, 0.3 * s, C.overall);
    b.box(0, 1.27 * s, 0, 0.64 * s, 0.76 * s, 0.38 * s, weste, 0, C.overall);
    b.box(-0.42 * s, 1.22 * s, 0, 0.18 * s, 0.7 * s, 0.2 * s, C.overall);
    b.geo(new THREE.IcosahedronGeometry(0.24 * s, 0), haut, 0, 1.86 * s, 0);
    b.geo(new THREE.SphereGeometry(0.27 * s, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 1.93 * s, 0);
    b.geo(new THREE.CylinderGeometry(0.33 * s, 0.33 * s, 0.05 * s, 6, 1, true), helm, 0, 1.93 * s, 0.04 * s);
    if (!winkt) b.box(0.42 * s, 1.22 * s, 0, 0.18 * s, 0.7 * s, 0.2 * s, C.overall);
    b.frei();
    if (winkt) {
      dyn.beginn();
      dyn.box(0, 0.33 * s, 0, 0.18 * s, 0.66 * s, 0.2 * s, C.overall);
      dyn.geo(new THREE.IcosahedronGeometry(0.12 * s, 0), haut, 0, 0.72 * s, 0);
      const p = dyn.ende(0);
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      // Schulter: lokal (0,42 s; 1,55 s; 0) → Welt
      winker.push(p, x + 0.42 * s * c, y + 1.55 * s, z - 0.42 * s * sn, yaw, rnd() * 10);
    }
  };

  /** Kabeltrommel: zwei Holzscheiben, dazwischen aufgewickeltes Kabel (Achse lokal z). */
  const kabeltrommel = (b: Bau, x: number, y: number, z: number, r: number, w: number): void => {
    b.rolle(x, y + r, z - w / 2 + 0.06, r, 0.12, 9, C.holz);
    b.rolle(x, y + r, z + w / 2 - 0.06, r, 0.12, 9, C.holz);
    b.rolle(x, y + r, z, r * 0.78, w - 0.24, 9, rnd() < 0.5 ? C.kabel : C.kupferD, true);
  };

  /** Spule in Arbeit: Stahlkern auf Böcken, Kupferwicklung zum Teil aufgebracht (Achse lokal x). */
  const spule = (b: Bau, x: number, y: number, z: number, fertig: number): void => {
    b.klotz(x - 1.3, y + 0.5, z, 0.4, 1.0, 1.6, C.stahlD);
    b.klotz(x + 1.3, y + 0.5, z, 0.4, 1.0, 1.6, C.stahlD);
    b.geo(new THREE.CylinderGeometry(0.75, 0.75, 3.4, 8), C.stahlH, x, y + 1.7, z, 0, 0, Math.PI / 2);
    const len = 2.4 * fertig;
    b.geo(new THREE.CylinderGeometry(1.35, 1.35, len, 10), C.kupfer, x - 1.2 + len / 2, y + 1.7, z, 0, 0, Math.PI / 2);
    b.geo(new THREE.CylinderGeometry(1.42, 1.42, 0.12, 10), C.kupferD, x - 1.2 + 0.06, y + 1.7, z, 0, 0, Math.PI / 2);
  };

  /** Container (12,2 × 2,6 × 2,44), Länge entlang lokal x, mit Rippen an den Längsseiten. */
  const container = (b: Bau, x: number, y: number, z: number, farbe: number): void => {
    const c = rgb(farbe);
    const d: RGB = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72];
    b.box(x, y + 1.3, z, 12.2, 2.6, 2.44, c, 0, [c[0] * 0.86, c[1] * 0.86, c[2] * 0.86]);
    const ref: V3 = [x, y + 1.3, z];
    for (const sd of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        const x0 = x - 4.1 + r * 4.1;
        const zz = z + sd * 1.25;
        b.flaeche([x0 - 1.4, y + 0.25, zz], [x0 + 1.4, y + 0.25, zz], [x0 + 1.4, y + 2.35, zz], [x0 - 1.4, y + 2.35, zz], d, ref, true);
      }
    }
  };

  /** Schaltschrank mit Kontrolllämpchen; Blick nach lokal +z. */
  const schrank = (x: number, y: number, z: number, rot: number): void => {
    gross.lage(x, y, z, rot);
    gross.klotz(0, 1.1, 0, 1.0, 2.2, 0.7, rgb(0xbdb8aa), 0, C.stahlD);
    gross.frei();
    klein.lage(x, y, z, rot);
    klein.quad([-0.02, 0.15, 0.36], [0.02, 0.15, 0.36], [0.02, 2.0, 0.36], [-0.02, 2.0, 0.36], C.betonD);
    klein.frei();
    glut.lage(x, y, z, rot);
    for (let k = 0; k < 3; k++) {
      const c = k === 1 ? L.weiss : L.gruen;
      const lx = -0.3 + k * 0.12;
      glut.quad([lx - 0.04, 1.84, 0.37], [lx + 0.04, 1.84, 0.37], [lx + 0.04, 1.92, 0.37], [lx - 0.04, 1.92, 0.37], c);
    }
    glut.frei();
  };

  /** Fensterreihe (Leuchtflächen) auf einer Wand: von a nach b (Grundlinie), Höhe y0..y1, n Fenster; Normale nach außen = weg von ref. */
  const fenster = (a: V3, b: V3, y0: number, y1: number, n: number, ref: V3, an = 0.75): void => {
    for (let k = 0; k < n; k++) {
      const f0 = (k + 0.18) / n;
      const f1 = (k + 0.82) / n;
      const p = (f: number, y: number): V3 => [a[0] + (b[0] - a[0]) * f, y, a[2] + (b[2] - a[2]) * f];
      const lit = rnd() < an;
      const c = lit ? (rnd() < 0.25 ? L.weiss : L.warm) : C.fensterAus;
      (lit ? glut : klein).flaeche(p(f0, y0), p(f1, y0), p(f1, y1), p(f0, y1), c, ref, true);
    }
  };

  /**
   * Halle mit Sheddach, Mitte (cx, cz), Länge L entlang lokal x, Breite W entlang z, Traufhöhe H, Drehung rot.
   * Die Glasflächen der Sheds leuchten; an den Längsseiten Fensterbänder, an einer Stirnseite ein offenes Tor.
   */
  const halle = (cx: number, cz: number, Lx: number, Wz: number, H: number, rot: number, wand: RGB, zaehne: number): void => {
    const g = ground(cx, cz) - 0.3;
    gross.lage(cx, g, cz, rot);
    gross.klotz(0, H / 2, 0, Lx, H, Wz, wand, 0, C.dach);
    const dz = 2.6;
    const step = Lx / zaehne;
    for (let k = 0; k < zaehne; k++) {
      const x0 = -Lx / 2 + k * step;
      const x1 = x0 + step;
      // Schräge von hoch (x0) nach niedrig (x1); senkrechte Glasfläche bei x0
      gross.quad([x0, H + dz, -Wz / 2], [x0, H + dz, Wz / 2], [x1, H, Wz / 2], [x1, H, -Wz / 2], C.dach);
      gross.tri([x0, H, Wz / 2], [x1, H, Wz / 2], [x0, H + dz, Wz / 2], wand);
      gross.tri([x0, H, -Wz / 2], [x0, H + dz, -Wz / 2], [x1, H, -Wz / 2], wand);
      glut.lage(cx, g, cz, rot);
      glut.flaeche([x0 - 0.05, H, Wz / 2 - 0.4], [x0 - 0.05, H, -Wz / 2 + 0.4], [x0 - 0.05, H + dz - 0.2, -Wz / 2 + 0.4], [x0 - 0.05, H + dz - 0.2, Wz / 2 - 0.4], L.warm, [x0 + 1, H + 1, 0], true);
    }
    glut.lage(cx, g, cz, rot);
    klein.lage(cx, g, cz, rot);
    const nf = Math.max(3, Math.round(Lx / 6));
    fenster([-Lx / 2 + 2, 0, Wz / 2 + 0.06], [Lx / 2 - 2, 0, Wz / 2 + 0.06], H * 0.55, H * 0.8, nf, [0, H * 0.6, 0]);
    fenster([-Lx / 2 + 2, 0, -Wz / 2 - 0.06], [Lx / 2 - 2, 0, -Wz / 2 - 0.06], H * 0.55, H * 0.8, nf, [0, H * 0.6, 0]);
    // Offenes Tor an der Stirnseite +x: warmes Licht von innen
    glut.quad([Lx / 2 + 0.06, 0.3, Wz * 0.18], [Lx / 2 + 0.06, 0.3, -Wz * 0.18], [Lx / 2 + 0.06, Math.min(H - 1, 6), -Wz * 0.18], [Lx / 2 + 0.06, Math.min(H - 1, 6), Wz * 0.18], L.warm);
    gross.frei();
    glut.frei();
    klein.frei();
  };

  /** Hyperbolischer Kühlturm (gestapelte Ringe), Fuß bei (x, z), Fußradius R, Höhe H. Gibt die Höhe der Krone zurück. */
  const kuehlturm = (x: number, z: number, R: number, H: number): number => {
    const g = ground(x, z) - 0.5;
    const n = lo ? 12 : 18;
    const hw = 0.76 * H;
    const rw = 0.6 * R;
    const c = hw / Math.sqrt((R / rw) ** 2 - 1);
    const r = (h: number): number => rw * Math.sqrt(1 + ((h - hw) / c) ** 2);
    const hs = lo ? [0, 0.05, 0.3, 0.6, 0.85, 1] : [0, 0.05, 0.18, 0.36, 0.55, 0.72, 0.86, 1];
    const farbe = (k: number): RGB => (k === 0 ? C.betonD : k >= hs.length - 2 ? rgb(0x8f8a82) : k % 2 ? C.betonH : rgb(0xbab5aa));
    for (let k = 0; k + 1 < hs.length; k++) {
      const h0 = hs[k] * H;
      const h1 = hs[k + 1] * H;
      const r0 = r(h0);
      const r1 = r(h1);
      for (let s = 0; s < n; s++) {
        const a0 = (s / n) * Math.PI * 2;
        const a1 = ((s + 1) / n) * Math.PI * 2;
        const p = (a: number, rr: number, h: number): V3 => [x + Math.cos(a) * rr, g + h, z + Math.sin(a) * rr];
        gross.quad(p(a0, r0, h0), p(a0, r1, h1), p(a1, r1, h1), p(a1, r0, h0), farbe(k));
        // innen (sichtbar von oben): nur das oberste Stück
        if (k === hs.length - 2) gross.quad(p(a1, r0 - 0.6, h0), p(a1, r1 - 0.6, h1), p(a0, r1 - 0.6, h1), p(a0, r0 - 0.6, h0), C.nacht);
      }
    }
    // Krone: dunkler Rand
    const rt = r(H);
    for (let s = 0; s < n; s++) {
      const a0 = (s / n) * Math.PI * 2;
      const a1 = ((s + 1) / n) * Math.PI * 2;
      gross.quad([x + Math.cos(a0) * (rt - 0.6), g + H, z + Math.sin(a0) * (rt - 0.6)], [x + Math.cos(a1) * (rt - 0.6), g + H, z + Math.sin(a1) * (rt - 0.6)], [x + Math.cos(a1) * rt, g + H, z + Math.sin(a1) * rt], [x + Math.cos(a0) * rt, g + H, z + Math.sin(a0) * rt], C.betonD);
    }
    // Becken am Fuß
    klein.zyl(x, g, z, R + 2.2, R + 2.2, 1.6, n, C.betonD, true);
    lampe(x + rt, g + H + 0.6, z, 0.9, 2, rnd(), 0xff5a3a);
    lampe(x - rt, g + H + 0.6, z, 0.9, 2, rnd(), 0xff5a3a);
    merke(x, z, R + 3);
    return g + H;
  };

  /** Gittermast (Freileitung): Fuß bei (x, z), Höhe H, Querträger entlang lokal x (Drehung rot). Gibt die Aufhängepunkte zurück. */
  const gittermast = (b: Bau, x: number, z: number, H: number, rot: number): V3[] => {
    const g = ground(x, z) - 0.3;
    b.lage(x, g, z, rot);
    const w0 = 3.2;
    const w1 = 0.9;
    const c = C.stahlH;
    const leg = (sx: number, sz: number, h: number): V3 => {
      const w = w0 + (w1 - w0) * (h / H);
      return [sx * w, h, sz * w];
    };
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (const [sx, sz] of corners) b.stab(leg(sx, sz, 0), leg(sx, sz, H), 0.3, c);
    const secs = [0, H * 0.3, H * 0.55, H * 0.75, H];
    for (let k = 0; k + 1 < secs.length; k++) {
      for (let f = 0; f < 4; f++) {
        if (lo && f % 2 === 1) continue;
        const [ax, az] = corners[f];
        const [bx, bz] = corners[(f + 1) % 4];
        const flip = (k + f) % 2 === 0;
        b.stab(leg(flip ? ax : bx, flip ? az : bz, secs[k]), leg(flip ? bx : ax, flip ? bz : az, secs[k + 1]), 0.16, c);
      }
    }
    // Querträger
    const arms: [number, number][] = [
      [H * 0.72, 6.5],
      [H * 0.88, 4.8],
    ];
    const hang: V3[] = [];
    for (const [h, w] of arms) {
      b.stab([-w, h, 0], [w, h, 0], 0.32, c);
      b.stab([-w, h, 0], [-w1 * 1.4, h + 1.6, 0], 0.18, c);
      b.stab([w, h, 0], [w1 * 1.4, h + 1.6, 0], 0.18, c);
      for (const sd of [-1, 1]) {
        b.geo(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 5), C.porzellan, sd * (w - 0.3), h - 0.8, 0);
        const p = welt(b, sd * (w - 0.3), h - 1.6, 0);
        hang.push([p.x, p.y, p.z]);
      }
    }
    b.stab([0, H, 0], [0, H + 2.2, 0], 0.2, c);
    const top = welt(b, 0, H + 2.2, 0);
    hang.push([top.x, top.y, top.z]);
    b.frei();
    return hang;
  };

  /** Dünner Strang (dreikantiges Prisma, ohne Enden) von a nach c – für Drähte und Leitungen. */
  const strang = (b: Bau, a: V3, c: V3, d: number, color: RGB): void => {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    // zwei Querrichtungen
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
    uz /= ul;
    const wx = (dy * uz - dz * uy) / l;
    const wy = (dz * ux - dx * uz) / l;
    const wz = (dx * uy - dy * ux) / l;
    const r = d * 0.6;
    const off = (k: number): V3 => {
      const an = (k / 3) * Math.PI * 2;
      const co = Math.cos(an) * r;
      const si = Math.sin(an) * r;
      return [ux * co + wx * si, uy * co + wy * si, uz * co + wz * si];
    };
    const mid: V3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    for (let k = 0; k < 3; k++) {
      const o0 = off(k);
      const o1 = off(k + 1);
      b.flaeche([a[0] + o0[0], a[1] + o0[1], a[2] + o0[2]], [c[0] + o0[0], c[1] + o0[1], c[2] + o0[2]], [c[0] + o1[0], c[1] + o1[1], c[2] + o1[2]], [a[0] + o1[0], a[1] + o1[1], a[2] + o1[2]], color, mid, true);
    }
  };

  /** Durchhängender Draht von a nach b (Durchhang sag), n Stücke. */
  const draht = (b: Bau, a: V3, c: V3, sag: number, n: number, d = 0.1): void => {
    let prev: V3 = a;
    for (let k = 1; k <= n; k++) {
      const f = k / n;
      const p: V3 = [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f - sag * 4 * f * (1 - f), a[2] + (c[2] - a[2]) * f];
      strang(b, prev, p, d, C.kabel);
      prev = p;
    }
  };

  /** Ein Gabelstapler als bewegtes Teil (Blick nach lokal +z). Gibt das Teil zurück. */
  const stapler = (last: boolean): number => {
    dyn.beginn();
    const s = 1.2;
    dyn.box(0, 0.8 * s, -0.2 * s, 1.4 * s, 0.9 * s, 2.0 * s, C.kran, 0, C.kranD);
    dyn.box(0, 0.95 * s, -1.3 * s, 1.4 * s, 1.1 * s, 0.5 * s, C.stahlD);
    for (const [wx, wz, r] of [
      [0.68, 0.55, 0.36],
      [-0.68, 0.55, 0.36],
      [0.68, -0.95, 0.3],
      [-0.68, -0.95, 0.3],
    ] as [number, number, number][]) {
      dyn.geo(new THREE.CylinderGeometry(r * s, r * s, 0.3 * s, 8), C.reifen, wx * s, r * s, wz * s, 0, 0, Math.PI / 2);
    }
    // Schutzdach
    for (const [px, pz] of [
      [0.6, 0.35],
      [-0.6, 0.35],
      [0.6, -0.95],
      [-0.6, -0.95],
    ] as [number, number][]) {
      dyn.box(px * s, 1.85 * s, pz * s, 0.08 * s, 1.1 * s, 0.08 * s, C.stahlD);
    }
    dyn.box(0, 2.42 * s, -0.3 * s, 1.35 * s, 0.08 * s, 1.5 * s, C.stahlD);
    // Fahrer
    dyn.box(0, 1.55 * s, -0.45 * s, 0.55 * s, 0.6 * s, 0.4 * s, rgb(0xf08a2a));
    dyn.geo(new THREE.IcosahedronGeometry(0.2 * s, 0), C.haut, 0, 2.02 * s, -0.42 * s);
    dyn.geo(new THREE.SphereGeometry(0.23 * s, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), C.weiss, 0, 2.08 * s, -0.42 * s);
    // Hubmast und Gabel
    dyn.box(0.42 * s, 1.35 * s, 1.0 * s, 0.12 * s, 2.7 * s, 0.14 * s, C.stahl);
    dyn.box(-0.42 * s, 1.35 * s, 1.0 * s, 0.12 * s, 2.7 * s, 0.14 * s, C.stahl);
    dyn.box(0, 2.6 * s, 1.0 * s, 0.95 * s, 0.12 * s, 0.14 * s, C.stahl);
    dyn.box(0.3 * s, 0.3 * s, 1.6 * s, 0.12 * s, 0.06 * s, 1.1 * s, C.stahlD);
    dyn.box(-0.3 * s, 0.3 * s, 1.6 * s, 0.12 * s, 0.06 * s, 1.1 * s, C.stahlD);
    if (last) {
      dyn.box(0, 0.42 * s, 1.6 * s, 1.15 * s, 0.14 * s, 1.1 * s, C.holz);
      dyn.box(0, 0.95 * s, 1.6 * s, 1.0 * s, 0.9 * s, 1.0 * s, rgb(0xc89a62));
    }
    const p = dyn.ende(0);
    lampe(0, 2.6 * s, -0.3 * s, 0.32, 1, rnd(), 0xff9a3a, p);
    return p;
  };
  /** Rundkurse der Stapler: Teil, Mitte x, z, Halbachsen a, b, Drehung, Phase, Takt (rad/s) */
  const runden: number[] = [];
  /** Sucht in der Nähe von (x, z) einen Platz für eine Ellipse (a × b) und legt dort einen Stapler hin. */
  const staplerRunde = (x0: number, z0: number, a: number, b: number, rot: number): void => {
    for (let k = 0; k < 40; k++) {
      const x = x0 + (k === 0 ? 0 : (rnd() - 0.5) * 30);
      const z = z0 + (k === 0 ? 0 : (rnd() - 0.5) * 30);
      let ok = platz(x, z, Math.max(a, b) + 1.5);
      for (let s = 0; s < 16 && ok; s++) {
        const u = (s / 16) * Math.PI * 2;
        const lx = Math.cos(u) * a;
        const lz = Math.sin(u) * b;
        const wx = x + lx * Math.cos(rot) + lz * Math.sin(rot);
        const wz = z - lx * Math.sin(rot) + lz * Math.cos(rot);
        if (!frei(wx, wz, 2.5) || !trommelOk(wx, wz, 0, 6, 2)) ok = false;
      }
      if (!ok) continue;
      merke(x, z, Math.max(a, b) + 1.5);
      runden.push(stapler(runden.length % 2 === 0), x, z, a, b, rot, rnd() * Math.PI * 2, (rnd() < 0.5 ? -1 : 1) * (2.6 / ((a + b) / 2)));
      return;
    }
  };

  // ==================================================================================
  // 1. Werkstor mit Start und Ziel
  // ==================================================================================
  {
    const gi = S(0);
    const y = t.py[gi];
    const ox = X(gi, 0);
    const oz = Z(gi, 0);
    const rot = QR(gi);
    gross.lage(ox, y, oz, rot);
    const pfeiler = rgb(0x8f5a40);
    for (const sd of [-1, 1]) {
      gross.klotz(0, 7.5, sd * 13.4, 2.2, 16.2, 2.2, pfeiler, 0, C.betonH);
      gross.klotz(0, 0.3, sd * 13.4, 2.8, 1.8, 2.8, C.beton);
      gross.box(0, 15.75, sd * 13.4, 2.5, 0.3, 2.5, C.betonH);
    }
    // Träger über der Bahn: Unterkante 11 m über der Fahrbahn
    gross.box(0, 13.1, 0, 1.6, 4.2, 28.6, rgb(0x2a303c));
    gross.box(0, 15.32, 0, 1.9, 0.24, 28.8, C.betonH);
    gross.box(0, 10.9, 0, 1.9, 0.24, 28.8, C.betonH);
    gross.frei();
    // Leuchtschrift: vorn (zu den Ankommenden, −x) und hinten lesbar
    glut.lage(ox, y, oz, rot);
    const text = 'MAGNETWERK';
    const sc = 0.82;
    const sw = 0.32;
    const pitch = 2.55 * sc;
    const total = (text.length - 1) * pitch + 2 * sc;
    for (const sign of [1, -1]) {
      const x0 = sign * -0.86;
      for (let k = 0; k < text.length; k++) {
        const st = SCHRIFT[text[k]];
        const u0 = -total / 2 + k * pitch;
        for (let q = 0; q < st.length; q += 4) {
          let a0 = u0 + st[q] * sc;
          let b0 = 11.95 + st[q + 1] * sc;
          let a1 = u0 + st[q + 2] * sc;
          let b1 = 11.95 + st[q + 3] * sc;
          const len = Math.hypot(a1 - a0, b1 - b0);
          const du = (a1 - a0) / len;
          const dv = (b1 - b0) / len;
          a0 -= (du * sw) / 2;
          b0 -= (dv * sw) / 2;
          a1 += (du * sw) / 2;
          b1 += (dv * sw) / 2;
          const nu = (-dv * sw) / 2;
          const nv = (du * sw) / 2;
          const P = (u: number, v: number): V3 => [x0, v, sign * u];
          glut.flaeche(P(a0 - nu, b0 - nv), P(a1 - nu, b1 - nv), P(a1 + nu, b1 + nv), P(a0 + nu, b0 + nv), L.schrift, [x0 + sign, 13, 0], true);
        }
      }
    }
    glut.frei();
    // Schein um die Schrift
    schein.lage(ox, y, oz, rot);
    for (const sign of [1, -1]) {
      const x0 = sign * -0.95;
      const mid: RGB = [0.2, 0.13, 0.06];
      const off: RGB = [0, 0, 0];
      const zz = total / 2 + 0.8;
      const P = (z: number, v: number): V3 => [x0, v, sign * z];
      schein.quadV(P(-zz, 11.2), P(zz, 11.2), P(zz, 13.1), P(-zz, 13.1), off, off, mid, mid);
      schein.quadV(P(-zz, 13.1), P(zz, 13.1), P(zz, 15.0), P(-zz, 15.0), mid, mid, off, off);
    }
    schein.frei();
    for (const sd of [-1, 1]) {
      const p = welt(gross.lage(ox, y, oz, rot), 0, 16.25, sd * 13.4);
      lampe(p.x, p.y, p.z, 0.55, 1, sd < 0 ? 0 : 0.5, 0xff9a3a);
    }
    gross.frei();
    // Werksmauer links und rechts vom Tor
    if (!lo) {
      for (const sd of [-1, 1]) {
        for (let k = 0; k < 8; k++) {
          const lat = sd * (16.6 + k * 5);
          const x = X(gi, lat);
          const z = Z(gi, lat);
          if (!frei(x, z, 2.6) || !trommelOk(x, z, 0, 4, 3)) break;
          const g = ground(x, z);
          gross.lage(x, g, z, rot);
          gross.klotz(0, 1.4, 0, 0.45, 3.4, 5, C.ziegel, 0, C.betonH);
          gross.klotz(0, 1.6, 2.5, 0.75, 3.8, 0.75, C.ziegelD, 0, C.betonH);
          gross.frei();
          merke(x, z, 2.6);
        }
      }
    }
    // Pförtnerhaus links hinter dem Tor, davor die Schranke (offen)
    {
      const i = S(19);
      const lat = -(t.wh[i] + 9.5);
      const x = X(i, lat);
      const z = Z(i, lat);
      const g = ground(x, z);
      const r = QR(i);
      gross.lage(x, g, z, r);
      gross.klotz(0, 1.7, 0, 7, 3.4, 5, C.betonH, 0, C.betonD);
      gross.box(0, 3.55, 0, 8.2, 0.3, 6.2, C.nacht);
      gross.frei();
      glut.lage(x, g, z, r);
      glut.quad([-3, 1.2, 2.53], [2.6, 1.2, 2.53], [2.6, 2.8, 2.53], [-3, 2.8, 2.53], L.warm);
      glut.quad([3.53, 1.2, 1.9], [3.53, 1.2, -1.9], [3.53, 2.8, -1.9], [3.53, 2.8, 1.9], L.warm);
      glut.frei();
      schein.lage(x, g, z, r);
      kegel(0, 3.4, 3.4, 0.05, 0.8, 3.2, L.warm, 0.1);
      schein.frei();
      merke(x, z, 5);
      klein.lage(x, g, z, r);
      klein.box(-0.4, 1.3, -0.2, 0.7, 0.5, 0.6, C.stahlD);
      klein.frei();
      const bi = S(10);
      const bl = -(t.wh[bi] + 3.6);
      const bx = X(bi, bl);
      const bz = Z(bi, bl);
      const bg = ground(bx, bz);
      gross.lage(bx, bg, bz, QR(bi));
      gross.klotz(0, 0.6, 0, 0.6, 1.2, 0.6, C.stahl, 0, C.stahlD);
      gross.box(0, 4.1, 0.3, 0.16, 6, 0.16, C.weiss);
      for (let k = 0; k < 3; k++) gross.box(0, 1.9 + k * 2, 0.3, 0.18, 0.8, 0.18, C.kran);
      gross.box(0, 1.1, -0.5, 0.4, 0.5, 0.9, C.stahlD);
      gross.frei();
      merke(bx, bz, 1);
    }
    // Arbeiter am Start: winken von beiden Seiten
    const nW = lo ? 6 : hi ? 16 : 12;
    let made = 0;
    for (let k = 0; k < 80 && made < nW; k++) {
      const m = -34 + rnd() * 80;
      const i = S(m);
      if (Math.abs(m) < 3) continue;
      const sd = rnd() < 0.5 ? -1 : 1;
      const lat = sd * (t.wh[i] + 3.6 + rnd() * 3.2);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 0.4) || !platz(x, z, 0.7)) continue;
      merke(x, z, 0.7);
      const yaw = vor(-sd * rightX(t, i), -sd * rightZ(t, i)) + (rnd() - 0.5) * 0.6;
      arbeiter(gross, x, ground(x, z), z, yaw, rnd() < 0.8);
      made++;
    }
    // Ein Gabelstapler dreht hinter den Zuschauern seine Runden
    {
      const i = S(52);
      const lat = t.wh[i] + 22;
      staplerRunde(X(i, lat), Z(i, lat), 9, 5, QR(i));
    }
  }

  // ==================================================================================
  // 2. Montagehalle mit Sheddach und Laufkran
  // ==================================================================================
  const HALLE_A = 300;
  const HALLE_B = 380;
  const HB = 22.5; // halbe Breite
  const TRAUF = 13.2; // Unterkante der Sheds über der Fahrbahn
  const FIRST = 17.6;
  const KRAN_Y = 11.0; // Unterkante der Kranbrücke über der Fahrbahn
  const kranTeile = { bruecke: -1, katze: -1, seil: -1, haken: -1 };
  {
    const P = (m: number, lat: number, h: number): V3 => {
      const i = S(m);
      return [X(i, lat), t.py[i] + h, Z(i, lat)];
    };
    const nb = Math.round((HALLE_B - HALLE_A) / 8);
    for (let k = 0; k <= nb; k++) {
      const m = HALLE_A + k * 8;
      const i = S(m);
      const y = t.py[i];
      // Stützen und Binder
      for (const sd of [-1, 1]) {
        const x = X(i, sd * (HB - 0.4));
        const z = Z(i, sd * (HB - 0.4));
        const g = ground(x, z);
        gross.lage(x, g, z, QR(i));
        gross.klotz(0, (y + TRAUF - g) / 2, 0, 0.8, y + TRAUF - g, 0.8, C.stahl);
        gross.box(0, y + KRAN_Y - 0.6 - g, -sd * 0.9, 0.7, 0.5, 1.4, C.stahlD);
        gross.frei();
        merke(x, z, 0.8);
      }
      gross.lage(X(i, 0), y, Z(i, 0), QR(i));
      gross.box(0, TRAUF - 0.4, 0, 0.5, 0.8, HB * 2, C.stahl);
      gross.frei();
      if (k === nb) break;
      const m1 = m + 8;
      // Shed: hoch bei m, niedrig bei m1
      const mid = P(m + 4, 0, TRAUF - 4);
      gross.doppel(P(m, -HB, FIRST), P(m, HB, FIRST), P(m1, HB, TRAUF), P(m1, -HB, TRAUF), C.dach, C.dachU, mid);
      // Glasfläche (Stirn des Sheds) bei m: leuchtet beidseitig
      const lo0 = k === 0 ? TRAUF - 0.8 : TRAUF;
      const ref = P(m + 1, 0, 15);
      glut.flaeche(P(m, -HB + 0.4, lo0), P(m, HB - 0.4, lo0), P(m, HB - 0.4, FIRST - 0.2), P(m, -HB + 0.4, FIRST - 0.2), L.warm, ref, false);
      glut.flaeche(P(m, -HB + 0.4, lo0), P(m, HB - 0.4, lo0), P(m, HB - 0.4, FIRST - 0.2), P(m, -HB + 0.4, FIRST - 0.2), rgb(0xd8a060), ref, true);
      // Längswände oben (über den Seitenflächen): Blech mit Fensterband
      for (const sd of [-1, 1]) {
        const inner = P(m + 4, 0, 10);
        gross.doppel(P(m, sd * HB, 9.0), P(m1, sd * HB, 9.0), P(m1, sd * HB, TRAUF), P(m, sd * HB, FIRST), C.blech, C.blechD, inner);
        const off = sd * 0.08;
        for (const s2 of [1, -1]) {
          glut.flaeche(P(m + 0.6, sd * HB + off * s2, 9.7), P(m1 - 0.6, sd * HB + off * s2, 9.7), P(m1 - 0.6, sd * HB + off * s2, 10.9), P(m + 0.6, sd * HB + off * s2, 10.9), L.warm, inner, s2 > 0);
        }
      }
      // Kranbahn
      for (const sd of [-1, 1]) gross.stab(P(m, sd * 19.8, KRAN_Y - 0.25), P(m1, sd * 19.8, KRAN_Y - 0.25), 0.5, C.stahlD);
      // Hallenlampen über der Bahn (12 m hoch) mit Lichtkegel
      if (k > 0) {
        for (const lat of [-7, 7]) {
          const ii = S(m);
          const lx = X(ii, lat);
          const lz = Z(ii, lat);
          const ly = t.py[ii];
          klein.lage(lx, ly, lz, QR(ii));
          klein.box(0, 12.5, 0, 1.2, 0.35, 1.2, C.nacht);
          klein.frei();
          glut.lage(lx, ly, lz, QR(ii));
          glut.quad([-0.5, 12.31, -0.5], [0.5, 12.31, -0.5], [0.5, 12.31, 0.5], [-0.5, 12.31, 0.5], L.weiss);
          glut.frei();
          schein.lage(lx, ly, lz, QR(ii));
          kegel(0, 12.3, 0, 0.02, 0.5, 5.5, L.warm, 0.016);
          schein.frei();
        }
      }
      // Hallenboden an den Seiten
      for (const sd of [-1, 1]) {
        const ya = t.py[S(m)] - 0.2;
        const a = P(m, sd * 9.2, 0);
        const b = P(m1, sd * 9.2, 0);
        const c = P(m1, sd * HB, 0);
        const d = P(m, sd * HB, 0);
        a[1] = b[1] = c[1] = d[1] = ya;
        klein.flaeche(a, b, c, d, rgb(0x8c887f), [a[0], ya - 5, a[2]], true);
        const gc = Math.min(ground(c[0], c[2]), ground(d[0], d[2])) - 0.2;
        klein.flaeche(d, c, [c[0], gc, c[2]], [d[0], gc, d[2]], C.betonD, P(m + 4, 0, 0), true);
      }
      // Was in der Halle steht: je Seite ein Stück
      for (const sd of [-1, 1]) {
        const mm = m + 4;
        const i2 = S(mm);
        const lat = sd * 16.5;
        const x = X(i2, lat);
        const z = Z(i2, lat);
        const yb = t.py[i2] - 0.2;
        const r = QR(i2);
        const what = (k * 7 + (sd > 0 ? 3 : 0)) % 5;
        if (what === 0 || what === 3) {
          gross.lage(x, yb, z, r);
          spule(gross, 0, 0, 0, 0.35 + rnd() * 0.6);
          gross.frei();
          if (what === 3 && !lo) arbeiter(gross, x + rightX(t, i2) * -sd * 2.6, yb, z + rightZ(t, i2) * -sd * 2.6, vor(-sd * rightX(t, i2), -sd * rightZ(t, i2)), rnd() < 0.5);
        } else if (what === 1) {
          gross.lage(x, yb, z, r);
          kabeltrommel(gross, -1.6, 0, 0, 1.3, 1.2);
          kabeltrommel(gross, 1.4, 0, 0.3, 1.0, 1.0);
          gross.frei();
        } else if (what === 2) {
          klein.lage(x, yb, z, r);
          for (let q = 0; q < 5; q++) klein.box(0, 0.12 + q * 0.2, 0, 3.6 - q * 0.1, 0.18, 2.0, q % 2 ? C.stahlH : C.stahl, q * 0.04);
          klein.frei();
          gross.lage(x, yb, z, r);
          kabeltrommel(gross, 0, 1.08, -2.6, 0.7, 0.6);
          gross.frei();
        } else {
          gross.lage(x, yb, z, r);
          gross.klotz(0, 0.5, 0, 3.0, 1.0, 1.2, C.holzD, 0, C.holz);
          gross.box(-0.6, 1.3, 0, 0.9, 0.6, 0.6, C.stahlD);
          gross.box(0.7, 1.15, 0, 0.6, 0.3, 0.5, C.kupfer);
          gross.frei();
          glut.lage(x, yb, z, r);
          glut.quad([-1, 2.6, -0.2], [1, 2.6, -0.2], [1, 2.6, 0.2], [-1, 2.6, 0.2], L.weiss);
          glut.frei();
          klein.lage(x, yb, z, r);
          klein.box(0, 2.7, 0, 2.2, 0.15, 0.5, C.nacht);
          klein.box(-1, 1.85, 0, 0.08, 1.7, 0.08, C.stahlD);
          klein.box(1, 1.85, 0, 0.08, 1.7, 0.08, C.stahlD);
          klein.frei();
        }
      }
    }
    // Giebel vorn: Blech über dem Binder, mit Lichtband
    {
      const i = S(HALLE_A);
      gross.lage(X(i, 0), t.py[i], Z(i, 0), QR(i));
      gross.box(-0.3, TRAUF - 1.1, 0, 0.3, 1.0, HB * 2 + 0.6, C.blechD);
      gross.frei();
    }
    // Laufkran (bewegt): Brücke, Katze, Seil, Hakenflasche
    dyn.beginn();
    dyn.box(-0.75, 0.55, 0, 0.5, 1.1, 39.2, C.kran, 0, C.kranD);
    dyn.box(0.75, 0.55, 0, 0.5, 1.1, 39.2, C.kran, 0, C.kranD);
    for (const sd of [-1, 1]) dyn.box(0, 0.45, sd * 19.8, 3.4, 0.9, 1.0, C.stahlD);
    for (let k = -3; k <= 3; k++) dyn.box(0, 1.15, k * 5.4, 2.0, 0.12, 0.25, C.kranD);
    kranTeile.bruecke = dyn.ende(0);
    dyn.beginn();
    dyn.box(0, 1.55, 0, 2.3, 0.8, 2.2, C.stahlD, 0, C.kran);
    dyn.rolle(0, 1.55, 0, 0.45, 1.4, 8, C.stahl, false, Math.PI / 2);
    kranTeile.katze = dyn.ende(0);
    dyn.beginn();
    dyn.box(-0.2, -0.5, 0, 0.06, 1, 0.06, C.kabel);
    dyn.box(0.2, -0.5, 0, 0.06, 1, 0.06, C.kabel);
    kranTeile.seil = dyn.ende(0);
    dyn.beginn();
    dyn.box(0, 0.4, 0, 0.8, 0.8, 0.5, C.kran, 0, C.stahlD);
    dyn.geo(new THREE.TorusGeometry(0.28, 0.08, 4, 8, Math.PI * 1.4), C.stahlH, 0, -0.25, 0, 0, Math.PI / 2, Math.PI * 0.8);
    kranTeile.haken = dyn.ende(0);
    lampe(0, 2.1, 0, 0.32, 1, 0.3, 0xff9a3a, kranTeile.katze);
  }

  // ==================================================================================
  // 3. Rund um die Magnettrommel: Schaltschränke, Kabelbrücken, Umrichterhaus, Schornstein
  // ==================================================================================
  let schlot: V3 = [0, -1e9, 0];
  if (t.drums.length > 0) {
    const d = t.drums[0];
    const m0 = d.first * t.step;
    const m1 = (d.first + d.count) * t.step;
    const mm = (m0 + m1) / 2;
    // Schaltschränke an den Enden, beidseitig
    for (const [ma, sd] of [
      [m0 + 14, 1],
      [m0 + 22, -1],
      [m1 - 30, 1],
      [m1 - 22, -1],
    ] as [number, number][]) {
      for (let k = 0; k < (lo ? 4 : 6); k++) {
        const i = S(ma + k * 1.15);
        const lat = sd * 23.5;
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!darf(x, z, 0.6, 2.4)) continue;
        merke(x, z, 0.6);
        schrank(x, ground(x, z), z, vor(-sd * rightX(t, i), -sd * rightZ(t, i)));
      }
      const i = S(ma + 3);
      const x = X(i, sd * 25.5);
      const z = Z(i, sd * 25.5);
      if (trommelOk(x, z, 0, 3.5, 0.2)) lampe(x, ground(x, z) + 3.2, z, 0.35, 1, rnd(), 0xff9a3a);
    }
    // Umrichterhaus (rechts, innen) mit Kabelbrücken zur Trommel
    {
      const i = S(mm);
      const lat = t.wh[i] + 57;
      const x = X(i, lat + 9);
      const z = Z(i, lat + 9);
      const g = ground(x, z) - 0.2;
      const r = QR(i);
      gross.lage(x, g, z, r);
      gross.klotz(0, 5.5, 0, 36, 11, 18, C.ziegel, 0, C.dach);
      gross.box(0, 11.2, 0, 36.6, 0.5, 18.6, C.betonH);
      for (let k = -2; k <= 2; k++) gross.zyl(k * 6.5, 11.4, 2, 1.3, 1.3, 1.2, 8, C.stahl);
      gross.frei();
      merke(x, z, 20);
      glut.lage(x, g, z, r);
      klein.lage(x, g, z, r);
      fenster([-16.5, 0, -9.06], [16.5, 0, -9.06], 6.4, 9.2, 8, [0, 5, 0], 0.85);
      fenster([-16.5, 0, -9.06], [16.5, 0, -9.06], 2.2, 4.4, 8, [0, 5, 0], 0.6);
      glut.frei();
      klein.frei();
      // Kühlrippen (Umrichter) mit blau leuchtenden Spulen davor
      for (let k = 0; k < 3; k++) {
        const ii = S(mm - 26 + k * 4.5);
        const sl = t.wh[ii] + 46;
        const sx = X(ii, sl);
        const sz = Z(ii, sl);
        if (!darf(sx, sz, 1.8, 4)) continue;
        merke(sx, sz, 1.8);
        const sg = ground(sx, sz);
        gross.lage(sx, sg, sz, QR(ii));
        gross.klotz(0, 0.4, 0, 2.8, 0.8, 2.8, C.betonD);
        gross.geo(new THREE.CylinderGeometry(1.25, 1.25, 2.6, 10), C.kupfer, 0, 2.1, 0);
        gross.geo(new THREE.CylinderGeometry(0.5, 0.5, 3.0, 8), C.stahlH, 0, 2.1, 0);
        gross.frei();
        glut.lage(sx, sg, sz, QR(ii));
        glut.geo(new THREE.CylinderGeometry(1.32, 1.32, 0.35, 10, 1, true), L.spule, 0, 2.9, 0);
        glut.geo(new THREE.CylinderGeometry(1.32, 1.32, 0.35, 10, 1, true), L.spule, 0, 1.3, 0);
        glut.frei();
        lampe(sx, sg + 2.1, sz, 3.2, 4, k * 0.7, 0x2a5fb0);
      }
      // Kabelbrücken: vom Haus bis 32 m vor die Trommelachse, Höhe 10 m
      for (const dm of [-30, 0, 30]) {
        const ii = S(mm + dm);
        const yy = t.py[ii];
        const la = t.wh[ii] + 56.5;
        let lb = la;
        // so nah an die Trommel wie erlaubt
        for (let l = la; l > 20; l -= 0.5) {
          const qx = X(ii, l);
          const qz = Z(ii, l);
          if (!trommelOk(qx, qz, yy + 9, yy + 10.6, 1.2)) break;
          lb = l;
        }
        const r2 = QR(ii);
        const cx = X(ii, (la + lb) / 2);
        const cz = Z(ii, (la + lb) / 2);
        const len = la - lb;
        gross.lage(cx, yy, cz, r2);
        gross.box(0, 9.9, 0, 1.6, 0.25, len, C.stahl);
        gross.box(0.8, 10.25, 0, 0.1, 0.5, len, C.stahlD);
        gross.box(-0.8, 10.25, 0, 0.1, 0.5, len, C.stahlD);
        gross.frei();
        klein.lage(cx, yy, cz, r2);
        for (const ox of [-0.45, 0, 0.45]) klein.rolle(ox, 10.2, 0, 0.16, len, 5, C.kabel);
        klein.frei();
        // Stützen
        for (let l = lb + 1; l < la; l += 9) {
          const px = X(ii, l);
          const pz = Z(ii, l);
          const pg = ground(px, pz);
          gross.lage(px, pg, pz, r2);
          gross.klotz(0.6, (yy + 9.8 - pg) / 2, 0, 0.3, yy + 9.8 - pg, 0.3, C.stahlD);
          gross.klotz(-0.6, (yy + 9.8 - pg) / 2, 0, 0.3, yy + 9.8 - pg, 0.3, C.stahlD);
          gross.frei();
        }
        // Steigleitung an der Trommelseite hinunter in einen Kasten
        const ex = X(ii, lb);
        const ez = Z(ii, lb);
        const eg = ground(ex, ez);
        gross.lage(ex, eg, ez, r2);
        gross.klotz(0, (yy + 10 - eg) / 2, 0.3, 1.0, yy + 10 - eg, 0.6, C.stahlD);
        gross.klotz(0, 1.1, 1.2, 2.4, 2.2, 1.4, rgb(0xbdb8aa), 0, C.stahlD);
        gross.frei();
        merke(ex, ez, 1.5);
        glut.lage(ex, eg, ez, r2);
        glut.flaeche([1.22, 1.6, 0.9], [1.22, 1.6, 1.1], [1.22, 1.8, 1.1], [1.22, 1.8, 0.9], L.gruen, [0, 1.1, 1.2], true);
        glut.frei();
      }
    }
    // Schornstein links (außen)
    {
      const i = S(mm + 28);
      const lat = -(t.wh[i] + 50);
      const x = X(i, lat);
      const z = Z(i, lat);
      const g = ground(x, z) - 0.3;
      const H = 78;
      const n = lo ? 8 : 12;
      const bands = 5;
      for (let k = 0; k < bands; k++) {
        const h0 = (k / bands) * H;
        const h1 = ((k + 1) / bands) * H;
        const r0 = 4.4 - (k / bands) * 1.8;
        const r1 = 4.4 - ((k + 1) / bands) * 1.8;
        gross.zyl(x, g + h0, z, r0, r1, h1 - h0, n, k === bands - 1 ? rgb(0x4a4a50) : k % 2 ? C.betonH : C.ziegel, true);
      }
      gross.zyl(x, g + H * 0.86, z, 3.4, 3.4, 0.6, n, C.stahlD);
      gross.zyl(x, g - 0.2, z, 6.5, 6, 2.6, n, C.betonD);
      lampe(x + 2.7, g + H + 0.6, z, 1.0, 2, 0.2, 0xff5a3a);
      lampe(x - 2.7, g + H + 0.6, z, 1.0, 2, 0.2, 0xff5a3a);
      merke(x, z, 7);
      schlot = [x, g + H, z];
    }
  }

  // ==================================================================================
  // 4. Verladerampe, Containerlager mit Portalkran, Gleisanschluss unter dem Sprung
  // ==================================================================================
  const portal = { katze: -1, seil: -1, spreader: -1, x: 0, y: 0, z: 0, rot: 0, a: 0, b: 0 };
  const zug = { teile: [] as number[], laenge: [] as number[], ox: 0, oy: 0, oz: 0, dx: 0, dz: 0, s0: 0, s1: 0 };
  {
    // Rampe rechts (innen): Laderampe, dahinter das Lagerhaus mit Rolltoren, darüber ein Vordach
    const RA = 784;
    const RB = 874;
    for (let m = RA; m < RB; m += 5) {
      const i = S(m + 2.5);
      const y = t.py[i];
      const r = QR(i);
      const x = X(i, t.wh[i] + 8.6);
      const z = Z(i, t.wh[i] + 8.6);
      const g = ground(x, z);
      gross.lage(x, g, z, r);
      gross.klotz(0, (y + 1.1 - g) / 2, 0, 5.05, y + 1.1 - g, 8.2, C.beton, 0, C.betonH);
      gross.box(0, y + 0.6 - g, -4.15, 4.6, 0.45, 0.2, C.nacht);
      gross.frei();
      merke(x, z, 4);
    }
    for (let m = RA; m < RB; m += 10) {
      const i = S(m + 5);
      const y = t.py[i];
      const r = QR(i);
      const lat = t.wh[i] + 22.7;
      const x = X(i, lat);
      const z = Z(i, lat);
      const g = ground(x, z) - 0.2;
      gross.lage(x, g, z, r);
      gross.klotz(0, (y + 10 - g) / 2, 0, 10.15, y + 10 - g, 18, C.blech, 0, C.dach);
      gross.box(0, y + 10.2 - g, 0, 10.3, 0.4, 18.3, C.betonH);
      gross.frei();
      merke(x, z, 9);
      // Rolltor: offen und hell oder zu
      const offen = (m / 10) % 3 !== 1;
      (offen ? glut : klein).lage(x, g, z, r);
      (offen ? glut : klein).flaeche([-2.3, y + 1.1 - g, -9.06], [2.3, y + 1.1 - g, -9.06], [2.3, y + 5.6 - g, -9.06], [-2.3, y + 5.6 - g, -9.06], offen ? L.warm : C.blechD, [0, 4, 0], true);
      glut.frei();
      klein.frei();
      if (offen) {
        // Kisten im Gegenlicht
        klein.lage(x, g, z, r);
        klein.box(-1.2, y + 1.1 - g + 0.6, -9.2, 1.2, 1.2, 0.3, C.holzD);
        klein.box(1.0, y + 1.1 - g + 0.4, -9.2, 0.9, 0.8, 0.3, C.holzD);
        klein.frei();
        schein.lage(x, g, z, r);
        schein.quadV([-2.3, y + 1.15 - g, -9.1], [2.3, y + 1.15 - g, -9.1], [3.4, y + 1.15 - g, -13.5], [-3.4, y + 1.15 - g, -13.5], dimm, dimm, [0, 0, 0], [0, 0, 0]);
        schein.frei();
      }
      // Vordach über der Rampe (nicht über der Bahn)
      const cx = X(i, t.wh[i] + 9.2);
      const cz = Z(i, t.wh[i] + 9.2);
      gross.lage(cx, y, cz, r);
      gross.box(0, 6.6, 0, 10.2, 0.3, 8.0, C.dach);
      gross.box(0, 3.85, -3.6, 0.25, 5.5, 0.25, C.stahlD);
      gross.frei();
      klein.lage(cx, y, cz, r);
      klein.box(0, 6.35, -1, 1.2, 0.2, 0.5, C.nacht);
      klein.frei();
      glut.lage(cx, y, cz, r);
      glut.quad([-0.5, 6.24, -1.2], [0.5, 6.24, -1.2], [0.5, 6.24, -0.8], [-0.5, 6.24, -0.8], L.natrium);
      glut.frei();
      // Ladung auf der Rampe
      if (!lo) {
        const kx = X(i, t.wh[i] + 7 + rnd() * 3);
        const kz = Z(i, t.wh[i] + 7 + rnd() * 3);
        klein.lage(kx, y + 1.1, kz, r + rnd() * 0.3);
        klein.box(0, 0.07, 0, 1.2, 0.14, 1.0, C.holz);
        const n = 1 + Math.floor(rnd() * 3);
        for (let q = 0; q < n; q++) klein.box(0, 0.6 + q * 0.95, 0, 1.0, 0.9, 0.85, q % 2 ? rgb(0xc89a62) : rgb(0xb0864f));
        klein.frei();
      }
    }
    {
      const i = S(830);
      const x = X(i, t.wh[i] + 7.5);
      const z = Z(i, t.wh[i] + 7.5);
      arbeiter(gross, x, t.py[i] + 1.1, z, vor(-rightX(t, i), -rightZ(t, i)), true);
      const i2 = S(856);
      const x2 = X(i2, t.wh[i2] + 6.4);
      const z2 = Z(i2, t.wh[i2] + 6.4);
      arbeiter(gross, x2, t.py[i2] + 1.1, z2, vor(-rightX(t, i2), -rightZ(t, i2)) + 0.4, true);
    }

    // Containerlager links (außen) mit Portalkran
    const CA = 772;
    const CB = 904;
    const rows = [-17.6, -21.0, -31.0, -34.4];
    for (let m = CA; m < CB; m += 13.4) {
      const i = S(m + 6.1);
      const r = QR(i);
      for (let q = 0; q < rows.length; q++) {
        const lat = -(t.wh[i] - 8.4) + rows[q];
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!darf(x, z, 1.4, 8)) continue;
        if (rnd() < 0.15) continue;
        const g = ground(x, z) - 0.05;
        const hgt = 1 + Math.floor(rnd() * (q === 0 ? 2 : 3));
        gross.lage(x, g, z, r);
        for (let h = 0; h < hgt; h++) container(gross, (rnd() - 0.5) * 0.3, h * 2.6, 0, pick(CONTAINER));
        gross.frei();
        for (const dm of [-4.5, 0, 4.5]) merke(x + t.tx[i] * dm, z + t.tz[i] * dm, 2);
      }
    }
    {
      const pm = 846;
      const i = S(pm);
      const y = t.py[i];
      const r = QR(i);
      const la = -(t.wh[i] + 5.6);
      const lb = -(t.wh[i] + 35);
      const c = (la + lb) / 2;
      const span = la - lb;
      const x = X(i, c);
      const z = Z(i, c);
      gross.lage(x, y, z, r);
      for (const sd of [-1, 1]) {
        const lz = (sd * span) / 2;
        for (const fx of [-5, 5]) gross.stab([fx, -0.4, lz], [fx * 0.3, 16.6, lz], 0.7, C.kran);
        gross.box(0, 0.2, lz, 12, 0.8, 1.2, C.stahlD);
        gross.box(0, 8, lz, 3.6, 0.4, 0.5, C.kranD);
      }
      gross.box(-1.0, 17.4, 0, 0.9, 1.7, span + 6, C.kran, 0, C.kranD);
      gross.box(1.0, 17.4, 0, 0.9, 1.7, span + 6, C.kran, 0, C.kranD);
      gross.klotz(0, 19.3, (span / 2) + 1.5, 3.0, 2.2, 2.6, C.stahlD, 0, C.kran);
      gross.frei();
      glut.lage(x, y, z, r);
      glut.quad([1.51, 18.6, span / 2 + 2.2], [1.51, 18.6, span / 2 + 0.8], [1.51, 19.6, span / 2 + 0.8], [1.51, 19.6, span / 2 + 2.2], L.warm);
      glut.frei();
      for (const sd of [-1, 1]) {
        const p = welt(gross.lage(x, y, z, r), 0, 18.6, sd * (span / 2 + 2.6));
        lampe(p.x, p.y, p.z, 0.4, 1, sd > 0 ? 0 : 0.5, 0xff9a3a);
      }
      gross.frei();
      portal.x = x;
      portal.y = y;
      portal.z = z;
      portal.rot = r;
      portal.a = -span / 2 + 3;
      portal.b = span / 2 - 3;
      dyn.beginn();
      dyn.box(0, 0.6, 0, 3.0, 1.2, 2.6, C.stahlD, 0, C.kran);
      dyn.box(0, 1.3, 0, 1.6, 0.3, 1.6, C.kran);
      portal.katze = dyn.ende(0);
      dyn.beginn();
      for (const ox of [-1.2, 1.2]) dyn.box(ox, -0.5, 0, 0.06, 1, 0.06, C.kabel);
      portal.seil = dyn.ende(0);
      dyn.beginn();
      dyn.box(0, 0.25, 0, 12.4, 0.5, 2.5, C.kran, 0, C.kranD);
      container(dyn, 0, -2.65, 0, 0xe6e2d8);
      portal.spreader = dyn.ende(0);
    }
    // Zweiter Gabelstapler hinter der Rampe
    {
      const i = S(892);
      const lat = t.wh[i] + 20;
      staplerRunde(X(i, lat), Z(i, lat), 7, 4.5, QR(i));
    }

    // Gleisanschluss: quer unter der Sprunglücke hindurch
    let g0 = -1;
    let g1 = -1;
    for (let i = 0; i < N; i++) {
      if (t.edge[i] & EDGE_GAP) {
        if (g0 < 0) g0 = i;
        g1 = i;
      }
    }
    if (g0 >= 0) {
      const gi = Math.round((g0 + g1) / 2);
      const ox = t.px[gi];
      const oz = t.pz[gi];
      const dx = rightX(t, gi);
      const dz = rightZ(t, gi);
      const rot = vor(dx, dz); // lokal +z entlang des Gleises (nach rechts, ins Werk)
      // Wie weit reicht das Gleis? Nach innen bis 130 m, nach außen bis 70 m – solange frei.
      let sMax = 14;
      for (let s = 14; s <= 130; s += 2) {
        if (!frei(ox + dx * s, oz + dz * s, 1.6) || !platz(ox + dx * s, oz + dz * s, 1.6)) break;
        sMax = s;
      }
      let sMin = -14;
      for (let s = -14; s >= -70; s -= 2) {
        if (!frei(ox + dx * s, oz + dz * s, 1.6) || !platz(ox + dx * s, oz + dz * s, 1.6)) break;
        sMin = s;
      }
      // Höhe des Gleisbetts: über dem Gelände, gemittelt
      let ys = 0;
      let ns = 0;
      for (let s = sMin; s <= sMax; s += 6) {
        ys += ground(ox + dx * s, oz + dz * s);
        ns++;
      }
      const gy = ys / Math.max(1, ns) + 0.1;
      const yb = gy - 0.2;
      klein.lage(ox, yb, oz, rot);
      const len = sMax - sMin;
      const mid = (sMax + sMin) / 2;
      klein.box(0, -0.15, mid, 3.4, 0.5, len, rgb(0x6f6a62));
      for (let s = sMin + 0.6; s < sMax; s += lo ? 2.4 : 1.2) klein.quad([-1.3, 0.12, s + 0.14], [1.3, 0.12, s + 0.14], [1.3, 0.12, s - 0.14], [-1.3, 0.12, s - 0.14], C.holzD);
      for (const rx of [-0.75, 0.75]) klein.box(rx, 0.27, mid, 0.12, 0.16, len, C.stahlH);
      klein.box(0, 0.6, sMax + 0.4, 3.0, 1.0, 0.6, C.kran);
      klein.frei();
      for (let s = sMin; s <= sMax; s += 6) merke(ox + dx * s, oz + dz * s, 2);
      // Warnblinker an der Kreuzung (abwechselnd)
      for (const sd of [-1, 1]) {
        const s = sd * (t.wh[gi] + 3.4);
        const px = ox + dx * s + t.tx[gi] * 3.2;
        const pz = oz + dz * s + t.tz[gi] * 3.2;
        const pg = ground(px, pz);
        gross.lage(px, pg, pz, rot);
        gross.klotz(0, 1.9, 0, 0.2, 3.8, 0.2, C.weiss);
        gross.box(0, 3.6, 0, 1.2, 0.4, 0.2, C.nacht);
        gross.frei();
        const a = welt(gross.lage(px, pg, pz, rot), -0.4, 3.6, 0.12 * -sd);
        lampe(a.x, a.y, a.z, 0.36, 3, 0, 0xffa040);
        const b = welt(gross.lage(px, pg, pz, rot), 0.4, 3.6, 0.12 * -sd);
        lampe(b.x, b.y, b.z, 0.36, 3, 0.5, 0xffa040);
        gross.frei();
      }
      // Abgestellte Wagen außen (Süden)
      if (sMin < -30) {
        const wagen = (b: Bau, s: number, art: number): void => {
          b.lage(ox + dx * s, yb + 0.33, oz + dz * s, rot);
          b.box(0, 0.75, 0, 2.6, 0.35, 12, C.stahlD);
          for (const wz of [-4.2, 4.2]) for (const wx of [-0.75, 0.75]) b.rolle(wx, 0.45, wz, 0.45, 0.25, 8, C.reifen, false, Math.PI / 2);
          if (art === 0) {
            b.klotz(0, 2.6, 0, 2.9, 3.4, 12, rgb(0x7a4a36), 0, C.stahl);
            b.box(1.47, 2.4, 0, 0.06, 2.6, 3.2, rgb(0x5f3a2a));
          } else {
            b.klotz(0, 1.7, 0, 2.9, 1.6, 12, rgb(0x5f6a5a), 0, C.nacht);
            for (let q = -2; q <= 2; q++) b.box(1.47, 1.7, q * 2.4, 0.08, 1.6, 0.15, rgb(0x4a5446));
          }
          b.frei();
        };
        wagen(gross, Math.max(sMin + 7, -27), 0);
        if (sMin < -44) wagen(gross, -41, 1);
      }
      // Rangierzug innen: Lok und zwei Wagen, fährt langsam hin und her, nie näher als 16 m an die Bahnmitte
      if (sMax > 64) {
        zug.ox = ox;
        zug.oy = yb + 0.33;
        zug.oz = oz;
        zug.dx = dx;
        zug.dz = dz;
        zug.s0 = Math.max(16, t.wh[gi] + 7.5);
        zug.s1 = Math.max(zug.s0, Math.min(sMax - 46, zug.s0 + 34));
        // Lok (vorn = −z, zur Bahn hin)
        dyn.beginn();
        dyn.box(0, 0.8, 0, 2.7, 0.5, 10, C.stahlD);
        dyn.box(0, 2.1, 1.2, 2.1, 2.1, 5.8, C.gruen, 0, rgb(0x2f5a44));
        dyn.box(0, 2.5, -2.7, 2.8, 2.9, 2.6, C.gruen, 0, C.nacht);
        dyn.box(0, 1.25, 0, 2.75, 0.3, 9.6, C.creme);
        dyn.box(1.42, 2.9, -2.7, 0.05, 0.8, 1.8, C.fensterAus);
        dyn.box(-1.42, 2.9, -2.7, 0.05, 0.8, 1.8, C.fensterAus);
        dyn.box(0, 2.9, -4.02, 2.0, 0.8, 0.05, C.fensterAus);
        dyn.box(0, 3.4, 3.5, 0.5, 0.8, 0.5, C.nacht);
        for (const wz of [-3, 0, 3]) for (const wx of [-0.75, 0.75]) dyn.rolle(wx, 0.45, wz, 0.45, 0.25, 8, C.reifen, false, Math.PI / 2);
        for (const sd of [-1, 1]) dyn.box(0, 0.9, sd * 5.15, 2.8, 0.25, 0.3, C.kran);
        const lok = dyn.ende(1);
        lampe(0.8, 1.6, -4.2, 0.3, 0, 0, 0xfff0c0, lok);
        lampe(-0.8, 1.6, -4.2, 0.3, 0, 0, 0xfff0c0, lok);
        lampe(0, 4.05, -2.7, 0.3, 1, 0.2, 0xff9a3a, lok);
        zug.teile.push(lok);
        zug.laenge.push(10.4);
        // Flachwagen mit zwei fertigen Spulen, offener Wagen mit Schrott
        for (let w = 0; w < 2; w++) {
          dyn.beginn();
          dyn.box(0, 0.8, 0, 2.7, 0.45, 12, C.stahlD);
          for (const wz of [-4.2, 4.2]) for (const wx of [-0.75, 0.75]) dyn.rolle(wx, 0.45, wz, 0.45, 0.25, 8, C.reifen, false, Math.PI / 2);
          if (w === 0) {
            for (const sz of [-3, 3]) {
              dyn.geo(new THREE.CylinderGeometry(1.25, 1.25, 2.2, 10), C.kupfer, 0, 2.3, sz, 0, 0, Math.PI / 2);
              dyn.geo(new THREE.CylinderGeometry(0.5, 0.5, 2.5, 8), C.stahlH, 0, 2.3, sz, 0, 0, Math.PI / 2);
              dyn.box(0, 1.2, sz, 2.2, 0.35, 1.2, C.holzD);
            }
          } else {
            dyn.klotz(0, 1.8, 0, 2.8, 1.6, 12, rgb(0x6a5446), 0, C.nacht);
            for (let q = -2; q <= 2; q++) dyn.box(1.43, 1.8, q * 2.4, 0.08, 1.6, 0.15, rgb(0x54443a));
            dyn.box(0, 2.62, -2, 2.2, 0.2, 5, rgb(0x5a5a62));
            dyn.box(0, 2.62, 3, 2.0, 0.3, 4, rgb(0x4a4a52));
          }
          zug.teile.push(dyn.ende(1));
          zug.laenge.push(12.4);
        }
      }
    }
  }

  // ==================================================================================
  // 5. Kühltürme mit Dampf, Rohrbrücke hoch über der Bahn
  // ==================================================================================
  const kronen: number[] = []; // x, y, z, Radius
  {
    const towers: [number, number, number, number][] = [
      [1062, 64, 24, 58],
      [1150, 72, 27, 68],
      [1238, 64, 23, 56],
    ];
    for (const [m, l, R, H] of towers) {
      if (lo && m === 1238) continue;
      const i = S(m);
      let lat = -(t.wh[i] + l - 8.4);
      let x = X(i, lat);
      let z = Z(i, lat);
      for (let k = 0; k < 12 && !(frei(x, z, R + 3) && platz(x, z, R + 3)); k++) {
        lat -= 6;
        x = X(i, lat);
        z = Z(i, lat);
      }
      const top = kuehlturm(x, z, R, H);
      const hw = 0.76 * H;
      const rw = 0.6 * R;
      const c = hw / Math.sqrt((R / rw) ** 2 - 1);
      kronen.push(x, top, z, rw * Math.sqrt(1 + ((H - hw) / c) ** 2));
    }
    // Rohrbrücke quer über die Bahn (Unterkante 11 m) zum Pumpenhaus innen
    {
      const i = S(1194);
      const y = t.py[i];
      const r = QR(i);
      const ox = X(i, 0);
      const oz = Z(i, 0);
      const la = -(t.wh[i] + 34);
      const lb = t.wh[i] + 24;
      gross.lage(ox, y, oz, r);
      for (const [px, c] of [
        [-0.9, C.stahlH],
        [0.9, C.gruen],
      ] as [number, RGB][]) {
        gross.rolle(px, 12.6, (la + lb) / 2, 0.72, lb - la, 10, c, true);
        // senkrecht hinunter an beiden Enden
        gross.geo(new THREE.CylinderGeometry(0.72, 0.72, 12.6, 10, 1, true), c, px, 6.3, la, 0, 0, 0);
        gross.geo(new THREE.CylinderGeometry(0.72, 0.72, 12.6, 10, 1, true), c, px, 6.3, lb, 0, 0, 0);
      }
      gross.box(0, 11.65, (la + lb) / 2, 3.2, 0.5, lb - la, C.stahlD);
      for (const lz of [-(t.wh[i] + 4.2), t.wh[i] + 4.2, la + 6, lb - 6]) {
        for (const fx of [-1.4, 1.4]) gross.box(fx, 5.7, lz, 0.4, 11.4, 0.4, C.stahlD);
        gross.box(0, 3.5, lz, 2.8, 0.25, 0.25, C.stahlD);
      }
      gross.frei();
      // Pumpenhaus innen
      const px = X(i, lb + 6);
      const pz = Z(i, lb + 6);
      const pg = ground(px, pz) - 0.2;
      gross.lage(px, pg, pz, r);
      gross.klotz(0, 3.5, 0, 12, 7, 9, C.ziegel, 0, C.dach);
      gross.frei();
      glut.lage(px, pg, pz, r);
      klein.lage(px, pg, pz, r);
      fenster([-5, 0, -4.56], [5, 0, -4.56], 3.6, 5.4, 4, [0, 3, 0]);
      glut.frei();
      klein.frei();
      merke(px, pz, 8);
      for (const lz of [la, lb]) merke(X(i, lz), Z(i, lz), 2);
    }
  }

  // ==================================================================================
  // 6. Umspannwerk: Trafos, Portale, Zaun; Freileitung über die Bahn
  // ==================================================================================
  {
    const UA = 1318;
    const UB = 1420;
    const inner = -(8.4 + 6);
    const outer = -(8.4 + 54);
    // Zaun (Pfosten und zwei Drähte)
    const zaunPunkt = (m: number, lat: number): V3 => {
      const i = S(m);
      const x = X(i, lat);
      const z = Z(i, lat);
      return [x, ground(x, z), z];
    };
    const zaunLinie = (pts: V3[]): void => {
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        strang(klein, [a[0], a[1] + 1.2, a[2]], [b[0], b[1] + 1.2, b[2]], 0.08, C.stahlH);
        strang(klein, [a[0], a[1] + 2.3, a[2]], [b[0], b[1] + 2.3, b[2]], 0.08, C.stahlH);
      }
      for (const p of pts) klein.stab([p[0], p[1] - 0.2, p[2]], [p[0], p[1] + 2.5, p[2]], 0.12, C.stahl);
    };
    const front: V3[] = [];
    const back: V3[] = [];
    for (let m = UA; m <= UB; m += lo ? 17 : 8.5) {
      front.push(zaunPunkt(m, inner));
      back.push(zaunPunkt(m, outer));
    }
    zaunLinie(front);
    zaunLinie(back);
    zaunLinie([zaunPunkt(UA, inner), zaunPunkt(UA, (inner + outer) / 2), zaunPunkt(UA, outer)]);
    zaunLinie([zaunPunkt(UB, inner), zaunPunkt(UB, (inner + outer) / 2), zaunPunkt(UB, outer)]);
    for (let m = UA; m <= UB; m += 10) merke(zaunPunkt(m, (inner + outer) / 2)[0], zaunPunkt(m, (inner + outer) / 2)[2], 22);
    // Transformatoren
    const bush: V3[] = [];
    for (const m of [1338, 1368, 1398]) {
      const i = S(m);
      const lat = -24;
      const x = X(i, lat);
      const z = Z(i, lat);
      const g = ground(x, z);
      const r = QR(i);
      gross.lage(x, g, z, r);
      gross.klotz(0, 0.35, 0, 7.5, 0.7, 6.5, C.betonD);
      gross.klotz(0, 2.7, 0, 5.2, 4.0, 4.2, C.trafo, 0, rgb(0x4a564e));
      for (const sd of [-1, 1]) for (let q = -2; q <= 2; q++) gross.box(q * 0.95, 2.6, sd * 2.5, 0.12, 3.2, 0.8, rgb(0x52605a));
      gross.rolle(-1.6, 5.4, 0, 0.6, 3.8, 8, C.trafo, false, 0);
      gross.frei();
      klein.lage(x, g, z, r);
      for (const bx of [-1.6, 0, 1.6]) {
        for (let q = 0; q < 2; q++) klein.geo(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 6), C.porzellan, bx, 5.1 + q * 0.5, 1.2);
        klein.geo(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 5, 1, true), C.porzellan, bx, 5.4, 1.2);
        const p = welt(klein, bx, 6.2, 1.2);
        bush.push([p.x, p.y, p.z]);
      }
      klein.frei();
      lampe(X(i, lat + 3.2), g + 4.6, Z(i, lat + 3.2), 0.28, 0, 0, 0x7dff9a);
    }
    // Portale mit Sammelschienen
    const bus: V3[] = [];
    for (const m of [1326, 1352, 1382, 1412]) {
      const i = S(m);
      const r = QR(i);
      for (const lat of [-34, -46]) {
        const x = X(i, lat);
        const z = Z(i, lat);
        const g = ground(x, z);
        klein.lage(x, g, z, r);
        for (const fx of [-0.5, 0.5]) for (const fz of [-0.5, 0.5]) klein.stab([fx, 0, fz], [fx * 0.6, 13, fz * 0.6], 0.16, C.stahlH);
        for (let h = 2; h < 13; h += 3.2) {
          klein.stab([-0.5, h, -0.5], [0.5, h + 1.6, 0.5], 0.08, C.stahlH);
        }
        klein.frei();
      }
      const a = [X(i, -34), ground(X(i, -34), Z(i, -34)) + 12.8, Z(i, -34)] as V3;
      const b = [X(i, -46), ground(X(i, -46), Z(i, -46)) + 12.8, Z(i, -46)] as V3;
      klein.stab(a, b, 0.4, C.stahlH);
      for (const f of [0.2, 0.5, 0.8]) {
        const p: V3 = [a[0] + (b[0] - a[0]) * f, a[1] - 0.2, a[2] + (b[2] - a[2]) * f];
        klein.geo(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 5), C.porzellan, p[0], p[1] - 0.9, p[2]);
        bus.push([p[0], p[1] - 1.8, p[2]]);
      }
    }
    // Sammelschienen längs (die drei Phasen von Portal zu Portal)
    for (let k = 0; k + 3 < bus.length; k++) klein.stab(bus[k], bus[k + 3], 0.1, C.stahlH);
    // Trafos an die Schienen
    for (const p of bush) {
      let best = bus[0];
      let bd = Infinity;
      for (const b of bus) {
        const dd = Math.hypot(b[0] - p[0], b[2] - p[2]);
        if (dd < bd) {
          bd = dd;
          best = b;
        }
      }
      if (best) draht(klein, p, best, 0.6, 3, 0.07);
    }
    // Schalthaus
    {
      const i = S(1412);
      const x = X(i, -27);
      const z = Z(i, -27);
      const g = ground(x, z) - 0.2;
      gross.lage(x, g, z, QR(i));
      gross.klotz(0, 2.4, 0, 7, 4.8, 5.5, C.betonH, 0, C.dach);
      gross.frei();
      glut.lage(x, g, z, QR(i));
      klein.lage(x, g, z, QR(i));
      fenster([-3, 0, -2.81], [3, 0, -2.81], 2.0, 3.4, 3, [0, 2, 0], 1);
      glut.frei();
      klein.frei();
    }
    // Freileitung quer über die Bahn: Masten links (außen) und rechts (innen)
    {
      const i = S(1458);
      const r = vor(rightX(t, i), rightZ(t, i)); // Querträger entlang der Fahrtrichtung
      const la = -(t.wh[i] + 26);
      const lb = t.wh[i] + 30;
      const A = gittermast(klein, X(i, la), Z(i, la), 30, r);
      const B = gittermast(klein, X(i, lb), Z(i, lb), 30, r);
      merke(X(i, la), Z(i, la), 4);
      merke(X(i, lb), Z(i, lb), 4);
      for (let k = 0; k < A.length; k++) draht(klein, A[k], B[k], k === A.length - 1 ? 2.5 : 3.5, lo ? 4 : 7);
      // weiter ins Werk: dritter Mast innen, schräg zum Werk hin
      const lc = lb + 70;
      if (frei(X(i, lc), Z(i, lc), 4) && platz(X(i, lc), Z(i, lc), 4)) {
        const Cc = gittermast(klein, X(i, lc), Z(i, lc), 30, r);
        merke(X(i, lc), Z(i, lc), 4);
        for (let k = 0; k < B.length; k++) draht(klein, B[k], Cc[k], 3.5, lo ? 4 : 7);
      }
      // nach außen zum Umspannwerk
      for (let k = 0; k < 3; k++) {
        const p = A[k];
        const q = bus[bus.length - 3 + k];
        if (q) draht(klein, p, [q[0], q[1] + 1.6, q[2]], 2.5, lo ? 4 : 6);
      }
      lampe(A[A.length - 1][0], A[A.length - 1][1] + 0.3, A[A.length - 1][2], 0.7, 2, 0.6, 0xff5a3a);
      lampe(B[B.length - 1][0], B[B.length - 1][1] + 0.3, B[B.length - 1][2], 0.7, 2, 0.1, 0xff5a3a);
    }
  }

  // ==================================================================================
  // 7. Werksgelände drinnen und draußen: Hallen, Tanks, Bürohaus, Wasserturm
  // ==================================================================================
  {
    const ort = (x: number, z: number, r: number, h: number): boolean => {
      if (!darf(x, z, r, h)) return false;
      merke(x, z, r);
      return true;
    };
    // Große Werkhallen im Innern
    const hallen: [number, number, number, number, number, number, number][] = [
      // x, z, Länge, Breite, Höhe, Drehung, Zähne
      [6, 30, 92, 46, 13, 0, 8],
      [-80, 170, 66, 36, 12, Math.PI / 2, 6],
      [70, 140, 54, 30, 11, Math.PI / 2, 5],
      [-120, -40, 44, 28, 10, 0.1, 4],
    ];
    for (const [x, z, Lx, Wz, H, r, n] of hallen) {
      if (lo && Lx < 50) continue;
      if (!ort(x, z, Math.hypot(Lx, Wz) / 2, H)) continue;
      halle(x, z, Lx, Wz, H, r, rnd() < 0.5 ? C.ziegel : C.blech, n);
    }
    // Bürohaus am Tor (innen) mit vielen hellen Fenstern
    {
      const x = -84;
      const z = -118;
      if (ort(x, z, 18, 16)) {
        const g = ground(x, z) - 0.2;
        gross.lage(x, g, z, 0.32);
        gross.klotz(0, 8, 0, 32, 16, 12, C.betonH, 0, C.dach);
        gross.box(0, 16.4, 0, 32.6, 0.8, 12.6, C.betonD);
        gross.frei();
        glut.lage(x, g, z, 0.32);
        klein.lage(x, g, z, 0.32);
        for (let f = 0; f < 4; f++) {
          fenster([-15, 0, -6.06], [15, 0, -6.06], 1.8 + f * 3.6, 3.8 + f * 3.6, 10, [0, 8, 0], 0.7);
          fenster([15, 0, 6.06], [-15, 0, 6.06], 1.8 + f * 3.6, 3.8 + f * 3.6, 10, [0, 8, 0], 0.5);
        }
        glut.frei();
        klein.frei();
      }
    }
    // Wasserturm
    {
      const x = -24;
      const z = -122;
      if (ort(x, z, 7, 34)) {
        const g = ground(x, z);
        gross.lage(x, g, z, 0);
        for (const [fx, fz] of [
          [-3, -3],
          [3, -3],
          [3, 3],
          [-3, 3],
        ]) gross.stab([fx * 1.3, 0, fz * 1.3], [fx, 24, fz], 0.6, C.stahl);
        gross.frei();
        gross.zyl(x, g + 24, z, 6.2, 6.2, 6, 12, C.stahlH);
        gross.geo(new THREE.ConeGeometry(6.6, 3, 12), C.dach, x, g + 31.5, z);
        lampe(x, g + 33.3, z, 0.7, 2, 0.4, 0xff5a3a);
      }
    }
    // Tanklager
    for (const [x, z, r, h] of [
      [118, 230, 8, 12],
      [100, 236, 7, 11],
      [112, 214, 6, 10],
      [-40, 250, 9, 13],
      [-24, 262, 7, 10],
    ] as [number, number, number, number][]) {
      if (lo && r < 7) continue;
      if (!ort(x, z, r + 1, h)) continue;
      const g = ground(x, z) - 0.2;
      gross.zyl(x, g, z, r, r, h, lo ? 10 : 14, rnd() < 0.5 ? C.weiss : C.stahlH);
      gross.geo(new THREE.ConeGeometry(r, 1.4, lo ? 10 : 14), C.stahl, x, g + h + 0.7, z);
      klein.zyl(x, g + h * 0.6, z, r + 0.05, r + 0.05, 0.6, lo ? 10 : 14, C.gruen, true);
    }
    // Gasbehälter draußen im Süden
    {
      const x = 30;
      const z = 400;
      if (ort(x, z, 20, 34)) {
        const g = ground(x, z) - 0.2;
        gross.zyl(x, g, z, 18, 18, 30, 16, rgb(0x7f8a86));
        gross.geo(new THREE.CylinderGeometry(14, 18, 4, 16), C.dach, x, g + 32, z);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          gross.stab([x + Math.cos(a) * 18.6, g, z + Math.sin(a) * 18.6], [x + Math.cos(a) * 18.6, g + 31, z + Math.sin(a) * 18.6], 0.6, C.stahlD);
        }
      }
    }
    // Lagerhallen draußen entlang der Strecke (beide Seiten, hinten)
    const typen = (): void => {
      for (let m = 40; m < 1500; m += lo ? 70 : 42) {
        if (m > 285 && m < 400) continue;
        const i = S(m + rnd() * 10);
        const sd = rnd() < 0.55 ? -1 : 1;
        const lat = sd * (t.wh[i] + 28 + rnd() * 26);
        const x = X(i, lat);
        const z = Z(i, lat);
        const Lx = 18 + rnd() * 18;
        const Wz = 12 + rnd() * 8;
        const H = 7 + rnd() * 6;
        if (!ort(x, z, Math.hypot(Lx, Wz) / 2, H + 3)) continue;
        const kind = rnd();
        if (kind < 0.55) halle(x, z, Lx, Wz, H, QR(i) + (rnd() - 0.5) * 0.3, pick([C.ziegel, C.blech, C.betonH, rgb(0x7f8f88)]), Math.max(2, Math.round(Lx / 9)));
        else {
          const g = ground(x, z) - 0.2;
          const r = QR(i) + (rnd() - 0.5) * 0.4;
          gross.lage(x, g, z, r);
          gross.klotz(0, H / 2, 0, Lx, H, Wz, pick([C.ziegel, C.blech, rgb(0x7f8f88)]), 0, C.dach);
          // Satteldach
          gross.quad([-Lx / 2, H, -Wz / 2], [-Lx / 2, H + 2.4, 0], [Lx / 2, H + 2.4, 0], [Lx / 2, H, -Wz / 2], C.dach);
          gross.quad([Lx / 2, H, Wz / 2], [Lx / 2, H + 2.4, 0], [-Lx / 2, H + 2.4, 0], [-Lx / 2, H, Wz / 2], C.dach);
          gross.tri([Lx / 2, H, -Wz / 2], [Lx / 2, H + 2.4, 0], [Lx / 2, H, Wz / 2], C.blechD);
          gross.tri([-Lx / 2, H, Wz / 2], [-Lx / 2, H + 2.4, 0], [-Lx / 2, H, -Wz / 2], C.blechD);
          gross.frei();
          glut.lage(x, g, z, r);
          klein.lage(x, g, z, r);
          fenster([-Lx / 2 + 1, 0, -Wz / 2 - 0.06], [Lx / 2 - 1, 0, -Wz / 2 - 0.06], H * 0.45, H * 0.72, Math.max(2, Math.round(Lx / 5)), [0, H / 2, 0], 0.6);
          fenster([Lx / 2 - 1, 0, Wz / 2 + 0.06], [-Lx / 2 + 1, 0, Wz / 2 + 0.06], H * 0.45, H * 0.72, Math.max(2, Math.round(Lx / 5)), [0, H / 2, 0], 0.6);
          glut.frei();
          klein.frei();
        }
      }
    };
    typen();
    // Kleinkram an der Bande: Kistenstapel, Fässer, Rohre, Paletten
    for (let m = 6; m < 1500; m += lo ? 44 : 27) {
      const i = S(m + rnd() * 6);
      const sd = rnd() < 0.5 ? -1 : 1;
      const lat = sd * (t.wh[i] + 4.2 + rnd() * 7);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!darf(x, z, 1.8, 3)) continue;
      merke(x, z, 1.8);
      const g = ground(x, z);
      const r = QR(i) + (rnd() - 0.5) * 0.5;
      const k = rnd();
      klein.lage(x, g, z, r);
      if (k < 0.3) {
        const n = 1 + Math.floor(rnd() * 3);
        for (let q = 0; q < n; q++) klein.box((q % 2) * 0.4, 0.55 + q * 1.1, 0, 1.1, 1.1, 1.1, q % 2 ? C.holz : rgb(0xb0864f), q * 0.4, C.holzD);
      } else if (k < 0.55) {
        for (let q = 0; q < 4; q++) klein.zyl((q % 2) * 0.75 - 0.4, 0, Math.floor(q / 2) * 0.75 - 0.4, 0.33, 0.33, 1.0, 6, q === 1 ? C.kran : pick([C.gruen, C.stahl, rgb(0x5f6f8a)]));
      } else if (k < 0.8) {
        for (let q = 0; q < 3; q++) klein.rolle(0, 0.32, -0.7 + q * 0.7, 0.32, 5, 6, C.stahlH, true, Math.PI / 2);
        klein.rolle(0, 0.86, -0.35, 0.32, 5, 6, C.stahlH, true, Math.PI / 2);
        klein.rolle(0, 0.86, 0.35, 0.32, 5, 6, C.stahlH, true, Math.PI / 2);
      } else {
        for (let q = 0; q < 4; q++) klein.box(0, 0.08 + q * 0.16, 0, 1.2, 0.14, 1.0, C.holz, q * 0.1);
      }
      klein.frei();
    }
  }

  // ==================================================================================
  // 8. Laternen mit Natriumlicht entlang der Strecke
  // ==================================================================================
  {
    let side = 1;
    for (let m = 40; m < 1500; m += 44) {
      if (m > HALLE_A - 10 && m < HALLE_B + 6) continue;
      const i = S(m);
      side = -side;
      const lat = side * (t.wh[i] + 5.9);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!darf(x, z, 0.4, 9)) continue;
      merke(x, z, 0.6);
      laterne(x, z, -side * rightX(t, i), -side * rightZ(t, i));
    }
  }

  // ==================================================================================
  // 9. Ferne: Stadt, Schornsteine und eine Hochspannungsleitung über den Hügeln
  // ==================================================================================
  {
    const cx = world.center.x;
    const cz = world.center.z;
    const R0 = world.radius + 560;
    const sil = rgb(0x3e3e60);
    const silD = rgb(0x323252);
    const win = rgb(0xffc070);
    const nB = lo ? 36 : 64;
    for (let k = 0; k < nB; k++) {
      const a = (k / nB) * Math.PI * 2 + rnd() * 0.04;
      // Stadt vor allem im Norden und Osten, sonst lichter
      const dense = Math.max(0, Math.cos(a + 1.9));
      if (rnd() > 0.35 + dense * 0.65) continue;
      const r = R0 + rnd() * 260;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const w = 30 + rnd() * 50;
      const h = 20 + rnd() * (40 + dense * 90);
      const rot = Math.atan2(cx - x, cz - z); // lokal +z zur Mitte
      fern.lage(x, -30, z, rot);
      fern.quad([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h + 30, 0], [-w / 2, h + 30, 0], k % 2 ? sil : silD);
      if (!lo) {
        const cols = Math.max(2, Math.floor(w / 9));
        const rows = Math.max(2, Math.floor(h / 10));
        for (let q = 0; q < rows; q++) {
          for (let c = 0; c < cols; c++) {
            if (rnd() > 0.32) continue;
            const wx = -w / 2 + ((c + 0.5) / cols) * w;
            const wy = 30 + ((q + 0.5) / rows) * h;
            fern.quad([wx - 1.6, wy - 1.4, 0.4], [wx + 1.6, wy - 1.4, 0.4], [wx + 1.6, wy + 1.4, 0.4], [wx - 1.6, wy + 1.4, 0.4], win);
          }
        }
      }
      // Schornstein dazu
      if (rnd() < 0.3) {
        const sx = (rnd() - 0.5) * w * 0.6;
        const sh = h + 40 + rnd() * 60;
        fern.quad([sx - 3, 0, -0.2], [sx + 3, 0, -0.2], [sx + 2, sh + 30, -0.2], [sx - 2, sh + 30, -0.2], silD);
      }
    }
    // Hügel mit Hochspannungsleitung (Westen/Süden)
    const RH = world.radius + 980;
    const nH = 28;
    const hill = rgb(0x2c2e4a);
    const hy = (a: number): number => 40 + 34 * Math.sin(a * 5.3 + 1.1) + 22 * Math.sin(a * 11.7);
    for (let k = 0; k < nH; k++) {
      const a0 = 1.2 + (k / nH) * 3.0;
      const a1 = 1.2 + ((k + 1) / nH) * 3.0;
      const P = (a: number, y: number): V3 => [cx + Math.cos(a) * RH, y, cz + Math.sin(a) * RH];
      fern.quad(P(a1, -40), P(a0, -40), P(a0, hy(a0)), P(a1, hy(a1)), hill);
      fern.quad(P(a0, -40), P(a1, -40), P(a1, hy(a1)), P(a0, hy(a0)), hill);
    }
    const masten: V3[] = [];
    for (let k = 0; k < 9; k++) {
      const a = 1.35 + k * 0.33;
      const bx = cx + Math.cos(a) * (RH - 30);
      const bz = cz + Math.sin(a) * (RH - 30);
      const y = hy(a) - 6;
      const rot = Math.atan2(cx - bx, cz - bz);
      fern.lage(bx, y, bz, rot);
      const H = 46;
      fern.quad([-7, 0, 0], [-5, 0, 0], [-0.6, H, 0], [-1.6, H, 0], silD);
      fern.quad([5, 0, 0], [7, 0, 0], [1.6, H, 0], [0.6, H, 0], silD);
      fern.quad([-9, H * 0.72, 0], [9, H * 0.72, 0], [9, H * 0.72 + 1.6, 0], [-9, H * 0.72 + 1.6, 0], silD);
      fern.tri([-1.8, H, 0], [1.8, H, 0], [0, H + 6, 0], silD);
      const p = welt(fern, 8.5, H * 0.72, 0);
      const q = welt(fern, -8.5, H * 0.72, 0);
      masten.push([p.x, p.y, p.z], [q.x, q.y, q.z]);
      fern.frei();
    }
    for (let k = 0; k + 2 < masten.length; k += 2) {
      for (let s = 0; s < 2; s++) {
        const a = masten[k + s];
        const b = masten[k + 2 + s];
        // dünnes Band, zur Mitte gewandt, mit Durchhang
        let prev = a;
        for (let q = 1; q <= 4; q++) {
          const f = q / 4;
          const p: V3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 12 * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f];
          fern.quad([prev[0], prev[1], prev[2]], [p[0], p[1], p[2]], [p[0], p[1] + 0.9, p[2]], [prev[0], prev[1] + 0.9, prev[2]], silD);
          fern.quad([p[0], p[1], p[2]], [prev[0], prev[1], prev[2]], [prev[0], prev[1] + 0.9, prev[2]], [p[0], p[1] + 0.9, p[2]], silD);
          prev = p;
        }
      }
    }
  }

  // ==================================================================================
  // Netze zusammenstellen
  // ==================================================================================
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const add = (b: Bau, outline: number): void => {
    if (b.verts === 0) return;
    const geo = b.build();
    const mesh = new THREE.Mesh(geo, toon);
    group.add(mesh);
    disposables.push(geo);
    if (outline > 0 && lines) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
    }
  };
  add(gross, 0.05);
  add(klein, 0);
  const glutMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(glutMat);
  if (glut.verts > 0) {
    const g = glut.build();
    group.add(new THREE.Mesh(g, glutMat));
    disposables.push(g);
  }
  if (schein.verts > 0) {
    const g = schein.build();
    const m = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      // Additiv und mit Dunst würde jeder ferne Kegel in Dunstfarbe aufleuchten.
      fog: false,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 4;
    group.add(mesh);
    disposables.push(g, m);
  }
  if (fern.verts > 0) {
    const g = fern.build();
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = -7;
    group.add(mesh);
    disposables.push(g, m);
  }

  // Bewegtes: ein Netz, Ecken je Bild aus der Grundform.
  const dynGeo = dyn.build();
  const dPos = dynGeo.getAttribute('position') as THREE.BufferAttribute;
  const dNor = dynGeo.getAttribute('normal') as THREE.BufferAttribute;
  dPos.setUsage(THREE.DynamicDrawUsage);
  dNor.setUsage(THREE.DynamicDrawUsage);
  const basePos = Float32Array.from(dPos.array as Float32Array);
  const baseNor = Float32Array.from(dNor.array as Float32Array);
  const teile = dyn.liste;
  let baseON: Float32Array | null = null;
  let dON: THREE.BufferAttribute | null = null;
  const dynMesh = new THREE.Mesh(dynGeo, toon);
  dynMesh.frustumCulled = false;
  group.add(dynMesh);
  disposables.push(dynGeo);
  if (lines && dPos.count > 0) {
    baseON = glatteNormalen(basePos, baseNor, teile);
    dON = new THREE.BufferAttribute(Float32Array.from(baseON), 3);
    dON.setUsage(THREE.DynamicDrawUsage);
    dynGeo.setAttribute('onormal', dON);
    const ol = new THREE.Mesh(dynGeo, outlineMaterial(0.045));
    ol.name = 'outline';
    ol.frustumCulled = false;
    ol.matrixAutoUpdate = false;
    dynMesh.add(ol);
  }

  // Lampen (Instanzen)
  const NL = lichter.length / 8;
  const glowGeo = new THREE.OctahedronGeometry(0.5, 0);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const glow = new THREE.InstancedMesh(glowGeo, glowMat, Math.max(1, NL));
  glow.count = NL;
  glow.frustumCulled = false;
  glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const col = new THREE.Color();
    for (let k = 0; k < NL; k++) glow.setColorAt(k, col.set(lichter[k * 8 + 7]));
  }
  group.add(glow);
  disposables.push(glowGeo, glowMat, glow);

  // --- Pro Bild ----------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const posA = dPos.array as Float32Array;
  const norA = dNor.array as Float32Array;
  let first = true;

  const setzeTeil = (p: Teil): void => {
    const el = p.m.elements;
    const full = p.art === 0 || first;
    const on = baseON;
    const onA = dON ? (dON.array as Float32Array) : null;
    for (let i = p.v0; i < p.v1; i++) {
      const o = i * 3;
      const x = basePos[o];
      const y = basePos[o + 1];
      const z = basePos[o + 2];
      posA[o] = el[0] * x + el[4] * y + el[8] * z + el[12];
      posA[o + 1] = el[1] * x + el[5] * y + el[9] * z + el[13];
      posA[o + 2] = el[2] * x + el[6] * y + el[10] * z + el[14];
      if (full) {
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
    }
  };
  const lage = (p: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, sx = 1, sy = 1, sz = 1): void => {
    e.set(pitch, yaw, roll, 'YXZ');
    q.setFromEuler(e);
    teile[p].m.compose(v.set(x, y, z), q, sv.set(sx, sy, sz));
  };
  /** Lage der Strecke bei Meter m (weich zwischen den Abschnitten): Mitte und Richtung. */
  const fr = { x: 0, y: 0, z: 0, tx: 0, tz: 1 };
  const amMeter = (m: number): void => {
    const f = m / t.step;
    const i0 = ((Math.floor(f) % N) + N) % N;
    const i1 = t.next[i0];
    const a = f - Math.floor(f);
    fr.x = t.px[i0] + (t.px[i1] - t.px[i0]) * a;
    fr.y = t.py[i0] + (t.py[i1] - t.py[i0]) * a;
    fr.z = t.pz[i0] + (t.pz[i1] - t.pz[i0]) * a;
    const tx = t.tx[i0] + (t.tx[i1] - t.tx[i0]) * a;
    const tz = t.tz[i0] + (t.tz[i1] - t.tz[i0]) * a;
    const l = Math.hypot(tx, tz) || 1;
    fr.tx = tx / l;
    fr.tz = tz / l;
  };
  /** Weicher Hin- und Herweg mit Pausen an den Enden: 0 → 1 → 0 über einen Takt. */
  const pendel = (u: number): number => {
    const w = u - Math.floor(u);
    if (w < 0.12) return 0;
    if (w < 0.5) return smooth((w - 0.12) / 0.38);
    if (w < 0.62) return 1;
    return 1 - smooth((w - 0.62) / 0.38);
  };
  let dampfT = 0;
  let rauchT = 0;
  let dampfK = 0;

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Arbeiter winken ---
      for (let k = 0; k < winker.length; k += 6) {
        const ph = winker[k + 5];
        const raise = smooth((Math.sin(time * 0.37 + ph) + 0.25) * 2.2);
        const wave = -0.35 + 0.42 * Math.sin(time * 5.2 + ph * 3);
        const down = -(Math.PI - 0.22);
        lage(winker[k], winker[k + 1], winker[k + 2], winker[k + 3], winker[k + 4], 0, down + (wave - down) * raise, 1, 1, 1);
      }
      // --- Gabelstapler ---
      for (let k = 0; k < runden.length; k += 8) {
        const u = runden[k + 6] + time * runden[k + 7];
        const a = runden[k + 3];
        const b = runden[k + 4];
        const rot = runden[k + 5];
        const lx = Math.cos(u) * a;
        const lz = Math.sin(u) * b;
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const x = runden[k + 1] + lx * c + lz * s;
        const z = runden[k + 2] - lx * s + lz * c;
        const sg = Math.sign(runden[k + 7]);
        const vx = -Math.sin(u) * a * sg;
        const vz = Math.cos(u) * b * sg;
        const wx = vx * c + vz * s;
        const wz = -vx * s + vz * c;
        lage(runden[k], x, ground(x, z), z, Math.atan2(wx, wz), 0, 0);
      }
      // --- Laufkran in der Montagehalle ---
      if (kranTeile.bruecke >= 0) {
        const mk = HALLE_A + 10 + (HALLE_B - HALLE_A - 20) * pendel(time / 52);
        amMeter(mk);
        const yaw = Math.atan2(fr.tx, fr.tz) - Math.PI / 2;
        const rx = -fr.tz;
        const rz = fr.tx;
        const yb = fr.y + KRAN_Y;
        lage(kranTeile.bruecke, fr.x, yb, fr.z, yaw, 0, 0);
        const lat = 15.5 * Math.sin(time * 0.33);
        const kx = fr.x + rx * lat;
        const kz = fr.z + rz * lat;
        lage(kranTeile.katze, kx, yb, kz, yaw, 0, 0);
        // Haken: über der Bahn nie unter 10,3 m (Unterkante des Hakens), an den Seiten tiefer
        const side = smooth((Math.abs(lat) - 12.8) / 2.4);
        const hy = fr.y + 10.9 - side * 5.3;
        const top = yb + 1.15;
        lage(kranTeile.seil, kx, top, kz, yaw, 0, 0, 1, Math.max(0.1, top - (hy + 0.8)), 1);
        lage(kranTeile.haken, kx, hy, kz, yaw, 0, 0);
      }
      // --- Portalkran am Containerlager ---
      if (portal.katze >= 0) {
        const u = pendel(time / 34);
        const lz = portal.a + (portal.b - portal.a) * u;
        const c = Math.cos(portal.rot);
        const s = Math.sin(portal.rot);
        const x = portal.x + lz * s;
        const z = portal.z + lz * c;
        const yk = portal.y + 18.3;
        lage(portal.katze, x, yk, z, portal.rot, 0, 0);
        // Spreader senkt sich an den Enden (Pause) und fährt unterwegs hoch
        const w = time / 34 - Math.floor(time / 34);
        const hub = w < 0.12 ? Math.sin((w / 0.12) * Math.PI) : w >= 0.5 && w < 0.62 ? Math.sin(((w - 0.5) / 0.12) * Math.PI) : 0;
        const ys = portal.y + 13.5 - hub * 3;
        lage(portal.seil, x, yk, z, portal.rot, 0, 0, 1, yk - ys - 0.5, 1);
        lage(portal.spreader, x, ys, z, portal.rot, 0, 0);
      }
      // --- Rangierzug ---
      if (zug.teile.length > 0) {
        const s0 = zug.s0 + (zug.s1 - zug.s0) * pendel(time / 70 + 0.3);
        let s = s0;
        for (let k = 0; k < zug.teile.length; k++) {
          const half = zug.laenge[k] / 2;
          s += half;
          lage(zug.teile[k], zug.ox + zug.dx * s, zug.oy, zug.oz + zug.dz * s, Math.atan2(zug.dx, zug.dz), 0, 0);
          s += half;
        }
      }
      for (let k = 0; k < teile.length; k++) setzeTeil(teile[k]);
      if (teile.length > 0) {
        dPos.needsUpdate = true;
        dNor.needsUpdate = true;
        if (dON) dON.needsUpdate = true;
        if (first) dynGeo.computeBoundingSphere();
      }

      // --- Lampen ---
      for (let k = 0; k < NL; k++) {
        const o = k * 8;
        const art = lichter[o + 4];
        const ph = lichter[o + 5];
        let size = lichter[o + 3];
        if (art === 1) size *= (time / 2.4 + ph) % 1 < 0.5 ? 1 : 0;
        else if (art === 2) size *= (time / 2.0 + ph) % 1 < 0.3 ? 1 : 0.15;
        else if (art === 3) size *= (time / 1.6 + ph) % 1 < 0.5 ? 1 : 0;
        else if (art === 4) size *= 0.85 + 0.15 * Math.sin(time * 1.4 + ph * 4);
        const pt = lichter[o + 6];
        if (pt >= 0) v.set(lichter[o], lichter[o + 1], lichter[o + 2]).applyMatrix4(teile[pt].m);
        else v.set(lichter[o], lichter[o + 1], lichter[o + 2]);
        if (size <= 0) {
          glow.setMatrixAt(k, zero);
          continue;
        }
        m4.makeScale(size, size, size);
        m4.setPosition(v);
        glow.setMatrixAt(k, m4);
      }
      if (NL > 0) glow.instanceMatrix.needsUpdate = true;

      // --- Dampf über den Kühltürmen, Rauch aus dem Schornstein ---
      if (detail > 0) {
        // (nach einem Zeitsprung nicht alles auf einmal nachholen)
        dampfT = Math.max(-0.5, dampfT - dt);
        while (dampfT <= 0 && kronen.length > 0) {
          dampfT += hi ? 0.22 : 0.4;
          dampfK = (dampfK + 1) % (kronen.length / 4);
          const o = dampfK * 4;
          const x = kronen[o];
          const z = kronen[o + 2];
          if (Math.abs(x - cam.x) + Math.abs(z - cam.z) > 900) continue;
          const r = kronen[o + 3] * 0.55;
          const a = (time * 2.3 + dampfK * 2.1) % (Math.PI * 2);
          const rr = r * Math.sqrt(((time * 0.71 + dampfK) % 1) + 0.05);
          fx.puff(x + Math.cos(a) * rr, kronen[o + 1] + 1, z + Math.sin(a) * rr, 0.8, 2.2, 0.4, 7, 7 + (dampfK % 2) * 2, (time * 3) % 1 < 0.5 ? 0xeef0f6 : 0xdfe2ec, 2.2, -0.35);
        }
        rauchT -= dt;
        if (rauchT <= 0 && schlot[1] > -1e8) {
          rauchT = 0.6;
          if (Math.abs(schlot[0] - cam.x) + Math.abs(schlot[2] - cam.z) < 800) fx.puff(schlot[0], schlot[1] + 1, schlot[2], 1.2, 2.6, 0.3, 6, 3.2, (time * 2) % 1 < 0.5 ? 0x6a6878 : 0x7c7a8a, 1.1, -0.3);
        }
      }
      first = false;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
