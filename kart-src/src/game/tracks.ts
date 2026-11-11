// Die Strecken des Spiels als reine Beschreibungen (siehe TrackDef in track.ts);
// jede steht in ihrer eigenen Datei unter tracks/.
// Alle Angaben "at/von/bis" sind Stützpunkt-Einheiten: 12.5 = halb zwischen
// Stützpunkt 12 und 13.

import type { TrackDef } from './track';
import { GLUT } from './tracks/glut';
import { KLIPPE } from './tracks/klippe';
import { NACHT } from './tracks/nacht';
import { RIFF } from './tracks/riff';
import { WERKSHOF } from './tracks/werkshof';
import { WOLKEN } from './tracks/wolken';

export const TRACK_DEFS: TrackDef[] = [WERKSHOF, KLIPPE, GLUT, NACHT, WOLKEN, RIFF];
