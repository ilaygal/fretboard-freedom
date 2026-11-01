import type { Attempt, AttemptRepository, SrsCard, SrsRepository } from '@/data';
import { gradeAnswer, review, urgency, type Grade } from '../srs/fsrs';

export type Rng = () => number;

/** Small seedable random generator (mulberry32) so drills are testable. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks the next item: weighted toward items that need practice (spaced-repetition urgency),
 * never one of the last few asked, with a little randomness so it doesn't feel mechanical.
 */
export function pickNext(
  itemKeys: readonly string[],
  cards: ReadonlyMap<string, Pick<SrsCard, 'stability' | 'difficulty' | 'reps' | 'lapses' | 'lastReview' | 'due'>>,
  now: number,
  recent: readonly string[],
  rng: Rng,
): string {
  if (itemKeys.length === 0) throw new Error('No items to practise');
  const avoidCount = Math.min(3, itemKeys.length - 1);
  const avoid = new Set(avoidCount > 0 ? recent.slice(-avoidCount) : []);
  const pool = itemKeys.filter((k) => !avoid.has(k));
  const weights = pool.map((k) => (urgency(cards.get(k), now) + 0.05) ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    x -= weights[i]!;
    if (x <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

export interface PracticeStore {
  attempts: AttemptRepository;
  srs: SrsRepository;
}

/** Records the outcome of one question in spaced repetition. */
export async function reviewItem(
  store: PracticeStore,
  profileId: string,
  itemKey: string,
  outcome: { correct: boolean; ms: number; expectedMs: number; hadMistakes?: boolean },
  now: number,
): Promise<Grade> {
  const grade = gradeAnswer(outcome.correct, outcome.ms, outcome.expectedMs, outcome.hadMistakes);
  const existing = (await store.srs.getMany(profileId, [itemKey])).get(itemKey);
  const next = review(existing, grade, now);
  await store.srs.put({ profileId, itemKey, ...next });
  return grade;
}

export function logAttempt(store: PracticeStore, attempt: Omit<Attempt, 'id'>): Promise<void> {
  return store.attempts.add(attempt);
}
