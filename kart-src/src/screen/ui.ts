// Oberfläche des Bildschirms: Startseite, Lobby, Bedienelemente über der
// Rennen sowie Meldungen. Reine Anzeige – die Logik sitzt in app.ts.

import { BOT_NAMES } from '../game/ai';
import type { LobbyPlayer } from '../net/protocol';
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
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const rest = sec - m * 60;
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
  private lastQrUrl = '';
  private lastPlayersJson = '';
  private localReady = false;
  private readonly hudCache: Record<string, string> = {};
  private lastCountdown: string | null = null;
  private shownTime = 0;
  private lastSetupJson = '';
  private lastCharJson = '';
  private readonly portraits = new Map<string, string>();
  private portraitJobs: { key: string; character: number; slot: number; targets: HTMLImageElement[] }[] = [];
  private portraitTimer = 0;
  private lastOrderJson = '';
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
    const chkBots = $<HTMLInputElement>('chk-bots');
    chkBots.addEventListener('change', () => on.setBots(chkBots.checked));
    $('btn-debug-lobby').addEventListener('click', () => on.toggleDebug());
    $('btn-copy').addEventListener('click', () => void this.copyInvite());
    $('btn-settings').addEventListener('click', () => this.showSettings());

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
    this.app.dataset.view = view;
    if (view !== 'game') $('menu').hidden = true;
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

    if (m.pairUrl !== this.lastQrUrl) {
      this.lastQrUrl = m.pairUrl;
      $('lobby-qr').replaceChildren(qrSvg(m.pairUrl));
      $('pair-url').textContent = m.pairUrl.replace(/^https?:\/\//, '');
    }
    const status = $('pair-status');
    let text = 'Kein Handy verbunden';
    if (m.controllerConnected) {
      if (m.controllerState === 'active') text = `Handy verbunden · Ping ${ms(m.controllerRtt)}`;
      else if (m.controllerState === 'waiting') text = 'Handy verbunden – dort noch „Tippen zum Starten“';
      else text = 'Handy verbunden, sendet aber gerade nichts';
      if (m.controllerMismatch) text = 'Handy hat eine ältere Fassung der Seite – dort bitte neu laden';
    }
    status.textContent = text;
    status.dataset.on = String(m.controllerConnected && m.controllerState === 'active' && !m.controllerMismatch);

    // Liste nur neu aufbauen, wenn sich etwas Sichtbares geändert hat.
    const json = JSON.stringify([m.players, m.localSlot, m.bots]);
    if (json !== this.lastPlayersJson) {
      this.lastPlayersJson = json;
      this.renderPlayers(m);
    }

    this.localReady = m.localReady;
    this.btnReady.hidden = m.isHost;
    this.btnReady.textContent = m.localReady ? 'Doch nicht bereit' : 'Ich bin bereit';
    this.btnReady.classList.toggle('btn-on', m.localReady);
    this.btnStart.hidden = !m.isHost;
    this.btnStart.disabled = !m.canStart;
    this.btnLeave.textContent = m.isHost ? 'Lobby schließen' : 'Lobby verlassen';
    this.btnBack.textContent = m.isHost ? 'Zur Lobby' : 'Verlassen';

    const chkBots = $<HTMLInputElement>('chk-bots');
    chkBots.checked = m.bots;
    chkBots.disabled = !m.isHost;
    $('bots-note').textContent = m.isHost ? '' : 'Strecke, Runden und Gegner legt der Host fest.';
    const charJson = JSON.stringify([m.character, m.localSlot]);
    if (charJson !== this.lastCharJson) {
      this.lastCharJson = charJson;
      this.renderCharacters(m);
    }
    const setupJson = JSON.stringify([m.track, m.aiLevel, m.laps, m.bots, m.isHost]);
    if (setupJson !== this.lastSetupJson) {
      this.lastSetupJson = setupJson;
      this.renderSetup(m);
    }

    let hint = '';
    if (m.isHost) {
      if (m.waitingFor.length > 0) hint = `Noch nicht bereit: ${m.waitingFor.join(', ')}`;
      else if (m.players.length === 1) hint = m.bots ? 'Du kannst gegen die KI starten oder auf Mitspieler warten.' : 'Du kannst allein starten oder auf Mitspieler warten.';
      else hint = 'Alle bereit.';
    } else {
      hint = m.localReady ? 'Der Host startet das Rennen.' : 'Melde dich bereit, wenn dein Controller verbunden ist.';
    }
    $('lobby-hint').textContent = hint;

    $('hud-note').textContent = m.controllerConnected
      ? ''
      : 'Kein Handy verbunden – den QR-Code gibt es im Menü unter „Controller koppeln“. Am Rechner: Pfeiltasten/WASD, Shift = Drift, Leertaste = Item.';
  }

  setBanner(text: string | null, tone: 'warn' | 'bad' = 'warn'): void {
    this.banner.hidden = !text;
    this.banner.textContent = text ?? '';
    this.banner.dataset.tone = tone;
  }

  showModal(title: string, body: (string | Node)[], actions: ModalAction[]): void {
    $('modal-title').textContent = title;
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

  showResults(rows: ResultRow[], isHost: boolean, trackName = ''): void {
    $('results-track').textContent = trackName;
    $('menu').hidden = true;
    const list = $('results-list');
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
        ),
      );
    }
    $('btn-again').hidden = !isHost;
    $('btn-lobby').hidden = !isHost;
    $('results-note').textContent = isHost ? '' : 'Der Host entscheidet, wie es weitergeht.';
    $('results').hidden = false;
  }

  hideResults(): void {
    $('results').hidden = true;
  }

  /** QR-Code zum (Neu-)Koppeln während des Rennens. */
  showPairingModal(pairUrl: string, connected: boolean): void {
    const qr = h('div', { class: 'qr qr-large' });
    qr.append(qrSvg(pairUrl));
    this.showModal(
      'Controller koppeln',
      [
        qr,
        connected
          ? 'Es ist bereits ein Handy verbunden. Scannt ein anderes den Code, übernimmt es die Steuerung.'
          : 'QR-Code mit der Handy-Kamera scannen.',
      ],
      [{ label: 'Schließen', run: () => undefined }],
    );
  }

  private renderPlayers(m: LobbyModel): void {
    const list = $('lobby-players');
    list.replaceChildren();
    const bySlot = new Map(m.players.map((p) => [p.slot, p]));
    for (let slot = 0; slot < MAX_PLAYERS; slot++) {
      const p = bySlot.get(slot);
      const chip = h('span', { class: 'chip', text: String(slot + 1) });
      chip.style.setProperty('--c', playerColor(slot));
      if (!p) {
        list.append(
          h(
            'li',
            { class: `player player-empty${m.bots ? ' player-bot' : ''}` },
            chip,
            h(
              'span',
              { class: 'player-name' },
              m.bots ? this.face(slot, slot, 'player-face') : null,
              h('span', { class: 'player-id' }, h('span', { class: 'player-id-name', text: m.bots ? BOT_NAMES[slot] : 'frei' })),
            ),
            m.bots ? h('span', { class: 'player-tags' }, h('span', { class: 'tag', text: 'KI' })) : null,
          ),
        );
        continue;
      }
      const me = slot === m.localSlot;
      const name = h(
        'span',
        { class: 'player-name' },
        this.face(p.character, slot, 'player-face'),
        h(
          'span',
          { class: 'player-id' },
          h('span', { class: 'player-id-name' }, p.name, me ? h('span', { class: 'you', text: 'du' }) : null),
          h('span', { class: 'player-fig', text: `fährt ${CHARACTERS[p.character]?.name ?? ''}` }),
        ),
      );
      const tags = h('span', { class: 'player-tags' });
      if (p.isHost) tags.append(h('span', { class: 'tag tag-host', text: 'Host' }));
      if (!p.online) tags.append(h('span', { class: 'tag tag-bad', text: 'getrennt' }));

      const controller = h(
        'span',
        { class: `stat stat-controller ${p.controller ? 'stat-ok' : 'stat-off'}` },
        h('span', { class: 'stat-label', text: 'Controller' }),
        p.controller ? `verbunden · ${ms(p.ctrlRtt)}` : 'nicht verbunden',
      );
      const ready = h(
        'span',
        { class: `stat stat-ready ${p.isHost || p.ready ? 'stat-ok' : 'stat-off'}` },
        h('span', { class: 'stat-label', text: 'Status' }),
        p.isHost ? 'startet' : p.ready ? 'bereit' : 'nicht bereit',
      );
      const ping = h(
        'span',
        { class: 'stat stat-num' },
        h('span', { class: 'stat-label', text: 'Ping' }),
        p.isHost ? 'Host' : p.online ? ms(p.ping) : '–',
      );
      const row = h(
        'li',
        { class: `player${me ? ' player-me' : ''}${p.online ? '' : ' player-off'}` },
        chip,
        name,
        tags,
        controller,
        ready,
        ping,
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
   */
  private face(character: number, slot: number, cls: string, render = true): HTMLImageElement {
    const img = h('img', { class: cls, alt: '' });
    img.style.setProperty('--c', playerColor(slot));
    const key = `${character}:${slot}`;
    const ready = this.portraits.get(key);
    if (ready) img.src = ready;
    else {
      img.dataset.empty = 'true';
      if (render) {
        let job = this.portraitJobs.find((j) => j.key === key);
        if (!job) this.portraitJobs.push((job = { key, character, slot, targets: [] }));
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
      const url = portraitUrl(job.character, job.slot, 192);
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

  /** Figurenwahl: vier Karten mit Bild und Fahrwerten. */
  private renderCharacters(m: LobbyModel): void {
    const list = $('char-list');
    list.replaceChildren();
    const labels = ['Tempo', 'Antritt', 'Kurven'];
    CHARACTERS.forEach((c, i) => {
      const bars = h('span', { class: 'char-bars' });
      c.bars.forEach((value, k) => {
        const pips = h('span', { class: 'pips' });
        for (let n = 1; n <= 5; n++) pips.append(h('i', { class: n <= value ? 'on' : '' }));
        bars.append(h('span', { class: 'char-bar' }, h('span', { text: labels[k] }), pips));
      });
      const card = h(
        'button',
        { class: 'char-card', type: 'button' },
        this.face(i, Math.max(0, m.localSlot), 'char-face'),
        h('span', { class: 'char-name', text: c.name }),
        bars,
      ) as HTMLButtonElement;
      card.dataset.on = String(i === m.character);
      card.setAttribute('aria-pressed', String(i === m.character));
      card.addEventListener('click', () => {
        this.on.click('click');
        this.on.setCharacter(i);
      });
      list.append(card);
    });
    $('char-trait').textContent = CHARACTERS[m.character]?.trait ?? '';
  }

  /** Streckenkarten und KI-Stärke in der Lobby. */
  private renderSetup(m: LobbyModel): void {
    const list = $('track-list');
    list.replaceChildren();
    for (let i = 0; i < OFFERED_TRACKS; i++) {
      const t = getTrack(i);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 120 74');
      svg.setAttribute('class', 'track-map');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', trackPath(t, 120, 74, 8));
      svg.append(path);
      const card = h(
        'button',
        { class: 'track-card', type: 'button' },
        svg,
        h('span', { class: 'track-name', text: t.def.name }),
        h('span', { class: 'track-blurb', text: t.def.blurb }),
        // Was diese Strecke anders macht als die anderen
        ...(t.def.twist ? [h('span', { class: 'track-twist', text: t.def.twist })] : []),
        h('span', { class: 'track-meta', text: `${Math.round(t.length / 10) * 10} m · ${'●'.repeat(t.def.grade)}${'○'.repeat(3 - t.def.grade)}` }),
      ) as HTMLButtonElement;
      card.dataset.on = String(i === m.track);
      card.disabled = !m.isHost;
      card.setAttribute('aria-pressed', String(i === m.track));
      card.addEventListener('click', () => {
        this.on.click('click');
        this.on.setTrack(i);
      });
      list.append(card);
    }
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

  /** Einstellungen dieses Bildschirms: Grafik und Ton. */
  showSettings(): void {
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
    const body = h(
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
    this.showModal('Einstellungen', [body], [{ label: 'Fertig', primary: true, run: () => undefined }]);
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
