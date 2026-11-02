import { describe, expect, it } from 'vitest';
import { getChallenge } from '@/content/challenges';
import { seededRng } from '@/domain/drills/engine';
import type { ImprovReport } from '@/domain/improv/analysis';
import { pickNewBox, verdict, wheelsFor, yourTurn } from './model';

const report = (p: Partial<ImprovReport>): ImprovReport => ({
  notes: 20,
  chordTonePct: 0.5,
  insidePct: 1,
  lowest: 50,
  highest: 70,
  registers: { low: 5, mid: 10, high: 5 },
  distinctNotes: 5,
  barsPlayed: 8,
  score: 1,
  detail: {},
  ...p,
});

describe('challenge helpers', () => {
  it('helps with chord notes when the rule is about them', () => {
    expect(wheelsFor(getChallenge('chordTones'))).toBe('chordTones');
    expect(wheelsFor(getChallenge('threeNotes'))).toBe('map');
  });

  it('never picks box 1 for "new position"', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 50; i++) {
      const b = pickNewBox(rng, 5);
      expect(b).toBeGreaterThanOrEqual(2);
      expect(b).toBeLessThanOrEqual(5);
    }
    expect(pickNewBox(rng, 1)).toBe(1);
  });

  it('takes turns in call and response', () => {
    const cr = getChallenge('callResponse');
    expect([0, 1, 2, 3].map((b) => yourTurn(cr, b))).toEqual([false, true, false, true]);
    expect(yourTurn(getChallenge('freeJam'), 0)).toBe(true);
  });
});

describe('verdict', () => {
  it('gives no stars and a nudge for silence', () => {
    expect(verdict(getChallenge('chordTones'), report({ notes: 0 }))).toEqual({ stars: 0, passed: false, tips: ['playMore'] });
  });

  it('passes with stars when the rule is kept', () => {
    const v = verdict(getChallenge('threeNotes'), report({ score: 1 }));
    expect(v.passed).toBe(true);
    expect(v.stars).toBe(3);
  });

  it('explains a miss', () => {
    const v = verdict(getChallenge('chordTones'), report({ score: 0.3, chordTonePct: 0.3 }));
    expect(v.passed).toBe(false);
    expect(v.tips).toEqual(['keepRule', 'aimChord']);
  });

  it('suggests going higher when everything was low', () => {
    const v = verdict(getChallenge('freeJam'), report({ registers: { low: 12, mid: 4, high: 0 }, chordTonePct: 0.6 }));
    expect(v.tips).toContain('goHigher');
    expect(v.passed).toBe(true);
  });
});
