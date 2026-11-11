// Leben in der Wolkenwerft: eine Luftschiffwerft hoch über einem Wolkenmeer.
// Aus der flachen Wolkendecke quellen Wolkenhügel und -türme, neben der
// Start-/Zielgeraden stehen Rumpfgerippe auf den Hellingen, um den Tunnel
// liegt der Hangar, am Ballonhafen schaukeln vertäute Ballone und ein
// Luftschiff am Ankermast wird vom Kran beladen. Darüber ziehen Luftschiffe,
// Doppeldecker kreisen, ein Vogelschwarm segelt vorbei, Rotoren unter den
// Plattformen halten alles in der Luft.
//
// Reine Kulisse: alles wird mit festem Zufall aus der Strecke abgeleitet und
// gegen Fahrbahn und Flugkorridore geprüft (luftFrei, wolkenDach). Im Lauf wird
// nichts neu angelegt – Zustände liegen in vorab angelegten Feldern.

import * as THREE from 'three';
import { EDGE_GLIDE, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

// --- Farben ------------------------------------------------------------------------

const C_ROT = rgb(0xe8483f);
const C_CREME = rgb(0xf4ead6);
const C_NAVY = rgb(0x2d3550);
const C_ALU = rgb(0xc9d3e2);
const C_ALU_D = rgb(0x8fa3bd);
const C_GELB = rgb(0xffc72e);
const C_GELB_D = rgb(0xe0a21c);
const C_SEIL = rgb(0x5a4436);
const C_DUNKEL = rgb(0x2a2733);
const C_FENSTER = rgb(0x9fe3f2);
const C_TUERKIS = rgb(0x1fc8b6);

// --- Bausteine -----------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const EINS = new THREE.Vector3(1, 1, 1);

/** Balken von a nach c mit quadratischem Querschnitt. */
function stab(b: MeshBuilder, a: V3, c: V3, dick: number, color: RGB): void {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  const g = new THREE.BoxGeometry(dick, len, dick);
  tmpQ.setFromUnitVectors(UP, tmpV.set(dx / len, dy / len, dz / len));
  tmpM.compose(tmpS.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), tmpQ, EINS);
  b.add(g, color, tmpM);
  g.dispose();
}

/** Viereck, dessen sichtbare Seite in Richtung n zeigt (Umlaufsinn wird passend gewählt). */
function quadN(b: MeshBuilder, a: V3, c1: V3, c2: V3, d: V3, n: V3, color: RGB): void {
  const ux = c1[0] - a[0];
  const uy = c1[1] - a[1];
  const uz = c1[2] - a[2];
  const vx = c2[0] - a[0];
  const vy = c2[1] - a[1];
  const vz = c2[2] - a[2];
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.quad(a, c1, c2, d, color);
  else b.quad(d, c2, c1, a, color);
}

/** Senkrechter Zylinder (wenige Seiten) um (x, y, z), y = Mitte. */
function zylinder(b: MeshBuilder, x: number, y: number, z: number, r: number, h: number, color: RGB, n = 6): void {
  const g = new THREE.CylinderGeometry(r, r, h, n);
  tmpM.makeTranslation(x, y, z);
  b.add(g, color, tmpM);
  g.dispose();
}

/**
 * Drehkörper um die Achse (y oder z): Profil aus [Radius, Höhe] von unten/hinten
 * nach oben/vorn; Farbe je Ring i und Seite j.
 */
function drehkoerper(b: MeshBuilder, prof: [number, number][], n: number, achse: 'y' | 'z', farbe: (i: number, j: number) => RGB): void {
  const pt = (r: number, h: number, a: number): V3 => (achse === 'y' ? [Math.cos(a) * r, h, Math.sin(a) * r] : [Math.cos(a) * r, Math.sin(a) * r, h]);
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, h0] = prof[i];
    const [r1, h1] = prof[i + 1];
    for (let j = 0; j < n; j++) {
      const a0 = (j / n) * Math.PI * 2;
      const a1 = ((j + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const nrm: V3 = achse === 'y' ? [Math.cos(am), (r0 - r1) * 0.5, Math.sin(am)] : [Math.cos(am), Math.sin(am), (r0 - r1) * 0.5];
      quadN(b, pt(r0, h0, a0), pt(r0, h0, a1), pt(r1, h1, a1), pt(r1, h1, a0), nrm, farbe(i, j));
    }
  }
}

/** Fügt mehrere Geometrien aus dem MeshBuilder (ohne Index, mit Farbe) zu einer zusammen. */
function verbinde(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const g of geos) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    const c = g.getAttribute('color');
    pos.set(p.array as Float32Array, o * 3);
    col.set(c.array as Float32Array, o * 3);
    o += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

/** Klötzchen-Schrift (5×5) für die Tafel am Hangar. */
const SCHRIFT: Record<string, string[]> = {
  W: ['1...1', '1...1', '1.1.1', '1.1.1', '.1.1.'],
  E: ['11111', '1....', '1111.', '1....', '11111'],
  R: ['1111.', '1...1', '1111.', '1..1.', '1...1'],
  F: ['11111', '1....', '1111.', '1....', '1....'],
  T: ['11111', '..1..', '..1..', '..1..', '..1..'],
};

// --- Wolkenwerft -------------------------------------------------------------------

export function buildWolkenLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const lines = detail > 0; // Konturen an großen Teilen
  const fine = detail === 2; // Konturen auch an Kleinteilen
  const rnd = seeded(9100 + t.index * 37);
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const SEA = th.liquidY ?? 9;
  const cx = world.center.x;
  const cz = world.center.z;
  const cDeck = rgb(th.deck);
  const cDeckD = rgb(th.deckDark);
  const cPfeiler = rgb(th.pillar);
  const cWolke = rgb(th.clouds);
  const cWolkeS = rgb(th.cloudShade);

  let maxPy = -Infinity;
  for (let i = 0; i < t.total; i++) maxPy = Math.max(maxPy, t.py[i]);

  /** Punkt neben Abschnitt i: seitlich lat (rechts positiv), längs along, Höhe py + dy. */
  const P = (i: number, lat: number, along: number, dy: number): V3 => [
    t.px[i] + rightX(t, i) * lat + t.tx[i] * along,
    t.py[i] + dy,
    t.pz[i] + rightZ(t, i) * lat + t.tz[i] * along,
  ];
  /** Wie P, aber mit Querneigung – so wie world.ts Fahrbahn und Tunnel baut. */
  const PB = (i: number, lat: number, dy: number): V3 => [t.px[i] + rightX(t, i) * lat, t.py[i] + lat * t.bank[i] + dy, t.pz[i] + rightZ(t, i) * lat];
  /** +1, wenn rechts von Abschnitt i nach außen (weg von der Mitte) zeigt. */
  const aussen = (i: number): number => (rightX(t, i) * (t.px[i] - cx) + rightZ(t, i) * (t.pz[i] - cz) >= 0 ? 1 : -1);
  /** Drehung um die Hochachse, die lokales +z auf die Fahrtrichtung von Abschnitt i legt (lokales +x zeigt dann nach links). */
  const yawAt = (i: number): number => Math.atan2(t.tx[i], t.tz[i]);

  /**
   * Ist der Raum frei? Waagerecht mindestens 3 m (plus r) von jeder Fahrbahn
   * und jedem Flugkorridor – außer ganz darunter (unter py − 2) oder hoch
   * darüber (über py + 22).
   */
  const luftFrei = (x: number, z: number, r: number, yBot: number, yTop: number): boolean => {
    for (let k = 0; k < t.total; k++) {
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k];
      if (d >= r + 3) continue;
      if (yTop < t.py[k] - 2) continue;
      if (yBot > t.py[k] + 22) continue;
      return false;
    }
    return true;
  };
  /**
   * Höchster erlaubter Punkt einer Wolke mit Radius r an (x, z): 8 m unter der
   * tiefsten Fahrbahn bzw. Ideallinie im Umkreis von 120 m. Infinity = weit
   * draußen, dort dürfen Türme wachsen.
   */
  const wolkenDach = (x: number, z: number, r: number): number => {
    let lim = Infinity;
    for (let k = 0; k < t.total; k++) {
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k] - r;
      if (d < 120 && t.py[k] - 8 < lim) lim = t.py[k] - 8;
    }
    return lim;
  };

  // --- Unbewegte Werft: alles in ein Netz ---------------------------------------------
  const teile: THREE.BufferGeometry[] = [];
  const setzeQ = new THREE.Quaternion();
  const setzeM = new THREE.Matrix4();
  /** Lokal gebautes Stück an seinen Platz drehen (um die Hochachse) und verschieben. */
  const setze = (b: MeshBuilder, x: number, y: number, z: number, yaw: number): void => {
    if (b.empty) return;
    const g = b.build();
    setzeQ.setFromAxisAngle(UP, yaw);
    setzeM.compose(tmpV.set(x, y, z), setzeQ, EINS);
    g.applyMatrix4(setzeM);
    teile.push(g);
  };
  const welt = new MeshBuilder(); // direkt in Weltkoordinaten Gebautes

  // --- Kleinteile (Quader-Instanzen) und Leuchten: Plätze vorab vergeben -------------
  const kFarbe: number[] = [];
  const kiste = (hex: number): number => {
    kFarbe.push(hex);
    return kFarbe.length - 1;
  };
  const lFarbe: number[] = [];
  const lampe = (hex: number): number => {
    lFarbe.push(hex);
    return lFarbe.length - 1;
  };

  // Rotoren unter schwebenden Plattformen: x, y, z, Radius, Phase, erstes Blatt.
  const rotoren: number[] = [];
  /** Gondel mit Rotor unter einer Plattform (lokal, Boden der Plattform bei y0). */
  const rotorGondel = (b: MeshBuilder, x: number, y0: number, z: number): void => {
    b.box(x, y0 - 1.2, z, 0.5, 2.4, 0.5, C_NAVY);
    b.box(x, y0 - 2.9, z, 1.6, 1.2, 1.6, C_ALU_D, 0, C_ALU);
    b.box(x, y0 - 3.7, z, 0.4, 0.5, 0.4, C_DUNKEL);
  };
  const rotorWelt = (x: number, y: number, z: number, r: number): void => {
    rotoren.push(x, y, z, r, rnd() * 6, kiste(0x2a2733));
    kiste(0x2a2733);
  };

  // Signalmasten: Lampenplatz und Windsack (Abschnitt, Mastspitze)
  const masten: { x: number; y: number; z: number; lampe: number; phase: number }[] = [];
  const windsaecke: { x: number; y: number; z: number; k0: number; phase: number }[] = [];

  /**
   * Signalmast auf einer Plattform (Fuß bei x, y, z): rot-weiß geringelt, oben ein
   * Querträger in Richtung yaw mit Blinklicht, wahlweise mit Windsack am Ende.
   */
  const signalmast = (x: number, y: number, z: number, yaw: number, h: number, mitSack: boolean): void => {
    // Querträger reicht 3 m hinaus, der Windsack flattert bis gut 6 m um seine Öse
    if (!luftFrei(x, z, mitSack ? 7.5 : 3.2, y, y + h + 1)) return;
    const b = new MeshBuilder();
    const h0 = h - 8;
    b.box(0, 0.3, 0, 1.4, 0.6, 1.4, C_NAVY);
    b.box(0, h0 / 2, 0, 0.6, h0, 0.6, cPfeiler);
    for (let k = 0; k < 4; k++) b.box(0, h0 + 1 + k * 2, 0, 0.55, 2, 0.55, k % 2 === 0 ? C_ROT : C_CREME);
    b.box(0, h - 0.4, 1.2, 0.3, 0.3, 3.2, C_NAVY);
    b.box(0, h + 0.3, 0, 0.9, 0.6, 0.9, C_NAVY);
    setze(b, x, y, z, yaw);
    masten.push({ x, y: y + h + 0.8, z, lampe: lampe(0xff3b30), phase: rnd() * 6 });
    if (mitSack) {
      const k0 = kiste(0xe8483f);
      kiste(0xffffff);
      kiste(0xe8483f);
      windsaecke.push({ x: x + Math.sin(yaw) * 2.7, y: y + h - 0.4, z: z + Math.cos(yaw) * 2.7, k0, phase: rnd() * 6 });
    }
  };
  /** Lokaler Punkt (lx, ly, lz) eines um yaw gedrehten Stücks bei c in Weltlage. */
  const welt3 = (c: V3, yaw: number, lx: number, ly: number, lz: number): V3 => {
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    return [c[0] + lx * cs + lz * sn, c[1] + ly, c[2] - lx * sn + lz * cs];
  };

  /** Decke einer Plattform: Bohlenstreifen oben, dunkler Rahmen (lokal, Oberkante y = 0). */
  const plattform = (b: MeshBuilder, sx: number, sz: number, dick = 1.2): void => {
    b.box(0, -dick / 2 - 0.02, 0, sx, dick, sz, cDeckD);
    const n = Math.max(2, Math.round(sx / 1.6));
    for (let k = 0; k < n; k++) {
      const x0 = -sx / 2 + (sx * k) / n;
      const x1 = -sx / 2 + (sx * (k + 1)) / n;
      b.quad([x0, 0.01, sz / 2], [x1, 0.01, sz / 2], [x1, 0.01, -sz / 2], [x0, 0.01, -sz / 2], k % 2 === 0 ? cDeck : shade(cDeck, 0.92));
    }
  };
  /** Pfeiler von der Unterkante einer Plattform hinab ins Wolkenmeer (lokal; baseY = Weltlage von y = 0). */
  const pfeiler = (b: MeshBuilder, x: number, z: number, baseY: number, dick = 1.1): void => {
    const unten = SEA - 1.5 - baseY;
    const oben = -1.2;
    b.box(x, (oben + unten) / 2, z, dick, oben - unten, dick, cPfeiler);
  };
  /** Gasflaschen: stehende Bündel in bunten Farben. */
  const gasflaschen = (b: MeshBuilder, x: number, z: number, nx: number, nz: number): void => {
    const farben = [rgb(0x3f9a7a), rgb(0x4f7bd8), C_ROT, C_GELB];
    for (let a = 0; a < nx; a++) {
      for (let c = 0; c < nz; c++) {
        const f = farben[(a * 3 + c) % farben.length];
        zylinder(b, x + a * 0.9, 1.0, z + c * 0.9, 0.4, 2.0, f, 6);
        b.box(x + a * 0.9, 2.15, z + c * 0.9, 0.3, 0.3, 0.3, C_DUNKEL);
      }
    }
  };
  /** Seilwinde: Trommel auf Bock, Seil läuft ein Stück weg. */
  const seilwinde = (b: MeshBuilder, x: number, z: number): void => {
    b.box(x, 0.5, z, 2.6, 1.0, 1.6, C_NAVY);
    const g = new THREE.CylinderGeometry(0.75, 0.75, 2.2, 8);
    tmpM.compose(tmpV.set(x, 1.6, z), tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), EINS);
    b.add(g, C_SEIL, tmpM);
    g.dispose();
    b.box(x - 1.25, 1.6, z, 0.2, 1.8, 1.2, C_GELB);
    b.box(x + 1.25, 1.6, z, 0.2, 1.8, 1.2, C_GELB);
  };

  // --- 1. Hellingen neben der Start-/Zielgeraden --------------------------------------
  const RUMPF_R = 7;
  const RUMPF_L = 54;
  /** Rumpfgerippe längs z um (0, yc, 0): Spanten, Längsträger, Kiel, vorn teils beplankt. */
  const rumpf = (b: MeshBuilder, yc: number, beplankt: number): void => {
    const N = 8;
    const RIBS = 8;
    const prof = (u: number): number => RUMPF_R * Math.pow(Math.max(0, 1 - 4 * u * u), 0.45);
    const ang = (j: number): number => -Math.PI / 2 + (j / N) * Math.PI * 2;
    const pt = (r: number, j: number, z: number): V3 => [Math.cos(ang(j)) * r, yc + Math.sin(ang(j)) * r, z];
    const us: number[] = [];
    for (let k = 0; k < RIBS; k++) us.push(-0.42 + (0.84 * k) / (RIBS - 1));
    // Spanten
    for (const u of us) {
      const r = prof(u);
      const z = u * RUMPF_L;
      for (let j = 0; j < N; j++) {
        const am = (ang(j) + ang(j + 1)) / 2;
        const nr: V3 = [Math.cos(am), Math.sin(am), 0];
        const ro = r + 0.2;
        const ri = r - 0.2;
        quadN(b, pt(ro, j, z - 0.25), pt(ro, j + 1, z - 0.25), pt(ro, j + 1, z + 0.25), pt(ro, j, z + 0.25), nr, C_ALU);
        quadN(b, pt(ri, j, z - 0.25), pt(ri, j + 1, z - 0.25), pt(ri, j + 1, z + 0.25), pt(ri, j, z + 0.25), [-nr[0], -nr[1], 0], C_ALU_D);
        quadN(b, pt(ri, j, z + 0.25), pt(ri, j + 1, z + 0.25), pt(ro, j + 1, z + 0.25), pt(ro, j, z + 0.25), [0, 0, 1], C_ALU);
        quadN(b, pt(ri, j, z - 0.25), pt(ri, j + 1, z - 0.25), pt(ro, j + 1, z - 0.25), pt(ro, j, z - 0.25), [0, 0, -1], C_ALU);
      }
    }
    // Längsträger (jeder zweite Eckpunkt) und Kiel, an den Enden zur Spitze
    const tipA: V3 = [0, yc, -0.5 * RUMPF_L];
    const tipB: V3 = [0, yc, 0.5 * RUMPF_L];
    for (let j = 0; j < N; j += 2) {
      const dick = j === 0 ? 0.6 : 0.3;
      const c = j === 0 ? C_NAVY : C_ALU_D;
      stab(b, tipA, pt(prof(us[0]), j, us[0] * RUMPF_L), dick, c);
      for (let k = 0; k < RIBS - 1; k++) stab(b, pt(prof(us[k]), j, us[k] * RUMPF_L), pt(prof(us[k + 1]), j, us[k + 1] * RUMPF_L), dick, c);
      stab(b, pt(prof(us[RIBS - 1]), j, us[RIBS - 1] * RUMPF_L), tipB, dick, c);
    }
    // Beplankung: vorn (große z) die letzten Felder, mit Lücken, rote Binde am Bug
    for (let k = RIBS - 1 - beplankt; k < RIBS - 1; k++) {
      if (k < 0) continue;
      for (let j = 0; j < N; j++) {
        if ((j * 3 + k) % 7 === 0) continue;
        const r0 = prof(us[k]) + 0.24;
        const r1 = prof(us[k + 1]) + 0.24;
        const z0 = us[k] * RUMPF_L;
        const z1 = us[k + 1] * RUMPF_L;
        const am = (ang(j) + ang(j + 1)) / 2;
        const nr: V3 = [Math.cos(am), Math.sin(am), 0];
        const c = k === RIBS - 2 ? C_ROT : j % 2 === 0 ? C_CREME : shade(C_CREME, 0.94);
        quadN(b, pt(r0, j, z0), pt(r0, j + 1, z0), pt(r1, j + 1, z1), pt(r1, j, z1), nr, c);
        quadN(b, pt(r0 - 0.08, j, z0), pt(r0 - 0.08, j + 1, z0), pt(r1 - 0.08, j + 1, z1), pt(r1 - 0.08, j, z1), [-nr[0], -nr[1], 0], shade(c, 0.6));
      }
    }
  };

  const gantryLampen: { x: number; y: number; z: number; l: number }[] = [];
  {
    // Zwei Hellingen außen an der Geraden, dazu ein Lager innen.
    const hellingen: [number, number][] = [
      [48, 0],
      [128, 3],
    ];
    for (const [i0, beplankt] of hellingen) {
      const o = aussen(i0);
      const latC = t.wh[i0] + 7 + 14;
      const W = 28;
      const L = 64;
      // Platz prüfen (sonst weiter hinaus)
      let lat = latC;
      for (let k = 0; k < 10; k++) {
        const p = P(i0, o * lat, 0, 0);
        let ok = true;
        for (let s = -1; s <= 1 && ok; s++) {
          const q = P(i0, o * (lat - W / 2 + 0.5), s * (L / 2 - 1), 0);
          if (!luftFrei(q[0], q[2], 0.5, t.py[i0] - 3, t.py[i0] + 22)) ok = false;
        }
        if (ok && luftFrei(p[0], p[2], 0, t.py[i0] - 3, t.py[i0] + 22)) break;
        lat += 2;
      }
      const c = P(i0, o * lat, 0, -0.6);
      const b = new MeshBuilder();
      const sx = -o; // lokales x, das nach außen zeigt
      plattform(b, W, L);
      for (const x of [-W / 2 + 1.5, W / 2 - 1.5]) for (const z of [-L / 2 + 4, 0, L / 2 - 4]) pfeiler(b, x, z, c[1], 1.3);
      // Ablaufbahn (Schienen) und Pallen
      for (const x of [-2.6, 2.6]) b.box(x, 0.2, 0, 0.5, 0.4, L - 4, C_DUNKEL);
      for (const z of [-19, -7, 7, 19]) {
        b.box(0, 1.2, z, 6.5, 0.8, 1.2, cDeckD);
        b.box(-2.4, 2.0, z, 1.2, 1.2, 1.2, cDeckD);
        b.box(2.4, 2.0, z, 1.2, 1.2, 1.2, cDeckD);
      }
      rumpf(b, 9.5, beplankt);
      // Portalkran über dem Rumpf
      for (const z of [-12, 15]) {
        for (const x of [-RUMPF_R - 3, RUMPF_R + 3]) {
          b.box(x, 10.5, z, 0.9, 21, 0.9, C_GELB);
          b.box(x, 0.3, z, 1.8, 0.6, 2.4, C_NAVY);
        }
        b.box(0, 21.2, z, 2 * RUMPF_R + 7.5, 1.2, 1.4, C_GELB_D, 0, C_GELB);
        b.box(1.5, 20.0, z, 1.6, 1.4, 1.8, C_NAVY);
        stab(b, [1.5, 19.3, z], [1.5, 17.2, z], 0.12, C_DUNKEL);
        const lp = new THREE.Vector3(sx * (RUMPF_R + 3), 22.2, z);
        gantryLampen.push({ x: lp.x, y: lp.y, z: lp.z, l: 0 });
      }
      // Gerüst außen: zwei Pfostenreihen, drei Laufstege mit Geländer, Streben
      const gx0 = sx * (RUMPF_R + 1.6);
      const gx1 = sx * (RUMPF_R + 4.4);
      for (let z = -24; z <= 24; z += 8) {
        b.box(gx0, 8.5, z, 0.3, 17, 0.3, C_ALU_D);
        b.box(gx1, 8.5, z, 0.3, 17, 0.3, C_ALU_D);
      }
      for (const y of [5.5, 11, 16.5]) {
        b.box((gx0 + gx1) / 2, y, 0, 3.0, 0.25, 50, cDeck, 0, shade(cDeck, 1.05));
        b.box(gx1, y + 1.0, 0, 0.12, 0.12, 48, C_ROT);
      }
      for (let z = -24; z < 24; z += 16) stab(b, [gx1, 0.2, z], [gx1, 11, z + 8], 0.18, C_ALU_D);
      // Gerüst zur Fahrbahn hin: niedrig, ein Laufsteg
      const gi = -sx * (RUMPF_R + 1.8);
      for (let z = -16; z <= 16; z += 8) b.box(gi, 3.5, z, 0.3, 7, 0.3, C_ALU_D);
      b.box(gi, 6.5, 0, 2.0, 0.25, 34, cDeck);
      // Gasflaschen und Winde auf dem Platz
      gasflaschen(b, sx * (W / 2 - 3.5), -L / 2 + 3, 3, 2);
      seilwinde(b, sx * (W / 2 - 3), L / 2 - 4);
      const yaw = yawAt(i0);
      // Gantry-Lampen in Weltlage umrechnen
      setzeQ.setFromAxisAngle(UP, yaw);
      for (const g of gantryLampen) {
        if (g.l !== 0) continue;
        tmpV.set(g.x, g.y, g.z).applyQuaternion(setzeQ);
        g.x = tmpV.x + c[0];
        g.y = tmpV.y + c[1];
        g.z = tmpV.z + c[2];
        g.l = lampe(0xff9a1f) + 1;
      }
      setze(b, c[0], c[1], c[2], yaw);
      {
        const m = welt3(c, yaw, sx * (W / 2 - 1.2), 0, -L / 2 + 1.2);
        signalmast(m[0], m[1], m[2], Math.atan2(Math.cos(yaw) * sx, -Math.sin(yaw) * sx), 15, beplankt === 0);
      }
    }
    for (const g of gantryLampen) g.l -= 1;

    // Lagerinsel innen an der Geraden: Gasflaschen, Winde, getragen von zwei Rotoren
    const i1 = 92;
    const o = -aussen(i1);
    let lat = t.wh[i1] + 3 + 9;
    let p = P(i1, o * lat, 0, -0.4);
    for (let k = 0; k < 10 && !luftFrei(p[0], p[2], 9, t.py[i1] - 6, t.py[i1] + 4); k++) {
      lat += 2;
      p = P(i1, o * lat, 0, -0.4);
    }
    const b = new MeshBuilder();
    plattform(b, 12, 16, 1.0);
    gasflaschen(b, -4.4, -6.5, 3, 2);
    gasflaschen(b, 2.4, 3.5, 2, 2);
    seilwinde(b, 2.5, -4.5);
    b.box(-3, 1.0, 5, 2.4, 2.0, 2.4, C_TUERKIS);
    b.box(-3, 2.6, 5.4, 1.6, 1.2, 1.6, C_GELB);
    rotorGondel(b, -3.5, -1.0, 0);
    rotorGondel(b, 3.5, -1.0, 0);
    const yaw = yawAt(i1);
    setze(b, p[0], p[1], p[2], yaw);
    {
      const m = welt3(p, yaw, 4.8, 0, 6.8);
      signalmast(m[0], m[1], m[2], Math.atan2(rightX(t, i1) * o, rightZ(t, i1) * o), 11, true);
    }
    setzeQ.setFromAxisAngle(UP, yaw);
    for (const x of [-3.5, 3.5]) {
      tmpV.set(x, -4.1, 0).applyQuaternion(setzeQ);
      rotorWelt(p[0] + tmpV.x, p[1] + tmpV.y, p[2] + tmpV.z, 3.4);
    }
  }

  // --- 1b. Gaswerk innen an der Wendelrampe: Gasbehälter füllen die Tragzellen ----
  {
    const i1 = Math.min(t.n - 1, 290);
    const o = -aussen(i1);
    let lat = t.wh[i1] + 3 + 12;
    let p = P(i1, o * lat, 0, -4);
    for (let k = 0; k < 14 && !luftFrei(p[0], p[2], 10, p[1] - 4, p[1] + 20); k++) {
      lat += 2;
      p = P(i1, o * lat, 0, -4);
    }
    if (luftFrei(p[0], p[2], 10, p[1] - 4, p[1] + 20)) {
      const b = new MeshBuilder();
      zylinder(b, 0, -0.6, 0, 9, 1.2, cDeckD, 8);
      zylinder(b, 0, 0.02, 0, 8.6, 0.04, cDeck, 8);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        pfeiler(b, Math.cos(a) * 6.5, Math.sin(a) * 6.5, p[1], 1.2);
      }
      // Zwei Gasbehälter: Trommeln mit Kuppel, Ringe und Leiter
      for (const [gx, gz, r, h] of [
        [-2.6, -1.2, 3.6, 11],
        [4.4, 2.6, 2.6, 7.5],
      ]) {
        zylinder(b, gx, h / 2, gz, r, h, C_ALU, 10);
        zylinder(b, gx, h * 0.62, gz, r + 0.12, 0.9, C_ROT, 10);
        zylinder(b, gx, h * 0.25, gz, r + 0.12, 0.5, C_NAVY, 10);
        const kuppel = new THREE.SphereGeometry(r, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2);
        tmpM.compose(tmpV.set(gx, h, gz), tmpQ.identity(), tmpS.set(1, 0.45, 1));
        b.add(kuppel, C_ALU_D, tmpM);
        kuppel.dispose();
        stab(b, [gx + r + 0.3, 0, gz - 0.35], [gx + r + 0.3, h, gz - 0.35], 0.12, C_DUNKEL);
        stab(b, [gx + r + 0.3, 0, gz + 0.35], [gx + r + 0.3, h, gz + 0.35], 0.12, C_DUNKEL);
      }
      // Rohrleitung zum Rand, Seilwinde
      stab(b, [-2.6, 1.2, -4.8], [-2.6, 1.2, -8.2], 0.6, C_GELB);
      stab(b, [-2.6, 1.2, -8.2], [-2.6, -3.5, -8.2], 0.6, C_GELB);
      seilwinde(b, 3.5, -4.5);
      const yaw = Math.atan2(rightX(t, i1) * o, rightZ(t, i1) * o);
      setze(b, p[0], p[1], p[2], yaw);
      const m = welt3(p, yaw, -6.2, 0, 3.5);
      signalmast(m[0], m[1], m[2], yaw, 16, true);
    }
  }

  // --- 2. Hangar um den Tunnel -----------------------------------------------------
  const hangarLampen: number[] = []; // x, y, z, Lampenplatz
  {
    let a = -1;
    let e = -1;
    for (let i = 0; i < t.n; i++) {
      if (t.edge[i] & EDGE_TUNNEL) {
        if (a < 0) a = i;
        e = i;
      }
    }
    if (a >= 0) {
      const cWall = rgb(0xe9eef6);
      const cRoof = rgb(0x8fa3bd);
      const HP: [number, number][] = [
        [-13, -3],
        [-13, 9.5],
        [-7, 13.5],
        [0, 14.5],
        [7, 13.5],
        [13, 9.5],
        [13, -3],
      ];
      const ringe: number[] = [];
      for (let i = a; i < e; i += 3) ringe.push(i);
      ringe.push(e);
      const nrm = (i: number, k: number): V3 => {
        const dl = HP[k + 1][0] - HP[k][0];
        const dh = HP[k + 1][1] - HP[k][1];
        const nl = -dh;
        const nh = dl;
        return [rightX(t, i) * nl, nh, rightZ(t, i) * nl];
      };
      for (let r = 0; r < ringe.length - 1; r++) {
        const i = ringe[r];
        const j = ringe[r + 1];
        for (let k = 0; k < HP.length - 1; k++) {
          const wand = k === 0 || k === HP.length - 2;
          const c = wand ? (r % 2 === 0 ? cWall : shade(cWall, 0.95)) : r % 2 === 0 ? cRoof : shade(cRoof, 0.88);
          quadN(welt, PB(i, HP[k][0], HP[k][1]), PB(i, HP[k + 1][0], HP[k + 1][1]), PB(j, HP[k + 1][0], HP[k + 1][1]), PB(j, HP[k][0], HP[k][1]), nrm(i, k), c);
        }
        // Boden
        quadN(welt, PB(i, -13, -3), PB(i, 13, -3), PB(j, 13, -3), PB(j, -13, -3), [0, -1, 0], cDeckD);
        // Rotes Band und Traufe
        for (const s of [-1, 1]) {
          const n: V3 = [rightX(t, i) * s, 0, rightZ(t, i) * s];
          quadN(welt, PB(i, s * 13.08, 6.2), PB(i, s * 13.08, 7.6), PB(j, s * 13.08, 7.6), PB(j, s * 13.08, 6.2), n, C_ROT);
          quadN(welt, PB(i, s * 13.6, 9.2), PB(i, s * 13.6, 10.0), PB(j, s * 13.6, 10.0), PB(j, s * 13.6, 9.2), n, C_NAVY);
          quadN(welt, PB(i, s * 13.0, 10.0), PB(i, s * 13.6, 10.0), PB(j, s * 13.6, 10.0), PB(j, s * 13.0, 10.0), [0, 1, 0], C_NAVY);
          quadN(welt, PB(i, s * 13.0, 9.2), PB(i, s * 13.6, 9.2), PB(j, s * 13.6, 9.2), PB(j, s * 13.0, 9.2), [0, -1, 0], C_NAVY);
        }
      }
      // Stirnseiten: Fläche zwischen dem Tunnelmantel (wie world.ts) und dem Umriss der Halle
      const H = 7.4;
      const OUT: [number, number, number][] = [
        [-1, 1, -1.4],
        [-1, 1, 0.52 * H],
        [-1, 1.5, 0.84 * H + 0.45],
        [-0.5, 0.6, 0.97 * H + 0.85],
        [0, 0, 1.04 * H + 0.95],
        [0.5, 0.6, 0.97 * H + 0.85],
        [1, 1.5, 0.84 * H + 0.45],
        [1, 1, 0.52 * H],
        [1, 1, -1.4],
      ];
      const AUSSEN: [number, number][] = [
        [-13, -3],
        [-13, 0.52 * H],
        [-13, 9.5],
        [-7, 13.5],
        [0, 14.5],
        [7, 13.5],
        [13, 9.5],
        [13, 0.52 * H],
        [13, -3],
      ];
      for (const [i, s] of [
        [a, -1],
        [e, 1],
      ] as const) {
        const W = t.wh[i] + 0.5 + 0.25;
        const inn: V3[] = OUT.map(([f, m, h]) => PB(i, f * W + Math.sign(f) * m * 0.9, h));
        const aus: V3[] = AUSSEN.map(([l, h]) => PB(i, l, h));
        const n: V3 = [t.tx[i] * s, 0, t.tz[i] * s];
        for (let k = 0; k < 8; k++) quadN(welt, aus[k], aus[k + 1], inn[k + 1], inn[k], n, k === 1 || k === 6 ? C_ROT : shade(cWall, 0.9));
        quadN(welt, aus[8], aus[0], inn[0], inn[8], n, cDeckD);
        // Lampen auf den Giebeln
        const g = PB(i, 0, 15.2);
        hangarLampen.push(g[0], g[1], g[2], lampe(0xff3b30));
      }
      // Tafel mit Schriftzug über der Einfahrt (zum ankommenden Fahrer)
      {
        const i = a;
        const rot = Math.atan2(-rightZ(t, i), rightX(t, i));
        const px = 0.5;
        const text = 'WERFT';
        const breite = text.length * 5 * px + (text.length - 1) * px;
        const vorn = (along: number, lat: number, dy: number): V3 => {
          const q = PB(i, lat, dy);
          return [q[0] - t.tx[i] * along, q[1], q[2] - t.tz[i] * along];
        };
        const m = vorn(0.25, 0, 10.75);
        welt.box(m[0], m[1], m[2], breite + 1.6, 3.6, 0.4, C_NAVY, rot);
        for (let li = 0; li < text.length; li++) {
          const rows = SCHRIFT[text[li]];
          const x0 = -breite / 2 + li * 6 * px;
          for (let r = 0; r < 5; r++) {
            // Waagerechte Läufe zu einem Klötzchen zusammenfassen
            let c = 0;
            while (c < 5) {
              if (rows[r][c] !== '1') {
                c++;
                continue;
              }
              let c2 = c;
              while (c2 + 1 < 5 && rows[r][c2 + 1] === '1') c2++;
              const lat = x0 + ((c + c2 + 1) / 2) * px;
              const q = vorn(0.5, lat, 10.75 + (2 - r) * px);
              welt.box(q[0], q[1], q[2], (c2 - c + 1) * px, px, 0.25, rgb(0xffd23f), rot);
              c = c2 + 1;
            }
          }
        }
      }
      // Große Schiebetore an beiden Längsseiten
      {
        const i = Math.round((a + e) / 2);
        const rot = Math.atan2(-rightZ(t, i), rightX(t, i));
        for (const s of [-1, 1]) {
          for (const d of [-7.5, 7.5]) {
            const q = P(i, s * 13.3, d, 2.8);
            welt.box(q[0], q[1], q[2], 0.4, 11, 14, C_NAVY, rot);
            for (let k = -2; k <= 2; k++) {
              const r = P(i, s * 13.55, d + k * 2.6, 2.8);
              welt.box(r[0], r[1], r[2], 0.2, 10, 0.35, C_ALU_D, rot);
            }
            const r = P(i, s * 13.55, d, 7.6);
            welt.box(r[0], r[1], r[2], 0.25, 1.0, 13.4, C_GELB, rot);
          }
        }
        // Pfeiler unter der Halle
        for (const ii of [a + 4, i, e - 4]) {
          for (const s of [-1, 1]) {
            const q = P(ii, s * 11.5, 0, -3);
            welt.box(q[0], (q[1] + SEA - 1.5) / 2, q[2], 1.6, q[1] - SEA + 1.5, 1.6, cPfeiler, rot);
          }
        }
      }
      // Anbau unter dem Hangardach-Steg bis zum Absprung: die Fahrbahn liegt auf seinem Dach
      {
        let f = e;
        while (f + 1 < t.n && !(t.edge[f + 1] & EDGE_GLIDE) && f < e + 60) f++;
        f -= 4;
        if (f > e + 8) {
          const r2: number[] = [];
          for (let i = e; i < f; i += 4) r2.push(i);
          r2.push(f);
          const prof: [number, number][] = [
            [-8.0, -2.0],
            [-8.0, -13],
            [8.0, -13],
            [8.0, -2.0],
          ];
          for (let r = 0; r < r2.length - 1; r++) {
            const i = r2[r];
            const j = r2[r + 1];
            for (let k = 0; k < 3; k++) {
              const n: V3 = k === 1 ? [0, -1, 0] : [rightX(t, i) * (k === 0 ? -1 : 1), 0, rightZ(t, i) * (k === 0 ? -1 : 1)];
              quadN(welt, PB(i, prof[k][0], prof[k][1]), PB(i, prof[k + 1][0], prof[k + 1][1]), PB(j, prof[k + 1][0], prof[k + 1][1]), PB(j, prof[k][0], prof[k][1]), n, k === 1 ? cDeckD : r % 2 === 0 ? rgb(0xe9eef6) : rgb(0xdde4ee));
            }
          }
          for (const [i, s] of [
            [e, -1],
            [f, 1],
          ] as const) {
            const n: V3 = [t.tx[i] * s, 0, t.tz[i] * s];
            quadN(welt, PB(i, -8.0, -2.0), PB(i, 8.0, -2.0), PB(i, 8.0, -13), PB(i, -8.0, -13), n, s < 0 ? shade(rgb(0xe9eef6), 0.85) : C_ROT);
          }
          // Tore an den Seiten des Anbaus
          const m = Math.round((e + f) / 2);
          const rot = Math.atan2(-rightZ(t, m), rightX(t, m));
          for (const s of [-1, 1]) {
            const q = P(m, s * 8.15, 0, -7.6);
            welt.box(q[0], q[1], q[2], 0.35, 8.5, Math.min(14, (f - e) * 0.6), C_ROT, rot);
            const q2 = P(m, s * 8.35, 0, -7.6);
            welt.box(q2[0], q2[1], q2[2], 0.2, 0.5, Math.min(14, (f - e) * 0.6) - 1, C_CREME, rot);
          }
          // Rotoren unter dem Anbau
          for (const ii of [e + 6, f - 4]) {
            const q = P(ii, 0, 0, -13);
            welt.box(q[0], q[1] - 1.2, q[2], 0.6, 2.4, 0.6, C_NAVY);
            welt.box(q[0], q[1] - 2.9, q[2], 2.2, 1.4, 2.2, C_ALU_D, 0, C_ALU);
            rotorWelt(q[0], q[1] - 4.0, q[2], 4.2);
          }
        }
      }
    }
  }

  // --- 3. Ballonhafen an der weiten Linkskurve --------------------------------------
  // Ankermast mit Luftschiff, Kran auf einer Kaiplattform, vertäute Ballone.
  const iH = 740 < t.n ? 740 : Math.floor(t.n * 0.5);
  const oH = aussen(iH);
  const hyaw = yawAt(iH);
  /** Hafen-Rahmen: lat nach außen, along in Fahrtrichtung. */
  const H = (lat: number, along: number, dy: number): V3 => P(iH, oH * lat, along, dy);
  const MAST_H = 19;
  const mastBase = H(42, 0, -0.6);
  const mastTop: V3 = [mastBase[0], mastBase[1] + MAST_H + 0.6, mastBase[2]];
  // Richtung vom Mast nach außen (dorthin liegt das Schiff)
  const outX = rightX(t, iH) * oH;
  const outZ = rightZ(t, iH) * oH;
  {
    const b = new MeshBuilder();
    zylinder(b, 0, -0.6, 0, 6.2, 1.2, cDeckD, 8);
    zylinder(b, 0, 0.02, 0, 5.9, 0.04, cDeck, 8);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      pfeiler(b, Math.cos(a) * 3.8, Math.sin(a) * 3.8, mastBase[1], 1.2);
    }
    // Gittermast: vier Beine, Ringe, Leiter
    const fuss = 2.4;
    const kopf = 0.8;
    const ecken: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (const [ex, ez] of ecken) stab(b, [ex * fuss, 0, ez * fuss], [ex * kopf, MAST_H, ez * kopf], 0.35, C_ROT);
    for (const y of [4.5, 9, 13.5]) {
      const w = fuss + (kopf - fuss) * (y / MAST_H);
      b.box(0, y, 0, 2 * w + 0.3, 0.3, 2 * w + 0.3, C_CREME);
    }
    for (let k = 0; k < 2; k++) stab(b, [ecken[k][0] * fuss, 0, ecken[k][1] * fuss], [ecken[(k + 1) % 4][0] * kopf * 2, 9, ecken[(k + 1) % 4][1] * kopf * 2], 0.18, C_CREME);
    // Leiter an der Fahrbahnseite
    const lz = -fuss - 0.4;
    stab(b, [-0.45, 0, lz], [-0.45, MAST_H - 1, -kopf - 0.4], 0.12, C_DUNKEL);
    stab(b, [0.45, 0, lz], [0.45, MAST_H - 1, -kopf - 0.4], 0.12, C_DUNKEL);
    for (let k = 1; k < 12; k++) {
      const f = k / 12;
      b.box(0, f * (MAST_H - 1), lz + (-kopf - 0.4 - lz) * f, 0.9, 0.1, 0.1, C_DUNKEL);
    }
    // Kopf mit Kupplung
    b.box(0, MAST_H + 0.3, 0, 2.4, 0.6, 2.4, C_NAVY);
    zylinder(b, 0, MAST_H + 0.9, 0, 0.6, 0.8, C_ALU, 6);
    // Seilwinde und Gasflaschen am Fuß
    seilwinde(b, 3.2, -3.2);
    // lokales +z zeigt nach außen (zum Schiff); die Leiter liegt fahrbahnseitig
    setze(b, mastBase[0], mastBase[1], mastBase[2], Math.atan2(outX, outZ));
  }
  const mastLampe = lampe(0xff3b30);

  // Kaiplattform mit Kran neben dem Schiff
  const KAI_LAT = 64;
  const KAI_ALONG = 22;
  const kai = H(KAI_LAT, KAI_ALONG, -0.6);
  const kranFuss = H(KAI_LAT - 2, KAI_ALONG - 5, -0.6);
  const KRAN_H = 27;
  const kranKopf: V3 = [kranFuss[0], kranFuss[1] + KRAN_H, kranFuss[2]];
  const stapel = H(KAI_LAT - 7, KAI_ALONG + 4, -0.6); // dort holt der Kran die Kisten
  {
    const b = new MeshBuilder();
    plattform(b, 18, 22, 1.2);
    for (const x of [-7.5, 7.5]) rotorGondel(b, x, -1.2, -6);
    for (const x of [-7.5, 7.5]) rotorGondel(b, x, -1.2, 6);
    // Kranturm (Gitter angedeutet durch abwechselnde Stücke)
    const kx = (kranFuss[0] - kai[0]) * 1;
    const kz = (kranFuss[2] - kai[2]) * 1;
    // in lokale Koordinaten (Drehung hyaw zurück)
    const cs = Math.cos(-hyaw);
    const sn = Math.sin(-hyaw);
    const lx = kx * cs + kz * sn;
    const lz = -kx * sn + kz * cs;
    b.box(lx, 0.6, lz, 4.0, 1.2, 4.0, rgb(0x9a958f));
    for (let k = 0; k < 5; k++) b.box(lx, 1.2 + k * 5.1 + 2.55, lz, 1.8, 5.1, 1.8, k % 2 === 0 ? C_GELB : C_GELB_D);
    const sx = stapel[0] - kai[0];
    const sz = stapel[2] - kai[2];
    const slx = sx * cs + sz * sn;
    const slz = -sx * sn + sz * cs;
    // Kistenstapel und Gasflaschen
    b.box(slx - 2.5, 1.0, slz, 2.2, 2.0, 2.2, C_TUERKIS);
    b.box(slx - 2.5, 3.0, slz, 2.0, 2.0, 2.0, C_ROT);
    b.box(slx + 2.4, 1.0, slz - 0.5, 2.2, 2.0, 2.2, C_GELB);
    gasflaschen(b, slx - 2, slz + 3, 3, 2);
    setze(b, kai[0], kai[1], kai[2], hyaw);
    {
      let best: V3 = kai;
      for (const lx of [-8, 8]) {
        for (const lz of [-10, 10]) {
          const m = welt3(kai, hyaw, lx, 0, lz);
          if (world.clearance(m[0], m[2]) > world.clearance(best[0], best[2]) && Math.hypot(m[0] - kranFuss[0], m[2] - kranFuss[2]) > 8) best = m;
        }
      }
      signalmast(best[0], best[1], best[2], Math.atan2(outX, outZ), 12, true);
    }
    setzeQ.setFromAxisAngle(UP, hyaw);
    for (const x of [-7.5, 7.5]) {
      for (const z of [-6, 6]) {
        tmpV.set(x, -4.3, z).applyQuaternion(setzeQ);
        rotorWelt(kai[0] + tmpV.x, kai[1] + tmpV.y, kai[2] + tmpV.z, 3.4);
      }
    }
  }
  const kranLampe = lampe(0xff3b30);
  const kran = {
    jib: kiste(0xffc72e),
    gegen: kiste(0xe0a21c),
    gewicht: kiste(0x9a958f),
    kabine: kiste(0xf7f2e4),
    katze: kiste(0x2a2733),
    seil: kiste(0x2a2733),
    haken: kiste(0xff5a4e),
    kiste: kiste(0x1fc8b6),
  };

  // Ballone: Ankerpunkt (x, y, z), Platz, Phase
  const ballonOrte: number[] = [];
  {
    const want = detail === 0 ? 3 : 5;
    const plan: [number, number, number][] = [
      [655, -1, 24],
      [705, 1, 26],
      [785, -1, 25],
      [835, 1, 24],
      [720, -1, 34],
      [810, 1, 30],
    ];
    for (const [i0, side, lat0] of plan) {
      if (ballonOrte.length >= want * 5 || i0 >= t.n) continue;
      const o = aussen(i0) * side;
      let lat = lat0;
      let p = P(i0, o * lat, 0, -0.5);
      // Hülle (Radius gut 5 m, schwankt 1,5 m) und Plattform frei halten
      for (let k = 0; k < 8 && !luftFrei(p[0], p[2], 7.5, p[1] - 6, p[1] + 24); k++) {
        lat += 2;
        p = P(i0, o * lat, 0, -0.5);
      }
      if (!luftFrei(p[0], p[2], 7.5, p[1] - 6, p[1] + 24)) continue;
      // Mit den Mastplätzen nicht ins Gehege kommen
      if (Math.hypot(p[0] - mastBase[0], p[2] - mastBase[2]) < 20 || Math.hypot(p[0] - kai[0], p[2] - kai[2]) < 26) continue;
      const b = new MeshBuilder();
      zylinder(b, 0, -0.5, 0, 3.6, 1.0, cDeckD, 8);
      zylinder(b, 0, 0.02, 0, 3.3, 0.04, cDeck, 8);
      // Kleiner Mast mit Leiter und Poller
      b.box(2.4, 3.0, 0, 0.4, 6, 0.4, C_ALU_D);
      b.box(2.4, 6.2, 0, 1.0, 0.4, 1.0, C_ROT);
      for (let k = 1; k < 6; k++) b.box(2.75, k, 0, 0.1, 0.1, 0.8, C_DUNKEL);
      b.box(0, 0.4, 0, 1.0, 0.8, 1.0, C_NAVY);
      rotorGondel(b, 0, -1.0, 0);
      setze(b, p[0], p[1], p[2], Math.atan2(rightX(t, i0) * o, rightZ(t, i0) * o));
      rotorWelt(p[0], p[1] - 4.1, p[2], 3.0);
      ballonOrte.push(p[0], p[1] + 0.8, p[2], 0, rnd() * 6);
    }
  }

  // --- Unbewegtes zusammenfassen ---------------------------------------------------
  if (!welt.empty) teile.push(welt.build());
  {
    const geo = verbinde(teile);
    const mesh = new THREE.Mesh(geo, toon);
    group.add(mesh);
    disposables.push(geo);
    if (lines) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(0.05));
      ol.name = 'outline';
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
    }
  }

  // --- 5. Wolkenhügel und -türme ----------------------------------------------------
  // Je Klecks: x, y, z, Radius, Stauchung (Höhe/Radius), Haufen
  const kl: number[] = [];
  const haufenPhase: number[] = [];
  {
    const want = detail === 0 ? 75 : 150;
    const haufen: number[] = []; // x, z, R
    const weit = world.radius + 280;
    let tuerme = 0;
    const n = (): number => kl.length / 6;
    for (let tries = 0; tries < 5000 && n() < want; tries++) {
      const Rc = 12 + rnd() * 16;
      let x: number;
      let z: number;
      if (rnd() < 0.75) {
        // Längs der Strecke, damit man die Hügel beim Fahren sieht (auch halb unter der Fahrbahn)
        const i = Math.floor(rnd() * t.total);
        const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + Rc * 0.2 + rnd() * 65);
        x = t.px[i] + rightX(t, i) * lat;
        z = t.pz[i] + rightZ(t, i) * lat;
      } else {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * weit;
        x = cx + Math.cos(a) * d;
        z = cz + Math.sin(a) * d;
      }
      let free = true;
      for (let q = 0; q < haufen.length && free; q += 3) if (Math.hypot(x - haufen[q], z - haufen[q + 1]) < (Rc + haufen[q + 2]) * 0.8) free = false;
      if (!free) continue;
      const lim = wolkenDach(x, z, Rc * 1.1);
      const turm = lim === Infinity;
      if (turm && tuerme >= 3) continue;
      const top = turm ? SEA + 55 + rnd() * 45 : Math.min(lim - 0.9, SEA + Rc * 0.75);
      if (top < SEA + 4) continue;
      const hp = haufen.length / 3;
      haufen.push(x, z, Rc);
      haufenPhase.push(rnd() * Math.PI * 2);
      if (turm) {
        tuerme++;
        // Quellwolke: unten drei breite Bäusche, darüber zwei, dann ein runder Kopf –
        // dicht überlappend, damit es ein Körper wird und kein Stapel.
        const R0 = Math.max(Rc, 22);
        const SY = 0.8;
        const stufen: [number, number][] = [
          [3, 1],
          [2, 0.84],
          [2, 0.7],
          [1, 0.62],
        ];
        for (let k = 0; k < stufen.length && n() < want; k++) {
          const [cnt, f] = stufen[k];
          const r = R0 * f;
          const y = k === stufen.length - 1 ? top - r * SY : SEA + R0 * 0.15 + ((top - R0 * 0.62 * SY - SEA - R0 * 0.15) * k) / (stufen.length - 1);
          const a0 = rnd() * Math.PI * 2;
          for (let c = 0; c < cnt && n() < want; c++) {
            const b2 = a0 + (c / cnt) * Math.PI * 2;
            const off = cnt > 1 ? r * 0.55 : 0;
            kl.push(x + Math.cos(b2) * off, y, z + Math.sin(b2) * off, r, SY, hp);
          }
        }
      } else {
        // Hügel: runder Hauptbausch, darum kleinere Bäusche in wechselnder Höhe – alle unter "top"
        const SY = 0.78;
        const r0 = Rc * 0.58;
        const y0 = top - r0 * SY;
        kl.push(x, y0, z, r0, SY, hp);
        const cnt = 3 + Math.floor(rnd() * 2);
        const a0 = rnd() * Math.PI * 2;
        for (let k = 0; k < cnt && n() < want; k++) {
          const b2 = a0 + (k / cnt) * Math.PI * 2 + rnd() * 0.5;
          const rk = r0 * (0.6 + rnd() * 0.25);
          kl.push(x + Math.cos(b2) * Rc * 0.5, y0 - r0 * SY * (0.1 + rnd() * 0.4), z + Math.sin(b2) * Rc * 0.5, rk, SY, hp);
        }
      }
    }
  }
  const nKl = kl.length / 6;
  let wolken: THREE.InstancedMesh | null = null;
  const wolkenY = new Float32Array(Math.max(1, nKl));
  {
    // Klecks: kantige Kugel, unten in der Schattenfarbe
    const ico = new THREE.SphereGeometry(1, 7, 5).toNonIndexed();
    const p = ico.getAttribute('position');
    const wb = new MeshBuilder();
    for (let f = 0; f < p.count; f += 3) {
      const a: V3 = [p.getX(f), p.getY(f), p.getZ(f)];
      const b2: V3 = [p.getX(f + 1), p.getY(f + 1), p.getZ(f + 1)];
      const c: V3 = [p.getX(f + 2), p.getY(f + 2), p.getZ(f + 2)];
      const my = (a[1] + b2[1] + c[1]) / 3;
      wb.tri(a, b2, c, my < -0.45 ? cWolkeS : my < 0.05 ? mixRgb(cWolke, cWolkeS, 0.3) : cWolke);
    }
    ico.dispose();
    const geo = wb.build();
    if (nKl > 0) {
      wolken = new THREE.InstancedMesh(geo, toon, nKl);
      wolken.frustumCulled = false;
      wolken.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      for (let k = 0; k < nKl; k++) {
        const r = kl[k * 6 + 3];
        q.setFromAxisAngle(UP, rnd() * Math.PI * 2);
        m.compose(tmpV.set(kl[k * 6], kl[k * 6 + 1], kl[k * 6 + 2]), q, s.set(r, r * kl[k * 6 + 4], r));
        wolken.setMatrixAt(k, m);
        wolkenY[k] = kl[k * 6 + 1];
      }
      group.add(wolken);
      disposables.push(wolken);
      if (lines) {
        addSmoothNormals(geo);
        const ol = new THREE.InstancedMesh(geo, outlineMaterial(0.05), nKl);
        ol.instanceMatrix = wolken.instanceMatrix;
        ol.frustumCulled = false;
        ol.name = 'outline';
        group.add(ol);
        disposables.push(ol);
      }
    }
    disposables.push(geo);
  }

  // --- 6. Luftschiffe ------------------------------------------------------------------
  const SL = 40;
  const SR = 6.5;
  const schiffGeo = (() => {
    const b = new MeshBuilder();
    const st: [number, number][] = [
      [0.05, -0.5],
      [0.34, -0.45],
      [0.66, -0.36],
      [0.92, -0.2],
      [1, 0],
      [0.97, 0.18],
      [0.86, 0.32],
      [0.66, 0.41],
      [0.38, 0.47],
      [0.05, 0.5],
    ];
    drehkoerper(
      b,
      st.map(([r, u]) => [r * SR, u * SL] as [number, number]),
      10,
      'z',
      (i, j) => (i === 1 || i === 6 ? C_ROT : j % 2 === 0 ? C_CREME : shade(C_CREME, 0.93)),
    );
    // Leitwerk: vier Flossen
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const px = -dy * 0.18;
      const py = dx * 0.18;
      const f = (r: number, z: number, s: number): V3 => [dx * r + px * s, dy * r + py * s, z];
      const pts: [number, number][] = [
        [0.62 * SR, -0.3 * SL],
        [0.25 * SR, -0.47 * SL],
        [1.45 * SR, -0.5 * SL],
        [1.45 * SR, -0.41 * SL],
      ];
      for (const s of [-1, 1]) {
        quadN(b, f(pts[0][0], pts[0][1], s), f(pts[1][0], pts[1][1], s), f(pts[2][0], pts[2][1], s), f(pts[3][0], pts[3][1], s), [px * s, py * s, 0], C_ROT);
      }
      const mr0 = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
      const mz0 = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
      for (let e2 = 0; e2 < 4; e2++) {
        const p0 = pts[e2];
        const p1 = pts[(e2 + 1) % 4];
        // Kante: Normale vom Flossenmittelpunkt zur Kantenmitte
        const nr = (p0[0] + p1[0]) / 2 - mr0;
        const nz = (p0[1] + p1[1]) / 2 - mz0;
        quadN(b, f(p0[0], p0[1], -1), f(p1[0], p1[1], -1), f(p1[0], p1[1], 1), f(p0[0], p0[1], 1), [dx * nr, dy * nr, nz], shade(C_ROT, 0.8));
      }
    }
    // Gondel mit Fensterband, Streben
    b.box(0, -SR - 1.1, 3, 2.8, 2.0, 10, C_NAVY);
    b.box(0, -SR - 0.85, 3.2, 2.9, 0.6, 8.4, C_FENSTER);
    stab(b, [0, -SR - 0.1, 7], [0, -SR + 0.6, 7], 0.5, C_NAVY);
    stab(b, [0, -SR - 0.1, -1], [0, -SR + 0.6, -1], 0.5, C_NAVY);
    // Motorgondeln
    for (const s of [-1, 1]) {
      b.box(s * SR * 0.85, -SR * 0.45, -4, 1.3, 1.3, 3.2, C_ALU_D, 0, C_ALU);
      stab(b, [s * SR * 0.85, -SR * 0.45, -4], [s * SR * 0.55, -SR * 0.3, -4], 0.35, C_NAVY);
    }
    return b.build();
  })();
  // Instanzen: 0, 1 fern, 2 hoch, 3 am Ankermast
  const NS = 4;
  const schiffe = new THREE.InstancedMesh(schiffGeo, toon, NS);
  schiffe.frustumCulled = false;
  schiffe.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(schiffe);
  disposables.push(schiffGeo, schiffe);
  if (lines) {
    addSmoothNormals(schiffGeo);
    const ol = new THREE.InstancedMesh(schiffGeo, outlineMaterial(0.05), NS);
    ol.instanceMatrix = schiffe.instanceMatrix;
    ol.frustumCulled = false;
    ol.name = 'outline';
    group.add(ol);
    disposables.push(ol);
  }
  {
    const c = new THREE.Color();
    const tints = [0xffffff, 0xe6f1ff, 0xfff1d6, 0xffffff];
    for (let k = 0; k < NS; k++) schiffe.setColorAt(k, c.set(tints[k]));
  }
  // Propeller: je Schiff zwei Naben, je Nabe zwei Blätter; Positionslicht je Schiff
  const schiffProp: number[] = [];
  const schiffLicht: number[] = [];
  for (let k = 0; k < NS; k++) {
    for (let p = 0; p < 4; p++) schiffProp.push(kiste(0x2a2733));
    schiffLicht.push(lampe(k === 3 ? 0x7dff8a : 0xff3b30));
  }
  const naben = [new THREE.Matrix4().makeTranslation(-SR * 0.85, -SR * 0.45, -5.8), new THREE.Matrix4().makeTranslation(SR * 0.85, -SR * 0.45, -5.8)];
  // Bahnen: zwei weite Kreise in der Ferne, ein großer Kreis hoch über die Strecke
  const bahnen: { x: number; z: number; r: number; y: number; dir: number; ph: number; v: number; s: number }[] = [];
  {
    for (let k = 0; k < 2; k++) {
      let r = world.radius + 110 + k * 70;
      for (let tries = 0; tries < 30; tries++) {
        let ok = true;
        for (let s = 0; s < 48 && ok; s++) {
          const a = (s / 48) * Math.PI * 2;
          if (world.clearance(cx + Math.cos(a) * r, cz + Math.sin(a) * r) < 75) ok = false;
        }
        if (ok) break;
        r += 20;
      }
      bahnen.push({ x: cx, z: cz, r, y: k === 0 ? 62 : 44, dir: k === 0 ? 1 : -1, ph: rnd() * Math.PI * 2, v: 7 + k, s: 1.1 });
    }
    // Hoch über die Strecke: Kreis, der durch die Mitte läuft
    const a0 = rnd() * Math.PI * 2;
    const R = 430;
    const hx = cx + Math.cos(a0) * R;
    const hz = cz + Math.sin(a0) * R;
    const s = 1.3;
    // Tiefster Punkt (Gondel) mindestens 30 m über der höchsten Fahrbahn
    const y = maxPy + 30 + (SR + 2.4) * s + 6;
    // Start so, dass es nach etwa einer halben Minute über der Mitte ist
    const aMitte = a0 + Math.PI;
    bahnen.push({ x: hx, z: hz, r: R, y, dir: 1, ph: aMitte - (11 * 30) / R, v: 11, s });
  }
  const schiffMat: THREE.Matrix4[] = [];
  for (let k = 0; k < NS; k++) schiffMat.push(new THREE.Matrix4());

  // --- 7. Ballone (schaukeln an ihrer Leine) -----------------------------------------
  const nBallon = ballonOrte.length / 5;
  let ballone: THREE.InstancedMesh | null = null;
  if (nBallon > 0) {
    const b = new MeshBuilder();
    stab(b, [0, 0, 0], [0, 8.6, 0], 0.14, C_SEIL);
    b.box(0, 9.4, 0, 1.8, 1.4, 1.8, cDeck, 0, cDeckD);
    for (const [ex, ez] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      stab(b, [ex * 0.8, 10.1, ez * 0.8], [ex * 1.3, 12.7, ez * 1.3], 0.08, C_SEIL);
    }
    const prof: [number, number][] = [
      [1.7, 12.6],
      [3.6, 13.7],
      [5.0, 15.6],
      [5.4, 17.8],
      [4.8, 20.0],
      [3.0, 21.8],
      [0.05, 22.6],
    ];
    drehkoerper(b, prof, 10, 'y', (_i, j) => (j % 2 === 0 ? C_ROT : C_CREME));
    // Öffnung unten
    for (let j = 0; j < 10; j++) {
      const a0 = (j / 10) * Math.PI * 2;
      const a1 = ((j + 1) / 10) * Math.PI * 2;
      b.tri([0, 12.6, 0], [Math.cos(a0) * 1.7, 12.6, Math.sin(a0) * 1.7], [Math.cos(a1) * 1.7, 12.6, Math.sin(a1) * 1.7], C_DUNKEL);
    }
    const geo = b.build();
    ballone = new THREE.InstancedMesh(geo, toon, nBallon);
    ballone.frustumCulled = false;
    ballone.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    const tints = [0xffffff, 0xfff0a0, 0xa8dcff, 0xffffff, 0xc8ffd8, 0xffd0e8];
    for (let k = 0; k < nBallon; k++) ballone.setColorAt(k, c.set(tints[k % tints.length]));
    group.add(ballone);
    disposables.push(geo, ballone);
    if (lines) {
      addSmoothNormals(geo);
      const ol = new THREE.InstancedMesh(geo, outlineMaterial(0.05), nBallon);
      ol.instanceMatrix = ballone.instanceMatrix;
      ol.frustumCulled = false;
      ol.name = 'outline';
      group.add(ol);
      disposables.push(ol);
    }
  }

  // --- 8. Doppeldecker und Vogelschwarm ----------------------------------------------
  const flieger: { x: number; z: number; r: number; y: number; dir: number; ph: number; k0: number }[] = [];
  const FLIEGER_TEILE: [number, number, number, number, number, number, number][] = [
    // Farbe, Mitte, Größe
    [0, 0, 0, 0, 0.9, 0.9, 5],
    [1, 0, 1.15, 0.6, 8, 0.14, 1.3],
    [1, 0, -0.35, 0.6, 7.4, 0.14, 1.2],
    [1, 0, 0.2, -2.3, 2.8, 0.1, 0.8],
    [0, 0, 0.7, -2.3, 0.1, 1.2, 0.9],
    [2, 0, 0.45, 1.5, 0.12, 1.5, 0.12],
  ];
  const fliegerLokal = FLIEGER_TEILE.map(([, x, y, z, sx, sy, sz]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
  {
    const n = detail === 0 ? 2 : 3;
    const lack = [
      [0xe8483f, 0xf7f2e4],
      [0xffc72e, 0x2d3550],
      [0x1fc8b6, 0xf7f2e4],
    ];
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * world.radius * 0.7;
      const k0 = kFarbe.length;
      for (const tl of FLIEGER_TEILE) kiste(tl[0] === 2 ? 0x2a2733 : lack[k][tl[0]]);
      kiste(0x2a2733);
      kiste(0x2a2733);
      flieger.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, r: 45 + rnd() * 30, y: maxPy + 26 + k * 7, dir: k % 2 === 0 ? 1 : -1, ph: rnd() * Math.PI * 2, k0 });
    }
  }
  // Vögel: ein Schwarm, der neben der Strecke kreist
  const nVogel = detail === 0 ? 8 : 12;
  const vogelK0 = kFarbe.length;
  for (let k = 0; k < nVogel; k++) {
    kiste(0xf7f7f2);
    kiste(0xc5d0dc);
    kiste(0xc5d0dc);
  }
  const vogelP = new Float32Array(nVogel * 4);
  for (let k = 0; k < nVogel; k++) vogelP.set([rnd() * Math.PI * 2, 0.55 + rnd() * 0.45, (rnd() - 0.5) * 5, rnd() * 10], k * 4);
  let schwarmX = cx;
  let schwarmZ = cz;
  let schwarmY = maxPy + 30;
  let schwarmR = 22;
  {
    let best = -1;
    for (let tries = 0; tries < 400; tries++) {
      const a = rnd() * Math.PI * 2;
      const d = world.radius * (0.2 + rnd() * 0.9);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const c = world.clearance(x, z);
      // Nahe genug, dass man ihn sieht; der Kreis bleibt 12 m vor jeder Bande
      if (c < 36 || c > 70) continue;
      if (c > best) {
        best = c;
        schwarmX = x;
        schwarmZ = z;
        schwarmR = Math.min(22, c - 14);
        let lo = Infinity;
        for (let k = 0; k < t.total; k += 4) if (Math.hypot(x - t.px[k], z - t.pz[k]) < 120) lo = Math.min(lo, t.py[k]);
        schwarmY = (lo === Infinity ? 30 : lo) + 2;
      }
      if (best > 50) break;
    }
  }
  const vogelLokalFluegel = new THREE.Matrix4().compose(new THREE.Vector3(0.6, 0, 0), new THREE.Quaternion(), new THREE.Vector3(1.2, 0.06, 0.45));
  const vogelLokalKoerper = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(0.32, 0.3, 1.0));

  // --- 9. Instanzen der Kleinteile und Leuchten anlegen -------------------------------
  const kGeo = (() => {
    const b = new MeshBuilder();
    b.box(0, 0, 0, 1, 1, 1, [1, 1, 1]);
    return b.build();
  })();
  const nK = kFarbe.length;
  const klein = new THREE.InstancedMesh(kGeo, toon, Math.max(1, nK));
  klein.count = nK;
  klein.frustumCulled = false;
  klein.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const c = new THREE.Color();
    for (let k = 0; k < nK; k++) klein.setColorAt(k, c.set(kFarbe[k]));
  }
  group.add(klein);
  disposables.push(kGeo, klein);
  if (fine) {
    addSmoothNormals(kGeo);
    const ol = new THREE.InstancedMesh(kGeo, outlineMaterial(0.04), Math.max(1, nK));
    ol.count = nK;
    ol.instanceMatrix = klein.instanceMatrix;
    ol.frustumCulled = false;
    ol.name = 'outline';
    group.add(ol);
    disposables.push(ol);
  }
  const lGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const lMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const nL = lFarbe.length;
  const licht = new THREE.InstancedMesh(lGeo, lMat, Math.max(1, nL));
  licht.count = nL;
  licht.frustumCulled = false;
  licht.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const c = new THREE.Color();
    for (let k = 0; k < nL; k++) licht.setColorAt(k, c.set(lFarbe[k]));
  }
  group.add(licht);
  disposables.push(lGeo, lMat, licht);

  // --- Pro Bild ------------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const m5 = new THREE.Matrix4();
  const m6 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const dirV = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const WIND = Math.atan2(0.9, 2.2);
  let kranAmp = 0.04;
  let kranPrevYaw = 0;
  let kranInit = false;
  const kranYawA = Math.atan2(stapel[0] - kranKopf[0], stapel[2] - kranKopf[2]);
  // Ziel am Schiff: neben der Gondel, außerhalb der Hülle
  const schiffMitte: V3 = [mastTop[0] + outX * (SL / 2 + 1), mastTop[1], mastTop[2] + outZ * (SL / 2 + 1)];
  const zielX = schiffMitte[0] + t.tx[iH] * (SR + 1.2);
  const zielZ = schiffMitte[2] + t.tz[iH] * (SR + 1.2);
  const kranYawB = Math.atan2(zielX - kranKopf[0], zielZ - kranKopf[2]);
  const kranRA = Math.hypot(stapel[0] - kranKopf[0], stapel[2] - kranKopf[2]);
  const kranRB = Math.hypot(zielX - kranKopf[0], zielZ - kranKopf[2]);
  const JIB = Math.max(kranRA, kranRB) + 2.5;
  const JIB_Y = kranKopf[1] + 1.2;
  let dYaw = kranYawB - kranYawA;
  dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));

  const setL = (k: number, x: number, y: number, z: number, size: number): void => {
    const s = Math.max(0, size);
    m4.makeScale(s, s, s);
    m4.setPosition(x, y, z);
    licht.setMatrixAt(k, m4);
  };
  const setK = (k: number, x: number, y: number, z: number, rot: THREE.Quaternion, sx: number, sy: number, sz: number): void => {
    m4.compose(v.set(x, y, z), rot, sv.set(sx, sy, sz));
    klein.setMatrixAt(k, m4);
  };

  return {
    group,
    update(time: number, dt: number): void {
      // --- Wolken: heben und senken sich ganz langsam ---
      if (wolken) {
        const arr = wolken.instanceMatrix.array as Float32Array;
        for (let k = 0; k < nKl; k++) {
          const h = kl[k * 6 + 5];
          arr[k * 16 + 13] = wolkenY[k] + Math.sin(time * 0.11 + haufenPhase[h]) * 0.6;
        }
        wolken.instanceMatrix.needsUpdate = true;
      }

      // --- Rotoren ---
      for (let r = 0; r < rotoren.length; r += 6) {
        const ang = time * 9 + rotoren[r + 4];
        const k0 = rotoren[r + 5];
        const len = rotoren[r + 3] * 2;
        q.setFromAxisAngle(UP, ang);
        setK(k0, rotoren[r], rotoren[r + 1], rotoren[r + 2], q, len, 0.12, 0.45);
        q.setFromAxisAngle(UP, ang + Math.PI / 2);
        setK(k0 + 1, rotoren[r], rotoren[r + 1], rotoren[r + 2], q, len, 0.12, 0.45);
      }

      // --- Luftschiffe ---
      for (let k = 0; k < NS; k++) {
        const m = schiffMat[k];
        if (k < 3) {
          const b = bahnen[k];
          const a = b.ph + (b.dir * time * b.v) / b.r;
          const x = b.x + Math.cos(a) * b.r;
          const z = b.z + Math.sin(a) * b.r;
          e.set(Math.sin(time * 0.3 + k) * 0.02, Math.atan2(-Math.sin(a) * b.dir, Math.cos(a) * b.dir), 0);
          q.setFromEuler(e);
          m.compose(v.set(x, b.y + Math.sin(time * 0.25 + k * 2) * 1.2, z), q, sv.setScalar(b.s));
        } else {
          // Am Ankermast: dreht sich leicht um die Nase, hebt und senkt sich
          const yaw = Math.atan2(-outX, -outZ) + Math.sin(time * 0.13) * 0.05;
          const fx0 = Math.sin(yaw);
          const fz0 = Math.cos(yaw);
          const d = SL / 2 + 1;
          e.set(Math.sin(time * 0.4) * 0.015, yaw, Math.sin(time * 0.31) * 0.02);
          q.setFromEuler(e);
          m.compose(v.set(mastTop[0] - fx0 * d, mastTop[1] + Math.sin(time * 0.5) * 0.15, mastTop[2] - fz0 * d), q, sv.setScalar(1));
        }
        schiffe.setMatrixAt(k, m);
        // Propeller (am Ankermast stehen sie still)
        const ang = k < 3 ? time * 14 + k : 0.4;
        for (let p = 0; p < 2; p++) {
          m5.multiplyMatrices(m, naben[p]);
          for (let bl = 0; bl < 2; bl++) {
            m6.makeRotationZ(ang + bl * Math.PI * 0.5);
            m6.scale(sv.set(0.3, 3.4, 0.12));
            m4.multiplyMatrices(m5, m6);
            klein.setMatrixAt(schiffProp[k * 4 + p * 2 + bl], m4);
          }
        }
        // Positionslicht unter der Gondel
        v.set(0, -SR - 2.3, 3).applyMatrix4(m);
        setL(schiffLicht[k], v.x, v.y, v.z, Math.sin(time * 3 + k * 1.7) > 0.4 ? 1.6 : 0);
      }
      schiffe.instanceMatrix.needsUpdate = true;

      // --- Ballone ---
      if (ballone) {
        for (let k = 0; k < nBallon; k++) {
          const o = k * 5;
          const ph = ballonOrte[o + 4];
          e.set(Math.sin(time * 0.55 + ph) * 0.06, ph, Math.sin(time * 0.41 + ph * 1.7) * 0.06);
          q.setFromEuler(e);
          m4.compose(v.set(ballonOrte[o], ballonOrte[o + 1], ballonOrte[o + 2]), q, sv.setScalar(1));
          ballone.setMatrixAt(k, m4);
        }
        ballone.instanceMatrix.needsUpdate = true;
      }

      // --- Kran: schwenkt zwischen Stapel und Schiff, die Last pendelt nach ---
      {
        const P_ = 30;
        const u = (time + 4) % P_;
        // 0–4 anschlagen, 4–6 heben, 6–13 schwenken, 13–15 senken, 15–19 abladen, 19–21 heben, 21–28 zurück, 28–30 senken
        let f = 0;
        if (u < 6) f = 0;
        else if (u < 13) f = smooth((u - 6) / 7);
        else if (u < 21) f = 1;
        else if (u < 28) f = 1 - smooth((u - 21) / 7);
        const yaw = kranYawA + dYaw * f;
        const rT = kranRA + (kranRB - kranRA) * f;
        const tiefA = JIB_Y - (stapel[1] + 2.6);
        const tiefB = JIB_Y - (schiffMitte[1] - SR - 1.5);
        const kurz = 6;
        let seil = kurz;
        if (u < 4) seil = tiefA;
        else if (u < 6) seil = tiefA + (kurz - tiefA) * smooth((u - 4) / 2);
        else if (u < 13) seil = kurz;
        else if (u < 15) seil = kurz + (tiefB - kurz) * smooth((u - 13) / 2);
        else if (u < 19) seil = tiefB;
        else if (u < 21) seil = tiefB + (kurz - tiefB) * smooth((u - 19) / 2);
        else if (u < 28) seil = kurz;
        else seil = kurz + (tiefA - kurz) * smooth((u - 28) / 2);
        const geladen = u < 15;
        if (!kranInit) {
          kranPrevYaw = yaw;
          kranInit = true;
        }
        const rate = dt > 0 ? Math.abs(yaw - kranPrevYaw) / dt : 0;
        kranPrevYaw = yaw;
        kranAmp += (0.04 + Math.min(0.22, rate * 1.6) - kranAmp) * Math.min(1, dt * 0.7);
        const sx = Math.sin(yaw);
        const sz = Math.cos(yaw);
        const kx = kranKopf[0];
        const kz = kranKopf[2];
        q.setFromAxisAngle(UP, yaw);
        setK(kran.jib, kx + sx * (JIB / 2 - 1), JIB_Y, kz + sz * (JIB / 2 - 1), q, 1.0, 1.0, JIB + 2);
        setK(kran.gegen, kx - sx * 3.5, JIB_Y - 0.1, kz - sz * 3.5, q, 1.1, 0.8, 6);
        setK(kran.gewicht, kx - sx * 6, JIB_Y - 1.4, kz - sz * 6, q, 2.2, 2.4, 2.0);
        setK(kran.kabine, kx + Math.cos(yaw) * 1.5, JIB_Y - 1.6, kz - Math.sin(yaw) * 1.5, q, 1.6, 1.8, 1.8);
        const tx = kx + sx * rT;
        const tz = kz + sz * rT;
        setK(kran.katze, tx, JIB_Y - 0.75, tz, q, 1.2, 0.5, 1.4);
        // Pendel: quer zum Ausleger stärker als längs
        const w = Math.sqrt(9.81 / Math.max(3, seil));
        const phq = kranAmp * Math.sin(time * w);
        const phl = kranAmp * 0.4 * Math.sin(time * w * 0.9 + 1.3);
        const px = Math.cos(yaw);
        const pz = -Math.sin(yaw);
        dirV.set(px * Math.sin(phq) + sx * Math.sin(phl), -Math.cos(phq) * Math.cos(phl), pz * Math.sin(phq) + sz * Math.sin(phl)).normalize();
        const y0 = JIB_Y - 1.0;
        q2.setFromUnitVectors(UP, dirV);
        setK(kran.seil, tx + dirV.x * seil * 0.5, y0 + dirV.y * seil * 0.5, tz + dirV.z * seil * 0.5, q2, 0.12, seil, 0.12);
        const hx = tx + dirV.x * seil;
        const hy = y0 + dirV.y * seil;
        const hz = tz + dirV.z * seil;
        q.multiplyQuaternions(q2, q.setFromAxisAngle(UP, yaw));
        setK(kran.haken, hx, hy, hz, q, 0.6, 0.6, 0.6);
        if (geladen) setK(kran.kiste, hx + dirV.x * 1.2, hy + dirV.y * 1.2, hz + dirV.z * 1.2, q, 2.2, 1.8, 2.2);
        else klein.setMatrixAt(kran.kiste, zero);
        setL(kranLampe, kx, JIB_Y + 1.2, kz, Math.sin(time * 4) > 0 ? 1.4 : 0);
      }
      setL(mastLampe, mastTop[0], mastTop[1] + 1.6, mastTop[2], Math.sin(time * 2.5) > 0 ? 1.5 : 0.3);

      // --- Doppeldecker ---
      for (const f of flieger) {
        const a = f.ph + (f.dir * time * 22) / f.r;
        const x = f.x + Math.cos(a) * f.r;
        const z = f.z + Math.sin(a) * f.r;
        e.set(Math.sin(time * 0.7 + f.ph) * 0.05, Math.atan2(-Math.sin(a) * f.dir, Math.cos(a) * f.dir), 0.42 * f.dir);
        q.setFromEuler(e);
        m5.compose(v.set(x, f.y + Math.sin(time * 0.5 + f.ph) * 2, z), q, sv.setScalar(1.3));
        for (let p = 0; p < fliegerLokal.length; p++) {
          m4.multiplyMatrices(m5, fliegerLokal[p]);
          klein.setMatrixAt(f.k0 + p, m4);
        }
        for (let bl = 0; bl < 2; bl++) {
          m6.makeRotationZ(time * 30 + bl * Math.PI * 0.5);
          m6.setPosition(0, 0, 2.65);
          m6.scale(sv.set(0.22, 2.6, 0.1));
          m4.multiplyMatrices(m5, m6);
          klein.setMatrixAt(f.k0 + fliegerLokal.length + bl, m4);
        }
      }

      // --- Vögel ---
      for (let k = 0; k < nVogel; k++) {
        const o = k * 4;
        const rad = schwarmR * vogelP[o + 1] + 2;
        const a = vogelP[o] + (time * 9) / rad;
        const x = schwarmX + Math.cos(a) * rad;
        const z = schwarmZ + Math.sin(a) * rad;
        const y = schwarmY + vogelP[o + 2] + Math.sin(time * 0.8 + vogelP[o + 3]) * 1.2;
        e.set(0, Math.atan2(-Math.sin(a), Math.cos(a)), 0.5);
        q.setFromEuler(e);
        m5.compose(v.set(x, y, z), q, sv.setScalar(1.7));
        m4.multiplyMatrices(m5, vogelLokalKoerper);
        klein.setMatrixAt(vogelK0 + k * 3, m4);
        const flap = 0.15 + Math.max(0, Math.sin(time * 0.6 + vogelP[o + 3])) * Math.sin(time * 9 + vogelP[o + 3]) * 0.6;
        for (let s = 0; s < 2; s++) {
          m6.makeRotationZ(s === 0 ? flap : Math.PI - flap);
          m6.setPosition(s === 0 ? 0.12 : -0.12, 0.08, 0);
          m4.multiplyMatrices(m5, m6);
          m4.multiply(vogelLokalFluegel);
          klein.setMatrixAt(vogelK0 + k * 3 + 1 + s, m4);
        }
      }

      // --- Windsäcke ---
      for (const w of windsaecke) {
        const yaw = WIND + Math.sin(time * 1.3 + w.phase) * 0.25;
        const droop = 0.18 + Math.sin(time * 2.1 + w.phase) * 0.08;
        e.set(droop, yaw, Math.sin(time * 5 + w.phase) * 0.1);
        q.setFromEuler(e);
        const ux = Math.sin(yaw) * Math.cos(droop);
        const uy = -Math.sin(droop);
        const uz = Math.cos(yaw) * Math.cos(droop);
        for (let s = 0; s < 3; s++) {
          const d = 0.6 + s * 1.2;
          const r = 1.1 - s * 0.22;
          setK(w.k0 + s, w.x + ux * d, w.y + uy * d, w.z + uz * d, q, r, r, 1.15);
        }
      }

      klein.instanceMatrix.needsUpdate = true;

      // --- Leuchten ---
      for (const m of masten) setL(m.lampe, m.x, m.y, m.z, Math.sin(time * 3.2 + m.phase) > 0.2 ? 1.5 : 0);
      for (let k = 0; k < gantryLampen.length; k++) {
        const g = gantryLampen[k];
        setL(g.l, g.x, g.y, g.z, Math.sin(time * 2 + k) > 0 ? 1.2 : 0);
      }
      for (let k = 0; k < hangarLampen.length; k += 4) setL(hangarLampen[k + 3], hangarLampen[k], hangarLampen[k + 1], hangarLampen[k + 2], Math.sin(time * 2.6 + k) > 0 ? 1.6 : 0);
      licht.instanceMatrix.needsUpdate = true;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
