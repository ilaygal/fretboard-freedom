import type { AppDatabase } from '../../db';
import type { Attempt, SrsCard } from '../../types';
import type { AttemptRepository, SrsRepository } from '../types';

export class DexieAttemptRepository implements AttemptRepository {
  constructor(private readonly db: AppDatabase) {}

  async add(attempt: Omit<Attempt, 'id'>) {
    await this.db.attempts.add(attempt);
  }

  async list(profileId: string, opts: { drillId?: string; since?: number } = {}) {
    const rows = opts.drillId
      ? await this.db.attempts.where('[profileId+drillId]').equals([profileId, opts.drillId]).toArray()
      : await this.db.attempts.where('[profileId+at]').between([profileId, opts.since ?? 0], [profileId, Infinity]).toArray();
    return rows.filter((r) => r.at >= (opts.since ?? 0)).sort((a, b) => a.at - b.at);
  }
}

export class DexieSrsRepository implements SrsRepository {
  constructor(private readonly db: AppDatabase) {}

  async getMany(profileId: string, itemKeys: string[]) {
    const rows = await this.db.srs.bulkGet(itemKeys.map((k) => [profileId, k] as [string, string]));
    const map = new Map<string, SrsCard>();
    rows.forEach((r) => r && map.set(r.itemKey, r));
    return map;
  }

  async put(card: SrsCard) {
    await this.db.srs.put(card);
  }

  list(profileId: string) {
    return this.db.srs.where('profileId').equals(profileId).toArray();
  }
}
