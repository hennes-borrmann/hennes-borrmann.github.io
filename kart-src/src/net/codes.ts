// Raumcodes und Zufallskennungen.
//
// Das Alphabet lässt alles weg, was man beim Ablesen oder Vorlesen verwechselt
// (0/O, 1/I/L, 2/Z, 5/S, 8/B), und zusätzlich alle Vokale, damit keine
// zufälligen Wörter entstehen. 21 Zeichen, 5 Stellen = rund 4 Mio. Codes.

export const CODE_ALPHABET = 'CDFGHJKMNPQRTVWX34679';
export const ROOM_CODE_LENGTH = 5;
export const SCREEN_ID_LENGTH = 8;

export function randomCode(length: number): string {
  const out: string[] = [];
  const buf = new Uint8Array(1);
  // Rejection Sampling, damit jedes Zeichen gleich wahrscheinlich ist.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) out.push(CODE_ALPHABET[buf[0] % CODE_ALPHABET.length]);
  }
  return out.join('');
}

/** Entfernt Leerzeichen/Bindestriche und macht Großbuchstaben. Prüft nicht die Gültigkeit. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(code: string, length: number): boolean {
  if (code.length !== length) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** Geheimer Zufallswert, z. B. als Spieler-Token für den Wiedereinstieg. */
export function randomToken(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
