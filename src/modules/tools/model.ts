import { frequencyToMidi, stringCount, openMidi, type Tuning } from '@/theory';

/** Nearest open string to a frequency, and how far off it is in cents (positive = sharp). */
export function nearestString(tuning: Tuning, freq: number): { string: number; cents: number } {
  const m = frequencyToMidi(freq);
  let best = { string: 1, cents: Infinity };
  for (let s = 1; s <= stringCount(tuning); s++) {
    const cents = (m - openMidi(tuning, s)) * 100;
    if (Math.abs(cents) < Math.abs(best.cents)) best = { string: s, cents: Math.round(cents) };
  }
  return best;
}

/** Median of the last few readings, to steady a jumpy tuner needle. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type TuneAdvice = 'inTune' | 'tuneUp' | 'tuneDown';

export function tuneAdvice(cents: number, tolerance = 5): TuneAdvice {
  if (Math.abs(cents) <= tolerance) return 'inTune';
  return cents < 0 ? 'tuneUp' : 'tuneDown';
}
