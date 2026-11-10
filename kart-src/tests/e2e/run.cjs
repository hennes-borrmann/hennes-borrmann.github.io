// End-to-End-Test von Phase 1 in echtem Chromium (ohne Bildschirm).
//
// Was hier läuft, ist echtes WebRTC – aber alles auf einem Rechner über die
// lokale Schleife. Der Test beweist Abläufe und Logik (Lobby, Kopplung,
// Synchronisation, Wiederverbindung). Er sagt NICHTS über echte Netze, Safari,
// iOS-Berechtigungen oder echte Neigungssensoren.
//
// Voraussetzungen (drei Terminals im Ordner kart-src/):
//   npm run signal                         lokaler PeerJS-Server auf Port 9000
//   npm run build && npm run preview -- --port 4173
//   node tests/e2e/run.cjs                 braucht ein installiertes Playwright
//
// Umgebungsvariablen: BASE, SIGNAL, SHOT_DIR (Ordner für Screenshots), ONLY (Teilmenge, z. B. "sync,reconnect")

const { chromium, devices } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const SIGNAL = process.env.SIGNAL || '127.0.0.1:9000';
const SHOTS = process.env.SHOT_DIR || null;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`);
}
function section(title) {
  console.log(`\n== ${title}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wants = (key) => !ONLY || ONLY.includes(key);

/** beta/gamma für "quer gehalten, Display um `back` Grad nach hinten gekippt, wie ein Lenkrad um `wheel` Grad gedreht". */
function hold(side, back, wheel) {
  const rad = Math.PI / 180;
  const up = {
    x: side * Math.cos(wheel * rad) * Math.cos(back * rad),
    y: side * Math.sin(wheel * rad) * Math.cos(back * rad),
    z: Math.sin(back * rad),
  };
  return { beta: Math.asin(up.y) / rad, gamma: Math.atan2(-up.x, up.z) / rad };
}

let browser;

async function openScreen(name, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`   [${name}] SEITENFEHLER ${e.message}`));
  if (process.env.VERBOSE) {
    page.on('console', (m) => {
      if (/\[link\]|\[endpoint\]/.test(m.text())) console.log(`        ${new Date().toISOString().slice(17, 23)} [${name}] ${m.text()}`);
    });
  }
  await page.goto(`${BASE}?signal=${SIGNAL}${query}`);
  return { ctx, page, name };
}

const kart = (page, expr) => page.evaluate(`window.__kart.${expr}`);
const ctl = (page, expr) => page.evaluate(`window.__ctl.${expr}`);

/**
 * Simuliertes Handy: lädt die Controller-Seite und speist Neigungswerte ein.
 * Die Werte kommen als künstliche deviceorientation-Ereignisse mit 60 Hz aus
 * der Seite selbst (die Sensor-Simulation von Chromium liefert ohne Bildschirm
 * keine Werte). Geprüft wird damit unser Code ab dem Ereignis, nicht der Sensor.
 */
async function openPhone(name, pairUrl, device = devices['iPhone 13'], side = 1, sensor = true) {
  const ctx = await browser.newContext({ ...device });
  if (sensor) await ctx.addInitScript(() => {
    window.__hold = { beta: 0, gamma: -70 };
    let i = 0;
    setInterval(() => {
      const n = Math.sin(i++ * 1.7) * 0.05;
      window.dispatchEvent(
        new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: window.__hold.beta + n, gamma: window.__hold.gamma }),
      );
    }, 1000 / 60);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`   [${name}] SEITENFEHLER ${e.message}`));
  const cdp = await ctx.newCDPSession(page);
  const phone = { ctx, page, cdp, name, back: 20, side, touches: new Map(), _wheel: 0 };
  const apply = () => {
    const h = hold(phone.side, phone.back, phone._wheel);
    return page.evaluate((v) => (window.__hold = v), h).catch(() => undefined);
  };
  // phone.wheel = Grad setzt die Lenkrad-Drehung des Handys.
  Object.defineProperty(phone, 'wheel', {
    get: () => phone._wheel,
    set: (v) => {
      phone._wheel = v;
      void apply();
    },
  });
  phone.apply = apply;
  await page.goto(pairUrl);
  await apply();
  return phone;
}

async function startPhone(phone) {
  await phone.page.waitForSelector('#ctl[data-screen="start"]');
  await phone.page.waitForFunction(() => window.__ctl && window.__ctl.connected(), null, { timeout: 20000 });
  await phone.page.click('#btn-start');
  await phone.page.waitForSelector('#ctl[data-screen="calibrate"]', { timeout: 5000 });
  await sleep(300);
  await phone.page.click('#btn-calibrate');
  await phone.page.waitForSelector('#ctl[data-screen="pad"]');
}

async function touchSet(phone) {
  const points = [...phone.touches.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id }));
  await phone.cdp.send('Input.dispatchTouchEvent', { type: points.length ? 'touchMove' : 'touchEnd', touchPoints: points });
}

async function press(phone, btn) {
  const r = await phone.page.evaluate((b) => {
    const el = document.querySelector(`[data-btn="${b}"]`);
    const q = el.getBoundingClientRect();
    return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  }, btn);
  const id = { gas: 1, brake: 2, drift: 3, item: 4 }[btn];
  phone.touches.set(id, r);
  const points = [...phone.touches.entries()].map(([pid, p]) => ({ x: p.x, y: p.y, id: pid }));
  await phone.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
}

async function release(phone, btn) {
  const id = { gas: 1, brake: 2, drift: 3, item: 4 }[btn];
  phone.touches.delete(id);
  const points = [...phone.touches.entries()].map(([pid, p]) => ({ x: p.x, y: p.y, id: pid }));
  await phone.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: points });
}

async function closePhone(phone) {
  await phone.ctx.close();
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

async function createLobby(screen, name) {
  await screen.page.waitForSelector('#app[data-view="home"]');
  await screen.page.fill('#in-name', name);
  await screen.page.click('#btn-create');
  await screen.page.waitForSelector('#app[data-view="lobby"]', { timeout: 15000 });
  return (await screen.page.textContent('#lobby-code')).trim();
}

async function joinLobby(screen, name, code) {
  await screen.page.waitForSelector('#app[data-view="home"]');
  await screen.page.fill('#in-name', name);
  if (code) await screen.page.fill('#in-code', code);
  await screen.page.click('#btn-join');
}

async function shot(page, file) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${file}` });
}

// ---------------------------------------------------------------------------

async function main() {
  browser = await chromium.launch({
    args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });

  // === Lobby und Kopplung ===================================================
  section('Lobby erstellen, beitreten, Controller koppeln');
  const host = await openScreen('host');
  const code = await createLobby(host, 'Anna');
  check('Host bekommt einen 5-stelligen Raumcode', /^[CDFGHJKMNPQRTVWX34679]{5}$/.test(code), code);

  const inviteUrl = await kart(host.page, 'inviteUrl()');
  const client = await openScreen('client');
  await client.page.goto(inviteUrl);
  await client.page.waitForSelector('#app[data-view="home"]');
  check('Einladungslink füllt den Raumcode vor', (await client.page.inputValue('#in-code')) === code);
  await joinLobby(client, 'Ben', null);
  await client.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
  check('Mitspieler landet in der Lobby', true);
  check('Mitspieler hat Platz 2', (await kart(client.page, 'slot()')) === 1);

  await host.page.waitForFunction(() => window.__kart.lobby().players.length === 2);
  let lobby = await kart(host.page, 'lobby()');
  check('Host sieht beide Spieler', lobby.players.map((p) => p.name).join(',') === 'Anna,Ben', lobby.players.map((p) => p.name).join(', '));

  const phoneA = await openPhone('handy-A', await kart(host.page, 'pairUrl()'));
  const phoneB = await openPhone('handy-B', await kart(client.page, 'pairUrl()'), devices['Pixel 5 landscape'], -1);
  await startPhone(phoneA);
  await startPhone(phoneB);
  check('Beide Handys durchlaufen Start → Kalibrieren → Tasten', true);
  check('Handy A (hochkant gesperrt) dreht die Oberfläche selbst', (await phoneA.page.evaluate(() => document.documentElement.dataset.rot)) === 'cw');
  check('Handy B (Querformat) braucht keine Drehung', (await phoneB.page.evaluate(() => document.documentElement.dataset.rot)) === 'none');
  await shot(phoneA.page, 'phone-pad-rotated.png');
  await shot(phoneB.page, 'phone-pad-landscape.png');

  await host.page.waitForFunction(() => {
    const p = window.__kart.lobby().players;
    return p.length === 2 && p.every((x) => x.controller);
  }, null, { timeout: 10000 });
  check('Lobby zeigt bei beiden „Controller verbunden“', true);

  await sleep(2600);
  const ctrlA = await kart(host.page, 'controller()');
  check('Handy→Bildschirm: unreliable Kanal aktiv', ctrlA.unreliable === true);
  check('Handy→Bildschirm: Weg erkannt', ctrlA.path && ctrlA.path.kind === 'direct', JSON.stringify(ctrlA.path));
  const hostLink = await kart(client.page, 'hostLink()');
  check('Bildschirm→Host: unreliable Kanal aktiv', hostLink.unreliable === true);
  check('Bildschirm→Host: Weg erkannt', hostLink.path && hostLink.path.kind === 'direct', JSON.stringify(hostLink.path));
  const ratesA = await kart(host.page, 'rates()');
  check('Eingaberate Handy A ≥ 50/s', ratesA.ctrl >= 50, `${ratesA.ctrl}/s, Handy meldet ${JSON.stringify(ctrlA.info)}`);
  lobby = await kart(host.page, 'lobby()');
  check('Ping pro Spieler wird gemessen', lobby.players[1].ping >= 0, `Ben ${lobby.players[1].ping} ms`);
  await shot(host.page, 'lobby-host.png');
  await shot(client.page, 'lobby-client.png');

  // === Lenkung ===============================================================
  section('Lenkwert und Tasten kommen am Bildschirm an');
  phoneA.wheel = 25;
  await sleep(500);
  let steer = await ctl(phoneA.page, 'steer()');
  check('Handy A nach rechts geneigt → positiver Lenkwert', steer > 0.4, steer.toFixed(2));
  phoneB.wheel = 25;
  await sleep(500);
  steer = await ctl(phoneB.page, 'steer()');
  check('Handy B (andere Querlage) nach rechts → ebenfalls positiv', steer > 0.4, steer.toFixed(2));
  phoneA.wheel = 0;
  phoneB.wheel = 0;

  // === Start =================================================================
  section('Bereit melden und starten');
  check('Start gesperrt, solange Ben nicht bereit ist', await host.page.isDisabled('#btn-start'));
  await client.page.click('#btn-ready');
  await host.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 5000 });
  check('Start frei, sobald alle bereit sind', true);
  check('Mitspieler hat keinen Start-Knopf', await client.page.isHidden('#btn-start'));
  await host.page.click('#btn-start');
  await host.page.waitForSelector('#app[data-view="game"]');
  await client.page.waitForSelector('#app[data-view="game"]', { timeout: 5000 });
  check('Beide Bildschirme wechseln in die Testszene', true);
  await client.page.waitForFunction(() => window.__kart.entities().length === 2, null, { timeout: 5000 });

  if (wants('sync')) {
    // === Fahren und Synchronität ============================================
    section('Fahren: beide Würfel auf beiden Bildschirmen');
    // Ohne Grafikkarte rendert Chromium sehr langsam; kleines Fenster hält die Bildrate brauchbar.
    await host.page.setViewportSize({ width: Number(process.env.VW || 240), height: Number(process.env.VH || 150) });
    await client.page.setViewportSize({ width: Number(process.env.VW || 240), height: Number(process.env.VH || 150) });
    // Aufzeichnung in den Seiten selbst: der Host die tatsächliche Fahrspur
    // (60 Hz), beide Bildschirme das, was sie in jedem Bild anzeigen.
    await host.page.evaluate(() => {
      window.__trail = { 0: [], 1: [] };
      window.__jumpAuth = 0;
      window.__rec = setInterval(() => {
        for (const s of [0, 1]) {
          const a = window.__kart.authoritative(s);
          if (a) window.__trail[s].push([a.x, a.z]);
        }
        const b = window.__kart.authoritative(1);
        if (b) window.__jumpAuth = Math.max(window.__jumpAuth, b.y);
      }, 4);
    });
    for (const s of [host, client]) {
      await s.page.evaluate(() => {
        window.__shown = [];
        window.__jumpShown = 0;
        window.__recording = true;
        // Längste Blockade des Haupt-Threads mitschreiben (Aussetzer der Testumgebung erkennen).
        window.__stall = 0;
        let lastBeat = performance.now();
        window.__stallTimer = setInterval(() => {
          const n = performance.now();
          window.__stall = Math.max(window.__stall, n - lastBeat);
          lastBeat = n;
        }, 5);
        const loop = () => {
          if (!window.__recording) return;
          for (const e of window.__kart.entities()) {
            window.__shown.push({ slot: e.slot, x: e.x, z: e.z });
            if (e.slot === 1) window.__jumpShown = Math.max(window.__jumpShown, e.y);
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
    }
    await press(phoneA, 'gas');
    await press(phoneB, 'gas');
    // Enge Kreise, damit niemand die Bande berührt (dort hätte die Spur einen Knick).
    phoneA.wheel = 26;
    phoneB.wheel = -26;
    await sleep(800);
    const cmdHost = await kart(host.page, 'cmd()');
    check('Gas und Lenkung von Handy A kommen in der Simulation an', (cmdHost.buttons & 1) === 1 && cmdHost.steer > 20, JSON.stringify(cmdHost));

    let peak = 0;
    for (let i = 0; i < 16; i++) {
      await sleep(250);
      peak = Math.max(peak, (await kart(client.page, 'clientStats()')).peak);
    }

    // Item-Taste: kurzer Tipper → Hüpfer auf beiden Bildschirmen
    await press(phoneB, 'item');
    await sleep(60);
    await release(phoneB, 'item');
    await sleep(900);

    // Drift-Flag
    await press(phoneA, 'drift');
    await sleep(500);
    const driftSeen = (await kart(client.page, 'entities()')).find((e) => e.slot === 0);
    await release(phoneA, 'drift');

    // Erst die Bildschirm-Aufzeichnung anhalten, dann die Fahrspur – sonst
    // lägen die letzten Bilder hinter dem Ende der aufgezeichneten Spur.
    const shown = {};
    for (const s of [host, client]) {
      shown[s.name] = await s.page.evaluate(() => {
        window.__recording = false;
        clearInterval(window.__stallTimer);
        return { list: window.__shown, jump: window.__jumpShown, stall: window.__stall };
      });
    }
    await sleep(400);
    const trail = await host.page.evaluate(() => {
      clearInterval(window.__rec);
      return { trail: window.__trail, jump: window.__jumpAuth };
    });
    // Alles, was ein Bildschirm angezeigt hat, muss auf der echten Fahrspur
    // liegen – unabhängig davon, wie viel früher oder später er es zeigt.
    const offTrack = (list) => {
      let worst = 0;
      for (const e of list) {
        const pts = trail.trail[e.slot];
        let best = Infinity;
        for (let k = 1; k < pts.length; k++) {
          const [ax, az] = pts[k - 1];
          const [bx, bz] = pts[k];
          const dx = bx - ax;
          const dz = bz - az;
          const len2 = dx * dx + dz * dz;
          const t = len2 > 0 ? Math.max(0, Math.min(1, ((e.x - ax) * dx + (e.z - az) * dz) / len2)) : 0;
          best = Math.min(best, Math.hypot(e.x - (ax + dx * t), e.z - (az + dz * t)));
          if (best < 1e-4) break;
        }
        if (best > worst) {
          worst = best;
          offTrack.last = { slot: e.slot, x: e.x, z: e.z, index: list.indexOf(e), of: list.length };
        }
      }
      return worst;
    };
    const offClient = offTrack(shown.client.list);
    if (process.env.VERBOSE) console.log('        schlechtester Punkt Ben-Bildschirm:', JSON.stringify(offTrack.last));
    const offHost = offTrack(shown.host.list);
    if (process.env.VERBOSE) {
      console.log('        schlechtester Punkt Host-Bildschirm:', JSON.stringify(offTrack.last));
      for (const sl of [0, 1]) {
        const t = trail.trail[sl];
        console.log(`        Spur ${sl}: ${t.length} Punkte, Start ${t[0].map((v) => v.toFixed(1))}, Ende ${t[t.length - 1].map((v) => v.toFixed(1))}`);
        for (const nm of ['host', 'client']) {
          const l = shown[nm].list.filter((e) => e.slot === sl);
          console.log(`          ${nm}: ${l.length} Bilder, erstes ${l[0].x.toFixed(1)},${l[0].z.toFixed(1)}, letztes ${l[l.length - 1].x.toFixed(1)},${l[l.length - 1].z.toFixed(1)}`);
        }
      }
    }
    const fps = [(await kart(host.page, 'rates()')).fps, (await kart(client.page, 'rates()')).fps];
    check('Was Bens Bildschirm zeigt, liegt auf der echten Fahrspur (< 5 cm)', offClient < 0.05, `max. ${(offClient * 100).toFixed(1)} cm in ${shown.client.list.length / 2} Bildern`);
    check('Was der Host-Bildschirm zeigt, liegt auf der echten Fahrspur (< 5 cm)', offHost < 0.05, `max. ${(offHost * 100).toFixed(1)} cm in ${shown.host.list.length / 2} Bildern`);
    // Hängt die Testmaschine selbst länger (Software-Rendering auf wenigen Kernen),
    // entstehen zwangsläufig Korrekturen; dann ist diese Prüfung nicht aussagekräftig.
    const stall = Math.max(shown.host.stall, shown.client.stall);
    if (stall > 120) {
      console.log(`  ----  Vorhersage-Korrekturen nicht auswertbar: Testmaschine hing ${stall.toFixed(0)} ms (Korrektur max. ${(peak * 100).toFixed(1)} cm)`);
    } else {
      check('Vorhersage ohne spürbare Korrekturen (< 5 cm)', peak < 0.05, `max. ${(peak * 100).toFixed(2)} cm`);
    }
    console.log(`        (längste Blockade des Haupt-Threads: Host ${shown.host.stall.toFixed(0)} ms, Ben ${shown.client.stall.toFixed(0)} ms)`);
    console.log(`        (Bildrate in dieser Testumgebung: ${fps.join(' / ')} FPS mit Software-Rendering – sagt nichts über echte Geräte)`);
    check('Item-Tipper von Ben: Hüpfer in der Simulation des Hosts', trail.jump > 0.8, `${trail.jump.toFixed(2)} m`);
    check('… und auf Bens Bildschirm sichtbar', shown.client.jump > 0.3, `${shown.client.jump.toFixed(2)} m`);
    check('… und auf dem Host-Bildschirm sichtbar', shown.host.jump > 0.3, `${shown.host.jump.toFixed(2)} m`);
    check('Drift von Anna ist auf Bens Bildschirm sichtbar', (driftSeen.flags & 2) === 2);
    await shot(host.page, 'game-host.png');
    await shot(client.page, 'game-client.png');

    // Anhalten: danach müssen alle Bildschirme exakt dasselbe zeigen.
    await release(phoneA, 'gas');
    await release(phoneB, 'gas');
    phoneA.wheel = 0;
    phoneB.wheel = 0;
    await sleep(3500);
    const [hs, cs] = await Promise.all([kart(host.page, 'entities()'), kart(client.page, 'entities()')]);
    let rest = 0;
    for (const slot of [0, 1]) rest = Math.max(rest, dist(hs.find((e) => e.slot === slot), cs.find((e) => e.slot === slot)));
    check('Im Stand zeigen beide Bildschirme dieselben Positionen (< 1 cm)', rest < 0.01, `${(rest * 1000).toFixed(2)} mm`);
    let driven = 0;
    for (let k = 1; k < trail.trail[1].length; k++) {
      driven += Math.hypot(trail.trail[1][k][0] - trail.trail[1][k - 1][0], trail.trail[1][k][1] - trail.trail[1][k - 1][1]);
    }
    check('Bens Würfel ist wirklich gefahren', driven > 40, `${driven.toFixed(0)} m Strecke`);

    await host.page.setViewportSize({ width: 1180, height: 820 });
    await client.page.setViewportSize({ width: 1180, height: 820 });
    const rc = await kart(client.page, 'rates()');
    const rh = await kart(host.page, 'rates()');
    check('Snapshots beim Mitspieler ≈ 30/s', rc.snap >= 26 && rc.snap <= 34, `${rc.snap}/s`);
    check('Simulation läuft mit 60 Schritten/s (Host und Mitspieler)', Math.abs(rh.tick - 60) <= 3 && Math.abs(rc.tick - 60) <= 3, `${rh.tick} / ${rc.tick}`);
  }

  if (wants('reconnect')) {
    // === Wiederverbindung ===================================================
    section('Wiederverbindung');
    // Kleines Fenster: sonst blockiert das Software-Rendering die Seiten sekundenlang.
    await host.page.setViewportSize({ width: 240, height: 150 });
    await client.page.setViewportSize({ width: 240, height: 150 });

    // 1. Handy verliert kurz die Verbindung
    await ctl(phoneA.page, 'dropLink()');
    await host.page.waitForFunction(() => !window.__kart.controller().connected, null, { timeout: 5000 });
    let t0 = Date.now();
    await host.page.waitForFunction(() => window.__kart.controller().connected, null, { timeout: 10000 });
    check('Handy verbindet sich nach Abbruch von selbst neu', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    check('Handy bleibt dabei auf der Tastenfläche', (await ctl(phoneA.page, 'screen()')) === 'pad');

    // 2. Mitspieler-Bildschirm verliert die Verbindung zum Host
    await kart(client.page, 'dropHostLink()');
    t0 = Date.now();
    await client.page.waitForFunction(() => window.__kart.clientStatus() === 'joined', null, { timeout: 12000 });
    check('Bildschirm verbindet sich nach Abbruch neu mit dem Host', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    check('… und hat denselben Platz', (await kart(client.page, 'slot()')) === 1);
    await sleep(600);
    check('… und fährt in derselben Testszene weiter', (await kart(client.page, 'view()')) === 'game' && (await kart(client.page, 'entities()')).length === 2);

    // 3. Mitspieler lädt die Seite neu
    if (process.env.VERBOSE) console.log('        ', new Date().toISOString().slice(17, 23), 'Neuladen Mitspieler');
    await client.page.reload();
    await client.page.waitForFunction(() => window.__kart && window.__kart.clientStatus() === 'joined', null, { timeout: 20000 });
    check('Nach Neuladen: Mitspieler ist automatisch zurück', true);
    check('… auf demselben Platz', (await kart(client.page, 'slot()')) === 1);
    lobby = await kart(host.page, 'lobby()');
    if (process.env.VERBOSE) {
      console.log('        ', new Date().toISOString().slice(17, 23), 'Beginn Beobachtung');
      for (let i = 0; i < 12; i++) {
        const h = await kart(host.page, 'lobby()');
        console.log('        ', i * 250, 'ms host:', JSON.stringify(h.players.map((p) => [p.name, p.online])), 'client:', await kart(client.page, 'clientStatus()'), await kart(client.page, 'view()'));
        await sleep(250);
      }
    }
    check('… und der Host führt weiterhin genau 2 Spieler', lobby.players.length === 2 && lobby.players[1].online, JSON.stringify(lobby.players.map((p) => [p.slot, p.name, p.online])));
    await client.page.waitForFunction(() => window.__kart.controller().connected, null, { timeout: 15000 });
    check('Handy B findet den neu geladenen Bildschirm von selbst wieder', true);

    // 4. Handy lädt die Seite neu
    await phoneA.page.reload();
    await phoneA.apply();
    await phoneA.page.waitForFunction(() => window.__ctl && window.__ctl.connected(), null, { timeout: 20000 });
    check('Handy A ist nach Neuladen wieder gekoppelt', true);
    await phoneA.page.click('#btn-start');
    await phoneA.page.waitForSelector('#ctl[data-screen="calibrate"]');
    await phoneA.page.click('#btn-calibrate');

    // 5. Host lädt die Seite neu
    await host.page.reload();
    await host.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    const codeAfter = (await host.page.textContent('#lobby-code')).trim();
    check('Host hat nach Neuladen denselben Raumcode', codeAfter === code, codeAfter);
    await host.page.waitForFunction(() => {
      const l = window.__kart.lobby();
      return l.players.length === 2 && l.players.every((p) => p.online);
    }, null, { timeout: 25000 });
    check('Mitspieler findet den neu geladenen Host und behält Platz 2', (await kart(client.page, 'slot()')) === 1);
    await client.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });
    check('Alle sind nach dem Host-Neustart zurück in der Lobby', true);
    await host.page.waitForFunction(() => window.__kart.controller().connected, null, { timeout: 15000 });
    check('Handy A findet den neu geladenen Host-Bildschirm', true);
    await host.page.setViewportSize({ width: 1180, height: 820 });
    await client.page.setViewportSize({ width: 1180, height: 820 });
  }

  if (wants('pairing')) {
    // === Zweites Handy übernimmt ============================================
    section('Zweites Handy scannt denselben QR-Code');
    const phoneC = await openPhone('handy-C', await kart(host.page, 'pairUrl()'));
    await phoneC.page.waitForFunction(() => window.__ctl && window.__ctl.connected(), null, { timeout: 20000 });
    await phoneA.page.waitForFunction(() => window.__ctl.status() === 'replaced', null, { timeout: 5000 });
    check('Erstes Handy erfährt, dass es abgelöst wurde', true);
    await sleep(3000);
    check('… und drängt sich nicht von selbst zurück', (await ctl(phoneC.page, 'connected()')) === true && (await ctl(phoneA.page, 'status()')) === 'replaced');
    // Der Testkontext wird hart beendet (kein Abmelden) – der Bildschirm merkt es über das Zeitlimit.
    const tGone = Date.now();
    await closePhone(phoneC);
    await host.page.waitForFunction(() => !window.__kart.controller().connected, null, { timeout: 16000 });
    check('Host bemerkt ein kommentarlos verschwundenes Handy', true, `nach ${((Date.now() - tGone) / 1000).toFixed(1)} s`);
  }

  if (wants('fallback')) {
    // === Handy ohne Neigungssensor ==========================================
    section('Handy ohne Neigungssensor: Touch-Lenkung als Ersatz');
    const phoneT = await openPhone('handy-T', await kart(client.page, 'pairUrl()'), devices['Pixel 5 landscape'], 1, false);
    await phoneT.page.waitForFunction(() => window.__ctl && window.__ctl.connected(), null, { timeout: 20000 });
    await phoneT.page.click('#btn-start');
    await phoneT.page.waitForSelector('#veil:not([hidden])', { timeout: 6000 });
    check('Ohne Sensorwerte erscheint eine verständliche Meldung', (await phoneT.page.textContent('#veil-title')).includes('Keine Neigungslenkung'));
    await shot(phoneT.page, 'phone-no-sensor.png');
    await phoneT.page.click('#veil-btn');
    check('Tastenfläche schaltet auf Touch-Lenkung', await phoneT.page.evaluate(() => document.getElementById('pad').classList.contains('touch')));
    const zone = await phoneT.page.evaluate(() => {
      const r = document.querySelector('[data-steer]').getBoundingClientRect();
      return { x: r.left, y: r.top + r.height / 2, w: r.width };
    });
    await phoneT.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: zone.x + zone.w * 0.85, y: zone.y, id: 9 }] });
    await sleep(200);
    const right = await ctl(phoneT.page, 'steer()');
    await phoneT.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: zone.x + zone.w * 0.15, y: zone.y, id: 9 }] });
    await sleep(200);
    const left = await ctl(phoneT.page, 'steer()');
    await phoneT.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(100);
    const centre = await ctl(phoneT.page, 'steer()');
    check('Daumen rechts/links auf der Lenkfläche lenkt rechts/links', right > 0.6 && left < -0.6 && centre === 0, `${right.toFixed(2)} / ${left.toFixed(2)} / ${centre}`);
    await shot(phoneT.page, 'phone-touch.png');
    await closePhone(phoneT);
  }

  if (wants('limits')) {
    // === Grenzen =============================================================
    section('Volle Lobby, falscher Code, laufende Testfahrt');
    const extra = [];
    for (const n of ['Cem', 'Dana']) {
      const s = await openScreen(n);
      await joinLobby(s, n, code);
      await s.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
      extra.push(s);
    }
    lobby = await kart(host.page, 'lobby()');
    check('Vier Spieler in der Lobby', lobby.players.length === 4, lobby.players.map((p) => `${p.slot + 1}:${p.name}`).join(' '));
    const fifth = await openScreen('fuenfter');
    await joinLobby(fifth, 'Emil', code);
    await fifth.page.waitForSelector('#modal:not([hidden])', { timeout: 20000 });
    check('Fünfter Spieler: „Lobby ist voll“', (await fifth.page.textContent('#modal-title')).includes('voll'));
    await fifth.ctx.close();

    // Bewusst verlassen gibt den Platz sofort frei
    await extra[1].page.click('#btn-leave');
    await host.page.waitForFunction(() => window.__kart.lobby().players.length === 3, null, { timeout: 5000 });
    check('„Lobby verlassen“ gibt den Platz sofort frei', true);
    await extra[0].page.click('#btn-leave');
    await host.page.waitForFunction(() => window.__kart.lobby().players.length === 2, null, { timeout: 5000 });
    for (const s of extra) await s.ctx.close();

    const wrong = await openScreen('falsch');
    await joinLobby(wrong, 'Falk', 'CCCCC');
    await wrong.page.waitForSelector('#modal:not([hidden])', { timeout: 25000 });
    check('Falscher Code: „Lobby nicht gefunden“', (await wrong.page.textContent('#modal-title')).includes('nicht gefunden'));
    await wrong.ctx.close();

    // Während der Testfahrt kommt kein Neuer rein
    await client.page.waitForFunction(() => window.__kart.clientStatus() === 'joined');
    if (await client.page.evaluate(() => document.getElementById('btn-ready').textContent.includes('Ich bin'))) {
      await client.page.click('#btn-ready');
    }
    await host.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 5000 });
    await host.page.click('#btn-start');
    await host.page.waitForSelector('#app[data-view="game"]');
    const late = await openScreen('spaet');
    await joinLobby(late, 'Gero', code);
    await late.page.waitForSelector('#modal:not([hidden])', { timeout: 20000 });
    check('Beitritt während der Testfahrt: klare Absage', (await late.page.textContent('#modal-title')).includes('läuft'));
    await late.ctx.close();
    await host.page.click('#btn-back');
    await client.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });
    check('Host holt alle zurück in die Lobby', true);
  }

  if (wants('hostleave')) {
    // === Host verlässt die Lobby ============================================
    section('Host verlässt die Lobby');
    if ((await kart(host.page, 'view()')) === 'game') {
      await host.page.click('#btn-back');
      await host.page.waitForSelector('#app[data-view="lobby"]');
    }
    await host.page.click('#btn-leave');
    await client.page.waitForSelector('#modal:not([hidden])', { timeout: 8000 });
    const title = await client.page.textContent('#modal-title');
    check('Mitspieler bekommt sofort eine klare Meldung', title.includes('geschlossen'), title);
    await shot(client.page, 'host-left.png');
    check('Host ist zurück auf der Startseite', (await kart(host.page, 'view()')) === 'home');
  }

  await closePhone(phoneA);
  await closePhone(phoneB);
  await host.ctx.close();
  await client.ctx.close();

  if (wants('hostgone')) {
    // === Host verschwindet ohne Abschied ====================================
    section('Host verschwindet ohne Abschied (Tab geschlossen)');
    const h2 = await openScreen('host2');
    const code2 = await createLobby(h2, 'Anna');
    const c2 = await openScreen('client2');
    await joinLobby(c2, 'Ben', code2);
    await c2.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    // Tab schließen bzw. wegnavigieren löst beim Host 'pagehide' aus.
    await h2.page.goto('about:blank');
    const t0 = Date.now();
    await c2.page.waitForSelector('#banner:not([hidden])', { timeout: 12000 });
    const bannerAfter = ((Date.now() - t0) / 1000).toFixed(1);
    check('Mitspieler sieht zuerst „verbinde neu …“', (await c2.page.textContent('#banner')).includes('verbinde neu'), `nach ${bannerAfter} s`);
    await c2.page.waitForSelector('#modal:not([hidden])', { timeout: 50000 });
    const title = await c2.page.textContent('#modal-title');
    check('… und nach Ablauf der Frist die endgültige Meldung', title.includes('nicht mehr erreichbar'), `${title} nach ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await c2.ctx.close();
    await h2.ctx.close();

    // Härtester Fall: der Host-Prozess ist einfach weg (kein 'pagehide').
    const h4 = await openScreen('host4');
    const code4 = await createLobby(h4, 'Anna');
    const c4 = await openScreen('client4');
    await joinLobby(c4, 'Ben', code4);
    await c4.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    const cdp4 = await h4.ctx.newCDPSession(h4.page);
    const t1 = Date.now();
    // Nicht auf die Antwort warten: eine abgestürzte Seite antwortet nie.
    cdp4.send('Page.crash').catch(() => undefined);
    await c4.page.waitForSelector('#banner:not([hidden])', { timeout: 20000 });
    check('Host stürzt ab: Mitspieler bemerkt es über das Zeitlimit', true, `nach ${((Date.now() - t1) / 1000).toFixed(1)} s`);
    await c4.ctx.close();
    await Promise.race([h4.ctx.close().catch(() => undefined), sleep(3000)]);
  }

  if (wants('netsim')) {
    // === Schlechte Leitung ===================================================
    section('Simulierte schlechte Leitung: 80 ms + 25 ms Jitter + 5 % Verlust je Richtung');
    const q = '&lag=80&jitter=25&loss=5';
    const h3 = await openScreen('host3', q);
    const code3 = await createLobby(h3, 'Anna');
    const c3 = await openScreen('client3', q);
    await joinLobby(c3, 'Ben', code3);
    await c3.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    const p3 = await openPhone('handy-3', await kart(c3.page, 'pairUrl()'));
    await startPhone(p3);
    await c3.page.click('#btn-ready');
    await h3.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h3.page.click('#btn-start');
    await c3.page.waitForSelector('#app[data-view="game"]', { timeout: 8000 });
    await c3.page.waitForFunction(() => window.__kart.entities().length === 2, null, { timeout: 8000 });
    await sleep(1500);
    const link = await kart(c3.page, 'hostLink()');
    check('Gemessene Umlaufzeit passt zur Simulation (≈ 160–220 ms)', link.rtt > 150 && link.rtt < 260, `${link.rtt.toFixed(0)} ms`);
    await press(p3, 'gas');
    let peak = 0;
    let pendingMax = 0;
    for (let i = 0; i < 24; i++) {
      p3.wheel = Math.sin(i / 2) * 22;
      await sleep(250);
      const s = await kart(c3.page, 'clientStats()');
      peak = Math.max(peak, s.peak);
      pendingMax = Math.max(pendingMax, s.pending);
    }
    check('Eigener Würfel fährt trotz Latenz sofort los (Vorhersage aktiv)', pendingMax >= 8, `bis zu ${pendingMax} unbestätigte Eingaben`);
    check('Korrekturen bleiben klein (< 0,5 m)', peak < 0.5, `max. ${(peak * 100).toFixed(1)} cm`);
    await release(p3, 'gas');
    p3.wheel = 0;
    await sleep(4000);
    const [hs, cs] = await Promise.all([kart(h3.page, 'entities()'), kart(c3.page, 'entities()')]);
    const d = dist(hs.find((e) => e.slot === 1), cs.find((e) => e.slot === 1));
    check('Nach dem Anhalten stimmen Host und Mitspieler überein (< 1 cm)', d < 0.01, `${(d * 1000).toFixed(2)} mm`);
    await shot(c3.page, 'game-netsim.png');
    await closePhone(p3);
    await h3.ctx.close();
    await c3.ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} von ${results.length} Prüfungen bestanden.`);
  if (failed.length) {
    console.log('Fehlgeschlagen:\n' + failed.map((f) => '  - ' + f.name).join('\n'));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error('\nABBRUCH:', e.message);
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length} von ${results.length} Prüfungen bis zum Abbruch bestanden.`);
  try {
    await browser?.close();
  } catch {
    /* egal */
  }
  process.exit(1);
});
