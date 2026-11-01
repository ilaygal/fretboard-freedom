import { describe, expect, it } from 'vitest';
import { pickNext, reviewItem, seededRng } from './engine';
import { AppDatabase } from '@/data/db';
import { createRepositories } from '@/data';
import { review } from '../srs/fsrs';

describe('drill engine', () => {
  it('seeded rng is repeatable and in [0,1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('never repeats a recent item and favours weak items', () => {
    const now = Date.UTC(2026, 0, 10);
    const strong = review(review(undefined, 4, now - 3e8), 4, now - 1e8);
    const weak = review(undefined, 1, now - 1e8);
    const cards = new Map([
      ['strong', strong],
      ['weak', weak],
    ]);
    const rng = seededRng(1);
    const counts: Record<string, number> = { strong: 0, weak: 0, other: 0 };
    for (let i = 0; i < 2000; i++) counts[pickNext(['strong', 'weak', 'other'], cards, now, [], rng)]!++;
    expect(counts.weak).toBeGreaterThan(counts.strong!);
    for (let i = 0; i < 50; i++) expect(pickNext(['a', 'b', 'c', 'd'], new Map(), now, ['a', 'b', 'c'], rng)).toBe('d');
    expect(pickNext(['only'], new Map(), now, ['only'], rng)).toBe('only');
  });

  it('stores a review for the item', async () => {
    const repos = createRepositories(new AppDatabase('engine-test'));
    const g = await reviewItem(repos, 'p', 'note:7@s3', { correct: true, ms: 1000, expectedMs: 4000 }, 1000);
    expect(g).toBe(4);
    const card = (await repos.srs.getMany('p', ['note:7@s3'])).get('note:7@s3')!;
    expect(card.reps).toBe(1);
    await reviewItem(repos, 'p', 'note:7@s3', { correct: false, ms: 1000, expectedMs: 4000 }, 2000);
    expect((await repos.srs.getMany('p', ['note:7@s3'])).get('note:7@s3')!.lapses).toBe(1);
  });
});
