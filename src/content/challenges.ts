import type { ScaleId } from '@/theory';
import type { StyleId } from './backing';

/**
 * Improv challenges: a constraint to play inside, over a backing track. Titles and how-to text live in
 * i18n under challenges.items.<id>. A mic hears pitches, not strings or frets, so rules about strings
 * and positions are checked by pitch range (notes that can't be played there count as outside).
 */
export type ChallengeRule =
  | { kind: 'free' }
  /** Play only on these strings (string 1 = high E). */
  | { kind: 'strings'; strings: number[] }
  | { kind: 'chordTones' }
  /** Land on the 3rd of each chord on beat 1. */
  | { kind: 'targetThird' }
  /** Use at most this many different notes. */
  | { kind: 'fewNotes'; count: number }
  /** The band "asks" in odd bars (you rest), you answer in even bars. */
  | { kind: 'callResponse' }
  /** One note only: make it interesting with rhythm. */
  | { kind: 'rhythmOnly' }
  /** Stay in the hand position you have used least. */
  | { kind: 'newPosition' };

export interface ChallengeDef {
  id: string;
  rule: ChallengeRule;
  /** Bars to play before the report. */
  bars: number;
  /** 1 = easy, 3 = hard. */
  level: 1 | 2 | 3;
  /** A groove and progression that suit it (the player can change them). */
  styleId: StyleId;
  progressionId: string;
  scale: ScaleId;
  /** Score (0..1) needed to count as done. */
  passAt: number;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  { id: 'freeJam', rule: { kind: 'free' }, bars: 12, level: 1, styleId: 'blues', progressionId: 'twelveBar', scale: 'minorPentatonic', passAt: 0 },
  { id: 'threeNotes', rule: { kind: 'fewNotes', count: 3 }, bars: 8, level: 1, styleId: 'rock', progressionId: 'minorRock', scale: 'minorPentatonic', passAt: 1 },
  { id: 'oneNote', rule: { kind: 'rhythmOnly' }, bars: 8, level: 1, styleId: 'funk', progressionId: 'oneChordFunk', scale: 'minorPentatonic', passAt: 0.85 },
  { id: 'oneString', rule: { kind: 'strings', strings: [2] }, bars: 8, level: 1, styleId: 'pop', progressionId: 'popAnthem', scale: 'majorPentatonic', passAt: 0.85 },
  { id: 'twoStrings', rule: { kind: 'strings', strings: [1, 2] }, bars: 8, level: 2, styleId: 'rock', progressionId: 'mixoRock', scale: 'majorPentatonic', passAt: 0.85 },
  { id: 'callResponse', rule: { kind: 'callResponse' }, bars: 8, level: 2, styleId: 'blues', progressionId: 'twelveBar', scale: 'minorPentatonic', passAt: 0.85 },
  { id: 'chordTones', rule: { kind: 'chordTones' }, bars: 8, level: 2, styleId: 'pop', progressionId: 'popAnthem', scale: 'majorPentatonic', passAt: 0.75 },
  { id: 'newPosition', rule: { kind: 'newPosition' }, bars: 8, level: 2, styleId: 'rock', progressionId: 'minorRock', scale: 'minorPentatonic', passAt: 0.8 },
  { id: 'targetThird', rule: { kind: 'targetThird' }, bars: 8, level: 3, styleId: 'ballad', progressionId: 'doowop', scale: 'major', passAt: 0.6 },
];

export function getChallenge(id: string): ChallengeDef {
  const c = CHALLENGES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown challenge: ${id}`);
  return c;
}
