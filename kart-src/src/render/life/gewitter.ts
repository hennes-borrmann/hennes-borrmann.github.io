// Kulisse des Gewitterkamms: ein Gebirge bei Nacht.
//
// Zwischen den Blitzen liegt die Welt im Dunkeln. Die Kulisse ist deshalb in zwei Schichten gebaut:
//
//  1. Was die Nacht selbst erzählt – selbstleuchtend, sparsam, warm gegen das kalte Blau: die Fenster der
//     Berghütte und Rauch aus ihrem Schornstein, die Laterne am Brunnen, Stirnlampen der Zuschauer unter dem
//     Vordach, das Blinken der Seilbahnstationen, eine Gondel mit hellen Fenstern, die langsam zum Gipfel
//     schwebt, die roten Positionslichter des Sendemasts (Wahrzeichen), ein Lagerfeuer mit leuchtenden Zelten,
//     Glühwürmchen und Augenpaare im Bergwald, die Grubenlampe am Stollen, das warme Licht der Lawinengalerie,
//     tief unten im Tal ein Dorf, Höfe, die beleuchtete Staumauer und ein Zug mit Lichterkette.
//  2. Was der Blitz enthüllt – unbeleuchtet, große Formen mit Tuschekontur: der Kranz gezackter Gipfel mit
//     Gletscherzungen, Felstürme und Wächten am Grat, Felswände und Lawinenverbauungen an den Kehren, ein
//     Wasserfall, Wetterfichten mit vom Wind verdrehten Kronen, Geröll, das Gipfelkreuz, die Seilbahntrasse
//     mit Stützen, die Rippen der Galerie, die Klamm mit dem Wildbach, der Holzverbau am Stollen.
//
// Wetter: tief hängende, schwere Wolken ziehen über den Kamm (über ihnen glimmt es, wo es gerade einschlägt –
// allein aus stormLight/pulseCycle der Rennzeit), Nebelfetzen treiben über die Fahrbahn, Regen fällt schräg
// (nur hohe Qualität). Das Aufhellen der ganzen Welt macht render/mechanics/storm.ts – hier kein eigenes.
//
// Technik (harte Vorgabe, siehe toon.ts): nur Eckenfarben, Toon-Material mit Kontur, MeshBasicMaterial
// (auch additiv), Instanzen und Netze mit je Bild neu gesetzten Ecken – keine eigenen Shader, keine
// Texturen, keine Lichtquellen. Licht ist gemalt. Im Lauf wird nichts angelegt.
//
// Zeichenaufrufe (hoch): Körper mit Kontur (2), Kleinkram (1), Leuchtflächen (1), gemaltes Licht samt
// Nebelfetzen (1), Bewegtes mit Kontur (2), Lampen (1), Wolken (1) = 9; dazu zeichnen die Teilchen der Szene
// (Rauch, Funken, Regen) in ihren zwei eigenen Aufrufen.
// Niedrig: Körper (1), Leuchtflächen (1), gemaltes Licht (1), Bewegtes (1), Lampen (1), Wolken (1) = 6.

import * as THREE from 'three';
import { PULSE_BOLT, PULSE_ROD, flashShape, pulseCycle, stormLight } from '../../game/mechanics';
import { rightX, rightZ } from '../../game/track';
import { seeded, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

const TAU = Math.PI * 2;
/** Der Wind weht von Süden über den Kamm nach Norden (Einheitsvektor, wohin). */
const WX = 0.26;
const WZ = 0.966;
/** Drehung um die Hochachse, mit der lokales +z mit dem Wind zeigt (Lee). */
const LEE = Math.atan2(WX, WZ);

// --- Werkzeug: Flächen sammeln, mit Lage ------------------------------------------------

const tv = new THREE.Vector3();
const tp = new THREE.Vector3();
const ts = new THREE.Vector3();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tm = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/** Wie MeshBuilder, aber jede Fläche geht durch die aktuelle Lage (m). */
class Bau {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly m = new THREE.Matrix4();

  get verts(): number {
    return this.pos.length / 3;
  }

  /** Lage für alle folgenden Flächen: verschoben und um die Hochachse gedreht (lokal +z = Richtung rot). */
  lage(x: number, y: number, z: number, rotY = 0): this {
    this.m.makeRotationY(rotY);
    this.m.setPosition(x, y, z);
    return this;
  }

  frei(): this {
    this.m.identity();
    return this;
  }

  private p(x: number, y: number, z: number): void {
    tv.set(x, y, z).applyMatrix4(this.m);
    this.pos.push(tv.x, tv.y, tv.z);
  }

  tri(a: V3, b: V3, c: V3, color: RGB): void {
    this.p(a[0], a[1], a[2]);
    this.p(b[0], b[1], b[2]);
    this.p(c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(color[0], color[1], color[2]);
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: RGB): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Dreieck mit eigener Farbe je Ecke. */
  triV(a: V3, b: V3, c: V3, ca: RGB, cb: RGB, cc: RGB): void {
    this.p(a[0], a[1], a[2]);
    this.col.push(ca[0], ca[1], ca[2]);
    this.p(b[0], b[1], b[2]);
    this.col.push(cb[0], cb[1], cb[2]);
    this.p(c[0], c[1], c[2]);
    this.col.push(cc[0], cc[1], cc[2]);
  }

  /** Viereck mit eigener Farbe je Ecke (Verläufe: gemaltes Licht). */
  quadV(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    this.triV(a, b, c, ca, cb, cc);
    this.triV(a, c, d, ca, cc, cd);
  }

  /** Viereck, dessen Vorderseite von ref weg zeigt. */
  flaeche(a: V3, b: V3, c: V3, d: V3, color: RGB, ref: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const gx = (a[0] + c[0]) / 2 - ref[0];
    const gy = (a[1] + c[1]) / 2 - ref[1];
    const gz = (a[2] + c[2]) / 2 - ref[2];
    if (nx * gx + ny * gy + nz * gz >= 0) this.quad(a, b, c, d, color);
    else this.quad(d, c, b, a, color);
  }

  /** Dreieck wie flaeche(). */
  dreieck(a: V3, b: V3, c: V3, color: RGB, ref: V3): void {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const g = nx * ((a[0] + b[0] + c[0]) / 3 - ref[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - ref[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - ref[2]);
    if (g >= 0) this.tri(a, b, c, color);
    else this.tri(a, c, b, color);
  }

  /** Quader um (cx, cy, cz), um die Hochachse gedreht. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB, boden = true): void {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const q = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const v = [q(-hx, -hy, -hz), q(hx, -hy, -hz), q(hx, hy, -hz), q(-hx, hy, -hz), q(-hx, -hy, hz), q(hx, -hy, hz), q(hx, hy, hz), q(-hx, hy, hz)];
    this.quad(v[4], v[5], v[6], v[7], color);
    this.quad(v[1], v[0], v[3], v[2], color);
    this.quad(v[5], v[1], v[2], v[6], color);
    this.quad(v[0], v[4], v[7], v[3], color);
    this.quad(v[7], v[6], v[2], v[3], top ?? color);
    if (boden) this.quad(v[0], v[1], v[5], v[4], color);
  }

  /** Fertige three.js-Geometrie, einfarbig, mit eigener Lage (Euler YXZ) in der aktuellen Lage. */
  geo(g: THREE.BufferGeometry, color: RGB, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): void {
    te.set(rx, ry, rz, 'YXZ');
    tq.setFromEuler(te);
    tm.compose(tp.set(x, y, z), tq, ts.set(sx, sy, sz));
    this.geoM(g, color, tm);
  }

  geoM(g: THREE.BufferGeometry, color: RGB, local: THREE.Matrix4): void {
    local.premultiply(this.m);
    const src = g.index ? g.toNonIndexed() : g;
    const pa = src.getAttribute('position');
    for (let i = 0; i < pa.count; i++) {
      tv.fromBufferAttribute(pa, i).applyMatrix4(local);
      this.pos.push(tv.x, tv.y, tv.z);
      this.col.push(color[0], color[1], color[2]);
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  /** Balken mit quadratischem Querschnitt von a nach c. */
  stab(a: V3, c: V3, d: number, color: RGB): void {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    tq.setFromUnitVectors(UP, tv.set(dx / len, dy / len, dz / len));
    tm.compose(tp.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), tq, ts.set(d, len, d));
    this.geoM(new THREE.BoxGeometry(1, 1, 1), color, tm);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Ein Stück eines Netzes (Ecken v0 … v1), das je Bild mit der Lage lagen[lage] an seinen Platz gerückt wird. */
interface Lauf {
  v0: number;
  v1: number;
  lage: number;
}

/** Geglättete Normalen je Stück (für die Kontur) – Stücke, die sich am Ursprung überlagern, mischen sich so nicht. */
function glatteNormalen(pos: Float32Array, nor: Float32Array, laeufe: Lauf[]): Float32Array {
  const out = new Float32Array(pos.length);
  const sums = new Map<string, number[]>();
  for (const p of laeufe) {
    sums.clear();
    const key = (i: number): string => `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
    for (let i = p.v0; i < p.v1; i++) {
      const k = key(i);
      const s = sums.get(k);
      if (s) {
        s[0] += nor[i * 3];
        s[1] += nor[i * 3 + 1];
        s[2] += nor[i * 3 + 2];
      } else sums.set(k, [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]]);
    }
    for (let i = p.v0; i < p.v1; i++) {
      const s = sums.get(key(i))!;
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      out[i * 3] = s[0] / l;
      out[i * 3 + 1] = s[1] / l;
      out[i * 3 + 2] = s[2] / l;
    }
  }
  return out;
}

// --- Farben ----------------------------------------------------------------------------

const C = {
  fels: rgb(0x4b5366),
  felsD: rgb(0x353b4b),
  felsH: rgb(0x626b80),
  schnee: rgb(0xd5deee),
  schneeD: rgb(0xa3b0c8),
  eis: rgb(0x9cc2df),
  eisD: rgb(0x6a8fb2),
  holz: rgb(0x6e4f35),
  holzD: rgb(0x4a3524),
  holzH: rgb(0x9a7a52),
  wand: rgb(0x7d6a52),
  dach: rgb(0x47333a),
  dachD: rgb(0x33252b),
  stein: rgb(0x6c6a66),
  beton: rgb(0x8a8f99),
  betonD: rgb(0x5f6470),
  stahl: rgb(0x4d5566),
  stahlD: rgb(0x343a48),
  dunkel: rgb(0x191c24),
  putz: rgb(0xa9a294),
  tanne: rgb(0x22403a),
  tanneD: rgb(0x172d29),
  stamm: rgb(0x4a3628),
  wasser: rgb(0x22344a),
  gischt: rgb(0xe2ecf6),
  gischtD: rgb(0x9fb4cc),
  haut: rgb(0xc9a080),
  zelt: rgb(0xc0602a),
  zeltG: rgb(0x3f6a4a),
  fahneA: rgb(0xf2c230),
  fahneB: rgb(0x2b4a8a),
};
/** Leuchtfarben (Fenster, Glut). */
const G = {
  fenster: rgb(0xffcf78),
  fensterH: rgb(0xffe2a8),
  galerie: rgb(0xe8a85a),
  galerieD: rgb(0xc4843e),
  glut: rgb(0xff8a2a),
  glutH: rgb(0xffd060),
  zeltA: rgb(0x8a4a1c),
  zeltB: rgb(0x6a5a24),
  kalt: rgb(0xcfe6ff),
};

/** Lampen: Art. */
const L_STETIG = 0;
const L_BLINK = 1;
const L_FEUER = 2;
const L_AUGE = 3;
const L_FLIEGE = 4;
const L_STIRN = 5;

export function buildGewitterLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail === 2;
  const lines = detail > 0;
  const rnd = seeded(1300 + t.index * 71);

  // Sammler: große Körper mit Kontur, Kleinkram ohne, Leuchtendes, gemaltes Licht (additiv), Bewegtes.
  const gross = new Bau();
  const klein = lines ? new Bau() : gross;
  const glut = new Bau();
  const licht = new Bau();
  const dyn = new Bau();
  const dynL: Lauf[] = [];
  const glutL: Lauf[] = [];
  const lagen: THREE.Matrix4[] = [];
  const neueLage = (): number => {
    lagen.push(new THREE.Matrix4());
    return lagen.length - 1;
  };

  // --- Strecke ----------------------------------------------------------------------------
  const S = (m: number): number => Math.max(0, Math.min(t.n - 1, Math.round(m / t.step)));
  const br = t.branches[0];
  const SB = (m: number): number => (br ? br.first + Math.max(0, Math.min(br.count - 1, Math.round(m / t.step))) : 0);
  const X = (i: number, lat: number): number => t.px[i] + rightX(t, i) * lat;
  const Z = (i: number, lat: number): number => t.pz[i] + rightZ(t, i) * lat;
  /** Drehung, mit der lokales +z in Fahrtrichtung zeigt (lokales +x zeigt dann nach links, also lat < 0). */
  const HD = (i: number): number => Math.atan2(t.tx[i], t.tz[i]);
  // Gelände wie world.ts es zeichnet: am Rand des Geländenetzes läuft es flach auf die Grundfläche aus.
  let bx0 = Infinity;
  let bx1 = -Infinity;
  let bz0 = Infinity;
  let bz1 = -Infinity;
  for (let i = 0; i < t.total; i++) {
    bx0 = Math.min(bx0, t.px[i]);
    bx1 = Math.max(bx1, t.px[i]);
    bz0 = Math.min(bz0, t.pz[i]);
    bz1 = Math.max(bz1, t.pz[i]);
  }
  const cell = detail === 0 ? 11 : 7.5;
  const gx0 = bx0 - 150;
  const gz0 = bz0 - 150;
  const gnx = Math.ceil((bx1 - bx0 + 300) / cell);
  const gnz = Math.ceil((bz1 - bz0 + 300) / cell);
  const farY = world.theme.farY;
  const ground = (x: number, z: number): number => {
    const ix = (x - gx0) / cell;
    const iz = (z - gz0) / cell;
    const edge = Math.min(ix, gnx - ix, iz, gnz - iz) / 5;
    if (edge <= 0) return farY - 0.2;
    return farY + (world.heightAt(x, z) - farY) * smooth(edge);
  };
  /** Mindestens 3 m (plus Radius r) von jeder Bande entfernt (um Tunnel: vom Fels)? */
  const frei = (x: number, z: number, r: number): boolean => world.clearance(x, z) >= 3 + r;
  /** Abstand zur nächsten Bande ohne Rücksicht auf den Fels um Tunnel (für Galerie und Stollen). */
  const kante = (x: number, z: number): number => {
    let best = Infinity;
    for (let k = 0; k < t.total; k += 2) {
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k];
      if (d < best) best = d;
    }
    return best;
  };
  const belegt: number[] = [];
  const platz = (x: number, z: number, r: number): boolean => {
    for (let k = 0; k < belegt.length; k += 3) if (Math.hypot(x - belegt[k], z - belegt[k + 1]) < r + belegt[k + 2]) return false;
    return true;
  };
  const merke = (x: number, z: number, r: number): void => {
    belegt.push(x, z, r);
  };
  // Die Masten der Blitzableiter gehören storm.ts – drumherum bleibt Platz.
  for (const p of t.pulses) if (p.kind === PULSE_ROD) merke(p.x, p.z, 6);

  // Lampen: x, y, z, Größe, Art, Phase, Farbe, Lage (−1 = fest)
  const lampen: number[] = [];
  const lampe = (x: number, y: number, z: number, size: number, art: number, phase: number, color: number, lage = -1): void => {
    lampen.push(x, y, z, size, art, phase, color, lage);
  };
  /** Weicher Lichtfleck am Boden (additiv): Scheibe mit Farbe in der Mitte, außen schwarz. */
  const pfuetze = (x: number, y: number, z: number, r: number, c: RGB, n = 10): void => {
    const o: V3 = [x, y, z];
    const black: RGB = [0, 0, 0];
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * TAU;
      const a1 = ((k + 1) / n) * TAU;
      licht.triV(o, [x + Math.cos(a1) * r, ground(x + Math.cos(a1) * r, z + Math.sin(a1) * r) + 0.12, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, ground(x + Math.cos(a0) * r, z + Math.sin(a0) * r) + 0.12, z + Math.sin(a0) * r], c, black, black);
    }
  };
  /** Ebene Felsplatte (Absatz am Hang): Oberkante y, achteckig, Seiten bis unter das Gelände. */
  const absatz = (b: Bau, x: number, z: number, r: number, y: number, top: RGB = C.felsH): void => {
    const n = 8;
    let low = y;
    const ring: V3[] = [];
    const fuss: V3[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + 0.3;
      const rr = r * (0.9 + 0.2 * ((k * 7) % 3) / 2);
      const px = x + Math.cos(a) * rr;
      const pz = z + Math.sin(a) * rr;
      const g = ground(px, pz);
      low = Math.min(low, g);
      ring.push([px, y, pz]);
      fuss.push([x + Math.cos(a) * rr * 1.15, Math.min(g, y) - 1.5, z + Math.sin(a) * rr * 1.15]);
    }
    const c: V3 = [x, y, z];
    for (let k = 0; k < n; k++) {
      const q = (k + 1) % n;
      b.dreieck(c, ring[k], ring[q], top, [x, y - 10, z]);
      b.flaeche(ring[k], ring[q], fuss[q], fuss[k], k % 2 ? C.fels : C.felsD, [x, y - 2, z]);
    }
  };
  /** Felszacke: Prisma von unten (y0) bis oben (y1), oben spitz zulaufend und versetzt. */
  const zacke = (b: Bau, x: number, z: number, y0: number, y1: number, r: number, n: number, rot: number, schnee = false, kopf = 0.18): void => {
    const top: V3[] = [];
    const bot: V3[] = [];
    const mid: V3[] = [];
    const ox = (rnd() - 0.5) * r * 0.5;
    const oz = (rnd() - 0.5) * r * 0.5;
    const ym = y0 + (y1 - y0) * 0.62;
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * TAU + (rnd() - 0.5) * 0.4;
      const rr = r * (0.75 + rnd() * 0.5);
      bot.push([x + Math.cos(a) * rr, y0, z + Math.sin(a) * rr]);
      mid.push([x + ox * 0.6 + Math.cos(a) * rr * 0.62, ym + (rnd() - 0.5) * (y1 - y0) * 0.08, z + oz * 0.6 + Math.sin(a) * rr * 0.62]);
      top.push([x + ox + Math.cos(a) * rr * kopf, y1 - rnd() * (y1 - y0) * 0.1, z + oz + Math.sin(a) * rr * kopf]);
    }
    const apex: V3 = [x + ox, y1 + r * 0.25, z + oz];
    const ref: V3 = [x, (y0 + y1) / 2, z];
    for (let k = 0; k < n; k++) {
      const q = (k + 1) % n;
      const cl = k % 3 === 0 ? C.felsD : k % 3 === 1 ? C.fels : C.felsH;
      b.flaeche(bot[k], bot[q], mid[q], mid[k], cl, [x, ym - 6, z]);
      b.flaeche(mid[k], mid[q], top[q], top[k], k % 2 ? C.fels : C.felsD, [x + ox * 0.8, ym, z + oz * 0.8]);
      b.dreieck(top[k], top[q], apex, schnee && k % 2 === 0 ? C.schnee : schnee ? C.schneeD : C.felsH, ref);
    }
  };

  // ==========================================================================================
  // 1. Gipfelkranz: gezackte Gipfel rund um den Kamm, einige mit Gletscherzunge
  // ==========================================================================================
  const cx0 = world.center.x;
  const cz0 = world.center.z;
  // Staumauer und Stausee im Südosten (siehe 9.): dort steht kein Gipfel.
  const SEE_X = 228;
  const SEE_Z = -322;
  {
    const fern = klein;
    const want = detail === 0 ? 7 : 11;
    const peaks: number[] = [];
    for (let k = 0; k < 400 && peaks.length / 4 < want; k++) {
      const a = (peaks.length / 4 / want) * TAU + rnd() * 0.45 + 0.2;
      const d = 360 + rnd() * 90;
      const px = cx0 + Math.cos(a) * d;
      const pz = cz0 + Math.sin(a) * d;
      if (Math.hypot(px - SEE_X - 40, pz - SEE_Z + 50) < 150) {
        peaks.push(NaN, NaN, NaN, NaN);
        continue;
      }
      const H = 105 + rnd() * 80;
      const R0 = H * (0.5 + rnd() * 0.15);
      if (world.clearance(px, pz) < R0 * 1.2 + 25) {
        peaks.push(NaN, NaN, NaN, NaN);
        continue;
      }
      peaks.push(px, pz, H, R0);
    }
    const massiv = (px: number, pz: number, H: number, R0: number, n: number, main: boolean): void => {
      const y0 = -42;
      const F = main ? [0, 0.24, 0.47, 0.68, 0.86] : [0, 0.34, 0.66];
      const RF = main ? [1, 0.74, 0.5, 0.3, 0.12] : [1, 0.6, 0.24];
      const jit: number[] = [];
      for (let i = 0; i < n; i++) jit.push(0.7 + rnd() * 0.6);
      const ring: V3[][] = [];
      const rot = rnd() * TAU;
      for (let j = 0; j < F.length; j++) {
        const r: V3[] = [];
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * TAU + (rnd() - 0.5) * 0.3;
          const rr = R0 * RF[j] * jit[i] * (0.8 + 0.4 * rnd());
          r.push([px + Math.cos(a) * rr, y0 + H * F[j] * (0.9 + 0.2 * rnd()), pz + Math.sin(a) * rr]);
        }
        ring.push(r);
      }
      const apex: V3 = [px + (rnd() - 0.5) * R0 * 0.15, y0 + H, pz + (rnd() - 0.5) * R0 * 0.15];
      // Gletscherzunge: ein Fächer von Flanken zur Strecke hin, vom Gipfel bis ins Tal.
      const ga = Math.atan2(cz0 - pz, cx0 - px);
      const gl = main && rnd() < 0.55;
      const iceAt = (i: number): boolean => {
        if (!gl) return false;
        const a = rot + ((i + 0.5) / n) * TAU;
        const d = Math.atan2(Math.sin(a - ga), Math.cos(a - ga));
        return Math.abs(d) < 0.42;
      };
      for (let j = 0; j + 1 < ring.length; j++) {
        for (let i = 0; i < n; i++) {
          const q = (i + 1) % n;
          const a = ring[j][i];
          const b = ring[j][q];
          const c = ring[j + 1][q];
          const d = ring[j + 1][i];
          const hf = j / (ring.length - 1);
          let col: RGB;
          if (iceAt(i)) col = (i + j) % 2 ? C.eis : C.eisD;
          else if (hf >= 0.5 && (i + j) % 3 !== 0) col = (i + j) % 2 ? C.schnee : C.schneeD;
          else col = (i + j) % 3 === 0 ? C.felsD : (i + j) % 3 === 1 ? C.fels : C.felsH;
          fern.flaeche(a, b, c, d, col, [px, (a[1] + c[1]) / 2 - 4, pz]);
        }
      }
      const top = ring[ring.length - 1];
      for (let i = 0; i < n; i++) fern.dreieck(top[i], top[(i + 1) % n], apex, i % 2 ? C.schnee : C.schneeD, [px, apex[1] - 30, pz]);
    };
    for (let k = 0; k < peaks.length; k += 4) {
      const px = peaks[k];
      if (!Number.isFinite(px)) continue;
      const pz = peaks[k + 1];
      const H = peaks[k + 2];
      const R0 = peaks[k + 3];
      massiv(px, pz, H, R0, detail === 0 ? 8 : 11, true);
      if (detail > 0) {
        // Nebenzacken: kleinere, schärfere Spitzen an der Flanke – die Kette wird gezackt.
        const nb = 1 + Math.floor(rnd() * 2);
        for (let b = 0; b < nb; b++) {
          const a = rnd() * TAU;
          const bx = px + Math.cos(a) * R0 * 0.7;
          const bz = pz + Math.sin(a) * R0 * 0.7;
          if (world.clearance(bx, bz) < R0 * 0.6 + 25) continue;
          massiv(bx, bz, H * (0.55 + rnd() * 0.2), R0 * 0.42, 7, false);
        }
      }
    }
  }

  // ==========================================================================================
  // 2. Hochplateau: Berghütte mit Terrasse, Fahnenmast, Brunnen, Holzstapel, Wegweiser-Baum, Vordach
  // ==========================================================================================
  let schornstein: V3 = [0, -999, 0];
  {
    const i = S(34);
    const hd = HD(i);
    const lat = -(t.wh[i] + 11.2);
    const hx = X(i, lat);
    const hz = Z(i, lat);
    merke(hx, hz, 10);
    const y0 = t.py[i] + 0.4;
    // Sockel aus Bruchstein bis unter das abfallende Gelände
    let gmin = y0;
    for (const [a, b] of [
      [-5, -8],
      [5, -8],
      [-5, 8],
      [5, 8],
      [0, 0],
    ])
      gmin = Math.min(gmin, ground(hx + Math.cos(hd) * a + Math.sin(hd) * b, hz - Math.sin(hd) * a + Math.cos(hd) * b));
    gross.lage(hx, 0, hz, hd);
    gross.box(0, (y0 + gmin - 2) / 2, 0, 8.8, y0 - gmin + 2, 13.8, C.stein, 0, C.stein, false);
    // Wände (Holz), Dach mit Giebeln
    gross.box(0, y0 + 1.7, 0, 8, 3.4, 13, C.wand, 0, C.wand, false);
    const e = y0 + 3.2;
    const r = y0 + 6.1;
    const ref: V3 = [0, y0 + 2, 0];
    for (const s of [-1, 1]) {
      gross.flaeche([s * 4.9, e, -7.2], [s * 4.9, e, 7.2], [0, r, 7.2], [0, r, -7.2], s < 0 ? C.dach : C.dachD, ref);
      gross.flaeche([s * 4.9, e - 0.25, -7.2], [s * 4.9, e - 0.25, 7.2], [0, r - 0.25, 7.2], [0, r - 0.25, -7.2], C.holzD, [0, r + 5, 0]);
      gross.dreieck([-4, y0 + 3.4, s * 6.5], [4, y0 + 3.4, s * 6.5], [0, r - 0.1, s * 6.5], C.wand, ref);
    }
    gross.box(1.9, r - 0.2, 3.2, 1.0, 2.6, 1.0, C.stein, 0, C.dunkel);
    gross.frei();
    tv.set(1.9, r + 1.2, 3.2).applyAxisAngle(UP, hd);
    schornstein = [hx + tv.x, tv.y, hz + tv.z];
    // Fenster: zur Bahn (lokal −x) vier, an den Giebelseiten je eins; Tür
    klein.lage(hx, 0, hz, hd);
    glut.lage(hx, 0, hz, hd);
    licht.lage(hx, 0, hz, hd);
    const warm: RGB = [0.5, 0.32, 0.12];
    const schwarz: RGB = [0, 0, 0];
    for (const wz of [-4.6, -1.9, 2.0, 4.7]) {
      glut.box(-4.04, y0 + 1.8, wz, 0.1, 1.05, 1.15, wz === -1.9 ? G.fensterH : G.fenster);
      klein.box(-4.12, y0 + 1.8, wz, 0.08, 1.15, 0.1, C.holzD);
      klein.box(-4.12, y0 + 1.8, wz, 0.08, 0.1, 1.25, C.holzD);
      // Lichtschein auf der Terrasse vor dem Fenster
      licht.quadV([-4.1, y0 + 0.08, wz - 0.6], [-4.1, y0 + 0.08, wz + 0.6], [-7.6, y0 + 0.08, wz + 1.6], [-7.6, y0 + 0.08, wz - 1.6], warm, warm, schwarz, schwarz);
    }
    licht.frei();
    for (const s of [-1, 1]) {
      glut.box(-1.6, y0 + 1.8, s * 6.54, 1.1, 1.0, 0.1, G.fenster);
      glut.box(1.8, y0 + 1.8, s * 6.54, 1.1, 1.0, 0.1, G.fenster);
      glut.box(0, y0 + 4.5, s * 6.54, 0.8, 0.7, 0.1, G.fensterH);
    }
    klein.box(-4.06, y0 + 1.15, 0.05, 0.12, 2.3, 1.2, C.holzD);
    // Terrasse auf Stelzen mit Geländer, Tische
    klein.box(-5.8, y0 - 0.15, 0, 3.6, 0.3, 13, C.holz);
    for (const tz of [-6.2, -2, 2, 6.2]) {
      const wx = hx + Math.cos(hd) * -7.4 + Math.sin(hd) * tz;
      const wz = hz - Math.sin(hd) * -7.4 + Math.cos(hd) * tz;
      klein.box(-7.4, (y0 + ground(wx, wz)) / 2 - 0.5, tz, 0.3, y0 - ground(wx, wz) + 1, 0.3, C.holzD);
      klein.box(-7.45, y0 + 0.5, tz, 0.14, 1.0, 0.14, C.holzD);
    }
    klein.box(-7.45, y0 + 1.0, 0, 0.12, 0.12, 12.8, C.holz);
    klein.box(-7.45, y0 + 0.55, 0, 0.06, 0.06, 12.8, C.holz);
    for (const tz of [-3.4, 3.4]) {
      klein.box(-5.9, y0 + 0.75, tz, 1.0, 0.1, 2.0, C.holzH);
      klein.box(-5.9, y0 + 0.37, tz, 0.15, 0.74, 0.15, C.holzD);
      klein.box(-5.1, y0 + 0.45, tz, 0.4, 0.08, 2.0, C.holz);
      klein.box(-6.7, y0 + 0.45, tz, 0.4, 0.08, 2.0, C.holz);
    }
    // Holzstapel an der Giebelseite (Stirnholz hell), mit Brettdach
    klein.box(1.6, y0 + 0.75, -7.25, 3.0, 1.5, 0.9, C.holzH, 0, C.holz);
    klein.box(1.6, y0 + 1.6, -7.35, 3.3, 0.1, 1.2, C.dachD);
    // Fahnenmast mit Fahne (gelb-blau, steht im Wind)
    {
      const fx = -7.3;
      const fz = -7.8;
      gross.lage(hx, 0, hz, hd);
      gross.box(fx, y0 + 4, fz, 0.16, 8, 0.16, C.stahl);
      gross.frei();
      const wa = LEE - hd;
      const ca = Math.sin(wa);
      const sa = Math.cos(wa);
      for (let k = 0; k < 3; k++) {
        const u0 = k * 0.6;
        const u1 = (k + 1) * 0.6;
        const w0 = Math.sin(k * 1.7) * 0.18;
        const w1 = Math.sin((k + 1) * 1.7) * 0.18;
        const a: V3 = [fx + ca * u0 - sa * w0, y0 + 7.8, fz + sa * u0 + ca * w0];
        const b: V3 = [fx + ca * u1 - sa * w1, y0 + 7.8 - k * 0.04, fz + sa * u1 + ca * w1];
        const c: V3 = [b[0], b[1] - 0.5, b[2]];
        const d: V3 = [a[0], a[1] - 0.5, a[2]];
        const c2: V3 = [b[0], b[1] - 1.0, b[2]];
        const d2: V3 = [a[0], a[1] - 1.0, a[2]];
        klein.quad(a, b, c, d, C.fahneA);
        klein.quad(d, c, b, a, C.fahneA);
        klein.quad(d, c, c2, d2, C.fahneB);
        klein.quad(d2, c2, c, d, C.fahneB);
      }
    }
    // Brunnen mit Trog, Laterne am Pfahl, Lichtfleck
    {
      klein.lage(hx, 0, hz, hd);
      const bx = -6.2;
      const bz = 9.6;
      const wx = hx + Math.cos(hd) * bx + Math.sin(hd) * bz;
      const wz = hz - Math.sin(hd) * bx + Math.cos(hd) * bz;
      const g = Math.max(ground(wx, wz), y0 - 2.5);
      klein.frei();
      absatz(klein, wx, wz, 2.6, y0 - 0.05, C.stein);
      klein.lage(hx, 0, hz, hd);
      klein.box(bx, y0 + 0.4, bz, 1.0, 0.8, 2.4, C.holz, 0, C.wasser);
      klein.box(bx + 0.5, y0 + 0.9, bz - 1.0, 0.25, 1.8, 0.25, C.holzD);
      klein.box(bx + 0.2, y0 + 1.6, bz - 1.0, 0.6, 0.1, 0.1, C.stahl);
      klein.box(bx + 0.5, y0 + 1.3, bz + 1.4, 0.16, 2.6, 0.16, C.stahlD);
      klein.box(bx + 0.5, y0 + 2.75, bz + 1.4, 0.4, 0.45, 0.4, C.dunkel);
      glut.box(bx + 0.5, y0 + 2.7, bz + 1.4, 0.3, 0.3, 0.3, G.fensterH);
      tv.set(bx + 0.5, 0, bz + 1.4).applyAxisAngle(UP, hd);
      lampe(hx + tv.x, y0 + 2.72, hz + tv.z, 0.95, L_STETIG, 0, 0xffc870);
      pfuetze(hx + tv.x, Math.max(g, y0) + 0.1, hz + tv.z, 3.6, [0.42, 0.27, 0.1]);
    }
    // Wegweiser-Baum (Wanderwege, weit weg von der Bahn): Pfahl mit Holzarmen
    {
      klein.lage(hx, 0, hz, hd);
      const wx = -6.4;
      const wz = -10.2;
      klein.box(wx, y0 + 1.1, wz, 0.22, 3.4, 0.22, C.holzD);
      for (let k = 0; k < 4; k++) klein.box(wx + 0.4 * Math.cos(k * 1.9), y0 + 2.6 - k * 0.38, wz + 0.4 * Math.sin(k * 1.9), 1.3, 0.24, 0.05, k % 2 ? C.holzH : C.holz, k * 1.9);
      const wpx = hx + Math.cos(hd) * wx + Math.sin(hd) * wz;
      const wpz = hz - Math.sin(hd) * wx + Math.cos(hd) * wz;
      klein.frei();
      absatz(klein, wpx, wpz, 1.4, y0 - 0.1, C.stein);
    }
    klein.frei();
    glut.frei();
    // Licht aus der Hütte nach draußen: weicher Schein vor der Giebelseite
    for (const s of [-1, 1]) {
      tv.set(0, 0, s * 9).applyAxisAngle(UP, hd);
      pfuetze(hx + tv.x, ground(hx + tv.x, hz + tv.z) + 0.1, hz + tv.z, 3.4, [0.22, 0.14, 0.05], 8);
    }
  }
  // Vordach mit Zuschauern (Stirnlampen)
  {
    const i = S(70);
    const hd = HD(i);
    const lat = -(t.wh[i] + 4.7);
    const vx = X(i, lat);
    const vz = Z(i, lat);
    merke(vx, vz, 6);
    const y0 = t.py[i] + 0.35;
    gross.lage(vx, 0, vz, hd);
    // Plattform auf Stelzen
    gross.box(0, y0 - 0.15, 0, 3.4, 0.3, 10.4, C.holz);
    for (const [px, pz] of [
      [-1.5, -5],
      [1.5, -5],
      [-1.5, 5],
      [1.5, 5],
      [1.5, 0],
    ]) {
      const wx = vx + Math.cos(hd) * px + Math.sin(hd) * pz;
      const wz = vz - Math.sin(hd) * px + Math.cos(hd) * pz;
      const g = ground(wx, wz);
      gross.box(px, (y0 + g) / 2 - 0.4, pz, 0.3, y0 - g + 0.8, 0.3, C.holzD);
      gross.box(px, y0 + 1.5, pz, 0.24, 3.0, 0.24, C.holzD);
    }
    gross.flaeche([1.9, y0 + 3.3, -5.6], [1.9, y0 + 3.3, 5.6], [-2.1, y0 + 2.7, 5.6], [-2.1, y0 + 2.7, -5.6], C.dach, [0, y0, 0]);
    gross.flaeche([1.9, y0 + 3.1, -5.6], [1.9, y0 + 3.1, 5.6], [-2.1, y0 + 2.5, 5.6], [-2.1, y0 + 2.5, -5.6], C.holzD, [0, y0 + 10, 0]);
    gross.frei();
    const jacken = [rgb(0x3f5a7a), rgb(0x6a4a6a), rgb(0x4a6a4a), rgb(0x7a5a3a), rgb(0x5a5f73), rgb(0x2f4f6f)];
    klein.lage(vx, 0, vz, hd);
    for (let k = 0; k < 6; k++) {
      const pz = -4.1 + k * 1.65 + (rnd() - 0.5) * 0.3;
      const px = 0.2 + (rnd() - 0.5) * 0.6;
      const hgt = 0.9 + rnd() * 0.15;
      klein.box(px, y0 + 0.42, pz, 0.32, 0.84, 0.42, C.dunkel);
      klein.box(px, y0 + 0.84 + hgt * 0.5, pz, 0.42, hgt * 0.9, 0.56, jacken[k]);
      klein.geo(new THREE.IcosahedronGeometry(0.2, 0), C.haut, px, y0 + 1.84 + hgt * 0.1, pz);
      klein.box(px + 0.05, y0 + 1.98 + hgt * 0.1, pz, 0.36, 0.14, 0.36, jacken[(k + 2) % 6]);
      tv.set(px - 0.22, y0 + 1.86 + hgt * 0.1, pz).applyAxisAngle(UP, hd);
      lampe(vx + tv.x, tv.y, vz + tv.z, 0.42, L_STIRN, rnd() * TAU, 0xfff2d0);
    }
    klein.frei();
  }

  // ==========================================================================================
  // 3. Seilbahn: Talstation am Plateau, Bergstation am Grat, Seile mit Stützen, eine Gondel
  // ==========================================================================================
  const seil = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, sag: 0, sx: 0, sz: 0, ok: false };
  const station = (i: number, toward: [number, number] | null): [number, number, number, number] => {
    const lat = t.wh[i] + 8.6;
    const sx = X(i, lat);
    const sz = Z(i, lat);
    merke(sx, sz, 8);
    const rot = toward ? Math.atan2(toward[0] - sx, toward[1] - sz) : HD(i);
    const y0 = t.py[i] + 0.3;
    let gmin = y0;
    for (const [a, b] of [
      [-4.5, -5.5],
      [4.5, -5.5],
      [-4.5, 5.5],
      [4.5, 5.5],
    ])
      gmin = Math.min(gmin, ground(sx + Math.cos(rot) * a + Math.sin(rot) * b, sz - Math.sin(rot) * a + Math.cos(rot) * b));
    gross.lage(sx, 0, sz, rot);
    gross.box(0, (y0 + gmin - 2) / 2, 0, 8.6, y0 - gmin + 2, 10.6, C.betonD, 0, C.betonD, false);
    gross.box(0, y0 + 3.4, -1, 8, 6.8, 8, C.beton, 0, C.beton, false);
    gross.box(0, y0 + 7.1, 0.4, 9.2, 0.6, 11.4, C.stahlD);
    // offene Seite zum Seil: dunkle Halle, Seilscheibe
    gross.box(-3.7, y0 + 3.4, 3.6, 0.6, 6.8, 1.2, C.beton, 0, C.beton, false);
    gross.box(3.7, y0 + 3.4, 3.6, 0.6, 6.8, 1.2, C.beton, 0, C.beton, false);
    klein.lage(sx, 0, sz, rot);
    klein.box(0, y0 + 3.2, 3.0, 6.8, 6.2, 0.2, C.dunkel);
    gross.geo(new THREE.CylinderGeometry(2.4, 2.4, 0.35, 12), C.stahl, 0, y0 + 5.9, 3.4);
    gross.frei();
    // Fenster zur Rückseite (Bahn), Lampe über der Tür, gelbes Blinklicht auf dem Dach
    glut.lage(sx, 0, sz, rot);
    for (const wx of [-2.6, 2.6]) glut.box(wx, y0 + 2.8, -5.04, 1.6, 1.0, 0.1, G.fenster);
    glut.box(0, y0 + 1.2, -5.04, 1.3, 2.3, 0.1, rgb(0x7a5a30));
    klein.box(0, y0 + 2.6, -5.4, 1.8, 0.12, 0.8, C.stahlD);
    glut.frei();
    klein.frei();
    const w = (a: number, b: number, y: number): V3 => [sx + Math.cos(rot) * a + Math.sin(rot) * b, y, sz - Math.sin(rot) * a + Math.cos(rot) * b];
    const l1 = w(0, -5.5, y0 + 2.45);
    lampe(l1[0], l1[1], l1[2], 0.8, L_STETIG, 0, 0xffd890);
    const l2 = w(3.9, -4.4, y0 + 7.6);
    lampe(l2[0], l2[1], l2[2], 0.75, L_BLINK, 0.8 + i * 0.01, 0xffa030);
    const p1 = w(0, -7.5, 0);
    pfuetze(p1[0], ground(p1[0], p1[2]), p1[2], 3.2, [0.32, 0.22, 0.09], 8);
    const exit = w(0, 4.8, y0 + 5.9);
    return [exit[0], exit[1], exit[2], rot];
  };
  {
    const iA = S(60);
    const iB = S(882);
    const bxz: [number, number] = [X(iB, t.wh[iB] + 8.6), Z(iB, t.wh[iB] + 8.6)];
    const axz: [number, number] = [X(iA, t.wh[iA] + 8.6), Z(iA, t.wh[iA] + 8.6)];
    const A = station(iA, bxz);
    const B = station(iB, axz);
    seil.ax = A[0];
    seil.ay = A[1];
    seil.az = A[2];
    seil.bx = B[0];
    seil.by = B[1];
    seil.bz = B[2];
    const L = Math.hypot(seil.bx - seil.ax, seil.bz - seil.az);
    seil.sag = L * 0.055;
    // quer zum Seil (horizontal)
    seil.sx = -(seil.bz - seil.az) / L;
    seil.sz = (seil.bx - seil.ax) / L;
    seil.ok = true;
  }
  /** Punkt auf dem Seil (Anteil u von der Tal- zur Bergstation), seitlich um o versetzt. */
  const seilPunkt = (u: number, o: number, out: THREE.Vector3): THREE.Vector3 =>
    out.set(seil.ax + (seil.bx - seil.ax) * u + seil.sx * o, seil.ay + (seil.by - seil.ay) * u - seil.sag * 4 * u * (1 - u), seil.az + (seil.bz - seil.az) * u + seil.sz * o);
  {
    const N = detail === 0 ? 10 : 18;
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    for (const o of [-1.6, 1.6]) {
      for (let k = 0; k < N; k++) {
        seilPunkt(k / N, o, pa);
        seilPunkt((k + 1) / N, o, pb);
        klein.stab([pa.x, pa.y, pa.z], [pb.x, pb.y, pb.z], 0.2, C.stahlD);
      }
    }
    // Stützen: Gittermasten aus vier Beinen, Querjoch mit Rollen
    for (const u of [0.34, 0.67]) {
      seilPunkt(u, 0, pa);
      const g = ground(pa.x, pa.z);
      const top = pa.y + 0.4;
      const fx = seil.sx;
      const fz = seil.sz;
      const ax = (seil.bx - seil.ax) / Math.hypot(seil.bx - seil.ax, seil.bz - seil.az);
      const az = (seil.bz - seil.az) / Math.hypot(seil.bx - seil.ax, seil.bz - seil.az);
      const leg = (s1: number, s2: number, r: number, y: number): V3 => [pa.x + fx * s1 * r + ax * s2 * r, y, pa.z + fz * s1 * r + az * s2 * r];
      const legs: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (const [s1, s2] of legs) gross.stab(leg(s1, s2, 3.2, g - 1), leg(s1, s2, 0.7, top - 1.4), 0.4, C.stahl);
      const bays = detail === 0 ? 2 : 4;
      for (let b = 1; b <= bays; b++) {
        const f = b / (bays + 1);
        const y = g - 1 + (top - 1.4 - g + 1) * f;
        const r = 3.2 + (0.7 - 3.2) * f;
        for (let k = 0; k < 4; k++) gross.stab(leg(legs[k][0], legs[k][1], r, y), leg(legs[(k + 1) % 4][0], legs[(k + 1) % 4][1], r, y), 0.22, C.stahlD);
      }
      gross.stab([pa.x - fx * 2.6, top - 1.2, pa.z - fz * 2.6], [pa.x + fx * 2.6, top - 1.2, pa.z + fz * 2.6], 0.5, C.stahl);
      for (const o of [-1.6, 1.6]) klein.box(pa.x + fx * o, top - 0.75, pa.z + fz * o, 0.5, 0.5, 2.4, C.stahlD, Math.atan2(ax, az));
      lampe(pa.x, top + 0.1, pa.z, 0.55, L_BLINK, u * 3, 0xff4a3a);
    }
  }
  // Gondel (bewegt): Gehänge, Kabine, warme Fensterbänder
  const gondel = neueLage();
  {
    const v0 = dyn.verts;
    dyn.frei();
    dyn.box(0, -0.8, 0, 0.18, 1.6, 0.18, C.stahlD);
    dyn.box(0, -0.15, 0, 0.5, 0.35, 1.2, C.stahl);
    dyn.box(0, -1.7, 0, 1.6, 0.25, 1.6, C.stahlD);
    dyn.box(0, -3.1, 0, 2.6, 2.6, 3.0, rgb(0xb8452f), 0, rgb(0x7a2e22));
    dynL.push({ v0, v1: dyn.verts, lage: gondel });
    const g0 = glut.verts;
    glut.frei();
    glut.box(1.32, -2.9, 0, 0.06, 0.9, 2.5, G.fenster);
    glut.box(-1.32, -2.9, 0, 0.06, 0.9, 2.5, G.fenster);
    glut.box(0, -2.9, 1.52, 2.1, 0.9, 0.06, G.fensterH);
    glut.box(0, -2.9, -1.52, 2.1, 0.9, 0.06, G.fensterH);
    glutL.push({ v0: g0, v1: glut.verts, lage: gondel });
    lampe(0, -4.5, 0, 0.5, L_STETIG, 0, 0xfff0c8, gondel);
  }

  // ==========================================================================================
  // 4. Ostflanke: Felswände bergseitig, Lawinenverbauungen, ein Wasserfall; Höfe tief unten im Tal
  // ==========================================================================================
  let fall: V3 = [0, -999, 0];
  {
    // Wasserfall an einer hohen Felswand
    for (let m = 498, tries = 0; tries < 12 && fall[1] < -900; tries++, m += 9) {
      const i = S(m);
      const lat = t.wh[i] + 12 + (tries % 3) * 2;
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 6) || !platz(x, z, 7)) continue;
      merke(x, z, 7);
      const hd = HD(i);
      const g = ground(x, z);
      const top = t.py[i] + 17;
      gross.lage(x, 0, z, hd);
      // Wand: lokal +x zeigt zur Bahn
      const yb = g - 4;
      const P = (a: number, b: number, y: number): V3 => [a, y, b];
      const ref: V3 = [-3, (yb + top) / 2, 0];
      const front = [P(3.4, -7, yb), P(3.8, -2.2, yb), P(3.7, 2.4, yb), P(3.2, 7, yb)];
      const fTop = [P(0.6, -5, top - 5), P(1.2, -1.6, top), P(1.1, 1.8, top + 1.5), P(0.2, 4.6, top - 6)];
      const back = [P(-5, -6, yb), P(-5.5, 6, yb)];
      const bTop = [P(-3.2, -3.6, top - 7), P(-3.4, 3.4, top - 5)];
      for (let k = 0; k < 3; k++) gross.flaeche(front[k], front[k + 1], fTop[k + 1], fTop[k], k === 1 ? C.felsH : C.fels, ref);
      gross.flaeche(front[0], fTop[0], bTop[0], back[0], C.felsD, ref);
      gross.flaeche(front[3], fTop[3], bTop[1], back[1], C.felsD, ref);
      gross.flaeche(back[0], bTop[0], bTop[1], back[1], C.felsD, ref);
      gross.flaeche(fTop[0], fTop[1], bTop[1], bTop[0], C.fels, ref);
      gross.dreieck(fTop[1], fTop[2], bTop[1], C.fels, ref);
      gross.dreieck(fTop[2], fTop[3], bTop[1], C.felsH, ref);
      gross.frei();
      // Wasser: Band über die Wandfläche (vorn, etwas davor), unten ein Gumpen
      klein.lage(x, 0, z, hd);
      const n = 8;
      for (let k = 0; k < n; k++) {
        const ya = top - 0.4 - ((top - 0.4 - g) * k) / n;
        const yb2 = top - 0.4 - ((top - 0.4 - g) * (k + 1)) / n;
        const fa = (top - 0.4 - ya) / (top - yb);
        const fb = (top - 0.4 - yb2) / (top - yb);
        const xa = 1.55 + 2.45 * fa + Math.sin(k * 1.3) * 0.12;
        const xb = 1.55 + 2.45 * fb + Math.sin((k + 1) * 1.3) * 0.12;
        const wa = 0.9 + k * 0.12;
        const wb = 0.9 + (k + 1) * 0.12;
        klein.quad([xa, ya, -wa], [xa, ya, wa], [xb, yb2, wb], [xb, yb2, -wb], k % 2 ? C.gischt : C.gischtD);
        klein.quad([xa, ya, -wa], [xb, yb2, -wb], [xb, yb2, wb], [xa, ya, wa], k % 2 ? C.gischt : C.gischtD);
      }
      klein.frei();
      const ox = Math.cos(hd) * 5.6;
      const oz = -Math.sin(hd) * 5.6;
      zacke(gross, x - Math.sin(hd) * 9 - ox * 0.3, z - Math.cos(hd) * 9 - oz * 0.3, g - 4, top - 6, 4.5, 6, rnd() * TAU, true, 0.3);
      const px = x + ox;
      const pz = z + oz;
      klein.geo(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 9), C.gischtD, px, ground(px, pz) + 0.1, pz);
      klein.geo(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 7), C.gischt, px - ox * 0.25, ground(px, pz) + 0.25, pz - oz * 0.25);
      fall = [px, ground(px, pz) + 0.6, pz];
    }
    // Felswände bergseitig (innen), ein paar Zacken talseitig
    for (let m = 214; m < 695; m += 15) {
      const i = S(m + rnd() * 6);
      const inner = rnd() < 0.78;
      const lat = (inner ? 1 : -1) * (t.wh[i] + 5 + rnd() * 6);
      const x = X(i, lat);
      const z = Z(i, lat);
      const r = 4 + rnd() * 3;
      if (!frei(x, z, r * 0.8) || !platz(x, z, r)) continue;
      merke(x, z, r);
      const g = ground(x, z);
      const top = t.py[i] + (inner ? 4 + rnd() * 8 : 1.5 + rnd() * 3);
      if (top < g + 2) continue;
      // breite, oben abgebrochene Felsmassen: eine Wand aus Blöcken
      zacke(gross, x, z, g - 3, top, r, 6, rnd() * TAU, rnd() < 0.25, 0.3 + rnd() * 0.15);
    }
    // Lawinenverbauungen: Reihen von Stahl-Schneebrücken am Hang zwischen den Kehren
    let rows = 0;
    for (let m = 250; m < 690 && rows < (detail === 0 ? 3 : 6); m += 37) {
      const i = S(m);
      const lat = t.wh[i] + 12 + rnd() * 5;
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 9) || !platz(x, z, 9)) continue;
      const g = ground(x, z);
      if (g > t.py[i] - 3) continue;
      merke(x, z, 9);
      rows++;
      const hd = HD(i);
      for (let u = -1; u <= 1; u++) {
        const ux = x + Math.sin(hd) * u * 5.6;
        const uz = z + Math.cos(hd) * u * 5.6;
        const ug = ground(ux, uz);
        // talwärts geneigte Roste: Pfosten, drei Querträger
        const lx = Math.cos(hd) * 0.9;
        const lz = -Math.sin(hd) * 0.9;
        const ax = Math.sin(hd) * 2.6;
        const az = Math.cos(hd) * 2.6;
        for (const s of [-1, 1]) gross.stab([ux + ax * s, ug - 0.5, uz + az * s], [ux + ax * s + lx, ug + 3.2, uz + az * s + lz], 0.2, C.stahl);
        for (let b = 0; b < (detail === 0 ? 2 : 3); b++) {
          const f = 0.3 + b * 0.3;
          gross.stab([ux - ax + lx * f, ug - 0.5 + 3.7 * f, uz - az + lz * f], [ux + ax + lx * f, ug - 0.5 + 3.7 * f, uz + az + lz * f], 0.16, C.stahlD);
        }
      }
    }
    // Höfe tief unten im Tal östlich der Kehren: Haus und Stall, warme Fenster
    for (const [fx, fz] of [
      [262, -140],
      [272, -28],
      [248, 92],
    ]) {
      if (world.clearance(fx, fz) < 30) continue;
      const g = ground(fx, fz);
      // Fensterseite (lokal −x) zum Kamm hin: von der Strecke aus sieht man die Lichter
      const rot = Math.atan2(cz0 - fz, -(cx0 - fx)) + (rnd() - 0.5) * 0.6;
      gross.lage(fx, g, fz, rot);
      gross.box(0, 0.9, 0, 7, 6.4, 9, C.putz, 0, C.putz, false);
      gross.flaeche([-4.2, 4.1, -5], [-4.2, 4.1, 5], [0, 6.6, 5], [0, 6.6, -5], C.dach, [0, 2, 0]);
      gross.flaeche([4.2, 4.1, -5], [4.2, 4.1, 5], [0, 6.6, 5], [0, 6.6, -5], C.dachD, [0, 2, 0]);
      gross.box(7.5, 1.2, 1, 6, 6.6, 11, C.holzD, 0, C.dachD, false);
      gross.frei();
      glut.lage(fx, g, fz, rot);
      glut.box(-3.54, 2.3, -2, 0.1, 1.0, 1.1, G.fenster);
      glut.box(-3.54, 2.3, 2, 0.1, 1.0, 1.1, G.fensterH);
      glut.box(0, 2.3, -4.54, 1.1, 1.0, 0.1, G.fenster);
      glut.frei();
      tv.set(-4.2, 0, 0).applyAxisAngle(UP, rot);
      lampe(fx + tv.x, g + 3.4, fz + tv.z, 2.2, L_STETIG, 0, 0xffc070);
      tv.set(-4.1, 0, 2).applyAxisAngle(UP, rot);
      lampe(fx + tv.x, g + 2.3, fz + tv.z, 1.5, L_STETIG, 0, 0xd88a40);
    }
  }

  // Weiler weit unten in den Tälern ringsum: ein paar Häuser, deren Fenster durch die Nacht scheinen
  for (const [wx, wz, nh] of [
    [250, -70, 4],
    [-20, 262, 5],
    [-338, 30, 4],
    [196, 236, 3],
    [-330, -200, 3],
  ]) {
    for (let h = 0, tries = 0; h < (detail === 0 ? Math.min(nh, 3) : nh) && tries < 40; tries++) {
      const x = wx + (rnd() - 0.5) * 40;
      const z = wz + (rnd() - 0.5) * 40;
      if (world.clearance(x, z) < 30 || !platz(x, z, 5)) continue;
      merke(x, z, 5);
      h++;
      const g = ground(x, z);
      // Fensterseite (lokal −x) zum Kamm hin: von der Strecke aus sieht man die Lichter
      const rot = Math.atan2(cz0 - z, -(cx0 - x)) + (rnd() - 0.5) * 0.6;
      gross.lage(x, g, z, rot);
      gross.box(0, 0.7, 0, 5.5, 6.2, 7, h % 2 ? C.putz : C.wand, 0, C.putz, false);
      gross.flaeche([-3.3, 3.7, -3.9], [-3.3, 3.7, 3.9], [0, 5.9, 3.9], [0, 5.9, -3.9], C.dach, [0, 2, 0]);
      gross.flaeche([3.3, 3.7, -3.9], [3.3, 3.7, 3.9], [0, 5.9, 3.9], [0, 5.9, -3.9], C.dachD, [0, 2, 0]);
      gross.frei();
      glut.lage(x, g, z, rot);
      const fz = (rnd() - 0.5) * 3;
      glut.box(-2.79, 2.2, fz, 0.1, 1.0, 1.0, G.fenster);
      if (rnd() < 0.6) glut.box(2.79, 2.2, (rnd() - 0.5) * 3, 0.1, 1.0, 1.0, G.fensterH);
      glut.frei();
      // Schein vor dem Fenster (lokal −x)
      lampe(x - Math.cos(rot) * 3.5 + Math.sin(rot) * fz, g + 2.2, z + Math.sin(rot) * 3.5 + Math.cos(rot) * fz, h === 1 ? 2.0 : 1.5, L_STETIG, 0, h === 1 ? 0xffc070 : 0xc07a3a);
    }
  }

  // ==========================================================================================
  // 5. Gipfelgrat: Sendemast (Wahrzeichen), Gipfelkreuz, Wetterstation, Felszacken, Wächten
  // ==========================================================================================
  let windmesser = -1;
  {
    // Sendemast: hoher Gittermast auf der Nordseite, rote Positionslichter
    const i = t.landmark;
    let lat = -(t.wh[i] + 5.6);
    for (let k = 0; k < 6 && !frei(X(i, lat), Z(i, lat), 2.6); k++) lat -= 1;
    const mx = X(i, lat);
    const mz = Z(i, lat);
    merke(mx, mz, 6);
    const base = t.py[i] - 1.5;
    const top = t.py[i] + 34;
    const rot = HD(i);
    absatz(gross, mx, mz, 4.2, base, C.betonD);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const leg = (a: number, b: number, r: number, y: number): V3 => [mx + (a * c + b * s) * r, y, mz + (-a * s + b * c) * r];
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const rAt = (y: number): number => 2.3 + (0.55 - 2.3) * ((y - base) / (top - base));
    for (const [a, b] of corners) gross.stab(leg(a, b, 2.3, base), leg(a, b, 0.55, top), 0.3, C.stahl);
    const bays = detail === 0 ? 4 : 8;
    for (let k = 1; k <= bays; k++) {
      const y = base + ((top - base) * k) / bays;
      const yp = base + ((top - base) * (k - 1)) / bays;
      for (let q = 0; q < 4; q++) {
        const [a0, b0] = corners[q];
        const [a1, b1] = corners[(q + 1) % 4];
        gross.stab(leg(a0, b0, rAt(y), y), leg(a1, b1, rAt(y), y), 0.16, C.stahlD);
        if (detail > 0) gross.stab(leg(a0, b0, rAt(yp), yp), leg(a1, b1, rAt(y), y), 0.12, C.stahlD);
      }
    }
    // Antennen und Richtfunkschüsseln
    gross.stab([mx, top, mz], [mx, top + 6, mz], 0.18, C.stahl);
    gross.lage(mx, 0, mz, rot);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU;
      gross.box(Math.cos(a) * 0.9, top - 3 - k * 1.2, Math.sin(a) * 0.9, 0.5, 2.4, 0.9, C.beton, a);
    }
    gross.geo(new THREE.CylinderGeometry(0.9, 0.6, 0.4, 8), C.beton, 1.1, top - 8, 0, 0, 0, Math.PI / 2);
    gross.box(0, base + 1.3, 3.6, 2.4, 2.6, 2.2, C.betonD, 0, C.stahlD);
    gross.frei();
    lampe(mx, top + 6.2, mz, 0.95, L_BLINK, 0, 0xff3a2a);
    for (const f of [0.5, 0.97]) {
      const y = base + (top - base) * f;
      for (const [a, b] of [corners[0], corners[2]]) {
        const p = leg(a, b, rAt(y) + 0.25, y);
        lampe(p[0], p[1], p[2], 0.7, L_BLINK, 0.5 + f, 0xff3a2a);
      }
    }
  }
  {
    // Gipfelkreuz auf einem Felskopf
    const i = S(862);
    const lat = t.wh[i] + 7.5;
    const x = X(i, lat);
    const z = Z(i, lat);
    if (frei(x, z, 2) && platz(x, z, 3)) {
      merke(x, z, 4);
      const g = ground(x, z);
      const top = t.py[i] + 1.6;
      zacke(gross, x, z, g - 3, top, 3.6, 6, rnd() * TAU, false, 0.55);
      const rot = HD(i) + 0.3;
      gross.lage(x, top + 0.6, z, rot);
      gross.box(0, 3.1, 0, 0.42, 6.4, 0.42, C.holzD);
      gross.box(0, 4.5, 0, 3.4, 0.4, 0.42, C.holzD);
      gross.box(0, 6.45, 0, 0.9, 0.2, 0.7, C.dachD);
      gross.frei();
    }
  }
  {
    // Wetterstation: Hütte auf einem Absatz, Mast mit Windmesser (dreht sich) und Fahne
    const i = S(772);
    const lat = t.wh[i] + 7.2;
    const x = X(i, lat);
    const z = Z(i, lat);
    if (frei(x, z, 2.5) && platz(x, z, 3)) {
      merke(x, z, 4);
      const y0 = t.py[i] - 0.6;
      absatz(gross, x, z, 3.2, y0);
      const rot = HD(i);
      gross.lage(x, y0, z, rot);
      gross.box(-0.6, 1.1, 0.6, 1.6, 2.2, 1.6, rgb(0xd9dde4), 0, C.stahlD, false);
      gross.box(1.1, 3.6, -0.6, 0.16, 7.2, 0.16, C.stahl);
      gross.box(1.1, 6.0, -0.6, 1.4, 0.08, 0.08, C.stahl);
      gross.frei();
      klein.lage(x, y0, z, rot);
      klein.box(-0.6, 1.5, -0.24, 0.9, 0.6, 0.1, rgb(0xe8e8e8));
      klein.frei();
      tv.set(-0.6, 0, -0.32).applyAxisAngle(UP, rot);
      lampe(x + tv.x, y0 + 1.5, z + tv.z, 0.3, L_BLINK, 2.2, 0x6aff9a);
      tv.set(1.1, 0, -0.6).applyAxisAngle(UP, rot);
      windmesser = neueLage();
      lagen[windmesser].makeTranslation(x + tv.x, y0 + 7.35, z + tv.z);
      const v0 = dyn.verts;
      dyn.frei();
      dyn.box(0, 0, 0, 0.12, 0.3, 0.12, C.stahl);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU;
        dyn.box(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4, 0.8, 0.05, 0.05, C.stahl, -a);
        dyn.geo(new THREE.ConeGeometry(0.15, 0.26, 6), rgb(0xe8e8e8), Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8, 0, -a, Math.PI / 2);
      }
      dynL.push({ v0, v1: dyn.verts, lage: windmesser });
    }
  }
  {
    // Felszacken und Felstürme beidseits des Grats, Wächten auf der Nordseite
    for (let m = 702; m < 998; m += 12) {
      const i = S(m + rnd() * 5);
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (t.wh[i] + 4.5 + rnd() * 6);
      const x = X(i, lat);
      const z = Z(i, lat);
      const r = 2.2 + rnd() * 1.6;
      if (!frei(x, z, r) || !platz(x, z, r + 1)) continue;
      merke(x, z, r);
      const g = ground(x, z);
      const top = t.py[i] + (rnd() < 0.3 ? 8 + rnd() * 6 : 1.5 + rnd() * 5);
      if (top < g + 3) continue;
      zacke(gross, x, z, g - 4, top, r, 5, rnd() * TAU, rnd() < 0.45);
    }
    // Wächten: überhängende Schneewülste an der Kante zum Nordhang
    for (let m = 730; m < 985; m += 21) {
      const i = S(m);
      const j = S(m + 11);
      const w0 = t.wh[i] + 3.3;
      const w1 = t.wh[j] + 3.3;
      const xa = X(i, -w0);
      const za = Z(i, -w0);
      const xb = X(j, -w1);
      const zb = Z(j, -w1);
      if (!frei(xa, za, 0.4) || !frei(xb, zb, 0.4) || !frei(X(i, -w0 - 4), Z(i, -w0 - 4), 0.4)) continue;
      if (!platz((xa + xb) / 2, (za + zb) / 2, 3)) continue;
      const ya = Math.max(ground(xa, za), t.py[i] - 2) + 0.2;
      const yb = Math.max(ground(xb, zb), t.py[j] - 2) + 0.2;
      const oa: V3 = [X(i, -w0 - 3.6), ya - 1.1, Z(i, -w0 - 3.6)];
      const ob: V3 = [X(j, -w1 - 3.6), yb - 1.1, Z(j, -w1 - 3.6)];
      const ua: V3 = [X(i, -w0 - 1.2), ya - 3, Z(i, -w0 - 1.2)];
      const ub: V3 = [X(j, -w1 - 1.2), yb - 3, Z(j, -w1 - 1.2)];
      const a: V3 = [xa, ya, za];
      const b: V3 = [xb, yb, zb];
      const ref: V3 = [(xa + xb) / 2 + (oa[0] - xa) * 0.3, (ya + yb) / 2 - 1.4, (za + zb) / 2 + (oa[2] - za) * 0.3];
      gross.flaeche(a, b, ob, oa, C.schnee, ref);
      gross.flaeche(oa, ob, ub, ua, C.schneeD, ref);
      gross.dreieck(a, oa, ua, C.schneeD, ref);
      gross.dreieck(b, ob, ub, C.schneeD, ref);
    }
  }

  // ==========================================================================================
  // 6. Lawinengalerie von außen: Betonrippen und Stützen talseitig, warmes Licht aus den Öffnungen
  // ==========================================================================================
  if (br) {
    const step = 8;
    const warm: RGB = [0.13, 0.08, 0.03];
    const schwarz: RGB = [0, 0, 0];
    let nr = 0;
    // talseitig = weg von der Mitte der Strecke
    const iMid = SB(140);
    const out = (t.px[iMid] - cx0) * rightX(t, iMid) + (t.pz[iMid] - cz0) * rightZ(t, iMid) > 0 ? 1 : -1;
    let prev: { roofIn: V3; roofOut: V3; i: number } | null = null;
    for (let m = 64; m <= 212; m += step) {
      const i = SB(m);
      const w = t.wh[i];
      const py = t.py[i];
      const latR = out * (w + 8.8);
      const rx = X(i, latR);
      const rz = Z(i, latR);
      const roofY = py + 9.6;
      const roofIn: V3 = [X(i, out * (w + 2.5)), roofY, Z(i, out * (w + 2.5))];
      const roofOut: V3 = [X(i, out * (w + 9.8)), roofY, Z(i, out * (w + 9.8))];
      if (kante(rx, rz) < 3) {
        prev = null;
        continue;
      }
      const g = ground(rx, rz);
      const hd = HD(i);
      // Rippe: vom Fußbalken bis unters Dach; darunter ein Pfeiler bis auf den Hang und eine Strebe zum Berg
      const fuss = py - 2.6;
      gross.box(rx, (roofY + fuss) / 2, rz, 1.0, roofY - fuss, 1.3, C.beton, hd + Math.PI / 2, C.beton, false);
      if (g < fuss) {
        gross.box(rx, (fuss + g - 1.5) / 2, rz, 0.7, fuss - g + 1.5, 0.9, C.betonD, hd + Math.PI / 2, C.betonD, false);
        const ix = X(i, out * (w + 5.5));
        const iz = Z(i, out * (w + 5.5));
        gross.stab([rx, fuss - 0.3, rz], [ix, ground(ix, iz) - 0.5, iz], 0.5, C.betonD);
      }
      if (prev && prev.i !== i) {
        nr++;
        // Fußbalken zwischen den Rippen
        {
          const pi = prev.i;
          const qa: V3 = [X(pi, out * (t.wh[pi] + 9.3)), t.py[pi] - 2.6, Z(pi, out * (t.wh[pi] + 9.3))];
          const qb: V3 = [X(i, out * (w + 9.3)), fuss, Z(i, out * (w + 9.3))];
          gross.flaeche(qa, qb, [qb[0], qb[1] + 1.3, qb[2]], [qa[0], qa[1] + 1.3, qa[2]], C.betonD, [X(i, out * (w + 2)), py, Z(i, out * (w + 2))]);
        }
        // Dachplatte und Stirnbalken zwischen den Rippen
        const a = prev.roofIn;
        const b = prev.roofOut;
        const c = roofOut;
        const d = roofIn;
        const ref: V3 = [(a[0] + c[0]) / 2, roofY - 5, (a[2] + c[2]) / 2];
        gross.flaeche(a, b, c, d, C.betonD, ref);
        gross.flaeche([b[0], b[1] - 1.1, b[2]], [c[0], c[1] - 1.1, c[2]], c, b, C.beton, [ref[0] - (b[0] - a[0]) * 0.5, roofY, ref[2] - (b[2] - a[2]) * 0.5]);
        // Öffnung: warm leuchtende Fläche zwischen den Rippen, etwas hinter der Stirn
        const pi = prev.i;
        const mA = out * (t.wh[pi] + 8.3);
        const mB = out * (w + 8.3);
        const lo = 1.8;
        const up = 5.9;
        const pa: V3 = [X(pi, mA), t.py[pi] + lo, Z(pi, mA)];
        const pb: V3 = [X(i, mB), py + lo, Z(i, mB)];
        const ia = 0.9;
        const sa: V3 = [pa[0] + (pb[0] - pa[0]) * 0.1, pa[1], pa[2] + (pb[2] - pa[2]) * 0.1];
        const sb: V3 = [pa[0] + (pb[0] - pa[0]) * ia, pb[1], pa[2] + (pb[2] - pa[2]) * ia];
        const refO: V3 = [X(i, out * (w + 2)), py + 3, Z(i, out * (w + 2))];
        glut.flaeche(sa, sb, [sb[0], sb[1] + up - lo, sb[2]], [sa[0], sa[1] + up - lo, sa[2]], nr % 3 === 1 ? G.galerieD : G.galerie, refO);
        // Lichtschein nach draußen: von der Öffnung schräg hinab auf den Hang
        const da: V3 = [X(pi, out * (t.wh[pi] + 15.5)), 0, Z(pi, out * (t.wh[pi] + 15.5))];
        const db: V3 = [X(i, out * (w + 15.5)), 0, Z(i, out * (w + 15.5))];
        da[1] = Math.max(ground(da[0], da[2]) + 0.3, t.py[pi] - 3.5);
        db[1] = Math.max(ground(db[0], db[2]) + 0.3, py - 3.5);
        licht.quadV(sa, sb, db, da, warm, warm, schwarz, schwarz);
      }
      prev = { roofIn, roofOut, i };
    }
  }

  // ==========================================================================================
  // 7. Wetterfichten (Kronen vom Wind verdreht) und Geröll an den Flanken
  // ==========================================================================================
  {
    const want = detail === 0 ? 16 : 34;
    let n = 0;
    for (let k = 0; k < 400 && n < want; k++) {
      const m = 230 + rnd() * 800;
      const i = S(m);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 4 + rnd() * 9);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 1.6) || !platz(x, z, 2)) continue;
      const g = ground(x, z);
      if (g < t.py[i] - 13) continue;
      merke(x, z, 1.8);
      n++;
      const h = 5 + rnd() * 3.5;
      const lean = 0.35 + rnd() * 0.3;
      gross.lage(x, g, z, LEE + (rnd() - 0.5) * 0.5);
      gross.stab([0, -0.5, 0], [0, h * 0.45, -0.1], 0.32, C.stamm);
      gross.stab([0, h * 0.45, -0.1], [0, h * 0.95, lean * 1.6], 0.24, C.stamm);
      for (let tier = 0; tier < 3; tier++) {
        const ty = h * (0.32 + tier * 0.22);
        const r = (1.9 - tier * 0.45) * (0.85 + rnd() * 0.3);
        // Krone flach auf der Luvseite, lang nach Lee gezogen, jede Stufe etwas verdreht
        gross.geo(new THREE.ConeGeometry(r, h * 0.42, 5), tier % 2 ? C.tanneD : C.tanne, 0, ty + h * 0.15, r * 0.5 + tier * lean * 0.6, -0.12 - lean * 0.25, tier * 0.7 + rnd() * 0.4, 0, 0.7, 1, 1.5);
      }
      gross.frei();
    }
    // Geröllfelder: Haufen kantiger Blöcke an den Hängen
    const fields = detail === 0 ? 5 : 11;
    let f = 0;
    for (let k = 0; k < 200 && f < fields; k++) {
      const m = 220 + rnd() * 1000;
      const i = S(m);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 9 + rnd() * 14);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 6) || !platz(x, z, 5)) continue;
      const g = ground(x, z);
      if (g > t.py[i] - 4) continue;
      merke(x, z, 5);
      f++;
      for (let b = 0; b < (detail === 0 ? 4 : 7); b++) {
        const bx = x + (rnd() - 0.5) * 9;
        const bz = z + (rnd() - 0.5) * 9;
        const s = 0.6 + rnd() * 1.3;
        klein.geo(new THREE.IcosahedronGeometry(1, 0), b % 3 ? C.fels : C.felsH, bx, ground(bx, bz) + s * 0.3, bz, rnd() * 3, rnd() * 3, rnd() * 3, s * 1.3, s * 0.8, s);
      }
    }
  }

  // ==========================================================================================
  // 8. Bergwald: Felsblöcke, umgestürzte Stämme, Lagerfeuer mit Zelten, Wildgatter, Augen, Glühwürmchen
  // ==========================================================================================
  let feuer: V3 = [0, -999, 0];
  {
    // Lagerfeuer auf einem Absatz am Waldrand, zwei Zelte, die von innen leuchten, drei Gestalten
    for (let tries = 0, m = 1157; tries < 10 && feuer[1] < -900; tries++, m += 7) {
      const i = S(m);
      const side = tries % 2 ? -1 : 1;
      const lat = side * (t.wh[i] + 8.5);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 5) || !platz(x, z, 6)) continue;
      merke(x, z, 7);
      const y = t.py[i] - 0.9;
      absatz(klein, x, z, 6.2, y, rgb(0x3e4636));
      // Feuerstelle: Steinkranz, Scheite, Flammen (leuchtend)
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        klein.geo(new THREE.IcosahedronGeometry(0.28, 0), C.stein, x + Math.cos(a) * 0.9, y + 0.12, z + Math.sin(a) * 0.9);
      }
      for (let k = 0; k < 4; k++) klein.box(x, y + 0.15, z, 1.5, 0.18, 0.18, C.holzD, (k / 4) * Math.PI);
      glut.geo(new THREE.ConeGeometry(0.5, 1.2, 5), G.glut, x, y + 0.75, z);
      glut.geo(new THREE.ConeGeometry(0.28, 0.9, 4), G.glutH, x + 0.1, y + 0.7, z - 0.05, 0, 0.6, 0);
      lampe(x, y + 0.8, z, 2.0, L_FEUER, 0, 0xe0702a);
      lampe(x, y + 0.6, z, 0.9, L_FEUER, 2, 0xffd070);
      pfuetze(x, y + 0.05, z, 6.0, [0.36, 0.17, 0.05], 12);
      feuer = [x, y + 0.9, z];
      // Zelte (von innen beleuchtet: warm leuchtender Stoff)
      const hd = HD(i);
      for (const [a, b, c] of [
        [side * -2.8, -2.6, 0],
        [side * -2.2, 3.0, 1],
      ]) {
        const tx = x + Math.cos(hd) * a + Math.sin(hd) * b;
        const tz = z - Math.sin(hd) * a + Math.cos(hd) * b;
        glut.lage(tx, y, tz, hd + 0.4 * (c ? 1 : -1));
        const col = c ? G.zeltB : G.zeltA;
        const ref: V3 = [0, 0.5, 0];
        glut.flaeche([-1.2, 0, -1.4], [-1.2, 0, 1.4], [0, 1.5, 1.4], [0, 1.5, -1.4], col, ref);
        glut.flaeche([1.2, 0, -1.4], [1.2, 0, 1.4], [0, 1.5, 1.4], [0, 1.5, -1.4], col, ref);
        glut.dreieck([-1.2, 0, -1.4], [1.2, 0, -1.4], [0, 1.5, -1.4], col, ref);
        glut.dreieck([-1.2, 0, 1.4], [1.2, 0, 1.4], [0, 1.5, 1.4], G.glutH, ref);
        glut.frei();
      }
      // Zeltende am Feuer (sitzend)
      for (let k = 0; k < 3; k++) {
        const a = 0.6 + k * 1.9;
        const px = x + Math.cos(a) * 1.9;
        const pz = z + Math.sin(a) * 1.9;
        klein.lage(px, y, pz, Math.atan2(x - px, z - pz));
        klein.box(0, 0.25, 0, 0.5, 0.5, 0.6, C.dunkel);
        klein.box(0, 0.75, -0.1, 0.48, 0.65, 0.34, [rgb(0x5a4a6a), rgb(0x3f5a4a), rgb(0x6a4a3a)][k]);
        klein.geo(new THREE.IcosahedronGeometry(0.19, 0), C.haut, 0, 1.25, -0.06);
        klein.frei();
      }
      klein.box(x + 1.6, y + 0.2, z - 1.4, 1.6, 0.4, 0.45, C.holz, 0.8);
    }
    // Felsblöcke und umgestürzte Stämme
    let blocks = 0;
    for (let k = 0; k < 120 && blocks < (detail === 0 ? 7 : 14); k++) {
      const i = S(1005 + rnd() * 250);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 4 + rnd() * 9);
      const x = X(i, lat);
      const z = Z(i, lat);
      const s = 1.2 + rnd() * 1.8;
      if (!frei(x, z, s) || !platz(x, z, s)) continue;
      merke(x, z, s);
      blocks++;
      gross.geo(new THREE.IcosahedronGeometry(1, 0), blocks % 2 ? C.fels : C.felsH, x, ground(x, z) + s * 0.25, z, rnd() * 3, rnd() * 3, rnd() * 3, s * 1.3, s * 0.85, s * 1.1);
    }
    let logs = 0;
    for (let k = 0; k < 80 && logs < (detail === 0 ? 2 : 5); k++) {
      const i = S(1010 + rnd() * 235);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 5 + rnd() * 6);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 4.5) || !platz(x, z, 4.5)) continue;
      merke(x, z, 4.5);
      logs++;
      const yaw = HD(i) + Math.PI / 2 + (rnd() - 0.5) * 0.8;
      const ex = x + Math.sin(yaw) * 4;
      const ez = z + Math.cos(yaw) * 4;
      const sx = x - Math.sin(yaw) * 4;
      const sz = z - Math.cos(yaw) * 4;
      gross.stab([sx, ground(sx, sz) + 0.4, sz], [ex, ground(ex, ez) + 0.4, ez], 0.75, C.stamm);
      gross.lage(sx, ground(sx, sz) + 0.9, sz, yaw);
      gross.geo(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 7), rgb(0x3a2e24), 0, 0, 0, Math.PI / 2, 0, 0);
      gross.frei();
    }
    // Wildgatter: Holzpfosten, Latten, ein Tor mit Strebe
    {
      const m0 = 1078;
      const lat0 = -1;
      let ok = true;
      for (let m = m0; m <= m0 + 22 && ok; m += 2.75) {
        const i = S(m);
        ok = frei(X(i, lat0 * (t.wh[i] + 4.6)), Z(i, lat0 * (t.wh[i] + 4.6)), 0.3);
      }
      if (ok) {
        let pp: V3 | null = null;
        for (let k = 0, m = m0; m <= m0 + 22; m += 2.75, k++) {
          const i = S(m);
          const lat = lat0 * (t.wh[i] + 4.6);
          const x = X(i, lat);
          const z = Z(i, lat);
          const g = ground(x, z);
          klein.box(x, g + 0.9, z, 0.22, 2.3, 0.22, C.holzD);
          const p: V3 = [x, g, z];
          if (pp) {
            const gate = k === 4;
            for (const hy of [0.55, 1.2, 1.85]) klein.stab([pp[0], pp[1] + hy, pp[2]], [p[0], p[1] + hy, p[2]], 0.1, gate ? C.holzH : C.holz);
            if (gate) klein.stab([pp[0], pp[1] + 0.55, pp[2]], [p[0], p[1] + 1.85, p[2]], 0.12, C.holzH);
          }
          pp = p;
        }
      }
    }
    // Augenpaare im Dunkeln: Fuchs am Boden, Eule auf einem kahlen Baum
    const augen: [number, number, number, number][] = [
      [1066, 1, 0.45, 0x9aff6a],
      [1190, -1, 0.42, 0xc8ff7a],
      [1124, -1, 3.4, 0xffc040],
      [1232, 1, 3.1, 0xffb030],
    ];
    for (const [m, side, hy, color] of augen) {
      const i = S(m);
      const lat = side * (t.wh[i] + 6.5);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 0.5)) continue;
      const g = ground(x, z);
      if (hy > 2) {
        // kahler Baum mit Ast, auf dem die Eule sitzt
        klein.stab([x + 0.4, g - 0.5, z], [x + 0.4, g + hy + 1.8, z], 0.35, C.stamm);
        klein.stab([x + 0.4, g + hy - 0.4, z], [x - 0.9, g + hy + 0.2, z + 0.4], 0.16, C.stamm);
        klein.geo(new THREE.IcosahedronGeometry(0.32, 0), rgb(0x4a3e34), x - 0.15, g + hy - 0.05, z + 0.15, 0, 0, 0, 1, 1.3, 1);
      }
      // die Augen schauen zur Bahn
      const ex = -rightZ(t, i) * 0.07;
      const ez = rightX(t, i) * 0.07;
      const y = g + hy + (hy > 2 ? 0.08 : 0);
      const ph = rnd() * 10;
      lampe(x + ex - side * rightX(t, i) * 0.3, y, z + ez - side * rightZ(t, i) * 0.3, 0.16, L_AUGE, ph, color);
      lampe(x - ex - side * rightX(t, i) * 0.3, y, z - ez - side * rightZ(t, i) * 0.3, 0.16, L_AUGE, ph, color);
    }
    // Glühwürmchen
    const nf = detail === 0 ? 12 : 28;
    for (let k = 0, n = 0; k < 200 && n < nf; k++) {
      const i = S(1010 + rnd() * 240);
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 3.5 + rnd() * 5);
      const x = X(i, lat);
      const z = Z(i, lat);
      if (!frei(x, z, 0.4)) continue;
      n++;
      lampe(x, ground(x, z) + 0.7 + rnd() * 1.6, z, 0.22, L_FLIEGE, rnd() * TAU, rnd() < 0.7 ? 0xc8ff5a : 0xf0ff8a);
    }
  }

  // ==========================================================================================
  // 9. Klamm (unter dem Sprung) mit Wildbach, Stolleneingang mit Holzverbau und Grubenlampe
  // ==========================================================================================
  {
    const i = S(1275);
    const rx = rightX(t, i);
    const rz = rightZ(t, i);
    const ax = t.tx[i];
    const az = t.tz[i];
    const px = t.px[i];
    const pz = t.pz[i];
    const bach = (l: number, a: number): V3 => {
      const x = px + rx * l + ax * a;
      const z = pz + rz * l + az * a;
      return [x, ground(x, z) + 0.15, z];
    };
    // Wildbach: dunkles Wasser mit Schaumbändern, quer unter der Lücke hindurch, beidseits hinab
    const N = detail === 0 ? 14 : 26;
    for (let k = 0; k < N; k++) {
      const l0 = -64 + (128 * k) / N;
      const l1 = -64 + (128 * (k + 1)) / N;
      const w0 = 2.2 + Math.sin(k * 1.7) * 0.6;
      const w1 = 2.2 + Math.sin((k + 1) * 1.7) * 0.6;
      const a = bach(l0, -w0);
      const b = bach(l1, -w1);
      const c = bach(l1, w1);
      const d = bach(l0, w0);
      const ref: V3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - 5, (a[2] + c[2]) / 2];
      klein.flaeche(a, b, c, d, k % 3 === 0 ? C.wasser : k % 3 === 1 ? C.gischt : C.gischtD, ref);
      // Schaumkronen an Stufen
      if (k % 2 === 0) {
        const s = bach((l0 + l1) / 2, 0);
        klein.geo(new THREE.IcosahedronGeometry(0.7, 0), C.gischt, s[0], s[1] + 0.2, s[2], k, 0, 0, 1.6, 0.5, 1.2);
      }
    }
    // Klammwände: Felsrippen beidseits des Bachs, bis über die Bahnhöhe hinauf
    for (const side of [-1, 1]) {
      for (let l = t.wh[i] + 5; l < 62; l += 5.5) {
        for (const a of [-1, 1]) {
          const x = px + rx * side * l + ax * a * (6.4 + rnd() * 1.5);
          const z = pz + rz * side * l + az * a * (6.4 + rnd() * 1.5);
          if (!frei(x, z, 1.8)) continue;
          const g = ground(x, z);
          const top = Math.max(g + 4, t.py[i] - (l - t.wh[i]) * 0.35 + 3 + rnd() * 3);
          zacke(gross, x, z, g - 5, top, 2.6, 5, rnd() * TAU, false, 0.45);
        }
      }
    }
  }
  {
    // Stolleneingang: zwei Stempel und eine Kappe (über 10 m), Verzug aus Brettern, Grubenlampe, Lore
    const i = S(1307);
    const hd = HD(i);
    const py = t.py[i];
    const w = t.wh[i] + 3.4;
    const ok = kante(X(i, w), Z(i, w)) >= 3 && kante(X(i, -w), Z(i, -w)) >= 3;
    if (ok) {
      gross.lage(t.px[i], 0, t.pz[i], hd);
      for (const s of [-1, 1]) {
        const lx = -s * w; // lokal +x = links (lat < 0)
        const g = ground(X(i, s * w), Z(i, s * w));
        gross.box(lx, (py + 11 + g - 1) / 2, 0, 0.75, py + 11 - g + 1, 0.75, C.holzD);
        // Verzug: Bretter gegen den Fels
        for (let k = 0; k < (detail === 0 ? 2 : 4); k++) gross.box(lx - s * (0.9 + k * 0.95), py + 3.6, 0.55, 0.85, 8.4 - k * 1.3, 0.16, k % 2 ? C.holz : C.holzH);
        // Kopfband zur Kappe
        gross.stab([lx, py + 7.6, 0], [lx + s * 2.0, py + 10.6, 0], 0.4, C.holzD);
      }
      gross.box(0, py + 10.85, 0, 2 * w + 1.6, 0.7, 0.8, C.holz);
      gross.frei();
      // Grubenlampe am rechten Stempel (Ausleger zur Bahn)
      const lx = X(i, w - 0.9);
      const lz = Z(i, w - 0.9);
      klein.stab([X(i, w), py + 5, Z(i, w)], [lx, py + 5, lz], 0.12, C.stahlD);
      klein.box(lx, py + 4.65, lz, 0.3, 0.4, 0.3, C.dunkel);
      glut.box(lx, py + 4.5, lz, 0.2, 0.22, 0.2, G.fensterH);
      lampe(lx, py + 4.45, lz, 1.0, L_FEUER, 4, 0xffb050);
      pfuetze(X(i, w - 1.2), py + 0.1, Z(i, w - 1.2), 3.4, [0.4, 0.25, 0.08], 8);
      // Lore auf kurzem Gleis, auf einem Absatz neben dem Eingang
      const j = S(1299);
      const ll = -(t.wh[j] + 6.2);
      const qx = X(j, ll);
      const qz = Z(j, ll);
      if (frei(qx, qz, 2.6) && platz(qx, qz, 3)) {
        merke(qx, qz, 3);
        const y = t.py[j] - 0.5;
        absatz(klein, qx, qz, 3.4, y, rgb(0x4a4438));
        klein.lage(qx, y, qz, HD(j));
        for (const s of [-0.5, 0.5]) klein.box(s, 0.06, 0, 0.1, 0.12, 5.6, C.stahlD);
        for (let k = -2; k <= 2; k++) klein.box(0, 0.02, k * 1.2, 1.5, 0.08, 0.25, C.holzD);
        klein.box(0, 0.75, 0.3, 1.3, 0.9, 1.7, rgb(0x6a4a32), 0, rgb(0x2a2420));
        for (const [a, b] of [
          [-0.55, -0.3],
          [0.55, -0.3],
          [-0.55, 0.9],
          [0.55, 0.9],
        ])
          klein.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 6), C.stahlD, a, 0.25, b, 0, 0, Math.PI / 2);
        klein.frei();
      }
    }
  }

  // ==========================================================================================
  // 10. Tief im Tal: Dorf mit Kirche, Staumauer mit Stausee, Bahnlinie mit Zug
  // ==========================================================================================
  {
    // Dorf im Süden, unterhalb des Plateaus
    const DX = -34;
    const DZ = -326;
    const nh = detail === 0 ? 8 : 15;
    for (let k = 0, n = 0; k < 200 && n < nh; k++) {
      const a = rnd() * TAU;
      const d = 8 + Math.sqrt(rnd()) * 52;
      const x = DX + Math.cos(a) * d;
      const z = DZ + Math.sin(a) * d * 0.45;
      if (world.clearance(x, z) < 30 || !platz(x, z, 6)) continue;
      merke(x, z, 6);
      n++;
      const g = ground(x, z);
      const rot = rnd() * TAU;
      const sx = 5 + rnd() * 2;
      const sz = 6 + rnd() * 3;
      const h = 3.6 + rnd() * 1.6;
      gross.lage(x, g, z, rot);
      gross.box(0, (h - 3) / 2, 0, sx, h + 3, sz, n % 3 ? C.putz : C.wand, 0, C.putz, false);
      gross.flaeche([-sx / 2 - 0.5, h - 0.2, -sz / 2 - 0.4], [-sx / 2 - 0.5, h - 0.2, sz / 2 + 0.4], [0, h + 2.4, sz / 2 + 0.4], [0, h + 2.4, -sz / 2 - 0.4], C.dach, [0, h - 2, 0]);
      gross.flaeche([sx / 2 + 0.5, h - 0.2, -sz / 2 - 0.4], [sx / 2 + 0.5, h - 0.2, sz / 2 + 0.4], [0, h + 2.4, sz / 2 + 0.4], [0, h + 2.4, -sz / 2 - 0.4], C.dachD, [0, h - 2, 0]);
      for (const s of [-1, 1]) gross.dreieck([-sx / 2, h, s * sz / 2], [sx / 2, h, s * sz / 2], [0, h + 2.3, s * sz / 2], C.putz, [0, h, 0]);
      gross.frei();
      glut.lage(x, g, z, rot);
      const nw = 1 + Math.floor(rnd() * 3);
      for (let w = 0; w < nw; w++) {
        // das erste Fenster auf der Seite zum Kamm hin
        let side = Math.floor(rnd() * 4);
        if (w === 0) {
          const dx = cx0 - x;
          const dz = cz0 - z;
          const c = Math.cos(rot);
          const sn = Math.sin(rot);
          const dots = [-c * dx + sn * dz, c * dx - sn * dz, sn * dx + c * dz, -sn * dx - c * dz];
          side = dots.indexOf(Math.max(...dots));
        }
        const off = (rnd() - 0.5) * 0.5;
        const wy = 1.4 + (rnd() < 0.3 ? 2 : 0);
        const lx = side < 2 ? (side ? 1 : -1) * (sx / 2 + 0.05) : off * sx;
        const lz = side < 2 ? off * sz : (side === 2 ? 1 : -1) * (sz / 2 + 0.05);
        glut.box(lx, wy, lz, side < 2 ? 0.1 : 1.0, 1.0, side < 2 ? 1.0 : 0.1, w % 2 ? G.fensterH : G.fenster);
        // ein weicher Schein vor dem ersten Fenster: von weit oben ist das Dorf ein Lichterhaufen
        if (w === 0) {
          const ex = lx + (side < 2 ? (side ? 0.7 : -0.7) : 0);
          const ez = lz + (side < 2 ? 0 : side === 2 ? 0.7 : -0.7);
          lampe(x + Math.cos(rot) * ex + Math.sin(rot) * ez, g + wy, z - Math.sin(rot) * ex + Math.cos(rot) * ez, 1.4, L_STETIG, 0, n % 2 ? 0xd88a40 : 0xc07a3a);
        }
      }
      glut.frei();
      if (n % 3 === 0) {
        const ex = sx / 2 + 1.5;
        const ez = sz / 2 + 1.5;
        lampe(x + Math.cos(rot) * ex + Math.sin(rot) * ez, g + 4.5, z - Math.sin(rot) * ex + Math.cos(rot) * ez, 1.6, L_STETIG, 0, 0xffc070);
      }
    }
    // Kirche mit spitzem Turm
    {
      const x = DX + 4;
      const z = DZ - 2;
      const g = ground(x, z);
      gross.lage(x, g, z, 0.3);
      gross.box(0, 2, 0, 7, 9, 14, C.putz, 0, C.putz, false);
      gross.flaeche([-4, 6.4, -7.2], [-4, 6.4, 7.2], [0, 10, 7.2], [0, 10, -7.2], C.dach, [0, 4, 0]);
      gross.flaeche([4, 6.4, -7.2], [4, 6.4, 7.2], [0, 10, 7.2], [0, 10, -7.2], C.dachD, [0, 4, 0]);
      gross.box(0, 7, 8.5, 3.6, 19, 3.6, C.putz, 0, C.putz, false);
      gross.geo(new THREE.ConeGeometry(2.7, 8, 4), C.dachD, 0, 20.5, 8.5, 0, Math.PI / 4, 0);
      gross.frei();
      glut.lage(x, g, z, 0.3);
      glut.box(0, 13, 10.34, 1.4, 1.4, 0.1, G.fensterH);
      glut.box(3.54, 3.4, -2, 0.1, 2.6, 1.0, G.fenster);
      glut.box(3.54, 3.4, 2, 0.1, 2.6, 1.0, G.fenster);
      glut.frei();
    }
    // Staumauer: gekrümmte Bogenmauer, dahinter der Stausee (über die Flanken hinab gefasst)
    {
      const nx = 99 - SEE_X;
      const nz = -198 - SEE_Z;
      const nl = Math.hypot(nx, nz);
      const ux = nx / nl; // zum Kamm hin (talwärts)
      const uz = nz / nl;
      const R = 130;
      const ccx = SEE_X + ux * R;
      const ccz = SEE_Z + uz * R;
      const crest = -6;
      const n = detail === 0 ? 8 : 14;
      const span = 0.42;
      const ptOn = (a: number, r: number): [number, number] => {
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // um den Mittelpunkt (talwärts) gedreht: -u ist die Mitte der Mauer
        const dx = -ux * ca + uz * sa;
        const dz = -uz * ca - ux * sa;
        return [ccx + dx * r, ccz + dz * r];
      };
      const ref: V3 = [ccx, crest - 10, ccz];
      for (let k = 0; k < n; k++) {
        const a0 = -span + (2 * span * k) / n;
        const a1 = -span + (2 * span * (k + 1)) / n;
        const [x0, z0] = ptOn(a0, R);
        const [x1, z1] = ptOn(a1, R);
        const [y0, w0] = ptOn(a0, R - 1.6);
        const [y1, w1] = ptOn(a1, R - 1.6);
        const [f0, h0] = ptOn(a0, R - 8);
        const [f1, h1] = ptOn(a1, R - 8);
        const [r0x, r0z] = ptOn((a0 + a1) / 2, R + 6);
        const [o0, p0] = ptOn(a0, R + 8);
        const [o1, p1] = ptOn(a1, R + 8);
        const g0 = Math.min(ground(x0, z0), ground(y0, w0)) - 3;
        const g1 = Math.min(ground(x1, z1), ground(y1, w1)) - 3;
        // Luftseite (zum Kamm, schräg), Krone, Wasserseite
        gross.flaeche([f0, Math.min(g0, ground(f0, h0) - 3), h0], [f1, Math.min(g1, ground(f1, h1) - 3), h1], [y1, crest, w1], [y0, crest, w0], k % 2 ? C.beton : rgb(0x9499a3), [r0x, crest - 6, r0z]);
        gross.flaeche([y0, crest, w0], [y1, crest, w1], [x1, crest, z1], [x0, crest, z0], C.betonD, ref);
        gross.flaeche([x0, crest, z0], [x1, crest, z1], [x1, g1, z1], [x0, g1, z0], C.betonD, [ccx, crest - 10, ccz]);
        // Seefläche hinter der Mauer, bis zu den Talflanken
        gross.flaeche([x0, crest - 1.2, z0], [x1, crest - 1.2, z1], [o1, crest - 1.2, p1], [o0, crest - 1.2, p0], C.wasser, [x0, crest - 20, z0]);
        if (k % 3 === 1) lampe(y0, crest + 1.6, w0, 1.5, L_STETIG, 0, 0xffe2b0);
        if (k % 3 === 1) gross.box(y0, crest + 0.8, w0, 0.14, 1.6, 0.14, C.stahlD);
      }
      // Stausee: Fläche, deren Rand als Böschung zum Talgrund abfällt
      const lx = SEE_X - ux * 76;
      const lz = SEE_Z - uz * 76;
      const LR = 66;
      const m = detail === 0 ? 10 : 16;
      const ly = crest - 1.2;
      for (let k = 0; k < m; k++) {
        const a0 = (k / m) * TAU;
        const a1 = ((k + 1) / m) * TAU;
        const r0 = LR * (0.85 + 0.25 * Math.sin(k * 2.3));
        const r1 = LR * (0.85 + 0.25 * Math.sin((k + 1) * 2.3));
        const p0: V3 = [lx + Math.cos(a0) * r0, ly, lz + Math.sin(a0) * r0];
        const p1: V3 = [lx + Math.cos(a1) * r1, ly, lz + Math.sin(a1) * r1];
        gross.dreieck([lx, ly, lz], p0, p1, k % 2 ? C.wasser : rgb(0x2a3e56), [lx, ly - 10, lz]);
        const q0: V3 = [lx + Math.cos(a0) * (r0 + 26), 0, lz + Math.sin(a0) * (r0 + 26)];
        const q1: V3 = [lx + Math.cos(a1) * (r1 + 26), 0, lz + Math.sin(a1) * (r1 + 26)];
        q0[1] = ground(q0[0], q0[2]) - 2;
        q1[1] = ground(q1[0], q1[2]) - 2;
        // zur Mauer hin keine Böschung: dort hält die Mauer das Wasser
        const am = (a0 + a1) / 2;
        if (Math.cos(am) * ux + Math.sin(am) * uz > 0.55) continue;
        gross.flaeche([p0[0], ly + 0.6, p0[2]], [p1[0], ly + 0.6, p1[2]], q1, q0, k % 2 ? C.fels : C.felsD, [lx, ly - 30, lz]);
      }
      // Wärterhaus an der Mauerkrone
      const [hx2, hz2] = ptOn(span + 0.04, R - 2);
      gross.box(hx2, crest + 1.6, hz2, 4, 3.2, 4, C.putz, 0, C.dachD);
      glut.box(hx2 + ux * 2.04, crest + 1.8, hz2 + uz * 2.04, 1.0, 0.9, 1.0, G.fenster);
    }
  }
  // Bahnlinie im Tal: Gleisband, Portale an beiden Enden, ein Zug mit Lichterkette
  const zug = { pts: [] as number[], len: [] as number[], total: 0, wagen: [] as number[] };
  {
    const P: [number, number][] = [
      [-352, -292],
      [-250, -288],
      [-110, -282],
      [30, -286],
      [140, -280],
      [212, -258],
      [262, -190],
      [276, -60],
      [272, 80],
      [262, 230],
    ];
    // nur Stützpunkte weit genug von der Strecke
    const pts: number[] = [];
    for (const [x, z] of P) if (world.clearance(x, z) > 25) pts.push(x, z);
    let total = 0;
    const len = [0];
    for (let k = 2; k < pts.length; k += 2) {
      total += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
      len.push(total);
    }
    zug.pts = pts;
    zug.len = len;
    zug.total = total;
    // Gleisband (dunkler Schotter) und Portale an den Enden
    const n = pts.length / 2;
    for (let k = 0; k + 1 < n; k++) {
      const x0 = pts[k * 2];
      const z0 = pts[k * 2 + 1];
      const x1 = pts[k * 2 + 2];
      const z1 = pts[k * 2 + 3];
      const d = Math.hypot(x1 - x0, z1 - z0);
      const sx = -(z1 - z0) / d;
      const sz = (x1 - x0) / d;
      const parts = Math.max(1, Math.round(d / (detail === 0 ? 30 : 15)));
      for (let p = 0; p < parts; p++) {
        const fa = p / parts;
        const fb = (p + 1) / parts;
        const ax = x0 + (x1 - x0) * fa;
        const az = z0 + (z1 - z0) * fa;
        const bx = x0 + (x1 - x0) * fb;
        const bz = z0 + (z1 - z0) * fb;
        const ya = ground(ax, az) + 0.35;
        const yb = ground(bx, bz) + 0.35;
        klein.quad([ax - sx * 2, ya, az - sz * 2], [ax + sx * 2, ya, az + sz * 2], [bx + sx * 2, yb, bz + sz * 2], [bx - sx * 2, yb, bz - sz * 2], rgb(0x2b2e36));
        klein.quad([ax - sx * 2, ya, az - sz * 2], [bx - sx * 2, yb, bz - sz * 2], [bx + sx * 2, yb, bz + sz * 2], [ax + sx * 2, ya, az + sz * 2], rgb(0x2b2e36));
      }
    }
    for (const end of [0, n - 1]) {
      const x = pts[end * 2];
      const z = pts[end * 2 + 1];
      const o = end === 0 ? 1 : end - 1;
      const dx = pts[o * 2] - x;
      const dz = pts[o * 2 + 1] - z;
      const rot = Math.atan2(dx, dz);
      const g = ground(x, z);
      // Berg, in den der Zug fährt, mit dunklem Portal (der Zug verschwindet darin)
      zacke(gross, x - Math.sin(rot) * 22, z - Math.cos(rot) * 22, g - 6, g + 40, 26, 7, rot, true, 0.25);
      gross.lage(x, g, z, rot);
      gross.box(0, 4, 2, 9, 9, 3, C.betonD);
      klein.lage(x, g, z, rot);
      klein.box(0, 2.6, 3.56, 5.4, 5.2, 0.1, C.dunkel);
      klein.frei();
      gross.frei();
    }
    // Zug: Lok und Wagen (bewegt), Fenster als Lichterkette
    const nw = detail === 0 ? 3 : 5;
    for (let w = 0; w < nw; w++) {
      const lage = neueLage();
      zug.wagen.push(lage);
      const v0 = dyn.verts;
      dyn.frei();
      const lok = w === 0;
      dyn.box(0, 2.1, 0, 2.9, 3.4, lok ? 9 : 11.5, lok ? rgb(0x8a2f2a) : rgb(0x3a5a4a), 0, C.stahlD);
      dyn.box(0, 0.4, 0, 2.4, 0.8, lok ? 8 : 10.5, C.dunkel);
      dynL.push({ v0, v1: dyn.verts, lage });
      const g0 = glut.verts;
      glut.frei();
      if (lok) {
        glut.box(0, 3.0, 4.52, 2.0, 0.8, 0.06, G.fensterH);
      } else {
        for (const s of [-1, 1]) for (let k = 0; k < 5; k++) glut.box(s * 1.47, 2.5, -4.4 + k * 2.2, 0.06, 0.9, 1.4, k % 2 ? G.fenster : G.fensterH);
      }
      glutL.push({ v0: g0, v1: glut.verts, lage });
      if (lok) {
        lampe(0, 1.6, 4.6, 1.3, L_STETIG, 0, 0xfff4d8, lage);
        lampe(0, 4.0, 4.4, 0.7, L_STETIG, 0, 0xfff4d8, lage);
      }
    }
  }

  // ==========================================================================================
  // Netze zusammenstellen
  // ==========================================================================================
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const add = (b: Bau, outline: number): THREE.Mesh | null => {
    if (b.verts === 0) return null;
    const geo = b.build();
    const mesh = new THREE.Mesh(geo, toon);
    group.add(mesh);
    disposables.push(geo);
    if (outline > 0 && lines) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      ol.matrixAutoUpdate = false;
      mesh.add(ol);
    }
    return mesh;
  };
  add(gross, 0.055);
  if (klein !== gross) add(klein, 0);

  // Leuchtflächen (ohne Dunst: sie scheinen durch die Nacht); die Fenster von Gondel und Zug bewegen sich.
  const glutGeo = glut.build();
  const glutPos = glutGeo.getAttribute('position') as THREE.BufferAttribute;
  glutPos.setUsage(THREE.DynamicDrawUsage);
  const glutBase = Float32Array.from(glutPos.array as Float32Array);
  const glutMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const glutMesh = new THREE.Mesh(glutGeo, glutMat);
  glutMesh.frustumCulled = false;
  group.add(glutMesh);
  disposables.push(glutGeo, glutMat);

  // Nebelfetzen: flache, schwach leuchtende Schwaden, die quer über die Bahn treiben (nicht bei niedriger
  // Qualität). Sie stecken im Netz des gemalten Lichts und werden je Bild an ihren Platz gerückt.
  const NF = detail === 0 ? 0 : hi ? 14 : 9;
  const nebelSeg = new Int32Array(NF);
  const nebelPh = new Float32Array(NF);
  const nebelL: Lauf[] = [];
  {
    const n = 12;
    const c0 = rgb(0x3a4456);
    const black: RGB = [0, 0, 0];
    for (let k = 0; k < NF; k++) {
      const lage = neueLage();
      lagen[lage].makeScale(0, 0, 0);
      const v0 = licht.verts;
      licht.frei();
      for (let j = 0; j < n; j++) {
        const a0 = (j / n) * TAU;
        const a1 = ((j + 1) / n) * TAU;
        const r0 = 1 + 0.2 * Math.sin(j * 2.1 + k);
        const r1 = 1 + 0.2 * Math.sin((j + 1) * 2.1 + k);
        licht.triV([0, 0, 0], [Math.cos(a1) * r1, 0, Math.sin(a1) * r1], [Math.cos(a0) * r0, 0, Math.sin(a0) * r0], c0, black, black);
      }
      nebelL.push({ v0, v1: licht.verts, lage });
      // über Kehren, Grat und Wald verteilt
      nebelSeg[k] = S(300 + ((k + 0.5) / NF) * 920 + (rnd() - 0.5) * 30);
      nebelPh[k] = rnd();
    }
  }

  // Gemaltes Licht (additiv), dazu die Nebelfetzen
  const lichtGeo = licht.build();
  const lichtPos = lichtGeo.getAttribute('position') as THREE.BufferAttribute;
  const lichtCol = lichtGeo.getAttribute('color') as THREE.BufferAttribute;
  lichtPos.setUsage(THREE.DynamicDrawUsage);
  lichtCol.setUsage(THREE.DynamicDrawUsage);
  const lichtBase = Float32Array.from(lichtPos.array as Float32Array);
  const lichtColBase = Float32Array.from(lichtCol.array as Float32Array);
  {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(lichtGeo, m);
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(lichtGeo, m);
  }

  // Bewegtes (Gondel, Windmesser, Zug): ein Netz, Ecken je Bild aus der Grundform.
  const dynGeo = dyn.build();
  const dPos = dynGeo.getAttribute('position') as THREE.BufferAttribute;
  const dNor = dynGeo.getAttribute('normal') as THREE.BufferAttribute;
  dPos.setUsage(THREE.DynamicDrawUsage);
  dNor.setUsage(THREE.DynamicDrawUsage);
  const basePos = Float32Array.from(dPos.array as Float32Array);
  const baseNor = Float32Array.from(dNor.array as Float32Array);
  let baseON: Float32Array | null = null;
  let dON: THREE.BufferAttribute | null = null;
  const dynMesh = new THREE.Mesh(dynGeo, toon);
  dynMesh.frustumCulled = false;
  group.add(dynMesh);
  disposables.push(dynGeo);
  if (lines && dPos.count > 0) {
    baseON = glatteNormalen(basePos, baseNor, dynL);
    dON = new THREE.BufferAttribute(Float32Array.from(baseON), 3);
    dON.setUsage(THREE.DynamicDrawUsage);
    dynGeo.setAttribute('onormal', dON);
    const ol = new THREE.Mesh(dynGeo, outlineMaterial(0.045));
    ol.name = 'outline';
    ol.frustumCulled = false;
    ol.matrixAutoUpdate = false;
    dynMesh.add(ol);
  }

  // Lampen: weiche, zur Kamera gedrehte Lichtscheiben (additiv) – heller Kern, Hof nach außen
  const NL = lampen.length / 8;
  const lampGeo = (() => {
    const n = 8;
    const pos: number[] = [];
    const col: number[] = [];
    const ring = (r: number, k: number): [number, number] => [Math.cos((k / n) * TAU) * r, Math.sin((k / n) * TAU) * r];
    for (let k = 0; k < n; k++) {
      const [a0, b0] = ring(0.22, k);
      const [a1, b1] = ring(0.22, k + 1);
      const [c0, d0] = ring(1, k);
      const [c1, d1] = ring(1, k + 1);
      pos.push(0, 0, 0, a0, b0, 0, a1, b1, 0);
      col.push(1, 1, 1, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75);
      pos.push(a0, b0, 0, c0, d0, 0, c1, d1, 0, a0, b0, 0, c1, d1, 0, a1, b1, 0);
      col.push(0.75, 0.75, 0.75, 0, 0, 0, 0, 0, 0, 0.75, 0.75, 0.75, 0, 0, 0, 0.75, 0.75, 0.75);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  })();
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, Math.max(1, NL));
  lamps.count = NL;
  lamps.frustumCulled = false;
  lamps.renderOrder = 6;
  lamps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const col = new THREE.Color();
    for (let k = 0; k < NL; k++) lamps.setColorAt(k, col.set(lampen[k * 8 + 6]));
  }
  group.add(lamps);
  disposables.push(lampGeo, lampMat, lamps);

  // Wolken: tief hängende, schwere Körper knapp über dem Kamm, ziehen mit dem Wind
  const NW = detail === 0 ? 6 : hi ? 10 : 8;
  const wolkeGeo = (() => {
    const b = new Bau();
    const sub = detail === 0 ? 0 : 1;
    const parts: [number, number, number, number, number, number][] = [
      [0, 0, 0, 1, 0.55, 0.8],
      [0.55, -0.08, 0.15, 0.62, 0.42, 0.55],
      [-0.6, -0.05, -0.1, 0.7, 0.45, 0.6],
      [0.15, 0.22, -0.2, 0.55, 0.42, 0.5],
      [-0.2, -0.18, 0.45, 0.6, 0.32, 0.45],
    ];
    for (const [x, y, z, sx, sy, sz] of parts) b.geo(new THREE.IcosahedronGeometry(1, sub), [1, 1, 1], x, y, z, 0, x * 3, 0, sx, sy, sz);
    const g = b.build();
    // Farbe nach Höhe: unten fast schwarz, oben etwas heller
    const p = g.getAttribute('position');
    const c = g.getAttribute('color') as THREE.BufferAttribute;
    const lo = rgb(0x0b0f19);
    const up = rgb(0x222b40);
    for (let k = 0; k < p.count; k++) {
      const f = smooth((p.getY(k) + 0.5) / 1.1);
      c.setXYZ(k, lo[0] + (up[0] - lo[0]) * f, lo[1] + (up[1] - lo[1]) * f, lo[2] + (up[2] - lo[2]) * f);
    }
    return g;
  })();
  const wolkeMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const wolken = new THREE.InstancedMesh(wolkeGeo, wolkeMat, NW);
  wolken.frustumCulled = false;
  wolken.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(wolken);
  disposables.push(wolkeGeo, wolkeMat, wolken);
  const WB = 330;
  const wX = new Float32Array(NW);
  const wZ = new Float32Array(NW);
  const wY = new Float32Array(NW);
  const wS = new Float32Array(NW * 3);
  const wR = new Float32Array(NW);
  for (let k = 0; k < NW; k++) {
    wX[k] = (rnd() - 0.5) * 2 * WB;
    wZ[k] = (rnd() - 0.5) * 2 * WB;
    wY[k] = 62 + rnd() * 16;
    wS[k * 3] = 34 + rnd() * 26;
    wS[k * 3 + 1] = 12 + rnd() * 6;
    wS[k * 3 + 2] = 30 + rnd() * 20;
    wR[k] = rnd() * TAU;
  }
  {
    const c = new THREE.Color(1, 1, 1);
    for (let k = 0; k < NW; k++) wolken.setColorAt(k, c);
  }
  const wGlow = new Float32Array(NW);
  const wPX = new Float32Array(NW);
  const wPZ = new Float32Array(NW);

  // --- Pro Bild -----------------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const col = new THREE.Color();
  const posA = dPos.array as Float32Array;
  const norA = dNor.array as Float32Array;
  const glutA = glutPos.array as Float32Array;
  const lichtA = lichtPos.array as Float32Array;
  const pulses = t.pulses;

  /** Stücke an ihre Lage rücken (Ecken, Normalen und Konturnormalen). */
  const setze = (laeufe: Lauf[], out: Float32Array, base: Float32Array, nOut: Float32Array | null, nBase: Float32Array | null): void => {
    const onA = nOut && dON ? (dON.array as Float32Array) : null;
    for (let li = 0; li < laeufe.length; li++) {
      const p = laeufe[li];
      const el = lagen[p.lage].elements;
      for (let i = p.v0; i < p.v1; i++) {
        const o = i * 3;
        const x = base[o];
        const y = base[o + 1];
        const z = base[o + 2];
        out[o] = el[0] * x + el[4] * y + el[8] * z + el[12];
        out[o + 1] = el[1] * x + el[5] * y + el[9] * z + el[13];
        out[o + 2] = el[2] * x + el[6] * y + el[10] * z + el[14];
        if (nOut && nBase) {
          const nx = nBase[o];
          const ny = nBase[o + 1];
          const nz = nBase[o + 2];
          nOut[o] = el[0] * nx + el[4] * ny + el[8] * nz;
          nOut[o + 1] = el[1] * nx + el[5] * ny + el[9] * nz;
          nOut[o + 2] = el[2] * nx + el[6] * ny + el[10] * nz;
          if (onA && baseON) {
            const ax = baseON[o];
            const ay = baseON[o + 1];
            const az = baseON[o + 2];
            onA[o] = el[0] * ax + el[4] * ay + el[8] * az;
            onA[o + 1] = el[1] * ax + el[5] * ay + el[9] * az;
            onA[o + 2] = el[2] * ax + el[6] * ay + el[10] * az;
          }
        }
      }
    }
  };

  /** Lage auf der Bahnlinie bei Weg s (Meter vom Anfang). */
  const aufGleis = (s: number, lage: number): void => {
    const pts = zug.pts;
    const len = zug.len;
    let k = 0;
    while (k + 2 < len.length && len[k + 1] < s) k++;
    const x0 = pts[k * 2];
    const z0 = pts[k * 2 + 1];
    const x1 = pts[k * 2 + 2];
    const z1 = pts[k * 2 + 3];
    const d = len[k + 1] - len[k] || 1;
    const f = Math.max(0, Math.min(1, (s - len[k]) / d));
    const x = x0 + (x1 - x0) * f;
    const z = z0 + (z1 - z0) * f;
    e.set(0, Math.atan2(x1 - x0, z1 - z0), 0, 'YXZ');
    q.setFromEuler(e);
    lagen[lage].compose(v.set(x, ground(x, z) + 0.45, z), q, sv.set(1, 1, 1));
  };

  let smokeT = 0;
  let sparkT = 0;
  let sprayT = 0;
  let rainT = 0;
  let hashN = 7;
  const hrnd = (): number => {
    hashN = (hashN * 16807) % 2147483647;
    return hashN / 2147483647;
  };
  // Höhen am Gleis: einmal je Wagen und Bild wäre zu teuer – grob vorab je Meter.
  const gleisY = new Float32Array(Math.max(2, Math.ceil(zug.total) + 2));
  {
    const tmp = new THREE.Matrix4();
    lagen.push(tmp);
    const li = lagen.length - 1;
    for (let s = 0; s < gleisY.length; s++) {
      aufGleis(Math.min(s, zug.total), li);
      gleisY[s] = tmp.elements[13];
    }
    lagen.pop();
  }

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink, raceTime?: number): void {
      const rt = raceTime ?? 0;
      const k = stormLight(pulses, t.flashes, rt);
      const lit = k * k * 2.4;

      // --- Gondel: pendelt zwischen den Stationen (Halt an beiden Enden) ---
      if (seil.ok) {
        const T = 170;
        const ph = (time / T) % 1;
        const u = 0.04 + 0.92 * smooth(ph < 0.5 ? ph * 2.3 - 0.075 : (1 - ph) * 2.3 - 0.075);
        seilPunkt(u, 1.6, v);
        const sw = Math.sin(time * 0.8) * 0.03;
        e.set(sw, Math.atan2(seil.bx - seil.ax, seil.bz - seil.az), Math.sin(time * 0.53) * 0.04, 'YXZ');
        q.setFromEuler(e);
        lagen[gondel].compose(v, q, sv.set(1, 1, 1));
      }
      // --- Windmesser ---
      if (windmesser >= 0) {
        const el = lagen[windmesser].elements;
        const a = time * 4.2;
        const x = el[12];
        const y = el[13];
        const z = el[14];
        lagen[windmesser].makeRotationY(a);
        lagen[windmesser].elements[12] = x;
        lagen[windmesser].elements[13] = y;
        lagen[windmesser].elements[14] = z;
      }
      // --- Zug: fährt die Bahnlinie entlang, verschwindet in den Portalen ---
      if (zug.wagen.length > 0 && zug.total > 0) {
        const run = zug.total + 120;
        const s0 = ((time * 11) % run) - 40;
        for (let w = 0; w < zug.wagen.length; w++) {
          const s = Math.max(0, Math.min(zug.total, s0 - w * 12.6));
          const lage = zug.wagen[w];
          aufGleisFast(s, lage);
        }
      }
      setze(dynL, posA, basePos, norA, baseNor);
      if (dynL.length > 0) {
        dPos.needsUpdate = true;
        dNor.needsUpdate = true;
        if (dON) dON.needsUpdate = true;
      }
      setze(glutL, glutA, glutBase, null, null);
      if (glutL.length > 0) glutPos.needsUpdate = true;

      // --- Lampen ---
      for (let n = 0; n < NL; n++) {
        const o = n * 8;
        const art = lampen[o + 4];
        const ph = lampen[o + 5];
        let size = lampen[o + 3];
        let x = lampen[o];
        let y = lampen[o + 1];
        let z = lampen[o + 2];
        if (art === L_BLINK) {
          // weich, langsam (unter 1 Hz)
          const s = 0.5 + 0.5 * Math.sin(time * 3.3 + ph * 2.7);
          size *= 0.2 + 0.8 * s * s;
        } else if (art === L_FEUER) {
          size *= 0.86 + 0.08 * Math.sin(time * 7.3 + ph) + 0.06 * Math.sin(time * 12.1 + ph * 1.7);
        } else if (art === L_AUGE) {
          // lange da, dann schaut das Tier weg; dazwischen blinzelt es
          const u = (time / 23 + ph * 0.1) % 1;
          const da = Math.min(1, Math.max(0, (0.72 - u) / 0.03)) * Math.min(1, Math.max(0, u / 0.03));
          const c = (time + ph * 3.7) % 4.6;
          const blink = c < 0.22 ? 1 - Math.sin((Math.PI * c) / 0.22) : 1;
          size *= da * blink;
        } else if (art === L_FLIEGE) {
          x += Math.sin(time * 0.37 + ph) * 2.2;
          y += Math.sin(time * 0.53 + ph * 1.7) * 0.6;
          z += Math.cos(time * 0.29 + ph * 2.3) * 2.2;
          const s = 0.5 + 0.5 * Math.sin(time * 1.5 + ph * 3.1);
          size *= 0.1 + 0.9 * s * s * s;
        } else if (art === L_STIRN) {
          size *= 0.9 + 0.1 * Math.sin(time * 0.8 + ph);
          y += Math.sin(time * 0.6 + ph) * 0.03;
        }
        const lg = lampen[o + 7];
        if (lg >= 0) v.set(x, y, z).applyMatrix4(lagen[lg]);
        else v.set(x, y, z);
        // Ferne Lichter bleiben als Punkt sichtbar.
        const d = v.distanceTo(cam);
        const s = size > 0 ? Math.max(size, d * 0.0065 * Math.min(1, size * 2)) : 0;
        m4.lookAt(cam, v, UP);
        m4.scale(sv.set(s, s, s));
        m4.setPosition(v);
        lamps.setMatrixAt(n, m4);
      }
      if (NL > 0) lamps.instanceMatrix.needsUpdate = true;

      // --- Wolken: ziehen über den Kamm; wo es einschlägt, glimmen sie von innen ---
      const drift = time * 2.6;
      for (let n = 0; n < NW; n++) {
        let wx = wX[n] + WX * drift;
        let wz = wZ[n] + WZ * drift;
        wx = ((((wx + WB) % (2 * WB)) + 2 * WB) % (2 * WB)) - WB;
        wz = ((((wz + WB) % (2 * WB)) + 2 * WB) % (2 * WB)) - WB;
        const edge = Math.min(WB - Math.abs(wx), WB - Math.abs(wz));
        const f = smooth(edge / 70);
        wPX[n] = cx0 + wx;
        wPZ[n] = cz0 + wz;
        e.set(0, wR[n], 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v.set(wPX[n], wY[n], wPZ[n]), q, sv.set(wS[n * 3] * f, wS[n * 3 + 1] * f, wS[n * 3 + 2] * f));
        wolken.setMatrixAt(n, m4);
        wGlow[n] = 0;
      }
      for (let p = 0; p < pulses.length; p++) {
        const pu = pulses[p];
        if (pu.kind !== PULSE_BOLT && pu.kind !== PULSE_ROD) continue;
        const fs = flashShape(pulseCycle(pu, rt));
        if (fs <= 0) continue;
        for (let n = 0; n < NW; n++) {
          const dd = Math.hypot(wPX[n] - pu.x, wPZ[n] - pu.z);
          const w = 1 - dd / (wS[n * 3] + 60);
          if (w > 0) wGlow[n] = Math.max(wGlow[n], fs * w * 0.75);
        }
      }
      // Wetterleuchten: je Blitz glimmt eine Wolke (aus der Nummer des Blitzes gewählt) besonders hell
      for (let fi = 0; fi < t.flashes.length; fi++) {
        const fl = t.flashes[fi];
        const c = (((rt + fl.phase) % fl.period) + fl.period) % fl.period;
        const fs = flashShape(c);
        if (fs <= 0) continue;
        const nr = Math.floor((rt + fl.phase) / fl.period);
        const pick = (((nr * 7 + fi * 5) % NW) + NW) % NW;
        wGlow[pick] = Math.max(wGlow[pick], fs);
      }
      for (let n = 0; n < NW; n++) {
        const g = wGlow[n];
        col.setRGB(1 + lit * 1.2 + g * 1.6, 1 + lit * 1.25 + g * 1.5, 1 + lit * 1.4 + g * 2.3);
        wolken.setColorAt(n, col);
      }
      wolken.instanceMatrix.needsUpdate = true;
      if (wolken.instanceColor) wolken.instanceColor.needsUpdate = true;

      // --- Nebelfetzen: treiben mit dem Wind quer über die Bahn, wachsen und vergehen ---
      if (NF > 0) {
        for (let n = 0; n < NF; n++) {
          const i = nebelSeg[n];
          const u = (time / 26 + nebelPh[n]) % 1;
          const lat = -34 + u * 68;
          const grow = Math.sin(Math.PI * u);
          const x = X(i, lat) + t.tx[i] * Math.sin(time * 0.1 + n) * 6;
          const z = Z(i, lat) + t.tz[i] * Math.sin(time * 0.1 + n) * 6;
          e.set(0, HD(i) + 0.4 + Math.sin(time * 0.05 + n) * 0.3, 0, 'YXZ');
          q.setFromEuler(e);
          lagen[nebelL[n].lage].compose(v.set(x, t.py[i] + 0.9 + Math.sin(time * 0.3 + n * 2) * 0.35, z), q, sv.set(16 * grow, 1, 8 * grow));
        }
        setze(nebelL, lichtA, lichtBase, null, null);
        lichtPos.needsUpdate = true;
        // im Blitz etwas heller
        const f = 1 + lit * 0.45;
        const ca = lichtCol.array as Float32Array;
        const n0 = nebelL[0].v0 * 3;
        const n1 = nebelL[NF - 1].v1 * 3;
        for (let o = n0; o < n1; o++) ca[o] = lichtColBase[o] * f;
        lichtCol.needsUpdate = true;
      }

      // --- Teilchen ---
      if (detail > 0) {
        // Rauch aus dem Schornstein (im Schein der Fenster)
        smokeT -= dt;
        if (smokeT <= 0) {
          smokeT = 0.5;
          const sx = schornstein[0];
          const sy = schornstein[1];
          const sz = schornstein[2];
          if (Math.abs(sx - cam.x) + Math.abs(sz - cam.z) < 200) fx.puff(sx, sy, sz, WX * 1.8, 1.4, WZ * 1.8, 3.2, 0.8, 0x4a4450, 0.8, -0.4);
        }
        // Funken vom Lagerfeuer
        sparkT -= dt;
        if (sparkT <= 0) {
          sparkT = 0.11;
          if (Math.abs(feuer[0] - cam.x) + Math.abs(feuer[2] - cam.z) < 140) fx.spark(feuer[0] + (hrnd() - 0.5) * 0.5, feuer[1], feuer[2] + (hrnd() - 0.5) * 0.5, (hrnd() - 0.5) * 0.8 + WX * 0.8, 2.4 + hrnd() * 2.4, (hrnd() - 0.5) * 0.8 + WZ * 0.8, 1.1 + hrnd() * 0.7, 0.1 + hrnd() * 0.06, hrnd() < 0.5 ? 0xffb040 : 0xff7a20, 0.6);
        }
        // Gischt am Fuß des Wasserfalls
        sprayT -= dt;
        if (sprayT <= 0) {
          sprayT = hi ? 0.28 : 0.6;
          if (Math.abs(fall[0] - cam.x) + Math.abs(fall[2] - cam.z) < 160) fx.puff(fall[0] + (hrnd() - 0.5) * 2, fall[1], fall[2] + (hrnd() - 0.5) * 2, (hrnd() - 0.5) * 1.5, 1.5 + hrnd(), (hrnd() - 0.5) * 1.5, 1.2, 1.1, 0x7d8aa0, 1.0, 0.5);
        }
      }
      if (hi) {
        // Regen: schräge Schleier um die Kamera, in Schüben dichter
        rainT += dt * (44 + 30 * Math.max(0, Math.sin(time * 0.4)));
        while (rainT >= 1) {
          rainT -= 1;
          const a = hrnd() * TAU;
          const r = 3 + hrnd() * 22;
          const x = cam.x + Math.cos(a) * r - WX * 5;
          const z = cam.z + Math.sin(a) * r - WZ * 5;
          const y = cam.y + 6 + hrnd() * 7;
          const sz = 0.07 + hrnd() * 0.05;
          for (let d = 0; d < 3; d++) fx.spark(x - WX * 0.12 * d, y + 0.32 * d, z - WZ * 0.12 * d, WX * 8, -24, WZ * 8, 0.75, sz * (1 - d * 0.22), 0x6f7f9a, 0);
        }
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };

  /** Wie aufGleis, aber mit vorab gemessener Höhe (keine Geländeabfrage je Bild). */
  function aufGleisFast(s: number, lage: number): void {
    const pts = zug.pts;
    const len = zug.len;
    let k = 0;
    while (k + 2 < len.length && len[k + 1] < s) k++;
    const x0 = pts[k * 2];
    const z0 = pts[k * 2 + 1];
    const x1 = pts[k * 2 + 2];
    const z1 = pts[k * 2 + 3];
    const d = len[k + 1] - len[k] || 1;
    const f = Math.max(0, Math.min(1, (s - len[k]) / d));
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const el = lagen[lage].elements;
    el[0] = c;
    el[1] = 0;
    el[2] = -sn;
    el[3] = 0;
    el[4] = 0;
    el[5] = 1;
    el[6] = 0;
    el[7] = 0;
    el[8] = sn;
    el[9] = 0;
    el[10] = c;
    el[11] = 0;
    el[12] = x0 + (x1 - x0) * f;
    el[13] = gleisY[Math.max(0, Math.min(gleisY.length - 1, Math.round(s)))];
    el[14] = z0 + (z1 - z0) * f;
    el[15] = 1;
  }
}
