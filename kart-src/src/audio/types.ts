// Öffentliche Typen des Audio-Moduls.

export type MusicId = 'menu' | 'werkshof' | 'klippe' | 'glut' | 'nacht' | 'wolken' | 'riff' | 'results';

export type SfxName =
  | 'ui-click'
  | 'ui-back'
  | 'join'
  | 'ready'
  | 'count'
  | 'go'
  | 'boost' // Boost-Feld oder Item "Zisch"
  | 'turbo1'
  | 'turbo2'
  | 'turbo3' // Mini-Turbo nach Drift, je Stufe kräftiger/höher
  | 'drift-start'
  | 'pickup' // Item-Kiste eingesammelt
  | 'roulette-tick' // Auslosung läuft (wird ~12×/s aufgerufen)
  | 'item-ready' // Auslosung fertig
  | 'use-tire' // Rollreifen abgefeuert
  | 'use-oil' // Ölfleck abgelegt (Platsch)
  | 'use-top' // Brummkreisel (zielsuchend, surrt) gestartet
  | 'use-guard' // Stoßfänger (Schutz) aktiviert
  | 'use-emp' // Kurzschluss (elektrischer Schlag für die Gegner)
  | 'use-smoke' // Nebelkerze (Zischen, Puff)
  | 'use-spring' // Sprungfeder (Boing, aber eigenständig)
  | 'use-kite' // Abschleppdrache steigt auf (Flattern, Sirren der Schnur)
  | 'warn' // ein Brummkreisel hat dich im Visier (kurzer Warnton, wiederholt)
  | 'hit' // eigenes Kart getroffen, schleudert
  | 'guard-block' // Treffer vom Stoßfänger abgefangen (metallisches Klonk)
  | 'stall' // vom Kurzschluss erwischt (Motor stottert)
  | 'bump' // Rempler Kart an Kart
  | 'wall' // Bande berührt
  | 'land' // Landung nach Sprung
  | 'fall' // in den Abgrund gefallen
  | 'respawn' // zurück auf die Strecke gesetzt
  | 'lap' // neue Runde
  | 'final-lap' // letzte Runde beginnt (kurzer Jingle)
  | 'finish' // Ziel erreicht
  | 'draft' // aus dem Windschatten ausgeschert: kurzer Sog (leiser als ein Schub)
  | 'geyser' // ein Geysir bricht aus: Zischen und Fauchen, gut eine Sekunde
  | 'bomb' // eine Lavabombe schlägt ein: dumpfer Schlag, Zischen
  | 'honk' // ein Bus oder Taxi hupt, weil man es berührt
  | 'pass' // dicht an einem Fahrzeug vorbeigezogen: kurzer Fahrtwind
  | 'burn' // das Kart fährt durch Lava: Zischen (wird etwa 3×/s aufgerufen)
  | 'press' // eine Stampfpresse schlägt herunter: schwerer metallischer Schlag
  | 'splash' // das Kart fährt durch Wasser: Platschen (wird etwa 3–4×/s aufgerufen)
  | 'wings' // die Gleitflügel klappen aus (Abflug von der Rampe): Schnappen von Stoff, kurzes Aufrauschen
  | 'ring' // durch einen Schubring geflogen: Gleitton in hellen Glanz-Zweiklang, Schubrauschen (auch fremde Karts)
  | 'lift' // in einen Aufwind geraten: weiches Aufrauschen, das nach oben zieht
  | 'dive' // das Kart taucht ein: satter Platscher, Schlucken, Gurgeln, tiefes Ausklingen (~0,55 s; der Unterwasser-Filter schließt dabei)
  | 'surface' // das Kart durchbricht die Oberfläche nach oben: Schwappen, Aufrauschen, hauchiges „Luft!", abperlende Tropfen (~0,5 s)
  | 'bubbles' // ein Blasenschlot beginnt zu blasen: Brodeln, immer dichter aufsteigende kleine Blasen (~0,9 s; ortsfest, auch aus der Ferne leise)
  | 'blubb' // vom Blasenschlot angehoben: flatterndes „Bl…", runder steigender Grundton, Plopp am Ende (~0,45 s)
  | 'wind' // Fahrtwind im Gleitflug, nur eigenes Kart (wird etwa alle 0,42 s aufgerufen und verschmilzt zu einem Rauschen)
  | 'win'
  | 'lose'; // Ergebnis: Platz 1 bzw. hinten

/** Zustand eines Karts für die Dauergeräusche, pro Bild neu übergeben. */
export interface KartSound {
  /** 0..3, bestimmt die Klangfarbe des Motors (jedes Kart klingt etwas anders). */
  slot: number;
  /** Eigenes Kart: voll und nah; fremde: leiser, entfernungsabhängig. */
  local: boolean;
  /** 0..1.4 (1 = normale Höchstgeschwindigkeit, darüber = Schub). */
  speed: number;
  throttle: boolean;
  boost: boolean;
  /** 0 = kein Drift, 1..3 = Drift mit Mini-Turbo-Stufe (Drift noch ohne Stufe → 0.5). */
  drift: number;
  offroad: boolean;
  air: boolean;
  /** Kurzschluss: Motor stottert. */
  stall: boolean;
  /** Meter bis zur Kamera. */
  distance: number;
  /** -1 (links) .. 1 (rechts). */
  pan: number;
}
