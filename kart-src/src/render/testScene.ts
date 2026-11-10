// Die Testszene von Phase 1: eine Fläche mit Bande, pro Spieler ein Würfel.
// Bewusst schlicht – die richtige Grafik kommt in Phase 3. Die Schnittstelle
// (Spielerliste setzen, pro Bild Fahrzeuge übergeben) bleibt dieselbe.

import * as THREE from 'three';
import { ARENA_HALF, FLAG_DRIFT } from '../game/sim';
import type { RenderEntity } from '../game/view';
import { playerColor } from '../util/players';

export type CameraMode = 'chase' | 'top';

interface Car {
  group: THREE.Group;
  body: THREE.Group;
  shadow: THREE.Mesh;
  label: THREE.Sprite;
  labelText: string;
  roll: number;
}

function groundTexture(): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b1f24';
  g.fillRect(0, 0, size, size);
  const cells = (ARENA_HALF * 2) / 5;
  const step = size / cells;
  for (let i = 0; i <= cells; i++) {
    const major = i % 3 === 0;
    g.strokeStyle = major ? '#343b45' : '#262b32';
    g.lineWidth = major ? 3 : 1.5;
    g.beginPath();
    g.moveTo(i * step, 0);
    g.lineTo(i * step, size);
    g.moveTo(0, i * step);
    g.lineTo(size, i * step);
    g.stroke();
  }
  // Mittelkreis und Startlinie als Orientierung
  g.strokeStyle = '#4a525e';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(size / 2, size / 2, step * 2, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '600 64px system-ui, -apple-system, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(12,14,16,0.85)';
  g.strokeText(text, 256, 66);
  g.fillStyle = color;
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class TestScene {
  cameraMode: CameraMode = 'chase';

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  private readonly cars = new Map<number, Car>();
  private readonly observer: ResizeObserver;
  private camHeading = 0;
  private camReady = false;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color('#0f1215');
    this.scene.fog = new THREE.Fog('#0f1215', 70, 190);

    this.scene.add(new THREE.HemisphereLight('#e6edf7', '#1a1d22', 1.15));
    const sun = new THREE.DirectionalLight('#fff4e0', 1.7);
    sun.position.set(30, 60, -20);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: '#111417', roughness: 1 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    this.scene.add(apron);

    // Bande
    const wallMat = new THREE.MeshStandardMaterial({ color: '#39414b', roughness: 0.8 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.6 });
    const len = ARENA_HALF * 2 + 1;
    for (const [x, z, rot] of [
      [0, ARENA_HALF, 0],
      [0, -ARENA_HALF, 0],
      [ARENA_HALF, 0, Math.PI / 2],
      [-ARENA_HALF, 0, Math.PI / 2],
    ] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 1), wallMat);
      wall.position.set(x, 0.55, z);
      wall.rotation.y = rot;
      this.scene.add(wall);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 1.02), capMat);
      cap.position.set(x, 1.16, z);
      cap.rotation.y = rot;
      this.scene.add(cap);
    }

    // Vier verschiedenfarbige Ecktürme, damit man sich beim Fahren orientieren kann.
    const corners: [number, number, string][] = [
      [1, 1, '#ff5a4e'],
      [-1, 1, '#1fc8b6'],
      [1, -1, '#9b87ff'],
      [-1, -1, '#f2efe6'],
    ];
    for (const [sx, sz, color] of corners) {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 12, 2.4),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
      );
      tower.position.set(sx * ARENA_HALF, 6, sz * ARENA_HALF);
      this.scene.add(tower);
    }

    // Ein paar Pylonen auf der Fläche als Bezugspunkte für Tempo und Kurven.
    const coneGeo = new THREE.ConeGeometry(0.45, 1.3, 10);
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff8a3d', roughness: 0.7 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(Math.sin(a) * 26, 0.65, Math.cos(a) * 26);
      this.scene.add(cone);
    }

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  /** Legt Würfel für die aktuellen Spieler an und entfernt die der gegangenen. */
  setRoster(players: { slot: number; name: string }[]): void {
    const seen = new Set<number>();
    for (const p of players) {
      seen.add(p.slot);
      let car = this.cars.get(p.slot);
      if (!car) {
        car = this.createCar(p.slot, p.name);
        this.cars.set(p.slot, car);
      } else if (car.labelText !== p.name) {
        this.setLabel(car, p.slot, p.name);
      }
    }
    for (const [slot, car] of this.cars) {
      if (seen.has(slot)) continue;
      this.scene.remove(car.group, car.shadow);
      this.cars.delete(slot);
    }
  }

  frame(entities: RenderEntity[], localSlot: number, dtSec: number): void {
    const shown = new Set<number>();
    let local: RenderEntity | null = null;
    for (const e of entities) {
      const car = this.cars.get(e.slot);
      if (!car) continue;
      shown.add(e.slot);
      car.group.visible = true;
      car.shadow.visible = true;
      car.group.position.set(e.x, e.y, e.z);
      car.group.rotation.y = e.heading;
      // Beim Driften neigt sich der Würfel – so sieht man die Drift-Taste auf allen Bildschirmen.
      const targetRoll = (e.flags & FLAG_DRIFT) !== 0 ? 0.22 : 0;
      car.roll += (targetRoll - car.roll) * Math.min(1, dtSec * 12);
      car.body.rotation.z = car.roll;
      car.shadow.position.set(e.x, 0.02, e.z);
      const sh = 1 / (1 + e.y * 0.35);
      car.shadow.scale.setScalar(sh);
      (car.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * sh;
      if (e.slot === localSlot) local = e;
    }
    for (const [slot, car] of this.cars) {
      if (shown.has(slot)) continue;
      car.group.visible = false;
      car.shadow.visible = false;
    }
    this.updateCamera(local, dtSec);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------------

  private resize(): void {
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const h = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private createCar(slot: number, name: string): Car {
    const color = playerColor(slot);
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);

    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.8, 2.3),
      new THREE.MeshStandardMaterial({ color, roughness: 0.45 }),
    );
    chassis.position.y = 0.55;
    body.add(chassis);

    // Helle Nase vorn: zeigt die Fahrtrichtung.
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.34, 0.5),
      new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.5 }),
    );
    nose.position.set(0, 0.5, 1.3);
    body.add(nose);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.5, 0.9),
      new THREE.MeshStandardMaterial({ color: '#14171a', roughness: 0.3 }),
    );
    cabin.position.set(0, 1.15, -0.35);
    body.add(cabin);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 20),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    label.scale.set(5, 1.25, 1);
    label.position.y = 2.6;
    group.add(label);

    const car: Car = { group, body, shadow, label, labelText: '', roll: 0 };
    this.setLabel(car, slot, name);
    group.visible = false;
    shadow.visible = false;
    this.scene.add(group, shadow);
    return car;
  }

  private setLabel(car: Car, slot: number, name: string): void {
    const mat = car.label.material;
    mat.map?.dispose();
    mat.map = labelTexture(name, playerColor(slot));
    mat.needsUpdate = true;
    car.labelText = name;
  }

  private updateCamera(local: RenderEntity | null, dtSec: number): void {
    if (this.cameraMode === 'top' || !local) {
      // Übersicht: so hoch, dass die ganze Fläche ins Bild passt.
      const fov = (this.camera.fov * Math.PI) / 180;
      const fit = ARENA_HALF + 3;
      const byHeight = fit / Math.tan(fov / 2);
      const byWidth = fit / (Math.tan(fov / 2) * this.camera.aspect);
      this.camera.position.set(0, Math.max(byHeight, byWidth), 0.01);
      this.camera.up.set(0, 0, 1);
      this.camera.lookAt(0, 0, 0);
      this.camReady = false;
      return;
    }
    this.camera.up.set(0, 1, 0);
    if (!this.camReady) {
      this.camHeading = local.heading;
    } else {
      let d = local.heading - this.camHeading;
      if (d > Math.PI) d -= 2 * Math.PI;
      else if (d < -Math.PI) d += 2 * Math.PI;
      this.camHeading += d * Math.min(1, dtSec * 7);
    }
    const fx = Math.sin(this.camHeading);
    const fz = Math.cos(this.camHeading);
    this.camPos.set(local.x - fx * 8.5, 4.2 + local.y * 0.4, local.z - fz * 8.5);
    this.camLook.set(local.x + fx * 5, 1 + local.y * 0.5, local.z + fz * 5);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camReady = true;
  }
}
