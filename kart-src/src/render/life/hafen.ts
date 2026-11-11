// Kulisse des Sturmhafens: ein Hafen, in dem trotz Sturm gearbeitet wird.
//
// Am Kai liegt ein Containerfrachter längsseits und schaukelt an seinen Leinen,
// vor dem Hafenamt hängen die Sturmbälle am Signalmast, Zuschauer stehen unter
// Schirmen. Die Containergasse ist eine Schlucht aus bunten Stapeln mit
// Flutlicht, Portalhubwagen und flatternden Planen. Draußen auf der Mole liegen
// Tetrapoden, der rot-weiße Leuchtturm schwenkt sein Feuer, das Nebelhorn
// bläst, Möwen stehen im Wind. Im Becken zerren Schlepper und Kutter an ihren
// Leinen, an der Hafeneinfahrt blinken die Molenfeuer, draußen zieht eine Fähre
// vorbei. Am Kranplatz fahren die Laufkatzen dreier Portalkrane Container über
// die Bahn, an der Pier liegt ein Stückgutfrachter, die Ladeluke ist ein offener
// Laderaum, und die Lagerhalle bekommt Giebel und Rolltore.
//
// Wetter: Wellenkämme mit Schaumkronen ziehen übers Wasser, Gischt schlägt an
// Kaimauer und Mole hoch, Regen fällt schräg (nur hohe Qualität), in der Ferne
// wetterleuchten Wolkenbänke.
//
// Technik (harte Vorgabe, siehe toon.ts): nur Eckenfarben, Toon-Material mit
// Kontur, MeshBasicMaterial, Instanzen und Netze mit je Bild neu gesetzten
// Ecken – keine eigenen Shader, keine Texturen. Alles, was sich bewegt (Schiffe,
// Möwen, Laufkatzen, Fahnen …), steckt in EINEM Netz, dessen Ecken je Bild aus
// einer Grundform und der Lage jedes Teils neu berechnet werden. Im Lauf wird
// nichts angelegt.

import * as THREE from 'three';
import { EDGE_GAP, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { seeded, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Der Sturm weht vom Meer im Südosten nach Nordwesten (Einheitsvektor, wohin). */
const WX = -0.6;
const WZ = 0.8;
/** Drehung um die Hochachse, mit der lokales +z mit dem Wind zeigt. */
const LEE = Math.atan2(WX, WZ);
/** Höhe der Tunnelröhre (wie world.ts) – für die Giebel der Lagerhalle. */
const TUNNEL_H = 7.4;

// --- Werkzeug: Flächen sammeln, mit Lage ------------------------------------------

const tv = new THREE.Vector3();
const tp = new THREE.Vector3();
const ts = new THREE.Vector3();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tm = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Wie MeshBuilder, aber jede Fläche geht durch die aktuelle Lage (m): Körper
 * lassen sich in eigenen Koordinaten bauen und dann an ihren Platz stellen.
 */
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

  /** Viereck mit eigener Farbe je Ecke (Verläufe, z. B. Lichtkegel). */
  quadV(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    for (const [p, q] of [
      [a, ca],
      [b, cb],
      [c, cc],
      [a, ca],
      [c, cc],
      [d, cd],
    ] as [V3, RGB][]) {
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

  /** Dreieck wie flaeche(). */
  dreieck(a: V3, b: V3, c: V3, color: RGB, ref: V3, aus = true): void {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const g = nx * (a[0] - ref[0]) + ny * (a[1] - ref[1]) + nz * (a[2] - ref[2]);
    if (g >= 0 === aus) this.tri(a, b, c, color);
    else this.tri(a, c, b, color);
  }

  /** Quader um (cx, cy, cz), um die Hochachse gedreht (wie MeshBuilder.box). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
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
    this.quad(v[0], v[1], v[5], v[4], color);
  }

  /** Quader ohne Boden (steht auf etwas – spart zwei Dreiecke). */
  klotz(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
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
  }

  /** Fertige three.js-Geometrie, einfarbig, mit eigener Lage (Euler YXZ) in der aktuellen Lage. */
  geo(g: THREE.BufferGeometry, color: RGB, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): void {
    te.set(rx, ry, rz, 'YXZ');
    tq.setFromEuler(te);
    tm.compose(tp.set(x, y, z), tq, ts.set(sx, sy, sz));
    this.geoM(g, color, tm);
  }

  /** Geometrie mit Drehung aus einem Quaternion. */
  geoQ(g: THREE.BufferGeometry, color: RGB, x: number, y: number, z: number, rot: THREE.Quaternion, s = 1): void {
    tm.compose(tp.set(x, y, z), rot, ts.set(s, s, s));
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

// --- Bewegte Teile ------------------------------------------------------------------

/** 0 = starr (Lage samt Normalen), 1 = starr, nur Lage (kaum gedreht: Schiffe), 2 = Tuch (flattert). */
type Art = 0 | 1 | 2;

interface Teil {
  v0: number;
  v1: number;
  art: Art;
  /** Lage des Teils in der Welt (je Bild gesetzt). */
  m: THREE.Matrix4;
  /** Tuch: Länge, Ausschlag, Wellenzahl, Takt, Phase. */
  len: number;
  amp: number;
  k: number;
  w: number;
  ph: number;
}

/** Sammelt bewegte Teile, jedes in eigenen Koordinaten gebaut. */
class Teile extends Bau {
  readonly liste: Teil[] = [];
  private start = 0;

  beginn(): void {
    this.frei();
    this.start = this.verts;
  }

  ende(art: Art, tuch?: { len: number; amp: number; k: number; w: number; ph: number }): number {
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
    });
    return this.liste.length - 1;
  }
}

/** Geglättete Normalen je Teil (für die Kontur) – Teile, die sich am Ursprung überlagern, mischen sich so nicht. */
function glatteNormalen(pos: Float32Array, nor: Float32Array, teile: Teil[]): Float32Array {
  const out = new Float32Array(pos.length);
  const sums = new Map<string, number[]>();
  for (const p of teile) {
    sums.clear();
    for (let i = p.v0; i < p.v1; i++) {
      const key = `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
      const s = sums.get(key);
      if (s) {
        s[0] += nor[i * 3];
        s[1] += nor[i * 3 + 1];
        s[2] += nor[i * 3 + 2];
      } else sums.set(key, [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]]);
    }
    for (let i = p.v0; i < p.v1; i++) {
      const key = `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
      const s = sums.get(key)!;
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      out[i * 3] = p.art === 2 ? 0 : s[0] / l;
      out[i * 3 + 1] = p.art === 2 ? 0 : s[1] / l;
      out[i * 3 + 2] = p.art === 2 ? 0 : s[2] / l;
    }
  }
  return out;
}

// --- Farben -------------------------------------------------------------------------

const C = {
  ink: rgb(0x1b1d24),
  beton: rgb(0x9a9a94),
  betonH: rgb(0xb3b1a8),
  betonD: rgb(0x5f6266),
  algen: rgb(0x22302c),
  gelb: rgb(0xf2c230),
  weiss: rgb(0xf2efe6),
  rot: rgb(0xd8433a),
  rotD: rgb(0x8f2a2a),
  schwarz: rgb(0x23262d),
  stahl: rgb(0x6f7780),
  holz: rgb(0x8a6a48),
  holzD: rgb(0x5e4630),
  fenster: rgb(0x2b3d52),
  kran: rgb(0xe0582b),
  kranD: rgb(0xa8401f),
  reifen: rgb(0x1e1f24),
  wasser: rgb(0x1d3746),
};
const TETRA: V3[] = [
  [0, 1, 0],
  [0.943, -0.333, 0],
  [-0.471, -0.333, 0.816],
  [-0.471, -0.333, -0.816],
];
const BOX_FARBEN = [0xd8433a, 0x2f6fb0, 0xf08a2a, 0x1f9e8f, 0xf2c230, 0x3f8f4f, 0xd9dde0, 0x8a2f3a, 0x2f4a8a, 0xe8642c];

export function buildHafenLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail === 2;
  const lines = detail > 0;
  const SEA = th.liquidY ?? -3.2;
  const rnd = seeded(9100 + t.index * 53);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

  // Vier Sammler: große Körper mit Kontur, Kleinkram ohne, Leuchtendes ohne Licht, Bewegtes.
  const gross = new Bau();
  const klein = new Bau();
  const glut = new Bau();
  const dyn = new Teile();
  /** Lichtkegel (additiv): Leuchtfeuer (dreht sich) und Flutlicht. */
  const licht = new Bau();

  // --- Strecke ----------------------------------------------------------------------
  const S = (m: number): number => Math.max(0, Math.min(t.n - 1, Math.round(m / t.step)));
  const br = t.branches[0];
  const SB = (m: number): number => (br ? br.first + Math.max(0, Math.min(br.count - 1, Math.round(m / t.step))) : 0);
  const X = (i: number, lat: number): number => t.px[i] + rightX(t, i) * lat;
  const Z = (i: number, lat: number): number => t.pz[i] + rightZ(t, i) * lat;
  const HD = (i: number): number => Math.atan2(t.tx[i], t.tz[i]);
  const ground = (x: number, z: number): number => world.heightAt(x, z);
  /** Mindestens 3 m (plus Radius r) von jeder Fahrbahnkante entfernt? */
  const frei = (x: number, z: number, r: number): boolean => world.clearance(x, z) >= 3 + r;
  /** Eigene Belegung: Kreise (x, z, r), damit nichts ineinander steht. */
  const belegt: number[] = [];
  const platz = (x: number, z: number, r: number): boolean => {
    for (let k = 0; k < belegt.length; k += 3) if (Math.hypot(x - belegt[k], z - belegt[k + 1]) < r + belegt[k + 2]) return false;
    return true;
  };
  const merke = (x: number, z: number, r: number): void => {
    belegt.push(x, z, r);
  };

  // Gischt an Mauern: x, y, z, nx, nz (nach außen), Phase
  const gischt: number[] = [];
  // Lichter (Instanzen): x, y, z, Größe, Art, Phase, Teil (−1 = fest), Farbe
  const lichter: number[] = [];
  /** Art: 0 stetig, 1 blinkt, 2 Blitz, 3 Leuchtfeuer, 4 Molenfeuer (lang an, kurz aus) */
  const lampe = (x: number, y: number, z: number, size: number, art: number, phase: number, color: number, teil = -1): void => {
    lichter.push(x, y, z, size, art, phase, teil, color);
  };

  // --- Bausteine ----------------------------------------------------------------------

  /** Poller: kurzer Stahlpilz, gelb gekappt. */
  const poller = (b: Bau, x: number, y: number, z: number): void => {
    b.geo(new THREE.CylinderGeometry(0.28, 0.34, 0.7, 6, 1, true), C.schwarz, x, y + 0.35, z);
    b.geo(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 6), C.gelb, x, y + 0.75, z);
  };

  /** Laterne: Mast, Ausleger zur Bahn hin (+x lokal), leuchtender Kopf. */
  const laterne = (x: number, y: number, z: number, rot: number, h = 6.5): void => {
    klein.lage(x, y, z, rot);
    klein.box(0, h / 2, 0, 0.22, h, 0.22, C.schwarz);
    klein.box(0.7, h - 0.1, 0, 1.6, 0.16, 0.16, C.schwarz);
    klein.box(1.4, h - 0.32, 0, 0.7, 0.3, 0.45, C.schwarz);
    glut.lage(x, y, z, rot);
    glut.box(1.4, h - 0.52, 0, 0.6, 0.12, 0.38, rgb(0xffe6a0));
    klein.frei();
    glut.frei();
  };

  /**
   * Containerstapel (je 12,2 m lang entlang z, 2,6 m hoch): je Lage nur die vier
   * Seiten, oben ein Deckel; Riffelung nur auf der Seite +x (zur Bahn), wenn riffel.
   */
  const stapel = (b: Bau, x: number, y: number, z: number, rot: number, farben: number[], riffel: boolean, lang = 12.2): void => {
    b.lage(x, y, z, rot);
    const hx = 1.22;
    const hz = lang / 2;
    for (let k = 0; k < farben.length; k++) {
      const c = rgb(farben[k]);
      const d: RGB = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72];
      const y0 = k * 2.6;
      const y1 = y0 + 2.6;
      const dx = (k % 2) * 0.12 - 0.06;
      b.quad([hx + dx, y0, hz], [hx + dx, y0, -hz], [hx + dx, y1, -hz], [hx + dx, y1, hz], c);
      b.quad([-hx + dx, y0, -hz], [-hx + dx, y0, hz], [-hx + dx, y1, hz], [-hx + dx, y1, -hz], c);
      b.quad([-hx + dx, y0, hz], [hx + dx, y0, hz], [hx + dx, y1, hz], [-hx + dx, y1, hz], d);
      b.quad([hx + dx, y0, -hz], [-hx + dx, y0, -hz], [-hx + dx, y1, -hz], [hx + dx, y1, -hz], d);
      if (riffel) {
        for (let r = 0; r < 3; r++) {
          const z0 = -hz + lang * (0.12 + r * 0.3);
          b.quad([hx + dx + 0.02, y0 + 0.2, z0 + lang * 0.14], [hx + dx + 0.02, y0 + 0.2, z0], [hx + dx + 0.02, y1 - 0.2, z0], [hx + dx + 0.02, y1 - 0.2, z0 + lang * 0.14], d);
        }
      }
      if (k === farben.length - 1) b.quad([-hx + dx, y1, -hz], [-hx + dx, y1, hz], [hx + dx, y1, hz], [hx + dx, y1, -hz], [c[0] * 0.86, c[1] * 0.86, c[2] * 0.86]);
    }
    b.frei();
  };
  const farbenListe = (h: number): number[] => {
    const out: number[] = [];
    for (let k = 0; k < h; k++) out.push(pick(BOX_FARBEN));
    return out;
  };

  // --- Rumpf: ein Schiffskörper aus Spanten -------------------------------------------
  /** Rumpf längs z (Bug +z), Wasserlinie y = 0. Gibt die Decks-Höhe zurück. */
  const rumpf = (b: Bau, L: number, Bm: number, Hd: number, draft: number, cBand: RGB, cHull: RGB, cBoot: RGB, cDeck: RGB, spiegel = 0.86): void => {
    const st: [number, number, number][] = [
      [-L / 2, spiegel, 0.5],
      [-L / 2 + 0.12 * L, 1, 0],
      [L / 2 - 0.32 * L, 1, 0],
      [L / 2 - 0.14 * L, 0.84, 0.35],
      [L / 2 - 0.04 * L, 0.42, 0.9],
      [L / 2, 0.06, 1.2],
    ];
    const prof = (k: number, s: number): V3[] => {
      const [z, f, sh] = st[k];
      const hb = (f * Bm) / 2;
      return [
        [s * hb, Hd + sh, z],
        [s * hb, Hd + sh - 0.9, z],
        [s * hb * 0.96, 0.3, z],
        [s * hb * 0.66, -draft, z + (k === st.length - 1 ? -1.5 : 0)],
      ];
    };
    const cols = [cBand, cHull, cBoot];
    for (let k = 0; k < st.length - 1; k++) {
      const zm = (st[k][0] + st[k + 1][0]) / 2;
      const ref: V3 = [0, Hd * 0.4, zm];
      for (const s of [-1, 1]) {
        const a = prof(k, s);
        const c = prof(k + 1, s);
        for (let q = 0; q < 3; q++) b.flaeche(a[q], c[q], c[q + 1], a[q + 1], cols[q], ref);
      }
      const l0 = prof(k, -1);
      const l1 = prof(k + 1, -1);
      const r0 = prof(k, 1);
      const r1 = prof(k + 1, 1);
      b.flaeche(l0[0], l1[0], r1[0], r0[0], cDeck, [0, -50, zm]);
      b.flaeche(l0[3], l1[3], r1[3], r0[3], cBoot, [0, 50, zm]);
    }
    // Spiegel (Heck) und Steven
    for (const k of [0, st.length - 1]) {
      const l = prof(k, -1);
      const r = prof(k, 1);
      const ref: V3 = [0, Hd * 0.4, 0];
      for (let q = 0; q < 3; q++) b.flaeche(l[q], r[q], r[q + 1], l[q + 1], cols[q], ref);
    }
  };

  // ==================================================================================
  // 1. Kaimauern: Kai (Süden), Kaimauer (Norden), Pier am Kranplatz (Westen)
  // ==================================================================================

  interface Kaje {
    m0: number;
    step: number;
    lo: number[];
    y: number;
    sd: number;
  }
  /** Lage der Kaikante (Abstand von der Mitte) bei Meter m – oder NaN. */
  const kanteAt = (k: Kaje | null, m: number): number => {
    if (!k) return NaN;
    const f = (m - k.m0) / k.step;
    if (f < 0 || f > k.lo.length - 1) return NaN;
    const a = Math.floor(f);
    const b = Math.min(k.lo.length - 1, a + 1);
    return k.lo[a] + (k.lo[b] - k.lo[a]) * (f - a);
  };

  const kaje = (m0: number, m1: number, sd: number, minOut: number, maxOut: number): Kaje | null => {
    const step = 4;
    const lo: number[] = [];
    for (let m = m0; m <= m1 + 0.01; m += step) {
      const i = S(m);
      let found = NaN;
      for (let lat = t.wh[i] + minOut; lat < t.wh[i] + maxOut; lat += 1.5) {
        if (ground(X(i, sd * lat), Z(i, sd * lat)) < SEA - 0.6) {
          found = lat - 1;
          break;
        }
      }
      lo.push(found);
    }
    const ok = lo.filter((v) => !Number.isNaN(v)).length;
    if (ok < lo.length * 0.5) return null;
    for (let k = 0; k < lo.length; k++) {
      if (!Number.isNaN(lo[k])) continue;
      let a = k;
      while (a >= 0 && Number.isNaN(lo[a])) a--;
      let b = k;
      while (b < lo.length && Number.isNaN(lo[b])) b++;
      lo[k] = a >= 0 && b < lo.length ? Math.max(lo[a], lo[b]) : a >= 0 ? lo[a] : lo[b];
    }
    // Glätten: erst das Maximum der Nachbarn (nie über Wasser enden), dann mitteln.
    const mx = lo.map((_, k) => Math.max(...lo.slice(Math.max(0, k - 2), k + 3)));
    for (let k = 0; k < lo.length; k++) {
      const w = mx.slice(Math.max(0, k - 2), k + 3);
      lo[k] = w.reduce((s, v) => s + v, 0) / w.length;
    }
    // Höhe der Kaifläche: über dem höchsten Gelände darunter.
    let y = -Infinity;
    for (let k = 0; k < lo.length; k++) {
      const i = S(m0 + k * step);
      y = Math.max(y, t.py[i] - 0.15);
      for (let f = 0; f <= 1; f += 0.25) {
        const lat = t.wh[i] + 3 + (lo[k] - t.wh[i] - 3) * f;
        y = Math.max(y, ground(X(i, sd * lat), Z(i, sd * lat)) + 0.1);
      }
    }
    const K: Kaje = { m0, step, lo, y, sd };
    // Flächen
    const slab = [C.beton, C.betonH];
    let prevIn: V3 | null = null;
    let prevOut: V3 | null = null;
    let prevEdge: V3 | null = null;
    for (let k = 0; k < lo.length; k++) {
      const i = S(m0 + k * step);
      const li = t.wh[i] + 3;
      const pin: V3 = [X(i, sd * li), y, Z(i, sd * li)];
      const pout: V3 = [X(i, sd * lo[k]), y, Z(i, sd * lo[k])];
      const pedge: V3 = [X(i, sd * (lo[k] - 0.5)), y, Z(i, sd * (lo[k] - 0.5))];
      if (prevIn && prevOut && prevEdge) {
        const below: V3 = [(pin[0] + prevOut[0]) / 2, y - 20, (pin[2] + prevOut[2]) / 2];
        klein.flaeche(prevIn, pin, pedge, prevEdge, slab[k % 2], below);
        klein.flaeche(prevEdge, pedge, pout, prevOut, C.gelb, below);
        // Bordkante zur Bahn hin
        klein.flaeche(prevIn, pin, [pin[0], y - 0.8, pin[2]], [prevIn[0], y - 0.8, prevIn[2]], C.betonD, pout);
        // Kaimauer zum Wasser, unten nass und bewachsen
        const wet = SEA + 0.9;
        klein.flaeche(prevOut, pout, [pout[0], wet, pout[2]], [prevOut[0], wet, prevOut[2]], C.betonD, pin);
        klein.flaeche([prevOut[0], wet, prevOut[2]], [pout[0], wet, pout[2]], [pout[0], SEA - 2.5, pout[2]], [prevOut[0], SEA - 2.5, prevOut[2]], C.algen, pin);
        // Schaumsaum am Fuß der Mauer
        const ox = sd * rightX(t, i);
        const oz = sd * rightZ(t, i);
        const f1 = 0.6 + ((k * 7) % 5) * 0.25;
        glut.quad([prevOut[0], SEA + 0.08, prevOut[2]], [pout[0], SEA + 0.08, pout[2]], [pout[0] + ox * f1, SEA + 0.08, pout[2] + oz * f1], [prevOut[0] + ox * 1.1, SEA + 0.08, prevOut[2] + oz * 1.1], rgb(0xe9f3f5));
      }
      // Stirnseiten
      if (k === 0 || k === lo.length - 1) {
        const j = S(m0 + (k === 0 ? 1 : lo.length - 2) * step);
        const ref: V3 = [t.px[j], y, t.pz[j]];
        klein.flaeche(pin, pout, [pout[0], SEA - 2.5, pout[2]], [pin[0], SEA - 2.5, pin[2]], C.betonD, ref);
      }
      prevIn = pin;
      prevOut = pout;
      prevEdge = pedge;
    }
    // Poller, Fender, Gischtpunkte
    for (let m = m0 + 6; m < m1 - 2; m += 14) {
      const i = S(m);
      const l = kanteAt(K, m) - 0.9;
      poller(klein, X(i, sd * l), y, Z(i, sd * l));
    }
    for (let m = m0 + 3; m < m1 - 1; m += 9) {
      const i = S(m);
      const l = kanteAt(K, m) + 0.25;
      klein.lage(X(i, sd * l), SEA + 1.4, Z(i, sd * l), HD(i));
      klein.box(0, 0, 0, 0.5, 1.6, 1.0, C.reifen);
      klein.frei();
    }
    for (let m = m0 + 2; m < m1; m += 9) {
      const i = S(m);
      const l = kanteAt(K, m) + 0.6;
      gischt.push(X(i, sd * l), SEA, Z(i, sd * l), sd * rightX(t, i), sd * rightZ(t, i), rnd());
    }
    return K;
  };

  const kai = kaje(14, 296, -1, 18, 70);
  const kaimauer = kaje(832, 904, -1, 14, 60);
  const pier = kaje(1094, 1292, -1, 14, 70);

  // Laternen am Kai (beide Seiten) und an der Kaimauer
  for (let m = 26; m < 300; m += 30) {
    const i = S(m);
    const lr = t.wh[i] + 3.3;
    laterne(X(i, lr), ground(X(i, lr), Z(i, lr)), Z(i, lr), HD(i));
    if (kai) laterne(X(i, -lr), kai.y, Z(i, -lr), HD(i) + Math.PI);
  }
  if (kaimauer) {
    for (let m = 840; m < 905; m += 30) {
      const i = S(m);
      const lr = t.wh[i] + 3.3;
      laterne(X(i, -lr), kaimauer.y, Z(i, -lr), HD(i) + Math.PI);
    }
  }
  if (pier) {
    for (let m = 1100; m < 1290; m += 34) {
      const i = S(m);
      const lr = t.wh[i] + 3.3;
      laterne(X(i, -lr), pier.y, Z(i, -lr), HD(i) + Math.PI);
    }
  }

  // ==================================================================================
  // 2. Hafenamt mit Signalmast und Sturmbällen; Zuschauer
  // ==================================================================================
  /** Sturmbälle: Teil, Aufhängung x, y, z, Phase */
  const baelle: number[] = [];
  /** Tücher: Teil, x, y, z, Grunddrehung, Neigung */
  const tuecher: number[] = [];
  const tuch = (
    x: number,
    y: number,
    z: number,
    L: number,
    H: number,
    farben: RGB[],
    streifen: 'quer' | 'laengs' | 'wimpel',
    rot = LEE,
    neig = 0,
  ): void => {
    // Tuch in eigenen Koordinaten: x entlang (vom Mast weg), y nach unten hängend, beidseitig.
    dyn.beginn();
    const NX = 6;
    const NY = 2;
    for (let a = 0; a < NX; a++) {
      for (let b = 0; b < NY; b++) {
        const x0 = (a / NX) * L;
        const x1 = ((a + 1) / NX) * L;
        const taper = (u: number): number => (streifen === 'wimpel' ? 1 - (u / L) * 0.85 : 1);
        const y00 = -(b / NY) * H * taper(x0);
        const y01 = -((b + 1) / NY) * H * taper(x0);
        const y10 = -(b / NY) * H * taper(x1);
        const y11 = -((b + 1) / NY) * H * taper(x1);
        const c = streifen === 'quer' ? farben[b % farben.length] : farben[a % farben.length];
        dyn.quad([x0, y00, 0], [x0, y01, 0], [x1, y11, 0], [x1, y10, 0], c);
        dyn.quad([x1, y10, 0], [x1, y11, 0], [x0, y01, 0], [x0, y00, 0], c);
      }
    }
    const p = dyn.ende(2, { len: L, amp: 0.22 * L, k: 5.2 / L, w: 9 + rnd() * 3, ph: rnd() * 6 });
    tuecher.push(p, x, y, z, rot, neig);
  };

  let amtSig: V3 = [0, 0, 0];
  {
    const i = S(52);
    const sd = 1;
    const w = 18;
    const d = 11;
    const lat = t.wh[i] + 4 + d / 2;
    const x = X(i, sd * lat);
    const z = Z(i, sd * lat);
    const g = Math.min(ground(x, z), t.py[i]) - 0.3;
    // lokal: +x zur Bahn, z entlang
    const rot = HD(i);
    gross.lage(x, g, z, rot);
    const ziegel = rgb(0xa4473a);
    const ziegelD = rgb(0x7f3329);
    gross.box(0, 3.8, 0, d, 7.6, w, ziegel, 0, rgb(0x3d4652));
    gross.box(0, 7.9, 0, d + 0.6, 0.6, w + 0.6, C.weiss);
    gross.box(0, 0.5, 0, d + 0.2, 1, w + 0.2, rgb(0x5e5a55));
    // Turm an der Ecke zur Bahn, mit Ausguck
    gross.box(1.5, 7.5, -w / 2 + 2.6, 4.6, 15, 4.6, ziegelD);
    gross.box(1.5, 15.6, -w / 2 + 2.6, 5.4, 0.5, 5.4, C.weiss);
    gross.box(1.5, 17.0, -w / 2 + 2.6, 4.4, 2.4, 4.4, C.weiss);
    gross.box(1.5, 18.5, -w / 2 + 2.6, 5.6, 0.5, 5.6, rgb(0x2e3540));
    gross.box(1.5, 19.0, -w / 2 + 2.6, 2.4, 0.6, 2.4, rgb(0x2e3540));
    // Signalmast mit Rah
    const mx = 1.5;
    const mz = -w / 2 + 2.6;
    gross.box(mx, 25, mz, 0.35, 12, 0.35, C.weiss);
    gross.box(mx, 28.2, mz, 0.22, 0.22, 7.2, C.weiss);
    gross.stab([mx, 19.3, mz - 2.6], [mx, 28.1, mz - 3.5], 0.06, C.ink);
    gross.stab([mx, 19.3, mz + 2.6], [mx, 28.1, mz + 3.5], 0.06, C.ink);
    // Fenster (leuchten warm) zur Bahn hin, Tür
    glut.lage(x, g, z, rot);
    for (let fl = 0; fl < 2; fl++) {
      for (let k = 0; k < 5; k++) {
        const zz = -w / 2 + 6 + k * 2.6;
        glut.box(d / 2 + 0.03, 2.6 + fl * 3.2, zz, 0.06, 1.5, 1.3, fl === 1 && k % 2 === 0 ? rgb(0xffd98a) : rgb(0x8fb2c8));
      }
    }
    glut.box(1.5 + 2.23, 17.1, mz, 0.04, 1.4, 3.6, rgb(0xffe6a0));
    glut.box(1.5, 17.1, mz + 2.23, 3.6, 1.4, 0.04, rgb(0xffe6a0));
    glut.box(1.5, 17.1, mz - 2.23, 3.6, 1.4, 0.04, rgb(0xffe6a0));
    gross.box(d / 2 + 0.05, 1.4, w / 2 - 3, 0.1, 2.8, 2.0, rgb(0x2f5f7a));
    // Weiße Fensterrahmen-Bänder
    gross.box(d / 2 + 0.02, 1.7, 0.5, 0.06, 0.2, w - 6, C.weiss);
    gross.box(d / 2 + 0.02, 4.9, 0.5, 0.06, 0.2, w - 6, C.weiss);
    gross.frei();
    glut.frei();
    // Weltlage des Mastkopfs
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const wx = (lx: number, lz: number): number => x + lx * c + lz * s;
    const wz = (lx: number, lz: number): number => z - lx * s + lz * c;
    amtSig = [wx(mx, mz), g + 31.2, wz(mx, mz)];
    lampe(amtSig[0], amtSig[1], amtSig[2], 0.9, 1, 0, 0xff3b30);
    // Sturmbälle: zwei Bälle und ein Kegel an der Rah
    for (let k = 0; k < 3; k++) {
      dyn.beginn();
      dyn.geo(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 3), C.ink, 0, -0.8, 0);
      if (k < 2) dyn.geo(new THREE.IcosahedronGeometry(0.75, 0), C.schwarz, 0, -2.3, 0);
      else dyn.geo(new THREE.ConeGeometry(0.85, 1.6, 8), C.schwarz, 0, -2.4, 0, Math.PI);
      const p = dyn.ende(0);
      const lz = mz - 2.6 + k * 2.6;
      baelle.push(p, wx(mx, lz), g + 28.0, wz(mx, lz), k * 1.7);
    }
    // Hafenflagge am Turm und Wimpel an der Mastspitze
    tuch(amtSig[0], g + 31.0, amtSig[2], 4.2, 0.9, [rgb(0x2f6fb0), C.weiss, rgb(0xd8433a)], 'wimpel');
    tuch(wx(mx + 2.2, mz + 2.2), g + 23.6, wz(mx + 2.2, mz + 2.2), 3.4, 2.2, [rgb(0x2f6fb0), C.weiss], 'quer');
    gross.lage(wx(mx + 2.2, mz + 2.2), g + 19, wz(mx + 2.2, mz + 2.2), 0);
    gross.box(0, 2.4, 0, 0.14, 4.8, 0.14, C.weiss);
    gross.frei();
    merke(x, z, Math.hypot(w, d) / 2 + 1);
  }

  // Zuschauer unter Schirmen: am Start auf beiden Seiten
  /** Schirme: Teil, x, y, z, Phase */
  const schirme: number[] = [];
  {
    const coats = [0xffd23f, 0xd8433a, 0x1f9e8f, 0x2f4a8a, 0xf08a2a, 0x3f8f4f];
    const skins = [0xf1c7a1, 0xc98d64, 0x8a5a3c, 0xe8b48a];
    const umbr = [
      [0xd8433a, 0xf2efe6],
      [0x2f6fb0, 0xf2c230],
      [0x1f9e8f, 0xf2efe6],
      [0x23262d, 0x23262d],
      [0xf08a2a, 0xf2efe6],
      [0x8a2f3a, 0xf2c230],
    ];
    const want = hi ? 16 : detail === 1 ? 12 : 7;
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < want; tries++) {
      const m = (tries % 2 === 0 ? -14 : 6) + rnd() * 26;
      const sd = tries % 3 === 0 ? -1 : 1;
      const i = S((m + t.length) % t.length);
      const lat = t.wh[i] + 3.6 + rnd() * 4.5;
      const x = X(i, sd * lat);
      const z = Z(i, sd * lat);
      if (!frei(x, z, 0.4) || !platz(x, z, 0.75)) continue;
      const y = sd < 0 && kai && kanteAt(kai, m) > lat + 1 ? kai.y : ground(x, z);
      merke(x, z, 0.75);
      placed++;
      const rot = HD(i) + (sd > 0 ? -Math.PI / 2 : Math.PI / 2);
      const coat = rgb(pick(coats));
      klein.lage(x, y, z, rot + (rnd() - 0.5) * 0.6);
      klein.box(0, 0.45, 0, 0.42, 0.9, 0.3, C.schwarz);
      klein.box(0, 1.25, 0, 0.62, 0.8, 0.4, coat);
      klein.geo(new THREE.IcosahedronGeometry(0.21, 0), rgb(pick(skins)), 0, 1.86, 0);
      klein.box(0, 2.02, 0, 0.36, 0.14, 0.36, coat);
      klein.frei();
      // Schirm: acht Bahnen im Wechsel, Stock; kippt im Wind
      dyn.beginn();
      const [ca, cb] = pick(umbr);
      const R = 0.95;
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2;
        const a1 = ((k + 1) / 8) * Math.PI * 2;
        const p0: V3 = [Math.cos(a0) * R, 0, Math.sin(a0) * R];
        const p1: V3 = [Math.cos(a1) * R, 0, Math.sin(a1) * R];
        const col = rgb(k % 2 === 0 ? ca : cb);
        dyn.tri([0, 0.42, 0], p1, p0, col);
        dyn.tri([0, 0.36, 0], p0, p1, [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6]);
      }
      dyn.box(0, -0.55, 0, 0.05, 1.1, 0.05, C.ink);
      const p = dyn.ende(0);
      schirme.push(p, x + 0.25, y + 2.1, z, rnd() * 6);
    }
  }

  // ==================================================================================
  // 3. Containerfrachter am Kai
  // ==================================================================================
  /** Schiffe: Teil, x, y, z, Kurs, Rollen, Stampfen, Hub, Phase */
  const schiffe: number[] = [];
  {
    const L = 98;
    const Bm = 16;
    const Hd = 4.6;
    const m = 118;
    const kl = kanteAt(kai, m);
    if (!Number.isNaN(kl)) {
      const i = S(m);
      const lat = kl + 1.2 + Bm / 2;
      const x = X(i, -lat);
      const z = Z(i, -lat);
      if (ground(x, z) < SEA - 1.5) {
        dyn.beginn();
        rumpf(dyn, L, Bm, Hd, 2.2, C.weiss, rgb(0x9b2b28), C.schwarz, rgb(0x6a7078));
        // Aufbau achtern
        const az = -L / 2 + 9;
        dyn.box(0, Hd + 5, az, Bm * 0.78, 10, 9, C.weiss);
        for (let d = 0; d < 4; d++) dyn.box(0, Hd + 1.6 + d * 2.5, az + 4.52, Bm * 0.7, 0.8, 0.06, C.fenster);
        dyn.box(0, Hd + 10.8, az + 0.5, Bm + 1.2, 1.6, 4, C.weiss);
        dyn.box(0, Hd + 10.9, az + 2.52, Bm + 1, 0.9, 0.06, C.fenster);
        dyn.box(0, Hd + 12.5, az - 3.5, 3.4, 5, 3.8, rgb(0x2f4a8a), 0, C.schwarz);
        dyn.box(0, Hd + 13.2, az - 3.5, 3.5, 1.1, 3.9, C.gelb);
        dyn.box(0, Hd + 14.5, az + 1, 0.3, 4, 0.3, C.weiss);
        // Container in Reihen
        for (let bay = 0; bay < 11; bay++) {
          const bz = -L / 2 + 19 + bay * 6.6;
          if (bz > L / 2 - 14) break;
          for (let c = 0; c < 5; c++) {
            const tiers = 1 + Math.floor(rnd() * 3.2);
            const cx = (c - 2) * 2.7;
            dyn.box(cx, Hd + 0.4 + tiers * 1.3, bz, 2.55, tiers * 2.6, 6.1, rgb(pick(BOX_FARBEN)), 0, undefined);
          }
          dyn.box(0, Hd + 0.2, bz, Bm * 0.9, 0.4, 6.3, rgb(0x3f454e));
        }
        // Back mit Mast
        dyn.box(0, Hd + 2.6, L / 2 - 6, 1.6, 0.3, 4, rgb(0x6a7078));
        dyn.box(0, Hd + 5, L / 2 - 7, 0.3, 6, 0.3, C.weiss);
        const p = dyn.ende(1);
        schiffe.push(p, x, SEA, z, HD(i), 0.018, 0.004, 0.22, 0.3);
        // Festmacherleinen von den Pollern (fest; die Bewegung des Schiffs ist klein)
        const c = Math.cos(HD(i));
        const s = Math.sin(HD(i));
        for (const [lz, mm] of [
          [L / 2 - 8, m + L / 2 + 6],
          [L / 2 - 14, m + L / 2 - 16],
          [-L / 2 + 10, m - L / 2 + 14],
          [-L / 2 + 4, m - L / 2 - 6],
        ]) {
          const j = S(mm);
          const bl = kanteAt(kai, mm) - 0.9;
          if (Number.isNaN(bl)) continue;
          // Schiffsseite zur Kaimauer: lokal −x zeigt nach links der Fahrtrichtung (zur Kaje hin ist +x … hier per Weltpunkt)
          const sx = x + rightX(t, i) * (Bm / 2 - 0.3) + lz * s;
          const sz = z + rightZ(t, i) * (Bm / 2 - 0.3) + lz * c;
          klein.stab([X(j, -bl), kai!.y + 0.7, Z(j, -bl)], [sx, SEA + Hd + 0.4, sz], 0.09, rgb(0xd9c9a0));
        }
        merke(x, z, L / 2);
      }
    }
  }

  // ==================================================================================
  // 4. Containergasse
  // ==================================================================================
  const gasseFrei = (m: number, sd: number, lat: number, i: number): boolean => {
    // Den Streifen links der Bahn bei 360–515 m (bis 14 m hinter der Kante) bebaut ein anderer Auftrag.
    if (sd < 0 && m > 352 && m < 523 && lat < t.wh[i] + 14.5) return false;
    return true;
  };
  {
    const rows = detail === 0 ? 1 : 2;
    for (const sd of [1, -1]) {
      for (let m = 336; m < 530; m += 12.8) {
        const i = S(m + 6.1);
        for (let r = 0; r < rows + (sd < 0 ? 1 : 0); r++) {
          // Links bei 352–523 m erst hinter dem freizuhaltenden Streifen.
          const weit = sd < 0 && (!gasseFrei(m, sd, 0, S(m)) || !gasseFrei(m + 6.1, sd, 0, i) || !gasseFrei(m + 12.2, sd, 0, S(m + 12.2)));
          const lat = t.wh[i] + (weit ? 15.4 : 3.3) + 1.22 + r * 2.75;
          const x = X(i, sd * lat);
          const z = Z(i, sd * lat);
          // Beide Enden prüfen
          const ex = t.tx[i] * 6.1;
          const ez = t.tz[i] * 6.1;
          if (!frei(x + ex, z + ez, 1.3) || !frei(x - ex, z - ez, 1.3) || !frei(x, z, 1.3)) continue;
          if (!platz(x, z, 2)) continue;
          const g = Math.min(ground(x + ex, z + ez), ground(x - ex, z - ez), ground(x, z)) - 0.15;
          if (g < SEA + 0.3) continue;
          let h = 2 + Math.floor(rnd() * 3.5) + (r > 0 ? 1 : 0);
          if (detail === 0) h = Math.min(h, 3);
          if (rnd() < 0.12 && r === 0) h = 1;
          stapel(gross, x, g, z, HD(i) + (sd > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 0.04, farbenListe(h), r === 0);
          merke(x, z, 1.4);
          // Planen auf einzelnen Stapeln
          if (r === 0 && h >= 2 && rnd() < (hi ? 0.18 : 0.08) && tuecher.length < 6 * 6) {
            const top = g + h * 2.6;
            tuch(x - t.tx[i] * 1.8, top + 0.05, z - t.tz[i] * 1.8, 4.2, 3.6, [rgb(0x2f6fb0), rgb(0x2a5c95)], 'laengs', HD(i) + Math.PI / 2 + (sd > 0 ? Math.PI : 0), 0.5);
          }
        }
      }
    }
  }

  // Flutlichtmasten in der Gasse (rechts) und am Kranplatz
  const flutlicht = (m: number, sd: number, out: number, kegel = true): void => {
    const i = S(m);
    const lat = t.wh[i] + out;
    const x = X(i, sd * lat);
    const z = Z(i, sd * lat);
    if (!frei(x, z, 1) || !platz(x, z, 1.2)) return;
    merke(x, z, 1.2);
    const g = ground(x, z);
    const rot = HD(i) + (sd > 0 ? 0 : Math.PI);
    const H = 28;
    gross.lage(x, g, z, rot);
    gross.geo(new THREE.CylinderGeometry(0.35, 0.6, H, 6, 1, true), C.stahl, 0, H / 2, 0);
    gross.box(0.4, H + 0.3, 0, 1.2, 0.4, 5.2, C.schwarz);
    for (let k = 0; k < 3; k++) gross.box(0.55, H + 1.2, -1.7 + k * 1.7, 0.5, 1.4, 1.4, C.schwarz);
    gross.frei();
    glut.lage(x, g, z, rot);
    for (let k = 0; k < 3; k++) glut.box(0.83, H + 1.2, -1.7 + k * 1.7, 0.06, 1.1, 1.1, rgb(0xfff6d8));
    glut.frei();
    // Lichtkegel schräg nach unten zur Bahn
    if (!kegel) return;
    const hx = x - rightX(t, i) * sd * 0.8;
    const hz = z - rightZ(t, i) * sd * 0.8;
    const tx2 = X(i, sd * (t.wh[i] * 0.3));
    const tz2 = Z(i, sd * (t.wh[i] * 0.3));
    const top: V3 = [hx, g + H + 1.1, hz];
    const ty = t.py[i] + 0.15;
    const N = 8;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      const r = 7;
      const hell: RGB = [0.26, 0.25, 0.19];
      const aus: RGB = [0.03, 0.03, 0.025];
      licht.quadV(top, top, [tx2 + Math.cos(a1) * r, ty, tz2 + Math.sin(a1) * r], [tx2 + Math.cos(a0) * r, ty, tz2 + Math.sin(a0) * r], hell, hell, aus, aus);
    }
  };
  flutlicht(366, 1, 18);
  flutlicht(452, 1, 18);
  flutlicht(528, 1, 18);
  flutlicht(440, -1, 30);
  flutlicht(1160, 1, 24, false);
  flutlicht(1222, 1, 24, false);

  // Portalhubwagen: einer steht am Gasseneingang, einer pendelt hinter den Stapeln
  /** Hubwagen: Teil, Meter von, Meter bis, Abstand, Phase */
  const hubwagen: number[] = [];
  /** Boden unter der Fahrspur des Hubwagens, je Meter ab Spuranfang. */
  const hubBoden: number[] = [];
  const hubwagenBau = (b: Bau, last: number): void => {
    const H = 12;
    const col = rgb(0xf2c230);
    const colD = rgb(0xc99a1c);
    for (const sx of [-2.4, 2.4]) {
      b.box(sx, 0.7, 0, 0.9, 0.9, 9, C.schwarz);
      for (const sz of [-3.6, 3.6]) b.box(sx, H / 2 + 0.5, sz, 0.6, H - 1, 0.6, col);
      b.box(sx, H, 0, 0.8, 0.9, 8.4, colD);
    }
    b.box(0, H + 0.6, 2.6, 5.6, 0.7, 1.6, colD);
    b.box(0, H + 0.6, -2.6, 5.6, 0.7, 1.6, colD);
    b.box(2.1, H + 1.9, 3.1, 1.8, 1.9, 1.8, C.weiss);
    b.box(2.1, H + 2.1, 4.02, 1.6, 0.9, 0.06, C.fenster);
    b.box(0, H + 0.1, 0, 3.4, 0.4, 7.6, C.schwarz);
    for (const sx of [-2.4, 2.4]) for (const sz of [-3.6, 3.6]) b.box(sx, 0.55, sz, 0.4, 1.1, 1.1, C.reifen);
    if (last) {
      const c = rgb(pick(BOX_FARBEN));
      b.box(0, 4.3, 0, 2.44, 2.6, 7.4, c, 0, [c[0] * 0.86, c[1] * 0.86, c[2] * 0.86]);
    }
  };
  {
    // stehend
    const i = S(342);
    const lat = t.wh[i] + 12.5;
    const x = X(i, lat);
    const z = Z(i, lat);
    if (frei(x, z, 5) && platz(x, z, 5)) {
      merke(x, z, 5);
      gross.lage(x, ground(x, z), z, HD(i));
      hubwagenBau(gross, 1);
      gross.frei();
      lampe(x, ground(x, z) + 15.2, z, 0.55, 1, 0.3, 0xff9a1f);
    }
    // fahrend
    let ok = true;
    for (let m = 372; m < 506 && ok; m += 6) {
      const j = S(m);
      const l = t.wh[j] + 12.5;
      if (!frei(X(j, l), Z(j, l), 4.5) || !platz(X(j, l), Z(j, l), 3)) ok = false;
    }
    if (ok) {
      dyn.beginn();
      hubwagenBau(dyn, 1);
      const p = dyn.ende(0);
      hubwagen.push(p, 376, 502, 12.5, rnd() * 6);
      for (let m = 376; m <= 502; m++) {
        const j = S(m);
        const l = t.wh[j] + 12.5;
        hubBoden.push(ground(X(j, l), Z(j, l)));
      }
      lampe(0, 15.2, 0, 0.55, 1, 0, 0xff9a1f, p);
      for (let m = 372; m < 506; m += 8) {
        const j = S(m);
        const l = t.wh[j] + 12.5;
        merke(X(j, l), Z(j, l), 3);
      }
    }
  }

  // ==================================================================================
  // 5. Mole: Tetrapoden außen, Leuchtturm innen in der Spitzkehre
  // ==================================================================================
  {
    const rq = new THREE.Quaternion();
    const aq = new THREE.Quaternion();
    const tetra = (b: Bau, x: number, y: number, z: number, sc: number): void => {
      // Vier Arme in Tetraeder-Richtungen, je ein dreiseitiger Stumpf.
      rq.setFromEuler(te.set(rnd() * 6, rnd() * 6, rnd() * 6, 'XYZ'));
      const col = rnd() < 0.5 ? C.betonH : rgb(0xc4c0b4);
      for (const d of TETRA) {
        tv.set(d[0], d[1], d[2]).applyQuaternion(rq);
        const dx = tv.x;
        const dy = tv.y;
        const dz = tv.z;
        aq.setFromUnitVectors(UP, tv);
        b.geoQ(new THREE.CylinderGeometry(0.28, 0.5, 1.25, 3, 1, true), col, x + dx * 0.62 * sc, y + dy * 0.62 * sc, z + dz * 0.62 * sc, aq, sc);
      }
    };
    const want = detail === 0 ? 45 : hi ? 95 : 75;
    let n = 0;
    for (let tries = 0; tries < want * 6 && n < want; tries++) {
      const m = 545 + rnd() * 270;
      const i = S(m);
      const lat = t.wh[i] + 4.2 + rnd() * 5;
      const x = X(i, -lat);
      const z = Z(i, -lat);
      if (!frei(x, z, 1.2) || !platz(x, z, 1.5)) continue;
      const g = ground(x, z);
      const y = Math.max(g, SEA - 1.0) + 0.5;
      merke(x, z, 1.5);
      tetra(klein, x, y, z, 1.5 + rnd() * 0.4);
      n++;
      if (n % 3 === 0) gischt.push(x, SEA, z, -rightX(t, i), -rightZ(t, i), rnd());
    }
  }

  /** Leuchtfeuer: Mitte des Lampenhauses. */
  let feuer: V3 = [0, 0, 0];
  let horn: V3 = [0, 0, 0];
  let hornDir = 0;
  {
    const li = t.landmark;
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let a = -40; a <= 40; a += 3) {
      for (let lat = 10; lat <= 45; lat += 2) {
        const i = S(((li * t.step + a) % t.length + t.length) % t.length);
        const x = X(i, lat);
        const z = Z(i, lat);
        const c = world.clearance(x, z);
        if (c < 9 || c > 16) continue;
        const d = Math.hypot(x - X(li, 0), z - Z(li, 0));
        if (d < bestD) {
          bestD = d;
          best = [x, z];
        }
      }
    }
    if (best) {
      const [x, z] = best;
      const g = ground(x, z);
      const base = Math.max(g, SEA) + 0.2;
      const foot = Math.min(g, SEA) - 2;
      // Sockel aus Granitblöcken, achteckig
      gross.lage(x, 0, z, 0.2);
      gross.geo(new THREE.CylinderGeometry(5.2, 6, base + 1.6 - foot, 8), rgb(0x7d7a74), 0, (base + 1.6 + foot) / 2, 0);
      gross.geo(new THREE.CylinderGeometry(5.5, 5.5, 0.35, 8), C.weiss, 0, base + 1.75, 0);
      // Wärterhaus
      gross.box(3.4, base + 3.4, 0, 3.6, 3.2, 4.6, C.weiss, 0, C.rot);
      gross.geo(new THREE.ConeGeometry(3.4, 1.8, 4), C.rot, 3.4, base + 5.9, 0, 0, Math.PI / 4, 0, 1, 1, 1.3);
      // Turm: vier Bänder rot/weiß, nach oben schlanker
      const H = 24;
      const r0 = 2.7;
      const r1 = 1.75;
      const nb = 5;
      for (let k = 0; k < nb; k++) {
        const y0 = base + 1.9 + (k / nb) * H;
        const y1 = base + 1.9 + ((k + 1) / nb) * H;
        const ra = r0 + (r1 - r0) * (k / nb);
        const rb = r0 + (r1 - r0) * ((k + 1) / nb);
        gross.geo(new THREE.CylinderGeometry(rb, ra, y1 - y0, 10, 1, true), k % 2 === 0 ? C.rot : C.weiss, 0, (y0 + y1) / 2, 0);
      }
      const ty = base + 1.9 + H;
      // Galerie mit Geländer, Laterne, Kuppel
      gross.geo(new THREE.CylinderGeometry(2.7, 2.1, 0.6, 10), C.schwarz, 0, ty + 0.3, 0);
      gross.geo(new THREE.CylinderGeometry(2.6, 2.6, 0.9, 10, 1, true), C.schwarz, 0, ty + 1.05, 0);
      gross.geo(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 10), C.schwarz, 0, ty + 0.85, 0);
      gross.geo(new THREE.ConeGeometry(1.9, 1.8, 10), C.rot, 0, ty + 4.7, 0);
      gross.geo(new THREE.SphereGeometry(0.35, 6, 4), C.schwarz, 0, ty + 5.8, 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        gross.box(Math.cos(a) * 1.45, ty + 2.4, Math.sin(a) * 1.45, 0.16, 2.6, 0.16, C.schwarz);
      }
      gross.frei();
      glut.lage(x, 0, z, 0.2);
      glut.geo(new THREE.CylinderGeometry(1.35, 1.35, 2.4, 10, 1, true), rgb(0xfff1b0), 0, ty + 2.4, 0);
      glut.frei();
      feuer = [x, ty + 2.4, z];
      lampe(x, ty + 2.4, z, 2.6, 3, 0, 0xfff6c8);
      // Nebelhorn auf dem Sockel, zur See gerichtet (gegen den Wind)
      hornDir = LEE + Math.PI;
      const hx = x + Math.sin(hornDir) * 4.2;
      const hz = z + Math.cos(hornDir) * 4.2;
      gross.lage(hx, base + 1.9, hz, hornDir);
      gross.box(0, 0.6, -0.6, 1.2, 1.2, 1.2, C.stahl);
      gross.geo(new THREE.CylinderGeometry(0.85, 0.25, 2.4, 8, 1, true), C.gelb, 0, 1.3, 1.0, Math.PI / 2);
      gross.geo(new THREE.CylinderGeometry(0.86, 0.86, 0.15, 8, 1, true), C.schwarz, 0, 1.3, 2.2, Math.PI / 2);
      gross.frei();
      horn = [hx + Math.sin(hornDir) * 2.4, base + 3.2, hz + Math.cos(hornDir) * 2.4];
      merke(x, z, 7);
      // Wimpel an der Galerie
      tuch(x, ty + 6.6, z, 3.0, 0.7, [C.rot, C.weiss], 'wimpel');
      gross.lage(x, ty + 5.8, z, 0);
      gross.box(0, 0.8, 0, 0.1, 1.6, 0.1, C.schwarz);
      gross.frei();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        gischt.push(x + Math.cos(a) * 6.2, SEA, z + Math.sin(a) * 6.2, Math.cos(a), Math.sin(a), rnd());
      }
      // Lichtkegel: zwei gegenüber, je 90 m (in eigenen Koordinaten, je Bild gedreht)
    }
  }
  const beamV0 = licht.verts;
  {
    const N = 8;
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2;
        const a1 = ((k + 1) / N) * Math.PI * 2;
        const q = (a: number, x: number, r: number): V3 => [sgn * x, Math.sin(a) * r - x * 0.05, Math.cos(a) * r];
        const c0: RGB = [0.95, 0.9, 0.62];
        const c1: RGB = [0.08, 0.075, 0.05];
        licht.quadV(q(a0, 1.2, 0.9), q(a1, 1.2, 0.9), q(a1, 95, 9), q(a0, 95, 9), c0, c0, c1, c1);
      }
    }
  }
  const beamV1 = licht.verts;

  // ==================================================================================
  // 6. Hafenbecken: Dalben, Bojen, Schlepper und Kutter an Leinen
  // ==================================================================================
  /** Boote: Teil, Dalbe x, z, Leinenlänge, Phase; Leine: Teil */
  const boote: number[] = [];
  const bojen: number[] = []; // Teil, x, z, Phase
  const tief = (x: number, z: number, d: number): boolean => ground(x, z) < SEA - d;
  const dalbe = (x: number, z: number): void => {
    const g = Math.min(ground(x, z), SEA - 1);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      klein.geo(new THREE.CylinderGeometry(0.32, 0.36, SEA + 4.6 - g, 6), k === 0 ? C.holz : C.holzD, x + Math.cos(a) * 0.42, (SEA + 4.6 + g) / 2, z + Math.sin(a) * 0.42, 0, 0, 0.04);
    }
    klein.geo(new THREE.CylinderGeometry(0.85, 0.85, 0.35, 6, 1, true), C.schwarz, x, SEA + 3.6, z);
    klein.geo(new THREE.CylinderGeometry(0.85, 0.85, 0.35, 6, 1, true), C.schwarz, x, SEA + 1.7, z);
  };
  {
    // Kandidaten neben der Pontonkette (Abzweigung) und notfalls am ganzen Hafen
    const cands: [number, number, number][] = [];
    if (br) {
      for (let m = 10; m < br.count - 10; m += 4) {
        const i = SB(m);
        for (const sd of [-1, 1]) {
          for (let lat = t.wh[i] + 5; lat < t.wh[i] + 30; lat += 2.5) cands.push([X(i, sd * lat), Z(i, sd * lat), 0]);
        }
      }
    }
    // Boote: Schlepper und Kutter, je an einer Dalbe, die Leine nach Lee
    const typen = detail === 0 ? 1 : 2;
    let placedB = 0;
    const fallback: [number, number, number][] = [];
    for (let m = 820; m < 1080; m += 8) {
      const i = S(m);
      for (let lat = t.wh[i] + 25; lat < t.wh[i] + 90; lat += 6) fallback.push([X(i, -lat), Z(i, -lat), 0]);
    }
    for (const list of [cands, fallback]) {
      for (let k = 0; k < list.length * 2 && placedB < typen; k++) {
        const [x, z] = list[Math.floor(rnd() * list.length)];
        const rope = 5;
        const len = placedB === 0 ? 13 : 12;
        if (!tief(x, z, 1.2) || !frei(x, z, 1) || !platz(x, z, 3)) continue;
        // Schwojkreis prüfen: in jeder Lage zwischen ±0,6 rad um Lee frei und tief
        let ok = true;
        for (let a = -0.6; a <= 0.61 && ok; a += 0.3) {
          for (const d of [rope, rope + len / 2, rope + len]) {
            const px = x + Math.sin(LEE + a) * d;
            const pz = z + Math.cos(LEE + a) * d;
            if (!frei(px, pz, 2) || !tief(px, pz, 0.6) || !platz(px, pz, 2.5)) ok = false;
          }
        }
        if (!ok) continue;
        merke(x, z, 1.5);
        for (let a = -0.6; a <= 0.61; a += 0.3) for (const d of [rope + len / 4, rope + (len * 3) / 4]) merke(x + Math.sin(LEE + a) * d, z + Math.cos(LEE + a) * d, 3);
        dalbe(x, z);
        dyn.beginn();
        if (placedB === 0) {
          // Schlepper: rot, schwarzer Fenderkranz, hohes Steuerhaus
          rumpf(dyn, len, 5.6, 1.9, 1.4, C.schwarz, rgb(0xc8382f), C.schwarz, rgb(0x7b5a43), 0.9);
          dyn.box(0, 1.6, 0, 6.0, 0.6, len * 0.82, C.reifen);
          dyn.box(0, 3.3, 1.2, 3.8, 2.6, 4.6, C.weiss);
          dyn.box(0, 5.4, 1.6, 3.4, 1.6, 3.0, C.weiss);
          dyn.box(0, 5.5, 3.12, 3.0, 0.8, 0.06, C.fenster);
          dyn.box(0, 6.35, 1.6, 3.9, 0.3, 3.5, C.schwarz);
          dyn.box(0, 4.8, -1.8, 1.2, 3.2, 1.4, rgb(0xf2c230), 0, C.schwarz);
          dyn.box(0, 7.6, 1.6, 0.18, 2.4, 0.18, C.schwarz);
        } else {
          // Fischkutter: blau, Steuerhaus achtern, Galgen und Netz
          rumpf(dyn, len, 5.2, 1.7, 1.2, C.weiss, rgb(0x2f5f9a), rgb(0xa8322a), rgb(0x9a7a55), 0.8);
          dyn.box(0, 3.0, -3.2, 2.6, 2.4, 3.0, C.weiss);
          dyn.box(0, 3.4, -1.68, 2.2, 0.7, 0.06, C.fenster);
          dyn.box(0, 4.35, -3.2, 3.0, 0.25, 3.4, rgb(0x30364a));
          dyn.box(0, 5.2, -4.2, 0.5, 1.6, 0.5, C.schwarz, 0, C.rot);
          dyn.box(0, 5.2, 2.6, 0.18, 7, 0.18, C.holzD);
          dyn.box(0, 6.4, 1.4, 0.12, 0.12, 2.8, C.holzD);
          dyn.box(0, 2.4, 3.6, 1.8, 0.7, 1.4, rgb(0x3f9a7a));
        }
        const p = dyn.ende(0);
        // Leine: Einheitsstab, je Bild auf Länge gezogen
        dyn.beginn();
        dyn.box(0, 0.5, 0, 0.12, 1, 0.12, rgb(0xd9c9a0));
        const pl = dyn.ende(0);
        boote.push(p, x, z, rope, rnd() * 6, pl, len);
        lampe(0, placedB === 0 ? 8.9 : 8.8, placedB === 0 ? 1.6 : 2.6, 0.4, 0, 0, 0xfff3b0, p);
        placedB++;
      }
    }
    // Dalben und Bojen
    let nd = 0;
    const wantD = detail === 0 ? 3 : 6;
    for (let k = 0; k < cands.length * 2 && nd < wantD; k++) {
      const [x, z] = cands[Math.floor(rnd() * cands.length)];
      if (!tief(x, z, 1.5) || !frei(x, z, 1) || !platz(x, z, 9)) continue;
      merke(x, z, 1.5);
      dalbe(x, z);
      nd++;
    }
    const wantB = detail === 0 ? 3 : 6;
    const bojFarben = [
      [0xd8433a, 0xd8433a, 0xf2efe6],
      [0x3f8f4f, 0x3f8f4f, 0xf2efe6],
      [0xf2c230, 0x23262d, 0xf2c230],
    ];
    let nb = 0;
    for (let k = 0; k < cands.length * 2 && nb < wantB; k++) {
      const [x, z] = cands[Math.floor(rnd() * cands.length)];
      if (!tief(x, z, 1.2) || !frei(x, z, 1.5) || !platz(x, z, 7)) continue;
      merke(x, z, 1.5);
      const fc = bojFarben[nb % 3];
      dyn.beginn();
      dyn.geo(new THREE.CylinderGeometry(0.9, 0.7, 1.4, 8), rgb(fc[0]), 0, 0, 0);
      dyn.geo(new THREE.CylinderGeometry(0.35, 0.7, 2.2, 8, 1, true), rgb(fc[1]), 0, 1.8, 0);
      dyn.geo(new THREE.ConeGeometry(0.45, 0.8, 8), rgb(fc[2]), 0, 3.3, 0);
      const p = dyn.ende(0);
      bojen.push(p, x, z, rnd() * 6);
      lampe(0, 3.9, 0, 0.45, 1, rnd() * 3, nb % 3 === 0 ? 0xff3b30 : nb % 3 === 1 ? 0x46ff7a : 0xffd23f, p);
      nb++;
    }
  }

  // ==================================================================================
  // 7. Hafeneinfahrt: Molenköpfe mit Feuern, draußen eine Fähre
  // ==================================================================================
  for (const [m, color] of [
    [906, 0xff3b30],
    [1080, 0x46ff7a],
  ] as [number, number][]) {
    let done = false;
    for (let lat0 = 7; lat0 < 30 && !done; lat0 += 2) {
      const i = S(m);
      const lat = t.wh[i] + lat0;
      const x = X(i, -lat);
      const z = Z(i, -lat);
      if (!frei(x, z, 3.2) || !platz(x, z, 4)) continue;
      done = true;
      merke(x, z, 4);
      const g = Math.min(ground(x, z), SEA) - 2;
      const top = SEA + 4.2;
      gross.lage(x, 0, z, 0);
      gross.geo(new THREE.CylinderGeometry(3.4, 4, top - g, 10), rgb(0x7d7a74), 0, (top + g) / 2, 0);
      gross.geo(new THREE.CylinderGeometry(3.5, 3.5, 0.3, 10), C.weiss, 0, top + 0.15, 0);
      const c = rgb(color === 0xff3b30 ? 0xd8433a : 0x3f8f4f);
      gross.geo(new THREE.CylinderGeometry(0.9, 1.3, 6, 8), c, 0, top + 3.2, 0);
      gross.geo(new THREE.CylinderGeometry(0.95, 0.95, 0.8, 8, 1, true), C.weiss, 0, top + 2.2, 0);
      gross.geo(new THREE.CylinderGeometry(1.2, 1.2, 0.25, 8), C.schwarz, 0, top + 6.3, 0);
      gross.geo(new THREE.ConeGeometry(0.9, 0.9, 8), C.schwarz, 0, top + 7.9, 0);
      gross.frei();
      lampe(x, top + 7.0, z, 1.25, 4, color === 0xff3b30 ? 0 : 1.3, color);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        gischt.push(x + Math.cos(a) * 4.4, SEA, z + Math.sin(a) * 4.4, Math.cos(a), Math.sin(a), rnd());
      }
    }
  }
  /** Fähre: Teil, Kursachse */
  let faehre = -1;
  let faehreZ = 0;
  {
    // Weit draußen vor der Einfahrt (Norden), weit genug von allem.
    const i = S(990);
    faehreZ = t.pz[i] + 165;
    dyn.beginn();
    const L = 112;
    const Bm = 19;
    rumpf(dyn, L, Bm, 6.5, 2.4, rgb(0x2f6fb0), C.weiss, rgb(0x8f2a2a), rgb(0x8d939a), 0.95);
    dyn.box(0, 7.6, -6, Bm * 0.92, 2.2, L * 0.7, C.weiss);
    dyn.box(0, 7.8, -6, Bm * 0.93, 0.7, L * 0.68, rgb(0xffd98a));
    dyn.box(0, 10.4, -10, Bm * 0.84, 3.4, L * 0.5, C.weiss);
    dyn.box(0, 10.6, -10, Bm * 0.85, 0.7, L * 0.48, rgb(0xffd98a));
    dyn.box(0, 13.1, 6, Bm * 0.9, 2.0, 7, C.weiss);
    dyn.box(0, 13.2, 9.52, Bm * 0.8, 0.8, 0.06, C.fenster);
    dyn.box(0, 14.8, -28, 4, 5, 6, C.weiss, 0, C.schwarz);
    dyn.box(0, 15.6, -28, 4.1, 1.2, 6.1, rgb(0x2f6fb0));
    faehre = dyn.ende(1);
    lampe(0, 18, 6, 0.8, 0, 0, 0xfff3b0, faehre);
    lampe(Bm / 2, 9, 4, 0.6, 0, 0, 0xff3b30, faehre);
    lampe(-Bm / 2, 9, 4, 0.6, 0, 0, 0x46ff7a, faehre);
  }

  // ==================================================================================
  // 8. Kranplatz: Portalkrane über der Bahn, Containerreihen, Stückgutfrachter
  // ==================================================================================
  /** Krane: Teil Katze, Teil Seil, Teil Spreader, Teil Container, Ursprung x, y, z, Kurs, Meer-Ende, Land-Ende, y Meer, y Land, Phase */
  const krane: number[] = [];
  {
    const kranMeter = detail === 0 ? [1188, 1246] : [1130, 1188, 1246];
    for (const m of kranMeter) {
      const i = S(m);
      const wh = t.wh[i];
      const L0 = wh + 4.2; // Beine
      const kl = kanteAt(pier, m);
      const outR = (Number.isNaN(kl) ? wh + 30 : kl) + 26;
      const backR = wh + 22;
      const x0 = t.px[i];
      const z0 = t.pz[i];
      const y0 = t.py[i];
      const rot = HD(i);
      // lokal: +x = links (Meerseite), z entlang
      let ok = true;
      for (const sx of [-L0, L0]) for (const sz of [-7, 7]) {
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const wx = x0 + sx * c + sz * s;
        const wz = z0 - sx * s + sz * c;
        if (!frei(wx, wz, 0.7)) ok = false;
      }
      if (!ok) continue;
      gross.lage(x0, y0, z0, rot);
      const BEAM = 19;
      const BOOM = 25;
      for (const sx of [-L0, L0]) {
        const c = Math.cos(rot);
        const wx = x0 + sx * c;
        const wz = z0 - sx * Math.sin(rot);
        const gy = Math.min(ground(wx, wz), sx > 0 && pier ? pier.y : 99) - y0 - 0.4;
        for (const sz of [-7, 7]) {
          gross.box(sx, (BEAM + gy) / 2, sz, 1.1, BEAM - gy, 1.1, C.kran);
          gross.box(sx, gy + 0.6, sz, 2.2, 1.2, 2.2, C.kranD);
        }
        gross.box(sx, gy + 1.2, 0, 1.4, 1.6, 15.6, C.kranD);
        gross.box(sx, 9, 0, 0.6, 0.6, 14, C.kran);
        gross.stab([sx, gy + 2, -6.5], [sx, BEAM - 1, 6.5], 0.4, C.kranD);
      }
      // Portalträger und Ausleger
      for (const sz of [-7, 7]) gross.box(0, BEAM, sz, 2 * L0 + 1.1, 1.4, 1.2, C.kran);
      for (const sz of [-1.6, 1.6]) gross.box((outR - backR) / 2, BOOM, sz, outR + backR, 1.6, 0.7, C.kran);
      for (let k = 0; k < 9; k++) {
        const lx = -backR + ((outR + backR) * (k + 0.5)) / 9;
        gross.box(lx, BOOM - 0.6, 0, 0.5, 0.4, 3.2, C.kranD);
      }
      for (const sx of [-L0, L0]) for (const sz of [-7, 7]) gross.stab([sx, BEAM, sz], [sx * 0.55, BOOM - 0.8, sz * 0.23], 0.7, C.kran);
      // Spitze (A-Bock) mit Abspannungen
      for (const sz of [-1.6, 1.6]) {
        gross.stab([-L0 + 1, BOOM + 0.8, sz], [-L0 * 0.25, BOOM + 13, sz * 0.4], 0.8, C.kran);
        gross.stab([L0 - 1, BOOM + 0.8, sz], [-L0 * 0.25, BOOM + 13, sz * 0.4], 0.8, C.kran);
        gross.stab([-L0 * 0.25, BOOM + 13, sz * 0.4], [outR - 2, BOOM + 0.8, sz], 0.18, C.ink);
        gross.stab([-L0 * 0.25, BOOM + 13, sz * 0.4], [outR * 0.45, BOOM + 0.8, sz], 0.18, C.ink);
        gross.stab([-L0 * 0.25, BOOM + 13, sz * 0.4], [-backR + 1, BOOM + 0.8, sz], 0.18, C.ink);
      }
      // Maschinenhaus hinten auf dem Ausleger, Führerhaus darunter
      gross.box(-backR + 6, BOOM + 2.4, 0, 9, 3.2, 4.6, C.weiss, 0, C.kranD);
      gross.box(-backR + 6, BOOM + 2.6, 2.32, 8, 0.6, 0.06, C.kran);
      gross.box(-backR - 0.8, BOOM - 1.8, 0, 1.6, 6, 3.4, rgb(0x8d8a80));
      gross.frei();
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const wxL = (lx: number): number => x0 + lx * c;
      const wzL = (lx: number): number => z0 - lx * s;
      lampe(wxL(-L0 * 0.25), y0 + BOOM + 13.6, wzL(-L0 * 0.25), 0.7, 1, m * 0.01, 0xff3b30);
      lampe(wxL(outR), y0 + BOOM + 1.2, wzL(outR), 0.7, 1, m * 0.01 + 0.5, 0xff3b30);
      for (const sx of [-L0, L0]) for (const sz of [-7, 7]) merke(x0 + sx * c + sz * s, z0 - sx * s + sz * c, 2);
      // Laufkatze, Seile, Spreader, Container
      dyn.beginn();
      dyn.box(0, -0.2, 0, 3, 1.4, 4.2, C.kranD);
      dyn.box(0, -1.4, 1.5, 2, 1.6, 1.4, rgb(0xf2efe6));
      dyn.box(0, -1.4, 2.22, 1.8, 0.8, 0.06, C.fenster);
      const pk = dyn.ende(0);
      dyn.beginn();
      for (const sz of [-1.6, 1.6]) dyn.box(0, -0.5, sz, 0.08, 1, 0.08, C.ink);
      const ps = dyn.ende(0);
      dyn.beginn();
      dyn.box(0, -0.3, 0, 2.6, 0.5, 12.4, C.gelb);
      dyn.box(0, 0.1, 0, 1, 0.5, 1.4, C.schwarz);
      const pp = dyn.ende(0);
      dyn.beginn();
      const cc = rgb(pick(BOX_FARBEN));
      dyn.box(0, -1.9, 0, 2.44, 2.6, 12.2, cc, 0, [cc[0] * 0.86, cc[1] * 0.86, cc[2] * 0.86]);
      const pc = dyn.ende(0);
      const ySea = SEA + 5.2 + 2.6 + 0.6 - y0;
      const gl = ground(wxL(-(wh + 13)), wzL(-(wh + 13)));
      const yLand = gl + 2.6 * 2 + 0.6 - y0;
      krane.push(pk, ps, pp, pc, x0, y0, z0, rot, (Number.isNaN(kl) ? wh + 20 : kl) + 9, -(wh + 13), ySea, yLand, m * 0.037);
    }
  }
  // Containerreihen landseitig (rechts) am Kranplatz
  {
    for (let m = 1092; m < 1298; m += 12.8) {
      const i = S(m + 6.1);
      for (let r = 0; r < (detail === 0 ? 2 : 4); r++) {
        const lat = t.wh[i] + 7.8 + r * 2.75;
        const x = X(i, lat);
        const z = Z(i, lat);
        const ex = t.tx[i] * 6.1;
        const ez = t.tz[i] * 6.1;
        if (!frei(x + ex, z + ez, 1.3) || !frei(x - ex, z - ez, 1.3) || !platz(x, z, 1.4)) continue;
        // unter den Kranen nur flach (die Laufkatze setzt dort ab)
        const g = Math.min(ground(x + ex, z + ez), ground(x - ex, z - ez)) - 0.15;
        if (g < SEA + 0.3) continue;
        const h = 1 + Math.floor(rnd() * (r === 3 ? 4 : 2.6));
        stapel(gross, x, g, z, HD(i) + (rnd() - 0.5) * 0.03, farbenListe(h), r === 0);
        merke(x, z, 1.4);
      }
    }
  }
  // Stückgutfrachter an der Pier
  {
    const m = 1192;
    const kl = kanteAt(pier, m);
    const L = 84;
    const Bm = 14;
    const Hd = 4.2;
    if (!Number.isNaN(kl)) {
      const i = S(m);
      const lat = kl + 1.2 + Bm / 2;
      const x = X(i, -lat);
      const z = Z(i, -lat);
      if (ground(x, z) < SEA - 1.5) {
        dyn.beginn();
        rumpf(dyn, L, Bm, Hd, 2.0, C.weiss, rgb(0x2d5a46), rgb(0xa8322a), rgb(0x8a6a48));
        // Aufbau mittschiffs-achtern
        const az = -L / 2 + 14;
        dyn.box(0, Hd + 3.6, az, Bm * 0.8, 7.2, 10, C.weiss);
        for (let d = 0; d < 3; d++) dyn.box(0, Hd + 1.4 + d * 2.3, az + 5.02, Bm * 0.72, 0.8, 0.06, C.fenster);
        dyn.box(0, Hd + 8, az + 1.5, Bm + 1, 1.5, 3.6, C.weiss);
        dyn.box(0, Hd + 8.1, az + 3.32, Bm * 0.9, 0.8, 0.06, C.fenster);
        dyn.box(0, Hd + 10, az - 2.5, 3, 4.4, 3.4, rgb(0x2d5a46), 0, C.schwarz);
        dyn.box(0, Hd + 10.8, az - 2.5, 3.1, 0.9, 3.5, C.rot);
        // Luken mit Süll, eine offen (dunkel) mit Ladung; Ladebäume an gelben Pfosten
        for (let h = 0; h < 3; h++) {
          const hz = -L / 2 + 30 + h * 15;
          dyn.box(0, Hd + 0.6, hz, Bm * 0.62, 1.2, 10, C.gelb, 0, h === 1 ? rgb(0x15181d) : rgb(0x6d4a32));
          if (h === 1) {
            dyn.box(-1.5, Hd + 1.0, hz + 1, 2.2, 1.2, 2.2, C.holz);
            dyn.box(1.6, Hd + 0.9, hz - 2, 2.6, 1.0, 2.2, rgb(0x4f7bd8));
          }
          const kz = hz - 7.4;
          for (const sx of [-2.2, 2.2]) dyn.box(sx, Hd + 6, kz, 0.6, 12, 0.6, C.gelb);
          dyn.box(0, Hd + 11.6, kz, 5.2, 0.5, 0.6, C.gelb);
          dyn.stab([0, Hd + 2, kz + 0.6], [0, Hd + 8.5, kz + 10], 0.35, C.gelb);
          dyn.stab([0, Hd + 11.5, kz], [0, Hd + 8.5, kz + 10], 0.06, C.ink);
          dyn.stab([0, Hd + 8.5, kz + 10], [0, Hd + 2.2, kz + 10.5], 0.05, C.ink);
        }
        // Bug-Mast
        dyn.box(0, Hd + 6, L / 2 - 8, 0.4, 10, 0.4, C.gelb);
        const p = dyn.ende(1);
        schiffe.push(p, x, SEA, z, HD(i) + Math.PI, 0.02, 0.005, 0.25, 2.1);
        lampe(0, Hd + 11.3, L / 2 - 8, 0.45, 0, 0, 0xfff3b0, p);
        merke(x, z, L / 2);
      }
    }
  }

  // ==================================================================================
  // 9. Ladeluke: die Lücke hinter der Schanze als offener Laderaum
  // ==================================================================================
  {
    let g0 = -1;
    let g1 = -1;
    for (let i = S(1280); i < S(1345); i++) {
      if (t.edge[i] & EDGE_GAP) {
        if (g0 < 0) g0 = i;
        g1 = i;
      }
    }
    if (g0 > 0) {
      const a = t.prev[g0];
      const b = t.next[g1];
      const im = Math.round((g0 + g1) / 2);
      const W = t.wh[im] + 3;
      const roadY = Math.min(t.py[a], t.py[b]);
      // Höchster Boden im Laderaum: darauf der Grund.
      let gmax = -Infinity;
      for (let i = a; i <= b; i++) for (let f = -1; f <= 1; f += 0.25) gmax = Math.max(gmax, ground(X(i, f * W), Z(i, f * W)));
      const fy = gmax + 0.06;
      const P = (i: number, lat: number, y: number): V3 => [X(i, lat), y, Z(i, lat)];
      const ref: V3 = [t.px[im], fy - 30, t.pz[im]];
      const rim = roadY - 0.08;
      const inset = 1.6;
      const rust = rgb(0x8a4a32);
      const rustD = rgb(0x5a2f22);
      // Grund: dunkles Wasser mit hellen Rippeln
      klein.flaeche(P(a, -W + inset, fy), P(b, -W + inset, fy), P(b, W - inset, fy), P(a, W - inset, fy), rgb(0x0e1a20), ref);
      for (let k = 0; k < 5; k++) {
        const f = 0.2 + k * 0.15;
        const ii = Math.round(a + (b - a) * f);
        const l0 = -W + inset + 1 + rnd() * (2 * W - 2 * inset - 6);
        const jj = t.next[ii];
        glut.quad(P(ii, l0, fy + 0.02), P(ii, l0 + 3 + rnd() * 2, fy + 0.02), P(jj, l0 + 3, fy + 0.02), P(jj, l0, fy + 0.02), rgb(0x4d6f7c));
      }
      // Schräge Innenwände (Trichter): vom Rand zum Grund, unten dunkler
      const mid = (p: V3, q: V3, f: number): V3 => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
      const seiten: [V3, V3, V3, V3][] = [
        [P(a, -W, rim), P(b, -W, rim), P(b, -W + inset, fy), P(a, -W + inset, fy)],
        [P(b, W, rim), P(a, W, rim), P(a, W - inset, fy), P(b, W - inset, fy)],
      ];
      for (const [p0, p1, p2, p3] of seiten) {
        const m0 = mid(p0, p3, 0.55);
        const m1 = mid(p1, p2, 0.55);
        klein.flaeche(p0, p1, m1, m0, rust, ref, false);
        klein.flaeche(m0, m1, p2, p3, rustD, ref, false);
      }
      // Stirnwände unter der Absprungkante und der Landung
      klein.flaeche(P(a, -W, rim), P(a, W, rim), P(a, W - inset, fy), P(a, -W + inset, fy), rustD, [t.px[b], fy, t.pz[b]], false);
      klein.flaeche(P(b, -W, rim), P(b, W, rim), P(b, W - inset, fy), P(b, -W + inset, fy), rustD, [t.px[a], fy, t.pz[a]], false);
      // Süll an den Seiten (über Fahrbahnhöhe), gelb-schwarz
      for (const sd of [-1, 1]) {
        for (let i = a; i < b; i += 2) {
          const j = Math.min(b, i + 2);
          const c = ((i - a) / 2) % 2 === 0 ? C.gelb : C.schwarz;
          const o0 = P(i, sd * (W + 0.5), rim);
          const o1 = P(j, sd * (W + 0.5), rim);
          gross.flaeche(P(i, sd * W, rim + 1.0), P(j, sd * W, rim + 1.0), P(j, sd * (W + 0.5), rim + 1.0), P(i, sd * (W + 0.5), rim + 1.0), c, [t.px[im], -50, t.pz[im]]);
          gross.flaeche(P(i, sd * W, fy), P(j, sd * W, fy), P(j, sd * W, rim + 1.0), P(i, sd * W, rim + 1.0), rust, [t.px[im], rim, t.pz[im]], false);
          gross.flaeche(o0, o1, [o1[0], rim + 1.0, o1[2]], [o0[0], rim + 1.0, o0[2]], C.betonD, [t.px[im], rim, t.pz[im]]);
        }
        // Aufgeklappte Lukendeckel neben dem Süll
        const lat = sd * (W + 2.2);
        for (let k = 0; k < 2; k++) {
          const i0 = Math.round(a + ((b - a) * k) / 2) + 1;
          const i1 = Math.round(a + ((b - a) * (k + 1)) / 2) - 1;
          const base0 = P(i0, lat, rim);
          const base1 = P(i1, lat, rim);
          const tl = sd * (W + 3.6);
          const top0 = P(i0, tl, rim + 5.5);
          const top1 = P(i1, tl, rim + 5.5);
          gross.flaeche(base0, base1, top1, top0, rgb(0xc9a032), [t.px[im], rim + 3, t.pz[im]], false);
          gross.flaeche(base0, base1, top1, top0, rgb(0x8a6e22), [t.px[im], rim + 3, t.pz[im]], true);
          lampe(top0[0], top0[1] + 0.3, top0[2], 0.5, 1, k + sd, 0xff9a1f);
        }
      }
      // Fracht unten in der Luke: Kisten und Säcke
      for (let k = 0; k < 6; k++) {
        const ii = Math.round(a + 1 + rnd() * (b - a - 2));
        const l = (rnd() - 0.5) * (2 * W - 2 * inset - 2);
        klein.lage(X(ii, l), fy, Z(ii, l), HD(ii) + rnd());
        const s = 0.9 + rnd() * 0.6;
        klein.klotz(0, Math.min(s / 2, (rim - fy) * 0.4), 0, s * 1.4, Math.min(s, (rim - fy) * 0.8), s, k % 2 ? C.holz : rgb(0x7a8a5a));
        klein.frei();
      }
    }
  }

  // ==================================================================================
  // 10. Lagerhalle: Hülle über dem Tunnel, Giebel mit Toröffnung, Rolltore, Kisten
  // ==================================================================================
  {
    let f = -1;
    let l = -1;
    for (let i = S(1330); i < S(1430); i++) {
      if (t.edge[i] & EDGE_TUNNEL) {
        if (f < 0) f = i;
        l = i;
      }
    }
    if (f > 0) {
      let whMax = 0;
      for (let i = f; i <= l; i++) whMax = Math.max(whMax, t.wh[i]);
      const A = whMax + 0.75 + 7.4;
      const Ye = 12.6;
      const Yr = 16.4;
      const wand = rgb(0x6f8394);
      const wandD = rgb(0x5d7080);
      const sockel = rgb(0x8d8a84);
      const dach = rgb(0x3a434f);
      const P = (i: number, lat: number, dy: number): V3 => [X(i, lat), t.py[i] + dy, Z(i, lat)];
      const fa = Math.max(0, f - 2);
      const fb = Math.min(t.n - 1, l + 2);
      const stops: number[] = [];
      for (let i = fa; i < fb; i += 3) stops.push(i);
      stops.push(fb);
      for (let k = 0; k < stops.length - 1; k++) {
        const i = stops[k];
        const j = stops[k + 1];
        for (const sd of [-1, 1]) {
          const lat = sd * A;
          const gy = Math.min(ground(X(i, lat), Z(i, lat)), t.py[i]) - t.py[i] - 1.0;
          const ref: V3 = [t.px[i], t.py[i] + 5, t.pz[i]];
          gross.flaeche(P(i, lat, gy), P(j, lat, gy), P(j, lat, 1.6), P(i, lat, 1.6), sockel, ref);
          gross.flaeche(P(i, lat, 1.6), P(j, lat, 1.6), P(j, lat, Ye), P(i, lat, Ye), k % 2 === 0 ? wand : wandD, ref);
          gross.flaeche(P(i, lat, Ye), P(j, lat, Ye), P(j, 0, Yr), P(i, 0, Yr), dach, ref);
          // Oberlichter leuchten
          if (k % 2 === 0) {
            const o = sd * 0.06;
            glut.flaeche(P(i, lat + o, 9.4), P(j, lat + o, 9.4), P(j, lat + o, 10.6), P(i, lat + o, 10.6), rgb(0xffe6a0), ref);
          }
        }
        // First
        const fp = P(i, 0, Yr + 0.2);
        gross.box(fp[0], fp[1], fp[2], 0.6, 0.4, 3.2, dach, HD(i));
      }
      // Giebel an Ein- und Ausfahrt
      const IN: [number, number][] = [
        [-1, 0],
        [-1, 0.45],
        [-0.74, 0.78],
        [-0.38, 0.95],
        [0, 1],
        [0.38, 0.95],
        [0.74, 0.78],
        [1, 0.45],
        [1, 0],
      ];
      for (const [gi, ri, inner] of [
        [fa, f, f + 4],
        [fb, l, l - 4],
      ] as [number, number, number][]) {
        const W = t.wh[ri] + 0.75 + 0.25;
        const gy = -1.2;
        const O: [number, number][] = [
          [-A, gy],
          [-A, Ye * 0.55],
          [-A, Ye],
          [-A * 0.5, (Ye + Yr) / 2],
          [0, Yr],
          [A * 0.5, (Ye + Yr) / 2],
          [A, Ye],
          [A, Ye * 0.55],
          [A, gy],
        ];
        const ref: V3 = [t.px[inner], t.py[inner] + 6, t.pz[inner]];
        for (let k = 0; k < 8; k++) {
          const i0 = P(gi, IN[k][0] * W, IN[k][1] * TUNNEL_H);
          const i1 = P(gi, IN[k + 1][0] * W, IN[k + 1][1] * TUNNEL_H);
          const o0 = P(gi, O[k][0], O[k][1]);
          const o1 = P(gi, O[k + 1][0], O[k + 1][1]);
          gross.flaeche(i0, i1, o1, o0, k === 0 || k === 7 ? wandD : wand, ref);
          // Laibung bis zur Felsstirn
          const r0 = P(ri, IN[k][0] * W, IN[k][1] * TUNNEL_H);
          const r1 = P(ri, IN[k + 1][0] * W, IN[k + 1][1] * TUNNEL_H);
          gross.flaeche(i0, i1, r1, r0, sockel, [t.px[gi], t.py[gi] + TUNNEL_H * 0.4, t.pz[gi]], false);
        }
        // Rolltorkasten über der Öffnung, gelb-schwarzer Rahmen
        const rot = HD(gi);
        const outward = gi === fa ? -1 : 1;
        const ox = t.tx[gi] * outward * 0.45;
        const oz = t.tz[gi] * outward * 0.45;
        const pc = P(gi, 0, TUNNEL_H + 0.75);
        gross.box(pc[0] + ox, pc[1], pc[2] + oz, 2 * W + 1.2, 1.3, 0.9, C.stahl, rot);
        for (let k = 0; k < 7; k++) {
          const lat = -W - 0.4 + ((2 * W + 0.8) * (k + 0.5)) / 7;
          const p = P(gi, lat, TUNNEL_H + 0.75);
          gross.box(p[0] + ox * 2.05, p[1], p[2] + oz * 2.05, (2 * W + 0.8) / 7, 0.5, 0.06, k % 2 ? C.gelb : C.schwarz, rot);
        }
        // Geschlossene Rolltore links und rechts
        for (const sd of [-1, 1]) {
          const cl = sd * (W + (A - W) / 2);
          const dw = Math.min(5, (A - W) - 1.6);
          if (dw < 2) continue;
          for (let k = 0; k < 6; k++) {
            const p = P(gi, cl, 0.45 + k * 0.85);
            gross.box(p[0] + ox * 0.3, p[1], p[2] + oz * 0.3, dw, 0.8, 0.1, k % 2 ? rgb(0xb8bec4) : rgb(0xa4aab1), rot);
          }
          const p = P(gi, cl, 5.6);
          gross.box(p[0] + ox * 0.6, p[1], p[2] + oz * 0.6, dw + 0.6, 0.6, 0.3, C.gelb, rot);
          glut.box(p[0] + ox * 0.9, p[1] + 0.8, p[2] + oz * 0.9, 0.8, 0.35, 0.08, rgb(0xfff3b0), rot);
        }
        // Hallennummer als Ziffer "9" in Sieben-Segment-Art auf dem Giebel
        const seg: [number, number, number, number][] = [
          [0, 2.6, 1.6, 0.36], // a
          [0.8, 1.95, 0.36, 1.3], // b
          [0.8, 0.65, 0.36, 1.3], // c
          [0, 0, 1.6, 0.36], // d
          [-0.8, 1.95, 0.36, 1.3], // f
          [0, 1.3, 1.6, 0.36], // g
        ];
        for (const [sx, sy, w, h] of seg) {
          const p = P(gi, -sx * outward, TUNNEL_H + 2.6 + sy);
          gross.box(p[0] + ox * 0.25, p[1], p[2] + oz * 0.25, w, h, 0.12, C.weiss, rot);
        }
        // Kistenstapel draußen
        for (const sd of [-1, 1]) {
          const ii = gi === fa ? Math.max(0, gi - 7) : Math.min(t.n - 1, gi + 7);
          for (let k = 0; k < (detail === 0 ? 2 : 4); k++) {
            const lat = sd * (t.wh[ii] + 4.2 + (k % 2) * 1.6);
            const x = X(ii, lat) + t.tx[ii] * (k > 1 ? 1.6 : 0) * outward;
            const z = Z(ii, lat) + t.tz[ii] * (k > 1 ? 1.6 : 0) * outward;
            if (!frei(x, z, 0.8) || !platz(x, z, 0.8)) continue;
            merke(x, z, 0.8);
            const g = ground(x, z);
            const n = 1 + Math.floor(rnd() * 3);
            for (let q = 0; q < n; q++) klein.box(x, g + 0.6 + q * 1.2, z, 1.2, 1.2, 1.2, q % 2 ? C.holz : rgb(0xa07a50), HD(ii) + q * 0.3, C.holzD);
          }
        }
        // Fahnen an der Einfahrt
        if (gi === fa) {
          for (const sd of [-1, 1]) {
            const p = P(gi, sd * (A + 1.5), 0);
            const x = p[0] + ox * 3;
            const z = p[2] + oz * 3;
            const g = ground(x, z);
            gross.lage(x, g, z, 0);
            gross.box(0, 5, 0, 0.16, 10, 0.16, C.weiss);
            gross.frei();
            tuch(x, g + 9.8, z, 2.8, 1.8, sd < 0 ? [C.rot, C.weiss] : [rgb(0x2f6fb0), C.gelb], 'quer');
          }
        }
      }
    }
  }

  // ==================================================================================
  // 11. Möwen, die im Wind stehen
  // ==================================================================================
  /** Möwen: Körper, Flügel l, Flügel r, x, y, z, Phase */
  const moewen: number[] = [];
  {
    const anchors: V3[] = [];
    if (feuer[1] > 0) {
      for (let k = 0; k < 5; k++) anchors.push([feuer[0] + Math.cos(k * 1.3) * (8 + k * 3), feuer[1] - 4 - k * 2.5, feuer[2] + Math.sin(k * 1.3) * (8 + k * 3)]);
    }
    for (const m of [80, 140, 600, 760]) {
      const i = S(m);
      const lat = -(t.wh[i] + 14);
      anchors.push([X(i, lat), Math.max(t.py[i], SEA) + 11 + rnd() * 5, Z(i, lat)]);
    }
    const want = detail === 0 ? 4 : hi ? 9 : 7;
    for (let g = 0; g < Math.min(want, anchors.length); g++) {
      const [ax, ay, az] = anchors[g];
      if (world.clearance(ax, az) < 4) continue;
      dyn.beginn();
      dyn.geo(new THREE.IcosahedronGeometry(1, 0), rgb(0xf7f7f2), 0, 0, 0, 0, 0, 0, 0.2, 0.19, 0.55);
      dyn.geo(new THREE.IcosahedronGeometry(1, 0), C.weiss, 0, 0.07, 0.5, 0, 0, 0, 0.14, 0.14, 0.16);
      dyn.geo(new THREE.ConeGeometry(0.05, 0.22, 4), rgb(0xffb21f), 0, 0.05, 0.72, Math.PI / 2);
      dyn.tri([0, 0.04, -0.4], [-0.16, 0.02, -0.78], [0.16, 0.02, -0.78], rgb(0xd9dde3));
      dyn.tri([0, 0.0, -0.4], [0.16, 0.02, -0.78], [-0.16, 0.02, -0.78], rgb(0xd9dde3));
      const pb = dyn.ende(0);
      const wing = (): number => {
        dyn.beginn();
        const grey = rgb(0xc5d0dc);
        const tip = rgb(0x2a2f3a);
        const rows: [number, number, number, RGB][] = [
          [0.08, 0.24, -0.3, grey],
          [0.75, 0.24, -0.24, grey],
          [1.35, 0.04, -0.1, tip],
        ];
        for (let k = 0; k < 2; k++) {
          const [x0, f0, b0] = rows[k];
          const [x1, f1, b1, c] = rows[k + 1];
          const t0 = 0.05 * (1 - k * 0.4);
          const t1 = 0.05 * (1 - (k + 1) * 0.4);
          dyn.quad([x0, t0, b0], [x0, t0, f0], [x1, t1, f1], [x1, t1, b1], c);
          dyn.quad([x0, -t0, f0], [x0, -t0, b0], [x1, -t1, b1], [x1, -t1, f1], c);
          dyn.quad([x0, -t0, f0], [x1, -t1, f1], [x1, t1, f1], [x0, t0, f0], c);
          dyn.quad([x1, -t1, b1], [x0, -t0, b0], [x0, t0, b0], [x1, t1, b1], c);
        }
        return dyn.ende(0);
      };
      const wl = wing();
      const wr = wing();
      moewen.push(pb, wl, wr, ax, ay, az, rnd() * 10);
    }
  }

  // ==================================================================================
  // 12. Wolkenbänke am Horizont (wetterleuchten)
  // ==================================================================================
  const NB = detail === 0 ? 4 : 7;
  const bankGeo = (() => {
    const b = new Bau();
    const ico = (): THREE.BufferGeometry => new THREE.SphereGeometry(1, 7, 4);
    const dark = rgb(0x414b5b);
    const mid = rgb(0x56606f);
    for (let k = 0; k < 6; k++) {
      const x = (k - 2.5) * 34 + (k % 2) * 6;
      b.geo(ico(), k % 2 ? dark : mid, x * 2.6, (6 + (k % 3) * 8) * 3, (k % 2) * 30, 0, k, 0, (50 + (k % 3) * 10) * 2.6, (34 + (k % 2) * 12) * 3.6, 70);
    }
    return b.build();
  })();
  const bankMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const banks = new THREE.InstancedMesh(bankGeo, bankMat, NB);
  banks.frustumCulled = false;
  banks.renderOrder = -7;
  group.add(banks);
  disposables.push(bankGeo, bankMat, banks);
  const bankA = new Float32Array(NB);
  for (let k = 0; k < NB; k++) bankA[k] = (k / NB) * Math.PI * 2 + rnd() * 0.5;
  const flash = new Float32Array(NB);

  // ==================================================================================
  // Netze zusammenstellen
  // ==================================================================================
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const add = (b: Bau, outline: number): THREE.Mesh | null => {
    if (b.verts === 0) return null;
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
    return mesh;
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

  // Lichtkegel (additiv), das Leuchtfeuer wird je Bild gedreht.
  const lichtGeo = licht.build();
  const lichtPos = lichtGeo.getAttribute('position') as THREE.BufferAttribute;
  lichtPos.setUsage(THREE.DynamicDrawUsage);
  const beamBase = new Float32Array((beamV1 - beamV0) * 3);
  for (let k = 0; k < beamBase.length; k++) beamBase[k] = (lichtPos.array as Float32Array)[beamV0 * 3 + k];
  const lichtMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lichtMesh = new THREE.Mesh(lichtGeo, lichtMat);
  lichtMesh.frustumCulled = false;
  lichtMesh.renderOrder = 4;
  group.add(lichtMesh);
  disposables.push(lichtGeo, lichtMat);
  const hasBeam = feuer[1] > 0;

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
  // Anfangs alles an Ort und Stelle (Matrizen = Einheit) – das erste update() setzt die Lagen.

  // Leuchten (Instanzen)
  const NL = lichter.length / 8;
  const glowGeo = new THREE.IcosahedronGeometry(0.5, 0);
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

  // Wellenkämme mit Schaumkronen (Instanzen, ziehen mit dem Wind)
  const NC = detail === 0 ? 32 : hi ? 72 : 56;
  const crestGeo = (() => {
    const b = new Bau();
    const ridge = rgb(0x2b4f5e);
    const foam = rgb(0xeaf6f8);
    const N = 6;
    // lokal: x quer (Länge des Kamms), z mit dem Wind; Kamm bei z = 0, Höhe 1
    for (let k = 0; k < N; k++) {
      const u0 = -1 + (2 * k) / N;
      const u1 = -1 + (2 * (k + 1)) / N;
      const hgt = (u: number): number => 1 - u * u;
      const bend = (u: number): number => -(1 - u * u) * 0.8;
      const a0: V3 = [u0 * 5, 0, bend(u0) - 2.4];
      const a1: V3 = [u1 * 5, 0, bend(u1) - 2.4];
      const c0: V3 = [u0 * 5, hgt(u0), bend(u0)];
      const c1: V3 = [u1 * 5, hgt(u1), bend(u1)];
      const f0: V3 = [u0 * 5, hgt(u0) * 0.7, bend(u0) + 0.5];
      const f1: V3 = [u1 * 5, hgt(u1) * 0.7, bend(u1) + 0.5];
      const e0: V3 = [u0 * 5, 0, bend(u0) + 1.3 + Math.abs(Math.sin(u0 * 7)) * 0.6];
      const e1: V3 = [u1 * 5, 0, bend(u1) + 1.3 + Math.abs(Math.sin(u1 * 7)) * 0.6];
      b.quad(a0, a1, c1, c0, ridge); // Rücken (luv)
      b.quad(c0, c1, f1, f0, foam); // Krone
      b.quad(f0, f1, e1, e0, foam);
      b.quad(e0, e1, [e1[0], 0, e1[2] + 1.2], [e0[0], 0, e0[2] + 1.2], foam); // Schaum davor
    }
    return b.build();
  })();
  const crestMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const crests = new THREE.InstancedMesh(crestGeo, crestMat, NC);
  crests.frustumCulled = false;
  crests.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(crests);
  disposables.push(crestGeo, crestMat, crests);
  // Wassermaske (grob): wo darf ein Kamm laufen?
  const MC = 14;
  const mHalf = world.radius + 240;
  const mx0 = world.center.x - mHalf;
  const mz0 = world.center.z - mHalf;
  const MN = Math.ceil((mHalf * 2) / MC);
  const mask = new Uint8Array(MN * MN);
  for (let iz = 0; iz < MN; iz++) {
    for (let ix = 0; ix < MN; ix++) {
      const x = mx0 + (ix + 0.5) * MC;
      const z = mz0 + (iz + 0.5) * MC;
      mask[iz * MN + ix] = ground(x, z) < SEA - 1.4 && world.clearance(x, z) > 10 ? 1 : 0;
    }
  }
  const nass = (x: number, z: number): boolean => {
    const ix = Math.floor((x - mx0) / MC);
    const iz = Math.floor((z - mz0) / MC);
    if (ix < 0 || iz < 0 || ix >= MN || iz >= MN) return true;
    return mask[iz * MN + ix] === 1;
  };
  // Je Kamm: Lebensbeginn, Dauer, Startpunkt (x, z), Größe
  const cT0 = new Float32Array(NC).fill(-1e9);
  const cDur = new Float32Array(NC);
  const cX = new Float32Array(NC);
  const cZ = new Float32Array(NC);
  const cS = new Float32Array(NC);
  let hashN = 1;
  const hrnd = (): number => {
    hashN = (hashN * 16807) % 2147483647;
    return hashN / 2147483647;
  };

  // Gischt-Takt je Punkt
  const NG = gischt.length / 6;
  const gCycle = new Int32Array(Math.max(1, NG)).fill(-1);

  // --- Pro Bild ----------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const m5 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const s1 = new THREE.Vector3(1, 1, 1);
  const sv = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const posA = dPos.array as Float32Array;
  const norA = dNor.array as Float32Array;

  const setzeTeil = (p: Teil, time: number): void => {
    const el = p.m.elements;
    const full = p.art !== 1 || first;
    const on = baseON;
    const onA = dON ? (dON.array as Float32Array) : null;
    for (let i = p.v0; i < p.v1; i++) {
      const o = i * 3;
      let x = basePos[o];
      let y = basePos[o + 1];
      let z = basePos[o + 2];
      if (p.art === 2) {
        // Tuch: Welle läuft vom Mast weg, wächst zum freien Ende; das Ende schlägt.
        const u = Math.max(0, x) / p.len;
        const wv = Math.sin(p.k * x - p.w * time + p.ph) + 0.35 * Math.sin(p.k * 2.3 * x - p.w * 1.7 * time + p.ph * 2 + y);
        z += p.amp * u * wv;
        x *= 1 - 0.06 * u * (1 + Math.sin(p.w * time * 0.5 + p.ph));
        y += p.amp * 0.25 * u * Math.sin(p.w * 0.8 * time + p.ph + x);
      }
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

  let first = true;
  let flashT = 6;
  let hemiBoost = 0;
  const hemiBase = th.hemiIntensity;
  let rainT = 0;
  let hornT = 5;
  let hornBlow = -1;
  let tugT = 0;
  const col = new THREE.Color();

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Schiffe: schaukeln an Ort und Stelle; die Fähre zieht draußen vorbei ---
      for (let k = 0; k < schiffe.length; k += 9) {
        const ph = schiffe[k + 8];
        const roll = Math.sin(time * 0.62 + ph) * schiffe[k + 5] + Math.sin(time * 1.13 + ph) * schiffe[k + 5] * 0.3;
        const pitch = Math.sin(time * 0.41 + ph * 2) * schiffe[k + 6];
        const heave = Math.sin(time * 0.77 + ph) * schiffe[k + 7];
        lage(schiffe[k], schiffe[k + 1], schiffe[k + 2] + heave, schiffe[k + 3], schiffe[k + 4], pitch, roll);
      }
      if (faehre >= 0) {
        const span = 1900;
        const u = ((time * 6.5) % span) - span / 2;
        lage(faehre, world.center.x - u, SEA + Math.sin(time * 0.5) * 0.3, faehreZ, -Math.PI / 2, Math.sin(time * 0.37) * 0.01, Math.sin(time * 0.45) * 0.03);
      }
      // --- Boote an der Leine: schwojen um Lee, dümpeln, zerren ---
      for (let k = 0; k < boote.length; k += 7) {
        const ph = boote[k + 4];
        const dx = boote[k + 1];
        const dz = boote[k + 2];
        const len = boote[k + 6];
        const yank = Math.max(0, Math.sin(time * 0.9 + ph)) ** 3;
        const sw = Math.sin(time * 0.23 + ph) * 0.45 + Math.sin(time * 0.61 + ph * 2) * 0.15;
        const ang = LEE + sw;
        const rope = boote[k + 3] - 1.2 + yank * 1.2;
        const bx = dx + Math.sin(ang) * rope;
        const bz = dz + Math.cos(ang) * rope;
        // Bug zur Dalbe: Mitte eine halbe Länge weiter in Lee
        const cx = bx + Math.sin(ang) * (len / 2);
        const cz = bz + Math.cos(ang) * (len / 2);
        const heave = Math.sin(time * 1.3 + ph) * 0.35;
        lage(boote[k], cx, SEA - 0.2 + heave, cz, ang + Math.PI, Math.sin(time * 1.1 + ph) * 0.06 - yank * 0.05, Math.sin(time * 0.9 + ph * 3) * 0.1);
        // Leine von der Dalbe zum Bug (Einheitsstab entlang y, gestreckt)
        const ly = SEA + 3.0;
        const by = SEA + 1.6 + heave;
        const ddx = bx - dx;
        const ddy = by - ly;
        const ddz = bz - dz;
        const ll = Math.hypot(ddx, ddy, ddz);
        q.setFromUnitVectors(UP, v.set(ddx / ll, ddy / ll, ddz / ll));
        teile[boote[k + 5]].m.compose(v.set(dx, ly, dz), q, sv.set(1, ll, 1));
      }
      // --- Bojen ---
      for (let k = 0; k < bojen.length; k += 4) {
        const ph = bojen[k + 3];
        lage(bojen[k], bojen[k + 1], SEA - 0.1 + Math.sin(time * 1.6 + ph) * 0.3, bojen[k + 2], ph, Math.sin(time * 1.3 + ph) * 0.2, Math.sin(time * 1.05 + ph * 1.7) * 0.2);
      }
      // --- Sturmbälle und Schirme ---
      for (let k = 0; k < baelle.length; k += 5) {
        const ph = baelle[k + 4];
        const sw = 0.28 + Math.sin(time * 2.1 + ph) * 0.12 + Math.sin(time * 5.3 + ph) * 0.04;
        // Pendel in Windrichtung ausgelenkt
        e.set(sw * WZ, 0, -sw * WX, 'XYZ');
        q.setFromEuler(e);
        teile[baelle[k]].m.compose(v.set(baelle[k + 1], baelle[k + 2], baelle[k + 3]), q, s1);
      }
      for (let k = 0; k < schirme.length; k += 5) {
        const ph = schirme[k + 4];
        const tilt = 0.32 + Math.sin(time * 1.7 + ph) * 0.12 + Math.sin(time * 4.3 + ph) * 0.05;
        e.set(-tilt * WZ, ph, tilt * WX, 'XYZ');
        q.setFromEuler(e);
        teile[schirme[k]].m.compose(v.set(schirme[k + 1], schirme[k + 2] + Math.sin(time * 3 + ph) * 0.04, schirme[k + 3]), q, s1);
      }
      // --- Tücher: Grundlage am Mast, Richtung Lee ---
      for (let k = 0; k < tuecher.length; k += 6) {
        const rot = tuecher[k + 4] - Math.PI / 2;
        // Fahne: Mast senkrecht. Plane (Neigung > 0): Kante liegt waagrecht, das freie Ende hebt sich im Wind.
        if (tuecher[k + 5] > 0) e.set(Math.PI / 2, rot, tuecher[k + 5], 'YZX');
        else e.set(0, rot, 0, 'YXZ');
        q.setFromEuler(e);
        teile[tuecher[k]].m.compose(v.set(tuecher[k + 1], tuecher[k + 2], tuecher[k + 3]), q, s1);
      }
      // --- Portalhubwagen ---
      for (let k = 0; k < hubwagen.length; k += 5) {
        const a = hubwagen[k + 1];
        const b = hubwagen[k + 2];
        const u = 0.5 - 0.5 * Math.cos(time * 0.13 + hubwagen[k + 4]);
        const m = a + (b - a) * u;
        const i = S(m);
        const l = t.wh[i] + hubwagen[k + 3];
        const x = X(i, l);
        const z = Z(i, l);
        lage(hubwagen[k], x, hubBoden[Math.max(0, Math.min(hubBoden.length - 1, Math.round(m - a)))], z, HD(i), 0, 0);
      }
      // --- Krane: Laufkatze holt Container vom Schiff und setzt ihn an Land ab ---
      for (let k = 0; k < krane.length; k += 13) {
        const pk = krane[k];
        const ps = krane[k + 1];
        const pp = krane[k + 2];
        const pc = krane[k + 3];
        const x0 = krane[k + 4];
        const y0 = krane[k + 5];
        const z0 = krane[k + 6];
        const rot = krane[k + 7];
        const xs = krane[k + 8];
        const xl = krane[k + 9];
        const ySea = krane[k + 10];
        const yLand = krane[k + 11];
        const T = 30;
        const u = (((time / T + krane[k + 12]) % 1) + 1) % 1;
        const TOP = 24.2;
        const HOCH = 16.5; // Spreader-Unterkante hoch über der Bahn (≥ 10 m)
        let lx: number;
        let sy: number;
        let carry: boolean;
        const sm = (f: number): number => f * f * (3 - 2 * f);
        if (u < 0.12) {
          lx = xs;
          sy = HOCH + (ySea - HOCH) * sm(u / 0.12);
          carry = false;
        } else if (u < 0.17) {
          lx = xs;
          sy = ySea;
          carry = u > 0.145;
        } else if (u < 0.3) {
          lx = xs;
          sy = ySea + (HOCH - ySea) * sm((u - 0.17) / 0.13);
          carry = true;
        } else if (u < 0.52) {
          lx = xs + (xl - xs) * sm((u - 0.3) / 0.22);
          sy = HOCH;
          carry = true;
        } else if (u < 0.64) {
          lx = xl;
          sy = HOCH + (yLand - HOCH) * sm((u - 0.52) / 0.12);
          carry = true;
        } else if (u < 0.69) {
          lx = xl;
          sy = yLand;
          carry = u < 0.665;
        } else if (u < 0.8) {
          lx = xl;
          sy = yLand + (HOCH - yLand) * sm((u - 0.69) / 0.11);
          carry = false;
        } else {
          lx = xl + (xs - xl) * sm((u - 0.8) / 0.2);
          sy = HOCH;
          carry = false;
        }
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const wx = x0 + lx * c;
        const wz = z0 - lx * s;
        lage(pk, wx, y0 + TOP, wz, rot, 0, 0);
        const rope = TOP - 0.8 - sy;
        const swing = Math.sin(time * 1.4 + k) * 0.05 * Math.min(1, rope / 10);
        // Seile: vom Katzenboden bis zum Spreader (Einheit 1 m nach unten)
        e.set(swing, rot, 0, 'YXZ');
        q.setFromEuler(e);
        teile[ps].m.compose(v.set(wx, y0 + TOP - 0.8, wz), q, sv.set(1, rope, 1));
        // Spreader am Seilende (mit Pendel)
        const ox = -Math.sin(swing) * rope;
        const sx = wx + ox * s;
        const sz = wz + ox * c;
        const syW = y0 + TOP - 0.8 - Math.cos(swing) * rope;
        lage(pp, sx, syW, sz, rot, swing, 0);
        if (carry) lage(pc, sx, syW, sz, rot, swing, 0);
        else teile[pc].m.copy(zero);
      }
      // --- Möwen: stehen im Wind, werden ab und zu zurückgeweht und schlagen sich zurück ---
      for (let k = 0; k < moewen.length; k += 7) {
        const ph = moewen[k + 6];
        const gust = Math.max(0, Math.sin(time * 0.31 + ph)) ** 6;
        const back = gust * 7;
        const flapping = Math.max(0, Math.cos(time * 0.31 + ph)) * gust > 0.02 || Math.sin(time * 0.31 + ph) > 0.85;
        const x = moewen[k + 3] + WX * back + Math.sin(time * 0.7 + ph) * 1.2;
        const y = moewen[k + 4] + Math.sin(time * 0.9 + ph * 2) * 0.8 + gust * 1.5;
        const z = moewen[k + 5] + WZ * back + Math.cos(time * 0.55 + ph) * 1.2;
        const yaw = LEE + Math.PI + Math.sin(time * 1.3 + ph) * 0.18;
        const roll = Math.sin(time * 2.1 + ph) * 0.12 + gust * 0.4;
        lage(moewen[k], x, y, z, yaw, -0.12 + gust * 0.3, roll, 2, 2, 2);
        const m0 = teile[moewen[k]].m;
        const ang = flapping ? 0.15 + Math.sin(time * 11 + ph) * 0.7 : 0.25 + Math.sin(time * 17 + ph) * 0.05;
        m5.makeRotationZ(ang);
        m5.setPosition(0.14, 0.06, 0.05);
        teile[moewen[k + 1]].m.multiplyMatrices(m0, m5);
        m5.makeRotationZ(Math.PI - ang);
        m5.setPosition(-0.14, 0.06, 0.05);
        teile[moewen[k + 2]].m.multiplyMatrices(m0, m5);
      }
      // Ecken neu setzen (Schiffe nur Lage)
      for (let k = 0; k < teile.length; k++) setzeTeil(teile[k], time);
      if (teile.length > 0) {
        dPos.needsUpdate = true;
        dNor.needsUpdate = true;
        if (dON) dON.needsUpdate = true;
        if (first) dynGeo.computeBoundingSphere();
      }

      // --- Leuchtfeuer: Kegel drehen ---
      if (hasBeam) {
        const a = time * 0.9;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const arr = lichtPos.array as Float32Array;
        for (let k = 0; k < beamBase.length; k += 3) {
          const x = beamBase[k];
          const y = beamBase[k + 1];
          const z = beamBase[k + 2];
          arr[beamV0 * 3 + k] = feuer[0] + x * ca + z * sa;
          arr[beamV0 * 3 + k + 1] = feuer[1] + y;
          arr[beamV0 * 3 + k + 2] = feuer[2] - x * sa + z * ca;
        }
        lichtPos.needsUpdate = true;
      }

      // --- Leuchten ---
      for (let k = 0; k < NL; k++) {
        const o = k * 8;
        const art = lichter[o + 4];
        const ph = lichter[o + 5];
        let size = lichter[o + 3];
        if (art === 1) size *= Math.sin(time * 3.2 + ph * 2.1) > 0 ? 1 : 0;
        else if (art === 2) size *= (time * 0.7 + ph) % 1 < 0.08 ? 1.4 : 0;
        else if (art === 3) {
          // Leuchtfeuer: hell, wenn ein Kegel zur Kamera zeigt
          const a = time * 0.9;
          const bx = Math.cos(a);
          const bz = -Math.sin(a);
          const dx = cam.x - lichter[o];
          const dz = cam.z - lichter[o + 2];
          const dl = Math.hypot(dx, dz) || 1;
          const al = Math.abs((bx * dx + bz * dz) / dl);
          size *= 0.55 + 0.9 * Math.max(0, al - 0.85) * 6.6;
        } else if (art === 4) size *= (time * 0.25 + ph) % 1 < 0.72 ? 1 : 0;
        const pt = lichter[o + 6];
        if (pt >= 0) {
          v.set(lichter[o], lichter[o + 1], lichter[o + 2]).applyMatrix4(teile[pt].m);
          // Hubwagen-/Boots-Leuchten auf null gezogener Teile verschwinden mit.
        } else v.set(lichter[o], lichter[o + 1], lichter[o + 2]);
        m4.makeScale(size, size, size);
        m4.setPosition(v);
        glow.setMatrixAt(k, m4);
      }
      if (NL > 0) glow.instanceMatrix.needsUpdate = true;

      // --- Wellenkämme ---
      for (let k = 0; k < NC; k++) {
        let age = time - cT0[k];
        if (age > cDur[k] || age < 0) {
          // Neuer Kamm in der Nähe der Kamera (im Kreis bis 230 m), nur auf freiem Wasser.
          const a = hrnd() * Math.PI * 2;
          const r = 18 + hrnd() * hrnd() * 220;
          cX[k] = cam.x + Math.cos(a) * r;
          cZ[k] = cam.z + Math.sin(a) * r;
          cDur[k] = 5 + hrnd() * 4;
          cS[k] = nass(cX[k], cZ[k]) && nass(cX[k] + WX * 20, cZ[k] + WZ * 20) ? 1.1 + hrnd() * 1.1 + r * 0.004 : 0;
          cT0[k] = time - (first ? hrnd() * cDur[k] : 0);
          age = time - cT0[k];
        }
        if (cS[k] === 0) {
          crests.setMatrixAt(k, zero);
          continue;
        }
        const f = age / cDur[k];
        const grow = Math.sin(Math.PI * f);
        const d = age * 4.2;
        e.set(0, LEE, 0, 'YXZ');
        q.setFromEuler(e);
        v.set(cX[k] + WX * d, SEA + 0.02, cZ[k] + WZ * d);
        sv.set(cS[k] * (0.6 + 0.6 * f), cS[k] * grow * 0.9, cS[k] * (0.7 + grow * 0.5));
        m4.compose(v, q, sv);
        crests.setMatrixAt(k, m4);
      }
      crests.instanceMatrix.needsUpdate = true;

      // --- Wolkenbänke und Wetterleuchten ---
      flashT -= dt;
      if (flashT <= 0) {
        const b = Math.floor(hrnd() * NB);
        flash[b] = 1;
        flashT = 3 + hrnd() * 7;
        hemiBoost = 0.24;
      }
      for (let k = 0; k < NB; k++) {
        const a = bankA[k] + time * 0.003;
        const r = 2050;
        e.set(0, -a + Math.PI / 2, 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v.set(cam.x + Math.cos(a) * r, SEA - 70 + (k % 3) * 30, cam.z + Math.sin(a) * r), q, s1);
        banks.setMatrixAt(k, m4);
        const fl = flash[k];
        // Flackern: zweimal kurz hell
        const lit = fl > 0.75 || (fl > 0.45 && fl < 0.62) ? fl * 3.2 : fl * 0.6;
        col.setRGB(1 + lit, 1 + lit, 1.08 + lit * 1.1);
        banks.setColorAt(k, col);
        flash[k] = Math.max(0, fl - dt * 2.2);
      }
      banks.instanceMatrix.needsUpdate = true;
      if (banks.instanceColor) banks.instanceColor.needsUpdate = true;
      hemiBoost = Math.max(0, hemiBoost - dt * 1.6);
      world.hemi.intensity = hemiBase + hemiBoost;

      // --- Teilchen ---
      if (detail > 0) {
        // Gischt: jede Welle schlägt im eigenen Takt an die Mauer – nur in Sichtweite.
        for (let k = 0; k < NG; k++) {
          const o = k * 6;
          const x = gischt[o];
          const z = gischt[o + 2];
          const cyc = time / 4.6 + gischt[o + 5] * 3 + (x * WX + z * WZ) * 0.004;
          const n = Math.floor(cyc);
          if (n === gCycle[k]) continue;
          gCycle[k] = n;
          if (Math.abs(x - cam.x) + Math.abs(z - cam.z) > 140) continue;
          if (((n * 7 + k * 3) % 5) > (hi ? 2 : 1)) continue;
          const nx = gischt[o + 3];
          const nz = gischt[o + 4];
          for (let p = 0; p < (hi ? 4 : 2); p++) {
            const up = 7 + hrnd() * 6;
            fx.puff(x + nx * 0.6 + (hrnd() - 0.5) * 2.4, SEA + 0.8, z + nz * 0.6 + (hrnd() - 0.5) * 2.4, -nx * 1.5 + WX * 3, up, -nz * 1.5 + WZ * 3, 1.3, 1.4 + hrnd() * 1.2, p % 2 ? 0xffffff : 0xdcecf0, 1.1, 10);
          }
        }
        // Nebelhorn: alle 18 s drei dicke Stöße
        hornT -= dt;
        if (hornT <= 0 && feuer[1] > 0) {
          hornT = 18;
          hornBlow = 1.4;
        }
        if (hornBlow > 0) {
          hornBlow -= dt;
          if (Math.floor(hornBlow * 10) !== Math.floor((hornBlow + dt) * 10) && Math.abs(horn[0] - cam.x) + Math.abs(horn[2] - cam.z) < 260) {
            const hx = Math.sin(hornDir);
            const hz = Math.cos(hornDir);
            fx.puff(horn[0], horn[1], horn[2], hx * 6 + WX * 2, 1.2, hz * 6 + WZ * 2, 2.2, 1.6, 0xeef2f4, 2.4, -1);
          }
        }
        // Qualm aus dem Schlepper-Schornstein
        tugT -= dt;
        if (tugT <= 0 && boote.length > 0) {
          tugT = 1.1;
          v.set(0, 6.6, -1.8).applyMatrix4(teile[boote[0]].m);
          if (Math.abs(v.x - cam.x) + Math.abs(v.z - cam.z) < 200) fx.puff(v.x, v.y, v.z, WX * 3, 2.5, WZ * 3, 1.5, 0.8, 0x55525e, 0.5, -2);
        }
      }
      first = false;
      if (hi) {
        // Regen: schräge Schleier um die Kamera, in Schüben dichter.
        // Jeder Tropfen ist ein kurzer Strich aus drei Punkten entlang seiner Bahn.
        rainT += dt * (40 + 34 * Math.max(0, Math.sin(time * 0.45)));
        while (rainT >= 1) {
          rainT -= 1;
          const a = hrnd() * Math.PI * 2;
          const r = 4 + hrnd() * 24;
          const x = cam.x + Math.cos(a) * r - WX * 5;
          const z = cam.z + Math.sin(a) * r - WZ * 5;
          const y = cam.y + 7 + hrnd() * 7;
          const sz = 0.08 + hrnd() * 0.05;
          for (let d = 0; d < 3; d++) fx.spark(x - WX * 0.11 * d, y + 0.3 * d, z - WZ * 0.11 * d, WX * 9, -24, WZ * 9, 0.75, sz * (1 - d * 0.22), 0x74879a, 0);
        }
      }
    },
    dispose(): void {
      world.hemi.intensity = hemiBase;
      for (const d of disposables) d.dispose();
    },
  };
}
