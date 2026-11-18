// Kulisse der Gipfelbahn: ein klarer Sommertag in den Alpen, vom Dorf im Tal bis auf den Gletscher.
//
// Rundum stehen in der Ferne hohe Gipfel mit Schneekappen und Gletscherzungen (Bergpanorama, ohne
// Dunst gezeichnet, der Dunst ist wie bei den Tafelbergen im Dschungel in die Farben eingerechnet –
// hier je Ecke, damit die Füße der Berge im Talnebel verschwinden). Darunter liegt der Talboden mit
// Feldern, Waldinseln, Höfen, einem See und einem Fluss.
//
// Die Strecke liegt auf Bergschultern: Das Gelände von world.ts fällt gleich neben der Bande steil
// zum Talboden ab; über dessen Raster liegt hier ein eigenes Netz mit breiten, nach außen immer
// steileren Schultern – gezeichnet nur, wo es höher liegt als das Gelände darunter. Über dem Flugkorridor
// und unter der Skisprungschanze (Klamm) bleibt es tief. Gefärbt nach Höhe und Lage: satte Talwiesen,
// helle Almen, dunkler Waldboden, Geröll, Fels an steilen Stellen, oben Schnee und Gletschereis.
//
// Im Dorf um Start und Ziel: Chalets mit Holzbalkonen, Blumenkästen und flachen Satteldächern mit
// Steinen, die Kirche mit Zwiebelturm, Dorfbrunnen, Maibaum, Leute und Wimpelketten über der
// Startgeraden. Tal- und Bergstation der Sommerrodelbahn (die Bahn selbst zeichnet mechanics/rails.ts).
// Auf den Almen an den Serpentinen grasen Kühe mit Glocken, dazwischen Heustadel, Schrägzäune,
// Blumen und Felsbrocken; an der Almwiese hohes Gras. Oben Gletscherspalten, Séracs, Felsgrate,
// Gipfelkreuz, Gipfelhütte, Windsack und Fahnen an der Schanze. Über dem Tal ziehen Gleitschirmflieger
// und Greifvögel ihre Kreise. Abfahrt durch den Fichtenwald mit Almhütte, an der Skisprungschanze
// Anlaufturm und Kampfrichterturm, darunter die Klamm mit Bach. (Die Seilbahn zeichnet things.ts.)
//
// Reine Kulisse: mindestens RAND Meter neben jeder Fahrbahnkante (auch an den Abzweigungen), über
// einer Fahrbahn nichts unter LUFT Metern, nichts im Flugkorridor. Alles wird mit festem Zufall aus der
// Strecke abgeleitet; im Lauf wird nichts angelegt.
//
// Technik wie auf dem Rummel: nur Eckenfarben, Toon-Material mit Kontur, MeshBasicMaterial und Netze,
// deren Ecken je Bild aus Grundform und Lage neu berechnet werden – keine eigenen Shader, keine
// Texturen, keine Lichtquellen.
//
// Zeichenaufrufe (hoch): Bauten + Kontur, Boden und Pflanzen, Wasser und Schlund, Panorama,
// Tiere und Flieger + Kontur, Fahnen = 8. Niedrig: ohne Konturen = 6.

import * as THREE from 'three';
import { EDGE_DECK, EDGE_GAP, EDGE_GLIDE, EDGE_RAIL, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Mindestabstand zur Fahrbahnkante (Meter). */
const RAND = 3;
/** So hoch bleibt der Raum über einer Fahrbahn frei (Meter, mit Reserve). */
const LUFT = 10.6;
/** Um Tunnel liegt Fels (world.ts): dort beginnt der freie Platz erst weiter draußen. */
const TUNNEL_PLUS = 7;
const TAU = Math.PI * 2;

// --- Farben -------------------------------------------------------------------------

const C_WIESE = rgb(0x79b648);
const C_WIESE_D = rgb(0x62a03a);
const C_ALM = rgb(0xa3c95e);
const C_ALM_D = rgb(0x86b44c);
const C_WALDBODEN = rgb(0x5a8139);
const C_WALDBODEN_D = rgb(0x4a7030);
const C_FELS = rgb(0x968e82);
const C_FELS_D = rgb(0x6e6961);
const C_FELS_H = rgb(0xb4ad9f);
const C_GEROELL = rgb(0xaaa498);
const C_SCHNEE = rgb(0xf6f9fd);
const C_SCHNEE_S = rgb(0xdae6f3);
const C_EIS = rgb(0xbfe3f5);
const C_EIS_D = rgb(0x78b9de);
const C_SPALTE = rgb(0x1f4a74);
const C_SPALTE_R = rgb(0x8fcbea);
const C_WASSER = rgb(0x3f8fd0);
const C_WASSER_H = rgb(0x8fd0f2);
const C_GISCHT = rgb(0xeef8ff);
const C_SCHLUND = rgb(0x141c26);

const C_HOLZ = rgb(0x8f5d33);
const C_HOLZ_D = rgb(0x5c3b22);
const C_HOLZ_H = rgb(0xb47c48);
const C_HOLZ_ALT = rgb(0x6d5646);
const C_HOLZ_ALT_D = rgb(0x4f3e33);
const C_PUTZ = rgb(0xf4efe3);
const C_PUTZ_S = rgb(0xe4ddcc);
const C_SOCKEL = rgb(0xa9a397);
const C_DACH = rgb(0x5f4b3f);
const C_DACH_D = rgb(0x45362d);
const C_DACH_ROT = rgb(0xa04a33);
const C_DACH_ROT_D = rgb(0x7e3826);
const C_FENSTER = rgb(0x2c3a4e);
const C_FENSTER_H = rgb(0x9fc6de);
const C_LADEN = [rgb(0x3f8a4e), rgb(0xb8433a), rgb(0x3d6fa8)];
const C_GERANIE = [rgb(0xe8304a), rgb(0xff6fa8), rgb(0xfdf3f0), rgb(0xd8263a)];
const C_LAUBGRUEN = rgb(0x4e8f3a);
const C_KUPFER = rgb(0x5fae8c);
const C_KUPFER_D = rgb(0x47917a);
const C_GOLD = rgb(0xf2c443);
const C_STEIN = rgb(0x8f8b85);
const C_STEIN_D = rgb(0x6f6b66);
const C_ROT = rgb(0xd8382e);
const C_WEISS = rgb(0xfbf8f1);
const C_BLAU = rgb(0x3c78d0);
const C_GELB = rgb(0xffcf3a);
const C_GRUEN = rgb(0x3fa35a);
const C_ORANGE = rgb(0xff7a2a);
const C_DUNKEL = rgb(0x2a2733);
const C_STAHL = rgb(0x8d939e);
const C_HEU = rgb(0xd9b75a);

const C_FICHTE = rgb(0x2f6a45);
const C_FICHTE_D = rgb(0x24583a);
const C_FICHTE_H = rgb(0x3d7d52);
const C_STAMM = rgb(0x5b3d28);
const C_LAUB = [0x6fb046, 0x5ea23c, 0x84bd52, 0x4f9236].map(rgb);
const BLUMEN = [0xfdf6e8, 0xffd23f, 0xb27ae0, 0xe8483f, 0x5aa0f0, 0xff8ac0, 0xffffff].map(rgb);
const GRAS = [0x8cbf4a, 0x9fcb58, 0x76ad3e, 0xb9cf68].map(rgb);

const C_KUH_B = rgb(0x8b5e3c);
const C_KUH_BD = rgb(0x5e3f29);
const C_KUH_W = rgb(0xf3ede2);
const C_KUH_R = rgb(0xa8552e);
const C_MAUL = rgb(0xe9c7a9);
const C_HORN = rgb(0xf1e8d4);
const C_GLOCKE = rgb(0xe8b83a);
const C_RIEMEN = rgb(0x3a2a20);
const HAUT = [rgb(0xf2c8a0), rgb(0xd9a070), rgb(0xf6d8b8), rgb(0xb57a50)];
const TRACHT = [rgb(0xc8323a), rgb(0x2f6b45), rgb(0x2f4f8a), rgb(0x6a4a30), rgb(0xf4efe3), rgb(0x8a3a6a)];
const SCHIRME: [RGB, RGB][] = [
  [rgb(0xff5a3c), rgb(0xffd23f)],
  [rgb(0x2ec4b6), rgb(0xfdf6e8)],
  [rgb(0x7a5ad8), rgb(0xff6fa8)],
  [rgb(0x3c78d0), rgb(0xf2f6ff)],
];
const C_VOGEL = rgb(0x5a4030);
const C_VOGEL_H = rgb(0xd8c8a8);

// --- Bausteine -----------------------------------------------------------------------

/** Zeichnet in einem lokalen Rahmen (Ursprung, Drehung um die Hochachse) in einen MeshBuilder. */
class Kit {
  ox = 0;
  oy = 0;
  oz = 0;
  c = 1;
  s = 0;
  constructor(readonly mb: MeshBuilder) {}
  at(x: number, y: number, z: number, yaw = 0): this {
    this.ox = x;
    this.oy = y;
    this.oz = z;
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
    return this;
  }
  /** Übernimmt den Rahmen eines anderen Kits (Kleinkram ohne Kontur am selben Haus). */
  like(k: Kit): this {
    this.ox = k.ox;
    this.oy = k.oy;
    this.oz = k.oz;
    this.c = k.c;
    this.s = k.s;
    return this;
  }
  p(x: number, y: number, z: number): V3 {
    return [this.ox + x * this.c + z * this.s, this.oy + y, this.oz - x * this.s + z * this.c];
  }
  /** Dreieck, das von ref weg zeigt (Punkte in Weltlage). */
  to(a: V3, b: V3, c: V3, col: RGB, ref: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3 - ref[0];
    const my = (a[1] + b[1] + c[1]) / 3 - ref[1];
    const mz = (a[2] + b[2] + c[2]) / 3 - ref[2];
    if (nx * mx + ny * my + nz * mz >= 0) this.mb.tri(a, b, c, col);
    else this.mb.tri(a, c, b, col);
  }
  qo(a: V3, b: V3, c: V3, d: V3, col: RGB, ref: V3): void {
    this.to(a, b, c, col, ref);
    this.to(a, c, d, col, ref);
  }
  /** Fläche in lokalen Koordinaten, gegen den Uhrzeigersinn von der sichtbaren Seite. */
  quad(a: V3, b: V3, c: V3, d: V3, col: RGB): void {
    this.mb.quad(this.p(a[0], a[1], a[2]), this.p(b[0], b[1], b[2]), this.p(c[0], c[1], c[2]), this.p(d[0], d[1], d[2]), col);
  }
  /** Beidseitige Fläche. */
  quad2(a: V3, b: V3, c: V3, d: V3, col: RGB, back?: RGB): void {
    this.quad(a, b, c, d, col);
    this.quad(d, c, b, a, back ?? col);
  }
  tri(a: V3, b: V3, c: V3, col: RGB): void {
    this.mb.tri(this.p(a[0], a[1], a[2]), this.p(b[0], b[1], b[2]), this.p(c[0], c[1], c[2]), col);
  }
  /** Dreieck in lokalen Punkten, das vom lokalen Punkt ref weg zeigt. */
  tl(a: V3, b: V3, c: V3, col: RGB, ref: V3): void {
    this.to(this.p(a[0], a[1], a[2]), this.p(b[0], b[1], b[2]), this.p(c[0], c[1], c[2]), col, this.p(ref[0], ref[1], ref[2]));
  }
  /** Viereck in lokalen Punkten, das vom lokalen Punkt ref weg zeigt. */
  ql(a: V3, b: V3, c: V3, d: V3, col: RGB, ref: V3): void {
    const r = this.p(ref[0], ref[1], ref[2]);
    const A = this.p(a[0], a[1], a[2]);
    const C = this.p(c[0], c[1], c[2]);
    this.to(A, this.p(b[0], b[1], b[2]), C, col, r);
    this.to(A, C, this.p(d[0], d[1], d[2]), col, r);
  }
  tri2(a: V3, b: V3, c: V3, col: RGB): void {
    this.tri(a, b, c, col);
    this.tri(a, c, b, col);
  }
  /** Quader (ohne Boden), lokal um rot gedreht. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: RGB, top?: RGB, rot = 0): void {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const q = (x: number, y: number, z: number): V3 => this.p(cx + x * c + z * s, cy + y, cz - x * s + z * c);
    const v = [q(-hx, -hy, -hz), q(hx, -hy, -hz), q(hx, hy, -hz), q(-hx, hy, -hz), q(-hx, -hy, hz), q(hx, -hy, hz), q(hx, hy, hz), q(-hx, hy, hz)];
    const ref = this.p(cx, cy, cz);
    this.qo(v[4], v[5], v[6], v[7], col, ref);
    this.qo(v[1], v[0], v[3], v[2], col, ref);
    this.qo(v[5], v[1], v[2], v[6], col, ref);
    this.qo(v[0], v[4], v[7], v[3], col, ref);
    this.qo(v[7], v[6], v[2], v[3], top ?? col, ref);
  }
  /** Prisma bzw. Kegelstumpf mit n Seiten (ohne Boden); colB färbt jede zweite Seite. */
  prism(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, n: number, col: RGB, colB?: RGB, top?: RGB | null, rot = 0): void {
    const ref = this.p(cx, y0 + h * 0.4, cz);
    const pt = (k: number, r: number, y: number): V3 => {
      const a = rot + (k / n) * TAU;
      return this.p(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    };
    const tc = this.p(cx, y0 + h, cz);
    for (let k = 0; k < n; k++) {
      const cc = colB && k % 2 === 1 ? colB : col;
      if (r1 > 0.001) this.qo(pt(k, r0, y0), pt(k + 1, r0, y0), pt(k + 1, r1, y0 + h), pt(k, r1, y0 + h), cc, ref);
      else this.to(pt(k, r0, y0), pt(k + 1, r0, y0), tc, cc, ref);
      if (r1 > 0.001 && top !== null) this.to(pt(k, r1, y0 + h), pt(k + 1, r1, y0 + h), tc, top ?? cc, this.p(cx, y0 + h - 1, cz));
    }
  }
  /** Balken von a nach b (lokal) mit quadratischem Querschnitt w. */
  beam(a: V3, b: V3, w: number, col: RGB): void {
    const A = this.p(a[0], a[1], a[2]);
    const B = this.p(b[0], b[1], b[2]);
    let dx = B[0] - A[0];
    let dy = B[1] - A[1];
    let dz = B[2] - A[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    let ex = -dz;
    let ey = 0;
    let ez = dx;
    if (Math.hypot(ex, ez) < 0.1) {
      ex = 0;
      ey = dz;
      ez = -dy;
    }
    const el = Math.hypot(ex, ey, ez);
    ex *= w / 2 / el;
    ey *= w / 2 / el;
    ez *= w / 2 / el;
    const fx = ey * dz - ez * dy;
    const fy = ez * dx - ex * dz;
    const fz = ex * dy - ey * dx;
    const corner = (P: V3, s1: number, s2: number): V3 => [P[0] + ex * s1 + fx * s2, P[1] + ey * s1 + fy * s2, P[2] + ez * s1 + fz * s2];
    const ref: V3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    const S: [number, number][] = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (let k = 0; k < 4; k++) {
      const [a1, a2] = S[k];
      const [b1, b2] = S[(k + 1) % 4];
      this.qo(corner(A, a1, a2), corner(A, b1, b2), corner(B, b1, b2), corner(B, a1, a2), col, ref);
    }
  }
  /** Achtflächner (Köpfe, Blüten, Steine). */
  octa(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, col: RGB, low?: RGB): void {
    const ref = this.p(cx, cy, cz);
    const T = this.p(cx, cy + ry, cz);
    const D = this.p(cx, cy - ry, cz);
    const ring = [this.p(cx + rx, cy, cz), this.p(cx, cy, cz + rz), this.p(cx - rx, cy, cz), this.p(cx, cy, cz - rz)];
    for (let k = 0; k < 4; k++) {
      this.to(ring[k], ring[(k + 1) % 4], T, col, ref);
      this.to(ring[k], ring[(k + 1) % 4], D, low ?? col, ref);
    }
  }
}

const IDENT = new THREE.Matrix4().elements;

/** Teile, die sich bewegen: ein Netz, dessen Ecken je Bild aus Grundform und Lage neu entstehen. */
class Moving {
  private readonly geos: THREE.BufferGeometry[] = [];
  /** Je Teil: Art des Flatterns (0 keins, 1 Fahne längs x, 2 Flügelschlag), Stärke, Takt, Phase. */
  private readonly waveP: number[] = [];
  starts: Int32Array = new Int32Array(0);
  counts: Int32Array = new Int32Array(0);
  mats: Float32Array = new Float32Array(0);
  geometry = new THREE.BufferGeometry();
  private bp = new Float32Array(0);
  private bn = new Float32Array(0);
  private bo = new Float32Array(0);
  get parts(): number {
    return this.geos.length;
  }
  add(mb: MeshBuilder, wave = 0, amp = 0, freq = 0, ph = 0): number {
    const g = mb.build();
    addSmoothNormals(g);
    this.geos.push(g);
    this.waveP.push(wave, amp, freq, ph);
    return this.geos.length - 1;
  }
  build(): THREE.BufferGeometry {
    let n = 0;
    const np = this.geos.length;
    this.starts = new Int32Array(np);
    this.counts = new Int32Array(np);
    for (let k = 0; k < np; k++) {
      this.starts[k] = n;
      this.counts[k] = this.geos[k].getAttribute('position').count;
      n += this.counts[k];
    }
    this.bp = new Float32Array(n * 3);
    this.bn = new Float32Array(n * 3);
    this.bo = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let k = 0; k < np; k++) {
      const g = this.geos[k];
      const o = this.starts[k] * 3;
      this.bp.set(g.getAttribute('position').array as Float32Array, o);
      this.bn.set(g.getAttribute('normal').array as Float32Array, o);
      this.bo.set(g.getAttribute('onormal').array as Float32Array, o);
      col.set(g.getAttribute('color').array as Float32Array, o);
      g.dispose();
    }
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const nor = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const onr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    nor.setUsage(THREE.DynamicDrawUsage);
    onr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', pos);
    this.geometry.setAttribute('normal', nor);
    this.geometry.setAttribute('onormal', onr);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mats = new Float32Array(np * 16);
    for (let k = 0; k < np; k++) this.mats.set(IDENT, k * 16);
    return this.geometry;
  }
  set(part: number, m: THREE.Matrix4): void {
    this.mats.set(m.elements, part * 16);
  }
  update(time: number): void {
    const P = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const N = this.geometry.getAttribute('normal') as THREE.BufferAttribute;
    const O = this.geometry.getAttribute('onormal') as THREE.BufferAttribute;
    const pa = P.array as Float32Array;
    const na = N.array as Float32Array;
    const oa = O.array as Float32Array;
    const bp = this.bp;
    const bn = this.bn;
    const bo = this.bo;
    const e = this.mats;
    for (let k = 0; k < this.starts.length; k++) {
      const m = k * 16;
      const wave = this.waveP[k * 4];
      const amp = this.waveP[k * 4 + 1];
      const wt = time * this.waveP[k * 4 + 2] + this.waveP[k * 4 + 3];
      const end = (this.starts[k] + this.counts[k]) * 3;
      for (let i = this.starts[k] * 3; i < end; i += 3) {
        let x = bp[i];
        let y = bp[i + 1];
        let z = bp[i + 2];
        if (wave === 1) z += amp * x * Math.sin(wt - x * 1.1);
        else if (wave === 2) y += amp * Math.abs(x) * Math.sin(wt);
        pa[i] = e[m] * x + e[m + 4] * y + e[m + 8] * z + e[m + 12];
        pa[i + 1] = e[m + 1] * x + e[m + 5] * y + e[m + 9] * z + e[m + 13];
        pa[i + 2] = e[m + 2] * x + e[m + 6] * y + e[m + 10] * z + e[m + 14];
        x = bn[i];
        y = bn[i + 1];
        z = bn[i + 2];
        na[i] = e[m] * x + e[m + 4] * y + e[m + 8] * z;
        na[i + 1] = e[m + 1] * x + e[m + 5] * y + e[m + 9] * z;
        na[i + 2] = e[m + 2] * x + e[m + 6] * y + e[m + 10] * z;
        x = bo[i];
        y = bo[i + 1];
        z = bo[i + 2];
        oa[i] = e[m] * x + e[m + 4] * y + e[m + 8] * z;
        oa[i + 1] = e[m + 1] * x + e[m + 5] * y + e[m + 9] * z;
        oa[i + 2] = e[m + 2] * x + e[m + 6] * y + e[m + 10] * z;
      }
    }
    P.needsUpdate = true;
    N.needsUpdate = true;
    O.needsUpdate = true;
  }
}

/** Ferne Berge: Dreiecke mit eigener Farbe je Ecke (Dunst nach unten dichter), unbeleuchtet. */
class Fern {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  get triangles(): number {
    return this.pos.length / 9;
  }
  tri(a: V3, b: V3, c: V3, ca: RGB, cb: RGB, cc: RGB): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// Gebiete der Strecke (für Bodenfarbe und Bepflanzung)
const TAL = 0;
const ALM = 1;
const GLETSCHER = 2;
const WALD = 3;
const LUFTRAUM = 4;

export function buildGipfelLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail > 0;
  const rnd = seeded(7700 + t.index * 41);
  const T = t.total;
  const N = t.n;
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const pick = <X>(a: readonly X[]): X => a[Math.floor(rnd() * a.length) % a.length];
  const jit = (c: RGB, k: number): RGB => shade(c, 1 - k / 2 + rnd() * k);

  const bauB = new MeshBuilder(); // Bauten (mit Kontur)
  const bodenB = new MeshBuilder(); // Boden, Pflanzen, Kleinkram (ohne Kontur)
  const mattB = new MeshBuilder(); // Wasser, Schlund der Klamm (unbeleuchtet)
  const fern = new Fern();
  const bau = new Kit(bauB);
  const deko = new Kit(bodenB);
  const matt = new Kit(mattB);
  const mov = new Moving(); // Kühe, Gleitschirme (mit Kontur)
  const small = new Moving(); // Fahnen, Windsack, Vögel (ohne Kontur)

  // =====================================================================================
  // Strecke: Stützpunkte, Gebiete, freier Platz
  // =====================================================================================
  const scale = t.def.scale ?? 1;
  const K = t.def.points.length;
  /** Abschnitt der Hauptstrecke an jedem Stützpunkt. */
  const knot = t.def.points.map((p) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(t.px[i] - p[0] * scale, t.pz[i] - p[1] * scale) + Math.abs(t.py[i] - (p[2] ?? 0)) * 0.3;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  });
  /** Abschnitt der Hauptstrecke bei u Stützpunkt-Einheiten (12,5 = halb zwischen 12 und 13), ohne Umlauf. */
  const segRaw = (u: number): number => {
    if (u >= K) return N + segRaw(u - K);
    const k = Math.floor(u);
    const a = knot[k];
    let b = k + 1 < K ? knot[k + 1] : N;
    if (b < a) b += N;
    return a + (b - a) * (u - k);
  };
  const segU = (u: number): number => ((Math.round(segRaw(u)) % N) + N) % N;
  /** Liegt Abschnitt i der Hauptstrecke zwischen u0 und u1 (Stützpunkt-Einheiten, auch über den Start hinweg)? */
  const inU = (i: number, u0: number, u1: number): boolean => {
    const a = segU(u0);
    const b = segU(u1);
    return a <= b ? i >= a && i <= b : i >= a || i <= b;
  };
  const brA = t.branches[0];
  const brB = t.branches[1];
  /** Gebiet eines Abschnitts (Hauptstrecke oder Abzweigung). */
  const gebiet = new Uint8Array(T);
  for (let i = 0; i < T; i++) {
    const b = t.branchOf[i];
    if (b === 0) gebiet[i] = ALM;
    else if (b === 1) gebiet[i] = WALD;
    else if (t.edge[i] & EDGE_GLIDE) gebiet[i] = LUFTRAUM;
    else if (inU(i, 30.8, 4.15)) gebiet[i] = TAL;
    else if (inU(i, 4.15, 16.7)) gebiet[i] = ALM;
    else if (inU(i, 16.7, 19.7)) gebiet[i] = GLETSCHER;
    else if (inU(i, 23.4, 30.8)) gebiet[i] = WALD;
    else gebiet[i] = LUFTRAUM;
  }

  // Flanken: Gefälle der Schultern je Abschnitt (a·d + b·d², d = Abstand hinter der Bande)
  const FLANKE: [number, number, number][] = [
    [0, 0.042, 0.004],
    [3.3, 0.042, 0.004],
    [4.4, 0.08, 0.0068],
    [8.6, 0.08, 0.0068],
    [9.6, 0.068, 0.0056],
    [16.2, 0.068, 0.0056],
    [17.2, 0.12, 0.0092],
    [19.5, 0.12, 0.0092],
    [23.6, 0.1, 0.0082],
    [30.3, 0.09, 0.0074],
    [31.5, 0.042, 0.004],
    [K, 0.042, 0.004],
  ];
  const flA = new Float32Array(T);
  const flB = new Float32Array(T);
  {
    const ks = FLANKE.map(([u, a, b]) => [segRaw(u), a, b]);
    for (let i = 0; i < N; i++) {
      let j = 0;
      while (j + 2 < ks.length && ks[j + 1][0] <= i) j++;
      const [s0, a0, b0] = ks[j];
      const [s1, a1, b1] = ks[j + 1];
      const f = s1 > s0 ? Math.max(0, Math.min(1, (i - s0) / (s1 - s0))) : 0;
      flA[i] = a0 + (a1 - a0) * f;
      flB[i] = b0 + (b1 - b0) * f;
    }
    for (const b of t.branches) {
      for (let j = 0; j < b.count; j++) {
        flA[b.first + j] = flA[b.from];
        flB[b.first + j] = flB[b.from];
      }
    }
  }

  // Klamm: die Lücke unter der Skisprungschanze (Abzweigung mit EDGE_GAP, ohne Gleitflug)
  let klamm: Klamm | null = null;
  {
    let g0 = -1;
    let g1 = -1;
    for (let i = N; i < T; i++) {
      if ((t.edge[i] & EDGE_GAP) === 0 || (t.edge[i] & EDGE_GLIDE) !== 0) continue;
      if (g0 < 0) g0 = i;
      g1 = i;
    }
    if (g0 >= 0) {
      const m = (g0 + g1) >> 1;
      let ylo = Infinity;
      for (let i = g0; i <= g1; i++) ylo = Math.min(ylo, t.py[i]);
      const rx = rightX(t, m);
      const rz = rightZ(t, m);
      // Der Bach fließt zur tieferen Seite.
      const xa = t.px[m] + rx * 45;
      const za = t.pz[m] + rz * 45;
      const xb = t.px[m] - rx * 45;
      const zb = t.pz[m] - rz * 45;
      const fall = world.heightAt(xa, za) < world.heightAt(xb, zb) ? 1 : -1;
      klamm = { x: t.px[m], z: t.pz[m], ax: t.tx[m], az: t.tz[m], rx, rz, half: (g1 - g0 + 1) * t.step * 0.5 + 1.5, y: ylo - 15, fall };
    }
  }

  // =====================================================================================
  // Gelände: Bergschultern über dem Raster von world.ts
  // =====================================================================================
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < T; i++) {
    minX = Math.min(minX, t.px[i]);
    maxX = Math.max(maxX, t.px[i]);
    minZ = Math.min(minZ, t.pz[i]);
    maxZ = Math.max(maxZ, t.pz[i]);
  }
  const farY = th.farY;
  const CELL = detail === 0 ? 11 : 7.5;
  const gx0 = minX - 150;
  const gz0 = minZ - 150;
  const GX = Math.max(1, Math.ceil((maxX - minX + 300) / CELL));
  const GZ = Math.max(1, Math.ceil((maxZ - minZ + 300) / CELL));
  const GW = GX + 1;
  const sch = schultern(world, gx0, gz0, CELL, GX, GZ, flA, flB, klamm);
  /** Gelände von world.ts und sichtbarer Boden (das Höhere von Gelände und Schulter) an den Rasterpunkten. */
  const wY = sch.wY;
  const hY = sch.hY;
  /** Abschnitt, der die Schulter an einem Rasterpunkt trägt (−1: Gelände von world.ts). */
  const qV = sch.qV;
  const unterBahn = sch.unter;
  /** Sichtbarer Boden (Gelände bzw. Schulter, wie gezeichnet). */
  const grund = (x: number, z: number): number => {
    const fx = (x - gx0) / CELL;
    const fz = (z - gz0) / CELL;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    if (ix < 0 || iz < 0 || ix >= GX || iz >= GZ) return farY - 0.2;
    const u = fx - ix;
    const v = fz - iz;
    const a = iz * GW + ix;
    const ha = hY[a];
    const hb = hY[a + 1];
    const hc = hY[a + GW + 1];
    const hd = hY[a + GW];
    if ((ix + iz) % 2 === 0) return u >= v ? ha + (hb - ha) * u + (hc - hb) * v : ha + (hd - ha) * v + (hc - hd) * u;
    return u + v <= 1 ? ha + (hb - ha) * u + (hd - ha) * v : hc + (hd - hc) * (1 - u) + (hb - hc) * (1 - v);
  };
  /** Höhenunterschied des Bodens unter einem Grundriss (Breite w quer, Tiefe d längs der Drehung yaw). */
  const hangUnter = (x: number, z: number, yaw: number, w: number, d: number): [number, number] => {
    let lo = Infinity;
    let up = -Infinity;
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    for (const [a, b] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
      [0, 0],
    ]) {
      const g = grund(x + a * c + b * sn, z - a * sn + b * c);
      lo = Math.min(lo, g);
      up = Math.max(up, g);
    }
    return [lo, up];
  };
  /** Wie steil ist der Boden? (1 = eben) */
  const eben = (x: number, z: number): number => {
    const gx = (grund(x + 1.5, z) - grund(x - 1.5, z)) / 3;
    const gz = (grund(x, z + 1.5) - grund(x, z - 1.5)) / 3;
    return 1 / Math.sqrt(1 + gx * gx + gz * gz);
  };

  // --- Platz -------------------------------------------------------------------------
  const FZ = 24;
  const fRaster = new Map<number, number[]>();
  const fKey = (ix: number, iz: number): number => (ix + 2048) * 4096 + (iz + 2048);
  let maxWh = 0;
  for (let k = 0; k < T; k += 2) {
    maxWh = Math.max(maxWh, t.wh[k]);
    const key = fKey(Math.floor(t.px[k] / FZ), Math.floor(t.pz[k] / FZ));
    let a = fRaster.get(key);
    if (!a) fRaster.set(key, (a = []));
    a.push(k);
  }
  /** Abstand zur nächsten Fahrbahnkante (2D, Tunnel mit Felsmantel). */
  const kante = (x: number, z: number): number => {
    let best = Infinity;
    const ix = Math.floor(x / FZ);
    const iz = Math.floor(z / FZ);
    for (let r = 0; r <= 6; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const a = fRaster.get(fKey(ix + dx, iz + dz));
          if (!a) continue;
          for (const k of a) {
            const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k] - (t.edge[k] & EDGE_TUNNEL ? TUNNEL_PLUS : 0);
            if (d < best) best = d;
          }
        }
      }
      if (best <= r * FZ - maxWh - TUNNEL_PLUS) break;
    }
    return best;
  };
  // Sperrkreise: Seilbahnstützen (things.ts), Startbogen, Bahnhof der Sommerrodelbahn, eigene Bauten
  const sperr: number[] = [];
  const sperre = (x: number, z: number, r: number): void => {
    sperr.push(x, z, r);
  };
  /** Ist um (x, z) im Radius r von Höhe y0 bis y0 + h Platz? (rand Meter hinter jeder Kante) */
  const frei = (x: number, z: number, r: number, y0: number, h: number, rand = RAND): boolean => {
    const reach = r + rand + maxWh + 12;
    const n = Math.ceil(reach / FZ);
    const ix = Math.floor(x / FZ);
    const iz = Math.floor(z / FZ);
    for (let dx = -n; dx <= n; dx++) {
      for (let dz = -n; dz <= n; dz++) {
        const a = fRaster.get(fKey(ix + dx, iz + dz));
        if (!a) continue;
        for (const k of a) {
          const e = t.edge[k];
          let extra = 0;
          let lo = t.py[k] - 2.5;
          let up = t.py[k] + LUFT;
          if (e & EDGE_TUNNEL) extra = TUNNEL_PLUS;
          else if (e & EDGE_GLIDE) {
            // Flugkorridor: eine Röhre quer zur Flugbahn (vor dem Absprung und hinter der Landung frei)
            const along = (x - t.px[k]) * t.tx[k] + (z - t.pz[k]) * t.tz[k];
            if (along > 1.6 + r || along < -1.6 - r) continue;
            extra = 10;
            lo = t.py[k] - 22;
            up = t.py[k] + 20;
          } else if (e & EDGE_DECK) lo = -1e9;
          const bh = Math.abs(t.bank[k]) * t.wh[k];
          const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k] - extra - r;
          if (d >= rand) continue;
          if (y0 + h < lo - bh || y0 > up + bh) continue;
          return false;
        }
      }
    }
    for (let q = 0; q < sperr.length; q += 3) if (Math.hypot(x - sperr[q], z - sperr[q + 1]) < sperr[q + 2] + r) return false;
    return true;
  };
  // Belegung: was schon steht (x, z, r)
  const ZELLE = 10;
  const raster = new Map<number, number[]>();
  const rk = (ix: number, iz: number): number => (ix + 4096) * 8192 + (iz + 4096);
  const belege = (x: number, z: number, r: number): void => {
    const key = rk(Math.floor(x / ZELLE), Math.floor(z / ZELLE));
    let a = raster.get(key);
    if (!a) raster.set(key, (a = []));
    a.push(x, z, r);
  };
  const belegt = (x: number, z: number, r: number, f = 1): boolean => {
    const reach = r + 14;
    const ix0 = Math.floor((x - reach) / ZELLE);
    const ix1 = Math.floor((x + reach) / ZELLE);
    const iz0 = Math.floor((z - reach) / ZELLE);
    const iz1 = Math.floor((z + reach) / ZELLE);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const a = raster.get(rk(ix, iz));
        if (!a) continue;
        for (let q = 0; q < a.length; q += 3) if (Math.hypot(x - a[q], z - a[q + 1]) < (r + a[q + 2]) * f) return true;
      }
    }
    return false;
  };
  /** Platz für ein Stück am Boden: frei, unbelegt, nicht zu steil. */
  const platz = (x: number, z: number, r: number, h: number, minEben = 0.8, rand = RAND): boolean => {
    if (belegt(x, z, r)) return false;
    const y = grund(x, z);
    if (!frei(x, z, r, y - 0.5, h + 0.5, rand)) return false;
    return eben(x, z) >= minEben;
  };

  /** Punkt neben der Strecke: Abschnitt i, seitlich lat (rechts positiv), längs w. */
  const LX = (i: number, lat: number, w = 0): number => t.px[i] + rightX(t, i) * lat + t.tx[i] * w;
  const LZ = (i: number, lat: number, w = 0): number => t.pz[i] + rightZ(t, i) * lat + t.tz[i] * w;
  /** Drehung, mit der lokales +z in Fahrtrichtung zeigt (lokales +x zeigt dann nach links). */
  const yawAt = (i: number): number => Math.atan2(t.tx[i], t.tz[i]);
  /** Drehung, mit der lokales +z von (x, z) zur Fahrbahnmitte von i zeigt. */
  const faceRoad = (i: number, x: number, z: number): number => Math.atan2(t.px[i] - x, t.pz[i] - z);

  // Sperrkreise der anderen
  for (const h of t.hazards) {
    const out = Math.max(t.wh[h.seg] + 3, h.amp + 6);
    for (const sg of [-1, 1]) sperre(LX(h.seg, sg * out), LZ(h.seg, sg * out), 3.5);
  }
  for (const sg of [-1, 1]) sperre(LX(0, sg * (t.wh[0] + 2.1)), LZ(0, sg * (t.wh[0] + 2.1)), 1.6);
  for (const r of t.rails) {
    for (let s = r.first; s <= Math.min(r.first + r.count - 1, r.first + 46); s += 3) for (const sg of [-1, 1]) sperre(LX(s, sg * 8.2), LZ(s, sg * 8.2), 3.2);
  }

  const m4 = new THREE.Matrix4();
  const m5 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const e4 = new THREE.Euler(0, 0, 0, 'YXZ');
  const v4 = new THREE.Vector3();
  const s4 = new THREE.Vector3(1, 1, 1);
  const pose = (x: number, y: number, z: number, yaw: number, pitch = 0, roll = 0, s = 1): THREE.Matrix4 => {
    e4.set(pitch, yaw, roll);
    q4.setFromEuler(e4);
    v4.set(x, y, z);
    s4.setScalar(s);
    return m4.compose(v4, q4, s4);
  };
  // Grundformen (am Ende freigegeben)
  const G = {
    ico: new THREE.IcosahedronGeometry(1, 0),
    dode: new THREE.DodecahedronGeometry(1, 0),
    okt: new THREE.OctahedronGeometry(1, 0),
    box: new THREE.BoxGeometry(1, 1, 1),
    kegel4: new THREE.ConeGeometry(1, 1, 4, 1, true),
    kegel5: new THREE.ConeGeometry(1, 1, 5, 1, true),
  };
  /** Grundform mit Lage, Drehung und Größe in einen Builder. */
  const geo = (b: MeshBuilder, g: THREE.BufferGeometry, c: RGB, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void => {
    e4.set(rx, ry, rz);
    q4.setFromEuler(e4);
    b.add(g, c, m4.compose(v4.set(x, y, z), q4, s4.set(sx, sy, sz)));
  };

  // =====================================================================================
  // Boden: die Schultern als Netz
  // =====================================================================================
  {
    const farbe = (zone: number, y: number, up: number, x: number, z: number): RGB => {
      const n1 = noise(x * 0.05, z * 0.05);
      const n2 = noise(x * 0.17 + 4, z * 0.17);
      const schneeGrenze = 75 + n1 * 5;
      if (zone === GLETSCHER || y > schneeGrenze) {
        if (up < 0.6) return n2 < 0.5 ? C_FELS_D : C_FELS;
        if (up < 0.8 && n2 < 0.35) return C_GEROELL;
        if (n2 > 0.72) return C_EIS;
        return n1 > 0.5 ? C_SCHNEE : C_SCHNEE_S;
      }
      if (up < 0.56) return n2 < 0.45 ? C_FELS_D : n2 < 0.8 ? C_FELS : C_FELS_H;
      let gr: RGB;
      if (zone === TAL) gr = mixRgb(C_WIESE, C_WIESE_D, n1);
      else if (zone === WALD) gr = mixRgb(C_WALDBODEN, C_WALDBODEN_D, n1);
      else gr = mixRgb(C_ALM, C_ALM_D, n1);
      // oberhalb der Baumgrenze: Matten mit Geröll
      if (y > 62) gr = mixRgb(gr, C_GEROELL, smooth((y - 62) / 12) * (0.4 + n2 * 0.6));
      if (up < 0.74) gr = mixRgb(shade(gr, 0.86), C_FELS, n2 * 0.5);
      // Blumen färben die Wiese stellenweise (Löwenzahn gelb, Enzian blau, Knöterich rosa)
      if (zone !== WALD && up > 0.85 && y < 66) {
        const n3 = noise(x * 0.09 + 11, z * 0.09 - 3);
        if (n3 > 0.74) gr = mixRgb(gr, n1 > 0.5 ? rgb(0xe6d65a) : rgb(0xd7b6dc), smooth((n3 - 0.74) / 0.12) * 0.45);
      }
      return gr;
    };
    const P = (v: number): V3 => [gx0 + (v % GW) * CELL, hY[v], gz0 + Math.floor(v / GW) * CELL];
    const tri = (a: number, b: number, c: number): void => {
      const da = hY[a] - wY[a];
      const db = hY[b] - wY[b];
      const dc = hY[c] - wY[c];
      if (Math.max(da, db, dc) < 0.04) return;
      if (unterBahn[a] && unterBahn[b] && unterBahn[c]) return;
      const A = P(a);
      const B = P(b);
      const C = P(c);
      const ux = B[0] - A[0];
      const uy = B[1] - A[1];
      const uz = B[2] - A[2];
      const vx = C[0] - A[0];
      const vy = C[1] - A[1];
      const vz = C[2] - A[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const up = ny / (Math.hypot(nx, ny, nz) || 1);
      // Gebiet der höchsten eigenen Ecke
      let q = qV[a];
      let best = da;
      if (db > best && qV[b] >= 0) {
        best = db;
        q = qV[b];
      }
      if (dc > best && qV[c] >= 0) q = qV[c];
      if (q < 0) q = qV[a] >= 0 ? qV[a] : qV[b] >= 0 ? qV[b] : qV[c];
      const zone = q >= 0 ? gebiet[q] : TAL;
      const cx = (A[0] + B[0] + C[0]) / 3;
      const cz = (A[2] + B[2] + C[2]) / 3;
      const col = farbe(zone, (A[1] + B[1] + C[1]) / 3, up, cx, cz);
      bodenB.tri(A, B, C, shade(col, 0.95 + rnd() * 0.08));
    };
    for (let iz = 0; iz < GZ; iz++) {
      for (let ix = 0; ix < GX; ix++) {
        const a = iz * GW + ix;
        const b = a + 1;
        const c = a + GW + 1;
        const d = a + GW;
        if ((ix + iz) % 2 === 0) {
          tri(a, d, c);
          tri(a, c, b);
        } else {
          tri(a, d, b);
          tri(b, d, c);
        }
      }
    }
  }

  // =====================================================================================
  // Bergpanorama rundum und Talboden
  // =====================================================================================
  {
    const sun = new THREE.Vector3(th.sunDir[0], th.sunDir[1], th.sunDir[2]).normalize();
    const dunst = rgb(th.fog);
    const horizont = rgb(th.sky[2]);
    const cx = world.center.x;
    const cz = world.center.z;
    const y0 = farY - 14;
    const ROCK = rgb(0x5d6676);
    const ROCK_H = rgb(0x7b8392);
    const ROCK_W = rgb(0x7a7268);
    const SNOW = rgb(0xfbfdff);
    const SNOW_S = rgb(0xd2deee);
    const ICE = rgb(0xcde8f6);
    const FOREST = rgb(0x3e6648);
    const MEADOW = rgb(0x6f9a52);
    const peaks: { x: number; z: number; H: number; R: number }[] = [];
    const nM = hi ? 15 : 12;
    // Leitgipfel: hinter der Startgeraden, hinter dem Gipfel (Blick beim Gleitflug) und gegenüber
    const leit = [Math.atan2(t.tz[0], t.tx[0]), Math.atan2(t.pz[t.landmark] - cz, t.px[t.landmark] - cx) + 0.5, Math.atan2(t.pz[t.landmark] - cz, t.px[t.landmark] - cx) + Math.PI + 0.3];
    for (let m = 0; m < nM; m++) {
      const lead = m < leit.length;
      const a = lead ? leit[m] : (m / nM) * TAU + (rnd() - 0.5) * 0.22;
      if (!lead && leit.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.28)) continue;
      const D = lead ? 640 + rnd() * 80 : 700 + rnd() * 380 + (m % 3 === 0 ? 120 : 0);
      const mx = cx + Math.cos(a) * D;
      const mz = cz + Math.sin(a) * D;
      const Hm = lead ? 470 + rnd() * 90 : 250 + rnd() * 240 + (m % 4 === 1 ? 100 : 0);
      // Massiv: Hauptgipfel und Nebengipfel quer zur Blickrichtung
      const tx = -Math.sin(a);
      const tz = Math.cos(a);
      peaks.push({ x: mx, z: mz, H: Hm, R: Hm * (0.95 + rnd() * 0.3) });
      const nb = hi ? 2 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 2);
      for (let b = 0; b < nb; b++) {
        const side = (b % 2 ? 1 : -1) * (0.55 + rnd() * 0.5);
        const back = (rnd() - 0.3) * 0.4;
        const H2 = Hm * (0.5 + rnd() * 0.32);
        peaks.push({ x: mx + tx * Hm * side + Math.cos(a) * Hm * back, z: mz + tz * Hm * side + Math.sin(a) * Hm * back, H: H2, R: H2 * (1 + rnd() * 0.35) });
      }
    }
    const nSide = hi ? 8 : 7;
    const F = hi ? [0, 0.24, 0.48, 0.7, 0.88] : [0, 0.3, 0.6, 0.85];
    const RF = hi ? [1, 0.72, 0.46, 0.24, 0.08] : [1, 0.62, 0.3, 0.07];
    for (const p of peaks) {
      const ring: V3[][] = [];
      const rot = rnd() * TAU;
      const jit0: number[] = [];
      for (let i = 0; i < nSide; i++) jit0.push(0.75 + rnd() * 0.5);
      for (let j = 0; j < F.length; j++) {
        const r: V3[] = [];
        for (let i = 0; i < nSide; i++) {
          const a = rot + (i / nSide) * TAU + (rnd() - 0.5) * 0.25;
          const rr = p.R * RF[j] * jit0[i] * (0.85 + 0.3 * rnd());
          r.push([p.x + Math.cos(a) * rr, y0 + (p.H + 14) * F[j] * (0.92 + 0.16 * rnd()), p.z + Math.sin(a) * rr]);
        }
        ring.push(r);
      }
      const apex: V3 = [p.x + (rnd() - 0.5) * p.R * 0.1, y0 + p.H + 14, p.z + (rnd() - 0.5) * p.R * 0.1];
      const snowY = 115 + rnd() * 70;
      const iceCol = Math.floor(rnd() * nSide);
      const ribs = Math.floor(rnd() * 3);
      const dist = Math.hypot(p.x - cx, p.z - cz);
      const hz0 = 0.05 + 0.22 * smooth((dist - 600) / 700);
      /** Farbe einer Fläche aus Lage, Höhe und Licht; Dunst je Ecke nach Höhe. */
      const flaeche = (A: V3, B: V3, C: V3, i: number, j: number, top: boolean): void => {
        const ux = B[0] - A[0];
        const uy = B[1] - A[1];
        const uz = B[2] - A[2];
        const vx = C[0] - A[0];
        const vy = C[1] - A[1];
        const vz = C[2] - A[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        // nach außen zeigen lassen
        const mx = (A[0] + B[0] + C[0]) / 3 - p.x;
        const mz = (A[2] + B[2] + C[2]) / 3 - p.z;
        let flip = false;
        if (nx * mx + nz * mz + ny * 0.3 < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
          flip = true;
        }
        const y = (A[1] + B[1] + C[1]) / 3;
        let col: RGB;
        // Felsrippen bleiben bis kurz unter den Gipfel schneefrei
        const rib = (i + ribs) % 3 === 0 && y < y0 + (p.H + 14) * 0.82;
        const snow = !rib && y > snowY - (ny > 0.55 ? 60 : 0) && ny > 0.28;
        if (top || snow) col = j % 2 ? SNOW : mixRgb(SNOW, SNOW_S, 0.25);
        else if ((i === iceCol || i === (iceCol + 1) % nSide) && y > snowY - 110) col = ICE;
        else if (y < 30 && ny > 0.4) col = mixRgb(FOREST, MEADOW, smooth((y - 10) / 30));
        else col = (i + j) % 2 ? ROCK : (i % 3 === 1 ? ROCK_W : ROCK_H);
        const lit = n0(nx * sun.x + ny * sun.y + nz * sun.z);
        let c = shade(col, 0.56 + 0.6 * lit);
        if (lit < 0.2) c = mixRgb(c, rgb(0x7f97c4), 0.22);
        const vc = (P: V3): RGB => {
          const low = 1 - smooth((P[1] - y0) / (p.H * 0.42));
          return mixRgb(c, low > 0.5 ? horizont : dunst, Math.min(0.94, hz0 + low * 0.7));
        };
        if (flip) fern.tri(A, C, B, vc(A), vc(C), vc(B));
        else fern.tri(A, B, C, vc(A), vc(B), vc(C));
      };
      for (let j = 0; j + 1 < ring.length; j++) {
        for (let i = 0; i < nSide; i++) {
          const q = (i + 1) % nSide;
          flaeche(ring[j][i], ring[j][q], ring[j + 1][q], i, j, false);
          flaeche(ring[j][i], ring[j + 1][q], ring[j + 1][i], i, j, false);
        }
      }
      const topR = ring[ring.length - 1];
      for (let i = 0; i < nSide; i++) flaeche(topR[i], topR[(i + 1) % nSide], apex, i, F.length, true);
    }

    // Talboden außerhalb des Geländerasters: Felder, Waldinseln, Höfe, ein See mit Fluss
    const gx1 = gx0 + GX * CELL;
    const gz1 = gz0 + GZ * CELL;
    const draussen = (x: number, z: number, r: number): boolean => x < gx0 - r || x > gx1 + r || z < gz0 - r || z > gz1 + r;
    const yT = farY - 0.2 + 0.45;
    const FELD = [rgb(0xd8c46a), rgb(0x9ccd5a), rgb(0x6fae45), rgb(0xb5a46a), rgb(0x86bf52), rgb(0xe2d48a)];
    // See
    let seeX = 0;
    let seeZ = 0;
    {
      const a = Math.atan2(t.pz[t.landmark] - cz, t.px[t.landmark] - cx) + 0.35;
      for (let d = 470; d < 640; d += 10) {
        seeX = cx + Math.cos(a) * d;
        seeZ = cz + Math.sin(a) * d;
        if (draussen(seeX, seeZ, 95)) break;
      }
      const n = 18;
      const rx = 110;
      const rz = 62;
      const rot = a + Math.PI / 2;
      const c0: V3 = [seeX, yT + 0.05, seeZ];
      const pt = (k: number, f: number, y: number): V3 => {
        const b = (k / n) * TAU;
        const wob = 1 + 0.12 * Math.sin(b * 3 + 1.3);
        const lx = Math.cos(b) * rx * f * wob;
        const lz = Math.sin(b) * rz * f * wob;
        return [seeX + lx * Math.cos(rot) - lz * Math.sin(rot), y, seeZ + lx * Math.sin(rot) + lz * Math.cos(rot)];
      };
      for (let k = 0; k < n; k++) {
        matt.to(c0, pt(k, 0.82, yT + 0.05), pt(k + 1, 0.82, yT + 0.05), rgb(0x2f78b8), [seeX, -1e4, seeZ]);
        matt.qo(pt(k, 0.82, yT + 0.05), pt(k, 1, yT + 0.05), pt(k + 1, 1, yT + 0.05), pt(k + 1, 0.82, yT + 0.05), rgb(0x5aa8d8), [seeX, -1e4, seeZ]);
        deko.qo(pt(k, 1, yT), pt(k, 1.12, yT), pt(k + 1, 1.12, yT), pt(k + 1, 1, yT), rgb(0xcfc29a), [seeX, -1e4, seeZ]);
      }
      // Fluss aus dem See, in Schleifen zum Rand
      let x = seeX + Math.cos(a + 0.3) * rx;
      let z = seeZ + Math.sin(a + 0.3) * rx;
      let dir = a + 0.9;
      for (let s = 0; s < (hi ? 46 : 28); s++) {
        const nx2 = x + Math.cos(dir) * 26;
        const nz2 = z + Math.sin(dir) * 26;
        const px2 = -Math.sin(dir) * 5;
        const pz2 = Math.cos(dir) * 5;
        if (draussen(x, z, 8) && draussen(nx2, nz2, 8))
          matt.qo([x - px2, yT + 0.05, z - pz2], [x + px2, yT + 0.05, z + pz2], [nx2 + px2, yT + 0.05, nz2 + pz2], [nx2 - px2, yT + 0.05, nz2 - pz2], rgb(0x3f8fcc), [x, -1e4, z]);
        x = nx2;
        z = nz2;
        dir += Math.sin(s * 0.9) * 0.45 + 0.03;
      }
    }
    // Felder
    const nF = hi ? 90 : 46;
    for (let k = 0, tries = 0; k < nF && tries < nF * 8; tries++) {
      const a = rnd() * TAU;
      const d = 360 + rnd() * 330;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const w = 34 + rnd() * 50;
      const l = 40 + rnd() * 70;
      if (!draussen(x, z, Math.max(w, l) * 0.6)) continue;
      if (Math.hypot(x - seeX, z - seeZ) < 140) continue;
      const rot = a + (rnd() < 0.5 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.3;
      deko.at(x, yT, z, rot);
      const col = pick(FELD);
      deko.quad([-w / 2, 0, l / 2], [w / 2, 0, l / 2], [w / 2, 0, -l / 2], [-w / 2, 0, -l / 2], col);
      // Hecke an einer Seite
      if (rnd() < 0.5) deko.box(-w / 2, 1.5, 0, 3, 3, l, rgb(0x4f8a3c));
      k++;
    }
    // Waldinseln und Höfe
    const nW = hi ? 18 : 12;
    for (let k = 0, tries = 0; k < nW && tries < nW * 10; tries++) {
      const a = rnd() * TAU;
      const d = 340 + rnd() * 330;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!draussen(x, z, 30)) continue;
      if (Math.hypot(x - seeX, z - seeZ) < 130) continue;
      const nT = hi ? 8 : 5;
      for (let j = 0; j < nT; j++) {
        const tx = x + (rnd() - 0.5) * 50;
        const tz = z + (rnd() - 0.5) * 50;
        const H = 12 + rnd() * 8;
        deko.at(tx, yT, tz, rnd() * TAU);
        deko.prism(0, 0, 0, H * 0.3, 0, H, 5, jit(C_FICHTE_D, 0.15));
      }
      if (k % 3 === 0) {
        // Hof: Haus und Stadel
        const hx = x + 40;
        const hz = z + 10;
        if (draussen(hx, hz, 10)) {
          deko.at(hx, yT, hz, a);
          deko.box(0, 3, 0, 9, 6, 12, C_PUTZ, C_DACH_ROT);
          deko.prism(0, 6, 0, 7.6, 0, 3.4, 4, C_DACH_ROT, C_DACH_ROT_D, undefined, Math.PI / 4);
          deko.box(12, 3.5, 0, 8, 7, 14, C_HOLZ_ALT);
        }
      }
      k++;
    }
    // Baumgruppen auf dem buckligen Talboden innerhalb des Rasters (unter dem Flugkorridor gut zu sehen)
    const nG = hi ? 34 : 16;
    for (let k = 0, tries = 0; k < nG && tries < nG * 12; tries++) {
      const x = gx0 + rnd() * GX * CELL;
      const z = gz0 + rnd() * GZ * CELL;
      const g = grund(x, z);
      if (g > farY + 12 || kante(x, z) < 50) continue;
      const nT = hi ? 7 : 4;
      for (let j = 0; j < nT; j++) {
        const tx = x + (rnd() - 0.5) * 30;
        const tz = z + (rnd() - 0.5) * 30;
        const ty = grund(tx, tz);
        if (ty > farY + 14 || eben(tx, tz) < 0.75) continue;
        const H = 10 + rnd() * 7;
        deko.at(tx, ty - 0.3, tz, rnd() * TAU);
        deko.prism(0, 0, 0, H * 0.27, 0, H, 5, jit(C_FICHTE, 0.2));
      }
      k++;
    }
  }

  // =====================================================================================
  // Bäume: Fichten am Hang, Laubbäume im Tal
  // =====================================================================================
  /** Fichte der Höhe H am Boden (x, y, z). */
  const fichte = (x: number, y: number, z: number, H: number): void => {
    const R = H * (0.22 + rnd() * 0.05);
    deko.at(x, y - 0.25, z, rnd() * TAU);
    deko.prism(0, 0, 0, 0.05 * H + 0.12, 0.03 * H + 0.08, H * 0.3, 3, C_STAMM, undefined, null);
    const tiers = H > 10 && hi ? 4 : 3;
    const a = jit(C_FICHTE, 0.16);
    const b = jit(C_FICHTE_D, 0.16);
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers;
      deko.prism(0, H * (0.15 + f * 0.62), 0, R * (1 - f * 0.66), 0, H * (0.44 - f * 0.06), 5, i % 2 ? a : b, i === tiers - 1 ? C_FICHTE_H : undefined, undefined, rnd() * TAU);
    }
  };
  /** Laubbaum (Ahorn, Linde) der Höhe H. */
  const laubbaum = (x: number, y: number, z: number, H: number): void => {
    deko.at(x, y - 0.25, z, rnd() * TAU);
    deko.prism(0, 0, 0, 0.32, 0.2, H * 0.55, 5, C_STAMM, undefined, null);
    const c = pick(C_LAUB);
    const r = H * 0.34;
    geo(bodenB, G.ico, c, x, y + H * 0.62, z, rnd(), rnd() * 3, 0, r, r * 0.85, r);
    if (hi && H > 9.5) geo(bodenB, G.ico, shade(c, 0.9), x + (rnd() - 0.5) * r, y + H * 0.82, z + (rnd() - 0.5) * r, rnd(), rnd() * 3, 0, r * 0.7, r * 0.6, r * 0.7);
  };

  // =====================================================================================
  // Dorf um Start und Ziel
  // =====================================================================================
  /** Fenster mit Läden auf einer Wand (lokal im Rahmen von k), Mitte (x, y), Wandebene z = zw, Normale nach +z (dir = 1) bzw. −z. */
  const fenster = (k: Kit, x: number, y: number, zw: number, dir: number, laden: RGB, w = 0.85, h = 1.05): void => {
    const z = zw + dir * 0.03;
    const q = (a: number, b: number, c: number, d: number, col: RGB, dz = 0): void => {
      const zz = z + dir * dz;
      if (dir > 0) k.quad([a, c, zz], [b, c, zz], [b, d, zz], [a, d, zz], col);
      else k.quad([b, c, zz], [a, c, zz], [a, d, zz], [b, d, zz], col);
    };
    q(x - w / 2 - 0.08, x + w / 2 + 0.08, y - h / 2 - 0.08, y + h / 2 + 0.08, C_WEISS);
    q(x - w / 2, x + w / 2, y - h / 2, y + h / 2, C_FENSTER, 0.01);
    q(x - 0.04, x + 0.04, y - h / 2, y + h / 2, C_WEISS, 0.02);
    q(x - w / 2 - 0.08 - w * 0.5, x - w / 2 - 0.1, y - h / 2, y + h / 2, laden, 0.01);
    q(x + w / 2 + 0.1, x + w / 2 + 0.08 + w * 0.5, y - h / 2, y + h / 2, laden, 0.01);
  };
  /** Wie fenster, aber auf einer Seitenwand (Ebene x = xw, Normale ±x), Mitte (z, y). */
  const fensterSeite = (k: Kit, z: number, y: number, xw: number, dir: number, laden: RGB): void => {
    const x = xw + dir * 0.03;
    const q = (a: number, b: number, c: number, d: number, col: RGB, dx = 0): void => {
      const xx = x + dir * dx;
      if (dir > 0) k.quad([xx, c, b], [xx, c, a], [xx, d, a], [xx, d, b], col);
      else k.quad([xx, c, a], [xx, c, b], [xx, d, b], [xx, d, a], col);
    };
    q(z - 0.5, z + 0.5, y - 0.6, y + 0.6, C_WEISS);
    q(z - 0.42, z + 0.42, y - 0.52, y + 0.52, C_FENSTER, 0.01);
    q(z - 0.92, z - 0.52, y - 0.52, y + 0.52, laden, 0.01);
    q(z + 0.52, z + 0.92, y - 0.52, y + 0.52, laden, 0.01);
  };
  /** Geranien in einem Blumenkasten von a nach b (lokal, Oberkante y). */
  const geranien = (k: Kit, x0: number, x1: number, y: number, z: number): void => {
    k.box((x0 + x1) / 2, y - 0.14, z, x1 - x0, 0.28, 0.3, C_HOLZ_D);
    const n = Math.max(2, Math.round((x1 - x0) / (hi ? 0.68 : 0.95)));
    const col = pick(C_GERANIE);
    for (let j = 0; j < n; j++) {
      const x = x0 + ((j + 0.5) / n) * (x1 - x0);
      k.octa(x, y + 0.12, z + (j % 2 ? 0.06 : -0.04), 0.27, 0.2, 0.22, j % 3 === 2 && hi ? C_LAUBGRUEN : col);
    }
  };
  /** Steine auf einem flachen Dach (Rahmen k), Reihen entlang z. */
  const dachSteine = (k: Kit, x0: number, x1: number, y0: number, y1: number, zA: number, zB: number): void => {
    for (let r = 0; r < 2; r++) {
      const f = 0.3 + r * 0.38;
      const x = x0 + (x1 - x0) * f;
      const y = y0 + (y1 - y0) * f;
      for (let z = zA + r * 1.1; z <= zB; z += 2.2) k.prism(x + (rnd() - 0.5) * 0.3, y - 0.05, z + (rnd() - 0.5) * 0.4, 0.34, 0, 0.36, 4, jit(C_STEIN, 0.18), C_STEIN_D, undefined, rnd());
    }
  };

  /**
   * Chalet: Giebel mit Balkon nach lokal +z (zur Straße), Breite w, Tiefe d. Steht auf einem
   * Bruchsteinsockel bis hinunter zum Hang. Flaches Satteldach mit weitem Überstand und Steinen.
   */
  const chalet = (x: number, z: number, yaw: number, w: number, d: number, laden: RGB, drei = false): void => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    let gMax = -Infinity;
    let gMin = Infinity;
    for (const [a, b] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
      [0, 0],
    ]) {
      const g = grund(x + a * c + b * s, z - a * s + b * c);
      gMax = Math.max(gMax, g);
      gMin = Math.min(gMin, g);
    }
    const y0 = gMax + 0.15;
    const so = y0 - gMin + 0.6;
    bau.at(x, y0, z, yaw);
    deko.like(bau);
    const holz = pick([C_HOLZ, C_HOLZ_H, shade(C_HOLZ, 0.88)]);
    const h1 = 2.9;
    const h2 = 2.7;
    const h3 = drei ? 2.6 : 0;
    // Sockel, gemauertes Erdgeschoss, Holz darüber
    bau.box(0, 0.35 - so / 2, 0, w + 0.3, so + 0.7, d + 0.3, C_SOCKEL);
    bau.box(0, 0.7 + h1 / 2, 0, w, h1, d, C_PUTZ);
    if (drei) bau.box(0, 0.7 + h1 + h3 / 2, 0, w, h3, d, C_PUTZ_S);
    const yO = 0.7 + h1 + h3;
    bau.box(0, yO + h2 / 2, 0, w + 0.12, h2, d + 0.12, holz);
    const yE = yO + h2;
    const pitch = 0.42;
    const ox = w / 2 + 1.0;
    const oz = d / 2 + 1.3;
    const yR = yE + (w / 2) * pitch + 0.25;
    const yV = yR - ox * pitch;
    // Giebel (Holz, mit Brettfugen)
    bau.tri([-w / 2 - 0.06, yE, d / 2 + 0.06], [w / 2 + 0.06, yE, d / 2 + 0.06], [0, yR - 0.1, d / 2 + 0.06], holz);
    bau.tri([w / 2 + 0.06, yE, -d / 2 - 0.06], [-w / 2 - 0.06, yE, -d / 2 - 0.06], [0, yR - 0.1, -d / 2 - 0.06], holz);
    // Dach: Flächen oben, Untersicht aus Holz, Stirnbretter
    const dach = pick([C_DACH, C_DACH_D, rgb(0x6a5a50)]);
    for (const sg of [-1, 1]) {
      const A: V3 = [0, yR, oz];
      const B: V3 = [sg * ox, yV, oz];
      const C: V3 = [sg * ox, yV, -oz];
      const D: V3 = [0, yR, -oz];
      if (sg > 0) {
        bau.quad(A, B, C, D, dach);
        bau.quad(D, C, B, A, C_HOLZ_D);
      } else {
        bau.quad(D, C, B, A, dach);
        bau.quad(A, B, C, D, C_HOLZ_D);
      }
      // Stirnbrett vorn und hinten
      for (const zz of [oz, -oz]) bau.ql([0, yR + 0.02, zz], [sg * ox, yV + 0.02, zz], [sg * ox, yV - 0.24, zz], [0, yR - 0.24, zz], C_WEISS, [0, yR - 1, zz * 0.8]);
    }
    if (hi) dachSteine(deko, 0, ox, yR, yV, -oz + 0.8, oz - 0.8);
    if (hi) dachSteine(deko, 0, -ox, yR, yV, -oz + 0.8, oz - 0.8);
    // Kamin
    bau.box(-w * 0.22, yR - 0.2, -d * 0.18, 0.7, 2.0, 0.7, C_PUTZ_S, C_DUNKEL);
    // Balkon vorn im Obergeschoss: Boden, Konsolen, Brüstung, Blumenkasten
    const bw = w - 0.4;
    const bz = d / 2 + 1.35;
    deko.box(0, yO + 0.08, d / 2 + 0.7, bw, 0.16, 1.4, C_HOLZ_D);
    for (const xx of [-bw / 2 + 0.4, bw / 2 - 0.4]) deko.beam([xx, yO - 0.7, d / 2 + 0.05], [xx, yO, d / 2 + 1.2], 0.16, C_HOLZ_D);
    bau.box(0, yO + 0.62, bz, bw, 0.95, 0.1, holz);
    for (const sg of [-1, 1]) bau.box((sg * bw) / 2, yO + 0.62, d / 2 + 0.7, 0.1, 0.95, 1.3, holz);
    if (hi) for (let xx = -bw / 2 + 0.3; xx < bw / 2 - 0.2; xx += 0.5) deko.quad([xx - 0.06, yO + 0.25, bz + 0.06], [xx + 0.06, yO + 0.25, bz + 0.06], [xx + 0.06, yO + 0.98, bz + 0.06], [xx - 0.06, yO + 0.98, bz + 0.06], C_HOLZ_D);
    geranien(deko, -bw / 2 + 0.2, bw / 2 - 0.2, yO + 1.25, bz + 0.12);
    // Fenster und Türen: vorn
    const nfw = w > 9 ? 3 : 2;
    for (let f = 0; f < nfw; f++) {
      const fx = -w / 2 + ((f + 0.5) / nfw) * w;
      if (f === Math.floor(nfw / 2) && nfw === 3) {
        deko.quad([fx - 0.55, 0.7, d / 2 + 0.03], [fx + 0.55, 0.7, d / 2 + 0.03], [fx + 0.55, 2.8, d / 2 + 0.03], [fx - 0.55, 2.8, d / 2 + 0.03], C_HOLZ_D);
      } else fenster(deko, fx, 2.1, d / 2, 1, laden);
      if (drei) fenster(deko, fx, 0.7 + h1 + 1.35, d / 2, 1, laden);
      if (f === Math.floor(nfw / 2)) deko.quad([fx - 0.5, yO + 0.2, d / 2 + 0.1], [fx + 0.5, yO + 0.2, d / 2 + 0.1], [fx + 0.5, yO + 2.2, d / 2 + 0.1], [fx - 0.5, yO + 2.2, d / 2 + 0.1], C_FENSTER);
      else fenster(deko, fx, yO + 1.45, d / 2 + 0.06, 1, laden);
    }
    // Giebelfenster
    deko.quad([-0.35, yE + 0.2, d / 2 + 0.1], [0.35, yE + 0.2, d / 2 + 0.1], [0.35, yE + 1.0, d / 2 + 0.1], [-0.35, yE + 1.0, d / 2 + 0.1], C_FENSTER);
    if (hi) {
      // Seiten
      for (const sg of [-1, 1]) {
        for (let f = 0; f < 2; f++) {
          const fz = -d / 2 + ((f + 0.5) / 2) * d;
          if (f === 1) fensterSeite(deko, fz, 2.1, (sg * w) / 2, sg, laden);
          fensterSeite(deko, fz, yO + 1.4, (sg * (w + 0.12)) / 2, sg, laden);
        }
      }
      // Holzstapel unter dem Dachvorsprung
      if (rnd() < 0.6) {
        const sx0 = (rnd() < 0.5 ? -1 : 1) * (w / 2 + 0.45);
        deko.box(sx0, 0.75, -d * 0.1, 0.7, 1.5, d * 0.55, C_HOLZ_H, rgb(0xd8b080));
      }
    }
    sperre(x, z, Math.max(w, d) * 0.5 + 1.4);
    belege(x, z, Math.max(w, d) * 0.6 + 1);
  };

  /** Mensch (lokal am Boden, Blick nach +z). */
  const mensch = (x: number, y: number, z: number, yaw: number): void => {
    deko.at(x, y, z, yaw);
    const cloth = pick(TRACHT);
    deko.prism(0, 0, 0, 0.3, 0.18, 1.0, 4, cloth, undefined, null, Math.PI / 4);
    deko.prism(0, 1.0, 0, 0.2, 0.17, 0.45, 4, rnd() < 0.5 ? C_WEISS : pick(TRACHT), undefined, null, Math.PI / 4);
    deko.octa(0, 1.62, 0, 0.17, 0.2, 0.17, pick(HAUT));
    if (rnd() < 0.3) deko.prism(0, 1.76, 0, 0.26, 0.15, 0.1, 6, rgb(0x3f5a3a), undefined, rgb(0x2f4a2a));
  };

  const dorfSegs: number[] = [];
  {
    const a = segU(31.0);
    for (let i = a; i < N; i++) dorfSegs.push(i);
    for (let i = 0; i <= segU(3.55); i++) dorfSegs.push(i);
  }

  // Kirche mit Zwiebelturm: rechts der Startgeraden, Turm zum Start hin
  {
    const i = segU(1.55);
    const lat = t.wh[i] + 17;
    const x = LX(i, lat);
    const z = LZ(i, lat);
    const yaw = yawAt(i);
    const W = 9.5;
    const Lg = 17;
    let gMax = -Infinity;
    let gMin = Infinity;
    for (const [a, b] of [
      [-W / 2, -Lg / 2 - 3],
      [W / 2, -Lg / 2 - 3],
      [W / 2, Lg / 2 + 3],
      [-W / 2, Lg / 2 + 3],
    ]) {
      const g = grund(x + a * Math.cos(yaw) + b * Math.sin(yaw), z - a * Math.sin(yaw) + b * Math.cos(yaw));
      gMax = Math.max(gMax, g);
      gMin = Math.min(gMin, g);
    }
    const y0 = gMax + 0.2;
    const so = y0 - gMin + 0.6;
    bau.at(x, y0, z, yaw);
    deko.like(bau);
    const hW = 8.2;
    bau.box(0, 0.3 - so / 2, 0, W + 4, so + 0.6, Lg + 10, C_SOCKEL);
    bau.box(0, hW / 2 + 0.3, 0, W, hW, Lg, C_PUTZ);
    // steiles Dach
    const yE = hW + 0.3;
    const rise = 6.2;
    for (const sg of [-1, 1]) {
      const A: V3 = [0, yE + rise, Lg / 2 + 0.5];
      const B: V3 = [sg * (W / 2 + 0.6), yE - 0.4, Lg / 2 + 0.5];
      const C: V3 = [sg * (W / 2 + 0.6), yE - 0.4, -Lg / 2 - 0.5];
      const D: V3 = [0, yE + rise, -Lg / 2 - 0.5];
      if (sg > 0) bau.quad(A, B, C, D, C_DACH_ROT);
      else bau.quad(D, C, B, A, C_DACH_ROT_D);
    }
    for (const zz of [Lg / 2, -Lg / 2]) bau.tl([W / 2, yE, zz], [-W / 2, yE, zz], [0, yE + rise - 0.3, zz], C_PUTZ, [0, yE, 0]);
    // Apsis am hinteren Ende
    bau.prism(0, 0.3, Lg / 2, 3.8, 3.8, hW - 1, 8, C_PUTZ, C_PUTZ_S, null, 0);
    bau.prism(0, hW - 0.7, Lg / 2, 4.2, 0.3, 3.2, 8, C_DACH_ROT, C_DACH_ROT_D, undefined, 0);
    // Rundbogenfenster
    for (const sg of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        const fz = -Lg / 2 + 4.5 + f * 4.5;
        const xw = sg * (W / 2 + 0.03);
        const pts: V3[] = [
          [xw, 2.6, fz - 0.7],
          [xw, 2.6, fz + 0.7],
          [xw, 5.6, fz + 0.7],
          [xw, 6.3, fz],
          [xw, 5.6, fz - 0.7],
        ];
        deko.ql(pts[0], pts[1], pts[2], pts[4], C_FENSTER, [0, 4, fz]);
        deko.tl(pts[4], pts[2], pts[3], C_FENSTER, [0, 4, fz]);
      }
    }
    // Turm am vorderen Ende
    const TZ = -Lg / 2 - 2.4;
    const TW = 5;
    const TH = 21;
    bau.box(0, TH / 2 + 0.3, TZ, TW, TH, TW, C_PUTZ);
    bau.box(0, TH + 0.3, TZ, TW + 0.5, 0.5, TW + 0.5, C_PUTZ_S);
    // Eckquader und Schallfenster, Uhr
    for (let r = 0; r < 4; r++) {
      const a = (r * Math.PI) / 2;
      const nx = Math.sin(a);
      const nz = Math.cos(a);
      const tx = Math.cos(a);
      const tz = -Math.sin(a);
      const o = TW / 2 + 0.04;
      const cxz = (u: number, y: number): V3 => [nx * o + tx * u, y, TZ + nz * o + tz * u];
      deko.quad(cxz(-0.55, TH - 3.6), cxz(0.55, TH - 3.6), cxz(0.55, TH - 1.2), cxz(-0.55, TH - 1.2), C_DUNKEL);
      deko.tri(cxz(0.55, TH - 1.2), cxz(0, TH - 0.6), cxz(-0.55, TH - 1.2), C_DUNKEL);
      // Uhr: Zifferblatt und Zeiger
      const yc = TH - 6;
      const n = 10;
      for (let k = 0; k < n; k++) {
        const b0 = (k / n) * TAU;
        const b1 = ((k + 1) / n) * TAU;
        deko.tri(cxz(0, yc), cxz(Math.cos(b0) * 1.15, yc + Math.sin(b0) * 1.15), cxz(Math.cos(b1) * 1.15, yc + Math.sin(b1) * 1.15), C_WEISS);
      }
      const c2 = (u: number, y: number): V3 => {
        const P = cxz(u, y);
        return [P[0] + nx * 0.03, P[1], P[2] + nz * 0.03];
      };
      deko.quad(c2(-0.06, yc), c2(0.06, yc), c2(0.06, yc + 0.9), c2(-0.06, yc + 0.9), C_GOLD);
      deko.quad(c2(0, yc - 0.06), c2(0.7, yc - 0.06), c2(0.7, yc + 0.06), c2(0, yc + 0.06), C_GOLD);
    }
    // Zwiebelhaube: Tambour, Zwiebel, Laterne, kleine Zwiebel, Kugel und Kreuz
    const yT = TH + 0.55;
    const n8 = hi ? 8 : 6;
    bau.prism(0, yT, TZ, 2.3, 2.3, 1.4, n8, C_PUTZ_S, undefined, null, Math.PI / 8);
    const prof: [number, number][] = [
      [2.3, 0],
      [2.85, 0.9],
      [2.55, 2.0],
      [1.35, 3.1],
      [0.45, 3.9],
    ];
    for (let k = 0; k + 1 < prof.length; k++) bau.prism(0, yT + 1.4 + prof[k][1], TZ, prof[k][0], prof[k + 1][0], prof[k + 1][1] - prof[k][1], n8, C_KUPFER, C_KUPFER_D, null, Math.PI / 8);
    const yL = yT + 1.4 + 3.9;
    bau.prism(0, yL, TZ, 0.45, 0.45, 1.0, n8, C_PUTZ_S, undefined, null, Math.PI / 8);
    bau.prism(0, yL + 1.0, TZ, 0.5, 0.8, 0.45, n8, C_KUPFER, C_KUPFER_D, null, Math.PI / 8);
    bau.prism(0, yL + 1.45, TZ, 0.8, 0.12, 1.1, n8, C_KUPFER, C_KUPFER_D, undefined, Math.PI / 8);
    deko.octa(0, yL + 2.75, TZ, 0.22, 0.22, 0.22, C_GOLD);
    deko.box(0, yL + 3.7, TZ, 0.12, 1.6, 0.12, C_GOLD);
    deko.box(0, yL + 3.95, TZ, 0.12, 0.12, 0.9, C_GOLD);
    // Kirchhofmauer
    for (const sg of [-1, 1]) deko.box(sg * (W / 2 + 4), 0.6, 1, 0.5, 1.2, Lg + 12, C_PUTZ_S, C_DACH_ROT);
    sperre(x, z, 14);
    belege(x, z, 16);
  }

  // Dorfbrunnen und Maibaum am Platz links der Startgeraden
  {
    const i = segU(0.45);
    const lat = -(t.wh[i] + 6.5);
    const x = LX(i, lat);
    const z = LZ(i, lat);
    const y = grund(x, z);
    const yaw = yawAt(i);
    // gepflasterter Platz
    deko.at(x, 0, z, yaw);
    const nP = 10;
    for (let k = 0; k < nP; k++) {
      const a0 = (k / nP) * TAU;
      const a1 = ((k + 1) / nP) * TAU;
      const P = (a: number, r: number): V3 => {
        const lx = Math.cos(a) * r;
        const lz = Math.sin(a) * r * 1.5;
        const W = deko.p(lx, 0, lz);
        return [W[0], grund(W[0], W[2]) + 0.12, W[2]];
      };
      deko.to(P(a0, 0.01), P(a0, 4.8), P(a1, 4.8), k % 2 ? rgb(0xbdb3a2) : rgb(0xc9c0ae), [x, -1e4, z]);
    }
    bau.at(x, y + 0.1, z, yaw + Math.PI / 2);
    deko.like(bau);
    matt.like(bau);
    // Trog aus einem Stamm, Brunnenstock mit Rohr
    bau.box(0, 0.45, 0, 3.4, 0.9, 1.2, C_HOLZ, C_HOLZ_H);
    matt.quad([-1.5, 0.92, 0.42], [1.5, 0.92, 0.42], [1.5, 0.92, -0.42], [-1.5, 0.92, -0.42], C_WASSER);
    bau.box(1.5, 1.0, -0.8, 0.4, 2.0, 0.4, C_HOLZ_D, C_HOLZ_D);
    deko.beam([1.5, 1.7, -0.6], [1.1, 1.62, 0], 0.09, C_STAHL);
    matt.beam([1.1, 1.58, 0.0], [1.0, 0.92, 0.05], 0.06, C_WASSER_H);
    geranien(deko, -1.2, 0.6, 1.1, -0.66);
    sperre(x, z, 3);
    belege(x, z, 3);
    // Maibaum: blau-weiß gewunden, Kränze, Zunftzeichen, Fichtenkrone
    const mx = LX(i - 9, lat - 2);
    const mz = LZ(i - 9, lat - 2);
    const my = grund(mx, mz);
    bau.at(mx, my, mz, yaw);
    deko.like(bau);
    const MH = 27;
    const segs = hi ? 22 : 12;
    for (let k = 0; k < segs; k++) {
      const y0 = (k / segs) * MH;
      const r0 = 0.26 - (k / segs) * 0.14;
      const r1 = 0.26 - ((k + 1) / segs) * 0.14;
      bau.prism(0, y0, 0, r0, r1, MH / segs, 6, k % 2 ? C_BLAU : C_WEISS, k % 2 ? C_WEISS : C_BLAU, null, k * 0.5);
    }
    for (const yk of [10, 16.5, 22]) deko.prism(0, yk, 0, 1.15 - yk * 0.02, 1.15 - yk * 0.02, 0.38, 8, C_FICHTE, C_FICHTE_D, null);
    for (let k = 0; k < (hi ? 6 : 3); k++) {
      const yk = 6 + k * 2.4;
      const side = k % 2 ? 1 : -1;
      deko.beam([0, yk, 0], [side * 1.1, yk, 0], 0.07, C_HOLZ_D);
      bau.box(side * 1.45, yk - 0.35, 0, 0.9, 0.7, 0.08, pick([C_ROT, C_BLAU, C_GELB, C_GRUEN, C_WEISS]));
    }
    deko.prism(0, MH - 0.2, 0, 0.9, 0, 3.2, 6, C_FICHTE, C_FICHTE_D);
    sperre(mx, mz, 1.6);
    belege(mx, mz, 1.6);
  }

  // Chalets beidseits der Dorfstraße
  {
    const want = hi ? 14 : 10;
    let got = 0;
    const kandidaten: [number, number][] = [];
    for (let j = 0; j < dorfSegs.length; j += 13) {
      const i = dorfSegs[j];
      kandidaten.push([i, -1], [i, 1]);
    }
    // gemischt, aber mit festem Zufall
    for (let k = kandidaten.length - 1; k > 0; k--) {
      const r = Math.floor(rnd() * (k + 1));
      [kandidaten[k], kandidaten[r]] = [kandidaten[r], kandidaten[k]];
    }
    for (const [i, side] of kandidaten) {
      if (got >= want) break;
      const w = 7.6 + rnd() * 3.2;
      const d = 8.5 + rnd() * 3;
      for (let tr = 0; tr < 4; tr++) {
        const lat = side * (t.wh[i] + 4.2 + d / 2 + tr * 4 + rnd() * 3);
        const x = LX(i, lat);
        const z = LZ(i, lat);
        const r = Math.hypot(w, d) / 2 + 0.6;
        if (belegt(x, z, r)) continue;
        const y = grund(x, z);
        if (!frei(x, z, r, y - 1, 13)) continue;
        if (eben(x, z) < 0.6) continue;
        chalet(x, z, faceRoad(i, x, z) + (rnd() - 0.5) * 0.15, w, d, pick(C_LADEN), rnd() < 0.25);
        got++;
        break;
      }
    }
  }

  // Wimpelketten über der Startgeraden (Unterkante über LUFT)
  const pennants: [number, number][] = [];
  {
    const cols = [C_ROT, C_WEISS, C_GELB, C_BLAU, C_GRUEN, C_ORANGE];
    for (const u of [0.32, 0.62, 0.92, 1.25, 32.7, 33.25]) {
      const i = segU(u);
      if (i < 10 || i > N - 10) continue;
      const y = t.py[i];
      const ends: V3[] = [];
      for (const sg of [-1, 1]) {
        const lat = sg * (t.wh[i] + 1.3);
        const x = LX(i, lat);
        const z = LZ(i, lat);
        const g = grund(x, z);
        const top = y + 13.4;
        deko.at(x, g, z, 0);
        deko.prism(0, -0.3, 0, 0.13, 0.1, top - g + 0.3, 5, C_HOLZ_D, undefined, null);
        deko.octa(0, top - g + 0.1, 0, 0.18, 0.18, 0.18, C_GOLD);
        ends.push([x, top - 0.25, z]);
      }
      const [A, B] = ends;
      const n = hi ? 22 : 12;
      const sag = 1.2;
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        const P: V3 = [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f - sag * 4 * f * (1 - f), A[2] + (B[2] - A[2]) * f];
        if (k < n) {
          const f2 = (k + 1) / n;
          const Q: V3 = [A[0] + (B[0] - A[0]) * f2, A[1] + (B[1] - A[1]) * f2 - sag * 4 * f2 * (1 - f2), A[2] + (B[2] - A[2]) * f2];
          const M: V3 = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2 - 0.72, (P[2] + Q[2]) / 2];
          const col = cols[(k + pennants.length) % cols.length];
          bodenB.tri(P, Q, M, col);
          bodenB.tri(P, M, Q, shade(col, 0.85));
          // Schnur
          bodenB.tri(P, Q, [Q[0], Q[1] + 0.05, Q[2]], C_DUNKEL);
        }
      }
      pennants.push([i, 0]);
    }
  }

  // Leute im Dorf: hinter der Bande an Start und Ziel, am Brunnen
  {
    const want = hi ? 34 : 14;
    let got = 0;
    for (let k = 0; k < want * 10 && got < want; k++) {
      const j = Math.floor(rnd() * dorfSegs.length);
      const i = dorfSegs[j];
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + RAND + 0.4 + rnd() * 5);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      if (!platz(x, z, 0.4, 2, 0.7)) continue;
      mensch(x, grund(x, z), z, faceRoad(i, x, z) + (rnd() - 0.5) * 0.8);
      belege(x, z, 0.5);
      got++;
    }
  }

  // Laubbäume und Gärten im Tal
  {
    const want = hi ? 52 : 30;
    let got = 0;
    for (let k = 0; k < want * 12 && got < want; k++) {
      const j = Math.floor(rnd() * dorfSegs.length);
      const i = dorfSegs[j];
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 6 + rnd() * rnd() * 70);
      const x = LX(i, lat, (rnd() - 0.5) * 20);
      const z = LZ(i, lat, (rnd() - 0.5) * 20);
      const H = 7 + rnd() * 6;
      const y = grund(x, z);
      if (y < farY + 6) continue;
      if (!platz(x, z, 2.4, H, 0.7)) continue;
      laubbaum(x, y, z, H);
      belege(x, z, 2.6);
      got++;
    }
  }

  // =====================================================================================
  // Sommerrodelbahn: Talstation und Bergstation
  // =====================================================================================
  {
    const r = t.rails[0];
    if (r) {
      // Talstation: Holzhalle mit Kasse neben dem Bahnsteig (links), Rodel im Gestell, Wartegang
      const W = 8;
      const L = 16;
      let best = Infinity;
      let x = 0;
      let z = 0;
      let yaw = 0;
      for (let i = r.first - 6; i <= r.first + 26; i += 4) {
        for (const sg of [-1, 1]) {
          for (let off = 12.6; off < 22; off += 2.2) {
            const lat2 = sg * (t.wh[i] + off);
            const cx2 = LX(i, lat2);
            const cz2 = LZ(i, lat2);
            const yw = yawAt(i) - (sg * Math.PI) / 2;
            if (!frei(cx2, cz2, 9, grund(cx2, cz2) - 1, 8) || belegt(cx2, cz2, 9)) continue;
            const [lo, up] = hangUnter(cx2, cz2, yw, L, W);
            const cost = up - lo + off * 0.08 + Math.abs(i - r.first - 8) * 0.02;
            if (cost < best) {
              best = cost;
              x = cx2;
              z = cz2;
              yaw = yw;
            }
          }
        }
      }
      const y = grund(x, z);
      let gMin = y;
      for (const [a, b] of [
        [-W / 2, -L / 2],
        [W / 2, L / 2],
        [W / 2, -L / 2],
        [-W / 2, L / 2],
      ])
        gMin = Math.min(gMin, grund(x + a * Math.cos(yaw) + b * Math.sin(yaw), z - a * Math.sin(yaw) + b * Math.cos(yaw)));
      bau.at(x, y + 0.2, z, yaw);
      deko.like(bau);
      const so = y + 0.2 - gMin + 0.4;
      bau.box(0, -so / 2 + 0.1, 0, L + 0.4, so + 0.2, W + 0.4, C_SOCKEL);
      bau.box(0, 2.1, 0, L, 4.2, W, C_HOLZ);
      for (const sg of [-1, 1]) {
        const A: V3 = [L / 2 + 0.8, 7.0, 0];
        const B: V3 = [L / 2 + 0.8, 3.8, sg * (W / 2 + 1.3)];
        const C: V3 = [-L / 2 - 0.8, 3.8, sg * (W / 2 + 1.3)];
        const D: V3 = [-L / 2 - 0.8, 7.0, 0];
        if (sg > 0) {
          bau.quad(D, C, B, A, C_DACH_ROT);
          bau.quad(A, B, C, D, C_HOLZ_D);
        } else {
          bau.quad(A, B, C, D, C_DACH_ROT_D);
          bau.quad(D, C, B, A, C_HOLZ_D);
        }
      }
      for (const xx of [L / 2, -L / 2]) bau.tl([xx, 4.2, -W / 2], [xx, 4.2, W / 2], [xx, 6.8, 0], C_HOLZ_H, [0, 4.2, 0]);
      // Schild am Giebel zur Bahn: roter Rodel auf Weiß
      deko.box(0, 5.0, W / 2 + 0.25, 6, 1.4, 0.12, C_WEISS);
      deko.box(0, 5.0, W / 2 + 0.33, 2.2, 0.5, 0.06, C_ROT);
      deko.box(-0.8, 5.35, W / 2 + 0.36, 0.5, 0.4, 0.06, C_ROT);
      // Kassenfenster und Fenster
      for (let f = 0; f < 4; f++) fenster(deko, -L / 2 + 2 + f * 4, 2.3, W / 2, 1, C_LADEN[0], 1.2, 1.1);
      // Rodelgestell und Wartegang zur Bahn
      for (let k = 0; k < (hi ? 6 : 3); k++) {
        deko.box(-L / 2 + 2 + k * 1.1, 0.35 + (k % 2) * 0.05, W / 2 + 1.3, 0.7, 0.25, 1.4, k % 2 ? C_ROT : C_BLAU, C_DUNKEL);
      }
      sperre(x, z, Math.hypot(W, L) / 2 + 1);
      belege(x, z, Math.hypot(W, L) / 2 + 1);

      // Bergstation: offene Holzhalle über dem Ende der Schienen, Dach über LUFT
      const e1 = r.first + r.count - 1;
      const e0 = Math.max(r.first, e1 - 24);
      let yMax = -Infinity;
      let whMax = 0;
      for (let s = e0 - 2; s <= Math.min(T - 1, e1 + 4); s++) {
        yMax = Math.max(yMax, t.py[s] + Math.abs(t.bank[s]) * t.wh[s]);
        whMax = Math.max(whMax, t.wh[s]);
      }
      const latP = whMax + RAND + 0.4;
      const roofY = yMax + LUFT + 0.3;
      for (let s = e0; s <= e1; s += 6) {
        const si = Math.round(s);
        for (const sg of [-1, 1]) {
          const lat2 = sg * (t.wh[si] + RAND + 0.4);
          const px2 = LX(si, lat2);
          const pz2 = LZ(si, lat2);
          const g = grund(px2, pz2);
          if (!frei(px2, pz2, 0.3, g, roofY - g)) continue;
          deko.at(px2, g, pz2, yawAt(si));
          bau.like(deko);
          bau.box(0, (roofY - g) / 2 - 0.3, 0, 0.45, roofY - g + 0.6, 0.45, C_HOLZ);
          deko.beam([0, roofY - 1.4, -1.2], [0, roofY - 0.1, 0], 0.18, C_HOLZ_D);
          deko.beam([0, roofY - 1.4, 1.2], [0, roofY - 0.1, 0], 0.18, C_HOLZ_D);
        }
      }
      // Satteldach in Feldern längs der Bahn
      const ov = latP + 1.8;
      for (let s = e0 - 2; s < e1 + 2; s += 4) {
        const sa = Math.max(0, Math.round(s));
        const sb = Math.min(T - 1, Math.round(s + 4));
        const E = (sq: number, lat2: number, yy: number): V3 => [LX(sq, lat2), yy, LZ(sq, lat2)];
        const A1 = E(sa, -ov, roofY);
        const B1 = E(sb, -ov, roofY);
        const C1 = E(sb, 0, roofY + 3.2);
        const D1 = E(sa, 0, roofY + 3.2);
        const A2 = E(sa, ov, roofY);
        const B2 = E(sb, ov, roofY);
        const ref: V3 = [(A1[0] + A2[0]) / 2, roofY - 5, (A1[2] + A2[2]) / 2];
        bau.qo(A1, B1, C1, D1, C_DACH, ref);
        bau.qo(A2, B2, C1, D1, C_DACH_D, ref);
        // Untersicht
        const ref2: V3 = [(A1[0] + A2[0]) / 2, roofY + 9, (A1[2] + A2[2]) / 2];
        deko.qo(A1, B1, C1, D1, C_HOLZ_D, ref2);
        deko.qo(A2, B2, C1, D1, C_HOLZ_D, ref2);
      }
      // Giebelschild zur Ankunft
      {
        const sa = e0 - 2;
        const E = (lat2: number, yy: number): V3 => [LX(sa, lat2), yy, LZ(sa, lat2)];
        bau.to(E(-ov, roofY), E(ov, roofY), E(0, roofY + 3.2), C_HOLZ_H, [LX(sa, 0, 3), roofY + 1, LZ(sa, 0, 3)]);
        bau.qo(E(-3, roofY - 0.2), E(3, roofY - 0.2), E(3, roofY - 1.4), E(-3, roofY - 1.4), C_ROT, [LX(sa, 0, 3), roofY, LZ(sa, 0, 3)]);
      }
      for (let s = e0; s <= e1; s += 3) for (const sg of [-1, 1]) sperre(LX(s, sg * (t.wh[s] + RAND + 0.4)), LZ(s, sg * (t.wh[s] + RAND + 0.4)), 1.2);
    }
  }

  // =====================================================================================
  // Almen: Kühe, Heustadel, Schrägzäune, Blumen, Felsbrocken, hohes Gras
  // =====================================================================================
  const almSegs: number[] = [];
  for (let i = 0; i < T; i++) if (gebiet[i] === ALM && !(t.edge[i] & EDGE_DECK)) almSegs.push(i);

  /** Heustadel: verwittertes Holz, flaches Dach mit Steinen, Heu im Giebel. */
  const stadel = (x: number, z: number, yaw: number): void => {
    const W = 4.6;
    const L = 5.6;
    let gMin = Infinity;
    let gMax = -Infinity;
    for (const [a, b] of [
      [-W / 2, -L / 2],
      [W / 2, L / 2],
      [W / 2, -L / 2],
      [-W / 2, L / 2],
    ]) {
      const g = grund(x + a * Math.cos(yaw) + b * Math.sin(yaw), z - a * Math.sin(yaw) + b * Math.cos(yaw));
      gMin = Math.min(gMin, g);
      gMax = Math.max(gMax, g);
    }
    const y0 = gMax + 0.25;
    bau.at(x, y0, z, yaw);
    deko.like(bau);
    deko.box(0, -(y0 - gMin + 0.4) / 2 + 0.05, 0, W + 0.2, y0 - gMin + 0.5, L + 0.2, C_STEIN, C_STEIN_D);
    bau.box(0, 1.5, 0, W, 3, L, C_HOLZ_ALT);
    if (hi) for (let xx = -W / 2 + 0.5; xx < W / 2; xx += 0.55) deko.quad([xx, 0.05, L / 2 + 0.02], [xx + 0.06, 0.05, L / 2 + 0.02], [xx + 0.06, 2.95, L / 2 + 0.02], [xx, 2.95, L / 2 + 0.02], C_HOLZ_ALT_D);
    deko.quad([-0.7, 0, L / 2 + 0.03], [0.7, 0, L / 2 + 0.03], [0.7, 2.2, L / 2 + 0.03], [-0.7, 2.2, L / 2 + 0.03], C_HOLZ_ALT_D);
    const ox = W / 2 + 0.6;
    const oz = L / 2 + 0.6;
    const yR = 3 + (W / 2) * 0.5;
    const yV = yR - ox * 0.5;
    for (const sg of [-1, 1]) {
      const A: V3 = [0, yR, oz];
      const B: V3 = [sg * ox, yV, oz];
      const C: V3 = [sg * ox, yV, -oz];
      const D: V3 = [0, yR, -oz];
      if (sg > 0) {
        bau.quad(A, B, C, D, rgb(0x6f655c));
        bau.quad(D, C, B, A, C_HOLZ_ALT_D);
      } else {
        bau.quad(D, C, B, A, rgb(0x5f564e));
        bau.quad(A, B, C, D, C_HOLZ_ALT_D);
      }
    }
    bau.tri([-W / 2, 3, L / 2], [W / 2, 3, L / 2], [0, yR - 0.05, L / 2], C_HOLZ_ALT);
    bau.tri([W / 2, 3, -L / 2], [-W / 2, 3, -L / 2], [0, yR - 0.05, -L / 2], C_HOLZ_ALT);
    deko.tri([-1.1, 3.1, L / 2 + 0.05], [1.1, 3.1, L / 2 + 0.05], [0, 3.85, L / 2 + 0.05], C_HEU);
    if (hi) {
      dachSteine(deko, 0, ox, yR, yV, -oz + 0.6, oz - 0.6);
      dachSteine(deko, 0, -ox, yR, yV, -oz + 0.6, oz - 0.6);
    }
    belege(x, z, 4.5);
    sperre(x, z, 3.6);
  };

  // Kühe (bewegt): Rumpf und Kopf getrennt, der Kopf senkt sich zum Grasen
  const kuehe: number[] = []; // Rumpf, Kopf, x, y, z, Drehung, Phase
  const kuhRumpf = (fleck: boolean): MeshBuilder => {
    const mb = new MeshBuilder();
    const k = new Kit(mb);
    const A = fleck ? C_KUH_W : C_KUH_B;
    const B = fleck ? C_KUH_R : C_KUH_BD;
    k.box(0, 1.08, 0.55, 0.9, 0.78, 0.62, fleck ? B : A);
    k.box(0, 1.1, -0.05, 0.94, 0.84, 0.62, A);
    k.box(0, 1.08, -0.62, 0.9, 0.8, 0.58, fleck ? B : A, fleck ? A : undefined);
    for (const [lx, lz] of [
      [-0.28, 0.62],
      [0.28, 0.62],
      [-0.28, -0.68],
      [0.28, -0.68],
    ])
      k.box(lx, 0.36, lz, 0.17, 0.72, 0.19, lz > 0 ? A : B, A);
    k.box(0, 0.64, -0.42, 0.34, 0.16, 0.34, rgb(0xf0b8b0));
    k.beam([0, 1.38, -0.92], [0.06, 0.52, -1.0], 0.06, B);
    return mb;
  };
  const kuhKopf = (fleck: boolean): MeshBuilder => {
    const mb = new MeshBuilder();
    const k = new Kit(mb);
    // Drehpunkt am Hals; der Kopf zeigt nach +z
    k.box(0, -0.02, 0.18, 0.46, 0.5, 0.42, fleck ? C_KUH_R : C_KUH_B);
    k.box(0, -0.06, 0.52, 0.4, 0.42, 0.34, fleck ? C_KUH_W : C_KUH_B);
    k.box(0, -0.16, 0.74, 0.36, 0.28, 0.14, C_MAUL);
    for (const sg of [-1, 1]) {
      k.beam([sg * 0.16, 0.18, 0.42], [sg * 0.34, 0.36, 0.44], 0.06, C_HORN);
      k.box(sg * 0.33, 0.06, 0.34, 0.2, 0.08, 0.13, fleck ? C_KUH_W : C_KUH_BD);
    }
    // Riemen und Glocke
    k.box(0, -0.24, 0.12, 0.5, 0.07, 0.08, C_RIEMEN);
    k.prism(0, -0.62, 0.12, 0.14, 0.09, 0.32, 6, C_GLOCKE, shade(C_GLOCKE, 0.8), C_GLOCKE);
    return mb;
  };
  {
    const want = hi ? 15 : 9;
    let hx = 0;
    let hz = 0;
    let herde = 0;
    for (let k = 0; k < want * 40 && kuehe.length / 7 < want; k++) {
      let x: number;
      let z: number;
      if (herde > 0) {
        // die nächste Kuh der Herde ein paar Meter daneben
        x = hx + (rnd() - 0.5) * 12;
        z = hz + (rnd() - 0.5) * 12;
      } else {
        const i = almSegs[Math.floor(rnd() * almSegs.length)];
        const side = rnd() < 0.5 ? -1 : 1;
        const lat = side * (t.wh[i] + 7 + rnd() * 16);
        x = LX(i, lat);
        z = LZ(i, lat);
      }
      const y = grund(x, z);
      if (y > 66 || !platz(x, z, 1.6, 2.2, 0.86)) {
        // Findet die Herde keinen Platz mehr, beginnt eine neue.
        if (herde > 0 && rnd() < 0.15) herde = 0;
        continue;
      }
      // Herde: ein, zwei Nachbarinnen in der Nähe
      if (herde > 0) herde--;
      else {
        hx = x;
        hz = z;
        herde = 1 + Math.floor(rnd() * 3);
      }
      const fleck = rnd() < 0.55;
      const yaw = rnd() * TAU;
      kuehe.push(mov.add(kuhRumpf(fleck)), mov.add(kuhKopf(fleck)), x, y - 0.05, z, yaw, rnd() * 50);
      belege(x, z, 1.8);
    }
  }
  // Heustadel
  {
    const want = hi ? 7 : 4;
    let got = 0;
    for (let k = 0; k < want * 40 && got < want; k++) {
      const i = almSegs[Math.floor(rnd() * almSegs.length)];
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 9 + rnd() * 30);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      if (grund(x, z) > 64) continue;
      if (!platz(x, z, 4, 6, 0.86)) continue;
      stadel(x, z, faceRoad(i, x, z) + (rnd() - 0.5) * 0.6);
      got++;
    }
  }
  // Schrägzäune: Stücke parallel zur Straße, ein Stück draußen auf der Alm
  {
    const want = hi ? 9 : 4;
    let got = 0;
    for (let k = 0; k < want * 20 && got < want; k++) {
      const i0 = almSegs[Math.floor(rnd() * almSegs.length)];
      const side = rnd() < 0.5 ? -1 : 1;
      const off = t.wh[i0] + 7 + rnd() * 10;
      const len = 26 + Math.floor(rnd() * 30);
      const pts: V3[] = [];
      let ok = true;
      for (let s = 0; s <= len && ok; s += 2.6) {
        const i = Math.min(T - 1, i0 + Math.round(s));
        if (gebiet[i] !== ALM || t.branchOf[i] !== t.branchOf[i0]) {
          ok = false;
          break;
        }
        const x = LX(i, side * off);
        const z = LZ(i, side * off);
        const y = grund(x, z);
        if (!frei(x, z, 0.3, y, 1.6) || belegt(x, z, 0.3) || eben(x, z) < 0.7) ok = false;
        pts.push([x, y, z]);
      }
      if (!ok || pts.length < 6) continue;
      for (let p = 0; p < pts.length; p++) {
        const [x, y, z] = pts[p];
        deko.at(x, y, z, 0);
        deko.beam([0, -0.2, 0], [0, 1.45, 0], 0.12, C_HOLZ_ALT_D);
        if (p + 1 < pts.length) {
          const [x2, y2, z2] = pts[p + 1];
          const dx = x2 - x;
          const dy = y2 - y;
          const dz = z2 - z;
          const l = Math.hypot(dx, dz) || 1;
          const nx = (-dz / l) * 0.05;
          const nz = (dx / l) * 0.05;
          for (let s = 0; s < 3; s++) {
            const f = s / 3;
            const ax = x + dx * f;
            const ay = y + dy * f + 0.25;
            const az = z + dz * f;
            const bx = x + dx * (f + 0.45);
            const by = y + dy * (f + 0.45) + 1.3;
            const bz = z + dz * (f + 0.45);
            const c = s % 2 ? C_HOLZ_ALT : C_HOLZ_H;
            // Latte: flaches Brett, von beiden Seiten sichtbar
            bodenB.quad([ax + nx, ay - 0.06, az + nz], [bx + nx, by - 0.06, bz + nz], [bx + nx, by + 0.06, bz + nz], [ax + nx, ay + 0.06, az + nz], c);
            bodenB.quad([ax + nx, ay + 0.06, az + nz], [bx + nx, by + 0.06, bz + nz], [bx + nx, by - 0.06, bz + nz], [ax + nx, ay - 0.06, az + nz], shade(c, 0.8));
          }
        }
        belege(x, z, 0.6);
      }
      got++;
    }
  }
  // Felsbrocken auf Almen, am Gletscher und im Wald
  {
    const want = hi ? 72 : 36;
    let got = 0;
    for (let k = 0; k < want * 10 && got < want; k++) {
      const i = Math.floor(rnd() * T);
      const z0 = gebiet[i];
      if (z0 === LUFTRAUM || z0 === TAL) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 5 + rnd() * 40);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      const r = 0.6 + rnd() * rnd() * 2.6;
      const y = grund(x, z);
      if (!platz(x, z, r, r * 1.6, 0.6)) continue;
      const c = jit(z0 === GLETSCHER ? C_FELS_D : C_FELS, 0.2);
      geo(bodenB, r > 1.4 ? G.dode : G.ico, c, x, y + r * 0.25, z, rnd() * 3, rnd() * 3, rnd() * 3, r, r * (0.55 + rnd() * 0.3), r * (0.8 + rnd() * 0.3));
      belege(x, z, r);
      got++;
    }
  }
  // Blumen: einzelne Blüten dicht an den Wegen der Almen und im Dorf
  {
    const want = hi ? 720 : 360;
    let got = 0;
    for (let k = 0; k < want * 4 && got < want; k++) {
      const i = Math.floor(rnd() * T);
      const z0 = gebiet[i];
      if (z0 !== ALM && z0 !== TAL) continue;
      if (t.edge[i] & EDGE_DECK) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 1.2 + rnd() * rnd() * 26);
      const x = LX(i, lat, (rnd() - 0.5) * 2);
      const z = LZ(i, lat, (rnd() - 0.5) * 2);
      const y = grund(x, z);
      if (y > 68 || kante(x, z) < 1.1) continue;
      if (!frei(x, z, 0.1, y, 0.5, 1.1)) continue;
      if (eben(x, z) < 0.75) continue;
      const col = pick(BLUMEN);
      const a = rnd() * TAU;
      const s = 0.13 + rnd() * 0.08;
      const h = 0.22 + rnd() * 0.25;
      const ca = Math.cos(a) * s;
      const sa = Math.sin(a) * s;
      bodenB.tri([x - ca, y + h, z - sa], [x + ca, y + h, z + sa], [x, y + h + s * 1.5, z], col);
      bodenB.tri([x - ca, y + h, z - sa], [x, y + h + s * 1.5, z], [x + ca, y + h, z + sa], col);
      if (hi && rnd() < 0.5) bodenB.tri([x - ca * 0.3, y, z - sa * 0.3], [x + ca * 0.3, y, z + sa * 0.3], [x, y + h, z], C_LAUBGRUEN);
      got++;
    }
  }
  // Hohes Gras neben der Almwiese (Abzweigung a)
  if (brA) {
    const want = hi ? 420 : 170;
    let got = 0;
    for (let k = 0; k < want * 4 && got < want; k++) {
      const i = brA.first + Math.floor(rnd() * brA.count);
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 0.9 + rnd() * rnd() * 9);
      const x = LX(i, lat, (rnd() - 0.5) * 2);
      const z = LZ(i, lat, (rnd() - 0.5) * 2);
      const y = grund(x, z);
      if (kante(x, z) < 0.8) continue;
      if (!frei(x, z, 0.2, y, 1.6, 0.8)) continue;
      // dicht an der Fahrbahn am höchsten
      const H = 0.9 + rnd() * 0.7 - Math.max(0, kante(x, z) - 3) * 0.05;
      const nb = 3;
      for (let b = 0; b < nb; b++) {
        const a = rnd() * TAU;
        const lean = 0.15 + rnd() * 0.3;
        const c = b === 2 && rnd() < 0.4 ? rgb(0xcdb862) : shade(pick(GRAS), 0.82);
        const bx = Math.cos(a) * 0.12;
        const bz = Math.sin(a) * 0.12;
        const tip: V3 = [x + Math.sin(a) * lean, y + H * (0.8 + rnd() * 0.3), z + Math.cos(a) * lean];
        bodenB.tri([x - bx, y - 0.1, z - bz], [x + bx, y - 0.1, z + bz], tip, c);
        bodenB.tri([x - bx, y - 0.1, z - bz], tip, [x + bx, y - 0.1, z + bz], shade(c, 0.85));
      }
      if (rnd() < 0.35) {
        // Margerite, Glockenblume oder Arnika über dem Gras
        const col = pick([C_WEISS, rgb(0x8f6ad8), C_GELB, rgb(0xf29a2e)]);
        deko.at(x + 0.15, y + H * 0.85, z, 0);
        deko.octa(0, 0, 0, 0.13, 0.08, 0.13, col, rgb(0xe8c840));
      }
      got++;
    }
  }
  // Fichten: Bergwald an der Abfahrt, einzelne Wetterfichten auf den Almen, Waldstreifen am Rodelhang
  {
    const plant = (want: number, filter: (i: number) => boolean, near: number, far: number, minY: number, maxY: number): void => {
      const pool: number[] = [];
      for (let i = 0; i < T; i++) if (filter(i)) pool.push(i);
      if (pool.length === 0) return;
      let got = 0;
      for (let k = 0; k < want * 8 && got < want; k++) {
        const i = pool[Math.floor(rnd() * pool.length)];
        const side = rnd() < 0.5 ? -1 : 1;
        const lat = side * (t.wh[i] + near + rnd() * rnd() * (far - near));
        const x = LX(i, lat, (rnd() - 0.5) * 3);
        const z = LZ(i, lat, (rnd() - 0.5) * 3);
        const y = grund(x, z);
        if (y < minY || y > maxY) continue;
        const H = 9 + rnd() * 8 - Math.max(0, y - 55) * 0.2;
        const r = H * 0.2;
        if (belegt(x, z, r, 0.7)) continue;
        if (!frei(x, z, r, y - 0.5, H)) continue;
        if (eben(x, z) < 0.62) continue;
        fichte(x, y, z, H);
        belege(x, z, r * 0.8);
        got++;
      }
    };
    plant(hi ? 215 : 130, (i) => gebiet[i] === WALD && !(t.edge[i] & EDGE_DECK), RAND + 1.6, 70, farY + 8, 66);
    plant(hi ? 26 : 12, (i) => gebiet[i] === ALM && !(t.edge[i] & EDGE_DECK), 12, 60, farY + 8, 64);
    plant(hi ? 40 : 20, (i) => (t.edge[i] & EDGE_RAIL) !== 0 || inU(i, 2.6, 4.2) || inU(i, 29.6, 31.2), RAND + 4, 60, farY + 8, 60);
  }

  // =====================================================================================
  // Gletscher und Gipfel
  // =====================================================================================
  const flags: number[] = []; // Teil, x, y, z, Drehung
  const flagGeo = (a: RGB, b: RGB, w = 2.2, h = 1.3): MeshBuilder => {
    const mb = new MeshBuilder();
    const k = new Kit(mb);
    const n = 4;
    for (let s = 0; s < n; s++) {
      const x0 = (s / n) * w;
      const x1 = ((s + 1) / n) * w;
      k.quad2([x0, -h, 0], [x1, -h, 0], [x1, 0, 0], [x0, 0, 0], s % 2 === 0 ? a : b);
    }
    return mb;
  };
  const fahnenmast = (x: number, y: number, z: number, h: number, a: RGB, b: RGB, yaw: number): void => {
    deko.at(x, y, z, 0);
    deko.prism(0, -0.4, 0, 0.11, 0.08, h + 0.4, 5, C_WEISS, undefined, null);
    deko.octa(0, h + 0.12, 0, 0.16, 0.16, 0.16, C_GOLD);
    flags.push(small.add(flagGeo(a, b), 1, 0.17, 3 + rnd(), rnd() * 6), x, y + h - 0.1, z, yaw);
  };
  const gletscherSegs: number[] = [];
  for (let i = 0; i < N; i++) if (gebiet[i] === GLETSCHER) gletscherSegs.push(i);
  // Gipfelkreuz am Wahrzeichen, Gipfelhütte, Steinmännchen
  {
    const L0 = t.landmark;
    let side = 1;
    let x = LX(L0, t.wh[L0] + 8);
    let z = LZ(L0, t.wh[L0] + 8);
    let best = -Infinity;
    for (let s = L0 - 12; s <= L0 + 6; s += 3) {
      for (const sg of [1, -1]) {
        for (let d = 5; d < 16; d += 1.5) {
          const cx2 = LX(s, sg * (t.wh[s] + d));
          const cz2 = LZ(s, sg * (t.wh[s] + d));
          const g = grund(cx2, cz2);
          if (!frei(cx2, cz2, 2.5, g, 10)) continue;
          // hoch, eben und gut zu sehen
          const score = g + eben(cx2, cz2) * 6 - d * 0.3;
          if (score > best) {
            best = score;
            x = cx2;
            z = cz2;
            side = sg;
          }
        }
      }
    }
    const y = grund(x, z);
    // Felskopf: aufgeschichtete Blöcke bis knapp über die Straße
    const top = Math.max(y + 1.4, t.py[L0] + 1.6);
    const nB = Math.max(3, Math.ceil((top - y) / 0.9));
    for (let k = 0; k < nB; k++) {
      const f = k / (nB - 1);
      const r = 2.6 - f * 1.4;
      geo(bauB, G.dode, jit(f > 0.7 ? C_FELS_H : C_FELS, 0.15), x + (rnd() - 0.5) * 1.2 * (1 - f), y + (top - y) * f - 0.3, z + (rnd() - 0.5) * 1.2 * (1 - f), rnd(), rnd() * 3, rnd(), r, 1.1, r * 0.9);
    }
    geo(bodenB, G.kegel4, C_SCHNEE, x + 1.2, y + 0.4, z - 0.8, 0, rnd() * 3, 0, 2.2, 0.9, 1.8);
    const yc = top + 0.4;
    bau.at(x, yc, z, faceRoad(L0, x, z));
    bau.box(0, 3.6, 0, 0.36, 7.2, 0.36, C_HOLZ_D);
    bau.box(0, 5.4, 0, 3.4, 0.34, 0.36, C_HOLZ_D);
    deko.like(bau);
    deko.box(0, 1.2, 0.22, 0.4, 0.5, 0.12, C_GOLD);
    deko.octa(0, 7.3, 0, 0.18, 0.18, 0.18, C_GOLD);
    // kleine Strahlen im Kreuzungspunkt
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * TAU;
      deko.tri([0, 5.4, 0.2], [Math.cos(a) * 0.9, 5.4 + Math.sin(a) * 0.9, 0.2], [Math.cos(a + 0.2) * 0.9, 5.4 + Math.sin(a + 0.2) * 0.9, 0.2], C_GOLD);
    }
    sperre(x, z, 3);
    belege(x, z, 3);
    // Steinmännchen
    for (let k = 0; k < 3; k++) {
      const sx = LX(L0 + 8 + k * 9, side * (t.wh[L0] + 5 + k));
      const sz = LZ(L0 + 8 + k * 9, side * (t.wh[L0] + 5 + k));
      const sy = grund(sx, sz);
      if (!frei(sx, sz, 0.6, sy, 1.5)) continue;
      deko.at(sx, sy, sz, rnd() * 3);
      for (let j = 0; j < 4; j++) deko.octa(0, 0.2 + j * 0.34, 0, 0.42 - j * 0.08, 0.17, 0.36 - j * 0.06, jit(C_STEIN, 0.2), C_STEIN_D);
    }
    // Gipfelhütte auf der anderen Seite, ein Stück vor dem Gipfel
    let bestH = -Infinity;
    let hi0 = -1;
    let hLat = 0;
    for (let i = L0 - 14; i <= L0 + 12; i += 2) {
      for (const sg of [-side, side]) {
        for (let off = 8; off <= 18; off += 2.5) {
          const lat = sg * (t.wh[i] + off);
          const hx = LX(i, lat);
          const hz = LZ(i, lat);
          if (!platz(hx, hz, 4.6, 7, 0.55)) continue;
          // möglichst hoch (nahe der Straße) und gegenüber dem Kreuz
          const sc = grund(hx, hz) - t.py[i] - off * 0.15 + (sg === -side ? 1.5 : 0);
          if (sc > bestH) {
            bestH = sc;
            hi0 = i;
            hLat = lat;
          }
        }
      }
    }
    for (let tr = 0; tr < 1 && hi0 >= 0; tr++) {
      const i = hi0;
      const hx = LX(i, hLat);
      const hz = LZ(i, hLat);
      const yaw = faceRoad(i, hx, hz);
      const hy = grund(hx, hz);
      let gMin = hy;
      for (const [a, b] of [
        [-3, -3.5],
        [3, 3.5],
        [3, -3.5],
        [-3, 3.5],
      ])
        gMin = Math.min(gMin, grund(hx + a * Math.cos(yaw) + b * Math.sin(yaw), hz - a * Math.sin(yaw) + b * Math.cos(yaw)));
      bau.at(hx, hy + 0.2, hz, yaw);
      deko.like(bau);
      bau.box(0, 0.2 - (hy + 0.2 - gMin) / 2, 0, 6.4, hy + 0.2 - gMin + 0.8, 7.4, C_STEIN);
      bau.box(0, 1.4, 0, 6, 2.8, 7, C_STEIN, undefined);
      bau.box(0, 3.5, 0, 6.1, 1.4, 7.1, C_HOLZ);
      for (const sg of [-1, 1]) {
        const A: V3 = [0, 6.0, 4.2];
        const B: V3 = [sg * 3.9, 4.0, 4.2];
        const C: V3 = [sg * 3.9, 4.0, -4.2];
        const D: V3 = [0, 6.0, -4.2];
        if (sg > 0) {
          bau.quad(A, B, C, D, C_DACH_D);
          bau.quad(D, C, B, A, C_HOLZ_D);
        } else {
          bau.quad(D, C, B, A, C_DACH);
          bau.quad(A, B, C, D, C_HOLZ_D);
        }
      }
      bau.tri([-3.05, 4.2, 3.55], [3.05, 4.2, 3.55], [0, 5.9, 3.55], C_HOLZ);
      bau.tri([3.05, 4.2, -3.55], [-3.05, 4.2, -3.55], [0, 5.9, -3.55], C_HOLZ);
      // Schneereste auf dem Dach
      if (hi) dachSteine(deko, 0, 3.9, 6.0, 4.0, -3.6, 3.6);
      fenster(deko, -1.5, 1.6, 3.5, 1, C_LADEN[1], 0.8, 0.9);
      deko.quad([0.6, 0, 3.53], [1.7, 0, 3.53], [1.7, 2.1, 3.53], [0.6, 2.1, 3.53], C_HOLZ_D);
      deko.box(0, 0.25, 4.6, 3, 0.1, 0.5, C_HOLZ, C_HOLZ_H);
      bau.box(-2.0, 6.0, -1.6, 0.6, 1.6, 0.6, C_STEIN, C_DUNKEL);
      const fx = hx + Math.cos(yaw) * 4.4;
      const fz = hz - Math.sin(yaw) * 4.4;
      fahnenmast(fx, grund(fx, fz), fz, 7, C_ROT, C_WEISS, yaw);
      belege(hx, hz, 6);
      sperre(hx, hz, 5);
      break;
    }
  }
  {
    // Gletscherspalten: dunkle Linsen quer zum Hang, mit hellem Rand
    const want = hi ? 22 : 10;
    let got = 0;
    for (let k = 0; k < want * 30 && got < want; k++) {
      const i = gletscherSegs[Math.floor(rnd() * gletscherSegs.length)];
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 9 + rnd() * 45);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      const y = grund(x, z);
      const L2 = 6 + rnd() * 9;
      if (y < 66 || belegt(x, z, L2 * 0.6)) continue;
      if (!frei(x, z, L2 * 0.5, y - 1, 2)) continue;
      if (eben(x, z) < 0.72) continue;
      // quer zum Gefälle
      const gx = grund(x + 2, z) - grund(x - 2, z);
      const gz = grund(x, z + 2) - grund(x, z - 2);
      const a = Math.atan2(gz, gx) + Math.PI / 2 + (rnd() - 0.5) * 0.4;
      const W2 = 0.7 + rnd() * 0.9;
      const n = 6;
      const pt = (f: number, w: number, lift: number): V3 => {
        const u = (f - 0.5) * L2;
        const ww = w * Math.sin(f * Math.PI);
        const px2 = x + Math.cos(a) * u - Math.sin(a) * ww;
        const pz2 = z + Math.sin(a) * u + Math.cos(a) * ww;
        return [px2, grund(px2, pz2) + lift, pz2];
      };
      for (let j = 0; j < n; j++) {
        const f0 = j / n;
        const f1 = (j + 1) / n;
        const ref: V3 = [x, -1e4, z];
        matt.qo(pt(f0, -W2, 0.12), pt(f0, W2, 0.12), pt(f1, W2, 0.12), pt(f1, -W2, 0.12), j % 2 ? C_SPALTE : shade(C_SPALTE, 0.85), ref);
        for (const sg of [-1, 1]) deko.qo(pt(f0, sg * W2, 0.1), pt(f0, sg * (W2 + 0.55), 0.06), pt(f1, sg * (W2 + 0.55), 0.06), pt(f1, sg * W2, 0.1), C_SPALTE_R, ref);
      }
      belege(x, z, L2 * 0.4);
      got++;
    }
    // Séracs und Eisblöcke am Rand des Gletschers, um den Eistunnel
    const wantS = hi ? 46 : 20;
    got = 0;
    for (let k = 0; k < wantS * 20 && got < wantS; k++) {
      const i = gletscherSegs[Math.floor(rnd() * gletscherSegs.length)];
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + (t.edge[i] & EDGE_TUNNEL ? TUNNEL_PLUS + 3 : 6) + rnd() * 30);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      const s = 1.1 + rnd() * 1.9;
      const y = grund(x, z);
      if (y < 64) continue;
      if (!platz(x, z, s, s * 2.4, 0.5)) continue;
      const tilt = (rnd() - 0.5) * 0.4;
      // Eisturm: schräg gebrochener Block mit Schneehaube, daneben Trümmer
      geo(bodenB, G.dode, rnd() < 0.5 ? C_EIS : mixRgb(C_EIS, C_SCHNEE, 0.4), x, y + s * 0.9, z, tilt, rnd() * 3, (rnd() - 0.5) * 0.4, s * 0.8, s * (1.3 + rnd() * 0.7), s * 0.75);
      geo(bodenB, G.kegel4, C_SCHNEE, x, y + s * 2.0, z, tilt * 0.5, rnd() * 3, 0, s * 0.62, s * 0.5, s * 0.55);
      if (rnd() < 0.6) geo(bodenB, G.ico, C_EIS_D, x + s * 0.9, y + s * 0.25, z - s * 0.5, rnd(), rnd() * 3, rnd(), s * 0.45, s * 0.35, s * 0.4);
      belege(x, z, s);
      got++;
    }
    // Felsgrate: Zacken auf den Kämmen rings um den Gipfel
    const wantF = hi ? 40 : 18;
    got = 0;
    for (let k = 0; k < wantF * 25 && got < wantF; k++) {
      const i = gletscherSegs[Math.floor(rnd() * gletscherSegs.length)];
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 22 + rnd() * 45);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      const y = grund(x, z);
      const H = 5 + rnd() * 11;
      const R = H * (0.35 + rnd() * 0.2);
      if (y < 50) continue;
      if (!platz(x, z, R * 0.8, H, 0.3)) continue;
      geo(bodenB, rnd() < 0.5 ? G.kegel4 : G.kegel5, jit(rnd() < 0.5 ? C_FELS_D : C_FELS, 0.15), x, y + H * 0.42, z, (rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3, R, H, R * (0.7 + rnd() * 0.4));
      if (H > 9) geo(bodenB, G.kegel4, C_SCHNEE, x, y + H * 0.92, z, 0, rnd() * 3, 0, R * 0.32, H * 0.2, R * 0.3);
      belege(x, z, R * 0.8);
      got++;
    }
  }
  // Windsack und Fahnen an der Schanze (Absprung ins Tal)
  let windsack = -1;
  const windsackAt: V3 = [0, 0, 0];
  {
    let jump = -1;
    for (let i = 0; i < N; i++) if (t.edge[i] & EDGE_GLIDE) {
      jump = i;
      break;
    }
    if (jump > 0) {
      const cols: [RGB, RGB][] = [
        [C_ROT, C_WEISS],
        [C_BLAU, C_GELB],
        [C_GRUEN, C_WEISS],
        [C_ORANGE, C_DUNKEL],
      ];
      let n = 0;
      for (let s = jump - 26; s < jump - 2; s += 6) {
        for (const sg of [-1, 1]) {
          const lat = sg * (t.wh[s] + RAND + 0.4);
          const x = LX(s, lat);
          const z = LZ(s, lat);
          const y = grund(x, z);
          if (y < t.py[s] - 3 || !frei(x, z, 0.4, y, 9)) continue;
          const [a, b] = cols[n++ % cols.length];
          fahnenmast(x, y, z, 7.5, a, b, yawAt(s) + Math.PI);
        }
      }
      // Windsack an hohem Mast neben dem Absprung (auf dem Plateau, nicht unten am Abbruch)
      let bestW = -Infinity;
      let wx = 0;
      let wz = 0;
      for (let s = jump - 20; s <= jump - 2; s += 2) {
        for (const sg of [-1, 1]) {
          for (const off of [RAND + 2.6, RAND + 4.5]) {
            const x = LX(s, sg * (t.wh[s] + off));
            const z = LZ(s, sg * (t.wh[s] + off));
            const y = grund(x, z);
            if (!frei(x, z, 2.5, y, 9)) continue;
            const sc = y - t.py[s] + (s - jump) * 0.05;
            if (sc > bestW) {
              bestW = sc;
              wx = x;
              wz = z;
            }
          }
        }
      }
      for (let tr = 0; tr < 1 && bestW > -4; tr++) {
        const x = wx;
        const z = wz;
        const y = grund(x, z);
        deko.at(x, y, z, 0);
        deko.prism(0, -0.4, 0, 0.13, 0.1, 8.4, 5, C_STAHL, undefined, null);
        deko.box(0, 8.1, 0, 0.5, 0.12, 0.5, C_DUNKEL);
        const mb = new MeshBuilder();
        const k = new Kit(mb);
        const nS = 5;
        const ring = (j: number): V3[] => {
          const r = 0.42 - j * 0.055;
          const xx = j * 0.48;
          const out: V3[] = [];
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * TAU;
            out.push([xx, Math.cos(a) * r, Math.sin(a) * r]);
          }
          return out;
        };
        for (let j = 0; j < nS; j++) {
          const A = ring(j);
          const B = ring(j + 1);
          for (let q = 0; q < 6; q++) {
            const c = j % 2 ? C_WEISS : C_ORANGE;
            k.quad2(A[q], B[q], B[(q + 1) % 6], A[(q + 1) % 6], c, shade(c, 0.7));
          }
        }
        k.beam([0, 0.45, 0], [0, -0.45, 0], 0.06, C_STAHL);
        windsack = small.add(mb);
        windsackAt[0] = x;
        windsackAt[1] = y + 8.0;
        windsackAt[2] = z;
      }
    }
  }

  // =====================================================================================
  // Bergwald und Abfahrt: Almhütte, Skisprungschanze, Klamm
  // =====================================================================================
  // Almhütte gleich nach der Fangrampe auf einer Lichtung
  {
    const i0 = segU(24.35);
    for (let tr = 0; tr < 40; tr++) {
      const i = i0 + tr * 2;
      const side = tr % 2 ? -1 : 1;
      const lat = side * (t.wh[i] + 12 + (tr % 4) * 3);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      if (!platz(x, z, 5.5, 8, 0.7)) continue;
      const yaw = faceRoad(i, x, z);
      chalet(x, z, yaw, 7.2, 7.8, C_LADEN[1]);
      // Bank, Tisch, Brunnentrog, Holzstoß
      deko.at(x, grund(x, z), z, yaw);
      deko.box(-2.2, 0.45, 6.2, 2.4, 0.08, 0.8, C_HOLZ, C_HOLZ_H);
      deko.box(-2.2, 0.25, 6.2, 0.1, 0.5, 0.7, C_HOLZ_D);
      deko.box(1.8, 0.75, 6.0, 1.6, 0.1, 1.0, C_HOLZ, C_HOLZ_H);
      deko.box(1.8, 0.37, 6.0, 0.15, 0.75, 0.15, C_HOLZ_D);
      // ein paar Wanderer
      for (let k = 0; k < (hi ? 4 : 2); k++) {
        const P = deko.p(-2.8 + k * 1.4, 0, 7.0 + (k % 2) * 0.5);
        if (frei(P[0], P[2], 0.4, grund(P[0], P[2]), 2)) mensch(P[0], grund(P[0], P[2]), P[2], yaw + Math.PI);
        deko.at(x, grund(x, z), z, yaw);
      }
      break;
    }
  }
  // Skisprungschanze: Anlaufturm oben, Kampfrichterturm neben dem Schanzentisch, Banden am Aufsprunghang
  if (brB) {
    let ramp = -1;
    let gap0 = -1;
    for (let j = 0; j < brB.count; j++) {
      const i = brB.first + j;
      if (gap0 < 0 && t.edge[i] & EDGE_GAP) gap0 = i;
    }
    ramp = gap0 > 0 ? gap0 - 2 : brB.first + Math.floor(brB.count * 0.4);
    // Kampfrichterturm: auf der Seite zur Talseite der Klamm
    for (const sg of klamm ? [klamm.fall, -klamm.fall] : [1, -1]) {
      const i = ramp + 10;
      const lat = sg * (t.wh[i] + 12);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      const y = grund(x, z);
      if (!frei(x, z, 3, y - 1, 16)) continue;
      bau.at(x, y, z, faceRoad(ramp, x, z));
      deko.like(bau);
      bau.box(0, 4, 0, 2.6, 8.6, 2.6, C_SOCKEL);
      bau.box(0, 9.7, 0, 4.6, 2.8, 3.8, C_HOLZ_H);
      deko.box(0, 9.9, 1.92, 4.2, 1.6, 0.06, C_FENSTER_H);
      deko.box(-2.32, 9.9, 0, 0.06, 1.6, 3.2, C_FENSTER_H);
      deko.box(2.32, 9.9, 0, 0.06, 1.6, 3.2, C_FENSTER_H);
      bau.box(0, 11.3, 0.3, 5.4, 0.35, 4.8, C_DUNKEL);
      for (let k = 0; k < 4; k++) deko.beam([1.3, 0.5 + k * 2, 1.4], [-1.3, 2.5 + k * 2, 1.4], 0.12, C_STAHL);
      fahnenmast(x + 2, y + 11.5, z + 1, 3, C_ROT, C_WEISS, faceRoad(ramp, x, z));
      sperre(x, z, 4);
      belege(x, z, 4);
      break;
    }
    // Anlaufturm am Beginn der Abzweigung: Startplattform mit Dach, Flutlichtmasten
    {
      const i = brB.first + 14;
      for (const sg of [1, -1]) {
        const lat = sg * (t.wh[i] + 7);
        const x = LX(i, lat);
        const z = LZ(i, lat);
        const y = grund(x, z);
        if (!frei(x, z, 3, y - 1, 15)) continue;
        bau.at(x, y, z, yawAt(i));
        deko.like(bau);
        for (const [a, b] of [
          [-1.6, -1.6],
          [1.6, -1.6],
          [-1.6, 1.6],
          [1.6, 1.6],
        ])
          bau.box(a, 5.5, b, 0.35, 11, 0.35, C_STAHL);
        for (let k = 1; k < 5; k++) deko.box(0, k * 2.4, 0, 3.4, 0.14, 3.4, C_DUNKEL);
        bau.box(0, 11.2, 0, 4.4, 0.5, 4.4, C_HOLZ);
        bau.box(0, 12.0, 0, 4.2, 1.1, 0.12, C_ROT);
        bau.prism(0, 14.0, 0, 3.4, 0, 1.6, 4, C_DACH_ROT, C_DACH_ROT_D, undefined, Math.PI / 4);
        for (const [a, b] of [
          [-1.9, -1.9],
          [1.9, 1.9],
          [-1.9, 1.9],
          [1.9, -1.9],
        ])
          deko.box(a, 12.7, b, 0.15, 2.6, 0.15, C_STAHL);
        fahnenmast(x, y + 14.2, z, 3.2, C_BLAU, C_WEISS, yawAt(i) + Math.PI / 2);
        sperre(x, z, 3.5);
        belege(x, z, 3.5);
        break;
      }
      // Banden am Aufsprunghang: farbige Tafeln hinter der Kante
      if (gap0 > 0) {
        const cols = [C_ROT, C_BLAU, C_GELB, C_GRUEN, C_WEISS];
        for (let j = 0; j < (hi ? 12 : 6); j++) {
          const s = gap0 + 16 + j * (hi ? 4 : 8);
          if (s >= brB.first + brB.count - 4) break;
          for (const sg of [-1, 1]) {
            const lat = sg * (t.wh[s] + RAND + 0.2);
            const x = LX(s, lat);
            const z = LZ(s, lat);
            const y = grund(x, z);
            if (!frei(x, z, 0.3, y, 1.4)) continue;
            deko.at(x, y, z, yawAt(s) + Math.PI / 2);
            deko.box(0, 0.6, 0, 3.6, 0.9, 0.1, cols[(j + (sg > 0 ? 2 : 0)) % cols.length], C_WEISS);
          }
        }
      }
    }
  }
  // Klamm: Wasser im Grund, Gischt an den Stufen, Felsblöcke; unter der Schanze ein dunkler Schlund
  if (klamm) {
    const kl = klamm;
    const ref: V3 = [kl.x, -1e4, kl.z];
    const W = 2.4;
    const n = hi ? 34 : 20;
    const span = 64;
    const P = (u: number, w: number, lift: number): V3 => {
      const x = kl.x + kl.rx * u + kl.ax * w;
      const z = kl.z + kl.rz * u + kl.az * w;
      return [x, grund(x, z) + lift, z];
    };
    let whB = 6.2;
    if (brB) for (let j = 0; j < brB.count; j++) whB = Math.max(whB, t.wh[brB.first + j]);
    for (let k = 0; k < n; k++) {
      const u0 = -span + (k / n) * span * 2;
      const u1 = -span + ((k + 1) / n) * span * 2;
      const um = (u0 + u1) / 2;
      // unter der Schanze: tief im Schatten; nie bis an eine andere Fahrbahn
      if (Math.abs(um) < whB + 2) continue;
      if (Math.abs(um) > 50) continue;
      const A0 = P(u0, 0, 0);
      const A1 = P(u1, 0, 0);
      if (kante(A0[0], A0[2]) < 4 || kante(A1[0], A1[2]) < 4) continue;
      const wig = Math.sin(um * 0.18) * 1.2;
      const wig1 = Math.sin(u1 * 0.18) * 1.2;
      const wig0 = Math.sin(u0 * 0.18) * 1.2;
      matt.qo(P(u0, wig0 - W, 0.25), P(u0, wig0 + W, 0.25), P(u1, wig1 + W, 0.25), P(u1, wig1 - W, 0.25), k % 3 === 0 ? C_WASSER_H : C_WASSER, ref);
      if (k % 2 === 0) matt.qo(P(um - 0.8, wig - 0.8, 0.3), P(um - 0.8, wig + 0.8, 0.3), P(um + 0.8, wig + 0.6, 0.3), P(um + 0.8, wig - 0.6, 0.3), C_GISCHT, ref);
      if (hi && k % 3 === 1) {
        const B = P(um, wig + (k % 2 ? 2.6 : -2.6), 0);
        geo(bodenB, G.dode, jit(C_FELS_D, 0.2), B[0], B[1] + 0.3, B[2], rnd(), rnd() * 3, rnd(), 1.0 + rnd(), 0.8, 1.0 + rnd() * 0.5);
      }
    }
    // Schlund unter der Lücke: Felsband in tiefem Schatten (das Gelände liegt dort flach unter der Bahn)
    const hw = whB + 2.6;
    const nS = 6;
    const rows: [number, number, RGB][] = [
      [-1, -0.62, rgb(0x4a4f57)],
      [-0.62, -0.3, rgb(0x2a3038)],
      [-0.3, 0.3, C_SCHLUND],
      [0.3, 0.62, rgb(0x2a3038)],
      [0.62, 1, rgb(0x4a4f57)],
    ];
    const Q = (u: number, w: number): V3 => {
      const x = kl.x + kl.rx * u + kl.ax * w;
      const z = kl.z + kl.rz * u + kl.az * w;
      return [x, Math.min(grund(x, z), kl.y + 13.5) + 0.12, z];
    };
    const zack = (k: number, f: number): number => (Math.abs(f) > 0.99 ? 1 + 0.12 * Math.sin(k * 2.7 + f) : 1);
    for (let k = 0; k < nS; k++) {
      const u0 = -hw + (k / nS) * hw * 2;
      const u1 = -hw + ((k + 1) / nS) * hw * 2;
      const W2 = kl.half - 0.2;
      for (const [f0, f1, col] of rows) matt.qo(Q(u0, f0 * W2 * zack(k, f0)), Q(u0, f1 * W2 * zack(k, f1)), Q(u1, f1 * W2 * zack(k + 1, f1)), Q(u1, f0 * W2 * zack(k + 1, f0)), col, ref);
    }
    // Wasser schimmert unten durch den Schlund
    for (let k = 0; k < nS; k++) {
      const u0 = -hw + (k / nS) * hw * 2;
      const u1 = u0 + (hw * 2) / nS;
      const w0 = Math.sin(u0 * 0.18) * 1.2;
      const w1 = Math.sin(u1 * 0.18) * 1.2;
      const lift = (P: V3): V3 => [P[0], P[1] + 0.03, P[2]];
      matt.qo(lift(Q(u0, w0 - 0.5)), lift(Q(u0, w0 + 0.5)), lift(Q(u1, w1 + 0.5)), lift(Q(u1, w1 - 0.5)), rgb(0x2a5a7e), ref);
    }
  }

  // =====================================================================================
  // Über dem Tal: Gleitschirmflieger und Greifvögel
  // =====================================================================================
  /** Bleibt ein Kreis (Mitte, Radius, Höhe ± dy) überall frei von Fahrbahn und Flugkorridor? */
  const bahnFrei = (cx: number, cy: number, cz: number, R: number, dy: number, r: number): boolean => {
    for (let q = 0; q < 24; q++) {
      const a = (q / 24) * TAU;
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R;
      if (!frei(x, z, r + 6, cy - dy - r, 2 * (dy + r))) return false;
      if (grund(x, z) > cy - dy - r - 12) return false;
    }
    return true;
  };
  const schirme: number[] = []; // Teil, Mitte x, y, z, Radius, Takt (rad/s), Phase
  {
    let gc = 0;
    let gx = 0;
    let gz = 0;
    let gy = 0;
    for (let i = 0; i < N; i++) if (t.edge[i] & EDGE_GLIDE) {
      gc++;
      gx += t.px[i];
      gz += t.pz[i];
      gy += t.py[i];
    }
    if (gc > 0) {
      gx /= gc;
      gz /= gc;
      gy /= gc;
    }
    const schirm = (cA: RGB, cB: RGB): MeshBuilder => {
      const mb = new MeshBuilder();
      const k = new Kit(mb);
      // Kappe: Bogen aus Zellen, Spannweite 10 m, Profil 2,6 m; Pilot unten, Flugrichtung +z
      const cells = hi ? 9 : 7;
      const arc = 1.25;
      const Rr = 5.4;
      const yC = 6.4;
      const pt = (f: number, zz: number, th2: number): V3 => {
        const a = (f - 0.5) * arc * 2;
        return [Math.sin(a) * Rr, yC - Rr + Math.cos(a) * Rr + th2, zz];
      };
      for (let c = 0; c < cells; c++) {
        const f0 = c / cells;
        const f1 = (c + 1) / cells;
        const col = c % 2 ? cA : cB;
        k.quad2(pt(f0, 1.3, 0.25), pt(f1, 1.3, 0.25), pt(f1, -1.3, 0.1), pt(f0, -1.3, 0.1), col, shade(col, 0.75));
        k.quad2(pt(f0, 1.3, 0.25), pt(f0, 1.3, -0.15), pt(f1, 1.3, -0.15), pt(f1, 1.3, 0.25), shade(col, 0.6));
      }
      // Leinen
      for (const f of [0.08, 0.35, 0.65, 0.92]) {
        const P = pt(f, 0.2, -0.1);
        k.beam([0, 0.9, 0], P, 0.03, rgb(0xe8e8e8));
      }
      // Pilot im Gurtzeug
      k.box(0, 0.45, -0.1, 0.5, 0.6, 0.9, C_DUNKEL);
      k.octa(0, 1.05, 0.15, 0.17, 0.2, 0.17, C_GELB);
      return mb;
    };
    const want = hi ? 4 : 2;
    for (let k = 0; k < 200 && schirme.length / 7 < want; k++) {
      const a = rnd() * TAU;
      const d = 60 + rnd() * 150;
      const cx = gx + Math.cos(a) * d;
      const cz = gz + Math.sin(a) * d;
      const R = 22 + rnd() * 18;
      const cy = gy - 5 + rnd() * 45;
      if (!bahnFrei(cx, cy, cz, R, 3, 6)) continue;
      const [cA, cB] = SCHIRME[(schirme.length / 7) % SCHIRME.length];
      schirme.push(mov.add(schirm(cA, cB)), cx, cy, cz, R, (rnd() < 0.5 ? -1 : 1) * (0.1 + rnd() * 0.05), rnd() * TAU);
    }
  }
  const voegel: number[] = []; // Teil, Mitte x, y, z, Radius, Takt, Phase
  {
    const vogel = (): MeshBuilder => {
      const mb = new MeshBuilder();
      const k = new Kit(mb);
      k.octa(0, 0, 0, 0.22, 0.18, 0.55, C_VOGEL);
      k.octa(0, 0.08, 0.5, 0.12, 0.12, 0.16, C_VOGEL_H);
      k.tri2([0, 0, -0.45], [-0.3, 0, -0.95], [0.3, 0, -0.95], C_VOGEL);
      for (const sg of [-1, 1]) {
        k.quad2([sg * 0.15, 0.04, 0.25], [sg * 1.0, 0.1, 0.18], [sg * 1.0, 0.1, -0.3], [sg * 0.15, 0.04, -0.25], C_VOGEL);
        k.quad2([sg * 1.0, 0.1, 0.18], [sg * 1.7, 0.02, 0.0], [sg * 1.7, 0.02, -0.32], [sg * 1.0, 0.1, -0.3], shade(C_VOGEL, 0.75));
      }
      return mb;
    };
    const want = hi ? 5 : 3;
    for (let k = 0; k < 300 && voegel.length / 7 < want; k++) {
      const i = Math.floor(rnd() * N);
      const a = rnd() * TAU;
      const d = 40 + rnd() * 90;
      const cx = t.px[i] + Math.cos(a) * d;
      const cz = t.pz[i] + Math.sin(a) * d;
      const R = 14 + rnd() * 16;
      const cy = Math.max(grund(cx, cz) + 30, t.py[i] + 14 + rnd() * 30);
      if (!bahnFrei(cx, cy, cz, R, 2, 2)) continue;
      voegel.push(small.add(vogel(), 2, 0.22, 5.5, rnd() * 6), cx, cy, cz, R, (rnd() < 0.5 ? -1 : 1) * (0.2 + rnd() * 0.1), rnd() * TAU);
    }
  }

  // =====================================================================================
  // Netze
  // =====================================================================================
  for (const g of Object.values(G)) g.dispose();
  const addStatic = (b: MeshBuilder, outline: boolean): void => {
    if (b.empty) return;
    const g = b.build();
    const m = new THREE.Mesh(g, toon);
    group.add(m);
    disposables.push(g);
    if (outline) {
      addSmoothNormals(g);
      const o = new THREE.Mesh(g, outlineMaterial(0.05));
      o.name = 'outline';
      o.matrixAutoUpdate = false;
      m.add(o);
    }
  };
  addStatic(bauB, hi);
  addStatic(bodenB, false);
  if (!mattB.empty) {
    const g = mattB.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const m = new THREE.Mesh(g, mat);
    group.add(m);
    disposables.push(g, mat);
  }
  if (fern.triangles > 0) {
    // Ferne Berge: ohne Dunst (er steckt in den Farben), hinter allem anderen
    const g = fern.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = -7;
    group.add(m);
    disposables.push(g, mat);
  }
  const movGeo = mov.build();
  const movMesh = new THREE.Mesh(movGeo, toon);
  movMesh.frustumCulled = false;
  group.add(movMesh);
  disposables.push(movGeo);
  if (hi) {
    const o = new THREE.Mesh(movGeo, outlineMaterial(0.045));
    o.name = 'outline';
    o.frustumCulled = false;
    o.matrixAutoUpdate = false;
    movMesh.add(o);
  }
  const smallGeo = small.build();
  const smallMesh = new THREE.Mesh(smallGeo, toon);
  smallMesh.frustumCulled = false;
  group.add(smallMesh);
  disposables.push(smallGeo);

  // =====================================================================================
  // Bewegung
  // =====================================================================================
  const nKuh = kuehe.length / 7;
  const nSchirm = schirme.length / 7;
  const nVogel = voegel.length / 7;
  const nFlag = flags.length / 5;
  const hals = new THREE.Matrix4();
  const update = (time: number): void => {
    // Kühe: drehen sich langsam beim Grasen, heben ab und zu den Kopf und kauen
    for (let k = 0; k < nKuh; k++) {
      const o = k * 7;
      const ph = kuehe[o + 6];
      const yaw = kuehe[o + 5] + Math.sin(time * 0.045 + ph) * 0.35;
      pose(kuehe[o + 2], kuehe[o + 3], kuehe[o + 4], yaw);
      m5.copy(m4);
      mov.set(kuehe[o], m5);
      const cyc = (time + ph * 3) % 13;
      const up = smooth((cyc - 8) / 0.9) * (1 - smooth((cyc - 11.2) / 0.9));
      const pitch = 0.98 - up * 0.95 + Math.sin(time * 3.1 + ph) * 0.05 * (1 - up);
      const turn = up * Math.sin(ph) * 0.4;
      e4.set(pitch, turn, 0);
      q4.setFromEuler(e4);
      hals.compose(v4.set(0, 1.22, 0.82), q4, s4.set(1, 1, 1));
      m5.multiply(hals);
      mov.set(kuehe[o + 1], m5);
    }
    // Gleitschirme: weite Kreise, ins Innere geneigt, leichtes Auf und Ab
    for (let k = 0; k < nSchirm; k++) {
      const o = k * 7;
      const w = schirme[o + 5];
      const a = schirme[o + 6] + time * w;
      const R = schirme[o + 4];
      const x = schirme[o + 1] + Math.cos(a) * R;
      const z = schirme[o + 3] + Math.sin(a) * R;
      const y = schirme[o + 2] + Math.sin(time * 0.13 + k) * 2.5;
      const sg = w > 0 ? 1 : -1;
      const yaw = Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg);
      pose(x, y, z, yaw, 0.04, -sg * 0.22 + Math.sin(time * 0.7 + k) * 0.03);
      mov.set(schirme[o], m4);
    }
    // Greifvögel: kreisen in der Thermik, schlagen kaum mit den Flügeln
    for (let k = 0; k < nVogel; k++) {
      const o = k * 7;
      const w = voegel[o + 5];
      const a = voegel[o + 6] + time * w;
      const R = voegel[o + 4];
      const x = voegel[o + 1] + Math.cos(a) * R;
      const z = voegel[o + 3] + Math.sin(a) * R;
      const y = voegel[o + 2] + Math.sin(time * 0.21 + k * 2) * 1.5;
      const sg = w > 0 ? 1 : -1;
      const yaw = Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg);
      pose(x, y, z, yaw, 0, -sg * 0.35, 1.3);
      small.set(voegel[o], m4);
    }
    // Fahnen
    for (let f = 0; f < nFlag; f++) {
      const o = f * 5;
      pose(flags[o + 1], flags[o + 2], flags[o + 3], flags[o + 4] + Math.sin(time * 0.4 + f) * 0.25);
      small.set(flags[o], m4);
    }
    // Windsack: dreht mit dem Wind, hängt bei Flaute etwas durch
    if (windsack >= 0) {
      const gust = 0.5 + 0.5 * Math.sin(time * 0.31) * Math.sin(time * 0.17 + 1);
      pose(windsackAt[0], windsackAt[1], windsackAt[2], 2.4 + Math.sin(time * 0.23) * 0.35 + Math.sin(time * 1.7) * 0.05, 0, -0.55 + gust * 0.5);
      small.set(windsack, m4);
    }
  };

  update(0);
  mov.update(0);
  small.update(0);

  return {
    group,
    update(time: number): void {
      update(time);
      mov.update(time);
      small.update(time);
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Lichtanteil 0..1 (ohne Rückseite). */
function n0(x: number): number {
  return x > 0 ? (x > 1 ? 1 : x) : 0;
}

/** Klamm quer unter der Skisprungschanze: Mitte, Richtung der Schanze (a), quer dazu (r), halbe Breite, Grund, Gefälle. */
interface Klamm {
  x: number;
  z: number;
  ax: number;
  az: number;
  rx: number;
  rz: number;
  half: number;
  y: number;
  fall: number;
}

/**
 * Bergschultern an den Punkten des Geländerasters (dasselbe Raster wie world.ts): Von jeder Fahrbahn fällt eine
 * Schulter nach außen ab (a·d + b·d², d = Abstand hinter der Kante), die höchste zählt. Begrenzt wird sie so, dass
 * sie nie über eine Fahrbahn ragt: An der Kante liegt sie knapp unter der Fahrbahn, bergauf steigt sie innerhalb
 * einer Rasterzelle kaum (sonst höbe die Zwischenlinie sie über die Kante), dahinter wie eine Böschung. Über dem
 * Flugkorridor und unter Lücken bleibt sie tief, ebenso in der Klamm.
 *
 * (Eigene Funktion: In der großen Aufbaufunktion lief diese dichte Schleife ein Vielfaches langsamer.)
 */
function schultern(
  world: World,
  gx0: number,
  gz0: number,
  cell: number,
  GX: number,
  GZ: number,
  flA: Float32Array,
  flB: Float32Array,
  klamm: Klamm | null,
): { wY: Float32Array; hY: Float32Array; qV: Int32Array; unter: Uint8Array } {
  const t = world.track;
  const farY = world.theme.farY;
  const T = t.total;
  // Quellen: jeder zweite Abschnitt. Art: 1 Straße, 2 Schiene, 3 Tunnel (Schultern) · 4 Flug, 5 Lücke, 6 Steg (nur Begrenzer)
  const nQ = Math.ceil(T / 2);
  const qSeg = new Int32Array(nQ);
  const qKind = new Uint8Array(nQ);
  const qR = new Float64Array(nQ);
  const qx = new Float64Array(nQ);
  const qz = new Float64Array(nQ);
  const qrx = new Float64Array(nQ);
  const qrz = new Float64Array(nQ);
  const qwh = new Float64Array(nQ);
  const qbase = new Float64Array(nQ);
  const qbank = new Float64Array(nQ);
  const qpy = new Float64Array(nQ);
  const qa = new Float64Array(nQ);
  const qb = new Float64Array(nQ);
  const qtx = new Float64Array(nQ);
  const qtz = new Float64Array(nQ);
  for (let j = 0; j < nQ; j++) {
    const k = j * 2;
    const e = t.edge[k];
    const kind = e & EDGE_GLIDE ? 4 : e & EDGE_GAP ? 5 : e & EDGE_RAIL ? 2 : e & EDGE_DECK ? 6 : e & EDGE_TUNNEL ? 3 : 1;
    let reach: number;
    if (kind <= 3) {
      // So weit, bis die Flanke unter dem Talboden liegt.
      const D = t.py[k] - farY + 14;
      reach = t.wh[k] + (-flA[k] + Math.sqrt(flA[k] * flA[k] + 4 * flB[k] * D)) / (2 * flB[k]);
    } else reach = t.wh[k] + (kind === 4 ? 75 : kind === 5 ? 40 : 30);
    qSeg[j] = k;
    qKind[j] = kind;
    qR[j] = reach;
    qx[j] = t.px[k];
    qz[j] = t.pz[k];
    qrx[j] = rightX(t, k);
    qrz[j] = rightZ(t, k);
    qwh[j] = t.wh[k];
    qbase[j] = t.base[k];
    qbank[j] = t.bank[k];
    qpy[j] = t.py[k];
    qa[j] = flA[k];
    qb[j] = flB[k];
    qtx[j] = t.tx[k];
    qtz[j] = t.tz[k];
  }
  const GW = GX + 1;
  const NV = GW * (GZ + 1);
  const wY = new Float32Array(NV);
  const hY = new Float32Array(NV);
  const qV = new Int32Array(NV).fill(-1);
  const unter = new Uint8Array(NV);
  const C1 = cell * 1.05;
  for (let iz = 0; iz <= GZ; iz++) {
    for (let ix = 0; ix <= GX; ix++) {
      const v = iz * GW + ix;
      const x = gx0 + ix * cell;
      const z = gz0 + iz * cell;
      // wie world.ts: zum Rand des Rasters läuft das Gelände flach aus
      const edgeK = smooth(Math.min(ix, GX - ix, iz, GZ - iz) / 5);
      const w = farY + (world.heightAt(x, z) - farY) * edgeK;
      wY[v] = w;
      let s = -1e9;
      let q = -1;
      let qd = 0;
      let lim = 1e9;
      let under = 0;
      for (let j = 0; j < nQ; j++) {
        const dx = x - qx[j];
        const dz = z - qz[j];
        const R = qR[j];
        if (dx > R || dx < -R || dz > R || dz < -R) continue;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > R) continue;
        const wh = qwh[j];
        const d = dist - wh;
        const kind = qKind[j];
        if (kind === 4) {
          // Flugkorridor: wirkt nur quer zur Flugbahn (Scheiben je Abschnitt) – so bleibt das Plateau
          // vor dem Absprung und der Hang hinter der Landung, wie er ist.
          const along = dx * qtx[j] + dz * qtz[j];
          if (along > 1.6 || along < -1.6) continue;
          const lat = Math.abs(dx * qrx[j] + dz * qrz[j]) - wh;
          const L = qpy[j] - 34 + 1.1 * Math.max(0, lat - 6);
          if (L < lim) lim = L;
          continue;
        }
        if (kind >= 5) {
          const L = kind === 5 ? qpy[j] - 14 + 1.3 * Math.max(0, d - 1) : qpy[j] - 1.8 + Math.max(0, d);
          if (L < lim) lim = L;
          continue;
        }
        if (d < -0.5) under = 1;
        const dd = d > 0 ? d : 0;
        let ey: number;
        let L: number;
        if (kind === 2) {
          ey = qpy[j] - 3;
          L = qpy[j] - 2.2 + dd;
        } else {
          const lat = dx * qrx[j] + dz * qrz[j];
          const surf = qbase[j] + (lat > wh ? wh : lat < -wh ? -wh : lat) * qbank[j];
          if (kind === 3) {
            // Tunnel: daneben trägt der Felsmantel (world.ts); darin bleibt der Boden unter der Fahrbahn.
            ey = surf - 1.6;
            L = d < 0 ? surf - 0.35 : 1e9;
          } else {
            ey = surf - 0.25;
            // Neben einer Straße: an der Kante knapp darunter, innerhalb einer Zelle fast eben, dann Böschung
            L = d < 0 ? surf - 0.35 : surf - 0.2 + (dd <= C1 ? 0.05 * dd : 0.05 * C1 + 1.15 * (dd - C1));
          }
        }
        const c = ey - qa[j] * dd - qb[j] * dd * dd;
        if (c > s) {
          s = c;
          q = qSeg[j];
          qd = dd;
        }
        if (L < lim) lim = L;
      }
      if (q >= 0) {
        // Buckel und Mulden – dicht an der Straße flach, weiter draußen kräftiger
        const n1 = noise(x * 0.032 + 3.1, z * 0.032) - 0.5;
        const n2 = noise(x * 0.11, z * 0.11 + 7.7) - 0.5;
        s += n1 * 7 * smooth((qd - 5) / 26) + n2 * 1.6 * smooth((qd - 3) / 10);
      }
      if (klamm) {
        // Klamm quer unter der Schanze: Rinne mit steilen Wänden, der Bach fällt zur tieferen Seite.
        const ox = x - klamm.x;
        const oz = z - klamm.z;
        const along = Math.abs(ox * klamm.ax + oz * klamm.az);
        const across = ox * klamm.rx + oz * klamm.rz;
        if (Math.abs(across) < 52 && along < 40) {
          const L = klamm.y - across * klamm.fall * 0.18 + 1.6 * Math.max(0, along - klamm.half) + 0.12 * Math.max(0, Math.abs(across) - 8);
          if (L < lim) lim = L;
        }
      }
      if (lim < s) s = lim;
      unter[v] = under;
      if (s > w + 0.02) {
        hY[v] = s;
        qV[v] = q;
      } else hY[v] = w;
    }
  }
  return { wY, hY, qV, unter };
}
