// Kulisse der Startrampe: ein Raketenstartplatz an der Küste.
//
// Im Westen, am Ende des Kriechwegs, die riesige Montagehalle mit ihrem hohen Tor; am Start die Zuschauertribüne (bunte
// Zuschauer, Sonnensegel) und gegenüber das Kontrollzentrum mit Fensterband und Antennen; Radarschüsseln auf Gittermasten,
// die sich drehen; kugelförmige Tanks und ein liegender Tank auf Stelzen; Hangars; zwei hohe Blitzschutzmasten am
// Sockel; Palmen und Strandhafer auf den Dünen; am Strand eine Brandungslinie, draußen auf dem Meer ein Bergungsschiff und
// ein Lotsenboot; Möwen.
//
// Reine Kulisse: nichts steht auf einer Fahrbahn (world.clearance), nichts im Kriechweg oder im Flammengraben
// (rampeLand.near), nichts in der Flugbahn über dem Platz. Alles mit festem Zufall.
//
// Zeichenaufrufe: Bauten (Toon), Leuchtendes und Fensterbänder (unbeleuchtet), Radarschüsseln (eine Instanzgruppe),
// Brandung, Möwen = 5 (niedrige Stufe ohne Möwen: 4). Dreiecke: niedrig ≈ 14 000, hoch ≈ 30 000.

import * as THREE from 'three';
import { EDGE_GLIDE, type Track } from '../../game/track';
import { KRIECHWEG, PLATZ, RAKETE } from '../../game/tracks/rampe';
import { MeshBuilder, seeded, shade, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { rgb, toonMaterial } from '../toon';
import type { World } from '../world';
import { HALLE_X, kuesteX, rampeLand } from './rampeLand';

const WEISS = rgb(0xf2f0ea);
const GRAU = rgb(0xc9c6bf);
const GRAU_D = rgb(0x8e8b86);
const BLAU = rgb(0x2f5f9e);
const BLAU_D = rgb(0x1f3f6e);
const ORANGE = rgb(0xff6a1f);
const STAHL = rgb(0x6b727c);
const STAHL_D = rgb(0x474d56);
const ROT = rgb(0xc4402c);
const GLAS = rgb(0x3a5f7e);
const FENSTER = rgb(0xbfe6ff);
const HAFER = rgb(0x9cae62);
const HAFER_2 = rgb(0x7f9450);
const STAMM = rgb(0x8a6a48);
const PALME = rgb(0x4f9a46);
const PALME_2 = rgb(0x3f8238);
const SCHIFF = rgb(0x2e3440);
const ZUSCHAUER = [0xe84a3a, 0x3a8ee8, 0xf2c23a, 0x46b46a, 0xf2f0ea, 0xff8a2a, 0x8a5ad8, 0x2fc4c4].map(rgb);

export function buildRampeLife(world: World): Life {
  const t: Track = world.track;
  const hi = world.detail >= 2;
  const lo = world.detail === 0;
  const group = new THREE.Group();
  const rnd = seeded(2411);
  const land = rampeLand(t);
  const G = PLATZ.y;
  const toon = toonMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const disposables: { dispose(): void }[] = [toon, glowMat];
  const bau = new MeshBuilder();
  const glow = new MeshBuilder();
  const ground = (x: number, z: number): number => world.groundY(x, z);

  // Flugbahn über dem Platz (in der Höhe zählt sie nicht – aber nichts Hohes soll dort stehen).
  const flug: number[] = [];
  for (let i = 0; i < t.n; i += 3) if ((t.edge[i] & EDGE_GLIDE) !== 0) flug.push(i);
  /** Darf hier etwas stehen (Abstand zu Fahrbahn, Einschnitten und – für Hohes – zur Flugbahn)? */
  const frei = (x: number, z: number, r: number, tall = false): boolean => {
    if (world.clearance(x, z) < r + 2) return false;
    if (land.near(x, z) < r + 3) return false;
    if (Math.hypot(x - RAKETE.x, z - RAKETE.z) < 48 + r) return false;
    if (tall) for (const i of flug) if (Math.hypot(x - t.px[i], z - t.pz[i]) < r + 18) return false;
    return true;
  };

  /** Quader auf dem Boden (Unterkante etwas im Boden), gedreht um rot. */
  const block = (x: number, z: number, sx: number, sy: number, sz: number, col: RGB, rot = 0, topC?: RGB, y0?: number): number => {
    const y = y0 ?? ground(x, z) - 0.6;
    bau.box(x, y + sy / 2, z, sx, sy, sz, col, rot, topC);
    return y;
  };
  /** Fensterband an einer Fassade: Mitte (x, y, z), Breite längs (ax, az), Höhe h – zeigt nach (nx, nz). */
  const fenster = (x: number, y: number, z: number, ax: number, az: number, w: number, h: number, nx: number, nz: number, col: RGB): void => {
    const o = 0.06;
    const a: V3 = [x - (ax * w) / 2 + nx * o, y - h / 2, z - (az * w) / 2 + nz * o];
    const b: V3 = [x + (ax * w) / 2 + nx * o, y - h / 2, z + (az * w) / 2 + nz * o];
    const c: V3 = [b[0], y + h / 2, b[2]];
    const d: V3 = [a[0], y + h / 2, a[2]];
    // (von außen gesehen gegen den Uhrzeigersinn)
    if (ax * nz - az * nx < 0) glow.quad(a, b, c, d, col);
    else glow.quad(b, a, d, c, col);
  };

  // --- Montagehalle am Ende des Kriechwegs -----------------------------------------------------
  {
    const x1 = HALLE_X;
    const W = 70;
    const D = 84;
    const H = 72;
    const cx = x1 - W / 2;
    const cz = KRIECHWEG.z;
    const y0 = G - 3;
    // Körper in zwei Grautönen, oben ein dunkles Band; das Tor (dunkel) zum Kriechweg hin
    bau.box(cx, y0 + H / 2, cz, W, H, D, WEISS, 0, GRAU);
    bau.box(cx, y0 + H + 2, cz, W - 6, 4, D - 6, GRAU_D);
    // senkrechte Rippen an der Ostseite und an den Längsseiten
    for (let z = cz - D / 2 + 4; z < cz + D / 2; z += 8) bau.box(x1 + 0.4, y0 + H / 2, z, 0.8, H, 1.2, GRAU);
    for (let x = x1 - 4; x > x1 - W; x -= 8) for (const s of [-1, 1]) bau.box(x, y0 + H / 2, cz + s * (D / 2 + 0.4), 1.2, H, 0.8, GRAU);
    // Tor: zum Kriechweg-Graben (unten am Boden des Grabens), 22 m breit, 52 m hoch
    const tw = 22;
    const th = 52;
    glow.quad([x1 + 0.9, KRIECHWEG.floor - 0.5, cz + tw / 2], [x1 + 0.9, KRIECHWEG.floor - 0.5, cz - tw / 2], [x1 + 0.9, KRIECHWEG.floor + th, cz - tw / 2], [x1 + 0.9, KRIECHWEG.floor + th, cz + tw / 2], rgb(0x1c2028));
    for (let y = KRIECHWEG.floor + 3; y < KRIECHWEG.floor + th; y += 4) bau.box(x1 + 1.1, y, cz, 0.3, 0.25, tw, STAHL_D);
    // farbiges Band (Blau und Orange) und eine helle Fensterreihe oben
    bau.box(x1 + 0.6, y0 + H - 6, cz, 0.4, 5, D * 0.8, BLAU);
    bau.box(x1 + 0.7, y0 + H - 10, cz, 0.4, 2, D * 0.8, ORANGE);
    fenster(x1 + 0.9, y0 + H - 15, cz, 0, 1, D * 0.7, 1.6, 1, 0, FENSTER);
  }

  // --- Kontrollzentrum (südlich der Startgeraden) ----------------------------------------------
  const placeBuilding = (x: number, z: number, r: number): [number, number] => {
    for (let n = 0; n < 40; n++) {
      if (frei(x, z, r)) return [x, z];
      x += (rnd() - 0.5) * 16;
      z += rnd() * 8;
    }
    return [x, z];
  };
  {
    const [x, z] = placeBuilding(-150, 66, 26);
    const y0 = block(x, z, 52, 9, 22, WEISS, 0, GRAU);
    block(x - 4, z, 30, 6, 16, GRAU, 0, GRAU_D, y0 + 9);
    // Fensterbänder (zur Strecke hin, Norden)
    fenster(x, y0 + 4.5, z - 11.05, 1, 0, 48, 2.6, 0, -1, GLAS);
    fenster(x - 4, y0 + 12, z - 8.05, 1, 0, 27, 2, 0, -1, FENSTER);
    // Antennen
    for (const [ox, oh] of [
      [10, 18],
      [16, 12],
      [-22, 14],
    ]) {
      bau.box(x + ox, y0 + 9 + oh / 2, z + 4, 0.4, oh, 0.4, STAHL);
      bau.box(x + ox, y0 + 9 + oh * 0.8, z + 4, 3.5, 0.2, 0.2, STAHL);
    }
  }

  // --- Zuschauertribüne an der Startgeraden (Nordseite) --------------------------------------
  {
    const L = lo ? 70 : 100;
    const x = -150;
    const z = -16;
    const rows = 9;
    const yb = ground(x, z) - 0.4;
    for (let r = 0; r < rows; r++) {
      const zz = z - r * 1.6;
      const yy = yb + r * 0.85;
      bau.box(x, yy + 0.42, zz, L, 0.85, 1.6, r % 2 === 0 ? GRAU : WEISS);
      // Zuschauer: kleine bunte Klötzchen auf jeder Reihe
      const n = lo ? 18 : 40;
      for (let s = 0; s < n; s++) {
        if (rnd() < 0.18) continue;
        const sx = x - L / 2 + 1 + (s + rnd() * 0.5) * ((L - 2) / n);
        const col = ZUSCHAUER[Math.floor(rnd() * ZUSCHAUER.length)];
        bau.box(sx, yy + 1.15, zz + 0.2, 0.7, 0.9, 0.55, col, 0, rgb(0xf0c8a0));
      }
    }
    // Rückwand, Stützen, Sonnensegel (weiß-orange)
    bau.box(x, yb + rows * 0.85 / 2 + 2, z - rows * 1.6 - 0.4, L, rows * 0.85 + 4, 0.6, STAHL_D);
    for (let s = -L / 2; s <= L / 2; s += 20) bau.box(x + s, yb + rows * 0.85 / 2 + 4.5, z - rows * 1.6, 0.6, rows * 0.85 + 9, 0.6, STAHL);
    const ty = yb + rows * 0.85 + 8;
    for (let s = 0; s < 10; s++) {
      const x0 = x - L / 2 + (s * L) / 10;
      const x1 = x0 + L / 10;
      const a: V3 = [x0, ty, z - rows * 1.6];
      const b: V3 = [x1, ty, z - rows * 1.6];
      const c: V3 = [x1, ty - 2.2, z + 1.5];
      const d: V3 = [x0, ty - 2.2, z + 1.5];
      bau.quad(a, b, c, d, s % 2 === 0 ? WEISS : ORANGE);
      bau.quad(b, a, d, c, shade(s % 2 === 0 ? WEISS : ORANGE, 0.8));
    }
  }

  // --- Tanks, Hangars, Blitzschutzmasten ----------------------------------------------------
  const kugel = new THREE.SphereGeometry(1, lo ? 10 : 16, lo ? 7 : 10);
  const m4 = new THREE.Matrix4();
  for (const [x0, z0, r] of [
    [-22, 60, 7],
    [12, 56, 6],
  ]) {
    const [x, z] = [x0, z0];
    if (!frei(x, z, r + 2)) continue;
    const y = ground(x, z);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      bau.box(x + Math.cos(a) * r * 0.75, y + r * 0.6, z + Math.sin(a) * r * 0.75, 0.5, r * 1.2, 0.5, STAHL);
    }
    m4.compose(new THREE.Vector3(x, y + r * 1.55, z), new THREE.Quaternion(), new THREE.Vector3(r, r, r));
    bau.add(kugel, WEISS, m4);
    bau.box(x, y + r * 2.6, z, 1.4, 0.8, 1.4, ORANGE);
  }
  {
    // liegender Tank auf Stelzen
    const x = 46;
    const z = 40;
    if (frei(x, z, 12)) {
      const y = ground(x, z);
      const cyl = new THREE.CylinderGeometry(3, 3, 22, lo ? 10 : 16);
      cyl.rotateZ(Math.PI / 2);
      m4.compose(new THREE.Vector3(x, y + 5, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      bau.add(cyl, WEISS, m4);
      cyl.dispose();
      for (const s of [-8, 0, 8]) bau.box(x + s, y + 1.4, z, 1, 2.8, 4, STAHL);
    }
  }
  kugel.dispose();
  // Hangars im Nordwesten
  for (const [x0, z0, w, d] of [
    [-230, -150, 34, 26],
    [-190, -152, 28, 22],
    [-300, -110, 30, 24],
  ]) {
    const [x, z] = placeBuilding(x0, z0, Math.max(w, d) / 2 + 2);
    const y = ground(x, z) - 0.6;
    bau.box(x, y + 6, z, w, 12, d, GRAU, 0, GRAU_D);
    // gewölbtes Dach aus drei Stufen
    bau.box(x, y + 12.7, z, w - 2, 1.4, d, BLAU_D);
    bau.box(x, y + 13.8, z, w - 8, 1, d, BLAU);
    glow.quad([x - w / 2 + 3, y + 0.6, z + d / 2 + 0.06], [x + w / 2 - 3, y + 0.6, z + d / 2 + 0.06], [x + w / 2 - 3, y + 9, z + d / 2 + 0.06], [x - w / 2 + 3, y + 9, z + d / 2 + 0.06], rgb(0x2a2f38));
  }
  // Blitzschutzmasten südlich des Sockels (Gittermasten mit roter Spitze)
  for (const a of [125, 235]) {
    const r = 58;
    const x = RAKETE.x + Math.cos((a * Math.PI) / 180) * r;
    const z = RAKETE.z - Math.sin((a * Math.PI) / 180) * r;
    if (!frei(x, z, 3)) continue;
    const y = ground(x, z) - 0.5;
    const H = 86;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      bau.box(x + sx * 0.9, y + H / 2, z + sz * 0.9, 0.35, H, 0.35, k(sx, sz));
    }
    for (let h = 6; h < H; h += 7) bau.box(x, y + h, z, 2.2, 0.3, 2.2, h % 14 < 7 ? ROT : WEISS);
    bau.box(x, y + H + 3, z, 0.3, 6, 0.3, STAHL_D);
  }
  function k(sx: number, sz: number): RGB {
    return (sx + sz) % 4 === 0 ? ROT : WEISS;
  }

  // --- Palmen und Strandhafer, Brandung ---------------------------------------------------------
  const palme = (x: number, z: number, h: number): void => {
    const y = ground(x, z) - 0.3;
    const lean = (rnd() - 0.5) * 2.4;
    const top: V3 = [x + lean, y + h, z + (rnd() - 0.5) * 2];
    // Stamm in drei Stücken
    for (let s = 0; s < 3; s++) {
      const f0 = s / 3;
      const f1 = (s + 1) / 3;
      const p0: V3 = [x + lean * f0 * f0, y + h * f0, z + (top[2] - z) * f0 * f0];
      const p1: V3 = [x + lean * f1 * f1, y + h * f1, z + (top[2] - z) * f1 * f1];
      bau.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, 0.55, h / 3 + 0.1, 0.55, s % 2 === 0 ? STAMM : shade(STAMM, 0.85));
    }
    // Wedel
    const nb = lo ? 5 : 7;
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * Math.PI * 2 + rnd();
      const L = 4.5 + rnd() * 1.5;
      const ex = top[0] + Math.cos(a) * L;
      const ez = top[2] + Math.sin(a) * L;
      const ey = top[1] - 1.6 - rnd();
      const sx = -Math.sin(a) * 0.9;
      const sz = Math.cos(a) * 0.9;
      const mid: V3 = [(top[0] + ex) / 2, top[1] + 0.5, (top[2] + ez) / 2];
      const col = b % 2 === 0 ? PALME : PALME_2;
      bau.tri(top, [mid[0] + sx, mid[1], mid[2] + sz], [ex, ey, ez], col);
      bau.tri(top, [ex, ey, ez], [mid[0] - sx, mid[1], mid[2] - sz], col);
      bau.tri([mid[0] + sx, mid[1], mid[2] + sz], top, [ex, ey, ez], shade(col, 0.8));
      bau.tri([ex, ey, ez], top, [mid[0] - sx, mid[1], mid[2] - sz], shade(col, 0.8));
    }
  };
  const nPalmen = lo ? 14 : 30;
  for (let n = 0, tries = 0; n < nPalmen && tries < 400; tries++) {
    // an Tribüne, Kontrollzentrum und am Rand des Platzes
    const x = -260 + rnd() * 420;
    const z = -150 + rnd() * 280;
    if (x > kuesteX(z) - 30) continue;
    if (!frei(x, z, 3, true)) continue;
    palme(x, z, 9 + rnd() * 5);
    n++;
  }
  const nHafer = lo ? 60 : hi ? 260 : 150;
  for (let n = 0, tries = 0; n < nHafer && tries < 3000; tries++) {
    const z = -260 + rnd() * 520;
    const xc = kuesteX(z);
    const x = xc - 75 + rnd() * 60;
    if (!frei(x, z, 1)) continue;
    const y = ground(x, z) - 0.1;
    const s = 0.55 + rnd() * 0.5;
    // Büschel aus fünf schmalen Halmen, die nach außen kippen
    for (let b = 0; b < 5; b++) {
      const a = rnd() * Math.PI * 2;
      const lean = 0.25 + rnd() * 0.35;
      const tip: V3 = [x + Math.cos(a) * lean * s, y + (0.9 + rnd() * 0.5) * s, z + Math.sin(a) * lean * s];
      const w = 0.09 * s;
      const col = b % 2 === 0 ? HAFER : HAFER_2;
      bau.tri([x - Math.sin(a) * w, y, z + Math.cos(a) * w], [x + Math.sin(a) * w, y, z - Math.cos(a) * w], tip, col);
      bau.tri([x + Math.sin(a) * w, y, z - Math.cos(a) * w], [x - Math.sin(a) * w, y, z + Math.cos(a) * w], tip, shade(col, 0.85));
    }
    n++;
  }
  // Brandung: helle, unregelmäßige Streifen entlang der Wasserlinie (leicht bewegt, siehe update)
  const brandung = new MeshBuilder();
  {
    const water = world.theme.liquidY ?? -1.6;
    for (let z = -360; z < 360; z += 6) {
      for (const [off, w, col] of [
        [0, 2.2, rgb(0xffffff)],
        [6, 1.2, rgb(0xd8f2fa)],
      ] as [number, number, RGB][]) {
        // Wasserlinie: wo der Strand den Meeresspiegel kreuzt (grob gesucht)
        let xw = kuesteX(z);
        for (let n = 0; n < 40 && land.base(xw, z) > water; n++) xw += 1;
        const x0 = xw + off - 1;
        const zz = z + (rnd() - 0.5) * 2;
        if (rnd() < 0.2) continue;
        brandung.quad([x0, water + 0.06, zz + 6], [x0 + w, water + 0.06, zz + 6], [x0 + w, water + 0.06, zz], [x0, water + 0.06, zz], col);
      }
    }
  }
  // Schiffe draußen auf dem Meer: ein Bergungsschiff mit Landeplattform und ein kleines Lotsenboot
  {
    const water = world.theme.liquidY ?? -1.6;
    const sx = kuesteX(-120) + 260;
    const sz = -120;
    bau.box(sx, water + 1.5, sz, 60, 5, 16, SCHIFF, 0, GRAU_D);
    bau.box(sx + 4, water + 4.6, sz, 40, 1.2, 18, GRAU);
    for (let k2 = 0; k2 < 8; k2++) bau.box(sx - 12 + k2 * 5, water + 5.3, sz, 2.4, 0.1, 18, k2 % 2 === 0 ? rgb(0xffd23a) : rgb(0x1f1d22));
    bau.box(sx - 24, water + 9, sz, 8, 8, 10, WEISS, 0, ORANGE);
    const bx = kuesteX(80) + 140;
    bau.box(bx, water + 0.8, 80, 12, 2.4, 4.5, ORANGE, 0.4, WEISS);
    bau.box(bx - 1, water + 2.8, 80, 4, 2, 3, WEISS, 0.4);
  }

  // --- Radarschüsseln auf Gittermasten (drehen sich: eine Instanzgruppe) ------------------------------
  const radarSpots: [number, number, number][] = [];
  for (const [x0, z0] of [
    [-110, 92],
    [-200, 84],
    [-250, -140],
  ]) {
    const [x, z] = placeBuilding(x0, z0, 6);
    const y = ground(x, z) - 0.5;
    const H = 14;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      bau.box(x + sx * 1.6, y + H / 2, z + sz * 1.6, 0.35, H, 0.35, STAHL);
    }
    for (let h = 3; h < H; h += 3.5) bau.box(x, y + h, z, 3.6, 0.25, 3.6, STAHL_D);
    bau.box(x, y + H + 0.6, z, 3, 1.2, 3, WEISS);
    radarSpots.push([x, z, y + H + 1.2]);
  }
  const dish = new MeshBuilder();
  {
    // Schüssel: flacher Kegel (innen hell), Speiser vorn, Gelenk
    const N = lo ? 12 : 18;
    const R = 5;
    const D = 1.8;
    for (let n = 0; n < N; n++) {
      const a0 = (n / N) * Math.PI * 2;
      const a1 = ((n + 1) / N) * Math.PI * 2;
      const rim = (a: number): V3 => [Math.cos(a) * R, Math.sin(a) * R, D];
      const centre: V3 = [0, 0, 0];
      dish.tri(centre, rim(a0), rim(a1), n % 2 === 0 ? WEISS : GRAU);
      dish.tri(centre, rim(a1), rim(a0), GRAU_D);
    }
    for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
      const p0: V3 = [Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, D * 0.9];
      const p1: V3 = [0, 0, 4.5];
      dish.tri(p0, p1, [p0[0] + 0.2, p0[1] + 0.2, p0[2]], STAHL);
      dish.tri(p1, p0, [p0[0] + 0.2, p0[1] + 0.2, p0[2]], STAHL);
    }
    dish.box(0, 0, 4.6, 0.8, 0.8, 0.8, ORANGE);
    dish.box(0, -2.5, -0.4, 1.2, 5, 1.2, STAHL_D);
  }
  const dishGeo = dish.build();
  const dishMesh = new THREE.InstancedMesh(dishGeo, toon, radarSpots.length);
  dishMesh.name = 'Radarschüsseln';
  disposables.push(dishGeo);

  // --- Möwen (nur Zierde) ---------------------------------------------------------------------
  let birds: THREE.InstancedMesh | null = null;
  const birdGeo = new THREE.BufferGeometry();
  {
    const v = new Float32Array([-1.1, 0.2, 0, 0, 0, 0.2, 0, 0, -0.2, 0, 0, 0.2, 1.1, 0.2, 0, 0, 0, -0.2]);
    birdGeo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    birdGeo.computeVertexNormals();
    disposables.push(birdGeo);
  }
  const nBirds = lo ? 0 : hi ? 14 : 8;
  const birdMat = new THREE.MeshBasicMaterial({ color: 0xf6f4ee, side: THREE.DoubleSide });
  disposables.push(birdMat);
  const birdOrbit: { cx: number; cz: number; r: number; y: number; w: number; p: number }[] = [];
  if (nBirds > 0) {
    birds = new THREE.InstancedMesh(birdGeo, birdMat, nBirds);
    for (let n = 0; n < nBirds; n++) {
      const z = -200 + rnd() * 360;
      birdOrbit.push({ cx: kuesteX(z) - 20 + rnd() * 60, cz: z, r: 18 + rnd() * 30, y: 18 + rnd() * 25, w: (0.25 + rnd() * 0.3) * (rnd() < 0.5 ? -1 : 1), p: rnd() * 6 });
    }
    birds.name = 'Möwen';
  }

  // --- Netze ---------------------------------------------------------------------------------
  const bauMesh = new THREE.Mesh(bau.build(), toon);
  bauMesh.name = 'Startplatz-Bauten';
  const glowMesh = new THREE.Mesh(glow.build(), glowMat);
  glowMesh.name = 'Fensterbänder';
  const brandMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
  const brandMesh = new THREE.Mesh(brandung.build(), brandMat);
  brandMesh.name = 'Brandung';
  disposables.push(bauMesh.geometry, glowMesh.geometry, brandMesh.geometry, brandMat);
  group.add(bauMesh, glowMesh, brandMesh, dishMesh);
  if (birds) group.add(birds);
  group.userData.triangles = bau.triangles + glow.triangles + brandung.triangles + (dishGeo.getAttribute('position').count / 3) * radarSpots.length;

  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  return {
    group,
    update(time: number): void {
      // Radar dreht sich, die Schüssel nickt leicht
      radarSpots.forEach((s, n) => {
        const [x, z, y] = s;
        e.set(-0.35 + 0.08 * Math.sin(time * 0.4 + n), time * (0.35 + n * 0.1) + n, 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(pos.set(x, y + 2.5, z), q, one);
        dishMesh.setMatrixAt(n, m4);
      });
      dishMesh.instanceMatrix.needsUpdate = true;
      // Brandung läuft leicht vor und zurück
      brandMesh.position.x = Math.sin(time * 0.6) * 1.2;
      brandMat.opacity = 0.65 + 0.2 * Math.sin(time * 0.6 + 1);
      if (birds) {
        birdOrbit.forEach((b, n) => {
          const a = b.p + time * b.w;
          pos.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(time * 0.7 + n) * 2, b.cz + Math.sin(a) * b.r);
          const flap = Math.sin(time * 6 + n * 1.7) * 0.35;
          e.set(flap * 0.5, -a + (b.w > 0 ? 0 : Math.PI), flap * 0.2, 'YXZ');
          q.setFromEuler(e);
          m4.compose(pos, q, new THREE.Vector3(1.2, 1 + flap, 1.2));
          birds!.setMatrixAt(n, m4);
        });
        birds.instanceMatrix.needsUpdate = true;
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
