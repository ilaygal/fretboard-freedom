import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { STANDARD_TUNING, TUNINGS, midiAt, mod12 } from '@/theory';
import { ALL_KEYS_ORDER, LICKS } from '@/content/licks';
import { lickBoxes, placeLick } from '@/domain/licks/licks';
import { ANSWER_GREEN, allLicks, expectedMidis, lickMarkers, lickTags, nextKey, soundingIndex, tapsToNotes } from './model';

describe('licks screen model', () => {
  it('nextKey visits all twelve keys and wraps', () => {
    const seen = new Set<number>();
    let pc = ALL_KEYS_ORDER[0]!;
    for (let i = 0; i < 12; i++) {
      seen.add(pc);
      pc = nextKey(pc);
    }
    expect(seen.size).toBe(12);
    expect(pc).toBe(ALL_KEYS_ORDER[0]);
  });

  it('your own licks come first and tags are counted', () => {
    const list = allLicks([{ id: 'x', profileId: 'p', name: 'Mine', scale: 'blues', notes: [{ st: 0, dur: 2 }], tags: ['mine'], createdAt: 1 }]);
    expect(list[0]!.name).toBe('Mine');
    expect(list).toHaveLength(LICKS.length + 1);
    expect(lickTags(list)[0]).toBe('minor');
  });

  it('tapped notes are measured from the home note at or below the first note', () => {
    // A minor: 5th fret on string 6 is A2; then C3 (string 6 fret 8), then G2 (string 6 fret 3, below home).
    const notes = tapsToNotes(STANDARD_TUNING, [{ string: 6, fret: 5 }, { string: 6, fret: 8 }, { string: 6, fret: 3 }], 9);
    expect(notes.map((n) => n.st)).toEqual([0, 3, -2]);
    expect(notes.at(-1)!.dur).toBe(4);
    // Starting on C3 in A: home below is A2, so C3 = 3.
    expect(tapsToNotes(STANDARD_TUNING, [{ string: 5, fret: 3 }], 9)[0]!.st).toBe(3);
  });

  it('a tapped lick placed back in the same key gives the same pitch classes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TUNINGS),
        fc.integer({ min: 0, max: 11 }),
        fc.array(fc.record({ string: fc.integer({ min: 1, max: 6 }), fret: fc.integer({ min: 0, max: 12 }) }), { minLength: 1, maxLength: 8 }),
        (tuning, pc, taps) => {
          const notes = tapsToNotes(tuning, taps, pc);
          expect(notes[0]!.st).toBeGreaterThanOrEqual(0);
          expect(notes[0]!.st).toBeLessThan(12);
          notes.forEach((n, i) => expect(mod12(n.st + pc)).toBe(mod12(midiAt(tuning, taps[i]!))));
        },
      ),
    );
  });

  it('markers number the notes, mark the active one and turn played notes green', () => {
    const lick = LICKS.find((l) => l.id === 'stairsDown')!;
    const box = lickBoxes(STANDARD_TUNING, 'A', lick.scale, 15)[0]!;
    const placed = placeLick(STANDARD_TUNING, 'A', lick.notes, box, 15);
    const m = lickMarkers(placed, { tuning: STANDARD_TUNING, tonicPc: 9, active: 1, played: 1 });
    expect(m).toHaveLength(6);
    expect(m.filter((x) => x.role === 'target').map((x) => x.label)).toEqual(['2']);
    expect(m.filter((x) => x.color === ANSWER_GREEN)).toHaveLength(1);
    expect(m.filter((x) => x.role === 'root').length).toBeGreaterThanOrEqual(1);
  });

  it('rests are skipped when following by mic', () => {
    const lick = LICKS.find((l) => l.id === 'question')!;
    const box = lickBoxes(STANDARD_TUNING, 'E', lick.scale, 15)[0]!;
    const placed = placeLick(STANDARD_TUNING, 'E', lick.notes, box, 15);
    expect(expectedMidis(placed)).toHaveLength(placed.length - 1);
    expect(soundingIndex(placed, 3)).toBe(4);
    expect(soundingIndex(placed, 99)).toBe(placed.length);
  });
});
