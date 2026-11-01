import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { STANDARD_TUNING, getChord, midiAt, pitchClassAt, scalePositions } from '@/theory';
import { PROGRESSIONS, STYLES, getProgression } from '@/content/backing';
import { seededRng } from '@/domain/drills/engine';
import { zoomTo, chordAt, jamChords, jamMarkers, jamTonic, jamTrack, randomJam, withProgression, withStyle, type JamChoice } from './model';

const range = { from: 0, to: 15 };
const aBlues: JamChoice = { tonicPc: 9, progressionId: 'twelveBar', styleId: 'blues', bpm: 88, scale: 'minorPentatonic' };

describe('surprise me', () => {
  it('always gives a playable jam whose progression suits its style', () => {
    fc.assert(
      fc.property(fc.integer(), fc.subarray(['rock', 'blues', 'funk', 'pop', 'jazz', 'ballad', 'reggae']), (seed, liked) => {
        const j = randomJam(seededRng(seed), liked);
        const prog = getProgression(j.progressionId);
        expect(prog.styles).toContain(j.styleId);
        expect(prog.scales).toContain(j.scale);
        const style = STYLES.find((s) => s.id === j.styleId)!;
        expect(j.bpm).toBeGreaterThanOrEqual(style.bpm.min);
        expect(j.bpm).toBeLessThanOrEqual(style.bpm.max);
        expect(jamTrack(j).track.events.length).toBeGreaterThan(0);
      }),
      { numRuns: 80 },
    );
  });

  it('leans toward the styles the player likes', () => {
    const rng = seededRng(7);
    const runs = Array.from({ length: 300 }, () => randomJam(rng, ['funk']));
    const funk = runs.filter((r) => r.styleId === 'funk').length;
    expect(funk).toBeGreaterThan(150);
  });

  it('gives something different when asked again', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 50; i++) {
      const next = randomJam(rng, [], aBlues);
      expect(next.progressionId !== aBlues.progressionId || next.tonicPc !== aBlues.tonicPc).toBe(true);
    }
  });
});

describe('jam settings', () => {
  it('spells the key for the mode', () => {
    expect(jamTonic({ tonicPc: 10, progressionId: 'popAnthem' })).toBe('Bb');
    expect(jamTonic({ tonicPc: 1, progressionId: 'epicMinor' })).toBe('C#');
  });

  it('builds the 12-bar blues in A with sevenths', () => {
    expect(jamChords(aBlues).map((c) => c.symbol)).toEqual(['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7']);
  });

  it('keeps a progression that suits the new style, otherwise swaps it', () => {
    expect(withStyle(aBlues, 'rock').progressionId).toBe('twelveBar');
    const funk = withStyle(aBlues, 'funk');
    expect(getProgression(funk.progressionId).styles).toContain('funk');
    expect(withProgression(aBlues, 'twoFiveOne').scale).toBe('majorPentatonic');
  });

  it('knows the chord now and the one coming next, looping round', () => {
    const chords = jamChords(aBlues);
    expect(chordAt(chords, 3).next.symbol).toBe('D7');
    expect(chordAt(chords, 11).next.symbol).toBe('A7');
  });
});

describe('the neck while jamming', () => {
  const base = {
    tuning: STANDARD_TUNING,
    range,
    tonic: 'A',
    scale: 'minorPentatonic' as const,
    chord: getChord('A', '7'),
    upcoming: null,
    labelMode: 'note' as const,
    wheels: 'map' as const,
    position: null,
  };

  it('marks home, the chord, the scale and blue notes', () => {
    const m = jamMarkers(base);
    const roleAt = (s: number, f: number) => m.find((x) => x.pos.string === s && x.pos.fret === f)?.role;
    expect(roleAt(6, 5)).toBe('root'); // A
    expect(roleAt(5, 4)).toBe('chord'); // C#, the A7's major third, not in the scale but in the chord
    expect(roleAt(6, 8)).toBe('blue'); // C over a dominant chord
    expect(roleAt(5, 5)).toBe('avoid'); // D sits a half step above the chord's C#
    const overD7 = jamMarkers({ ...base, chord: getChord('D', '7') });
    expect(overD7.find((x) => x.pos.string === 5 && x.pos.fret === 7)?.role).toBe('scale'); // E over D7
    expect(roleAt(6, 6)).toBeUndefined(); // A# is neither in the scale nor the chord
  });

  it('shows the next chord as targets just before it arrives', () => {
    const m = jamMarkers({ ...base, upcoming: getChord('D', '7') });
    const fsharp = m.filter((x) => pitchClassAt(STANDARD_TUNING, x.pos) === 6);
    expect(fsharp.length).toBeGreaterThan(0);
    expect(fsharp.every((x) => x.role === 'target')).toBe(true);
  });

  it('takes the training wheels off step by step', () => {
    const roles = (w: 'map' | 'chordTones' | 'home' | 'off') => new Set(jamMarkers({ ...base, wheels: w }).map((x) => x.role));
    expect(roles('chordTones')).toEqual(new Set(['root', 'chord']));
    expect(roles('home')).toEqual(new Set(['root']));
    expect(jamMarkers({ ...base, wheels: 'off' })).toEqual([]);
  });

  it('greys out notes outside the chosen box', () => {
    const [box1] = scalePositions(STANDARD_TUNING, 'A', 'minorPentatonic', 15);
    const m = jamMarkers({ ...base, position: box1! });
    for (const x of m) {
      if (x.pos.fret < 4 || x.pos.fret > 9) expect(x.role).toBe('ghost');
    }
    const lit = m.filter((x) => x.role !== 'ghost');
    expect(lit.some((x) => x.pos.string === 6 && x.pos.fret === 5)).toBe(true);
  });

  it('never shows a note that is neither in the scale nor the chords, in any progression', () => {
    for (const p of PROGRESSIONS) {
      const choice = { tonicPc: 4, progressionId: p.id, styleId: p.styles[0]!, bpm: 100, scale: p.scales[0]! };
      const chords = jamChords(choice);
      const tonic = jamTonic(choice);
      chords.forEach((chord, i) => {
        const upcoming = chords[(i + 1) % chords.length]!;
        const m = jamMarkers({ ...base, tonic, scale: choice.scale, chord, upcoming });
        for (const x of m) expect(midiAt(STANDARD_TUNING, x.pos)).toBeGreaterThan(0);
        expect(m.length).toBeGreaterThan(0);
      });
    }
  });
});

describe('zooming to a box', () => {
  it('shows the box with a fret below and two above, inside the neck', () => {
    expect(zoomTo({ from: 5, to: 8 }, 22)).toEqual({ from: 4, to: 10 });
    expect(zoomTo({ from: 0, to: 3 }, 22)).toEqual({ from: 0, to: 5 });
    expect(zoomTo({ from: 17, to: 21 }, 22)).toEqual({ from: 16, to: 22 });
  });
});
