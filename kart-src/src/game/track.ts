// Die Strecken: eine geschlossene Mittellinie mit Höhenprofil – und bis zu zwei
// Abzweigungen, die sie verlassen und wieder einmünden.
//
// Aus wenigen Stützpunkten wird eine glatte Kurve und daraus eine Liste gleich
// langer Abschnitte von rund einem Meter (waagerecht gemessen). Alles Weitere –
// Bande, Untergrund, Rundenzählung, KI – rechnet nur mit "welcher Abschnitt",
// "wie weit seitlich daneben" und "wie hoch ist der Boden dort".
//
// Die Abschnitte bilden ein kleines Netz: 0 … n−1 ist die Hauptstrecke
// (Abschnitt 0 beginnt an der Startlinie), dahinter folgen die Abschnitte der
// Abzweigungen. Jeder kennt Vorgänger und Nachfolger (prev/next); an einer
// Gabelung zeigt fork auf den ersten Abschnitt der Abzweigung. Wer wissen
// will, "was 30 m voraus liegt", läuft diese Verweise entlang (walk,
// pathAhead) statt Nummern zu addieren.
//
// Positionen von Rampen, Lücken, Boost-Feldern usw. stehen in den Strecken-
// Beschreibungen nicht in Metern, sondern in "Stützpunkt-Einheiten": 12.5 heißt
// "auf halbem Weg zwischen Stützpunkt 12 und 13". So verschiebt sich nichts,
// wenn eine Kurve nachträglich etwas anders gelegt wird. In einer Abzweigung
// ist 0 die Gabelung, 1 ihr erster eigener Stützpunkt, und so weiter.

import {
  PULSE_BOMB,
  PULSE_BUBBLE,
  PULSE_PRESS,
  PULSE_VENT,
  VEHICLE_SPECS,
  vehicleAt,
  type Belt,
  type Flood,
  type Pulse,
  type Ring,
  type Thermal,
  type Tide,
  type TrafficDef,
  type Vehicle,
  PULSE_AVALANCHE,
  PULSE_ICICLE,
  LAUNCH_SPEED,
  PULSE_BOLT,
  PULSE_METEOR,
  PULSE_ROD,
  PULSE_KICK,
  PONTOON_LINK,
  pontoonLift,
  type Pontoon,
  type Wind,
  GATE_WARN,
  HOLE_WARN,
  planActive,
  type Era,
  type Flash,
  type Gate,
  type Hole,
  type Plan,
  type Portal,
  type RaftLane,
  type Sizer,
  type Rail,
  type River,
  raftAt,
} from './mechanics';
import { SURFACE_INDEX, type SurfaceId } from './surface';
import { TRACK_DEFS } from './tracks';

export type ThemeId = 'werkshof' | 'klippe' | 'glut' | 'nacht' | 'wolken' | 'riff' | 'eis' | 'mond' | 'hafen' | 'vulkan' | 'ruine' | 'gewitter' | 'dschungel' | 'spiegel' | 'wueste' | 'zimmer' | 'rummel';

/** Was auf einem Streckenstück liegt – gilt für die Hauptstrecke wie für Abzweigungen. */
export interface PathFeatures {
  /** Boost-Felder; halfWidth 0 = über die ganze Fahrbahn. */
  pads?: { at: number; lat: number; halfWidth?: number }[];
  /** Reihen von Item-Kisten. */
  boxRows?: number[];
  /** Seitliche Lage der Kisten einer Reihe als Anteil der halben Fahrbahn (ohne Angabe: vier Kisten über die ganze Breite). */
  boxLat?: number[];
  /**
   * Sprungschanzen: steigen über length Meter auf height an und enden abrupt.
   * gap = Länge der Lücke in der Fahrbahn direkt hinter der Kante (Meter).
   */
  ramps?: { at: number; length: number; height: number; gap?: number }[];
  /** Kuppen: runder Buckel über length Meter – bei vollem Tempo hebt das Kart kurz ab. */
  bumps?: { at: number; length: number; height: number }[];
  /** Abschnitte ohne Bande: [von, bis, seite] mit seite -1 links, 1 rechts, 0 beide. */
  open?: [number, number, number][];
  /** Brücken und Stege: [von, bis]. Hier steht die Fahrbahn frei über dem Gelände. */
  decks?: [number, number][];
  /** Tunnel und Höhlen: [von, bis]. Wände und Decke umschließen die Fahrbahn. */
  tunnels?: [number, number][];
  /** Abweichende Breiten: [von, bis, halbe Fahrbahnbreite, Seitenstreifen]. */
  widths?: [number, number, number, number][];
  /**
   * Steilkurven: [von, bis, Querneigung]. Die Zahl ist die Höhenänderung pro
   * Meter nach rechts (−0.4 = in einer Rechtskurve gut 20° nach innen geneigt)
   * und ersetzt dort die Überhöhung aus der Krümmung.
   */
  banks?: [number, number, number][];
  /** Hindernisse, die quer über die Fahrbahn pendeln: Ausschlag in Metern, Periode in Sekunden. */
  hazards?: { at: number; amp: number; period: number; phase: number }[];
  /**
   * Untergrund abschnittsweise: [von, bis, sorte] (siehe surface.ts). Wo nichts
   * steht, gilt der Grund-Untergrund des Wegs (surface).
   */
  surfaces?: [number, number, SurfaceId][];
  /** Grund-Untergrund dieses Wegs; ohne Angabe Asphalt (bei Abzweigungen: wie die Hauptstrecke). */
  surface?: SurfaceId;
  /**
   * Geysire: brechen im Takt aus und schleudern hoch, was über ihnen steht.
   * period und phase in Sekunden; lat = seitliche Lage in Metern.
   */
  vents?: { at: number; lat: number; period: number; phase: number }[];
  /** Lavabomben: schlagen im Takt an dieser Stelle ein und lassen kurz eine Glutpfütze zurück. */
  bombs?: { at: number; lat: number; period: number; phase: number }[];
  /** Steigende Lava: [von, bis] wird im Takt überflutet (period, phase in Sekunden). */
  floods?: { from: number; to: number; period: number; phase: number }[];
  /** Stampfpressen: schlagen im Takt herunter und plätten, was darunter steht. */
  presses?: { at: number; lat: number; period: number; phase: number }[];
  /**
   * Förderbänder: von … bis, seitlich lat0 … lat1 (Meter), Tempo längs und quer
   * in m/s (vorwärts bzw. nach rechts positiv).
   */
  belts?: { from: number; to: number; lat0: number; lat1: number; along?: number; across?: number }[];
  /** Stücke, auf denen Ebbe und Flut gelten: [von, bis] (siehe TrackDef.tide). */
  tidal?: [number, number][];
  /**
   * Flugstrecken: [von, bis] ist eine Lücke ohne Fahrbahn, über der das Kart
   * gleitet (siehe mechanics.ts). Die Höhen der Stützpunkte dort sind die
   * Ideallinie des Flugs.
   */
  glides?: [number, number][];
  /** Aufwinde: lat = seitliche Lage in Metern, lift = Steigen in m/s (ohne Angabe 7). */
  thermals?: { at: number; lat: number; radius?: number; lift?: number }[];
  /** Schubringe in der Luft: up = Höhe der Ringmitte über der Ideallinie (Meter). */
  rings?: { at: number; lat: number; up?: number }[];
  /** Tauchstrecken: [von, bis] liegt unter Wasser (siehe mechanics.ts und TrackDef.sea). */
  dives?: [number, number][];
  /** Strömungen unter Wasser: wie Förderbänder, wirken aber auch auf schwebende Karts. */
  currents?: { from: number; to: number; lat0: number; lat1: number; along?: number; across?: number }[];
  /** Blasenschlote: heben im Takt an, was über ihnen ist (period, phase in Sekunden). */
  bubbles?: { at: number; lat: number; period: number; phase: number }[];
  /** Lawinen: gehen im Takt quer über die Bahn nieder; lat = Bergseite (Vorzeichen: von dort kommt sie). */
  avalanches?: { at: number; lat: number; period: number; phase: number }[];
  /** Eiszapfen: fallen im Takt von der Decke. */
  icicles?: { at: number; lat: number; period: number; phase: number }[];
  /** Meteoriten: schlagen im Takt ein. */
  meteors?: { at: number; lat: number; period: number; phase: number }[];
  /** Blitze: schlagen im Takt an dieser Stelle der Fahrbahn ein (mechanics.ts, PULSE_BOLT). */
  bolts?: { at: number; lat: number; period: number; phase: number }[];
  /** Blitzableiter: Mast bei lat neben der Bahn; im Takt geladen, dann schiebt das Ladefeld quer über die Bahn an (PULSE_ROD). */
  rods?: { at: number; lat: number; period: number; phase: number }[];
  /** Sprungplatten: schleudern das Kart hoch (power = Steiggeschwindigkeit in m/s, ohne Angabe LAUNCH_SPEED). */
  launchers?: { at: number; lat?: number; halfWidth?: number; power?: number }[];
  /**
   * Böen: fegen im Takt quer über [from, to]. push = seitlicher Schub in m/s (nach rechts positiv),
   * period und phase in Sekunden, gust = Dauer einer Böe in Sekunden (ohne Angabe 2,6).
   * lee = Windschatten: [von, bis, lat0, lat1] – dort kommt die Böe nicht an.
   */
  winds?: { from: number; to: number; push: number; period: number; phase: number; gust?: number; lee?: [number, number, number, number][] }[];
  /**
   * Pontons: [from, to] schwimmt und hebt und senkt sich mit dem Seegang – amp Meter (ohne Angabe 0,7),
   * period und phase in Sekunden (ohne Angabe 3,4 und 0). Die Enden sind gelenkige Übergänge.
   */
  pontoons?: { from: number; to: number; amp?: number; period?: number; phase?: number }[];
  /**
   * Schienen (Achterbahn): von … bis sitzt das Kart auf einer der Schienen (lanes = seitliche Lage in Metern) und rollt
   * wie ein Achterbahnwagen (mechanics.ts, Rail). lifts = Kettenlifte, brakes = Bremsstrecken: je [von, bis, Tempo in m/s].
   */
  rails?: { from: number; to: number; lanes: number[]; lifts?: [number, number, number][]; brakes?: [number, number, number][] }[];
  /** Schubmagnete auf einer Schiene (lat = Lage dieser Schiene): ziehen im Takt an (mechanics.ts, PULSE_KICK). */
  kicks?: { at: number; lat: number; period: number; phase: number }[];
  /**
   * Flussstücke: von … bis ist die Fahrbahn Wasser; darauf treiben Flöße in Bahnen (mechanics.ts, RaftLane:
   * seitlich lat0 … lat1, Länge und Abstand in Metern, Tempo in m/s, Versatz in Metern).
   */
  rivers?: { from: number; to: number; lanes: { lat0: number; lat1: number; length: number; gap: number; speed: number; phase?: number }[] }[];
  /**
   * Portale: Rahmen bei at, seitlich lat0 … lat1; wer hindurchfährt, kommt bei to (Stützpunkt-Einheiten der
   * Hauptstrecke) heraus. Ohne opens immer offen; sonst offen von opens bis closes (Sekunden), mit every wiederholt.
   */
  portals?: { at: number; to: number; lat0: number; lat1: number; opens?: number; closes?: number; every?: number }[];
  /**
   * Bruchstellen: das Stück [from, to], seitlich lat0 … lat1 (Meter), bricht zur Rennzeit at (Sekunden)
   * weg und bleibt weg – oder, mit until, bis zu dieser Rennzeit. Mit every (Sekunden) wiederholt sich das.
   * Reicht ein Bruch über die Fahrbahnmitte, wird ein dort Gestürzter weiter vorn auf festem Boden aufgesetzt.
   * Auf Strecken mit Zeitaltern (TrackDef.eras) statt at: era – das Stück fehlt in diesem Zeitalter
   * (mit delay erst so viele Sekunden nach dessen Beginn).
   */
  cracks?: { from: number; to: number; lat0: number; lat1: number; at?: number; until?: number; every?: number; era?: 0 | 1; delay?: number }[];
  /**
   * Tore: sperren eine Abzweigung an ihrer Mündung (auf der Hauptstrecke: den Weg bei at) – von Rennbeginn
   * bis opens (Sekunden) und/oder ab closes (Sekunden). Mit every (Sekunden) wiederholt sich der Plan; dann
   * ist das Tor in [closes, opens) zu.
   */
  gates?: { at?: number; opens?: number; closes?: number; every?: number; noteOpen?: string; noteShut?: string; era?: 0 | 1; only?: 'small' | 'big' }[];
  /**
   * Größenringe (mechanics.ts, Sizer): Ring bei at, seitlich lat0 … lat1; grow = lässt wachsen, sonst schrumpfen.
   * Ein Tor mit only ('small' | 'big') lässt an seiner Abzweigung nur Karts dieser Größe durch.
   */
  sizers?: { at: number; lat0: number; lat1: number; grow?: boolean }[];
}

/** Eine Abzweigung: verlässt die Hauptstrecke bei from und mündet bei to wieder ein. */
export interface BranchDef extends PathFeatures {
  from: number;
  to: number;
  /** Eigene Stützpunkte [x, z, höhe] zwischen Gabelung und Einmündung (mit scale wie die Hauptstrecke). */
  points: number[][];
  roadHalf?: number;
  shoulder?: number;
}

export interface TrackDef extends PathFeatures {
  id: string;
  name: string;
  theme: ThemeId;
  /** Ein Satz für die Streckenwahl. */
  blurb: string;
  /** Schwierigkeit 1 (leicht) bis 3 (anspruchsvoll) – nur zur Anzeige. */
  grade: number;
  /** Stützpunkte der Mittellinie [x, z, höhe] in Metern, in Fahrtrichtung. */
  points: number[][];
  /** Faktor auf x und z aller Stützpunkte. */
  scale?: number;
  /** true = gleichmäßige Catmull-Rom-Kurve (alte Strecke), sonst zentripetal (ohne Überschwinger). */
  uniform?: boolean;
  /** Halbe Breite der Fahrbahn. */
  roadHalf: number;
  /** Breite des Seitenstreifens zwischen Fahrbahn und Bande. */
  shoulder: number;
  /** Startlinie liegt an diesem Stützpunkt. */
  startAt: number;
  laps: number;
  /** Kurvenüberhöhung: Querneigung = Krümmung × bank (0 = flach). */
  bank?: number;
  /** So tief unter der Fahrbahn gilt ein Kart als abgestürzt. */
  fallDepth?: number;
  pads: { at: number; lat: number; halfWidth?: number }[];
  boxRows: number[];
  /** Höchstens zwei, nicht verschachtelt; beide Wege zählen für die Platzierung gleich. */
  branches?: BranchDef[];
  /** Wo das Wahrzeichen der Welt steht (z. B. der Leuchtturm) – Stützpunkt-Einheiten der Hauptstrecke. */
  landmarkAt?: number;
  /** Verkehr auf der Hauptstrecke (siehe mechanics.ts). */
  traffic?: TrafficDef;
  /** Ein Satz dazu, was diese Strecke von den anderen unterscheidet – für die Streckenwahl. */
  twist?: string;
  /**
   * Zwei Zeitalter im Wechsel (mechanics.ts, Era): Periode und Dauer des ersten in Sekunden, Namen und Meldungen.
   * Bruchstellen und Tore mit era hängen daran.
   */
  eras?: { period: number; split: number; names: [string, string]; notes: [string, string] };
  /** Ebbe und Flut: Wasserhöhe bei Ebbe und Flut (Meter), Periode und Versatz in Sekunden. */
  tide?: { low: number; high: number; period: number; phase: number };
  /** Höhe des Meeresspiegels für Tauchstrecken (PathFeatures.dives); ohne Angabe 0. */
  sea?: number;
  /** Anteil der Schwerkraft auf dieser Strecke (Mond: etwa 0,38); ohne Angabe 1. */
  gravity?: number;
  /**
   * Dunkle Strecke (Gewitterkamm): Die Welt ist finster, Blitze erhellen sie für Augenblicke (mechanics.ts, stormLight).
   * flashes = fernes Wetterleuchten ohne Einschlag: Takt und Versatz in Sekunden, Helligkeit 0…1.
   */
  dark?: { flashes: { period: number; phase: number; power: number }[] };
}

export interface BoostPad {
  seg: number;
  length: number;
  lat: number;
  halfWidth: number;
}

/** Sprungplatte: wer darüberfährt, wird hochgeschleudert. */
export interface Launcher {
  seg: number;
  length: number;
  lat: number;
  halfWidth: number;
  /** Steiggeschwindigkeit in m/s. */
  power: number;
}

export interface Hazard {
  seg: number;
  amp: number;
  /** Periode in Ticks. */
  period: number;
  phase: number;
}

export const EDGE_OPEN_L = 1;
export const EDGE_OPEN_R = 2;
export const EDGE_GAP = 4;
export const EDGE_DECK = 8;
/** Auf einer Sprungschanze (nur für die Darstellung). */
export const EDGE_RAMP = 16;
/** In einem Tunnel bzw. einer Höhle (Darstellung, Kamera). */
export const EDGE_TUNNEL = 32;
/** Flugstrecke: Lücke, über der das Kart gleitet statt zu fallen. */
export const EDGE_GLIDE = 256;
/**
 * Schwimmendes Stück (Ponton samt Übergängen): die Höhe ändert sich mit der Zeit (heaveAt).
 * Die stehende Welt zeichnet hier keine Fahrbahn – das übernimmt die Darstellung der Pontons.
 */
export const EDGE_FLOAT = 512;
/**
 * Bruchzone: hier bricht im Lauf des Rennens Fahrbahn weg (Track.holes). Auch diese Abschnitte
 * zeichnet nicht die stehende Welt, sondern die Darstellung der Mechanik – Platte für Platte.
 */
export const EDGE_BROKEN = 1024;
/**
 * Fluss: hier ist die Fahrbahn Wasser, Boden gibt es nur auf den Flößen, die darauf treiben (Track.rivers).
 * Wasser und Flöße zeichnet die Darstellung der Mechanik; Banden gibt es keine.
 */
export const EDGE_RIVER = 2048;
/**
 * Schiene: Hier sitzt das Kart auf einer Schiene und rollt wie ein Achterbahnwagen (Track.rails; sim.ts).
 * Banden gibt es keine, die Schienen stehen frei auf ihrem Gerüst.
 */
export const EDGE_RAIL = 4096;
/**
 * An Gabelung und Einmündung liegen zwei Fahrbahnen nebeneinander: auf der
 * Seite zur anderen hin steht keine Bande, und der Boden geht einfach weiter.
 */
export const EDGE_FREE_L = 64;
export const EDGE_FREE_R = 128;

/** "Hier ist kein Boden" – das Kart fällt. */
export const NO_GROUND = -1e6;

export interface Branch {
  /** Erster Abschnitt und Anzahl der eigenen Abschnitte. */
  first: number;
  count: number;
  /** Abschnitt der Hauptstrecke an der Gabelung bzw. Einmündung. */
  from: number;
  to: number;
  /** Auf welcher Seite der Hauptstrecke sie abgeht: -1 links, 1 rechts. */
  side: number;
}

export interface Track {
  def: TrackDef;
  index: number;
  /** Anzahl Abschnitte der Hauptstrecke; Abschnitt 0 beginnt an der Startlinie. */
  n: number;
  /** Alle Abschnitte einschließlich der Abzweigungen (Länge der Felder unten). */
  total: number;
  /** Länge eines Abschnitts in Metern (knapp 1), waagerecht gemessen. */
  step: number;
  /** Länge einer Runde über die Hauptstrecke. */
  length: number;
  px: Float64Array;
  pz: Float64Array;
  /** Höhe der Fahrbahnmitte. */
  py: Float64Array;
  /** Höhe ohne Schanzen und Kuppen – dort liegt das Gelände darunter. */
  base: Float64Array;
  /** Fahrtrichtung (Einheitsvektor, waagerecht). */
  tx: Float64Array;
  tz: Float64Array;
  /** Krümmung in 1/m, positiv = Rechtskurve. */
  curv: Float64Array;
  /** Querneigung: Höhenänderung pro Meter nach rechts. */
  bank: Float64Array;
  /** Halbe Fahrbahnbreite je Abschnitt. */
  rh: Float64Array;
  /** Abstand der Bande (bzw. der Kante) von der Mittellinie je Abschnitt. */
  wh: Float64Array;
  /**
   * Auf der Seite ohne Bande (EDGE_FREE_*): so weit reicht der Platz dort –
   * mehr als wh, solange die Nachbarfahrbahn daneben liegt; am Ende der Zone
   * läuft der Wert auf wh zu.
   */
  free: Float64Array;
  /**
   * Wo zwei Fahrbahnen ineinander liegen: der Abschnitt des anderen Wegs
   * gleich nebenan (sonst −1). Damit lässt sich "ich bin hier, will aber dort
   * entlang" auflösen, solange beide Wege noch eins sind.
   */
  twin: Int32Array;
  /** EDGE_*-Bits je Abschnitt. */
  edge: Uint16Array;
  /** Untergrund je Abschnitt: Nummer in SURFACES (surface.ts). */
  surf: Uint8Array;
  /** Abschnitt, an dem ein hier abgestürztes Kart wieder aufgesetzt wird. */
  respawn: Int32Array;
  /** Nachfolger und Vorgänger in Fahrtrichtung. */
  next: Int32Array;
  prev: Int32Array;
  /** Hauptstrecke: erster Abschnitt der Abzweigung, die hier abgeht – sonst −1. */
  fork: Int32Array;
  /** −1 = Hauptstrecke, sonst Nummer der Abzweigung. */
  branchOf: Int8Array;
  branches: Branch[];
  /**
   * Fortschritt in Abschnitten der Hauptstrecke (0 … n). In einer Abzweigung
   * läuft er gleichmäßig von der Gabelung zur Einmündung – beide Wege zählen
   * für Runden und Platzierung gleich viel.
   */
  prog: Float64Array;
  /** Abschnitte in der Nähe jedes Abschnitts (für projectOnTrack): cand[candAt[i] … candAt[i+1]). */
  cand: Int32Array;
  candAt: Int32Array;
  fallDepth: number;
  /** Abschnitt der Hauptstrecke, neben dem das Wahrzeichen der Welt steht. */
  landmark: number;
  pads: BoostPad[];
  launchers: Launcher[];
  /** Anteil der Schwerkraft (1 = Erde). */
  gravity: number;
  /** Dunkle Strecke: es ist finster, Blitze erhellen sie (mechanics.ts, stormLight). */
  dark: boolean;
  /** Fernes Wetterleuchten einer dunklen Strecke. */
  flashes: Flash[];
  boxes: { x: number; y: number; z: number; seg: number }[];
  hazards: Hazard[];
  /** Streckenmechanik (mechanics.ts): Verkehr, Geysire und Lavabomben, steigende Lava. */
  vehicles: Vehicle[];
  pulses: Pulse[];
  floods: Flood[];
  belts: Belt[];
  /** Fliegen: Aufwinde und Schubringe über den Flugstrecken (Abschnitte mit EDGE_GLIDE). */
  thermals: Thermal[];
  rings: Ring[];
  /** Ebbe und Flut (null = keine) und je Abschnitt, ob sie dort gilt. */
  tide: Tide | null;
  tidal: Uint8Array;
  /** Tauchstrecken: 1 je Abschnitt, der unter Wasser liegt; sea = Höhe des Meeresspiegels. */
  deep: Uint8Array;
  sea: number;
  /** Böen (mechanics.ts). */
  winds: Wind[];
  /** Flussstücke mit ihren Floßbahnen (mechanics.ts). */
  rivers: River[];
  /** Schienenstücke (mechanics.ts). */
  rails: Rail[];
  /** Portale (mechanics.ts). */
  portals: Portal[];
  /** Fährt hier ein Fahrzeug mit befahrbarem Dach (mechanics.ts: VehicleSpec.roofs)? */
  roofed: boolean;
  /** Größenringe (mechanics.ts). */
  sizers: Sizer[];
  /** Je Abzweigung: 0 = für alle offen; −1 / +1 = nur für winzige bzw. riesige Karts (Größentor an der Mündung). */
  branchOnly: Int8Array;
  /**
   * Pontons und je Abschnitt, welche (höchstens zwei) seine Höhe bestimmen und mit welchem Gewicht:
   * Höhe über der Ruhelage = floatWA·Hub(floatA) + floatWB·Hub(floatB); −1 = keiner.
   */
  pontoons: Pontoon[];
  floatA: Int16Array;
  floatB: Int16Array;
  floatWA: Float32Array;
  floatWB: Float32Array;
  /** Bruchstellen und Tore (mechanics.ts). */
  holes: Hole[];
  gates: Gate[];
  /** Zeitalter der Strecke (mechanics.ts) – null: sie hat keine. */
  era: Era | null;
  laps: number;
}

export const PAD_LENGTH = 7;
export const PAD_HALF_WIDTH = 2;
const BOX_LATERALS = [-0.65, -0.22, 0.22, 0.65];
/** So weit vor einer Lücke wird ein abgestürztes Kart aufgesetzt – genug Anlauf für den Sprung. */
const RESPAWN_RUNUP = 26;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Zentripetale Catmull-Rom-Kurve: bleibt auch bei ungleichen Punktabständen ohne Schlenker. */
function centripetal(p0: number[], p1: number[], p2: number[], p3: number[], t: number, out: number[]): void {
  const k01 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) || 1e-3;
  const k12 = Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) || 1e-3;
  const k23 = Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) || 1e-3;
  const t0 = 0;
  const t1 = k01;
  const t2 = t1 + k12;
  const t3 = t2 + k23;
  const u = t1 + (t2 - t1) * t;
  for (let c = 0; c < 3; c++) {
    const a1 = ((t1 - u) / (t1 - t0)) * p0[c] + ((u - t0) / (t1 - t0)) * p1[c];
    const a2 = ((t2 - u) / (t2 - t1)) * p1[c] + ((u - t1) / (t2 - t1)) * p2[c];
    const a3 = ((t3 - u) / (t3 - t2)) * p2[c] + ((u - t2) / (t3 - t2)) * p3[c];
    const b1 = ((t2 - u) / (t2 - t0)) * a1 + ((u - t0) / (t2 - t0)) * a2;
    const b2 = ((t3 - u) / (t3 - t1)) * a2 + ((u - t1) / (t3 - t1)) * a3;
    out[c] = ((t2 - u) / (t2 - t1)) * b1 + ((u - t1) / (t2 - t1)) * b2;
  }
}

const SUB = 48;
/** So viele Abschnitte weit sucht projectOnTrack um den zuletzt bekannten herum. */
const SEARCH = 12;
/** So weit wird an Gabelung und Einmündung nach dem Nachbarweg geschaut (Abschnitte). */
const ZONE_SCAN = 110;
/** Abstand der Hilfspunkte, über die eine Abzweigung die Hauptstrecke verlässt und wieder erreicht (Meter). */
const GUIDE = 9;

interface Sampled {
  count: number;
  step: number;
  length: number;
  x: Float64Array;
  z: Float64Array;
  y: Float64Array;
  /** Stützpunkt-Einheiten → Meter ab Beginn. */
  meters(u: number): number;
}

/**
 * Tastet die Kurve durch ctrl in gleich langen Schritten ab.
 * Geschlossen: alle Punkte, beginnend bei startAt; Abschnitt 0 liegt auf dem Startpunkt.
 * Offen: von ctrl[1] bis ctrl[vorletzter]; der erste und letzte Punkt geben nur
 * die Richtung an den Enden vor. Die beiden Endpunkte selbst gehören nicht dazu
 * (dort liegt die Hauptstrecke).
 */
function sample(ctrl: number[][], closed: boolean, startAt: number, uniform: boolean, wantStep: number): Sampled {
  const m = ctrl.length;
  const spans = closed ? m : m - 3;
  const at = (i: number): number[] => ctrl[closed ? ((i % m) + m) % m : i];
  const fine: number[][] = [];
  const tmp = [0, 0, 0];
  for (let k = 0; k < spans; k++) {
    const i = closed ? startAt + k : k + 1;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      if (uniform) {
        fine.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t), catmull(p0[2], p1[2], p2[2], p3[2], t)]);
      } else {
        centripetal(p0, p1, p2, p3, t, tmp);
        fine.push([tmp[0], tmp[1], tmp[2]]);
      }
    }
  }
  if (!closed) fine.push([ctrl[m - 2][0], ctrl[m - 2][1], ctrl[m - 2][2]]);
  const pieces = closed ? fine.length : fine.length - 1;
  const cum = new Float64Array(pieces + 1);
  for (let i = 0; i < pieces; i++) {
    const a = fine[i];
    const b = fine[(i + 1) % fine.length];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const length = cum[pieces];
  const parts = Math.max(closed ? 8 : 2, Math.round(length / wantStep));
  const step = length / parts;
  const count = closed ? parts : parts - 1;
  const x = new Float64Array(count);
  const z = new Float64Array(count);
  const y = new Float64Array(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const d = (closed ? i : i + 1) * step;
    while (j < pieces - 1 && cum[j + 1] < d) j++;
    const a = fine[j];
    const b = fine[(j + 1) % fine.length];
    const f = (d - cum[j]) / (cum[j + 1] - cum[j]);
    x[i] = a[0] + (b[0] - a[0]) * f;
    z[i] = a[1] + (b[1] - a[1]) * f;
    y[i] = a[2] + (b[2] - a[2]) * f;
  }
  const meters = (u: number): number => {
    const k = closed ? (((u - startAt) % m) + m) % m : Math.max(0, Math.min(spans, u));
    const f = k * SUB;
    const i0 = Math.min(pieces - 1, Math.floor(f));
    return cum[i0] + (cum[i0 + 1] - cum[i0]) * (f - i0);
  };
  return { count, step, length, x, z, y, meters };
}

/** Ein Weg im Netz (Hauptstrecke oder Abzweigung) samt dem, was auf ihm liegt. */
interface PathCtx {
  /** Nummer des ersten Abschnitts und Anzahl. */
  off: number;
  count: number;
  closed: boolean;
  step: number;
  length: number;
  meters(u: number): number;
  f: PathFeatures;
  roadHalf: number;
  shoulder: number;
}

function smoothStep(x: number): number {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
}

export function buildTrack(def: TrackDef, index = 0): Track {
  const scale = def.scale ?? 1;
  const scaled = (p: number[]): number[] => [p[0] * scale, p[1] * scale, p[2] ?? 0];

  // 1. Hauptstrecke abtasten, beginnend an der Startlinie.
  const main = sample(def.points.map(scaled), true, def.startAt, def.uniform === true, 1);
  const n = main.count;
  const step = main.step;
  const length = main.length;
  const mainSeg = (u: number): number => Math.round(main.meters(u) / step) % n;

  // 2. Abzweigungen: von einem Punkt der Hauptstrecke zu einem späteren.
  const paths: PathCtx[] = [
    { off: 0, count: n, closed: true, step, length, meters: main.meters, f: def, roadHalf: def.roadHalf, shoulder: def.shoulder },
  ];
  const sampled: Sampled[] = [main];
  const branches: Branch[] = [];
  let total = n;
  for (const b of def.branches ?? []) {
    const from = mainSeg(b.from);
    const to = mainSeg(b.to);
    const P = (i: number): number[] => {
      const k = ((i % n) + n) % n;
      return [main.x[k], main.z[k], main.y[k]];
    };
    // Je ein Hilfspunkt auf der Hauptstrecke kurz hinter der Gabelung und kurz
    // vor der Einmündung: so löst sich die Abzweigung ohne Knick und kommt
    // ohne Knick zurück. (Die Punkte davor und dahinter geben nur die Richtung vor.)
    const own = b.points.length;
    const s = sample([P(from - GUIDE), P(from), P(from + GUIDE), ...b.points.map(scaled), P(to - GUIDE), P(to), P(to + GUIDE)], false, 0, false, step);
    // Stützpunkt-Einheiten der Beschreibung (0 = Gabelung, 1 = erster eigener
    // Punkt, own + 1 = Einmündung) → Einheiten der Kurve mit den Hilfspunkten.
    const inner = (u: number): number => (u <= 1 ? 2 * Math.max(0, u) : u <= own ? u + 1 : own + 1 + 2 * Math.min(1, u - own));
    paths.push({
      off: total,
      count: s.count,
      closed: false,
      step: s.step,
      length: s.length,
      meters: (u) => s.meters(inner(u)),
      f: b,
      roadHalf: b.roadHalf ?? def.roadHalf,
      shoulder: b.shoulder ?? def.shoulder,
    });
    sampled.push(s);
    branches.push({ first: total, count: s.count, from, to, side: 1 });
    total += s.count;
  }

  // 3. Felder für alle Abschnitte, Verweise auf Vorgänger und Nachfolger.
  const px = new Float64Array(total);
  const pz = new Float64Array(total);
  const py = new Float64Array(total);
  const next = new Int32Array(total);
  const prev = new Int32Array(total);
  const fork = new Int32Array(total).fill(-1);
  const branchOf = new Int8Array(total).fill(-1);
  const prog = new Float64Array(total);
  paths.forEach((p, k) => {
    px.set(sampled[k].x, p.off);
    pz.set(sampled[k].z, p.off);
    py.set(sampled[k].y, p.off);
  });
  for (let i = 0; i < n; i++) {
    next[i] = (i + 1) % n;
    prev[i] = (i - 1 + n) % n;
    prog[i] = i;
  }
  branches.forEach((b, k) => {
    const covered = (b.to - b.from + n) % n;
    for (let j = 0; j < b.count; j++) {
      const g = b.first + j;
      next[g] = j === b.count - 1 ? b.to : g + 1;
      prev[g] = j === 0 ? b.from : g - 1;
      branchOf[g] = k;
      prog[g] = (b.from + ((j + 1) * covered) / (b.count + 1)) % n;
    }
    fork[b.from] = b.first;
  });

  const tx = new Float64Array(total);
  const tz = new Float64Array(total);
  const curv = new Float64Array(total);
  for (let i = 0; i < total; i++) {
    const dx = px[next[i]] - px[prev[i]];
    const dz = pz[next[i]] - pz[prev[i]];
    const l = Math.hypot(dx, dz);
    tx[i] = dx / l;
    tz[i] = dz / l;
  }
  for (let i = 0; i < total; i++) {
    const a = prev[i];
    const b = next[i];
    // Drehung der Tangente pro Meter; Kreuzprodukt > 0 heißt Richtung +Winkel = links.
    const cross = tz[a] * tx[b] - tx[a] * tz[b];
    curv[i] = -Math.asin(Math.max(-1, Math.min(1, cross))) / (2 * step);
  }

  /** Abschnitt Nummer local auf einem Weg – oder −1, wenn es ihn dort nicht gibt. */
  const idx = (p: PathCtx, local: number): number =>
    p.closed ? p.off + (((local % p.count) + p.count) % p.count) : local < 0 || local >= p.count ? -1 : p.off + local;
  /** Offene Wege beginnen einen Schritt hinter der Gabelung. */
  const lead = (p: PathCtx): number => (p.closed ? 0 : 1);
  const segAt = (p: PathCtx, u: number): number => {
    const local = Math.round(p.meters(u) / p.step) - lead(p);
    return idx(p, p.closed ? local : Math.max(0, Math.min(p.count - 1, local)));
  };
  /** Ruft fn für alle Abschnitte von Meter a über len Meter auf (u = Anteil 0..1). */
  const span = (p: PathCtx, a: number, len: number, fn: (seg: number, u: number) => void): void => {
    const first = Math.ceil(a / p.step) - lead(p);
    const count = Math.max(1, Math.round(len / p.step));
    for (let k = 0; k < count; k++) {
      const g = idx(p, first + k);
      if (g >= 0) fn(g, (k + 0.5) / count);
    }
  };
  const spanU = (p: PathCtx, from: number, to: number, fn: (seg: number, u: number) => void): void => {
    const a = p.meters(from);
    let len = p.meters(to) - a;
    if (len <= 0) {
      if (!p.closed) return;
      len += p.length;
    }
    span(p, a, len, fn);
  };

  // 4. Breiten
  const rh = new Float64Array(total);
  const wh = new Float64Array(total);
  for (const p of paths) {
    for (let k = 0; k < p.count; k++) {
      rh[p.off + k] = p.roadHalf;
      wh[p.off + k] = p.roadHalf + p.shoulder;
    }
    for (const [from, to, road, shoulder] of p.f.widths ?? []) {
      const a = p.meters(from);
      let len = p.meters(to) - a;
      if (len <= 0) len += p.length;
      const blend = Math.min(10, len / 3);
      span(p, a, len, (seg, u) => {
        const d = Math.min(u, 1 - u) * len;
        const s = smoothStep(d / blend);
        rh[seg] = p.roadHalf + (road - p.roadHalf) * s;
        wh[seg] = p.roadHalf + p.shoulder + (road + shoulder - p.roadHalf - p.shoulder) * s;
      });
    }
  }

  // 5. Kurvenüberhöhung: aus der Krümmung, in Steilkurven fest vorgegeben, dann geglättet.
  const bank = new Float64Array(total);
  {
    const raw = new Float64Array(total);
    const bankK = def.bank ?? 0;
    for (let i = 0; i < total; i++) raw[i] = Math.max(-0.2, Math.min(0.2, -curv[i] * bankK));
    for (const p of paths) {
      for (const [from, to, value] of p.f.banks ?? []) {
        const a = p.meters(from);
        let len = p.meters(to) - a;
        if (len <= 0) len += p.length;
        const blend = Math.min(14, len / 3);
        span(p, a, len, (seg, u) => {
          const s = smoothStep((Math.min(u, 1 - u) * len) / blend);
          raw[seg] += (value - raw[seg]) * s;
        });
      }
    }
    const W = 7;
    for (let i = 0; i < total; i++) {
      let sum = raw[i];
      let a = i;
      let b = i;
      for (let k = 0; k < W; k++) {
        a = prev[a];
        b = next[b];
        sum += raw[a] + raw[b];
      }
      bank[i] = sum / (2 * W + 1);
    }
  }

  // 6. Gabelung und Einmündung: solange beide Fahrbahnen ineinander liegen,
  // steht zwischen ihnen keine Bande, und die Abzweigung liegt in der Ebene der
  // Hauptstrecke. Erst wo beide samt Seitenstreifen nebeneinander passen,
  // beginnen die Banden – als Keil, der von der Mitte her zusammenläuft.
  const edge = new Uint16Array(total);
  const free = Float64Array.from(wh);
  const twin = new Int32Array(total).fill(-1);
  const cross: [number, number][] = [];
  branches.forEach((b) => {
    for (const atFork of [true, false]) {
      const mainList: number[] = [];
      let i = atFork ? b.from : b.to;
      for (let k = 0; k < Math.min(ZONE_SCAN, n >> 1); k++) {
        mainList.push(i);
        i = atFork ? next[i] : prev[i];
      }
      const ownList: number[] = [];
      for (let k = 0; k < Math.min(ZONE_SCAN, b.count); k++) ownList.push(atFork ? b.first + k : b.first + b.count - 1 - k);
      /** Nächster Abschnitt aus list und der seitliche Versatz von g aus dessen Sicht. */
      const nearest = (g: number, list: number[]): { seg: number; lat: number } => {
        let best = list[0];
        let bestD = Infinity;
        for (const c of list) {
          const d = (px[g] - px[c]) ** 2 + (pz[g] - pz[c]) ** 2;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        return { seg: best, lat: (px[g] - px[best]) * -tz[best] + (pz[g] - pz[best]) * tx[best] };
      };
      const own: { g: number; m: number; lat: number; limit: number }[] = [];
      for (const g of ownList) {
        const r = nearest(g, mainList);
        const limit = wh[g] + wh[r.seg] + 0.6;
        if (Math.abs(r.lat) >= limit) break;
        own.push({ g, m: r.seg, lat: r.lat, limit });
      }
      if (own.length === 0) continue;
      const side = own[own.length - 1].lat >= 0 ? 1 : -1;
      if (atFork) b.side = side;
      let offH = 0;
      let offB = 0;
      for (const o of own) {
        const sep = Math.abs(o.lat);
        edge[o.g] |= side > 0 ? EDGE_FREE_L : EDGE_FREE_R;
        const w = smoothStep((sep - 0.25 * o.limit) / (0.75 * o.limit));
        // Eine schmalere (oder breitere) Abzweigung übernimmt an der Gabelung
        // die Breite der Hauptstrecke und findet erst im Auseinanderlaufen zu ihrer eigenen.
        rh[o.g] = rh[o.m] + (rh[o.g] - rh[o.m]) * w;
        wh[o.g] = wh[o.m] + (wh[o.g] - wh[o.m]) * w;
        // Platz zur Nachbarin hin: bis zu deren äußerer Bande – und gegen Ende
        // der Zone als Keil auf die eigene Bande zulaufend.
        free[o.g] = Math.min(sep + wh[o.m], wh[o.g] + (o.limit - sep) / 2);
        // Solange beide Fahrbahnen im Grundriss übereinander liegen, liegt die
        // Abzweigung genau in der Ebene der Hauptstrecke (Höhe und Neigung):
        // sonst stünde dort eine Stufe mitten in der Fahrbahn.
        const slope = (py[next[o.m]] - py[o.m]) / step;
        const plane = py[o.m] + o.lat * bank[o.m];
        const rr = tz[o.g] * tz[o.m] + tx[o.g] * tx[o.m];
        const rt = -tz[o.g] * tx[o.m] + tx[o.g] * tz[o.m];
        const planeBank = bank[o.m] * rr + slope * rt;
        offH = plane - py[o.g];
        offB = planeBank - bank[o.g];
        py[o.g] = plane;
        bank[o.g] = planeBank;
        cross.push([o.g, o.m]);
        twin[o.g] = o.m;
      }
      // Erst hinter der Zone findet sie zu ihrer eigenen Höhe – je größer der
      // Unterschied, desto länger die Rampe.
      const ease = Math.round(Math.max(16, Math.min(56, 14 + 14 * Math.abs(offH))));
      const lastOwn = own[own.length - 1].g;
      for (let k = 1; k <= ease; k++) {
        const g = atFork ? lastOwn + k : lastOwn - k;
        if (g < b.first + (b.count >> 1) === !atFork || g < b.first || g >= b.first + b.count) break;
        const f = 1 - smoothStep(k / (ease + 1));
        py[g] += offH * f;
        bank[g] += offB * f;
      }
      const ownZone = own.map((o) => o.g);
      for (const m of mainList) {
        // Abstand zur Abzweigung, senkrecht zu ihr gemessen (also zum nächsten
        // ihrer Abschnitte). Seitlich aus Sicht der Hauptstrecke zu messen
        // führt in die Irre, sobald die Abzweigung schräg wegläuft: der nächste
        // Abschnitt liegt dann längs versetzt, und die Bande der Hauptstrecke
        // stünde quer vor der Abzweigung.
        let twinSeg = ownZone[0];
        let bestD = Infinity;
        for (const g of ownZone) {
          const d = (px[m] - px[g]) ** 2 + (pz[m] - pz[g]) ** 2;
          if (d < bestD) {
            bestD = d;
            twinSeg = g;
          }
        }
        const sep = Math.sqrt(bestD);
        const limit = wh[m] + wh[twinSeg] + 0.6;
        if (sep >= limit) continue;
        edge[m] |= side > 0 ? EDGE_FREE_R : EDGE_FREE_L;
        free[m] = Math.min(sep + wh[twinSeg], wh[m] + (limit - sep) / 2);
        cross.push([m, twinSeg]);
        twin[m] = twinSeg;
      }
    }
  });

  // 7. Kanten, Brücken, Tunnel
  for (const p of paths) {
    for (const [from, to, side] of p.f.open ?? []) {
      spanU(p, from, to, (seg) => {
        if (side <= 0) edge[seg] |= EDGE_OPEN_L;
        if (side >= 0) edge[seg] |= EDGE_OPEN_R;
      });
    }
    for (const [from, to] of p.f.decks ?? []) spanU(p, from, to, (seg) => (edge[seg] |= EDGE_DECK));
    for (const [from, to] of p.f.tunnels ?? []) spanU(p, from, to, (seg) => (edge[seg] |= EDGE_TUNNEL));
  }

  // Untergrund
  const surf = new Uint8Array(total);
  for (const p of paths) {
    const base = SURFACE_INDEX[p.f.surface ?? def.surface ?? 'asphalt'] ?? 0;
    for (let k = 0; k < p.count; k++) surf[p.off + k] = base;
    for (const [from, to, kind] of p.f.surfaces ?? []) spanU(p, from, to, (seg) => (surf[seg] = SURFACE_INDEX[kind] ?? base));
  }

  // 8. Schanzen, Lücken, Kuppen
  const base = Float64Array.from(py);
  const respawn = new Int32Array(total);
  for (let i = 0; i < total; i++) respawn[i] = i;
  for (const p of paths) {
    for (const r of p.f.ramps ?? []) {
      const a = p.meters(r.at);
      const first = Math.ceil(a / p.step) - lead(p);
      const count = Math.max(1, Math.round(r.length / p.step));
      for (let k = 0; k < count; k++) {
        const g = idx(p, first + k);
        if (g < 0) continue;
        const u = (k + 1) / count;
        py[g] += r.height * u * u;
        edge[g] |= EDGE_RAMP;
      }
      if (!r.gap) continue;
      // Lücke direkt hinter der Kante. Davor und dahinter gibt es ein Stück keine
      // Bande, und wer dort seitlich herunterfällt, bekommt denselben Anlauf.
      const gapFirst = first + count;
      const gapCount = Math.max(1, Math.round(r.gap / p.step));
      const backLocal = Math.round((a - RESPAWN_RUNUP) / p.step) - lead(p);
      const back = idx(p, p.closed ? backLocal : Math.max(0, backLocal));
      for (let k = -2; k < gapCount + 6; k++) {
        const g = idx(p, gapFirst + k);
        if (g < 0) continue;
        edge[g] |= EDGE_OPEN_L | EDGE_OPEN_R | EDGE_DECK;
        if (k >= 0 && k < gapCount) edge[g] |= EDGE_GAP;
        if (k < gapCount) respawn[g] = back;
      }
    }
    // Flugstrecken: lange Lücken, über denen geglitten wird. Wer abstürzt, startet wieder vor der Kante.
    for (const [from, to] of p.f.glides ?? []) {
      const a = p.meters(from);
      const backLocal = Math.round((a - RESPAWN_RUNUP) / p.step) - lead(p);
      const back = idx(p, p.closed ? backLocal : Math.max(0, backLocal));
      spanU(p, from, to, (seg) => {
        edge[seg] |= EDGE_GAP | EDGE_GLIDE | EDGE_OPEN_L | EDGE_OPEN_R | EDGE_DECK;
        respawn[seg] = back;
      });
      // Kurz vor der Kante und hinter der Landung keine Bande. Wer vor der Kante seitlich fällt, bekommt den
      // Anlauf; wer hinter der Landung fällt, wird an der Landung wieder aufgesetzt – den Flug hat er geschafft.
      const first = segAt(p, from);
      const last = segAt(p, to);
      for (const g of [prev[first], prev[prev[first]], next[last], next[next[last]]]) {
        edge[g] |= EDGE_OPEN_L | EDGE_OPEN_R | EDGE_DECK;
      }
      respawn[prev[first]] = back;
      respawn[prev[prev[first]]] = back;
    }
    for (const b of p.f.bumps ?? []) {
      span(p, p.meters(b.at), b.length, (seg, u) => {
        const s = Math.sin(Math.PI * u);
        py[seg] += b.height * s * s;
      });
    }
  }
  // Wo zwei Fahrbahnen ineinander liegen, kann man nicht seitlich herunterfallen.
  for (let i = 0; i < total; i++) {
    if (edge[i] & EDGE_FREE_L) edge[i] &= ~EDGE_OPEN_L;
    if (edge[i] & EDGE_FREE_R) edge[i] &= ~EDGE_OPEN_R;
  }

  // 9. Nachbarschaft für die Zuordnung von Punkten: alles, was längs der
  // Fahrt höchstens SEARCH Abschnitte entfernt ist – an Gabelungen in beide
  // Wege hinein, und wo zwei Fahrbahnen ineinander liegen, auch quer hinüber.
  const adj: number[][] = [];
  for (let i = 0; i < total; i++) adj.push([]);
  const link = (a: number, b: number): void => {
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  };
  for (let i = 0; i < total; i++) {
    link(i, next[i]);
    link(i, prev[i]);
  }
  for (const [a, b] of cross) link(a, b);
  const candAt = new Int32Array(total + 1);
  const candList: number[] = [];
  const seen = new Int32Array(total).fill(-1);
  for (let i = 0; i < total; i++) {
    let frontier = [i];
    seen[i] = i;
    candList.push(i);
    for (let depth = 0; depth < SEARCH; depth++) {
      const nextFrontier: number[] = [];
      for (const a of frontier) {
        for (const b of adj[a]) {
          if (seen[b] === i) continue;
          seen[b] = i;
          candList.push(b);
          nextFrontier.push(b);
        }
      }
      frontier = nextFrontier;
    }
    candAt[i + 1] = candList.length;
  }

  const track: Track = {
    def,
    index,
    n,
    total,
    step,
    length,
    px,
    pz,
    py,
    base,
    tx,
    tz,
    curv,
    bank,
    rh,
    wh,
    free,
    twin,
    edge,
    surf,
    respawn,
    next,
    prev,
    fork,
    branchOf,
    branches,
    prog,
    cand: Int32Array.from(candList),
    candAt,
    fallDepth: def.fallDepth ?? 5,
    landmark: def.landmarkAt !== undefined ? mainSeg(def.landmarkAt) : Math.round(n * 0.845) % n,
    pads: [],
    launchers: [],
    gravity: def.gravity ?? 1,
    dark: def.dark !== undefined,
    flashes: (def.dark?.flashes ?? []).map((f) => ({ period: Math.round(f.period * 60), phase: Math.round(f.phase * 60), power: f.power })),
    boxes: [],
    hazards: [],
    vehicles: [],
    pulses: [],
    floods: [],
    belts: [],
    thermals: [],
    rings: [],
    tide: def.tide
      ? {
          low: def.tide.low,
          high: def.tide.high,
          period: Math.round(def.tide.period * 60),
          phase: Math.round(def.tide.phase * 60),
          wave: TIDE_WAVE,
          wavePeriod: TIDE_WAVE_PERIOD,
        }
      : null,
    tidal: new Uint8Array(total),
    deep: new Uint8Array(total),
    sea: def.sea ?? 0,
    winds: [],
    rivers: [],
    rails: [],
    portals: [],
    roofed: false,
    sizers: [],
    branchOnly: new Int8Array(def.branches?.length ?? 0),
    pontoons: [],
    floatA: new Int16Array(total).fill(-1),
    floatB: new Int16Array(total).fill(-1),
    floatWA: new Float32Array(total),
    floatWB: new Float32Array(total),
    holes: [],
    gates: [],
    era: def.eras ? { period: Math.round(def.eras.period * 60), split: Math.round(def.eras.split * 60), names: def.eras.names, notes: def.eras.notes } : null,
    laps: def.laps,
  };
  for (const p of paths) {
    for (const pad of p.f.pads ?? []) {
      const seg = segAt(p, pad.at);
      const half = pad.halfWidth === 0 ? rh[seg] - 0.4 : (pad.halfWidth ?? PAD_HALF_WIDTH);
      track.pads.push({ seg, length: Math.round(PAD_LENGTH / step), lat: pad.lat, halfWidth: half });
    }
    for (const l of p.f.launchers ?? []) {
      const seg = segAt(p, l.at);
      const half = l.halfWidth === 0 || l.halfWidth === undefined ? rh[seg] - 0.4 : l.halfWidth;
      track.launchers.push({ seg, length: Math.round(5 / step), lat: l.lat ?? 0, halfWidth: half, power: l.power ?? LAUNCH_SPEED });
    }
    for (const at of p.f.boxRows ?? []) {
      const seg = segAt(p, at);
      for (const f of p.f.boxLat ?? BOX_LATERALS) {
        const lat = f * rh[seg];
        track.boxes.push({
          x: px[seg] + rightX(track, seg) * lat,
          y: py[seg] + lat * bank[seg],
          z: pz[seg] + rightZ(track, seg) * lat,
          seg,
        });
      }
    }
    for (const h of p.f.hazards ?? []) {
      track.hazards.push({ seg: segAt(p, h.at), amp: h.amp, period: Math.round(h.period * 60), phase: h.phase });
    }
    const pulse = (kind: number, d: { at: number; lat: number; period: number; phase: number }): void => {
      const seg = segAt(p, d.at);
      const k = PULSE_KINDS[kind];
      track.pulses.push({
        kind,
        seg,
        lat: d.lat,
        x: px[seg] + rightX(track, seg) * d.lat,
        y: py[seg] + d.lat * bank[seg],
        z: pz[seg] + rightZ(track, seg) * d.lat,
        radius: k.radius,
        period: Math.round(d.period * 60),
        phase: Math.round(d.phase * 60),
        on: k.on,
        warn: k.warn,
      });
    };
    for (const v of p.f.vents ?? []) pulse(PULSE_VENT, v);
    for (const b of p.f.bombs ?? []) pulse(PULSE_BOMB, b);
    for (const b of p.f.presses ?? []) pulse(PULSE_PRESS, b);
    for (const b of p.f.bubbles ?? []) pulse(PULSE_BUBBLE, b);
    for (const b of p.f.avalanches ?? []) pulse(PULSE_AVALANCHE, b);
    for (const b of p.f.icicles ?? []) pulse(PULSE_ICICLE, b);
    for (const b of p.f.meteors ?? []) pulse(PULSE_METEOR, b);
    for (const b of p.f.bolts ?? []) pulse(PULSE_BOLT, b);
    for (const b of p.f.rods ?? []) pulse(PULSE_ROD, b);
    for (const b of p.f.kicks ?? []) pulse(PULSE_KICK, b);
    for (const b of p.f.belts ?? []) {
      const first = segAt(p, b.from);
      const last = segAt(p, b.to);
      track.belts.push({ first, count: Math.max(1, last - first + 1), lat0: Math.min(b.lat0, b.lat1), lat1: Math.max(b.lat0, b.lat1), along: b.along ?? 0, across: b.across ?? 0, swim: false });
    }
    for (const b of p.f.currents ?? []) {
      const first = segAt(p, b.from);
      const last = segAt(p, b.to);
      track.belts.push({ first, count: Math.max(1, last - first + 1), lat0: Math.min(b.lat0, b.lat1), lat1: Math.max(b.lat0, b.lat1), along: b.along ?? 0, across: b.across ?? 0, swim: true });
    }
    for (const w of p.f.winds ?? []) {
      const first = segAt(p, w.from);
      const last = segAt(p, w.to);
      const period = Math.round(w.period * 60);
      track.winds.push({
        first,
        count: Math.max(1, last - first + 1),
        push: w.push,
        period,
        phase: Math.round(w.phase * 60),
        on: Math.min(period - 30, Math.round((w.gust ?? 2.6) * 60)),
        warn: Math.min(90, Math.max(30, period - Math.round((w.gust ?? 2.6) * 60))),
        lee: (w.lee ?? []).map(([a, b, l0, l1]) => ({ first: segAt(p, a), last: segAt(p, b), lat0: Math.min(l0, l1), lat1: Math.max(l0, l1) })),
      });
    }
    for (const po of p.f.pontoons ?? []) {
      const first = segAt(p, po.from);
      const last = segAt(p, po.to);
      const count = Math.max(1, last - first + 1);
      const id = track.pontoons.length;
      track.pontoons.push({ first, count, amp: po.amp ?? 0.7, period: Math.round((po.period ?? 3.4) * 60), phase: Math.round((po.phase ?? 0) * 60) });
      // Gewicht je Abschnitt: 1 auf dem Ponton, über den Übergang (halb auf ihm, halb davor) auf 0 fallend.
      // Liegt der nächste Ponton direkt dahinter, ergänzen sich beide Gewichte im Übergang zu 1.
      const half = Math.max(1, Math.round(PONTOON_LINK / 2 / step));
      let seg = first;
      for (let k = 0; k < half; k++) seg = prev[seg];
      for (let k = -half; k < count + half; k++, seg = next[seg]) {
        // Abstand der Abschnittsmitte zum nächsten Ende des Pontons, nach außen negativ
        const inside = Math.min(k + 0.5, count - k - 0.5);
        const w = Math.max(0, Math.min(1, inside / (2 * half) + 0.5));
        if (w <= 0) continue;
        edge[seg] |= EDGE_FLOAT;
        if (track.floatA[seg] < 0) {
          track.floatA[seg] = id;
          track.floatWA[seg] = w;
        } else if (track.floatB[seg] < 0) {
          track.floatB[seg] = id;
          track.floatWB[seg] = w;
        }
      }
    }
    for (const z of p.f.sizers ?? []) track.sizers.push({ seg: segAt(p, z.at), lat0: Math.min(z.lat0, z.lat1), lat1: Math.max(z.lat0, z.lat1), grow: z.grow === true });
    for (const q of p.f.portals ?? []) {
      // Ein Portal führt von diesem Weg auf die Hauptstrecke (to in deren Stützpunkt-Einheiten).
      const seg = segAt(p, q.at);
      const to = mainSeg(q.to);
      const period = Math.round((q.every ?? 0) * 60);
      const plan: Plan | null = q.opens === undefined ? null : { period, spans: [Math.round(q.opens * 60), q.closes === undefined ? (period > 0 ? period : Infinity) : Math.round(q.closes * 60)] };
      // vorwärts oder zurück? (der kürzere Weg um die Runde entscheidet; auf einer Abzweigung gilt es als vorwärts)
      const ahead = p.closed ? (((to - seg) % n) + n) % n : 0;
      track.portals.push({ seg, lat0: Math.min(q.lat0, q.lat1), lat1: Math.max(q.lat0, q.lat1), to, plan, kind: ahead <= n / 2 ? 0 : 1 });
    }
    for (const r of p.f.rails ?? []) {
      const first = segAt(p, r.from);
      const last = segAt(p, r.to);
      const count = Math.max(1, last - first + 1);
      const spans = (list: [number, number, number][] | undefined): [number, number, number][] => (list ?? []).map(([a, b, v]) => [segAt(p, a), segAt(p, b), v]);
      track.rails.push({ first, count, lanes: [...r.lanes].sort((a, b) => a - b), lifts: spans(r.lifts), brakes: spans(r.brakes) });
      // Schienen haben keine Bande und stehen frei auf ihrem Gerüst.
      for (let k = 0; k < count; k++) edge[first + k] |= EDGE_RAIL | EDGE_OPEN_L | EDGE_OPEN_R | EDGE_DECK;
    }
    for (const r of p.f.rivers ?? []) {
      const first = segAt(p, r.from);
      const last = segAt(p, r.to);
      const count = Math.max(1, last - first + 1);
      track.rivers.push({
        first,
        count,
        lanes: r.lanes.map((l) => ({ lat0: Math.min(l.lat0, l.lat1), lat1: Math.max(l.lat0, l.lat1), length: l.length, gap: l.gap, speed: l.speed, phase: l.phase ?? 0 })),
      });
      // Wasser hat keine Bande und steht frei über dem Flussbett; wer hineinfällt, wird vor dem Fluss aufgesetzt.
      let back = first;
      for (let k = 0; k < 6; k++) back = prev[back];
      for (let k = 0; k < count; k++) {
        edge[first + k] |= EDGE_RIVER | EDGE_OPEN_L | EDGE_OPEN_R | EDGE_DECK;
        respawn[first + k] = respawn[back];
      }
    }
    for (const c of p.f.cracks ?? []) {
      const first = segAt(p, c.from);
      const last = segAt(p, c.to);
      const count = Math.max(1, last - first + 1);
      const lat0 = Math.min(c.lat0, c.lat1);
      const lat1 = Math.max(c.lat0, c.lat1);
      let plan: Plan = { period: Math.round((c.every ?? 0) * 60), spans: [Math.round((c.at ?? 0) * 60), c.until === undefined ? Infinity : Math.round(c.until * 60)] };
      if (c.era !== undefined && track.era) {
        const e = track.era;
        const delay = Math.round((c.delay ?? 0) * 60);
        plan = { period: e.period, spans: c.era === 0 ? [delay, e.split] : [e.split + delay, e.period] };
      }
      track.holes.push({ first, count, lat0, lat1, plan, warn: HOLE_WARN });
      for (let k = 0; k < count; k++) edge[first + k] |= EDGE_BROKEN;
      // Bricht auch die Mitte weg, kann dort niemand aufgesetzt werden: zurück bis vor die Bruchstelle
      // (über den Anfang einer Abzweigung hinaus auf die Hauptstrecke vor der Gabelung).
      if (lat0 < 1.6 && lat1 > -1.6) {
        let back = first;
        for (let k = 0; k < 8; k++) back = prev[back];
        for (let k = 0; k < count; k++) respawn[first + k] = respawn[back];
      }
    }
    for (const g of p.f.gates ?? []) {
      // Auf einer Abzweigung steht das Tor an ihrer Mündung: es sperrt alles vom ersten Abschnitt bis kurz
      // hinter die Stelle, an der sie sich von der Hauptstrecke gelöst hat. Ist es zu, läuft die Bande der
      // Hauptstrecke dort einfach durch (sim.ts) – niemand fährt erst hinein und steht dann vor einer Wand.
      let first = segAt(p, g.at ?? 0);
      let count = 3;
      if (!p.closed) {
        first = p.off;
        count = 0;
        while (count < p.count - 6 && twin[first + count] >= 0) count++;
        count += 5;
      }
      let period = Math.round((g.every ?? 0) * 60);
      const spans: number[] = [];
      if (g.era !== undefined && track.era) {
        period = track.era.period;
        if (g.era === 0) spans.push(0, track.era.split);
        else spans.push(track.era.split, track.era.period);
      } else if (period > 0) spans.push(Math.round((g.closes ?? 0) * 60), Math.round((g.opens ?? 0) * 60));
      else {
        if (g.opens !== undefined) spans.push(-1e9, Math.round(g.opens * 60));
        if (g.closes !== undefined) spans.push(Math.round(g.closes * 60), Infinity);
      }
      // Ein Größentor hat keinen Zeitplan: Ob es offen ist, hängt am Kart (gateShut).
      const only = g.only === 'small' ? -1 : g.only === 'big' ? 1 : 0;
      if (only !== 0) {
        period = 0;
        spans.length = 0;
      }
      track.gates.push({ first, count, plan: { period, spans }, warn: GATE_WARN, noteOpen: g.noteOpen ?? '', noteShut: g.noteShut ?? '', only });
      if (only !== 0 && !p.closed && branchOf[first] >= 0) track.branchOnly[branchOf[first]] = only;
    }
    for (const [from, to] of p.f.dives ?? []) spanU(p, from, to, (seg) => (track.deep[seg] = 1));
    for (const [from, to] of p.f.tidal ?? []) spanU(p, from, to, (seg) => (track.tidal[seg] = 1));
    for (const th of p.f.thermals ?? []) {
      const seg = segAt(p, th.at);
      track.thermals.push({
        seg,
        lat: th.lat,
        x: px[seg] + rightX(track, seg) * th.lat,
        z: pz[seg] + rightZ(track, seg) * th.lat,
        y: py[seg],
        radius: th.radius ?? 6,
        lift: th.lift ?? 7,
      });
    }
    for (const r of p.f.rings ?? []) {
      const seg = segAt(p, r.at);
      track.rings.push({
        seg,
        lat: r.lat,
        x: px[seg] + rightX(track, seg) * r.lat,
        y: py[seg] + (r.up ?? 0),
        z: pz[seg] + rightZ(track, seg) * r.lat,
        radius: RING_RADIUS,
      });
    }
    for (const f of p.f.floods ?? []) {
      const first = segAt(p, f.from);
      const last = segAt(p, f.to);
      const branch = branchOf[first];
      // Fahrzeit von der Gabelung (bzw. vom Punkt 64 m davor, an dem die KI entscheidet) bis zur Flut
      const run = branch >= 0 ? first - branches[branch].first : 0;
      track.floods.push({
        first,
        count: Math.max(1, last - first + 1),
        branch,
        period: Math.round(f.period * 60),
        phase: Math.round(f.phase * 60),
        rise: FLOOD_RISE,
        hold: Math.round(f.period * 60 * FLOOD_HOLD),
        fall: FLOOD_FALL,
        lead: Math.round(((run * step) / 25) * 60),
      });
    }
  }
  // Verkehr: nur auf der Hauptstrecke
  let vid = 0;
  for (const lane of def.traffic?.lanes ?? []) {
    for (const [kind, at] of lane.cars) {
      track.vehicles.push({ ...VEHICLE_SPECS[kind], id: vid++, kind, lat: lane.lat, speed: lane.speed, offset: at });
      if (VEHICLE_SPECS[kind].roofs) track.roofed = true;
    }
  }
  return track;
}

/**
 * Je Art (PULSE_*): Radius, Dauer der Gefahr und der Vorwarnung in Ticks.
 * Geysir: Ausbruch. Lavabombe: Einschlag samt Glutpfütze, davor wächst ihr
 * Schatten. Stampfpresse: der Stempel ist unten, davor blinkt die Warnleuchte.
 */
const PULSE_KINDS = [
  { radius: 2.1, on: 66, warn: 78 },
  { radius: 2.6, on: 150, warn: 110 },
  { radius: 2.0, on: 34, warn: 60 },
  // Blasenschlot: lange aktiv, kurze Pause
  { radius: 2.8, on: 150, warn: 40 },
  // Lawine: Streifen von 9 m vor bis 9 m hinter der Stelle, gut zwei Sekunden lang; lange Vorwarnung
  { radius: 9, on: 140, warn: 150 },
  // Eiszapfen: schlägt ein und lässt kurz Splitter liegen
  { radius: 1.7, on: 80, warn: 85 },
  // Meteorit: großer Einschlag, der Krater glüht nach; lange Vorwarnung (Schatten wächst)
  { radius: 2.8, on: 110, warn: 130 },
  // Blitz: schlägt kurz und hart ein; die Stelle knistert anderthalb Sekunden vorher
  { radius: 3.0, on: 34, warn: 90 },
  // Blitzableiter: das Ladefeld (6 m vor bis 6 m hinter dem Mast) steht knapp eine Sekunde
  { radius: 6, on: 54, warn: 90 },
  // Schubmagnet: 3 m vor bis 3 m hinter der Stelle; zieht gut eine Sekunde, eine Dreiviertelsekunde vorher läuft das Licht an
  { radius: 3, on: 75, warn: 45 },
];
/** Innenradius eines Schubrings (Meter). */
const RING_RADIUS = 3.4;
/** Welle auf dem Wasser bei Ebbe und Flut: Ausschlag (Meter) und Periode (Ticks). */
const TIDE_WAVE = 0.1;
const TIDE_WAVE_PERIOD = 250;
/** Steigende Lava: Steigen und Fallen in Ticks, Stehen als Anteil der Periode. */
const FLOOD_RISE = 150;
const FLOOD_FALL = 150;
const FLOOD_HOLD = 0.3;

/** Wo ein Wagen eines Fahrzeugs gerade steht. */
export interface VehiclePose {
  x: number;
  y: number;
  z: number;
  /** Fahrtrichtung (Radiant, wie KartState.heading). */
  heading: number;
  /** Steigung der Fahrbahn (Höhe pro Meter voraus) und Querneigung (Höhe pro Meter nach rechts). */
  slope: number;
  bank: number;
  seg: number;
  /** Seitliche Lage der Wagenmitte (Meter, rechts positiv). */
  lat: number;
}

export function newVehiclePose(): VehiclePose {
  return { x: 0, y: 0, z: 0, heading: 0, slope: 0, bank: 0, seg: 0, lat: 0 };
}

/**
 * Lage des Wagens car (0 = vorderster) von Fahrzeug v zur Rennzeit time
 * (Ticks seit "Los", auch gebrochen oder negativ).
 */
export function vehiclePose(t: Track, v: Vehicle, car: number, time: number, out: VehiclePose): VehiclePose {
  const lap = t.n * t.step;
  let s = vehicleAt(v, time, lap);
  if (car > 0 && v.roofs) {
    // Ein langer Zug reicht durch mehrere Kurven: Jeder Wagen folgt dem vor ihm im Abstand der Kupplung, gemessen
    // auf der eigenen Spur an der Stelle, an der er gerade ist – sonst klafften die Kupplungen in einer S-Kurve
    // meterweit auf (und wer über die Dächer fährt, fiele hinein).
    for (let c = 0; c < car; c++) {
      const at = Math.min(t.n - 1, Math.floor(s / t.step));
      const scale = Math.max(0.6, Math.min(1.6, 1 - ((v.lat * t.rh[at]) / t.def.roadHalf) * t.curv[at]));
      s -= v.pitch / scale;
      if (s < 0) s += lap;
    }
  } else if (car > 0) {
    // Hintere Wagen folgen im Abstand der Kupplung – gemessen auf der eigenen Spur, nicht auf der
    // Mittellinie: außen in der Kurve ist der Weg länger, innen kürzer (curv > 0 = Rechtskurve).
    const lead = Math.min(t.n - 1, Math.floor(s / t.step));
    const scale = Math.max(0.6, Math.min(1.6, 1 - ((v.lat * t.rh[lead]) / t.def.roadHalf) * t.curv[lead]));
    s -= (car * v.pitch) / scale;
    if (s < 0) s += lap;
  }
  const i = Math.min(t.n - 1, Math.floor(s / t.step));
  const along = s - i * t.step;
  const f = along / t.step;
  const j = (i + 1) % t.n;
  // Richtung zwischen den Abschnitten überblenden – sonst ruckt ein langer Bus in der Kurve.
  const hx = t.tx[i] + (t.tx[j] - t.tx[i]) * f;
  const hz = t.tz[i] + (t.tz[j] - t.tz[i]) * f;
  const lat = (v.lat * (t.rh[i] + (t.rh[j] - t.rh[i]) * f)) / t.def.roadHalf;
  const bank = t.bank[i] + (t.bank[j] - t.bank[i]) * f;
  const k = 1 / Math.hypot(hx, hz);
  out.x = t.px[i] + t.tx[i] * along - hz * k * lat;
  out.z = t.pz[i] + t.tz[i] * along + hx * k * lat;
  out.y = t.py[i] + (t.py[j] - t.py[i]) * f + lat * bank;
  out.heading = Math.atan2(hx, hz);
  out.slope = (t.py[j] - t.py[i]) / t.step;
  out.bank = bank;
  out.seg = i;
  out.lat = lat;
  return out;
}

/** Vektor nach rechts (quer zur Fahrtrichtung) im Abschnitt seg. */
export function rightX(t: Track, seg: number): number {
  return -t.tz[seg];
}
export function rightZ(t: Track, seg: number): number {
  return t.tx[seg];
}

/** Blickrichtung (Radiant) entlang der Strecke im Abschnitt seg. */
export function trackHeading(t: Track, seg: number): number {
  return Math.atan2(t.tx[seg], t.tz[seg]);
}

/** Nummer auf der Hauptstrecke in den Bereich 0 … n−1 bringen. */
export function wrapSeg(t: Track, seg: number): number {
  const n = t.n;
  return ((seg % n) + n) % n;
}

/**
 * Wie viele Abschnitte liegt to in Fahrtrichtung vor from (negativ: dahinter)?
 * Gemessen am Fortschritt, im Bereich −n/2 … n/2. Innerhalb derselben
 * Abzweigung ist es einfach die Differenz der Nummern.
 */
export function segDelta(t: Track, from: number, to: number): number {
  const b = t.branchOf[from];
  if (b >= 0 && b === t.branchOf[to]) return to - from;
  let d = t.prog[to] - t.prog[from];
  const half = t.n / 2;
  if (d > half) d -= t.n;
  else if (d < -half) d += t.n;
  return d;
}

/**
 * Rennfortschritt von from nach to, überall im Maß der Hauptstrecke (−n/2 … n/2).
 *
 * segDelta zählt innerhalb einer Abzweigung deren eigene Abschnitte – richtig für
 * Abstände auf der Fahrbahn, aber falsch zum Aufsummieren: eine Abzweigung hat
 * selten genau so viele Abschnitte wie das Stück Hauptstrecke, das sie ersetzt.
 * Wer Runden zählt oder Plätze vergleicht, summiert deshalb diese Differenz.
 */
export function progDelta(t: Track, from: number, to: number): number {
  let d = t.prog[to] - t.prog[from];
  const half = t.n / 2;
  if (d > half) d -= t.n;
  else if (d < -half) d += t.n;
  return d;
}

/**
 * Aufsummierten Rennfortschritt um den Schritt von from nach to fortschreiben.
 *
 * Bis auf ganze Runden ist der Fortschritt immer der Fortschrittswert des Abschnitts.
 * Darauf wird die Summe nach jedem Schritt gezogen: Auf Abzweigungen sind die Werte
 * gebrochen, und ein aufsummierter Rundungsrest ließe die Summe an der Ziellinie um
 * ein Haar unter der vollen Runde liegen – das Ziel käme einen Abschnitt zu spät.
 */
export function addProgress(t: Track, progress: number, from: number, to: number): number {
  const p = progress + progDelta(t, from, to);
  return Math.round((p - t.prog[to]) / t.n) * t.n + t.prog[to];
}

/** Liegen beide Abschnitte auf demselben Weg (beide Hauptstrecke oder dieselbe Abzweigung)? */
export function samePath(t: Track, a: number, b: number): boolean {
  return t.branchOf[a] === t.branchOf[b];
}

/**
 * Geht von seg aus steps Abschnitte weiter (negativ: zurück). route sagt, wo
 * abgebogen wird: Bit k gesetzt = Abzweigung k nehmen.
 */
export function walk(t: Track, seg: number, steps: number, route = 0): number {
  let i = seg;
  if (steps >= 0) {
    for (let k = 0; k < steps; k++) {
      const f = t.fork[i];
      i = f >= 0 && (route >> t.branchOf[f]) & 1 ? f : t.next[i];
    }
  } else {
    for (let k = 0; k > steps; k--) i = t.prev[i];
  }
  return i;
}

/**
 * Der Abschnitt, von dem aus ein Fahrer mit dem Ziel route vorausschaut. An
 * einer Gabelung liegen beide Wege anfangs ineinander, und die Zuordnung
 * "nächste Mittellinie" kann auf dem falschen landen – dann zählt der
 * Abschnitt gleich nebenan auf dem gewollten Weg.
 */
export function routeSeg(t: Track, seg: number, route: number): number {
  const other = t.twin[seg];
  if (other < 0) return seg;
  const own = t.branchOf[seg];
  if (own >= 0) return (route >> own) & 1 ? seg : other;
  return (route >> t.branchOf[other]) & 1 ? other : seg;
}

/** Schreibt die nächsten out.length Abschnitte auf dem Weg route nach out, beginnend bei seg. */
export function pathAhead(t: Track, seg: number, route: number, out: Int32Array): void {
  let i = routeSeg(t, seg, route);
  for (let k = 0; k < out.length; k++) {
    out[k] = i;
    const f = t.fork[i];
    i = f >= 0 && (route >> t.branchOf[f]) & 1 ? f : t.next[i];
  }
}

/** Ergebnis von projectOnTrack – wird wiederverwendet, um nichts anzulegen. */
export const proj = { seg: 0, lat: 0, along: 0 };

/**
 * Ordnet einen Punkt der Strecke zu: nächster Abschnitt in der Nähe von hint
 * und seitlicher Abstand von der Mittellinie (rechts positiv). Gesucht wird
 * nur um hint herum – so springt die Zuordnung nie auf ein anderes
 * Streckenstück, das zufällig in der Nähe (oder darüber) verläuft.
 */
export function projectOnTrack(t: Track, x: number, z: number, hint: number): typeof proj {
  // Ein Hinweis außerhalb des Netzes (etwa "Abschnitt + 14" über die Startlinie hinweg) gilt für die Hauptstrecke.
  if (!(hint >= 0 && hint < t.total)) hint = hint === hint ? wrapSeg(t, Math.floor(hint)) : 0;
  let best = hint;
  let bestD = Infinity;
  const cand = t.cand;
  for (let k = t.candAt[hint], end = t.candAt[hint + 1]; k < end; k++) {
    const i = cand[k];
    const dx = x - t.px[i];
    const dz = z - t.pz[i];
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const dx = x - t.px[best];
  const dz = z - t.pz[best];
  proj.seg = best;
  proj.lat = dx * -t.tz[best] + dz * t.tx[best];
  proj.along = dx * t.tx[best] + dz * t.tz[best];
  return proj;
}

/** Höhe der Fahrbahnmitte an einer Stelle zwischen zwei Abschnitten. */
export function centerHeight(t: Track, seg: number, along: number): number {
  const j = along >= 0 ? t.next[seg] : t.prev[seg];
  const f = Math.min(1, Math.abs(along) / t.step);
  return t.py[seg] + (t.py[j] - t.py[seg]) * f;
}

/** So weit darf ein Körper mit Radius 0 auf der Seite side (−1 links, 1 rechts) von der Mittellinie weg. */
export function sideLimit(t: Track, seg: number, side: number): number {
  return t.edge[seg] & (side > 0 ? EDGE_FREE_R : EDGE_FREE_L) ? t.free[seg] : t.wh[seg];
}

/**
 * Höhe des Bodens an einer projizierten Stelle – oder NO_GROUND, wenn dort
 * eine Lücke ist bzw. das Kart über eine Kante ohne Bande hinaus ist.
 */
export function groundAt(t: Track, seg: number, along: number, lat: number): number {
  const e = t.edge[seg];
  if (e !== 0) {
    if (e & EDGE_GAP) return NO_GROUND;
    if (lat < -t.wh[seg] && e & EDGE_OPEN_L) return NO_GROUND;
    if (lat > t.wh[seg] && e & EDGE_OPEN_R) return NO_GROUND;
  }
  return centerHeight(t, seg, along) + lat * t.bank[seg];
}

/** Hub des Seegangs an einem Abschnitt (Mitte) zur Rennzeit time. */
function nodeHeave(t: Track, seg: number, time: number): number {
  const a = t.floatA[seg];
  if (a < 0) return 0;
  const b = t.floatB[seg];
  return t.floatWA[seg] * pontoonLift(t.pontoons[a], time) + (b < 0 ? 0 : t.floatWB[seg] * pontoonLift(t.pontoons[b], time));
}

/**
 * Seegang: so weit liegt die Fahrbahn an dieser Stelle zur Rennzeit time über (oder unter) ihrer
 * Ruhelage. Außerhalb der Pontons 0. Zwischen zwei Abschnitten wird wie bei der Höhe gemittelt.
 */
export function heaveAt(t: Track, seg: number, along: number, time: number): number {
  if (t.pontoons.length === 0) return 0;
  const j = along >= 0 ? t.next[seg] : t.prev[seg];
  if (t.floatA[seg] < 0 && t.floatA[j] < 0) return 0;
  const f = Math.min(1, Math.abs(along) / t.step);
  const h = nodeHeave(t, seg, time);
  return h + (nodeHeave(t, j, time) - h) * f;
}

/** Fehlt an dieser Stelle zur Rennzeit time die Fahrbahn (Bruchstelle)? */
export function holeAt(t: Track, seg: number, lat: number, time: number): boolean {
  if ((t.edge[seg] & EDGE_BROKEN) === 0) return false;
  for (const h of t.holes) {
    if (seg < h.first || seg >= h.first + h.count || lat < h.lat0 || lat > h.lat1) continue;
    if (planActive(h.plan, time)) return true;
  }
  return false;
}

/** Sperrt zur Rennzeit time ein Tor diesen Abschnitt? */
export function gateAt(t: Track, seg: number, time: number): boolean {
  for (const g of t.gates) if (seg >= g.first && seg < g.first + g.count && planActive(g.plan, time)) return true;
  return false;
}

/**
 * Ist das Tor an diesem Abschnitt für ein Kart der Größe size (KartState.size) zu? Tore mit Zeitplan wie gateAt;
 * ein Größentor ist zu für jeden, der nicht die verlangte Größe hat.
 */
export function gateShut(t: Track, seg: number, time: number, size: number): boolean {
  for (const g of t.gates) {
    if (seg < g.first || seg >= g.first + g.count) continue;
    if (g.only !== 0 ? (size > 0 ? 1 : size < 0 ? -1 : 0) !== g.only : planActive(g.plan, time)) return true;
  }
  return false;
}

/** Das Flussstück, zu dem dieser Abschnitt gehört (sonst null). */
/** Das Schienenstück, zu dem der Abschnitt gehört – oder null. */
export function railOf(t: Track, seg: number): Rail | null {
  if ((t.edge[seg] & EDGE_RAIL) === 0) return null;
  for (const r of t.rails) if (seg >= r.first && seg < r.first + r.count) return r;
  return null;
}

export function riverOf(t: Track, seg: number): River | null {
  if ((t.edge[seg] & EDGE_RIVER) === 0) return null;
  for (const r of t.rivers) if (seg >= r.first && seg < r.first + r.count) return r;
  return null;
}

/**
 * Die Floßbahn, auf deren Floß diese Stelle zur Rennzeit time liegt – null, wenn dort Wasser ist
 * (oder kein Fluss). Das Floß nimmt mit: lane.speed in m/s flussab.
 */
export function raftLane(t: Track, seg: number, along: number, lat: number, time: number): RaftLane | null {
  const r = riverOf(t, seg);
  if (!r) return null;
  const a = (seg - r.first) * t.step + along;
  for (const l of r.lanes) if (lat >= l.lat0 && lat <= l.lat1 && raftAt(l, a, time)) return l;
  return null;
}

/** Höhe des Bodens zur Rennzeit time: wie groundAt, auf Pontons samt Seegang – und ohne das, was weggebrochen ist. */
export function groundNow(t: Track, seg: number, along: number, lat: number, time: number): number {
  const g = groundAt(t, seg, along, lat);
  if (g === NO_GROUND) return g;
  if (t.holes.length > 0 && holeAt(t, seg, lat, time)) return NO_GROUND;
  // (Ohne Flussstücke – so messen die Tests den bloßen Verlauf – trägt die Fläche überall.)
  if ((t.edge[seg] & EDGE_RIVER) !== 0 && t.rivers.length > 0 && raftLane(t, seg, along, lat, time) === null) return NO_GROUND;
  return t.pontoons.length === 0 ? g : g + heaveAt(t, seg, along, time);
}

/** Seitliche Lage eines pendelnden Hindernisses zum Host-Tick tick. */
export function hazardLat(h: Hazard, tick: number): number {
  return h.amp * Math.sin((tick / h.period) * 2 * Math.PI + h.phase);
}

/** Startaufstellung: zwei versetzte Reihen hinter der Linie. */
export function gridPosition(t: Track, slot: number): { x: number; y: number; z: number; heading: number; seg: number } {
  const back = 5 + slot * 4.5;
  const seg = wrapSeg(t, Math.round(-back / t.step));
  const lat = (slot % 2 === 0 ? -0.4 : 0.4) * t.rh[seg];
  return {
    x: t.px[seg] + rightX(t, seg) * lat,
    y: t.py[seg] + lat * t.bank[seg],
    z: t.pz[seg] + rightZ(t, seg) * lat,
    heading: trackHeading(t, seg),
    seg,
  };
}

// ---------------------------------------------------------------------------
// Alle Strecken; gebaut wird erst, wenn eine gebraucht wird.

const built: (Track | undefined)[] = [];

export const TRACK_COUNT = TRACK_DEFS.length;

export function getTrack(index: number): Track {
  const i = Math.max(0, Math.min(TRACK_DEFS.length - 1, index | 0));
  return (built[i] ??= buildTrack(TRACK_DEFS[i], i));
}

/** Die Strecke, auf der gerade gefahren wird. */
export let TRACK: Track = getTrack(0);

/** Wechselt die aktive Strecke (für Simulation, KI und Darstellung zugleich). */
export function setTrack(index: number): Track {
  TRACK = getTrack(index);
  return TRACK;
}

/** Nur für Tests: eine eigens gebaute Strecke aktiv schalten. */
export function useTrack(track: Track): Track {
  TRACK = track;
  return TRACK;
}
