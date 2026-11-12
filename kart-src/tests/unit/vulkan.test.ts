// Vulkaninsel: Zeitpläne, Bruchstellen und Tore (mechanics.ts, track.ts, sim.ts, ai.ts).

import { afterAll, describe, expect, it } from 'vitest';
import { AI_EASY, AI_HARD, botCmd, newBrain } from '../../src/game/ai';
import { GATE_WARN, HOLE_WARN, planActive, planSince, planUntil, type Plan } from '../../src/game/mechanics';
import { BTN_GAS, EV_FALL, FLAG_AIR, KART_RADIUS, gridState, stepKart, type KartState } from '../../src/game/sim';
import {
  EDGE_BROKEN,
  EDGE_FREE_L,
  EDGE_FREE_R,
  EDGE_GAP,
  NO_GROUND,
  TRACK,
  TRACK_COUNT,
  gateAt,
  getTrack,
  groundAt,
  groundNow,
  holeAt,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  setTrack,
  trackHeading,
} from '../../src/game/track';

const VULKAN = 9;
const TUBE = 0;
const BRIDGE = 1;

afterAll(() => {
  setTrack(0);
});

function at(seg: number, lat = 0, speed = 0): KartState {
  const t = TRACK;
  const s = gridState(0);
  s.seg = seg;
  s.x = t.px[seg] + rightX(t, seg) * lat;
  s.z = t.pz[seg] + rightZ(t, seg) * lat;
  s.y = t.py[seg] + lat * t.bank[seg];
  s.heading = trackHeading(t, seg);
  s.vx = Math.sin(s.heading) * speed;
  s.vz = Math.cos(s.heading) * speed;
  s.vy = 0;
  s.flags = 0;
  return s;
}

describe('Zeitpläne', () => {
  it('einmalig: gilt ab seinem Beginn und dann für immer', () => {
    const p: Plan = { period: 0, spans: [300, Infinity] };
    expect(planActive(p, 0)).toBe(false);
    expect(planActive(p, 299)).toBe(false);
    expect(planActive(p, 300)).toBe(true);
    expect(planActive(p, 1e7)).toBe(true);
    expect(planUntil(p, 100)).toBe(200);
    expect(planUntil(p, 300)).toBe(0);
    expect(planSince(p, 299)).toBe(-1);
    expect(planSince(p, 360)).toBe(60);
  });

  it('einmalig mit Ende: danach nie wieder', () => {
    const p: Plan = { period: 0, spans: [0, 120] };
    expect(planActive(p, 0)).toBe(true);
    expect(planActive(p, 119)).toBe(true);
    expect(planActive(p, 120)).toBe(false);
    expect(planUntil(p, 500)).toBe(Infinity);
  });

  it('wiederkehrend: läuft im Takt um, auch über das Ende des Takts hinweg', () => {
    const p: Plan = { period: 600, spans: [100, 200] };
    for (const lap of [0, 1, 7]) {
      const base = lap * 600;
      expect(planActive(p, base + 99)).toBe(false);
      expect(planActive(p, base + 100)).toBe(true);
      expect(planActive(p, base + 199)).toBe(true);
      expect(planActive(p, base + 200)).toBe(false);
      expect(planUntil(p, base + 40)).toBe(60);
      // nach der Spanne: bis zur nächsten Runde des Takts
      expect(planUntil(p, base + 500)).toBe(200);
      expect(planSince(p, base + 150)).toBe(50);
    }
  });
});

describe('Vulkaninsel: Bruchstellen', () => {
  it('nur die Vulkaninsel bricht auseinander und hat Tore', () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = getTrack(i);
      if (i === VULKAN) {
        expect(t.def.name).toBe('Vulkaninsel');
        expect(t.holes.length).toBeGreaterThanOrEqual(12);
        expect(t.gates.length).toBe(2);
      } else {
        expect(t.holes.length).toBe(0);
        expect(t.gates.length).toBe(0);
        for (let k = 0; k < t.total; k++) expect(t.edge[k] & EDGE_BROKEN).toBe(0);
      }
    }
  });

  it('eine Platte trägt bis zu ihrem Zeitpunkt, dann fehlt sie – daneben bleibt die Fahrbahn', () => {
    const t = setTrack(VULKAN);
    for (const h of t.holes) {
      expect(h.plan.period).toBe(0);
      const start = h.plan.spans[0];
      expect(h.warn).toBe(HOLE_WARN);
      // Niemand startet auf einer Platte, die gleich bricht.
      expect(start).toBeGreaterThan(20 * 60);
      const mid = h.first + Math.floor(h.count / 2);
      const lat = (Math.max(h.lat0, -t.wh[mid]) + Math.min(h.lat1, t.wh[mid])) / 2;
      expect(t.edge[mid] & EDGE_BROKEN).toBeTruthy();
      expect(holeAt(t, mid, lat, start - 1)).toBe(false);
      expect(groundNow(t, mid, 0, lat, start - 1)).toBeCloseTo(groundAt(t, mid, 0, lat), 9);
      expect(holeAt(t, mid, lat, start)).toBe(true);
      expect(groundNow(t, mid, 0, lat, start)).toBe(NO_GROUND);
      // Weggebrochen bleibt weggebrochen.
      expect(groundNow(t, mid, 0, lat, start + 3 * 3600)).toBe(NO_GROUND);
    }
  });

  it('auf der Hauptstrecke bleibt zu jeder Zeit überall eine Spur, auf die ein Kart passt', () => {
    const t = setTrack(VULKAN);
    // nach der letzten Bruchstelle ändert sich nichts mehr
    const last = Math.max(...t.holes.map((h) => h.plan.spans[0]));
    let narrowest = Infinity;
    for (let seg = 0; seg < t.n; seg++) {
      if ((t.edge[seg] & EDGE_BROKEN) === 0 || t.edge[seg] & EDGE_GAP) continue;
      let run = 0;
      let best = 0;
      for (let lat = -t.wh[seg]; lat <= t.wh[seg] + 1e-9; lat += 0.1) {
        if (holeAt(t, seg, lat, last + 1)) run = 0;
        else {
          run += 0.1;
          best = Math.max(best, run);
        }
      }
      narrowest = Math.min(narrowest, best);
    }
    expect(narrowest).toBeGreaterThan(KART_RADIUS * 2 + 3);
  });

  it('wer auf einer Platte steht, wenn sie bricht, stürzt – und wird auf festen Boden zurückgesetzt', () => {
    const t = setTrack(VULKAN);
    for (const h of t.holes) {
      if (t.branchOf[h.first] >= 0) continue;
      // einmal im Augenblick des Bruchs, einmal ganz am Ende, wenn alles weggebrochen ist, was wegbricht
      for (const time0 of [h.plan.spans[0] - 30, 200 * 60]) {
        const mid = h.first + Math.floor(h.count / 2);
        const lat = (Math.max(h.lat0, -t.wh[mid]) + Math.min(h.lat1, t.wh[mid])) / 2;
        const s = at(mid, lat);
        let fellAt = -1;
        let landed = -1;
        for (let i = 0; i < 60 * 8; i++) {
          const time = time0 + i;
          const ev = stepKart(s, { steer: 0, buttons: 0 }, { canDrive: true, speedFactor: 1, time });
          if (ev & EV_FALL && fellAt < 0) fellAt = time;
          if (fellAt >= 0 && time > fellAt && !(s.flags & FLAG_AIR) && s.respawn === 0) {
            landed = time;
            break;
          }
        }
        // Vor dem Bruch trägt die Platte: gestürzt wird erst danach.
        expect(fellAt).toBeGreaterThanOrEqual(Math.max(time0, h.plan.spans[0]));
        expect(landed).toBeGreaterThan(fellAt);
        projectOnTrack(t, s.x, s.z, s.seg);
        expect(groundNow(t, proj.seg, proj.along, proj.lat, landed)).not.toBe(NO_GROUND);
        // … und zwar so, dass es von dort weitergeht: auch ein Kartbreit daneben ist Boden, jetzt und bis zum Schluss
        for (const d of [-KART_RADIUS, 0, KART_RADIUS]) {
          expect(holeAt(t, proj.seg, proj.lat + d, landed)).toBe(false);
          expect(holeAt(t, proj.seg, proj.lat + d, landed + 600)).toBe(false);
        }
      }
    }
  });
});

describe('Vulkaninsel: Tore', () => {
  it('die Lavaröhre ist 50 Sekunden zu und dann offen; die Hängebrücke ist 84 Sekunden offen und dann zu', () => {
    const t = setTrack(VULKAN);
    const tube = t.gates.find((g) => t.branchOf[g.first] === TUBE)!;
    const bridge = t.gates.find((g) => t.branchOf[g.first] === BRIDGE)!;
    expect(tube.first).toBe(t.branches[TUBE].first);
    expect(bridge.first).toBe(t.branches[BRIDGE].first);
    expect(tube.warn).toBe(GATE_WARN);
    for (const sec of [0, 20, 49.9]) {
      expect(gateAt(t, tube.first, sec * 60)).toBe(true);
      expect(gateAt(t, bridge.first, sec * 60)).toBe(false);
    }
    for (const sec of [50, 70, 83.9]) {
      expect(gateAt(t, tube.first, sec * 60)).toBe(false);
      expect(gateAt(t, bridge.first, sec * 60)).toBe(false);
    }
    for (const sec of [84, 120, 600]) {
      expect(gateAt(t, tube.first, sec * 60)).toBe(false);
      expect(gateAt(t, bridge.first, sec * 60)).toBe(true);
    }
    // Ein Tor sperrt nur seine Mündung: die Hauptstrecke daneben und der Rest der Abzweigung sind nie gesperrt.
    for (const g of t.gates) {
      const b = t.branches[t.branchOf[g.first]];
      for (let seg = 0; seg < t.n; seg++) expect(gateAt(t, seg, 0) || gateAt(t, seg, 100 * 60)).toBe(false);
      expect(g.count).toBeLessThan(b.count / 2);
      // … und reicht über die ganze Strecke, auf der beide Fahrbahnen ineinander liegen
      for (let seg = b.first; seg < b.first + b.count / 2; seg++) {
        if (t.twin[seg] >= 0) expect(seg).toBeLessThan(g.first + g.count);
      }
    }
  });

  /** Fährt aus der Hauptstrecke heraus stur auf die Abzweigung zu (die KI darf nicht umplanen); meldet, wie weit das Kart auf ihr kam. */
  function driveInto(branch: number, time0: number): { deepest: number; falls: number } {
    const t = TRACK;
    const b = t.branches[branch];
    let from = b.from;
    for (let k = 0; k < 30; k++) from = t.prev[from];
    const s = gridState(0);
    Object.assign(s, at(from, 0, 22));
    const brain = newBrain(0, AI_HARD);
    brain.route = 1 << branch;
    brain.routeLock = true;
    let deepest = -1;
    let falls = 0;
    for (let i = 0; i < 60 * 9; i++) {
      const time = time0 + i;
      const cmd = botCmd(s, brain, [], true, { tick: time, time, place: 1, smoke: false });
      const ev = stepKart(s, cmd, { canDrive: true, speedFactor: 1, time });
      if (ev & EV_FALL) falls++;
      if (t.branchOf[s.seg] === branch && t.twin[s.seg] < 0) deepest = Math.max(deepest, s.seg - b.first);
    }
    return { deepest, falls };
  }

  it('durch ein geschlossenes Tor kommt niemand – auch nicht, wer es darauf anlegt', () => {
    setTrack(VULKAN);
    // Röhre zu (Rennbeginn): Wer hineinwill, bleibt auf der Hauptstrecke.
    const shut = driveInto(TUBE, 5 * 60);
    expect(shut.deepest).toBe(-1);
    expect(shut.falls).toBe(0);
    // Röhre offen
    const open = driveInto(TUBE, 60 * 60);
    expect(open.deepest).toBeGreaterThan(100);
    expect(open.falls).toBe(0);
    // Brücke offen
    const early = driveInto(BRIDGE, 20 * 60);
    expect(early.deepest).toBeGreaterThan(100);
    expect(early.falls).toBe(0);
    // Brücke eingestürzt
    const late = driveInto(BRIDGE, 100 * 60);
    expect(late.deepest).toBe(-1);
    expect(late.falls).toBe(0);
  });

  it('die KI plant um, wenn das Tor bei ihrer Ankunft zu ist – sie bleibt nicht davor stehen', () => {
    const t = setTrack(VULKAN);
    for (const [branch, time0] of [
      [TUBE, 5 * 60],
      [BRIDGE, 100 * 60],
      // die Brücke schließt, während die KI schon auf sie zufährt
      [BRIDGE, 84 * 60 - 50],
    ] as const) {
      const b = t.branches[branch];
      for (const level of [AI_HARD, AI_EASY]) {
        let from = b.from;
        for (let k = 0; k < 30; k++) from = t.prev[from];
        const s = gridState(0);
        Object.assign(s, at(from, 0, 22));
        const brain = newBrain(0, level);
        // hatte sich für die Abzweigung entschieden
        brain.route = 1 << branch;
        let past = false;
        let falls = 0;
        for (let i = 0; i < 60 * 14 && !past; i++) {
          const time = time0 + i;
          const cmd = botCmd(s, brain, [], true, { tick: time, time, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time });
          if (ev & EV_FALL) falls++;
          expect(t.branchOf[s.seg] === branch && t.twin[s.seg] < 0).toBe(false);
          if (t.branchOf[s.seg] < 0 && s.seg > b.to + 5 && s.seg < b.to + 80) past = true;
        }
        expect(past).toBe(true);
        expect(falls).toBe(0);
      }
    }
  });

  it('auch mit dem Lenkrad am Anschlag: am geschlossenen Tor läuft die Bande der Hauptstrecke durch', () => {
    const t = setTrack(VULKAN);
    for (const branch of [TUBE, BRIDGE]) {
      const b = t.branches[branch];
      const time0 = branch === TUBE ? 5 * 60 : 100 * 60;
      // Seite, nach der die Abzweigung weggeht
      const side = t.edge[b.first + 4] & EDGE_FREE_L ? 1 : -1;
      expect(t.edge[b.first + 4] & (EDGE_FREE_L | EDGE_FREE_R)).toBeTruthy();
      for (const speed of [8, 18, 28]) {
        for (const lat of [0, 3, 6]) {
          const s = at(t.prev[t.prev[b.from]], side * lat, speed);
          let worst = 0;
          for (let i = 0; i < 60 * 5; i++) {
            const time = time0 + i;
            // Vollgas und stur zur Abzweigung hin lenken
            stepKart(s, { steer: side * 0.6, buttons: BTN_GAS }, { canDrive: true, speedFactor: 1, time });
            expect(t.branchOf[s.seg] === branch && t.twin[s.seg] < 0).toBe(false);
            // nie weiter draußen als die Bande der Hauptstrecke
            const m = t.branchOf[s.seg] === branch ? t.twin[s.seg] : s.seg;
            if (m >= 0 && t.branchOf[m] < 0 && m >= b.from - 2 && m < b.from + 80) {
              const l = (s.x - t.px[m]) * rightX(t, m) + (s.z - t.pz[m]) * rightZ(t, m);
              worst = Math.max(worst, Math.abs(l) - (t.wh[m] - KART_RADIUS));
            }
          }
          expect(worst).toBeLessThan(0.6);
        }
      }
    }
  });

  it('wer die Brücke betritt, kurz bevor sie schließt, schafft es hinüber: der Bruch läuft hinterher', () => {
    const t = setTrack(VULKAN);
    const b = t.branches[BRIDGE];
    const cracks = t.holes.filter((h) => t.branchOf[h.first] === BRIDGE).sort((x, y) => x.first - y.first);
    expect(cracks.length).toBeGreaterThanOrEqual(4);
    // Die Brücke bricht von vorn nach hinten, lückenlos und über die ganze Breite.
    for (let i = 0; i < cracks.length; i++) {
      expect(cracks[i].lat0).toBeLessThanOrEqual(-t.wh[cracks[i].first]);
      expect(cracks[i].lat1).toBeGreaterThanOrEqual(t.wh[cracks[i].first]);
      if (i > 0) {
        expect(cracks[i].first).toBeLessThanOrEqual(cracks[i - 1].first + cracks[i - 1].count);
        expect(cracks[i].plan.spans[0]).toBeGreaterThan(cracks[i - 1].plan.spans[0]);
      }
    }
    // Erst schließt das Tor, dann bricht das erste Stück.
    const gate = t.gates.find((g) => t.branchOf[g.first] === BRIDGE)!;
    expect(cracks[0].plan.spans[0]).toBeGreaterThan(gate.plan.spans[0]);
    // Ein Kart, das im letzten Augenblick durch die Mündung fährt (hinter dem Tor, als es schließt).
    for (const level of [AI_HARD, AI_EASY]) {
      const s = gridState(0);
      Object.assign(s, at(gate.first + gate.count + 1, 0, 20));
      const brain = newBrain(0, level);
      brain.route = 1 << BRIDGE;
      brain.routeLock = true;
      let falls = 0;
      let across = false;
      for (let i = 0; i < 60 * 12 && !across; i++) {
        const time = gate.plan.spans[0] + i;
        const cmd = botCmd(s, brain, [], true, { tick: time, time, place: 1, smoke: false });
        const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time });
        if (ev & EV_FALL) falls++;
        if (t.branchOf[s.seg] < 0 && s.seg >= b.to) across = true;
      }
      expect(falls).toBe(0);
      expect(across).toBe(true);
    }
  });
});

describe('Vulkaninsel: die KI', () => {
  it('fährt drei Runden durch alles, was wegbricht, öffnet und schließt – fast ohne Sturz', () => {
    const t = setTrack(VULKAN);
    let falls = 0;
    let tubeEarly = 0;
    let bridgeLate = 0;
    let tubeUsed = 0;
    let bridgeUsed = 0;
    const tubeGate = t.gates.find((g) => t.branchOf[g.first] === TUBE)!;
    const bridgeGate = t.gates.find((g) => t.branchOf[g.first] === BRIDGE)!;
    for (let slot = 0; slot < 4; slot++) {
      for (const level of [AI_HARD, AI_EASY]) {
        const s = gridState(slot);
        const brain = newBrain(slot + (level === AI_HARD ? 0 : 4), level);
        let laps = 0;
        let before = s.seg;
        let wasTube = false;
        let wasBridge = false;
        for (let tick = 1; tick < 60 * 260 && laps < 3; tick++) {
          const cmd = botCmd(s, brain, [], true, { tick, time: tick, place: 1, smoke: false });
          const ev = stepKart(s, cmd, { canDrive: true, speedFactor: brain.skill, time: tick });
          if (ev & EV_FALL) falls++;
          const deep = t.twin[s.seg] < 0;
          const inTube = t.branchOf[s.seg] === TUBE && deep;
          const inBridge = t.branchOf[s.seg] === BRIDGE && deep;
          if (inTube && !wasTube) {
            tubeUsed++;
            if (planActive(tubeGate.plan, tick)) tubeEarly++;
          }
          if (inBridge && !wasBridge) {
            bridgeUsed++;
            if (planActive(bridgeGate.plan, tick)) bridgeLate++;
          }
          wasTube = inTube;
          wasBridge = inBridge;
          // Zieldurchfahrt: von den letzten Abschnitten der Runde auf die ersten
          if (t.branchOf[s.seg] < 0 && t.branchOf[before] < 0 && before > t.n - 40 && s.seg < 40) laps++;
          before = s.seg;
        }
        expect(laps).toBe(3);
      }
    }
    // Niemand ist durch ein geschlossenes Tor gekommen …
    expect(tubeEarly).toBe(0);
    expect(bridgeLate).toBe(0);
    // … beide Wege werden benutzt, solange sie offen sind …
    expect(tubeUsed).toBeGreaterThan(2);
    expect(bridgeUsed).toBeGreaterThan(2);
    // … und in 24 Runden zwischen wegbrechenden Platten stürzt kaum jemand.
    expect(falls).toBeLessThanOrEqual(4);
  });
});
