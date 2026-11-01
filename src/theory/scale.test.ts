import { describe, expect, it } from 'vitest';
import { getScale, SCALES } from './scale';
import { preferredTonic, accidentalPreferenceOf, speller } from './spelling';
import { FLAT_NAMES } from './note';

const names = (tonic: string, id: Parameters<typeof getScale>[1], strict = false) =>
  getScale(tonic, id, { strict }).notes.map((n) => n.name);
const ints = (id: Parameters<typeof getScale>[1]) => getScale('C', id).notes.map((n) => n.interval);

describe('scales', () => {
  it('spells all 15 major key signatures with 7 distinct letters (strict)', () => {
    const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    for (const k of keys) {
      const letters = new Set(names(k, 'major', true).map((n) => n[0]));
      expect(letters.size, k).toBe(7);
    }
    expect(names('F#', 'major', true)).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    expect(names('Gb', 'major', true)).toEqual(['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F']);
  });

  it('simplifies rare spellings by default', () => {
    expect(names('F#', 'major')).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'F']);
    expect(names('Gb', 'major')).toEqual(['Gb', 'Ab', 'Bb', 'B', 'Db', 'Eb', 'F']);
  });

  it('builds the common improvising scales correctly', () => {
    expect(names('A', 'minorPentatonic')).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(names('G', 'majorPentatonic')).toEqual(['G', 'A', 'B', 'D', 'E']);
    expect(names('E', 'blues')).toEqual(['E', 'G', 'A', 'Bb', 'B', 'D']);
    expect(names('D', 'dorian')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(names('G', 'mixolydian')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F']);
    expect(names('A', 'harmonicMinor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
  });

  it('labels intervals with the scale\'s own character notes', () => {
    expect(ints('minorPentatonic')).toEqual(['R', 'b3', '4', '5', 'b7']);
    expect(ints('blues')).toEqual(['R', 'b3', '4', 'b5', '5', 'b7']);
    expect(ints('lydian')).toEqual(['R', '2', '3', '#4', '5', '6', '7']);
    expect(ints('phrygian')).toEqual(['R', 'b2', 'b3', '4', '5', 'b6', 'b7']);
    expect(ints('dorian')).toEqual(['R', '2', 'b3', '4', '5', '6', 'b7']);
    expect(ints('melodicMinor')).toEqual(['R', '2', 'b3', '4', '5', '6', '7']);
  });

  it('every scale builds in every key', () => {
    for (const s of SCALES) {
      for (let pc = 0; pc < 12; pc++) {
        const tonic = preferredTonic(pc, s.id);
        const sc = getScale(tonic, s.id);
        expect(sc.notes[0]!.pc).toBe(pc);
        expect(new Set(sc.notes.map((n) => n.pc)).size).toBe(sc.notes.length);
      }
    }
  });
});

describe('spelling', () => {
  it('picks the readable tonic name', () => {
    expect(preferredTonic(1, 'major')).toBe('Db');
    expect(preferredTonic(1, 'minor')).toBe('C#');
    expect(preferredTonic(6, 'major')).toBe('F#');
    expect(preferredTonic(3, 'minor')).toBe('Eb');
    expect(preferredTonic(8, 'major')).toBe('Ab');
    expect(preferredTonic(8, 'minor')).toBe('G#');
    expect(preferredTonic(10, 'minorPentatonic')).toBe('Bb');
    expect(preferredTonic(6, 'minorPentatonic')).toBe('F#');
    expect(preferredTonic(4, 'major')).toBe('E');
  });

  it('knows sharp keys from flat keys', () => {
    expect(accidentalPreferenceOf('F', 'major', 'sharps')).toBe('flats');
    expect(accidentalPreferenceOf('E', 'minor', 'flats')).toBe('sharps');
    expect(accidentalPreferenceOf('C', 'major', 'flats')).toBe('flats');
    expect(accidentalPreferenceOf('A', 'minorPentatonic', 'sharps')).toBe('sharps');
  });

  it('names non-scale notes in the key\'s direction', () => {
    const sc = getScale('F', 'major');
    const spell = speller(sc.notes, accidentalPreferenceOf('F', 'major', 'sharps'));
    expect(spell(10)).toBe('Bb');
    expect(spell(1)).toBe('Db');
    expect(FLAT_NAMES.length).toBe(12);
  });
});
