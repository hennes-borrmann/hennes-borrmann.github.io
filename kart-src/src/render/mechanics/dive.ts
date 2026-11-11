// Tiefseeriff: alles, was das Tauchen lesbar macht.
//
// Die Physik (game/mechanics.ts „Tauchen“, game/sim.ts) kennt unter Wasser nur
// Zahlen: Strömungen (Belt mit swim) mit Tempo längs/quer, Blasenschlote
// (PULSE_BUBBLE) mit Takt und Radius, Lücken (EDGE_GAP). Hier bekommen sie ein
// Gesicht – überall dieselbe Farbsprache wie bei den Bändern im Werkshof:
//   * Türkis-Weiß = zieht mit, Magenta/Orange = kommt entgegen (meiden!),
//     Gelb = schiebt zur Seite. Die Pfeile wandern genau mit dem Tempo der
//     Strömung (m/s wie in der Physik) in ihre Richtung.
//   * Strömung: treibende Stromlinien in zwei, drei Höhen (0,4–2,4 m) – lange,
//     schmale Pfeilbänder, die sich stets zur Kamera drehen (nie hauchdünn von
//     der Kante); am Boden ein zartes Wellenmuster aus Winkeln, die in
//     Strömungsrichtung laufen; am Rand Seegras, das sich mit der Strömung
//     biegt (detail); mittreibende Teilchen in Kameranähe (detail). Zu den
//     Rändern hin wird alles durchsichtiger – wie die Wirkung (BELT_EDGE,
//     BELT_RAMP).
//   * Blasenschlot: Felsring am Boden mit Leuchtrand, Kreis aus Strichen bis an
//     den Rand der Wirkung (radius). Bläst er, steht über ihm eine dichte
//     Blasensäule (bis 5 m, so hoch hebt die Physik) mit hellem Kern, darin
//     wandern Ringe nach oben, der Leuchtrand strahlt weiß. In der Pause nur
//     einzelne Bläschen und ein matter Rand; kurz vor dem Beginn (pulseWarning)
//     blinkt der Rand gelb, immer schneller, und die Säule schwillt an.
//   * Lücke (Graben): Warnstreifen und Blinklampen an der Absprungkante,
//     Leuchtalgen und Lampen an der Landekante, Leuchtbojen in der Lücke auf
//     Flughöhe links und rechts – eine Linie, an der man den Sprung ausrichtet.
//
// Der Takt der Schlote hängt an `time` (Rennzeit in Ticks), alles andere ist
// Zierde und läuft mit `seconds`.
//
// Zeichenaufrufe (höchstens 4): Fels, Pfosten, Bojen (toon) samt Kontur,
// Seegras (toon mit Biegung, nur detail) und ein Shader für alles
// Durchscheinende (Stromlinien, Bodenwellen, Blasen, Ringe, Leuchtränder,
// Lampen). Ohne detail: keine Konturen, kein Seegras, keine Teilchen und
// weniger Stromlinien.

import * as THREE from 'three';
import { BELT_EDGE, BELT_RAMP, PULSE_BUBBLE, pulseCycle, pulseWarning, type Belt, type Pulse } from '../../game/mechanics';
import { EDGE_GAP, EDGE_GLIDE, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { stripedFace } from './machineKit';

// --- Farben (Vertexfarben, linear) ----------------------------------------------------

const C_INK = rgb(0x16131c);
const C_ROCK = rgb(0x354261);
const C_ROCK_HI = rgb(0x53658f);
const C_CORAL = rgb(0xff7a8c);
const C_HOLE = rgb(0x06202c);
const C_WARN = rgb(0xffd23a);
const C_LAND = rgb(0x34f0c4);
const C_LAND_HI = rgb(0xeafff8);
const C_POST = rgb(0x2a3452);
const C_POST_HI = rgb(0x46557e);
const C_LAMP = rgb(0x1a2033);
const C_BUOY_A = rgb(0xff5068);
const C_BUOY_B = rgb(0xf6fbff);
const C_CHAIN = rgb(0x2a3040);
const C_GRASS = [rgb(0x1f9a62), rgb(0x2fbf7a), rgb(0x4ad68a)];
const C_GRASS_TIP = rgb(0xb4f07a);

/** Teilchenfarben je Art der Strömung: mit, entgegen, quer. */
const FX_COL = [0xd8ffff, 0xff6ab4, 0xffe066];

// --- Maße ----------------------------------------------------------------------------

/** Höhe der Blasensäule (die Physik hebt bis 5 m über dem Schlot). */
const COLUMN_H = 5;
/** Stromlinien: Höhen über der Fahrbahn und halbe Breite des Bands (Pfeilspitze). */
const LINE_H = [0.45, 1.35, 2.3];
const LINE_HALF = 0.2;
/** Stromlinien längs: Abstand der Stützpunkte (Abschnitte). Bodenwellen: dito. */
const LINE_STEP = 3;
const FLOOR_STEP = 2;
/** Querströmung: Abstand der Pfeilreihen längs der Strecke (Meter). */
const ROW_GAP = 3.2;
/** Sichtbare Rampe der Stromlinien an Anfang und Ende (etwas weicher als die Physik). */
const LINE_RAMP = BELT_RAMP * 2;
/** Teilchen nur bis zu dieser Entfernung von der Kamera. */
const FX_NEAR = 45;
/**
 * Flughöhe der Bojen über der Absprungkante: Bogen, wie ihn ein Kart mit vollem Tempo
 * unter Wasser von der Schanze fliegt (gemessen: +1,4 m nach einem Fünftel der Lücke,
 * +2,6 m in der Mitte, +3 m am Ende), dazu die halbe Karthöhe.
 */
const BUOY_ARC = 3.2;
const BUOY_LIFT = 0.6;

// --- Arten im Shader ------------------------------------------------------------------

const K_LINE = 0;
const K_FLOOR = 1;
const K_COLUMN = 2;
const K_RIM = 4;
const K_LAMP = 5;

/** Farben der Strömung (im Shader): 0 mit, 1 entgegen, 2 quer. */
const F_WITH = 0;
const F_AGAINST = 1;
const F_ACROSS = 2;

/** Lampen: Farbe (0 orange, 1 Algengrün, 2 Türkis) und Art des Blinkens (0 Warnblinker, 1 Welle, 2 Lauflicht). */
const L_ORANGE = 0;
const L_ALGAE = 1;
const L_CYAN = 2;
const M_BLINK = 0;
const M_WAVE = 1;
const M_RUN = 2;

export function buildDive(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  group.name = 'tauchen';
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(8100 + t.index * 17);

  /** Punkt auf der Fahrbahn: Abschnitt s, seitlich lat, dy darüber. */
  const P = (s: number, lat: number, dy: number): V3 => [t.px[s] + rightX(t, s) * lat, t.py[s] + lat * t.bank[s] + dy, t.pz[s] + rightZ(t, s) * lat];
  /** Punkt zwischen Abschnitt a und b (Anteil f). */
  const PL = (a: number, b: number, f: number, lat: number, dy: number): V3 => {
    const A = P(a, lat, dy);
    const B = P(b, lat, dy);
    return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f];
  };

  // === Durchscheinendes: ein Netz, ein Shader ================================================
  const pos: number[] = [];
  const kd: number[] = [];
  const aa: number[] = [];
  const ab: number[] = [];
  const vert = (p: V3, k: number, a0: number, a1: number, a2: number, a3: number, b0: number, b1: number, b2: number, b3: number): void => {
    pos.push(p[0], p[1], p[2]);
    kd.push(k);
    aa.push(a0, a1, a2, a3);
    ab.push(b0, b1, b2, b3);
  };

  const solid = new MeshBuilder();
  /** Was eine Kontur bekommt (Fels, Pfosten, Bojen) – Seegras nicht. */
  const inked = new MeshBuilder();
  const both = {
    quad(a: V3, b: V3, c: V3, d: V3, col: RGB): void {
      solid.quad(a, b, c, d, col);
      inked.quad(a, b, c, d, col);
    },
    tri(a: V3, b: V3, c: V3, col: RGB): void {
      solid.tri(a, b, c, col);
      inked.tri(a, b, c, col);
    },
  };

  // --- Strömungen -------------------------------------------------------------------------
  const currents = t.belts.filter((b) => b.swim);
  interface CurrentView {
    b: Belt;
    segs: number[];
    dist: number[];
    length: number;
    quer: boolean;
    acc: number;
  }
  const views: CurrentView[] = [];

  // Seegras: Halme als Bänder, die im Shader in Strömungsrichtung gebogen werden.
  const gPos: number[] = [];
  const gCol: number[] = [];
  const gBend: number[] = [];
  const blade = (x: number, y: number, z: number, yaw: number, h: number, w: number, bx: number, bz: number, amp: number, col: RGB): void => {
    const N = 4;
    const cx = Math.cos(yaw);
    const cz = Math.sin(yaw);
    const ring: [number, number, number, number][] = [];
    for (let k = 0; k <= N; k++) {
      const f = k / N;
      const ww = w * (1 - f * 0.85);
      ring.push([f, ww, y + h * f, 0.05 * Math.sin(f * 3 + yaw) * h]);
    }
    const push = (f: number, side: number, yy: number, curl: number): void => {
      const ww = w * (1 - f * 0.85) * side;
      gPos.push(x + cx * ww + -cz * curl, yy, z + cz * ww + cx * curl);
      const c = f > 0.75 ? C_GRASS_TIP : col;
      const sh = 0.7 + 0.3 * f;
      gCol.push(c[0] * sh, c[1] * sh, c[2] * sh);
      gBend.push(bx, bz, f, amp);
    };
    for (let k = 0; k < N; k++) {
      const [f0, , y0, c0] = ring[k];
      const [f1, , y1, c1] = ring[k + 1];
      push(f0, -1, y0, c0);
      push(f0, 1, y0, c0);
      push(f1, 1, y1, c1);
      push(f0, -1, y0, c0);
      push(f1, 1, y1, c1);
      push(f1, -1, y1, c1);
    }
  };
  const clump = (s: number, lat: number, bx: number, bz: number, amp: number): void => {
    const base = P(s, lat, -0.7);
    const n = 3 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.5;
      blade(base[0] + Math.cos(a) * r, base[1], base[2] + Math.sin(a) * r, rnd() * Math.PI, 2.2 + rnd() * 1.3, 0.14 + rnd() * 0.08, bx, bz, amp * (0.8 + rnd() * 0.4), C_GRASS[k % 3]);
    }
  };

  for (const b of currents) {
    const segs: number[] = [];
    for (let i = 0; i < b.count; i++) segs.push(b.first + i);
    segs.push(t.next[b.first + b.count - 1]);
    const dist: number[] = [0];
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1];
      const c = segs[i];
      dist.push(dist[i - 1] + Math.hypot(t.px[c] - t.px[a], t.pz[c] - t.pz[a]));
    }
    const L = dist[dist.length - 1];
    const quer = Math.abs(b.across) > Math.abs(b.along);
    const speed = quer ? b.across : b.along;
    const sgn = speed >= 0 ? 1 : -1;
    const col = quer ? F_ACROSS : speed > 0 ? F_WITH : F_AGAINST;
    views.push({ b, segs, dist, length: L, quer, acc: 0 });
    const W = b.lat1 - b.lat0;
    /** Wirkung an Anfang/Ende (wie sim.ts, auf die Stützpunkte gerechnet). */
    const endK = (u: number): number => Math.max(0, Math.min(1, Math.min(u, L - u) / BELT_RAMP));
    const endLine = (u: number): number => smooth(Math.min(u, L - u) / LINE_RAMP);
    const sideK = (lat: number): number => Math.max(0, Math.min(1, Math.min(lat - b.lat0, b.lat1 - lat) / BELT_EDGE));
    /** Ort längs des Bands (Meter) → Abschnittsindex und Anteil. */
    const at = (u: number): [number, number, number] => {
      let i = 0;
      while (i + 2 < dist.length && dist[i + 1] < u) i++;
      const f = Math.max(0, Math.min(1, (u - dist[i]) / Math.max(1e-6, dist[i + 1] - dist[i])));
      return [segs[i], segs[i + 1], f];
    };

    // Bodenwellen: Winkel, die in Strömungsrichtung laufen (2 cm über der Fahrbahn).
    const lats = [b.lat0, b.lat0 + BELT_EDGE, b.lat1 - BELT_EDGE, b.lat1];
    const mid = (b.lat0 + b.lat1) / 2;
    const pick: number[] = [];
    for (let i = 0; i < segs.length - 1; i += FLOOR_STEP) pick.push(i);
    pick.push(segs.length - 1);
    for (let q = 0; q + 1 < pick.length; q++) {
      const i0 = pick[q];
      const i1 = pick[q + 1];
      for (let l = 0; l + 1 < lats.length; l++) {
        const corner = (i: number, lat: number): void => {
          const u = dist[i];
          const fl = endK(u) * sideK(lat);
          const fx = quer ? rightX(t, segs[i]) * sgn : t.tx[segs[i]] * sgn;
          const fz = quer ? rightZ(t, segs[i]) * sgn : t.tz[segs[i]] * sgn;
          // m: Lage in Strömungsrichtung, n: quer dazu ab der Mitte (Winkelarme).
          const m = quer ? sgn * lat : sgn * u;
          const n = quer ? (u - L / 2) * 0.35 : lat - mid;
          vert(P(segs[i], lat, 0.02), K_FLOOR, fx, fz, 0, col, m, n, Math.abs(speed), fl);
        };
        corner(i0, lats[l]);
        corner(i0, lats[l + 1]);
        corner(i1, lats[l + 1]);
        corner(i0, lats[l]);
        corner(i1, lats[l + 1]);
        corner(i1, lats[l]);
      }
    }

    // Stromlinien
    const ribbon = (pts: { p: V3; dx: number; dz: number; m: number; fade: number }[]): void => {
      for (let q = 0; q + 1 < pts.length; q++) {
        const A = pts[q];
        const B = pts[q + 1];
        const v = (Q: typeof A, side: number): void => vert(Q.p, K_LINE, Q.dx, Q.dz, side, LINE_HALF, Q.m, Math.abs(speed), Q.fade, col);
        v(A, -1);
        v(A, 1);
        v(B, 1);
        v(A, -1);
        v(B, 1);
        v(B, -1);
      }
    };
    if (!quer) {
      const nLines = Math.max(detail ? 2 : 1, Math.round(W / (detail ? 1.9 : 2.8)));
      const layers = detail ? 2 : 1;
      const lp: number[] = [];
      for (let i = 0; i < segs.length - 1; i += LINE_STEP) lp.push(i);
      lp.push(segs.length - 1);
      for (let k = 0; k < nLines; k++) {
        for (let layer = 0; layer < layers; layer++) {
          const lat = b.lat0 + ((k + 0.5 + (layer ? 0.35 : 0) - 0.175) / nLines) * W;
          const h = LINE_H[(k + layer * 2 + (detail ? 0 : 1)) % 3];
          const seed = rnd() * 40;
          const sk = sideK(lat);
          ribbon(
            lp.map((i) => ({
              p: P(segs[i], lat, h),
              dx: t.tx[segs[i]],
              dz: t.tz[segs[i]],
              m: sgn * dist[i] + seed,
              fade: endLine(dist[i]) * sk,
            })),
          );
        }
      }
    } else {
      const rows = Math.max(1, Math.round(L / (detail ? ROW_GAP : ROW_GAP * 2)));
      const layers = detail ? 2 : 1;
      for (let r = 0; r < rows; r++) {
        const u = ((r + 0.5) / rows) * L;
        const [a, c, f] = at(u);
        for (let layer = 0; layer < layers; layer++) {
          const h = LINE_H[(r + layer * 2 + (detail ? 0 : 1)) % 3];
          const seed = rnd() * 40;
          const uu = u + (layer ? 0.6 : 0);
          const pts: { p: V3; dx: number; dz: number; m: number; fade: number }[] = [];
          const N = 5;
          for (let k = 0; k <= N; k++) {
            const lat = b.lat0 + (k / N) * W;
            const fe = Math.max(0, Math.min(1, Math.min(lat - b.lat0, b.lat1 - lat) / 1.4));
            pts.push({ p: PL(a, c, f, lat, h), dx: rightX(t, a), dz: rightZ(t, a), m: sgn * lat + seed, fade: endLine(uu) * fe });
          }
          ribbon(pts);
        }
      }
    }

    // Seegras am Rand (detail): biegt sich in Strömungsrichtung.
    if (detail) {
      const amp = Math.min(1.4, Math.abs(speed) * 0.26);
      for (const side of [-1, 1]) {
        // Nur dort, wo die Strömung bis an den Rand der Fahrbahn reicht.
        const edge = side > 0 ? b.lat1 : b.lat0;
        if (!quer && Math.abs(edge) < t.rh[b.first] - 0.6) continue;
        if (!quer && Math.sign(edge) !== side) continue;
        for (let u = 1.5; u < L - 1; u += 3.6 + rnd() * 1.6) {
          const [a, , ] = at(u);
          const bx = quer ? rightX(t, a) * sgn : t.tx[a] * sgn;
          const bz = quer ? rightZ(t, a) * sgn : t.tz[a] * sgn;
          clump(a, side * (t.wh[a] + 0.7 + rnd() * 1.4), bx, bz, amp * endK(u) + 0.08);
        }
      }
    }
  }

  // --- Blasenschlote ----------------------------------------------------------------------
  const vents: Pulse[] = t.pulses.filter((p) => p.kind === PULSE_BUBBLE);
  const NV = Math.max(1, vents.length);
  const SEG = 16;
  const ventAcc = vents.map(() => 0);
  vents.forEach((p, vi) => {
    const s = p.seg;
    const rx = rightX(t, s);
    const rz = rightZ(t, s);
    const fx = t.tx[s];
    const fz = t.tz[s];
    const slope = (t.py[t.next[s]] - t.py[t.prev[s]]) / (2 * t.step);
    /** Ecke auf dem Boden um den Schlot: Winkel a, Radius r, lift darüber. */
    const G = (a: number, r: number, lift: number): V3 => {
      const u = Math.cos(a) * r;
      const w = Math.sin(a) * r;
      return [p.x + rx * u + fx * w, p.y + u * t.bank[s] + w * slope + lift, p.z + rz * u + fz * w];
    };
    const jag: number[] = [];
    for (let i = 0; i < SEG; i++) jag.push(0.9 + rnd() * 0.2);
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2;
      const a1 = ((i + 1) / SEG) * Math.PI * 2;
      const j0 = jag[i];
      const j1 = jag[(i + 1) % SEG];
      const h0 = 0.26 + (j0 - 0.9) * 0.8;
      const h1 = 0.26 + (j1 - 0.9) * 0.8;
      // Schlund, Innenwand, Krone, Außenflanke
      solid.tri(G(a0, 0, 0.015), G(a1, 0.62, 0.015), G(a0, 0.62, 0.015), C_HOLE);
      both.quad(G(a0, 0.62, 0.015), G(a1, 0.62, 0.015), G(a1, 0.66 * j1, h1), G(a0, 0.66 * j0, h0), shade(C_ROCK, 0.7));
      both.quad(G(a0, 0.66 * j0, h0), G(a1, 0.66 * j1, h1), G(a1, 1.05 * j1, h1), G(a0, 1.05 * j0, h0), i % 4 === 0 ? C_CORAL : i % 2 === 0 ? C_ROCK_HI : C_ROCK);
      both.quad(G(a0, 1.05 * j0, h0), G(a1, 1.05 * j1, h1), G(a1, 1.45, 0.01), G(a0, 1.45, 0.01), shade(C_ROCK, 0.85));
      // Leuchtrand auf der Krone (Shader: strahlt im Takt)
      const rim = (A: V3, k: number): void => vert(A, K_RIM, vi, 0, k, 0, 0, 0, 0, 0);
      const r0 = G(a0, 0.7 * j0, h0 + 0.012);
      const r1 = G(a1, 0.7 * j1, h1 + 0.012);
      const r2 = G(a1, 0.98 * j1, h1 + 0.012);
      const r3 = G(a0, 0.98 * j0, h0 + 0.012);
      rim(r0, i / SEG);
      rim(r1, (i + 1) / SEG);
      rim(r2, (i + 1) / SEG);
      rim(r0, i / SEG);
      rim(r2, (i + 1) / SEG);
      rim(r3, i / SEG);
    }
    // Strichkreis bis an den Rand der Wirkung
    const FS = 36;
    for (let i = 0; i < FS; i++) {
      const a0 = (i / FS) * Math.PI * 2;
      const a1 = ((i + 1) / FS) * Math.PI * 2;
      const R0 = p.radius - 0.28;
      const R1 = p.radius;
      const foot = (A: V3, k: number): void => vert(A, K_RIM, vi, 1, k, 0, 0, 0, 0, 0);
      foot(G(a0, R0, 0.03), i / FS);
      foot(G(a1, R0, 0.03), (i + 1) / FS);
      foot(G(a1, R1, 0.03), (i + 1) / FS);
      foot(G(a0, R0, 0.03), i / FS);
      foot(G(a1, R1, 0.03), (i + 1) / FS);
      foot(G(a0, R1, 0.03), i / FS);
    }
    // Blasensäule: zwei zur Kamera gedrehte Tafeln
    const c: V3 = [p.x, p.y + 0.1, p.z];
    for (let layer = 0; layer < 2; layer++) {
      const seed = rnd() * 10;
      const v = (u: number, w: number): void => vert(c, K_COLUMN, u, w, vi, layer, p.radius, COLUMN_H, seed, 0);
      v(-1, 0);
      v(1, 0);
      v(1, 1);
      v(-1, 0);
      v(1, 1);
      v(-1, 1);
    }
  });

  // --- Lampen (Graben) ----------------------------------------------------------------
  const lamp = (p: V3, size: number, color: number, mode: number, phase: number): void => {
    const v = (u: number, w: number): void => vert(p, K_LAMP, u, w, size, color, phase, mode, 0, 0);
    v(-1, -1);
    v(1, -1);
    v(1, 1);
    v(-1, -1);
    v(1, 1);
    v(-1, 1);
  };
  /** Pfosten mit Lampenkopf neben der Fahrbahn. */
  const post = (base: V3, h: number, color: number, mode: number, phase: number): void => {
    const [x, y, z] = base;
    const r = 0.17;
    const p4: [number, number][] = [
      [r, r],
      [-r, r],
      [-r, -r],
      [r, -r],
    ];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = p4[k];
      const [bx, bz] = p4[(k + 1) % 4];
      both.quad([x + ax, y - 1.2, z + az], [x + bx, y - 1.2, z + bz], [x + bx, y + h, z + bz], [x + ax, y + h, z + az], k % 2 === 0 ? C_POST : C_POST_HI);
    }
    const hr = 0.36;
    const top = y + h;
    const box: [number, number][] = [
      [hr, hr],
      [-hr, hr],
      [-hr, -hr],
      [hr, -hr],
    ];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = box[k];
      const [bx, bz] = box[(k + 1) % 4];
      both.quad([x + ax, top, z + az], [x + bx, top, z + bz], [x + bx, top + 0.25, z + bz], [x + ax, top + 0.25, z + az], C_LAMP);
    }
    both.quad([x + hr, top + 0.25, z + hr], [x + hr, top + 0.25, z - hr], [x - hr, top + 0.25, z - hr], [x - hr, top + 0.25, z + hr], C_LAMP);
    lamp([x, top + 0.75, z], 0.95, color, mode, phase);
  };

  // --- Lücken unter Wasser (Graben) --------------------------------------------------------
  const runs: [number, number][] = [];
  for (let i = 0; i < t.total; i++) {
    const e = t.edge[i];
    if (!(e & EDGE_GAP) || e & EDGE_GLIDE || !t.deep[i]) continue;
    const pv = t.prev[i];
    if (pv >= 0 && t.edge[pv] & EDGE_GAP) continue;
    let j = i;
    while (t.edge[t.next[j]] & EDGE_GAP && t.next[j] !== i) j = t.next[j];
    runs.push([i, j]);
  }
  const buoyGeo = new THREE.IcosahedronGeometry(0.55, 1).toNonIndexed();
  for (const [g0, g1] of runs) {
    const s0 = t.prev[g0];
    const s1 = t.next[g1];
    const UP: V3 = [0, 1, 0];
    // Absprungkante: wo für Physik und Bild die Fahrbahn endet (halber Weg zum Lückenabschnitt).
    const rh0 = t.rh[s0];
    const wh0 = t.wh[s0];
    const lip = (lat: number, dy: number): V3 => PL(s0, g0, 0.5, lat, dy);
    /** m Meter vor der Kante zurück, auf der Fahrbahn (folgt der Schanze). */
    const back = (lat: number, dy: number, m: number): V3 => {
      let a = s0;
      let b = g0;
      let f = 0.5 - m / t.step;
      while (f < 0) {
        b = a;
        a = t.prev[a];
        f += 1;
      }
      return PL(a, b, f, lat, dy);
    };
    const fwd0: V3 = [t.tx[s0], 0, t.tz[s0]];
    // Warnstreifen auf den letzten 1,4 m und an der Stirn der Kante
    stripedFace(solid, back(-rh0, 0.035, 1.4), back(rh0, 0.035, 1.4), lip(rh0, 0.035), lip(-rh0, 0.035), UP, C_WARN, C_INK, 0.55);
    // Stirnflächen ein Stück vor die der Welt gesetzt, sonst flimmern sie mit ihr.
    const off = (q: V3, d: V3, m: number): V3 => [q[0] + d[0] * m, q[1], q[2] + d[2] * m];
    stripedFace(solid, off(lip(-wh0, 0.03), fwd0, 0.08), off(lip(wh0, 0.03), fwd0, 0.08), off(lip(wh0, -2.2), fwd0, 0.08), off(lip(-wh0, -2.2), fwd0, 0.08), fwd0, C_WARN, C_INK, 0.55);
    for (const side of [-1, 1]) {
      post(lip(side * (wh0 + 0.5), 0), 2.4, L_ORANGE, M_BLINK, side > 0 ? 0.5 : 0);
      post(back(side * (wh0 + 0.5), 0, 6), 1.8, L_ORANGE, M_BLINK, side > 0 ? 0.25 : 0.75);
    }
    // Landekante: Streifen an der Stirn, Leuchtalgen auf der Kante, Lampen daneben
    const rh1 = t.rh[s1];
    const wh1 = t.wh[s1];
    const land = (lat: number, dy: number): V3 => PL(g1, s1, 0.5, lat, dy);
    const bwd1: V3 = [-t.tx[s1], 0, -t.tz[s1]];
    stripedFace(solid, off(land(-wh1, 0.03), bwd1, 0.08), off(land(wh1, 0.03), bwd1, 0.08), off(land(wh1, -2.2), bwd1, 0.08), off(land(-wh1, -2.2), bwd1, 0.08), bwd1, C_LAND, C_LAND_HI, 0.7);
    for (let lat = -rh1 + 0.4, k = 0; lat <= rh1 - 0.3; lat += 0.85, k++) {
      const p = land(lat, 0.14);
      lamp([p[0] + t.tx[s1] * 0.35, p[1], p[2] + t.tz[s1] * 0.35], 0.34, L_ALGAE, M_WAVE, Math.abs(lat) * 0.9);
    }
    for (const side of [-1, 1]) post(land(side * (wh1 + 0.5), 0), 2.4, L_CYAN, M_RUN, 0.8);
    // Leuchtbojen in der Lücke auf Flughöhe, links und rechts
    const yA = lip(0, 0)[1];
    const n = g1 - g0 >= 0 ? g1 - g0 : 0;
    for (const f of [0.22, 0.52, 0.82]) {
      const g = g0 + Math.round(f * n);
      for (const side of [-1, 1]) {
        const p = P(g, side * (t.rh[g] + 0.9), 0);
        const y = yA + BUOY_LIFT + BUOY_ARC * Math.sin(Math.min(1, f * 1.15) * Math.PI * 0.5);
        const m = new THREE.Matrix4().makeTranslation(p[0], y, p[2]);
        const bp = buoyGeo.getAttribute('position');
        const v = new THREE.Vector3();
        for (let k = 0; k < bp.count; k += 3) {
          const tri: V3[] = [];
          let cy = 0;
          for (let q = 0; q < 3; q++) {
            v.fromBufferAttribute(bp, k + q).applyMatrix4(m);
            tri.push([v.x, v.y, v.z]);
            cy += v.y;
          }
          both.tri(tri[0], tri[1], tri[2], Math.abs(cy / 3 - y) < 0.2 ? C_BUOY_B : C_BUOY_A);
        }
        // Kette bis hinunter in den Graben
        const r = 0.05;
        for (let k = 0; k < 4; k++) {
          const a0 = (k / 4) * Math.PI * 2;
          const a1 = ((k + 1) / 4) * Math.PI * 2;
          solid.quad([p[0] + Math.cos(a0) * r, y - 16, p[2] + Math.sin(a0) * r], [p[0] + Math.cos(a1) * r, y - 16, p[2] + Math.sin(a1) * r], [p[0] + Math.cos(a1) * r, y - 0.5, p[2] + Math.sin(a1) * r], [p[0] + Math.cos(a0) * r, y - 0.5, p[2] + Math.sin(a0) * r], C_CHAIN);
        }
        lamp([p[0], y + 0.85, p[2]], 0.8, L_CYAN, M_RUN, f * 1.2);
      }
    }
  }
  buoyGeo.dispose();

  // === Netze ==============================================================================
  let tris = 0;
  if (!solid.empty) {
    const geo = solid.build();
    const mat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    disposables.push(geo, mat);
    tris += solid.triangles;
    if (detail && !inked.empty) {
      const og = addSmoothNormals(inked.build());
      const ol = new THREE.Mesh(og, outlineMaterial(0.045));
      ol.name = 'outline';
      group.add(ol);
      disposables.push(og);
      tris += inked.triangles;
    }
  }

  const grassTime = { value: 0 };
  if (gPos.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(gCol, 3));
    geo.setAttribute('aBend', new THREE.Float32BufferAttribute(gBend, 4));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    // Die Biegung macht die Kugel etwas größer.
    if (geo.boundingSphere) geo.boundingSphere.radius += 2;
    const mat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSec = grassTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aBend;\nuniform float uSec;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // Spitze weit, Fuß gar nicht: gebogen in Strömungsrichtung, dazu ein Wiegen.
          float hb = aBend.z * aBend.z;
          float sw = 0.82 + 0.18 * sin(uSec * 2.6 + position.x * 0.6 + position.z * 0.45 - aBend.z * 1.5);
          transformed.xz += aBend.xy * aBend.w * hb * sw;
          transformed.y -= aBend.w * hb * 0.32 * sw;
        }`,
      );
    };
    mat.customProgramCacheKey = () => 'tauch-gras';
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    disposables.push(geo, mat);
    tris += gPos.length / 9;
  }

  const uV: THREE.Vector4[] = [];
  const uG: THREE.Vector4[] = [];
  for (let i = 0; i < NV; i++) {
    uV.push(new THREE.Vector4());
    uG.push(new THREE.Vector4());
  }
  const flowMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSec: { value: 0 } }]),
    vertexShader: FLOW_VERT.replace(/NV/g, String(NV)),
    fragmentShader: FLOW_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  // Die Felder nicht durch merge() kopieren lassen: update() schreibt in genau diese Vektoren.
  flowMat.uniforms.uV = { value: uV };
  flowMat.uniforms.uG = { value: uG };
  if (pos.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aK', new THREE.Float32BufferAttribute(kd, 1));
    geo.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 4));
    geo.setAttribute('aB', new THREE.Float32BufferAttribute(ab, 4));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, flowMat);
    // Ecken werden im Shader verschoben (Tafeln, Ringe): nicht nach der Kugel aussortieren.
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    group.add(mesh);
    disposables.push(geo);
    tris += pos.length / 9;
  }
  disposables.push(flowMat);
  group.userData.triangles = tris;

  // === Pro Bild ============================================================================
  return {
    group,
    update(time, seconds, dt, cam, fx: FxSink) {
      flowMat.uniforms.uSec.value = seconds;
      grassTime.value = seconds;

      for (let i = 0; i < vents.length; i++) {
        const p = vents[i];
        const c = pulseCycle(p, time);
        const w = pulseWarning(p, time);
        const V = uV[i];
        const Gs = uG[i];
        if (c < p.on) {
          // Bläst: die Säule schießt in gut einer halben Sekunde bis oben.
          const top = Math.min(COLUMN_H, 0.4 + (c / 60) * 9);
          V.set(1, top, 0, 0.12);
          Gs.set(0.8 + 0.2 * Math.sin(seconds * 14 + i), 0.65, -seconds * 0.7, 1);
        } else if (w > 0) {
          // Vorwarnung: der Rand blinkt gelb, immer schneller; unten sammeln sich Blasen.
          const ws = (w * p.warn) / 60;
          const wT = p.warn / 60;
          const blink = Math.sin(Math.PI * 2 * (2.5 * ws + (3.5 * ws * ws) / wT)) > 0 ? 1 : 0.2;
          V.set(0.55 + 0.3 * w, 0.3 + 1.6 * w, 0, 0.1 + 0.15 * w);
          Gs.set(blink, 0.25 + 0.45 * w * blink, -seconds * 0.3, 2);
        } else {
          // Pause: die letzte Säule löst sich vom Grund und steigt weg, dann nur einzelne Bläschen.
          const after = (c - p.on) / 60;
          const bottom = Math.min(COLUMN_H + 1, after * 8);
          V.set(bottom < COLUMN_H ? 1 : 0, COLUMN_H + 1, bottom, 0.06);
          Gs.set(0.12, 0.14, -seconds * 0.15, 0);
        }

        // Bläschen als Teilchen in Kameranähe (nur detail)
        if (detail) {
          const d = Math.hypot(p.x - cam.x, p.z - cam.z);
          if (d < FX_NEAR + 15) {
            const rate = c < p.on ? 16 : w > 0 ? 4 + 8 * w : 1.5;
            ventAcc[i] -= dt * rate;
            while (ventAcc[i] <= 0) {
              ventAcc[i] += 1;
              const a = Math.random() * Math.PI * 2;
              const r = Math.random() * p.radius * (c < p.on ? 0.7 : 0.3);
              fx.spark(p.x + Math.cos(a) * r, p.y + 0.4 + Math.random() * (c < p.on ? 3 : 0.6), p.z + Math.sin(a) * r, 0, 2.5 + Math.random() * 2, 0, 1.1, 0.16 + Math.random() * 0.14, 0xeaffff, -2.5);
            }
          }
        }
      }

      // Mittreibende Teilchen in den Strömungen nahe der Kamera (nur detail).
      if (detail) {
        for (const cv of views) {
          const b = cv.b;
          // nächster Stützpunkt zur Kamera
          let best = 1e9;
          let bi = 0;
          for (let i = 0; i < cv.segs.length; i += 4) {
            const s = cv.segs[i];
            const d = (t.px[s] - cam.x) ** 2 + (t.pz[s] - cam.z) ** 2;
            if (d < best) {
              best = d;
              bi = i;
            }
          }
          if (best > FX_NEAR * FX_NEAR) continue;
          cv.acc -= dt * 22;
          while (cv.acc <= 0) {
            cv.acc += 1;
            const i = Math.max(0, Math.min(cv.segs.length - 1, bi + Math.floor((Math.random() * 2 - 0.6) * 22)));
            const s = cv.segs[i];
            const u = cv.dist[i];
            const ends = Math.min(1, Math.min(u, cv.length - u) / BELT_RAMP);
            if (ends <= 0.05) continue;
            const lat = b.lat0 + BELT_EDGE + Math.random() * (b.lat1 - b.lat0 - 2 * BELT_EDGE);
            const h = 0.3 + Math.random() * 2.3;
            const vx = t.tx[s] * b.along + rightX(t, s) * b.across;
            const vz = t.tz[s] * b.along + rightZ(t, s) * b.across;
            const col = cv.quer ? FX_COL[2] : b.along > 0 ? FX_COL[0] : FX_COL[1];
            fx.spark(t.px[s] + rightX(t, s) * lat, t.py[s] + lat * t.bank[s] + h, t.pz[s] + rightZ(t, s) * lat, vx * ends, (Math.random() - 0.5) * 0.4, vz * ends, 1.4, 0.12 + Math.random() * 0.1, col, 0);
          }
        }
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

// --- Shader ---------------------------------------------------------------------------

const FLOW_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aK;
attribute vec4 aA;
attribute vec4 aB;
uniform float uSec;
uniform vec4 uV[NV];
uniform vec4 uG[NV];
varying float vK;
varying vec4 vA;
varying vec4 vB;
varying vec4 vS;
vec4 pickV(float i) { vec4 r = vec4(0.0); for (int k = 0; k < NV; k++) if (abs(float(k) - i) < 0.5) r = uV[k]; return r; }
vec4 pickG(float i) { vec4 r = vec4(0.0); for (int k = 0; k < NV; k++) if (abs(float(k) - i) < 0.5) r = uG[k]; return r; }
void main() {
  vK = aK;
  vA = aA;
  vB = aB;
  vS = vec4(0.0);
  vec3 p = position;
  vec4 mv;
  if (aK < 0.5) {
    // Stromlinie: Band um seine Achse zur Kamera gedreht, sacht auf und ab.
    vec3 dir = vec3(aA.x, 0.0, aA.y);
    p.y += 0.09 * sin(aB.x * 0.45 + uSec * 1.6 + position.x * 0.21 + position.z * 0.17);
    vec3 view = normalize(cameraPosition - p);
    vec3 off = cross(dir, view);
    float l = length(off);
    off = l > 1e-3 ? off / l : vec3(0.0, 1.0, 0.0);
    p += off * aA.z * aA.w;
    mv = modelViewMatrix * vec4(p, 1.0);
  } else if (aK < 1.5) {
    mv = modelViewMatrix * vec4(p, 1.0);
  } else if (aK < 2.5) {
    // Blasensäule: Tafel um die Hochachse zur Kamera gedreht; die zweite etwas davor.
    vec3 tc = cameraPosition - position;
    vec2 h = normalize(tc.xz + vec2(1e-4, 0.0));
    vec3 right = vec3(h.y, 0.0, -h.x);
    float R = aB.x;
    float lay = aA.w;
    p = position + right * aA.x * R * (1.0 - 0.18 * lay) + vec3(0.0, aA.y * aB.y, 0.0) + vec3(h.x, 0.0, h.y) * (lay * 0.8);
    vS = pickV(aA.z);
    // Entfernung: aus der Ferne wird der Kern breiter (sonst bliebe nur Blasengeriesel).
    vB.w = length(tc.xz);
    mv = modelViewMatrix * vec4(p, 1.0);
  } else if (aK < 4.5) {
    vS = pickG(aA.x);
    mv = modelViewMatrix * vec4(p, 1.0);
  } else {
    // Lampe: Tafel ganz zur Kamera gedreht.
    mv = modelViewMatrix * vec4(position, 1.0);
    mv.xy += aA.xy * aA.z;
  }
  gl_Position = projectionMatrix * mv;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;

const FLOW_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uSec;
varying float vK;
varying vec4 vA;
varying vec4 vB;
varying vec4 vS;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
vec4 hash4(vec2 p) {
  vec4 q = vec4(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9)), dot(p, vec2(41.3, 289.1)));
  return fract(sin(q) * 43758.5453);
}
// Farben der Strömung: Füllung, Spitze
vec3 flowFill(float c) { return c < 0.5 ? vec3(0.80, 1.0, 1.0) : c < 1.5 ? vec3(1.0, 0.20, 0.62) : vec3(1.0, 0.86, 0.20); }
vec3 flowHead(float c) { return c < 0.5 ? vec3(0.25, 0.95, 1.0) : c < 1.5 ? vec3(1.0, 0.55, 0.10) : vec3(1.0, 0.97, 0.6); }
void main() {
  vec3 col = vec3(1.0);
  float a = 0.0;
  if (vK < 0.5) {
    // Pfeilbänder: Schweif läuft spitz zu, vorn eine breite Spitze mit Tuschekante.
    float P = 6.5;
    float LB = 3.1;
    float LH = 0.8;
    float f = mod(vB.x - vB.y * uSec, P);
    float u = abs(vA.z);
    float wdt = f < LB ? 0.45 * pow(f / LB, 0.7) : f < LB + LH ? 1.0 - (f - LB) / LH : 0.0;
    bool head = f >= LB && f < LB + LH;
    if (u < wdt) {
      float e = wdt - u;
      if (e < 0.22) { col = vec3(0.09, 0.075, 0.11); a = 0.8; }
      else { col = head ? flowHead(vB.w) : flowFill(vB.w); a = head ? 0.95 : 0.8; }
    } else if (u < 0.1) {
      // dünner Faden zwischen den Pfeilen: die Stromlinie selbst
      col = flowFill(vB.w);
      a = 0.22;
    }
    a *= vB.z;
  } else if (vK < 1.5) {
    // Bodenwellen: Winkel, Spitze in Strömungsrichtung.
    float ph = (vB.x + 0.55 * abs(vB.y) - vB.z * uSec + 0.25 * sin(vB.y * 1.3 + vB.x * 0.2)) / 3.4;
    float f = fract(ph);
    if (f < 0.13) { col = flowFill(vA.w); a = 0.42; }
    else if (f < 0.2) { col = flowHead(vA.w) * 0.5; a = 0.18; }
    a *= vB.w;
  } else if (vK < 2.5) {
    // Blasensäule
    float R = vB.x;
    float H = vB.y;
    float x = vA.x * R;
    float y = vA.y * H;
    float lay = vA.w;
    float seed = vB.z + lay * 7.0;
    vec4 s = vS;
    bool dense = y >= s.z && y <= s.y;
    float dens = dense ? s.x : s.w;
    float wy = R * (0.4 + 0.6 * smoothstep(0.0, 2.4, y));
    float far = smoothstep(28.0, 75.0, vB.w);
    if (lay < 0.5 && dense && s.x > 0.01) {
      // heller Kern mit Wellen, die nach oben laufen
      float cw = R * (0.24 + 0.16 * smoothstep(0.0, 3.0, y)) * s.x * (1.0 + 1.1 * far);
      float ax = abs(x) / max(cw, 0.01);
      if (ax < 1.0) {
        float band = fract((y - uSec * 6.5) / 1.3);
        col = band < 0.35 ? vec3(1.0) : vec3(0.72, 0.98, 1.0);
        a = max((band < 0.35 ? 0.92 : 0.66), 0.9 * far) * s.x;
        if (ax > 0.86) { col = vec3(0.3, 0.85, 0.95); a = 0.7 * s.x; }
      }
    }
    if (lay < 0.5 && s.x > 0.5) {
      // Ringe, die mit den Blasen aufsteigen und sich weiten (gezeichnet als Ellipse)
      for (int k = 0; k < 3; k++) {
        float ph = fract(uSec * 0.55 + float(k) / 3.0);
        float yc = 0.3 + ph * (H - 0.9);
        if (yc < s.z || yc > s.y) continue;
        float rx = R * (0.4 + 0.55 * sqrt(ph));
        vec2 e = vec2(x / rx, (y - yc) / (rx * 0.26));
        float d = length(e);
        if (d > 0.8 && d < 1.12) {
          float k2 = (1.0 - ph * ph) * s.x;
          if (d < 1.0) { col = vec3(1.0); a = max(a, 0.95 * k2); }
          else { col = vec3(0.04, 0.2, 0.28); a = max(a, 0.6 * k2); }
        }
      }
    }
    float sp = 3.2 + lay * 1.3;
    vec2 q = vec2(x + 0.14 * sin(y * 1.9 + seed + uSec * 2.0), y - uSec * sp);
    float c = 0.95 - 0.2 * lay;
    vec2 cell = floor(q / c);
    vec4 h = hash4(cell + seed * 17.0);
    if (h.x < dens && abs(x) < wy) {
      vec2 ctr = (cell + 0.36 + 0.28 * h.yz) * c;
      float r = c * (0.17 + 0.13 * h.w) * (0.6 + 0.4 * smoothstep(0.0, 1.5, y)) * (1.0 + 0.3 * far);
      float d = length(q - ctr);
      if (d < r * 1.2) {
        if (d > r) { col = vec3(0.04, 0.2, 0.28); a = 0.8; }
        else if (d > r * 0.7) { col = vec3(1.0); a = 1.0; }
        else { col = vec3(0.68, 0.96, 1.0); a = max(a, 0.4); }
        if (length(q - ctr - vec2(-0.33 * r, 0.33 * r)) < r * 0.24) { col = vec3(1.0); a = 1.0; }
      }
    }
    a *= 1.0 - smoothstep(H - 1.0, H, y);
  } else if (vK < 4.5) {
    // Leuchtrand am Schlot (Art 0) und Strichkreis an der Grenze der Wirkung (Art 1)
    vec4 g = vS;
    vec3 hot = g.w > 1.5 ? vec3(1.0, 0.9, 0.3) : vec3(0.9, 1.0, 1.0);
    if (vA.y < 0.5) {
      col = mix(vec3(0.08, 0.45, 0.55), hot, g.x);
      a = 0.95;
    } else {
      float d = fract(vA.z * 18.0 + g.z);
      if (d > 0.55) discard;
      col = hot;
      a = g.y;
    }
  } else {
    // Lampen: heller Kern, Hof
    float r = length(vA.xy);
    if (r > 1.0) discard;
    float mode = vB.y;
    float ph = vB.x;
    float on;
    if (mode < 0.5) on = step(0.45, fract(uSec * 1.8 + ph));
    else if (mode < 1.5) on = 0.5 + 0.5 * sin(uSec * 3.2 - ph);
    else on = fract(uSec * 0.8 - ph) < 0.25 ? 1.0 : 0.4;
    vec3 c = vA.w < 0.5 ? vec3(1.0, 0.55, 0.12) : vA.w < 1.5 ? vec3(0.35, 1.0, 0.7) : vec3(0.45, 0.95, 1.0);
    if (r < 0.42) { col = mix(c, vec3(1.0), 0.6 * on); a = 0.45 + 0.55 * on; }
    else { col = c; a = (1.0 - r) * 0.6 * on; }
  }
  if (a < 0.02) discard;
  gl_FragColor = vec4(lin(col), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
