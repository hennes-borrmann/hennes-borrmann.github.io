// Oberfläche des Bildschirms: Startseite, Lobby, Bedienelemente über der
// Rennen sowie Meldungen. Reine Anzeige – die Logik sitzt in app.ts.

import { BOT_NAMES } from '../game/ai';
import type { CupDraw, LobbyPlayer } from '../net/protocol';
import { CHARACTERS, ITEM_NONE, MAX_PLAYERS } from '../game/sim';
import { CODE_ALPHABET, ROOM_CODE_LENGTH, isValidCode, normalizeCode } from '../net/codes';
import { $, h, ms } from '../util/dom';
import { getTrack, type Track } from '../game/track';
import { OFFERED_TRACKS } from './offered';
import { portraitUrl } from '../render/portraits';
import { ITEMS, ROLLING_ICON, itemSvg } from '../util/items';
import { Minimap, trackPath } from './minimap';
import { PLAYER_COLOR_NAMES, playerColor } from '../util/players';
import { qrSvg } from '../util/qr';

export type ViewName = 'boot' | 'home' | 'lobby' | 'game';

/** Die drei Schritte der Lobby: Figur, Strecke (im Turnier: Lostopf), Start. */
export type LobbyStep = 1 | 2 | 3;

/** So lange läuft der Streifen der Auslosung, und so lange bleibt die ausgeloste Strecke danach stehen (ms). */
export const DRAW_SPIN_MS = 6500;
export const DRAW_HOLD_MS = 2400;
/** Diese Karte des Streifens steht beim Start unter der Markierung. */
const DRAW_START = 1;

/** Eine Zeile des Turnierstands. */
export interface CupRow {
  rank: number;
  slot: number;
  name: string;
  bot: boolean;
  me: boolean;
  character: number;
  stars: number;
  /** Sterne aus dem letzten gewerteten Rennen. */
  gain: number;
}

/** Stand des Turniers für die Anzeige. */
export interface CupModel {
  races: number;
  done: number;
  over: boolean;
  /** Nach Rang geordnet. */
  rows: CupRow[];
}

export interface LobbyModel {
  code: string;
  inviteUrl: string;
  pairUrl: string;
  players: LobbyPlayer[];
  localSlot: number;
  isHost: boolean;
  canStart: boolean;
  /** Freie Plätze werden mit KI-Gegnern aufgefüllt. */
  bots: boolean;
  /** Stärke der KI: 0 leicht, 1 mittel, 2 schwer. */
  aiLevel: number;
  /** Gewählte Strecke. */
  track: number;
  /** Rundenzahl des Rennens. */
  laps: number;
  /** 0 = Einzelrennen, sonst die Zahl der Rennen eines Turniers. */
  cupRaces: number;
  /** Laufendes oder gerade beendetes Turnier. */
  cup: CupModel | null;
  /** Eigene Figur. */
  character: number;
  quality: 'auto' | 'low' | 'medium' | 'high';
  waitingFor: string[];
  localReady: boolean;
  controllerConnected: boolean;
  /**
   * 'waiting': verbunden, aber dort wurde noch nicht „Tippen zum Starten“ gedrückt,
   * 'active': sendet Eingaben, 'silent': hat gesendet, jetzt kommt nichts mehr.
   */
  controllerState: 'waiting' | 'active' | 'silent';
  /** Handy und Bildschirm laufen mit unterschiedlichen Fassungen der Seite. */
  controllerMismatch: boolean;
  controllerRtt: number;
}

export interface RaceHudModel {
  visible: boolean;
  place: number;
  of: number;
  lap: number;
  laps: number;
  timeSec: number;
  /** Die Uhr bleibt stehen, sobald das eigene Kart im Ziel ist. */
  frozenTime: boolean;
  item: number;
  rolling: boolean;
  speedKmh: number;
  finished: boolean;
  /** Alle Fahrer in der aktuellen Reihenfolge. */
  order: { slot: number; name: string; me: boolean; done: boolean }[];
  /** Hinweis in der Bildmitte ("Letzte Runde!") oder null. */
  banner: string | null;
  bannerTone: 'info' | 'bad';
  /** Bildrate, falls sie angezeigt werden soll. */
  fps: number | null;
  /** 0..1: wie dicht der Rauch vor der Kamera ist. */
  smoke: number;
}

export interface SettingsModel {
  quality: 'auto' | 'low' | 'medium' | 'high';
  music: number;
  sfx: number;
  muted: boolean;
  showFps: boolean;
}

export interface ResultRow {
  place: number;
  slot: number;
  name: string;
  bot: boolean;
  me: boolean;
  character: number;
  /** Fahrzeit in Sekunden, -1 = nicht im Ziel. */
  timeSec: number;
  /** Im Turnier: Sterne für dieses Rennen (fehlt, solange die Wertung noch nicht da ist). */
  gain?: number;
}

/** Adresse des Vorschaubilds einer Strecke (liegt neben der Seite unter karten/). */
function trackImage(t: Track): string {
  return `karten/${t.def.id}.jpg`;
}

export function formatTime(sec: number): string {
  // Erst auf Zehntel runden, dann zerlegen – sonst wird aus 69,96 s „1:010.0“ und aus 59,96 s „0:60.0“.
  const tenths = Math.round(Math.max(0, sec) * 10);
  const m = Math.floor(tenths / 600);
  const rest = (tenths - m * 600) / 10;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
}

export interface ModalAction {
  label: string;
  primary?: boolean;
  run: () => void;
}

export interface UiHandlers {
  create(name: string): void;
  join(code: string, name: string): void;
  ready(ready: boolean): void;
  start(): void;
  /** Host: dasselbe Rennen noch einmal. */
  again(): void;
  /** Host: Einzelrennen (0) oder Turnier über so viele Rennen. */
  setCupRaces(races: number): void;
  /** Host, im Turnier: nächste Strecke auslosen und weiterfahren. */
  nextRace(): void;
  /** Host: das Turnier beenden. */
  endCup(): void;
  /** Die Auslosung: eine Karte zieht unter der Markierung durch / der Streifen steht. */
  drawTick(): void;
  drawStop(): void;
  setBots(bots: boolean): void;
  setAiLevel(level: number): void;
  setLaps(laps: number): void;
  setTrack(track: number): void;
  setCharacter(character: number): void;
  setQuality(q: 'auto' | 'low' | 'medium' | 'high'): void;
  setVolumes(music: number, sfx: number): void;
  setMuted(muted: boolean): void;
  setShowFps(show: boolean): void;
  /** Aktueller Stand der Einstellungen (für den Dialog). */
  settings(): SettingsModel;
  /** Ein Knopf wurde gedrückt (für den Klick-Ton). */
  click(kind: 'click' | 'back'): void;
  leave(): void;
  backToLobby(): void;
  toggleCamera(): void;
  toggleDebug(): void;
  showPairing(): void;
  nameChanged(name: string): void;
  /** Erste Nutzeraktion – Gelegenheit, den Bildschirm wach zu halten. */
  gesture(): void;
}

export class ScreenUi {
  private readonly app = $('app');
  private readonly inName = $<HTMLInputElement>('in-name');
  private readonly inCode = $<HTMLInputElement>('in-code');
  private readonly homeMsg = $('home-msg');
  private readonly btnCreate = $<HTMLButtonElement>('btn-create');
  private readonly btnJoin = $<HTMLButtonElement>('btn-join');
  private readonly btnReady = $<HTMLButtonElement>('btn-ready');
  private readonly btnStart = $<HTMLButtonElement>('btn-start');
  private readonly btnLeave = $<HTMLButtonElement>('btn-leave');
  private readonly btnBack = $<HTMLButtonElement>('btn-back');
  private readonly banner = $('banner');
  private readonly modal = $('modal');
  private lastPlayersJson = '';
  private localReady = false;
  private readonly hudCache: Record<string, string> = {};
  private lastCountdown: string | null = null;
  private shownTime = 0;
  private lastSetupJson = '';
  private lastCharJson = '';
  /** Lobby: aktueller Schritt (1 Figur, 2 Strecke, 3 Start). */
  private step: LobbyStep = 1;
  /** Beim nächsten Stand der Lobby den passenden Schritt wählen: frisch hinein oder zurück aus dem Rennen. */
  private stepInit: 'enter' | 'race' | null = null;
  private lastLobby: LobbyModel | null = null;
  /** Zustand der Kopplung (auch für den offenen Kopplungsdialog). */
  private pairText = 'Kein Handy verbunden';
  private pairOk = false;
  /** Platz, für dessen Farbe die Figurenkarten gebaut sind. */
  private charSlot = -2;
  private tracksBuilt = false;
  private readonly portraits = new Map<string, string>();
  private portraitJobs: { key: string; character: number; slot: number; px: number; targets: HTMLImageElement[] }[] = [];
  private portraitTimer = 0;
  private lastOrderJson = '';
  private lastCupJson = '';
  private lastResultsJson = '';
  /** Zuletzt gewählte Turnierlänge – gilt, wenn der Host von Einzelrennen auf Turnier schaltet. */
  private cupSize = 5;
  private drawRaf = 0;
  private imagesWarm = false;
  private readonly minimap = new Minimap($<HTMLCanvasElement>('minimap'));
  private readonly on: UiHandlers;

  constructor(on: UiHandlers) {
    this.on = on;
    this.btnCreate.addEventListener('click', () => {
      on.gesture();
      on.create(this.name());
    });
    const join = (): void => {
      on.gesture();
      const code = normalizeCode(this.inCode.value);
      if (!isValidCode(code, ROOM_CODE_LENGTH)) {
        this.setHomeMessage(
          code.length !== ROOM_CODE_LENGTH
            ? `Der Raumcode hat ${ROOM_CODE_LENGTH} Zeichen.`
            : `Dieser Code enthält ein Zeichen, das in Raumcodes nicht vorkommt. Erlaubt sind: ${CODE_ALPHABET.split('').join(' ')}`,
          'bad',
        );
        this.inCode.focus();
        return;
      }
      on.join(code, this.name());
    };
    this.btnJoin.addEventListener('click', join);
    this.inCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });
    this.inCode.addEventListener('input', () => {
      this.inCode.value = normalizeCode(this.inCode.value).slice(0, ROOM_CODE_LENGTH);
    });
    this.inName.addEventListener('change', () => on.nameChanged(this.name()));

    this.btnReady.addEventListener('click', () => {
      on.gesture();
      on.ready(!this.localReady);
    });
    this.btnStart.addEventListener('click', () => {
      on.gesture();
      on.start();
    });
    this.btnLeave.addEventListener('click', () => on.leave());
    $('btn-again').addEventListener('click', () => on.again());
    $('btn-lobby').addEventListener('click', () => on.backToLobby());
    $('btn-next').addEventListener('click', () => {
      on.click('click');
      on.nextRace();
    });
    $('btn-cup-end').addEventListener('click', () => {
      on.click('back');
      on.endCup();
    });
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#mode button')) {
      btn.addEventListener('click', () => {
        on.click('click');
        on.setCupRaces(btn.dataset.mode === 'cup' ? this.cupSize : 0);
      });
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#cup-size button')) {
      btn.addEventListener('click', () => {
        on.click('click');
        this.cupSize = Number(btn.dataset.races);
        on.setCupRaces(this.cupSize);
      });
    }
    const chkBots = $<HTMLInputElement>('chk-bots');
    chkBots.addEventListener('change', () => {
      on.click('click');
      on.setBots(chkBots.checked);
    });
    $('btn-debug-lobby').addEventListener('click', () => on.toggleDebug());
    $('btn-copy').addEventListener('click', () => void this.copyInvite());

    // Lobby: Schritte, Kopplung, Zahnrad
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#lobby-steps button')) {
      btn.addEventListener('click', () => this.goStep(Number(btn.dataset.step) as LobbyStep));
    }
    $('btn-step-back').addEventListener('click', () => this.goStep((this.step - 1) as LobbyStep));
    $('btn-step-next').addEventListener('click', () => this.goStep((this.step + 1) as LobbyStep));
    $('sum-track').addEventListener('click', () => this.goStep(2));
    $('sum-char').addEventListener('click', () => this.goStep(1));
    const pair = (): void => {
      on.click('click');
      on.showPairing();
    };
    $('btn-pair-lobby').addEventListener('click', pair);
    $('btn-pair-hint').addEventListener('click', pair);
    $('btn-tools').addEventListener('click', () => {
      on.click('click');
      this.openTools();
    });
    $('btn-tools-close').addEventListener('click', () => this.closeTools());
    $('lobby-tools').addEventListener('click', (e) => {
      if ((e.target as HTMLElement).dataset.close === 'true') this.closeTools();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !$('lobby-tools').hidden) this.closeTools();
    });

    // Menü im Rennen: jede Auswahl schließt es wieder.
    const menu = $('menu');
    const closeMenu = (): void => {
      menu.hidden = true;
    };
    const btnMenu = $<HTMLButtonElement>('btn-menu');
    btnMenu.addEventListener('click', () => {
      on.click('click');
      menu.hidden = !menu.hidden;
      // Den Fokus sofort abgeben – sonst würde die Leertaste (Item) den Knopf erneut auslösen.
      btnMenu.blur();
    });
    menu.addEventListener('click', (e) => {
      if (e.target === menu) closeMenu();
    });
    const menuAction = (id: string, run: () => void): void => {
      $(id).addEventListener('click', () => {
        on.click(id === 'btn-back' ? 'back' : 'click');
        closeMenu();
        (document.activeElement as HTMLElement | null)?.blur?.();
        run();
      });
    };
    menuAction('btn-menu-close', () => undefined);
    menuAction('btn-settings-game', () => this.showSettings());
    menuAction('btn-pair', () => on.showPairing());
    menuAction('btn-camera', () => on.toggleCamera());
    menuAction('btn-debug', () => on.toggleDebug());
    menuAction('btn-back', () => on.backToLobby());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.view === 'game') menu.hidden = !menu.hidden;
    });

    for (const btn of document.querySelectorAll<HTMLButtonElement>('#ai-level button')) {
      btn.addEventListener('click', () => {
        on.click('click');
        on.setAiLevel(Number(btn.dataset.level));
      });
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#lap-count button')) {
      btn.addEventListener('click', () => {
        on.click('click');
        on.setLaps(Number(btn.dataset.laps));
      });
    }
  }

  show(view: ViewName): void {
    const prev = this.app.dataset.view;
    this.app.dataset.view = view;
    if (view !== 'game') $('menu').hidden = true;
    if (view !== 'lobby') $('lobby-tools').hidden = true;
    if (view === 'home') this.lastLobby = null;
    // Neu in der Lobby: vorn anfangen; zurück aus dem Rennen: dort, wo es weitergeht.
    if (view === 'lobby' && prev !== 'lobby') {
      this.stepInit = prev === 'game' ? 'race' : 'enter';
      if (this.lastLobby) this.applyStepInit(this.lastLobby);
    }
    // Die Diagnose hängt in der Lobby fest im Layout (verdeckt nichts) und
    // schwebt nur über dem Rennen.
    const debug = $('debug');
    if (view === 'lobby') $('debug-slot').append(debug);
    else this.app.append(debug);
  }

  get view(): ViewName {
    return this.app.dataset.view as ViewName;
  }

  name(): string {
    return this.inName.value.trim();
  }

  setHome(name: string, code: string): void {
    this.inName.value = name;
    this.inCode.value = code;
  }

  setVersion(build: string): void {
    $('home-version').textContent = `Version ${build}`;
  }

  setHomeBusy(busy: boolean): void {
    this.btnCreate.disabled = busy;
    this.btnJoin.disabled = busy;
  }

  setHomeMessage(text: string, tone: 'info' | 'bad' = 'info'): void {
    this.homeMsg.textContent = text;
    this.homeMsg.dataset.tone = tone;
  }

  renderLobby(m: LobbyModel): void {
    $('lobby-code').textContent = m.code;
    $('hud-code').textContent = m.code;
    const link = $<HTMLInputElement>('lobby-link');
    if (link.value !== m.inviteUrl) link.value = m.inviteUrl;

    this.lastLobby = m;
    let text = 'Kein Handy verbunden';
    if (m.controllerConnected) {
      if (m.controllerState === 'active') text = `Handy verbunden · Ping ${ms(m.controllerRtt)}`;
      else if (m.controllerState === 'waiting') text = 'Handy verbunden – dort noch „Tippen zum Starten“';
      else text = 'Handy verbunden, sendet aber gerade nichts';
      if (m.controllerMismatch) text = 'Handy hat eine ältere Fassung der Seite – dort bitte neu laden';
    }
    const ok = m.controllerConnected && m.controllerState === 'active' && !m.controllerMismatch;
    this.pairText = text;
    this.pairOk = ok;
    // Punkt am Knopf „Handy koppeln“: grün = verbunden und aktiv, gelb = (noch) nicht.
    const dot = $('pair-dot');
    if (dot.dataset.on !== String(ok)) dot.dataset.on = String(ok);
    const pairBtn = $('btn-pair-lobby');
    if (pairBtn.title !== text) {
      pairBtn.title = text;
      pairBtn.setAttribute('aria-label', `Handy koppeln – ${text}`);
    }
    $('pair-hint').hidden = m.controllerConnected;
    // Ist der Kopplungsdialog offen, zeigt er den Stand mit.
    const status = document.getElementById('pair-status');
    if (status && status.textContent !== text) {
      status.textContent = text;
      status.dataset.on = String(ok);
    }

    // Liste nur neu aufbauen, wenn sich etwas Sichtbares geändert hat.
    const json = JSON.stringify([m.players, m.localSlot, m.bots]);
    if (json !== this.lastPlayersJson) {
      this.lastPlayersJson = json;
      this.renderPlayers(m);
    }

    this.localReady = m.localReady;
    this.btnReady.textContent = m.localReady ? 'Doch nicht bereit' : 'Ich bin bereit';
    this.btnReady.classList.toggle('btn-on', m.localReady);
    this.btnReady.classList.toggle('btn-primary', !m.localReady);
    this.btnStart.disabled = !m.canStart;
    const cupRunning = m.cup !== null && !m.cup.over;
    this.btnStart.textContent = cupRunning ? (m.cup!.done > 0 ? 'Nächstes Rennen auslosen' : 'Strecke auslosen') : m.cupRaces > 0 ? 'Turnier starten' : 'Rennen starten';
    this.btnLeave.textContent = m.isHost ? 'Lobby schließen' : 'Lobby verlassen';
    this.btnBack.textContent = m.isHost ? 'Zur Lobby' : 'Verlassen';

    const chkBots = $<HTMLInputElement>('chk-bots');
    chkBots.checked = m.bots;
    chkBots.disabled = !m.isHost;
    $('bots-note').textContent = m.isHost
      ? 'Stell das Rennen ein und starte, sobald alle bereit sind.'
      : 'Modus, Strecke, Runden und Gegner legt der Host fest.';
    const charJson = JSON.stringify([m.character, m.localSlot, m.players.map((p) => [p.slot, p.name, p.character])]);
    if (charJson !== this.lastCharJson) {
      this.lastCharJson = charJson;
      this.renderCharacters(m);
    }
    const setupJson = JSON.stringify([m.track, m.aiLevel, m.laps, m.bots, m.isHost, m.cupRaces, cupRunning, m.cup !== null]);
    if (setupJson !== this.lastSetupJson) {
      this.lastSetupJson = setupJson;
      this.renderSetup(m);
    }
    const cupJson = JSON.stringify([m.cup, m.cupRaces, m.isHost]);
    if (cupJson !== this.lastCupJson) {
      this.lastCupJson = cupJson;
      this.renderCup(m);
    }

    let hint = '';
    if (m.isHost) {
      if (m.waitingFor.length > 0) hint = `Noch nicht bereit: ${m.waitingFor.join(', ')}`;
      else if (m.players.length === 1) hint = m.bots ? 'Du kannst gegen die KI starten oder auf Mitspieler warten.' : 'Du kannst allein starten oder auf Mitspieler warten.';
      else hint = 'Alle bereit.';
    } else {
      hint = m.localReady ? (m.cupRaces > 0 ? 'Der Host startet das Turnier.' : 'Der Host startet das Rennen.') : 'Melde dich bereit, wenn dein Controller verbunden ist.';
    }
    $('lobby-hint').textContent = hint;

    if (this.stepInit) this.applyStepInit(m);
    else this.syncStep();

    $('hud-note').textContent = m.controllerConnected
      ? ''
      : 'Kein Handy verbunden – den QR-Code gibt es im Menü unter „Controller koppeln“. Am Rechner: Pfeiltasten/WASD, Shift = Drift, Leertaste = Item.';
  }

  // --- Lobby: Schritte ------------------------------------------------------

  /** Wechselt in einen Schritt der Lobby (Schrittleiste, Weiter/Zurück, Zusammenfassung). */
  goStep(step: LobbyStep): void {
    const next = Math.max(1, Math.min(3, step)) as LobbyStep;
    if (next === this.step) return;
    this.on.click(next < this.step ? 'back' : 'click');
    this.step = next;
    this.syncStep();
    // Im Strecken-Raster die gewählte Strecke ins Bild holen.
    if (next === 2) {
      const on = document.querySelector<HTMLElement>('#track-list .track-card[data-on="true"]');
      const list = $('track-list');
      if (on && list.scrollHeight > list.clientHeight) list.scrollTop = Math.max(0, on.offsetTop - list.offsetTop - 8);
    }
    const stage = document.querySelector<HTMLElement>('.view-lobby');
    if (stage) stage.scrollTop = 0;
  }

  /** Erster Schritt nach dem Betreten der Lobby. */
  private applyStepInit(m: LobbyModel): void {
    const from = this.stepInit;
    this.stepInit = null;
    // Zurück aus dem Rennen: Der Host eines Einzelrennens sucht meist die nächste Strecke aus, alle anderen
    // (Mitspieler melden sich neu bereit, Turnier mit Stand) stehen gleich am Start.
    if (from === 'race') this.step = m.isHost && m.cupRaces === 0 && m.cup === null ? 2 : 3;
    else this.step = m.cup ? 3 : 1;
    this.syncStep();
  }

  /** Schrittleiste und Knöpfe unten an den aktuellen Schritt anpassen. */
  private syncStep(): void {
    const view = document.querySelector<HTMLElement>('.view-lobby');
    if (!view) return;
    const step = String(this.step);
    if (view.dataset.step !== step) view.dataset.step = step;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#lobby-steps button')) {
      const n = Number(btn.dataset.step);
      if (n === this.step) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
      btn.dataset.done = String(n < this.step);
    }
    const m = this.lastLobby;
    const isHost = m?.isHost ?? true;
    const last = this.step === 3;
    $('btn-step-back').hidden = this.step === 1;
    const next = $('btn-step-next');
    next.hidden = last;
    next.textContent = this.step === 1 ? (m && m.cupRaces > 0 ? 'Zum Lostopf' : 'Zur Strecke') : 'Zum Start';
    this.btnReady.hidden = !last || isHost;
    this.btnStart.hidden = !last || !isHost;
  }

  /** Zahnrad: Grafik, Ton und Diagnose in einer Leiste am Rand. */
  openTools(): void {
    $('tools-settings').replaceChildren(this.settingsBody());
    $('lobby-tools').hidden = false;
    $('btn-tools-close').focus();
  }

  private closeTools(): void {
    if ($('lobby-tools').hidden) return;
    this.on.click('back');
    $('lobby-tools').hidden = true;
  }

  setBanner(text: string | null, tone: 'warn' | 'bad' = 'warn'): void {
    this.banner.hidden = !text;
    this.banner.textContent = text ?? '';
    this.banner.dataset.tone = tone;
  }

  showModal(title: string, body: (string | Node)[], actions: ModalAction[], variant = ''): void {
    $('modal-title').textContent = title;
    const card = this.modal.querySelector<HTMLElement>('.modal-card');
    if (card) card.dataset.variant = variant;
    $('modal-body').replaceChildren(...body.map((b) => (typeof b === 'string' ? h('p', { text: b }) : b)));
    const row = $('modal-actions');
    row.replaceChildren();
    for (const a of actions) {
      const btn = h('button', { class: a.primary ? 'btn btn-primary' : 'btn', type: 'button', text: a.label });
      btn.addEventListener('click', () => {
        this.hideModal();
        a.run();
      });
      row.append(btn);
    }
    this.modal.hidden = false;
  }

  hideModal(): void {
    this.modal.hidden = true;
  }

  /**
   * Meldung über dem Rennen, wenn der Browser die 3D-Grafik nicht (mehr) zeichnet: was gemessen wurde, und ein
   * Knopf zum Neuaufbau. null blendet sie aus. Das Element entsteht erst, wenn es gebraucht wird.
   */
  setGfxNote(lines: string[] | null, onRebuild?: () => void, onHide?: () => void, heading = 'Grafikproblem erkannt'): void {
    let box = document.getElementById('gfx-note');
    if (!lines) {
      if (box) box.hidden = true;
      return;
    }
    if (!box) {
      box = h('div', { id: 'gfx-note' });
      box.style.cssText =
        'position:fixed;left:50%;top:92px;transform:translateX(-50%);z-index:60;width:min(680px,86vw);padding:14px 18px 16px;' +
        'background:#1b1e25;color:#f4f1e8;border-top:5px solid #ffd23f;box-shadow:6px 6px 0 #000;font:14px/1.45 system-ui,sans-serif;';
      document.body.append(box);
    }
    const title = h('strong', { text: heading });
    title.style.cssText = 'display:block;font-size:17px;margin-bottom:6px;';
    const btn = h('button', { class: 'btn', type: 'button', text: 'Grafik neu aufbauen' });
    btn.style.cssText = 'margin-top:10px;';
    btn.addEventListener('click', () => onRebuild?.());
    const hide = h('button', { class: 'btn', type: 'button', text: 'Ausblenden' });
    hide.style.cssText = 'margin:10px 0 0 10px;';
    hide.addEventListener('click', () => onHide?.());
    // Ohne Rückruf (reine Auskunft, etwa „wird vorbereitet“) keine Knöpfe.
    box.replaceChildren(title, ...lines.map((l) => h('p', { text: l })), ...(onRebuild ? [btn, hide] : []));
    for (const el of Array.from(box.querySelectorAll('p'))) (el as HTMLElement).style.cssText = 'margin:4px 0;overflow-wrap:anywhere;';
    box.hidden = false;
  }

  // --- Rennen ---------------------------------------------------------------

  /** Schreibt nur ins Dokument, wenn sich der Text wirklich geändert hat (läuft jedes Bild). */
  private setText(id: string, text: string): void {
    if (this.hudCache[id] === text) return;
    this.hudCache[id] = text;
    $(id).textContent = text;
  }

  renderRaceHud(m: RaceHudModel): void {
    const hud = $('race-hud');
    if (hud.hidden === m.visible) hud.hidden = !m.visible;
    if (!m.visible) {
      // Nichts aus dem Rennen darf stehen bleiben: Rauchschleier, Hinweise, Zielbanner.
      if (this.hudCache.smoke !== '0') {
        this.hudCache.smoke = '0';
        $('smoke-veil').style.opacity = '0';
      }
      for (const [key, id] of [
        ['banner', 'race-banner'],
        ['flag', 'finish-flag'],
        ['fps', 'fps'],
      ]) {
        if (this.hudCache[key]) {
          this.hudCache[key] = '';
          $(id).hidden = true;
        }
      }
      return;
    }
    this.setText('rh-place', String(m.place));
    this.setText('rh-of', `von ${m.of}`);
    this.setText('rh-lap', `${m.lap}/${m.laps}`);
    if (!m.frozenTime) this.shownTime = m.timeSec;
    this.setText('rh-time', formatTime(this.shownTime));
    this.setText('rh-speed', String(m.speedKmh));
    if (this.hudCache.placeAttr !== String(m.place)) {
      this.hudCache.placeAttr = String(m.place);
      $('rh-place-box').dataset.place = String(m.place);
    }

    const orderJson = JSON.stringify(m.order);
    if (orderJson !== this.lastOrderJson) {
      this.lastOrderJson = orderJson;
      const list = $('rh-order');
      list.replaceChildren();
      m.order.forEach((o, i) => {
        const who = h('span', { class: 'who', text: o.name });
        who.style.setProperty('--c', playerColor(o.slot));
        const li = h('li', {}, h('span', { class: 'n', text: String(i + 1) }), who);
        li.dataset.me = String(o.me);
        li.dataset.done = String(o.done);
        list.append(li);
      });
    }

    const banner = m.banner ?? '';
    if (this.hudCache.banner !== banner) {
      this.hudCache.banner = banner;
      const el = $('race-banner');
      el.hidden = !banner;
      el.textContent = banner;
      el.dataset.tone = m.bannerTone;
    }
    const fps = m.fps === null ? '' : `${Math.round(m.fps)} Bilder/s`;
    if (this.hudCache.fps !== fps) {
      this.hudCache.fps = fps;
      const el = $('fps');
      el.hidden = !fps;
      el.textContent = fps;
    }
    const smoke = m.smoke < 0.02 ? '0' : m.smoke.toFixed(2);
    if (this.hudCache.smoke !== smoke) {
      this.hudCache.smoke = smoke;
      $('smoke-veil').style.opacity = smoke;
    }

    const state = m.rolling ? 'rolling' : m.item === ITEM_NONE ? 'none' : `item${m.item}`;
    if (this.hudCache.item !== state) {
      this.hudCache.item = state;
      const box = $('rh-item');
      box.dataset.state = m.rolling ? 'rolling' : m.item === ITEM_NONE ? 'none' : 'ready';
      const info = ITEMS[m.item];
      $('rh-item-icon').innerHTML = m.rolling ? itemSvg(ROLLING_ICON) : info ? itemSvg(info.icon) : '';
      $('rh-item-name').textContent = m.rolling ? '' : info ? info.name : '';
      $('rh-item-hint').textContent = m.rolling ? '' : info ? info.hint : '';
    }

    const flag = $('finish-flag');
    const text = m.finished ? `Ziel! Platz ${m.place}` : '';
    if (m.finished) $('menu').hidden = true;
    if (this.hudCache.flag !== text) {
      this.hudCache.flag = text;
      flag.textContent = text;
      flag.hidden = !text;
    }
  }

  /** Der Hinweis zur Tastatur stört beim Fahren – nur vor dem Start zeigen. */
  setHudNoteVisible(visible: boolean): void {
    const note = $('hud-note');
    if (note.hidden === visible) note.hidden = !visible;
  }

  /** Name der Strecke zur Kamerafahrt vor dem Start; null blendet ihn aus. */
  /** @param twist Ein Satz zur Eigenheit der Strecke (Verkehr, Lava …) – leer, wenn sie keine hat. */
  setRaceTitle(name: string | null, sub = '', twist = ''): void {
    const key = name ?? '';
    if (this.hudCache.title === key) return;
    this.hudCache.title = key;
    const el = $('race-title');
    el.hidden = name === null;
    if (name === null) return;
    $('race-title-name').textContent = name;
    $('race-title-sub').textContent = sub;
    const line = $('race-title-twist');
    line.textContent = twist;
    line.hidden = twist === '';
  }

  /** Minikarte neu zeichnen (läuft nicht jedes Bild – die App drosselt). */
  drawMinimap(track: Track, karts: { x: number; z: number; slot: number }[], localSlot: number): void {
    this.minimap.setTrack(track);
    this.minimap.draw(karts, localSlot);
  }

  setCameraLabel(top: boolean): void {
    $('btn-camera').textContent = top ? 'Kamera: Verfolger' : 'Kamera: Übersicht';
  }

  setCountdown(text: string | null): void {
    if (text === this.lastCountdown) return;
    this.lastCountdown = text;
    const el = $('countdown');
    el.hidden = text === null;
    if (text === null) return;
    el.textContent = text;
    el.dataset.go = String(text === 'Los!');
    // Animation neu starten
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /**
   * Zieleinlauf; im Turnier darunter der Gesamtstand. Darf mehrfach gerufen werden (die Wertung
   * des Turniers trifft bei Mitspielern etwas später ein als das Rennende) – neu aufgebaut wird
   * nur, wenn sich etwas geändert hat.
   */
  showResults(rows: ResultRow[], isHost: boolean, trackName = '', cup: CupModel | null = null): void {
    const json = JSON.stringify([rows, isHost, trackName, cup]);
    if (json === this.lastResultsJson && !$('results').hidden) return;
    this.lastResultsJson = json;
    $('results-track').textContent = cup ? `Turnier · Rennen ${Math.max(1, cup.done)} von ${cup.races} · ${trackName}` : trackName;
    $('menu').hidden = true;
    const list = $('results-list');
    list.dataset.cup = String(cup !== null);
    list.replaceChildren();
    for (const r of rows) {
      const face = this.face(r.character, r.slot, 'result-face', false);
      list.append(
        h(
          'li',
          { class: `result${r.me ? ' result-me' : ''}` },
          h('span', { class: 'result-place', text: `${r.place}.` }),
          face,
          h('span', { class: 'result-name' }, r.name, r.bot ? h('span', { class: 'tag', text: 'KI' }) : null, r.me ? h('span', { class: 'you', text: 'du' }) : null),
          h('span', { class: 'result-time', text: r.timeSec >= 0 ? formatTime(r.timeSec) : 'nicht im Ziel' }),
          cup ? h('span', { class: 'result-gain', text: r.gain === undefined ? '' : `+${r.gain} ★` }) : null,
        ),
      );
    }
    const box = $('results-cup');
    box.hidden = cup === null;
    if (cup) {
      const leaders = cup.rows.filter((r) => r.rank === 1).map((r) => r.name);
      box.dataset.over = String(cup.over);
      $('results-cup-title').textContent = cup.over ? `Turniersieg: ${leaders.join(' & ')}` : 'Gesamtstand';
      $('results-cup-progress').textContent = cup.over ? `Endstand nach ${cup.races} Rennen` : `noch ${cup.races - cup.done} Rennen`;
      $('results-cup-list').replaceChildren(...cup.rows.map((r) => this.cupLine(r, 'result-face', false)));
    }
    const next = cup !== null && !cup.over;
    $('btn-again').hidden = !isHost || cup !== null;
    $('btn-next').hidden = !isHost || !next;
    const lobby = $('btn-lobby');
    lobby.hidden = !isHost;
    lobby.classList.toggle('btn-primary', cup !== null && cup.over);
    $('results-note').textContent = isHost ? '' : 'Der Host entscheidet, wie es weitergeht.';
    $('results').hidden = false;
  }

  /** Eine Zeile des Turnierstands: Rang, Gesicht, Name, Sterne. */
  private cupLine(r: CupRow, faceClass: string, render: boolean): HTMLElement {
    const li = h(
      'li',
      { class: `cup-line${r.me ? ' cup-line-me' : ''}` },
      h('span', { class: 'cup-rank', text: `${r.rank}.` }),
      this.face(r.character, r.slot, faceClass, render),
      h('span', { class: 'cup-name' }, h('span', { class: 'cup-n', text: r.name }), r.bot ? h('span', { class: 'tag', text: 'KI' }) : null, r.me ? h('span', { class: 'you', text: 'du' }) : null),
      h('span', { class: 'cup-gain', text: r.gain > 0 ? `+${r.gain}` : '' }),
      h('span', { class: 'cup-stars' }, h('span', { class: 'cup-star', text: '★' }), String(r.stars)),
    );
    li.dataset.rank = String(r.rank);
    return li;
  }

  // --- Turnier: Auslosung -----------------------------------------------------------------

  get drawVisible(): boolean {
    return !$('draw').hidden;
  }

  /**
   * Zeigt die Auslosung: Der Streifen der Streckenkarten zieht von rechts nach links unter der
   * Markierung durch, wird langsamer und bleibt auf der ausgelosten Karte stehen.
   */
  showDraw(draw: CupDraw, raceNo: number, races: number): void {
    this.hideDraw();
    const root = $('draw');
    const strip = $('draw-strip');
    $('draw-eyebrow').textContent = `Turnier · Rennen ${raceNo} von ${races}`;
    const title = $('draw-title');
    title.textContent = 'Wohin geht’s?';
    $('draw-twist').textContent = '';
    root.dataset.state = 'spinning';
    strip.replaceChildren(...draw.strip.map((t) => this.drawCard(t)));
    strip.style.transform = '';
    root.hidden = false;
    const cards = strip.children;
    const started = performance.now();
    let lastIndex = -1;
    let lastTick = 0;
    const frame = (now: number): void => {
      const first = cards[0] as HTMLElement | undefined;
      const second = cards[1] as HTMLElement | undefined;
      if (!first) return;
      // Maße je Bild neu lesen: dreht jemand das iPad mitten in der Auslosung, stimmt die Lage trotzdem.
      const w = first.offsetWidth;
      const pitch = second ? second.offsetLeft - first.offsetLeft : w;
      const k = Math.min(1, (now - started) / DRAW_SPIN_MS);
      // Schnell los, lange ausrollen
      const eased = 1 - Math.pow(1 - k, 3);
      // Der Streifen beginnt in der Bildmitte (CSS); die Mitte der Karte i liegt bei i·pitch + w/2.
      const from = DRAW_START * pitch + w / 2;
      const to = draw.stop * pitch + w / 2 + draw.nudge * w;
      const x = from + (to - from) * eased;
      strip.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`;
      const index = Math.floor(x / pitch);
      if (index !== lastIndex) {
        lastIndex = index;
        if (k < 1 && now - lastTick > 60) {
          lastTick = now;
          this.on.drawTick();
        }
      }
      if (k < 1) {
        this.drawRaf = requestAnimationFrame(frame);
        return;
      }
      this.drawRaf = 0;
      const picked = getTrack(draw.strip[draw.stop]);
      (cards[draw.stop] as HTMLElement | undefined)?.classList.add('is-picked');
      root.dataset.state = 'stopped';
      title.textContent = picked.def.name;
      $('draw-twist').textContent = picked.def.twist ?? picked.def.blurb;
      this.on.drawStop();
    };
    this.drawRaf = requestAnimationFrame(frame);
  }

  hideDraw(): void {
    if (this.drawRaf !== 0) cancelAnimationFrame(this.drawRaf);
    this.drawRaf = 0;
    const root = $('draw');
    if (root.hidden) return;
    root.hidden = true;
    $('draw-strip').replaceChildren();
  }

  /** Eine Karte des Streifens: Bild der Strecke, darunter ihr Name. Fehlt das Bild, bleibt der Streckenverlauf. */
  private drawCard(track: number): HTMLElement {
    const t = getTrack(track);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 74');
    svg.setAttribute('class', 'draw-map');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', trackPath(t, 120, 74, 10));
    svg.append(path);
    const img = h('img', { class: 'draw-img', alt: '', src: trackImage(t), decoding: 'async', draggable: 'false' });
    img.addEventListener('error', () => img.remove());
    return h(
      'div',
      { class: 'draw-card' },
      h(
        'div',
        { class: 'draw-face' },
        svg,
        img,
        h('div', { class: 'draw-label' }, h('strong', { text: t.def.name }), h('span', { text: `${Math.round(t.length / 10) * 10} m · ${'●'.repeat(t.def.grade)}${'○'.repeat(3 - t.def.grade)}` })),
      ),
    );
  }

  /** Lädt die Streckenbilder vor, damit der Streifen nicht mit leeren Karten losläuft. */
  private warmTrackImages(): void {
    if (this.imagesWarm) return;
    this.imagesWarm = true;
    for (let i = 0; i < OFFERED_TRACKS; i++) new Image().src = trackImage(getTrack(i));
  }

  /** Lobby: Stand des Turniers und die Wahl zwischen Einzelrennen und Turnier. */
  private renderCup(m: LobbyModel): void {
    const running = m.cup !== null && !m.cup.over;
    const isCup = m.cupRaces > 0;
    if (isCup) {
      this.cupSize = m.cupRaces;
      this.warmTrackImages();
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#mode button')) {
      btn.setAttribute('aria-pressed', String((btn.dataset.mode === 'cup') === isCup));
      btn.disabled = !m.isHost || running;
    }
    $('cup-size-box').hidden = !isCup;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#cup-size button')) {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.races) === m.cupRaces));
      btn.disabled = !m.isHost || running;
    }
    $('mode-note').textContent = !isCup
      ? ''
      : running
        ? ''
        : `${m.cupRaces} Rennen auf ausgelosten Strecken. Je Rennen gibt es einen Stern für jeden, den du hinter dir lässt – wer am Ende die meisten hat, gewinnt.`;
    const panel = $('cup-panel');
    panel.hidden = m.cup === null;
    if (m.cup) {
      const c = m.cup;
      const leaders = c.rows.filter((r) => r.rank === 1).map((r) => r.name);
      $('cup-title').textContent = c.over ? `Turniersieg: ${leaders.join(' & ')}` : 'Turnier läuft';
      $('cup-progress').textContent = c.over ? `Endstand nach ${c.races} Rennen` : c.done === 0 ? `${c.races} Rennen` : `${c.done} von ${c.races} Rennen gefahren`;
      $('cup-table').replaceChildren(...c.rows.map((r) => this.cupLine(r, 'player-face', true)));
      const end = $('btn-cup-end');
      end.hidden = !m.isHost;
      end.textContent = c.over ? 'Stand ausblenden' : 'Turnier beenden';
    }
  }

  hideResults(): void {
    this.lastResultsJson = '';
    $('results').hidden = true;
  }

  /** Handy koppeln (Lobby und Menü im Rennen): QR-Code, Stand der Verbindung, drei Schritte, Adresse. */
  showPairingModal(pairUrl: string, connected: boolean): void {
    const qr = h('div', { class: 'qr qr-large' });
    qr.append(qrSvg(pairUrl));
    const status = h('p', { id: 'pair-status', class: 'pair-status', text: this.pairText });
    status.dataset.on = String(this.pairOk);
    const steps = h(
      'ol',
      { class: 'steps' },
      h('li', { text: 'QR-Code mit der Handy-Kamera scannen.' }),
      h('li', { text: 'Auf dem Handy „Tippen zum Starten“ und Bewegungssensor erlauben.' }),
      h('li', { text: 'Handy quer halten und kalibrieren.' }),
    );
    const body = h(
      'div',
      { class: 'pairing' },
      qr,
      h(
        'div',
        { class: 'pairing-text' },
        status,
        steps,
        connected ? h('p', { class: 'pairing-note', text: 'Scannt ein anderes Handy den Code, übernimmt es die Steuerung.' }) : null,
        h('p', { class: 'pairing-url', text: pairUrl.replace(/^https?:\/\//, '') }),
      ),
    );
    this.showModal('Handy koppeln', [body], [{ label: 'Fertig', primary: true, run: () => undefined }], 'pairing');
  }

  /** Fahrerfeld im Start-Schritt: vier Plätze mit Figur, Bereitschaft und Handy. */
  private renderPlayers(m: LobbyModel): void {
    const list = $('lobby-players');
    list.replaceChildren();
    const bySlot = new Map(m.players.map((p) => [p.slot, p]));
    for (let slot = 0; slot < MAX_PLAYERS; slot++) {
      const p = bySlot.get(slot);
      const chip = h('span', { class: 'chip', text: String(slot + 1) });
      chip.style.setProperty('--c', playerColor(slot));
      if (!p) {
        const li = h(
          'li',
          { class: `player player-empty${m.bots ? ' player-bot' : ''}` },
          chip,
          m.bots ? this.face(slot, slot, 'player-face') : h('span', { class: 'player-face player-face-empty' }),
          h(
            'span',
            { class: 'player-id' },
            h('span', { class: 'player-id-name', text: m.bots ? BOT_NAMES[slot] : 'Platz frei' }),
            h('span', { class: 'player-sub', text: m.bots ? `KI · fährt ${CHARACTERS[slot]?.name ?? ''}` : 'per Raumcode beitreten' }),
          ),
          m.bots ? h('span', { class: 'player-state' }, h('span', { class: 'pill pill-bot', text: 'KI' })) : null,
        );
        list.append(li);
        continue;
      }
      const me = slot === m.localSlot;
      const id = h(
        'span',
        { class: 'player-id' },
        h(
          'span',
          { class: 'player-id-name' },
          h('span', { class: 'player-n', text: p.name }),
          me ? h('span', { class: 'you', text: 'du' }) : null,
          p.isHost ? h('span', { class: 'tag tag-host', text: 'Host' }) : null,
          p.online ? null : h('span', { class: 'tag tag-bad', text: 'getrennt' }),
        ),
        h('span', { class: 'player-fig', text: `fährt ${CHARACTERS[p.character]?.name ?? ''}` }),
      );
      const readyOk = p.isHost || p.ready;
      const ready = h('span', { class: `pill stat-ready ${readyOk ? 'stat-ok' : 'stat-off'}`, text: p.isHost ? 'startet' : p.ready ? 'bereit' : 'nicht bereit' });
      const net = p.isHost ? '' : ` · Netz ${p.online ? ms(p.ping) : '–'}`;
      const controller = h(
        'span',
        { class: `stat-controller ${p.controller ? 'stat-ok' : 'stat-off'}` },
        h('i', { class: 'pair-dot' }),
        p.controller ? `Handy ${ms(p.ctrlRtt)}${net}` : `kein Handy${net}`,
      );
      (controller.firstChild as HTMLElement).dataset.on = String(p.controller);
      const row = h(
        'li',
        { class: `player${me ? ' player-me' : ''}${p.online ? '' : ' player-off'}` },
        chip,
        this.face(p.character, slot, 'player-face'),
        id,
        h('span', { class: 'player-state' }, ready, controller),
      );
      row.title = `Platz ${slot + 1} · ${PLAYER_COLOR_NAMES[slot]}`;
      list.append(row);
    }
  }

  /**
   * Bild einer Figur in der Farbe eines Platzes. Die Bilder entstehen aus den
   * 3D-Modellen – eins nach dem anderen im Hintergrund, damit die Lobby dabei
   * bedienbar bleibt. Bis ein Bild fertig ist, steht dort ein farbiger Kreis.
   * @param render false = nur bereits fertige Bilder verwenden (im Rennen wird nichts nachgerendert)
   * @param px Kantenlänge des gerenderten Bildes
   */
  private face(character: number, slot: number, cls: string, render = true, px = 192): HTMLImageElement {
    const img = h('img', { class: cls, alt: '' });
    img.style.setProperty('--c', playerColor(slot));
    const key = `${character}:${slot}:${px}`;
    const ready = this.portraits.get(key);
    if (ready) img.src = ready;
    else {
      img.dataset.empty = 'true';
      if (render) {
        let job = this.portraitJobs.find((j) => j.key === key);
        if (!job) this.portraitJobs.push((job = { key, character, slot, px, targets: [] }));
        job.targets.push(img);
        this.pumpPortraits();
      }
    }
    return img;
  }

  private pumpPortraits(): void {
    if (this.portraitTimer !== 0 || this.portraitJobs.length === 0) return;
    this.portraitTimer = window.setTimeout(() => {
      this.portraitTimer = 0;
      const job = this.portraitJobs.shift();
      if (!job) return;
      const url = portraitUrl(job.character, job.slot, job.px);
      if (url) {
        this.portraits.set(job.key, url);
        for (const img of job.targets) {
          img.src = url;
          delete img.dataset.empty;
        }
      }
      this.pumpPortraits();
    }, 30);
  }

  /** Vor dem Rennen: noch ausstehende Bilder verwerfen – der Grafikkontext gehört jetzt dem Rennen. */
  cancelPortraits(): void {
    window.clearTimeout(this.portraitTimer);
    this.portraitTimer = 0;
    this.portraitJobs = [];
  }

  /**
   * Schritt 1, Figurenwahl: vier große Karten mit Bild, Eigenschaft und Fahrwerten. Auf jeder Karte
   * steht, welche Mitspieler sie gerade fahren (dieselbe Figur darf mehrfach vorkommen).
   */
  private renderCharacters(m: LobbyModel): void {
    const list = $('char-list');
    const slot = Math.max(0, m.localSlot);
    if (slot !== this.charSlot || list.childElementCount !== CHARACTERS.length) {
      this.charSlot = slot;
      list.replaceChildren();
      const labels = ['Tempo', 'Antritt', 'Kurven'];
      CHARACTERS.forEach((c, i) => {
        const bars = h('span', { class: 'char-bars' });
        c.bars.forEach((value, k) => {
          const pips = h('span', { class: 'pips', title: `${value} von 5` });
          for (let n = 1; n <= 5; n++) pips.append(h('i', { class: n <= value ? 'on' : '' }));
          bars.append(h('span', { class: 'char-bar' }, h('span', { class: 'char-bar-label', text: labels[k] }), pips));
        });
        const pic = h('span', { class: 'char-pic' }, this.face(i, slot, 'char-face', true, 320), h('span', { class: 'char-mine', text: 'Deine Wahl' }));
        pic.style.setProperty('--c', playerColor(slot));
        const card = h(
          'button',
          { class: 'char-card', type: 'button' },
          pic,
          h(
            'span',
            { class: 'char-body' },
            h('span', { class: 'char-name', text: c.name }),
            h('span', { class: 'char-trait', text: c.trait }),
            bars,
            h('span', { class: 'char-who' }),
          ),
        ) as HTMLButtonElement;
        card.addEventListener('click', () => {
          this.on.click('click');
          this.on.setCharacter(i);
        });
        list.append(card);
      });
    }
    const cards = list.querySelectorAll<HTMLButtonElement>('.char-card');
    cards.forEach((card, i) => {
      card.dataset.on = String(i === m.character);
      card.setAttribute('aria-pressed', String(i === m.character));
      // Wer (außer dir) fährt diese Figur?
      const who = card.querySelector('.char-who')!;
      who.replaceChildren(
        ...m.players
          .filter((p) => p.slot !== m.localSlot && p.character === i)
          .map((p) => {
            const tag = h('span', { class: 'who-chip', text: p.name });
            tag.style.setProperty('--c', playerColor(p.slot));
            return tag;
          }),
      );
    });
    // Zusammenfassung im Start-Schritt
    const c = CHARACTERS[m.character];
    $('sum-char').replaceChildren(
      this.face(m.character, slot, 'sum-face'),
      h('span', { class: 'sum-text' }, h('strong', { text: c?.name ?? '' }), h('span', { text: c?.trait ?? '' })),
    );
  }

  /** Kleine Karte des Streckenverlaufs (steht unter dem Bild, falls es fehlt). */
  private trackMap(t: Track, cls: string): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 74');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', trackPath(t, 120, 74, 10));
    svg.append(path);
    return svg;
  }

  /** Schritt 2: das Raster der Streckenbilder entsteht einmal; danach ändern sich nur Markierung und Sperre. */
  private buildTracks(): void {
    if (this.tracksBuilt) return;
    this.tracksBuilt = true;
    const list = $('track-list');
    list.replaceChildren();
    for (let i = 0; i < OFFERED_TRACKS; i++) {
      const t = getTrack(i);
      const img = h('img', { class: 'track-img', alt: '', src: trackImage(t), decoding: 'async', draggable: 'false' });
      img.addEventListener('error', () => img.remove());
      const card = h(
        'button',
        { class: 'track-card', type: 'button' },
        h('span', { class: 'track-pic' }, this.trackMap(t, 'track-map'), img, h('span', { class: 'track-num', text: String(i + 1) })),
        h('span', { class: 'track-name', text: t.def.name, style: `--n:${t.def.name.length}` }),
      ) as HTMLButtonElement;
      card.addEventListener('click', () => {
        this.on.click('click');
        this.on.setTrack(i);
      });
      list.append(card);
    }
  }

  /** Drei Punkte für die Schwierigkeit einer Strecke. */
  private grade(t: Track): HTMLElement {
    const g = h('span', { class: 'grade', title: `Schwierigkeit ${t.def.grade} von 3` });
    for (let n = 1; n <= 3; n++) g.append(h('i', { class: n <= t.def.grade ? 'on' : '' }));
    return g;
  }

  /** Streckenwahl (Schritt 2), Zusammenfassung und Rennoptionen (Schritt 3). */
  private renderSetup(m: LobbyModel): void {
    this.buildTracks();
    const list = $('track-list');
    // Im Turnier wird nicht gewählt, sondern gelost: alle Strecken liegen im Topf.
    const pool = m.cupRaces > 0;
    list.dataset.pool = String(pool);
    $('step2-label').textContent = pool ? 'Lostopf' : 'Strecke';
    $('track-head').textContent = pool ? 'Lostopf' : m.isHost ? 'Wähle die Strecke' : 'Die Strecke';
    $('track-sub').textContent = pool
      ? `Im Turnier wird nicht gewählt: Vor jedem Rennen lost der Streifen eine dieser ${OFFERED_TRACKS} Strecken aus.`
      : m.isHost
        ? `${OFFERED_TRACKS} Strecken – tippe eine an.`
        : 'Die Strecke wählt der Host.';
    list.querySelectorAll<HTMLButtonElement>('.track-card').forEach((card, i) => {
      const on = !pool && i === m.track;
      card.dataset.on = String(on);
      card.disabled = !m.isHost || pool;
      card.setAttribute('aria-pressed', String(on));
    });

    // Detail der gewählten Strecke – oder der Lostopf
    const t = getTrack(Math.max(0, Math.min(OFFERED_TRACKS - 1, m.track)));
    const detail = $('track-detail');
    detail.dataset.pool = String(pool);
    const img = $<HTMLImageElement>('td-img');
    const sumImg = $<HTMLImageElement>('sum-track-img');
    const meters = `${Math.round(t.length / 10) * 10} m`;
    if (pool) {
      img.removeAttribute('src');
      sumImg.removeAttribute('src');
      $('td-meta').replaceChildren(h('span', { text: `Turnier · ${m.cupRaces} Rennen` }));
      $('td-name').textContent = 'Wird ausgelost';
      $('td-blurb').textContent =
        'Vor jedem Rennen läuft ein Streifen mit allen Strecken durch und bleibt auf einer stehen. Keine kommt zweimal dran, bevor nicht alle anderen gefahren sind.';
      $('td-twist').textContent = '';
      $('sum-track-name').textContent = 'Lostopf';
      $('sum-track-meta').textContent = `${m.laps} Runden · Strecke wird ausgelost`;
    } else {
      const src = trackImage(t);
      if (img.getAttribute('src') !== src) img.src = src;
      if (sumImg.getAttribute('src') !== src) sumImg.src = src;
      $('td-meta').replaceChildren(h('span', { text: `Strecke ${t.index + 1}` }), h('span', { text: meters }), this.grade(t));
      $('td-name').textContent = t.def.name;
      $('td-blurb').textContent = t.def.blurb;
      // Was diese Strecke anders macht als die anderen
      $('td-twist').textContent = t.def.twist ?? '';
      $('sum-track-name').textContent = t.def.name;
      $('sum-track-meta').textContent = `${m.laps} ${m.laps === 1 ? 'Runde' : 'Runden'} · ${meters}`;
    }
    $('sum-track').dataset.pool = String(pool);
    // Steht ein Turnier, zeigt die linke Spalte seinen Stand statt der Strecke.
    $('sum-track').hidden = m.cup !== null;
    $('sum-track-head').textContent = m.cup !== null ? 'Turnier' : pool ? 'Turnier' : 'Strecke';
    $('start-grid').dataset.cup = String(m.cup !== null);

    const seg = $('ai-level');
    seg.dataset.off = String(!m.bots);
    for (const btn of seg.querySelectorAll<HTMLButtonElement>('button')) {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.level) === m.aiLevel));
      btn.disabled = !m.isHost || !m.bots;
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#lap-count button')) {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.laps) === m.laps));
      btn.disabled = !m.isHost;
    }
  }

  /** Einstellungen dieses Bildschirms: Grafik und Ton (im Rennen als Dialog, in der Lobby hinter dem Zahnrad). */
  showSettings(): void {
    this.showModal('Einstellungen', [this.settingsBody()], [{ label: 'Fertig', primary: true, run: () => undefined }]);
  }

  private settingsBody(): HTMLElement {
    const on = this.on;
    const cur = on.settings();
    const seg = h('div', { class: 'seg', role: 'group' });
    const labels: [SettingsModel['quality'], string][] = [
      ['auto', 'Automatisch'],
      ['low', 'Niedrig'],
      ['medium', 'Mittel'],
      ['high', 'Hoch'],
    ];
    for (const [value, label] of labels) {
      const b = h('button', { type: 'button', text: label });
      b.setAttribute('aria-pressed', String(value === cur.quality));
      b.addEventListener('click', () => {
        on.click('click');
        on.setQuality(value);
        for (const o of seg.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
      });
      seg.append(b);
    }
    const range = (value: number): HTMLInputElement => {
      const r = h('input', { type: 'range', min: '0', max: '100', step: '5' }) as HTMLInputElement;
      r.value = String(Math.round(value * 100));
      return r;
    };
    const music = range(cur.music);
    const sfx = range(cur.sfx);
    const volumes = (): void => on.setVolumes(Number(music.value) / 100, Number(sfx.value) / 100);
    music.addEventListener('input', volumes);
    sfx.addEventListener('input', volumes);
    sfx.addEventListener('change', () => on.click('click'));
    const check = (text: string, value: boolean, set: (v: boolean) => void): HTMLElement => {
      const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
      box.checked = value;
      box.addEventListener('change', () => set(box.checked));
      return h('label', { class: 'settings-check' }, box, h('span', { text }));
    };
    return h(
      'div',
      { class: 'settings' },
      h('div', { class: 'settings-row' }, h('span', { text: 'Grafik' }), seg),
      h('p', {
        class: 'settings-note',
        text: '„Automatisch“ senkt die Auflösung, sobald das Bild ruckelt. Gilt für diesen Bildschirm; die Detailstufe der Kulissen wechselt mit dem nächsten Rennen.',
      }),
      check('Bildrate im Rennen anzeigen', cur.showFps, (v) => on.setShowFps(v)),
      h('div', { class: 'settings-row' }, h('span', { text: 'Musik' }), music),
      h('div', { class: 'settings-row' }, h('span', { text: 'Geräusche' }), sfx),
      check('Ton aus', cur.muted, (v) => on.setMuted(v)),
    );
  }

  private async copyInvite(): Promise<void> {
    const input = $<HTMLInputElement>('lobby-link');
    const btn = $('btn-copy');
    let ok = false;
    try {
      await navigator.clipboard.writeText(input.value);
      ok = true;
    } catch {
      // Ohne Clipboard-API: Text markieren, dann kann man ihn von Hand kopieren.
      input.focus();
      input.select();
    }
    btn.textContent = ok ? 'Kopiert' : 'Markiert';
    window.setTimeout(() => (btn.textContent = 'Kopieren'), 1600);
  }
}
