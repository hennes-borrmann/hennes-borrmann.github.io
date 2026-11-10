import { afterAll, describe, expect, it } from 'vitest';
import { HostGame } from '../../src/game/hostGame';
import { BTN_GAS, BTN_ITEM, EV_FALL, EV_WALL, ITEM_TOP, V_MAX, gridState, stepKart, type Cmd } from '../../src/game/sim';
import {
  EDGE_FREE_L,
  EDGE_FREE_R,
  EDGE_GAP,
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  TRACK,
  TRACK_COUNT,
  pathAhead,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  routeSeg,
  segDelta,
  setTrack,
  sideLimit,
  trackHeading,
  walk,
} from '../../src/game/track';
import { RACE_RUNNING, THING_TOP } from '../../src/net/protocol';

afterAll(() => {
  setTrack(0);
});

/** Kart mit Tempo auf einen Abschnitt setzen, seitlich um lat versetzt. */
function placeAt(seg: number, lat = 0, speed = V_MAX) {
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

describe('Abzweigungen (Werkshof)', () => {
  const t = setTrack(0);

  it('Netz: Vorgänger und Nachfolger passen, der Fortschritt läuft auf beiden Wegen gleich weit', () => {
    expect(t.branches.length).toBe(2);
    expect(t.total).toBe(t.n + t.branches[0].count + t.branches[1].count);
    for (let i = 0; i < t.n; i++) {
      expect(t.next[i]).toBe((i + 1) % t.n);
      expect(t.prev[i]).toBe((i - 1 + t.n) % t.n);
      expect(t.branchOf[i]).toBe(-1);
    }
    t.branches.forEach((b, k) => {
      expect(t.fork[b.from]).toBe(b.first);
      expect(t.prev[b.first]).toBe(b.from);
      expect(t.next[b.first + b.count - 1]).toBe(b.to);
      let last = t.prog[b.from];
      for (let j = 0; j < b.count; j++) {
        const g = b.first + j;
        expect(t.branchOf[g]).toBe(k);
        if (j > 0) expect(t.prev[g]).toBe(g - 1);
        // Fortschritt wächst stetig von der Gabelung bis zur Einmündung
        expect(segDelta(t, b.from, g)).toBeGreaterThan(0);
        expect(t.prog[g]).toBeGreaterThan(last);
        last = t.prog[g];
      }
      expect(t.prog[b.to]).toBeGreaterThan(last);
      // Beide Wege sind ähnlich lang – sonst wäre "zählt gleich" unfair.
      const main = ((b.to - b.from + t.n) % t.n) * t.step;
      expect(Math.abs((b.count + 1) * t.step - main)).toBeLessThan(main * 0.12);
    });
  });

  it('Gabelzone: anfangs liegen beide Fahrbahnen ineinander (keine Bande dazwischen), danach sind sie getrennt', () => {
    for (const b of t.branches) {
      const first = b.first;
      expect(t.twin[first]).toBeGreaterThanOrEqual(0);
      expect(t.edge[first] & (EDGE_FREE_L | EDGE_FREE_R)).not.toBe(0);
      expect(t.free[first]).toBeGreaterThanOrEqual(t.wh[first] - 0.5);
      const mid = b.first + (b.count >> 1);
      expect(t.twin[mid]).toBe(-1);
      expect(t.edge[mid] & (EDGE_FREE_L | EDGE_FREE_R)).toBe(0);
      // Am Ende der Zone läuft der freie Platz auf die normale Bande zu – ohne Sprung.
      let lastZone = first;
      while (t.twin[lastZone + 1] >= 0) lastZone++;
      expect(t.free[lastZone] - t.wh[lastZone]).toBeLessThan(1.2);
      // Die Hauptstrecke hat hinter der Gabelung ebenfalls eine offene Seite – zur Abzweigung hin.
      const m = walk(t, b.from, 8);
      expect(t.edge[m] & (b.side > 0 ? EDGE_FREE_R : EDGE_FREE_L)).not.toBe(0);
      expect(t.edge[m] & (b.side > 0 ? EDGE_FREE_L : EDGE_FREE_R)).toBe(0);
    }
  });

  it('Vorausschau folgt dem gewählten Weg – auch wenn die Zuordnung in der Gabelzone auf dem anderen landet', () => {
    const b = t.branches[0];
    const out = new Int32Array(60);
    pathAhead(t, t.prev[b.from], 0, out);
    expect(out.every((s) => t.branchOf[s] === -1)).toBe(true);
    pathAhead(t, t.prev[b.from], 1, out);
    expect(t.branchOf[out[59]]).toBe(0);
    // In der Zone auf der Abzweigung, will aber Hauptstrecke – und umgekehrt
    const g = b.first + 6;
    expect(t.branchOf[routeSeg(t, g, 0)]).toBe(-1);
    expect(routeSeg(t, g, 1)).toBe(g);
    const m = walk(t, b.from, 6);
    expect(t.branchOf[routeSeg(t, m, 1)]).toBe(0);
    expect(routeSeg(t, m, 0)).toBe(m);
  });

  it('Fahren durch die Gabelung: kein Ruck, keine unsichtbare Wand – egal auf welcher Linie', () => {
    const env = { canDrive: true, speedFactor: 1 };
    for (const b of t.branches) {
      // Von ganz links bis ganz rechts über die Fahrbahn verteilt in die Gabelung hinein, einfach geradeaus mit Gas.
      for (const lat of [-5, -2.5, 0, 2.5, 5]) {
        for (const steer of [-18, 0, 18]) {
          const s = placeAt(walk(t, b.from, -25), lat);
          const cmd: Cmd = { steer, buttons: BTN_GAS };
          let walls = 0;
          let worstJump = 0;
          for (let i = 0; i < 260; i++) {
            const x = s.x;
            const z = s.z;
            const v = Math.hypot(s.vx, s.vz);
            const ev = stepKart(s, cmd, env);
            expect(ev & EV_FALL).toBe(0);
            if (ev & EV_WALL) walls++;
            // Mehr als die eigene Fahrt plus eine Handbreit darf sich das Kart in einem Schritt nicht bewegen.
            worstJump = Math.max(worstJump, Math.hypot(s.x - x, s.z - z) - v / 60);
            expect(Number.isFinite(s.x + s.z + s.y)).toBe(true);
          }
          expect(worstJump).toBeLessThan(0.45);
          // Wer stur geradeaus fährt, trifft irgendwann eine Bande oder den Keil – aber nicht dauernd.
          expect(walls).toBeLessThanOrEqual(3);
          // Und landet auf einer der beiden Fahrbahnen, nicht dazwischen hinter einer Bande.
          projectOnTrack(t, s.x, s.z, s.seg);
          // (Neben der Sprunglücke gibt es keine Bande – dort darf man daneben liegen.)
          if ((t.edge[proj.seg] & (EDGE_OPEN_L | EDGE_OPEN_R)) === 0) expect(Math.abs(proj.lat)).toBeLessThanOrEqual(sideLimit(t, proj.seg, proj.lat > 0 ? 1 : -1));
        }
      }
    }
  });

  it('Brummkreisel folgt seinem Ziel auf die Abzweigung', () => {
    const host = new HostGame(0);
    host.setRoster([0, 1], false);
    host.newRace();
    const NEUTRAL: Cmd = { steer: 0, buttons: 0 };
    while (host.phase !== RACE_RUNNING) host.step(NEUTRAL);
    const fromM = t.branches[0].from * t.step;
    // Kart 1 steht 70 m tief in der Abzweigung, Kart 0 kurz vor der Gabelung.
    host.debugPlace(1, 70, 0, 0);
    host.debugPlace(0, fromM - 20, 0);
    const target = host.authoritative(1)!;
    host.giveItem(0, ITEM_TOP);
    host.step(NEUTRAL);
    host.step({ steer: 0, buttons: BTN_ITEM });
    let onBranch = 0;
    for (let i = 0; i < 300 && target.spin === 0; i++) {
      host.step(NEUTRAL);
      const top = host.things().find((th) => th.kind === THING_TOP);
      if (top && top.target === 1) {
        projectOnTrack(t, top.x, top.z, target.seg);
        if (t.branchOf[proj.seg] === 0 && Math.abs(proj.lat) < 6) onBranch++;
      }
    }
    expect(onBranch).toBeGreaterThan(10);
    expect(target.spin).toBeGreaterThan(0);
  });
});

describe('Gabelung und Einmündung auf allen Strecken', () => {
  for (let ti = 0; ti < TRACK_COUNT; ti++) {
    it(`Strecke ${ti}: keine Begrenzung steht in der Nachbarfahrbahn`, () => {
      setTrack(ti);
      const t = TRACK;
      const bad: string[] = [];
      for (let i = 0; i < t.total; i++) {
        const e = t.edge[i];
        if (e & EDGE_GAP) continue;
        for (const sgn of [-1, 1]) {
          if (e & (sgn < 0 ? EDGE_FREE_L | EDGE_OPEN_L : EDGE_FREE_R | EDGE_OPEN_R)) continue;
          // Mitte der Bande
          const lat = sgn * (t.wh[i] + 0.25);
          const wx = t.px[i] + rightX(t, i) * lat;
          const wz = t.pz[i] + rightZ(t, i) * lat;
          const wy = t.py[i] + lat * t.bank[i];
          for (let k = 0; k < t.total; k++) {
            if (t.edge[k] & EDGE_GAP) continue;
            if (t.branchOf[k] === t.branchOf[i] && Math.abs(k - i) < 30) continue;
            const dx = wx - t.px[k];
            const dz = wz - t.pz[k];
            const along = dx * t.tx[k] + dz * t.tz[k];
            if (along < -0.2 || along > t.step + 0.2) continue;
            const l = dx * rightX(t, k) + dz * rightZ(t, k);
            // gleiche Ebene (darüber oder darunter kreuzende Fahrbahnen zählen nicht)
            if (Math.abs(l) < t.wh[k] - 0.6 && Math.abs(t.py[k] + l * t.bank[k] - wy) < 2.6) {
              bad.push(`${i}/${sgn} in ${k}`);
              break;
            }
          }
        }
      }
      expect(bad).toEqual([]);
    });

    it(`Strecke ${ti}: wo zwei Fahrbahnen ineinander liegen, liegen sie in einer Ebene`, () => {
      setTrack(ti);
      const t = TRACK;
      let worst = 0;
      for (const b of t.branches) {
        for (let g = b.first; g < b.first + b.count; g++) {
          if (!(t.edge[g] & (EDGE_FREE_L | EDGE_FREE_R))) continue;
          for (let lat = -t.wh[g]; lat <= t.wh[g]; lat += 0.5) {
            const wx = t.px[g] + rightX(t, g) * lat;
            const wz = t.pz[g] + rightZ(t, g) * lat;
            const hg = t.py[g] + lat * t.bank[g];
            for (let m = 0; m < t.n; m++) {
              const dx = wx - t.px[m];
              const dz = wz - t.pz[m];
              if (Math.abs(dx) > 30 || Math.abs(dz) > 30 || t.edge[m] & EDGE_GAP) continue;
              const along = dx * t.tx[m] + dz * t.tz[m];
              if (along < 0 || along > t.step) continue;
              const l = dx * rightX(t, m) + dz * rightZ(t, m);
              if (Math.abs(l) > t.wh[m]) continue;
              const n = t.next[m];
              const hm = t.py[m] + l * t.bank[m] + (along * (t.py[n] - t.py[m])) / t.step;
              // nur dieselbe Ebene: eine Brücke darüber ist kein Fehler
              if (Math.abs(hg - hm) < 4) worst = Math.max(worst, Math.abs(hg - hm));
            }
          }
        }
      }
      expect(worst).toBeLessThan(0.15);
    });
  }
});
