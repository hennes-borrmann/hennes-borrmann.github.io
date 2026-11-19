// Baumkronenpfad: Darstellung von allem, was die Strecke trägt und was ins Rennen eingreift.
//
//   * Hängebrücken (Pontons-Mechanik als schwingende Saite, game/mechanics.ts): Bohlen, Seilgeländer und Pfosten. Sie SIND
//     die Fahrbahn – die stehende Welt zeichnet dort nichts (EDGE_FLOAT). Jede Ecke hängt an einer Stelle der Strecke
//     (Abschnitt, Anteil, seitliche Lage, Höhe) und wird je Bild genau dorthin gelegt, wo die Physik die Brücke hat:
//     gehoben um heaveAt, seitlich verschoben um swayAt. Die Enden stehen fest.
//   * Die Riesen: der Riesenstamm (die Rampe hängt an Konsolen in seiner Rinde), die Kronenbäume B, C2 und C mit ihren
//     Kragarmen unter dem Kronenpfad, die alte Eiche, deren Arm der Ast ohne Geländer ist, und der hohle Baumriese mit
//     den beiden Toren der Abkürzung, dem Wurzelkeller und der Rutsche im Innern.
//   * Holzböcke unter Stegen und Rampen (nie in einer anderen Trasse, nie in einem Stamm), Brückenportale.
//   * Felsstufe mit Wasserfall und Waldteich (von oben und – beim Tauchen – von unten), mit dem Wasserbild der Welt
//     (World.liquid: derselbe Shader wie das Meer der anderen Strecken, kein neuer).
//   * Fallende Tannenzapfen (PULSE_ICICLE, mechanics.ts): an einem Ast hoch über dem Waldweg hängt je ein großer Zapfen;
//     während der Vorwarnung wackelt er, auf dem Weg wächst sein Schatten bis zum Radius der Gefahr, dann fällt er und
//     schlägt genau bei Zyklus 0 auf; solange er gefährlich ist, liegt er dort. Danach wächst ein neuer nach.
//
// Keine eigenen Shader, keine Lichtquelle. Zeichenaufrufe: Holz und Stämme (Toon) + Kontur, Brücken (Toon, je Bild
// verschoben) + Kontur, Teich und Wasserfall von oben, Teich von unten, Zapfen und Schatten = 7 (ohne detail: 5).

import * as THREE from 'three';
import { PULSE_ICICLE, pulseCycle, pulseWarning, type Pulse } from '../../game/mechanics';
import { EDGE_DECK, EDGE_FLOAT, EDGE_GAP, EDGE_GLIDE, EDGE_OPEN_L, EDGE_OPEN_R, heaveAt, rightX, rightZ, segDelta, swayAt, type Track } from '../../game/track';
import { MeshBuilder, noise, seeded, shade, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { DECK_D, type World } from '../world';
import { FALL, HOLLOW, OAK_E, RAMP_R, TREE_B, TREE_C, TREE_C2, TRUNK_A, pondTest, type Giant } from '../life/baumLand';

const TAU = Math.PI * 2;

// --- Farben ------------------------------------------------------------------------------------------
const BARK_A = rgb(0x8c4c2e);
const BARK_A_D = rgb(0x6e3a22);
const BARK = rgb(0x6c5644);
const BARK_D = rgb(0x574434);
const OAK = rgb(0x5f5446);
const OAK_D = rgb(0x4a4136);
const INSIDE = rgb(0x3a2618);
const INSIDE_D = rgb(0x2a1a10);
const PIT = rgb(0x1e140c);
const TIMBER = rgb(0xa8784a);
const TIMBER_D = rgb(0x7c5634);
const PLANK_A = rgb(0xc08a52);
const PLANK_B = rgb(0xae7a46);
const PLANK_D = rgb(0x6a4a2c);
const ROPE = rgb(0xe9d6a8);
const ROPE_D = rgb(0xc9b080);
const MOSS = rgb(0x7a9440);
const MOSS_D = rgb(0x5f7a32);
const ROCK = rgb(0x8b8378);
const ROCK_D = rgb(0x6f685f);
const ROCK_H = rgb(0xa39b8e);
const FUNGUS = rgb(0xe8b25a);
const FIR = rgb(0x2f5a3c);
const FIR_D = rgb(0x244a30);
const CONE = rgb(0x8a5530);
const CONE_D = rgb(0x6a3e20);
const FOAM = rgb(0xf2f6ee);
const SHADOW = rgb(0x2a1c10);
const WARN = rgb(0xffb02a);
const WHITE: RGB = [1, 1, 1];

/** Fallzeit eines Zapfens vom Ast bis zum Aufschlag (Ticks; liegt am Ende der Vorwarnung). */
const CONE_FALL = 22;
/** So hoch über dem Weg hängen die Zapfen (Meter). */
const CONE_UP = 10.5;

export function buildCanopy(t: Track, detail: boolean, world: World): MechanicView {
  const group = new THREE.Group();
  group.name = 'Baumkronenpfad';
  const disposables: { dispose(): void }[] = [];
  const solid = new MeshBuilder();
  const rnd = seeded(2222);
  const T = t.total;
  const ground = (x: number, z: number): number => Math.min(world.heightAt(x, z), world.groundY(x, z));

  // --- Grundbausteine -------------------------------------------------------------------------------
  /** Punkt auf der Fahrbahn: Abschnitt i, Anteil f zum nächsten, seitlich lat, dy darüber (ohne Schwanken). */
  const P = (i: number, f: number, lat: number, dy: number): V3 => {
    const b = t.next[i];
    const ax = t.px[i] + rightX(t, i) * lat;
    const ay = t.py[i] + lat * t.bank[i] + dy;
    const az = t.pz[i] + rightZ(t, i) * lat;
    if (f === 0) return [ax, ay, az];
    const bx = t.px[b] + rightX(t, b) * lat;
    const by = t.py[b] + lat * t.bank[b] + dy;
    const bz = t.pz[b] + rightZ(t, b) * lat;
    return [ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f];
  };

  /** Stab mit vieleckigem Querschnitt (Halbmesser r) von a nach c; caps = Stirnflächen. */
  const stick = (b: MeshBuilder, a: V3, c: V3, r: number, col: RGB, sides = 4, caps = false, r2 = r): void => {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return;
    const ux = dx / L;
    const uy = dy / L;
    const uz = dz / L;
    let qx = 0;
    let qy = 1;
    let qz = 0;
    if (Math.abs(uy) > 0.9) {
      qx = 1;
      qy = 0;
    }
    let e1x = qy * uz - qz * uy;
    let e1y = qz * ux - qx * uz;
    let e1z = qx * uy - qy * ux;
    const l1 = Math.hypot(e1x, e1y, e1z);
    e1x /= l1;
    e1y /= l1;
    e1z /= l1;
    const e2x = uy * e1z - uz * e1y;
    const e2y = uz * e1x - ux * e1z;
    const e2z = ux * e1y - uy * e1x;
    const ring = (p: V3, rr: number): V3[] => {
      const out: V3[] = [];
      for (let s = 0; s < sides; s++) {
        const an = (s / sides) * TAU + Math.PI / sides;
        const cs = Math.cos(an) * rr;
        const sn = Math.sin(an) * rr;
        out.push([p[0] + e1x * cs + e2x * sn, p[1] + e1y * cs + e2y * sn, p[2] + e1z * cs + e2z * sn]);
      }
      return out;
    };
    const A = ring(a, r);
    const C = ring(c, r2);
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      b.quad(A[s], A[s1], C[s1], C[s], s % 2 === 0 ? col : shade(col, 0.9));
    }
    if (caps) {
      for (let s = 1; s + 1 < sides; s++) {
        b.tri(A[0], A[s + 1], A[s], shade(col, 0.8));
        b.tri(C[0], C[s], C[s + 1], shade(col, 1.08));
      }
    }
  };

  /** Senkrechter Stamm: Halbmesser je Höhe (profile [Höhe, Halbmesser], aufsteigend), Rindenrippen im Wechsel. */
  const column = (b: MeshBuilder, x: number, z: number, profile: [number, number][], sides: number, cA: RGB, cB: RGB, seed: number): void => {
    const wob = (s: number, k: number): number => 1 + 0.05 * (noise(s * 0.9 + seed, k * 0.7) - 0.5) * 2;
    for (let k = 0; k + 1 < profile.length; k++) {
      const [y0, r0] = profile[k];
      const [y1, r1] = profile[k + 1];
      for (let s = 0; s < sides; s++) {
        const a0 = (s / sides) * TAU;
        const a1 = ((s + 1) / sides) * TAU;
        const w00 = r0 * wob(s, k);
        const w10 = r0 * wob(s + 1, k);
        const w01 = r1 * wob(s, k + 1);
        const w11 = r1 * wob(s + 1, k + 1);
        const p00: V3 = [x + Math.cos(a0) * w00, y0, z + Math.sin(a0) * w00];
        const p10: V3 = [x + Math.cos(a1) * w10, y0, z + Math.sin(a1) * w10];
        const p01: V3 = [x + Math.cos(a0) * w01, y1, z + Math.sin(a0) * w01];
        const p11: V3 = [x + Math.cos(a1) * w11, y1, z + Math.sin(a1) * w11];
        const c = s % 2 === 0 ? cA : cB;
        b.quad(p00, p01, p11, p10, k % 3 === 2 ? shade(c, 0.95) : c);
      }
    }
    const [yt, rt] = profile[profile.length - 1];
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * TAU;
      const a1 = ((s + 1) / sides) * TAU;
      b.tri([x, yt + rt * 0.4, z], [x + Math.cos(a1) * rt, yt, z + Math.sin(a1) * rt], [x + Math.cos(a0) * rt, yt, z + Math.sin(a0) * rt], cB);
    }
  };

  /** Liegt (x, z) in einem der Stämme (mit Rand)? */
  const giants: Giant[] = [TRUNK_A, TREE_B, TREE_C2, TREE_C, OAK_E];
  const inTrunk = (x: number, z: number, pad: number): boolean => {
    for (const g of giants) if (Math.hypot(x - g.x, z - g.z) < g.r * 1.35 + pad) return true;
    return Math.hypot(x - HOLLOW.x, z - HOLLOW.z) < HOLLOW.rOut + pad;
  };
  /**
   * Steht ein Pfosten bei (x, z) von unten bis top frei? Nicht in einer anderen Fahrbahn darunter (auch nicht in deren
   * Luftraum bis 7 m über ihr), nicht im eigenen Weg gleich nebenan, nicht in einem Stamm, nicht im Teich.
   */
  const pond = pondTest(t, 2);
  const postFree = (x: number, z: number, top: number, own: number): boolean => {
    if (inTrunk(x, z, 0.6) || pond(x, z)) return false;
    for (let k = 0; k < T; k += 2) {
      if (t.branchOf[k] === t.branchOf[own] && Math.abs(segDelta(t, own, k)) < 26) continue;
      if (t.py[k] > top - 1) continue;
      const d = Math.hypot(t.px[k] - x, t.pz[k] - z);
      if (d < t.wh[k] + 1.2) return false;
    }
    return true;
  };

  // --- Riesenstamm ----------------------------------------------------------------------------------
  column(
    solid,
    TRUNK_A.x,
    TRUNK_A.z,
    [
      [-2, 17],
      [1, 15.8],
      [4, 14.4],
      [10, 13.8],
      [24, 13.4],
      [40, 12.8],
      [52, 11.6],
      [66, 9.6],
      [80, 7],
      [TRUNK_A.top, 4],
    ],
    28,
    BARK_A,
    BARK_A_D,
    1,
  );
  // Wurzelanläufe am Fuß
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + 0.3;
    const r0 = 13.5;
    const x0 = TRUNK_A.x + Math.cos(a) * r0;
    const z0 = TRUNK_A.z + Math.sin(a) * r0;
    const x1 = TRUNK_A.x + Math.cos(a) * (r0 + 8);
    const z1 = TRUNK_A.z + Math.sin(a) * (r0 + 8);
    // (nicht in die Rampe, die am Boden beginnt, und nicht auf den Waldweg)
    if (world.clearance(x1, z1) < 1) continue;
    stick(solid, [x0, 4, z0], [x1, ground(x1, z1) + 0.2, z1], 1.6, BARK_A_D, 6, false, 0.5);
  }
  // Konsolen unter der Rampe: Kragarm aus dem Stamm unter der Rampe entlang bis zur Außenkante, darunter eine Strebe.
  const isRamp = (i: number): boolean => t.branchOf[i] < 0 && Math.abs(Math.hypot(t.px[i] - TRUNK_A.x, t.pz[i] - TRUNK_A.z) - RAMP_R) < 2.5 && (t.edge[i] & EDGE_DECK) !== 0;
  for (let i = 0; i < t.n; i += 6) {
    if (!isRamp(i)) continue;
    const wh = t.wh[i];
    // die Seite zum Stamm hin
    const ux = (TRUNK_A.x - t.px[i]) * rightX(t, i) + (TRUNK_A.z - t.pz[i]) * rightZ(t, i);
    const s = ux < 0 ? -1 : 1;
    const inner = P(i, 0, s * wh, -DECK_D - 0.35);
    const outer = P(i, 0, -s * (wh + 0.3), -DECK_D - 0.35);
    const dx = inner[0] - TRUNK_A.x;
    const dz = inner[2] - TRUNK_A.z;
    const d = Math.hypot(dx, dz);
    const rr = 13.2;
    const root: V3 = [TRUNK_A.x + (dx / d) * rr, inner[1] - 0.3, TRUNK_A.z + (dz / d) * rr];
    stick(solid, root, inner, 0.45, TIMBER_D, 4, true);
    stick(solid, inner, outer, 0.42, TIMBER, 4, true);
    if (inner[1] > 6) {
      const low: V3 = [TRUNK_A.x + (dx / d) * rr, inner[1] - 7, TRUNK_A.z + (dz / d) * rr];
      stick(solid, low, P(i, 0, -s * wh * 0.4, -DECK_D - 0.6), 0.32, TIMBER_D, 4, true);
    }
  }

  // --- Kronenbäume, Eiche ---------------------------------------------------------------------------
  const tree = (g: Giant, cA: RGB, cB: RGB, seed: number): void => {
    column(
      solid,
      g.x,
      g.z,
      [
        [-1.5, g.r * 1.55],
        [1.5, g.r * 1.12],
        [5, g.r],
        [g.crown - 8, g.r * 0.86],
        [g.crown + 6, g.r * 0.62],
        [g.top - 6, g.r * 0.3],
        [g.top, 0.6],
      ],
      14,
      cA,
      cB,
      seed,
    );
  };
  tree(TREE_B, BARK, BARK_D, 3);
  tree(TREE_C2, BARK, BARK_D, 5);
  tree(TREE_C, BARK, BARK_D, 7);
  tree(OAK_E, OAK, OAK_D, 9);
  // Kragarme: aus dem nächsten Stamm unter den Kronenpfad (Stege in bis zu 17 m Abstand von einem Stamm).
  const crownTrees = [TREE_B, TREE_C2, TREE_C];
  for (let i = 0; i < T; i += 5) {
    if ((t.edge[i] & (EDGE_DECK | EDGE_FLOAT | EDGE_GLIDE | EDGE_GAP)) !== EDGE_DECK || t.py[i] < 35) continue;
    let g: Giant | null = null;
    let best = 17;
    for (const c of crownTrees) {
      const d = Math.hypot(t.px[i] - c.x, t.pz[i] - c.z);
      if (d < best) {
        best = d;
        g = c;
      }
    }
    if (!g) continue;
    const ux = (g.x - t.px[i]) * rightX(t, i) + (g.z - t.pz[i]) * rightZ(t, i);
    const s = ux < 0 ? -1 : 1;
    const wh = t.wh[i];
    const inner = P(i, 0, s * wh, -DECK_D - 0.3);
    const outer = P(i, 0, -s * (wh + 0.3), -DECK_D - 0.3);
    const dx = inner[0] - g.x;
    const dz = inner[2] - g.z;
    const d = Math.hypot(dx, dz);
    const rr = g.r * 0.8;
    stick(solid, [g.x + (dx / d) * rr, inner[1] - 1.2, g.z + (dz / d) * rr], inner, 0.5, BARK_D, 5, true, 0.38);
    stick(solid, inner, outer, 0.36, TIMBER, 4, true);
    stick(solid, [g.x + (dx / d) * rr, inner[1] - 6, g.z + (dz / d) * rr], P(i, 0, 0, -DECK_D - 0.5), 0.28, TIMBER_D, 4, true);
  }

  // --- Ast ohne Geländer: der Arm der alten Eiche ----------------------------------------------------
  const ast = t.def.branches?.findIndex((b) => b.shortcut === 'risk' && b.surface === 'bark') ?? -1;
  if (ast >= 0) {
    const b = t.branches[ast];
    // Der Arm liegt unter dem schmalen Weg (seine Oberseite knapp unter der Fahrbahn) und wird zu den Enden dünner.
    let prev: V3 | null = null;
    let mid: V3 | null = null;
    for (let k = 0; k <= b.count; k += 3) {
      const i = b.first + Math.min(b.count - 1, k);
      const u = k / b.count;
      const R = 2.1 + 0.7 * Math.sin(Math.PI * u);
      const c: V3 = [t.px[i], t.py[i] - R - 0.12, t.pz[i]];
      if (prev) stick(solid, prev, c, R, k % 6 === 0 ? OAK : OAK_D, 9);
      prev = c;
      if (Math.abs(u - 0.5) < 0.03) mid = c;
      // Moos und Zweige
      if (k % 15 === 9) {
        const side = rnd() < 0.5 ? -1 : 1;
        const base = P(i, 0, side * (t.wh[i] - 0.2), -0.9);
        const tip: V3 = [base[0] + rightX(t, i) * side * 5, base[1] + 2.5 + rnd() * 2, base[2] + rightZ(t, i) * side * 5];
        stick(solid, base, tip, 0.35, OAK_D, 5, false, 0.1);
      }
    }
    // Ellbogen vom Stamm der Eiche hinauf zum Arm
    if (mid) {
      const e0: V3 = [OAK_E.x, 26, OAK_E.z];
      const e1: V3 = [(OAK_E.x * 2 + mid[0]) / 3, mid[1] - 4, (OAK_E.z * 2 + mid[2]) / 3 - 2];
      stick(solid, e0, e1, 3.4, OAK, 9, false, 3);
      stick(solid, e1, mid, 3, OAK, 9, false, 2.6);
    }
  }

  // --- Hohler Baumriese -----------------------------------------------------------------------------
  const hollow = t.def.branches?.findIndex((b) => b.shortcut === 'risk' && b.ramps && b.ramps.length > 0) ?? -1;
  {
    const H = HOLLOW;
    // Wo die Abkürzung durch die Wand geht: Tore (Winkel und Höhe der Schwelle). Die Fahrbahn der Abkürzung ist hier
    // ein Steg (die stehende Welt zeichnet ihn); die Tore lassen ihn durch.
    const doors: { a: number; y0: number; half: number }[] = [];
    if (hollow >= 0) {
      const b = t.branches[hollow];
      let wasIn = false;
      for (let k = 0; k < b.count; k++) {
        const i = b.first + k;
        const isIn = Math.hypot(t.px[i] - H.x, t.pz[i] - H.z) < H.rOut;
        if (isIn !== wasIn) {
          const a = Math.atan2(t.pz[i] - H.z, t.px[i] - H.x);
          doors.push({ a, y0: Math.min(t.py[i], t.py[t.prev[i]]) - 0.9, half: Math.asin(Math.min(0.95, (t.wh[i] + 1.1) / H.rOut)) });
          wasIn = isIn;
        }
      }
    }
    const DOOR_H = 8.2;
    const N = 40;
    // Bruchkante: rundum ungleich hoch, auf der Nordseite ragt ein langer Splitter auf.
    const rim = (s: number): number => {
      const a = (s / N) * TAU;
      return H.top + 7 * Math.max(0, Math.cos(a + 1.9)) ** 3 + 2.4 * (noise(s * 0.45, 3.3) - 0.5) * 2;
    };
    const doorAt = (a: number): { y0: number; y1: number } | null => {
      for (const d of doors) {
        let da = a - d.a;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        if (Math.abs(da) < d.half) return { y0: d.y0, y1: d.y0 + DOOR_H };
      }
      return null;
    };
    /** Knorrige Wand: Halbmesser je Spalte und Höhe leicht verschieden, unten ein Wurzelanlauf. */
    const wob = (s: number, y: number): number => 1 + 0.045 * (noise(s * 0.7, y * 0.12) - 0.5) * 2;
    const flare = (y: number, foot: number): number => Math.max(0, 1 - (y - foot) / 5) * 2.6;
    const tops: number[] = [];
    for (let s = 0; s <= N; s++) {
      const am = ((s + 0.5) / N) * TAU;
      const d = doorAt(am);
      tops.push(Math.max(rim(s % N), d ? d.y1 + 2.4 : 0));
    }
    for (let s = 0; s < N; s++) {
      const a0 = (s / N) * TAU;
      const a1 = ((s + 1) / N) * TAU;
      const am = (a0 + a1) / 2;
      const top0 = tops[s];
      const top1 = tops[(s + 1) % N];
      const gx0 = H.x + Math.cos(am) * (H.rOut + 1);
      const gz0 = H.z + Math.sin(am) * (H.rOut + 1);
      const foot = Math.min(ground(gx0, gz0), 0.5) - 1.5;
      const door = doorAt(am);
      // Höhenstufen: alle fünf Meter, dazu Schwelle und Sturz eines Tors
      const ys: number[] = [];
      for (let y = foot; y < Math.max(top0, top1) - 0.5; y += 5) ys.push(y);
      if (door) ys.push(door.y0, door.y1);
      ys.sort((p, q2) => p - q2);
      const O = (a: number, s2: number, y: number, top: number): V3 => {
        const yy = Math.min(y, top);
        const r = H.rOut * wob(s2, yy) + flare(yy, foot);
        return [H.x + Math.cos(a) * r, yy, H.z + Math.sin(a) * r];
      };
      const I = (a: number, s2: number, y: number, top: number): V3 => {
        const yy = Math.min(y, top) - (y >= top ? 0.7 : 0);
        const r = H.rIn * wob(s2 + 17, yy);
        return [H.x + Math.cos(a) * r, yy, H.z + Math.sin(a) * r];
      };
      ys.push(Infinity);
      for (let k = 0; k + 1 < ys.length; k++) {
        const y0 = ys[k];
        const y1 = ys[k + 1];
        if (door && y0 >= door.y0 - 1e-6 && y1 <= door.y1 + 1e-6) continue;
        const n0 = noise(s * 0.6 + 4, y0 * 0.15);
        const cO = n0 < 0.35 ? BARK_D : n0 < 0.7 ? BARK : y0 < foot + 4 ? MOSS_D : OAK;
        solid.quad(O(a0, s, y0, top0), O(a0, s, y1, top0), O(a1, s + 1, y1, top1), O(a1, s + 1, y0, top1), cO);
        solid.quad(I(a1, s + 1, y0, top1), I(a1, s + 1, y1, top1), I(a0, s, y1, top0), I(a0, s, y0, top0), n0 < 0.5 ? INSIDE : INSIDE_D);
      }
      // Bruchkante oben: Moos
      solid.quad(I(a0, s, Infinity, top0), I(a1, s + 1, Infinity, top1), O(a1, s + 1, Infinity, top1), O(a0, s, Infinity, top0), s % 3 === 0 ? MOSS_D : MOSS);
      if (door) {
        // Sturz und Schwelle
        solid.quad(O(a0, s, door.y1, top0), I(a0, s, door.y1, top0), I(a1, s + 1, door.y1, top1), O(a1, s + 1, door.y1, top1), INSIDE_D);
        solid.quad(O(a1, s + 1, door.y0, top1), I(a1, s + 1, door.y0, top1), I(a0, s, door.y0, top0), O(a0, s, door.y0, top0), INSIDE_D);
        // Laibung
        if (!doorAt(a0 - 0.01)) solid.quad(O(a0, s, door.y0, top0), I(a0, s, door.y0, top0), I(a0, s, door.y1, top0), O(a0, s, door.y1, top0), INSIDE);
        if (!doorAt(a1 + 0.01)) solid.quad(I(a1, s + 1, door.y0, top1), O(a1, s + 1, door.y0, top1), O(a1, s + 1, door.y1, top1), I(a1, s + 1, door.y1, top1), INSIDE);
      }
      // Baumpilze außen am Stamm
      if (!door && s % 5 === 2) {
        const y = 6 + rnd() * 20;
        const p = O(am, s + 0.5, y, Infinity);
        solid.box(p[0] + Math.cos(am) * 0.6, p[1], p[2] + Math.sin(am) * 0.6, 2.6, 0.45, 2.6, FUNGUS, -am, shade(FUNGUS, 1.12));
      }
    }
    // Wurzeln, die vom Fuß aus in den Waldboden greifen (nicht auf eine Fahrbahn)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2;
      const x1 = H.x + Math.cos(a) * (H.rOut + 9);
      const z1 = H.z + Math.sin(a) * (H.rOut + 9);
      if (world.clearance(x1, z1) < 1.5 || doorAt(a)) continue;
      const x0 = H.x + Math.cos(a) * (H.rOut + 1);
      const z0 = H.z + Math.sin(a) * (H.rOut + 1);
      stick(solid, [x0, ground(x0, z0) + 3, z0], [x1, ground(x1, z1) - 0.3, z1], 1.8, BARK_D, 6, false, 0.5);
    }
    // Wurzelkeller: dunkler Grund tief im Innern
    const kel = 0.3;
    for (let s = 0; s < N; s++) {
      const a0 = (s / N) * TAU;
      const a1 = ((s + 1) / N) * TAU;
      solid.tri([H.x, kel, H.z], [H.x + Math.cos(a1) * H.rIn, kel, H.z + Math.sin(a1) * H.rIn], [H.x + Math.cos(a0) * H.rIn, kel, H.z + Math.sin(a0) * H.rIn], PIT);
    }
    // Querbalken unter Boden und Rutsche im Innern (sie tragen den Steg der Abkürzung)
    if (hollow >= 0) {
      const b = t.branches[hollow];
      for (let k = 0; k < b.count; k += 4) {
        const i = b.first + k;
        if (t.edge[i] & EDGE_GAP || Math.hypot(t.px[i] - H.x, t.pz[i] - H.z) > H.rIn - 0.5) continue;
        const l = Math.sqrt(Math.max(1, H.rIn ** 2 - (Math.hypot(t.px[i] - H.x, t.pz[i] - H.z) * 0.9) ** 2));
        stick(solid, P(i, 0, -l, -DECK_D - 0.35), P(i, 0, l, -DECK_D - 0.35), 0.4, TIMBER_D, 4, true);
      }
    }
  }

  // --- Holzböcke unter Stegen ------------------------------------------------------------------------
  for (let i = 0; i < T; i += 12) {
    const e = t.edge[i];
    if ((e & EDGE_DECK) === 0 || (e & (EDGE_FLOAT | EDGE_GLIDE | EDGE_GAP)) !== 0) continue;
    if (isRamp(i) || (ast >= 0 && t.branchOf[i] === ast)) continue;
    if (Math.hypot(t.px[i] - HOLLOW.x, t.pz[i] - HOLLOW.z) < HOLLOW.rOut + 2) continue;
    // in der Nähe eines Kronenbaums tragen die Kragarme
    if (t.py[i] > 35 && crownTrees.some((g) => Math.hypot(t.px[i] - g.x, t.pz[i] - g.z) < 17)) continue;
    const wh = t.wh[i];
    const open = (e & (EDGE_OPEN_L | EDGE_OPEN_R)) !== 0;
    const lat = wh + (open ? -0.6 : 0.25);
    const tops: V3[] = [P(i, 0, -lat, -DECK_D - 0.2), P(i, 0, lat, -DECK_D - 0.2)];
    const ok = tops.every((p) => postFree(p[0], p[2], p[1], i));
    if (!ok) continue;
    const feet = tops.map((p) => Math.min(ground(p[0], p[2]), p[1]) - 0.6);
    if (tops[0][1] - feet[0] < 0.8) continue;
    const r = tops[0][1] - feet[0] > 18 ? 0.45 : 0.32;
    tops.forEach((p, k) => stick(solid, [p[0], feet[k], p[2]], p, r, TIMBER_D, 4, true));
    stick(solid, P(i, 0, -lat - 0.4, -DECK_D - 0.45), P(i, 0, lat + 0.4, -DECK_D - 0.45), 0.3, TIMBER, 4, true);
    // Andreaskreuze, etwa alle acht Meter Höhe
    const hi = Math.min(tops[0][1], tops[1][1]) - 1;
    const lo = Math.max(feet[0], feet[1]) + 0.5;
    for (let y = hi; y - 7 > lo; y -= 10) {
      const a0: V3 = [tops[0][0], y, tops[0][2]];
      const a1: V3 = [tops[1][0], y - 7, tops[1][2]];
      const b0: V3 = [tops[1][0], y, tops[1][2]];
      const b1: V3 = [tops[0][0], y - 7, tops[0][2]];
      stick(solid, a0, a1, 0.16, TIMBER, 4);
      stick(solid, b0, b1, 0.16, TIMBER, 4);
    }
  }

  // --- Felsstufe mit Wasserfall ---------------------------------------------------------------------
  const water = new MeshBuilder();
  {
    // Blöcke um die Klamm, durch die der Steg zum Teich hinabführt – nie auf der Fahrbahn, nie in ihrem Luftraum.
    const dode = new THREE.DodecahedronGeometry(1, 0);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const near = (x: number, z: number, y: number, r: number): boolean => {
      for (let k = 0; k < T; k += 2) {
        const d = Math.hypot(t.px[k] - x, t.pz[k] - z) - t.wh[k] - 0.6;
        if (d < r && y + r * 0.7 > t.py[k] - 2.2) return true;
      }
      return false;
    };
    const block = (x: number, z: number, y: number, r: number, c: RGB): void => {
      if (near(x, z, y, r)) return;
      eu.set(rnd() * 3, rnd() * 3, rnd() * 3);
      q.setFromEuler(eu);
      m4.compose(v.set(x, y, z), q, sc.set(r * (1 + rnd() * 0.3), r * (0.7 + rnd() * 0.3), r * (1 + rnd() * 0.3)));
      solid.add(dode, c, m4);
    };
    // Die Stufe liegt westlich der Klamm; ihre Kante (der Wasserfall) zeigt nach Süden zum Teich. Mitten hindurch läuft
    // die Rinne des Bachs (sie bleibt frei).
    const fx = FALL.x - 13;
    const lip = FALL.z + 4;
    for (let gx = FALL.x - 30; gx <= FALL.x - 6; gx += 5) {
      for (let gz = FALL.z - 32; gz <= lip + 2; gz += 5) {
        const x = gx + (rnd() - 0.5) * 2;
        const z = gz + (rnd() - 0.5) * 2;
        const r = 3.3 + rnd() * 0.9;
        if (Math.abs(x - fx) < 4.2 + r * 0.7 && z < lip + 1) continue;
        // vorn (zum Teich hin) bricht die Stufe ab, hinten läuft sie in den Waldboden aus
        const back = Math.max(0, (FALL.z - 18 - z) / 14);
        const top = FALL.top + 0.4 + rnd() * 0.8 - back * 8;
        const g = ground(x, z);
        if (top < g + 1) continue;
        for (let y = g - 0.5; ; y += r * 1.25) {
          block(x, z, Math.min(y, top - r * 0.55), r, rnd() < 0.45 ? ROCK : rnd() < 0.5 ? ROCK_D : ROCK_H);
          if (y >= top - r * 0.55) break;
        }
      }
    }
    // die Wangen der Bachrinne und östlich der Klamm ein paar Brocken
    for (let z = FALL.z - 28; z < lip; z += 4) for (const sgn of [-1, 1]) block(fx + sgn * 5.2, z, FALL.top - 1.2, 1.9 + rnd() * 0.6, ROCK_H);
    for (let k = 0; k < 10; k++) {
      const x = FALL.x + 9 + rnd() * 10;
      const z = FALL.z - 18 + rnd() * 26;
      block(x, z, ground(x, z) + rnd() * 2, 2 + rnd() * 2.2, rnd() < 0.5 ? ROCK : ROCK_D);
    }
    dode.dispose();
    // Wasserfall: vom Bach oben über die Kante in den Teich, leicht nach vorn gewölbt; Gischt unten.
    const half = 3.6;
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const u0 = r / rows;
      const u1 = (r + 1) / rows;
      const y0 = FALL.top + 0.2 - u0 * u0 * (FALL.top + 0.5);
      const y1 = FALL.top + 0.2 - u1 * u1 * (FALL.top + 0.5);
      const z0 = lip + u0 * 3.2;
      const z1 = lip + u1 * 3.2;
      water.quad([fx + half, y0, z0], [fx - half, y0, z0], [fx - half * 1.15, y1, z1], [fx + half * 1.15, y1, z1], WHITE);
    }
    // der Bach oben auf der Stufe
    water.quad([fx - half, FALL.top + 0.25, lip], [fx + half, FALL.top + 0.25, lip], [fx + half + 0.5, FALL.top + 0.45, lip - 30], [fx - half - 0.5, FALL.top + 0.45, lip - 30], WHITE);
    // Gischt
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU;
      solid.box(fx + Math.cos(a) * 3.2, 0.2, lip + 3.6 + Math.sin(a) * 1.8, 2.2, 0.7, 1.6, FOAM, a);
    }
  }

  // --- Waldteich: Wasser über dem Becken (die Ufer schneidet das Gelände) ----------------------------
  const under = new MeshBuilder();
  {
    const inPond = pondTest(t, 28);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < t.n; i++) {
      if (!t.deep[i]) continue;
      x0 = Math.min(x0, t.px[i]);
      x1 = Math.max(x1, t.px[i]);
      z0 = Math.min(z0, t.pz[i]);
      z1 = Math.max(z1, t.pz[i]);
    }
    const C = 6;
    const sea = t.sea;
    for (let x = x0 - 36; x < x1 + 36; x += C) {
      for (let z = z0 - 36; z < z1 + 36; z += C) {
        if (!(inPond(x, z) || inPond(x + C, z) || inPond(x, z + C) || inPond(x + C, z + C))) continue;
        // (nur wo das Gelände tiefer liegt – über dem Spiegel deckt es ohnehin; das spart Flächen)
        if (Math.min(world.heightAt(x, z), world.heightAt(x + C, z), world.heightAt(x, z + C), world.heightAt(x + C, z + C)) > sea + 0.4) continue;
        water.quad([x, sea, z], [x, sea, z + C], [x + C, sea, z + C], [x + C, sea, z], WHITE);
        under.quad([x, sea - 0.05, z], [x, sea - 0.05, z + C], [x + C, sea - 0.05, z + C], [x + C, sea - 0.05, z], WHITE);
      }
    }
  }

  // --- Brückenportale -------------------------------------------------------------------------------
  for (const p of t.pontoons) {
    for (const end of [t.prev[p.first], p.first + p.count]) {
      const wh = t.wh[end];
      for (const sgn of [-1, 1]) {
        const base = P(end, 0, sgn * (wh + 0.35), -0.4);
        stick(solid, base, [base[0], base[1] + 5, base[2]], 0.3, TIMBER_D, 4, true);
      }
      stick(solid, P(end, 0, -wh - 0.6, 4.4), P(end, 0, wh + 0.6, 4.4), 0.26, TIMBER, 4, true);
    }
  }

  // --- Tannenzapfen: die Tanne, deren Äste über den Waldweg reichen -----------------------------------
  const cones = t.pulses.filter((p) => p.kind === PULSE_ICICLE);
  const coneAt: { p: Pulse; x: number; y: number; z: number; top: number }[] = [];
  {
    // je Stelle ein Ast über dem Weg; die Tannen selbst stehen neben dem Weg
    const firs: [number, number, number][] = [];
    for (const p of cones) {
      const side = p.lat >= 0 ? 1 : -1;
      const w = t.wh[p.seg] + 4.5;
      const fx = t.px[p.seg] + rightX(t, p.seg) * side * w;
      const fz = t.pz[p.seg] + rightZ(t, p.seg) * side * w;
      const top = p.y + CONE_UP;
      coneAt.push({ p, x: p.x, y: p.y, z: p.z, top });
      if (!firs.some((f) => Math.hypot(f[0] - fx, f[1] - fz) < 6)) firs.push([fx, fz, ground(fx, fz)]);
      // Ast vom Stamm hinüber bis über die Stelle
      stick(solid, [fx, top + 0.9, fz], [p.x, top + 0.6, p.z], 0.35, BARK_D, 5, false, 0.12);
      for (let k = 0; k < 4; k++) {
        const u = 0.3 + k * 0.2;
        const cx = fx + (p.x - fx) * u;
        const cz = fz + (p.z - fz) * u;
        const g = new THREE.ConeGeometry(1.6 - k * 0.2, 1.2, 6);
        solid.add(g, FIR, new THREE.Matrix4().makeTranslation(cx, top + 1.3, cz));
        g.dispose();
      }
    }
    for (const [fx, fz, fy] of firs) {
      column(solid, fx, fz, [[fy - 1, 1.6], [fy + 2, 1.15], [fy + 30, 0.4]], 8, BARK, BARK_D, fx);
      for (let k = 0; k < 6; k++) {
        const y = fy + 9 + k * 4;
        const r = 7.5 - k * 1.1;
        const g = new THREE.ConeGeometry(r, 5.5, 8);
        solid.add(g, k % 2 === 0 ? FIR : FIR_D, new THREE.Matrix4().makeTranslation(fx, y, fz));
        g.dispose();
      }
    }
  }

  // --- Feste Netze ----------------------------------------------------------------------------------
  {
    const geo = solid.build();
    const mat = toonMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Stämme und Holz';
    group.add(mesh);
    disposables.push(geo, mat);
    if (detail) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(0.05));
      ol.name = 'outline';
      group.add(ol);
    }
  }
  const sheen = world.theme.liquid;
  if (!water.empty) {
    const geo = water.build();
    const mesh = new THREE.Mesh(geo, world.liquid(sheen));
    mesh.name = 'Teich und Wasserfall';
    group.add(mesh);
    disposables.push(geo);
  }
  if (!under.empty && world.theme.under) {
    const geo = under.build();
    const mesh = new THREE.Mesh(geo, world.liquid(world.theme.under.surface, true));
    mesh.name = 'Teich von unten';
    group.add(mesh);
    disposables.push(geo);
  }

  // --- Hängebrücken: Ecken an Stellen der Strecke, je Bild verschoben ---------------------------------
  const bseg: number[] = [];
  const bfr: number[] = [];
  const blat: number[] = [];
  const bdy: number[] = [];
  const bpos: number[] = [];
  const bcol: number[] = [];
  /** Ecke an (Abschnitt i, Anteil f, seitlich lat, Höhe dy) in Ruhelage. */
  const vtx = (i: number, f: number, lat: number, dy: number, c: RGB): void => {
    bseg.push(i);
    bfr.push(f);
    blat.push(lat);
    bdy.push(dy);
    const p = P(i, f, lat, dy);
    bpos.push(p[0], p[1], p[2]);
    bcol.push(c[0], c[1], c[2]);
  };
  type A = [number, number, number, number];
  const bquad = (a: A, b: A, c: A, d: A, col: RGB): void => {
    for (const q of [a, b, c, a, c, d]) vtx(q[0], q[1], q[2], q[3], col);
  };
  /** Pfosten oder Bohle als Kasten (ohne Boden) zwischen zwei Stationen. */
  const rail = (i0: number, f0: number, i1: number, f1: number, lat: number, dy: number, w: number, h: number, col: RGB): void => {
    const l0 = lat - w / 2;
    const l1 = lat + w / 2;
    bquad([i0, f0, l0, dy + h], [i0, f0, l1, dy + h], [i1, f1, l1, dy + h], [i1, f1, l0, dy + h], shade(col, 1.08));
    bquad([i0, f0, l0, dy], [i0, f0, l0, dy + h], [i1, f1, l0, dy + h], [i1, f1, l0, dy], col);
    bquad([i0, f0, l1, dy + h], [i0, f0, l1, dy], [i1, f1, l1, dy], [i1, f1, l1, dy + h], col);
  };
  /** Seil: dreikantiger Strang längs der Brücke (oben, innen, außen). */
  const rope = (i0: number, f0: number, i1: number, f1: number, lat: number, dy: number, r: number, col: RGB): void => {
    const A: A = [i0, f0, lat, dy + r];
    const B: A = [i1, f1, lat, dy + r];
    const L0: A = [i0, f0, lat - r, dy - r * 0.6];
    const L1: A = [i1, f1, lat - r, dy - r * 0.6];
    const R0: A = [i0, f0, lat + r, dy - r * 0.6];
    const R1: A = [i1, f1, lat + r, dy - r * 0.6];
    bquad(L0, A, B, L1, col);
    bquad(A, R0, R1, B, shade(col, 0.9));
    bquad(R0, L0, L1, R1, shade(col, 0.75));
  };
  for (const p of t.pontoons) {
    // Stationen: von der Mitte des Übergangs vor der Brücke bis zur Mitte des Übergangs dahinter
    const st: [number, number][] = [[t.prev[p.first], 0.5]];
    for (let k = 0; k < p.count; k++) st.push([p.first + k, 0]);
    st.push([p.first + p.count - 1, 0.5]);
    for (let k = 0; k + 1 < st.length; k++) {
      const [i0, f0] = st[k];
      const [i1, f1] = st[k + 1];
      const wh = t.wh[i0];
      const rh = t.rh[i0];
      // Bohlen (abwechselnd hell und dunkel), Randbohle, Unterseite
      const c = k % 2 === 0 ? PLANK_A : PLANK_B;
      bquad([i0, f0, -wh, 0], [i0, f0, wh, 0], [i1, f1, wh, 0], [i1, f1, -wh, 0], k % 7 === 3 ? shade(c, 0.9) : c);
      bquad([i0, f0, wh, -0.45], [i0, f0, -wh, -0.45], [i1, f1, -wh, -0.45], [i1, f1, wh, -0.45], PLANK_D);
      bquad([i0, f0, -wh, -0.45], [i0, f0, -wh, 0], [i1, f1, -wh, 0], [i1, f1, -wh, -0.45], PLANK_D);
      bquad([i0, f0, wh, 0], [i0, f0, wh, -0.45], [i1, f1, wh, -0.45], [i1, f1, wh, 0], PLANK_D);
      // Fahrspur: zwei längs laufende Laufbohlen (nur in der Mitte der Brücke, an den Enden liegen Querbohlen)
      if (detail) for (const l of [-rh * 0.45, rh * 0.45]) bquad([i0, f0, l - 0.35, 0.03], [i0, f0, l + 0.35, 0.03], [i1, f1, l + 0.35, 0.03], [i1, f1, l - 0.35, 0.03], shade(PLANK_A, 1.08));
      // Seilgeländer: Handlauf und Mittelseil je Seite
      for (const sgn of [-1, 1]) {
        rope(i0, f0, i1, f1, sgn * (wh + 0.15), 1.1, 0.09, ROPE);
        if (detail) rope(i0, f0, i1, f1, sgn * (wh + 0.15), 0.6, 0.06, ROPE_D);
      }
      // Pfosten alle zwei Meter
      if (k % 2 === 0) {
        for (const sgn of [-1, 1]) {
          const l = sgn * (wh + 0.15);
          rail(i0, f0, i0, f0 + 0.18, l, -0.45, 0.2, 1.75, TIMBER_D);
        }
      }
    }
  }
  const bridgeGeo = new THREE.BufferGeometry();
  const bridgePos = new Float32Array(bpos);
  const posAttr = new THREE.BufferAttribute(bridgePos, 3).setUsage(THREE.DynamicDrawUsage);
  bridgeGeo.setAttribute('position', posAttr);
  bridgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(bcol, 3));
  bridgeGeo.computeVertexNormals();
  bridgeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const bridgeMat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridgeMesh.name = 'Hängebrücken';
  bridgeMesh.frustumCulled = false;
  group.add(bridgeMesh);
  disposables.push(bridgeGeo, bridgeMat);
  if (detail) {
    addSmoothNormals(bridgeGeo);
    const ol = new THREE.Mesh(bridgeGeo, outlineMaterial(0.04));
    ol.name = 'outline';
    ol.frustumCulled = false;
    group.add(ol);
  }
  // Je Abschnitt (Knoten) Hub und Pendeln einmal je Bild; die Ecken mischen zwischen ihren beiden Knoten.
  const nodes = new Map<number, number>();
  for (let v = 0; v < bseg.length; v++) {
    for (const s of [bseg[v], t.next[bseg[v]]]) if (!nodes.has(s)) nodes.set(s, nodes.size);
  }
  const nodeSeg = [...nodes.keys()];
  const nodeH = new Float64Array(nodeSeg.length);
  const nodeW = new Float64Array(nodeSeg.length);
  const vA = Int32Array.from(bseg.map((s) => nodes.get(s)!));
  const vB = Int32Array.from(bseg.map((s) => nodes.get(t.next[s])!));
  const rx = Float64Array.from(bseg.map((s) => rightX(t, s)));
  const rz = Float64Array.from(bseg.map((s) => rightZ(t, s)));
  const rxB = Float64Array.from(bseg.map((s) => rightX(t, t.next[s])));
  const rzB = Float64Array.from(bseg.map((s) => rightZ(t, t.next[s])));

  // --- Zapfen und Schatten (je Bild) ----------------------------------------------------------------
  const dyn = new MeshBuilderDyn(1600);
  const dynMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const dynMesh = new THREE.Mesh(dyn.geo, dynMat);
  dynMesh.frustumCulled = false;
  dynMesh.renderOrder = 2;
  dynMesh.name = 'Zapfen';
  group.add(dynMesh);
  disposables.push(dyn, dynMat);

  /** Ein Zapfen als Doppelkegel mit Schuppenringen um (x, y, z) – Spitze nach unten, Länge len. */
  const drawCone = (x: number, y: number, z: number, len: number, tilt: number, alpha: number): void => {
    const sides = 7;
    const r = len * 0.32;
    const ca = Math.cos(tilt);
    const sa = Math.sin(tilt);
    const pt = (dx: number, dy: number, dz: number): [number, number, number] => [x + dx * ca - dy * sa, y + dx * sa + dy * ca, z + dz];
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * TAU;
      const a1 = ((s + 1) / sides) * TAU;
      const top = pt(0, len * 0.5, 0);
      const bot = pt(0, -len * 0.5, 0);
      const m0 = pt(Math.cos(a0) * r, len * 0.05, Math.sin(a0) * r);
      const m1 = pt(Math.cos(a1) * r, len * 0.05, Math.sin(a1) * r);
      const c = s % 2 === 0 ? CONE : CONE_D;
      dyn.tri(top, m0, m1, shade(c, 1.1), alpha);
      dyn.tri(m0, bot, m1, c, alpha);
    }
  };

  return {
    group,
    update(time) {
      // Brücken
      for (let k = 0; k < nodeSeg.length; k++) {
        nodeH[k] = heaveAt(t, nodeSeg[k], 0, time);
        nodeW[k] = swayAt(t, nodeSeg[k], 0, time);
      }
      for (let v = 0; v < bseg.length; v++) {
        const f = bfr[v];
        const i = bseg[v];
        const j = t.next[i];
        const lat = blat[v];
        const h = nodeH[vA[v]] + (nodeH[vB[v]] - nodeH[vA[v]]) * f;
        const w = nodeW[vA[v]] + (nodeW[vB[v]] - nodeW[vA[v]]) * f;
        const l = lat + w;
        const ax = t.px[i] + rx[v] * l;
        const az = t.pz[i] + rz[v] * l;
        const ay = t.py[i] + l * t.bank[i];
        const bx = t.px[j] + rxB[v] * l;
        const bz = t.pz[j] + rzB[v] * l;
        const by = t.py[j] + l * t.bank[j];
        bridgePos[v * 3] = ax + (bx - ax) * f;
        bridgePos[v * 3 + 1] = ay + (by - ay) * f + bdy[v] + h;
        bridgePos[v * 3 + 2] = az + (bz - az) * f;
      }
      posAttr.needsUpdate = true;
      // Zapfen: hängen und wackeln (Vorwarnung), fallen (letzte CONE_FALL Ticks), liegen (gefährlich), wachsen nach.
      dyn.begin();
      for (const c of coneAt) {
        const p = c.p;
        const cyc = pulseCycle(p, time);
        const warn = pulseWarning(p, time);
        const len = 2.6;
        if (cyc < p.on) {
          // liegt auf dem Weg
          drawCone(c.x, c.y + 0.5, c.z, len, Math.PI / 2 - 0.2, 1);
        } else if (cyc >= p.period - CONE_FALL) {
          const u = (cyc - (p.period - CONE_FALL)) / CONE_FALL;
          drawCone(c.x, c.top - (c.top - c.y - 0.6) * u * u, c.z, len, u * 1.2, 1);
        } else {
          const grow = Math.min(1, (cyc - p.on) / 60);
          const wob = warn > 0 ? Math.sin(time * (0.5 + warn * 0.9)) * 0.35 * warn : 0;
          drawCone(c.x, c.top - len * 0.5 * grow, c.z, len * (0.4 + 0.6 * grow), wob, 1);
        }
        // Schatten: wächst während der Vorwarnung bis zum Radius der Gefahr; gefährlich: dunkel mit Warnrand
        const r = cyc < p.on ? p.radius : warn > 0 ? p.radius * (0.3 + 0.7 * warn) : 0;
        if (r > 0.05) {
          const a = cyc < p.on ? 0.55 : 0.25 + 0.35 * warn;
          const n = 16;
          const fx = t.tx[p.seg];
          const fz = t.tz[p.seg];
          const sx = rightX(t, p.seg);
          const sz = rightZ(t, p.seg);
          const slope = (t.py[t.next[p.seg]] - t.py[t.prev[p.seg]]) / (2 * t.step);
          const G = (u: number, w: number): [number, number, number] => [c.x + fx * u + sx * w, c.y + 0.06 + u * slope + w * t.bank[p.seg], c.z + fz * u + sz * w];
          for (let s = 0; s < n; s++) {
            const a0 = (s / n) * TAU;
            const a1 = ((s + 1) / n) * TAU;
            dyn.tri(G(0, 0), G(Math.cos(a1) * r, Math.sin(a1) * r), G(Math.cos(a0) * r, Math.sin(a0) * r), SHADOW, a);
            if (warn > 0.4 || cyc < p.on) {
              const r2 = p.radius + 0.25;
              dyn.tri(G(Math.cos(a0) * p.radius, Math.sin(a0) * p.radius), G(Math.cos(a1) * p.radius, Math.sin(a1) * p.radius), G(Math.cos(a1) * r2, Math.sin(a1) * r2), WARN, 0.9);
              dyn.tri(G(Math.cos(a0) * p.radius, Math.sin(a0) * p.radius), G(Math.cos(a1) * r2, Math.sin(a1) * r2), G(Math.cos(a0) * r2, Math.sin(a0) * r2), WARN, 0.9);
            }
          }
        }
      }
      dyn.end();
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Dreiecke, die je Bild neu geschrieben werden (Ecken mit Farbe und Deckkraft). */
class MeshBuilderDyn {
  readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly pa: THREE.BufferAttribute;
  private readonly ca: THREE.BufferAttribute;
  private n = 0;
  private readonly max: number;

  constructor(capTris: number) {
    this.max = capTris * 3;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 4);
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pa);
    this.geo.setAttribute('color', this.ca);
    this.geo.setDrawRange(0, 0);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  }

  begin(): void {
    this.n = 0;
  }

  tri(a: [number, number, number], b: [number, number, number], c: [number, number, number], col: RGB, alpha: number): void {
    if (this.n + 3 > this.max) return;
    for (const p of [a, b, c]) {
      const i = this.n++;
      this.pos[i * 3] = p[0];
      this.pos[i * 3 + 1] = p[1];
      this.pos[i * 3 + 2] = p[2];
      this.col[i * 4] = col[0];
      this.col[i * 4 + 1] = col[1];
      this.col[i * 4 + 2] = col[2];
      this.col[i * 4 + 3] = alpha;
    }
  }

  end(): void {
    this.geo.setDrawRange(0, this.n);
    if (this.n === 0) return;
    this.pa.clearUpdateRanges();
    this.pa.addUpdateRange(0, this.n * 3);
    this.pa.needsUpdate = true;
    this.ca.clearUpdateRanges();
    this.ca.addUpdateRange(0, this.n * 4);
    this.ca.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
  }
}

