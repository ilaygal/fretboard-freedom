import Dexie, { type Table } from 'dexie';
import type { Profile } from './types';

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Bump SCHEMA_VERSION with every Dexie version() change; backups record it. */
export const SCHEMA_VERSION = 1;

export class AppDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'fretboard-freedom') {
    super(name);
    this.version(1).stores({
      profiles: 'id, updatedAt',
      meta: 'key',
    });
  }
}
