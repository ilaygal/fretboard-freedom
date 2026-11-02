import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  cagedVoicings,
  dropVoicings,
  hasStandardIntervals,
  insideWindow,
  movement,
  nameChord,
  transposeSymbol,
  triadVoicings,
  voiceLeadPath,
  MAX_STRETCH,
  type Voicing,
} from './voicings';
import { getChord, type ChordTypeId } from './chord';
import { STANDARD_TUNING, TUNINGS, getTuning } from './tuning';
import { midiAt, pitchClassAt } from './fretboard';
import { SHARP_NAMES, pitchClassName, mod12 } from './note';
import { resolveProgression } from './progression';

const T = STANDARD_TUNING;
const frets = (v: Voicing) => v.notes.map((n) => `${n.string}:${n.fret}`).join(' ');
const sharp = (pc: number) => pitchClassName(pc, 'sharps');
const flat = (pc: number) => pitchClassName(pc, 'flats');

function checkVoicing(t: typeof T, v: Voicing, chordPcs: number[]) {
  const pcs = v.notes.map((n) => pitchClassAt(t, n));
  for (const pc of pcs) expect(chordPcs).toContain(pc);
  const midis = v.notes.map((n) => midiAt(t, n));
  for (let i = 1; i < midis.length; i++) expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
  const pressed = v.notes.map((n) => n.fret).filter((f) => f > 0);
  if (pressed.length) expect(Math.max(...pressed) - Math.min(...pressed)).toBeLessThanOrEqual(MAX_STRETCH);
  expect(new Set(v.notes.map((n) => n.string)).size).toBe(v.notes.length);
}

describe('triads', () => {
  it('finds the familiar C major shapes on the top three strings', () => {
    const vs = triadVoicings(T, getChord('C', 'maj'), 15, [[3, 2, 1]]);
    expect(vs.map(frets)).toEqual(expect.arrayContaining(['3:0 2:1 1:0', '3:5 2:5 1:3', '3:9 2:8 1:8', '3:12 2:13 1:12']));
    expect(vs.find((v) => frets(v) === '3:5 2:5 1:3')!.inversion).toBe(0); // C E G
    expect(vs.find((v) => frets(v) === '3:9 2:8 1:8')!.inversion).toBe(1); // E G C
    expect(vs.find((v) => frets(v) === '3:0 2:1 1:0')!.inversion).toBe(2); // G C E
  });

  it('plays every inversion on every string set, in every key and tuning', () => {
    const types: ChordTypeId[] = ['maj', 'min', 'dim', 'aug', 'sus4'];
    fc.assert(
      fc.property(fc.constantFrom(...SHARP_NAMES), fc.constantFrom(...types), fc.constantFrom(...TUNINGS), (root, type, t) => {
        const chord = getChord(root, type);
        const pcs = chord.tones.map((x) => x.pc);
        const vs = triadVoicings(t, chord, 22);
        for (const v of vs) {
          checkVoicing(t, v, pcs);
          expect(new Set(v.notes.map((n) => pitchClassAt(t, n))).size).toBe(3);
          expect(midiAt(t, v.notes[2]!) - midiAt(t, v.notes[0]!)).toBeLessThan(12);
          expect(pitchClassAt(t, v.notes[0]!)).toBe(pcs[v.inversion]);
        }
        // In standard-shaped tunings, 4 string sets x 3 inversions are each available somewhere on the neck.
        // (Open tunings can't fit every close triad under one hand.)
        if (!hasStandardIntervals(t)) return;
        for (const set of [[6, 5, 4], [5, 4, 3], [4, 3, 2], [3, 2, 1]]) {
          for (let inv = 0; inv < 3; inv++) {
            expect(vs.some((v) => v.strings.join() === set.join() && v.inversion === inv)).toBe(true);
          }
        }
      }),
      { numRuns: 120 },
    );
  });
});

describe('drop-2 and drop-3', () => {
  it('gives the classic drop-2 Cmaj7 on the middle strings', () => {
    const vs = dropVoicings(T, getChord('C', 'maj7'), 'drop2', 15);
    // C maj7 root position on strings 4-1: G C E B? No: drop-2 root position on 4-1 is C G B E (10 12 12 12)
    expect(vs.map(frets)).toContain('4:10 3:12 2:12 1:12');
  });

  it('gives the drop-3 G7 with the bass on string 6', () => {
    const vs = dropVoicings(T, getChord('G', '7'), 'drop3', 15);
    expect(vs.map(frets)).toContain('6:3 4:3 3:4 2:3');
  });

  it('uses all four chord tones once, in every key and tuning', () => {
    const types: ChordTypeId[] = ['7', 'maj7', 'm7', 'm7b5', 'dim7', '6'];
    fc.assert(
      fc.property(
        fc.constantFrom(...SHARP_NAMES),
        fc.constantFrom(...types),
        fc.constantFrom<'drop2' | 'drop3'>('drop2', 'drop3'),
        fc.constantFrom(...TUNINGS),
        (root, type, kind, t) => {
          const chord = getChord(root, type);
          const pcs = chord.tones.map((x) => x.pc);
          const vs = dropVoicings(t, chord, kind, 22);
          expect(vs.length).toBeGreaterThan(0);
          for (const v of vs) {
            checkVoicing(t, v, pcs);
            expect(new Set(v.notes.map((n) => pitchClassAt(t, n))).size).toBe(4);
          }
        },
      ),
      { numRuns: 120 },
    );
  });
});

describe('CAGED', () => {
  it('moves the five shapes up the neck for A major', () => {
    const vs = cagedVoicings(T, getChord('A', 'maj'), 22);
    const byShape = Object.fromEntries(vs.map((v) => [v.shape, frets(v)]));
    expect(byShape.A).toBe('5:0 4:2 3:2 2:2 1:0');
    expect(byShape.G).toBe('6:5 5:4 4:2 3:2 2:2 1:5');
    expect(byShape.E).toBe('6:5 5:7 4:7 3:6 2:5 1:5');
    expect(byShape.D).toBe('4:7 3:9 2:10 1:9');
    expect(byShape.C).toBe('5:12 4:11 3:9 2:10 1:9');
  });

  it('plays only chord tones, all five shapes, in standard and moved tunings', () => {
    const tunings = ['standard', 'eb', 'dStandard'].map((id) => getTuning(id));
    for (const t of tunings) {
      for (const root of SHARP_NAMES) {
        for (const type of ['maj', 'min'] as const) {
          const chord = getChord(root, type);
          const pcs = chord.tones.map((x) => x.pc);
          const vs = cagedVoicings(t, chord, 22);
          expect(new Set(vs.map((v) => v.shape)).size).toBe(5);
          for (const v of vs) {
            for (const n of v.notes) expect(pcs).toContain(pitchClassAt(t, n));
            expect(new Set(v.notes.map((n) => pitchClassAt(t, n)))).toEqual(new Set(pcs));
          }
        }
      }
    }
  });

  it('falls back to nothing in open tunings', () => {
    expect(hasStandardIntervals(getTuning('openG'))).toBe(false);
    expect(cagedVoicings(getTuning('openG'), getChord('G', 'maj'), 22)).toEqual([]);
    expect(hasStandardIntervals(getTuning('dropD'))).toBe(false);
  });
});

describe('voice leading through a progression', () => {
  it('finds a smooth path for I-V-vi-IV in every key and every window', () => {
    for (const key of SHARP_NAMES) {
      const chords = resolveProgression(key, ['I', 'V', 'vi', 'IV']);
      const candidates = chords.map((c) => triadVoicings(T, c, 22));
      for (let from = 0; from <= 12; from++) {
        const w = { from, to: from + 4 };
        const path = voiceLeadPath(T, candidates, w);
        expect(path, `${key} at fret ${from}`).not.toBeNull();
        path!.forEach((v, i) => {
          expect(insideWindow(v, w)).toBe(true);
          expect(new Set(v.notes.map((n) => pitchClassAt(T, n)))).toEqual(new Set(chords[i]!.tones.map((x) => x.pc)));
        });
        // Smooth: on average each of the three voices moves under 2.5 semitones per change.
        for (let i = 1; i < path!.length; i++) {
          expect(movement(T, path![i - 1]!, path![i]!)).toBeLessThanOrEqual(7);
        }
      }
    }
  });
});

describe('naming notes (chord builder)', () => {
  it('names common chords and slash chords', () => {
    expect(nameChord([0, 4, 7], 0, sharp)[0]!.symbol).toBe('C');
    expect(nameChord([0, 4, 7], 4, sharp)[0]!.symbol).toBe('C/E');
    expect(nameChord([9, 0, 4], 9, sharp)[0]!.symbol).toBe('Am');
    expect(nameChord([7, 11, 2, 5], 7, sharp)[0]!.symbol).toBe('G7');
    expect(nameChord([4, 11], 4, sharp)[0]!.symbol).toBe('E5');
  });

  it('gives both readings of ambiguous sets, bass-rooted first', () => {
    const names = nameChord([9, 0, 4, 7], 9, sharp).map((n) => n.symbol);
    expect(names[0]).toBe('Am7');
    expect(names).toContain('C6/A');
  });

  it('round-trips every chord type in every key', () => {
    const types: ChordTypeId[] = ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'm7', 'm7b5', 'sus2', 'sus4'];
    for (const root of SHARP_NAMES) {
      for (const type of types) {
        const c = getChord(root, type);
        const names = nameChord(c.tones.map((x) => x.pc), c.tones[0]!.pc, sharp);
        expect(names.some((n) => n.type === type && !n.bass && mod12(n.root.charCodeAt(0)) >= 0 && n.root === sharp(c.tones[0]!.pc))).toBe(true);
      }
    }
  });
});

describe('transpose', () => {
  it('moves roots and bass notes', () => {
    expect(transposeSymbol('Am', 3, sharp)).toBe('Cm');
    expect(transposeSymbol('F#7', -2, sharp)).toBe('E7');
    expect(transposeSymbol('C/E', 5, flat)).toBe('F/A');
    expect(transposeSymbol('Bbmaj7', 2, flat)).toBe('Cmaj7');
    expect(() => transposeSymbol('H7', 1, sharp)).toThrow();
  });
});
