import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING, getScale, nameToMidi, resolveProgression, scalePositions } from '@/theory';
import { CHALLENGES, getChallenge } from '@/content/challenges';
import { getProgression, STYLES } from '@/content/backing';
import { analyseImprov, stringsRange, tickToBarBeat, type HeardNote, type ImprovContext } from './analysis';

const chords = resolveProgression('C', ['I', 'V', 'vi', 'IV']); // C G Am F
const ctx: ImprovContext = {
  chords,
  scalePcs: getScale('C', 'majorPentatonic').notes.map((n) => n.pc),
  tuning: STANDARD_TUNING,
  maxFret: 22,
  bars: 4,
};
const n = (name: string, bar: number, beat = 0): HeardNote => ({ midi: nameToMidi(name), bar, beat });

describe('challenge data', () => {
  it('points at real grooves and progressions', () => {
    for (const c of CHALLENGES) {
      expect(STYLES.map((s) => s.id)).toContain(c.styleId);
      expect(getProgression(c.progressionId).scales).toContain(c.scale);
      expect(c.bars).toBeGreaterThan(0);
    }
    expect(() => getChallenge('nope')).toThrow();
  });
});

describe('the improv report', () => {
  it('counts chord notes against the chord sounding at the time', () => {
    const heard = [n('E4', 0), n('G4', 0), n('B4', 1), n('D5', 1), n('A4', 2), n('D4', 3)];
    const r = analyseImprov(heard, { kind: 'chordTones' }, ctx);
    expect(r.notes).toBe(6);
    expect(r.chordTonePct).toBeCloseTo(5 / 6); // D over F is not a chord note
    expect(r.insidePct).toBe(1);
    expect(r.barsPlayed).toBe(4);
    expect(r.score).toBeCloseTo(5 / 6);
    expect(r.registers.low + r.registers.mid + r.registers.high).toBe(6);
  });

  it('handles silence without dividing by zero', () => {
    const r = analyseImprov([], { kind: 'free' }, ctx);
    expect(r).toMatchObject({ notes: 0, chordTonePct: 0, score: 0, lowest: null });
  });

  it('checks string rules by what those strings can reach', () => {
    const r2 = stringsRange(STANDARD_TUNING, [2], 22);
    expect(r2).toEqual({ low: 59, high: 81 });
    const heard = [n('C4', 0), n('E4', 0), n('E2', 1)]; // the low E can't be played on string 2
    expect(analyseImprov(heard, { kind: 'strings', strings: [2] }, ctx).score).toBeCloseTo(2 / 3);
  });

  it('scores three-note and one-note rules', () => {
    const three = [n('C4', 0), n('E4', 0), n('G4', 1), n('C5', 2)];
    expect(analyseImprov(three, { kind: 'fewNotes', count: 3 }, ctx).score).toBe(1);
    const four = [...three, n('A4', 3)];
    expect(analyseImprov(four, { kind: 'fewNotes', count: 3 }, ctx).score).toBeCloseTo(3 / 4);
    const oneNote = [n('G4', 0), n('G4', 0, 1), n('G3', 1), n('A4', 2)];
    expect(analyseImprov(oneNote, { kind: 'rhythmOnly' }, ctx).score).toBeCloseTo(3 / 4);
  });

  it('rewards answering in your bars during call and response', () => {
    const heard = [n('C4', 1), n('E4', 1), n('G4', 3), n('A4', 2)];
    expect(analyseImprov(heard, { kind: 'callResponse' }, ctx).score).toBeCloseTo(3 / 4);
  });

  it('counts thirds landed on beat 1', () => {
    // Bar 0 (C): E on the downbeat. Bar 1 (G): B. Bar 2 (Am): A, not C. Bar 3 (F): starts late.
    const heard = [n('E4', 0, 0.1), n('B3', 1, 0.2), n('A4', 2, 0), n('A4', 3, 2.5)];
    const r = analyseImprov(heard, { kind: 'targetThird' }, ctx);
    expect(r.detail).toEqual({ hits: 2, tries: 3 });
    expect(r.score).toBeCloseTo(2 / 3);
  });

  it('checks a hand position by its pitch range', () => {
    const box = scalePositions(STANDARD_TUNING, 'A', 'minorPentatonic', 22)[1]!.notes; // box 2, frets 7-10
    const heard = [n('C3', 0), n('A4', 1), n('E2', 2)];
    const r = analyseImprov(heard, { kind: 'newPosition' }, { ...ctx, box });
    expect(r.score).toBeCloseTo(2 / 3);
  });
});

describe('timing', () => {
  it('turns transport ticks into bar and beat, minus the mic delay', () => {
    expect(tickToBarBeat(768 * 2 + 192 * 1.5, 0, 192)).toEqual({ bar: 2, beat: 1.5 });
    expect(tickToBarBeat(768, 96, 192)).toEqual({ bar: 0, beat: 3.5 });
    expect(tickToBarBeat(10, 96, 192)).toEqual({ bar: 0, beat: 0 });
  });
});
