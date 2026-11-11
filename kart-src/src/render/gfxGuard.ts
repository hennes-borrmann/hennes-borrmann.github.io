// Gedächtnis für Grafik-Abstürze.
//
// Auf einem iPad (10. Generation) beendet Safari die 3D-Grafik, während das erste
// Bild eines Rennens entsteht – ohne Fehlermeldung, und danach liefert derselbe
// Tab nur noch verlorene Kontexte. Von außen ist nicht zu sehen, welches Teil der
// Szene das auslöst. Deshalb wird das erste Bild Teil für Teil vorbereitet
// (raceScene.ts, „behutsamer Aufbau“), und vor jedem Teil steht hier im
// Speicher des Browsers, was gerade an der Reihe ist. Stirbt die Grafik, bleibt
// der Eintrag stehen: Beim nächsten Laden weiß das Spiel, welches Teil es war,
// lässt es aus und nennt es.

import { BUILD_ID } from '../build';

const KEY_STEP = 'schraeglage.gfx.schritt';
const KEY_SKIP = 'schraeglage.gfx.aus';
const KEY_GOOD = 'schraeglage.gfx.gut';
const KEY_SLOW = 'schraeglage.gfx.behutsam';

/** Marke für „alle Teile auf einmal“ (der schnelle Weg, wenn eine Strecke auf diesem Gerät schon einmal gelang). */
export const ALL_AT_ONCE = 'alles auf einmal';

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

/** Diese Strecke/Stufe ist auf diesem Gerät mit dieser Fassung schon einmal vollständig vorbereitet worden. */
export function isKnownGood(where: string): boolean {
  // Ist auf diesem Gerät der schnelle Weg schon einmal gescheitert, bleibt es beim behutsamen.
  if (read<string>(KEY_SLOW, '') === BUILD_ID) return false;
  const g = read<{ build: string; list: string[] }>(KEY_GOOD, { build: BUILD_ID, list: [] });
  return g.build === BUILD_ID && Array.isArray(g.list) && g.list.includes(where);
}

export function markGood(where: string, good = true): void {
  const g = read<{ build: string; list: string[] }>(KEY_GOOD, { build: BUILD_ID, list: [] });
  let list = g.build === BUILD_ID && Array.isArray(g.list) ? g.list.filter((x) => x !== where) : [];
  if (good) list = [...list, where];
  write(KEY_GOOD, { build: BUILD_ID, list });
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
  if (m.label === ALL_AT_ONCE) {
    // Der schnelle Weg ist gescheitert: auf diesem Gerät künftig immer Teil für Teil
    // (sonst wechselten sich „gelungen“ und „gestorben“ bei jedem Laden ab).
    markGood(m.where, false);
    write(KEY_SLOW, BUILD_ID);
  } else {
    const labels = skipList();
    for (const l of [m.prev, m.label]) if (l && !labels.includes(l)) labels.push(l);
    write(KEY_SKIP, { build: BUILD_ID, labels });
  }
  return { label: m.label, prev: m.prev || '', where: m.where || '' };
}
