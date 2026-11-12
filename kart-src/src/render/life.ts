// Leben in den Welten: alles, was sich abseits der Strecke von selbst bewegt –
// ausbrechende Vulkane, Möwen, Kräne, Verkehr. Reine Kulisse: nichts davon
// berührt die Fahrbahn oder greift ins Rennen ein.
//
// Jede Welt hat ihre eigene Datei unter life/. Sie bekommt die fertige Welt
// (Gelände, Thema, Strecke) und liefert eine Gruppe samt update().

import type * as THREE from 'three';
import type { FxSink } from './fxApi';
import { buildEisLife } from './life/eis';
import { buildGlutLife } from './life/glut';
import { buildKlippeLife } from './life/klippe';
import { buildMondLife } from './life/mond';
import { buildHafenLife } from './life/hafen';
import { buildDschungelLife } from './life/dschungel';
import { buildSpiegelLife } from './life/spiegel';
import { buildWuesteLife } from './life/wueste';
import { buildGewitterLife } from './life/gewitter';
import { buildRuineLife } from './life/ruine';
import { buildVulkanLife } from './life/vulkan';
import { buildNachtLife } from './life/nacht';
import { buildRiffLife } from './life/riff';
import { buildWerkshofLife } from './life/werkshof';
import { buildWolkenLife } from './life/wolken';
import type { World } from './world';

export interface Life {
  readonly group: THREE.Group;
  /**
   * Pro Bild. time = Sekunden seit Aufbau der Szene, cam = Kameraposition,
   * fx = Teilchen der Szene (Funken und Comic-Bällchen, siehe fxApi.ts),
   * raceTime = Rennzeit in Ticks (60 je Sekunde, im Countdown negativ) – für Kulissen,
   * die mit der Strecke gehen (die Zeitriss-Ruine wechselt mit dem Zeitalter ihr Gesicht).
   */
  update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink, raceTime?: number): void;
  dispose(): void;
}

export function buildLife(world: World): Life | null {
  switch (world.track.def.theme) {
    case 'werkshof':
      return buildWerkshofLife(world);
    case 'klippe':
      return buildKlippeLife(world);
    case 'glut':
      return buildGlutLife(world);
    case 'nacht':
      return buildNachtLife(world);
    case 'wolken':
      return buildWolkenLife(world);
    case 'riff':
      return buildRiffLife(world);
    case 'eis':
      return buildEisLife(world);
    case 'mond':
      return buildMondLife(world);
    case 'hafen':
      return buildHafenLife(world);
    case 'vulkan':
      return buildVulkanLife(world);
    case 'ruine':
      return buildRuineLife(world);
    case 'gewitter':
      return buildGewitterLife(world);
    case 'dschungel':
      return buildDschungelLife(world);
    case 'spiegel':
      return buildSpiegelLife(world);
    case 'wueste':
      return buildWuesteLife(world);
    default:
      return null;
  }
}
