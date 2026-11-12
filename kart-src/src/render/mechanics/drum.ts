// Magnetwerk: Darstellung der Magnettrommel – die Röhre, an deren Innenwand die Bahn sich einmal herumschraubt,
// ihr Innenleben (Hallenboden mit Maschinen, Hängelampen, Schweißfunken), die Magnetspulen entlang der Bahn, die
// Deckenplatten, die im Takt abschalten, die beiden Portale und die Trommel von außen.
//
// Gezeichnet wird so, dass die Fahrbahn aufrecht bleibt und sich die Halle um sie dreht (track.ts: drumPoint): Alles,
// was zur Halle gehört, steht in Hallenkoordinaten (X quer, Y von der Trommelachse aus nach oben, Hallenboden unten)
// und wird je Abschnitt um roll gedreht. Was zur Bahn gehört (Magnetstreifen, Spulen, Platten, Portale), steht in
// Bahnkoordinaten (seitlich, Höhe über der Fahrbahn) – es dreht sich nicht.
//
// „Unten“ zeigen: Der Hallenboden ist eine ebene, helle Laufgitterfläche mit gelb-schwarzen Kanten und Maschinen;
// die Wände sind unten dunkel-grün gestrichen (Sockel), oben stahlblau, die Decke dunkel; Lampen hängen an Ketten
// von der Achse zum Boden und werfen Lichtkegel auf ihn; weiße Pfeile an den Wänden zeigen nach unten; Funken fallen
// von Schweißstellen zum Boden.
//
// Deckenplatten: an = Blau mit langsam wandernden Feldlinien; kündigt sich an = Gelb, die Platte zerfällt in
// Lamellen (Fugen werden breiter), die Feldlinien laufen nach außen weg, die Spulen daneben werden gelb und blassen
// ab; aus = die Lamellen klappen zusammen, darunter ein dunkler Schacht, Rahmen und Spulen rot-schwarz.
//
// Zeichentechnik (siehe tests/unit/shaderregeln.test.ts): nur Flächen mit Eckenfarben (MeshBasicMaterial), additiver
// Schein mit Eckenfarben, Ecken und Farben, die je Bild neu gesetzt werden, die gemeinsame Kontur und Teilchen. Kein
// eigener Shader, keine Textur, keine Lichtquelle. Licht und Schatten sind in die Eckenfarben eingebacken (die Halle
// wird von ihren Lampen beleuchtet, nicht von der Sonne).
//
// Zeichenaufrufe: feste Flächen, Signalflächen (Platten, Rahmen, Plattenspulen), Schein, mit detail die Kontur –
// also 4 mit, 3 ohne detail. Dreiecke (Konturen eingerechnet, group.userData.triangles, je Teil userData.parts):
// mit detail ≈ 22 470, ohne ≈ 10 880 (Grenzen 24 000 / 11 000; tests/unit/trommelbild.test.ts).
//
// Deckenplatten, Zeitverhalten: „kündigt sich an“ heißt hier „schaltet binnen warn Ticks ab“. Wörtlich
// planActive(plan, time + warn) ließe bei warn = 150 und nur 120 Ticks „aus“ die letzten 30 Ticks davor aus – die
// Platte würde kurz vor dem Abschalten wieder blau. Das Bild zeigt nie eine tragende Platte, wo die Physik fallen
// lässt (die Lamellen klappen in den letzten Ticks der Ankündigung weg).

import * as THREE from 'three';
import { planActive, planUntil, type Drum, type Plan } from '../../game/mechanics';
import { EDGE_DRUM, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, seeded, smooth, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb } from '../toon';

// --- Farben -------------------------------------------------------------------------

const C_UP = rgb(0x5a6680); // obere Hallenhälfte: kühles Stahlblau (im Schatten)
const C_LOW = rgb(0xa89a82); // untere Hallenhälfte: warmes Grau (vom Lampenlicht)
const C_STRIP = rgb(0x9aa3b6); // Kante des Magnetstreifens
const C_FLANK = rgb(0x1d2230);
const C_GUT = rgb(0x262a34);
const C_GRATE_A = rgb(0x7f8c7a); // Laufgitter: kühles Grüngrau, deutlich anders als die warme Wand
const C_GRATE_B = rgb(0x6b7768);
const C_DUCT = rgb(0x34363e);
const C_OIL = rgb(0x4a4236);
const C_YEL = rgb(0xffc72e);
const C_BLACK = rgb(0x22202a);
const C_WHITE = rgb(0xe9e6dc);
const C_MAG = rgb(0x3a8cff); // „Magnet an“
const C_MAG_HI = rgb(0x9fd2ff);
const C_RED = rgb(0xc8241c);
const C_DARKRED = rgb(0x3a0a0a);
const C_STEEL = rgb(0x5a6070);
const C_STEEL_D = rgb(0x30343e);
const C_STEEL_HI = rgb(0x9aa0ae);
const C_SHELL = rgb(0x5b6576);
const C_CONCRETE = rgb(0x8e897f);
const C_PAINT = rgb(0x2f6f8a);
const C_PAINT2 = rgb(0x8a4a2a);
const C_COPPER = rgb(0xb8662e);
const C_LAMP = rgb(0x2f4a3a);
const C_BULB = rgb(0xfff0c0);
const C_MOTOR = rgb(0x2c5a6e);

// --- Maße ---------------------------------------------------------------------------

/** Grenze zwischen Röhrenkreis und Übergang zur Bahn (Winkel von der Bahn aus, Radiant). */
const A1 = 0.62;
/** Magnetstreifen: Kante (seitlich, Höhe), Flanke, Rinne – alles außerhalb der Bande (8,4 m). */
const LIP0 = 8.45;
const LIP1 = 9.0;
const LIP_H = 0.2;
const GUT1 = 9.8;
const GUT_H = -0.05;
/** Spulenringe: Mitte seitlich und in der Höhe, Halbmesser außen/innen, Dicke längs. */
const COIL_LAT = 10.3;
const COIL_H = 1.85;
const COIL_RO = 1.15;
const COIL_RI = 0.78;
const COIL_T = 0.28;
const COIL_HALO = 0.45;
/** Platten: Höhe über der Fahrbahn, Feldlinien darüber, Boden des Schachts darunter. */
const PLATE_H = 0.035;
const LINE_H = 0.06;
const PIT_H = -0.15;
const FRAME_H = 0.03;
const FRAME_W = 0.5;
/** Lampen: Kette bis, Schirm von … bis (Abstand unter der Achse, Meter). */
const CHAIN = 6;
const SHADE = 7.8;
/** Portal: Tiefe und Außenhalbmesser; Halbmesser der Außenhaut. */
const P_DEPTH = 2.2;
const P_RO = 30;
const R_EXT = 27.6;

const TAU = Math.PI * 2;
const wrapPi = (a: number): number => a - TAU * Math.round(a / TAU);
const mod = (a: number, m: number): number => ((a % m) + m) % m;
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mul = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

/** Schreibt in einen oder zwei Bauer (fest + Kontur). Dreiecke werden zur Seite out gedreht, entartete fallen weg. */
class Pen {
  constructor(
    readonly a: MeshBuilder,
    readonly b: MeshBuilder | null,
  ) {}
  tri(p: V3, q: V3, r: V3, out: V3, col: RGB): void {
    const n = cross(sub(q, p), sub(r, p));
    if (n[0] * n[0] + n[1] * n[1] + n[2] * n[2] < 1e-10) return;
    if (dot(n, out) < 0) [q, r] = [r, q];
    this.a.tri(p, q, r, col);
    this.b?.tri(p, q, r, col);
  }
  quad(p: V3, q: V3, r: V3, s: V3, out: V3, col: RGB): void {
    this.tri(p, q, r, out, col);
    this.tri(p, r, s, out, col);
  }
}

/** Additiver Schein mit Farbe je Ecke (Verläufe). */
class GlowBuilder {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  get triangles(): number {
    return this.pos.length / 9;
  }
  tri(a: V3, b: V3, c: V3, ca: RGB, cb: RGB, cc: RGB): void {
    this.pos.push(...a, ...b, ...c);
    this.col.push(...ca, ...cb, ...cc);
  }
  quad(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }
  /** Erste Ecke, die als Nächstes geschrieben wird. */
  get next(): number {
    return this.pos.length / 3;
  }
}

/** Blockschrift 5 × 5 für das Schild (ohne Textur: jeder Buchstabe aus Rechtecken). */
const GLYPHS: Record<string, string[]> = {
  M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'],
  A: ['.XXX.', 'X...X', 'XXXXX', 'X...X', 'X...X'],
  G: ['.XXXX', 'X....', 'X..XX', 'X...X', '.XXX.'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X'],
  E: ['XXXXX', 'X....', 'XXXX.', 'X....', 'XXXXX'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..'],
  R: ['XXXX.', 'X...X', 'XXXX.', 'X..X.', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.'],
  L: ['X....', 'X....', 'X....', 'X....', 'XXXXX'],
};
const SIGN = 'MAGNETTROMMEL';

/** Zustand einer Deckenplatte zur Rennzeit (je Bild neu gerechnet, ohne Anlegen). */
interface PlateLook {
  /** 0 = an, 1 = kündigt sich an, 2 = aus */
  kind: number;
  /** Länge der Lamellen (Anteil) */
  g: number;
  /** Farbe der Platte */
  col: RGB;
  /** Fortschritt der Ankündigung 0 … 1 */
  w: number;
  /** Ticks in der Ankündigung (für die weglaufenden Feldlinien) */
  tw: number;
  /** Farbe der Spulen und ihres Scheins */
  coil: RGB;
  halo: RGB;
  /** Rahmen: zwei Streifenfarben */
  fa: RGB;
  fb: RGB;
}

interface Piece {
  u0: number;
  u1: number;
  lat0: number;
  lat1: number;
  /** Platten (Indizes in track.holes), deren Zustand dieses Stück zeigt – das Mittelstück gehört beiden. */
  holes: number[];
  /** erste Ecke der Lamellen, Anzahl Lamellen; erste Ecke der Feldlinien */
  vLam: number;
  nLam: number;
  vLine: number;
}

const LINES = 12;
const LAM_LEN = 3;
const G_ON = 0.93;

function planClock(p: Plan, time: number): number {
  if (p.period <= 0) return time;
  return time <= 0 ? 0 : time % p.period;
}
/** Ticks, seit der Plan zuletzt aufhörte zu gelten (er gilt gerade nicht). */
function sinceEnd(p: Plan, c: number): number {
  let best = Infinity;
  for (let i = 1; i < p.spans.length; i += 2) {
    const b = p.spans[i];
    const d = c >= b ? c - b : p.period > 0 ? c + p.period - b : Infinity;
    if (d < best) best = d;
  }
  return best;
}

export function buildDrum(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'Magnettrommel';
  const disposables: { dispose(): void }[] = [];

  const fixed = new MeshBuilder();
  const inkB = new MeshBuilder();
  const flat = new Pen(fixed, null);
  const body = new Pen(fixed, detail ? inkB : null);
  const glow = new GlowBuilder();

  /** Ecken der Röhrenwand (Prüfung) und der Lampen (Prüfung, von der Freihaltung der Bahn ausgenommen). */
  const wallRanges: [number, number][] = [];
  const floorRanges: [number, number][] = [];
  const lampInfo: { seg: number; top: V3; from: number; to: number }[] = [];
  const hangRanges: [number, number][] = [];

  // Signalflächen: Ecken und Farben je Bild
  const sPos: number[] = [];
  const sCol: number[] = [];
  const sIdx: number[] = [];
  const sQuad = (a: V3, b: V3, c: V3, d: V3, col: RGB): number => {
    const v = sPos.length / 3;
    sPos.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) sCol.push(...col);
    sIdx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    return v;
  };

  const pieces: Piece[] = [];
  const frames: { v: number; hole: number; odd: boolean }[] = [];
  const plateCoils: { v: number; n: number; hole: number; glowV: number; glowN: number; glowW: number[] }[] = [];
  /** Schweißstellen (Lage, Fallrichtung zum Hallenboden, Fallweg, Streuung längs). */
  const welds: { x: number; y: number; z: number; dx: number; dy: number; dz: number; drop: number; side: V3 }[] = [];

  /** Dreiecke je Teil (fest + Kontur), zum Nachzählen. */
  const parts: Record<string, number> = {};
  let markName = '';
  let markAt = 0;
  const mark = (name: string): void => {
    const now = fixed.triangles + inkB.triangles;
    if (markName) parts[markName] = (parts[markName] ?? 0) + now - markAt;
    markName = name;
    markAt = now;
  };
  for (const d of t.drums) buildOne(d);
  mark('');

  function buildOne(d: Drum): void {
    const R = d.radius;
    const first = d.first;
    const last = d.first + d.count - 1;
    const total = t.total;
    const seg = (i: number): number => mod(i, total);
    const rollS = (i: number): number => t.roll[Math.max(first, Math.min(last, i))];

    // --- Rahmen der Bahn: Punkt an der Stelle u (gebrochener Abschnitt) -------------------
    /** Punkt seitlich lat, h über der Fahrbahn, along voraus – an der gebrochenen Stelle u. */
    const at = (u: number, lat: number, h: number, along = 0): V3 => {
      const i = Math.floor(u);
      const f = u - i;
      const a = seg(i);
      const b = seg(i + 1);
      const L = (x: number, y: number): number => x + (y - x) * f;
      const rx = L(rightX(t, a), rightX(t, b));
      const rz = L(rightZ(t, a), rightZ(t, b));
      const tx = L(t.tx[a], t.tx[b]);
      const tz = L(t.tz[a], t.tz[b]);
      return [L(t.px[a], t.px[b]) + rx * lat + tx * along, L(t.py[a], t.py[b]) + lat * L(t.bank[a], t.bank[b]) + h, L(t.pz[a], t.pz[b]) + rz * lat + tz * along];
    };
    const rollU = (u: number): number => {
      const i = Math.floor(u);
      const f = u - i;
      return rollS(i) + (rollS(i + 1) - rollS(i)) * f;
    };
    /** Hallenpunkt: X quer (rechts +), Y von der Achse aus nach oben (Hallenboden bei −R). */
    const hall = (u: number, X: number, Y: number, along = 0): V3 => {
      const r = rollU(u);
      const c = Math.cos(r);
      const s = Math.sin(r);
      return at(u, X * c + Y * s, R + Y * c - X * s, along);
    };
    const hallA = (u: number, th: number, dist: number): V3 => hall(u, dist * Math.sin(th), -dist * Math.cos(th));
    /** Richtung zur Achse (für Flächen, die nach innen zeigen). */
    const toAxis = (u: number, p: V3): V3 => sub(at(u, 0, R), p);

    const N = detail ? 36 : 28;
    const dth = TAU / N;
    const FK = detail ? 3 : 2;
    const yF = R * Math.cos(FK * dth);
    const xF = R * Math.sin(FK * dth);
    /** Liegt an der Stelle u ein ebener Hallenboden (die Bahn ist weit genug weg von ihm)? */
    const floorAt = (u: number, extra = 0): boolean => Math.abs(wrapPi(rollU(u))) >= A1 + FK * dth + 0.12 + extra;
    /** Helligkeit der Halle nach Höhe: Boden hell, Decke dunkel. */
    const lightOf = (th: number): number => 0.5 + 0.5 * Math.pow((1 + Math.cos(th)) / 2, 0.7);
    /** Farbe der Hallenwand am Hallenwinkel th: unten warm und hell, oben kühl und dunkel – wie ein künstlicher Horizont. */
    const wallCol = (th: number, f = 1): RGB => mul(Math.abs(wrapPi(th)) < Math.PI / 2 ? C_LOW : C_UP, lightOf(th) * f);

    const STEP = detail ? 4 : 8;
    const rings: number[] = [];
    for (let u = first; u < last - STEP * 0.5; u += STEP) rings.push(u);
    rings.push(last);

    // Bereiche der Deckenplatten (dort bleibt die Rinne dunkel, die Spulen zeigen den Plattenzustand)
    const plateSpans: [number, number][] = [];
    for (const h of t.holes) if ((t.edge[h.first] & EDGE_DRUM) !== 0 && h.first >= first && h.first <= last) plateSpans.push([h.first - 0.5, h.first + h.count - 0.5]);
    const onPlates = (u: number, pad = 0): boolean => plateSpans.some(([a, b]) => u >= a - pad && u <= b + pad);

    mark('roehre');
    // ======================== Röhre ========================
    const wall0 = fixed.triangles * 3;
    {
      // Hallenwinkel-Gitter; was in den Bereich der Bahn fiele, wird an dessen Rand geklemmt (siehe unten).
      type TV = { p: V3; c: number };
      const ringV: TV[][] = rings.map((u) => {
        const roll = rollU(u);
        const out: TV[] = [];
        for (let k = 0; k < N; k++) {
          const am = mod(k * dth - roll, TAU);
          let c = 0;
          let a = am;
          if (am < A1) {
            c = 1;
            a = A1;
          } else if (am > TAU - A1) {
            c = 2;
            a = TAU - A1;
          }
          out.push({ p: at(u, R * Math.sin(a), R - R * Math.cos(a)), c });
        }
        return out;
      });
      const floors = rings.map((u) => floorAt(u));
      for (let r = 0; r + 1 < rings.length; r++) {
        const u = rings[r];
        const both = floors[r] && floors[r + 1];
        for (let k = 0; k < N; k++) {
          const k1 = (k + 1) % N;
          const v = [ringV[r][k], ringV[r][k1], ringV[r + 1][k1], ringV[r + 1][k]];
          // Nur Vierecke mit mindestens einer freien Ecke: die übrigen lägen ganz im Bereich der Bahn.
          if (!v.some((x) => x.c === 0)) continue;
          const kk = k >= N / 2 ? k - N : k;
          if (both && kk >= -FK && kk < FK) continue; // unter dem Hallenboden
          const th = wrapPi((k + 0.5) * dth);
          const alt = (((k >> 1) + Math.floor(u / 8)) & 1) === 1 ? 0.9 : 1;
          const col = wallCol(th, alt);
          flat.quad(v[0].p, v[1].p, v[2].p, v[3].p, toAxis(u + STEP / 2, v[0].p), col);
        }
      }

      // Übergang von der Röhrenwand zum Magnetstreifen (Bahnkoordinaten, je Seite)
      const latC = R * Math.sin(A1);
      const hC = R - R * Math.cos(A1);
      const fil: [number, number][] = [
        [GUT1, GUT_H],
        [GUT1 + (latC - GUT1) / 3, GUT_H + (hC - GUT_H) * Math.pow(1 / 3, 0.75)],
        [GUT1 + ((latC - GUT1) * 2) / 3, GUT_H + (hC - GUT_H) * Math.pow(2 / 3, 0.75)],
        [latC, hC],
      ];
      for (let r = 0; r + 1 < rings.length; r++) {
        const u0 = rings[r];
        const u1 = rings[r + 1];
        for (const s of [-1, 1]) {
          for (let j = 0; j + 1 < fil.length; j++) {
            const a = at(u0, s * fil[j][0], fil[j][1]);
            const b = at(u0, s * fil[j + 1][0], fil[j + 1][1]);
            const c = at(u1, s * fil[j + 1][0], fil[j + 1][1]);
            const e = at(u1, s * fil[j][0], fil[j][1]);
            // Farbe wie die Hallenwand an dieser Stelle, etwas dunkler zur Bahn hin
            const ang = Math.atan2(s * (fil[j][0] + fil[j + 1][0]) / 2, R - (fil[j][1] + fil[j + 1][1]) / 2);
            flat.quad(a, b, c, e, toAxis(u0, a), wallCol(ang + rollU(u0), 0.72 + 0.08 * j));
          }
        }
      }
    }
    const wall1 = fixed.triangles * 3;
    wallRanges.push([wall0, wall1]);

    // Magnetstreifen: Kante hinter der Bande, Flanke, Rinne mit blauem Leuchtband
    for (let r = 0; r + 1 < rings.length; r++) {
      const u0 = rings[r];
      const u1 = rings[r + 1];
      const lit = !onPlates((u0 + u1) / 2, STEP);
      for (const s of [-1, 1]) {
        // Kante, Flanke, Rinne (blau leuchtend: Magnet an)
        const prof: [number, number, RGB][] = [
          [LIP0, LIP_H, C_STRIP],
          [LIP1, LIP_H, C_FLANK],
          [LIP1, GUT_H, lit ? C_MAG : C_GUT],
          [GUT1, GUT_H, C_GUT],
        ];
        for (let j = 0; j + 1 < prof.length; j++) {
          const a = at(u0, s * prof[j][0], prof[j][1]);
          const b = at(u0, s * prof[j + 1][0], prof[j + 1][1]);
          const c = at(u1, s * prof[j + 1][0], prof[j + 1][1]);
          const e = at(u1, s * prof[j][0], prof[j][1]);
          // die Flanke (j = 1) zeigt zur Bahn, alles andere nach innen
          flat.quad(a, b, c, e, j === 1 ? sub(at(u0, 0, 0), at(u0, s, 0)) : toAxis(u0, a), prof[j][2]);
        }
        if (lit && detail && r % 2 === 0) {
          // weicher Schein über der Rinne (je zwei Felder ein Stück)
          const u2 = rings[Math.min(rings.length - 1, r + 2)];
          const m: RGB = [0, 0, 0];
          const m1 = mul(C_MAG, 0.3);
          const ga = at(u0, s * (LIP1 + 0.45), GUT_H + 0.03);
          const gb = at(u2, s * (LIP1 + 0.45), GUT_H + 0.03);
          glow.quad(at(u0, s * (LIP1 - 0.1), GUT_H + 0.6), ga, gb, at(u2, s * (LIP1 - 0.1), GUT_H + 0.6), m, m1, m1, m);
          glow.quad(ga, at(u0, s * (GUT1 + 0.4), GUT_H + 0.5), at(u2, s * (GUT1 + 0.4), GUT_H + 0.5), gb, m1, m, m, m1);
        }
      }
    }

    mark('rippen');
    // ======================== Rippen ========================
    {
      const NR = detail ? 28 : 20;
      const dr = TAU / NR;
      const RIB = detail ? 16 : 32;
      const rin = R - 0.55;
      const rout = R + 0.3;
      const W = 0.45;
      const B1 = A1 + 0.03;
      for (let u = first + 6; u <= last - 4; u += RIB) {
        const roll = rollU(u);
        const fl = floorAt(u, 0.05);
        type RV = { a: number; c: number };
        const vs: RV[] = [];
        for (let k = 0; k < NR; k++) {
          const am = mod(k * dr - roll, TAU);
          vs.push(am < B1 ? { a: B1, c: 1 } : am > TAU - B1 ? { a: TAU - B1, c: 2 } : { a: am, c: 0 });
        }
        const P = (a: number, rr: number, along: number): V3 => at(u, rr * Math.sin(a), R - rr * Math.cos(a), along);
        const back: V3 = [-t.tx[seg(Math.round(u))], 0, -t.tz[seg(Math.round(u))]];
        for (let k = 0; k < NR; k++) {
          const a = vs[k];
          const b = vs[(k + 1) % NR];
          if (a.c !== 0 && b.c !== 0) continue;
          const th = wrapPi((k + 0.5) * dr);
          if (fl && Math.abs(th) < FK * dth) continue;
          const col = wallCol(th, 0.82);
          flat.quad(P(a.a, rout, -W), P(b.a, rout, -W), P(b.a, rin, -W), P(a.a, rin, -W), back, mul(col, 0.85));
          const pa = P(a.a, rin, -W);
          flat.quad(pa, P(b.a, rin, -W), P(b.a, rin, W), P(a.a, rin, W), toAxis(u, pa), col);
        }
        // Stirnseiten am Rand zur Bahn
        for (const a of [B1, TAU - B1]) {
          const side = a < Math.PI ? -1 : 1;
          const o = at(u, side * Math.cos(a), side * Math.sin(a));
          const oo = sub(o, at(u, 0, 0));
          flat.quad(P(a, rin, -W), P(a, rout, -W), P(a, rout, W), P(a, rin, W), oo, wallCol(a + roll, 0.5));
        }
      }
    }

    mark('boden');
    // ======================== Hallenboden ========================
    const floorRings = rings.map((u) => floorAt(u));
    const floorUp = (u: number): V3 => sub(hall(u, 0, 0), hall(u, 0, -R));
    {
      const lanes: [number, number, number][] = [
        // X von … bis, Art: 0 Kante, 1 Gitter, 2 Kanal
        [-xF, -xF + 0.9, 0],
        [-xF + 0.9, -7.4, 1],
        [-7.4, -6.4, 2],
        [-6.4, 6.4, 1],
        [6.4, 7.4, 2],
        [7.4, xF - 0.9, 1],
        [xF - 0.9, xF, 0],
      ];
      for (let r = 0; r + 1 < rings.length; r++) {
        if (!floorRings[r] || !floorRings[r + 1]) continue;
        const u0 = rings[r];
        const u1 = rings[r + 1];
        const up = floorUp(u0);
        const floor0 = fixed.triangles * 3;
        lanes.forEach(([x0, x1, kind], li) => {
          if (kind === 0) {
            // gelb-schwarze Kante, ein Streifen je Feld
            const col = (r + (x0 < 0 ? 0 : 1)) % 2 === 0 ? C_YEL : C_BLACK;
            flat.quad(hall(u0, x0, -yF), hall(u0, x1, -yF), hall(u1, x1, -yF), hall(u1, x0, -yF), up, mul(col, 0.95));
            return;
          }
          const col = kind === 2 ? C_DUCT : (li + r) % 2 === 0 ? C_GRATE_A : C_GRATE_B;
          flat.quad(hall(u0, x0, -yF), hall(u0, x1, -yF), hall(u1, x1, -yF), hall(u1, x0, -yF), up, col);
          if (kind === 2) {
            // Deckel des Kabelkanals: helle Mittellinie
            const xm = (x0 + x1) / 2;
            flat.quad(hall(u0, xm - 0.08, -yF + 0.02), hall(u0, xm + 0.08, -yF + 0.02), hall(u1, xm + 0.08, -yF + 0.02), hall(u1, xm - 0.08, -yF + 0.02), up, mul(C_YEL, 0.7));
          }
        });
        floorRanges.push([floor0, fixed.triangles * 3]);
        // Geländer an der Kante: Holm und (jedes dritte Feld) Pfosten
        if (detail) {
          for (const s of [-1, 1]) {
            const x = s * (xF - 0.45);
            const inward: V3 = sub(hall(u0, 0, -yF), hall(u0, x, -yF));
            flat.quad(hall(u0, x, -yF + 1.0), hall(u1, x, -yF + 1.0), hall(u1, x, -yF + 1.14), hall(u0, x, -yF + 1.14), inward, C_YEL);
            if (r % 3 === 0) {
              const pp = (dx: number, y: number, dz: number): V3 => hall(u0 + dz, x + dx, -yF + y);
              flat.quad(pp(-0.06, 0, -0.06), pp(-0.06, 0, 0.06), pp(-0.06, 1.0, 0.06), pp(-0.06, 1.0, -0.06), inward, C_BLACK);
            }
          }
        }
      }
      // Stirnbleche, wo der Hallenboden beginnt oder endet
      for (let r = 0; r < rings.length; r++) {
        if (!floorRings[r]) continue;
        const startEnd = (r === 0 || !floorRings[r - 1]) || (r === rings.length - 1 || !floorRings[r + 1]);
        if (!startEnd) continue;
        const u = rings[r];
        const mid = hall(u, 0, -yF);
        const fwd: V3 = [t.tx[seg(Math.round(u))], 0, t.tz[seg(Math.round(u))]];
        const bwd: V3 = [-fwd[0], 0, -fwd[2]];
        for (let k = -FK; k < FK; k++) {
          const a = hallA(u, k * dth, R);
          const b = hallA(u, (k + 1) * dth, R);
          const col = (k & 1) === 0 ? C_YEL : C_BLACK;
          flat.tri(mid, a, b, fwd, col);
          flat.tri(mid, a, b, bwd, col);
        }
      }
      // Ölflecken
      const rnd = seeded(1700 + first);
      for (let r = 0; r + 1 < rings.length; r++) {
        if (!floorRings[r] || !floorRings[r + 1] || rnd() > (detail ? 0.45 : 0.25)) continue;
        const u = rings[r] + rnd() * STEP;
        const x = (rnd() - 0.5) * 2 * (xF - 2.5);
        const rad = 0.7 + rnd() * 1.1;
        const c = hall(u, x, -yF + 0.025);
        const up = floorUp(u);
        for (let k = 0; k < 6; k++) {
          const a0 = (k / 6) * TAU;
          const a1 = ((k + 1) / 6) * TAU;
          const f0 = 0.8 + 0.3 * Math.sin(k * 2.1 + u);
          const f1 = 0.8 + 0.3 * Math.sin((k + 1) * 2.1 + u);
          flat.tri(c, hall(u + Math.sin(a0) * rad * f0 * 1.4, x + Math.cos(a0) * rad * f0, -yF + 0.025), hall(u + Math.sin(a1) * rad * f1 * 1.4, x + Math.cos(a1) * rad * f1, -yF + 0.025), up, C_OIL);
        }
      }
    }

    mark('waende');
    // ======================== Wände: Sockellinie und Pfeile nach unten ========================
    {
      const freeOf = (u: number, th: number, pad: number): boolean => {
        const a = mod(th - rollU(u), TAU);
        return a > A1 + pad && a < TAU - A1 - pad;
      };
      for (let r = 0; r + 1 < rings.length; r++) {
        const u0 = rings[r];
        const u1 = rings[r + 1];
        for (const s of [-1, 1]) {
          const th0 = s * 1.3;
          const th1 = s * 1.335;
          if (!freeOf(u0, th0, 0.08) || !freeOf(u1, th0, 0.08) || !freeOf(u0, th1, 0.08) || !freeOf(u1, th1, 0.08)) continue;
          const a = hallA(u0, th0, R - 0.05);
          flat.quad(a, hallA(u0, th1, R - 0.05), hallA(u1, th1, R - 0.05), hallA(u1, th0, R - 0.05), toAxis(u0, a), C_WHITE);
        }
      }
      const ARROW = detail ? 20 : 40;
      for (let u = first + 14; u <= last - 10; u += ARROW) {
        for (const s of [-1, 1]) {
          const tip = s * 0.78;
          const back = s * 1.08;
          if (!freeOf(u, tip, 0.1) || !freeOf(u, back, 0.1) || !freeOf(u - 2, back, 0.1) || !freeOf(u + 2, back, 0.1)) continue;
          const P = (th: number, dz: number): V3 => hallA(u + dz, th, R - 0.06);
          const wd = s * 0.035;
          const inn = toAxis(u, P(tip, 0));
          // zwei Schenkel eines „V“, dessen Spitze zum Hallenboden zeigt
          flat.quad(P(back, -2), P(back + wd, -2 + 0.5), P(tip + wd, 0.5), P(tip, 0), inn, C_WHITE);
          flat.quad(P(tip, 0), P(tip + wd, -0.5), P(back + wd, 2 - 0.5), P(back, 2), inn, C_WHITE);
          flat.quad(P(tip, 0), P(tip + wd, 0.5), P(tip + 2 * wd, 0), P(tip + wd, -0.5), inn, C_WHITE);
        }
      }
    }

    mark('maschinen');
    // ======================== Maschinen auf dem Hallenboden ========================
    /** Quader im Rahmen T mit eingebackenem Licht von „oben“ (Hallenlampen). */
    const boxL = (pen: Pen, T: (x: number, y: number, z: number) => V3, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: RGB, top?: RGB, noBottom = true): void => {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const cz = (z0 + z1) / 2;
      const C = T(cx, cy, cz);
      const dir = (x: number, y: number, z: number): V3 => sub(T(cx + x, cy + y, cz + z), C);
      const P = T;
      pen.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), dir(0, 0, -1), mul(col, 0.72));
      pen.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), dir(0, 0, 1), mul(col, 0.8));
      pen.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), dir(-1, 0, 0), mul(col, 0.66));
      pen.quad(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), dir(1, 0, 0), mul(col, 0.86));
      pen.quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), dir(0, 1, 0), top ?? col);
      if (!noBottom) pen.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), dir(0, -1, 0), mul(col, 0.45));
    };
    /** Zylinder um die lokale y-Achse durch (x, z), mit Deckeln. */
    const cylL = (pen: Pen, T: (x: number, y: number, z: number) => V3, x: number, z: number, r: number, y0: number, y1: number, col: RGB, cap: RGB | null, sides = 8): void => {
      const C = T(x, (y0 + y1) / 2, z);
      for (let k = 0; k < sides; k++) {
        const a0 = (k / sides) * TAU;
        const a1 = ((k + 1) / sides) * TAU;
        const am = (a0 + a1) / 2;
        const out = sub(T(x + Math.cos(am), (y0 + y1) / 2, z + Math.sin(am)), C);
        const sh = 0.7 + 0.22 * (0.5 + 0.5 * Math.cos(am - 0.8));
        pen.quad(T(x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r), T(x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r), T(x + Math.cos(a1) * r, y1, z + Math.sin(a1) * r), T(x + Math.cos(a0) * r, y1, z + Math.sin(a0) * r), out, mul(col, sh));
      }
      if (cap) {
        const top = T(x, y1, z);
        const bot = T(x, y0, z);
        const upd = sub(top, bot);
        const dn: V3 = [-upd[0], -upd[1], -upd[2]];
        for (let k = 0; k < sides; k++) {
          const a0 = (k / sides) * TAU;
          const a1 = ((k + 1) / sides) * TAU;
          pen.tri(top, T(x + Math.cos(a0) * r, y1, z + Math.sin(a0) * r), T(x + Math.cos(a1) * r, y1, z + Math.sin(a1) * r), upd, cap);
          pen.tri(bot, T(x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r), T(x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r), dn, mul(cap, 0.5));
        }
      }
    };

    {
      const MSTEP = detail ? 19 : 34;
      let n = 0;
      for (let u = first + 30; u <= last - 30; u += MSTEP) {
        if (!floorAt(u - 5, 0.35) || !floorAt(u + 5, 0.35)) continue;
        const kind = n % 4;
        const X = (n % 2 === 0 ? -1 : 1) * (kind === 3 ? 5.5 : 6.8);
        n++;
        // Maschinen im Maßstab der Trommel: alles 1,7-fach
        const SC = 1.7;
        const T = (x: number, y: number, z: number): V3 => hall(u + z * SC, X + x * SC, -yF + y * SC);
        if (kind === 0 || kind === 3) {
          // Generatorblock: Sockel, Gehäuse, Spulenkopf mit Kupferwicklung
          boxL(body, T, -1.7, 1.7, 0, 0.35, -2.6, 2.6, C_STEEL_D);
          boxL(body, T, -1.4, 1.4, 0.35, 2.7, -2.2, 2.2, kind === 0 ? C_PAINT : C_PAINT2, mul(C_STEEL_HI, 0.9));
          cylL(body, T, 0, -0.9, 0.85, 2.7, 3.5, C_COPPER, C_STEEL_D, 6);
          cylL(body, T, 0, 1.1, 0.6, 2.7, 3.1, C_STEEL, C_STEEL_HI, 6);
          // gelb-schwarzer Streifen am Sockel
          for (let k = 0; k < 4; k++) {
            const z0 = -2.6 + k * 1.3;
            const col = k % 2 === 0 ? C_YEL : C_BLACK;
            flat.quad(T(1.72, 0.05, z0), T(1.72, 0.05, z0 + 1.3), T(1.72, 0.3, z0 + 1.3), T(1.72, 0.3, z0), sub(T(2, 0.2, 0), T(0, 0.2, 0)), col);
            flat.quad(T(-1.72, 0.05, z0), T(-1.72, 0.05, z0 + 1.3), T(-1.72, 0.3, z0 + 1.3), T(-1.72, 0.3, z0), sub(T(-2, 0.2, 0), T(0, 0.2, 0)), col);
          }
        } else if (kind === 1) {
          // Kabeltrommel: zwei Scheiben, dazwischen aufgewickeltes Kabel; Achse quer
          const Tx = (x: number, y: number, z: number): V3 => T(y, x, z);
          cylL(body, Tx, 1.35, 0, 1.35, -1.0, -0.8, C_STEEL, C_STEEL_HI, 7);
          cylL(body, Tx, 1.35, 0, 1.35, 0.8, 1.0, C_STEEL, C_STEEL_HI, 7);
          cylL(body, Tx, 1.35, 0, 0.95, -0.8, 0.8, C_PAINT2, null, 7);
          boxL(body, T, -1.2, 1.2, 0, 0.25, -0.6, 0.6, C_STEEL_D);
          // zweite, kleinere Trommel daneben
          const T2 = (x: number, y: number, z: number): V3 => T(y, x, z + 3.2);
          cylL(body, T2, 0.9, 0, 0.9, -0.6, -0.45, C_STEEL, C_STEEL_HI, 6);
          cylL(body, T2, 0.9, 0, 0.9, 0.45, 0.6, C_STEEL, C_STEEL_HI, 6);
          cylL(body, T2, 0.9, 0, 0.6, -0.45, 0.45, C_COPPER, null, 6);
        } else {
          // Werkbank mit Schraubstock und Kiste
          boxL(body, T, -1.3, 1.3, 0.9, 1.05, -0.7, 0.7, C_PAINT2, mul(C_PAINT2, 1.15), false);
          for (const lx of [-1.15, 1.15]) for (const lz of [-0.55, 0.55]) boxL(body, T, lx - 0.07, lx + 0.07, 0, 0.9, lz - 0.07, lz + 0.07, C_STEEL_D);
          boxL(body, T, 0.5, 1.0, 1.05, 1.35, -0.25, 0.15, C_STEEL);
          boxL(body, T, -1.0, 0.2, 0, 0.75, 1.6, 2.6, rgb(0x8c6a3e), rgb(0xa47e4a));
          boxL(body, T, -0.8, 0.0, 0.75, 1.4, 1.8, 2.5, rgb(0x8c6a3e), rgb(0xa47e4a));
        }
      }
    }

    mark('lampen');
    // ======================== Achse, Lampen, Kabel ========================
    {
      const h0 = fixed.triangles * 3;
      // Tragseil entlang der Achse (Dreikant)
      const AX = detail ? 12 : 24;
      for (let u = first - 1; u < last + 1; u += AX) {
        const u1 = Math.min(last + 1, u + AX);
        for (let k = 0; k < 3; k++) {
          const a0 = (k / 3) * TAU;
          const a1 = ((k + 1) / 3) * TAU;
          const P = (uu: number, a: number): V3 => hall(uu, Math.cos(a) * 0.22, Math.sin(a) * 0.22);
          const am = (a0 + a1) / 2;
          flat.quad(P(u, a0), P(u, a1), P(u1, a1), P(u1, a0), sub(P(u, am), hall(u, 0, 0)), C_STEEL_D);
        }
      }
      hangRanges.push([h0, fixed.triangles * 3]);
      const LSTEP = 16;
      const lamps: number[] = [];
      for (let u = first + 10; u <= last - 10; u += LSTEP) lamps.push(u);
      for (const u of lamps) {
        const from = fixed.triangles * 3;
        const T = (x: number, y: number, z: number): V3 => hall(u + z, x, y);
        // Kette: Dreikant, von der Achse zum Schirm
        for (let k = 0; k < 3; k++) {
          const a0 = (k / 3) * TAU;
          const a1 = ((k + 1) / 3) * TAU;
          const am = (a0 + a1) / 2;
          const P = (a: number, y: number): V3 => T(Math.cos(a) * 0.07, y, Math.sin(a) * 0.07);
          flat.quad(P(a0, 0), P(a1, 0), P(a1, -CHAIN), P(a0, -CHAIN), sub(P(am, -1), T(0, -1, 0)), C_BLACK);
        }
        // Schirm (Pyramidenstumpf), unten die Glühfläche
        const sh = [
          [0.4, -CHAIN],
          [1.6, -SHADE],
        ];
        for (let k = 0; k < 4; k++) {
          const a0 = (k / 4) * TAU + Math.PI / 4;
          const a1 = ((k + 1) / 4) * TAU + Math.PI / 4;
          const am = (a0 + a1) / 2;
          const P = (a: number, i: number): V3 => T(Math.cos(a) * sh[i][0], sh[i][1], Math.sin(a) * sh[i][0]);
          body.quad(P(a0, 0), P(a1, 0), P(a1, 1), P(a0, 1), sub(T(Math.cos(am), -6.6, Math.sin(am)), T(0, -6.6, 0)), mul(C_LAMP, k % 2 === 0 ? 1 : 0.8));
        }
        const B = (a: number): V3 => T(Math.cos(a) * 1.6, -SHADE, Math.sin(a) * 1.6);
        const down = sub(T(0, -SHADE - 1, 0), T(0, -SHADE, 0));
        const updir: V3 = [-down[0], -down[1], -down[2]];
        const q = Math.PI / 4;
        body.quad(B(q), B(q + Math.PI / 2), B(q + Math.PI), B(q + 1.5 * Math.PI), down, C_BULB);
        const Ttop = (a: number): V3 => T(Math.cos(a) * 0.4, -CHAIN, Math.sin(a) * 0.4);
        body.quad(Ttop(q), Ttop(q + Math.PI / 2), Ttop(q + Math.PI), Ttop(q + 1.5 * Math.PI), updir, mul(C_LAMP, 1.2));
        const to = fixed.triangles * 3;
        lampInfo.push({ seg: Math.round(u), top: T(0, 0, 0), from, to });
        hangRanges.push([from, to]);

        // Lichtkegel zum Boden und Lichtfleck auf dem Boden
        const fl = floorAt(u, 0.1);
        const yEnd = fl ? -yF + 0.4 : -15;
        const wEnd = fl ? 5.2 : 3.6;
        const c0 = mul(rgb(0xffb35a), 0.09);
        const c1: RGB = [0, 0, 0];
        for (let k = 0; k < 4; k++) {
          const a0 = (k / 4) * TAU + q;
          const a1 = ((k + 1) / 4) * TAU + q;
          const P = (a: number, w: number, y: number): V3 => T(Math.cos(a) * w, y, Math.sin(a) * w);
          glow.quad(P(a0, 1.5, -SHADE - 0.05), P(a1, 1.5, -SHADE - 0.05), P(a1, wEnd, yEnd), P(a0, wEnd, yEnd), c0, c0, c1, c1);
        }
        if (fl) {
          const ctr = T(0, -yF + 0.05, 0);
          const cc = mul(rgb(0xffc070), 0.22);
          for (let k = 0; k < 8; k++) {
            const a0 = (k / 8) * TAU;
            const a1 = ((k + 1) / 8) * TAU;
            glow.tri(ctr, T(Math.cos(a0) * 5.5, -yF + 0.05, Math.sin(a0) * 6.5), T(Math.cos(a1) * 5.5, -yF + 0.05, Math.sin(a1) * 6.5), cc, c1, c1);
          }
        }
      }
      // Kabel zwischen den Lampen, durchhängend zum Hallenboden
      if (detail) {
        const c0 = fixed.triangles * 3;
        for (let i = 0; i + 1 < lamps.length; i++) {
          const ua = lamps[i];
          const ub = lamps[i + 1];
          const S = 4;
          const off = i % 2 === 0 ? 0.25 : -0.25;
          const pt = (k: number, a: number): V3 => {
            const f = k / S;
            const y = -1.5 - 3.2 * Math.sin(f * Math.PI);
            const u = ua + (ub - ua) * f;
            return hall(u, off + Math.cos(a) * 0.09, y + Math.sin(a) * 0.09);
          };
          for (let k = 0; k < S; k++) {
            for (let j = 0; j < 3; j++) {
              const a0 = (j / 3) * TAU;
              const a1 = ((j + 1) / 3) * TAU;
              const am = (a0 + a1) / 2;
              const mid = pt(k, am);
              const ctr = sub(mid, hall(ua + ((ub - ua) * k) / S, off, -1.5 - 3.2 * Math.sin((k / S) * Math.PI)));
              flat.quad(pt(k, a0), pt(k, a1), pt(k + 1, a1), pt(k + 1, a0), ctr, C_BLACK);
            }
          }
        }
        hangRanges.push([c0, fixed.triangles * 3]);
      }
    }

    mark('schweiss');
    // ======================== Schweißstellen (Funken fallen zum Boden) ========================
    for (let u = first + 45; u <= last - 40; u += detail ? 34 : 68) {
      for (const s of [-1, 1]) {
        // an der oberen, dunklen Wand: dort sieht man die Funken fallen
        const th = s * 2.0;
        const a = mod(th - rollU(u), TAU);
        if (a < A1 + 0.35 || a > TAU - A1 - 0.35) continue;
        const T = (x: number, y: number, z: number): V3 => {
          // Rahmen an der Wand: x tangential, y nach innen (zur Achse), z längs
          const dist = R - y;
          const ang = th + x / R;
          return hallA(u + z, ang, dist);
        };
        boxL(body, T, -0.5, 0.5, -0.1, 0.6, -0.4, 0.4, C_STEEL_D, C_STEEL);
        const p = T(0, 0.7, 0);
        const fall = sub(hall(u, 0, -100), hall(u, 0, 0));
        const L = Math.hypot(fall[0], fall[1], fall[2]);
        const fdir: V3 = [fall[0] / L, fall[1] / L, fall[2] / L];
        // Wie weit bis zum Hallenboden?
        const Yp = -(R - 0.7) * Math.cos(th);
        const drop = Math.max(2, Yp - -yF);
        welds.push({ x: p[0], y: p[1], z: p[2], dx: fdir[0], dy: fdir[1], dz: fdir[2], drop, side: [t.tx[seg(Math.round(u))], 0, t.tz[seg(Math.round(u))]] });
        const cc = mul(rgb(0xffb040), 0.9);
        const k0: RGB = [0, 0, 0];
        const sz = 0.9;
        const tA = T(-sz, 0.72, 0);
        const tB = T(sz, 0.72, 0);
        const tC = T(0, 0.72, -sz);
        const tD = T(0, 0.72, sz);
        glow.tri(p, tA, tC, cc, k0, k0);
        glow.tri(p, tC, tB, cc, k0, k0);
        glow.tri(p, tB, tD, cc, k0, k0);
        glow.tri(p, tD, tA, cc, k0, k0);
      }
    }

    mark('spulen');
    // ======================== Magnetspulen entlang der Bahn ========================
    /** Spulenring an der Stelle u, Seite s; win = Pen für die leuchtende Wicklung (null = in die Signalflächen). */
    const coilAt = (u: number, s: number, hole: number): void => {
      const T = (x: number, y: number, z: number): V3 => at(u + z, s * (COIL_LAT + x), COIL_H + y);
      const S = 6;
      const ang = (k: number): number => (k / S) * TAU + Math.PI / 6;
      const pt = (k: number, r: number, z: number): V3 => T(Math.cos(ang(k)) * r, Math.sin(ang(k)) * r, z);
      const back: V3 = sub(T(0, 0, -1), T(0, 0, 0));
      const fwd: V3 = [-back[0], -back[1], -back[2]];
      const v0 = sPos.length / 3;
      for (let k = 0; k < S; k++) {
        const k1 = k + 1;
        const am = (ang(k) + ang(k1)) / 2;
        const rad = sub(T(Math.cos(am), Math.sin(am), 0), T(0, 0, 0));
        // Rückseite und Außenmantel aus dunklem Stahl (den Innenmantel sieht man kaum: er fehlt)
        flat.quad(pt(k, COIL_RO, COIL_T), pt(k1, COIL_RO, COIL_T), pt(k1, COIL_RI, COIL_T), pt(k, COIL_RI, COIL_T), fwd, C_STEEL_D);
        flat.quad(pt(k, COIL_RO, -COIL_T), pt(k1, COIL_RO, -COIL_T), pt(k1, COIL_RO, COIL_T), pt(k, COIL_RO, COIL_T), rad, mul(C_STEEL, 0.8 + 0.2 * Math.sin(am)));
        // Vorderseite: die leuchtende Wicklung (zeigt der Bahn entgegen)
        if (hole < 0) flat.quad(pt(k, COIL_RO, -COIL_T), pt(k1, COIL_RO, -COIL_T), pt(k1, COIL_RI, -COIL_T), pt(k, COIL_RI, -COIL_T), back, C_MAG_HI);
        else sQuad(pt(k, COIL_RO, -COIL_T), pt(k1, COIL_RO, -COIL_T), pt(k1, COIL_RI, -COIL_T), pt(k, COIL_RI, -COIL_T), C_MAG_HI);
      }
      // Schein: Kranz um die Wicklung (die Mitte bleibt offen – ein Ring, keine Scheibe)
      const g0 = glow.next;
      const weights: number[] = [];
      const z = -COIL_T - 0.03;
      for (let k = 0; k < S; k++) {
        const k1 = k + 1;
        glow.quad(pt(k, COIL_RO, z), pt(k1, COIL_RO, z), pt(k1, COIL_RO + COIL_HALO, z), pt(k, COIL_RO + COIL_HALO, z), C_MAG, C_MAG, [0, 0, 0], [0, 0, 0]);
        weights.push(0.42, 0.42, 0, 0.42, 0, 0);
      }
      // Grundzustand „an“
      const gn = glow.next - g0;
      for (let i = 0; i < gn; i++) for (let c = 0; c < 3; c++) glow.col[(g0 + i) * 3 + c] = C_MAG[c] * weights[i];
      if (hole >= 0) plateCoils.push({ v: v0, n: sPos.length / 3 - v0, hole, glowV: g0, glowN: gn, glowW: weights });
    };

    // Plattenpaare der Decke (für Spulen, Rahmen, Platten)
    const drumHoles: number[] = [];
    t.holes.forEach((h, i) => {
      if ((t.edge[h.first] & EDGE_DRUM) !== 0 && h.first >= first && h.first <= last) drumHoles.push(i);
    });
    const pairs: number[][] = [];
    for (const i of drumHoles) {
      const h = t.holes[i];
      const p = pairs.find((q) => t.holes[q[0]].first === h.first && t.holes[q[0]].count === h.count);
      if (p) p.push(i);
      else pairs.push([i]);
    }
    for (const p of pairs) p.sort((a, b) => t.holes[a].lat0 - t.holes[b].lat0);

    {
      const CSTEP = detail ? 13 : 24;
      for (let u = first + 6; u <= last - 4; u += CSTEP) {
        if (onPlates(u, 5)) continue;
        coilAt(u, -1, -1);
        coilAt(u, 1, -1);
      }
      // Über den Platten: dieselben Spulen, links die der linken, rechts die der rechten Platte
      for (const p of pairs) {
        const h = t.holes[p[0]];
        const u0 = h.first - 0.5;
        const L = h.count;
        const left = p[0];
        const right = p[p.length - 1];
        for (const f of [0.22, 0.72]) {
          coilAt(u0 + L * f, -1, left);
          coilAt(u0 + L * f, 1, right);
        }
      }
    }

    mark('platten');
    // ======================== Deckenplatten ========================
    for (const p of pairs) {
      const h0 = t.holes[p[0]];
      const u0 = h0.first - 0.5;
      const u1 = h0.first + h0.count - 0.5;
      // Stücke: was nur zur linken, was zu beiden (Mitte), was nur zur rechten Platte gehört
      const cutsLat: { lat0: number; lat1: number; holes: number[] }[] = [];
      if (p.length === 2 && t.holes[p[1]].lat0 < t.holes[p[0]].lat1) {
        const L = t.holes[p[0]];
        const Rr = t.holes[p[1]];
        cutsLat.push({ lat0: L.lat0, lat1: Rr.lat0, holes: [p[0]] });
        cutsLat.push({ lat0: Rr.lat0, lat1: L.lat1, holes: [p[0], p[1]] });
        cutsLat.push({ lat0: L.lat1, lat1: Rr.lat1, holes: [p[1]] });
      } else for (const i of p) cutsLat.push({ lat0: t.holes[i].lat0, lat1: t.holes[i].lat1, holes: [i] });
      for (const c of cutsLat) {
        const nLam = Math.max(1, Math.round((u1 - u0) / LAM_LEN));
        const vLam = sPos.length / 3;
        for (let j = 0; j < nLam; j++) sQuad(at(u0, c.lat0, PLATE_H), at(u0, c.lat1, PLATE_H), at(u1, c.lat1, PLATE_H), at(u1, c.lat0, PLATE_H), C_MAG);
        const vLine = sPos.length / 3;
        for (let j = 0; j < LINES; j++) sQuad(at(u0, c.lat0, LINE_H), at(u0, c.lat1, LINE_H), at(u0, c.lat1, LINE_H), at(u0, c.lat0, LINE_H), C_MAG_HI);
        pieces.push({ u0, u1, lat0: c.lat0, lat1: c.lat1, holes: c.holes, vLam, nLam, vLine });
      }
      // Schacht darunter: dunkler Boden mit gemaltem Tiefenverlauf (rot-schwarzer Rand, schwarze Mitte, ferne Lichter)
      const lo = Math.min(...p.map((i) => t.holes[i].lat0));
      const hi = Math.max(...p.map((i) => t.holes[i].lat1));
      const ringsPit = 5;
      const up: V3 = [0, 1, 0];
      for (let k = 0; k < ringsPit; k++) {
        const f0 = k / ringsPit;
        const f1 = (k + 1) / ringsPit;
        const inset = (f: number): [number, number, number, number] => {
          const ml = ((hi - lo) / 2) * f * 0.92;
          const mu = ((u1 - u0) / 2) * f * 0.92;
          return [lo - 0.4 + ml, hi + 0.4 - ml, u0 - 0.4 + mu, u1 + 0.4 - mu];
        };
        const [a0, b0, c0, d0] = inset(f0);
        const [a1, b1, c1, d1] = inset(f1);
        const col = k === 0 ? mul(C_RED, 0.35) : mul(rgb(0x1a0c10), 1 - k / ringsPit);
        const yy = PIT_H;
        // Rahmenring k: vier Trapeze
        flat.quad(at(c0, a0, yy), at(c0, b0, yy), at(c1, b1, yy), at(c1, a1, yy), up, col);
        flat.quad(at(d1, a1, yy), at(d1, b1, yy), at(d0, b0, yy), at(d0, a0, yy), up, col);
        flat.quad(at(c0, a0, yy), at(c1, a1, yy), at(d1, a1, yy), at(d0, a0, yy), up, col);
        flat.quad(at(c1, b1, yy), at(c0, b0, yy), at(d0, b0, yy), at(d1, b1, yy), up, col);
        if (k === ringsPit - 1) flat.quad(at(c1, a1, yy), at(c1, b1, yy), at(d1, b1, yy), at(d1, a1, yy), up, rgb(0x06040a));
      }
      // ferne Lichter tief unten
      const rnd = seeded(31 + h0.first);
      for (let k = 0; k < 7; k++) {
        const uu = u0 + (u1 - u0) * (0.3 + 0.4 * rnd());
        const ll = lo + (hi - lo) * (0.3 + 0.4 * rnd());
        const r = 0.12;
        flat.quad(at(uu - r, ll - r, PIT_H + 0.01), at(uu - r, ll + r, PIT_H + 0.01), at(uu + r, ll + r, PIT_H + 0.01), at(uu + r, ll - r, PIT_H + 0.01), up, k % 3 === 0 ? mul(C_MAG, 0.6) : rgb(0xffb35a));
      }
      // Rahmen auf der Fahrbahn: seitlich je Platte, vorn und hinten je Hälfte; Streifen je 1,2 m
      const left = p[0];
      const right = p[p.length - 1];
      const stripes = (ua: number, ub: number, la: number, lb: number, hole: number, along: boolean): void => {
        const n = Math.max(1, Math.round((along ? ub - ua : lb - la) / 1.2));
        for (let j = 0; j < n; j++) {
          const f0 = j / n;
          const f1 = (j + 1) / n;
          const v = along
            ? sQuad(at(ua + (ub - ua) * f0, la, FRAME_H), at(ua + (ub - ua) * f0, lb, FRAME_H), at(ua + (ub - ua) * f1, lb, FRAME_H), at(ua + (ub - ua) * f1, la, FRAME_H), C_STEEL)
            : sQuad(at(ua, la + (lb - la) * f0, FRAME_H), at(ua, la + (lb - la) * f1, FRAME_H), at(ub, la + (lb - la) * f1, FRAME_H), at(ub, la + (lb - la) * f0, FRAME_H), C_STEEL);
          frames.push({ v, hole, odd: j % 2 === 1 });
        }
      };
      stripes(u0 - FRAME_W, u1 + FRAME_W, lo - FRAME_W, lo, left, true);
      stripes(u0 - FRAME_W, u1 + FRAME_W, hi, hi + FRAME_W, right, true);
      stripes(u0 - FRAME_W, u0, lo, 0, left, false);
      stripes(u0 - FRAME_W, u0, 0, hi, right, false);
      stripes(u1, u1 + FRAME_W, lo, 0, left, false);
      stripes(u1, u1 + FRAME_W, 0, hi, right, false);
    }

    mark('portale');
    // ======================== Portale ========================
    // Innenkontur: Magnetstreifen, Übergang, Röhrenkreis – und dieselbe Seite gespiegelt.
    const latC = R * Math.sin(A1);
    const hC = R - R * Math.cos(A1);
    const right: [number, number][] = [
      [LIP0, LIP_H],
      [LIP1, LIP_H],
      [LIP1, GUT_H],
      [GUT1, GUT_H],
      [GUT1 + (latC - GUT1) / 3, GUT_H + (hC - GUT_H) * Math.pow(1 / 3, 0.75)],
      [GUT1 + ((latC - GUT1) * 2) / 3, GUT_H + (hC - GUT_H) * Math.pow(2 / 3, 0.75)],
    ];
    const M = detail ? 44 : 28;
    const contour: [number, number][] = [...right];
    for (let i = 0; i <= M; i++) {
      const a = A1 + ((TAU - 2 * A1) * i) / M;
      contour.push([R * Math.sin(a), R - R * Math.cos(a)]);
    }
    for (let i = right.length - 1; i >= 0; i--) contour.push([-right[i][0], right[i][1]]);
    const polar = (p: [number, number]): number => mod(Math.atan2(p[0], R - p[1]), TAU);
    for (const [u, o] of [
      [first, -1],
      [last, 1],
    ] as [number, number][]) {
      const sg = seg(Math.round(u));
      const fwd: V3 = [t.tx[sg] * o, 0, t.tz[sg] * o];
      const bwd: V3 = [-fwd[0], 0, -fwd[2]];
      const D = o * P_DEPTH;
      const ax = at(u, 0, R);
      const ring = (dist: number, phi: number, along: number): V3 => at(u, dist * Math.sin(phi), R - dist * Math.cos(phi), along);
      for (let i = 0; i + 1 < contour.length; i++) {
        const c0 = contour[i];
        const c1 = contour[i + 1];
        const p0 = polar(c0);
        const p1 = polar(c1);
        const d0 = Math.hypot(c0[0], R - c0[1]);
        const d1 = Math.hypot(c1[0], R - c1[1]);
        const circle = i >= right.length && i < right.length + M;
        const stripe = circle ? ((i & 1) === 0 ? C_YEL : C_BLACK) : C_STEEL_D;
        const A = at(u, c0[0], c0[1]);
        const B = at(u, c1[0], c1[1]);
        const A2 = at(u, c0[0], c0[1], D);
        const B2 = at(u, c1[0], c1[1], D);
        // Innenlaibung (zur Achse) mit Warnstreifen
        flat.quad(A, B, B2, A2, sub(ax, A), mul(stripe, 0.9));
        // Stirnfläche: innen ein Warnstreifenring, außen Stahl
        const m0 = ring(d0 + 1.4, p0, D);
        const m1 = ring(d1 + 1.4, p1, D);
        flat.quad(A2, B2, m1, m0, fwd, stripe);
        flat.quad(m0, m1, ring(P_RO, p1, D), ring(P_RO, p0, D), fwd, mul(C_STEEL, (i & 3) === 0 ? 0.8 : 1));
        // Außenmantel und Rückseite (zur Trommel hin)
        const rad = sub(ring(P_RO, (p0 + p1) / 2, 0), ax);
        flat.quad(ring(P_RO, p0, 0), ring(P_RO, p1, 0), ring(P_RO, p1, D), ring(P_RO, p0, D), rad, mul(C_STEEL_D, 1.2));
        flat.quad(ring(R_EXT, p0, 0), ring(R_EXT, p1, 0), ring(P_RO, p1, 0), ring(P_RO, p0, 0), bwd, C_STEEL_D);
      }
      // Schild über der Einfahrt: Träger quer über die Öffnung (über 10 m), darauf die Schrift
      const y0 = 10.6;
      const y1 = 13.4;
      const W = Math.sqrt(R * R - (R - y0) * (R - y0)) + 0.6;
      const Tb = (x: number, y: number, z: number): V3 => at(u, x, y, o * z);
      boxL(body, Tb, -W, W, y0, y1, 0.3, P_DEPTH + 0.4, C_YEL, C_STEEL_D, false);
      // Schrift auf der Außenseite (von außen lesbar: von links nach rechts aus Sicht des Betrachters)
      const cell = 0.44;
      const lw = 5 * cell;
      const gap = cell * 1.1;
      const totalW = SIGN.length * lw + (SIGN.length - 1) * gap;
      const zF = P_DEPTH + 0.43;
      const yb = (y0 + y1) / 2 - 2.5 * cell;
      for (let li = 0; li < SIGN.length; li++) {
        const g = GLYPHS[SIGN[li]];
        const xl = -totalW / 2 + li * (lw + gap);
        for (let row = 0; row < 5; row++) {
          const line = g[row];
          let c = 0;
          while (c < 5) {
            if (line[c] !== 'X') {
              c++;
              continue;
            }
            let e = c;
            while (e < 5 && line[e] === 'X') e++;
            // Betrachter blickt gegen o: seine rechte Hand zeigt nach −o·rechts
            const xa = -o * (xl + c * cell);
            const xb = -o * (xl + e * cell);
            const ya = yb + (4 - row) * cell;
            const yb2 = ya + cell;
            flat.quad(Tb(xa, ya, zF), Tb(xb, ya, zF), Tb(xb, yb2, zF), Tb(xa, yb2, zF), fwd, C_BLACK);
            c = e;
          }
        }
      }
      // Innenseite des Trägers: Warnstreifen
      const zi = 0.27;
      const ns = 18;
      for (let k = 0; k < ns; k++) {
        const xa = -W + (2 * W * k) / ns;
        const xb = -W + (2 * W * (k + 1)) / ns;
        flat.quad(Tb(xa, y0, zi), Tb(xb, y0, zi), Tb(xb, y1, zi), Tb(xa, y1, zi), bwd, k % 2 === 0 ? C_YEL : C_BLACK);
      }
    }

    mark('aussen');
    // ======================== Von außen ========================
    {
      const ME = detail ? 24 : 16;
      const AE = 0.33;
      const ESTEP = detail ? 12 : 24;
      const sun = new THREE.Vector3(0.5, 0.45, -0.4).normalize();
      const er: number[] = [];
      for (let u = first; u < last - ESTEP * 0.5; u += ESTEP) er.push(u);
      er.push(last);
      const E = (u: number, a: number, r: number, along = 0): V3 => at(u, r * Math.sin(a), R - r * Math.cos(a), along);
      const shadeOut = (u: number, a: number): number => {
        const sg = seg(Math.round(u));
        const n = new THREE.Vector3(rightX(t, sg) * Math.sin(a), -Math.cos(a), rightZ(t, sg) * Math.sin(a));
        return 0.55 + 0.45 * Math.max(0, n.dot(sun));
      };
      for (let r = 0; r + 1 < er.length; r++) {
        const u0 = er[r];
        const u1 = er[r + 1];
        for (let k = 0; k < ME; k++) {
          const a0 = AE + ((TAU - 2 * AE) * k) / ME;
          const a1 = AE + ((TAU - 2 * AE) * (k + 1)) / ME;
          const am = (a0 + a1) / 2;
          const p = E(u0, am, R_EXT);
          flat.quad(E(u0, a0, R_EXT), E(u0, a1, R_EXT), E(u1, a1, R_EXT), E(u1, a0, R_EXT), sub(p, at(u0, 0, R)), mul(C_SHELL, shadeOut(u0, am) * ((r + k) % 2 === 0 ? 1 : 0.93)));
        }
        // Sockel: von der Unterkante der Haut ins Gelände
        for (const a of [AE, TAU - AE]) {
          const s = Math.sin(a) > 0 ? 1 : -1;
          const p0 = E(u0, a, R_EXT);
          const p1 = E(u1, a, R_EXT);
          const q0 = at(u0, s * R_EXT * Math.sin(AE), -1.2);
          const q1 = at(u1, s * R_EXT * Math.sin(AE), -1.2);
          flat.quad(p0, p1, q1, q0, sub(at(u0, s, 0), at(u0, 0, 0)), mul(C_CONCRETE, 0.7));
        }
      }
      // Außenrippen
      const XR = detail ? 48 : 96;
      for (let u = first + 16; u <= last - 10; u += XR) {
        const sg = seg(Math.round(u));
        const fwd: V3 = [t.tx[sg], 0, t.tz[sg]];
        const bwd: V3 = [-fwd[0], 0, -fwd[2]];
        for (let k = 0; k < ME; k++) {
          const a0 = AE + ((TAU - 2 * AE) * k) / ME;
          const a1 = AE + ((TAU - 2 * AE) * (k + 1)) / ME;
          const am = (a0 + a1) / 2;
          const col = mul(C_STEEL_D, 1.3 * shadeOut(u, am));
          const r1 = R_EXT + 0.9;
          flat.quad(E(u, a0, r1, -0.6), E(u, a1, r1, -0.6), E(u, a1, r1, 0.6), E(u, a0, r1, 0.6), sub(E(u, am, r1), at(u, 0, R)), col);
          flat.quad(E(u, a0, R_EXT, -0.6), E(u, a1, R_EXT, -0.6), E(u, a1, r1, -0.6), E(u, a0, r1, -0.6), bwd, mul(col, 0.8));
        }
      }
      // Lagerböcke
      const hs = (lat: number): number => R - Math.sqrt(R_EXT * R_EXT - lat * lat);
      for (let u = first + 24; u <= last - 20; u += detail ? 48 : 96) {
        for (const s of [-1, 1]) {
          const T = (x: number, y: number, z: number): V3 => at(u + z, s * x, y);
          const xa = 15.5;
          const xb = 23;
          const ya = hs(xa) + 0.25;
          const yb = hs(xb) + 0.25;
          const P = (x: number, top: boolean, z: number): V3 => T(x, top ? (x === xa ? ya : yb) : -1.0, z);
          const ctr = T((xa + xb) / 2, 2, 0);
          const o = (p: V3): V3 => sub(p, ctr);
          const fz = (z: number): V3 => sub(T((xa + xb) / 2, 2, z), ctr);
          body.quad(P(xa, false, -2.5), P(xb, false, -2.5), P(xb, true, -2.5), P(xa, true, -2.5), fz(-1), mul(C_CONCRETE, 0.8));
          body.quad(P(xa, false, 2.5), P(xb, false, 2.5), P(xb, true, 2.5), P(xa, true, 2.5), fz(1), mul(C_CONCRETE, 0.9));
          body.quad(P(xb, false, -2.5), P(xb, false, 2.5), P(xb, true, 2.5), P(xb, true, -2.5), o(T(xb + 1, 2, 0)), C_CONCRETE);
          body.quad(P(xa, true, -2.5), P(xb, true, -2.5), P(xb, true, 2.5), P(xa, true, 2.5), o(T((xa + xb) / 2 + 1, 12, 0)), C_YEL);
          body.quad(P(xa, false, -2.5), P(xa, false, 2.5), P(xa, true, 2.5), P(xa, true, -2.5), o(T(xa - 1, 2, 0)), mul(C_CONCRETE, 0.7));
        }
      }
      // Zahnkranz, Elektromotor und Kabel am Einfahrtsende (oben links)
      {
        const ug = first + 5;
        const NG = detail ? 36 : 24;
        const sg = seg(Math.round(ug));
        const fwd: V3 = [t.tx[sg], 0, t.tz[sg]];
        const bwd: V3 = [-fwd[0], 0, -fwd[2]];
        for (let k = 0; k < NG; k++) {
          const a0 = AE + ((TAU - 2 * AE) * k) / NG;
          const a1 = AE + ((TAU - 2 * AE) * (k + 1)) / NG;
          const am = (a0 + a1) / 2;
          const r1 = k % 2 === 0 ? R_EXT + 1.6 : R_EXT + 1.1;
          const col = mul(C_STEEL_HI, 0.8 * shadeOut(ug, am));
          flat.quad(E(ug, a0, r1, -0.7), E(ug, a1, r1, -0.7), E(ug, a1, r1, 0.7), E(ug, a0, r1, 0.7), sub(E(ug, am, r1), at(ug, 0, R)), col);
          flat.quad(E(ug, a0, R_EXT, -0.7), E(ug, a1, R_EXT, -0.7), E(ug, a1, r1, -0.7), E(ug, a0, r1, -0.7), bwd, mul(col, 0.75));
          flat.quad(E(ug, a0, R_EXT, 0.7), E(ug, a1, R_EXT, 0.7), E(ug, a1, r1, 0.7), E(ug, a0, r1, 0.7), fwd, mul(col, 0.85));
          if (k + 1 < NG) {
            const r2 = (k + 1) % 2 === 0 ? R_EXT + 1.6 : R_EXT + 1.1;
            const lo2 = Math.min(r1, r2);
            const hi2 = Math.max(r1, r2);
            flat.quad(E(ug, a1, lo2, -0.7), E(ug, a1, hi2, -0.7), E(ug, a1, hi2, 0.7), E(ug, a1, lo2, 0.7), r1 > r2 ? sub(E(ug, a1 + 0.1, R_EXT), E(ug, a1, R_EXT)) : sub(E(ug, a1 - 0.1, R_EXT), E(ug, a1, R_EXT)), mul(col, 0.7));
          }
        }
        // Motor: liegender Zylinder (Achse längs), Rippen, Klemmkasten, Ritzel, Halterung
        const phi = -2.35;
        const dm = 32.6;
        const cl = dm * Math.sin(phi);
        const ch = R - dm * Math.cos(phi);
        // Rahmen des Motors: x quer (radial nach außen), y = Achse des Motors (längs), z tangential
        const ex = Math.sin(phi);
        const ey = -Math.cos(phi);
        const Tm = (x: number, y: number, z: number): V3 => at(ug + 3 + y, cl + ex * x - ey * z, ch + ey * x + ex * z);
        cylL(body, Tm, 0, 0, 3.6, 2, 12, C_MOTOR, C_STEEL_D, 10);
        for (const yy of [3.5, 6, 8.5]) cylL(body, Tm, 0, 0, 3.95, yy, yy + 0.6, mul(C_MOTOR, 1.25), mul(C_MOTOR, 1.1), 10);
        cylL(body, Tm, 0, 0, 1.0, -4, 2, C_STEEL_HI, C_STEEL, 8); // Welle
        cylL(body, Tm, 0, 0, 3.4, -3.7, -2.3, C_STEEL, C_STEEL_HI, 12); // Ritzel, greift in den Zahnkranz
        boxL(body, Tm, 3.4, 5.2, 5, 8, -1.2, 1.2, C_STEEL_D, C_STEEL);
        boxL(body, Tm, -6.0, -2.8, 3, 11, -2.2, 2.2, C_STEEL_D, C_STEEL);
        // Kabelpritsche auf dem Rücken der Trommel bis zum anderen Ende
        const pa = -2.75;
        const CT = detail ? 16 : 32;
        for (let u = first + 16; u < last - 6; u += CT) {
          const u1 = Math.min(last - 6, u + CT);
          const Tc = (x: number, y: number, uu: number): V3 => {
            const rr = R_EXT + y;
            const a = pa + x / R_EXT;
            return E(uu, a, rr);
          };
          const top = sub(Tc(0, 1, u), Tc(0, 0, u));
          flat.quad(Tc(-0.5, 0.35, u), Tc(0.5, 0.35, u), Tc(0.5, 0.35, u1), Tc(-0.5, 0.35, u1), top, C_STEEL_D);
          flat.quad(Tc(0.5, 0, u), Tc(0.5, 0.35, u), Tc(0.5, 0.35, u1), Tc(0.5, 0, u1), sub(Tc(1, 0.2, u), Tc(0, 0.2, u)), mul(C_STEEL_D, 0.8));
          flat.quad(Tc(-0.5, 0, u), Tc(-0.5, 0.35, u), Tc(-0.5, 0.35, u1), Tc(-0.5, 0, u1), sub(Tc(-1, 0.2, u), Tc(0, 0.2, u)), mul(C_STEEL_D, 0.8));
        }
        // Kabelstrang vom Motor an der Haut hinunter zum Klemmkasten am Boden
        const uc = first + 9;
        const path: V3[] = [];
        for (let k = 0; k <= 8; k++) {
          const a = -2.2 + (k / 8) * (2.2 - 0.62);
          path.push([-(R_EXT + 0.35) * Math.sin(a) * -1, R - (R_EXT + 0.35) * Math.cos(a), 0]);
        }
        path.push([-R_EXT * Math.sin(0.62) - 0.4, -0.5, 0]);
        for (let k = 0; k + 1 < path.length; k++) {
          const A = path[k];
          const B = path[k + 1];
          for (const dz of [-0.35, 0.35]) {
            const a0 = at(uc + dz - 0.2, A[0], A[1]);
            const a1 = at(uc + dz + 0.2, A[0], A[1]);
            const b0 = at(uc + dz - 0.2, B[0], B[1]);
            const b1 = at(uc + dz + 0.2, B[0], B[1]);
            const outv = sub(at(uc, A[0] * 1.1, R + (A[1] - R) * 1.1), at(uc, A[0], A[1]));
            flat.quad(a0, a1, b1, b0, outv, C_BLACK);
          }
        }
        const kb = path[path.length - 1];
        boxL(body, (x, y, z) => at(uc + z, kb[0] + x, y), -1.6, 1.6, -0.5, 2.6, -1.2, 1.2, C_STEEL, C_YEL);
      }
    }
  }

  
  // ======================== Netze ========================
  let tris = 0;
  const fixedGeo = fixed.build();
  const basic = new THREE.MeshBasicMaterial({ vertexColors: true });
  const fixedMesh = new THREE.Mesh(fixedGeo, basic);
  fixedMesh.name = 'trommel-fest';
  group.add(fixedMesh);
  disposables.push(fixedGeo, basic);
  tris += fixed.triangles;

  if (detail && !inkB.empty) {
    const inkGeo = inkB.build();
    addSmoothNormals(inkGeo);
    const outline = new THREE.Mesh(inkGeo, outlineMaterial(0.05));
    outline.name = 'outline';
    group.add(outline);
    disposables.push(inkGeo);
    tris += inkB.triangles;
  }

  // Signalflächen
  const sPosArr = new Float32Array(sPos);
  const sColArr = new Float32Array(sCol);
  const sGeo = new THREE.BufferGeometry();
  const sPosAttr = new THREE.BufferAttribute(sPosArr, 3).setUsage(THREE.DynamicDrawUsage);
  const sColAttr = new THREE.BufferAttribute(sColArr, 3).setUsage(THREE.DynamicDrawUsage);
  sGeo.setAttribute('position', sPosAttr);
  sGeo.setAttribute('color', sColAttr);
  sGeo.setIndex(sIdx);
  sGeo.computeBoundingSphere();
  if (sGeo.boundingSphere) sGeo.boundingSphere.radius += 4;
  const sMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const sMesh = new THREE.Mesh(sGeo, sMat);
  sMesh.name = 'trommel-signal';
  group.add(sMesh);
  disposables.push(sGeo, sMat);
  tris += sIdx.length / 3;

  // Schein
  const gPosArr = new Float32Array(glow.pos);
  const gColArr = new Float32Array(glow.col);
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPosArr, 3));
  const gColAttr = new THREE.BufferAttribute(gColArr, 3).setUsage(THREE.DynamicDrawUsage);
  gGeo.setAttribute('color', gColAttr);
  gGeo.computeBoundingSphere();
  const gMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const gMesh = new THREE.Mesh(gGeo, gMat);
  gMesh.name = 'trommel-schein';
  gMesh.renderOrder = 2;
  group.add(gMesh);
  disposables.push(gGeo, gMat);
  tris += glow.triangles;

  group.userData.triangles = tris;
  group.userData.parts = parts;
  group.userData.drum = {
    wall: wallRanges,
    floor: floorRanges,
    hang: hangRanges,
    lamps: lampInfo,
    plates: pieces.map((p) => ({ holes: p.holes, lat0: p.lat0, lat1: p.lat1, from: p.vLam, to: p.vLam + p.nLam * 4 })),
  };

  // ======================== je Bild ========================
  const looks: PlateLook[] = t.holes.map(() => ({ kind: 0, g: G_ON, col: [0, 0, 0], w: 0, tw: 0, coil: [0, 0, 0], halo: [0, 0, 0], fa: [0, 0, 0], fb: [0, 0, 0] }));
  const used = new Uint8Array(t.holes.length);
  for (const p of pieces) for (const h of p.holes) used[h] = 1;
  for (const c of plateCoils) used[c.hole] = 1;

  const setRgb = (out: RGB, a: RGB, b: RGB, k: number): void => {
    out[0] = a[0] + (b[0] - a[0]) * k;
    out[1] = a[1] + (b[1] - a[1]) * k;
    out[2] = a[2] + (b[2] - a[2]) * k;
  };
  const C_FRAME_A = rgb(0x2a2e38);
  const C_FRAME_B = rgb(0x6a7284);
  const C_RED_GLOW: RGB = [0.05, 0, 0];
  const C_MAG_GLOW = mul(C_MAG, 0.42);
  const C_LINE_WARN: RGB = [1, 1, 0.8];

  /**
   * Zustand jeder Platte zur Rennzeit. Das Bild zeigt nie eine tragende Platte, wo die Physik fallen lässt: Die
   * Lamellen klappen in den letzten FOLD Ticks der Ankündigung weg (bei „aus“ ist die Platte schon fort), und beim
   * Wiedereinschalten stehen sie sofort auf halber Länge in Blau da und wachsen in REGROW Ticks nach.
   */
  function evalLooks(time: number): void {
    const FOLD = 10;
    const REGROW = 12;
    for (let i = 0; i < t.holes.length; i++) {
      if (!used[i]) continue;
      const h = t.holes[i];
      const L = looks[i];
      const c = planClock(h.plan, time);
      const settled = time <= 0;
      if (planActive(h.plan, time)) {
        // aus: Schacht offen, Rahmen und Spulen rot-schwarz
        L.kind = 2;
        L.g = 0;
        setRgb(L.col, C_RED, C_RED, 0);
        L.w = 1;
        L.tw = 0;
        setRgb(L.coil, C_DARKRED, C_DARKRED, 0);
        setRgb(L.halo, C_RED_GLOW, C_RED_GLOW, 0);
        setRgb(L.fa, C_RED, C_RED, 0);
        setRgb(L.fb, C_BLACK, C_BLACK, 0);
        continue;
      }
      // Ankündigung: die Platte schaltet binnen warn Ticks ab. (Wörtlich planActive(plan, time + warn) hätte bei
      // warn = 150 und nur 120 Ticks „aus“ eine Lücke: die letzten 30 Ticks vor dem Abschalten wären wieder blau.)
      const until = planUntil(h.plan, time);
      const warn = until <= h.warn;
      if (warn) {
        const w = Math.max(0, Math.min(1, 1 - until / h.warn));
        const tw = h.warn - until;
        const k = settled ? 1 : smooth(tw / 15);
        // zum Schluss: wegklappen, Gelb → Rot
        const fold = until < FOLD ? 1 - smooth(until / FOLD) : 0;
        L.kind = 1;
        L.w = w;
        L.tw = tw;
        L.g = (G_ON - 0.33 * w) * (1 - fold);
        setRgb(L.col, C_MAG, C_YEL, k);
        setRgb(L.col, L.col, C_RED, fold);
        // Spulen: gelb und blassen über die Ankündigung ab (weich)
        setRgb(L.coil, C_MAG_HI, C_YEL, k);
        const fade = 1 - 0.62 * w;
        L.coil[0] *= fade;
        L.coil[1] *= fade;
        L.coil[2] *= fade;
        setRgb(L.halo, C_MAG, C_YEL, k);
        const hf = 0.42 * (1 - 0.8 * w);
        L.halo[0] *= hf;
        L.halo[1] *= hf;
        L.halo[2] *= hf;
        setRgb(L.fa, C_FRAME_A, C_YEL, k);
        setRgb(L.fb, C_FRAME_B, C_BLACK, k);
        continue;
      }
      // an: nach dem Wiedereinschalten sofort blau auf halber Länge, dann nachwachsen; Spulen werden wieder blau
      const since = settled ? Infinity : sinceEnd(h.plan, c);
      const k = Number.isFinite(since) ? smooth(since / REGROW) : 1;
      L.kind = 0;
      L.w = 0;
      L.tw = 0;
      L.g = G_ON * (0.5 + 0.5 * k);
      setRgb(L.col, C_MAG_HI, C_MAG, 0.4 + 0.6 * k);
      setRgb(L.coil, C_DARKRED, C_MAG_HI, 0.4 + 0.6 * k);
      setRgb(L.halo, C_RED_GLOW, C_MAG_GLOW, 0.4 + 0.6 * k);
      setRgb(L.fa, C_RED, C_FRAME_A, 0.4 + 0.6 * k);
      setRgb(L.fb, C_BLACK, C_FRAME_B, 0.4 + 0.6 * k);
    }
  }

  /** Punkt auf der Fahrbahn an der gebrochenen Stelle u (ohne Anlegen). */
  function roadInto(u: number, lat: number, h: number, arr: Float32Array, o: number): void {
    const i = Math.floor(u);
    const f = u - i;
    const a = mod(i, t.total);
    const b = mod(i + 1, t.total);
    const L = (x: number, y: number): number => x + (y - x) * f;
    arr[o] = L(t.px[a], t.px[b]) + L(rightX(t, a), rightX(t, b)) * lat;
    arr[o + 1] = L(t.py[a], t.py[b]) + lat * L(t.bank[a], t.bank[b]) + h;
    arr[o + 2] = L(t.pz[a], t.pz[b]) + L(rightZ(t, a), rightZ(t, b)) * lat;
  }
  function quadInto(v: number, ua: number, ub: number, la: number, lb: number, h: number): void {
    roadInto(ua, la, h, sPosArr, v * 3);
    roadInto(ua, lb, h, sPosArr, v * 3 + 3);
    roadInto(ub, lb, h, sPosArr, v * 3 + 6);
    roadInto(ub, la, h, sPosArr, v * 3 + 9);
  }
  function colorInto(v: number, n: number, c: RGB): void {
    for (let i = 0; i < n; i++) {
      sColArr[(v + i) * 3] = c[0];
      sColArr[(v + i) * 3 + 1] = c[1];
      sColArr[(v + i) * 3 + 2] = c[2];
    }
  }
  const tmpCol: RGB = [0, 0, 0];

  function writeSignals(time: number): void {
    evalLooks(time);
    const sec = Math.max(0, time) / 60;
    for (let pi = 0; pi < pieces.length; pi++) {
      const p = pieces[pi];
      // Zustand des Stücks: der gefährlichste seiner Platten
      let L = looks[p.holes[0]];
      for (let k = 1; k < p.holes.length; k++) if (looks[p.holes[k]].kind > L.kind) L = looks[p.holes[k]];
      const len = (p.u1 - p.u0) / p.nLam;
      // kleine Fuge zwischen den Stücken
      const la = p.lat0 + 0.04;
      const lb = p.lat1 - 0.04;
      for (let j = 0; j < p.nLam; j++) {
        const c = p.u0 + (j + 0.5) * len;
        const hl = (len / 2) * L.g;
        const v = p.vLam + j * 4;
        if (hl < 0.01) quadInto(v, c, c, la, la, PLATE_H);
        else quadInto(v, c - hl, c + hl, la, lb, PLATE_H);
        colorInto(v, 4, L.col);
      }
      // Feldlinien
      const SP = 3;
      const L2 = (p.u1 - p.u0) / 2;
      const mid = (p.u0 + p.u1) / 2;
      for (let j = 0; j < LINES; j++) {
        const v = p.vLine + j * 4;
        let pos = NaN;
        let bright = 1;
        // (verborgene Linien schwarz: die Farbe darf nicht vom vorigen Bild abhängen)
        tmpCol[0] = tmpCol[1] = tmpCol[2] = 0;
        if (L.kind === 0) {
          // langsam voran
          const off = mod(sec * 0.7, SP);
          pos = p.u0 + off + j * SP;
          if (pos > p.u1 - 0.3) pos = NaN;
          setRgb(tmpCol, L.col, C_MAG_HI, 0.75);
        } else if (L.kind === 1) {
          // laufen nach außen weg, werden schneller und blasser
          const half = j % 2 === 0 ? 1 : -1;
          const idx = j >> 1;
          const tt = L.tw / 60;
          // (höchstens etwa 4 m/s bei 2,25 m Abstand: ein Bildpunkt wird keine zweimal je Sekunde überstrichen)
          const dd = mod((idx * L2) / (LINES / 2) + 1.0 * tt + 0.6 * tt * tt, L2);
          pos = mid + half * dd;
          bright = (1 - 0.65 * L.w) * (1 - dd / L2);
          setRgb(tmpCol, L.col, C_LINE_WARN, 0.6);
        }
        const hl = 0.11;
        if (Number.isNaN(pos) || pos - hl < p.u0 || pos + hl > p.u1) {
          quadInto(v, p.u0, p.u0, la, la, LINE_H);
        } else quadInto(v, pos - hl, pos + hl, la + 0.25, lb - 0.25, LINE_H);
        tmpCol[0] *= bright;
        tmpCol[1] *= bright;
        tmpCol[2] *= bright;
        colorInto(v, 4, tmpCol);
      }
    }
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      colorInto(f.v, 4, f.odd ? looks[f.hole].fb : looks[f.hole].fa);
    }
    for (let ci = 0; ci < plateCoils.length; ci++) {
      const c = plateCoils[ci];
      colorInto(c.v, c.n, looks[c.hole].coil);
      const hc = looks[c.hole].halo;
      for (let i = 0; i < c.glowN; i++) {
        const w = c.glowW[i] / 0.42;
        gColArr[(c.glowV + i) * 3] = hc[0] * w;
        gColArr[(c.glowV + i) * 3 + 1] = hc[1] * w;
        gColArr[(c.glowV + i) * 3 + 2] = hc[2] * w;
      }
    }
    sPosAttr.needsUpdate = true;
    sColAttr.needsUpdate = true;
    gColAttr.needsUpdate = true;
  }
  writeSignals(0);

  // Weit weg (die Platten sieht man nur in der Trommel oder durch ihre Enden) bleibt der Puffer stehen; kommt die
  // Kamera wieder näher, wird alles aus der Rennzeit neu gerechnet.
  const mid = fixedGeo.boundingSphere ? fixedGeo.boundingSphere.center.clone() : new THREE.Vector3();
  const far = (fixedGeo.boundingSphere?.radius ?? 0) + 250;

  // Funken: je Schweißstelle ein Zähler (nur für die Teilchen; das Bild hängt nicht davon ab)
  const lastShot = new Float64Array(welds.length).fill(NaN);

  return {
    group,
    update(time, _seconds, _dt, cam, fx) {
      if (cam.distanceToSquared(mid) < far * far) writeSignals(time);
      if (!detail) return;
      for (let i = 0; i < welds.length; i++) {
        const w = welds[i];
        const n = Math.floor(time / 5 + i * 0.37);
        const prev = lastShot[i];
        lastShot[i] = n;
        if (Number.isNaN(prev) || n <= prev || n - prev > 3) continue;
        const dx = w.x - cam.x;
        const dy = w.y - cam.y;
        const dz = w.z - cam.z;
        if (dx * dx + dy * dy + dz * dz > 150 * 150) continue;
        for (let k = prev + 1; k <= n; k++) {
          // ruhig: ein, zwei Funken je Schuss, sie fallen zum Hallenboden
          const r1 = Math.sin(k * 12.9898 + i * 78.233) * 43758.5453;
          const q = r1 - Math.floor(r1);
          const sp = 7 + 4 * q;
          const sx = (q - 0.5) * 2.4;
          fx.spark(w.x, w.y, w.z, w.dx * sp + w.side[0] * sx, w.dy * sp + w.side[1] * sx, w.dz * sp + w.side[2] * sx, Math.min(2.2, w.drop / sp), 0.45, k % 3 === 0 ? 0xffffff : 0xffd27a, 0);
        }
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
