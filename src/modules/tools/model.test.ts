import { describe, expect, it } from 'vitest';
import { midiToFrequency, STANDARD_TUNING, TUNINGS } from '@/theory';
import { median, nearestString, tuneAdvice } from './model';

describe('tuner logic', () => {
  it('finds the nearest string and cents', () => {
    expect(nearestString(STANDARD_TUNING, 82.41)).toMatchObject({ string: 6 });
    expect(nearestString(STANDARD_TUNING, midiToFrequency(55 - 0.2)).cents).toBe(-20);
    expect(nearestString(STANDARD_TUNING, midiToFrequency(55 - 0.2)).string).toBe(3);
    const dropD = TUNINGS.find((t) => t.id === 'dropD')!;
    expect(nearestString(dropD, midiToFrequency(38)).string).toBe(6);
  });

  it('advises which way to turn the peg', () => {
    expect(tuneAdvice(-20)).toBe('tuneUp');
    expect(tuneAdvice(12)).toBe('tuneDown');
    expect(tuneAdvice(3)).toBe('inTune');
  });

  it('takes a median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});
