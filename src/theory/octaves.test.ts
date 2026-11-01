import { describe, expect, it } from 'vitest';
import { octaveShapes } from './octaves';
import { STANDARD_TUNING, TUNINGS } from './tuning';
import { midiAt } from './fretboard';

describe('octave shapes', () => {
  it('finds the classic shapes from the low E string', () => {
    const { connections } = octaveShapes(STANDARD_TUNING, { string: 6, fret: 3 }, { from: 0, to: 12 });
    // G on string 6 fret 3 -> G on string 4 fret 5 (two strings, two frets)
    expect(connections).toContainEqual({ from: { string: 6, fret: 3 }, to: { string: 4, fret: 5 } });
    // G on string 4 fret 5 -> G on string 2 fret 8 (two strings, three frets, across the B string)
    expect(connections).toContainEqual({ from: { string: 4, fret: 5 }, to: { string: 2, fret: 8 } });
  });

  it('only connects exact octaves, in every tuning', () => {
    for (const t of TUNINGS) {
      const { connections } = octaveShapes(t, { string: 5, fret: 2 }, { from: 0, to: 15 });
      for (const c of connections) expect(midiAt(t, c.to) - midiAt(t, c.from)).toBe(12);
    }
  });
});
