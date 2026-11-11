#!/usr/bin/env node
// Streckenbilder – erzeugt je Strecke ein Vorschaubild (640 × 360, JPEG) für das
// Auslosen der nächsten Strecke („Glücksrad“-Streifen) und für die Strecken-Wahl.
//
// Das Skript startet das gebaute Spiel in Chromium (Playwright), eröffnet allein
// ein Rennen auf der jeweiligen Strecke, stellt die Fotokamera der Test-Hilfen
// (window.__kart.photo) auf einen festen Standort, setzt KI-Karts ins Bild
// (window.__kart.place), blendet alle Bedienelemente aus und fotografiert nur die
// Zeichenfläche: 1280 × 720 aufgenommen, sauber auf 640 × 360 verkleinert
// (glättet die Kanten), als JPEG gespeichert (höchstens etwa 60 KB).
//
// Aufruf (in kart-src/):
//   node tools/streckenbilder.cjs [Nummern …] [--base URL] [--signal HOST:PORT] [--out ORDNER] [--png] [--plan DATEI.json]
//     Nummern     Strecken (0 = erste, wie TRACK_DEFS in src/game/tracks.ts); ohne = alle
//     --base      Adresse des gebauten Spiels (Standard http://127.0.0.1:4173/)
//     --signal    PeerJS-Signalserver (Standard 127.0.0.1:9000)
//     --out       Ausgabeordner (Standard public/karten, relativ zu kart-src)
//     --png       zusätzlich das ungeschrumpfte PNG (1280 × 720) behalten
//     --plan      JSON-Datei { "<id>": Aufnahme | [Aufnahme, …] } – ersetzt die Aufnahmen
//                 unten probeweise; bei mehreren entstehen <id>-1.jpg, <id>-2.jpg … (zum Ausprobieren)
//   Beispiel:  npx vite build && (npx vite preview &) && node tools/streckenbilder.cjs 3 5
//
// Voraussetzungen:
//   - das Spiel gebaut und ausgeliefert (z. B. `npx vite build && npx vite preview` → Port 4173)
//   - ein PeerJS-Signalserver (z. B. `npx peerjs --port 9000 --path / --host 0.0.0.0`)
//   - Playwright mit Chromium (require('playwright')); läuft auch ohne Grafikkarte
//     (SwiftShader), dann aber langsam: rund 20–30 Sekunden je Strecke
//   - python3 mit PIL (Pillow) zum Verkleinern und Umwandeln nach JPEG
//
// Eine neue Strecke bekommt ihr Bild über einen weiteren Eintrag in SHOTS (Schlüssel =
// `id` der Strecke). Ohne Eintrag gibt es die Standardaufnahme: erhöht hinter der
// Startlinie mit Blick die Strecke entlang, zwei Karts vor der Kamera.

'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

// ---------------------------------------------------------------------------
// Die Aufnahmen
//
// Punkte (from = Kamera-Standort, to = Blickpunkt) als [Meter, seitlich, Höhe] –
// genau die Angaben von __kart.spot(): Meter ab der Startlinie auf der
// Hauptstrecke, seitlicher Abstand von der Mitte (+ = rechts in Fahrtrichtung),
// Höhe über der Fahrbahn. Negative Meter zählen vom Ende der Runde zurück.
// Statt dessen geht auch { xyz: [x, y, z] } (Weltkoordinaten) oder
// { kart: Slot, up: Höhe } (wo ein gesetztes Kart gerade steht).
//   fov      senkrechter Bildwinkel in Grad (Standard 50)
//   karts    [Slot, Meter, seitlich, Abzweigung, Höhe] – Slot 1–3 sind die KI-Gegner,
//            0 das eigene Kart; Abzweigung −1 = Hauptstrecke, sonst Nummer der
//            Abzweigung (Meter dann ab deren Anfang); Höhe > 0 lässt das Kart
//            schweben (Sprung, Flug). Die Karts werden bis zum Foto immer
//            wieder an ihre Stelle gesetzt, stehen also still.
//   moment   { period, phase, t } – vor dem Foto warten, bis eine Mechanik mit diesem
//            Takt (period/phase in Sekunden wie in der Streckendatei) t Sekunden in
//            ihrem Zyklus steht. Zyklus 0 = Beginn der Gefahr: Presse schlägt auf,
//            Geysir/Blasenschlot bricht aus, Lawine geht nieder (mechanics.ts pulseCycle).
//   when     JS-Ausdruck (auf der Seite, mit __kart), auf den vor dem Foto gewartet wird –
//            z. B. bis der Stadtverkehr an der richtigen Stelle ist
//   settle   Millisekunden, die nach dem Ausrichten noch gewartet wird (Standard 1500)
// Ein Stützpunkt der Streckendatei sind etwa track().length / Zahl der Stützpunkte Meter;
// genauer (die Stützpunkte liegen ungleich dicht): den Punkt suchen, an dem spot() dem
// Stützpunkt (mal `scale` der Strecke) am nächsten kommt.
// ---------------------------------------------------------------------------

const SHOTS = {
  // Werkshof: die zweite Reihe Stampfpressen auf der Gegengerade (Stützpunkt 21,5 ≈ 709 m), von
  // schräg vorn links; drei Karts sind gerade durch, die mittlere Presse schlägt eben auf (Staub).
  // Dahinter Fabrikhalle, Schornstein und Kran in der Abendsonne.
  werkshof: {
    from: [735, -12, 6],
    to: [704, 1, 1.8],
    fov: 46,
    karts: [
      [1, 712, 3],
      [2, 700, -4.3],
      [3, 719, -2],
    ],
    moment: { period: 3.6, phase: 1.2, t: 0.15 },
  },
  // Möwenklippe: der Holzsteg ohne Geländer draußen auf dem Meer, vom Wasser aus gegen das Land;
  // drei Karts auf der Stegwende (Stützpunkt 5–9 ≈ 120–180 m), hinten Strand, Kiefern, Leuchtturm.
  klippe: {
    from: { xyz: [216, 6, -192] },
    to: { xyz: [192, 1, -120] },
    fov: 50,
    karts: [
      [1, 148, 0],
      [2, 125, -1],
      [3, 172, 1],
    ],
  },
  // Glutkessel: auf der Felsbrücke (Stützpunkt 27,2 ≈ 1193 m) bricht ein Geysir aus, ein Kart fährt
  // daran vorbei; ringsum der Lavasee, dahinter der Vulkan. Blick zurück gegen die Fahrtrichtung.
  glut: {
    from: [1225, -11, 7],
    to: [1185, 1, 5],
    fov: 56,
    karts: [
      [1, 1203, 2],
      [2, 1190, 3],
    ],
    moment: { period: 5, phase: 1.2, t: 0.15 },
  },
  // Nachtschicht: Hochstraße kurz nach dem Start (≈ 200 m), Neonstadt bei Nacht; eine Straßenbahn
  // fährt neben zwei Karts her (gewartet, bis sie im Bild ist). Von schräg vorn rechts.
  nacht: {
    from: [230, 14, 7],
    to: [203, -1, 2],
    fov: 42,
    karts: [
      [1, 200, 0],
      [2, 195, -2.5],
    ],
    when: '__kart.traffic().some((v) => v.kind === 3 && v.at > 206 && v.at < 214)',
  },
  // Wolkenwerft: Flugstrecke zum Ballonhafen (Stützpunkt 9,9 ≈ 511 m) – ein Kart gleitet durch den
  // Schubring, ein zweites dahinter; Aufwind, Ballons, Luftschiff und der Steg der Werft.
  wolken: {
    from: [485, 10, 7],
    to: [530, -2, 2],
    fov: 45,
    karts: [
      [1, 511, -6, -1, 4],
      [2, 530, 4, -1, 1],
    ],
  },
  // Tiefseeriff: Korallengarten unter Wasser mit Blasenschlot (Stützpunkt 10,4 ≈ 510 m) beim
  // Ausbruch, dahinter die Schubringe; ein Kart steigt in den Blasen auf, eins fährt am Grund.
  riff: {
    from: [502, 14, 5],
    to: [520, -3, 3],
    fov: 46,
    karts: [
      [1, 511, -4, -1, 2.5],
      [2, 515, 1.5, -1, 0],
    ],
    moment: { period: 5, phase: 0, t: 1 },
  },
  // Eiszapfen-Pass: die erste Lawine (Stützpunkt 11,5 ≈ 497 m) geht gerade nieder, Warnampeln
  // leuchten, zwei Karts kurz davor im Schnee; Tannen und Gipfel dahinter.
  eis: {
    from: [465, -16, 10],
    to: [503, 3, -0.5],
    fov: 56,
    karts: [
      [1, 486, -1.5],
      [2, 481, 3],
    ],
    moment: { period: 10, phase: 3, t: 1.2 },
  },
  // Mondbasis: Massenbeschleuniger (Stützpunkt 20,85 ≈ 1232 m) – ein Kart auf der Sprungplatte,
  // eins fliegt über der Schlucht durch den Schubring; dahinter die Kuppel der Basis.
  mond: {
    from: [1205, -6, 16],
    to: [1256, 0, 0.5],
    fov: 45,
    karts: [
      [1, 1267, 0, -1, 5.2],
      [2, 1236, 1],
    ],
  },
};

/** Standardaufnahme für Strecken ohne eigenen Eintrag. */
const DEFAULT_SHOT = {
  from: [-28, -6, 9],
  to: [40, 1, 0],
  fov: 55,
  karts: [
    [1, 12, -2.5, -1],
    [2, 20, 3, -1],
  ],
};

// ---------------------------------------------------------------------------

const HIDE_CSS =
  '#race-hud, #race-title, #countdown, #race-banner, #finish-flag, #hud-note, #fps, .hud-menu, #results, #menu, #banner, ' +
  '#smoke-veil, #debug, #gfx-note { display: none !important; }';

const KART_SRC = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const o = { base: 'http://127.0.0.1:4173/', signal: '127.0.0.1:9000', out: path.join(KART_SRC, 'public', 'karten'), png: false, plan: null, tracks: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') o.base = argv[++i];
    else if (a === '--signal') o.signal = argv[++i];
    else if (a === '--out') o.out = path.resolve(KART_SRC, argv[++i]);
    else if (a === '--png') o.png = true;
    else if (a === '--plan') o.plan = JSON.parse(fs.readFileSync(argv[++i], 'utf8'));
    else if (/^\d+$/.test(a)) o.tracks.push(Number(a));
    else throw new Error('Unbekanntes Argument: ' + a);
  }
  if (!o.base.endsWith('/')) o.base += '/';
  return o;
}

/** Strecken-IDs in der Reihenfolge von TRACK_DEFS, aus den Quelltexten gelesen (ohne TypeScript zu übersetzen). */
function trackIds() {
  const list = fs.readFileSync(path.join(KART_SRC, 'src', 'game', 'tracks.ts'), 'utf8');
  const order = (list.match(/TRACK_DEFS[^=]*=\s*\[([^\]]*)\]/) || [])[1];
  if (!order) throw new Error('TRACK_DEFS nicht gefunden');
  const ids = {};
  for (const f of fs.readdirSync(path.join(KART_SRC, 'src', 'game', 'tracks'))) {
    const src = fs.readFileSync(path.join(KART_SRC, 'src', 'game', 'tracks', f), 'utf8');
    const m = src.match(/export const (\w+)\s*:\s*TrackDef\s*=\s*\{\s*id:\s*'([^']+)'/);
    if (m) ids[m[1]] = m[2];
  }
  return order.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ids[name] || name.toLowerCase());
}

/** Ein Rennen allein auf Strecke `index` eröffnen und warten, bis es läuft. */
async function openRace(browser, opt, index) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  // Namensschilder über den KI-Karts sind Sprites in der 3D-Szene (raceScene.ts, labelSprite) und lassen sich
  // nicht per CSS ausblenden: ihr Text wird hier gar nicht erst gezeichnet. Erkennbar an der Schildgröße
  // 256 × 64 und der Schrift; ändert sich das im Spiel, erscheinen die Schilder wieder – im Bild prüfen.
  await page.addInitScript(() => {
    const P = CanvasRenderingContext2D.prototype;
    for (const fn of ['fillText', 'strokeText']) {
      const orig = P[fn];
      P[fn] = function (...a) {
        if (this.canvas && this.canvas.width === 256 && this.canvas.height === 64 && /^900 34px/.test(this.font)) return;
        return orig.apply(this, a);
      };
    }
  });
  page.on('pageerror', (e) => console.log('  Seitenfehler:', e.message));
  await page.goto(`${opt.base}?signal=${opt.signal}&debug=0&q=high&mute=1&laps=3&track=${index}`);
  await page.waitForSelector('#app[data-view="home"]', { timeout: 60000 });
  await page.fill('#in-name', 'Foto');
  await page.click('#btn-create');
  await page.waitForSelector('#app[data-view="lobby"]', { timeout: 60000 });
  await page.click('#btn-start');
  await page.waitForSelector('#app[data-view="game"]', { timeout: 60000 });
  await page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1, null, { timeout: 120000, polling: 250 });
  await page.addStyleTag({ content: HIDE_CSS });
  // Keine Gegenstände: sonst trifft ein frei fahrender KI-Gegner die Karts im Bild (Blitz, Öl …).
  await page.evaluate(() => {
    window.__fotoNoItems = setInterval(() => {
      for (let s = 0; s < 4; s++) window.__kart.giveItem(s, 0);
    }, 50);
  });
  return page;
}

/** Eine Aufnahme ausrichten und die Zeichenfläche als PNG speichern. */
async function shoot(page, shot, pngPath) {
  await page.evaluate((s) => {
    const k = window.__kart;
    const len = k.track().length;
    const ents = () => k.entities();
    const where = (p) => {
      if (Array.isArray(p)) return k.spot(p[0] < 0 ? p[0] + len : p[0], p[1] || 0, p[2] || 0);
      if (p.xyz) return p.xyz;
      const e = ents().find((x) => x.slot === p.kart);
      if (!e) throw new Error('Kart ' + p.kart + ' nicht gefunden');
      return [e.x + (p.dx || 0), e.y + (p.up || 0), e.z + (p.dz || 0)];
    };
    const karts = s.karts || [];
    const put = () => {
      for (const [slot, m, lat, branch, up] of karts) k.place(slot, m < 0 && (branch ?? -1) < 0 ? m + len : m, lat || 0, branch ?? -1, up || 0);
    };
    clearInterval(window.__fotoHold);
    put();
    window.__fotoHold = setInterval(put, 30);
    window.__fotoAim = () => k.photo(where(s.from), where(s.to), s.fov || 50);
    window.__fotoAim();
  }, shot);
  await sleep(shot.settle ?? 1500);
  if (shot.moment) {
    // Bis kurz vor den Zeitpunkt schlafen, dann Bild für Bild auf ihn warten (bei ~10 Bildern/s
    // ist das Fenster eine Fünftelsekunde breit).
    // Rennzeit in Sekunden = race().time / 60 (Ticks); Takt wie in mechanics.ts pulseCycle: (Zeit + phase) mod period.
    const { period, phase = 0, t = 0 } = shot.moment;
    const at = t - phase;
    const now = await page.evaluate(() => window.__kart.race().time / 60);
    const ahead = (((at - now) % period) + period) % period;
    if (ahead > 0.6) await sleep((ahead - 0.4) * 1000);
    await page.waitForFunction(
      ([p, a]) => {
        const d = (((window.__kart.race().time / 60 - a) % p) + p) % p;
        return d < 0.2;
      },
      [period, at],
      { timeout: (period + 5) * 1000, polling: 'raf' },
    );
  }
  if (shot.when) {
    await page.waitForFunction(new Function('return (' + shot.when + ');'), null, { timeout: 90000, polling: 'raf' });
  }
  // Blick noch einmal setzen (für Ziele, die an einem Kart hängen) und dann ohne Umweg fotografieren.
  await page.evaluate(() => window.__fotoAim());
  await page.locator('canvas#stage').screenshot({ path: pngPath });
  await page.evaluate(() => clearInterval(window.__fotoHold));
}

/** PNG (1280 × 720) → JPEG 640 × 360, Qualität so hoch wie die Größengrenze erlaubt. */
function toJpeg(pngPath, jpgPath, maxBytes = 60000) {
  const py = `
import sys
from io import BytesIO
from PIL import Image
src, dst, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
w, h = im.size
tw = round(h * 16 / 9)
if tw < w:
    im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h))
elif tw > w:
    th = round(w * 9 / 16)
    im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
im = im.resize((640, 360), Image.LANCZOS)
for q in range(88, 40, -3):
    buf = BytesIO()
    im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=2 if q < 80 else 0)
    if buf.tell() <= limit:
        break
open(dst, 'wb').write(buf.getvalue())
print(q, buf.tell())
`;
  const out = execFileSync('python3', ['-c', py, pngPath, jpgPath, String(maxBytes)], { encoding: 'utf8' }).trim();
  const [q, bytes] = out.split(' ').map(Number);
  return { q, bytes };
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const ids = trackIds();
  const which = opt.tracks.length ? opt.tracks : ids.map((_, i) => i);
  fs.mkdirSync(opt.out, { recursive: true });
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    for (const index of which) {
      const id = ids[index];
      if (!id) throw new Error('Keine Strecke Nummer ' + index);
      const planned = opt.plan && opt.plan[id];
      const shots = planned ? [].concat(planned) : [SHOTS[id] || DEFAULT_SHOT];
      const t0 = Date.now();
      const page = await openRace(browser, opt, index);
      const info = await page.evaluate(() => window.__kart.track());
      if (info.index !== index) throw new Error(`Strecke ${index} verlangt, ${info.index} geladen`);
      for (let n = 0; n < shots.length; n++) {
        const name = shots.length > 1 ? `${id}-${n + 1}` : id;
        const png = path.join(opt.out, name + '.png');
        await shoot(page, shots[n], png);
        const { q, bytes } = toJpeg(png, path.join(opt.out, name + '.jpg'));
        if (!opt.png) fs.unlinkSync(png);
        console.log(`${name}.jpg  ${info.name}  ${(bytes / 1024).toFixed(1)} KB (Qualität ${q})${SHOTS[id] || planned ? '' : '  [Standardaufnahme]'}`);
      }
      console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s, Länge ${info.length.toFixed(0)} m)`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FEHLER:', e.message);
    process.exit(1);
  });
}

module.exports = { SHOTS, DEFAULT_SHOT, openRace, shoot, toJpeg, trackIds };
