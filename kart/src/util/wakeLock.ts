// Bildschirm wach halten.
//
// Bevorzugt die Wake Lock API (Chrome/Android, Safari ab iOS 16.4). Der Browser
// gibt die Sperre frei, sobald die Seite in den Hintergrund geht – deshalb
// holen wir sie bei jeder Rückkehr neu. Ohne die API springt NoSleep.js ein,
// das ein unsichtbares, stummes Video abspielt.
//
// Beides braucht eine Nutzeraktion (Tipp/Klick) als Auslöser.

import NoSleep from 'nosleep.js';

type Mode = 'none' | 'native' | 'video';

let mode: Mode = 'none';
let wanted = false;
let sentinel: WakeLockSentinel | null = null;
let noSleep: NoSleep | null = null;
let listening = false;

async function acquireNative(): Promise<boolean> {
  if (!('wakeLock' in navigator)) return false;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
    return true;
  } catch {
    return false;
  }
}

async function acquireVideo(): Promise<boolean> {
  // Bewusst kein nachgeladenes Modul: das Abspielen muss noch innerhalb der
  // Tipp-Geste beginnen, ein Netzabruf dazwischen würde sie verfallen lassen.
  try {
    if (!noSleep) noSleep = new NoSleep();
    await noSleep.enable();
    return true;
  } catch {
    return false;
  }
}

/** Aus einem Klick-/Tipp-Handler heraus aufrufen. Liefert, welcher Weg aktiv ist. */
export async function keepAwake(): Promise<Mode> {
  wanted = true;
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', () => {
      if (wanted && document.visibilityState === 'visible' && mode === 'native' && !sentinel) {
        void acquireNative();
      }
    });
  }
  if (sentinel || mode === 'video') return mode;
  if (await acquireNative()) mode = 'native';
  else if (await acquireVideo()) mode = 'video';
  else mode = 'none';
  return mode;
}

export function wakeLockMode(): Mode {
  return mode;
}
