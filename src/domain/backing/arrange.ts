import { mod12, resolveProgression, type ChordInfo, type Numeral } from '@/theory';
import type { ProgressionDef, StyleDef } from '@/content/backing';

/**
 * Turns a style and a chord progression into a list of timed notes. Pure: no audio here,
 * so the musical decisions (bass notes, voicings, grooves) are unit-tested.
 * Times are in transport ticks (192 per quarter note, Tone's default), so tempo changes need
 * no re-arranging.
 */
export const PPQ = 192;
export const BAR_TICKS = PPQ * 4;

export type Part = 'kick' | 'snare' | 'hat' | 'ride' | 'bass' | 'comp';

export interface BackingEvent {
  tick: number;
  part: Part;
  /** Notes to play; empty for drums. */
  midis: number[];
  durTicks: number;
  velocity: number;
}

export interface Arrangement {
  events: BackingEvent[];
  bars: number;
  totalTicks: number;
  /** The chord of each bar, in order. */
  chords: ChordInfo[];
  stepTicks: number;
}

/** Bass sits from B0 to D#2; comp chords around middle C. */
export const BASS_RANGE = { low: 28, high: 39 } as const;
export const COMP_RANGE = { low: 52, high: 74, centre: 62 } as const;

const VELOCITY: Record<string, number> = { X: 1, x: 0.75, o: 0.4 };

/** Adds the style's chord colour to plain numerals ("I" becomes "I7" in blues, "Imaj7" in jazz). */
export function colourNumeral(numeral: Numeral, style: StyleDef): Numeral {
  if (style.chordColour === 'triad') return numeral;
  const m = /^(b|#)?([IViv]+)$/.exec(numeral);
  if (!m) return numeral; // already has a suffix
  const roman = m[2]!;
  const major = roman === roman.toUpperCase();
  if (style.id === 'jazz') {
    if (!major) return `${numeral}7`;
    return roman === 'V' && !m[1] ? `${numeral}7` : `${numeral}maj7`;
  }
  return `${numeral}7`;
}

export function chordsFor(tonic: string, progression: ProgressionDef, style: StyleDef, strict = false): ChordInfo[] {
  return resolveProgression(
    tonic,
    progression.bars.map((n) => colourNumeral(n, style)),
    { strict },
  );
}

/** Lowest MIDI note of a pitch class at or above `low`. */
function atOrAbove(pc: number, low: number): number {
  return low + mod12(pc - low);
}

export function bassRoot(chord: ChordInfo): number {
  return atOrAbove(chord.tones[0]!.pc, BASS_RANGE.low);
}

function semitonesOf(chord: ChordInfo, symbols: string[]): number | null {
  const root = chord.tones[0]!.pc;
  const tone = chord.tones.find((t) => symbols.includes(t.interval));
  return tone ? mod12(tone.pc - root) : null;
}

export function bassNote(token: string, chord: ChordInfo, next: ChordInfo): number | null {
  const root = bassRoot(chord);
  switch (token) {
    case 'R':
      return root;
    case '8':
      return root + 12;
    case '5':
      return root + (semitonesOf(chord, ['5', 'b5', '#5']) ?? 7);
    case '3':
      return root + (semitonesOf(chord, ['3', 'b3']) ?? semitonesOf(chord, ['4', '2', '9']) ?? 7);
    case '7':
      return root + (semitonesOf(chord, ['b7', '7', 'bb7']) ?? 12);
    case '6':
      return root + 9;
    case 'A': {
      const target = bassRoot(next);
      return target - 1 < BASS_RANGE.low ? target + 11 : target - 1;
    }
    default:
      return null;
  }
}

/** Close-position chord shapes (every inversion) inside the comp range. */
export function voicingsOf(chord: ChordInfo, triadOnly: boolean): number[][] {
  let pcs = chord.tones.map((t) => t.pc);
  if (triadOnly) pcs = pcs.slice(0, 3);
  if (pcs.length > 4) pcs = pcs.filter((_, i) => i !== 2).slice(0, 4); // drop the fifth from 9th chords
  const out: number[][] = [];
  for (let inv = 0; inv < pcs.length; inv++) {
    const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
    const notes: number[] = [];
    let prev = COMP_RANGE.low - 1;
    for (const pc of order) {
      const n = atOrAbove(pc, prev + 1);
      notes.push(n);
      prev = n;
    }
    if (notes[notes.length - 1]! <= COMP_RANGE.high) out.push(notes);
  }
  return out;
}

const centroid = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Picks the voicing that moves least from the previous one (smooth voice leading). */
export function voiceLead(chord: ChordInfo, prev: number[] | null, triadOnly: boolean): number[] {
  const options = voicingsOf(chord, triadOnly);
  const cost = (v: number[]) => {
    if (!prev) return Math.abs(centroid(v) - COMP_RANGE.centre);
    let total = 0;
    for (const n of v) total += Math.min(...prev.map((p) => Math.abs(p - n)));
    return total + Math.abs(centroid(v) - COMP_RANGE.centre) * 0.25;
  };
  return options.reduce((best, v) => (cost(v) < cost(best) ? v : best), options[0]!);
}

function hits(pattern: string): { step: number; velocity: number }[] {
  const out: { step: number; velocity: number }[] = [];
  [...pattern].forEach((ch, step) => {
    const v = VELOCITY[ch];
    if (v) out.push({ step, velocity: v });
  });
  return out;
}

export function arrange(style: StyleDef, chords: ChordInfo[]): Arrangement {
  const stepTicks = BAR_TICKS / style.steps;
  const events: BackingEvent[] = [];
  const bassTokens = style.bass.split(/\s+/);
  const compHits = hits(style.comp);
  let prevVoicing: number[] | null = null;

  chords.forEach((chord, bar) => {
    const next = chords[(bar + 1) % chords.length]!;
    const t0 = bar * BAR_TICKS;
    for (const part of ['kick', 'snare', 'hat', 'ride'] as const) {
      const pattern = style.drums[part];
      if (!pattern) continue;
      for (const h of hits(pattern)) {
        events.push({ tick: t0 + h.step * stepTicks, part, midis: [], durTicks: stepTicks, velocity: h.velocity });
      }
    }

    bassTokens.forEach((token, step) => {
      const midi = bassNote(token, chord, next);
      if (midi === null) return;
      let len = 1;
      while (bassTokens[step + len] === '-') len++;
      events.push({
        tick: t0 + step * stepTicks,
        part: 'bass',
        midis: [midi],
        durTicks: len * stepTicks * 0.95,
        velocity: step === 0 ? 0.95 : 0.8,
      });
    });

    const voicing = voiceLead(chord, prevVoicing, style.chordColour === 'triad');
    prevVoicing = voicing;
    compHits.forEach((h, i) => {
      const nextStep = compHits[i + 1]?.step ?? style.steps;
      const len = Math.min(style.compLength, nextStep - h.step);
      events.push({ tick: t0 + h.step * stepTicks, part: 'comp', midis: voicing, durTicks: len * stepTicks * 0.9, velocity: h.velocity });
    });
  });

  events.sort((a, b) => a.tick - b.tick);
  return { events, bars: chords.length, totalTicks: chords.length * BAR_TICKS, chords, stepTicks };
}
