import { midiAt, pitchClassAt, positionsOfPitchClasses, type FretPos, type FretRange } from './fretboard';
import type { Tuning } from './tuning';

export interface Connection {
  from: FretPos;
  to: FretPos;
}

/**
 * Octave shapes: every pair of positions an exact octave apart that sit two or three strings apart
 * (the shapes guitarists use to jump between the same note: two strings over and two frets up, etc.).
 */
export function octaveShapes(tuning: Tuning, pos: FretPos, range: FretRange): { positions: FretPos[]; connections: Connection[] } {
  const positions = positionsOfPitchClasses(tuning, [pitchClassAt(tuning, pos)], range);
  const connections: Connection[] = [];
  for (const a of positions) {
    for (const b of positions) {
      const strings = a.string - b.string; // a is the lower-pitched string
      if ((strings === 2 || strings === 3) && midiAt(tuning, b) - midiAt(tuning, a) === 12 && Math.abs(b.fret - a.fret) <= 4) {
        connections.push({ from: a, to: b });
      }
    }
  }
  return { positions, connections };
}
