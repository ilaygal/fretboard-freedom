import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { TUNINGS, STANDARD_TUNING, openMidi, parseTuning, describeTuning } from './tuning';
import { windowAround, allPositions, midiAt, pitchClassAt, positionsOfMidi, positionsOfPitchClasses } from './fretboard';
import { noteLabel } from './labels';

describe('tunings', () => {
  it('numbers strings the guitarist way (1 = high E)', () => {
    expect(openMidi(STANDARD_TUNING, 1)).toBe(64);
    expect(openMidi(STANDARD_TUNING, 6)).toBe(40);
    expect(openMidi(STANDARD_TUNING, 2)).toBe(59);
    expect(() => openMidi(STANDARD_TUNING, 7)).toThrow();
  });

  it('has correct presets', () => {
    const byId = Object.fromEntries(TUNINGS.map((t) => [t.id, describeTuning(t)]));
    expect(byId.standard).toBe('E A D G B E');
    expect(byId.dropD).toBe('D A D G B E');
    expect(byId.eb).toBe('Eb Ab Db Gb Bb Eb');
    expect(byId.openG).toBe('D G D G B D');
    expect(byId.dadgad).toBe('D A D G A D');
  });

  it('parses custom tunings and rejects junk', () => {
    expect(parseTuning('C2 G2 C3 G3 C4 E4').lowToHigh).toEqual([36, 43, 48, 55, 60, 64]);
    expect(() => parseTuning('E A D')).toThrow();
    expect(() => parseTuning('X2 A2 D3 G3 B3 E4')).toThrow();
  });
});

describe('fretboard map', () => {
  it('knows landmark notes in standard tuning', () => {
    expect(midiAt(STANDARD_TUNING, { string: 6, fret: 5 })).toBe(midiAt(STANDARD_TUNING, { string: 5, fret: 0 }));
    expect(midiAt(STANDARD_TUNING, { string: 3, fret: 4 })).toBe(midiAt(STANDARD_TUNING, { string: 2, fret: 0 }));
    expect(pitchClassAt(STANDARD_TUNING, { string: 6, fret: 3 })).toBe(7); // G
    expect(pitchClassAt(STANDARD_TUNING, { string: 5, fret: 3 })).toBe(0); // C
    expect(midiAt(STANDARD_TUNING, { string: 1, fret: 12 })).toBe(76);
  });

  it('has every pitch class exactly once per string in frets 0-11, in every tuning', () => {
    for (const t of TUNINGS) {
      for (let s = 1; s <= 6; s++) {
        const pcs = Array.from({ length: 12 }, (_, f) => pitchClassAt(t, { string: s, fret: f }));
        expect(new Set(pcs).size).toBe(12);
      }
    }
  });

  it('repeats every 12 frets', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 12 }), (s, f) => {
        expect(midiAt(STANDARD_TUNING, { string: s, fret: f + 12 }) - midiAt(STANDARD_TUNING, { string: s, fret: f })).toBe(12);
      }),
    );
  });

  it('finds all positions of a note', () => {
    // The G's in frets 0-12: 6/3, 5/10, 4/5, 3/0, 3/12, 2/8, 1/3.
    const gs = positionsOfPitchClasses(STANDARD_TUNING, [7], { from: 0, to: 12 });
    expect(gs.length).toBe(7);
    expect(gs).toContainEqual({ string: 3, fret: 0 });
    expect(gs).toContainEqual({ string: 3, fret: 12 });
    const e4 = positionsOfMidi(STANDARD_TUNING, 64, { from: 0, to: 12 });
    expect(e4).toEqual(
      expect.arrayContaining([
        { string: 1, fret: 0 },
        { string: 2, fret: 5 },
        { string: 3, fret: 9 },
      ]),
    );
    expect(allPositions(STANDARD_TUNING, { from: 0, to: 12 }).length).toBe(78);
  });
});

describe('labels', () => {
  it('shows the chosen label mode', () => {
    expect(noteLabel('note', 'Bb', 'b7')).toBe('B♭');
    expect(noteLabel('interval', 'Bb', 'b7')).toBe('♭7');
    expect(noteLabel('interval', 'C', 'R')).toBe('R');
    expect(noteLabel('degree', 'C', 'R')).toBe('1');
    expect(noteLabel('solfege', 'G', '5')).toBe('Sol');
    expect(noteLabel('none', 'G', '5')).toBe('');
  });
});

describe('windowAround', () => {
  it('shows a span with a fret below and two above, inside the neck', () => {
    expect(windowAround({ from: 5, to: 8 }, 22)).toEqual({ from: 4, to: 10 });
    expect(windowAround({ from: 0, to: 3 }, 22)).toEqual({ from: 0, to: 5 });
    expect(windowAround({ from: 18, to: 21 }, 22)).toEqual({ from: 17, to: 22 });
  });
});
