// Öffentliche Typen des Audio-Moduls.

export type MusicId = 'menu' | 'werkshof' | 'klippe' | 'glut' | 'nacht' | 'wolken' | 'riff' | 'eis' | 'mond' | 'hafen' | 'vulkan' | 'ruine' | 'gewitter' | 'dschungel' | 'spiegel' | 'wueste' | 'zimmer' | 'results';

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
  | 'avalanche' // eine Lawine geht nieder (ortsfest, auch aus der Ferne leise): Grollen schwillt an und hält bis ~2 s, Schneerauschen, polternde Brocken, weicher Ausklang (~3 s)
  | 'snow' // das eigene Kart steckt in der Lawine: dumpfes Wummern und Prasseln (wird etwa alle 0,3 s aufgerufen und verschmilzt zu einem Dröhnen)
  | 'icicle' // ein Eiszapfen schlägt ein (ortsfest): scharfes Knacken, glasiges Nachklingen, klirrende Splitter (~0,4 s)
  | 'launch' // eine Sprungplatte schleudert das Kart hoch (Mond): satter Federschlag, Druckluft-Zischen, dann ein schwebend aufsteigender Ton (~1 s)
  | 'meteor' // ein Meteorit schlägt ein (ortsfest): kurzes fallendes Heulen, ab 0,3 s dumpfer Einschlag, nachrieselndes Geröll (~1 s)
  | 'gust' // Sturmhafen: eine Böe setzt ein (ortsfest, auch aus der Ferne leise): Fauchen schwillt in ~0,5 s an, Pfeifen in der Takelage, klappernde Leinen, verweht (~1,2 s)
  | 'storm' // Sturmhafen: das eigene Kart steckt in der Böe: Windrauschen mit Druck und Knattern (wird etwa alle 0,3 s aufgerufen und verschmilzt zu einem Bett)
  | 'crumble' // Vulkaninsel: eine Platte der Fahrbahn beginnt zu bröckeln, 2,5 s bevor sie bricht (ortsfest) – VORLÄUFIG
  | 'crack' // Vulkaninsel: die Platte bricht weg und stürzt in die Lava (ortsfest) – VORLÄUFIG
  | 'collapse' // Vulkaninsel: die Hängebrücke stürzt ein (ortsfest, auf der ganzen Insel zu hören) – VORLÄUFIG
  | 'raft' // Dschungel-Fluss: das Kart rollt auf ein (anderes) Floß – hohles Holzrumpeln – VORLÄUFIG
  | 'rapids' // Dschungel-Fluss: das eigene Kart fährt auf dem Fluss (wird etwa alle 0,35 s aufgerufen) – VORLÄUFIG
  | 'falls' // Dschungel-Fluss: das Tosen des Wasserfalls (ortsfest, in der Nähe etwa alle 0,5 s aufgerufen) – VORLÄUFIG
  | 'thunder' // Gewitterkamm: ein Blitz schlägt auf der Bahn ein (ortsfest, auf dem ganzen Kamm zu hören) – VORLÄUFIG
  | 'rod' // Gewitterkamm: ein Blitz fährt in einen Blitzableiter, das Ladefeld steht (ortsfest) – VORLÄUFIG
  | 'rumble' // Gewitterkamm: fernes Donnergrollen nach einem Wetterleuchten (überall) – VORLÄUFIG
  | 'charge' // Gewitterkamm: das Kart wird im Ladefeld aufgeladen (Schub) – VORLÄUFIG
  | 'riftwarn' // Zeitriss-Ruine: drei Sekunden vor dem Sprung der Zeit – ein tiefer Gong (überall gleich laut) – VORLÄUFIG
  | 'rift' // Zeitriss-Ruine: die Zeit reißt, die Welt springt ins andere Zeitalter (überall gleich laut) – VORLÄUFIG
  | 'drain' // Vulkaninsel: die Lavaröhre läuft leer und ist frei (ortsfest, auf der ganzen Insel zu hören) – VORLÄUFIG
  | 'portal' // Spiegelkabinett: ein Kart fährt durch ein Portal, das vorwärts führt (Abkürzung) – VORLÄUFIG
  | 'mirror' // Spiegelkabinett: ein Kart fährt durch ein Portal, das zurückwirft (Falle) – VORLÄUFIG
  | 'shimmer' // Spiegelkabinett: in einem Rahmen erscheint oder verschwindet ein Spiegel (ortsfest, bis ~110 m zu hören) – VORLÄUFIG
  | 'whistle' // Wüstenexpress: die Lok pfeift (ortsfest an der Lok, alle 11 s, bis ~220 m zu hören) – VORLÄUFIG
  | 'trainpass' // Wüstenexpress: ein Zug rollt dicht am eigenen Kart vorbei (ortsfest, etwa alle 0,45 s aufgerufen) – VORLÄUFIG
  | 'board' // Wüstenexpress: ein Kart rollt über die Rampe aufs Wagendach – VORLÄUFIG
  | 'rattle' // Wüstenexpress: das eigene Kart fährt über die Wagendächer (etwa alle 0,3 s aufgerufen) – VORLÄUFIG
  | 'shrink' // Riesenkinderzimmer: ein Kart schrumpft (durch den blauen Ring gefahren) – VORLÄUFIG
  | 'grow' // Riesenkinderzimmer: ein Kart wächst (durch den orangen Ring gefahren) – VORLÄUFIG
  | 'sizeend' // Riesenkinderzimmer: ein Kart ist wieder normal groß – VORLÄUFIG
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
