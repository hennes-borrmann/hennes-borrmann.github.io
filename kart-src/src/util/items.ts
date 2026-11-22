// Namen und Symbole der Items – für die Anzeige auf Bildschirm und Handy.

import {
  ITEM_BOOST,
  ITEM_DRILL,
  ITEM_EMP,
  ITEM_GLUE,
  ITEM_GOLD,
  ITEM_GUARD,
  ITEM_HOOK,
  ITEM_KITE,
  ITEM_OIL,
  ITEM_ROCKET,
  ITEM_ROBOT,
  ITEM_SMOKE,
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
  [ITEM_ROBOT]: {
    name: 'Roboter',
    hint: 'Verwandeln, rennen, Satz nach vorn',
    // Roboter mit Antenne und Augen (ausgespart), Armen und Rädern als Füßen.
    icon:
      '<circle cx="12" cy="2.1" r="1.5" fill="currentColor"/><rect x="11.2" y="2.6" width="1.6" height="2.4" fill="currentColor"/>' +
      '<path fill-rule="evenodd" d="M9 4.4h6a1.700 1.700 0 0 1 1.700 1.700v3.100A1.700 1.700 0 0 1 15 10.900H9a1.700 1.700 0 0 1-1.700-1.700V6.100A1.700 1.700 0 0 1 9 4.400zm1.300 2.200a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400zm3.400 0a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400z" fill="currentColor"/>' +
      '<rect x="6.600" y="11.700" width="10.800" height="5.400" rx="1.200" fill="currentColor"/>' +
      '<rect x="2.800" y="11.900" width="2.800" height="5.400" rx="1.400" fill="currentColor"/><rect x="18.400" y="11.900" width="2.800" height="5.400" rx="1.400" fill="currentColor"/>' +
      '<rect x="8.500" y="16.800" width="2.200" height="2.200" fill="currentColor"/><rect x="13.300" y="16.800" width="2.200" height="2.200" fill="currentColor"/>' +
      '<circle cx="9.600" cy="20.500" r="1.900" fill="none" stroke="currentColor" stroke-width="1.700"/><circle cx="14.400" cy="20.500" r="1.900" fill="none" stroke="currentColor" stroke-width="1.700"/>',
  },
  [ITEM_GLUE]: {
    name: 'Kleber',
    hint: 'Klebt dem hinter dir die Sicht zu',
    // Klebepistole (Griff, Abzug, Düse), vorn tropft ein Klecks.
    icon:
      '<path d="M8.200 4.400h11.400a2.100 2.100 0 0 1 2.100 2.100v3a2.100 2.100 0 0 1-2.100 2.100h-2.200l1.100 8a1.300 1.300 0 0 1-1.300 1.500h-2.600a1.300 1.300 0 0 1-1.300-1.100l-1.300-8.400H8.200z" fill="currentColor"/>' +
      '<path d="M8.400 5.800 3.200 7.300v1.900l5.200 1.500z" fill="currentColor"/>' +
      '<path d="M11.400 12.600c.2 1.700.9 2.800 2.100 3.400" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round"/>' +
      '<path d="M3.700 11.200c1.500 2.100 2.700 3.500 2.700 5a2.700 2.700 0 0 1-5.400 0c0-1.500 1.200-2.900 2.700-5z" fill="currentColor"/>',
  },
  [ITEM_DRILL]: {
    name: 'Bohrer',
    hint: 'Bohrt sich zum Ersten',
    // Griff, Motorgehäuse mit ausgespartem Band, darunter der Bohrkopf als Kegel mit schrägen Spiralfugen.
    icon: '<rect x="6" y="1.4" width="12" height="2.8" rx="1.4" fill="currentColor"/><rect x="10.6" y="3.6" width="2.8" height="2.4" fill="currentColor"/><path fill-rule="evenodd" d="M8.5 5.5h7a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2zM8.6 8.1h6.8v1.3H8.6z" fill="currentColor"/><rect x="9.6" y="11" width="4.8" height="1.8" fill="currentColor"/><path d="M7.5 12.5H16.5L15.72 14.4 8.77 15.6zM9.34 17 15.15 15.8 14.21 18.1 10.28 19.3zM10.85 20.7 13.64 19.5 12 23.5z" fill="currentColor"/>',
  },
  [ITEM_HOOK]: {
    name: 'Enterhaken',
    hint: 'Zieht dich an den Fahrer vor dir',
    // Enterhaken: Schaft mit Spitze, links und rechts je eine Kralle, die im Bogen nach unten greift (Spitzen als Dreiecke),
    // unten die Öse (ausgespart) – durch sie läuft ein Stück Leine.
    icon:
      `<path d="M12 5v9.800" ${STROKE}/>` +
      '<path d="M12 1 13.700 4.600h-3.400z" fill="currentColor"/>' +
      `<path d="M12 5.600C9.300 2.300 4.400 3.700 4.400 8.200v1.600" ${STROKE}/>` +
      `<path d="M12 5.600c2.700-3.300 7.600-1.900 7.600 2.600v1.600" ${STROKE}/>` +
      '<path d="M2.100 9.200h4.600l-2.300 4z" fill="currentColor"/><path d="M17.300 9.200h4.600l-2.300 4z" fill="currentColor"/>' +
      '<circle cx="12" cy="17.900" r="2.500" fill="none" stroke="currentColor" stroke-width="2.200"/>' +
      '<path d="M9.800 19.600c-1.900 1.500-3.700.3-5.600 2.500" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/>',
  },
};

/** Symbol während der Auslosung. */
export const ROLLING_ICON =
  '<circle cx="5" cy="12" r="2.4" fill="currentColor"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><circle cx="19" cy="12" r="2.4" fill="currentColor"/>';

export function itemSvg(inner: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}
