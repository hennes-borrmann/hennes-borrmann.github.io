// Porträts der Figuren für Lobby und Listen – gerendert aus den echten
// Kart-Modellen in einem versteckten WebGL-Kontext.
//
// Es gibt höchstens einen solchen Kontext. Er entsteht beim ersten Aufruf und
// wird mit disposePortraits() wirklich freigegeben (Browser – vor allem iOS –
// erlauben nur wenige gleichzeitig, und das Rennen braucht seinen eigenen).
// Die fertigen Bilder sind Daten-URLs und bleiben danach gültig.

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
};

interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

let stage: Stage | null = null;
/** WebGL ließ sich nicht anlegen – nicht bei jedem Aufruf erneut versuchen. */
let unavailable = false;
const cache = new Map<string, string>();

function makeStage(): Stage | null {
  if (stage) return stage;
  if (unavailable || typeof document === 'undefined') return null;
  let renderer: THREE.WebGLRenderer;
  try {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    unavailable = true;
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // Licht wie im Spiel: Sonne schräg von oben vorn plus Himmelslicht.
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(40, 90, 70);
  scene.add(sun, new THREE.HemisphereLight(0xcfe9ff, 0x8a7a68, 1.3));
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  stage = { renderer, scene, camera };
  return stage;
}

/**
 * Porträt einer Figur in der Lackfarbe eines Platzes als Bild-URL (PNG, transparenter Hintergrund).
 * Synchron; Ergebnisse werden je (character, slot, size) gemerkt. Liefert '' , wenn WebGL nicht verfügbar ist.
 */
export function portraitUrl(character: number, slot: number, size = 256): string {
  const c = ((Math.floor(character) % 4) + 4) % 4;
  const s = ((Math.floor(slot) % 4) + 4) % 4;
  const px = Math.max(16, Math.min(2048, Math.round(size) || 256));
  const key = `${c}:${s}:${px}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const st = makeStage();
  if (!st) return '';
  const { renderer, scene, camera } = st;

  const kart = new KartVisual(c, 2, s);
  try {
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

    renderer.setSize(px, px, false);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    cache.set(key, url);
    return url;
  } catch {
    return '';
  } finally {
    kart.dispose();
  }
}

/** Gibt den versteckten Renderer wieder frei (die gemerkten Bilder bleiben gültig). */
export function disposePortraits(): void {
  if (!stage) return;
  const { renderer } = stage;
  stage = null;
  renderer.dispose();
  renderer.forceContextLoss();
}
