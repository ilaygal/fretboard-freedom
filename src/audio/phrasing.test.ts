import { describe, expect, it } from 'vitest';
import { phraseVoices } from './phrasing';

const still = () => 0.5;

describe('phraseVoices', () => {
  it('lets a note ring on while other strings play, and stops it when its string plays again', () => {
    // 120 bpm: a sixteenth is 0.125 s; eighth notes.
    const v = phraseVoices(
      [
        { midi: 64, dur: 2, pos: { string: 1, fret: 0 } },
        { midi: 59, dur: 2, pos: { string: 2, fret: 0 } },
        { midi: 67, dur: 2, pos: { string: 1, fret: 3 } },
      ],
      120,
      still,
    );
    expect(v[0]!.ring).toBeCloseTo(0.5 + 0.02, 2); // until string 1 plays again at 0.5 s
    expect(v[1]!.ring).toBeGreaterThan(1); // string 2 is never played again: rings out
  });

  it('slurs close notes on one string (hammer-on) and plays them softer', () => {
    const v = phraseVoices(
      [
        { midi: 57, dur: 2, pos: { string: 3, fret: 2 } },
        { midi: 59, dur: 2, pos: { string: 3, fret: 4 } },
      ],
      100,
      still,
    );
    expect(v[1]!.slur).toBe(true);
    expect(v[1]!.velocity).toBeLessThan(v[0]!.velocity);
  });

  it('without string info, notes overlap a little instead of cutting off like keys', () => {
    const v = phraseVoices(
      [
        { midi: 60, dur: 2 },
        { midi: 62, dur: 2 },
      ],
      120,
      still,
    );
    expect(v[0]!.ring).toBeCloseTo(0.25 + 0.12, 2);
  });

  it('skips rests and keeps the first note exactly on time', () => {
    const v = phraseVoices([{ midi: 60, dur: 2 }, { midi: null, dur: 2 }, { midi: 62, dur: 4 }], 90, Math.random);
    expect(v.map((x) => x.index)).toEqual([0, 2]);
    expect(v[0]!.time).toBe(0);
  });
});
