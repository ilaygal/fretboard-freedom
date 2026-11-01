import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  frequencyToMidi,
  midiToFrequency,
  midiToName,
  mod12,
  nameToMidi,
  pitchClassName,
  pitchClassOf,
  prettyNote,
  simplifyName,
  toFixedDo,
} from './note';

describe('note basics', () => {
  it('maps names to pitch classes, including enharmonics', () => {
    expect(pitchClassOf('C')).toBe(0);
    expect(pitchClassOf('C#')).toBe(1);
    expect(pitchClassOf('Db')).toBe(1);
    expect(pitchClassOf('B#')).toBe(0);
    expect(pitchClassOf('Cb')).toBe(11);
    expect(pitchClassOf('E#')).toBe(5);
    expect(pitchClassOf('F##')).toBe(7);
  });

  it('rejects invalid names', () => {
    expect(() => pitchClassOf('H')).toThrow();
    expect(() => nameToMidi('C')).toThrow();
  });

  it('names pitch classes by preference', () => {
    expect(pitchClassName(10, 'flats')).toBe('Bb');
    expect(pitchClassName(10, 'sharps')).toBe('A#');
    expect(pitchClassName(-1, 'sharps')).toBe('B');
  });

  it('uses scientific octaves (middle C = C4 = MIDI 60)', () => {
    expect(nameToMidi('C4')).toBe(60);
    expect(nameToMidi('E2')).toBe(40);
    expect(midiToName(64, 'sharps')).toBe('E4');
    expect(midiToName(61, 'flats')).toBe('Db4');
    expect(midiToName(59, 'sharps')).toBe('B3');
  });

  it('round-trips MIDI and names for every note in guitar range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 28, max: 100 }), fc.boolean(), (midi, flats) => {
        expect(nameToMidi(midiToName(midi, flats ? 'flats' : 'sharps'))).toBe(midi);
      }),
    );
  });

  it('converts frequency and MIDI both ways', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440);
    expect(midiToFrequency(40)).toBeCloseTo(82.407, 2);
    fc.assert(
      fc.property(fc.double({ min: 20, max: 110, noNaN: true }), (m) => {
        expect(frequencyToMidi(midiToFrequency(m))).toBeCloseTo(m, 6);
      }),
    );
  });

  it('mod12 handles negatives', () => {
    expect(mod12(-13)).toBe(11);
    expect(mod12(24)).toBe(0);
  });

  it('simplifies rare spellings only', () => {
    expect(simplifyName('Cb')).toBe('B');
    expect(simplifyName('E#')).toBe('F');
    expect(simplifyName('Fb')).toBe('E');
    expect(simplifyName('B#')).toBe('C');
    expect(simplifyName('F##')).toBe('G');
    expect(simplifyName('Bbb')).toBe('A');
    expect(simplifyName('F#')).toBe('F#');
    expect(simplifyName('Bb')).toBe('Bb');
  });

  it('formats display names and fixed-do solfège', () => {
    expect(prettyNote('Bb')).toBe('B♭');
    expect(prettyNote('F#')).toBe('F♯');
    expect(prettyNote('B')).toBe('B');
    expect(toFixedDo('C')).toBe('Do');
    expect(toFixedDo('G')).toBe('Sol');
    expect(toFixedDo('B')).toBe('Si');
    expect(toFixedDo('F#')).toBe('Fa♯');
    expect(toFixedDo('Eb')).toBe('Mi♭');
  });
});
