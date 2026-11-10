// Einstellungen des Controllers, pro Handy gespeichert.

export type SteerMode = 'tilt' | 'touch';

export interface ControllerSettings {
  /** 1 (träge, großer Lenkwinkel) bis 9 (direkt, kleiner Lenkwinkel) */
  sensitivity: number;
  /** Totzone um die Mitte als Anteil des Vollausschlags, 0..0.15 */
  deadzone: number;
  invert: boolean;
  mode: SteerMode;
}

const KEY = 'kart.controller.settings';

/** Neigungswinkel in Grad, bei dem die Lenkung voll eingeschlagen ist. */
const ANGLES = [60, 53, 47, 41, 36, 31, 27, 23, 20];

export const DEFAULT_SETTINGS: ControllerSettings = { sensitivity: 5, deadzone: 0.05, invert: false, mode: 'tilt' };

export function maxAngle(sensitivity: number): number {
  return ANGLES[Math.max(1, Math.min(9, Math.round(sensitivity))) - 1];
}

export function loadSettings(): ControllerSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<ControllerSettings>;
    return {
      sensitivity: Math.max(1, Math.min(9, Number(s.sensitivity) || DEFAULT_SETTINGS.sensitivity)),
      deadzone: Math.max(0, Math.min(0.15, Number(s.deadzone ?? DEFAULT_SETTINGS.deadzone))),
      invert: !!s.invert,
      mode: s.mode === 'touch' ? 'touch' : 'tilt',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: ControllerSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* egal */
  }
}
