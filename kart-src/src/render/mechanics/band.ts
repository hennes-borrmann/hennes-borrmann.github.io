// Neonhochbahn: Darstellung des Schwebebands (game/mechanics.ts: Band) – Magnetlinien, Magnetkanten, Prallpoller und die
// Fassade, an die sich das Band dreht.
//
// Die Fahrbahn des Bands selbst zeichnet die stehende Welt (world.ts, Untergrund „band“), an der Fassade gedreht wie die
// Physik es meint (track.ts: twistWarp). Hier kommt dazu:
//   – Magnetlinien: ein Streifen über das ganze Band mit einer Textur, auf der die beiden Linien genau eine Wellenlänge
//     lang gemalt sind. Er wird nie neu gerechnet – je Bild verschiebt sich nur die Textur um das Stück, das die Linien
//     in der Rennzeit gewandert sind. So liegen sie im Bild genau dort, wo bandLineLat sie für die Physik hat, auf jedem
//     Bildschirm gleich. (Kein eigener Shader: ein unbeleuchtetes Material mit Textur, additiv.)
//   – Magnetkanten: niedrige Leuchtleisten an beiden Rändern statt einer Bande, Prallpoller als leuchtende Säulen.
//   – Fassade: ein Turm rechts neben dem verdrehten Stück, mit Fensterbändern; das Band hängt an Haltern davor. Wo es
//     sich erst wenig gedreht hat, stehen Stützen darunter.
// Zusammen drei Zeichenaufrufe (Linien, Leuchtendes, Körper), alles stehende Geometrie bis auf die Texturverschiebung.
//
// Talsperre: dasselbe Band in den Farben des Abends (cyan und bernstein statt cyan und pink) – statt der Fassade steht
// rechts die Luftseite der Staumauer (die zeichnet mechanics/dam.ts); das Band hängt auf ganzer Länge an Auslegern, die
// in der Mauer verankert sind (keine Stützen hinunter in die Schlucht).

import * as THREE from 'three';
import { BAND_LINE_K, BAND_LINE_SPEED, BAND_LINE_WAVE } from '../../game/mechanics';
import { EDGE_TWIST, rightX, rightZ, twistWarp, type Track } from '../../game/track';
import { DAM_AIR, damRadius } from '../life/talsperreLand';
import { MeshBuilder, seeded, shade, type RGB, type V3 } from '../build';
import type { MechanicView } from '../mechanics';
import { THEMES } from '../themes';
import { rgb, toonMaterial } from '../toon';

const CYAN_N = rgb(0x5ff3ff);
const PINK_N = rgb(0xff3fae);
const VIOLET_N = rgb(0x9a6bff);
const WARM = rgb(0xffd27a);
const DARK_N = rgb(0x151833);
const FACADE = rgb(0x22264a);
const FACADE_B = rgb(0x1a1d3b);
const STEEL_N = rgb(0x3a3f66);

/** So dick ist das Band (wie ein Steg, world.ts: DECK_D). */
const SLAB = 1.1;

export function buildBand(t: Track, _detail: boolean): MechanicView {
  const group = new THREE.Group();
  group.name = 'Schwebeband';
  const disposables: { dispose(): void }[] = [];
  const farY = THEMES[t.def.theme].farY;
  // Talsperre: Abendfarben, und statt des Fassadenturms die Staumauer (mechanics/dam.ts).
  const dam = t.def.theme === 'talsperre';
  const CYAN = dam ? rgb(0x58e0ff) : CYAN_N;
  const PINK = dam ? rgb(0xffcf4a) : PINK_N;
  const VIOLET = dam ? rgb(0xffa94a) : VIOLET_N;
  const DARK = dam ? rgb(0x2b303b) : DARK_N;
  const STEEL = dam ? rgb(0x6c717c) : STEEL_N;

  const tmp = { x: 0, y: 0, z: 0 };
  /** Punkt auf dem Band (gezeigte Stelle): Abschnitt i, Anteil f zum nächsten, seitlich lat, h über der Fahrbahn. */
  const P = (i: number, f: number, lat: number, h: number): V3 => {
    if ((t.edge[i] & EDGE_TWIST) !== 0 && twistWarp(t, i, f, lat, h, tmp)) return [tmp.x, tmp.y, tmp.z];
    const j = t.next[i];
    const L = (a: number, b: number): number => a + (b - a) * f;
    const x = L(t.px[i] + rightX(t, i) * lat, t.px[j] + rightX(t, j) * lat);
    const z = L(t.pz[i] + rightZ(t, i) * lat, t.pz[j] + rightZ(t, j) * lat);
    const y = L(t.py[i] + lat * t.bank[i], t.py[j] + lat * t.bank[j]) + h;
    return [x, y, z];
  };

  // --- Magnetlinien ---------------------------------------------------------------
  // Textur: eine Wellenlänge (v 0 … 1) über die ganze Bandbreite (u 0 … 1 = links … rechts). Linie 0 liegt bei
  // u = ½ + ½·K·sin(2πv), Linie 1 spiegelbildlich – wie bandLineLat. (Mit flipY gehört die oberste Zeile zu v = 1.)
  const W = 128;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.lineCap = 'round';
  const colors = dam ? ['#58e0ff', '#ffb347'] : ['#5ff3ff', '#ff4fc0'];
  for (let k = 0; k < 2; k++) {
    const sign = k === 0 ? 1 : -1;
    const path = (): void => {
      g.beginPath();
      // (ein Stück über den Rand hinaus, damit die Linie beim Kacheln nahtlos weiterläuft)
      for (let y = -8; y <= H + 8; y += 2) {
        const v = 1 - y / H;
        const x = W * (0.5 + 0.5 * sign * BAND_LINE_K * Math.sin(2 * Math.PI * v));
        if (y === -8) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    };
    // weicher Schein, dann der helle Kern mit Strichen, die mit der Linie wandern
    g.setLineDash([]);
    g.globalAlpha = 0.2;
    g.strokeStyle = colors[k];
    g.lineWidth = 18;
    path();
    g.stroke();
    g.globalAlpha = 0.5;
    g.lineWidth = 9;
    path();
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 5;
    g.setLineDash([H / 16 - 10, 10]);
    g.lineDashOffset = k * 9;
    path();
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    path();
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  disposables.push(tex);
  const lineMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -6,
  });
  disposables.push(lineMat);
  const lines = new MeshBuilder();
  const white: RGB = [1, 1, 1];
  for (const b of t.bands) {
    for (let k = 0; k < b.count; k++) {
      const i = (b.first + k) % t.n;
      const j = t.next[i];
      const v0 = (k * t.step) / BAND_LINE_WAVE;
      const v1 = ((k + 1) * t.step) / BAND_LINE_WAVE;
      const ri = t.rh[i];
      const rj = t.rh[j];
      // (Je Ende die eigene halbe Breite: u = ½ + lat/(2·rh) wie in der Physik.)
      lines.quadUv(P(i, 0, -ri, 0.03), P(i, 0, ri, 0.03), P(j, 0, rj, 0.03), P(j, 0, -rj, 0.03), white, 0, v0, 1, v1);
    }
  }
  const lineMesh = new THREE.Mesh(lines.build(), lineMat);
  lineMesh.renderOrder = 3;
  lineMesh.frustumCulled = false;
  group.add(lineMesh);
  disposables.push(lineMesh.geometry);

  // --- Magnetkanten, Prallpoller, Fassade -----------------------------------------
  const glow = new MeshBuilder();
  const solid = new MeshBuilder();
  for (const b of t.bands) {
    for (let k = 0; k < b.count; k++) {
      const i = (b.first + k) % t.n;
      const w = t.wh[i];
      // Leuchtleiste auf der Kante: oben und zur Fahrbahn hin; im Wechsel cyan und violett, an den Enden pink
      const c = k < 8 || k > b.count - 9 ? PINK : Math.floor(k / 6) % 2 === 0 ? CYAN : VIOLET;
      for (const sgn of [-1, 1]) {
        const a0 = P(i, 0, sgn * w, 0.32);
        const a1 = P(i, 1, sgn * w, 0.32);
        const b0 = P(i, 0, sgn * (w - 0.3), 0.32);
        const b1 = P(i, 1, sgn * (w - 0.3), 0.32);
        const c0 = P(i, 0, sgn * (w - 0.3), 0);
        const c1 = P(i, 1, sgn * (w - 0.3), 0);
        if (sgn < 0) {
          glow.quad(a0, b0, b1, a1, c);
          glow.quad(b0, c0, c1, b1, shade(c, 0.7));
        } else {
          glow.quad(b0, a0, a1, b1, c);
          glow.quad(c0, b0, b1, c1, shade(c, 0.7));
        }
      }
    }
  }
  // Prallpoller: leuchtende Säule mit Ring – aufrecht auf dem Band (an der Fassade mitgedreht)
  const m4 = new THREE.Matrix4();
  const post = new THREE.CylinderGeometry(0.5, 0.55, 1.1, 10);
  const ring = new THREE.TorusGeometry(0.62, 0.1, 5, 12);
  ring.rotateX(Math.PI / 2);
  disposables.push(post, ring);
  for (const bp of t.bumpers) {
    const i = bp.seg;
    const base = P(i, 0, bp.lat, 0);
    const up = P(i, 0, bp.lat, 1);
    const side = P(i, 0, bp.lat + 1, 0);
    const ux = up[0] - base[0];
    const uy = up[1] - base[1];
    const uz = up[2] - base[2];
    const rx = side[0] - base[0];
    const ry = side[1] - base[1];
    const rz = side[2] - base[2];
    // Achsen: x = rechts, y = oben, z = vorn
    const fx = uy * rz - uz * ry;
    const fy = uz * rx - ux * rz;
    const fz = ux * ry - uy * rx;
    const fl = Math.hypot(fx, fy, fz) || 1;
    const at = (h: number): THREE.Matrix4 => m4.set(rx, ux, -fx / fl, base[0] + ux * h, ry, uy, -fy / fl, base[1] + uy * h, rz, uz, -fz / fl, base[2] + uz * h, 0, 0, 0, 1);
    glow.add(post, PINK, at(0.55));
    glow.add(ring, CYAN, at(1.15));
    solid.add(ring, DARK, at(0.08));
  }

  // Fassade: rechts neben dem verdrehten Stück steht ein Turm. Seine Wand steht so weit draußen, dass die Kante des Bands
  // beim Drehen nicht hindurchstreicht (sie schwingt auf einem Kreis um die Achse); das Band hängt an Haltern davor.
  const twisted: number[] = [];
  for (let i = 0; i < t.n; i++) if ((t.edge[i] & EDGE_TWIST) !== 0) twisted.push(i);
  if (dam) {
    // Talsperre: Ausleger alle 6 m von der Unterseite des Bands waagerecht zur Luftseite der Mauer, dort eine Ankerplatte.
    // Wo das Band schon an der Mauer liegt, sind sie kurz; wo es flach davor hängt, lang (und unter ihm ein Zugband).
    for (const b of t.bands) {
      for (let k = 2; k < b.count - 2; k += 6) {
        const i = (b.first + k) % t.n;
        const wall = damRadius(t.px[i], t.pz[i]);
        // Nur entlang der Mauer (an den Enden geht das Band aus dem Fels bzw. in ihn hinein).
        const out = DAM_AIR - wall;
        if (out < 6 || out > 20) continue;
        const under = P(i, 0, 0, -SLAB);
        const F = (lat: number, y: number): V3 => [t.px[i] + rightX(t, i) * lat, y, t.pz[i] + rightZ(t, i) * lat];
        const anchor = F(out + 0.3, under[1]);
        beam(solid, under, anchor, 0.55, STEEL);
        // Strebe schräg hinab zur Mauer (trägt das flach hängende Band – unter ihm, nie über der Fahrbahn)
        if (t.roll[i] < 0.6) beam(solid, P(i, 0, -t.rh[i] * 0.4, -SLAB), F(out + 0.3, under[1] - 6), 0.3, shade(STEEL, 0.85));
        solid.box(anchor[0], anchor[1], anchor[2], 1.3, 1.3, 0.5, shade(STEEL, 0.75), Math.atan2(t.tx[i], t.tz[i]));
        glow.box(anchor[0], anchor[1] + 0.85, anchor[2], 0.5, 0.18, 0.5, PINK);
      }
    }
  } else if (twisted.length > 0) {
    const R = Math.max(...twisted.map((i) => t.twist[i]));
    const wMax = Math.max(...twisted.map((i) => t.wh[i]));
    const wall = Math.hypot(wMax, R + SLAB) + 0.4;
    const first = twisted[0];
    const last = twisted[twisted.length - 1];
    const from = (first - 24 + t.n) % t.n;
    const count = ((last - first + t.n) % t.n) + 48;
    const DEPTH = 26;
    let top = -Infinity;
    for (let k = 0; k <= count; k++) top = Math.max(top, t.py[(from + k) % t.n] + R + 42);
    const F = (i: number, out: number, y: number): V3 => [t.px[i] + rightX(t, i) * out, y, t.pz[i] + rightZ(t, i) * out];
    const rnd = seeded(2027);
    const STEP = 3;
    for (let k = 0; k < count; k += STEP) {
      const i = (from + k) % t.n;
      const j = (from + Math.min(count, k + STEP)) % t.n;
      // Wand zur Bahn hin (Normale nach links, zur Bahn), Rückwand, Dach
      solid.quad(F(j, wall, farY), F(i, wall, farY), F(i, wall, top), F(j, wall, top), Math.floor(k / 12) % 2 === 0 ? FACADE : FACADE_B);
      solid.quad(F(i, wall + DEPTH, farY), F(j, wall + DEPTH, farY), F(j, wall + DEPTH, top), F(i, wall + DEPTH, top), FACADE_B);
      solid.quad(F(i, wall, top), F(i, wall + DEPTH, top), F(j, wall + DEPTH, top), F(j, wall, top), DARK);
      // Fenster: Reihen alle 3,6 m, zufällig erleuchtet (kalt, pink, warm); dazwischen Leuchtbänder
      for (let y = farY + 4; y < top - 2; y += 3.6) {
        const lit = rnd();
        if (lit < 0.42) continue;
        const col = lit < 0.7 ? shade(CYAN, 0.55) : lit < 0.86 ? shade(PINK, 0.6) : shade(WARM, 0.7);
        const a = F(i, wall - 0.05, y);
        const bq = F(j, wall - 0.05, y);
        const mx = (a[0] - bq[0]) * 0.18;
        const mz = (a[2] - bq[2]) * 0.18;
        glow.quad([bq[0] + mx, y, bq[2] + mz], [a[0] - mx, y, a[2] - mz], [a[0] - mx, y + 1.9, a[2] - mz], [bq[0] + mx, y + 1.9, bq[2] + mz], col);
      }
    }
    // Stirnseiten des Turms
    for (const [i, s] of [
      [from, -1],
      [(from + count) % t.n, 1],
    ] as [number, number][]) {
      const a = F(i, wall, farY);
      const bq = F(i, wall + DEPTH, farY);
      const c = F(i, wall + DEPTH, top);
      const d = F(i, wall, top);
      if (s < 0) solid.quad(a, bq, c, d, FACADE_B);
      else solid.quad(bq, a, d, c, FACADE_B);
    }
    // Senkrechte Leuchtstreifen an der Wand, alle 24 m – sie zeigen, wie hoch und wie schnell man ist.
    for (let k = 6; k < count; k += 24) {
      const i = (from + k) % t.n;
      const a = F(i, wall - 0.06, farY + 2);
      const d = F(i, wall - 0.06, top - 1);
      const ox = t.tx[i] * 0.35;
      const oz = t.tz[i] * 0.35;
      glow.quad([a[0] + ox, a[1], a[2] + oz], [a[0] - ox, a[1], a[2] - oz], [d[0] - ox, d[1], d[2] - oz], [d[0] + ox, d[1], d[2] + oz], k % 48 === 6 ? PINK : CYAN);
    }
    // Halter und Stützen: wo das Band schon weit gedreht ist, hängt es an Armen von der Wand (waagerecht zur Wand hin),
    // wo es noch fast flach liegt, steht es auf Stützen.
    for (const i of twisted) {
      if (i % 6 !== 0) continue;
      const r = t.roll[i];
      const under = P(i, 0, 0, -SLAB);
      if (r > 0.45) {
        const out = F(i, wall + 0.2, under[1]);
        beam(solid, under, out, 0.5, STEEL);
        glow.box(out[0], out[1], out[2], 0.9, 0.9, 0.9, PINK);
      } else {
        const foot: V3 = [under[0], farY, under[2]];
        beam(solid, under, foot, 0.9, STEEL);
      }
    }
  }

  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glowMesh = new THREE.Mesh(glow.build(), glowMat);
  const solidMat = toonMaterial({ vertexColors: true });
  solidMat.side = THREE.DoubleSide;
  const solidMesh = new THREE.Mesh(solid.build(), solidMat);
  group.add(glowMesh, solidMesh);
  disposables.push(glowMesh.geometry, glowMat, solidMesh.geometry, solidMat);

  return {
    group,
    update(time) {
      // Die Linien wandern mit BAND_LINE_SPEED voran: genau so weit, wie die Physik sie zur Rennzeit hat.
      const shift = ((BAND_LINE_SPEED * time) / 60 / BAND_LINE_WAVE) % 1;
      tex.offset.y = -shift;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Vierkantbalken von a nach b (Kantenlänge s). */
function beam(b: MeshBuilder, a: V3, c: V3, s: number, color: RGB): void {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return;
  const d: V3 = [dx / len, dy / len, dz / len];
  // zwei Querachsen
  const ref: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u: V3 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u = [(u[0] / ul) * s * 0.5, (u[1] / ul) * s * 0.5, (u[2] / ul) * s * 0.5];
  const w: V3 = [(d[1] * u[2] - d[2] * u[1]), (d[2] * u[0] - d[0] * u[2]), (d[0] * u[1] - d[1] * u[0])];
  const corner = (p: V3, su: number, sw: number): V3 => [p[0] + u[0] * su + w[0] * sw, p[1] + u[1] * su + w[1] * sw, p[2] + u[2] * su + w[2] * sw];
  const ring = (p: V3): V3[] => [corner(p, -1, -1), corner(p, 1, -1), corner(p, 1, 1), corner(p, -1, 1)];
  const A = ring(a);
  const C = ring(c);
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    b.quad(A[k], A[n], C[n], C[k], k % 2 === 0 ? color : shade(color, 0.8));
  }
}
