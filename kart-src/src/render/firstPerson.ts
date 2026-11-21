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
  head: 0.3,
  /** Senkrechter Bildwinkel (Grad) im Stand, Zuschlag bei Höchsttempo und mit Schub. */
  fov: 74,
  fovSpeed: 5,
  fovBoost: 7,
  /** Roboter: so weit höher und nach vorn sitzt die Kamera (Meter), so viel steiler blickt sie abwärts (rad). */
  robotUp: 0.45,
  robotFwd: 0.35,
  robotPitch: 0.25,
  /** Rakete: so weit entlang der Achse sitzt die Kamera (Meter). */
  rocketNose: 2.9,
  rocketSide: 0.8,
};

/** Was man im Sitz spürt (für Rütteln, Horizont, Turbo-Stoß). */
export interface CockpitFeel {
  /** Driftrichtung (−1, 0, 1) und aufgeladene Turbo-Stufe (0 … 3). */
  drift: number;
  stage: number;
  /** Loser Untergrund (Sand, Schotter, Schnee …) bzw. neben der Fahrbahn. */
  loose: boolean;
  offroad: boolean;
  /** Anteil, um den der Horizont gerade gehalten wird (0 = Kamera kippt ganz mit dem Kart). */
  level: number;
}
const NO_FEEL: CockpitFeel = { drift: 0, stage: 0, loose: false, offroad: false, level: 0 };
const _f = new THREE.Vector3();
const _x = new THREE.Vector3(1, 0, 0);
const _t = new THREE.Vector3();
const _m = new THREE.Matrix4();

function smooth(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _c = new THREE.Vector3();

const Y_FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const _qa = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
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
  private time = 0;
  private glance = 0;
  private rumble = 0;
  private kick = 0;
  private driftWas = 0;

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
    this.kit.setOutlines(this.mirrorEvery > 0);
    this.kit.update(this.kart.cockpit, state, dt);
  }

  /**
   * Stellt die Welt-Kamera camera in den Kopf des eigenen Karts. rig: Knochen des Karts (nach KartVisual.update).
   * speed01: Tempo als Anteil des Höchsttempos; boost: Schub aktiv; feel: was man im Sitz spürt.
   */
  place(camera: THREE.PerspectiveCamera, rig: CockpitRig, character: number, speed01: number, boost: boolean, dt: number, feel: CockpitFeel = NO_FEEL): void {
    rig.root.updateMatrixWorld(true);
    const eye = FP_EYE[character] ?? FP_EYE[0];
    // (Der Kopf ist auf fast null geschrumpft: Ort und Drehung des Knochens nehmen, nicht seine Skalierung.)
    rig.head.getWorldQuaternion(_qb);
    rig.head.getWorldPosition(camera.position);
    camera.position.add(_v.set(eye[0], eye[1], eye[2]).applyQuaternion(_qb).multiplyScalar(rig.root.scale.y));
    // Roboter: Die Figur sitzt obenauf, davor ragen Brust und Schultern (die aufgestellte Karosserie) auf – die Kamera
    // rückt höher und über die Brust nach vorn und schaut von oben über den Mech.
    const rob = rig.robotLook;
    if (rob > 0.001) {
      rig.root.getWorldQuaternion(_qc);
      camera.position.add(_v.set(0, FP_TUNE.robotUp, FP_TUNE.robotFwd).applyQuaternion(_qc).multiplyScalar(rob * rig.root.scale.y));
    }
    rig.chassis.getWorldQuaternion(_qa);
    _qa.slerp(_qb, FP_TUNE.head).multiply(Y_FLIP);
    camera.quaternion.copy(_qa);
    camera.up.set(0, 1, 0).applyQuaternion(_qa);
    camera.rotateX(-FP_TUNE.pitch - FP_TUNE.robotPitch * rob);
    // Bohrer: Beim Einstecken schaut die Figur hin – die Kamera dreht sich zum Bohrer neben dem Kart und folgt ihm in
    // den Boden (Gewicht: hinschauen bis zur Hälfte, beim Hineinrammen am stärksten, danach zurück auf die Strecke).
    const p = rig.plant;
    const look = p > 0 ? smooth(p / 0.3) * (1 - smooth((p - 0.9) / 0.1)) * 0.45 : 0;
    this.glance += (look - this.glance) * Math.min(1, dt * (look > this.glance ? 10 : 5));
    if (this.glance > 0.002) {
      rig.prop.getWorldPosition(_t);
      _m.lookAt(camera.position, _t, camera.up);
      _qa.setFromRotationMatrix(_m);
      camera.quaternion.slerp(_qa, this.glance);
    }
    this.time += dt;
    // Horizont halb ausgleichen: Der Kopf hält die Welt gerader, als das Kart sich legt (nicht an der Wand – dort kippt
    // „oben“ ganz mit, wie in der Verfolgeransicht).
    if (feel.level > 0) {
      _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
      _w.set(0, 1, 0).addScaledVector(_f, -_f.y);
      if (_w.lengthSq() > 1e-4) {
        _w.normalize();
        const roll = Math.atan2(_f.dot(_c.crossVectors(_u, _w)), _u.dot(_w));
        camera.quaternion.premultiply(_qa.setFromAxisAngle(_f, roll * feel.level));
      }
    }
    // Rütteln: loser Untergrund, Grünstreifen, Drift (je Stufe mehr) – kleine, schnelle Drehungen, kein Wackeln der Lage.
    const rough = (feel.loose ? 0.0035 : 0) + (feel.offroad ? 0.006 : 0) + (feel.drift !== 0 ? 0.0022 + feel.stage * 0.0012 : 0);
    this.rumble += (rough * Math.min(1, speed01) - this.rumble) * Math.min(1, dt * 10);
    // Mini-Turbo: Drift endet mit Schub → kurzer Stoß nach hinten in den Sitz.
    if (this.driftWas !== 0 && feel.drift === 0 && boost) this.kick = 1;
    this.driftWas = feel.drift;
    this.kick = Math.max(0, this.kick - dt * 3.2);
    if (this.rumble > 1e-5 || this.kick > 0) {
      const t = this.time;
      const r = this.rumble;
      const kick = this.kick * this.kick;
      camera.rotateX(r * (Math.sin(t * 61) + 0.6 * Math.sin(t * 97 + 1)) + kick * 0.05);
      camera.rotateY(r * 0.7 * Math.sin(t * 73 + 2));
      camera.rotateZ(r * 0.5 * Math.sin(t * 53 + 3) + (feel.drift !== 0 ? -feel.drift * 0.012 * (1 + feel.stage * 0.3) : 0));
    }
    const want = FP_TUNE.fov + Math.min(1.3, speed01) * FP_TUNE.fovSpeed + (boost ? FP_TUNE.fovBoost : 0) + this.kick * 6;
    this.fov += (want - this.fov) * Math.min(1, dt * 5);
    if (Math.abs(camera.fov - this.fov) > 0.05) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Rakete aus dem Cockpit: Während der Verwandlung richtet sich das Kart auf, und der Blick geht mit nach oben in den
   * Himmel; im Flug sitzt die Kamera an der Spitze und schaut in Flugrichtung – beim Sturz kommt das Ziel auf einen zu.
   * morph: Fortschritt der Verwandlung (0 … 1), flying: fliegt schon. Erst place() aufrufen (Kopf-Kamera als Ausgang).
   */
  placeRocket(camera: THREE.PerspectiveCamera, rig: CockpitRig, morph: number, flying: boolean, dt: number): void {
    rig.root.getWorldQuaternion(_qa);
    // Kamera schaut entlang −z: so drehen, dass sie entlang +y der Rakete schaut, „oben“ = +z des Karts.
    _qa.multiply(_qb.setFromAxisAngle(_x, Math.PI / 2));
    rig.root.getWorldPosition(_t);
    _f.set(0, 1, 0).applyQuaternion(rig.root.quaternion);
    const k = flying ? 1 : smooth(morph * 1.2 - 0.2);
    // (Außen am Rumpf, knapp unter der Spitze: Die Spitze liegt unten im Bild, der Blick geht an ihr vorbei.)
    _t.addScaledVector(_f, FP_TUNE.rocketNose * k).addScaledVector(_u.set(0, 0, 1).applyQuaternion(rig.root.quaternion), FP_TUNE.rocketSide * k);
    camera.position.lerp(_t, k);
    camera.quaternion.slerp(_qa, k);
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    // Rütteln im Flug, stärker beim Zünden.
    this.time += dt;
    const r = flying ? 0.006 : 0.012 * k;
    camera.rotateX(r * Math.sin(this.time * 71));
    camera.rotateY(r * Math.sin(this.time * 59 + 1));
    const want = flying ? 80 : FP_TUNE.fov;
    this.fov += (want - this.fov) * Math.min(1, dt * 3);
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
