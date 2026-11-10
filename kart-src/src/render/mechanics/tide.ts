// Möwenklippe: Ebbe und Flut.
//
// Der Pegel kommt allein aus der Physik (tideLevel mit der Rennzeit). Damit
// geschieht dreierlei:
//
//  1. Das ganze Meer der Welt (world.water) steigt und fällt, und mit ihm
//     alles, was schwimmt (world.floating; Kutter, Bojen, Brandung und Wal in
//     life/klippe.ts lesen den Pegel von dort).
//  2. Über der Uferstraße (Abschnitte mit track.tidal) liegt eigenes, leicht
//     durchscheinendes Wasser: man ahnt die Fahrbahn darunter, und an der
//     Wasserlinie läuft eine Schaumkante mit Tuschestrich, die mit der Welle
//     hin- und herwandert. Damit das deckende Meer die Fahrbahn dort nicht
//     zudeckt, spart es die Fahrbahnen aus (Maske, siehe seaMask) – auch an der
//     Steilkurve, deren Innenrand tiefer liegt als die Flut, aber trocken bleibt.
//  3. Eine Pegeltafel vor der Gabelung zur Bucht sagt an, wie es bei der
//     Durchfahrt sein wird – nach derselben Regel wie die KI (ai.ts).

import * as THREE from 'three';
import { tideLevel, tidePhase } from '../../game/mechanics';
import { EDGE_DECK, EDGE_TUNNEL, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder } from '../build';
import type { MechanicView } from '../mechanics';
import { addSmoothNormals, INK, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Auflösung der Aussparung im Meer (Meter je Texel). */
const MASK_CELL = 0.5;
/** So weit über die Bande hinaus spart das Meer aus bzw. reicht das Wasser über der Uferstraße (Meter). */
const MASK_PAD = 0.6;
const SHEET_PAD = 1.2;
/** Das Wasser über der Uferstraße liegt knapp unter dem Meer: außerhalb der Aussparung verdeckt das Meer es. */
const SHEET_DROP = 0.012;

/** Tafel: so weit vor der Gabelung (Meter), so groß (Breite × Höhe) und so weit über dem Fahrbahnrand. */
const SIGN_AHEAD = 45;
const SIGN_W = 7.2;
const SIGN_H = 3.6;
const SIGN_LIFT = 2.8;
/** Zustände der Tafel = Felder der Textur (von oben). */
const S_FLUT_BLUE = 0;
const S_FLUT_RED = 1;
const S_EBBE = 2;
const S_RISE = 3;
const S_FALL = 4;
const PANELS = 5;

const SHEET_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float ground;
attribute float along;
varying vec3 vWorld;
varying float vGround;
varying float vAlong;
void main() {
  vGround = ground;
  vAlong = along;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

/**
 * Wasser über der Uferstraße: flache Farbstufen wie das Meer, aber
 * durchscheinend – je tiefer, desto dichter. An der Wasserlinie eine weiße
 * Schaumkante mit dunklem Tuschestrich zur trockenen Seite, dahinter ein
 * zweiter, unterbrochener Schaumstreifen, der mit der Brandung vor- und
 * zurückläuft.
 */
const SHEET_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float time;
uniform float level;
uniform float detail;
uniform vec3 c0;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 foam;
uniform vec3 ink;
varying vec3 vWorld;
varying float vGround;
varying float vAlong;
void main() {
  float depth = level - vGround;
  // Gezeichnete Kante: leicht wellig, läuft langsam an der Küste entlang.
  float wob = (sin(vAlong * 0.83 + time * 1.9) * 0.6 + sin(vAlong * 2.1 - time * 2.7) * 0.4) * 0.011 * detail;
  float d = depth + wob;
  if (d < 0.0) discard;
  vec3 col;
  float alpha;
  if (d < 0.014) {
    col = ink;
    alpha = 0.95;
  } else if (d < 0.06) {
    col = foam;
    alpha = 0.97;
  } else {
    // Zweiter Schaumstreifen: läuft im Takt der Brandung heran und zieht sich zurück.
    float run = 0.11 + 0.035 * sin(time * 1.15);
    float gaps = step(0.35, fract(vAlong * 0.11 + sin(vAlong * 0.37) * 0.3));
    if (detail > 0.5 && abs(d - run) < 0.013 && gaps > 0.5) {
      col = mix(foam, c2, 0.35);
      alpha = 0.9;
    } else {
      float a = sin(vWorld.x * 0.085 + time * 0.7 + sin(vWorld.z * 0.06 + time * 0.4) * 1.8);
      float b = sin(vWorld.z * 0.12 - time * 0.55 + sin(vWorld.x * 0.045 - time * 0.2) * 2.2);
      float v = (a * 0.3 + b * 0.2) * detail + 0.5;
      // Flach: heller und klarer, tiefer: dichter – in zwei Stufen wie der Rest der Welt.
      bool shallow = d < 0.3;
      col = shallow ? c1 : c0;
      alpha = shallow ? 0.46 : 0.64;
      if (v < 0.5 && !shallow) alpha = 0.72;
      // Lichtkanten wie auf dem Meer, aber nur als schmale Streifen – sonst wirkt das Wasser milchig.
      if (v > 0.86) {
        col = mix(col, c2, 0.75);
        alpha += 0.12;
      }
    }
  }
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildTide(track: Track, detail: boolean, world: World): MechanicView {
  const t = track;
  const tide = t.tide!;
  const th = world.theme;
  const sea0 = th.liquidY ?? tide.low;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  /** Höchster Pegel samt Welle – was tiefer liegt, kann unter Wasser kommen. */
  const top = tide.high + tide.wave;

  // --- 1. Aussparung im Meer -------------------------------------------------------
  // Das Meer ist deckend. Wo eine Fahrbahn tiefer liegt als die Flut, würde es sie
  // zudecken – dort verwirft sein Shader die Fläche (Textur: 1 = Fahrbahn).
  const masked: number[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < t.total; i++) {
    if (t.edge[i] & (EDGE_DECK | EDGE_TUNNEL)) continue;
    const reach = t.wh[i] + MASK_PAD;
    const low = t.py[i] - Math.abs(t.bank[i]) * reach;
    if (low > top + 0.15) continue;
    masked.push(i);
    minX = Math.min(minX, t.px[i] - reach - 2);
    maxX = Math.max(maxX, t.px[i] + reach + 2);
    minZ = Math.min(minZ, t.pz[i] - reach - 2);
    maxZ = Math.max(maxZ, t.pz[i] + reach + 2);
  }
  let mask: THREE.DataTexture | null = null;
  const sea = world.water;
  const seaMat = sea && sea.material instanceof THREE.ShaderMaterial ? sea.material : null;
  if (seaMat && masked.length > 0) {
    const W = Math.min(1024, Math.ceil((maxX - minX) / MASK_CELL));
    const H = Math.min(1024, Math.ceil((maxZ - minZ) / MASK_CELL));
    const cx = (maxX - minX) / W;
    const cz = (maxZ - minZ) / H;
    const data = new Uint8Array(W * H);
    for (const i of masked) {
      const j = t.next[i];
      const reach = t.wh[i] + MASK_PAD;
      const len = Math.hypot(t.px[j] - t.px[i], t.pz[j] - t.pz[i]);
      const rx = rightX(t, i);
      const rz = rightZ(t, i);
      // Rechteck des Abschnitts, etwas überlappend, damit in Kurven keine Ritzen bleiben.
      const x0 = Math.min(t.px[i], t.px[j]) - reach - 1;
      const x1 = Math.max(t.px[i], t.px[j]) + reach + 1;
      const z0 = Math.min(t.pz[i], t.pz[j]) - reach - 1;
      const z1 = Math.max(t.pz[i], t.pz[j]) + reach + 1;
      const ix0 = Math.max(0, Math.floor((x0 - minX) / cx));
      const ix1 = Math.min(W - 1, Math.ceil((x1 - minX) / cx));
      const iz0 = Math.max(0, Math.floor((z0 - minZ) / cz));
      const iz1 = Math.min(H - 1, Math.ceil((z1 - minZ) / cz));
      for (let iz = iz0; iz <= iz1; iz++) {
        const dz = minZ + (iz + 0.5) * cz - t.pz[i];
        for (let ix = ix0; ix <= ix1; ix++) {
          const dx = minX + (ix + 0.5) * cx - t.px[i];
          const a = dx * t.tx[i] + dz * t.tz[i];
          if (a < -0.35 || a > len + 0.35) continue;
          if (Math.abs(dx * rx + dz * rz) <= reach) data[iz * W + ix] = 255;
        }
      }
    }
    mask = new THREE.DataTexture(data, W, H, THREE.RedFormat);
    mask.magFilter = THREE.LinearFilter;
    mask.minFilter = THREE.LinearFilter;
    mask.generateMipmaps = false;
    mask.needsUpdate = true;
    disposables.push(mask);
    seaMat.uniforms.tideMask = { value: mask };
    seaMat.uniforms.tideBox = { value: new THREE.Vector4(minX, minZ, 1 / (maxX - minX), 1 / (maxZ - minZ)) };
    seaMat.fragmentShader = seaMat.fragmentShader.replace(
      'void main() {',
      /* glsl */ `uniform sampler2D tideMask;
uniform vec4 tideBox;
void main() {
  vec2 tideUv = (vWorld.xz - tideBox.xy) * tideBox.zw;
  if (tideUv.x > 0.0 && tideUv.x < 1.0 && tideUv.y > 0.0 && tideUv.y < 1.0 && texture2D(tideMask, tideUv).r > 0.5) discard;`,
    );
    seaMat.needsUpdate = true;
  }

  // --- 2. Wasser über der Uferstraße --------------------------------------------------
  const pos: number[] = [];
  const ground: number[] = [];
  const along: number[] = [];
  const idx: number[] = [];
  let lowest = Infinity;
  {
    let run = -1;
    let meters = 0;
    for (let i = 0; i < t.total; i++) {
      if (!t.tidal[i]) {
        run = -1;
        continue;
      }
      // Quer: links, Mitte, rechts – die Fahrbahn ist je Abschnitt eben, das reicht.
      const reach = t.wh[i] + SHEET_PAD;
      const base = pos.length / 3;
      for (const lat of [-reach, reach]) {
        pos.push(t.px[i] + rightX(t, i) * lat, 0, t.pz[i] + rightZ(t, i) * lat);
        ground.push(t.py[i] + lat * t.bank[i]);
        along.push(meters);
      }
      lowest = Math.min(lowest, t.py[i] - Math.abs(t.bank[i]) * t.wh[i]);
      if (run >= 0) idx.push(run, run + 1, base + 1, run, base + 1, base);
      run = base;
      meters += t.step;
    }
  }
  const sheetGeo = new THREE.BufferGeometry();
  sheetGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheetGeo.setAttribute('ground', new THREE.Float32BufferAttribute(ground, 1));
  sheetGeo.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  sheetGeo.setIndex(idx);
  sheetGeo.computeBoundingSphere();
  const sheetMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        level: { value: tide.low },
        detail: { value: detail ? 1 : 0 },
        c0: { value: new THREE.Color(th.liquid[0]) },
        c1: { value: new THREE.Color(th.liquid[1]) },
        c2: { value: new THREE.Color(th.liquid[2]) },
        foam: { value: new THREE.Color(0xffffff) },
        ink: { value: new THREE.Color(0x163a5c) },
      },
    ]),
    vertexShader: SHEET_VERT,
    fragmentShader: SHEET_FRAG,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  // Nach Schatten und Bremsspuren (renderOrder 1 und 2), damit sie unter Wasser getönt werden.
  sheet.renderOrder = 3;
  sheet.visible = false;
  group.add(sheet);
  disposables.push(sheetGeo, sheetMat);

  // --- 3. Pegeltafel vor der Gabelung zur Bucht ----------------------------------------
  const fork = t.branches[1];
  let sign: THREE.Group | null = null;
  let face: THREE.Mesh | null = null;
  let faceTex: THREE.CanvasTexture | null = null;
  if (fork) {
    let s = fork.from;
    for (let k = 0; k < Math.round(SIGN_AHEAD / t.step); k++) s = t.prev[s];
    const side = fork.side < 0 ? -1 : 1;
    const lat = side * (t.wh[s] + 2);
    const x = t.px[s] + rightX(t, s) * lat;
    const z = t.pz[s] + rightZ(t, s) * lat;
    // Höhe: über dem Fahrbahnrand auf dieser Seite (in Steilkurven der höhere oder tiefere Rand).
    const edgeY = t.py[s] + side * t.wh[s] * t.bank[s];
    const foot = Math.min(edgeY - 0.3, world.heightAt(x, z)) - 0.4;
    const cy = edgeY + SIGN_LIFT + SIGN_H / 2;
    // Der anfahrenden Kamera zugewandt: Blick zurück auf die Strecke, 60 m vor der Tafel.
    let back = s;
    for (let k = 0; k < Math.round(60 / t.step); k++) back = t.prev[back];
    const yaw = Math.atan2(t.px[back] - x, t.pz[back] - z);

    sign = new THREE.Group();
    sign.position.set(x, 0, z);
    sign.rotation.y = yaw;
    group.add(sign);

    // Gestell: zwei rot-weiß geringelte Pfosten, dunkler Rahmen, kleines Dach.
    const b = new MeshBuilder();
    const ink = rgb(INK);
    const red = rgb(0xe8402f);
    const white = rgb(0xf7f2e4);
    const postH = cy - foot;
    for (const px of [-SIGN_W * 0.36, SIGN_W * 0.36]) {
      const rings = Math.max(2, Math.round(postH / 0.6));
      for (let k = 0; k < rings; k++) {
        const h = postH / rings;
        b.box(px, foot + h * (k + 0.5), -0.25, 0.3, h, 0.3, k % 2 === 0 ? red : white);
      }
    }
    b.box(0, cy, -0.12, SIGN_W + 0.36, SIGN_H + 0.36, 0.2, ink);
    b.box(0, cy + SIGN_H / 2 + 0.3, -0.12, SIGN_W + 0.8, 0.22, 0.7, ink, 0, red);
    const frameGeo = addSmoothNormals(b.build());
    const frameMat = toonMaterial({ vertexColors: true });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    sign.add(frame);
    disposables.push(frameGeo, frameMat);
    if (detail) {
      const ol = new THREE.Mesh(frameGeo, outlineMaterial(0.06));
      ol.name = 'outline';
      sign.add(ol);
    }

    faceTex = signTexture(side);
    faceTex.repeat.set(1, 1 / PANELS);
    const faceGeo = new THREE.PlaneGeometry(SIGN_W, SIGN_H);
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex });
    face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, cy, 0.0);
    sign.add(face);
    disposables.push(faceTex, faceGeo, faceMat);
  }
  let shown = -1;
  let shownKind = -1;
  let popT = 1;
  const arriveIn = ((SIGN_AHEAD + 70) * t.step * 60) / 25;

  return {
    group,
    update(time, seconds, dt) {
      const level = tideLevel(tide, time);
      // 1. Das Meer und alles, was schwimmt
      if (sea) sea.position.y = level;
      world.floating.position.y = level - sea0;
      // 2. Wasser über der Uferstraße – nur, solange es dort überhaupt etwas bedeckt.
      sheet.visible = level > lowest - 0.05;
      sheetMat.uniforms.level.value = level;
      sheetMat.uniforms.time.value = seconds;
      sheet.position.y = level - SHEET_DROP;
      // 3. Tafel: wie wird es bei der Durchfahrt sein? (dieselbe Regel wie die KI)
      if (face && faceTex && sign) {
        const arrive = time + arriveIn;
        const w = tidePhase(tide, arrive);
        let state: number;
        if (w > 0.6) state = Math.floor(seconds * 2.6) % 2 === 0 ? S_FLUT_BLUE : S_FLUT_RED;
        else if (w < 0.15) state = S_EBBE;
        else state = tidePhase(tide, arrive + 30) >= w ? S_RISE : S_FALL;
        // Neuer Zustand (nicht bloß das Blinken): die Tafel federt kurz auf, wie ein Comic-"Plopp".
        const kind = state === S_FLUT_RED ? S_FLUT_BLUE : state;
        if (kind !== shownKind) {
          if (shownKind >= 0) popT = 0;
          shownKind = kind;
        }
        if (state !== shown) {
          shown = state;
          faceTex.offset.set(0, 1 - (state + 1) / PANELS);
        }
        popT = Math.min(1, popT + dt * 3);
        const pop = 1 + 0.14 * Math.sin(popT * Math.PI) * (1 - popT);
        face.scale.set(pop, pop, 1);
      }
    },
    dispose() {
      if (sea) sea.position.y = sea0;
      world.floating.position.y = 0;
      for (const d of disposables) d.dispose();
    },
  };
}

/**
 * Die fünf Felder der Tafel untereinander (je 512 × 256): FLUT blau, FLUT rot,
 * EBBE, STEIGT, FÄLLT. side = Seite, zu der der Steg abgeht (−1 links, 1 rechts):
 * dorthin zeigt bei Flut der Pfeil.
 */
function signTexture(side: number): THREE.CanvasTexture {
  const PW = 512;
  const PH = 256;
  const c = document.createElement('canvas');
  c.width = PW;
  c.height = PH * PANELS;
  const g = c.getContext('2d')!;
  const INKC = '#16131c';
  const font = (size: number): string => `900 ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;

  /** Wellen-Symbol: zwei gezeichnete Wellenzüge mit Schaumkrone. */
  const waves = (x: number, y: number, w: number, color: string, rows = 2): void => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let r = 0; r < rows; r++) {
      const yy = y + r * 30;
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const u = k / 24;
        const px = x + u * w;
        const py = yy - Math.sin(u * Math.PI * 4) * 9;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokeStyle = INKC;
      g.lineWidth = 17;
      g.stroke();
      g.strokeStyle = color;
      g.lineWidth = 8;
      g.stroke();
    }
  };
  /** Dicker Pfeil mit Tuschekontur von (x0,y0) über (xm,ym) nach (x1,y1). */
  const arrow = (pts: [number, number][], color: string): void => {
    const [ax, ay] = pts[pts.length - 2];
    const [bx, by] = pts[pts.length - 1];
    const ang = Math.atan2(by - ay, bx - ax);
    const head = (): void => {
      g.beginPath();
      g.moveTo(bx + Math.cos(ang) * 22, by + Math.sin(ang) * 22);
      g.lineTo(bx + Math.cos(ang + 2.3) * 34, by + Math.sin(ang + 2.3) * 34);
      g.lineTo(bx + Math.cos(ang - 2.3) * 34, by + Math.sin(ang - 2.3) * 34);
      g.closePath();
    };
    const line = (): void => {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 3) g.quadraticCurveTo(pts[1][0], pts[1][1], bx, by);
      else g.lineTo(bx, by);
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    line();
    g.strokeStyle = INKC;
    g.lineWidth = 34;
    g.stroke();
    head();
    g.lineWidth = 12;
    g.stroke();
    g.fillStyle = INKC;
    g.fill();
    line();
    g.strokeStyle = color;
    g.lineWidth = 18;
    g.stroke();
    head();
    g.fillStyle = color;
    g.fill();
  };
  const word = (text: string, x: number, y: number, size: number, fill: string, maxW: number, stroke = INKC): void => {
    g.font = font(size);
    const m = g.measureText(text).width;
    if (m > maxW) g.font = font(Math.floor((size * maxW) / m));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = stroke;
    g.lineWidth = 14;
    g.strokeText(text, x, y);
    g.fillStyle = fill;
    g.fillText(text, x, y);
  };

  /** Abgerundetes Rechteck als Pfad (roundRect fehlt älteren Safaris). */
  const rounded = (x: number, y: number, w: number, h: number, r: number): void => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  // Aufbau: links Symbol, Mitte Wort, rechts Pfeil. Liegt der Steg links, wird gespiegelt.
  const flip = side < 0;
  const iconX = flip ? PW - 128 : 22;
  const arrowX = flip ? 70 : PW - 70;
  const textX = PW / 2 + (flip ? 30 : -30);
  const panel = (k: number, bg: string, draw: () => void): void => {
    g.save();
    g.translate(0, k * PH);
    g.fillStyle = INKC;
    g.fillRect(0, 0, PW, PH);
    g.fillStyle = bg;
    rounded(12, 12, PW - 24, PH - 24, 20);
    g.fill();
    // Comic-Glanz: heller Streifen oben
    g.fillStyle = 'rgba(255,255,255,0.18)';
    rounded(26, 22, PW - 52, 34, 14);
    g.fill();
    draw();
    g.restore();
  };
  const flut = (bg: string): void =>
    panel(bg === '#1f7fe0' ? S_FLUT_BLUE : S_FLUT_RED, bg, () => {
      waves(iconX, 104, 106, '#ffffff', 3);
      word('FLUT', textX, 112, 140, '#ffffff', 260);
      word('STEG!', textX, 212, 46, '#fff06a', 200);
      // Pfeil: geradeaus, dann zum Steg hinüber.
      const d = flip ? -1 : 1;
      arrow(
        [
          [arrowX + d * 22, 220],
          [arrowX + d * 22, 92],
          [arrowX - d * 40, 70],
        ],
        '#fff06a',
      );
    });
  flut('#1f7fe0');
  flut('#e8402f');
  panel(S_EBBE, '#3fae5a', () => {
    // Ruhiges Wasser: eine flache Linie
    g.lineCap = 'round';
    g.strokeStyle = INKC;
    g.lineWidth = 17;
    g.beginPath();
    g.moveTo(iconX, 150);
    g.lineTo(iconX + 106, 150);
    g.stroke();
    g.strokeStyle = '#bff0ff';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#ffd23f';
    g.strokeStyle = INKC;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(iconX + 53, 104, 26, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    word('EBBE', textX, 112, 140, '#ffffff', 260);
    word('FREIE FAHRT', textX, 212, 40, '#e9ffd6', 230);
    arrow(
      [
        [arrowX, 222],
        [arrowX, 52],
      ],
      '#ffffff',
    );
  });
  const turn = (k: number, label: string, up: boolean): void =>
    panel(k, '#ffd23f', () => {
      waves(iconX, 168, 106, '#1f7fe0', 2);
      const ax = iconX + 53;
      arrow(
        up
          ? [
              [ax, 136],
              [ax, 44],
            ]
          : [
              [ax, 44],
              [ax, 136],
            ],
        '#1f7fe0',
      );
      // Auf Gelb liest sich Tusche besser als Weiß.
      word(label, textX + (flip ? -10 : 10), 116, 110, INKC, 300, '#fff7c8');
      word('WASSER', textX + (flip ? -10 : 10), 210, 42, INKC, 220, '#fff7c8');
    });
  turn(S_RISE, 'STEIGT', true);
  turn(S_FALL, 'FÄLLT', false);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
