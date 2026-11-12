// Kulisse der Zeitriss-Ruine: eine Tempelanlage im Dschungel – zweimal am selben Ort.
//
// Einst (Zeitalter 0) steht die Anlage in voller Pracht: bemalte Säulen und Friese in
// Zinnober, Lapislazuli und Gold, heile Dächer, flatternde Wimpel, brennende Feuerschalen,
// ein Garten mit Wasserbecken und Springbrunnen, Statuen mit Gesichtern, Priester, Händler
// und Zuschauer auf den Tribünen, weiße Reiher über den Dächern.
// Jetzt (Zeitalter 1) sind dieselben Bauten eine Ruine am selben Platz: Säulen geborsten
// oder umgestürzt, Dächer eingefallen, Statuen ohne Kopf, alles von Lianen, Würgefeigen,
// Farn und Moos überwuchert, die Becken sind Tümpel mit Seerosen; statt Menschen Affen,
// Papageien und Schmetterlinge, Lichtstrahlen fallen durchs Blätterdach, über dem Graben
// der Großen Halle hängt Dunst.
//
// Orte: Tempelvorplatz (Portal mit Freitreppe, zwei Kolossalstatuen, Tribünen,
// Feuerschalen-Allee), Prozessionsstraße (liegende Wächter – Tapir-Jaguar-Wesen mit
// Federkrone – und Obelisken), Schatzkammer (gestufter Bau über dem Tunnel, gerahmte
// Portale an beiden Mündungen), Große Halle (Säulenreihen neben dem Steg, Einst mit Gebälk
// und Dach, in der Mitte ein offener Hof für die Zeituhr; im Graben darunter ein Becken),
// Abgang (Freitreppen, Wasserspeier), Gartenhof (Terrasse mit Becken, Hecken, Laubengängen,
// Brunnen), Rückweg (Stelen, Marktstände). In der Mitte der Haupttempel, eine Stufenpyramide,
// dazu Nebentempel und eine Statuenachse. Rundherum Dschungel (Kapokbäume mit Brettwurzeln,
// Palmen, Farn), in der Ferne Tafelberge im Dunst mit einem Wasserfall.
//
// Wechsel: welche Fassung zu sehen ist, ergibt sich allein aus der Rennzeit. In den 3 s
// vor dem Sprung flimmert die kommende Fassung als Schemen durch (golden: Einst kommt,
// türkis: Jetzt kommt) – immer häufiger; beim Sprung hellt ein kurzer Lichtblitz auf.
//
// Technik (harte Vorgabe, siehe toon.ts): nur Eckenfarben, Toon-Material mit Kontur,
// MeshBasicMaterial, Instanzen und Netze mit je Bild neu gesetzten Ecken – keine eigenen
// Shader, keine Texturen. Im Lauf wird nichts angelegt.

import * as THREE from 'three';
import { ERA_WARN, eraAt, eraSince, eraUntil } from '../../game/mechanics';
import { EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { seeded, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { PIT_D, type World } from '../world';

const TAU = Math.PI * 2;
/** Wind (Einheitsvektor, wohin): eine leichte Brise vom See her. */
const WX = 0.8;
const WZ = 0.6;
/** Freier Hof um die Zeituhr in der Mitte der Großen Halle (Meter längs der Strecke). */
const HOF = 12;
/** Lichtblitz beim Sprung: Dauer in Ticks und Stärke. */
const BLITZ_T = 18;
const BLITZ = 0.2;

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

  /** Viereck mit eigener Farbe je Ecke (Verläufe: Lichtstrahlen). */
  quadV(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    const ps: V3[] = [a, b, c, a, c, d];
    const cs: RGB[] = [ca, cb, cc, ca, cc, cd];
    for (let k = 0; k < 6; k++) {
      this.p(ps[k][0], ps[k][1], ps[k][2]);
      this.col.push(cs[k][0], cs[k][1], cs[k][2]);
    }
  }

  /** Viereck, dessen Vorderseite von ref weg zeigt. */
  flaeche(a: V3, b: V3, c: V3, d: V3, color: RGB, ref: V3): void {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const g = nx * ((a[0] + c[0]) / 2 - ref[0]) + ny * ((a[1] + c[1]) / 2 - ref[1]) + nz * ((a[2] + c[2]) / 2 - ref[2]);
    if (g >= 0) this.quad(a, b, c, d, color);
    else this.quad(d, c, b, a, color);
  }

  /** Dreieck wie flaeche(). */
  dreieck(a: V3, b: V3, c: V3, color: RGB, ref: V3): void {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const g = nx * (a[0] - ref[0]) + ny * (a[1] - ref[1]) + nz * (a[2] - ref[2]);
    if (g >= 0) this.tri(a, b, c, color);
    else this.tri(a, c, b, color);
  }

  /** Quader um (cx, cy, cz), um die Hochachse gedreht (wie MeshBuilder.box). */
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

  /** Quader ohne Boden, von y0 bis y1 (steht auf etwas). */
  klotz(cx: number, y0: number, y1: number, cz: number, sx: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
    if (y1 - y0 < 0.02) return;
    this.box(cx, (y0 + y1) / 2, cz, sx, y1 - y0, sz, color, rotY, top, false);
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

  /** Zylinder (bzw. Kegelstumpf) von a nach c; r0 unten, r1 oben. */
  zyl(a: V3, c: V3, r0: number, r1: number, seg: number, color: RGB, offen = true): void {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    tq.setFromUnitVectors(UP, tv.set(dx / len, dy / len, dz / len));
    tm.compose(tp.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), tq, ts.set(1, 1, 1));
    this.geoM(new THREE.CylinderGeometry(r1, r0, len, seg, 1, offen), color, tm);
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

  /** Klumpen (Ikosaeder, gestaucht): Laub, Moos, Büsche. */
  kugel(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: RGB, ry = 0): void {
    this.geo(new THREE.IcosahedronGeometry(1, 0), color, x, y, z, 0, ry, 0, sx, sy, sz);
  }

  /** Flache Scheibe (Seerose, Becken, Schmuckscheibe) mit Normale nach oben. */
  scheibe(x: number, y: number, z: number, r: number, seg: number, color: RGB): void {
    this.geo(new THREE.CircleGeometry(r, seg), color, x, y, z, -Math.PI / 2, 0, 0);
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

/** Mehrere Sammler zu einer Geometrie. */
function vereint(bs: Bau[]): THREE.BufferGeometry {
  const all = new Bau();
  for (const b of bs) {
    for (const v of b.pos) all.pos.push(v);
    for (const v of b.col) all.col.push(v);
  }
  return all.build();
}

// --- Bewegte Teile ------------------------------------------------------------------

/** 0 = starr, 2 = Tuch (flattert; lokale x-Achse vom Halt weg). */
type Art = 0 | 2;

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

  ende(art: Art, tuch?: { len: number; amp: number; k: number; w: number; ph: number }): number {
    this.liste.push({ v0: this.start, v1: this.verts, art, m: new THREE.Matrix4(), len: tuch?.len ?? 1, amp: tuch?.amp ?? 0, k: tuch?.k ?? 0, w: tuch?.w ?? 0, ph: tuch?.ph ?? 0 });
    return this.liste.length - 1;
  }
}

/** Ordnet die Ecken: erst alle starren Teile, dann die Tücher. Gibt die Zahl der starren Ecken zurück. */
function ordnen(d: Teile): number {
  const pos: number[] = [];
  const col: number[] = [];
  let fest = 0;
  for (const art of [0, 2] as const) {
    for (const p of d.liste) {
      if (p.art !== art) continue;
      const v0 = pos.length / 3;
      for (let i = p.v0 * 3; i < p.v1 * 3; i++) {
        pos.push(d.pos[i]);
        col.push(d.col[i]);
      }
      p.v0 = v0;
      p.v1 = pos.length / 3;
    }
    if (art === 0) fest = pos.length / 3;
  }
  d.pos.length = 0;
  d.col.length = 0;
  for (const v of pos) d.pos.push(v);
  for (const v of col) d.col.push(v);
  return fest;
}

/** Geglättete Normalen je Teil (für die Kontur); Tücher bekommen keine Kontur. */
function glatteNormalen(pos: Float32Array, nor: Float32Array, teile: Teil[]): Float32Array {
  const out = new Float32Array(pos.length);
  const sums = new Map<string, number[]>();
  const key = (i: number): string => `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
  for (const p of teile) {
    if (p.art === 2) continue;
    sums.clear();
    for (let i = p.v0; i < p.v1; i++) {
      const s = sums.get(key(i));
      if (s) {
        s[0] += nor[i * 3];
        s[1] += nor[i * 3 + 1];
        s[2] += nor[i * 3 + 2];
      } else sums.set(key(i), [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]]);
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
  stein: rgb(0xeadcae),
  steinM: rgb(0xd8c390),
  steinD: rgb(0xb8a06a),
  steinH: rgb(0xf6ecc8),
  alt: rgb(0xb3ad8c),
  altM: rgb(0x9c9878),
  altD: rgb(0x7d7c64),
  moos: rgb(0x6a9a3e),
  moosD: rgb(0x47753a),
  zinnober: rgb(0xd8432a),
  lapis: rgb(0x2a4cae),
  lapisD: rgb(0x1f3680),
  gold: rgb(0xf2c23a),
  goldD: rgb(0xc8922a),
  tuerkis: rgb(0x2fb6a6),
  weiss: rgb(0xf6f1e2),
  dach: rgb(0xbb5638),
  dachD: rgb(0x93402b),
  laub: rgb(0x3f9a3e),
  laubH: rgb(0x62b84a),
  laubD: rgb(0x2a7536),
  laubDD: rgb(0x1e5a30),
  stamm: rgb(0x9a8a72),
  stammD: rgb(0x75644e),
  holz: rgb(0x7a5a3c),
  wurzel: rgb(0x6e5843),
  liane: rgb(0x4d7d2a),
  wasser: rgb(0x36c2bc),
  wasserH: rgb(0xbff4e6),
  tuempel: rgb(0x2a5a40),
  tuempelH: rgb(0x46804e),
  flamme: rgb(0xff8f1a),
  flammeH: rgb(0xffe27a),
  haut: rgb(0xc58c5c),
  affe: rgb(0x7a5236),
  affeH: rgb(0xe2bf94),
  tusche: rgb(0x2a2230),
  rasen: rgb(0x78c450),
  hecke: rgb(0x2f8a3a),
  berg: rgb(0xa2916c),
  bergD: rgb(0x85775a),
  bergG: rgb(0x4f8a46),
  rosa: rgb(0xf08ab4),
};
const BUNT = [0xd8432a, 0x2a4cae, 0xf2c23a, 0x2fb6a6, 0xf6f1e2, 0xe0782a, 0x8a3fa0];
const PAPAGEI = [0xe23a2a, 0x2a6ae0, 0xf2d23a, 0x3fb04a, 0xe23a2a, 0x2fb6a6];
const FALTER = [0x3fa0ff, 0xffb02a, 0xff5a8a, 0xf2e23a, 0x5ae0c0];

export function buildRuineLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail === 2;
  const lines = detail > 0;
  /** Dichte der Zierde je Qualitätsstufe. */
  const dicht = detail === 0 ? 0.45 : hi ? 1 : 0.75;
  const SEA = th.liquidY ?? -5;
  const era = t.era;
  const rnd = seeded(11000 + t.index * 61);

  // Sammler: gemeinsam (groß mit Kontur, klein ohne), je Zeitalter groß, klein, leuchtend, bewegt.
  const g0 = new Bau();
  const k0 = new Bau();
  const G = [new Bau(), new Bau()];
  const K = [new Bau(), new Bau()];
  const L = [new Bau(), new Bau()];
  const D = [new Teile(), new Teile()];
  /** Lichtstrahlen und Dunst (additiv, nur Jetzt). */
  const strahl = new Bau();

  // --- Strecke ----------------------------------------------------------------------
  const S = (m: number): number => Math.max(0, Math.min(t.n - 1, Math.round(m / t.step)));
  const X = (i: number, lat: number): number => t.px[i] + rightX(t, i) * lat;
  const Z = (i: number, lat: number): number => t.pz[i] + rightZ(t, i) * lat;
  const HD = (i: number): number => Math.atan2(t.tx[i], t.tz[i]);
  const boden = (x: number, z: number): number => world.heightAt(x, z);
  /** Tiefster Boden in einem Rechteck (Mitte, halbe Seiten, gedreht) – für Sockel. */
  const bodenMin = (x: number, z: number, hx: number, hz: number, rot = 0): number => {
    let m = boden(x, z);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) m = Math.min(m, boden(x + a * hx * c + b * hz * s, z - a * hx * s + b * hz * c));
    return m;
  };
  const bodenMax = (x: number, z: number, hx: number, hz: number, rot = 0): number => {
    let m = boden(x, z);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let a = -1; a <= 1; a += 0.5)
      for (let b = -1; b <= 1; b += 0.5) m = Math.max(m, boden(x + a * hx * c + b * hz * s, z - a * hx * s + b * hz * c));
    return m;
  };
  /** Mindestens 3 m (plus Radius r) von jeder Fahrbahnkante entfernt? */
  const frei = (x: number, z: number, r: number): boolean => world.clearance(x, z) >= 3 + r;
  /** Eigene Belegung: Kreise (x, z, r). */
  const belegt: number[] = [];
  const platz = (x: number, z: number, r: number): boolean => {
    for (let k = 0; k < belegt.length; k += 3) if (Math.hypot(x - belegt[k], z - belegt[k + 1]) < r + belegt[k + 2]) return false;
    return true;
  };
  const merke = (x: number, z: number, r: number): void => {
    belegt.push(x, z, r);
  };
  /** Liegt ein Punkt im Ring der Hauptstrecke (in der Anlage)? */
  const innen = (x: number, z: number): boolean => {
    let inside = false;
    const st = 3;
    for (let i = 0, j = t.n - st; i < t.n; j = i, i += st) {
      const zi = t.pz[i];
      const zj = t.pz[j];
      if (zi > z !== zj > z && x < ((t.px[j] - t.px[i]) * (z - zi)) / (zj - zi) + t.px[i]) inside = !inside;
    }
    return inside;
  };
  /** Wahrzeichen (Zeituhr): darum bleibt ein Kreis frei. */
  const lmX = t.px[t.landmark];
  const lmZ = t.pz[t.landmark];
  const uhrFrei = (x: number, z: number, r: number): boolean => Math.hypot(x - lmX, z - lmZ) > 14 + r;
  /** Trasse des Aquädukts (Abzweigung 1) samt 8 m beidseits frei halten. */
  const aqu = t.branches[1];
  const aquFrei = (x: number, z: number, r: number): boolean => {
    if (!aqu) return true;
    for (let i = aqu.first; i < aqu.first + aqu.count; i += 2) if (Math.hypot(x - t.px[i], z - t.pz[i]) < t.wh[i] + 8 + r) return false;
    return true;
  };
  const ok = (x: number, z: number, r: number): boolean => frei(x, z, r) && uhrFrei(x, z, r) && aquFrei(x, z, r);

  // Bewegtes: Wackler (Menschen, Affen), Tücher; Flieger (Instanzen); Funken.
  /** je Zeitalter: Teil, x, y, z, Drehung, Art (0 hüpfen, 1 umschauen, 2 schaukeln), Phase, Stärke */
  const wackler: number[][] = [[], []];
  /** je Zeitalter: Teile, die flattern (Lage fest). */
  const tuecher: number[][] = [[], []];
  /** je Zeitalter: Mitte x, y, z, Halbmesser, Takt, Phase, Größe, Art (0 Vogel, 1 Falter) */
  const flieger: number[][] = [[], []];
  const fliegerFarbe: number[][] = [[], []];
  /** Flammen (Einst): x, y, z */
  const flammen: number[] = [];
  /** Wasserspiele (Einst): x, y, z, Stärke */
  const quellen: number[] = [];

  const vogel = (e: 0 | 1, x: number, y: number, z: number, r: number, w: number, size: number, color: number, art: 0 | 1): void => {
    flieger[e].push(x, y, z, r, w, rnd() * TAU, size, art);
    fliegerFarbe[e].push(color);
  };

  // ==================================================================================
  // Bausteine
  // ==================================================================================

  /** Kapokbaum: hoher heller Stamm, Brettwurzeln, breites Schirmdach aus Laubklumpen. */
  const baum = (b: Bau, x: number, y: number, z: number, s: number, r: () => number, krone = true): void => {
    const h = (13 + r() * 7) * s;
    const r0 = 0.8 * s;
    b.zyl([x, y - 0.6, z], [x, y + h, z], r0, r0 * 0.6, 6, C.stamm);
    const a0 = r() * TAU;
    for (let q = 0; q < 3; q++) {
      const a = a0 + (q * TAU) / 3 + (r() - 0.5) * 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const len = (2.2 + r() * 1.4) * s;
      const hh = (2.6 + r() * 1.4) * s;
      const nx = -sa * 0.16 * s;
      const nz = ca * 0.16 * s;
      const top: V3 = [x + ca * r0 * 0.5, y + hh, z + sa * r0 * 0.5];
      const foot: V3 = [x + ca * (r0 + len), y - 0.4, z + sa * (r0 + len)];
      const inn: V3 = [x + ca * r0 * 0.5, y - 0.4, z + sa * r0 * 0.5];
      const mid: V3 = [x, y + hh * 0.3, z];
      const off = (p: V3, k: number): V3 => [p[0] + nx * k, p[1], p[2] + nz * k];
      b.dreieck(off(top, 1), off(foot, 1), off(inn, 1), C.stammD, off(mid, -3));
      b.dreieck(off(top, -1), off(foot, -1), off(inn, -1), C.stammD, off(mid, 3));
      b.flaeche(off(top, 1), off(foot, 1), off(foot, -1), off(top, -1), C.stamm, [x, y - 3, z]);
    }
    // Ast und Schirmkrone
    const aa = r() * TAU;
    const ax = x + Math.cos(aa) * 3.2 * s;
    const az = z + Math.sin(aa) * 3.2 * s;
    b.stab([x, y + h * 0.72, z], [ax, y + h + 0.6 * s, az], 0.32 * s, C.stammD);
    if (!krone) return;
    b.kugel(x - Math.cos(aa) * 0.8 * s, y + h + 1.4 * s, z - Math.sin(aa) * 0.8 * s, 6.4 * s, 2.5 * s, 6.4 * s, r() < 0.5 ? C.laub : C.laubH, r());
    b.kugel(ax + Math.cos(aa) * 1.5 * s, y + h + 0.6 * s, az + Math.sin(aa) * 1.5 * s, 4.4 * s, 1.9 * s, 4.4 * s, C.laubD, r());
  };

  /** Palme (beidseitig gezeichnet): gebogener Stamm, sieben Wedel. */
  const palme = (b: Bau, x: number, y: number, z: number, s: number, r: () => number): void => {
    const lean = r() * TAU;
    const lx = Math.cos(lean);
    const lz = Math.sin(lean);
    const h = (8 + r() * 4) * s;
    let px = x;
    let pz = z;
    let py = y - 0.3;
    for (let k = 1; k <= 3; k++) {
      const u = k / 3;
      const nx = x + lx * u * u * 2.6 * s;
      const nz = z + lz * u * u * 2.6 * s;
      const ny = y + h * u;
      b.zyl([px, py, pz], [nx, ny, nz], 0.34 * s, 0.28 * s, 5, k % 2 ? C.stammD : C.stamm);
      px = nx;
      pz = nz;
      py = ny;
    }
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + r() * 0.4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const wx = -sa * 0.55 * s;
      const wz = ca * 0.55 * s;
      const m1: V3 = [px + ca * 2.2 * s, py + 0.5 * s, pz + sa * 2.2 * s];
      const tip: V3 = [px + ca * 4.2 * s, py - 1.3 * s, pz + sa * 4.2 * s];
      const c = k % 2 ? C.laub : C.laubH;
      b.tri([px, py + 0.2, pz], [m1[0] + wx, m1[1], m1[2] + wz], [m1[0] - wx, m1[1], m1[2] - wz], c);
      b.tri([m1[0] + wx, m1[1], m1[2] + wz], tip, [m1[0] - wx, m1[1], m1[2] - wz], c);
    }
  };

  /** Niedrige Qualität: jedes zweite Stück Kleinzeug in der Anlage entfällt. */
  let duennN = 0;
  const duenn = (b: Bau): boolean => detail === 0 && b !== k0 && ++duennN % 2 === 0;

  /** Farn: ein Kranz flacher Wedel (beidseitig gezeichnet). */
  const farn = (b: Bau, x: number, y: number, z: number, s: number, r: () => number, c: RGB = C.laubH): void => {
    if (duenn(b)) return;
    const n = 5;
    const a0 = r() * TAU;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      b.tri([x - sa * 0.25 * s, y, z + ca * 0.25 * s], [x + ca * 1.6 * s, y + 0.9 * s, z + sa * 1.6 * s], [x + sa * 0.25 * s, y, z - ca * 0.25 * s], k % 2 ? c : C.laub);
    }
  };

  /** Busch: zwei Laubklumpen. */
  const busch = (b: Bau, x: number, y: number, z: number, s: number, r: () => number): void => {
    if (duenn(b)) return;
    b.kugel(x, y + 0.7 * s, z, 1.9 * s, 1.4 * s, 1.7 * s, r() < 0.5 ? C.laubD : C.laub, r());
  };

  /** Würgefeige: Luftwurzeln umschlingen einen Körper von oben bis zum Boden. */
  const feige = (b: Bau, x: number, y0: number, y1: number, z: number, rad: number, r: () => number, krone: boolean): void => {
    const a0 = r() * TAU;
    for (let q = 0; q < 3; q++) {
      const a = a0 + (q * TAU) / 3;
      const p0: V3 = [x + Math.cos(a) * rad, y1 + 0.3, z + Math.sin(a) * rad];
      const p1: V3 = [x + Math.cos(a + 0.9) * rad * 1.05, (y0 + y1) / 2, z + Math.sin(a + 0.9) * rad * 1.05];
      const p2: V3 = [x + Math.cos(a + 1.5) * (rad + 0.8), y0 - 0.3, z + Math.sin(a + 1.5) * (rad + 0.8)];
      b.stab(p0, p1, 0.28, C.wurzel);
      b.stab(p1, p2, 0.32, C.wurzel);
    }
    if (krone) {
      b.kugel(x + 0.6, y1 + 2.0, z - 0.3, 3.8, 2.4, 3.8, C.laubD, r());
    }
  };

  /** Liane (Jetzt) bzw. herabhängende Wurzel: Tuch, das von (x, y, z) senkrecht herabhängt. */
  const liane = (e: 0 | 1, x: number, y: number, z: number, len: number, rot: number, c: RGB, breit = 0.28): void => {
    const d = D[e];
    d.beginn();
    const n = 4;
    for (let k = 0; k < n; k++) {
      const x0 = (k / n) * len;
      const x1 = ((k + 1) / n) * len;
      const w0 = breit * (1 - (k / n) * 0.4);
      const w1 = breit * (1 - ((k + 1) / n) * 0.4);
      d.quad([x0, -w0, 0], [x1, -w1, 0], [x1, w1, 0], [x0, w0, 0], k % 2 ? c : C.laubD);
    }
    // ein paar Blätter
    d.tri([len * 0.5, 0, 0], [len * 0.62, 0.55, 0.1], [len * 0.7, 0.05, 0], C.laub);
    d.tri([len * 0.8, 0, 0], [len * 0.9, -0.5, 0.1], [len * 0.97, 0, 0], C.laubH);
    const p = d.ende(2, { len, amp: 0.35, k: 0.6, w: 1.1, ph: rnd() * TAU });
    // lokale x nach unten, y waagerecht
    const ax = new THREE.Vector3(0, -1, 0);
    const ay = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
    const az = new THREE.Vector3().crossVectors(ax, ay);
    d.liste[p].m.makeBasis(ax, ay, az).setPosition(x, y, z);
    tuecher[e].push(p);
  };

  const wimpelLage = new THREE.Matrix4();
  /** Wimpel an einer Stange (Einst): Stange in G[0], das Tuch flattert mit dem Wind. */
  const wimpel = (x: number, y: number, z: number, h: number, farbe: RGB, laenge = 4): void => {
    // in Weltkoordinaten – die Lage des Sammlers bleibt, wie sie war
    wimpelLage.copy(G[0].m);
    G[0].frei().zyl([x, y - 0.5, z], [x, y + h, z], 0.13, 0.1, 5, C.goldD);
    G[0].geo(new THREE.OctahedronGeometry(0.32, 0), C.gold, x, y + h + 0.2, z);
    G[0].m.copy(wimpelLage);
    const d = D[0];
    d.beginn();
    const n = 4;
    const hh = 1.3;
    for (let k = 0; k < n; k++) {
      const x0 = (k / n) * laenge;
      const x1 = ((k + 1) / n) * laenge;
      const y0 = -hh * (1 - (k / n) * 0.55);
      const y1 = -hh * (1 - ((k + 1) / n) * 0.55);
      const yo0 = -(hh - hh * (1 - (k / n) * 0.55)) / 2;
      const yo1 = -(hh - hh * (1 - ((k + 1) / n) * 0.55)) / 2;
      d.quad([x0, yo0 + y0, 0], [x1, yo1 + y1, 0], [x1, yo1, 0], [x0, yo0, 0], k === n - 1 ? C.gold : farbe);
    }
    const p = d.ende(2, { len: laenge, amp: 0.55, k: 1.1, w: 4.2, ph: rnd() * TAU });
    d.liste[p].m.makeRotationY(Math.atan2(-WZ, WX)).setPosition(x, y + h, z);
    tuecher[0].push(p);
  };

  /** Hängendes Banner (Einst) an einer Stelle, Fläche quer zu rot. */
  const banner = (x: number, y: number, z: number, len: number, rot: number, farbe: RGB): void => {
    const d = D[0];
    d.beginn();
    const n = 4;
    const w = 0.8;
    for (let k = 0; k < n; k++) {
      const x0 = (k / n) * len;
      const x1 = ((k + 1) / n) * len;
      d.quad([x0, -w, 0], [x1, -w, 0], [x1, w, 0], [x0, w, 0], k === n - 1 ? C.gold : k === 0 ? C.gold : farbe);
    }
    d.tri([len, -w, 0], [len + 0.9, 0, 0], [len, w, 0], C.gold);
    const p = d.ende(2, { len: len + 1, amp: 0.25, k: 0.9, w: 1.6, ph: rnd() * TAU });
    const ax = new THREE.Vector3(0, -1, 0);
    const ay = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
    const az = new THREE.Vector3().crossVectors(ax, ay);
    d.liste[p].m.makeBasis(ax, ay, az).setPosition(x, y, z);
    tuecher[0].push(p);
  };

  /** Mensch (Einst): Gewand, Kopf, Kopfputz. art: 0 Priester, 1 Händler, 2 Zuschauer. */
  const mensch = (x: number, y: number, z: number, rot: number, art: number, r: () => number, wackel: number): void => {
    const d = D[0];
    d.beginn();
    const robe = art === 0 ? C.weiss : rgb(BUNT[Math.floor(r() * BUNT.length)]);
    const s = 0.95 + r() * 0.15;
    d.geo(new THREE.CylinderGeometry(0.2 * s, 0.44 * s, 1.4 * s, 4, 1, true), robe, 0, 0.7 * s, 0, 0, Math.PI / 4);
    d.geo(new THREE.OctahedronGeometry(0.24 * s, 0), C.haut, 0, 1.6 * s, 0);
    if (art === 0) d.geo(new THREE.ConeGeometry(0.2 * s, 0.6 * s, 4, 1, true), C.gold, 0, 2.0 * s, 0);
    else if (art === 1) d.geo(new THREE.ConeGeometry(0.4 * s, 0.3 * s, 4, 1, true), rgb(BUNT[Math.floor(r() * BUNT.length)]), 0, 1.86 * s, 0);
    else d.tri([0, 1.75 * s, -0.1], [0.12, 2.35 * s, -0.12], [-0.08, 1.75 * s, -0.1], rgb(BUNT[Math.floor(r() * 4)]));
    const p = d.ende(0);
    wackler[0].push(p, x, y, z, rot, 0, r() * TAU, wackel);
  };

  /** Affe (Jetzt): sitzend, mit Schwanz; art 1 = sitzt und schaut, 2 = hängt an einer Liane. */
  const affe = (x: number, y: number, z: number, rot: number, art: 1 | 2, r: () => number): void => {
    const d = D[1];
    d.beginn();
    const yo = art === 2 ? -3.2 : 0;
    if (art === 2) d.box(0, -1.4, 0, 0.12, 2.8, 0.12, C.liane);
    d.geo(new THREE.OctahedronGeometry(0.42, 0), C.affe, 0, yo + 0.45, 0, 0, Math.PI / 4, 0, 0.9, 1.1, 0.8);
    d.geo(new THREE.OctahedronGeometry(0.28, 0), C.affe, 0, yo + 1.05, 0.05);
    d.tri([-0.2, yo + 0.92, 0.27], [0.2, yo + 0.92, 0.27], [0, yo + 1.18, 0.25], C.affeH);
    if (art === 2) d.stab([0.15, yo + 0.75, 0], [0.08, 0, 0], 0.1, C.affe);
    d.stab([0, yo + 0.2, -0.25], [0, yo + 0.5, -1.1], 0.08, C.affe);
    const p = d.ende(0);
    wackler[1].push(p, x, y, z, rot, art, r() * TAU, 1);
  };

  /** Säule. zustand (nur Jetzt): 0 ganz, 1 Stumpf, 2 nur Basis. Gibt die Oberkante zurück. */
  const saeule = (e: 0 | 1, x: number, y0: number, y1: number, z: number, r: number, zustand: number, rr: () => number, aussen: number): number => {
    const b = G[e];
    const k = K[e];
    b.frei();
    k.frei();
    const st = e ? C.alt : C.stein;
    b.klotz(x, y0 - 0.3, y0 + 1, z, r * 2.7, r * 2.7, e ? C.altM : C.steinM, 0, e ? C.moos : C.steinH);
    if (e === 0) {
      b.zyl([x, y0 + 1, z], [x, y1 - 1, z], r, r * 0.88, 8, st);
      if (detail > 0) k.zyl([x, y1 - 2.6, z], [x, y1 - 1.7, z], r * 0.95, r * 0.93, 8, C.zinnober);
      b.klotz(x, y1 - 1, y1, z, r * 2.7, r * 2.7, C.gold, 0, C.goldD);
      return y1;
    }
    if (zustand === 2) {
      // umgestürzt: Trommeln liegen nach außen
      const a = aussen + (rr() - 0.5) * 0.8;
      for (let q = 0; q < 2; q++) {
        const d0 = 2.5 + q * 2.6;
        const cx = x + Math.cos(a) * d0;
        const cz = z + Math.sin(a) * d0;
        const gy = boden(cx, cz) + r * 0.8;
        b.zyl([cx - Math.sin(a) * 1.1, gy, cz + Math.cos(a) * 1.1], [cx + Math.sin(a) * 1.1, gy + (rr() - 0.5) * 0.4, cz - Math.cos(a) * 1.1], r * 0.95, r * 0.95, 7, q % 2 ? C.alt : C.altM, false);
      }
      b.kugel(x, y0 + 1.1, z, r * 1.2, 0.4, r * 1.2, C.moos);
      return y0 + 1;
    }
    const top = zustand === 1 ? y0 + 1 + (y1 - y0 - 1) * (0.2 + rr() * 0.4) : y1;
    b.zyl([x, y0 + 1, z], [x, top - (zustand === 0 ? 1 : 0), z], r, r * 0.9, 7, st);
    if (zustand === 0) b.klotz(x, top - 1, top, z, r * 2.7, r * 2.7, C.altD, 0, C.moos);
    else {
      // Bruchkante mit Moos
      b.geo(new THREE.ConeGeometry(r * 0.92, 0.9, 7, 1, true), C.altD, x, top + 0.42, z, (rr() - 0.5) * 0.5, 0, (rr() - 0.5) * 0.5);
      k.kugel(x, top + 0.2, z, r * 1.05, 0.35, r * 1.05, C.moos, rr());
    }
    // Moosflecken am Schaft
    if (zustand === 1) k.zyl([x, y0 + 1, z], [x, y0 + 2.4, z], r * 1.04, r * 1.0, 7, C.moosD);
    return top;
  };

  /** Feuerschale: Einst brennt sie, Jetzt liegt sie umgekippt im Gras. */
  const feuerschale = (e: 0 | 1, x: number, z: number, rr: () => number): void => {
    const y = boden(x, z);
    const b = G[e].frei();
    if (e === 0) {
      b.klotz(x, y - 0.5, y + 1.5, z, 0.8, 0.8, C.steinM, 0, C.steinH);
      b.geo(new THREE.CylinderGeometry(0.95, 0.4, 0.6, 7, 1, true), C.gold, x, y + 1.8, z);
      L[0].frei();
      L[0].geo(new THREE.ConeGeometry(0.6, 1.5, 5, 1, true), C.flamme, x, y + 2.7, z);
      L[0].geo(new THREE.ConeGeometry(0.35, 1.1, 4, 1, true), C.flammeH, x + 0.15, y + 2.6, z - 0.1, 0, 0.6);
      flammen.push(x, y + 2.8, z);
    } else {
      const tilt = (rr() - 0.5) * 0.5;
      b.geo(new THREE.BoxGeometry(0.8, 2.0, 0.8), C.altM, x, y + 0.6, z, tilt, rr(), tilt * 0.6);
      const a = rr() * TAU;
      b.geo(new THREE.CylinderGeometry(0.95, 0.4, 0.6, 7, 1, true), C.goldD, x + Math.cos(a) * 1.6, y + 0.4, z + Math.sin(a) * 1.6, 1.3, a, 0);
      K[1].frei();
      farn(K[1], x + 0.6, y, z + 0.4, 0.8, rr);
    }
  };

  /** Stehende Statue auf Sockel (lokal: Blick nach +z). Jetzt ohne Kopf – der liegt daneben. */
  const statue = (e: 0 | 1, x: number, z: number, rot: number, s: number, rr: () => number): void => {
    const y = bodenMin(x, z, 1.4 * s, 1.4 * s, rot);
    const b = G[e].lage(x, 0, z, rot);
    const k = K[e].lage(x, 0, z, rot);
    const st = e ? C.alt : C.steinM;
    const sk = y + 1.6 * s;
    b.klotz(0, y - 0.6, sk, 0, 2.6 * s, 2.6 * s, e ? C.altD : C.steinD, 0, e ? C.moos : C.stein);
    b.klotz(0, sk, sk + 2.4 * s, 0, 1.5 * s, 0.9 * s, e ? C.alt : C.weiss);
    b.klotz(0, sk + 2.4 * s, sk + 4.4 * s, 0, 1.8 * s, 1.0 * s, st);
    b.box(1.15 * s, sk + 3.3 * s, 0.15 * s, 0.45 * s, 2.0 * s, 0.5 * s, st);
    if (e === 0 || rr() < 0.5) b.box(-1.15 * s, sk + 3.3 * s, 0.15 * s, 0.45 * s, 2.0 * s, 0.5 * s, st);
    if (e === 0) {
      b.klotz(0, sk + 4.4 * s, sk + 5.5 * s, 0, 1.0 * s, 1.0 * s, C.haut, 0, C.lapis);
      b.klotz(0, sk + 5.5 * s, sk + 6.2 * s, 0, 1.3 * s, 1.1 * s, C.lapis, 0, C.gold);
      b.box(0, sk + 6.7 * s, -0.1 * s, 0.25 * s, 1.0 * s, 0.25 * s, C.gold);
      // Gesicht: Augen, Nase, Mund
      k.box(-0.24 * s, sk + 5.05 * s, 0.51 * s, 0.22 * s, 0.12 * s, 0.04, C.tusche);
      k.box(0.24 * s, sk + 5.05 * s, 0.51 * s, 0.22 * s, 0.12 * s, 0.04, C.tusche);
      k.box(0, sk + 4.85 * s, 0.56 * s, 0.14 * s, 0.3 * s, 0.14 * s, C.haut);
      k.box(0, sk + 4.6 * s, 0.51 * s, 0.36 * s, 0.07 * s, 0.04, C.zinnober);
      k.box(0, sk + 4.2 * s, 0.52 * s, 1.85 * s, 0.35 * s, 0.06, C.gold);
    } else {
      // Kopf liegt am Fuß des Sockels
      const a = rr() * TAU;
      b.geo(new THREE.BoxGeometry(1.0 * s, 1.1 * s, 1.0 * s), C.altM, Math.cos(a) * 2.6 * s, y + 0.4 * s, Math.sin(a) * 2.6 * s, 0.4, a, 1.2);
      k.kugel(0, sk + 4.45 * s, 0, 0.8 * s, 0.25 * s, 0.6 * s, C.moos, rr());
      farn(k, 1.6 * s, y, 1.2 * s, 0.9, rr);
    }
    b.frei();
    k.frei();
  };

  /** Liegender Wächter: Tapir-Jaguar-Wesen mit Federkrone auf einem Sockel (lokal: Blick nach +z). */
  const waechter = (e: 0 | 1, x: number, z: number, rot: number, rr: () => number): void => {
    const y = bodenMin(x, z, 1.8, 3.2, rot);
    const b = G[e].lage(x, 0, z, rot);
    const k = K[e].lage(x, 0, z, rot);
    const top = Math.max(y, boden(x, z)) + 1.3;
    const st = e ? C.alt : C.stein;
    const fell = e ? C.altM : C.steinM;
    b.klotz(0, y - 0.6, top, 0, 3.4, 6.2, e ? C.altD : C.steinD, 0, e ? C.moos : C.steinH);
    if (e === 0) k.box(0, top - 0.35, 0, 3.5, 0.3, 6.3, C.lapis);
    // Leib und Hinterteil (Blick nach +z: der Kopf zeigt zur Straße)
    b.klotz(0, top, top + 1.7, -0.6, 2.1, 3.6, fell);
    b.klotz(0, top, top + 2.1, -1.9, 2.3, 1.6, st);
    // Vorderpranken
    b.klotz(0, top, top + 0.55, 1.9, 2.0, 1.8, st);
    // Kopf mit Tapirrüssel, Ohren
    const kopf = e === 1 && rr() < 0.4;
    if (!kopf) {
      b.klotz(0, top + 1.2, top + 2.8, 1.4, 1.5, 1.5, fell);
      b.geo(new THREE.BoxGeometry(0.55, 0.55, 1.2), st, 0, top + 1.45, 2.5, 0.35, 0, 0);
      k.tri([0.45, top + 2.75, 1.1], [0.8, top + 3.4, 1.0], [0.75, top + 2.75, 1.4], fell);
      k.tri([-0.45, top + 2.75, 1.1], [-0.8, top + 3.4, 1.0], [-0.75, top + 2.75, 1.4], fell);
      if (e === 0) {
        k.box(0.4, top + 2.25, 2.16, 0.26, 0.2, 0.04, C.tusche);
        k.box(-0.4, top + 2.25, 2.16, 0.26, 0.2, 0.04, C.tusche);
        // Federkrone: fünf Federn im Fächer (flach, beidseitig)
        for (let f = 0; f < 5; f++) {
          const a = (f - 2) * 0.36;
          const c = [C.zinnober, C.gold, C.lapis, C.gold, C.zinnober][f];
          const bx = Math.sin(a) * 0.4;
          const by = top + 2.7;
          const tx = Math.sin(a) * 2.5;
          const ty = top + 2.7 + Math.cos(a) * 2.2;
          const wx = Math.cos(a) * 0.22;
          const wy = -Math.sin(a) * 0.22;
          k.quad([bx - wx * 0.4, by - wy * 0.4, 1.0], [bx + wx * 0.4, by + wy * 0.4, 1.0], [tx + wx, ty + wy, 1.0], [tx - wx, ty - wy, 1.0], c);
        }
      } else {
        k.tri([0.1, top + 2.7, 1.0], [0.5, top + 3.6, 1.0], [0.4, top + 2.7, 1.0], C.altD);
        k.kugel(0, top + 2.8, 1.4, 0.9, 0.3, 0.9, C.moos, rr());
      }
    } else {
      b.geo(new THREE.BoxGeometry(1.5, 1.5, 1.5), C.altM, 2.6, y + 0.5, 1.0, 0.3, 0.6, 1.1);
      k.kugel(0, top + 1.75, 0.6, 1.0, 0.3, 1.0, C.moos, rr());
    }
    if (e === 1) {
      k.kugel(0, top + 1.8, -0.6, 1.2, 0.35, 1.8, C.moos, rr());
      farn(k, 1.8, y + 0.2, -2.6, 1, rr);
    }
    b.frei();
    k.frei();
  };

  /** Obelisk; Jetzt teils abgebrochen. */
  const obelisk = (e: 0 | 1, x: number, z: number, h: number, rr: () => number): void => {
    const y = bodenMin(x, z, 1.4, 1.4);
    const b = G[e].frei();
    b.klotz(x, y - 0.5, y + 1.2, z, 2.8, 2.8, e ? C.altD : C.steinD, 0, e ? C.moos : C.steinH);
    const broken = e === 1 && rr() < 0.55;
    const hh = broken ? h * (0.35 + rr() * 0.25) : h;
    b.zyl([x, y + 1.2, z], [x, y + 1.2 + hh, z], 1.0, broken ? 1.0 - 0.5 * (hh / h) : 0.55, 4, e ? C.alt : C.stein, true);
    if (!broken) b.geo(new THREE.ConeGeometry(0.55 * Math.SQRT2 * 0.71, 1.2, 4, 1, true), e ? C.altM : C.gold, x, y + 1.8 + hh, z, 0, Math.PI / 4);
    else {
      const a = rr() * TAU;
      const len = h - hh;
      b.zyl([x + Math.cos(a) * 2, boden(x + Math.cos(a) * 2, z + Math.sin(a) * 2) + 0.4, z + Math.sin(a) * 2], [x + Math.cos(a) * (2 + len), boden(x + Math.cos(a) * (2 + len), z + Math.sin(a) * (2 + len)) + 0.3, z + Math.sin(a) * (2 + len)], 0.8, 0.5, 4, C.altM, false);
      K[1].frei().kugel(x, y + 1.2 + hh, z, 0.9, 0.3, 0.9, C.moos, rr());
    }
    if (e === 0) {
      K[0].frei().zyl([x, y + 1.2 + hh * 0.7, z], [x, y + 1.2 + hh * 0.76, z], 0.8, 0.76, 4, C.zinnober);
    }
  };

  /** Tempelhaus auf einer Terrasse (lokal: Blick nach +z). Jetzt ohne Dach, Wände eingebrochen, Feige obenauf. */
  const tempelhaus = (e: 0 | 1, x: number, z: number, rot: number, s: number, seed: number): void => {
    const rr = seeded(seed);
    const hx = 9 * s;
    const hz = 12 * s;
    const yMin = bodenMin(x, z, hx + 3, hz + 3, rot) - 0.8;
    const yP = bodenMax(x, z, hx, hz, rot) + 1.4;
    const b = G[e].lage(x, 0, z, rot);
    const k = K[e].lage(x, 0, z, rot);
    const st = e ? C.alt : C.stein;
    const stM = e ? C.altM : C.steinM;
    // Terrasse und Treppe
    b.klotz(0, yMin, yP, 0, hx * 2, hz * 2, stM, 0, e ? C.altD : C.steinH);
    for (let q = 0; q < 4; q++) b.klotz(0, yMin, yP - (q + 1) * ((yP - yMin - 0.6) / 5), hz + 0.8 + q * 0.8, 6 * s, 0.8, q % 2 ? st : stM, 0, e && q % 2 ? C.moos : undefined);
    // Cella
    const ch = 6.5 * s;
    if (e === 0) {
      b.klotz(0, yP, yP + ch, -2.5 * s, 11 * s, 13 * s, C.weiss);
      k.box(0, yP + ch - 0.9, -2.5 * s, 11.1 * s, 0.7, 13.1 * s, C.zinnober);
      k.box(0, yP + ch - 0.4, -2.5 * s, 11.15 * s, 0.3, 13.15 * s, C.gold);
      k.box(0, yP + 1.9 * s, 4.03 * s, 2.4 * s, 3.8 * s, 0.1, C.tusche);
    } else {
      // Wände: zwei Seiten stehen noch, zerklüftet
      b.klotz(-5.2 * s, yP, yP + ch * 0.8, -2.5 * s, 0.8 * s, 13 * s, st);
      b.klotz(1.5 * s, yP, yP + ch * 0.55, -8.6 * s, 7 * s, 0.8 * s, st);
      b.klotz(4.4 * s, yP, yP + ch * 0.3, 2.8 * s, 2 * s, 2.4 * s, C.altD, 0.3, C.moos);
      for (let q = 0; q < 4; q++) k.geo(new THREE.BoxGeometry(1.4, 1, 1.2), C.altM, (rr() - 0.2) * 7 * s, yP + 0.4, (rr() - 0.5) * 9 * s, rr(), rr() * 3, rr());
      if (seed % 2 === 0) feige(b, -5.2 * s, yP, yP + ch * 0.8, -6 * s, 0.6, rr, true);
    }
    // Säulen vorn
    for (let q = 0; q < 4; q++) {
      const cx = (-4.5 + q * 3) * s;
      const zust = e ? [0, 1, 2, 1][(q + seed) % 4] : 0;
      const wx = x + cx * Math.cos(rot) + 7.5 * s * Math.sin(rot);
      const wz = z - cx * Math.sin(rot) + 7.5 * s * Math.cos(rot);
      saeule(e, wx, yP, yP + ch + 1, wz, 0.55 * s, zust, rr, rot);
      G[e].lage(x, 0, z, rot);
      K[e].lage(x, 0, z, rot);
    }
    if (e === 0) {
      // Gebälk und Satteldach
      b.klotz(0, yP + ch + 1, yP + ch + 2, -0.5 * s, 12.5 * s, 17 * s, C.stein, 0, C.steinM);
      k.box(0, yP + ch + 1.5, 8.04 * s, 12 * s, 0.6, 0.12, C.lapis);
      const y0 = yP + ch + 2;
      const y1 = y0 + 4 * s;
      const z0 = -9 * s;
      const z1 = 8 * s;
      const ew = 6.6 * s;
      b.quad([ew, y0, z1], [ew, y0, z0], [0, y1, z0], [0, y1, z1], C.dach);
      b.quad([-ew, y0, z0], [-ew, y0, z1], [0, y1, z1], [0, y1, z0], C.dachD);
      b.tri([-ew, y0, z1], [ew, y0, z1], [0, y1, z1], C.stein);
      b.tri([ew, y0, z0], [-ew, y0, z0], [0, y1, z0], C.stein);
      k.geo(new THREE.CircleGeometry(1.1 * s, 10), C.gold, 0, y0 + 1.4 * s, z1 + 0.05);
      b.box(0, y1 + 0.3, (z0 + z1) / 2, 0.4, 0.6, z1 - z0, C.gold);
    } else {
      // Gebälk: ein Stück liegt noch auf zwei Säulen
      b.klotz(-3 * s, yP + ch + 1, yP + ch + 1.9, 7.5 * s, 4.5 * s, 1.4 * s, C.altD, 0.04, C.moos);
      liane(1, x + (-3 * s) * Math.cos(rot) + 7.5 * s * Math.sin(rot), yP + ch + 1.2, z - (-3 * s) * Math.sin(rot) + 7.5 * s * Math.cos(rot), ch * 0.7, rot, C.liane);
    }
    b.frei();
    k.frei();
    if (e === 1) {
      for (let q = 0; q < 4; q++) {
        const a = rr() * TAU;
        const rad = hx + 2 + rr() * 4;
        const fx = x + Math.cos(a) * rad;
        const fz = z + Math.sin(a) * rad;
        if (frei(fx, fz, 1)) busch(K[1].frei(), fx, boden(fx, fz), fz, 1 + rr(), rr);
      }
    }
  };

  // ==================================================================================
  // Gemeinsam: Dschungel außerhalb der Anlage, Tafelberge, Wasserfall
  // ==================================================================================
  {
    const want = Math.round(58 * dicht);
    let n = 0;
    for (let tries = 0; tries < want * 40 && n < want; tries++) {
      const i = Math.floor(rnd() * t.n);
      const lat = -(t.wh[i] + 7 + Math.pow(rnd(), 0.9) * 44);
      const x = X(i, lat) + (rnd() - 0.5) * 6;
      const z = Z(i, lat) + (rnd() - 0.5) * 6;
      const s = 0.85 + rnd() * 0.5;
      if (innen(x, z) || !frei(x, z, 3.5 * s) || !platz(x, z, 5 * s)) continue;
      const y = boden(x, z);
      if (y < SEA + 1) continue;
      merke(x, z, 5 * s);
      baum(g0, x, y, z, s, rnd);
      n++;
    }
    const wantP = Math.round(50 * dicht);
    n = 0;
    for (let tries = 0; tries < wantP * 40 && n < wantP; tries++) {
      const i = Math.floor(rnd() * t.n);
      const lat = -(t.wh[i] + 4.5 + rnd() * 40);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (innen(x, z) || !frei(x, z, 1) || !platz(x, z, 2)) continue;
      const y = boden(x, z);
      if (y < SEA + 0.4) continue;
      merke(x, z, 2);
      palme(k0, x, y, z, 0.85 + rnd() * 0.4, rnd);
      n++;
    }
    // Unterholz am Rand: Farn und Büsche
    const wantF = Math.round(200 * dicht);
    n = 0;
    for (let tries = 0; tries < wantF * 10 && n < wantF; tries++) {
      const i = Math.floor(rnd() * t.n);
      const lat = -(t.wh[i] + 3.4 + rnd() * rnd() * 30);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (innen(x, z) || !frei(x, z, 0.4)) continue;
      const y = boden(x, z);
      if (y < SEA + 0.3) continue;
      if (rnd() < 0.3) busch(k0, x, y, z, 0.8 + rnd() * 0.8, rnd);
      else farn(k0, x, y, z, 0.9 + rnd() * 0.7, rnd, rnd() < 0.5 ? C.laubH : C.laubD);
      n++;
    }
    // Tafelberge im Dunst, einer mit Wasserfall
    const NM = detail === 0 ? 6 : 9;
    for (let k = 0; k < NM; k++) {
      const a = (k / NM) * TAU + rnd() * 0.35;
      const dist = 560 + rnd() * 180;
      const x = world.center.x + Math.cos(a) * dist;
      const z = world.center.z + Math.sin(a) * dist;
      const r = 70 + rnd() * 60;
      const h = 70 + rnd() * 70;
      k0.geo(new THREE.CylinderGeometry(r * 0.82, r, h, 7, 1, true), k % 2 ? C.berg : C.bergD, x, -12 + h / 2, z, 0, rnd(), 0);
      k0.geo(new THREE.CylinderGeometry(r * 0.6, r * 0.82, 6, 7, 1, false), C.bergG, x, -12 + h + 3, z, 0, rnd(), 0);
      if (k === 1) {
        // Wasserfall auf der Seite zur Anlage
        const dx = world.center.x - x;
        const dz = world.center.z - z;
        const dl = Math.hypot(dx, dz);
        const ux = dx / dl;
        const uz = dz / dl;
        const fx = x + ux * (r * 0.9 + 2);
        const fz = z + uz * (r * 0.9 + 2);
        const sx = -uz;
        const sz = ux;
        for (let q = 0; q < 3; q++) {
          const w0 = -9 + q * 6;
          const w1 = w0 + 6;
          const c = q === 1 ? C.wasserH : C.weiss;
          k0.flaeche([fx + sx * w0, SEA, fz + sz * w0], [fx + sx * w1, SEA, fz + sz * w1], [fx + sx * w1 - ux * 6, -12 + h, fz + sz * w1 - uz * 6], [fx + sx * w0 - ux * 6, -12 + h, fz + sz * w0 - uz * 6], c, [x, 0, z]);
        }
        k0.kugel(fx + ux * 3, SEA + 2, fz + uz * 3, 16, 5, 10, C.weiss, a);
      }
    }
  }

  // ==================================================================================
  // Haupttempel: Stufenpyramide in der Mitte, Statuenachse vom Portal her
  // ==================================================================================
  const iPortal = S(72);
  const pyX = X(iPortal, 0);
  const pyZ = world.center.z + 6;
  {
    const half = 30;
    const tiers = 6;
    const yB = bodenMin(pyX, pyZ, half + 4, half + 4) - 1;
    const yT0 = bodenMax(pyX, pyZ, half, half) + 2;
    const stufeH = 5.2;
    merke(pyX, pyZ, half * 1.42 + 4);
    const rot = Math.PI; // Treppe nach Süden (zum Portal)
    for (const e of [0, 1] as const) {
      const rr = seeded(501);
      const b = G[e].lage(pyX, 0, pyZ, rot);
      const k = K[e].lage(pyX, 0, pyZ, rot);
      let y0 = yB;
      for (let q = 0; q < tiers; q++) {
        const hs = half - q * 4.2;
        const y1 = yT0 + q * stufeH;
        b.klotz(0, y0, y1, 0, hs * 2, hs * 2, e ? (q % 2 ? C.alt : C.altM) : q % 2 ? C.stein : C.steinM, 0, e ? C.moos : C.steinH);
        if (e === 0) {
          // Fries an der Oberkante jeder Stufe
          k.box(0, y1 - 0.6, 0, hs * 2 + 0.12, 0.8, hs * 2 + 0.12, q % 2 ? C.zinnober : C.lapis);
        } else if (q > 0 && q < tiers - 1) {
          // Büsche und Farn auf den Absätzen
          for (let f = 0; f < 3; f++) {
            const a = rr() * TAU;
            const rad = hs + 1.8;
            const fx = Math.max(-rad, Math.min(rad, Math.cos(a) * rad * 1.4));
            const fz = Math.max(-rad, Math.min(rad, Math.sin(a) * rad * 1.4));
            if (Math.abs(fx) < 6 && fz > 0) continue;
            busch(k, fx, y0, fz, 1.2 + rr(), rr);
          }
        }
        y0 = y1;
      }
      // Treppe auf der Südseite (lokal +z): Rampe mit Stufenstreifen und Wangen
      const zFoot = half + 9;
      const zTop = half - (tiers - 1) * 4.2;
      const yTop = y0;
      const yFoot = boden(pyX, pyZ - zFoot) - 0.2;
      const n = 22;
      for (let q = 0; q < n; q++) {
        const u0 = q / n;
        const u1 = (q + 1) / n;
        const za = zFoot + (zTop - zFoot) * u0;
        const zb = zFoot + (zTop - zFoot) * u1;
        const ya = yFoot + (yTop - yFoot) * u0;
        const yb = yFoot + (yTop - yFoot) * u1;
        const missing = e === 1 && (q === 7 || q === 8 || q === 15);
        if (missing) continue;
        b.quad([-5, ya, za], [5, ya, za], [5, yb, zb], [-5, yb, zb], q % 2 ? (e ? C.altM : C.steinM) : e ? C.alt : C.steinH);
      }
      for (const sx of [-1, 1]) {
        b.stab([sx * 5.6, yFoot + 0.5, zFoot], [sx * 5.6, yTop + 0.5, zTop], 1.2, e ? C.altD : C.gold);
        b.flaeche([sx * 5, yFoot, zFoot], [sx * 5, yTop, zTop], [sx * 5, yB, zTop], [sx * 5, yB, zFoot], e ? C.altD : C.steinD, [0, yFoot, (zFoot + zTop) / 2]);
      }
      b.quad([-5, yFoot, zFoot], [-5, yB, zFoot], [5, yB, zFoot], [5, yFoot, zFoot], e ? C.altD : C.steinD);
      // Schrein obenauf
      const sy = yTop;
      if (e === 0) {
        b.klotz(0, sy, sy + 7, -1, 12, 11, C.weiss);
        k.box(0, sy + 6.2, -1, 12.1, 0.9, 11.1, C.zinnober);
        k.box(0, sy + 2.6, 4.53, 3, 5.2, 0.1, C.tusche);
        b.geo(new THREE.ConeGeometry(9.6, 6, 4, 1, true), C.dach, 0, sy + 10, -1, 0, Math.PI / 4);
        b.geo(new THREE.OctahedronGeometry(1.1, 0), C.gold, 0, sy + 13.6, -1);
        for (const [cx, cz] of [
          [-5.5, 4],
          [5.5, 4],
        ]) {
          const wx = pyX - cx;
          const wz = pyZ - cz;
          wimpel(wx, sy, wz, 9, cx < 0 ? C.zinnober : C.lapis, 5);
        }
        for (let q = 0; q < 6; q++) {
          const u = 0.25 + q * 0.12;
          const zz = zFoot + (zTop - zFoot) * u;
          const yy = yFoot + (yTop - yFoot) * u;
          mensch(pyX - (q % 2 ? 2.2 : -2.2), yy, pyZ - zz, 0, 0, rr, 0.06);
        }
        vogel(0, pyX, sy + 22, pyZ, 26, 0.22, 1.5, 0xf8f6ee, 0);
        vogel(0, pyX + 10, sy + 28, pyZ - 8, 34, -0.18, 1.5, 0xf8f6ee, 0);
        vogel(0, pyX - 6, sy + 18, pyZ + 6, 20, 0.27, 1.4, 0xf8f6ee, 0);
        vogel(0, pyX, sy + 25, pyZ + 12, 30, 0.2, 1.5, 0xf8f6ee, 0);
      } else {
        b.klotz(-4, sy, sy + 5.2, -1, 4, 11, C.alt);
        b.klotz(2, sy, sy + 2.6, -5.8, 8, 1.4, C.altM, 0, C.moos);
        b.klotz(4.8, sy, sy + 3.8, 2, 2.4, 3, C.altD, 0.2, C.moos);
        b.geo(new THREE.BoxGeometry(3, 1.6, 2), C.altM, 3, sy + 0.6, 7, 0.4, 0.7, 0.2);
        feige(b, -4, sy, sy + 5.2, -1, 2.4, rr, false);
        baum(b, 0.5, sy, -1, 0.7, rr);
        for (let q = 0; q < 3; q++) liane(1, pyX - (-6 + q * 5), sy + 8 + q, pyZ - (-5 + q * 2), 7 + q * 2, rr() * TAU, C.liane);
        affe(pyX - 3, sy + 5.2, pyZ + 1, Math.PI, 1, rr);
        affe(pyX + 6, yT0 + stufeH * 2, pyZ - (half - 8.4), 0, 1, rr);
        vogel(1, pyX, sy + 14, pyZ, 18, 0.35, 0.9, PAPAGEI[0], 0);
        vogel(1, pyX + 6, sy + 20, pyZ - 4, 24, -0.28, 0.9, PAPAGEI[1], 0);
        vogel(1, pyX - 4, sy + 11, pyZ + 8, 14, 0.4, 0.9, PAPAGEI[2], 0);
        vogel(1, pyX + 2, sy + 17, pyZ + 2, 21, -0.33, 0.9, PAPAGEI[3], 0);
        // Lichtstrahlen fallen auf die Treppe
        for (let q = 0; q < 3; q++) lichtstrahl(pyX + (q - 1) * 9, yFoot + 2 + q * 4, pyZ - zFoot + 8 + q * 6, 4 + q, 55);
      }
      b.frei();
      k.frei();
    }

    // Statuenachse vom Portal (Vorplatz) zur Treppe: gepflasterter Weg, Statuen beidseits
    const zA = Z(iPortal, 44);
    const zB = pyZ - half - 10;
    const len = zB - zA;
    const segs = Math.max(4, Math.round(Math.abs(len) / 6));
    for (const e of [0, 1] as const) {
      const rr = seeded(777);
      const k = K[e].frei();
      for (let q = 0; q < segs; q++) {
        const za = zA + (len * q) / segs;
        const zb = zA + (len * (q + 1)) / segs;
        if (e === 1 && rr() < 0.35) continue;
        const ya = boden(pyX, za) + 0.12;
        const yb = boden(pyX, zb) + 0.12;
        k.flaeche([pyX - 4, ya, za], [pyX + 4, ya, za], [pyX + 4, yb, zb], [pyX - 4, yb, zb], e ? C.altM : q % 2 ? C.stein : C.steinH, [pyX, ya - 10, za]);
      }
      const rs = seeded(778);
      for (let q = 1; q < 6; q++) {
        const zz = zA + (len * q) / 6;
        for (const sx of [-1, 1]) {
          const x = pyX + sx * 8;
          if (!ok(x, zz, 2)) continue;
          statue(e, x, zz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0.85, rs);
          if (e === 1 && q % 2 === 0) affe(x, boden(x, zz) + 1.6 * 0.85, zz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 1, rs);
        }
      }
    }
  }

  // ==================================================================================
  // Lichtstrahlen (Jetzt): schräg von der Sonne her, zwei gekreuzte Flächen, oben hell
  // ==================================================================================
  function lichtstrahl(x: number, y: number, z: number, w: number, len: number): void {
    const sd = th.sunDir;
    const sl = Math.hypot(sd[0], sd[1], sd[2]);
    const ux = sd[0] / sl;
    const uy = sd[1] / sl;
    const uz = sd[2] / sl;
    const top: V3 = [x + ux * len, y + uy * len, z + uz * len];
    const mid: V3 = [x + ux * len * 0.45, y + uy * len * 0.45, z + uz * len * 0.45];
    const hell: RGB = [0.3, 0.3, 0.3];
    const aus: RGB = [0, 0, 0];
    for (const [ax, az] of [
      [1, 0],
      [0, 1],
    ]) {
      const hx = ax * w * 0.5;
      const hz = az * w * 0.5;
      strahl.quadV([x - hx, y, z - hz], [x + hx, y, z + hz], [mid[0] + hx, mid[1], mid[2] + hz], [mid[0] - hx, mid[1], mid[2] - hz], aus, aus, hell, hell);
      strahl.quadV([mid[0] - hx, mid[1], mid[2] - hz], [mid[0] + hx, mid[1], mid[2] + hz], [top[0] + hx * 1.3, top[1], top[2] + hz * 1.3], [top[0] - hx * 1.3, top[1], top[2] - hz * 1.3], hell, hell, aus, aus);
    }
  }

  // ==================================================================================
  // Tempelvorplatz: Portal mit Freitreppe, Kolossalstatuen, Tribünen, Feuerschalen
  // ==================================================================================
  {
    const i = iPortal;
    const yR = t.py[i];
    const rot = HD(i) + Math.PI / 2; // lokal +z zeigt zur Straße
    const lat0 = 34;
    const cx = X(i, lat0);
    const cz = Z(i, lat0);
    const yP = yR + 4;
    const yB = Math.min(bodenMin(cx, cz, 20, 22, rot), yR) - 1.2;
    merke(cx, cz, 24);
    for (const e of [0, 1] as const) {
      const rr = seeded(301);
      const b = G[e].lage(cx, 0, cz, rot);
      const k = K[e].lage(cx, 0, cz, rot);
      const st = e ? C.alt : C.stein;
      const stM = e ? C.altM : C.steinM;
      const sink = e ? 0.6 : 0;
      // Plattform
      b.klotz(0, yB, yP - sink, -4, 36, 22, stM, 0, e ? C.altD : C.steinH);
      // Freitreppe: zehn Stufen hinab zur Straße
      for (let q = 0; q < 10; q++) {
        const z0 = 7 + q * 1.4;
        const top = yP - 0.4 * (q + 1) - sink * (1 - q / 10);
        if (e === 1 && (q === 3 || q === 6) ) {
          b.klotz(-4, yB, top - 0.5, z0 + 0.7, 14, 1.4, C.altD, 0, C.moos);
          b.klotz(7, yB, top, z0 + 0.7, 8, 1.4, st, 0, C.moos);
          continue;
        }
        b.klotz(0, yB, top, z0 + 0.7, 22, 1.4, q % 2 ? st : stM, 0, e ? (q % 3 === 0 ? C.moos : C.altM) : C.steinH);
      }
      // Pylone
      for (const sx of [-1, 1]) {
        const low = yP + 13;
        b.klotz(sx * 10.5, yP - sink, low, -5, 9, 9, st, 0, st);
        const broken = e === 1 && sx > 0;
        b.klotz(sx * 10.5, low, broken ? low + 2.2 : low + 7, -5, 7.6, 7.6, stM, 0, e ? C.moos : C.gold);
        if (e === 0) {
          k.box(sx * 10.5, low - 0.6, -5, 9.1, 1.2, 9.1, C.zinnober);
          k.box(sx * 10.5, low + 3.5, -5, 7.7, 1.0, 7.7, C.lapis);
          wimpel(cx + Math.cos(rot) * sx * 10.5 + Math.sin(rot) * -5, low + 7, cz - Math.sin(rot) * sx * 10.5 + Math.cos(rot) * -5, 6, sx > 0 ? C.zinnober : C.lapis, 5);
        } else if (broken) {
          for (let q = 0; q < 5; q++) b.geo(new THREE.BoxGeometry(2.2, 1.6, 2), C.altM, sx * (13 + rr() * 4), yP + 0.4, -10 + rr() * 6, rr(), rr() * 3, rr());
          feige(b, sx * 10.5, low - 6, low + 2.2, -5, 4.2, rr, true);
        } else {
          liane(1, cx + Math.cos(rot) * sx * 6.2 + Math.sin(rot) * -0.6, low + 6.5, cz - Math.sin(rot) * sx * 6.2 + Math.cos(rot) * -0.6, 8, rot, C.liane);
          liane(1, cx + Math.cos(rot) * sx * 8.5 + Math.sin(rot) * -0.6, low + 6.8, cz - Math.sin(rot) * sx * 8.5 + Math.cos(rot) * -0.6, 11, rot, C.liane);
        }
      }
      // Sturz zwischen den Pylonen
      if (e === 0) {
        b.klotz(0, yP + 13, yP + 17, -5, 12.2, 8, C.stein, 0, C.gold);
        k.geo(new THREE.CircleGeometry(1.6, 12), C.gold, 0, yP + 15, -0.95);
        k.box(0, yP + 13.3, -0.97, 12.2, 0.6, 0.05, C.lapis);
      } else {
        b.geo(new THREE.BoxGeometry(7, 3.4, 7), C.altM, -3.5, yP + 1.2, -6, 0.15, 0.2, 0.35);
        b.geo(new THREE.BoxGeometry(5, 3.4, 7), C.altD, 4, yP + 0.8, -4, -0.2, -0.3, -0.25);
      }
      // Kolossalstatuen, sitzend, beidseits der Treppe
      for (const sx of [-1, 1]) {
        const ox = sx * 16;
        const oz = 9;
        const ys = Math.min(yR, bodenMin(cx, cz, 4, 4)) + 0;
        b.klotz(ox, yB, ys + 2.2, oz, 7, 8, e ? C.altD : C.steinD, 0, e ? C.moos : C.stein);
        const y0 = ys + 2.2;
        // Thron
        b.klotz(ox, y0, y0 + 5, oz - 2.2, 5.6, 3.2, stM, 0, stM);
        // Unterschenkel, Oberschenkel, Leib
        b.klotz(ox - 1.2, y0, y0 + 3.4, oz + 2.4, 1.6, 1.6, st);
        b.klotz(ox + 1.2, y0, y0 + 3.4, oz + 2.4, 1.6, 1.6, st);
        b.klotz(ox, y0 + 3.4, y0 + 4.6, oz + 1.0, 4.2, 4.2, e ? C.alt : C.weiss);
        b.klotz(ox, y0 + 4.6, y0 + 9.4, oz - 0.6, 4.0, 2.4, st);
        b.box(ox - 2.4, y0 + 6.6, oz + 0.4, 1.0, 3.4, 1.2, st);
        b.box(ox + 2.4, y0 + 6.6, oz + 0.4, 1.0, 3.4, 1.2, st);
        b.box(ox - 2.3, y0 + 4.9, oz + 1.6, 1.0, 0.8, 2.4, st);
        b.box(ox + 2.3, y0 + 4.9, oz + 1.6, 1.0, 0.8, 2.4, st);
        const kopflos = e === 1 && sx < 0;
        if (e === 0) {
          k.box(ox, y0 + 8.6, oz + 0.62, 4.1, 1.4, 0.1, C.gold);
          b.klotz(ox, y0 + 9.4, y0 + 11.6, oz - 0.4, 2.2, 2.2, C.haut, 0, C.lapis);
          b.box(ox, y0 + 12.2, oz - 0.4, 2.8, 1.2, 2.4, C.lapis, 0, C.gold);
          for (let f = 0; f < 7; f++) {
            const a = (f - 3) * 0.26;
            b.geo(new THREE.BoxGeometry(0.5, 2.6, 0.16), [C.zinnober, C.gold, C.tuerkis, C.gold, C.tuerkis, C.gold, C.zinnober][f], ox + Math.sin(a) * 1.6, y0 + 13 + Math.cos(a) * 1.0, oz - 0.9, 0, 0, -a);
          }
          k.box(ox - 0.5, y0 + 10.8, oz + 0.72, 0.5, 0.22, 0.05, C.tusche);
          k.box(ox + 0.5, y0 + 10.8, oz + 0.72, 0.5, 0.22, 0.05, C.tusche);
          k.box(ox, y0 + 10.3, oz + 0.8, 0.3, 0.6, 0.2, C.haut);
          k.box(ox, y0 + 9.85, oz + 0.72, 0.8, 0.14, 0.05, C.zinnober);
          k.geo(new THREE.CircleGeometry(0.55, 8), C.gold, ox - 1.15, y0 + 10.4, oz - 0.4, 0, -Math.PI / 2);
          k.geo(new THREE.CircleGeometry(0.55, 8), C.gold, ox + 1.15, y0 + 10.4, oz - 0.4, 0, Math.PI / 2);
        } else if (kopflos) {
          k.kugel(ox, y0 + 9.5, oz - 0.6, 2.2, 0.5, 1.4, C.moos, rr());
          b.geo(new THREE.BoxGeometry(2.4, 2.4, 2.4), C.altM, ox - 5.5, ys + 1.0, oz + 4, 0.5, 0.4, 1.2);
          k.kugel(ox - 5.5, ys + 2.3, oz + 4, 1.2, 0.4, 1.2, C.moos, rr());
          feige(b, ox, y0, y0 + 9.4, oz - 0.6, 2.4, rr, true);
        } else {
          b.klotz(ox, y0 + 9.4, y0 + 11.6, oz - 0.4, 2.2, 2.2, C.altM, 0, C.moos);
          b.box(ox + 0.4, y0 + 12.0, oz - 0.4, 2.6, 0.8, 2.2, C.altD, 0.3, C.moos);
          k.box(ox - 0.5, y0 + 10.8, oz + 0.72, 0.5, 0.22, 0.05, C.altD);
          k.box(ox + 0.5, y0 + 10.8, oz + 0.72, 0.5, 0.22, 0.05, C.altD);
          liane(1, cx + Math.cos(rot) * (ox + 1) + Math.sin(rot) * (oz + 1), y0 + 12.4, cz - Math.sin(rot) * (ox + 1) + Math.cos(rot) * (oz + 1), 9, rot + 0.4, C.liane);
        }
      }
      b.frei();
      k.frei();
      // Priester auf der Treppe (Einst) bzw. Affen (Jetzt)
      const local = (lx: number, lz: number): [number, number] => [cx + Math.cos(rot) * lx + Math.sin(rot) * lz, cz - Math.sin(rot) * lx + Math.cos(rot) * lz];
      if (e === 0) {
        for (let q = 0; q < 4; q++) {
          const [mx, mz] = local(-6 + q * 4, 9 + (q % 2) * 2.8);
          mensch(mx, yP - 0.4 * (2 + (q % 2) * 2) , mz, rot, 0, rr, 0.05);
        }
        vogel(0, cx, yP + 12, cz, 9, 0.9, 0.55, 0x2a3a6a, 0);
        vogel(0, cx + 8, yP + 9, cz + 4, 7, -1.1, 0.55, 0x2a3a6a, 0);
        vogel(0, cx - 6, yP + 14, cz - 5, 11, 0.8, 0.55, 0x2a3a6a, 0);
      } else {
        const [mx, mz] = local(-16 + 1, 9 + 1);
        affe(mx, yR + 2.2 + 4.6, mz, rot, 1, rr);
        const [ax, az] = local(10.5, -5);
        affe(ax, yP + 13 + 2.2, az, rot + 0.5, 1, rr);
        for (let q = 0; q < 5; q++) {
          const [fx, fz] = local((rr() - 0.5) * 30, 2 + rr() * 6);
          farn(K[1], fx, yP - 0.6, fz, 1 + rr() * 0.5, rr);
        }
        lichtstrahl(cx, yP, cz, 5, 50);
        vogel(1, cx, yP + 2, cz + 6, 5, 0.6, 0.28, FALTER[0], 1);
        vogel(1, cx + 4, yP + 1.5, cz + 2, 4, -0.7, 0.28, FALTER[1], 1);
        vogel(1, cx - 5, yP + 2, cz + 4, 6, 0.5, 0.28, FALTER[2], 1);
      }
    }

    // Tribünen gegenüber (außen, links): vier Stufen, Zuschauer, Sonnensegel
    for (let m = 18; m < 134; m += 20) {
      const ii = S(m + 10);
      const rotT = HD(ii);
      for (const e of [0, 1] as const) {
        const rr = seeded(400 + m);
        for (let r = 0; r < 4; r++) {
          const lat = -(14 + 2.6 * r + 1.3);
          const x = X(ii, lat);
          const z = Z(ii, lat);
          const yb = bodenMin(x, z, 1.3, 10, rotT) - 0.8;
          let top = t.py[ii] + 0.9 * (r + 1);
          if (e === 1) top -= rr() * 0.9;
          G[e].frei().klotz(x, yb, top, z, 2.6, 19.6, e ? (r % 2 ? C.alt : C.altM) : r % 2 ? C.stein : C.steinM, rotT, e ? (rr() < 0.5 ? C.moos : C.altM) : C.steinH);
          if (e === 0 && r > 0) {
            for (let q = 0; q < Math.round(3 * dicht); q++) {
              const along = -8 + (16 * (q + 0.5 + (rr() - 0.5) * 0.6)) / Math.round(3 * dicht);
              mensch(x + t.tx[ii] * along, top, z + t.tz[ii] * along, HD(ii) - Math.PI / 2, 2, rr, 0.22);
            }
          }
          if (e === 1) {
            for (let q = 0; q < 2; q++) {
              const along = -8 + rr() * 16;
              if (rr() < 0.5) farn(K[1], x + t.tx[ii] * along, top, z + t.tz[ii] * along, 1 + rr() * 0.6, rr);
              else busch(K[1], x + t.tx[ii] * along, top, z + t.tz[ii] * along, 0.9 + rr() * 0.6, rr);
            }
          }
        }
        if (e === 0) {
          // Sonnensegel: Stangen hinten und vorn, gestreiftes Tuch
          const pb = -26;
          const pf = -15.6;
          const yb = t.py[ii] + 9;
          const yf = t.py[ii] + 6.2;
          for (const along of [-9.5, 9.5]) {
            const bx = X(ii, pb) + t.tx[ii] * along;
            const bz = Z(ii, pb) + t.tz[ii] * along;
            const fx = X(ii, pf) + t.tx[ii] * along;
            const fz = Z(ii, pf) + t.tz[ii] * along;
            G[0].frei().zyl([bx, boden(bx, bz) - 0.3, bz], [bx, yb, bz], 0.14, 0.12, 5, C.holz);
            G[0].zyl([fx, t.py[ii] + 3.6, fz], [fx, yf, fz], 0.12, 0.1, 5, C.holz);
          }
          for (let q = 0; q < 6; q++) {
            const a0 = -9.5 + (19 * q) / 6;
            const a1 = -9.5 + (19 * (q + 1)) / 6;
            const p = (lat: number, al: number, y: number): V3 => [X(ii, lat) + t.tx[ii] * al, y, Z(ii, lat) + t.tz[ii] * al];
            K[0].frei().quad(p(pb, a0, yb), p(pb, a1, yb), p(pf, a1, yf), p(pf, a0, yf), q % 2 ? C.weiss : C.zinnober);
          }
        }
      }
    }

    // Feuerschalen-Allee beidseits
    for (let m = 6; m < 172; m += 16) {
      const ii = S(m);
      for (const sgn of [-1, 1]) {
        if (sgn > 0 && m > 44 && m < 100) continue;
        const x = X(ii, sgn * 12.4);
        const z = Z(ii, sgn * 12.4);
        if (!ok(x, z, 0.6)) continue;
        for (const e of [0, 1] as const) feuerschale(e, x, z, seeded(m * 7 + sgn + 9));
      }
    }
    // Schmetterlinge und Schwalben über dem Platz
    for (let q = 0; q < 4; q++) {
      const ii = S(20 + q * 40);
      vogel(1, X(ii, -18), t.py[ii] + 1.5, Z(ii, -18), 5, 0.5 + q * 0.1, 0.26, FALTER[q % FALTER.length], 1);
      vogel(0, X(ii, 0), t.py[ii] + 16, Z(ii, 0), 14, 0.8, 0.55, 0x2a3a6a, 0);
    }
  }

  // ==================================================================================
  // Prozessionsstraße: liegende Wächter beidseits, Obelisken
  // ==================================================================================
  {
    let q = 0;
    for (let m = 184; m <= 318; m += 26, q++) {
      const ii = S(m);
      for (const sgn of [-1, 1]) {
        if (sgn > 0 && m > 288) continue; // Wegweiser vor der Gabelung a
        if (detail === 0 && (q + (sgn > 0 ? 1 : 0)) % 2 === 1) continue;
        const x = X(ii, sgn * 14.4);
        const z = Z(ii, sgn * 14.4);
        if (!ok(x, z, 1.4)) continue;
        merke(x, z, 3.5);
        for (const e of [0, 1] as const) waechter(e, x, z, HD(ii) + sgn * (Math.PI / 2), seeded(m * 3 + sgn));
        if ((q + (sgn > 0 ? 1 : 0)) % 3 === 0) affe(x, boden(x, z) + 1.3 + 2.1, z, HD(ii) + sgn * (Math.PI / 2), 1, seeded(m));
      }
      if (m + 13 > 318) continue;
      const io = S(m + 13);
      for (const sgn of [-1, 1]) {
        if (sgn > 0 && m + 13 > 288) continue;
        const x = X(io, sgn * 17.5);
        const z = Z(io, sgn * 17.5);
        if (!ok(x, z, 1.5) || !platz(x, z, 1.5)) continue;
        merke(x, z, 2);
        for (const e of [0, 1] as const) obelisk(e, x, z, 11, seeded(m * 5 + sgn));
        if (q % 2 === 0) wimpel(X(io, sgn * 12.8), t.py[io], Z(io, sgn * 12.8), 12.5, sgn > 0 ? C.zinnober : C.lapis);
      }
    }
    for (let k = 0; k < 4; k++) {
      const ii = S(190 + k * 35);
      vogel(1, X(ii, (k % 2 ? 1 : -1) * 16), t.py[ii] + 1.2, Z(ii, (k % 2 ? 1 : -1) * 16), 4, 0.6, 0.26, FALTER[(k + 2) % FALTER.length], 1);
    }
  }

  // ==================================================================================
  // Schatzkammer: gestufter Bau über dem Tunnel der Abzweigung 0, Portale an den Mündungen
  // ==================================================================================
  {
    const bk = t.branches[0];
    let tun0 = -1;
    let tun1 = -1;
    if (bk) for (let i = bk.first; i < bk.first + bk.count; i++) if (t.edge[i] & EDGE_TUNNEL) {
      if (tun0 < 0) tun0 = i;
      tun1 = i;
    }
    if (tun0 >= 0) {
      const cm = (tun0 + tun1) >> 1;
      const u0 = (tun0 - cm) * t.step;
      const u1 = (tun1 - cm) * t.step;
      const slope = (t.py[tun1] - t.py[tun0]) / Math.max(1, u1 - u0);
      const rot = HD(cm);
      const frame = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.atan(slope), rot, 0, 'YXZ')).setPosition(t.px[cm], t.py[cm], t.pz[cm]);
      // lokal: z längs der Abzweigung, x nach links (also −lat), y über der Fahrbahn
      const gIn = (lx: number, lz: number): number => {
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        return boden(t.px[cm] + lx * c + lz * s, t.pz[cm] - lx * s + lz * c) - t.py[cm] - lz * slope;
      };
      const welt = (lx: number, ly: number, lz: number): THREE.Vector3 => new THREE.Vector3(lx, ly, lz).applyMatrix4(frame);
      let gMin = 0;
      for (let lz = u0; lz <= u1; lz += 8) for (const lx of [-22, -17, -12]) gMin = Math.min(gMin, gIn(lx, lz));
      merke(t.px[cm] + rightX(t, cm) * 8, t.pz[cm] + rightZ(t, cm) * 8, 40);
      const za = u0 - 1;
      const zb = u1 + 1;
      const zc = (za + zb) / 2;
      const zl = zb - za;
      for (const e of [0, 1] as const) {
        const rr = seeded(601);
        const b = G[e];
        const k = K[e];
        b.m.copy(frame);
        k.m.copy(frame);
        const st = e ? C.alt : C.stein;
        const stM = e ? C.altM : C.steinM;
        const topC = e ? C.moos : C.steinH;
        // Sockel auf der Innenseite, darüber die Stufen
        b.klotz(-17, gMin - 1.5, 7.6, zc, 11, zl, stM, 0, topC);
        const tiers: [number, number, number, number][] = [
          [-22, 9, 7.6, 12.4],
          [-19, 6, 12.4, 16.8],
          [-16, 3, 16.8, 21.2],
          [-13, 0, 21.2, 25.4],
        ];
        tiers.forEach(([x0, x1, y0, y1], q) => {
          const inset = q * 3;
          b.klotz((x0 + x1) / 2, y0, y1, zc, x1 - x0, zl - inset * 2, q % 2 ? stM : st, 0, topC);
          if (e === 0) k.box((x0 + x1) / 2, y1 - 0.55, zc, x1 - x0 + 0.12, 0.7, zl - inset * 2 + 0.12, q % 2 ? C.lapis : C.zinnober);
          else if (q < 3) {
            for (let f = 0; f < 3; f++) busch(k, x0 + 1.5 + rr() * (x1 - x0 - 3), y1, zc + (rr() - 0.5) * (zl - inset * 2 - 4), 1 + rr() * 0.8, rr);
          }
        });
        // Schatzhaus obenauf
        if (e === 0) {
          b.klotz(-6.5, 25.4, 31, zc, 9, 16, C.weiss);
          k.box(-6.5, 30.3, zc, 9.1, 0.8, 16.1, C.zinnober);
          b.geo(new THREE.ConeGeometry(7.2, 4.5, 4, 1, true), C.gold, -6.5, 33.2, zc, 0, Math.PI / 4, 0, 1, 1, 1.6);
          k.box(-2.0, 28, zc, 0.1, 4.2, 3.2, C.tusche);
        } else {
          b.klotz(-9, 25.4, 29.5, zc, 3.6, 16, C.alt);
          b.klotz(-4.5, 25.4, 27.2, zc - 4, 3.2, 6, C.altM, 0, C.moos);
          baum(b, -5.5, 25.4, zc + 3, 0.6, rr);
          feige(b, -9, 25.4, 29.5, zc - 3, 2.2, rr, false);
        }
        // Treppe auf der Innenseite (lokal −x)
        const nSt = 16;
        const yF = gIn(-30, zc) - 0.2;
        for (let q = 0; q < nSt; q++) {
          const v0 = q / nSt;
          const v1 = (q + 1) / nSt;
          const xa = -30 + 17 * v0;
          const xb = -30 + 17 * v1;
          const ya = yF + (25.4 - yF) * v0;
          const yb = yF + (25.4 - yF) * v1;
          if (e === 1 && (q === 5 || q === 11)) continue;
          b.quad([xa, ya, zc + 4], [xb, yb, zc + 4], [xb, yb, zc - 4], [xa, ya, zc - 4], q % 2 ? stM : e ? C.alt : C.steinH);
        }
        for (const sz of [-1, 1]) {
          b.stab([-30, yF + 0.5, zc + sz * 4.5], [-13, 25.9, zc + sz * 4.5], 1.0, e ? C.altD : C.gold);
          b.flaeche([-30, yF, zc + sz * 4], [-13, 25.4, zc + sz * 4], [-13, gMin, zc + sz * 4], [-30, gMin, zc + sz * 4], e ? C.altD : C.steinD, [-20, yF, zc]);
        }
        // Portale an beiden Mündungen: zwei Pfeiler, 3 m neben der Fahrbahnkante, Sturz darüber
        for (const [zm, seg] of [
          [za - 0.6, tun0],
          [zb + 0.6, tun1],
        ] as [number, number][]) {
          const pw = t.wh[seg] + 3.2 + 0.9;
          for (const sx of [-1, 1]) {
            const broken = e === 1 && sx * (zm < 0 ? 1 : -1) > 0;
            const top = broken ? 4.5 : 9.4;
            b.klotz(sx * pw, -1.6, top, zm, 1.8, 1.8, e ? C.altM : C.lapis, 0, e ? C.moos : C.gold);
            if (e === 0) {
              k.box(sx * pw, 8.9, zm, 1.9, 0.5, 1.9, C.gold);
              k.box(sx * pw, 2.2, zm, 1.86, 0.4, 1.86, C.gold);
            } else if (broken) {
              b.geo(new THREE.BoxGeometry(1.8, 3, 1.8), C.altD, sx * (pw + 2.2), gIn(sx * (pw + 2.2), zm) + 0.7, zm - Math.sign(zm) * 1.5, 1.2, 0.4, 0.3);
            }
          }
          if (e === 0) {
            b.klotz(0, 9.4, 11.0, zm, pw * 2 + 1.8, 2.0, C.gold, 0, C.goldD);
            k.box(0, 10.2, zm + Math.sign(zm) * 1.02, pw * 2 + 1.4, 0.5, 0.05, C.zinnober);
            k.geo(new THREE.CircleGeometry(1.2, 10), C.gold, 0, 12.6, zm + Math.sign(zm) * 0.2, 0, zm > 0 ? 0 : Math.PI);
          } else {
            // Wurzeln hängen über der Mündung herab (oberhalb der Tunneldecke)
            for (let q = 0; q < 4; q++) {
              const lx = -pw + 1 + q * ((pw * 2 - 2) / 3);
              const w = welt(lx, 13.5, zm + Math.sign(zm) * 0.4);
              liane(1, w.x, w.y, w.z, 4.2 + rr() * 1.2, rot + Math.PI / 2, q % 2 ? C.wurzel : C.liane, 0.3);
            }
          }
        }
        b.frei();
        k.frei();
        if (e === 1) {
          const w = welt(-17, 7.6, zc + 6);
          affe(w.x, w.y, w.z, rot - Math.PI / 2, 1, rr);
          const w2 = welt(-30, 3, zc);
          lichtstrahl(w2.x, w2.y, w2.z, 4, 45);
        } else {
          const w = welt(-6.5, 31, zc);
          wimpel(w.x, w.y, w.z, 6, C.gold, 4);
          for (let q = 0; q < 2; q++) {
            const v = q ? 0.35 : 0.6;
            const p = welt(-30 + 17 * v, 0, zc + (q ? 2 : -2));
            mensch(p.x, t.py[cm] + yF + (25.4 - yF) * v, p.z, rot - Math.PI / 2, 0, rr, 0.05);
          }
        }
      }
    }
  }

  // ==================================================================================
  // Große Halle: Säulenreihen neben dem Steg, Einst Gebälk und Dach; der Graben darunter
  // ==================================================================================
  {
    const mA = 652;
    const mB = 900;
    const lm = t.landmark * t.step;
    const ms: number[] = [];
    for (let m = mA; m <= mB; m += 13) if (Math.abs(m - lm) >= HOF) ms.push(m);
    const LAT = 15.8;
    const R = 1.25;
    // Zustand je Säule (Jetzt): 0 ganz, 1 Stumpf, 2 umgestürzt
    const rz = seeded(707);
    const zust: number[][] = [[], []];
    for (let s = 0; s < 2; s++) for (let q = 0; q < ms.length; q++) {
      const v = rz();
      zust[s].push(v < 0.38 ? 0 : v < 0.8 ? 1 : 2);
    }
    let schaukler = 0;
    for (const e of [0, 1] as const) {
      const rr = seeded(708);
      const tops: number[][] = [[], []];
      ms.forEach((m, q) => {
        const i = S(m);
        const y = t.py[i];
        for (let s = 0; s < 2; s++) {
          const sgn = s ? 1 : -1;
          const x = X(i, sgn * LAT);
          const z = Z(i, sgn * LAT);
          let yb = boden(x, z) - 0.2;
          if (yb < SEA + 0.8) {
            // die Außenseite der Halle steht zum Teil im See: Säulen auf gemauerten Inselsockeln
            G[e].frei().klotz(x, yb - 1, SEA + 1.1, z, 4.4, 4.4, e ? C.altD : C.steinD, HD(i), e ? C.moos : C.steinM);
            yb = SEA + 1.1;
          }
          const outA = Math.atan2(rightZ(t, i) * sgn, rightX(t, i) * sgn);
          tops[s].push(saeule(e, x, yb, y + 12, z, R, e ? zust[s][q] : 0, rr, outA));
          if (e === 1 && zust[s][q] === 0 && rr() < 0.3) feige(G[1].frei(), x, yb, y + 12, z, R + 0.1, rr, rr() < 0.5);
          if (e === 1 && zust[s][q] !== 2 && rr() < 0.35) liane(1, x - rightX(t, i) * sgn * (R + 0.2), tops[s][q] - 0.2, z - rightZ(t, i) * sgn * (R + 0.2), Math.min(9, (tops[s][q] - yb) * 0.6), HD(i), C.liane);
          if (e === 1 && zust[s][q] === 1 && rr() < 0.3) affe(x, tops[s][q] + 0.4, z, HD(i) + sgn * Math.PI / 2, 1, rr);
        }
      });
      // Gebälk: zwischen benachbarten Säulen (nicht über den Hof)
      for (let q = 0; q + 1 < ms.length; q++) {
        if (ms[q + 1] - ms[q] > 14) continue;
        const i0 = S(ms[q]);
        const i1 = S(ms[q + 1]);
        const y0 = t.py[i0] + 12;
        const y1 = t.py[i1] + 12;
        for (let s = 0; s < 2; s++) {
          const sgn = s ? 1 : -1;
          const a: V3 = [X(i0, sgn * LAT), y0, Z(i0, sgn * LAT)];
          const c: V3 = [X(i1, sgn * LAT), y1, Z(i1, sgn * LAT)];
          const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
          const rotB = Math.atan2(c[0] - a[0], c[2] - a[2]);
          const mx = (a[0] + c[0]) / 2;
          const mz = (a[2] + c[2]) / 2;
          if (e === 0) {
            G[0].frei().box(mx, (y0 + y1) / 2 + 0.9, mz, 2.6, 1.8, len + 2.6, C.stein, rotB, C.steinM);
            if (detail > 0) K[0].frei().box(mx, (y0 + y1) / 2 + 0.6, mz, 2.7, 0.6, len + 2.7, q % 2 ? C.zinnober : C.lapis, rotB);
            if (q % 2 === 0) banner(mx + rightX(t, i0) * sgn * 1.45, y0 - 0.2, mz + rightZ(t, i0) * sgn * 1.45, 5.5, rotB - Math.PI / 2, s ? C.zinnober : C.tuerkis);
          } else if (zust[s][q] === 0 && zust[s][q + 1] === 0 && rr() < 0.75) {
            G[1].frei().box(mx, (y0 + y1) / 2 + 0.8, mz, 2.4, 1.6, len + 2.2, C.altM, rotB + 0.02, C.moos);
            // unter dem Gebälk schaukelt ein Affe an einer Liane
            if (schaukler < 2 && rr() < 0.5) {
              affe(mx, y0, mz, rotB, 2, rr);
              schaukler++;
            }
            for (let r = 0; r < 2; r++) {
              const al = (r - 0.5) * len * 0.5;
              liane(1, mx + Math.sin(rotB) * al, y0 + 0.1, mz + Math.cos(rotB) * al, 4 + rr() * 4, rotB, r ? C.wurzel : C.liane, 0.32);
            }
            if (rr() < 0.4) busch(K[1].frei(), mx, y0 + 1.6, mz, 1.1, rr);
          }
        }
        // Dach (Einst): Querbalken, Satteldach mit bemalter Untersicht
        if (e === 0) {
          const yE0 = t.py[i0] + 13.8;
          const yE1 = t.py[i1] + 13.8;
          const pE = (i: number, sgn: number, y: number): V3 => [X(i, sgn * 17.6), y, Z(i, sgn * 17.6)];
          const pR = (i: number, y: number): V3 => [t.px[i], y + 5.2, t.pz[i]];
          const g = G[0].frei();
          g.flaeche(pE(i0, -1, yE0), pE(i1, -1, yE1), pR(i1, yE1 + 0.4), pR(i0, yE0 + 0.4), C.dach, [t.px[i0], yE0 - 5, t.pz[i0]]);
          g.flaeche(pE(i0, -1, yE0), pE(i1, -1, yE1), pR(i1, yE1), pR(i0, yE0), C.lapis, [t.px[i0], yE0 + 20, t.pz[i0]]);
          // Firstseite gegen Innen schließen
          g.flaeche(pR(i0, yE0), pR(i1, yE1), pR(i1, yE1 + 0.4), pR(i0, yE0 + 0.4), C.gold, [t.px[i0] - rightX(t, i0) * 5, yE0 + 5, t.pz[i0] - rightZ(t, i0) * 5]);
          g.stab([X(i0, -LAT), t.py[i0] + 13.4, Z(i0, -LAT)], [X(i0, 0), t.py[i0] + 18.6, Z(i0, 0)], 0.7, C.goldD);
          K[0].frei().stab(pR(i0, yE0 + 0.5), pR(i1, yE1 + 0.5), 0.5, C.gold);
          // Sterne an der Untersicht
          if (detail > 0) for (const sgn of [-1]) {
            const p = [X(i0, sgn * 9), t.py[i0] + 13.8 + 5.2 * (1 - 9 / 17.6) - 0.05, Z(i0, sgn * 9)];
            K[0].geo(new THREE.CircleGeometry(0.7, 5), C.gold, p[0] + t.tx[i0] * 6, p[1], p[2] + t.tz[i0] * 6, Math.PI / 2, 0, 0);
          }
        }
      }
      // Giebel an den Enden jedes Dachabschnitts (Einst)
      if (e === 0) {
        for (let q = 0; q < ms.length; q++) {
          const prevGap = q === 0 || ms[q] - ms[q - 1] > 14;
          const nextGap = q === ms.length - 1 || ms[q + 1] - ms[q] > 14;
          if (!prevGap && !nextGap) continue;
          const i = S(ms[q]);
          const yE = t.py[i] + 13.8;
          const a: V3 = [X(i, -17.6), yE, Z(i, -17.6)];
          const c: V3 = [t.px[i], yE, t.pz[i]];
          const r: V3 = [t.px[i], yE + 5.6, t.pz[i]];
          const dir = nextGap && !prevGap ? 1 : -1;
          const ref: V3 = [t.px[i] - t.tx[i] * dir * 5, yE + 2, t.pz[i] - t.tz[i] * dir * 5];
          G[0].frei().dreieck(a, c, r, C.stein, ref);
          G[0].dreieck(a, r, c, C.steinM, [t.px[i] + t.tx[i] * dir * 5, yE + 2, t.pz[i] + t.tz[i] * dir * 5]);
          K[0].frei().geo(new THREE.CircleGeometry(1.3, 10), C.gold, X(i, -6) + t.tx[i] * dir * 0.08, yE + 1.6, Z(i, -6) + t.tz[i] * dir * 0.08, 0, HD(i) + (dir > 0 ? 0 : Math.PI), 0);
          G[0].geo(new THREE.OctahedronGeometry(0.9, 0), C.gold, t.px[i], yE + 6.3, t.pz[i]);
        }
      }
      // Wimpel an den Ecken des Hofs (Einst), Vögel und Falter im Hof
      if (e === 0) {
        const i = S(lm);
        vogel(0, t.px[i], t.py[i] + 26, t.pz[i], 30, 0.2, 1.5, 0xf8f6ee, 0);
        vogel(0, t.px[i] + 20, t.py[i] + 22, t.pz[i], 24, -0.25, 1.4, 0xf8f6ee, 0);
      } else {
        const i = S(lm);
        vogel(1, t.px[i], t.py[i] + 16, t.pz[i], 22, 0.3, 0.9, PAPAGEI[4], 0);
        vogel(1, t.px[i] - 30, t.py[i] + 12, t.pz[i], 16, -0.36, 0.9, PAPAGEI[1], 0);
        for (let q = 0; q < 4; q++) {
          const ii = S(670 + q * 60);
          const sg = q % 2 ? 1 : -1;
          vogel(1, X(ii, sg * 18), t.py[ii] - 1, Z(ii, sg * 18), 4, 0.5, 0.28, FALTER[q % FALTER.length], 1);
        }
        // Lichtstrahlen neben der Bahn
        for (let q = 0; q < 4; q++) {
          const ii = S(680 + q * 62);
          const sg = q % 2 ? 1 : -1;
          lichtstrahl(X(ii, sg * 19), t.py[ii] - 4, Z(ii, sg * 19), 4.5, 50);
        }
      }
    }
    // Der Graben (nur wo das Gelände wirklich einen Graben bildet – an der Außenseite liegt die
    // Halle zum Teil über dem See): Einst ein Becken mit Seerosen, Jetzt Schutt, Tümpel und Dunst.
    const rw = seeded(709);
    const grube = (i: number, sgn: number): boolean => Math.abs(boden(X(i, sgn * 12), Z(i, sgn * 12)) - (t.py[i] - PIT_D)) < 1.5;
    for (let m = mA; m < mB; m += 4) {
      const i = S(m);
      const j = S(m + 4);
      const yw = t.py[i] - PIT_D + 0.75;
      const ywj = t.py[j] - PIT_D + 0.75;
      for (const sgn of [-1, 1]) {
        if (!grube(i, sgn) || !grube(j, sgn)) continue;
        const lo = sgn > 0 ? 0 : -17;
        const hi2 = sgn > 0 ? 17 : 0;
        L[0].frei().quad([X(i, hi2), yw, Z(i, hi2)], [X(j, hi2), ywj, Z(j, hi2)], [X(j, lo), ywj, Z(j, lo)], [X(i, lo), yw, Z(i, lo)], C.wasser);
        if (m % 12 === 0) {
          const lat = sgn * (11 + rw() * 4);
          L[0].quad([X(i, lat + 0.1), yw + 0.02, Z(i, lat + 0.1)], [X(j, lat + 0.1), ywj + 0.02, Z(j, lat + 0.1)], [X(j, lat - 0.1), ywj + 0.02, Z(j, lat - 0.1)], [X(i, lat - 0.1), yw + 0.02, Z(i, lat - 0.1)], C.wasserH);
        }
        // Seerosen (Einst)
        if (rw() < 0.45 * dicht) {
          const lat = sgn * (10.6 + rw() * 4.5);
          K[0].frei().scheibe(X(i, lat), yw + 0.04, Z(i, lat), 0.7 + rw() * 0.7, 6, C.laubH);
          if (rw() < 0.4) K[0].geo(new THREE.ConeGeometry(0.3, 0.45, 5, 1, true), C.rosa, X(i, lat) + 0.2, yw + 0.25, Z(i, lat), Math.PI, 0, 0);
        }
        // Schutt (Jetzt): Plattenstücke und Trommeln am Grund
        if (rw() < 0.4) {
          const lat = sgn * (1 + rw() * 12);
          const x = X(i, lat);
          const z = Z(i, lat);
          const gy = boden(x, z);
          if (rw() < 0.6) K[1].frei().geo(new THREE.BoxGeometry(2.4 + rw() * 2, 0.6, 1.8 + rw() * 2), rw() < 0.5 ? C.alt : C.steinD, x, gy + 0.2, z, (rw() - 0.5) * 0.6, rw() * 3, (rw() - 0.5) * 0.6);
          else K[1].frei().zyl([x - 1, gy + 1, z], [x + 1, gy + 0.9, z + 0.4], 1.1, 1.1, 7, C.altM, false);
        }
        if (m % 16 === 0) {
          busch(K[1].frei(), X(i, sgn * (2 + rw() * 11)), t.py[i] - PIT_D, Z(i, sgn * (2 + rw() * 11)), 1 + rw(), rw);
          const lat = sgn * (3 + rw() * 8);
          L[1].frei().scheibe(X(i, lat), t.py[i] - PIT_D + 0.25, Z(i, lat), 2 + rw() * 1.5, 7, C.tuempel);
        }
        // Dunst in zwei Schichten
        if (m % 8 === 0) {
          const j2 = S(m + 8);
          if (!grube(j2, sgn)) continue;
          for (const hy of [2.4, 4.0]) {
            const c: RGB = hy < 3 ? [0.22, 0.22, 0.22] : [0.13, 0.13, 0.13];
            const yh = t.py[i] - PIT_D + hy;
            const yh2 = t.py[j2] - PIT_D + hy;
            strahl.quadV([X(i, sgn * 15), yh, Z(i, sgn * 15)], [X(j2, sgn * 15), yh2, Z(j2, sgn * 15)], [X(j2, 0), yh2, Z(j2, 0)], [X(i, 0), yh, Z(i, 0)], c, c, c, c);
          }
        }
      }
    }
  }

  // ==================================================================================
  // Abgang: Freitreppen beidseits, Wasserspeier
  // ==================================================================================
  {
    const m0 = 912;
    const m1 = 1018;
    const yTop = t.py[S(m0)] + 2;
    const yEnd = t.py[S(m1)] + 0.4;
    for (let m = m0; m < m1; m += 6) {
      const i = S(m + 3);
      const u = (m - m0) / (m1 - m0);
      const top = yTop + (yEnd - yTop) * u;
      for (const sgn of [-1, 1]) {
        if (sgn > 0 && m > 972 && m < 1004) continue; // Wegweiser vor der Gabelung b
        const lat = sgn * 19;
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!ok(x, z, 2) || !uhrFrei(x, z, 6)) continue;
        const yb = bodenMin(x, z, 6, 3.2, HD(i)) - 0.8;
        for (const e of [0, 1] as const) {
          const rr = seeded(m * 3 + sgn);
          const sinkt = e ? rr() * 0.7 : 0;
          G[e].frei().klotz(x, yb, top - sinkt, z, 11.6, 6.1, e ? ((m / 6) % 2 ? C.alt : C.altM) : (m / 6) % 2 ? C.stein : C.steinM, HD(i) + (e ? (rr() - 0.5) * 0.06 : 0), e ? (rr() < 0.5 ? C.moos : C.altM) : C.steinH);
          if (e === 0) K[0].frei().box(X(i, sgn * 13.15), top - 0.3, Z(i, sgn * 13.15), 0.12, 0.5, 6.1, (m / 6) % 2 ? C.zinnober : C.lapis, HD(i));
          if (e === 1 && rr() < 0.6) farn(K[1].frei(), X(i, sgn * (15 + rr() * 6)), top - sinkt, Z(i, sgn * (15 + rr() * 6)), 1 + rr() * 0.6, rr);
        }
      }
    }
    // Wasserspeier: Jaguarköpfe auf Pfeilern, Einst speien sie Wasser in Becken neben der Bahn
    for (const m of [930, 958, 1010]) {
      const i = S(m);
      for (const sgn of [-1, 1]) {
        if (sgn > 0 && m > 972 && m < 1004) continue;
        const lat = sgn * 15.4;
        const x = X(i, lat);
        const z = Z(i, lat);
        if (!ok(x, z, 0.8)) continue;
        const u = (m - m0) / (m1 - m0);
        const top = yTop + (yEnd - yTop) * u + 2.4;
        const rot = HD(i) + sgn * (Math.PI / 2);
        for (const e of [0, 1] as const) {
          const rr = seeded(m + sgn * 13);
          const b = G[e].lage(x, 0, z, rot);
          const k = K[e].lage(x, 0, z, rot);
          const st = e ? C.altM : C.stein;
          b.klotz(0, boden(x, z) - 0.5, top, 0, 1.8, 1.8, st, 0, st);
          b.box(0, top + 0.7, 0.4, 1.6, 1.4, 1.6, e ? C.alt : C.steinM, 0, e ? C.moos : undefined);
          b.box(0, top + 0.45, 1.5, 1.0, 0.7, 0.9, st);
          b.box(0.55, top + 1.55, 0.1, 0.4, 0.45, 0.3, st);
          b.box(-0.55, top + 1.55, 0.1, 0.4, 0.45, 0.3, st);
          k.box(0, top + 0.25, 1.96, 0.7, 0.25, 0.05, C.tusche);
          if (e === 0) {
            k.box(0.4, top + 1.0, 1.22, 0.32, 0.22, 0.05, C.gold);
            k.box(-0.4, top + 1.0, 1.22, 0.32, 0.22, 0.05, C.gold);
            // Wasserstrahl in einem Bogen hinab ins Becken
            const L0 = L[0].lage(x, 0, z, rot);
            const yb = t.py[i] + 0.2;
            let pz0 = 2;
            let py0 = top + 0.25;
            for (let q = 1; q <= 4; q++) {
              const f = q / 4;
              const pz1 = 2 + f * 0.9;
              const py1 = top + 0.25 - (top + 0.25 - yb) * f * f;
              L0.quad([-0.18, py0, pz0], [0.18, py0, pz0], [0.18, py1, pz1], [-0.18, py1, pz1], q % 2 ? C.wasserH : C.wasser);
              L0.quad([0.18, py0, pz0], [-0.18, py0, pz0], [-0.18, py1, pz1], [0.18, py1, pz1], C.wasser);
              pz0 = pz1;
              py0 = py1;
            }
            L0.frei();
            quellen.push(x + Math.sin(rot) * 2.9, yb + 0.2, z + Math.cos(rot) * 2.9, 0.6);
            b.klotz(0, boden(x, z) - 0.3, yb, 2.9, 1.8, 1.4, C.steinM, 0, C.steinM);
            L[0].lage(x, 0, z, rot).quad([-0.75, yb + 0.03, 3.5], [0.75, yb + 0.03, 3.5], [0.75, yb + 0.03, 2.3], [-0.75, yb + 0.03, 2.3], C.wasser);
            L[0].frei();
          } else {
            k.kugel(0, top + 1.45, 0.3, 0.9, 0.3, 0.9, C.moos, rr());
            if (rr() < 0.6) affe(x, top + 1.4, z, rot + Math.PI, 1, rr);
          }
          b.frei();
          k.frei();
        }
      }
    }
  }

  // ==================================================================================
  // Gartenhof (innen, neben dem Aquädukt): Terrasse mit Becken, Hecken, Laubengängen, Brunnen
  // ==================================================================================
  {
    let gx = 0;
    let gz = 0;
    // Mitte: Schwerpunkt der Hauptstrecke zwischen den Gabelungen, ein Stück nach innen
    const iMid = S(1132);
    gx = X(iMid, 70);
    gz = Z(iMid, 70);
    const rot = HD(iMid);
    const hx = 21;
    const hz = 52;
    // nach innen schieben, bis Aquädukt und Strecke weit genug weg sind
    for (let tries = 0; tries < 40; tries++) {
      let good = true;
      for (const [a, b2] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [0, 1],
        [0, -1],
        [-1, 0],
        [1, 0],
      ]) {
        const px = gx + a * hx * Math.cos(rot) + b2 * hz * Math.sin(rot);
        const pz = gz - a * hx * Math.sin(rot) + b2 * hz * Math.cos(rot);
        if (!ok(px, pz, 1)) good = false;
      }
      if (good) break;
      gx += rightX(t, iMid) * 3;
      gz += rightZ(t, iMid) * 3;
    }
    merke(gx, gz, 50);
    const yMin = bodenMin(gx, gz, hx + 2, hz + 2, rot) - 1;
    const yT = bodenMax(gx, gz, hx * 0.7, hz * 0.7, rot) + 0.8;
    for (const e of [0, 1] as const) {
      const rr = seeded(901);
      const b = G[e].lage(gx, 0, gz, rot);
      const k = K[e].lage(gx, 0, gz, rot);
      const l = L[e].lage(gx, 0, gz, rot);
      const st = e ? C.alt : C.stein;
      const stM = e ? C.altM : C.steinM;
      // Terrasse
      b.klotz(0, yMin, yT, 0, hx * 2, hz * 2, stM, 0, e ? C.laubD : C.rasen);
      if (e === 0) {
        k.box(0, yT - 0.4, 0, hx * 2 + 0.1, 0.5, hz * 2 + 0.1, C.zinnober);
        for (const sz of [-1, 1]) k.box(0, yT + 0.06, sz * 30, 6, 0.1, 30, C.steinH);
      }
      // Langes Becken in der Mitte
      const bw = 5;
      const bl = 26;
      for (const [cx, cz, sx, sz] of [
        [bw + 0.4, 0, 0.8, bl * 2 + 1.6],
        [-bw - 0.4, 0, 0.8, bl * 2 + 1.6],
        [0, bl + 0.4, bw * 2, 0.8],
        [0, -bl - 0.4, bw * 2, 0.8],
      ] as [number, number, number, number][]) {
        if (e === 1 && rr() < 0.35) {
          b.geo(new THREE.BoxGeometry(sx * 0.6 + 0.8, 0.7, sz * 0.4 + 0.8), C.altD, cx + (rr() - 0.5) * 2, yT + 0.3, cz + (rr() - 0.5) * 8, rr() * 0.4, rr(), rr() * 0.4);
          continue;
        }
        b.klotz(cx, yT - 0.2, yT + 0.6, cz, sx, sz, st, 0, e ? C.moos : C.steinH);
      }
      l.quad([-bw, yT + 0.25, -bl], [-bw, yT + 0.25, bl], [bw, yT + 0.25, bl], [bw, yT + 0.25, -bl], e ? C.tuempel : C.wasser);
      if (e === 0) {
        for (let q = 0; q < 5; q++) l.quad([-0.08 - 2 + q, yT + 0.27, -bl + 2], [-0.08 - 2 + q, yT + 0.27, bl - 2], [0.08 - 2 + q, yT + 0.27, bl - 2], [0.08 - 2 + q, yT + 0.27, -bl + 2], C.wasserH);
      } else {
        for (let q = 0; q < Math.round(16 * dicht); q++) k.scheibe((rr() - 0.5) * (bw * 2 - 1.4), yT + 0.3, (rr() - 0.5) * (bl * 2 - 2), 0.6 + rr() * 0.6, 6, rr() < 0.5 ? C.laubH : C.laub);
        for (let q = 0; q < 5; q++) k.geo(new THREE.ConeGeometry(0.28, 0.4, 5, 1, true), C.rosa, (rr() - 0.5) * (bw * 2 - 2), yT + 0.5, (rr() - 0.5) * (bl * 2 - 3), Math.PI, 0, 0);
      }
      // Hecken (Einst) bzw. wuchernde Büsche (Jetzt)
      for (const sx of [-1, 1]) {
        for (let q = 0; q < 6; q++) {
          const cz = -40 + q * 16;
          if (e === 0) b.klotz(sx * 9.5, yT, yT + 1.6, cz, 1.6, 12, C.hecke, 0, C.laub);
          else busch(k, sx * (9.5 + (rr() - 0.5) * 3), yT, cz + (rr() - 0.5) * 6, 1.6 + rr() * 1.2, rr);
        }
      }
      // Laubengänge: Pfosten, Pfetten, Laub obenauf
      for (const sx of [-1, 1]) {
        const lx = sx * 16;
        for (let q = 0; q < 9; q++) {
          const cz = -40 + q * 10;
          for (const ox of [-2.2, 2.2]) {
            if (e === 0) b.klotz(lx + ox, yT, yT + 4.2, cz, 0.45, 0.45, C.weiss);
            else {
              const tilt = (rr() - 0.5) * 0.7;
              if (rr() < 0.25) continue;
              b.geo(new THREE.BoxGeometry(0.45, 4.2, 0.45), C.holz, lx + ox + Math.sin(tilt) * 2, yT + 2 * Math.cos(tilt), cz, tilt * 0.5, 0, tilt);
            }
          }
          if (e === 0) b.box(lx, yT + 4.35, cz, 5.2, 0.3, 0.4, C.lapis);
        }
        if (e === 0) {
          for (const ox of [-2.2, 2.2]) b.box(lx + ox, yT + 4.5, 0, 0.4, 0.3, 82, C.weiss);
          for (let q = 0; q < 8; q++) k.kugel(lx, yT + 4.9, -36 + q * 10.3, 2.8, 0.7, 4.4, q % 2 ? C.laub : C.laubH, rr());
          for (let q = 0; q < 4; q++) k.geo(new THREE.ConeGeometry(0.35, 0.5, 5, 1, true), q % 2 ? C.rosa : C.weiss, lx + (rr() - 0.5) * 3, yT + 5.2, -30 + q * 20, 0, 0, 0);
        } else {
          for (let q = 0; q < 4; q++) {
            const cz = -38 + q * 22 + rr() * 6;
            b.geo(new THREE.BoxGeometry(0.4, 0.3, 9), C.holz, lx + (rr() - 0.5) * 3, yT + 0.4, cz, rr() * 0.2, rr() * 0.6, 0.1);
            k.kugel(lx + (rr() - 0.5) * 2, yT + 1.2, cz + 3, 2.2, 1.3, 3.2, C.laubD, rr());
          }
          for (let q = 0; q < 3; q++) {
            const w = [gx + Math.cos(rot) * lx + Math.sin(rot) * (-30 + q * 25), gz - Math.sin(rot) * lx + Math.cos(rot) * (-30 + q * 25)];
            liane(1, w[0], yT + 4.6, w[1], 3.8, rot, C.liane);
          }
        }
      }
      // Brunnen am Nordende (lokal +z)
      const fz = hz - 9;
      if (e === 0) {
        b.geo(new THREE.CylinderGeometry(5, 5.2, 0.9, 10, 1, true), C.stein, 0, yT + 0.45, fz);
        l.scheibe(0, yT + 0.75, fz, 4.9, 10, C.wasser);
        b.zyl([0, yT, fz], [0, yT + 3.2, fz], 0.6, 0.5, 6, C.steinM);
        b.geo(new THREE.CylinderGeometry(1.8, 0.6, 0.6, 8, 1, true), C.gold, 0, yT + 3.4, fz);
        l.zyl([0, yT + 3.4, fz], [0, yT + 5.4, fz], 0.25, 0.12, 5, C.wasserH);
        const w = [gx + Math.sin(rot) * fz, gz + Math.cos(rot) * fz];
        quellen.push(w[0], yT + 5.4, w[1], 1);
        for (let q = 0; q < 4; q++) {
          const a = (q / 4) * TAU + 0.4;
          mensch(gx + Math.sin(rot) * (fz - 9) + Math.cos(a) * 3, yT, gz + Math.cos(rot) * (fz - 9) + Math.sin(a) * 3, rot + Math.PI + a * 0.3, q % 2 ? 1 : 2, rr, 0.04);
        }
      } else {
        b.geo(new THREE.CylinderGeometry(5, 5.2, 0.7, 10, 1, true), C.alt, 0, yT + 0.35, fz);
        l.scheibe(0, yT + 0.45, fz, 4.9, 10, C.tuempel);
        b.zyl([0, yT, fz], [0.3, yT + 1.6, fz + 0.2], 0.6, 0.5, 6, C.altM, false);
        b.geo(new THREE.CylinderGeometry(1.8, 0.6, 0.6, 8, 1, true), C.goldD, 2.5, yT + 0.4, fz + 2, 1.2, 0.5, 0);
        for (let q = 0; q < 6; q++) k.scheibe((rr() - 0.5) * 7, yT + 0.5, fz + (rr() - 0.5) * 7, 0.6 + rr() * 0.5, 6, C.laubH);
      }
      // Palmen in Kübeln (Einst) an den Ecken
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const px = sx * (hx - 3);
        const pz = sz * (hz - 4);
        if (e === 0) {
          b.geo(new THREE.CylinderGeometry(1.2, 0.9, 1.2, 7, 1, true), C.zinnober, px, yT + 0.6, pz);
          palme(k, px, yT + 1, pz, 0.7, rr);
        } else {
          palme(k, px + 1, yT, pz, 1.0, rr);
          b.geo(new THREE.CylinderGeometry(1.2, 0.9, 1.2, 7, 1, true), C.dachD, px - 1.2, yT + 0.6, pz, 1.4, rr(), 0);
        }
      }
      if (e === 1) {
        // Ein umgestürzter Baum quer über den Hof
        const a: V3 = [-hx + 2, yT + 1.4, -6];
        const c: V3 = [hx - 4, yT + 0.9, 18];
        b.zyl(a, c, 1.3, 0.9, 7, C.stamm, false);
        b.geo(new THREE.CylinderGeometry(4.2, 4.2, 1.2, 8, 1, false), C.wurzel, a[0] - 0.4, a[1] + 1.4, a[2] - 0.6, 0, 0.84, Math.PI / 2);
        for (let q = 0; q < 4; q++) b.stab(c, [c[0] + (rr() - 0.3) * 6, yT + 2 + rr() * 3, c[2] + (rr() - 0.5) * 7], 0.3, C.stammD);
        k.kugel(c[0] + 2, yT + 2.5, c[2] + 1, 3.4, 1.8, 3.6, C.laubD, rr());
        // Jungle auf der Terrasse
        for (let q = 0; q < Math.round(4 * dicht) + 1; q++) {
          const tx = (rr() < 0.5 ? -1 : 1) * (12 + rr() * 6);
          const tz = (rr() - 0.5) * 80;
          baum(b, tx, yT, tz, 0.7 + rr() * 0.25, rr);
        }
        for (let q = 0; q < Math.round(30 * dicht); q++) farn(k, (rr() - 0.5) * hx * 1.8, yT, (rr() - 0.5) * hz * 1.8, 1 + rr() * 0.7, rr);
        // Affen, Papageien, Falter, Licht
        b.frei();
        k.frei();
        l.frei();
        const W = (lx: number, lz: number): [number, number] => [gx + Math.cos(rot) * lx + Math.sin(rot) * lz, gz - Math.sin(rot) * lx + Math.cos(rot) * lz];
        const [ax, az] = W(c[0] - 3, c[2] - 2.6);
        affe(ax, yT + 1.8, az, rot + 1, 1, rr);
        const [bx, bz] = W(-16, 10);
        affe(bx, yT + 0.2, bz, rot - 1, 1, rr);
        const [vx, vz] = W(0, 0);
        vogel(1, vx, yT + 14, vz, 20, 0.33, 0.9, PAPAGEI[0], 0);
        vogel(1, vx, yT + 18, vz + 10, 26, -0.27, 0.9, PAPAGEI[2], 0);
        vogel(1, vx + 6, yT + 12, vz - 12, 16, 0.4, 0.9, PAPAGEI[5], 0);
        for (let q = 0; q < Math.round(8 * dicht) + 2; q++) {
          const [fx2, fz2] = W((rr() - 0.5) * 30, (rr() - 0.5) * 80);
          vogel(1, fx2, yT + 1.2 + rr(), fz2, 3 + rr() * 3, 0.4 + rr() * 0.4, 0.28, FALTER[q % FALTER.length], 1);
        }
        for (let q = 0; q < 3; q++) {
          const [lx2, lz2] = W((q - 1) * 10, -30 + q * 26);
          lichtstrahl(lx2, yT, lz2, 4 + q, 48);
        }
      } else {
        b.frei();
        k.frei();
        l.frei();
        const W = (lx: number, lz: number): [number, number] => [gx + Math.cos(rot) * lx + Math.sin(rot) * lz, gz - Math.sin(rot) * lx + Math.cos(rot) * lz];
        const [vx, vz] = W(0, 0);
        vogel(0, vx, yT + 20, vz, 24, 0.25, 1.4, 0xf8f6ee, 0);
        vogel(0, vx + 5, yT + 16, vz - 20, 18, -0.3, 1.4, 0xf8f6ee, 0);
        for (let q = 0; q < 3; q++) {
          const [mx, mz] = W(-16 + (q % 2) * 32, -20 + q * 18);
          mensch(mx, yT, mz, rot + q, 1, rr, 0.03);
        }
        for (const sx of [-1, 1]) {
          const [wx, wz] = W(sx * (hx - 1.5), 0);
          wimpel(wx, yT, wz, 8, sx > 0 ? C.lapis : C.zinnober, 4);
        }
      }
      b.frei();
      k.frei();
      l.frei();
    }
  }

  // ==================================================================================
  // Rückweg: Stelen innen, Marktstände außen
  // ==================================================================================
  {
    for (let m = 1262; m < 1440; m += 28) {
      const i = S(m);
      const x = X(i, 14.5);
      const z = Z(i, 14.5);
      if (!ok(x, z, 1.2) || !platz(x, z, 1.5)) continue;
      merke(x, z, 2);
      const rot = HD(i) + Math.PI / 2;
      const y = bodenMin(x, z, 1.2, 0.6, rot);
      for (const e of [0, 1] as const) {
        const rr = seeded(m);
        const tilt = e ? (rr() - 0.5) * 0.4 : 0;
        const fallen = e === 1 && rr() < 0.3;
        if (fallen) {
          G[1].frei().geo(new THREE.BoxGeometry(2.2, 5, 0.9), C.alt, x + Math.sin(rot) * -2.4, y + 0.4, z + Math.cos(rot) * -2.4, Math.PI / 2 - 0.1, rot, 0.05);
          K[1].frei().kugel(x, y + 0.3, z, 1.3, 0.4, 1.0, C.moos, rr());
          continue;
        }
        G[e].frei().geo(new THREE.BoxGeometry(2.2, 5.4, 0.9), e ? C.alt : C.weiss, x, y + 2.2, z, tilt, rot, tilt * 0.5);
        if (e === 0) {
          const kk = K[0].lage(x, 0, z, rot);
          for (let q = 0; q < 4; q++) kk.box((q % 2 ? 0.45 : -0.45), y + 1.4 + Math.floor(q / 2) * 1.3, 0.47, 0.7, 0.8, 0.05, rgb(BUNT[(q + m) % 4]));
          kk.box(0, y + 4.4, 0.47, 1.8, 0.4, 0.05, C.gold);
          kk.frei();
        } else {
          K[1].frei().kugel(x, y + 4.9, z, 1.0, 0.35, 0.6, C.moos, rr());
          farn(K[1], x + 1, y, z + 0.6, 1, rr);
        }
      }
    }
    for (let m = 1290; m < 1420; m += 34) {
      const i = S(m);
      const x = X(i, -17);
      const z = Z(i, -17);
      if (!ok(x, z, 3.5) || !platz(x, z, 4)) continue;
      merke(x, z, 4.5);
      const rot = HD(i) - Math.PI / 2;
      const y = bodenMin(x, z, 3, 2.4, rot);
      for (const e of [0, 1] as const) {
        const rr = seeded(m * 11);
        const b = G[e].lage(x, 0, z, rot);
        const k = K[e].lage(x, 0, z, rot);
        for (const [px, pz] of [
          [-2.8, -2],
          [2.8, -2],
          [-2.8, 2],
          [2.8, 2],
        ]) {
          if (e === 1 && rr() < 0.5) continue;
          const tilt = e ? (rr() - 0.5) * 0.5 : 0;
          b.geo(new THREE.BoxGeometry(0.3, 3.4, 0.3), C.holz, px, y + 1.6, pz, tilt, 0, tilt * 0.4);
        }
        if (e === 0) {
          for (let q = 0; q < 6; q++) k.quad([-3.2 + q * 1.07, y + 3.6, -2.4], [-3.2 + (q + 1) * 1.07, y + 3.6, -2.4], [-3.2 + (q + 1) * 1.07, y + 3.1, 2.6], [-3.2 + q * 1.07, y + 3.1, 2.6], q % 2 ? C.weiss : rgb(BUNT[m % 4]));
          b.klotz(0, y - 0.3, y + 1.0, 1.4, 5, 1.0, C.holz, 0, C.stammD);
          for (let q = 0; q < 6; q++) k.kugel(-2 + q * 0.8, y + 1.2, 1.4, 0.32, 0.3, 0.32, rgb([0xf2a02a, 0xe23a2a, 0x7ac040, 0xf2d23a][q % 4]), q);
          mensch(x + Math.sin(rot) * -0.4, y, z + Math.cos(rot) * -0.4, rot, 1, rr, 0.03);
        } else {
          busch(k, 0, y, 0, 1.6, rr);
          farn(k, 2, y, 1, 1.1, rr);
        }
        b.frei();
        k.frei();
      }
    }
  }

  // ==================================================================================
  // Nebentempel in der Anlage
  // ==================================================================================
  {
    const cand: [number, number][] = [
      [150, -112],
      [138, 62],
      [-128, 36],
      [-112, -168],
      [92, -22],
      [-92, 70],
    ];
    let n = 0;
    for (const [x0, z0] of cand) {
      const s = 0.9;
      const x = x0;
      const z = z0;
      if (n >= (detail === 0 ? 3 : 4) || !ok(x, z, 16) || !platz(x, z, 15)) continue;
      merke(x, z, 16);
      const rot = Math.atan2(pyX - x, pyZ - z);
      for (const e of [0, 1] as const) tempelhaus(e, x, z, rot, s, 1200 + n * 17);
      n++;
    }
  }

  // ==================================================================================
  // Anlage innen: Einst gepflegte Palmen und Rasen, Jetzt Dschungel
  // ==================================================================================
  {
    const wantJ = Math.round(18 * dicht);
    const wantE = Math.round(16 * dicht);
    let nJ = 0;
    let nE = 0;
    const rj = seeded(1301);
    for (let tries = 0; tries < 3000 && (nJ < wantJ || nE < wantE); tries++) {
      const x = world.center.x + (rj() - 0.5) * world.radius * 1.9;
      const z = world.center.z + (rj() - 0.5) * world.radius * 1.5;
      if (!innen(x, z) || !ok(x, z, 3) || !platz(x, z, 4)) continue;
      const y = boden(x, z);
      if (y < SEA + 1) continue;
      if (nJ < wantJ) {
        merke(x, z, 4);
        const s = 0.75 + rj() * 0.4;
        baum(G[1].frei(), x, y, z, s, rj);
        if (rj() < 0.5) liane(1, x + 2.5 * s, y + 13 * s, z, 7 + rj() * 4, rj() * TAU, C.liane);
        nJ++;
      }
      if (nE < wantE && rj() < 0.7) {
        const ex = x + (rj() - 0.5) * 6;
        const ez = z + (rj() - 0.5) * 6;
        if (ok(ex, ez, 1)) {
          palme(K[0].frei(), ex, boden(ex, ez), ez, 0.9 + rj() * 0.3, rj);
          nE++;
        }
      }
    }
    // Unterholz Jetzt, Ziersträucher Einst
    const wantU = Math.round(125 * dicht);
    let nU = 0;
    for (let tries = 0; tries < 4000 && nU < wantU; tries++) {
      const x = world.center.x + (rj() - 0.5) * world.radius * 1.9;
      const z = world.center.z + (rj() - 0.5) * world.radius * 1.5;
      if (!innen(x, z) || !ok(x, z, 0.5) || !platz(x, z, 0.5)) continue;
      const y = boden(x, z);
      if (rj() < 0.35) busch(K[1].frei(), x, y, z, 1 + rj() * 0.9, rj);
      else farn(K[1].frei(), x, y, z, 1 + rj() * 0.8, rj, rj() < 0.5 ? C.laubH : C.laubD);
      if (nU % 5 === 0) {
        K[0].frei().kugel(x, y + 0.7, z, 1.0, 0.9, 1.0, C.hecke, rj());
        if (rj() < 0.5) K[0].geo(new THREE.ConeGeometry(0.3, 0.45, 5, 1, true), BUNT[nU % 3] === 0xf2c23a ? C.gold : C.rosa, x + 0.3, y + 1.6, z, 0, 0, 0);
      }
      nU++;
    }
  }

  // ==================================================================================
  // Netze zusammenstellen
  // ==================================================================================
  const toonF = toonMaterial({ vertexColors: true });
  const toonD = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const basic = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(toonF, toonD, basic);
  const einst = new THREE.Group();
  const jetzt = new THREE.Group();
  einst.name = 'Einst';
  jetzt.name = 'Jetzt';
  group.add(einst, jetzt);
  /** Dreiecke (Konturen eingerechnet) je Teil – zur Kontrolle der Grenzen. */
  const info = { gemeinsam: 0, einst: 0, jetzt: 0 };
  group.userData.dreiecke = info;

  const netz = (parent: THREE.Object3D, bs: Bau[], mat: THREE.Material, outline: number): THREE.Mesh | null => {
    if (bs.every((b) => b.verts === 0)) return null;
    const geo = bs.length === 1 ? bs[0].build() : vereint(bs);
    const mesh = new THREE.Mesh(geo, mat);
    parent.add(mesh);
    disposables.push(geo);
    const tris = geo.getAttribute('position').count / 3;
    let cnt = tris;
    if (outline > 0 && lines) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
      cnt += tris;
    }
    if (parent === group) info.gemeinsam += cnt;
    else if (parent === einst) info.einst += cnt;
    else info.jetzt += cnt;
    return mesh;
  };
  // Gemeinsames
  if (lines) {
    netz(group, [g0], toonF, 0.05);
    netz(group, [k0], toonD, 0);
  } else netz(group, [g0, k0], toonD, 0);
  // Je Zeitalter
  const gross: (THREE.Mesh | null)[] = [null, null];
  for (const e of [0, 1] as const) {
    const parent = e ? jetzt : einst;
    if (lines) {
      gross[e] = netz(parent, [G[e]], toonF, 0.05);
      netz(parent, [K[e]], toonD, 0);
    } else gross[e] = netz(parent, [G[e], K[e]], toonD, 0);
    netz(parent, [L[e]], basic, 0);
  }
  // Lichtstrahlen und Dunst (Jetzt): halb durchsichtig, die Helligkeit der Eckenfarbe wird zur Deckkraft
  // (Eckenfarben mit Alpha – eingebaut in MeshBasicMaterial). Im Dunst verschwinden sie wie alles andere.
  const strahlMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  disposables.push(strahlMat);
  if (strahl.verts > 0) {
    const sm = netz(jetzt, [strahl], strahlMat, 0);
    if (sm) {
      sm.renderOrder = 4;
      const ca = sm.geometry.getAttribute('color');
      const rgba = new Float32Array(ca.count * 4);
      for (let i = 0; i < ca.count; i++) {
        rgba[i * 4] = 1;
        rgba[i * 4 + 1] = 0.97;
        rgba[i * 4 + 2] = 0.84;
        rgba[i * 4 + 3] = ca.getX(i);
      }
      sm.geometry.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
    }
  }

  // Schemen der kommenden Fassung (golden: Einst, türkis: Jetzt) – dieselbe Geometrie, additiv
  const geistMat = [
    new THREE.MeshBasicMaterial({ color: 0xc8962a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x2fb8a6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  disposables.push(...geistMat);
  const geist: (THREE.Mesh | null)[] = [null, null];
  for (const e of [0, 1] as const) {
    const gm = gross[e];
    if (!gm) continue;
    const m = new THREE.Mesh(gm.geometry, geistMat[e]);
    m.visible = false;
    m.renderOrder = 5;
    group.add(m);
    geist[e] = m;
  }

  // Bewegtes je Zeitalter: ein Netz, Ecken je Bild aus der Grundform
  interface Dyn {
    mesh: THREE.Mesh;
    pos: Float32Array;
    nor: Float32Array;
    basePos: Float32Array;
    baseNor: Float32Array;
    baseON: Float32Array | null;
    on: Float32Array | null;
    posAttr: THREE.BufferAttribute;
    norAttr: THREE.BufferAttribute;
    onAttr: THREE.BufferAttribute | null;
    teile: Teil[];
    first: boolean;
  }
  const dyn: (Dyn | null)[] = [null, null];
  for (const e of [0, 1] as const) {
    const d = D[e];
    if (d.verts === 0) continue;
    // Starre Teile nach vorn, Tücher ans Ende: die Kontur zeichnet nur den vorderen Bereich
    // (sonst läge sie als Tusche deckungsgleich auf den Tüchern).
    const fest = ordnen(d);
    const geo = d.build();
    const pa = geo.getAttribute('position') as THREE.BufferAttribute;
    const na = geo.getAttribute('normal') as THREE.BufferAttribute;
    pa.setUsage(THREE.DynamicDrawUsage);
    na.setUsage(THREE.DynamicDrawUsage);
    const basePos = Float32Array.from(pa.array as Float32Array);
    const baseNor = Float32Array.from(na.array as Float32Array);
    const mesh = new THREE.Mesh(geo, toonD);
    mesh.frustumCulled = false;
    (e ? jetzt : einst).add(mesh);
    disposables.push(geo);
    let baseON: Float32Array | null = null;
    let onAttr: THREE.BufferAttribute | null = null;
    const tris = pa.count / 3;
    if (lines) {
      baseON = glatteNormalen(basePos, baseNor, d.liste);
      onAttr = new THREE.BufferAttribute(Float32Array.from(baseON), 3);
      onAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('onormal', onAttr);
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', pa);
      og.setAttribute('normal', na);
      og.setAttribute('onormal', onAttr);
      og.setDrawRange(0, fest);
      disposables.push(og);
      const ol = new THREE.Mesh(og, outlineMaterial(0.04));
      ol.name = 'outline';
      ol.frustumCulled = false;
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
    }
    const zahl = tris + (lines ? fest / 3 : 0);
    if (e) info.jetzt += zahl;
    else info.einst += zahl;
    dyn[e] = {
      mesh,
      pos: pa.array as Float32Array,
      nor: na.array as Float32Array,
      basePos,
      baseNor,
      baseON,
      on: onAttr ? (onAttr.array as Float32Array) : null,
      posAttr: pa,
      norAttr: na,
      onAttr,
      teile: d.liste,
      first: true,
    };
  }

  // Flieger (Vögel, Papageien, Falter): Instanzen, Flügel schlagen über die Höhe der Lage
  const flyGeo = (() => {
    const b = new Bau();
    const w: RGB = [1, 1, 1];
    const d: RGB = [0.8, 0.8, 0.8];
    b.quad([0, 0, 0.35], [0, 0, -0.3], [-1, 0.6, -0.45], [-1, 0.6, 0.1], w);
    b.quad([0, 0, -0.3], [0, 0, 0.35], [1, 0.6, 0.1], [1, 0.6, -0.45], w);
    b.tri([0, 0, 0.55], [0.08, 0, -0.5], [-0.08, 0, -0.5], d);
    b.tri([0, 0, -0.4], [0.25, 0, -0.75], [-0.25, 0, -0.75], d);
    return b.build();
  })();
  const flyMat = toonMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  disposables.push(flyGeo, flyMat);
  const flyMesh: (THREE.InstancedMesh | null)[] = [null, null];
  for (const e of [0, 1] as const) {
    const n = flieger[e].length / 8;
    if (n === 0) continue;
    const im = new THREE.InstancedMesh(flyGeo, flyMat, n);
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let k = 0; k < n; k++) im.setColorAt(k, c.set(fliegerFarbe[e][k]));
    (e ? jetzt : einst).add(im);
    disposables.push(im);
    flyMesh[e] = im;
    if (e) info.jetzt += n * 6;
    else info.einst += n * 6;
  }

  // --- Pro Bild ----------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();

  const setzeTeil = (dd: Dyn, p: Teil, time: number, full: boolean): void => {
    const el = p.m.elements;
    const posA = dd.pos;
    const norA = dd.nor;
    const basePos = dd.basePos;
    const baseNor = dd.baseNor;
    const on = dd.baseON;
    const onA = dd.on;
    for (let i = p.v0; i < p.v1; i++) {
      const o = i * 3;
      let x = basePos[o];
      let y = basePos[o + 1];
      let z = basePos[o + 2];
      if (p.art === 2) {
        const u = Math.max(0, x) / p.len;
        const wv = Math.sin(p.k * x - p.w * time + p.ph) + 0.35 * Math.sin(p.k * 2.3 * x - p.w * 1.7 * time + p.ph * 2 + y);
        z += p.amp * u * wv;
        y += p.amp * 0.2 * u * Math.sin(p.w * 0.8 * time + p.ph + x);
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

  const bewege = (e: 0 | 1, time: number): void => {
    const dd = dyn[e];
    if (!dd) return;
    const w = wackler[e];
    for (let k = 0; k < w.length; k += 8) {
      const p = dd.teile[w[k]];
      const art = w[k + 5];
      const ph = w[k + 6];
      const amp = w[k + 7];
      let yaw = w[k + 4];
      let y = w[k + 2];
      let pitch = 0;
      if (art === 0) {
        // Menschen: wippen; Zuschauer jubeln (hüpfen)
        const s = Math.sin(time * (amp > 0.1 ? 5.5 : 1.6) + ph);
        y += amp * Math.max(0, s) * Math.max(0, s);
        yaw += Math.sin(time * 0.5 + ph) * 0.25;
      } else if (art === 1) {
        // Affe: schaut sich um, kratzt sich
        yaw += Math.sin(time * 0.7 + ph) * 0.8 + Math.sin(time * 2.3 + ph * 2) * 0.15;
        y += Math.max(0, Math.sin(time * 1.9 + ph)) * 0.08;
      } else {
        // Affe an der Liane: schaukelt
        pitch = Math.sin(time * 1.3 + ph) * 0.45;
      }
      eu.set(pitch, yaw, 0, 'YXZ');
      q.setFromEuler(eu);
      p.m.compose(v.set(w[k + 1], y, w[k + 3]), q, sv.set(1, 1, 1));
      setzeTeil(dd, p, time, true);
    }
    const tu = tuecher[e];
    for (let k = 0; k < tu.length; k++) setzeTeil(dd, dd.teile[tu[k]], time, dd.first);
    if (dd.first) {
      // Starre Teile ohne Bewegung (gibt es keine) – nur die Normalen der Tücher einmal setzen.
      dd.first = false;
    }
    dd.posAttr.needsUpdate = true;
    dd.norAttr.needsUpdate = true;
    if (dd.onAttr) dd.onAttr.needsUpdate = true;
  };

  const fliege = (e: 0 | 1, time: number): void => {
    const im = flyMesh[e];
    if (!im) return;
    const f = flieger[e];
    for (let k = 0, n = 0; k < f.length; k += 8, n++) {
      const cx = f[k];
      const cy = f[k + 1];
      const cz = f[k + 2];
      const r = f[k + 3];
      const w = f[k + 4];
      const ph = f[k + 5];
      const size = f[k + 6];
      const a = time * w + ph;
      let x: number;
      let y: number;
      let z: number;
      let yaw: number;
      let flap: number;
      if (f[k + 7] === 0) {
        x = cx + Math.cos(a) * r;
        z = cz + Math.sin(a) * r;
        y = cy + Math.sin(a * 2.3 + ph) * 1.5;
        yaw = Math.atan2(-Math.sin(a) * w, Math.cos(a) * w);
        const glide = Math.sin(time * 0.6 + ph) > -0.2 ? 1 : 0.12;
        flap = Math.sin(time * 7 + ph * 3) * glide;
      } else {
        x = cx + Math.sin(a) * r + Math.sin(a * 2.7 + ph) * r * 0.35;
        z = cz + Math.cos(a * 1.3) * r;
        y = cy + Math.sin(a * 3.1) * 0.6 + Math.sin(time * 5 + ph) * 0.15;
        yaw = a * 1.7 + ph;
        flap = Math.sin(time * 19 + ph * 5);
      }
      eu.set(0, yaw, 0, 'YXZ');
      q.setFromEuler(eu);
      m4.compose(v.set(x, y, z), q, sv.set(size, size * flap, size));
      im.setMatrixAt(n, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  };

  const hemiBase = th.hemiIntensity;
  let hashN = 7;
  const hrnd = (): number => {
    hashN = (hashN * 16807) % 2147483647;
    return hashN / 2147483647;
  };
  let laubT = 0;

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink, raceTime = 0): void {
      const ea: 0 | 1 = era ? eraAt(era, raceTime) : 0;
      einst.visible = ea === 0;
      jetzt.visible = ea === 1;
      // Vorwarnung: die kommende Fassung schimmert sanft als Schemen durch – sie wird langsam
      // deutlicher und pulsiert ruhig (höchstens gut einmal je Sekunde, kleine Helligkeitsänderung:
      // kein flächiges Aufleuchten, keine schnellen Wechsel).
      let g = -1;
      let boost = 0;
      if (era && raceTime > 0) {
        const until = eraUntil(era, raceTime);
        if (until <= ERA_WARN) {
          const u = 1 - until / ERA_WARN;
          const sec = raceTime / 60;
          const puls = 0.5 + 0.5 * Math.sin(sec * TAU * (0.6 + 0.6 * u));
          g = 1 - ea;
          geistMat[g].opacity = Math.min(1, u * 1.6) * (0.07 + 0.06 * puls) * (0.6 + 0.4 * u);
        }
        const since = eraSince(era, raceTime);
        if (raceTime >= era.split && since < BLITZ_T) boost = BLITZ * (1 - since / BLITZ_T);
      }
      if (geist[0]) geist[0].visible = g === 0;
      if (geist[1]) geist[1].visible = g === 1;
      world.hemi.intensity = hemiBase + boost;

      bewege(ea, time);
      fliege(ea, time);

      if (!lines) return;
      if (ea === 0) {
        // Funken aus den Feuerschalen, Tropfen aus Brunnen und Wasserspeiern – nur in der Nähe.
        for (let k = 0; k < flammen.length; k += 3) {
          const x = flammen[k];
          const z = flammen[k + 2];
          if (Math.abs(x - cam.x) + Math.abs(z - cam.z) > 70) continue;
          if (hrnd() > dt * 3) continue;
          fx.spark(x + (hrnd() - 0.5) * 0.6, flammen[k + 1] + 0.4, z + (hrnd() - 0.5) * 0.6, (hrnd() - 0.5) * 0.8 + WX * 0.6, 2 + hrnd() * 1.5, (hrnd() - 0.5) * 0.8 + WZ * 0.6, 0.7 + hrnd() * 0.4, 0.16, hrnd() < 0.5 ? 0xffc34a : 0xff7a1a, -1);
        }
        for (let k = 0; k < quellen.length; k += 4) {
          const x = quellen[k];
          const z = quellen[k + 2];
          if (Math.abs(x - cam.x) + Math.abs(z - cam.z) > 80) continue;
          if (hrnd() > dt * 6 * quellen[k + 3]) continue;
          const a = hrnd() * TAU;
          const s = quellen[k + 3];
          fx.spark(x, quellen[k + 1], z, Math.cos(a) * 1.4 * s, 3.5 * s, Math.sin(a) * 1.4 * s, 0.6, 0.2, 0xd8f6ff, 9);
        }
      } else {
        // Blätter rieseln
        laubT -= dt;
        if (laubT <= 0) {
          laubT = 0.35;
          const a = hrnd() * TAU;
          const r = 6 + hrnd() * 18;
          fx.puff(cam.x + Math.cos(a) * r, cam.y + 6 + hrnd() * 6, cam.z + Math.sin(a) * r, WX * 0.8, -0.2, WZ * 0.8, 3.5, 0.28, hrnd() < 0.5 ? 0x5cb84a : 0x8fbf3a, 0, 0.5);
        }
      }
    },
    dispose(): void {
      world.hemi.intensity = hemiBase;
      for (const d of disposables) d.dispose();
    },
  };
}
