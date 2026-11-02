import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING, getChord, getTuning, midiAt, resolveProgression, insideWindow } from '@/theory';
import { kindsFor, nearestVoicing, tappedNotes, toggleTap, trainerPlan, voiceMoves, voicingMarkers, voicingsFor } from './model';

const T = STANDARD_TUNING;

describe('shape families', () => {
  it('offers triads and CAGED for major/minor, drop shapes for sevenths', () => {
    expect(kindsFor('maj', T)).toEqual(['triad', 'caged']);
    expect(kindsFor('m7', T)).toEqual(['drop2', 'drop3']);
    expect(kindsFor('maj', getTuning('openG'))).toEqual(['triad']);
  });
});

describe('voicing markers', () => {
  it('lights the voicing and greys the rest of the chord', () => {
    const c = getChord('C', 'maj');
    const v = voicingsFor(T, c, 'triad', 15).find((x) => x.strings.join() === '3,2,1' && x.inversion === 0)!;
    const m = voicingMarkers(T, c, v, 'note', { from: 0, to: 15 }, true);
    const lit = m.filter((x) => x.role !== 'ghost');
    expect(lit).toHaveLength(3);
    expect(lit.filter((x) => x.role === 'root')).toHaveLength(1);
    expect(m.length).toBeGreaterThan(20);
  });
});

describe('finding your place', () => {
  it('picks the voicing nearest a fret', () => {
    const vs = voicingsFor(T, getChord('G', 'maj'), 'caged', 22);
    expect(vs[nearestVoicing(vs, 3)]!.shape).toMatch(/G|E/);
    expect(nearestVoicing([], 3)).toBe(-1);
  });
});

describe('voice-leading view', () => {
  it('draws a line for each voice that moves, none for common tones', () => {
    const at = (frets: string) => (v: { notes: { string: number; fret: number }[] }) => v.notes.map((n) => `${n.string}:${n.fret}`).join(' ') === frets;
    const vc = voicingsFor(T, getChord('C', 'maj'), 'triad', 15).find(at('3:5 2:5 1:3'))!; // C E G
    const vf = voicingsFor(T, getChord('F', 'maj'), 'triad', 15).find(at('3:5 2:6 1:5'))!; // C F A
    const moves = voiceMoves(T, vc, vf);
    expect(moves.length).toBe(2); // C stays, E->F and G->A move
    for (const mv of moves) expect(Math.abs(midiAt(T, mv.to) - midiAt(T, mv.from))).toBeLessThanOrEqual(2);
  });
});

describe('progression trainer', () => {
  it('plans I-V-vi-IV inside the window, sliding when needed', () => {
    const chords = resolveProgression('G', ['I', 'V', 'vi', 'IV']);
    const plan = trainerPlan(T, chords, 'triad', { from: 5, to: 9 }, 22)!;
    expect(plan.path).toHaveLength(4);
    for (const v of plan.path) expect(insideWindow(v, plan.window)).toBe(true);
    const sevenths = resolveProgression('C', ['ii7', 'V7', 'Imaj7', 'Imaj7']);
    const p7 = trainerPlan(T, sevenths, 'drop2', { from: 3, to: 7 }, 22)!;
    expect(p7.path).toHaveLength(4);
    for (const v of p7.path) expect(insideWindow(v, p7.window)).toBe(true);
  });
});

describe('chord builder taps', () => {
  it('keeps one note per string and finds the bass', () => {
    let taps = toggleTap([], { string: 5, fret: 3 });
    taps = toggleTap(taps, { string: 4, fret: 2 });
    taps = toggleTap(taps, { string: 3, fret: 0 });
    taps = toggleTap(taps, { string: 4, fret: 5 }); // replaces string 4
    expect(taps).toHaveLength(3);
    taps = toggleTap(taps, { string: 4, fret: 5 }); // same spot clears
    expect(taps).toHaveLength(2);
    const { pcs, bassPc } = tappedNotes(T, [{ string: 5, fret: 3 }, { string: 4, fret: 2 }, { string: 3, fret: 0 }]);
    expect(new Set(pcs)).toEqual(new Set([0, 4, 7]));
    expect(bassPc).toBe(0);
  });
});
