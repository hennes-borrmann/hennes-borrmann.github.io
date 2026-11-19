// Streckenmechanik: alles, was auf einer Strecke von selbst fährt oder im Takt
// etwas tut – Verkehr, Geysire, Lavabomben, steigende Lava.
//
// Jede Stellung ist eine reine Funktion der Rennzeit (Ticks seit "Los",
// während des Countdowns negativ). Nichts davon steht im Spielstand und nichts
// reist über das Netz: der Host und jeder Bildschirm rechnen dieselbe Formel.
// Die Rennzeit gehört zu jeder Eingabe (StepEnv.time in sim.ts) – deshalb
// stimmt die Vorhersage auf dem Bildschirm eines Mitspielers auch dann, wenn
// er einen Bus streift.
//
// Dieses Modul kennt keine Strecke und kein Kart (keine Importe): es
// beschreibt nur, was es gibt und wann es etwas tut. Wo ein Fahrzeug auf der
// Strecke steht, rechnet track.ts (vehiclePose); was mit einem Kart passiert,
// rechnet sim.ts.

// --- Verkehr -------------------------------------------------------------------

export const VEH_TAXI = 0;
export const VEH_VAN = 1;
export const VEH_BUS = 2;
export const VEH_TRAM = 3;
/** Wüstenexpress: Lok, Keilwagen, vier Flachwagen und am Ende ein Rampenwagen – über die Dächer kann man fahren. */
export const VEH_TRAIN = 4;

export interface VehicleSpec {
  /** Halbe Länge und halbe Breite eines Wagens, Höhe über der Fahrbahn (Meter). */
  half: number;
  halfWidth: number;
  height: number;
  /** Anzahl Wagen (Straßenbahn: mehrere, die der Kurve folgen) und ihr Abstand von Mitte zu Mitte. */
  cars: number;
  pitch: number;
  /**
   * Befahrbare Dächer: je Wagen (0 = vorderster) die Höhe des Dachs am Heck und am Bug (Meter über der Fahrbahn),
   * dazwischen linear. Ohne Angabe ist das Fahrzeug nur ein Hindernis.
   */
  roofs?: [number, number][];
}

export const VEHICLE_SPECS: VehicleSpec[] = [
  { half: 2.2, halfWidth: 0.95, height: 1.5, cars: 1, pitch: 0 },
  { half: 2.7, halfWidth: 1.05, height: 2.3, cars: 1, pitch: 0 },
  { half: 5.2, halfWidth: 1.25, height: 3.0, cars: 1, pitch: 0 },
  { half: 3.5, halfWidth: 1.2, height: 3.1, cars: 3, pitch: 7.5 },
  // Zug (von vorn): Lok 3 m hoch, Keilwagen 1,8 → 3 m, vier Flachwagen 1,8 m, Rampenwagen vom Boden auf 1,8 m.
  {
    half: 6,
    halfWidth: 1.9,
    height: 3.0,
    cars: 7,
    pitch: 12.6,
    roofs: [
      [3.0, 3.0],
      [1.8, 3.0],
      [1.8, 1.8],
      [1.8, 1.8],
      [1.8, 1.8],
      [1.8, 1.8],
      [0.12, 1.8],
    ],
  },
  // U-Bahn der Neonhochbahn: fünf gleiche Wagen, flaches Dach 2,1 m über der Schiene – im Bahnhof auf Höhe der Fahrbahn.
  {
    half: 6.1,
    halfWidth: 2.2,
    height: 2.1,
    cars: 5,
    pitch: 12.6,
    roofs: [
      [2.1, 2.1],
      [2.1, 2.1],
      [2.1, 2.1],
      [2.1, 2.1],
      [2.1, 2.1],
    ],
  },
  // Straßenbahn der Dächerjagd: ein alter Zweiwagenzug mit Bügel auf dem Dach – kürzer und schmaler als die der Nachtschicht.
  { half: 4.4, halfWidth: 1.15, height: 3.0, cars: 2, pitch: 9.4 },
];

/**
 * Neonhochbahn: Magnetzug der U-Bahn (fünf gleiche Wagen mit flachem Dach). Er hält im Bahnhof in einem Graben, das Dach
 * genau auf Höhe der Fahrbahn: Solange er steht, ist er die Brücke über den Graben (TrackDef.metro, BranchDef.trench).
 */
export const VEH_METRO = 5;

/**
 * Dächerjagd: die Straßenbahn durch die Gassen. Sie fährt nicht im Kreis um die ganze Runde, sondern nach Fahrplan auf
 * ihrer Linie (Vehicle.line): ein Stück einer Spur der Hauptstrecke, an dessen Anfang sie aus der Remise kommt und an
 * dessen Ende sie in eine Seitengasse abbiegt (das zeigt nur das Bild – für die Physik ist sie dort weg).
 */
export const VEH_STADTBAHN = 6;

/** So weit unter der Dachkante gilt ein Kart noch als „auf dem Dach“ (Meter) – darunter ist der Wagen eine Wand. */
export const ROOF_STEP = 0.45;
/** Die Dächer reichen ein Stück über die Kupplungen (Meter je Wagenende) und seitlich über die Wagenkante. */
export const ROOF_OVERHANG = 0.7;
export const ROOF_EDGE = 0.15;

/** Höhe des Dachs von Wagen car über der Fahrbahn an der Stelle du (Meter vor der Wagenmitte, zum Bug positiv). */
export function roofTop(v: VehicleSpec, car: number, du: number): number {
  const r = v.roofs ? v.roofs[Math.min(car, v.roofs.length - 1)] : null;
  if (!r) return v.height;
  const k = Math.max(0, Math.min(1, (du + v.half) / (2 * v.half)));
  return r[0] + (r[1] - r[0]) * k;
}

/** Ein Fahrzeug im Verkehr: fährt mit festem Tempo auf fester Spur die Hauptstrecke entlang. */
export interface Vehicle extends VehicleSpec {
  id: number;
  kind: number;
  /** Spur: seitliche Lage der Fahrzeugmitte bei Nennbreite der Fahrbahn (Meter, rechts positiv). */
  lat: number;
  /** Tempo in m/s. */
  speed: number;
  /** Lage des vordersten Wagens bei Rennzeit 0: Meter hinter der Startlinie. */
  offset: number;
  /**
   * U-Bahn (Neonhochbahn): Der Zug fährt nicht auf der Strecke, sondern auf der eigenen Linie (Track.metro) nach dem
   * Fahrplan plan; train = seine Nummer im Umlauf (0 … plan.trains−1). Ohne plan ein gewöhnliches Fahrzeug.
   */
  plan?: MetroPlan;
  train?: number;
  /**
   * Straßenbahn (Dächerjagd): Der Zug fährt nach dem Fahrplan line.plan (wie die U-Bahn: auftauchen, anfahren, an der
   * Haltestelle halten, weiterfahren) auf seiner Linie (TramLine) – sie liegt fast ganz auf der Spur lat der Hauptstrecke.
   * Ist er nicht auf ihr (noch in der Remise, schon in der Seitengasse), gibt es ihn für niemanden. train = seine Nummer
   * im Umlauf.
   */
  line?: TramLine;
}

/**
 * Linie einer Straßenbahn: Punkte im Abstand von einem Meter (Weltkoordinaten) – aus der Remise heraus, auf der Spur die
 * Gasse entlang und in eine Seitengasse hinein –, je Punkt der nächste Abschnitt der Hauptstrecke, die seitliche Lage dort
 * und wie weit er hinter der Startlinie liegt (Meter, für „ist sie in der Nähe?“), dazu der Fahrplan.
 */
export interface TramLine {
  n: number;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  seg: Int32Array;
  lat: Float64Array;
  along: Float64Array;
  plan: MetroPlan;
}

/**
 * Fahrplan der U-Bahn: Alle period Ticks kommt ein Zug. Er taucht am Anfang der Linie auf (im Tunnel), fährt mit speed
 * (m/s) heran, bremst mit accel (m/s²) und hält mit der Spitze bei stop (Meter ab Linienanfang) dwell Ticks lang; dann
 * fährt er an und verschwindet am Ende der Linie wieder im Tunnel. trains Züge teilen sich den Umlauf.
 */
export interface MetroPlan {
  period: number;
  phase: number;
  stop: number;
  speed: number;
  accel: number;
  dwell: number;
  trains: number;
}

/** Weg (Meter) aus dem Stand nach u Sekunden: anfahren mit accel bis speed, dann gleichmäßig. */
function metroRun(p: MetroPlan, u: number): number {
  const tv = p.speed / p.accel;
  return u <= tv ? 0.5 * p.accel * u * u : 0.5 * p.speed * tv + p.speed * (u - tv);
}

/** Wie lange (Sekunden) braucht der Zug für d Meter aus dem Stand? (Umkehrung von metroRun) */
function metroTime(p: MetroPlan, d: number): number {
  const tv = p.speed / p.accel;
  const dv = 0.5 * p.speed * tv;
  return d <= dv ? Math.sqrt((2 * d) / p.accel) : tv + (d - dv) / p.speed;
}

/** Ticks vom Auftauchen eines Zugs bis zum Halt, und bis zur Abfahrt. */
export function metroArrive(p: MetroPlan): number {
  return metroTime(p, p.stop) * 60;
}

/**
 * Lage der Zugspitze von Zug k zur Rennzeit time (Ticks): Meter ab Linienanfang. Was außerhalb der Linie liegt (vor dem
 * Auftauchen, nach dem Verschwinden im Tunnel), gibt es für niemanden (track.ts: metroPose). Reine Funktion der Rennzeit
 * (wie aller Verkehr).
 */
export function metroFront(p: MetroPlan, k: number, time: number): number {
  const cycle = p.period * p.trains;
  let c = (time - p.phase - k * p.period) % cycle;
  if (c < 0) c += cycle;
  const arr = metroArrive(p);
  if (c < arr) return p.stop - metroRun(p, (arr - c) / 60);
  if (c < arr + p.dwell) return p.stop;
  return p.stop + metroRun(p, (c - arr - p.dwell) / 60);
}

/** Beschreibung in der Streckendatei: Spuren mit je einem Tempo und ihren Fahrzeugen [Art, Meter]. */
export interface TrafficDef {
  lanes: { lat: number; speed: number; cars: [number, number][] }[];
}

/**
 * Lage des vordersten Wagens zur Rennzeit time (Ticks, auch gebrochen): Meter hinter der Startlinie, 0 ≤ s < lap.
 * Eine Straßenbahn, die gerade nicht auf ihrer Linie ist (noch in der Remise oder schon abgebogen), ist unendlich weit
 * weg – so fällt sie bei jedem „ist sie in der Nähe?“ von selbst heraus.
 */
export function vehicleAt(v: Vehicle, time: number, lap: number): number {
  if (v.line) {
    const f = lineFront(v, time);
    const n = v.line.n;
    // (da, solange die Mitte eines Wagens auf der Linie liegt – wie in track.ts: tramPose)
    if (f - v.half <= 0 || f - v.half - (v.cars - 1) * v.pitch >= n - 1) return Infinity;
    return v.line.along[Math.max(0, Math.min(n - 1, Math.round(f - v.half)))];
  }
  const s = (v.offset + (v.speed * time) / 60) % lap;
  return s < 0 ? s + lap : s;
}

/** Straßenbahn: Lage ihrer Spitze auf der Linie zur Rennzeit time (Meter ab Linienanfang; ≤ 0 = noch in der Remise). */
export function lineFront(v: Vehicle, time: number): number {
  return v.line ? metroFront(v.line.plan, v.train ?? 0, time) : 0;
}

/**
 * Tempo eines Fahrzeugs zur Rennzeit time (m/s): fest – außer bei der Straßenbahn, die nach Fahrplan anfährt, hält und
 * weiterfährt. (Gilt nur, solange sie auf ihrer Linie ist.)
 */
export function vehicleSpeed(v: Vehicle, time: number): number {
  if (!v.line) return v.speed;
  return Math.max(0, (lineFront(v, time + 0.5) - lineFront(v, time - 0.5)) * 60);
}

/** Windschatten: so weit hinter dem Heck und so weit seitlich der Fahrzeugmitte wirkt er (Meter). */
export const WAKE_LENGTH = 18;
export const WAKE_HALF = 1.7;
/**
 * Windschatten im Zustand eines Karts (KartState.draft): 0 … DRAFT_FULL lädt er
 * (zwei je Tick hinter einem Fahrzeug); wer geladen ausschert, bekommt Zug –
 * dann zählt der Wert von DRAFT_PULL_FROM + DRAFT_PULL_TICKS herunter.
 */
export const DRAFT_FULL = 80;
export const DRAFT_PULL_FROM = 100;
export const DRAFT_PULL_TICKS = 85;
/** Ab diesem Tempounterschied (m/s) ist ein Auffahrunfall ein Treffer, darunter nur ein Stoß. */
export const CRASH_SPEED = 7;

// --- Geysire und Lavabomben ------------------------------------------------------

export const PULSE_VENT = 0;
export const PULSE_BOMB = 1;
/** Stampfpresse: schlägt im Takt herunter und plättet, was darunter steht. */
export const PULSE_PRESS = 2;
/** Blasenschlot (unter Wasser): hebt im Takt an, was über ihm ist – ein Sprungbrett, kein Treffer. */
export const PULSE_BUBBLE = 3;
/**
 * Lawine: geht im Takt quer über die Fahrbahn nieder. Solange sie läuft, schiebt sie alles im
 * Streifen (radius Meter vor und hinter der Stelle, über die ganze Breite) talwärts und bremst
 * stark – kein Dreher. lat nennt die Bergseite: von dort kommt sie.
 */
export const PULSE_AVALANCHE = 4;
/** Eiszapfen: fällt im Takt von der Höhlendecke – trifft wie eine Lavabombe, lässt Splitter liegen. */
export const PULSE_ICICLE = 5;
/** Meteorit: schlägt im Takt ein – trifft wie eine Lavabombe, der Krater glüht kurz nach. */
export const PULSE_METEOR = 6;
/** Blitz: schlägt im Takt an einer Stelle der Fahrbahn ein – trifft wie eine Lavabombe; kurze, grelle Vorwarnung. */
export const PULSE_BOLT = 7;
/**
 * Blitzableiter: ein Mast neben der Bahn (bei lat), in den im Takt der Blitz fährt. Solange er geladen ist
 * (on Ticks), steht quer über die ganze Fahrbahn ein Ladefeld – radius Meter vor und hinter dem Mast. Wer
 * hindurchfährt, wird aufgeladen: ein Schub wie vom Boost-Feld. Kein Treffer.
 */
export const PULSE_ROD = 8;
/**
 * Schubmagnet auf einer Schiene (Achterbahn-Rummel): Im Takt zieht er an – wer dann auf seiner Schiene über ihn
 * rollt, wird angeschoben. Die Magnete der Schienen nebeneinander ziehen abwechselnd: Man wählt die Schiene nach dem Takt.
 */
export const PULSE_KICK = 9;
/**
 * Sprengladung (Kristallmine): Im Takt geht eine Ladung im Stoß neben oder in der Fahrbahn hoch. Vorher brennt die
 * Zündschnur ab, eine Lampe blinkt, die Sirene heult (warn Ticks); die Explosion wirft, wer im Umkreis ist, hoch – ein
 * Treffer wie von der Lavabombe, nur heftiger. Danach hängt Staub in der Luft (nur Bild).
 */
export const PULSE_BLAST = 10;
/**
 * Abgasstrahl (Startrampe): Beim Start einer Rakete schießt das Feuer durch den Flammengraben hinaus – wer in der
 * Flammenzone ist, wird getroffen und hochgeworfen (wie von der Sprengladung). Die zehn Sekunden davor läuft der
 * Countdown (warn: Anzeigetafeln, Piepen); Takt und Versatz aller Abgasstrahlen einer Strecke sind gleich.
 */
export const PULSE_FLAME = 11;

// --- Raupentransporter (Startrampe) --------------------------------------------------
// Ein Raupentransporter kriecht auf seinem Kriechweg hin und her: Der Kriechweg liegt in einem Graben, so tief, wie die
// Plattform des Transporters hoch ist. Steht er an seinem einen Ende, überbrückt die Plattform den Graben genau dort, wo
// eine Abkürzung ihn quert (BranchDef.trench) – dann trägt sie wie ein Stück Fahrbahn; die Hauptstraße taucht dagegen
// in den Graben hinunter und quert ihn auf der Sohle, unter der Plattform hindurch, zwischen den vier Raupenböcken.
// Wo er gerade ist, folgt allein aus der Rennzeit (wie aller Verkehr).

/**
 * Fahrplan: Ein Umlauf dauert 2·travel + dwell0 + dwell1 Ticks. Er beginnt am Ende 0 (über der Abkürzung) mit dwell0
 * Ticks Halt, dann travel Ticks Fahrt zum Ende 1 (length Meter weiter), dwell1 Ticks Halt, travel Ticks zurück.
 * Anfahren und Anhalten sind weich (die Fahrt folgt einer halben Kosinuswelle).
 */
export interface CrawlerPlan {
  period: number;
  phase: number;
  travel: number;
  dwell0: number;
  dwell1: number;
  length: number;
}

/** Maße des Transporters (Meter): Plattform (halbe Länge längs des Kriechwegs, halbe Breite, Dicke, Oberkante über der Sohle). */
export const CRAWLER_HALF = 13;
export const CRAWLER_HALF_WIDTH = 9.2;
export const CRAWLER_SLAB = 1.7;
export const CRAWLER_DECK = 6.5;
/** Die vier Raupenböcke: Lage ihrer Mitte (längs, quer) und halbe Maße (längs, quer). Sie reichen von der Sohle bis unter die Plattform. */
export const CRAWLER_LEG_U = 9.6;
export const CRAWLER_LEG_W = 6.6;
export const CRAWLER_LEG_HALF = 2.9;
export const CRAWLER_LEG_HALF_WIDTH = 1.9;

/** Stand im Umlauf: 0 ≤ c < period. */
function crawlerCycle(p: CrawlerPlan, time: number): number {
  const c = (time + p.phase) % p.period;
  return c < 0 ? c + p.period : c;
}

/** Wo der Transporter zur Rennzeit time (Ticks, auch gebrochen) steht: Meter vom Ende 0 aus (0 … length). */
export function crawlerAt(p: CrawlerPlan, time: number): number {
  let c = crawlerCycle(p, time);
  if (c < p.dwell0) return 0;
  c -= p.dwell0;
  if (c < p.travel) return (p.length * (1 - Math.cos((Math.PI * c) / p.travel))) / 2;
  c -= p.travel;
  if (c < p.dwell1) return p.length;
  c -= p.dwell1;
  return (p.length * (1 + Math.cos((Math.PI * c) / p.travel))) / 2;
}

/** Tempo des Transporters zur Rennzeit time (m/s, zum Ende 1 hin positiv). */
export function crawlerSpeed(p: CrawlerPlan, time: number): number {
  let c = crawlerCycle(p, time);
  if (c < p.dwell0) return 0;
  c -= p.dwell0;
  const k = (p.length * Math.PI * 60) / (2 * p.travel);
  if (c < p.travel) return k * Math.sin((Math.PI * c) / p.travel);
  c -= p.travel;
  if (c < p.dwell1) return 0;
  c -= p.dwell1;
  return -k * Math.sin((Math.PI * c) / p.travel);
}

// --- Wetterleuchten ------------------------------------------------------------------
// Auf einer dunklen Strecke (Gewitterkamm) erhellt jeder Blitz für einen Augenblick alles. Wie hell es
// gerade ist, folgt allein aus der Rennzeit – auf jedem Bildschirm gleich (render/mechanics/storm.ts).

/** Fernes Wetterleuchten ohne Einschlag: Takt und Versatz in Ticks, Helligkeit 0…1. */
export interface Flash {
  period: number;
  phase: number;
  power: number;
}

/** So lange leuchtet ein Blitz nach (Ticks). */
export const FLASH_TICKS = 26;

/**
 * Helligkeit eines Blitzes c Ticks nach seinem Beginn: heller Schlag, ein leichtes Nachzucken, Ausklang. 0…1.
 * Bewusst kein hartes Flackern: der Wert fällt zwischendurch nie unter 0,7 des Schlags – schnelle, starke
 * Hell-Dunkel-Wechsel sind unangenehm und können bei manchen Menschen Anfälle auslösen.
 */
export function flashShape(c: number): number {
  if (c < 0 || c >= FLASH_TICKS) return 0;
  if (c < 3) return 1;
  if (c < 6) return 0.72;
  if (c < 9) return 0.86;
  return 0.86 * (1 - (c - 9) / (FLASH_TICKS - 9)) ** 2;
}

/** So stark hellt ein Einschlag auf der Bahn bzw. in einen Blitzableiter die ganze Welt auf (das Wetterleuchten: bis 1). */
export const BOLT_LIGHT = 0.38;
export const ROD_LIGHT = 0.28;

/**
 * Wie hell das Gewitter die ganze Welt zur Rennzeit time gerade macht (0 = finster … 1 = taghell). Taghell wird es
 * nur beim seltenen Wetterleuchten; die vielen Einschläge auf dem Kamm (PULSE_BOLT, PULSE_ROD) hellen nur schwach
 * auf – grell sind sie bloß an Ort und Stelle (das zeichnet render/mechanics/storm.ts). Es zählt der hellste Beitrag.
 */
export function stormLight(pulses: Pulse[], flashes: Flash[], time: number): number {
  let best = 0;
  for (const p of pulses) {
    if (p.kind !== PULSE_BOLT && p.kind !== PULSE_ROD) continue;
    const k = flashShape(pulseCycle(p, time)) * (p.kind === PULSE_BOLT ? BOLT_LIGHT : ROD_LIGHT);
    if (k > best) best = k;
  }
  for (const f of flashes) {
    const c = (time + f.phase) % f.period;
    const k = flashShape(c < 0 ? c + f.period : c) * f.power;
    if (k > best) best = k;
  }
  return best;
}
/** Lawine: seitlicher Schub (m/s) und Bremsfaktor je Tick. */
export const AVALANCHE_PUSH = 6.5;
export const AVALANCHE_DRAG = 0.962;
/**
 * Ablauf einer Presse, gemeinsam für Physik und Bild: in den letzten PRESS_STRIKE Ticks
 * vor Zyklus 0 fällt der Stempel und schlägt bei 0 auf – genau dann beginnt die Gefahr
 * (on Ticks lang). Er hebt sich schon PRESS_LEAD Ticks vor deren Ende wieder, so dass er
 * bei ihrem Ende über Karthöhe steht; nach PRESS_RISE Ticks ist er ganz oben.
 */
export const PRESS_STRIKE = 3;
export const PRESS_LEAD = 10;
export const PRESS_RISE = 40;

/**
 * Eine Stelle, an der im Takt etwas passiert. Der Zyklus beginnt mit dem
 * Ausbruch bzw. Einschlag (on Ticks lang gefährlich), dann ist Ruhe, und die
 * letzten warn Ticks vor dem nächsten Ausbruch kündigt er sich an.
 */
export interface Pulse {
  kind: number;
  seg: number;
  lat: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Alles in Ticks. */
  period: number;
  phase: number;
  on: number;
  warn: number;
}

/** Stand im Zyklus: 0 ≤ c < period. c < on = gefährlich, c ≥ period − warn = Vorwarnung. */
export function pulseCycle(p: Pulse, time: number): number {
  const c = (time + p.phase) % p.period;
  return c < 0 ? c + p.period : c;
}

export function pulseActive(p: Pulse, time: number): boolean {
  return pulseCycle(p, time) < p.on;
}

/**
 * Wie weit der Stempel einer Presse offen steht: 0 = liegt auf der Fahrbahn, 1 = ganz oben
 * (das Ansenken während der Vorwarnung ist Zierde und hier nicht enthalten).
 */
export function pressOpen(p: Pulse, time: number): number {
  const c = pulseCycle(p, time);
  if (c >= p.period - PRESS_STRIKE) {
    const k = (c - (p.period - PRESS_STRIKE)) / PRESS_STRIKE;
    return 1 - k * k;
  }
  const up = p.on - PRESS_LEAD;
  if (c < up) return 0;
  const k = (c - up) / PRESS_RISE;
  return k >= 1 ? 1 : 1 - (1 - k) * (1 - k);
}

/** 0 = Ruhe … 1 = bricht gleich aus. */
export function pulseWarning(p: Pulse, time: number): number {
  const c = pulseCycle(p, time);
  return c >= p.period - p.warn ? (c - (p.period - p.warn)) / p.warn : 0;
}

// --- Steigende Lava ----------------------------------------------------------------

/** Ein Stück Fahrbahn, das im Takt überflutet wird: steigt, steht, fällt, ist frei. */
export interface Flood {
  /** Erster Abschnitt und Anzahl (zusammenhängend auf einem Weg). */
  first: number;
  count: number;
  /** Abzweigung, auf der das Stück liegt (−1 = Hauptstrecke). */
  branch: number;
  /** Alles in Ticks. */
  period: number;
  phase: number;
  rise: number;
  hold: number;
  fall: number;
  /** Ticks, die ein Kart mit vollem Tempo von der Gabelung bis hierher braucht (für Ampel und KI). */
  lead: number;
}

/** Pegel 0 (frei) … 1 (voll) zur Rennzeit time. */
export function floodLevel(f: Flood, time: number): number {
  let c = (time + f.phase) % f.period;
  if (c < 0) c += f.period;
  if (c < f.rise) return c / f.rise;
  c -= f.rise;
  if (c < f.hold) return 1;
  c -= f.hold;
  if (c < f.fall) return 1 - c / f.fall;
  return 0;
}

/** Ab diesem Pegel bremst die Lava. */
export const FLOOD_FROM = 0.3;
/** Höchster Pegel über dem tiefsten Punkt der Fahrbahn (Meter) – für die Darstellung. */
export const FLOOD_DEPTH = 0.55;

/** Höchster Pegel im Zeitraum [from, to] (Ticks) – "steht Lava, während ich hindurchfahre?". */
export function floodPeak(f: Flood, from: number, to: number): number {
  let peak = 0;
  for (let t = from; t <= to; t += 15) peak = Math.max(peak, floodLevel(f, t));
  return Math.max(peak, floodLevel(f, to));
}

// --- Förderbänder ----------------------------------------------------------------

/**
 * Ein Stück Fahrbahn, das sich bewegt: wer darauf fährt, wird mitgenommen –
 * längs (schneller oder langsamer) oder quer (zur Seite geschoben). Bänder
 * laufen immer; sie hängen nicht von der Rennzeit ab.
 */
export interface Belt {
  /** Erster Abschnitt und Anzahl (zusammenhängend auf einem Weg). */
  first: number;
  count: number;
  /** Seitlicher Bereich von … bis (Meter, rechts positiv). */
  lat0: number;
  lat1: number;
  /** Tempo des Bands in m/s: längs (vorwärts positiv) und quer (nach rechts positiv). */
  along: number;
  across: number;
  /** Strömung unter Wasser statt Förderband: nimmt das Kart auch mit, wenn es schwebt. */
  swim?: boolean;
}
/**
 * Zum Rand eines Bands hin läuft seine Wirkung aus: seitlich über BELT_EDGE Meter, an
 * Anfang und Ende über BELT_RAMP Meter. An der Naht zweier gegenläufiger Bänder springt
 * das Tempo deshalb nicht – sonst genügte dort ein Tausendstelmillimeter Unterschied
 * zwischen Host und Mitspieler für 20 cm Abweichung.
 */
export const BELT_EDGE = 0.5;
export const BELT_RAMP = 2;

// --- Ebbe und Flut -----------------------------------------------------------------

/**
 * Der Wasserspiegel steigt und fällt im Takt. Wo die Fahrbahn tiefer liegt als
 * das Wasser, bremst es – je tiefer, desto mehr. Dazu schwappt eine Welle.
 */
export interface Tide {
  /** Wasserhöhe bei Ebbe und bei Flut (Meter, dieselbe Höhe wie die Fahrbahn). */
  low: number;
  high: number;
  /** Alles in Ticks. */
  period: number;
  phase: number;
  /** Welle: Ausschlag in Metern und Periode in Ticks. */
  wave: number;
  wavePeriod: number;
}

/** Anteil der Periode, in dem das Wasser steigt bzw. fällt (dazwischen steht es). */
const TIDE_TURN = 0.16;

/** Stand der Gezeit ohne Welle: 0 = Ebbe … 1 = Flut. Der Zyklus beginnt mit Ebbe. */
export function tidePhase(t: Tide, time: number): number {
  let c = ((time + t.phase) % t.period) / t.period;
  if (c < 0) c += 1;
  const stay = 0.5 - TIDE_TURN;
  const ease = (k: number): number => k * k * (3 - 2 * k);
  if (c < stay) return 0;
  if (c < 0.5) return ease((c - stay) / TIDE_TURN);
  if (c < 0.5 + stay) return 1;
  return 1 - ease((c - 0.5 - stay) / TIDE_TURN);
}

/** Höhe des Wasserspiegels zur Rennzeit time (mit Welle). */
export function tideLevel(t: Tide, time: number): number {
  return t.low + (t.high - t.low) * tidePhase(t, time) + t.wave * Math.sin((time / t.wavePeriod) * 2 * Math.PI);
}

/** Ab dieser Wassertiefe (Meter) bremst es; WATER_DRAG je Meter Tiefe, höchstens WATER_MAX. */
export const WATER_FROM = 0.06;
export const WATER_DRAG = 1;
export const WATER_MAX = 0.55;

/**
 * Faktor auf die Höchstgeschwindigkeit bei dieser Wassertiefe. Setzt an der Wasserlinie
 * stetig ein (kein Sprung): eine Welle oder eine um einen Tick andere Rennzeit ändert
 * das Tempo dort nur unmerklich.
 */
export function waterFactor(depth: number): number {
  return depth <= WATER_FROM ? 1 : 1 - Math.min(WATER_MAX, (depth - WATER_FROM) * WATER_DRAG);
}

/** Geplättet (Stampfpresse): so lange fährt das Kart flach und langsam (Ticks). */
export const FLAT_TICKS = 130;
export const FLAT_FACTOR = 0.55;

// --- Fliegen -----------------------------------------------------------------------
// Über einer Flugstrecke (Lücke mit EDGE_GLIDE) trägt die Luft: das Kart sinkt
// nur langsam, lenkt weich und hält sein Tempo. Aufwinde heben es, Ringe geben
// Schub. Die gedachte Ideallinie ist die Höhe der Abschnitte (track.py).

/** Sinkgeschwindigkeit im Gleitflug (m/s) und wie schnell sich die Steig-/Sinkrate einstellt (1/s). */
export const GLIDE_SINK = 2.6;
export const GLIDE_RESPONSE = 2.4;
/** Reisetempo im Gleitflug (m/s) und wie zügig es erreicht wird (m/s²). */
export const GLIDE_SPEED = 29;
export const GLIDE_ACCEL = 12;
/** Drehrate bei vollem Lenkeinschlag (rad/s) und wie schnell die Flugrichtung der Nase folgt (1/s). */
export const GLIDE_YAW = 1.15;
export const GLIDE_GRIP = 2.6;
/** So weit über der Ideallinie ist Schluss mit Steigen, so weit darunter ist das Kart abgestürzt (Meter). */
export const GLIDE_CEILING = 13;
export const GLIDE_FALL = 15;
/**
 * Neben dem Flugkorridor trägt die Luft nicht: GLIDE_EDGE Meter außerhalb sinkt das Kart
 * um GLIDE_DROP m/s schneller (dazwischen anteilig) – wer abdriftet, fällt bald und wird zurückgesetzt.
 */
export const GLIDE_EDGE = 6;
export const GLIDE_DROP = 10;

/** Aufwind: eine Säule aufsteigender Luft. Wer hindurchfliegt, steigt. */
export interface Thermal {
  seg: number;
  lat: number;
  x: number;
  z: number;
  /** Höhe der Ideallinie an dieser Stelle. */
  y: number;
  radius: number;
  /** Steiggeschwindigkeit in der Säule (m/s). */
  lift: number;
}

/** Schubring in der Luft: wer hindurchfliegt, bekommt Schub. */
export interface Ring {
  seg: number;
  lat: number;
  x: number;
  /** Höhe der Ringmitte. */
  y: number;
  z: number;
  radius: number;
}

// --- Tauchen -----------------------------------------------------------------------
// Unter Wasser (Abschnitte mit track.deep, Kart unter dem Meeresspiegel track.sea) trägt
// das Wasser: das Kart sinkt nur langsam und springt deshalb weit, es rollt schneller
// aus und rutscht in Kurven mehr. Strömungen (Belt.swim) nehmen es mit, auch im
// Schweben. Blasenschlote (PULSE_BUBBLE) heben es im Takt an – oben hängen Schubringe.

/** Anteil der Schwerkraft unter Wasser und die höchste Sinkgeschwindigkeit (m/s). */
export const DIVE_GRAVITY = 0.3;
export const DIVE_SINK = 6.5;
/** Faktoren unter Wasser: Höchsttempo, Antritt, Seitenhalt. */
export const DIVE_SPEED = 0.94;
export const DIVE_ACCEL = 0.88;
export const DIVE_GRIP = 0.86;
/** So viel zusätzliche Verzögerung beim Ausrollen (m/s²) – Wasser bremst. */
export const DIVE_COAST = 7;
/** Im Schweben lenkt es sich unter Wasser besser als in der Luft (Anteil der Lenkung am Boden). */
export const DIVE_STEER = 0.75;
/** Ein Blasenschlot hebt mit dieser Geschwindigkeit (m/s). */
export const BUBBLE_LIFT = 6.5;

// --- Wind ----------------------------------------------------------------------------
// Im Sturmhafen fegen Böen quer über die Fahrbahn. Jede Böe schiebt alles in ihrem Bereich
// zur Seite – am Boden wie in der Luft –, kündigt sich an (Windsäcke, Gischt) und lässt
// wieder nach. Hinter Containern liegt Windschatten: dort kommt nichts an.

/** Ein Bereich, über den im Takt eine Böe fegt. */
export interface Wind {
  /** Erster Abschnitt und Anzahl (zusammenhängend auf einem Weg). */
  first: number;
  count: number;
  /** Seitlicher Schub bei voller Böe in m/s (nach rechts positiv). */
  push: number;
  /** Alles in Ticks: die Böe weht on Ticks lang, die letzten warn Ticks davor kündigt sie sich an. */
  period: number;
  phase: number;
  on: number;
  warn: number;
  /** Windschatten: Abschnitte first … last, seitlich lat0 … lat1 (Meter). */
  lee: { first: number; last: number; lat0: number; lat1: number }[];
}

/** So viele Ticks braucht eine Böe, um auf volle Stärke anzuschwellen (und wieder abzuflauen). */
export const WIND_RISE = 26;
/** Übergang am Rand eines Windschattens (Meter seitlich) und an Anfang und Ende von Böe und Windschatten (Meter längs). */
export const WIND_EDGE = 1.2;
export const WIND_ENDS = 5;
/** In der Luft hat das Kart dem Wind nichts entgegenzusetzen: dort schiebt er um diesen Faktor stärker. */
export const WIND_AIR = 1.4;

/** Stand im Zyklus einer Böe: 0 ≤ c < period; c < on = sie weht. */
function gustCycle(w: Wind, time: number): number {
  const c = (time + w.phase) % w.period;
  return c < 0 ? c + w.period : c;
}

/** Stärke der Böe zur Rennzeit time: 0 = Flaute … 1 = voll. Sie schwillt an und ab – nirgends ein Sprung. */
export function gustStrength(w: Wind, time: number): number {
  const c = gustCycle(w, time);
  return c >= w.on ? 0 : Math.min(1, c / WIND_RISE, (w.on - c) / WIND_RISE);
}

/** 0 = Ruhe … 1 = die Böe setzt gleich ein. */
export function gustWarning(w: Wind, time: number): number {
  const c = gustCycle(w, time);
  return c >= w.period - w.warn ? (c - (w.period - w.warn)) / w.warn : 0;
}

// --- Pontons -------------------------------------------------------------------------
// Schwimmende Stücke der Fahrbahn heben und senken sich mit dem Seegang, jedes in seinem
// eigenen Takt. Zwischen zwei Pontons und zum festen Kai hin liegen gelenkige Übergänge:
// dort läuft die Höhe gleichmäßig vom einen zum anderen. Wer auf dem Kamm ankommt, hebt ab.

/**
 * Ein schwimmendes Stück Fahrbahn – oder eine Hängebrücke (Baumkronenpfad): Die ist an beiden Enden fest und schwingt
 * wie eine gezupfte Saite – in der Mitte am meisten, zu den Enden hin immer weniger (arch). Eine Hängebrücke hebt und
 * senkt sich nicht nur, sie pendelt auch quer (sway): Die Fahrbahn samt Geländer wandert seitlich, und wer auf ihr
 * fährt, wandert mit.
 */
export interface Pontoon {
  /** Erster Abschnitt und Anzahl (zusammenhängend auf einem Weg). */
  first: number;
  count: number;
  /** Ausschlag in Metern, Periode und Versatz in Ticks. */
  amp: number;
  period: number;
  phase: number;
  /** Hängebrücke: Ausschlag über die Länge wie sin(π·u), Enden fest, ohne gelenkige Übergänge davor und dahinter. */
  arch: boolean;
  /** Seitliches Pendeln: Ausschlag in Metern (nach rechts positiv) und Periode in Ticks (0 = pendelt nicht). */
  sway: number;
  swayPeriod: number;
}

/** Länge des Übergangs an jedem Ende eines Pontons (Meter): je zur Hälfte auf ihm und davor. */
export const PONTOON_LINK = 6;

/** So weit liegt der Ponton zur Rennzeit time über (oder unter) seiner Ruhelage. */
export function pontoonLift(p: Pontoon, time: number): number {
  return p.amp * Math.sin(((time + p.phase) / p.period) * 2 * Math.PI);
}

/**
 * So weit ist die Hängebrücke zur Rennzeit time seitlich ausgeschwungen (Meter, nach rechts positiv; in der Mitte – zu den
 * Enden hin gewichtet wie die Höhe). Das Pendeln läuft eine Viertelperiode hinter dem Heben her: Die Brücke zieht in der
 * Mitte eine liegende Acht.
 */
export function pontoonShift(p: Pontoon, time: number): number {
  if (p.sway === 0 || p.swayPeriod <= 0) return 0;
  return p.sway * Math.sin(((time + p.phase) / p.swayPeriod) * 2 * Math.PI - Math.PI / 2);
}

// --- Zeitpläne, Bruchstellen und Tore ------------------------------------------------
// Manche Strecken verändern sich während des Rennens: Platten brechen weg, Wege öffnen
// oder schließen sich. Wann, steht in einem Plan – wie alles hier eine reine Funktion der
// Rennzeit, also auf jedem Gerät gleich.

/**
 * Wann etwas gilt: Zeitspannen [von, bis) in Ticks, paarweise in spans. period = 0: die Spannen
 * zählen einmal ab Rennbeginn (bis darf Infinity sein); sonst wiederholt sich der Plan alle period Ticks.
 */
export interface Plan {
  period: number;
  spans: number[];
}

function planClock(p: Plan, time: number): number {
  if (p.period <= 0) return time;
  // Vor dem Start steht ein wiederkehrender Plan still – auf dem Stand, mit dem das Rennen beginnt.
  return time <= 0 ? 0 : time % p.period;
}

export function planActive(p: Plan, time: number): boolean {
  const c = planClock(p, time);
  for (let i = 0; i < p.spans.length; i += 2) if (c >= p.spans[i] && c < p.spans[i + 1]) return true;
  return false;
}

/** Ticks, bis der Plan das nächste Mal gilt: 0 = er gilt gerade, Infinity = nie mehr. */
export function planUntil(p: Plan, time: number): number {
  const c = planClock(p, time);
  let best = Infinity;
  for (let i = 0; i < p.spans.length; i += 2) {
    if (c >= p.spans[i] && c < p.spans[i + 1]) return 0;
    if (p.spans[i] > c) best = Math.min(best, p.spans[i] - c);
    else if (p.period > 0) best = Math.min(best, p.spans[i] + p.period - c);
  }
  return best;
}

/** Ticks, seit der Plan zuletzt zu gelten begann (er gilt gerade): sonst −1. */
export function planSince(p: Plan, time: number): number {
  const c = planClock(p, time);
  for (let i = 0; i < p.spans.length; i += 2) if (c >= p.spans[i] && c < p.spans[i + 1]) return c - p.spans[i];
  return -1;
}

/**
 * Bruchstelle: ein Stück Fahrbahn (Abschnitte first … first+count−1, seitlich lat0 … lat1), das fehlt,
 * solange sein Plan gilt. Wer darüber gerät, stürzt. In den warn Ticks davor bröckelt es sichtbar.
 */
export interface Hole {
  first: number;
  count: number;
  lat0: number;
  lat1: number;
  plan: Plan;
  warn: number;
}

/**
 * Tor: sperrt den Weg an dieser Stelle über die ganze Breite, solange sein Plan gilt
 * (z. B. eine Lavaröhre, die erst leerläuft, oder eine Brücke, die später einstürzt).
 */
export interface Gate {
  first: number;
  count: number;
  plan: Plan;
  warn: number;
  /** Was die Anzeige meldet, wenn das Tor aufgeht bzw. zugeht ('' = nichts). */
  noteOpen: string;
  noteShut: string;
  /**
   * 0 = das Tor folgt seinem Zeitplan. −1 / +1 = ein Größentor (Riesenkinderzimmer): offen nur für winzige
   * bzw. nur für riesige Karts (KartState.size), für alle anderen läuft die Bande durch – unabhängig von der Zeit.
   */
  only: number;
}

/** So lange vorher kündigt sich ein Bruch bzw. das Schließen eines Tors an (Ticks). */
export const HOLE_WARN = 150;
export const GATE_WARN = 300;

// --- Schrumpfen und Wachsen ----------------------------------------------------------
// Im Riesenkinderzimmer stehen Ringe in der Fahrbahn: Wer durch einen blauen fährt, schrumpft, wer durch einen
// orangen fährt, wächst – für SIZE_TICKS, dann ist das Kart wieder normal. In der Abkürzung, die nur diese
// Größe einlässt, steht die Uhr still; wer sie verlässt, ist zwei Sekunden später wieder normal. Die Größe steht im Zustand des Karts
// (KartState.size: > 0 = so viele Ticks noch riesig, < 0 = so viele Ticks noch winzig).
//   winzig: etwas langsamer, zieht aber schneller an und lenkt enger – und passt durchs Mauseloch.
//   riesig: etwas schneller, träger – und bricht durch die Bauklotz-Mauer; andere Karts schiebt es einfach weg.

/** Ein Ring am Ende des Abschnitts seg, seitlich lat0 … lat1: grow = er lässt wachsen, sonst schrumpfen. */
export interface Sizer {
  seg: number;
  lat0: number;
  lat1: number;
  grow: boolean;
}

/** So lange hält eine Größe (Ticks) – und so lange vorher kündigt sich das Ende an. */
export const SIZE_TICKS = 600;
export const SIZE_WARN = 120;
/** Maßstab eines winzigen bzw. riesigen Karts (Darstellung; die Physik rechnet mit den Faktoren unten). */
export const SIZE_SMALL = 0.6;
export const SIZE_BIG = 1.5;
/** Fahrwerte nach Größe: Höchsttempo, Antritt, Halt in der Kurve. */
export const SMALL_VMAX = 0.92;
export const SMALL_ACCEL = 1.3;
export const SMALL_GRIP = 1.2;
export const BIG_VMAX = 1.07;
export const BIG_ACCEL = 0.85;
export const BIG_GRIP = 0.9;
/** So viel schwerer ist beim Rempeln das größere von zwei verschieden großen Karts. */
export const SIZE_MASS = 5;

/** Größenklasse: −1 winzig, 0 normal, 1 riesig. */
export function sizeClass(size: number): number {
  return size > 0 ? 1 : size < 0 ? -1 : 0;
}

/** Maßstab des Karts für die Darstellung. */
export function sizeScale(size: number): number {
  return size > 0 ? SIZE_BIG : size < 0 ? SIZE_SMALL : 1;
}

// --- Portale -------------------------------------------------------------------------
// Ein Portal steht als Rahmen quer in der Fahrbahn (oder in einem Teil davon). Wer hindurchfährt, solange es
// offen ist, kommt im selben Augenblick an einer anderen Stelle der Strecke heraus – mit demselben Tempo,
// derselben seitlichen Lage und der Richtung der Strecke dort. Ist es zu, ist der Rahmen leer: man fährt
// einfach hindurch. Wann es offen ist, steht in seinem Plan (Rennzeit).

/**
 * Portal am Abschnitt seg (genau: an dessen Ende), seitlich lat0 … lat1; Ausgang am Abschnitt to.
 * plan = null: immer offen. kind 0 führt vorwärts (Abkürzung), 1 zurück (Falle).
 */
export interface Portal {
  seg: number;
  lat0: number;
  lat1: number;
  to: number;
  plan: Plan | null;
  kind: number;
}

/** So lange vorher kündigt ein Portal an, dass es aufgeht bzw. zugeht (Ticks). */
export const PORTAL_WARN = 90;

export function portalOpen(p: Portal, time: number): boolean {
  return p.plan === null || planActive(p.plan, time);
}

/** Ticks, bis ein offenes Portal zugeht (Infinity = es bleibt offen; 0 = es ist zu). */
export function portalLeft(p: Portal, time: number): number {
  if (p.plan === null) return Infinity;
  const c = planClock(p.plan, time);
  for (let i = 0; i < p.plan.spans.length; i += 2) if (c >= p.plan.spans[i] && c < p.plan.spans[i + 1]) return p.plan.spans[i + 1] - c;
  return 0;
}

/** Ticks, bis ein geschlossenes Portal aufgeht (0 = es ist offen; Infinity = nie mehr). */
export function portalUntil(p: Portal, time: number): number {
  return p.plan === null ? 0 : planUntil(p.plan, time);
}

// --- Fluss und Flöße -----------------------------------------------------------------
// Auf einem Flussstück ist die Fahrbahn Wasser. Darauf treiben in Bahnen nebeneinander Flöße flussab – in
// Fahrtrichtung. Boden ist nur, wo gerade ein Floß liegt; wer daneben gerät, geht unter. Ein Floß nimmt mit,
// was auf ihm steht: Zum eigenen Tempo kommt das der Strömung seiner Bahn. Alles hängt allein an der Rennzeit.

/**
 * Eine Bahn von Flößen: seitlich lat0 … lat1 (Meter von der Mitte), Flöße der Länge length mit dem Abstand gap
 * (gap = 0: eine durchgehende Kette), Tempo speed in m/s flussab, Versatz phase in Metern.
 */
export interface RaftLane {
  lat0: number;
  lat1: number;
  length: number;
  gap: number;
  speed: number;
  phase: number;
}

/** Flussstück: Abschnitte first … first+count−1, darauf die Bahnen. */
export interface River {
  first: number;
  count: number;
  lanes: RaftLane[];
}

/** Wie weit die Flöße einer Bahn bis zur Rennzeit time getrieben sind (Meter). Vor dem Start liegen sie still. */
export function raftDrift(l: RaftLane, time: number): number {
  return (l.speed * Math.max(0, time)) / 60;
}

/** Liegt in dieser Bahn an der Stelle a (Meter ab Flussanfang) zur Rennzeit time ein Floß? */
export function raftAt(l: RaftLane, a: number, time: number): boolean {
  if (l.gap <= 0) return true;
  const pitch = l.length + l.gap;
  const u = (a - l.phase - raftDrift(l, time)) % pitch;
  return (u < 0 ? u + pitch : u) < l.length;
}

// --- Schienen ------------------------------------------------------------------------
// Auf dem Achterbahn-Rummel fährt man streckenweise auf Schienen: Das Kart sitzt auf einer von mehreren Schienen
// nebeneinander und rollt wie ein Achterbahnwagen – bergab schießt es los, bergauf verliert es Schwung, den Lifthügel
// zieht die Kette hinauf. Lenken wechselt die Schiene; herunterfallen kann man nicht. (Keine Loopings: Hügel, Täler,
// Steilkurven.)

/** Schienenstück: Abschnitte first … first+count−1. */
export interface Rail {
  first: number;
  count: number;
  /** Seitliche Lage der Schienen (Meter, aufsteigend). */
  lanes: number[];
  /** Kettenlifte: [erster Abschnitt, letzter Abschnitt, Tempo in m/s] – langsamer rollt hier niemand. */
  lifts: [number, number, number][];
  /** Bremsstrecken: [erster Abschnitt, letzter Abschnitt, Tempo in m/s] – schneller verlässt sie niemand. */
  brakes: [number, number, number][];
}

/** Hangabtrieb auf der Schiene: Beschleunigung (m/s²) bei Gefälle 1 (45°). */
export const RAIL_G = 23;
/** Eigener Antrieb auf der Schiene (m/s²) – hilft nur bis RAIL_VGAS. */
export const RAIL_GAS = 5.5;
export const RAIL_VGAS = 21;
/** Schub (Boost, Schubmagnet) auf der Schiene (m/s²). */
export const RAIL_BOOST = 11;
/** Rollwiderstand (m/s²) und Luftwiderstand (· v²). */
export const RAIL_ROLL = 0.7;
export const RAIL_DRAG = 0.0016;
/** Bremse (m/s²). */
export const RAIL_BRAKE = 15;
/** Langsamer als so rollt auf der Schiene nichts (kein Zurückrollen), schneller als so auch nichts. */
export const RAIL_VMIN = 3;
export const RAIL_VMAX = 43;
/** So schnell zieht die Kette auf ihr Tempo, so schnell bremst eine Bremsstrecke (m/s²). */
export const RAIL_CHAIN = 16;
export const RAIL_TRIM = 20;
/** Schienenwechsel: seitliches Tempo (m/s) und ab welchem Lenkeinschlag (0…1) gewechselt wird. */
export const RAIL_SHIFT = 7.5;
export const RAIL_STEER = 0.35;
/** Bis so hoch über der Schiene greift sie ein Kart (Meter) – wer höher fliegt, landet erst. */
export const RAIL_CATCH = 0.7;
/** Schubmagnet: so breit ist seine Schiene für ihn (Meter um die Schienenmitte), so lange wirkt der Schub (Ticks), so viel Tempo gibt es sofort (m/s). */
export const KICK_HALF = 1.1;
export const KICK_TICKS = 50;
export const KICK_SPEED = 3;
/** Mit Schub (Boost, Schubmagnet) zieht die Kette eines Lifts so viel schneller. */
export const LIFT_BOOST = 1.6;

// --- Magnettrommel -------------------------------------------------------------------
// Im Magnetwerk läuft die Fahrbahn an der Innenwand einer riesigen, liegenden Trommel entlang und schraubt sich an ihr
// hoch: erst die rechte Wand hinauf, über die Decke, die linke Wand wieder hinunter. Die Magnete halten die Karts fest
// auf der Bahn – an Wand und Decke fährt es sich wie am Boden (früher sackte man an der Wand ab und rutschte an der Decke;
// das drückte einen an den Rand, gegen das Lenken half kaum etwas). Die Gefahr sind die Deckenplatten, die abschalten.
//
// Gerechnet wird wie überall auf der flachen Fahrbahn. Die Verdrehung (Track.roll, Radiant: 0 = unten, π/2 = rechte
// Wand, π = Decke) ist für die Physik bedeutungslos – sie ist für die Darstellung der Winkel, um den
// sich die Trommel mit allem, was an ihr hängt, um die Fahrbahn dreht (drumPoint in track.ts): Das Bild zeigt die
// Bahn aufrecht und die Halle verdreht – für den Fahrer dasselbe, wie an Wand und Decke zu fahren.

/** Trommelstück: Abschnitte first … first+count−1, Halbmesser der Trommel (Meter). */
export interface Drum {
  first: number;
  count: number;
  radius: number;
}

// --- Schwebeband (Neonhochbahn) -------------------------------------------------------
// Auf einem Schwebeband (Track.bands, EDGE_BAND) schwebt das Kart über einem Magnetband: die Räder klappen weg (nur
// Bild), gefahren wird wie auf Asphalt – auch dort, wo sich das Band an eine Fassade dreht: Gerechnet wird flach, nur
// das Bild wird gedreht (twistWarp in track.ts); die Magnete halten, nichts sackt ab, nichts rutscht. Den Teil der
// Kurve, den man an der Wand im Bild nicht sieht, fährt das Band selbst (sim.ts: twistYaw).
//   – Magnetlinien: Zwei Leuchtspuren schlängeln sich spiegelbildlich über das Band und wandern dabei mit
//     BAND_LINE_SPEED voran. Wer auf einer bleibt, fährt ein wenig schneller (ein leichter Dauerschub). Wo sie liegen, folgt
//     allein aus der Stelle und der Rennzeit – auf jedem Bildschirm gleich.
//   – Sonst fährt sich das Band genau wie Straße: kein Abstoßen, keine Prallpoller (beides gab es früher – es schob die
//     Karts quer über das Band, gegen das Lenken half wenig).

/** Ein Stück Schwebeband: Abschnitte first … first+count−1. */
export interface Band {
  first: number;
  count: number;
}

/** Ausschlag der Magnetlinien als Anteil der halben Bandbreite, Wellenlänge und Tempo (Meter, m/s). */
export const BAND_LINE_K = 0.55;
export const BAND_LINE_WAVE = 84;
export const BAND_LINE_SPEED = 11;
/** So nah (Meter, Kartmitte zur Linie) fährt man „auf“ der Linie. */
export const BAND_LINE_HALF = 0.9;
/** Faktor auf das Höchsttempo auf einer Magnetlinie. */
export const BAND_LINE_PULL = 1.04;
/** So hoch schwebt das Kart über dem Band (nur Bild). */
export const BAND_HOVER = 0.32;

/**
 * Seitliche Lage der Magnetlinie k (0 oder 1) auf einem Schwebeband der halben Breite rh, s Meter nach dessen Anfang,
 * zur Rennzeit time (Ticks). Die beiden Linien sind Spiegelbilder: Sie kreuzen sich alle halbe Wellenlänge in der Mitte.
 */
export function bandLineLat(rh: number, s: number, time: number, k: number): number {
  const a = BAND_LINE_K * rh * Math.sin(((s - (BAND_LINE_SPEED * time) / 60) / BAND_LINE_WAVE) * 2 * Math.PI);
  return k === 0 ? a : -a;
}


// --- Zeitalter -----------------------------------------------------------------------
// Die Zeitriss-Ruine springt im festen Takt zwischen zwei Zeitaltern: „Einst“ (der Tempel steht)
// und „Jetzt“ (er ist zerfallen). Bruchstellen und Tore hängen an einem der beiden – ihre Pläne
// werden beim Bau der Strecke daraus abgeleitet (track.ts), hier steht nur die Uhr.

/** Zeitalter 0 gilt in jeder Periode die ersten split Ticks, Zeitalter 1 den Rest. */
export interface Era {
  period: number;
  split: number;
  /** Kurzname je Zeitalter (Anzeige, Uhr an der Strecke). */
  names: [string, string];
  /** Was die Anzeige meldet, wenn das Zeitalter beginnt. */
  notes: [string, string];
}

/** So lange vorher kündigt sich der Sprung an (Ticks): Gong, Flimmern. */
export const ERA_WARN = 180;

function eraClock(e: Era, time: number): number {
  return time <= 0 ? 0 : time % e.period;
}

/** Welches Zeitalter gilt zur Rennzeit time? (Vor dem Start: das, mit dem das Rennen beginnt.) */
export function eraAt(e: Era, time: number): 0 | 1 {
  return eraClock(e, time) < e.split ? 0 : 1;
}

/** Ticks bis zum nächsten Sprung. */
export function eraUntil(e: Era, time: number): number {
  const c = eraClock(e, time);
  return c < e.split ? e.split - c : e.period - c;
}

/** Ticks, seit das geltende Zeitalter begann. */
export function eraSince(e: Era, time: number): number {
  const c = eraClock(e, time);
  return c < e.split ? c : c - e.split;
}

// --- Geringe Schwerkraft -------------------------------------------------------------
// Auf dem Mond (Track.gravity < 1) fällt alles langsam: jeder Buckel wird zum hohen,
// weiten Sprung – anders als unter Wasser ohne Bremse und ohne Grenze beim Sinken.
// Sprungplatten (Track.launchers) schleudern das Kart hoch, über Krater hinweg.

/** In der Luft lenkt es sich bei geringer Schwerkraft etwas besser (Steuerdüsen): Anteil der Lenkung am Boden. */
export const LOWG_STEER = 0.5;
/** Eine Sprungplatte gibt diese Steiggeschwindigkeit (m/s), wenn nichts anderes angegeben ist. */
export const LAUNCH_SPEED = 9;
