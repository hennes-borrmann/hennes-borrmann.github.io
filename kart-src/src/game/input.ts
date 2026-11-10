// Eingabequellen auf dem Bildschirm: gekoppeltes Handy und (zum Testen am
// Desktop) die Tastatur. Beide liefern pro Simulationsschritt einen Cmd.

import { readCtrlInput, seq16Newer } from '../net/protocol';
import { BTN_BRAKE, BTN_DRIFT, BTN_GAS, BTN_ITEM, DT, type Cmd } from './sim';

/** Ohne frisches Paket gilt die Handy-Eingabe nach dieser Zeit als losgelassen. */
const STALE_MS = 300;

function seq8Delta(a: number, b: number): number {
  return (a - b) & 0xff;
}

export class ControllerInput {
  /** Zeitpunkt des letzten Eingabepakets (performance.now), 0 = noch keins. */
  lastPacketAt = 0;
  packets = 0;
  /** Zuletzt empfangener Rohwert, auch für das Debug-Overlay. */
  steer = 0;
  buttons = 0;

  private lastSeq = -1;
  private itemCount = -1;
  private itemQueued = 0;
  private itemOut = false;

  reset(): void {
    this.lastPacketAt = 0;
    this.steer = 0;
    this.buttons = 0;
    this.lastSeq = -1;
    this.itemCount = -1;
    this.itemQueued = 0;
    this.itemOut = false;
  }

  onPacket(view: DataView): void {
    const p = readCtrlInput(view);
    if (!p) return;
    this.packets++;
    // Ungeordneter Kanal: nur neuere Pakete zählen.
    if (this.lastSeq >= 0 && !seq16Newer(p.seq, this.lastSeq)) return;
    this.lastSeq = p.seq;
    this.lastPacketAt = performance.now();
    this.steer = p.steer;
    this.buttons = p.buttons;
    this.noteItemCount(p.itemCount);
  }

  /** Item-Druck über den zuverlässigen Kanal (kommt evtl. doppelt zum schnellen Paket an). */
  onItemPress(count: number): void {
    this.noteItemCount(count & 0xff);
  }

  get fresh(): boolean {
    return this.lastPacketAt > 0 && performance.now() - this.lastPacketAt < STALE_MS;
  }

  sample(): Cmd {
    const fresh = this.fresh;
    const held = fresh && (this.buttons & BTN_ITEM) !== 0;
    // Jeder gezählte Druck erzeugt genau eine Flanke 0→1 – auch dann, wenn das
    // Halten selbst nie in einem schnellen Paket ankam.
    let item: boolean;
    if (this.itemQueued > 0) {
      if (this.itemOut) item = false;
      else {
        item = true;
        this.itemQueued--;
      }
    } else {
      item = this.itemOut && held;
    }
    this.itemOut = item;
    if (!fresh) return { steer: 0, buttons: item ? BTN_ITEM : 0 };
    return { steer: this.steer, buttons: (this.buttons & ~BTN_ITEM) | (item ? BTN_ITEM : 0) };
  }

  private noteItemCount(count: number): void {
    if (this.itemCount < 0) {
      // Erster Kontakt: Zählerstand übernehmen, ohne alte Drücke nachzuholen.
      this.itemCount = count;
      return;
    }
    const d = seq8Delta(count, this.itemCount);
    if (d === 0 || d >= 128) return;
    this.itemCount = count;
    this.itemQueued = Math.min(this.itemQueued + d, 3);
  }
}

const KEYMAP: Record<string, 'left' | 'right' | 'gas' | 'brake' | 'drift' | 'item'> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'gas',
  KeyW: 'gas',
  ArrowDown: 'brake',
  KeyS: 'brake',
  ShiftLeft: 'drift',
  ShiftRight: 'drift',
  Space: 'item',
};

export class KeyboardInput {
  private readonly down = new Set<string>();
  private steer = 0;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (!action || this.typing(e)) return;
      this.down.add(action);
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) this.down.delete(action);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  /** Wird die Tastatur gerade zum Lenken benutzt? */
  get steering(): boolean {
    return this.down.has('left') || this.down.has('right');
  }

  get any(): boolean {
    return this.down.size > 0;
  }

  /** Einmal pro Simulationsschritt aufrufen. */
  sample(): Cmd {
    // Tasten kennen nur an/aus; weich hin- und zurückfahren, damit es lenkbar bleibt.
    const target = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
    const rate = (target === 0 ? 7 : 5) * DT;
    if (this.steer < target) this.steer = Math.min(target, this.steer + rate);
    else if (this.steer > target) this.steer = Math.max(target, this.steer - rate);
    let buttons = 0;
    if (this.down.has('gas')) buttons |= BTN_GAS;
    if (this.down.has('brake')) buttons |= BTN_BRAKE;
    if (this.down.has('drift')) buttons |= BTN_DRIFT;
    if (this.down.has('item')) buttons |= BTN_ITEM;
    return { steer: Math.round(this.steer * 127), buttons };
  }

  private typing(e: KeyboardEvent): boolean {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }
}

/** Handy hat Vorrang; die Tastatur ergänzt Tasten und übernimmt die Lenkung, wenn sie gedrückt wird. */
export function mergeInput(controller: Cmd | null, keyboard: Cmd, keyboardSteering: boolean): Cmd {
  if (!controller) return keyboard;
  return {
    steer: keyboardSteering ? keyboard.steer : controller.steer,
    buttons: controller.buttons | keyboard.buttons,
  };
}
