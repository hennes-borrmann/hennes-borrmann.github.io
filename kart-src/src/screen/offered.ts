// Welche Strecken die Lobby anbietet: die veröffentlichten – oder, mit dem
// Test-Schalter ?alle=1 an der Adresse des Bildschirms, auch die noch unfertigen.

import { TRACK_COUNT } from '../game/track';
import { RELEASED_TRACKS } from '../game/tracks';

export const OFFERED_TRACKS: number =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('alle') ? TRACK_COUNT : Math.min(TRACK_COUNT, RELEASED_TRACKS);
