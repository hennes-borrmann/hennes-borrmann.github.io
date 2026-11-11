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
// Zeichentechnik: bewusst nur das, was die Welt schon vor den Maschinen benutzt hat –
// eingefärbte Flächen (MeshBasicMaterial mit Eckenfarben), Toon-Körper mit Kontur und
// einfarbige Flächen. Kein eigener Shader, keine Textur, keine Instanzen. Grund: Seit
// der ersten Fassung der Maschinen (ein Shader mit Feld-Uniform und Kacheltextur für die
// Bänder, Instanzen mit eigener Farbe für Pressen, Lampen und Schatten) verlor ein iPad
// der 10. Generation (A14, Safari 26) im Werkshof nach wenigen Bildern die 3D-Grafik –
// die Fassung davor lief dort. Welcher der Bausteine es war, ließ sich von außen nicht
// klären; gemessen ist nur (Aufzeichnung aller WebGL-Aufrufe), dass diese Fassung der
// Maschinen keinen Aufruf und kein Grafikprogramm braucht, das es ohne sie nicht gäbe.
//
// Das Muster der Bänder wandert deshalb als Geometrie: je Bild werden die Ecken der
// Pfeile neu gesetzt (ein Netz für alle Bänder, eine Pufferaktualisierung).

import * as THREE from 'three';
import { PULSE_PRESS, pulseCycle, pulseWarning, type Belt, type Pulse, PRESS_LEAD, PRESS_STRIKE, pressOpen } from '../../game/mechanics';
import { rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, smooth, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';
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

// --- Muster der Bänder ----------------------------------------------------------------

/**
 * Eine Kachel des Musters, in Laufrichtung gestapelt: [Anteil der Kachellänge, Helligkeit].
 * Die Helligkeit wird mit der Farbe des Bands malgenommen: 1 = Pfeil, fast 0 = Tuschekante,
 * dazwischen das dunkle Gummi mit einer Lamellenfuge samt Lichtkante.
 */
const INK = 0.005;
const RUBBER = 0.042;
const BANDS: readonly (readonly [number, number])[] = [
  [0.04, INK],
  [0.17, 1],
  [0.04, INK],
  [0.3, RUBBER],
  [0.035, 0.008],
  [0.015, 0.107],
  [0.4, RUBBER],
];
/** Ende jedes Streifens ab Kachelanfang (aufsummierte Dicken). */
const BAND_END: readonly number[] = BANDS.map((_, i) => (i + 1 === BANDS.length ? 1 : BANDS.slice(0, i + 1).reduce((sum, b) => sum + b[0], 0)));
/** So weit eilt die Pfeilspitze (Bandmitte) den Rändern voraus, in Kachellängen. */
const PEAK = 0.672;
/** Rand ohne Pfeil links und rechts (Anteil der Breite): so bleiben benachbarte Pfeile getrennte Pfeile statt eines Zickzacks. */
const MARGIN = 0.0625;
/**
 * Musterstücke je Kachel: jeder Streifen in vier Stücken – Rand, steigender Arm, fallender Arm, Rand.
 * Die Ränder sind mit unterteilt, damit an ihrer Naht zu den Armen jede Ecke eine Gegenecke hat
 * (sonst klaffen auf gebogenen Bändern Spalte).
 */
const PIECES = BANDS.length * 4;
/** Ecken je Musterstück: ein Viereck wird an den Bandenden beschnitten – höchstens ein Sechseck, also vier Dreiecke als Fächer. */
const CORNERS = 6;

/** Ein Band, wie es das Muster braucht. */
interface BeltLane {
  /** Laufrichtung des Musters entlang der Laufachse (+1 / −1). */
  dir: number;
  /** true: das Band schiebt quer – Laufachse ist die Seite, Querachse die Strecke. */
  quer: boolean;
  /** Kachellänge in Laufrichtung (Meter) und Tempo in Kacheln pro Sekunde. */
  tile: number;
  rate: number;
  /** Laufachse in Kacheln: von … bis (in Musterrichtung gemessen). */
  g0: number;
  g1: number;
  /** Anzahl Kacheln hintereinander und Reihen nebeneinander. */
  tiles: number;
  rows: number;
  /** Länge einer Reihe längs der Strecke (nur quer). */
  rowLen: number;
  lat0: number;
  lat1: number;
  /** Stützpunkte längs der Strecke: Weg, Mitte der Fahrbahn (schon um BELT_Y gehoben), Richtung nach rechts samt Querneigung. */
  dist: Float64Array;
  base: Float64Array;
  right: Float64Array;
  /** Erste Ecke dieses Bands im gemeinsamen Netz. */
  first: number;
  /** Dreiecke andersherum schreiben, damit die Fläche nach oben zeigt. */
  flip: boolean;
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
  // (Strömungen unter Wasser sind keine Bänder: die zeichnet mechanics/dive.ts.)
  const beltDefs = t.belts.filter((b) => !b.swim);
  /** Je Band: was das wandernde Muster braucht (Netz und Farben entstehen weiter unten). */
  const lanes: BeltLane[] = [];
  const laneCol: RGB[] = [];
  beltDefs.forEach((b) => buildBelt(floor, b));

  function buildBelt(mb: MeshBuilder, b: Belt): void {
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
    const { lat0, lat1 } = b;
    const quer = b.along === 0 && b.across !== 0;
    const speed = quer ? b.across : b.along;
    const col = quer ? C_SIDE : speed > 0 ? C_FWD : C_BACK;
    const dir = speed >= 0 ? 1 : -1;

    // Bahn: das Muster wandert (update), hier nur seine Lage.
    {
      const tile = quer ? TILE_X : TILE;
      // Laufachse in Metern: längs der Weg auf dem Band, quer die seitliche Lage.
      const f0 = quer ? lat0 : 0;
      const f1 = quer ? lat1 : length;
      const g0 = (dir > 0 ? f0 : -f1) / tile;
      const g1 = (dir > 0 ? f1 : -f0) / tile;
      const rows = quer ? Math.max(1, Math.round(length / ROW_ACROSS)) : 1;
      const base = new Float64Array(segs.length * 3);
      const right = new Float64Array(segs.length * 3);
      segs.forEach((s, i) => {
        base[i * 3] = t.px[s];
        base[i * 3 + 1] = t.py[s] + BELT_Y;
        base[i * 3 + 2] = t.pz[s];
        right[i * 3] = rightX(t, s);
        right[i * 3 + 1] = t.bank[s];
        right[i * 3 + 2] = rightZ(t, s);
      });
      lanes.push({
        dir,
        quer,
        tile,
        rate: Math.abs(speed) / tile,
        g0,
        g1,
        // Mehr Kacheln, als auf das Band passen: das Muster ist gegen die Bandenden um bis zu eine Kachel
        // verschoben, und die Pfeilspitze reicht um PEAK über den Anfang ihrer Kachel hinaus.
        tiles: Math.ceil(g1 - g0 + PEAK) + 2,
        rows,
        rowLen: length / rows,
        lat0,
        lat1,
        dist: Float64Array.from(dist),
        base,
        right,
        first: 0,
        flip: false,
      });
      laneCol.push(col);
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

  // --- Boden: Schienen, Rollen, Kammbleche, Markierungen (steht) ---------------------------
  // Etwas stärker nach vorn gezogen als die Fahrbahnfarbe (world.ts: −2/−4), sonst scheinen deren Linien durch.
  const floorMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  disposables.push(floorMat);
  if (!floor.empty) {
    tris += floor.triangles;
    const geo = floor.build();
    disposables.push(geo);
    group.add(new THREE.Mesh(geo, floorMat));
  }

  // --- Bänder: ein Netz für alle, die Ecken des Musters werden je Bild neu gesetzt ----------
  //
  // Jedes Musterstück hat sechs Ecken und vier Dreiecke als Fächer: unbeschnitten ist es ein
  // Viereck (zwei Ecken fallen zusammen), an den Bandenden schneidet piece() es ab – dabei
  // entstehen höchstens sechs Ecken.
  let beltPos: Float32Array | null = null;
  let beltAttr: THREE.BufferAttribute | null = null;
  /** Mitte und Halbmesser je Band (für "zu weit weg, Muster nicht bewegen"). */
  const laneMid: number[] = [];

  // Zwischenspeicher für das Beschneiden eines Musterstücks (u, g; höchstens sechs Ecken).
  const pu = new Float64Array(8);
  const pg = new Float64Array(8);
  const qu = new Float64Array(8);
  const qg = new Float64Array(8);
  /** Punkt auf Band l: Weg d längs der Strecke, seitlich lat – nach out ab Stelle o. */
  function onBelt(l: BeltLane, d: number, lat: number, out: Float32Array | Float64Array, o: number): void {
    const D = l.dist;
    const last = D.length - 2;
    let i = Math.max(0, Math.min(last, Math.floor((d / D[last + 1]) * (last + 1))));
    while (i > 0 && D[i] > d) i--;
    while (i < last && D[i + 1] < d) i++;
    const span = D[i + 1] - D[i];
    const k = span > 0 ? Math.max(0, Math.min(1, (d - D[i]) / span)) : 0;
    const a = i * 3;
    const B = l.base;
    const R = l.right;
    for (let c = 0; c < 3; c++) {
      const p0 = B[a + c] + R[a + c] * lat;
      const p1 = B[a + 3 + c] + R[a + 3 + c] * lat;
      out[o + c] = p0 + (p1 - p0) * k;
    }
  }
  /** Musterkoordinaten (u quer 0…1, g längs in Kacheln) der Reihe row → Punkt in der Welt. */
  function onPattern(l: BeltLane, row: number, u: number, g: number, out: Float32Array | Float64Array, o: number): void {
    const f = l.dir * g * l.tile;
    if (l.quer) onBelt(l, (row + u) * l.rowLen, f, out, o);
    else onBelt(l, f, l.lat0 + u * (l.lat1 - l.lat0), out, o);
  }

  if (lanes.length > 0) {
    let count = 0;
    const box = new THREE.Box3();
    const probe = new Float64Array(9);
    const v3 = new THREE.Vector3();
    for (const l of lanes) {
      l.first = count;
      count += l.rows * l.tiles * PIECES * CORNERS;
      // Drehsinn: zeigt ein Stück in der Reihenfolge (uA,g) → (uB,g) → (uB,g+) nach oben?
      const gm = (l.g0 + l.g1) / 2;
      onPattern(l, 0, 0, gm, probe, 0);
      onPattern(l, 0, 0.5, gm, probe, 3);
      onPattern(l, 0, 0.5, gm + 0.05, probe, 6);
      const ny = (probe[5] - probe[2]) * (probe[6] - probe[0]) - (probe[3] - probe[0]) * (probe[8] - probe[2]);
      l.flip = ny < 0;
      // Hülle und Mitte
      const own = new THREE.Box3();
      for (let i = 0; i < l.dist.length; i++)
        for (const lat of [l.lat0, l.lat1]) {
          onBelt(l, l.dist[i], lat, probe, 0);
          own.expandByPoint(v3.set(probe[0], probe[1], probe[2]));
        }
      box.union(own);
      const mid = own.getCenter(v3);
      laneMid.push(mid.x, mid.z, own.getSize(new THREE.Vector3()).length() / 2);
    }
    beltPos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const index = count > 65535 ? new Uint32Array((count / CORNERS) * 12) : new Uint16Array((count / CORNERS) * 12);
    lanes.forEach((l, k) => {
      const c = laneCol[k];
      let v = l.first;
      for (let tile = l.rows * l.tiles; tile > 0; tile--)
        for (let piece = 0; piece < PIECES; piece++) {
          // je Streifen: Rand, Arm, Arm, Rand. Am Rand läuft nur die Lamellenfuge durch, der Pfeil nicht.
          const band = BANDS[piece >> 2][1];
          const arm = (piece & 3) === 1 || (piece & 3) === 2;
          const lum = arm || (band !== 1 && band !== INK) ? band : RUBBER;
          for (let q = CORNERS; q > 0; q--) {
            cols[v * 3] = c[0] * lum;
            cols[v * 3 + 1] = c[1] * lum;
            cols[v * 3 + 2] = c[2] * lum;
            v++;
          }
        }
      for (let slot = l.first / CORNERS; slot < v / CORNERS; slot++)
        for (let f = 0; f < 4; f++) {
          const o = slot * 12 + f * 3;
          index[o] = slot * CORNERS;
          index[o + 1] = slot * CORNERS + f + (l.flip ? 2 : 1);
          index[o + 2] = slot * CORNERS + f + (l.flip ? 1 : 2);
        }
    });
    const geo = new THREE.BufferGeometry();
    beltAttr = new THREE.BufferAttribute(beltPos, 3);
    beltAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', beltAttr);
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    // Normalen braucht das Material nicht – mit ihnen nimmt three.js aber genau das Grafikprogramm,
    // das auch die Fahrbahnfarbe zeichnet, statt ein weiteres zu übersetzen.
    const up = new Float32Array(count * 3);
    for (let i = 1; i < up.length; i += 3) up[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(up, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    // Das Muster verlässt die Bänder nie: Hülle einmal aus deren Ecken.
    geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    group.add(new THREE.Mesh(geo, floorMat));
    disposables.push(geo);
    // sichtbar sind je Stück zwei Dreiecke (die übrigen fallen zusammen)
    tris += (count / CORNERS) * 2;
    writeBelts(0, null);
  }

  /** Behält vom Vieleck (pu, pg)[0…m) den Teil mit sign·(g − bound) ≥ 0; gibt die neue Eckenzahl zurück. */
  function clip(m: number, bound: number, sign: number): number {
    let k = 0;
    for (let i = 0; i < m; i++) {
      const j = i + 1 === m ? 0 : i + 1;
      const a = sign * (pg[i] - bound);
      const b = sign * (pg[j] - bound);
      if (a >= 0) {
        qu[k] = pu[i];
        qg[k++] = pg[i];
      }
      if (a >= 0 !== b >= 0) {
        qu[k] = pu[i] + ((pu[j] - pu[i]) * a) / (a - b);
        qg[k++] = bound;
      }
    }
    for (let i = 0; i < k; i++) {
      pu[i] = qu[i];
      pg[i] = qg[i];
    }
    return k;
  }

  /**
   * Ein Musterstück: Viereck (uA, gA) – (uB, gB) – (uB, hB) – (uA, hA), an den Bandenden
   * abgeschnitten, in die sechs Ecken ab Ecke v des Netzes.
   */
  function piece(l: BeltLane, row: number, v: number, uA: number, gA: number, uB: number, gB: number, hA: number, hB: number): void {
    const out = beltPos!;
    const lo = Math.min(gA, gB);
    const hi = Math.max(hA, hB);
    let m = 0;
    if (hi > l.g0 && lo < l.g1) {
      pu[0] = uA;
      pg[0] = gA;
      pu[1] = uB;
      pg[1] = gB;
      pu[2] = uB;
      pg[2] = hB;
      pu[3] = uA;
      pg[3] = hA;
      m = 4;
      if (lo < l.g0) m = clip(m, l.g0, 1);
      if (m > 0 && hi > l.g1) m = clip(m, l.g1, -1);
    }
    const o = v * 3;
    if (m < 3) {
      // nichts zu sehen: alle Ecken auf einen Punkt des Bands
      onBelt(l, 0, l.lat0, out, o);
      m = 1;
    } else for (let i = 0; i < m; i++) onPattern(l, row, pu[i], pg[i], out, o + i * 3);
    for (let i = m; i < CORNERS; i++) {
      out[o + i * 3] = out[o + (m - 1) * 3];
      out[o + i * 3 + 1] = out[o + (m - 1) * 3 + 1];
      out[o + i * 3 + 2] = out[o + (m - 1) * 3 + 2];
    }
  }

  /**
   * Setzt die Ecken des Musters für die Zeit seconds: je Band wandern die Kacheln mit dem Tempo des
   * Bands (wie in der Physik) und werden an den Bandenden abgeschnitten. cam: Bänder weit weg von
   * der Kamera bleiben stehen (null = alle schreiben). Gibt zurück, ob etwas geschrieben wurde.
   */
  function writeBelts(seconds: number, cam: THREE.Vector3 | null): boolean {
    if (!beltPos) return false;
    let wrote = false;
    for (let li = 0; li < lanes.length; li++) {
      const l = lanes[li];
      if (cam && Math.hypot(cam.x - laneMid[li * 3], cam.z - laneMid[li * 3 + 1]) > laneMid[li * 3 + 2] + 240) continue;
      wrote = true;
      const turn = seconds * l.rate;
      const off = turn - Math.floor(turn);
      // Kachel n belegt g von n + off (Rand) bis n + off + 1 + PEAK (Spitze in der Mitte).
      const nBase = Math.ceil(l.g0 - off - 1 - PEAK);
      let v = l.first;
      for (let row = 0; row < l.rows; row++)
        for (let j = 0; j < l.tiles; j++) {
          const g0 = nBase + j + off;
          let g = g0;
          for (let band = 0; band < BANDS.length; band++) {
            // Obere Grenze aus derselben Rechnung wie die untere des nächsten Streifens: gleiche Zahl, gleiche Ecke.
            const h = g0 + BAND_END[band];
            // Rand – linker Arm steigt zur Mitte an – rechter fällt wieder ab – Rand
            piece(l, row, v, 0, g, MARGIN, g, h, h);
            piece(l, row, v + CORNERS, MARGIN, g, 0.5, g + PEAK, h, h + PEAK);
            piece(l, row, v + 2 * CORNERS, 0.5, g + PEAK, 1 - MARGIN, g, h + PEAK, h);
            piece(l, row, v + 3 * CORNERS, 1 - MARGIN, g, 1, g, h, h);
            v += 4 * CORNERS;
            g = h;
          }
        }
    }
    return wrote;
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

  // --- Stempel, Kolben, Lampen, Schatten: je Presse eigene Körper ----------------------
  interface PressView {
    ram: THREE.Mesh;
    rods: THREE.Mesh;
    /** Farbe der beiden Lampen dieser Presse. */
    lamp: THREE.MeshBasicMaterial;
    shadow: THREE.Mesh;
    shade: THREE.MeshBasicMaterial;
  }
  const views: PressView[] = [];
  const n = presses.length;

  if (n > 0) {
    // Stempel: Unterkante bei y = 0, Kantenlänge 2·radius (alle Pressen gleich groß).
    const R = presses[0].radius;
    const rb = new MeshBuilder();
    const I: Xform = (x, y, z) => [x, y, z];
    boxT(rb, I, -R, R, 0, 0.36, -R, R, rgb(0x4a4755), { top: C_STEEL });
    boxT(rb, I, -R + 0.16, R - 0.16, 0.36, 1.12, -R + 0.16, R - 0.16, C_YEL, { stripes: [C_INK, 0.42], noBottom: true, top: C_STEEL });
    boxT(rb, I, -R + 0.55, R - 0.55, 1.12, RAM_H, -R + 0.55, R - 0.55, C_STEEL, { noBottom: true, top: rgb(0x55525f) });
    const ramGeo = rb.build();
    // Kolben: Länge 1, wird je Bild auf den Abstand zwischen Stempel und Zylinder gestreckt
    const rodB = new MeshBuilder();
    for (const o of [-CYL_OFF, CYL_OFF]) cylT(rodB, I, o, 0, 0.15, 0, 1, C_CHROME, undefined, 6);
    const rodGeo = rodB.build();
    // Lampen: Würfel, je Presse zwei (oben, vorn); Schatten: Quadrat flach auf der Fahrbahn
    const lampGeo = new THREE.BoxGeometry(1, 1, 1);
    const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    disposables.push(ramGeo, rodGeo, lampGeo, shadowGeo);
    tris += (rb.triangles + rodB.triangles) * n * (detail ? 2 : 1) + 12 * lampSpots.length + 2 * n;

    presses.forEach((p, i) => {
      const head = Math.atan2(t.tx[p.seg], t.tz[p.seg]);
      const ram = new THREE.Mesh(ramGeo, toon);
      const rods = new THREE.Mesh(rodGeo, toon);
      ram.rotation.y = head;
      rods.rotation.y = head;
      if (detail) {
        withOutline(ram, 0.05);
        withOutline(rods, 0.035);
      }
      const lamp = new THREE.MeshBasicMaterial({ color: 0x34ff74 });
      for (const li of pressLamps[i]) {
        const spot = lampSpots[li];
        const box = new THREE.Mesh(lampGeo, lamp);
        box.position.set(spot.pos[0], spot.pos[1], spot.pos[2]);
        box.rotation.y = head;
        box.scale.set(spot.size[0], spot.size[1], spot.size[2]);
        group.add(box);
      }
      // Wie die Schatten der Karts (effects.ts) über alles gezogen, was flach auf der Fahrbahn liegt.
      const shade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10 });
      const shadow = new THREE.Mesh(shadowGeo, shade);
      shadow.position.set(p.x, p.y + 0.06, p.z);
      shadow.rotation.y = head;
      shadow.renderOrder = 1;
      shadow.visible = false;
      group.add(ram, rods, shadow);
      disposables.push(lamp, shade);
      views.push({ ram, rods, lamp, shadow, shade });
    });
  }

  // Stand je Presse (für den Aufschlag-Effekt)
  const lastC = new Float64Array(n).fill(NaN);

  /** Unterkante des Stempels über der Fahrbahn zur Rennzeit time. */
  function ramLift(p: Pulse, time: number, seconds: number): number {
    // Der Ablauf (Fallen, Liegen, Heben) steht in game/mechanics.ts und gilt genauso für die Physik:
    // solange die Gefahr besteht, steht der Stempel unter Karthöhe – und umgekehrt.
    const c = pulseCycle(p, time);
    const open = pressOpen(p, time);
    // Schlag: fällt aus der angesenkten Lage
    if (c >= p.period - PRESS_STRIKE) return (REST - DIP) * open;
    if (c < p.on - PRESS_LEAD) {
      // unten; kurz nach dem Aufschlag ein kleines Nachfedern
      const k = c / 8;
      return k < 1 ? 0.07 * Math.sin(k * Math.PI) : 0;
    }
    if (open < 1) return REST * open;
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
      // Bänder: Muster wandert mit dem Tempo des Bands
      if (beltAttr && writeBelts(seconds, cam)) beltAttr.needsUpdate = true;

      for (let i = 0; i < n; i++) {
        const p = presses[i];
        const view = views[i];
        const c = pulseCycle(p, time);
        const w = pulseWarning(p, time);
        const h = ramLift(p, time, seconds);
        // Die Kamera folgt dem Kart durch die Presse. Steht sie dabei im noch gesenkten Stempel, wäre das
        // Bild schwarz – dann wird dieser eine Stempel nicht gezeichnet (Schatten und Lampe bleiben).
        const inside = Math.hypot(cam.x - p.x, cam.z - p.z) < p.radius * 1.42 + 0.9 && cam.y > p.y + h - 0.5 && cam.y < p.y + h + RAM_H + 0.6;
        // Stempel
        view.ram.visible = !inside;
        view.ram.position.set(p.x, p.y + 0.012 + h, p.z);
        // Kolben: von der Oberseite des Stempels bis in die Zylinder
        const top = p.y + 0.012 + h + RAM_H;
        view.rods.position.set(p.x, top, p.z);
        view.rods.scale.y = Math.max(0.05, (cylBottom.get(p) ?? top) - top);

        // Lampe: grün in Ruhe, rot blinkend bei der Warnung (immer schneller), rot während der Gefahr
        const danger = c < p.on || c >= p.period - PRESS_STRIKE;
        const blink = Math.floor(seconds * (3 + 7 * w) * 2) % 2 === 0;
        if (danger) view.lamp.color.setHex(0xff2414);
        else if (w > 0) view.lamp.color.setHex(blink ? 0xff2414 : 0x3a0806);
        else view.lamp.color.setHex(0x34ff74);

        // Schatten: wächst während der Warnung auf die volle Fläche und pulsiert dunkelrot
        let sh = 0;
        if (danger) sh = 1;
        else if (w > 0) sh = 0.5 + 0.5 * smooth(w * 1.5);
        else if (c < p.on + 20) sh = 1 - (c - p.on) / 20;
        const S = 2 * p.radius * sh;
        view.shadow.visible = S > 0.01;
        view.shadow.scale.set(S, 1, S);
        view.shade.color.setHex(!danger && blink ? 0x2a0000 : 0x000000);

        // Aufschlag: Staub und Funken (nur mit Zierde und in Kameranähe)
        const prev = lastC[i];
        lastC[i] = c;
        if (detail && !Number.isNaN(prev) && c < 20 && prev > c) {
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
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

function shadeRgb(c: RGB, f: number): RGB {
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}
