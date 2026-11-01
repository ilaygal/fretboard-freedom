import Dexie, { type Table } from 'dexie';
import type { Attempt, Profile, SrsCard } from './types';

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Bump SCHEMA_VERSION with every Dexie version() change; backups record it. */
export const SCHEMA_VERSION = 2;

export class AppDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  meta!: Table<MetaRow, string>;
  attempts!: Table<Attempt, number>;
  srs!: Table<SrsCard, [string, string]>;

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
  }
}
