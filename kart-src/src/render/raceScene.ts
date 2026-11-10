// Darstellung des Rennens: Strecke, Karts, Items und einfache Effekte.
// Bewusst schlicht gehalten – der eigentliche Look kommt in Phase 3. Die
// Schnittstelle (Spielerliste setzen, pro Bild den Spielstand übergeben)
// bleibt dabei dieselbe.

import * as THREE from 'three';
import { FLAG_OFFROAD, SPIN_TICKS, turboStage } from '../game/sim';
import { PAD_HALF_WIDTH, PAD_LENGTH, TRACK, rightX, rightZ, trackHeading, wrapSeg } from '../game/track';
import type { RaceView, RenderEntity } from '../game/view';
import type { SnapshotOil, SnapshotTire } from '../net/protocol';
import { playerColor } from '../util/players';

export type CameraMode = 'chase' | 'top';

/** Funkenfarbe je Stufe des Mini-Turbos (0 = noch nicht geladen). */
const SPARK_COLORS: [number, number, number][] = [
  [0.16, 0.16, 0.17],
  [0.25, 0.9, 1.0],
  [1.0, 0.8, 0.2],
  [1.0, 0.3, 0.85],
];

interface Car {
  group: THREE.Group;
  body: THREE.Group;
  shadow: THREE.Mesh;
  label: THREE.Sprite;
  labelText: string;
  lean: number;
  hop: number;
  wasDrifting: boolean;
  sparkCarry: number;
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  return canvasTexture(512, 128, (g) => {
    g.font = '600 60px system-ui, -apple-system, "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(12,14,16,0.85)';
    g.strokeText(text, 256, 66);
    g.fillStyle = color;
    g.fillText(text, 256, 66);
  });
}

/** Band entlang der Strecke zwischen zwei seitlichen Abständen. */
function ribbon(latA: number, latB: number, yA: number, yB: number): THREE.BufferGeometry {
  const t = TRACK;
  const pos = new Float32Array((t.n + 1) * 6);
  const idx: number[] = [];
  for (let i = 0; i <= t.n; i++) {
    const s = i % t.n;
    const rx = rightX(t, s);
    const rz = rightZ(t, s);
    pos.set([t.px[s] + rx * latA, yA, t.pz[s] + rz * latA, t.px[s] + rx * latB, yB, t.pz[s] + rz * latB], i * 6);
    if (i < t.n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Viele kleine Rechtecke auf der Fahrbahn (Mittelstriche) als ein Netz. */
function dashes(every: number, length: number, halfWidth: number, y: number): THREE.BufferGeometry {
  const t = TRACK;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < t.n; i += every) {
    const a = i;
    const b = wrapSeg(t, i + length);
    const base = pos.length / 3;
    for (const s of [a, b]) {
      const rx = rightX(t, s);
      const rz = rightZ(t, s);
      pos.push(t.px[s] - rx * halfWidth, y, t.pz[s] - rz * halfWidth, t.px[s] + rx * halfWidth, y, t.pz[s] + rz * halfWidth);
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Einfache Teilchen für Funken, Flammen und Staub. */
class Particles {
  readonly points: THREE.Points;
  private readonly max = 700;
  private readonly pos = new Float32Array(this.max * 3);
  private readonly col = new Float32Array(this.max * 3);
  private readonly base = new Float32Array(this.max * 3);
  private readonly vel = new Float32Array(this.max * 3);
  private readonly life = new Float32Array(this.max);
  private readonly span = new Float32Array(this.max);
  private next = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pos.fill(-9999);
    // Runde, weich auslaufende Punkte statt harter Quadrate.
    const dot = canvasTexture(64, 64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    });
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.55,
        map: dot,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, c: [number, number, number], life: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.base.set(c, i * 3);
    this.life[i] = life;
    this.span[i] = life;
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      if (this.life[i] <= 0) {
        this.pos[o + 1] = -9999;
        continue;
      }
      this.vel[o + 1] -= 9 * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] = Math.max(0.05, this.pos[o + 1] + this.vel[o + 1] * dt);
      this.pos[o + 2] += this.vel[o + 2] * dt;
      const k = this.life[i] / this.span[i];
      this.col[o] = this.base[o] * k;
      this.col[o + 1] = this.base[o + 1] * k;
      this.col[o + 2] = this.base[o + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class RaceScene {
  cameraMode: CameraMode = 'chase';

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.2, 700);
  private readonly cars = new Map<number, Car>();
  private readonly observer: ResizeObserver;
  private readonly boxes: THREE.Mesh[] = [];
  private readonly tireMeshes = new Map<number, THREE.Mesh>();
  private readonly oilMeshes = new Map<number, THREE.Mesh>();
  private readonly tireGeo = new THREE.TorusGeometry(0.55, 0.26, 8, 16);
  private readonly tireMat = new THREE.MeshLambertMaterial({ color: '#17191c' });
  private readonly oilGeo = new THREE.CircleGeometry(1.5, 18);
  private readonly oilMat = new THREE.MeshStandardMaterial({ color: '#08090c', roughness: 0.15, metalness: 0.7 });
  private readonly particles = new Particles();
  private camHeading = 0;
  private camReady = false;
  private fov = 62;
  private time = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color('#5d7f9c');
    this.scene.fog = new THREE.Fog('#5d7f9c', 160, 520);

    this.scene.add(new THREE.HemisphereLight('#f2f6fb', '#3b4a3a', 1.5));
    const sun = new THREE.DirectionalLight('#fff1d8', 1.9);
    sun.position.set(-60, 120, 40);
    this.scene.add(sun);

    this.buildTrack();
    this.buildScenery();
    this.scene.add(this.particles.points);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  /** Legt Karts für die aktuellen Fahrer an und entfernt die der gegangenen. */
  setRoster(drivers: { slot: number; name: string }[]): void {
    const seen = new Set<number>();
    for (const d of drivers) {
      seen.add(d.slot);
      let car = this.cars.get(d.slot);
      if (!car) {
        car = this.createCar(d.slot);
        this.cars.set(d.slot, car);
      }
      if (car.labelText !== d.name) this.setLabel(car, d.slot, d.name);
    }
    for (const [slot, car] of this.cars) {
      if (seen.has(slot)) continue;
      this.scene.remove(car.group, car.shadow);
      this.cars.delete(slot);
    }
  }

  frame(entities: RenderEntity[], localSlot: number, dtSec: number, race: RaceView, tires: SnapshotTire[], oils: SnapshotOil[]): void {
    this.time += dtSec;
    const shown = new Set<number>();
    let local: RenderEntity | null = null;
    for (const e of entities) {
      const car = this.cars.get(e.slot);
      if (!car) continue;
      shown.add(e.slot);
      this.updateCar(car, e, dtSec);
      // Das eigene Kart braucht kein Namensschild.
      car.label.visible = e.slot !== localSlot;
      if (e.slot === localSlot) local = e;
    }
    for (const [slot, car] of this.cars) {
      if (shown.has(slot)) continue;
      car.group.visible = false;
      car.shadow.visible = false;
    }

    // Kisten: drehen und schweben; eingesammelte sind unsichtbar.
    for (let i = 0; i < this.boxes.length; i++) {
      const box = this.boxes[i];
      box.visible = (race.boxes & (1 << i)) !== 0;
      box.rotation.y = this.time * 1.6 + i;
      box.position.y = 1.15 + Math.sin(this.time * 2.4 + i) * 0.14;
    }
    this.syncPool(this.tireMeshes, tires, (m, t) => {
      m.position.set(t.x, 0.8, t.z);
      m.rotation.y = Math.atan2(t.vx, t.vz) + Math.PI / 2;
      m.rotation.z = -this.time * 22;
    }, () => new THREE.Mesh(this.tireGeo, this.tireMat));
    this.syncPool(this.oilMeshes, oils, (m, o) => m.position.set(o.x, 0.04, o.z), () => {
      const m = new THREE.Mesh(this.oilGeo, this.oilMat);
      m.rotation.x = -Math.PI / 2;
      return m;
    });

    this.particles.update(dtSec);
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

  private buildTrack(): void {
    const t = TRACK;
    const flat = (color: string): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: '#3d5a45' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.scene.add(ground);

    this.scene.add(new THREE.Mesh(ribbon(-t.wallHalf, t.wallHalf, 0, 0), flat('#4f7a59')));
    this.scene.add(new THREE.Mesh(ribbon(-t.roadHalf, t.roadHalf, 0.01, 0.01), flat('#3a3f47')));
    for (const side of [-1, 1]) {
      const edge = side * (t.roadHalf - 0.45);
      this.scene.add(new THREE.Mesh(ribbon(edge - 0.16, edge + 0.16, 0.02, 0.02), flat('#e9e6dc')));
      const wall = side * t.wallHalf;
      this.scene.add(new THREE.Mesh(ribbon(wall, wall, 0, 0.95), flat('#dedad0')));
      this.scene.add(new THREE.Mesh(ribbon(wall - 0.2, wall + 0.2, 0.96, 0.96), flat('#ffd23f')));
    }
    this.scene.add(new THREE.Mesh(dashes(9, 4, 0.13, 0.02), flat('#a9adb3')));

    // Startlinie
    const checker = canvasTexture(256, 32, (g) => {
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 2; y++) {
          g.fillStyle = (x + y) % 2 === 0 ? '#f2efe6' : '#15171a';
          g.fillRect(x * 16, y * 16, 16, 16);
        }
      }
    });
    this.addDecal(0, 0, t.roadHalf * 2, 2.2, new THREE.MeshBasicMaterial({ map: checker, side: THREE.DoubleSide }));

    // Boost-Felder: Pfeile in Fahrtrichtung
    const chevrons = canvasTexture(128, 256, (g) => {
      g.fillStyle = '#ff7a1a';
      g.fillRect(0, 0, 128, 256);
      g.strokeStyle = '#fff3c4';
      g.lineWidth = 16;
      g.lineJoin = 'miter';
      for (let y = 250; y > -40; y -= 62) {
        g.beginPath();
        g.moveTo(14, y);
        g.lineTo(64, y - 46);
        g.lineTo(114, y);
        g.stroke();
      }
    });
    const padMat = new THREE.MeshBasicMaterial({ map: chevrons, side: THREE.DoubleSide });
    for (const pad of t.pads) {
      this.addDecal(wrapSeg(t, pad.seg + Math.round(pad.length / 2)), pad.lat, PAD_HALF_WIDTH * 2, PAD_LENGTH, padMat);
    }

    // Kisten
    const boxGeo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
    const boxMat = new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#5a4300' });
    const band = new THREE.MeshLambertMaterial({ color: '#15171a' });
    for (const b of t.boxes) {
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.add(new THREE.Mesh(new THREE.BoxGeometry(1.29, 0.3, 1.29), band));
      box.position.set(b.x, 1.15, b.z);
      this.boxes.push(box);
      this.scene.add(box);
    }
  }

  /** Flaches, texturiertes Rechteck auf der Fahrbahn, ausgerichtet an der Strecke. */
  private addDecal(seg: number, lat: number, width: number, length: number, material: THREE.Material): void {
    const t = TRACK;
    const holder = new THREE.Group();
    holder.position.set(t.px[seg] + rightX(t, seg) * lat, 0.03, t.pz[seg] + rightZ(t, seg) * lat);
    holder.rotation.y = trackHeading(t, seg);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
    // +90° um X: die Oberkante der Textur zeigt in Fahrtrichtung.
    plane.rotation.x = Math.PI / 2;
    holder.add(plane);
    this.scene.add(holder);
  }

  /** Ein paar Hallen und Masten neben der Strecke als Orientierungspunkte. */
  private buildScenery(): void {
    const t = TRACK;
    const colors = ['#8a97a3', '#a3867c', '#7c9aa3', '#a89a72', '#8d87a8'];
    let placed = 0;
    for (let gx = -150; gx <= 160 && placed < 26; gx += 26) {
      for (let gz = -120; gz <= 130 && placed < 26; gz += 26) {
        // Deterministische "Zufallswerte" aus der Rasterposition.
        const h = Math.abs(Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453) % 1;
        const x = gx + (h - 0.5) * 12;
        const z = gz + (((h * 7) % 1) - 0.5) * 12;
        let near = Infinity;
        for (let i = 0; i < t.n; i += 3) near = Math.min(near, Math.hypot(t.px[i] - x, t.pz[i] - z));
        const size = 7 + h * 9;
        if (near < t.wallHalf + size * 0.75 + 3) continue;
        const height = 4 + ((h * 13) % 1) * 11;
        const hall = new THREE.Mesh(
          new THREE.BoxGeometry(size, height, size * (0.7 + ((h * 3) % 1) * 0.8)),
          new THREE.MeshLambertMaterial({ color: colors[placed % colors.length] }),
        );
        hall.position.set(x, height / 2, z);
        hall.rotation.y = h * Math.PI;
        this.scene.add(hall);
        placed++;
      }
    }
  }

  private createCar(slot: number): Car {
    const color = playerColor(slot);
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const paint = new THREE.MeshLambertMaterial({ color });
    const dark = new THREE.MeshLambertMaterial({ color: '#16181b' });
    const light = new THREE.MeshLambertMaterial({ color: '#f2efe6' });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.42, 2.05), paint);
    chassis.position.y = 0.48;
    body.add(chassis);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.55), light);
    nose.position.set(0, 0.45, 1.2);
    body.add(nose);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.3), dark);
    seat.position.set(0, 0.9, -0.62);
    body.add(seat);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.38), paint);
    wing.position.set(0, 1.12, -0.98);
    body.add(wing);
    // Fahrer: Rumpf und Helm
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.42), dark);
    torso.position.set(0, 0.98, -0.2);
    body.add(torso);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10), light);
    helmet.position.set(0, 1.5, -0.2);
    body.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.2), paint);
    visor.position.set(0, 1.5, 0.05);
    body.add(visor);

    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.32, 12);
    for (const [x, z] of [
      [-0.74, 0.74],
      [0.74, 0.74],
      [-0.78, -0.72],
      [0.78, -0.72],
    ]) {
      const wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.34, z);
      body.add(wheel);
    }

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 18),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.4, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    label.scale.set(4.2, 1.05, 1);
    label.position.y = 2.7;
    group.add(label);

    group.visible = false;
    shadow.visible = false;
    this.scene.add(group, shadow);
    return { group, body, shadow, label, labelText: '', lean: 0, hop: 0, wasDrifting: false, sparkCarry: 0 };
  }

  private setLabel(car: Car, slot: number, name: string): void {
    const mat = car.label.material;
    mat.map?.dispose();
    mat.map = labelTexture(name, playerColor(slot));
    mat.needsUpdate = true;
    car.labelText = name;
  }

  private updateCar(car: Car, e: RenderEntity, dt: number): void {
    const drifting = e.driftDir !== 0;
    // Kleiner Hüpfer beim Einleiten des Drifts.
    if (drifting && !car.wasDrifting) car.hop = 0.24;
    car.wasDrifting = drifting;
    if (car.hop > 0) car.hop = Math.max(0, car.hop - dt);
    const hopY = car.hop > 0 ? Math.sin((car.hop / 0.24) * Math.PI) * 0.32 : 0;

    car.group.visible = true;
    car.shadow.visible = true;
    car.group.position.set(e.x, hopY, e.z);
    car.group.rotation.y = e.heading;
    car.shadow.position.set(e.x, 0.03, e.z);

    // Schräglage in der Kurve, stärker im Drift.
    const fx = Math.sin(e.heading);
    const fz = Math.cos(e.heading);
    const lateral = e.vx * -fz + e.vz * fx;
    const targetLean = drifting ? e.driftDir * 0.16 : Math.max(-0.1, Math.min(0.1, lateral * 0.02));
    car.lean += (targetLean - car.lean) * Math.min(1, dt * 10);
    car.body.rotation.z = car.lean;
    // Nach einem Treffer dreht sich das Kart zweimal um sich selbst.
    car.body.rotation.y = e.spin > 0 ? (1 - e.spin / SPIN_TICKS) * Math.PI * 4 : 0;
    // Kurz nach einem Treffer unverwundbar: blinken.
    car.body.visible = !(e.shield > 0 && e.spin === 0 && Math.floor(this.time * 12) % 2 === 0);

    // Effekte an den Hinterrädern
    const rx = -fz;
    const rz = fx;
    const speed = Math.hypot(e.vx, e.vz);
    car.sparkCarry += dt * 60;
    const bursts = Math.floor(car.sparkCarry);
    car.sparkCarry -= bursts;
    for (let b = 0; b < bursts; b++) {
      if (drifting) {
        const stage = turboStage(e.driftCharge);
        const c = SPARK_COLORS[stage];
        const n = stage === 0 ? 1 : 2;
        for (const side of [-1, 1]) {
          for (let k = 0; k < n; k++) {
            const px = e.x - fx * 0.9 + rx * side * 0.78;
            const pz = e.z - fz * 0.9 + rz * side * 0.78;
            this.particles.emit(
              px,
              0.15,
              pz,
              -fx * 3 + (Math.random() - 0.5) * 4 - rx * e.driftDir * 2,
              1.5 + Math.random() * (stage === 0 ? 1 : 3.5),
              -fz * 3 + (Math.random() - 0.5) * 4 - rz * e.driftDir * 2,
              c,
              stage === 0 ? 0.22 : 0.35,
            );
          }
        }
      }
      if (e.boost > 0) {
        for (let k = 0; k < 3; k++) {
          this.particles.emit(
            e.x - fx * 1.25 + rx * (Math.random() - 0.5) * 0.6,
            0.5 + Math.random() * 0.2,
            e.z - fz * 1.25 + rz * (Math.random() - 0.5) * 0.6,
            -fx * 9 + (Math.random() - 0.5) * 2,
            1.2 + Math.random(),
            -fz * 9 + (Math.random() - 0.5) * 2,
            Math.random() < 0.5 ? [1, 0.55, 0.12] : [1, 0.85, 0.3],
            0.28,
          );
        }
      } else if ((e.flags & FLAG_OFFROAD) !== 0 && speed > 6 && Math.random() < 0.6) {
        this.particles.emit(e.x - fx * 0.9, 0.2, e.z - fz * 0.9, (Math.random() - 0.5) * 3, 1.6, (Math.random() - 0.5) * 3, [0.3, 0.36, 0.2], 0.45);
      }
    }
  }

  private syncPool<T extends { id: number }>(
    pool: Map<number, THREE.Mesh>,
    items: T[],
    place: (mesh: THREE.Mesh, item: T) => void,
    create: () => THREE.Mesh,
  ): void {
    const seen = new Set<number>();
    for (const item of items) {
      seen.add(item.id);
      let mesh = pool.get(item.id);
      if (!mesh) {
        mesh = create();
        pool.set(item.id, mesh);
        this.scene.add(mesh);
      }
      place(mesh, item);
    }
    for (const [id, mesh] of pool) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      pool.delete(id);
    }
  }

  private updateCamera(local: RenderEntity | null, dtSec: number): void {
    const t = TRACK;
    if (this.cameraMode === 'top' || !local) {
      // Übersicht: so hoch, dass die ganze Strecke ins Bild passt.
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < t.n; i += 4) {
        minX = Math.min(minX, t.px[i]);
        maxX = Math.max(maxX, t.px[i]);
        minZ = Math.min(minZ, t.pz[i]);
        maxZ = Math.max(maxZ, t.pz[i]);
      }
      const pad = t.wallHalf + 6;
      const fov = (62 * Math.PI) / 180;
      const halfX = (maxX - minX) / 2 + pad;
      const halfZ = (maxZ - minZ) / 2 + pad;
      const height = Math.max(halfZ / Math.tan(fov / 2), halfX / (Math.tan(fov / 2) * this.camera.aspect));
      if (this.camera.fov !== 62) {
        this.camera.fov = 62;
        this.camera.updateProjectionMatrix();
      }
      this.camera.position.set((minX + maxX) / 2, height, (minZ + maxZ) / 2 + 0.01);
      this.camera.up.set(0, 0, 1);
      this.camera.lookAt((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      this.camReady = false;
      return;
    }

    this.camera.up.set(0, 1, 0);
    // Die Kamera folgt der Fahrtrichtung, nicht der Nase: so sieht man im
    // Drift das schräg gestellte Kart.
    const speed = Math.hypot(local.vx, local.vz);
    const forward = local.vx * Math.sin(local.heading) + local.vz * Math.cos(local.heading);
    const travel = speed > 4 && forward > 0 ? Math.atan2(local.vx, local.vz) : local.heading;
    if (!this.camReady) {
      this.camHeading = travel;
    } else {
      let d = travel - this.camHeading;
      if (d > Math.PI) d -= 2 * Math.PI;
      else if (d < -Math.PI) d += 2 * Math.PI;
      this.camHeading += d * Math.min(1, dtSec * 6);
    }
    const targetFov = local.boost > 0 ? 72 : 62 + Math.min(4, speed * 0.12);
    this.fov += (targetFov - this.fov) * Math.min(1, dtSec * 5);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    const fx = Math.sin(this.camHeading);
    const fz = Math.cos(this.camHeading);
    this.camera.position.set(local.x - fx * 7.4, 3.5, local.z - fz * 7.4);
    this.camera.lookAt(local.x + fx * 6, 1.1, local.z + fz * 6);
    this.camReady = true;
  }
}
