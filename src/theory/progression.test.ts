import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { chordFromNumeral, parseNumeral, resolveProgression } from './progression';
import { FLAT_NAMES, SHARP_NAMES, mod12, pitchClassOf } from './note';

const symbols = (tonic: string, ns: string[]) => resolveProgression(tonic, ns).map((c) => c.symbol);

describe('roman numerals', () => {
  it('builds the pop progression in common keys', () => {
    expect(symbols('C', ['I', 'V', 'vi', 'IV'])).toEqual(['C', 'G', 'Am', 'F']);
    expect(symbols('D', ['I', 'V', 'vi', 'IV'])).toEqual(['D', 'A', 'Bm', 'G']);
    expect(symbols('F', ['I', 'IV', 'V'])).toEqual(['F', 'Bb', 'C']);
    expect(symbols('Eb', ['I', 'IV', 'V'])).toEqual(['Eb', 'Ab', 'Bb']);
  });

  it('counts minor-key chords from the major scale of the home note', () => {
    expect(symbols('A', ['i', 'bVI', 'bIII', 'bVII'])).toEqual(['Am', 'F', 'C', 'G']);
    expect(symbols('E', ['i', 'bVII', 'bVI', 'bVII'])).toEqual(['Em', 'D', 'C', 'D']);
    expect(symbols('C#', ['i', 'bVI', 'bIII', 'bVII'])).toEqual(['C#m', 'A', 'E', 'B']);
  });

  it('reads sevenths and other suffixes', () => {
    expect(symbols('E', ['I7', 'IV7', 'V7'])).toEqual(['E7', 'A7', 'B7']);
    expect(symbols('C', ['ii7', 'V7', 'Imaj7'])).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(symbols('A', ['iiø7', 'V7', 'i7'])).toEqual(['Bm7b5', 'E7', 'Am7']);
    expect(symbols('G', ['vii°'])).toEqual(['F#dim']);
    expect(parseNumeral('#IV°7')).toEqual({ interval: '4A', type: 'dim7' });
    expect(parseNumeral('bV')).toEqual({ interval: '5d', type: 'maj' });
  });

  it('rejects things that are not numerals', () => {
    expect(() => parseNumeral('X')).toThrow();
    expect(() => parseNumeral('Iwhat')).toThrow();
  });

  it('puts every degree the right distance from the home note, in every key', () => {
    const offsets: Record<string, number> = { I: 0, ii: 2, iii: 4, IV: 5, V: 7, vi: 9, bVII: 10, bIII: 3, bVI: 8 };
    fc.assert(
      fc.property(fc.constantFrom(...SHARP_NAMES, ...FLAT_NAMES), fc.constantFrom(...Object.keys(offsets)), (tonic, n) => {
        const chord = chordFromNumeral(tonic, n);
        expect(mod12(pitchClassOf(chord.root) - pitchClassOf(tonic))).toBe(offsets[n]);
        // Simplified spelling: never a rare name or a double accidental.
        expect(chord.root).not.toMatch(/^(Cb|Fb|E#|B#)$|##|bb/);
      }),
    );
  });
});
