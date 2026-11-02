import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { STANDARD_TUNING, SHARP_NAMES, TUNINGS, getScale, midiAt, mod12, pitchClassOf } from '@/theory';
import { LICKS, ALL_KEYS_ORDER } from '@/content/licks';
import { LickFollower, lickBoxes, placeLick } from './licks';

describe('lick data', () => {
  it('uses only notes of its scale (except passing notes in blues)', () => {
    for (const l of LICKS) {
      const pcs = getScale('A', l.scale).notes.map((n) => n.pc);
      for (const n of l.notes) if (n.st !== null) expect(pcs, l.id).toContain(mod12(9 + n.st));
      expect(l.notes.every((n) => n.dur > 0)).toBe(true);
    }
    expect(new Set(ALL_KEYS_ORDER).size).toBe(12);
  });
});

describe('placing a lick', () => {
  it('plays the descending lick inside A minor pentatonic box 1', () => {
    const lick = LICKS.find((l) => l.id === 'stairsDown')!;
    const [box1] = lickBoxes(STANDARD_TUNING, 'A', 'minorPentatonic', 22);
    const placed = placeLick(STANDARD_TUNING, 'A', lick.notes, box1!, 22);
    // Home is A on string 6 fret 5; the lick starts an octave up, on string 4 fret 7, and walks down the box.
    expect(placed.map((p) => p.pos && `${p.pos.string}:${p.pos.fret}`)).toEqual(['4:7', '4:5', '5:7', '5:5', '6:8', '6:5']);
  });

  it('plays the right pitches, on the neck, near the box, in every key, box and tuning', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LICKS), fc.constantFrom(...SHARP_NAMES), fc.integer({ min: 0, max: 6 }), fc.constantFrom(...TUNINGS), (lick, key, b, t) => {
        const boxes = lickBoxes(t, key, lick.scale, 22);
        const box = boxes[b % boxes.length]!;
        const placed = placeLick(t, key, lick.notes, box, 22);
        expect(placed).toHaveLength(lick.notes.length);
        const first = placed.find((p) => p.midi !== null)!;
        placed.forEach((p, i) => {
          const st = lick.notes[i]!.st;
          if (st === null) return expect(p.midi).toBeNull();
          expect(mod12(p.midi! - pitchClassOf(key))).toBe(mod12(st));
          expect(p.midi! - first.midi!).toBe(st - lick.notes.find((x) => x.st !== null)!.st!);
          expect(p.pos).not.toBeNull();
          expect(midiAt(t, p.pos!)).toBe(p.midi);
          expect(p.pos!.fret).toBeGreaterThanOrEqual(0);
          expect(p.pos!.fret).toBeLessThanOrEqual(22);
        });
      }),
      { numRuns: 150 },
    );
  });
});

describe('following a lick by ear', () => {
  it('moves on with each right note, counts wrong ones, ignores a ringing repeat', () => {
    const f = new LickFollower([57, 60, 62], false);
    expect(f.hear(57)).toBe('right');
    expect(f.hear(57)).toBe('ignored');
    expect(f.hear(61)).toBe('wrong');
    expect(f.hear(72)).toBe('right'); // any octave
    expect(f.hear(62)).toBe('right');
    expect(f.done).toBe(true);
    expect(f.wrong).toBe(1);
    const exact = new LickFollower([57], true);
    expect(exact.hear(69)).toBe('wrong');
    expect(exact.hear(57)).toBe('right');
  });
});
