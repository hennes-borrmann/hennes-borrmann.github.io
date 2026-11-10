// Diagnose-Overlay: Lenkwert als Balken, Tasten, Latenzen, Raten und
// Verbindungsweg. Lenkbalken und Tastenlampen werden jedes Bild aktualisiert,
// der Text nur ein paar Mal pro Sekunde.

import { BTN_BRAKE, BTN_DRIFT, BTN_GAS, BTN_ITEM } from '../game/sim';
import { h } from '../util/dom';

export type Tone = 'ok' | 'warn' | 'bad' | undefined;

export interface DebugRow {
  label: string;
  value: string;
  tone?: Tone;
}

export interface DebugSection {
  title: string;
  rows: DebugRow[];
}

const BUTTONS: [number, string][] = [
  [BTN_GAS, 'Gas'],
  [BTN_BRAKE, 'Bremse'],
  [BTN_DRIFT, 'Drift'],
  [BTN_ITEM, 'Item'],
];

export class DebugOverlay {
  private readonly marker: HTMLElement;
  private readonly steerValue: HTMLElement;
  private readonly lamps: HTMLElement[] = [];
  private readonly sections: HTMLElement;
  private lastSteer = Number.NaN;
  private lastButtons = -1;

  constructor(private readonly root: HTMLElement) {
    this.marker = h('div', { class: 'steer-marker' });
    this.steerValue = h('span', { class: 'steer-value', text: '0.00' });
    const bar = h('div', { class: 'steer-bar' }, h('div', { class: 'steer-center' }), this.marker);
    const lampRow = h('div', { class: 'lamps' });
    for (const [, label] of BUTTONS) {
      const lamp = h('span', { class: 'lamp', text: label });
      this.lamps.push(lamp);
      lampRow.append(lamp);
    }
    this.sections = h('div', { class: 'debug-sections' });
    root.append(
      h('div', { class: 'debug-input' }, h('div', { class: 'debug-title', text: 'Lenkung' }), this.steerValue, bar, lampRow),
      this.sections,
    );
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }

  /** @param steer -1..1 */
  setInput(steer: number, buttons: number): void {
    if (this.root.hidden) return;
    if (steer !== this.lastSteer) {
      this.lastSteer = steer;
      this.marker.style.transform = `translateX(${(steer * 50).toFixed(2)}%)`;
      this.steerValue.textContent = (steer >= 0 ? '+' : '−') + Math.abs(steer).toFixed(2);
    }
    if (buttons !== this.lastButtons) {
      this.lastButtons = buttons;
      BUTTONS.forEach(([bit], i) => this.lamps[i].classList.toggle('on', (buttons & bit) !== 0));
    }
  }

  setSections(sections: DebugSection[]): void {
    if (this.root.hidden) return;
    const frag = document.createDocumentFragment();
    for (const s of sections) {
      const list = h('dl', { class: 'debug-list' });
      for (const row of s.rows) {
        list.append(h('dt', { text: row.label }), h('dd', { class: row.tone ? `tone-${row.tone}` : '', text: row.value }));
      }
      frag.append(h('section', {}, h('div', { class: 'debug-title', text: s.title }), list));
    }
    this.sections.replaceChildren(frag);
  }
}
