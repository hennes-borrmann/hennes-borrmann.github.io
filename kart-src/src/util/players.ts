// Farben der vier Plätze. Sie hängen fest am Platz, damit Bildschirm, Handy
// und 3D-Szene ohne Absprache dieselbe Farbe zeigen.

export const PLAYER_COLORS = ['#ff5a4e', '#1fc8b6', '#ffd23f', '#9b87ff'] as const;
export const PLAYER_COLOR_NAMES = ['Rot', 'Türkis', 'Gelb', 'Violett'] as const;

export function playerColor(slot: number): string {
  return PLAYER_COLORS[slot] ?? '#9aa3ad';
}
