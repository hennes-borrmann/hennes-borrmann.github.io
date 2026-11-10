// Werkshof: Förderbänder und Stampfpressen.
//
// Förderbänder: flach auf der Fahrbahn liegende Gummibahnen mit großen
// Winkelpfeilen, die genau mit dem Tempo des Bands wandern (Meter pro Sekunde
// wie in der Physik). Farbe sagt die Richtung: Türkis = schiebt voran, Rot =
// kommt einem entgegen, Gelb = schiebt zur Seite. Am Rand flache Schienen, an
// den Enden Umlenkrolle und gelb-schwarzes Kammblech.
//
// Stampfpressen: je Reihe ein Portal über der Bahn, daran je Presse ein Stempel
// an zwei Hydraulikkolben. Ort, Größe und Takt kommen aus der Physik
// (Pulse): die Stempelplatte deckt genau das Quadrat 2·radius um (x, z), sie
// liegt genau während der on-Ticks unten. Davor blinkt die Lampe rot, der
// Stempel senkt sich an und ein dunkler Schatten erscheint am Boden.
//
// Zeichenaufrufe: Bänder samt Bodenteilen 1, Portale 1 (+1 Kontur), Stempel 1
// (+1), Kolben 1 (+1), Lampen 1, Schatten 1 – höchstens 9.

import * as THREE from 'three';
import { PULSE_PRESS, pulseCycle, pulseWarning, type Belt, type Pulse } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, smooth, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial, withOutline } from '../toon';
import { boxT, cylT, face, stripedFace, type Xform } from './machineKit';

// --- Farben ---------------------------------------------------------------------

const C_FWD = rgb(0x1fe0c2); // schiebt voran
const C_BACK = rgb(0xff4026); // kommt entgegen
const C_SIDE = rgb(0xffc21c); // schiebt quer
const C_YEL = rgb(0xffc72e);
const C_INK = rgb(0x24212b);
const C_STEEL = rgb(0x3d3a46);
const C_STEEL_HI = rgb(0xa9a5b4);
const C_ROLL = rgb(0x6c6976);
const C_BLUE = rgb(0x3d64a3);
const C_BLUE_D = rgb(0x2a4675);
const C_CONCRETE = rgb(0x9a958f);
const C_CHROME = rgb(0xdcdbe6);

// --- Maße -----------------------------------------------------------------------

/** Länge einer Kachel des Bandmusters in Laufrichtung (Meter): Längsbänder, Querbänder. */
const TILE = 4.0;
const TILE_X = 4.2;
/**
 * Querbänder: so lang (längs der Strecke) wird ein Pfeil höchstens – lange
 * Pfeile, damit sie im flachen Blick von weit hinten noch als Pfeil lesbar sind.
 */
const ROW_ACROSS = 9;
// Über der Fahrbahnfarbe (Linien liegen 3 cm, Randsteine 5 cm hoch).
const BELT_Y = 0.04;
const RAIL_W = 0.13;
const RAIL_Y = 0.075;

/** Höhe des Portals: Unterkante und Oberkante des Querträgers über der Fahrbahn. */
const BEAM_LO = 6.5;
const BEAM_HI = 7.8;
const BEAM_DEPTH = 1.1;
/** Hydraulikzylinder unter dem Träger: Länge und seitlicher Abstand von der Mitte des Stempels. */
const CYL_LEN = 1.15;
const CYL_OFF = 0.95;
/** Stempel: Bauhöhe, Unterkante in Ruhe und wie weit er sich bei der Warnung ansenkt. */
const RAM_H = 1.4;
const REST = BEAM_LO - CYL_LEN - RAM_H - 0.12;
const DIP = 0.75;
/** Schlag: so viele Ticks vor und nach Zyklus 0 fällt er (zusammen gut 3 Ticks). */
const STRIKE = 1.6;
/** Hochfahren nach der Gefahr (Ticks). */
const RISE = 75;

// --- Musterstruktur der Bänder ----------------------------------------------------

/** Kachel des Bandes: dunkle Gummibahn mit Lamellen und einem großen Winkelpfeil (Spitze nach +v). */
function beltTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(58,58,58)';
  g.fillRect(0, 0, S, S);
  // Lamellen: Fugen mit Lichtkante
  for (let k = 0; k < 4; k++) {
    const y = k * 32;
    g.fillStyle = 'rgb(22,22,22)';
    g.fillRect(0, y, S, 5);
    g.fillStyle = 'rgb(92,92,92)';
    g.fillRect(0, y + 5, S, 2);
  }
  // Winkelpfeil mit Tuschekante; Spitze oben (Canvas oben = v groß)
  // steil, damit er auch im flachen Blick (stark verkürzt) noch als Spitze zu lesen ist
  const t = 32;
  g.beginPath();
  g.moveTo(64, 4);
  g.lineTo(120, 90);
  g.lineTo(120, 90 + t);
  g.lineTo(64, 4 + t);
  g.lineTo(8, 90 + t);
  g.lineTo(8, 90);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 5;
  g.lineJoin = 'miter';
  g.strokeStyle = 'rgb(16,14,20)';
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Material der Bänder und der flachen Bodenteile in einem Zeichenaufruf. Die
 * Nummer des Bands steckt im ganzzahligen Teil von u (u + 1000·(Nummer + 1);
 * die Wiederholung der Textur ignoriert ihn), u = 0 heißt "ohne Textur".
 * uOff[k] verschiebt das Muster von Band k in Laufrichtung.
 */
function beltMaterial(tex: THREE.Texture, n: number): { mat: THREE.MeshBasicMaterial; off: Float32Array } {
  const off = new Float32Array(Math.max(1, n));
  // Etwas stärker nach vorn gezogen als die Fahrbahnfarbe (world.ts: −2/−4), sonst scheinen deren Linien durch.
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, map: tex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const N = Math.max(1, n);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uOff = { value: off };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uOff[${N}];\nvarying float vTexOn;`)
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        {
          float bi = floor(uv.x / 1000.0 + 0.0001);
          vTexOn = bi > 0.5 ? 1.0 : 0.0;
          int k = int(bi) - 1;
          float o = 0.0;
          for (int i = 0; i < ${N}; i++) if (i == k) o = uOff[i];
          vMapUv = vec2(uv.x - bi * 1000.0, uv.y - o);
        }`,
      );
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTexOn;').replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        diffuseColor.rgb *= mix( vec3( 1.0 ), sampledDiffuseColor.rgb, vTexOn );
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => `werkshof-belt-${N}`;
  return { mat, off };
}

export function buildMachines(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  /** Punkt auf der Fahrbahn: Abschnitt s, seitlich lat, dy darüber, fwd voraus. */
  const P = (s: number, lat: number, dy: number, fwd = 0): V3 => [
    t.px[s] + rightX(t, s) * lat + t.tx[s] * fwd,
    t.py[s] + lat * t.bank[s] + dy,
    t.pz[s] + rightZ(t, s) * lat + t.tz[s] * fwd,
  ];
  const UP: V3 = [0, 1, 0];

  // ============================== Förderbänder ==============================

  const floor = new MeshBuilder();
  const beltDefs = t.belts;
  /** Kachellänge in Laufrichtung je Band (für das Wandern des Musters). */
  const beltTile = beltDefs.map((b) => (b.along === 0 && b.across !== 0 ? TILE_X : TILE));
  beltDefs.forEach((b, k) => buildBelt(floor, b, k));

  function buildBelt(mb: MeshBuilder, b: Belt, k: number): void {
    // Abschnitte first … first+count−1, das letzte reicht bis zu seinem Nachfolger.
    const segs: number[] = [];
    for (let i = 0; i < b.count; i++) segs.push(b.first + i);
    segs.push(t.next[b.first + b.count - 1]);
    const dist: number[] = [0];
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1];
      const c = segs[i];
      dist.push(dist[i - 1] + Math.hypot(t.px[c] - t.px[a], t.pz[c] - t.pz[a]));
    }
    const length = dist[dist.length - 1];
    const tag = 1000 * (k + 1);
    const { lat0, lat1 } = b;
    const quer = b.along === 0 && b.across !== 0;
    const speed = quer ? b.across : b.along;
    const col = quer ? C_SIDE : speed > 0 ? C_FWD : C_BACK;
    const dir = speed >= 0 ? 1 : -1;

    // Bahn
    if (!quer) {
      for (let i = 0; i + 1 < segs.length; i++) {
        const s = segs[i];
        const n = segs[i + 1];
        mb.quadUv(P(s, lat0, BELT_Y), P(s, lat1, BELT_Y), P(n, lat1, BELT_Y), P(n, lat0, BELT_Y), col, tag, (dir * dist[i]) / TILE, tag + 1, (dir * dist[i + 1]) / TILE);
      }
    } else {
      const rows = Math.max(1, Math.round(length / ROW_ACROSS));
      const tu = length / rows;
      for (let i = 0; i + 1 < segs.length; i++) {
        const s = segs[i];
        const n = segs[i + 1];
        // a→b läuft rückwärts, b→c nach rechts: so liegt u längs und v quer, und die Fläche zeigt nach oben.
        mb.quadUv(P(n, lat0, BELT_Y), P(s, lat0, BELT_Y), P(s, lat1, BELT_Y), P(n, lat1, BELT_Y), col, tag + dist[i + 1] / tu, (dir * lat0) / TILE_X, tag + dist[i] / tu, (dir * lat1) / TILE_X);
      }
    }

    // Seitenschienen und Rollen längs der Strecke: in Stücken zu ~3 m.
    const pick: number[] = [];
    for (let i = 0; i < segs.length - 1; i += 3) pick.push(i);
    if (segs.length - 1 - pick[pick.length - 1] < 1.5 && pick.length > 1) pick.pop();
    pick.push(segs.length - 1);
    const strip = (latA: number, latB: number, inner: number): void => {
      // flache Schiene latA…latB (latA nahe am Rand), mit Innenkante zur Bahn hin
      for (let q = 0; q + 1 < pick.length; q++) {
        const s = segs[pick[q]];
        const n = segs[pick[q + 1]];
        face(mb, P(s, latA, RAIL_Y), P(s, latB, RAIL_Y), P(n, latB, RAIL_Y), P(n, latA, RAIL_Y), UP, q % 2 === 0 ? C_STEEL : shadeRgb(C_STEEL, 1.15));
        face(mb, P(s, latB, BELT_Y), P(n, latB, BELT_Y), P(n, latB, RAIL_Y), P(s, latB, RAIL_Y), [rightX(t, s) * inner, 0, rightZ(t, s) * inner], C_STEEL_HI);
      }
    };
    /** Rolle mit Kammblech, die quer zur Strecke liegt (Längsband): an Abschnitt s, voraus fwd0 → fwd0 + sgn·…. */
    const crossEnd = (s: number, sgn: number): void => {
      const la = lat0 + RAIL_W;
      const lb = lat1 - RAIL_W;
      // Kammblech gelb-schwarz
      stripedFace(mb, P(s, la, 0.055, 0), P(s, lb, 0.055, 0), P(s, lb, 0.055, sgn * 0.42), P(s, la, 0.055, sgn * 0.42), UP, C_YEL, C_INK, 0.32);
      // Umlenkrolle: flacher Buckel
      const prof: [number, number][] = [
        [0.42, 0.055],
        [0.52, 0.09],
        [0.8, 0.09],
      ];
      for (let i = 0; i + 1 < prof.length; i++) {
        const [f0, y0] = prof[i];
        const [f1, y1] = prof[i + 1];
        face(mb, P(s, la, y0, sgn * f0), P(s, lb, y0, sgn * f0), P(s, lb, y1, sgn * f1), P(s, la, y1, sgn * f1), UP, i === 1 ? C_STEEL_HI : C_ROLL);
      }
    };
    /** Rolle mit Kammblech längs der Strecke (Querband), am seitlichen Ende lat, nach innen sgn. */
    const alongEnd = (lat: number, sgn: number): void => {
      const prof: [number, number][] = [
        [0, 0.055],
        [0.42, 0.055],
        [0.52, 0.09],
        [0.8, 0.09],
      ];
      // in Stücken zu ~3 m: Kammblech abwechselnd gelb und schwarz
      for (let i = 0; i + 1 < pick.length; i++) {
        const s = segs[pick[i]];
        const n = segs[pick[i + 1]];
        const f0 = i === 0 ? RAIL_W : 0;
        const f1 = i + 2 === pick.length ? -RAIL_W : 0;
        for (let p = 0; p + 1 < prof.length; p++) {
          const [l0, y0] = prof[p];
          const [l1, y1] = prof[p + 1];
          const c = p === 0 ? (i % 2 === 0 ? C_YEL : C_INK) : p === 2 ? C_STEEL_HI : C_ROLL;
          face(mb, P(s, lat + sgn * l0, y0, f0), P(s, lat + sgn * l1, y1, f0), P(n, lat + sgn * l1, y1, f1), P(n, lat + sgn * l0, y0, f1), UP, c);
        }
      }
    };
    /** Schiene quer über die Strecke (Querband, vorne/hinten). */
    const crossRail = (s: number, f0: number, f1: number): void => {
      face(mb, P(s, lat0, RAIL_Y, f0), P(s, lat1, RAIL_Y, f0), P(s, lat1, RAIL_Y, f1), P(s, lat0, RAIL_Y, f1), UP, C_STEEL);
      const fi = Math.abs(f0) > Math.abs(f1) ? f0 : f1;
      face(mb, P(s, lat0, BELT_Y, fi), P(s, lat1, BELT_Y, fi), P(s, lat1, RAIL_Y, fi), P(s, lat0, RAIL_Y, fi), [t.tx[s] * Math.sign(fi), 0, t.tz[s] * Math.sign(fi)], C_STEEL_HI);
    };

    const sFirst = segs[0];
    const sLast = segs[segs.length - 1];
    if (!quer) {
      strip(lat0, lat0 + RAIL_W, 1);
      strip(lat1, lat1 - RAIL_W, -1);
      crossEnd(sFirst, 1);
      crossEnd(sLast, -1);
    } else {
      crossRail(sFirst, 0, RAIL_W);
      crossRail(sLast, 0, -RAIL_W);
      alongEnd(lat0, 1);
      alongEnd(lat1, -1);
    }
  }

  // ============================== Stampfpressen ==============================

  const presses = t.pulses.filter((p) => p.kind === PULSE_PRESS);
  const portal = new MeshBuilder();

  // Reihen: Pressen am selben Abschnitt teilen sich ein Portal.
  const rows = new Map<number, Pulse[]>();
  for (const p of presses) {
    const r = rows.get(p.seg);
    if (r) r.push(p);
    else rows.set(p.seg, [p]);
  }
  /** Lage der Lampen je Presse (Welt) – oben auf dem Träger und vorn an der Stirnseite. */
  const lampSpots: { pos: V3; size: V3; press: number }[] = [];
  /** Nummern der Lampen je Presse. */
  const pressLamps: number[][] = presses.map(() => []);
  /** Oberkante (absolut) der Zylinder je Presse: dort enden die Kolben. */
  const cylBottom = new Map<Pulse, number>();

  for (const [seg, row] of rows) {
    const s = seg;
    const rx = rightX(t, s);
    const rz = rightZ(t, s);
    const F: Xform = (lat, y, fwd) => [t.px[s] + rx * lat + t.tx[s] * fwd, y, t.pz[s] + rz * lat + t.tz[s] * fwd];
    const wh = t.wh[s];
    const roadAt = (lat: number): number => t.py[s] + lat * t.bank[s];
    const yR = Math.max(roadAt(-wh), roadAt(wh), t.py[s]);
    const yB = yR + BEAM_LO;
    const yT = yR + BEAM_HI;
    const L = wh + 1;
    const half = BEAM_DEPTH / 2;

    for (const side of [-1, 1]) {
      const lc = side * L;
      const g0 = roadAt(side * wh) - 2.5;
      const gr = roadAt(side * wh);
      // Fundament, Stütze (unten Warnstreifen), Kopfplatte
      boxT(portal, F, lc - 0.85, lc + 0.85, g0, gr + 0.3, -0.85, 0.85, C_CONCRETE, { noBottom: true });
      boxT(portal, F, lc - 0.45, lc + 0.45, gr + 0.3, gr + 1.9, -0.45, 0.45, C_YEL, { stripes: [C_INK, 0.32], noBottom: true });
      boxT(portal, F, lc - 0.45, lc + 0.45, gr + 1.9, yT, -0.45, 0.45, C_BLUE, { noBottom: true });
      // Kopfstrebe zwischen Stütze und Träger (schräg, als flaches Prisma)
      const kneeA = F(lc - side * 0.45, yB - 1.7, 0);
      const kneeB = F(lc - side * 2.2, yB, 0);
      for (const fz of [-0.22, 0.22]) {
        const a: V3 = [kneeA[0] + t.tx[s] * fz, kneeA[1], kneeA[2] + t.tz[s] * fz];
        const b: V3 = [kneeB[0] + t.tx[s] * fz, kneeB[1], kneeB[2] + t.tz[s] * fz];
        const a2 = F(lc - side * 0.45, yB - 1.2, fz);
        const b2 = F(lc - side * 1.7, yB, fz);
        face(portal, a, b, b2, a2, [t.tx[s] * Math.sign(fz), 0, t.tz[s] * Math.sign(fz)], C_BLUE_D);
      }
      {
        const a = F(lc - side * 0.45, yB - 1.7, -0.22);
        const b = F(lc - side * 2.2, yB, -0.22);
        const c = F(lc - side * 2.2, yB, 0.22);
        const d = F(lc - side * 0.45, yB - 1.7, 0.22);
        const out: V3 = [-rx * side, -1, -rz * side];
        face(portal, a, b, c, d, out, C_BLUE_D);
      }
    }
    // Querträger: unten ein Warnstreifenband, darüber blau, oben ein dunkler Laufsteg
    boxT(portal, F, -L - 0.6, L + 0.6, yB, yB + 0.32, -half, half, C_YEL, { stripes: [C_INK, 0.4] });
    boxT(portal, F, -L - 0.6, L + 0.6, yB + 0.32, yT, -half, half, C_BLUE, { noBottom: true, top: C_BLUE_D });
    boxT(portal, F, -L - 0.75, L + 0.75, yT, yT + 0.12, -half - 0.15, half + 0.15, C_STEEL);

    for (const p of row) {
      const la = p.lat;
      // Zylinder unter dem Träger, mit dunklem Kragen
      for (const o of [-CYL_OFF, CYL_OFF]) {
        cylT(portal, F, la + o, 0, 0.34, yB - CYL_LEN + 0.18, yB, C_YEL, undefined, 6);
        cylT(portal, F, la + o, 0, 0.4, yB - CYL_LEN, yB - CYL_LEN + 0.18, C_STEEL, C_STEEL, 6, 'bottom');
      }
      // Antrieb oben auf dem Träger und Lampenfassungen
      boxT(portal, F, la - 1.0, la + 1.0, yT + 0.12, yT + 0.75, -0.55, 0.45, C_STEEL, { noBottom: true, top: rgb(0x55525f) });
      boxT(portal, F, la - 0.52, la + 0.52, yT + 0.75, yT + 0.85, -0.52, 0.52, C_INK, { noBottom: true });
      boxT(portal, F, la - 0.72, la + 0.72, yB + 0.36, yT - 0.04, -half - 0.12, -half, C_INK, { noBottom: true });
      const pi = presses.indexOf(p);
      pressLamps[pi].push(lampSpots.length);
      lampSpots.push({ pos: F(la, yT + 1.2, 0), size: [0.85, 0.7, 0.85], press: pi });
      pressLamps[pi].push(lampSpots.length);
      lampSpots.push({ pos: F(la, (yB + 0.4 + yT - 0.08) / 2, -half - 0.16), size: [1.15, 0.98, 0.1], press: pi });
      cylBottom.set(p, yB - CYL_LEN + 0.25);

      // Bodenmarkierung: gelb-schwarzer Rahmen genau am Rand der Gefahrenfläche (innen)
      const r = p.radius;
      const fw = 0.3;
      const G = (lat: number, fwd: number): V3 => {
        const q = F(la + lat, 0, fwd);
        return [q[0], roadAt(la + lat) + 0.042, q[2]];
      };
      stripedFace(floor, G(-r, -r), G(r, -r), G(r, -r + fw), G(-r, -r + fw), UP, C_YEL, C_INK, 0.45);
      stripedFace(floor, G(-r, r - fw), G(r, r - fw), G(r, r), G(-r, r), UP, C_YEL, C_INK, 0.45);
      stripedFace(floor, G(-r, -r + fw), G(-r + fw, -r + fw), G(-r + fw, r - fw), G(-r, r - fw), UP, C_YEL, C_INK, 0.45);
      stripedFace(floor, G(r - fw, -r + fw), G(r, -r + fw), G(r, r - fw), G(r - fw, r - fw), UP, C_YEL, C_INK, 0.45);
    }
  }

  let tris = 0;

  // --- Boden und Bänder: ein Netz -------------------------------------------------
  const tex = beltTexture();
  const { mat: beltMat, off: beltOff } = beltMaterial(tex, beltDefs.length);
  disposables.push(tex, beltMat);
  if (!floor.empty) {
    tris += floor.triangles;
    const geo = floor.build();
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, beltMat);
    group.add(mesh);
  }

  // --- Portale --------------------------------------------------------------------
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  if (!portal.empty) {
    tris += portal.triangles * (detail ? 2 : 1);
    const geo = portal.build();
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, toon);
    if (detail) withOutline(mesh, 0.05);
    group.add(mesh);
  }

  // --- Stempel, Kolben, Lampen, Schatten (instanziert) ----------------------------
  const n = presses.length;
  const ramParts: THREE.InstancedMesh[] = [];
  let ram: THREE.InstancedMesh | null = null;
  let rods: THREE.InstancedMesh | null = null;
  let lamps: THREE.InstancedMesh | null = null;
  let shadows: THREE.InstancedMesh | null = null;
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  disposables.push(lampMat, shadowMat);

  if (n > 0) {
    // Stempel: Unterkante bei y = 0, Kantenlänge 2·radius (alle Pressen gleich groß).
    const R = presses[0].radius;
    const rb = new MeshBuilder();
    const I: Xform = (x, y, z) => [x, y, z];
    boxT(rb, I, -R, R, 0, 0.36, -R, R, rgb(0x4a4755), { top: C_STEEL });
    boxT(rb, I, -R + 0.16, R - 0.16, 0.36, 1.12, -R + 0.16, R - 0.16, C_YEL, { stripes: [C_INK, 0.42], noBottom: true, top: C_STEEL });
    boxT(rb, I, -R + 0.55, R - 0.55, 1.12, RAM_H, -R + 0.55, R - 0.55, C_STEEL, { noBottom: true, top: rgb(0x55525f) });
    // Augen für die Kolben
    const ramGeo = rb.build();
    const rodB = new MeshBuilder();
    for (const o of [-CYL_OFF, CYL_OFF]) cylT(rodB, I, o, 0, 0.15, 0, 1, C_CHROME, undefined, 6);
    const rodGeo = rodB.build();
    disposables.push(ramGeo, rodGeo);

    ram = new THREE.InstancedMesh(ramGeo, toon, n);
    rods = new THREE.InstancedMesh(rodGeo, toon, n);
    ramParts.push(ram, rods);
    tris += (rb.triangles + rodB.triangles) * n * (detail ? 2 : 1);
    if (detail) {
      for (const [im, geo, th] of [
        [ram, ramGeo, 0.05],
        [rods, rodGeo, 0.035],
      ] as [THREE.InstancedMesh, THREE.BufferGeometry, number][]) {
        addSmoothNormals(geo);
        const ol = new THREE.InstancedMesh(geo, outlineMaterial(th), n);
        ol.instanceMatrix = im.instanceMatrix;
        ol.frustumCulled = false;
        ramParts.push(ol);
      }
    }

    // Lampen: Würfel, je Presse zwei (oben, vorn)
    const lampGeo = new THREE.BoxGeometry(1, 1, 1);
    disposables.push(lampGeo);
    lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
    tris += 12 * lampSpots.length;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pv = new THREE.Vector3();
    lampSpots.forEach((l, i) => {
      const p = presses[l.press];
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(t.tx[p.seg], t.tz[p.seg]));
      m.compose(pv.set(l.pos[0], l.pos[1], l.pos[2]), q, sc.set(l.size[0], l.size[1], l.size[2]));
      lamps!.setMatrixAt(i, m);
      lamps!.setColorAt(i, new THREE.Color(0x30ff70));
    });
    lamps.instanceMatrix.needsUpdate = true;
    lamps.computeBoundingSphere();

    // Schatten: Quadrat 2·radius, flach auf der Fahrbahn
    const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    disposables.push(shadowGeo);
    shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, n);
    shadows.frustumCulled = false;
    shadows.renderOrder = 1;
    tris += 2 * n;
    for (let i = 0; i < n; i++) shadows.setColorAt(i, new THREE.Color(0x000000));

    for (const im of ramParts) {
      im.frustumCulled = false;
      group.add(im);
    }
    group.add(lamps, shadows);
    disposables.push(...ramParts, lamps, shadows);
  }

  // Stand je Presse (für den Aufschlag-Effekt)
  const lastC = new Float64Array(n).fill(NaN);
  const heading = presses.map((p) => Math.atan2(t.tx[p.seg], t.tz[p.seg]));
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  /** Unterkante des Stempels über der Fahrbahn zur Rennzeit time. */
  function ramLift(p: Pulse, time: number, seconds: number): number {
    const c = pulseCycle(p, time);
    const fallFrom = REST - DIP;
    if (c >= p.period - STRIKE || c < STRIKE) {
      // Schlag: beschleunigt herunter
      const k = c >= p.period - STRIKE ? (c - (p.period - STRIKE)) / (2 * STRIKE) : (c + STRIKE) / (2 * STRIKE);
      return fallFrom * (1 - k * k);
    }
    if (c < p.on) {
      // unten; kurz nach dem Aufschlag ein kleines Nachfedern
      const k = (c - STRIKE) / 8;
      return k < 1 ? 0.07 * Math.sin(k * Math.PI) : 0;
    }
    if (c < p.on + RISE) return REST * smooth((c - p.on) / RISE);
    const w = pulseWarning(p, time);
    if (w > 0) {
      // ansenken, zum Ende hin zittern
      const tremble = w > 0.6 ? Math.sin(seconds * 70) * 0.035 * (w - 0.6) * 2.5 : 0;
      return REST - DIP * smooth(Math.min(1, w * 1.4)) + tremble;
    }
    return REST;
  }

  const DUST = 0xb9a68a;

  // Zum Nachzählen (Dreiecke je Bild, Konturen eingerechnet)
  group.userData.triangles = tris;

  return {
    group,
    update(time, seconds, _dt, cam, fx) {
      // Bänder: Muster wandert mit dem Tempo des Bands (Kacheln pro Sekunde)
      for (let k = 0; k < beltDefs.length; k++) {
        const b = beltDefs[k];
        const v = Math.abs(b.along !== 0 ? b.along : b.across);
        const o = (seconds * v) / beltTile[k];
        beltOff[k] = o - Math.floor(o);
      }

      if (!ram || !rods || !lamps || !shadows) return;
      for (let i = 0; i < n; i++) {
        const p = presses[i];
        const c = pulseCycle(p, time);
        const w = pulseWarning(p, time);
        const h = ramLift(p, time, seconds);
        quat.setFromAxisAngle(yAxis, heading[i]);
        // Die Kamera folgt dem Kart durch die Presse. Steht sie dabei im noch gesenkten Stempel, wäre das
        // Bild schwarz – dann wird dieser eine Stempel nicht gezeichnet (Schatten und Lampe bleiben).
        const inside = Math.hypot(cam.x - p.x, cam.z - p.z) < p.radius * 1.42 + 0.9 && cam.y > p.y + h - 0.5 && cam.y < p.y + h + RAM_H + 0.6;
        // Stempel
        mat4.compose(pos.set(p.x, p.y + 0.012 + h, p.z), quat, inside ? scale.set(0, 0, 0) : scale.set(1, 1, 1));
        ram.setMatrixAt(i, mat4);
        // Kolben: von der Oberseite des Stempels bis in die Zylinder
        const top = p.y + 0.012 + h + RAM_H;
        const len = Math.max(0.05, (cylBottom.get(p) ?? top) - top);
        mat4.compose(pos.set(p.x, top, p.z), quat, scale.set(1, len, 1));
        rods.setMatrixAt(i, mat4);

        // Lampe: grün in Ruhe, rot blinkend bei der Warnung (immer schneller), rot während der Gefahr
        const danger = c < p.on || c >= p.period - STRIKE;
        if (danger) col.setHex(0xff2414);
        else if (w > 0) {
          const hz = 3 + 7 * w;
          col.setHex(Math.floor(seconds * hz * 2) % 2 === 0 ? 0xff2414 : 0x3a0806);
        } else col.setHex(0x34ff74);
        for (const li of pressLamps[i]) lamps.setColorAt(li, col);

        // Schatten: wächst während der Warnung auf die volle Fläche und pulsiert dunkelrot
        let sh = 0;
        if (danger) sh = 1;
        else if (w > 0) sh = 0.5 + 0.5 * smooth(w * 1.5);
        else if (c < p.on + 20) sh = 1 - (c - p.on) / 20;
        const S = 2 * p.radius * sh;
        mat4.compose(pos.set(p.x, p.y + 0.06, p.z), quat, scale.set(Math.max(1e-4, S), 1, Math.max(1e-4, S)));
        shadows.setMatrixAt(i, mat4);
        if (danger) col.setHex(0x000000);
        else col.setHex(Math.floor(seconds * (3 + 7 * w) * 2) % 2 === 0 ? 0x2a0000 : 0x000000);
        shadows.setColorAt(i, col);

        // Aufschlag: Staub und Funken (nur mit Zierde und in Kameranähe)
        const prev = lastC[i];
        lastC[i] = c;
        if (detail && !Number.isNaN(prev) && c >= STRIKE && c < STRIKE + 20 && (prev < STRIKE || prev > c)) {
          const dx = p.x - cam.x;
          const dz = p.z - cam.z;
          if (dx * dx + dz * dz < 150 * 150) {
            const R = p.radius;
            const fwdX = t.tx[p.seg];
            const fwdZ = t.tz[p.seg];
            const rX = rightX(t, p.seg);
            const rZ = rightZ(t, p.seg);
            for (let k = 0; k < 10; k++) {
              // Punkt am Rand der Platte, nach außen gerichtet
              const side = k % 4;
              const u = (((k * 7) % 10) / 10) * 2 - 1;
              const nl = side === 0 ? 1 : side === 1 ? -1 : u;
              const nf = side === 2 ? 1 : side === 3 ? -1 : u;
              const ex = p.x + (rX * nl + fwdX * nf) * R;
              const ez = p.z + (rZ * nl + fwdZ * nf) * R;
              const ox = rX * (side < 2 ? nl : 0) + fwdX * (side >= 2 ? nf : 0);
              const oz = rZ * (side < 2 ? nl : 0) + fwdZ * (side >= 2 ? nf : 0);
              if (k % 2 === 1) fx.puff(ex, p.y + 0.25, ez, ox * 3.2, 1.0, oz * 3.2, 0.55, 0.7, DUST, 1.4, -0.3);
              if (k % 2 === 0) fx.spark(ex, p.y + 0.25, ez, ox * 6 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, oz * 6 + (Math.random() - 0.5) * 2, 0.45, 0.22, 0xffcf4a, 14);
            }
          }
        }
      }
      ram.instanceMatrix.needsUpdate = true;
      rods.instanceMatrix.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
      if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
      if (shadows.instanceColor) shadows.instanceColor.needsUpdate = true;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

function shadeRgb(c: RGB, f: number): RGB {
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}
