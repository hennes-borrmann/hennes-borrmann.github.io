// Rennuhr: Minuten, Sekunden, Zehntel – auch an den Rundungsgrenzen.

import { describe, expect, it } from 'vitest';
import { formatTime } from '../../src/screen/ui';

describe('Rennuhr', () => {
  it('rundet erst auf Zehntel und zerlegt dann', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(9.94)).toBe('0:09.9');
    expect(formatTime(9.96)).toBe('0:10.0');
    expect(formatTime(59.96)).toBe('1:00.0');
    expect(formatTime(69.96)).toBe('1:10.0');
    expect(formatTime(70.04)).toBe('1:10.0');
    expect(formatTime(125.5)).toBe('2:05.5');
  });
});
