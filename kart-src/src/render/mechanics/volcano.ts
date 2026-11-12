// Vulkaninsel: Darstellung der Bruchstellen (samt der Fahrbahn dort) und der Tore.
//
// Was hier zu sehen ist, steht genau dort, wo die Physik es hat (game/mechanics.ts,
// game/track.ts: track.holes, track.gates), und ist eine reine Funktion der Rennzeit:
// Springt die Zeit vor oder zurück, stimmt das Bild im selben Bild wieder.
//
// Platten (Kraterrand, Basaltbrücke): Die stehende Welt (world.ts) lässt in der Fahrbahn
// genau die Form jeder Bruchstelle offen; hier wird das Loch gefüllt – Abschnitt für
// Abschnitt mit denselben Ecken und Farben wie die Fahrbahn ringsum. Vier Zustände:
//   * trägt: bündig, dazu ein feines, schwach glühendes Rissnetz und eine glimmende Fuge
//     rundum – das Erkennungszeichen einer Platte, die irgendwann fällt;
//   * bröckelt (die letzten warn Ticks): Risse breit und hell, Pulsieren immer schneller,
//     die ganze Platte färbt sich zur Glut hin und ruckelt (höchstens 3 cm nach unten);
//   * bricht (ab planActive): 3–6 Schollen stürzen kippend in den Glutgraben;
//   * Loch: dunkle Innenwände in Stegdicke, oben eine hell glühende Kante, tief unten
//     ein Glutschein (additiv) – ein glühender Abgrund, auch ohne die Lava im Graben.
// Wo sich zwei Bruchstellen überlappen, gehört das Stück der, die zuerst bricht.
//
// Hängebrücke (Abzweigung, Bruchstellen über die ganze Breite): Die Welt zeichnet dort
// nichts. Hier entsteht die ganze Brücke: Bohlen bündig auf Fahrbahnhöhe, Tragseile mit
// Durchhang darunter, Holzböcke neben der Fahrbahn, Halteseile. Jedes der fünf Stücke
// bröckelt, bricht und fehlt wie eine Platte; die Seilenden baumeln danach an den Böcken.
// In den letzten Sekunden vor dem Schließen des Tors schwanken die Seile stärker.
//
// Tore: an der Mündung genau auf der Linie, an der die Physik die Bande der Hauptstrecke
// durchziehen lässt. Ein Tor, das sich öffnet, ist eine Zunge aus erstarrter Lava (sinkt
// in den letzten Sekunden weg); eines, das sich schließt, ein Felssturz mit rot-weißer
// Schranke (fällt in der letzten halben Sekunde). Vor jeder Gabelung zwei Wegweiser mit
// Ampel: grün offen, rot mit Kreuz zu, gelb und immer schneller blinkend vor dem Wechsel.
//
// Zeichentechnik (siehe machines.ts): nur Eckenfarben, Toon-Körper mit Kontur, einfache
// Flächen (auch additiv) und Netze, deren Ecken je Bild neu gesetzt werden. Kein eigener
// Shader, keine Textur. Alle beweglichen Teile liegen in drei Netzen (Toon, Leuchtlinien,
// Glutschein); geschrieben werden je Bild nur die Körper, deren Zustand sich ändert, und
// hochgeladen nur der geänderte Bereich.
//
// Zeichenaufrufe mit detail: bewegliche Netze 3, Feststehendes 1 + Kontur 1, Lavazunge 1 + 1,
// Felssturz 1 + 1, Lampen 1 = 10. Ohne detail (keine Konturen) 7.

import * as THREE from 'three';
import { planActive, planSince, planUntil, type Gate, type Hole, type Plan } from '../../game/mechanics';
import { EDGE_OPEN_L, EDGE_OPEN_R, rightX, rightZ, type Branch, type Track } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';
import { HOLE_RIM, PIT_D } from '../world';
import { boxT, face, stripedFace, type Xform } from './machineKit';

// --- Farben ------------------------------------------------------------------------

// Fahrbahn "Fels" wie in world.ts (zwei Töne alle 3 Abschnitte, Seitenstreifen)
const ROCK_A = rgb(0x57495a);
const ROCK_B = rgb(0x4b3f50);
const ROCK_SH = rgb(0x3c3242);
const ROCK_SIDE = rgb(0x3a3040);
const ROCK_BOTTOM = rgb(0x2a2230);
const HOLE_WALL = rgb(0x231c28);
const HEAT = rgb(0xff5414);
// Holz
const WOOD_A = rgb(0xb98150);
const WOOD_B = rgb(0xa56f3f);
const WOOD_FUGE = rgb(0x5e4226);
const WOOD_SIDE = rgb(0x6e4c2c);
const WOOD_HEAT = rgb(0xffa548);
const POST = rgb(0x7a5a3c);
const POST_D = rgb(0x5e4226);
const ROPE = rgb(0xd8c49a);
const ROPE_D = rgb(0x9c8660);
// Leuchten
const CRACK = rgb(0xff7a1e);
const HOT = rgb(0xffe6a0);
const EMBER = rgb(0xff6a1a);
const GLOW_DEEP = rgb(0xff5a10);
const BLACK: RGB = [0, 0, 0];
// Lava der Zunge
const CRUST = rgb(0x2c2329);
const CRUST_B = rgb(0x3a2c31);
const CRUST_HOT = rgb(0x8a2a18);
const LAVA = rgb(0xff6a1f);
const LAVA_HI = rgb(0xffb43c);
// Felssturz und Schranke
const BOULDER = rgb(0x5c4c5c);
const BOULDER_B = rgb(0x4a3d4c);
const RED = rgb(0xe0281e);
const WHITE = rgb(0xf6f2ea);
// Wegweiser
const BOARD = rgb(0x2a2632);
const FRAME = rgb(0xffc72e);
const ARROW = rgb(0xf6ecd4);
const HOUSING = rgb(0x1e1a24);
const L_GREEN = new THREE.Color(0x2bff6a);
const L_RED = new THREE.Color(0xff2a14);
const L_YEL = new THREE.Color(0xffd21c);
const L_OFF = new THREE.Color(0x3a3022);

// --- Maße ----------------------------------------------------------------------------

/** Dicke des Stegs (world.ts: DECK_D) – so tief reichen Platten und Innenwände. */
const DECK = 1.1;
/** Dicke einer Bohle. */
const PLANK = 0.22;
/** Fallbeschleunigung der Trümmer (m/s²). */
const GRAV = 10.5;
/** So tief fallen Schollen, bevor sie verschwinden: in den Glutgraben bzw. in die Schlucht. */
const FALL_PIT = PIT_D + 1.8;
const FALL_GORGE = 14;
/** Breite der Leuchtlinien: Risse (schmal … breit), Fuge rundum (Ruhe … Loch). */
const CRACK_MAX = 0.36;
const CRACK_THIN = 0.06;
const RIM_MAX = 0.3;
const RIM_THIN = 0.07;
const RIM_HOLE = 0.24;
/** Glutschein im Loch: so tief unter der Fahrbahn. */
const GLOW_D = 3.4;
/** Ein Tor, das sich schließt, fällt so lange (Ticks) vor dem Schließen aus der Höhe. */
const DROP_TICKS = 30;
const DROP_H = 14;

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
const UP: V3 = [0, 1, 0];
const DOWN: V3 = [0, -1, 0];

/** Erster Beginn eines Plans (für die Reihenfolge, in der Bruchstellen brechen). */
function firstStart(p: Plan): number {
  return p.spans.length > 0 ? p.spans[0] : Infinity;
}

/** Ticks bis zum nächsten Wechsel des Plans (gilt ↔ gilt nicht); Infinity = nie mehr. */
function ticksToChange(p: Plan, time: number): number {
  if (!planActive(p, time)) return planUntil(p, time);
  if (p.period > 0) {
    const c = ((time % p.period) + p.period) % p.period;
    for (let i = 0; i < p.spans.length; i += 2) if (c >= p.spans[i] && c < p.spans[i + 1]) return p.spans[i + 1] - c;
    return Infinity;
  }
  for (let i = 0; i < p.spans.length; i += 2) if (time >= p.spans[i] && time < p.spans[i + 1]) return p.spans[i + 1] - time;
  return Infinity;
}

/** Ein Teil eines beweglichen Netzes: Eckenbereiche in den drei Netzen, Drehpunkt und -achse. */
interface Body {
  s0: number;
  s1: number;
  g0: number;
  g1: number;
  a0: number;
  a1: number;
  px: number;
  py: number;
  pz: number;
  ax: number;
  ay: number;
  az: number;
  /** Farbe, zu der die Toon-Flächen beim Glühen hin wechseln. */
  heat: RGB;
  /** Zuletzt geschriebene Werte: verborgen, dx, dy, dz, Winkel, Glut, Rissbreite, Leuchtkraft, Weißglut, Schein. */
  last: Float64Array;
}
const NPAR = 10;

/** Ein bewegliches Netz: Ruhelage der Ecken, aktuelle Ecken, Grundfarben. */
interface Layer {
  mb: MeshBuilder;
  /** Nur Leuchtlinien: Mittelpunkt je Ecke, um den die Breite skaliert wird. */
  center: number[];
  rest: Float32Array;
  pos: Float32Array;
  restN: Float32Array | null;
  nor: Float32Array | null;
  base: Float32Array;
  col: Float32Array;
  posAttr: THREE.BufferAttribute;
  colAttr: THREE.BufferAttribute;
  norAttr: THREE.BufferAttribute | null;
  lo: number;
  hi: number;
}

function newLayer(): Layer {
  const empty = new Float32Array(0);
  const dummy = new THREE.BufferAttribute(empty, 3);
  return { mb: new MeshBuilder(), center: [], rest: empty, pos: empty, restN: null, nor: null, base: empty, col: empty, posAttr: dummy, colAttr: dummy, norAttr: null, lo: Infinity, hi: -1 };
}

/** Eine Platte: Abschnitte und seitliche Lage je Abschnitt (nach Abzug früher brechender Stellen). */
interface Plate {
  hole: Hole;
  at: number;
  segs: number[];
  lo: number[];
  hi: number[];
  bridge: boolean;
  shards: Body[];
  /** Je Schollenkörper: Verzögerung (s), Drift, Drehgeschwindigkeit, Phase fürs Ruckeln. */
  delay: number[];
  drift: number[];
  spin: number[];
  phase: number[];
  /** Ränder: Körper und Nachbarplatte (−1 = feste Fahrbahn). */
  rims: Body[];
  rimOther: number[];
  /** Stichproben am Rand für Staub und Funken. */
  samples: number[];
  /** Zuletzt gesehene Rennzeit (nur für Teilchen). */
  seen: number;
}

/** Seil, Hänger oder Halteseil der Hängebrücke. */
interface Rope {
  body: Body;
  /** Zu welchem Stück der Brücke es gehört; −1 = zu keinem (bleibt). */
  piece: number;
  /** 0 … 1 längs der Brücke (für das Schwanken). */
  u: number;
  /** 0 = fällt mit dem Stück, 1 = baumelt am Drehpunkt (Winkel dangle). */
  mode: number;
  dangle: number;
  phase: number;
}

export function buildVolcano(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'vulkan';
  const disposables: { dispose(): void }[] = [];
  const rand = seeded(9173);

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

  // Drei bewegliche Netze: Toon-Flächen, Leuchtlinien, Glutschein.
  const S = newLayer();
  const G = newLayer();
  const A = newLayer();
  const bodies: Body[] = [];
  let tris = 0;

  function begin(): Body {
    return {
      s0: S.mb.triangles * 3,
      s1: 0,
      g0: G.mb.triangles * 3,
      g1: 0,
      a0: A.mb.triangles * 3,
      a1: 0,
      px: 0,
      py: 0,
      pz: 0,
      ax: 1,
      ay: 0,
      az: 0,
      heat: HEAT,
      last: new Float64Array(NPAR).fill(NaN),
    };
  }
  function end(b: Body, pivot: V3, axis: V3 = [1, 0, 0]): Body {
    b.s1 = S.mb.triangles * 3;
    b.g1 = G.mb.triangles * 3;
    b.a1 = A.mb.triangles * 3;
    b.px = pivot[0];
    b.py = pivot[1];
    b.pz = pivot[2];
    const n = norm(axis);
    b.ax = n[0];
    b.ay = n[1];
    b.az = n[2];
    bodies.push(b);
    return b;
  }

  /** Leuchtlinie als Viereck a-b-c-d (nach oben bzw. zur Seite out), mit Mittelpunkten je Ecke für die Breite. */
  function glowQuad(a: V3, b: V3, c: V3, d: V3, ca: V3, cb: V3, cc: V3, cd: V3, out: V3, col: RGB): void {
    const n = cross(sub(b, a), sub(c, a));
    const ok = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0;
    if (ok) {
      G.mb.quad(a, b, c, d, col);
      G.center.push(...ca, ...cb, ...cc, ...ca, ...cc, ...cd);
    } else {
      G.mb.quad(a, d, c, b, col);
      G.center.push(...ca, ...cd, ...cc, ...ca, ...cc, ...cb);
    }
  }
  /** Leuchtstreifen entlang p0→p1 (auf der Fläche), Breite w, beidseitig oder nur zur Seite inward. */
  function glowStrip(p0: V3, p1: V3, w: number, col: RGB, inward: V3 | null = null): void {
    let side: V3;
    if (inward) side = inward;
    else {
      const d = sub(p1, p0);
      side = norm([-d[2], 0, d[0]]);
    }
    if (inward) {
      const a = add(p0, side, w);
      const b = add(p1, side, w);
      glowQuad(p0, p1, b, a, p0, p1, p1, p0, UP, col);
    } else {
      const h = w / 2;
      glowQuad(add(p0, side, -h), add(p1, side, -h), add(p1, side, h), add(p0, side, h), p0, p1, p1, p0, UP, col);
    }
  }
  /** Fläche im Glutschein-Netz mit Farbe je Ecke (oben a/b, unten c/d). */
  function addQuad(a: V3, b: V3, c: V3, d: V3, out: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    const n = cross(sub(b, a), sub(c, a));
    const ok = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0;
    const cols = ok ? [ca, cb, cc, ca, cc, cd] : [ca, cd, cc, ca, cc, cb];
    const pts = ok ? [a, b, c, a, c, d] : [a, d, c, a, c, b];
    // MeshBuilder kennt nur eine Farbe je Dreieck: Ecken einzeln färben wir nach dem Bau (addCols).
    A.mb.tri(pts[0], pts[1], pts[2], cols[0]);
    A.mb.tri(pts[3], pts[4], pts[5], cols[3]);
    for (const c of cols) addCols.push(c[0], c[1], c[2]);
  }
  /** Farben je Ecke im Glutschein-Netz (in derselben Reihenfolge wie die Ecken). */
  const addCols: number[] = [];
  function addFlat(a: V3, b: V3, c: V3, d: V3, out: V3, col: RGB): void {
    addQuad(a, b, c, d, out, col, col, col, col);
  }

  // ============================== Platten ==============================

  // Reihenfolge des Brechens: Wo sich Stellen überlappen, gehört das Stück der frühesten.
  const order = t.holes.map((_, i) => i).sort((a, b) => firstStart(t.holes[a].plan) - firstStart(t.holes[b].plan) || a - b);
  const plates: Plate[] = [];
  /** Je Abschnitt die Stücke, die schon einer Platte gehören: [lo, hi, Platte]. */
  const cellsAt = new Map<number, [number, number, number][]>();
  for (const hi of order) {
    const h = t.holes[hi];
    const plate: Plate = {
      hole: h,
      at: firstStart(h.plan),
      segs: [],
      lo: [],
      hi: [],
      bridge: h.lat0 <= -t.wh[h.first] && h.lat1 >= t.wh[h.first],
      shards: [],
      delay: [],
      drift: [],
      spin: [],
      phase: [],
      rims: [],
      rimOther: [],
      samples: [],
      seen: NaN,
    };
    const pi = plates.length;
    for (let s = h.first; s < h.first + h.count; s++) {
      const open = (t.edge[s] & (EDGE_OPEN_L | EDGE_OPEN_R)) !== 0;
      const rim = open ? 0 : HOLE_RIM;
      let parts: [number, number][] = [[Math.max(h.lat0, -t.wh[s] + rim), Math.min(h.lat1, t.wh[s] - rim)]];
      const taken = cellsAt.get(s) ?? [];
      for (const [lo, hi2] of taken) {
        const next: [number, number][] = [];
        for (const [a, z] of parts) {
          if (hi2 <= a || lo >= z) next.push([a, z]);
          else {
            if (lo > a) next.push([a, lo]);
            if (hi2 < z) next.push([hi2, z]);
          }
        }
        parts = next;
      }
      // Ein Stück je Abschnitt (bei den Strecken bisher immer so); das größte zählt.
      let best: [number, number] | null = null;
      for (const p of parts) if (p[1] - p[0] > 0.02 && (!best || p[1] - p[0] > best[1] - best[0])) best = p;
      if (!best) continue;
      // nur zusammenhängende Platten (lückenlose Folge von Abschnitten)
      if (plate.segs.length > 0 && t.next[plate.segs[plate.segs.length - 1]] !== s) break;
      plate.segs.push(s);
      plate.lo.push(best[0]);
      plate.hi.push(best[1]);
      taken.push([best[0], best[1], pi]);
      cellsAt.set(s, taken);
    }
    if (plate.segs.length > 0) plates.push(plate);
  }

  /** Punkt auf der Platte: x läuft über die Zellen (Zelle k von x = k bis k + 1, Mitte bei k + ½). */
  function surfK(pl: Plate, k: number, x: number, lat: number, dy = 0): V3 {
    const fr = x - k;
    const s = pl.segs[k];
    return fr < 0.5 ? P(t.prev[s], 0.5 + fr, lat, dy) : P(s, fr - 0.5, lat, dy);
  }
  /** Abschnitt (Stück der Welt), auf dem die Hälfte einer Zelle liegt. */
  const pieceOf = (pl: Plate, k: number, half: number): number => (half === 0 ? t.prev[pl.segs[k]] : pl.segs[k]);

  /** Vieleck in (x, lat) auf der Fläche als Fächer, nach oben gerichtet. */
  function topPoly(pl: Plate, k: number, poly: number[], col: RGB, dy = 0): void {
    const n = poly.length / 2;
    if (n < 3) return;
    const pts: V3[] = [];
    for (let i = 0; i < n; i++) pts.push(surfK(pl, k, poly[i * 2], poly[i * 2 + 1], dy));
    const nn = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    if (nn[1] < 0) pts.reverse();
    for (let i = 1; i + 1 < n; i++) S.mb.tri(pts[0], pts[i], pts[i + 1], col);
  }
  /** Sutherland-Hodgman in (x, lat): behält lat·sign ≥ bound·sign. */
  function clipLat(poly: number[], bound: number, sign: number): number[] {
    const out: number[] = [];
    const n = poly.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = sign * (poly[i * 2 + 1] - bound);
      const b = sign * (poly[j * 2 + 1] - bound);
      if (a >= 0) out.push(poly[i * 2], poly[i * 2 + 1]);
      if (a >= 0 !== b >= 0) {
        const k = a / (a - b);
        out.push(poly[i * 2] + (poly[j * 2] - poly[i * 2]) * k, bound);
      }
    }
    return out;
  }

  /**
   * Oberseite einer Zellhälfte zwischen low und up (je am Anfang a und Ende b der Hälfte), in den Farben
   * der Fahrbahn: Fels in zwei Tönen, Seitenstreifen außerhalb ±rh; Holz je Bohle.
   */
  function topHalf(pl: Plate, k: number, half: number, la: number, lb: number, ua: number, ub: number, plankCol: RGB | null): void {
    const xa = k + half * 0.5;
    const xb = xa + 0.5;
    const poly = [xa, la, xb, lb, xb, ub, xa, ua];
    if (plankCol) {
      if (half === 0) {
        // Fuge am Anfang der Bohle
        const f = xa + 0.1;
        topPoly(pl, k, [xa, la, f, la + (lb - la) * 0.2, f, ua + (ub - ua) * 0.2, xa, ua], WOOD_FUGE);
        topPoly(pl, k, [f, la + (lb - la) * 0.2, xb, lb, xb, ub, f, ua + (ub - ua) * 0.2], plankCol);
      } else topPoly(pl, k, poly, plankCol);
      return;
    }
    const piece = pieceOf(pl, k, half);
    const rh = t.rh[piece];
    const tone = Math.floor(piece / 3) % 2 === 0 ? ROCK_A : ROCK_B;
    topPoly(pl, k, clipLat(poly, -rh, -1), ROCK_SH);
    topPoly(pl, k, clipLat(clipLat(poly, -rh, 1), rh, -1), tone);
    topPoly(pl, k, clipLat(poly, rh, 1), ROCK_SH);
  }

  for (let pi = 0; pi < plates.length; pi++) {
    const pl = plates[pi];
    const N = pl.segs.length;
    const width = Math.max(...pl.hi.map((h, k) => h - pl.lo[k]));
    const pr = seeded(1000 + pi * 37);

    if (pl.bridge) {
      // --- Bohlen der Hängebrücke: je Abschnitt eine, bündig auf Fahrbahnhöhe ---
      for (let k = 0; k < N; k++) {
        const b = begin();
        b.heat = WOOD_HEAT;
        const s = pl.segs[k];
        const lo = pl.lo[k];
        const hi = pl.hi[k];
        const v = pr();
        const base = s % 2 === 0 ? WOOD_A : WOOD_B;
        const col = v < 0.12 ? shade(base, 1.18) : v < 0.24 ? shade(base, 0.8) : v < 0.3 ? mixRgb(base, rgb(0x8a8070), 0.35) : base;
        topHalf(pl, k, 0, lo, lo, hi, hi, col);
        topHalf(pl, k, 1, lo, lo, hi, hi, col);
        // Kanten und Unterseite
        const a0 = surfK(pl, k, k, lo);
        const a1 = surfK(pl, k, k + 1, lo);
        const b0 = surfK(pl, k, k, hi);
        const b1 = surfK(pl, k, k + 1, hi);
        const dn = (p: V3): V3 => [p[0], p[1] - PLANK, p[2]];
        const f = fwd(s);
        const r = right(s);
        face(S.mb, a0, b0, dn(b0), dn(a0), [-f[0], 0, -f[2]], WOOD_SIDE);
        face(S.mb, a1, b1, dn(b1), dn(a1), f, WOOD_SIDE);
        face(S.mb, a0, a1, dn(a1), dn(a0), [-r[0], 0, -r[2]], WOOD_SIDE);
        face(S.mb, b0, b1, dn(b1), dn(b0), r, WOOD_SIDE);
        face(S.mb, dn(a0), dn(a1), dn(b1), dn(b0), DOWN, POST_D);
        // Schein beim Bröckeln
        addFlat(surfK(pl, k, k, lo, 0.03), surfK(pl, k, k + 1, lo, 0.03), surfK(pl, k, k + 1, hi, 0.03), surfK(pl, k, k, hi, 0.03), UP, WOOD_HEAT);
        const c = surfK(pl, k, k + 0.5, (lo + hi) / 2, -PLANK / 2);
        // Kippen um eine fast quer liegende Achse
        const tilt = add(r, f, (pr() - 0.5) * 0.8);
        pl.shards.push(end(b, c, tilt));
        // Bruch läuft innerhalb des Stücks von vorn nach hinten
        pl.delay.push((k / N) * 0.12 + pr() * 0.05);
        pl.drift.push((pr() - 0.5) * 1.2);
        pl.spin.push((pr() < 0.5 ? -1 : 1) * (0.8 + pr() * 1.6));
        pl.phase.push(pr() * 6.28);
      }
      for (let k = 0; k < N; k += 3) {
        const s = pl.segs[k];
        pl.samples.push(...P(s, 0, pl.lo[k] + pr() * (pl.hi[k] - pl.lo[k]), 0.1));
      }
      continue;
    }

    // --- Schollen: nL Bänder quer, nA Stücke längs (gegeneinander versetzt) ---
    const nL = detail && width > 4.5 ? 2 : 1;
    const nA = detail ? (N >= 8 ? 3 : 2) : N >= 8 ? 3 : 2;
    // Trennlinie zwischen den Bändern: an jeder Zellgrenze eine Lage (x = k)
    const split: number[] = [];
    for (let k = 0; k <= N; k++) {
      const lo = Math.max(pl.lo[Math.max(0, k - 1)], pl.lo[Math.min(N - 1, k)]);
      const hi = Math.min(pl.hi[Math.max(0, k - 1)], pl.hi[Math.min(N - 1, k)]);
      const m = (lo + hi) / 2 + (pr() - 0.5) * 1.3;
      split.push(Math.max(lo + 0.9, Math.min(hi - 0.9, m)));
    }
    const mAt = (k: number, x: number): number => split[k] + (split[k + 1] - split[k]) * (x - k);
    const low = (band: number, k: number, x: number): number => (nL === 1 || band === 0 ? pl.lo[k] : mAt(k, x));
    const upp = (band: number, k: number, x: number): number => (nL === 1 || band === 1 ? pl.hi[k] : mAt(k, x));

    for (let band = 0; band < nL; band++) {
      // Schnitte längs: gleichmäßig, das zweite Band um einen Abschnitt versetzt
      const cuts = [0];
      for (let j = 1; j < nA; j++) cuts.push(Math.max(1, Math.min(N - 1, Math.round((N * j) / nA) + (band === 1 ? (j % 2 === 0 ? 1 : -1) : 0))));
      cuts.push(N);
      for (let j = 0; j < nA; j++) {
        const ka = cuts[j];
        const ke = cuts[j + 1];
        if (ke <= ka) continue;
        const b = begin();
        // Oberseite
        for (let k = ka; k < ke; k++) {
          topHalf(pl, k, 0, low(band, k, k), low(band, k, k + 0.5), upp(band, k, k), upp(band, k, k + 0.5), null);
          topHalf(pl, k, 1, low(band, k, k + 0.5), low(band, k, k + 1), upp(band, k, k + 0.5), upp(band, k, k + 1), null);
        }
        // Seiten und Unterseite (gerade von Zellgrenze zu Zellgrenze)
        const dn = (p: V3): V3 => [p[0], p[1] - DECK, p[2]];
        for (let k = ka; k < ke; k++) {
          const s = pl.segs[k];
          const r = right(s);
          const l0 = surfK(pl, k, k, low(band, k, k));
          const l1 = surfK(pl, k, k + 1, low(band, k, k + 1));
          const u0 = surfK(pl, k, k, upp(band, k, k));
          const u1 = surfK(pl, k, k + 1, upp(band, k, k + 1));
          face(S.mb, l0, l1, dn(l1), dn(l0), [-r[0], 0, -r[2]], ROCK_SIDE);
          face(S.mb, u0, u1, dn(u1), dn(u0), r, ROCK_SIDE);
          if (detail) face(S.mb, dn(l0), dn(l1), dn(u1), dn(u0), DOWN, ROCK_BOTTOM);
          if (k === ka) face(S.mb, l0, u0, dn(u0), dn(l0), sub([0, 0, 0], fwd(s)), ROCK_SIDE);
          if (k === ke - 1) face(S.mb, l1, u1, dn(u1), dn(l1), fwd(s), ROCK_SIDE);
        }
        // Risse: halbe Streifen an den Grenzen zu den Nachbarschollen …
        for (let k = ka; k < ke; k++) {
          const s = pl.segs[k];
          const r = right(s);
          if (nL === 2) {
            const p0 = surfK(pl, k, k, mAt(k, k), 0.02);
            const p1 = surfK(pl, k, k + 1, mAt(k, k + 1), 0.02);
            glowStrip(p0, p1, CRACK_MAX / 2, CRACK, band === 0 ? [-r[0], 0, -r[2]] : r);
          }
        }
        if (ka > 0) {
          const s = pl.segs[ka];
          const p0 = surfK(pl, ka, ka, low(band, ka, ka), 0.02);
          const p1 = surfK(pl, ka, ka, upp(band, ka, ka), 0.02);
          glowStrip(p0, p1, CRACK_MAX / 2, CRACK, fwd(s));
        }
        if (ke < N) {
          const s = pl.segs[ke - 1];
          const p0 = surfK(pl, ke - 1, ke, low(band, ke - 1, ke), 0.02);
          const p1 = surfK(pl, ke - 1, ke, upp(band, ke - 1, ke), 0.02);
          const f = fwd(s);
          glowStrip(p0, p1, CRACK_MAX / 2, CRACK, [-f[0], 0, -f[2]]);
        }
        // … und ein, zwei verästelte Risse im Innern
        const inner = detail ? 2 : 1;
        for (let c = 0; c < inner; c++) {
          let x = ka + 0.4 + pr() * (ke - ka - 0.8);
          let k = Math.min(ke - 1, Math.floor(x));
          let lat = low(band, k, x) + 0.3 + pr() * Math.max(0.1, upp(band, k, x) - low(band, k, x) - 0.6);
          let p = surfK(pl, k, x, lat, 0.022);
          const steps = 3;
          let dir = pr() < 0.5 ? -1 : 1;
          for (let st = 0; st < steps; st++) {
            const nx = Math.max(ka + 0.15, Math.min(ke - 0.15, x + dir * (0.7 + pr() * 1.1)));
            const nk = Math.min(ke - 1, Math.floor(nx));
            const nlat = Math.max(low(band, nk, nx) + 0.2, Math.min(upp(band, nk, nx) - 0.2, lat + (pr() - 0.5) * 2.4));
            const q = surfK(pl, nk, nx, nlat, 0.022);
            if (len(sub(q, p)) > 0.2) glowStrip(p, q, CRACK_MAX * (0.9 - st * 0.18), CRACK);
            x = nx;
            k = nk;
            lat = nlat;
            p = q;
            if (pr() < 0.3) dir = -dir;
          }
        }
        // Schein auf der Platte (beim Bröckeln): je Zelle ein Viereck
        for (let k = ka; k < ke; k++) {
          addFlat(
            surfK(pl, k, k, low(band, k, k), 0.03),
            surfK(pl, k, k + 1, low(band, k, k + 1), 0.03),
            surfK(pl, k, k + 1, upp(band, k, k + 1), 0.03),
            surfK(pl, k, k, upp(band, k, k), 0.03),
            UP,
            EMBER,
          );
        }
        const km = Math.min(N - 1, Math.floor((ka + ke) / 2));
        const xm = (ka + ke) / 2;
        const latm = (low(band, km, xm) + upp(band, km, xm)) / 2;
        const c = surfK(pl, km, xm, latm, -DECK / 2);
        // kippt nach außen (zur Seite, auf der die Scholle liegt) und etwas nach vorn oder hinten
        const s = pl.segs[km];
        const tiltAxis = add(fwd(s), right(s), (pr() - 0.5) * 0.9);
        pl.shards.push(end(b, c, tiltAxis));
        pl.delay.push(pr() * 0.12 + (band * 0.05));
        pl.drift.push((latm >= 0 ? 1 : -1) * (0.3 + pr() * 0.6));
        pl.spin.push((latm >= 0 ? 1 : -1) * (0.9 + pr() * 1.4));
        pl.phase.push(pr() * 6.28);
      }
    }

    // --- Ränder: Innenwände, glühende Kante, Glutschein ---
    // Kanten sammeln: [A, B, nach innen, Nachbarplatte]
    const edges: { a: V3; b: V3; n: V3; other: number }[] = [];
    const neighbor = (s: number, lat0: number, lat1: number): [number, number, number][] => {
      // Teile von [lat0, lat1], die im Abschnitt s an andere Platten bzw. an feste Fahrbahn grenzen
      const out: [number, number, number][] = [];
      let parts: [number, number, number][] = [[lat0, lat1, -1]];
      for (const [lo, hi2, owner] of cellsAt.get(s) ?? []) {
        const next: [number, number, number][] = [];
        for (const [a, z, o] of parts) {
          if (o !== -1 || hi2 <= a || lo >= z) next.push([a, z, o]);
          else {
            if (lo > a) next.push([a, lo, -1]);
            next.push([Math.max(a, lo), Math.min(z, hi2), owner]);
            if (hi2 < z) next.push([hi2, z, -1]);
          }
        }
        parts = next;
      }
      for (const p of parts) if (p[1] - p[0] > 0.02 && p[2] !== pi) out.push(p);
      return out;
    };
    for (let k = 0; k < N; k++) {
      const s = pl.segs[k];
      const r = right(s);
      const f = fwd(s);
      for (const side of [-1, 1]) {
        const lat = side < 0 ? pl.lo[k] : pl.hi[k];
        let other = -1;
        for (const [lo, hi2, owner] of cellsAt.get(s) ?? []) {
          if (owner === pi) continue;
          if ((side < 0 && Math.abs(hi2 - lat) < 0.01) || (side > 0 && Math.abs(lo - lat) < 0.01)) other = owner;
        }
        edges.push({ a: surfK(pl, k, k, lat), b: surfK(pl, k, k + 1, lat), n: side < 0 ? r : [-r[0], 0, -r[2]], other });
      }
      // Anfang der Zelle: Grenze zu prev(s), Ende: zu next(s)
      for (const [x, nb, n] of [
        [k, t.prev[s], f],
        [k + 1, t.next[s], [-f[0], 0, -f[2]]],
      ] as [number, number, V3][]) {
        for (const [la, lb, owner] of neighbor(nb, pl.lo[k], pl.hi[k])) edges.push({ a: surfK(pl, k, x, la), b: surfK(pl, k, x, lb), n, other: owner });
      }
    }
    const others = [...new Set(edges.map((e) => e.other))];
    for (const other of others) {
      // Eine Kante zu einer anderen Platte zeichnet die, die zuerst bricht.
      if (other >= 0 && (plates[other].at < pl.at || (plates[other].at === pl.at && other < pi))) continue;
      const b = begin();
      for (const e of edges) {
        if (e.other !== other) continue;
        const inset = other >= 0 ? 0.02 : 0;
        const a = add(e.a, e.n, inset);
        const bb = add(e.b, e.n, inset);
        const dn = (p: V3, d: number): V3 => [p[0], p[1] - d, p[2]];
        face(S.mb, a, bb, dn(bb, DECK), dn(a, DECK), e.n, HOLE_WALL);
        // glühende Kante, mittig auf der Bruchkante
        const h = RIM_MAX / 2;
        const lift = (p: V3): V3 => [p[0], p[1] + 0.025, p[2]];
        glowQuad(lift(add(e.a, e.n, -h)), lift(add(e.b, e.n, -h)), lift(add(e.b, e.n, h)), lift(add(e.a, e.n, h)), lift(e.a), lift(e.b), lift(e.b), lift(e.a), UP, CRACK);
        // darunter: die Wände glühen nach unten hin auf
        if (detail && other < 0) addQuad(dn(e.a, DECK), dn(e.b, DECK), dn(e.b, DECK + 4.6), dn(e.a, DECK + 4.6), e.n, BLACK, BLACK, GLOW_DEEP, GLOW_DEEP);
      }
      if (other < 0) {
        // Glutschein tief im Loch
        for (let k = 0; k < N; k++) {
          addFlat(surfK(pl, k, k, pl.lo[k], -GLOW_D), surfK(pl, k, k + 1, pl.lo[k], -GLOW_D), surfK(pl, k, k + 1, pl.hi[k], -GLOW_D), surfK(pl, k, k, pl.hi[k], -GLOW_D), UP, shade(GLOW_DEEP, 0.95));
        }
      }
      const km = N >> 1;
      pl.rims.push(end(b, surfK(pl, km, km + 0.5, (pl.lo[km] + pl.hi[km]) / 2)));
      pl.rimOther.push(other);
    }
    for (let k = 0; k < N; k += 2) {
      for (const lat of [pl.lo[k], pl.hi[k]]) pl.samples.push(...P(pl.segs[k], 0, lat, 0.1));
    }
  }

  // ============================== Hängebrücke: Seile, Böcke ==============================

  const deco = new MeshBuilder();
  const ropes: Rope[] = [];
  /** Je Abzweigung mit Brücke: Stücke (Platten-Indizes) in Fahrtrichtung. */
  const bridgePieces: number[][] = [];

  /** Balken von a nach b mit Kantenlänge w (vier Seiten, ohne Deckel) ins Netz mb. */
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
      face(mb, c(a, 1, 1), c(a, -1, 1), c(a, -1, -1), c(a, 1, -1), [-d[0], -d[1], -d[2]], col);
      face(mb, c(b, 1, 1), c(b, -1, 1), c(b, -1, -1), c(b, 1, -1), d, col);
    }
  }

  for (let bi = 0; bi < t.branches.length; bi++) {
    const pieces = plates.map((p, i) => i).filter((i) => plates[i].bridge && t.branchOf[plates[i].segs[0]] === bi);
    if (pieces.length === 0) continue;
    pieces.sort((a, b) => plates[a].segs[0] - plates[b].segs[0]);
    bridgePieces.push(pieces);
    const first = plates[pieces[0]].segs[0];
    const lastPl = plates[pieces[pieces.length - 1]];
    const last = lastPl.segs[lastPl.segs.length - 1];
    // Böcke zwei Abschnitte vor bzw. nach der Brücke
    const sA = t.prev[t.prev[first]];
    const sB = t.next[t.next[last]];
    const wh = t.wh[first];
    const pieceAtSeg = (s: number): number => {
      for (let j = 0; j < pieces.length; j++) if (plates[pieces[j]].segs.includes(s)) return j;
      return s < first ? 0 : pieces.length - 1;
    };
    const tops: V3[][] = [];
    for (const [s, dir] of [
      [sA, -1],
      [sB, 1],
    ] as [number, number][]) {
      const row: V3[] = [];
      for (const sg of [-1, 1]) {
        // Holzbock: zwei schräge Beine quer zur Fahrbahn, Riegel, Kappe
        const foot0 = P(s, 0, sg * (wh + 0.6), -10);
        const foot1 = P(s, 0, sg * (wh + 2.6), -10);
        const top = P(s, 0, sg * (wh + 1.5), 4.6);
        beam(deco, foot0, top, 0.42, POST);
        beam(deco, foot1, top, 0.42, POST);
        beam(deco, P(s, 0, sg * (wh + 0.95), 2.4), P(s, 0, sg * (wh + 2.15), 2.4), 0.3, POST_D, true);
        beam(deco, P(s, 0, sg * (wh + 0.75), -0.6), P(s, 0, sg * (wh + 2.35), -0.6), 0.3, POST_D, true);
        boxT(deco, (x, y, z) => add(add(top, right(s), x), [t.tx[s] * z, y, t.tz[s] * z]), -0.45, 0.45, -0.1, 0.5, -0.4, 0.4, POST_D, { top: POST });
        // Halteseil nach hinten ins Gelände, mit Ankerblock
        const anchorSeg = (() => {
          let a = s;
          for (let i = 0; i < 9; i++) a = dir < 0 ? t.prev[a] : t.next[a];
          return a;
        })();
        const anchor = P(anchorSeg, 0, sg * (wh + 3.2), -0.5);
        beam(deco, top, anchor, 0.1, ROPE_D);
        boxT(deco, (x, y, z) => [anchor[0] + x, anchor[1] + y, anchor[2] + z], -0.5, 0.5, -1.2, 0.35, -0.5, 0.5, rgb(0x4b3f50));
        row.push(top);
      }
      tops.push(row);
    }
    tris += 0; // (Feststehendes wird unten gezählt)

    // Tragseile: Durchhang unter dem Deck, von Bock zu Bock
    const segIds: number[] = [];
    for (let s = sA; ; s = t.next[s]) {
      segIds.push(s);
      if (s === sB || segIds.length > 400) break;
    }
    const L = segIds.length - 1;
    const SAG = 3.6;
    const linkStep = 3;
    for (const sg of [-1, 1]) {
      const lat = sg * (wh - 0.45);
      const pts: V3[] = [];
      for (let i = 0; i <= L; i += linkStep) {
        const u = i / L;
        pts.push(P(segIds[i], 0, lat, -0.35 - SAG * 4 * u * (1 - u)));
      }
      if ((L % linkStep) !== 0) pts.push(P(segIds[L], 0, lat, -0.35));
      const ancA = pts[0];
      const ancB = pts[pts.length - 1];
      const latAxis = right(segIds[L >> 1]);
      // Enden, die nach dem Bruch am Bock baumeln: Winkel, der die Sehne senkrecht stellt
      const dangleAngle = (pivot: V3, endPt: V3): number => {
        const c = sub(endPt, pivot);
        const lc = len(c);
        let best = 0;
        let bestErr = Infinity;
        for (const sgn of [-1, 1]) {
          const th = sgn * Math.acos(Math.max(-1, Math.min(1, -c[1] / lc)));
          const rot = rotate(c, latAxis, th);
          const err = Math.hypot(rot[0], rot[2]);
          if (err < bestErr) {
            bestErr = err;
            best = th;
          }
        }
        return best;
      };
      // Stück je Glied: nach der Mitte des Glieds
      const linkPiece: number[] = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const si = Math.min(L, i * linkStep + (linkStep >> 1));
        linkPiece.push(pieceAtSeg(segIds[si]));
      }
      const firstEnd = linkPiece.lastIndexOf(0) + 1;
      const lastStart = linkPiece.indexOf(pieces.length - 1);
      const angA = dangleAngle(ancA, pts[Math.max(1, firstEnd)]);
      const angB = dangleAngle(ancB, pts[Math.max(0, lastStart)]);
      for (let i = 0; i + 1 < pts.length; i++) {
        const b = begin();
        beam(S.mb, pts[i], pts[i + 1], 0.13, ROPE);
        const pc = linkPiece[i];
        const isA = pc === 0;
        const isB = pc === pieces.length - 1;
        const pivot = isA ? ancA : isB ? ancB : lerp3(pts[i], pts[i + 1], 0.5);
        const body = end(b, pivot, latAxis);
        ropes.push({ body, piece: pc, u: (i + 0.5) / (pts.length - 1), mode: isA || isB ? 1 : 0, dangle: isA ? angA : angB, phase: sg * 0.4 });
      }
      // Hänger vom Deck zum Seil, alle 4 Abschnitte
      for (let i = 2; i < L - 1; i += 4) {
        const s = segIds[i];
        const pc = pieceAtSeg(s);
        if (s === sA || s === sB) continue;
        const u = i / L;
        const top = P(s, 0, lat, -PLANK);
        const bot = P(s, 0, lat, -0.35 - SAG * 4 * u * (1 - u));
        if (top[1] - bot[1] < 0.3) continue;
        const b = begin();
        beam(S.mb, top, bot, 0.09, ROPE_D);
        ropes.push({ body: end(b, top, right(s)), piece: pc, u, mode: 0, dangle: 0, phase: sg * 0.4 + u });
      }
      // Halteseile von den Bockköpfen schräg zur Deckkante (baumeln nach dem Bruch)
      for (const [top, s, pc] of [
        [tops[0][sg < 0 ? 0 : 1], segIds[Math.min(L, 12)], 0],
        [tops[1][sg < 0 ? 0 : 1], segIds[Math.max(0, L - 12)], pieces.length - 1],
      ] as [V3, number, number][]) {
        const deckPt = P(s, 0, sg * (wh - 0.05), -0.12);
        const b = begin();
        beam(S.mb, top, deckPt, 0.1, ROPE);
        ropes.push({ body: end(b, top, latAxis), piece: pc, u: 0.5, mode: 1, dangle: dangleAngle(top, deckPt), phase: sg });
      }
    }
  }

  /** Dreht v um die Einheitsachse k (Rodrigues). */
  function rotate(v: V3, k: V3, th: number): V3 {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const kv = cross(k, v);
    const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    return [v[0] * c + kv[0] * s + k[0] * d * (1 - c), v[1] * c + kv[1] * s + k[1] * d * (1 - c), v[2] * c + kv[2] * s + k[2] * d * (1 - c)];
  }

  // ============================== Tore ==============================

  interface GateView {
    gate: Gate;
    branch: Branch;
    /** true: Lavazunge (geht auf), false: Felssturz (geht zu). */
    opens: boolean;
    mesh: THREE.Mesh;
    mat: THREE.MeshToonMaterial;
    glow: Body | null;
    /** Höhe der Zunge (so weit sinkt sie). */
    sink: number;
    /** für Staub beim Aufschlag */
    dust: number[];
    seen: number;
    /** Lampen der beiden Wegweiser: erste Ecke und Anzahl im Lampennetz; Kreuz ebenso. */
    lamps: [number, number][];
    crosses: [number, number][];
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

  /**
   * Wegweiser: Tafel mit Pfeil zur Abzweigung, darüber die Ampel. origin = Fuß (Fahrbahnhöhe),
   * W = Blickrichtung der Tafel (zu den Fahrern), side = Seite der Abzweigung.
   */
  function signpost(origin: V3, W: V3, side: number): [[number, number], [number, number]] {
    const V = UP;
    const U = norm(cross(V, W));
    const T: Xform = (x, y, z) => [origin[0] + U[0] * x + W[0] * z, origin[1] + y, origin[2] + U[2] * x + W[2] * z];
    // Pfosten bis tief ins Gelände
    boxT(deco, T, -1.85, -1.55, -9, 4.7, -0.32, -0.08, POST_D);
    boxT(deco, T, 1.55, 1.85, -9, 4.7, -0.32, -0.08, POST_D);
    // Tafel und Rahmen
    boxT(deco, T, -2.3, 2.3, 1.9, 4.7, -0.08, 0.06, BOARD);
    boxT(deco, T, -2.3, 2.3, 4.55, 4.75, 0.06, 0.14, FRAME, { noBottom: true });
    boxT(deco, T, -2.3, 2.3, 1.85, 2.05, 0.06, 0.14, FRAME, { noBottom: true });
    boxT(deco, T, -2.3, -2.1, 2.05, 4.55, 0.06, 0.14, FRAME, { noBottom: true });
    boxT(deco, T, 2.1, 2.3, 2.05, 4.55, 0.06, 0.14, FRAME, { noBottom: true });
    // Pfeil schräg nach oben zur Seite der Abzweigung
    const ang = (side > 0 ? 1 : -1) * 0.62;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const q = (a: number, b: number): V3 => {
      // a: entlang des Pfeils (nach oben gedreht), b: quer
      const x = -sa * a + ca * b;
      const y = ca * a + sa * b;
      return T(x * (side > 0 ? -1 : 1) * -1, 3.25 + y, 0.16);
    };
    face(deco, q(-1.05, -0.24), q(0.3, -0.24), q(0.3, 0.24), q(-1.05, 0.24), W, ARROW);
    const h0 = q(0.3, -0.62);
    const h1 = q(1.15, 0);
    const h2 = q(0.3, 0.62);
    const n = cross(sub(h1, h0), sub(h2, h0));
    if (n[0] * W[0] + n[2] * W[2] >= 0) deco.tri(h0, h1, h2, ARROW);
    else deco.tri(h0, h2, h1, ARROW);
    // Gehäuse der Ampel
    boxT(deco, T, -0.95, 0.95, 4.75, 6.55, -0.2, 0.2, HOUSING);
    boxT(deco, T, -0.95, 0.95, 6.45, 6.6, 0.2, 0.55, HOUSING, { noBottom: false });
    // Lampe (Achteck) und Kreuz im Lampennetz
    const l0 = lampMb.triangles * 3;
    const C = T(0, 5.65, 0.22);
    for (let i = 0; i < 8; i++) {
      const a0 = ((i + 0.5) / 8) * Math.PI * 2;
      const a1 = ((i + 1.5) / 8) * Math.PI * 2;
      const p0 = T(Math.cos(a0) * 0.78, 5.65 + Math.sin(a0) * 0.78, 0.22);
      const p1 = T(Math.cos(a1) * 0.78, 5.65 + Math.sin(a1) * 0.78, 0.22);
      const nn = cross(sub(p0, C), sub(p1, C));
      if (nn[0] * W[0] + nn[2] * W[2] >= 0) lampMb.tri(C, p0, p1, [1, 1, 1]);
      else lampMb.tri(C, p1, p0, [1, 1, 1]);
    }
    const l1 = lampMb.triangles * 3;
    const c0 = lampMb.triangles * 3;
    for (const sgn of [-1, 1]) {
      const d: V3 = norm([1.95, sgn * 1.15, 0]);
      const pr: V3 = [-d[1], d[0], 0];
      const w = 0.26;
      const corner = (k: number, s2: number): V3 => T(d[0] * 1.95 * k + pr[0] * w * s2, 3.25 + d[1] * 1.95 * k + pr[1] * w * s2, 0.2);
      face(lampMb, corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), W, [1, 1, 1]);
    }
    const c1 = lampMb.triangles * 3;
    return [
      [l0, l1 - l0],
      [c0, c1 - c0],
    ];
  }

  for (const g of t.gates) {
    const bi = t.branchOf[g.first];
    if (bi < 0) continue;
    const br = t.branches[bi];
    const side = br.side;
    const opens = planActive(g.plan, 0) || planActive(g.plan, -1);
    // Hauptstrecke, so weit Abzweigung und Hauptstrecke ineinander liegen
    let mMin = -1;
    let mMax = -1;
    for (let k = g.first; k < g.first + g.count; k++) {
      const m = t.twin[k];
      if (m < 0) continue;
      if (mMin < 0 || t.prog[m] < t.prog[mMin]) mMin = m;
      if (mMax < 0 || t.prog[m] > t.prog[mMax]) mMax = m;
    }
    if (mMin < 0) continue;
    const mats = toonMaterial({ vertexColors: true });
    disposables.push(mats);
    const mb = new MeshBuilder();
    let glow: Body | null = null;
    let sinkH = 0;
    const dust: number[] = [];
    const gr = seeded(500 + bi * 71);

    if (opens) {
      // --- Lavazunge: quillt aus der Röhre über die Mündung und endet an der Bandenlinie ---
      // Bandenlinie der Hauptstrecke als Polylinie
      const line: V3[] = [];
      for (let m = t.prev[t.prev[mMin]], i = 0; i < 400; i++, m = t.next[m]) {
        line.push(P(m, 0, side * t.wh[m]));
        if (m === t.next[t.next[t.next[mMax]]]) break;
      }
      /** Seitliche Lage (auf der Abzweigung k), an der deren Querlinie die Bandenlinie schneidet – oder NaN. */
      const cut = (k: number): number => {
        const cx = t.px[k];
        const cz = t.pz[k];
        const rx = rightX(t, k);
        const rz = rightZ(t, k);
        for (let i = 0; i + 1 < line.length; i++) {
          const ax = line[i][0];
          const az = line[i][2];
          const dx = line[i + 1][0] - ax;
          const dz = line[i + 1][2] - az;
          // cx + rx·λ = ax + dx·μ ; cz + rz·λ = az + dz·μ
          const det = rx * -dz - rz * -dx;
          if (Math.abs(det) < 1e-9) continue;
          const bx = ax - cx;
          const bz = az - cz;
          const lam = (bx * -dz - bz * -dx) / det;
          const mu = (rx * bz - rz * bx) / det;
          if (mu >= -1e-6 && mu <= 1 + 1e-6 && Math.abs(lam) < 40) return lam;
        }
        return NaN;
      };
      const endK = Math.min(br.first + br.count - 1, g.first + g.count + 4);
      const COLS = 6;
      interface Row {
        k: number;
        front: number;
        lats: number[];
        hs: number[];
        hf: number;
      }
      const rows: Row[] = [];
      for (let k = g.first; k <= endK; k++) {
        const wh = t.wh[k];
        const m = k - br.first;
        const c = cut(k);
        let front: number;
        if (t.twin[k] >= 0 && !Number.isNaN(c)) front = -side * Math.max(-wh - 0.3, Math.min(wh + 1, -side * c));
        else front = -side * (wh + 0.3);
        // Lage zur Mündung hin gemessen (Seite der Hauptstrecke = −side): front liegt auf dieser Seite
        const far = side * (wh + 0.3);
        if ((far - front) * side < 0.7) continue;
        const base = m < 44 ? 1.75 : m > 53 ? 0.45 : 1.75 + (0.45 - 1.75) * smooth((m - 44) / 9);
        const lats: number[] = [];
        const hs: number[] = [];
        for (let j = 0; j <= COLS; j++) {
          const u = j / COLS;
          const lat = front + side * 0.35 + (far - front - side * 0.35) * u;
          lats.push(lat);
          const n = noise(k * 0.31 + 7, j * 1.7 + bi * 5);
          hs.push(j === COLS ? base * 0.7 : base * (0.78 + 0.4 * n) + (j === 0 ? 0.18 : 0));
        }
        rows.push({ k, front, lats, hs, hf: hs[0] + 0.05 });
      }
      sinkH = 2.4;
      const gb = begin();
      for (let i = 0; i + 1 < rows.length; i++) {
        const r0 = rows[i];
        const r1 = rows[i + 1];
        if (r1.k !== t.next[r0.k]) continue;
        const toMain: V3 = (() => {
          const r = right(r0.k);
          return [-side * r[0], 0, -side * r[2]];
        })();
        // Front: unten glühend, oben Kruste
        const f0b = P(r0.k, 0, r0.front, -0.6);
        const f1b = P(r1.k, 0, r1.front, -0.6);
        const f0m = P(r0.k, 0, r0.front, 0.55);
        const f1m = P(r1.k, 0, r1.front, 0.55);
        const f0t = P(r0.k, 0, r0.front, r0.hf);
        const f1t = P(r1.k, 0, r1.front, r1.hf);
        face(mb, f0b, f1b, f1m, f0m, toMain, LAVA);
        face(mb, f0m, f1m, f1t, f0t, toMain, CRUST_HOT);
        // Lippe zur ersten Spalte
        face(mb, f0t, f1t, P(r1.k, 0, r1.lats[0], r1.hs[0]), P(r0.k, 0, r0.lats[0], r0.hs[0]), UP, CRUST_HOT);
        // Kruste
        for (let j = 0; j < COLS; j++) {
          const m = r0.k - br.first;
          const col = m >= 50 ? (j % 2 === 0 ? LAVA : LAVA_HI) : (r0.k + j) % 3 === 0 ? CRUST_B : CRUST;
          face(mb, P(r0.k, 0, r0.lats[j], r0.hs[j]), P(r1.k, 0, r1.lats[j], r1.hs[j]), P(r1.k, 0, r1.lats[j + 1], r1.hs[j + 1]), P(r0.k, 0, r0.lats[j + 1], r0.hs[j + 1]), UP, col);
        }
        // Leuchtlinie am Fuß der Front
        const gl0 = P(r0.k, 0, r0.front - side * 0.03, 0.25);
        const gl1 = P(r1.k, 0, r1.front - side * 0.03, 0.25);
        glowQuad(gl0, gl1, add(gl1, UP, 0.5), add(gl0, UP, 0.5), gl0, gl1, gl1, gl0, toMain, LAVA_HI);
        // glühende Risse quer über die Kruste
        if ((r0.k - br.first) % 4 === 0 && r0.k - br.first < 50) {
          for (let j = 0; j < COLS; j++) {
            const a = P(r0.k, 0, r0.lats[j], r0.hs[j] + 0.04);
            const z = P(r1.k, 0, r0.lats[j + 1], r1.hs[j + 1] + 0.04);
            glowStrip(j % 2 === 0 ? a : P(r1.k, 0, r1.lats[j], r1.hs[j] + 0.04), j % 2 === 0 ? z : P(r0.k, 0, r0.lats[j + 1], r0.hs[j + 1] + 0.04), 0.22, LAVA);
          }
        }
        // im Tunnelmund: offene, glühende Lava
        if (r0.k - br.first >= 50) {
          const l = (p: V3): V3 => [p[0], p[1] + 0.03, p[2]];
          for (let j = 0; j < COLS; j++) {
            const a = l(P(r0.k, 0, r0.lats[j], r0.hs[j]));
            const b2 = l(P(r1.k, 0, r1.lats[j], r1.hs[j]));
            const c2 = l(P(r1.k, 0, r1.lats[j + 1], r1.hs[j + 1]));
            const d2 = l(P(r0.k, 0, r0.lats[j + 1], r0.hs[j + 1]));
            glowQuad(a, b2, c2, d2, a, b2, c2, d2, UP, (r0.k + j) % 2 === 0 ? LAVA : LAVA_HI);
          }
        }
        if (i % 3 === 0) dust.push(...P(r0.k, 0, r0.front, 1));
      }
      // Stirn am Anfang der Zunge
      if (rows.length > 0) {
        const r = rows[0];
        const f = fwd(r.k);
        const back: V3 = [-f[0], 0, -f[2]];
        for (let j = 0; j < COLS; j++) face(mb, P(r.k, 0, r.lats[j], -0.6), P(r.k, 0, r.lats[j + 1], -0.6), P(r.k, 0, r.lats[j + 1], r.hs[j + 1]), P(r.k, 0, r.lats[j], r.hs[j]), back, CRUST_HOT);
        face(mb, P(r.k, 0, r.front, -0.6), P(r.k, 0, r.lats[0], -0.6), P(r.k, 0, r.lats[0], r.hs[0]), P(r.k, 0, r.front, r.hf), back, CRUST_HOT);
      }
      const mid = rows.length > 0 ? P(rows[rows.length >> 1].k, 0, 0) : P(g.first, 0, 0);
      glow = end(gb, mid);
    } else {
      // --- Felssturz mit rot-weißer Schranke auf der Bandenlinie ---
      const segs: number[] = [];
      for (let m = mMin, i = 0; i < 400; i++, m = t.next[m]) {
        segs.push(m);
        if (m === mMax) break;
      }
      const ico = new THREE.IcosahedronGeometry(1, 0);
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      let acc = 0;
      for (let i = 0; i < segs.length; i++) {
        const m = segs[i];
        acc += 1;
        if (acc < 1.7 && i !== segs.length - 1) continue;
        acc = 0;
        const sz = 1.05 + gr() * 0.45;
        const p = P(m, 0, side * (t.wh[m] + sz * 0.85), sz * 0.55);
        e.set(gr() * 3, gr() * 3, gr() * 3);
        q.setFromEuler(e);
        mtx.compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(sz, sz * (0.8 + gr() * 0.3), sz * (0.9 + gr() * 0.3)));
        mb.add(ico, gr() < 0.5 ? BOULDER : BOULDER_B, mtx);
        if (i % 4 === 0) dust.push(p[0], p[1], p[2]);
      }
      ico.dispose();
      // Schranke: rot-weiße Stücke von je 2 m auf der Bandenlinie, Pfosten alle 6 m
      for (let i = 0; i + 2 < segs.length; i += 2) {
        const a = P(segs[i], 0, side * (t.wh[segs[i]] - 0.05), 1.05);
        const b = P(segs[i + 2], 0, side * (t.wh[segs[i + 2]] - 0.05), 1.05);
        beam(mb, a, b, 0.34, (i >> 1) % 2 === 0 ? RED : WHITE);
        if (i % 6 === 0) beam(mb, P(segs[i], 0, side * (t.wh[segs[i]] + 0.05), -0.3), add(a, UP, 0.1), 0.2, rgb(0x3a3440));
      }
      // Baken an der Spitze und in der Mitte, schräg zum Verkehr
      for (const i of [1, Math.floor(segs.length / 2)]) {
        const m = segs[Math.min(segs.length - 1, i)];
        const r = right(m);
        const f = fwd(m);
        const c = P(m, 0, side * (t.wh[m] - 0.1), 0);
        const d = norm(add(f, r, side * 0.9));
        const out = norm(add([-f[0], 0, -f[2]], r, -side * 0.5));
        const a0 = add(add(c, d, -1.3), UP, 0.5);
        const a1 = add(add(c, d, 1.3), UP, 0.5);
        stripedFace(mb, a0, a1, add(a1, UP, 1.3), add(a0, UP, 1.3), out, RED, WHITE, 0.32);
        stripedFace(mb, a1, a0, add(a0, UP, 1.3), add(a1, UP, 1.3), [-out[0], 0, -out[2]], RED, WHITE, 0.32);
        beam(mb, add(c, d, -1.1), add(add(c, d, -1.1), UP, 0.55), 0.14, rgb(0x3a3440));
        beam(mb, add(c, d, 1.1), add(add(c, d, 1.1), UP, 0.55), 0.14, rgb(0x3a3440));
      }
    }
    const geo = mb.build();
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.name = 'sperre';
    mesh.userData.gate = t.gates.indexOf(g);
    if (detail) withOutline(mesh, 0.05);
    tris += mb.triangles * (detail ? 2 : 1);
    group.add(mesh);

    // Wegweiser: etwa 35 m vor der Gabelung neben der Bande …
    let m0 = br.from;
    for (let i = 0; i < 35; i++) m0 = t.prev[m0];
    const sA = signpost(P(m0, 0, side * (t.wh[m0] + 2.3)), norm(add([-t.tx[m0], 0, -t.tz[m0]], right(m0), -side * 0.28)), side);
    // … und im Keil zwischen den Fahrbahnen
    let wedge: V3 | null = null;
    let wm = br.from;
    for (let k = br.first; k < br.first + br.count && !wedge; k++) {
      wm = nearestMain(t.px[k], t.pz[k], br.from, 220);
      const me = P(wm, 0, side * (t.wh[wm] + 0.6));
      const be = P(k, 0, -side * (t.wh[k] + 0.6));
      const latB = (be[0] - t.px[wm]) * rightX(t, wm) * side + (be[2] - t.pz[wm]) * rightZ(t, wm) * side;
      if (latB > t.wh[wm] + 0.6 && Math.hypot(me[0] - be[0], me[2] - be[2]) >= 3.6) wedge = lerp3(me, be, 0.5);
    }
    const lamps: [number, number][] = [sA[0]];
    const crosses: [number, number][] = [sA[1]];
    if (wedge) {
      const sB = signpost([wedge[0], Math.min(wedge[1], t.py[wm]), wedge[2]], norm(add([-t.tx[wm], 0, -t.tz[wm]], right(wm), -side * 0.22)), side);
      lamps.push(sB[0]);
      crosses.push(sB[1]);
    }
    gates.push({ gate: g, branch: br, opens, mesh, mat: mats, glow, sink: sinkH, dust, seen: NaN, lamps, crosses });
  }

  // ============================== Netze bauen ==============================

  /** Macht aus dem Bauplan eines Netzes die beweglichen Puffer. */
  function finish(L: Layer, normals: boolean): THREE.BufferGeometry {
    const geo = L.mb.build();
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    L.pos = pos.array as Float32Array;
    L.rest = L.pos.slice();
    L.col = col.array as Float32Array;
    L.base = L.col.slice();
    pos.setUsage(THREE.DynamicDrawUsage);
    col.setUsage(THREE.DynamicDrawUsage);
    L.posAttr = pos;
    L.colAttr = col;
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
    if (normals) {
      L.nor = nor.array as Float32Array;
      L.restN = L.nor.slice();
      nor.setUsage(THREE.DynamicDrawUsage);
      L.norAttr = nor;
    }
    // Hülle: alles, was sich bewegt, bleibt in dieser Kugel (auch die Stelle, an der Verborgenes liegt).
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius += 60;
    disposables.push(geo);
    return geo;
  }
  const solidGeo = finish(S, true);
  const glowGeo = finish(G, false);
  const addGeo = finish(A, false);
  // Glutschein: Farben je Ecke
  if (addCols.length === A.base.length) {
    A.base.set(addCols);
    A.col.set(addCols);
  }
  const solidMat = toonMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const addMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  disposables.push(solidMat, glowMat, addMat);
  const solidMesh = new THREE.Mesh(solidGeo, solidMat);
  solidMesh.name = 'platten';
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.name = 'leuchtlinien';
  const addMesh = new THREE.Mesh(addGeo, addMat);
  addMesh.name = 'glutschein';
  addMesh.renderOrder = 2;
  group.add(solidMesh, glowMesh, addMesh);
  tris += S.mb.triangles + G.mb.triangles + A.mb.triangles;

  // Feststehendes: Böcke, Halteseile, Wegweiser
  if (!deco.empty) {
    const geo = deco.build();
    const mat = toonMaterial({ vertexColors: true });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'wegweiser';
    if (detail) withOutline(mesh, 0.05);
    tris += deco.triangles * (detail ? 2 : 1);
    group.add(mesh);
  }
  // Lampen und Kreuze
  const lampGeo = lampMb.build();
  const lampPos = lampGeo.getAttribute('position') as THREE.BufferAttribute;
  const lampCol = lampGeo.getAttribute('color') as THREE.BufferAttribute;
  lampPos.setUsage(THREE.DynamicDrawUsage);
  lampCol.setUsage(THREE.DynamicDrawUsage);
  const lampRest = (lampPos.array as Float32Array).slice();
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(lampGeo, lampMat);
  const lampMesh = new THREE.Mesh(lampGeo, lampMat);
  lampMesh.name = 'ampeln';
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
    if (par[0] > 0) {
      // verborgen: alle Ecken auf einen Punkt tief unten
      for (const [L, a, z] of [
        [S, b.s0, b.s1],
        [G, b.g0, b.g1],
        [A, b.a0, b.a1],
      ] as [Layer, number, number][]) {
        for (let v = a; v < z; v++) {
          L.pos[v * 3] = b.px;
          L.pos[v * 3 + 1] = b.py - 40;
          L.pos[v * 3 + 2] = b.pz;
        }
        dirty(L, a, z);
      }
      return;
    }
    const dx = par[1];
    const dy = par[2];
    const dz = par[3];
    const ang = par[4];
    // Drehmatrix um (ax, ay, az)
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
    const ox = b.px + dx;
    const oy = b.py + dy;
    const oz = b.pz + dz;
    // Toon-Flächen
    const heat = par[5];
    const hc = b.heat;
    for (let v = b.s0; v < b.s1; v++) {
      const i = v * 3;
      const rx = S.rest[i] - b.px;
      const ry = S.rest[i + 1] - b.py;
      const rz = S.rest[i + 2] - b.pz;
      S.pos[i] = ox + M[0] * rx + M[1] * ry + M[2] * rz;
      S.pos[i + 1] = oy + M[3] * rx + M[4] * ry + M[5] * rz;
      S.pos[i + 2] = oz + M[6] * rx + M[7] * ry + M[8] * rz;
      const n = S.restN!;
      const nx = n[i];
      const ny = n[i + 1];
      const nz = n[i + 2];
      S.nor![i] = M[0] * nx + M[1] * ny + M[2] * nz;
      S.nor![i + 1] = M[3] * nx + M[4] * ny + M[5] * nz;
      S.nor![i + 2] = M[6] * nx + M[7] * ny + M[8] * nz;
      S.col[i] = S.base[i] + (hc[0] - S.base[i]) * heat;
      S.col[i + 1] = S.base[i + 1] + (hc[1] - S.base[i + 1]) * heat;
      S.col[i + 2] = S.base[i + 2] + (hc[2] - S.base[i + 2]) * heat;
    }
    dirty(S, b.s0, b.s1);
    // Leuchtlinien: Breite um die Mittellinie, dann bewegen; Farbe heller bis weißglühend
    const wf = par[6];
    const gB = par[7];
    const gH = par[8];
    const cen = G.center;
    for (let v = b.g0; v < b.g1; v++) {
      const i = v * 3;
      const px = cen[i] + (G.rest[i] - cen[i]) * wf - b.px;
      const py = cen[i + 1] + (G.rest[i + 1] - cen[i + 1]) * wf - b.py;
      const pz = cen[i + 2] + (G.rest[i + 2] - cen[i + 2]) * wf - b.pz;
      G.pos[i] = ox + M[0] * px + M[1] * py + M[2] * pz;
      G.pos[i + 1] = oy + M[3] * px + M[4] * py + M[5] * pz;
      G.pos[i + 2] = oz + M[6] * px + M[7] * py + M[8] * pz;
      G.col[i] = G.base[i] * gB + (HOT[0] - G.base[i] * gB) * gH;
      G.col[i + 1] = G.base[i + 1] * gB + (HOT[1] - G.base[i + 1] * gB) * gH;
      G.col[i + 2] = G.base[i + 2] * gB + (HOT[2] - G.base[i + 2] * gB) * gH;
    }
    dirty(G, b.g0, b.g1);
    // Glutschein
    const aB = par[9];
    for (let v = b.a0; v < b.a1; v++) {
      const i = v * 3;
      const rx = A.rest[i] - b.px;
      const ry = A.rest[i + 1] - b.py;
      const rz = A.rest[i + 2] - b.pz;
      A.pos[i] = ox + M[0] * rx + M[1] * ry + M[2] * rz;
      A.pos[i + 1] = oy + M[3] * rx + M[4] * ry + M[5] * rz;
      A.pos[i + 2] = oz + M[6] * rx + M[7] * ry + M[8] * rz;
      A.col[i] = A.base[i] * aB;
      A.col[i + 1] = A.base[i + 1] * aB;
      A.col[i + 2] = A.base[i + 2] * aB;
    }
    dirty(A, b.a0, b.a1);
  }

  function setPar(hidden: number, dx: number, dy: number, dz: number, ang: number, heat: number, wf: number, gB: number, gH: number, aB: number): void {
    par[0] = hidden;
    par[1] = dx;
    par[2] = dy;
    par[3] = dz;
    par[4] = ang;
    par[5] = heat;
    par[6] = wf;
    par[7] = gB;
    par[8] = gH;
    par[9] = aB;
  }

  /** Puls beim Bröckeln: wird immer schneller (Sekunden seit Beginn der Warnung). */
  const pulseAt = (tw: number, phase: number): number => 0.5 + 0.5 * Math.sin(2 * Math.PI * (1.0 * tw + 0.9 * tw * tw) + phase);

  function upload(L: Layer): void {
    if (L.hi < 0) return;
    for (const attr of [L.posAttr, L.colAttr, L.norAttr]) {
      if (!attr) continue;
      attr.clearUpdateRanges();
      attr.addUpdateRange(L.lo * 3, (L.hi - L.lo) * 3);
      attr.needsUpdate = true;
    }
    L.lo = Infinity;
    L.hi = -1;
  }

  /** Alles, was zu sehen ist, für die Rennzeit time (Ticks). */
  function refresh(time: number, cam: THREE.Vector3 | null, fx: FxSink | null, dt: number): void {
    // --- Platten und Bohlen ---
    for (let pi = 0; pi < plates.length; pi++) {
      const pl = plates[pi];
      const h = pl.hole;
      const until = planUntil(h.plan, time);
      const since = planSince(h.plan, time);
      const broken = since >= 0;
      const crumble = !broken && until <= h.warn;
      const u = crumble ? 1 - until / h.warn : broken ? 1 : 0;
      const tw = crumble ? (h.warn - until) / 60 : 0;
      const sec = broken ? since / 60 : 0;
      const depth = pl.bridge ? FALL_GORGE : FALL_PIT;
      for (let i = 0; i < pl.shards.length; i++) {
        const b = pl.shards[i];
        const ph = pl.phase[i];
        if (!crumble && !broken) {
          setPar(0, 0, 0, 0, 0, 0, CRACK_THIN / CRACK_MAX, 0.42, 0, 0);
        } else if (crumble) {
          const p = pulseAt(tw, ph * 0.2);
          const jig = Math.sin(2 * Math.PI * (1.7 * tw + 1.6 * tw * tw) + ph);
          if (pl.bridge) {
            // Bohlen klappern: auf und ab, höchstens 3 cm
            setPar(0, 0, 0.028 * u * jig, 0, 0, (0.3 + 0.35 * p) * u, 1, 1, 0, u * (0.1 + 0.3 * p));
          } else {
            const heat = 0.2 * u + 0.5 * smooth(u) + 0.25 * u * p;
            const wf = (CRACK_THIN + 0.26 * smooth(u) + 0.04 * p * u) / CRACK_MAX;
            // ruckelt nach unten (höchstens 3 cm samt Kippen)
            setPar(0, 0, -0.018 * u * (0.5 + 0.5 * jig), 0, 0.003 * u * Math.sin(ph + 7 * tw * (1 + tw)), heat, wf, 0.55 + 0.45 * u, u * (0.2 + 0.5 * p), u * (0.15 + 0.45 * p));
          }
        } else {
          const tau = sec - pl.delay[i];
          if (tau <= 0) setPar(0, 0, pl.bridge ? 0 : -0.018, 0, 0, pl.bridge ? 0.6 : 0.95, 1, 1, 0.6, 0.6);
          else {
            const drop = 0.5 * GRAV * tau * tau;
            if (drop > depth) setPar(1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            else {
              const s = pl.segs[0];
              const d = pl.drift[i] * tau;
              const rx = rightX(t, s);
              const rz = rightZ(t, s);
              const ang = pl.spin[i] * tau * (0.6 + tau);
              setPar(0, rx * d, -drop, rz * d, ang, pl.bridge ? 0.4 : 0.95 - 0.35 * Math.min(1, tau), 1, 1, 0.5 * Math.max(0, 1 - tau), Math.max(0, 1 - tau / 0.5) * 0.7);
            }
          }
        }
        apply(b);
      }
      // Ränder
      for (let i = 0; i < pl.rims.length; i++) {
        const other = pl.rimOther[i];
        if (other >= 0 && planActive(plates[other].hole.plan, time)) setPar(1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        else if (broken) setPar(0, 0, 0, 0, 0, 0, RIM_HOLE / RIM_MAX, 1, 0.55, Math.min(1, since / 40));
        else if (crumble) {
          const p = pulseAt(tw, 0);
          setPar(0, 0, 0, 0, 0, 0, (RIM_THIN + 0.11 * u) / RIM_MAX, 0.5 + 0.5 * u, 0.35 * u * p, 0);
        } else setPar(0, 0, 0, 0, 0, 0, RIM_THIN / RIM_MAX, 0.45, 0, 0);
        apply(pl.rims[i]);
      }
      // Teilchen: Staub und Funken beim Bröckeln, ein Schwall beim Bruch (nur mit Zierde, in Kameranähe)
      if (fx && cam && detail && pl.samples.length > 0) {
        const sx = pl.samples[0];
        const sz = pl.samples[2];
        const near = (sx - cam.x) ** 2 + (sz - cam.z) ** 2 < 150 * 150;
        const prev = pl.seen;
        if (near && crumble && dt > 0) {
          const n = pl.samples.length / 3;
          const rate = (pl.bridge ? 6 : 14) * u * dt;
          let count = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
          while (count-- > 0) {
            const k = Math.floor(Math.random() * n) * 3;
            const x = pl.samples[k];
            const y = pl.samples[k + 1];
            const z = pl.samples[k + 2];
            if (pl.bridge) fx.puff(x, y, z, (Math.random() - 0.5) * 1.5, 0.6, (Math.random() - 0.5) * 1.5, 0.5, 0.35, 0x9a7a52, 0.6, 2);
            else if (Math.random() < 0.5) fx.puff(x, y, z, (Math.random() - 0.5) * 1.2, 0.9, (Math.random() - 0.5) * 1.2, 0.7, 0.55, 0x5a4a58, 0.9, -0.2);
            else fx.spark(x, y, z, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 0.5, 0.18, 0xffa040, 12);
          }
        }
        if (near && !Number.isNaN(prev) && prev < pl.at && time >= pl.at && time - prev < 30) {
          const n = pl.samples.length / 3;
          for (let c = 0; c < (pl.bridge ? 8 : 16); c++) {
            const k = (c % n) * 3;
            const x = pl.samples[k];
            const y = pl.samples[k + 1];
            const z = pl.samples[k + 2];
            if (pl.bridge) fx.puff(x, y, z, (Math.random() - 0.5) * 3, 1.5, (Math.random() - 0.5) * 3, 0.8, 0.6, 0x9a7a52, 1.2, 3);
            else {
              fx.puff(x, y + 0.3, z, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 1.0, 1.0, 0x4a3c48, 1.6, -0.5);
              fx.spark(x, y, z, (Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6, 0.8, 0.28, 0xffb050, 12);
            }
          }
        }
      }
      pl.seen = time;
    }

    // --- Seile der Hängebrücke ---
    for (const pieces of bridgePieces) {
      // Tor dieser Abzweigung: in den letzten Sekunden davor schwankt alles stärker
      const bi = t.branchOf[plates[pieces[0]].segs[0]];
      let warn = 0;
      for (const g of t.gates) {
        if (t.branchOf[g.first] !== bi) continue;
        const until = planUntil(g.plan, time);
        if (until === 0) warn = 1;
        else if (until <= g.warn) warn = Math.max(warn, smooth(1 - until / g.warn));
      }
      const near = cam ? (t.px[plates[pieces[0]].segs[0]] - cam.x) ** 2 + (t.pz[plates[pieces[0]].segs[0]] - cam.z) ** 2 < 260 * 260 : false;
      const amp = (near ? 0.05 : 0) + 0.55 * warn;
      const sc = t.branches[bi] ? plates[pieces[0]].segs[0] : 0;
      const rx = rightX(t, sc);
      const rz = rightZ(t, sc);
      const secs = time / 60;
      for (const r of ropes) {
        if (r.piece < 0 || r.piece >= pieces.length) continue;
        const pl = plates[pieces[r.piece]];
        const h = pl.hole;
        const since = planSince(h.plan, time);
        if (since >= 0) {
          const tau = since / 60;
          if (r.mode === 1) {
            // baumelt am Bock: schwingt in die Senkrechte und kommt zur Ruhe
            const ang = tau > 5 ? r.dangle : r.dangle * (1 - Math.exp(-2.2 * tau) * Math.cos(5.5 * tau));
            setPar(0, 0, 0, 0, ang, 0, 1, 1, 0, 0);
          } else {
            const drop = 0.5 * GRAV * tau * tau;
            if (drop > FALL_GORGE) setPar(1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            else setPar(0, 0, -drop, 0, (r.phase > 0 ? 1 : -1) * tau * 1.4, 0, 1, 1, 0, 0);
          }
        } else {
          const until = planUntil(h.plan, time);
          const shake = until <= h.warn ? (1 - until / h.warn) * 0.25 : 0;
          const a = (amp + shake) * Math.sin(Math.PI * Math.max(0.15, r.u));
          if (a === 0) setPar(0, 0, 0, 0, 0, 0, 1, 1, 0, 0);
          else {
            const w = Math.sin(2 * Math.PI * 0.7 * secs + r.phase * 0.5 + r.u * 2.2) * a;
            const v = Math.sin(2 * Math.PI * 1.1 * secs + r.phase) * a * 0.3 + (shake > 0 ? Math.sin(secs * 37 + r.u * 9) * shake * 0.3 : 0);
            setPar(0, rx * w, v, rz * w, 0, 0, 1, 1, 0, 0);
          }
        }
        apply(r.body);
      }
    }

    // --- Tore und Ampeln ---
    for (const gv of gates) {
      const g = gv.gate;
      const active = planActive(g.plan, time);
      const until = planUntil(g.plan, time);
      if (gv.opens) {
        // Zunge: steht, solange zu; in den letzten warn Ticks sinkt und verdunkelt sie sich
        const toOpen = active ? ticksToChange(g.plan, time) : Infinity;
        const k = active && toOpen <= g.warn ? smooth(1 - toOpen / g.warn) : 0;
        gv.mesh.visible = active;
        gv.mesh.position.y = -gv.sink * k;
        gv.mat.color.setScalar(1 - 0.65 * k);
        if (gv.glow) {
          if (active) setPar(0, 0, -gv.sink * k, 0, 0, 0, 1, 1 - 0.85 * k, 0.15 * (1 - k), 0);
          else setPar(1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          apply(gv.glow);
        }
      } else {
        // Felssturz: fällt in den letzten DROP_TICKS vor dem Schließen und steht danach
        const falling = !active && until <= DROP_TICKS;
        gv.mesh.visible = active || falling;
        const k = falling ? 1 - until / DROP_TICKS : 1;
        gv.mesh.position.y = DROP_H * (1 - k * k);
        if (fx && cam && detail && !Number.isNaN(gv.seen) && gv.seen < time && planUntil(g.plan, gv.seen) > 0 && active && time - gv.seen < 30) {
          for (let i = 0; i < gv.dust.length; i += 3) {
            const x = gv.dust[i];
            const z = gv.dust[i + 2];
            if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 160 * 160) continue;
            fx.puff(x, gv.dust[i + 1], z, (Math.random() - 0.5) * 3, 1.5, (Math.random() - 0.5) * 3, 1.1, 1.4, 0x6a5a60, 1.8, -0.3);
          }
        }
      }
      gv.seen = time;
      // Ampel: grün offen, rot zu (mit Kreuz), gelb blinkend und immer schneller vor dem Wechsel
      const change = ticksToChange(g.plan, time);
      let c: THREE.Color = active ? L_RED : L_GREEN;
      if (change <= g.warn && change > 0) {
        const tw = (g.warn - change) / 60;
        const phase = 1.6 * tw + 0.55 * tw * tw;
        c = phase - Math.floor(phase) < 0.5 ? L_YEL : L_OFF;
      }
      const lc = lampCol.array as Float32Array;
      const lp = lampPos.array as Float32Array;
      for (const [v0, n] of gv.lamps)
        for (let v = v0; v < v0 + n; v++) {
          lc[v * 3] = c.r;
          lc[v * 3 + 1] = c.g;
          lc[v * 3 + 2] = c.b;
        }
      for (const [v0, n] of gv.crosses)
        for (let v = v0; v < v0 + n; v++) {
          const i = v * 3;
          lc[i] = L_RED.r;
          lc[i + 1] = L_RED.g;
          lc[i + 2] = L_RED.b;
          // Kreuz nur, solange zu: sonst auf einen Punkt hinter der Tafel
          lp[i] = active ? lampRest[i] : lampRest[v0 * 3];
          lp[i + 1] = active ? lampRest[i + 1] : lampRest[v0 * 3 + 1] - 0.5;
          lp[i + 2] = active ? lampRest[i + 2] : lampRest[v0 * 3 + 2];
        }
    }
    lampCol.needsUpdate = true;
    lampPos.needsUpdate = true;

    upload(S);
    upload(G);
    upload(A);
  }

  refresh(0, null, null, 0);

  group.userData.triangles = tris;
  // Für Tests (vulkanbild.test.ts): welche Dreiecke Fahrfläche sind und welche Netze was zeigen.
  group.userData.vulkan = { solid: solidMesh, glow: glowMesh, glutschein: addMesh, ampeln: lampMesh, deckTris: deckTriangles(), sperren: gates.map((g) => g.mesh) };

  /** Dreiecke (Nummern im Toon-Netz) der Oberseiten von Platten und Bohlen. */
  function deckTriangles(): number[] {
    const out: number[] = [];
    const n = S.restN!;
    for (const pl of plates)
      for (const b of pl.shards)
        for (let v = b.s0; v < b.s1; v += 3) {
          // Oberseite: zeigt nach oben und liegt auf Fahrbahnhöhe (nicht die Unterseite der Bohle)
          if (n[v * 3 + 1] < 0.9) continue;
          const y = S.rest[v * 3 + 1];
          const s = pl.segs[0];
          if (Math.abs(y - t.py[s]) > 3 && Math.abs(y - (t.py[pl.segs[pl.segs.length - 1]])) > 3) continue;
          if (isBottom(v, pl)) continue;
          out.push(v / 3);
        }
    return out;
  }
  /** Liegt das Dreieck ab Ecke v unter der Oberfläche (Unterseite)? */
  function isBottom(v: number, pl: Plate): boolean {
    // Unterseiten zeigen nach unten und fallen damit schon oben heraus; hier nur Absicherung über die Höhe
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < pl.segs.length; i++) {
      const s = pl.segs[i];
      const d = (t.px[s] - S.rest[v * 3]) ** 2 + (t.pz[s] - S.rest[v * 3 + 2]) ** 2;
      if (d < best) {
        best = d;
        k = s;
      }
    }
    return S.rest[v * 3 + 1] < t.py[k] - Math.abs(t.bank[k]) * 12 - 0.1;
  }

  return {
    group,
    update(time, _seconds, dt, cam, fx) {
      refresh(time, cam, fx, dt);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
