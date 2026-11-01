import { describe, expect, it } from 'vitest';
import { clampBpm, clickPattern, estimateLatencyMs, tapTempo } from './timing';

describe('metronome patterns', () => {
  it('accents the first beat and marks subdivisions', () => {
    expect(clickPattern(4, 1)).toEqual(['bar', 'beat', 'beat', 'beat']);
    expect(clickPattern(3, 2)).toEqual(['bar', 'sub', 'beat', 'sub', 'beat', 'sub']);
    expect(clickPattern(2, 1, false)).toEqual(['beat', 'beat']);
    expect(() => clickPattern(0, 1)).toThrow();
  });

  it('clamps tempo', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(260);
    expect(clampBpm(120.4)).toBe(120);
  });
});

describe('tap tempo', () => {
  it('needs three taps and averages the gaps', () => {
    expect(tapTempo([0, 500])).toBeNull();
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
  });
  it('starts over after a pause', () => {
    expect(tapTempo([0, 1000, 2000, 6000, 6400, 6800])).toBe(150);
  });
});

describe('latency estimate', () => {
  const clicks = [0, 500, 1000, 1500, 2000, 2500];
  it('finds the median offset', () => {
    expect(estimateLatencyMs(clicks, [80, 590, 1070, 1585, 2090, 2580], 500)).toBe(83);
  });
  it('ignores wild taps and needs enough taps', () => {
    expect(estimateLatencyMs(clicks, [80, 90, 1080, 1580, 2080, 260], 500)).toBe(80);
    expect(estimateLatencyMs(clicks, [80, 580], 500)).toBeNull();
  });
});
