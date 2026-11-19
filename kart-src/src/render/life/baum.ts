// Kulisse des Baumkronenpfads: ein Laubwald am goldenen Herbstnachmittag.
//
// Die Riesen, an denen die Strecke hängt (Stämme, Kragarme, der hohle Baumriese), zeichnet mechanics/canopy.ts; hier
// kommt dazu, was sie und den Wald lebendig macht:
//   – die Kronen der Riesen: rotes, oranges und gelbes Laub in großen Ballen, nie über einer Fahrbahn tiefer als LUFT;
//   – der Wald ringsum: Buchen (gelb und kupfern), Ahorn (rot), Birken (weiße Stämme, goldgelb), dazwischen ein paar
//     dunkle Tannen. Unter dem Kronenpfad bleiben ihre Wipfel unter den Stegen – von oben schaut man in die Kronen;
//   – Unterholz: Farne, Büsche, Pilze (Fliegenpilze und Steinpilze), bemooste Steine und liegende Stämme;
//   – drei Baumhäuser mit Leiter, ein paar Lichtschächte, die schräg durch die Kronen fallen (halbdurchsichtig, kein Licht);
//   – Bewegtes, nur wenig: fallende Blätter rund um die Kamera, Eichhörnchen, die an Stämmen hinauf- und hinunterflitzen,
//     und Vögel, die über den Kronen kreisen.
//
// Reine Kulisse: mindestens RAND Meter neben jeder Fahrbahnkante, über einer Fahrbahn nichts unter LUFT Metern, nichts im
// Flugkorridor des Gleitflugs. Alles mit festem Zufall aus der Strecke abgeleitet; im Lauf wird nichts angelegt.
// Keine eigenen Shader, keine Lichtquellen.
//
// Zeichenaufrufe (hoch): Wald und Bauten + Kontur, Lichtschächte, Bewegtes = 4. Niedrig: ohne Kontur = 3.

import * as THREE from 'three';
import { EDGE_GLIDE } from '../../game/track';
import { MeshBuilder, noise, seeded, shade, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';
import { FALL, HOLLOW, OAK_E, TREE_B, TREE_C, TREE_C2, TRUNK_A, pondTest, type Giant } from './baumLand';

/** Mindestabstand zur Fahrbahnkante (Meter) und freier Raum über einer Fahrbahn. */
const RAND = 3;
const LUFT = 9;
const TAU = Math.PI * 2;

const C_LAUB = [0xd8462a, 0xe8662a, 0xf08a2c, 0xf4b23a, 0xe8c64a, 0xc8382a, 0xb8562a].map(rgb);
const C_GELB = [0xf2c84a, 0xe8b23a, 0xf6d870].map(rgb);
const C_ROT = [0xc8302a, 0xd8462a, 0xa82a24].map(rgb);
const C_TANNE = rgb(0x2f5a3c);
const C_TANNE_D = rgb(0x244a30);
const C_STAMM = rgb(0x6a5040);
const C_STAMM_D = rgb(0x544032);
const C_BIRKE = rgb(0xece6da);
const C_BIRKE_D = rgb(0x3a342e);
const C_FARN = [0x8aa040, 0xa8a83a, 0xb87a30].map(rgb);
const C_BUSCH = [0xb8462a, 0xd87a30, 0x9a8a38].map(rgb);
const C_STEIN = rgb(0x8f877a);
const C_STEIN_D = rgb(0x746c60);
const C_MOOS = rgb(0x6f8a38);
const C_PILZ_ROT = rgb(0xd8281e);
const C_PILZ_BRAUN = rgb(0x8a5a2a);
const C_PILZ_STIEL = rgb(0xf2ead8);
const C_HOLZ = rgb(0x9a6a40);
const C_HOLZ_D = rgb(0x6e4a2c);
const C_DACH = rgb(0x8a3a24);
const C_FENSTER = rgb(0xffd890);

export function buildBaumLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const hi = world.detail > 0;
  const rnd = seeded(2222 + t.index * 7);
  const grund = (x: number, z: number): number => world.groundY(x, z);
  const pond = pondTest(t, 4);

  // --- Platz -----------------------------------------------------------------------------------------
  // Fahrbahn in Eimern zu 16 m: je Abschnitt (jeder zweite) Lage, halbe Breite, Höhe, ob Flugstrecke.
  const CELL = 16;
  const buckets = new Map<number, number[]>();
  const key = (ix: number, iz: number): number => ix * 4096 + iz;
  for (let k = 0; k < t.total; k += 2) {
    const ix = Math.floor(t.px[k] / CELL);
    const iz = Math.floor(t.pz[k] / CELL);
    const kk = key(ix, iz);
    let b = buckets.get(kk);
    if (!b) buckets.set(kk, (b = []));
    b.push(k);
  }
  /**
   * Darf ein Körper (Kugel bzw. senkrechter Zylinder) hier stehen? Mitte (x, z), Halbmesser r, von y0 bis y1.
   * Neben einer Fahrbahn (näher als r + RAND) nur, wenn er ganz unter ihr bleibt oder hoch genug darüber (LUFT); über
   * einer Flugstrecke 16 m Luft.
   */
  const frei = (x: number, z: number, r: number, y0: number, y1: number): boolean => {
    const reach = r + RAND + 16;
    const i0 = Math.floor((x - reach) / CELL);
    const i1 = Math.floor((x + reach) / CELL);
    const j0 = Math.floor((z - reach) / CELL);
    const j1 = Math.floor((z + reach) / CELL);
    for (let ix = i0; ix <= i1; ix++) {
      for (let iz = j0; iz <= j1; iz++) {
        const b = buckets.get(key(ix, iz));
        if (!b) continue;
        for (const k of b) {
          const glide = (t.edge[k] & EDGE_GLIDE) !== 0;
          const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k];
          if (d > r + RAND + (glide ? 8 : 0)) continue;
          const under = t.py[k] - (glide ? 18 : 2.5);
          const over = t.py[k] + (glide ? 16 : LUFT);
          if (y1 > under && y0 < over) return false;
        }
      }
    }
    return true;
  };
  /** Steht etwas in einem der Riesen oder im hohlen Baumriesen? */
  const riesen: Giant[] = [TRUNK_A, TREE_B, TREE_C2, TREE_C, OAK_E];
  const imRiesen = (x: number, z: number, r: number): boolean => {
    for (const g of riesen) if (Math.hypot(x - g.x, z - g.z) < g.r * 1.6 + r) return true;
    if (Math.hypot(x - HOLLOW.x, z - HOLLOW.z) < HOLLOW.rOut + 2 + r) return true;
    return Math.hypot(x - FALL.x + 13, z - FALL.z + 8) < 20 + r;
  };

  const bau = new MeshBuilder();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  // Sparsame Grundformen: Stämme ohne Deckel (man sieht sie nie), Laub als Ikosaeder.
  const G = {
    ico: new THREE.IcosahedronGeometry(1, 0),
    kegel: new THREE.ConeGeometry(1, 1, 6, 1, true),
    zyl: new THREE.CylinderGeometry(0.8, 1, 1, 5, 1, true),
    zyl5: new THREE.CylinderGeometry(0.75, 1, 1, 5, 1, true),
    dode: new THREE.DodecahedronGeometry(1, 0),
    halb: new THREE.ConeGeometry(1, 0.55, 6, 1, true),
    pyr: new THREE.ConeGeometry(1, 1, 4, 1, true),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
  for (const g of Object.values(G)) disposables.push(g);
  const put = (geo: THREE.BufferGeometry, c: RGB, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): void => {
    e.set(rx, ry, rz);
    q.setFromEuler(e);
    m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz));
    bau.add(geo, c, m4);
  };
  const pick = <T,>(list: T[]): T => list[Math.floor(rnd() * list.length)];

  // --- Kronen der Riesen -----------------------------------------------------------------------------
  {
    const krone = (g: Giant, count: number, spread: number, palette: RGB[]): void => {
      let n = 0;
      for (let tries = 0; tries < count * 8 && n < count; tries++) {
        const a = rnd() * TAU;
        const u = rnd();
        const h = g.crown + u * (g.top - g.crown);
        // breit unten, schmal oben
        const rr = spread * (0.25 + 0.75 * Math.sin(Math.PI * (0.15 + 0.85 * (1 - u)) * 0.6 + 0.3)) * Math.sqrt(rnd());
        const x = g.x + Math.cos(a) * rr;
        const z = g.z + Math.sin(a) * rr;
        const r = 4.6 + rnd() * 3.4;
        if (!frei(x, z, r * 0.9, h - r * 0.8, h + r)) continue;
        put(G.ico, pick(palette), x, h, z, r * (1 + rnd() * 0.25), r * (0.75 + rnd() * 0.2), r * (1 + rnd() * 0.25), rnd() * TAU);
        n++;
      }
    };
    krone(TRUNK_A, 46, 36, C_LAUB);
    krone(TREE_B, 14, 15, C_GELB);
    krone(TREE_C2, 14, 14, C_ROT);
    krone(TREE_C, 14, 15, C_LAUB);
    krone(OAK_E, 18, 18, [rgb(0xc88a34), rgb(0xb8762e), rgb(0xd8a040)]);
    // ein paar Äste in die Kronen
    for (const g of riesen) {
      for (let k = 0; k < 5; k++) {
        const a = rnd() * TAU;
        const h = g.crown + 2 + rnd() * 10;
        const len = g === TRUNK_A ? 22 : 9;
        const x1 = g.x + Math.cos(a) * len;
        const z1 = g.z + Math.sin(a) * len;
        if (!frei(x1, z1, 1, h, h + 6)) continue;
        const dx = x1 - g.x;
        const dz = z1 - g.z;
        const L = Math.hypot(dx, dz, 6);
        // als dünner Zylinder vom Stamm schräg nach oben außen
        const mid = new THREE.Vector3(g.x + dx / 2, h + 3, g.z + dz / 2);
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, 6 / L, dz / L));
        m4.compose(mid, q, s.set(g === TRUNK_A ? 1.6 : 0.7, L, g === TRUNK_A ? 1.6 : 0.7));
        bau.add(G.zyl5, C_STAMM_D, m4);
      }
    }
  }

  // --- Wald ringsum ---------------------------------------------------------------------------------
  {
    /** Laubbaum: Stamm und drei, vier Ballen Laub. */
    const laub = (x: number, y: number, z: number, h: number, palette: RGB[], birke: boolean): boolean => {
      const r = h * 0.24;
      if (!frei(x, z, r, y, y + h + r * 0.6)) return false;
      const stamm = birke ? C_BIRKE : rnd() < 0.5 ? C_STAMM : C_STAMM_D;
      put(G.zyl, stamm, x, y + h * 0.35, z, h * 0.025 + 0.18, h * 0.72, h * 0.025 + 0.18);
      if (birke) put(G.zyl, C_BIRKE_D, x, y + h * 0.3, z, h * 0.026 + 0.2, 0.25, h * 0.026 + 0.2);
      const c = pick(palette);
      const n = h > 22 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const a = rnd() * TAU;
        const off = k === 0 ? 0 : r * 0.55;
        put(G.ico, k === 0 ? c : shade(pick(palette), 0.95 + rnd() * 0.15), x + Math.cos(a) * off, y + h * (0.72 + 0.1 * rnd()) + (k === 0 ? r * 0.3 : 0), z + Math.sin(a) * off, r * (0.8 + rnd() * 0.3), r * (0.7 + rnd() * 0.25), r * (0.8 + rnd() * 0.3), rnd() * TAU);
      }
      return true;
    };
    const tanne = (x: number, y: number, z: number, h: number): boolean => {
      const r = h * 0.2;
      if (!frei(x, z, r, y, y + h)) return false;
      put(G.zyl, C_STAMM_D, x, y + h * 0.15, z, 0.4, h * 0.3, 0.4);
      for (let k = 0; k < 3; k++) put(G.kegel, k % 2 === 0 ? C_TANNE : C_TANNE_D, x, y + h * (0.32 + k * 0.22), z, r * (1 - k * 0.25), h * 0.36, r * (1 - k * 0.25), rnd() * TAU);
      put(G.ico, C_TANNE_D, x, y + h * 0.2, z, r * 0.5, 0.3, r * 0.5);
      return true;
    };
    const want = 285;
    let n = 0;
    const cx = world.center.x;
    const cz = world.center.z;
    for (let tries = 0; tries < want * 10 && n < want; tries++) {
      // dicht nahe der Strecke, lichter weit draußen
      const a = rnd() * TAU;
      const d = rnd() * rnd() * 330;
      let x = cx + Math.cos(a) * d;
      let z = cz + Math.sin(a) * d;
      if (rnd() < 0.55) {
        // nah an einer Fahrbahn (dort sieht man den Wald)
        const k = Math.floor(rnd() * t.total);
        const side = rnd() < 0.5 ? -1 : 1;
        const o = t.wh[k] + RAND + 1 + rnd() * rnd() * 40;
        x = t.px[k] - t.tz[k] * o * side;
        z = t.pz[k] + t.tx[k] * o * side;
      }
      if (pond(x, z) || imRiesen(x, z, 3)) continue;
      const y = grund(x, z) - 0.3;
      if (y < 0.3) continue;
      // hohe Bäume neben dem Kronenpfad (sie reichen bis an die Stege), niedrigere weiter draußen
      const h = 12 + rnd() * 18 + (noise(x * 0.02, z * 0.02) > 0.55 ? 10 : 0);
      const kind = rnd();
      const ok = kind < 0.12 ? tanne(x, y, z, h * 1.05) : kind < 0.3 ? laub(x, y, z, h * 0.85, C_GELB, true) : kind < 0.55 ? laub(x, y, z, h, C_ROT, false) : laub(x, y, z, h, C_LAUB, false);
      if (ok) n++;
    }
  }

  // --- Unterholz: Farne, Büsche, Pilze, Steine, liegende Stämme ---------------------------------------
  {
    const want = 190;
    let n = 0;
    for (let tries = 0; tries < want * 6 && n < want; tries++) {
      const k = Math.floor(rnd() * t.n);
      const side = rnd() < 0.5 ? -1 : 1;
      const o = t.wh[k] + RAND * 0.6 + rnd() * rnd() * 26;
      const x = t.px[k] - t.tz[k] * o * side;
      const z = t.pz[k] + t.tx[k] * o * side;
      if (pond(x, z) || imRiesen(x, z, 1)) continue;
      const y = grund(x, z);
      if (y < 0.2) continue;
      const kind = rnd();
      if (kind < 0.35) {
        // Farn: ein Fächer flacher Wedel
        if (!frei(x, z, 1.2, y, y + 1.4)) continue;
        const c = pick(C_FARN);
        const w = 5 + Math.floor(rnd() * 3);
        for (let j = 0; j < w; j++) {
          const a = (j / w) * TAU + rnd() * 0.4;
          const L = 1.1 + rnd() * 0.6;
          const tip: V3 = [x + Math.cos(a) * L, y + 0.5 + rnd() * 0.5, z + Math.sin(a) * L];
          const side1: V3 = [x + Math.cos(a + 0.35) * L * 0.45, y + 0.55, z + Math.sin(a + 0.35) * L * 0.45];
          const side2: V3 = [x + Math.cos(a - 0.35) * L * 0.45, y + 0.55, z + Math.sin(a - 0.35) * L * 0.45];
          bau.tri([x, y + 0.05, z], side1, tip, c);
          bau.tri([x, y + 0.05, z], tip, side2, shade(c, 0.88));
        }
      } else if (kind < 0.6) {
        if (!frei(x, z, 1.6, y, y + 2)) continue;
        const c = pick(C_BUSCH);
        put(G.ico, c, x, y + 0.7, z, 1.4 + rnd() * 0.6, 1 + rnd() * 0.4, 1.4 + rnd() * 0.6, rnd() * TAU);
        put(G.ico, shade(c, 1.1), x + 0.7, y + 1.1, z - 0.4, 0.9, 0.7, 0.9, rnd() * TAU);
      } else if (kind < 0.78) {
        // Pilze: kleine Gruppe Fliegenpilze oder Steinpilze
        if (!frei(x, z, 0.8, y, y + 0.8)) continue;
        const rot = rnd() < 0.6;
        for (let j = 0; j < 3; j++) {
          const px = x + (rnd() - 0.5) * 1.4;
          const pz = z + (rnd() - 0.5) * 1.4;
          const hh = 0.35 + rnd() * 0.3;
          put(G.zyl, C_PILZ_STIEL, px, y + hh / 2, pz, 0.1, hh, 0.1);
          put(G.halb, rot ? C_PILZ_ROT : C_PILZ_BRAUN, px, y + hh + 0.12, pz, 0.36, 1, 0.36);
          if (rot && hi) put(G.box, C_PILZ_STIEL, px + 0.08, y + hh + 0.24, pz - 0.05, 0.08, 0.05, 0.08);
        }
      } else if (kind < 0.92) {
        if (!frei(x, z, 2, y, y + 1.6)) continue;
        const r = 0.8 + rnd() * 1.2;
        put(G.dode, rnd() < 0.5 ? C_STEIN : C_STEIN_D, x, y + r * 0.3, z, r, r * 0.7, r * 1.1, rnd() * TAU);
        put(G.halb, C_MOOS, x, y + r * 0.72, z, r * 0.78, r * 0.55, r * 0.88, rnd() * TAU);
      } else {
        // liegender, bemooster Stamm
        const a = rnd() * TAU;
        const L = 5 + rnd() * 5;
        if (!frei(x, z, L / 2 + 0.6, y, y + 1.4)) continue;
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
        m4.compose(v.set(x, y + 0.45, z), q, s.set(0.5, L, 0.5));
        bau.add(G.zyl, C_STAMM_D, m4);
        put(G.halb, C_MOOS, x, y + 0.9, z, 0.55, 0.4, L * 0.3, -a + Math.PI / 2);
      }
      n++;
    }
  }

  // --- Baumhäuser ------------------------------------------------------------------------------------
  {
    let n = 0;
    for (let tries = 0; tries < 400 && n < 3; tries++) {
      const k = Math.floor(rnd() * t.n);
      if (t.py[k] < 20) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const o = t.wh[k] + 14 + rnd() * 12;
      const x = t.px[k] - t.tz[k] * o * side;
      const z = t.pz[k] + t.tx[k] * o * side;
      if (pond(x, z) || imRiesen(x, z, 6)) continue;
      const y = grund(x, z);
      const top = Math.min(t.py[k] - 3, 30);
      if (top < y + 12 || !frei(x, z, 7, y, top + 12)) continue;
      // Baum mit dickem Stamm, Plattform, Hütte, Dach, Leiter
      put(G.zyl, C_STAMM, x, y + (top + 9 - y) / 2, z, 1.2, top + 9 - y, 1.2);
      put(G.box, C_HOLZ_D, x, top - 0.2, z, 7, 0.4, 7, k);
      put(G.box, C_HOLZ, x + 0.4, top + 1.6, z, 4.2, 3.2, 3.8, k);
      put(G.pyr, C_DACH, x + 0.4, top + 4.2, z, 3.6, 2.2, 3.4, k + Math.PI / 4);
      put(G.box, C_FENSTER, x + 0.4 + Math.cos(k) * 2.12, top + 1.9, z - Math.sin(k) * 2.12, 1, 1, 1, k);
      for (let j = 0; j < 4; j++) put(G.box, C_HOLZ_D, x + (j < 2 ? 3.3 : -3.3), top + 0.6, z + (j % 2 === 0 ? 3.3 : -3.3), 0.2, 1.2, 0.2);
      // Leiter bis zum Boden
      const lx = x - 3.6;
      for (let h = y + 0.4; h < top; h += 0.6) put(G.box, C_HOLZ, lx, h, z, 0.15, 0.12, 0.9);
      put(G.box, C_HOLZ_D, lx, (y + top) / 2, z - 0.45, 0.12, top - y, 0.12);
      put(G.box, C_HOLZ_D, lx, (y + top) / 2, z + 0.45, 0.12, top - y, 0.12);
      const c = pick(C_LAUB);
      for (let j = 0; j < 4; j++) put(G.ico, shade(c, 0.9 + rnd() * 0.2), x + (rnd() - 0.5) * 6, top + 9 + rnd() * 3, z + (rnd() - 0.5) * 6, 4.5, 3.6, 4.5, rnd() * TAU);
      n++;
    }
  }

  // --- Feste Netze ----------------------------------------------------------------------------------
  {
    const geo = bau.build();
    const mat = toonMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Wald';
    group.add(mesh);
    disposables.push(geo, mat);
    if (hi) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(0.05));
      ol.name = 'outline';
      group.add(ol);
    }
  }

  // --- Lichtschächte: schräg durch die Kronen, golden und halbdurchsichtig ------------------------------
  {
    const shaft: [number, number, number, number][] = [];
    const sun = new THREE.Vector3(...world.theme.sunDir).normalize();
    let n = 0;
    for (let tries = 0; tries < 300 && n < (hi ? 9 : 5); tries++) {
      const k = Math.floor(rnd() * t.n);
      if (t.py[k] > 12) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const o = t.wh[k] + 3 + rnd() * 14;
      const x = t.px[k] - t.tz[k] * o * side;
      const z = t.pz[k] + t.tx[k] * o * side;
      const y = grund(x, z);
      const L = 46;
      const w = 2.2 + rnd() * 2.2;
      const top: V3 = [x + sun.x * L, y + sun.y * L, z + sun.z * L];
      // (kein Schacht quer über einer Fahrbahn oder einem Steg: dort stünde er wie eine Scheibe im Weg)
      let clear = true;
      for (let u = 0.08; u <= 1 && clear; u += 0.08) clear = frei(x + sun.x * L * u, z + sun.z * L * u, w, y + sun.y * L * u - 1, y + sun.y * L * u + 1);
      if (!clear) continue;
      // ein breites Band, das zur Sonne hin schmaler wird (zwei gekreuzte Flächen); unten verblasst es
      for (const a of [0, Math.PI / 2]) {
        const ox = Math.cos(a) * w;
        const oz = Math.sin(a) * w;
        shaft.push([x - ox, y, z - oz, 0], [x + ox, y, z + oz, 0], [top[0] + ox * 0.6, top[1], top[2] + oz * 0.6, 1]);
        shaft.push([x - ox, y, z - oz, 0], [top[0] + ox * 0.6, top[1], top[2] + oz * 0.6, 1], [top[0] - ox * 0.6, top[1], top[2] - oz * 0.6, 1]);
      }
      n++;
    }
    if (shaft.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(shaft.flatMap((p) => [p[0], p[1], p[2]]), 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(shaft.flatMap((p) => [1, 0.9, 0.6, 0.02 + 0.16 * p[3]]), 4));
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Lichtschächte';
      mesh.renderOrder = 3;
      group.add(mesh);
      disposables.push(geo, mat);
    }
  }

  // --- Bewegtes: fallende Blätter, Eichhörnchen, Vögel – je Bild neu geschrieben ----------------------
  const MAXV = 3 * 1400;
  const pos = new Float32Array(MAXV * 3);
  const col = new Float32Array(MAXV * 3);
  const dynGeo = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const ca = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  dynGeo.setAttribute('position', pa);
  dynGeo.setAttribute('color', ca);
  dynGeo.setDrawRange(0, 0);
  dynGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const dynMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const dynMesh = new THREE.Mesh(dynGeo, dynMat);
  dynMesh.frustumCulled = false;
  dynMesh.name = 'Laub und Tiere';
  group.add(dynMesh);
  disposables.push(dynGeo, dynMat);
  let nv = 0;
  const tri = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, c: RGB): void => {
    if (nv + 3 > MAXV) return;
    for (const [x, y, z] of [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ]) {
      pos[nv * 3] = x;
      pos[nv * 3 + 1] = y;
      pos[nv * 3 + 2] = z;
      col[nv * 3] = c[0];
      col[nv * 3 + 1] = c[1];
      col[nv * 3 + 2] = c[2];
      nv++;
    }
  };
  // Eichhörnchen an Stämmen nahe der Strecke (an den Kronenbäumen und am Riesenstamm)
  const hoernchen: { g: Giant; a: number; lo: number; hi: number; speed: number; ph: number }[] = [];
  for (const g of [TRUNK_A, TREE_B, TREE_C2, TREE_C, OAK_E, TRUNK_A]) {
    hoernchen.push({ g, a: rnd() * TAU, lo: 4, hi: g.crown - 4, speed: 0.25 + rnd() * 0.15, ph: rnd() * 10 });
  }
  const C_FELL = rgb(0xc8622a);
  const C_FELL_H = rgb(0xe8a060);
  // Vögel kreisen über den Kronen
  const voegel: { x: number; z: number; y: number; r: number; w: number; ph: number }[] = [];
  for (let k = 0; k < (hi ? 9 : 5); k++) voegel.push({ x: world.center.x + (rnd() - 0.5) * 200, z: world.center.z + (rnd() - 0.5) * 200, y: 70 + rnd() * 30, r: 20 + rnd() * 30, w: (0.15 + rnd() * 0.15) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * TAU });
  const C_VOGEL = rgb(0x3a302c);
  const LEAVES = hi ? 70 : 36;
  const leafCol = C_LAUB;
  const leafSeed = Array.from({ length: LEAVES }, () => [rnd(), rnd(), rnd(), rnd()]);

  return {
    group,
    update(time, _dt, cam) {
      nv = 0;
      // fallende Blätter in einem Würfel um die Kamera: jedes fällt in 9 s 18 m und taumelt; dann von oben neu
      const B = 36;
      for (let k = 0; k < LEAVES; k++) {
        const [a, b2, c, d] = leafSeed[k];
        const u = (time / 9 + a) % 1;
        const cx = Math.floor((cam.x - (b2 - 0.5) * B) / B) * B + b2 * B;
        const cz = Math.floor((cam.z - (c - 0.5) * B) / B) * B + c * B;
        const x = cx + Math.sin(time * 1.3 + d * 9) * 1.4;
        const z = cz + Math.cos(time * 1.1 + d * 7) * 1.4;
        const y = cam.y + 12 - u * 22;
        const r = 0.28;
        const sp = time * (2 + d * 2);
        const ux = Math.cos(sp) * r;
        const uz = Math.sin(sp) * r;
        const wy = Math.sin(sp * 1.3) * r * 0.8;
        const lc = leafCol[k % leafCol.length];
        tri(x - ux, y - wy, z - uz, x + uz * 0.6, y + 0.12, z - ux * 0.6, x + ux, y + wy, z + uz, lc);
        tri(x - ux, y - wy, z - uz, x + ux, y + wy, z + uz, x - uz * 0.6, y - 0.12, z + ux * 0.6, shade(lc, 0.85));
      }
      // Eichhörnchen: flitzen am Stamm hinauf und hinunter, halten kurz an
      for (const h of hoernchen) {
        const ph = (time * h.speed + h.ph) % 2;
        const up = ph < 1;
        const k = up ? ph : 2 - ph;
        const eased = k < 0.15 ? 0 : k > 0.85 ? 1 : (k - 0.15) / 0.7;
        const y = h.lo + (h.hi - h.lo) * eased;
        const a = h.a + y * 0.08;
        const R = (h.g === TRUNK_A ? 13.9 : h.g.r * 0.95) + 0.35;
        const x = h.g.x + Math.cos(a) * R;
        const z = h.g.z + Math.sin(a) * R;
        if (Math.hypot(x - cam.x, z - cam.z) > 140) continue;
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        const tx = -nz;
        const tz = nx;
        const dir = up ? 1 : -1;
        // Körper (zwei Dreiecke), Kopf, buschiger Schwanz
        const L = 0.55;
        tri(x + tx * 0.18, y - dir * L, z + tz * 0.18, x - tx * 0.18, y - dir * L, z - tz * 0.18, x + nx * 0.15, y + dir * L, z + nz * 0.15, C_FELL);
        tri(x + nx * 0.25, y + dir * L, z + nz * 0.25, x + tx * 0.12, y + dir * (L + 0.3), z + tz * 0.12, x - tx * 0.12, y + dir * (L + 0.3), z - tz * 0.12, C_FELL_H);
        const sw = Math.sin(time * 9 + h.ph) * 0.2;
        tri(x + nx * 0.3, y - dir * L, z + nz * 0.3, x + nx * 0.9 + tx * (0.35 + sw), y - dir * (L + 0.7), z + nz * 0.9 + tz * (0.35 + sw), x + nx * 0.9 - tx * 0.35, y - dir * (L + 0.3), z + nz * 0.9 - tz * 0.35, C_FELL);
      }
      // Vögel: ein flaches V mit schlagenden Flügeln
      for (const b of voegel) {
        const a = b.ph + time * b.w;
        const x = b.x + Math.cos(a) * b.r;
        const z = b.z + Math.sin(a) * b.r;
        const y = b.y + Math.sin(time * 0.7 + b.ph) * 2;
        const hx = -Math.sin(a) * Math.sign(b.w);
        const hz = Math.cos(a) * Math.sign(b.w);
        const flap = Math.sin(time * 8 + b.ph) * 0.9;
        const W = 1.6;
        tri(x + hx * 0.6, y, z + hz * 0.6, x - hx * 0.4 + hz * W, y + flap, z - hz * 0.4 - hx * W, x - hx * 0.5, y, z - hz * 0.5, C_VOGEL);
        tri(x + hx * 0.6, y, z + hz * 0.6, x - hx * 0.5, y, z - hz * 0.5, x - hx * 0.4 - hz * W, y + flap, z - hz * 0.4 + hx * W, C_VOGEL);
      }
      dynGeo.setDrawRange(0, nv);
      if (nv > 0) {
        pa.clearUpdateRanges();
        pa.addUpdateRange(0, nv * 3);
        pa.needsUpdate = true;
        ca.clearUpdateRanges();
        ca.addUpdateRange(0, nv * 3);
        ca.needsUpdate = true;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

