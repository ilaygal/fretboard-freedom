import Dexie, { type Table } from 'dexie';
import type { Attempt, Profile, Recording, SavedLick, SrsCard } from './types';

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Bump SCHEMA_VERSION with every Dexie version() change; backups record it. */
export const SCHEMA_VERSION = 3;

/** Tables left out of backups (audio blobs are too large and don't survive JSON). */
export const LOCAL_ONLY_TABLES = ['recordings'];

export class AppDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  meta!: Table<MetaRow, string>;
  attempts!: Table<Attempt, number>;
  srs!: Table<SrsCard, [string, string]>;
  licks!: Table<SavedLick, string>;
  recordings!: Table<Recording, string>;

  constructor(name = 'fretboard-freedom') {
    super(name);
    this.version(1).stores({
      profiles: 'id, updatedAt',
      meta: 'key',
    });
    this.version(2).stores({
      attempts: '++id, profileId, [profileId+drillId], [profileId+at]',
      srs: '[profileId+itemKey], profileId, [profileId+due]',
    });
    this.version(3).stores({
      licks: 'id, profileId',
      recordings: 'id, profileId, [profileId+at]',
    });
  }
}
