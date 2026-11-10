// Einstieg für den Handy-Controller.
//
// Ablauf: QR-Code öffnet diese Seite mit ?s=<Kennung des Bildschirms>.
// "Tippen zum Starten" holt (auf iOS) die Sensor-Erlaubnis und hält den
// Bildschirm wach, danach wird kalibriert, dann erscheinen die Tasten.
// Die Verbindung zum Bildschirm wird schon beim Laden aufgebaut.

import '../styles/controller.css';
import { BUILD_ID } from '../build';
import { BTN_ITEM } from '../game/sim';
import { SCREEN_ID_LENGTH, isValidCode, normalizeCode } from '../net/codes';
import { readDebugParams } from '../net/debugParams';
import type { LinkOptions } from '../net/link';
import { loadNetSetup } from '../net/netConfig';
import { CTRL_INPUT_SIZE, writeCtrlInput, type FxKind } from '../net/protocol';
import { $, ms } from '../util/dom';
import { ITEMS, ROLLING_ICON, itemSvg } from '../util/items';
import { playerColor } from '../util/players';
import { keepAwake } from '../util/wakeLock';
import { ScreenConnection } from './connection';
import { TouchPad } from './pad';
import { loadSettings, maxAngle, saveSettings } from './settings';
import { TiltSteering } from './tilt';

type ScreenName = 'boot' | 'nocode' | 'start' | 'calibrate' | 'pad';

/** Sensorwerte lösen das Senden aus; öfter als so schicken wir aber nicht. */
const MIN_SEND_GAP_MS = 12;
/** Kommt kein Sensorwert, sorgt ein Timer für mindestens diese Rate. */
const MAX_SEND_GAP_MS = 18;

const root = $('ctl');
const debug = readDebugParams();
const settings = loadSettings();
const tilt = new TiltSteering(settings);
const pad = new TouchPad($('pad'));

let conn: ScreenConnection | null = null;
/** Seit wann besteht keine Verbindung zum Bildschirm (performance.now)? */
let offlineSince = performance.now();
let started = false;
/** Neigungssensor steht nicht zur Verfügung (verweigert oder nicht vorhanden). */
let tiltBlocked = false;
let seq = 0;
let itemCount = 0;
let lastSend = 0;
let sent = 0;
let sentPrev = 0;
let eventsPrev = 0;
let sendHz = 0;
let sensorHz = 0;
const packet = new ArrayBuffer(CTRL_INPUT_SIZE);
const packetView = new DataView(packet);

function show(name: ScreenName): void {
  root.dataset.screen = name;
}

function current(): ScreenName {
  return root.dataset.screen as ScreenName;
}

function useTilt(): boolean {
  return settings.mode === 'tilt' && !tiltBlocked && tilt.active;
}

function steerValue(): number {
  return useTilt() ? tilt.value : pad.touchSteer;
}

// --- Senden ----------------------------------------------------------------

function sendNow(now: number): void {
  if (!conn || !conn.connected || !started) return;
  lastSend = now;
  seq = (seq + 1) & 0xffff;
  writeCtrlInput(packetView, seq, Math.round(steerValue() * 127), pad.buttons, itemCount);
  conn.sendFast(packet);
  sent++;
}

pad.onChange = (buttons, previous) => {
  if ((buttons & BTN_ITEM) !== 0 && (previous & BTN_ITEM) === 0) {
    itemCount = (itemCount + 1) & 0xff;
    conn?.send({ t: 'press', n: itemCount });
  }
  // Tastenwechsel sofort schicken, nicht erst mit dem nächsten Takt.
  sendNow(performance.now());
};

// Direkt nach jedem Sensorwert senden: so liegt zwischen Messung und Paket
// keine zusätzliche Wartezeit.
tilt.onSample = (now) => {
  if (now - lastSend >= MIN_SEND_GAP_MS) sendNow(now);
};

window.setInterval(() => {
  const now = performance.now();
  tilt.checkAlive(now);
  if (now - lastSend >= MAX_SEND_GAP_MS) sendNow(now);
}, 6);

window.setInterval(() => {
  sendHz = sent - sentPrev;
  sentPrev = sent;
  sensorHz = tilt.events - eventsPrev;
  eventsPrev = tilt.events;
  // Kommen später doch noch Sensorwerte (Erlaubnis nachträglich erteilt),
  // geben wir die Neigungslenkung frei. Ohne Kalibrierung gilt "waagerecht = geradeaus".
  if (started && tiltBlocked && tilt.active) {
    tiltBlocked = false;
    applyMode();
  }
  conn?.send({ t: 'info', tilt: useTilt(), sensorHz, sendHz });
  // Hinweistexte bei langem Verbindungsaufbau aktualisieren.
  if (conn && !conn.connected) renderConnection();
}, 1000);

// --- Querformat erzwingen ---------------------------------------------------

function updateRotation(): void {
  // Steht die Seite hochkant (z. B. wegen der Ausrichtungssperre), drehen wir
  // die Oberfläche selbst – passend dazu, welche Kante des Handys oben ist.
  const portrait = window.innerHeight > window.innerWidth;
  document.documentElement.dataset.rot = !portrait ? 'none' : tilt.side === 1 ? 'cw' : 'ccw';
}

window.addEventListener('resize', updateRotation);
window.addEventListener('orientationchange', updateRotation);
tilt.onSideChange = updateRotation;
updateRotation();

// --- Start ------------------------------------------------------------------

type Permission = 'granted' | 'denied' | 'unclear' | 'unavailable' | 'insecure';

interface OrientationEventStatic {
  requestPermission?: () => Promise<string>;
}

/**
 * Fragt (wo nötig) nach dem Bewegungssensor. iOS verlangt den Aufruf zwingend
 * aus einer Tipp-Geste. Auch neuere Chrome-Versionen kennen die Funktion und
 * antworten teils mit "prompt" statt "granted" – das Ergebnis ist deshalb nur
 * ein Hinweis. Ob die Lenkung funktioniert, entscheidet sich daran, ob
 * anschließend wirklich Sensorwerte ankommen.
 */
async function requestMotionPermission(): Promise<Permission> {
  if (!window.isSecureContext) return 'insecure';
  const DOE = (window as unknown as { DeviceOrientationEvent?: OrientationEventStatic }).DeviceOrientationEvent;
  if (!DOE) return 'unavailable';
  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      if (result === 'granted') return 'granted';
      return result === 'denied' ? 'denied' : 'unclear';
    } catch {
      return 'unclear';
    }
  }
  return 'granted';
}

function tryFullscreen(): void {
  // Android: Vollbild und Querformat sperren. iPhone-Safari kann beides nicht.
  const el = document.documentElement;
  if (!el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => undefined);
}

function waitForTilt(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const poll = (): void => {
      if (tilt.active) resolve(true);
      else if (performance.now() - t0 > timeoutMs) resolve(false);
      else window.setTimeout(poll, 50);
    };
    poll();
  });
}

async function start(): Promise<void> {
  const btn = $<HTMLButtonElement>('btn-start');
  btn.disabled = true;
  // Alles hier muss direkt in der Tipp-Geste angestoßen werden. Die Sensor-
  // Erlaubnis zuerst: sie ist das Wichtigste, und manche Browser lassen pro
  // Geste nur eine solche Anfrage zu.
  const permissionRequest = requestMotionPermission();
  void keepAwake();
  tryFullscreen();
  const permission = await permissionRequest;
  let sensor = false;
  if (permission !== 'insecure' && permission !== 'unavailable') {
    tilt.start();
    sensor = await waitForTilt(permission === 'denied' ? 500 : 1500);
  }
  started = true;
  btn.disabled = false;

  if (sensor) {
    tiltBlocked = false;
    applyMode();
    show(settings.mode === 'tilt' ? 'calibrate' : 'pad');
    return;
  }

  tiltBlocked = true;
  const reasons: Record<Permission, string> = {
    denied:
      'Der Bewegungssensor wurde abgelehnt. iOS fragt erst wieder, wenn du Safari ganz schließt und den QR-Code neu scannst. Bis dahin lenkst du per Touch.',
    insecure: 'Diese Seite läuft nicht über HTTPS – ohne HTTPS gibt der Browser den Bewegungssensor nicht frei. Du lenkst per Touch.',
    unavailable: 'Dieser Browser bietet keinen Bewegungssensor an. Du lenkst per Touch.',
    unclear:
      'Der Bewegungssensor liefert keine Werte. Prüf in den Website-Einstellungen des Browsers, ob „Bewegungssensoren“ erlaubt sind. Bis dahin lenkst du per Touch.',
    granted: 'Der Bewegungssensor liefert keine Werte. Du lenkst per Touch.',
  };
  applyMode();
  show('pad');
  showVeil('Keine Neigungslenkung', reasons[permission], 'Mit Touch-Lenkung fahren', () => hideVeil());
}

$('btn-start').addEventListener('click', () => void start());

$('btn-calibrate').addEventListener('click', () => {
  void keepAwake();
  tilt.calibrate();
  show('pad');
});

$('btn-recal').addEventListener('click', () => {
  tilt.calibrate();
  flash($('btn-recal'), 'Mitte gesetzt');
});

function flash(el: HTMLElement, text: string): void {
  const before = el.textContent;
  el.textContent = text;
  window.setTimeout(() => (el.textContent = before), 900);
}

// --- Einstellungen ----------------------------------------------------------

const setSens = $<HTMLInputElement>('set-sens');
const setDead = $<HTMLInputElement>('set-dead');
const setInvert = $<HTMLInputElement>('set-invert');
const setTouch = $<HTMLInputElement>('set-touch');

function applyMode(): void {
  const touch = settings.mode === 'touch' || tiltBlocked;
  $('pad').classList.toggle('touch', touch);
  setTouch.checked = touch;
  setTouch.disabled = tiltBlocked;
  $<HTMLButtonElement>('btn-recal').hidden = touch;
}

function renderSettings(): void {
  setSens.value = String(settings.sensitivity);
  setDead.value = String(Math.round(settings.deadzone * 100));
  setInvert.checked = settings.invert;
  $('out-sens').textContent = `${settings.sensitivity} · Vollausschlag bei ${maxAngle(settings.sensitivity)}°`;
  $('out-dead').textContent = `${Math.round(settings.deadzone * 100)} %`;
  applyMode();
}

function onSettingsInput(): void {
  settings.sensitivity = Number(setSens.value);
  settings.deadzone = Number(setDead.value) / 100;
  settings.invert = setInvert.checked;
  if (!tiltBlocked) settings.mode = setTouch.checked ? 'touch' : 'tilt';
  saveSettings(settings);
  renderSettings();
}

for (const el of [setSens, setDead, setInvert, setTouch]) el.addEventListener('input', onSettingsInput);
$('btn-settings').addEventListener('click', () => ($('sheet').hidden = false));
$('btn-sheet-close').addEventListener('click', () => ($('sheet').hidden = true));
renderSettings();

// --- Meldungen über der Tastenfläche ---------------------------------------

let veilAction: (() => void) | null = null;
/** Vom Nutzer wegzutippende Meldung offen? Dann überschreibt der Verbindungsstatus sie nicht. */
let veilPinned = false;

function showVeil(title: string, text: string, button: string | null, action: (() => void) | null, pinned = true): void {
  $('veil-title').textContent = title;
  $('veil-text').textContent = text;
  const btn = $<HTMLButtonElement>('veil-btn');
  btn.hidden = !button;
  btn.textContent = button ?? '';
  veilAction = action;
  veilPinned = pinned;
  $('veil').hidden = false;
}

function hideVeil(): void {
  $('veil').hidden = true;
  veilPinned = false;
  veilAction = null;
}

$('veil-btn').addEventListener('click', () => {
  const action = veilAction;
  hideVeil();
  action?.();
});

// --- Anzeige ----------------------------------------------------------------

function renderConnection(): void {
  if (!conn) return;
  const status = $('mid-status');
  const info = conn.paired;
  const chip = $('mid-chip');
  if (info && info.slot >= 0) {
    chip.textContent = String(info.slot + 1);
    chip.style.setProperty('--c', playerColor(info.slot));
    $('mid-name').textContent = info.name || `Spieler ${info.slot + 1}`;
  } else {
    chip.textContent = '';
    chip.style.setProperty('--c', '#3a4048');
    $('mid-name').textContent = info ? 'Bildschirm gekoppelt' : 'Bildschirm';
  }

  if (conn.connected) offlineSince = 0;
  else if (offlineSince === 0) offlineSince = performance.now();
  // Dauert der Aufbau lange, liegt es fast immer am Netz – das früh sagen.
  const slow = !conn.connected && performance.now() - offlineSince > 10_000;
  const slowHint =
    ' Das dauert ungewöhnlich lange: Sind Handy und Bildschirm im selben WLAN? Über Mobilfunk oder in Gäste-/Schulnetzen klappt die Kopplung oft nur mit TURN-Server.';

  $('start-msg').textContent = conn.buildMismatch
    ? 'Handy und Bildschirm nutzen unterschiedliche Fassungen der Seite. Bitte auf beiden Geräten die Seite neu laden.'
    : '';

  const target = $('start-target');
  if (conn.connected) {
    const who = info && info.slot >= 0 ? `${info.name} (Platz ${info.slot + 1})` : 'deinem Bildschirm';
    target.textContent = `Verbunden mit ${who}.`;
    target.dataset.tone = 'ok';
  } else if (conn.status === 'searching') {
    target.textContent = 'Bildschirm nicht erreichbar. Ist die Seite dort noch offen? Ich versuche es weiter …';
    target.dataset.tone = 'warn';
  } else {
    target.textContent =
      (conn.signalingOnline ? 'Verbinde mit deinem Bildschirm …' : 'Verbinde mit dem Signaling-Server …') + (slow ? slowHint : '');
    target.dataset.tone = 'warn';
  }

  if (conn.connected) {
    status.dataset.tone = 'ok';
    if (!veilPinned) hideVeil();
  } else {
    status.dataset.tone = 'bad';
    status.textContent = 'getrennt';
    if (current() !== 'pad' && current() !== 'calibrate') return;
    if (conn.status === 'replaced') {
      showVeil('Ein anderes Handy steuert jetzt', 'Der QR-Code dieses Bildschirms wurde von einem anderen Handy gescannt.', 'Steuerung zurückholen', () => conn?.takeOver(), true);
    } else if (conn.status === 'version') {
      showVeil('Versionen passen nicht', 'Lade die Seite auf dem Bildschirm und auf dem Handy neu.', null, null, true);
    } else if (!veilPinned) {
      showVeil(
        'Verbindung unterbrochen',
        conn.status === 'searching'
          ? 'Der Bildschirm ist gerade nicht erreichbar. Ich verbinde automatisch neu, sobald er wieder da ist.' + (slow ? slowHint : '')
          : 'Verbinde neu …' + (slow ? slowHint : ''),
        null,
        null,
        false,
      );
    }
  }
}

// --- Rennen: Anzeige und spürbare Rückmeldung --------------------------------

let lastHudKey = '';
function renderHud(): void {
  const hud = conn?.hud ?? null;
  const racing = !!hud && hud.racing;
  $('mid-race').hidden = !racing;
  const key = hud ? `${hud.racing}|${hud.item}|${hud.rolling}|${hud.place}|${hud.lap}|${hud.laps}` : '';
  if (key === lastHudKey) return;
  lastHudKey = key;
  const box = $('pad-item');
  const info = hud && !hud.rolling ? ITEMS[hud.item] : undefined;
  box.dataset.state = hud?.rolling ? 'rolling' : info ? 'ready' : 'none';
  $('pad-item-icon').innerHTML = hud?.rolling ? itemSvg(ROLLING_ICON) : info ? itemSvg(info.icon) : '';
  $('pad-item-name').textContent = hud?.rolling ? '…' : info ? info.name : 'Item';
  if (hud) {
    $('mid-place').textContent = hud.place > 0 ? `${hud.place}.` : '–';
    $('mid-lap').textContent = hud.laps > 0 ? `Runde ${hud.lap}/${hud.laps}` : '';
  }
}

/** Vibrationsmuster in Millisekunden (Pause/Dauer abwechselnd bei Listen). */
const VIBRATION: Record<FxKind, number | number[]> = {
  hit: [0, 90, 50, 150],
  bump: 35,
  wall: 30,
  boost: 45,
  pickup: 20,
  item: [0, 25, 40, 25],
  go: 70,
  finish: [0, 70, 60, 70, 60, 150],
  block: [0, 40, 30, 40],
  stall: [0, 30, 40, 30, 40, 30, 40, 30],
  land: 40,
  fall: [0, 160],
  lap: 30,
  finallap: [0, 40, 50, 40, 50, 90],
};

const FLASH_TONE: Record<FxKind, string> = {
  hit: 'bad',
  bump: 'plain',
  wall: 'plain',
  boost: 'boost',
  pickup: 'item',
  item: 'item',
  go: 'go',
  finish: 'go',
  block: 'item',
  stall: 'bad',
  land: 'plain',
  fall: 'bad',
  lap: 'go',
  finallap: 'go',
};

function feedback(kind: FxKind): void {
  // Android vibriert; iPhone-Safari kann das nicht, dort blitzt der Rand auf.
  try {
    navigator.vibrate?.(VIBRATION[kind]);
  } catch {
    /* egal */
  }
  const flash = $('flash');
  flash.dataset.tone = FLASH_TONE[kind];
  flash.classList.remove('on');
  void flash.offsetWidth;
  flash.classList.add('on');
}

let lastText = 0;
function frame(): void {
  requestAnimationFrame(frame);
  const steer = steerValue();
  $('meter-marker').style.transform = `translateX(${(steer * 50).toFixed(2)}%)`;

  if (current() === 'calibrate') {
    // Linie zeigt die aktuelle Schräglage; die feste Linie ist "gerade".
    $('horizon-line').style.transform = `rotate(${tilt.angle.toFixed(1)}deg)`;
    $('horizon-deg').textContent = `${Math.round(tilt.angle)}°`;
  }

  const now = performance.now();
  if (now - lastText > 300) {
    lastText = now;
    if (conn?.connected && conn.link) {
      $('mid-status').textContent = `verbunden · Ping ${ms(conn.link.rtt)}`;
    }
    const src = useTilt() ? `Neigung ${sensorHz} Hz` : 'Touch-Lenkung';
    $('mid-rates').textContent = conn?.buildMismatch
      ? 'Andere Version als der Bildschirm – bitte beide Seiten neu laden'
      : conn?.hud?.racing
        ? `${src} · sendet ${sendHz}/s`
        : `${src} · sendet ${sendHz}/s · ${BUILD_ID}`;
  }
}

// --- Aufbau -----------------------------------------------------------------

// Zoom-Gesten und Kontextmenü stören beim Spielen.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Seite wird geschlossen oder neu geladen: dem Bildschirm sofort Bescheid geben.
window.addEventListener('pagehide', () => {
  conn?.send({ t: 'bye' });
  conn?.link?.close();
});

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const screenId = normalizeCode(params.get('s') ?? '');
  if (!isValidCode(screenId, SCREEN_ID_LENGTH)) {
    show('nocode');
    const go = (): void => {
      const code = normalizeCode($<HTMLInputElement>('in-screen').value);
      if (!isValidCode(code, SCREEN_ID_LENGTH)) return;
      const url = new URL(location.href);
      url.searchParams.set('s', code);
      location.href = url.href;
    };
    $('btn-code').addEventListener('click', go);
    return;
  }

  const iosPrompt =
    typeof (window as unknown as { DeviceOrientationEvent?: OrientationEventStatic }).DeviceOrientationEvent?.requestPermission === 'function';
  $('note-permission').hidden = !iosPrompt;
  show('start');
  requestAnimationFrame(frame);

  const setup = await loadNetSetup(new URL('..', location.href));
  const linkOptions: LinkOptions = {
    openTimeoutMs: 12_000,
    idleTimeoutMs: 8000,
    netSim: { lag: debug.lag, jitter: debug.jitter, loss: debug.loss },
  };
  conn = new ScreenConnection(setup, screenId, linkOptions);
  conn.onChange = renderConnection;
  conn.onHud = renderHud;
  conn.onFx = feedback;
  renderConnection();

  (window as unknown as Record<string, unknown>).__ctl = {
    status: () => conn?.status,
    connected: () => conn?.connected ?? false,
    steer: () => steerValue(),
    buttons: () => pad.buttons,
    tilt: () => ({ active: tilt.active, angle: tilt.angle, value: tilt.value, side: tilt.side }),
    rates: () => ({ sendHz, sensorHz }),
    drops: () => conn?.drops ?? 0,
    hud: () => conn?.hud ?? null,
    lastFlash: () => $('flash').dataset.tone ?? null,
    unreliable: () => conn?.link?.fastIsUnreliable ?? false,
    rtt: () => conn?.link?.rtt ?? -1,
    screen: () => current(),
    dropLink: () => conn?.link?.close(),
  };
}

void boot();
