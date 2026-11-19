// Kulisse der Startrampe: ein Raketenstartplatz auf einer Insel an der offenen See.
//
// Im Westen, am Ende des Kriechwegs, die riesige Montagehalle mit ihrem hohen Tor; am Start die Zuschauertribüne (bunte
// Zuschauer, Sonnensegel) und gegenüber das Kontrollzentrum mit Fensterband, Antennen und Parkplatz; daneben der
// Raketengarten der Besucher; Radarschüsseln auf Gittermasten, die sich drehen; kugelförmige Tanks, ein liegender Tank
// auf Stelzen, der Wasserturm und das Treibstofflager; Hangars; zwei hohe Blitzschutzmasten am Sockel; im Südosten ein
// zweiter, kleinerer Startplatz mit seiner Rakete, an der Nordostecke ein Leuchtturm; Palmen, Sträucher und Strandhafer
// auf den Dünen; rings um die Insel eine Brandungslinie, draußen auf dem Meer ein Bergungsschiff und ein Lotsenboot;
// Möwen.
//
// Reine Kulisse: nichts steht auf einer Fahrbahn (world.clearance), nichts im Kriechweg oder im Flammengraben
// (rampeLand.near), nichts in der Flugbahn über dem Platz. Alles mit festem Zufall.
//
// Zeichenaufrufe: Bauten (Toon), Leuchtendes und Fensterbänder (unbeleuchtet), Radarschüsseln (eine Instanzgruppe),
// Brandung, Möwen = 5 (niedrige Stufe ohne Möwen: 4). Dreiecke: niedrig ≈ 10 000, hoch ≈ 18 000.

import * as THREE from 'three';
import { EDGE_GLIDE, type Track } from '../../game/track';
import { KRIECHWEG, PLATZ, RAKETE } from '../../game/tracks/rampe';
import { MeshBuilder, seeded, shade, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { rgb, toonMaterial } from '../toon';
import type { World } from '../world';
import { zyl } from '../mechanics/rampe';
import { HALLE_X, INSEL, kuesteD, kuesteX, rampeLand } from './rampeLand';

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
const SCHWARZ = rgb(0x24262b);
const BUSCH = rgb(0x5f8f45);
const BUSCH_2 = rgb(0x7a9a4a);
const ECKEN = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
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
    // (reicht bis unter den Meeresspiegel: am Westrand fällt das Gelände zur Lagune ab)
    bau.box(cx, y0 + (H - 10) / 2, cz, W, H + 10, D, WEISS, 0, GRAU);
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

  // --- Zweiter Startplatz im Südosten: ein kleinerer Turm mit seiner Rakete (startet nicht) -----------------------
  {
    const [x, z] = placeBuilding(112, 150, 20);
    const y = ground(x, z) - 0.4;
    bau.box(x, y - 1, z, 30, 4, 30, GRAU, 0, rgb(0xd9d5cc));
    bau.box(x, y + 1.6, z, 8, 1.2, 8, GRAU_D);
    const ry = y + 2.2;
    zyl(bau, x, z, ry, ry + 24, 2.2, 2.2, 12, WEISS);
    zyl(bau, x, z, ry + 7, ry + 9, 2.24, 2.24, 12, SCHWARZ);
    zyl(bau, x, z, ry + 24, ry + 27, 2.2, 1.7, 12, ORANGE);
    zyl(bau, x, z, ry + 27, ry + 32, 1.7, 0.05, 12, WEISS);
    for (const s of [-1, 1]) {
      zyl(bau, x + s * 3.3, z, ry, ry + 15, 1, 1, 8, WEISS);
      zyl(bau, x + s * 3.3, z, ry + 15, ry + 18, 1, 0.1, 8, ORANGE);
    }
    // Gitterturm daneben mit einem Arm zur Rakete
    const tx = x;
    const tz = z - 8;
    const H = 40;
    for (const [sx, sz] of ECKEN) bau.box(tx + sx * 2, ry + H / 2, tz + sz * 2, 0.5, H, 0.5, ROT);
    for (let h = 4; h < H; h += 4) bau.box(tx, ry + h, tz, 4.4, 0.35, 4.4, h % 8 === 0 ? ROT : WEISS);
    bau.box(tx, ry + H + 0.6, tz, 5, 1.2, 5, GRAU_D);
    bau.box(tx, ry + H + 4, tz, 0.3, 6, 0.3, STAHL_D);
    bau.box(tx, ry + 22, (tz + z) / 2, 1.4, 0.8, 4, STAHL);
  }

  // --- Leuchtturm an der Nordostecke der Insel (rot-weiß geringelt) ------------------------------------------------
  {
    const x = 138;
    const z = -178;
    const y = ground(x, z);
    bau.box(x, y - 2, z, 9, 6, 9, GRAU_D, 0.3, GRAU);
    const y0 = y + 1;
    const H = 26;
    for (let k = 0; k < 6; k++) {
      const a = y0 + (k * H) / 6;
      const b = y0 + ((k + 1) * H) / 6;
      zyl(bau, x, z, a, b, 3 - (k / 6) * 1.1, 3 - ((k + 1) / 6) * 1.1, 12, k % 2 === 0 ? WEISS : ROT);
    }
    bau.box(x, y0 + H + 0.3, z, 5, 0.6, 5, STAHL_D);
    glow.box(x, y0 + H + 2, z, 2.6, 2.8, 2.6, rgb(0xfff2b0));
    zyl(bau, x, z, y0 + H + 3.4, y0 + H + 5.4, 2, 0.1, 10, ROT);
  }

  // --- Treibstofflager im Norden: drei stehende Tanks, verbunden durch eine Rohrleitung -----------------------------
  for (let k = 0; k < 3; k++) {
    const x = 34 + k * 19;
    const z = -150;
    if (!frei(x, z, 8)) continue;
    const y = ground(x, z) - 0.4;
    zyl(bau, x, z, y, y + 11, 6.5, 6.5, 14, WEISS, GRAU);
    zyl(bau, x, z, y + 8.5, y + 9.7, 6.55, 6.55, 14, ORANGE);
    bau.box(x, y + 1, z + 8, 2, 2, 3, STAHL_D);
    if (k < 2) bau.box(x + 9.5, y + 1.6, z + 8.5, 19, 0.8, 0.8, STAHL);
  }

  // --- Wasserturm (Wasser zum Dämpfen des Starts): Kugel auf vier Stelzen -----------------------------------------
  {
    const [x, z] = placeBuilding(-40, -132, 9);
    const y = ground(x, z) - 0.4;
    const H = 34;
    for (const [sx, sz] of ECKEN) {
      const top: V3 = [x + sx * 2.4, y + H, z + sz * 2.4];
      const foot: V3 = [x + sx * 5.5, y, z + sz * 5.5];
      bau.box((top[0] + foot[0]) / 2, y + H / 2, (top[2] + foot[2]) / 2, 0.8, H, 0.8, STAHL);
    }
    for (const h of [10, 22]) bau.box(x, y + h, z, 9 - h * 0.15, 0.4, 9 - h * 0.15, STAHL_D);
    zyl(bau, x, z, y, y + H, 0.9, 0.9, 8, GRAU);
    const kugelW = new THREE.SphereGeometry(7.5, lo ? 12 : 16, lo ? 8 : 10);
    m4.compose(new THREE.Vector3(x, y + H + 6, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.85, 1));
    bau.add(kugelW, WEISS, m4);
    kugelW.dispose();
    zyl(bau, x, z, y + H + 4.6, y + H + 6.4, 7.45, 7.45, 16, BLAU);
  }

  // --- Raketengarten der Besucher: ausgemusterte Raketen auf einem runden Platz ------------------------------------
  {
    const [x, z] = placeBuilding(-258, 84, 16);
    const y = ground(x, z);
    zyl(bau, x, z, y - 1.5, y + 0.25, 15, 15, 18, rgb(0xd9d5cc), rgb(0xd9d5cc));
    const modelle: [number, number, number, RGB, RGB][] = [
      // Abstand, Winkel, Höhe, Hauptfarbe, Ringfarbe
      [0, 0, 26, WEISS, SCHWARZ],
      [8.5, 0.3, 18, WEISS, ORANGE],
      [8.5, 1.9, 15, GRAU, ROT],
      [9, 3.3, 21, WEISS, BLAU],
      [8, 4.7, 12, ORANGE, WEISS],
    ];
    for (const [d, a, h, c, ring] of modelle) {
      const rx = x + Math.cos(a) * d;
      const rz = z + Math.sin(a) * d;
      const r = 0.9 + h * 0.04;
      zyl(bau, rx, rz, y + 0.25, y + 0.25 + h * 0.75, r, r, 10, c);
      zyl(bau, rx, rz, y + 0.25 + h * 0.3, y + 0.25 + h * 0.36, r * 1.03, r * 1.03, 10, ring);
      zyl(bau, rx, rz, y + 0.25 + h * 0.75, y + 0.25 + h, r, 0.05, 10, ring);
      for (let f = 0; f < 3; f++) {
        const fa = (f / 3) * Math.PI * 2 + a;
        const fx = Math.cos(fa);
        const fz = Math.sin(fa);
        bau.box(rx + fx * (r + 0.6), y + 0.25 + h * 0.08, rz + fz * (r + 0.6), 1.3, h * 0.16, 0.2, ring, -fa);
      }
    }
  }

  // --- Parkplatz westlich des Kontrollzentrums --------------------------------------------------------------------
  {
    const [x, z] = placeBuilding(-214, 58, 14);
    const y = ground(x, z) + 0.06;
    bau.quad([x - 17, y, z + 9], [x + 17, y, z + 9], [x + 17, y, z - 9], [x - 17, y, z - 9], rgb(0x56585e));
    const autos = [0xe84a3a, 0x3a8ee8, 0xf2f0ea, 0x2e3440, 0xf2c23a, 0x9aa3ad, 0x46b46a, 0xf2f0ea].map(rgb);
    for (const row of [-4.5, 4.5]) {
      for (let s = 0; s < 11; s++) {
        const cx = x - 15 + s * 3;
        bau.box(cx, y + 0.01, z + row, 0.15, 0.02, 5.2, WEISS);
        if (rnd() < 0.25) continue;
        const ax = cx + 1.5;
        const col = autos[Math.floor(rnd() * autos.length)];
        bau.box(ax, y + 0.65, z + row, 1.8, 0.9, 4, col);
        bau.box(ax, y + 1.4, z + row - 0.2, 1.6, 0.65, 2.2, shade(col, 0.9), 0, GLAS);
      }
    }
  }

  // --- Sträucher auf dem Gras ----------------------------------------------------------------------------------------
  const nBusch = lo ? 50 : hi ? 150 : 100;
  for (let n = 0, tries = 0; n < nBusch && tries < 2000; tries++) {
    const x = -420 + rnd() * 580;
    const z = -195 + rnd() * 385;
    if (kuesteD(x, z) < 26) continue;
    if (!frei(x, z, 1.5)) continue;
    const y = ground(x, z) - 0.25;
    const r = 1 + rnd() * 1.4;
    const h = r * (0.9 + rnd() * 0.5);
    const col = rnd() < 0.5 ? BUSCH : BUSCH_2;
    const a0 = rnd() * Math.PI;
    const ring = (k: number, rr: number, yy: number): V3 => {
      const a = a0 + (k / 6) * Math.PI * 2;
      return [x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr];
    };
    for (let k = 0; k < 6; k++) {
      const b0 = ring(k, r * 0.7, y);
      const b1 = ring(k + 1, r * 0.7, y);
      const m0 = ring(k, r, y + h * 0.45);
      const m1 = ring(k + 1, r, y + h * 0.45);
      bau.quad(b1, b0, m0, m1, shade(col, 0.8));
      bau.tri(m1, m0, [x, y + h, z], k % 2 === 0 ? col : shade(col, 0.92));
    }
    n++;
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
  const nPalmen = lo ? 22 : hi ? 46 : 36;
  for (let n = 0, tries = 0; n < nPalmen && tries < 800; tries++) {
    // überall auf der Insel, nicht auf dem Strand
    const x = -420 + rnd() * 590;
    const z = -190 + rnd() * 380;
    if (kuesteD(x, z) < 24) continue;
    if (!frei(x, z, 3, true)) continue;
    palme(x, z, 9 + rnd() * 5);
    n++;
  }
  const nHafer = lo ? 60 : hi ? 260 : 150;
  for (let n = 0, tries = 0; n < nHafer && tries < 3000; tries++) {
    const z = -260 + rnd() * 520;
    const xc = kuesteX(z);
    const x = xc - 75 + rnd() * 60;
    if (kuesteD(x, z) < 14 || !frei(x, z, 1)) continue;
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
  // Brandung: helle, unregelmäßige Streifen rings um die Insel entlang der Wasserlinie (pulsiert, siehe update). Die
  // Wasserlinie wird auf Strahlen von der Inselmitte aus gesucht; quer dazu liegen die Streifen in Richtung des Gefälles.
  const brandung = new MeshBuilder();
  {
    const water = world.theme.liquidY ?? -1.6;
    const N = 320;
    const linie: { x: number; z: number; nx: number; nz: number }[] = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      let r = 80;
      while (r < 700 && land.base(INSEL.x + ca * r, INSEL.z + sa * r) > water) r += 1;
      const x = INSEL.x + ca * r;
      const z = INSEL.z + sa * r;
      // nach außen: gegen den Anstieg des Abstands zur Küste
      const gx = kuesteD(x + 1, z) - kuesteD(x - 1, z);
      const gz = kuesteD(x, z + 1) - kuesteD(x, z - 1);
      const gl = Math.hypot(gx, gz) || 1;
      linie.push({ x, z, nx: -gx / gl, nz: -gz / gl });
    }
    for (let k = 0; k < N; k++) {
      const p = linie[k];
      const q = linie[(k + 1) % N];
      for (const [off, w, col] of [
        [0, 2.2, rgb(0xffffff)],
        [6, 1.2, rgb(0xd8f2fa)],
      ] as [number, number, RGB][]) {
        if (rnd() < 0.2) continue;
        const o = off - 1 + (rnd() - 0.5) * 1.5;
        const y = water + 0.06;
        const a: V3 = [p.x + p.nx * o, y, p.z + p.nz * o];
        const b: V3 = [q.x + q.nx * o, y, q.z + q.nz * o];
        const c: V3 = [q.x + q.nx * (o + w), y, q.z + q.nz * (o + w)];
        const d: V3 = [p.x + p.nx * (o + w), y, p.z + p.nz * (o + w)];
        // nach oben zeigen lassen
        const up = (b[0] - a[0]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[0] - a[0]);
        if (up < 0) brandung.quad(a, b, c, d, col);
        else brandung.quad(b, a, d, c, col);
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
      // Brandung pulsiert
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
