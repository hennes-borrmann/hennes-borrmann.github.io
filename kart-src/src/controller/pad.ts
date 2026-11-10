// Touch-Tasten des Controllers.
//
// Alle Finger werden gemeinsam ausgewertet: bei jedem Ereignis prüfen wir für
// jeden aufliegenden Finger, über welcher Taste er gerade ist. So kann man mit
// dem Daumen von Gas auf Bremse rutschen, ohne abzusetzen, und eine Taste
// bleibt nie "hängen".

import { BTN_BRAKE, BTN_DRIFT, BTN_GAS, BTN_ITEM } from '../game/sim';

const BITS: Record<string, number> = { gas: BTN_GAS, brake: BTN_BRAKE, drift: BTN_DRIFT, item: BTN_ITEM };

export class TouchPad {
  buttons = 0;
  /** Lenkwert der Touch-Lenkung (-1..1), nur im Touch-Modus relevant. */
  touchSteer = 0;
  onChange: ((buttons: number, previous: number) => void) | null = null;

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly els: HTMLElement[];
  private readonly steerZone: HTMLElement | null;

  constructor(private readonly root: HTMLElement) {
    this.els = Array.from(root.querySelectorAll<HTMLElement>('[data-btn]'));
    this.steerZone = root.querySelector<HTMLElement>('[data-steer]');
    const down = (e: PointerEvent): void => {
      // Bedienelemente in der Mitte (Kalibrieren, Einstellungen) normal klicken lassen.
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      e.preventDefault();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.update();
    };
    const move = (e: PointerEvent): void => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      this.update();
    };
    const up = (e: PointerEvent): void => {
      if (this.pointers.delete(e.pointerId)) this.update();
    };
    root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // Wechselt die App in den Hintergrund, kommen keine "losgelassen"-Ereignisse mehr.
    const releaseAll = (): void => {
      if (this.pointers.size === 0) return;
      this.pointers.clear();
      this.update();
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') releaseAll();
    });
  }

  private update(): void {
    let buttons = 0;
    let steer = 0;
    let steering = false;
    for (const p of this.pointers.values()) {
      const hit = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
      const btn = hit?.closest<HTMLElement>('[data-btn]');
      if (btn && this.root.contains(btn)) {
        buttons |= BITS[btn.dataset.btn ?? ''] ?? 0;
        continue;
      }
      if (this.steerZone && hit && this.steerZone.contains(hit) && !steering) {
        // Lenkfläche: Position entlang der Fläche, Mitte = geradeaus. Die Fläche
        // kann per CSS gedreht sein, deshalb über die Eckpunkte rechnen.
        steer = this.steerFromPoint(p.x, p.y);
        steering = true;
      }
    }
    this.touchSteer = steering ? steer : 0;
    for (const el of this.els) el.classList.toggle('down', (buttons & (BITS[el.dataset.btn ?? ''] ?? 0)) !== 0);
    if (buttons !== this.buttons) {
      const previous = this.buttons;
      this.buttons = buttons;
      this.onChange?.(buttons, previous);
    }
  }

  private steerFromPoint(x: number, y: number): number {
    const zone = this.steerZone!;
    const r = zone.getBoundingClientRect();
    // data-rot am Wurzelelement sagt, wie die Oberfläche gedreht ist.
    const rot = document.documentElement.dataset.rot;
    let t: number;
    if (rot === 'cw') t = (y - r.top) / r.height;
    else if (rot === 'ccw') t = 1 - (y - r.top) / r.height;
    else t = (x - r.left) / r.width;
    return Math.max(-1, Math.min(1, (t - 0.5) * 2.4));
  }
}
