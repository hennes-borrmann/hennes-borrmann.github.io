// Kulisse der Neonhochbahn: eine Zukunftsstadt bei Nacht, die Bahn hoch über ihren Straßen.
//
// Rund um die Strecke steht die Stadt in einem Straßenraster: Türme mit Rücksprüngen und Kronen, runde Türme, breite
// Scheiben mit Dachgärten, dazwischen Häuserschluchten. Die Fenster sind eine Textur (ein Atlas mit drei Fensterarten:
// Raster, Bandfenster, Wohnungen mit Balkonen – gezeichnet mit Häufungen, so wie Büros und Wohnungen nachts wirklich
// leuchten); jede Fassade ist ein einziges Viereck. Leuchtreklamen mit erfundenen Namen und Klingenschilder an den
// Ecken hängen dort, wo man von der Bahn aus hinsieht (je 80 m Strecke höchstens drei). Hologramm-Laufschriften kreisen
// um einige Turmkronen, vor ein paar Fassaden schweben Hologramm-Tafeln mit vier Zeilen Laufschrift. Auf den Dächern:
// Gärten, Pools, Landeplätze für Lufttaxis, Solarfelder, Technik; Antennen tragen blinkende Warnlichter, über Straßen und
// Bahn spannen sich verglaste Skywalks.
//
// Die Höhen folgen der Strecke: An Startgerade, Fassade, Bahnhof und unterer Ebene stehen hohe Häuser dicht an der Bahn
// (Schluchten), an der Steilkurve, über dem Boulevard und rund um Gleitflug und Parkhausspirale bleiben die Dächer auf
// Höhe der Bahn (Blick über die Stadt und hinunter auf die Straßen), an der Dachstraße reichen sie bis knapp unter die
// Fahrbahn.
//
// Tief unten fließt der Verkehr: Lichtströme aus Scheinwerfern und Rücklichtern auf allen Straßen (eine Textur, die nur
// verschoben wird), Laternen, unter der Startgeraden der Boulevard zwischen den Stützen, im Südosten ein Kanal mit
// Brücken und dem Widerschein der Fenster. Darüber fliegen wenige Lufttaxis feste Runden durch die Straßenschluchten.
// Am Horizont steht die Skyline der übrigen Stadt (ohne Nebel gezeichnet, der Dunst ist in die Farben eingerechnet; sie
// steht mit ihrem ganzen Fuß außerhalb eines Kreises um die Strecke, sodass keins ihrer Dreiecke vor die Bahn reicht).
//
// Eingebunden ist, was die Mechanik zeichnet, ohne es zu verdoppeln: Der Turm, an dessen Fassade das Schwebeband
// entlangführt (mechanics/band.ts), bekommt Arkaden am Fuß und Dachaufbauten mit seinem Namen; gegenüber stehen Häuser,
// die zur Wand hin leuchten. Der Atriumturm (mechanics/atrium.ts) steht auf einem Sockel bis zum Boden und trägt eine
// Krone, der Bahnhof der U-Bahn (die Halle zeichnet world.ts, Graben und Züge metro.ts) bekommt ein Empfangsgebäude über
// der Halle, und die Rampen, auf denen die Züge unter die Stadt tauchen, verschwinden in Tunnelröhren. Im Innern der
// Steilkurve steht der erste Turm, die Lichtsäule mit einem Leuchtband als Wendel; in der Mitte der Parkhausspirale der
// Aufzugskern.
//
// Reine Kulisse: mindestens RAND Meter neben jeder Fahrbahnkante, über einer Fahrbahn nichts unter LUFT Metern (in der
// Halle bis zur Decke), nichts im Gleitflug-Korridor, nichts unter einem Steg (außer flachem Straßenzeug tief unten,
// abseits der Stützen, und den Tunnelröhren der U-Bahn, die direkt unter dem Steg der Abkürzung hängen müssen, weil die
// Züge dort noch flach fahren). Alles wird mit festem Zufall aus der Strecke abgeleitet; im Lauf wird nichts angelegt.
//
// Technik wie in der Nachtschicht: Eckenfarben, Toon-Material, unbeleuchtete Flächen mit Textur – keine eigenen Shader,
// keine Lichtquellen. Bewegt wird über wenige Matrizen (Taxis, Warnlichter) und zwei verschobene Texturen.
//
// Zeichenaufrufe: Bauten (Toon), Fassaden und Leuchtendes (ein Atlas), Skyline, Laufschriften, Lichtströme, Taxis,
// Lichter der Taxis und Warnlampen = 7 (hoch wie niedrig; niedrig mit kleinerer Stadt und weniger Zierde).

import * as THREE from 'three';
import { EDGE_DECK, EDGE_GAP, EDGE_GLIDE, EDGE_RAMP, EDGE_TUNNEL, EDGE_TWIST, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Mindestabstand zur Fahrbahnkante (Meter). */
const RAND = 3.5;
/** So hoch bleibt der Raum über einer Fahrbahn frei (Meter, mit Reserve). */
const LUFT = 10.6;
/** Straßenzeug darf unter einem Steg stehen, wenn es so weit unter der Fahrbahn bleibt (Meter). */
const UNTER = 6;
/** Halle über der Fahrbahn (world.ts: TUNNEL_H und Mantel): bis hierhin bleibt es frei. */
const HALLE = 7.4 * 1.04 + 1.6;
const TAU = Math.PI * 2;

// Straßenraster: Straßen alle PER Meter, STR breit (Mitte der Querstraßen bei x = XS + k · PER, z = k · PER)
const PER = 62;
const STR = 14;
const XS = -159;

// --- Farben -------------------------------------------------------------------------

const C_DACH = rgb(0x23264a);
const C_DACH_H = rgb(0x2e3260);
const C_ATTIKA = rgb(0x1b1e3c);
const C_BETON = rgb(0x2b2f58);
const C_BETON_D = rgb(0x1d2042);
const C_STAHL = rgb(0x3a3f6a);
const C_GEHWEG = rgb(0x1e2142);
const C_KAI = rgb(0x2a2c52);
const C_WASSER = rgb(0x070a1c);
const C_RASEN = rgb(0x173f3a);
const C_RASEN_D = rgb(0x12332f);
const C_LAUB = [0x2f7a5c, 0x26685a, 0x3a8a66, 0x2a5f6e].map(rgb);
const C_STAMM = rgb(0x3a2c3a);
const C_GLAS = rgb(0x1a3550);

const CYAN = rgb(0x5ff3ff);
const PINK = rgb(0xff3fae);
const VIOLETT = rgb(0x9a6bff);
const AMBER = rgb(0xffb347);
const MINZE = rgb(0x4dffb5);
const WARM = rgb(0xffd9a0);
const WEISS = rgb(0xf4f6ff);
const ROT = rgb(0xff2a3a);
const GELB = rgb(0xffd23f);
const NEON = [CYAN, PINK, VIOLETT, AMBER, MINZE];

const TAXI_LACK = rgb(0xf1e6c6);
const TAXI_DUNKEL = rgb(0x2c2a58);

// --- Atlas: Fensterarten und Schilder -----------------------------------------------

/** Leuchtreklamen (erfundene Namen) und ihre Farbe; die letzten vier gehören zu Bauten an der Strecke. */
const SCHILDER: [string, string][] = [
  ['NACHTFALTER', '#ff4fc0'],
  ['KAPSELHOTEL', '#5ff3ff'],
  ['SPÄTKAUF', '#ffd23f'],
  ['NUDELWERK', '#ff8a3d'],
  ['WOLKENBAR', '#b48bff'],
  ['FERNWEH', '#4dffb5'],
  ['KINO ORBIT', '#ff4f6a'],
  ['STROMTANKE', '#7fd0ff'],
  ['SCHWEBEBAND', '#5ff3ff'],
  ['LICHTHOF', '#ff4fc0'],
  ['TURMPLATZ', '#ffd23f'],
  ['PARKHAUS', '#7fb2ff'],
];
const S_BAND = 8;
const S_LICHTHOF = 9;
const S_TURMPLATZ = 10;
const S_PARKHAUS = 11;
/** Klingenschilder (Buchstaben übereinander) und dahinter je ein Zeichen: P (Parkhaus), U (U-Bahn), H (Landeplatz). */
const KLINGEN: [string, string, string, string][] = [
  ['HOTEL', '#ff4fc0', 'P', '#2f6bff'],
  ['NUDELN', '#ffd23f', 'U', '#2f6bff'],
  ['TANZ', '#5ff3ff', 'H', '#ff8a3d'],
];
/** Laufschriften der Hologramme (eine Zeile je Text). */
const LAUFSCHRIFT: [string, string][] = [
  ['LUFTTAXI  ★  RUND UM DIE UHR  ★  RUF 1-2-3  ★  ', '#5ff3ff'],
  ['NEONHOCHBAHN  ★  GROSSER PREIS  ★  ', '#ff5fc8'],
  ['WETTER: KLAR  ★  14 °C  ★  SCHWEBEBAND FREI  ★  ', '#ffd23f'],
  ['FERNWEH  ★  MONDREISEN AB 99 TALER  ★  ', '#4dffb5'],
];

interface Feld {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Breite durch Höhe des Felds. */
  aspect: number;
}

interface Atlas {
  canvas: HTMLCanvasElement;
  schild: Feld[];
  klinge: Feld[];
  zeichen: Feld[];
  /** Ein weißes Texel: Flächen nur mit Eckenfarbe (alle drei Ecken dieselbe Koordinate, also immer die feinste Stufe). */
  wu: number;
  wv: number;
}

/**
 * Der Atlas: 128 × 64 Zellen zu S Pixeln. Links drei Fensterarten zu je 32 Spalten (senkrecht wiederholbar: sie
 * reichen über die ganze Höhe), rechts 16 Zeilen mit Schildern, Klingen, Zeichen und einem weißen Feld.
 */
function zeichneAtlas(S: number): Atlas {
  const W = 128 * S;
  const H = 64 * S;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const r = seeded(4242);
  const q = (n: number): number => Math.round((n * S) / 16);
  const pick = <X>(list: [X, number][]): X => {
    let x = r();
    for (const [v, w] of list) {
      if (x < w) return v;
      x -= w;
    }
    return list[list.length - 1][0];
  };
  /** Farbe mit Helligkeit k (0 … 1) als CSS. */
  const hell = (hex: string, k: number): string => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v: number): number => Math.round(Math.min(255, v * k));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  // Stil 0: Raster – Büros und Wohnungen gemischt; ganze Einheiten (vier Fenster) gehen zusammen an.
  {
    const x0 = 0;
    for (let row = 0; row < 64; row++) {
      const techn = row % 16 === 15;
      const pFloor = 0.07 + 0.45 * r() * r() + (r() < 0.1 ? 0.3 : 0);
      for (let unit = 0; unit < 8; unit++) {
        const lit = r() < pFloor;
        const col = pick<string>([
          ['#ffcf85', 0.5],
          ['#ffe3b0', 0.12],
          ['#e8f0ff', 0.18],
          ['#7af2ff', 0.08],
          ['#ff6cc0', 0.06],
          ['#a98bff', 0.06],
        ]);
        for (let c = unit * 4; c < unit * 4 + 4; c++) {
          const x = x0 + c * S;
          const y = row * S;
          g.fillStyle = '#151831';
          g.fillRect(x, y, S, S);
          if (techn) {
            g.fillStyle = '#1f2346';
            for (let k = 2; k < 15; k += 3) g.fillRect(x, y + q(k), S, Math.max(1, q(1)));
            continue;
          }
          const on = lit ? r() < 0.82 : r() < 0.04;
          g.fillStyle = on ? hell(col, 0.72 + r() * 0.28) : r() < 0.5 ? '#1d2244' : '#20264c';
          g.fillRect(x + q(4), y + q(3), q(8), q(9));
          if (on && r() < 0.3) {
            // halb heruntergelassene Jalousie
            g.fillStyle = hell(col, 0.45);
            g.fillRect(x + q(4), y + q(3), q(8), q(4));
          } else if (!on) {
            g.fillStyle = '#2a3160';
            g.fillRect(x + q(4), y + q(3), q(8), Math.max(1, q(1)));
          }
          g.fillStyle = '#23284d';
          g.fillRect(x + q(3), y + q(13), q(10), Math.max(1, q(1)));
        }
      }
    }
  }
  // Stil 1: Bandfenster – Büroetagen, in Abschnitten hell (kaltweiß, blassblau, selten warm)
  {
    const x0 = 32 * S;
    for (let row = 0; row < 64; row++) {
      const techn = row % 12 === 11;
      const pFloor = 0.06 + 0.55 * r() * r();
      let c = 0;
      while (c < 32) {
        const run = 2 + Math.floor(r() * 7);
        const lit = r() < pFloor;
        const col = pick<string>([
          ['#e4eeff', 0.5],
          ['#cfe4ff', 0.28],
          ['#ffe6b8', 0.22],
        ]);
        const k0 = 0.78 + r() * 0.22;
        for (let k = c; k < Math.min(32, c + run); k++) {
          const x = x0 + k * S;
          const y = row * S;
          g.fillStyle = '#10122a';
          g.fillRect(x, y, S, S);
          g.fillStyle = '#262a54';
          g.fillRect(x, y + q(15), S, Math.max(1, q(1)));
          if (techn) {
            g.fillStyle = '#191c3a';
            g.fillRect(x, y + q(5), S, q(6));
            continue;
          }
          g.fillStyle = lit ? hell(col, k0 * (0.92 + r() * 0.08)) : '#1a1f3f';
          g.fillRect(x, y + q(4), S, q(9));
          if (!lit) {
            g.fillStyle = '#232a52';
            g.fillRect(x, y + q(4), S, Math.max(1, q(2)));
          }
          g.fillStyle = '#0b0d22';
          g.fillRect(x, y + q(4), Math.max(1, q(1)), q(9));
        }
        c += run;
      }
    }
  }
  // Stil 2: Wohnen – kleinere Fenster, Balkonplatten, warmes Licht und bunte Stimmungslampen
  {
    const x0 = 64 * S;
    for (let row = 0; row < 64; row++) {
      const pFloor = 0.16 + 0.32 * r();
      for (let pair = 0; pair < 16; pair++) {
        const lit = r() < pFloor;
        const col = pick<string>([
          ['#ffc879', 0.48],
          ['#ffa95e', 0.14],
          ['#ff74c8', 0.1],
          ['#b08cff', 0.1],
          ['#7f9cff', 0.1],
          ['#f2f4ff', 0.08],
        ]);
        for (let c = pair * 2; c < pair * 2 + 2; c++) {
          const x = x0 + c * S;
          const y = row * S;
          g.fillStyle = '#18162e';
          g.fillRect(x, y, S, S);
          const on = lit ? r() < 0.8 : r() < 0.06;
          g.fillStyle = on ? hell(col, 0.7 + r() * 0.3) : '#211f40';
          g.fillRect(x + q(5), y + q(3), q(6), q(9));
          // Balkonplatte mit Geländer
          g.fillStyle = '#2b2850';
          g.fillRect(x, y + q(13), S, q(3));
          g.fillStyle = '#3a3668';
          g.fillRect(x, y + q(12), S, Math.max(1, q(1)));
        }
      }
    }
  }

  // Rechte Spalte: Schilder (Zeilen 0–11), Klingen (12–14), weißes Feld (15)
  const sx0 = 96 * S;
  const SW = 32 * S;
  const RH = 4 * S;
  const font = (px: number): string => `900 ${px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  const schild: Feld[] = [];
  SCHILDER.forEach(([text, col], k) => {
    const y = k * RH;
    let size = Math.round(RH * 0.62);
    g.font = font(size);
    let w = g.measureText(text).width;
    const max = SW - RH * 0.9;
    if (w > max) {
      size = Math.floor((size * max) / w);
      g.font = font(size);
      w = g.measureText(text).width;
    }
    const pad = RH * 0.36;
    const bx0 = Math.max(sx0 + 2, Math.round(sx0 + SW / 2 - w / 2 - pad));
    const bx1 = Math.min(sx0 + SW - 2, Math.round(sx0 + SW / 2 + w / 2 + pad));
    g.fillStyle = '#0b0718';
    g.fillRect(bx0, y + 2, bx1 - bx0, RH - 4);
    g.strokeStyle = col;
    g.lineWidth = Math.max(2, RH * 0.07);
    g.strokeRect(bx0 + RH * 0.08, y + RH * 0.12, bx1 - bx0 - RH * 0.16, RH - RH * 0.24);
    g.fillStyle = col;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = col;
    g.shadowBlur = RH * 0.18;
    g.fillText(text, sx0 + SW / 2, y + RH * 0.54);
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.55;
    g.fillText(text, sx0 + SW / 2, y + RH * 0.54);
    g.globalAlpha = 1;
    schild.push({ u0: (bx0 + 1) / W, u1: (bx1 - 1) / W, v0: 1 - (y + RH - 3) / H, v1: 1 - (y + 3) / H, aspect: (bx1 - bx0) / (RH - 6) });
  });
  const klinge: Feld[] = [];
  const zeichen: Feld[] = [];
  KLINGEN.forEach(([text, col, mark, markCol], k) => {
    const y = (12 + k) * RH;
    // Buchstaben in quadratischen Zellen nebeneinander, je um eine Vierteldrehung gekippt: auf der senkrechten
    // Klinge (u läuft dort von oben nach unten) stehen sie dann aufrecht übereinander.
    const n = text.length;
    g.fillStyle = '#0b0718';
    g.fillRect(sx0, y + 1, n * RH, RH - 2);
    g.strokeStyle = col;
    g.lineWidth = Math.max(2, RH * 0.07);
    g.strokeRect(sx0 + RH * 0.08, y + RH * 0.1, n * RH - RH * 0.16, RH - RH * 0.2);
    g.font = font(Math.round(RH * 0.66));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(sx0 + (i + 0.5) * RH, y + RH / 2);
      g.rotate(Math.PI / 2);
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = RH * 0.16;
      g.fillText(text[i], 0, RH * 0.04);
      g.restore();
    }
    klinge.push({ u0: (sx0 + 2) / W, u1: (sx0 + n * RH - 2) / W, v0: 1 - (y + RH - 3) / H, v1: 1 - (y + 3) / H, aspect: n });
    // Zeichen: Quadrat mit Buchstabe
    const mx = sx0 + 7 * RH;
    g.fillStyle = markCol;
    g.fillRect(mx + 2, y + 2, RH - 4, RH - 4);
    g.strokeStyle = '#ffffff';
    g.lineWidth = Math.max(2, RH * 0.06);
    g.strokeRect(mx + RH * 0.1, y + RH * 0.1, RH * 0.8, RH * 0.8);
    g.fillStyle = '#ffffff';
    g.font = font(Math.round(RH * 0.7));
    g.fillText(mark, mx + RH / 2, y + RH * 0.54);
    zeichen.push({ u0: (mx + 3) / W, u1: (mx + RH - 3) / W, v0: 1 - (y + RH - 3) / H, v1: 1 - (y + 3) / H, aspect: 1 });
  });
  g.fillStyle = '#ffffff';
  g.fillRect(sx0, 15 * RH, SW, RH);
  return { canvas, schild, klinge, zeichen, wu: (sx0 + SW / 2) / W, wv: 1 - (15.5 * RH) / H };
}

/** Laufschriften: je Text eine Zeile, die sich waagerecht nahtlos wiederholt; Grund halbdurchsichtig mit Zeilen. */
function zeichneLaufschrift(S: number): HTMLCanvasElement {
  const W = 64 * S;
  const RH = 4 * S;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = RH * LAUFSCHRIFT.length;
  const g = canvas.getContext('2d')!;
  LAUFSCHRIFT.forEach(([text, col], k) => {
    const y = k * RH;
    for (let l = 0; l < RH; l += 2) {
      g.fillStyle = l % 4 === 0 ? 'rgba(80,200,255,0.16)' : 'rgba(80,200,255,0.07)';
      g.fillRect(0, y + l, W, 1);
    }
    g.fillStyle = col;
    g.fillRect(0, y, W, Math.max(1, S / 8));
    g.fillRect(0, y + RH - Math.max(1, S / 8), W, Math.max(1, S / 8));
    g.font = `900 ${Math.round(RH * 0.62)}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const w = g.measureText(text).width;
    const n = Math.max(1, Math.round(W / w));
    const sx = W / (n * w);
    g.save();
    g.translate(0, y + RH * 0.54);
    g.scale(sx, 1);
    g.fillStyle = col;
    g.shadowColor = col;
    g.shadowBlur = RH * 0.2;
    for (let i = 0; i < n; i++) g.fillText(text, i * w, 0);
    g.shadowBlur = 0;
    g.globalAlpha = 0.5;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) g.fillText(text, i * w, 0);
    g.restore();
    g.globalAlpha = 1;
  });
  return canvas;
}

/** Lichtpunkte des Verkehrs für eine Fahrspur: vorn ein Paar Scheinwerfer, hinten ein Paar Rücklichter. */
const STROM_L = 160;
function zeichneVerkehr(S: number): HTMLCanvasElement {
  const W = 2 * S;
  const H = 32 * S;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const r = seeded(777);
  const m = H / STROM_L; // Pixel je Meter
  const dot = Math.max(1, Math.round(m * 0.9));
  let y = 0;
  while (y < H - 14 * m) {
    // (Zeichenfläche oben = v 1: Scheinwerfer liegen bei größerem v, also weiter oben.) Vor dem Wagen ein Lichtkegel,
    // hinter ihm eine rote Spur – wie auf einem lange belichteten Foto, nur dass sie mitfährt.
    const head = H - y - dot;
    const tail = H - y - 4.3 * m;
    const cone = g.createLinearGradient(0, head, 0, head - 7 * m);
    cone.addColorStop(0, 'rgba(255,236,190,0.42)');
    cone.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = cone;
    g.fillRect(Math.round(W * 0.12), Math.round(head - 7 * m), Math.round(W * 0.76), Math.round(7 * m));
    const trail = g.createLinearGradient(0, tail, 0, tail + 9 * m);
    trail.addColorStop(0, 'rgba(255,40,60,0.5)');
    trail.addColorStop(1, 'rgba(255,40,60,0)');
    g.fillStyle = trail;
    g.fillRect(Math.round(W * 0.18), Math.round(tail), Math.round(W * 0.64), Math.round(9 * m));
    for (const fx of [0.26, 0.74]) {
      const x = Math.round(W * fx - dot / 2);
      g.fillStyle = r() < 0.15 ? '#cfe6ff' : '#fff2cf';
      g.fillRect(x, head, dot, dot);
      g.fillStyle = '#ff2a3a';
      g.fillRect(x, tail, dot, dot);
    }
    y += (4.5 + 7 + r() * r() * 28) * m;
  }
  return canvas;
}

// --- Bausteine -----------------------------------------------------------------------

/** Dreiecke mit Eckenfarbe und Texturkoordinate (unbeleuchtet). Ohne eigene Koordinate: das weiße Texel des Atlas. */
class Netz {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];
  constructor(
    private readonly wu = 0,
    private readonly wv = 0,
  ) {}
  get triangles(): number {
    return this.pos.length / 9;
  }
  get empty(): boolean {
    return this.pos.length === 0;
  }
  private v(p: V3, c: RGB, u: number, w: number): void {
    this.pos.push(p[0], p[1], p[2]);
    this.col.push(c[0], c[1], c[2]);
    this.uv.push(u, w);
  }
  tri(a: V3, b: V3, c: V3, col: RGB): void {
    this.v(a, col, this.wu, this.wv);
    this.v(b, col, this.wu, this.wv);
    this.v(c, col, this.wu, this.wv);
  }
  quad(a: V3, b: V3, c: V3, d: V3, col: RGB): void {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  }
  /** Viereck a (unten links) → b → c → d (oben links), Texturfeld u0,v0 … u1,v1, Farbe je Ecke. */
  quadUv(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB, u0: number, v0: number, u1: number, v1: number): void {
    this.v(a, ca, u0, v0);
    this.v(b, cb, u1, v0);
    this.v(c, cc, u1, v1);
    this.v(a, ca, u0, v0);
    this.v(c, cc, u1, v1);
    this.v(d, cd, u0, v1);
  }
  /** Leuchtpunkt: kleiner Achtflächner. */
  punkt(x: number, y: number, z: number, r: number, col: RGB): void {
    const T: V3 = [x, y + r, z];
    const D: V3 = [x, y - r, z];
    const ring: V3[] = [
      [x + r, y, z],
      [x, y, z - r],
      [x - r, y, z],
      [x, y, z + r],
    ];
    for (let k = 0; k < 4; k++) {
      this.tri(ring[k], ring[(k + 1) % 4], T, col);
      this.tri(ring[(k + 1) % 4], ring[k], D, col);
    }
  }
  /** Quader (alle Seiten), um die Hochachse gedreht. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: RGB, rot = 0): void {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const p = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const v = [p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(-hx, hy, -hz), p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz)];
    this.quad(v[4], v[5], v[6], v[7], col);
    this.quad(v[1], v[0], v[3], v[2], col);
    this.quad(v[5], v[1], v[2], v[6], col);
    this.quad(v[0], v[4], v[7], v[3], col);
    this.quad(v[7], v[6], v[2], v[3], col);
    this.quad(v[0], v[1], v[5], v[4], col);
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

/** Zeigt die Fläche a, b, c von ref weg? */
function weg(a: V3, b: V3, c: V3, ref: V3): boolean {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return nx * ((a[0] + b[0] + c[0]) / 3 - ref[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - ref[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - ref[2]) >= 0;
}

/** Dreieck, so gedreht, dass es von ref weg zeigt. */
function to(mb: MeshBuilder | Netz, a: V3, b: V3, c: V3, col: RGB, ref: V3): void {
  if (weg(a, b, c, ref)) mb.tri(a, b, c, col);
  else mb.tri(a, c, b, col);
}

/** Viereck in einen MeshBuilder, so gedreht, dass es von ref weg zeigt. */
function qo(mb: MeshBuilder | Netz, a: V3, b: V3, c: V3, d: V3, col: RGB, ref: V3): void {
  if (weg(a, b, c, ref)) mb.quad(a, b, c, d, col);
  else mb.quad(d, c, b, a, col);
}

/** Bewegte Teile: ein Netz, dessen Ecken aus Grundform und Lage neu entstehen, sobald sich die Lage ändert. */
class Beweglich {
  private readonly teile: THREE.BufferGeometry[] = [];
  private start: Int32Array = new Int32Array(0);
  private count: Int32Array = new Int32Array(0);
  private bp = new Float32Array(0);
  private bn = new Float32Array(0);
  private mats = new Float32Array(0);
  private dirty = new Uint8Array(0);
  readonly geometry = new THREE.BufferGeometry();
  constructor(private readonly normals: boolean) {}
  get parts(): number {
    return this.teile.length;
  }
  add(g: THREE.BufferGeometry): number {
    this.teile.push(g);
    return this.teile.length - 1;
  }
  build(): THREE.BufferGeometry {
    const np = this.teile.length;
    this.start = new Int32Array(np);
    this.count = new Int32Array(np);
    let n = 0;
    for (let k = 0; k < np; k++) {
      this.start[k] = n;
      this.count[k] = this.teile[k].getAttribute('position').count;
      n += this.count[k];
    }
    this.bp = new Float32Array(n * 3);
    this.bn = new Float32Array(this.normals ? n * 3 : 0);
    const col = new Float32Array(n * 3);
    for (let k = 0; k < np; k++) {
      const g = this.teile[k];
      const o = this.start[k] * 3;
      this.bp.set(g.getAttribute('position').array as Float32Array, o);
      if (this.normals) this.bn.set(g.getAttribute('normal').array as Float32Array, o);
      col.set(g.getAttribute('color').array as Float32Array, o);
      g.dispose();
    }
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', pos);
    if (this.normals) {
      const nor = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
      nor.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('normal', nor);
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mats = new Float32Array(np * 16);
    this.dirty = new Uint8Array(np).fill(1);
    const id = new THREE.Matrix4().elements;
    for (let k = 0; k < np; k++) this.mats.set(id, k * 16);
    return this.geometry;
  }
  set(part: number, m: THREE.Matrix4): void {
    this.mats.set(m.elements, part * 16);
    this.dirty[part] = 1;
  }
  update(): void {
    const P = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const pa = P.array as Float32Array;
    const N = this.normals ? (this.geometry.getAttribute('normal') as THREE.BufferAttribute) : null;
    const na = N ? (N.array as Float32Array) : null;
    const e = this.mats;
    let any = false;
    for (let k = 0; k < this.start.length; k++) {
      if (!this.dirty[k]) continue;
      this.dirty[k] = 0;
      any = true;
      const m = k * 16;
      const end = (this.start[k] + this.count[k]) * 3;
      for (let i = this.start[k] * 3; i < end; i += 3) {
        const x = this.bp[i];
        const y = this.bp[i + 1];
        const z = this.bp[i + 2];
        pa[i] = e[m] * x + e[m + 4] * y + e[m + 8] * z + e[m + 12];
        pa[i + 1] = e[m + 1] * x + e[m + 5] * y + e[m + 9] * z + e[m + 13];
        pa[i + 2] = e[m + 2] * x + e[m + 6] * y + e[m + 10] * z + e[m + 14];
        if (na) {
          const a = this.bn[i];
          const b = this.bn[i + 1];
          const c = this.bn[i + 2];
          na[i] = e[m] * a + e[m + 4] * b + e[m + 8] * c;
          na[i + 1] = e[m + 1] * a + e[m + 5] * b + e[m + 9] * c;
          na[i + 2] = e[m + 2] * a + e[m + 6] * b + e[m + 10] * c;
        }
      }
    }
    if (any) {
      P.needsUpdate = true;
      if (N) N.needsUpdate = true;
    }
  }
}

/** Geschlossene Flugbahn mit Bogenlänge. */
class Runde {
  readonly len: number;
  private readonly cum: Float64Array;
  constructor(readonly pts: V3[]) {
    const n = pts.length;
    this.cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      this.cum[i + 1] = this.cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    this.len = this.cum[n];
  }
  at(s: number, out: Float64Array): void {
    const n = this.pts.length;
    let u = s % this.len;
    if (u < 0) u += this.len;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.cum[m] <= u) lo = m;
      else hi = m;
    }
    const a = this.pts[lo];
    const b = this.pts[(lo + 1) % n];
    const f = (u - this.cum[lo]) / (this.cum[lo + 1] - this.cum[lo] || 1);
    out[0] = a[0] + (b[0] - a[0]) * f;
    out[1] = a[1] + (b[1] - a[1]) * f;
    out[2] = a[2] + (b[2] - a[2]) * f;
    out[3] = b[0] - a[0];
    out[4] = b[2] - a[2];
  }
}

/** Ein Quader-Stück eines Hauses (achsparallel). */
interface Stufe {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y0: number;
  y1: number;
}

/** Belegte Fläche (gedrehtes Rechteck) mit Höhe. */
interface Sperre {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  c: number;
  s: number;
  y0: number;
  y1: number;
}

export function buildNeonLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const hi = world.detail > 0;
  const rnd = seeded(9100 + t.index * 53);
  const T = t.total;
  const N = t.n;
  const GY = th.farY;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const S = hi ? 16 : 8;
  const pick = <X>(a: readonly X[]): X => a[Math.floor(rnd() * a.length) % a.length];

  // --- Texturen und Netze -------------------------------------------------------------
  const atlas = zeichneAtlas(S);
  const bau = new MeshBuilder(); // Körper: Dächer, Sockel, Brücken, Masten, Bäume (Toon)
  const fas = new Netz(atlas.wu, atlas.wv); // Fassaden, Schilder, Leuchtbänder, Laternen, Wasser (Atlas, unbeleuchtet)
  const holo = new Netz(0, 0); // Laufschriften (halbdurchsichtig)
  const strom = new Netz(0, 0); // Lichtströme des Verkehrs
  const fern = new Netz(0, 0); // Skyline (ohne Nebel)
  const taxiB = new Beweglich(true);
  const taxiL = new Beweglich(false);
  const warn: V3[] = []; // rote Warnlichter (blinken gemeinsam)
  const blitz: V3[] = []; // weiße Blitzer auf den höchsten Spitzen

  // =====================================================================================
  // Strecke: Raum der Fahrbahnen
  // =====================================================================================
  const scale = t.def.scale ?? 1;
  const K = t.def.points.length;
  /** Abschnitt der Hauptstrecke an jedem Stützpunkt. */
  const knot = t.def.points.map((p) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(t.px[i] - p[0] * scale, t.pz[i] - p[1] * scale) + Math.abs(t.py[i] - (p[2] ?? 0)) * 0.3;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  });
  /** Abschnitt der Hauptstrecke bei u Stützpunkt-Einheiten. */
  const segU = (u: number): number => {
    const k = Math.max(0, Math.min(K - 1, Math.floor(u)));
    const a = knot[k];
    let b = k + 1 < K ? knot[k + 1] : N;
    if (b < a) b += N;
    return Math.round(a + (b - a) * (u - k)) % N;
  };
  const inU = (i: number, u0: number, u1: number): boolean => i < N && i >= segU(u0) && i <= segU(u1);

  // Je Abschnitt: wie weit (waagerecht) und von welcher bis zu welcher Höhe nichts stehen darf.
  const zRad = new Float32Array(T);
  const zLo = new Float32Array(T);
  const zUp = new Float32Array(T);
  const zDeck = new Uint8Array(T);
  let maxRad = 0;
  for (let k = 0; k < T; k++) {
    const e = t.edge[k];
    const wh = t.wh[k];
    const bank = t.bank[k];
    const bh = Math.abs(bank) * wh;
    // In einer geneigten Kurve kippt der Raum über der Fahrbahn mit.
    const lean = (LUFT * Math.abs(bank)) / Math.hypot(1, bank);
    let rad = wh + RAND + lean;
    let lo = e & EDGE_DECK ? -Infinity : t.py[k] - 2.5 - bh;
    let up = t.py[k] + LUFT + bh;
    if (e & EDGE_TUNNEL) {
      rad = wh + 2.8;
      lo = -Infinity;
      up = t.py[k] + HALLE;
    } else if (e & EDGE_GLIDE) {
      rad = wh + 10 + RAND;
      lo = t.py[k] - 22;
      up = t.py[k] + 20;
    } else if (e & EDGE_TWIST) {
      // An der Fassade dreht sich das Band nach rechts hoch: darüber bleibt alles frei.
      rad = wh + RAND;
      up = t.py[k] + t.twist[k] + wh + LUFT;
    }
    zRad[k] = rad;
    zLo[k] = lo;
    zUp[k] = up;
    zDeck[k] = e & EDGE_DECK && !(e & EDGE_GLIDE) ? 1 : 0;
    maxRad = Math.max(maxRad, rad);
  }
  const RZ = 16;
  const segRaster = new Map<number, number[]>();
  const rKey = (ix: number, iz: number): number => (ix + 1024) * 2048 + (iz + 1024);
  for (let k = 0; k < T; k++) {
    const key = rKey(Math.floor(t.px[k] / RZ), Math.floor(t.pz[k] / RZ));
    let a = segRaster.get(key);
    if (!a) segRaster.set(key, (a = []));
    a.push(k);
  }
  // Stützen unter den Stegen (wie world.ts: alle 14 Abschnitte links und rechts außerhalb der Bande)
  const stuetzen: number[] = [];
  for (let i = 0; i < T; i++) {
    const e = t.edge[i];
    if ((e & EDGE_DECK) === 0 || (e & (EDGE_RAMP | EDGE_TWIST | EDGE_GAP)) !== 0 || i % 14 !== 7) continue;
    const lat = t.wh[i] + 1.0;
    for (const sg of [-1, 1]) stuetzen.push(t.px[i] + rightX(t, i) * sg * lat, t.pz[i] + rightZ(t, i) * sg * lat, t.py[i]);
  }
  const sperren: Sperre[] = [];
  const sperre = (cx: number, cz: number, hw: number, hd: number, yaw: number, y0: number, y1: number): void => {
    sperren.push({ cx, cz, hw, hd, c: Math.cos(yaw), s: Math.sin(yaw), y0, y1 });
  };
  /** Überlappen sich zwei gedrehte Rechtecke (mit Rand m)? (Trennachsen) */
  const ueber = (a: Sperre, b: Sperre, m: number): boolean => {
    const ax: [number, number][] = [
      [a.c, -a.s],
      [a.s, a.c],
      [b.c, -b.s],
      [b.s, b.c],
    ];
    const dx = b.cx - a.cx;
    const dz = b.cz - a.cz;
    for (const [nx, nz] of ax) {
      const ra = a.hw * Math.abs(a.c * nx - a.s * nz) + a.hd * Math.abs(a.s * nx + a.c * nz);
      const rb = b.hw * Math.abs(b.c * nx - b.s * nz) + b.hd * Math.abs(b.s * nx + b.c * nz);
      if (Math.abs(dx * nx + dz * nz) > ra + rb + m) return false;
    }
    return true;
  };

  /** Ergebnis von pruefe(): größte Eindringtiefe, der Abschnitt dazu, und bis zu welcher Höhe es frei wäre. */
  const hit = { pen: 0, bahn: 0, k: -1, cap: Infinity, sperre: false, sp: -1 };
  const probe: Sperre = { cx: 0, cz: 0, hw: 0, hd: 0, c: 1, s: 0, y0: 0, y1: 0 };
  /**
   * Wie weit ragt ein Quader in den Raum der Strecke oder in belegte Flächen? Grundriss um (cx, cz) mit halben Seiten
   * hw (lokal x) und hd (lokal z), gedreht um yaw wie MeshBuilder.box; Höhe y0 … y1. 0 = frei.
   * unter: flaches Straßenzeug darf unter einem Steg liegen, wenn es UNTER Meter tiefer bleibt und keine Stütze trifft.
   */
  const pruefe = (cx: number, cz: number, hw: number, hd: number, yaw: number, y0: number, y1: number, unter = false, rand = 1.5): number => {
    hit.pen = 0;
    hit.bahn = 0;
    hit.k = -1;
    hit.cap = Infinity;
    hit.sperre = false;
    hit.sp = -1;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const reach = Math.hypot(hw, hd) + maxRad + 1;
    const ix0 = Math.floor((cx - reach) / RZ);
    const ix1 = Math.floor((cx + reach) / RZ);
    const iz0 = Math.floor((cz - reach) / RZ);
    const iz1 = Math.floor((cz + reach) / RZ);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const a = segRaster.get(rKey(ix, iz));
        if (!a) continue;
        for (const k of a) {
          const dx = t.px[k] - cx;
          const dz = t.pz[k] - cz;
          const lx = dx * c - dz * s;
          const lz = dx * s + dz * c;
          const d = Math.hypot(Math.max(0, Math.abs(lx) - hw), Math.max(0, Math.abs(lz) - hd));
          if (d >= zRad[k]) continue;
          if (y1 < zLo[k] || y0 > zUp[k]) continue;
          if (unter && zDeck[k] && y1 < t.py[k] - UNTER) continue;
          const pen = zRad[k] - d;
          if (pen > hit.pen) {
            hit.pen = pen;
            hit.k = k;
          }
          hit.cap = Math.min(hit.cap, zLo[k]);
        }
      }
    }
    if (unter) {
      for (let q = 0; q < stuetzen.length; q += 3) {
        const dx = stuetzen[q] - cx;
        const dz = stuetzen[q + 1] - cz;
        if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        const d = Math.hypot(Math.max(0, Math.abs(lx) - hw), Math.max(0, Math.abs(lz) - hd));
        if (d < 1.4 && y1 > GY - 1) {
          hit.pen = Math.max(hit.pen, 1.4 - d);
          hit.cap = -Infinity;
        }
      }
    }
    hit.bahn = hit.pen;
    probe.cx = cx;
    probe.cz = cz;
    probe.hw = hw;
    probe.hd = hd;
    probe.c = c;
    probe.s = s;
    for (let q = 0; q < sperren.length; q++) {
      const b = sperren[q];
      if (y1 < b.y0 || y0 > b.y1) continue;
      if (Math.abs(b.cx - cx) > hw + hd + b.hw + b.hd + rand || Math.abs(b.cz - cz) > hw + hd + b.hw + b.hd + rand) continue;
      if (ueber(probe, b, rand)) {
        hit.pen = Math.max(hit.pen, 0.5);
        hit.sperre = true;
        hit.sp = q;
        hit.cap = Math.min(hit.cap, b.y0);
      }
    }
    return hit.pen;
  };

  // Abstand zur Strecke auf einem groben Raster (für Stadtgrenze, Höhen, Nähe)
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < T; i++) {
    minX = Math.min(minX, t.px[i]);
    maxX = Math.max(maxX, t.px[i]);
    minZ = Math.min(minZ, t.pz[i]);
    maxZ = Math.max(maxZ, t.pz[i]);
  }
  const REICH = hi ? 240 : 165;
  const DG = 8;
  const dX0 = minX - REICH - 60;
  const dZ0 = minZ - REICH - 60;
  const DW = Math.ceil((maxX - minX + 2 * REICH + 120) / DG) + 1;
  const DH = Math.ceil((maxZ - minZ + 2 * REICH + 120) / DG) + 1;
  const dist = new Float32Array(DW * DH).fill(1e9);
  const near = new Int32Array(DW * DH).fill(-1);
  {
    // Abstandstransformation mit Weitergabe des nächsten Abschnitts (zwei Durchgänge hin und zurück, zweimal)
    const try1 = (c: number, ix: number, iz: number, k: number): void => {
      const d = Math.hypot(dX0 + ix * DG - t.px[k], dZ0 + iz * DG - t.pz[k]) - t.wh[k];
      if (d < dist[c]) {
        dist[c] = d;
        near[c] = k;
      }
    };
    for (let k = 0; k < T; k++) {
      const ix = Math.round((t.px[k] - dX0) / DG);
      const iz = Math.round((t.pz[k] - dZ0) / DG);
      if (ix >= 0 && iz >= 0 && ix < DW && iz < DH) try1(iz * DW + ix, ix, iz, k);
    }
    const FW = [-1, 0, -1, -1, 0, -1, 1, -1];
    const BW = [1, 0, 1, 1, 0, 1, -1, 1];
    for (let pass = 0; pass < 2; pass++) {
      for (let iz = 0; iz < DH; iz++) {
        for (let ix = 0; ix < DW; ix++) {
          const c = iz * DW + ix;
          for (let q = 0; q < 8; q += 2) {
            const jx = ix + FW[q];
            const jz = iz + FW[q + 1];
            if (jx < 0 || jz < 0 || jx >= DW) continue;
            const k = near[jz * DW + jx];
            if (k >= 0) try1(c, ix, iz, k);
          }
        }
      }
      for (let iz = DH - 1; iz >= 0; iz--) {
        for (let ix = DW - 1; ix >= 0; ix--) {
          const c = iz * DW + ix;
          for (let q = 0; q < 8; q += 2) {
            const jx = ix + BW[q];
            const jz = iz + BW[q + 1];
            if (jx < 0 || jx >= DW || jz >= DH) continue;
            const k = near[jz * DW + jx];
            if (k >= 0) try1(c, ix, iz, k);
          }
        }
      }
    }
    for (let c = 0; c < near.length; c++) if (near[c] < 0) near[c] = 0;
  }
  /** Wie weit ist (x, z) vom Raum der nächsten Fahrbahn weg (waagerecht, über alle Höhen)? */
  const freiRadius = (x: number, z: number, reach = 80): number => {
    let m = Infinity;
    const n = Math.ceil(reach / RZ);
    const ix = Math.floor(x / RZ);
    const iz = Math.floor(z / RZ);
    for (let a = ix - n; a <= ix + n; a++) {
      for (let b = iz - n; b <= iz + n; b++) {
        const l = segRaster.get(rKey(a, b));
        if (!l) continue;
        for (const k of l) m = Math.min(m, Math.hypot(x - t.px[k], z - t.pz[k]) - zRad[k]);
      }
    }
    return m;
  };
  const zelle = (x: number, z: number): number => {
    const ix = Math.max(0, Math.min(DW - 1, Math.round((x - dX0) / DG)));
    const iz = Math.max(0, Math.min(DH - 1, Math.round((z - dZ0) / DG)));
    return iz * DW + ix;
  };
  const abst = (x: number, z: number): number => dist[zelle(x, z)];
  const naechster = (x: number, z: number): number => near[zelle(x, z)];

  // Höhenraster der Bauten (für die Flugbahnen der Taxis): höchster Punkt je 4-m-Zelle
  const HG = 4;
  const hW = Math.ceil((DW * DG) / HG);
  const hH = Math.ceil((DH * DG) / HG);
  const hoch = new Float32Array(hW * hH).fill(-Infinity);
  const markiere = (x0: number, z0: number, x1: number, z1: number, y: number): void => {
    const a0 = Math.max(0, Math.floor((x0 - dX0) / HG));
    const a1 = Math.min(hW - 1, Math.floor((x1 - dX0) / HG));
    const b0 = Math.max(0, Math.floor((z0 - dZ0) / HG));
    const b1 = Math.min(hH - 1, Math.floor((z1 - dZ0) / HG));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) hoch[b * hW + a] = Math.max(hoch[b * hW + a], y);
  };
  const hoechstes = (x: number, z: number, r: number): number => {
    let m = -Infinity;
    const a0 = Math.max(0, Math.floor((x - r - dX0) / HG));
    const a1 = Math.min(hW - 1, Math.floor((x + r - dX0) / HG));
    const b0 = Math.max(0, Math.floor((z - r - dZ0) / HG));
    const b1 = Math.min(hH - 1, Math.floor((z + r - dZ0) / HG));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) m = Math.max(m, hoch[b * hW + a]);
    return m;
  };
  const sperreBox = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number): void => {
    sperre((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, y0, y1);
    markiere(x0, z0, x1, z1, y1);
  };

  // Mondlicht (waagerecht) für die Schattierung der unbeleuchteten Fassaden
  const mlx = th.sunDir[0] / Math.hypot(th.sunDir[0], th.sunDir[2]);
  const mlz = th.sunDir[2] / Math.hypot(th.sunDir[0], th.sunDir[2]);

  // =====================================================================================
  // Bausteine der Häuser
  // =====================================================================================
  /** Fensterraster je Haus: Stil (0 Raster, 1 Band, 2 Wohnen), Abstand der Fenster, Etagenhöhe, Versatz, Tönung. */
  interface Raster {
    stil: number;
    px: number;
    py: number;
    v0: number;
    tint: RGB;
  }
  const raster = (stil: number): Raster => {
    const tintBase: RGB = stil === 1 ? [0.9, 0.96, 1.06] : stil === 2 ? [1.05, 0.97, 0.98] : [1, 1, 1];
    return {
      stil,
      px: stil === 1 ? 2.2 + rnd() * 1.0 : stil === 2 ? 2.2 + rnd() * 0.8 : 2.0 + rnd() * 1.2,
      py: 3.3 + rnd() * 0.6,
      v0: Math.floor(rnd() * 64) / 64,
      tint: shade(tintBase, 0.78 + rnd() * 0.3),
    };
  };
  /**
   * Eine Fassade: Wandstück von (ax, az) nach (bx, bz), Höhe y0 … y1, nach außen von (rx, rz) weg. Ganze Fensterspalten
   * (jede Fläche beginnt an einer Zellgrenze), Etagen vom Boden an gezählt.
   */
  const fassade = (ax: number, az: number, bx: number, bz: number, y0: number, y1: number, R: Raster, rx: number, rz: number, dunkel = 1): void => {
    let L = Math.hypot(bx - ax, bz - az);
    if (L < 0.3 || y1 - y0 < 0.3) return;
    // Normale des Vierecks A, B, B oben: (−Δz, Δx)
    let nx = -(bz - az) / L;
    let nz = (bx - ax) / L;
    if (nx * ((ax + bx) / 2 - rx) + nz * ((az + bz) / 2 - rz) < 0) {
      // Normale zeigt zur Mitte: andersherum laufen
      [ax, bx] = [bx, ax];
      [az, bz] = [bz, az];
      nx = -nx;
      nz = -nz;
    }
    L = Math.hypot(bx - ax, bz - az);
    const lit = 0.72 + 0.28 * Math.max(0, nx * mlx + nz * mlz);
    const cb = shade(R.tint, lit * dunkel);
    const ct = shade(R.tint, lit * dunkel * 0.88);
    const vb = R.v0 + (y0 - GY) / R.py / 64;
    const vt = R.v0 + (y1 - GY) / R.py / 64;
    const cols = Math.max(1, Math.round(L / R.px));
    const pieces = Math.ceil(cols / 30);
    for (let p = 0; p < pieces; p++) {
      const c0 = Math.round((cols * p) / pieces);
      const c1 = Math.round((cols * (p + 1)) / pieces);
      const n = c1 - c0;
      const f0 = c0 / cols;
      const f1 = c1 / cols;
      const start = R.stil * 32 + Math.floor(rnd() * (32 - n + 1));
      const A: V3 = [ax + (bx - ax) * f0, y0, az + (bz - az) * f0];
      const B: V3 = [ax + (bx - ax) * f1, y0, az + (bz - az) * f1];
      fas.quadUv(A, B, [B[0], y1, B[2]], [A[0], y1, A[2]], cb, cb, ct, ct, start / 128, vb, (start + n) / 128, vt);
    }
  };
  /** Vier Fassaden eines achsparallelen Quaders. */
  const fassaden = (s: Stufe, R: Raster, dunkel = 1): void => {
    const cx = (s.x0 + s.x1) / 2;
    const cz = (s.z0 + s.z1) / 2;
    fassade(s.x0, s.z1, s.x1, s.z1, s.y0, s.y1, R, cx, cz, dunkel);
    fassade(s.x1, s.z1, s.x1, s.z0, s.y0, s.y1, R, cx, cz, dunkel);
    fassade(s.x1, s.z0, s.x0, s.z0, s.y0, s.y1, R, cx, cz, dunkel);
    fassade(s.x0, s.z0, s.x0, s.z1, s.y0, s.y1, R, cx, cz, dunkel);
  };
  /**
   * Schild aus dem Atlas: Mitte (cx, cz), schaut in Richtung (nx, nz), Breite w, Unterkante y, off Meter vor der Wand.
   * Gelesen wird von links nach rechts, wie man davor steht.
   */
  const schild = (cx: number, cz: number, nx: number, nz: number, w: number, fe: Feld, y: number, off = 0.3, col: RGB = WEISS): number => {
    const h = w / fe.aspect;
    const rx = nz;
    const rz = -nx;
    const ax = cx - rx * (w / 2) + nx * off;
    const az = cz - rz * (w / 2) + nz * off;
    const bx = cx + rx * (w / 2) + nx * off;
    const bz = cz + rz * (w / 2) + nz * off;
    fas.quadUv([ax, y, az], [bx, y, bz], [bx, y + h, bz], [ax, y + h, az], col, col, col, col, fe.u0, fe.v0, fe.u1, fe.v1);
    return h;
  };
  /** Flachdach mit Attika (außen und innen), leicht über der Oberkante. */
  const dach = (s: Stufe, attika = true, col: RGB = C_DACH, innen = true): void => {
    const y = s.y1;
    const { x0, z0, x1, z1 } = s;
    const ref: V3 = [(x0 + x1) / 2, y - 5, (z0 + z1) / 2];
    qo(bau, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col, ref);
    if (!attika) return;
    const h = 0.9;
    const w = 0.4;
    const o: V3[] = [
      [x0, 0, z1],
      [x1, 0, z1],
      [x1, 0, z0],
      [x0, 0, z0],
    ];
    const i: V3[] = [
      [x0 + w, 0, z1 - w],
      [x1 - w, 0, z1 - w],
      [x1 - w, 0, z0 + w],
      [x0 + w, 0, z0 + w],
    ];
    const mid: V3 = [(x0 + x1) / 2, y + h * 0.5, (z0 + z1) / 2];
    const far: V3 = [(x0 + x1) / 2, y + h * 0.5, (z0 + z1) / 2];
    for (let k = 0; k < 4; k++) {
      const a = o[k];
      const b = o[(k + 1) % 4];
      const c = i[k];
      const d = i[(k + 1) % 4];
      // außen (von der Mitte weg), oben, innen (zur Mitte hin)
      qo(bau, [a[0], y - 0.4, a[2]], [b[0], y - 0.4, b[2]], [b[0], y + h, b[2]], [a[0], y + h, a[2]], C_ATTIKA, mid);
      qo(bau, [a[0], y + h, a[2]], [b[0], y + h, b[2]], [d[0], y + h, d[2]], [c[0], y + h, c[2]], C_DACH_H, [mid[0], y - 3, mid[2]]);
      if (!innen) continue;
      const inner: V3 = [(a[0] + b[0]) / 2 + ((a[0] + b[0]) / 2 - far[0]) * 3, y, (a[2] + b[2]) / 2 + ((a[2] + b[2]) / 2 - far[2]) * 3];
      qo(bau, [c[0], y, c[2]], [d[0], y, d[2]], [d[0], y + h, d[2]], [c[0], y + h, c[2]], C_ATTIKA, inner);
    }
  };
  /** Leuchtkante oben um eine Stufe (knapp unter der Attika, außen). */
  const kante = (s: Stufe, col: RGB, y: number, h = 0.35): void => {
    const o = 0.06;
    const P: [number, number][] = [
      [s.x0 - o, s.z1 + o],
      [s.x1 + o, s.z1 + o],
      [s.x1 + o, s.z0 - o],
      [s.x0 - o, s.z0 - o],
    ];
    const ref: V3 = [(s.x0 + s.x1) / 2, y, (s.z0 + s.z1) / 2];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = P[k];
      const [bx, bz] = P[(k + 1) % 4];
      qo(fas, [ax, y, az], [bx, y, bz], [bx, y + h, bz], [ax, y + h, az], col, ref);
    }
  };
  /** Senkrechte Leuchtstreifen an den Ecken. */
  const ecken = (s: Stufe, col: RGB, ya: number, yb: number, w = 0.32): void => {
    const o = 0.07;
    const C: [number, number, number, number][] = [
      [s.x0 - o, s.z1 + o, 1, -1],
      [s.x1 + o, s.z1 + o, -1, -1],
      [s.x1 + o, s.z0 - o, -1, 1],
      [s.x0 - o, s.z0 - o, 1, 1],
    ];
    const ref: V3 = [(s.x0 + s.x1) / 2, (ya + yb) / 2, (s.z0 + s.z1) / 2];
    for (const [x, z, sx, sz] of C) {
      qo(fas, [x, ya, z], [x + sx * w, ya, z], [x + sx * w, yb, z], [x, yb, z], col, ref);
      qo(fas, [x, ya, z], [x, ya, z + sz * w], [x, yb, z + sz * w], [x, yb, z], col, ref);
    }
  };
  /** Baum: Stamm und Krone aus einem Ikosaeder. */
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const e4 = new THREE.Euler();
  const v4 = new THREE.Vector3();
  const s4 = new THREE.Vector3();
  const baum = (x: number, y: number, z: number, k: number): void => {
    const w = 0.16 * k;
    const h = y + 1.8 * k;
    qo(bau, [x - w, y, z - w], [x + w, y, z - w], [x + w, h, z - w], [x - w, h, z - w], C_STAMM, [x, h / 2, z + 1]);
    qo(bau, [x - w, y, z + w], [x + w, y, z + w], [x + w, h, z + w], [x - w, h, z + w], C_STAMM, [x, h / 2, z - 1]);
    e4.set(rnd(), rnd() * 3, 0);
    q4.setFromEuler(e4);
    bau.add(ico, pick(C_LAUB), m4.compose(v4.set(x, y + 2.5 * k, z), q4, s4.set(1.5 * k, 1.35 * k, 1.5 * k)));
  };
  /** Dachgarten auf einer Fläche: Rasen, Bäume, leuchtende Pflanzkästen, warme Lampen. */
  const garten = (x0: number, z0: number, x1: number, z1: number, y: number): void => {
    const w = x1 - x0;
    const d = z1 - z0;
    if (w < 6 || d < 6) return;
    qo(bau, [x0, y + 0.08, z0], [x1, y + 0.08, z0], [x1, y + 0.08, z1], [x0, y + 0.08, z1], rnd() < 0.5 ? C_RASEN : C_RASEN_D, [x0, y - 5, z0]);
    // Weg quer durch den Garten
    const pz = z0 + d * (0.3 + rnd() * 0.4);
    qo(bau, [x0, y + 0.12, pz - 0.7], [x1, y + 0.12, pz - 0.7], [x1, y + 0.12, pz + 0.7], [x0, y + 0.12, pz + 0.7], C_GEHWEG, [x0, y - 5, pz]);
    const n = Math.min(hi ? 4 : 2, Math.floor((w * d) / 45));
    for (let k = 0; k < n; k++) baum(x0 + 1.5 + rnd() * (w - 3), y, z0 + 1.5 + rnd() * (d - 3), 0.7 + rnd() * 0.6);
    // Pflanzkästen am Rand: schmale Leuchtkante in Minze
    const ref: V3 = [(x0 + x1) / 2, y, (z0 + z1) / 2];
    const e = 0.25;
    const h = y + 0.5;
    qo(fas, [x0 + e, h, z1 - e], [x1 - e, h, z1 - e], [x1 - e, h + 0.18, z1 - e], [x0 + e, h + 0.18, z1 - e], shade(MINZE, 0.8), ref);
    qo(fas, [x1 - e, h, z0 + e], [x0 + e, h, z0 + e], [x0 + e, h + 0.18, z0 + e], [x1 - e, h + 0.18, z0 + e], shade(MINZE, 0.8), ref);
    if (hi) for (let k = 0; k < 2; k++) fas.punkt(x0 + 1 + rnd() * (w - 2), y + 1.1, z0 + 1 + rnd() * (d - 2), 0.22, WARM);
  };
  /** Dachpool: türkis leuchtendes Becken mit hellem Rand, daneben Liegen. */
  const becken = (s: Stufe): void => {
    const w = Math.min(s.x1 - s.x0 - 5, 6 + rnd() * 8);
    const d = Math.min(s.z1 - s.z0 - 5, 4 + rnd() * 4);
    const cx = s.x0 + 2.5 + w / 2 + rnd() * (s.x1 - s.x0 - 5 - w);
    const cz = s.z0 + 2.5 + d / 2 + rnd() * (s.z1 - s.z0 - 5 - d);
    const y = s.y1 + 0.12;
    bau.box(cx, y, cz, w + 1.2, 0.24, d + 1.2, rgb(0x5a6090));
    qo(fas, [cx - w / 2, y + 0.2, cz - d / 2], [cx + w / 2, y + 0.2, cz - d / 2], [cx + w / 2, y + 0.2, cz + d / 2], [cx - w / 2, y + 0.2, cz + d / 2], shade(CYAN, 0.46), [cx, y - 5, cz]);
    for (let k = 0; k < 3; k++) bau.box(cx - w / 2 + 1 + k * 1.6, y + 0.3, cz + d / 2 + 1.6, 0.8, 0.3, 1.9, WARM);
  };
  /** Landeplatz für Lufttaxis: dunkle Scheibe, gelber Ring aus Leuchten, ein H. */
  const landeplatz = (s: Stufe): void => {
    const cx = (s.x0 + s.x1) / 2;
    const cz = (s.z0 + s.z1) / 2;
    const r = Math.min(s.x1 - s.x0, s.z1 - s.z0) / 2 - 2;
    const y = s.y1 + 0.5;
    bau.box(cx, s.y1 + 0.25, cz, r * 1.8, 0.5, r * 1.8, C_BETON_D);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      fas.box(cx + Math.cos(a) * r * 0.8, y + 0.08, cz + Math.sin(a) * r * 0.8, 0.5, 0.16, 0.5, GELB);
    }
    const ze = atlas.zeichen[2];
    const h = r * 0.9;
    fas.quadUv([cx - h / 2, y + 0.08, cz + h / 2], [cx + h / 2, y + 0.08, cz + h / 2], [cx + h / 2, y + 0.08, cz - h / 2], [cx - h / 2, y + 0.08, cz - h / 2], WEISS, WEISS, WEISS, WEISS, ze.u0, ze.v0, ze.u1, ze.v1);
  };
  /** Solardach: Reihen dunkelblauer Platten. */
  const solar = (s: Stufe): void => {
    const rows = Math.floor((s.z1 - s.z0 - 3) / 2.6);
    for (let k = 0; k < rows; k++) {
      const z = s.z0 + 2 + k * 2.6;
      bau.box((s.x0 + s.x1) / 2, s.y1 + 0.6, z + 0.8, s.x1 - s.x0 - 3, 0.1, 1.8, rgb(0x2b3f8a));
    }
  };
  /** Mast mit Querstreben und Warnlicht oben. */
  const mast = (x: number, y: number, z: number, h: number, strobe = false): void => {
    if (pruefe(x, z, 1.2, 1.2, 0, y, y + h + 1) > 0 && hit.bahn > 0) return;
    bau.box(x, y + h / 2, z, 0.45, h, 0.45, C_STAHL);
    for (let k = 1; k <= Math.floor(h / 6); k++) bau.box(x, y + k * 6 - 1, z, 2.2 - k * 0.2, 0.18, 0.18, C_STAHL);
    (strobe ? blitz : warn).push([x, y + h + 0.3, z]);
  };
  /** Lüftungs- und Technikaufbauten auf einem Dach. */
  const technik = (s: Stufe, n: number): void => {
    const w = s.x1 - s.x0;
    const d = s.z1 - s.z0;
    for (let k = 0; k < n; k++) {
      const bw = 2.5 + rnd() * Math.min(7, w * 0.3);
      const bd = 2.5 + rnd() * Math.min(7, d * 0.3);
      if (bw > w - 2 || bd > d - 2) continue;
      const x = s.x0 + 1 + bw / 2 + rnd() * (w - bw - 2);
      const z = s.z0 + 1 + bd / 2 + rnd() * (d - bd - 2);
      const bh = 1.6 + rnd() * 2.4;
      bau.box(x, s.y1 + bh / 2, z, bw, bh, bd, C_BETON, 0, C_DACH_H);
    }
  };

  // Liste der Häuser (für Schilder, Skywalks, Laufschriften)
  interface Haus {
    stufen: Stufe[];
    R: Raster;
    top: number;
    d: number;
    k: number;
    farbe: RGB;
    rund: boolean;
  }
  const haeuser: Haus[] = [];

  /** Zeichnet ein Haus aus Stufen (achsparallel): Fassaden, Dächer, Gärten, Kronen, Masten. */
  const zeichneHaus = (h: Haus): void => {
    const nah = h.d < (hi ? 140 : 100);
    const fern2 = h.d > (hi ? 190 : 140);
    h.stufen.forEach((s, k) => {
      fassaden(s, h.R, fern2 ? 0.85 : 1);
      const last = k === h.stufen.length - 1;
      dach(s, nah, last ? C_DACH : C_DACH_H, h.d < (hi ? 70 : 40));
      markiere(s.x0, s.z0, s.x1, s.z1, s.y1 + 1);
      if (!nah) return;
      // Rücksprung: Terrasse mit Garten, wenn die nächste Stufe Platz lässt
      if (!last) {
        const n = h.stufen[k + 1];
        const strips: [number, number, number, number][] = [
          [s.x0, s.z0, n.x0, s.z1],
          [n.x1, s.z0, s.x1, s.z1],
          [n.x0, s.z0, n.x1, n.z0],
          [n.x0, n.z1, n.x1, s.z1],
        ];
        for (const [a0, b0, a1, b1] of strips) if (a1 - a0 > 6 && b1 - b0 > 6 && rnd() < 0.7) garten(a0 + 0.6, b0 + 0.6, a1 - 0.6, b1 - 0.6, s.y1);
      } else {
        const w = s.x1 - s.x0;
        const d = s.z1 - s.z0;
        const r = rnd();
        if (h.top < 40 && w > 12 && d > 12 && r < 0.45) garten(s.x0 + 1.2, s.z0 + 1.2, s.x1 - 1.2, s.z1 - 1.2, s.y1);
        else if (w > 14 && d > 14 && r < 0.62) becken(s);
        else if (w > 18 && d > 18 && h.top > GY + 50 && r < 0.78) landeplatz(s);
        else if (w > 12 && d > 12 && r < 0.88) solar(s);
        else technik(s, 1 + Math.floor(rnd() * 3));
      }
    });
    const top = h.stufen[h.stufen.length - 1];
    // Läden im Erdgeschoss: farbige Schaufenster, darüber ab und zu ein kleines Schild
    if (hi && h.d < 75) {
      const b0 = h.stufen[0];
      const faces: [number, number, number, number][] = [
        [b0.x0, b0.z1, b0.x1, b0.z1],
        [b0.x1, b0.z1, b0.x1, b0.z0],
        [b0.x1, b0.z0, b0.x0, b0.z0],
        [b0.x0, b0.z0, b0.x0, b0.z1],
      ];
      for (const [ax, az, bx, bz] of faces) {
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 8) continue;
        const nx = -(bz - az) / L;
        const nz = (bx - ax) / L;
        const n = Math.max(1, Math.floor(L / 9));
        for (let q = 0; q < n; q++) {
          if (rnd() < 0.3) continue;
          const f0 = (q + 0.12) / n;
          const f1 = (q + 0.88) / n;
          const col = shade(pick([WARM, WARM, AMBER, CYAN, PINK, WEISS]), 0.45 + rnd() * 0.3);
          const A: V3 = [ax + (bx - ax) * f0 + nx * 0.06, GY + 0.4, az + (bz - az) * f0 + nz * 0.06];
          const B: V3 = [ax + (bx - ax) * f1 + nx * 0.06, GY + 0.4, az + (bz - az) * f1 + nz * 0.06];
          fas.quad(A, B, [B[0], GY + 3.6, B[2]], [A[0], GY + 3.6, A[2]], col);
        }
        if (rnd() < 0.35) schild((ax + bx) / 2, (az + bz) / 2, nx, nz, Math.min(L * 0.5, 7), atlas.schild[Math.floor(rnd() * 8)], GY + 4.1, 0.2);
      }
    }
    // Leuchtbänder um die Geschosse: an Häusern dicht an der Bahn, in Schluchten
    if (h.d < 30 && art[h.k] === SCHLUCHT && rnd() < 0.45) {
      const s = h.stufen[h.stufen.length > 1 ? 1 : 0];
      const every = (4 + Math.floor(rnd() * 5)) * h.R.py;
      const col = shade(h.farbe, 0.85);
      let n = 0;
      for (let y = s.y0 + every; y < s.y1 - 3 && n < 4; y += every, n++) kante(s, col, y - 0.25, 0.22);
    }
    // Leuchtkanten und Kronen
    if (!fern2) {
      const r = rnd();
      if (r < 0.4) kante(top, h.farbe, top.y1 - 1.6);
      else if (r < 0.6) ecken(top, h.farbe, Math.max(top.y0, top.y1 - 40), top.y1 - 0.5);
      if (h.top > 70 && rnd() < 0.5) {
        // Laterne: drei feine Lichtlinien um die oberste Etage
        for (let q = 0; q < 3; q++) kante(top, shade(h.farbe, 0.8 - q * 0.12), top.y1 - 4.6 + q * 0.9, 0.24);
      }
    }
    if (h.top > (hi ? 85 : 100) && rnd() < 0.75) {
      const cx = (top.x0 + top.x1) / 2 + (rnd() - 0.5) * (top.x1 - top.x0) * 0.3;
      const cz = (top.z0 + top.z1) / 2 + (rnd() - 0.5) * (top.z1 - top.z0) * 0.3;
      mast(cx, top.y1, cz, 8 + rnd() * 16, h.top > 170);
      markiere(cx - 1, cz - 1, cx + 1, cz + 1, top.y1 + 26);
    } else if (h.top > 55 && !fern2 && rnd() < 0.3) {
      warn.push([top.x0 + 0.6, top.y1 + 1.3, top.z0 + 0.6], [top.x1 - 0.6, top.y1 + 1.3, top.z1 - 0.6]);
    }
  };

  // =====================================================================================
  // Sonderbauten an der Strecke
  // =====================================================================================

  // --- Fassadenturm des Schwebebands (mechanics/band.ts): Arkaden am Fuß, Aufbauten und Name auf dem Dach --------
  {
    const tw: number[] = [];
    for (let i = 0; i < N; i++) if (t.edge[i] & EDGE_TWIST) tw.push(i);
    if (tw.length > 0) {
      // Maße wie in band.ts
      const R = Math.max(...tw.map((i) => t.twist[i]));
      const wMax = Math.max(...tw.map((i) => t.wh[i]));
      const wall = Math.hypot(wMax, R + 1.1) + 0.4;
      const first = tw[0];
      const last = tw[tw.length - 1];
      const from = (first - 24 + N) % N;
      const count = ((last - first + N) % N) + 48;
      const DEPTH = 26;
      let top = -Infinity;
      for (let k = 0; k <= count; k++) top = Math.max(top, t.py[(from + k) % N] + R + 42);
      const F = (i: number, out: number, y: number): V3 => [t.px[i] + rightX(t, i) * out, y, t.pz[i] + rightZ(t, i) * out];
      // Belegt: der Turm selbst
      for (let k = 0; k < count; k += 6) {
        const i = (from + k) % N;
        const c = F(i, wall + DEPTH / 2, 0);
        sperre(c[0], c[2], DEPTH / 2 + 0.5, 4, Math.atan2(t.tx[i], t.tz[i]), GY, top + 2);
        markiere(c[0] - 15, c[2] - 15, c[0] + 15, c[2] + 15, top + 2);
      }
      // Arkaden am Fuß der Wand (nur wo das Band schon weit gedreht ist – darunter steht dann keine Stütze)
      const A0 = wall - 3.2;
      const AH = 8.5;
      for (let k = 0; k < count - 3; k += 3) {
        const i = (from + k) % N;
        const j = (from + k + 3) % N;
        if (t.roll[i] < 0.5 || t.roll[j] < 0.5) continue;
        const a = F(i, A0, GY + AH);
        const b = F(j, A0, GY + AH);
        const c = F(j, wall, GY + AH);
        const d = F(i, wall, GY + AH);
        qo(bau, a, b, c, d, C_BETON, [a[0], GY, a[2]]);
        qo(bau, [a[0], GY + AH - 1.2, a[2]], [b[0], GY + AH - 1.2, b[2]], b, a, C_BETON_D, F(i, wall, GY + AH - 0.6));
        if (k % 6 === 0) bau.box(a[0], GY + AH / 2, a[2], 0.7, AH, 0.7, C_BETON, Math.atan2(t.tx[i], t.tz[i]));
        // Schaufenster an der Wand, im Wechsel warm und bunt
        const w0 = F(i, wall - 0.08, GY + 0.4);
        const w1 = F(j, wall - 0.08, GY + 0.4);
        const col = k % 9 === 0 ? shade(PINK, 0.7) : k % 9 === 3 ? shade(CYAN, 0.65) : shade(WARM, 0.75);
        qo(fas, w0, w1, [w1[0], GY + 5.6, w1[2]], [w0[0], GY + 5.6, w0[2]], col, F(i, wall + 3, GY + 3));
        // Leuchtband an der Arkadenkante
        qo(fas, [a[0], GY + AH - 1.2, a[2]], [b[0], GY + AH - 1.2, b[2]], [b[0], GY + AH - 0.9, b[2]], [a[0], GY + AH - 0.9, a[2]], CYAN, F(i, wall, GY + AH));
      }
      // Dach: Technik, Masten mit Warnlichtern, Leuchtkante, der Name in großen Lettern zur Stadt hin
      const mid = (from + Math.round(count / 2)) % N;
      for (let k = 6; k < count - 6; k += 12) {
        const i = (from + k) % N;
        const p = F(i, wall + 6 + rnd() * 14, top);
        bau.box(p[0], top + 1.4, p[2], 4 + rnd() * 4, 2.8, 4 + rnd() * 3, C_BETON, Math.atan2(t.tx[i], t.tz[i]), C_DACH_H);
      }
      for (const f of [0.2, 0.8]) {
        const i = (from + Math.round(count * f)) % N;
        const p = F(i, wall + DEPTH - 5, top);
        mast(p[0], top, p[2], 22, f > 0.5);
      }
      for (let k = 0; k < count - 3; k += 3) {
        const i = (from + k) % N;
        const j = (from + k + 3) % N;
        const a = F(i, wall - 0.07, top - 1.2);
        const b = F(j, wall - 0.07, top - 1.2);
        qo(fas, a, b, [b[0], top - 0.8, b[2]], [a[0], top - 0.8, a[2]], PINK, F(i, wall + 3, top - 1));
      }
      {
        // Schriftzug auf einem Gerüst, an der Vorderkante, lesbar von der Stadt (der Bahn) her
        const fe = atlas.schild[S_BAND];
        const W = 46;
        const H = W / fe.aspect;
        const i = mid;
        const fx = t.tx[i];
        const fz = t.tz[i];
        const c = F(i, wall + 2.5, top + 2.2);
        // Die Schrift schaut nach links (zur Bahn und zur Stadt)
        schild(c[0], c[2], -rightX(t, i), -rightZ(t, i), W, fe, top + 2.2, 0);
        for (let k = -2; k <= 2; k++) {
          const p: V3 = [c[0] + fx * (W * 0.22) * k + rightX(t, i) * 0.6, 0, c[2] + fz * (W * 0.22) * k + rightZ(t, i) * 0.6];
          bau.box(p[0], top + 1.1 + H / 2, p[2], 0.5, H + 2.2, 0.5, C_STAHL);
        }
      }
    }
  }

  // --- Atriumturm (mechanics/atrium.ts): Sockel bis zum Boden, Krone und Name ---------------------------------
  {
    const bi = t.def.branches?.findIndex((b) => b.shortcut === 'risk') ?? -1;
    if (bi >= 0) {
      const b = t.branches[bi];
      const HALF = 13;
      const a0 = b.first + Math.round(b.count * 0.24);
      const a1 = b.first + Math.round(b.count * 0.78);
      const top = Math.max(t.py[a0], t.py[a1]) + 22;
      const floor = Math.min(t.py[a0], t.py[a1]) - 34;
      const W = (i: number, lat: number, y: number): V3 => [t.px[i] + rightX(t, i) * lat, y, t.pz[i] + rightZ(t, i) * lat];
      const clear = (p: V3): boolean => {
        for (let k = 0; k < N; k += 3) {
          if (Math.abs(t.py[k] - p[1]) > 40) continue;
          if (Math.hypot(t.px[k] - p[0], t.pz[k] - p[2]) < t.wh[k] + 3) return false;
        }
        return true;
      };
      const R = raster(0);
      R.tint = [0.95, 0.92, 1.05];
      for (let i = a0; i < a1; i += 4) {
        const c = W(i, 0, 0);
        sperre(c[0], c[2], HALF + 1.6, 2.6, Math.atan2(t.tx[i], t.tz[i]), GY, top + 1);
        markiere(c[0] - 16, c[2] - 16, c[0] + 16, c[2] + 16, top + 1);
      }
      const ref = (i: number): V3 => W(i, 0, (floor + GY) / 2);
      for (let i = a0; i < a1; i += 4) {
        const j = Math.min(a1, i + 4);
        for (const s of [-1, 1]) {
          const ok = clear(W(i, s * HALF, t.py[i])) && clear(W(j, s * HALF, t.py[j]));
          if (!ok) continue;
          // Sockel: die Außenwand weiter bis zum Boden (dort nur, wo auch unten Platz ist)
          const p = W((i + j) >> 1, s * (HALF + 0.5), 0);
          if (pruefe(p[0], p[2], 2.2, 0.8, Math.atan2(t.tx[i], t.tz[i]), GY, floor) > 0 && hit.bahn > 0) continue;
          const A = W(i, s * (HALF + 1), 0);
          const B = W(j, s * (HALF + 1), 0);
          fassade(A[0], A[2], B[0], B[2], GY, floor + 0.02, R, ref(i)[0], ref(i)[2]);
          // Krone: Leuchtband außen unter der Oberkante
          const a = W(i, s * (HALF + 1.06), top - 1.6);
          const bb = W(j, s * (HALF + 1.06), top - 1.6);
          qo(fas, a, bb, [bb[0], top - 1.0, bb[2]], [a[0], top - 1.0, a[2]], s < 0 ? CYAN : PINK, ref(i));
        }
      }
      // Stirnseiten des Sockels (unter den Stirnwänden des Atriums)
      for (const [i, dir] of [
        [a0, -1],
        [a1, 1],
      ] as [number, number][]) {
        const A = W(i, -HALF - 1, 0);
        const B = W(i, HALF + 1, 0);
        const p = W(i, 0, 0);
        if (pruefe(p[0], p[2], HALF, 0.8, Math.atan2(t.tx[i], t.tz[i]), GY, floor) > 0 && hit.bahn > 0) continue;
        const rr = W(i - dir * 6, 0, 0);
        fassade(A[0], A[2], B[0], B[2], GY, floor + 0.02, R, rr[0], rr[2]);
      }
      // Name an beiden Längsseiten, oben, und über den Öffnungen an den Stirnseiten (dort mehr als LUFT über dem Steg)
      const fe = atlas.schild[S_LICHTHOF];
      const mid = (a0 + a1) >> 1;
      for (const s of [-1, 1]) {
        if (!clear(W(mid, s * HALF, t.py[mid]))) continue;
        const w = 22;
        const c = W(mid, s * (HALF + 1), 0);
        schild(c[0], c[2], s * rightX(t, mid), s * rightZ(t, mid), w, fe, top - 3.2 - w / fe.aspect, 0.25);
      }
      for (const [i, dir] of [
        [a0, -1],
        [a1, 1],
      ] as [number, number][]) {
        const y = t.py[i] + LUFT + 1.4;
        if (!clear(W(i, 0, t.py[i])) || y + 3 > top - 2) continue;
        const nx = t.tx[i] * dir;
        const nz = t.tz[i] * dir;
        const c = W(i, 0, 0);
        const w = Math.min(2 * HALF - 2, 16);
        if (pruefe(c[0] + nx * 0.3, c[2] + nz * 0.3, w / 2, 0.3, Math.atan2(t.tx[i], t.tz[i]), y, y + w / fe.aspect) > 0 && hit.bahn > 0) continue;
        schild(c[0], c[2], nx, nz, w, fe, y, 0.3);
      }
    }
  }

  // --- U-Bahnhof: Empfangsgebäude über der Halle, Tunnelröhren für die Rampen der Züge --------------------------
  const metro = t.metro;
  if (metro) {
    const cars = t.vehicles.filter((v) => v.plan);
    const hw = cars.length > 0 ? cars[0].halfWidth : 2.2;
    const roofH = cars.length > 0 ? cars[0].roofs![0][0] : 2.1;
    const L = (s: number, lat: number, y: number): V3 => {
      const i = Math.max(0, Math.min(metro.n, Math.round(s)));
      return [metro.x[i] - metro.tz * lat, y, metro.z[i] + metro.tx * lat];
    };
    const yL = (s: number): number => {
      const i = Math.max(0, Math.min(metro.n - 1, Math.floor(s)));
      const f = Math.max(0, Math.min(1, s - i));
      return metro.y[i] + (metro.y[i + 1] - metro.y[i]) * f;
    };
    // Tunnelröhren: von der Rückwand der Schächte (metro.ts: 14 m hinter dem Graben) bis dorthin, wo die Linie im
    // Boden verschwindet. Innen schwarz, außen Beton mit einem Leuchtstreifen.
    const TW = hw + 1.1;
    for (const dir of [-1, 1]) {
      const s0 = dir < 0 ? metro.s0 - 14 : metro.s1 + 14;
      let s = s0;
      const STEP = 6;
      while (true) {
        // (bis zum Ende der Linie: dort verschwindet der Zug – sein Dach läge sonst knapp über dem Boden)
        const e = Math.max(0, Math.min(metro.n, s + dir * STEP));
        if (Math.abs(e - s) < 0.5) break;
        const ya = yL(s);
        const yb = yL(e);
        if (ya + roofH + 0.8 < GY && yb + roofH + 0.8 < GY) break;
        // Decke über der Röhre: knapp unter einem Steg darüber
        const ra = ya + roofH + 0.45;
        const rb = yb + roofH + 0.45;
        const fa = Math.max(GY - 0.5, ya - 0.5);
        const fb = Math.max(GY - 0.5, yb - 0.5);
        const ref: V3 = [(L(s, 0, 0)[0] + L(e, 0, 0)[0]) / 2, (ya + yb) / 2 + 1, (L(s, 0, 0)[2] + L(e, 0, 0)[2]) / 2];
        for (const sg of [-1, 1]) {
          const a = L(s, sg * TW, fa);
          const b = L(e, sg * TW, fb);
          qo(bau, a, b, [b[0], rb, b[2]], [a[0], ra, a[2]], C_BETON, ref);
          // Leuchtstreifen außen
          const la = L(s, sg * (TW + 0.04), ra - 1.1);
          const lb = L(e, sg * (TW + 0.04), rb - 1.1);
          qo(fas, la, lb, [lb[0], rb - 0.8, lb[2]], [la[0], ra - 0.8, la[2]], shade(CYAN, 0.8), ref);
        }
        const ta = L(s, -TW, ra);
        const tb = L(s, TW, ra);
        const tc = L(e, TW, rb);
        const td = L(e, -TW, rb);
        qo(bau, ta, tb, tc, td, C_BETON_D, [ref[0], ra - 5, ref[2]]);
        markiere(Math.min(ta[0], tc[0]) - 1, Math.min(ta[2], tc[2]) - 1, Math.max(ta[0], tc[0]) + 1, Math.max(ta[2], tc[2]) + 1, Math.max(ra, rb));
        sperre((ta[0] + tc[0]) / 2, (ta[2] + tc[2]) / 2, TW + 0.3, STEP / 2 + 0.3, Math.atan2(metro.tx, metro.tz), GY, Math.max(ra, rb) + 0.5);
        if ((e === 0 || e === metro.n) && rb > GY) {
          // Stirnwand am Ende der Linie
          qo(bau, L(e, -TW, fb), L(e, TW, fb), L(e, TW, rb), L(e, -TW, rb), C_BETON_D, ref);
        }
        s = e;
      }
    }
    // Empfangsgebäude: liegt über der Halle der Abzweigung, Stützen außerhalb; Name und U-Zeichen an allen Seiten.
    const b = t.branches[metro.branch];
    let h0 = -1;
    let h1 = -1;
    for (let g = b.first; g < b.first + b.count; g++) {
      if ((t.edge[g] & EDGE_TUNNEL) === 0) continue;
      if (h0 < 0) h0 = g;
      h1 = g;
    }
    if (h0 >= 0 && h1 - h0 > 20) {
      const ga = h0 + 3;
      const gb = h1 - 3;
      const xs = [t.px[ga], t.px[gb]];
      const zs = [t.pz[ga], t.pz[gb]];
      const half = 12.5;
      const ax = Math.abs(t.tx[(ga + gb) >> 1]) > Math.abs(t.tz[(ga + gb) >> 1]);
      let yRoad = -Infinity;
      for (let g = ga; g <= gb; g++) yRoad = Math.max(yRoad, t.py[g]);
      // (über der Halle und über dem Lichtraum der Fahrbahn vor und hinter ihr)
      const y0 = Math.max(yRoad + HALLE + 0.4, yRoad + LUFT + 0.8);
      const st: Stufe = ax
        ? { x0: Math.min(...xs), x1: Math.max(...xs), z0: (zs[0] + zs[1]) / 2 - half, z1: (zs[0] + zs[1]) / 2 + half, y0, y1: y0 + 21 }
        : { x0: (xs[0] + xs[1]) / 2 - half, x1: (xs[0] + xs[1]) / 2 + half, z0: Math.min(...zs), z1: Math.max(...zs), y0, y1: y0 + 21 };
      const okBau = pruefe((st.x0 + st.x1) / 2, (st.z0 + st.z1) / 2, (st.x1 - st.x0) / 2, (st.z1 - st.z0) / 2, 0, st.y0, st.y1) === 0;
      if (okBau) {
        const R = raster(1);
        fassaden(st, R);
        // Unterseite (sieht man von der Halle aus nicht, wohl aber von der Seite)
        qo(bau, [st.x0, y0, st.z0], [st.x1, y0, st.z0], [st.x1, y0, st.z1], [st.x0, y0, st.z1], C_BETON_D, [(st.x0 + st.x1) / 2, y0 + 5, (st.z0 + st.z1) / 2]);
        dach(st, true);
        garten(st.x0 + 2, st.z0 + 2, st.x1 - 2, st.z1 - 2, st.y1);
        kante(st, GELB, st.y1 - 1.4);
        kante(st, shade(CYAN, 0.8), y0 + 0.2, 0.3);
        sperreBox(st.x0, st.z0, st.x1, st.z1, GY, st.y1 + 2);
        // Stützen außerhalb der Halle
        const cxm = (st.x0 + st.x1) / 2;
        const czm = (st.z0 + st.z1) / 2;
        for (const f of [0.08, 0.5, 0.92]) {
          for (const sg of [-1, 1]) {
            const x = ax ? st.x0 + (st.x1 - st.x0) * f : cxm + sg * (half - 1.2);
            const z = ax ? czm + sg * (half - 1.2) : st.z0 + (st.z1 - st.z0) * f;
            if (pruefe(x, z, 0.8, 0.8, 0, GY, y0, true) > 0 && hit.bahn > 0) continue;
            bau.box(x, (GY + y0) / 2, z, 1.4, y0 - GY, 1.4, C_BETON);
          }
        }
        // Name und U an allen vier Seiten
        const fe = atlas.schild[S_TURMPLATZ];
        const ze = atlas.zeichen[1];
        const sides: [number, number, number, number, number][] = [
          [st.x0, st.z1, st.x1, st.z1, st.x1 - st.x0],
          [st.x1, st.z1, st.x1, st.z0, st.z1 - st.z0],
          [st.x1, st.z0, st.x0, st.z0, st.x1 - st.x0],
          [st.x0, st.z0, st.x0, st.z1, st.z1 - st.z0],
        ];
        for (const [axx, azz, bxx, bzz, len] of sides) {
          const nx = -(bzz - azz) / len;
          const nz = (bxx - axx) / len;
          const ux = (bxx - axx) / len;
          const uz = (bzz - azz) / len;
          const mx = (axx + bxx) / 2;
          const mz = (azz + bzz) / 2;
          const w = Math.min(len * 0.6, 26);
          const y = st.y1 - 3.2 - w / fe.aspect;
          schild(mx + ux * 2.4, mz + uz * 2.4, nx, nz, w, fe, y);
          schild(mx - ux * (w * 0.5 + 0.2), mz - uz * (w * 0.5 + 0.2), nx, nz, 3.6, ze, y - 0.6);
        }
      }
    }
  }

  // --- Erster Turm: die Lichtsäule im Innern der Steilkurve --------------------------------------------------
  /** Runder Turm: Fassaden ringsum, Dach, ein Leuchtband als Wendel, Laterne und Spitze. */
  const rund = (cx: number, cz: number, r: number, y0: number, y1: number, n: number, R: Raster, wendel: number, col: RGB, col2: RGB): void => {
    const P = (k: number, rr: number, y: number): V3 => [cx + Math.cos((k / n) * TAU) * rr, y, cz + Math.sin((k / n) * TAU) * rr];
    for (let k = 0; k < n; k++) {
      const a = P(k, r, 0);
      const b = P(k + 1, r, 0);
      fassade(a[0], a[2], b[0], b[2], y0, y1, R, cx, cz);
      // Dach als Fächer
      to(bau, P(k + 1, r, y1), P(k, r, y1), [cx, y1, cz], C_DACH, [cx, y1 - 5, cz]);
    }
    markiere(cx - r, cz - r, cx + r, cz + r, y1 + 1);
    if (wendel > 0) {
      // Wendel: Band aus Vierecken, je Umlauf n Stücke, von unten (col) nach oben (col2)
      const turns = wendel;
      const steps = turns * n;
      const ya = y0 + 6;
      const yb = y1 - 8;
      const bh = 1.3;
      for (let k = 0; k < steps; k++) {
        const f0 = k / steps;
        const f1 = (k + 1) / steps;
        const ra = r + 0.12;
        const A = P(k, ra, ya + (yb - ya) * f0);
        const B = P(k + 1, ra, ya + (yb - ya) * f1);
        // über Violett, damit die Mitte nicht blass wird
        const c = f0 < 0.5 ? mixRgb(col, VIOLETT, f0 * 2) : mixRgb(VIOLETT, col2, f0 * 2 - 1);
        qo(fas, A, B, [B[0], B[1] + bh, B[2]], [A[0], A[1] + bh, A[2]], c, [cx, A[1], cz]);
      }
    }
  };
  {
    // Mitte: der Punkt innen in der Kurve, der am weitesten von allen Fahrbahnen weg liegt
    const a = segU(6.1);
    const b = segU(8.9);
    let mx = 0;
    let mz = 0;
    let n = 0;
    for (let i = a; i <= b; i++) {
      mx += t.px[i] - rightX(t, i) * 30;
      mz += t.pz[i] - rightZ(t, i) * 30;
      n++;
    }
    mx /= n;
    mz /= n;
    let best = -Infinity;
    let bx = mx;
    let bz = mz;
    for (let dx = -16; dx <= 16; dx += 1) {
      for (let dz = -16; dz <= 16; dz += 1) {
        const x = mx + dx;
        const z = mz + dz;
        const m = freiRadius(x, z);
        if (m > best) {
          best = m;
          bx = x;
          bz = z;
        }
      }
    }
    const r = Math.min(16, best - 0.6);
    if (r > 6) {
      const top = GY + 196;
      const R = raster(1);
      R.tint = [0.92, 0.95, 1.08];
      rund(bx, bz, r, GY, top, 16, R, 6, CYAN, PINK);
      // Laterne: oberste Etagen als leuchtender Ring, darüber eine schmalere Krone und die Spitze
      const P = (k: number, rr: number, y: number): V3 => [bx + Math.cos((k / 16) * TAU) * rr, y, bz + Math.sin((k / 16) * TAU) * rr];
      for (let k = 0; k < 16; k++) {
        qo(fas, P(k, r + 0.1, top - 5), P(k + 1, r + 0.1, top - 5), P(k + 1, r + 0.1, top - 1.5), P(k, r + 0.1, top - 1.5), k % 2 ? shade(PINK, 0.85) : PINK, [bx, top - 3, bz]);
      }
      const r2 = r * 0.55;
      for (let k = 0; k < 16; k++) {
        const A = P(k, r2, top);
        const B = P(k + 1, r2, top);
        qo(bau, A, B, [B[0], top + 9, B[2]], [A[0], top + 9, A[2]], C_BETON, [bx, top + 4, bz]);
        to(bau, P(k + 1, r2, top + 9), P(k, r2, top + 9), [bx, top + 9, bz], C_DACH, [bx, top, bz]);
        qo(fas, P(k, r2 + 0.08, top + 6.4), P(k + 1, r2 + 0.08, top + 6.4), P(k + 1, r2 + 0.08, top + 7.4), P(k, r2 + 0.08, top + 7.4), CYAN, [bx, top + 6, bz]);
      }
      const cone = new THREE.ConeGeometry(1.2, 30, 6);
      bau.add(cone, C_STAHL, new THREE.Matrix4().makeTranslation(bx, top + 9 + 15, bz));
      cone.dispose();
      blitz.push([bx, top + 39.5, bz]);
      sperre(bx, bz, r + 0.5, r + 0.5, 0, GY, top + 40);
      markiere(bx - r, bz - r, bx + r, bz + r, top + 40);
      // Laufschrift um die Krone
      holoRing(bx, bz, r + 2.4, top - 13, 4.2, 1, 24);
      haeuser.push({ stufen: [{ x0: bx - r * 0.7, z0: bz - r * 0.7, x1: bx + r * 0.7, z1: bz + r * 0.7, y0: GY, y1: top }], R, top, d: 0, k: a, farbe: CYAN, rund: true });
    }
  }

  // --- Aufzugskern in der Parkhausspirale ------------------------------------------------------------------
  {
    const a = segU(24.2);
    const b = segU(33);
    let mx = 0;
    let mz = 0;
    for (let i = a; i <= b; i++) {
      mx += t.px[i];
      mz += t.pz[i];
    }
    mx /= b - a + 1;
    mz /= b - a + 1;
    let best = -Infinity;
    let bx = mx;
    let bz = mz;
    for (let dx = -8; dx <= 8; dx += 0.5) {
      for (let dz = -8; dz <= 8; dz += 0.5) {
        const m = freiRadius(mx + dx, mz + dz, 48);
        if (m > best) {
          best = m;
          bx = mx + dx;
          bz = mz + dz;
        }
      }
    }
    const r = Math.min(9, best - 0.5);
    if (r > 3) {
      let ytop = -Infinity;
      for (let i = a; i <= b; i++) ytop = Math.max(ytop, t.py[i]);
      const top = ytop + 12;
      const R = raster(1);
      rund(bx, bz, r, GY, top, 8, R, 0, CYAN, CYAN);
      // Aufzugsschacht: ein senkrechtes Leuchtband, oben das P an allen Seiten
      const ze = atlas.zeichen[0];
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * TAU + TAU / 16;
        const nx = Math.cos(ang);
        const nz = Math.sin(ang);
        const rr = r * Math.cos(TAU / 16) + 0.15;
        const cx = bx + nx * rr;
        const cz = bz + nz * rr;
        const ux = -nz;
        const uz = nx;
        const s = Math.min(5, r * 0.7);
        const y = top - s - 1.2;
        fas.quadUv([cx + ux * s * 0.5, y, cz + uz * s * 0.5], [cx - ux * s * 0.5, y, cz - uz * s * 0.5], [cx - ux * s * 0.5, y + s, cz - uz * s * 0.5], [cx + ux * s * 0.5, y + s, cz + uz * s * 0.5], WEISS, WEISS, WEISS, WEISS, ze.u0, ze.v0, ze.u1, ze.v1);
        const fe = atlas.schild[S_PARKHAUS];
        const sw = Math.min(2 * r * Math.sin(TAU / 16) - 0.6, 9);
        const sh = sw / fe.aspect;
        const ys = y - sh - 0.8;
        fas.quadUv([cx + ux * sw * 0.5, ys, cz + uz * sw * 0.5], [cx - ux * sw * 0.5, ys, cz - uz * sw * 0.5], [cx - ux * sw * 0.5, ys + sh, cz - uz * sw * 0.5], [cx + ux * sw * 0.5, ys + sh, cz + uz * sw * 0.5], WEISS, WEISS, WEISS, WEISS, fe.u0, fe.v0, fe.u1, fe.v1);
        qo(fas, [cx + ux * 0.3, GY + 2, cz + uz * 0.3], [cx - ux * 0.3, GY + 2, cz - uz * 0.3], [cx - ux * 0.3, ys - 1, cz - uz * 0.3], [cx + ux * 0.3, ys - 1, cz + uz * 0.3], shade(k % 2 ? CYAN : PINK, 0.8), [bx, ys, bz]);
      }
      sperre(bx, bz, r + 0.5, r + 0.5, 0, GY, top + 2);
      warn.push([bx, top + 0.4, bz]);
    }
  }

  // Laufschrift-Ring um eine Krone (halbdurchsichtige Fläche, Text wandert über die Textur)
  function holoRing(cx: number, cz: number, r: number, y: number, h: number, row: number, n: number): void {
    const v0 = 1 - (row + 1) / LAUFSCHRIFT.length;
    const v1 = 1 - row / LAUFSCHRIFT.length;
    const rep = Math.max(1, Math.round((TAU * r) / (h * 14)));
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * TAU;
      const a1 = ((k + 1) / n) * TAU;
      // gegen den Uhrzeigersinn von außen gesehen: Text läuft von links nach rechts
      const A: V3 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r];
      const B: V3 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r];
      const u0 = ((n - k - 1) / n) * rep;
      const u1 = ((n - k) / n) * rep;
      holo.quadUv(A, B, [B[0], y + h, B[2]], [A[0], y + h, A[2]], WEISS, WEISS, WEISS, WEISS, u0, v0, u1, v1);
    }
  }

  // =====================================================================================
  // Stadt: Straßenraster, Blöcke, Häuser
  // =====================================================================================
  const kx0 = Math.floor((minX - REICH - XS) / PER) - 1;
  const kx1 = Math.ceil((maxX + REICH - XS) / PER) + 1;
  const kz0 = Math.floor((minZ - REICH) / PER) - 1;
  const kz1 = Math.ceil((maxZ + REICH) / PER) + 1;
  const sx = (k: number): number => XS + k * PER;
  const sz = (k: number): number => k * PER;
  // Dachstraße am Atriumturm: die Häuser daneben reichen bis knapp unter die Fahrbahn – sie fährt über die Dächer.
  const dachU0 = 15.6;
  const dachU1 = 20.9;
  // Umgebung je Abschnitt: Schlucht (hohe Häuser dicht an der Bahn), offen (Dächer auf Höhe der Bahn, Blick über die
  // Stadt und hinunter auf die Straßen) oder Dachstraße (die Bahn fährt über die Dächer).
  const SCHLUCHT = 0;
  const OFFEN = 1;
  const DACH = 2;
  const art = new Uint8Array(T);
  for (let k = 0; k < T; k++) {
    const b = t.branchOf[k];
    if (b >= 0) art[k] = t.branches[b] && t.def.branches?.[b]?.shortcut === 'risk' ? DACH : SCHLUCHT;
    else if (inU(k, 5.6, 9.4) || inU(k, 12.9, dachU0) || inU(k, dachU1, 33.6)) art[k] = OFFEN;
    else if (inU(k, dachU0, dachU1)) art[k] = DACH;
    else art[k] = SCHLUCHT;
  }
  /** Höhe (Oberkante) für ein Haus an (x, z). */
  const hoehe = (x: number, z: number, d: number, k: number): number => {
    const n1 = noise(x * 0.0065 + 7.1, z * 0.0065 - 3.3);
    const n2 = noise(x * 0.04 + 1.7, z * 0.04 + 9.2);
    let h = 12 + 40 * n2 + 70 * n1 * n1;
    if (rnd() < 0.05 + 0.14 * n1) h = 85 + rnd() * 95 + (rnd() < 0.15 ? 60 : 0);
    let top = GY + h;
    const py = t.py[k];
    if (art[k] === DACH && d < 32) return py - 1.6 - rnd() * 4;
    if (art[k] === SCHLUCHT) {
      if (d < 40) top = Math.max(top, py + 8 + rnd() * 36);
    } else if (art[k] === OFFEN) {
      if (d < 50) top = Math.min(top, py - 3 + rnd() * 6);
      else if (d < 95) top = Math.min(top, py + 12 + rnd() * 18);
    }
    // Innenblock zwischen Startgerade und Fassade: niedriger, die Fassade soll darüber zu sehen bleiben
    if (x > -75 && x < 125 && z > -72 && z < -8) top = Math.min(top, 58 + rnd() * 10);
    return top;
  };

  /** Ein Los bebauen: zuerst so zurechtschneiden, dass es frei ist, dann Stufen und Zeichnung. */
  const bebaue = (x0: number, z0: number, x1: number, z1: number): void => {
    const cx0 = (x0 + x1) / 2;
    const cz0 = (z0 + z1) / 2;
    const d0 = abst(cx0, cz0);
    if (d0 > REICH) return;
    const k0 = naechster(cx0, cz0);
    let top = hoehe(cx0, cz0, d0, k0);
    const MIN = 9;
    for (let it = 0; it < 18; it++) {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      // (5 m Reserve über dem Dach für Aufbauten, Bäume und Attika)
      if (pruefe(cx, cz, (x1 - x0) / 2, (z1 - z0) / 2, 0, GY, top + 5) === 0) break;
      if (hit.cap > GY + 19 && hit.cap < top + 5) {
        top = hit.cap - 5.8;
        continue;
      }
      // Hindernis als Rechteck (Abschnitt mit seinem Radius bzw. belegte Fläche)
      let ox0: number;
      let ox1: number;
      let oz0: number;
      let oz1: number;
      if (hit.bahn > 0 && hit.k >= 0) {
        const r = zRad[hit.k] + 0.4;
        ox0 = t.px[hit.k] - r;
        ox1 = t.px[hit.k] + r;
        oz0 = t.pz[hit.k] - r;
        oz1 = t.pz[hit.k] + r;
      } else if (hit.sp >= 0) {
        const b = sperren[hit.sp];
        const ex = b.hw * Math.abs(b.c) + b.hd * Math.abs(b.s) + 1.6;
        const ez = b.hw * Math.abs(b.s) + b.hd * Math.abs(b.c) + 1.6;
        ox0 = b.cx - ex;
        ox1 = b.cx + ex;
        oz0 = b.cz - ez;
        oz1 = b.cz + ez;
      } else return;
      // Die Seite zurücknehmen, die am meisten Fläche übrig lässt
      const cand: [number, number, number, number][] = [];
      if (ox0 > x0) cand.push([x0, z0, Math.min(x1, ox0), z1]);
      if (ox1 < x1) cand.push([Math.max(x0, ox1), z0, x1, z1]);
      if (oz0 > z0) cand.push([x0, z0, x1, Math.min(z1, oz0)]);
      if (oz1 < z1) cand.push([x0, Math.max(z0, oz1), x1, z1]);
      let bestA = 0;
      let bestC: [number, number, number, number] | null = null;
      for (const c of cand) {
        const a = (c[2] - c[0]) * (c[3] - c[1]);
        if (c[2] - c[0] >= MIN && c[3] - c[1] >= MIN && a > bestA) {
          bestA = a;
          bestC = c;
        }
      }
      if (!bestC) return;
      [x0, z0, x1, z1] = bestC;
    }
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (pruefe(cx, cz, (x1 - x0) / 2, (z1 - z0) / 2, 0, GY, top + 5) > 0) return;
    if (top < GY + 8) return;
    const d = abst(cx, cz);
    const k = naechster(cx, cz);
    const w = x1 - x0;
    const dd = z1 - z0;
    const H = top - GY;
    const stil = H > 90 ? (rnd() < 0.55 ? 1 : 0) : H < 40 ? (rnd() < 0.6 ? 2 : 0) : Math.floor(rnd() * 3);
    const R = raster(stil);
    const farbe = pick(NEON);
    // Runder Turm auf quadratischem Los
    if (H > 80 && Math.abs(w - dd) < 6 && Math.min(w, dd) > 20 && rnd() < 0.35) {
      const r = Math.min(w, dd) / 2;
      const podium = GY + 8 + rnd() * 10;
      const s0: Stufe = { x0, z0, x1, z1, y0: GY, y1: podium };
      fassaden(s0, raster(2));
      dach(s0, d < 120);
      const R2 = raster(1);
      rund(cx, cz, r * 0.86, podium, top, 12, R2, d < 120 && rnd() < 0.5 ? 3 : 0, farbe, pick(NEON));
      if (d < 140) for (let kk = 0; kk < 12; kk++) {
        const a0 = (kk / 12) * TAU;
        const a1 = ((kk + 1) / 12) * TAU;
        const rr = r * 0.86 + 0.08;
        qo(fas, [cx + Math.cos(a0) * rr, top - 3, cz + Math.sin(a0) * rr], [cx + Math.cos(a1) * rr, top - 3, cz + Math.sin(a1) * rr], [cx + Math.cos(a1) * rr, top - 1.2, cz + Math.sin(a1) * rr], [cx + Math.cos(a0) * rr, top - 1.2, cz + Math.sin(a0) * rr], farbe, [cx, top, cz]);
      }
      markiere(x0, z0, x1, z1, podium + 1);
      sperreBox(x0, z0, x1, z1, GY, top + 2);
      if (top > GY + 110) mast(cx, top, cz, 14 + rnd() * 10, top > GY + 180);
      haeuser.push({ stufen: [{ x0: cx - r * 0.6, z0: cz - r * 0.6, x1: cx + r * 0.6, z1: cz + r * 0.6, y0: podium, y1: top }], R: R2, top, d, k, farbe, rund: true });
      return;
    }
    // Stufen: Sockel, Turm, Krone
    const stufen: Stufe[] = [];
    if (H > 60 && w > 18 && dd > 18) {
      const p = GY + 10 + rnd() * Math.min(26, H * 0.3);
      stufen.push({ x0, z0, x1, z1, y0: GY, y1: p });
      const inset = (): number => (rnd() < 0.3 ? 0 : 2 + rnd() * 5);
      let a = { x0: x0 + inset(), z0: z0 + inset(), x1: x1 - inset(), z1: z1 - inset() };
      if (a.x1 - a.x0 < 10 || a.z1 - a.z0 < 10) a = { x0: x0 + 2, z0: z0 + 2, x1: x1 - 2, z1: z1 - 2 };
      if (H > 120 && rnd() < 0.7) {
        const y2 = top - 14 - rnd() * 22;
        stufen.push({ ...a, y0: p, y1: y2 });
        const i2 = 2 + rnd() * 3;
        const b = { x0: a.x0 + i2, z0: a.z0 + i2, x1: a.x1 - i2, z1: a.z1 - i2 };
        if (b.x1 - b.x0 > 6 && b.z1 - b.z0 > 6) stufen.push({ ...b, y0: y2, y1: top });
        else stufen[stufen.length - 1].y1 = top;
      } else stufen.push({ ...a, y0: p, y1: top });
    } else stufen.push({ x0, z0, x1, z1, y0: GY, y1: top });
    // Fenster auf ganze Etagen: Oberkanten auf Etagengrenzen
    for (const s of stufen) s.y1 = GY + Math.max(1, Math.round((s.y1 - GY) / R.py)) * R.py;
    for (let i = 1; i < stufen.length; i++) stufen[i].y0 = stufen[i - 1].y1;
    const h: Haus = { stufen, R, top: stufen[stufen.length - 1].y1, d, k, farbe, rund: false };
    zeichneHaus(h);
    sperreBox(x0, z0, x1, z1, GY, h.top + 2);
    haeuser.push(h);
  };

  // Blöcke aufteilen und bebauen
  for (let kx = kx0; kx < kx1; kx++) {
    for (let kz = kz0; kz < kz1; kz++) {
      const bx0 = sx(kx) + STR / 2;
      const bx1 = sx(kx + 1) - STR / 2;
      const bz0 = sz(kz) + STR / 2;
      const bz1 = sz(kz + 1) - STR / 2;
      const c = abst((bx0 + bx1) / 2, (bz0 + bz1) / 2);
      if (c > REICH + 40) continue;
      const r = rnd();
      const lots: [number, number, number, number][] = [];
      const fx = 0.35 + rnd() * 0.3;
      const fz = 0.35 + rnd() * 0.3;
      const mx = bx0 + (bx1 - bx0) * fx;
      const mz = bz0 + (bz1 - bz0) * fz;
      if (r < 0.2) lots.push([bx0, bz0, bx1, bz1]);
      else if (r < 0.4) lots.push([bx0, bz0, mx, bz1], [mx, bz0, bx1, bz1]);
      else if (r < 0.6) lots.push([bx0, bz0, bx1, mz], [bx0, mz, bx1, bz1]);
      else lots.push([bx0, bz0, mx, mz], [mx, bz0, bx1, mz], [bx0, mz, mx, bz1], [mx, mz, bx1, bz1]);
      // Kleine Plätze lassen: ab und zu ein Los als Park
      for (const [a0, b0, a1, b1] of lots) {
        if (lots.length === 4 && rnd() < 0.06 && abst((a0 + a1) / 2, (b0 + b1) / 2) < 150) {
          park(a0 + 1.2, b0 + 1.2, a1 - 1.2, b1 - 1.2);
          continue;
        }
        bebaue(a0 + 1.2, b0 + 1.2, a1 - 1.2, b1 - 1.2);
      }
    }
  }

  /** Kleiner Park am Boden: Bäume, Wege mit Lampen, in der Mitte ein leuchtender Brunnen. */
  function park(x0: number, z0: number, x1: number, z1: number): void {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (pruefe(cx, cz, (x1 - x0) / 2, (z1 - z0) / 2, 0, GY, GY + 8, true) > 0) return;
    qo(bau, [x0, GY + 0.06, z0], [x1, GY + 0.06, z0], [x1, GY + 0.06, z1], [x0, GY + 0.06, z1], C_RASEN_D, [cx, GY - 5, cz]);
    const n = hi ? 8 : 4;
    for (let k = 0; k < n; k++) {
      const x = x0 + 2 + rnd() * (x1 - x0 - 4);
      const z = z0 + 2 + rnd() * (z1 - z0 - 4);
      if (Math.hypot(x - cx, z - cz) < 4) continue;
      baum(x, GY, z, 1 + rnd() * 0.6);
    }
    fas.box(cx, GY + 0.3, cz, 5, 0.6, 5, shade(CYAN, 0.55));
    fas.punkt(cx, GY + 1.6, cz, 0.6, WEISS);
    sperreBox(x0, z0, x1, z1, GY, GY + 8);
  }

  // =====================================================================================
  // Schilder: Leuchtreklamen und Klingen an Fassaden, die zur Bahn schauen
  // =====================================================================================
  {
    let nSchild = 0;
    let nKlinge = 0;
    let naechstesSchild = Math.floor(rnd() * 8);
    const maxS = hi ? 44 : 22;
    const maxK = hi ? 16 : 7;
    // Je 80 m Strecke höchstens drei Schilder: verteilt über die ganze Runde statt gehäuft an einer Stelle
    const proBereich = new Map<number, number>();
    const order = haeuser.map((h, i) => [h.d, i]).sort((a, b) => a[0] - b[0]);
    for (const [, hiIdx] of order) {
      const h = haeuser[hiIdx];
      if (h.rund || h.d > 80) continue;
      if (nSchild >= maxS && nKlinge >= maxK) break;
      for (const s of h.stufen) {
        const faces: [number, number, number, number][] = [
          [s.x0, s.z1, s.x1, s.z1],
          [s.x1, s.z1, s.x1, s.z0],
          [s.x1, s.z0, s.x0, s.z0],
          [s.x0, s.z0, s.x0, s.z1],
        ];
        for (const [ax, az, bx, bz] of faces) {
          const L = Math.hypot(bx - ax, bz - az);
          if (L < 10) continue;
          const nx = -(bz - az) / L;
          const nz = (bx - ax) / L;
          const ux = (bx - ax) / L;
          const uz = (bz - az) / L;
          const mx = (ax + bx) / 2;
          const mz = (az + bz) / 2;
          // Schaut die Fläche zur Bahn? (nächster Abschnitt vor ihr)
          const k = naechster(mx + nx * 12, mz + nz * 12);
          const tx = t.px[k] - mx;
          const tz = t.pz[k] - mz;
          const td = Math.hypot(tx, tz);
          if (td < 8 || td > 75 || (tx * nx + tz * nz) / td < 0.55) continue;
          const bereich = Math.floor((k < N ? k : t.branches[t.branchOf[k]].from) / 80);
          if ((proBereich.get(bereich) ?? 0) >= 3) continue;
          proBereich.set(bereich, (proBereich.get(bereich) ?? 0) + 1);
          const ys = t.py[k] + 5 + rnd() * 9;
          if (rnd() < 0.62 && nSchild < maxS) {
            const fe = atlas.schild[naechstesSchild++ % 8];
            const w = Math.min(L * 0.7, (hi ? 14 : 12) + rnd() * 8);
            const hh = w / fe.aspect;
            const y = Math.min(Math.max(ys, s.y0 + 2), s.y1 - hh - 2);
            if (y < s.y0 + 1 || hh > s.y1 - s.y0 - 3) continue;
            const off = (rnd() - 0.5) * (L - w) * 0.6;
            schild(mx + ux * off, mz + uz * off, nx, nz, w, fe, y, 0.35);
            // Rahmen dahinter
            bau.box(mx + ux * off + nx * 0.18, y + hh / 2, mz + uz * off + nz * 0.18, w + 0.5, hh + 0.5, 0.3, C_ATTIKA, Math.atan2(nx, nz));
            nSchild++;
          } else if (nKlinge < maxK && h.d < 60) {
            // Klinge an der Ecke, senkrecht zur Fassade
            const fe = atlas.klinge[Math.floor(rnd() * atlas.klinge.length)];
            const bw = 1.7;
            const bh = bw * fe.aspect;
            const y = Math.min(Math.max(ys - 2, s.y0 + 3), s.y1 - bh - 2);
            if (y < s.y0 + 1) continue;
            const end = rnd() < 0.5 ? 0 : 1;
            const ex = end ? bx - ux * 1.2 : ax + ux * 1.2;
            const ez = end ? bz - uz * 1.2 : az + uz * 1.2;
            const out = 0.4;
            const ca = [ex + nx * out, ez + nz * out];
            const cb = [ex + nx * (out + bw), ez + nz * (out + bw)];
            if (pruefe((ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, 0.3, bw / 2 + 0.2, Math.atan2(nx, nz), y, y + bh) > 0 && hit.bahn > 0) continue;
            // Beide Seiten: u läuft von oben nach unten
            const P = (c: number[], yy: number): V3 => [c[0], yy, c[1]];
            fas.quadUv(P(ca, y + bh), P(ca, y), P(cb, y), P(cb, y + bh), WEISS, WEISS, WEISS, WEISS, fe.u0, fe.v1, fe.u1, fe.v0);
            fas.quadUv(P(cb, y + bh), P(cb, y), P(ca, y), P(ca, y + bh), WEISS, WEISS, WEISS, WEISS, fe.u0, fe.v0, fe.u1, fe.v1);
            bau.box((ca[0] + cb[0]) / 2, y + bh / 2, (ca[1] + cb[1]) / 2, bw + 0.3, bh + 0.3, 0.12, C_ATTIKA, Math.atan2(ux, uz));
            nKlinge++;
          }
        }
      }
    }
  }

  // Hologramm-Tafeln: vor einer Fassade zur Bahn hin schwebt eine Tafel mit vier Zeilen Laufschrift, gehalten von
  // einem Rahmen mit Leuchtkanten
  {
    let n = 0;
    const want = hi ? 4 : 2;
    const order = haeuser.filter((h) => !h.rund && h.d > 6 && h.d < 45 && art[h.k] !== DACH).sort((a, b) => a.d - b.d);
    let letzte = -1e9;
    for (const h of order) {
      if (n >= want) break;
      const s = h.stufen[h.stufen.length > 1 ? 1 : 0];
      const faces: [number, number, number, number][] = [
        [s.x0, s.z1, s.x1, s.z1],
        [s.x1, s.z1, s.x1, s.z0],
        [s.x1, s.z0, s.x0, s.z0],
        [s.x0, s.z0, s.x0, s.z1],
      ];
      for (const [ax, az, bx, bz] of faces) {
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 16) continue;
        const nx = -(bz - az) / L;
        const nz = (bx - ax) / L;
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        const k = naechster(mx + nx * 10, mz + nz * 10);
        const tx = t.px[k] - mx;
        const tz = t.pz[k] - mz;
        const td = Math.hypot(tx, tz);
        if (td > 40 || (tx * nx + tz * nz) / td < 0.7) continue;
        // nicht zwei Tafeln dicht hintereinander an der Strecke
        if (Math.abs(k - letzte) < 120) continue;
        const W = Math.min(L - 4, 14);
        const H = W * 0.42;
        const y = Math.max(s.y0 + 3, t.py[k] + 6);
        if (y + H > s.y1 - 2) continue;
        const off = 1.6;
        const ux = (bx - ax) / L;
        const uz = (bz - az) / L;
        if (pruefe(mx + nx * off * 0.5, mz + nz * off * 0.5, 0.3 + off / 2, W / 2, Math.atan2(ux, uz), y, y + H) > 0 && hit.bahn > 0) continue;
        const px = mx + nx * off;
        const pz = mz + nz * off;
        const A: V3 = [px - ux * W * 0.5, y, pz - uz * W * 0.5];
        const B: V3 = [px + ux * W * 0.5, y, pz + uz * W * 0.5];
        const rep2 = W / (H / LAUFSCHRIFT.length) / 16;
        holo.quadUv(A, B, [B[0], y + H, B[2]], [A[0], y + H, A[2]], WEISS, WEISS, WEISS, WEISS, 0, 0, rep2, 1);
        // Rahmen: Halter zur Wand, Leuchtkanten oben und unten
        for (const f of [-0.45, 0.45]) {
          const hx = px + ux * W * f;
          const hz = pz + uz * W * f;
          bau.box(hx - nx * off * 0.5, y + H / 2, hz - nz * off * 0.5, 0.25, 0.25, off, C_STAHL, Math.atan2(nx, nz));
        }
        for (const yy of [y - 0.25, y + H]) qo(fas, [A[0], yy, A[2]], [B[0], yy, B[2]], [B[0], yy + 0.25, B[2]], [A[0], yy + 0.25, A[2]], CYAN, [mx, yy, mz]);
        letzte = k;
        n++;
        break;
      }
    }
  }

  // Laufschriften um einige hohe Kronen nahe der Bahn
  {
    const kand = haeuser.filter((h) => !h.rund && h.top > GY + 95 && h.d < 130).sort((a, b) => a.d - b.d);
    let n = 0;
    for (const h of kand) {
      if (n >= (hi ? 5 : 3)) break;
      const s = h.stufen[h.stufen.length - 1];
      const r = Math.hypot(s.x1 - s.x0, s.z1 - s.z0) / 2 + 1.6;
      const cx = (s.x0 + s.x1) / 2;
      const cz = (s.z0 + s.z1) / 2;
      const y = s.y1 - 9;
      if (pruefe(cx, cz, r, r, 0, y, y + 4) > 0 && hit.bahn > 0) continue;
      holoRing(cx, cz, r, y, 3.6, (n + 2) % LAUFSCHRIFT.length, 20);
      n++;
    }
  }

  // =====================================================================================
  // Skywalks: verglaste Brücken zwischen zwei Häusern – auch über die Bahn hinweg
  // =====================================================================================
  const brueckenBoxen: Sperre[] = [];
  {
    interface Kand {
      x0: number;
      z0: number;
      x1: number;
      z1: number;
      y: number;
      ueberBahn: boolean;
      score: number;
    }
    const kand: Kand[] = [];
    const nahH = haeuser.filter((h) => !h.rund && h.d < 120);
    for (let a = 0; a < nahH.length; a++) {
      for (let b = 0; b < nahH.length; b++) {
        if (a === b) continue;
        const A = nahH[a].stufen[nahH[a].stufen.length > 1 ? 1 : 0];
        const B = nahH[b].stufen[nahH[b].stufen.length > 1 ? 1 : 0];
        const ylo = Math.max(A.y0, B.y0) + 3;
        const yhi = Math.min(A.y1, B.y1) - 7;
        if (yhi - ylo < 4 || yhi < GY + 20) continue;
        // in x-Richtung: A links von B
        const gx = B.x0 - A.x1;
        const oz0 = Math.max(A.z0, B.z0);
        const oz1 = Math.min(A.z1, B.z1);
        const gz = B.z0 - A.z1;
        const ox0 = Math.max(A.x0, B.x0);
        const ox1 = Math.min(A.x1, B.x1);
        const tryOne = (x0: number, z0: number, x1: number, z1: number): void => {
          const cx = (x0 + x1) / 2;
          const cz = (z0 + z1) / 2;
          // Höhe: gut über der Bahn darunter, sonst in der Mitte
          const k = naechster(cx, cz);
          let y = Math.max(ylo, Math.min(yhi, t.py[k] + LUFT + 6 + rnd() * 10));
          y = Math.max(y, GY + 18);
          if (y > yhi) return;
          // (an den Enden 2,5 m kürzer geprüft: dort hängt die Brücke an den beiden Häusern)
          const ax = x1 - x0 > z1 - z0;
          if (pruefe(cx, cz, (x1 - x0) / 2 - (ax ? 2.5 : 0), (z1 - z0) / 2 - (ax ? 0 : 2.5), 0, y - 0.6, y + 4.2, false, 0.5) > 0) return;
          let ueberBahn = false;
          for (let s = 0; s <= 1; s += 0.1) {
            const px = x0 + (x1 - x0) * s;
            const pz = z0 + (z1 - z0) * s;
            if (abst(px, pz) < 0) ueberBahn = true;
          }
          const score = (ueberBahn ? 100 : 0) + (60 - Math.min(60, abst(cx, cz))) + rnd() * 20;
          kand.push({ x0, z0, x1, z1, y, ueberBahn, score });
        };
        if (gx > 8 && gx < 48 && oz1 - oz0 > 8) {
          const zc = (oz0 + oz1) / 2 + (rnd() - 0.5) * (oz1 - oz0 - 6) * 0.5;
          tryOne(A.x1, zc - 2, B.x0, zc + 2);
        }
        if (gz > 8 && gz < 48 && ox1 - ox0 > 8) {
          const xc = (ox0 + ox1) / 2 + (rnd() - 0.5) * (ox1 - ox0 - 6) * 0.5;
          tryOne(xc - 2, A.z1, xc + 2, B.z0);
        }
      }
    }
    kand.sort((a, b) => b.score - a.score);
    const max = hi ? 9 : 4;
    for (const c of kand) {
      if (brueckenBoxen.length >= max) break;
      const box: Sperre = { cx: (c.x0 + c.x1) / 2, cz: (c.z0 + c.z1) / 2, hw: (c.x1 - c.x0) / 2, hd: (c.z1 - c.z0) / 2, c: 1, s: 0, y0: c.y - 1, y1: c.y + 5 };
      if (brueckenBoxen.some((b) => ueber(b, box, 6) && Math.abs(b.y0 - box.y0) < 12)) continue;
      brueckenBoxen.push(box);
      const { x0, z0, x1, z1, y } = c;
      const alongX = x1 - x0 > z1 - z0;
      // Boden, Dach, Glasseiten mit warmem Lichtband, Leuchtkanten
      const ref: V3 = [(x0 + x1) / 2, y + 1.8, (z0 + z1) / 2];
      bau.box((x0 + x1) / 2, y - 0.3, (z0 + z1) / 2, x1 - x0, 0.6, z1 - z0, C_BETON);
      bau.box((x0 + x1) / 2, y + 3.7, (z0 + z1) / 2, x1 - x0, 0.5, z1 - z0, C_BETON_D);
      const sides: [V3, V3][] = alongX
        ? [
            [
              [x0, y, z0],
              [x1, y, z0],
            ],
            [
              [x1, y, z1],
              [x0, y, z1],
            ],
          ]
        : [
            [
              [x0, y, z1],
              [x0, y, z0],
            ],
            [
              [x1, y, z0],
              [x1, y, z1],
            ],
          ];
      for (const [a, b] of sides) {
        qo(fas, a, b, [b[0], y + 3.45, b[2]], [a[0], y + 3.45, a[2]], C_GLAS, ref);
        // Lichtband und Leuchtkante ein Stück vor dem Glas (sonst flimmern die gleichen Ebenen gegeneinander)
        const ox = (a[0] + b[0]) / 2 - ref[0];
        const oz = (a[2] + b[2]) / 2 - ref[2];
        const ol = Math.hypot(ox, oz) || 1;
        const A: V3 = [a[0] + (ox / ol) * 0.06, y, a[2] + (oz / ol) * 0.06];
        const B: V3 = [b[0] + (ox / ol) * 0.06, y, b[2] + (oz / ol) * 0.06];
        qo(fas, [A[0], y + 1.0, A[2]], [B[0], y + 1.0, B[2]], [B[0], y + 2.3, B[2]], [A[0], y + 2.3, A[2]], shade(WARM, 0.55), ref);
        qo(fas, [A[0], y - 0.62, A[2]], [B[0], y - 0.62, B[2]], [B[0], y - 0.38, B[2]], [A[0], y - 0.38, A[2]], c.ueberBahn ? PINK : CYAN, ref);
      }
      markiere(x0, z0, x1, z1, y + 5);
    }
  }

  // =====================================================================================
  // Boden: Straßen mit Lichtströmen, Laternen, Boulevard, Kanal
  // =====================================================================================
  const KANAL_Z = 2 * PER;
  const kanalX0 = -60;
  {
    const lane = hi ? [1.5, 4.2] : [2.6];
    const lampen = hi ? 30 : 44;
    /** Ein Straßenstück von (ax, az) nach (bx, bz) (achsparallel). */
    const strasse = (ax: number, az: number, bx: number, bz: number): void => {
      const L = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / L;
      const uz = (bz - az) / L;
      const nx = -uz;
      const nz = ux;
      const mxx = (ax + bx) / 2;
      const mzz = (az + bz) / 2;
      const dm = abst(mxx, mzz);
      if (dm > REICH + 10) return;
      // Gehwege (heller) an beiden Seiten
      for (const sg of [-1, 1]) {
        const o0 = sg * (STR / 2 - 1.4);
        const o1 = sg * (STR / 2 + 0.6);
        qo(bau, [ax + nx * o0, GY + 0.05, az + nz * o0], [bx + nx * o0, GY + 0.05, bz + nz * o0], [bx + nx * o1, GY + 0.05, bz + nz * o1], [ax + nx * o1, GY + 0.05, az + nz * o1], C_GEHWEG, [mxx, GY - 5, mzz]);
      }
      // Lichtströme: je zwei Spuren in jede Richtung (u quer, v längs; Gegenrichtung mit umgekehrtem v)
      const v1 = L / STROM_L;
      for (const sg of [-1, 1]) {
        for (const l of lane) {
          const o = sg * l;
          const w = 1.2;
          const A: V3 = [ax + nx * (o - w), GY + 0.12, az + nz * (o - w)];
          const B: V3 = [ax + nx * (o + w), GY + 0.12, az + nz * (o + w)];
          const C: V3 = [bx + nx * (o + w), GY + 0.12, bz + nz * (o + w)];
          const D: V3 = [bx + nx * (o - w), GY + 0.12, bz + nz * (o - w)];
          const vo = rnd() * 4;
          // Rechts fährt man vorwärts (sg > 0: rechts von a → b)
          const fw = sg > 0;
          const ref: V3 = [mxx, GY - 5, mzz];
          const cA: RGB = [1, 1, 1];
          if (weg(A, B, C, ref)) strom.quadUv(A, B, C, D, cA, cA, cA, cA, 0, fw ? vo : vo + v1, 1, fw ? vo + v1 : vo);
          else strom.quadUv(B, A, D, C, cA, cA, cA, cA, 1, fw ? vo : vo + v1, 0, fw ? vo + v1 : vo);
        }
      }
      // Boulevard unter der Startgeraden: Bäume auf den Gehwegen, zwischen den Stützen
      if (hi && az === 0 && bz === 0 && dm < 40) {
        for (let s2 = 7; s2 < L; s2 += 14) {
          for (const sg of [-1, 1]) {
            const x = ax + ux * s2 + nx * sg * (STR / 2 - 0.8);
            const z = az + uz * s2 + nz * sg * (STR / 2 - 0.8);
            if (pruefe(x, z, 1.6, 1.6, 0, GY, GY + 6, true) > 0) continue;
            baum(x, GY, z, 1.1 + rnd() * 0.3);
          }
        }
      }
      // Laternen
      if (dm < (hi ? 120 : 80)) {
        for (let s = lampen / 2; s < L; s += lampen) {
          for (const sg of [-1, 1]) {
            const o = sg * (STR / 2 - 1.2);
            const x = ax + ux * s + nx * o;
            const z = az + uz * s + nz * o;
            if (pruefe(x, z, 0.3, 0.3, 0, GY, GY + 7, true) > 0) continue;
            if (dm < 70) bau.box(x, GY + 3.4, z, 0.22, 6.8, 0.22, C_STAHL);
            const lx = x - nx * sg * 0.8;
            const lz = z - nz * sg * 0.8;
            fas.quad([lx - 0.7, GY + 6.8, lz], [lx, GY + 6.8, lz + 0.7], [lx + 0.7, GY + 6.8, lz], [lx, GY + 6.8, lz - 0.7], WARM);
          }
        }
      }
    };
    for (let kx = kx0; kx <= kx1; kx++) {
      for (let kz = kz0; kz < kz1; kz++) {
        const x = sx(kx);
        // Der Kanal ersetzt die Querstraße bei z = KANAL_Z östlich von kanalX0
        strasse(x, sz(kz) + STR / 2, x, sz(kz + 1) - STR / 2);
      }
    }
    for (let kz = kz0; kz <= kz1; kz++) {
      for (let kx = kx0; kx < kx1; kx++) {
        const z = sz(kz);
        const xa = sx(kx) + STR / 2;
        const xb = sx(kx + 1) - STR / 2;
        if (z === KANAL_Z && xa > kanalX0) continue;
        strasse(xa, z, xb, z);
      }
      // Kreuzungen: Lichtströme laufen durch
      for (let kx = kx0; kx <= kx1; kx++) {
        const z = sz(kz);
        if (z === KANAL_Z && sx(kx) > kanalX0) continue;
        strasse(sx(kx) - STR / 2, z, sx(kx) + STR / 2, z);
      }
    }

    // Kanal: Wasser zwischen zwei Kaimauern, Widerschein der Fenster, Brücken an den Querstraßen
    const kx2 = Math.ceil((kanalX0 - XS) / PER);
    const xEnd = sx(kx1);
    const z0 = KANAL_Z - STR / 2;
    const z1 = KANAL_Z + STR / 2;
    for (let x = sx(kx2) - STR / 2; x < xEnd; x += PER) {
      const xa = x;
      const xb = Math.min(xEnd, x + PER);
      if (abst((xa + xb) / 2, KANAL_Z) > REICH) continue;
      if (pruefe((xa + xb) / 2, KANAL_Z, (xb - xa) / 2, STR / 2, 0, GY, GY + 1.5, true) > 0) continue;
      qo(fas, [xa, GY + 0.25, z0 + 1.6], [xb, GY + 0.25, z0 + 1.6], [xb, GY + 0.25, z1 - 1.6], [xa, GY + 0.25, z1 - 1.6], C_WASSER, [xa, GY - 5, z0]);
      for (const [za, zb] of [
        [z0, z0 + 1.6],
        [z1 - 1.6, z1],
      ]) {
        bau.box((xa + xb) / 2, GY + 0.65, (za + zb) / 2, xb - xa, 1.3, zb - za, C_KAI);
      }
      // Widerschein: lange, schwache Streifen quer über das Wasser
      for (let k = 0; k < (hi ? 9 : 4); k++) {
        const xr = xa + 2 + rnd() * (xb - xa - 4);
        const wr = 0.6 + rnd() * 1.6;
        const col = shade(pick([WARM, CYAN, PINK, AMBER, VIOLETT]), 0.22 + rnd() * 0.18);
        const side = rnd() < 0.5;
        const za = side ? z0 + 1.7 : KANAL_Z - 1 + rnd() * 2;
        const zb = side ? KANAL_Z + 1 - rnd() * 2 : z1 - 1.7;
        qo(fas, [xr, GY + 0.33, za], [xr + wr, GY + 0.33, za], [xr + wr, GY + 0.33, zb], [xr, GY + 0.33, zb], col, [xr, GY - 5, za]);
      }
      // Brücke an der Querstraße
      const bx = xb - (xb === xEnd ? 0 : STR / 2);
      if (xb < xEnd) {
        bau.box(bx, GY + 1.25, KANAL_Z, STR - 2, 0.5, STR, C_BETON);
        for (const sg of [-1, 1]) fas.box(bx + sg * (STR / 2 - 1.2), GY + 2.1, KANAL_Z, 0.18, 0.18, STR, CYAN);
      }
      // Laternen am Kai
      for (let x2 = xa + 8; x2 < xb; x2 += 20) for (const zz of [z0 + 0.8, z1 - 0.8]) fas.punkt(x2, GY + 4.5, zz, 0.3, WARM);
    }
  }

  // =====================================================================================
  // Lufttaxis: feste Runden über den Straßen zwischen den Türmen
  // =====================================================================================
  interface Taxi {
    runde: Runde;
    v: number;
    s0: number;
    body: number;
    light: number;
  }
  const taxis: Taxi[] = [];
  {
    const taxiBody = (lack: RGB): THREE.BufferGeometry => {
      const b = new MeshBuilder();
      // lokales +z vorn, +y oben; 1,3-fach (aus der Ferne lesbar)
      b.box(0, 0.75, 0, 2.3, 1.0, 4.4, lack);
      b.box(0, 1.45, -0.3, 1.9, 0.6, 2.6, shade(lack, 0.92));
      b.box(0, 0.7, 2.45, 1.8, 0.6, 0.6, shade(lack, 0.95));
      for (const sx2 of [-1, 1]) {
        for (const sz2 of [-1, 1]) {
          b.box(sx2 * 1.75, 0.55, sz2 * 1.6, 1.2, 0.3, 1.2, TAXI_DUNKEL);
          b.box(sx2 * 1.3, 0.62, sz2 * 1.6, 0.7, 0.12, 0.16, TAXI_DUNKEL);
        }
      }
      const g = b.build();
      g.scale(1.3, 1.3, 1.3);
      g.computeVertexNormals();
      return g;
    };
    const taxiLight = (taxi: boolean): THREE.BufferGeometry => {
      const n = new Netz();
      // Kabine: warmes Licht hinter Glas
      n.box(0, 1.45, -0.3, 1.95, 0.42, 2.3, shade(WARM, 0.7));
      n.box(0, 0.75, 2.76, 1.4, 0.18, 0.04, WEISS);
      n.box(0, 0.8, -2.22, 1.6, 0.16, 0.04, ROT);
      for (const sx2 of [-1, 1]) for (const sz2 of [-1, 1]) n.box(sx2 * 1.75, 0.38, sz2 * 1.6, 0.95, 0.05, 0.95, taxi ? CYAN : PINK);
      if (taxi) n.box(0, 1.9, -0.1, 0.9, 0.3, 0.4, GELB);
      const g = n.build();
      g.scale(1.3, 1.3, 1.3);
      return g;
    };
    const want = hi ? 7 : 4;
    const out = new Float64Array(5);
    // Viele Runden ausprobieren, die gültigen nach Sichtbarkeit von der Bahn aus ordnen
    const kand: { runde: Runde; y: number; score: number }[] = [];
    for (let tries = 0; tries < 700; tries++) {
      // Rechteck über Straßenmitten, 1–3 Blöcke je Richtung, mit runden Ecken
      const ax = kx0 + 1 + Math.floor(rnd() * (kx1 - kx0 - 3));
      const az = kz0 + 1 + Math.floor(rnd() * (kz1 - kz0 - 3));
      const bxk = ax + 1 + Math.floor(rnd() * 3);
      const bzk = az + 1 + Math.floor(rnd() * 2);
      const x0 = sx(ax);
      const x1 = sx(bxk);
      const z0 = sz(az);
      const z1 = sz(bzk);
      const y = GY + 30 + rnd() * 60;
      const rr = 9;
      const pts: V3[] = [];
      const corner = (cx: number, cz: number, a0: number): void => {
        for (let q = 0; q <= 4; q++) {
          const a = a0 + (q / 4) * (Math.PI / 2);
          pts.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]);
        }
      };
      corner(x1 - rr, z1 - rr, 0);
      corner(x0 + rr, z1 - rr, Math.PI / 2);
      corner(x0 + rr, z0 + rr, Math.PI);
      corner(x1 - rr, z0 + rr, Math.PI * 1.5);
      const runde = new Runde(pts);
      let ok = true;
      let seen = 0;
      let n = 0;
      for (let s = 0; s < runde.len && ok; s += 4) {
        runde.at(s, out);
        n++;
        const d = abst(out[0], out[2]);
        if (d > REICH - 20) ok = false;
        else if (pruefe(out[0], out[2], 4, 4, 0, y - 3, y + 4) > 0 && hit.bahn > 0) ok = false;
        else if (hoechstes(out[0], out[2], 5) > y - 5) ok = false;
        else if (brueckenBoxen.some((b) => Math.abs(out[0] - b.cx) < b.hw + 5 && Math.abs(out[2] - b.cz) < b.hd + 5 && y > b.y0 - 5 && y < b.y1 + 5)) ok = false;
        if (d < 60) seen++;
      }
      if (!ok || seen < 6) continue;
      kand.push({ runde, y, score: seen / n + rnd() * 0.2 });
    }
    kand.sort((p, q) => q.score - p.score);
    for (const c of kand) {
      if (taxis.length >= want) break;
      const p0 = c.runde.pts[0];
      if (taxis.some((o) => Math.abs(o.runde.pts[0][1] - c.y) < 8 && Math.abs(o.runde.pts[0][0] - p0[0]) < 80 && Math.abs(o.runde.pts[0][2] - p0[2]) < 80)) continue;
      const isTaxi = taxis.length % 3 !== 2;
      taxis.push({
        runde: c.runde,
        v: (12 + rnd() * 7) * (rnd() < 0.5 ? 1 : -1),
        s0: rnd() * c.runde.len,
        body: taxiB.add(taxiBody(isTaxi ? TAXI_LACK : TAXI_DUNKEL)),
        light: taxiL.add(taxiLight(isTaxi)),
      });
    }
  }
  // Warnlichter: alle roten gemeinsam ein Teil, die weißen Blitzer ein zweiter
  const warnTeil = (pts: V3[], col: RGB, r: number): number => {
    const n = new Netz();
    for (const p of pts) n.punkt(p[0], p[1], p[2], r, col);
    if (n.empty) n.punkt(0, -1000, 0, 0.01, col);
    return taxiL.add(n.build());
  };
  const teilRot = warnTeil(warn, ROT, 0.55);
  const teilBlitz = warnTeil(blitz, WEISS, 0.9);

  // =====================================================================================
  // Skyline am Horizont (ohne Nebel, Dunst in den Farben)
  // =====================================================================================
  {
    const cx = world.center.x;
    const cz = world.center.z;
    let spur = 0;
    for (let i = 0; i < T; i++) spur = Math.max(spur, Math.hypot(t.px[i] - cx, t.pz[i] - cz));
    // Ganz außerhalb der nahen Stadt: deren Häuser stehen höchstens REICH hinter der Bahn
    const R0 = spur + REICH + 70;
    const dunst = rgb(th.fog);
    const horiz = rgb(th.sky[2]);
    const nacht = rgb(th.sky[1]);
    const SIL = mixRgb(dunst, nacht, 0.35);
    const n = hi ? 120 : 75;
    for (let m = 0; m < n; m++) {
      const a = (m / n) * TAU + (rnd() - 0.5) * (TAU / n) * 1.6;
      const D = R0 + 40 + rnd() * 520;
      const w = 26 + rnd() * 50;
      const d = 26 + rnd() * 50;
      // Der ganze Fuß liegt außerhalb des Kreises um die Strecke.
      if (D - Math.hypot(w, d) / 2 < spur + 60) continue;
      const cl = noise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 1);
      const H = 60 + rnd() * 130 + Math.pow(cl, 3) * 260 + (rnd() < 0.04 ? 180 : 0);
      const x = cx + Math.cos(a) * D;
      const z = cz + Math.sin(a) * D;
      const yaw = a + (rnd() - 0.5) * 0.5;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const P = (lx: number, y: number, lz: number): V3 => [x + lx * c + lz * s, y, z - lx * s + lz * c];
      const haze = 0.35 + 0.4 * smooth((D - R0) / 520);
      // Oben etwas heller als der Nachthimmel (Dunst über der Stadt), unten im Lichtschein der Stadt
      const top = mixRgb(SIL, horiz, 0.1 + haze * 0.22);
      const bot = mixRgb(SIL, horiz, 0.72);
      const y0 = GY - 10;
      const tiers: [number, number, number, number][] = [[w / 2, d / 2, y0, GY + H]];
      if (H > 220 && rnd() < 0.6) {
        tiers[0][3] = GY + H * 0.72;
        tiers.push([w * 0.32, d * 0.32, GY + H * 0.72, GY + H]);
      }
      for (const [hw2, hd2, ya, yb] of tiers) {
        const C: V3[] = [P(-hw2, 0, hd2), P(hw2, 0, hd2), P(hw2, 0, -hd2), P(-hw2, 0, -hd2)];
        for (let k = 0; k < 4; k++) {
          const A = C[k];
          const B = C[(k + 1) % 4];
          // nur Seiten, die zur Stadt schauen
          const mxx = (A[0] + B[0]) / 2;
          const mzz = (A[2] + B[2]) / 2;
          const nx = mxx - x;
          const nz = mzz - z;
          if (nx * (cx - mxx) + nz * (cz - mzz) < -0.15 * Math.hypot(nx, nz) * Math.hypot(cx - mxx, cz - mzz)) continue;
          const kb = (ya - y0) / (GY + H - y0);
          const ca = mixRgb(bot, top, smooth(kb * 1.6));
          const cb2 = mixRgb(bot, top, smooth(((yb - y0) / (GY + H - y0)) * 1.6));
          const a0: V3 = [A[0], ya, A[2]];
          const b0: V3 = [B[0], ya, B[2]];
          const b1: V3 = [B[0], yb, B[2]];
          const a1: V3 = [A[0], yb, A[2]];
          if (weg(a0, b0, b1, [x, ya, z])) fern.quadUv(a0, b0, b1, a1, ca, ca, cb2, cb2, 0, 0, 0, 0);
          else fern.quadUv(b0, a0, a1, b1, ca, ca, cb2, cb2, 0, 0, 0, 0);
          // Fensterreihen: schwache Bänder vor der Fläche
          const L = Math.hypot(B[0] - A[0], B[2] - A[2]);
          const ox = (nx / Math.hypot(nx, nz)) * 0.4;
          const oz = (nz / Math.hypot(nx, nz)) * 0.4;
          const rows = hi ? 7 : 4;
          for (let r2 = 0; r2 < rows; r2++) {
            if (rnd() < 0.3) continue;
            const yy = ya + 6 + rnd() * (yb - ya - 10);
            const f0 = rnd() * 0.5;
            const f1 = f0 + 0.15 + rnd() * (0.85 - f0);
            const lc = mixRgb(pick([WARM, WARM, CYAN, WEISS, PINK, AMBER]), dunst, 0.45 + haze * 0.4);
            const p0: V3 = [A[0] + (B[0] - A[0]) * f0 + ox, yy, A[2] + (B[2] - A[2]) * f0 + oz];
            const p1: V3 = [A[0] + (B[0] - A[0]) * f1 + ox, yy, A[2] + (B[2] - A[2]) * f1 + oz];
            const hh = 1.2 + rnd() * 2.2 * (L / 60);
            if (weg(p0, p1, [p1[0], yy + hh, p1[2]], [x, yy, z])) fern.quad(p0, p1, [p1[0], yy + hh, p1[2]], [p0[0], yy + hh, p0[2]], lc);
            else fern.quad(p1, p0, [p0[0], yy + hh, p0[2]], [p1[0], yy + hh, p1[2]], lc);
          }
        }
      }
      // Spitze mit Warnlicht
      if (H > 250 && rnd() < 0.5) {
        const sp = 12 + rnd() * 30;
        const tp: V3 = [x, GY + H + sp, z];
        const r0 = Math.min(w, d) * 0.12;
        const base = [P(-r0, GY + H, r0), P(r0, GY + H, r0), P(r0, GY + H, -r0), P(-r0, GY + H, -r0)];
        for (let k = 0; k < 4; k++) {
          const A = base[k];
          const B = base[(k + 1) % 4];
          if (weg(A, B, tp, [x, GY + H, z])) fern.tri(A, B, tp, top);
          else fern.tri(B, A, tp, top);
        }
        fern.punkt(tp[0], tp[1] + 1, tp[2], 2.2, mixRgb(ROT, dunst, 0.25));
      } else if (rnd() < 0.4) fern.punkt(x, GY + H + 2, z, 1.8, mixRgb(ROT, dunst, 0.3));
    }
  }

  // =====================================================================================
  // Netze
  // =====================================================================================
  ico.dispose();
  const atlasTex = new THREE.CanvasTexture(atlas.canvas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.wrapT = THREE.RepeatWrapping;
  atlasTex.anisotropy = 4;
  disposables.push(atlasTex);
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  {
    const g = bau.build();
    const m = new THREE.Mesh(g, toon);
    m.name = 'Stadt';
    group.add(m);
    disposables.push(g);
  }
  {
    const g = fas.build();
    const mat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true });
    const m = new THREE.Mesh(g, mat);
    m.name = 'Fassaden';
    group.add(m);
    disposables.push(g, mat);
  }
  if (!fern.empty) {
    const g = fern.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const m = new THREE.Mesh(g, mat);
    m.name = 'Skyline';
    m.renderOrder = -7;
    group.add(m);
    disposables.push(g, mat);
  }
  const holoTex = new THREE.CanvasTexture(zeichneLaufschrift(S));
  holoTex.colorSpace = THREE.SRGBColorSpace;
  holoTex.wrapS = THREE.RepeatWrapping;
  holoTex.anisotropy = 4;
  const holoMat = new THREE.MeshBasicMaterial({ map: holoTex, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  disposables.push(holoTex, holoMat);
  if (!holo.empty) {
    const g = holo.build();
    const m = new THREE.Mesh(g, holoMat);
    m.name = 'Laufschriften';
    m.renderOrder = 2;
    group.add(m);
    disposables.push(g);
  }
  const stromTex = new THREE.CanvasTexture(zeichneVerkehr(S));
  stromTex.colorSpace = THREE.SRGBColorSpace;
  stromTex.wrapT = THREE.RepeatWrapping;
  disposables.push(stromTex);
  if (!strom.empty) {
    const g = strom.build();
    const mat = new THREE.MeshBasicMaterial({ map: stromTex, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(g, mat);
    m.name = 'Lichtströme';
    m.renderOrder = 1;
    group.add(m);
    disposables.push(g, mat);
  }
  const taxiGeo = taxiB.build();
  const taxiMesh = new THREE.Mesh(taxiGeo, toon);
  taxiMesh.name = 'Lufttaxis';
  taxiMesh.frustumCulled = false;
  group.add(taxiMesh);
  const lichtGeo = taxiL.build();
  const lichtMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lichtMesh = new THREE.Mesh(lichtGeo, lichtMat);
  lichtMesh.name = 'Lichter';
  lichtMesh.frustumCulled = false;
  group.add(lichtMesh);
  disposables.push(taxiGeo, lichtGeo, lichtMat);

  // =====================================================================================
  // Bewegung
  // =====================================================================================
  const out = new Float64Array(5);
  const nxt = new Float64Array(5);
  const ident = new THREE.Matrix4();
  const aus = new THREE.Matrix4().makeScale(0, 0, 0);
  let rotAn = -1;
  let blitzAn = -1;
  const update = (time: number): void => {
    stromTex.offset.y = -(((time * 13) / STROM_L) % 1);
    holoTex.offset.x = (time * 0.018) % 1;
    // Hologramme flackern ab und zu
    const fl = Math.sin(time * 0.37) > 0.93 ? (Math.sin(time * 41) > 0 ? 0.55 : 1) : 1;
    holoMat.color.setScalar(fl);
    for (const tx of taxis) {
      const s = tx.s0 + tx.v * time;
      tx.runde.at(s, out);
      tx.runde.at(s + Math.sign(tx.v) * 6, nxt);
      const dx = nxt[0] - out[0];
      const dz = nxt[2] - out[2];
      const yaw = Math.atan2(dx, dz);
      // In der Kurve nach innen geneigt
      const turn = Math.atan2(out[3] * nxt[4] - out[4] * nxt[3], out[3] * nxt[3] + out[4] * nxt[4]);
      e4.set(0, yaw, -Math.sign(tx.v) * turn * 1.2 + Math.sin(time * 0.9 + tx.s0) * 0.03, 'YXZ');
      q4.setFromEuler(e4);
      m4.compose(v4.set(out[0], out[1] + Math.sin(time * 0.7 + tx.s0) * 0.6, out[2]), q4, s4.set(1, 1, 1));
      taxiB.set(tx.body, m4);
      taxiL.set(tx.light, m4);
    }
    const rot = time % 1.7 < 0.6 ? 1 : 0;
    if (rot !== rotAn) {
      taxiL.set(teilRot, rot ? ident : aus);
      rotAn = rot;
    }
    const bl = time % 1.25 < 0.09 ? 1 : 0;
    if (bl !== blitzAn) {
      taxiL.set(teilBlitz, bl ? ident : aus);
      blitzAn = bl;
    }
    taxiB.update();
    taxiL.update();
  };
  update(0);

  return {
    group,
    update(time: number): void {
      update(time);
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
