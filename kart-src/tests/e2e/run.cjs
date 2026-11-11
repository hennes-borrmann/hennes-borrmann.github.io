// End-to-End-Test in echtem Chromium (ohne Bildschirm): Lobby, Kopplung, Rennen.
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
// Umgebungsvariablen: BASE, SIGNAL, SHOT_DIR (Ordner für Screenshots), ONLY (Teilmenge, z. B. "sync,reconnect,phase3,mechanics")

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
  // Ohne Ton und mit einfacher Grafik: ohne Grafikkarte rendert Chromium sonst zu langsam.
  await page.goto(`${BASE}?signal=${SIGNAL}&mute=1&q=low${query}`);
  return { ctx, page, name };
}

const kart = (page, expr) => page.evaluate(`window.__kart.${expr}`);
/**
 * Rennstand samt Uhrzeit der Abfrage. "goAt" ist der Zeitpunkt (Sekunden, gemeinsame Uhr des
 * Rechners), zu dem diese Seite "Los" erwartet – vergleichbar auch dann, wenn eine Seite die
 * Frage später beantwortet als die andere.
 */
const raceNow = (page) => page.evaluate(() => {
  const r = window.__kart.race();
  return { ...r, goAt: (performance.timeOrigin + performance.now()) / 1000 + r.untilGo };
});
/** „Zur Lobby“ steckt im Menü; bei winzigem Testfenster direkt auslösen statt mit der Maus zu zielen. */
const toLobby = async (page) => {
  await page.evaluate(() => document.getElementById('btn-menu').click());
  await page.waitForSelector('#menu:not([hidden])', { timeout: 3000 });
  await page.evaluate(() => document.getElementById('btn-back').click());
};
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
  // Ohne Grafikkarte rendert Chromium sehr langsam; kleines Fenster hält die Bildrate brauchbar.
  await host.page.setViewportSize({ width: Number(process.env.VW || 240), height: Number(process.env.VH || 150) });
  await client.page.setViewportSize({ width: Number(process.env.VW || 240), height: Number(process.env.VH || 150) });
  await host.page.click('#btn-start');
  await host.page.waitForSelector('#app[data-view="game"]');
  await client.page.waitForSelector('#app[data-view="game"]', { timeout: 25000 });
  check('Beide Bildschirme wechseln ins Rennen', true);
  await client.page.waitForFunction(() => window.__kart.entities().length === 4, null, { timeout: 8000 });
  check('Vier Karts am Start: zwei Menschen, zwei KI-Gegner', (await kart(host.page, 'standings()')).filter((s) => s.bot).length === 2);

  if (wants('sync')) {
    // === Countdown ==========================================================
    section('Countdown: gleichzeitig auf beiden Bildschirmen, niemand fährt zu früh');
    await press(phoneA, 'gas');
    await press(phoneB, 'gas');
    await sleep(700);
    let [raceH, raceC] = await Promise.all([raceNow(host.page), raceNow(client.page)]);
    check('Beide zeigen den Countdown', raceH.phase === 0 && raceC.phase === 0, `Host ${raceH.untilGo.toFixed(2)} s, Ben ${raceC.untilGo.toFixed(2)} s`);
    // Hängt der Host beim Aufbau der Szene (hier: die Testmaschine ohne Grafikkarte), geht seine Rennuhr kurz nach;
    // der Mitspieler führt seine binnen anderthalb Sekunden nach. Gemessen wird der eingeschwungene Wert.
    const cdFirst = Math.abs(raceH.goAt - raceC.goAt);
    let cdDiff = cdFirst;
    for (let i = 0; i < 5 && cdDiff >= 0.15; i++) {
      await sleep(250);
      [raceH, raceC] = await Promise.all([raceNow(host.page), raceNow(client.page)]);
      if (raceH.phase !== 0 || raceC.phase !== 0) break;
      cdDiff = Math.abs(raceH.goAt - raceC.goAt);
    }
    check('Countdown läuft auf beiden gleich (Abweichung < 0,15 s)', cdDiff < 0.15, `${cdDiff.toFixed(3)} s${cdFirst >= 0.15 ? ` (zuerst ${cdFirst.toFixed(3)} s – Uhr nachgeführt)` : ''}`);
    const before = await kart(host.page, 'authoritative(1)');
    check('Trotz Gas steht Bens Kart bis zum Start', Math.hypot(before.vx, before.vz) === 0);

    // Aufzeichnung in den Seiten: der Host die tatsächliche Fahrspur, beide
    // Bildschirme das, was sie in jedem Bild anzeigen.
    await host.page.evaluate(() => {
      window.__trail = { 0: [], 1: [] };
      window.__rec = setInterval(() => {
        for (const s of [0, 1]) {
          const a = window.__kart.authoritative(s);
          if (a) window.__trail[s].push([a.x, a.z]);
        }
      }, 4);
    });
    for (const s of [host, client]) {
      await s.page.evaluate(() => {
        window.__shown = [];
        window.__recording = true;
        window.__stall = 0;
        let lastBeat = performance.now();
        window.__stallTimer = setInterval(() => {
          const n = performance.now();
          window.__stall = Math.max(window.__stall, n - lastBeat);
          lastBeat = n;
        }, 5);
        const loop = () => {
          if (!window.__recording) return;
          for (const e of window.__kart.entities()) if (e.slot < 2) window.__shown.push({ slot: e.slot, x: e.x, z: e.z });
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
    }

    // === Fahren ==============================================================
    section('Fahren: Start, Synchronität, Vorhersage');
    await host.page.waitForFunction(() => window.__kart.race().phase === 1, null, { timeout: 10000 });
    await sleep(900);
    const cmdHost = await kart(host.page, 'cmd()');
    check('Gas von Handy A kommt in der Simulation an', (cmdHost.buttons & 1) === 1, JSON.stringify(cmdHost));
    const moving = await kart(host.page, 'authoritative(1)');
    check('Nach „Los“ fährt Bens Kart beim Host', Math.hypot(moving.vx, moving.vz) > 8, `${Math.hypot(moving.vx, moving.vz).toFixed(1)} m/s`);
    check('Handy B zeigt Platz und Runde', (await ctl(phoneB.page, 'hud()'))?.racing === true, JSON.stringify(await ctl(phoneB.page, 'hud()')));
    let peak = 0;
    for (let i = 0; i < 5; i++) {
      await sleep(250);
      peak = Math.max(peak, (await kart(client.page, 'clientStats()')).peak);
    }

    // Item: Schub für Ben – auf seinem Handy sichtbar, per Tipp ausgelöst
    await kart(host.page, 'giveItem(1, 1)');
    await phoneB.page.waitForFunction(() => window.__ctl.hud() && window.__ctl.hud().item === 1, null, { timeout: 3000 });
    check('Bens Handy zeigt das Item an', (await phoneB.page.textContent('#pad-item-name')) === 'Zisch');
    await press(phoneB, 'item');
    await sleep(80);
    await release(phoneB, 'item');
    await sleep(350);
    const boosted = await kart(host.page, 'authoritative(1)');
    check('Tipp auf Item: Schub wirkt beim Host', boosted.boost > 0 && boosted.item === 0, `noch ${boosted.boost} Ticks`);
    check('… und Bens Handy bekommt die Rückmeldung', (await ctl(phoneB.page, 'lastFlash()')) === 'boost');

    // Rollreifen von Anna: erscheint auf beiden Bildschirmen
    await kart(host.page, 'giveItem(0, 2)');
    await sleep(120);
    await press(phoneA, 'item');
    await sleep(80);
    await release(phoneA, 'item');
    let tiresHost = 0;
    let tiresClient = 0;
    for (let i = 0; i < 8; i++) {
      await sleep(60);
      tiresHost = Math.max(tiresHost, (await kart(host.page, 'things()')).filter((t) => t.kind === 1).length);
      tiresClient = Math.max(tiresClient, (await kart(client.page, 'things()')).filter((t) => t.kind === 1).length);
    }
    check('Annas Rollreifen rollt auf beiden Bildschirmen', tiresHost >= 1 && tiresClient >= 1, `${tiresHost} / ${tiresClient}`);

    // Fahrspur auswerten, bevor die Karts die erste Kurve erreichen
    const shown = {};
    for (const s of [host, client]) {
      shown[s.name] = await s.page.evaluate(() => {
        window.__recording = false;
        clearInterval(window.__stallTimer);
        return { list: window.__shown, stall: window.__stall };
      });
    }
    await sleep(400);
    const trail = await host.page.evaluate(() => {
      clearInterval(window.__rec);
      return window.__trail;
    });
    // Alles, was ein Bildschirm angezeigt hat, muss auf der echten Fahrspur
    // liegen – unabhängig davon, wie viel früher oder später er es zeigt.
    const offTrack = (list, slot) => {
      let worst = 0;
      for (const e of list) {
        if (e.slot !== slot) continue;
        const pts = trail[e.slot];
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
        worst = Math.max(worst, best);
      }
      return worst;
    };
    const annaAtBen = offTrack(shown.client.list, 0);
    const benAtAnna = offTrack(shown.host.list, 1);
    const benOwn = offTrack(shown.client.list, 1);
    // Am Start rempeln die Karts leicht; ein Rempler versetzt ein Kart schlagartig um einige Zentimeter.
    check('Annas Kart bei Ben liegt auf der echten Fahrspur (< 40 cm, auch bei Remplern)', annaAtBen < 0.4, `max. ${(annaAtBen * 100).toFixed(1)} cm`);
    check('Bens Kart bei Anna liegt auf der echten Fahrspur (< 40 cm, auch bei Remplern)', benAtAnna < 0.4, `max. ${(benAtAnna * 100).toFixed(1)} cm`);
    const stall = Math.max(shown.host.stall, shown.client.stall);
    if (stall > 120) {
      console.log(`  ----  Vorhersage nicht auswertbar: Testmaschine hing ${stall.toFixed(0)} ms (Korrektur max. ${(peak * 100).toFixed(1)} cm, eigene Spur ${(benOwn * 100).toFixed(1)} cm)`);
    } else {
      // Rempler kennt nur der Host; das eigene Kart weicht dann kurz ab und wird sanft nachgeführt.
      check('Bens eigenes Kart: Vorhersage bleibt nah am Host (< 60 cm, auch bei Remplern)', benOwn < 0.6, `max. ${(benOwn * 100).toFixed(1)} cm, Korrektur max. ${(peak * 100).toFixed(2)} cm`);
    }
    let driven = 0;
    for (let k = 1; k < trail[1].length; k++) driven += Math.hypot(trail[1][k][0] - trail[1][k - 1][0], trail[1][k][1] - trail[1][k - 1][1]);
    check('Bens Kart ist wirklich gefahren', driven > 30, `${driven.toFixed(0)} m Strecke`);

    // Treffer: nur der Host weiß davon – Ben dreht sich auf beiden Bildschirmen, sein Handy meldet es
    await release(phoneA, 'gas');
    await release(phoneB, 'gas');
    await kart(host.page, 'debugHit(1)');
    // Die Anzeige folgt mit dem nächsten gezeichneten Bild; mehrmals nachsehen.
    const spinSeen = [0, 0];
    let hitFlash = false;
    for (let i = 0; i < 10 && !(spinSeen[0] > 0 && spinSeen[1] > 0 && hitFlash); i++) {
      await sleep(100);
      // Das Handy zeigt immer nur das jüngste Zeichen – gleich mit nachsehen, bevor ein anderes folgt.
      if ((await ctl(phoneB.page, 'lastFlash()')) === 'bad') hitFlash = true;
      const [eh, ec] = await Promise.all([kart(host.page, 'entities()'), kart(client.page, 'entities()')]);
      spinSeen[0] = Math.max(spinSeen[0], eh.find((e) => e.slot === 1).spin);
      spinSeen[1] = Math.max(spinSeen[1], ec.find((e) => e.slot === 1).spin);
    }
    check('Treffer: Ben schleudert beim Host und auf seinem eigenen Bildschirm', spinSeen[0] > 0 && spinSeen[1] > 0, `${spinSeen[0]} / ${spinSeen[1]} Ticks`);
    check('… und sein Handy meldet den Treffer', hitFlash || (await ctl(phoneB.page, 'lastFlash()')) === 'bad');

    // Anhalten: danach müssen beide Bildschirme exakt dasselbe zeigen.
    await sleep(3500);
    const [hs, cs] = await Promise.all([kart(host.page, 'entities()'), kart(client.page, 'entities()')]);
    let rest = 0;
    for (const slot of [0, 1]) rest = Math.max(rest, dist(hs.find((e) => e.slot === slot), cs.find((e) => e.slot === slot)));
    check('Im Stand zeigen beide Bildschirme dieselben Positionen (< 2 cm)', rest < 0.02, `${(rest * 1000).toFixed(2)} mm`);
    const [stH, stC] = await Promise.all([kart(host.page, 'standings()'), kart(client.page, 'standings()')]);
    check('Beide Bildschirme kennen dieselbe Platzierung', JSON.stringify(stH.map((s) => s.slot)) === JSON.stringify(stC.map((s) => s.slot)), stH.map((s) => `${s.place}:${s.slot + 1}`).join(' '));
    const fps = [(await kart(host.page, 'rates()')).fps, (await kart(client.page, 'rates()')).fps];
    console.log(`        (Bildrate in dieser Testumgebung: ${fps.join(' / ')} FPS mit Software-Rendering – sagt nichts über echte Geräte)`);
    const rc = await kart(client.page, 'rates()');
    const rh = await kart(host.page, 'rates()');
    check('Snapshots beim Mitspieler ≈ 30/s', rc.snap >= 26 && rc.snap <= 34, `${rc.snap}/s`);
    check('Simulation läuft mit 60 Schritten/s (Host und Mitspieler)', Math.abs(rh.tick - 60) <= 3 && Math.abs(rc.tick - 60) <= 3, `${rh.tick} / ${rc.tick}`);
    await shot(host.page, 'race-host-small.png');
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
    check('… und ist im selben Rennen', (await kart(client.page, 'view()')) === 'game' && (await kart(client.page, 'entities()')).length === 4);

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
    // Direkt nach dem Neuladen baut der Mitspieler seine Welt auf; ohne Grafikkarte steht seine Seite dabei
    // sekundenlang, und der Host kann ihn für einen Moment als getrennt führen. Entscheidend ist, dass es
    // bei zwei Spielern bleibt und er von selbst wieder als verbunden erscheint.
    const backSince = Date.now();
    let backAfter = -1;
    while (Date.now() - backSince < 12000) {
      lobby = await kart(host.page, 'lobby()');
      if (lobby.players.length === 2 && lobby.players[1].online) {
        backAfter = Date.now() - backSince;
        break;
      }
      await sleep(200);
    }
    check('… und der Host führt weiterhin genau 2 Spieler, Ben ist verbunden', backAfter >= 0, `${JSON.stringify(lobby.players.map((p) => [p.slot, p.name, p.online]))}${backAfter > 300 ? `, kurz getrennt – wieder da nach ${(backAfter / 1000).toFixed(1)} s` : ''}`);
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
    section('Volle Lobby, falscher Code, laufendes Rennen');
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

    // Während des Rennens kommt kein Neuer rein
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
    check('Beitritt während des Rennens: klare Absage', (await late.page.textContent('#modal-title')).includes('läuft'));
    await late.ctx.close();
    await toLobby(host.page);
    await client.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });
    check('Host holt alle zurück in die Lobby', true);
  }

  if (wants('hostleave')) {
    // === Host verlässt die Lobby ============================================
    section('Host verlässt die Lobby');
    if ((await kart(host.page, 'view()')) === 'game') {
      await toLobby(host.page);
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

  if (wants('race')) {
    // === Ganzes Rennen =======================================================
    section('Ganzes Rennen mit Autopilot auf zwei Bildschirmen (1 Runde)');
    const q = '&auto=1&laps=1';
    const h5 = await openScreen('host5', q);
    const code5 = await createLobby(h5, 'Anna');
    const c5 = await openScreen('client5', q);
    await joinLobby(c5, 'Ben', code5);
    await c5.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    await c5.page.click('#btn-ready');
    await h5.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    for (const s of [h5, c5]) await s.page.setViewportSize({ width: 240, height: 150 });
    await h5.page.click('#btn-start');
    await c5.page.waitForSelector('#app[data-view="game"]', { timeout: 25000 });
    const t0 = Date.now();
    await h5.page.waitForFunction(() => window.__kart.race().phase === 2, null, { timeout: 120000 });
    await c5.page.waitForFunction(() => window.__kart.race().phase === 2, null, { timeout: 5000 });
    const [stH, stC] = await Promise.all([kart(h5.page, 'standings()'), kart(c5.page, 'standings()')]);
    // Die Liste erscheint mit dem nächsten gezeichneten Bild.
    const listed = await Promise.all([h5, c5].map((s) => s.page.waitForSelector('#results', { state: 'visible', timeout: 5000 }).then(() => true, () => false)));
    check('Rennen endet auf beiden Bildschirmen mit der Ergebnisliste', listed[0] && listed[1], `nach ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    check('Beide Menschen sind im Ziel', stH.filter((s) => !s.bot).every((s) => s.finished));
    check('Gleiche Ergebnisliste bei Host und Mitspieler', JSON.stringify(stH) === JSON.stringify(stC), stH.map((s) => `${s.place}. ${s.bot ? 'KI' : 'Mensch'} ${s.slot + 1} ${(s.finishTicks / 60).toFixed(1)} s`).join(', '));
    check('Nur der Host kann „Nochmal“ wählen', (await h5.page.isVisible('#btn-again')) && !(await c5.page.isVisible('#btn-again')));
    await h5.page.setViewportSize({ width: 1180, height: 820 });
    await sleep(400);
    await shot(h5.page, 'results.png');
    await h5.page.setViewportSize({ width: 240, height: 150 });
    await h5.page.click('#btn-again');
    await c5.page.waitForFunction(() => window.__kart.race().phase === 0, null, { timeout: 5000 });
    // Die Anzeige folgt mit dem nächsten gezeichneten Bild.
    const gone = await Promise.all([
      c5.page.waitForSelector('#results', { state: 'hidden', timeout: 3000 }).then(() => true, () => false),
      h5.page.waitForSelector('#results', { state: 'hidden', timeout: 3000 }).then(() => true, () => false),
    ]);
    check('„Nochmal“: neues Rennen mit Countdown auf beiden, Ergebnisliste weg', gone[0] && gone[1]);
    const grid = await kart(c5.page, 'entities()');
    check('Alle stehen wieder in der Startaufstellung', grid.length === 4 && grid.every((e) => Math.hypot(e.vx, e.vz) < 0.01));
    await toLobby(h5.page);
    await c5.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });
    check('„Zur Lobby“ holt alle zurück', true);
    await h5.ctx.close();
    await c5.ctx.close();
  }

  if (wants('phase3')) {
    // === Phase 3 =============================================================
    section('Phase 3: Streckenwahl, KI-Stärke, Rundenzahl, Sprung, Absturz und neue Items über zwei Bildschirme');
    // Ohne ?laps=: die Rundenzahl kommt hier aus der Lobby-Auswahl.
    const h6 = await openScreen('host6');
    const code6 = await createLobby(h6, 'Anna');
    const c6 = await openScreen('client6');
    await joinLobby(c6, 'Ben', code6);
    await c6.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    check('Sechs Strecken stehen zur Wahl', (await h6.page.locator('.track-card').count()) === 6);
    check('Mitspieler kann Strecke und KI-Stärke nicht ändern', (await c6.page.locator('.track-card').first().isDisabled()) && (await c6.page.locator('#ai-level button').first().isDisabled()));
    await h6.page.locator('.track-card').nth(1).click();
    await h6.page.locator('#ai-level button[data-level="2"]').click();
    await c6.page.waitForFunction(() => window.__kart.lobby().track === 1 && window.__kart.lobby().aiLevel === 2, null, { timeout: 5000 });
    check('Wahl des Hosts kommt beim Mitspieler an', (await c6.page.locator('.track-card[data-on="true"] .track-name').textContent()) === 'Möwenklippe' && (await c6.page.locator('#ai-level button[aria-pressed="true"]').textContent()) === 'Schwer');
    // Rundenzahl: Vorgabe 3, nur der Host stellt um
    check('Rundenzahl steht anfangs auf 3', (await kart(c6.page, 'lobby()')).laps === 3 && (await c6.page.locator('#lap-count button[aria-pressed="true"]').textContent()) === '3');
    check('Mitspieler kann die Rundenzahl nicht ändern', (await c6.page.locator('#lap-count button').count()) === 4 && (await c6.page.locator('#lap-count button[data-laps="5"]').isDisabled()));
    await h6.page.locator('#lap-count button[data-laps="4"]').click();
    const lapsSynced = await c6.page.waitForFunction(() => window.__kart.lobby().laps === 4, null, { timeout: 5000 }).then(() => true, () => false);
    check('Host stellt 4 Runden ein – der Mitspieler sieht 4', lapsSynced && (await c6.page.locator('#lap-count button[aria-pressed="true"]').textContent()) === '4');
    await c6.page.locator('#lap-count button[data-laps="2"]').click({ force: true });
    await sleep(300);
    check('Klick des Mitspielers ändert nichts', (await kart(h6.page, 'lobby()')).laps === 4 && (await kart(c6.page, 'lobby()')).laps === 4);
    // Figurenwahl: jeder wählt selbst, dieselbe Figur darf doppelt vorkommen
    // Die Bilder der Figuren entstehen nacheinander im Hintergrund.
    const drawn = await h6.page.waitForFunction(() => [...document.querySelectorAll('.char-card img.char-face')].filter((i) => i.src.startsWith('data:image/png')).length === 4, null, { timeout: 15000 }).then(() => true, () => false);
    check('Vier Figuren stehen zur Wahl, mit Bild und Fahrwerten', (await h6.page.locator('.char-card').count()) === 4 && drawn && (await h6.page.locator('.char-card .pips i.on').count()) > 8);
    const before6 = await kart(h6.page, 'lobby()');
    check('Ohne Wahl fährt jeder die Figur seines Platzes', before6.players.every((p) => p.character === p.slot), before6.players.map((p) => p.character).join(', '));
    await h6.page.locator('.char-card').nth(3).click();
    await c6.page.locator('.char-card').nth(3).click();
    await c6.page.waitForFunction(() => window.__kart.lobby().players.every((p) => p.character === 3), null, { timeout: 5000 });
    await h6.page.waitForFunction(() => window.__kart.lobby().players.every((p) => p.character === 3), null, { timeout: 5000 });
    check('Beide wählen dieselbe Figur – auf beiden Bildschirmen sichtbar', (await h6.page.locator('.char-card[data-on="true"] .char-name').textContent()) === 'Zünd-Zoe' && (await c6.page.locator('.player .player-fig').first().textContent()).includes('Zünd-Zoe'));
    await c6.page.locator('.char-card').nth(1).click();
    await h6.page.waitForFunction(() => window.__kart.lobby().players.find((p) => !p.isHost).character === 1, null, { timeout: 5000 });
    check('Ben wechselt zur Füchsin – der Host sieht es', true);
    await shot(h6.page, 'lobby-phase3.png');
    await shot(c6.page, 'lobby-phase3-client.png');
    await c6.page.click('#btn-ready');
    await h6.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    for (const s of [h6, c6]) await s.page.setViewportSize({ width: 240, height: 150 });
    await h6.page.click('#btn-start');
    await c6.page.waitForSelector('#app[data-view="game"]', { timeout: 25000 });
    await c6.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1, null, { timeout: 20000 });
    const [trH, trC] = await Promise.all([kart(h6.page, 'track()'), kart(c6.page, 'track()')]);
    check('Beide fahren auf der gewählten Strecke', trH.index === 1 && trC.index === 1, `${trH.name} / ${trC.name}, ${trH.length.toFixed(0)} m`);
    const [charsH, charsC] = await Promise.all([h6, c6].map(async (s) => (await kart(s.page, 'entities()')).sort((a, b) => a.slot - b.slot).map((e) => e.char)));
    const lapShown = await Promise.all([h6, c6].map((s) => s.page.waitForFunction(() => document.getElementById('rh-lap').textContent === '1/4', null, { timeout: 5000 }).then(() => true, () => false)));
    const [lapsH, lapsC] = await Promise.all([kart(h6.page, 'race().laps'), kart(c6.page, 'race().laps')]);
    check('Im Rennen gilt die gewählte Rundenzahl: Anzeige „1/4“ auf beiden', lapShown[0] && lapShown[1] && lapsH === 4 && lapsC === 4, `Host ${lapsH}, Ben ${lapsC}`);
    check('Im Rennen fahren alle ihre gewählte Figur, die KI die ihres Platzes', JSON.stringify(charsH) === '[3,1,2,3]' && JSON.stringify(charsC) === '[3,1,2,3]', `Host ${charsH.join('')} / Ben ${charsC.join('')}`);

    // Sprung: Anna (Host, Tastatur) nimmt Anlauf auf die Schanze
    await kart(h6.page, `place(0, ${trH.gapAt - 45}, 0)`);
    await h6.page.keyboard.down('ArrowUp');
    let airHost = 0;
    let airClient = 0;
    let fell = false;
    let highest = 0;
    for (let i = 0; i < 40; i++) {
      await sleep(70);
      const [a, list] = await Promise.all([kart(h6.page, 'authoritative(0)'), kart(c6.page, 'entities()')]);
      const shown = list.find((e) => e.slot === 0);
      if (a.flags & 8) airHost++;
      if (shown && shown.flags & 8) {
        airClient++;
        highest = Math.max(highest, shown.y);
      }
      if (a.respawn > 0) fell = true;
    }
    await h6.page.keyboard.up('ArrowUp');
    const landed = await kart(h6.page, 'authoritative(0)');
    check('Sprung über die Lücke: Anna fliegt und landet dahinter', airHost >= 2 && !fell && landed.seg * 1 > trH.gapAt + 5, `${airHost} Messungen in der Luft, danach bei ${landed.seg} m`);
    check('Ben sieht den Sprung (Kart in der Luft)', airClient >= 1, `${airClient} Messungen, höchster Punkt ${highest.toFixed(1)} m`);

    // Absturz: Bens Kart wird mitten in die Lücke gesetzt – seine Vorhersage muss Sturz und Zurücksetzen mitmachen
    await kart(h6.page, `place(1, ${trH.gapAt + 3}, 0)`);
    let sawFall = false;
    for (let i = 0; i < 30 && !sawFall; i++) {
      await sleep(60);
      const p = await kart(c6.page, 'predicted()');
      sawFall = p.respawn > 0;
    }
    check('Absturz: Bens eigener Bildschirm zeigt das Zurücksetzen', sawFall);
    await sleep(1600);
    const [authB, predB] = await Promise.all([kart(h6.page, 'authoritative(1)'), kart(c6.page, 'predicted()')]);
    check('Danach steht Ben vor der Lücke – bei Host und Mitspieler an derselben Stelle', authB.respawn === 0 && authB.seg < trH.gapAt - 15 && Math.hypot(authB.x - predB.x, authB.z - predB.z) < 0.5, `Abschnitt ${authB.seg}, Abweichung ${Math.hypot(authB.x - predB.x, authB.z - predB.z).toFixed(2)} m`);

    // Neue Items vom Host aus: Nebelkerze und Brummkreisel erscheinen auf beiden Bildschirmen
    const useItem = async (item) => {
      await kart(h6.page, `giveItem(0, ${item})`);
      await sleep(120);
      await h6.page.keyboard.down('Space');
      await sleep(150);
      await h6.page.keyboard.up('Space');
    };
    await kart(h6.page, 'place(0, 60, 0)');
    await kart(h6.page, 'place(1, 110, 2)');
    await sleep(200);
    await useItem(7);
    await sleep(300);
    const smoke = await Promise.all([kart(h6.page, 'things()'), kart(c6.page, 'things()')]);
    check('Nebelkerze: Rauchwolke auf beiden Bildschirmen', smoke.every((l) => l.some((t) => t.kind === 4)));
    // Der Kreisel sucht den Fahrer einen Platz vor Anna. Damit das sicher Ben ist, stehen die
    // KI-Gegner hinter beiden (sonst hängt es davon ab, wo sie nach einer Minute Rennen gerade sind).
    await kart(h6.page, 'place(2, 12, -2)');
    await kart(h6.page, 'place(3, 24, 2)');
    await sleep(150);
    await useItem(4);
    let topSeen = [0, 0];
    let benHit = false;
    let warned = false;
    for (let i = 0; i < 40 && !benHit; i++) {
      await sleep(60);
      const [lh, lc, b] = await Promise.all([kart(h6.page, 'things()'), kart(c6.page, 'things()'), kart(h6.page, 'authoritative(1)')]);
      if (lh.some((t) => t.kind === 3)) topSeen[0]++;
      if (lc.some((t) => t.kind === 3)) topSeen[1]++;
      // Auf Bens Bildschirm steht, dass der Kreisel ihn sucht (Ziel = sein Platz) – daraus entsteht die Warnung.
      if (lc.some((t) => t.kind === 3 && t.target === 1)) warned = true;
      benHit = b.spin > 0;
    }
    check('Brummkreisel: auf beiden Bildschirmen zu sehen und trifft Ben vor Anna', topSeen[0] > 0 && topSeen[1] > 0 && benHit, `${topSeen.join(' / ')} Messungen`);
    check('Ben wird gewarnt: der Kreisel hat seinen Platz als Ziel', warned);

    // Kurzschluss: trifft nur, wer vorn liegt; Bens Vorhersage übernimmt die Drosselung
    await sleep(2500);
    await useItem(6);
    await sleep(250);
    const [stallAuth, stallPred, self] = await Promise.all([kart(h6.page, 'authoritative(1)'), kart(c6.page, 'predicted()'), kart(h6.page, 'authoritative(0)')]);
    check('Kurzschluss drosselt Ben (vorn), nicht Anna – auch in Bens Vorhersage', stallAuth.stall > 0 && stallPred.stall > 0 && self.stall === 0, `Host ${stallAuth.stall}, Vorhersage ${stallPred.stall} Ticks`);

    // Stoßfänger fängt den nächsten Treffer ab
    await useItem(5);
    await sleep(200);
    const guarded = await kart(h6.page, 'authoritative(0)');
    await kart(h6.page, 'debugHit(0)');
    await sleep(100);
    const after = await kart(h6.page, 'authoritative(0)');
    check('Stoßfänger: aktiv nach dem Einsatz, fängt einen Treffer ab', guarded.guard > 0 && after.guard === 0 && after.spin === 0, `${guarded.guard} Ticks Schutz`);

    // Abschleppdrache: zieht Anna von selbst über die Strecke; Ben sieht es; die Bremse kappt
    await kart(h6.page, 'place(0, 300, 0)');
    await sleep(200);
    const kiteFrom = await kart(h6.page, 'authoritative(0)');
    await useItem(9);
    let towHost = 0;
    let towClient = 0;
    let fastest = 0;
    for (let i = 0; i < 14; i++) {
      await sleep(90);
      const [a, list] = await Promise.all([kart(h6.page, 'authoritative(0)'), kart(c6.page, 'entities()')]);
      if (a.tow > 0) towHost++;
      fastest = Math.max(fastest, Math.hypot(a.vx, a.vz));
      const shown = list.find((e) => e.slot === 0);
      if (shown && shown.tow > 0) towClient++;
    }
    const kiteMid = await kart(h6.page, 'authoritative(0)');
    check('Abschleppdrache zieht Anna ohne Gas und ohne Lenken mit rund 40 m/s', towHost >= 6 && fastest > 38 && kiteMid.seg - kiteFrom.seg > 35, `${towHost} Messungen am Drachen, Spitze ${fastest.toFixed(0)} m/s, ${kiteMid.seg - kiteFrom.seg} m weiter`);
    check('Ben sieht Anna am Drachen', towClient >= 3, `${towClient} Messungen`);
    await h6.page.keyboard.down('ArrowDown');
    await sleep(200);
    await h6.page.keyboard.up('ArrowDown');
    const kiteCut = await kart(h6.page, 'authoritative(0)');
    check('Die Bremse kappt den Drachen', kiteCut.tow === 0 && kiteCut.respawn === 0, `noch ${kiteCut.tow} Ticks`);

    // Sprungfeder
    await kart(h6.page, 'place(0, 20, 0)');
    await sleep(200);
    await useItem(8);
    let hop = 0;
    for (let i = 0; i < 12; i++) {
      await sleep(50);
      const a = await kart(h6.page, 'authoritative(0)');
      if (a.flags & 8) hop++;
    }
    check('Sprungfeder: das Kart hüpft', hop >= 2, `${hop} Messungen in der Luft`);

    for (const s of [h6, c6]) await s.page.setViewportSize({ width: 1180, height: 820 });
    await sleep(800);
    await shot(h6.page, 'race-phase3-host.png');
    await shot(c6.page, 'race-phase3-client.png');
    const scene = await kart(h6.page, 'scene()');
    check('Szene läuft ohne Fehler', scene && scene.calls > 10 && scene.triangles > 5000, scene ? `${scene.calls} Zeichenaufrufe, ${scene.triangles} Dreiecke` : '');
    await toLobby(h6.page);
    await c6.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });
    await h6.ctx.close();
    await c6.ctx.close();
  }

  if (wants('mechanics')) {
    // === Streckenmechanik ====================================================
    section('Streckenmechanik: Verkehr auf zwei Bildschirmen, Auffahrunfall, Geysir, Stampfpresse, Gezeiten, Fliegen, Tauchen, Lawine, Sprungplatte');
    // (&alle=1: auch die Strecken, die die Lobby noch nicht anbietet – ihre Mechanik wird trotzdem geprüft.)
    const h7 = await openScreen('host7', '&laps=2&alle=1');
    const code7 = await createLobby(h7, 'Anna');
    const c7 = await openScreen('client7', '&laps=2&alle=1');
    await joinLobby(c7, 'Ben', code7);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    const twist = await h7.page.locator('.track-card').nth(3).locator('.track-twist').textContent();
    check('Streckenwahl nennt die Eigenheit der Nachtschicht', /Stadtverkehr/.test(twist || ''), twist || '');
    await h7.page.locator('.track-card').nth(3).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 3, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    for (const s of [h7, c7]) await s.page.setViewportSize({ width: 240, height: 150 });
    await h7.page.click('#btn-start');
    await c7.page.waitForSelector('#app[data-view="game"]', { timeout: 25000 });
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1, null, { timeout: 25000 });
    await h7.page.waitForFunction(() => window.__kart.race().phase === 1, null, { timeout: 5000 });
    // Derselbe Verkehr auf beiden Bildschirmen: gleiche Rennzeit, gleiche Orte.
    // "at" rechnet die Abfragezeit heraus: wo stünde das Fahrzeug zur Rennzeit 0?
    const sample = (s) => s.page.evaluate(() => window.__kart.traffic().map((v) => ({ ...v, at0: v.at - (v.speed * v.time) / 60, wall: performance.timeOrigin + performance.now() })));
    const [tH, tC] = await Promise.all([sample(h7), sample(c7)]);
    check('Beide Bildschirme haben denselben Verkehr', tH.length > 30 && tH.length === tC.length, `${tH.length} / ${tC.length} Fahrzeuge`);
    // Rennzeit beider Bildschirme auf denselben Augenblick umgerechnet (der Mitspieler eilt um die Laufzeit seiner Eingaben voraus)
    const skew = Math.abs(tH[0].time + ((tC[0].wall - tH[0].wall) / 1000) * 60 - tC[0].time);
    check('Rennzeit des Mitspielers läuft mit der des Hosts (Abweichung < 0,2 s)', skew < 12, `${(skew / 60).toFixed(3)} s`);
    const lapLen = (await kart(h7.page, 'track()')).length;
    const drift = Math.max(...tH.map((v, i) => { const d = Math.abs(v.at0 - tC[i].at0) % lapLen; return Math.min(d, lapLen - d); }));
    check('Jedes Fahrzeug hat auf beiden Bildschirmen denselben Fahrplan', drift < 0.01, `größte Abweichung ${drift.toFixed(4)} m`);

    // Auffahrunfall: Ben (Mitspieler, Tastatur) wird hinter einen Bus gesetzt und gibt Gas.
    const sc0 = await kart(h7.page, 'scene()');
    let crash = [0, 0];
    let peak = 0;
    for (let attempt = 0; attempt < 3 && (crash[0] === 0 || crash[1] === 0); attempt++) {
      const buses = (await kart(h7.page, 'traffic()')).filter((v) => v.kind === 2);
      // Ein Bus auf der Startgeraden oder einem anderen geraden Stück ist nicht nötig – 18 m dahinter reicht in jeder Lage.
      const bus = buses[attempt % buses.length];
      await kart(h7.page, `place(1, ${bus.at - bus.half - 18}, ${bus.lat})`);
      await sleep(250);
      await c7.page.keyboard.down('ArrowUp');
      const until = Date.now() + 5000;
      while (Date.now() < until && (crash[0] === 0 || crash[1] === 0)) {
        const [eh, ec] = await Promise.all([kart(h7.page, 'entities()'), kart(c7.page, 'entities()')]);
        crash[0] = Math.max(crash[0], eh.find((e) => e.slot === 1).spin);
        crash[1] = Math.max(crash[1], ec.find((e) => e.slot === 1).spin);
        await sleep(40);
      }
      await c7.page.keyboard.up('ArrowUp');
      peak = Math.max(peak, (await kart(c7.page, 'clientStats()')).peak);
    }
    check('Auffahrunfall: Ben schleudert beim Host und auf seinem eigenen Bildschirm', crash[0] > 0 && crash[1] > 0, `${crash[0]} / ${crash[1]} Ticks`);
    check('Verkehr wird gezeichnet', sc0 && sc0.triangles > 5000, sc0 ? `${sc0.calls} Zeichenaufrufe, ${sc0.triangles} Dreiecke` : '');
    await toLobby(h7.page);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });

    // Glutkessel: Anna steht auf einem Geysir, bis er ausbricht.
    await h7.page.locator('.track-card').nth(2).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 2, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h7.page.click('#btn-start');
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1 && window.__kart.track().index === 2, null, { timeout: 30000 });
    const vent = (await kart(h7.page, 'pulses()')).find((p) => p.kind === 0);
    await kart(h7.page, `place(0, ${vent.at}, ${vent.lat})`);
    let blown = [0, 0];
    let air = false;
    const untilV = Date.now() + (vent.period + 2) * 1000;
    while (Date.now() < untilV && (blown[0] === 0 || blown[1] === 0)) {
      const [eh, ec] = await Promise.all([kart(h7.page, 'entities()'), kart(c7.page, 'entities()')]);
      const a = eh.find((e) => e.slot === 0);
      blown[0] = Math.max(blown[0], a.spin);
      blown[1] = Math.max(blown[1], ec.find((e) => e.slot === 0).spin);
      if (a.flags & 8) air = true;
      await sleep(40);
    }
    check('Geysir: Anna wird hochgeworfen und schleudert – auf beiden Bildschirmen', blown[0] > 0 && blown[1] > 0 && air, `${blown[0]} / ${blown[1]} Ticks, in der Luft: ${air}`);
    await toLobby(h7.page);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });

    // Werkshof: Ben (Mitspieler) steht unter einer Stampfpresse, bis sie zuschlägt.
    const twist0 = await h7.page.locator('.track-card').nth(0).locator('.track-twist').textContent();
    check('Streckenwahl nennt die Eigenheit des Werkshofs', /Förderbänder/.test(twist0 || '') && /Stampfpressen/.test(twist0 || ''), twist0 || '');
    await h7.page.locator('.track-card').nth(0).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 0, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h7.page.click('#btn-start');
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1 && window.__kart.track().index === 0, null, { timeout: 30000 });
    const pressRow = (await kart(h7.page, 'pulses()')).filter((p) => p.kind === 2);
    check('Werkshof hat zwei Reihen Stampfpressen', pressRow.length === 6, `${pressRow.length} Pressen`);
    const stamp = pressRow[0];
    await kart(h7.page, `place(1, ${stamp.at}, ${stamp.lat})`);
    let flat = [0, 0];
    let spun = 0;
    const untilP = Date.now() + (stamp.period + 2) * 1000;
    while (Date.now() < untilP && (flat[0] === 0 || flat[1] === 0)) {
      const [eh, ec] = await Promise.all([kart(h7.page, 'entities()'), kart(c7.page, 'entities()')]);
      const b = eh.find((e) => e.slot === 1);
      flat[0] = Math.max(flat[0], b.flat || 0);
      flat[1] = Math.max(flat[1], ec.find((e) => e.slot === 1).flat || 0);
      spun = Math.max(spun, b.spin);
      await sleep(40);
    }
    check('Stampfpresse: Ben ist geplättet – beim Host und auf seinem eigenen Bildschirm, ohne Dreher', flat[0] > 0 && flat[1] > 0 && spun === 0, `${flat[0]} / ${flat[1]} Ticks platt, Dreher ${spun}`);
    // Platt fährt er nur gut halb so schnell.
    await c7.page.keyboard.down('ArrowUp');
    await sleep(900);
    const slow = (await kart(h7.page, 'entities()')).find((e) => e.slot === 1);
    await c7.page.keyboard.up('ArrowUp');
    check('Geplättet ist Ben langsam', slow.flat > 0 ? Math.hypot(slow.vx, slow.vz) < 19 : true, `${Math.hypot(slow.vx, slow.vz).toFixed(1)} m/s, noch ${slow.flat} Ticks platt`);
    const sc1 = await kart(h7.page, 'scene()');
    check('Pressen und Bänder werden gezeichnet', sc1 && sc1.triangles > 5000, sc1 ? `${sc1.calls} Zeichenaufrufe, ${sc1.triangles} Dreiecke` : '');
    await toLobby(h7.page);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });

    // Möwenklippe: dieselbe Gezeit auf beiden Bildschirmen; bei Flut bremst das Wasser in der Senke der Uferstraße.
    const twist1 = await h7.page.locator('.track-card').nth(1).locator('.track-twist').textContent();
    check('Streckenwahl nennt die Eigenheit der Möwenklippe', /Ebbe und Flut/.test(twist1 || ''), twist1 || '');
    await h7.page.locator('.track-card').nth(1).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 1, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h7.page.click('#btn-start');
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1 && window.__kart.track().index === 1, null, { timeout: 30000 });
    // Ebbe: Anna fährt durch die Senke, so schnell sie kann (aus dem Stand, 2 s Gas).
    // Gemessen wird das Tempo nach 20 m Weg, nicht nach einer festen Zeit – ein Hänger der Testmaschine verfälscht das nicht.
    const dip = async () => {
      await kart(h7.page, 'place(0, 1290, 0)');
      await sleep(200);
      const from = (await kart(h7.page, 'entities()')).find((x) => x.slot === 0);
      await h7.page.keyboard.down('ArrowUp');
      let speed = 0;
      for (const until = Date.now() + 8000; Date.now() < until; ) {
        const e = (await kart(h7.page, 'entities()')).find((x) => x.slot === 0);
        speed = Math.hypot(e.vx, e.vz);
        if (Math.hypot(e.x - from.x, e.z - from.z) >= 20) break;
        await sleep(30);
      }
      await h7.page.keyboard.up('ArrowUp');
      return speed;
    };
    const [tideH0, tideC0] = await Promise.all([kart(h7.page, 'tide()'), kart(c7.page, 'tide()')]);
    check('Das Rennen beginnt bei Ebbe', tideH0 && tideH0.phase === 0, tideH0 ? `Stand ${tideH0.phase}, Wasser ${tideH0.level.toFixed(2)} m` : 'keine Gezeit');
    const skewT = tideH0 && tideC0 ? Math.abs(tideH0.time + ((tideC0.wall - tideH0.wall) / 1000) * 60 - tideC0.time) : 999;
    check('Gezeit des Mitspielers läuft mit der des Hosts (Abweichung < 0,2 s)', skewT < 12, `${(skewT / 60).toFixed(3)} s`);
    const dry = await dip();
    await h7.page.waitForFunction(() => window.__kart.tide().phase === 1, null, { timeout: 40000 });
    const [tideH1, tideC1] = await Promise.all([kart(h7.page, 'tide()'), kart(c7.page, 'tide()')]);
    check('Flut steht auf beiden Bildschirmen', tideH1.phase === 1 && tideC1.phase === 1 && Math.abs(tideH1.level - tideC1.level) < 0.08, `Wasser ${tideH1.level.toFixed(2)} m / ${tideC1.level.toFixed(2)} m`);
    const wet = await dip();
    check('Bei Flut bremst das Wasser in der Senke', dry > 14 && wet < dry * 0.75, `Ebbe ${dry.toFixed(1)} m/s, Flut ${wet.toFixed(1)} m/s`);
    await toLobby(h7.page);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });

    // Wolkenwerft: Ben (Mitspieler) fährt über die Absprungkante und gleitet – auf beiden Bildschirmen.
    const twist4 = await h7.page.locator('.track-card').nth(4).locator('.track-twist').textContent();
    check('Streckenwahl nennt die Eigenheit der Wolkenwerft', /Fliegen/.test(twist4 || ''), twist4 || '');
    await h7.page.locator('.track-card').nth(4).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 4, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h7.page.click('#btn-start');
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1 && window.__kart.track().index === 4, null, { timeout: 30000 });
    const flight = await kart(h7.page, 'flight()');
    // (flight() nennt nur die Flugstrecken der Hauptstrecke; die dritte liegt auf der Abzweigung.)
    check('Wolkenwerft hat Flugstrecken, Aufwinde und Schubringe', flight && flight.glides.length >= 2 && flight.thermals >= 3 && flight.rings >= 3, JSON.stringify(flight));
    // 45 m Anlauf bis zur ersten Kante der Hauptstrecke
    await kart(h7.page, `place(1, ${flight.glides[0].from - 45}, 0)`);
    await sleep(250);
    await c7.page.keyboard.down('ArrowUp');
    let glideTicks = [0, 0];
    let minVy = 0;
    let sunk = 0;
    let y0 = null;
    let landed = false;
    let fell = false;
    const untilF = Date.now() + 14000;
    while (Date.now() < untilF && !landed && !fell) {
      const [eh, ec] = await Promise.all([kart(h7.page, 'entities()'), kart(c7.page, 'entities()')]);
      const bh = eh.find((e) => e.slot === 1);
      const bc = ec.find((e) => e.slot === 1);
      if (bh.flags & 16) {
        glideTicks[0]++;
        if (y0 === null) y0 = bh.y;
        // Sinkrate nur am Anfang des Flugs messen: Ben lenkt nicht, treibt später aus dem Korridor und sackt dort
        // absichtlich durch (neben dem Korridor trägt die Luft nicht).
        if (glideTicks[0] <= 20) {
          sunk = y0 - bh.y;
          minVy = Math.min(minVy, bh.vy);
        }
      } else if (glideTicks[0] > 5 && (bh.flags & 8) === 0 && bh.respawn === 0) landed = true;
      if (bc.flags & 16) glideTicks[1]++;
      if (bh.respawn > 0) fell = true;
      await sleep(50);
    }
    await c7.page.keyboard.up('ArrowUp');
    check('Ben gleitet über die Lücke – beim Host und auf seinem eigenen Bildschirm', glideTicks[0] > 10 && glideTicks[1] > 10, `${glideTicks[0]} / ${glideTicks[1]} Abfragen im Gleitflug`);
    check('Im Gleitflug sinkt das Kart langsam statt zu fallen', minVy > -6, `größte Sinkrate ${(-minVy).toFixed(1)} m/s, ${sunk.toFixed(1)} m gesunken (erste 20 Abfragen im Korridor)`);
    check('Der Flug endet auf der Landebahn oder mit einem Absturz samt Rücksetzen (ohne zu lenken)', landed || fell, landed ? 'gelandet' : fell ? 'abgestürzt und zurückgesetzt' : 'weder noch');
    const sc4 = await kart(h7.page, 'scene()');
    check('Wolkenwerft wird gezeichnet', sc4 && sc4.triangles > 20000, sc4 ? `${sc4.calls} Zeichenaufrufe, ${sc4.triangles} Dreiecke` : '');
    await toLobby(h7.page);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });

    // Tiefseeriff: Ben (Mitspieler) springt vom Steg ins Wasser und taucht – auf beiden Bildschirmen.
    const twist5 = await h7.page.locator('.track-card').nth(5).locator('.track-twist').textContent();
    check('Streckenwahl nennt die Eigenheit des Tiefseeriffs', /Tauchen/.test(twist5 || ''), twist5 || '');
    await h7.page.locator('.track-card').nth(5).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 5, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h7.page.click('#btn-start');
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1 && window.__kart.track().index === 5, null, { timeout: 30000 });
    const reef = await kart(h7.page, 'dive()');
    check('Tiefseeriff hat Tauchstrecke, Strömungen und Blasenschlote', reef && reef.from > 50 && reef.currents >= 4 && reef.vents >= 3, JSON.stringify(reef));
    // 70 m Anlauf auf dem Steg bis ins Wasser
    await kart(h7.page, `place(1, ${reef.from - 70}, 0)`);
    await sleep(250);
    await c7.page.keyboard.down('ArrowUp');
    let diveTicks = [0, 0];
    let deepest = 0;
    let fastSink = 0;
    const untilD = Date.now() + 12000;
    while (Date.now() < untilD && (diveTicks[0] < 25 || diveTicks[1] < 25)) {
      const [eh, ec] = await Promise.all([kart(h7.page, 'entities()'), kart(c7.page, 'entities()')]);
      const bh = eh.find((e) => e.slot === 1);
      const bc = ec.find((e) => e.slot === 1);
      if (bh.flags & 32) {
        diveTicks[0]++;
        deepest = Math.min(deepest, bh.y - reef.sea);
        // Sinkrate im Schweben unter Wasser (in der Luft davor fällt das Kart normal)
        if (bh.flags & 8) fastSink = Math.min(fastSink, bh.vy);
      }
      if (bc.flags & 32) diveTicks[1]++;
      await sleep(50);
    }
    await c7.page.keyboard.up('ArrowUp');
    check('Ben taucht – beim Host und auf seinem eigenen Bildschirm', diveTicks[0] >= 25 && diveTicks[1] >= 25, `${diveTicks[0]} / ${diveTicks[1]} Abfragen unter Wasser, bis ${(-deepest).toFixed(1)} m tief`);
    check('Unter Wasser sinkt das Kart langsam', fastSink > -7.5 && deepest < -2, `größte Sinkrate ${(-fastSink).toFixed(1)} m/s`);
    const sc5 = await kart(h7.page, 'scene()');
    check('Tiefseeriff wird gezeichnet', sc5 && sc5.triangles > 20000, sc5 ? `${sc5.calls} Zeichenaufrufe, ${sc5.triangles} Dreiecke` : '');
    await toLobby(h7.page);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });

    // Eiszapfen-Pass: Anna steht in einem Lawinenstrich, bis die Lawine kommt – sie wird auf beiden Bildschirmen talwärts geschoben.
    const cards = await h7.page.locator('.track-card').count();
    check('Mit dem Test-Schalter stehen acht Strecken zur Wahl', cards === 8, `${cards} Karten`);
    await h7.page.locator('.track-card').nth(6).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 6, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h7.page.click('#btn-start');
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1 && window.__kart.track().index === 6, null, { timeout: 30000 });
    const chute = (await kart(h7.page, 'pulses()')).find((p) => p.kind === 4);
    check('Eiszapfen-Pass hat Lawinen und Eiszapfen', !!chute && (await kart(h7.page, 'pulses()')).some((p) => p.kind === 5), chute ? `Lawine bei ${chute.at.toFixed(0)} m, alle ${chute.period} s` : 'keine');
    await kart(h7.page, `place(0, ${chute.at}, 0)`);
    await sleep(300);
    const start6 = (await kart(h7.page, 'entities()')).find((e) => e.slot === 0);
    let pushed = [0, 0];
    const untilA = Date.now() + (chute.period + 3) * 1000;
    while (Date.now() < untilA && (pushed[0] < 2 || pushed[1] < 2)) {
      const [eh, ec] = await Promise.all([kart(h7.page, 'entities()'), kart(c7.page, 'entities()')]);
      const a = eh.find((e) => e.slot === 0);
      const b = ec.find((e) => e.slot === 0);
      pushed[0] = Math.max(pushed[0], Math.hypot(a.x - start6.x, a.z - start6.z));
      pushed[1] = Math.max(pushed[1], Math.hypot(b.x - start6.x, b.z - start6.z));
      await sleep(60);
    }
    check('Lawine: Anna wird weggeschoben – beim Host und auf Bens Bildschirm', pushed[0] >= 2 && pushed[1] >= 2, `${pushed[0].toFixed(1)} m / ${pushed[1].toFixed(1)} m`);
    await toLobby(h7.page);
    await c7.page.waitForSelector('#app[data-view="lobby"]', { timeout: 5000 });

    // Mondbasis: Ben (Mitspieler) fährt über die Sprungplatte des Massenbeschleunigers – weiter, hoher Sprung auf beiden Bildschirmen.
    await h7.page.locator('.track-card').nth(7).click();
    await c7.page.waitForFunction(() => window.__kart.lobby().track === 7, null, { timeout: 5000 });
    await c7.page.click('#btn-ready');
    await h7.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    await h7.page.click('#btn-start');
    await c7.page.waitForFunction(() => window.__kart.race() && window.__kart.race().phase === 1 && window.__kart.track().index === 7, null, { timeout: 30000 });
    const moon = await kart(h7.page, 'launchers()');
    const padM = moon.pads.find((p) => p.branch === -1);
    check('Mondbasis hat geringe Schwerkraft und Sprungplatten', moon.gravity < 0.5 && moon.pads.length === 2 && !!padM, JSON.stringify(moon));
    await kart(h7.page, `place(1, ${padM.at - 60}, 0)`);
    await sleep(250);
    await c7.page.keyboard.down('ArrowUp');
    let airM = [0, 0];
    let topM = 0;
    let baseY = null;
    let landedM = false;
    let fellM = false;
    let launched = false;
    const untilM = Date.now() + 14000;
    while (Date.now() < untilM && !landedM && !fellM) {
      const [eh, ec] = await Promise.all([kart(h7.page, 'entities()'), kart(c7.page, 'entities()')]);
      const bh = eh.find((e) => e.slot === 1);
      const bc = ec.find((e) => e.slot === 1);
      if (bh.flags & 8) {
        if (bh.vy > 6) launched = true;
        if (launched) {
          airM[0]++;
          if (baseY === null) baseY = bh.y;
          topM = Math.max(topM, bh.y - baseY);
        }
      } else if (launched && airM[0] > 8 && bh.respawn === 0) landedM = true;
      if (launched && bc.flags & 8) airM[1]++;
      if (bh.respawn > 0) fellM = true;
      await sleep(50);
    }
    await c7.page.keyboard.up('ArrowUp');
    check('Sprungplatte: Ben fliegt weit und hoch – beim Host und auf seinem eigenen Bildschirm', airM[0] > 12 && airM[1] > 12 && topM > 2.5, `${airM[0]} / ${airM[1]} Abfragen in der Luft, ${topM.toFixed(1)} m über der Absprunghöhe`);
    check('Ben landet jenseits der Schlucht', landedM && !fellM, landedM ? 'gelandet' : fellM ? 'abgestürzt' : 'weder noch');
    await toLobby(h7.page);
    await h7.ctx.close();
    await c7.ctx.close();
    // Der Browser räumt die acht großen Welten noch auf; das soll nicht in die Zeitmessung des nächsten Abschnitts laufen.
    await sleep(10000);
  }

  if (wants('netsim')) {
    // === Schlechte Leitung ===================================================
    section('Simulierte schlechte Leitung: 80 ms + 25 ms Jitter + 5 % Verlust je Richtung');
    const q = '&lag=80&jitter=25&loss=5&auto=1&laps=1';
    const h3 = await openScreen('host3', q);
    const code3 = await createLobby(h3, 'Anna');
    const c3 = await openScreen('client3', q);
    await joinLobby(c3, 'Ben', code3);
    await c3.page.waitForSelector('#app[data-view="lobby"]', { timeout: 20000 });
    await c3.page.click('#btn-ready');
    await h3.page.waitForFunction(() => !document.getElementById('btn-start').disabled, null, { timeout: 8000 });
    for (const s of [h3, c3]) await s.page.setViewportSize({ width: 240, height: 150 });
    await h3.page.click('#btn-start');
    await c3.page.waitForSelector('#app[data-view="game"]', { timeout: 25000 });
    await c3.page.waitForFunction(() => window.__kart.entities().length === 4, null, { timeout: 8000 });
    await sleep(1500);
    // Die Umlaufzeit ist ein geglätteter Messwert: hing die Testmaschine beim Aufbau der Welt, braucht er ein paar Sekunden, bis er stimmt.
    let link = await kart(c3.page, 'hostLink()');
    const rttFirst = link.rtt;
    for (const rttUntil = Date.now() + 6000; !(link.rtt > 150 && link.rtt < 280) && Date.now() < rttUntil; ) {
      await sleep(500);
      link = await kart(c3.page, 'hostLink()');
    }
    check('Gemessene Umlaufzeit passt zur Simulation (≈ 160–260 ms)', link.rtt > 150 && link.rtt < 280, `${link.rtt.toFixed(0)} ms${rttFirst > 280 ? ` (zuerst ${rttFirst.toFixed(0)} ms – Testmaschine hing)` : ''}`);
    // Hängt der Host kurz (hier: die Testmaschine), geht seine Rennuhr nach; der Mitspieler übernimmt sie binnen anderthalb Sekunden.
    let goDiff = 9;
    let goFirst = -1;
    const goUntil = Date.now() + 3000;
    do {
      const [raceH, raceC] = await Promise.all([raceNow(h3.page), raceNow(c3.page)]);
      goDiff = Math.abs(raceH.goAt - raceC.goAt);
      if (goFirst < 0) goFirst = goDiff;
      if (goDiff >= 0.2) await sleep(250);
    } while (goDiff >= 0.2 && Date.now() < goUntil);
    check('Countdown trotz Verzögerung nahezu gleichzeitig (< 0,2 s)', goDiff < 0.2, `${goDiff.toFixed(3)} s${goFirst >= 0.2 ? ` (zuerst ${goFirst.toFixed(3)} s – Host hing, Uhr nachgeführt)` : ''}`);
    await h3.page.waitForFunction(() => window.__kart.race().phase === 1, null, { timeout: 10000 });
    const peaks = [];
    let pendingMax = 0;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const s = await kart(c3.page, 'clientStats()');
      if (!s) break;
      peaks.push(s.peak);
      pendingMax = Math.max(pendingMax, s.pending);
      if ((await kart(h3.page, 'race()')).phase === 2) break;
    }
    peaks.sort((a, b) => a - b);
    const median = peaks[Math.floor(peaks.length / 2)];
    check('Eigenes Kart reagiert trotz Latenz sofort (Vorhersage aktiv)', pendingMax >= 8, `bis zu ${pendingMax} unbestätigte Eingaben`);
    check('Korrekturen im Normalfall klein (Median der Sekunden-Spitzen < 30 cm)', median < 0.3, `Median ${(median * 100).toFixed(1)} cm, größte ${(peaks[peaks.length - 1] * 100).toFixed(0)} cm`);
    await h3.page.waitForFunction(() => window.__kart.race().phase === 2, null, { timeout: 90000 });
    const st = await kart(h3.page, 'standings()');
    check('Ben kommt auch über die schlechte Leitung ins Ziel', st.find((s) => s.slot === 1).finished);
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
