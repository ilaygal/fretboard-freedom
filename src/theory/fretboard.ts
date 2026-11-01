import { mod12, type PitchClass } from './note';
import { openMidi, stringCount, type Tuning } from './tuning';

/** A place on the neck. string 1 = highest-pitched string; fret 0 = open string. */
export interface FretPos {
  string: number;
  fret: number;
}

export interface FretRange {
  from: number;
  to: number;
}

export function posKey(p: FretPos): string {
  return `${p.string}:${p.fret}`;
}

export function midiAt(t: Tuning, p: FretPos): number {
  return openMidi(t, p.string) + p.fret;
}

export function pitchClassAt(t: Tuning, p: FretPos): PitchClass {
  return mod12(midiAt(t, p));
}

/** Every position in a fret range, string 1 first. */
export function allPositions(t: Tuning, range: FretRange): FretPos[] {
  const out: FretPos[] = [];
  for (let s = 1; s <= stringCount(t); s++) {
    for (let f = range.from; f <= range.to; f++) out.push({ string: s, fret: f });
  }
  return out;
}

/** All positions in range whose pitch class is in the set. */
export function positionsOfPitchClasses(t: Tuning, pcs: Iterable<PitchClass>, range: FretRange): FretPos[] {
  const set = new Set([...pcs].map(mod12));
  return allPositions(t, range).filter((p) => set.has(pitchClassAt(t, p)));
}

/** All positions that sound exactly this MIDI note. */
export function positionsOfMidi(t: Tuning, midi: number, range: FretRange): FretPos[] {
  return allPositions(t, range).filter((p) => midiAt(t, p) === midi);
}

/** A neck range around a span of frets: one fret below, two above, at least `minFrets` + 1 frets shown. */
export function windowAround(span: FretRange, maxFret: number, minFrets = 5): FretRange {
  const from = Math.max(0, span.from - 1);
  const to = Math.min(maxFret, Math.max(span.to + 2, from + minFrets));
  return { from, to };
}
