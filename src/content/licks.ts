import type { ScaleId } from '@/theory';

/**
 * Original practice licks (generic scale phrases written for this app, not taken from songs).
 * Notes are semitones from the key's home note, so every lick works in every key; `dur` is in
 * sixteenth notes; `st: null` is a rest. Names and descriptions live in i18n under licks.items.<id>.
 */
export interface LickNote {
  st: number | null;
  dur: number;
}

export interface LickDef {
  id: string;
  scale: ScaleId;
  notes: LickNote[];
  tags: string[];
  bpm: number;
  level: 1 | 2 | 3;
}

const n = (st: number | null, dur = 2): LickNote => ({ st, dur });

export const LICKS: readonly LickDef[] = [
  { id: 'stairsDown', scale: 'minorPentatonic', level: 1, bpm: 90, tags: ['minor', 'rock', 'blues'], notes: [n(12), n(10), n(7), n(5), n(3), n(0, 6)] },
  { id: 'stairsUp', scale: 'minorPentatonic', level: 1, bpm: 90, tags: ['minor', 'rock'], notes: [n(0), n(3), n(5), n(7), n(10), n(12, 6)] },
  { id: 'question', scale: 'minorPentatonic', level: 1, bpm: 84, tags: ['minor', 'blues', 'call'], notes: [n(0), n(3), n(5, 4), n(null, 2), n(3), n(5), n(7, 6)] },
  { id: 'answer', scale: 'minorPentatonic', level: 1, bpm: 84, tags: ['minor', 'blues', 'response'], notes: [n(7), n(5), n(3, 4), n(null, 2), n(5), n(3), n(0, 6)] },
  { id: 'bluesSlide', scale: 'blues', level: 2, bpm: 80, tags: ['blues'], notes: [n(7), n(6, 1), n(5, 3), n(3), n(0, 4), n(null, 2), n(-2), n(0, 6)] },
  { id: 'repeater', scale: 'minorPentatonic', level: 2, bpm: 96, tags: ['minor', 'rock'], notes: [n(12, 1), n(10, 1), n(7, 2), n(12, 1), n(10, 1), n(7, 2), n(12, 1), n(10, 1), n(7, 2), n(5), n(7, 4)] },
  { id: 'minorArp', scale: 'minor', level: 2, bpm: 84, tags: ['minor', 'chord'], notes: [n(0), n(3), n(7), n(12, 4), n(7), n(3), n(0, 4)] },
  { id: 'sunnyUp', scale: 'majorPentatonic', level: 1, bpm: 96, tags: ['major', 'pop', 'country'], notes: [n(0), n(2), n(4), n(7), n(9), n(12, 6)] },
  { id: 'sunnyTurn', scale: 'majorPentatonic', level: 2, bpm: 100, tags: ['major', 'country'], notes: [n(4), n(2), n(0), n(-3), n(0, 1), n(2, 1), n(4, 4), n(7, 2), n(4, 6)] },
  { id: 'majorArp', scale: 'major', level: 2, bpm: 88, tags: ['major', 'chord'], notes: [n(0), n(4), n(7), n(12, 4), n(11), n(7), n(4), n(0, 4)] },
  { id: 'dorianColour', scale: 'dorian', level: 3, bpm: 92, tags: ['minor', 'funk'], notes: [n(0), n(3), n(5), n(7), n(9, 4), n(7), n(5), n(3, 4)] },
  { id: 'mixoHook', scale: 'mixolydian', level: 3, bpm: 104, tags: ['major', 'rock', 'blues'], notes: [n(4), n(7), n(10, 4), n(9), n(7), n(4, 1), n(2, 1), n(0, 6)] },
];

export function getLick(id: string): LickDef {
  const l = LICKS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown lick: ${id}`);
  return l;
}

/** Keys in the order guitarists practise "all twelve keys": round the cycle of fourths, starting from A. */
export const ALL_KEYS_ORDER = [9, 2, 7, 0, 5, 10, 3, 8, 1, 6, 11, 4];
