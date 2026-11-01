import { describe, expect, it } from 'vitest';
import { degreeLabel, plainIntervalName, semitonesOfSymbol, symbolFromSemitones, symbolFromTonal } from './interval';
import { Interval } from 'tonal';

describe('interval symbols', () => {
  it('has a default symbol for every semitone', () => {
    expect([...Array(12).keys()].map(symbolFromSemitones)).toEqual([
      'R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7',
    ]);
    expect(symbolFromSemitones(15)).toBe('b3');
  });

  it('converts Tonal names, keeping the theory-correct name', () => {
    const cases: [string, string][] = [
      ['1P', 'R'], ['8P', 'R'], ['2m', 'b2'], ['2M', '2'], ['2A', '#2'], ['3m', 'b3'], ['3M', '3'],
      ['4P', '4'], ['4A', '#4'], ['5d', 'b5'], ['5P', '5'], ['5A', '#5'], ['6m', 'b6'], ['6M', '6'],
      ['7d', 'bb7'], ['7m', 'b7'], ['7M', '7'], ['9m', 'b9'], ['9M', '9'], ['9A', '#9'],
      ['11P', '11'], ['11A', '#11'], ['13m', 'b13'], ['13M', '13'],
    ];
    for (const [tonal, ours] of cases) expect(symbolFromTonal(tonal), tonal).toBe(ours);
  });

  it('folds compound intervals in scale context', () => {
    expect(symbolFromTonal('9M', false)).toBe('2');
    expect(symbolFromTonal('11A', false)).toBe('#4');
    expect(symbolFromTonal('13m', false)).toBe('b6');
  });

  it('symbols and semitones agree with Tonal for every interval it names', () => {
    const names = ['1P', '2m', '2M', '2A', '3m', '3M', '4P', '4A', '5d', '5P', '5A', '6m', '6M', '7d', '7m', '7M', '9m', '9M', '9A', '11P', '11A', '13m', '13M'];
    for (const n of names) {
      expect(semitonesOfSymbol(symbolFromTonal(n)), n).toBe(Interval.semitones(n)! % 12);
    }
  });

  it('labels degrees with 1 for the root', () => {
    expect(degreeLabel('R')).toBe('1');
    expect(degreeLabel('b3')).toBe('b3');
  });

  it('explains every default symbol in plain words', () => {
    for (let i = 0; i < 12; i++) {
      const s = symbolFromSemitones(i);
      expect(plainIntervalName(s)).not.toBe(s);
    }
    expect(plainIntervalName('R')).toMatch(/home note/);
  });
});
