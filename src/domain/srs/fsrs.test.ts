import { describe, expect, it } from 'vitest';
import { gradeAnswer, intervalDays, retrievability, review, urgency, type Grade } from './fsrs';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);

describe('FSRS-lite', () => {
  it('starts easier items with longer intervals', () => {
    const s = ([1, 2, 3, 4] as Grade[]).map((g) => review(undefined, g, t0).stability);
    expect(s[0]).toBeLessThan(s[1]!);
    expect(s[1]).toBeLessThan(s[2]!);
    expect(s[2]).toBeLessThan(s[3]!);
  });

  it('retrievability is 90% at the interval', () => {
    for (const s of [0.5, 3, 40]) expect(retrievability(s, intervalDays(s))).toBeCloseTo(0.9, 6);
    expect(retrievability(3, 0)).toBe(1);
  });

  it('success grows stability, a lapse shrinks it', () => {
    const c = review(undefined, 3, t0);
    const later = t0 + 3 * DAY;
    const good = review(c, 3, later);
    const again = review(c, 1, later);
    expect(good.stability).toBeGreaterThan(c.stability);
    expect(again.stability).toBeLessThanOrEqual(c.stability);
    expect(again.lapses).toBe(1);
    expect(review(c, 4, later).stability).toBeGreaterThan(good.stability);
    expect(review(c, 2, later).stability).toBeLessThan(good.stability);
    expect(good.due).toBeGreaterThan(later);
  });

  it('keeps difficulty within 1..10 under any sequence', () => {
    let c = review(undefined, 1, t0);
    for (let i = 0; i < 30; i++) {
      c = review(c, (i % 4 === 0 ? 4 : 1) as Grade, t0 + i * DAY);
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(10);
      expect(c.stability).toBeGreaterThan(0);
    }
  });

  it('grades answers by correctness and speed', () => {
    expect(gradeAnswer(false, 500, 3000)).toBe(1);
    expect(gradeAnswer(true, 1000, 3000)).toBe(4);
    expect(gradeAnswer(true, 2500, 3000)).toBe(3);
    expect(gradeAnswer(true, 7000, 3000)).toBe(2);
    expect(gradeAnswer(true, 1000, 3000, true)).toBe(2);
  });

  it('ranks forgotten and failed items as more urgent', () => {
    const strong = review(review(undefined, 4, t0), 4, t0 + DAY);
    const weak = review(undefined, 1, t0);
    const now = t0 + 2 * DAY;
    expect(urgency(weak, now)).toBeGreaterThan(urgency(strong, now));
    expect(urgency(undefined, now)).toBe(0.5);
  });
});
