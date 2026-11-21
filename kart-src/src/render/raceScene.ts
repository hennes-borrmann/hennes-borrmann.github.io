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
  ITEM_ROCKET,
  ITEM_SMOKE,
  ITEM_TIRE,
  ITEM_TOP,
  ITEM_WING,
  DRILL_DIG_TICKS,
  DRILL_FORE,
  DRILL_PLANT_TICKS,
  DRILL_SIDE,
  DRILL_RISE_TICKS,
  DRILL_WARN_TICKS,
  GOLD_ALL,
  GOLD_DRINK_TICKS,
  GOLD_SCALE,
  GOLD_TICKS,
  GOLD_WARN,
  GLUE_FIRE,
  GLUE_HIT,
  ROBOT_LEAP_AT,
  goldOn,
  PAD_TICKS,
  SPIN_TICKS,
  ROCKET_FLY_TICKS,
  ROCKET_MORPH_TICKS,
  ROCKET_TICKS,
  V_MAX,
  ringAt,
  thermalLift,
  turboStage,
  lavaAt,
  windPush,
} from '../game/sim';
import {
  DRAFT_FULL,
  DRAFT_PULL_FROM,
  FLOOD_FROM,
  PULSE_AVALANCHE,
  gustStrength,
  PULSE_BUBBLE,
  PULSE_ICICLE,
  PULSE_BOLT,
  PULSE_METEOR,
  PULSE_BLAST,
  PULSE_FLAME,
  PULSE_ROD,
  PULSE_PRESS,
  PULSE_VENT,
  WATER_FROM,
  ERA_WARN,
  eraSince,
  eraUntil,
  planActive,
  portalOpen,
  SIZE_WARN,
  sizeClass,
  sizeScale,
  pulseCycle,
  pontoonShift,
  tideLevel,
  vehicleAt,
  vehicleSpeed,
  VEH_STADTBAHN,
  BAND_HOVER,
} from '../game/mechanics';
import { clearStep, isCareful, markStep, readCrash, skipList } from './gfxGuard';
import { buildMechanics, type MechanicView } from './mechanics';
import { SURFACES } from '../game/surface';
import { crawlerPose, EDGE_BAND, EDGE_DRUM, EDGE_GAP, EDGE_RAIL, EDGE_RIVER, EDGE_TWIST, NO_GROUND, TRACK, railOf, groundNow, newVehiclePose, progDelta, proj, projectOnTrack, raftLane, rightX, rightZ, twistRadiusAt, twistRollAt, twistWarp, vehiclePose, walk, type Track } from '../game/track';
import { CHANNEL, CHANNEL_FLOOR, DAM_AIR, DAM_CZ, RIVER_Y } from './life/talsperreLand';
import { FALL } from './life/baumLand';
import { DAUER, LAEUTEN, TURM } from './life/daecherLand';
import { RAKETE } from '../game/tracks/rampe';
import type { RaceView, RenderEntity } from '../game/view';
import { RACE_COUNTDOWN, RACE_RESULTS, THING_DRILL, THING_SMOKE, THING_TIRE, THING_TOP, type SnapshotThing } from '../net/protocol';
import { PLAYER_COLORS } from '../util/players';
import { BlobShadows, Bolts, ComicPops, LightPools, Particles, SkidMarks, SpeedLines } from './effects';
import type { FxSink } from './fxApi';
import { KartVisual, type KartDetail, type KartPose } from './kartModel';
import { Cockpit, COCKPIT_LAYER } from './firstPerson';
import { GlueShots } from './glueShots';
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
    | 'use-kite'
    /** Rakete: Verwandlung beginnt; sie hebt ab; eine fremde stürzt auf das eigene Kart herab (nur eigenes Kart); Einschlag. */
    | 'use-rocket'
    /** Gleiter: Absprung (die Flügel gehen dann mit 'wings' auf). */
    | 'use-wing'
    /** Roboter: das Kart verwandelt sich (Servos, Einrasten) / ein Fuß setzt auf / Satz nach vorn, im Sprung zurück. */
    | 'use-robot'
    | 'robot-step'
    | 'robot-jump'
    /** Kleber: die Pistole klappt aus / der Klumpen verlässt sie / er klatscht auf (Fahrer oder Fahrbahn). */
    | 'use-glue'
    | 'glue-shot'
    | 'glue-hit'
    /**
     * Get Gold: Austrinken beginnt (Gluckern) / ausgetrunken, das Kart wird gold und groß / es ist abgelaufen / ein Gold-Kart
     * haut ein anderes um (am Getroffenen gemeldet) / ein Item prallt an einem Gold-Kart ab.
     */
    | 'use-gold'
    | 'gold'
    | 'gold-end'
    | 'gold-ram'
    | 'gold-ping'
    | 'rocket-launch'
    | 'rocket-incoming'
    | 'rocket-hit'
    /**
     * Bohrer: die Figur steckt ihn in den Boden (Ausholen, Hineinrammen) / ein Stoß Bohrgeräusch (wiederholt, ortsfest; die
     * Tonhöhe steigt mit dem Tempo, siehe pitch) / es grollt unter dem eigenen Kart, er kommt gleich (nur das Ziel) / er
     * bricht durch die Fahrbahn / er explodiert.
     */
    | 'use-drill'
    | 'drill'
    | 'drill-rumble'
    | 'drill-burst'
    | 'drill-blast'
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
    | 'meteor'
    /** Sturmhafen: eine Böe setzt ein (slot −1, ortsfest), das eigene Kart steckt in der Böe (wiederholt). */
    | 'gust'
    | 'storm'
    /**
     * Vulkaninsel (alle ortsfest, slot −1): eine Platte beginnt zu bröckeln / bricht weg;
     * ein Weg schließt sich (die Brücke stürzt ein) / öffnet sich (die Lavaröhre läuft leer).
     */
    | 'crumble'
    | 'crack'
    | 'collapse'
    | 'drain'
    /** Zeitriss-Ruine (überall zu hören): der Sprung der Zeit kündigt sich an (Gong) / die Zeit reißt. */
    | 'riftwarn'
    | 'rift'
    /**
     * Gewitterkamm: ein Blitz schlägt auf der Bahn ein / fährt in einen Blitzableiter (beide ortsfest, slot −1);
     * fernes Donnergrollen nach einem Wetterleuchten (überall); ein Kart wird im Ladefeld aufgeladen.
     */
    | 'thunder'
    | 'rod'
    | 'rumble'
    | 'charge'
    /**
     * Dschungel-Fluss: das Kart rollt auf ein (anderes) Floß; das eigene Kart fährt auf dem Fluss (wiederholt);
     * das Tosen des Wasserfalls (ortsfest, wiederholt, solange man in der Nähe ist).
     */
    | 'raft'
    | 'rapids'
    | 'falls'
    /** Spiegelkabinett: ein Kart fährt durch ein Portal, das vorwärts führt / durch eines, das zurückwirft. */
    | 'portal'
    | 'mirror'
    /** Spiegelkabinett (ortsfest, slot −1): in einem Rahmen erscheint oder verschwindet ein Spiegel. */
    | 'shimmer'
    /**
     * Wüstenexpress: die Lok pfeift (ortsfest an der Lok, in festem Takt) / ein Zug rollt dicht am eigenen Kart
     * vorbei (ortsfest, wiederholt) / ein Kart rollt über die Rampe aufs Dach / das eigene Kart fährt über die
     * Dächer (wiederholt).
     */
    | 'whistle'
    | 'trainpass'
    | 'board'
    | 'rattle'
    /** Riesenkinderzimmer: ein Kart schrumpft / wächst (durch einen Ring gefahren) / ist wieder normal groß. */
    | 'shrink'
    | 'grow'
    | 'sizeend'
    /** Riesenkinderzimmer: ein riesiges Kart bricht durch die Bauklotz-Mauer. */
    | 'smash'
    /**
     * Achterbahn-Rummel: ein Kart rastet auf den Schienen ein / das eigene rollt darauf (wiederholt) / die Kette des
     * Lifthügels rattert unter dem eigenen (wiederholt) / ein Schubmagnet ruckt ein Kart an / das eigene kippt schnell
     * über eine Kuppe.
     */
    | 'latch'
    | 'coaster'
    | 'chain'
    | 'kick'
    | 'crest'
    /**
     * Kristallmine: eine Sprengladung geht hoch (ortsfest) / das Sprenghorn warnt vor ihr (ortsfest) / im Sprengort bricht
     * das Geröll nach (ortsfest) / das eigene Kart rattert in der Lore über die Schienen (wiederholt, statt 'coaster').
     */
    | 'blast'
    | 'siren'
    | 'rubble'
    | 'lore'
    /**
     * Magnetwerk: die Magnete packen das eigene Kart beim Einfahren in die Trommel / das eigene Kart fährt in der Trommel
     * (wiederholt; ortsfest gemeldet, damit der Pegel – er trägt die Verdrehung – ankommt) / eine Deckenplatte schaltet ab
     * bzw. wieder an (ortsfest, slot −1).
     */
    | 'clamp'
    | 'hum'
    | 'magnetoff'
    | 'magneton'
    /** Baumkronenpfad (ortsfest, slot −1): eine Hängebrücke knarzt am Ende eines Pendelschlags / ein Tannenzapfen schlägt auf. */
    | 'creak'
    | 'cone'
    /** Dächerjagd (ortsfest, slot −1): die Straßenbahn klingelt / ein Schlag der Kirchenglocken. */
    | 'trambell'
    | 'bells'
    /**
     * Startrampe: der Countdown piept (überall zu hören); eine Rakete hebt ab bzw. setzt zur Landung an (an der Rakete);
     * der Raupentransporter rasselt (ortsfest, wiederholt, solange man in der Nähe ist).
     */
    | 'beep'
    | 'liftoff'
    | 'crawler';
  slot: number;
  local: boolean;
  /** -1 links … 1 rechts, aus Sicht der Kamera */
  pan: number;
  /** 0..1 nach Entfernung */
  gain: number;
  /** Tonhöhe als Faktor (1 = wie im Rezept) – nur wo das Geräusch sie nutzt (Bohrer). */
  pitch?: number;
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
  /** Dauer des laufenden Schleuderns in Ticks – für die Drehung im Bild. */
  spinFull: number;
  /** Rakete: Ticks seit dem Zünden im letzten Bild (0 = keine); Pause bis zum nächsten Klacken der Verwandlung. */
  rocket: number;
  /** Rakete: Ausrichtung im Flug (geglättet) und ob das Herabpfeifen für das eigene Kart schon kam. */
  rocketQ: THREE.Quaternion;
  incoming: boolean;
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
  /** Sturmhafen: steckt gerade in einer Böe / Zeit bis zur nächsten Meldung. */
  gusty: boolean;
  gustWait: number;
  /** Dschungel-Fluss: auf welcher Floßbahn das Kart zuletzt stand (−1 = auf keiner) / Zeit bis zur nächsten Meldung. */
  raft: number;
  riverWait: number;
  /** Spiegelkabinett: wo das Kart im letzten Bild stand (ein Sprung von dort ist eine Fahrt durchs Portal). */
  lastX: number;
  lastY: number;
  lastZ: number;
  lastSeg: number;
  /** Wüstenexpress: steht das Kart auf einem Wagendach? / Zeit bis zur nächsten Meldung des eigenen Karts. */
  roof: boolean;
  roofWait: number;
  /** Achterbahn-Rummel: sitzt auf der Schiene; Wartezeiten für Rollen und Kettenrattern; Steigung und Schub im vorigen Bild. */
  rail: boolean;
  railWait: number;
  chainWait: number;
  slopeWas: number;
  boostWas: number;
  /** Magnetwerk: in der Magnettrommel im letzten Bild; Zeit bis zum nächsten Brummen des eigenen Karts. */
  drum: boolean;
  /** Schwebeband: wie weit das Kart gerade schwebt (0 … 1, weich nachgeführt). */
  hoverK: number;
  humWait: number;
  /** Riesenkinderzimmer: Größenklasse im letzten Bild (−1/0/1) und der gezeigte Maßstab (weich nachgeführt). */
  sizeWas: number;
  sizeK: number;
  /** Riesenkinderzimmer: ist das Kart gerade auf dem eigenen Stück der Abkürzung durch die Bauklotz-Burg? */
  inCastle: boolean;
  /** Get Gold: Restzeit im letzten Bild (Ticks, wie KartState.gold). */
  gold: number;
  /** Roboter: Ticks seit dem Auslösen im letzten Bild, dieselbe Zeit weich in Sekunden, zuletzt gesehene Schrittzahl. */
  robot: number;
  robotT: number;
  robotSteps: number;
  /** Kleber: Restzeit im letzten Bild (Ticks); Pistole: Zeit seit dem Auslösen (weich, Sekunden); der Schuss ist raus / angekommen. */
  glue: number;
  gunT: number;
  shotOut: boolean;
  shotDone: boolean;
  /** Kleber: wo der Klumpen die Pistole verlassen hat und wo er ohne Ziel aufklatscht (Welt). */
  shotFrom: THREE.Vector3;
  shotMiss: THREE.Vector3;
  /** Bohrer: Einstecken im letzten Bild (Ticks, wie KartState.plant). */
  plant: number;
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
/** Get Gold: Farben des Glitzerns. */
const GOLD_SPARKS = [0xffd34a, 0xffe98a, 0xffb31f, 0xfff0b0];

/** Farbe der Staubfahne je Untergrund (0 = fester Boden, kein Staub); Reihenfolge wie SURFACES. */
const DUST: number[] = SURFACES.map((s) => ({ sand: 0xe9d49a, dirt: 0xa07a54, gravel: 0xb5aea4, grass: 0x8cc463, snow: 0xffffff, regolith: 0xc9c6d2 } as Record<string, number>)[s.id] ?? 0);

/**
 * Ticks aus dem Spielstand (0 = aus) → weich laufende Sekunden für die Darstellung: Fremde Karts melden ihren Stand nur
 * stoßweise; dazwischen läuft die Zeit mit dem Bild weiter und wird sacht nachgezogen. Große Sprünge werden übernommen.
 */
/** Roboter: wann (s nach dem Auslösen) Knie, Schultern und Fäuste einrasten und wie hoch über der Fahrbahn das ist (m). */
const ROBOT_CLACKS: readonly (readonly [number, number])[] = [
  [0.21, 0.8],
  [0.29, 2.1],
  [0.39, 1.8],
];

function followTicks(cur: number, ticks: number, dt: number): number {
  if (ticks <= 0) return 0;
  const want = ticks / 60;
  if (cur <= 0 || Math.abs(cur - want) > 0.15) return want;
  const next = cur + dt;
  return next + (want - next) * Math.min(1, dt * 8);
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

const KEY_NO_HIGH = 'schraeglage.gfx.ohneHoheLeistung';
let noHighPerformance = false;
/** Wurde der zuletzt angelegte Renderer mit „hoher Leistung“ angefordert? */
let usedHighPerformance = false;
/** Mit welchem Anlauf der zuletzt angelegte Renderer entstand – für die Meldung bei Grafikproblemen. */
let contextInfo = '';

/**
 * Soll der Grafikkontext mit powerPreference „high-performance“ angefordert werden?
 *
 * Auf Rechnern mit zwei Grafikkarten wählt der Browser damit die schnelle. Auf einem iPad (10. Generation,
 * Safari 26.2) kam aber jeder so angeforderte Kontext verloren an oder ging nach dem ersten Bild verloren – mit
 * „default“ und „low-power“ lief alles (gemessen mit grafiktest.html). Deshalb: nie in WebKit (Safari und alle
 * Browser auf iPhone/iPad; dort gibt es ohnehin nur eine Grafikeinheit) und nie mehr auf einem Gerät, auf dem es
 * einmal schiefging.
 */
function wantsHighPerformance(): boolean {
  if (noHighPerformance) return false;
  const ua = navigator.userAgent;
  if (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\/|Android/.test(ua)) return false;
  try {
    if (localStorage.getItem(KEY_NO_HIGH)) return false;
  } catch {
    // kein Speicher: dann gilt nur die Erfahrung dieses Seitenaufrufs
  }
  return true;
}

function avoidHighPerformance(): void {
  noHighPerformance = true;
  try {
    localStorage.setItem(KEY_NO_HIGH, '1');
  } catch {
    // siehe oben
  }
}

/**
 * Legt den WebGL-Renderer an. Ein iPad lieferte mit den Wunsch-Einstellungen einen Kontext, der schon verloren war.
 * Deshalb mehrere Anläufe mit anderen Einstellungen – jeder auf einer frischen Zeichenfläche, denn eine Fläche
 * behält ihren ersten Kontext (weitere getContext-Aufrufe liefern nur wieder denselben). Der zweite Anlauf lässt
 * dem Browser alle Vorgaben, wie es die schlichtesten Testseiten tun. Scheitert alles, nennt der Fehler jeden Anlauf.
 */
function createRenderer(first: HTMLCanvasElement): THREE.WebGLRenderer {
  const high = wantsHighPerformance();
  const tries: [string, THREE.WebGLRendererParameters | null][] = [
    ['Wunsch', { antialias: window.devicePixelRatio < 1.5, powerPreference: high ? 'high-performance' : 'default' }],
    ['Vorgaben des Browsers', null],
    ['schlicht', { antialias: false }],
    ['sparsam', { antialias: false, stencil: false, powerPreference: 'low-power' }],
  ];
  const errors: string[] = [];
  let canvas = first;
  for (let i = 0; i < tries.length; i++) {
    const [name, params] = tries[i];
    if (i > 0) {
      // An der alten Fläche hängt der gescheiterte Kontext: eine gleiche neue an ihre Stelle setzen.
      const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
    // Der Browser nennt seinen Grund in einem eigenen Ereignis.
    let reason = '';
    const onError = (e: Event): void => {
      reason = (e as WebGLContextEvent).statusMessage || reason;
    };
    canvas.addEventListener('webglcontextcreationerror', onError);
    try {
      let renderer: THREE.WebGLRenderer;
      if (params) renderer = new THREE.WebGLRenderer({ canvas, ...params });
      else {
        const context = canvas.getContext('webgl2');
        if (!context) throw new Error('kein Kontext');
        if (context.isContextLost()) throw new Error('Kontext kam schon verloren an');
        renderer = new THREE.WebGLRenderer({ canvas, context });
      }
      if (renderer.getContext().isContextLost()) {
        renderer.dispose();
        throw new Error('Kontext kam schon verloren an');
      }
      usedHighPerformance = i === 0 && high;
      contextInfo = `${name}${i === 0 ? ` (Leistung ${high ? 'hoch' : 'normal'})` : ''}${errors.length > 0 ? ` nach ${errors.length} gescheiterten Anläufen` : ''}`;
      return renderer;
    } catch (err) {
      // Mit „hoher Leistung“ gescheitert: auf diesem Gerät nicht wieder verlangen.
      if (i === 0 && high) avoidHighPerformance();
      let text = err instanceof Error ? err.message : String(err);
      // Abfragen an einen verlorenen Kontext liefern null – three.js stolpert dann über die erste davon.
      if (/getShaderPrecisionFormat|getContextAttributes/.test(text)) text = 'Kontext kam schon verloren an';
      errors.push(`${name}: ${text}${reason ? ` (Browser: ${reason})` : ''}`);
    } finally {
      canvas.removeEventListener('webglcontextcreationerror', onError);
    }
  }
  throw new Error(errors.join(' · '));
}

/** Ein Bildpunkt zum Auslesen: erzwingt beim behutsamen Aufbau, dass der Browser wirklich gezeichnet hat. */
const PROBE = new Uint8Array(4);

/** Marke für den Abschnitt „leere Fläche anzeigen“ des behutsamen Aufbaus. */
const SHOW_EMPTY = 'Anzeigen der leeren Zeichenfläche';
/** Ebene, auf der der behutsame Aufbau die Teile einzeln zeichnet. */
const WARM_LAYER = 30;
/** Sichtbarkeit der Kette vom Teil bis zur Wurzel, zum Zurücksetzen. */
const WARM_KEEP: boolean[] = [];

/**
 * Alle zeichenbaren Teile einer Szene mit einem Namen, der zwischen zwei Seitenaufrufen gleich bleibt:
 * Pfad der benannten Gruppen · Art · Material · Zahl der Ecken (bei Gleichstand durchgezählt).
 */
function labelRenderables(root: THREE.Object3D): { obj: THREE.Object3D; label: string }[] {
  const out: { obj: THREE.Object3D; label: string }[] = [];
  const counts = new Map<string, number>();
  const walk = (o: THREE.Object3D, path: string): void => {
    const here = o.name ? (path ? `${path}/${o.name}` : o.name) : path;
    const r = o as THREE.Mesh & { isPoints?: boolean; isLine?: boolean; isSprite?: boolean };
    if (r.isMesh || r.isPoints || r.isLine || r.isSprite) {
      const mat = (Array.isArray(r.material) ? r.material[0] : r.material) as THREE.Material | undefined;
      const verts = r.geometry?.attributes?.position?.count ?? 0;
      const kind = `${here || 'ohne Namen'} · ${o.type} · ${mat?.name || mat?.type || '?'} · ${verts}`;
      const n = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, n);
      out.push({ obj: o, label: n > 1 ? `${kind} (${n})` : kind });
    }
    for (const c of o.children) walk(c, here);
  };
  walk(root, '');
  return out;
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

const Y_UP = new THREE.Vector3(0, 1, 0);
/**
 * Schwebeband an der Fassade: Um diesen Anteil der Verdrehung kippt „oben“ der Kamera mit (1 = ganz). Ganz: Das Band liegt
 * im Bild vor einem wie eine Straße – links ist links –, die Welt dreht sich drumherum.
 */
const TWIST_CAM_UP = 1;
const ROCKET_Q = new THREE.Quaternion();

/** So viel weiter als in der Rechnung gilt ein Schubring für die Anzeige als durchflogen (das Bild läuft dem Treffer leicht nach). */
const RING_SEEN = 2.5;

/** Ansicht des eigenen Karts: von hinten (Verfolger) oder aus dem Cockpit. */
export type ViewMode = 'third' | 'first';

export class RaceScene {
  cameraMode: 'chase' | 'top' = 'chase';
  /** Verfolger oder Cockpit (Einstellung je Bildschirm, siehe app.ts). */
  view: ViewMode = 'third';
  /** Cockpit-Ansicht: Kamera im Kopf, zweiter Durchgang fürs eigene Kart (firstPerson.ts). */
  private readonly cockpit = new Cockpit();
  /** Im letzten Bild aus dem Cockpit gesehen (beim Wechsel setzt die Verfolgerkamera neu an). */
  private fpWas = false;
  /** Fotokamera: fester Standort, Blickpunkt und Bildwinkel – null = normale Kamera. */
  photo: { from: number[]; to: number[]; fov: number } | null = null;
  /** Wie tief das eigene Kart in einer Rauchwolke steckt (0..1) – die Oberfläche legt einen Schleier darüber. */
  smoke = 0;
  /** Wie nah ein Brummkreisel ist, der das eigene Kart sucht (0 = keiner, 1 = gleich da). */
  threat = 0;
  /** Eine fremde Rakete hat das eigene Kart als Ziel: 0 = keine, sonst wie weit sie ist (bis 1 = Einschlag). */
  rocket = 0;
  /** Ein fremder Bohrer hat das eigene Kart als Ziel: 0 = keiner, sonst 0,01 … 1 (1 = er bricht gleich durch). */
  drill = 0;
  onEvent: ((e: SceneEvent) => void) | null = null;
  /** buildMs = so lange hat der Aufbau der Welt zuletzt gedauert. */
  readonly stats = { fps: 60, calls: 0, triangles: 0, level: 1, scale: 1, ratio: 1, buildMs: 0 };
  /**
   * Zustand der Grafik, für die Meldung auf dem Bildschirm, wenn der Browser nicht (mehr) zeichnet:
   * Kontextverluste (und wann der erste kam) und abgelehnte Grafikprogramme. (Eine Stichprobe ausgelesener
   * Bildpunkte gab es kurz auch – jedes Auslesen hält das Bild an und ließ das Rennen beim Start ruckeln.)
   */
  readonly gfx = {
    lost: 0,
    restored: 0,
    isLost: false,
    lostWhen: '',
    frames: 0,
    shaderErrors: [] as string[],
    /** Mit welchen Einstellungen der Kontext entstand. */
    context: '',
    /** Behutsamer Aufbau: Anteil der vorbereiteten Teile (0 … 1), −1 = läuft nicht. */
    warm: -1,
    /** Teile, die auf diesem Gerät ausgelassen werden, weil sie die Grafik beendet haben. */
    skipped: [] as string[],
  };
  /** Eine neue Welt steht: ihr erstes Bild wird Teil für Teil vorbereitet (siehe gfxGuard.ts). */
  private stagedPending = false;
  private warmList: { obj: THREE.Object3D; label: string }[] | null = null;
  private warmIndex = 0;
  /** Abschnitt des behutsamen Aufbaus: 0 einzeln, 1 leere Fläche zeigen, 2 gemeinsam (siehe stepWarmup). */
  private warmPhase = 0;
  private readonly warmVisible = new Map<THREE.Object3D, boolean>();
  private readonly warmCulled: THREE.Object3D[] = [];
  private warmWhere = '';

  /** Was die Szene gerade tut – steht in der Meldung, falls der Kontext dabei verloren geht. */
  private phase = 'Aufbau';

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1.6, 0.3, 4200);
  private world: World | null = null;
  private things: ThingVisuals | null = null;
  /** Verkehr, Geysire, Lava – was die Strecke an Mechanik hat (mechanics.ts). */
  private mechanics: MechanicView[] = [];
  private mechTime = 0;
  /** Startrampe: Lage des Raupentransporters (wiederverwendet). */
  private readonly crawl = { x: 0, z: 0, vx: 0, vz: 0 };
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
  /** Scheinwerferkegel der Karts – nur auf dunklen Strecken zu sehen. */
  private readonly lights = new LightPools(8);
  private readonly bolts = new Bolts();
  /** In diesem Bild: wer einen Kurzschluss ausgelöst hat und wen er gerade erwischt. */
  private readonly empFrom: KartView[] = [];
  /** Get Gold: die Karts, die in diesem Bild gold sind; welche Dinge im letzten Bild wo waren (abgeprallt?). */
  private readonly goldList: RenderEntity[] = [];
  private readonly thingsWere = new Map<number, { x: number; y: number; z: number }>();
  /** Bohrer, die im letzten Bild da waren (Nummer → Stand, Pause bis zum nächsten Bohrgeräusch, schon gegrollt?). */
  private readonly drills = new Map<number, { x: number; y: number; z: number; stage: number; target: number; wait: number; rumbled: boolean; seen: boolean }>();
  private localSlot = -1;
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
  /**
   * Schwebeband an der Fassade: Drehung um die Achse, die einen flach gerechneten Punkt an seine gezeigte Stelle bringt
   * (twistTurn setzt sie), Punkt auf der Achse, Achsrichtung, Winkel; Abschnitt für Effekte (−1 = keiner).
   */
  private readonly dq = new THREE.Quaternion();
  private readonly dAxis = new THREE.Vector3();
  private readonly dTan = new THREE.Vector3();
  private readonly dP = { x: 0, y: 0, z: 0 };
  private dAngle = 0;
  private fxSeg = -1;
  /** Verdrehte Stücke: jeder zweite Abschnitt und das umschließende Rechteck (schnelle Suche für Dinge in der Nähe). */
  private twistSegs: number[] = [];
  private twistBox = [0, 0, 0, 0];
  /**
   * Kamera an der verdrehten Bahn: geglätteter Winkel (kein Ruck zwischen Abschnitten, nach einem Neuaufsetzen kein
   * Sprung) und die zuletzt gültige Achse.
   */
  private camTwist = 0;
  private readonly camAxis = new THREE.Vector3();
  private readonly camTan = new THREE.Vector3(0, 0, 1);
  private readonly cq = new THREE.Quaternion();
  private shake = 0;
  private hitstop = 0;
  private orbit = 0;
  /** Kamera der eigenen Rakete im Flug: Versatz zur Rakete (geglättet). */
  private rocketCam = false;
  private readonly rocketOff = new THREE.Vector3();
  private raceId = -1;
  /** Neue Welt oder neue Karts: vor dem nächsten Bild alle Shader übersetzen. */
  private needsCompile = true;

  private readonly color = new THREE.Color();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly q1 = new THREE.Quaternion();
  private readonly e1 = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly flat = new THREE.Quaternion();
  private readonly m1 = new THREE.Matrix4();
  /** Kleber: Ziel der Pistole im Raum des schießenden Karts (wird je Bild neu gesetzt). */
  private readonly gunAim = new THREE.Vector3();
  private readonly glueP = new THREE.Vector3();
  private readonly glueD = new THREE.Vector3();
  /** Kleber: Klumpen im Flug und Kleckse auf der Fahrbahn. */
  private glueShots: GlueShots | null = null;
  /** Kleber auf dem eigenen Bildschirm: Restzeit in Sekunden und wie oft es das eigene Kart schon erwischt hat (neue Kleckse). */
  glue = 0;
  glueHits = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    quality: Quality = 'auto',
  ) {
    this.renderer = createRenderer(canvas);
    // (Der Renderer kann auf einer frischen Fläche entstanden sein, die an die Stelle der übergebenen getreten ist.)
    this.canvas = canvas = this.renderer.domElement;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Verliert der Browser den Grafikkontext (Absturz seines Grafikprozesses, Speichernot, App im Hintergrund),
    // bleibt das Bild schwarz, ohne dass ein Fehler fällt. Mitschreiben, damit es gemeldet werden kann.
    const high = usedHighPerformance;
    this.gfx.context = contextInfo;
    canvas.addEventListener('webglcontextlost', () => {
      // Ging ein Kontext mit „hoher Leistung“ verloren, verlangt der Neuaufbau (und jedes spätere Laden) sie nicht mehr.
      if (high) avoidHighPerformance();
      this.gfx.lost++;
      this.gfx.isLost = true;
      if (!this.gfx.lostWhen) this.gfx.lostWhen = `${this.phase}, nach ${this.gfx.frames} Bildern`;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.gfx.restored++;
      this.gfx.isLost = false;
      this.needsCompile = true;
    });
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      const text = `${gl.getProgramInfoLog(program) ?? ''} ${gl.getShaderInfoLog(vs) ?? ''} ${gl.getShaderInfoLog(fs) ?? ''}`.replace(/\s+/g, ' ').trim();
      console.error('Grafikprogramm abgelehnt:', text);
      if (this.gfx.shaderErrors.length < 3) this.gfx.shaderErrors.push(text.slice(0, 220) || 'ohne Begründung');
    };
    this.quality = quality;
    this.level = quality === 'low' ? 0 : quality === 'high' ? 2 : 1;
    const cap = LEVELS[2].particles;
    this.puffs = new Particles(cap, false);
    this.sparks = new Particles(Math.round(cap * 0.7), true);
    this.skids = new SkidMarks(520);
    this.scene.add(this.camera, this.puffs.points, this.sparks.points, this.skids.mesh, this.pops.group, this.shadows.mesh, this.bolts.group);
    // Namen: unter ihnen meldet der behutsame Aufbau, bei welchem Teil die Grafik stirbt.
    this.puffs.points.name = 'Staub';
    this.sparks.points.name = 'Funken';
    this.skids.mesh.name = 'Bremsspuren';
    this.pops.group.name = 'Comic-Wörter';
    this.shadows.mesh.name = 'Schatten';
    this.lights.mesh.name = 'Scheinwerfer';
    this.scene.add(this.lights.mesh);
    this.bolts.group.name = 'Blitze';
    this.speedLines.mesh.name = 'Tempostriche';
    const c = this.color;
    this.fx = {
      spark: (x, y, z, vx, vy, vz, life, size, color, gravity = 9) => this.sparks.emit(x, y, z, vx, vy, vz, life, size, c.set(color), -size * 0.8, gravity, 1),
      puff: (x, y, z, vx, vy, vz, life, size, color, grow = 0, gravity = 0) => this.puffs.emit(x, y, z, vx, vy, vz, life, size, c.set(color), grow, gravity, 1.5, 0.95),
    };
    this.camera.add(this.speedLines.mesh);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Der eine Renderer der Seite – die Porträts der Lobby zeichnen mit ihm (portraits.ts). */
  get gl(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /** Gibt Welt und Renderer frei – für den Fall, dass die Szene auf einer frischen Zeichenfläche neu entsteht. */
  release(): void {
    try {
      this.disposeWorld();
      this.renderer.dispose();
    } catch (err) {
      console.error(err);
    }
  }

  // --- Aufbau ----------------------------------------------------------------

  /** Baut die Welt der aktiven Strecke (TRACK) auf, falls sie nicht schon steht. */
  setTrack(): void {
    if (this.world && this.track === TRACK) return;
    this.disposeWorld();
    this.track = TRACK;
    this.twistSegs = [];
    this.twistBox = [Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < TRACK.total; i += 2) {
      if ((TRACK.edge[i] & EDGE_TWIST) === 0) continue;
      this.twistSegs.push(i);
      const r = TRACK.twist[i] + TRACK.wh[i] + 4;
      this.twistBox[0] = Math.min(this.twistBox[0], TRACK.px[i] - r);
      this.twistBox[1] = Math.max(this.twistBox[1], TRACK.px[i] + r);
      this.twistBox[2] = Math.min(this.twistBox[2], TRACK.pz[i] - r);
      this.twistBox[3] = Math.max(this.twistBox[3], TRACK.pz[i] + r);
    }
    this.camTwist = 0;
    const lv = LEVELS[this.level];
    const started = performance.now();
    this.world = new World(TRACK, lv.world);
    this.stats.buildMs = Math.round(performance.now() - started);
    this.things = new ThingVisuals(TRACK, this.level > 0);
    this.glueShots = new GlueShots(this.level > 0);
    this.scene.add(this.world.group, this.things.group, this.glueShots.group);
    this.mechanics = buildMechanics(TRACK, this.level > 0, this.world);
    this.passSide = new Int8Array(TRACK.vehicles.length);
    for (const m of this.mechanics) this.scene.add(m.group);
    this.world.group.name = 'Welt';
    this.things.group.name = 'Dinge';
    this.mechanics.forEach((m, i) => (m.group.name = m.group.name || `Mechanik ${i + 1}`));
    this.stagedPending = true;
    this.scene.fog = this.world.fog;
    this.scene.background = this.world.background;
    // Das eigene Kart liegt in der Cockpit-Ansicht auf einer eigenen Ebene – Sonne und Himmelslicht müssen es dort beleuchten.
    this.world.sun.layers.enable(COCKPIT_LAYER);
    this.world.hemi.layers.enable(COCKPIT_LAYER);
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
      ['HUI!', 'cool'],
      ['GELADEN!', 'cool'],
      ['HINDURCH!', 'violet'],
      ['ZACK!', 'warm'],
      ['AUFGESPRUNGEN!', 'warm'],
      ['WINZIG!', 'cool'],
      ['RIESIG!', 'hot'],
      ['ZURÜCK!', 'hot'],
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
    if (this.glueShots) {
      this.scene.remove(this.glueShots.group);
      this.glueShots.dispose();
      this.glueShots = null;
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
    this.rocket = 0;
    this.drill = 0;
    this.drills.clear();
    this.skids.clear();
    this.puffs.clear();
    this.sparks.clear();
    this.pops.clear();
    this.things?.clear();
    this.glueShots?.clear();
    this.glue = 0;
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
    if (this.glueShots) setOutlinesVisible(this.glueShots.group, this.level > 0);
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
    visual.root.name = `Kart ${slot + 1}`;
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
      spinFull: 0,
      rocket: 0,
      rocketQ: new THREE.Quaternion(),
      incoming: false,
      glide: false,
      lift: false,
      windWait: 0,
      dive: false,
      blown: false,
      snowed: false,
      snowWait: 0,
      gusty: false,
      gustWait: 0,
      raft: -1,
      riverWait: 0,
      lastX: 0,
      lastY: 0,
      lastZ: 0,
      lastSeg: 0,
      roof: false,
      roofWait: 0,
      rail: false,
      railWait: 0,
      chainWait: 0,
      slopeWas: 0,
      boostWas: 0,
      drum: false,
      hoverK: 0,
      humWait: 0,
      sizeWas: 0,
      sizeK: 1,
      inCastle: false,
      gold: 0,
      robot: 0,
      robotT: 0,
      robotSteps: visual.robotSteps,
      glue: 0,
      gunT: 0,
      shotOut: false,
      shotDone: false,
      shotFrom: new THREE.Vector3(),
      shotMiss: new THREE.Vector3(),
      plant: 0,
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
      // Sturmhafen: eine Böe setzt ein – zu hören von der Mitte ihres Bereichs.
      // (Startrampe: Der Abgasstoß kommt mit dem Start – den hört man als Startdonner, unten.)
      for (const w of t.winds) {
        if (t.def.theme === 'rampe') break;
        if (gustStrength(w, time) > 0 && gustStrength(w, before) === 0) {
          const mid = w.first + (w.count >> 1);
          this.emitAt('gust', t.px[mid], t.py[mid], t.pz[mid]);
        }
      }
      // Zeitriss-Ruine: der Sprung zwischen den Zeitaltern – drei Sekunden vorher der Gong, dann reißt die Zeit.
      const era = t.era;
      let flip = false;
      if (era && time > 0) {
        if (eraUntil(era, time) <= ERA_WARN && eraUntil(era, before) > ERA_WARN) this.onEvent?.({ kind: 'riftwarn', slot: -1, local: true, pan: 0, gain: 1 });
        if (eraSince(era, time) < eraSince(era, before)) {
          flip = true;
          this.onEvent?.({ kind: 'rift', slot: -1, local: true, pan: 0, gain: 1 });
          this.shake = Math.max(this.shake, 0.3);
        }
      }
      // Vulkaninsel: Platten bröckeln und brechen, Wege schließen und öffnen sich.
      // (Mit Zeitaltern geschieht beim Sprung alles auf einmal – das sagt der Riss; einzeln zu hören ist nur, was mit Verzögerung einstürzt.)
      for (const h of t.holes) {
        // (Die Deckenplatten der Magnettrommel melden sich selbst, unten.)
        if (t.edge[h.first] & EDGE_DRUM) continue;
        const warned = !era && planActive(h.plan, time + h.warn) && !planActive(h.plan, before + h.warn);
        const broke = !flip && planActive(h.plan, time) && !planActive(h.plan, before);
        if (!warned && !broke) continue;
        const mid = h.first + (h.count >> 1);
        // Die Hängebrücke ist aus Holz: ihr Einsturz hat einen eigenen Klang ('collapse', beim Schließen des Tors) –
        // das Bröckeln und Brechen von Stein passt dort nicht.
        if (SURFACES[t.surf[mid]]?.id === 'wood') continue;
        const lat = (Math.max(h.lat0, -t.wh[mid]) + Math.min(h.lat1, t.wh[mid])) / 2;
        const hx = t.px[mid] + rightX(t, mid) * lat;
        const hz = t.pz[mid] + rightZ(t, mid) * lat;
        this.emitAt(broke ? 'crack' : 'crumble', hx, t.py[mid], hz, broke ? 140 : 90);
        if (broke && me) {
          const d = Math.hypot(me.x - hx, me.z - hz);
          if (d < 50) this.shake = Math.max(this.shake, 0.5 * (1 - d / 50));
        }
      }
      for (const g of t.gates) {
        // (Das Tor der U-Bahn öffnet und schließt still: Man sieht es am Signal.)
        if (era || t.metro) break;
        const shut = planActive(g.plan, time);
        if (shut === planActive(g.plan, before)) continue;
        // Talsperre: Die Schleuse öffnet mit Rauschen (das Wasser gleicht sich aus) und schließt mit dem Klack der Antriebe.
        if (t.def.theme === 'talsperre') {
          this.emitAt(shut ? 'magnetoff' : 'drain', t.px[g.first + g.count], t.py[g.first + g.count] + 2, t.pz[g.first + g.count], 160);
          continue;
        }
        // Startrampe: Das Schutztor des Flammengrabens fährt zu bzw. auf (Klack der Antriebe, steigender Ton), die
        // Schranke am Transporterdach klackt.
        if (t.def.theme === 'rampe') {
          const at = Math.min(g.first + g.count + 2, t.total - 1);
          const k = t.branchOf[g.first];
          if (t.crawler && k === t.crawler.branch) this.emitAt('clamp', t.px[at], t.py[at] + 1, t.pz[at], 70);
          else this.emitAt(shut ? 'magnetoff' : 'magneton', t.px[at], t.py[at] + 2, t.pz[at], 140);
          continue;
        }
        // Kristallmine: Der Sprengort wird freigesprengt (Knall) bzw. das Hangende bricht nach (Poltern) – am Geröll.
        if (t.def.theme === 'kristall') {
          const at = Math.min(g.first + g.count + 10, t.total - 1);
          this.emitAt(shut ? 'rubble' : 'blast', t.px[at], t.py[at] + 1, t.pz[at], shut ? 120 : 220);
          if (!shut && me) {
            const d = Math.hypot(me.x - t.px[at], me.z - t.pz[at]);
            if (d < 50) this.shake = Math.max(this.shake, 0.5 * (1 - d / 50));
          }
          continue;
        }
        // Das hört die ganze Insel – in der Ferne leise.
        this.emitAt(shut ? 'collapse' : 'drain', t.px[g.first], t.py[g.first], t.pz[g.first], 600);
        if (shut && me) {
          const d = Math.hypot(me.x - t.px[g.first], me.z - t.pz[g.first]);
          if (d < 80) this.shake = Math.max(this.shake, 0.6 * (1 - d / 80));
        }
      }
      // Spiegelkabinett: in einem Rahmen erscheint ein Spiegel oder er verschwindet – ein Schimmern am Ort des Rahmens.
      // (Rahmen mit zwei Spiegeln im Wechsel melden sich je Tausch einmal: beim Erscheinen.)
      for (const p of t.portals) {
        if (p.plan === null) continue;
        const open = portalOpen(p, time);
        if (open === portalOpen(p, before)) continue;
        if (!open && t.portals.some((q) => q !== p && q.seg === p.seg && q.lat0 === p.lat0)) continue;
        const lat = (p.lat0 + p.lat1) / 2;
        this.emitAt('shimmer', t.px[p.seg] + rightX(t, p.seg) * lat, t.py[p.seg] + 2, t.pz[p.seg] + rightZ(t, p.seg) * lat, 110);
      }
      // Magnetwerk: eine Deckenplatte der Trommel schaltet ab bzw. wieder an – zu hören an der Mitte der Platte (je Platte;
      // die beiden eines Paars schalten nie zugleich, die Paare um eine halbe Sekunde versetzt). Ein Zeitsprung meldet nichts (steady).
      if (t.drums.length > 0) {
        for (const h of t.holes) {
          if ((t.edge[h.first] & EDGE_DRUM) === 0) continue;
          const off = planActive(h.plan, time);
          if (off === planActive(h.plan, before)) continue;
          const mid = h.first + (h.count >> 1);
          const lat = (Math.max(h.lat0, -t.wh[mid]) + Math.min(h.lat1, t.wh[mid])) / 2;
          this.emitAt(off ? 'magnetoff' : 'magneton', t.px[mid] + rightX(t, mid) * lat, t.py[mid] + 0.2, t.pz[mid] + rightZ(t, mid) * lat, 120);
        }
      }
      // Dschungel-Fluss: der Wasserfall tost – hörbar, solange man in seiner Nähe ist (alle halbe Sekunde ein Schwall).
      if (t.rivers.length > 0 && Math.floor(time / 30) !== Math.floor(before / 30)) {
        for (const r of t.rivers) {
          // Die Kante: die erste Lücke hinter dem Fluss
          let lip = r.first + r.count;
          for (let n = 0; n < 40 && (t.edge[lip] & EDGE_GAP) === 0; n++) lip = t.next[lip];
          if (t.edge[lip] & EDGE_GAP) this.emitAt('falls', t.px[lip], t.py[lip] - 3, t.pz[lip], 170);
        }
      }
      // Talsperre: das Tosen am Grundablass (Tosbecken am Mauerfuß) und an der Überlaufrinne; im Krafthaus brummen die
      // Maschinensätze – hörbar, solange man in der Nähe ist.
      if (t.def.theme === 'talsperre') {
        if (Math.floor(time / 30) !== Math.floor(before / 30)) {
          this.emitAt('falls', 0, RIVER_Y + 2, DAM_CZ - DAM_AIR + 18, 150);
          const c = CHANNEL[Math.floor(CHANNEL.length / 2)];
          this.emitAt('falls', c[0], CHANNEL_FLOOR + 2, c[1], 90);
        }
        if (Math.floor(time / 24) !== Math.floor(before / 24)) for (const h of t.hazards) this.emitAt('hum', t.px[h.seg], t.py[h.seg] + 2, t.pz[h.seg], 50);
      }
      // Baumkronenpfad: Der Wasserfall rauscht über die Felsstufe in den Teich, und die Hängebrücken knarzen, wenn sie am
      // Ende eines Pendelschlags umkehren (ortsfest in ihrer Mitte).
      if (t.def.theme === 'baum') {
        if (Math.floor(time / 30) !== Math.floor(before / 30)) this.emitAt('falls', FALL.x - 13, FALL.top - 3, FALL.z + 6, 150);
        for (const p of t.pontoons) {
          const d0 = pontoonShift(p, before) - pontoonShift(p, before - 1);
          const d1 = pontoonShift(p, time) - pontoonShift(p, time - 1);
          if (d0 * d1 >= 0) continue;
          const mid = p.first + (p.count >> 1);
          this.emitAt('creak', t.px[mid], t.py[mid], t.pz[mid], 80);
        }
      }
      // Dächerjagd: Die Kirchenglocken läuten alle LAEUTEN s Rennzeit DAUER s lang (alle 0,8 s ein Schlag, die drei Glocken
      // reihum), und die Straßenbahn klingelt, wenn sie an der Haltestelle wieder anfährt.
      if (t.def.theme === 'daecher') {
        const c0 = (((before / 60) % LAEUTEN) + LAEUTEN) % LAEUTEN;
        const c1 = (((time / 60) % LAEUTEN) + LAEUTEN) % LAEUTEN;
        if (time > 0 && c1 < DAUER && Math.floor(c1 / 0.8) !== Math.floor(c0 / 0.8) && c0 < c1) {
          const turm = TURM(t);
          this.emitAt('bells', turm.x, turm.road + 6, turm.z, 420);
        }
        for (const v of t.vehicles) {
          if (!v.line) continue;
          if (vehicleSpeed(v, before) < 0.05 && vehicleSpeed(v, time) >= 0.05 && Number.isFinite(vehicleAt(v, time, t.n * t.step))) {
            const p = vehiclePose(t, v, 0, time, this.vpose);
            this.emitAt('trambell', p.x, p.y + 3, p.z, 90);
          }
        }
      }
      // Gewitterkamm: fernes Wetterleuchten – der Donner dazu rollt eine knappe Sekunde später heran.
      for (const f of t.flashes) {
        const c0 = (((before + f.phase) % f.period) + f.period) % f.period;
        const c1 = (((time + f.phase) % f.period) + f.period) % f.period;
        if (c0 < 50 && c1 >= 50) this.onEvent?.({ kind: 'rumble', slot: -1, local: false, pan: 0, gain: 0.35 + 0.5 * f.power });
      }
      // Startrampe: Die letzten zehn Sekunden vor einem Start piept der Countdown über den ganzen Platz; beim Start der
      // Donner (an der Rakete, in der Nähe bebt das Bild), beim Landeanflug der nächsten Rakete noch einmal leiser.
      // Der Raupentransporter rasselt, solange er fährt und man in seiner Nähe ist.
      if (t.def.theme === 'rampe') {
        const flame = t.pulses.find((p) => p.kind === PULSE_FLAME);
        if (flame) {
          const c0 = pulseCycle(flame, before) / 60;
          const c1 = pulseCycle(flame, time) / 60;
          const P = flame.period / 60;
          const d = me ? Math.hypot(me.x - RAKETE.x, me.z - RAKETE.z) : 200;
          const far = Math.max(0.4, 1 - d / 650);
          if (c1 < c0) {
            this.onEvent?.({ kind: 'liftoff', slot: -1, local: false, pan: 0, gain: Math.max(0.55, 1 - d / 700) });
            if (d < 160) this.shake = Math.max(this.shake, 0.7 * (1 - d / 160));
          } else if (Math.floor(P - c1) !== Math.floor(P - c0) && P - c1 < 10 && P - c1 > 0) {
            this.onEvent?.({ kind: 'beep', slot: -1, local: false, pan: 0, gain: far * (P - c1 < 3 ? 1 : 0.75) });
          }
          if (c0 < 23.4 && c1 >= 23.4) this.onEvent?.({ kind: 'liftoff', slot: -1, local: false, pan: 0, gain: Math.max(0.3, 0.6 - d / 900) });
        }
        const cr = t.crawler;
        if (cr && me && Math.floor(time / 25) !== Math.floor(before / 25)) {
          crawlerPose(cr, time, this.crawl);
          if (Math.hypot(this.crawl.vx, this.crawl.vz) > 0.3) this.emitAt('crawler', this.crawl.x, cr.floor + 3, this.crawl.z, 75);
        }
      }
      for (const p of t.pulses) {
        // (Startrampe: den Abgasstrahl meldet der Startdonner, oben.)
        if (p.kind === PULSE_FLAME) continue;
        // Kristallmine: Zu Beginn der Vorwarnung tönt das Sprenghorn.
        if (p.kind === PULSE_BLAST) {
          const w = p.period - p.warn;
          const c0 = pulseCycle(p, before);
          const c1 = pulseCycle(p, time);
          if (c0 < w && c1 >= w && c1 > c0) this.emitAt('siren', p.x, p.y + 2.5, p.z, 160);
        }
        // Der Zyklus ist seit dem letzten Bild über null gelaufen: Ausbruch bzw. Einschlag.
        if (pulseCycle(p, time) < pulseCycle(p, before)) {
          if (p.kind === PULSE_BUBBLE) {
            // Ein Blasenschlot beginnt zu blasen: harmlos, nur zu hören.
            this.emitAt('bubbles', p.x, p.y, p.z);
            continue;
          }
          if (p.kind === PULSE_BOLT || p.kind === PULSE_ROD) {
            // Blitz: auf dem ganzen Kamm zu hören, in der Nähe bebt das Bild.
            const bolt = p.kind === PULSE_BOLT;
            this.emitAt(bolt ? 'thunder' : 'rod', p.x, p.y, p.z, 420);
            if (me) {
              const d = Math.hypot(me.x - p.x, me.z - p.z);
              if (d < 60) this.shake = Math.max(this.shake, (bolt ? 0.5 : 0.25) * (1 - d / 60));
            }
            continue;
          }
          if (p.kind === PULSE_BLAST) {
            // Sprengladung: weit zu hören, in der Nähe bebt das Bild kräftig.
            this.emitAt('blast', p.x, p.y, p.z, 220);
            if (me) {
              const d = Math.hypot(me.x - p.x, me.z - p.z);
              if (d < 55) this.shake = Math.max(this.shake, 0.7 * (1 - d / 55));
            }
            continue;
          }
          if (p.kind > PULSE_BUBBLE) {
            // Lawine, Eiszapfen, Meteorit: ortsfest zu hören; Lawine und Meteorit lassen das Bild beben.
            // (Baumkronenpfad: statt Eiszapfen schlagen Tannenzapfen auf.)
            const icicle = t.def.theme === 'baum' ? 'cone' : 'icicle';
            this.emitAt(p.kind === PULSE_AVALANCHE ? 'avalanche' : p.kind === PULSE_ICICLE ? icicle : 'meteor', p.x, p.y, p.z);
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
        if (v.roofs) {
          // Zug: Die Lok pfeift in festem Takt (alle 11 s, die Züge gegeneinander versetzt) – weit zu hören.
          const beat = (x: number) => Math.floor((x + v.id * 165) / 660);
          if (time > 0 && beat(time) !== beat(before)) {
            const p = vehiclePose(t, v, 0, time, this.vpose);
            this.emitAt('whistle', p.x, p.y + 3, p.z, 220);
          }
          // Rollt ein Zug dicht am eigenen Kart vorbei, hört man ihn (alle 0,45 s ein Stück Rollen und Schienenstoß).
          if (d < 20 && d > -((v.cars - 1) * v.pitch + 20) && Math.floor(time / 27) !== Math.floor(before / 27) && !this.karts.get(me.slot)?.roof) {
            const car = Math.max(0, Math.min(v.cars - 1, Math.round(-d / v.pitch)));
            const p = vehiclePose(t, v, car, time, this.vpose);
            this.emitAt('trainpass', p.x, p.y + 1, p.z, 42);
          }
          continue;
        }
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
          // (Die Straßenbahn der Dächerjagd hupt nicht, sie klingelt.)
          this.emitAt(v.kind === VEH_STADTBAHN ? 'trambell' : 'honk', p.x, p.y + (v.kind === VEH_STADTBAHN ? 3 : 1.5), p.z);
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

  /** Steht dieses Kart gerade im geladenen Feld eines Blitzableiters? (So erkennt die Szene, woher ein Schub kommt.) */
  private inChargeField(e: RenderEntity): boolean {
    const t = this.track;
    for (const p of t.pulses) {
      if (p.kind !== PULSE_ROD || pulseCycle(p, this.mechTime) >= p.on + 8) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      if (Math.abs(dx * t.tx[p.seg] + dz * t.tz[p.seg]) > p.radius + 3 || Math.abs(e.y - p.y) > 3) continue;
      if (Math.abs(dx * rightX(t, p.seg) + dz * rightZ(t, p.seg) + p.lat) <= t.wh[p.seg] + 1) return true;
    }
    return false;
  }

  /** Rakete schlägt ein: Feuerball, Funken, eine dichte Rauchwolke, aus der das Kart herausrollt. */
  private rocketImpact(e: RenderEntity): void {
    this.pop('KAWUMM!', e, 'hot', 5.4);
    this.burst(e.x, e.y + 0.8, e.z, 28, 13, 0xff8a1c, true, 1.2, 0.6, 8);
    this.burst(e.x, e.y + 1.2, e.z, 18, 9, 0xffe04a, true, 0.9, 0.5, 10);
    // Rauchwolke: dicht und langsam, sie bleibt gut eine Sekunde stehen.
    this.color.set(0xcfc9da);
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 2;
      this.puffs.emit(e.x + Math.cos(a) * r, e.y + 0.3 + Math.random() * 1.4, e.z + Math.sin(a) * r, Math.cos(a) * 2.6, 0.5 + Math.random(), Math.sin(a) * 2.6, 0.9 + Math.random() * 0.5, 0.9 + Math.random() * 0.6, this.color, 1, 0, 2.2);
    }
  }

  /**
   * Raketen: im Flug Feuer und Rauch aus der Düse; und die Warnung, wenn eine fremde Rakete das eigene Kart als Ziel hat
   * (Banner während des ganzen Flugs, das Herabpfeifen in der letzten Sekunde).
   */
  private updateRockets(entities: RenderEntity[], me: RenderEntity | null): void {
    let warn = 0;
    for (const e of entities) {
      if (e.rocket <= ROCKET_MORPH_TICKS) continue;
      const k = this.karts.get(e.slot);
      if (!k) continue;
      // Düse am Heck: entgegen der Flugrichtung, ein Stück unter der Mitte.
      const v = Math.hypot(e.vx, e.vy, e.vz) || 1;
      const dx = e.vx / v;
      const dy = e.vy / v;
      const dz = e.vz / v;
      const nx = e.x - dx * 1.7;
      const ny = e.y - dy * 1.7;
      const nz = e.z - dz * 1.7;
      this.color.set(0xffd23f);
      this.sparks.emit(nx, ny, nz, -dx * 14, -dy * 14, -dz * 14, 0.14, 1.3, this.color, -2, 0, 1);
      this.color.set(0xff6a2a);
      this.sparks.emit(nx, ny, nz, -dx * 22 + (Math.random() - 0.5) * 4, -dy * 22 + (Math.random() - 0.5) * 4, -dz * 22 + (Math.random() - 0.5) * 4, 0.22, 1, this.color, -1.5, 0, 2);
      this.color.set(0xe4e0ec);
      this.puffs.emit(nx - dx * 1.5, ny - dy * 1.5, nz - dz * 1.5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1.6, 1.1, this.color, 1.6, 0, 1.5);
      if (me && !me.finished && e.slot !== me.slot && e.aimSlot === me.slot) {
        const fly = (e.rocket - ROCKET_MORPH_TICKS) / ROCKET_FLY_TICKS;
        warn = Math.max(warn, Math.max(0.01, fly));
        if (!k.incoming && e.rocket >= ROCKET_TICKS - 62) {
          k.incoming = true;
          this.onEvent?.({ kind: 'rocket-incoming', slot: me.slot, local: true, pan: 0, gain: 1 });
        }
      }
    }
    // Schon während der Verwandlung warnen, wenn sie auf das eigene Kart zielt.
    if (me && !me.finished && warn === 0) {
      for (const e of entities) if (e.rocket > 0 && e.slot !== me.slot && e.aimSlot === me.slot) warn = 0.01;
    }
    this.rocket = warn;
  }

  /**
   * Bohrer: Bohrgeräusch (immer dichter und höher, je schneller er ist), Durchbruch und Explosion („KAWUMM!“, Wackeln in der
   * Nähe) – und die Warnung für sein Ziel: Hinweis während der ganzen Fahrt; in der letzten Sekunde vor dem Durchbruch grollt
   * es, die Kamera bebt, und vor dem Kart reißt die Fahrbahn auf (auf allen Bildschirmen, damit jeder sieht, wen es trifft).
   */
  private updateDrills(things: SnapshotThing[], entities: RenderEntity[], me: RenderEntity | null, dt: number): void {
    let warn = 0;
    for (const d of this.drills.values()) d.seen = false;
    for (const th of things) {
      if (th.kind !== THING_DRILL) continue;
      let d = this.drills.get(th.id);
      if (!d) {
        d = { x: th.x, y: th.y, z: th.z, stage: th.stage, target: th.target, wait: 0, rumbled: false, seen: true };
        this.drills.set(th.id, d);
      }
      d.seen = true;
      if (th.stage > 0 && d.stage === 0) {
        // (Das Ziel hört es aus nächster Nähe – voll, ohne Richtung.)
        if (me && th.target === me.slot) this.onEvent?.({ kind: 'drill-burst', slot: me.slot, local: true, pan: 0, gain: 1 });
        else this.emitAt('drill-burst', th.x, th.y, th.z, 110);
        this.pops.show('KRRRK!', th.x, th.y + 3.2, th.z, 'warm', 3.6);
      }
      d.x = th.x;
      d.y = th.y;
      d.z = th.z;
      d.stage = th.stage;
      d.target = th.target;
      // Bohrgeräusch: beim Eindrehen immer schneller, unter der Erde mit dem Tempo, beim Durchbruch kreischend.
      const speed = Math.hypot(th.vx, th.vz);
      const dig = Math.min(1, th.age / DRILL_DIG_TICKS);
      const pitch = th.stage > 0 ? 2.3 : th.age <= DRILL_DIG_TICKS ? 0.5 + 0.55 * dig * dig : 0.75 + Math.min(1.45, speed / 150);
      const every = th.stage > 0 ? 0.06 : th.age <= DRILL_DIG_TICKS ? 0.2 - 0.1 * dig : Math.max(0.065, 0.14 - speed * 0.0004);
      d.wait -= dt;
      if (d.wait <= 0) {
        d.wait = every;
        this.emitDrill(th.x, th.y, th.z, pitch);
      }
      // Warnung für das Ziel
      const left = th.ttl * 60 - DRILL_RISE_TICKS;
      const target = th.target >= 0 ? entities.find((e) => e.slot === th.target) : undefined;
      if (me && !me.finished && th.target === me.slot) warn = Math.max(warn, th.stage > 0 ? 1 : left <= DRILL_WARN_TICKS ? 0.5 + 0.5 * (1 - Math.max(0, left) / DRILL_WARN_TICKS) : 0.01);
      if (target && th.stage === 0 && th.age > DRILL_DIG_TICKS && left <= DRILL_WARN_TICKS) {
        const k = 1 - Math.max(0, left) / DRILL_WARN_TICKS;
        // Risse vor dem Kart: auf seiner Spur die Strecke entlang, dort, wo es in knapp einer halben Sekunde ist
        const t = this.track;
        const ahead = 4 + Math.hypot(target.vx, target.vz) * 0.4;
        projectOnTrack(t, target.x, target.z, target.seg < t.total ? target.seg : 0);
        const kb = t.branchOf[proj.seg];
        const lat = Math.max(-t.rh[proj.seg], Math.min(t.rh[proj.seg], proj.lat));
        const seg = walk(t, proj.seg, Math.round(ahead / t.step), kb >= 0 ? 1 << kb : 0);
        this.things?.warnCracks(t.px[seg] + rightX(t, seg) * lat, t.py[seg] + lat * t.bank[seg], t.pz[seg] + rightZ(t, seg) * lat, seg, Math.atan2(t.tx[seg], t.tz[seg]), k, dt, this.fx);
        if (target.slot === this.localSlot) {
          this.shake = Math.max(this.shake, 0.12 + 0.25 * k);
          if (!d.rumbled) {
            d.rumbled = true;
            this.onEvent?.({ kind: 'drill-rumble', slot: target.slot, local: true, pan: 0, gain: 1 });
          }
        }
      }
    }
    for (const [id, d] of this.drills) {
      if (d.seen) continue;
      this.drills.delete(id);
      if (d.stage <= 0) continue;
      // Explodiert
      this.pops.show('KAWUMM!', d.x, d.y + 3.4, d.z, 'hot', 5.4);
      if (me && d.target === me.slot) this.onEvent?.({ kind: 'drill-blast', slot: me.slot, local: true, pan: 0, gain: 1 });
      else this.emitAt('drill-blast', d.x, d.y, d.z, 140);
      if (me) {
        const dist = Math.hypot(me.x - d.x, me.z - d.z);
        if (dist < 40) this.shake = Math.max(this.shake, 0.9 * (1 - dist / 40));
        if (d.target === me.slot && dist < 12) this.hitstop = Math.max(this.hitstop, 0.08);
      }
    }
    this.drill = warn;
  }

  /** Ein Stoß Bohrgeräusch an einem Ort (Tonhöhe als Faktor). */
  private emitDrill(x: number, y: number, z: number, pitch: number): void {
    if (!this.onEvent) return;
    this.v1.set(x, y, z).sub(this.camera.position);
    const dist = this.v1.length();
    const gain = Math.max(0, 1 - dist / 90);
    if (gain <= 0.02) return;
    this.v2.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const pan = dist > 0.5 ? Math.max(-1, Math.min(1, this.v1.dot(this.v2) / dist)) : 0;
    this.onEvent({ kind: 'drill', slot: -1, local: false, pan, gain, pitch });
  }

  /** Nächster verdrehter Abschnitt zu (x, z) – oder −1, wenn der Punkt nicht bei einem verdrehten Stück liegt. */
  private nearestTwistSeg(x: number, z: number): number {
    const t = this.track;
    const box = this.twistBox;
    if (x < box[0] || x > box[1] || z < box[2] || z > box[3]) return -1;
    let best = -1;
    let bestD = Infinity;
    for (const s of this.twistSegs) {
      const dd = (t.px[s] - x) ** 2 + (t.pz[s] - z) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = s;
      }
    }
    if (best >= 0 && bestD > (t.twist[best] + t.wh[best] + 4) ** 2) best = -1;
    return best;
  }

  /**
   * Verdrehte Fahrbahn (Schwebeband an der Fassade): Gerechnet wird auf der flachen Fahrbahn, gezeigt an der gedrehten
   * Stelle (track.ts: twistWarp). Bestimmt die Drehung um die Achse an der Stelle (x, z) – hint ist ein Abschnitt in der
   * Nähe (−1: suchen). false, wo nichts verdreht ist. Je Aufruf eine Zuordnung zur Strecke und ein paar Winkel – keine
   * Geometrie wird neu berechnet.
   */
  private twistTurn(x: number, z: number, hint: number): boolean {
    const t = this.track;
    if (this.twistSegs.length === 0) return false;
    let seg = hint >= 0 && hint < t.total ? hint : this.nearestTwistSeg(x, z);
    if (seg < 0) return false;
    projectOnTrack(t, x, z, seg);
    seg = proj.seg;
    let f = proj.along / t.step;
    // Hinter der Mitte des Abschnitts: zwischen dem vorigen und diesem mitteln (sonst springt der Winkel an der Mitte).
    if (f < 0 && (t.edge[t.prev[seg]] & EDGE_TWIST) !== 0) {
      seg = t.prev[seg];
      f += 1;
    }
    f = Math.max(0, Math.min(1, f));
    if ((t.edge[seg] & EDGE_TWIST) === 0) return false;
    const r = twistRollAt(t, seg, f);
    const R = twistRadiusAt(t, seg, f);
    const b = t.next[seg];
    const L = (p: number, q: number): number => p + (q - p) * f;
    this.dAxis.set(L(t.px[seg], t.px[b]), L(t.py[seg], t.py[b]) + R, L(t.pz[seg], t.pz[b]));
    this.dTan.set(L(t.tx[seg], t.tx[b]), 0, L(t.tz[seg], t.tz[b])).normalize();
    // „Oben“ kippt zur rechten Wand, wenn sich die rechte Seite der Bahn hebt (Drehung um die Fahrtrichtung, negativ).
    this.dAngle = r;
    this.dq.setFromAxisAngle(this.dTan, -r);
    return true;
  }

  /** Wendet die zuletzt mit twistTurn bestimmte Drehung auf einen Punkt an. */
  private twistApply(p: THREE.Vector3): THREE.Vector3 {
    return p.sub(this.dAxis).applyQuaternion(this.dq).add(this.dAxis);
  }

  /** Effekte (Teilchen, Lautmalerei) eines Karts auf verdrehter Bahn erscheinen an dessen gezeigter Stelle. */
  private fxAt(x: number, y: number, z: number): { x: number; y: number; z: number } {
    const p = this.dP;
    p.x = x;
    p.y = y;
    p.z = z;
    if (this.fxSeg < 0) return p;
    const t = this.track;
    // (proj gehört dem Aufrufer – hier nur ausleihen)
    const ps = proj.seg;
    const pl = proj.lat;
    const pa = proj.along;
    projectOnTrack(t, x, z, this.fxSeg);
    const seg = proj.seg;
    if ((t.edge[seg] & EDGE_TWIST) !== 0) twistWarp(t, seg, Math.max(0, Math.min(1, proj.along / t.step)), proj.lat, y - (t.py[seg] + proj.lat * t.bank[seg]), p);
    proj.seg = ps;
    proj.lat = pl;
    proj.along = pa;
    return p;
  }

  private pop(word: string, e: RenderEntity, style: string, size = 3.4): void {
    const p = this.fxAt(e.x, e.y + 2.6, e.z);
    this.pops.show(word, p.x, p.y, p.z, style, size);
  }

  /** Wie pop, aber dort, wo das Kart in gut einer halben Sekunde ist – große Wörter, die die Kamera sonst durchführe. */
  private popAhead(word: string, e: RenderEntity, style: string, size: number): void {
    const p = this.fxAt(e.x + e.vx * 0.6, e.y + 2.6 + e.vy * 0.3, e.z + e.vz * 0.6);
    this.pops.show(word, p.x, p.y, p.z, style, size);
  }

  private burst(x0: number, y0: number, z0: number, count: number, speed: number, hex: number, glow: boolean, size = 0.5, life = 0.6, up = 3): void {
    const fp = this.fxAt(x0, y0, z0);
    const x = fp.x;
    const y = fp.y;
    const z = fp.z;
    this.color.set(hex);
    const pool = glow ? this.sparks : this.puffs;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      pool.emit(x, y, z, Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), this.color, glow ? -size : size * 1.2, glow ? 9 : 4, 1.5);
    }
  }

  /**
   * Kleber: Der Klumpen verlässt die Pistole (Zeitpunkt GLUE_FIRE), fliegt im Bogen und kommt bei GLUE_HIT an – im Gesicht
   * des Ziels (so, wie es auf diesem Bildschirm gerade steht) oder ohne Ziel hinter dem Schützen auf der Fahrbahn.
   * Ob er klebt, sagt der Spielstand des Getroffenen (Stoßfänger und Get Gold halten ihn ab – dort klatscht er ab).
   */
  private glueFlights(entities: RenderEntity[], me: RenderEntity | null, dt: number): void {
    const shots = this.glueShots;
    if (!shots) return;
    const fire = GLUE_FIRE / 60;
    const hit = GLUE_HIT / 60;
    for (const e of entities) {
      const k = this.karts.get(e.slot);
      if (!k) continue;
      if (e.glueShot === 0 || k.gunT < fire) {
        k.shotOut = false;
        k.shotDone = false;
        continue;
      }
      const local = e.slot === this.localSlot;
      const root = k.visual.root;
      const target = e.glueAim >= 0 ? entities.find((x) => x.slot === e.glueAim) : undefined;
      const tv = target ? this.karts.get(target.slot) : undefined;
      if (!k.shotOut) {
        // Abschuss: aus der Mündung, mit einem Spritzer; ohne Ziel liegt der Aufschlag gut 13 m hinter dem Schützen.
        k.shotOut = true;
        root.updateMatrixWorld();
        root.localToWorld(k.shotFrom.copy(k.visual.anchors.gunMuzzle));
        this.burst(k.shotFrom.x, k.shotFrom.y, k.shotFrom.z, 8, 4, 0xfff1c2, false, 0.35, 0.35, 2);
        this.emit('glue-shot', k, local);
        const t = this.track;
        const bx = e.x - Math.sin(e.heading) * 13;
        const bz = e.z - Math.cos(e.heading) * 13;
        projectOnTrack(t, bx, bz, e.seg);
        const g = groundNow(t, proj.seg, proj.along, proj.lat, this.mechTime);
        k.shotMiss.set(bx, g === NO_GROUND ? e.y - 1 : g, bz);
      }
      if (k.shotDone) continue;
      // Ziel: das Gesicht des Getroffenen (etwas vor der Kartmitte, auf Kopfhöhe) – oder der Aufschlag auf der Fahrbahn.
      const to = this.glueD;
      if (tv && tv.seen) {
        const r = tv.visual.root;
        to.set(Math.sin(r.rotation.y) * 0.25, 1.15 * r.scale.y, Math.cos(r.rotation.y) * 0.25).add(r.position);
      } else to.copy(k.shotMiss);
      const u = Math.min(1, (k.gunT - fire) / (hit - fire));
      const from = k.shotFrom;
      const dist = from.distanceTo(to);
      const arc = (0.7 + dist * 0.06) * 4 * u * (1 - u);
      const p = this.glueP.lerpVectors(from, to, u);
      p.y += arc;
      if (u < 1) {
        // Flugrichtung: Verbindungslinie plus Steigung des Bogens
        this.v2.subVectors(to, from);
        this.v2.y += (0.7 + dist * 0.06) * 4 * (1 - 2 * u);
        shots.fly(e.slot, p, this.v2, u);
        continue;
      }
      // Angekommen
      k.shotDone = true;
      if (target && tv && tv.seen) {
        const tLocal = target.slot === this.localSlot;
        if (target.gold > 0 || target.guard > 0 || target.tow > 0 || target.rocket > 0) {
          // Abgeprallt: ein paar Spritzer, den Rest erzählen „PLING!“ bzw. „KLONK!“
          this.burst(to.x, to.y, to.z, 10, 6, 0xfff1c2, false, 0.4, 0.4, 3);
        } else {
          // (Das Wort steht dort, wo der Getroffene gleich ist – sonst führe die Kamera hinter ihm hindurch.)
          this.pops.show('PLATSCH!', to.x + target.vx * 0.55, to.y + 1.7, to.z + target.vz * 0.55, 'white', tLocal ? 3.4 : 3.8);
          this.burst(to.x, to.y, to.z, 12, 5, 0xfff1c2, false, 0.32, 0.45, 2.5);
          tv.visual.squash(0.7);
          this.emit('glue-hit', tv, tLocal);
          if (tLocal) this.shake = Math.max(this.shake, 0.25);
        }
      } else {
        this.splatOnRoad(to, e.seg);
        this.pops.show('PLATSCH!', to.x, to.y + 1.4, to.z, 'white', 2.8);
        this.burst(to.x, to.y + 0.2, to.z, 12, 5, 0xfff1c2, false, 0.45, 0.5, 2);
        this.emitAt('glue-hit', to.x, to.y, to.z, 60);
      }
    }
    // (Wer gerade getroffen ist, sieht Kleber auf dem Bildschirm – siehe glue.)
    this.glue = me && me.respawn === 0 ? me.glue / 60 : 0;
    shots.update(dt);
  }

  /** Kleber ohne Ziel: Klecks auf die Fahrbahn, nach ihrer Neigung gelegt (hint: Abschnitt in der Nähe). */
  private splatOnRoad(p: THREE.Vector3, hint: number): void {
    const t = this.track;
    projectOnTrack(t, p.x, p.z, hint < t.total ? hint : 0);
    const seg = proj.seg;
    const slope = (t.py[t.next[seg]] - t.py[t.prev[seg]]) / (2 * t.step);
    const gx = slope * t.tx[seg] + t.bank[seg] * rightX(t, seg);
    const gz = slope * t.tz[seg] + t.bank[seg] * rightZ(t, seg);
    this.v2.set(-gx, 1, -gz).normalize();
    this.q1.setFromUnitVectors(Y_UP, this.v2);
    this.glueShots?.splat(p, this.q1, 1.3);
  }

  /**
   * Get Gold: Ein Rollreifen, Ölfleck oder Kreisel, der direkt an einem Gold-Kart verschwindet, ist an ihm abgeprallt –
   * „PLING!“, ein Funkenregen und ein heller Ton.
   */
  private goldDeflect(things: SnapshotThing[]): void {
    const was = this.thingsWere;
    if (this.goldList.length > 0) {
      for (const [id, p] of was) {
        if (things.some((th) => th.id === id)) continue;
        for (const g of this.goldList) {
          if (Math.abs(g.y - p.y) > 3 || Math.hypot(g.x - p.x, g.z - p.z) > 3.4) continue;
          const k = this.karts.get(g.slot);
          if (!k) break;
          this.pop('PLING!', g, 'white', 3.4);
          this.burst(p.x, p.y + 0.6, p.z, 14, 9, 0xfff3c2, true, 0.4, 0.45, 5);
          this.emit('gold-ping', k, g.slot === this.localSlot);
          break;
        }
      }
    }
    was.clear();
    for (const th of things) if (th.kind !== THING_SMOKE) was.set(th.id, { x: th.x, y: th.y, z: th.z });
  }

  /** Get Gold: das nächste Gold-Kart (ein anderes) höchstens reach Meter von e entfernt, sonst null. */
  private goldNear(e: RenderEntity, reach: number): RenderEntity | null {
    let best: RenderEntity | null = null;
    let bestD = reach;
    for (const g of this.goldList) {
      if (g.slot === e.slot || Math.abs(g.y - e.y) > 3) continue;
      const d = Math.hypot(g.x - e.x, g.z - e.z);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  /** Get Gold: goldene Funken an zufälligen Stellen von Kart und Fahrer, etwa 36 je Sekunde. */
  private goldSparkle(e: RenderEntity, k: KartView, dt: number): void {
    const n = Math.floor(dt * 36 + Math.random());
    const sz = k.sizeK;
    const cs = Math.cos(e.heading);
    const sn = Math.sin(e.heading);
    for (let i = 0; i < n; i++) {
      const lx = (Math.random() - 0.5) * 1.7 * sz;
      const lz = (Math.random() - 0.5) * 2.3 * sz;
      const ly = (0.25 + Math.random() * 1.5) * sz;
      const c = GOLD_SPARKS[(Math.random() * GOLD_SPARKS.length) | 0];
      this.color.set(c);
      this.sparks.emit(e.x + lx * cs + lz * sn, e.y + ly, e.z - lx * sn + lz * cs, e.vx * 0.35 + (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 1.4, e.vz * 0.35 + (Math.random() - 0.5) * 1.2, 0.35 + Math.random() * 0.35, 0.12 + Math.random() * 0.13, this.color, -0.2, -0.6, 1);
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
    // Riesenkinderzimmer: ein riesiges Kart bricht durch die Bauklotz-Mauer (es fährt auf das eigene Stück der
    // Abkürzung, die nur Riesige einlässt) – es kracht und Klötze fliegen.
    if (this.track.sizers.length > 0 && e.seg < this.track.total) {
      const tr = this.track;
      const kb = tr.branchOf[e.seg];
      const own = kb >= 0 && tr.branchOnly[kb] > 0 && tr.twin[e.seg] < 0;
      if (own && !k.inCastle && !k.fresh) {
        this.emit('smash', k, local);
        for (let n = 0; n < 3; n++) this.burst(e.x, e.y + 0.6 + n * 0.6, e.z, 8, 9, [0xe2483a, 0x3f8fd6, 0xe8b93a][n], false, 0.7, 0.8, 6);
        if (local) this.shake = Math.max(this.shake, 0.35);
      }
      k.inCastle = own;
    }
    // Riesenkinderzimmer: geschrumpft, gewachsen oder wieder normal?
    if (this.track.sizers.length > 0) {
      const cls = sizeClass(e.size);
      if (cls !== k.sizeWas && !k.fresh) {
        this.emit(cls < 0 ? 'shrink' : cls > 0 ? 'grow' : 'sizeend', k, local);
        this.burst(e.x, e.y + 0.6, e.z, 12, 6, cls < 0 ? 0x6fc3ff : cls > 0 ? 0xffa23a : 0xffffff, true, 0.5, 0.5, 3);
        if (local && cls !== 0) this.pop(cls < 0 ? 'WINZIG!' : 'RIESIG!', e, cls < 0 ? 'cool' : 'hot', 3.4);
      }
      k.sizeWas = cls;
    }
    // Wüstenexpress: Steht das Kart auf einem Wagendach? Beim Aufrollen scheppert es; das eigene Kart rattert, solange es oben ist.
    if (this.track.roofed) {
      const tr = this.track;
      let roof = k.roof;
      if (e.respawn > 0) roof = false;
      else if (!air && e.seg < tr.total) {
        projectOnTrack(tr, e.x, e.z, e.seg);
        const road = groundNow(tr, proj.seg, proj.along, proj.lat, this.mechTime);
        roof = road !== NO_GROUND && e.y - road > 0.9;
      } else if (air && e.y - tr.py[e.seg < tr.total ? e.seg : 0] < 0.6) roof = false;
      if (roof && !k.roof && !k.fresh) {
        this.emit('board', k, local);
        this.burst(e.x, e.y + 0.1, e.z, 6, 4, 0xe9d9b5, false, 0.4, 0.4, 2);
        if (local) this.pop('AUFGESPRUNGEN!', e, 'warm', 3.2);
      }
      if (roof && local) {
        k.roofWait -= dt;
        if (k.roofWait <= 0) {
          k.roofWait = 0.3;
          this.emit('rattle', k, true);
        }
      } else k.roofWait = 0;
      k.roof = roof;
    }
    // Dschungel-Fluss: auf welchem Floß steht das Kart? Beim Wechsel rumpelt es; das eigene Kart rauscht, solange es auf dem Fluss ist.
    if (this.track.rivers.length > 0) {
      const tr = this.track;
      let lane = -1;
      if (!air && e.respawn === 0 && e.seg < tr.total && (tr.edge[e.seg] & EDGE_RIVER) !== 0) {
        projectOnTrack(tr, e.x, e.z, e.seg);
        const l = raftLane(tr, proj.seg, proj.along, proj.lat, this.mechTime);
        const r = tr.rivers.find((x) => proj.seg >= x.first && proj.seg < x.first + x.count);
        if (l && r) lane = r.lanes.indexOf(l);
      }
      if (lane >= 0) {
        if (lane !== k.raft && !k.fresh) {
          this.emit('raft', k, local);
          this.burst(e.x, e.y + 0.1, e.z, 5, 4, 0xdff3e8, false, 0.4, 0.4, 2);
        }
        k.riverWait -= dt;
        if (k.riverWait <= 0) {
          k.riverWait = 0.35;
          if (local) this.emit('rapids', k, true);
        }
      } else if (!air) k.riverWait = 0;
      if (!air) k.raft = lane;
    }
    // Achterbahn-Rummel: Sitzt das Kart auf der Schiene? Beim Auffahren rastet es ein; das eigene Kart rollt hörbar, auf dem
    // Lifthügel rattert die Kette, ein Schubmagnet ruckt es an, und über eine schnelle Kuppe geht es mit „HUI!“.
    if (this.track.rails.length > 0) {
      const tr = this.track;
      const rail = !air && e.respawn === 0 && e.seg < tr.total && (tr.edge[e.seg] & EDGE_RAIL) !== 0 ? railOf(tr, e.seg) : null;
      if (rail) {
        const v = Math.hypot(e.vx, e.vz);
        if (!k.rail && !k.fresh) {
          this.emit('latch', k, local);
          this.burst(e.x, e.y + 0.1, e.z, 6, 4, 0xffe9a8, true, 0.35, 0.35, 2);
        }
        if (k.rail && e.boost > k.boostWas + 10) {
          this.emit('kick', k, local);
          this.burst(e.x, e.y + 0.3, e.z, 10, 7, 0xffd23a, true, 0.5, 0.45, 2);
          if (local) this.pop('ZACK!', e, 'warm', 3.2);
        }
        const slope = (tr.py[tr.next[e.seg]] - tr.py[e.seg]) / tr.step;
        if (local) {
          let lift = false;
          for (const l of rail.lifts) if (e.seg >= l[0] && e.seg <= l[1]) lift = true;
          k.railWait -= dt;
          if (k.railWait <= 0) {
            k.railWait = 0.4;
            // (In der Kristallmine rattert die Lore auf dem Grubengleis.)
            this.emit(tr.def.theme === 'kristall' ? 'lore' : 'coaster', k, true);
          }
          if (lift) {
            k.chainWait -= dt;
            if (k.chainWait <= 0) {
              k.chainWait = 0.22;
              this.emit('chain', k, true);
            }
          } else k.chainWait = 0;
          // Kuppe: eben noch bergauf, jetzt bergab – und schnell genug, dass es im Bauch kribbelt
          if (k.rail && k.slopeWas > -0.06 && slope <= -0.06 && v > 15) {
            this.emit('crest', k, true);
            this.pop('HUI!', e, 'cool', 3.2);
          }
        }
        k.slopeWas = slope;
      } else if (!air) {
        k.railWait = 0;
        k.chainWait = 0;
      }
      if (!air) k.rail = rail !== null;
      k.boostWas = e.boost;
    }
    // Magnetwerk: Beim Einfahren in die Magnettrommel packen die Magnete das eigene Kart („Klonk“, auch nach dem Neuaufsetzen
    // vor der Decke); solange es darin ist, brummen sie – je weiter die Bahn verdreht ist, desto lauter und heller. Die Stärke
    // 0 (Hallenboden) … 1 (Decke) kommt als Pegel 0,75 … 1 an (sfx.ts: HUM_FLOOR) – darum ortsfest gemeldet, wie sound.ts es
    // nur dort weitergibt.
    if (this.track.drums.length > 0) {
      const tr = this.track;
      const inDrum = e.respawn === 0 && e.seg < tr.total && (tr.edge[e.seg] & EDGE_DRUM) !== 0;
      if (local && inDrum) {
        if (!k.drum && !k.fresh) this.emit('clamp', k, true);
        k.humWait -= dt;
        if (k.humWait <= 0) {
          k.humWait = 0.4;
          const lean = (1 - Math.cos(tr.roll[e.seg])) / 2;
          this.onEvent?.({ kind: 'hum', slot: k.slot, local: false, pan: 0, gain: 0.75 + 0.25 * lean });
        }
      } else k.humWait = 0;
      k.drum = inDrum;
    }
    // Sturmhafen: schiebt gerade eine Böe? Das eigene Kart meldet sich regelmäßig (Heulen); Schleier und Gischt zeichnet mechanics/harbor.ts.
    if (this.track.winds.length > 0) {
      const tr = this.track;
      let blow = 0;
      if (e.respawn === 0) {
        projectOnTrack(tr, e.x, e.z, e.seg);
        blow = windPush(tr, proj.seg, proj.along, proj.lat, this.mechTime);
      }
      const gusty = Math.abs(blow) > 1.5;
      if (gusty) {
        k.gustWait -= dt;
        if (k.gustWait <= 0) {
          k.gustWait = 0.3;
          if (local) this.emit('storm', k, true);
        }
        if (!k.gusty && !k.fresh && Math.abs(blow) > 3) this.pop('HUI!', e, 'cool', 3);
      } else k.gustWait = 0;
      k.gusty = gusty;
    }
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
      // Get Gold: Austrinken beginnt, ausgetrunken (gold und groß), abgelaufen.
      // (Die Wörter stehen ein Stück voraus: ein fahrendes Kart holt sie ein, die Kamera dahinter nicht, solange sie stehen.)
      if (e.gold > GOLD_TICKS && k.gold <= GOLD_TICKS) {
        this.popAhead('GLUCK GLUCK!', e, 'warm', 3);
        this.emit('use-gold', k, local);
      }
      if (goldOn(e) && !(k.gold > 0 && k.gold <= GOLD_TICKS)) {
        this.popAhead('GOLD!', e, 'warm', 4.6);
        this.burst(e.x, e.y + 1.4, e.z, 22, 9, 0xffd34a, true, 0.38, 0.75, 6);
        this.burst(e.x, e.y + 0.9, e.z, 14, 6, 0xffe98a, true, 0.3, 0.55, 3);
        k.visual.squash(-1);
        this.emit('gold', k, local);
        if (local) this.shake = Math.max(this.shake, 0.25);
      }
      if (e.gold === 0 && k.gold > 0 && k.gold <= GOLD_TICKS && e.rocket === 0) {
        this.burst(e.x, e.y + 0.9, e.z, 16, 4, 0xffd34a, true, 0.45, 0.7, 1);
        k.visual.squash(0.6);
        this.emit('gold-end', k, local);
      }
      // Bohrer: die Figur holt ihn hervor und steckt ihn ein; im Moment, in dem er steckt, spritzt Erde.
      if (e.plant > 0 && k.plant === 0) this.emit('use-drill', k, local);
      if (e.plant === 0 && k.plant > 0) {
        const c = Math.cos(e.heading);
        const sn = Math.sin(e.heading);
        // (rechts neben dem Kart, wo der Host ihn absetzt)
        const px = e.x - c * DRILL_SIDE + sn * DRILL_FORE;
        const pz = e.z + sn * DRILL_SIDE + c * DRILL_FORE;
        const p = this.fxAt(px, e.y + 1.2, pz);
        this.pops.show('RATSCH!', p.x, p.y + 1.6, p.z, 'warm', 3.2);
        this.burst(px, e.y + 0.2, pz, 10, 5, 0x8a5a34, false, 0.35, 0.5, 5);
        k.visual.squash(0.55);
        if (local) this.shake = Math.max(this.shake, 0.22);
      }
      // Rakete: Verwandlung, Abheben, Landung
      if (e.rocket > 0 && k.rocket === 0) {
        this.pop('VERWANDLUNG!', e, 'cool', 3.6);
        this.burst(e.x, e.y + 0.8, e.z, 12, 5, 0xdfe6f2, true, 0.4, 0.4, 4);
        this.emit('use-rocket', k, local);
        k.incoming = false;
      }
      if (e.rocket > 0 && e.rocket <= ROCKET_MORPH_TICKS) {
        // Klacken, wenn Teile einrasten (Zeitpunkte wie die Zeitfenster in kartModel.ts)
        for (const at of [0.4, 0.5, 0.58, 0.63, 0.72, 0.76, 0.86]) {
          const tick = Math.round(at * ROCKET_MORPH_TICKS);
          if (k.rocket < tick && e.rocket >= tick) this.burst(e.x, e.y + 0.6 + at * 2.6, e.z, 5, 4, 0xffe9a8, true, 0.3, 0.25, 2);
        }
      }
      if (e.rocket > ROCKET_MORPH_TICKS && k.rocket <= ROCKET_MORPH_TICKS && k.rocket > 0) {
        this.pop('WUSCH!', e, 'hot', 4.2);
        this.burst(e.x, e.y + 0.2, e.z, 26, 11, 0xe9e6f2, false, 1.1, 1.1, 1);
        this.burst(e.x, e.y + 0.3, e.z, 16, 8, 0xff8a1c, true, 0.8, 0.4, 3);
        this.emit('rocket-launch', k, local);
        if (local) this.shake = Math.max(this.shake, 0.5);
      }
      if (e.rocket === 0 && k.rocket > ROCKET_MORPH_TICKS) {
        this.rocketImpact(e);
        k.visual.squash(-1);
        this.emit('rocket-hit', k, local);
        if (local) {
          this.hitstop = 0.07;
          this.shake = Math.max(this.shake, 0.8);
        }
      }
      // Roboter: Verwandlung beginnt (Klacken an den Gelenken), Satz nach vorn (Staub vom Absprung)
      if (e.robot > 0 && k.robot === 0) {
        this.popAhead('ROBO-MODUS!', e, 'cool', 3.6);
        this.burst(e.x, e.y + 0.5, e.z, 8, 4, 0xffe9a8, true, 0.16, 0.3, 3);
        k.visual.squash(0.6);
        this.emit('use-robot', k, local);
        if (local) this.shake = Math.max(this.shake, 0.12);
      }
      if (e.robot > 0 && k.robot > 0) {
        // Einrasten der Teile: kurze Funken an Knien, Schultern und Fäusten (Zeitpunkte und Höhen wie in kartModel.ts)
        for (const [at, up] of ROBOT_CLACKS) {
          const tick = Math.round(at * 60);
          if (k.robot < tick && e.robot >= tick) this.burst(e.x, e.y + up, e.z, 5, 3, 0xffe9a8, true, 0.14, 0.2, 2);
        }
      }
      if (e.robot >= ROBOT_LEAP_AT && k.robot < ROBOT_LEAP_AT && k.robot > 0) {
        this.popAhead('HOPP!', e, 'warm', 3.8);
        this.burst(e.x, e.y + 0.15, e.z, 12, 6, 0xd9cfc0, false, 0.5, 0.4, 1.2);
        k.visual.squash(-0.7);
        this.emit('robot-jump', k, local);
        if (local) this.shake = Math.max(this.shake, 0.22);
      }
      // Kleber: die Pistole klappt aus; das eigene Kart ist getroffen (neue Kleckse auf dem Bildschirm)
      if (e.glueShot > 0 && k.gunT === 0) this.emit('use-glue', k, local);
      if (local && e.glue > k.glue + 3) this.glueHits++;
      if (e.spin > 0 && k.spin === 0) {
        // Von einem Gold-Kart umgehauen? (Es steht direkt daneben.)
        const rammer = this.goldNear(e, 4.2);
        this.pop(rammer ? 'WAMM!' : 'KRACH!', e, 'hot', rammer ? 4.6 : 4.2);
        this.burst(e.x, e.y + 1, e.z, 16, 9, 0xffd23f, true, 0.7, 0.7, 6);
        this.burst(e.x, e.y + 0.6, e.z, 8, 5, 0xe9e6f2, false, 0.9, 0.7);
        k.visual.squash(1);
        if (rammer) this.emit('gold-ram', k, local || rammer.slot === this.localSlot);
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
      } else if (e.boost > 0 && e.boost > k.boost + 20 && k.tow === 0 && this.inChargeField(e)) {
        // Im Ladefeld eines Blitzableiters aufgeladen.
        this.pop('GELADEN!', e, 'cool', 3);
        this.burst(e.x, e.y + 0.7, e.z, 14, 10, 0xbfe9ff, true, 0.45, 0.45, 3);
        k.visual.squash(-0.8);
        this.emit('charge', k, local);
        if (local) this.shake = Math.max(this.shake, 0.2);
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
        if (k.item === ITEM_ROCKET) {
          // Wirkung und Ton kommen mit dem Beginn der Verwandlung (siehe oben).
        } else if (k.item === ITEM_KITE) {
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
        } else if (k.item === ITEM_WING) {
          this.pop('HUIII!', e, 'cool', 3.4);
          this.burst(e.x, e.y + 0.2, e.z, 14, 7, 0xe9e6f2, false, 0.7, 0.6, 2);
          this.burst(e.x, e.y + 0.5, e.z, 8, 5, 0xffe04a, true, 0.4, 0.4, 5);
          k.visual.squash(-1);
          this.emit('use-wing', k, local);
          if (local) this.shake = Math.max(this.shake, 0.18);
        }
        // (Roboter und Kleber: Wirkung und Ton kommen mit dem Spielstand – Verwandlung bzw. Pistole, siehe oben.)
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
    // Get Gold: Glitzern rund ums Kart – die Funken bleiben als goldene Spur zurück.
    if (goldOn(e) && e.respawn === 0) this.goldSparkle(e, k, dt);
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
    // Länge des Schleuderns für die Drehung im Bild: so lang, wie es war, als es anfing (mindestens ein gewöhnlicher Treffer).
    if (e.spin === 0) k.spinFull = 0;
    else if (e.spin > k.spin) k.spinFull = Math.max(SPIN_TICKS, e.spin);
    k.spin = e.spin;
    k.rocket = e.rocket;
    k.gold = e.gold;
    k.robot = e.robot;
    k.glue = e.glue;
    k.plant = e.plant;
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
      this.cockpit.render(this.renderer, this.scene, this.camera);
      return;
    }
    this.time += dt;
    if (race.raceId !== this.raceId) {
      this.raceId = race.raceId;
      this.skids.clear();
      this.pops.clear();
      this.drills.clear();
      this.camReady = false;
      for (const k of this.karts.values()) k.fresh = true;
    }

    for (const k of this.karts.values()) k.seen = false;
    // Get Gold: wer gerade gold ist (für „umgehauen“ und „abgeprallt“).
    this.goldList.length = 0;
    for (const e of entities) if (goldOn(e) && e.respawn === 0) this.goldList.push(e);
    this.localSlot = localSlot;
    this.empFrom.length = 0;
    this.empHit.length = 0;
    this.shadows.begin();
    this.lights.begin();
    let me: RenderEntity | null = null;
    let meView: KartView | null = null;
    // Cockpit-Ansicht: nur im Rennen, nicht in der Übersicht, nicht für die Fotokamera; nach dem Ziel wieder von außen
    // (dann sieht man die eigene Figur jubeln).
    const fpWanted = this.view === 'first' && this.cameraMode === 'chase' && !this.photo && race.phase !== RACE_RESULTS;

    for (const e of entities) {
      const local = e.slot === localSlot;
      const k = this.kartView(e.slot, e.char);
      k.seen = true;
      k.visual.firstPerson = local && fpWanted && !e.finished;
      // Spiegelkabinett: Wer durch ein Portal fährt, steht im selben Augenblick woanders. Das ist kein Fahren, sondern
      // ein Schnitt – nichts wird dorthin geglättet, keine Bremsspur quer durch die Halle, die eigene Kamera springt mit.
      if (t.portals.length > 0) {
        if (!k.fresh && e.respawn === 0 && k.respawn === 0 && e.rocket === 0 && k.rocket === 0 && Math.abs(e.x - k.lastX) + Math.abs(e.z - k.lastZ) > 10) {
          const forward = progDelta(t, k.lastSeg, e.seg) > 0;
          const hex = forward ? 0x9fe8ff : 0xff7ad1;
          this.burst(k.lastX, k.lastY + 0.8, k.lastZ, 10, 6, hex, true, 0.5, 0.45, 2);
          this.burst(e.x, e.y + 0.8, e.z, 14, 7, hex, true, 0.5, 0.5, 2);
          this.emit(forward ? 'portal' : 'mirror', k, local);
          k.fresh = true;
          k.hasTrail = false;
          if (local) {
            this.camReady = false;
            this.pop(forward ? 'HINDURCH!' : 'ZURÜCK!', e, forward ? 'violet' : 'hot', 3.4);
          }
        }
        k.lastX = e.x;
        k.lastY = e.y;
        k.lastZ = e.z;
        k.lastSeg = e.seg < t.total ? e.seg : 0;
      }
      const speed = Math.hypot(e.vx, e.vz);
      const fx = Math.sin(e.heading);
      const fz = Math.cos(e.heading);
      const vf = e.vx * fx + e.vz * fz;
      const air = (e.flags & FLAG_AIR) !== 0;

      // Boden unter dem Kart und dessen Neigung
      projectOnTrack(t, e.x, e.z, e.seg);
      const seg = proj.seg;
      const ground = groundNow(t, seg, proj.along, proj.lat, this.mechTime);
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
      pose.spin = e.spin > 0 ? 1 - e.spin / Math.max(k.spinFull, e.spin, SPIN_TICKS) : 0;
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
      const flying = e.rocket > ROCKET_MORPH_TICKS;
      pose.rocket = e.rocket > 0 ? Math.min(1, e.rocket / ROCKET_MORPH_TICKS) : 0;
      pose.rocketFlame = flying ? 1 : e.rocket > ROCKET_MORPH_TICKS * 0.9 ? 0.45 : 0;
      if (e.rocket > 0) {
        pose.speed = 0;
        pose.air = flying;
        pose.held = 0;
      }
      pose.emote = e.finished ? (e.place <= 1 || (entities.length > 2 && e.place <= 2) ? 'win' : 'lose') : 'none';
      // Get Gold: Austrinken (Fortschritt), gold, kurz vor dem Ende blinkend.
      pose.drink = e.gold > GOLD_TICKS ? (GOLD_ALL - e.gold + 1) / (GOLD_DRINK_TICKS + 1) : 0;
      // Bohrer: Einstecken (Fortschritt; bei 0 steckt er im Boden).
      pose.plant = e.plant > 0 ? (DRILL_PLANT_TICKS - e.plant + 1) / (DRILL_PLANT_TICKS + 1) : 0;
      pose.gold = goldOn(e);
      pose.goldBlink = goldOn(e) && e.gold < GOLD_WARN;

      // Hören: Entfernung und Richtung zur Kamera
      this.v1.set(e.x, e.y, e.z).sub(this.camera.position);
      const dist = this.v1.length();
      this.v2.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      k.audio.local = local;
      k.audio.speed = e.rocket > 0 ? 0 : Math.abs(vf) / V_MAX;
      k.audio.throttle = !e.finished && race.phase !== RACE_COUNTDOWN && e.spin === 0 && e.rocket === 0;
      k.audio.boost = e.boost > 0 || e.tow > 0 || flying;
      k.audio.drift = e.driftDir !== 0 ? Math.max(0.5, pose.driftStage) : 0;
      // Loser Untergrund klingt wie der Grünstreifen: es prasselt unter den Rädern.
      k.audio.offroad = pose.offroad || DUST[this.track.surf[e.seg < this.track.total ? e.seg : 0]] !== 0;
      k.audio.air = air;
      k.audio.stall = e.stall > 0;
      k.audio.distance = dist;
      k.audio.pan = dist > 0.5 ? Math.max(-1, Math.min(1, this.v1.dot(this.v2) / dist)) : 0;

      this.fxSeg = e.respawn === 0 && e.rocket === 0 && e.seg < t.total && (t.edge[e.seg] & EDGE_TWIST) !== 0 ? e.seg : -1;
      this.detect(k, e, local, dt);
      this.fxSeg = -1;

      const root = k.visual.root;
      root.position.set(e.x, e.y, e.z);
      root.rotation.set(k.pitch, e.heading, k.roll);
      if (flying) {
        // Im Flug zeigt die Achse der Rakete (+y von root) in Flugrichtung; die Mitte der Rakete sitzt auf der Bahn.
        const v = Math.hypot(e.vx, e.vy, e.vz);
        if (v > 0.5) {
          this.v1.set(e.vx / v, e.vy / v, e.vz / v);
          this.q1.setFromAxisAngle(Y_UP, e.heading);
          ROCKET_Q.setFromUnitVectors(Y_UP, this.v1).multiply(this.q1);
          k.rocketQ.slerp(ROCKET_Q, Math.min(1, dt * 12));
          root.quaternion.copy(k.rocketQ);
          root.position.addScaledVector(this.v1, -1.6);
        } else root.quaternion.copy(k.rocketQ);
      } else k.rocketQ.copy(root.quaternion);
      // Schwebeband: Das Kart schwebt eine Handbreit über dem Band (die Räder klappen weg, kartModel.ts) – weich beim
      // Auf- und Abfahren.
      const hover = e.respawn === 0 && e.rocket === 0 && e.seg < t.total && (t.edge[e.seg] & EDGE_BAND) !== 0;
      if (k.fresh) k.hoverK = hover ? 1 : 0;
      k.hoverK += ((hover ? 1 : 0) - k.hoverK) * Math.min(1, dt * 7);
      pose.hover = k.hoverK;
      if (k.hoverK > 0.001 && !flying) root.position.y += BAND_HOVER * k.hoverK;
      // Schwebeband an der Fassade: an die gezeigte Stelle drehen (gerechnet wird flach).
      let twistK = false;
      if (!flying && e.respawn === 0 && e.seg < t.total && (t.edge[e.seg] & EDGE_TWIST) !== 0 && this.twistTurn(e.x, e.z, e.seg)) {
        this.twistApply(root.position);
        root.quaternion.premultiply(this.dq);
        twistK = true;
      }
      // Von der Presse geplättet: flach wie eine Flunder, dafür etwas breiter – und am Ende federt es zurück.
      k.flatK += ((e.flat > 6 ? 1 : 0) - k.flatK) * Math.min(1, dt * (e.flat > 6 ? 26 : 9));
      // Riesenkinderzimmer: winzig oder riesig – weich nachgeführt; kurz vor dem Ende pulsiert das Kart ruhig
      // zwischen seiner Größe und der normalen (drei Mal je Sekunde, kein Flackern).
      let wantK = sizeScale(e.size);
      if (e.size !== 0 && Math.abs(e.size) < SIZE_WARN) wantK = 1 + (wantK - 1) * (0.7 + 0.3 * Math.cos(this.time * 19));
      // Get Gold: groß – in der letzten Sekunde pulsiert es wie eine ablaufende Größe.
      if (goldOn(e)) wantK = e.gold < GOLD_WARN ? 1 + (GOLD_SCALE - 1) * (0.7 + 0.3 * Math.cos(this.time * 19)) : GOLD_SCALE;
      if (k.fresh) k.sizeK = wantK;
      k.sizeK += (wantK - k.sizeK) * Math.min(1, dt * 9);
      root.scale.set((1 + 0.22 * k.flatK) * k.sizeK, (1 - 0.7 * k.flatK) * k.sizeK, (1 + 0.12 * k.flatK) * k.sizeK);
      // Nach einem Treffer blinkt das Kart, solange es unverwundbar ist – nur nicht, solange es platt ist:
      // die Flunder soll man sehen.
      // (Aus dem Cockpit blinkt nichts: Das eigene Kart füllt dort das halbe Bild.)
      root.visible = k.visual.firstPerson || !(e.shield > 0 && e.spin === 0 && e.respawn === 0 && e.flat === 0 && Math.floor(this.time * 14) % 2 === 0);
      // Roboter und Klebepistole: Zeit seit dem Auslösen (weich – fremde Karts melden sie nur stoßweise); die Pistole zielt
      // auf das gezeigte Ziel (im Raum dieses Karts). Kleckse auf Gesicht und Haube, solange der Kleber klebt.
      k.robotT = followTicks(k.robotT, e.robot, dt);
      pose.robot = k.robotT;
      k.gunT = followTicks(k.gunT, e.glueShot, dt);
      pose.glueGun = k.gunT;
      pose.glue = e.glue / 60;
      pose.glueAim = null;
      const aimed = e.glueShot > 0 && e.glueAim >= 0 ? this.karts.get(e.glueAim) : undefined;
      // (Das Ziel steht dort, wo es zuletzt gezeigt wurde – auch wenn es in diesem Bild erst nach dem Schützen drankommt.)
      if (aimed && !aimed.fresh) {
        root.updateMatrix();
        pose.glueAim = this.gunAim.copy(aimed.visual.root.position).setY(aimed.visual.root.position.y + 1).applyMatrix4(this.m1.copy(root.matrix).invert());
      }
      k.visual.update(dt, pose);
      // Roboter: jeder aufgesetzte Fuß wirbelt Staub auf und stampft.
      if (k.visual.robotSteps !== k.robotSteps) {
        k.robotSteps = k.visual.robotSteps;
        root.updateMatrixWorld();
        const f = root.localToWorld(this.v1.copy(k.visual.robotFoot));
        this.burst(f.x, f.y + 0.1, f.z, 6, 3, 0xd9cfc0, false, 0.32, 0.3, 0.8);
        this.emit('robot-step', k, local);
        if (local) this.shake = Math.max(this.shake, 0.06);
      }

      if (ground !== NO_GROUND && e.respawn === 0 && !flying && twistK) {
        // An der Fassade liegt der Schatten mit an der Wand: den Bodenpunkt und die Neigung mitdrehen.
        this.e1.set(groundPitch, e.heading, groundRoll);
        this.q1.setFromEuler(this.e1).premultiply(this.dq);
        this.v1.set(e.x, ground, e.z);
        this.twistApply(this.v1);
        this.shadows.add(this.v1.x, this.v1.y, this.v1.z, this.q1, 2.5, e.y - ground);
      } else if (ground !== NO_GROUND && e.respawn === 0 && !flying) {
        this.e1.set(groundPitch, e.heading, groundRoll);
        this.q1.setFromEuler(this.e1);
        this.shadows.add(e.x, ground, e.z, this.q1, 2.5, e.y - ground);
        // Dunkle Strecke: der Scheinwerfer zeichnet einen Lichtfächer auf die Bahn (in der Luft trägt er nicht bis zum Boden).
        if (this.track.dark && e.y - ground < 1.2) this.lights.add(e.x, ground, e.z, this.q1);
      }

      // (Wer schwebt, zieht weder Reifenspuren noch Staub.)
      // (Als Roboter rennt es auf den Füßen – keine Reifenspuren.)
      this.trail(k, e, speed, air || twistK || k.hoverK > 0.5 || k.robotT > 0, pose.driftStage, dt);

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
        if (twistK && this.twistTurn(e.x, e.z, e.seg)) this.twistApply(k.label.position);
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

    // Dinge und Hindernisse (auf dem verdrehten Band an die Fassade gedreht)
    if (this.twistSegs.length > 0 && !this.things.afterPlace) {
      this.things.afterPlace = (o) => {
        if (!this.twistTurn(o.position.x, o.position.z, -1)) return;
        // (Drehung je Bild neu: die Dinge setzen nur ihre Gierung, Neigung von gestern weg)
        o.rotation.x = 0;
        o.rotation.z = 0;
        this.twistApply(o.position);
        o.quaternion.premultiply(this.dq);
      };
    } else if (this.twistSegs.length === 0) this.things.afterPlace = null;
    this.things.update(things, dt, this.time, this.fx);
    this.goldDeflect(things);
    this.glueFlights(entities, me, dt);
    this.things.updateHazards(race.hostTick, this.time);
    for (const m of this.mechanics) {
      m.update(race.time, this.time, dt, this.camera.position, this.fx);
      m.observe?.(entities, dt, this.fx);
    }
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
    this.lights.end();
    this.smoke += (Math.max(0, smoke) - this.smoke) * Math.min(1, dt * 8);
    this.threat = Math.max(0, threat);
    this.updateRockets(entities, me);
    this.updateDrills(things, entities, me, dt);
    this.bolts.update(dt);

    this.puffs.update(dt);
    this.sparks.update(dt);
    this.pops.update(dt);

    this.cockpit.active = !!meView && meView.visual.firstPerson;
    this.cockpit.setKart(this.cockpit.active && meView ? meView.visual : null, parseInt(PLAYER_COLORS[localSlot % PLAYER_COLORS.length].slice(1), 16));
    if (this.cockpit.active && me && meView) {
      this.cockpit.mirrorEvery = this.level === 0 ? 0 : this.level === 1 ? 4 : 3;
      this.cockpit.update(
        {
          speed: Math.hypot(me.vx, me.vz),
          speed01: Math.hypot(me.vx, me.vz) / V_MAX,
          driftDir: me.driftDir,
          stage: meView.driftStage,
          boost: me.boost > 0,
          itemReady: me.item !== 0 && me.roulette === 0,
        },
        dt,
      );
    }
    if (this.fpWas && !this.cockpit.active) this.camReady = false;
    this.fpWas = this.cockpit.active;
    this.updateCamera(me, meView, race, dt);
    // Tempostriche: voll bei Schub, sonst bei hohem Tempo – und im Windschatten wachsen sie mit der Ladung.
    const wake = me ? (me.draft >= DRAFT_PULL_FROM ? 0.8 : (me.draft / DRAFT_FULL) * 0.5) : 0;
    const fast = me ? Math.max(wake, me.boost > 0 || me.tow > 0 ? 1 : Math.hypot(me.vx, me.vz) > V_MAX * 1.08 ? 0.45 : 0) : 0;
    this.speedLines.update(dt, this.time, fast, this.camera.aspect);
    this.world.update(this.time, dt, this.camera.position, race.boxes, this.fx, this.mechTime);
    if (this.needsCompile) {
      // Neue Welt: ihr erstes Bild Teil für Teil vorbereiten. Solange das läuft, wird nichts gezeigt.
      if (this.stagedPending) this.beginWarmup();
      if (this.warmList) {
        this.stepWarmup();
        if (this.warmList) return;
      }
      // Alle Shader jetzt übersetzen – auch die der noch unsichtbaren Effekte (Flammen,
      // Schutzring, Tempostriche). Sonst ruckelt es beim ersten Schub oder Treffer.
      this.needsCompile = false;
      this.phase = 'beim Übersetzen der Grafikprogramme';
      this.glueShots?.park();
      this.renderer.compile(this.scene, this.camera);
      this.glueShots?.unpark();
    }
    this.phase = 'beim Zeichnen';
    this.renderer.render(this.scene, this.camera);
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
    if (this.cockpit.active) {
      this.stats.calls += this.cockpit.renderMirror(this.renderer, this.scene);
      this.stats.calls += this.cockpit.render(this.renderer, this.scene, this.camera);
      this.stats.triangles += this.renderer.info.render.triangles;
    }
    this.gfx.frames++;

  }

  /**
   * Behutsamer Aufbau (Test-Schalter ?aufbau=behutsam), Beginn: die Liste aller zeichenbaren Teile entsteht; was
   * auf diesem Gerät schon einmal die Grafik beendet hat, wird aus der Szene genommen.
   */
  private beginWarmup(): void {
    this.stagedPending = false;
    // Nur mit dem Test-Schalter ?aufbau=behutsam – im normalen Spiel entsteht das erste Bild auf einmal.
    if (!isCareful()) return;
    this.warmWhere = `${this.track.def.name}, Stufe ${this.level}`;
    this.gfx.skipped = skipList();
    const all = labelRenderables(this.scene);
    const skip = new Set(this.gfx.skipped);
    if (skip.size > 0) for (const e of all) if (skip.has(e.label)) e.obj.removeFromParent();
    this.warmList = all.filter((e) => !skip.has(e.label));
    this.warmIndex = 0;
    this.warmPhase = 0;
    this.gfx.warm = 0;
    this.canvas.style.visibility = 'hidden';
    // Lichter wirken auch auf der Ebene, auf der die Teile einzeln gezeichnet werden.
    this.scene.traverse((o) => {
      if ((o as THREE.Light).isLight) o.layers.enable(WARM_LAYER);
    });
  }

  /**
   * Behutsamer Aufbau, ein Bildtakt. Drei Abschnitte, jeder mit Marke im Speicher des Browsers (gfxGuard.ts):
   *  0  jedes Teil einzeln zeichnen, Fläche noch verborgen – findet ein Teil, dessen Grafikprogramm die Grafik beendet;
   *  1  die Fläche zeigen und eine halbe Sekunde lang nur den leeren Hintergrund zeichnen – prüft das bloße Anzeigen;
   *  2  die Teile nacheinander dazunehmen, ein Bild je Teil, alle bisherigen bleiben im Bild – findet das Teil,
   *     ab dem das gemeinsame Zeichnen kippt (oder zeigt, dass es an der Menge liegt).
   * Nach jedem Zeichnen erzwingt ein ausgelesener Bildpunkt, dass der Browser wirklich gezeichnet hat.
   */
  private stepWarmup(): void {
    const list = this.warmList;
    if (!list) return;
    const gl = this.renderer.getContext();
    const mask = this.camera.layers.mask;
    const started = performance.now();
    this.camera.layers.set(WARM_LAYER);
    let lost = gl.isContextLost();
    const draw = (): void => {
      try {
        this.renderer.render(this.scene, this.camera);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PROBE);
      } catch (err) {
        console.error(err);
      }
      lost = gl.isContextLost();
    };
    if (this.warmPhase === 0) {
      while (!lost && this.warmIndex < list.length && performance.now() - started < 9) {
        const e = list[this.warmIndex];
        markStep(e.label, this.warmIndex > 0 ? list[this.warmIndex - 1].label : '', `${this.warmWhere}, einzeln`);
        this.phase = `beim Vorbereiten von „${e.label}“ (einzeln, Teil ${this.warmIndex + 1} von ${list.length})`;
        // Das Teil und alles über ihm sichtbar machen; nichts wegen der Blickrichtung auslassen.
        let n = 0;
        for (let o: THREE.Object3D | null = e.obj; o; o = o.parent) {
          WARM_KEEP[n++] = o.visible;
          o.visible = true;
        }
        const culled = e.obj.frustumCulled;
        e.obj.frustumCulled = false;
        e.obj.layers.enable(WARM_LAYER);
        draw();
        e.obj.layers.disable(WARM_LAYER);
        e.obj.frustumCulled = culled;
        n = 0;
        for (let o: THREE.Object3D | null = e.obj; o; o = o.parent) o.visible = WARM_KEEP[n++];
        if (!lost) this.warmIndex++;
      }
      this.gfx.warm = list.length > 0 ? (0.4 * this.warmIndex) / list.length : 0.4;
      if (!lost && this.warmIndex >= list.length) {
        this.warmPhase = 1;
        this.warmIndex = 0;
        this.canvas.style.visibility = '';
      }
    } else if (this.warmPhase === 1) {
      // Kein Teil liegt auf der Ebene: es entsteht nur der Hintergrund – aber er wird jetzt wirklich angezeigt.
      markStep(SHOW_EMPTY, '', `${this.warmWhere}, Bild ${this.warmIndex + 1}`);
      this.phase = `beim Anzeigen der leeren Zeichenfläche (Bild ${this.warmIndex + 1} von 30)`;
      draw();
      if (!lost && ++this.warmIndex >= 30) {
        this.warmPhase = 2;
        this.warmIndex = 0;
      }
      this.gfx.warm = 0.4 + (0.1 * this.warmIndex) / 30;
    } else {
      // Ein Teil mehr je Bild; alle bisherigen bleiben sichtbar und auf der Ebene.
      const e = list[this.warmIndex];
      markStep(e.label, '', `${this.warmWhere}, zusammen mit den ${this.warmIndex} Teilen davor`);
      this.phase = `beim gemeinsamen Zeichnen, neu dazu „${e.label}“ (Teil ${this.warmIndex + 1} von ${list.length})`;
      for (let o: THREE.Object3D | null = e.obj; o; o = o.parent) {
        if (!this.warmVisible.has(o)) this.warmVisible.set(o, o.visible);
        o.visible = true;
      }
      if (e.obj.frustumCulled) {
        this.warmCulled.push(e.obj);
        e.obj.frustumCulled = false;
      }
      e.obj.layers.enable(WARM_LAYER);
      draw();
      if (!lost) this.warmIndex++;
      this.gfx.warm = 0.5 + (0.5 * this.warmIndex) / Math.max(1, list.length);
    }
    this.camera.layers.mask = mask;
    if (lost) {
      // Gleich festhalten, wobei es war (die Seite lebt ja noch): ein Neuaufbau lässt das Teil dann schon aus.
      // Stirbt stattdessen der ganze Tab, steht die Marke noch im Speicher und wird beim nächsten Laden gelesen.
      readCrash();
      this.gfx.skipped = skipList();
      this.gfx.isLost = true;
      if (!this.gfx.lostWhen) this.gfx.lostWhen = this.phase;
      this.endWarmup();
      this.needsCompile = false;
      return;
    }
    if (this.warmPhase === 2 && this.warmIndex >= list.length) {
      clearStep();
      this.endWarmup();
    }
  }

  /** Behutsamer Aufbau, Ende: Sichtbarkeit, Ebenen und Blickprüfung der Teile wie vorher. */
  private endWarmup(): void {
    for (const e of this.warmList ?? []) e.obj.layers.disable(WARM_LAYER);
    for (const [o, v] of this.warmVisible) o.visible = v;
    for (const o of this.warmCulled) o.frustumCulled = true;
    this.warmVisible.clear();
    this.warmCulled.length = 0;
    this.warmList = null;
    this.warmPhase = 0;
    this.gfx.warm = -1;
    this.canvas.style.visibility = '';
  }

  /** Das Rennen wird verlassen oder die Seite geschlossen: eine stehende Marke wäre kein Absturz. */
  leave(): void {
    if (!this.gfx.isLost && isCareful()) clearStep();
    if (this.warmList) {
      this.endWarmup();
      this.stagedPending = true;
    }
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
      // Aus dem Cockpit sieht man die Hinterräder nicht: Dort sprühen auch an der Außenseite des Vorderrads Funken
      // seitlich nach vorn ins Bild.
      if (k.visual.firstPerson && Math.random() < n * 0.8) {
        const outer = e.driftDir > 0 ? A.wheelFrontL : A.wheelFrontR;
        const f = this.v3.copy(outer).applyMatrix4(root.matrixWorld);
        const side = e.driftDir > 0 ? 1 : -1;
        const sx = Math.cos(e.heading) * side;
        const sz = -Math.sin(e.heading) * side;
        this.sparks.emit(
          f.x,
          f.y + 0.05,
          f.z,
          e.vx * 0.55 + sx * (2 + Math.random() * 3),
          1.2 + Math.random() * 2.5,
          e.vz * 0.55 + sz * (2 + Math.random() * 3),
          0.16 + Math.random() * 0.14,
          0.22 + stage * 0.06,
          this.color,
          -0.5,
          12,
          1,
        );
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
        // (Ein Gold-Kart rempelt nicht, es haut um – das meldet der Treffer.)
        if (goldOn(a) !== goldOn(b)) continue;
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
    if (this.photo) {
      // Fotokamera (nur für das Werkzeug, das die Streckenbilder erzeugt): fester Standort und Blick.
      const ph = this.photo;
      cam.position.set(ph.from[0], ph.from[1], ph.from[2]);
      cam.lookAt(ph.to[0], ph.to[1], ph.to[2]);
      cam.fov = ph.fov;
      cam.updateProjectionMatrix();
      this.camReady = false;
      return;
    }
    if (this.cameraMode === 'top' || !me || !k) {
      const h = w.radius * 1.5;
      cam.position.set(w.center.x, h, w.center.z - h * 0.55);
      cam.lookAt(w.center.x, 0, w.center.z);
      cam.fov = 55;
      cam.updateProjectionMatrix();
      this.camReady = false;
      return;
    }
    if (this.cockpit.active) {
      const seg = me.seg < t.total ? me.seg : 0;
      const wall = me.respawn === 0 && (t.edge[seg] & (EDGE_TWIST | EDGE_DRUM)) !== 0;
      this.cockpit.place(cam, k.visual.cockpit, k.char, Math.hypot(me.vx, me.vz) / V_MAX, me.boost > 0 || me.tow > 0, dt, {
        drift: (me.flags & FLAG_AIR) !== 0 ? 0 : me.driftDir,
        stage: k.driftStage,
        loose: (me.flags & FLAG_AIR) === 0 && DUST[t.surf[seg]] !== 0,
        offroad: (me.flags & (FLAG_OFFROAD | FLAG_AIR)) === FLAG_OFFROAD,
        level: wall || me.spin > 0 ? 0 : 0.5,
      });
      if (me.rocket > 0 && race.phase !== RACE_RESULTS) {
        this.cockpit.placeRocket(cam, k.visual.cockpit, Math.min(1, me.rocket / ROCKET_MORPH_TICKS), me.rocket > ROCKET_MORPH_TICKS, dt);
      }
      this.applyShake(dt);
      return;
    }
    if (me.rocket > 0 && !me.finished && race.phase !== RACE_RESULTS) {
      this.rocketCamera(me, dt);
      return;
    }
    this.rocketCam = false;
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
    // (Ein winziges Kart sieht man aus der Nähe und von tiefer, ein riesiges aus größerem Abstand.)
    const zoom = 0.45 + 0.55 * k.sizeK;
    let dist = (5.3 + frac * 1.1) * zoom + this.camGlide * 2.6;
    let height = (2.45 + frac * 0.25) * zoom + this.camGlide * 1.5;
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
    const g = groundNow(t, proj.seg, proj.along, proj.lat, this.mechTime);
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
    // Schwebeband an der Fassade: Die Kamera dreht sich mit dem eigenen Kart an die Wand – um die Achse an seiner Stelle,
    // mit geglättetem Winkel: Zwischen zwei Abschnitten ruckt nichts, und nach einem Neuaufsetzen dreht sie weich zurück.
    // „Oben“ kippt mit (TWIST_CAM_UP): Das Band liegt vor einem wie eine Straße.
    const twisted = this.twistSegs.length > 0 && me.respawn === 0 && me.seg < t.total && (t.edge[me.seg] & EDGE_TWIST) !== 0 && this.twistTurn(me.x, me.z, me.seg);
    if (twisted) {
      this.camAxis.copy(this.dAxis);
      this.camTan.copy(this.dTan);
    }
    const wantTwist = twisted ? this.dAngle : 0;
    this.camTwist += (wantTwist - this.camTwist) * Math.min(1, dt * (twisted ? 7 : 4));
    if (!this.camReady || Math.abs(this.camTwist) < 1e-4) this.camTwist = twisted ? wantTwist : 0;
    if (this.camTwist !== 0) {
      this.v2.copy(this.camLook);
      this.cq.setFromAxisAngle(this.camTan, -this.camTwist);
      cam.position.sub(this.camAxis).applyQuaternion(this.cq).add(this.camAxis);
      this.v2.sub(this.camAxis).applyQuaternion(this.cq).add(this.camAxis);
      this.cq.setFromAxisAngle(this.camTan, -this.camTwist * TWIST_CAM_UP);
      cam.up.set(0, 1, 0).applyQuaternion(this.cq);
      cam.lookAt(this.v2);
    } else {
      cam.up.set(0, 1, 0);
      cam.lookAt(this.camLook);
    }
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

  /**
   * Kamera der eigenen Rakete. Beim Verwandeln schwenkt sie von hinten zur Seite und hebt sich – man soll zusehen können.
   * Im Flug hängt sie in festem Abstand hinter und über der Rakete (der Versatz wird geglättet, nicht die Lage: bei
   * mehreren hundert Stundenkilometern verlöre eine nachlaufende Kamera die Rakete aus dem Blick).
   */
  private rocketCamera(me: RenderEntity, dt: number): void {
    const cam = this.camera;
    const flying = me.rocket > ROCKET_MORPH_TICKS;
    if (!flying) {
      const u = Math.min(1, me.rocket / ROCKET_MORPH_TICKS);
      const sm = u * u * (3 - 2 * u);
      if (!this.camReady) this.camYaw = me.heading;
      const yaw = this.camYaw + Math.PI - 1.0 * sm;
      const d = 6.4 + sm * 1.6;
      const px = me.x + Math.sin(yaw) * d;
      const pz = me.z + Math.cos(yaw) * d;
      const py = me.y + 2.2 + sm * 1.6;
      if (!this.camReady) {
        this.camPos.set(px, py, pz);
        this.camLook.set(me.x, me.y + 1.2, me.z);
        this.camReady = true;
      }
      const f = Math.min(1, dt * 5);
      this.camPos.x += (px - this.camPos.x) * f;
      this.camPos.y += (py - this.camPos.y) * f;
      this.camPos.z += (pz - this.camPos.z) * f;
      this.camLook.x += (me.x - this.camLook.x) * Math.min(1, dt * 8);
      this.camLook.y += (me.y + 1.3 + sm * 0.9 - this.camLook.y) * Math.min(1, dt * 8);
      this.camLook.z += (me.z - this.camLook.z) * Math.min(1, dt * 8);
      this.rocketCam = false;
    } else {
      const vh = Math.hypot(me.vx, me.vz);
      if (vh > 3) this.camYaw += wrapAngle(Math.atan2(me.vx, me.vz) - this.camYaw) * Math.min(1, dt * 3);
      const wantX = -Math.sin(this.camYaw) * 12;
      const wantZ = -Math.cos(this.camYaw) * 12;
      // Beim Steigen knapp über der Rakete, beim Sturz höher – dann sieht man das Ziel unten kommen.
      const wantY = me.vy > 0 ? 3.5 : 8;
      if (!this.rocketCam) {
        this.rocketOff.set(this.camPos.x - me.x, this.camPos.y - me.y, this.camPos.z - me.z);
        this.rocketCam = true;
      }
      const f = Math.min(1, dt * 2.5);
      this.rocketOff.x += (wantX - this.rocketOff.x) * f;
      this.rocketOff.y += (wantY - this.rocketOff.y) * f;
      this.rocketOff.z += (wantZ - this.rocketOff.z) * f;
      this.camPos.set(me.x + this.rocketOff.x, me.y + this.rocketOff.y, me.z + this.rocketOff.z);
      const v = Math.hypot(me.vx, me.vy, me.vz) || 1;
      this.camLook.set(me.x + (me.vx / v) * 3, me.y + (me.vy / v) * 3, me.z + (me.vz / v) * 3);
    }
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    this.applyShake(dt);
    const wantFov = flying ? 74 : 58;
    this.camFov += (wantFov - this.camFov) * Math.min(1, dt * 4);
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
  /** Nur für Tests: Höhe des gezeichneten Geländes an (x, z) – null ohne Welt. */
  debugGround(x: number, z: number): { height: number; drawn: number } | null {
    return this.world ? { height: this.world.heightAt(x, z), drawn: this.world.groundY(x, z) } : null;
  }

  /**
   * Nur für Tests: Strahlen durch die stehende Welt (Fahrbahn, Gelände, Kulisse, Mechanik – ohne Karts und Teilchen).
   * Je Strahl [x, y, z, dx, dy, dz, weit]: erster Treffer (Punkt, Abstand, Name des Netzes samt Eltern) oder null.
   */
  debugRays(rays: number[][]): ({ x: number; y: number; z: number; dist: number; name: string } | null)[] {
    if (!this.world) return rays.map(() => null);
    const rc = new THREE.Raycaster();
    const targets: THREE.Object3D[] = [this.world.group];
    for (const m of this.mechanics) targets.push(m.group);
    const o = new THREE.Vector3();
    const d = new THREE.Vector3();
    return rays.map((r) => {
      o.set(r[0], r[1], r[2]);
      d.set(r[3], r[4], r[5]).normalize();
      rc.set(o, d);
      rc.far = r[6] ?? 1000;
      const hits = rc.intersectObjects(targets, true).filter((h) => {
        const m = h.object as THREE.Mesh;
        const mat = m.material as THREE.Material | undefined;
        // Konturen (Rückseiten, aufgeblasen) und durchsichtige Schleier zählen nicht
        return h.object.name !== 'outline' && !(mat && mat.transparent && mat.opacity < 0.95);
      });
      if (hits.length === 0) return null;
      const h = hits[Math.min(hits.length - 1, r[7] ?? 0)];
      let name = '';
      for (let q: THREE.Object3D | null = h.object; q && q !== this.scene; q = q.parent) name = (q.name || q.type) + (name ? '/' + name : '');
      return { x: h.point.x, y: h.point.y, z: h.point.z, dist: h.distance, name };
    });
  }

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

  /** Für Tests: wie ein Kart gerade gezeigt wird – Maßstab und wie gold (0 … 1). */
  kartLook(slot: number): { scale: number; gold: number; visible: boolean; robot: number; steps: number; gun: number; glue: number } | null {
    const k = this.karts.get(slot);
    if (!k) return null;
    return {
      scale: k.visual.root.scale.y,
      gold: k.visual.goldLook,
      visible: k.visual.root.visible,
      // Roboter: wie weit verwandelt (0 … 1) und gezählte Schritte; Kleber: Pistole ausgeklappt (0 … 1), Kleckse (0 … 1)
      robot: k.visual.robotLook,
      steps: k.visual.robotSteps,
      gun: k.visual.gunLook,
      glue: k.visual.glueLook,
    };
  }

  kartAudio(out: KartAudio[]): KartAudio[] {
    out.length = 0;
    for (const k of this.karts.values()) if (k.seen) out.push(k.audio);
    return out;
  }
}
