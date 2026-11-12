// Kulisse des Spiegelkabinetts: ein Glaspalast in einem Schlosspark an einem hellen Nachmittag.
//
// Über dem Zickzack steht eine Halle aus weißem Eisen und Glas mit drei gläsernen Tonnendächern –
// je eines über dem Spiegelsaal, der zweiten und der dritten Geraden. Schlanke Säulen tragen die
// Bogenrippen, im Dach sitzen einzelne helle Glasfelder. Zwischen den Geraden und an den Außenwänden
// stehen Reihen hoher Wandspiegel in Goldrahmen (helle, kühle Flächen, über die schräge Glanzstreifen
// wandern; dazwischen Zerrspiegel mit gewellter Fläche) – echte Spiegelungen gibt es nicht. Im Scheitel
// der ersten Kehre hängt ein riesiger Kristall-Kronleuchter, dessen Prismenkränze sich langsam drehen;
// seine Lichtflecken wandern über Boden und Wände neben der Bahn. In der zweiten Kehre steht ein
// kleines Spiegel-Labyrinth, Palmen in Kübeln, Statuen; Besucher stehen hinter Absperrkordeln und auf
// Balkonen und winken. Vorn das Prunkportal mit Freitreppen, an der Rampe eine Treppe mit Balustrade.
//
// Im Innenhof der Galerie steht eine gläserne Rotunde mit Springbrunnen, im Westen die Fassade mit dem
// Rosettenfenster (ein offener Ring um die Flugbahn des Sprungs). Ringsum ein französischer Garten:
// Hecken, Buchskugeln und -kegel, Blumenrabatten, Wasserbecken mit Fontänen, Laternen, Fahnen, Alleen,
// die Orangerie an der S-Kurve, am Start eine Tribüne und eine Kapelle im Pavillon; in der Ferne Wald.
// Tauben fliegen auf, über dem Park zieht ein Heißluftballon.
//
// Farben: Elfenbein, Gold, Silberblau, Violettblau, Grün. Türkis und Pink gehören auf dieser Strecke
// allein den Spiel-Spiegeln – die Kulisse benutzt sie nicht.
//
// Technik (harte Vorgabe, siehe toon.ts): nur Eckenfarben, Toon-Material mit Kontur, MeshBasicMaterial
// (auch durchscheinend und additiv), Instanzen und Netze mit je Bild neu gesetzten Ecken bzw. Farben –
// keine eigenen Shader, keine Texturen, kein Render-Target, kein Licht. Im Lauf wird nichts angelegt.

import * as THREE from 'three';
import { rightX, rightZ } from '../../game/track';
import { seeded, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

// --- Werkzeug: Flächen sammeln, mit Lage ------------------------------------------------------

const tv = new THREE.Vector3();
const tp = new THREE.Vector3();
const ts = new THREE.Vector3();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tm = new THREE.Matrix4();

/** Wie MeshBuilder, aber jede Fläche geht durch die aktuelle Lage (m). */
class Bau {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly m = new THREE.Matrix4();

  get verts(): number {
    return this.pos.length / 3;
  }

  lage(x: number, y: number, z: number, rotY = 0, s = 1): this {
    this.m.makeRotationY(rotY);
    if (s !== 1) this.m.scale(ts.set(s, s, s));
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

  /** Quader um (cx, cy, cz), um die Hochachse gedreht; ohne Boden, wenn boden = false. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB, boden = false): void {
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

  /** Quader von unten (y0) bis oben (y1). */
  klotz(cx: number, y0: number, cz: number, sx: number, y1: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
    if (y1 - y0 < 1e-3) return;
    this.box(cx, (y0 + y1) / 2, cz, sx, y1 - y0, sz, color, rotY, top);
  }

  /** n-eckiger Kegelstumpf (Radius r0 unten, r1 oben) ab y0, Höhe h; Deckel nur mit top. */
  prisma(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, n: number, color: RGB, top: RGB | null = null, rot = 0, boden = false): void {
    const pts0: V3[] = [];
    const pts1: V3[] = [];
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      pts0.push([cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0]);
      pts1.push([cx + Math.cos(a) * r1, y0 + h, cz + Math.sin(a) * r1]);
    }
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      if (r1 > 1e-4) this.quad(pts0[j], pts0[k], pts1[k], pts1[j], color);
      else this.tri(pts0[j], pts0[k], pts1[k], color);
    }
    if (top && r1 > 1e-4) for (let k = 1; k < n - 1; k++) this.tri(pts1[0], pts1[k + 1], pts1[k], top);
    if (boden) for (let k = 1; k < n - 1; k++) this.tri(pts0[0], pts0[k], pts0[k + 1], color);
  }

  /** Dünne Strebe von a nach c mit n Seiten (ohne Deckel). */
  strebe(a: V3, c: V3, d: number, color: RGB, n = 3): void {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    // Zwei Querrichtungen zur Achse
    tv.set(dx / len, dy / len, dz / len);
    const ax = tv.x;
    const ay = tv.y;
    const az = tv.z;
    let ux = 0;
    let uy = 0;
    let uz = 0;
    if (Math.abs(ay) < 0.9) {
      // u = axis × UP
      ux = -az;
      uz = ax;
    } else {
      // u = axis × X
      uy = az;
      uz = -ay;
    }
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const wx = ay * uz - az * uy;
    const wy = az * ux - ax * uz;
    const wz = ax * uy - ay * ux;
    const r = d / 2;
    const ring = (p: V3, k: number): V3 => {
      const an = (k / n) * Math.PI * 2;
      const cc = Math.cos(an) * r;
      const ss = Math.sin(an) * r;
      return [p[0] + ux * cc + wx * ss, p[1] + uy * cc + wy * ss, p[2] + uz * cc + wz * ss];
    };
    for (let k = 0; k < n; k++) this.quad(ring(a, k), ring(a, k + 1), ring(c, k + 1), ring(c, k), color);
  }

  /** Fertige Geometrie mit eigener Lage (Euler YXZ); je Dreieck eine Farbe aus farbe(i). */
  geo(g: THREE.BufferGeometry, color: RGB | ((i: number) => RGB), x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): void {
    te.set(rx, ry, rz, 'YXZ');
    tq.setFromEuler(te);
    tm.compose(tp.set(x, y, z), tq, ts.set(sx, sy, sz));
    tm.premultiply(this.m);
    const pa = g.getAttribute('position');
    const idx = g.index;
    const cnt = idx ? idx.count : pa.count;
    for (let i = 0; i < cnt; i++) {
      const vi = idx ? idx.getX(i) : i;
      tv.fromBufferAttribute(pa, vi).applyMatrix4(tm);
      this.pos.push(tv.x, tv.y, tv.z);
      const c = typeof color === 'function' ? color(Math.floor(i / 3)) : color;
      this.col.push(c[0], c[1], c[2]);
    }
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

/** Durchscheinende Flächen mit eigener Deckkraft je Fläche (RGBA-Eckenfarben). */
class Glas {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  tri(a: V3, b: V3, c: V3, color: RGB, alpha: number): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(color[0], color[1], color[2], alpha);
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: RGB, alpha: number): void {
    this.tri(a, b, c, color, alpha);
    this.tri(a, c, d, color, alpha);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 4));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Spiegelflächen: ein Gitter je Spiegel. Die Ecken bleiben, ihre Farben werden je Bild aus einem
 * Grundton und einem schrägen Glanzstreifen berechnet, der langsam über die Fläche wandert.
 */
class Spiegel {
  readonly pos: number[] = [];
  /** Grundfarbe je Ecke. */
  readonly base: number[] = [];
  /** Lage im Streifen (schräge Koordinate 0..1.3), Phase und Tempo des Spiegels je Ecke. */
  readonly s: number[] = [];
  readonly ph: number[] = [];
  readonly sp: number[] = [];
  private n = 0;

  get count(): number {
    return this.n;
  }

  /**
   * Spiegel mit Mitte unten (x, y0, z), Breite w, Höhe h, Blick in Richtung (nx, nz).
   * wellig: Zerrspiegel (gewellte Fläche).
   */
  flaeche(x: number, y0: number, z: number, nx: number, nz: number, w: number, h: number, wellig: boolean, top: RGB, bottom: RGB, phase: number, nu = 4, nv = 3): void {
    // Breitenrichtung (rechts, wenn man auf den Spiegel schaut)
    const ux = -nz;
    const uz = nx;
    const P: V3[] = [];
    const B: RGB[] = [];
    const S: number[] = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const v = j / nv;
        let off = 0;
        let shade = 1;
        if (wellig) {
          off = Math.sin(u * Math.PI * 3) * 0.32 * Math.sin(v * Math.PI) + Math.sin(v * Math.PI * 2 + u) * 0.12;
          shade = 0.86 + 0.14 * Math.cos(u * Math.PI * 3);
        }
        const k = v;
        const c: RGB = [(bottom[0] + (top[0] - bottom[0]) * k) * shade, (bottom[1] + (top[1] - bottom[1]) * k) * shade, (bottom[2] + (top[2] - bottom[2]) * k) * shade];
        P.push([x + ux * (u - 0.5) * w + nx * off, y0 + v * h, z + uz * (u - 0.5) * w + nz * off]);
        B.push(c);
        S.push(u * 0.75 + v * 0.55);
      }
    }
    const sp = 0.09 + ((phase * 7.31) % 1) * 0.05;
    const put = (k: number): void => {
      this.pos.push(P[k][0], P[k][1], P[k][2]);
      this.base.push(B[k][0], B[k][1], B[k][2]);
      this.s.push(S[k]);
      this.ph.push(phase);
      this.sp.push(sp);
      this.n++;
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        const b = a + 1;
        const c = a + nu + 2;
        const d = a + nu + 1;
        put(a);
        put(b);
        put(c);
        put(a);
        put(c);
        put(d);
      }
    }
  }
}

// --- Bewegte Teile ------------------------------------------------------------------------------

/** 0 = starr, 2 = Tuch (flattert), 3 = starr ohne Kontur (dünne Flügel). */
type Art = 0 | 2 | 3;

interface Teil {
  v0: number;
  v1: number;
  art: Art;
  m: THREE.Matrix4;
  len: number;
  amp: number;
  k: number;
  w: number;
  ph: number;
}

class Teile extends Bau {
  readonly liste: Teil[] = [];
  private start = 0;

  beginn(): void {
    this.frei();
    this.start = this.verts;
  }

  /** Starre Teile mit Kontur nach vorn, Tücher und Flügel ans Ende; liefert die Zahl der Ecken mit Kontur. */
  ordne(): number {
    const pos: number[] = [];
    const col: number[] = [];
    const order = [...this.liste.filter((p) => p.art === 0), ...this.liste.filter((p) => p.art !== 0)];
    let n0 = 0;
    for (const p of order) {
      const v0 = pos.length / 3;
      for (let i = p.v0 * 3; i < p.v1 * 3; i++) {
        pos.push(this.pos[i]);
        col.push(this.col[i]);
      }
      p.v0 = v0;
      p.v1 = pos.length / 3;
      if (p.art === 0) n0 = p.v1;
    }
    this.pos.length = 0;
    this.col.length = 0;
    for (let i = 0; i < pos.length; i++) {
      this.pos.push(pos[i]);
      this.col.push(col[i]);
    }
    return n0;
  }

  ende(art: Art, tuch?: { len: number; amp: number; k: number; w: number; ph: number }): number {
    this.liste.push({ v0: this.start, v1: this.verts, art, m: new THREE.Matrix4(), len: tuch?.len ?? 1, amp: tuch?.amp ?? 0, k: tuch?.k ?? 0, w: tuch?.w ?? 0, ph: tuch?.ph ?? 0 });
    return this.liste.length - 1;
  }
}

/** Geglättete Normalen je Teil (für die Kontur); Tuch und Flügel bekommen keine. */
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

// --- Farben -------------------------------------------------------------------------------------

const C = {
  weiss: rgb(0xf7f4ec),
  weissD: rgb(0xdedbd2),
  elf: rgb(0xf1e6cc),
  elfD: rgb(0xd6c6a2),
  gold: rgb(0xe2b23e),
  goldH: rgb(0xf6d77a),
  goldD: rgb(0xa8781f),
  parkA: rgb(0xbf8a54),
  parkB: rgb(0xa06d3f),
  parkR: rgb(0x6e4a2c),
  marmor: rgb(0xd8d3e8),
  marmorD: rgb(0xaaa4c4),
  silberO: rgb(0xaebde0),
  silberU: rgb(0xe6ecf6),
  silberVO: rgb(0xb4ade6),
  violett: rgb(0x5f58c0),
  violettD: rgb(0x3f3a8a),
  hecke: rgb(0x2e7a3e),
  heckeH: rgb(0x46994e),
  buchs: rgb(0x2f8040),
  kies: rgb(0xece0c2),
  kiesD: rgb(0xd7c7a0),
  wasser: rgb(0x8ec6e6),
  stein: rgb(0xe9e3d6),
  steinD: rgb(0xc9c0ae),
  stamm: rgb(0x7a5636),
  laterne: rgb(0x2f4a3a),
  licht: rgb(0xfff0b8),
  kordel: rgb(0x9a2230),
  orange: rgb(0xf08a2a),
  rot: rgb(0xd0473a),
  gelb: rgb(0xf4c534),
  blau: rgb(0x4f6fd0),
  blumeW: rgb(0xfdfbf2),
  lila: rgb(0x8a6ad0),
  dach: rgb(0x55508f),
  schwarz: rgb(0x2a2733),
  erde: rgb(0x5a4632),
};
const HAUT = [rgb(0xf2c9a0), rgb(0xe0b088), rgb(0xb07a50), rgb(0x8a5a3a)];
const KLEID = [0xe2b23e, 0xf1e6cc, 0x5f58c0, 0x8fb48a, 0x7fa8e0, 0xf2d27a, 0xc8463a, 0xb3a6e6, 0xf6f3ea, 0x2f3a6a, 0x8a6a48, 0x3f7a4f].map(rgb);
const GLAS_FARBEN = [rgb(0xf2c24a), rgb(0x7a5ad8), rgb(0x3f6fd8), rgb(0x4fae5a)];

/** Rahmen der Spiel-Spiegel (Streckenmeter): dort bleibt der Raum über und neben der Bahn frei. */
const RAHMEN_M = [437, 504, 539, 584, 651, 911, 957];

export function buildSpiegelLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const lo = detail === 0;
  const lines = detail > 0;
  const rnd = seeded(15100 + t.index * 37);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const ground = (x: number, z: number): number => world.heightAt(x, z);
  const S = (m: number): number => ((Math.round(m / t.step) % t.n) + t.n) % t.n;

  // --- Schneller Abstand zur Bande (Fächer über die Abschnitte) ---------------------------------
  const BIN = 12;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < t.total; i++) {
    minX = Math.min(minX, t.px[i]);
    maxX = Math.max(maxX, t.px[i]);
    minZ = Math.min(minZ, t.pz[i]);
    maxZ = Math.max(maxZ, t.pz[i]);
  }
  const bx0 = minX - 60;
  const bz0 = minZ - 60;
  const NBX = Math.ceil((maxX - minX + 120) / BIN);
  const NBZ = Math.ceil((maxZ - minZ + 120) / BIN);
  const bins: number[][] = [];
  for (let k = 0; k < NBX * NBZ; k++) bins.push([]);
  for (let i = 0; i < t.total; i++) bins[Math.floor((t.pz[i] - bz0) / BIN) * NBX + Math.floor((t.px[i] - bx0) / BIN)].push(i);
  /** Abstand zur Bande in Metern (gekappt bei etwa 36 m). */
  const frei = (x: number, z: number): number => {
    const ix = Math.floor((x - bx0) / BIN);
    const iz = Math.floor((z - bz0) / BIN);
    let best = 40;
    for (let dz = -3; dz <= 3; dz++) {
      const jz = iz + dz;
      if (jz < 0 || jz >= NBZ) continue;
      for (let dx = -3; dx <= 3; dx++) {
        const jx = ix + dx;
        if (jx < 0 || jx >= NBX) continue;
        for (const i of bins[jz * NBX + jx]) {
          const d = Math.hypot(x - t.px[i], z - t.pz[i]) - t.wh[i];
          if (d < best) best = d;
        }
      }
    }
    return best;
  };
  const rahmen = RAHMEN_M.map((m) => [t.px[S(m)], t.pz[S(m)]]);
  /** Abstand zum nächsten Rahmen der Spiel-Spiegel. */
  const nahRahmen = (x: number, z: number): number => {
    let best = Infinity;
    for (const r of rahmen) best = Math.min(best, Math.hypot(x - r[0], z - r[1]));
    return best;
  };
  /** Liegt (x, z) innerhalb der Rundstrecke (Park)? */
  const innen = (x: number, z: number): boolean => {
    let inside = false;
    for (let i = 0, j = t.n - 4; i < t.n; j = i, i += 4) {
      const xi = t.px[i];
      const zi = t.pz[i];
      const xj = t.px[j];
      const zj = t.pz[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  // Belegte Plätze (x, z, r), damit sich nichts überlagert.
  const belegt: number[] = [];
  const platz = (x: number, z: number, r: number, rand = 3): boolean => {
    if (frei(x, z) < rand + r) return false;
    for (let k = 0; k < belegt.length; k += 3) if (Math.hypot(x - belegt[k], z - belegt[k + 1]) < r + belegt[k + 2]) return false;
    return true;
  };
  const merke = (x: number, z: number, r: number): void => {
    belegt.push(x, z, r);
  };

  // --- Sammler -------------------------------------------------------------------------------------
  const gross = new Bau(); // Körper mit Kontur
  const klein = new Bau(); // Flächen und Kleinkram, beidseitig, ohne Kontur
  const glas = new Glas();
  const spiegel = new Spiegel();
  const dyn = new Teile();

  // Geteilte Grundformen
  const ICO = new THREE.IcosahedronGeometry(1, 0);
  const OKTA = new THREE.OctahedronGeometry(1, 0);
  disposables.push(ICO, OKTA);
  /** Runde Scheibe (Medaillon), Blick nach Norden bzw. Süden (in der x-y-Ebene). */
  const scheibe = (b: Bau, r: number, d: number, n: number, color: RGB, x: number, y: number, z: number): void => {
    const g = new THREE.CylinderGeometry(r, r, d, n);
    b.geo(g, color, x, y, z, Math.PI / 2, 0, 0);
    g.dispose();
  };

  // ==================================================================================================
  // Bausteine
  // ==================================================================================================

  // --- Menschen ---------------------------------------------------------------------------------------
  interface Arm {
    teil: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    side: number;
    ph: number;
    mode: number;
  }
  const arme: Arm[] = [];
  const armTeil = (color: RGB, s: number): number => {
    dyn.beginn();
    dyn.strebe([0, 0, 0], [0, -0.68 * s, 0], 0.16 * s, color, 3);
    return dyn.ende(0);
  };
  /**
   * Figur, Blick nach +z (gedreht um yaw). arme: 0 hängen, 1 staunen (Hände an den Wangen),
   * 2 winkt (ein Arm bewegt sich), 3 Instrument (beide Arme vor), 4 winkt mit beiden.
   * hut: 0 keiner, 1 Zylinder, 2 Dreispitz (Livree), 3 Haube, 4 Perücke.
   */
  const person = (b: Bau, x: number, y: number, z: number, yaw: number, o: { rock?: boolean; unten?: RGB; oben?: RGB; hut?: number; arme?: number; s?: number; haut?: RGB; einfach?: boolean }): void => {
    const s = o.s ?? 1.15;
    const unten = o.unten ?? pick(KLEID);
    const oben = o.oben ?? unten;
    const haut = o.haut ?? pick(HAUT);
    const hut = o.hut ?? 0;
    b.lage(x, y, z, yaw, s);
    if (o.einfach) {
      // Sitzende Zuschauer: nur Rumpf und Kopf
      b.prisma(0, 0, 0, 0.26, 0.24, 0.75, 4, oben, oben, Math.PI / 4);
      b.geo(OKTA, haut, 0, 0.95, 0, 0, 0, 0, 0.17, 0.2, 0.17);
    } else {
      if (o.rock) b.prisma(0, 0, 0, 0.44, 0.22, 0.95, 4, unten, null, Math.PI / 4);
      else b.prisma(0, 0, 0, 0.2, 0.23, 0.9, 4, unten, null, Math.PI / 4);
      b.prisma(0, 0.9, 0, 0.23, 0.27, 0.58, 4, oben, oben, Math.PI / 4);
      b.geo(OKTA, haut, 0, 1.68, 0, 0, 0, 0, 0.16, 0.2, 0.16);
    }
    const hy = o.einfach ? 0.95 : 1.68;
    if (hut === 1) {
      b.prisma(0, hy + 0.12, 0, 0.26, 0.26, 0.04, 5, C.schwarz);
      b.prisma(0, hy + 0.15, 0, 0.14, 0.15, 0.3, 5, C.schwarz, C.schwarz);
    } else if (hut === 2) {
      b.prisma(0, hy + 0.1, 0, 0.3, 0.12, 0.16, 3, C.schwarz, C.goldD, Math.PI / 2);
    } else if (hut === 3) {
      b.geo(OKTA, pick([C.elf, C.goldH, C.blumeW, C.lila]), 0, hy + 0.12, -0.02, 0, 0, 0, 0.24, 0.12, 0.24);
    } else if (hut === 4) {
      b.geo(OKTA, C.weiss, 0, hy + 0.08, -0.06, 0, 0, 0, 0.2, 0.16, 0.2);
    }
    const arm = o.arme ?? 0;
    const sy = o.einfach ? 0.68 : 1.42;
    const ax = 0.3;
    if (o.einfach) {
      // Der Arm sitzt an der Schulter (Lage in Weltkoordinaten)
      if (arm === 2) {
        const side = rnd() < 0.5 ? 1 : -1;
        arme.push({ teil: armTeil(oben, s), x: x + Math.cos(yaw) * 0.26 * s * side, y: y + sy * s, z: z - Math.sin(yaw) * 0.26 * s * side, yaw, side, ph: rnd() * 20, mode: 0 });
      }
      b.frei();
      return;
    }
    const hang = (side: number): void => b.strebe([side * ax, sy, 0], [side * 0.34, sy - 0.62, 0.04], 0.14, oben, 2);
    if (arm === 0) {
      hang(1);
      hang(-1);
    } else if (arm === 1) {
      b.strebe([ax, sy, 0], [0.16, 1.62, 0.16], 0.13, oben, 2);
      b.strebe([-ax, sy, 0], [-0.16, 1.62, 0.16], 0.13, oben, 2);
    } else if (arm === 3) {
      b.strebe([ax, sy, 0], [0.12, 1.25, 0.42], 0.13, oben, 2);
      b.strebe([-ax, sy, 0], [-0.12, 1.25, 0.42], 0.13, oben, 2);
    }
    const dynArm = (side: number, mode: number): void => {
      const id = armTeil(oben, s);
      arme.push({ teil: id, x: x + Math.cos(yaw) * ax * s * side, y: y + sy * s, z: z - Math.sin(yaw) * ax * s * side, yaw, side, ph: rnd() * 20, mode });
    };
    if (arm === 2) {
      const side = rnd() < 0.5 ? 1 : -1;
      hang(-side);
      dynArm(side, 0);
    } else if (arm === 4) {
      dynArm(1, 0);
      dynArm(-1, 0);
    } else if (arm === 5) {
      // Dirigent
      hang(-1);
      dynArm(1, 1);
    }
    b.frei();
  };
  const besucher = (b: Bau, x: number, z: number, yaw: number, wink = 0.35, y?: number): void => {
    const fem = rnd() < 0.5;
    const r = rnd();
    person(b, x, y ?? ground(x, z) + 0.12, z, yaw, {
      rock: fem,
      unten: fem ? pick(KLEID) : pick([rgb(0x2f3a6a), rgb(0x3a3440), rgb(0x8a6a48), rgb(0xd6c6a2)]),
      oben: fem ? undefined : pick(KLEID),
      hut: fem ? (r < 0.5 ? 3 : 0) : r < 0.4 ? 1 : 0,
      arme: rnd() < wink ? 2 : rnd() < 0.3 ? 1 : 0,
    });
  };
  const livree = (b: Bau, x: number, z: number, yaw: number, y?: number): void => {
    person(b, x, y ?? ground(x, z) + 0.12, z, yaw, { unten: rgb(0xf3eee0), oben: C.violettD, hut: 4, arme: 0 });
    // Goldene Knopfleiste
    b.lage(x, y ?? ground(x, z) + 0.12, z, yaw, 1.15);
    b.box(0, 1.2, 0.26, 0.08, 0.5, 0.04, C.gold);
    b.frei();
  };

  // --- Pflanzen und Gartenstücke -------------------------------------------------------------------------
  /** Kugel aus dem Ikosaeder; einzelne Flächen in punkt gefärbt (Orangen, Blüten). */
  const kugel = (b: Bau, x: number, y: number, z: number, rx: number, ry: number, rz: number, color: RGB, punkt?: RGB, anteil = 0, rot = 0): void => {
    const seed = Math.floor(rnd() * 1000);
    b.geo(ICO, (i) => (punkt && Math.abs(Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1 < anteil ? punkt : color), x, y, z, 0, rot, 0, rx, ry, rz);
  };
  const buchsKugel = (x: number, z: number, r: number, b = gross): void => {
    const g = ground(x, z);
    kugel(b, x, g + r * 0.9, z, r, r * 0.92, r, C.buchs, C.heckeH, 0.3, rnd() * 3);
  };
  const buchsKegel = (x: number, z: number, h: number, b = gross): void => {
    const g = ground(x, z);
    b.prisma(x, g - 0.1, z, h * 0.32, 0, h, 6, C.buchs, null, rnd());
  };
  const hecke = (x0: number, z0: number, x1: number, z1: number, h: number, w: number, b = gross): void => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const g = Math.min(ground(x0, z0), ground(x1, z1), ground(cx, cz));
    b.klotz(cx, g - 0.2, cz, w, g + h, len, C.hecke, Math.atan2(x1 - x0, z1 - z0), C.heckeH);
  };
  const kuebel = (b: Bau, x: number, g: number, z: number, w: number, h: number): void => {
    b.klotz(x, g, z, w, g + h, w, C.weiss, 0, C.erde);
    b.klotz(x, g + h - 0.18, z, w + 0.1, g + h, w + 0.1, C.gold, 0, C.erde);
  };
  const orangenbaum = (x: number, z: number, s = 1): void => {
    const g = ground(x, z);
    kuebel(klein, x, g, z, 1.0 * s, 0.9 * s);
    klein.strebe([x, g + 0.9 * s, z], [x, g + 2.0 * s, z], 0.14 * s, C.stamm, 3);
    kugel(gross, x, g + 2.5 * s, z, 0.95 * s, 0.85 * s, 0.95 * s, rgb(0x3f8f3f), C.orange, 0.3, rnd() * 3);
  };
  const palme = (x: number, z: number, s = 1): void => {
    const g = ground(x, z);
    kuebel(gross, x, g, z, 1.4 * s, 1.1 * s);
    const H = (4.2 + rnd() * 1.4) * s;
    const lean = (rnd() - 0.5) * 0.5;
    const top: V3 = [x + lean, g + 1.1 * s + H, z + lean * 0.5];
    klein.strebe([x, g + 1.0 * s, z], [x + lean * 0.5, g + 1.1 * s + H * 0.5, z + lean * 0.25], 0.32 * s, rgb(0x8a6a48), 5);
    klein.strebe([x + lean * 0.5, g + 1.1 * s + H * 0.5, z + lean * 0.25], top, 0.26 * s, rgb(0x9a7a52), 5);
    const nL = 7;
    const a0 = rnd() * 6;
    for (let k = 0; k < nL; k++) {
      const a = a0 + (k / nL) * Math.PI * 2;
      const L = (2.4 + rnd() * 0.6) * s;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const mid: V3 = [top[0] + ca * L * 0.5, top[1] + 0.45 * s, top[2] + sa * L * 0.5];
      const tip: V3 = [top[0] + ca * L, top[1] - 0.9 * s, top[2] + sa * L];
      const wx = -sa * 0.45 * s;
      const wz = ca * 0.45 * s;
      const green = k % 2 === 0 ? rgb(0x3f9a45) : rgb(0x2f8040);
      klein.tri(top, [mid[0] + wx, mid[1], mid[2] + wz], mid, green);
      klein.tri(top, mid, [mid[0] - wx, mid[1] - 0.1, mid[2] - wz], green);
      klein.tri([mid[0] + wx, mid[1], mid[2] + wz], tip, mid, green);
      klein.tri(mid, tip, [mid[0] - wx, mid[1] - 0.1, mid[2] - wz], green);
    }
  };
  const baum = (x: number, z: number, h: number, b = gross, form = 0): void => {
    const g = ground(x, z);
    klein.strebe([x, g - 0.2, z], [x, g + h * 0.55, z], 0.35, C.stamm, 3);
    const green = pick([rgb(0x3f8f45), rgb(0x4a9a48), rgb(0x357f3f), rgb(0x5aa64e)]);
    if (form === 0) kugel(b, x, g + h * 0.68, z, h * 0.3, h * 0.3, h * 0.3, green, rgb(0x2f7a3a), 0.35, rnd() * 3);
    else b.prisma(x, g + h * 0.25, z, h * 0.26, 0, h * 0.8, 6, green, null, rnd());
  };
  const statue = (x: number, z: number, yaw: number, gold = false): void => {
    const g = ground(x, z);
    const st = gold ? C.gold : C.stein;
    gross.klotz(x, g - 0.1, z, 1.4, g + 1.8, 1.4, C.steinD, yaw, C.stein);
    gross.lage(x, g + 1.8, z, yaw, 1.3);
    const pose = Math.floor(rnd() * 3);
    gross.prisma(0, 0, 0, 0.42, 0.24, 1.0, 4, st, null, Math.PI / 4);
    gross.prisma(0, 1.0, 0, 0.24, 0.3, 0.55, 4, st, st, Math.PI / 4);
    gross.geo(OKTA, st, 0, 1.75, 0, 0, 0, 0, 0.17, 0.21, 0.17);
    if (pose === 0) {
      gross.strebe([0.3, 1.45, 0], [0.55, 2.2, 0.2], 0.15, st, 3);
      gross.strebe([-0.3, 1.45, 0], [-0.35, 0.95, 0.1], 0.15, st, 3);
    } else if (pose === 1) {
      gross.strebe([0.3, 1.45, 0], [0.2, 1.1, 0.45], 0.15, st, 3);
      gross.strebe([-0.3, 1.45, 0], [-0.2, 1.1, 0.45], 0.15, st, 3);
      gross.geo(OKTA, st, 0, 1.15, 0.6, 0, 0, 0, 0.25, 0.25, 0.25);
    } else {
      gross.strebe([0.3, 1.45, 0], [0.9, 1.85, 0], 0.15, st, 3);
      gross.strebe([-0.3, 1.45, 0], [-0.9, 1.85, 0], 0.15, st, 3);
    }
    gross.frei();
  };
  const laterne = (x: number, z: number, h = 3.6): void => {
    const g = ground(x, z);
    klein.prisma(x, g - 0.1, z, 0.28, 0.24, 0.5, 4, C.laterne, C.laterne, Math.PI / 4);
    klein.strebe([x, g + 0.3, z], [x, g + h, z], 0.13, C.laterne, 4);
    klein.prisma(x, g + h, z, 0.18, 0.3, 0.65, 4, C.licht, null, Math.PI / 4);
    klein.prisma(x, g + h + 0.65, z, 0.36, 0, 0.42, 4, C.gold, null, Math.PI / 4);
  };

  // --- Fahnen (Tuch flattert) ------------------------------------------------------------------------------
  /** Wind aus Osten: die Tücher wehen nach Westen (lokal +x zeigt mit dem Wind). */
  const WIND = Math.PI;
  const fahnen: number[] = [];
  const fahne = (x: number, z: number, H: number, farben: RGB[], gy?: number): void => {
    const g = gy ?? ground(x, z);
    gross.prisma(x, g - 0.1, z, 0.13, 0.1, H + 0.1, 5, C.weiss);
    gross.geo(OKTA, C.gold, x, g + H + 0.2, z, 0, 0, 0, 0.22, 0.22, 0.22);
    dyn.beginn();
    const L = 3.0;
    const FH = 1.8;
    const NU = 5;
    for (let r = 0; r < farben.length; r++) {
      const y0 = -(r / farben.length) * FH;
      const y1 = -((r + 1) / farben.length) * FH;
      for (let i = 0; i < NU; i++) {
        const xa = (i / NU) * L;
        const xb = ((i + 1) / NU) * L;
        dyn.quad([xa, y1, 0], [xb, y1, 0], [xb, y0, 0], [xa, y0, 0], farben[r]);
      }
    }
    const id = dyn.ende(2, { len: L, amp: 0.45, k: 1.7, w: 4.2 + rnd(), ph: rnd() * 6 });
    te.set(0, WIND - Math.PI / 2 + (rnd() - 0.5) * 0.3, 0, 'YXZ');
    tq.setFromEuler(te);
    dyn.liste[id].m.compose(tp.set(x, g + H, z), tq, ts.set(1, 1, 1));
    fahnen.push(id);
  };
  const FAHNE_A = [C.violett, C.gold, C.elf];
  const FAHNE_B = [C.gold, C.weiss, C.gold];
  const FAHNE_C = [C.elf, C.violett, C.elf];

  // --- Becken mit Fontänen ---------------------------------------------------------------------------------
  interface Strahl {
    saeule: number;
    krone: number;
    x: number;
    y: number;
    z: number;
    h: number;
    tilt: number;
    yaw: number;
    ph: number;
    gross: boolean;
  }
  const strahlen: Strahl[] = [];
  const strahl = (x: number, y: number, z: number, h: number, tilt = 0, yaw = 0, grossStrahl = true): void => {
    dyn.beginn();
    dyn.prisma(0, 0, 0, 0.3, 0.07, 1, 6, rgb(0xdcefff), null);
    const saeule = dyn.ende(0);
    dyn.beginn();
    kugel(dyn, 0, 0, 0, 0.55, 0.32, 0.55, rgb(0xf2f9ff), rgb(0xcfe6f8), 0.4);
    const krone = dyn.ende(0);
    strahlen.push({ saeule, krone, x, y, z, h, tilt, yaw, ph: rnd() * 6, gross: grossStrahl });
  };
  const becken = (x: number, z: number, R: number, art: number): void => {
    const g = ground(x, z);
    const n = R > 8 ? 20 : 14;
    gross.prisma(x, g - 0.2, z, R + 0.3, R, 0.95, n, C.steinD, C.stein);
    klein.prisma(x, g + 0.76, z, R - 0.55, R - 0.55, 0.01, n, C.wasser, C.wasser);
    const y = g + 0.76;
    if (art === 0) strahl(x, y, z, Math.min(9, R * 0.75));
    if (art === 1) {
      strahl(x, y, z, 10);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        strahl(x + Math.cos(a) * R * 0.62, y, z + Math.sin(a) * R * 0.62, 3.6, 0.42, Math.atan2(-Math.cos(a), -Math.sin(a)), false);
      }
    }
    if (art === 2) {
      // Schale in der Mitte
      gross.prisma(x, y - 0.1, z, 0.5, 0.4, 1.4, 6, C.stein);
      gross.prisma(x, y + 1.3, z, 0.6, 2.0, 0.5, 10, C.stein, C.wasser);
      strahl(x, y + 1.8, z, 4.5);
    }
  };

  // ==================================================================================================
  // Der Glaspalast
  // ==================================================================================================
  const PXL = [54, 93, 129, 166];
  const PZ0 = -124;
  const PZ1 = 52;
  const BAY = 8;
  const NBAY = Math.round((PZ1 - PZ0) / BAY);
  /** Traufhöhe und Stich der Tonnen. */
  const YE = 18.5;
  const RISE = 9;
  const NSEG = lo ? 6 : 8;
  /** Punkt auf der Tonne über Schiff n: Winkel th von π (Westen) bis 0 (Osten). */
  const tonne = (n: number, th: number, r = 0): [number, number] => {
    const x0 = PXL[n];
    const x1 = PXL[n + 1];
    const xc = (x0 + x1) / 2;
    const hw = (x1 - x0) / 2;
    return [xc + (hw - r) * Math.cos(th), YE + (RISE - r) * Math.sin(th)];
  };
  // Öffnungen in den Giebeln: Portal (Ostschiff, Norden) und Tor der Rampe (Westschiff, Süden)
  const PORTAL = { n: 2, z: PZ0, x0: 133, x1: 160 };
  const RAMPENTOR = { n: 0, z: PZ1, x0: 58, x1: 89 };
  const offen = (n: number, z: number, x: number): boolean =>
    (n === PORTAL.n && z === PORTAL.z && x > PORTAL.x0 && x < PORTAL.x1) || (n === RAMPENTOR.n && z === RAMPENTOR.z && x > RAMPENTOR.x0 && x < RAMPENTOR.x1);

  // Mitte der ersten Kehre: dort hängt der Kronleuchter (der Platz darunter bleibt frei).
  let KX = 129.3;
  let KZ = 17;
  {
    let best = -1;
    for (let z = 5; z <= 28; z += 0.5) {
      for (let x = 126; x <= 132.5; x += 0.5) {
        const f = frei(x, z);
        if (f > best) {
          best = f;
          KX = x;
          KZ = z;
        }
      }
    }
  }
  const KR = frei(KX, KZ); // freier Halbmesser bis zur Bande
  merke(KX, KZ, KR + 1);

  // --- Boden: Parkett im Schachbrett, neben der Bahn ------------------------------------------------------
  {
    const cs = lo ? 5.6 : 4;
    const x0 = PXL[0] + 0.3;
    const z0 = PZ0 + 0.3;
    const nx = Math.ceil((PXL[3] - 0.3 - x0) / cs);
    const nz = Math.ceil((PZ1 - 0.3 - z0) / cs);
    const hgt = new Float32Array((nx + 1) * (nz + 1));
    const fr = new Float32Array((nx + 1) * (nz + 1));
    for (let iz = 0; iz <= nz; iz++) {
      for (let ix = 0; ix <= nx; ix++) {
        const x = Math.min(x0 + ix * cs, PXL[3] - 0.3);
        const z = Math.min(z0 + iz * cs, PZ1 - 0.3);
        fr[iz * (nx + 1) + ix] = frei(x, z);
        hgt[iz * (nx + 1) + ix] = ground(x, z) + 0.14;
      }
    }
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const a = iz * (nx + 1) + ix;
        const b = a + 1;
        const c = a + nx + 2;
        const d = a + nx + 1;
        // Auch Zellen, die ein Stück unter die Fahrbahn reichen (der Boden liegt tiefer): so bleibt kein Rasen an der Bande.
        if (Math.max(fr[a], fr[b], fr[c], fr[d]) < 0.2 || Math.min(fr[a], fr[b], fr[c], fr[d]) < -2.5) continue;
        const xa = Math.min(x0 + ix * cs, PXL[3] - 0.3);
        const xb = Math.min(x0 + (ix + 1) * cs, PXL[3] - 0.3);
        const za = Math.min(z0 + iz * cs, PZ1 - 0.3);
        const zb = Math.min(z0 + (iz + 1) * cs, PZ1 - 0.3);
        const rand = ix === 0 || iz === 0 || ix === nx - 1 || iz === nz - 1;
        const col = rand ? C.parkR : (ix + iz) % 2 === 0 ? C.parkA : C.parkB;
        klein.quad([xa, hgt[a], za], [xa, hgt[d], zb], [xb, hgt[c], zb], [xb, hgt[b], za], col);
      }
    }
  }

  // --- Säulen, Träger, Rippen, Glas -----------------------------------------------------------------------
  for (let l = 0; l < 4; l++) {
    const x = PXL[l];
    const wand = l === 0 || l === 3;
    const b = wand ? klein : gross;
    for (let k = 0; k <= NBAY; k++) {
      const z = PZ0 + k * BAY;
      if (frei(x, z) < 3.8 || Math.hypot(x - KX, z - KZ) < KR + 3) continue;
      const g = ground(x, z);
      if (!wand && !lo) b.klotz(x, g - 0.2, z, 1.3, g + 0.8, 1.3, C.elfD, 0, C.elf);
      b.prisma(x, g + 0.3, z, 0.38, 0.3, YE - 1.0 - g, wand || lo ? 4 : 6, C.weiss, null, Math.PI / 4);
      b.klotz(x, YE - 1.1, z, 1.2, YE - 0.3, 1.2, C.gold, 0, C.goldH);
      merke(x, z, 1);
    }
    // Längsträger in Traufhöhe (über den Kehren frei gespannt, gut 14 m über der Bahn)
    gross.klotz(x, YE - 0.3, (PZ0 + PZ1) / 2, 0.8, YE + 0.7, PZ1 - PZ0, C.weiss, 0, C.weissD);
    gross.klotz(x, YE - 0.55, (PZ0 + PZ1) / 2, 0.95, YE - 0.3, PZ1 - PZ0 + 0.2, C.gold);
  }
  for (let n = 0; n < 3; n++) {
    const xc = (PXL[n] + PXL[n + 1]) / 2;
    // Querrippen: Bögen als senkrechte Stege (von der Fahrbahn aus sieht man sie von vorn)
    for (let k = 0; k <= NBAY; k++) {
      const z = PZ0 + k * BAY;
      // Über den Spiel-Spiegeln keine Bögen (je 8 m vor und hinter dem Rahmen frei)
      let nah = false;
      for (const r of rahmen) if (r[0] > PXL[n] && r[0] < PXL[n + 1] && Math.abs(r[1] - z) < 10) nah = true;
      if (nah && k > 0 && k < NBAY) continue;
      if (lo && k % 2 === 1) continue;
      for (let i = 0; i < NSEG; i++) {
        const a0 = Math.PI - (i / NSEG) * Math.PI;
        const a1 = Math.PI - ((i + 1) / NSEG) * Math.PI;
        const [xa, ya] = tonne(n, a0);
        const [xb, yb] = tonne(n, a1);
        const [xc0, yc0] = tonne(n, a0, 0.75);
        const [xd, yd] = tonne(n, a1, 0.75);
        klein.quad([xa, ya, z], [xb, yb, z], [xd, yd, z], [xc0, yc0, z], k === 0 || k === NBAY ? C.weissD : C.weiss);
      }
    }
    // Längspfetten und Glasfelder
    for (let i = 0; i <= NSEG; i++) {
      const a = Math.PI - (i / NSEG) * Math.PI;
      const [x, y] = tonne(n, a, 0.05);
      const nxv = Math.cos(a) * 0.3;
      const nyv = Math.sin(a) * 0.3;
      if (i > 0 && i < NSEG) klein.quad([x - nyv, y + nxv * 0.3 - 0.1, PZ0], [x + nyv, y - 0.1, PZ0], [x + nyv, y - 0.1, PZ1], [x - nyv, y + nxv * 0.3 - 0.1, PZ1], C.weiss);
    }
    // First mit goldenem Kamm
    gross.klotz(xc, YE + RISE - 0.1, (PZ0 + PZ1) / 2, 0.6, YE + RISE + 0.5, PZ1 - PZ0, C.gold, 0, C.goldH);
    for (let k = 0; k < NBAY; k++) {
      const z0 = PZ0 + k * BAY + 0.2;
      const z1 = PZ0 + (k + 1) * BAY - 0.2;
      for (let i = 0; i < NSEG; i++) {
        const h = (Math.sin(k * 12.9898 + i * 78.233 + n * 37.7) * 43758.5453) % 1;
        if (Math.abs(h) > (lo ? 0.5 : 0.68)) continue;
        const a0 = Math.PI - (i / NSEG) * Math.PI;
        const a1 = Math.PI - ((i + 1) / NSEG) * Math.PI;
        const [xa, ya] = tonne(n, a0, -0.05);
        const [xb, yb] = tonne(n, a1, -0.05);
        const warm = Math.abs(h) < 0.12;
        glas.quad([xa, ya, z0], [xb, yb, z0], [xb, yb, z1], [xa, ya, z1], warm ? rgb(0xfff1c8) : rgb(0xe8f4ff), warm ? 0.34 : 0.26);
      }
    }
    // Giebel: Fächer über der Traufe, darunter Glaswand mit Sprossen (oder Öffnung)
    for (const z of [PZ0, PZ1]) {
      const hub: V3 = [xc, YE, z];
      const NF = NSEG;
      for (let i = 0; i < NF; i++) {
        const a0 = Math.PI - (i / NF) * Math.PI;
        const a1 = Math.PI - ((i + 1) / NF) * Math.PI;
        const [xa, ya] = tonne(n, a0, 0.1);
        const [xb, yb] = tonne(n, a1, 0.1);
        glas.tri(hub, [xa, ya, z], [xb, yb, z], i % 2 === 0 ? rgb(0xe8f4ff) : rgb(0xfff4d8), 0.3);
        // Speiche
        const d = 0.22;
        klein.quad([xc - d, YE, z + 0.05], [xc + d, YE, z + 0.05], [xa + d, ya, z + 0.05], [xa - d, ya, z + 0.05], C.weiss);
      }
      // halbe Sonne in Gold an der Nabe
      if (!lo) klein.prisma(xc, YE - 0.02, z, 2.2, 2.2, 0.04, 10, C.gold, C.goldH);
      const op = (n === PORTAL.n && z === PORTAL.z) || (n === RAMPENTOR.n && z === RAMPENTOR.z);
      // Sturz über der Öffnung
      if (op) gross.klotz(xc, YE - 1.5, z, PXL[n + 1] - PXL[n], YE + 0.2, 1.2, C.elf, 0, C.gold);
      const x0 = PXL[n];
      const x1 = PXL[n + 1];
      const nm = Math.round((x1 - x0) / 4.5);
      for (let i = 0; i < nm; i++) {
        const xa = x0 + ((x1 - x0) * i) / nm;
        const xb = x0 + ((x1 - x0) * (i + 1)) / nm;
        const xm = (xa + xb) / 2;
        if (offen(n, z, xm)) continue;
        const g = ground(xm, z);
        klein.klotz(xm, g - 0.2, z, xb - xa, g + 1.2, 0.6, C.elf, 0, C.elfD);
        glas.quad([xa, g + 1.2, z], [xb, g + 1.2, z], [xb, YE - 0.3, z], [xa, YE - 0.3, z], rgb(0xeaf4ff), 0.2);
        if (i > 0 && !offen(n, z, xa - 0.5)) klein.quad([xa - 0.15, g + 1.2, z + 0.06], [xa + 0.15, g + 1.2, z + 0.06], [xa + 0.15, YE, z + 0.06], [xa - 0.15, YE, z + 0.06], C.weiss);
        klein.quad([xa, 11.3, z + 0.06], [xb, 11.3, z + 0.06], [xb, 11.6, z + 0.06], [xa, 11.6, z + 0.06], C.weiss);
      }
    }
  }
  // Seitenwände (Glas mit Sprossen, unten Sockel)
  for (const x of [PXL[0], PXL[3]]) {
    for (let k = 0; k < NBAY; k++) {
      const z0 = PZ0 + k * BAY;
      const z1 = z0 + BAY;
      const zm = (z0 + z1) / 2;
      const g = ground(x, zm);
      klein.klotz(x, g - 0.2, zm, 0.6, g + 1.2, BAY, C.elf, 0, C.elfD);
      glas.quad([x, g + 1.2, z0], [x, g + 1.2, z1], [x, YE - 0.3, z1], [x, YE - 0.3, z0], rgb(0xeaf4ff), 0.2);
      klein.quad([x + 0.06, g + 1.2, zm - 0.15], [x + 0.06, g + 1.2, zm + 0.15], [x + 0.06, YE, zm + 0.15], [x + 0.06, YE, zm - 0.15], C.weiss);
      klein.quad([x + 0.06, 11.3, z0], [x + 0.06, 11.3, z1], [x + 0.06, 11.6, z1], [x + 0.06, 11.6, z0], C.weiss);
    }
  }
  // Fahnen auf den Firsten
  for (let n = 0; n < 3; n++) {
    const xc = (PXL[n] + PXL[n + 1]) / 2;
    fahne(xc, PZ0 + 1, 4.5, n === 1 ? FAHNE_B : FAHNE_A, YE + RISE + 0.4);
    fahne(xc, PZ1 - 1, 4.5, n === 1 ? FAHNE_B : FAHNE_C, YE + RISE + 0.4);
  }

  // --- Prunkportal mit Freitreppen ---------------------------------------------------------------------
  {
    const z = PZ0;
    const g = ground(146, z - 6);
    for (const [cx, w] of [
      [130, 6],
      [163, 6],
    ] as [number, number][]) {
      gross.klotz(cx, g - 0.2, z - 0.5, w, 21, 7, C.elf, 0, C.gold);
      gross.klotz(cx, 21, z - 0.5, w + 0.6, 21.8, 7.6, C.gold);
      // Doppelsäulen vor dem Pfeiler
      for (const dx of [-1.7, 1.7]) {
        gross.prisma(cx + dx, g + 1, z - 4.4, 0.6, 0.5, 18.6 - g, 6, C.weiss);
        gross.klotz(cx + dx, g - 0.2, z - 4.4, 1.6, g + 1.1, 1.6, C.elfD);
        gross.klotz(cx + dx, 19.4, z - 4.4, 1.5, 20.2, 1.5, C.gold, 0, C.goldH);
      }
      // Nische mit Statue
      klein.quad([cx - 1.4, g + 3, z - 4.05], [cx + 1.4, g + 3, z - 4.05], [cx + 1.4, g + 9, z - 4.05], [cx - 1.4, g + 9, z - 4.05], C.elfD);
      fahne(cx, z - 0.5, 5, cx < 146 ? FAHNE_A : FAHNE_C, 21.8);
    }
    // Gebälk über der Durchfahrt (gut 16 m über der Bahn), Attika und Giebeldreieck
    gross.klotz(146.5, 20.2, z - 1.2, 39, 23.4, 6, C.elf, 0, C.elfD);
    gross.klotz(146.5, 20.0, z - 4.3, 39.4, 20.6, 0.4, C.gold);
    gross.klotz(146.5, 23.4, z - 1.2, 25, 25.4, 5, C.elf, 0, C.gold);
    {
      const zf = z - 3.8;
      const zb = z + 1.4;
      const a: V3 = [134, 25.4, zf];
      const b: V3 = [159, 25.4, zf];
      const c: V3 = [146.5, 31, zf];
      const a2: V3 = [134, 25.4, zb];
      const b2: V3 = [159, 25.4, zb];
      const c2: V3 = [146.5, 31, zb];
      gross.tri(b, a, c, C.elf);
      gross.tri(a2, b2, c2, C.elf);
      gross.quad(a2, c2, c, a, C.gold);
      gross.quad(c2, b2, b, c, C.gold);
      // Sonne im Giebel
      scheibe(gross, 2.4, 0.5, 12, C.gold, 146.5, 27.6, zf - 0.2);
      for (let k = 0; k < 12; k++) {
        const an = (k / 12) * Math.PI * 2;
        klein.tri([146.5 + Math.cos(an - 0.12) * 2.4, 27.6 + Math.sin(an - 0.12) * 2.4, zf - 0.5], [146.5 + Math.cos(an + 0.12) * 2.4, 27.6 + Math.sin(an + 0.12) * 2.4, zf - 0.5], [146.5 + Math.cos(an) * 3.6, 27.6 + Math.sin(an) * 3.6, zf - 0.5], C.goldH);
      }
    }
    // Freitreppen vor den Pfeilern (neben der Bahn)
    for (const [xa, xb] of [
      [118.5, 131.5],
      [159, 171],
    ] as [number, number][]) {
      const xm = (xa + xb) / 2;
      for (let i = 0; i < 7; i++) {
        const za = z - 15 + i * 1.4;
        gross.klotz(xm, g - 0.3, (za + z - 4.8) / 2, xb - xa, g + 0.32 * (i + 1), z - 4.8 - za, i % 2 === 0 ? C.stein : C.steinD, 0, C.stein);
      }
      // Wangen mit Urnen
      for (const xw of [xa - 0.5, xb + 0.5]) {
        gross.klotz(xw, g - 0.3, z - 9.9, 1, g + 2.6, 10.2, C.elfD, 0, C.elf);
        gross.prisma(xw, g + 2.6, z - 14.4, 0.25, 0.55, 0.9, 6, C.gold, C.gold);
      }
      for (let k = 0; k < 2; k++) besucher(klein, xm + (k - 0.5) * 5, z - 9 + k * 2.2, Math.PI, 0.6, g + 0.32 * (4 + k * 2));
    }
  }

  // --- Tor der Rampe (Südgiebel des Westschiffs) ------------------------------------------------------------
  {
    const z = PZ1;
    for (const cx of [56, 91]) {
      const g = ground(cx, z);
      gross.klotz(cx, g - 0.2, z + 0.4, 4, YE + 0.4, 2.4, C.elf, 0, C.gold);
      gross.prisma(cx, YE + 0.4, z + 0.4, 1.0, 0, 2.2, 4, C.gold, null, Math.PI / 4);
    }
    // Kartusche über dem Sturz
    scheibe(gross, 1.8, 0.5, 10, C.gold, 73.5, YE + 1.6, z + 0.8);
  }

  // --- Treppe mit Balustrade entlang der Rampe (steigt mit) ------------------------------------------------
  {
    const xa = 55.2;
    const xb = 60.2;
    const xm = (xa + xb) / 2;
    const sMin = S(645);
    const sMax = S(800);
    const roadAt = (z: number): number => {
      let best = Infinity;
      let y = 4;
      for (let i = sMin; i <= sMax; i++) {
        const d = Math.abs(t.pz[i] - z);
        if (d < best) {
          best = d;
          y = t.base[i];
        }
      }
      return y;
    };
    const STEP = 0.3;
    let zs = -60;
    let lvl = 4.0;
    const zEnd = 46;
    const posts: number[] = [];
    while (zs < zEnd) {
      // nächste Stufe dort, wo die Fahrbahn um eine Stufe höher liegt
      let ze = zs + 0.5;
      while (ze < zEnd && roadAt(ze) < lvl + STEP) ze += 0.5;
      const g = Math.min(ground(xm, zs), ground(xm, ze));
      gross.klotz(xm, g - 0.3, (zs + ze) / 2, xb - xa, lvl, ze - zs, C.steinD, 0, C.stein);
      // Handlauf
      klein.klotz(xb - 0.15, lvl + 0.95, (zs + ze) / 2, 0.36, lvl + 1.12, ze - zs, C.elf, 0, C.gold);
      klein.klotz(xb - 0.15, lvl, (zs + ze) / 2, 0.42, lvl + 0.2, ze - zs, C.elfD);
      if (!lo) for (let zz = zs + 0.6; zz < ze - 0.3; zz += 1.4) klein.prisma(xb - 0.15, lvl + 0.18, zz, 0.12, 0.09, 0.8, 4, C.elf, null, Math.PI / 4);
      posts.push((zs + ze) / 2, lvl);
      zs = ze;
      lvl += STEP;
    }
    for (let k = 0; k < posts.length; k += 6) {
      const zz = posts[k];
      const y = posts[k + 1];
      gross.klotz(xb - 0.15, y, zz, 0.6, y + 1.3, 0.6, C.elf, 0, C.gold);
      gross.prisma(xb - 0.15, y + 1.3, zz, 0.2, 0.42, 0.7, 6, C.gold, C.gold);
    }
    // Ein paar Besucher auf der Treppe
    for (let k = 2; k + 1 < posts.length; k += 8) besucher(klein, xm - 0.6 + rnd() * 1.4, posts[k], Math.PI / 2 + (rnd() - 0.5), 0.4, posts[k + 1] - 0.02);
    merke(xm, -7, 0);
  }

  // --- Spiegelwände ---------------------------------------------------------------------------------------
  let spiegelNr = 0;
  /** Wandspiegel im Goldrahmen; (x, z) Mitte der Wand, Blick (nx, nz). */
  const wandspiegel = (x: number, z: number, nx: number, nz: number, w: number, h: number, wellig: boolean, y0?: number): void => {
    const g = y0 ?? ground(x, z) + 0.6;
    const ux = -nz;
    const uz = nx;
    const fx = x + nx * 0.05;
    const fz = z + nz * 0.05;
    spiegel.flaeche(fx, g, fz, nx, nz, w, h, wellig, wellig ? C.silberVO : C.silberO, C.silberU, (spiegelNr++ * 0.618) % 1, lo ? 3 : 4, lo ? 2 : 3);
    // Rahmen: vier Leisten nach vorn, oben eine Krone
    const d = 0.32;
    const off = 0.14;
    const P = (u: number, y: number, o = off): V3 => [x + ux * u + nx * o, y, z + uz * u + nz * o];
    const hw = w / 2;
    const fr = wellig ? C.goldH : C.gold;
    klein.quad(P(-hw - d, g - d), P(hw + d, g - d), P(hw + d, g), P(-hw - d, g), fr);
    klein.quad(P(-hw - d, g + h), P(hw + d, g + h), P(hw + d, g + h + d), P(-hw - d, g + h + d), fr);
    klein.quad(P(-hw - d, g), P(-hw, g), P(-hw, g + h), P(-hw - d, g + h), fr);
    klein.quad(P(hw, g), P(hw + d, g), P(hw + d, g + h), P(hw, g + h), fr);
    klein.tri(P(-0.9, g + h + d), P(0.9, g + h + d), P(0, g + h + d + 1.1), C.goldH);
    klein.tri(P(-hw - d, g + h + d), P(-hw + 0.6, g + h + d), P(-hw - d, g + h + d + 0.6), C.goldD);
    klein.tri(P(hw - 0.6, g + h + d), P(hw + d, g + h + d), P(hw + d, g + h + d + 0.6), C.goldD);
  };
  const mirrorW = 5.0;
  const mirrorH = 6.6;
  const ersatz: number[] = [];
  /** Doppelseitige Spiegelreihe zwischen zwei Geraden. */
  const mittelreihe = (x: number, zmin: number, zmax: number): void => {
    for (let k = 0; k < NBAY; k++) {
      const zc = PZ0 + (k + 0.5) * BAY;
      if (zc < zmin || zc > zmax) continue;
      if (frei(x, zc) < 5) continue;
      if (nahRahmen(x, zc) < 23) {
        ersatz.push(x, zc);
        continue;
      }
      const g = ground(x, zc);
      klein.klotz(x, g - 0.2, zc, 0.5, g + 7.9, BAY - 1.4, C.elf, 0, C.gold);
      const wel = k % 3 === 1;
      wandspiegel(x + 0.25, zc, 1, 0, mirrorW, mirrorH, wel, g + 0.75);
      wandspiegel(x - 0.25, zc, -1, 0, mirrorW, mirrorH, !wel && k % 4 === 2, g + 0.75);
      merke(x, zc, 3);
    }
  };
  mittelreihe(129, PZ0, 10);
  mittelreihe(93, PZ0, PZ1);
  // Außenwände
  for (const [x, nx] of [
    [PXL[3] - 0.45, -1],
    [PXL[0] + 0.45, 1],
  ] as [number, number][]) {
    for (let k = 0; k < NBAY; k++) {
      const zc = PZ0 + (k + 0.5) * BAY;
      if (nx > 0 && zc > -64) continue; // dort steht die Treppe
      if (frei(x, zc) < 5) continue;
      if (nahRahmen(x, zc) < 23) {
        ersatz.push(x + nx * 2.5, zc);
        continue;
      }
      wandspiegel(x, zc, nx, 0, mirrorW, mirrorH, k % 3 === 2);
    }
  }
  // Wo neben den Spiel-Spiegeln keine Wandspiegel stehen dürfen: Palmen und Statuen
  for (let k = 0; k < ersatz.length; k += 2) {
    const x = ersatz[k];
    const z = ersatz[k + 1];
    if (!platz(x, z, 1.2)) continue;
    if (k % 4 === 0) palme(x, z);
    else statue(x, z, x > 140 ? -Math.PI / 2 : Math.PI / 2, (k / 2) % 3 === 0);
    merke(x, z, 1.5);
  }

  // --- Balkone an den Außenwänden mit Besuchern -------------------------------------------------------------
  for (const [xw, dir, z0, z1] of [
    [PXL[3], -1, PZ0 + 6, PZ1 - 8],
    [PXL[0], 1, PZ0 + 6, -6],
  ].slice(0, lo ? 1 : 2) as [number, number, number, number][]) {
    const BY = 11.4;
    const xs = xw + dir * 1.7;
    const xr = xw + dir * 3.4;
    const zm = (z0 + z1) / 2;
    gross.klotz(xs, BY - 0.45, zm, 3.4, BY, z1 - z0, C.elf, 0, C.parkB);
    klein.klotz(xr, BY - 0.6, zm, 0.2, BY - 0.1, z1 - z0, C.gold);
    klein.klotz(xr, BY + 1.0, zm, 0.3, BY + 1.15, z1 - z0, C.gold, 0, C.goldH);
    if (!lo) for (let z = z0; z <= z1; z += 2.4) klein.prisma(xr, BY, z, 0.1, 0.08, 1.0, 3, C.elf);
    // Konsolen
    for (let z = z0; z <= z1; z += BAY) klein.tri([xw, BY - 2.5, z], [xw, BY - 0.45, z], [xr, BY - 0.45, z], C.elfD);
    const nb = lo ? 3 : 8;
    for (let k = 0; k < nb; k++) {
      const z = z0 + 3 + ((z1 - z0 - 6) * (k + rnd() * 0.5)) / nb;
      if (k % 5 === 4) livree(klein, xs - dir * 0.3, z, dir > 0 ? Math.PI / 2 : -Math.PI / 2, BY);
      else besucher(klein, xs + dir * 0.4, z, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0.55, BY);
    }
  }

  // --- Absperrkordeln und Besucher in den Mittelstreifen und an der Ostwand ---------------------------------
  const kordel = (x: number, z0: number, z1: number): void => {
    const step = 4;
    let prev: V3 | null = null;
    for (let z = z0; z <= z1 + 0.01; z += step) {
      if (frei(x, z) < 3.2) {
        prev = null;
        continue;
      }
      const g = ground(x, z) + 0.12;
      klein.prisma(x, g, z, 0.1, 0.08, 1.0, 3, C.goldD, C.gold);
      const p: V3 = [x, g + 0.92, z];
      if (prev) {
        const mid: V3 = [x, (p[1] + prev[1]) / 2 - 0.28, (p[2] + prev[2]) / 2];
        klein.quad(prev, mid, [mid[0], mid[1] - 0.09, mid[2]], [prev[0], prev[1] - 0.09, prev[2]], C.kordel);
        klein.quad(mid, p, [p[0], p[1] - 0.09, p[2]], [mid[0], mid[1] - 0.09, mid[2]], C.kordel);
      }
      prev = p;
    }
  };
  const reihe = (x: number, z0: number, z1: number, yaw: number, anz: number): void => {
    for (let k = 0; k < anz; k++) {
      const z = z0 + (z1 - z0) * ((k + 0.2 + rnd() * 0.6) / anz);
      const xx = x + (rnd() - 0.5) * 1.2;
      if (frei(xx, z) < 4) continue;
      if (k % 7 === 3) livree(klein, xx, z, yaw);
      else besucher(klein, xx, z, yaw + (rnd() - 0.5) * 0.6, 0.45);
    }
  };
  // Mittelstreifen zwischen Saal und zweiter Gerade (x 129), Seiten zur Bahn
  kordel(129 + 5.4, -112, 2);
  kordel(129 - 5.4, -112, 2);
  reihe(129 + 3.4, -110, 0, Math.PI / 2, lo ? 4 : 8);
  reihe(129 - 3.4, -110, 0, -Math.PI / 2, lo ? 3 : 6);
  // zwischen zweiter und dritter Gerade (x 93)
  if (!lo) {
    kordel(93 + 5.4, -56, 46);
    kordel(93 - 5.4, -56, 46);
  }
  reihe(93 + 3.4, -54, 44, Math.PI / 2, lo ? 3 : 6);
  reihe(93 - 3.4, -54, 44, -Math.PI / 2, lo ? 3 : 6);
  // Ostwand
  if (!lo) kordel(PXL[3] - 6.2, -114, 44);
  reihe(PXL[3] - 3.6, -112, 44, -Math.PI / 2, lo ? 4 : 7);

  // --- Kronleuchter im Scheitel der ersten Kehre --------------------------------------------------------------
  const kron: { teil: number; w: number }[] = [];
  {
    // Marmorrosette am Boden
    const g = ground(KX, KZ) + 0.2;
    klein.prisma(KX, g, KZ, KR + 2.5, KR + 2.5, 0.03, 24, C.marmorD, rgb(0x8f89b0));
    klein.prisma(KX, g + 0.03, KZ, KR - 0.6, KR - 0.6, 0.02, 24, C.gold, C.goldD);
    klein.prisma(KX, g + 0.05, KZ, KR - 1.0, KR - 1.0, 0.02, 24, C.marmorD, rgb(0x7f79a6));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      klein.tri([KX + Math.cos(a - 0.12) * 1.2, g + 0.09, KZ + Math.sin(a - 0.12) * 1.2], [KX + Math.cos(a + 0.12) * 1.2, g + 0.09, KZ + Math.sin(a + 0.12) * 1.2], [KX + Math.cos(a) * (KR - 1.4), g + 0.09, KZ + Math.sin(a) * (KR - 1.4)], C.goldD);
    }
    // Stange, Kränze und Ketten
    const yTop = YE + 0.2;
    gross.prisma(KX, 9.6, KZ, 0.32, 0.26, yTop - 9.6, 6, C.gold);
    const kraenze: [number, number, number][] = [
      [16.2, 8.6, 18],
      [13.2, 5.8, 14],
      [10.6, 3.2, 10],
    ];
    for (const [y, r, n] of kraenze) {
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        gross.strebe([KX + Math.cos(a0) * r, y, KZ + Math.sin(a0) * r], [KX + Math.cos(a1) * r, y, KZ + Math.sin(a1) * r], 0.4, C.gold, 3);
      }
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        klein.strebe([KX, y + 1.8, KZ], [KX + Math.cos(a) * r, y, KZ + Math.sin(a) * r], 0.1, C.goldD, 3);
      }
      // Kerzen
      for (let k = 0; k < n; k += 2) {
        const a = ((k + 0.5) / n) * Math.PI * 2;
        klein.prisma(KX + Math.cos(a) * r, y + 0.18, KZ + Math.sin(a) * r, 0.1, 0.1, 0.5, 4, C.elf, C.licht);
      }
    }
    gross.geo(OKTA, C.goldH, KX, 9.4, KZ, 0, 0, 0, 0.6, 0.6, 0.6);
    // Prismenkränze (drehen sich) – Kristall in Weiß, Lavendel und hellem Gold
    const kristall = [rgb(0xf6f4ff), rgb(0xdcd6ff), rgb(0xfff0c0)];
    for (let ri = 0; ri < 3; ri++) {
      const [y, r, n0] = kraenze[ri];
      const n = lo ? Math.round(n0 * 0.6) : n0 + 4;
      dyn.beginn();
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const len = ri === 0 ? 0.55 : 0.75;
        dyn.geo(OKTA, kristall[k % 3], Math.cos(a) * r, -0.25 - len, Math.sin(a) * r, 0, a, 0, 0.22, len, 0.22);
      }
      if (ri === 2) {
        // Kaleidoskop: sechs große Prismen sternförmig und ein Tropfen
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          dyn.geo(OKTA, kristall[k % 3], Math.cos(a) * 1.5, -1.4, Math.sin(a) * 1.5, 0, -a, 0.9, 0.35, 1.2, 0.35);
        }
        dyn.geo(OKTA, rgb(0xeee8ff), 0, -2.6, 0, 0, 0, 0, 0.7, 1.3, 0.7);
      }
      const id = dyn.ende(0);
      dyn.liste[id].m.makeTranslation(KX, y, KZ);
      kron.push({ teil: id, w: [0.12, -0.17, 0.24][ri] });
    }
  }

  // --- Zweite Kehre: Spiegel-Labyrinth, Palmen, Statuen ----------------------------------------------------
  {
    // Palme in der Kehre selbst
    let px = 93;
    let pz = -77;
    let best = -1;
    for (let z = -88; z <= -66; z += 0.5) {
      for (let x = 88; x <= 98; x += 0.5) {
        const f = frei(x, z);
        if (f > best) {
          best = f;
          px = x;
          pz = z;
        }
      }
    }
    if (best > 4.2) {
      klein.prisma(px, ground(px, pz) + 0.2, pz, best + 2, best + 2, 0.04, 20, C.marmorD, C.marmor);
      palme(px, pz, 1.1);
    }
    // Labyrinth hinter der Kehre (Norden)
    const lx0 = 79.5;
    const lz0 = -121.5;
    const c = 4.5;
    const H = [
      [1, 1, 1, 1, 1, 1],
      [0, 1, 1, 0, 1, 0],
      [1, 0, 1, 1, 0, 1],
      [1, 0, 1, 1, 0, 1],
    ];
    const V = [
      [1, 1, 1],
      [0, 1, 0],
      [1, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [0, 1, 0],
      [1, 1, 1],
    ];
    const wand = (xa: number, za: number, xb: number, zb: number, k: number): void => {
      const xm = (xa + xb) / 2;
      const zm = (za + zb) / 2;
      if (frei(xm, zm) < 4) return;
      const g = ground(xm, zm) + 0.14;
      const len = Math.hypot(xb - xa, zb - za);
      const nx = (zb - za) / len;
      const nz = -(xb - xa) / len;
      klein.klotz(xm, g, zm, 0.3, g + 2.5, len, C.elf, Math.atan2(xb - xa, zb - za), C.gold);
      spiegel.flaeche(xm + nx * 0.17, g + 0.2, zm + nz * 0.17, nx, nz, len - 0.3, 2.2, k % 3 === 0, C.silberO, C.silberU, (spiegelNr++ * 0.618) % 1, 2, 1);
      spiegel.flaeche(xm - nx * 0.17, g + 0.2, zm - nz * 0.17, -nx, -nz, len - 0.3, 2.2, k % 4 === 1, C.silberVO, C.silberU, (spiegelNr++ * 0.618) % 1, 2, 1);
      klein.geo(OKTA, C.goldH, xa, g + 2.75, za, 0, 0, 0, 0.18, 0.25, 0.18);
    };
    let k = 0;
    for (let j = 0; j < H.length; j++) for (let i = 0; i < 6; i++) if (H[j][i]) wand(lx0 + i * c, lz0 + j * c, lx0 + (i + 1) * c, lz0 + j * c, k++);
    for (let i = 0; i < V.length; i++) for (let j = 0; j < 3; j++) if (V[i][j]) wand(lx0 + i * c, lz0 + j * c, lx0 + i * c, lz0 + (j + 1) * c, k++);
    for (const [x, z] of [
      [lx0 + 1.5 * c, lz0 + 1.5 * c],
      [lx0 + 3.5 * c, lz0 + 0.5 * c],
      [lx0 + 4.5 * c, lz0 + 2.5 * c],
    ]) besucher(klein, x, z, rnd() * 6, 0.6);
    merke(lx0 + 3 * c, lz0 + 1.5 * c, 15);
    // Statuen und Palmen an den Ecken des Labyrinths
    for (const [x, z, p] of [
      [lx0 - 3, lz0 + 12, 0],
      [lx0 + 6 * c + 3, lz0 + 12, 0],
      [lx0 - 3, lz0 + 3, 1],
      [lx0 + 6 * c + 3, lz0 + 3, 1],
      [118, -116, 1],
      [139, -116, 0],
      [62, -116, 0],
    ] as [number, number, number][]) {
      if (!platz(x, z, 1.4)) continue;
      if (p) palme(x, z);
      else statue(x, z, Math.PI, true);
      merke(x, z, 1.5);
    }
  }

  // ==================================================================================================
  // Innenhof: Rotunde und Springbrunnen
  // ==================================================================================================
  {
    const RX = -20;
    const RZ = 34;
    const R = 11;
    const N = 12;
    const g = ground(RX, RZ);
    gross.prisma(RX, g - 0.3, RZ, R + 2.2, R + 1.6, 1.1, N, C.steinD, C.stein, Math.PI / N);
    klein.prisma(RX, g + 0.82, RZ, R - 0.2, R - 0.2, 0.02, N, C.marmor, C.marmorD, Math.PI / N);
    const yb = g + 0.8;
    const yc = yb + 9.5;
    const pt = (k: number, r = R): [number, number] => {
      const a = (k / N) * Math.PI * 2 + Math.PI / N;
      return [RX + Math.cos(a) * r, RZ + Math.sin(a) * r];
    };
    for (let k = 0; k < N; k++) {
      const [x, z] = pt(k);
      gross.prisma(x, yb, z, 0.42, 0.36, yc - yb, 6, C.weiss);
      gross.klotz(x, yc - 0.6, z, 1.0, yc, 1.0, C.gold, 0, C.goldH);
      const [x2, z2] = pt(k + 1);
      // Tür nach Norden (zum Brunnen): dort kein Glas
      const tuer = Math.abs((x + x2) / 2 - RX) < 3 && (z + z2) / 2 < RZ;
      if (!tuer) glas.quad([x, yb, z], [x2, yb, z2], [x2, yc, z2], [x, yc, z], rgb(0xeaf4ff), 0.24);
      klein.quad([x, yb + 4.5, z], [x2, yb + 4.5, z2], [x2, yb + 4.8, z2], [x, yb + 4.8, z], C.weiss);
      gross.strebe([x, yc + 0.2, z], [x2, yc + 0.2, z2], 0.9, C.elf, 4);
    }
    // Kuppel: Rippen und Glas
    const NK = lo ? 3 : 5;
    const dome = (k: number, i: number): V3 => {
      const f = i / NK;
      const a = f * (Math.PI / 2);
      const rr = Math.cos(a) * (R - 0.3) + 1.6 * f;
      const yy = yc + 0.6 + Math.sin(a) * 8;
      const an = (k / N) * Math.PI * 2 + Math.PI / N;
      return [RX + Math.cos(an) * Math.max(1.6, rr), yy, RZ + Math.sin(an) * Math.max(1.6, rr)];
    };
    for (let k = 0; k < N; k++) {
      for (let i = 0; i < NK; i++) {
        const a = dome(k, i);
        const b = dome(k + 1, i);
        const c = dome(k + 1, i + 1);
        const d = dome(k, i + 1);
        glas.quad(a, b, c, d, i === NK - 1 ? rgb(0xfff1c8) : rgb(0xe8f4ff), 0.3);
        klein.strebe(a, d, 0.35, C.weiss, 3);
      }
    }
    // Laterne obendrauf
    const yl = yc + 8.6;
    gross.prisma(RX, yl, RZ, 1.7, 1.7, 2.2, 8, C.weiss, C.gold);
    gross.prisma(RX, yl + 2.2, RZ, 1.9, 0, 1.6, 8, C.gold);
    gross.geo(OKTA, C.goldH, RX, yl + 4.2, RZ, 0, 0, 0, 0.45, 0.6, 0.45);
    fahne(RX, RZ, 4, FAHNE_A, yl + 4.4);
    // Innen: Statue und Besucher
    statue(RX, RZ + 2, Math.PI);
    for (let k = 0; k < (lo ? 3 : 6); k++) {
      const a = rnd() * Math.PI * 2;
      besucher(klein, RX + Math.cos(a) * 6, RZ + Math.sin(a) * 6, a + Math.PI, 0.3, yb + 0.02);
    }
    merke(RX, RZ, R + 3);
    // Brunnen davor
    becken(RX, RZ - 22, 7.5, 1);
    merke(RX, RZ - 22, 9);
    for (const [dx, dz] of [
      [-10, -14],
      [10, -14],
      [-10, -30],
      [10, -30],
    ]) {
      buchsKegel(RX + dx, RZ + dz, 2.6);
      merke(RX + dx, RZ + dz, 1);
    }
    for (const [dx, dz, yaw] of [
      [-14, 2, -Math.PI / 2],
      [14, 2, Math.PI / 2],
      [-14, 22, -Math.PI / 2],
      [14, 22, Math.PI / 2],
    ] as [number, number, number][]) {
      statue(RX + dx, RZ + dz, yaw);
      merke(RX + dx, RZ + dz, 1.5);
    }
    for (let k = 0; k < (lo ? 4 : 8); k++) {
      const a = (k / 8) * Math.PI * 2 + 0.4;
      const x = RX + Math.cos(a) * 11;
      const z = RZ - 22 + Math.sin(a) * 11;
      if (platz(x, z, 0.5)) besucher(klein, x, z, Math.atan2(RX - x, RZ - 22 - z), 0.3);
    }
    // Rabatten im Hof
    for (const sx of lo ? [] : [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const z0 = RZ + 18 + k * 14;
        const x0 = RX + sx * 6;
        const x1 = RX + sx * 26;
        if (!platz((x0 + x1) / 2, z0 + 5, 6, 6)) continue;
        const gg = ground((x0 + x1) / 2, z0 + 5) + 0.06;
        klein.quad([x0, gg, z0], [x0, gg, z0 + 10], [x1, gg, z0 + 10], [x1, gg, z0], C.kies);
        hecke(x0, z0, x1, z0, 0.7, 0.6, klein);
        hecke(x0, z0 + 10, x1, z0 + 10, 0.7, 0.6, klein);
        const fl = [C.rot, C.gelb, C.blau, C.lila, C.blumeW][k % 5];
        for (let i = 0; i < 4; i++) {
          const xa = x0 + sx * (2 + i * 5);
          klein.quad([xa, gg + 0.04, z0 + 2], [xa, gg + 0.04, z0 + 8], [xa + sx * 3, gg + 0.04, z0 + 5], [xa + sx * 3, gg + 0.04, z0 + 5], fl);
          klein.tri([xa, gg + 0.04, z0 + 2], [xa + sx * 3, gg + 0.04, z0 + 5], [xa, gg + 0.04, z0 + 8], fl);
        }
        merke((x0 + x1) / 2, z0 + 5, 10);
      }
    }
  }

  // ==================================================================================================
  // Westfassade mit dem Rosettenfenster (offener Ring um die Flugbahn des Sprungs)
  // ==================================================================================================
  {
    const sj = S(1120);
    const FX = t.px[sj];
    const FZ = t.pz[sj];
    const lip = t.base[S(1115)] + 1.0;
    const RY = lip + 3.2;
    const RI = 13.6;
    const RO = 19.5;
    const SQ = RO + 2.5;
    const D = 1.3;
    const W0 = FX - 36;
    const W1 = FX + 36;
    const yTop = RY + SQ + 6;
    const N = 32;
    const ring = (a: number, r: number, z: number): V3 => [FX + Math.cos(a) * r, RY + Math.sin(a) * r, z];
    const sq = (a: number, z: number): V3 => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const k = SQ / Math.max(Math.abs(c), Math.abs(s));
      return [FX + c * k, RY + s * k, z];
    };
    for (const [z, aus] of [
      [FZ - D, -1],
      [FZ + D, 1],
    ] as [number, number][]) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2;
        const a1 = ((k + 1) / N) * Math.PI * 2;
        // Wand zwischen Ring und Quadrat
        if (aus > 0) gross.quad(ring(a0, RO, z), sq(a0, z), sq(a1, z), ring(a1, RO, z), C.elf);
        else gross.quad(ring(a1, RO, z), sq(a1, z), sq(a0, z), ring(a0, RO, z), C.elf);
        // Maßwerk: Innenring und Außenring in Gold, Speichen
        const zz = z + aus * 0.08;
        klein.quad(ring(a0, RI, zz), ring(a1, RI, zz), ring(a1, RI + 0.9, zz), ring(a0, RI + 0.9, zz), C.gold);
        klein.quad(ring(a0, RO - 0.8, zz), ring(a1, RO - 0.8, zz), ring(a1, RO, zz), ring(a0, RO, zz), C.goldD);
        const am = (a0 + a1) / 2;
        klein.quad(ring(a0 - 0.012, RI + 0.9, zz), ring(a0 + 0.012, RI + 0.9, zz), ring(a0 + 0.008, RO - 0.8, zz), ring(a0 - 0.008, RO - 0.8, zz), C.gold);
        // Rundbogen-Blättchen in der Mitte
        klein.tri(ring(am - 0.05, RI + 2.2, zz), ring(am + 0.05, RI + 2.2, zz), ring(am, RO - 1.6, zz), C.goldH);
      }
      // Wandflächen außerhalb des Quadrats
      const yb = ground(FX, FZ) - 1;
      const wq = (xa: number, ya: number, xb: number, yb2: number, c: RGB): void => {
        if (aus < 0) gross.quad([xa, ya, z], [xa, yb2, z], [xb, yb2, z], [xb, ya, z], c);
        else gross.quad([xb, ya, z], [xb, yb2, z], [xa, yb2, z], [xa, ya, z], c);
      };
      wq(W0, yb, FX - SQ, yTop, C.elf);
      wq(FX + SQ, yb, W1, yTop, C.elf);
      wq(FX - SQ, RY + SQ, FX + SQ, yTop, C.elf);
      // Gesims und Giebel
      wq(W0 - 0.5, yTop, W1 + 0.5, yTop + 1.2, C.gold);
      const g0: V3 = [FX - 22, yTop + 1.2, z];
      const g1: V3 = [FX + 22, yTop + 1.2, z];
      const g2: V3 = [FX, yTop + 10, z];
      if (aus < 0) gross.tri(g0, g2, g1, C.elf);
      else gross.tri(g1, g2, g0, C.elf);
      // Lisenen
      for (const xl of [FX - SQ - 2, FX + SQ + 2, W0 + 2, W1 - 2]) wq(xl - 1, yb, xl + 1, yTop, C.elfD);
    }
    // Leibung der Rosette und Rand oben/unten/seitlich
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      gross.quad(ring(a0, RI, FZ - D), ring(a0, RI, FZ + D), ring(a1, RI, FZ + D), ring(a1, RI, FZ - D), C.goldD);
      // farbige Glasfelder zwischen den Ringen (nur um die Öffnung)
      glas.quad(ring(a0, RI + 0.9, FZ), ring(a1, RI + 0.9, FZ), ring(a1, RO - 0.8, FZ), ring(a0, RO - 0.8, FZ), GLAS_FARBEN[k % 4], 0.62);
    }
    const yb = ground(FX, FZ) - 1;
    for (const [xa, xb] of [
      [W0, W0],
      [W1, W1],
    ]) gross.quad([xa, yb, FZ - D], [xa, yb, FZ + D], [xb, yTop, FZ + D], [xb, yTop, FZ - D], C.elfD);
    gross.quad([W0, yTop + 1.2, FZ - D], [W1, yTop + 1.2, FZ - D], [W1, yTop + 1.2, FZ + D], [W0, yTop + 1.2, FZ + D], C.gold);
    // Türme an den Enden mit goldenen Kuppeln
    for (const tx of [W0 - 4, W1 + 4]) {
      const tg = ground(tx, FZ);
      gross.prisma(tx, tg - 0.5, FZ, 5, 4.6, yTop + 6 - tg, 8, C.elf, null, Math.PI / 8);
      gross.prisma(tx, yTop + 5.5, FZ, 5.4, 5.4, 1.2, 8, C.gold, null, Math.PI / 8);
      gross.prisma(tx, yTop + 6.7, FZ, 4.6, 0, 6, 8, C.gold, null, Math.PI / 8);
      fahne(tx, FZ, 4, FAHNE_B, yTop + 12.6);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        glas.quad([tx + Math.cos(a - 0.2) * 4.7, yTop - 6, FZ + Math.sin(a - 0.2) * 4.7], [tx + Math.cos(a + 0.2) * 4.7, yTop - 6, FZ + Math.sin(a + 0.2) * 4.7], [tx + Math.cos(a + 0.2) * 4.66, yTop, FZ + Math.sin(a + 0.2) * 4.66], [tx + Math.cos(a - 0.2) * 4.66, yTop, FZ + Math.sin(a - 0.2) * 4.66], C.violett, 0.55);
      }
    }
    merke(FX, FZ, 0);
    for (let x = W0 - 10; x <= W1 + 10; x += 6) merke(x, FZ, 4);
  }

  // ==================================================================================================
  // Schlosspark
  // ==================================================================================================
  // --- Hauptachse vom Start zur Rotunde: Kiesweg, Parterres, Becken -----------------------------------------
  {
    const AX = -20;
    const zA = -184;
    const zB = 0;
    // Kiesweg
    for (let z = zA; z < zB; z += 8) {
      const z1 = Math.min(zB, z + 8);
      if (frei(AX, z) < 6) continue;
      const g0 = ground(AX, z) + 0.06;
      const g1 = ground(AX, z1) + 0.06;
      klein.quad([AX - 5, g0, z], [AX - 5, g1, z1], [AX + 5, g1, z1], [AX + 5, g0, z], C.kies);
    }
    becken(AX, -150, 8, 0);
    merke(AX, -150, 10);
    becken(AX, -80, 13, 1);
    merke(AX, -80, 15);
    // Parterres beidseits des Weges
    const parterre = (x0: number, x1: number, z0: number, z1: number, muster: number): void => {
      const xm = (x0 + x1) / 2;
      const zm = (z0 + z1) / 2;
      const rr = Math.min(x1 - x0, z1 - z0) / 2;
      if (!platz(xm, zm, rr, 5 + Math.abs(x1 - x0 - (z1 - z0)) / 2)) return;
      merke(xm, zm, rr);
      const g = ground(xm, zm) + 0.05;
      klein.quad([x0, g, z0], [x0, g, z1], [x1, g, z1], [x1, g, z0], C.kiesD);
      hecke(x0, z0, x1, z0, 0.8, 0.7, klein);
      hecke(x0, z1, x1, z1, 0.8, 0.7, klein);
      hecke(x0, z0, x0, z1, 0.8, 0.7, klein);
      hecke(x1, z0, x1, z1, 0.8, 0.7, klein);
      // Broderie: Rauten und Bänder in Blumenfarben
      const fl = muster % 2 === 0 ? [C.rot, C.gelb, C.blumeW] : [C.lila, C.blau, C.gelb];
      const nr = 3;
      for (let i = 0; i < nr; i++) {
        const zc = z0 + ((z1 - z0) * (i + 0.5)) / nr;
        const hz = ((z1 - z0) / nr) * 0.4;
        const hx = (x1 - x0) * 0.36;
        const c = fl[i % 3];
        klein.quad([xm - hx, g + 0.04, zc], [xm, g + 0.04, zc + hz], [xm + hx, g + 0.04, zc], [xm, g + 0.04, zc - hz], c);
        klein.quad([xm - hx * 0.45, g + 0.06, zc], [xm, g + 0.06, zc + hz * 0.45], [xm + hx * 0.45, g + 0.06, zc], [xm, g + 0.06, zc - hz * 0.45], C.heckeH);
      }
      // Buchskegel an den Ecken, Kugeln in der Mitte der Längsseiten
      for (const [x, z] of [
        [x0, z0],
        [x1, z0],
        [x0, z1],
        [x1, z1],
      ]) buchsKegel(x, z, 2.8);
      buchsKugel(x0, zm, 0.9, klein);
      buchsKugel(x1, zm, 0.9, klein);
    };
    let m = 0;
    for (const [z0, z1] of [
      [-140, -98],
      [-62, -24],
      [-176, -160],
    ] as [number, number][]) {
      parterre(AX - 36, AX - 9, z0, z1, m++);
      parterre(AX + 9, AX + 36, z0, z1, m++);
    }
    // Laternen und Orangenbäumchen entlang des Weges
    for (let z = zA + 6; z < zB - 4; z += lo ? 28 : 14) {
      for (const sx of [-1, 1]) {
        const x = AX + sx * 6.5;
        if (!platz(x, z, 0.6, 4)) continue;
        if (Math.round((z - zA) / 14) % 2 === 0) laterne(x, z);
        else orangenbaum(x, z);
        merke(x, z, 0.8);
      }
    }
    // Statuen an den Kreuzungen
    for (const z of [-158, -116, -92, -44]) {
      for (const sx of [-1, 1]) {
        const x = AX + sx * 7;
        if (platz(x, z, 1.2)) {
          statue(x, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, z === -92);
          merke(x, z, 1.5);
        }
      }
    }
    // Spaziergänger
    for (let k = 0; k < (lo ? 6 : 12); k++) {
      const z = zA + 10 + rnd() * (zB - zA - 20);
      const x = AX + (rnd() - 0.5) * 7;
      if (platz(x, z, 0.4, 5)) besucher(klein, x, z, rnd() < 0.5 ? 0 : Math.PI, 0.25);
    }
  }

  // --- Becken bei der S-Kurve, Bosketts --------------------------------------------------------------------
  {
    if (platz(-108, -122, 12, 8)) {
      becken(-108, -122, 9, 2);
      merke(-108, -122, 11);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = -108 + Math.cos(a) * 13;
        const z = -122 + Math.sin(a) * 13;
        if (platz(x, z, 1)) {
          if (k % 2) buchsKugel(x, z, 1.1);
          else laterne(x, z);
          merke(x, z, 1);
        }
      }
    }
    // Bosketts: hohe Heckenblöcke
    for (let k = 0; k < (lo ? 3 : 16); k++) {
      const x = -150 + rnd() * 100;
      const z = -175 + rnd() * 140;
      const w = 6 + rnd() * 8;
      const d = 6 + rnd() * 8;
      if (!platz(x, z, Math.hypot(w, d) / 2 + 1, 12)) continue;
      merke(x, z, Math.hypot(w, d) / 2 + 1);
      const g = ground(x, z);
      gross.klotz(x, g - 0.2, z, w, g + 2.4, d, C.hecke, 0, C.heckeH);
      buchsKegel(x - w / 2 - 1.2, z - d / 2 - 1.2, 2.4, klein);
      buchsKegel(x + w / 2 + 1.2, z + d / 2 + 1.2, 2.4, klein);
    }
  }

  // --- Orangerie an der S-Kurve -------------------------------------------------------------------------
  {
    const OX = -214;
    const z0 = -152;
    const z1 = -94;
    const g = ground(OX, (z0 + z1) / 2);
    const D = 12;
    const H = 7.5;
    // Rückwand, Dach mit Balustrade, Pfeiler und Glasbögen nach Osten
    gross.klotz(OX - D / 2 + 0.6, g - 0.3, (z0 + z1) / 2, 1.2, g + H, z1 - z0, C.elf, 0, C.elfD);
    gross.klotz(OX, g + H, (z0 + z1) / 2, D + 1, g + H + 0.8, z1 - z0 + 1, C.elf, 0, C.elfD);
    klein.klotz(OX + D / 2, g + H + 0.8, (z0 + z1) / 2, 0.3, g + H + 1.8, z1 - z0, C.elf, 0, C.gold);
    for (const z of [z0, z1]) gross.klotz(OX, g - 0.3, z, D, g + H, 1.2, C.elf, 0, C.elfD);
    const nb = 9;
    for (let k = 0; k <= nb; k++) {
      const z = z0 + ((z1 - z0) * k) / nb;
      gross.klotz(OX + D / 2 - 0.5, g - 0.3, z, 1.2, g + H, 1.4, C.elf, 0, C.elfD);
      if (k % 3 === 0) gross.prisma(OX + D / 2 - 0.5, g + H + 0.8, z, 0.3, 0.6, 1.0, 6, C.gold, C.gold);
      if (k < nb) {
        const za = z + 0.7;
        const zb = z0 + ((z1 - z0) * (k + 1)) / nb - 0.7;
        const zm = (za + zb) / 2;
        const xg = OX + D / 2 - 0.3;
        glas.quad([xg, g + 0.6, za], [xg, g + 0.6, zb], [xg, g + H - 2.4, zb], [xg, g + H - 2.4, za], rgb(0xeaf4ff), 0.32);
        glas.tri([xg, g + H - 2.4, za], [xg, g + H - 2.4, zb], [xg, g + H - 0.6, zm], rgb(0xfff1c8), 0.36);
        klein.quad([xg + 0.05, g + 0.6, zm - 0.1], [xg + 0.05, g + 0.6, zm + 0.1], [xg + 0.05, g + H - 0.6, zm + 0.1], [xg + 0.05, g + H - 0.6, zm - 0.1], C.weiss);
        // Pflanzen hinter dem Glas
        kugel(klein, OX + 1, g + 2.2, zm, 1.4, 1.6, 1.4, rgb(0x3f8f3f), C.orange, 0.25);
      }
    }
    fahne(OX, (z0 + z1) / 2, 4, FAHNE_A, g + H + 0.8);
    for (let x = OX - 10; x <= OX + 8; x += 6) for (let z = z0 - 4; z <= z1 + 4; z += 6) merke(x, z, 4);
    // Orangenbäumchen in Kübeln vor der Orangerie
    for (let z = z0 + 3; z <= z1 - 3; z += lo ? 9 : 6) {
      const x = OX + D / 2 + 6;
      if (platz(x, z, 1, 3.5)) {
        orangenbaum(x, z, 1.15);
        merke(x, z, 1.2);
      }
    }
    for (let k = 0; k < (lo ? 2 : 4); k++) {
      const z = z0 + 6 + rnd() * (z1 - z0 - 12);
      const x = OX + D / 2 + 3;
      if (platz(x, z, 0.4, 3.5)) besucher(klein, x, z, Math.PI / 2, 0.3);
    }
  }

  // --- Vorplatz: Tribüne mit Publikum, Kapelle im Pavillon, Fahnen, Laternen ---------------------------------
  {
    // Tribüne nördlich der Start-/Zielgeraden, Blick nach Süden auf die Bahn
    const TX = -114;
    const TW = 46;
    let zf = -213;
    while (frei(TX - TW / 2, zf) < 3.5 || frei(TX + TW / 2, zf) < 3.5 || frei(TX, zf) < 3.5) zf -= 0.5;
    const rows = 6;
    const g = ground(TX, zf - 5);
    for (let r = 0; r < rows; r++) {
      const zc = zf - 0.8 - r * 1.6;
      gross.klotz(TX, g - 0.3, zc, TW, g + 0.7 * (r + 1), 1.6, r % 2 === 0 ? C.elf : C.elfD, 0, C.parkA);
    }
    const zb = zf - rows * 1.6;
    gross.klotz(TX, g - 0.3, zb - 0.4, TW, g + 7.2, 0.8, C.elf, 0, C.gold);
    for (const sx of [-1, 1]) gross.klotz(TX + sx * (TW / 2 + 0.4), g - 0.3, zf - rows * 0.8, 0.8, g + 4.6, rows * 1.6 + 0.8, C.elfD, 0, C.gold);
    // Dach: gestreifte Markise auf Säulen
    const nP = 5;
    for (let k = 0; k <= nP; k++) {
      const x = TX - TW / 2 + (TW * k) / nP;
      gross.prisma(x, g - 0.2, zf - 0.4, 0.22, 0.18, 8.4, 6, C.weiss);
      fahne(x, zf - 0.4, 9.6, k % 2 ? FAHNE_A : FAHNE_C, g);
    }
    const nS = 12;
    for (let k = 0; k < nS; k++) {
      const xa = TX - TW / 2 + (TW * k) / nS;
      const xb = TX - TW / 2 + (TW * (k + 1)) / nS;
      klein.quad([xa, g + 8.2, zf - 0.6], [xa, g + 9.8, zb - 0.4], [xb, g + 9.8, zb - 0.4], [xb, g + 8.2, zf - 0.6], k % 2 ? C.gold : C.weiss);
      // Volant
      klein.tri([xa, g + 8.2, zf - 0.6], [xb, g + 8.2, zf - 0.6], [(xa + xb) / 2, g + 7.6, zf - 0.6], k % 2 ? C.gold : C.weiss);
    }
    // Publikum
    for (let r = 0; r < rows; r++) {
      const n = lo ? 3 : 8;
      for (let k = 0; k < n; k++) {
        if (rnd() < 0.15) continue;
        const x = TX - TW / 2 + 2 + ((TW - 4) * (k + 0.2 + rnd() * 0.6)) / n;
        const zc = zf - 1.0 - r * 1.6;
        person(klein, x, g + 0.7 * (r + 1), zc, 0, { einfach: true, oben: pick(KLEID), arme: rnd() < 0.3 ? 2 : 0, s: 1.2, hut: rnd() < 0.25 ? (rnd() < 0.5 ? 1 : 3) : 0 });
      }
    }
    for (let x = TX - TW / 2 - 4; x <= TX + TW / 2 + 4; x += 6) merke(x, zf - 6, 7);

    // Pavillon mit Kapelle südlich der Geraden
    let PX = -100;
    let PZ = -176;
    while (frei(PX, PZ) < 10 && PZ < -150) PZ += 1;
    const pg = ground(PX, PZ);
    const R = 5.4;
    gross.prisma(PX, pg - 0.3, PZ, R + 0.8, R + 0.6, 1.2, 8, C.steinD, C.marmor, Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      gross.prisma(PX + Math.cos(a) * R, pg + 0.9, PZ + Math.sin(a) * R, 0.24, 0.2, 4.4, 6, C.weiss);
    }
    gross.prisma(PX, pg + 5.2, PZ, R + 0.7, R + 0.7, 0.6, 8, C.gold, null, Math.PI / 8);
    gross.prisma(PX, pg + 5.8, PZ, R + 1.0, 0.4, 3.4, 8, C.dach, null, Math.PI / 8);
    gross.geo(OKTA, C.goldH, PX, pg + 9.6, PZ, 0, 0, 0, 0.5, 0.8, 0.5);
    // Musiker im Halbkreis, Blick zur Bahn (Norden), Dirigent davor
    const instr = (x: number, y: number, z: number, art: number): void => {
      if (art === 0) gross.prisma(x, y + 1.0, z - 0.45, 0.12, 0.42, 0.7, 6, C.goldH, C.goldD);
      else if (art === 1) gross.prisma(x, y + 0.5, z - 0.5, 0.42, 0.42, 0.5, 8, C.rot, C.elf);
      else klein.strebe([x + 0.3, y + 1.6, z - 0.3], [x - 0.1, y + 0.6, z - 0.5], 0.12, C.goldH, 4);
    };
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * 0.15 + (k / 4) * Math.PI * 0.7;
      const x = PX + Math.cos(a) * 2.8;
      const z = PZ + Math.sin(a) * 2.2;
      person(klein, x, pg + 0.9, z, Math.PI, { unten: rgb(0x2f3a6a), oben: C.violettD, hut: 1, arme: 3 });
      instr(x, pg + 0.9, z, k % 3);
    }
    person(klein, PX, pg + 0.9, PZ - 2.6, 0, { unten: C.schwarz, oben: C.schwarz, hut: 4, arme: 5 });
    merke(PX, PZ, R + 2);
    // Zuhörer
    for (let k = 0; k < (lo ? 3 : 6); k++) {
      const a = Math.PI * 0.2 + rnd() * Math.PI * 0.6;
      const x = PX + Math.cos(a) * 9;
      const z = PZ + Math.sin(a) * 9;
      if (platz(x, z, 0.4)) besucher(klein, x, z, Math.atan2(PX - x, PZ - z), 0.3);
    }
    // Fahnen und Laternen entlang des Vorplatzes
    const VS = lo ? 24 : 12;
    for (let i = 0; i < t.n; i += VS) {
      const m = i * t.step;
      if (m > 215 && m < 1195) continue;
      for (const sgn of [-1, 1]) {
        const lat = sgn * (t.wh[i] + 4);
        const x = t.px[i] + rightX(t, i) * lat;
        const z = t.pz[i] + rightZ(t, i) * lat;
        if (!platz(x, z, 0.6, 3.4)) continue;
        if ((i / VS) % 2 === 0) laterne(x, z, 4);
        else if (sgn < 0) fahne(x, z, 7, [FAHNE_A, FAHNE_B, FAHNE_C][(i / VS) % 3]);
        else orangenbaum(x, z);
        merke(x, z, 0.8);
      }
    }
  }

  // --- Alleen und Wald -------------------------------------------------------------------------------------
  {
    // Alleen: beschnittene Linden in Reihen
    const allee = (x0: number, z0: number, x1: number, z1: number, step: number): void => {
      const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / step);
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const z = z0 + ((z1 - z0) * k) / n;
        if (!platz(x, z, 3.2, 4)) continue;
        baum(x, z, 8 + rnd() * 1.5);
        merke(x, z, 3);
      }
    };
    const st = lo ? 26 : 18;
    allee(-78, -175, -78, 20, st);
    allee(38, -175, 38, 40, st);
    allee(-150, -232, 110, -232, st);
    allee(185, -150, 185, 70, st);
    allee(100, 120, -40, 175, st);
    if (!lo) allee(-226, -170, -226, -60, st);
    // Ferner Wald rings um den Park
    const nW = lo ? 16 : 50;
    let made = 0;
    for (let k = 0; k < 2000 && made < nW; k++) {
      const a = rnd() * Math.PI * 2;
      const d = world.radius * (1.05 + rnd() * 0.9);
      const x = world.center.x + Math.cos(a) * d;
      const z = world.center.z + Math.sin(a) * d;
      if (innen(x, z) || frei(x, z) < 30) continue;
      const g = ground(x, z);
      const s = 7 + rnd() * 6;
      const green = pick([rgb(0x2f6f3a), rgb(0x3a7f40), rgb(0x2a5f36), rgb(0x46884a)]);
      if (lo || rnd() < 0.6) klein.prisma(x, g - 1, z, s * 0.55, 0, s * 2.2, 6, green, null, rnd());
      else kugel(klein, x, g + s * 0.75, z, s * 0.85, s, s * 0.85, green, rgb(0x2a5a30), 0.3, rnd() * 3);
      made++;
    }
  }

  // ==================================================================================================
  // Bewegtes: Tauben und Ballon
  // ==================================================================================================
  interface Taube {
    body: number;
    wl: number;
    wr: number;
    hx: number;
    hz: number;
    off: number;
  }
  const tauben: Taube[] = [];
  let TCX = -60;
  let TCZ = -160;
  {
    // Schwarmplatz: auf dem Vorplatz südlich der Geraden, Kreis bleibt weit weg von der Bahn
    for (let k = 0; k < 40; k++) {
      const x = -70 + k * 3;
      if (frei(x, -158) > 20) {
        TCX = x;
        break;
      }
    }
    const nT = lo ? 6 : 12;
    const grau = [rgb(0xb8bccb), rgb(0xd8dae2), rgb(0xf4f2ee), rgb(0x9aa0b2)];
    for (let k = 0; k < nT; k++) {
      const c = grau[k % 4];
      dyn.beginn();
      dyn.geo(OKTA, c, 0, 0, 0, 0, 0, 0, 0.13, 0.13, 0.3);
      dyn.geo(OKTA, c, 0, 0.12, 0.26, 0, 0, 0, 0.08, 0.08, 0.09);
      dyn.tri([0, 0.12, 0.33], [0.03, 0.1, 0.4], [-0.03, 0.1, 0.4], C.orange);
      dyn.tri([0, 0.03, -0.25], [0.12, 0.02, -0.48], [-0.12, 0.02, -0.48], c);
      const body = dyn.ende(0);
      dyn.beginn();
      dyn.quad([0, 0, 0.12], [0.55, 0, 0.02], [0.5, 0, -0.14], [0, 0, -0.12], c);
      const wr = dyn.ende(3);
      dyn.beginn();
      dyn.quad([0, 0, -0.12], [-0.5, 0, -0.14], [-0.55, 0, 0.02], [0, 0, 0.12], c);
      const wl = dyn.ende(3);
      const a = rnd() * Math.PI * 2;
      const r = 2 + rnd() * 5;
      tauben.push({ body, wl, wr, hx: TCX + Math.cos(a) * r, hz: TCZ + Math.sin(a) * r, off: rnd() * 1.2 });
    }
  }
  // Heißluftballon: Hülle in Elfenbein, Gold und Violettblau
  let ballon = -1;
  {
    const prof: [number, number][] = [
      [0.9, 3],
      [2.6, 4.6],
      [4.1, 6.6],
      [4.8, 8.7],
      [4.5, 10.7],
      [3.3, 12.3],
      [1.5, 13.2],
      [0.01, 13.5],
    ];
    const NS = 12;
    const farben = [C.elf, C.gold, C.violett];
    dyn.beginn();
    for (let k = 0; k < NS; k++) {
      const a0 = (k / NS) * Math.PI * 2;
      const a1 = ((k + 1) / NS) * Math.PI * 2;
      for (let j = 0; j < prof.length - 1; j++) {
        const [r0, y0] = prof[j];
        const [r1, y1] = prof[j + 1];
        const c = j === 3 ? C.goldH : farben[k % 3];
        dyn.quad([Math.cos(a1) * r0, y0, Math.sin(a1) * r0], [Math.cos(a0) * r0, y0, Math.sin(a0) * r0], [Math.cos(a0) * r1, y1, Math.sin(a0) * r1], [Math.cos(a1) * r1, y1, Math.sin(a1) * r1], c);
      }
    }
    dyn.box(0, 0.5, 0, 1.3, 1.0, 1.3, rgb(0x9a6a3e), 0, rgb(0x6e4a2c), true);
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) dyn.strebe([sx * 0.6, 1.0, sz * 0.6], [sx * 0.85, 3.05, sz * 0.85], 0.06, C.schwarz, 3);
    ballon = dyn.ende(0);
  }

  // ==================================================================================================
  // Netze zusammenstellen
  // ==================================================================================================
  const toonF = toonMaterial({ vertexColors: true });
  const toonD = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  disposables.push(toonF, toonD);
  {
    const geo = gross.build();
    const mesh = new THREE.Mesh(geo, toonF);
    group.add(mesh);
    disposables.push(geo);
    if (lines) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(0.05));
      ol.name = 'outline';
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
    }
  }
  {
    const geo = klein.build();
    group.add(new THREE.Mesh(geo, toonD));
    disposables.push(geo);
  }
  // Glas (durchscheinend, Deckkraft je Fläche)
  {
    const geo = glas.build();
    // forceSinglePass: beidseitig in einem Durchgang (sonst zeichnet three.js durchscheinende Flächen zweimal)
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    group.add(mesh);
    disposables.push(geo, mat);
  }
  // Spiegelflächen (Farben je Bild)
  const nSp = spiegel.count;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.Float32BufferAttribute(spiegel.pos, 3));
  const spCol = new THREE.BufferAttribute(new Float32Array(nSp * 3), 3);
  spCol.setUsage(THREE.DynamicDrawUsage);
  spGeo.setAttribute('color', spCol);
  spGeo.computeBoundingSphere();
  const spBase = Float32Array.from(spiegel.base);
  const spS = Float32Array.from(spiegel.s);
  const spPh = Float32Array.from(spiegel.ph);
  const spSp = Float32Array.from(spiegel.sp);
  {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(spGeo, mat));
    disposables.push(spGeo, mat);
  }

  // Bewegtes: ein Netz, Ecken je Bild aus der Grundform
  const nKontur = dyn.ordne();
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
  const dynMesh = new THREE.Mesh(dynGeo, toonD);
  dynMesh.frustumCulled = false;
  group.add(dynMesh);
  disposables.push(dynGeo);
  if (lines && dPos.count > 0) {
    baseON = glatteNormalen(basePos, baseNor, teile);
    dON = new THREE.BufferAttribute(Float32Array.from(baseON), 3);
    dON.setUsage(THREE.DynamicDrawUsage);
    dynGeo.setAttribute('onormal', dON);
    // Kontur nur für die starren Teile vorn (Tücher und Flügel sind dünn und beidseitig sichtbar).
    const ohne = new THREE.MeshBasicMaterial({ visible: false });
    disposables.push(ohne);
    dynGeo.addGroup(0, nKontur, 0);
    dynGeo.addGroup(nKontur, dPos.count - nKontur, 1);
    const ol = new THREE.Mesh(dynGeo, [outlineMaterial(0.04), ohne]);
    ol.name = 'outline';
    ol.frustumCulled = false;
    ol.matrixAutoUpdate = false;
    dynMesh.add(ol);
  }

  // Lichtflecken des Kronleuchters (additiv, nur neben der Bahn)
  const NBODEN = lo ? 10 : 16;
  const NWAND = lo ? 4 : 8;
  const NL = NBODEN + NWAND;
  const spotGeo = new THREE.CircleGeometry(1, 14);
  const spotMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  const spots = new THREE.InstancedMesh(spotGeo, spotMat, NL);
  spots.frustumCulled = false;
  spots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  spots.renderOrder = 3;
  {
    const col = new THREE.Color();
    const farben = [0xfff4d6, 0xffe08a, 0x9aa6ff];
    for (let k = 0; k < NL; k++) spots.setColorAt(k, col.set(farben[k % 3]));
  }
  group.add(spots);
  disposables.push(spotGeo, spotMat, spots);
  // Je Fleck: Bahnparameter
  const spA = new Float32Array(NL);
  const spR = new Float32Array(NL);
  const spW = new Float32Array(NL);
  const spSz = new Float32Array(NL);
  for (let k = 0; k < NL; k++) {
    spA[k] = rnd() * Math.PI * 2;
    spR[k] = rnd();
    spW[k] = 0.15 + rnd() * 0.2;
    spSz[k] = 0.6 + rnd() * 0.6;
  }
  const kGround = ground(KX, KZ) + 0.3;

  // Brunnen: Teilchen nur in Sichtweite
  const strahlT = new Float32Array(Math.max(1, strahlen.length));

  // --- Pro Bild ------------------------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const posA = dPos.array as Float32Array;
  const norA = dNor.array as Float32Array;
  const colA = spCol.array as Float32Array;

  const setzeTeil = (p: Teil, time: number): void => {
    const el = p.m.elements;
    const on = baseON;
    const onA = dON ? (dON.array as Float32Array) : null;
    for (let i = p.v0; i < p.v1; i++) {
      const o = i * 3;
      let x = basePos[o];
      let y = basePos[o + 1];
      let z = basePos[o + 2];
      if (p.art === 2) {
        const u = Math.max(0, x) / p.len;
        const wv = Math.sin(p.k * x - p.w * time + p.ph) + 0.35 * Math.sin(p.k * 2.3 * x - p.w * 1.7 * time + p.ph * 2 + y);
        z += p.amp * u * wv;
        x *= 1 - 0.05 * u * (1 + Math.sin(p.w * time * 0.5 + p.ph));
        y += p.amp * 0.25 * u * Math.sin(p.w * 0.8 * time + p.ph + x);
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
  const lage = (p: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, sx = 1, sy = 1, sz = 1): void => {
    e.set(pitch, yaw, roll, 'YXZ');
    q.setFromEuler(e);
    teile[p].m.compose(v.set(x, y, z), q, sv.set(sx, sy, sz));
  };
  const ballonAlt = 64;
  let brenner = 0;

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Glanzstreifen auf den Spiegeln ---
      for (let i = 0; i < nSp; i++) {
        const c = (((time * spSp[i] + spPh[i]) % 1) + 1) % 1;
        const center = c * 2.4 - 0.5;
        let k = 1 - Math.abs(spS[i] - center) / 0.26;
        k = k > 0 ? k * k * (3 - 2 * k) : 0;
        let k2 = 1 - Math.abs(spS[i] - center + 0.36) / 0.1;
        k2 = k2 > 0 ? k2 : 0;
        const g = Math.min(1, k * 0.7 + k2 * 0.45);
        const o = i * 3;
        colA[o] = spBase[o] + (1 - spBase[o]) * g;
        colA[o + 1] = spBase[o + 1] + (1 - spBase[o + 1]) * g;
        colA[o + 2] = spBase[o + 2] + (1 - spBase[o + 2]) * g * 0.95;
      }
      spCol.needsUpdate = true;

      // --- Kronleuchter: Prismenkränze drehen sich ---
      for (const r of kron) {
        const p = teile[r.teil];
        const el = p.m.elements;
        const x = el[12];
        const y = el[13];
        const z = el[14];
        lage(r.teil, x, y, z, time * r.w, 0, 0);
        setzeTeil(p, time);
      }
      // --- Lichtflecken ---
      for (let k = 0; k < NL; k++) {
        let x: number;
        let y: number;
        let z: number;
        let size = spSz[k] * (0.85 + 0.15 * Math.sin(time * 0.7 + spA[k]));
        let wand = false;
        if (k < NBODEN) {
          if (k % 2 === 0) {
            // in der Kehre unter dem Leuchter
            const a = spA[k] + time * spW[k] * (k % 4 === 0 ? 1 : -1);
            const rr = (KR - 1.4 - size) * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 0.23 + spR[k] * 6)));
            x = KX + Math.cos(a) * rr;
            z = KZ + Math.sin(a) * rr;
          } else {
            // den Mittelstreifen entlang nach Norden
            const f = 0.5 + 0.5 * Math.sin(time * spW[k] * 0.35 + spA[k]);
            x = KX + (k % 4 === 1 ? 1 : -1) * (2.2 + 2.6 * (0.5 + 0.5 * Math.sin(time * 0.31 + spR[k] * 9)));
            z = KZ - KR - 2 - f * 48;
          }
          y = kGround;
        } else {
          // auf den Spiegeln des Mittelstreifens
          wand = true;
          const f = 0.5 + 0.5 * Math.sin(time * spW[k] * 0.3 + spA[k]);
          x = 129 + (k % 2 === 0 ? 0.42 : -0.42);
          z = -8 - f * 70;
          y = ground(129, -40) + 2.5 + 4.2 * (0.5 + 0.5 * Math.sin(time * 0.27 + spR[k] * 7));
          size *= 1.2;
        }
        // Nie auf der Fahrbahn: zur Bande hin weich ausblenden.
        const fr = frei(x, z);
        size *= smooth((fr - size - 0.3) / 1.2);
        if (wand) {
          e.set(0, Math.PI / 2, 0);
        } else e.set(-Math.PI / 2, 0, 0);
        q.setFromEuler(e);
        m4.compose(v.set(x, y, z), q, sv.set(size, size, size));
        spots.setMatrixAt(k, m4);
      }
      spots.instanceMatrix.needsUpdate = true;

      // --- Fontänen ---
      for (let k = 0; k < strahlen.length; k++) {
        const s = strahlen[k];
        const h = s.h * (0.88 + 0.12 * Math.sin(time * 1.3 + s.ph) + 0.04 * Math.sin(time * 3.1 + s.ph * 2));
        lage(s.saeule, s.x, s.y, s.z, s.yaw, s.tilt, 0, 1, h, 1);
        setzeTeil(teile[s.saeule], time);
        const tx = s.x + Math.sin(s.yaw) * Math.sin(s.tilt) * h;
        const ty = s.y + Math.cos(s.tilt) * h;
        const tz = s.z + Math.cos(s.yaw) * Math.sin(s.tilt) * h;
        const sc = s.gross ? 1 + 0.15 * Math.sin(time * 2.2 + s.ph) : 0.5;
        lage(s.krone, tx, ty, tz, time * 0.4, 0, 0, sc, sc, sc);
        setzeTeil(teile[s.krone], time);
        // Tropfen in Sichtweite
        if (s.gross && Math.abs(s.x - cam.x) + Math.abs(s.z - cam.z) < 150) {
          strahlT[k] -= dt;
          while (strahlT[k] <= 0) {
            strahlT[k] += 0.11;
            const a = rnd() * Math.PI * 2;
            const sp = 1.6 + rnd() * 1.4;
            fx.puff(tx, ty, tz, Math.cos(a) * sp, 1.5 + rnd() * 2, Math.sin(a) * sp, 1.3, 0.5 + rnd() * 0.4, 0xf4fbff, 0.2, 9);
          }
        }
      }

      // --- Fahnen ---
      for (const id of fahnen) setzeTeil(teile[id], time);

      // --- Winkende Arme ---
      for (const a of arme) {
        let ang: number;
        if (a.mode === 0) {
          const env = smooth((Math.sin(time * 0.45 + a.ph) - 0.1) * 2.5);
          ang = 0.18 + env * 2.3 + env * 0.35 * Math.sin(time * 6 + a.ph);
        } else {
          // Dirigent: Taktschlag
          ang = 1.3 + 0.45 * Math.sin(time * 4.2);
        }
        lage(a.teil, a.x, a.y, a.z, a.yaw, 0, a.side * ang);
        setzeTeil(teile[a.teil], time);
      }

      // --- Tauben: picken auf dem Platz, fliegen alle halbe Minute eine Runde ---
      for (let k = 0; k < tauben.length; k++) {
        const d = tauben[k];
        const T = 30;
        const f = (((time + d.off) / T) % 1 + 1) % 1;
        const g = ground(d.hx, d.hz) + 0.18;
        let x = d.hx;
        let z = d.hz;
        let y = g;
        let yaw = k * 1.7 + Math.floor(time * 0.5 + k) * 0.9;
        let pitch = 0.25 * Math.max(0, Math.sin(time * 5 + k * 3));
        let flap = 0.15;
        if (f > 0.66) {
          const u = (f - 0.66) / 0.34;
          const h0 = Math.atan2(d.hz - TCZ, d.hx - TCX);
          const r0 = Math.hypot(d.hx - TCX, d.hz - TCZ);
          const a = h0 + u * Math.PI * 2;
          const r = r0 + 9 * Math.sin(Math.PI * u);
          x = TCX + Math.cos(a) * r;
          z = TCZ + Math.sin(a) * r;
          y = g + 15 * Math.pow(Math.sin(Math.PI * u), 0.6);
          yaw = Math.atan2(-Math.sin(a), Math.cos(a));
          pitch = -0.3 * Math.cos(Math.PI * u);
          flap = 0.15 + 0.85 * Math.abs(Math.sin(time * 15 + k));
        }
        lage(d.body, x, y, z, yaw, pitch, 0, 1.8, 1.8, 1.8);
        setzeTeil(teile[d.body], time);
        lage(d.wr, x, y + 0.08, z, yaw, pitch, -flap + 0.1, 1.8, 1.8, 1.8);
        setzeTeil(teile[d.wr], time);
        lage(d.wl, x, y + 0.08, z, yaw, pitch, flap - 0.1, 1.8, 1.8, 1.8);
        setzeTeil(teile[d.wl], time);
      }

      // --- Ballon ---
      if (ballon >= 0) {
        const a = time * 0.012 + 1.1;
        const bx = world.center.x + Math.cos(a) * 110;
        const bz = world.center.z + Math.sin(a) * 90;
        const by = ballonAlt + 6 * Math.sin(time * 0.07);
        lage(ballon, bx, by, bz, time * 0.03, Math.sin(time * 0.5) * 0.03, Math.sin(time * 0.37) * 0.03, 1.7, 1.7, 1.7);
        setzeTeil(teile[ballon], time);
        brenner -= dt;
        if (brenner <= 0) {
          brenner = 5 + rnd() * 6;
          for (let k = 0; k < 4; k++) fx.spark(bx, by + 3.4 * 1.7, bz, (rnd() - 0.5) * 0.6, 3 + rnd() * 2, (rnd() - 0.5) * 0.6, 0.45, 1.0, 0xffc860, -3);
        }
      }

      dPos.needsUpdate = true;
      dNor.needsUpdate = true;
      if (dON) dON.needsUpdate = true;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
