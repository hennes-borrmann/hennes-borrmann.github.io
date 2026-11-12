// Kulisse des Riesenkinderzimmers: Die Karts sind Spielzeugautos, das Zimmer ist die Welt.
//
// Vier Tapetenwände weit draußen, ein Fenster mit Vorhängen, durch das ein Lichtstrahl
// auf den Boden fällt, eine angelehnte Tür mit Flurlicht (und einer Katze, die
// hereinschaut), Holzdielen, ein bunter Spielteppich unter Start und Ziel, das Bett über
// dem Tunnel, ein Bücherregal vor einem Wandvorsprung (in dessen Fuß das Mauseloch
// verläuft), Bücherstapel an der Rampe, der Schreibtisch mit Stiften, Heft und Lampe,
// ein Sitzsack neben der Landung. Bewegt: Zuschauerfiguren, Aufziehroboter,
// Aufzieh-Lok auf ihrem Holzgleis, ein rollender Ball, das Mobile über dem Bett,
// Vorhänge, Staub im Lichtstrahl (nur hohe Qualität) und die Katze.
//
// Zeichenaufrufe: Möbel mit Kontur (2), Flächen ohne Kontur (1), Aufgemaltes mit
// Tiefenversatz (1), Tapete ungeleuchtet (1), Licht additiv (1), Bewegtes mit Kontur (2),
// Staub (1, nur hoch). Bewegtes ist EIN Netz, dessen Ecken je Bild aus Teilen mit eigener
// Matrix neu gesetzt werden (wie die Förderbänder im Werkshof).
//
// Reine Kulisse: alles hält mindestens 3 m Abstand zur Bande (zur Bauklotz-Burg 8 m),
// über der Fahrbahn hängt nichts unter 10 m (außer dem Bett über seinem Tunnel).

import * as THREE from 'three';
import { EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

// --- Das Zimmer ---------------------------------------------------------------------------
/** Innenseiten der Wände (x nach Osten, z nach Süden). */
const X0 = -276;
const X1 = 270;
const Z0 = -272;
const Z1 = 270;
/** Höhe der Wände – darüber ist der „Himmel“ die Zimmerdecke. */
const WALL_H = 330;
/** Fenster in der Nordwand. */
const WX0 = 10;
const WX1 = 130;
const WY0 = 110;
const WY1 = 270;
/** Fensterkreuz. */
const WXM = 70;
const WYM = 205;
/** Tür in der Westwand (Angel im Süden), einen Spalt offen. */
const DZ0 = 70;
const DZ1 = 170;
const DH = 215;
const DOOR_OPEN = 0.42;
/** Spielteppich. */
const RX0 = -262;
const RX1 = 236;
const RZ0 = -262;
const RZ1 = -70;
const RUG_Y = 1.9;
/** Schreibtischplatte. */
const TX0 = -206;
const TX1 = -70;
const TZ0 = -126;
const TZ1 = 46;
const TABLE_Y = 9.7;
const TABLE_D = 1.6;
/** Wandvorsprung mit dem Mauseloch im Fuß (die Abkürzung läuft darunter durch). */
const PX0 = -40;
const PX1 = 90;
const PZ0 = 118;
const PZ1 = 172;
const ARCH_Z = 145;
const ARCH_R = 22;
const ARCH_Y = 4;
/** Bett. */
const BX0 = 181;
const BX1 = 259;
const BZ0 = -90;
const BZ1 = 38;
/** Aufzieh-Lok: Mitte und Halbmesser des Holzgleises. */
const TRAIN_X = 40;
const TRAIN_Z = -110;
const TRAIN_R = 28;

type Cols6 = [RGB, RGB, RGB, RGB, RGB, RGB];

export function buildZimmerLife(world: World): Life {
  const t = world.track;
  const detail = world.detail;
  const hi = detail > 0;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(1600 + t.index * 31);

  // --- Abstand zur Strecke ----------------------------------------------------------------
  // Wie world.clearance(), aber die Abzweigung durch die Bauklotz-Burg zählt 5 m breiter:
  // Dort baut ein anderer Teil, und 8 m beidseits bleiben frei.
  const burg = t.branches.length > 1 ? t.branches[1] : null;
  // Schnell: Abschnitte in Fächern von CELL Metern, gesucht wird ringweise nach außen.
  const CELL = 24;
  const sub = new Float32Array(t.total);
  let maxSub = 0;
  let bx0 = Infinity;
  let bz0 = Infinity;
  let bx1 = -Infinity;
  let bz1 = -Infinity;
  for (let k = 0; k < t.total; k++) {
    sub[k] = t.wh[k] + (t.edge[k] & EDGE_TUNNEL ? 7 : 0) + (burg && k >= burg.first && k < burg.first + burg.count ? 5 : 0);
    maxSub = Math.max(maxSub, sub[k]);
    bx0 = Math.min(bx0, t.px[k]);
    bz0 = Math.min(bz0, t.pz[k]);
    bx1 = Math.max(bx1, t.px[k]);
    bz1 = Math.max(bz1, t.pz[k]);
  }
  const bnx = Math.floor((bx1 - bx0) / CELL) + 1;
  const bnz = Math.floor((bz1 - bz0) / CELL) + 1;
  const buckets: number[][] = [];
  for (let k = 0; k < bnx * bnz; k++) buckets.push([]);
  for (let k = 0; k < t.total; k += 2) buckets[Math.floor((t.pz[k] - bz0) / CELL) * bnx + Math.floor((t.px[k] - bx0) / CELL)].push(k);
  const clr = (x: number, z: number): number => {
    const cx = Math.floor((x - bx0) / CELL);
    const cz = Math.floor((z - bz0) / CELL);
    let best = Infinity;
    // Abstand vom Punkt zum Fächerraster (außerhalb beginnt die Suche weiter draußen)
    const ox = Math.max(0, -cx, cx - (bnx - 1));
    const oz = Math.max(0, -cz, cz - (bnz - 1));
    const r0 = Math.max(ox, oz);
    const rMax = Math.max(bnx, bnz) + r0;
    for (let r = r0; r <= rMax; r++) {
      for (let iz = cz - r; iz <= cz + r; iz++) {
        if (iz < 0 || iz >= bnz) continue;
        const edgeRow = iz === cz - r || iz === cz + r;
        for (let ix = cx - r; ix <= cx + r; ix += edgeRow ? 1 : 2 * r || 1) {
          if (ix < 0 || ix >= bnx) continue;
          const list = buckets[iz * bnx + ix];
          for (let n = 0; n < list.length; n++) {
            const k = list[n];
            const dx = x - t.px[k];
            const dz = z - t.pz[k];
            const d = Math.sqrt(dx * dx + dz * dz) - sub[k];
            if (d < best) best = d;
          }
        }
      }
      // Alles in weiteren Ringen liegt mindestens r·CELL entfernt.
      if (best <= r * CELL - maxSub) break;
    }
    return best;
  };
  /** Frei für einen Körper mit Halbmesser r um (x, z)? */
  const free = (x: number, z: number, r: number): boolean => clr(x, z) >= 3 + r;
  /** Rechteck (gedreht) frei? Prüft Ecken, Kantenmitten und Mitte. */
  const freeRect = (cx: number, cz: number, sx: number, sz: number, rot: number, margin = 0): boolean => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const lx = (i / 2) * (sx / 2);
        const lz = (j / 2) * (sz / 2);
        if (!free(cx + lx * c + lz * s, cz - lx * s + lz * c, margin)) return false;
      }
    }
    return true;
  };

  const inRug = (x: number, z: number): boolean => x > RX0 && x < RX1 && z > RZ0 && z < RZ1;
  // Fernab der Fahrbahn liegt der Boden flach (unter 0,3 m): dort ohne die teure Höhenabfrage.
  const rugTop = (x: number, z: number): number => (clr(x, z) > 27 ? RUG_Y : Math.max(RUG_Y, world.heightAt(x, z) + 0.35));
  /** Wo etwas auf dem Boden steht: Teppich oder Dielen. */
  const ground = (x: number, z: number): number => (inRug(x, z) && clr(x, z) > -0.5 ? rugTop(x, z) : world.heightAt(x, z));

  // --- Farben ------------------------------------------------------------------------------
  const C = {
    white: rgb(0xfbf7ee),
    cream: rgb(0xf3e9d2),
    page: rgb(0xece0c2),
    ink: rgb(0x2a2430),
    wood: rgb(0xc8955c),
    woodD: rgb(0x8f6338),
    woodL: rgb(0xe2bd86),
    red: rgb(0xd9483b),
    redD: rgb(0xa8352d),
    yellow: rgb(0xf2c94c),
    green: rgb(0x5fae55),
    greenD: rgb(0x3f8a45),
    mint: rgb(0x9fdcb8),
    violet: rgb(0x8f63c0),
    lilac: rgb(0xc4aee6),
    pink: rgb(0xf2a0b4),
    rose: rgb(0xe08a8a),
    teal: rgb(0x6cc4b8),
    grey: rgb(0x9c99a4),
    greyD: rgb(0x6e6b78),
    skin: rgb(0xf3d7b0),
  };
  const bookCols: RGB[] = [C.red, C.green, C.violet, C.yellow, C.teal, rgb(0xb5543c), rgb(0x5a7a3a), C.lilac, rgb(0xe6d3a3), rgb(0x7a3f62), C.pink, rgb(0x3f6f5f)];
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length) % a.length];

  // --- Werkzeug ----------------------------------------------------------------------------
  const tm = new THREE.Matrix4();
  const tq = new THREE.Quaternion();
  const te = new THREE.Euler(0, 0, 0, 'YXZ');
  const tp = new THREE.Vector3();
  const ts = new THREE.Vector3();
  /** Matrix aus Lage, Drehung (Gieren, Nicken, Rollen) und Maßstab. */
  const mat = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 => {
    te.set(rx, ry, rz, 'YXZ');
    tq.setFromEuler(te);
    tp.set(x, y, z);
    ts.set(sx, sy, sz);
    return tm.compose(tp, tq, ts);
  };
  const geoCache = new Map<string, THREE.BufferGeometry>();
  const cyl = (rt: number, rb: number, seg: number): THREE.BufferGeometry => {
    const key = `c${rt},${rb},${seg}`;
    let g = geoCache.get(key);
    if (!g) geoCache.set(key, (g = new THREE.CylinderGeometry(rt, rb, 1, seg)));
    return g;
  };
  const ball = (d: number): THREE.BufferGeometry => {
    const key = `i${d}`;
    let g = geoCache.get(key);
    if (!g) geoCache.set(key, (g = new THREE.IcosahedronGeometry(1, d)));
    return g;
  };
  const cube = (): THREE.BufferGeometry => {
    let g = geoCache.get('b');
    if (!g) geoCache.set('b', (g = new THREE.BoxGeometry(1, 1, 1)));
    return g;
  };
  const SEG = hi ? 10 : 6;
  const SEG_S = hi ? 8 : 5;

  /** Quader mit eigener Farbe je Seite (+x, −x, oben, unten, +z, −z) unter beliebiger Matrix. */
  const cuboid = (b: MeshBuilder, m: THREE.Matrix4, sx: number, sy: number, sz: number, c: Cols6): void => {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const v: V3[] = [];
    const corners = [
      [-hx, -hy, -hz],
      [hx, -hy, -hz],
      [hx, hy, -hz],
      [-hx, hy, -hz],
      [-hx, -hy, hz],
      [hx, -hy, hz],
      [hx, hy, hz],
      [-hx, hy, hz],
    ];
    for (const p of corners) {
      tp.set(p[0], p[1], p[2]).applyMatrix4(m);
      v.push([tp.x, tp.y, tp.z]);
    }
    b.quad(v[5], v[1], v[2], v[6], c[0]);
    b.quad(v[0], v[4], v[7], v[3], c[1]);
    b.quad(v[7], v[6], v[2], v[3], c[2]);
    b.quad(v[0], v[1], v[5], v[4], c[3]);
    b.quad(v[4], v[5], v[6], v[7], c[4]);
    b.quad(v[1], v[0], v[3], v[2], c[5]);
  };
  const box = (b: MeshBuilder, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: RGB, ry = 0, top?: RGB): void => {
    const s = shade(c, 0.9);
    cuboid(b, mat(x, y, z, ry), sx, sy, sz, [c, s, top ?? c, s, c, s]);
  };
  /** Dreieck mit Blickseite in Richtung n. */
  const triFacing = (b: MeshBuilder, a: V3, c1: V3, c2: V3, n: V3, col: RGB): void => {
    const ux = c1[0] - a[0];
    const uy = c1[1] - a[1];
    const uz = c1[2] - a[2];
    const vx = c2[0] - a[0];
    const vy = c2[1] - a[1];
    const vz = c2[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * n[0] + ny * n[1] + nz * n[2] >= 0) b.tri(a, c1, c2, col);
    else b.tri(a, c2, c1, col);
  };
  const quadFacing = (b: MeshBuilder, a: V3, c1: V3, c2: V3, d: V3, n: V3, col: RGB): void => {
    triFacing(b, a, c1, c2, n, col);
    triFacing(b, a, c2, d, n, col);
  };
  /** Flache Form (Umriss in x/y) mit Dicke th in z, Mitte im Ursprung. */
  const slab = (b: MeshBuilder, pts: [number, number][], th: number, front: RGB, edge: RGB, m: THREE.Matrix4): void => {
    const P = (x: number, y: number, z: number): V3 => {
      tp.set(x, y, z).applyMatrix4(m);
      return [tp.x, tp.y, tp.z];
    };
    const n = pts.length;
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p[0] / n;
      cy += p[1] / n;
    }
    const nf = new THREE.Vector3(0, 0, 1).transformDirection(m);
    const nfv: V3 = [nf.x, nf.y, nf.z];
    const nbv: V3 = [-nf.x, -nf.y, -nf.z];
    for (let k = 0; k < n; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % n];
      triFacing(b, P(cx, cy, th / 2), P(p[0], p[1], th / 2), P(q[0], q[1], th / 2), nfv, front);
      triFacing(b, P(cx, cy, -th / 2), P(p[0], p[1], -th / 2), P(q[0], q[1], -th / 2), nbv, shade(front, 0.85));
      const ex = q[1] - p[1];
      const ey = -(q[0] - p[0]);
      const sgn = (p[0] - cx) * ex + (p[1] - cy) * ey >= 0 ? 1 : -1;
      const o = new THREE.Vector3(ex * sgn, ey * sgn, 0).transformDirection(m);
      quadFacing(b, P(p[0], p[1], th / 2), P(q[0], q[1], th / 2), P(q[0], q[1], -th / 2), P(p[0], p[1], -th / 2), [o.x, o.y, o.z], edge);
    }
  };
  const star = (r0: number, r1: number, n: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let k = 0; k < n * 2; k++) {
      const a = (k / (n * 2)) * Math.PI * 2 + Math.PI / 2;
      const r = k % 2 === 0 ? r0 : r1;
      out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
  };
  const circle = (r: number, n: number, sx = 1, sy = 1): [number, number][] => {
    const out: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      out.push([Math.cos(a) * r * sx, Math.sin(a) * r * sy]);
    }
    return out;
  };

  /**
   * Fläche, die ein Feld g(x, z) ≥ 0 ausfüllt (Dreiecke werden an g = 0 abgeschnitten).
   * Oberseite in top, Kanten nach unten (depth) in side, Unterseite optional.
   */
  const fieldSurface = (
    top: MeshBuilder,
    side: MeshBuilder | null,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    cell: number,
    g: (x: number, z: number) => number,
    yf: (x: number, z: number) => number,
    colf: (x: number, z: number) => RGB,
    depth: number,
    sideCol: RGB,
    under: RGB | null,
  ): void => {
    const nx = Math.ceil((x1 - x0) / cell) + 2;
    const nz = Math.ceil((z1 - z0) / cell) + 2;
    const gx = (i: number): number => x0 - cell + i * cell;
    const gz = (j: number): number => z0 - cell + j * cell;
    const G = new Float32Array((nx + 1) * (nz + 1));
    const Y = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const v = g(gx(i), gz(j));
        G[j * (nx + 1) + i] = v;
        // Höhe nur, wo die Fläche hinreicht (die Höhenfunktion kann teuer sein)
        Y[j * (nx + 1) + i] = v > -cell * 1.5 ? yf(gx(i), gz(j)) : 0;
      }
    }
    const px: number[] = [];
    const pz: number[] = [];
    const pg: number[] = [];
    const up: V3 = [0, 1, 0];
    const down: V3 = [0, -1, 0];
    const ys: number[] = [];
    const clipTri = (ax: number, az: number, ag: number, ay: number, bx: number, bz: number, bg: number, by: number, cx: number, cz: number, cg: number, cy: number): void => {
      if (ag < 0 && bg < 0 && cg < 0) return;
      px.length = 0;
      pz.length = 0;
      pg.length = 0;
      ys.length = 0;
      const vx = [ax, bx, cx];
      const vz = [az, bz, cz];
      const vg = [ag, bg, cg];
      const vy = [ay, by, cy];
      const iso: number[] = [];
      for (let k = 0; k < 3; k++) {
        const q = (k + 1) % 3;
        if (vg[k] >= 0) {
          px.push(vx[k]);
          pz.push(vz[k]);
          pg.push(vg[k]);
          ys.push(vy[k]);
        }
        if (vg[k] >= 0 !== vg[q] >= 0) {
          const f = vg[k] / (vg[k] - vg[q]);
          const x = vx[k] + (vx[q] - vx[k]) * f;
          const z = vz[k] + (vz[q] - vz[k]) * f;
          px.push(x);
          pz.push(z);
          pg.push(0);
          ys.push(yf(x, z));
          iso.push(x, z);
        }
      }
      if (px.length < 3) return;
      const n = px.length;
      let mx = 0;
      let mz = 0;
      for (let k = 0; k < n; k++) {
        mx += px[k] / n;
        mz += pz[k] / n;
      }
      const col = colf(mx, mz);
      for (let k = 1; k < n - 1; k++) {
        triFacing(top, [px[0], ys[0], pz[0]], [px[k], ys[k], pz[k]], [px[k + 1], ys[k + 1], pz[k + 1]], up, col);
        if (under) triFacing(top, [px[0], ys[0] - depth, pz[0]], [px[k], ys[k] - depth, pz[k]], [px[k + 1], ys[k + 1] - depth, pz[k + 1]], down, under);
      }
      if (side && iso.length === 4) {
        // Nach außen: zur Seite der abgeschnittenen Ecke(n).
        let ox = 0;
        let oz = 0;
        for (let k = 0; k < 3; k++) {
          if (vg[k] < 0) {
            ox += vx[k] - (iso[0] + iso[2]) / 2;
            oz += vz[k] - (iso[1] + iso[3]) / 2;
          }
        }
        const ya = ys[px.indexOf(iso[0])];
        const yb = ys[px.indexOf(iso[2])];
        quadFacing(side, [iso[0], ya, iso[1]], [iso[2], yb, iso[3]], [iso[2], yb - depth, iso[3]], [iso[0], ya - depth, iso[1]], [ox, 0, oz], sideCol);
      }
    };
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const ax = gx(i);
        const az = gz(j);
        const bx = gx(i + 1);
        const bz = gz(j + 1);
        clipTri(ax, az, G[a], Y[a], bx, az, G[a + 1], Y[a + 1], bx, bz, G[a + nx + 2], Y[a + nx + 2]);
        clipTri(ax, az, G[a], Y[a], bx, bz, G[a + nx + 2], Y[a + nx + 2], ax, bz, G[a + nx + 1], Y[a + nx + 1]);
      }
    }
  };

  // Die Netze der Kulisse
  const solid = new MeshBuilder(); // Möbel und Spielzeug, mit Kontur
  const flat = new MeshBuilder(); // große Flächen ohne Kontur (Teppich, Tischplatte)
  const paint = new MeshBuilder(); // Aufgemaltes (Teppichdruck, Dielenfugen) mit Tiefenversatz
  const paper = new MeshBuilder(); // Tapete und Fensterblick, ungeleuchtet
  // Licht: eigene Felder, weil die Farbe je Ecke verläuft (additiv, Schwarz = unsichtbar)
  const lightPos: number[] = [];
  const lightCol: number[] = [];
  const light = (a: V3, b: V3, c: V3, ka: number, kb: number, kc: number, col: RGB): void => {
    lightPos.push(...a, ...b, ...c);
    lightCol.push(col[0] * ka, col[1] * ka, col[2] * ka, col[0] * kb, col[1] * kb, col[2] * kb, col[0] * kc, col[1] * kc, col[2] * kc);
  };
  const lightQuad = (a: V3, b: V3, c: V3, d: V3, ka: number, kb: number, kc: number, kd: number, col: RGB): void => {
    light(a, b, c, ka, kb, kc, col);
    light(a, c, d, ka, kc, kd, col);
  };
  const SUN_LIGHT = rgb(0xfff0c8);

  // =========================================================================================
  // Wände mit Tapete
  // =========================================================================================
  {
    const stripeA = rgb(0xf4e2b0);
    const stripeB = rgb(0xf9efd3);
    const motif = [rgb(0xf0a8b8), rgb(0x9fd6b4), rgb(0xc4b0e6), rgb(0xf2c46a)];
    const frieze = rgb(0xc85f7c);
    const friezeB = rgb(0x8fcca6);
    // Je Wand: Ursprung, Richtung längs (u), Normale ins Zimmer, Länge, Helligkeit.
    const walls: { ox: number; oz: number; ux: number; uz: number; nx: number; nz: number; len: number; k: number }[] = [
      { ox: X0, oz: Z0, ux: 1, uz: 0, nx: 0, nz: 1, len: X1 - X0, k: 0.88 }, // Nord (Fensterwand, im Gegenlicht)
      { ox: X1, oz: Z1, ux: -1, uz: 0, nx: 0, nz: -1, len: X1 - X0, k: 1.0 }, // Süd
      { ox: X0, oz: Z1, ux: 0, uz: -1, nx: 1, nz: 0, len: Z1 - Z0, k: 0.94 }, // West (Tür)
      { ox: X1, oz: Z0, ux: 0, uz: 1, nx: -1, nz: 0, len: Z1 - Z0, k: 0.97 }, // Ost (Bett)
    ];
    const holeOf = (w: number): [number, number, number, number] | null => {
      if (w === 0) return [WX0 - X0, WX1 - X0, WY0, WY1];
      if (w === 2) return [Z1 - DZ1, Z1 - DZ0, -10, DH];
      return null;
    };
    for (let w = 0; w < 4; w++) {
      const W = walls[w];
      const P = (u: number, y: number, off = 0): V3 => [W.ox + W.ux * u + W.nx * off, y, W.oz + W.uz * u + W.nz * off];
      const n: V3 = [W.nx, 0, W.nz];
      const hole = holeOf(w);
      /** Rechteck auf der Wand, um das Loch herum zerlegt. */
      const rect = (u0: number, u1: number, y0: number, y1: number, col: RGB, off = 0): void => {
        const parts: [number, number, number, number][] = [];
        if (hole && u1 > hole[0] && u0 < hole[1] && y1 > hole[2] && y0 < hole[3]) {
          if (u0 < hole[0]) parts.push([u0, hole[0], y0, y1]);
          if (u1 > hole[1]) parts.push([hole[1], u1, y0, y1]);
          const a = Math.max(u0, hole[0]);
          const b = Math.min(u1, hole[1]);
          if (y0 < hole[2]) parts.push([a, b, y0, hole[2]]);
          if (y1 > hole[3]) parts.push([a, b, hole[3], y1]);
        } else parts.push([u0, u1, y0, y1]);
        for (const p of parts) quadFacing(paper, P(p[0], p[2], off), P(p[1], p[2], off), P(p[1], p[3], off), P(p[0], p[3], off), n, col);
      };
      const SW = 12;
      const ns = Math.ceil(W.len / SW);
      for (let s = 0; s < ns; s++) {
        const u0 = s * SW;
        const u1 = Math.min(W.len, u0 + SW);
        const light2 = s % 2 === 0;
        rect(u0, u1, -2, WALL_H, shade(light2 ? stripeB : stripeA, W.k));
        // Rauten auf den hellen Streifen
        if (light2 && hi) {
          for (let r = 0; r * 30 + 40 < WALL_H - 10; r++) {
            const y = 40 + r * 30 + (s % 4 === 0 ? 15 : 0);
            if (y > 112 && y < 140) continue;
            const u = u0 + SW / 2;
            if (hole && u > hole[0] - 3 && u < hole[1] + 3 && y > hole[2] - 4 && y < hole[3] + 4) continue;
            const c = shade(motif[(s / 2 + r) % 4], W.k);
            quadFacing(paper, P(u, y - 3.2, 0.8), P(u + 2.2, y, 0.8), P(u, y + 3.2, 0.8), P(u - 2.2, y, 0.8), n, c);
          }
        }
        // Bordüre mit Zacken
        rect(u0, u1, 128, 136, shade(frieze, W.k), 0.6);
        if (!(hole && u1 > hole[0] && u0 < hole[1] && hole[3] > 120 && hole[2] < 136)) {
          triFacing(paper, P(u0 + 1, 128, 0.7), P(u1 - 1, 128, 0.7), P((u0 + u1) / 2, 121, 0.7), n, shade(s % 2 ? friezeB : C.yellow, W.k));
        }
      }
      // Fußleiste (mit Kontur): weiß, oben eine kleine Kante
      const segsB: [number, number][] = [];
      if (w === 2) {
        segsB.push([0, Z1 - DZ1 - 6], [Z1 - DZ0 + 6, W.len]);
      } else segsB.push([0, W.len]);
      for (const [a, b2] of segsB) {
        const mid = P((a + b2) / 2, 0, 1.6);
        const along = Math.abs(W.ux) > 0;
        box(solid, mid[0], 6, mid[2], along ? b2 - a : 3.2, 12, along ? 3.2 : b2 - a, C.white);
        const lip = P((a + b2) / 2, 0, 2.0);
        box(solid, lip[0], 12.8, lip[2], along ? b2 - a : 4, 1.6, along ? 4 : b2 - a, rgb(0xe8e0d0));
      }
    }

    // --- Fenster (Nordwand) ---
    {
      const zw = Z0;
      // Blick nach draußen: Himmel in Stufen, eine Wolke, eine Baumkrone.
      const sky = [rgb(0xa9d4ea), rgb(0xbcdeee), rgb(0xcfe7f0), rgb(0xe2f0f0)];
      const n: V3 = [0, 0, 1];
      for (let k = 0; k < 4; k++) {
        const y1 = WY1 - ((WY1 - WY0) * k) / 4;
        const y0 = WY1 - ((WY1 - WY0) * (k + 1)) / 4;
        quadFacing(paper, [WX0, y0, zw - 6], [WX1, y0, zw - 6], [WX1, y1, zw - 6], [WX0, y1, zw - 6], n, sky[k]);
      }
      const blob = (cx: number, cy: number, rx: number, ry: number, col: RGB): void => {
        const N = 12;
        for (let k = 0; k < N; k++) {
          const a0 = (k / N) * Math.PI * 2;
          const a1 = ((k + 1) / N) * Math.PI * 2;
          const q = (a: number): V3 => [Math.max(WX0, Math.min(WX1, cx + Math.cos(a) * rx)), Math.max(WY0, Math.min(WY1, cy + Math.sin(a) * ry)), zw - 5];
          triFacing(paper, [Math.max(WX0, Math.min(WX1, cx)), Math.max(WY0, Math.min(WY1, cy)), zw - 5], q(a0), q(a1), n, col);
        }
      };
      blob(45, 240, 18, 8, rgb(0xffffff));
      blob(58, 246, 14, 9, rgb(0xffffff));
      blob(108, 226, 12, 6, rgb(0xf6fbfb));
      blob(118, 128, 26, 24, rgb(0x7fbf6a));
      blob(96, 118, 20, 16, rgb(0x8ccc74));
      blob(126, 150, 14, 14, rgb(0x6fae5e));
      // Rahmen, Kreuz, Fensterbank
      const fc = C.white;
      box(solid, (WX0 + WX1) / 2, WY1 + 3, zw + 1.5, WX1 - WX0 + 12, 6, 3, fc);
      box(solid, (WX0 + WX1) / 2, WY0 - 3, zw + 1.5, WX1 - WX0 + 12, 6, 3, fc);
      box(solid, WX0 - 3, (WY0 + WY1) / 2, zw + 1.5, 6, WY1 - WY0, 3, fc);
      box(solid, WX1 + 3, (WY0 + WY1) / 2, zw + 1.5, 6, WY1 - WY0, 3, fc);
      box(solid, WXM, (WY0 + WY1) / 2, zw - 2, 4, WY1 - WY0, 3, fc);
      box(solid, (WX0 + WX1) / 2, WYM, zw - 2, WX1 - WX0, 4, 3, fc);
      box(solid, (WX0 + WX1) / 2, WY0 - 8, zw + 6, WX1 - WX0 + 22, 4, 12, rgb(0xeee6d6));
      // Fensterlaibung (Tiefe der Wand)
      quadFacing(paper, [WX0, WY0, zw], [WX1, WY0, zw], [WX1, WY0, zw - 6], [WX0, WY0, zw - 6], [0, 1, 0], rgb(0xe6dcc6));
      quadFacing(paper, [WX0, WY1, zw], [WX1, WY1, zw], [WX1, WY1, zw - 6], [WX0, WY1, zw - 6], [0, -1, 0], rgb(0xcfc3aa));
      quadFacing(paper, [WX0, WY0, zw], [WX0, WY1, zw], [WX0, WY1, zw - 6], [WX0, WY0, zw - 6], [1, 0, 0], rgb(0xd8ccb2));
      quadFacing(paper, [WX1, WY0, zw], [WX1, WY1, zw], [WX1, WY1, zw - 6], [WX1, WY0, zw - 6], [-1, 0, 0], rgb(0xd8ccb2));
      // Gardinenstange
      solid.add(cyl(1.2, 1.2, SEG_S), C.woodD, mat((WX0 + WX1) / 2, WY1 + 22, zw + 6, 0, 0, Math.PI / 2, 1, WX1 - WX0 + 96, 1));
      for (const x of [WX0 - 48, WX1 + 48]) solid.add(ball(0), C.woodD, mat(x, WY1 + 22, zw + 6, 0, 0, 0, 3, 3, 3));
    }

    // --- Tür (Westwand), einen Spalt offen, dahinter Flurlicht ---
    {
      const xw = X0;
      // Flur: helle Rückwand und Seitenwände
      const hall = rgb(0xfff2cf);
      quadFacing(paper, [xw - 70, -2, DZ0 - 40], [xw - 70, -2, DZ1 + 40], [xw - 70, DH + 40, DZ1 + 40], [xw - 70, DH + 40, DZ0 - 40], [1, 0, 0], hall);
      quadFacing(paper, [xw, -2, DZ0 - 1], [xw - 70, -2, DZ0 - 40], [xw - 70, DH + 40, DZ0 - 40], [xw, DH + 40, DZ0 - 1], [0, 0, 1], rgb(0xf2dfb6));
      quadFacing(paper, [xw, -2, DZ1 + 1], [xw - 70, -2, DZ1 + 40], [xw - 70, DH + 40, DZ1 + 40], [xw, DH + 40, DZ1 + 1], [0, 0, -1], rgb(0xf2dfb6));
      quadFacing(paper, [xw, DH, DZ0], [xw, DH, DZ1], [xw - 6, DH, DZ1], [xw - 6, DH, DZ0], [0, -1, 0], rgb(0xe8d6b0));
      // Zarge
      box(solid, xw + 1.5, DH / 2, DZ0 - 3, 3, DH + 6, 6, C.white);
      box(solid, xw + 1.5, DH / 2, DZ1 + 3, 3, DH + 6, 6, C.white);
      box(solid, xw + 1.5, DH + 3, (DZ0 + DZ1) / 2, 3, 6, DZ1 - DZ0 + 12, C.white);
      // Türblatt: an der Südkante angeschlagen, ins Zimmer aufgeschwenkt
      const L = DZ1 - DZ0 - 1;
      const hx = xw + 2;
      const hz = DZ1;
      const dx = Math.sin(DOOR_OPEN);
      const dz = -Math.cos(DOOR_OPEN);
      const ry = Math.atan2(dx, dz);
      const at = (s: number, y: number, n: number): THREE.Matrix4 => mat(hx + dx * s + dz * n, y, hz + dz * s - dx * n, ry);
      const door = rgb(0xf6efe0);
      cuboid(solid, at(L / 2, DH / 2, 0), 4, DH - 1, L, [door, door, door, door, shade(door, 0.92), shade(door, 0.92)]);
      for (const [y, h] of [
        [150, 70],
        [55, 80],
      ]) {
        for (const side of [-1, 1]) cuboid(solid, at(L / 2, y, side * 2.4), 1, h, L - 26, [rgb(0xebe1cc), rgb(0xebe1cc), rgb(0xebe1cc), rgb(0xebe1cc), rgb(0xebe1cc), rgb(0xebe1cc)]);
      }
      solid.add(ball(1), C.yellow, at(L - 9, 100, 4.5));
      solid.add(ball(1), C.yellow, at(L - 9, 100, -4.5));
      // Flurlicht fällt durch den Spalt auf den Boden.
      const y = (x: number, z: number): number => world.heightAt(x, z) + 0.2;
      const warm = rgb(0xffe2a8);
      const a: V3 = [xw, y(xw, DZ0), DZ0];
      const bq: V3 = [xw, y(xw, DZ0 + 14), DZ0 + 14];
      const c: V3 = [xw + 95, y(xw + 95, DZ0 + 40), DZ0 + 40];
      const d: V3 = [xw + 85, y(xw + 85, DZ0 - 25), DZ0 - 25];
      lightQuad(a, bq, c, d, 0.42, 0.42, 0.0, 0.0, warm);
      lightQuad([xw - 0.5, 0, DZ0], [xw - 0.5, DH, DZ0], [xw - 0.5, DH, DZ1], [xw - 0.5, 0, DZ1], 0.12, 0.12, 0.12, 0.12, warm);
    }
  }

  // =========================================================================================
  // Boden: Dielenfugen, Spielteppich mit Aufdruck, Lichtfleck vom Fenster
  // =========================================================================================
  // Teppich: Fläche, die nicht unter die Fahrbahn reicht (bis 0,5 m unter die Bande).
  const rugField = (x: number, z: number): number => Math.min(x - RX0, RX1 - x, z - RZ0, RZ1 - z, clr(x, z) + 0.5);
  {
    const base = rgb(0x9ccf6e);
    fieldSurface(
      flat,
      flat,
      RX0,
      RZ0,
      RX1,
      RZ1,
      hi ? 10 : 15,
      rugField,
      rugTop,
      (x, z) => {
        return shade(base, 0.97 + noise(x * 0.02, z * 0.02) * 0.06);
      },
      2.6,
      rgb(0xb8423a),
      null,
    );
  }
  // Aufdruck: Straßen mit Zebrastreifen, Häuschen, Bäume, ein Teich – nur abseits der Fahrbahn.
  // Übereinander gedruckte Farben liegen in Lagen, damit sie nicht flimmern.
  const printY = (x: number, z: number, layer = 0): number => rugTop(x, z) + 0.06 + layer * 0.07;
  const printQuad = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number, col: RGB, layer = 0): void => {
    quadFacing(paint, [ax, printY(ax, az, layer), az], [bx, printY(bx, bz, layer), bz], [cx, printY(cx, cz, layer), cz], [dx, printY(dx, dz, layer), dz], [0, 1, 0], col);
  };
  const printPoly = (cx: number, cz: number, pts: [number, number][], col: RGB, layer = 0): void => {
    const yc = printY(cx, cz, layer);
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % pts.length];
      triFacing(paint, [cx, yc, cz], [cx + p[0], yc, cz + p[1]], [cx + q[0], yc, cz + q[1]], [0, 1, 0], col);
    }
  };
  {
    const street = rgb(0xb9b5ab);
    const dash = rgb(0xfbf7ee);
    const roofs = [C.red, C.violet, rgb(0xe8b43a), rgb(0x7a3f62)];
    const walls2 = [C.cream, rgb(0xf6d6a8), rgb(0xe9e4f2), C.white];
    const okPrint = (x: number, z: number, r: number): boolean => inRug(x, z) && Math.min(x - RX0, RX1 - x, z - RZ0, RZ1 - z) > 9 + r && clr(x, z) > 2 + r;
    const SP = 46;
    const SW2 = 3.6;
    // Straßen längs x und z
    for (const along of [0, 1]) {
      const lines: number[] = [];
      if (along === 0) for (let z = RZ0 + 30; z < RZ1 - 20; z += SP) lines.push(z);
      else for (let x = RX0 + 40; x < RX1 - 20; x += SP) lines.push(x);
      for (const L of lines) {
        const from = along === 0 ? RX0 + 12 : RZ0 + 12;
        const to = along === 0 ? RX1 - 12 : RZ1 - 12;
        const st = 6;
        let runStart = NaN;
        let prevOk = false;
        for (let s = from; s <= to + 0.01; s += st) {
          const x = along === 0 ? s : L;
          const z = along === 0 ? L : s;
          const ok = okPrint(x, z, SW2 + 1) && s < to;
          if (ok && !prevOk) runStart = s;
          if (!ok && prevOk) {
            const s0 = runStart;
            const s1 = s - st;
            if (s1 - s0 >= 12) {
              for (let a = s0; a < s1 - 0.01; a += st) {
                const b = Math.min(s1, a + st);
                if (along === 0) printQuad(a, L - SW2, b, L - SW2, b, L + SW2, a, L + SW2, street);
                else printQuad(L - SW2, a, L + SW2, a, L + SW2, b, L - SW2, b, street, 1);
                if (hi && Math.round(a / st) % 2 === 0) {
                  if (along === 0) printQuad(a + 1, L - 0.3, b - 1, L - 0.3, b - 1, L + 0.3, a + 1, L + 0.3, dash, 2);
                  else printQuad(L - 0.3, a + 1, L + 0.3, a + 1, L + 0.3, b - 1, L - 0.3, b - 1, dash, 2);
                }
              }
              // Zebrastreifen an beiden Enden, wo die Straße an die Fahrbahn stößt.
              for (const [e, dir] of [
                [s0, 1],
                [s1, -1],
              ]) {
                const ex = along === 0 ? e : L;
                const ez = along === 0 ? L : e;
                if (clr(ex, ez) > 14) continue;
                for (let k = 0; k < 5; k++) {
                  const o = -SW2 + 0.4 + k * 1.45;
                  const a = e + dir * 2;
                  const b = e + dir * 6;
                  if (along === 0) printQuad(Math.min(a, b), L + o, Math.max(a, b), L + o, Math.max(a, b), L + o + 0.8, Math.min(a, b), L + o + 0.8, dash, 2);
                  else printQuad(L + o, Math.min(a, b), L + o + 0.8, Math.min(a, b), L + o + 0.8, Math.max(a, b), L + o, Math.max(a, b), dash, 2);
                }
              }
            }
          }
          prevOk = ok;
        }
      }
    }
    // Häuschen, Bäume und Teiche in den Feldern zwischen den Straßen
    for (let bx = RX0 + 40 - SP; bx < RX1; bx += SP) {
      for (let bz = RZ0 + 30 - SP; bz < RZ1; bz += SP) {
        const cx = bx + SP / 2;
        const cz = bz + SP / 2;
        const kind = rnd();
        if (kind < 0.45) {
          // zwei bis vier Häuschen
          const nH = 2 + Math.floor(rnd() * 3);
          for (let h = 0; h < nH; h++) {
            const hx = cx + (h % 2 === 0 ? -9 : 9) + (rnd() - 0.5) * 3;
            const hz = cz + (h < 2 ? -9 : 9) + (rnd() - 0.5) * 3;
            const w = 7 + rnd() * 3;
            const d = 6 + rnd() * 2;
            if (!okPrint(hx, hz, w)) continue;
            const roof = pick(roofs);
            printQuad(hx - w, hz - d - 1.2, hx + w, hz - d - 1.2, hx + w, hz + d + 1.2, hx - w, hz + d + 1.2, pick(walls2));
            printQuad(hx - w + 0.6, hz - d, hx + w - 0.6, hz - d, hx + w - 0.6, hz, hx - w + 0.6, hz, roof, 1);
            printQuad(hx - w + 0.6, hz, hx + w - 0.6, hz, hx + w - 0.6, hz + d, hx - w + 0.6, hz + d, shade(roof, 0.78), 1);
            printQuad(hx + w * 0.4, hz - d * 0.7, hx + w * 0.4 + 2, hz - d * 0.7, hx + w * 0.4 + 2, hz - d * 0.7 + 2, hx + w * 0.4, hz - d * 0.7 + 2, C.ink, 2);
          }
        } else if (kind < 0.8) {
          const nT = 3 + Math.floor(rnd() * 4);
          for (let k = 0; k < nT; k++) {
            const x = cx + (rnd() - 0.5) * 28;
            const z = cz + (rnd() - 0.5) * 28;
            const r = 3.5 + rnd() * 2.5;
            if (!okPrint(x, z, r)) continue;
            printPoly(x, z, circle(r, 8), C.greenD, 1 + (k % 2) * 2);
            if (hi) printPoly(x - r * 0.2, z - r * 0.2, circle(r * 0.6, 8), rgb(0x7cc463), 2 + (k % 2) * 2);
          }
        } else if (kind < 0.9) {
          if (okPrint(cx, cz, 16)) {
            printPoly(cx, cz, circle(15, 14, 1, 0.75), rgb(0xe9f2dc));
            printPoly(cx, cz, circle(13, 14, 1, 0.72), rgb(0x86cfc4), 1);
            printPoly(cx + 4, cz - 2, circle(3, 6, 1, 0.6), rgb(0xd6f0ea), 2);
          }
        } else if (okPrint(cx, cz, 14)) {
          for (let k = -2; k <= 2; k++) printQuad(cx - 14, cz + k * 5 - 1.6, cx + 14, cz + k * 5 - 1.6, cx + 14, cz + k * 5 + 1.6, cx - 14, cz + k * 5 + 1.6, k % 2 === 0 ? rgb(0xe8d36a) : rgb(0xd4c05a));
        }
      }
    }
  }
  // Rand des Teppichs: rote Borte mit hellen Strichen (nur wo keine Fahrbahn darüber läuft).
  {
    const border = rgb(0xd9534a);
    const BW = 7;
    const ST = 10;
    const edgeRun = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number): void => {
      const L = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / L;
      const uz = (bz - az) / L;
      for (let s = 0; s < L - 0.01; s += ST) {
        const s2 = Math.min(L, s + ST);
        const x0 = ax + ux * s;
        const z0 = az + uz * s;
        const x1 = ax + ux * s2;
        const z1 = az + uz * s2;
        if (clr(x0 + nx * BW, z0 + nz * BW) < 1 || clr(x1 + nx * BW, z1 + nz * BW) < 1 || clr(x0, z0) < 1 || clr(x1, z1) < 1) continue;
        printQuad(x0, z0, x1, z1, x1 + nx * BW, z1 + nz * BW, x0 + nx * BW, z0 + nz * BW, border);
        const m0 = s + 2;
        const m1 = s + 6;
        printQuad(ax + ux * m0 + nx * 3.2, az + uz * m0 + nz * 3.2, ax + ux * m1 + nx * 3.2, az + uz * m1 + nz * 3.2, ax + ux * m1 + nx * 3.8, az + uz * m1 + nz * 3.8, ax + ux * m0 + nx * 3.8, az + uz * m0 + nz * 3.8, C.cream, 1);
      }
    };
    edgeRun(RX0, RZ0, RX1, RZ0, 0, 1);
    edgeRun(RX1, RZ1, RX0, RZ1, 0, -1);
    edgeRun(RX0, RZ1, RX0, RZ0, 1, 0);
    edgeRun(RX1, RZ0, RX1, RZ1, -1, 0);
  }
  // Dielenfugen: lange Linien in x-Richtung, Stöße versetzt.
  {
    const fuge = rgb(0x7a5432);
    const BW = hi ? 14 : 36;
    const lineY = (x: number, z: number): number => world.heightAt(x, z) + 0.08;
    const skip = (x: number, z: number): boolean => (x > RX0 - 1 && x < RX1 + 1 && z > RZ0 - 1 && z < RZ1 + 1) || (x > PX0 - 3 && x < PX1 + 3 && z > PZ0 - 3 && z < PZ1 + 3) || clr(x, z) < 1.5;
    const W2 = 0.28;
    for (let z = Z0 + BW; z < Z1 - 2; z += BW) {
      let x = X0 + 4;
      while (x < X1 - 4) {
        const near = clr(x, z) < 40;
        const st = near ? 5 : 15;
        const x2 = Math.min(X1 - 4, x + st);
        if (!skip(x, z) && !skip(x2, z)) {
          quadFacing(paint, [x, lineY(x, z - W2), z - W2], [x2, lineY(x2, z - W2), z - W2], [x2, lineY(x2, z + W2), z + W2], [x, lineY(x, z + W2), z + W2], [0, 1, 0], fuge);
        }
        x = x2;
      }
      // Stöße
      if (!hi) continue;
      const row = Math.round((z - Z0) / BW);
      for (let xs = X0 + ((row * 37) % 70) + 20; xs < X1 - 10; xs += 70) {
        const za = z;
        const zb = Math.min(Z1, z + BW);
        if (skip(xs, za) || skip(xs, zb) || skip(xs, (za + zb) / 2)) continue;
        quadFacing(paint, [xs - W2, lineY(xs, za), za], [xs + W2, lineY(xs, za), za], [xs + W2, lineY(xs, zb), zb], [xs - W2, lineY(xs, zb), zb], [0, 1, 0], fuge);
      }
    }
  }
  // Lichtfleck: das Fenster (vier Scheiben) auf den Boden gemalt, dazu der Lichtstrahl.
  const sunD = new THREE.Vector3(-world.theme.sunDir[0], -world.theme.sunDir[1], -world.theme.sunDir[2]).normalize();
  /** Wo trifft der Strahl durch (x, y) im Fenster auf den Boden? */
  const shaftAt = (x: number, y: number, s: number, out: THREE.Vector3): THREE.Vector3 => {
    const tt = (y / -sunD.y) * s;
    return out.set(x + sunD.x * tt, y + sunD.y * tt, Z0 + sunD.z * tt);
  };
  {
    const fv = new THREE.Vector3();
    const surf = (x: number, z: number): number => (inRug(x, z) && rugField(x, z) > 0 ? rugTop(x, z) : world.heightAt(x, z)) + 0.15;
    const panes: [number, number, number, number][] = [
      [WX0, WXM - 2, WY0, WYM - 2],
      [WXM + 2, WX1, WY0, WYM - 2],
      [WX0, WXM - 2, WYM + 2, WY1],
      [WXM + 2, WX1, WYM + 2, WY1],
    ];
    const N = 5;
    for (const [x0, x1, y0, y1] of panes) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const pts: V3[] = [];
          for (const [a, b] of [
            [i, j],
            [i + 1, j],
            [i + 1, j + 1],
            [i, j + 1],
          ]) {
            shaftAt(x0 + ((x1 - x0) * a) / N, y0 + ((y1 - y0) * b) / N, 1, fv);
            pts.push([fv.x, surf(fv.x, fv.z), fv.z]);
          }
          lightQuad(pts[0], pts[1], pts[2], pts[3], 0.24, 0.24, 0.24, 0.24, SUN_LIGHT);
        }
      }
    }
    // Strahl: vier Seiten vom Fensterrahmen zum Fleck, oben heller, unten verblasst.
    const corners: [number, number][] = [
      [WX0, WY0],
      [WX1, WY0],
      [WX1, WY1],
      [WX0, WY1],
    ];
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = corners[k];
      const [bx, by] = corners[(k + 1) % 4];
      const NS = 4;
      for (let s = 0; s < NS; s++) {
        const s0 = s / NS;
        const s1 = (s + 1) / NS;
        const p0 = shaftAt(ax, ay, s0, new THREE.Vector3());
        const p1 = shaftAt(bx, by, s0, new THREE.Vector3());
        const p2 = shaftAt(bx, by, s1, new THREE.Vector3());
        const p3 = shaftAt(ax, ay, s1, new THREE.Vector3());
        const k0 = 0.028 * (1 - s0 * 0.85);
        const k1 = 0.028 * (1 - s1 * 0.85);
        lightQuad([p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z], [p3.x, p3.y, p3.z], k0, k0, k1, k1, SUN_LIGHT);
      }
    }
  }

  // =========================================================================================
  // Bett über dem Tunnel
  // =========================================================================================
  {
    const post = rgb(0xb98552);
    const postT = rgb(0xd9a46a);
    const board = rgb(0xc8945e);
    const FH = 15; // Unterkante des Rahmens (über dem Tunnel)
    for (const [x, z, h] of [
      [BX0, BZ0, 46],
      [BX1, BZ0, 46],
      [BX0, BZ1, 66],
      [BX1, BZ1, 66],
    ]) {
      const g = world.heightAt(x, z) - 0.5;
      solid.add(cyl(3.6, 4, SEG), post, mat(x, g + (h - g) / 2, z, 0, 0, 0, 1, h - g, 1));
      solid.add(ball(1), postT, mat(x, h + 3, z, 0, 0, 0, 5, 5, 5));
    }
    // Rahmen
    box(solid, BX0, FH + 4, (BZ0 + BZ1) / 2, 3, 8, BZ1 - BZ0, board);
    box(solid, BX1, FH + 4, (BZ0 + BZ1) / 2, 3, 8, BZ1 - BZ0, board);
    box(solid, (BX0 + BX1) / 2, FH + 13, BZ0, BX1 - BX0, 26, 3, board);
    box(solid, (BX0 + BX1) / 2, FH + 22, BZ1, BX1 - BX0, 44, 3, board);
    // Kopfteil mit Bogen
    solid.add(cyl(30, 30, SEG + 4), board, mat((BX0 + BX1) / 2, FH + 44, BZ1, 0, Math.PI / 2, 0, 1, 3, 0.55));
    // Matratze, Kissen
    box(solid, (BX0 + BX1) / 2, FH + 12, (BZ0 + BZ1) / 2 + 1, BX1 - BX0 - 4, 10, BZ1 - BZ0 - 4, rgb(0xf4efe4));
    solid.add(ball(1), rgb(0xfbe4ea), mat((BX0 + BX1) / 2 - 14, FH + 20, BZ1 - 12, 0.1, 0, 0, 16, 5, 8));
    solid.add(ball(1), rgb(0xfff4dc), mat((BX0 + BX1) / 2 + 16, FH + 20, BZ1 - 13, -0.15, 0, 0, 15, 5, 8));
    // Bettdecke im Flickenmuster, auf der Westseite tief herabhängend (mit Fransen)
    const patches = [rgb(0xf2c94c), rgb(0x9fdcb8), rgb(0xf2a0b4), rgb(0xc4aee6), rgb(0xf8f0dc), rgb(0xe07a6a)];
    const top = FH + 17.2;
    const dz0 = BZ0 + 3;
    const dz1 = BZ1 - 26;
    const PS = hi ? 13 : 20;
    for (let i = 0; BX0 - 2 + i * PS < BX1 + 2; i++) {
      for (let j = 0; dz0 + j * PS < dz1; j++) {
        const x0 = BX0 - 2 + i * PS;
        const x1 = Math.min(BX1 + 2, x0 + PS);
        const z0 = dz0 + j * PS;
        const z1 = Math.min(dz1, z0 + PS);
        quadFacing(solid, [x0, top, z0], [x1, top, z0], [x1, top, z1], [x0, top, z1], [0, 1, 0], patches[(i + j * 2) % patches.length]);
      }
    }
    quadFacing(solid, [BX0 - 2, top, dz1], [BX1 + 2, top, dz1], [BX1 + 2, top - 2.4, dz1], [BX0 - 2, top - 2.4, dz1], [0, 0, 1], rgb(0xe8dcc0));
    // Behang im Westen: vorn Flicken, hinten (zum Tunnel) dunkel
    const xd = BX0 - 2.2;
    const yb = 6;
    for (let j = 0; dz0 + j * PS < dz1; j++) {
      const z0 = dz0 + j * PS;
      const z1 = Math.min(dz1, z0 + PS);
      for (let r = 0; r < 3; r++) {
        const y1 = top - r * ((top - yb) / 3);
        const y0 = top - (r + 1) * ((top - yb) / 3);
        quadFacing(solid, [xd, y0, z0], [xd, y0, z1], [xd, y1, z1], [xd, y1, z0], [-1, 0, 0], patches[(j + r * 3 + 1) % patches.length]);
      }
      quadFacing(solid, [xd + 0.3, yb, z0], [xd + 0.3, yb, z1], [xd + 0.3, top, z1], [xd + 0.3, top, z0], [1, 0, 0], rgb(0x8a7a6a));
      for (let f = 0; f < 4; f++) {
        const za = z0 + (f * (z1 - z0)) / 4;
        const zb = z0 + ((f + 1) * (z1 - z0)) / 4;
        triFacing(solid, [xd, yb, za], [xd, yb, zb], [xd, yb - 2.6, (za + zb) / 2], [-1, 0, 0], rgb(0xf8f0dc));
        triFacing(solid, [xd + 0.3, yb, za], [xd + 0.3, yb, zb], [xd + 0.3, yb - 2.6, (za + zb) / 2], [1, 0, 0], rgb(0xd8ccb0));
      }
    }
    quadFacing(solid, [xd, top, dz0], [BX0 - 2, top, dz0], [BX0 - 2, yb, dz0], [xd, yb, dz0], [0, 0, -1], rgb(0xe8dcc0));
    quadFacing(solid, [xd, top, dz1], [BX0 - 2, top, dz1], [BX0 - 2, yb, dz1], [xd, yb, dz1], [0, 0, 1], rgb(0xe8dcc0));
    // Unter dem Bett: Wollmäuse, ein Pantoffel, eine Murmel (neben den Tunnelmündern)
    const fluff = (x: number, z: number, s: number): void => {
      if (!free(x, z, s * 1.6)) return;
      const g = world.heightAt(x, z);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + rnd();
        solid.add(ball(0), k % 2 ? rgb(0xbdb8c4) : rgb(0xa9a4b2), mat(x + Math.cos(a) * s * 0.7, g + s * (0.6 + rnd() * 0.3), z + Math.sin(a) * s * 0.7, rnd() * 3, rnd(), rnd(), s, s * 0.8, s));
      }
    };
    fluff(186, -66, 3);
    fluff(240, -78, 2.6);
    fluff(178, 16, 2.4);
    fluff(240, 24, 3);
    fluff(246, -30, 2.2);
    // Pantoffel
    {
      const x = 244;
      const z = -52;
      if (free(x, z, 9)) {
        const g = world.heightAt(x, z);
        const ry = 0.5;
        solid.add(ball(1), rgb(0x9a6cc8), mat(x, g + 2.4, z, ry, 0, 0, 5, 2.6, 10));
        box(solid, x, g + 0.6, z, 9, 1.2, 19, rgb(0xe8dcc0), ry);
        solid.add(ball(1), C.pink, mat(x + Math.sin(ry) * 6, g + 4.6, z + Math.cos(ry) * 6, 0, 0, 0, 2.4, 2.4, 2.4));
      }
    }
    // Murmel
    {
      const x = 188;
      const z = -84;
      if (free(x, z, 3.2)) {
        const g = world.heightAt(x, z);
        solid.add(ball(1), rgb(0x8fd6b0), mat(x, g + 3, z, 0, 0, 0, 3, 3, 3));
        solid.add(cyl(3.05, 3.05, SEG_S), rgb(0xd9483b), mat(x, g + 3, z, 0.6, 0.3, 0.8, 1, 0.9, 0.35));
      }
    }
  }

  // =========================================================================================
  // Wandvorsprung mit Mauseloch, davor das Bücherregal
  // =========================================================================================
  {
    const n = (x: number, z: number): V3 => [x, 0, z];
    const wp = rgb(0xf6e8bf);
    const wpB = rgb(0xfaf0d6);
    // Längsseiten (Tapetenstreifen)
    for (const [z, nz] of [
      [PZ0, -1],
      [PZ1, 1],
    ]) {
      for (let x = PX0; x < PX1 - 0.01; x += 12) {
        const x2 = Math.min(PX1, x + 12);
        quadFacing(paper, [x, -2, z], [x2, -2, z], [x2, WALL_H, z], [x, WALL_H, z], n(0, nz), shade(Math.round((x - PX0) / 12) % 2 ? wp : wpB, nz < 0 ? 0.9 : 0.96));
      }
    }
    // Stirnseiten mit dem Bogen des Mauselochs
    const AN = hi ? 12 : 8;
    for (const [x, nx] of [
      [PX0, -1],
      [PX1, 1],
    ]) {
      const col = shade(wpB, 0.93);
      quadFacing(paper, [x, -2, PZ0], [x, -2, ARCH_Z - ARCH_R], [x, WALL_H, ARCH_Z - ARCH_R], [x, WALL_H, PZ0], n(nx, 0), col);
      quadFacing(paper, [x, -2, ARCH_Z + ARCH_R], [x, -2, PZ1], [x, WALL_H, PZ1], [x, WALL_H, ARCH_Z + ARCH_R], n(nx, 0), col);
      for (let k = 0; k < AN; k++) {
        const a0 = Math.PI - (k / AN) * Math.PI;
        const a1 = Math.PI - ((k + 1) / AN) * Math.PI;
        const z0 = ARCH_Z + Math.cos(a0) * ARCH_R;
        const z1 = ARCH_Z + Math.cos(a1) * ARCH_R;
        const y0 = ARCH_Y + Math.sin(a0) * ARCH_R;
        const y1 = ARCH_Y + Math.sin(a1) * ARCH_R;
        quadFacing(paper, [x, y0, z0], [x, y1, z1], [x, WALL_H, z1], [x, WALL_H, z0], n(nx, 0), col);
        // Gewölbe (innen, dunkel) und eine Zierleiste um den Bogen
        quadFacing(paper, [PX0, y0, z0], [PX1, y0, z0], [PX1, y1, z1], [PX0, y1, z1], [0, -1, 0], rgb(0x5a4a40));
        const tr = ARCH_R + 2.2;
        const za = ARCH_Z + Math.cos(a0) * tr;
        const zb = ARCH_Z + Math.cos(a1) * tr;
        const ya = ARCH_Y + Math.sin(a0) * tr;
        const yb2 = ARCH_Y + Math.sin(a1) * tr;
        quadFacing(paper, [x + nx * 0.5, y0, z0], [x + nx * 0.5, y1, z1], [x + nx * 0.5, yb2, zb], [x + nx * 0.5, ya, za], n(nx, 0), C.white);
      }
      quadFacing(paper, [x, -2, ARCH_Z - ARCH_R], [x, ARCH_Y, ARCH_Z - ARCH_R], [x, ARCH_Y, ARCH_Z - ARCH_R - 0.01], [x, -2, ARCH_Z - ARCH_R - 0.01], n(nx, 0), col);
      // Fußleiste neben dem Bogen
      box(solid, x + nx * 1.6, 6, (PZ0 + ARCH_Z - ARCH_R) / 2, 3.2, 12, ARCH_Z - ARCH_R - PZ0, C.white);
      box(solid, x + nx * 1.6, 6, (PZ1 + ARCH_Z + ARCH_R) / 2, 3.2, 12, PZ1 - ARCH_Z - ARCH_R, C.white);
    }
    // Rauten wie auf der Tapete der Wände
    if (hi) {
      const motif = [rgb(0xf0a8b8), rgb(0x9fd6b4), rgb(0xc4b0e6), rgb(0xf2c46a)];
      const dia = (P: (u: number, y: number) => V3, u: number, y: number, nrm: V3, c: RGB): void => quadFacing(paper, P(u, y - 3.2), P(u + 2.2, y), P(u, y + 3.2), P(u - 2.2, y), nrm, c);
      for (let u = 6, s = 0; u < PX1 - PX0 - 4; u += 24, s++) {
        for (let r = 0; r * 30 + 40 < WALL_H - 10; r++) {
          const y = 40 + r * 30 + (s % 2 ? 15 : 0);
          dia((uu, yy) => [PX0 + uu, yy, PZ0 - 0.8], u, y, [0, 0, -1], shade(motif[(s + r) % 4], 0.9));
        }
      }
      for (const [x, nx] of [
        [PX0 - 0.8, -1],
        [PX1 + 0.8, 1],
      ]) {
        for (let u = 6, s = 0; u < PZ1 - PZ0 - 4; u += 24, s++) {
          for (let r = 0; r * 30 + 40 < WALL_H - 10; r++) {
            const y = 40 + r * 30 + (s % 2 ? 15 : 0);
            if (y < ARCH_Y + ARCH_R + 8) continue;
            dia((uu, yy) => [x, yy, PZ0 + uu], u, y, [nx, 0, 0], shade(motif[(s + r + 1) % 4], 0.93));
          }
        }
      }
    }
    // Innenseiten der Pfeiler unter dem Bogen
    quadFacing(paper, [PX0, -2, ARCH_Z - ARCH_R], [PX1, -2, ARCH_Z - ARCH_R], [PX1, ARCH_Y, ARCH_Z - ARCH_R], [PX0, ARCH_Y, ARCH_Z - ARCH_R], [0, 0, 1], rgb(0x5a4a40));
    quadFacing(paper, [PX0, -2, ARCH_Z + ARCH_R], [PX1, -2, ARCH_Z + ARCH_R], [PX1, ARCH_Y, ARCH_Z + ARCH_R], [PX0, ARCH_Y, ARCH_Z + ARCH_R], [0, 0, -1], rgb(0x5a4a40));
    // Fußleiste an der Nordseite
    box(solid, (PX0 + PX1) / 2, 6, PZ0 - 1.6, PX1 - PX0 + 6.4, 12, 3.2, C.white);

    // Bücherregal: Seiten, Böden, Sockel, darauf Bücher
    const SX0 = -25;
    const SX1 = 70;
    const SZ0 = PZ1;
    const SZ1 = 188;
    const SH = 140;
    const sc = rgb(0xdcb27c);
    const sd = rgb(0xa77a48);
    box(solid, SX0 + 1.5, SH / 2, (SZ0 + SZ1) / 2, 3, SH, SZ1 - SZ0, sc);
    box(solid, SX1 - 1.5, SH / 2, (SZ0 + SZ1) / 2, 3, SH, SZ1 - SZ0, sc);
    box(solid, (SX0 + SX1) / 2, 3, SZ1 - 2, SX1 - SX0 - 6, 6, 2, sd);
    const levels = [6, 42, 78, 114];
    for (const y of [...levels, SH - 2.5]) box(solid, (SX0 + SX1) / 2, y + 1.25, (SZ0 + SZ1) / 2, SX1 - SX0 - 6, 2.5, SZ1 - SZ0 - 0.5, sc, 0, rgb(0xe8c28c));
    box(solid, (SX0 + SX1) / 2, SH / 2, SZ0 + 0.6, SX1 - SX0 - 6, SH, 1.2, sd);
    for (const yb of levels) {
      let x = SX0 + 4;
      const yfl = yb + 2.5;
      while (x < SX1 - 5) {
        const r = rnd();
        if (r < 0.08) {
          x += 5;
          continue;
        }
        if (r < 0.16 && x < SX1 - 20) {
          // liegender Stapel
          let y = yfl;
          for (let k = 0; k < 3; k++) {
            const th = 2.2 + rnd() * 1.2;
            box(solid, x + 7, y + th / 2, (SZ0 + SZ1) / 2 + 1, 14 - k * 1.5, th, 11, pick(bookCols), (rnd() - 0.5) * 0.2, C.page);
            y += th;
          }
          x += 16;
          continue;
        }
        const w = hi ? 2.6 + rnd() * 3 : 4 + rnd() * 3;
        const h = 21 + rnd() * 10;
        const lean = r > 0.93 ? 0.22 : 0;
        if (lean > 0) {
          solid.add(cube(), pick(bookCols), mat(x + w / 2 + h * 0.11, yfl + (h / 2) * Math.cos(lean), (SZ0 + SZ1) / 2 + 1, 0, 0, -lean, w, h, 11.5));
          x += w + h * 0.25;
        } else {
          box(solid, x + w / 2, yfl + h / 2, (SZ0 + SZ1) / 2 + 1, w - 0.2, h, 11.5, pick(bookCols), 0, C.page);
          x += w;
        }
      }
    }
    // Auf dem Regal: ein Globus
    {
      const gx = SX0 + 18;
      const gy = SH;
      const gz = (SZ0 + SZ1) / 2;
      solid.add(cyl(5, 6, SEG), C.woodD, mat(gx, gy + 1, gz, 0, 0, 0, 1, 2, 1));
      solid.add(cyl(0.7, 0.7, 5), C.woodD, mat(gx, gy + 7, gz, 0, 0, 0, 1, 12, 1));
      const sph = ball(hi ? 2 : 1).toNonIndexed();
      const p = sph.getAttribute('position');
      for (let i = 0; i < p.count; i += 3) {
        const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
        const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
        const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        const land = noise(cx * 2.2 + 3, cz * 2.2 + cy * 1.7) > 0.55;
        const c = land ? (cy > 0.75 || cy < -0.8 ? C.white : rgb(0x8fcf6a)) : rgb(0x6cc4c0);
        const v = (k: number): V3 => [gx + p.getX(i + k) * 8, gy + 20 + p.getY(i + k) * 8, gz + p.getZ(i + k) * 8];
        solid.tri(v(0), v(1), v(2), c);
      }
      sph.dispose();
      solid.add(cyl(0.5, 0.5, 5), C.woodD, mat(gx, gy + 20, gz, 0, 0, 0.4, 1, 20, 1));
    }
  }

  // =========================================================================================
  // Bücherrampe: Stapel liegender Bücher neben der ansteigenden Fahrbahn
  // =========================================================================================
  /** Liegendes Buch: Rücken auf −z, Papier auf +x, −x, +z – dort oben und unten die Kanten der Deckel. */
  const book = (m: THREE.Matrix4, len: number, th: number, dep: number, cover: RGB): void => {
    cuboid(solid, m, len, th, dep, [C.page, C.page, cover, shade(cover, 0.8), C.page, shade(cover, 0.9)]);
    const e = Math.min(0.6, th * 0.22);
    const hx = len / 2 + 0.04;
    const hz = dep / 2 + 0.04;
    const hy = th / 2;
    const P = (x: number, y: number, z: number): V3 => {
      tp.set(x, y, z).applyMatrix4(m);
      return [tp.x, tp.y, tp.z];
    };
    const nrm = (x: number, z: number): V3 => {
      const v = new THREE.Vector3(x, 0, z).transformDirection(m);
      return [v.x, v.y, v.z];
    };
    for (const [y0, y1] of [
      [hy - e, hy],
      [-hy, -hy + e],
    ]) {
      quadFacing(solid, P(-hx, y0, hz), P(hx, y0, hz), P(hx, y1, hz), P(-hx, y1, hz), nrm(0, 1), cover);
      quadFacing(solid, P(hx, y0, -hz + 0.04), P(hx, y0, hz), P(hx, y1, hz), P(hx, y1, -hz + 0.04), nrm(1, 0), cover);
      quadFacing(solid, P(-hx, y0, -hz + 0.04), P(-hx, y0, hz), P(-hx, y1, hz), P(-hx, y1, -hz + 0.04), nrm(-1, 0), cover);
    }
  };
  {
    const ramp0 = 852;
    const ramp1 = 1072;
    for (let i = ramp0; i <= ramp1; i += hi ? 14 : 22) {
      for (const sgn of [-1, 1]) {
        if (sgn < 0 && Math.abs(i - 1021) < 16) continue; // Wachsring links: dort nichts
        const len = 12 + rnd() * 3;
        const dep = 14 + rnd() * 7;
        const lat0 = t.wh[i] + 3.6;
        const lat = sgn * (lat0 + dep / 2);
        const cx = t.px[i] + rightX(t, i) * lat;
        const cz = t.pz[i] + rightZ(t, i) * lat;
        const rot = Math.atan2(t.tx[i], t.tz[i]) + Math.PI / 2;
        if (!freeRect(cx, cz, len + 2, dep, rot)) continue;
        // so hoch, dass das Gelände (der Damm unter der Fahrbahn) nicht durchsticht
        let topY = 0;
        for (const [a, b] of [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
          [0, 0],
        ]) {
          const lx = a * len;
          const lz = b * dep;
          const x = cx + lx * Math.cos(rot) + lz * Math.sin(rot);
          const z = cz - lx * Math.sin(rot) + lz * Math.cos(rot);
          topY = Math.max(topY, world.heightAt(x, z) + 0.4);
        }
        topY = Math.min(topY, t.py[i] + 0.4);
        const nB = Math.max(1, Math.round(topY / 2.4));
        const th = topY / nB;
        for (let k = 0; k < nB; k++) {
          const j = (rnd() - 0.5) * 2.4;
          // Rücken zur Fahrbahn: Von dort sieht man die bunten Buchrücken.
          book(mat(cx + (rnd() - 0.5) * 0.8, th * (k + 0.5), cz + (rnd() - 0.5) * 0.8, rot + (sgn > 0 ? Math.PI : 0) + j * 0.04), len + j, th - 0.05, dep * (0.88 + rnd() * 0.12), pick(bookCols));
        }
        // ab und zu ein großes Buch, schräg an den Stapel gelehnt
        if (rnd() < 0.4 && hi) {
          const h = 16 + rnd() * 8;
          const lat2 = sgn * (lat0 + dep + 3);
          const x2 = t.px[i] + rightX(t, i) * lat2;
          const z2 = t.pz[i] + rightZ(t, i) * lat2;
          if (free(x2, z2, 4)) {
            const lean = 0.32 * sgn;
            const m = mat(x2, world.heightAt(x2, z2) + (h / 2) * Math.cos(0.32), z2, rot, 0, 0);
            const m2 = new THREE.Matrix4().makeRotationZ(lean);
            m.multiply(m2);
            const cv = pick(bookCols);
            cuboid(solid, m, 3.2, h, 14, [cv, shade(cv, 0.85), C.page, C.page, C.page, shade(cv, 0.7)]);
          }
        }
      }
    }
  }

  // =========================================================================================
  // Schreibtisch: Platte neben der Fahrbahn, Beine, Stifte, Lineal, Radiergummi, Heft, Lampe, Tasse
  // =========================================================================================
  const tableField = (x: number, z: number): number => Math.min(x - TX0, TX1 - x, z - TZ0, TZ1 - z, clr(x, z) - 3);
  {
    const topC = rgb(0xe3c08a);
    fieldSurface(
      flat,
      flat,
      TX0,
      TZ0,
      TX1,
      TZ1,
      hi ? 7 : 11,
      tableField,
      () => TABLE_Y,
      (x, z) => shade(topC, 0.95 + 0.08 * noise(z * 0.08, x * 0.01)),
      TABLE_D,
      rgb(0xa77a48),
      rgb(0x8f6338),
    );
    // Maserung
    for (let z = TZ0 + 5; z < TZ1; z += 9) {
      for (let x = TX0; x < TX1 - 0.1; x += 8) {
        const x2 = Math.min(TX1, x + 8);
        if (tableField(x, z) < 0.6 || tableField(x2, z) < 0.6) continue;
        quadFacing(paint, [x, TABLE_Y + 0.05, z - 0.18], [x2, TABLE_Y + 0.05, z - 0.18], [x2, TABLE_Y + 0.05, z + 0.18], [x, TABLE_Y + 0.05, z + 0.18], [0, 1, 0], rgb(0xc9a06a));
      }
    }
    // Beine
    const leg = rgb(0xb3804c);
    for (const [x, z] of [
      [-198, 38],
      [-78, 38],
      [-78, -118],
      [-200, -106],
    ]) {
      if (!free(x, z, 6.4)) continue;
      const g = world.heightAt(x, z) - 0.5;
      const h = TABLE_Y - TABLE_D - g;
      box(solid, x, g + h / 2, z, 9, h, 9, leg);
    }
    const onTable = (x: number, z: number, r: number): boolean => tableField(x, z) >= r;
    const Y = TABLE_Y;
    // Heft mit Linien
    {
      const x = -120;
      const z = 24;
      const rot = 0.25;
      if (onTable(x, z, 0) && freeRect(x, z, 30, 38, rot) && onTable(x + 16, z + 20, 0) && onTable(x - 16, z - 20, 0)) {
        cuboid(solid, mat(x, Y + 0.6, z, rot), 30, 1.2, 38, [C.white, C.white, rgb(0xb9a0d8), C.white, C.white, C.white]);
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        for (let k = -6; k <= 6; k++) {
          const lz = k * 2.6;
          const P = (lx: number): V3 => [x + lx * c + lz * s, Y + 1.25, z - lx * s + lz * c];
          const Q = (lx: number): V3 => [x + lx * c + (lz + 0.35) * s, Y + 1.25, z - lx * s + (lz + 0.35) * c];
          quadFacing(paint, P(-12), P(12), Q(12), Q(-12), [0, 1, 0], k === -6 ? C.red : rgb(0x8d7fb0));
        }
        // Etikett
        const P = (lx: number, lz: number): V3 => [x + lx * c + lz * s, Y + 1.26, z - lx * s + lz * c];
        quadFacing(paint, P(-8, -17), P(8, -17), P(8, -12), P(-8, -12), [0, 1, 0], C.white);
      }
    }
    // Stifte (liegend): Sechskant, gespitzt
    const pencil = (x: number, z: number, rot: number, len: number, col: RGB): void => {
      const dx = Math.sin(rot);
      const dz = Math.cos(rot);
      if (!onTable(x + dx * len * 0.6, z + dz * len * 0.6, 1) || !onTable(x - dx * len * 0.6, z - dz * len * 0.6, 1)) return;
      if (!free(x + dx * len * 0.6, z + dz * len * 0.6, 1) || !free(x - dx * len * 0.6, z - dz * len * 0.6, 1)) return;
      solid.add(cyl(1.4, 1.4, 6), col, mat(x, Y + 1.4, z, rot, Math.PI / 2, 0, 1, len, 1));
      solid.add(cyl(0, 1.4, 6), C.woodL, mat(x + dx * (len / 2 + 2.5), Y + 1.4, z + dz * (len / 2 + 2.5), rot, Math.PI / 2, 0, 1, 5, 1));
      solid.add(cyl(0, 0.5, 6), shade(col, 0.6), mat(x + dx * (len / 2 + 4.3), Y + 1.4, z + dz * (len / 2 + 4.3), rot, Math.PI / 2, 0, 1, 1.4, 1));
      solid.add(cyl(1.45, 1.45, 6), C.pink, mat(x - dx * (len / 2 + 1.2), Y + 1.4, z - dz * (len / 2 + 1.2), rot, Math.PI / 2, 0, 1, 2.4, 1));
    };
    pencil(-95, 22, 2.6, 34, C.red);
    pencil(-90, 30, 2.2, 30, C.green);
    pencil(-140, 36, 1.45, 30, C.yellow);
    // Lineal mit Strichen
    {
      const x = -96;
      const z = -40;
      const rot = 0.06;
      if (freeRect(x, z, 9, 64, rot) && onTable(x, z - 32, 0) && onTable(x, z + 32, 0)) {
        cuboid(solid, mat(x, Y + 0.45, z, rot), 9, 0.9, 64, [rgb(0xf5e6a0), rgb(0xf5e6a0), rgb(0xf8ecb0), rgb(0xf5e6a0), rgb(0xf5e6a0), rgb(0xf5e6a0)]);
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        for (let k = 0; k <= 30; k++) {
          const lz = -30 + k * 2;
          const L = k % 5 === 0 ? 3 : 1.6;
          const P = (lx: number, dz: number): V3 => [x + lx * c + (lz + dz) * s, Y + 0.93, z - lx * s + (lz + dz) * c];
          quadFacing(paint, P(-4.5, -0.15), P(-4.5 + L, -0.15), P(-4.5 + L, 0.15), P(-4.5, 0.15), [0, 1, 0], C.ink);
        }
      }
    }
    // Radiergummi
    {
      const x = -84;
      const z = 6;
      if (onTable(x, z, 6) && free(x, z, 6)) {
        box(solid, x - 2, Y + 2.5, z, 6, 5, 7, C.pink, 0.4);
        const c = rgb(0x9fdcb8);
        cuboid(solid, mat(x + 1.6 * Math.cos(0.4), Y + 2.5, z - 1.6 * Math.sin(0.4), 0.4), 6, 5.3, 7.3, [c, c, c, c, c, c]);
      }
    }
    // Tasse mit Stiften
    {
      const x = -90;
      const z = -96;
      if (onTable(x, z, 9) && free(x, z, 9)) {
        solid.add(cyl(7, 6.4, SEG + 2), C.red, mat(x, Y + 9, z, 0, 0, 0, 1, 18, 1));
        solid.add(cyl(6.2, 6.2, SEG + 2), rgb(0x5a3a2a), mat(x, Y + 17.6, z, 0, 0, 0, 1, 0.6, 1));
        solid.add(cyl(6.85, 6.75, SEG + 2), C.white, mat(x, Y + 11, z, 0, 0, 0, 1, 2.4, 1));
        solid.add(cyl(1.3, 1.3, 6), C.red, mat(x + 8.6, Y + 9, z, 0, 0, 0, 1, 9, 1));
        box(solid, x + 7.7, Y + 13.3, z, 2.4, 1.6, 2.6, C.red);
        box(solid, x + 7.7, Y + 4.7, z, 2.4, 1.6, 2.6, C.red);
        const pc = [C.yellow, C.green, C.violet, C.red, C.teal];
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const tilt = 0.22;
          const L = 26 + k * 2;
          const px = x + Math.cos(a) * 3;
          const pz = z + Math.sin(a) * 3;
          solid.add(cyl(1, 1, 6), pc[k], mat(px, Y + 6 + L / 2, pz, -a + Math.PI / 2, 0, tilt, 1, L, 1));
        }
      }
    }
    // Schreibtischlampe mit gemaltem Lichtkegel
    {
      const bx = -80;
      const bz = -114;
      if (onTable(bx, bz, 7) && free(bx, bz, 7)) {
        const lamp = rgb(0x6fae8a);
        solid.add(cyl(7, 8, SEG + 2), lamp, mat(bx, Y + 1.2, bz, 0, 0, 0, 1, 2.4, 1));
        // Arm: zwei Glieder
        const j1: V3 = [bx - 4, Y + 32, bz + 3];
        const hx = -100;
        const hz = -104;
        const j2: V3 = [hx, Y + 50, hz];
        const seg = (a: V3, b: V3, r: number): void => {
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const dz = b[2] - a[2];
          const L = Math.hypot(dx, dy, dz);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
          tm.compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, L, 1));
          solid.add(cyl(r, r, 6), lamp, tm);
        };
        seg([bx, Y + 2, bz], j1, 1.1);
        seg(j1, j2, 1.1);
        solid.add(ball(1), shade(lamp, 0.8), mat(j1[0], j1[1], j1[2], 0, 0, 0, 2, 2, 2));
        // Schirm, nach unten offen
        solid.add(cyl(2.5, 8, SEG + 2), lamp, mat(hx, Y + 46, hz, 0, 0, 0, 1, 9, 1));
        solid.add(cyl(7.6, 7.6, SEG + 2), rgb(0xfff4c8), mat(hx, Y + 41.6, hz, 0, 0, 0, 1, 0.3, 1));
        // Lichtkegel und heller Fleck auf der Platte
        const warm = rgb(0xffe6a0);
        const N = 14;
        const rTop = 7.6;
        const rBot = 15;
        const yT = Y + 41.4;
        const yB = Y + 0.2;
        for (let k = 0; k < N; k++) {
          const a0 = (k / N) * Math.PI * 2;
          const a1 = ((k + 1) / N) * Math.PI * 2;
          const T = (a: number): V3 => [hx + Math.cos(a) * rTop, yT, hz + Math.sin(a) * rTop];
          const B = (a: number): V3 => [hx + Math.cos(a) * rBot, yB, hz + Math.sin(a) * rBot];
          lightQuad(T(a0), T(a1), B(a1), B(a0), 0.08, 0.08, 0.015, 0.015, warm);
          light([hx, yB + 0.05, hz], B(a0), B(a1), 0.38, 0.3, 0.3, warm);
        }
      }
    }
  }

  // =========================================================================================
  // Start und Ziel: Tribüne aus Bauklötzen, Buntstifte mit Wimpelkette, Plüschtiere
  // =========================================================================================
  const blockCols: RGB[] = [C.red, C.yellow, C.green, C.violet, rgb(0xf3e3c3), C.teal, C.pink];
  {
    // Tribüne nördlich der Zielgeraden (links in Fahrtrichtung)
    const BS = 6;
    for (let r = 0; r < 3; r++) {
      const z = -225.6 - r * BS;
      for (let i = 0; i < 10; i++) {
        const x = -110 + i * BS;
        if (!free(x, z, BS * 0.71)) continue;
        const g = ground(x, z);
        for (let s = 0; s <= r; s++) {
          const c = blockCols[(i * 3 + r * 2 + s) % blockCols.length];
          box(solid, x, g + BS * (s + 0.5), z, BS - 0.15, BS - 0.15, BS - 0.15, c, 0, mixRgb(c, C.white, 0.25));
          // Prägung vorn
          quadFacing(solid, [x - 1.8, g + BS * s + 1.2, z + BS / 2 - 0.05], [x + 1.8, g + BS * s + 1.2, z + BS / 2 - 0.05], [x + 1.8, g + BS * s + 4.8, z + BS / 2 - 0.05], [x - 1.8, g + BS * s + 4.8, z + BS / 2 - 0.05], [0, 0, 1], mixRgb(c, C.white, 0.45));
        }
      }
    }
    // Buntstifte links und rechts der Bahn, dazwischen die Wimpelkette
    const sx = -116;
    const ends: V3[] = [];
    for (const [z, col] of [
      [-225, C.red],
      [-194.5, C.green],
    ] as [number, RGB][]) {
      if (!free(sx, z, 3)) continue;
      const g = ground(sx, z);
      const H = 30;
      solid.add(cyl(2.6, 2.6, 8), col, mat(sx, g + H / 2, z, 0, 0, 0, 1, H, 1));
      solid.add(cyl(2.75, 2.75, 8), shade(col, 0.75), mat(sx, g + H * 0.45, z, 0, 0, 0, 1, H * 0.6, 1));
      solid.add(cyl(0.9, 2.6, 8), C.woodL, mat(sx, g + H + 2.5, z, 0, 0, 0, 1, 5, 1));
      solid.add(cyl(0, 0.9, 8), col, mat(sx, g + H + 5.9, z, 0, 0, 0, 1, 1.8, 1));
      ends.push([sx, g + H - 3, z]);
    }
    if (ends.length === 2) {
      const [a, b] = ends;
      const N = 12;
      const sag = 6;
      const pt = (f: number): V3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - sag * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f];
      const pc = [C.red, C.yellow, C.green, C.white, C.violet, C.pink];
      for (let k = 0; k < N; k++) {
        const p = pt(k / N);
        const q = pt((k + 1) / N);
        const m = (p[2] + q[2]) / 2;
        solid.add(cube(), C.ink, mat((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, m, 0, Math.atan2(q[1] - p[1], q[2] - p[2]) - Math.PI / 2, 0, 0.35, Math.hypot(q[1] - p[1], q[2] - p[2]), 0.35));
        if (k === 0 || k === N - 1) continue;
        const c = pc[k % pc.length];
        const tip: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 4.2, (p[2] + q[2]) / 2];
        triFacing(solid, p, q, tip, [1, 0, 0], c);
        triFacing(solid, p, q, tip, [-1, 0, 0], shade(c, 0.85));
      }
    }
    // Plüschtiere südlich der Geraden (rechts in Fahrtrichtung)
    const plush = (x: number, z: number, col: RGB, belly: RGB, bunny: boolean, s: number): void => {
      if (!free(x, z, 7 * s)) return;
      const g = ground(x, z);
      const ry = Math.PI + (rnd() - 0.5) * 0.6; // Blick zur Bahn (nach Norden)
      const c = Math.cos(ry);
      const sn = Math.sin(ry);
      const P = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * c + lz * sn, g + ly * s, z - lx * sn + lz * c];
      const add = (lx: number, ly: number, lz: number, ax: number, ay: number, az: number, colr: RGB): void => {
        const p = P(lx * s, ly, lz * s);
        // Rumpf und Kopf rund, Kleinteile kantig – spart Dreiecke
        solid.add(ball(hi && ax > 3 ? 1 : 0), colr, mat(p[0], p[1], p[2], ry, 0, 0, ax * s, ay * s, az * s));
      };
      add(0, 5.5, 0, 5, 5.8, 4.4, col);
      add(0, 5, 2.2, 3.4, 4.2, 2.4, belly);
      add(0, 13.2, 0.4, 4, 3.8, 3.6, col);
      add(0, 12.6, 3.6, 1.8, 1.4, 1.4, belly);
      add(0, 13.1, 4.9, 0.6, 0.5, 0.5, C.ink);
      add(-1.6, 14.4, 3.3, 0.55, 0.55, 0.4, C.ink);
      add(1.6, 14.4, 3.3, 0.55, 0.55, 0.4, C.ink);
      if (bunny) {
        add(-1.6, 20, -0.4, 1.2, 4.6, 0.9, col);
        add(1.6, 20, -0.4, 1.2, 4.6, 0.9, col);
      } else {
        add(-3.2, 16.4, 0, 1.5, 1.5, 0.9, col);
        add(3.2, 16.4, 0, 1.5, 1.5, 0.9, col);
      }
      add(-4.6, 6.6, 1.6, 1.6, 3.4, 1.6, col);
      add(4.6, 6.6, 1.6, 1.6, 3.4, 1.6, col);
      add(-2.6, 1.6, 4.2, 1.8, 1.6, 2.8, col);
      add(2.6, 1.6, 4.2, 1.8, 1.6, 2.8, col);
    };
    plush(-152, -184, rgb(0xb9a0d8), rgb(0xf3e9d2), false, 1.1);
    plush(-70, -183, rgb(0xf3b0c0), C.white, true, 1);
    plush(-6, -186, rgb(0x9fdcb8), rgb(0xf8f0dc), false, 0.9);
  }

  // =========================================================================================
  // Landung: ein Sitzsack daneben
  // =========================================================================================
  {
    // östlich der Landung (rechts in Fahrtrichtung), weit weg vom Flugweg
    const x = -176;
    const z = -168;
    if (free(x, z, 15)) {
      const g = ground(x, z);
      solid.add(ball(hi ? 2 : 1), rgb(0xc85f7c), mat(x, g + 7, z, 0.4, 0, 0, 15, 8, 14));
      solid.add(ball(1), rgb(0xd8758f), mat(x + 2, g + 13, z - 1, 0.4, 0, 0, 9, 4, 8));
    }
  }

  // =========================================================================================
  // Holzgleis der Aufzieh-Lok
  // =========================================================================================
  {
    const N = hi ? 36 : 24;
    const r0 = TRAIN_R - 4;
    const r1 = TRAIN_R + 4;
    const H = 1.2;
    const g = ground(TRAIN_X, TRAIN_Z);
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      const P = (a: number, r: number, y: number): V3 => [TRAIN_X + Math.cos(a) * r, g + y, TRAIN_Z + Math.sin(a) * r];
      quadFacing(flat, P(a0, r0, H), P(a1, r0, H), P(a1, r1, H), P(a0, r1, H), [0, 1, 0], rgb(0xe8c48e));
      quadFacing(flat, P(a0, r1, -0.3), P(a1, r1, -0.3), P(a1, r1, H), P(a0, r1, H), [Math.cos(a0), 0, Math.sin(a0)], rgb(0xb98a56));
      quadFacing(flat, P(a0, r0, -0.3), P(a1, r0, -0.3), P(a1, r0, H), P(a0, r0, H), [-Math.cos(a0), 0, -Math.sin(a0)], rgb(0xb98a56));
      for (const r of [TRAIN_R - 1.9, TRAIN_R + 1.9]) quadFacing(paint, P(a0, r - 0.35, H + 0.03), P(a1, r - 0.35, H + 0.03), P(a1, r + 0.35, H + 0.03), P(a0, r + 0.35, H + 0.03), [0, 1, 0], rgb(0x9a6c40));
    }
  }

  // =========================================================================================
  // Bewegtes: ein Netz, dessen Teile je Bild neu gesetzt werden
  // =========================================================================================
  interface Part {
    start: number;
    count: number;
    m: THREE.Matrix4;
    /** Vorhang: Schwingen der Ecken statt Matrix (0 = nein, sonst Phase). */
    sway: number;
  }
  const parts: Part[] = [];
  const dPos: number[] = [];
  const dNor: number[] = [];
  const dOn: number[] = [];
  const dCol: number[] = [];
  const addPart = (b: MeshBuilder, sway = 0): Part => {
    const g = addSmoothNormals(b.build());
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const o = g.getAttribute('onormal');
    const c = g.getAttribute('color');
    const part: Part = { start: dPos.length / 3, count: p.count, m: new THREE.Matrix4(), sway };
    for (let i = 0; i < p.count; i++) {
      dPos.push(p.getX(i), p.getY(i), p.getZ(i));
      dNor.push(n.getX(i), n.getY(i), n.getZ(i));
      dOn.push(o.getX(i), o.getY(i), o.getZ(i));
      dCol.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    g.dispose();
    parts.push(part);
    return part;
  };

  // --- Zuschauer: Steckfiguren auf der Tribüne ---
  interface Hopper {
    part: Part;
    x: number;
    y: number;
    z: number;
    ph: number;
    ry: number;
  }
  const hoppers: Hopper[] = [];
  {
    const shirt = [C.red, C.yellow, C.green, C.violet, C.teal, C.pink, C.white];
    const BS = 6;
    const nPer = hi ? 6 : 4;
    for (let r = 0; r < 3; r++) {
      const z = -225.6 - r * BS;
      for (let i = 0; i < nPer; i++) {
        const x = -108 + (i * 54) / (nPer - 1) + (rnd() - 0.5) * 2;
        if (!free(x, z, 4.3)) continue;
        const g = ground(x, z) + BS * (r + 1);
        const b = new MeshBuilder();
        const col = shirt[(i + r * 3) % shirt.length];
        b.add(cyl(1.5, 2.0, 6), col, mat(0, 2.2, 0, 0, 0, 0, 1, 4.4, 1));
        b.add(ball(0), rnd() < 0.7 ? C.skin : rgb(0xc89a6a), mat(0, 5.9, 0, 0, 0, 0, 1.75, 1.75, 1.75));
        if (rnd() < 0.4) b.add(cyl(0, 1.6, 6), pick(shirt), mat(0, 8.3, 0, 0, 0, 0, 1, 2.2, 1));
        else if (rnd() < 0.5) b.add(cyl(1.9, 1.9, 6), shade(col, 0.7), mat(0, 7.2, 0, 0, 0, 0, 1, 0.6, 1));
        hoppers.push({ part: addPart(b), x, y: g, z, ph: rnd() * 10, ry: rnd() * 6 });
      }
    }
  }
  // --- Aufziehroboter neben der Geraden ---
  interface Robot {
    body: Part;
    key: Part;
    x: number;
    y: number;
    z: number;
    ph: number;
  }
  const robots: Robot[] = [];
  for (const [x, z, col] of [
    [-124, -186, rgb(0xd9483b)],
    [-100, -187, rgb(0x7fc8a0)],
    [-38, -186, rgb(0xc4aee6)],
  ] as [number, number, RGB][]) {
    if (!free(x, z, 5)) continue;
    const b = new MeshBuilder();
    const metal = rgb(0xc8ccd4);
    box(b, 0, 4, 0, 6, 6.5, 4.2, col);
    box(b, 0, 9.4, 0, 4.6, 4, 4, metal);
    box(b, -1.1, 9.8, 2.05, 1.1, 1.1, 0.2, C.yellow);
    box(b, 1.1, 9.8, 2.05, 1.1, 1.1, 0.2, C.yellow);
    box(b, 0, 8.4, 2.05, 2.4, 0.5, 0.2, C.ink);
    b.add(cyl(0.25, 0.25, 5), C.ink, mat(0, 12.4, 0, 0, 0, 0, 1, 2, 1));
    b.add(ball(0), C.red, mat(0, 13.6, 0, 0, 0, 0, 0.7, 0.7, 0.7));
    box(b, -1.5, 0.5, 0.3, 2, 1.6, 3.4, metal);
    box(b, 1.5, 0.5, 0.3, 2, 1.6, 3.4, metal);
    box(b, -1.5, 1.1, 0, 1.2, 1.4, 1.2, metal);
    box(b, 1.5, 1.1, 0, 1.2, 1.4, 1.2, metal);
    box(b, -3.6, 4.5, 0.6, 1.2, 4.6, 1.4, metal);
    box(b, 3.6, 4.5, 0.6, 1.2, 4.6, 1.4, metal);
    for (let k = 0; k < 3; k++) box(b, -1.6 + k * 1.6, 5.2, 2.15, 0.9, 0.9, 0.2, [C.red, C.green, C.yellow][k]);
    const body = addPart(b);
    const kb = new MeshBuilder();
    kb.add(cyl(0.4, 0.4, 5), metal, mat(0, 0, 1, 0, Math.PI / 2, 0, 1, 2, 1));
    box(kb, 0, 0, 2.2, 0.5, 3.6, 1.6, C.yellow);
    const key = addPart(kb);
    robots.push({ body, key, x, y: ground(x, z), z, ph: rnd() * 6 });
  }

  // --- Aufzieh-Lok mit zwei Wagen ---
  const trainParts: Part[] = [];
  let trainKey: Part | null = null;
  {
    const wheel = (b: MeshBuilder, x: number, z: number, r: number): void => {
      b.add(cyl(r, r, 6), rgb(0x3a2f3a), mat(x, r, z, 0, 0, Math.PI / 2, 1, 1.2, 1));
    };
    // Lok (Blick nach +z)
    const lb = new MeshBuilder();
    box(lb, 0, 2.6, 0, 5.4, 1.4, 14, rgb(0x3a2f3a));
    lb.add(cyl(2.5, 2.5, 8), C.red, mat(0, 5.4, 2.4, 0, Math.PI / 2, 0, 1, 8.4, 1));
    lb.add(cyl(2.55, 2.55, 8), C.yellow, mat(0, 5.4, 4.2, 0, Math.PI / 2, 0, 1, 0.8, 1));
    lb.add(cyl(1.2, 0.8, 7), rgb(0x3a2f3a), mat(0, 9.4, 4.8, 0, 0, 0, 1, 3.4, 1));
    box(lb, 0, 6.6, -4, 5.6, 7, 5.4, C.red, 0, C.yellow);
    box(lb, 0, 10.4, -4, 6.6, 0.8, 6.4, C.yellow);
    box(lb, 2.85, 7.6, -4, 0.2, 2.2, 3, rgb(0xfff4c8));
    box(lb, -2.85, 7.6, -4, 0.2, 2.2, 3, rgb(0xfff4c8));
    box(lb, 0, 2.6, 7.4, 6.2, 1.2, 0.8, C.yellow);
    for (const z of [4.5, -0.5, -4.6]) for (const x of [-2.8, 2.8]) wheel(lb, x, z, z === -4.6 ? 2.1 : 1.5);
    trainParts.push(addPart(lb));
    // Schlüssel oben auf dem Führerhaus
    const kb = new MeshBuilder();
    kb.add(cyl(0.35, 0.35, 5), rgb(0xc8ccd4), mat(0, 1, 0, 0, 0, 0, 1, 2, 1));
    box(kb, 0, 2.8, 0, 3.6, 1.8, 0.5, C.yellow);
    trainKey = addPart(kb);
    // Wagen
    const cargo: [RGB, RGB][] = [
      [C.green, C.yellow],
      [C.violet, C.mint],
    ];
    for (const [wc, cc] of cargo) {
      const wb = new MeshBuilder();
      box(wb, 0, 2.4, 0, 5.2, 1.2, 10, rgb(0x3a2f3a));
      box(wb, 0, 4.6, 0, 5.4, 3.2, 9.4, wc, 0, shade(wc, 0.8));
      box(wb, -1.3, 7.4, -2.2, 2.6, 2.6, 2.6, cc);
      box(wb, 1.2, 7.4, 1.8, 2.6, 2.6, 2.6, C.red);
      box(wb, 0, 8.8, -0.2, 2.4, 2.4, 2.4, C.yellow, 0.5);
      box(wb, 0, 2.4, 5.6, 1, 0.6, 1.6, rgb(0x3a2f3a));
      for (const z of [3, -3]) for (const x of [-2.7, 2.7]) wheel(wb, x, z, 1.5);
      trainParts.push(addPart(wb));
    }
  }
  const trainY = ground(TRAIN_X, TRAIN_Z) + 1.2;

  // --- Ball, der langsam hin und her rollt ---
  let ballPart: Part | null = null;
  const BALL_R = 7;
  const BALL_A: [number, number] = [-45, -50];
  const BALL_B: [number, number] = [-45, 70];
  if (free(BALL_A[0], BALL_A[1], BALL_R) && free(BALL_B[0], BALL_B[1], BALL_R) && free((BALL_A[0] + BALL_B[0]) / 2, (BALL_A[1] + BALL_B[1]) / 2, BALL_R)) {
    const bb = new MeshBuilder();
    const sph = ball(1).toNonIndexed();
    const p = sph.getAttribute('position');
    const cols = [C.red, C.white, C.yellow, C.white, C.green, C.white];
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const a = Math.atan2(cz, cx);
      const c = Math.abs(cy) > 0.86 ? C.white : cols[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 6) % 6];
      const v = (k: number): V3 => [p.getX(i + k) * BALL_R, p.getY(i + k) * BALL_R, p.getZ(i + k) * BALL_R];
      bb.tri(v(0), v(1), v(2), c);
    }
    sph.dispose();
    ballPart = addPart(bb);
  }

  // --- Mobile über dem Bett ---
  const MX = (BX0 + BX1) / 2 + 2;
  const MZ = (BZ0 + BZ1) / 2 - 8;
  const MY = 112;
  const mobile: Part[] = [];
  {
    const string = rgb(0x6a5a50);
    // obere Stufe: Stab mit zwei Enden, daran ein Mond und eine Wolke; in der Mitte die untere Stufe
    const top = new MeshBuilder();
    top.add(cube(), string, mat(0, (WALL_H + 40 - MY) / 2, 0, 0, 0, 0, 0.3, WALL_H + 40 - MY, 0.3));
    top.add(cyl(0.6, 0.6, 6), C.woodD, mat(0, 0, 0, 0, 0, Math.PI / 2, 1, 64, 1));
    for (const sx of [-30, 30]) top.add(cube(), string, mat(sx, -6, 0, 0, 0, 0, 0.25, 12, 0.25));
    slab(top, star(7, 3.2, 5), 1.2, C.yellow, shade(C.yellow, 0.8), mat(-30, -19, 0));
    {
      const moon: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI;
        moon.push([Math.cos(a) * 7, Math.sin(a) * 7]);
      }
      for (let k = 10; k >= 0; k--) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI;
        moon.push([Math.cos(a) * 3.2 + 1, Math.sin(a) * 5.6]);
      }
      slab(top, moon, 1.2, rgb(0xf6eed2), rgb(0xd8ccb0), mat(30, -19, 0));
    }
    top.add(cube(), string, mat(0, -9, 0, 0, 0, 0, 0.25, 18, 0.25));
    mobile.push(addPart(top));
    const low = new MeshBuilder();
    low.add(cyl(0.5, 0.5, 6), C.woodD, mat(0, 0, 0, 0, 0, Math.PI / 2, 1, 40, 1));
    const shapes: [number, [number, number][], RGB][] = [
      [-20, circle(5.5, 10, 1.3, 0.8), C.white],
      [20, star(5.5, 2.4, 5), C.pink],
    ];
    for (const [sx, pts, c] of shapes) {
      low.add(cube(), string, mat(sx, -5, 0, 0, 0, 0, 0.2, 10, 0.2));
      slab(low, pts, 1.2, c, shade(c, 0.8), mat(sx, -15, 0));
    }
    // ein kleiner Vogel in der Mitte
    low.add(cube(), string, mat(0, -4, 0, 0, 0, 0, 0.2, 8, 0.2));
    slab(low, [
      [-6, 0],
      [-1, 1.6],
      [0, 5],
      [1.4, 1.4],
      [6, 1],
      [2, -2],
      [-2, -2],
    ], 1, C.mint, shade(C.mint, 0.8), mat(0, -13, 0));
    mobile.push(addPart(low));
  }

  // --- Vorhänge links und rechts des Fensters (Falten, die sich leicht bewegen) ---
  {
    const cA = rgb(0xe07a86);
    const cB = rgb(0xbf5c6c);
    const yTop = WY1 + 20;
    const yBot = WY0 - 22;
    const NF = hi ? 10 : 6;
    const NR = hi ? 4 : 3;
    for (const [x0, x1, ph] of [
      [WX0 - 44, WX0 + 2, 1],
      [WX1 - 2, WX1 + 44, 2.7],
    ]) {
      const b = new MeshBuilder();
      const zb = Z0 + 6;
      for (let f = 0; f < NF; f++) {
        const xa = x0 + ((x1 - x0) * f) / NF;
        const xb = x0 + ((x1 - x0) * (f + 1)) / NF;
        const za = zb + (f % 2 === 0 ? 0 : 3.2);
        const zc = zb + (f % 2 === 0 ? 3.2 : 0);
        for (let r = 0; r < NR; r++) {
          const ya = yTop - ((yTop - yBot) * r) / NR;
          const yb = yTop - ((yTop - yBot) * (r + 1)) / NR;
          const col = f % 2 === 0 ? cA : cB;
          quadFacing(b, [xa, yb, za], [xb, yb, zc], [xb, ya, zc], [xa, ya, za], [0, 0, 1], col);
          quadFacing(b, [xa, yb, za - 0.2], [xb, yb, zc - 0.2], [xb, ya, zc - 0.2], [xa, ya, za - 0.2], [0, 0, -1], shade(col, 0.7));
        }
      }
      addPart(b, ph);
    }
  }

  // --- Katze, die aus dem Flur durch den Türspalt schaut ---
  let catHead: Part | null = null;
  const catLids: Part[] = [];
  const lidSide: number[] = [];
  const CAT_X = X0 - 26;
  const CAT_Y = 34;
  const CAT_Z = DZ0 + 22;
  {
    const fur = rgb(0x77727f);
    const furD = rgb(0x4c4856);
    const hb = new MeshBuilder();
    hb.add(ball(1), fur, mat(0, 0, 0, 0, 0, 0, 17, 15, 19));
    hb.add(ball(0), C.white, mat(13.5, -4.5, 0, 0, 0, 0, 6, 5, 9));
    hb.add(ball(0), C.pink, mat(18.6, -1.4, 0, 0, 0, 0, 1.4, 1.2, 2));
    for (const s of [-1, 1]) {
      // Ohren
      hb.add(cyl(0, 6.5, 4), fur, mat(-1, 15, s * 9.5, 0, 0, s * -0.25, 1, 12, 1.1));
      hb.add(cyl(0, 3.8, 4), C.pink, mat(1.6, 14.4, s * 9.5, 0, 0, s * -0.25, 0.4, 8, 0.9));
      // Augen
      hb.add(ball(0), rgb(0xa8d85a), mat(14.2, 4.2, s * 6.4, 0, 0, 0, 2.4, 3.6, 3));
      hb.add(cube(), C.ink, mat(16.3, 4.2, s * 6.4, 0, 0, 0, 0.6, 5.4, 0.9));
      // Schnurrhaare
      for (let k = -1; k <= 1; k++) hb.add(cube(), C.white, mat(16.5, -4 + k * 1.4, s * 13, s * 0.15, 0, k * 0.12, 0.3, 0.3, 14));
    }
    for (let k = -1; k <= 1; k++) hb.add(cube(), furD, mat(10, 11.5, k * 3.6, 0, 0, -0.5, 1.6, 6, 1.4));
    catHead = addPart(hb);
    for (const s of [-1, 1]) {
      const lb = new MeshBuilder();
      // Lid: hängt von der Oberkante des Auges herab (lokal y = 0 oben)
      lb.add(ball(0), fur, mat(0, -1.9, 0, 0, 0, 0, 2.7, 2.1, 3.3));
      catLids.push(addPart(lb));
      lidSide.push(s);
    }
  }

  const dynGeo = new THREE.BufferGeometry();
  const posArr = new Float32Array(dPos);
  const norArr = new Float32Array(dNor);
  const onArr = new Float32Array(dOn);
  const posAttr = new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage);
  const norAttr = new THREE.BufferAttribute(norArr, 3).setUsage(THREE.DynamicDrawUsage);
  const onAttr = new THREE.BufferAttribute(onArr, 3).setUsage(THREE.DynamicDrawUsage);
  dynGeo.setAttribute('position', posAttr);
  dynGeo.setAttribute('normal', norAttr);
  dynGeo.setAttribute('onormal', onAttr);
  dynGeo.setAttribute('color', new THREE.Float32BufferAttribute(dCol, 3));
  dynGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2000);
  const basePos = new Float32Array(dPos);
  const baseNor = new Float32Array(dNor);
  const baseOn = new Float32Array(dOn);

  // =========================================================================================
  // Netze zusammensetzen
  // =========================================================================================
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const addMesh = (b: MeshBuilder, material: THREE.Material, outline: number): void => {
    if (b.empty) return;
    const g = b.build();
    const mesh = new THREE.Mesh(g, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(g);
    if (outline > 0 && hi) {
      addSmoothNormals(g);
      const o = new THREE.Mesh(g, outlineMaterial(outline));
      o.name = 'outline';
      o.frustumCulled = false;
      group.add(o);
    }
  };
  addMesh(solid, toon, 0.07);
  addMesh(flat, toon, 0);
  const paintMat = toonMaterial({ vertexColors: true });
  paintMat.polygonOffset = true;
  paintMat.polygonOffsetFactor = -2;
  paintMat.polygonOffsetUnits = -6;
  disposables.push(paintMat);
  addMesh(paint, paintMat, 0);
  const paperMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(paperMat);
  addMesh(paper, paperMat, 0);
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(lightCol, 3));
    const m = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    group.add(mesh);
    disposables.push(g, m);
  }
  {
    const mesh = new THREE.Mesh(dynGeo, toon);
    mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(dynGeo);
    if (hi) {
      const o = new THREE.Mesh(dynGeo, outlineMaterial(0.07));
      o.name = 'outline';
      o.frustumCulled = false;
      group.add(o);
    }
  }
  for (const g of geoCache.values()) g.dispose();

  // --- Staub im Lichtstrahl (nur hohe Qualität) ---
  const NM = detail === 2 ? 70 : 0;
  let motes: THREE.InstancedMesh | null = null;
  const moteP = new Float32Array(Math.max(1, NM) * 4);
  if (NM > 0) {
    const g = new THREE.OctahedronGeometry(0.55, 0);
    const m = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    motes = new THREE.InstancedMesh(g, m, NM);
    motes.frustumCulled = false;
    motes.renderOrder = 4;
    group.add(motes);
    disposables.push(g, m, motes);
    for (let k = 0; k < NM; k++) moteP.set([rnd(), rnd(), 0.05 + rnd() * 0.85, rnd() * 10], k * 4);
  }

  // --- Hilfsobjekte für update() ---
  const m4 = new THREE.Matrix4();
  const m4b = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const vv = new THREE.Vector3();
  const setM = (part: Part, x: number, y: number, z: number, ry: number, rx: number, rz: number, s = 1, sy = s): void => {
    e.set(rx, ry, rz, 'YXZ');
    q.setFromEuler(e);
    pv.set(x, y, z);
    sv.set(s, sy, s);
    part.m.compose(pv, q, sv);
  };
  // Anfangslage aller Teile (falls update nie läuft: an Ort und Stelle statt im Ursprung)
  const ballLen = Math.hypot(BALL_B[0] - BALL_A[0], BALL_B[1] - BALL_A[1]);
  // Bodenhöhe längs der Bahn des Balls vorab (heightAt ist für jedes Bild zu teuer)
  const BALL_N = 24;
  const ballGround = new Float32Array(BALL_N + 1);
  for (let k = 0; k <= BALL_N; k++) ballGround[k] = world.heightAt(BALL_A[0] + ((BALL_B[0] - BALL_A[0]) * k) / BALL_N, BALL_A[1] + ((BALL_B[1] - BALL_A[1]) * k) / BALL_N);
  let ballSpin = 0;
  let ballPrev = 0;

  const apply = (time: number): void => {
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      const s0 = part.start * 3;
      const s1 = s0 + part.count * 3;
      if (part.sway !== 0) {
        // Vorhang: unten schwingt mehr als oben
        const ph = part.sway;
        for (let i = s0; i < s1; i += 3) {
          const y = basePos[i + 1];
          const k = Math.max(0, Math.min(1, (WY1 + 20 - y) / (WY1 - WY0 + 42)));
          const kk = k * k;
          const x = basePos[i];
          posArr[i] = x + Math.sin(time * 0.6 + ph + y * 0.02) * 1.6 * kk;
          posArr[i + 1] = y;
          posArr[i + 2] = basePos[i + 2] + (Math.sin(time * 0.9 + ph * 1.7 + x * 0.12) * 0.5 + 0.6) * 2.6 * kk;
        }
        continue;
      }
      nm.getNormalMatrix(part.m);
      const me = part.m.elements;
      const ne = nm.elements;
      for (let i = s0; i < s1; i += 3) {
        const x = basePos[i];
        const y = basePos[i + 1];
        const z = basePos[i + 2];
        posArr[i] = me[0] * x + me[4] * y + me[8] * z + me[12];
        posArr[i + 1] = me[1] * x + me[5] * y + me[9] * z + me[13];
        posArr[i + 2] = me[2] * x + me[6] * y + me[10] * z + me[14];
        let nx = baseNor[i];
        let ny = baseNor[i + 1];
        let nz = baseNor[i + 2];
        let ax = ne[0] * nx + ne[3] * ny + ne[6] * nz;
        let ay = ne[1] * nx + ne[4] * ny + ne[7] * nz;
        let az = ne[2] * nx + ne[5] * ny + ne[8] * nz;
        let l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
        norArr[i] = ax / l;
        norArr[i + 1] = ay / l;
        norArr[i + 2] = az / l;
        nx = baseOn[i];
        ny = baseOn[i + 1];
        nz = baseOn[i + 2];
        ax = ne[0] * nx + ne[3] * ny + ne[6] * nz;
        ay = ne[1] * nx + ne[4] * ny + ne[7] * nz;
        az = ne[2] * nx + ne[5] * ny + ne[8] * nz;
        l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
        onArr[i] = ax / l;
        onArr[i + 1] = ay / l;
        onArr[i + 2] = az / l;
      }
    }
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
    onAttr.needsUpdate = true;
  };

  const place = (time: number, dt: number): void => {
    // Zuschauer hüpfen
    for (let hi2 = 0; hi2 < hoppers.length; hi2++) {
      const h = hoppers[hi2];
      const j = Math.max(0, Math.sin(time * 3.2 + h.ph));
      const cheer = 0.5 + 0.5 * Math.sin(time * 0.35 + h.ph * 0.3);
      setM(h.part, h.x, h.y + j * j * 1.8 * cheer, h.z, h.ry + Math.sin(time * 1.3 + h.ph) * 0.3, 0, Math.sin(time * 3.2 + h.ph) * 0.06 * cheer);
    }
    // Roboter: Wackeln, Schlüssel dreht sich
    for (let ri = 0; ri < robots.length; ri++) {
      const r = robots[ri];
      const ry = Math.PI + Math.sin(time * 0.4 + r.ph) * 0.5;
      const step = Math.sin(time * 5 + r.ph);
      setM(r.body, r.x, r.y + Math.abs(step) * 0.5, r.z, ry, 0, step * 0.08);
      // Schlüssel am Rücken (lokal −z), dreht sich um die Längsachse
      m4b.copy(r.body.m);
      e.set(0, 0, time * 2.5 + r.ph, 'YXZ');
      q.setFromEuler(e);
      pv.set(0, 4.6, -2.1 - 1);
      sv.set(1, 1, 1);
      m4.compose(pv, q, sv);
      // Achse des Schlüssels zeigt nach −z: um 180° gedreht anhängen
      r.key.m.multiplyMatrices(m4b, m4);
      r.key.m.multiply(m4.makeRotationY(Math.PI));
    }
    // Lok und Wagen auf dem Kreis
    {
      const w = 0.24 + 0.05 * Math.sin(time * 0.21);
      const th = time * w;
      for (let k = 0; k < trainParts.length; k++) {
        const a = th - k * 0.44;
        const x = TRAIN_X + Math.cos(a) * TRAIN_R;
        const z = TRAIN_Z + Math.sin(a) * TRAIN_R;
        // Fahrtrichtung: Tangente (wachsender Winkel)
        const ry = Math.atan2(-Math.sin(a), Math.cos(a));
        setM(trainParts[k], x, trainY + Math.abs(Math.sin(time * 9 + k)) * 0.15, z, ry, 0, 0);
      }
      if (trainKey) {
        m4b.copy(trainParts[0].m);
        e.set(time * 3, 0, 0, 'YXZ');
        q.setFromEuler(e);
        pv.set(0, 10.6, -4);
        sv.set(1, 1, 1);
        m4.compose(pv, q, sv);
        trainKey.m.multiplyMatrices(m4b, m4);
      }
    }
    // Ball rollt hin und her
    if (ballPart) {
      const f = (1 - Math.cos(time * ((Math.PI * 2) / 46))) / 2;
      const s = f * ballLen;
      ballSpin += (s - ballPrev) / BALL_R;
      ballPrev = s;
      const x = BALL_A[0] + ((BALL_B[0] - BALL_A[0]) * s) / ballLen;
      const z = BALL_A[1] + ((BALL_B[1] - BALL_A[1]) * s) / ballLen;
      const gk = Math.min(BALL_N - 1e-6, (s / ballLen) * BALL_N);
      const gi = Math.floor(gk);
      const gy = ballGround[gi] + (ballGround[gi + 1] - ballGround[gi]) * (gk - gi);
      setM(ballPart, x, gy + BALL_R, z, Math.atan2(BALL_B[0] - BALL_A[0], BALL_B[1] - BALL_A[1]), ballSpin, 0);
    }
    // Mobile
    if (mobile.length === 2) {
      setM(mobile[0], MX, MY, MZ, time * 0.18, Math.sin(time * 0.5) * 0.02, 0);
      m4b.copy(mobile[0].m);
      e.set(0, -time * 0.45, Math.sin(time * 0.7) * 0.05, 'YXZ');
      q.setFromEuler(e);
      pv.set(0, -18, 0);
      sv.set(1, 1, 1);
      m4.compose(pv, q, sv);
      mobile[1].m.multiplyMatrices(m4b, m4);
    }
    // Katze: schaut ab und zu weiter herein, blinzelt
    if (catHead) {
      const cyc = (time % 14) / 14;
      const peek = Math.min(1, Math.max(0, Math.sin(cyc * Math.PI) * 1.6 - 0.2));
      const tilt = Math.sin(time * 0.6) * 0.12;
      setM(catHead, CAT_X + peek * 5, CAT_Y, CAT_Z - peek * 12, -0.18 * peek + Math.sin(time * 0.31) * 0.08, 0, tilt);
    }
    void dt;
  };
  // Lider: hängen am Kopf, von der Oberkante des Auges aus gestaucht (blinzeln).
  let lidScale = 0.08;
  const placeLids = (): void => {
    if (!catHead) return;
    for (let k = 0; k < catLids.length; k++) {
      const s = lidSide[k];
      m4b.copy(catHead.m);
      pv.set(14.6, 4.2 + 3.6, s * 6.4);
      q.identity();
      sv.set(1, lidScale, 1);
      m4.compose(pv, q, sv);
      catLids[k].m.multiplyMatrices(m4b, m4);
    }
  };

  place(0, 0);
  placeLids();
  apply(0);

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, _fx: FxSink): void {
      void cam;
      place(time, dt);
      const bt = time % 4.3;
      lidScale = 0.08 + 0.92 * (bt < 0.2 ? Math.sin((bt / 0.2) * Math.PI) : 0);
      placeLids();
      apply(time);
      // Staub
      if (motes) {
        for (let k = 0; k < NM; k++) {
          const o = k * 4;
          const a = (moteP[o] + Math.sin(time * 0.05 + moteP[o + 3]) * 0.04 + 1) % 1;
          const b = (moteP[o + 1] + time * 0.004 + Math.sin(time * 0.07 + moteP[o + 3] * 2) * 0.03 + 1) % 1;
          const s = Math.max(0.03, Math.min(0.97, moteP[o + 2] + Math.sin(time * 0.09 + moteP[o + 3]) * 0.04));
          shaftAt(WX0 + (WX1 - WX0) * a, WY0 + (WY1 - WY0) * b, s, vv);
          const tw = 0.6 + 0.4 * Math.sin(time * 1.7 + moteP[o + 3] * 3);
          e.set(time * 0.5 + k, time * 0.3, 0, 'YXZ');
          q.setFromEuler(e);
          sv.setScalar(tw * (1.2 + (k % 3) * 0.5));
          m4.compose(vv, q, sv);
          motes.setMatrixAt(k, m4);
        }
        motes.instanceMatrix.needsUpdate = true;
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
