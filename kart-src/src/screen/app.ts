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
import { TRACK, TRACK_COUNT, setTrack } from '../game/track';
import type { RenderEntity } from '../game/view';
import { ClientLobby } from '../lobby/clientLobby';
import { HostLobby } from '../lobby/hostLobby';
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
import { disposePortraits } from '../render/portraits';
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
import { ScreenUi, type LobbyModel, type ResultRow } from './ui';

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
        if (this.hostLobby?.canStart()) this.hostLobby.setPhase('game');
      },
      again: () => {
        if (!this.hostGame || !this.hostLobby) return;
        this.hostGame.setRoster(this.hostLobby.slots(), this.hostLobby.bots, this.hostLobby.characters());
        this.hostGame.newRace();
      },
      setBots: (bots) => this.hostLobby?.setBots(bots),
      setAiLevel: (level) => this.hostLobby?.setAiLevel(level),
      setLaps: (laps) => this.hostLobby?.setLaps(laps),
      setTrack: (track) => this.hostLobby?.setTrack(Math.max(0, Math.min(TRACK_COUNT - 1, track))),
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
      if (this.debug.track >= 0) lobby.track = Math.min(TRACK_COUNT - 1, this.debug.track);
      if (this.debug.ai >= 0) lobby.aiLevel = this.debug.ai;
    }
    lobby.track = Math.min(TRACK_COUNT - 1, lobby.track);
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
      if (d) this.hostGame.receiveCmds(slot, d.newestSeq, d.cmds);
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
    if (phase === 'game' && !this.inGame) this.enterGame();
    else if (phase === 'lobby' && this.inGame) {
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
    setTrack(state.track);
    // Der Porträt-Renderer der Lobby gibt seinen Grafikkontext frei, bevor das Rennen einen braucht.
    this.ui.cancelPortraits();
    disposePortraits();
    if (!this.scene) {
      try {
        this.scene = new RaceScene($<HTMLCanvasElement>('stage'), this.quality);
      } catch (err) {
        console.error(err);
        this.ui.showModal('3D-Darstellung nicht möglich', ['Dieser Browser stellt kein WebGL bereit.'], [
          { label: 'Schließen', run: () => undefined },
        ]);
        return;
      }
    }
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
      if (state) cmd = botCmd(state, this.autoBrain, [], canDrive, { tick: this.ticks, place: 1, smoke: false });
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
    }
  };

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
    this.ui.setRaceTitle(intro ? TRACK.def.name : null, `Strecke ${TRACK.index + 1} · ${race.laps} ${race.laps === 1 ? 'Runde' : 'Runden'}`);
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
      banner: wrongWay ? 'Falsch herum!' : threat > 0 ? 'Kreisel im Anflug!' : nowMs < this.finalLapUntil ? 'Letzte Runde!' : null,
      bannerTone: wrongWay || threat > 0 ? 'bad' : 'info',
      fps: this.showFps && this.scene ? this.scene.stats.fps : null,
      smoke: this.scene?.smoke ?? 0,
    });

    if (race.phase === RACE_RESULTS && !this.resultsShown) {
      this.resultsShown = true;
      const names = new Map(this.drivers(state).map((d) => [d.slot, d]));
      const rows: ResultRow[] = view.standings().map((st) => ({
        place: st.place,
        slot: st.slot,
        name: names.get(st.slot)?.name ?? `Fahrer ${st.slot + 1}`,
        bot: st.bot,
        me: st.slot === view.localSlot,
        character: names.get(st.slot)?.character ?? st.slot,
        timeSec: st.finished ? st.finishTicks / TICK_RATE : -1,
      }));
      this.ui.showResults(rows, this.role === 'host', TRACK.def.name);
      this.sound.music('results');
      this.sound.results(me?.place ?? rows.find((r) => r.me)?.place ?? 0, rows.length);
    }

    if (nowMs - this.lastHudAt > 120) {
      this.lastHudAt = nowMs;
      this.sendHud(false);
    }
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
      scene: () => (this.scene ? { ...this.scene.stats, smoke: this.scene.smoke } : null),
      audio: () => this.sound.debug(),
      place: (slot: number, meters: number, lat = 0, branch = -1) => this.hostGame?.debugPlace(slot, meters, lat, branch),
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
