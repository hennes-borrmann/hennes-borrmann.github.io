// Riesenkinderzimmer: Darstellung der Größenringe (blau = schrumpfen, orange = wachsen) und der Größentore
// (Mauseloch, Bauklotz-Burg).
//
// Ringe: ein stehender Spielzeugreifen quer in seiner Spur – zwei Beine neben der Spur in Bauklotz-Füßen, oben
// ein Halbkreis. Die lichte Weite ist genau lat0 … lat1, die Ebene ist die, in der die Physik die Durchfahrt
// zählt (zwischen Abschnitt seg und dem nächsten). Im Ring wandern Winkel zur Mitte (schrumpfen) bzw. aus der
// Mitte heraus (wachsen), oben steht ein Schild: Pfeile aufeinander zu + kleines Kart bzw. Pfeile auseinander +
// großes Kart. Vor dem Ring läuft auf seiner Spur ein Teppich aus Winkeln in der Farbe des Rings zum Ring hin.
//
// Tore: An der Mündung einer Größen-Abkürzung läuft für alle, die nicht die verlangte Größe haben, die Bande
// der Hauptstrecke durch (track.ts: gateShut, sim.ts). Genau dort steht hier die Wand:
//   Mauseloch (nur winzig): eine Fußleiste mit einem niedrigen Rundbogen, so lang wie das Stück, auf dem ein
//     winziges Kart die Bandenlinie überqueren kann; blau eingefasst, Zeichen „klein“.
//   Bauklotz-Burg (nur riesig): eine Mauer aus bunten Klötzen, orange eingefasst, Zeichen „groß“. Fährt ein
//     riesiges Kart darauf zu (observe), fliegen die Klötze der Durchfahrt auseinander und setzen sich nach 3 s
//     wieder zusammen. Auf der Abzweigung stehen Türme und ein hoher Torbogen neben bzw. über der Fahrbahn.
// Über jedem Tor ein festes Schild; nähert sich ein Kart passender Größe, leuchtet das Tor kurz auf.
//
// Ringe, Teppiche und Pfeile hängen nur an der Zeit (seconds). Die Klotzmauer und das Aufleuchten antworten
// über observe auf die Karts – reine Zierde, die Physik hängt nicht daran.
//
// Zeichentechnik (siehe gemeinsame Regeln): Toon-Körper mit Eckenfarbe und Kontur, ein Netz mit Eckenfarben
// (MeshBasicMaterial), dessen Ecken je Bild teilweise neu gesetzt werden, Instanzen für die Klötze, ein additives
// Netz mit je Bild gesetzten Eckenfarben für das Aufleuchten. Keine eigenen Shader, keine Texturen, kein Licht.

import * as THREE from 'three';
import { sizeClass } from '../../game/mechanics';
import { KART_RADIUS } from '../../game/sim';
import { projectOnTrack, rightX, rightZ, sideLimit, type Track } from '../../game/track';
import type { RenderEntity } from '../../game/view';
import { MeshBuilder, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial, withOutline, INK } from '../toon';

// --- Farben ----------------------------------------------------------------------------

const C_BLUE = rgb(0x2b7cf2);
const C_BLUE_L = rgb(0x8fd0ff);
const C_ORANGE = rgb(0xff7a1a);
const C_ORANGE_L = rgb(0xffd04a);
const C_INK = rgb(INK);
const C_PANEL = rgb(0xfff8e8);
const C_ARROW_B = rgb(0xeaf6ff);
const C_ARROW_O = rgb(0xfff3c4);
const C_WOOD = rgb(0xdca868);
const C_BOARD = rgb(0xf3ecdc);
const C_BOARD_TOP = rgb(0xe2d6bd);
const C_HOLE = rgb(0x2e2228);
const BLOCK_COLORS = [0xe8463c, 0xf6c533, 0x3f7fe0, 0x4fb35a, 0xe2b67a, 0xb05cd6];

// --- Maße ------------------------------------------------------------------------------

/** Ring: Radius des Reifenrohrs, Höhe der Mitte des oberen Halbkreises über der Fahrbahn. */
const TUBE = 0.32;
const RING_HC = 2.5;
/** Schild: Breite, Höhe, Tiefe. */
const SIGN_W = 4.2;
const SIGN_H = 2.0;
const SIGN_D = 0.25;
/** Teppich: Länge vor dem Ring, Abstand der Winkel, Tempo (m/s), Höhe über der Fahrbahn. */
const CARPET_LEN = 45;
const CARPET_GAP = 3;
const CARPET_SPEED = 4;
const CARPET_Y = 0.04;
/** Mauseloch: Fußleiste (Dicke, Höhe), lichte Höhe des Bogens, waagrechter Radius seiner Rundung. */
const BOARD_T = 0.6;
const BOARD_H = 3.0;
const HOLE_H = 1.3;
const HOLE_R = 1.3;
/** Klotzmauer: Dicke und Höhe einer Lage, Zahl der Lagen; Flugzeit, Wartezeit bis zur Rückkehr, Rückkehr. */
const BLOCK_T = 1.0;
const FLY_T = 1.2;
const BACK_AFTER = 3.0;
const BACK_T = 1.0;
/** So weit vor der Mauer (m) und so früh (s) erkennt die Mauer ein riesiges Kart auf Kurs. */
const BURST_REACH = 14;
const BURST_LOOK = 0.8;
/** Aufleuchten: Dauer (s) und wie weit vor der Gabelung ein Kart als „nähert sich“ zählt (m). */
const FLASH_T = 0.5;
const FLASH_REACH = 40;

/** Ein Teil der Darstellung, für die Prüfung (userData.sizers.parts): Ecken first … first+count−1 des Netzes mesh. */
export interface SizerPart {
  kind: 'ring' | 'pfeile' | 'teppich' | 'tor' | 'schild';
  /** Ring: Index in track.sizers; Tor/Schild am Tor: Nummer der Abzweigung; Schild am Ring: −1 − Index des Rings. */
  id: number;
  mesh: string;
  first: number;
  count: number;
  solid: boolean;
}

export const SIZER_MESH_BODY = 'größen-körper';
export const SIZER_MESH_SIGNS = 'größen-zeichen';
export const SIZER_MESH_BLOCKS = 'größen-klötze';
export const SIZER_MESH_GLOW = 'größen-schein';
export const SIZER_MESH_LINTEL = 'größen-sturz';

// --- Kleine Werkzeuge --------------------------------------------------------------------

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Liegt (b−a)×(c−a) auf der Seite von n? */
function faces(a: V3, b: V3, c: V3, n: V3): boolean {
  const u = sub(b, a);
  const v = sub(c, a);
  const cx = u[1] * v[2] - u[2] * v[1];
  const cy = u[2] * v[0] - u[0] * v[2];
  const cz = u[0] * v[1] - u[1] * v[0];
  return cx * n[0] + cy * n[1] + cz * n[2] >= 0;
}

/** Viereck, das sicher zur Seite n zeigt (Reihenfolge wird bei Bedarf umgedreht). */
function quadN(b: MeshBuilder, p0: V3, p1: V3, p2: V3, p3: V3, c: RGB, n: V3): void {
  if (faces(p0, p1, p2, n)) b.quad(p0, p1, p2, p3, c);
  else b.quad(p3, p2, p1, p0, c);
}

/** Konvexes Vieleck als Fächer, zur Seite n. */
function polyN(b: MeshBuilder, pts: V3[], c: RGB, n: V3): void {
  const flip = !faces(pts[0], pts[1], pts[2], n);
  for (let i = 1; i + 1 < pts.length; i++) {
    if (flip) b.tri(pts[0], pts[i + 1], pts[i], c);
    else b.tri(pts[0], pts[i], pts[i + 1], c);
  }
}

/** Ebene Fläche in der Welt: Ursprung o, Achsen x und y (Einheitsvektoren), Abstand d entlang der Normalen n. */
interface Plane {
  o: V3;
  x: V3;
  y: V3;
  n: V3;
}
function onPlane(p: Plane, u: number, v: number, d = 0): V3 {
  return [
    p.o[0] + p.x[0] * u + p.y[0] * v + p.n[0] * d,
    p.o[1] + p.x[1] * u + p.y[1] * v + p.n[1] * d,
    p.o[2] + p.x[2] * u + p.y[2] * v + p.n[2] * d,
  ];
}
function rectP(b: MeshBuilder, p: Plane, u0: number, v0: number, u1: number, v1: number, d: number, c: RGB): void {
  quadN(b, onPlane(p, u0, v0, d), onPlane(p, u1, v0, d), onPlane(p, u1, v1, d), onPlane(p, u0, v1, d), c, p.n);
}
function polyP(b: MeshBuilder, p: Plane, uv: number[], d: number, c: RGB): void {
  const pts: V3[] = [];
  for (let i = 0; i < uv.length; i += 2) pts.push(onPlane(p, uv[i], uv[i + 1], d));
  polyN(b, pts, c, p.n);
}
function hexP(b: MeshBuilder, p: Plane, cu: number, cv: number, r: number, d: number, c: RGB): void {
  const uv: number[] = [];
  for (let k = 0; k < 6; k++) uv.push(cu + r * Math.cos((k * Math.PI) / 3 + Math.PI / 6), cv + r * Math.sin((k * Math.PI) / 3 + Math.PI / 6));
  polyP(b, p, uv, d, c);
}

/**
 * Das Zeichen „klein“ (grow = false: zwei Pfeile, die aufeinander zeigen, kleines Kart) bzw. „groß“
 * (Pfeile auseinander, großes Kart) auf einem Schild der Größe w × h (Mitte bei 0,0), Abstand d vor der Fläche.
 */
function sizeSymbol(b: MeshBuilder, p: Plane, w: number, h: number, d: number, grow: boolean, arrow: RGB): void {
  const s = Math.min(w / 4.2, h / 2.0);
  const cx = -0.85 * s;
  const sh = 0.15 * s;
  const hh = 0.42 * s;
  for (const sg of [-1, 1]) {
    if (!grow) {
      // Pfeil von außen zur Mitte
      rectP(b, p, cx + sg * 1.25 * s, -sh, cx + sg * 0.62 * s, sh, d, arrow);
      polyP(b, p, [cx + sg * 0.62 * s, -hh, cx + sg * 0.12 * s, 0, cx + sg * 0.62 * s, hh], d, arrow);
    } else {
      // Pfeil von der Mitte nach außen
      rectP(b, p, cx + sg * 0.12 * s, -sh, cx + sg * 0.75 * s, sh, d, arrow);
      polyP(b, p, [cx + sg * 0.75 * s, -hh, cx + sg * 1.25 * s, 0, cx + sg * 0.75 * s, hh], d, arrow);
    }
  }
  // Kart von der Seite, nach rechts fahrend, auf einer gemeinsamen Grundlinie
  const k = (grow ? 0.95 : 0.55) * s;
  const kx = 1.15 * s;
  const ky = -0.78 * s;
  rectP(b, p, kx - 0.7 * k, ky + 0.2 * k, kx + 0.55 * k, ky + 0.5 * k, d, C_INK);
  polyP(b, p, [kx + 0.55 * k, ky + 0.2 * k, kx + 0.82 * k, ky + 0.24 * k, kx + 0.55 * k, ky + 0.5 * k], d, C_INK);
  rectP(b, p, kx - 0.55 * k, ky + 0.5 * k, kx - 0.38 * k, ky + 0.95 * k, d, C_INK);
  hexP(b, p, kx - 0.12 * k, ky + 0.92 * k, 0.24 * k, d, C_INK);
  hexP(b, p, kx - 0.45 * k, ky + 0.2 * k, 0.22 * k, d, C_INK);
  hexP(b, p, kx + 0.48 * k, ky + 0.2 * k, 0.22 * k, d, C_INK);
  // Grundlinie über die ganze Breite des Zeichens
  rectP(b, p, -1.95 * s, ky - 0.05 * s, 1.98 * s, ky - 0.0 * s, d, C_INK);
}

/** Schildfläche: helle Fläche mit Rand in der Farbe c, darauf das Zeichen (Netz der Zeichen). */
function signFace(b: MeshBuilder, p: Plane, w: number, h: number, grow: boolean, c: RGB): void {
  const bw = 0.16 * Math.min(w / SIGN_W, h / SIGN_H);
  rectP(b, p, -w / 2, -h / 2, w / 2, h / 2, 0.01, c);
  rectP(b, p, -w / 2 + bw, -h / 2 + bw, w / 2 - bw, h / 2 - bw, 0.02, C_PANEL);
  sizeSymbol(b, p, w - 2 * bw, h - 2 * bw, 0.035, grow, c);
}

// --- Aufbau --------------------------------------------------------------------------------

export function buildSizers(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'Größenringe und Größentore';
  const disposables: { dispose(): void }[] = [];
  const parts: SizerPart[] = [];
  const body = new MeshBuilder(); // Toon-Körper (mit Kontur)
  const signs = new MeshBuilder(); // Flächen mit Eckenfarbe, ungeschattet (Schilder, Zeichen)
  const glowB = new MeshBuilder(); // additiv: Aufleuchten
  const lintel = new MeshBuilder(); // Toon: die Fußleiste über dem Mauseloch
  let lintelGate: { k: number; side: number; seg0: number } | null = null;
  let lintelA = 0;
  let lintelB = 0;
  // Einfassung und Zeichen auf dem Sturz (Ecken im Netz der Zeichen): verschwinden mit ihm
  let decalFirst = 0;
  let decalEnd = 0;
  const rnd = seeded(t.index * 977 + 15);

  /** Punkt auf der Strecke wie in world.ts: Abschnitt i, Anteil f zum nächsten, seitlich lat, um dy angehoben. */
  const P = (i: number, f: number, lat: number, dy = 0): V3 => {
    const x = t.px[i] + rightX(t, i) * lat;
    const y = t.py[i] + lat * t.bank[i] + dy;
    const z = t.pz[i] + rightZ(t, i) * lat;
    if (f === 0) return [x, y, z];
    const j = t.next[i];
    return [
      x + (t.px[j] + rightX(t, j) * lat - x) * f,
      y + (t.py[j] + lat * t.bank[j] + dy - y) * f,
      z + (t.pz[j] + rightZ(t, j) * lat - z) * f,
    ];
  };
  /** Wie P, aber s Meter (Abschnitte) hinter seg0 auf der Hauptstrecke. */
  const along = (seg0: number, s: number, lat: number, dy = 0): V3 => {
    const k = Math.floor(s);
    return P((((seg0 + k) % t.n) + t.n) % t.n, s - k, lat, dy);
  };
  /** Fahrtrichtung (waagrecht, Einheitsvektor) s Meter hinter seg0. */
  const dirAt = (seg0: number, s: number): V3 => {
    const a = along(seg0, s - 0.5, 0);
    const b = along(seg0, s + 0.5, 0);
    const l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    return [(b[0] - a[0]) / l, 0, (b[2] - a[2]) / l];
  };
  const mark = (kind: SizerPart['kind'], id: number, mesh: string, b: MeshBuilder, solid: boolean, fn: () => void): void => {
    const first = b.triangles * 3;
    fn();
    parts.push({ kind, id, mesh, first, count: b.triangles * 3 - first, solid });
  };

  // ======================================================================================
  // Ringe
  // ======================================================================================

  interface RingFrame {
    o: V3;
    d: V3;
    r: V3;
    bank: number;
    mid: number;
    hw: number;
    grow: boolean;
    /** Abschnitte vor dem Ring: chain[0] = seg, chain[k] = k Abschnitte davor. */
    chain: Int32Array;
  }
  const rings: RingFrame[] = [];
  t.sizers.forEach((z, ri) => {
    const s = z.seg;
    const n = t.next[s];
    const o: V3 = [(t.px[s] + t.px[n]) / 2, (t.py[s] + t.py[n]) / 2, (t.pz[s] + t.pz[n]) / 2];
    const dl = Math.hypot(t.px[n] - t.px[s], t.pz[n] - t.pz[s]) || 1;
    const d: V3 = [(t.px[n] - t.px[s]) / dl, 0, (t.pz[n] - t.pz[s]) / dl];
    const r: V3 = [-d[2], 0, d[0]];
    const chain = new Int32Array(CARPET_LEN + 6);
    chain[0] = s;
    for (let k = 1; k < chain.length; k++) chain[k] = t.prev[chain[k - 1]];
    const f: RingFrame = { o, d, r, bank: (t.bank[s] + t.bank[n]) / 2, mid: (z.lat0 + z.lat1) / 2, hw: (z.lat1 - z.lat0) / 2, grow: z.grow, chain };
    rings.push(f);
    const W = (u: number, v: number, w: number): V3 => {
      const l = f.mid + u;
      return [o[0] + r[0] * l + d[0] * w, o[1] + l * f.bank + v, o[2] + r[2] * l + d[2] * w];
    };
    const ca = z.grow ? C_ORANGE : C_BLUE;
    const cb = z.grow ? C_ORANGE_L : C_BLUE_L;
    const rc = f.hw + TUBE;
    mark('ring', ri, SIZER_MESH_BODY, body, true, () => {
      // Pfad des Reifens in der Ringebene (u seitlich, v hoch) mit nach außen zeigender Normalen
      const path: [number, number, number, number][] = [[-rc, 0, -1, 0]];
      const ARC = 16;
      for (let k = 0; k <= ARC; k++) {
        const a = Math.PI - (k / ARC) * Math.PI;
        path.push([rc * Math.cos(a), RING_HC + rc * Math.sin(a), Math.cos(a), Math.sin(a)]);
      }
      path.push([rc, 0, 1, 0]);
      const SIDES = 6;
      const ringAt = (k: number): V3[] => {
        const [pu, pv, nu, nv] = path[k];
        const out: V3[] = [];
        for (let q = 0; q < SIDES; q++) {
          const th = (q / SIDES) * Math.PI * 2;
          // q = 3 zeigt genau nach innen: die Innenkante des Rohrs liegt bei |u| = hw
          out.push(W(pu + nu * TUBE * Math.cos(th), pv + nv * TUBE * Math.cos(th), TUBE * Math.sin(th)));
        }
        return out;
      };
      let prevRing = ringAt(0);
      for (let k = 1; k < path.length; k++) {
        const cur = ringAt(k);
        const c = k % 2 === 0 ? ca : cb;
        const [pu, pv] = path[k];
        const [qu, qv] = path[k - 1];
        const cu = (pu + qu) / 2;
        const cv = (pv + qv) / 2;
        for (let q = 0; q < SIDES; q++) {
          const q1 = (q + 1) % SIDES;
          // nach außen: von der Rohrmitte weg
          const mid = W(cu, cv, 0);
          const a = prevRing[q];
          const n: V3 = sub([(a[0] + cur[q1][0]) / 2, (a[1] + cur[q1][1]) / 2, (a[2] + cur[q1][2]) / 2], mid);
          quadN(body, prevRing[q], cur[q], cur[q1], prevRing[q1], c, n);
        }
        prevRing = cur;
      }
      // Bauklotz-Füße neben der Spur
      const rot = Math.atan2(d[0], d[2]);
      for (const sg of [-1, 1]) {
        const fu = sg * (f.hw + 0.47);
        const base = W(fu, 0, 0);
        body.box(base[0], base[1] + 0.45, base[2], 0.9, 0.9, 1.3, C_WOOD, rot, ca);
      }
    });
    // Schild auf dem Reifen (Körper) und seine Fläche (ungeschattet)
    const top = RING_HC + rc + TUBE + 0.06;
    mark('schild', -1 - ri, SIZER_MESH_BODY, body, true, () => {
      const c = W(0, top + SIGN_H / 2, 0);
      body.box(c[0], c[1], c[2], SIGN_W + 0.1, SIGN_H + 0.1, SIGN_D, ca, Math.atan2(d[0], d[2]));
      // kurzer Steg hinunter auf den Reifen
      const s0 = W(0, top - 0.2, 0);
      body.box(s0[0], s0[1], s0[2], 0.6, 0.5, SIGN_D * 0.8, ca, Math.atan2(d[0], d[2]));
    });
    for (const back of [false, true]) {
      // vorn das Zeichen (Anfahrt), hinten auch – wer zurückschaut, sieht es ebenso
      const c = W(0, top + SIGN_H / 2, (back ? 1 : -1) * (SIGN_D / 2));
      const pl: Plane = back
        ? { o: c, x: [-r[0], 0, -r[2]], y: [0, 1, 0], n: d }
        : { o: c, x: r, y: [0, 1, 0], n: [-d[0], 0, -d[2]] };
      signFace(signs, pl, SIGN_W, SIGN_H, z.grow, ca);
    }
  });

  // ======================================================================================
  // Tore
  // ======================================================================================

  interface Gate {
    k: number;
    side: number;
    only: number;
    /** Wand: Hauptstrecken-Abschnitt seg0, Länge len (m). */
    seg0: number;
    len: number;
    /** Durchlass (m ab seg0): a … b. */
    a: number;
    b: number;
    /** Hauptstrecken-Abschnitte, an denen beide Fahrbahnen ineinander liegen. */
    twin0: number;
    twin1: number;
    flash: number;
    inZone: number;
    glowFirst: number;
    glowCount: number;
    glowColor: RGB;
  }
  const gates: Gate[] = [];
  for (let k = 0; k < t.branches.length; k++) {
    const only = t.branchOnly[k];
    if (only === 0) continue;
    const br = t.branches[k];
    const side = br.side;
    // Wo liegen Abzweigung und Hauptstrecke ineinander (track.twin)? Dort läuft die Bande durch.
    let m1 = br.from;
    while (t.twin[t.next[m1]] >= 0 && t.branchOf[t.twin[t.next[m1]]] === k) m1 = t.next[m1];
    // Wo kann ein Kart mit seiner Mitte die Bandenlinie überqueren (so, wie die Physik Grenzen setzt)?
    let r0 = -1;
    let r1 = -1;
    for (let m = br.from, i = 0; i <= ((m1 - br.from + t.n) % t.n); m = t.next[m], i++) {
      const x = t.px[m] + rightX(t, m) * side * t.wh[m];
      const zz = t.pz[m] + rightZ(t, m) * side * t.wh[m];
      const pr = projectOnTrack(t, x, zz, m);
      const lim = sideLimit(t, pr.seg, pr.lat > 0 ? 1 : -1) - KART_RADIUS;
      if (Math.abs(pr.lat) <= lim + 1e-6) {
        if (r0 < 0) r0 = i;
        r1 = i;
      }
    }
    const twinLen = (m1 - br.from + t.n) % t.n;
    const seg0 = (br.from - 2 + t.n) % t.n;
    gates.push({
      k,
      side,
      only,
      seg0,
      len: twinLen + 6,
      // Durchlass: über die Stellen, an denen ein Kart überqueren kann, plus seinen Radius
      a: r0 < 0 ? 4 : r0 + 2 - KART_RADIUS,
      b: r1 < 0 ? 8 : r1 + 2 + KART_RADIUS,
      twin0: br.from,
      twin1: m1,
      flash: 1,
      inZone: 0,
      glowFirst: 0,
      glowCount: 0,
      glowColor: only < 0 ? C_BLUE : C_ORANGE,
    });
  }

  // --- Klötze (Instanzen): Mauer der Bauklotz-Burg und Türme der Burg ---
  interface Block {
    x: number;
    y: number;
    z: number;
    yaw: number;
    sx: number;
    sy: number;
    sz: number;
    color: number;
    gate: number;
    passage: boolean;
    // Wurfbahn
    lx: number;
    ly: number;
    lz: number;
    vy: number;
    g: number;
    roll: number;
    spin: number;
    /** Höhe der Fahrbahn unter dem Klotz in Ruhe. */
    ground: number;
  }
  const blocks: Block[] = [];
  const addBlock = (pos: V3, yaw: number, sx: number, sy: number, sz: number, gate: number, passage: boolean, ground = 0): Block => {
    const b: Block = { x: pos[0], y: pos[1], z: pos[2], yaw, sx, sy, sz, color: BLOCK_COLORS[Math.floor(rnd() * BLOCK_COLORS.length)], gate, passage, lx: pos[0], ly: pos[1], lz: pos[2], vy: 0, g: 0, roll: 0, spin: 0, ground };
    blocks.push(b);
    return b;
  };
  /** Zeichen-Schild senkrecht zur Strecke, Anfahrt zugewandt, an der Stelle s hinter seg0, seitlich lat, Unterkante dy. */
  const gateSign = (g: Gate, s: number, lat: number, dy: number, w: number, h: number): void => {
    const dd = dirAt(g.seg0, s);
    const rr: V3 = [-dd[2], 0, dd[0]];
    const rot = Math.atan2(dd[0], dd[2]);
    const groundY = along(g.seg0, s, lat)[1];
    mark('schild', g.k, SIZER_MESH_BODY, body, true, () => {
      const c = along(g.seg0, s, lat, dy + h / 2);
      body.box(c[0], c[1], c[2], w + 0.1, h + 0.1, SIGN_D, g.glowColor, rot);
      // Pfosten bis hinunter auf die Wand bzw. den Boden
      const p = along(g.seg0, s, lat, 0);
      const pl = dy - (p[1] - groundY);
      body.box(p[0], groundY + pl / 2, p[2], 0.35, pl, 0.35, C_WOOD, rot);
    });
    for (const back of [false, true]) {
      const c = along(g.seg0, s, lat, dy + h / 2);
      const pc: V3 = [c[0] + dd[0] * (back ? 1 : -1) * (SIGN_D / 2), c[1], c[2] + dd[2] * (back ? 1 : -1) * (SIGN_D / 2)];
      const pl: Plane = back ? { o: pc, x: [-rr[0], 0, -rr[2]], y: [0, 1, 0], n: dd } : { o: pc, x: rr, y: [0, 1, 0], n: [-dd[0], 0, -dd[2]] };
      signFace(signs, pl, w, h, g.only > 0, g.glowColor);
    }
  };

  for (const g of gates) {
    const sd = g.side;
    const wh = (s: number): number => {
      const k = Math.floor(s);
      return t.wh[(((g.seg0 + k) % t.n) + t.n) % t.n];
    };
    const inward: (s: number) => V3 = (s) => {
      const dd = dirAt(g.seg0, s);
      return [dd[2] * sd, 0, -dd[0] * sd];
    };
    if (g.only < 0) {
      // ---------------- Mauseloch: Fußleiste mit niedrigem Rundbogen ----------------
      const A = g.a - HOLE_R;
      const B = g.b + HOLE_R;
      const holeAt = (s: number): number => {
        if (s <= A || s >= B) return 0;
        if (s < A + HOLE_R) return HOLE_H * Math.sqrt(Math.max(0, 1 - ((A + HOLE_R - s) / HOLE_R) ** 2));
        if (s > B - HOLE_R) return HOLE_H * Math.sqrt(Math.max(0, 1 - ((s - (B - HOLE_R)) / HOLE_R) ** 2));
        return HOLE_H;
      };
      const ss = new Set<number>();
      for (let s = 0; s <= g.len; s++) ss.add(s);
      for (let q = 0; q <= 8; q++) {
        ss.add(A + (q / 8) * HOLE_R);
        ss.add(B - (q / 8) * HOLE_R);
      }
      const S = [...ss].filter((s) => s >= 0 && s <= g.len).sort((p, q) => p - q);
      // Was über dem Bogen liegt (der Sturz), ist ein eigenes Netz: Fährt ein winziges Kart hindurch, stünde die
      // Kamera dahinter sonst vor einer Wand (siehe observe).
      const piece = (wb: MeshBuilder, inside: boolean): void => {
        for (let q = 0; q + 1 < S.length; q++) {
          const s0 = S[q];
          const s1 = S[q + 1];
          if ((s0 >= A - 1e-6 && s1 <= B + 1e-6) !== inside) continue;
          const y0 = holeAt(s0);
          const y1 = holeAt(s1);
          const lin0 = sd * wh(s0);
          const lin1 = sd * wh(s1);
          const lout0 = sd * (wh(s0) + BOARD_T);
          const lout1 = sd * (wh(s1) + BOARD_T);
          const inn = inward((s0 + s1) / 2);
          const out: V3 = [-inn[0], 0, -inn[2]];
          const TOPB = BOARD_H - 0.32;
          // Stirnseite zur Fahrbahn: Hauptfläche und abgesetzte Kante oben
          quadN(wb, along(g.seg0, s0, lin0, y0), along(g.seg0, s1, lin1, y1), along(g.seg0, s1, lin1, TOPB), along(g.seg0, s0, lin0, TOPB), C_BOARD, inn);
          quadN(wb, along(g.seg0, s0, lin0, TOPB), along(g.seg0, s1, lin1, TOPB), along(g.seg0, s1, lin1, BOARD_H), along(g.seg0, s0, lin0, BOARD_H), C_BOARD_TOP, inn);
          // Rückseite
          quadN(wb, along(g.seg0, s0, lout0, y0), along(g.seg0, s1, lout1, y1), along(g.seg0, s1, lout1, BOARD_H), along(g.seg0, s0, lout0, BOARD_H), shade(C_BOARD, 0.85), out);
          // oben
          quadN(wb, along(g.seg0, s0, lin0, BOARD_H), along(g.seg0, s1, lin1, BOARD_H), along(g.seg0, s1, lout1, BOARD_H), along(g.seg0, s0, lout0, BOARD_H), C_BOARD_TOP, [0, 1, 0]);
          // Laibung des Bogens (unten, dunkel)
          if (y0 > 0.001 || y1 > 0.001) {
            quadN(wb, along(g.seg0, s0, lin0, y0), along(g.seg0, s1, lin1, y1), along(g.seg0, s1, lout1, y1), along(g.seg0, s0, lout0, y0), C_HOLE, [0, -1, 0]);
          }
        }
        if (inside) return;
        // Stirnseiten an beiden Enden
        for (const [s, sg] of [[0, -1], [g.len, 1]] as const) {
          const dd = dirAt(g.seg0, s);
          const n: V3 = [dd[0] * sg, 0, dd[2] * sg];
          quadN(wb, along(g.seg0, s, sd * wh(s), 0), along(g.seg0, s, sd * (wh(s) + BOARD_T), 0), along(g.seg0, s, sd * (wh(s) + BOARD_T), BOARD_H), along(g.seg0, s, sd * wh(s), BOARD_H), C_BOARD_TOP, n);
        }
      };
      mark('tor', g.k, SIZER_MESH_BODY, body, true, () => piece(body, false));
      mark('tor', g.k, SIZER_MESH_LINTEL, lintel, true, () => piece(lintel, true));
      lintelGate = g;
      lintelA = A;
      lintelB = B;
      // Blaue Einfassung um den Bogen (Fläche knapp vor der Wand) und dahinter der Schein beim Aufleuchten
      const outline: [number, number, number, number][] = [];
      outline.push([A, 0, -1, 0]);
      for (let q = 1; q <= 8; q++) {
        const a = Math.PI - (q / 8) * (Math.PI / 2);
        outline.push([A + HOLE_R + HOLE_R * Math.cos(a), HOLE_H * Math.sin(a), Math.cos(a) / HOLE_R, Math.sin(a) / HOLE_H]);
      }
      outline.push([B - HOLE_R, HOLE_H, 0, 1]);
      for (let q = 1; q <= 8; q++) {
        const a = Math.PI / 2 - (q / 8) * (Math.PI / 2);
        outline.push([B - HOLE_R + HOLE_R * Math.cos(a), HOLE_H * Math.sin(a), Math.cos(a) / HOLE_R, Math.sin(a) / HOLE_H]);
      }
      const band = (b: MeshBuilder, w0: number, w1: number, lat: number, c: RGB): void => {
        for (let q = 0; q + 1 < outline.length; q++) {
          const p0 = outline[q];
          const p1 = outline[q + 1];
          const n0 = Math.hypot(p0[2], p0[3]) || 1;
          const n1 = Math.hypot(p1[2], p1[3]) || 1;
          const e = (p: [number, number, number, number], nn: number, w: number): V3 => along(g.seg0, p[0] + (p[2] / nn) * w, sd * (wh(p[0]) + lat), p[1] + (p[3] / nn) * w);
          quadN(b, e(p0, n0, w0), e(p1, n1, w0), e(p1, n1, w1), e(p0, n0, w1), c, inward(p0[0]));
        }
      };
      decalFirst = signs.triangles * 3;
      band(signs, 0, 0.32, -0.02, C_BLUE);
      g.glowFirst = glowB.triangles * 3;
      band(glowB, -0.05, 0.75, -0.06, C_BLUE);
      g.glowCount = glowB.triangles * 3 - g.glowFirst;
      // „klein“ auf die Fußleiste gemalt, über dem Bogen, mehrmals
      for (const fr of [0.25, 0.5, 0.75]) {
        const s = A + (B - A) * fr;
        const dd = dirAt(g.seg0, s);
        const c = along(g.seg0, s, sd * (wh(s) - 0.03), (HOLE_H + BOARD_H - 0.32) / 2 + 0.05);
        signFace(signs, { o: c, x: dd, y: [0, 1, 0], n: inward(s) }, 2.4, 1.15, false, C_BLUE);
      }
      decalEnd = signs.triangles * 3;
      // Schild senkrecht zur Strecke, vor dem Bogen, hinter der Bandenlinie
      gateSign(g, Math.max(1.5, A - 3), sd * (t.wh[g.twin0] + 2.25), BOARD_H + 0.25, SIGN_W, SIGN_H);
    } else {
      // ---------------- Bauklotz-Burg: Mauer aus Klötzen ----------------
      const L = detail ? 2.0 : 3.0;
      const H = detail ? 1.0 : 1.5;
      const rows = detail ? 3 : 2;
      const pil0 = g.a - 1.5;
      const pil1 = g.b + 0.3;
      const PIL = 1.2;
      /** Klötze einer Lage zwischen s0 und s1 (m ab seg0). */
      const course = (s0: number, s1: number, row: number, passage: boolean): void => {
        let s = s0;
        let first = row % 2 === 1;
        while (s1 - s > 0.05) {
          let len = first ? L / 2 : L;
          first = false;
          if (s1 - (s + len) < L * 0.4) len = s1 - s;
          const sc = s + len / 2;
          const dd = dirAt(g.seg0, sc);
          const p = along(g.seg0, sc, sd * (wh(sc) + BLOCK_T / 2), row * H + H / 2);
          addBlock(p, Math.atan2(dd[0], dd[2]), BLOCK_T, H, len - 0.04, g.k, passage, p[1] - row * H - H / 2);
          s += len;
        }
      };
      for (let row = 0; row < rows; row++) {
        course(0, pil0, row, false);
        course(g.a, g.b, row, true);
        course(pil1 + PIL, g.len, row, false);
      }
      // Zinnen auf den festen Stücken
      for (const [s0, s1] of [[0, pil0], [pil1 + PIL, g.len]] as const) {
        for (let s = s0 + 0.5; s + 0.9 < s1; s += 2.2) {
          const dd = dirAt(g.seg0, s + 0.45);
          addBlock(along(g.seg0, s + 0.45, sd * (wh(s) + BLOCK_T / 2), rows * H + 0.35), Math.atan2(dd[0], dd[2]), BLOCK_T, 0.7, 0.9, g.k, false);
        }
      }
      // Orange Pfeiler an beiden Enden des Durchlasses (Körper)
      mark('tor', g.k, SIZER_MESH_BODY, body, true, () => {
        for (const s0 of [pil0, pil1]) {
          const sc = s0 + PIL / 2;
          const dd = dirAt(g.seg0, sc);
          const rot = Math.atan2(dd[0], dd[2]);
          const p = along(g.seg0, sc, sd * (wh(sc) + PIL / 2), 0);
          const ph = rows * H + 1.2;
          body.box(p[0], p[1] + ph / 2, p[2], PIL, ph, PIL, C_ORANGE, rot, C_ORANGE_L);
          body.box(p[0], p[1] + ph + 0.25, p[2], PIL + 0.3, 0.5, PIL + 0.3, C_ORANGE_L, rot);
        }
      });
      // Schein: orange Flächen an den Pfeilern (zur Fahrbahn und zur Anfahrt)
      g.glowFirst = glowB.triangles * 3;
      for (const s0 of [pil0, pil1]) {
        const ph = rows * H + 1.2;
        const inn = inward(s0 + PIL / 2);
        const l = sd * (wh(s0) - 0.06);
        quadN(glowB, along(g.seg0, s0 - 0.3, l, 0), along(g.seg0, s0 + PIL + 0.3, l, 0), along(g.seg0, s0 + PIL + 0.3, l, ph + 0.8), along(g.seg0, s0 - 0.3, l, ph + 0.8), C_ORANGE, inn);
        const dd = dirAt(g.seg0, s0);
        const back: V3 = [-dd[0], 0, -dd[2]];
        quadN(glowB, along(g.seg0, s0 - 0.06, sd * (wh(s0) - 0.3), 0), along(g.seg0, s0 - 0.06, sd * (wh(s0) + PIL + 0.3), 0), along(g.seg0, s0 - 0.06, sd * (wh(s0) + PIL + 0.3), ph + 0.8), along(g.seg0, s0 - 0.06, sd * (wh(s0) - 0.3), ph + 0.8), C_ORANGE, back);
      }
      g.glowCount = glowB.triangles * 3 - g.glowFirst;
      // „groß“ auf die Pfeiler gemalt (zur Fahrbahn hin)
      for (const s0 of [pil0, pil1]) {
        const sc = s0 + PIL / 2;
        const dd = dirAt(g.seg0, sc);
        const c = along(g.seg0, sc, sd * (wh(sc) - 0.03), rows * H - 0.2);
        signFace(signs, { o: c, x: dd, y: [0, 1, 0], n: inward(sc) }, 1.15, 0.6, true, C_ORANGE);
      }
      // Schild senkrecht zur Strecke über dem ersten Pfeiler
      gateSign(g, pil0 + PIL / 2, sd * (t.wh[g.twin0] + SIGN_W / 2 + 0.1), rows * H + 1.9, SIGN_W, SIGN_H);

      // Wurfbahnen der Klötze im Durchlass: in Fahrtrichtung des riesigen Karts (über die Bandenlinie hinaus
      // und ein Stück vorwärts), hoch, mit ein bis drei Vierteldrehungen um die Längsachse – so landen sie flach.
      for (const b of blocks) {
        if (!b.passage || b.gate !== g.k) continue;
        const sc = rnd();
        const out = 3.2 + 3.5 * rnd();
        const fwd = 1.5 + 5 * rnd();
        const dd: V3 = [Math.sin(b.yaw), 0, Math.cos(b.yaw)];
        const rr: V3 = [-dd[2] * sd, 0, dd[0] * sd]; // zur Abzweigung hin
        b.lx = b.x + (rr[0] * out + dd[0] * fwd) * FLY_T;
        b.lz = b.z + (rr[2] * out + dd[2] * fwd) * FLY_T;
        const turns = 1 + Math.floor(rnd() * 3);
        b.roll = turns * (Math.PI / 2) * (rnd() < 0.5 ? -1 : 1);
        // gelandet liegt er auf einer Seitenfläche: nach ungerader Zahl Vierteldrehungen ist die Dicke seine Höhe
        b.ly = b.ground + (turns % 2 === 1 ? b.sx : b.sy) / 2;
        b.vy = 4.5 + 3.5 * sc;
        b.g = (2 * (b.y + b.vy * FLY_T - b.ly)) / (FLY_T * FLY_T);
        b.spin = (rnd() - 0.5) * 2.2;
      }

      // ---------------- Burg auf der Abzweigung: Türme neben der Fahrbahn, Torbogen darüber ----------------
      const br = t.branches[g.k];
      const at = (m: number): number => br.first + Math.max(0, Math.min(br.count - 1, Math.round(m)));
      const tower = (m: number, sg: number, levels: number): void => {
        const s = at(m);
        const rot = Math.atan2(t.tx[s], t.tz[s]);
        const lat = sg * (t.wh[s] + 0.72);
        const bs = 1.4;
        const bh = detail ? 1.2 : 1.8;
        const n = detail ? levels : Math.ceil((levels * 1.2) / 1.8);
        for (let q = 0; q < n; q++) addBlock(P(s, 0, lat, q * bh + bh / 2), rot + (q % 2) * 0.12, bs, bh, bs, -1, false);
        if (detail) {
          for (const off of [-0.4, 0.4]) {
            const p = P(s, 0, lat, n * bh + 0.35);
            addBlock([p[0] + t.tx[s] * off, p[1], p[2] + t.tz[s] * off], rot, 0.6, 0.7, 0.6, -1, false);
          }
        }
      };
      const towers = detail ? [52, 64, 88, 99] : [56, 96];
      for (const m of towers) for (const sg of [-1, 1]) tower(m, sg, 3 + Math.floor(rnd() * 3));
      // Torbogen: zwei hohe Pfeiler, oben ein langer Balken (Unterkante gut 10 m über der Fahrbahn)
      {
        const m = 76;
        const s = at(m);
        const rot = Math.atan2(t.tx[s], t.tz[s]);
        const bh = detail ? 1.2 : 1.8;
        const n = Math.ceil(10.6 / bh);
        for (const sg of [-1, 1]) {
          const lat = sg * (t.wh[s] + 0.72);
          for (let q = 0; q < n; q++) addBlock(P(s, 0, lat, q * bh + bh / 2), rot + (q % 2) * 0.08, 1.4, bh, 1.4, -1, false);
        }
        const span = 2 * (t.wh[s] + 0.72) + 1.4;
        const top = n * bh;
        addBlock(P(s, 0, 0, top + 0.6), rot, span, 1.2, 1.6, -1, false);
        if (detail) for (const u of [-6, -2, 2, 6]) addBlock(P(s, 0, u, top + 1.2 + 0.4), rot, 1.2, 0.8, 1.2, -1, false);
      }
    }
  }

  // ======================================================================================
  // Netze
  // ======================================================================================

  // --- Körper (Toon, Kontur) ---
  const bodyGeo = body.build();
  const bodyMat = toonMaterial({ vertexColors: true });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.name = SIZER_MESH_BODY;
  group.add(bodyMesh);
  disposables.push(bodyGeo, bodyMat);
  if (detail) withOutline(bodyMesh, 0.05);
  let lintelMesh: THREE.Mesh | null = null;
  if (!lintel.empty) {
    const geo = lintel.build();
    lintelMesh = new THREE.Mesh(geo, bodyMat);
    lintelMesh.name = SIZER_MESH_LINTEL;
    group.add(lintelMesh);
    disposables.push(geo);
    if (detail) withOutline(lintelMesh, 0.05);
  }

  // --- Zeichen, Pfeile im Ring, Teppiche (ungeschattet, Ecken teils je Bild) ---
  const ARROW_RAYS = 6;
  const ARROW_PER = 2;
  const CARPET_N = Math.ceil(CARPET_LEN / CARPET_GAP);
  const staticTris = signs.triangles;
  const arrowFirst = staticTris * 3;
  const arrowTris = rings.length * ARROW_RAYS * ARROW_PER * 4;
  const carpetFirst = arrowFirst + arrowTris * 3;
  const carpetTris = rings.length * CARPET_N * 4;
  const totalVerts = carpetFirst + carpetTris * 3;
  const sGeoSrc = signs.build();
  const sPos = new Float32Array(totalVerts * 3);
  const sCol = new Float32Array(totalVerts * 3);
  sPos.set((sGeoSrc.getAttribute('position') as THREE.BufferAttribute).array as Float32Array);
  sCol.set((sGeoSrc.getAttribute('color') as THREE.BufferAttribute).array as Float32Array);
  sGeoSrc.dispose();
  const decalBackup = sPos.slice(decalFirst * 3, decalEnd * 3);
  rings.forEach((f, ri) => {
    const ca = f.grow ? C_ARROW_O : C_ARROW_B;
    const cc = f.grow ? C_ORANGE : C_BLUE;
    const a0 = arrowFirst + ri * ARROW_RAYS * ARROW_PER * 12;
    for (let v = 0; v < ARROW_RAYS * ARROW_PER * 12; v++) sCol.set(ca, (a0 + v) * 3);
    const c0 = carpetFirst + ri * CARPET_N * 12;
    for (let v = 0; v < CARPET_N * 12; v++) sCol.set(cc, (c0 + v) * 3);
    parts.push({ kind: 'pfeile', id: ri, mesh: SIZER_MESH_SIGNS, first: a0, count: ARROW_RAYS * ARROW_PER * 12, solid: false });
    parts.push({ kind: 'teppich', id: ri, mesh: SIZER_MESH_SIGNS, first: c0, count: CARPET_N * 12, solid: false });
  });
  const sGeo = new THREE.BufferGeometry();
  const sPosAttr = new THREE.BufferAttribute(sPos, 3);
  sPosAttr.setUsage(THREE.DynamicDrawUsage);
  sGeo.setAttribute('position', sPosAttr);
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const sMesh = new THREE.Mesh(sGeo, sMat);
  sMesh.name = SIZER_MESH_SIGNS;
  sMesh.frustumCulled = false;
  group.add(sMesh);
  disposables.push(sGeo, sMat);

  // --- Klötze ---
  let blockMesh: THREE.InstancedMesh | null = null;
  const blockGate = new Int8Array(blocks.length);
  const blockPassage = new Uint8Array(blocks.length);
  if (blocks.length > 0) {
    const geo = addSmoothNormals(new THREE.BoxGeometry(1, 1, 1));
    const mat = toonMaterial({ vertexColors: false });
    blockMesh = new THREE.InstancedMesh(geo, mat, blocks.length);
    blockMesh.name = SIZER_MESH_BLOCKS;
    blockMesh.frustumCulled = false;
    const col = new THREE.Color();
    blocks.forEach((b, i) => {
      blockMesh!.setColorAt(i, col.setHex(b.color));
      blockGate[i] = b.gate;
      blockPassage[i] = b.passage ? 1 : 0;
    });
    group.add(blockMesh);
    disposables.push(geo, mat, blockMesh);
    if (detail) {
      const ol = new THREE.InstancedMesh(geo, outlineMaterial(0.05), blocks.length);
      ol.instanceMatrix = blockMesh.instanceMatrix;
      ol.name = 'outline';
      ol.frustumCulled = false;
      group.add(ol);
      disposables.push(ol);
    }
  }

  // --- Schein (additiv; Eckenfarben je Bild) ---
  // Dazu: eine zarte Haut in jedem Ring, die ruhig atmet.
  const membraneFirst: number[] = [];
  const membraneCount: number[] = [];
  rings.forEach((f) => {
    membraneFirst.push(glowB.triangles * 3);
    const W = (u: number, v: number): V3 => {
      const l = f.mid + u;
      return [f.o[0] + f.r[0] * l, f.o[1] + l * f.bank + v, f.o[2] + f.r[2] * l];
    };
    const c = W(0, RING_HC * 0.7);
    const rim: V3[] = [W(-f.hw, 0.05), W(-f.hw, RING_HC)];
    for (let k = 1; k < 12; k++) {
      const a = Math.PI - (k / 12) * Math.PI;
      rim.push(W(f.hw * Math.cos(a), RING_HC + f.hw * Math.sin(a)));
    }
    rim.push(W(f.hw, RING_HC), W(f.hw, 0.05));
    for (let k = 0; k < rim.length; k++) glowB.tri(c, rim[k], rim[(k + 1) % rim.length], f.grow ? C_ORANGE : C_BLUE);
    membraneCount.push(glowB.triangles * 3 - membraneFirst[membraneFirst.length - 1]);
  });
  const gGeo = glowB.build();
  const gColAttr = gGeo.getAttribute('color') as THREE.BufferAttribute;
  gColAttr.setUsage(THREE.DynamicDrawUsage);
  const gBase = new Float32Array(gColAttr.array as Float32Array);
  const gMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const gMesh = new THREE.Mesh(gGeo, gMat);
  gMesh.name = SIZER_MESH_GLOW;
  gMesh.frustumCulled = false;
  gMesh.renderOrder = 2;
  group.add(gMesh);
  disposables.push(gGeo, gMat);
  const setGlow = (first: number, count: number, k: number): void => {
    const a = gColAttr.array as Float32Array;
    for (let i = first * 3, e = (first + count) * 3; i < e; i++) a[i] = gBase[i] * k;
  };
  for (const g of gates) setGlow(g.glowFirst, g.glowCount, 0);

  group.userData.sizers = { parts, blockGate, blockPassage, gates: gates.map((g) => ({ k: g.k, seg0: g.seg0, len: g.len, a: g.a, b: g.b, side: g.side, only: g.only })) };

  // ======================================================================================
  // Je Bild
  // ======================================================================================

  const tmpM = new THREE.Matrix4();
  const tmpP = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const qYaw = new THREE.Quaternion();
  const qRoll = new THREE.Quaternion();
  const qSpin = new THREE.Quaternion();
  const AX_Y = new THREE.Vector3(0, 1, 0);
  const AX_Z = new THREE.Vector3(0, 0, 1);
  const pt: V3 = [0, 0, 0];

  /** Klotz i an seiner Stelle: Flug u (0…1), Rückkehr e (0…1). */
  const placeBlock = (i: number, u: number, e: number): void => {
    const b = blocks[i];
    let x = b.x;
    let y = b.y;
    let z = b.z;
    let roll = 0;
    let spin = 0;
    if (u > 0) {
      const tt = u * FLY_T;
      x = b.x + (b.lx - b.x) * u;
      z = b.z + (b.lz - b.z) * u;
      y = b.y + b.vy * tt - (b.g * tt * tt) / 2;
      roll = b.roll * u;
      spin = b.spin * u;
      if (e > 0) {
        const k = smooth(e);
        x += (b.x - x) * k;
        y += (b.y - y) * k + Math.sin(Math.PI * k) * 1.4;
        z += (b.z - z) * k;
        roll *= 1 - k;
        spin *= 1 - k;
      }
    }
    qYaw.setFromAxisAngle(AX_Y, b.yaw + spin);
    qRoll.setFromAxisAngle(AX_Z, roll);
    qSpin.multiplyQuaternions(qYaw, qRoll);
    tmpP.set(x, y, z);
    tmpS.set(b.sx, b.sy, b.sz);
    tmpM.compose(tmpP, qSpin, tmpS);
    blockMesh!.setMatrixAt(i, tmpM);
  };
  if (blockMesh) {
    for (let i = 0; i < blocks.length; i++) placeBlock(i, 0, 0);
    blockMesh.instanceMatrix.needsUpdate = true;
  }

  /** Punkt u Meter vor der Ringebene, seitlich lat, um dy über der Fahrbahn. */
  const lanePoint = (f: RingFrame, u: number, lat: number, dy: number): V3 => {
    const q = u - 0.5;
    // hinter dem Mittelpunkt von seg (bis zur Ringebene) bzw. k Abschnitte davor
    const k = q <= 0 ? 0 : Math.min(f.chain.length - 1, Math.ceil(q));
    const s = f.chain[k];
    const ff = k - q;
    const j = t.next[s];
    const x0 = t.px[s] + rightX(t, s) * lat;
    const y0 = t.py[s] + lat * t.bank[s];
    const z0 = t.pz[s] + rightZ(t, s) * lat;
    pt[0] = x0 + (t.px[j] + rightX(t, j) * lat - x0) * ff;
    pt[1] = y0 + (t.py[j] + lat * t.bank[j] - y0) * ff + dy;
    pt[2] = z0 + (t.pz[j] + rightZ(t, j) * lat - z0) * ff;
    return pt;
  };
  const putV = (vi: number, p: V3): void => {
    sPos[vi * 3] = p[0];
    sPos[vi * 3 + 1] = p[1];
    sPos[vi * 3 + 2] = p[2];
  };
  const putXYZ = (vi: number, x: number, y: number, z: number): void => {
    sPos[vi * 3] = x;
    sPos[vi * 3 + 1] = y;
    sPos[vi * 3 + 2] = z;
  };
  /** Viereck (zwei Dreiecke) ab Ecke vi aus vier Punkten der Spur (u, lat). */
  const laneQuad = (f: RingFrame, vi: number, u0: number, l0: number, u1: number, l1: number, u2: number, l2: number, u3: number, l3: number): void => {
    putV(vi, lanePoint(f, u0, l0, CARPET_Y));
    putV(vi + 1, lanePoint(f, u1, l1, CARPET_Y));
    putV(vi + 2, lanePoint(f, u2, l2, CARPET_Y));
    putV(vi + 3, lanePoint(f, u0, l0, CARPET_Y));
    putV(vi + 4, lanePoint(f, u2, l2, CARPET_Y));
    putV(vi + 5, lanePoint(f, u3, l3, CARPET_Y));
  };
  /** Punkt in der Ringebene (u seitlich ab Mitte der Spur, v Höhe über der Fahrbahn). */
  const ringXYZ = (f: RingFrame, u: number, v: number, vi: number): void => {
    const l = f.mid + u;
    putXYZ(vi, f.o[0] + f.r[0] * l, f.o[1] + l * f.bank + v, f.o[2] + f.r[2] * l);
  };

  // Kamera (aus update) und ob der Sturz über dem Mauseloch gerade ausgeblendet ist
  const camP = new THREE.Vector3();
  let lintelHide = 0;
  /** Sturz samt Einfassung zeigen bzw. verbergen. */
  const showLintel = (show: boolean): void => {
    if (!lintelMesh || lintelMesh.visible === show) return;
    lintelMesh.visible = show;
    if (show) sPos.set(decalBackup, decalFirst * 3);
    else for (let i = decalFirst * 3; i < decalEnd * 3; i++) sPos[i] = sPos[decalFirst * 3 + (i % 3)];
    sPosAttr.needsUpdate = true;
  };

  // Blitz-Zustand der Klotzmauer
  let burst = false;
  let flyU = 0;
  let backE = 0;
  let age = 0;
  let hold = 0;

  return {
    group,
    update(_time, seconds, _dt, cam) {
      camP.copy(cam);
      // --- Pfeile im Ring: wandern zur Mitte (schrumpfen) bzw. aus ihr heraus (wachsen) ---
      for (let ri = 0; ri < rings.length; ri++) {
        const f = rings[ri];
        let vi = arrowFirst + ri * ARROW_RAYS * ARROW_PER * 12;
        for (let a = 0; a < ARROW_RAYS; a++) {
          const ang = Math.PI / 2 + (a / ARROW_RAYS) * Math.PI * 2;
          const cu = Math.cos(ang);
          const sv = Math.sin(ang);
          // Rand der lichten Öffnung in dieser Richtung (oben Halbkreis um die Mitte, unten Rechteck bis zur Fahrbahn)
          let rmax = f.hw;
          if (sv < 0) rmax = Math.min(Math.abs(cu) > 1e-3 ? f.hw / Math.abs(cu) : 99, RING_HC / -sv);
          rmax -= 0.45;
          const rmin = 0.35;
          for (let c = 0; c < ARROW_PER; c++) {
            const p = (seconds * 0.45 + c / ARROW_PER + a * 0.013) % 1;
            const r = f.grow ? rmin + (rmax - rmin) * p : rmax - (rmax - rmin) * p;
            const fade = Math.sin(Math.PI * p);
            const sz = fade * (f.grow ? 0.45 + 0.55 * p : 1 - 0.55 * p) * 0.95;
            // Richtung der Bewegung (auf die Mitte zu bzw. von ihr weg) und quer dazu
            const dir = f.grow ? 1 : -1;
            const du = cu * dir;
            const dv = sv * dir;
            const pu = -dv;
            const pv = du;
            const mu = cu * r;
            const mv = RING_HC + sv * r;
            const tipU = mu + du * sz * 0.5;
            const tipV = mv + dv * sz * 0.5;
            const th = 0.42 * sz;
            for (let sg = -1; sg <= 1; sg += 2) {
              const eu = mu - du * sz * 0.5 + pu * sg * sz * 0.8;
              const ev = mv - dv * sz * 0.5 + pv * sg * sz * 0.8;
              ringXYZ(f, tipU, tipV, vi);
              ringXYZ(f, eu, ev, vi + 1);
              ringXYZ(f, eu - du * th, ev - dv * th, vi + 2);
              ringXYZ(f, tipU, tipV, vi + 3);
              ringXYZ(f, eu - du * th, ev - dv * th, vi + 4);
              ringXYZ(f, tipU - du * th, tipV - dv * th, vi + 5);
              vi += 6;
            }
          }
        }
        // --- Teppich: Winkel laufen auf der Spur zum Ring ---
        vi = carpetFirst + ri * CARPET_N * 12;
        const hw2 = f.hw - 0.35;
        const ph = (seconds * CARPET_SPEED) % CARPET_GAP;
        for (let c = 0; c < CARPET_N; c++) {
          const u = CARPET_LEN + 1 - (c * CARPET_GAP + ph);
          const sc = smooth((u - 1) / 2.5) * smooth((CARPET_LEN + 1 - u) / 4);
          const dep = 1.5 * sc;
          const th = 0.75 * sc;
          const w = hw2 * sc;
          const m = f.mid;
          laneQuad(f, vi, u, m, u + dep, m - w, u + dep + th, m - w, u + th, m);
          laneQuad(f, vi + 6, u, m, u + th, m, u + dep + th, m + w, u + dep, m + w);
          vi += 12;
        }
      }
      sPosAttr.needsUpdate = true;
      // --- Haut in den Ringen: atmet ruhig ---
      for (let ri = 0; ri < rings.length; ri++) setGlow(membraneFirst[ri], membraneCount[ri], 0.2 + 0.07 * Math.sin(seconds * 2.1 + ri));
      gColAttr.needsUpdate = true;
    },
    observe(karts: readonly RenderEntity[], dt: number, fx: FxSink) {
      let trig = false;
      for (const g of gates) {
        let zone = 0;
        for (const e of karts) {
          if (sizeClass(e.size) !== g.only || e.slot > 30) continue;
          const bo = t.branchOf[e.seg];
          const br = t.branches[g.k];
          let near = false;
          let mainSeg = -1;
          if (bo === g.k) near = e.seg - br.first < g.len;
          else if (bo < 0) {
            const before = (g.twin0 - e.seg + t.n) % t.n;
            const into = (e.seg - g.twin0 + t.n) % t.n;
            if (before <= FLASH_REACH || into <= g.len) near = true;
            if (before <= BURST_REACH || into <= g.b + 2) mainSeg = e.seg;
          }
          if (near) zone |= 1 << e.slot;
          // Riesiges Kart auf die Klotzmauer zu?
          if (g.only > 0) {
            if (bo === g.k && e.seg - br.first < g.len) trig = true;
            else if (mainSeg >= 0) {
              const rx = rightX(t, mainSeg);
              const rz = rightZ(t, mainSeg);
              const lat = (e.x - t.px[mainSeg]) * rx + (e.z - t.pz[mainSeg]) * rz;
              const vl = e.vx * rx + e.vz * rz;
              if ((lat + vl * BURST_LOOK) * g.side > t.wh[mainSeg] - 2.5) trig = true;
            }
          }
        }
        // Aufleuchten: ruhig, einmal je Kart, das neu herankommt
        if ((zone & ~g.inZone) !== 0) g.flash = 0;
        g.inZone = zone;
        g.flash = Math.min(1, g.flash + dt / FLASH_T);
        setGlow(g.glowFirst, g.glowCount, g.flash < 1 ? Math.sin(Math.PI * g.flash) * 0.9 : 0);
      }
      gColAttr.needsUpdate = true;

      // --- Sturz über dem Mauseloch: Fährt das Kart, hinter dem diese Kamera hängt (das nächste), winzig durch den
      // Bogen, stünde die Kamera vor der Wand darüber – solange wird der Sturz ausgeblendet. ---
      if (lintelMesh && lintelGate) {
        const lg = lintelGate;
        let want = false;
        let best = -1;
        let bd = 400;
        for (let s = Math.floor(lintelA) - 6; s <= Math.ceil(lintelB) + 2; s++) {
          const m = (((lg.seg0 + s) % t.n) + t.n) % t.n;
          const d = (camP.x - t.px[m]) ** 2 + (camP.z - t.pz[m]) ** 2;
          if (d < bd) {
            bd = d;
            best = m;
          }
        }
        if (best >= 0) {
          const latC = ((camP.x - t.px[best]) * rightX(t, best) + (camP.z - t.pz[best]) * rightZ(t, best)) * lg.side;
          if (latC > t.wh[best] - 4 && camP.y - t.py[best] < BOARD_H + 3) {
            let near: RenderEntity | null = null;
            let nd = 14 * 14;
            for (const e of karts) {
              const d = (e.x - camP.x) ** 2 + (e.z - camP.z) ** 2;
              if (d < nd) {
                nd = d;
                near = e;
              }
            }
            if (near && near.size < 0) {
              const bo = t.branchOf[near.seg];
              if (bo === lg.k) want = true;
              else if (bo < 0) {
                const lat = ((near.x - t.px[near.seg]) * rightX(t, near.seg) + (near.z - t.pz[near.seg]) * rightZ(t, near.seg)) * lg.side;
                want = lat > t.wh[near.seg] - 3.5;
              }
            }
          }
        }
        lintelHide = want ? 0.4 : lintelHide - dt;
        showLintel(lintelHide <= 0);
      }

      // --- Klotzmauer ---
      if (!blockMesh) return;
      if (!burst) {
        if (!trig) return;
        burst = true;
        flyU = 0;
        backE = 0;
        age = 0;
        hold = 0;
        if (detail) {
          for (let i = 0; i < blocks.length; i += 3) {
            const b = blocks[i];
            if (b.passage) fx.puff(b.x, b.y - 0.3, b.z, (b.lx - b.x) * 0.3, 1.2, (b.lz - b.z) * 0.3, 0.7, 1.4, 0xd9c7a8, 1.2, -0.5);
          }
        }
      }
      age += dt;
      hold = trig ? 0 : hold + dt;
      const was = flyU;
      flyU = Math.min(1, flyU + dt / FLY_T);
      const wantBack = age >= BACK_AFTER && hold >= 1;
      backE = Math.max(0, Math.min(1, backE + (wantBack ? dt : -dt) / BACK_T));
      if (detail && was < 1 && flyU >= 1) {
        for (let i = 0; i < blocks.length; i += 2) {
          const b = blocks[i];
          if (b.passage) fx.puff(b.lx, b.ly - 0.3, b.lz, 0, 0.8, 0, 0.6, 1.1, 0xd9c7a8, 1.5, 0);
        }
      }
      const done = wantBack && backE >= 1;
      for (let i = 0; i < blocks.length; i++) if (blocks[i].passage) placeBlock(i, done ? 0 : flyU, done ? 0 : backE);
      blockMesh.instanceMatrix.needsUpdate = true;
      if (done) burst = false;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
