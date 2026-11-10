// Hilfen zum Beschreiben von Streckenverläufen.

/** Gleichmäßig verteilte Punkte auf einem Kreisbogen (Winkel in Grad, 0° = +x, 90° = +z). */
export function arc(cx: number, cz: number, r: number, from: number, to: number, count: number, y0: number, y1: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count; i++) {
    const k = count === 1 ? 0 : i / (count - 1);
    const a = ((from + (to - from) * k) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, y0 + (y1 - y0) * k]);
  }
  return out;
}

/**
 * Fahrzeuge für eine Spur des Verkehrs: von from bis to (Meter hinter der
 * Startlinie) alle step Meter eines, die Arten der Reihe nach aus kinds.
 * Ergebnis: [Art, Meter] für TrafficDef.
 */
export function convoy(from: number, to: number, step: number, kinds: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let at = from, k = 0; at <= to; at += step, k++) out.push([kinds[k % kinds.length], at]);
  return out;
}
