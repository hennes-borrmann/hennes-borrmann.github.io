// Darstellung der Streckenmechanik (game/mechanics.ts): Verkehr, Geysire,
// Lavabomben, Lavaschwall. Anders als die Kulisse (life.ts) greift das hier
// ins Rennen ein – deshalb läuft alles im Takt der Rennzeit, nicht der Uhr des
// Bildschirms: was hier zu sehen ist, steht genau dort, wo die Physik es hat.

import type * as THREE from 'three';
import type { Track } from '../game/track';
import type { RenderEntity } from '../game/view';
import type { FxSink } from './fxApi';
import type { World } from './world';
import { PULSE_AVALANCHE, PULSE_BOMB, PULSE_BUBBLE, PULSE_ICICLE, PULSE_METEOR, PULSE_PRESS, PULSE_VENT } from '../game/mechanics';
import { buildDive } from './mechanics/dive';
import { buildFlight, hasGlide } from './mechanics/flight';
import { buildHarbor } from './mechanics/harbor';
import { buildLava } from './mechanics/lava';
import { buildMachines } from './mechanics/machines';
import { buildMirrors } from './mechanics/mirrors';
import { buildMoon } from './mechanics/moon';
import { buildRift } from './mechanics/rift';
import { buildRiver } from './mechanics/river';
import { buildDrum } from './mechanics/drum';
import { buildBand } from './mechanics/band';
import { buildMetro } from './mechanics/metro';
import { buildAtrium } from './mechanics/atrium';
import { buildDam } from './mechanics/dam';
import { buildMine } from './mechanics/mine';
import { buildCanopy } from './mechanics/canopy';
import { buildRails } from './mechanics/rails';
import { buildSizers } from './mechanics/sizers';
import { buildSnow } from './mechanics/snow';
import { buildStorm } from './mechanics/storm';
import { buildTide } from './mechanics/tide';
import { buildTraffic } from './mechanics/traffic';
import { buildTrain } from './mechanics/train';
import { buildVolcano } from './mechanics/volcano';

export interface MechanicView {
  readonly group: THREE.Group;
  /**
   * Pro Bild.
   * @param time    Rennzeit in Ticks seit "Los" (gebrochen, im Countdown negativ) – RaceView.time
   * @param seconds Sekunden seit Aufbau der Szene (für Flackern und andere reine Zierde)
   * @param cam     Kameraposition
   * @param fx      Teilchen der Szene (fxApi.ts)
   */
  update(time: number, seconds: number, dt: number, cam: THREE.Vector3, fx: FxSink): void;
  /**
   * Wahlweise, je Bild nach update: wo die Karts gerade sind (Lage, Größe …). Nur für Zierde, die auf Karts
   * antwortet – etwa die Bauklotz-Mauer, die auseinanderfliegt, wenn ein riesiges Kart hindurchbricht. Was die
   * Physik angeht, bleibt eine reine Funktion der Rennzeit.
   */
  observe?(karts: readonly RenderEntity[], dt: number, fx: FxSink): void;
  dispose(): void;
}

/**
 * Alles, was die Strecke an Mechanik hat. detail = false auf schwachen Geräten: weniger Zierde, gleiche Hindernisse.
 * world: die stehende Welt der Strecke – die Gezeiten heben und senken ihr Meer.
 */
export function buildMechanics(track: Track, detail: boolean, world: World): MechanicView[] {
  const out: MechanicView[] = [];
  if (track.vehicles.some((v) => !v.roofs)) out.push(buildTraffic(track, detail));
  // (Die U-Bahn der Neonhochbahn zeichnet mechanics/metro.ts.)
  if (track.roofed && track.vehicles.some((v) => v.roofs && !v.plan)) out.push(buildTrain(track, detail));
  if (track.bands.length > 0) out.push(buildBand(track, detail));
  if (track.metro) out.push(buildMetro(track, detail));
  // Neonhochbahn: der Atriumturm um die Abkürzung mit Risiko
  if (track.def.theme === 'neon') {
    const k = track.def.branches?.findIndex((b) => b.shortcut === 'risk') ?? -1;
    if (k >= 0) out.push(buildAtrium(track, k));
  }
  // Talsperre: Staumauer, Überlaufrinne, Schleuse und Krafthaus (das Band an der Mauer zeichnet mechanics/band.ts)
  if (track.def.theme === 'talsperre') out.push(buildDam(track, detail, world));
  // Baumkronenpfad: Hängebrücken, Riesen und Holzböcke, der hohle Baumriese, Wasserfall und Teich, Tannenzapfen
  if (track.def.theme === 'baum') out.push(buildCanopy(track, detail, world));
  const presses = track.pulses.some((p) => p.kind === PULSE_PRESS);
  if (track.pulses.some((p) => p.kind === PULSE_VENT || p.kind === PULSE_BOMB) || track.floods.length > 0) out.push(buildLava(track, detail));
  // (Im Dschungel ist ein „Band“ die Querströmung der Furt: die zeichnet mechanics/river.ts.)
  // (Auf der Talsperre ist es das Wasser über der Wehrkrone: das zeichnet mechanics/dam.ts.)
  if ((track.belts.some((b) => !b.swim) && track.def.theme !== 'dschungel' && track.def.theme !== 'talsperre') || presses) out.push(buildMachines(track, detail));
  if (track.tide) out.push(buildTide(track, detail, world));
  if (track.thermals.length > 0 || track.rings.length > 0 || hasGlide(track)) out.push(buildFlight(track, detail));
  if (track.belts.some((b) => b.swim) || track.pulses.some((p) => p.kind === PULSE_BUBBLE)) out.push(buildDive(track, detail));
  // (Auf dem Baumkronenpfad fallen statt Eiszapfen Tannenzapfen: die zeichnet mechanics/canopy.ts.)
  if (track.def.theme !== 'baum' && track.pulses.some((p) => p.kind === PULSE_AVALANCHE || p.kind === PULSE_ICICLE)) out.push(buildSnow(track, detail));
  if (track.launchers.length > 0 || track.pulses.some((p) => p.kind === PULSE_METEOR)) out.push(buildMoon(track, detail));
  // (Die Hängebrücken des Baumkronenpfads zeichnet mechanics/canopy.ts.)
  if (track.winds.length > 0 || (track.pontoons.length > 0 && track.def.theme !== 'baum')) out.push(buildHarbor(track, detail));
  if (track.dark) out.push(buildStorm(track, detail, world));
  if (track.rivers.length > 0) out.push(buildRiver(track, detail));
  if (track.portals.length > 0) out.push(buildMirrors(track, detail));
  if (track.sizers.length > 0) out.push(buildSizers(track, detail));
  if (track.rails.length > 0) out.push(buildRails(track, detail));
  // Kristallmine: Sprengladungen, die Weiche zum Sprengort mit Signal und Geröll, der Querschlag der Lore
  if (track.def.theme === 'kristall') out.push(buildMine(track, detail));
  if (track.drums.length > 0) out.push(buildDrum(track, detail));
  if (track.era) out.push(buildRift(track, detail));
  // (Im Magnetwerk zeichnet die Trommel ihre Magnetplatten selbst.)
  // (Das Tor der U-Bahn zeigt mechanics/metro.ts.)
  // (Das Tor der Schleuse auf der Talsperre zeigt mechanics/dam.ts, die Weiche der Kristallmine mechanics/mine.ts.)
  else if (track.drums.length === 0 && !track.metro && track.def.theme !== 'talsperre' && track.def.theme !== 'kristall' && (track.holes.length > 0 || track.gates.some((g) => g.only === 0))) out.push(buildVolcano(track, detail));
  return out;
}
