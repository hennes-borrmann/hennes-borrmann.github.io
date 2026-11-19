// Kulisse der Kristallmine: eine Zeche bei Nacht – und darunter das Bergwerk.
//
// Über Tage: der Förderturm über dem Hauptschacht (Strebengerüst mit zwei Seilscheiben, die sich drehen, Seile hinüber
// zum Fördermaschinenhaus), das Gerüst über dem Wetterschacht, die Zechengebäude am Platz (Lohnhalle, Kaue, Werkstatt mit
// warm erleuchteten Fenstern), ein Schornstein, die Halde, Laternen. Die Schächte sind runde Löcher im Gelände (world.ts):
// innen eine gemauerte Schachtwand bis zur Sohle, oben ein Schachtkranz über dem Trichter des Geländes. Im Hauptschacht
// fährt der Förderkorb auf und ab (mitten in der Wendel der Lorenbahn).
//
// Unter Tage: Alles, was tiefer als UNTER Meter liegt, umschließt ein Grubenbau aus Fels – je Abschnitt ein Querschnitt
// (Stollen, weiter Füllort, hohe Kaverne am Grubensee, der niedrige Alte Mann mit dem Rolloch unter dem Bohlensteg), längs
// geglättet. Wo sich zwei Grubenbaue durchdringen (Gabelungen, Einmündungen, der Eingang zur Geode, die Schachtwände), fällt
// jede Fläche weg, deren Mitte im anderen liegt – so entsteht ein zusammenhängender Hohlraum. In den Stollen stehen
// Türstöcke (Holzausbau), an jedem zweiten hängt eine Grubenlampe; an den Wänden wachsen leuchtende Kristalle. Im Grubensee
// liegt das Wasser (halb durchsichtig, von unten wie von oben zu sehen). Die Riesengeode ist ein hohler Fels-Zylinder mit
// Kuppel und Mulde, innen mit Kristallen besetzt; in ihrer Mitte steht die Kristallkugel auf einem Felspfeiler.
//
// Reine Kulisse: nichts ragt in den Raum über einer Fahrbahn (Türstöcke stehen außerhalb der Bande, ihre Kappen hängen
// mindestens 4,4 m über der Bahn, im Alten Mann 3,9 m), nichts in die Bahn des Bands an der Geodenwand. Alles mit festem
// Zufall aus der Strecke abgeleitet.
//
// Technik wie in der Nachtschicht: Eckenfarben, Toon-Material, unbeleuchtete Flächen für das, was leuchtet – keine eigenen
// Shader, keine Lichtquellen. Zeichenaufrufe: Fels und Bauten (Toon), Leuchtendes (Kristalle, Lampen, Fenster), Wasser,
// Seilscheiben, Förderkorb = 5.

import * as THREE from 'three';
import { EDGE_BAND, EDGE_OPEN_L, EDGE_OPEN_R, EDGE_RAIL, rightX, rightZ, type Track } from '../../game/track';
import { GEODE, SCHACHT, WETTERSCHACHT } from '../../game/tracks/kristall';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Fahrbahn tiefer als das liegt unter Tage (wie world.ts). */
const UNTER = -3;
const TAU = Math.PI * 2;

// --- Farben ---------------------------------------------------------------------

const C_FELS = rgb(0x3b3040);
const C_FELS_2 = rgb(0x30283a);
const C_FELS_D = rgb(0x241e2a);
const C_SOHLE = rgb(0x2c2622);
const C_KALK = rgb(0x8f8a84);
const C_HOLZ = rgb(0x6a4a2c);
const C_HOLZ_D = rgb(0x4a321e);
const C_ZIEGEL = rgb(0x6e3a2e);
const C_ZIEGEL_D = rgb(0x52291f);
const C_STAHL = rgb(0x4a5266);
const C_STAHL_D = rgb(0x323848);
const C_ROT = rgb(0x9a2a24);
const C_DACH = rgb(0x2a2630);
const C_BETON = rgb(0x55525a);
const C_HALDE = rgb(0x2a2629);
const C_HALDE_2 = rgb(0x332e30);
const C_WASSER = rgb(0x0f4f5a);
const C_WASSER_H = rgb(0x2a8a90);

const LAMPE = rgb(0xffd27a);
const FENSTER = rgb(0xffc864);
const FENSTER_D = rgb(0x2a2438);
/** Kristallfarben: Amethyst, Eis, Magenta, Grün, Bernstein. */
const KRISTALL = [0xb44dff, 0x3fe8ff, 0xff4fd8, 0x5dff9a, 0xffb02e].map(rgb);

/** Querschnitt eines Grubenbaus an einem Abschnitt. */
interface Bau {
  seg: number;
  /** Halbe lichte Breite und Höhe über der Fahrbahn (Meter). */
  w: number;
  h: number;
  /** 0 Stollen, 1 Alter Mann (niedrig, mit Rolloch), 2 Kaverne am See, 3 Füllort/Weitung. */
  kind: number;
}

/**
 * Form der Riesengeode: ein Fels-Zylinder (Halbmesser r) von y0 bis y1, darüber eine Kuppel (dome Meter hoch), darunter
 * eine Mulde (bowl Meter tief). Der Zylinder reicht so weit, wie das Band an seiner Wand liegt (auch für mechanics/band.ts).
 */
export function geodeForm(t: Track): { r: number; y0: number; y1: number; dome: number; bowl: number } {
  const r = GEODE.r + GEODE.axis + 2.5;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < t.n; i++) {
    if (Math.hypot(t.px[i] - GEODE.x, t.pz[i] - GEODE.z) < r + 4 && t.roll[i] > 0.01) {
      y0 = Math.min(y0, t.py[i] + GEODE.axis - 7.5);
      y1 = Math.max(y1, t.py[i] + GEODE.axis + 7.5);
    }
  }
  return { r, y0, y1, dome: 6, bowl: 9 };
}

/** Höhe der Mulde der Geode im Abstand d von ihrer Achse. */
export function geodeFloor(t: Track, d: number): number {
  const g = geodeForm(t);
  const k = Math.min(1, d / g.r);
  return g.y0 - g.bowl * Math.sqrt(Math.max(0, 1 - k * k));
}

export function buildKristallLife(world: World): Life {
  const t: Track = world.track;
  const detail = world.detail;
  const group = new THREE.Group();
  const rnd = seeded(2101);
  const toon = toonMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const waterMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  const disposables: { dispose(): void }[] = [toon, glowMat, waterMat];

  const fels = new MeshBuilder();
  const glow = new MeshBuilder();
  const wasser = new MeshBuilder();

  const { r: geodeR, y0: geoY0, y1: geoY1, dome: DOME, bowl: BOWL } = geodeForm(t);
  const shafts = world.schaechte;

  const inShaft = (x: number, y: number, z: number, margin = 0.4): boolean => {
    for (const s of shafts) if (Math.hypot(x - s.x, z - s.z) < s.r - margin && y > s.floor - 2 && y < 1.5) return true;
    return false;
  };
  const inGeode = (x: number, y: number, z: number, margin = 0.4): boolean => {
    const r = Math.hypot(x - GEODE.x, z - GEODE.z);
    if (r > geodeR - margin) return false;
    if (y > geoY0 && y < geoY1) return true;
    // Kuppel und Mulde als Halbellipsen
    const k = r / (geodeR - margin);
    if (y >= geoY1) return y < geoY1 + DOME * Math.sqrt(Math.max(0, 1 - k * k)) - margin;
    return y > geoY0 - BOWL * Math.sqrt(Math.max(0, 1 - k * k)) + margin;
  };

  // --- Grubenbaue: Querschnitt je Abschnitt ---------------------------------------
  const bau: (Bau | null)[] = new Array(t.total).fill(null);
  /** Liegt der Abschnitt auf einer Wendel in einem Schacht? */
  const onHelix = (i: number): boolean => {
    for (const w of [SCHACHT, WETTERSCHACHT]) {
      const r = Math.hypot(t.px[i] - w.x, t.pz[i] - w.z);
      if (r < w.wall + 1 && Math.abs(r - w.r) < 1.6 && t.py[i] > w.floor) return true;
    }
    return false;
  };
  // Kaverne am Grubensee: die Tauchstrecke und je 24 m davor und dahinter
  const deepNear = new Uint8Array(t.total);
  for (let i = 0; i < t.total; i++) {
    if (!t.deep[i]) continue;
    let a = i;
    let b = i;
    deepNear[i] = 1;
    for (let k = 0; k < 24; k++) {
      a = t.prev[a];
      b = t.next[b];
      deepNear[a] = 1;
      deepNear[b] = 1;
    }
  }
  const fuellort = (i: number): boolean => {
    // Füllort: rund um die pendelnde Lore, wo die Schienen enden
    for (const h of t.hazards) {
      if (t.branchOf[i] >= 0) return false;
      const d = Math.abs(t.prog[i] - t.prog[h.seg]);
      if (d < 34) return true;
    }
    return false;
  };
  for (let i = 0; i < t.total; i++) {
    if (t.py[i] >= UNTER) continue;
    // (Die Wendel im Schacht hat keinen Stollen. Ein Stollen, der tangential in den Schacht mündet, beginnt dagegen schon
    // gleich neben der Wendel – so reicht seine äußere Wand bis an die Schachtwand, und seine Flächen im Schacht fallen weg.)
    if (onHelix(i)) continue;
    const b = t.branchOf[i];
    const short = b >= 0 ? t.def.branches?.[b]?.shortcut : undefined;
    let w = t.wh[i] + ((t.edge[i] & EDGE_RAIL) !== 0 ? 1.7 : 1.0);
    let h = 6.4;
    let kind = 0;
    if (short === 'risk' && t.twin[i] < 0) {
      w = t.wh[i] + 1.4;
      h = 4.4;
      kind = 1;
    } else if (deepNear[i]) {
      w = 17;
      h = 15;
      kind = 2;
    } else if (fuellort(i)) {
      w = 12;
      h = 8.5;
      kind = 3;
    }
    if (t.twin[i] >= 0) w = Math.max(w, t.wh[i] + 2.4);
    bau[i] = { seg: i, w, h, kind };
  }
  // längs glätten (je Weg)
  {
    const w0 = bau.map((q) => (q ? q.w : 0));
    const h0 = bau.map((q) => (q ? q.h : 0));
    for (let i = 0; i < t.total; i++) {
      const q = bau[i];
      if (!q) continue;
      let sw = 0;
      let sh = 0;
      let n = 0;
      let a = i;
      let b = i;
      sw += w0[i];
      sh += h0[i];
      n++;
      for (let k = 0; k < 9; k++) {
        a = t.prev[a];
        b = t.next[b];
        if (bau[a]) {
          sw += w0[a];
          sh += h0[a];
          n++;
        }
        if (bau[b]) {
          sw += w0[b];
          sh += h0[b];
          n++;
        }
      }
      // (Die niedrige Decke des Alten Manns bleibt niedrig – geglättet wird nur zu ihm hin.)
      q.w = Math.max(q.kind === 1 ? w0[i] : 0, sw / n);
      q.h = q.kind === 1 ? Math.min(h0[i], sh / n) : Math.max(sh / n, 5.6);
    }
  }

  // Räumliches Raster für die Frage „liegt dieser Punkt in einem anderen Grubenbau?“
  const CELL = 12;
  const grid = new Map<number, number[]>();
  const key = (gx: number, gz: number): number => (gx + 4096) * 8192 + (gz + 4096);
  for (let i = 0; i < t.total; i++) {
    if (!bau[i]) continue;
    const gx = Math.floor(t.px[i] / CELL);
    const gz = Math.floor(t.pz[i] / CELL);
    const k = key(gx, gz);
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(i);
  }
  /** Liegt p im Grubenbau eines anderen Abschnitts (nicht in der Nähe von seg auf demselben Weg)? */
  const inBau = (x: number, y: number, z: number, seg: number, margin = 0.35): boolean => {
    const gx = Math.floor(x / CELL);
    const gz = Math.floor(z / CELL);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const l = grid.get(key(gx + dx, gz + dz));
        if (!l) continue;
        for (const j of l) {
          if (seg >= 0 && t.branchOf[j] === t.branchOf[seg] && Math.abs(j - seg) < 8) continue;
          const q = bau[j]!;
          const ox = x - t.px[j];
          const oz = z - t.pz[j];
          const along = ox * t.tx[j] + oz * t.tz[j];
          if (Math.abs(along) > t.step * 0.8) continue;
          const lat = ox * rightX(t, j) + oz * rightZ(t, j);
          if (Math.abs(lat) > q.w - margin) continue;
          const up = y - t.py[j];
          const top = q.h * (1 - 0.32 * (lat / q.w) ** 2) - margin;
          const floor = q.kind === 1 && Math.abs(lat) > t.wh[j] ? -7 + margin : -0.5;
          if (up > floor && up < top) return true;
        }
      }
    }
    return false;
  };
  const stride = detail >= 2 ? 3 : detail === 1 ? 4 : 5;
  // (Ein Stollen endet erst ein Stück hinter der Schacht- bzw. Geodenwand: So bleibt zwischen seinem letzten Ring und der
  // Wand keine Lücke, durch die man ins Leere sähe – das Loch in der Wand ist kleiner als er.)
  const reach = stride * t.step + 1.5;
  const elsewhere = (p: V3, seg: number): boolean => inBau(p[0], p[1], p[2], seg) || inShaft(p[0], p[1], p[2], reach) || inGeode(p[0], p[1], p[2], reach);

  /** Viereck, dessen Vorderseite zum Punkt (cx, cy, cz) zeigt. */
  const quadTo = (mb: MeshBuilder, a: V3, b: V3, c: V3, d: V3, cx: number, cy: number, cz: number, col: RGB): void => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = d[0] - a[0];
    const vy = d[1] - a[1];
    const vz = d[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * (cx - a[0]) + ny * (cy - a[1]) + nz * (cz - a[2]) >= 0) mb.quad(a, b, c, d, col);
    else mb.quad(a, d, c, b, col);
  };

  /** Querschnitt (seitlich, Höhe über der Fahrbahn) von links unten über die Firste nach rechts unten. */
  const profile = (i: number, q: Bau): [number, number][] => {
    const w = q.w;
    const h = q.h;
    const e = t.wh[i] + 0.12;
    if (q.kind === 1) {
      // Alter Mann: Bohlensteg über dem Rolloch, niedrige Decke
      // (gleich viele Punkte wie ein Stollen: an der Gabelung gehen beide Querschnitte ineinander über)
      return [
        [-e, -0.15],
        [-e, -7.5],
        [-w, -7.5],
        [-w, 0.3 * h],
        [-w, 0.6 * h],
        [-0.7 * w, 0.93 * h],
        [0, h],
        [0.7 * w, 0.93 * h],
        [w, 0.6 * h],
        [w, 0.3 * h],
        [w, -7.5],
        [e, -7.5],
        [e, -0.15],
      ];
    }
    const floor = q.kind === 2 ? -0.6 : -0.3;
    return [
      [-e, floor],
      [-w, floor],
      [-w, 0.42 * h],
      [-0.93 * w, 0.68 * h],
      [-0.72 * w, 0.88 * h],
      [-0.38 * w, 0.98 * h],
      [0, h],
      [0.38 * w, 0.98 * h],
      [0.72 * w, 0.88 * h],
      [0.93 * w, 0.68 * h],
      [w, 0.42 * h],
      [w, floor],
      [e, floor],
    ];
  };
  const ring = (i: number, q: Bau): V3[] => {
    const rx = rightX(t, i);
    const rz = rightZ(t, i);
    const pts = profile(i, q);
    return pts.map(([l, u], k): V3 => {
      // Fels: Wände und Firste etwas zerklüftet (längs zusammenhängend), Sohle und Steg glatt
      const rough = k > 1 && k < pts.length - 2 && u > 0 ? 1 + 0.12 * (noise(t.px[i] * 0.18 + k * 3.7, t.pz[i] * 0.18 - k * 1.3) - 0.5) : 1;
      return [t.px[i] + rx * l * rough, t.py[i] + u * (u > 0 ? rough : 1), t.pz[i] + rz * l * rough];
    });
  };

  const rockCol = (i: number, k: number, kind: number, u: number): RGB => {
    const n = noise(t.px[i] * 0.07 + k, t.pz[i] * 0.07);
    if (u < 0 && kind !== 1) return shade(C_SOHLE, 0.9 + 0.2 * n);
    const base = kind === 3 ? mixRgb(C_KALK, C_FELS, 0.35 + 0.3 * n) : n > 0.62 ? C_FELS_2 : C_FELS;
    return shade(base, u > 4.5 ? 0.82 : 0.95 + 0.1 * n);
  };

  // Türstöcke, Lampen, Kristalle entlang der Stollen
  const holz = new MeshBuilder();
  const tuer = (i: number, q: Bau): void => {
    const rx = rightX(t, i);
    const rz = rightZ(t, i);
    const rot = Math.atan2(t.tx[i], t.tz[i]);
    const lat = q.w - 0.45;
    const cap = q.kind === 1 ? 3.9 : Math.min(q.h * 0.8, 5.2);
    if (cap < (q.kind === 1 ? 3.8 : 4.4)) return;
    const y0 = t.py[i] + (q.kind === 1 ? -7.4 : -0.3);
    for (const sg of [-1, 1]) {
      const x = t.px[i] + rx * lat * sg;
      const z = t.pz[i] + rz * lat * sg;
      holz.box(x, (y0 + t.py[i] + cap) / 2, z, 0.34, t.py[i] + cap - y0, 0.34, C_HOLZ, rot);
    }
    // Kappe quer über die Strecke
    holz.box(t.px[i], t.py[i] + cap + 0.18, t.pz[i], 0.36, 0.36, 2 * lat + 0.5, C_HOLZ_D, rot + Math.PI / 2);
  };
  const lampe = (i: number, q: Bau, side: number): void => {
    const rx = rightX(t, i);
    const rz = rightZ(t, i);
    const cap = q.kind === 1 ? 3.9 : Math.min(q.h * 0.8, 5.2);
    // (Im niedrigen Alten Mann hängt die Lampe am Stempel neben dem Steg, nicht an der Kappe über ihm.)
    const lat = side * (q.kind === 1 ? q.w - 0.75 : q.w * 0.55);
    const p: V3 = [t.px[i] + rx * lat, t.py[i] + (q.kind === 1 ? 2.6 : cap - 0.15), t.pz[i] + rz * lat];
    glow.box(p[0], p[1], p[2], 0.34, 0.42, 0.34, LAMPE);
    holz.box(p[0], p[1] + 0.32, p[2], 0.42, 0.14, 0.42, C_STAHL_D);
  };
  const octa = new THREE.OctahedronGeometry(1, 0);
  disposables.push(octa);
  const m4 = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  const ev = new THREE.Euler();
  const vv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  /** Ein Kristall: Spitze in Richtung (dx, dy, dz), Länge len, Dicke thick. */
  const kristall = (x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, thick: number, col: RGB): void => {
    const dir = vv.set(dx, dy, dz).normalize();
    qq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m4.compose(new THREE.Vector3(x + dir.x * len * 0.5, y + dir.y * len * 0.5, z + dir.z * len * 0.5), qq, sv.set(thick, len * 0.5, thick));
    glow.add(octa, col, m4);
    void ev;
  };
  /** Kristallgruppe an der Wand: um (x, y, z), nach (nx, ny, nz) gerichtet. */
  const gruppe = (x: number, y: number, z: number, nx: number, ny: number, nz: number, size: number, col: RGB, n = 4): void => {
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU;
      const sp = 0.55;
      const len = size * (0.55 + rnd() * 0.75);
      kristall(
        x + (rnd() - 0.5) * size * 0.6,
        y + (rnd() - 0.5) * size * 0.4,
        z + (rnd() - 0.5) * size * 0.6,
        nx + Math.cos(a) * sp,
        ny + 0.45 + Math.sin(a) * sp * 0.5,
        nz + Math.sin(a) * sp,
        len,
        len * (0.16 + rnd() * 0.08),
        k === 0 ? shade(col, 1.15) : col,
      );
    }
  };

  // Ringe je Weg erzeugen und verbinden
  const paths: number[][] = [];
  {
    const main: number[] = [];
    for (let i = 0; i < t.n; i++) main.push(i);
    paths.push(main);
    for (const b of t.branches) {
      const l: number[] = [];
      for (let k = 0; k < b.count; k++) l.push(b.first + k);
      paths.push(l);
    }
  }
  let tuerAt = 0;
  for (const path of paths) {
    let prev: { i: number; pts: V3[]; q: Bau } | null = null;
    let sinceLast = 0;
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      const q = bau[i];
      if (!q) {
        prev = null;
        continue;
      }
      const nextHas = k + 1 < path.length && bau[path[k + 1]] !== null;
      sinceLast++;
      if (prev && sinceLast < stride && nextHas) continue;
      sinceLast = 0;
      const pts = ring(i, q);
      if (prev) {
        const cx = (t.px[i] + t.px[prev.i]) / 2;
        const cz = (t.pz[i] + t.pz[prev.i]) / 2;
        const cy = (t.py[i] + t.py[prev.i]) / 2 + Math.min(q.h, prev.q.h) * 0.45;
        const prof = profile(i, q);
        for (let m = 0; m + 1 < pts.length; m++) {
          const a = prev.pts[m];
          const b = prev.pts[m + 1];
          const c = pts[m + 1];
          const d = pts[m];
          const mid: V3 = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4];
          if (elsewhere(mid, i)) continue;
          quadTo(fels, a, b, c, d, cx, cy, cz, rockCol(i, m, q.kind, prof[m][1]));
        }
      }
      prev = { i, pts, q };
      // Ausbau und Kristalle
      if (q.kind === 0 || q.kind === 1) {
        tuerAt++;
        const every = detail >= 2 ? 2 : 4;
        const p0: V3 = [t.px[i], t.py[i] + 2, t.pz[i]];
        if (tuerAt % every === 0 && !elsewhere(p0, i)) {
          tuer(i, q);
          if (tuerAt % (every * 2) === 0) lampe(i, q, (tuerAt / every) % 4 === 0 ? 1 : -1);
        }
      }
      const kEvery = q.kind === 2 ? 2 : detail >= 2 ? 3 : 5;
      if ((i + 1) % kEvery === 0 && rnd() < 0.75) {
        const sg = rnd() < 0.5 ? -1 : 1;
        const rx = rightX(t, i) * sg;
        const rz = rightZ(t, i) * sg;
        const lat = q.w * 0.97;
        const up = q.kind === 2 ? 1 + rnd() * 9 : 0.6 + rnd() * q.h * 0.6;
        const x = t.px[i] + rx * lat;
        const z = t.pz[i] + rz * lat;
        const y = t.py[i] + up;
        if (!inBau(x, y, z, i, 0.9) && !inGeode(x, y, z, -1) && !inShaft(x, y, z, -1)) {
          const col = q.kind === 2 ? KRISTALL[rnd() < 0.6 ? 1 : 3] : q.kind === 3 ? KRISTALL[4] : KRISTALL[rnd() < 0.55 ? 0 : rnd() < 0.5 ? 1 : 2];
          gruppe(x, y, z, -rx, 0, -rz, q.kind === 2 ? 1.6 + rnd() * 1.6 : 0.9 + rnd() * 0.6, col, q.kind === 2 ? 5 : 3);
        }
      }
    }
  }

  const walkBack = (i: number, k: number): number => {
    let g = i;
    for (let m = 0; m < k; m++) g = t.prev[g];
    return g;
  };
  // --- Grubensee: das Wasser zwischen den Wänden der Kaverne ---------------------------
  {
    let prev: { i: number; l: V3; r: V3 } | null = null;
    for (let i = 0; i < t.n; i++) {
      const q = bau[i];
      // (Nur über der Tauchstrecke und knapp davor und dahinter – nicht über der Fahrbahn zur Geode.)
      let nearDive = false;
      for (let k = -8, g = i; k <= 8 && !nearDive; k++) {
        g = k === -8 ? walkBack(i, 8) : t.next[g];
        if (t.deep[g]) nearDive = true;
      }
      if (!q || q.kind !== 2 || !nearDive || i % 2 !== 0) {
        if (!q || q.kind !== 2) prev = null;
        continue;
      }
      const w = q.w - 0.2;
      const l: V3 = [t.px[i] - rightX(t, i) * w, t.sea, t.pz[i] - rightZ(t, i) * w];
      const r: V3 = [t.px[i] + rightX(t, i) * w, t.sea, t.pz[i] + rightZ(t, i) * w];
      if (prev) {
        const n = noise(t.px[i] * 0.1, t.pz[i] * 0.1);
        wasser.quad(prev.l, l, r, prev.r, n > 0.6 ? C_WASSER_H : C_WASSER);
      }
      prev = { i, l, r };
    }
  }

  // --- Riesengeode: Fels-Zylinder mit Kuppel und Mulde, innen Kristalle; die Kristallkugel ---
  {
    const N = detail >= 2 ? 40 : 28;
    const rows: { y: number; r: number }[] = [];
    const DR = 4;
    for (let k = 0; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      rows.push({ y: geoY0 - BOWL * Math.cos(a), r: (geodeR + 0.2) * Math.sin(a) + 0.01 });
    }
    for (let y = geoY0 + DR; y < geoY1 - 0.5; y += DR) rows.push({ y, r: geodeR + 0.2 });
    for (let k = 0; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      rows.push({ y: geoY1 + DOME * Math.sin(a), r: (geodeR + 0.2) * Math.cos(a) + 0.01 });
    }
    const P = (row: { y: number; r: number }, k: number): V3 => {
      const a = (k / N) * TAU;
      const n = 1 + 0.06 * (noise(Math.cos(a) * 3 + row.y * 0.1, Math.sin(a) * 3) - 0.5);
      return [GEODE.x + Math.cos(a) * row.r * n, row.y, GEODE.z + Math.sin(a) * row.r * n];
    };
    const cy = (geoY0 + geoY1) / 2;
    for (let j = 0; j + 1 < rows.length; j++) {
      for (let k = 0; k < N; k++) {
        const a = P(rows[j], k);
        const b = P(rows[j], k + 1);
        const c = P(rows[j + 1], k + 1);
        const d = P(rows[j + 1], k);
        const mid: V3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
        if (inBau(mid[0], mid[1], mid[2], -1, 0.6)) continue;
        // innen: violetter Fels, zur Mitte hin heller (Amethyst)
        const col = (j + k) % 5 === 0 ? rgb(0x4a2f66) : (j + k) % 3 === 0 ? rgb(0x3a2850) : rgb(0x30243f);
        quadTo(fels, a, b, c, d, GEODE.x, cy, GEODE.z, col);
      }
    }
    // Kristalle: an Kuppel und Mulde lang, an der Wand (hinter dem Band) kurz
    const nk = detail >= 2 ? 70 : 36;
    for (let k = 0; k < nk; k++) {
      const a = rnd() * TAU;
      const top = rnd() < 0.5;
      const f = 0.35 + rnd() * 0.6;
      const r = geodeR * f;
      const y = top ? geoY1 + DOME * Math.sqrt(Math.max(0, 1 - f * f)) - 0.3 : geoY0 - BOWL * Math.sqrt(Math.max(0, 1 - f * f)) + 0.3;
      const x = GEODE.x + Math.cos(a) * r;
      const z = GEODE.z + Math.sin(a) * r;
      if (inBau(x, y, z, -1, -1)) continue;
      const col = KRISTALL[rnd() < 0.6 ? 0 : rnd() < 0.5 ? 2 : 1];
      gruppe(x, y, z, -Math.cos(a) * 0.5, top ? -1 : 1, -Math.sin(a) * 0.5, 2.2 + rnd() * 2.4, col, 3);
    }
    for (let k = 0; k < (detail >= 2 ? 40 : 20); k++) {
      const a = rnd() * TAU;
      const y = geoY0 + rnd() * (geoY1 - geoY0);
      const x = GEODE.x + Math.cos(a) * (geodeR - 0.2);
      const z = GEODE.z + Math.sin(a) * (geodeR - 0.2);
      if (inBau(x, y, z, -1, -1)) continue;
      gruppe(x, y, z, -Math.cos(a), 0, -Math.sin(a), 0.8 + rnd() * 0.6, KRISTALL[rnd() < 0.7 ? 0 : 2], 3);
    }
    // Wo die Straße frei durch die Geode führt (der Ausgang über den Eingang hinweg), steht sie auf Pfeilern in der Mulde.
    // (Unter dem Band stehen die Stützen von mechanics/band.ts.)
    for (let i = 0; i < t.n; i += 6) {
      if ((t.edge[i] & EDGE_BAND) !== 0 || t.deep[i] || !inGeode(t.px[i], t.py[i] + 1, t.pz[i], 0.5)) continue;
      const d = Math.hypot(t.px[i] - GEODE.x, t.pz[i] - GEODE.z);
      const foot = geoY0 - BOWL * Math.sqrt(Math.max(0, 1 - (d / geodeR) ** 2)) - 0.5;
      const top = t.py[i] - 1.2;
      // (Nicht durch eine andere Fahrbahn hindurch: unter dem Ausgang liegt der Eingang.)
      let free = true;
      for (let k = 0; k < t.n && free; k += 2) if (t.py[k] < top - 2 && t.py[k] > foot && Math.hypot(t.px[k] - t.px[i], t.pz[k] - t.pz[i]) < t.wh[k] + 1.5) free = false;
      if (!free || top - foot < 1) continue;
      for (const sg of [-1, 1]) {
        const lat = sg * (t.wh[i] - 0.5);
        fels.box(t.px[i] + rightX(t, i) * lat, (top + foot) / 2, t.pz[i] + rightZ(t, i) * lat, 0.9, top - foot, 0.9, C_FELS_D, Math.atan2(t.tx[i], t.tz[i]));
      }
    }
    // Felspfeiler aus der Mulde und darauf die Kristallkugel
    const ky = cy + 1;
    const pillar = new THREE.CylinderGeometry(2.2, 4.5, ky - (geoY0 - BOWL) - 4, 9, 1);
    m4.compose(new THREE.Vector3(GEODE.x, (ky - 4 + geoY0 - BOWL) / 2, GEODE.z), qq.identity(), sv.set(1, 1, 1));
    fels.add(pillar, C_FELS_D, m4);
    pillar.dispose();
    const ball = new THREE.IcosahedronGeometry(5.2, 1);
    m4.compose(new THREE.Vector3(GEODE.x, ky, GEODE.z), qq.setFromEuler(ev.set(0.3, 0.5, 0.1)), sv.set(1, 1, 1));
    glow.add(ball, rgb(0xd88cff), m4);
    ball.dispose();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      kristall(GEODE.x + Math.cos(a) * 3.2, ky - 2 + (k % 3), GEODE.z + Math.sin(a) * 3.2, Math.cos(a), 0.6 + (k % 4) * 0.25, Math.sin(a), 4 + (k % 3) * 1.5, 0.8, KRISTALL[k % 2 === 0 ? 0 : 2]);
    }
  }

  // --- Schächte: gemauerte Wand bis zur Sohle, Schachtkranz über dem Trichter ------------
  for (const s of shafts) {
    // (Fein unterteilt: Wo ein Stollen aus dem Schacht führt, fällt jede Fläche weg, deren Mitte in ihm liegt.)
    const N = detail >= 2 ? 48 : 36;
    const top = 0.5;
    const ys: number[] = [];
    for (let y = s.floor; y < top - 0.01; y += 2.5) ys.push(y);
    ys.push(top);
    for (let j = 0; j + 1 < ys.length; j++) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * TAU;
        const a1 = ((k + 1) / N) * TAU;
        const P = (a: number, y: number): V3 => [s.x + Math.cos(a) * s.r, y, s.z + Math.sin(a) * s.r];
        const a = P(a0, ys[j]);
        const b = P(a1, ys[j]);
        const c = P(a1, ys[j + 1]);
        const d = P(a0, ys[j + 1]);
        const mid: V3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
        if (inBau(mid[0], mid[1], mid[2], -1, 0.5)) continue;
        quadTo(fels, a, b, c, d, s.x, ys[j], s.z, ((j >> 1) + (k >> 1)) % 2 === 0 ? C_ZIEGEL : C_ZIEGEL_D);
      }
    }
    // Sohle
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * TAU;
      const a1 = ((k + 1) / N) * TAU;
      fels.tri([s.x, s.floor, s.z], [s.x + Math.cos(a1) * s.r, s.floor, s.z + Math.sin(a1) * s.r], [s.x + Math.cos(a0) * s.r, s.floor, s.z + Math.sin(a0) * s.r], C_FELS_D);
    }
    // Schachtkranz: ebener Ring über dem Trichter
    const R1 = s.r + s.funnel + 3;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * TAU;
      const a1 = ((k + 1) / N) * TAU;
      const P = (a: number, r: number): V3 => [s.x + Math.cos(a) * r, 0.42, s.z + Math.sin(a) * r];
      fels.quad(P(a1, s.r), P(a0, s.r), P(a0, R1), P(a1, R1), k % 2 === 0 ? C_BETON : shade(C_BETON, 0.9));
    }
    // Brüstung auf dem Rand (nicht dort, wo eine Fahrbahn über den Rand führt)
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * TAU;
      const a1 = ((k + 1) / N) * TAU;
      const am = (a0 + a1) / 2;
      const mx = s.x + Math.cos(am) * s.r;
      const mz = s.z + Math.sin(am) * s.r;
      let road = false;
      for (let i = 0; i < t.total && !road; i += 2) if (t.py[i] > -2 && t.py[i] < 4 && Math.hypot(t.px[i] - mx, t.pz[i] - mz) < t.wh[i] + 4) road = true;
      if (road) continue;
      const P = (a: number, r: number, y: number): V3 => [s.x + Math.cos(a) * r, y, s.z + Math.sin(a) * r];
      // (Mannshoch: Wer oben in der Wendel fährt, sieht über ihr nicht den Schachtkranz, sondern den Himmel.)
      const top = 3.2;
      quadTo(fels, P(a0, s.r, 0.4), P(a1, s.r, 0.4), P(a1, s.r, top), P(a0, s.r, top), s.x, 1, s.z, C_ZIEGEL_D);
      quadTo(fels, P(a0, s.r + 0.6, 0.4), P(a1, s.r + 0.6, 0.4), P(a1, s.r + 0.6, top), P(a0, s.r + 0.6, top), s.x + Math.cos(am) * 99, 1, s.z + Math.sin(am) * 99, C_ZIEGEL);
      fels.quad(P(a1, s.r, top), P(a0, s.r, top), P(a0, s.r + 0.6, top), P(a1, s.r + 0.6, top), C_BETON);
    }
    // Lampen rings um die Schachtwand (in drei Höhen)
    for (let y = -8; y > s.floor + 3; y -= 12) {
      for (let k = 0; k < 8; k++) {
        const a = ((k + 0.5) / 8) * TAU + y * 0.1;
        const x = s.x + Math.cos(a) * (s.r - 0.3);
        const z = s.z + Math.sin(a) * (s.r - 0.3);
        if (inBau(x, y, z, -1, -1)) continue;
        glow.box(x, y, z, 0.5, 0.5, 0.5, LAMPE);
      }
    }
  }

  // --- Über Tage ------------------------------------------------------------------
  const bauten = new MeshBuilder();
  /** Gerader Balken von p nach q (quadratischer Querschnitt). */
  const balken = (mb: MeshBuilder, p: V3, q: V3, d: number, col: RGB): void => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const dz = q[2] - p[2];
    const len = Math.hypot(dx, dy, dz);
    const geo = new THREE.BoxGeometry(d, len, d);
    qq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vv.set(dx / len, dy / len, dz / len));
    m4.compose(new THREE.Vector3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2), qq, sv.set(1, 1, 1));
    mb.add(geo, col, m4);
    geo.dispose();
  };
  /** Haus mit Satteldach und Fensterreihen (Fenster leuchten). */
  const haus = (x: number, z: number, w: number, d: number, h: number, rot: number, col: RGB, floors: number): void => {
    const y = world.heightAt(x, z) - 0.5;
    bauten.box(x, y + h / 2, z, w, h, d, col, rot, C_DACH);
    // Satteldach
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const P = (lx: number, ly: number, lz: number): V3 => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const hw = w / 2 + 0.4;
    const hd = d / 2 + 0.4;
    const ridge = h + d * 0.28;
    bauten.quad(P(-hw, h, -hd), P(hw, h, -hd), P(hw, ridge, 0), P(-hw, ridge, 0), C_DACH);
    bauten.quad(P(hw, h, hd), P(-hw, h, hd), P(-hw, ridge, 0), P(hw, ridge, 0), C_DACH);
    bauten.tri(P(-w / 2, h, hd - 0.4), P(-w / 2, ridge, 0), P(-w / 2, h, -hd + 0.4), col);
    bauten.tri(P(w / 2, h, -hd + 0.4), P(w / 2, ridge, 0), P(w / 2, h, hd - 0.4), col);
    // Fenster an den Längsseiten
    const cols = Math.max(2, Math.floor(w / 3.2));
    for (const side of [-1, 1]) {
      for (let f = 0; f < floors; f++) {
        for (let k = 0; k < cols; k++) {
          const lx = -w / 2 + (k + 0.5) * (w / cols);
          const ly = 2 + f * ((h - 2.5) / Math.max(1, floors));
          const lit = rnd() < 0.62;
          const p = P(lx, ly, side * (d / 2 + 0.04));
          glow.box(p[0], p[1], p[2], 1.1 * Math.abs(c) + 0.08 * Math.abs(s), 1.6, 1.1 * Math.abs(s) + 0.08 * Math.abs(c), lit ? FENSTER : FENSTER_D);
        }
      }
    }
  };

  // Förderturm über dem Hauptschacht: vier Stiele zum Seilscheibenboden, Streben zum Maschinenhaus
  const seilY = 44;
  const sx = SCHACHT.x;
  const sz = SCHACHT.z;
  {
    const top: V3[] = [
      [sx - 5, seilY - 2, sz - 4],
      [sx + 5, seilY - 2, sz - 4],
      [sx + 5, seilY - 2, sz + 4],
      [sx - 5, seilY - 2, sz + 4],
    ];
    // (Die nördlichen Stiele stehen weit draußen: Sie kreuzen die Brücke der Lorenbahn hoch über ihr.)
    const foot: V3[] = [
      [sx - 12, 0.4, sz - 34],
      [sx + 12, 0.4, sz - 34],
      [sx + 12, 0.4, sz + 27],
      [sx - 12, 0.4, sz + 27],
    ];
    for (let k = 0; k < 4; k++) {
      balken(bauten, foot[k], top[k], 1.1, C_STAHL);
      // Verband: Riegel und Kreuze in drei Stockwerken
      const n = (k + 1) % 4;
      for (let f = 1; f <= 3; f++) {
        const u = f / 4;
        const L = (p: V3, q: V3, v: number): V3 => [p[0] + (q[0] - p[0]) * v, p[1] + (q[1] - p[1]) * v, p[2] + (q[2] - p[2]) * v];
        // (Riegel nur über der Hängebank: die Lorenbahn fährt unter ihnen hindurch.)
        if (L(foot[k], top[k], u)[1] > 18) balken(bauten, L(foot[k], top[k], u), L(foot[n], top[n], u), 0.45, C_STAHL_D);
      }
    }
    // Seilscheibenboden mit Geländer
    bauten.box(sx, seilY - 1.4, sz, 13, 0.8, 11, C_STAHL_D);
    bauten.box(sx, seilY + 2.6, sz - 5.2, 13, 0.25, 0.25, C_ROT);
    bauten.box(sx, seilY + 2.6, sz + 5.2, 13, 0.25, 0.25, C_ROT);
    // Lager der Seilscheiben
    for (const dx of [-3.2, 3.2]) bauten.box(sx + dx, seilY + 0.4, sz, 0.9, 3.6, 1.2, C_STAHL);
    // Streben nach Norden zum Maschinenhaus
    balken(bauten, [sx - 4, seilY - 1, sz - 4], [sx - 6, 0.4, sz - 64], 1.0, C_STAHL);
    balken(bauten, [sx + 4, seilY - 1, sz - 4], [sx + 6, 0.4, sz - 64], 1.0, C_STAHL);
    // Warnlicht oben
    glow.box(sx, seilY + 3.4, sz, 0.7, 0.7, 0.7, rgb(0xff3a2a));
    // Fördermaschinenhaus und die Seile hinüber
    haus(sx, sz - 82, 26, 16, 15, 0, C_ZIEGEL, 2);
    for (const dx of [-2.4, 2.4]) balken(bauten, [sx + dx, seilY + 1.5, sz + 1.6], [sx + dx * 0.6, 12, sz - 74], 0.12, rgb(0x1a1a20));
  }
  // Seilscheiben (drehen sich): zwei Räder auf einer Achse
  const scheiben = new MeshBuilder();
  {
    const R = 3.3;
    const N = 14;
    for (const dx of [-2.1, 2.1]) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * TAU;
        const a1 = ((k + 1) / N) * TAU;
        balken(scheiben, [dx, Math.cos(a0) * R, Math.sin(a0) * R], [dx, Math.cos(a1) * R, Math.sin(a1) * R], 0.32, k % 2 === 0 ? C_ROT : shade(C_ROT, 0.8));
      }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI;
        balken(scheiben, [dx, Math.cos(a) * R, Math.sin(a) * R], [dx, -Math.cos(a) * R, -Math.sin(a) * R], 0.16, C_STAHL_D);
      }
    }
    balken(scheiben, [-2.6, 0, 0], [2.6, 0, 0], 0.3, C_STAHL_D);
  }
  const scheibenMesh = new THREE.Mesh(scheiben.build(), toon);
  scheibenMesh.position.set(sx, seilY + 1.5, sz);
  scheibenMesh.name = 'Seilscheiben';
  group.add(scheibenMesh);
  disposables.push(scheibenMesh.geometry);

  // Förderkorb: fährt im Hauptschacht auf und ab; das Seil hängt von der Seilscheibe herab
  const korb = new MeshBuilder();
  {
    korb.box(0, 2.2, 0, 3.4, 4.4, 2.6, C_STAHL, 0, C_STAHL_D);
    korb.box(0, 4.6, 0, 3.8, 0.35, 3.0, C_ROT);
    korb.box(0, 0.05, 0, 3.8, 0.3, 3.0, C_ROT);
    for (const sg of [-1, 1]) korb.box(0, 2.3, sg * 1.32, 2.8, 2.6, 0.05, rgb(0x1c1a22));
    korb.box(0, 2.6, 1.36, 0.6, 0.6, 0.06, LAMPE);
  }
  const korbMesh = new THREE.Mesh(korb.build(), toon);
  korbMesh.name = 'Förderkorb';
  const seil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), toon);
  disposables.push(korbMesh.geometry, seil.geometry);
  const korbGroup = new THREE.Group();
  korbGroup.add(korbMesh);
  group.add(korbGroup);
  // Das Seil hängt senkrecht vom Kranz der einen Seilscheibe herab; der Korb hängt darunter.
  korbMesh.add(seil);

  // Wetterschacht: ein leichteres Gerüst mit Lüfterhaus daneben
  {
    const wx = WETTERSCHACHT.x;
    const wz = WETTERSCHACHT.z;
    const wr = WETTERSCHACHT.wall + 6;
    const topY = 26;
    const tops: V3[] = [];
    for (let k = 0; k < 4; k++) {
      // (Die Stiele stehen in den Himmelsrichtungen: Die Straße verlässt den Schacht nach Nordosten zwischen zweien hindurch.)
      const a = (k / 4) * TAU;
      const foot: V3 = [wx + Math.cos(a) * wr, 0.4, wz + Math.sin(a) * wr];
      const tp: V3 = [wx + Math.cos(a) * 5, topY, wz + Math.sin(a) * 5];
      tops.push(tp);
      balken(bauten, foot, tp, 0.9, C_STAHL);
    }
    for (let k = 0; k < 4; k++) balken(bauten, tops[k], tops[(k + 1) % 4], 0.5, C_STAHL_D);
    bauten.box(wx, topY + 0.6, wz, 9, 0.9, 9, C_STAHL_D);
    glow.box(wx, topY + 1.6, wz, 0.6, 0.6, 0.6, rgb(0xff3a2a));
    haus(wx - 52, wz - 4, 16, 12, 9, Math.PI / 2, C_ZIEGEL_D, 1);
  }

  // Zechengebäude, Schornstein, Halde, Laternen
  haus(-62, -82, 44, 18, 15, 0, C_ZIEGEL, 2);
  haus(-118, -84, 30, 16, 12, 0, C_ZIEGEL_D, 2);
  haus(-16, -84, 22, 14, 11, 0.08, C_ZIEGEL, 1);
  haus(-70, 4, 34, 16, 10, 0, C_ZIEGEL_D, 1);
  {
    // Schornstein
    const geo = new THREE.CylinderGeometry(2.2, 3.4, 56, 10, 1);
    m4.compose(new THREE.Vector3(-30, 28, -108), qq.identity(), sv.set(1, 1, 1));
    bauten.add(geo, C_ZIEGEL_D, m4);
    geo.dispose();
    for (let k = 0; k < 3; k++) bauten.box(-30, 40 + k * 5, -108, 5.0 - k * 0.2, 0.5, 5.0 - k * 0.2, C_ROT);
    glow.box(-30, 56.6, -108, 0.7, 0.7, 0.7, rgb(0xff3a2a));
  }
  {
    // Halde: flacher Kegel mit Terrassen
    const hx = -150;
    const hz = -170;
    const N = detail >= 2 ? 24 : 16;
    const levels = [
      [64, 0],
      [48, 11],
      [40, 13],
      [26, 24],
      [18, 26],
      [6, 32],
    ];
    for (let j = 0; j + 1 < levels.length; j++) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * TAU;
        const a1 = ((k + 1) / N) * TAU;
        const P = (a: number, r: number, y: number): V3 => [hx + Math.cos(a) * r, y - 0.5, hz + Math.sin(a) * r * 0.8];
        const [r0, y0] = levels[j];
        const [r1, y1] = levels[j + 1];
        bauten.quad(P(a1, r0, y0), P(a0, r0, y0), P(a0, r1, y1), P(a1, r1, y1), (j + k) % 2 === 0 ? C_HALDE : C_HALDE_2);
      }
    }
  }
  {
    // Laternen am Zechenplatz und an der Rampe
    const pole = rgb(0x23202a);
    for (let i = 0; i < t.n; i += 22) {
      if (t.py[i] < 0 || (t.edge[i] & EDGE_RAIL) !== 0 || t.py[i] > 3 || t.twin[i] >= 0) continue;
      for (const sg of [-1, 1]) {
        if ((t.edge[i] & (sg < 0 ? EDGE_OPEN_L : EDGE_OPEN_R)) !== 0) continue;
        const lat = sg * (t.wh[i] + 1.6);
        const x = t.px[i] + rightX(t, i) * lat;
        const z = t.pz[i] + rightZ(t, i) * lat;
        if (world.clearance(x, z) < 0.8) continue;
        const y = Math.max(world.heightAt(x, z), t.py[i] - 0.4);
        bauten.box(x, y + 3.5, z, 0.22, 7, 0.22, pole);
        const hx = x - rightX(t, i) * sg * 1.1;
        const hz = z - rightZ(t, i) * sg * 1.1;
        bauten.box((x + hx) / 2, y + 7, (z + hz) / 2, 0.16, 0.16, 1.2, pole, Math.atan2(rightX(t, i), rightZ(t, i)));
        glow.box(hx, y + 6.75, hz, 0.55, 0.3, 0.55, LAMPE);
      }
    }
  }

  // --- Netze ---------------------------------------------------------------------
  const rock = new THREE.Mesh(mergeBuilders([fels, holz, bauten]), toon);
  rock.name = 'Grube und Zeche';
  group.add(rock);
  const lights = new THREE.Mesh(glow.build(), glowMat);
  lights.name = 'Kristalle und Lampen';
  group.add(lights);
  disposables.push(rock.geometry, lights.geometry);
  if (!wasser.empty) {
    const water = new THREE.Mesh(wasser.build(), waterMat);
    water.name = 'Grubensee';
    water.renderOrder = 2;
    group.add(water);
    disposables.push(water.geometry);
  }

  const korbTop = 7.5;
  const korbBottom = SCHACHT.floor + 3;
  return {
    group,
    update(time: number): void {
      // Der Förderkorb fährt: 9 s hinauf, 4 s oben, 9 s hinab, 4 s unten – die Seilscheiben drehen mit.
      const P = 26;
      const c = ((time % P) + P) % P;
      let u: number;
      if (c < 9) u = smooth(c / 9);
      else if (c < 13) u = 1;
      else if (c < 22) u = 1 - smooth((c - 13) / 9);
      else u = 0;
      const y = korbBottom + (korbTop - korbBottom) * u;
      korbGroup.position.set(sx + 2.1, y, sz + 3.3);
      const len = seilY + 1.5 - (y + 4.6);
      seil.scale.set(1, Math.max(0.1, len), 1);
      seil.position.set(0, 4.6 + len / 2, 0);
      scheibenMesh.rotation.x = -((y - korbBottom) / 3.3);
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Mehrere Bausätze zu einem Netz. */
function mergeBuilders(list: MeshBuilder[]): THREE.BufferGeometry {
  const all = new MeshBuilder();
  const tmp = list.map((b) => b.build());
  for (const g of tmp) {
    const p = g.getAttribute('position');
    const c = g.getAttribute('color');
    for (let i = 0; i + 2 < p.count; i += 3) {
      all.tri([p.getX(i), p.getY(i), p.getZ(i)], [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)], [c.getX(i), c.getY(i), c.getZ(i)]);
    }
    g.dispose();
  }
  return all.build();
}
