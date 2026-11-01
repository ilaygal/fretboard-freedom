import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, getChord } from './chord';

const tones = (root: string, type: Parameters<typeof getChord>[1]) => getChord(root, type).tones;

describe('chords', () => {
  it('builds triads with the right notes and intervals', () => {
    expect(tones('C', 'maj').map((t) => t.name)).toEqual(['C', 'E', 'G']);
    expect(tones('A', 'min').map((t) => t.name)).toEqual(['A', 'C', 'E']);
    expect(tones('B', 'dim').map((t) => t.interval)).toEqual(['R', 'b3', 'b5']);
    expect(tones('C', 'aug').map((t) => t.interval)).toEqual(['R', '3', '#5']);
    expect(tones('D', 'sus4').map((t) => t.name)).toEqual(['D', 'G', 'A']);
  });

  it('builds sevenths and extensions', () => {
    expect(tones('C', 'maj7').map((t) => t.interval)).toEqual(['R', '3', '5', '7']);
    expect(tones('G', '7').map((t) => t.name)).toEqual(['G', 'B', 'D', 'F']);
    expect(tones('B', 'm7b5').map((t) => t.interval)).toEqual(['R', 'b3', 'b5', 'b7']);
    expect(tones('C', 'dim7').map((t) => t.interval)).toEqual(['R', 'b3', 'b5', 'bb7']);
    expect(tones('C', '9').map((t) => t.interval)).toEqual(['R', '3', '5', 'b7', '9']);
    expect(tones('C', '6').map((t) => t.interval)).toEqual(['R', '3', '5', '6']);
  });

  it('writes chord symbols', () => {
    expect(getChord('F#', 'm7').symbol).toBe('F#m7');
    expect(getChord('Bb', 'maj').symbol).toBe('Bb');
  });

  it('every chord type builds on every root', () => {
    const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (const t of CHORD_TYPES) {
      for (const r of roots) {
        const c = getChord(r, t.id);
        expect(c.tones[0]!.interval).toBe('R');
        expect(c.tones.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
