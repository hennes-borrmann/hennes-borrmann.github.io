// Kulisse der Talsperre: Abend in einer Gebirgsschlucht, gesperrt von einer großen Staumauer.
//
// Die Form der Landschaft (Seebecken, Schlucht, Fluss, Berge) liefert talsperreLand.ts; das Gelände selbst zeichnet
// world.ts. Hier kommt dazu:
//   – Wasser: der Stausee (von oben und – beim Tauchen – von unten) und der Fluss unterhalb der Mauer, beide mit dem
//     Wasserbild der Welt (World.liquid: derselbe Shader wie das Meer der anderen Strecken, kein neuer);
//   – Bergwald: Fichten an den Hängen über dem See und über der Schlucht, Laubbäume unten am Fluss;
//   – Fels: Blöcke am Fuß der Wände, im Flussbett und die Felsnase, um die die Talstraße herumführt;
//   – das versunkene Dorf: Beim Aufstauen ging ein Dorf unter. Auf seiner alten Gasse taucht die Strecke durch den See;
//     Hausmauern stehen am Grund, und der Kirchturm ragt noch aus dem Wasser (sein Dach sieht man von der Krone aus);
//   – Wärterhaus am westlichen Widerlager, ein Turmdrehkran am östlichen (sein Ausleger dreht sich langsam),
//     die Hochspannungsleitung vom Krafthaus den Osthang hinauf;
//   – ein Bergpanorama rundum (ohne Dunst gezeichnet, der Dunst steckt in den Farben).
//
// Reine Kulisse: mindestens RAND Meter neben jeder Fahrbahnkante, über einer Fahrbahn nichts unter LUFT Metern, nichts
// im Flugkorridor über der Schlucht. Alles mit festem Zufall aus der Strecke abgeleitet; im Lauf wird nichts angelegt.
// Keine eigenen Shader, keine Lichtquellen.
//
// Zeichenaufrufe (hoch): Bauten und Pflanzen + Kontur, Leuchtendes, See und Fluss, Seeoberfläche von unten, Panorama,
// Kranausleger = 7. Niedrig: ohne Kontur = 6.

import * as THREE from 'three';
import { EDGE_GLIDE, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';
import { CHANNEL, DAM_AIR, DAM_CZ, DAM_WATER, DAM_FOOT, DAM_X0, DAM_X1, FLOOR, LAKE, RIVER, RIVER_HALF, RIVER_Y, damRadius, inLake, lineDist, polyDist } from './talsperreLand';

/** Mindestabstand zur Fahrbahnkante (Meter) und freier Raum über einer Fahrbahn. */
const RAND = 3;
const LUFT = 10.6;
const TAU = Math.PI * 2;

const C_FICHTE = rgb(0x2c5a3e);
const C_FICHTE_D = rgb(0x224a33);
const C_FICHTE_H = rgb(0x3a6d4a);
const C_STAMM = rgb(0x5a3e2b);
const C_LAUB = [0x5f8f3a, 0x6f9c42, 0x7fa64a, 0x4f8034, 0xb08a3a].map(rgb);
const C_FELS = rgb(0x8d8377);
const C_FELS_D = rgb(0x6f675d);
const C_FELS_H = rgb(0xa79d8f);
const C_PUTZ = rgb(0xece2cf);
const C_PUTZ_D = rgb(0xd6c9b0);
const C_DACH = rgb(0x8e3f2e);
const C_DACH_D = rgb(0x6c2f22);
const C_HOLZ = rgb(0x7a5232);
const C_WARM = rgb(0xffd590);
const C_STAHL = rgb(0x6a6f78);
const C_STAHL_D = rgb(0x45494f);
const C_GELB = rgb(0xf4b82a);
const C_ROT = rgb(0xc93a2a);
const C_WEISS = rgb(0xf2efe8);
const C_ALGE = rgb(0x4d6a52);
const C_STEIN = rgb(0x8b8478);
const C_KUPFER = rgb(0x4f8c74);

export function buildTalsperreLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail > 0;
  const rnd = seeded(2121 + t.index * 7);
  const T = t.total;
  const sea = t.sea;
  // (auf dem gezeichneten Gelände – an steilen Hängen liegt es unter heightAt, und was darauf stünde, schwebte)
  const grund = (x: number, z: number): number => world.groundY(x, z);

  // --- Platz ---------------------------------------------------------------------------------------
  /** Abstand zur nächsten Fahrbahnkante über alle Wege (um Tunnel liegt Fels: dort erst weiter draußen). */
  const kante = (x: number, z: number): number => {
    let best = Infinity;
    for (let k = 0; k < T; k += 2) {
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k] - (t.edge[k] & EDGE_TUNNEL ? 6 : 0);
      if (d < best) best = d;
    }
    return best;
  };
  /** Höchste Fahrbahn (oder Fluglinie) in der Nähe – darunter muss ein Ding bleiben, wenn es über ihr stünde. */
  const deckel = (x: number, z: number, r: number): number => {
    let low = Infinity;
    for (let k = 0; k < T; k += 2) {
      const d = Math.hypot(x - t.px[k], z - t.pz[k]);
      const glide = (t.edge[k] & EDGE_GLIDE) !== 0;
      const reach = t.wh[k] + r + (glide ? 10 : 2);
      if (d > reach) continue;
      low = Math.min(low, t.py[k] - (glide ? 16 : 0));
    }
    return low;
  };
  /** Darf hier etwas mit Halbmesser r und Höhe h stehen? */
  const frei = (x: number, z: number, r: number, h: number, y: number): boolean => {
    if (kante(x, z) < r + RAND) {
      // dicht neben einer Fahrbahn nur, wenn es ganz unter ihr bleibt (an einem Hang darunter)
      return y + h < deckel(x, z, r) - LUFT;
    }
    return y + h < deckel(x, z, r) - 2 || deckel(x, z, r) === Infinity;
  };
  /** Liegt der Punkt im Fluss, in der Rinne oder in der Mauer? */
  const nass = (x: number, z: number, r: number): boolean => {
    if (lineDist(RIVER, x, z) < RIVER_HALF + 1.5 + r) return true;
    if (lineDist(CHANNEL, x, z) < 12 + r) return true;
    if (x > DAM_X0 - 6 && x < DAM_X1 + 6) {
      const rr = damRadius(x, z);
      if (rr > DAM_AIR - 3 - r && rr < DAM_WATER + DAM_FOOT + 3 + r) return true;
    }
    return false;
  };

  const bau = new MeshBuilder();
  const glow = new MeshBuilder();
  const box = (b: MeshBuilder, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: RGB, yaw = 0, top?: RGB): void => b.box(x, y, z, sx, sy, sz, c, yaw, top);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const G = {
    kegel6: new THREE.ConeGeometry(1, 1, 6),
    kegel7: new THREE.ConeGeometry(1, 1, 7),
    zyl5: new THREE.CylinderGeometry(1, 1, 1, 5),
    zyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    ico0: new THREE.IcosahedronGeometry(1, 0),
    dode: new THREE.DodecahedronGeometry(1, 0),
    pyr: new THREE.ConeGeometry(1, 1, 4),
  };
  const put = (b: MeshBuilder, geo: THREE.BufferGeometry, c: RGB, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): void => {
    e.set(rx, ry, rz);
    q.setFromEuler(e);
    m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz));
    b.add(geo, c, m4);
  };

  // --- Wasser: Stausee und Fluss ---------------------------------------------------------------------
  {
    const top = new MeshBuilder();
    const under = new MeshBuilder();
    const w: RGB = [1, 1, 1];
    // See: Raster über dem Becken – die Ufer schneidet das Gelände (es liegt dort über dem Spiegel).
    const C = 8;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, z] of LAKE) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    const inside = (x: number, z: number): boolean => {
      if (polyDist(LAKE, x, z) > 14) return false;
      // nicht südlich der Wasserseite der Mauer (dort ist die Luftseite und die Schlucht)
      if (x > DAM_X0 - 10 && x < DAM_X1 + 10 && damRadius(x, z) < DAM_WATER + 1) return false;
      // und nicht weit draußen im Süden (Schlucht), wo das Gelände tiefer als der Spiegel liegt
      return z < DAM_CZ - DAM_WATER + 22;
    };
    // Der Stollen am Ostufer beginnt am Wasser und taucht unter den Spiegel: In seiner Röhre darf kein Wasser stehen.
    // Felder nahe dem Stollen werden fein geteilt; was in der Röhre liegt (der nächste Abschnitt um den Stollen ist
    // ein Tunnelabschnitt und das Stück liegt innerhalb seiner Wände), fällt weg. Die Grenze liegt in der Wand.
    // Ebenso das, was kurz vor dem Portal auf der Straße stünde (sie liegt dort schon knapp unter dem Spiegel).
    const near: number[] = [];
    for (let i = 0; i < T; i++) {
      if ((t.edge[i] & EDGE_TUNNEL) === 0) continue;
      for (let k = -24; k <= 24; k++) near.push((i + k + T) % T);
    }
    const inTube = (x: number, z: number): boolean => {
      let best = -1;
      let bd = Infinity;
      for (const i of near) {
        const d = (x - t.px[i]) ** 2 + (z - t.pz[i]) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) return false;
      const lat = (x - t.px[best]) * rightX(t, best) + (z - t.pz[best]) * rightZ(t, best);
      if ((t.edge[best] & EDGE_TUNNEL) !== 0) return Math.abs(lat) < t.wh[best] + 1.2;
      // (vor dem Portal: wo die Straße an Land schon knapp unter dem Spiegel liegt, steht kein Wasser auf ihr)
      return !t.deep[best] && t.py[best] + lat * t.bank[best] < sea + 0.1 && Math.abs(lat) < t.wh[best] + 0.6;
    };
    const tubeNear = (x: number, z: number): boolean => {
      for (const i of near) if ((t.edge[i] & EDGE_TUNNEL) !== 0 && Math.hypot(x - t.px[i], z - t.pz[i]) < t.wh[i] + 2 + C) return true;
      return false;
    };
    for (let x = x0 - 14; x < x1 + 14; x += C) {
      for (let z = z0 - 14; z < z1 + 14; z += C) {
        const ok = inside(x, z) || inside(x + C, z) || inside(x, z + C) || inside(x + C, z + C);
        if (!ok) continue;
        // Ecken, die am Dammfuß liegen, an die Wasserseite der Mauer ziehen (so schließt das Wasser dicht an)
        const P = (px: number, pz: number): V3 => {
          if (px > DAM_X0 - 10 && px < DAM_X1 + 10) {
            const r = damRadius(px, pz);
            if (r < DAM_WATER + 1) {
              const a = Math.atan2(px, DAM_CZ - pz);
              const rr = DAM_WATER + 0.6;
              return [Math.sin(a) * rr, sea, DAM_CZ - Math.cos(a) * rr];
            }
          }
          return [px, sea, pz];
        };
        const lo = (p: V3): V3 => [p[0], p[1] - 0.05, p[2]];
        // (fein geteilt nur, wo wirklich ein Stück in der Röhre liegt)
        let S = tubeNear(x + C / 2, z + C / 2) ? 10 : 1;
        const drop: boolean[] = [];
        if (S > 1) {
          for (let u = 0; u < S; u++) for (let v2 = 0; v2 < S; v2++) drop.push(inTube(x + (u + 0.5) * (C / S), z + (v2 + 0.5) * (C / S)));
          if (!drop.includes(true)) S = 1;
        }
        const f = C / S;
        for (let u = 0; u < S; u++) {
          for (let v2 = 0; v2 < S; v2++) {
            const qx = x + u * f;
            const qz = z + v2 * f;
            if (S > 1 && drop[u * S + v2]) continue;
            const a = P(qx, qz);
            const b = P(qx + f, qz);
            const c = P(qx + f, qz + f);
            const d = P(qx, qz + f);
            top.quad(a, d, c, b, w);
            under.quad(lo(a), lo(d), lo(c), lo(b), w);
          }
        }
      }
    }
    // Fluss: vom Tosbecken am Mauerfuß nach Süden, über die Ufer hinaus (das Gelände schneidet die Ränder)
    const half = RIVER_HALF + 3;
    for (let k = 0; k + 1 < RIVER.length; k++) {
      const [ax, az] = RIVER[k];
      const [bx, bz] = RIVER[k + 1];
      const l = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / l;
      const nz = (bx - ax) / l;
      const ext = k === 0 ? 10 : 2;
      const sa: V3 = [ax - (bx - ax) / l * ext, RIVER_Y, az - (bz - az) / l * ext];
      const wa = k === 0 ? half + 9 : half;
      top.quad([sa[0] + nx * wa, RIVER_Y, sa[2] + nz * wa], [bx + nx * half, RIVER_Y, bz + nz * half], [bx - nx * half, RIVER_Y, bz - nz * half], [sa[0] - nx * wa, RIVER_Y, sa[2] - nz * wa], w);
    }
    const topMat = world.liquid(th.liquid);
    const topMesh = new THREE.Mesh(top.build(), topMat);
    group.add(topMesh);
    disposables.push(topMesh.geometry);
    if (th.under) {
      const underMat = world.liquid(th.under.surface, true);
      const underMesh = new THREE.Mesh(under.build(), underMat);
      group.add(underMesh);
      disposables.push(underMesh.geometry);
    }
  }

  // --- Bergwald und Talbäume -----------------------------------------------------------------------
  {
    const fichte = (x: number, y: number, z: number, k: number): void => {
      const tone = rnd();
      const c1 = tone < 0.33 ? C_FICHTE : tone < 0.66 ? C_FICHTE_D : C_FICHTE_H;
      put(bau, G.zyl5, C_STAMM, x, y + 1.2 * k, z, 0.3 * k, 2.4 * k, 0.3 * k);
      put(bau, G.kegel7, c1, x, y + 3.6 * k, z, 2.3 * k, 3.6 * k, 2.3 * k, rnd() * TAU);
      put(bau, G.kegel7, shade(c1, 1.08), x, y + 5.6 * k, z, 1.75 * k, 3.0 * k, 1.75 * k, rnd() * TAU);
      put(bau, G.kegel6, shade(c1, 1.15), x, y + 7.4 * k, z, 1.15 * k, 2.6 * k, 1.15 * k, rnd() * TAU);
    };
    const laub = (x: number, y: number, z: number, k: number): void => {
      const c = C_LAUB[Math.floor(rnd() * C_LAUB.length)];
      put(bau, G.zyl5, C_STAMM, x, y + 1.4 * k, z, 0.28 * k, 2.8 * k, 0.28 * k);
      put(bau, G.ico0, c, x, y + 3.8 * k, z, 2.2 * k, 1.9 * k, 2.2 * k, rnd() * TAU);
      put(bau, G.ico0, shade(c, 1.1), x + 0.8 * k, y + 4.6 * k, z - 0.4 * k, 1.4 * k, 1.3 * k, 1.4 * k, rnd() * TAU);
    };
    const want = hi ? 300 : 190;
    let n = 0;
    const cx = world.center.x;
    const cz = world.center.z;
    for (let tries = 0; tries < want * 14 && n < want; tries++) {
      // dichter nahe der Strecke, lichter weit draußen
      const a = rnd() * TAU;
      const d = 30 + rnd() * rnd() * 420;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (inLake(x, z, 3) || nass(x, z, 3)) continue;
      const y = grund(x, z);
      if (y < sea + 1 && polyDist(FLOOR, x, z) > 0) continue;
      // Hangneigung: an Felswänden kein Wald
      const gx = (grund(x + 2, z) - grund(x - 2, z)) / 4;
      const gz = (grund(x, z + 2) - grund(x, z - 2)) / 4;
      if (Math.hypot(gx, gz) > 0.95) continue;
      // Waldgrenze und Lichtungen
      if (y > 175 || noise(x * 0.02 + 4, z * 0.02) < 0.32) continue;
      const k = 0.85 + rnd() * 0.6;
      if (!frei(x, z, 2.4 * k, 8.8 * k, y)) continue;
      if (y < 30 && rnd() < 0.55) laub(x, y - 0.3, z, k);
      else fichte(x, y - 0.3, z, k);
      n++;
    }
  }

  // --- Fels: Blöcke am Fuß der Wände, im Flussbett; die Felsnase --------------------------------------
  {
    const block = (x: number, y: number, z: number, r: number): void => {
      const c = rnd() < 0.4 ? C_FELS_D : rnd() < 0.5 ? C_FELS : C_FELS_H;
      put(bau, rnd() < 0.5 ? G.dode : G.ico0, c, x, y + r * 0.35, z, r * (0.9 + rnd() * 0.4), r * (0.6 + rnd() * 0.4), r * (0.9 + rnd() * 0.4), rnd() * TAU, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4);
    };
    const want = hi ? 150 : 70;
    let n = 0;
    for (let tries = 0; tries < want * 20 && n < want; tries++) {
      const x = -140 + rnd() * 300;
      const z = 10 + rnd() * 340;
      const df = polyDist(FLOOR, x, z);
      // am Rand des Talbodens (Fuß der Wände) und im Flussbett
      const rv = lineDist(RIVER, x, z);
      const atWall = df > -10 && df < 14;
      const inRiver = rv < RIVER_HALF + 3 && rv > RIVER_HALF - 4;
      if (!atWall && !inRiver) continue;
      const r = inRiver ? 0.8 + rnd() * 1.4 : 1.4 + rnd() * 3.4;
      const y = grund(x, z);
      if (!frei(x, z, r, r, y)) continue;
      block(x, inRiver ? Math.min(y, RIVER_Y - 0.3) : y, z, r);
      n++;
    }
    // Felsnase: die Kuppe innen in der Schleife der Talstraße (westlich der Schleuse)
    let fx = 0;
    let fz = 0;
    let fk = 0;
    const kWin = t.def.branches?.findIndex((b) => b.shortcut === 'window') ?? -1;
    if (kWin >= 0) {
      const b = t.branches[kWin];
      // Mitte zwischen der Schleuse und dem westlichsten Punkt der Schleife
      let west = b.from;
      for (let i = b.from; i !== b.to; i = t.next[i]) if (t.px[i] < t.px[west]) west = i;
      const mid = b.first + (b.count >> 1);
      fx = (t.px[west] + t.px[mid]) / 2;
      fz = (t.pz[west] + t.pz[mid]) / 2;
      fk = 1;
    }
    if (fk > 0) {
      for (let k = 0; k < (hi ? 26 : 14); k++) {
        const a = rnd() * TAU;
        const d = rnd() * 14;
        const x = fx + Math.cos(a) * d;
        const z = fz + Math.sin(a) * d;
        const r = 3.5 + (1 - d / 14) * 5 + rnd() * 2;
        const y = grund(x, z);
        if (kante(x, z) < r * 0.9 + RAND) continue;
        block(x, y - 0.5, z, r);
      }
      // ein paar Kiefern oben drauf
      for (let k = 0; k < 4; k++) {
        const x = fx + (rnd() - 0.5) * 8;
        const z = fz + (rnd() - 0.5) * 8;
        if (kante(x, z) < 6) continue;
        const y = grund(x, z) + 4;
        put(bau, G.zyl5, C_STAMM, x, y + 1.6, z, 0.3, 3.2, 0.3);
        put(bau, G.ico0, C_FICHTE_H, x, y + 4, z, 2.4, 1.2, 2.4, rnd() * TAU);
      }
    }
  }

  // --- Das versunkene Dorf: Hausmauern am Seegrund entlang der alten Gasse, der Kirchturm ragt heraus ---------
  let kirche: V3 | null = null;
  {
    // Abschnitte der Tauchstrecke
    const deep: number[] = [];
    for (let i = 0; i < t.n; i++) if (t.deep[i] && t.py[i] < sea - 4) deep.push(i);
    if (deep.length > 0) {
      const mid = deep[Math.floor(deep.length * 0.3)];
      // Kirche: links (nördlich) der Gasse, gut 24 m daneben
      const side = -1;
      const off = t.wh[mid] + 20;
      const kx = t.px[mid] + -t.tz[mid] * off * side;
      const kz = t.pz[mid] + t.tx[mid] * off * side;
      const gy = grund(kx, kz);
      const yaw = Math.atan2(t.tx[mid], t.tz[mid]);
      kirche = [kx, gy, kz];
      const turmH = sea + 9 - gy;
      // Turm: Schaft aus Bruchstein, unten mit Algen; Schallfenster; Spitzhelm
      box(bau, kx, gy + turmH / 2, kz, 5.6, turmH, 5.6, C_STEIN, yaw);
      box(bau, kx, gy + (sea - gy) / 2, kz, 5.75, sea - gy, 5.75, C_ALGE, yaw);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const wx = kx + (Math.cos(yaw) * dx + Math.sin(yaw) * dz) * 2.86;
        const wz = kz + (-Math.sin(yaw) * dx + Math.cos(yaw) * dz) * 2.86;
        box(glow, wx, sea + 5.5, wz, dx !== 0 ? 0.1 : 1.2, 2.2, dz !== 0 ? 0.1 : 1.2, rgb(0x20242c), yaw);
        // Zifferblatt
        box(glow, wx, sea + 2.4, wz, dx !== 0 ? 0.12 : 1.5, 1.5, dz !== 0 ? 0.12 : 1.5, C_WEISS, yaw);
      }
      box(bau, kx, sea + 8.9, kz, 6.2, 0.6, 6.2, C_STEIN, yaw);
      put(bau, G.pyr, C_KUPFER, kx, sea + 13.3, kz, 4.4, 8.4, 4.4, yaw + Math.PI / 4);
      put(bau, G.zyl5, C_GELB, kx, sea + 18.2, kz, 0.08, 1.6, 0.08);
      box(bau, kx, sea + 18.6, kz, 0.9, 0.1, 0.1, C_GELB, yaw);
      // Kirchenschiff: verfallene Mauern unter Wasser, vom Turm weg (fort von der Gasse)
      const ax = -t.tz[mid] * side;
      const az = t.tx[mid] * side;
      const lx = t.tx[mid];
      const lz = t.tz[mid];
      for (const d of [-1, 1]) box(bau, kx + ax * 11 + lx * d * 4.6, gy + 3, kz + az * 11 + lz * d * 4.6, 0.8, 6, 16, C_ALGE, Math.atan2(ax, az));
      box(bau, kx + ax * 19, gy + 2.5, kz + az * 19, 9.2, 5, 0.8, C_ALGE, Math.atan2(ax, az));
      // Häuser entlang der Gasse: Mauerreste auf beiden Seiten, ohne Dach
      for (let k = 2; k < deep.length - 2; k += 9) {
        if (rnd() < 0.35) continue;
        const i = deep[k];
        const sgn = rnd() < 0.5 ? -1 : 1;
        const dist = t.wh[i] + 4.5 + rnd() * 6;
        const hx = t.px[i] - t.tz[i] * dist * sgn;
        const hz = t.pz[i] + t.tx[i] * dist * sgn;
        if (kante(hx, hz) < 3.5 + RAND || Math.hypot(hx - kx, hz - kz) < 22) continue;
        const hy = grund(hx, hz);
        const hyaw = Math.atan2(t.tx[i], t.tz[i]) + (rnd() - 0.5) * 0.3;
        const hw = 6 + rnd() * 3;
        const hd = 5 + rnd() * 3;
        const hh = 2.5 + rnd() * 3;
        const ca = Math.cos(hyaw);
        const sa = Math.sin(hyaw);
        const L = (lx: number, lz: number): [number, number] => [hx + lx * ca + lz * sa, hz - lx * sa + lz * ca];
        const wallC = rnd() < 0.5 ? C_ALGE : mixRgb(C_STEIN, C_ALGE, 0.5);
        for (const [lx, lz, sxx, szz] of [
          [0, hd / 2, hw, 0.6],
          [0, -hd / 2, hw, 0.6],
          [hw / 2, 0, 0.6, hd],
          [-hw / 2, 0, 0.6, hd],
        ]) {
          const [px, pz] = L(lx, lz);
          const h = hh * (0.5 + rnd() * 0.5);
          box(bau, px, hy + h / 2 - 0.3, pz, sxx, h, szz, wallC, hyaw);
        }
      }
    }
  }

  // --- Wärterhaus am westlichen Widerlager -------------------------------------------------------------
  const house = (x: number, z: number, yaw: number, w: number, d: number, h: number): void => {
    const y = grund(x, z) - 0.4;
    box(bau, x, y + h / 2, z, w, h, d, C_PUTZ, yaw, C_PUTZ_D);
    // Satteldach
    const ca = Math.cos(yaw);
    const sa = Math.sin(yaw);
    const L = (lx: number, ly: number, lz: number): V3 => [x + lx * ca + lz * sa, y + ly, z - lx * sa + lz * ca];
    const r = h + 3;
    const ow = w / 2 + 0.6;
    const od = d / 2 + 0.6;
    bau.quad(L(-ow, h, od), L(ow, h, od), L(ow, r, 0), L(-ow, r, 0), C_DACH);
    bau.quad(L(ow, h, -od), L(-ow, h, -od), L(-ow, r, 0), L(ow, r, 0), C_DACH_D);
    bau.tri(L(-w / 2, h, d / 2), L(-w / 2, r - 0.4, 0), L(-w / 2, h, -d / 2), C_PUTZ_D);
    bau.tri(L(w / 2, h, -d / 2), L(w / 2, r - 0.4, 0), L(w / 2, h, d / 2), C_PUTZ_D);
    // Fenster (warm erleuchtet) und Fensterläden
    for (const lx of [-w / 4, w / 4]) {
      for (const lz of [d / 2 + 0.03, -d / 2 - 0.03]) {
        const p = L(lx, h * 0.55, lz);
        box(glow, p[0], p[1], p[2], 1.1, 1.3, 0.06, C_WARM, yaw);
        const pl = L(lx - 0.8, h * 0.55, lz);
        box(bau, pl[0], pl[1], pl[2], 0.45, 1.4, 0.1, rgb(0x3f6b4a), yaw);
      }
    }
    const tp = L(0, 0, d / 2 + 0.05);
    box(bau, tp[0], y + 1.1, tp[2], 1.1, 2.2, 0.1, C_HOLZ, yaw);
  };
  {
    // Ein Platz westlich der Krone, über der Schlucht: dort, wo die Fahrbahn weit genug weg ist
    let best: [number, number] | null = null;
    for (let k = 0; k < 400 && !best; k++) {
      const x = -150 + rnd() * 50;
      const z = 15 + rnd() * 30;
      const y = grund(x, z);
      if (kante(x, z) < 9 || y < 55 || nass(x, z, 6)) continue;
      best = [x, z];
    }
    if (best) {
      const [x, z] = best;
      const yaw = Math.atan2(-x, -z);
      house(x, z, yaw, 8, 6.5, 5.5);
      // Fahnenmast mit Wimpel, Gartenzaun
      const y = grund(x + 6, z + 2);
      put(bau, G.zyl5, C_WEISS, x + 6, y + 5, z + 2, 0.12, 10, 0.12);
      box(bau, x + 6.9, y + 9.2, z + 2, 1.8, 1.1, 0.05, C_ROT);
      box(glow, x + 6.9, y + 9.2, z + 2.03, 1.8, 0.35, 0.05, C_WEISS);
    }
  }

  // --- Turmdrehkran am östlichen Widerlager (der Ausleger dreht sich: eigenes Netz) ------------------
  let kranPos: V3 | null = null;
  const kranAusleger = new MeshBuilder();
  {
    for (let k = 0; k < 500 && !kranPos; k++) {
      const x = 130 + rnd() * 40;
      const z = -60 + rnd() * 40;
      const y = grund(x, z);
      if (kante(x, z) < 8 || inLake(x, z, 4) || y < sea + 2) continue;
      // Der Ausleger (24 m) schwenkt in 34 m Höhe – über keiner Fahrbahn tiefer als LUFT
      if (deckel(x, z, 26) < y + 34 + LUFT) continue;
      kranPos = [x, y, z];
    }
    if (kranPos) {
      const [x, y, z] = kranPos;
      const H = 34;
      // Fundament, Turm (Gitter angedeutet: vier Eckstiele und Querstreben)
      box(bau, x, y + 0.5, z, 5, 1, 5, rgb(0x9a958b));
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) box(bau, x + dx * 0.9, y + H / 2, z + dz * 0.9, 0.25, H, 0.25, C_GELB);
      for (let hy = 2; hy < H; hy += 2.4) {
        box(bau, x, y + hy, z + 0.9, 1.9, 0.14, 0.14, C_GELB);
        box(bau, x, y + hy, z - 0.9, 1.9, 0.14, 0.14, C_GELB);
        box(bau, x + 0.9, y + hy + 1.2, z, 0.14, 0.14, 1.9, C_GELB);
        box(bau, x - 0.9, y + hy + 1.2, z, 0.14, 0.14, 1.9, C_GELB);
      }
      // Ausleger im eigenen Netz, um den Turm (Ursprung) gezeichnet
      const A = kranAusleger;
      A.box(0, 1.2, 0, 2.6, 2.4, 2.6, C_GELB);
      A.box(-1.4, 1.6, 0, 1.6, 1.8, 2.0, rgb(0xeae4d6));
      A.box(10, 2.2, 0, 24, 0.9, 1.2, C_GELB);
      A.box(-6, 2.2, 0, 10, 0.9, 1.2, C_GELB);
      A.box(-9, 1.0, 0, 3, 2.2, 2.2, rgb(0x8f8a80));
      A.box(0, 5.2, 0, 0.5, 5, 0.5, C_GELB);
      // Abspannung zur Spitze
      kranBeam(A, [0, 7.6, 0], [21, 2.6, 0], 0.12, C_STAHL_D);
      kranBeam(A, [0, 7.6, 0], [-10, 2.6, 0], 0.12, C_STAHL_D);
      // Laufkatze, Seil, Last (ein Betonkübel)
      A.box(15, 1.5, 0, 1.6, 0.6, 1.4, C_STAHL_D);
      A.box(15, -7, 0, 0.08, 16, 0.08, C_STAHL_D);
      A.box(15, -15.2, 0, 1.8, 1.8, 1.8, rgb(0x9a958b));
    }
  }

  // --- Hochspannungsleitung: vom Krafthaus den Osthang hinauf ----------------------------------------
  {
    const masten: V3[] = [];
    // Start: neben dem Krafthaus (an den Turbinenläufern), dann nach Südosten den Hang hinauf
    const h0 = t.hazards[0];
    if (h0) {
      const start: [number, number] = [t.px[h0.seg] + 10, t.pz[h0.seg] + 30];
      const dir = [0.62, 0.78];
      for (let k = 0; k < 8; k++) {
        let x = start[0] + dir[0] * k * 62 + (k % 2 ? 12 : -6);
        let z = start[1] + dir[1] * k * 62;
        // ausweichen, bis der Mast frei steht
        for (let tries = 0; tries < 20 && (kante(x, z) < 8 || nass(x, z, 4) || inLake(x, z, 2)); tries++) {
          x += 7;
          z += 3;
        }
        if (kante(x, z) < 8) continue;
        masten.push([x, grund(x, z), z]);
      }
    }
    const H = 26;
    for (const [x, y, z] of masten) {
      // Gittermast: vier schräge Stiele, Querträger
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) kranBeam(bau, [x + dx * 2.6, y - 0.5, z + dz * 2.6], [x + dx * 0.5, y + H, z + dz * 0.5], 0.3, C_STAHL);
      for (const hy of [8, 15, 21]) {
        const w = 2.6 - (hy / H) * 2.1;
        box(bau, x, y + hy, z + w, 2 * w, 0.2, 0.2, C_STAHL);
        box(bau, x, y + hy, z - w, 2 * w, 0.2, 0.2, C_STAHL);
        box(bau, x + w, y + hy, z, 0.2, 0.2, 2 * w, C_STAHL);
        box(bau, x - w, y + hy, z, 0.2, 0.2, 2 * w, C_STAHL);
      }
      box(bau, x, y + H - 4, z, 12, 0.5, 0.6, C_STAHL_D);
      box(bau, x, y + H - 0.5, z, 8, 0.5, 0.6, C_STAHL_D);
      put(bau, G.pyr, C_STAHL, x, y + H + 1.5, z, 0.7, 3, 0.7, Math.PI / 4);
    }
    // Leiterseile: je Feld vier Seile, leicht durchhängend
    for (let k = 0; k + 1 < masten.length; k++) {
      const a = masten[k];
      const b = masten[k + 1];
      for (const [dx, dy] of [
        [-5.6, H - 4.4],
        [5.6, H - 4.4],
        [-3.6, H - 0.9],
        [3.6, H - 0.9],
      ]) {
        const N = 6;
        for (let j = 0; j < N; j++) {
          const u0 = j / N;
          const u1 = (j + 1) / N;
          const sag = (u: number): number => -4 * 2.2 * u * (1 - u);
          const p0: V3 = [a[0] + (b[0] - a[0]) * u0 + dx, a[1] + (b[1] - a[1]) * u0 + dy + sag(u0), a[2] + (b[2] - a[2]) * u0];
          const p1: V3 = [a[0] + (b[0] - a[0]) * u1 + dx, a[1] + (b[1] - a[1]) * u1 + dy + sag(u1), a[2] + (b[2] - a[2]) * u1];
          kranBeam(bau, p0, p1, 0.09, rgb(0x2a2d33));
        }
      }
    }
  }

  // --- Bergpanorama rundum ------------------------------------------------------------------------
  const fern = new MeshBuilder();
  {
    const cx = world.center.x;
    const cz = world.center.z;
    let spur = 0;
    for (let i = 0; i < T; i++) spur = Math.max(spur, Math.hypot(t.px[i] - cx, t.pz[i] - cz));
    spur += 260;
    const sun = new THREE.Vector3(th.sunDir[0], th.sunDir[1], th.sunDir[2]).normalize();
    const dunst = rgb(th.fog);
    const ROCK = rgb(0x7a6f68);
    const ROCK_L = rgb(0xb98f74);
    const FOREST = rgb(0x3c5a44);
    const SNOW = rgb(0xfff2e4);
    const SNOW_S = rgb(0xc9c3d8);
    const n = hi ? 22 : 16;
    for (let m = 0; m < n; m++) {
      const a = (m / n) * TAU + (rnd() - 0.5) * 0.25;
      const D = spur + 140 + rnd() * 320;
      const H = 190 + rnd() * 230 + (m % 4 === 0 ? 90 : 0);
      const R = H * (1.1 + rnd() * 0.4);
      // ganzer Fuß außerhalb des Kreises um die Strecke
      const DD = Math.max(D, spur + R * 1.3);
      const px = cx + Math.cos(a) * DD;
      const pz = cz + Math.sin(a) * DD;
      const y0 = th.farY - 20;
      const nSide = 7;
      const F = [0, 0.3, 0.62, 0.86];
      const RF = [1.3, 0.85, 0.42, 0.14];
      const rings: V3[][] = [];
      const rot = rnd() * TAU;
      for (let j = 0; j < F.length; j++) {
        const r: V3[] = [];
        for (let i = 0; i < nSide; i++) {
          const aa = rot + (i / nSide) * TAU + (rnd() - 0.5) * 0.3;
          const rr = R * RF[j] * (0.8 + rnd() * 0.4);
          r.push([px + Math.cos(aa) * rr, y0 + (H + 20) * F[j], pz + Math.sin(aa) * rr]);
        }
        rings.push(r);
      }
      const apex: V3 = [px, y0 + H + 20, pz];
      const haze = 0.18 + 0.4 * smooth((DD - spur) / 700);
      const face = (A: V3, B: V3, C: V3): void => {
        const ux = B[0] - A[0];
        const uy = B[1] - A[1];
        const uz = B[2] - A[2];
        const vx = C[0] - A[0];
        const vy = C[1] - A[1];
        const vz = C[2] - A[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        const my = (A[1] + B[1] + C[1]) / 3;
        // nach außen (vom Gipfel weg) zeigen lassen
        const ox = (A[0] + B[0] + C[0]) / 3 - px;
        const oz = (A[2] + B[2] + C[2]) / 3 - pz;
        if (nx * ox + nz * oz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        const lit = Math.max(0, nx * sun.x + ny * sun.y + nz * sun.z);
        let c: RGB;
        if (my > y0 + H * 0.68 && ny > 0.25) c = mixRgb(SNOW_S, SNOW, lit);
        else if (my < y0 + H * 0.3) c = mixRgb(FOREST, shade(FOREST, 1.3), lit);
        else c = mixRgb(ROCK, ROCK_L, lit);
        c = mixRgb(c, dunst, haze + (1 - smooth((my - y0) / H)) * 0.25);
        // immer von außen sichtbar (Dreiecke beidseitig wären doppelt so teuer)
        const cxx = (A[0] + B[0] + C[0]) / 3 - cx;
        const czz = (A[2] + B[2] + C[2]) / 3 - cz;
        const facing = nx * -cxx + nz * -czz;
        if (facing >= 0) fern.tri(A, B, C, c);
        else fern.tri(A, C, B, c);
      };
      for (let j = 0; j + 1 < F.length; j++) {
        for (let i = 0; i < nSide; i++) {
          const i2 = (i + 1) % nSide;
          face(rings[j][i], rings[j][i2], rings[j + 1][i2]);
          face(rings[j][i], rings[j + 1][i2], rings[j + 1][i]);
        }
      }
      for (let i = 0; i < nSide; i++) face(rings[F.length - 1][i], rings[F.length - 1][(i + 1) % nSide], apex);
    }
  }

  // --- Netze -----------------------------------------------------------------------------------------
  for (const g of Object.values(G)) g.dispose();
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const bauG = bau.build();
  const bauMesh = new THREE.Mesh(bauG, toon);
  group.add(bauMesh);
  disposables.push(bauG);
  if (hi) {
    addSmoothNormals(bauG);
    const o = new THREE.Mesh(bauG, outlineMaterial(0.05));
    o.name = 'outline';
    o.matrixAutoUpdate = false;
    bauMesh.add(o);
  }
  if (!glow.empty) {
    const g = glow.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    group.add(new THREE.Mesh(g, mat));
    disposables.push(g, mat);
  }
  if (fern.triangles > 0) {
    const g = fern.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = -7;
    group.add(m);
    disposables.push(g, mat);
  }
  let kranMesh: THREE.Mesh | null = null;
  if (kranPos && !kranAusleger.empty) {
    const g = kranAusleger.build();
    kranMesh = new THREE.Mesh(g, toon);
    kranMesh.position.set(kranPos[0], kranPos[1] + 34, kranPos[2]);
    group.add(kranMesh);
    disposables.push(g);
  }
  void kirche;
  void DAM_CZ;

  return {
    group,
    update(time) {
      // Der Kran schwenkt langsam hin und her.
      if (kranMesh) kranMesh.rotation.y = 0.9 + Math.sin(time * 0.07) * 1.1;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Vierkantstab von a nach c (Kantenlänge s). */
function kranBeam(b: MeshBuilder, a: V3, c: V3, s: number, color: RGB): void {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return;
  const d: V3 = [dx / len, dy / len, dz / len];
  const ref: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u: V3 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u = [(u[0] / ul) * s * 0.5, (u[1] / ul) * s * 0.5, (u[2] / ul) * s * 0.5];
  const w: V3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const corner = (p: V3, su: number, sw: number): V3 => [p[0] + u[0] * su + w[0] * sw, p[1] + u[1] * su + w[1] * sw, p[2] + u[2] * su + w[2] * sw];
  const ring = (p: V3): V3[] => [corner(p, -1, -1), corner(p, 1, -1), corner(p, 1, 1), corner(p, -1, 1)];
  const A = ring(a);
  const C = ring(c);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    b.quad(A[k], A[n], C[n], C[k], k % 2 === 0 ? color : shade(color, 0.8));
  }
}
