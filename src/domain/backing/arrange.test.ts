import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PROGRESSIONS, STYLES, getProgression, getStyle } from '@/content/backing';
import { SHARP_NAMES, getChord, mod12 } from '@/theory';
import { BAR_TICKS, BASS_RANGE, COMP_RANGE, arrange, bassNote, chordsFor, colourNumeral, voiceLead } from './arrange';

describe('style and progression data', () => {
  it('has one grid step per character in every pattern', () => {
    for (const s of STYLES) {
      for (const p of Object.values(s.drums)) expect(p, s.id).toHaveLength(s.steps);
      expect(s.comp, s.id).toHaveLength(s.steps);
      expect(s.bass.split(/\s+/), s.id).toHaveLength(s.steps);
      expect(s.bpm.min).toBeLessThanOrEqual(s.bpm.default);
      expect(s.bpm.default).toBeLessThanOrEqual(s.bpm.max);
    }
  });

  it('builds every progression in every style and key', () => {
    for (const p of PROGRESSIONS) {
      for (const s of STYLES) for (const k of SHARP_NAMES) expect(() => chordsFor(k, p, s)).not.toThrow();
      for (const s of p.styles) expect(STYLES.map((x) => x.id)).toContain(s);
    }
  });
});

describe('chord colour', () => {
  it('adds sevenths that suit the style', () => {
    expect(colourNumeral('I', getStyle('rock'))).toBe('I');
    expect(colourNumeral('IV', getStyle('blues'))).toBe('IV7');
    expect(colourNumeral('I', getStyle('jazz'))).toBe('Imaj7');
    expect(colourNumeral('V', getStyle('jazz'))).toBe('V7');
    expect(colourNumeral('vi', getStyle('jazz'))).toBe('vi7');
    expect(colourNumeral('iiø7', getStyle('jazz'))).toBe('iiø7');
  });
});

describe('bass', () => {
  const a7 = getChord('A', '7');
  const d7 = getChord('D', '7');
  it('plays chord tones in the bass range', () => {
    expect(bassNote('R', a7, d7)).toBe(33); // A1
    expect(bassNote('5', a7, d7)).toBe(40);
    expect(bassNote('3', a7, d7)).toBe(37);
    expect(bassNote('7', a7, d7)).toBe(43);
    expect(bassNote('8', a7, d7)).toBe(45);
  });
  it('approaches the next chord from a half step below', () => {
    expect(bassNote('A', a7, d7)).toBe(37); // C#2 leads to D2
    expect(bassNote('A', d7, getChord('E', 'maj'))).toBe(39); // D#2 leads to E2... wraps up an octave
  });
  it('always starts the bar on the chord root', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STYLES), fc.constantFrom(...PROGRESSIONS), fc.constantFrom(...SHARP_NAMES), (style, prog, key) => {
        const chords = chordsFor(key, prog, style);
        const arr = arrange(style, chords);
        chords.forEach((c, bar) => {
          const first = arr.events.find((e) => e.part === 'bass' && e.tick === bar * BAR_TICKS);
          expect(first).toBeDefined();
          expect(mod12(first!.midis[0]!)).toBe(c.tones[0]!.pc);
        });
        for (const e of arr.events.filter((x) => x.part === 'bass')) {
          expect(e.midis[0]!).toBeGreaterThanOrEqual(BASS_RANGE.low);
          expect(e.midis[0]!).toBeLessThanOrEqual(BASS_RANGE.high + 12);
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe('chords (comp)', () => {
  it('voices only chord tones, inside the comp range', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STYLES), fc.constantFrom(...PROGRESSIONS), fc.constantFrom(...SHARP_NAMES), (style, prog, key) => {
        const chords = chordsFor(key, prog, style);
        const arr = arrange(style, chords);
        for (const e of arr.events.filter((x) => x.part === 'comp')) {
          const bar = Math.floor(e.tick / BAR_TICKS);
          const pcs = chords[bar]!.tones.map((t) => t.pc);
          for (const m of e.midis) {
            expect(pcs).toContain(mod12(m));
            expect(m).toBeGreaterThanOrEqual(COMP_RANGE.low);
            expect(m).toBeLessThanOrEqual(COMP_RANGE.high);
          }
        }
      }),
      { numRuns: 60 },
    );
  });

  it('moves smoothly: C to F keeps the shared C and moves the others by a step', () => {
    const c = voiceLead(getChord('C', 'maj'), null, true);
    const f = voiceLead(getChord('F', 'maj'), c, true);
    const moved = f.reduce((sum, n) => sum + Math.min(...c.map((p) => Math.abs(p - n))), 0);
    expect(moved).toBeLessThanOrEqual(3);
  });
});

describe('arrangement', () => {
  it('lasts one bar per chord and keeps events inside the loop', () => {
    const style = getStyle('blues');
    const arr = arrange(style, chordsFor('A', getProgression('twelveBar'), style));
    expect(arr.bars).toBe(12);
    expect(arr.totalTicks).toBe(12 * BAR_TICKS);
    expect(arr.stepTicks).toBe(64);
    for (const e of arr.events) {
      expect(e.tick).toBeGreaterThanOrEqual(0);
      expect(e.tick).toBeLessThan(arr.totalTicks);
    }
    expect(arr.chords.map((c) => c.symbol).slice(0, 5)).toEqual(['A7', 'A7', 'A7', 'A7', 'D7']);
  });
});
