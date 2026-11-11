// Porträts der Figuren für Lobby und Listen – gerendert aus den echten
// Kart-Modellen.
//
// Die Seite hat genau einen WebGL-Kontext: den der Rennszene. Er entsteht beim
// Laden und bleibt. Die Porträts werden mit ihm in eine Zwischenfläche
// gezeichnet und von dort ausgelesen. Früher hatten sie einen eigenen Kontext,
// der vor jedem Rennen freigegeben wurde – auf einem iPad (10. Generation)
// kam der Kontext des Rennens danach schon „verloren“ an.
// Die fertigen Bilder sind Daten-URLs und bleiben gültig.

import * as THREE from 'three';
import { KartVisual } from './kartModel';
import type { KartPose } from './kartModel';

/** Bildausschnitt je Figur: Blickziel (Kart-Koordinaten) und Abstand der Kamera. */
interface Frame {
  look: readonly [number, number, number];
  dist: number;
}

// Kamera von schräg vorn links (das Kart schaut nach +z, „links“ ist +x),
// leicht von oben. Die Ausschnitte sind je Figur abgestimmt, damit Ohren,
// Helm und Zündkerzen ins Bild passen und die Figur das Quadrat füllt.
const YAW = THREE.MathUtils.degToRad(32);
const PITCH = THREE.MathUtils.degToRad(13);
const FOV = 30;
const FRAMES: Frame[] = [
  { look: [0, 0.97, -0.2], dist: 3.35 }, // Kolben-Kalle
  { look: [0, 0.98, -0.15], dist: 3.4 }, // Vera Vergaser: lange Ohren
  { look: [0, 0.95, -0.15], dist: 3.2 }, // Bremsen-Bert
  { look: [0, 0.96, -0.15], dist: 3.35 }, // Zünd-Zoe
];

const REST: KartPose = {
  speed: 0,
  steer: 0,
  driftDir: 0,
  driftStage: 0,
  boost: false,
  air: false,
  spin: 0,
  guard: false,
  stall: false,
  offroad: false,
  emote: 'none',
  held: 0,
  tow: false,
  glide: false,
  dive: false,
  space: false,
};

interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Zwischenfläche in der zuletzt verlangten Größe. */
  target: THREE.WebGLRenderTarget | null;
  pixels: Uint8Array;
  canvas: HTMLCanvasElement;
}

/** Der eine Renderer der Seite (gehört der Rennszene). */
let shared: THREE.WebGLRenderer | null = null;
let stage: Stage | null = null;
const cache = new Map<string, string>();
const keep = new THREE.Color();

/** Linear → sRGB für Werte 0 … 255 (die Zwischenfläche speichert linear, ein Bild will sRGB). */
const TO_SRGB = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_SRGB[i] = Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
}

/** Nennt den Renderer, mit dem die Porträts gezeichnet werden (null: zurzeit keiner – es entstehen keine neuen Bilder). */
export function setPortraitRenderer(renderer: THREE.WebGLRenderer | null): void {
  if (renderer === shared) return;
  shared = renderer;
  // Die Zwischenfläche gehört zum alten Kontext.
  stage?.target?.dispose();
  if (stage) stage.target = null;
}

function makeStage(): Stage | null {
  if (stage) return stage;
  if (typeof document === 'undefined') return null;
  const scene = new THREE.Scene();
  // Licht wie im Spiel: Sonne schräg von oben vorn plus Himmelslicht.
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(40, 90, 70);
  scene.add(sun, new THREE.HemisphereLight(0xcfe9ff, 0x8a7a68, 1.3));
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  stage = { scene, camera, target: null, pixels: new Uint8Array(0), canvas: document.createElement('canvas') };
  return stage;
}

/**
 * Porträt einer Figur in der Lackfarbe eines Platzes als Bild-URL (PNG, transparenter Hintergrund).
 * Synchron; Ergebnisse werden je (character, slot, size) gemerkt. Liefert '', solange kein Renderer bereitsteht.
 */
export function portraitUrl(character: number, slot: number, size = 256): string {
  const c = ((Math.floor(character) % 4) + 4) % 4;
  const s = ((Math.floor(slot) % 4) + 4) % 4;
  const px = Math.max(16, Math.min(1024, Math.round(size) || 256));
  const key = `${c}:${s}:${px}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const renderer = shared;
  const st = makeStage();
  if (!renderer || !st) return '';
  const { scene, camera } = st;

  const kart = new KartVisual(c, 2, s);
  const before = renderer.getRenderTarget();
  const alpha = renderer.getClearAlpha();
  renderer.getClearColor(keep);
  try {
    if (renderer.getContext().isContextLost()) return '';
    scene.add(kart.root);
    // Ruhepose einschwingen lassen (Federn, Kopf); die Augen sind dabei offen –
    // das erste Blinzeln kommt frühestens nach zwei Sekunden.
    for (let i = 0; i < 40; i++) kart.update(1 / 60, REST);

    const f = FRAMES[c];
    camera.position.set(
      f.look[0] + Math.sin(YAW) * Math.cos(PITCH) * f.dist,
      f.look[1] + Math.sin(PITCH) * f.dist,
      f.look[2] + Math.cos(YAW) * Math.cos(PITCH) * f.dist,
    );
    camera.lookAt(f.look[0], f.look[1], f.look[2]);
    camera.aspect = 1;
    camera.updateProjectionMatrix();

    if (!st.target || st.target.width !== px) {
      st.target?.dispose();
      st.target = new THREE.WebGLRenderTarget(px, px, { samples: 4 });
      st.pixels = new Uint8Array(px * px * 4);
      st.canvas.width = st.canvas.height = px;
    }
    renderer.setRenderTarget(st.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(st.target, 0, 0, px, px, st.pixels);

    // Die Zwischenfläche liefert die Zeilen von unten nach oben, linear und mit vormultiplizierter Deckkraft.
    const g = st.canvas.getContext('2d');
    if (!g) return '';
    const img = g.createImageData(px, px);
    const src = st.pixels;
    const dst = img.data;
    let drawn = false;
    for (let y = 0; y < px; y++) {
      let i = (px - 1 - y) * px * 4;
      let o = y * px * 4;
      for (let x = 0; x < px; x++, i += 4, o += 4) {
        const a = src[i + 3];
        if (a === 0) continue;
        drawn = true;
        const k = 255 / a;
        dst[o] = TO_SRGB[Math.min(255, Math.round(src[i] * k))];
        dst[o + 1] = TO_SRGB[Math.min(255, Math.round(src[i + 1] * k))];
        dst[o + 2] = TO_SRGB[Math.min(255, Math.round(src[i + 2] * k))];
        dst[o + 3] = a;
      }
    }
    // Nichts gezeichnet (Kontext unterwegs verloren): kein leeres Bild merken – später noch einmal versuchen.
    if (!drawn) return '';
    g.putImageData(img, 0, 0);
    const url = st.canvas.toDataURL('image/png');
    cache.set(key, url);
    return url;
  } catch {
    return '';
  } finally {
    renderer.setRenderTarget(before);
    renderer.setClearColor(keep, alpha);
    kart.dispose();
  }
}
