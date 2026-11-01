/**
 * FSRS-lite: the FSRS-4.5 memory model (stability, difficulty, retrievability) with its published
 * default weights, without per-user optimisation. Intervals are in days; one review per drill answer.
 */

export type Grade = 1 | 2 | 3 | 4; // again, hard, good, easy

export interface CardState {
  /** Days until recall probability drops to 90%. */
  stability: number;
  /** 1 (easy) .. 10 (hard). */
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number; // epoch ms
  due: number; // epoch ms
}

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755] as const;
const w = (i: number) => W[i]!;
const DAY = 86_400_000;
export const TARGET_RETENTION = 0.9;
const FACTOR = 19 / 81;
const DECAY = -0.5;

const clampD = (d: number) => Math.min(10, Math.max(1, d));

function initialDifficulty(g: Grade): number {
  return clampD(w(4) - Math.exp(w(5) * (g - 1)) + 1);
}

/** Probability of recalling the item after `elapsedDays`. */
export function retrievability(stability: number, elapsedDays: number): number {
  return (1 + (FACTOR * Math.max(0, elapsedDays)) / stability) ** DECAY;
}

/** Days until retrievability falls to the target retention. */
export function intervalDays(stability: number, retention = TARGET_RETENTION): number {
  return (stability / FACTOR) * (retention ** (1 / DECAY) - 1);
}

function nextDifficulty(d: number, g: Grade): number {
  const next = d - w(6) * (g - 3);
  return clampD(w(7) * initialDifficulty(4) + (1 - w(7)) * next);
}

function stabilityAfterSuccess(d: number, s: number, r: number, g: Grade): number {
  const hard = g === 2 ? w(15) : 1;
  const easy = g === 4 ? w(16) : 1;
  return s * (1 + Math.exp(w(8)) * (11 - d) * s ** -w(9) * (Math.exp(w(10) * (1 - r)) - 1) * hard * easy);
}

function stabilityAfterLapse(d: number, s: number, r: number): number {
  return Math.min(s, w(11) * d ** -w(12) * ((s + 1) ** w(13) - 1) * Math.exp(w(14) * (1 - r)));
}

/** Applies one review. `card` is undefined for an item never seen before. */
export function review(card: CardState | undefined, grade: Grade, now: number): CardState {
  if (!card) {
    const stability = w(grade - 1);
    return {
      stability,
      difficulty: initialDifficulty(grade),
      reps: 1,
      lapses: grade === 1 ? 1 : 0,
      lastReview: now,
      due: now + intervalDays(stability) * DAY,
    };
  }
  const elapsed = (now - card.lastReview) / DAY;
  const r = retrievability(card.stability, elapsed);
  const difficulty = nextDifficulty(card.difficulty, grade);
  const stability =
    grade === 1 ? stabilityAfterLapse(card.difficulty, card.stability, r) : stabilityAfterSuccess(card.difficulty, card.stability, r, grade);
  return {
    stability,
    difficulty,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 1 ? 1 : 0),
    lastReview: now,
    due: now + intervalDays(stability) * DAY,
  };
}

/**
 * Grade from a drill answer: wrong = again; right is graded by speed against the item's expected time.
 * Mistakes before getting it right make it "hard".
 */
export function gradeAnswer(correct: boolean, ms: number, expectedMs: number, hadMistakes = false): Grade {
  if (!correct) return 1;
  if (hadMistakes || ms > expectedMs * 2) return 2;
  if (ms < expectedMs * 0.6) return 4;
  return 3;
}

/**
 * How much an item needs practice right now, higher = more urgent. Unseen items get a fixed
 * priority so new material is mixed in steadily rather than all at once.
 */
export function urgency(card: CardState | undefined, now: number, newPriority = 0.5): number {
  if (!card) return newPriority;
  const r = retrievability(card.stability, (now - card.lastReview) / DAY);
  return 1 - r + (card.lapses > 0 ? 0.05 * Math.min(card.lapses, 4) : 0);
}
