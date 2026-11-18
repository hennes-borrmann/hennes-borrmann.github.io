// Namen und Symbole der Items – für die Anzeige auf Bildschirm und Handy.

import {
  ITEM_BOOST,
  ITEM_EMP,
  ITEM_GOLD,
  ITEM_GUARD,
  ITEM_KITE,
  ITEM_OIL,
  ITEM_ROCKET,
  ITEM_SMOKE,
  ITEM_SPRING,
  ITEM_TIRE,
  ITEM_TOP,
  ITEM_WING,
} from '../game/sim';

export interface ItemInfo {
  name: string;
  /** Was das Item tut, in wenigen Worten. */
  hint: string;
  /** Inhalt eines SVG mit viewBox "0 0 24 24"; Farbe über currentColor. */
  icon: string;
}

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';

export const ITEMS: Record<number, ItemInfo> = {
  [ITEM_BOOST]: {
    name: 'Zisch',
    hint: 'Schub nach vorn',
    icon: '<path d="M13.5 2 4 13.5h6.2L8.8 22 20 9.8h-6.6z" fill="currentColor"/>',
  },
  [ITEM_TIRE]: {
    name: 'Rollreifen',
    hint: 'Rollt geradeaus',
    icon: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  },
  [ITEM_OIL]: {
    name: 'Ölfleck',
    hint: 'Bleibt hinter dir liegen',
    icon: '<path d="M12 2.5c3.2 4.6 6.5 8 6.5 11.6a6.5 6.5 0 0 1-13 0C5.5 10.5 8.8 7.1 12 2.5z" fill="currentColor"/>',
  },
  [ITEM_TOP]: {
    name: 'Brummkreisel',
    hint: 'Sucht den Fahrer vor dir',
    icon: '<path d="M10.7 1.5h2.6v4.6c4 .3 7.2 1.9 7.2 4.1 0 2.9-3.9 5.6-6.6 9.4L12 22.5l-1.9-2.9C7.4 15.8 3.5 13.1 3.5 10.2c0-2.2 3.2-3.8 7.2-4.1z" fill="currentColor"/>',
  },
  [ITEM_GUARD]: {
    name: 'Stoßfänger',
    hint: 'Fängt einen Treffer ab',
    icon: '<path d="M12 2 20.5 5v6.4c0 5.200-3.600 8.900-8.500 10.600C7.100 20.300 3.500 16.600 3.500 11.400V5z" fill="currentColor"/>',
  },
  [ITEM_EMP]: {
    name: 'Kurzschluss',
    hint: 'Bremst alle vor dir',
    icon: `<path d="M8.500 2v4.500M15.500 2v4.500" ${STROKE}/><path d="M5 6.500h14v4a7 7 0 0 1-5 6.700V22h-4v-4.800a7 7 0 0 1-5-6.700z" fill="currentColor"/>`,
  },
  [ITEM_SMOKE]: {
    name: 'Nebelkerze',
    hint: 'Nimmt Verfolgern die Sicht',
    icon: '<path d="M7.200 19.500a4.700 4.700 0 0 1-.9-9.300 6.200 6.200 0 0 1 12-1.100 5.200 5.200 0 0 1-.8 10.400z" fill="currentColor"/>',
  },
  [ITEM_KITE]: {
    name: 'Abschleppdrache',
    hint: 'Zieht dich nach vorn · Bremse kappt',
    icon: `<path d="M12 1.500 20 9.500 12 17 4 9.500z" fill="currentColor"/><path d="M12 17c-.500 2 1.500 2.500 1 4.500M9.500 19.500l2.300.800M11.800 22.300l2.400-.900" ${STROKE}/>`,
  },
  [ITEM_ROCKET]: {
    name: 'Rakete',
    hint: 'Fliegt zum Fahrer vor dir',
    icon: '<path d="M12 1.500c3 2.300 4.300 6 4.300 9.800v5.200H7.700v-5.200C7.700 7.500 9 3.800 12 1.500z" fill="currentColor"/><path d="M7.700 11.500 4.500 15.500v3l3.200-1.600zM16.300 11.500l3.200 4v3l-3.200-1.600z" fill="currentColor"/><path d="M10 18.500c.300 1.600 1 2.800 2 4 1-1.200 1.700-2.400 2-4z" fill="currentColor"/>',
  },
  [ITEM_WING]: {
    name: 'Gleiter',
    hint: 'Hoch hinaus, schneller gleiten',
    icon: `<path d="M12 9.500 1.500 6.500c1 3.200 3.800 5.600 7.500 6.300L12 15l3-2.200c3.700-.700 6.500-3.100 7.500-6.300z" fill="currentColor"/><path d="M12 21.500V16.500M9.500 19l2.500-2.500 2.500 2.500" ${STROKE}/>`,
  },
  [ITEM_GOLD]: {
    name: 'Get Gold',
    hint: 'Gold, groß, unverwundbar',
    // Goldene Flasche mit Korken, ein Stern auf dem Bauch (ausgespart), daneben ein Glitzern.
    icon: '<rect x="9.6" y="1.4" width="4.8" height="3.2" rx="1" fill="currentColor"/><path fill-rule="evenodd" d="M10.2 5.4h3.6v2.5c2.700 1 4.400 3.400 4.400 6.300v5.900a2.400 2.400 0 0 1-2.400 2.400H8.200a2.400 2.400 0 0 1-2.400-2.400v-5.900c0-2.900 1.700-5.300 4.400-6.300zM12 12.200l.79 2.110 2.250.100-1.760 1.410.6 2.170L12 16.750l-1.880 1.240.6-2.170-1.760-1.410 2.250-.1z" fill="currentColor"/><path d="M20 2.200l.6 1.500 1.500.6-1.500.6-.6 1.500-.6-1.500-1.500-.6 1.500-.6z" fill="currentColor"/>',
  },
  [ITEM_SPRING]: {
    name: 'Sprungfeder',
    hint: 'Hüpfer über alles hinweg',
    icon: `<path d="M5.500 3h13M5.500 21h13M7 18l10-3.700L7 10.600l10-3.700" ${STROKE}/>`,
  },
};

/** Symbol während der Auslosung. */
export const ROLLING_ICON =
  '<circle cx="5" cy="12" r="2.4" fill="currentColor"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><circle cx="19" cy="12" r="2.4" fill="currentColor"/>';

export function itemSvg(inner: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}
