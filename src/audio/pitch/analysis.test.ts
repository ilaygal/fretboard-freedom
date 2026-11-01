import { describe, expect, it } from 'vitest';
import { midiToFrequency } from '@/theory';
import { noteFromFrequency, PitchStabilizer, rms } from './analysis';

const frame = (midi: number, cents = 0, clarity = 0.97, volume = 0.1) => ({
  frequency: midiToFrequency(midi + cents / 100),
  clarity,
  volume,
});

describe('noteFromFrequency', () => {
  it('names notes and cents', () => {
    expect(noteFromFrequency(440)).toEqual({ midi: 69, cents: 0, name: 'A4' });
    expect(noteFromFrequency(82.41)).toMatchObject({ midi: 40, name: 'E2' });
    expect(noteFromFrequency(midiToFrequency(55.2)).cents).toBe(20);
    expect(noteFromFrequency(midiToFrequency(54.8)).midi).toBe(55);
    expect(noteFromFrequency(midiToFrequency(54.8)).cents).toBe(-20);
  });
});

describe('PitchStabilizer', () => {
  it('reports a note once it is steady', () => {
    const s = new PitchStabilizer();
    expect(s.push(frame(52))).toBeNull();
    expect(s.push(frame(52, 5))).toBeNull();
    expect(s.push(frame(52, -5))).toBeNull();
    expect(s.push(frame(52))).toBe(52);
    expect(s.push(frame(52))).toBeNull(); // not again while it rings
  });

  it('ignores unclear, quiet or out-of-range frames', () => {
    const s = new PitchStabilizer();
    for (let i = 0; i < 6; i++) expect(s.push(frame(52, 0, 0.5))).toBeNull();
    for (let i = 0; i < 6; i++) expect(s.push(frame(52, 0, 0.99, 0.001))).toBeNull();
    for (let i = 0; i < 6; i++) expect(s.push(frame(20))).toBeNull();
  });

  it('reports a new note, and the same note again after silence', () => {
    const s = new PitchStabilizer();
    const play = (m: number) => {
      let out: number | null = null;
      for (let i = 0; i < 4; i++) out = s.push(frame(m)) ?? out;
      return out;
    };
    expect(play(52)).toBe(52);
    expect(play(55)).toBe(55);
    s.push(frame(55, 0, 0.99, 0));
    expect(play(55)).toBe(55);
  });

  it('rejects frames far between two notes', () => {
    const s = new PitchStabilizer();
    for (let i = 0; i < 6; i++) expect(s.push(frame(52, 49))).toBeNull();
  });
});

describe('rms', () => {
  it('measures level', () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0);
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
  });
});
