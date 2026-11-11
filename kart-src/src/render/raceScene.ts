// Die 3D-Szene des Rennens.
//
// Sie bekommt pro Bild nur den Spielstand (Karts, Dinge, Rennphase) und macht
// daraus alles Sichtbare. Was passiert ist – Treffer, Schub, Landung, Absturz –
// liest sie aus den Veränderungen der Kart-Zustände ab. Dadurch sehen Host und
// Mitspieler dieselben Effekte, egal über welchen Weg der Zustand ankam.

import * as THREE from 'three';
import {
  FLAG_AIR,
  FLAG_DIVE,
  FLAG_GLIDE,
  FLAG_OFFROAD,
  FLAG_WALL,
  ITEM_EMP,
  ITEM_KITE,
  ITEM_NONE,
  ITEM_OIL,
  ITEM_SMOKE,
  ITEM_SPRING,
  ITEM_TIRE,
  ITEM_TOP,
  PAD_TICKS,
  SPIN_TICKS,
  V_MAX,
  ringAt,
  thermalLift,
  turboStage,
  lavaAt,
} from '../game/sim';
import {
  DRAFT_FULL,
  DRAFT_PULL_FROM,
  FLOOD_FROM,
  PULSE_AVALANCHE,
  PULSE_BUBBLE,
  PULSE_ICICLE,
  PULSE_METEOR,
  PULSE_PRESS,
  PULSE_VENT,
  WATER_FROM,
  pulseCycle,
  tideLevel,
  vehicleAt,
} from '../game/mechanics';
import { buildMechanics, type MechanicView } from './mechanics';
import { SURFACES } from '../game/surface';
import { NO_GROUND, TRACK, groundAt, newVehiclePose, proj, projectOnTrack, rightX, rightZ, vehiclePose, walk, type Track } from '../game/track';
import type { RaceView, RenderEntity } from '../game/view';
import { RACE_COUNTDOWN, RACE_RESULTS, THING_SMOKE, THING_TIRE, THING_TOP, type SnapshotThing } from '../net/protocol';
import { PLAYER_COLORS } from '../util/players';
import { BlobShadows, Bolts, ComicPops, Particles, SkidMarks, SpeedLines } from './effects';
import type { FxSink } from './fxApi';
import { KartVisual, type KartDetail, type KartPose } from './kartModel';
import { ThingVisuals } from './things';
import { setOutlinesVisible } from './toon';
import { World } from './world';

export interface SceneDriver {
  slot: number;
  name: string;
  bot: boolean;
}

export type Quality = 'auto' | 'low' | 'medium' | 'high';

/** Etwas ist passiert, das man auch hören soll. */
export interface SceneEvent {
  kind:
    | 'boost'
    | 'turbo1'
    | 'turbo2'
    | 'turbo3'
    | 'drift-start'
    | 'hit'
    | 'guard-block'
    | 'stall'
    | 'bump'
    | 'wall'
    | 'land'
    | 'fall'
    | 'respawn'
    | 'pickup'
    | 'item-ready'
    | 'use-tire'
    | 'use-oil'
    | 'use-top'
    | 'use-guard'
    | 'use-emp'
    | 'use-smoke'
    | 'use-spring'
    | 'use-kite'
    | 'finish'
    /** Aus dem Windschatten ausgeschert: es zieht. */
    | 'draft'
    /** Ein Geysir bricht aus bzw. eine Lavabombe schlägt ein (slot −1: gehört zu keinem Kart). */
    | 'geyser'
    | 'bomb'
    /** Ein Fahrzeug hupt, weil das eigene Kart es berührt. */
    | 'honk'
    /** Dicht an einem Fahrzeug vorbeigezogen. */
    | 'pass'
    /** Das eigene Kart fährt durch Lava. */
    | 'burn'
    /** Eine Stampfpresse schlägt herunter (slot −1). */
    | 'press'
    /** Das eigene Kart fährt durch Wasser (Flut). */
    | 'splash'
    /** Fliegen: Flügel klappen aus, durch einen Schubring, in einen Aufwind, Fahrtwind im Gleitflug (nur das eigene Kart, wiederholt). */
    | 'wings'
    | 'ring'
    | 'lift'
    | 'wind'
    /** Tauchen: ins Wasser eingetaucht, wieder aufgetaucht, ein Blasenschlot beginnt zu blasen (slot −1), vom Schlot angehoben. */
    | 'dive'
    | 'surface'
    | 'bubbles'
    | 'blubb'
    /** Eis: eine Lawine geht nieder (slot −1), das eigene Kart steckt darin (wiederholt), ein Eiszapfen schlägt ein (slot −1). */
    | 'avalanche'
    | 'snow'
    | 'icicle'
    /** Mond: von einer Sprungplatte hochgeschleudert, ein Meteorit schlägt ein (slot −1). */
    | 'launch'
    | 'meteor';
  slot: number;
  local: boolean;
  /** -1 links … 1 rechts, aus Sicht der Kamera */
  pan: number;
  /** 0..1 nach Entfernung */
  gain: number;
}

/** Was der Ton pro Kart wissen muss. */
export interface KartAudio {
  slot: number;
  local: boolean;
  speed: number;
  throttle: boolean;
  boost: boolean;
  drift: number;
  offroad: boolean;
  air: boolean;
  stall: boolean;
  distance: number;
  pan: number;
}

interface KartView {
  slot: number;
  char: number;
  visual: KartVisual;
  label: THREE.Sprite | null;
  pose: KartPose;
  seen: boolean;
  fresh: boolean;
  // geglättete Darstellung
  steer: number;
  pitch: number;
  roll: number;
  lastHeading: number;
  airTime: number;
  // letzter Zustand, um Ereignisse zu erkennen
  spin: number;
  boost: number;
  stall: number;
  guard: number;
  respawn: number;
  tow: number;
  draft: number;
  flat: number;
  /** Wie platt das Kart gerade dargestellt wird (0 … 1, geglättet). */
  flatK: number;
  /** Gleitflug im letzten Bild, im Aufwind im letzten Bild, Pause bis zum nächsten Windgeräusch. */
  glide: boolean;
  lift: boolean;
  windWait: number;
  /** Unter Wasser im letzten Bild, über einem blasenden Schlot im letzten Bild. */
  dive: boolean;
  blown: boolean;
  /** In einer Lawine im letzten Bild; Pause bis zur nächsten Meldung. */
  snowed: boolean;
  snowWait: number;
  roulette: number;
  item: number;
  flags: number;
  driftDir: number;
  driftStage: number;
  finished: boolean;
  wallCooldown: number;
  bumpCooldown: number;
  // Hinterräder im letzten Bild (für Bremsspuren)
  rl: THREE.Vector3;
  rr: THREE.Vector3;
  hasTrail: boolean;
  audio: KartAudio;
}

const LEVELS: { ratio: number; kart: KartDetail; world: number; particles: number; skid: boolean }[] = [
  { ratio: 1, kart: 0, world: 0, particles: 220, skid: false },
  { ratio: 1.5, kart: 1, world: 1, particles: 420, skid: true },
  { ratio: 2, kart: 2, world: 2, particles: 640, skid: true },
];

const SPARK_COLORS = [0xcfd3e6, 0x3ff2e2, 0xffe04a, 0xff5ad2];

/** Farbe der Staubfahne je Untergrund (0 = fester Boden, kein Staub); Reihenfolge wie SURFACES. */
const DUST: number[] = SURFACES.map((s) => ({ sand: 0xe9d49a, dirt: 0xa07a54, gravel: 0xb5aea4, grass: 0x8cc463, snow: 0xffffff, regolith: 0xc9c6d2 } as Record<string, number>)[s.id] ?? 0);

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Legt den WebGL-Renderer an. Gibt der Browser mit den Wunsch-Einstellungen keinen Grafikkontext her
 * (gesehen auf einem iPad), wird es mit sparsameren versucht – zuletzt mit einem Kontext, den der Browser ganz
 * nach seinen eigenen Vorgaben anlegt. Scheitert alles, nennt der Fehler jeden Versuch und die Begründung des Browsers.
 */
function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const tries: [string, THREE.WebGLRendererParameters][] = [
    ['Wunsch', { canvas, antialias: window.devicePixelRatio < 1.5, powerPreference: 'high-performance' }],
    ['schlicht', { canvas, antialias: false }],
    ['sparsam', { canvas, antialias: false, stencil: false, powerPreference: 'low-power' }],
  ];
  const errors: string[] = [];
  // Der Browser nennt seinen Grund in einem eigenen Ereignis.
  let reason = '';
  const onError = (e: Event): void => {
    const msg = (e as WebGLContextEvent).statusMessage;
    if (msg) reason = msg;
  };
  canvas.addEventListener('webglcontextcreationerror', onError);
  try {
    for (const [name, params] of tries) {
      try {
        return new THREE.WebGLRenderer(params);
      } catch (err) {
        errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // Letzter Versuch: den Kontext ohne jede Vorgabe selbst holen und übergeben.
    try {
      const context = canvas.getContext('webgl2');
      if (context) return new THREE.WebGLRenderer({ canvas, context });
      errors.push('Vorgabe des Browsers: kein Kontext');
    } catch (err) {
      errors.push(`Vorgabe des Browsers: ${err instanceof Error ? err.message : String(err)}`);
    }
  } finally {
    canvas.removeEventListener('webglcontextcreationerror', onError);
  }
  throw new Error(errors.join(' · ') + (reason ? ` · Begründung des Browsers: ${reason}` : ''));
}

function labelSprite(name: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '900 34px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.strokeStyle = '#16131c';
  const text = name.length > 13 ? `${name.slice(0, 12)}…` : name;
  g.strokeText(text, 128, 34);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sprite.scale.set(3.6, 0.9, 1);
  sprite.renderOrder = 15;
  return sprite;
}

/** So viel weiter als in der Rechnung gilt ein Schubring für die Anzeige als durchflogen (das Bild läuft dem Treffer leicht nach). */
const RING_SEEN = 2.5;

export class RaceScene {
  cameraMode: 'chase' | 'top' = 'chase';
  /** Wie tief das eigene Kart in einer Rauchwolke steckt (0..1) – die Oberfläche legt einen Schleier darüber. */
  smoke = 0;
  /** Wie nah ein Brummkreisel ist, der das eigene Kart sucht (0 = keiner, 1 = gleich da). */
  threat = 0;
  onEvent: ((e: SceneEvent) => void) | null = null;
  /** buildMs = so lange hat der Aufbau der Welt zuletzt gedauert. */
  readonly stats = { fps: 60, calls: 0, triangles: 0, level: 1, scale: 1, ratio: 1, buildMs: 0 };

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1.6, 0.3, 4200);
  private world: World | null = null;
  private things: ThingVisuals | null = null;
  /** Verkehr, Geysire, Lava – was die Strecke an Mechanik hat (mechanics.ts). */
  private mechanics: MechanicView[] = [];
  private mechTime = 0;
  private honkWait = 0;
  private burnWait = 0;
  /** Kamera: Anteil Gleitflug (0 … 1, geglättet). */
  private camGlide = 0;
  /** Wasserspiegel der Gezeit in diesem Bild (ohne Gezeit: unendlich tief). */
  private waterLevel = -Infinity;
  /** Je Fahrzeug: lag das eigene Kart zuletzt dahinter (−1) oder davor (1)? */
  private passSide: Int8Array = new Int8Array(0);
  private readonly vpose = newVehiclePose();
  private track: Track = TRACK;
  private readonly karts = new Map<number, KartView>();
  private drivers: SceneDriver[] = [];
  private readonly puffs: Particles;
  private readonly sparks: Particles;
  private readonly skids: SkidMarks;
  private readonly pops = new ComicPops();
  private readonly speedLines = new SpeedLines();
  private readonly shadows = new BlobShadows(24);
  private readonly bolts = new Bolts();
  /** In diesem Bild: wer einen Kurzschluss ausgelöst hat und wen er gerade erwischt. */
  private readonly empFrom: KartView[] = [];
  private readonly empHit: KartView[] = [];
  /** Teilchen für Bausteine, die das Teilchensystem nicht kennen (Items, Hindernisse). */
  private readonly fx: FxSink;

  private quality: Quality;
  private level = 1;
  private scale = 1;
  private frameTimes = 0;
  private frameCount = 0;
  private lastDrop = 0;
  private smoothSeconds = 0;
  private triedHigh = false;
  private highFailed = false;
  private time = 0;

  // Kamera
  private camYaw = 0;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private camFov = 62;
  private camReady = false;
  private shake = 0;
  private hitstop = 0;
  private orbit = 0;
  private raceId = -1;
  /** Neue Welt oder neue Karts: vor dem nächsten Bild alle Shader übersetzen. */
  private needsCompile = true;

  private readonly color = new THREE.Color();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly q1 = new THREE.Quaternion();
  private readonly e1 = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly flat = new THREE.Quaternion();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    quality: Quality = 'auto',
  ) {
    this.renderer = createRenderer(canvas);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.quality = quality;
    this.level = quality === 'low' ? 0 : quality === 'high' ? 2 : 1;
    const cap = LEVELS[2].particles;
    this.puffs = new Particles(cap, false);
    this.sparks = new Particles(Math.round(cap * 0.7), true);
    this.skids = new SkidMarks(520);
    this.scene.add(this.camera, this.puffs.points, this.sparks.points, this.skids.mesh, this.pops.group, this.shadows.mesh, this.bolts.group);
    const c = this.color;
    this.fx = {
      spark: (x, y, z, vx, vy, vz, life, size, color, gravity = 9) => this.sparks.emit(x, y, z, vx, vy, vz, life, size, c.set(color), -size * 0.8, gravity, 1),
      puff: (x, y, z, vx, vy, vz, life, size, color, grow = 0, gravity = 0) => this.puffs.emit(x, y, z, vx, vy, vz, life, size, c.set(color), grow, gravity, 1.5, 0.95),
    };
    this.camera.add(this.speedLines.mesh);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // --- Aufbau ----------------------------------------------------------------

  /** Baut die Welt der aktiven Strecke (TRACK) auf, falls sie nicht schon steht. */
  setTrack(): void {
    if (this.world && this.track === TRACK) return;
    this.disposeWorld();
    this.track = TRACK;
    const lv = LEVELS[this.level];
    const started = performance.now();
    this.world = new World(TRACK, lv.world);
    this.stats.buildMs = Math.round(performance.now() - started);
    this.things = new ThingVisuals(TRACK, this.level > 0);
    this.scene.add(this.world.group, this.things.group);
    this.mechanics = buildMechanics(TRACK, this.level > 0, this.world);
    this.passSide = new Int8Array(TRACK.vehicles.length);
    for (const m of this.mechanics) this.scene.add(m.group);
    this.scene.fog = this.world.fog;
    this.scene.background = this.world.background;
    this.camReady = false;
    this.needsCompile = true;
    this.pops.prewarm(this.renderer, [
      ['ZISCH!', 'warm'],
      ['WUSCH!', 'cool'],
      ['WUSCH!', 'violet'],
      ['KRACH!', 'hot'],
      ['RUMMS!', 'white'],
      ['PLUMPS!', 'white'],
      ['BOING!', 'cool'],
      ['KLONK!', 'white'],
      ['BZZZT!', 'violet'],
      ['ZIEL!', 'warm'],
      ['SOG!', 'cool'],
      ['PLATT!', 'white'],
    ]);
    this.applyLevel();
  }

  private disposeWorld(): void {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
      this.world = null;
    }
    if (this.things) {
      this.scene.remove(this.things.group);
      this.things.dispose();
      this.things = null;
    }
    for (const m of this.mechanics) {
      this.scene.remove(m.group);
      m.dispose();
    }
    this.mechanics = [];
    this.skids.clear();
    this.puffs.clear();
    this.sparks.clear();
    this.pops.clear();
  }

  /** Vor jedem Einstieg ins Rennen: nichts aus dem letzten Rennen darf nachwirken. */
  reset(): void {
    this.raceId = -1;
    this.camReady = false;
    this.cameraMode = 'chase';
    this.shake = 0;
    this.hitstop = 0;
    this.smoke = 0;
    this.skids.clear();
    this.puffs.clear();
    this.sparks.clear();
    this.pops.clear();
    this.things?.clear();
    this.bolts.clear();
    this.threat = 0;
    for (const k of this.karts.values()) k.fresh = true;
  }

  setRoster(drivers: SceneDriver[]): void {
    this.drivers = drivers;
    for (const [slot, k] of this.karts) {
      const d = drivers.find((x) => x.slot === slot);
      if (!d) {
        this.scene.remove(k.visual.root);
        if (k.label) this.scene.remove(k.label);
        k.visual.dispose();
        this.karts.delete(slot);
      } else if (k.label && k.label.name !== d.name) {
        this.scene.remove(k.label);
        k.label.material.map?.dispose();
        k.label.material.dispose();
        k.label = null;
      }
    }
  }

  setQuality(q: Quality): void {
    this.quality = q;
    if (q !== 'auto') {
      this.level = q === 'low' ? 0 : q === 'high' ? 2 : 1;
      this.scale = 1;
    }
    this.applyLevel();
  }

  private applyLevel(): void {
    const lv = LEVELS[this.level];
    this.stats.level = this.level;
    for (const k of this.karts.values()) k.visual.setDetail(lv.kart);
    this.needsCompile = true;
    if (this.things) setOutlinesVisible(this.things.group, this.level > 0);
    // Fällt die Qualität mitten im Rennen, verlieren auch Verkehr und Lava ihre Konturen.
    for (const m of this.mechanics) setOutlinesVisible(m.group, this.level > 0);
    this.skids.mesh.visible = lv.skid;
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, LEVELS[this.level].ratio) * this.scale;
    this.stats.ratio = ratio;
    this.stats.scale = this.scale;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.puffs.setViewport(h * ratio, this.camera.fov);
    this.sparks.setViewport(h * ratio, this.camera.fov);
  }

  private kartView(slot: number, char: number): KartView {
    let k = this.karts.get(slot);
    if (k && k.char === char) return k;
    if (k) {
      // Andere Figur gewählt als im letzten Rennen: Kart neu bauen.
      this.scene.remove(k.visual.root);
      if (k.label) this.scene.remove(k.label);
      k.visual.dispose();
      this.karts.delete(slot);
    }
    const visual = new KartVisual(char, LEVELS[this.level].kart, slot);
    visual.root.rotation.order = 'YXZ';
    this.scene.add(visual.root);
    this.needsCompile = true;
    k = {
      slot,
      char,
      visual,
      label: null,
      pose: {
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
      },
      seen: true,
      fresh: true,
      steer: 0,
      pitch: 0,
      roll: 0,
      lastHeading: 0,
      airTime: 0,
      spin: 0,
      boost: 0,
      stall: 0,
      guard: 0,
      respawn: 0,
      tow: 0,
      draft: 0,
      flat: 0,
      flatK: 0,
      glide: false,
      lift: false,
      windWait: 0,
      dive: false,
      blown: false,
      snowed: false,
      snowWait: 0,
      roulette: 0,
      item: ITEM_NONE,
      flags: 0,
      driftDir: 0,
      driftStage: 0,
      finished: false,
      wallCooldown: 0,
      bumpCooldown: 0,
      rl: new THREE.Vector3(),
      rr: new THREE.Vector3(),
      hasTrail: false,
      audio: { slot, local: false, speed: 0, throttle: false, boost: false, drift: 0, offroad: false, air: false, stall: false, distance: 0, pan: 0 },
    };
    this.karts.set(slot, k);
    return k;
  }

  // --- Ereignisse --------------------------------------------------------------

  private emit(kind: SceneEvent['kind'], k: KartView, local: boolean): void {
    if (!this.onEvent) return;
    const gain = local ? 1 : Math.max(0, 1 - k.audio.distance / 70);
    if (gain <= 0.02) return;
    this.onEvent({ kind, slot: k.slot, local, pan: local ? 0 : k.audio.pan, gain });
  }

  /** Ereignis an einem Ort der Welt (kein Kart): Lautstärke und Richtung aus Sicht der Kamera. */
  private emitAt(kind: SceneEvent['kind'], x: number, y: number, z: number, reach = 90): void {
    if (!this.onEvent) return;
    this.v1.set(x, y, z).sub(this.camera.position);
    const dist = this.v1.length();
    const gain = Math.max(0, 1 - dist / reach);
    if (gain <= 0.02) return;
    this.v2.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const pan = dist > 0.5 ? Math.max(-1, Math.min(1, this.v1.dot(this.v2) / dist)) : 0;
    this.onEvent({ kind, slot: -1, local: false, pan, gain });
  }

  /**
   * Was die Streckenmechanik hören und spüren lässt: ausbrechende Geysire,
   * einschlagende Bomben, hupende und vorbeirauschende Fahrzeuge, Lava unter den Rädern.
   */
  private mechanicEvents(time: number, me: RenderEntity | undefined, dt: number, entities: RenderEntity[]): void {
    const t = this.track;
    const before = this.mechTime;
    this.mechTime = time;
    // Nur bei stetig laufender Zeit – nicht über einen Neustart oder Sprung hinweg.
    const steady = time > before && time - before < 30;
    if (steady) {
      for (const p of t.pulses) {
        // Der Zyklus ist seit dem letzten Bild über null gelaufen: Ausbruch bzw. Einschlag.
        if (pulseCycle(p, time) < pulseCycle(p, before)) {
          if (p.kind === PULSE_BUBBLE) {
            // Ein Blasenschlot beginnt zu blasen: harmlos, nur zu hören.
            this.emitAt('bubbles', p.x, p.y, p.z);
            continue;
          }
          if (p.kind > PULSE_BUBBLE) {
            // Lawine, Eiszapfen, Meteorit: ortsfest zu hören; Lawine und Meteorit lassen das Bild beben.
            this.emitAt(p.kind === PULSE_AVALANCHE ? 'avalanche' : p.kind === PULSE_ICICLE ? 'icicle' : 'meteor', p.x, p.y, p.z);
            if (me && p.kind !== PULSE_ICICLE) {
              const d = Math.hypot(me.x - p.x, me.z - p.z);
              if (d < 45) this.shake = Math.max(this.shake, (p.kind === PULSE_METEOR ? 0.6 : 0.35) * (1 - d / 45));
            }
            continue;
          }
          const vent = p.kind === PULSE_VENT;
          this.emitAt(vent ? 'geyser' : p.kind === PULSE_PRESS ? 'press' : 'bomb', p.x, p.y, p.z);
          if (p.kind === PULSE_PRESS) this.burst(p.x, p.y + 0.2, p.z, 10, 7, 0xbfb8ae, false, 0.7, 0.5, 1);
          if (me && !vent) {
            const d = Math.hypot(me.x - p.x, me.z - p.z);
            if (d < 30) this.shake = Math.max(this.shake, 0.5 * (1 - d / 30));
          }
        }
      }
    }
    this.honkWait = Math.max(0, this.honkWait - dt);
    this.burnWait = Math.max(0, this.burnWait - dt);
    // Flut: wer durchs Wasser fährt, spritzt – alle Karts in Sichtweite, zu hören nur das eigene.
    if (t.tide) {
      const level = tideLevel(t.tide, time);
      this.waterLevel = level;
      for (const e of entities) {
        if (e.respawn > 0 || (e.flags & FLAG_AIR) !== 0 || !t.tidal[e.seg < t.total ? e.seg : 0]) continue;
        const depth = level - e.y;
        const speed = Math.hypot(e.vx, e.vz);
        if (depth <= WATER_FROM || speed < 3) continue;
        // Viele kleine Tropfen seitlich der Räder – je schneller und tiefer, desto mehr.
        const drops = Math.min(4, Math.floor(dt * (10 + speed * 2.2) + Math.random()));
        const hx = Math.sin(e.heading);
        const hz = Math.cos(e.heading);
        for (let d = 0; d < drops; d++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const out = 2 + Math.random() * 3 + speed * 0.08;
          this.fx.puff(
            e.x - hz * side * 0.9 + hx * (Math.random() - 0.3),
            level + 0.05,
            e.z + hx * side * 0.9 + hz * (Math.random() - 0.3),
            -hz * side * out + hx * speed * 0.25,
            2.5 + Math.random() * 3 + depth * 2,
            hx * side * out + hz * speed * 0.25,
            0.35 + Math.random() * 0.2,
            0.16 + Math.random() * 0.2,
            0xf2fbff,
            0,
            14,
          );
        }
        if (me && e.slot === me.slot && this.burnWait === 0) {
          this.burnWait = 0.28;
          this.onEvent?.({ kind: 'splash', slot: e.slot, local: true, pan: 0, gain: Math.min(1, 0.4 + depth) });
        }
      }
    }
    if (!me || me.respawn > 0) return;
    if (t.vehicles.length > 0) {
      const lap = t.n * t.step;
      const mine = t.prog[me.seg < t.total ? me.seg : 0] * t.step;
      for (const v of t.vehicles) {
        let d = mine - vehicleAt(v, time, lap);
        if (d > lap / 2) d -= lap;
        else if (d < -lap / 2) d += lap;
        const key = v.id;
        if (d > 30 || d < -40) {
          this.passSide[key] = 0;
          continue;
        }
        // Lage des Karts aus Sicht des Fahrzeugs (mittlerer Wagen genügt für Hupe und Fahrtwind).
        const p = vehiclePose(t, v, v.cars >> 1, time, this.vpose);
        const hx = Math.sin(p.heading);
        const hz = Math.cos(p.heading);
        const du = (me.x - p.x) * hx + (me.z - p.z) * hz;
        const dw = -(me.x - p.x) * hz + (me.z - p.z) * hx;
        const dy = Math.abs(me.y - p.y);
        const reach = v.half + ((v.cars - 1) * v.pitch) / 2;
        if (dy < 2.5 && Math.abs(du) < reach + 1.4 && Math.abs(dw) < v.halfWidth + 1.35 && this.honkWait === 0) {
          this.honkWait = 2.2;
          this.emitAt('honk', p.x, p.y + 1.5, p.z);
        }
        // Vorbeigezogen: eben noch dahinter, jetzt davor – und dicht daneben.
        const side = du > reach ? 1 : du < -reach ? -1 : 0;
        if (side === 1 && this.passSide[key] === -1 && Math.abs(dw) < 4.2 && dy < 2.5) this.emitAt('pass', p.x, p.y + 1, p.z);
        if (side !== 0) this.passSide[key] = side;
      }
    }
    if (t.floods.length > 0 && (me.flags & FLAG_AIR) === 0 && lavaAt(t, me.seg, time) > FLOOD_FROM) {
      if (this.burnWait === 0) {
        this.burnWait = 0.3;
        this.onEvent?.({ kind: 'burn', slot: me.slot, local: true, pan: 0, gain: 1 });
      }
      // Glut und Qualm unter den Rädern
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * 6.28;
        this.fx.spark(me.x + Math.cos(a) * 0.9, me.y + 0.2, me.z + Math.sin(a) * 0.9, Math.cos(a) * 3, 4 + Math.random() * 3, Math.sin(a) * 3, 0.5, 0.35, 0xffa628);
      }
      if (Math.random() < 0.3) this.fx.puff(me.x, me.y + 0.5, me.z, 0, 2.5, 0, 0.7, 1.1, 0x4a3b45, 1.2, -2);
    }
  }

  private pop(word: string, e: RenderEntity, style: string, size = 3.4): void {
    this.pops.show(word, e.x, e.y + 2.6, e.z, style, size);
  }

  private burst(x: number, y: number, z: number, count: number, speed: number, hex: number, glow: boolean, size = 0.5, life = 0.6, up = 3): void {
    this.color.set(hex);
    const pool = glow ? this.sparks : this.puffs;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      pool.emit(x, y, z, Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), this.color, glow ? -size : size * 1.2, glow ? 9 : 4, 1.5);
    }
  }

  /** Vergleicht den Zustand eines Karts mit dem letzten Bild und löst Effekte aus. */
  private detect(k: KartView, e: RenderEntity, local: boolean, dt: number): void {
    const air = (e.flags & FLAG_AIR) !== 0;
    const wasAir = (k.flags & FLAG_AIR) !== 0;
    const glide = (e.flags & FLAG_GLIDE) !== 0 && e.respawn === 0;
    const stage = e.driftDir !== 0 ? turboStage(e.driftCharge, e.char) : 0;
    // Im Aufwind? Dieselbe Frage wie in der Rechnung: über der Flugdecke und neben dem Korridor trägt keine Säule.
    let lift = false;
    if (glide && this.track.thermals.length > 0) {
      projectOnTrack(this.track, e.x, e.z, e.seg < this.track.total ? e.seg : 0);
      lift = thermalLift(this.track, proj.seg, proj.lat, e.x, e.y, e.z) > 0;
    }
    // Tauchen: unter Wasser? Über einem blasenden Schlot?
    const dive = (e.flags & FLAG_DIVE) !== 0 && e.respawn === 0;
    let blown = false;
    if (dive && air) {
      for (const p of this.track.pulses) {
        if (p.kind !== PULSE_BUBBLE) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        if (dx * dx + dz * dz < (p.radius + 0.6) * (p.radius + 0.6) && e.y - p.y < 5.5 && pulseCycle(p, this.mechTime) < p.on) blown = true;
      }
    }
    // Eis: steckt das Kart in einer laufenden Lawine?
    let snowed = false;
    if (!air && e.respawn === 0) {
      for (const p of this.track.pulses) {
        if (p.kind !== PULSE_AVALANCHE || pulseCycle(p, this.mechTime) >= p.on || Math.abs(e.y - p.y) > 3) continue;
        const along = (e.x - p.x) * this.track.tx[p.seg] + (e.z - p.z) * this.track.tz[p.seg];
        const side = (e.x - p.x) * rightX(this.track, p.seg) + (e.z - p.z) * rightZ(this.track, p.seg);
        if (Math.abs(along) < p.radius && Math.abs(side) < this.track.wh[p.seg] + 4) snowed = true;
      }
    }
    if (snowed) {
      // Schnee stiebt um das Kart; das eigene meldet sich regelmäßig (Wummern, Rütteln).
      if (Math.random() < dt * 40) this.fx.puff(e.x + (Math.random() - 0.5) * 2.4, e.y + 0.3 + Math.random() * 1.2, e.z + (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.6, 0.35 + Math.random() * 0.4, 0xffffff, 1.2, 3);
      k.snowWait -= dt;
      if (k.snowWait <= 0) {
        k.snowWait = 0.3;
        if (local) {
          this.emit('snow', k, true);
          this.shake = Math.max(this.shake, 0.22);
        }
      }
      if (!k.snowed && !k.fresh) this.pop('LAWINE!', e, 'white', 3.6);
    } else k.snowWait = 0;
    k.snowed = snowed;
    // Mond: von einer Sprungplatte hochgeschleudert? (Abheben mit viel Steigen dicht hinter einer Platte)
    if (!k.fresh && air && !wasAir && e.vy > 6 && this.track.launchers.length > 0) {
      for (const l of this.track.launchers) {
        const d = Math.hypot(e.x - this.track.px[l.seg], e.z - this.track.pz[l.seg]);
        if (d < 14 + this.track.wh[l.seg]) {
          this.pop('HUI!', e, 'warm', 3.4);
          this.burst(e.x, e.y + 0.2, e.z, 12, 8, 0xff8a2a, true, 0.5, 0.5, 4);
          k.visual.squash(-0.9);
          this.emit('launch', k, local);
          if (local) this.shake = Math.max(this.shake, 0.3);
          break;
        }
      }
    }
    if (!k.fresh) {
      if (dive !== k.dive && e.respawn === 0 && k.respawn === 0) {
        // Durch die Wasseroberfläche: es spritzt – hinein mit einem Platscher, hinaus mit einer Fontäne.
        const sea = this.track.sea;
        this.burst(e.x, sea + 0.2, e.z, dive ? 22 : 14, dive ? 9 : 7, 0xeafaff, false, 0.6, 0.55, 9);
        if (dive) this.pop('PLATSCH!', e, 'cool', 3.6);
        this.emit(dive ? 'dive' : 'surface', k, local);
        if (local) this.shake = Math.max(this.shake, dive ? 0.3 : 0.15);
      }
      if (blown && !k.blown) {
        this.pop('BLUBB!', e, 'cool', 3);
        k.visual.squash(-0.7);
        this.emit('blubb', k, local);
      }
      if (glide && !k.glide) {
        this.pop('ABFLUG!', e, 'cool', 3.4);
        k.visual.squash(-0.6);
        this.emit('wings', k, local);
        k.windWait = 0.25;
      }
      if (lift && !k.lift) {
        this.pop('AUFWIND!', e, 'white', 3);
        this.emit('lift', k, local);
      }
      if (e.spin > 0 && k.spin === 0) {
        this.pop('KRACH!', e, 'hot', 4.2);
        this.burst(e.x, e.y + 1, e.z, 16, 9, 0xffd23f, true, 0.7, 0.7, 6);
        this.burst(e.x, e.y + 0.6, e.z, 8, 5, 0xe9e6f2, false, 0.9, 0.7);
        k.visual.squash(1);
        this.emit('hit', k, local);
        if (local) {
          this.hitstop = 0.085;
          this.shake = Math.max(this.shake, 0.6);
        }
      }
      if (air && e.boost > k.boost + 20 && e.boost <= PAD_TICKS && ringAt(this.track, e.x, e.y, e.z, RING_SEEN)) {
        // Durch einen Schubring geflogen (im Gleitflug, unter Wasser oder im Mondsprung). Der Schub allein
        // sagt das nicht: ein Schub-Item im Flug hebt ihn genauso an – deshalb muss auch ein Ring da sein.
        this.pop('RING!', e, 'warm', 3);
        this.burst(e.x, e.y + 0.6, e.z, 12, 9, 0xffd23f, true, 0.5, 0.5, 4);
        k.visual.squash(-0.8);
        this.emit('ring', k, local);
        if (local) this.shake = Math.max(this.shake, 0.14);
      } else if (e.boost > 0 && e.boost > k.boost + 20 && k.tow === 0) {
        const turbo = k.driftDir !== 0 ? Math.max(1, k.driftStage) : 0;
        this.pop(turbo ? 'WUSCH!' : 'ZISCH!', e, turbo === 3 ? 'violet' : turbo ? 'cool' : 'warm', 2.6 + turbo * 0.35);
        k.visual.squash(-0.8);
        this.emit(turbo === 3 ? 'turbo3' : turbo === 2 ? 'turbo2' : turbo === 1 ? 'turbo1' : 'boost', k, local);
        if (local) this.shake = Math.max(this.shake, 0.18);
      }
      if (e.driftDir !== 0 && k.driftDir === 0) this.emit('drift-start', k, local);
      if (!air && wasAir && e.respawn === 0 && k.respawn === 0) {
        if (k.airTime > 0.28) {
          this.burst(e.x, e.y + 0.2, e.z, 9, 6, 0xd9cfc0, false, 0.5, 0.45, 1.5);
          k.visual.squash(Math.min(1.2, 0.4 + k.airTime));
          this.emit('land', k, local);
          if (local) this.shake = Math.max(this.shake, Math.min(0.45, k.airTime * 0.4));
        }
        // Nach einem Gleitflug setzt das Kart sanft auf – kein "PLUMPS!".
        if (k.airTime > 0.75 && !k.glide) this.pop('PLUMPS!', e, 'white', 3);
      }
      if (e.respawn > 0 && k.respawn === 0) {
        // Der Effekt gehört dorthin, wo das Kart verschwunden ist – nicht an den neuen Platz.
        const th = this.track.def.theme;
        const p = k.visual.root.position;
        this.pops.show(th === 'klippe' ? 'PLATSCH!' : th === 'glut' ? 'ZSSSCH!' : 'HUCH!', p.x, p.y + 5, p.z, th === 'glut' ? 'hot' : 'cool', 4.4);
        this.burst(p.x, p.y + 1.5, p.z, 18, 7, th === 'glut' ? 0xff9a1f : 0xc9f4ff, th === 'glut', 0.9, 0.9, 9);
        this.emit('fall', k, local);
        k.hasTrail = false;
      }
      if (e.respawn === 0 && k.respawn > 0) this.emit('respawn', k, local);
      if (e.tow > 0 && k.tow === 0) {
        this.pop('ZIEH!', e, 'cool', 3.4);
        this.burst(e.x, e.y + 0.4, e.z, 10, 7, 0xe9e6f2, false, 0.5, 0.5, 2);
        k.visual.squash(-1);
        this.emit('use-kite', k, local);
        if (local) this.shake = Math.max(this.shake, 0.22);
      }
      if (e.tow === 0 && k.tow > 0) this.burst(e.x, e.y + 0.3, e.z, 6, 4, 0xe9e6f2, false, 0.4, 0.4, 1);
      if (e.stall > 0 && k.stall === 0) {
        this.empHit.push(k);
        this.pop('BZZZT!', e, 'violet', 3.6);
        this.burst(e.x, e.y + 1, e.z, 12, 6, 0xb9a8ff, true, 0.5, 0.5, 4);
        this.emit('stall', k, local);
        if (local) this.shake = Math.max(this.shake, 0.3);
      }
      if (e.guard === 0 && k.guard > 30) {
        this.pop('KLONK!', e, 'white', 3.6);
        this.burst(e.x, e.y + 1, e.z, 10, 8, 0xdfe6f2, true, 0.6, 0.5, 4);
        this.emit('guard-block', k, local);
      }
      if (e.guard > k.guard + 60) this.emit('use-guard', k, local);
      if (e.roulette > 0 && k.roulette === 0) {
        this.burst(e.x, e.y + 1.2, e.z, 12, 8, 0xffe04a, true, 0.3, 0.45, 5);
        this.emit('pickup', k, local);
      }
      if (e.roulette === 0 && k.roulette > 0 && e.item !== ITEM_NONE) this.emit('item-ready', k, local);
      if (e.item === ITEM_NONE && k.item !== ITEM_NONE && k.roulette === 0) {
        // Die Figur macht die passende Bewegung: werfen, kippen, hochreißen …
        k.visual.useItem(k.item);
        if (k.item === ITEM_EMP) this.empFrom.push(k);
        if (k.item === ITEM_KITE) {
          // Wirkung und Ton kommen mit dem Start des Zugs (siehe oben).
        } else if (k.item === ITEM_TIRE) {
          this.pop('HUI!', e, 'white', 2.6);
          this.emit('use-tire', k, local);
        } else if (k.item === ITEM_OIL) {
          this.pop('PLATSCH!', e, 'violet', 2.8);
          this.emit('use-oil', k, local);
        } else if (k.item === ITEM_TOP) {
          this.pop('BRRRM!', e, 'hot', 2.8);
          this.emit('use-top', k, local);
        } else if (k.item === ITEM_SMOKE) {
          this.pop('PUFF!', e, 'white', 3);
          this.emit('use-smoke', k, local);
        } else if (k.item === ITEM_EMP) {
          this.pop('KLACK!', e, 'violet', 2.6);
          this.emit('use-emp', k, local);
        } else if (k.item === ITEM_SPRING) {
          this.pop('BOING!', e, 'cool', 3.2);
          k.visual.squash(-1);
          this.emit('use-spring', k, local);
        }
      }
      if (e.flags & FLAG_WALL && !(k.flags & FLAG_WALL) && k.wallCooldown <= 0 && Math.hypot(e.vx, e.vz) > 9) {
        k.wallCooldown = 0.5;
        this.burst(e.x, e.y + 0.6, e.z, 6, 5, 0xffe9a8, true, 0.4, 0.3, 2);
        this.emit('wall', k, local);
        if (local) this.shake = Math.max(this.shake, 0.2);
      }
      if (e.flat > 0 && k.flat === 0) {
        this.pop('PLATT!', e, 'white', 4);
        this.burst(e.x, e.y + 0.4, e.z, 12, 8, 0xe9e6f2, false, 0.8, 0.5, 1);
        this.emit('hit', k, local);
        if (local) {
          this.hitstop = 0.07;
          this.shake = Math.max(this.shake, 0.7);
        }
      }
      if (e.draft >= DRAFT_PULL_FROM && k.draft < DRAFT_PULL_FROM) {
        this.pop('SOG!', e, 'cool', 3.2);
        this.emit('draft', k, local);
      }
      if (e.finished && !k.finished) {
        this.pop('ZIEL!', e, 'warm', 4.6);
        for (const c of PLAYER_COLORS) this.burst(e.x, e.y + 2, e.z, 9, 8, parseInt(c.slice(1), 16), false, 0.4, 1.4, 9);
        this.emit('finish', k, local);
      }
    }
    // Fahrtwind im Gleitflug: nur das eigene Kart, als dichte Folge kurzer Böen.
    if (glide && local) {
      k.windWait -= dt;
      if (k.windWait <= 0) {
        k.windWait = 0.42;
        this.emit('wind', k, true);
      }
    }
    k.glide = glide;
    k.lift = lift;
    k.dive = dive;
    k.blown = blown;
    k.airTime = air ? k.airTime + dt : 0;
    k.spin = e.spin;
    k.boost = e.boost;
    k.stall = e.stall;
    k.guard = e.guard;
    k.respawn = e.respawn;
    k.tow = e.tow;
    k.draft = e.draft;
    k.flat = e.flat;
    k.roulette = e.roulette;
    k.item = e.item;
    k.flags = e.flags;
    k.driftDir = e.driftDir;
    k.driftStage = stage;
    k.finished = e.finished;
    k.fresh = false;
    if (k.wallCooldown > 0) k.wallCooldown -= dt;
    if (k.bumpCooldown > 0) k.bumpCooldown -= dt;
  }

  // --- Pro Bild ----------------------------------------------------------------

  frame(entities: RenderEntity[], localSlot: number, dt: number, race: RaceView, things: SnapshotThing[]): void {
    if (!this.world || !this.things) return;
    const t = this.track;
    this.measure(dt);

    // Treffer-Stopp: für einen Wimpernschlag steht das Bild, nur die Kamera wackelt.
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.applyShake(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.time += dt;
    if (race.raceId !== this.raceId) {
      this.raceId = race.raceId;
      this.skids.clear();
      this.pops.clear();
      this.camReady = false;
      for (const k of this.karts.values()) k.fresh = true;
    }

    for (const k of this.karts.values()) k.seen = false;
    this.empFrom.length = 0;
    this.empHit.length = 0;
    this.shadows.begin();
    let me: RenderEntity | null = null;
    let meView: KartView | null = null;

    for (const e of entities) {
      const local = e.slot === localSlot;
      const k = this.kartView(e.slot, e.char);
      k.seen = true;
      const speed = Math.hypot(e.vx, e.vz);
      const fx = Math.sin(e.heading);
      const fz = Math.cos(e.heading);
      const vf = e.vx * fx + e.vz * fz;
      const air = (e.flags & FLAG_AIR) !== 0;

      // Boden unter dem Kart und dessen Neigung
      projectOnTrack(t, e.x, e.z, e.seg);
      const seg = proj.seg;
      const ground = groundAt(t, seg, proj.along, proj.lat);
      const slope = (t.py[t.next[seg]] - t.py[t.prev[seg]]) / (2 * t.step);
      const gx = slope * t.tx[seg] + t.bank[seg] * rightX(t, seg);
      const gz = slope * t.tz[seg] + t.bank[seg] * rightZ(t, seg);
      const groundPitch = -Math.atan(gx * fx + gz * fz);
      const groundRoll = -Math.atan(gx * -fz + gz * fx);
      let wantPitch = groundPitch;
      let wantRoll = groundRoll;
      if (air) {
        wantPitch = e.respawn > 0 ? 0 : -Math.atan2(e.vy, Math.max(8, speed)) * 0.55;
        wantRoll = 0;
      }
      const rate = Math.min(1, dt * (air ? 5 : 14));
      if (k.fresh) {
        k.pitch = wantPitch;
        k.roll = wantRoll;
        k.lastHeading = e.heading;
      }
      k.pitch += (wantPitch - k.pitch) * rate;
      k.roll += (wantRoll - k.roll) * rate;

      // Lenkeinschlag aus der Drehung ablesen (fremde Karts liefern keine Eingaben mit)
      const yawRate = dt > 0 ? wrapAngle(e.heading - k.lastHeading) / dt : 0;
      k.lastHeading = e.heading;
      const steerNow = Math.max(-1, Math.min(1, (-yawRate / 1.6) * (vf < 0 ? -1 : 1)));
      k.steer += (steerNow - k.steer) * Math.min(1, dt * 12);

      const pose = k.pose;
      pose.speed = vf;
      pose.steer = k.steer;
      pose.driftDir = e.driftDir;
      pose.driftStage = e.driftDir !== 0 ? turboStage(e.driftCharge, e.char) : 0;
      pose.boost = e.boost > 0;
      pose.air = air;
      pose.spin = e.spin > 0 ? 1 - e.spin / SPIN_TICKS : 0;
      // Kurz bevor der Stoßfänger abläuft, blinkt er.
      pose.guard = e.guard > 0 && (e.guard > 90 || Math.floor(this.time * 10) % 2 === 0);
      pose.stall = e.stall > 0;
      pose.offroad = (e.flags & FLAG_OFFROAD) !== 0;
      // Während der Auslosung ist die Hand noch leer; danach hält die Figur das Item hoch.
      pose.held = e.roulette > 0 ? 0 : e.item;
      pose.tow = e.tow > 0;
      pose.glide = (e.flags & FLAG_GLIDE) !== 0 && e.respawn === 0;
      pose.dive = (e.flags & FLAG_DIVE) !== 0 && e.respawn === 0;
      pose.space = this.track.gravity < 1;
      pose.emote = e.finished ? (e.place <= 1 || (entities.length > 2 && e.place <= 2) ? 'win' : 'lose') : 'none';

      // Hören: Entfernung und Richtung zur Kamera
      this.v1.set(e.x, e.y, e.z).sub(this.camera.position);
      const dist = this.v1.length();
      this.v2.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      k.audio.local = local;
      k.audio.speed = Math.abs(vf) / V_MAX;
      k.audio.throttle = !e.finished && race.phase !== RACE_COUNTDOWN && e.spin === 0;
      k.audio.boost = e.boost > 0 || e.tow > 0;
      k.audio.drift = e.driftDir !== 0 ? Math.max(0.5, pose.driftStage) : 0;
      // Loser Untergrund klingt wie der Grünstreifen: es prasselt unter den Rädern.
      k.audio.offroad = pose.offroad || DUST[this.track.surf[e.seg < this.track.total ? e.seg : 0]] !== 0;
      k.audio.air = air;
      k.audio.stall = e.stall > 0;
      k.audio.distance = dist;
      k.audio.pan = dist > 0.5 ? Math.max(-1, Math.min(1, this.v1.dot(this.v2) / dist)) : 0;

      this.detect(k, e, local, dt);

      const root = k.visual.root;
      root.position.set(e.x, e.y, e.z);
      root.rotation.set(k.pitch, e.heading, k.roll);
      // Von der Presse geplättet: flach wie eine Flunder, dafür etwas breiter – und am Ende federt es zurück.
      k.flatK += ((e.flat > 6 ? 1 : 0) - k.flatK) * Math.min(1, dt * (e.flat > 6 ? 26 : 9));
      root.scale.set(1 + 0.22 * k.flatK, 1 - 0.7 * k.flatK, 1 + 0.12 * k.flatK);
      // Nach einem Treffer blinkt das Kart, solange es unverwundbar ist – nur nicht, solange es platt ist:
      // die Flunder soll man sehen.
      root.visible = !(e.shield > 0 && e.spin === 0 && e.respawn === 0 && e.flat === 0 && Math.floor(this.time * 14) % 2 === 0);
      k.visual.update(dt, pose);

      if (ground !== NO_GROUND && e.respawn === 0) {
        this.e1.set(groundPitch, e.heading, groundRoll);
        this.q1.setFromEuler(this.e1);
        this.shadows.add(e.x, ground, e.z, this.q1, 2.5, e.y - ground);
      }

      this.trail(k, e, speed, air, pose.driftStage, dt);

      if (local) {
        me = e;
        meView = k;
      } else {
        if (!k.label) {
          const d = this.drivers.find((x) => x.slot === e.slot);
          k.label = labelSprite(d?.name ?? `Fahrer ${e.slot + 1}`, PLAYER_COLORS[e.slot % PLAYER_COLORS.length]);
          k.label.name = d?.name ?? '';
          this.scene.add(k.label);
        }
        // Auf jede Entfernung etwa gleich groß; ganz nah stört das Schild nur.
        const ls = Math.max(0.5, Math.min(1.7, dist / 20));
        k.label.scale.set(3.6 * ls, 0.9 * ls, 1);
        k.label.position.set(e.x, e.y + 2.5 + ls * 0.4, e.z);
        k.label.visible = dist < 90 && dist > 8;
      }
    }
    for (const k of this.karts.values()) {
      if (k.seen) continue;
      k.visual.root.visible = false;
      if (k.label) k.label.visible = false;
      k.fresh = true;
    }
    this.bumps(entities, localSlot);
    // Kurzschluss: vom Auslöser springt ein Blitz zu jedem, den es erwischt hat.
    for (const from of this.empFrom) {
      for (const hit of this.empHit) {
        const a = from.visual.root.position;
        const b = hit.visual.root.position;
        this.bolts.strike(a.x, a.y + 1.6, a.z, b.x, b.y + 1.2, b.z);
      }
    }

    // Dinge und Hindernisse
    this.things.update(things, dt, this.time, this.fx);
    this.things.updateHazards(race.hostTick, this.time);
    for (const m of this.mechanics) m.update(race.time, this.time, dt, this.camera.position, this.fx);
    this.mechanicEvents(race.time, me ?? undefined, dt, entities);
    let smoke = 0;
    let threat = 0;
    this.flat.identity();
    for (const th of things) {
      if (th.kind === THING_TIRE || th.kind === THING_TOP) {
        if (this.things.shown(th)) this.shadows.add(th.x, th.y - (th.kind === THING_TOP ? 0.6 : 0.8), th.z, this.flat, 1.6, 0);
        if (th.kind === THING_TOP && me && th.target === localSlot) {
          threat = Math.max(threat, 1 - Math.hypot(th.x - me.x, th.z - me.z) / 75);
        }
      } else if (th.kind === THING_SMOKE && me) {
        const d = Math.hypot(th.x - me.x, th.z - me.z);
        if (Math.abs(th.y - me.y) < 5) smoke = Math.max(smoke, Math.min(1, (9.5 - d) / 3.5) * Math.min(1, th.ttl));
      }
    }
    for (const h of this.things.hazards) this.shadows.add(h.position.x, h.position.y, h.position.z, this.flat, 3.4, 0);
    this.shadows.end();
    this.smoke += (Math.max(0, smoke) - this.smoke) * Math.min(1, dt * 8);
    this.threat = Math.max(0, threat);
    this.bolts.update(dt);

    this.puffs.update(dt);
    this.sparks.update(dt);
    this.pops.update(dt);

    this.updateCamera(me, meView, race, dt);
    // Tempostriche: voll bei Schub, sonst bei hohem Tempo – und im Windschatten wachsen sie mit der Ladung.
    const wake = me ? (me.draft >= DRAFT_PULL_FROM ? 0.8 : (me.draft / DRAFT_FULL) * 0.5) : 0;
    const fast = me ? Math.max(wake, me.boost > 0 || me.tow > 0 ? 1 : Math.hypot(me.vx, me.vz) > V_MAX * 1.08 ? 0.45 : 0) : 0;
    this.speedLines.update(dt, this.time, fast, this.camera.aspect);
    this.world.update(this.time, dt, this.camera.position, race.boxes, this.fx);
    if (this.needsCompile) {
      // Alle Shader jetzt übersetzen – auch die der noch unsichtbaren Effekte (Flammen,
      // Schutzring, Tempostriche). Sonst ruckelt es beim ersten Schub oder Treffer.
      this.needsCompile = false;
      this.renderer.compile(this.scene, this.camera);
    }
    this.renderer.render(this.scene, this.camera);
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
  }

  /** Funken, Staub, Flammen und Bremsspuren eines Karts. */
  private trail(k: KartView, e: RenderEntity, speed: number, air: boolean, stage: number, dt: number): void {
    const root = k.visual.root;
    root.updateMatrixWorld();
    const A = k.visual.anchors;
    const rl = this.v1.copy(A.wheelRearL).applyMatrix4(root.matrixWorld);
    const rr = this.v2.copy(A.wheelRearR).applyMatrix4(root.matrixWorld);
    const drifting = e.driftDir !== 0 && !air;
    const seg = e.seg < this.track.total ? e.seg : 0;
    // Im Wasser staubt nichts – dort spritzt es (mechanicEvents).
    const dive = (e.flags & FLAG_DIVE) !== 0;
    const wet = dive || (this.track.tidal[seg] !== 0 && this.waterLevel - e.y > WATER_FROM);
    const dust = wet ? 0 : DUST[this.track.surf[seg]];
    // Unter Wasser zieht das Kart eine Blasenspur hinter sich her.
    if (dive && speed > 5 && Math.random() < dt * (6 + speed * 0.5)) {
      const w = Math.random() < 0.5 ? rl : rr;
      this.fx.puff(w.x, w.y + 0.3, w.z, (Math.random() - 0.5) * 1.2, 1.6 + Math.random() * 1.8, (Math.random() - 0.5) * 1.2, 0.7 + Math.random() * 0.5, 0.1 + Math.random() * 0.14, 0xe8fbff, 0, -2.5);
    }
    const lv = LEVELS[this.level];
    const budget = lv.particles / LEVELS[2].particles;

    if (drifting) {
      // Funken an den Hinterrädern in der Farbe der Turbo-Stufe
      const n = (stage === 0 ? 30 : 55 + stage * 25) * budget * dt;
      this.color.set(SPARK_COLORS[stage]);
      for (const w of [rl, rr]) {
        if (Math.random() < n) {
          this.sparks.emit(
            w.x,
            w.y + 0.05,
            w.z,
            -e.vx * 0.25 + (Math.random() - 0.5) * 4,
            1.5 + Math.random() * 3.5,
            -e.vz * 0.25 + (Math.random() - 0.5) * 4,
            0.22 + Math.random() * 0.2,
            0.28 + stage * 0.07,
            this.color,
            -0.5,
            12,
            1,
          );
        }
      }
      if (lv.skid && k.hasTrail && dust === 0) {
        this.skids.add(k.rl.x, k.rl.y, k.rl.z, rl.x, rl.y, rl.z, 0.3);
        this.skids.add(k.rr.x, k.rr.y, k.rr.z, rr.x, rr.y, rr.z, 0.3);
      }
      if (Math.random() < 16 * budget * dt) {
        this.color.set(0xe9e6f2);
        const w = Math.random() < 0.5 ? rl : rr;
        this.puffs.emit(w.x, w.y + 0.15, w.z, e.vx * 0.5 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), e.vz * 0.5 + (Math.random() - 0.5) * 2, 0.32, 0.26, this.color, 0.9, -0.5, 3, 0.7);
      }
    }
    k.rl.copy(rl);
    k.rr.copy(rr);
    k.hasTrail = drifting;

    // Sand, Erde, Schotter, Wiese: eine Staubfahne in der Farbe des Bodens
    if (!air && dust !== 0 && speed > 8 && Math.random() < (8 + speed * 0.7) * budget * dt) {
      this.color.set(dust);
      const w = Math.random() < 0.5 ? rl : rr;
      this.puffs.emit(w.x, w.y + 0.12, w.z, e.vx * 0.35 + (Math.random() - 0.5) * 2.5, 1 + Math.random() * 1.8, e.vz * 0.35 + (Math.random() - 0.5) * 2.5, 0.42, 0.28, this.color, 1.1, 3, 2, 0.9);
    }
    if (!air && e.flags & FLAG_OFFROAD && speed > 6 && Math.random() < 26 * budget * dt) {
      this.color.set(this.world!.theme.shoulder).multiplyScalar(0.9);
      const w = Math.random() < 0.5 ? rl : rr;
      this.puffs.emit(w.x, w.y + 0.15, w.z, e.vx * 0.4 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, e.vz * 0.4 + (Math.random() - 0.5) * 3, 0.4, 0.3, this.color, 1.0, 4, 2, 0.9);
    }
    if (e.boost > 0 && Math.random() < 90 * budget * dt) {
      const ex = (Math.random() < 0.5 ? this.v1.copy(A.exhaustL) : this.v1.copy(A.exhaustR)).applyMatrix4(root.matrixWorld);
      if (dive) {
        // Unter Wasser sprüht kein Feuer: der Schub wirbelt Blasen auf.
        this.fx.puff(ex.x, ex.y, ex.z, e.vx * 0.3 + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.6, e.vz * 0.3 + (Math.random() - 0.5) * 2, 0.5 + Math.random() * 0.3, 0.12 + Math.random() * 0.16, 0xe8fbff, 0, -2.5);
      } else {
        this.color.set(Math.random() < 0.5 ? 0xff8a2a : 0xffd23f);
        this.sparks.emit(ex.x, ex.y, ex.z, e.vx * 0.55 + (Math.random() - 0.5) * 1.5, Math.random() * 1.2, e.vz * 0.55 + (Math.random() - 0.5) * 1.5, 0.16, 0.3, this.color, -1.2, 0, 1);
      }
    }
    if (e.stall > 0 && Math.random() < 14 * dt) {
      this.color.set(0x4a4654);
      this.puffs.emit(e.x, e.y + 1.1, e.z, (Math.random() - 0.5) * 1.5, 2.2, (Math.random() - 0.5) * 1.5, 0.8, 0.4, this.color, 1.2, -1, 1, 0.85);
    }
  }

  /** Rempler zwischen Karts: Funken zwischen beiden. */
  private bumps(entities: RenderEntity[], localSlot: number): void {
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        if (Math.abs(a.y - b.y) > 1.6 || a.respawn > 0 || b.respawn > 0) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 2.2 || d < 1e-3) continue;
        const closing = ((a.vx - b.vx) * dx + (a.vz - b.vz) * dz) / d;
        const ka = this.karts.get(a.slot);
        const kb = this.karts.get(b.slot);
        if (!ka || !kb || closing < 2.2 || ka.bumpCooldown > 0 || kb.bumpCooldown > 0) continue;
        ka.bumpCooldown = kb.bumpCooldown = 0.45;
        const local = a.slot === localSlot || b.slot === localSlot;
        this.burst((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.7, (a.z + b.z) / 2, 9, 6, 0xffe9a8, true, 0.45, 0.35, 3);
        if (closing > 6) this.pops.show('RUMMS!', (a.x + b.x) / 2, a.y + 2.4, (a.z + b.z) / 2, 'white', 2.8);
        ka.visual.squash(0.4);
        kb.visual.squash(0.4);
        this.emit('bump', a.slot === localSlot ? ka : kb, local);
        if (local) this.shake = Math.max(this.shake, 0.25);
      }
    }
  }

  // --- Kamera --------------------------------------------------------------------

  private updateCamera(me: RenderEntity | null, k: KartView | null, race: RaceView, dt: number): void {
    const cam = this.camera;
    const w = this.world!;
    const t = this.track;
    if (this.cameraMode === 'top' || !me || !k) {
      const h = w.radius * 1.5;
      cam.position.set(w.center.x, h, w.center.z - h * 0.55);
      cam.lookAt(w.center.x, 0, w.center.z);
      cam.fov = 55;
      cam.updateProjectionMatrix();
      this.camReady = false;
      return;
    }
    const speed = Math.hypot(me.vx, me.vz);
    const frac = Math.min(1.4, speed / V_MAX);

    // Blickrichtung: folgt der Fahrtrichtung, nicht der Nase – im Drift sieht man das Kart schräg.
    let wantYaw = speed > 4 ? Math.atan2(me.vx, me.vz) : me.heading;
    if (me.spin > 0 || me.respawn > 0) wantYaw = this.camYaw;
    if (!this.camReady) this.camYaw = me.heading;
    this.camYaw += wrapAngle(wantYaw - this.camYaw) * Math.min(1, dt * (me.driftDir !== 0 ? 3.2 : 5.5));

    const intro = race.phase === RACE_COUNTDOWN ? Math.max(0, Math.min(1, (race.untilGo - 3.1) / 2.3)) : 0;
    const done = me.finished || race.phase === RACE_RESULTS;
    let yaw = this.camYaw;
    // Im Gleitflug rückt die Kamera ab und höher: man sieht Ringe, Aufwinde und die Landebahn kommen.
    this.camGlide += (((me.flags & FLAG_GLIDE) !== 0 && me.respawn === 0 ? 1 : 0) - this.camGlide) * Math.min(1, dt * 2.6);
    let dist = 5.3 + frac * 1.1 + this.camGlide * 2.6;
    let height = 2.45 + frac * 0.25 + this.camGlide * 1.5;
    let lookAhead = 3.2 + this.camGlide * 5;
    if (intro > 0) {
      // Kamerafahrt: von schräg vorn über die Startaufstellung nach hinten ins Heck.
      const s = intro * intro * (3 - 2 * intro);
      // Zur Streckenmitte hin schwenken, nicht in die Bande.
      projectOnTrack(t, me.x, me.z, me.seg);
      yaw += s * 2.5 * (proj.lat < 0 ? 1 : -1);
      dist += s * 5;
      height += s * 2.2;
      lookAhead *= 1 - s;
    } else if (done) {
      this.orbit += dt * 0.5;
      yaw = me.heading + Math.PI + Math.sin(this.orbit) * 1.1;
      dist = 8.4;
      height = 2.7;
      lookAhead = 0;
    } else this.orbit = 0;

    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    // Hang voraus: am Berg schaut die Kamera hinauf, im Gefälle hinunter.
    const seg = me.seg < t.total ? me.seg : 0;
    const ahead = walk(t, seg, 6);
    const rise = Math.max(-2.5, Math.min(2.5, t.py[ahead] - t.py[seg]));
    const air = (me.flags & FLAG_AIR) !== 0;

    const px = me.x - dx * dist;
    const pz = me.z - dz * dist;
    let py = me.y + height - rise * 0.25;
    // Nie unter die Fahrbahn rutschen.
    projectOnTrack(t, px, pz, me.seg);
    const g = groundAt(t, proj.seg, proj.along, proj.lat);
    if (g !== NO_GROUND && py < g + 1.3) py = g + 1.3;

    if (!this.camReady) {
      this.camPos.set(px, py, pz);
      this.camLook.set(me.x, me.y + 1.1, me.z);
      this.camReady = true;
    }
    const follow = Math.min(1, dt * (intro > 0 || done ? 4 : 13));
    this.camPos.x += (px - this.camPos.x) * follow;
    this.camPos.z += (pz - this.camPos.z) * follow;
    // In der Höhe träger: Sprünge und Kuppen spürt man, weil das Kart im Bild steigt und fällt.
    this.camPos.y += (py - this.camPos.y) * Math.min(1, dt * (air ? 3.2 : 7));
    this.camLook.x += (me.x + dx * lookAhead - this.camLook.x) * Math.min(1, dt * 14);
    this.camLook.z += (me.z + dz * lookAhead - this.camLook.z) * Math.min(1, dt * 14);
    this.camLook.y += (me.y + 1.15 + rise * 0.4 - this.camLook.y) * Math.min(1, dt * 9);

    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    // Leichte Schräglage in Kurven
    cam.rotateZ(-k.steer * 0.035 * Math.min(1, frac) - me.driftDir * 0.03);
    this.applyShake(dt);

    const wantFov = 60 + frac * 7 + (me.tow > 0 ? 8 : me.boost > 0 ? 9 : 0) + this.camGlide * 5;
    this.camFov += (wantFov - this.camFov) * Math.min(1, dt * 5);
    if (Math.abs(cam.fov - this.camFov) > 0.05) {
      cam.fov = this.camFov;
      cam.updateProjectionMatrix();
    }
  }

  private applyShake(dt: number): void {
    if (this.shake <= 0.002) return;
    const s = this.shake;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s * 0.8;
    this.camera.rotateZ((Math.random() - 0.5) * s * 0.06);
    this.shake *= Math.exp(-dt * 9);
  }

  // --- Qualität --------------------------------------------------------------------

  /** Misst die Bildrate und passt bei „Automatisch“ die Auflösung an. */
  private measure(dt: number): void {
    this.frameTimes += dt;
    this.frameCount++;
    if (this.frameTimes < 1) return;
    const fps = this.frameCount / this.frameTimes;
    this.stats.fps = fps;
    this.frameTimes = 0;
    this.frameCount = 0;
    if (this.quality !== 'auto') return;
    const now = this.time;
    if (fps < 50) {
      // Erst die Auflösung senken, dann eine Stufe herunter.
      if (this.scale > 0.62) this.scale = Math.max(0.6, this.scale - (fps < 38 ? 0.2 : 0.1));
      else if (this.level > 0) {
        this.level--;
        this.scale = 0.85;
        this.applyLevel();
      }
      this.lastDrop = now;
      this.resize();
      // Wer von "Hoch" wieder herunter musste, bleibt für diese Sitzung unten.
      if (this.triedHigh) this.highFailed = true;
    } else if (fps > 57.5 && now - this.lastDrop > 8 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.resize();
    } else if (fps > 58.5 && this.scale >= 1 && this.level === 1 && !this.highFailed && now - this.lastDrop > 12 && ++this.smoothSeconds > 12) {
      // Läuft "Mittel" lange rund, einmal "Hoch" versuchen (volle Auflösung, feinere Karts).
      this.level = 2;
      this.triedHigh = true;
      this.smoothSeconds = 0;
      this.applyLevel();
    }
    if (fps <= 58.5) this.smoothSeconds = 0;
  }

  /** Zustand aller sichtbaren Karts für die Dauergeräusche. */
  /** Nur für Messungen: Aufbauzeiten der Welt in ms (Fahrbahn, Gelände/Himmel, Kulisse, Leben). */
  buildTimes(): number[] {
    return this.world?.buildTimes ?? [];
  }

  /** Nur für Tests und Messungen: Dreiecke je Bauteil der Szene. */
  debugTree(): { name: string; triangles: number }[] {
    const count = (o: THREE.Object3D): number => {
      let n = 0;
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh || !m.visible) return;
        const g = m.geometry;
        const tris = (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
        n += tris * ((m as unknown as THREE.InstancedMesh).isInstancedMesh ? (m as unknown as THREE.InstancedMesh).count : 1);
      });
      return Math.round(n);
    };
    const out: { name: string; triangles: number }[] = [];
    const label = (o: THREE.Object3D, i: number): string => `${i}:${o.name || o.type}${(o as THREE.Mesh).isMesh ? '/' + ((o as THREE.Mesh).material as THREE.Material).type : ''}`;
    this.world?.group.children.forEach((o, i) => out.push({ name: 'Welt ' + label(o, i), triangles: count(o) }));
    this.scene.children.forEach((o, i) => {
      if (o !== this.world?.group) out.push({ name: label(o, i), triangles: count(o) });
    });
    return out.filter((x) => x.triangles > 0);
  }

  kartAudio(out: KartAudio[]): KartAudio[] {
    out.length = 0;
    for (const k of this.karts.values()) if (k.seen) out.push(k.audio);
    return out;
  }
}
