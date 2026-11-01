import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { scalePositions } from './positions';
import { STANDARD_TUNING, TUNINGS } from './tuning';
import { midiAt, pitchClassAt, type FretPos } from './fretboard';
import { getScale, type ScaleId } from './scale';
import { SHARP_NAMES } from './note';

const frets = (notes: FretPos[], s: number) => notes.filter((n) => n.string === s).map((n) => n.fret);

describe('scale positions', () => {
  it('gives the classic A minor pentatonic box 1 at the 5th fret', () => {
    const [p1] = scalePositions(STANDARD_TUNING, 'A', 'minorPentatonic', 22);
    expect(p1!.index).toBe(1);
    expect(frets(p1!.notes, 6)).toEqual([5, 8]);
    expect(frets(p1!.notes, 5)).toEqual([5, 7]);
    expect(frets(p1!.notes, 4)).toEqual([5, 7]);
    expect(frets(p1!.notes, 3)).toEqual([5, 7]);
    expect(frets(p1!.notes, 2)).toEqual([5, 8]);
    expect(frets(p1!.notes, 1)).toEqual([5, 8]);
  });

  it('gives box 2 (across the B string) and climbs the neck', () => {
    const ps = scalePositions(STANDARD_TUNING, 'A', 'minorPentatonic', 22);
    expect(frets(ps[1]!.notes, 6)).toEqual([8, 10]);
    expect(frets(ps[1]!.notes, 3)).toEqual([7, 9]);
    expect(frets(ps[1]!.notes, 2)).toEqual([8, 10]);
    expect(ps.map((p) => p.span.from)).toEqual([5, 7, 9, 12, 14]);
  });

  it('starts E minor pentatonic in open position', () => {
    const [p1] = scalePositions(STANDARD_TUNING, 'E', 'minorPentatonic', 22);
    expect(p1!.span).toEqual({ from: 0, to: 3 });
  });

  it('adds the blue note inside the box', () => {
    const [p1] = scalePositions(STANDARD_TUNING, 'A', 'blues', 22);
    expect(frets(p1!.notes, 5)).toEqual([5, 6, 7]);
    expect(frets(p1!.notes, 3)).toEqual([5, 7, 8]);
  });

  it('builds seven 3-notes-per-string shapes for the major scale', () => {
    const ps = scalePositions(STANDARD_TUNING, 'G', 'major', 22);
    expect(ps).toHaveLength(7);
    expect(frets(ps[0]!.notes, 6)).toEqual([3, 5, 7]);
    expect(frets(ps[0]!.notes, 5)).toEqual([3, 5, 7]);
    expect(frets(ps[0]!.notes, 2)).toEqual([5, 7, 8]);
  });

  const scales: ScaleId[] = ['minorPentatonic', 'majorPentatonic', 'blues', 'major', 'minor', 'dorian', 'mixolydian', 'harmonicMinor'];
  const tunings = TUNINGS.filter((t) => ['standard', 'eb', 'dStandard', 'dropD'].includes(t.id));

  it('only uses scale notes, climbs in pitch, fits the hand and the neck, in every key and tuning', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SHARP_NAMES), fc.constantFrom(...scales), fc.constantFrom(...tunings), (tonic, scale, tuning) => {
        const pcs = getScale(tonic, scale).notes.map((n) => n.pc);
        const ps = scalePositions(tuning, tonic, scale, 22);
        expect(ps.length).toBe(scale === 'blues' ? 5 : pcs.length);
        const covered = new Set<number>();
        for (const p of ps) {
          for (const n of p.notes) {
            expect(n.fret).toBeGreaterThanOrEqual(0);
            expect(n.fret).toBeLessThanOrEqual(22);
            const pc = pitchClassAt(tuning, n);
            expect(pcs).toContain(pc);
            covered.add(pc);
          }
          // Pitch rises from the lowest string to the highest, with no repeats.
          const midis = p.notes.map((n) => midiAt(tuning, n));
          for (let i = 1; i < midis.length; i++) expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
          // One hand position: each string's notes stay within 5 frets.
          for (let s = 1; s <= 6; s++) {
            const f = frets(p.notes, s);
            if (f.length) expect(Math.max(...f) - Math.min(...f)).toBeLessThanOrEqual(5);
          }
        }
        expect(covered.size).toBe(pcs.length);
      }),
    );
  });
});
