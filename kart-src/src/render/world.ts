// Die stehende Welt einer Strecke: Fahrbahn, Banden, Brücken, Gelände, Wasser
// oder Lava, Himmel und Licht. Alles wird einmal beim Laden aus der
// Streckenbeschreibung erzeugt und zu wenigen großen Netzen zusammengefasst.

import * as THREE from 'three';
import { SURFACES } from '../game/surface';
import {
  EDGE_DECK,
  EDGE_FREE_L,
  EDGE_FREE_R,
  EDGE_GAP,
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  EDGE_RAMP,
  EDGE_TUNNEL,
  rightX,
  rightZ,
  segDelta,
  type Track,
} from '../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, textTexture, type RGB, type V3 } from './build';
import type { FxSink } from './fxApi';
import { buildLife, type Life } from './life';
import { buildScenery } from './scenery';
import { THEMES, type Theme } from './themes';
import { INK, addSmoothNormals, outlineMaterial, rgb, toonMaterial } from './toon';

const WALL_H = 0.95;
const WALL_T = 0.5;
const DECK_D = 1.1;
/** So wird ein Untergrund gezeichnet. */
interface SurfaceLook {
  /** Zwei Töne der Fahrbahn im Wechsel alle band Abschnitte, c = Farbe der Einzelheiten. */
  a: RGB;
  b: RGB;
  c: RGB;
  band: number;
  /** Glatte Straße: Mittelstrich, auf Brücken mit der Brückenfarbe gemischt. */
  plain: boolean;
  lines: boolean;
  line?: RGB;
  center?: RGB;
  kerbs: boolean;
  kerbA?: RGB;
  kerbB?: RGB;
  /** Seitenstreifen; null = wie das Thema der Welt. */
  shoulder: RGB | null;
  detail: 'none' | 'planks' | 'ruts' | 'plates' | 'cracks' | 'cobble';
  /** Begrenzung: gestreifte Bande, Mauer, Felswall, Holzzaun, Seil an Pfosten, Leitplanke. */
  barrier: 'block' | 'stone' | 'rock' | 'fence' | 'rope' | 'rail';
  wallA?: RGB;
  wallB?: RGB;
  glow?: RGB;
  glowB?: RGB;
}

/** Tunnel und Höhlen: lichte Höhe über der Fahrbahn und Dicke des Felsmantels. */
const TUNNEL_H = 7.4;
const TUNNEL_ROCK = 5;

const FOG_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

/** Wasser und Lava: drei flache Farbstufen, die langsam wandern. */
const LIQUID_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float time;
uniform vec3 c0;
uniform vec3 c1;
uniform vec3 c2;
varying vec3 vWorld;
void main() {
  float a = sin(vWorld.x * 0.085 + time * 0.7 + sin(vWorld.z * 0.06 + time * 0.4) * 1.8);
  float b = sin(vWorld.z * 0.12 - time * 0.55 + sin(vWorld.x * 0.045 - time * 0.2) * 2.2);
  float v = a * 0.3 + b * 0.2 + 0.5;
  vec3 col = v < 0.52 ? c0 : (v < 0.83 ? c1 : c2);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** Boost-Feld: Pfeile, die in Fahrtrichtung laufen. */
const PAD_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float time;
uniform vec3 c0;
uniform vec3 c1;
varying vec2 vUv;
void main() {
  float k = fract(vUv.y * 1.6 - abs(vUv.x - 0.5) * 1.5 - time * 2.4);
  float edge = step(0.06, vUv.x) * step(vUv.x, 0.94);
  vec3 col = mix(c0, k < 0.5 ? c1 : c0, edge);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function fogShader(frag: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    vertexShader: FOG_VERT,
    fragmentShader: frag,
    fog: true,
  });
}

export class World {
  readonly group = new THREE.Group();
  readonly theme: Theme;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly fog: THREE.Fog;
  /** Mitte und Ausdehnung der Strecke (für Übersichtskamera und Kulissen). */
  readonly center = new THREE.Vector3();
  radius = 100;

  private readonly skyGroup = new THREE.Group();
  private readonly clouds = new THREE.Group();
  private readonly timed: THREE.ShaderMaterial[] = [];
  private boxMesh: THREE.InstancedMesh | null = null;
  private boxOutline: THREE.InstancedMesh | null = null;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly euler = new THREE.Euler();
  private readonly disposables: { dispose(): void }[] = [];
  /** Sichtbare Größe jeder Kiste (0..1) – wächst nach dem Einsammeln wieder an. */
  private boxScale: Float32Array;
  private nonDeck: number[] = [];
  private idwSegs: number[] = [];
  private life: Life | null = null;

  constructor(
    readonly track: Track,
    /** 0 niedrig, 1 mittel, 2 hoch */
    readonly detail: number,
  ) {
    this.theme = THEMES[track.def.theme];
    const th = this.theme;
    const t = track;
    this.boxScale = new Float32Array(t.boxes.length).fill(1);

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < t.total; i++) {
      minX = Math.min(minX, t.px[i]);
      maxX = Math.max(maxX, t.px[i]);
      minZ = Math.min(minZ, t.pz[i]);
      maxZ = Math.max(maxZ, t.pz[i]);
      if ((t.edge[i] & EDGE_DECK) === 0) {
        this.nonDeck.push(i);
        if (i % 8 === 0) this.idwSegs.push(i);
      }
    }
    this.center.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.radius = Math.hypot(maxX - minX, maxZ - minZ) / 2;

    this.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    this.sun = new THREE.DirectionalLight(th.sunColor, th.sunIntensity);
    this.sun.position.set(th.sunDir[0], th.sunDir[1], th.sunDir[2]).multiplyScalar(100);
    this.hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiIntensity);
    this.group.add(this.sun, this.hemi);

    this.buildRoad();
    this.buildTerrain(minX, maxX, minZ, maxZ);
    this.buildSky();
    this.buildBoxes();
    const scenery = buildScenery(this);
    this.group.add(scenery.group);
    this.disposables.push(scenery);
    this.life = buildLife(this);
    if (this.life) {
      this.group.add(this.life.group);
      this.disposables.push(this.life);
    }
  }

  /**
   * Abstand eines Punkts zur nächsten Bande in Metern (negativ = auf der
   * Strecke). Kulissen halten damit Abstand zur Fahrbahn.
   */
  clearance(x: number, z: number): number {
    const t = this.track;
    let best = Infinity;
    for (let k = 0; k < t.total; k += 2) {
      // Um einen Tunnel liegt Fels: dort beginnt der freie Platz erst weiter draußen.
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k] - (t.edge[k] & EDGE_TUNNEL ? TUNNEL_ROCK + 2 : 0);
      if (d < best) best = d;
    }
    return best;
  }

  // --- Fahrbahn --------------------------------------------------------------

  /** Punkt auf der Fahrbahn: Abschnitt i, Anteil f zum nächsten, seitlich lat, um dy angehoben. */
  private P(i: number, f: number, lat: number, dy = 0): V3 {
    const t = this.track;
    const a = i;
    const x = t.px[a] + rightX(t, a) * lat;
    const y = t.py[a] + lat * t.bank[a] + dy;
    const z = t.pz[a] + rightZ(t, a) * lat;
    if (f === 0) return [x, y, z];
    const b = t.next[a];
    const x2 = t.px[b] + rightX(t, b) * lat;
    const y2 = t.py[b] + lat * t.bank[b] + dy;
    const z2 = t.pz[b] + rightZ(t, b) * lat;
    return [x + (x2 - x) * f, y + (y2 - y) * f, z + (z2 - z) * f];
  }

  private buildRoad(): void {
    const t = this.track;
    const th = this.theme;
    const solid = new MeshBuilder();
    const paint = new MeshBuilder();
    const cRoad = rgb(th.road);
    const cRoadAlt = rgb(th.roadAlt);
    const cShoulder = rgb(th.shoulder);
    const cLine = rgb(th.line);
    const cWallA = rgb(th.wallA);
    const cWallB = rgb(th.wallB);
    const cCap = rgb(th.wallCap);
    const cDeck = rgb(th.deck);
    const cDeckDark = rgb(th.deckDark);
    const cPillar = rgb(th.pillar);
    const cKerbA = rgb(th.kerbA);
    const cKerbB = rgb(th.kerbB);
    const cWarn = rgb(0xffd23f);
    const cInk = rgb(INK);

    /** Fläche mit Normale nach oben zwischen zwei seitlichen Lagen. */
    const top = (b: MeshBuilder, i: number, f0: number, f1: number, l0: number, l1: number, dy: number, c: RGB): void => {
      b.quad(this.P(i, f0, l0, dy), this.P(i, f0, l1, dy), this.P(i, f1, l1, dy), this.P(i, f1, l0, dy), c);
    };
    /** Senkrechte Fläche längs der Strecke; right = Normale zeigt nach rechts. */
    const side = (i: number, f0: number, f1: number, lat: number, y0: number, y1: number, right: boolean, c: RGB): void => {
      const a = this.P(i, f0, lat, y0);
      const b = this.P(i, f1, lat, y0);
      const cc = this.P(i, f1, lat, y1);
      const d = this.P(i, f0, lat, y1);
      if (right) solid.quad(a, b, cc, d, c);
      else solid.quad(b, a, d, cc, c);
    };
    /** Senkrechte Fläche quer zur Strecke; forward = Normale zeigt in Fahrtrichtung. */
    const cross = (i: number, f: number, l0: number, l1: number, y0: number, y1: number, forward: boolean, c: RGB): void => {
      const a = this.P(i, f, l0, y0);
      const b = this.P(i, f, l1, y0);
      const cc = this.P(i, f, l1, y1);
      const d = this.P(i, f, l0, y1);
      if (forward) solid.quad(b, a, d, cc, c);
      else solid.quad(a, b, cc, d, c);
    };

    // Aussehen der Untergründe (Reihenfolge wie SURFACES in game/surface.ts).
    const dark = th.stars ? 0.72 : 1;
    const col = (hex: number): RGB => shade(rgb(hex), dark);
    const crack = t.def.theme === 'glut' ? rgb(0xff8a2a) : t.def.theme === 'nacht' ? rgb(0x4ef0ff) : rgb(0x9a8fa3);
    const wood: [RGB, RGB] = [col(0xa8794a), col(0x7a5a3c)];
    const looks: SurfaceLook[] = SURFACES.map((sf): SurfaceLook => {
      switch (sf.id) {
        case 'wood':
          return { a: col(0xb98150), b: col(0xa56f3f), c: col(0x5e4226), band: 1, plain: false, lines: false, kerbs: false, shoulder: col(0x8f6a40), detail: 'planks', barrier: 'rope', wallA: wood[1], wallB: col(0xf2e6c8) };
        case 'sand':
          return { a: col(0xecd9a0), b: col(0xe4cd8c), c: col(0xd3ba78), band: 3, plain: false, lines: false, kerbs: false, shoulder: col(0xdcc486), detail: 'ruts', barrier: 'fence', wallA: wood[0], wallB: wood[1] };
        case 'dirt':
          return { a: col(0x9c7650), b: col(0x916b47), c: col(0x775638), band: 5, plain: false, lines: false, kerbs: false, shoulder: null, detail: 'ruts', barrier: 'fence', wallA: wood[0], wallB: wood[1] };
        case 'gravel':
          return { a: col(0xaaa49b), b: col(0x9b948a), c: col(0x857e75), band: 2, plain: false, lines: false, kerbs: false, shoulder: null, detail: 'ruts', barrier: 'fence', wallA: wood[0], wallB: wood[1] };
        case 'grass':
          return { a: col(0x86c45c), b: col(0x77b650), c: col(0x6aa646), band: 4, plain: false, lines: true, line: col(0xf7f4e8), kerbs: false, shoulder: null, detail: 'none', barrier: 'fence', wallA: wood[0], wallB: wood[1] };
        case 'rock':
          return { a: col(0x57495a), b: col(0x4b3f50), c: crack, band: 3, plain: false, lines: false, kerbs: false, shoulder: col(0x3c3242), detail: 'cracks', barrier: 'rock', wallA: col(0x6b5565), wallB: col(0x54445a) };
        case 'metal':
          return { a: col(0x8792a0), b: col(0x77828f), c: col(0x4d5560), band: 3, plain: false, lines: true, line: col(0xffd23f), kerbs: false, shoulder: col(0x5c6570), detail: 'plates', barrier: 'rail', wallA: col(0x3a4049), wallB: col(0xc9d2dc) };
        case 'cobble':
          return { a: col(0x9a9186), b: col(0x857d73), c: col(0x6f685f), band: 1, plain: false, lines: false, kerbs: false, shoulder: col(0x7a7268), detail: 'cobble', barrier: 'stone', wallA: col(0xa59c90), wallB: col(0x8d857a) };
        case 'neon':
          return { a: rgb(0x23263f), b: rgb(0x1c1f36), c: rgb(0x4ef0ff), band: 4, plain: true, lines: true, line: rgb(0x4ef0ff), center: rgb(0xff5ad1), kerbs: true, kerbA: rgb(0xff5ad1), kerbB: rgb(0x23263f), shoulder: rgb(0x15172b), detail: 'none', barrier: 'rail', wallA: rgb(0x2d3050), wallB: rgb(0x8f97b8), glow: rgb(0xff5ad1), glowB: rgb(0x4ef0ff) };
        default:
          return { a: cRoad, b: cRoadAlt, c: cInk, band: 4, plain: true, lines: true, kerbs: true, shoulder: null, detail: 'none', barrier: 'block' };
      }
    });

    for (let i = 0; i < t.total; i++) {
      const j = t.next[i];
      const gapI = (t.edge[i] & EDGE_GAP) !== 0;
      const gapJ = (t.edge[j] & EDGE_GAP) !== 0;
      if (gapI && gapJ) continue;
      // Die Fahrbahn endet genau dort, wo für die Physik der Boden endet: auf halbem Weg zum Lückenabschnitt.
      const f0 = gapI ? 0.5 : 0;
      const f1 = gapJ ? 0.5 : 1;
      const q = gapI ? j : i;
      const e = t.edge[q];
      const rh = t.rh[q];
      const wh = t.wh[q];
      const openL = (e & EDGE_OPEN_L) !== 0;
      const openR = (e & EDGE_OPEN_R) !== 0;
      const deck = (e & EDGE_DECK) !== 0;
      const ramp = (e & EDGE_RAMP) !== 0;
      // An Gabelung und Einmündung liegen zwei Fahrbahnen ineinander: zur
      // Nachbarin hin gibt es weder Bande noch Randlinie, und die Flächen
      // liegen hauchdünn gestaffelt, damit sie nicht flimmern.
      const freeL = ((e | t.edge[j]) & EDGE_FREE_L) !== 0;
      const freeR = ((e | t.edge[j]) & EDGE_FREE_R) !== 0;
      const lower = (freeL || freeR) && t.branchOf[i] >= 0 ? -0.012 : 0;

      const look = looks[t.surf[q]] ?? looks[0];

      // Fahrbahn in zwei leicht verschiedenen Tönen – das Wechselmuster macht Tempo sichtbar.
      const tone = Math.floor(i / look.band) % 2 === 0;
      const road = ramp ? (i % 2 === 0 ? cWarn : cInk) : tone ? look.a : look.b;
      const surface = deck && !ramp && look.plain ? mixRgb(road, cDeck, 0.35) : road;
      if (look.detail === 'cobble' && !ramp) {
        // Pflaster: vier Bahnen im Schachbrett
        for (let c = 0; c < 4; c++) {
          top(solid, i, f0, f1, -rh + (c * rh) / 2, -rh + ((c + 1) * rh) / 2, lower, (i + c) % 2 === 0 ? look.a : look.b);
        }
      } else top(solid, i, f0, f1, -rh, rh, lower, surface);
      const sh = look.shoulder ?? (deck ? cDeckDark : cShoulder);
      top(solid, i, f0, f1, -wh, -rh, freeL ? -0.025 : 0, sh);
      top(solid, i, f0, f1, rh, wh, freeR ? -0.025 : 0, sh);

      // Was den Untergrund ausmacht: Fugen, Fahrrinnen, Nähte, Risse
      if (!ramp && lower === 0 && f0 === 0 && f1 === 1) {
        const d = look.detail;
        if (d === 'planks') top(solid, i, 0, 0.14, -rh, rh, 0.012, look.c);
        else if (d === 'ruts') {
          top(solid, i, 0, 1, -2.3, -1.3, 0.012, look.c);
          top(solid, i, 0, 1, 1.3, 2.3, 0.012, look.c);
        } else if (d === 'plates') {
          top(solid, i, 0, 1, -0.09, 0.09, 0.012, look.c);
          if (i % 3 === 0) top(solid, i, 0, 0.08, -rh, rh, 0.012, look.c);
        } else if (d === 'cracks' && i % 2 === 0) {
          // Risse: kurze, schräg versetzte Striche, die glühen bzw. hell schimmern
          const l0 = (noise(i * 0.37, t.index * 5.1) - 0.5) * 1.5 * rh;
          const l1 = l0 + (noise(i * 0.61, 9.3) - 0.5) * 2.4;
          paint.quad(this.P(i, 0, l0 - 0.1, 0.03), this.P(i, 0, l0 + 0.1, 0.03), this.P(i, 1, l1 + 0.1, 0.03), this.P(i, 1, l1 - 0.1, 0.03), look.c);
        }
      }

      // Markierungen
      if (!ramp && look.lines) {
        const cl = look.line ?? cLine;
        if (!freeL) top(paint, i, f0, f1, -rh + 0.25, -rh + 0.5, 0.03, cl);
        if (!freeR) top(paint, i, f0, f1, rh - 0.5, rh - 0.25, 0.03, cl);
        if (i % 8 < 3 && lower === 0 && look.plain) top(paint, i, f0, f1, -0.14, 0.14, 0.03, look.center ?? cl);
      }
      if (!ramp && look.kerbs && Math.abs(t.curv[q]) > 1 / 46) {
        const kerb = Math.floor(i / 2) % 2 === 0 ? (look.kerbA ?? cKerbA) : (look.kerbB ?? cKerbB);
        if (!freeL) top(paint, i, f0, f1, -rh - 0.75, -rh + 0.1, 0.05, kerb);
        if (!freeR) top(paint, i, f0, f1, rh - 0.1, rh + 0.75, 0.05, kerb);
      }

      // Begrenzung bzw. offene Kante
      const panel = Math.floor(i / 3) % 2 === 0;
      const whole = f0 === 0 && f1 === 1;
      for (const sgn of [-1, 1]) {
        if (sgn < 0 ? freeL : freeR) continue;
        const open = sgn < 0 ? openL : openR;
        const inner = sgn * wh;
        const outer = sgn * (wh + WALL_T);
        if (open) {
          // Warnstreifen an der Kante, darunter die Stirnseite des Stegs.
          const l0 = sgn < 0 ? inner : inner - 0.45;
          top(paint, i, f0, f1, l0, l0 + 0.45, 0.04, i % 2 === 0 ? cWarn : cInk);
          side(i, f0, f1, inner, -DECK_D, 0, sgn > 0, cDeckDark);
          continue;
        }
        const skirt = deck ? -DECK_D : -0.7 - (t.py[q] - t.base[q]);
        const style = look.barrier;
        if (style === 'block' || style === 'stone') {
          const cA = style === 'stone' ? look.wallA! : cWallA;
          const cB = style === 'stone' ? look.wallB! : cWallB;
          const c = panel ? cA : cB;
          side(i, f0, f1, inner, 0, WALL_H, sgn < 0, c);
          // Außen reicht die Bande bis ins Gelände hinunter – auch dort, wo eine Schanze oder Kuppe die Fahrbahn anhebt.
          side(i, f0, f1, outer, skirt, WALL_H, sgn > 0, shade(c, 0.8));
          const cap = style === 'stone' ? shade(cA, 1.12) : cCap;
          if (sgn < 0) top(solid, i, f0, f1, outer, inner, WALL_H, cap);
          else top(solid, i, f0, f1, inner, outer, WALL_H, cap);
        } else if (style === 'rock') {
          // Wall aus Felsbrocken: jede Kante anders hoch
          const h0 = 0.55 + 0.9 * noise(i * 0.83 + sgn * 11, t.index * 3.7);
          const h1 = 0.55 + 0.9 * noise(j * 0.83 + sgn * 11, t.index * 3.7);
          const c = (i + (sgn > 0 ? 1 : 0)) % 2 === 0 ? look.wallA! : look.wallB!;
          const out2 = sgn * (wh + WALL_T * 2);
          const a0 = this.P(i, f0, inner, 0);
          const a1 = this.P(i, f1, inner, 0);
          const b0 = this.P(i, f0, sgn * (wh + WALL_T * 0.8), f0 === 0 ? h0 : (h0 + h1) / 2);
          const b1 = this.P(i, f1, sgn * (wh + WALL_T * 0.8), f1 === 1 ? h1 : (h0 + h1) / 2);
          const c0 = this.P(i, f0, out2, skirt);
          const c1 = this.P(i, f1, out2, skirt);
          if (sgn < 0) {
            solid.quad(a1, a0, b0, b1, c);
            solid.quad(b1, b0, c0, c1, shade(c, 0.8));
          } else {
            solid.quad(a0, a1, b1, b0, c);
            solid.quad(b0, b1, c1, c0, shade(c, 0.8));
          }
        } else {
          // Zaun, Seil oder Leitplanke: Pfosten in festem Abstand, dazwischen Holme
          const mid = sgn * (wh + WALL_T * 0.5);
          const rails: [number, number, RGB][] =
            style === 'fence'
              ? [
                  [0.36, 0.52, look.wallA!],
                  [0.78, 0.94, look.wallA!],
                ]
              : style === 'rope'
                ? [[0.74, 0.86, look.wallB!]]
                : [[0.4, 0.8, panel ? look.wallB! : shade(look.wallB!, 0.9)]];
          for (const [y0, y1, c] of rails) {
            side(i, f0, f1, mid - sgn * 0.06, y0, y1, sgn < 0, c);
            side(i, f0, f1, mid + sgn * 0.06, y0, y1, sgn > 0, shade(c, 0.8));
            top(solid, i, f0, f1, Math.min(mid - 0.06, mid + 0.06), Math.max(mid - 0.06, mid + 0.06), y1, shade(c, 1.1));
          }
          if (whole && i % (style === 'rail' ? 4 : 3) === 0) {
            const p = this.P(i, 0, mid);
            const ph = style === 'rail' ? 0.86 : 1.12;
            solid.box(p[0], p[1] + ph / 2 - 0.05, p[2], 0.26, ph + 0.1, 0.26, look.wallA!, Math.atan2(t.tx[i], t.tz[i]));
          }
          // Leuchtband auf der Leitplanke
          if (style === 'rail' && look.glow) top(paint, i, f0, f1, Math.min(mid - 0.07, mid + 0.07), Math.max(mid - 0.07, mid + 0.07), 0.83, Math.floor(i / 6) % 2 === 0 ? look.glow : (look.glowB ?? look.glow));
          // Wo die Fahrbahn frei steht oder angehoben ist, braucht sie darunter eine Kante.
          if (deck || t.py[q] - t.base[q] > 0.05) side(i, f0, f1, outer, skirt, 0, sgn > 0, deck ? cDeckDark : shade(sh, 0.75));
          else side(i, f0, f1, outer, skirt, 0, sgn > 0, shade(sh, 0.75));
        }
      }
      if (deck) {
        // Unterseite
        const l = openL ? -wh : -wh - WALL_T;
        const r = openR ? wh : wh + WALL_T;
        solid.quad(this.P(i, f0, r, -DECK_D), this.P(i, f0, l, -DECK_D), this.P(i, f1, l, -DECK_D), this.P(i, f1, r, -DECK_D), cDeckDark);
      }
      // Stirnflächen an den Enden einer Lücke
      if (gapJ) cross(i, 0.5, -wh, wh, -DECK_D - 0.6, 0, true, cDeckDark);
      if (gapI) cross(i, 0.5, -wh, wh, -DECK_D - 0.6, 0, false, cDeckDark);

      // Stützen: links und rechts außerhalb der Bande, mit Querträger
      if (deck && !gapI && !gapJ && i % 14 === 7 && (e & EDGE_RAMP) === 0) {
        const lat = wh + WALL_T + 0.5;
        let free = true;
        const posts: V3[] = [];
        for (const sgn of [-1, 1]) {
          const p = this.P(i, 0, sgn * lat);
          posts.push(p);
          for (let k = 0; k < t.total; k += 2) {
            if (Math.abs(segDelta(t, i, k)) < 24 && t.branchOf[i] === t.branchOf[k]) continue;
            if (t.py[k] < p[1] - 2 && Math.hypot(t.px[k] - p[0], t.pz[k] - p[2]) < t.wh[k] + 1) free = false;
          }
        }
        if (free) {
          const rot = Math.atan2(t.tx[i], t.tz[i]);
          const c = this.P(i, 0, 0);
          solid.box(c[0], c[1] - DECK_D - 0.35, c[2], lat * 2 + 1.1, 0.7, 1.1, cPillar, rot);
          for (const p of posts) {
            const foot = Math.min(this.heightAt(p[0], p[2]), th.liquidY ?? Infinity) - 1.5;
            const topY = p[1] - DECK_D - 0.7;
            if (topY > foot) solid.box(p[0], (topY + foot) / 2, p[2], 1.1, topY - foot, 1.1, cPillar, rot);
          }
        }
      }
    }

    this.buildTunnels(solid, paint);

    // Start- und Ziellinie: Schachbrett
    const cols = 10;
    const rh0 = t.rh[0];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        const l0 = -rh0 + ((2 * rh0) / cols) * c;
        top(paint, r, 0, 1, l0, l0 + (2 * rh0) / cols, 0.035, (r + c) % 2 === 0 ? rgb(0xffffff) : cInk);
      }
    }

    const solidMesh = new THREE.Mesh(solid.build(), toonMaterial({ vertexColors: true }));
    const paintMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    if (th.stars) paintMat.color.setScalar(0.82);
    const paintMesh = new THREE.Mesh(paint.build(), paintMat);
    this.group.add(solidMesh, paintMesh);
    this.disposables.push(solidMesh.geometry, solidMesh.material as THREE.Material, paintMesh.geometry, paintMat);

    this.buildPads();
    this.buildGantry();
  }

  /**
   * Tunnel und Höhlen: ein Felsmantel um die Fahrbahn – außen zerklüftet, innen
   * dunkel, mit leuchtenden Kristallen an den Wänden. Der Fels steht als eigener
   * Rücken auf dem Gelände; eine zweite Fahrbahn kann darüber hinwegführen.
   */
  private buildTunnels(solid: MeshBuilder, glow: MeshBuilder): void {
    const t = this.track;
    const th = this.theme;
    const id = t.def.theme;
    // Werkshof und Stadt bekommen eine Halle bzw. Unterführung mit geraden
    // Wänden, die Naturstrecken eine Höhle im Fels.
    const hall = id === 'werkshof' || id === 'nacht';
    const H = TUNNEL_H;
    const R = hall ? 0.9 : TUNNEL_ROCK;
    const cRock = rgb(th.ground[2]);
    const cWall = id === 'nacht' ? rgb(0x2d3050) : rgb(0xd9c7a8);
    const cBand = id === 'nacht' ? rgb(0xff5ad1) : rgb(0x6fd0e6);
    const cRoof = id === 'nacht' ? rgb(0x23263f) : rgb(0xb5543c);
    const cGlow = rgb({ werkshof: 0xfff3b0, klippe: 0x7ef0ff, glut: 0xff8a2a, nacht: 0xff5ad1 }[id] ?? 0x7ef0ff);
    // Querschnitt von links unten über den Scheitel nach rechts unten:
    // innen [Anteil der halben Breite, Höhe], außen [Anteil der halben Breite, Anteil des Mantels, Höhe].
    const IN: [number, number][] = hall
      ? [
          [-1, 0],
          [-1, 0.52 * H],
          [-1, 0.84 * H],
          [-0.5, 0.97 * H],
          [0, 1.04 * H],
          [0.5, 0.97 * H],
          [1, 0.84 * H],
          [1, 0.52 * H],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-1, 0.45 * H],
          [-0.74, 0.78 * H],
          [-0.38, 0.95 * H],
          [0, H],
          [0.38, 0.95 * H],
          [0.74, 0.78 * H],
          [1, 0.45 * H],
          [1, 0],
        ];
    const OUT: [number, number, number][] = hall
      ? [
          [-1, 1, -1.4],
          [-1, 1, 0.52 * H],
          [-1, 1.5, 0.84 * H + 0.45],
          [-0.5, 0.6, 0.97 * H + 0.85],
          [0, 0, 1.04 * H + 0.95],
          [0.5, 0.6, 0.97 * H + 0.85],
          [1, 1.5, 0.84 * H + 0.45],
          [1, 1, 0.52 * H],
          [1, 1, -1.4],
        ]
      : [
          [-1, 1, -1.4],
          [-1, 0.86, 0.5 * H],
          [-0.74, 0.74, 0.86 * H + 0.4 * R],
          [-0.38, 0.4, H + 0.6 * R],
          [0, 0, H + 0.72 * R],
          [0.38, 0.4, H + 0.6 * R],
          [0.74, 0.74, 0.86 * H + 0.4 * R],
          [1, 0.86, 0.5 * H],
          [1, 1, -1.4],
        ];
    const K = IN.length;
    /** Farbe des Mantels außen bzw. der Wand innen für den Streifen k am Abschnitt i. */
    const outer = (i: number, k: number): RGB => {
      if (!hall) {
        const c = k >= 2 && k <= 5 ? rgb(th.ground[3]) : cRock;
        return (i + k) % 3 === 0 ? shade(c, 0.9) : c;
      }
      if (k === 0 || k === K - 2) return i % 6 < 3 ? cWall : shade(cWall, 0.93);
      if (k === 1 || k === K - 3) return Math.floor(i / 3) % 2 === 0 ? cBand : cWall;
      return i % 2 === 0 ? cRoof : shade(cRoof, 0.9);
    };
    const inner = (i: number, k: number): RGB => {
      const c = hall ? (k === 0 || k === K - 2 ? shade(cWall, 0.62) : shade(k === 1 || k === K - 3 ? cWall : cRoof, 0.45)) : shade(cRock, 0.42);
      return (i + k) % 2 === 0 ? c : shade(c, 0.82);
    };
    const cFace = hall ? shade(cWall, 0.85) : shade(cRock, 0.72);
    const rings = new Map<number, { inner: V3[]; outer: V3[] }>();
    const ring = (i: number): { inner: V3[]; outer: V3[] } => {
      let r = rings.get(i);
      if (r) return r;
      const W = t.wh[i] + WALL_T + 0.25;
      const pin: V3[] = [];
      const pout: V3[] = [];
      for (let k = 0; k < K; k++) {
        pin.push(this.P(i, 0, IN[k][0] * W, IN[k][1]));
        // Fels: jeder Punkt des Mantels sitzt etwas anders – entlang der Röhre zusammenhängend.
        const n = hall ? 0.5 : noise(t.px[i] * 0.16 + k * 7.3, t.pz[i] * 0.16 - k * 3.1);
        const bulge = 1 + 0.5 * (n - 0.5);
        const side = OUT[k][0] < 0 ? -1 : OUT[k][0] > 0 ? 1 : 0;
        pout.push(this.P(i, 0, OUT[k][0] * W + side * OUT[k][1] * R * bulge, k === 0 || k === K - 1 ? OUT[k][2] : OUT[k][2] * (0.9 + 0.2 * n)));
      }
      r = { inner: pin, outer: pout };
      rings.set(i, r);
      return r;
    };
    let lamp = 0;
    for (let i = 0; i < t.total; i++) {
      if ((t.edge[i] & EDGE_TUNNEL) === 0) continue;
      const a = ring(i);
      const j = t.next[i];
      const first = (t.edge[t.prev[i]] & EDGE_TUNNEL) === 0;
      const last = (t.edge[j] & EDGE_TUNNEL) === 0;
      // Stirnflächen am Ein- und Ausgang
      for (let k = 0; k < K - 1; k++) {
        if (first) solid.quad(a.inner[k], a.inner[k + 1], a.outer[k + 1], a.outer[k], cFace);
        if (last) solid.quad(a.inner[k + 1], a.inner[k], a.outer[k], a.outer[k + 1], cFace);
      }
      if (last) continue;
      const b = ring(j);
      for (let k = 0; k < K - 1; k++) {
        solid.quad(a.outer[k], a.outer[k + 1], b.outer[k + 1], b.outer[k], outer(i, k));
        solid.quad(a.inner[k + 1], a.inner[k], b.inner[k], b.inner[k + 1], inner(i, k));
      }
      if (i % 7 !== 3) continue;
      lamp++;
      if (hall) {
        // Leuchtband unter dem First
        const p = this.P(i, 0, 0, 1.04 * H - 0.35);
        glow.box(p[0], p[1], p[2], 2.6, 0.22, 0.9, cGlow, Math.atan2(t.tx[i], t.tz[i]));
      } else {
        // Kristalle: abwechselnd links und rechts an der Wand
        const sgn = lamp % 2 === 0 ? -1 : 1;
        const W = t.wh[i] + WALL_T;
        for (let c = 0; c < 3; c++) {
          const p = this.P(i, 0.2 * c, sgn * (W - 0.25 * c), 1.3 + 0.9 * c + (lamp % 3) * 0.5);
          const geo = new THREE.OctahedronGeometry(0.34 + 0.16 * ((lamp + c) % 3), 0);
          this.euler.set(0.5 * c, lamp, 0.4 * sgn);
          this.q.setFromEuler(this.euler);
          this.m4.compose(this.v.set(p[0], p[1], p[2]), this.q, this.s.set(0.7, 1.6, 0.7));
          glow.add(geo, c === 1 ? shade(cGlow, 1.25) : cGlow, this.m4);
          geo.dispose();
        }
      }
    }
  }

  private buildPads(): void {
    const t = this.track;
    if (t.pads.length === 0) return;
    const b = new MeshBuilder();
    const white: RGB = [1, 1, 1];
    for (const pad of t.pads) {
      let i = pad.seg;
      for (let k = 0; k < pad.length; k++, i = t.next[i]) {
        b.quadUv(
          this.P(i, 0, pad.lat - pad.halfWidth, 0.05),
          this.P(i, 0, pad.lat + pad.halfWidth, 0.05),
          this.P(i, 1, pad.lat + pad.halfWidth, 0.05),
          this.P(i, 1, pad.lat - pad.halfWidth, 0.05),
          white,
          0,
          k / 2,
          1,
          (k + 1) / 2,
        );
      }
    }
    const mat = fogShader(PAD_FRAG, {
      time: { value: 0 },
      c0: { value: new THREE.Color(0x10b8c8) },
      c1: { value: new THREE.Color(0xfff06a) },
    });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -3;
    mat.polygonOffsetUnits = -6;
    this.timed.push(mat);
    const mesh = new THREE.Mesh(b.build(), mat);
    this.group.add(mesh);
    this.disposables.push(mesh.geometry, mat);
  }

  /** Startbogen mit dem Namen der Strecke. */
  private buildGantry(): void {
    const t = this.track;
    const b = new MeshBuilder();
    const wh = t.wh[0] + WALL_T + 1.6;
    const rot = Math.atan2(t.tx[0], t.tz[0]);
    const cPost = rgb(this.theme.wallCap);
    const H = 7.4;
    for (const sgn of [-1, 1]) {
      const p = this.P(0, 0, sgn * wh);
      b.box(p[0], p[1] + H / 2, p[2], 0.7, H, 0.7, cPost, rot);
    }
    const c = this.P(0, 0, 0);
    b.box(c[0], c[1] + H + 0.25, c[2], wh * 2 + 0.7, 0.5, 0.9, cPost, rot);
    const frame = new THREE.Mesh(b.build(), toonMaterial({ vertexColors: true }));
    this.group.add(frame);
    this.disposables.push(frame.geometry, frame.material as THREE.Material);

    const tex = textTexture(t.def.name.toUpperCase(), { w: 1024, h: 128, bg: '#16131c', fg: '#ffd23f' });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(wh * 2, 1.7), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    banner.position.set(c[0], c[1] + H - 0.9, c[2]);
    // Lesbar für alle, die auf die Linie zufahren.
    banner.rotation.y = Math.atan2(-t.tx[0], -t.tz[0]);
    this.group.add(banner);
    this.disposables.push(banner.geometry, banner.material as THREE.Material, tex);
  }

  // --- Gelände ---------------------------------------------------------------

  private insideLoop(x: number, z: number): boolean {
    const t = this.track;
    let inside = false;
    const stepN = 3;
    for (let i = 0, j = t.n - stepN; i < t.n; j = i, i += stepN) {
      const zi = t.pz[i];
      const zj = t.pz[j];
      if (zi > z !== zj > z && x < ((t.px[j] - t.px[i]) * (z - zi)) / (zj - zi) + t.px[i]) inside = !inside;
    }
    return inside;
  }

  /** Höhe des Geländes an einer beliebigen Stelle. */
  heightAt(x: number, z: number): number {
    const t = this.track;
    const th = this.theme;
    if (th.rough === 0 && th.liquidY === null && t.def.theme === 'nacht') return th.farY;

    // Nächstes Stück Fahrbahn, das auf dem Boden liegt
    let best = -1;
    let bestD = Infinity;
    for (const i of this.nonDeck) {
      const dx = x - t.px[i];
      const dz = z - t.pz[i];
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const d = Math.sqrt(bestD);
    const lat = best < 0 ? 0 : (x - t.px[best]) * rightX(t, best) + (z - t.pz[best]) * rightZ(t, best);
    const whb = best < 0 ? 0 : t.wh[best];
    const roadY = best < 0 ? th.farY : t.base[best] + Math.max(-whb, Math.min(whb, lat)) * t.bank[best] - 0.3;

    // Grundform abseits der Strecke
    let base: number;
    if (th.liquidY === null) {
      base = th.farY;
    } else {
      // Insel: Höhen der Strecke weich in die Fläche verteilt, außen fällt sie ins Meer bzw. in die Lava.
      let sum = 0;
      let wsum = 0;
      for (const i of this.idwSegs) {
        const dx = x - t.px[i];
        const dz = z - t.pz[i];
        const w = 1 / (dx * dx + dz * dz + 60) ** 1.5;
        sum += w * t.py[i];
        wsum += w;
      }
      const idw = wsum > 0 ? sum / wsum : th.farY;
      if (this.insideLoop(x, z)) {
        base = idw - 0.6;
        // Vulkan: hoch gelegenes Inneres sackt zum Krater ab.
        if (t.def.theme === 'glut' && idw > 7) base -= Math.min(idw - th.liquidY! + 3, Math.max(0, d - 16) * 0.9);
      } else {
        base = idw + (th.farY - idw) * smooth((d - 22) / 46);
      }
      // Wo die Fahrbahn frei steht und keine Bande hat (Steg, Grat, Sprung), fällt das
      // Gelände daneben ab – man sieht, dass es dort hinuntergeht.
      let drop = base;
      let dropK = 0;
      for (let i = 0; i < t.n; i += 2) {
        if ((t.edge[i] & EDGE_DECK) === 0 || (t.edge[i] & (EDGE_OPEN_L | EDGE_OPEN_R)) === 0) continue;
        const dd = Math.hypot(x - t.px[i], z - t.pz[i]);
        if (dd > 36) continue;
        const kk = 1 - smooth((dd - 11) / 25);
        if (kk > dropK) {
          dropK = kk;
          drop = Math.max(th.farY, t.py[i] - 10);
        }
      }
      if (dropK > 0 && drop < base) base += (drop - base) * dropK;
    }
    const k = smooth((d - whb - 1.2) / 24);
    const bumps = (noise(x * 0.045, z * 0.045) - 0.5) * 2 * th.rough + (noise(x * 0.13 + 9, z * 0.13) - 0.5) * th.rough * 0.5;
    return roadY + (base + bumps - roadY) * k;
  }

  private buildTerrain(minX: number, maxX: number, minZ: number, maxZ: number): void {
    const th = this.theme;
    const t = this.track;
    const flat = t.def.theme === 'nacht';
    const margin = flat ? 0 : 150;
    const cell = this.detail === 0 ? 11 : 7.5;
    const x0 = minX - margin;
    const z0 = minZ - margin;
    const nx = Math.max(1, Math.ceil((maxX - minX + 2 * margin) / cell));
    const nz = Math.max(1, Math.ceil((maxZ - minZ + 2 * margin) / cell));

    if (!flat) {
      const h = new Float32Array((nx + 1) * (nz + 1));
      for (let iz = 0; iz <= nz; iz++) {
        for (let ix = 0; ix <= nx; ix++) {
          // Zum Rand hin läuft das Gelände flach aus, damit es an die große Grundfläche anschließt.
          const edge = Math.min(ix, nx - ix, iz, nz - iz) / 5;
          const y = this.heightAt(x0 + ix * cell, z0 + iz * cell);
          h[iz * (nx + 1) + ix] = th.farY + (y - th.farY) * smooth(edge);
        }
      }
      const b = new MeshBuilder();
      const g = th.ground.map((c) => rgb(c));
      const rnd = seeded(77 + t.index);
      const P = (ix: number, iz: number): V3 => [x0 + ix * cell, h[iz * (nx + 1) + ix], z0 + iz * cell];
      const liquid = th.liquidY ?? -Infinity;
      const tri = (a: V3, bb: V3, c: V3): void => {
        const top = Math.max(a[1], bb[1], c[1]);
        if (top < liquid - 2.5) return;
        const ux = bb[0] - a[0];
        const uy = bb[1] - a[1];
        const uz = bb[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];
        const nxn = uy * vz - uz * vy;
        const nyn = uz * vx - ux * vz;
        const nzn = ux * vy - uy * vx;
        const up = nyn / Math.hypot(nxn, nyn, nzn);
        const mid = (a[1] + bb[1] + c[1]) / 3;
        let col: RGB;
        if (up < 0.8) col = g[2];
        else if (th.liquidY !== null && mid < liquid + 1.6) col = g[0];
        else if (mid > 12) col = mixRgb(g[1], g[3], smooth((mid - 12) / 6));
        else col = th.liquidY !== null ? g[1] : mixRgb(g[0], g[1], noise(a[0] * 0.03, a[2] * 0.03));
        b.tri(a, bb, c, shade(col, 0.94 + rnd() * 0.12));
      };
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const a = P(ix, iz);
          const bq = P(ix + 1, iz);
          const c = P(ix + 1, iz + 1);
          const d = P(ix, iz + 1);
          // Diagonale abwechselnd legen, damit kein Streifenmuster entsteht.
          if ((ix + iz) % 2 === 0) {
            tri(a, d, c);
            tri(a, c, bq);
          } else {
            tri(a, d, bq);
            tri(bq, d, c);
          }
        }
      }
      const mesh = new THREE.Mesh(b.build(), toonMaterial({ vertexColors: true }));
      this.group.add(mesh);
      this.disposables.push(mesh.geometry, mesh.material as THREE.Material);
    }

    // Große Grundfläche bis zum Horizont: Boden, Wasser oder Lava.
    // Nicht als ein einziges Riesenviereck: über Kilometer gespannte Dreiecke
    // verlieren beim Zeichnen so viel Tiefengenauigkeit, dass die Fläche bei
    // weitem Blickwinkel bildweise durch die Fahrbahn schlägt. Deshalb ein
    // Raster – rund um die Strecke fein, zum Horizont hin grob.
    const cuts = [-4500, -2200, -1200, -800, -600, -480, -400, -320, -240, -160, -80, 0, 80, 160, 240, 320, 400, 480, 600, 800, 1200, 2200, 4500];
    const plane = new THREE.BufferGeometry();
    const pv: number[] = [];
    const pu: number[] = [];
    const pi: number[] = [];
    const cn = cuts.length;
    for (let iz = 0; iz < cn; iz++) {
      for (let ix = 0; ix < cn; ix++) {
        pv.push(cuts[ix], 0, cuts[iz]);
        pu.push(cuts[ix] / 9000 + 0.5, 0.5 - cuts[iz] / 9000);
      }
    }
    for (let iz = 0; iz < cn - 1; iz++) {
      for (let ix = 0; ix < cn - 1; ix++) {
        const a = iz * cn + ix;
        pi.push(a, a + cn, a + 1, a + 1, a + cn, a + cn + 1);
      }
    }
    plane.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3));
    plane.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
    plane.setIndex(pi);
    plane.computeVertexNormals();
    let mat: THREE.Material;
    if (th.liquidY !== null) {
      const m = fogShader(LIQUID_FRAG, {
        time: { value: 0 },
        c0: { value: new THREE.Color(th.liquid[0]) },
        c1: { value: new THREE.Color(th.liquid[1]) },
        c2: { value: new THREE.Color(th.liquid[2]) },
      });
      this.timed.push(m);
      mat = m;
    } else {
      mat = new THREE.MeshBasicMaterial({ color: th.ground[0] });
      (mat as THREE.MeshBasicMaterial).color.multiplyScalar(flat ? 1 : 0.86);
    }
    const base = new THREE.Mesh(plane, mat);
    base.position.set(this.center.x, th.liquidY ?? th.farY - 0.2, this.center.z);
    this.group.add(base);
    this.disposables.push(plane, mat);
  }

  // --- Himmel ----------------------------------------------------------------

  private buildSky(): void {
    const th = this.theme;
    const R = 2600;
    const geo = new THREE.SphereGeometry(R, 24, 14);
    const pos = geo.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const top = rgb(th.sky[0]);
    const mid = rgb(th.sky[1]);
    const low = rgb(th.sky[2]);
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / R;
      const c = h > 0.12 ? mixRgb(mid, top, smooth((h - 0.12) / 0.55)) : mixRgb(low, mid, smooth((h + 0.04) / 0.16));
      col.set(c, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(geo, skyMat);
    sky.renderOrder = -10;
    this.skyGroup.add(sky);
    this.disposables.push(geo, skyMat);

    // Sonne oder Mond, mit gezeichnetem Strahlenkranz
    const dir = new THREE.Vector3(th.sunDir[0], th.sunDir[1], th.sunDir[2]).normalize();
    const discMat = new THREE.MeshBasicMaterial({ color: th.disc, fog: false, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(th.discSize * 3.2, 28), discMat);
    disc.position.copy(dir).multiplyScalar(R * 0.92);
    disc.lookAt(0, 0, 0);
    disc.renderOrder = -9;
    this.skyGroup.add(disc);
    this.disposables.push(disc.geometry, discMat);
    if (!th.stars) {
      const rays = new MeshBuilder();
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r0 = th.discSize * 3.9;
        const r1 = th.discSize * (i % 2 === 0 ? 6.4 : 5.2);
        const w = 0.09;
        rays.tri([Math.cos(a - w) * r0, Math.sin(a - w) * r0, 0], [Math.cos(a + w) * r0, Math.sin(a + w) * r0, 0], [Math.cos(a) * r1, Math.sin(a) * r1, 0], [1, 1, 1]);
      }
      const rayMat = new THREE.MeshBasicMaterial({ color: th.disc, fog: false, depthWrite: false, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const rayMesh = new THREE.Mesh(rays.build(), rayMat);
      rayMesh.position.copy(disc.position);
      rayMesh.quaternion.copy(disc.quaternion);
      rayMesh.renderOrder = -9;
      rayMesh.name = 'rays';
      this.skyGroup.add(rayMesh);
      this.disposables.push(rayMesh.geometry, rayMat);
    } else {
      const rnd = seeded(5);
      const pts = new Float32Array(360 * 3);
      for (let i = 0; i < 360; i++) {
        const a = rnd() * Math.PI * 2;
        const h = 0.08 + rnd() * 0.9;
        const r = Math.sqrt(1 - h * h);
        pts.set([Math.cos(a) * r * R * 0.95, h * R * 0.95, Math.sin(a) * r * R * 0.95], i * 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 });
      const stars = new THREE.Points(sg, sm);
      stars.renderOrder = -9;
      this.skyGroup.add(stars);
      this.disposables.push(sg, sm);
    }

    // Comic-Wolken: ein paar zusammengeschobene Kugeln mit Tuschekontur
    const rnd = seeded(31 + this.track.index);
    const count = this.detail === 0 ? 7 : 12;
    const puff = new THREE.IcosahedronGeometry(1, 1);
    const cb = new MeshBuilder();
    const cTop = rgb(th.clouds);
    const cLow = rgb(th.cloudShade);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.4;
      const dist = 900 + rnd() * 700;
      const y = 190 + rnd() * 300;
      const size = 55 + rnd() * 60;
      const parts = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < parts; k++) {
        const s = size * (0.6 + rnd() * 0.5);
        const off = (k - (parts - 1) / 2) * size * 0.8;
        m.compose(
          new THREE.Vector3(Math.cos(a) * dist - Math.sin(a) * off, y + (rnd() - 0.5) * size * 0.25, Math.sin(a) * dist + Math.cos(a) * off),
          new THREE.Quaternion(),
          new THREE.Vector3(s, s * 0.55, s),
        );
        cb.add(puff, k % 2 === 0 ? cTop : mixRgb(cTop, cLow, 0.35), m);
      }
    }
    puff.dispose();
    const cg = addSmoothNormals(cb.build());
    const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const cloudMesh = new THREE.Mesh(cg, cloudMat);
    this.clouds.add(cloudMesh);
    if (this.detail > 0) {
      const ol = new THREE.Mesh(cg, outlineMaterial(1.1));
      (ol.material as THREE.ShaderMaterial).fog = false;
      ol.name = 'outline';
      this.clouds.add(ol);
    }
    this.skyGroup.add(this.clouds);
    this.disposables.push(cg, cloudMat);
    this.group.add(this.skyGroup);
  }

  // --- Item-Kisten -----------------------------------------------------------

  private buildBoxes(): void {
    const n = this.track.boxes.length;
    if (n === 0) return;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffd23f';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#16131c';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 116, 116);
    // Emblem: ein Blitz – "hier steckt etwas drin".
    g.fillStyle = '#16131c';
    g.beginPath();
    g.moveTo(74, 18);
    g.lineTo(34, 70);
    g.lineTo(58, 70);
    g.lineTo(48, 110);
    g.lineTo(94, 54);
    g.lineTo(68, 54);
    g.closePath();
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = addSmoothNormals(new THREE.BoxGeometry(1.25, 1.25, 1.25));
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    this.boxMesh = new THREE.InstancedMesh(geo, mat, n);
    this.boxMesh.frustumCulled = false;
    this.group.add(this.boxMesh);
    if (this.detail > 0) {
      this.boxOutline = new THREE.InstancedMesh(geo, outlineMaterial(0.07), n);
      this.boxOutline.frustumCulled = false;
      this.boxOutline.name = 'outline';
      this.group.add(this.boxOutline);
    }
    this.disposables.push(geo, mat, tex);
  }

  // --- Pro Bild --------------------------------------------------------------

  update(time: number, dt: number, camera: THREE.Vector3, boxMask: number, fx: FxSink): void {
    for (const m of this.timed) m.uniforms.time.value = time;
    this.life?.update(time, dt, camera, fx);
    this.skyGroup.position.set(camera.x, 0, camera.z);
    this.clouds.rotation.y = time * 0.004;
    const rays = this.skyGroup.getObjectByName('rays');
    if (rays) rays.rotateZ(dt * 0.05);

    if (this.boxMesh) {
      const boxes = this.track.boxes;
      for (let i = 0; i < boxes.length; i++) {
        const want = (boxMask >>> i) & 1 ? 1 : 0;
        const cur = this.boxScale[i];
        // Einsammeln: sofort weg. Nachwachsen: mit einem kleinen Überschwinger.
        this.boxScale[i] = want === 0 ? 0 : Math.min(1, cur + dt * 3.2);
        const k = this.boxScale[i];
        const pop = k < 1 ? k * (1 + 0.35 * Math.sin(k * Math.PI)) : 1;
        const b = boxes[i];
        this.v.set(b.x, b.y + 1.15 + Math.sin(time * 2.2 + i * 1.7) * 0.14, b.z);
        this.euler.set(0.5, time * 1.4 + i, 0.35);
        this.q.setFromEuler(this.euler);
        this.s.setScalar(pop);
        this.m4.compose(this.v, this.q, this.s);
        this.boxMesh.setMatrixAt(i, this.m4);
        this.boxOutline?.setMatrixAt(i, this.m4);
      }
      this.boxMesh.instanceMatrix.needsUpdate = true;
      if (this.boxOutline) this.boxOutline.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.boxMesh?.dispose();
    this.boxOutline?.dispose();
  }
}
