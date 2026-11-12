// Die Strecken des Spiels als reine Beschreibungen (siehe TrackDef in track.ts);
// jede steht in ihrer eigenen Datei unter tracks/.
// Alle Angaben "at/von/bis" sind Stützpunkt-Einheiten: 12.5 = halb zwischen
// Stützpunkt 12 und 13.

import type { TrackDef } from './track';
import { EIS } from './tracks/eis';
import { GLUT } from './tracks/glut';
import { HAFEN } from './tracks/hafen';
import { KLIPPE } from './tracks/klippe';
import { MOND } from './tracks/mond';
import { NACHT } from './tracks/nacht';
import { RIFF } from './tracks/riff';
import { FLUSS } from './tracks/fluss';
import { KAMM } from './tracks/kamm';
import { RUINE } from './tracks/ruine';
import { SPIEGEL } from './tracks/spiegel';
import { VULKAN } from './tracks/vulkan';
import { WERKSHOF } from './tracks/werkshof';
import { WOLKEN } from './tracks/wolken';

export const TRACK_DEFS: TrackDef[] = [WERKSHOF, KLIPPE, GLUT, NACHT, WOLKEN, RIFF, EIS, MOND, HAFEN, VULKAN, RUINE, KAMM, FLUSS, SPIEGEL];

/**
 * So viele Strecken (von vorn gezählt) stehen in der Lobby zur Wahl. Was dahinter
 * stünde, wäre noch in Arbeit – zu erreichen nur mit dem Test-Schalter ?alle=1.
 * Zurzeit sind die ersten zwölf freigegeben.
 */
export const RELEASED_TRACKS = 14;
