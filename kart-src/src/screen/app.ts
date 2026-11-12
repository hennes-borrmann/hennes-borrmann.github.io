// Ablaufsteuerung eines Bildschirms (iPad/Desktop).
//
// Zustände: Startseite → Lobby (als Host oder Mitspieler) → Rennen → Lobby.
// Diese Datei verbindet die Bausteine: Signaling-Endpunkte, Lobby,
// Controller-Kopplung, Simulation, Darstellung und Diagnose.

import { GameAudio } from '../audio';
import { BUILD_ID } from '../build';
import { BOT_NAMES, botCmd, newBrain, type BotBrain } from '../game/ai';
import { ClientGame, CLIENT_INTERP_DELAY } from '../game/clientGame';
import { HostGame } from '../game/hostGame';
import { KeyboardInput, mergeInput } from '../game/input';
import { ITEM_NONE, TICK_RATE, type Cmd, type KartState } from '../game/sim';
import { COUNTDOWN_TICKS } from '../game/hostGame';
import { FixedTicker } from '../game/ticker';
import { PULSE_BUBBLE, eraAt, eraSince, gustStrength, gustWarning, planActive, portalOpen, raftAt, raftDrift, roofTop, stormLight, pontoonLift, tideLevel, tidePhase, vehicleAt } from '../game/mechanics';
import { EDGE_GLIDE, TRACK, newVehiclePose, rightX, rightZ, setTrack, vehiclePose } from '../game/track';
import { OFFERED_TRACKS } from './offered';
import type { RenderEntity } from '../game/view';
import { ClientLobby } from '../lobby/clientLobby';
import { HostLobby } from '../lobby/hostLobby';
import { cupOver, cupRanking } from '../lobby/cup';
import { ROOM_CODE_LENGTH, isValidCode, normalizeCode, randomCode, randomToken } from '../net/codes';
import { forwardDebugParams, readDebugParams } from '../net/debugParams';
import { PeerEndpoint, type EndpointStatus } from '../net/endpoint';
import type { Link, LinkOptions, PathInfo } from '../net/link';
import { loadNetSetup, type NetSetup } from '../net/netConfig';
import {
  PKT_CMD,
  PKT_SNAPSHOT,
  RACE_COUNTDOWN,
  RACE_RESULTS,
  RACE_RUNNING,
  decodeCmds,
  decodeSnapshot,
  roomPeerId,
  screenPeerId,
  type FxKind,
  type LobbyState,
  type Phase,
} from '../net/protocol';
import { DebugOverlay, type DebugRow, type DebugSection, type Tone } from '../render/debugOverlay';
import { readCrash, setCareful } from '../render/gfxGuard';
import { setPortraitRenderer } from '../render/portraits';
import { RaceScene, type KartAudio, type Quality } from '../render/raceScene';
import { $, ms } from '../util/dom';
import { keepAwake, wakeLockMode } from '../util/wakeLock';
import { ControllerPairing } from './pairing';
import { Sound, type AudioEngine, type MusicName } from './sound';
import {
  clearSession,
  loadName,
  loadScreenIdentity,
  loadSession,
  newScreenIdentity,
  saveName,
  saveSession,
  type Session,
} from './session';
import { DRAW_HOLD_MS, DRAW_SPIN_MS, ScreenUi, type CupModel, type LobbyModel, type ResultRow } from './ui';

/** Der Host schickt jeden zweiten Simulationsschritt einen Snapshot (30 pro Sekunde). */
const SNAPSHOT_EVERY = 2;

/** Ereignisse, die nur der Host kennt und deshalb an den Bildschirm des Betroffenen schickt. */
const EMPTY_HUD = {
  visible: false,
  place: 0,
  of: 0,
  lap: 0,
  laps: 0,
  timeSec: 0,
  frozenTime: false,
  item: ITEM_NONE,
  rolling: false,
  speedKmh: 0,
  finished: false,
  order: [],
  banner: null,
  bannerTone: 'info' as const,
  fps: null,
  smoke: 0,
};

const HOST_ONLY_FX = new Set<FxKind>(['hit', 'bump', 'pickup', 'finish', 'block', 'stall', 'lap', 'finallap']);

type Role = 'none' | 'host' | 'client';

function loadCharacter(): number {
  try {
    const v = Number(localStorage.getItem('kart.char') ?? '-1');
    return Number.isInteger(v) && v >= 0 && v < 4 ? v : -1;
  } catch {
    return -1;
  }
}

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Das Ton-Modul; fehlt es (oder kann der Browser keinen Ton), bleibt das Spiel stumm. */
function createAudio(): AudioEngine | null {
  try {
    return new GameAudio();
  } catch (err) {
    console.warn('[audio] Ton nicht verfügbar:', err);
    return null;
  }
}

function loadQuality(): Quality {
  const fromUrl = readDebugParams().quality;
  if (fromUrl) return fromUrl;
  try {
    const v = localStorage.getItem('kart.quality');
    if (v === 'low' || v === 'medium' || v === 'high') return v;
  } catch {
    /* kein Speicher: Vorgabe */
  }
  return 'auto';
}

function signalText(status: EndpointStatus): { value: string; tone: Tone } {
  switch (status) {
    case 'online':
      return { value: 'verbunden', tone: 'ok' };
    case 'connecting':
      return { value: 'verbinde …', tone: 'warn' };
    case 'offline':
      return { value: 'getrennt, verbinde neu …', tone: 'bad' };
    case 'id-taken':
      return { value: 'Kennung vergeben', tone: 'bad' };
    case 'unsupported':
      return { value: 'Browser ohne WebRTC', tone: 'bad' };
  }
}

function pathText(path: PathInfo | null): { value: string; tone: Tone } {
  if (!path || path.kind === 'unknown') return { value: 'wird ermittelt …', tone: undefined };
  const detail = `${path.local}→${path.remote}, ${path.protocol}`;
  if (path.kind === 'relay') return { value: `über TURN (${detail})`, tone: 'warn' };
  return { value: `direkt (${detail})`, tone: 'ok' };
}

function latencyText(rtt: number): string {
  return rtt < 0 ? 'noch keine Messung' : `${ms(rtt)} hin und zurück · ≈ ${ms(rtt / 2)} einfach`;
}

export class App {
  private readonly debug = readDebugParams();
  private readonly appRoot = new URL('.', location.href);
  private readonly linkOptions: LinkOptions;
  private setup!: NetSetup;
  private identity = loadScreenIdentity();
  private screenEp!: PeerEndpoint;
  private readonly pairing: ControllerPairing;
  private readonly keyboard = new KeyboardInput();
  private readonly ui: ScreenUi;
  private readonly overlay: DebugOverlay;
  private readonly ticker: FixedTicker;
  private scene: RaceScene | null = null;

  private role: Role = 'none';
  private roomEp: PeerEndpoint | null = null;
  private hostLobby: HostLobby | null = null;
  private hostGame: HostGame | null = null;
  private clientLobby: ClientLobby | null = null;
  private clientGame: ClientGame | null = null;
  private playerToken = '';
  private roomPeerToken = '';
  private inGame = false;
  /** Autopilot (?auto=1): die KI lenkt das eigene Kart. */
  private autoBrain: BotBrain | null = null;
  private shownRaceId = -1;
  private resultsShown = false;
  /** Host, Turnier: Zeitgeber, der nach der Auslosung das Rennen startet (0 = keiner läuft). */
  private drawTimer = 0;
  /** Nummer der Auslosung, die dieser Bildschirm zuletzt gezeigt hat. */
  private shownDrawId = -1;
  private lastHudJson = '';
  private lastHudAt = 0;
  private joinStartedAt = 0;
  private lastSaveJson = '';
  private quality: Quality = loadQuality();
  /** Zuletzt gewählte Figur, -1 = noch keine Wahl (dann gilt die Standardfigur des Platzes). */
  private character = loadCharacter();
  private showFps = loadFlag('kart.fps');
  private readonly sound: Sound;
  private readonly kartAudio: KartAudio[] = [];
  /** Bis wann "Letzte Runde!" eingeblendet bleibt (ms). */
  private finalLapUntil = 0;
  /** Seit wann das eigene Kart falsch herum fährt (ms), 0 = gar nicht. */
  private wrongWaySince = 0;
  private mapTick = 0;

  private readonly ents: RenderEntity[] = [];
  private lastCmd: Cmd = { steer: 0, buttons: 0 };
  private lastFrame = 0;
  private lastOverlay = 0;
  private frames = 0;
  private ticks = 0;
  private seconds = 0;
  private readonly rates = { fps: 0, tick: 0, ctrl: 0, snap: 0, peakCorrection: 0 };
  private readonly prev = { ctrl: 0, snap: 0 };
  private hostPath: PathInfo | null = null;
  private readonly seatPaths = new Map<number, PathInfo>();
  private readonly seatRates = new Map<number, { received: number; dropped: number; queued: number }>();

  constructor() {
    // Zeitlimit ohne Lebenszeichen: lang genug, dass WebRTC einen kurzen
    // Funkaussetzer selbst überbrückt und ein kurz hängender Browser nicht
    // gleich als weg gilt. Wer die Seite schließt, meldet sich ohnehin sofort ab.
    this.linkOptions = {
      openTimeoutMs: 15_000,
      idleTimeoutMs: 8000,
      netSim: { lag: this.debug.lag, jitter: this.debug.jitter, loss: this.debug.loss },
    };
    this.sound = new Sound(createAudio(), this.debug.mute);
    this.pairing = new ControllerPairing(() => this.pairedInfo());
    this.pairing.onChange = () => {
      this.reportController();
      this.refresh();
    };
    this.ticker = new FixedTicker(() => this.step(), 1000 / TICK_RATE);
    this.overlay = new DebugOverlay($('debug'));
    this.overlay.visible = this.debug.debugOverlay;

    this.ui = new ScreenUi({
      create: (name) => void this.createLobby(name),
      join: (code, name) => this.joinLobby(code, name, null),
      ready: (ready) => this.clientLobby?.setReady(ready),
      start: () => {
        const lobby = this.hostLobby;
        if (!lobby || !lobby.canStart() || this.drawTimer !== 0) return;
        if (lobby.cupRaces > 0 || lobby.cupRunning()) {
          // Turnier: erst die Strecke auslosen, das Rennen beginnt danach von selbst.
          if (!lobby.cupRunning()) lobby.startCup();
          this.beginDraw();
        } else lobby.setPhase('game');
      },
      setCupRaces: (races) => this.hostLobby?.setCupRaces(races),
      nextRace: () => {
        const lobby = this.hostLobby;
        if (!lobby || !lobby.cupRunning() || this.drawTimer !== 0) return;
        // Erst losen, dann zurück in die Lobby: so kommen Auslosung und Wechsel der Ansicht in einer Meldung an.
        this.beginDraw();
        lobby.setPhase('lobby');
      },
      endCup: () => {
        const lobby = this.hostLobby;
        if (!lobby) return;
        this.cancelDraw();
        lobby.endCup();
        lobby.setPhase('lobby');
      },
      drawTick: () => this.sound.ui('click'),
      drawStop: () => this.sound.ui('ready'),
      again: () => {
        if (!this.hostGame || !this.hostLobby || this.hostLobby.cup) return;
        this.hostGame.setRoster(this.hostLobby.slots(), this.hostLobby.bots, this.hostLobby.characters());
        this.hostGame.newRace();
      },
      setBots: (bots) => this.hostLobby?.setBots(bots),
      setAiLevel: (level) => this.hostLobby?.setAiLevel(level),
      setLaps: (laps) => this.hostLobby?.setLaps(laps),
      setTrack: (track) => this.hostLobby?.setTrack(Math.max(0, Math.min(OFFERED_TRACKS - 1, track))),
      setCharacter: (character) => {
        this.character = character;
        try {
          localStorage.setItem('kart.char', String(character));
        } catch {
          /* gilt dann nur für diese Sitzung */
        }
        this.hostLobby?.setLocalCharacter(character);
        this.clientLobby?.setCharacter(character);
      },
      setQuality: (q) => this.setQuality(q),
      leave: () => this.leave(),
      backToLobby: () => {
        if (this.hostLobby) this.hostLobby.setPhase('lobby');
        else this.leave();
      },
      toggleCamera: () => {
        if (!this.scene) return;
        this.scene.cameraMode = this.scene.cameraMode === 'chase' ? 'top' : 'chase';
        this.ui.setCameraLabel(this.scene.cameraMode === 'top');
      },
      setVolumes: (music, sfx) => this.sound.setVolumes(music, sfx),
      setMuted: (muted) => this.sound.setMuted(muted),
      setShowFps: (show) => {
        this.showFps = show;
        try {
          localStorage.setItem('kart.fps', show ? '1' : '0');
        } catch {
          /* gilt dann nur für diese Sitzung */
        }
      },
      settings: () => ({ quality: this.quality, ...this.sound.volumes(), muted: this.sound.muted, showFps: this.showFps }),
      click: (kind) => {
        this.sound.unlock();
        this.sound.ui(kind);
      },
      toggleDebug: () => (this.overlay.visible = !this.overlay.visible),
      showPairing: () => this.ui.showPairingModal(this.pairUrl(), this.pairing.connected),
      nameChanged: (name) => {
        saveName(name);
        this.hostLobby?.setLocalName(name);
        this.clientLobby?.setName(name);
      },
      gesture: () => {
        this.sound.unlock();
        void keepAwake();
      },
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2') this.overlay.visible = !this.overlay.visible;
    });
    this.sound.music('menu');
    // Ton darf erst nach einer Nutzeraktion starten – jede Berührung oder Taste genügt.
    const unlock = (): void => this.sound.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    // Beim Verlassen/Neuladen der Seite die Verbindungen aktiv schließen, damit
    // die Gegenseiten nicht erst auf ein Zeitlimit warten müssen.
    // Die Seite wird regulär verlassen: eine stehende Marke des behutsamen Aufbaus wäre kein Absturz.
    window.addEventListener('pagehide', () => this.scene?.leave());
    window.addEventListener('pagehide', () => {
      this.hostLobby?.dropLinks();
      this.clientLobby?.link?.close();
      this.pairing.link?.close();
    });

    this.installTestHook();
  }

  async boot(): Promise<void> {
    this.setup = await loadNetSetup(this.appRoot);
    this.initScreenEndpoint();

    const params = new URLSearchParams(location.search);
    const urlCode = normalizeCode(params.get('room') ?? '');
    const session = loadSession();
    const name = loadName();
    this.ui.setHome(name, isValidCode(urlCode, ROOM_CODE_LENGTH) ? urlCode : '');
    this.ui.setVersion(BUILD_ID);
    // Test-Schalter ?aufbau=behutsam: Ist die Grafik beim letzten Mal gestorben, während das erste Bild Teil für
    // Teil entstand? Dann steht im Speicher des Browsers, bei welchem Teil.
    setCareful(this.debug.careful);
    if (this.debug.careful) {
      const crash = readCrash();
      this.gfxBoot = crash
        ? `Beim letzten Start (${crash.where}) ging die Grafik verloren – beim Vorbereiten von „${crash.label}“${crash.prev ? ` (davor: „${crash.prev}“)` : ''}. Diese Teile werden jetzt ausgelassen.`
        : 'Behutsamer Aufbau ist eingeschaltet (Test-Schalter): das erste Bild entsteht Teil für Teil.';
    }
    // Die 3D-Grafik gleich jetzt anlegen (siehe createScene). Klappt es nicht, entstehen vorerst keine Porträts,
    // und beim Rennstart wird es noch einmal versucht – dort mit Meldung.
    this.createScene();

    requestAnimationFrame(this.frame);
    window.setInterval(() => this.everySecond(), 1000);

    if (session && (!urlCode || urlCode === session.code)) {
      // Seite wurde neu geladen: dort weitermachen, wo wir waren.
      if (session.role === 'host') this.resumeHost(session, name);
      else this.joinLobby(session.code, name, session.playerToken);
      return;
    }
    if (session) clearSession();
    this.ui.show('home');
    if (isValidCode(urlCode, ROOM_CODE_LENGTH)) {
      this.ui.setHomeMessage(
        name ? `Einladung in Lobby ${urlCode}. Tippe auf „Beitreten“.` : `Einladung in Lobby ${urlCode}. Trag deinen Namen ein und tritt bei.`,
      );
    }
  }

  // --- Signaling für diesen Bildschirm ------------------------------------

  private initScreenEndpoint(): void {
    const ep = new PeerEndpoint(screenPeerId(this.identity.screenId), this.identity.peerToken, this.setup, this.linkOptions);
    this.screenEp = ep;
    ep.onIncoming = (link) => {
      if (link.metadata.role === 'controller') this.pairing.accept(link);
      else link.close();
    };
    ep.onStatus = (status) => {
      if (status === 'id-taken' && this.screenEp === ep) {
        // Kennung belegt (z. B. duplizierter Tab): neue Kennung, neuer QR-Code.
        ep.destroy();
        this.identity = newScreenIdentity();
        this.initScreenEndpoint();
      }
      this.refresh();
    };
  }

  // --- Host -----------------------------------------------------------------

  private async createLobby(name: string): Promise<void> {
    saveName(name);
    this.ui.setHomeBusy(true);
    this.ui.setHomeMessage('Erstelle Lobby …');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode(ROOM_CODE_LENGTH);
      const token = randomToken();
      const ep = new PeerEndpoint(roomPeerId(code), token, this.setup, this.linkOptions);
      const result = await this.waitForEndpoint(ep, 12_000);
      if (result === 'online') {
        this.ui.setHomeBusy(false);
        this.ui.setHomeMessage('');
        this.becomeHost(code, token, ep, randomToken(), name, undefined);
        return;
      }
      ep.destroy();
      if (result !== 'id-taken') {
        this.ui.setHomeBusy(false);
        this.ui.setHomeMessage(
          result === 'unsupported'
            ? 'Dieser Browser unterstützt kein WebRTC.'
            : 'Der Signaling-Server ist nicht erreichbar. Prüf die Internetverbindung und versuch es noch einmal.',
          'bad',
        );
        return;
      }
    }
    this.ui.setHomeBusy(false);
    this.ui.setHomeMessage('Es ließ sich kein freier Raumcode finden. Versuch es noch einmal.', 'bad');
  }

  private waitForEndpoint(ep: PeerEndpoint, timeoutMs: number): Promise<EndpointStatus | 'timeout'> {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve('timeout'), timeoutMs);
      const check = (status: EndpointStatus): void => {
        if (status === 'online' || status === 'id-taken' || status === 'unsupported') {
          window.clearTimeout(timer);
          resolve(status);
        }
      };
      ep.onStatus = check;
      check(ep.status);
    });
  }

  private resumeHost(session: Session, name: string): void {
    const token = session.roomPeerToken ?? randomToken();
    const ep = new PeerEndpoint(roomPeerId(session.code), token, this.setup, this.linkOptions);
    this.becomeHost(session.code, token, ep, session.playerToken, name || 'Host', session.hostSave);
  }

  private becomeHost(
    code: string,
    roomPeerToken: string,
    ep: PeerEndpoint,
    playerToken: string,
    name: string,
    saved: Session['hostSave'],
  ): void {
    this.role = 'host';
    this.roomEp = ep;
    this.playerToken = playerToken;
    this.roomPeerToken = roomPeerToken;
    const lobby = new HostLobby(code, playerToken, name, saved);
    if (!saved) {
      if (this.debug.track >= 0) lobby.track = Math.min(OFFERED_TRACKS - 1, this.debug.track);
      if (this.debug.ai >= 0) lobby.aiLevel = this.debug.ai;
    }
    lobby.track = Math.min(OFFERED_TRACKS - 1, lobby.track);
    if (!saved && this.character >= 0) lobby.setLocalCharacter(this.character);
    this.hostLobby = lobby;

    ep.onIncoming = (link) => {
      if (link.metadata.role === 'screen') lobby.accept(link);
      else link.close();
    };
    ep.onStatus = (status) => {
      if (status === 'id-taken' && this.roomEp === ep) {
        // Der Raum gehört inzwischen einem anderen Tab/Gerät.
        this.teardown();
        this.ui.show('home');
        this.ui.setHomeMessage(`Die Lobby ${code} wird bereits von einem anderen Bildschirm geführt.`, 'bad');
        return;
      }
      this.refresh();
    };
    lobby.onChange = () => {
      this.persistHost();
      this.refresh();
    };
    lobby.onSeatsChanged = () => this.hostGame?.setRoster(lobby.slots(), lobby.bots, lobby.characters());
    lobby.onPlayerLink = (slot) => {
      this.hostGame?.resetInput(slot);
      this.hostGame?.setOnline(slot, true);
    };
    lobby.onPlayerDown = (slot) => this.hostGame?.setOnline(slot, false);
    lobby.onFast = (slot, view) => {
      if (!this.hostGame || view.getUint8(0) !== PKT_CMD) return;
      const d = decodeCmds(view);
      if (d) this.hostGame.receiveCmds(slot, d.newestSeq, d.cmds, d.times, d.raceId);
    };

    this.setRoomInUrl(code);
    this.persistHost();
    this.reportController();
    this.ui.show('lobby');
    this.refresh();
  }

  private persistHost(): void {
    if (!this.hostLobby) return;
    const hostSave = this.hostLobby.toSave();
    const json = JSON.stringify(hostSave);
    if (json === this.lastSaveJson) return;
    this.lastSaveJson = json;
    saveSession({
      role: 'host',
      code: this.hostLobby.code,
      playerToken: this.playerToken,
      roomPeerToken: this.roomPeerToken,
      hostSave,
    });
  }

  // --- Mitspieler -----------------------------------------------------------

  private joinLobby(code: string, name: string, resumeToken: string | null): void {
    saveName(name);
    this.role = 'client';
    this.joinStartedAt = Date.now();
    this.playerToken = resumeToken ?? randomToken();
    this.ui.setHomeBusy(true);
    this.ui.setHomeMessage(resumeToken ? `Kehre in Lobby ${code} zurück …` : `Verbinde mit Lobby ${code} …`);
    this.ui.show('home');

    const lobby = new ClientLobby(() => this.screenEp, code, this.playerToken, name || 'Spieler', resumeToken !== null, this.character);
    this.clientLobby = lobby;
    lobby.onFast = (view) => {
      if (!this.clientGame || view.getUint8(0) !== PKT_SNAPSHOT) return;
      const snap = decodeSnapshot(view);
      if (snap) this.clientGame.onSnapshot(snap, performance.now() / 1000);
    };
    lobby.onLinkUp = () => {
      this.clientGame?.resync();
      this.reportController();
    };
    lobby.onFx = (kind) => this.localFx(kind);
    lobby.onChange = () => this.onClientChange(lobby);
  }

  private onClientChange(lobby: ClientLobby): void {
    if (this.clientLobby !== lobby) return;
    if (lobby.isFinal) {
      const code = lobby.code;
      const status = lobby.status;
      const reason = lobby.rejectReason;
      this.teardown();
      this.ui.show('home');
      this.ui.setHome(loadName(), code);
      const turnHint = this.setup.turn.available
        ? 'Ein TURN-Server ist eingerichtet, die Verbindung kam trotzdem nicht zustande.'
        : 'Es ist kein TURN-Server eingerichtet. In Mobilfunk-, Schul- und Firmennetzen kommt dann oft keine direkte Verbindung zustande.';
      const texts: Record<string, [string, string]> = {
        'not-found': ['Lobby nicht gefunden', `Unter dem Code ${code} läuft gerade keine Lobby. Prüf den Code oder frag den Host.`],
        unreachable: ['Keine Verbindung zum Host', `Die Lobby ${code} existiert, aber die beiden Geräte erreichen sich nicht. ${turnHint}`],
        closed: ['Lobby geschlossen', 'Der Host hat die Lobby geschlossen.'],
        lost: ['Host nicht mehr erreichbar', 'Der Host hat die Lobby verlassen oder seine Verbindung verloren. Die Lobby ist beendet.'],
        replaced: ['In einem anderen Tab aktiv', 'Dein Platz wird jetzt von einem anderen Tab oder Gerät genutzt.'],
      };
      let [title, text] = texts[status] ?? ['Verbindung beendet', ''];
      if (status === 'rejected') {
        if (reason === 'full') [title, text] = ['Lobby ist voll', 'Alle vier Plätze sind belegt.'];
        else if (reason === 'running') {
          [title, text] = ['Rennen läuft bereits', 'Neue Spieler können erst beitreten, wenn der Host zurück in der Lobby ist.'];
        } else [title, text] = ['Versionen passen nicht zusammen', 'Lade die Seite auf beiden Geräten neu.'];
      }
      this.ui.showModal(title, [text], [{ label: 'Zur Startseite', primary: true, run: () => undefined }]);
      return;
    }
    if (lobby.status === 'joined' && lobby.state) {
      if (this.ui.view === 'home' || this.ui.view === 'boot') {
        this.ui.setHomeBusy(false);
        this.ui.setHomeMessage('');
        this.setRoomInUrl(lobby.code);
        saveSession({ role: 'client', code: lobby.code, playerToken: this.playerToken });
        this.ui.show('lobby');
      }
    }
    this.refresh();
  }

  // --- Gemeinsam ------------------------------------------------------------

  private leave(): void {
    if (this.hostLobby) this.hostLobby.close();
    this.clientLobby?.leave();
    const roomEp = this.roomEp;
    this.roomEp = null;
    // Kurz warten, damit die Abschiedsnachricht noch rausgeht.
    if (roomEp) window.setTimeout(() => roomEp.destroy(), 600);
    this.teardown();
    this.ui.setHome(loadName(), '');
    this.ui.setHomeMessage('');
    this.ui.show('home');
  }

  /** Räumt alles ab, was zu einer Lobby gehört. */
  private teardown(): void {
    this.cancelDraw();
    this.ui.hideDraw();
    this.shownDrawId = -1;
    this.exitGame();
    this.clientLobby?.dispose();
    this.clientLobby = null;
    this.hostLobby?.close();
    this.hostLobby = null;
    this.roomEp?.destroy();
    this.roomEp = null;
    this.role = 'none';
    this.lastSaveJson = '';
    this.hostPath = null;
    this.seatPaths.clear();
    clearSession();
    this.setRoomInUrl(null);
    this.ui.setHomeBusy(false);
    this.ui.setBanner(null);
    this.pairing.pushInfo();
  }

  private lobbyState(): LobbyState | null {
    if (this.hostLobby) return this.hostLobby.state();
    return this.clientLobby?.state ?? null;
  }

  private localSlot(): number {
    if (this.hostLobby) return this.hostLobby.localSlot;
    return this.clientLobby?.slot ?? -1;
  }

  private pairedInfo(): { name: string; slot: number; room: string | null; phase: string } {
    const state = this.lobbyState();
    const slot = this.localSlot();
    const me = state?.players.find((p) => p.slot === slot);
    return { name: me?.name ?? loadName(), slot: me ? slot : -1, room: state?.code ?? null, phase: state?.phase ?? 'home' };
  }

  private pairUrl(): string {
    const url = forwardDebugParams(new URL('c/', this.appRoot));
    url.searchParams.set('s', this.identity.screenId);
    return url.href;
  }

  private inviteUrl(code: string): string {
    const url = forwardDebugParams(new URL(this.appRoot.href));
    url.searchParams.set('room', code);
    return url.href;
  }

  private setRoomInUrl(code: string | null): void {
    const url = new URL(location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }

  private reportController(): void {
    const connected = this.pairing.connected;
    const rtt = connected ? this.pairing.rtt : -1;
    this.hostLobby?.setLocalController(connected, rtt);
    this.clientLobby?.reportStatus(connected, rtt);
  }

  private refresh(): void {
    this.updateBanner();
    const state = this.lobbyState();
    if (!state || this.role === 'none') return;
    if (this.clientLobby && this.clientLobby.slot < 0) return;
    const slot = this.localSlot();
    const me = state.players.find((p) => p.slot === slot);
    const model: LobbyModel = {
      code: state.code,
      inviteUrl: this.inviteUrl(state.code),
      pairUrl: this.pairUrl(),
      players: state.players,
      localSlot: slot,
      isHost: this.role === 'host',
      canStart: this.hostLobby?.canStart() ?? false,
      bots: state.bots,
      aiLevel: state.aiLevel,
      laps: state.laps,
      track: state.track,
      cupRaces: state.cupRaces,
      cup: this.cupModel(state),
      character: me?.character ?? Math.max(0, slot),
      quality: this.quality,
      waitingFor: state.players.filter((p) => !p.isHost && p.online && !p.ready).map((p) => p.name),
      localReady: me?.ready ?? false,
      controllerConnected: this.pairing.connected,
      controllerState: this.pairing.input.fresh ? 'active' : this.pairing.input.lastPacketAt === 0 ? 'waiting' : 'silent',
      controllerMismatch: this.pairing.buildMismatch,
      controllerRtt: this.pairing.rtt,
    };
    this.ui.renderLobby(model);
    this.scene?.setRoster(this.drivers(state));
    this.pairing.pushInfo();
    this.syncPhase(state.phase);
    this.syncDraw(state);
    // Im Turnier trifft die Wertung bei Mitspielern etwas nach dem Rennende ein: Ergebnisliste nachziehen.
    if (this.inGame && this.resultsShown) this.showResults();
  }

  /** Stand des Turniers mit Namen und Rängen, wie ihn Lobby und Ergebnisliste zeigen. */
  private cupModel(state: LobbyState): CupModel | null {
    const cup = state.cup;
    if (!cup) return null;
    const drivers = new Map(this.drivers(state).map((d) => [d.slot, d]));
    const local = this.localSlot();
    return {
      races: cup.races,
      done: cup.done,
      over: cupOver(cup),
      rows: cupRanking(cup, [...drivers.keys()]).map((r) => {
        const d = drivers.get(r.slot)!;
        return { rank: r.rank, slot: r.slot, name: d.name, bot: d.bot, me: r.slot === local, character: d.character, stars: r.stars, gain: cup.done > 0 ? r.last : 0 };
      }),
    };
  }

  /** Zeigt eine neue Auslosung (alle Bildschirme) und räumt sie weg, wenn sie abgesagt wurde. */
  private syncDraw(state: LobbyState): void {
    const draw = state.cup?.draw ?? null;
    if (!draw) {
      this.shownDrawId = -1;
      if (!this.inGame) this.ui.hideDraw();
      return;
    }
    if (state.phase !== 'lobby' || draw.id === this.shownDrawId) return;
    this.shownDrawId = draw.id;
    this.ui.showDraw(draw, (state.cup?.done ?? 0) + 1, state.cup?.races ?? 0);
  }

  /** Host: lost die nächste Strecke aus; ist der Streifen durchgelaufen, beginnt das Rennen. */
  private beginDraw(): void {
    const lobby = this.hostLobby;
    if (!lobby || this.drawTimer !== 0) return;
    if (lobby.beginDraw(OFFERED_TRACKS, Math.random) < 0) return;
    this.drawTimer = window.setTimeout(() => {
      this.drawTimer = 0;
      if (this.hostLobby !== lobby || !lobby.finishDraw()) return;
      lobby.setPhase('game');
    }, DRAW_SPIN_MS + DRAW_HOLD_MS);
  }

  private cancelDraw(): void {
    window.clearTimeout(this.drawTimer);
    this.drawTimer = 0;
  }

  private updateBanner(): void {
    const lobby = this.clientLobby;
    if (lobby && lobby.status === 'reconnecting') {
      const left = Math.max(0, Math.ceil((lobby.deadline - Date.now()) / 1000));
      this.ui.setBanner(`Verbindung zum Host unterbrochen – verbinde neu … (noch ${left} s)`, 'bad');
      return;
    }
    if (lobby && lobby.status === 'joined' && lobby.buildMismatch) {
      this.ui.setBanner('Dieser Bildschirm und der Host nutzen unterschiedliche Fassungen der Seite. Bitte auf beiden die Seite neu laden.');
      return;
    }
    if (this.role === 'host' && this.roomEp?.status === 'offline') {
      this.ui.setBanner(
        'Signaling-Server nicht erreichbar – neue Spieler können gerade nicht beitreten. Bestehende Verbindungen laufen weiter.',
      );
      return;
    }
    if (this.role !== 'none' && this.screenEp.status === 'offline') {
      this.ui.setBanner('Signaling-Server nicht erreichbar – ein Handy lässt sich gerade nicht neu koppeln.');
      return;
    }
    this.ui.setBanner(null);
  }

  // --- Rennen ---------------------------------------------------------------

  private syncPhase(phase: Phase): void {
    // (Nach einem gescheiterten Aufbau der 3D-Szene nicht bei jeder Meldung der Lobby neu anlaufen: jeder Anlauf legt
    // Grafikkontexte an. Weiter geht es über „Erneut versuchen“ im Dialog.)
    if (phase !== 'game') this.sceneFailed = false;
    if (phase === 'game' && !this.inGame) {
      if (!this.sceneFailed) this.enterGame();
    } else if (phase === 'lobby' && this.inGame) {
      this.exitGame();
      this.ui.show('lobby');
    }
  }

  /** Alle Fahrer mit Namen: Menschen aus der Lobby, auf freien Plätzen die KI. */
  private drivers(state: LobbyState): { slot: number; name: string; bot: boolean; character: number }[] {
    const list: { slot: number; name: string; bot: boolean; character: number }[] = [];
    for (let slot = 0; slot < BOT_NAMES.length; slot++) {
      const p = state.players.find((x) => x.slot === slot);
      if (p) list.push({ slot, name: p.name, bot: false, character: p.character });
      else if (state.bots) list.push({ slot, name: BOT_NAMES[slot], bot: true, character: slot });
    }
    return list;
  }

  private enterGame(): void {
    const state = this.lobbyState();
    if (!state) return;
    this.ui.show('game');
    this.ui.hideDraw();
    this.gfxRebuilt = false;
    this.gfxRebuilds = 0;
    this.gfxSkippedAtRebuild = 0;
    this.gfxHistory.length = 0;
    if (this.gfxBoot) this.gfxHistory.push(this.gfxBoot);
    this.gfxHidden = '';
    setTrack(state.track);
    // Die Szene (und mit ihr die eine 3D-Grafik der Seite) steht normalerweise schon seit dem Laden.
    this.ui.cancelPortraits();
    // Hat der Browser die Grafik inzwischen verloren (etwa im Hintergrund), entsteht die Szene auf frischer Fläche neu.
    if (this.scene?.gfx.isLost) {
      const lost = this.scene;
      this.scene = null;
      lost.release();
    }
    if (!this.scene) {
      const errors = this.createScene();
      this.sceneFailed = !this.scene;
      if (!this.scene) {
        this.ui.showModal('3D-Darstellung nicht möglich', sceneFailure(errors), [
          { label: 'Erneut versuchen', primary: true, run: () => this.enterGame() },
          { label: 'Schließen', run: () => undefined },
        ]);
        return;
      }
    }
    // Beim Laden war die Zeichenfläche noch verborgen: jetzt auf ihre wirkliche Größe bringen.
    this.scene.resize();
    this.scene.setTrack();
    this.scene.reset();
    this.ui.setCameraLabel(false);
    this.scene.onEvent = (e) => this.sound.sceneEvent(e);
    this.scene.setRoster(this.drivers(state));
    this.sound.music(TRACK.def.theme as MusicName);
    this.finalLapUntil = 0;
    this.wrongWaySince = 0;
    this.autoBrain = this.debug.autopilot ? newBrain(this.localSlot()) : null;
    this.shownRaceId = -1;
    this.resultsShown = false;
    this.lastHudJson = '';
    if (this.hostLobby) {
      const lobby = this.hostLobby;
      const game = new HostGame(lobby.localSlot, { laps: this.debug.laps || lobby.laps, aiLevel: lobby.aiLevel });
      this.hostGame = game;
      game.setRoster(lobby.slots(), lobby.bots, lobby.characters());
      for (const p of lobby.state().players) if (!p.isHost) game.setOnline(p.slot, p.online);
      game.onFx = (slot, kind) => {
        if (slot === lobby.localSlot) this.localFx(kind);
        // Was ein Mitspieler selbst vorhersagt (Schub, Bande, Item bereit, Start, Landung,
        // Absturz), meldet sein eigener Bildschirm ohne Umweg; hier nur, was allein der Host weiß.
        else if (HOST_ONLY_FX.has(kind)) lobby.sendFx(slot, kind);
      };
      game.newRace();
    } else if (this.clientLobby) {
      const lobby = this.clientLobby;
      this.clientGame = new ClientGame(lobby.slot, () => lobby.link?.rtt ?? -1);
      this.clientGame.onFx = (kind) => this.localFx(kind);
    }
    this.inGame = true;
    // Im Rennen stört die Diagnose; über den Knopf „Diagnose“ lässt sie sich einblenden.
    this.overlay.visible = this.debug.debugInRace;
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.ticker.start();
  }

  private exitGame(): void {
    if (!this.inGame) return;
    this.inGame = false;
    this.scene?.leave();
    this.ticker.stop();
    this.hostGame = null;
    this.clientGame = null;
    this.ents.length = 0;
    this.lastCmd = { steer: 0, buttons: 0 };
    this.ui.hideResults();
    this.ui.setCountdown(null);
    this.ui.renderRaceHud({ ...EMPTY_HUD });
    this.ui.setRaceTitle(null);
    this.sound.update(0, null);
    this.sound.music('menu');
    this.overlay.visible = this.debug.debugOverlay;
    this.sendHud(true);
  }

  private setQuality(q: Quality): void {
    this.quality = q;
    try {
      localStorage.setItem('kart.quality', q);
    } catch {
      /* ohne Speicher gilt die Wahl nur für diese Sitzung */
    }
    this.scene?.setQuality(q);
    this.refresh();
  }

  /** Ein spürbares Ereignis für diesen Spieler: ans Handy weiterreichen. */
  private localFx(kind: FxKind): void {
    this.pairing.sendFx(kind);
    this.sound.fx(kind);
    if (kind === 'finallap') this.finalLapUntil = performance.now() + 2600;
  }

  private localState(): KartState | null {
    if (this.hostGame) return this.hostGame.authoritative(this.hostGame.localSlot);
    if (this.clientGame?.ready) return this.clientGame.predictedState();
    return null;
  }

  /** Ein Simulationsschritt (60 pro Sekunde). */
  private step(): void {
    this.ticks++;
    const now = performance.now() / 1000;
    const ctrl = this.pairing.connected ? this.pairing.input.sample() : null;
    let cmd = mergeInput(ctrl, this.keyboard.sample(), this.keyboard.steering);
    if (this.autoBrain) {
      const state = this.localState();
      const canDrive = this.hostGame ? this.hostGame.localCanDrive() : (this.clientGame?.localCanDrive(now) ?? false);
      const time = Math.floor((this.hostGame ?? this.clientGame)?.race(now).time ?? 0);
      if (state) cmd = botCmd(state, this.autoBrain, [], canDrive, { tick: this.ticks, time, place: 1, smoke: false });
    }
    this.lastCmd = cmd;
    if (this.hostGame && this.hostLobby) {
      this.hostGame.step(cmd);
      if (this.hostGame.tick % SNAPSHOT_EVERY === 0) this.hostLobby.broadcastFast(this.hostGame.snapshot());
    } else if (this.clientGame && this.clientLobby) {
      const packet = this.clientGame.tick(cmd, now);
      if (packet) this.clientLobby.sendFast(packet);
    }
  }

  /** Grafik-Meldung: zuletzt gezeigter Text, seit wann der Kontext fehlt, ob schon von selbst neu aufgebaut wurde, was vorher war. */
  /** Die 3D-Szene ließ sich beim Rennstart nicht anlegen (Dialog steht): kein selbsttätiger neuer Anlauf. */
  private sceneFailed = false;
  private gfxShown = '';
  /** Befund vom Laden der Seite: wobei die Grafik beim letzten Mal starb (gfxGuard.ts). */
  private gfxBoot = '';
  /** Befund, den der Spieler ausgeblendet hat – er kommt erst wieder, wenn sich etwas ändert. */
  private gfxHidden = '';
  private gfxLostSince = 0;
  private gfxRebuilt = false;
  private gfxRebuilds = 0;
  private gfxSkippedAtRebuild = 0;
  private readonly gfxHistory: string[] = [];

  private readonly frame = (): void => {
    requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.frames++;

    if (this.inGame && this.scene) {
      const alpha = this.ticker.advance();
      const view = this.hostGame ?? this.clientGame;
      if (view) {
        const t = now / 1000;
        view.entities(alpha, t, dt, this.ents);
        const race = view.race(t);
        this.scene.frame(this.ents, view.localSlot, dt, race, view.things(t));
        this.updateRaceUi(race, now);
        this.sound.update(dt, race.phase === RACE_RESULTS ? null : this.scene.kartAudio(this.kartAudio));
        if (++this.mapTick % 3 === 0) this.ui.drawMinimap(TRACK, this.ents, view.localSlot);
      }
    }

    if (this.inGame) this.overlay.setInput(this.lastCmd.steer / 127, this.lastCmd.buttons);
    else if (this.pairing.connected && this.pairing.input.fresh) {
      this.overlay.setInput(this.pairing.input.steer / 127, this.pairing.input.buttons);
    } else this.overlay.setInput(0, 0);

    if (now - this.lastOverlay > 250) {
      this.lastOverlay = now;
      if (this.overlay.visible) this.overlay.setSections(this.collectDebug());
      this.checkGraphics(now);
    }
  };

  /**
   * Legt die Rennszene an – und mit ihr die eine 3D-Grafik der Seite, die auch die Porträts der Lobby zeichnet.
   * Sie entsteht beim Laden und bleibt bis zum Schließen der Seite: Auf einem iPad kam ein Kontext, der erst beim
   * Rennstart angelegt wurde, schon verloren an.
   * @returns der Fehler, falls es nicht klappt (sonst leer)
   */
  private createScene(): unknown[] {
    const errors: unknown[] = [];
    if (!this.scene) {
      try {
        // (Die Szene probiert selbst mehrere Einstellungen durch, jede auf einer frischen Zeichenfläche.)
        this.scene = new RaceScene($<HTMLCanvasElement>('stage'), this.quality);
      } catch (err) {
        console.error(err);
        errors.push(err);
      }
    }
    setPortraitRenderer(this.scene ? this.scene.gl : null);
    return errors;
  }

  /** Zeichnet der Browser die Szene nicht (Kontext verloren, Programme abgelehnt, Bild schwarz), steht es auf dem Bildschirm. */
  private checkGraphics(now: number): void {
    const scene = this.scene;
    if (!scene || !this.inGame) {
      if (this.gfxShown) {
        this.gfxShown = '';
        this.ui.setGfxNote(null);
      }
      return;
    }
    const g = scene.gfx;
    // Bleibt der Kontext länger verloren, einmal von selbst auf einer frischen Zeichenfläche neu aufbauen.
    // (Noch einmal, wenn der behutsame Aufbau inzwischen ein weiteres Teil als Auslöser gefunden hat – höchstens sechsmal.)
    if (g.isLost) {
      if (!this.gfxLostSince) this.gfxLostSince = now;
      else if (now - this.gfxLostSince > 1500 && (!this.gfxRebuilt || (g.skipped.length > this.gfxSkippedAtRebuild && this.gfxRebuilds < 6))) {
        this.gfxRebuilt = true;
        this.gfxRebuilds++;
        this.gfxSkippedAtRebuild = g.skipped.length;
        this.rebuildScene('von selbst');
        return;
      }
    } else this.gfxLostSince = 0;
    // Behutsamer Aufbau läuft: statt eines schwarzen Bildes steht da, was geschieht.
    if (g.warm >= 0 && !g.isLost) {
      const text = `Grafik wird vorbereitet … ${Math.round(g.warm * 100)} %`;
      if (text !== this.gfxShown) {
        this.gfxShown = text;
        this.ui.setGfxNote([text, 'Beim ersten Rennen auf einer Strecke dauert das ein paar Sekunden.'], undefined, undefined, 'Einen Moment');
      }
      return;
    }
    const lines = [...this.gfxHistory];
    if (g.skipped.length > 0) lines.push(`Ausgelassen, weil es hier die Grafik beendet hat: ${g.skipped.map((l) => `„${l}“`).join(', ')}.`);
    if (g.lost > 0) lines.push(`Der Browser hat die 3D-Grafik beendet: ${g.lost}× (zuerst ${g.lostWhen}), wiederhergestellt ${g.restored}×.`);
    if (g.shaderErrors.length > 0) lines.push(`Grafikprogramm abgelehnt (${g.shaderErrors.length}): ${g.shaderErrors[0]}`);
    if (lines.length === 0) {
      if (this.gfxShown) {
        this.gfxShown = '';
        this.ui.setGfxNote(null);
      }
      return;
    }
    // Nur neu aufbauen, wenn sich am Befund etwas ändert (die Zahlen darunter wechseln mit jedem Bild).
    const text = lines.join('\n');
    if (text === this.gfxShown || text === this.gfxHidden) return;
    this.gfxShown = text;
    this.gfxHidden = '';
    const st = scene.stats;
    lines.push(`Version ${BUILD_ID} · ${TRACK.def.name} · Stufe ${st.level} · ${st.calls} Zeichenaufrufe, ${st.triangles} Dreiecke · ${g.frames} Bilder · Kontext: ${g.context || 'unbekannt'}`);
    lines.push('Bitte einen Screenshot dieser Meldung schicken.');
    this.ui.setGfxNote(
      lines,
      () => this.rebuildScene('auf Knopfdruck'),
      () => {
        this.gfxHidden = text;
        this.gfxShown = '';
        this.ui.setGfxNote(null);
      },
    );
  }

  /** Baut die 3D-Szene des laufenden Rennens auf einer frischen Zeichenfläche neu auf (das Rennen selbst läuft weiter). */
  private rebuildScene(how: string): void {
    const state = this.lobbyState();
    const old = this.scene;
    if (!state || !old) return;
    const g = old.gfx;
    this.gfxHistory.push(
      `Neuaufbau ${how} nach ${g.frames} Bildern` +
        (g.lost > 0 ? ` – Grafik beendet ${g.lost}× (zuerst ${g.lostWhen}), wiederhergestellt ${g.restored}×` : '') +
        (g.shaderErrors.length > 0 ? ` – abgelehnt: ${g.shaderErrors[0]}` : '') +
        '.',
    );
    if (this.gfxHistory.length > 4) this.gfxHistory.shift();
    try {
      const canvas = $<HTMLCanvasElement>('stage');
      const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      const scene = new RaceScene(fresh, this.quality);
      scene.setTrack();
      scene.reset();
      scene.onEvent = (e) => this.sound.sceneEvent(e);
      scene.setRoster(this.drivers(state));
      this.scene = scene;
      setPortraitRenderer(scene.gl);
      old.release();
    } catch (err) {
      console.error(err);
      this.gfxHistory.push(`Neuaufbau gescheitert: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.gfxLostSince = 0;
    this.gfxShown = '';
  }

  /** Anzeige über dem Rennen: Countdown, Platz, Runde, Item, Ergebnisliste. */
  private updateRaceUi(race: { raceId: number; phase: number; laps: number; untilGo: number }, nowMs: number): void {
    const view = this.hostGame ?? this.clientGame;
    const state = this.lobbyState();
    if (!view || !state) return;
    const me = this.ents.find((e) => e.slot === view.localSlot) ?? null;

    if (race.raceId !== this.shownRaceId) {
      // Neues Rennen (auch nach „Nochmal“): Ergebnisliste weg, Anzeige zurücksetzen.
      this.shownRaceId = race.raceId;
      this.resultsShown = false;
      this.ui.hideResults();
      this.sound.music(TRACK.def.theme as MusicName);
      this.finalLapUntil = 0;
    }

    // Countdown: 3 – 2 – 1 – Los
    let countdown: string | null = null;
    if (race.phase === RACE_COUNTDOWN && race.untilGo <= 3 && race.untilGo > 0) countdown = String(Math.ceil(race.untilGo));
    else if (race.phase !== RACE_RESULTS && race.untilGo <= 0 && race.untilGo > -1.1) countdown = 'Los!';
    this.ui.setCountdown(countdown);
    this.sound.countdown(countdown);
    this.ui.setHudNoteVisible(race.phase === RACE_COUNTDOWN);
    // Während der Kamerafahrt vor der Ampel: Name der Strecke
    const intro = race.phase === RACE_COUNTDOWN && race.untilGo > 3.15 && race.untilGo < COUNTDOWN_TICKS / TICK_RATE;
    this.ui.setRaceTitle(intro ? TRACK.def.name : null, `Strecke ${TRACK.index + 1} · ${race.laps} ${race.laps === 1 ? 'Runde' : 'Runden'}`, TRACK.def.twist ?? '');
    this.sound.roulette((me?.roulette ?? 0) > 0, nowMs);
    const threat = race.phase === RACE_RUNNING ? (this.scene?.threat ?? 0) : 0;
    this.sound.warn(threat, nowMs);

    // Falsch herum? Erst nach einem Moment melden, damit ein Dreher nicht gleich Alarm schlägt.
    let wrongWay = false;
    if (me && race.phase === RACE_RUNNING && !me.finished && me.respawn === 0 && me.spin === 0) {
      const seg = me.seg < TRACK.total ? me.seg : 0;
      const along = me.vx * TRACK.tx[seg] + me.vz * TRACK.tz[seg];
      const facing = Math.sin(me.heading) * TRACK.tx[seg] + Math.cos(me.heading) * TRACK.tz[seg];
      if (along < -3 && facing < -0.3) {
        if (this.wrongWaySince === 0) this.wrongWaySince = nowMs;
        wrongWay = nowMs - this.wrongWaySince > 900;
      } else this.wrongWaySince = 0;
    } else this.wrongWaySince = 0;
    const names = new Map(this.drivers(state).map((d) => [d.slot, d.name]));
    // Die Strecke verändert sich (ein Tor geht auf oder zu): drei Sekunden lang melden.
    let trackNote: string | null = null;
    let trackNoteBad = false;
    if (race.phase === RACE_RUNNING && TRACK.era) {
      // Zeitriss: nach jedem Sprung drei Sekunden lang sagen, welches Zeitalter jetzt gilt.
      const ticks = -race.untilGo * TICK_RATE;
      if (ticks >= TRACK.era.split && eraSince(TRACK.era, ticks) < 180) {
        const now = eraAt(TRACK.era, ticks);
        trackNote = TRACK.era.notes[now];
        trackNoteBad = now === 1;
      }
    } else if (race.phase === RACE_RUNNING && TRACK.gates.length > 0) {
      const ticks = -race.untilGo * TICK_RATE;
      for (const g of TRACK.gates) {
        const shut = planActive(g.plan, ticks);
        if (ticks < 180 || shut === planActive(g.plan, ticks - 180)) continue;
        const note = shut ? g.noteShut : g.noteOpen;
        if (note) {
          trackNote = note;
          trackNoteBad = shut;
        }
      }
    }

    const count = this.ents.length;
    this.ui.renderRaceHud({
      visible: me !== null,
      place: me?.place ?? 0,
      of: count,
      lap: me?.lap ?? 1,
      laps: race.laps,
      timeSec: race.phase === RACE_RUNNING || race.phase === RACE_RESULTS ? Math.max(0, -race.untilGo) : 0,
      frozenTime: me?.finished ?? false,
      item: me?.item ?? ITEM_NONE,
      rolling: (me?.roulette ?? 0) > 0,
      speedKmh: me ? Math.round(Math.hypot(me.vx, me.vz) * 3.6) : 0,
      finished: (me?.finished ?? false) && race.phase !== RACE_RESULTS,
      order: view.standings().map((st) => ({
        slot: st.slot,
        name: names.get(st.slot) ?? `Fahrer ${st.slot + 1}`,
        me: st.slot === view.localSlot,
        done: st.finished,
      })),
      banner: wrongWay ? 'Falsch herum!' : threat > 0 ? 'Kreisel im Anflug!' : trackNote ? trackNote : nowMs < this.finalLapUntil ? 'Letzte Runde!' : null,
      bannerTone: wrongWay || threat > 0 || (trackNote !== null && trackNoteBad) ? 'bad' : 'info',
      fps: this.showFps && this.scene ? this.scene.stats.fps : null,
      smoke: this.scene?.smoke ?? 0,
    });

    if (race.phase === RACE_RESULTS && !this.resultsShown) {
      this.resultsShown = true;
      // Turnier: der Host wertet das Rennen (genau einmal) – die Sterne gehen mit dem Stand der Lobby an alle.
      this.hostLobby?.scoreCupRace(view.standings().map((st) => ({ slot: st.slot, place: st.place })));
      const rows = this.showResults();
      this.sound.music('results');
      this.sound.results(me?.place ?? rows.find((r) => r.me)?.place ?? 0, rows.length);
    }

    if (nowMs - this.lastHudAt > 120) {
      this.lastHudAt = nowMs;
      this.sendHud(false);
    }
  }

  /** Baut die Ergebnisliste aus dem aktuellen Stand (im Turnier samt Sternen und Gesamtstand). */
  private showResults(): ResultRow[] {
    const view = this.hostGame ?? this.clientGame;
    const state = this.lobbyState();
    if (!view || !state) return [];
    const names = new Map(this.drivers(state).map((d) => [d.slot, d]));
    // Sterne erst zeigen, wenn die Wertung dieses Rennens da ist (beim Host sofort, bei Mitspielern kurz danach).
    const cup = this.cupModel(state);
    const scored = cup !== null && state.cup !== null && state.cup.played.length > 0 && state.cup.played[state.cup.played.length - 1] === TRACK.index;
    const rows: ResultRow[] = view.standings().map((st) => ({
      place: st.place,
      slot: st.slot,
      name: names.get(st.slot)?.name ?? `Fahrer ${st.slot + 1}`,
      bot: st.bot,
      me: st.slot === view.localSlot,
      character: names.get(st.slot)?.character ?? st.slot,
      timeSec: st.finished ? st.finishTicks / TICK_RATE : -1,
      ...(cup && scored ? { gain: state.cup!.last[st.slot] ?? 0 } : {}),
    }));
    this.ui.showResults(rows, this.role === 'host', TRACK.def.name, cup);
    return rows;
  }

  /** Dem Handy mitteilen, was es anzeigen soll (nur bei Änderungen). */
  private sendHud(force: boolean): void {
    const view = this.hostGame ?? this.clientGame;
    const me = view ? this.ents.find((e) => e.slot === view.localSlot) : undefined;
    const race = view?.race(performance.now() / 1000);
    const hud = {
      racing: this.inGame && !!me && !!race && race.phase !== RACE_RESULTS,
      item: me?.item ?? ITEM_NONE,
      rolling: (me?.roulette ?? 0) > 0,
      place: me?.place ?? 0,
      of: this.ents.length,
      lap: me?.lap ?? 0,
      laps: race?.laps ?? 0,
    };
    const json = JSON.stringify(hud);
    if (!force && json === this.lastHudJson) return;
    this.lastHudJson = json;
    this.pairing.sendHud(hud);
  }

  private everySecond(): void {
    this.seconds++;
    this.rates.fps = this.frames;
    this.frames = 0;
    this.rates.tick = this.ticks;
    this.ticks = 0;
    this.rates.ctrl = this.pairing.input.packets - this.prev.ctrl;
    this.prev.ctrl = this.pairing.input.packets;
    if (this.clientGame) {
      this.rates.snap = this.clientGame.stats.snapshots - this.prev.snap;
      this.prev.snap = this.clientGame.stats.snapshots;
      this.rates.peakCorrection = this.clientGame.stats.peakCorrection;
      this.clientGame.stats.peakCorrection = 0;
    } else {
      this.rates.snap = 0;
      this.prev.snap = 0;
    }
    if (this.hostGame) {
      this.seatRates.clear();
      for (const [slot, r] of this.hostGame.drainCmdCounts()) this.seatRates.set(slot, r);
    }
    this.reportController();
    if (this.clientLobby?.status === 'reconnecting') this.updateBanner();
    // Kommt der erste Verbindungsaufbau nicht voran, früh sagen, woran es meist liegt –
    // die endgültige Absage dauert technisch bedingt rund eine halbe Minute.
    if (this.clientLobby?.status === 'connecting' && Date.now() - this.joinStartedAt > 8000) {
      const left = Math.max(0, Math.ceil((this.clientLobby.deadline - Date.now()) / 1000));
      this.ui.setHomeMessage(
        `Die Verbindung zu Lobby ${this.clientLobby.code} kommt bisher nicht zustande. Das passiert meist, wenn ein Gerät im Mobilfunk-, Schul- oder Firmennetz hängt${
          this.setup.turn.available ? '' : ' und kein TURN-Server eingerichtet ist'
        }. Ich versuche es weiter${left > 0 ? ` (noch ${left} s)` : ''} …`,
      );
    }
    if (this.seconds % 2 === 0) void this.refreshPaths();
  }

  private async refreshPaths(): Promise<void> {
    await this.pairing.refreshPath();
    const hostLink = this.clientLobby?.link;
    this.hostPath = hostLink && hostLink.state === 'open' ? await hostLink.getPath() : null;
    if (this.hostLobby) {
      const lobby = this.hostLobby;
      const seen = new Set<number>();
      for (const slot of lobby.slots()) {
        const link = lobby.linkOf(slot);
        if (!link) continue;
        seen.add(slot);
        this.seatPaths.set(slot, await link.getPath());
      }
      for (const slot of [...this.seatPaths.keys()]) if (!seen.has(slot)) this.seatPaths.delete(slot);
    }
  }

  private channelRow(link: Link): DebugRow {
    return link.fastIsUnreliable
      ? { label: 'Schneller Kanal', value: 'unreliable, ungeordnet', tone: 'ok' }
      : { label: 'Schneller Kanal', value: 'Ersatzweg (zuverlässig)', tone: 'warn' };
  }

  private collectDebug(): DebugSection[] {
    const sections: DebugSection[] = [];
    const turn = this.setup.turn;
    let turnValue = turn.available ? 'eingerichtet' : 'nicht eingerichtet';
    let turnTone: Tone = turn.available ? 'ok' : 'warn';
    if (turn.mode === 'force') turnValue += ' · erzwungen (Test)';
    if (turn.mode === 'off') {
      turnValue = 'abgeschaltet (Test)';
      turnTone = 'warn';
    }
    if (turn.error) {
      turnValue = turn.error;
      turnTone = 'bad';
    }
    const general: DebugRow[] = [
      { label: 'Version', value: BUILD_ID },
      { label: 'Rolle', value: this.role === 'host' ? 'Host' : this.role === 'client' ? 'Mitspieler' : '–' },
      { label: 'Signaling', ...signalText(this.screenEp.status) },
    ];
    if (this.roomEp) general.push({ label: 'Signaling Raum', ...signalText(this.roomEp.status) });
    general.push({ label: 'TURN', value: turnValue, tone: turnTone });
    const sim = this.linkOptions.netSim;
    if (sim && (sim.lag || sim.jitter || sim.loss)) {
      general.push({ label: 'Netz-Simulation', value: `+${sim.lag} ms, Jitter ${sim.jitter} ms, Verlust ${sim.loss} %`, tone: 'warn' });
    }
    general.push({ label: 'Bildrate', value: `${this.rates.fps} FPS`, tone: this.rates.fps >= 55 ? 'ok' : this.rates.fps >= 30 ? 'warn' : 'bad' });
    if (this.inGame) general.push({ label: 'Simulation', value: `${this.rates.tick} Schritte/s` });
    general.push({ label: 'Wachhalten', value: { native: 'Wake Lock', video: 'Video-Ersatz', none: 'inaktiv' }[wakeLockMode()] });
    sections.push({ title: 'Dieser Bildschirm', rows: general });

    const c = this.pairing;
    const ctrl: DebugRow[] = [];
    if (c.link && c.connected) {
      ctrl.push({ label: 'Status', value: 'verbunden', tone: 'ok' });
      ctrl.push({ label: 'Weg', ...pathText(c.path) });
      ctrl.push({ label: 'Latenz', value: latencyText(c.rtt) });
      if (this.rates.ctrl === 0 && c.info.sendHz === 0) {
        ctrl.push({ label: 'Eingaben', value: 'Handy wartet auf „Tippen zum Starten“', tone: 'warn' });
      } else {
        ctrl.push({
          label: 'Eingaben',
          value: `${this.rates.ctrl}/s empfangen · Handy sendet ${c.info.sendHz}/s`,
          tone: this.rates.ctrl >= 50 ? 'ok' : this.rates.ctrl >= 30 ? 'warn' : 'bad',
        });
        ctrl.push({ label: 'Sensor', value: c.info.tilt ? `Neigung, ${c.info.sensorHz} Hz` : 'Touch-Lenkung (kein Neigungssensor aktiv)' });
      }
      ctrl.push(this.channelRow(c.link));
    } else {
      ctrl.push({ label: 'Status', value: 'kein Handy verbunden', tone: 'warn' });
    }
    sections.push({ title: 'Handy → Bildschirm', rows: ctrl });

    if (this.clientLobby) {
      const l = this.clientLobby;
      const rows: DebugRow[] = [];
      if (l.link && l.status === 'joined') {
        rows.push({ label: 'Status', value: 'verbunden', tone: 'ok' });
        rows.push({ label: 'Weg', ...pathText(this.hostPath) });
        rows.push({ label: 'Latenz', value: latencyText(l.link.rtt) });
        rows.push(this.channelRow(l.link));
        if (this.clientGame) {
          const s = this.clientGame.stats;
          rows.push({ label: 'Snapshots', value: `${this.rates.snap}/s`, tone: this.rates.snap >= 25 ? 'ok' : this.rates.snap >= 15 ? 'warn' : 'bad' });
          rows.push({ label: 'Vorhersage', value: `${s.pending} Eingaben unbestätigt` });
          rows.push({
            label: 'Korrektur',
            value: `max. ${this.rates.peakCorrection.toFixed(2)} m in der letzten Sekunde`,
            tone: this.rates.peakCorrection < 0.15 ? 'ok' : this.rates.peakCorrection < 1 ? 'warn' : 'bad',
          });
          rows.push({ label: 'Andere Fahrzeuge', value: `${Math.round(CLIENT_INTERP_DELAY * 1000)} ms verzögert dargestellt` });
        }
      } else {
        rows.push({ label: 'Status', value: l.status === 'reconnecting' ? 'verbinde neu …' : 'verbinde …', tone: 'bad' });
      }
      sections.push({ title: 'Bildschirm → Host', rows });
    }

    if (this.hostLobby) {
      const rows: DebugRow[] = [];
      for (const p of this.hostLobby.state().players) {
        if (p.isHost) continue;
        const link = this.hostLobby.linkOf(p.slot);
        if (!link) {
          rows.push({ label: p.name, value: 'getrennt', tone: 'bad' });
          continue;
        }
        const path = pathText(this.seatPaths.get(p.slot) ?? null);
        const rate = this.seatRates.get(p.slot);
        const parts = [path.value, latencyText(link.rtt)];
        if (this.inGame && rate) parts.push(`${rate.received} Eingaben/s`, `Puffer ${rate.queued}`);
        if (!link.fastIsUnreliable) parts.push('Ersatzweg');
        rows.push({ label: p.name, value: parts.join(' · '), tone: path.tone });
      }
      if (rows.length === 0) rows.push({ label: 'Mitspieler', value: 'noch keiner verbunden' });
      sections.push({ title: 'Mitspieler → Host', rows });
    }
    return sections;
  }

  /** Zugriff für automatisierte Tests und zum Nachschauen in der Browser-Konsole. */
  private installTestHook(): void {
    (window as unknown as Record<string, unknown>).__kart = {
      role: () => this.role,
      view: () => this.ui.view,
      lobby: () => this.lobbyState(),
      slot: () => this.localSlot(),
      pairUrl: () => this.pairUrl(),
      inviteUrl: () => {
        const s = this.lobbyState();
        return s ? this.inviteUrl(s.code) : null;
      },
      cmd: () => ({ ...this.lastCmd }),
      entities: () => this.ents.map((e) => ({ ...e })),
      authoritative: (slot: number) => {
        const s = this.hostGame?.authoritative(slot);
        return s ? { ...s } : null;
      },
      predicted: () => (this.clientGame?.ready ? { ...this.clientGame.predictedState() } : null),
      race: () => (this.hostGame ?? this.clientGame)?.race(performance.now() / 1000) ?? null,
      standings: () => (this.hostGame ?? this.clientGame)?.standings() ?? [],
      things: () => ((this.hostGame ?? this.clientGame)?.things(performance.now() / 1000) ?? []).map((t) => ({ ...t })),
      track: () => {
        // gapAt/openAt: Meter hinter der Startlinie, an denen die erste Lücke bzw. das erste Stück ohne Bande liegt.
        let gap = -1;
        let open = -1;
        for (let i = 0; i < TRACK.n; i++) {
          if (gap < 0 && TRACK.edge[i] & 4) gap = i;
          if (open < 0 && (TRACK.edge[i] & 7) === 3) open = i;
        }
        return { index: TRACK.index, name: TRACK.def.name, length: TRACK.length, gapAt: gap * TRACK.step, openAt: open * TRACK.step, halfWidth: open >= 0 ? TRACK.wh[open] : 0 };
      },
      // Streckenmechanik, wie dieser Bildschirm sie gerade sieht: Verkehr (Meter hinter der
      // Startlinie, Spur, Ort) und die Stellen der Geysire und Lavabomben.
      traffic: () => {
        const view = this.hostGame ?? this.clientGame;
        const time = view ? view.race(performance.now() / 1000).time : 0;
        const pose = newVehiclePose();
        const lap = TRACK.n * TRACK.step;
        return TRACK.vehicles.map((v) => {
          const p = vehiclePose(TRACK, v, 0, time, pose);
          return { id: v.id, kind: v.kind, lat: p.lat, half: v.half, speed: v.speed, at: vehicleAt(v, time, lap), x: p.x, y: p.y, z: p.z, time };
        });
      },
      // (strike = erste Rennzeit ≥ 0, zu der das Hindernis losgeht; on = wie lange es dann wirkt – alles in Sekunden)
      pulses: () =>
        TRACK.pulses.map((p) => ({
          kind: p.kind,
          lat: p.lat,
          at: TRACK.prog[p.seg] * TRACK.step,
          period: p.period / 60,
          strike: ((p.period - (((p.phase % p.period) + p.period) % p.period)) % p.period) / 60,
          on: p.on / 60,
          warn: p.warn / 60,
        })),
      // Gewitterkamm: Ist die Strecke dunkel, und wie hell ist das Wetterleuchten zur Rennzeit dieses Bildschirms
      // bzw. zur angegebenen Rennzeit (Sekunden)? 0 = finster … 1 = taghell.
      storm: (seconds?: number) => {
        const view = this.hostGame ?? this.clientGame;
        const time = seconds !== undefined ? seconds * 60 : view ? view.race(performance.now() / 1000).time : 0;
        return { dark: TRACK.dark, time, light: stormLight(TRACK.pulses, TRACK.flashes, time), flashes: TRACK.flashes.length };
      },
      // Dschungel-Fluss, zur Rennzeit dieses Bildschirms bzw. zur angegebenen Rennzeit (Sekunden): die Flussstücke
      // (Meter ab Start, Länge) mit ihren Bahnen – wie weit die Flöße getrieben sind (drift, Meter) und ob an der Stelle
      // probe (Meter ab Flussanfang) gerade ein Floß liegt.
      river: (seconds?: number, probe = 40) => {
        const view = this.hostGame ?? this.clientGame;
        const time = seconds !== undefined ? seconds * 60 : view ? view.race(performance.now() / 1000).time : 0;
        return {
          time,
          rivers: TRACK.rivers.map((r) => ({
            at: r.first * TRACK.step,
            length: r.count * TRACK.step,
            lanes: r.lanes.map((l) => ({ lat0: l.lat0, lat1: l.lat1, length: l.length, gap: l.gap, speed: l.speed, phase: l.phase, drift: raftDrift(l, time), raft: raftAt(l, probe, time) })),
          })),
        };
      },
      // Spiegelkabinett, zur Rennzeit dieses Bildschirms bzw. zur angegebenen Rennzeit (Sekunden): die Rahmen (Meter ab
      // Start, seitliche Lage), wohin ihr Spiegel führt (Meter ab Start), die Sorte (0 = vorwärts, 1 = zurück) und ob
      // gerade ein Spiegel darin steht.
      portals: (seconds?: number) => {
        const view = this.hostGame ?? this.clientGame;
        const time = seconds !== undefined ? seconds * 60 : view ? view.race(performance.now() / 1000).time : 0;
        return TRACK.portals.map((p) => ({ at: TRACK.prog[p.seg] * TRACK.step, lat0: p.lat0, lat1: p.lat1, to: TRACK.prog[p.to] * TRACK.step, kind: p.kind, open: portalOpen(p, time), time }));
      },
      // Wüstenexpress, zur Rennzeit dieses Bildschirms bzw. zur angegebenen Rennzeit (Sekunden): je Zug die Wagen von der
      // Lok (0) bis zum Rampenwagen – Streckenmeter und seitliche Lage der Wagenmitte, Ort, Höhe des Dachs hinten und vorn.
      trains: (seconds?: number) => {
        const view = this.hostGame ?? this.clientGame;
        const time = seconds !== undefined ? seconds * 60 : view ? view.race(performance.now() / 1000).time : 0;
        const pose = newVehiclePose();
        return TRACK.vehicles
          .filter((v) => !!v.roofs)
          .map((v) => ({
            id: v.id,
            time,
            cars: Array.from({ length: v.cars }, (_, c) => {
              const p = vehiclePose(TRACK, v, c, time, pose);
              return { at: TRACK.prog[p.seg] * TRACK.step, lat: p.lat, x: p.x, y: p.y, z: p.z, roof: [roofTop(v, c, -v.half), roofTop(v, c, v.half)] };
            }),
          }));
      },
      // Fliegen: Flugstrecken (Meter ab Start, nur Hauptstrecke) und Zahl der Aufwinde und Schubringe.
      flight: () => {
        const glides: { from: number; to: number }[] = [];
        let from = -1;
        for (let i = 0; i <= TRACK.n; i++) {
          const on = i < TRACK.n && (TRACK.edge[i] & EDGE_GLIDE) !== 0;
          if (on && from < 0) from = i;
          else if (!on && from >= 0) {
            glides.push({ from: from * TRACK.step, to: i * TRACK.step });
            from = -1;
          }
        }
        return { glides, thermals: TRACK.thermals.length, rings: TRACK.rings.length };
      },
      // Mond: Sprungplatten (Meter ab Start, Abzweigung oder −1) und Schwerkraft der Strecke.
      launchers: () => ({ gravity: TRACK.gravity, pads: TRACK.launchers.map((l) => ({ at: TRACK.prog[l.seg] * TRACK.step, branch: TRACK.branchOf[l.seg], power: l.power })) }),
      // Sturmhafen, zur Rennzeit dieses Bildschirms: Böen (Meter ab Start bzw. ab Gabelung, Schub, Stärke und Vorwarnung
      // jetzt, Windschatten) und Pontons (Hub jetzt).
      harbor: () => {
        const view = this.hostGame ?? this.clientGame;
        const time = view ? view.race(performance.now() / 1000).time : 0;
        const where = (seg: number) => {
          const branch = TRACK.branchOf[seg];
          return { branch, at: (branch < 0 ? seg : seg - TRACK.branches[branch].first) * TRACK.step };
        };
        return {
          time,
          winds: TRACK.winds.map((w) => ({
            ...where(w.first),
            length: w.count * TRACK.step,
            push: w.push,
            period: w.period / 60,
            strength: gustStrength(w, time),
            warning: gustWarning(w, time),
            lee: w.lee.map((l) => ({ from: where(l.first).at, to: where(l.last).at, lat0: l.lat0, lat1: l.lat1 })),
          })),
          pontoons: TRACK.pontoons.map((p) => ({ ...where(p.first), length: p.count * TRACK.step, amp: p.amp, period: p.period / 60, lift: pontoonLift(p, time) })),
        };
      },
      // Was sich an der Strecke nach Plan ändert, zur Rennzeit dieses Bildschirms: Bruchstellen (Meter ab Start bzw. ab
      // Gabelung, seitliche Lage, ob gerade weggebrochen, wann sie zum ersten Mal bricht) und Tore (Abzweigung, ob gesperrt).
      changes: () => {
        const view = this.hostGame ?? this.clientGame;
        const time = view ? view.race(performance.now() / 1000).time : 0;
        const where = (seg: number) => {
          const branch = TRACK.branchOf[seg];
          return { branch, at: (branch < 0 ? seg : seg - TRACK.branches[branch].first) * TRACK.step };
        };
        return {
          time,
          holes: TRACK.holes.map((h) => ({ ...where(h.first), length: h.count * TRACK.step, lat0: h.lat0, lat1: h.lat1, open: planActive(h.plan, time), breaksAt: h.plan.spans[0] / 60 })),
          gates: TRACK.gates.map((g) => ({ branch: TRACK.branchOf[g.first], shut: planActive(g.plan, time) })),
          // Zeitriss-Ruine: das geltende Zeitalter (0 = Einst, 1 = Jetzt) und wie lange es schon gilt (Sekunden).
          era: TRACK.era ? { now: eraAt(TRACK.era, time), name: TRACK.era.names[eraAt(TRACK.era, time)], since: eraSince(TRACK.era, time) / 60, split: TRACK.era.split / 60, period: TRACK.era.period / 60 } : null,
        };
      },
      // Tauchen: Meeresspiegel, erster Streckenmeter unter Wasser (Hauptstrecke), Zahl der Strömungen und Blasenschlote.
      dive: () => {
        let from = -1;
        for (let i = 0; i < TRACK.n && from < 0; i++) if (TRACK.deep[i] && TRACK.py[i] < TRACK.sea - 1) from = i * TRACK.step;
        return { sea: TRACK.sea, from, currents: TRACK.belts.filter((b) => b.swim).length, vents: TRACK.pulses.filter((p) => p.kind === PULSE_BUBBLE).length };
      },
      // Gezeit zur Rennzeit dieses Bildschirms: Stand 0 (Ebbe) … 1 (Flut) und Höhe des Wasserspiegels.
      tide: () => {
        const view = this.hostGame ?? this.clientGame;
        const time = view ? view.race(performance.now() / 1000).time : 0;
        const t = TRACK.tide;
        return t ? { time, phase: tidePhase(t, time), level: tideLevel(t, time), period: t.period, wall: performance.timeOrigin + performance.now() } : null;
      },
      scene: () => (this.scene ? { ...this.scene.stats, smoke: this.scene.smoke } : null),
      tree: () => this.scene?.debugTree() ?? [],
      buildTimes: () => this.scene?.buildTimes() ?? [],
      audio: () => this.sound.debug(),
      place: (slot: number, meters: number, lat = 0, branch = -1, up = 0) => this.hostGame?.debugPlace(slot, meters, lat, branch, up),
      // Nur Host, nur für Tests: das Rennen sofort beenden, Zieleinlauf in der genannten Reihenfolge der Plätze.
      finish: (order?: number[]) => this.hostGame?.debugFinish(order),
      // Nur Host, nur für Tests: die Rennzeit auf so viele Sekunden nach „Los“ stellen.
      clock: (seconds: number) => this.hostGame?.debugClock(seconds),
      // Fotokamera für die Streckenbilder (tools/streckenbilder.cjs): Standort, Blickpunkt, Bildwinkel; ohne Angaben = aus.
      photo: (from?: number[], to?: number[], fov = 50) => {
        if (this.scene) this.scene.photo = from && to ? { from, to, fov } : null;
      },
      // Punkt auf der Strecke: Meter ab Start, seitlich, Höhe darüber – als Hilfe zum Ausrichten der Fotokamera.
      spot: (meters: number, lat = 0, up = 0) => {
        const seg = Math.max(0, Math.min(TRACK.n - 1, Math.round(meters / TRACK.step)));
        return [TRACK.px[seg] + rightX(TRACK, seg) * lat, TRACK.py[seg] + up, TRACK.pz[seg] + rightZ(TRACK, seg) * lat];
      },
      // Nur Host, nur für Tests: einem Kart direkt ein Item geben.
      giveItem: (slot: number, item: number) => this.hostGame?.giveItem(slot, item),
      debugHit: (slot: number) => this.hostGame?.debugHit(slot),
      clientStats: () => (this.clientGame ? { ...this.clientGame.stats, peak: this.rates.peakCorrection } : null),
      rates: () => ({ ...this.rates }),
      controller: () => ({
        connected: this.pairing.connected,
        rtt: this.pairing.rtt,
        unreliable: this.pairing.link?.fastIsUnreliable ?? false,
        path: this.pairing.path,
        info: this.pairing.info,
      }),
      hostLink: () => {
        const l = this.clientLobby?.link;
        return l ? { state: l.state, rtt: l.rtt, unreliable: l.fastIsUnreliable, path: this.hostPath } : null;
      },
      clientStatus: () => this.clientLobby?.status ?? null,
      signaling: () => ({ screen: this.screenEp.status, room: this.roomEp?.status ?? null }),
      // Verbindungen absichtlich kappen, um die Wiederverbindung zu prüfen:
      dropHostLink: () => this.clientLobby?.link?.close(),
      dropControllerLink: () => this.pairing.link?.close(),
    };
  }
}

/** Ob der Browser auf einer frischen Zeichenfläche einen Grafikkontext dieser Art hergibt – und ob der brauchbar ist. */
function probeContext(kind: 'webgl2' | 'webgl'): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const gl = canvas.getContext(kind) as WebGLRenderingContext | null;
    const text = !gl ? 'nein' : gl.isContextLost() ? 'ja, aber schon verloren' : 'ja';
    canvas.width = canvas.height = 0;
    return text;
  } catch {
    return 'Fehler';
  }
}

/** Text für den Dialog, wenn die 3D-Szene nicht entsteht: was der Browser gemeldet hat, und was meist hilft. */
function sceneFailure(errors: unknown[]): string[] {
  const texts = errors.map((e) => (e instanceof Error ? e.message : String(e)));
  return [
    'Der Browser hat dem Spiel keine 3D-Grafik bereitgestellt.',
    ...texts.map((t) => `Anläufe (jeder auf frischer Fläche): ${t}`),
    `Prüfung auf frischer Fläche: WebGL 2 ${probeContext('webgl2')}, WebGL 1 ${probeContext('webgl')} · Version ${BUILD_ID}`,
    'Hilft meist: alle Tabs mit diesem Spiel schließen, den Browser ganz beenden und neu starten, dann nur diese Seite öffnen. Im Blockierungsmodus von iOS/iPadOS ist WebGL abgeschaltet.',
    'Zur Eingrenzung gibt es eine Testseite: an die Adresse des Spiels „grafiktest.html“ anhängen.',
  ];
}
