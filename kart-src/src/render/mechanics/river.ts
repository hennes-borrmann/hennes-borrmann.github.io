// Dschungel-Fluss: Darstellung des Flusses – Wasser, Flöße (der Boden, auf dem gefahren wird),
// Wasserfall und Furt.
//
// Flöße – sie SIND die Fahrbahn. Auf dem Flussstück (track.rivers, EDGE_RIVER) zeichnet die stehende
// Welt nichts (world.ts endet eine halbe Abschnittslänge vor dem ersten und beginnt eine halbe hinter
// dem letzten Fluss-Abschnitt). Boden ist nur, wo raftAt ein Floß meldet:
//   * Jede Ecke eines Floßes liegt in „Flusskoordinaten“ (a, lat, dy): a = Meter ab Flussanfang wie in
//     raftLane ((seg − first) · step + along), lat seitlich, dy über dem Deck. Der Ort in der Welt
//     entsteht wie in world.ts: Abschnittsmitten geradlinig verbunden; die Deckhöhe ist die der
//     Fahrbahn (py + lat · bank, zwischen den Abschnitten linear) – auf 2 cm gleich groundNow
//     (geprüft in tests/unit/flussbild.test.ts).
//   * Je Bahn treiben Flöße der Länge length im Abstand length + gap; wo eins liegt, folgt allein
//     aus der Rennzeit (raftDrift). Jedes Floß ist eine feste Vorlage aus Querreihen (u = 0 … length),
//     die je Bild auf seinen Platz im Fluss gelegt wird. Die Reihe, die gerade über die Grenze des
//     Flussstücks hinausreicht, wird genau auf die Grenze gezogen: das Deck endet dort, wo die Physik
//     es enden lässt. Jenseits davon taucht das Floß unter den Anleger (eine Plankenschürze verdeckt
//     die Stelle) und kommt an der Kante des Wasserfalls wieder hervor, kippt und stürzt hinab.
//   * Mitte: lückenlose Kette kleiner Bambusflöße mit gelben Schwimmfässern; die Querfugen wandern
//     mit der Strömung. Außen: lange Stammflöße; Bug und Heck mit breiter rot-weißer Kante, Stangen
//     mit Wimpeln – rot am Ende in Fahrtrichtung (dort kommt gleich Wasser), grün am Anfang (hier
//     wieder drauf); Kiste, Fass und Lampe am äußeren Rand.
//
// Wasser: eine Fläche RIVER_WATER unter den Decks, ufernah breiter als die Fahrbahn, mit hellen
// Strömungsstreifen in den Tempi der Bahnen; Felsen mit Schaum. Wasserfall an der Kante hinter der
// Schanze: fallende Bänder (Eckenfarben laufen), Becken mit Schaumring, Gischtbällchen. Furt: eine
// halbtransparente Fläche 0,12 m über dem Sand, in der Querströmung (track.belts) helle Streifen,
// Blätter und Schaum, die mit 3,2 m/s nach rechts ziehen; Pfähle mit Stoffpfeilen.
//
// Zeichentechnik (harte Vorgabe, tests/unit/shaderregeln.test.ts): nur eingebaute Materialien, keine
// Texturen. Netze aus MeshBuilder, Ecken je Bild neu gesetzt (DynamicDrawUsage), Toon-Material mit der
// gemeinsamen Kontur, Teilchen über fx.
//
// Zeichenaufrufe mit detail: Deck 1, Floßzubehör 1 + Kontur 1, Wasser 1, Streifen 1, Wasserfall/Treibgut 1,
// Gischt 1, Furt 1, Feststehendes 1 + Kontur 1 = 10. Ohne detail: 8 (ohne Konturen).
// Dreiecke: group.userData.triangles (sichtbar höchstens; Konturen eingerechnet).

import * as THREE from 'three';
import { raftDrift, type RaftLane } from '../../game/mechanics';
import { EDGE_GAP, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { RIVER_WATER } from '../world';
import { boxT, cylT, face, type Xform } from './machineKit';

// --- Farben ---------------------------------------------------------------------

const C_LOG: RGB[] = [rgb(0x7a4826), rgb(0x8c5730), rgb(0x6b3e20), rgb(0x83502b)];
const C_LOG_END = rgb(0xc58d55);
const C_LOG_END_D = rgb(0xa8743f);
const C_HOLM = rgb(0x472915);
const C_ROPE = rgb(0xd9bf78);
const C_RED = rgb(0xe8261c);
const C_WHITE = rgb(0xf7f2e8);
const C_BAMBOO: RGB[] = [rgb(0xe6d38c), rgb(0xd3bd6a), rgb(0xdcc87a)];
const C_BAMBOO_END = rgb(0xb59c4e);
const C_JOINT = rgb(0x5a3b20);
const C_FLOAT = rgb(0xf5c21b);
const C_POLE = rgb(0x3b2a1a);
const C_FLAG_RED = rgb(0xff2a1a);
const C_FLAG_GREEN = rgb(0x22d052);
const C_CRATE = rgb(0xb07a40);
const C_CRATE_D = rgb(0x6a4422);
const C_BARREL = rgb(0x7b4226);
const C_BAND = rgb(0x2c2a2a);
const C_LAMP = rgb(0xffd54a);
const C_FOAM = rgb(0xeef7f3);
const C_WATER_A = rgb(0x52735c);
const C_WATER_B = rgb(0x687a50);
const C_WATER_C = rgb(0x416a62);
const C_MUD = rgb(0x5e4a33);
const C_FALL_TOP = rgb(0x6fb2a6);
const C_FALL_MID = rgb(0xa6ddd3);
const C_FALL_LIGHT = rgb(0xf2fbf8);
const C_PLANK: RGB[] = [rgb(0x7d5434), rgb(0x684329), rgb(0x8a5f3a)];
const C_PILE = rgb(0x4a3322);
const C_ROCK = rgb(0x6d6a62);
const C_MOSS = rgb(0x5d7a36);
const C_LEAF: RGB[] = [rgb(0x4f8f2a), rgb(0x8fae2c), rgb(0xc98a2a)];
const C_ARROW = rgb(0xff6a1a);

// --- Maße -----------------------------------------------------------------------

/** Umlaufsinn tauschen: Ecke v eines Dreiecks liest die Vorlage bei v + SWAP[v % 3]. */
const SWAP = [0, 1, -1];

/** Wasserspiegel unter den Floßdecks (world.ts: RIVER_WATER). */
const WD = RIVER_WATER;
/** So weit reicht das Wasser seitlich über die Fahrbahnkante hinaus (wenn die Kurve es zulässt). */
const WATER_OUT = 18;
/** Unter dem Anleger liegen die Flöße so tief (Oberkante unter dem Wasserspiegel). */
const SINK = 0.95;
/** An der Kante des Wasserfalls ragt das Deck noch so weit unter seiner Fahrhöhe … */
const SINK_LIP = 0.3;
/** … und taucht über diese Länge vor der Kante wieder auf. */
const RISE = 1.6;
/** Bogen über die Kante: waagrechter Weg F (1 − e^(−d/F)), Fall d − waagrechter Weg. */
const FALL_F = 3.4;
/** Höhe des Beckens unter dem Wasserfall (dort liegt das Gelände der Lücke). */
const POOL_Y = 2.2;
/** Rot-weiße Kante an Bug und Heck der Außenflöße (Meter). */
const END_ZONE = 2;
/** Glieder der Kette in der Mitte: so viele je Länge der Bahn (gap = 0). */
const CHAIN_PER = 4;
/** Bis hierhin reicht die Erdwand unter dem Ufer hinab (unter den See des Tieflands, liquidY = −1,2). */
const BANK_FOOT = -2;
/** Furt: so hoch steht das Wasser über dem Sand. */
const FORD_H = 0.12;

const UP: V3 = [0, 1, 0];
const ID: Xform = (x, y, z) => [x, y, z];

// ---------------------------------------------------------------------------------
// Rahmen entlang der Strecke: Abschnittsmitten geradlinig verbunden (wie world.ts), a in Metern ab dem
// Abschnitt first (a = (seg − first) · step). Ergebnis von at() in den Feldern.

class Frame {
  readonly n: number;
  readonly cx: Float64Array;
  readonly cy: Float64Array;
  readonly cz: Float64Array;
  /** Wasserspiegel (Mitte) je Knoten. */
  readonly wy: Float64Array;
  readonly rx: Float64Array;
  readonly rz: Float64Array;
  readonly tx: Float64Array;
  readonly tz: Float64Array;
  readonly bk: Float64Array;
  readonly seg: Int32Array;
  // Ergebnis
  x = 0;
  z = 0;
  /** Rechtsvektor (ungenormt, wie gemittelt: damit liegt jeder Ort genau auf der Geraden zwischen den Knoten) */
  qx = 0;
  qz = 0;
  /** Rechts und voraus (genormt) */
  nrx = 0;
  nrz = 0;
  ntx = 0;
  ntz = 0;
  y = 0;
  w = 0;
  b = 0;
  /** zuletzt gerechnetes a (Ecken einer Querreihe folgen dicht aufeinander) */
  private last = NaN;

  constructor(
    t: Track,
    first: number,
    readonly pre: number,
    count: number,
    /** ab diesem Knoten steigt der Wasserspiegel nicht mehr (Ende des Flusses) */
    flatFrom: number,
  ) {
    this.n = count;
    const mk = (): Float64Array => new Float64Array(count);
    this.cx = mk();
    this.cy = mk();
    this.cz = mk();
    this.wy = mk();
    this.rx = mk();
    this.rz = mk();
    this.tx = mk();
    this.tz = mk();
    this.bk = mk();
    this.seg = new Int32Array(count);
    let s = first;
    for (let k = 0; k < pre; k++) s = t.prev[s];
    for (let k = 0; k < count; k++) {
      this.seg[k] = s;
      this.cx[k] = t.px[s];
      this.cy[k] = t.py[s];
      this.cz[k] = t.pz[s];
      this.rx[k] = rightX(t, s);
      this.rz[k] = rightZ(t, s);
      this.tx[k] = t.tx[s];
      this.tz[k] = t.tz[s];
      this.bk[k] = t.bank[s];
      this.wy[k] = k > flatFrom ? Math.min(this.wy[k - 1], t.py[s] - WD) : t.py[s] - WD;
      s = t.next[s];
    }
  }

  /** Ort der Mittellinie bei a (Meter ab first); y = Fahrbahnhöhe (Mitte), w = Wasserspiegel (Mitte), b = Querneigung. */
  at(a: number, step: number): void {
    if (a === this.last) return;
    this.last = a;
    let u = a / step + this.pre;
    if (u < 0) u = 0;
    if (u > this.n - 1) u = this.n - 1;
    let k = Math.floor(u);
    if (k > this.n - 2) k = this.n - 2;
    const f = u - k;
    const g = 1 - f;
    const j = k + 1;
    this.x = this.cx[k] * g + this.cx[j] * f;
    this.z = this.cz[k] * g + this.cz[j] * f;
    this.y = this.cy[k] * g + this.cy[j] * f;
    this.w = this.wy[k] * g + this.wy[j] * f;
    this.qx = this.rx[k] * g + this.rx[j] * f;
    this.qz = this.rz[k] * g + this.rz[j] * f;
    // Querneigung: die Höhe ist (py + lat · bank) linear verbunden – also bank linear.
    this.b = this.bk[k] * g + this.bk[j] * f;
    const rl = Math.sqrt(this.qx * this.qx + this.qz * this.qz) || 1;
    this.nrx = this.qx / rl;
    this.nrz = this.qz / rl;
    const tx = this.tx[k] * g + this.tx[j] * f;
    const tz = this.tz[k] * g + this.tz[j] * f;
    const tl = Math.sqrt(tx * tx + tz * tz) || 1;
    this.ntx = tx / tl;
    this.ntz = tz / tl;
  }
}

// ---------------------------------------------------------------------------------
// Vorlagen: Netze in Floßkoordinaten (x = lat, y = dy über dem Deck, z = u ab dem Floßanfang).

interface Tpl {
  pos: Float32Array;
  nor: Float32Array;
  onr: Float32Array | null;
  col: Float32Array;
  /** Flattern seitlich (Wimpel) bzw. längs (Bugwelle): Ausschlag je Ecke. */
  wx: Float32Array;
  wz: Float32Array;
  /** Nur beim Deck: die Querreihen (u), auf denen alle Ecken liegen – aufsteigend. */
  rows: Float64Array | null;
  count: number;
  /** Alle vorkommenden u (ohne Flattern) und je Ecke ihr Platz darin (−1: flattert längs) – der Rahmen wird je u einmal gerechnet. */
  uu: Float64Array;
  ui: Int32Array;
}

class TplBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly onr: number[] = [];
  private readonly col: number[] = [];
  private readonly wx: number[] = [];
  private readonly wz: number[] = [];
  constructor(private readonly outline: boolean) {}

  add(mb: MeshBuilder, wave?: (x: number, y: number, z: number) => [number, number]): void {
    if (mb.empty) return;
    const g = mb.build();
    if (this.outline) addSmoothNormals(g);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const c = g.getAttribute('color');
    const o = g.getAttribute('onormal');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      this.pos.push(x, y, z);
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(c.getX(i), c.getY(i), c.getZ(i));
      if (o) this.onr.push(o.getX(i), o.getY(i), o.getZ(i));
      const w = wave ? wave(x, y, z) : [0, 0];
      this.wx.push(w[0]);
      this.wz.push(w[1]);
    }
    g.dispose();
  }

  done(rows: number[] | null = null): Tpl {
    const map = new Map<number, number>();
    const ui = new Int32Array(this.pos.length / 3);
    for (let v = 0; v < ui.length; v++) {
      if (this.wz[v] !== 0) {
        ui[v] = -1;
        continue;
      }
      const u = Math.fround(this.pos[v * 3 + 2]);
      let j = map.get(u);
      if (j === undefined) map.set(u, (j = map.size));
      ui[v] = j;
    }
    const uu = new Float64Array(map.size);
    for (const [u, j] of map) uu[j] = u;
    return {
      uu,
      ui,
      pos: new Float32Array(this.pos),
      nor: new Float32Array(this.nor),
      onr: this.outline ? new Float32Array(this.onr) : null,
      col: new Float32Array(this.col),
      wx: new Float32Array(this.wx),
      wz: new Float32Array(this.wz),
      // (in Float32 gerundet wie die Ecken – so lassen sich Ecken und Reihen genau vergleichen)
      rows: rows ? new Float64Array([...new Set(rows.map(Math.fround))].sort((p, q) => p - q)) : null,
      count: this.pos.length / 3,
    };
  }
}

/** Deckfläche (oben) über u0 … u1, lat x0 … x1. */
function top(mb: MeshBuilder, x0: number, x1: number, u0: number, u1: number, c: RGB): void {
  face(mb, [x0, 0, u0], [x1, 0, u0], [x1, 0, u1], [x0, 0, u1], UP, c);
}
/** Seitenwand bei lat x (nach außen out = ±1) über u0 … u1, Höhe y0 … y1. */
function side(mb: MeshBuilder, x: number, out: number, u0: number, u1: number, y0: number, y1: number, c: RGB): void {
  face(mb, [x, y0, u0], [x, y0, u1], [x, y1, u1], [x, y1, u0], [out, 0, 0], c);
}
/** Stirnwand bei u (nach out = ±1) über lat x0 … x1, Höhe y0 … y1. */
function end(mb: MeshBuilder, u: number, out: number, x0: number, x1: number, y0: number, y1: number, c: RGB): void {
  face(mb, [x0, y0, u], [x1, y0, u], [x1, y1, u], [x0, y1, u], [0, 0, out], c);
}

interface RaftKit {
  deck: Tpl;
  /** Zubehör mit Kontur (Stangen, Wimpel, Kisten, Lampe) */
  gear: Tpl | null;
  /** Zubehör ohne Kontur (Schaum, Schwimmfässer, Seile) */
  flat: Tpl | null;
}

/** Großes Stammfloß einer Außenbahn. */
function logRaft(lat0: number, lat1: number, L: number, detail: boolean, seed: number): RaftKit {
  const rnd = seeded(seed);
  const outer = Math.abs(lat0) > Math.abs(lat1) ? lat0 : lat1;
  const os = Math.sign(outer);
  const W = lat1 - lat0;
  const logW = detail ? 0.9 : 1.6;
  const nLog = Math.max(1, Math.round((L - 2 * END_ZONE) / logW));
  const rows: number[] = [0, END_ZONE / 2, END_ZONE];
  for (let i = 1; i < nLog; i++) rows.push(END_ZONE + ((L - 2 * END_ZONE) * i) / nLog);
  rows.push(L - END_ZONE, L - END_ZONE / 2, L);
  const deck = new MeshBuilder();
  const cells = detail ? 8 : 4;
  const DECK_B = -0.78;
  const BAND = detail ? -0.34 : DECK_B;
  for (let i = 0; i + 1 < rows.length; i++) {
    const u0 = rows[i];
    const u1 = rows[i + 1];
    const zone = u1 <= END_ZONE + 1e-6 || u0 >= L - END_ZONE - 1e-6;
    if (zone) {
      for (let c = 0; c < cells; c++) top(deck, lat0 + (W * c) / cells, lat0 + (W * (c + 1)) / cells, u0, u1, (c + i) % 2 === 0 ? C_RED : C_WHITE);
    } else {
      const c = C_LOG[(i + (rnd() < 0.3 ? 2 : 0)) % C_LOG.length];
      top(deck, lat0, lat1, u0, u1, shade(c, 0.94 + rnd() * 0.12));
    }
  }
  // Seitenwände: oben die Stammenden (je `group` Stämme ein Feld), unten der dunkle Längsholm
  const group = detail ? 2 : 4;
  const inZone = (i: number): boolean => rows[i + 1] <= END_ZONE + 1e-6 || rows[i] >= L - END_ZONE - 1e-6;
  const spans: [number, number, boolean][] = [];
  for (let i = 0; i + 1 < rows.length; ) {
    let j = i + 1;
    if (!inZone(i)) while (j - i < group && j + 1 < rows.length && !inZone(j)) j++;
    spans.push([rows[i], rows[j], inZone(i)]);
    i = j;
  }
  for (const [x, out] of [
    [lat0, -1],
    [lat1, 1],
  ] as const) {
    spans.forEach(([u0, u1, zone], n) => {
      side(deck, x, out, u0, u1, BAND, 0, zone ? (n % 2 === 0 ? C_RED : C_WHITE) : n % 2 === 0 ? C_LOG_END : C_LOG_END_D);
      if (BAND > DECK_B) side(deck, x, out, u0, u1, DECK_B, BAND, C_HOLM);
    });
  }
  // Stirnwände rot-weiß
  for (const [u, out] of [
    [0, -1],
    [L, 1],
  ] as const) {
    for (let c = 0; c < cells; c++) end(deck, u, out, lat0 + (W * c) / cells, lat0 + (W * (c + 1)) / cells, DECK_B, 0, c % 2 === 0 ? C_WHITE : C_RED);
  }
  const deckT = new TplBuilder(false);
  deckT.add(deck);

  // Zubehör mit Kontur: zwei Stangen mit Wimpeln an jedem Ende, Kiste, Fass, Lampe am äußeren Rand
  const gearT = new TplBuilder(true);
  const poles = new MeshBuilder();
  const flags = new MeshBuilder();
  const POLE_H = 3.4;
  for (const [u, c] of [
    [L - 0.45, C_FLAG_RED],
    [0.45, C_FLAG_GREEN],
  ] as const) {
    for (const x of [lat0 + 0.22, lat1 - 0.22]) {
      cylT(poles, ID, x, u, 0.075, 0, POLE_H + 0.15, c, c, 4, 'top');
      // Wimpel: zeigt flussauf (die Luft steht, das Floß treibt), flattert seitlich
      const a: V3 = [x, POLE_H - 0.05, u];
      const b: V3 = [x, POLE_H - 0.85, u];
      const tip: V3 = [x, POLE_H - 0.45, u - 1.5];
      flags.tri(a, b, tip, c);
      flags.tri(a, tip, b, c);
    }
  }
  gearT.add(poles);
  gearT.add(flags, (_x, _y, z) => {
    // Ausschlag wächst zur Spitze hin
    const d = Math.min(1, Math.max(0, (Math.min(Math.abs(z - (L - 0.45)), Math.abs(z - 0.45)) - 0.05) / 1.45));
    return [d * 0.35, 0];
  });
  const props = new MeshBuilder();
  const xo = (w: number): number => outer - os * w; // Mitte eines Körpers der Breite 2w am äußeren Rand
  // Kiste (0,45 m in die Bahn)
  const uc = L * 0.32 + rnd() * 4;
  boxT(props, ID, Math.min(xo(0.225) - 0.225, xo(0.225) + 0.225), Math.max(xo(0.225) - 0.225, xo(0.225) + 0.225), 0, 0.55, uc - 0.4, uc + 0.4, C_CRATE, { top: C_CRATE_D, noBottom: true });
  if (detail) boxT(props, ID, Math.min(xo(0.2) - 0.2, xo(0.2) + 0.2), Math.max(xo(0.2) - 0.2, xo(0.2) + 0.2), 0.55, 0.9, uc - 0.15, uc + 0.3, C_CRATE_D, { noBottom: true });
  // Fass (Halbmesser 0,24)
  const ub = L * 0.58 + rnd() * 4;
  cylT(props, ID, xo(0.24), ub, 0.24, 0, 0.75, C_BARREL, C_CRATE_D, detail ? 7 : 5, 'top');
  if (detail) cylT(props, ID, xo(0.24), ub, 0.25, 0.5, 0.58, C_BAND, undefined, 7);
  // Lampe: Pfosten mit Laterne
  if (detail) {
    const ul = L * 0.8;
    cylT(props, ID, xo(0.1), ul, 0.06, 0, 1.6, C_POLE, undefined, 5);
    boxT(props, ID, xo(0.1) - 0.16, xo(0.1) + 0.16, 1.6, 1.95, ul - 0.16, ul + 0.16, C_LAMP, { top: C_POLE });
  }
  gearT.add(props);

  // Ohne Kontur: Schaum an Bug und Heck und an der Außenseite, Seilbindungen
  const flatT = new TplBuilder(false);
  const foam = new MeshBuilder();
  const yF = -WD + 0.025;
  const steps = 6;
  for (let k = 0; k < steps; k++) {
    const x0 = lat0 - 0.2 + ((W + 0.4) * k) / steps;
    const x1 = lat0 - 0.2 + ((W + 0.4) * (k + 1)) / steps;
    const xm = (x0 + x1) / 2;
    // vorn (in Fahrtrichtung) eine Bugwelle, hinten ein kurzes Kielwasser – gezackt
    foam.tri([x0, yF, L], [x1, yF, L], [xm, yF, L + 0.9 + (k % 2) * 0.4], C_FOAM);
    foam.tri([x1, yF, 0], [x0, yF, 0], [xm, yF, -0.5 - (k % 2) * 0.3], C_FOAM);
  }
  for (let u = 1; u + 3 < L; u += 3.2) {
    const u1 = u + 2.4 + (Math.floor(u) % 2) * 0.6;
    face(foam, [outer, yF, u], [outer + os * 0.28, yF, u + 0.4], [outer + os * 0.28, yF, u1 - 0.4], [outer, yF, u1], UP, C_FOAM);
  }
  flatT.add(foam, (_x, _y, z) => [0, z > L + 0.01 ? 0.35 : z < -0.01 ? -0.25 : 0]);
  if (detail) {
    const ropes = new MeshBuilder();
    for (let u = 3; u < L - 2; u += 6.5) {
      for (const x of [lat0, lat1]) {
        const s = x === lat0 ? -1 : 1;
        boxT(ropes, ID, Math.min(x, x + s * 0.05), Math.max(x, x + s * 0.05), -0.62, 0.0, u - 0.12, u + 0.12, C_ROPE, { noBottom: true });
      }
    }
    flatT.add(ropes);
  }
  return { deck: deckT.done(rows), gear: gearT.done(), flat: flatT.done() };
}

/** Glied der Kette in der Mitte: kleines Bambusfloß mit Schwimmfässern. */
function chainRaft(lat0: number, lat1: number, L: number, detail: boolean): RaftKit {
  const W = lat1 - lat0;
  const J = 0.3;
  const n = detail ? 5 : 3;
  const rows = [0, J];
  for (let i = 1; i < n; i++) rows.push(J + ((L - J) * i) / n);
  rows.push(L);
  const deck = new MeshBuilder();
  const cols = detail ? 6 : 4;
  // Fuge: ein dunkles Seilband über die ganze Breite
  top(deck, lat0, lat1, 0, J, C_JOINT);
  for (let i = 1; i + 1 < rows.length; i++) {
    for (let c = 0; c < cols; c++) top(deck, lat0 + (W * c) / cols, lat0 + (W * (c + 1)) / cols, rows[i], rows[i + 1], C_BAMBOO[(c + (c === 2 ? 1 : 0)) % C_BAMBOO.length]);
  }
  for (const [x, out] of [
    [lat0, -1],
    [lat1, 1],
  ] as const) {
    for (let i = 0; i + 1 < rows.length; i++) side(deck, x, out, rows[i], rows[i + 1], -0.32, 0, i === 0 ? C_JOINT : C_BAMBOO_END);
  }
  const deckT = new TplBuilder(false);
  deckT.add(deck);
  let flat: Tpl | null = null;
  if (detail) {
    const f = new TplBuilder(false);
    const fl = new MeshBuilder();
    for (const x of [lat0 + 0.5, lat1 - 0.5]) {
      // liegendes Fass entlang u: Achse = lokale y-Achse dieses Rahmens
      const T: Xform = (px, py, pz) => [x + px, -WD + 0.02 + pz, py];
      cylT(fl, T, 0, 0, 0.3, 0.7, L - 0.7, C_FLOAT, undefined, 5);
    }
    f.add(fl);
    flat = f.done();
  }
  return { deck: deckT.done(rows), gear: null, flat };
}

// ---------------------------------------------------------------------------------

/** Eine Bahn zur Laufzeit: Vorlagen und die Plätze (Flöße), die gerade im Bild sein können. */
interface Lane {
  src: RaftLane;
  /** Länge eines Floßes bzw. Glieds und Abstand von Floßanfang zu Floßanfang */
  len: number;
  pitch: number;
  kit: RaftKit;
  slots: number;
  /** je Platz: a des Floßanfangs (NaN = nicht im Bild) – je Bild gesetzt */
  a0: Float64Array;
  /** ist das ein Außenfloß (Tropfen am Bug) */
  big: boolean;
}

/** Ein Abschnitt eines dynamischen Netzes: eine Vorlage auf einem Platz einer Bahn. */
interface Inst {
  tpl: Tpl;
  lane: number;
  slot: number;
  /** erste Ecke im Netz */
  at: number;
  deck: boolean;
}

export function buildRiver(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'Fluss';
  const disposables: { dispose(): void }[] = [];
  let tris = 0;
  const step = t.step;
  const riv = t.rivers[0];
  const lastSeg = riv.first + riv.count - 1;

  // --- Kante des Wasserfalls: die erste Lücke hinter dem Fluss (sonst endet alles unter dem Anleger)
  let gapK = -1;
  for (let k = 1, s = t.next[lastSeg]; k < 40; k++, s = t.next[s]) {
    if (t.edge[s] & EDGE_GAP) {
      gapK = k;
      break;
    }
  }
  const PRE = 12;
  const POST = (gapK > 0 ? gapK : 8) + 14;
  const F = new Frame(t, riv.first, PRE, PRE + riv.count + POST, PRE + riv.count - 1);
  const F2 = new Frame(t, riv.first, PRE, PRE + riv.count + POST, PRE + riv.count - 1);

  /** Grenzen des Flussstücks (Meter ab Flussanfang): dort endet bzw. beginnt die feste Fahrbahn. */
  const aLo = -0.5 * step;
  const aHi = (riv.count - 0.5) * step;
  const hasFall = gapK > 0;
  const aLip = hasFall ? (riv.count - 1 + gapK - 0.5) * step : aHi + 6;
  /** Händigkeit: (rechts × oben) · voraus < 0 → Umlaufsinn der Vorlagen umdrehen. */
  // (rechts × oben) = (−r_z, 0, r_x); · voraus = −r_z t_x + r_x t_z. Ist das negativ, ist der Rahmen
  // gespiegelt gegenüber (x, y, z) der Vorlagen – dann Umlaufsinn tauschen.
  F.at(0, step);
  const swap = -F.nrz * F.ntx + F.nrx * F.ntz < 0;

  // Wasserbreite je Knoten und Seite: nicht weiter, als die Kurve innen zulässt
  const lwL = new Float64Array(F.n);
  const lwR = new Float64Array(F.n);
  {
    const raw = new Float64Array(F.n);
    for (let k = 0; k < F.n; k++) {
      const j = Math.min(F.n - 1, k + 1);
      const i = Math.max(0, k - 1);
      // Krümmung (vorzeichenbehaftet): Drehung des Rechtsvektors je Meter
      raw[k] = (F.rx[i] * F.rz[j] - F.rz[i] * F.rx[j]) / Math.max(1e-6, (j - i) * step);
    }
    for (let k = 0; k < F.n; k++) {
      let kl = 0;
      let kr = 0;
      for (let d = -6; d <= 6; d++) {
        const c = raw[Math.max(0, Math.min(F.n - 1, k + d))];
        // Auf der Seite, zu der sich die Kurve schließt, laufen die Querlinien zusammen.
        kl = Math.max(kl, c);
        kr = Math.max(kr, -c);
      }
      const wh = t.wh[F.seg[k]];
      lwL[k] = Math.min(wh + WATER_OUT, kl > 1e-4 ? 0.75 / kl : Infinity);
      lwR[k] = Math.min(wh + WATER_OUT, kr > 1e-4 ? 0.75 / kr : Infinity);
    }
  }
  const lwAt = (a: number, sgn: number): number => {
    let u = a / step + PRE;
    u = Math.max(0, Math.min(F.n - 1.001, u));
    const k = Math.floor(u);
    const f = u - k;
    const arr = sgn < 0 ? lwL : lwR;
    return arr[k] * (1 - f) + arr[k + 1] * f;
  };

  // --- Bogen über die Kante --------------------------------------------------------
  F.at(aLip, step);
  const lip = { x: F.x, z: F.z, rx: F.qx, rz: F.qz, nrx: F.nrx, nrz: F.nrz, tx: F.ntx, tz: F.ntz, w: F.w, b: F.b };
  /** Fallhöhe an der Kante bei lat (Wasserspiegel bis Becken). */
  const fallH = (lat: number): number => Math.max(1, lip.w + lat * lip.b - POOL_Y);
  /** Weglänge d, bei der der Bogen die Tiefe h erreicht. */
  const dOf = (h: number): number => {
    let d = h + FALL_F;
    for (let i = 0; i < 5; i++) d = h + FALL_F * (1 - Math.exp(-d / FALL_F));
    return d;
  };

  /** So tief liegt ein Floß an der Stelle a unter seiner Fahrhöhe: unter den Anlegern getaucht, vor der Kante wieder auf. */
  function sinkAt(a: number): number {
    if (a < aLo - 1e-9) return SINK;
    if (a <= aHi + 1e-9) return 0;
    const r = hasFall ? (aLip - a) / RISE : 1;
    return r >= 1 ? SINK : SINK_LIP + (SINK - SINK_LIP) * Math.max(0, r);
  }

  // Ergebnis von place(): Ort und Rahmen (rechts, oben, voraus) einer Ecke
  const P = { x: 0, y: 0, z: 0, rx: 0, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: 0 };
  /**
   * Ecke eines Floßes: a, lat, dy über dem Deck; snap: 0 frei, 1 = genau an aLo/aHi gezogene Reihe.
   * Im Fluss liegt das Deck auf Fahrbahnhöhe; davor und dahinter taucht es unter den Anleger, hinter
   * der Kante des Wasserfalls stürzt es den Bogen hinab.
   */
  function place(a: number, lat: number, dy: number, snapped: boolean): void {
    if (a > aLip && hasFall) {
      let d = a - aLip;
      const h = fallH(lat);
      const dMax = dOf(h);
      let k = 1;
      if (d >= dMax) {
        d = dMax;
        k = 0;
      }
      const e = Math.exp(-d / FALL_F);
      const fw = FALL_F * (1 - e);
      const dr = d - fw;
      const c = e;
      const s = 1 - e;
      const nl = Math.hypot(c, s);
      // Bahn: voraus t·c − oben·s; Normale: t·s + oben·c
      const ntx = lip.tx * (s / nl);
      const nty = c / nl;
      const ntz = lip.tz * (s / nl);
      const off = (WD - SINK_LIP + dy) * k;
      P.x = lip.x + lip.rx * lat + lip.tx * fw + ntx * off;
      P.y = lip.w + lat * lip.b - dr + nty * off;
      P.z = lip.z + lip.rz * lat + lip.tz * fw + ntz * off;
      P.rx = lip.nrx;
      P.rz = lip.nrz;
      P.ux = ntx;
      P.uy = nty;
      P.uz = ntz;
      P.fx = lip.tx * (c / nl);
      P.fy = -s / nl;
      P.fz = lip.tz * (c / nl);
      return;
    }
    if (a < aLo - 5) a = aLo - 5;
    if (!hasFall && a > aLip) a = aLip;
    F2.at(a, step);
    let y: number;
    if (a <= aHi + 1e-9) y = F2.y + lat * F2.b;
    else y = F2.w + lat * F2.b + WD;
    if (!snapped) y -= sinkAt(a);
    P.x = F2.x + F2.qx * lat;
    P.y = y + dy;
    P.z = F2.z + F2.qz * lat;
    P.rx = F2.nrx;
    P.rz = F2.nrz;
    P.ux = 0;
    P.uy = 1;
    P.uz = 0;
    P.fx = F2.ntx;
    P.fy = 0;
    P.fz = F2.ntz;
  }

  // --- Bahnen ------------------------------------------------------------------------
  const aMinV = aLo - 4.5;
  const aMaxV = hasFall ? aLip + dOf(fallH(0)) + 2 : aLip;
  const lanes: Lane[] = riv.lanes.map((l, i) => {
    const chain = l.gap <= 0;
    const len = chain ? l.length / CHAIN_PER : l.length;
    const pitch = chain ? len : l.length + l.gap;
    const kit = chain ? chainRaft(l.lat0, l.lat1, len, detail) : logRaft(l.lat0, l.lat1, len, detail, 101 + i * 17);
    const slots = Math.ceil((aMaxV - aMinV + len) / pitch) + 1;
    return { src: l, len, pitch, kit, slots, a0: new Float64Array(slots).fill(NaN), big: !chain };
  });

  // --- Dynamische Netze: Deck, Zubehör (zuerst alles mit Kontur, dann ohne) ---------------
  function layout(pick: (k: RaftKit) => Tpl | null, deck: boolean, list: Inst[], at: number): number {
    lanes.forEach((L, li) => {
      const tpl = pick(L.kit);
      if (!tpl) return;
      for (let s = 0; s < L.slots; s++) {
        list.push({ tpl, lane: li, slot: s, at, deck });
        at += tpl.count;
      }
    });
    return at;
  }
  const deckInst: Inst[] = [];
  const deckCount = layout((k) => k.deck, true, deckInst, 0);
  const gearInst: Inst[] = [];
  const gearOutlined = layout((k) => k.gear, false, gearInst, 0);
  const gearCount = layout((k) => k.flat, false, gearInst, gearOutlined);

  interface Dyn {
    geo: THREE.BufferGeometry;
    pos: Float32Array;
    nor: Float32Array;
    onr: Float32Array | null;
    attrs: THREE.BufferAttribute[];
  }
  function dynMesh(count: number, insts: Inst[], outlineCount: number, name: string): Dyn {
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const onr = outlineCount > 0 ? new Float32Array(count * 3) : null;
    for (const I of insts) {
      const n = I.tpl.count;
      for (let v = 0; v < n; v++) {
        // Umlaufsinn: in jedem Dreieck die zweite und dritte Ecke tauschen, wenn der Rahmen spiegelt
        const src = swap ? SWAP[v % 3] + v : v;
        const o = (I.at + v) * 3;
        col[o] = I.tpl.col[src * 3];
        col[o + 1] = I.tpl.col[src * 3 + 1];
        col[o + 2] = I.tpl.col[src * 3 + 2];
      }
    }
    const geo = new THREE.BufferGeometry();
    const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    const na = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa);
    geo.setAttribute('normal', na);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const attrs = [pa, na];
    if (onr) {
      const oa = new THREE.BufferAttribute(onr, 3).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('onormal', oa);
      attrs.push(oa);
    }
    disposables.push(geo);
    const mat = toonMaterial({ vertexColors: true });
    disposables.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.frustumCulled = false;
    group.add(mesh);
    if (onr && detail) {
      // Kontur nur um die Teile mit Kontur: eigene Geometrie auf denselben Puffern, kürzer gezeichnet
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', pa);
      og.setAttribute('normal', na);
      og.setAttribute('onormal', geo.getAttribute('onormal'));
      og.setDrawRange(0, outlineCount);
      const outline = new THREE.Mesh(og, outlineMaterial());
      outline.name = 'outline';
      outline.frustumCulled = false;
      outline.matrixAutoUpdate = false;
      mesh.add(outline);
      disposables.push(og);
      tris += outlineCount / 3;
    }
    tris += count / 3;
    return { geo, pos, nor, onr, attrs };
  }
  const deckDyn = dynMesh(deckCount, deckInst, 0, 'deck');
  const gearDyn = gearCount > 0 ? dynMesh(gearCount, gearInst, gearOutlined, 'floss') : null;
  // Wie viele Dreiecke tatsächlich zu sehen sind: je Bahn höchstens so viele Flöße, wie das sichtbare Stück fasst.
  {
    let hidden = 0;
    for (const L of lanes) {
      const visible = Math.ceil((aMaxV - aMinV + L.len) / L.pitch);
      const spare = L.slots - visible;
      hidden += spare * (L.kit.deck.count + (L.kit.gear?.count ?? 0) * (detail ? 2 : 1) + (L.kit.flat?.count ?? 0));
    }
    tris -= hidden / 3;
  }

  // Zwischenspeicher je Querreihe (writeInst)
  let maxU = 1;
  for (const L of lanes) for (const tp of [L.kit.deck, L.kit.gear, L.kit.flat]) if (tp) maxU = Math.max(maxU, tp.uu.length);
  const RA = new Float64Array(maxU);
  const RS = new Uint8Array(maxU);
  const RF = new Uint8Array(maxU);
  const RX = new Float64Array(maxU);
  const RZ = new Float64Array(maxU);
  const RQX = new Float64Array(maxU);
  const RQZ = new Float64Array(maxU);
  const RY = new Float64Array(maxU);
  const RB = new Float64Array(maxU);
  const RRX = new Float64Array(maxU);
  const RRZ = new Float64Array(maxU);
  const RTX = new Float64Array(maxU);
  const RTZ = new Float64Array(maxU);

  // Versteck für Flöße außerhalb des Bildes: unter dem Anleger am Flussanfang
  F.at(aLo - 5, step);
  const hide = { x: F.x, y: F.y - 4, z: F.z };

  /** Legt eine Vorlage auf den Platz ihres Floßes (a0 = NaN: versteckt). */
  function writeInst(I: Inst, D: Dyn, a0: number, seconds: number): void {
    const tp = I.tpl;
    const n = tp.count;
    const pos = D.pos;
    const nor = D.nor;
    const onr = D.onr;
    if (!(a0 === a0)) {
      for (let v = 0; v < n; v++) {
        const o = (I.at + v) * 3;
        pos[o] = hide.x;
        pos[o + 1] = hide.y;
        pos[o + 2] = hide.z;
        nor[o] = 0;
        nor[o + 1] = 1;
        nor[o + 2] = 0;
        if (onr) {
          onr[o] = 0;
          onr[o + 1] = 0;
          onr[o + 2] = 0;
        }
      }
      return;
    }
    // Reihen an den Grenzen des Flussstücks: die erste Reihe jenseits der Grenze wird auf die Grenze gezogen
    let uLo = -Infinity;
    let uHi = Infinity;
    if (I.deck && tp.rows) {
      const rows = tp.rows;
      const lo = aLo - a0;
      const hi = aHi - a0;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] <= lo + 1e-9) uLo = rows[i];
        if (rows[i] >= hi - 1e-9 && uHi === Infinity) uHi = rows[i];
      }
    }
    const wv = Math.sin(seconds * 7.3 + a0 * 0.37);
    const wf = Math.sin(seconds * 2.1 + a0 * 0.11);
    // je Querreihe einmal: Rahmen und Höhe (hinter der Kante des Wasserfalls rechnet place() je Ecke)
    const uu = tp.uu;
    for (let j = 0; j < uu.length; j++) {
      const u = uu[j];
      let a = a0 + u;
      let snapped = false;
      if (u === uLo) {
        a = aLo;
        snapped = true;
      } else if (u === uHi) {
        a = aHi;
        snapped = true;
      }
      RA[j] = a;
      RS[j] = snapped ? 1 : 0;
      if (hasFall && a > aLip) {
        RF[j] = 1;
        continue;
      }
      RF[j] = 0;
      if (a < aLo - 5) a = aLo - 5;
      if (!hasFall && a > aLip) a = aLip;
      F2.at(a, step);
      let y = a <= aHi + 1e-9 ? F2.y : F2.w + WD;
      if (!snapped) y -= sinkAt(a);
      RX[j] = F2.x;
      RZ[j] = F2.z;
      RQX[j] = F2.qx;
      RQZ[j] = F2.qz;
      RY[j] = y;
      RB[j] = F2.b;
      RRX[j] = F2.nrx;
      RRZ[j] = F2.nrz;
      RTX[j] = F2.ntx;
      RTZ[j] = F2.ntz;
    }
    const ui = tp.ui;
    for (let v = 0; v < n; v++) {
      const src = swap ? SWAP[v % 3] + v : v;
      const s3 = src * 3;
      const lat = tp.pos[s3] + tp.wx[src] * wv;
      const dy = tp.pos[s3 + 1];
      const j = ui[src];
      const o = (I.at + v) * 3;
      const nx = tp.nor[s3];
      const ny = tp.nor[s3 + 1];
      const nz = tp.nor[s3 + 2];
      if (j >= 0 && RF[j] === 0) {
        pos[o] = RX[j] + RQX[j] * lat;
        pos[o + 1] = RY[j] + lat * RB[j] + dy;
        pos[o + 2] = RZ[j] + RQZ[j] * lat;
        const rx = RRX[j];
        const rz = RRZ[j];
        const fx = RTX[j];
        const fz = RTZ[j];
        nor[o] = rx * nx + fx * nz;
        nor[o + 1] = ny;
        nor[o + 2] = rz * nx + fz * nz;
        if (onr && tp.onr) {
          const ox = tp.onr[s3];
          const oz = tp.onr[s3 + 2];
          onr[o] = rx * ox + fx * oz;
          onr[o + 1] = tp.onr[s3 + 1];
          onr[o + 2] = rz * ox + fz * oz;
        }
        continue;
      }
      if (j >= 0) place(RA[j], lat, dy, RS[j] === 1);
      else place(a0 + tp.pos[s3 + 2] + tp.wz[src] * (0.6 + 0.4 * wf), lat, dy, false);
      pos[o] = P.x;
      pos[o + 1] = P.y;
      pos[o + 2] = P.z;
      nor[o] = P.rx * nx + P.ux * ny + P.fx * nz;
      nor[o + 1] = P.uy * ny + P.fy * nz;
      nor[o + 2] = P.rz * nx + P.uz * ny + P.fz * nz;
      if (onr && tp.onr) {
        const ox = tp.onr[s3];
        const oy = tp.onr[s3 + 1];
        const oz = tp.onr[s3 + 2];
        onr[o] = P.rx * ox + P.ux * oy + P.fx * oz;
        onr[o + 1] = P.uy * oy + P.fy * oz;
        onr[o + 2] = P.rz * ox + P.uz * oy + P.fz * oz;
      }
    }
  }

  // ============================ Wasser (steht) ============================
  const water = new MeshBuilder();
  const aW0 = aLo - 3;
  const aW1 = aLip;
  {
    const rowsW: number[] = [];
    const dA = detail ? 2.6 : 4;
    for (let a = aW0; a < aW1 - 0.3; a += dA) rowsW.push(a);
    rowsW.push(aW1);
    const ptW = (a: number, lat: number, dy = 0): V3 => {
      F.at(a, step);
      return [F.x + F.qx * lat, F.w + lat * F.b + dy, F.z + F.qz * lat];
    };
    const colW = (a: number, lat: number): RGB => {
      F.at(a, step);
      const n1 = noise((F.x + F.qx * lat) * 0.09, (F.z + F.qz * lat) * 0.09);
      const n2 = noise((F.x + F.qx * lat) * 0.31 + 7, (F.z + F.qz * lat) * 0.31);
      return mixRgb(mixRgb(C_WATER_A, C_WATER_B, n1), C_WATER_C, n2 * 0.5);
    };
    for (let i = 0; i + 1 < rowsW.length; i++) {
      const a0 = rowsW[i];
      const a1 = rowsW[i + 1];
      const L0 = lwAt(a0, -1);
      const L1 = lwAt(a1, -1);
      const R0 = lwAt(a0, 1);
      const R1 = lwAt(a1, 1);
      // Spalten: Ufer, Uferstreifen, Fahrbahnkante, Bahngrenzen, Mitte – je Reihe nach ihrer Breite
      const cols = (L: number, R: number, wh: number): number[] => [-L, -Math.min(L - 1, wh + 8), -wh, -2.6, 0, 2.6, wh, Math.min(R - 1, wh + 8), R];
      const wh0 = t.wh[F.seg[Math.max(0, Math.min(F.n - 1, Math.round(a0 / step) + PRE))]];
      const wh1 = t.wh[F.seg[Math.max(0, Math.min(F.n - 1, Math.round(a1 / step) + PRE))]];
      const ca = cols(L0, R0, wh0);
      const cb = cols(L1, R1, wh1);
      for (let c = 0; c + 1 < ca.length; c++) {
        const p00 = ptW(a0, ca[c]);
        const p01 = ptW(a0, ca[c + 1]);
        const p11 = ptW(a1, cb[c + 1]);
        const p10 = ptW(a1, cb[c]);
        // flache Comicfläche: eine Farbe je Viereck, aus dem Rauschen an seiner Mitte
        face(water, p00, p01, p11, p10, UP, colW((a0 + a1) / 2, (ca[c] + ca[c + 1]) / 2));
      }
      // Uferböschung: fällt außen ab (wo das Gelände höher liegt, verschwindet sie darin)
      for (const sgn of [-1, 1]) {
        const La = sgn < 0 ? L0 : R0;
        const Lb = sgn < 0 ? L1 : R1;
        const e0 = ptW(a0, sgn * La);
        const e1 = ptW(a1, sgn * Lb);
        const o0 = ptW(a0, sgn * (La + 2.5), -1.2);
        const o1 = ptW(a1, sgn * (Lb + 2.5), -1.2);
        face(water, e0, e1, o1, o0, UP, shade(C_MUD, 1.05 + 0.08 * Math.sin(a0)));
        // darunter eine steile Erdwand bis unter den Seespiegel des Tieflands: liegt das Gelände dort
        // tiefer als das Flussbett, schwebt das Wasser so nicht in der Luft
        const d0 = Math.max(0, o0[1] - BANK_FOOT);
        const d1 = Math.max(0, o1[1] - BANK_FOOT);
        const f0 = ptW(a0, sgn * (La + 2.5 + d0 * 0.35), -1.2 - d0);
        const f1 = ptW(a1, sgn * (Lb + 2.5 + d1 * 0.35), -1.2 - d1);
        face(water, o0, o1, f1, f0, UP, shade(C_MUD, 0.72 + 0.06 * Math.sin(a0 * 0.7)));
      }
    }
    // Stirnseite flussauf (unter dem Anleger, falls sie seitlich hervorschaut)
    {
      const L = lwAt(aW0, -1);
      const R = lwAt(aW0, 1);
      F.at(aW0, step);
      const back: V3 = [-F.ntx, 0, -F.ntz];
      face(water, ptW(aW0, -L), ptW(aW0, R), ptW(aW0, R, -5), ptW(aW0, -L, -5), back, C_MUD);
    }
  }

  // --- Felsen mit Schaum (im Wasser, weit neben den Bahnen) und Becken des Wasserfalls ---------
  const fixed = new MeshBuilder();
  {
    const rnd = seeded(4711);
    const rocks: [number, number][] = [
      [38, -15.5],
      [92, 14.5],
      [131, -17],
      [168, 16],
    ];
    for (const [a, lat] of rocks) {
      if (a > aHi - 5) continue;
      F.at(a, step);
      const L = lat < 0 ? lwAt(a, -1) : lwAt(a, 1);
      if (Math.abs(lat) > L - 2) continue;
      const cx = F.x + F.qx * lat;
      const cz = F.z + F.qz * lat;
      const wy = F.w + lat * F.b;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(cx, wy + 0.25, cz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.4, rnd() * 6, rnd() * 0.3)),
        new THREE.Vector3(1.5 + rnd(), 0.9 + rnd() * 0.5, 1.2 + rnd() * 0.6),
      );
      const g = new THREE.DodecahedronGeometry(1, 0);
      fixed.add(g, C_ROCK, m);
      g.dispose();
      const mt = new THREE.Matrix4().compose(new THREE.Vector3(cx, wy + 0.95, cz), new THREE.Quaternion(), new THREE.Vector3(1.1, 0.25, 0.9));
      const g2 = new THREE.DodecahedronGeometry(1, 0);
      fixed.add(g2, C_MOSS, mt);
      g2.dispose();
      // Schaumring und Schaumzunge flussab
      const N = 10;
      for (let k = 0; k < N; k++) {
        const q0 = (k / N) * Math.PI * 2;
        const q1 = ((k + 1) / N) * Math.PI * 2;
        const r0 = 1.6;
        const r1 = 2.4 + (k % 2) * 0.5;
        const ring = (q: number, r: number): V3 => [cx + Math.cos(q) * r, wy + 0.02, cz + Math.sin(q) * r];
        face(water, ring(q0, r0), ring(q1, r0), ring(q1, r1), ring(q0, r1), UP, C_FOAM);
      }
      for (let k = 0; k < 3; k++) {
        const w = 0.9 - k * 0.25;
        const da = 2 + k * 2.2;
        F.at(a + da, step);
        const p = (l: number, d: number): V3 => {
          F.at(a + d, step);
          return [F.x + F.qx * (lat + l), F.w + (lat + l) * F.b + 0.02, F.z + F.qz * (lat + l)];
        };
        face(water, p(-w, da), p(w, da), p(w * 0.6, da + 1.6), p(-w * 0.6, da + 1.6), UP, C_FOAM);
      }
    }
  }

  // ============================ Wasserfall ============================
  // Vorhang: Spalten über die ganze Breite an der Kante, Reihen entlang des Bogens. Ort steht, die Farben
  // laufen (je Bild neu gesetzt).
  const flow = new MeshBuilder();
  const fallCols: number[] = [];
  const fallRows = detail ? 11 : 7;
  let curtainStart = 0;
  let curtainCount = 0;
  /** je Ecke des Vorhangs: Weg d auf dem Bogen, Anteil 0..1 bis unten, Spaltenversatz */
  let curtainD: Float32Array = new Float32Array(0);
  let curtainK: Float32Array = new Float32Array(0);
  let curtainS: Float32Array = new Float32Array(0);
  const fallPt = (lat: number, d: number, out: number): V3 => {
    const e = Math.exp(-d / FALL_F);
    const fw = FALL_F * (1 - e);
    const dr = d - fw;
    const nl = Math.hypot(e, 1 - e);
    const s = (1 - e) / nl;
    const c = e / nl;
    return [lip.x + lip.rx * lat + lip.tx * (fw + s * out), lip.w + lat * lip.b - dr + c * out, lip.z + lip.rz * lat + lip.tz * (fw + s * out)];
  };
  if (hasFall) {
    const L = lwAt(aLip, -1);
    const R = lwAt(aLip, 1);
    const nc = detail ? 26 : 16;
    for (let c = 0; c <= nc; c++) fallCols.push(-L + ((L + R) * c) / nc);
    const ds: number[][] = fallCols.map((lat) => {
      const dm = dOf(fallH(lat)) + 0.4;
      const r: number[] = [];
      for (let i = 0; i <= fallRows; i++) r.push(dm * (i / fallRows) ** 1.35);
      return r;
    });
    const dl: number[] = [];
    const kl: number[] = [];
    const sl: number[] = [];
    curtainStart = 0;
    for (let c = 0; c < nc; c++) {
      for (let i = 0; i < fallRows; i++) {
        const A = fallPt(fallCols[c], ds[c][i], 0);
        const B = fallPt(fallCols[c + 1], ds[c + 1][i], 0);
        const C = fallPt(fallCols[c + 1], ds[c + 1][i + 1], 0);
        const D = fallPt(fallCols[c], ds[c][i + 1], 0);
        // sichtbar nach vorn (flussab)
        const tri = (p: V3, q: V3, r: V3, ip: number[], iq: number[], ir: number[]): void => {
          flow.tri(p, q, r, C_FALL_MID);
          for (const [cc, ii] of [ip, iq, ir]) {
            dl.push(ds[cc][ii]);
            kl.push(ii / fallRows);
            sl.push((Math.sin(cc * 2.7) * 0.5 + 0.5) * 3.1);
          }
        };
        // Umlaufsinn so, dass die Vorderseite flussab zeigt
        const n = [(B[1] - A[1]) * (D[2] - A[2]) - (B[2] - A[2]) * (D[1] - A[1]), 0, (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0])];
        const fwd = n[0] * lip.tx + n[2] * lip.tz >= 0;
        if (fwd) {
          tri(A, B, C, [c, i], [c + 1, i], [c + 1, i + 1]);
          tri(A, C, D, [c, i], [c + 1, i + 1], [c, i + 1]);
        } else {
          tri(A, C, B, [c, i], [c + 1, i + 1], [c + 1, i]);
          tri(A, D, C, [c, i], [c, i + 1], [c + 1, i + 1]);
        }
      }
    }
    curtainCount = dl.length;
    curtainD = new Float32Array(dl);
    curtainK = new Float32Array(kl);
    curtainS = new Float32Array(sl);

    // Becken mit Schaumring (steht): vom Fuß des Vorhangs flussab, über die Breite des Falls
    const rows = 6;
    const dPool = 9;
    const ptP = (lat: number, fwd: number, y: number): V3 => [lip.x + lip.rx * lat + lip.tx * fwd, y, lip.z + lip.rz * lat + lip.tz * fwd];
    for (let i = 0; i < rows; i++) {
      const f0 = 0.8 + (dPool * i) / rows;
      const f1 = 0.8 + (dPool * (i + 1)) / rows;
      for (let c = 0; c < fallCols.length - 1; c++) {
        const l0 = fallCols[c] * 1.15;
        const l1 = fallCols[c + 1] * 1.15;
        face(water, ptP(l0, f0, POOL_Y), ptP(l1, f0, POOL_Y), ptP(l1, f1, POOL_Y), ptP(l0, f1, POOL_Y), UP, mixRgb(C_WATER_A, C_WATER_C, (i % 2) * 0.4));
      }
    }
    for (let c = 0; c < fallCols.length - 1; c++) {
      const l0 = fallCols[c] * 1.08;
      const l1 = fallCols[c + 1] * 1.08;
      const ext = 3.2 + (c % 3) * 0.9;
      const lm = (l0 + l1) / 2;
      const f0 = FALL_F - 1;
      const f1 = FALL_F + 1.4;
      face(water, ptP(l0, f0, POOL_Y + 0.03), ptP(l1, f0, POOL_Y + 0.03), ptP(l1, f1, POOL_Y + 0.03), ptP(l0, f1, POOL_Y + 0.03), UP, C_FOAM);
      water.tri(ptP(l0, f1, POOL_Y + 0.03), ptP(l1, f1, POOL_Y + 0.03), ptP(lm, f1 + ext - 1.6, POOL_Y + 0.03), C_FOAM);
      water.tri(ptP(l0, f1, POOL_Y + 0.03), ptP(lm, f1 + ext - 1.6, POOL_Y + 0.03), ptP(l1, f1, POOL_Y + 0.03), C_FOAM);
    }
  }

  // Gischt: Bällchen am Fuß des Falls (Ecken je Bild: Ort und Größe)
  const puffN = hasFall ? (detail ? 18 : 8) : 0;
  const puffGeo = new THREE.IcosahedronGeometry(1, 0);
  const puffTpl = puffGeo.getAttribute('position').array as Float32Array;
  const puffV = puffTpl.length / 3;
  puffGeo.dispose();
  /** Gischt: eigenes, durchscheinendes Netz (weiß, unbeleuchtet) – Ecken je Bild */
  const sprayPos = new Float32Array(puffN * puffV * 3);
  const puffInfo: { lat: number; fwd: number; r: number; ph: number }[] = [];
  {
    const rnd = seeded(99);
    const L = hasFall ? lwAt(aLip, -1) : 0;
    const R = hasFall ? lwAt(aLip, 1) : 0;
    for (let i = 0; i < puffN; i++) {
      // dicht in der Mitte (dort sieht man den Fall durch die Lücke), locker zu den Seiten
      const q = ((i + 0.5) / puffN) * 2 - 1;
      const lat = (q * Math.abs(q) * 0.5 + q * 0.5) * (q < 0 ? L : R) * 0.8 + (rnd() - 0.5) * 2;
      puffInfo.push({ lat, fwd: FALL_F - 0.5 + rnd() * 2.5, r: 1.6 + rnd() * 1.4, ph: rnd() * 10 });
    }
  }

  // ============================ Furt ============================
  const belt = t.belts.find((b) => !b.swim) ?? null;
  let fordFrame: Frame | null = null;
  let fordA0 = 0;
  let fordA1 = 0;
  let fordFirst = 0;
  const furt = new MeshBuilder();
  const furtCol: number[] = [];
  if (belt) {
    // Ausdehnung: die zusammenhängende Strecke gleichen Belags um die Querströmung (Sand)
    const surf = t.surf[belt.first];
    let s0 = belt.first;
    let n0 = 0;
    while (t.surf[t.prev[s0]] === surf && n0 < 400) {
      s0 = t.prev[s0];
      n0++;
    }
    let n1 = 0;
    let s1 = belt.first;
    while (t.surf[t.next[s1]] === surf && n1 < 600) {
      s1 = t.next[s1];
      n1++;
    }
    fordFirst = s0;
    const count = n0 + n1 + 1;
    fordFrame = new Frame(t, s0, 2, count + 4, 1e9);
    fordA0 = -0.5 * step;
    fordA1 = (count - 0.5) * step;
    const FF = fordFrame;
    const rows: number[] = [];
    const dA = detail ? 2 : 4;
    for (let a = fordA0; a < fordA1 - 0.5; a += dA) rows.push(a);
    rows.push(fordA1);
    const pt = (a: number, lat: number): V3 => {
      FF.at(a, step);
      return [FF.x + FF.qx * lat, FF.y + lat * FF.b + FORD_H, FF.z + FF.qz * lat];
    };
    for (let i = 0; i + 1 < rows.length; i++) {
      const a0 = rows[i];
      const a1 = rows[i + 1];
      FF.at(a0, step);
      const wh = t.wh[FF.seg[Math.max(0, Math.min(FF.n - 1, Math.round(a0 / step) + 2))]];
      const lats = [-(wh + 9), -(wh + 3), -wh, 0, wh, wh + 3, wh + 9];
      const al = [0, 0.26, 0.32, 0.34, 0.32, 0.26, 0];
      const fadeA = (a: number): number => smooth((a - fordA0) / 12) * smooth((fordA1 - a) / 12);
      for (let c = 0; c + 1 < lats.length; c++) {
        const quad: [number, number, number][] = [
          [a0, lats[c], al[c]],
          [a0, lats[c + 1], al[c + 1]],
          [a1, lats[c + 1], al[c + 1]],
          [a1, lats[c], al[c]],
        ];
        const P4 = quad.map(([a, l]) => pt(a, l));
        // zwei Dreiecke, Farbe mit Deckkraft je Ecke
        for (const tri of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          furt.tri(P4[tri[0]], P4[tri[1]], P4[tri[2]], C_FOAM);
          for (const k of tri) {
            const [a, l, o] = quad[k];
            const n = noise(a * 0.05, l * 0.2);
            const cc = mixRgb(rgb(0x2f8f92), rgb(0x56b2ad), n);
            furtCol.push(cc[0], cc[1], cc[2], o * fadeA(a));
          }
        }
      }
    }
  }

  // Treibgut in der Furt (Blätter, Schaum) und die Stoffpfeile an den Pfählen – Ecken je Bild
  const driftN = belt ? (detail ? 22 : 10) : 0;
  const driftStart = flow.triangles * 3;
  const driftInfo: { a: number; l0: number; s: number; kind: number; rot: number }[] = [];
  {
    const rnd = seeded(31337);
    for (let i = 0; i < driftN; i++) {
      const kind = i % 3 === 2 ? 3 : i % 3;
      const a = belt ? (belt.first - fordFirst) * step + 3 + rnd() * (belt.count * step - 6) : 0;
      driftInfo.push({ a, l0: rnd() * 30, s: 0.4 + rnd() * 0.3, kind, rot: rnd() * 6 });
      const c = kind === 3 ? C_FOAM : C_LEAF[kind];
      flow.tri([0, 0, 0], [0, 0, 0], [0, 0, 0], c);
      flow.tri([0, 0, 0], [0, 0, 0], [0, 0, 0], c);
    }
  }
  const arrowStart = flow.triangles * 3;
  const arrows: { x: number; y: number; z: number; rx: number; rz: number; tx: number; tz: number }[] = [];
  if (belt && fordFrame) {
    for (const s of [belt.first, belt.first + belt.count - 1]) {
      const a = (s - fordFirst) * step;
      fordFrame.at(a, step);
      const lat = -(t.wh[s] + 1.4);
      const x = fordFrame.x + fordFrame.qx * lat;
      const z = fordFrame.z + fordFrame.qz * lat;
      const y = fordFrame.y + lat * fordFrame.b;
      cylT(fixed, ID, x, z, 0.11, y - 1.5, y + 3.6, C_POLE, C_POLE, 6, 'top');
      boxT(fixed, ID, x - 0.07, x + 0.07, y + 0.6, y + 0.9, z - 0.07, z + 0.07, C_ROPE);
      arrows.push({ x, y: y + 3.0, z, rx: fordFrame.nrx, rz: fordFrame.nrz, tx: fordFrame.ntx, tz: fordFrame.ntz });
      // Pfeil: Schaft (2 Dreiecke) und Spitze (1), beidseitig
      for (let k = 0; k < 6; k++) flow.tri([0, 0, 0], [0, 0, 0], [0, 0, 0], C_ARROW);
    }
  }

  // ============================ Plankenschürzen an den Anlegern ============================
  const apron = (a: number, dir: number): void => {
    F.at(a, step);
    const wh = t.wh[F.seg[Math.round(a / step) + PRE]];
    const out: V3 = [F.ntx * dir, 0, F.ntz * dir];
    const n = Math.round((2 * wh) / 0.42);
    for (let k = 0; k < n; k++) {
      const l0 = -wh + (2 * wh * k) / n;
      const l1 = -wh + (2 * wh * (k + 1)) / n;
      const y0 = F.y + l0 * F.b - 0.03;
      const y1 = F.y + l1 * F.b - 0.03;
      const bot = F.w - 0.55 - (k % 3) * 0.12;
      const p = (l: number, y: number): V3 => [F.x + F.qx * l, y, F.z + F.qz * l];
      face(fixed, p(l0, bot), p(l1, bot), p(l1, y1), p(l0, y0), out, C_PLANK[k % C_PLANK.length]);
    }
    // Querbalken und zwei Pfähle
    const p = (l: number, y: number, d: number): V3 => [F.x + F.qx * l + F.ntx * d, y, F.z + F.qz * l + F.ntz * d];
    const yb = F.y - 0.42;
    face(fixed, p(-wh - 0.1, yb - 0.22, dir * 0.06), p(wh + 0.1, yb - 0.22, dir * 0.06), p(wh + 0.1, yb, dir * 0.06), p(-wh - 0.1, yb, dir * 0.06), out, C_PILE);
    for (const l of [-wh - 0.25, wh + 0.25]) {
      const c = p(l, 0, 0);
      cylT(fixed, ID, c[0], c[2], 0.22, F.w - 2.5, F.y + 0.5, C_PILE, C_PILE, 6, 'top');
    }
  };
  apron(aLo + 0.02, -1);
  apron(aHi - 0.02, -1);

  // --- Netze: Wasser, Feststehendes, Wasserfall/Treibgut, Furt, Streifen ---------------------
  {
    const g = water.build();
    const mat = toonMaterial({ vertexColors: true });
    const m = new THREE.Mesh(g, mat);
    m.name = 'wasser';
    group.add(m);
    disposables.push(g, mat);
  }
  tris += water.triangles;
  {
    const g = fixed.build();
    const mat = toonMaterial({ vertexColors: true });
    const m = new THREE.Mesh(g, mat);
    m.name = 'fest';
    group.add(m);
    disposables.push(g, mat);
    tris += fixed.triangles;
    if (detail) {
      addSmoothNormals(g);
      const o = new THREE.Mesh(g, outlineMaterial());
      o.name = 'outline';
      o.matrixAutoUpdate = false;
      m.add(o);
      tris += fixed.triangles;
    }
  }

  const flowGeo = flow.build();
  const flowPos = flowGeo.getAttribute('position') as THREE.BufferAttribute;
  const flowCol = flowGeo.getAttribute('color') as THREE.BufferAttribute;
  const flowNor = flowGeo.getAttribute('normal') as THREE.BufferAttribute;
  flowPos.setUsage(THREE.DynamicDrawUsage);
  flowCol.setUsage(THREE.DynamicDrawUsage);
  flowNor.setUsage(THREE.DynamicDrawUsage);
  const sprayAttr = new THREE.BufferAttribute(sprayPos, 3).setUsage(THREE.DynamicDrawUsage);
  if (puffN > 0) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', sprayAttr);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf4fbf9, transparent: true, opacity: 0.62, depthWrite: false });
    const m = new THREE.Mesh(g, mat);
    m.name = 'gischt';
    m.frustumCulled = false;
    m.renderOrder = 4;
    group.add(m);
    disposables.push(g, mat);
    tris += (puffN * puffV) / 3;
  }
  {
    const mat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const m = new THREE.Mesh(flowGeo, mat);
    m.name = 'wasserfall';
    m.frustumCulled = false;
    group.add(m);
    disposables.push(flowGeo, mat);
    tris += flow.triangles;
  }

  let furtGeo: THREE.BufferGeometry | null = null;
  if (!furt.empty) {
    furtGeo = furt.build();
    furtGeo.setAttribute('color', new THREE.Float32BufferAttribute(furtCol, 4));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(furtGeo, mat);
    m.name = 'furt';
    m.renderOrder = 2;
    group.add(m);
    disposables.push(furtGeo, mat);
    tris += furt.triangles;
  }

  // Strömungsstreifen (additiv): auf dem Fluss, über den Wasserfall hinab, quer durch die Furt
  interface Streak {
    kind: number; // 0 Fluss, 1 Wasserfall, 2 Furt
    lat: number;
    a: number;
    speed: number;
    len: number;
    w: number;
    ph: number;
  }
  const streaks: Streak[] = [];
  {
    const rnd = seeded(2024);
    const nRiver = detail ? 150 : 80;
    const span = aW1 - aW0;
    for (let i = 0; i < nRiver; i++) {
      // gleichmäßig über die Breite verteilt, je Bahn das Tempo der Strömung
      const q = (i + rnd() * 0.8) / nRiver;
      const lat = -26 + 52 * ((q * 7.31) % 1);
      const al = Math.abs(lat);
      const speed = al < 2.6 ? 4 : al <= 8.4 ? 9 : 9 - 6 * smooth((al - 8.4) / 16);
      streaks.push({ kind: 0, lat, a: rnd() * span, speed, len: 2.2 + rnd() * 2.6, w: 0.12 + rnd() * 0.12, ph: rnd() });
    }
    const nFall = hasFall ? (detail ? 46 : 24) : 0;
    for (let i = 0; i < nFall; i++) streaks.push({ kind: 1, lat: (i + rnd()) / nFall, a: rnd() * 20, speed: 7 + rnd() * 3, len: 1.4 + rnd() * 1.8, w: 0.18 + rnd() * 0.2, ph: rnd() });
    const nFord = belt ? (detail ? 70 : 36) : 0;
    for (let i = 0; i < nFord; i++) {
      const a = belt ? (belt.first - fordFirst) * step + ((i + rnd()) / nFord) * belt.count * step : 0;
      streaks.push({ kind: 2, lat: 0, a, speed: belt ? belt.across : 0, len: 2 + rnd() * 2.5, w: 0.14 + rnd() * 0.12, ph: rnd() * 40 });
    }
  }
  const streakPos = new Float32Array(streaks.length * 6 * 3);
  const streakCol = new Float32Array(streaks.length * 6 * 3);
  const streakGeo = new THREE.BufferGeometry();
  const streakPA = new THREE.BufferAttribute(streakPos, 3).setUsage(THREE.DynamicDrawUsage);
  const streakCA = new THREE.BufferAttribute(streakCol, 3).setUsage(THREE.DynamicDrawUsage);
  streakGeo.setAttribute('position', streakPA);
  streakGeo.setAttribute('color', streakCA);
  {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(streakGeo, mat);
    m.name = 'stroemung';
    m.frustumCulled = false;
    m.renderOrder = 3;
    group.add(m);
    disposables.push(streakGeo, mat);
    tris += streaks.length * 2;
  }

  group.userData.triangles = Math.round(tris);

  // ============================ je Bild ============================
  const SC_RIVER = rgb(0x5f8f86);
  const SC_FALL = rgb(0x9fc9c0);
  const SC_FORD = rgb(0xbfe9e2);
  let sprayAcc = 0;
  let dropAcc = 0;

  function writeStreaks(seconds: number): void {
    const span = aW1 - aW0;
    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      const o = i * 18;
      let k = 0;
      // Ecken: (a1,l0) (a1,l1) (a2,l1) | (a1,l0) (a2,l1) (a2,l0)
      let x0 = 0, y0 = 0, z0 = 0, x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0, x3 = 0, y3 = 0, z3 = 0;
      let c = SC_RIVER;
      if (s.kind === 0) {
        const pos = (((s.a + s.speed * seconds) % span) + span) % span;
        const a1 = aW0 + pos;
        const L = lwAt(a1, s.lat < 0 ? -1 : 1);
        const lat = Math.max(-L + 1, Math.min(L - 1, s.lat));
        const a2 = Math.min(aW1, a1 + s.len);
        k = smooth(pos / 8) * smooth((span - pos - s.len) / 6) * (0.55 + 0.45 * Math.sin(seconds * 0.7 + s.ph * 6.28));
        F.at(a1, step);
        const yA = F.w + lat * F.b + 0.025;
        x0 = F.x + F.qx * (lat - s.w);
        z0 = F.z + F.qz * (lat - s.w);
        x1 = F.x + F.qx * (lat + s.w);
        z1 = F.z + F.qz * (lat + s.w);
        y0 = yA;
        y1 = yA;
        F.at(a2, step);
        const yB = F.w + lat * F.b + 0.025;
        x2 = F.x + F.qx * (lat + s.w * 0.6);
        z2 = F.z + F.qz * (lat + s.w * 0.6);
        x3 = F.x + F.qx * (lat - s.w * 0.6);
        z3 = F.z + F.qz * (lat - s.w * 0.6);
        y2 = yB;
        y3 = yB;
      } else if (s.kind === 1) {
        c = SC_FALL;
        const lat = fallCols.length > 0 ? fallCols[0] + (fallCols[fallCols.length - 1] - fallCols[0]) * s.lat : 0;
        const dm = dOf(fallH(lat));
        const span2 = dm + s.len;
        const d1 = (((s.a + s.speed * seconds) % span2) + span2) % span2 - s.len;
        const da = Math.max(0, d1);
        const db = Math.min(dm, d1 + s.len);
        k = db > da ? smooth((dm - da) / 1.5) * 0.9 : 0;
        const A = fallPt(lat - s.w, da, 0.06);
        const B = fallPt(lat + s.w, da, 0.06);
        const C = fallPt(lat + s.w, Math.max(da, db), 0.06);
        const D = fallPt(lat - s.w, Math.max(da, db), 0.06);
        [x0, y0, z0] = A;
        [x1, y1, z1] = B;
        [x2, y2, z2] = C;
        [x3, y3, z3] = D;
      } else if (fordFrame && belt) {
        c = SC_FORD;
        const FF = fordFrame;
        const wh = t.wh[belt.first];
        const lo = -wh - 4;
        const span3 = 2 * wh + 8;
        const p = (((s.ph + s.speed * seconds) % span3) + span3) % span3;
        const l1 = lo + p;
        const l2 = l1 + s.len;
        k = smooth(p / 3) * smooth((span3 - p - s.len) / 3) * 0.85;
        FF.at(s.a - s.w, step);
        x0 = FF.x + FF.qx * l1;
        z0 = FF.z + FF.qz * l1;
        y0 = FF.y + l1 * FF.b + FORD_H + 0.012;
        x3 = FF.x + FF.qx * l2;
        z3 = FF.z + FF.qz * l2;
        y3 = FF.y + l2 * FF.b + FORD_H + 0.012;
        FF.at(s.a + s.w, step);
        x1 = FF.x + FF.qx * l1;
        z1 = FF.z + FF.qz * l1;
        y1 = FF.y + l1 * FF.b + FORD_H + 0.012;
        x2 = FF.x + FF.qx * l2;
        z2 = FF.z + FF.qz * l2;
        y2 = FF.y + l2 * FF.b + FORD_H + 0.012;
      }
      streakPos[o] = x0;
      streakPos[o + 1] = y0;
      streakPos[o + 2] = z0;
      streakPos[o + 3] = x1;
      streakPos[o + 4] = y1;
      streakPos[o + 5] = z1;
      streakPos[o + 6] = x2;
      streakPos[o + 7] = y2;
      streakPos[o + 8] = z2;
      streakPos[o + 9] = x0;
      streakPos[o + 10] = y0;
      streakPos[o + 11] = z0;
      streakPos[o + 12] = x2;
      streakPos[o + 13] = y2;
      streakPos[o + 14] = z2;
      streakPos[o + 15] = x3;
      streakPos[o + 16] = y3;
      streakPos[o + 17] = z3;
      for (let v = 0; v < 6; v++) {
        streakCol[o + v * 3] = c[0] * k;
        streakCol[o + v * 3 + 1] = c[1] * k;
        streakCol[o + v * 3 + 2] = c[2] * k;
      }
    }
    streakPA.needsUpdate = true;
    streakCA.needsUpdate = true;
  }

  function writeFlow(seconds: number): void {
    // Vorhang: Bänder hell/dunkel laufen den Bogen hinab; oben die glatte, glänzende Haut
    for (let v = 0; v < curtainCount; v++) {
      const d = curtainD[v];
      const kk = curtainK[v];
      const band = 0.5 + 0.5 * Math.sin((d * 1.15 - seconds * 6.2 + curtainS[v]) * 1.0);
      let r: number, g: number, b: number;
      if (kk < 0.18) {
        // Haut an der Kante: dunkel-glasig mit einer hellen Glanzlinie
        const gl = Math.max(0, 1 - Math.abs(d - 0.45) / 0.35);
        const m = 0.15 * band + gl * 0.7;
        r = C_FALL_TOP[0] + (C_FALL_LIGHT[0] - C_FALL_TOP[0]) * m;
        g = C_FALL_TOP[1] + (C_FALL_LIGHT[1] - C_FALL_TOP[1]) * m;
        b = C_FALL_TOP[2] + (C_FALL_LIGHT[2] - C_FALL_TOP[2]) * m;
      } else {
        const foam = smooth((kk - 0.62) / 0.38);
        const base = C_FALL_MID;
        const m = Math.min(1, band * 0.55 + foam);
        r = base[0] + (C_FALL_LIGHT[0] - base[0]) * m;
        g = base[1] + (C_FALL_LIGHT[1] - base[1]) * m;
        b = base[2] + (C_FALL_LIGHT[2] - base[2]) * m;
        const dark = (1 - foam) * (1 - band) * 0.1;
        r -= dark;
        g -= dark * 0.6;
        b -= dark * 0.7;
      }
      flowCol.setXYZ(curtainStart + v, r, g, b);
    }
    if (curtainCount > 0) flowCol.needsUpdate = true;
    // Gischt
    for (let i = 0; i < puffN; i++) {
      const p = puffInfo[i];
      // jedes Bällchen steigt auf, quillt und vergeht wieder (Größe 0 am Anfang und Ende: kein Springen)
      const cyc = (seconds * 0.22 + p.ph) % 1;
      const r = p.r * (0.25 + 0.95 * Math.sin(cyc * Math.PI));
      const cx = lip.x + lip.rx * p.lat + lip.tx * (p.fwd + cyc * 2.5);
      const cz = lip.z + lip.rz * p.lat + lip.tz * (p.fwd + cyc * 2.5);
      const cy = POOL_Y + 0.6 + cyc * (i % 3 === 0 ? 10 : 6.5) + Math.sin(seconds * 1.7 + p.ph) * 0.25;
      for (let v = 0; v < puffV; v++) {
        const o = (i * puffV + v) * 3;
        sprayPos[o] = cx + puffTpl[v * 3] * r;
        sprayPos[o + 1] = cy + puffTpl[v * 3 + 1] * r * 0.8;
        sprayPos[o + 2] = cz + puffTpl[v * 3 + 2] * r;
      }
    }
    if (puffN > 0) sprayAttr.needsUpdate = true;
    // Treibgut in der Furt: quer nach rechts mit der Strömung
    if (fordFrame && belt) {
      const FF = fordFrame;
      const wh = t.wh[belt.first];
      const span = 2 * wh + 10;
      for (let i = 0; i < driftN; i++) {
        const d = driftInfo[i];
        const p = (((d.l0 + belt.across * seconds) % span) + span) % span;
        const lat = -wh - 5 + p;
        FF.at(d.a + Math.sin(seconds * 0.8 + d.rot) * 0.3, step);
        const y = FF.y + lat * FF.b + FORD_H + 0.02;
        const cx = FF.x + FF.qx * lat;
        const cz = FF.z + FF.qz * lat;
        const q = d.rot + seconds * (0.6 + (i % 3) * 0.3);
        const s = d.kind === 3 ? 0.75 : d.s;
        const ca = Math.cos(q) * s;
        const sa = Math.sin(q) * s;
        const o = driftStart + i * 6;
        const w = d.kind === 3 ? 0.8 : 0.45;
        // Raute: Spitzen in Richtung q
        const ax = cx + ca;
        const az = cz + sa;
        const bx = cx - sa * w;
        const bz = cz + ca * w;
        const ex = cx - ca;
        const ez = cz - sa;
        const fx2 = cx + sa * w;
        const fz2 = cz - ca * w;
        flowPos.setXYZ(o, ax, y, az);
        flowPos.setXYZ(o + 1, bx, y, bz);
        flowPos.setXYZ(o + 2, ex, y, ez);
        flowPos.setXYZ(o + 3, ax, y, az);
        flowPos.setXYZ(o + 4, ex, y, ez);
        flowPos.setXYZ(o + 5, fx2, y, fz2);
        for (let v = 0; v < 6; v++) flowNor.setXYZ(o + v, 0, 1, 0);
      }
    }
    // Stoffpfeile: zeigen in Strömungsrichtung (nach rechts), flattern
    for (let i = 0; i < arrows.length; i++) {
      const A = arrows[i];
      const o = arrowStart + i * 18;
      const fl = (k: number): number => Math.sin(seconds * 6 + k * 1.3 + i) * 0.22 * k;
      // Punkte entlang rechts (Länge 1,8), Höhe ±0,25, flattern längs
      const pt = (along: number, h: number, k: number, j: number): void => {
        flowPos.setXYZ(o + j, A.x + A.rx * along + A.tx * fl(k), A.y + h, A.z + A.rz * along + A.tz * fl(k));
      };
      // Schaft: Rechteck 0 … 1,8 × ±0,24; Spitze 1,8 … 3,0 × ±0,55 – je beidseitig
      pt(0, -0.24, 0, 0);
      pt(1.8, -0.24, 0.6, 1);
      pt(1.8, 0.24, 0.6, 2);
      pt(0, -0.24, 0, 3);
      pt(1.8, 0.24, 0.6, 4);
      pt(0, 0.24, 0, 5);
      pt(1.8, -0.55, 0.6, 6);
      pt(3.0, 0, 1, 7);
      pt(1.8, 0.55, 0.6, 8);
      pt(1.8, -0.24, 0.6, 9);
      pt(1.8, 0.24, 0.6, 10);
      pt(0, -0.24, 0, 11);
      pt(0, 0.24, 0, 12);
      pt(1.8, 0.24, 0.6, 13);
      pt(0, -0.24, 0, 14);
      pt(1.8, 0.55, 0.6, 15);
      pt(3.0, 0, 1, 16);
      pt(1.8, -0.55, 0.6, 17);
      for (let v = 0; v < 18; v++) flowNor.setXYZ(o + v, A.tx, 0, A.tz);
    }
    flowPos.needsUpdate = true;
    flowNor.needsUpdate = true;
  }

  function writeRafts(time: number, seconds: number): void {
    for (const L of lanes) {
      const D = raftDrift(L.src, time);
      const ph = L.src.phase;
      const kmin = Math.ceil((aMinV - L.len - ph - D) / L.pitch);
      for (let s = 0; s < L.slots; s++) {
        const a0 = ph + D + (kmin + s) * L.pitch;
        L.a0[s] = a0 < aMaxV ? a0 : NaN;
      }
    }
    for (const I of deckInst) writeInst(I, deckDyn, lanes[I.lane].a0[I.slot], seconds);
    for (const a of deckDyn.attrs) a.needsUpdate = true;
    if (gearDyn) {
      for (const I of gearInst) writeInst(I, gearDyn, lanes[I.lane].a0[I.slot], seconds);
      for (const a of gearDyn.attrs) a.needsUpdate = true;
    }
  }

  // Anfangszustand
  writeRafts(0, 0);
  writeStreaks(0);
  writeFlow(0);
  deckDyn.geo.computeBoundingSphere();

  return {
    group,
    update(time: number, seconds: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      writeRafts(time, seconds);
      writeStreaks(seconds);
      writeFlow(seconds);
      if (!detail) return;
      // Gischt in Kameranähe am Wasserfall
      if (hasFall) {
        const dx = cam.x - lip.x;
        const dz = cam.z - lip.z;
        const lat = dx * lip.nrx + dz * lip.nrz;
        const fwd = dx * lip.tx + dz * lip.tz;
        const near = Math.hypot(lat * 0.5, fwd) < 28 && cam.y > POOL_Y - 2 && cam.y < lip.w + 14;
        if (near) {
          sprayAcc += dt * 24;
          while (sprayAcc > 1) {
            sprayAcc -= 1;
            const l = Math.max(fallCols[0] ?? 0, Math.min(fallCols[fallCols.length - 1] ?? 0, lat + (Math.random() - 0.5) * 10));
            const d = 2 + Math.random() * (dOf(fallH(l)) - 2);
            const p = fallPt(l, d, 0.3 + Math.random() * 1.2);
            fx.puff(p[0], p[1], p[2], lip.tx * (1 + Math.random() * 2), 0.5 + Math.random() * 1.5, lip.tz * (1 + Math.random() * 2), 0.8 + Math.random() * 0.6, 0.5 + Math.random() * 0.7, 0xeef7f3, 1.2, -0.8);
          }
        } else sprayAcc = 0;
      }
      // Tropfen und Schaum an den Enden der Außenflöße in Kameranähe
      dropAcc += dt * 10;
      if (dropAcc > 1) {
        dropAcc -= Math.floor(dropAcc);
        for (const L of lanes) {
          if (!L.big) continue;
          for (let s = 0; s < L.slots; s++) {
            const a0 = L.a0[s];
            if (!(a0 === a0)) continue;
            for (const ae of [a0, a0 + L.len]) {
              if (ae < aLo + 0.5 || ae > aHi - 0.5) continue;
              const lat = L.src.lat0 + Math.random() * (L.src.lat1 - L.src.lat0);
              F2.at(ae, step);
              const x = F2.x + F2.qx * lat;
              const z = F2.z + F2.qz * lat;
              const y = F2.w + lat * F2.b + 0.05;
              if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 35 * 35) continue;
              const sgn = ae === a0 ? -1 : 1;
              fx.puff(x + F2.ntx * sgn * 0.4, y, z + F2.ntz * sgn * 0.4, F2.ntx * sgn * 0.8, 0.9, F2.ntz * sgn * 0.8, 0.5, 0.35, 0xeef7f3, 0.6, 3);
            }
          }
        }
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
