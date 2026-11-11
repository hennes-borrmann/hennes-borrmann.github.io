// Gedächtnis für Grafik-Abstürze.
//
// Auf einem iPad (10. Generation) beendet Safari die 3D-Grafik, während das erste
// Bild eines Rennens entsteht – ohne Fehlermeldung, und danach liefert derselbe
// Tab nur noch verlorene Kontexte. Von außen ist nicht zu sehen, welches Teil der
// Szene das auslöst. Mit dem Test-Schalter ?aufbau=behutsam wird das erste Bild
// deshalb Teil für Teil vorbereitet (raceScene.ts), und vor jedem Teil steht hier im
// Speicher des Browsers, was gerade an der Reihe ist. Stirbt die Grafik, bleibt
// der Eintrag stehen: Beim nächsten Laden weiß das Spiel, welches Teil es war,
// lässt es aus und nennt es.

import { BUILD_ID } from '../build';

const KEY_STEP = 'schraeglage.gfx.schritt';
const KEY_SKIP = 'schraeglage.gfx.aus';

let careful = false;

/** Test-Schalter ?aufbau=behutsam: das erste Bild Teil für Teil vorbereiten und Buch führen. */
export function setCareful(on: boolean): void {
  careful = on;
}

export function isCareful(): boolean {
  return careful;
}

export interface GfxCrash {
  /** Das Teil, das gerade vorbereitet wurde, als die Grafik starb. */
  label: string;
  /** Das Teil davor (falls der Browser den Absturz erst einen Schritt später bemerkt hat). */
  prev: string;
  /** Strecke und Qualitätsstufe. */
  where: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Kein Speicher (privates Surfen): dann eben ohne Gedächtnis.
  }
}

/** Teile, die auf diesem Gerät die Grafik beendet haben – sie gelten nur für diese Fassung des Spiels. */
export function skipList(): string[] {
  const s = read<{ build: string; labels: string[] }>(KEY_SKIP, { build: BUILD_ID, labels: [] });
  return s.build === BUILD_ID && Array.isArray(s.labels) ? s.labels : [];
}

/** Vor einem Teil: festhalten, was jetzt an der Reihe ist. */
export function markStep(label: string, prev: string, where: string): void {
  write(KEY_STEP, { build: BUILD_ID, label, prev, where });
}

/** Alles gut gegangen (oder die Seite wird regulär verlassen): Marke weg. */
export function clearStep(): void {
  write(KEY_STEP, null);
}

/**
 * Beim Laden der Seite: Steht noch eine Marke vom letzten Mal? Dann ist die Grafik dort gestorben.
 * Das Teil (und das davor) kommt auf die Liste der ausgelassenen Teile; die Marke wird entfernt.
 */
export function readCrash(): GfxCrash | null {
  const m = read<{ build: string; label: string; prev: string; where: string } | null>(KEY_STEP, null);
  if (!m || typeof m.label !== 'string') return null;
  clearStep();
  if (m.build !== BUILD_ID) return null;
  const labels = skipList();
  for (const l of [m.prev, m.label]) if (l && !labels.includes(l)) labels.push(l);
  write(KEY_SKIP, { build: BUILD_ID, labels });
  return { label: m.label, prev: m.prev || '', where: m.where || '' };
}
