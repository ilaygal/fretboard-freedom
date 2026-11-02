import type { AppDatabase } from '../../db';
import type { Recording, SavedLick } from '../../types';
import type { LickRepository, RecordingRepository } from '../types';

export class DexieLickRepository implements LickRepository {
  constructor(private readonly db: AppDatabase) {}

  async list(profileId: string) {
    const rows = await this.db.licks.where('profileId').equals(profileId).toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }

  async save(lick: SavedLick) {
    await this.db.licks.put(lick);
  }

  async remove(id: string) {
    await this.db.licks.delete(id);
  }
}

export class DexieRecordingRepository implements RecordingRepository {
  constructor(private readonly db: AppDatabase) {}

  async list(profileId: string) {
    const rows = await this.db.recordings.where('[profileId+at]').between([profileId, 0], [profileId, Infinity]).toArray();
    return rows.reverse();
  }

  async add(rec: Recording) {
    await this.db.recordings.put(rec);
  }

  async remove(id: string) {
    await this.db.recordings.delete(id);
  }
}
