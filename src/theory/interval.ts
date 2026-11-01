import { Interval } from 'tonal';
import { mod12 } from './note';

/** Interval symbol relative to a root, as shown on the fretboard: R, b3, 5, #11... */
export type IntervalSymbol = string;

const DEFAULT_SYMBOLS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'] as const;

/** Symbol for a distance in semitones when there is no scale or chord context. */
export function symbolFromSemitones(semitones: number): IntervalSymbol {
  return DEFAULT_SYMBOLS[mod12(semitones)]!;
}

/**
 * Converts a Tonal interval name ("3m", "5d", "9M", "11A") to our symbol ("b3", "b5", "9", "#11").
 * With `compound: false`, 9/11/13 fold to 2/4/6 (scale context); with true they stay (chord context).
 */
export function symbolFromTonal(tonalInterval: string, compound = true): IntervalSymbol {
  const i = Interval.get(tonalInterval);
  if (i.empty) throw new Error(`Invalid interval: ${tonalInterval}`);
  const num = compound ? i.num : i.simple;
  if (num === 1 || num === 8) {
    if (i.alt === 0) return 'R';
  }
  let acc = '';
  if (i.type === 'perfectable') {
    acc = i.alt > 0 ? '#'.repeat(i.alt) : 'b'.repeat(-i.alt);
  } else {
    // Majorable: M = 0, m = -1, A = +1, d = -2.
    if (i.alt > 0) acc = '#'.repeat(i.alt);
    else if (i.alt < 0) acc = 'b'.repeat(-i.alt);
  }
  return `${acc}${num}`;
}

/** Semitones above the root for one of our symbols ("b3" -> 3, "#11" -> 6). */
export function semitonesOfSymbol(symbol: IntervalSymbol): number {
  if (symbol === 'R') return 0;
  const m = /^(b*|#*)(\d+)$/.exec(symbol);
  if (!m) throw new Error(`Invalid interval symbol: ${symbol}`);
  const acc = m[1] ?? '';
  const num = Number(m[2]);
  const base = [0, 2, 4, 5, 7, 9, 11][(num - 1) % 7]!;
  const shift = acc.startsWith('#') ? acc.length : -acc.length;
  return mod12(base + shift);
}

/** Scale degree label: like the interval symbol but the root is "1". */
export function degreeLabel(symbol: IntervalSymbol): string {
  return symbol === 'R' ? '1' : symbol;
}

const PLAIN: Record<string, string> = {
  R: 'Root: the home note the chord or scale is named after',
  b2: 'Flat 2nd: very tense, a half step above the root',
  '2': '2nd: a whole step above the root',
  b3: 'Minor 3rd: the note that makes it sound minor or sad',
  '3': 'Major 3rd: the note that makes it sound major or happy',
  '4': '4th: wants to resolve down to the 3rd',
  '#4': 'Sharp 4th: the bright, floating Lydian sound',
  b5: 'Flat 5th: the bluesy, gritty "blue note"',
  '5': '5th: strong and stable, the power-chord note',
  '#5': 'Sharp 5th: tense, augmented sound',
  b6: 'Flat 6th: dark and moody',
  '6': '6th: sweet, open sound',
  bb7: 'Double-flat 7th: the 7th of a diminished 7th chord',
  b7: 'Flat 7th: bluesy and rocky, the dominant sound',
  '7': 'Major 7th: dreamy, wants to rise to the root',
  b9: 'Flat 9th: dark tension over a dominant chord',
  '9': '9th: the 2nd an octave up, adds colour',
  '#9': 'Sharp 9th: the "Hendrix chord" note',
  '11': '11th: the 4th an octave up',
  '#11': 'Sharp 11th: the Lydian colour on top of a chord',
  b13: 'Flat 13th: dark colour over a dominant chord',
  '13': '13th: the 6th an octave up',
};

/** A short, jargon-light explanation of an interval symbol, for tooltips. */
export function plainIntervalName(symbol: IntervalSymbol): string {
  return PLAIN[symbol] ?? symbol;
}
