// Oberfläche des Bildschirms: Startseite, Lobby, Bedienelemente über der
// Testszene sowie Meldungen. Reine Anzeige – die Logik sitzt in app.ts.

import type { LobbyPlayer } from '../net/protocol';
import { MAX_PLAYERS } from '../game/sim';
import { CODE_ALPHABET, ROOM_CODE_LENGTH, isValidCode, normalizeCode } from '../net/codes';
import { $, h, ms } from '../util/dom';
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

  constructor(on: UiHandlers) {
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
    this.btnBack.addEventListener('click', () => on.backToLobby());
    $('btn-camera').addEventListener('click', () => on.toggleCamera());
    $('btn-debug').addEventListener('click', () => on.toggleDebug());
    $('btn-debug-lobby').addEventListener('click', () => on.toggleDebug());
    $('btn-pair').addEventListener('click', () => on.showPairing());
    $('btn-copy').addEventListener('click', () => void this.copyInvite());
    // Knöpfe über der Testszene geben den Fokus sofort wieder ab – sonst würde
    // die Leertaste (Item) den zuletzt angeklickten Knopf erneut auslösen.
    for (const btn of document.querySelectorAll<HTMLButtonElement>('.hud-actions .btn')) {
      btn.addEventListener('click', () => btn.blur());
    }
  }

  show(view: ViewName): void {
    this.app.dataset.view = view;
    // Die Diagnose hängt in der Lobby fest im Layout (verdeckt nichts) und
    // schwebt nur über der Testszene.
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
    const json = JSON.stringify([m.players, m.localSlot]);
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

    let hint = '';
    if (m.isHost) {
      if (m.waitingFor.length > 0) hint = `Noch nicht bereit: ${m.waitingFor.join(', ')}`;
      else if (m.players.length === 1) hint = 'Du kannst allein starten oder auf Mitspieler warten.';
      else hint = 'Alle bereit.';
    } else {
      hint = m.localReady ? 'Der Host startet die Testfahrt.' : 'Melde dich bereit, wenn dein Controller verbunden ist.';
    }
    $('lobby-hint').textContent = hint;

    $('hud-note').textContent = m.controllerConnected
      ? ''
      : 'Kein Handy verbunden – „Controller“ zeigt den QR-Code. Zum Testen am Desktop: Pfeiltasten/WASD, Shift = Drift, Leertaste = Item.';
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

  /** QR-Code zum (Neu-)Koppeln während der Testfahrt. */
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
    const hud = $('hud-players');
    list.replaceChildren();
    hud.replaceChildren();
    const bySlot = new Map(m.players.map((p) => [p.slot, p]));
    for (let slot = 0; slot < MAX_PLAYERS; slot++) {
      const p = bySlot.get(slot);
      const chip = h('span', { class: 'chip', text: String(slot + 1) });
      chip.style.setProperty('--c', playerColor(slot));
      if (!p) {
        list.append(
          h('li', { class: 'player player-empty' }, chip, h('span', { class: 'player-name', text: 'frei' })),
        );
        continue;
      }
      const me = slot === m.localSlot;
      const name = h('span', { class: 'player-name' }, p.name, me ? h('span', { class: 'you', text: 'du' }) : null);
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
      const row = h('li', { class: `player${me ? ' player-me' : ''}${p.online ? '' : ' player-off'}` }, chip, name, tags, controller, ready, ping);
      row.title = `Platz ${slot + 1} · ${PLAYER_COLOR_NAMES[slot]}`;
      list.append(row);

      const dot = h('span', { class: `hud-player${p.online ? '' : ' off'}`, text: p.name });
      dot.style.setProperty('--c', playerColor(slot));
      hud.append(dot);
    }
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
