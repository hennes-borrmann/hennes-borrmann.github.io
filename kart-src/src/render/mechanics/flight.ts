// Wolkenwerft: alles, was das Fliegen lesbar macht.
//
// Die Physik (game/sim.ts, game/mechanics.ts „Fliegen“) kennt über den
// Flugstrecken (Abschnitte mit EDGE_GLIDE) nur Zahlen: die Ideallinie
// (track.py), einen breiten Korridor (track.wh), Aufwinde und Schubringe. Hier
// bekommen sie ein Gesicht:
//   * Absprung: Portal über dem Ende der Fahrbahn, gelbe Lauflichter am Rand,
//     die zur Kante hin laufen, Warnstreifen an der Kante, zwei Windsäcke.
//   * Korridor: Markierungsballone links und rechts auf Höhe der Ideallinie
//     (an Leinen, die im Wolkenmeer verschwinden), darunter gestrichelte
//     Leuchtbojen, über die ein Lichtpuls in Flugrichtung läuft.
//   * Schubringe: dunkler Reif mit umlaufenden gelb-orangen Pfeilen und einem
//     zarten Schein – wie die Boost-Felder auf der Fahrbahn.
//   * Aufwinde: halbdurchsichtige, sich hinaufschraubende Bänder vom
//     Wolkenmeer bis über die Ideallinie, dazu aufsteigende Flocken in
//     Kameranähe. Warm und hell, aber durchsichtig: dahinter muss man die
//     Landebahn sehen.
//   * Landung: grüne Landefeuer am Rand, die in Fahrtrichtung laufen, zwei
//     Blitzmasten an der Schwelle, Schwellenbalken und Pfeile auf der Bahn.
//
// Alles läuft im Takt von `seconds` (reine Zierde, nichts hängt an der Rennzeit).
//
// Zeichenaufrufe (höchstens 7): Gerüste und Markierungen (toon) samt Kontur,
// Pfeile der Ringe, Ballone samt Kontur, Lichter, Luft (Aufwinde und Schein
// der Ringe in einem Shader). Ohne detail: keine Konturen, keine Teilchen,
// halb so viele Ballone.

import * as THREE from 'three';
import { EDGE_GLIDE, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { boxT, cylT, face, stripedFace, type Xform } from './machineKit';

// --- Farben ------------------------------------------------------------------------

const C_INK = rgb(0x1c1a26);
const C_YEL = rgb(0xffcf1f);
const C_ORANGE = rgb(0xff8414);
const C_ORANGE_D = rgb(0xc85a0c);
const C_FRAME = rgb(0x2d3550);
const C_FRAME_D = rgb(0x222842);
const C_STEEL = rgb(0x8d98b0);
const C_RED = rgb(0xe8483f);
const C_WHITE = rgb(0xffffff);
const C_MARK = rgb(0xf4f6ff);
const C_GREEN_MARK = rgb(0x2fd97a);

/** Lichter: Farbe an (0xRRGGBB) und wie hell sie aus sind. */
const L_TAKEOFF = new THREE.Color(0xffd21f);
const L_BEAM = new THREE.Color(0xff5a1f);
const L_LAND = new THREE.Color(0x36ff7a);
const L_LAND_HI = new THREE.Color(0xe8fff0);
const L_BUOY = new THREE.Color(0x5ff0ff);
const L_BUOY_HI = new THREE.Color(0xffffff);
const DIM = 0.22;

/** Ballone: zwei Farben im Wechsel. */
const BALLOON_A = new THREE.Color(0xf2413a);
const BALLOON_B = new THREE.Color(0x2f3f8f);

// --- Maße ------------------------------------------------------------------------

/** Ring: Pfeile zwischen RI und RO, Tiefe; Reif dahinter bis RF. */
const RI = 3.45;
const RO = 4.55;
const RF = 4.85;
const ARROWS = 12;
/** Portal: Unterkante und Oberkante des Querträgers über der Fahrbahn. */
const BEAM_LO = 6.6;
const BEAM_HI = 7.7;
/** Abstand der Ballone längs der Flugstrecke (Meter). */
const BALLOON_GAP = 28;
/** Leine der Ballone: reicht sicher bis ins Wolkenmeer. */
const LEASH = 46;
/** Höhe des Wolkenmeers (themes.ts: liquidY). */
const SEA_Y = 9;
/** Teilchen der Aufwinde nur bis zu dieser Entfernung von der Kamera. */
const FX_NEAR = 120;

/** Eine Flugstrecke: Abschnitte first … (count Stück), davor take (letzter fester), danach land (erster fester). */
interface Run {
  first: number;
  count: number;
  take: number;
  land: number;
}

/** Hat die Strecke Flugstrecken? */
export function hasGlide(t: Track): boolean {
  for (let i = 0; i < t.total; i++) if (t.edge[i] & EDGE_GLIDE) return true;
  return false;
}

function findRuns(t: Track): Run[] {
  const runs: Run[] = [];
  for (let i = 0; i < t.total; i++) {
    if (!(t.edge[i] & EDGE_GLIDE) || t.edge[t.prev[i]] & EDGE_GLIDE) continue;
    let j = i;
    let c = 0;
    while (t.edge[j] & EDGE_GLIDE && c < t.total) {
      j = t.next[j];
      c++;
    }
    runs.push({ first: i, count: c, take: t.prev[i], land: j });
  }
  return runs;
}

/** k Abschnitte vor (k > 0) bzw. zurück (k < 0). */
function walkSeg(t: Track, s: number, k: number): number {
  let i = s;
  for (let n = 0; n < Math.abs(k); n++) i = k > 0 ? t.next[i] : t.prev[i];
  return i;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Dreieck, sichtbar von der Seite out. */
function triOut(mb: MeshBuilder, a: V3, b: V3, c: V3, out: V3, col: RGB): void {
  if (dot(cross(sub(b, a), sub(c, a)), out) >= 0) mb.tri(a, b, c, col);
  else mb.tri(a, c, b, col);
}

export function buildFlight(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const runs = findRuns(t);
  const UP: V3 = [0, 1, 0];

  /** Punkt im Rahmen eines Abschnitts: seitlich lat, dy über der Fahrbahn, fwd voraus. */
  const P = (s: number, lat: number, dy: number, fwd = 0): V3 => [
    t.px[s] + rightX(t, s) * lat + t.tx[s] * fwd,
    t.py[s] + lat * t.bank[s] + dy,
    t.pz[s] + rightZ(t, s) * lat + t.tz[s] * fwd,
  ];
  /** Punkt auf der Fahrbahn, along Meter ab Abschnitt s (über mehrere Abschnitte hinweg). */
  const A = (s: number, along: number, lat: number, dy: number): V3 => {
    const k = Math.floor(along);
    return P(walkSeg(t, s, k), lat, dy, along - k);
  };

  // Feste Teile: solid bekommt eine Kontur, flat (auf der Fahrbahn) nicht.
  const solid = new MeshBuilder();
  const flat = new MeshBuilder();

  // --- Lichter (eine Instanz je Licht) ---
  interface Light {
    pos: V3;
    size: number;
    kind: number;
    /** Lage in der Kette (für Lauflichter): Meter oder Nummer. */
    k: number;
  }
  const K_TAKE = 0;
  const K_BEAM = 1;
  const K_LAND = 2;
  const K_BEACON = 3;
  const K_BUOY = 4;
  const lights: Light[] = [];

  // === Absprung =========================================================================
  for (const r of runs) {
    const e = r.take;
    const wh = t.wh[e];
    // Warnstreifen über die ganze Breite bis an die Kante (die Fahrbahn endet bei fwd 0.5) und an der Stirnseite hinab.
    stripedFace(flat, P(e, -wh, 0.03, -2.6), P(e, wh, 0.03, -2.6), P(e, wh, 0.03, 0.5), P(e, -wh, 0.03, 0.5), UP, C_YEL, C_INK, 0.7);
    const fwdOut: V3 = [t.tx[e], 0, t.tz[e]];
    stripedFace(flat, P(e, -wh, 0.03, 0.52), P(e, wh, 0.03, 0.52), P(e, wh, -1.6, 0.52), P(e, -wh, -1.6, 0.52), fwdOut, C_YEL, C_INK, 0.7);

    // Lauflichter am Rand über 30 m bis zur Kante.
    for (let k = 0; k < 12; k++) {
      const along = 0.3 - k * 2.6;
      for (const sd of [-1, 1]) lights.push({ pos: A(e, along, sd * (wh - 0.4), 0.22), size: 0.32, kind: K_TAKE, k });
    }

    // Portal 9 m vor der Kante.
    const s = walkSeg(t, e, -9);
    const rx = rightX(t, s);
    const rz = rightZ(t, s);
    const F: Xform = (lat, y, fwd) => [t.px[s] + rx * lat + t.tx[s] * fwd, y, t.pz[s] + rz * lat + t.tz[s] * fwd];
    const whs = t.wh[s];
    const roadAt = (lat: number): number => t.py[s] + lat * t.bank[s];
    const yR = Math.max(roadAt(-whs), roadAt(whs), t.py[s]);
    const yB = yR + BEAM_LO;
    const yT = yR + BEAM_HI;
    // Innenkante der Pfosten bei wh + 0,65 (außerhalb der Fahrbahn).
    const L = whs + 1.0;
    for (const sd of [-1, 1]) {
      const lc = sd * L;
      const g0 = roadAt(sd * whs) - 4;
      boxT(solid, F, lc - 0.35, lc + 0.35, g0, yR - 0.2, -0.35, 0.35, C_FRAME);
      boxT(solid, F, lc - 0.35, lc + 0.35, yR - 0.2, yR + 1.6, -0.35, 0.35, C_YEL, { stripes: [C_INK, 0.35], noBottom: true });
      boxT(solid, F, lc - 0.35, lc + 0.35, yR + 1.6, yT, -0.35, 0.35, C_FRAME, { noBottom: true });
      // Windsack oben auf dem Pfosten: Mast und gestreifter Schlauch, vom Wind nach hinten außen gedrückt.
      cylT(solid, F, lc, 0, 0.07, yT, yT + 2.6, C_STEEL, undefined, 5);
      windsock(solid, F(lc, yT + 2.45, 0), [-t.tx[s] * 0.8 + rx * sd * 0.5, -0.25, -t.tz[s] * 0.8 + rz * sd * 0.5]);
    }
    // Querträger: Warnstreifenband unten, darüber dunkel, oben Laufsteg.
    boxT(solid, F, -L - 0.5, L + 0.5, yB, yB + 0.34, -0.45, 0.45, C_YEL, { stripes: [C_INK, 0.45] });
    boxT(solid, F, -L - 0.5, L + 0.5, yB + 0.34, yT, -0.45, 0.45, C_FRAME, { noBottom: true, top: C_FRAME_D });
    // Tafel über dem Träger: drei gelbe Winkel nach oben (= abheben).
    const sw = 3.4;
    const sh = 2.2;
    boxT(solid, F, -sw, sw, yT, yT + sh, -0.15, 0.15, C_FRAME_D, { noBottom: true });
    const back: V3 = [-t.tx[s], 0, -t.tz[s]];
    for (let c = 0; c < 3; c++) {
      const cx = (c - 1) * 2.1;
      const y0 = yT + 0.45;
      const y1 = yT + sh - 0.35;
      const w = 0.8;
      const th = 0.42;
      // Winkel ^: zwei Schenkel als Parallelogramme vor der Tafel (zur Anfahrt hin).
      face(solid, F(cx - w, y0, -0.17), F(cx - w + th, y0, -0.17), F(cx + th / 2, y1, -0.17), F(cx - th / 2, y1, -0.17), back, C_YEL);
      face(solid, F(cx + w - th, y0, -0.17), F(cx + w, y0, -0.17), F(cx + th / 2, y1, -0.17), F(cx - th / 2, y1, -0.17), back, C_YEL);
    }
    // Lichter an der Stirnseite des Trägers.
    for (let k = 0; k < 8; k++) {
      const lat = -L + ((k + 0.5) / 8) * 2 * L;
      lights.push({ pos: F(lat, (yB + 0.34 + yT) / 2, -0.5), size: 0.34, kind: K_BEAM, k });
    }
  }

  // === Landung ===========================================================================
  for (const r of runs) {
    const s = r.land;
    const wh = t.wh[s];
    const rh = t.rh[s];
    // Die Fahrbahn beginnt bei fwd −0,5 vor dem ersten festen Abschnitt.
    // Schwellenbalken (Klaviertasten) über 5 m.
    const bars = 8;
    const bw = (2 * rh) / (bars * 2 - 1);
    for (let b = 0; b < bars; b++) {
      const l0 = -rh + b * 2 * bw;
      for (let a = 0; a < 5; a++) {
        const al = -0.2 + a;
        face(flat, A(s, al, l0, 0.02), A(s, al, l0 + bw, 0.02), A(s, al + 1, l0 + bw, 0.02), A(s, al + 1, l0, 0.02), UP, C_MARK);
      }
    }
    // Zwei breite Pfeile in Fahrtrichtung.
    for (const a0 of [9, 17]) {
      const W = rh * 0.8;
      const head = 4;
      const thick = 1.6;
      // Winkel >: zwei Schenkel von den Seiten nach vorn zur Mitte, je Abschnitt ein Viereck.
      for (const sd of [-1, 1]) {
        const N = 4;
        for (let q = 0; q < N; q++) {
          const f0 = q / N;
          const f1 = (q + 1) / N;
          const la0 = sd * W * (1 - f0);
          const la1 = sd * W * (1 - f1);
          face(flat, A(s, a0 + head * f0, la0, 0.02), A(s, a0 + head * f1, la1, 0.02), A(s, a0 + head * f1 + thick, la1, 0.02), A(s, a0 + head * f0 + thick, la0, 0.02), UP, C_MARK);
        }
      }
    }
    // Grüner Randstreifen über die Länge der Landefeuer.
    for (const sd of [-1, 1]) {
      for (let a = 0; a < 30; a += 2) face(flat, A(s, a - 0.4, sd * (rh + 0.05), 0.025), A(s, a - 0.4, sd * (rh + 0.45), 0.025), A(s, a + 1.6, sd * (rh + 0.45), 0.025), A(s, a + 1.6, sd * (rh + 0.05), 0.025), UP, C_GREEN_MARK);
    }
    // Landefeuer am Rand.
    for (let k = 0; k < 12; k++) {
      for (const sd of [-1, 1]) lights.push({ pos: A(s, 0.2 + k * 2.6, sd * (wh - 0.4), 0.3), size: 0.44, kind: K_LAND, k });
    }
    // Blitzmasten an der Schwelle, außerhalb der Fahrbahn.
    for (const sd of [-1, 1]) {
      const lat = sd * (wh + 1.0);
      const base = P(s, lat, 0);
      const F: Xform = (x, y, z) => [base[0] + rightX(t, s) * x + t.tx[s] * z, y, base[2] + rightZ(t, s) * x + t.tz[s] * z];
      cylT(solid, F, 0, 0, 0.18, base[1] - 4, base[1] + 4.6, C_FRAME, C_FRAME, 6);
      boxT(solid, F, -0.55, 0.55, base[1] + 4.5, base[1] + 4.75, -0.55, 0.55, C_FRAME_D);
      lights.push({ pos: [base[0], base[1] + 5.55, base[2]], size: 0.85, kind: K_BEACON, k: 0 });
    }
  }

  // === Korridor: Bojen ======================================================================
  for (const r of runs) {
    for (let a = 5; a < r.count - 5; a += 13) {
      for (let d = 0; d < 3; d++) {
        const s = walkSeg(t, r.first, a + d * 2);
        lights.push({ pos: [t.px[s], t.py[s] - 5.5, t.pz[s]], size: 0.42, kind: K_BUOY, k: a + d * 2 });
      }
    }
  }

  // === Schubringe: Lage ==============================================================
  /** Lage je Ring: Mitte und Ausrichtung (lokal z = Flugrichtung). */
  const ringQ: THREE.Quaternion[] = [];
  const ringM: THREE.Matrix4[] = [];
  const ringPos: THREE.Vector3[] = [];
  const xAxis = new THREE.Vector3(1, 0, 0);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (const rg of t.rings) {
    const s = rg.seg;
    const a = t.prev[s];
    const b = t.next[s];
    const slope = (t.py[b] - t.py[a]) / Math.max(0.1, Math.hypot(t.px[b] - t.px[a], t.pz[b] - t.pz[a]));
    const q = new THREE.Quaternion().setFromAxisAngle(yAxis, Math.atan2(t.tx[s], t.tz[s]));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, -Math.atan(slope)));
    const pos = new THREE.Vector3(rg.x, rg.y, rg.z);
    ringQ.push(q);
    ringPos.push(pos);
    ringM.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
  }
  // === Feste Netze ======================================================================
  let tris = 0;
  const solidGeo = solid.build();
  const flatGeo = flat.build();
  const allGeo = mergeColored([solidGeo, flatGeo]);
  const staticMat = toonMaterial({ vertexColors: true });
  // Markierungen liegen 2–3 cm über der Fahrbahn: etwas nach vorn ziehen, sonst flimmern sie.
  staticMat.polygonOffset = true;
  staticMat.polygonOffsetFactor = -2;
  staticMat.polygonOffsetUnits = -4;
  const staticMesh = new THREE.Mesh(allGeo, staticMat);
  staticMesh.frustumCulled = false;
  group.add(staticMesh);
  disposables.push(allGeo, flatGeo, staticMat);
  tris += allGeo.getAttribute('position').count / 3;
  if (detail && !solid.empty) {
    addSmoothNormals(solidGeo);
    const ol = new THREE.Mesh(solidGeo, outlineMaterial(0.045));
    ol.name = 'outline';
    ol.frustumCulled = false;
    group.add(ol);
    tris += solid.triangles;
  }
  disposables.push(solidGeo);

  // === Pfeile der Ringe (instanziert, drehen sich) =========================================
  let arrows: THREE.InstancedMesh | null = null;
  if (t.rings.length > 0) {
    const ab = new MeshBuilder();
    const D = 0.34;
    const rm = (RI + RO) / 2;
    const span = ((Math.PI * 2) / ARROWS) * 0.72;
    const dl = 0.13;
    const pt = (r: number, a: number, z: number): V3 => [Math.cos(a) * r, Math.sin(a) * r, z];
    // Dunkler Reif hinter den Pfeilen (dreht sich mit; er ist rund, nur der Außenrand zeigt es).
    const N = 16;
    const DB = 0.16;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const outN: V3 = [Math.cos(am), Math.sin(am), 0];
      face(ab, pt(RI - 0.12, a0, DB), pt(RF, a0, DB), pt(RF, a1, DB), pt(RI - 0.12, a1, DB), [0, 0, 1], C_INK);
      face(ab, pt(RI - 0.12, a0, -DB), pt(RF, a0, -DB), pt(RF, a1, -DB), pt(RI - 0.12, a1, -DB), [0, 0, -1], C_INK);
      face(ab, pt(RF, a0, -DB), pt(RF, a1, -DB), pt(RF, a1, DB), pt(RF, a0, DB), outN, k % 2 === 0 ? C_ORANGE_D : C_INK);
      face(ab, pt(RI - 0.12, a0, -DB), pt(RI - 0.12, a1, -DB), pt(RI - 0.12, a1, DB), pt(RI - 0.12, a0, DB), [-outN[0], -outN[1], 0], C_INK);
    }
    for (let k = 0; k < ARROWS; k++) {
      const a0 = (k / ARROWS) * Math.PI * 2;
      const a1 = a0 + span;
      const col = k % 2 === 0 ? C_YEL : C_ORANGE;
      // Umriss: hinten innen, vorn innen, Spitze, vorn außen, hinten außen, Kerbe.
      const poly: [number, number][] = [
        [RI, a0],
        [RI, a1],
        [rm, a1 + dl],
        [RO, a1],
        [RO, a0],
        [rm, a0 + dl],
      ];
      for (const z of [D, -D]) {
        const out: V3 = [0, 0, z];
        const p = poly.map(([r, a]) => pt(r, a, z));
        triOut(ab, p[0], p[1], p[2], out, col);
        triOut(ab, p[0], p[2], p[5], out, col);
        triOut(ab, p[5], p[2], p[3], out, col);
        triOut(ab, p[5], p[3], p[4], out, col);
      }
      for (let e = 0; e < poly.length; e++) {
        const [r0, b0] = poly[e];
        const [r1, b1] = poly[(e + 1) % poly.length];
        const p0 = pt(r0, b0, -D);
        const p1 = pt(r1, b1, -D);
        const mid = pt((r0 + r1) / 2, (b0 + b1) / 2, 0);
        const cen = pt(rm, a0 + span / 2, 0);
        face(ab, p0, p1, pt(r1, b1, D), pt(r0, b0, D), [mid[0] - cen[0], mid[1] - cen[1], 0], C_ORANGE_D);
      }
    }
    const geo = ab.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    arrows = new THREE.InstancedMesh(geo, mat, t.rings.length);
    arrows.frustumCulled = false;
    group.add(arrows);
    disposables.push(geo, mat, arrows);
    tris += ab.triangles * t.rings.length;
  }

  // === Ballone (instanziert, schaukeln) =====================================================
  interface Balloon {
    x: number;
    y: number;
    z: number;
    ph: number;
  }
  const balloons: Balloon[] = [];
  for (const r of runs) {
    const gap = detail ? BALLOON_GAP : BALLOON_GAP * 2;
    const n = Math.max(1, Math.round((r.count - 16) / gap));
    const g = (r.count - 16) / n;
    for (let q = 0; q <= n; q++) {
      const s = walkSeg(t, r.first, Math.round(8 + q * g));
      for (const sd of [-1, 1]) {
        const lat = sd * (t.wh[s] + 0.5);
        balloons.push({ x: t.px[s] + rightX(t, s) * lat, y: t.py[s], z: t.pz[s] + rightZ(t, s) * lat, ph: balloons.length * 1.37 });
      }
    }
  }
  let balloonMesh: THREE.InstancedMesh | null = null;
  if (balloons.length > 0) {
    const bb = new MeshBuilder();
    const SIDES = 6;
    const prof: [number, number, number][] = [
      [0, -1.25, 0.72],
      [0.85, -0.62, 0.86],
      [1.1, 0.25, 1],
      [0.66, 1.0, 1],
      [0, 1.18, 1],
    ];
    const ring = (r: number, y: number, k: number): V3 => {
      const a = ((k % SIDES) / SIDES) * Math.PI * 2;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    for (let p = 0; p + 1 < prof.length; p++) {
      const [r0, y0, f0] = prof[p];
      const [r1, y1] = prof[p + 1];
      const col: RGB = [f0, f0, f0];
      for (let k = 0; k < SIDES; k++) {
        const am = ((k + 0.5) / SIDES) * Math.PI * 2;
        const out: V3 = [Math.cos(am), (y1 - y0) * 0.1 * (r0 - r1), Math.sin(am)];
        if (r0 === 0) triOut(bb, [0, y0, 0], ring(r1, y1, k), ring(r1, y1, k + 1), [out[0], -0.5, out[2]], col);
        else if (r1 === 0) triOut(bb, ring(r0, y0, k), ring(r0, y0, k + 1), [0, y1, 0], [out[0], 0.5, out[2]], col);
        else face(bb, ring(r0, y0, k), ring(r0, y0, k + 1), ring(r1, y1, k + 1), ring(r1, y1, k), out, col);
      }
    }
    const bodyVerts = bb.triangles * 3;
    // Leine: dünnes Prisma nach unten (ohne Kontur).
    const lw = 0.05;
    const L0: V3[] = [
      [lw, -1.2, 0],
      [-lw, -1.2, lw],
      [-lw, -1.2, -lw],
    ];
    for (let k = 0; k < 3; k++) {
      const a = L0[k];
      const b = L0[(k + 1) % 3];
      face(bb, a, b, [b[0], -1.2 - LEASH, b[2]], [a[0], -1.2 - LEASH, a[2]], [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2], [0.08, 0.08, 0.1]);
    }
    const geo = bb.build();
    const mat = toonMaterial({ vertexColors: true });
    balloonMesh = new THREE.InstancedMesh(geo, mat, balloons.length);
    balloonMesh.frustumCulled = false;
    balloons.forEach((_, i) => balloonMesh!.setColorAt(i, i % 4 < 2 ? BALLOON_A : BALLOON_B));
    group.add(balloonMesh);
    disposables.push(geo, mat, balloonMesh);
    tris += bb.triangles * balloons.length;
    if (detail) {
      addSmoothNormals(geo);
      // Die Leine bekommt keine Kontur (onormal der Länge 0).
      const on = geo.getAttribute('onormal') as THREE.BufferAttribute;
      for (let i = bodyVerts; i < on.count; i++) on.setXYZ(i, 0, 0, 0);
      const ol = new THREE.InstancedMesh(geo, outlineMaterial(0.06), balloons.length);
      ol.instanceMatrix = balloonMesh.instanceMatrix;
      ol.name = 'outline';
      ol.frustumCulled = false;
      group.add(ol);
      disposables.push(ol);
      tris += bb.triangles * balloons.length;
    }
  }

  // === Lichter (instanziert, Farbe je Bild) =================================================
  let lightMesh: THREE.InstancedMesh | null = null;
  let lightCol: Float32Array | null = null;
  if (lights.length > 0) {
    const geo = new THREE.OctahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    lightMesh = new THREE.InstancedMesh(geo, mat, lights.length);
    lightMesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    const pv = new THREE.Vector3();
    const sv = new THREE.Vector3();
    const q = new THREE.Quaternion();
    lights.forEach((l, i) => {
      sv.setScalar(l.size);
      if (l.kind === K_BUOY) sv.set(l.size, l.size * 1.6, l.size);
      m.compose(pv.set(l.pos[0], l.pos[1], l.pos[2]), q, sv);
      lightMesh!.setMatrixAt(i, m);
      lightMesh!.setColorAt(i, L_TAKEOFF);
    });
    lightCol = lightMesh.instanceColor!.array as Float32Array;
    group.add(lightMesh);
    disposables.push(geo, mat, lightMesh);
    tris += 8 * lights.length;
  }

  // === Luft: Aufwinde und Schein der Ringe (ein Shader) =====================================
  const pos: number[] = [];
  const uvs: number[] = [];
  const kind: number[] = [];
  const axis: number[] = [];
  const vert = (x: number, y: number, z: number, u: number, v: number, kd: number, ax: number, az: number, ar: number, ah: number): void => {
    pos.push(x, y, z);
    uvs.push(u, v);
    kind.push(kd);
    axis.push(ax, az, ar, ah);
  };
  for (const th of t.thermals) {
    const top = th.y + 10;
    const H = top - SEA_Y;
    for (const [layer, R] of [
      [0, th.radius],
      [1, th.radius * 0.55],
    ] as [number, number][]) {
      const N = layer === 0 ? 20 : 14;
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2;
        const a1 = ((k + 1) / N) * Math.PI * 2;
        const x0 = th.x + Math.cos(a0) * R;
        const z0 = th.z + Math.sin(a0) * R;
        const x1 = th.x + Math.cos(a1) * R;
        const z1 = th.z + Math.sin(a1) * R;
        const u0 = k / N;
        const u1 = (k + 1) / N;
        const V = (x: number, y: number, z: number, u: number, v: number): void => vert(x, y, z, u, v, layer, th.x, th.z, th.radius, H);
        V(x0, SEA_Y, z0, u0, 0);
        V(x1, SEA_Y, z1, u1, 0);
        V(x1, top, z1, u1, H);
        V(x0, SEA_Y, z0, u0, 0);
        V(x1, top, z1, u1, H);
        V(x0, top, z0, u0, H);
      }
    }
  }
  {
    const v = new THREE.Vector3();
    const N = 24;
    for (let i = 0; i < t.rings.length; i++) {
      const m = ringM[i];
      const W = (r: number, a: number): [number, number, number] => {
        v.set(Math.cos(a) * r, Math.sin(a) * r, 0).applyMatrix4(m);
        return [v.x, v.y, v.z];
      };
      const r0 = RF - 0.05;
      const r1 = RF + 3.2;
      const rc = ringPos[i];
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2;
        const a1 = ((k + 1) / N) * Math.PI * 2;
        const V = (p: [number, number, number], u: number): void => vert(p[0], p[1], p[2], u, i, 2, rc.x, rc.z, 0, 0);
        V(W(r0, a0), 0);
        V(W(r1, a0), 1);
        V(W(r1, a1), 1);
        V(W(r0, a0), 0);
        V(W(r1, a1), 1);
        V(W(r0, a1), 0);
      }
    }
  }
  let air: THREE.Mesh | null = null;
  let airMat: THREE.ShaderMaterial | null = null;
  if (pos.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
    geo.setAttribute('aAxis', new THREE.Float32BufferAttribute(axis, 4));
    geo.computeBoundingSphere();
    airMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: AIR_VERT,
      fragmentShader: AIR_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    air = new THREE.Mesh(geo, airMat);
    air.frustumCulled = false;
    air.renderOrder = 3;
    group.add(air);
    disposables.push(geo, airMat);
    tris += pos.length / 9;
  }

  group.userData.triangles = tris;

  // --- Hilfsobjekte für update() (kein Garbage pro Bild) ---
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qr = new THREE.Quaternion();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const eul = new THREE.Euler();
  const thermalAcc = t.thermals.map(() => 0);

  const setLight = (i: number, c: THREE.Color, f: number): void => {
    lightCol![i * 3] = c.r * f;
    lightCol![i * 3 + 1] = c.g * f;
    lightCol![i * 3 + 2] = c.b * f;
  };
  const mixLight = (i: number, a: THREE.Color, b: THREE.Color, k: number): void => {
    lightCol![i * 3] = a.r + (b.r - a.r) * k;
    lightCol![i * 3 + 1] = a.g + (b.g - a.g) * k;
    lightCol![i * 3 + 2] = a.b + (b.b - a.b) * k;
  };

  return {
    group,
    update(_time, seconds, dt, cam, fx) {
      if (airMat) airMat.uniforms.uTime.value = seconds;

      // Ringe: Pfeile laufen um, das Ganze pulsiert sacht.
      if (arrows) {
        for (let i = 0; i < ringQ.length; i++) {
          q.copy(ringQ[i]).multiply(qr.setFromAxisAngle(zAxis, seconds * 1.6 + i));
          sv.setScalar(1 + 0.045 * Math.sin(seconds * 6 + i * 1.3));
          // Streift die Kamera den Reif, verdeckte er kurz das ganze Bild – dann wird er nicht gezeichnet.
          pv.copy(cam).sub(ringPos[i]);
          const ax = pv.dot(dir.set(0, 0, 1).applyQuaternion(ringQ[i]));
          const rad = Math.sqrt(Math.max(0, pv.lengthSq() - ax * ax));
          if (Math.abs(ax) < 1.6 && rad > RI - 0.9 && rad < RF + 1.2) sv.setScalar(0);
          m4.compose(ringPos[i], q, sv);
          arrows.setMatrixAt(i, m4);
        }
        arrows.instanceMatrix.needsUpdate = true;
      }

      // Ballone: schaukeln an ihrer Leine, heben und senken sich ein wenig.
      if (balloonMesh) {
        sv.setScalar(1);
        for (let i = 0; i < balloons.length; i++) {
          const b = balloons[i];
          eul.set(0.07 * Math.sin(seconds * 0.9 + b.ph), b.ph, 0.07 * Math.sin(seconds * 0.7 + b.ph * 1.7));
          q.setFromEuler(eul);
          pv.set(b.x, b.y + 0.35 * Math.sin(seconds * 1.1 + b.ph), b.z);
          m4.compose(pv, q, sv);
          balloonMesh.setMatrixAt(i, m4);
        }
        balloonMesh.instanceMatrix.needsUpdate = true;
      }

      // Lichter
      if (lightMesh && lightCol) {
        for (let i = 0; i < lights.length; i++) {
          const l = lights[i];
          if (l.kind === K_TAKE) {
            // Lauflicht zur Kante hin.
            const ph = (l.k / 12 + seconds * 1.5) % 1;
            setLight(i, L_TAKEOFF, ph < 0.22 ? 1.25 : DIM + 0.15);
          } else if (l.kind === K_BEAM) {
            const on = (Math.floor(seconds * 3) + l.k) % 2 === 0;
            setLight(i, on ? L_TAKEOFF : L_BEAM, on ? 1.2 : 0.8);
          } else if (l.kind === K_LAND) {
            // Lauflicht in Fahrtrichtung der Bahn.
            const ph = (((seconds * 1.4 - l.k / 12) % 1) + 1) % 1;
            if (ph < 0.2) mixLight(i, L_LAND, L_LAND_HI, 1 - ph / 0.2);
            else setLight(i, L_LAND, 0.55);
          } else if (l.kind === K_BEACON) {
            const ph = (seconds * 1.2) % 1;
            if (ph < 0.18) setLight(i, L_LAND_HI, 1.3);
            else setLight(i, L_LAND, ph < 0.5 ? 0.7 : DIM);
          } else {
            // Bojen: ein Lichtpuls läuft schneller als das Kart in Flugrichtung.
            const ph = (((seconds * 42 - l.k) / 110) % 1 + 1) % 1;
            if (ph < 0.12) mixLight(i, L_BUOY, L_BUOY_HI, 1 - ph / 0.12);
            else setLight(i, L_BUOY, 0.6);
          }
        }
        if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;
      }

      // Aufwinde: aufsteigende Flocken in Kameranähe.
      if (detail) {
        for (let i = 0; i < t.thermals.length; i++) {
          const th = t.thermals[i];
          const d = Math.hypot(th.x - cam.x, th.z - cam.z);
          if (d > FX_NEAR) continue;
          const top = th.y + 10;
          thermalAcc[i] -= dt * (d < th.radius * 2 ? 22 : 12);
          while (thermalAcc[i] <= 0) {
            thermalAcc[i] += 1;
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * th.radius * 0.95;
            const y = Math.max(SEA_Y + 2, Math.min(top - 2, cam.y - 10 + Math.random() * 18));
            const x = th.x + Math.cos(a) * r;
            const z = th.z + Math.sin(a) * r;
            // Wirbel: tangential mit, nach oben.
            const vx = -Math.sin(a) * 1.4;
            const vz = Math.cos(a) * 1.4;
            if (Math.random() < 0.7) fx.puff(x, y, z, vx, th.lift + Math.random() * 3, vz, 1.3, 0.3 + Math.random() * 0.3, Math.random() < 0.5 ? 0xfff4dc : 0xffd9a8, 0.25, -2);
            else fx.spark(x, y, z, vx, th.lift + 2 + Math.random() * 3, vz, 1.0, 0.35, 0xffe2a0, -2);
          }
        }
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Windsack: gestreifter, sich verjüngender Schlauch ab p in Richtung dir. */
function windsock(mb: MeshBuilder, p: V3, dir: V3): void {
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  const d: V3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  // Zwei Achsen quer zum Schlauch.
  let u = cross(d, [0, 1, 0]);
  const ul = Math.hypot(u[0], u[1], u[2]) || 1;
  u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const w = cross(u, d);
  const S = 6;
  const SEGS = 4;
  const LEN = 2.6;
  const at = (f: number, k: number): V3 => {
    const r = 0.44 - 0.24 * f;
    const a = (k / S) * Math.PI * 2;
    const c = Math.cos(a) * r;
    const s = Math.sin(a) * r;
    // Der Schlauch hängt zum Ende hin etwas durch.
    const sag = -0.35 * f * f;
    return [p[0] + d[0] * LEN * f + u[0] * c + w[0] * s, p[1] + d[1] * LEN * f + u[1] * c + w[1] * s + sag, p[2] + d[2] * LEN * f + u[2] * c + w[2] * s];
  };
  for (let g = 0; g < SEGS; g++) {
    const f0 = g / SEGS;
    const f1 = (g + 1) / SEGS;
    const col = g % 2 === 0 ? C_RED : C_WHITE;
    for (let k = 0; k < S; k++) {
      const am = ((k + 0.5) / S) * Math.PI * 2;
      const out: V3 = [u[0] * Math.cos(am) + w[0] * Math.sin(am), u[1] * Math.cos(am) + w[1] * Math.sin(am), u[2] * Math.cos(am) + w[2] * Math.sin(am)];
      face(mb, at(f0, k), at(f0, k + 1), at(f1, k + 1), at(f1, k), out, col);
      // Innenseite nur am Anfang: man sieht in die Öffnung hinein.
      if (g === 0) face(mb, at(f0, k), at(f0, k + 1), at(f1, k + 1), at(f1, k), [-out[0], -out[1], -out[2]], shadeRgb(C_RED, 0.55));
    }
  }
}

function shadeRgb(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}

/** Fügt fertige Netze (Lage, Normale, Farbe) zu einem zusammen. */
function mergeColored(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const g of geos) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const p = g.getAttribute('position').array as Float32Array;
    pos.set(p, o * 3);
    nor.set(g.getAttribute('normal').array as Float32Array, o * 3);
    col.set(g.getAttribute('color').array as Float32Array, o * 3);
    o += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// --- Shader der Luft ------------------------------------------------------------------
// aKind 0: Aufwind außen, 1: Aufwind innen (gegenläufig), 2: Schein eines Rings.
// aAxis: Achse (x, z), Radius und Höhe der Säule. uv: u rundherum, v Meter ab Wolkenmeer
// (beim Schein: u von innen nach außen).

const AIR_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aKind;
attribute vec4 aAxis;
varying vec2 vUv;
varying float vKind;
varying float vInside;
varying float vH;
void main() {
  vUv = uv;
  vKind = aKind;
  vH = aAxis.w;
  // Fliegt die Kamera durch die Säule, wird sie durchsichtiger.
  float d = length(cameraPosition.xz - aAxis.xy);
  vInside = aKind < 1.5 ? smoothstep(aAxis.z * 0.7, aAxis.z * 1.6, d) : 1.0;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const AIR_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
varying vec2 vUv;
varying float vKind;
varying float vInside;
varying float vH;
void main() {
  vec3 col;
  float a;
  if (vKind < 1.5) {
    bool inner = vKind > 0.5;
    // Schraubenbänder, die nach oben wandern.
    float n = inner ? 2.0 : 3.0;
    float dir = inner ? -1.0 : 1.0;
    float s = vUv.x * n * dir + (vUv.y - uTime * (inner ? 7.0 : 5.0)) / 11.0;
    float b = fract(s);
    if (b < 0.24) { col = vec3(1.0, 0.95, 0.8); a = 0.5; }
    else if (b < 0.3) { col = vec3(1.0, 0.5, 0.18); a = 0.75; }
    else { col = vec3(1.0, 0.78, 0.5); a = 0.1; }
    float fade = smoothstep(0.0, 9.0, vUv.y) * (1.0 - smoothstep(vH - 6.0, vH, vUv.y));
    a *= fade * mix(0.3, 1.0, vInside) * (inner ? 0.75 : 1.0);
  } else {
    // Schein um den Ring: innen kräftig, nach außen weich, pulsierend.
    float x = vUv.x;
    float p = 0.75 + 0.25 * sin(uTime * 6.0 + vUv.y * 1.3);
    col = vec3(1.0, 0.82, 0.25);
    a = (1.0 - x) * (1.0 - x) * 0.6 * p;
  }
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
