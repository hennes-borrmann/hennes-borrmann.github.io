// Zeitriss-Ruine: Darstellung der beiden Zeitalter – Hallenboden, Aquädukt, Tore, Wegweiser, Zeituhr.
//
// Was hier zu sehen ist, steht genau dort, wo die Physik es hat (game/mechanics.ts: Era, Hole, Gate;
// game/track.ts: holeAt, gateAt), und ist eine reine Funktion der Rennzeit: Springt die Zeit vor oder
// zurück, stimmt das Bild im selben Bild wieder (nur Teilchen hängen am Bildtakt).
//
// Zwei Farbwelten: Was es nur EINST gibt, ist prächtig – Gold, Lapislazuli, Zinnober. Wo JETZT etwas
// fehlt, schimmert das türkise ZEITECHO: ein dünner, additiver Umriss dessen, was dort war – er trägt nicht.
//
// Hallenplatten (die fünf Bruchstellen der Hauptstrecke): Die stehende Welt (world.ts) lässt in der
// Fahrbahn genau die Form jeder Bruchstelle offen; hier wird sie als Mosaikfeld gefüllt (goldene
// Einfassung, Zinnober-Rauten auf Lapis) – bündig, ohne Absatz, Oberfläche exakt auf Fahrbahnhöhe.
//   * die letzten 3 s vor dem Sprung nach Jetzt: das Mosaik flimmert, wird streifig durchsichtig,
//     türkise Risse laufen hindurch, immer schneller (es trägt bis zum Sprung);
//   * Sprung nach Jetzt: die Schollen stürzen in gut einer halben Sekunde in den Abgrund;
//   * Jetzt: Bruchkante rundum (verwitterte Innenwände, Moos, Wurzeln), darüber das Zeitecho;
//   * die letzten 3 s vor dem Sprung nach Einst: Bruchstücke steigen türkis aus der Tiefe und setzen
//     sich zusammen – fertig genau mit dem Sprung; danach läuft ein goldener Schimmer über die Platte.
// Aquädukt (Abzweigung, Bruchstellen über die ganze Breite): Die Welt zeichnet dort nichts; hier steht die
// ganze Brücke – Fahrrinne mit Wasserlauf, Rundbögen, Pfeiler. Jetzt bröckelt sie, und ihre fünf Stücke
// stürzen zu den Zeiten ein, die track.holes vorgibt; zurück bleiben Pfeilerstümpfe und das Echo der Bögen.
// Tore: die Sperre steht genau auf der Linie, an der die Physik die Bande der Hauptstrecke durchziehen
// lässt, und genau dann, wenn gateAt gilt (Schatzkammer: Tempelmauer mit versiegeltem Tor; Aquädukt:
// Trümmer und Wurzeln). Offen: Trümmerhaufen bzw. ein Torbogen neben der Bahn.
// Wegweiser mit Pfeil, Lichtzeichen (grün offen, rot mit Kreuz zu, blinkend vor dem Wechsel) und
// Sanduhr-Ring (sechs Segmente, die im Lauf des Zeitalters erlöschen). Die Zeituhr (Wahrzeichen):
// Obelisk mit Ring, halb Gold, halb Türkis, Zeiger einmal in 36 s herum. Beim Sprung läuft von ihr
// ein flacher Lichtring über das Land.
//
// Zeichentechnik (wie im Werkshof bestätigt): nur Eckenfarben, Toon-Körper mit Kontur, einfache
// Flächen (auch additiv) und Netze, deren Ecken je Bild neu gesetzt werden. Kein eigener Shader,
// keine Textur. Bewegliche Teile liegen in drei Netzen (Platten ohne Kontur, Steinkörper mit Kontur,
// Leuchtlinien additiv); geschrieben werden je Bild nur Körper, deren Zustand sich ändert.
//
// Zeichenaufrufe mit detail: Platten 1, Steinkörper 1 + Kontur 1, Leuchtlinien 1, Feststehendes
// 1 + 1, Lichtzeichen 1, zwei Sperren je 1 + 1 = 11. Ohne detail (keine Konturen) 7.

import * as THREE from 'three';
import { ERA_WARN, eraAt, eraSince, eraUntil, planActive, planSince, planUntil, type Hole, type Plan } from '../../game/mechanics';
import { EDGE_FREE_L, EDGE_FREE_R, EDGE_OPEN_L, EDGE_OPEN_R, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';
import { HOLE_RIM } from '../world';
import { boxT, face, type Xform } from './machineKit';

// --- Farben ------------------------------------------------------------------------

// Einst: Pracht
const GOLD = rgb(0xe8b030);
const GOLD_HI = rgb(0xfff0a8);
const GOLD_D = rgb(0xa8741c);
const LAPIS = rgb(0x2252b0);
const LAPIS_D = rgb(0x173a82);
const VERMIL = rgb(0xd8432a);
const IVORY = rgb(0xf6ecd0);
// Stein
const STONE = rgb(0xe2d2a6);
const STONE_B = rgb(0xd4c292);
const STONE_SIDE = rgb(0xb8a47a);
const STONE_D = rgb(0x9c8a62);
const PIER = rgb(0xcdbb8e);
const PIER_D = rgb(0xa8966a);
const WALL_A = rgb(0xdccb9e);
const WALL_B = rgb(0xc4b286);
const CORNICE = rgb(0xeee0b8);
const WATER = rgb(0x7fd6ea);
const WATER_HI = rgb(0xb8eef8);
const BRONZE = rgb(0x5c3a22);
// Jetzt: Verfall
const WEATHER = rgb(0x8f7d58);
const WEATHER_D = rgb(0x4e4434);
const RUBBLE = rgb(0xa8956c);
const RUBBLE_B = rgb(0x8c7b58);
const MOSS = rgb(0x5f9a3a);
const MOSS_D = rgb(0x467a2c);
const ROOT = rgb(0x5a4028);
const ABYSS = rgb(0x0b161a);
const DEEP = rgb(0x070c0d);
// Zeitecho und Leuchten (additiv)
const TURQ = rgb(0x38f2d8);
const TURQ_GHOST = rgb(0x7ff6e6);
const CRACK = rgb(0x46ffe8);
const VEIL = shade(rgb(0x38f2d8), 0.035);
const GOLD_GLOW = rgb(0xffc040);
// Wegweiser und Uhr
const STELE = rgb(0xd6c496);
const STELE_D = rgb(0xa8966a);
const BOARD = rgb(0x1c2830);
const L_GREEN = new THREE.Color(0x2bff6a);
const L_RED = new THREE.Color(0xff2a14);
const L_OFF = new THREE.Color(0x2a2420);
const L_GOLD = new THREE.Color(0xffc23a);
const L_TURQ = new THREE.Color(0x2ff0d8);
const L_DIM = new THREE.Color(0x3a3228);
const L_ARROW_OFF = new THREE.Color(0x4a3e34);

// --- Maße ----------------------------------------------------------------------------

/** Dicke einer Hallenplatte (sichtbar nur im Fall) und Tiefe der Innenwände im Loch (Stegdicke world.ts). */
const PLATE_D = 0.9;
const WALL_D = 1.1;
/** So tief unter einem Loch der Halle liegt das Dunkel. */
const DARK_D = 3.2;
/** Aquädukt: Unterkante der Fahrrinne, Unterkante der Pfeiler (darunter der Stumpf), Kante. */
const AQ_D = -1.5;
const AQ_PIER = -8;
const AQ_STUMP = -19;
const CURB_W = 0.14;
/** Länge einer Raute im Mosaik der Hallenplatten. */
const DIAMOND = 4.4;
const CURB_H = 0.12;
/** So lange (Ticks) nach dem Sprung läuft der goldene Schimmer, so lange der Riss-Ring. */
const SHIMMER_T = 40;
const RISS_T = 48;
/** Ticks vor und nach dem Umschalten eines Tors, in denen Brocken neben der Bahn fallen. */
const CHUNK_T = 30;
/** Aufsteigende Bruchstücke bleiben bis zum Sprung so weit unter der Fahrbahn (sie tragen erst ab dann). */
const RISE_GAP = 0.2;
/** Abstand der durchsichtigen Streifen, die vor dem Sprung über eine Platte laufen (m). */
const STRIPE = 3.2;

// --- Hilfen --------------------------------------------------------------------------

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
const UP: V3 = [0, 1, 0];
const DOWN: V3 = [0, -1, 0];
const sstep = (a: number, b: number, x: number): number => smooth((x - a) / (b - a));

/** Ticks bis zum nächsten Wechsel des Plans (gilt ↔ gilt nicht); Infinity = nie mehr. */
function ticksToChange(p: Plan, time: number): number {
  if (!planActive(p, time)) return planUntil(p, time);
  if (p.period > 0) {
    const c = time <= 0 ? 0 : time % p.period;
    for (let i = 0; i < p.spans.length; i += 2) if (c >= p.spans[i] && c < p.spans[i + 1]) return p.spans[i + 1] - c;
    return Infinity;
  }
  for (let i = 0; i < p.spans.length; i += 2) if (time >= p.spans[i] && time < p.spans[i + 1]) return p.spans[i + 1] - time;
  return Infinity;
}

/** Ein bewegliches Netz: Ruhelage der Ecken, aktuelle Ecken, Grundfarben. */
interface Layer {
  mb: MeshBuilder;
  toon: boolean;
  rest: Float32Array;
  pos: Float32Array;
  restN: Float32Array;
  nor: Float32Array;
  base: Float32Array;
  col: Float32Array;
  attrs: THREE.BufferAttribute[];
  lo: number;
  hi: number;
}

/** Ein Körper: Eckenbereiche in den drei Netzen, Drehpunkt und -achse, Bezug für Muster längs. */
interface Body {
  v: Int32Array;
  px: number;
  py: number;
  pz: number;
  ax: number;
  ay: number;
  az: number;
  ox: number;
  oz: number;
  ux: number;
  uz: number;
  tint: RGB;
  last: Float64Array;
}
/** Werte eines Körpers: verborgen, dx, dy, dz, Winkel, Tönung, Leuchtkraft, Muster, Phase, Stärke. */
const NPAR = 10;
const MODE_STRIPES = 1;
const MODE_SHIMMER = 2;

/** Hallenplatte (Mosaik): Abschnitte, seitliche Lage je Abschnitt, Schollen, Echo, Bruchkante. */
interface Plate {
  hole: Hole;
  index: number;
  segs: number[];
  l0: number[];
  l1: number[];
  shards: Body[];
  delay: number[];
  rise: number[];
  drift: number[];
  spin: number[];
  phase: number[];
  echo: Body;
  lattice: Body;
  rims: Body;
  samples: number[];
  seen: number;
}

/** Ein Stück des Aquädukts. */
interface Piece {
  hole: Hole;
  index: number;
  segs: number[];
  /** Lage im Aquädukt (Meter ab seinem Anfang). */
  X0: number;
  X1: number;
  bodies: Body[];
  delay: number[];
  spin: number[];
  drift: number[];
  echo: Body;
  samples: number[];
  seen: number;
}

/** Lichtzeichen eines Wegweisers: Bereiche im Lampennetz. */
interface SignLamps {
  arrow: [number, number];
  disc: [number, number];
  cross: [number, number];
  ring: [number, number][];
}

export function buildRift(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'zeitriss';
  const era = t.era;
  if (!era) return { group, update() {}, dispose() {} };
  const disposables: { dispose(): void }[] = [];
  let tris = 0;

  /** Punkt auf der Fahrbahn wie in world.ts: Abschnitt i, Anteil f zum nächsten, seitlich lat, dy darüber. */
  const P = (i: number, f: number, lat: number, dy = 0): V3 => {
    const x = t.px[i] + rightX(t, i) * lat;
    const y = t.py[i] + lat * t.bank[i] + dy;
    const z = t.pz[i] + rightZ(t, i) * lat;
    if (f === 0) return [x, y, z];
    const j = t.next[i];
    const x2 = t.px[j] + rightX(t, j) * lat;
    const y2 = t.py[j] + lat * t.bank[j] + dy;
    const z2 = t.pz[j] + rightZ(t, j) * lat;
    return [x + (x2 - x) * f, y + (y2 - y) * f, z + (z2 - z) * f];
  };
  const fwd = (i: number): V3 => [t.tx[i], 0, t.tz[i]];
  const right = (i: number): V3 => [rightX(t, i), 0, rightZ(t, i)];
  /**
   * Punkt über einer Folge von Abschnitten: x läuft über die Zellen (Zelle k von x = k bis k + 1, ihr
   * Mittelpunkt – der Abschnitt segs[k] – bei k + ½). Zwischen zwei Mittelpunkten linear wie die Physik.
   */
  const surf = (segs: number[], x: number, lat: number, dy = 0): V3 => {
    let k = Math.floor(x);
    if (k > segs.length - 1) k = segs.length - 1;
    if (k < 0) k = 0;
    const fr = x - k;
    const s = segs[k];
    return fr < 0.5 ? P(t.prev[s], 0.5 + fr, lat, dy) : P(s, fr - 0.5, lat, dy);
  };
  /** Teilungen längs, die keinen Mittelpunkt überspannen: 0, ½, 1½, … N−½, N. */
  const centerRows = (x0: number, x1: number): number[] => {
    const out = [x0];
    for (let c = Math.floor(x0) + 0.5; c < x1 - 1e-6; c += 1) if (c > x0 + 1e-6) out.push(c);
    out.push(x1);
    return out;
  };

  // ============================== bewegliche Netze ==============================

  const newLayer = (toon: boolean): Layer => {
    const e = new Float32Array(0);
    return { mb: new MeshBuilder(), toon, rest: e, pos: e, restN: e, nor: e, base: e, col: e, attrs: [], lo: Infinity, hi: -1 };
  };
  const PL = newLayer(true); // Hallenplatten und Bruchkanten (ohne Kontur: sie liegen bündig in der Fahrbahn)
  const SL = newLayer(true); // Steinkörper mit Kontur: Aquädukt, Torbogen, Trümmer
  const AL = newLayer(false); // Leuchtlinien, Zeitecho, Risse, Riss-Ring (additiv)
  const layers = [PL, SL, AL];
  const bodies: Body[] = [];

  function begin(): Body {
    const v = new Int32Array(6);
    for (let i = 0; i < 3; i++) v[i * 2] = layers[i].mb.triangles * 3;
    return { v, px: 0, py: 0, pz: 0, ax: 1, ay: 0, az: 0, ox: 0, oz: 0, ux: 1, uz: 0, tint: TURQ_GHOST, last: new Float64Array(NPAR).fill(NaN) };
  }
  function end(b: Body, pivot: V3, axis: V3 = [1, 0, 0], origin: V3 = pivot, dir: V3 = [1, 0, 0]): Body {
    for (let i = 0; i < 3; i++) b.v[i * 2 + 1] = layers[i].mb.triangles * 3;
    b.px = pivot[0];
    b.py = pivot[1];
    b.pz = pivot[2];
    const n = norm(axis);
    b.ax = n[0];
    b.ay = n[1];
    b.az = n[2];
    b.ox = origin[0];
    b.oz = origin[2];
    const d = norm([dir[0], 0, dir[2]]);
    b.ux = d[0];
    b.uz = d[2];
    bodies.push(b);
    return b;
  }

  /** Streifen p0 → p1 der Breite w, quer dazu in der Ebene mit der Normalen nrm (sichtbar von dort). */
  function strip(mb: MeshBuilder, p0: V3, p1: V3, w: number, nrm: V3, col: RGB): void {
    const side = norm(cross(sub(p1, p0), nrm));
    const h = w / 2;
    face(mb, add(p0, side, -h), add(p1, side, -h), add(p1, side, h), add(p0, side, h), nrm, col);
  }
  /** Balken von a nach b mit Kantenlänge w (vier Seiten). */
  function beam(mb: MeshBuilder, a: V3, b: V3, w: number, col: RGB, caps = false): void {
    const d = norm(sub(b, a));
    const ref: V3 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : UP;
    const u = norm(cross(d, ref));
    const v = norm(cross(d, u));
    const h = w / 2;
    const c = (p: V3, su: number, sv: number): V3 => [p[0] + (u[0] * su + v[0] * sv) * h, p[1] + (u[1] * su + v[1] * sv) * h, p[2] + (u[2] * su + v[2] * sv) * h];
    const corners: [number, number][] = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (let i = 0; i < 4; i++) {
      const [su, sv] = corners[i];
      const [tu, tv] = corners[(i + 1) % 4];
      const out: V3 = [u[0] * (su + tu) + v[0] * (sv + tv), u[1] * (su + tu) + v[1] * (sv + tv), u[2] * (su + tu) + v[2] * (sv + tv)];
      face(mb, c(a, su, sv), c(a, tu, tv), c(b, tu, tv), c(b, su, sv), out, i % 2 === 0 ? col : shade(col, 0.85));
    }
    if (caps) {
      face(mb, c(a, 1, 1), c(a, -1, 1), c(a, -1, -1), c(a, 1, -1), neg(d), col);
      face(mb, c(b, 1, 1), c(b, -1, 1), c(b, -1, -1), c(b, 1, -1), d, col);
    }
  }
  /** Rahmen eines Abschnitts: x seitlich (rechts), y hoch, z voraus. */
  const segFrame = (s: number, base: V3): Xform => {
    const r = right(s);
    const f = fwd(s);
    return (x, y, z) => [base[0] + r[0] * x + f[0] * z, base[1] + y, base[2] + r[2] * x + f[2] * z];
  };

  /** Bauabschnitte der Deckflächen (für Tests): Bruchstelle, Netz, Dreiecke. */
  const deckInfo: { hole: number; layer: 'platten' | 'stein'; tris: number[] }[] = [];

  // ============================== Bruchstellen: wem gehört welcher Abschnitt ==============================

  // Wo sich Bruchstellen überlappen (Fugen zwischen den Stücken des Aquädukts), gehört der Abschnitt der,
  // die zuerst bricht – so wie die Physik dort schon ab dem ersten Bruch keinen Boden mehr hat.
  const firstStart = (p: Plan): number => (p.spans.length > 0 ? p.spans[0] : Infinity);
  const order = t.holes.map((_, i) => i).sort((a, b) => firstStart(t.holes[a].plan) - firstStart(t.holes[b].plan) || a - b);
  const taken = new Map<number, [number, number][]>();
  interface Cells {
    index: number;
    segs: number[];
    l0: number[];
    l1: number[];
    bridge: boolean;
  }
  const cells: Cells[] = [];
  for (const hi of order) {
    const h = t.holes[hi];
    const c: Cells = { index: hi, segs: [], l0: [], l1: [], bridge: h.lat0 <= -t.wh[h.first] && h.lat1 >= t.wh[h.first] };
    for (let s = h.first; s < h.first + h.count; s++) {
      const open = (t.edge[s] & (EDGE_OPEN_L | EDGE_OPEN_R)) !== 0;
      const rim = open ? 0 : HOLE_RIM;
      const a = Math.max(h.lat0, -t.wh[s] + rim);
      const b = Math.min(h.lat1, t.wh[s] - rim);
      if (b - a < 0.05) continue;
      const list = taken.get(s) ?? [];
      if (list.some(([x, y]) => x < b && y > a)) continue;
      if (c.segs.length > 0 && t.next[c.segs[c.segs.length - 1]] !== s) break;
      c.segs.push(s);
      c.l0.push(a);
      c.l1.push(b);
      list.push([a, b]);
      taken.set(s, list);
    }
    if (c.segs.length > 0) cells.push(c);
  }

  // ============================== Hallenplatten: Mosaik ==============================

  /** Muster des Mosaiks an der Stelle xm (längs, 0 … N) und wm (quer, 0 … W). */
  function mosaic(xm: number, wm: number, N: number, W: number): RGB {
    const e = Math.min(xm, N - xm, wm, W - wm);
    if (e < 0.55) return GOLD;
    if (e < 1.1) return LAPIS_D;
    const Pd = DIAMOND;
    const xc = N / 2 + Pd * Math.round((xm - N / 2) / Pd);
    const dx = Math.abs(xm - xc) / (Pd / 2);
    const dy = Math.abs(wm - W / 2) / Math.max(0.6, W / 2 - 1.1);
    const d = dx + dy;
    if (d < 0.3) return GOLD;
    if (d < 0.72) return VERMIL;
    if (d < 0.92) return IVORY;
    if (dx > 0.82 && dy < 0.22) return GOLD;
    return LAPIS;
  }

  const plates: Plate[] = [];
  for (const c of cells) {
    if (c.bridge) continue;
    const h = t.holes[c.index];
    const segs = c.segs;
    const N = segs.length;
    const pr = seeded(700 + c.index * 53);
    const mid = segs[N >> 1];
    const W0 = c.l1[N >> 1] - c.l0[N >> 1];
    const center = surf(segs, N / 2, (c.l0[N >> 1] + c.l1[N >> 1]) / 2);
    const dirF = fwd(mid);
    const pl: Plate = {
      hole: h,
      index: c.index,
      segs,
      l0: c.l0,
      l1: c.l1,
      shards: [],
      delay: [],
      rise: [],
      drift: [],
      spin: [],
      phase: [],
      echo: null as unknown as Body,
      lattice: null as unknown as Body,
      rims: null as unknown as Body,
      samples: [],
      seen: NaN,
    };
    // Teilungen längs: Mosaiksteine von Mittelpunkt zu Mittelpunkt (dazwischen ist die Fahrbahn eben)
    const xs = centerRows(0, N);
    const nT = Math.max(4, Math.round(W0 / (detail ? 0.5 : 0.7)));
    // Schollen: nA Stücke längs, je zwei Bänder quer (Grenze gegeneinander versetzt)
    const nA = N >= 20 ? (detail ? 5 : 4) : 3;
    const cutIdx = [0];
    for (let j = 1; j < nA; j++) {
      const want = (N * j) / nA + (pr() - 0.5) * 1.2;
      let best = 1;
      for (let i = 1; i < xs.length - 1; i++) if (Math.abs(xs[i] - want) < Math.abs(xs[best] - want)) best = i;
      cutIdx.push(Math.max(cutIdx[cutIdx.length - 1] + 1, best));
    }
    cutIdx.push(xs.length - 1);
    const latAt = (k: number, tile: number): number => c.l0[k] + ((c.l1[k] - c.l0[k]) * tile) / nT;
    for (let j = 0; j < nA; j++) {
      const i0 = cutIdx[j];
      const i1 = cutIdx[j + 1];
      if (i1 <= i0) continue;
      const cs = Math.max(2, Math.min(nT - 2, (nT >> 1) + Math.floor(pr() * 5) - 2));
      for (let band = 0; band < 2; band++) {
        const t0 = band === 0 ? 0 : cs;
        const t1 = band === 0 ? cs : nT;
        const b = begin();
        // --- Oberseite: Mosaiksteine, gleiche Farben in einer Reihe zusammengefasst ---
        const d0 = PL.mb.triangles;
        for (let r = i0; r < i1; r++) {
          const xa = xs[r];
          const xb = xs[r + 1];
          const k = Math.min(N - 1, Math.floor((xa + xb) / 2));
          const W = c.l1[k] - c.l0[k];
          let run = t0;
          let runCol = mosaic((xa + xb) / 2, ((t0 + 0.5) * W) / nT, N, W);
          for (let tile = t0 + 1; tile <= t1; tile++) {
            const col = tile < t1 ? mosaic((xa + xb) / 2, ((tile + 0.5) * W) / nT, N, W) : null;
            if (col && col === runCol) continue;
            const la = latAt(k, run);
            const lb = latAt(k, tile);
            face(PL.mb, surf(segs, xa, la), surf(segs, xb, la), surf(segs, xb, lb), surf(segs, xa, lb), UP, runCol);
            run = tile;
            if (col) runCol = col;
          }
        }
        const dt: number[] = [];
        for (let i = d0; i < PL.mb.triangles; i++) dt.push(i);
        deckInfo.push({ hole: c.index, layer: 'platten', tris: dt });
        // --- Seiten (je 1 m), Stirnseiten, Unterseite: sichtbar nur im Fall ---
        const dn = (p: V3): V3 => [p[0], p[1] - PLATE_D, p[2]];
        for (let r = i0; r < i1; r += 2) {
          const xa = xs[r];
          const xb = xs[Math.min(i1, r + 2)];
          const k = Math.min(N - 1, Math.floor((xa + xb) / 2));
          const rr = right(segs[k]);
          for (const [tile, out] of [
            [t0, neg(rr)],
            [t1, rr],
          ] as [number, V3][]) {
            const la = surf(segs, xa, latAt(k, tile));
            const lb = surf(segs, xb, latAt(k, tile));
            face(PL.mb, la, lb, dn(lb), dn(la), out, STONE_SIDE);
          }
          if (detail) face(PL.mb, dn(surf(segs, xa, latAt(k, t0))), dn(surf(segs, xb, latAt(k, t0))), dn(surf(segs, xb, latAt(k, t1))), dn(surf(segs, xa, latAt(k, t1))), DOWN, STONE_D);
        }
        for (const [x, out] of [
          [xs[i0], neg(fwd(segs[Math.min(N - 1, Math.floor(xs[i0]))]))],
          [xs[i1], fwd(segs[Math.min(N - 1, Math.floor(xs[i1] - 0.01))])],
        ] as [number, V3][]) {
          const k = Math.min(N - 1, Math.floor(x - (x >= N ? 0.01 : 0)));
          const a = surf(segs, x, latAt(k, t0));
          const z = surf(segs, x, latAt(k, t1));
          face(PL.mb, a, z, dn(z), dn(a), out, STONE_SIDE);
        }
        // --- Risse (additiv, leuchten nur vor dem Sprung): Grenzen zu den Nachbarschollen und ein Riss innen ---
        const lift = 0.03;
        for (let r = i0; r < i1; r += 2) {
          const xa = xs[r];
          const xb = xs[Math.min(i1, r + 2)];
          const k = Math.min(N - 1, Math.floor((xa + xb) / 2));
          if (band === 0) strip(AL.mb, surf(segs, xa, latAt(k, t1) - 0.07, lift), surf(segs, xb, latAt(k, t1) - 0.07, lift), 0.14, UP, CRACK);
          else strip(AL.mb, surf(segs, xa, latAt(k, t0) + 0.07, lift), surf(segs, xb, latAt(k, t0) + 0.07, lift), 0.14, UP, CRACK);
        }
        for (const [ri, dir] of [
          [i0, 1],
          [i1, -1],
        ] as [number, number][]) {
          if ((ri === 0 && dir === 1) || (ri === xs.length - 1 && dir === -1)) continue;
          const x = xs[ri] + dir * 0.07;
          const k = Math.min(N - 1, Math.floor(x));
          strip(AL.mb, surf(segs, x, latAt(k, t0), lift), surf(segs, x, latAt(k, t1), lift), 0.14, UP, CRACK);
        }
        if (detail) {
          let x = xs[i0] + 0.4 + pr() * Math.max(0.1, xs[i1] - xs[i0] - 0.8);
          let k = Math.min(N - 1, Math.floor(x));
          let lat = latAt(k, t0) + 0.4 + pr() * Math.max(0.1, latAt(k, t1) - latAt(k, t0) - 0.8);
          let p = surf(segs, x, lat, lift);
          let dir = pr() < 0.5 ? -1 : 1;
          for (let st = 0; st < 4; st++) {
            const nx = Math.max(xs[i0] + 0.2, Math.min(xs[i1] - 0.2, x + dir * (0.8 + pr() * 1.2)));
            const nk = Math.min(N - 1, Math.floor(nx));
            const nlat = Math.max(latAt(nk, t0) + 0.2, Math.min(latAt(nk, t1) - 0.2, lat + (pr() - 0.5) * 2.6));
            const q = surf(segs, nx, nlat, lift);
            if (len(sub(q, p)) > 0.2) strip(AL.mb, p, q, 0.16 - st * 0.025, UP, CRACK);
            x = nx;
            k = nk;
            lat = nlat;
            p = q;
            if (pr() < 0.3) dir = -dir;
          }
        }
        const xm = (xs[i0] + xs[i1]) / 2;
        const km = Math.min(N - 1, Math.floor(xm));
        const latm = (latAt(km, t0) + latAt(km, t1)) / 2;
        const sm = segs[km];
        const tilt = add(fwd(sm), right(sm), (pr() - 0.5) * 1.2);
        pl.shards.push(end(b, surf(segs, xm, latm, -PLATE_D / 2), tilt, center, dirF));
        b.tint = TURQ_GHOST;
        pl.delay.push(pr() * 0.12 + band * 0.04);
        pl.rise.push(pr() * 0.45);
        pl.drift.push((latm >= 0 ? 1 : -1) * (0.3 + pr() * 0.8));
        pl.spin.push((pr() < 0.5 ? -1 : 1) * (1.2 + pr() * 1.8));
        pl.phase.push(pr() * 6.28);
      }
    }

    // --- Bruchkante (nur Jetzt): verwitterte Innenwände, Moos, Wurzeln ---
    {
      const b = begin();
      const rows = centerRows(0, N).filter((_, i, a) => i % 2 === 0 || i === a.length - 1);
      for (let r = 0; r + 1 < rows.length; r++) {
        const xa = rows[r];
        const xb = rows[r + 1];
        const k = Math.min(N - 1, Math.floor((xa + xb) / 2));
        const rr = right(segs[k]);
        for (const [lat, inward] of [
          [c.l0[k], rr],
          [c.l1[k], neg(rr)],
        ] as [number, V3][]) {
          const a = surf(segs, xa, lat);
          const z = surf(segs, xb, lat);
          const m1 = (p: V3): V3 => [p[0], p[1] - 0.35, p[2]];
          const m2 = (p: V3): V3 => [p[0], p[1] - WALL_D, p[2]];
          face(PL.mb, a, z, m1(z), m1(a), inward, WEATHER);
          face(PL.mb, m1(a), m1(z), m2(z), m2(a), inward, WEATHER_D);
          // Moos an der Lippe
          if (pr() < (detail ? 0.45 : 0.2)) {
            const sgn = inward === rr ? 1 : -1;
            const o0 = surf(segs, xa, lat + sgn * 0.24, -0.26);
            const o1 = surf(segs, xb, lat + sgn * 0.24, -0.26);
            face(PL.mb, add(a, UP, -0.015), add(z, UP, -0.015), o1, o0, [inward[0] * 0.5, 1, inward[2] * 0.5], pr() < 0.5 ? MOSS : MOSS_D);
          }
        }
      }
      for (const [x, inward] of [
        [0, fwd(segs[0])],
        [N, neg(fwd(segs[N - 1]))],
      ] as [number, V3][]) {
        const k = x === 0 ? 0 : N - 1;
        const a = surf(segs, x, c.l0[k]);
        const z = surf(segs, x, c.l1[k]);
        face(PL.mb, a, z, add(z, UP, -0.35), add(a, UP, -0.35), inward, WEATHER);
        face(PL.mb, add(a, UP, -0.35), add(z, UP, -0.35), add(z, UP, -WALL_D), add(a, UP, -WALL_D), inward, WEATHER_D);
      }
      // Tief unten: Dunkel (etwas größer als das Loch, damit auch der Blick schräg hinein im Dunkel endet)
      for (let r = 0; r + 1 < rows.length; r++) {
        const xa = r === 0 ? rows[r] - 1.5 : rows[r];
        const xb = r + 2 === rows.length ? rows[r + 1] + 1.5 : rows[r + 1];
        const k = Math.min(N - 1, Math.floor((rows[r] + rows[r + 1]) / 2));
        const wl = t.wh[segs[k]] - 0.3;
        const a0 = Math.max(-wl, c.l0[k] - 1.5);
        const a1 = Math.min(wl, c.l1[k] + 1.5);
        face(PL.mb, surf(segs, xa, a0, -DARK_D), surf(segs, xb, a0, -DARK_D), surf(segs, xb, a1, -DARK_D), surf(segs, xa, a1, -DARK_D), UP, DEEP);
      }
      if (detail) {
        // Wurzeln hängen über die Bruchkante in die Tiefe
        for (let i = 0; i < 4; i++) {
          const x = 1.5 + pr() * (N - 3);
          const k = Math.min(N - 1, Math.floor(x));
          const outer = c.l0[k] > 0 ? c.l1[k] : c.l0[k];
          const sgn = outer > 0 ? -1 : 1;
          const p0 = surf(segs, x, outer + sgn * 0.12, 0.02);
          const p1 = surf(segs, x + (pr() - 0.5) * 0.8, outer + sgn * 0.16, -1.5);
          const p2 = surf(segs, x + (pr() - 0.5) * 1.4, outer + sgn * (0.5 + pr() * 0.6), -3.4);
          beam(PL.mb, p0, p1, 0.13, ROOT);
          beam(PL.mb, p1, p2, 0.1, ROOT);
        }
      }
      pl.rims = end(b, center);
    }

    // --- Zeitecho (additiv, nur Jetzt): Umriss an der Bruchkante, Rahmen, Schleier; Rauten getrennt ---
    {
      const b = begin();
      const lift = 0.035;
      const step = 2;
      for (let x = 0; x < N - 1e-6; x += step) {
        const x2 = Math.min(N, x + step);
        const k = Math.min(N - 1, Math.floor((x + x2) / 2));
        for (const [lat, sgn] of [
          [c.l0[k], 1],
          [c.l1[k], -1],
        ] as [number, number][]) {
          strip(AL.mb, surf(segs, x, lat + sgn * 0.09, lift), surf(segs, x2, lat + sgn * 0.09, lift), 0.18, UP, TURQ);
          if (detail) strip(AL.mb, surf(segs, x, lat + sgn * 0.55, lift), surf(segs, x2, lat + sgn * 0.55, lift), 0.08, UP, shade(TURQ, 0.6));
        }
      }
      for (const x of [0.09, N - 0.09]) {
        const k = x < 1 ? 0 : N - 1;
        strip(AL.mb, surf(segs, x, c.l0[k], lift), surf(segs, x, c.l1[k], lift), 0.18, UP, TURQ);
      }
      for (const x of [0.55, N - 0.55]) {
        const k = x < 1 ? 0 : N - 1;
        strip(AL.mb, surf(segs, x, c.l0[k] + 0.55, lift), surf(segs, x, c.l1[k] - 0.55, lift), 0.08, UP, shade(TURQ, 0.6));
      }
      // Schleier (nur mit detail): sehr schwach, damit man klar sieht, dass dort nichts ist
      const rows = centerRows(0, N).filter((_, i, a) => i % 2 === 0 || i === a.length - 1);
      for (let r = 0; detail && r + 1 < rows.length; r++) {
        const k = Math.min(N - 1, Math.floor((rows[r] + rows[r + 1]) / 2));
        face(AL.mb, surf(segs, rows[r], c.l0[k], 0.02), surf(segs, rows[r + 1], c.l0[k], 0.02), surf(segs, rows[r + 1], c.l1[k], 0.02), surf(segs, rows[r], c.l1[k], 0.02), UP, VEIL);
      }
      pl.echo = end(b, center);
      const bl = begin();
      const Pd = DIAMOND;
      const W = W0;
      const half = Math.max(0.6, W / 2 - 1.1) * 0.92;
      for (let n = -10; n <= 10; n++) {
        const xc = N / 2 + Pd * n;
        if (xc - Pd / 2 < 1.0 || xc + Pd / 2 > N - 1.0) continue;
        const k = Math.min(N - 1, Math.floor(xc));
        const lc = c.l0[k] + W / 2;
        const pts: V3[] = [surf(segs, xc - (Pd / 2) * 0.92, lc, 0.04), surf(segs, xc, lc + half, 0.04), surf(segs, xc + (Pd / 2) * 0.92, lc, 0.04), surf(segs, xc, lc - half, 0.04)];
        for (let i = 0; i < 4; i++) strip(AL.mb, pts[i], pts[(i + 1) % 4], 0.1, UP, TURQ);
      }
      pl.lattice = end(bl, center);
    }
    for (let k = 0; k < N; k += 3) pl.samples.push(...surf(segs, k + 0.5, c.l0[k] + pr() * (c.l1[k] - c.l0[k]), 0.15));
    plates.push(pl);
  }

  // ============================== Aquädukt ==============================

  const deco = new MeshBuilder();
  const pieces: Piece[] = [];
  /** Je Aquädukt (Abzweigung): seine Stücke, Abschnitte, Länge. */
  const bridges: { pieces: number[]; segs: number[]; L: number; center: V3; dir: V3 }[] = [];
  {
    const bcells = cells.filter((c) => c.bridge);
    const byBranch = new Map<number, Cells[]>();
    for (const c of bcells) {
      const bi = t.branchOf[c.segs[0]];
      (byBranch.get(bi) ?? byBranch.set(bi, []).get(bi)!).push(c);
    }
    for (const list of byBranch.values()) {
      list.sort((a, b) => a.segs[0] - b.segs[0]);
      const bsegs: number[] = [];
      const idx: number[] = [];
      let ok = true;
      for (const c of list) {
        if (bsegs.length > 0 && t.next[bsegs[bsegs.length - 1]] !== c.segs[0]) ok = false;
        bsegs.push(...c.segs);
      }
      if (!ok) continue;
      const L = bsegs.length;
      const pr = seeded(1900 + bsegs[0]);
      const center = surf(bsegs, L / 2, 0);
      const dirF = fwd(bsegs[L >> 1]);
      const whAt = (x: number): number => t.wh[bsegs[Math.max(0, Math.min(L - 1, Math.floor(x)))]];
      let X = 0;
      const pierXs: number[] = [];
      for (let pi = 0; pi < list.length; pi++) {
        const c = list[pi];
        const h = t.holes[c.index];
        const N = c.segs.length;
        const X0 = X;
        const X1 = X + N;
        const Xm = X0 + Math.round(N / 2);
        X = X1;
        const piece: Piece = { hole: h, index: c.index, segs: c.segs, X0, X1, bodies: [], delay: [], spin: [], drift: [], echo: null as unknown as Body, samples: [], seen: NaN };
        const halves: [number, number][] = [
          [X0, Xm],
          [Xm, X1],
        ];
        pierXs.push(X0, Xm);
        if (pi === list.length - 1) pierXs.push(X1);
        const pierPts: number[] = [];
        for (let hv = 0; hv < 2; hv++) {
          const [Xa, Xb] = halves[hv];
          const b = begin();
          // --- Fahrrinne: Steinplatten, goldgefasste Wasserrinne in der Mitte ---
          const rows = centerRows(Xa, Xb);
          const d0 = SL.mb.triangles;
          for (let r = 0; r + 1 < rows.length; r++) {
            const xa = rows[r];
            const xb = rows[r + 1];
            const k = Math.min(L - 1, Math.floor((xa + xb) / 2));
            const s = bsegs[k];
            const lo = -t.wh[s];
            const hi = t.wh[s];
            const tone = Math.floor((xa + xb) / 2) % 2 === 0;
            const runs: [number, number, RGB][] = [
              [lo, -0.95, tone ? STONE : STONE_B],
              [-0.95, 0.95, tone ? WATER : WATER_HI],
              [0.95, hi, tone ? STONE : STONE_B],
            ];
            for (const [la, lb, col] of runs) face(SL.mb, surf(bsegs, xa, la), surf(bsegs, xb, la), surf(bsegs, xb, lb), surf(bsegs, xa, lb), UP, col);
          }
          const dt: number[] = [];
          for (let i = d0; i < SL.mb.triangles; i++) dt.push(i);
          deckInfo.push({ hole: c.index, layer: 'stein', tris: dt });
          // --- Kante, Stirnfries, Seiten, Unterseite ---
          const big = centerRows(Xa, Xb).filter((_, i, a) => i % 3 === 0 || i === a.length - 1);
          for (let r = 0; r + 1 < big.length; r++) {
            const xa = big[r];
            const xb = big[r + 1];
            const k = Math.min(L - 1, Math.floor((xa + xb) / 2));
            const wh = t.wh[bsegs[k]];
            const rr = right(bsegs[k]);
            for (const sg of [-1, 1]) {
              const o: V3 = sg > 0 ? rr : neg(rr);
              const L0 = sg * wh;
              const L1 = sg * (wh + CURB_W);
              // handbreite Kante
              face(SL.mb, surf(bsegs, xa, L0, CURB_H), surf(bsegs, xb, L0, CURB_H), surf(bsegs, xb, L1, CURB_H), surf(bsegs, xa, L1, CURB_H), UP, GOLD);
              face(SL.mb, surf(bsegs, xa, L0, 0), surf(bsegs, xb, L0, 0), surf(bsegs, xb, L0, CURB_H), surf(bsegs, xa, L0, CURB_H), neg(o), CORNICE);
              // Fries (Lapis und Gold im Wechsel), darunter Stein
              const fr = Math.floor(xa) % 2 === 0 ? LAPIS : GOLD;
              face(SL.mb, surf(bsegs, xa, L1, CURB_H), surf(bsegs, xb, L1, CURB_H), surf(bsegs, xb, L1, -0.42), surf(bsegs, xa, L1, -0.42), o, detail ? fr : LAPIS);
              face(SL.mb, surf(bsegs, xa, L1, -0.42), surf(bsegs, xb, L1, -0.42), surf(bsegs, xb, L1, AQ_D), surf(bsegs, xa, L1, AQ_D), o, PIER);
            }
            face(SL.mb, surf(bsegs, xa, -wh - CURB_W, AQ_D), surf(bsegs, xb, -wh - CURB_W, AQ_D), surf(bsegs, xb, wh + CURB_W, AQ_D), surf(bsegs, xa, wh + CURB_W, AQ_D), DOWN, PIER_D);
          }
          // Bruchflächen an den Enden (sichtbar, wenn der Nachbar fehlt oder im Fall)
          for (const [x, out] of [
            [Xa, neg(fwd(bsegs[Math.min(L - 1, Math.floor(Xa))]))],
            [Xb, fwd(bsegs[Math.min(L - 1, Math.floor(Xb - 0.01))])],
          ] as [number, V3][]) {
            const wh = whAt(x - 0.01);
            face(SL.mb, surf(bsegs, x, -wh - CURB_W, CURB_H), surf(bsegs, x, wh + CURB_W, CURB_H), surf(bsegs, x, wh + CURB_W, AQ_D), surf(bsegs, x, -wh - CURB_W, AQ_D), out, STONE_D);
          }
          // --- Pfeiler (oberer Teil) am Anfang der Hälfte, beim letzten Stück auch am Ende ---
          const piersHere = [Xa];
          if (hv === 1 && pi === list.length - 1) piersHere.push(Xb);
          for (const xp of piersHere) {
            const wh = whAt(xp) + 0.32;
            const x0 = xp - 0.8;
            const x1 = xp + 0.8;
            const s = bsegs[Math.max(0, Math.min(L - 1, Math.floor(xp)))];
            const rr = right(s);
            const ff = fwd(s);
            const q = (x: number, lat: number, y: number): V3 => surf(bsegs, x, lat, y);
            face(SL.mb, q(x0, wh, AQ_PIER), q(x1, wh, AQ_PIER), q(x1, wh, AQ_D), q(x0, wh, AQ_D), rr, PIER);
            face(SL.mb, q(x0, -wh, AQ_PIER), q(x1, -wh, AQ_PIER), q(x1, -wh, AQ_D), q(x0, -wh, AQ_D), neg(rr), PIER);
            face(SL.mb, q(x0, -wh, AQ_PIER), q(x0, wh, AQ_PIER), q(x0, wh, AQ_D), q(x0, -wh, AQ_D), neg(ff), PIER_D);
            face(SL.mb, q(x1, -wh, AQ_PIER), q(x1, wh, AQ_PIER), q(x1, wh, AQ_D), q(x1, -wh, AQ_D), ff, PIER_D);
            // Kapitell: goldenes Band
            const cw = wh + 0.12;
            const c0 = xp - 0.95;
            const c1 = xp + 0.95;
            face(SL.mb, q(c0, cw, -2.4), q(c1, cw, -2.4), q(c1, cw, -1.9), q(c0, cw, -1.9), rr, GOLD);
            face(SL.mb, q(c0, -cw, -2.4), q(c1, -cw, -2.4), q(c1, -cw, -1.9), q(c0, -cw, -1.9), neg(rr), GOLD);
            if (detail) {
              face(SL.mb, q(c0, -cw, -2.4), q(c0, cw, -2.4), q(c0, cw, -1.9), q(c0, -cw, -1.9), neg(ff), GOLD_D);
              face(SL.mb, q(c1, -cw, -2.4), q(c1, cw, -2.4), q(c1, cw, -1.9), q(c1, -cw, -1.9), ff, GOLD_D);
            }
            pierPts.push(xp);
          }
          // --- Rundbogen zwischen den Pfeilern ---
          {
            const xa = Xa + 0.8;
            const xb = Xb - 0.8;
            const R = (xb - xa) / 2;
            const xc = (xa + xb) / 2;
            const spring = AQ_D - 0.75 - R;
            const nSeg = detail ? 8 : 5;
            const wh = whAt(xc) + CURB_W;
            const arc: [number, number][] = [];
            for (let i = 0; i <= nSeg; i++) {
              const th = (Math.PI * i) / nSeg;
              arc.push([xc - R * Math.cos(th), spring + R * Math.sin(th)]);
            }
            const s = bsegs[Math.min(L - 1, Math.floor(xc))];
            const rr = right(s);
            for (const sg of [-1, 1]) {
              const o: V3 = sg > 0 ? rr : neg(rr);
              for (let i = 0; i < nSeg; i++) {
                const [x0, y0] = arc[i];
                const [x1, y1] = arc[i + 1];
                face(SL.mb, surf(bsegs, x0, sg * wh, AQ_D), surf(bsegs, x1, sg * wh, AQ_D), surf(bsegs, x1, sg * wh, y1), surf(bsegs, x0, sg * wh, y0), o, i === nSeg >> 1 ? GOLD : PIER);
              }
            }
            const cen = surf(bsegs, xc, 0, spring);
            for (let i = 0; i < nSeg; i++) {
              const [x0, y0] = arc[i];
              const [x1, y1] = arc[i + 1];
              const a = surf(bsegs, x0, -wh, y0);
              const bb = surf(bsegs, x1, -wh, y1);
              const cc = surf(bsegs, x1, wh, y1);
              const d = surf(bsegs, x0, wh, y0);
              face(SL.mb, a, bb, cc, d, sub(cen, lerp3(a, cc, 0.5)), PIER_D);
            }
            // Risse (additiv: vor dem Einsturz) auf beiden Seiten und quer über die Rinne
            for (const sg of detail ? [-1, 1] : []) {
              const rr2 = right(s);
              const o: V3 = sg > 0 ? rr2 : neg(rr2);
              let x = xa + pr() * (xb - xa);
              let y = AQ_D - 0.2;
              for (let st = 0; st < 3; st++) {
                const nx = Math.max(Xa, Math.min(Xb, x + (pr() - 0.5) * 2.6));
                const ny = y - 0.8 - pr() * 1.2;
                strip(AL.mb, surf(bsegs, x, sg * (wh + 0.03), y), surf(bsegs, nx, sg * (wh + 0.03), ny), 0.14, o, CRACK);
                x = nx;
                y = ny;
              }
            }
            {
              const x = Xa + 1 + pr() * (Xb - Xa - 2);
              strip(AL.mb, surf(bsegs, x, -whAt(x), 0.04), surf(bsegs, x + (pr() - 0.5) * 1.5, -0.2, 0.04), 0.14, UP, CRACK);
              strip(AL.mb, surf(bsegs, x + 0.4, 0.3, 0.04), surf(bsegs, x + (pr() - 0.5) * 1.5, whAt(x), 0.04), 0.14, UP, CRACK);
            }
          }
          const sMid = bsegs[Math.min(L - 1, Math.floor((Xa + Xb) / 2))];
          const axis = add(right(sMid), fwd(sMid), (pr() - 0.5) * 0.7);
          piece.bodies.push(end(b, surf(bsegs, (Xa + Xb) / 2, 0, AQ_D - 2), axis, center, dirF));
          b.tint = TURQ_GHOST;
          piece.delay.push(hv * 0.14 + pr() * 0.05);
          piece.spin.push((pr() < 0.5 ? -1 : 1) * (0.5 + pr() * 0.6));
          piece.drift.push((pr() - 0.5) * 1.6);
        }
        // --- Zeitecho des Stücks: Kanten der Rinne, Bögen, Pfeilerkanten ---
        {
          const b = begin();
          for (let x = X0; x < X1 - 1e-6; x += 2) {
            const x2 = Math.min(X1, x + 2);
            const wh = whAt((x + x2) / 2);
            for (const sg of [-1, 1]) {
              strip(AL.mb, surf(bsegs, x, sg * (wh - 0.09), 0.04), surf(bsegs, x2, sg * (wh - 0.09), 0.04), 0.18, UP, TURQ);
              const rr = right(bsegs[Math.min(L - 1, Math.floor(x))]);
              strip(AL.mb, surf(bsegs, x, sg * (wh + CURB_W), AQ_D), surf(bsegs, x2, sg * (wh + CURB_W), AQ_D), 0.14, sg > 0 ? rr : neg(rr), shade(TURQ, 0.75));
            }
          }
          for (const [Xa, Xb] of halves) {
            const xa = Xa + 0.8;
            const xb = Xb - 0.8;
            const R = (xb - xa) / 2;
            const xc = (xa + xb) / 2;
            const spring = AQ_D - 0.75 - R;
            const wh = whAt(xc) + CURB_W;
            const n = detail ? 8 : 5;
            const rr = right(bsegs[Math.min(L - 1, Math.floor(xc))]);
            for (const sg of [-1, 1]) {
              const o: V3 = sg > 0 ? rr : neg(rr);
              let prev = surf(bsegs, xa, sg * wh, spring);
              for (let i = 1; i <= n; i++) {
                const th = (Math.PI * i) / n;
                const p = surf(bsegs, xc - R * Math.cos(th), sg * wh, spring + R * Math.sin(th));
                strip(AL.mb, prev, p, 0.16, o, TURQ);
                prev = p;
              }
              for (const x of [xa, xb]) strip(AL.mb, surf(bsegs, x, sg * wh, spring), surf(bsegs, x, sg * wh, AQ_PIER + 0.5), 0.12, o, shade(TURQ, 0.6));
            }
          }
          piece.echo = end(b, center);
        }
        // Stellen für Staub: an den Seiten unterhalb der Kante (nicht auf der Fahrbahn)
        for (let x = X0 + 2; x < X1; x += 5) piece.samples.push(...surf(bsegs, x, (pr() < 0.5 ? -1 : 1) * (whAt(x) + 0.5), -0.9));
        idx.push(pieces.length);
        pieces.push(piece);
      }
      // --- Pfeilerstümpfe (feststehend): vom Gelände bis unter den oberen Pfeiler, oben bemoost ---
      for (const xp of pierXs) {
        const wh = whAt(xp) + 0.32;
        const s = bsegs[Math.max(0, Math.min(L - 1, Math.floor(xp)))];
        const rr = right(s);
        const ff = fwd(s);
        const q = (x: number, lat: number, y: number): V3 => surf(bsegs, x, lat, y);
        const x0 = xp - 0.8;
        const x1 = xp + 0.8;
        face(deco, q(x0, wh, AQ_STUMP), q(x1, wh, AQ_STUMP), q(x1, wh, AQ_PIER), q(x0, wh, AQ_PIER), rr, PIER);
        face(deco, q(x0, -wh, AQ_STUMP), q(x1, -wh, AQ_STUMP), q(x1, -wh, AQ_PIER), q(x0, -wh, AQ_PIER), neg(rr), PIER);
        face(deco, q(x0, -wh, AQ_STUMP), q(x0, wh, AQ_STUMP), q(x0, wh, AQ_PIER), q(x0, -wh, AQ_PIER), neg(ff), PIER_D);
        face(deco, q(x1, -wh, AQ_STUMP), q(x1, wh, AQ_STUMP), q(x1, wh, AQ_PIER), q(x1, -wh, AQ_PIER), ff, PIER_D);
        // Bruchfläche oben: Moos (liegt Einst im oberen Pfeiler verborgen)
        face(deco, q(x0 + 0.02, -wh + 0.02, AQ_PIER - 0.02), q(x1 - 0.02, -wh + 0.02, AQ_PIER - 0.02), q(x1 - 0.02, wh - 0.02, AQ_PIER - 0.02), q(x0 + 0.02, wh - 0.02, AQ_PIER - 0.02), UP, MOSS);
        boxT(deco, segFrame(s, q(xp, -wh * 0.4, AQ_PIER)), -1.2, 0.4, -0.05, 0.55, -0.6, 0.5, PIER_D, { top: MOSS_D, noBottom: true });
        // Ranken an den Seiten
        for (const sg of [-1, 1]) {
          const o: V3 = sg > 0 ? rr : neg(rr);
          const xr = xp + (pr() - 0.5) * 0.8;
          face(deco, q(xr - 0.25, sg * (wh + 0.02), AQ_PIER - 0.1), q(xr + 0.25, sg * (wh + 0.02), AQ_PIER - 0.1), q(xr + 0.12, sg * (wh + 0.02), AQ_PIER - 4.5 - pr() * 3), q(xr - 0.1, sg * (wh + 0.02), AQ_PIER - 4 - pr() * 3), o, MOSS_D);
        }
      }
      bridges.push({ pieces: idx, segs: bsegs, L, center, dir: dirF });
    }
  }

  // ============================== Tore ==============================

  interface GateView {
    gateIndex: number;
    /** true: Schatzkammer (zu in Einst: Mauer), false: Aquädukt (zu in Jetzt: Trümmer). */
    wall: boolean;
    mesh: THREE.Mesh;
    /** Körper, die nur bei offenem Tor stehen (Trümmerhaufen bzw. Torbogen). */
    open: Body[];
    /** Brocken, die um das Umschalten herum neben der Bahn fallen. */
    chunks: Body[];
    echo: Body | null;
    dust: number[];
    seen: number;
    lamps: SignLamps[];
  }
  const gates: GateView[] = [];
  const lampMb = new MeshBuilder();

  /** Hauptstrecke: Abschnitt, der dem Punkt (x, z) am nächsten liegt (Suche ab from). */
  function nearestMain(x: number, z: number, from: number, reach: number): number {
    let best = from;
    let bd = Infinity;
    let s = from;
    for (let i = 0; i < reach; i++) {
      const d = (t.px[s] - x) ** 2 + (t.pz[s] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
      s = t.next[s];
    }
    return best;
  }

  /** Regelmäßiges Vieleck (n Ecken, Radius r) um c in der Ebene (U, V), sichtbar von W, ins Lampennetz. */
  function lampPoly(c: V3, U: V3, V: V3, W: V3, r: number, n: number, rot = 0): [number, number] {
    const v0 = lampMb.triangles * 3;
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2;
      const a1 = rot + ((i + 1) / n) * Math.PI * 2;
      const p0 = add(add(c, U, Math.cos(a0) * r), V, Math.sin(a0) * r);
      const p1 = add(add(c, U, Math.cos(a1) * r), V, Math.sin(a1) * r);
      const nn = cross(sub(p0, c), sub(p1, c));
      if (nn[0] * W[0] + nn[1] * W[1] + nn[2] * W[2] >= 0) lampMb.tri(c, p0, p1, [1, 1, 1]);
      else lampMb.tri(c, p1, p0, [1, 1, 1]);
    }
    return [v0, lampMb.triangles * 3 - v0];
  }
  /** Ringstück (Radien r0 … r1, Winkel a0 … a1, im Uhrzeigersinn von oben) ins Lampennetz. */
  function lampArc(c: V3, U: V3, V: V3, W: V3, r0: number, r1: number, a0: number, a1: number, n: number, col: RGB = [1, 1, 1]): [number, number] {
    const v0 = lampMb.triangles * 3;
    const at = (a: number, r: number): V3 => add(add(c, U, Math.sin(a) * r), V, Math.cos(a) * r);
    for (let i = 0; i < n; i++) {
      const b0 = a0 + ((a1 - a0) * i) / n;
      const b1 = a0 + ((a1 - a0) * (i + 1)) / n;
      face(lampMb, at(b0, r0), at(b1, r0), at(b1, r1), at(b0, r1), W, col);
    }
    return [v0, lampMb.triangles * 3 - v0];
  }

  /**
   * Wegweiser: Stele mit Tafel, großem Pfeil zur Abzweigung, Lichtzeichen und Sanduhr-Ring.
   * origin = Fuß (Fahrbahnhöhe), W = Blickrichtung der Tafel (zu den Fahrern), side = Seite der Abzweigung.
   */
  function signpost(origin: V3, W: V3, side: number): SignLamps {
    const U = norm(cross(UP, W));
    const T: Xform = (x, y, z) => [origin[0] + U[0] * x + W[0] * z, origin[1] + y, origin[2] + U[2] * x + W[2] * z];
    boxT(deco, T, -1.75, 1.75, -7, 0.5, -0.75, 0.75, STELE_D, { noBottom: true });
    boxT(deco, T, -1.55, 1.55, 0.5, 8.0, -0.45, 0.3, STELE, { noBottom: true });
    boxT(deco, T, -1.8, 1.8, 8.0, 8.5, -0.6, 0.45, GOLD, { noBottom: true });
    if (detail) boxT(deco, T, -0.9, 0.9, 8.5, 9.1, -0.35, 0.2, GOLD_D, { noBottom: true });
    boxT(deco, T, -1.4, 1.4, 0.9, 7.75, 0.3, 0.38, BOARD, { noBottom: true });
    const Wv: V3 = W;
    // Pfeil schräg nach oben zur Seite der Abzweigung
    const ang = (side > 0 ? 1 : -1) * 0.62;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const q = (a: number, b: number): V3 => T(sa * a + ca * b, 2.75 + ca * a - sa * b, 0.42);
    const a0 = lampMb.triangles * 3;
    face(lampMb, q(-1.05, -0.3), q(0.25, -0.3), q(0.25, 0.3), q(-1.05, 0.3), Wv, [1, 1, 1]);
    const h0 = q(0.25, -0.72);
    const h1 = q(1.2, 0);
    const h2 = q(0.25, 0.72);
    const n = cross(sub(h1, h0), sub(h2, h0));
    if (n[0] * W[0] + n[2] * W[2] >= 0) lampMb.tri(h0, h1, h2, [1, 1, 1]);
    else lampMb.tri(h0, h2, h1, [1, 1, 1]);
    const arrow: [number, number] = [a0, lampMb.triangles * 3 - a0];
    // Kreuz über dem Pfeil (nur, solange zu)
    const c0 = lampMb.triangles * 3;
    for (const sgn of [-1, 1]) {
      const d = norm([1.2, sgn * 1.2, 0]);
      const pr2: V3 = [-d[1], d[0], 0];
      const w = 0.24;
      const corner = (k: number, s2: number): V3 => T(d[0] * 1.15 * k + pr2[0] * w * s2, 2.75 + d[1] * 1.15 * k + pr2[1] * w * s2, 0.46);
      face(lampMb, corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), Wv, [1, 1, 1]);
    }
    const crossR: [number, number] = [c0, lampMb.triangles * 3 - c0];
    // Lichtzeichen und Sanduhr-Ring
    const C = T(0, 5.85, 0.42);
    const disc = lampPoly(C, U, UP, Wv, 0.78, detail ? 10 : 8);
    const ring: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const g = 0.13;
      ring.push(lampArc(C, U, UP, Wv, 0.98, 1.32, (i / 6) * Math.PI * 2 + g, ((i + 1) / 6) * Math.PI * 2 - g, 2));
    }
    return { arrow, disc, cross: crossR, ring };
  }

  for (let gi = 0; gi < t.gates.length; gi++) {
    const g = t.gates[gi];
    const bi = t.branchOf[g.first];
    if (bi < 0) continue;
    const br = t.branches[bi];
    const side = br.side;
    const freeBit = side > 0 ? EDGE_FREE_R : EDGE_FREE_L;
    // Hauptstrecke, so weit beide Fahrbahnen ineinander liegen: dort fehlt sonst die Bande
    let first = -1;
    let last = -1;
    for (let m = t.prev[t.prev[br.from]], i = 0; i < 140; i++, m = t.next[m]) {
      if (t.edge[m] & freeBit) {
        if (first < 0) first = m;
        last = m;
      } else if (first >= 0 && i > 8) break;
    }
    for (let k = g.first; k < g.first + g.count; k++) {
      const m = t.twin[k];
      if (m < 0) continue;
      if (first < 0 || t.prog[m] < t.prog[first]) first = m;
      if (last < 0 || t.prog[m] > t.prog[last]) last = m;
    }
    if (first < 0) continue;
    const line: number[] = [];
    for (let m = t.prev[first], i = 0; i < 300; i++, m = t.next[m]) {
      line.push(m);
      if (m === t.next[last]) break;
    }
    const wall = planActive(g.plan, 0);
    const mb = new MeshBuilder();
    const gr = seeded(500 + gi * 71);
    const dust: number[] = [];
    // Linie der Bande: von der Mitte vor dem ersten bis zur Mitte hinter dem letzten Stück
    const LP = (i: number, lat: number, y: number): V3 => {
      // i: 0 … line.length (halbe Abschnitte an den Enden)
      if (i <= 0) return P(t.prev[line[0]], 0.5, lat, y);
      if (i >= line.length) return P(line[line.length - 1], 0.5, lat, y);
      return P(line[i - 1], 0, lat, y);
    };
    const n = line.length;
    const wAt = (i: number): number => t.wh[line[Math.max(0, Math.min(n - 1, i - 1))]];
    const opens: Body[] = [];
    const chunks: Body[] = [];
    let echo: Body | null = null;

    if (wall) {
      // --- Schatzkammer: heile Tempelmauer mit versiegeltem, goldbeschlagenem Tor ---
      const H = 4.4;
      const step = 2;
      for (let i = 0; i < n + 1; i += step) {
        const j = Math.min(n + 1, i + step);
        const s = line[Math.max(0, Math.min(n - 1, i))];
        const rr = right(s);
        const inward: V3 = side > 0 ? neg(rr) : rr;
        const li = (k: number): number => side * (wAt(k) - 0.02);
        const lo = (k: number): number => side * (wAt(k) + 1.1);
        const band = (y0: number, y1: number, col: RGB): void => face(mb, LP(i, li(i), y0), LP(j, li(j), y0), LP(j, li(j), y1), LP(i, li(i), y1), inward, col);
        const tone = (i / step) % 2 === 0;
        band(-1.2, 0.5, WALL_B);
        band(0.5, 3.0, tone ? WALL_A : WALL_B);
        band(3.0, 3.5, detail ? ((i / step) % 2 === 0 ? LAPIS : GOLD) : LAPIS);
        band(3.5, H, CORNICE);
        face(mb, LP(i, lo(i), -1.2), LP(j, lo(j), -1.2), LP(j, lo(j), H), LP(i, lo(i), H), neg(inward), tone ? WALL_B : WALL_A);
        face(mb, LP(i, li(i), H), LP(j, li(j), H), LP(j, lo(j), H), LP(i, lo(i), H), UP, CORNICE);
        // Zinnen alle 4 m
        if ((i / step) % 2 === 0 && j - i >= 1) {
          const mid = Math.min(n, i + 1);
          const s2 = line[Math.max(0, Math.min(n - 1, mid - 1))];
          const base = LP(mid, side * (wAt(mid) + 0.55), H);
          boxT(mb, segFrame(s2, base), -0.5, 0.5, 0, 0.85, -0.6, 0.6, i % 4 === 0 ? CORNICE : WALL_A, { noBottom: true, top: GOLD });
        }
      }
      // Stirnseiten der Mauer
      for (const i of [0, n + 1]) {
        const s = line[Math.max(0, Math.min(n - 1, i - 1))];
        face(mb, LP(i, side * (wAt(i) - 0.02), -1.2), LP(i, side * (wAt(i) + 1.1), -1.2), LP(i, side * (wAt(i) + 1.1), H), LP(i, side * (wAt(i) - 0.02), H), i === 0 ? neg(fwd(s)) : fwd(s), WALL_B);
      }
      // Tor in der Mitte: Bronze mit Goldbändern und -nägeln, Siegel aus Lapis und Gold
      {
        const im = (n + 1) >> 1;
        const s = line[Math.max(0, Math.min(n - 1, im - 1))];
        const rr = right(s);
        const inward: V3 = side > 0 ? neg(rr) : rr;
        const base = LP(im, side * (wAt(im) - 0.02), 0);
        const ff = fwd(s);
        // Rahmen: x längs, y hoch, z zur Fahrbahn
        const T: Xform = (x, y, z) => [base[0] + ff[0] * x + inward[0] * z, base[1] + y, base[2] + ff[2] * x + inward[2] * z];
        const F = (x0: number, x1: number, y0: number, y1: number, z: number, col: RGB): void => face(mb, T(x0, y0, z), T(x1, y0, z), T(x1, y1, z), T(x0, y1, z), inward, col);
        F(-3.5, 3.5, 0, 4.15, 0.02, GOLD_D);
        F(-3.0, 3.0, 0, 3.7, 0.04, BRONZE);
        for (const y of [0.55, 1.75, 2.95]) F(-3.0, 3.0, y, y + 0.2, 0.05, GOLD);
        F(-0.04, 0.04, 0, 3.7, 0.05, rgb(0x2a1a10));
        if (detail)
          for (const x of [-2.4, -1.5, 1.5, 2.4])
            for (const y of [1.15, 2.35, 3.35]) F(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0.055, GOLD_HI);
        // Siegel
        const C = T(0, 2.1, 0.06);
        const U2 = ff;
        const sealN = inward;
        const ring = (r: number, col: RGB, dz: number): void => {
          const c = add(C, sealN, dz);
          for (let k = 0; k < 8; k++) {
            const a0 = (k / 8) * Math.PI * 2;
            const a1 = ((k + 1) / 8) * Math.PI * 2;
            const p0 = add(add(c, U2, Math.cos(a0) * r), UP, Math.sin(a0) * r);
            const p1 = add(add(c, U2, Math.cos(a1) * r), UP, Math.sin(a1) * r);
            const nn = cross(sub(p0, c), sub(p1, c));
            if (nn[0] * sealN[0] + nn[2] * sealN[2] >= 0) mb.tri(c, p0, p1, col);
            else mb.tri(c, p1, p0, col);
          }
        };
        ring(0.95, GOLD, 0);
        ring(0.7, LAPIS, 0.005);
        ring(0.28, GOLD_HI, 0.01);
        for (let k = 0; k < 6; k++) dust.push(...LP(Math.round((k / 5) * n), side * (wAt(1) + 0.5), 2.5));
      }
      // --- Jetzt: Trümmerhaufen an beiden Enden neben der Bahn ---
      const piles = pileSpots(line, side, br.first, br.count);
      for (const spot of piles) {
        const b = begin();
        const s = spot.seg;
        for (let k = 0; k < (detail ? 7 : 5); k++) {
          const T = segFrame(s, add(add(spot.p, right(s), (gr() - 0.5) * 2.4 * spot.across), fwd(s), (gr() - 0.5) * 5));
          const w = 0.6 + gr() * 0.7;
          const hgt = 0.4 + gr() * 0.9;
          boxT(SL.mb, T, -w, w, -0.6, hgt, -w * 0.8, w * 0.8, gr() < 0.5 ? WALL_A : WALL_B, { noBottom: true, top: gr() < 0.3 ? MOSS : CORNICE });
        }
        // ein Stück des Frieses, schräg liegend
        const T2 = segFrame(s, add(spot.p, UP, 0.3));
        boxT(SL.mb, T2, -0.3, 0.3, 0, 0.5, -1.4, 1.4, LAPIS, { noBottom: true, top: GOLD });
        opens.push(end(b, spot.p));
      }
      // Zeitecho der Mauer (Jetzt): Umriss in der Linie der Bande
      {
        const b = begin();
        const lat = (k: number): number => side * (wAt(k) + 0.5);
        const s0 = line[0];
        const nrm = right(s0);
        for (let i = 0; i < n + 1; i += 4) {
          const j = Math.min(n + 1, i + 4);
          strip(AL.mb, LP(i, lat(i), H), LP(j, lat(j), H), 0.18, nrm, TURQ);
          strip(AL.mb, LP(i, lat(i), 3.0), LP(j, lat(j), 3.0), 0.08, nrm, shade(TURQ, 0.55));
          strip(AL.mb, LP(i, lat(i), 0.15), LP(j, lat(j), 0.15), 0.14, nrm, shade(TURQ, 0.8));
        }
        for (let i = 0; i <= n + 1; i += 4) strip(AL.mb, LP(i, lat(i), 0.1), LP(i, lat(i), H), i === 0 || i >= n ? 0.18 : 0.06, nrm, shade(TURQ, i === 0 || i >= n ? 1 : 0.4));
        strip(AL.mb, LP(n + 1, lat(n + 1), 0.1), LP(n + 1, lat(n + 1), H), 0.18, nrm, TURQ);
        // Umriss des Tors
        const im = (n + 1) >> 1;
        for (const dx of [-3.3, 3.3]) strip(AL.mb, add(LP(im, lat(im), 0.1), fwd(line[im - 1]), dx), add(LP(im, lat(im), 3.9), fwd(line[im - 1]), dx), 0.14, nrm, TURQ);
        strip(AL.mb, add(LP(im, lat(im), 3.9), fwd(line[im - 1]), -3.3), add(LP(im, lat(im), 3.9), fwd(line[im - 1]), 3.3), 0.14, nrm, TURQ);
        echo = end(b, LP(im, lat(im), 2));
      }
    } else {
      // --- Aquädukt: herabgestürzte Bogenquader und Wurzelwerk versperren die Mündung ---
      for (let i = 0; i < n + 1; i += 2) {
        const j = Math.min(n + 1, i + 2);
        const s = line[Math.max(0, Math.min(n - 1, i))];
        const rr = right(s);
        const inward: V3 = side > 0 ? neg(rr) : rr;
        const h0 = 1.15 + gr() * 0.55;
        const li = (k: number): number => side * (wAt(k) - 0.02);
        const lo = (k: number): number => side * (wAt(k) + 1.5 + gr() * 0.3);
        const col = gr() < 0.5 ? RUBBLE : RUBBLE_B;
        face(mb, LP(i, li(i), -1), LP(j, li(j), -1), LP(j, li(j), h0), LP(i, li(i), h0), inward, col);
        face(mb, LP(i, lo(i), -1), LP(j, lo(j), -1), LP(j, lo(j), h0 - 0.2), LP(i, lo(i), h0 - 0.2), neg(inward), RUBBLE_B);
        face(mb, LP(i, li(i), h0), LP(j, li(j), h0), LP(j, lo(j), h0 - 0.2), LP(i, lo(i), h0 - 0.2), UP, gr() < 0.4 ? MOSS : col);
      }
      for (const i of [0, n + 1]) {
        const s = line[Math.max(0, Math.min(n - 1, i - 1))];
        face(mb, LP(i, side * (wAt(i) - 0.02), -1), LP(i, side * (wAt(i) + 1.6), -1), LP(i, side * (wAt(i) + 1.6), 1.2), LP(i, side * (wAt(i) - 0.02), 1.2), i === 0 ? neg(fwd(s)) : fwd(s), RUBBLE_B);
      }
      // Bogenquader (mit Resten des goldenen Bandes) und Brocken obenauf
      for (let i = 2; i < n - 1; i += detail ? 4 : 6) {
        const s = line[i];
        const base = P(s, 0, side * (wAt(i + 1) + 0.75 + gr() * 0.3), 1.3);
        const T = segFrame(s, base);
        const lean = (gr() - 0.5) * 0.9;
        const Tl: Xform = (x, y, z) => T(x + y * lean * 0.3, y, z + y * lean);
        const w0 = 0.55;
        boxT(mb, Tl, -w0, w0, 0, 1.0 + gr() * 0.7, -0.9, 0.9, gr() < 0.5 ? PIER : PIER_D, { noBottom: true, top: gr() < 0.5 ? MOSS : GOLD_D });
        if (i % 8 === 2) dust.push(...base);
      }
      const ico = new THREE.IcosahedronGeometry(1, 0);
      const mtx = new THREE.Matrix4();
      const qq = new THREE.Quaternion();
      const eu = new THREE.Euler();
      for (let i = 1; i < n; i += detail ? 3 : 5) {
        const s = line[i];
        const sz = 0.55 + gr() * 0.4;
        const p = P(s, 0, side * (wAt(i + 1) + 0.6 + gr() * 0.6), 1.2 + sz * 0.4);
        eu.set(gr() * 3, gr() * 3, gr() * 3);
        qq.setFromEuler(eu);
        mtx.compose(new THREE.Vector3(p[0], p[1], p[2]), qq, new THREE.Vector3(sz, sz * 0.8, sz));
        mb.add(ico, gr() < 0.5 ? RUBBLE : RUBBLE_B, mtx);
      }
      ico.dispose();
      // Wurzelwerk: Bögen über die Trümmer, nie in die Fahrbahn hinein
      if (detail) {
        for (let i = 3; i < n - 2; i += 5) {
          const s = line[i];
          const w = wAt(i + 1);
          const a = P(s, 0, side * (w + 3.2), -0.4);
          const b2 = P(t.next[s], 0, side * (w + 1.0), 2.3);
          const c2 = P(t.next[t.next[s]], 0, side * (w + 0.1), 1.0);
          beam(mb, a, b2, 0.22, ROOT);
          beam(mb, b2, c2, 0.17, ROOT);
        }
      }
      // --- Einst: offener Torbogen über dem Aquädukt (Pfeiler neben der Fahrbahn, Bogen über 10 m) ---
      {
        let k = br.first + Math.max(0, g.count - 3);
        const bridgeStart = bridges.find((bb) => t.branchOf[bb.segs[0]] === bi)?.segs[0] ?? k;
        for (let kk = Math.max(br.first, bridgeStart - 4); kk < bridgeStart + 18; kk++) {
          const w = t.wh[kk] + 1.5;
          const lp = P(kk, 0, -side * w);
          const m = nearestMain(lp[0], lp[2], br.from, 120);
          const d = Math.hypot(lp[0] - t.px[m], lp[2] - t.pz[m]);
          k = kk;
          if (d > t.wh[m] + 2.6) break;
        }
        const b = begin();
        const w = t.wh[k] + 1.5;
        const T = segFrame(k, P(k, 0, 0));
        for (const sg of [-1, 1]) {
          boxT(SL.mb, T, sg * w - 0.8, sg * w + 0.8, -13, 5.2, -0.8, 0.8, PIER, { noBottom: true });
          boxT(SL.mb, T, sg * w - 1.0, sg * w + 1.0, 4.6, 5.3, -1.0, 1.0, GOLD, { noBottom: true });
          boxT(SL.mb, T, sg * w - 1.0, sg * w + 1.0, -0.2, 0.5, -1.0, 1.0, LAPIS, { noBottom: true });
        }
        // Bogen: Ring aus Keilsteinen, Schlussstein golden
        const nSeg = detail ? 11 : 7;
        const R0 = w - 0.8;
        const R1 = w + 0.6;
        const yc = 5.3;
        const ff = fwd(k);
        for (let i = 0; i < nSeg; i++) {
          const a0 = Math.PI * (1 - i / nSeg);
          const a1 = Math.PI * (1 - (i + 1) / nSeg);
          const pt = (a: number, r: number, z: number): V3 => T(Math.cos(a) * r, yc + Math.sin(a) * r, z);
          const col = i === nSeg >> 1 ? GOLD : i % 2 === 0 ? PIER : STONE_B;
          for (const z of [-0.8, 0.8]) face(SL.mb, pt(a0, R0, z), pt(a1, R0, z), pt(a1, R1, z), pt(a0, R1, z), z < 0 ? neg(ff) : ff, col);
          face(SL.mb, pt(a0, R1, -0.8), pt(a1, R1, -0.8), pt(a1, R1, 0.8), pt(a0, R1, 0.8), sub(pt((a0 + a1) / 2, R1, 0), T(0, yc, 0)), PIER_D);
          face(SL.mb, pt(a0, R0, -0.8), pt(a1, R0, -0.8), pt(a1, R0, 0.8), pt(a0, R0, 0.8), sub(T(0, yc, 0), pt((a0 + a1) / 2, R0, 0)), LAPIS_D);
        }
        opens.push(end(b, T(0, 6, 0)));
      }
    }
    // --- Brocken, die um das Umschalten herum neben der Bahn fallen (täuschen niemanden) ---
    for (const spot of pileSpots(line, side, br.first, br.count)) {
      const b = begin();
      const s = spot.seg;
      for (let k = 0; k < 3; k++) {
        const T = segFrame(s, add(add(spot.p, right(s), (gr() - 0.5) * 2 * spot.across), fwd(s), (gr() - 0.5) * 4));
        const w = 0.45 + gr() * 0.4;
        boxT(SL.mb, T, -w, w, 0, w * 1.6, -w, w, wall ? WALL_A : RUBBLE, { top: wall ? CORNICE : MOSS });
      }
      chunks.push(end(b, add(spot.p, UP, 0.5), right(s)));
      dust.push(...add(spot.p, UP, 1));
    }

    const geo = mb.build();
    disposables.push(geo);
    const mat = toonMaterial({ vertexColors: true });
    disposables.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'sperre';
    mesh.userData.gate = gi;
    if (detail) withOutline(mesh, 0.05);
    tris += mb.triangles * (detail ? 2 : 1);
    group.add(mesh);

    // --- Wegweiser: etwa 35 m vor der Gabelung neben der Bande … ---
    let m0 = br.from;
    for (let i = 0; i < 35; i++) m0 = t.prev[m0];
    const lamps: SignLamps[] = [signpost(P(m0, 0, side * (t.wh[m0] + 2.4)), norm(add(neg(fwd(m0)), right(m0), -side * 0.28)), side)];
    // … und im Keil zwischen den Fahrbahnen
    for (let k = br.first; k < br.first + br.count; k++) {
      const wm = nearestMain(t.px[k], t.pz[k], br.from, 220);
      const me = P(wm, 0, side * (t.wh[wm] + 0.6));
      const be = P(k, 0, -side * (t.wh[k] + 0.6));
      const latB = (be[0] - t.px[wm]) * rightX(t, wm) * side + (be[2] - t.pz[wm]) * rightZ(t, wm) * side;
      if (latB > t.wh[wm] + 0.6 && Math.hypot(me[0] - be[0], me[2] - be[2]) >= 5.2) {
        const p = lerp3(me, be, 0.5);
        lamps.push(signpost([p[0], Math.min(p[1], t.py[wm]), p[2]], norm(add(neg(fwd(wm)), right(wm), -side * 0.22)), side));
        break;
      }
    }
    gates.push({ gateIndex: gi, wall, mesh, open: opens, chunks, echo, dust, seen: NaN, lamps });
  }

  /**
   * Plätze neben der Bahn an beiden Enden der Mündung: vor der Gabelung hinter der Bande und
   * dahinter im Keil zwischen den Fahrbahnen (sobald dort Platz ist).
   */
  function pileSpots(line: number[], side: number, bFirst: number, bCount: number): { seg: number; p: V3; across: number }[] {
    const out: { seg: number; p: V3; across: number }[] = [];
    let a = line[0];
    for (let i = 0; i < 6; i++) a = t.prev[a];
    out.push({ seg: a, p: P(a, 0, side * (t.wh[a] + 3.4)), across: 0.8 });
    const lastM = line[line.length - 1];
    for (let k = bFirst; k < bFirst + bCount; k++) {
      const wm = nearestMain(t.px[k], t.pz[k], lastM, 60);
      const me = P(wm, 0, side * (t.wh[wm] + 0.6));
      const be = P(k, 0, -side * (t.wh[k] + 0.6));
      const gap = Math.hypot(me[0] - be[0], me[2] - be[2]);
      const latB = (be[0] - t.px[wm]) * rightX(t, wm) * side + (be[2] - t.pz[wm]) * rightZ(t, wm) * side;
      if (latB > t.wh[wm] + 0.6 && gap >= 9) {
        const p = lerp3(me, be, 0.5);
        out.push({ seg: wm, p: [p[0], Math.min(p[1], t.py[wm]), p[2]], across: Math.min(1, (gap - 4) / 6) });
        break;
      }
    }
    return out;
  }

  // ============================== Zeituhr ==============================

  const L0 = t.landmark;
  // Seite: dort, wo neben der Halle keine Abzweigung liegt – innen (rechts) bevorzugt
  const cSide = 1;
  const cLat = cSide * (t.wh[L0] + 0.5 + 15);
  const cBase = P(L0, 0, cLat);
  const cGround = t.py[L0];
  const Nc = norm(add(neg(fwd(L0)), right(L0), -cSide * 0.55));
  const Uc = norm(cross(UP, Nc)); // vom Betrachter aus nach rechts (Blick gegen Nc)
  const Vc = UP;
  const ringR0 = 5.55;
  const ringR1 = 6.95;
  const ringC: V3 = add([cBase[0], cGround + 17, cBase[2]], Nc, 2.4);
  {
    // Sockel und Obelisk (verjüngt, mit Pyramidion), goldene Bänder, Lapis-Inschrift
    const T: Xform = (x, y, z) => [cBase[0] + Uc[0] * x + Nc[0] * z, cGround + y, cBase[2] + Uc[2] * x + Nc[2] * z];
    boxT(deco, T, -4.2, 4.2, -16, -0.2, -4.2, 4.2, STELE_D, { noBottom: true, top: STELE });
    boxT(deco, T, -3.4, 3.4, -0.2, 0.6, -3.4, 3.4, GOLD_D, { noBottom: true });
    const hw = (y: number): number => 2.1 - (y / 33) * 1.0;
    const yb = 0.6;
    const yt = 33;
    const corners = (y: number): V3[] => {
      const w = hw(y);
      return [T(-w, y, -w), T(w, y, -w), T(w, y, w), T(-w, y, w)];
    };
    const levels = [yb, 9.5, 10.2, 24, 24.7, yt];
    for (let l = 0; l + 1 < levels.length; l++) {
      const a = corners(levels[l]);
      const b = corners(levels[l + 1]);
      const col = l % 2 === 1 ? GOLD : STELE;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const mid = lerp3(a[i], a[j], 0.5);
        face(deco, a[i], a[j], b[j], b[i], [mid[0] - cBase[0], 0, mid[2] - cBase[2]], col);
      }
    }
    const top = T(0, yt + 3.2, 0);
    const a = corners(yt);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const mid = lerp3(a[i], a[j], 0.5);
      const n = cross(sub(a[j], a[i]), sub(top, a[i]));
      const out: V3 = [mid[0] - cBase[0], 0, mid[2] - cBase[2]];
      if (n[0] * out[0] + n[2] * out[2] >= 0) deco.tri(a[i], a[j], top, GOLD);
      else deco.tri(a[j], a[i], top, GOLD);
    }
    // Inschrift: Lapisstreifen auf der Vorderseite (unter dem Ring)
    if (detail)
      for (let k = 0; k < 4; k++) {
        const y0 = 1.6 + k * 1.9;
        const w = hw(y0) * 0.55;
        const z = hw(y0) + 0.03;
        face(deco, T(-w, y0, z), T(w, y0, z), T(w, y0 + 1.1, z), T(-w, y0 + 1.1, z), Nc, k % 2 === 0 ? LAPIS : VERMIL);
      }
    // Ring: steinerne Fassung (Ober- und Unterseite, Innen- und Außenmantel), Zifferblatt, Streben zum Obelisk
    const RS = detail ? 32 : 24;
    const at = (a2: number, r: number, z: number): V3 => add(add(add(ringC, Uc, Math.sin(a2) * r), Vc, Math.cos(a2) * r), Nc, z);
    const fr0 = ringR0 - 0.2;
    const fr1 = ringR1 + 0.3;
    for (let i = 0; i < RS; i++) {
      const a0 = (i / RS) * Math.PI * 2;
      const a1 = ((i + 1) / RS) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const radial: V3 = add(add([0, 0, 0], Uc, Math.sin(am)), Vc, Math.cos(am));
      face(deco, at(a0, fr1, -0.6), at(a1, fr1, -0.6), at(a1, fr1, 0.6), at(a0, fr1, 0.6), radial, GOLD_D);
      face(deco, at(a0, fr0, -0.6), at(a1, fr0, -0.6), at(a1, fr0, 0.6), at(a0, fr0, 0.6), neg(radial), STELE_D);
      face(deco, at(a0, fr0, 0.6), at(a1, fr0, 0.6), at(a1, fr1, 0.6), at(a0, fr1, 0.6), Nc, STELE);
      face(deco, at(a0, fr0, -0.6), at(a1, fr0, -0.6), at(a1, fr1, -0.6), at(a0, fr1, -0.6), neg(Nc), STELE);
      // Zifferblatt (dunkles Lapis), beidseitig
      for (const z of [0.3, -0.3]) {
        const c = add(ringC, Nc, z);
        const p0 = at(a0, fr0, z);
        const p1 = at(a1, fr0, z);
        const nn = cross(sub(p0, c), sub(p1, c));
        const o = z > 0 ? Nc : neg(Nc);
        if (nn[0] * o[0] + nn[1] * o[1] + nn[2] * o[2] >= 0) deco.tri(c, p0, p1, LAPIS_D);
        else deco.tri(c, p1, p0, LAPIS_D);
      }
    }
    // Streben vom Ring zum Obelisk
    for (const sx of [-1, 1]) beam(deco, at(sx * 0.9 * Math.PI * 0.5, fr1 - 0.3, -0.5), T(sx * 1.2, 17, 0), 0.5, GOLD_D, true);
    beam(deco, at(Math.PI, fr1 - 0.3, -0.5), T(0, 11, 0.5), 0.6, STELE_D, true);
  }
  // Leuchtende Teile der Uhr (Lampennetz): Ringhälften, Teilstriche, Zeiger, Nabe – vorn und hinten
  const clockHalves: [number, number][][] = [[], []];
  const clockTicks: [number, number][] = [];
  const pointer: { v0: number; pts: [number, number, number][]; range: [number, number] }[] = [];
  {
    const RS = detail ? 24 : 16;
    for (const zs of [1, -1]) {
      const W: V3 = zs > 0 ? Nc : neg(Nc);
      const C = add(ringC, Nc, zs * 0.64);
      clockHalves[0].push(lampArc(C, Uc, Vc, W, ringR0, ringR1, 0, Math.PI, RS));
      clockHalves[1].push(lampArc(C, Uc, Vc, W, ringR0, ringR1, Math.PI, Math.PI * 2, RS));
      const C2 = add(ringC, Nc, zs * 0.34);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        clockTicks.push(lampArc(C2, Uc, Vc, W, 4.5, i % 6 === 0 ? 5.35 : 5.15, a - 0.05, a + 0.05, 1));
      }
      // Zeiger: Spitze nach oben (Winkel 0), wird je Bild gedreht; dazu die Nabe
      const v0 = lampMb.triangles * 3;
      const pts: [number, number, number][] = [];
      const shape: [number, number][] = [
        [-0.32, -1.3],
        [0.32, -1.3],
        [0.24, 5.0],
        [-0.24, 5.0],
        [0, 6.3],
      ];
      const C3 = add(ringC, Nc, zs * 0.42);
      const Pt = (k: number): V3 => add(add(C3, Uc, shape[k][0]), Vc, shape[k][1]);
      const addTri = (i0: number, i1: number, i2: number): void => {
        const a = Pt(i0);
        const b = Pt(i1);
        const c = Pt(i2);
        const nn = cross(sub(b, a), sub(c, a));
        const ok = nn[0] * W[0] + nn[1] * W[1] + nn[2] * W[2] >= 0;
        const idx = ok ? [i0, i1, i2] : [i0, i2, i1];
        lampMb.tri(Pt(idx[0]), Pt(idx[1]), Pt(idx[2]), [1, 1, 1]);
        for (const k of idx) pts.push([shape[k][0], shape[k][1], zs * 0.42]);
      };
      addTri(0, 1, 2);
      addTri(0, 2, 3);
      addTri(3, 2, 4);
      pointer.push({ v0, pts, range: [v0, pts.length] });
      lampPoly(add(ringC, Nc, zs * 0.46), Uc, Vc, W, 0.75, 8);
    }
  }
  // Höhen für den Riss-Ring: je Richtung und Abstand die ungefähre Höhe von Fahrbahn bzw. Gelände
  const rissNA = detail ? 96 : 48;
  const rissDR = 8;
  let rissMax = 0;
  for (const br of t.branches) rissMax = Math.max(rissMax, Math.hypot(t.px[br.from] - ringC[0], t.pz[br.from] - ringC[2]), Math.hypot(t.px[br.to] - ringC[0], t.pz[br.to] - ringC[2]));
  rissMax += 40;
  const rissNR = Math.ceil(rissMax / rissDR) + 1;
  const rissH = new Float32Array(rissNA * rissNR);
  {
    const sx: number[] = [];
    const sz: number[] = [];
    const sy: number[] = [];
    const sw: number[] = [];
    for (let i = 0; i < t.total; i += 3) {
      sx.push(t.px[i]);
      sz.push(t.pz[i]);
      sy.push(t.py[i]);
      sw.push(t.wh[i]);
    }
    for (let ai = 0; ai < rissNA; ai++) {
      const a = (ai / rissNA) * Math.PI * 2;
      for (let ri = 0; ri < rissNR; ri++) {
        const x = ringC[0] + Math.cos(a) * ri * rissDR;
        const z = ringC[2] + Math.sin(a) * ri * rissDR;
        let best = Infinity;
        let by = cGround;
        let wsum = 0;
        let ysum = 0;
        for (let k = 0; k < sx.length; k++) {
          const d2 = (sx[k] - x) ** 2 + (sz[k] - z) ** 2;
          if (d2 < best) {
            best = d2;
            by = sy[k];
          }
          const w = 1 / (d2 + 60) ** 1.5;
          wsum += w;
          ysum += w * sy[k];
        }
        const d = Math.sqrt(best);
        const idw = wsum > 0 ? ysum / wsum - 0.6 : by;
        const k = smooth((d - 9) / 24);
        rissH[ai * rissNR + ri] = by + (idw - by) * k + 0.3;
      }
    }
  }
  // Riss-Ring im Leuchtnetz: je Richtung ein flaches Band und ein Vorhang (unten, oben)
  const rissV0 = AL.mb.triangles * 3;
  for (let i = 0; i < rissNA * 3; i++) AL.mb.quad(ringC, ringC, ringC, ringC, [0, 0, 0]);
  const rissV1 = AL.mb.triangles * 3;

  // ============================== Netze bauen ==============================

  function finish(L: Layer): THREE.BufferGeometry {
    const geo = L.mb.build();
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
    L.pos = pos.array as Float32Array;
    L.rest = L.pos.slice();
    L.col = col.array as Float32Array;
    L.base = L.col.slice();
    L.nor = nor.array as Float32Array;
    L.restN = L.nor.slice();
    pos.setUsage(THREE.DynamicDrawUsage);
    col.setUsage(THREE.DynamicDrawUsage);
    L.attrs = [pos, col];
    if (L.toon) {
      nor.setUsage(THREE.DynamicDrawUsage);
      L.attrs.push(nor);
    }
    disposables.push(geo);
    return geo;
  }
  const plateGeo = finish(PL);
  const solidGeo = finish(SL);
  const echoGeo = finish(AL);
  const plateMat = toonMaterial({ vertexColors: true });
  const solidMat = toonMaterial({ vertexColors: true });
  const echoMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  disposables.push(plateMat, solidMat, echoMat);
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.name = 'hallenplatten';
  const solidMesh = new THREE.Mesh(solidGeo, solidMat);
  solidMesh.name = 'steinkoerper';
  const echoMesh = new THREE.Mesh(echoGeo, echoMat);
  echoMesh.name = 'zeitecho';
  echoMesh.userData.echo = true;
  echoMesh.renderOrder = 2;
  // Was sich bewegt, liegt über die ganze Strecke verteilt (der Riss-Ring reicht über das ganze Land).
  plateMesh.frustumCulled = false;
  solidMesh.frustumCulled = false;
  echoMesh.frustumCulled = false;
  if (detail) {
    const ol = withOutline(solidMesh, 0.05);
    ol.frustumCulled = false;
  }
  group.add(plateMesh, solidMesh, echoMesh);
  tris += PL.mb.triangles + SL.mb.triangles * (detail ? 2 : 1) + AL.mb.triangles;

  // Feststehendes: Wegweiser, Uhr, Pfeilerstümpfe
  const decoGeo = deco.build();
  const decoMat = toonMaterial({ vertexColors: true });
  disposables.push(decoGeo, decoMat);
  const decoMesh = new THREE.Mesh(decoGeo, decoMat);
  decoMesh.name = 'wegweiser-uhr';
  if (detail) withOutline(decoMesh, 0.05);
  tris += deco.triangles * (detail ? 2 : 1);
  group.add(decoMesh);
  // Lichtzeichen
  const lampGeo = lampMb.build();
  const lampPos = lampGeo.getAttribute('position') as THREE.BufferAttribute;
  const lampCol = lampGeo.getAttribute('color') as THREE.BufferAttribute;
  lampPos.setUsage(THREE.DynamicDrawUsage);
  lampCol.setUsage(THREE.DynamicDrawUsage);
  const lampRest = (lampPos.array as Float32Array).slice();
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(lampGeo, lampMat);
  const lampMesh = new THREE.Mesh(lampGeo, lampMat);
  lampMesh.name = 'lichtzeichen';
  group.add(lampMesh);
  tris += lampMb.triangles;

  // ============================== Zustand schreiben ==============================

  const par = new Float64Array(NPAR);
  const M = new Float64Array(9);

  function dirty(L: Layer, a: number, b: number): void {
    if (b <= a) return;
    if (a < L.lo) L.lo = a;
    if (b > L.hi) L.hi = b;
  }

  function setPar(hidden: number, dx: number, dy: number, dz: number, ang: number, tint: number, bright: number, mode: number, phase: number, amp: number): void {
    par[0] = hidden;
    par[1] = dx;
    par[2] = dy;
    par[3] = dz;
    par[4] = ang;
    par[5] = tint;
    par[6] = bright;
    par[7] = mode;
    par[8] = phase;
    par[9] = amp;
  }
  const hide = (): void => setPar(1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  const rest = (bright = 0): void => setPar(0, 0, 0, 0, 0, 0, bright, 0, 0, 0);

  /** Setzt einen Körper auf die Werte in par – nur, wenn sie sich geändert haben. */
  function apply(b: Body): void {
    const last = b.last;
    let same = true;
    for (let i = 0; i < NPAR; i++)
      if (last[i] !== par[i]) {
        same = false;
        break;
      }
    if (same) return;
    last.set(par);
    const hidden = par[0] > 0;
    if (!hidden) {
      const ang = par[4];
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const C = 1 - c;
      const x = b.ax;
      const y = b.ay;
      const z = b.az;
      M[0] = c + x * x * C;
      M[1] = x * y * C - z * s;
      M[2] = x * z * C + y * s;
      M[3] = y * x * C + z * s;
      M[4] = c + y * y * C;
      M[5] = y * z * C - x * s;
      M[6] = z * x * C - y * s;
      M[7] = z * y * C + x * s;
      M[8] = c + z * z * C;
    }
    const ox = b.px + par[1];
    const oy = b.py + par[2];
    const oz = b.pz + par[3];
    const tk = par[5];
    const br = par[6];
    const mode = par[7];
    const ph = par[8];
    const amp = par[9];
    const tr = b.tint;
    for (let li = 0; li < 3; li++) {
      const L = layers[li];
      const v0 = b.v[li * 2];
      const v1 = b.v[li * 2 + 1];
      if (v1 <= v0) continue;
      dirty(L, v0, v1);
      if (hidden) {
        // verborgen: alle Ecken auf einen Punkt tief unten; Farben und Normalen in Ruhe (so ist der
        // Zustand derselbe, gleich woher die Zeit kommt)
        for (let v = v0 * 3; v < v1 * 3; v += 3) {
          L.pos[v] = b.px;
          L.pos[v + 1] = b.py - 60;
          L.pos[v + 2] = b.pz;
          for (let k = 0; k < 3; k++) {
            L.col[v + k] = L.toon ? L.base[v + k] : 0;
            L.nor[v + k] = L.restN[v + k];
          }
        }
        continue;
      }
      const R = L.rest;
      for (let v = v0; v < v1; v++) {
        const i = v * 3;
        const rx = R[i] - b.px;
        const ry = R[i + 1] - b.py;
        const rz = R[i + 2] - b.pz;
        L.pos[i] = ox + M[0] * rx + M[1] * ry + M[2] * rz;
        L.pos[i + 1] = oy + M[3] * rx + M[4] * ry + M[5] * rz;
        L.pos[i + 2] = oz + M[6] * rx + M[7] * ry + M[8] * rz;
        if (L.toon) {
          const n = L.restN;
          const nx = n[i];
          const ny = n[i + 1];
          const nz = n[i + 2];
          L.nor[i] = M[0] * nx + M[1] * ny + M[2] * nz;
          L.nor[i + 1] = M[3] * nx + M[4] * ny + M[5] * nz;
          L.nor[i + 2] = M[6] * nx + M[7] * ny + M[8] * nz;
          let cr = L.base[i];
          let cg = L.base[i + 1];
          let cb = L.base[i + 2];
          if (tk > 0) {
            cr += (tr[0] - cr) * tk;
            cg += (tr[1] - cg) * tk;
            cb += (tr[2] - cb) * tk;
          }
          if (mode > 0) {
            const u = (R[i] - b.ox) * b.ux + (R[i + 2] - b.oz) * b.uz;
            let k: number;
            let tc: RGB;
            if (mode === MODE_STRIPES) {
              const st = 0.5 + 0.5 * Math.sin(6.2832 * (u / STRIPE - ph));
              k = amp * sstep(0.3, 0.9, st);
              tc = ABYSS;
            } else {
              const d = (u - ph) / 2.2;
              k = amp * Math.exp(-d * d);
              tc = GOLD_HI;
            }
            cr += (tc[0] - cr) * k;
            cg += (tc[1] - cg) * k;
            cb += (tc[2] - cb) * k;
          }
          L.col[i] = cr;
          L.col[i + 1] = cg;
          L.col[i + 2] = cb;
        } else {
          L.col[i] = L.base[i] * br;
          L.col[i + 1] = L.base[i + 1] * br;
          L.col[i + 2] = L.base[i + 2] * br;
        }
      }
    }
  }

  function upload(L: Layer): void {
    if (L.hi < 0) return;
    for (const attr of L.attrs) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(L.lo * 3, (L.hi - L.lo) * 3);
      attr.needsUpdate = true;
    }
    L.lo = Infinity;
    L.hi = -1;
  }

  /** Puls, der immer schneller wird (tw: Sekunden seit Beginn der Ankündigung). */
  const pulseAt = (tw: number, phase: number): number => 0.5 + 0.5 * Math.sin(2 * Math.PI * (1.2 * tw + 0.9 * tw * tw) + phase);

  const setLamp = (r: [number, number], c: THREE.Color, k = 1): void => {
    const lc = lampCol.array as Float32Array;
    for (let v = r[0]; v < r[0] + r[1]; v++) {
      lc[v * 3] = c.r * k;
      lc[v * 3 + 1] = c.g * k;
      lc[v * 3 + 2] = c.b * k;
    }
  };
  const showLamp = (r: [number, number], on: boolean): void => {
    const lp = lampPos.array as Float32Array;
    const v0 = r[0];
    for (let v = v0; v < v0 + r[1]; v++) {
      const i = v * 3;
      lp[i] = on ? lampRest[i] : lampRest[v0 * 3];
      lp[i + 1] = on ? lampRest[i + 1] : lampRest[v0 * 3 + 1] - 0.5;
      lp[i + 2] = on ? lampRest[i + 2] : lampRest[v0 * 3 + 2];
    }
  };

  let rissShown = true;
  let rissV = 0;
  const rissC = new Float64Array(3);
  /** Eine Ecke des Riss-Rings schreiben (Helligkeit k auf die Farbe in rissC). */
  const put = (x: number, y: number, z: number, k: number): void => {
    const i = rissV * 3;
    AL.pos[i] = x;
    AL.pos[i + 1] = y;
    AL.pos[i + 2] = z;
    AL.col[i] = rissC[0] * k;
    AL.col[i + 1] = rissC[1] * k;
    AL.col[i + 2] = rissC[2] * k;
    rissV++;
  };

  /** Alles, was zu sehen ist, für die Rennzeit time (Ticks). */
  function refresh(time: number, seconds: number, cam: THREE.Vector3 | null, fx: FxSink | null, dt: number): void {
    const E = era!;
    const per = E.period;
    const clock = time <= 0 ? 0 : time % per;
    const age = eraAt(E, time);
    const eUntil = eraUntil(E, time);
    const eSince = eraSince(E, time);
    const jumped = time >= E.split;
    const warnK = eUntil <= ERA_WARN ? 1 - eUntil / ERA_WARN : 0;
    const warnS = eUntil <= ERA_WARN ? (ERA_WARN - eUntil) / 60 : 0;
    const particles = !!fx && !!cam && detail && dt > 0;

    // --- Hallenplatten ---
    for (const pl of plates) {
      const h = pl.hole;
      const active = planActive(h.plan, time);
      const until = active ? 0 : planUntil(h.plan, time);
      const since = active ? planSince(h.plan, time) : -1;
      const refill = active ? ticksToChange(h.plan, time) : Infinity;
      const restoredAgo = !active && time >= h.plan.spans[1] ? clock : Infinity;
      const warn = !active && until <= ERA_WARN;
      const u = warn ? 1 - until / ERA_WARN : 0;
      const tw = warn ? (ERA_WARN - until) / 60 : 0;
      const N = pl.segs.length;
      for (let i = 0; i < pl.shards.length; i++) {
        const b = pl.shards[i];
        const ph = pl.phase[i];
        if (!active) {
          if (warn) {
            const p = pulseAt(tw, ph * 0.3);
            const jig = Math.sin(2 * Math.PI * (2.2 * tw + 1.8 * tw * tw) + ph);
            const flick = 0.8 + 0.2 * Math.sin(time * 1.9 + ph);
            setPar(0, 0, -0.012 * u * (0.5 + 0.5 * jig), 0, 0, 0.12 * u * p, u * (0.35 + 0.65 * p), MODE_STRIPES, 0.5 * tw + 0.55 * tw * tw, (0.2 + 0.7 * smooth(u)) * flick);
          } else if (restoredAgo < SHIMMER_T) {
            const k = restoredAgo / SHIMMER_T;
            setPar(0, 0, 0, 0, 0, 0, 0, MODE_SHIMMER, -N / 2 - 3 + (N + 6) * k, 0.9);
          } else rest();
        } else if (refill <= ERA_WARN) {
          // steigt aus der Tiefe auf und setzt sich zusammen – fertig genau mit dem Sprung
          const q = refill / (ERA_WARN * (1 - pl.rise[i]));
          if (q >= 1) hide();
          else {
            // bis zum Sprung bleibt jedes Stück sichtlich unter der Fahrbahn und türkis: es trägt noch nicht
            const qq = Math.pow(q, 1.3);
            setPar(0, pl.drift[i] * qq * 0.6 * rightX(t, pl.segs[0]), -RISE_GAP - 8.8 * qq, pl.drift[i] * qq * 0.6 * rightZ(t, pl.segs[0]), pl.spin[i] * qq * 1.2, 0.4 + 0.45 * Math.min(1, q * 1.6), 0.25 + 0.4 * q, 0, 0, 0);
          }
        } else {
          const tau = since / 60 - pl.delay[i];
          if (tau <= 0) setPar(0, 0, 0, 0, 0, 0.2, 1, MODE_STRIPES, 0, 0.7);
          else {
            const drop = 4 * tau + 18 * tau * tau;
            if (drop > 9.5) hide();
            else {
              const d = pl.drift[i] * tau;
              const s = pl.segs[0];
              setPar(0, rightX(t, s) * d, -drop, rightZ(t, s) * d, pl.spin[i] * tau * (1 + tau), 0.25, Math.max(0, 1 - tau / 0.35), MODE_STRIPES, tau, 0.45);
            }
          }
        }
        apply(b);
      }
      // Bruchkante: nur, solange das Loch besteht
      if (active) rest();
      else hide();
      apply(pl.rims);
      // Zeitecho: blendet nach dem Bruch ein, wird vor dem Zusammensetzen dichter und heller
      if (active) {
        const fade = Math.min(1, since / 40);
        const rise = refill <= ERA_WARN ? 1 - refill / ERA_WARN : 0;
        const glow = 0.85 + 0.15 * Math.sin(time * 0.05 + pl.index);
        setPar(0, 0, 0, 0, 0, 0, fade * glow * (1 + 0.9 * rise), 0, 0, 0);
        apply(pl.echo);
        setPar(0, 0, 0, 0, 0, 0, fade * (0.14 + 1.4 * rise * (0.7 + 0.3 * pulseAt((ERA_WARN - refill) / 60, 0))), 0, 0, 0);
        apply(pl.lattice);
      } else {
        hide();
        apply(pl.echo);
        apply(pl.lattice);
      }
      // Teilchen
      if (particles && pl.samples.length > 0) {
        const near = (pl.samples[0] - cam!.x) ** 2 + (pl.samples[2] - cam!.z) ** 2 < 170 * 170;
        const prev = pl.seen;
        const n = pl.samples.length / 3;
        if (near && warn) {
          const rate = 10 * u * dt;
          let count = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
          while (count-- > 0) {
            const k = Math.floor(Math.random() * n) * 3;
            fx!.spark(pl.samples[k], pl.samples[k + 1], pl.samples[k + 2], (Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5, 0.6, 0.22, 0x46ffe8, 2);
          }
        }
        if (near && refill <= ERA_WARN) {
          const rate = 8 * dt;
          if (Math.random() < rate) {
            const k = Math.floor(Math.random() * n) * 3;
            fx!.spark(pl.samples[k], pl.samples[k + 1] - 3, pl.samples[k + 2], 0, 4 + Math.random() * 2, 0, 0.7, 0.25, 0x7ff6e6, 0);
          }
        }
        if (near && !Number.isNaN(prev) && active && planSince(h.plan, prev) < 0 && time - prev < 30) {
          for (let c = 0; c < 10; c++) {
            const k = (c % n) * 3;
            if (c % 2 === 0) fx!.puff(pl.samples[k], pl.samples[k + 1] - 0.6, pl.samples[k + 2], (Math.random() - 0.5) * 2, -2.5, (Math.random() - 0.5) * 2, 0.6, 0.55, 0xc4b286, 0.8, 4);
            fx!.spark(pl.samples[k], pl.samples[k + 1], pl.samples[k + 2], (Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5, 0.8, 0.26, 0x46ffe8, 9);
          }
        }
      }
      pl.seen = time;
    }

    // --- Aquädukt ---
    for (const bridge of bridges) {
      const L = bridge.L;
      for (const pi of bridge.pieces) {
        const pc = pieces[pi];
        const h = pc.hole;
        const active = planActive(h.plan, time);
        const since = active ? planSince(h.plan, time) : -1;
        const refill = active ? ticksToChange(h.plan, time) : Infinity;
        const restoredAgo = !active && time >= h.plan.spans[1] ? clock : Infinity;
        // bröckelt: Jetzt, bevor das Stück einstürzt (es trägt noch); leise Risse schon kurz vor dem Sprung
        const crumbling = !active && age === 1;
        const cu = crumbling ? Math.min(1, eSince / Math.max(1, h.plan.spans[0] - E.split)) : 0;
        for (let i = 0; i < pc.bodies.length; i++) {
          const b = pc.bodies[i];
          if (!active) {
            if (crumbling) {
              const jig = Math.sin(time * 1.7 + i * 2.1) * Math.sin(time * 0.53 + pi);
              setPar(0, 0, 0.022 * cu * jig, 0, 0, 0.1 * cu, 0.45 + 0.55 * cu * pulseAt(eSince / 60, i), 0, 0, 0);
            } else if (age === 0 && warnK > 0) setPar(0, 0, 0, 0, 0, 0, 0.35 * warnK * pulseAt(warnS, i), 0, 0, 0);
            else if (restoredAgo < SHIMMER_T + 12) setPar(0, 0, 0, 0, 0, 0, 0, MODE_SHIMMER, -L / 2 - 4 + (L + 8) * (restoredAgo / (SHIMMER_T + 12)), 0.8);
            else rest();
          } else if (refill <= ERA_WARN) {
            const q = refill / (ERA_WARN * (1 - 0.18 * i));
            if (q >= 1) hide();
            else {
              const qq = Math.pow(q, 1.4);
              setPar(0, 0, -RISE_GAP - 17 * qq, 0, pc.spin[i] * qq * 0.9, 0.35 + 0.45 * Math.min(1, q * 1.5), 0.25 + 0.4 * q, 0, 0, 0);
            }
          } else {
            const tau = since / 60 - pc.delay[i];
            if (tau <= 0) setPar(0, 0, 0, 0, 0, 0.12, 1, 0, 0, 0);
            else {
              const drop = 2.5 * tau + 7.5 * tau * tau;
              if (drop > 18) hide();
              else {
                const s = pc.segs[0];
                const d = pc.drift[i] * tau;
                setPar(0, rightX(t, s) * d, -drop, rightZ(t, s) * d, pc.spin[i] * tau * (0.6 + tau), 0, Math.max(0, 1 - tau), 0, 0, 0);
              }
            }
          }
          apply(b);
        }
        if (active) {
          const fade = sstep(0.4, 1.6, since / 60);
          const rise = refill <= ERA_WARN ? 1 - refill / ERA_WARN : 0;
          setPar(0, 0, 0, 0, 0, 0, fade * (0.8 + 0.2 * Math.sin(time * 0.05 + pi)) * (1 + 0.9 * rise), 0, 0, 0);
        } else hide();
        apply(pc.echo);
        // Teilchen: Staub beim Bröckeln, eine Wolke beim Einsturz
        if (particles && pc.samples.length > 0) {
          const near = (pc.samples[0] - cam!.x) ** 2 + (pc.samples[2] - cam!.z) ** 2 < 200 * 200;
          const n = pc.samples.length / 3;
          if (near && crumbling) {
            const rate = 5 * cu * dt;
            if (Math.random() < rate) {
              const k = Math.floor(Math.random() * n) * 3;
              fx!.puff(pc.samples[k], pc.samples[k + 1], pc.samples[k + 2], (Math.random() - 0.5) * 1, -1, (Math.random() - 0.5) * 1, 0.9, 0.45, 0xc4b286, 0.5, 3);
            }
          }
          if (near && !Number.isNaN(pc.seen) && active && planSince(h.plan, pc.seen) < 0 && time - pc.seen < 30) {
            for (let c = 0; c < 10; c++) {
              const k = (c % n) * 3;
              fx!.puff(pc.samples[k], pc.samples[k + 1], pc.samples[k + 2], (Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3, 1.1, 1.0, 0xd4c292, 1.4, 1.5);
            }
          }
        }
        pc.seen = time;
      }
    }

    // --- Tore, Trümmer, Wegweiser ---
    for (const gv of gates) {
      const g = t.gates[gv.gateIndex];
      const active = planActive(g.plan, time);
      const change = ticksToChange(g.plan, time);
      gv.mesh.visible = active;
      // offen: Trümmerhaufen (Schatzkammer) bzw. Torbogen (Aquädukt)
      if (active) hide();
      else rest();
      for (const b of gv.open) apply(b);
      if (gv.echo) {
        if (!active) {
          const k = change <= ERA_WARN ? 1 - change / ERA_WARN : 0;
          setPar(0, 0, 0, 0, 0, 0, Math.min(1, eSince / 30) * (0.75 + 0.25 * Math.sin(time * 0.05)) * (1 + 1.1 * k), 0, 0, 0);
        } else hide();
        apply(gv.echo);
      }
      // Brocken: fallen in der halben Sekunde vor und nach dem Umschalten neben der Bahn
      let pch = -1;
      if (jumped && eSince < CHUNK_T) pch = 0.5 + eSince / (2 * CHUNK_T);
      else if (eUntil <= CHUNK_T) pch = 0.5 - eUntil / (2 * CHUNK_T);
      for (let i = 0; i < gv.chunks.length; i++) {
        if (pch < 0) hide();
        else setPar(0, 0, 9 * (1 - pch * pch), 0, (i % 2 === 0 ? 1 : -1) * 2.5 * pch, 0, 0, 0, 0, 0);
        apply(gv.chunks[i]);
      }
      if (particles && !Number.isNaN(gv.seen) && gv.seen < time && time - gv.seen < 30 && planActive(g.plan, gv.seen) !== active) {
        for (let i = 0; i < gv.dust.length; i += 3) {
          const x = gv.dust[i];
          const z = gv.dust[i + 2];
          if ((x - cam!.x) ** 2 + (z - cam!.z) ** 2 > 180 * 180) continue;
          fx!.puff(x, gv.dust[i + 1], z, (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2, 0.8, 0.8, 0xc4b286, 0.9, -0.3);
        }
      }
      gv.seen = time;
      // Lichtzeichen: grün offen, rot mit Kreuz zu; vor dem Wechsel blinkend in der Farbe, die gleich gilt
      const now = active ? L_RED : L_GREEN;
      const next = active ? L_GREEN : L_RED;
      let lampC = now;
      let arrowC = active ? L_ARROW_OFF : L_GREEN;
      if (change <= ERA_WARN && change > 0) {
        const tw = (ERA_WARN - change) / 60;
        const ph = 1.4 * tw + 0.6 * tw * tw;
        const on = ph - Math.floor(ph) < 0.5;
        lampC = on ? next : L_OFF;
        arrowC = on ? (active ? L_GREEN : L_ARROW_OFF) : active ? L_ARROW_OFF : L_GREEN;
      }
      const lit = Math.max(0, Math.min(6, Math.ceil((6 * eUntil) / E.split - 1e-9)));
      const ringC2 = age === 0 ? L_GOLD : L_TURQ;
      for (const lm of gv.lamps) {
        setLamp(lm.disc, lampC);
        setLamp(lm.arrow, arrowC);
        setLamp(lm.cross, L_RED);
        showLamp(lm.cross, active);
        for (let i = 0; i < 6; i++) {
          let on = i >= 6 - lit;
          if (on && i === 6 - lit && warnK > 0) on = pulseAt(warnS, 0) > 0.5;
          setLamp(lm.ring[i], on ? ringC2 : L_DIM);
        }
      }
    }

    // --- Zeituhr: Zeiger, Ringhälften (die des geltenden Zeitalters leuchtet, vor dem Sprung pulsiert sie) ---
    {
      const th = (2 * Math.PI * clock) / per;
      const ca = Math.cos(th);
      const sa = Math.sin(th);
      const lp = lampPos.array as Float32Array;
      for (const pt of pointer) {
        for (let k = 0; k < pt.pts.length; k++) {
          const [x, y, z] = pt.pts[k];
          // Drehung im Uhrzeigersinn (von vorn gesehen): Spitze bei Winkel th
          const xr = x * ca + y * sa;
          const yr = -x * sa + y * ca;
          const i = (pt.v0 + k) * 3;
          lp[i] = ringC[0] + Uc[0] * xr + Vc[0] * yr + Nc[0] * z;
          lp[i + 1] = ringC[1] + Uc[1] * xr + Vc[1] * yr + Nc[1] * z;
          lp[i + 2] = ringC[2] + Uc[2] * xr + Vc[2] * yr + Nc[2] * z;
        }
        setLamp(pt.range, age === 0 ? L_GOLD : L_TURQ, 1.15);
      }
      const p = warnK > 0 ? pulseAt(warnS, 0) : 1;
      const cur = warnK > 0 ? 0.45 + 0.55 * p : 1;
      const other = warnK > 0 ? 0.18 + 0.6 * warnK * (1 - p) : 0.18;
      const flash = jumped && eSince < 20 ? 1 + 0.6 * (1 - eSince / 20) : 1;
      for (const r of clockHalves[0]) setLamp(r, L_GOLD, age === 0 ? cur * flash : other);
      for (const r of clockHalves[1]) setLamp(r, L_TURQ, age === 1 ? cur * flash : other);
      for (const r of clockTicks) setLamp(r, L_GOLD, 0.0 + 0.9);
    }
    lampPos.needsUpdate = true;
    lampCol.needsUpdate = true;

    // --- Riss-Ring: läuft beim Sprung von der Uhr über das Land ---
    {
      const show = jumped && eSince < RISS_T;
      if (show || rissShown) {
        const pos = AL.pos;
        if (!show) {
          for (let v = rissV0; v < rissV1; v++) {
            pos[v * 3] = ringC[0];
            pos[v * 3 + 1] = ringC[1] - 60;
            pos[v * 3 + 2] = ringC[2];
          }
          rissShown = false;
        } else {
          const p = eSince / RISS_T;
          const r = 6 + (rissMax - 6) * (1 - (1 - p) * (1 - p));
          const I = Math.pow(1 - p, 0.6) * 0.85;
          const cc = age === 0 ? GOLD_GLOW : TURQ;
          const cr = cc[0] * I;
          const cg = cc[1] * I;
          const cb = cc[2] * I;
          const ri = Math.min(rissNR - 1.001, r / rissDR);
          const r0 = Math.floor(ri);
          const fr = ri - r0;
          const band = Math.min(14, r * 0.5);
          rissV = rissV0;
          rissC[0] = cr;
          rissC[1] = cg;
          rissC[2] = cb;
          for (let ai = 0; ai < rissNA; ai++) {
            const aj = (ai + 1) % rissNA;
            const a0 = (ai / rissNA) * Math.PI * 2;
            const a1 = ((ai + 1) / rissNA) * Math.PI * 2;
            const h0 = rissH[ai * rissNR + r0] * (1 - fr) + rissH[ai * rissNR + r0 + 1] * fr;
            const h1 = rissH[aj * rissNR + r0] * (1 - fr) + rissH[aj * rissNR + r0 + 1] * fr;
            const c0 = Math.cos(a0);
            const s0 = Math.sin(a0);
            const c1 = Math.cos(a1);
            const s1 = Math.sin(a1);
            const X0 = ringC[0] + c0 * r;
            const Z0 = ringC[2] + s0 * r;
            const X1 = ringC[0] + c1 * r;
            const Z1 = ringC[2] + s1 * r;
            const ib = r - band;
            // flaches Band: innen dunkel, außen hell
            put(ringC[0] + c0 * ib, h0 + 0.25, ringC[2] + s0 * ib, 0);
            put(X0, h0 + 0.25, Z0, 0.8);
            put(X1, h1 + 0.25, Z1, 0.8);
            put(ringC[0] + c0 * ib, h0 + 0.25, ringC[2] + s0 * ib, 0);
            put(X1, h1 + 0.25, Z1, 0.8);
            put(ringC[0] + c1 * ib, h1 + 0.25, ringC[2] + s1 * ib, 0);
            // Vorhang unten (aus dem Boden) und oben (verläuft nach oben)
            put(X0, h0 - 5, Z0, 0);
            put(X1, h1 - 5, Z1, 0);
            put(X1, h1 + 0.6, Z1, 1);
            put(X0, h0 - 5, Z0, 0);
            put(X1, h1 + 0.6, Z1, 1);
            put(X0, h0 + 0.6, Z0, 1);
            put(X0, h0 + 0.6, Z0, 1);
            put(X1, h1 + 0.6, Z1, 1);
            put(X1, h1 + 4.5, Z1, 0);
            put(X0, h0 + 0.6, Z0, 1);
            put(X1, h1 + 4.5, Z1, 0);
            put(X0, h0 + 4.5, Z0, 0);
          }
          rissShown = true;
        }
        dirty(AL, rissV0, rissV1);
      }
      if (particles && jumped && eSince < 3) {
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          fx!.spark(ringC[0], ringC[1], ringC[2], Math.cos(a) * 9, (Math.random() - 0.3) * 6, Math.sin(a) * 9, 0.9, 0.5, age === 0 ? 0xffc040 : 0x46ffe8, 2);
        }
      }
    }
    void seconds;

    upload(PL);
    upload(SL);
    upload(AL);
  }

  refresh(0, 0, null, null, 0);

  group.userData.triangles = tris;
  // Für Tests (riftbild.test.ts): welche Dreiecke Fahrfläche sind und welche Netze was zeigen.
  group.userData.rift = {
    platten: plateMesh,
    stein: solidMesh,
    echo: echoMesh,
    lichter: lampMesh,
    fest: decoMesh,
    deck: deckInfo,
    sperren: gates.map((g) => g.mesh),
    uhr: ringC,
  };

  return {
    group,
    update(time, seconds, dt, cam, fx) {
      refresh(time, seconds, cam, fx, dt);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
