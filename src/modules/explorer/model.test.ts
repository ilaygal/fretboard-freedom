import { describe, expect, it } from 'vitest';
import { buildExplorerView, describeTap, shiftFocus } from './model';
import { DEFAULT_SETTINGS } from '@/data/types';
import { STANDARD_TUNING } from '@/theory';

const range = { from: 0, to: 12 };

describe('explorer model', () => {
  it('builds A minor pentatonic with roots marked', () => {
    const v = buildExplorerView({ tonicPc: 9, scale: 'minorPentatonic', labelMode: 'note', focus: null }, DEFAULT_SETTINGS, STANDARD_TUNING, range);
    expect(v.tonic).toBe('A');
    expect(v.markers.filter((m) => m.role === 'root').map((m) => m.pos)).toContainEqual({ string: 6, fret: 5 });
  });

  it('marks the blue note in the blues scale', () => {
    const v = buildExplorerView({ tonicPc: 4, scale: 'blues', labelMode: 'interval', focus: null }, DEFAULT_SETTINGS, STANDARD_TUNING, range);
    const blue = v.markers.filter((m) => m.role === 'blue');
    expect(blue.length).toBeGreaterThan(0);
    expect(blue.every((m) => m.label === '♭5')).toBe(true);
  });

  it('dims notes outside the focus window', () => {
    const v = buildExplorerView({ tonicPc: 9, scale: 'minorPentatonic', labelMode: 'note', focus: { from: 5, to: 8 } }, DEFAULT_SETTINGS, STANDARD_TUNING, range);
    for (const m of v.markers) {
      const inside = m.pos.fret >= 5 && m.pos.fret <= 8;
      expect(m.role === 'ghost').toBe(!inside);
    }
  });

  it('keeps the focus window on the neck', () => {
    expect(shiftFocus({ from: 0, to: 4 }, -1, 22)).toEqual({ from: 0, to: 4 });
    expect(shiftFocus({ from: 17, to: 21 }, 3, 22)).toEqual({ from: 18, to: 22 });
    expect(shiftFocus({ from: 3, to: 7 }, 2, 22)).toEqual({ from: 5, to: 9 });
  });

  it('names a tapped note in the key, in or out of the scale', () => {
    const v = buildExplorerView({ tonicPc: 5, scale: 'major', labelMode: 'note', focus: null }, DEFAULT_SETTINGS, STANDARD_TUNING, range);
    expect(describeTap(v, STANDARD_TUNING, { string: 3, fret: 3 })).toMatchObject({ name: 'Bb', interval: '4' });
    expect(describeTap(v, STANDARD_TUNING, { string: 2, fret: 2 })).toMatchObject({ name: 'Db', interval: undefined });
  });
});
