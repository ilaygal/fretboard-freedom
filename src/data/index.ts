import { AppDatabase } from './db';
import { DexieBackupRepository } from './repositories/dexie/backup';
import { DexieProfileRepository } from './repositories/dexie/profiles';
import type { BackupRepository, ProfileRepository } from './repositories/types';

export interface Repositories {
  profiles: ProfileRepository;
  backup: BackupRepository;
}

export function createRepositories(db: AppDatabase): Repositories {
  return { profiles: new DexieProfileRepository(db), backup: new DexieBackupRepository(db) };
}

export const db = new AppDatabase();
export const repos = createRepositories(db);

export * from './types';
export type * from './repositories/types';
