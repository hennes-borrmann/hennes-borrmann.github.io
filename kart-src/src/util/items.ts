// Namen und Symbole der Items – für die Anzeige auf Bildschirm und Handy.

import { ITEM_BOOST, ITEM_OIL, ITEM_TIRE } from '../game/sim';

export interface ItemInfo {
  name: string;
  /** Inhalt eines SVG mit viewBox "0 0 24 24"; Farbe über currentColor. */
  icon: string;
}

export const ITEMS: Record<number, ItemInfo> = {
  [ITEM_BOOST]: {
    name: 'Zisch',
    icon: '<path d="M13.5 2 4 13.5h6.2L8.8 22 20 9.8h-6.6z" fill="currentColor"/>',
  },
  [ITEM_TIRE]: {
    name: 'Rollreifen',
    icon: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  },
  [ITEM_OIL]: {
    name: 'Ölfleck',
    icon: '<path d="M12 2.5c3.2 4.6 6.5 8 6.5 11.6a6.5 6.5 0 0 1-13 0C5.5 10.5 8.8 7.1 12 2.5z" fill="currentColor"/>',
  },
};

/** Symbol während der Auslosung. */
export const ROLLING_ICON =
  '<circle cx="5" cy="12" r="2.4" fill="currentColor"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><circle cx="19" cy="12" r="2.4" fill="currentColor"/>';

export function itemSvg(inner: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}
