// Cockpit-Ansicht: der Blick aus dem Fahrersitz des eigenen Karts.
//
// Gezeichnet wird das echte eigene Kart (kartModel.ts) – Lenkrad, Arme, Haube, Vorderräder und alles, was Items daraus
// machen (Roboter, Rakete, Flügel, Flasche, Bohrer), stimmt so von selbst mit dem Spiel überein. Die Kamera sitzt im Kopf
// der Figur (der Kopf ist dafür ausgeblendet) und erbt seine Bewegungen gedämpft: Er federt nach, schaut in die Kurve,
// wird beim Schub in den Sitz gedrückt.
//
// Zwei Durchgänge: Erst die Welt mit der normalen Kamera, dann – Tiefenpuffer geleert – das eigene Kart mit einer Kamera
// gleicher Lage, aber sehr naher Nahgrenze. Sonst schnitte die Nahgrenze Lenkrad und Hände ab, und eine nähere Nahgrenze
// für alles kostete hinten Genauigkeit im Tiefenpuffer (Flimmern weit entfernter Flächen). Dass das eigene Kart dabei immer
// vor der Welt liegt, sieht man aus dem Sitz nicht.
//
// Dazu kommen eigene Teile, die nur in dieser Ansicht zu sehen sind: Handschuhe mit Fingern statt der Kugelhände,
// Armaturen und der Rückspiegel.

import * as THREE from 'three';
import type { CockpitRig, KartVisual } from './kartModel';
import { CockpitKit, type CockpitState } from './cockpitKit';

export type { CockpitState };

/** Ebene, auf der in der Cockpit-Ansicht das eigene Kart liegt (die Welt-Kamera sieht sie nicht). */
export const COCKPIT_LAYER = 6;

/**
 * Lage der Kamera je Figur: Augenpunkt im Raum des Kopfknochens und wie weit sie nach unten blickt (rad). Die Köpfe der
 * Figuren sind groß (Comic); säße die Kamera auf Augenhöhe, läge das Lenkrad unter dem Bildrand – sie sitzt daher etwas
 * tiefer, etwa auf Höhe des Kinns, und schaut leicht abwärts: Strecke oben, Lenkrad und Hände unten im Bild.
 */
export const FP_EYE: [number, number, number][] = [
  [0, 0.33, 0],
  [0, 0.33, 0],
  [0, 0.33, 0],
  [0, 0.33, 0],
];
export const FP_TUNE = {
  /** Abwärtsblick (rad). */
  pitch: 0.28,
  /** Anteil der Kopfdrehung, den die Kamera mitmacht (der Rest ist die Lage der Karosserie). */
  head: 0.4,
  /** Senkrechter Bildwinkel (Grad) im Stand, Zuschlag bei Höchsttempo und mit Schub. */
  fov: 74,
  fovSpeed: 5,
  fovBoost: 7,
};

const Y_FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _v = new THREE.Vector3();

export class Cockpit {
  /** Kamera des zweiten Durchgangs (nur das eigene Kart). */
  readonly cam = new THREE.PerspectiveCamera(70, 1.6, 0.02, 120);
  private fov = FP_TUNE.fov;
  /** Ist die Cockpit-Ansicht in diesem Bild aktiv? */
  active = false;
  /** Rückspiegel: 0 aus, sonst alle wie viele Bilder er neu gezeichnet wird (Qualitätsstufe, siehe raceScene.ts). */
  mirrorEvery = 2;
  private mirrorTick = 0;
  private kart: KartVisual | null = null;
  private kit: CockpitKit | null = null;

  constructor() {
    this.cam.layers.set(COCKPIT_LAYER);
  }

  /**
   * Das eigene Kart für dieses Bild (null = keine Cockpit-Ansicht): legt es auf die Cockpit-Ebene, hängt Handschuhe,
   * Lenkrad, Armaturen und Spiegel an. Ein anderes Kart (neue Figur) bekommt neue Teile.
   */
  setKart(kart: KartVisual | null, accent: number): void {
    if (this.kart && this.kart !== kart) {
      this.kit?.attach(null);
      this.kart.root.traverse((o) => o.layers.set(0));
    }
    if (kart && this.kit && (this.kit.character !== kart.character || this.kit.slot !== kart.slot)) {
      this.kit.dispose();
      this.kit = null;
    }
    if (kart && !this.kit) this.kit = new CockpitKit(kart.character, kart.slot, accent, [256, 80]);
    this.kart = kart;
    if (!kart) return;
    this.kit!.attach(kart.cockpit);
    kart.root.traverse((o) => o.layers.set(COCKPIT_LAYER));
  }

  /** Nach KartVisual.update: Handschuhe, Tacho, Lampen. */
  update(state: CockpitState, dt: number): void {
    if (!this.kart || !this.kit) return;
    this.kit.update(this.kart.cockpit, state, dt);
  }

  /**
   * Stellt die Welt-Kamera camera in den Kopf des eigenen Karts. rig: Knochen des Karts (nach KartVisual.update).
   * speed01: Tempo als Anteil des Höchsttempos; boost: Schub aktiv.
   */
  place(camera: THREE.PerspectiveCamera, rig: CockpitRig, character: number, speed01: number, boost: boolean, dt: number): void {
    rig.root.updateMatrixWorld(true);
    const eye = FP_EYE[character] ?? FP_EYE[0];
    // (Der Kopf ist auf fast null geschrumpft: Ort und Drehung des Knochens nehmen, nicht seine Skalierung.)
    rig.head.getWorldQuaternion(_qb);
    rig.head.getWorldPosition(camera.position);
    camera.position.add(_v.set(eye[0], eye[1], eye[2]).applyQuaternion(_qb).multiplyScalar(rig.root.scale.y));
    rig.chassis.getWorldQuaternion(_qa);
    _qa.slerp(_qb, FP_TUNE.head).multiply(Y_FLIP);
    camera.quaternion.copy(_qa);
    camera.up.set(0, 1, 0).applyQuaternion(_qa);
    camera.rotateX(-FP_TUNE.pitch);
    const want = FP_TUNE.fov + Math.min(1.3, speed01) * FP_TUNE.fovSpeed + (boost ? FP_TUNE.fovBoost : 0);
    this.fov += (want - this.fov) * Math.min(1, dt * 5);
    if (Math.abs(camera.fov - this.fov) > 0.05) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Rückspiegel: die Welt nach hinten, klein und nur jedes mirrorEvery-te Bild. Vor dem zweiten Durchgang aufrufen.
   * Gibt die Zahl der Zeichenaufrufe zurück.
   */
  renderMirror(renderer: THREE.WebGLRenderer, scene: THREE.Scene): number {
    const kit = this.kit;
    if (!this.active || !kit || !this.kart || this.mirrorEvery <= 0) return 0;
    kit.mirror.visible = true;
    if (++this.mirrorTick % this.mirrorEvery !== 0) return 0;
    const rig = this.kart.cockpit;
    const cam = kit.mirrorCam;
    rig.chassis.localToWorld(cam.position.copy(kit.mirrorAt));
    // Nach hinten (die Kamera schaut entlang −z; das Kart nach +z) und eine Spur abwärts.
    rig.chassis.getWorldQuaternion(cam.quaternion);
    cam.rotateX(-0.05);
    cam.updateMatrixWorld();
    const before = renderer.getRenderTarget();
    renderer.setRenderTarget(kit.mirrorTarget);
    renderer.render(scene, cam);
    renderer.setRenderTarget(before);
    return renderer.info.render.calls;
  }

  /** Zweiter Durchgang: Tiefenpuffer leeren, nur das eigene Kart zeichnen. Gibt die Zahl der Zeichenaufrufe zurück. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): number {
    if (!this.active || !this.kart) return 0;
    if (this.kit) this.kit.mirror.visible = this.mirrorEvery > 0;
    const cam = this.cam;
    cam.position.copy(camera.position);
    cam.quaternion.copy(camera.quaternion);
    if (cam.fov !== camera.fov || cam.aspect !== camera.aspect) {
      cam.fov = camera.fov;
      cam.aspect = camera.aspect;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
    const bg = scene.background;
    const auto = renderer.autoClear;
    scene.background = null;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, cam);
    renderer.autoClear = auto;
    scene.background = bg;
    return renderer.info.render.calls;
  }

  dispose(): void {
    this.setKart(null, 0);
    this.kit?.dispose();
    this.kit = null;
  }
}
