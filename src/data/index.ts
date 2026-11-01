import { AppDatabase } from './db';
import { DexieBackupRepository } from './repositories/dexie/backup';
import { DexieProfileRepository } from './repositories/dexie/profiles';
import { DexieAttemptRepository, DexieSrsRepository } from './repositories/dexie/practice';
import type { AttemptRepository, BackupRepository, ProfileRepository, SrsRepository } from './repositories/types';

export interface Repositories {
  profiles: ProfileRepository;
  backup: BackupRepository;
  attempts: AttemptRepository;
  srs: SrsRepository;
}

export function createRepositories(db: AppDatabase): Repositories {
  return {
    profiles: new DexieProfileRepository(db),
    backup: new DexieBackupRepository(db),
    attempts: new DexieAttemptRepository(db),
    srs: new DexieSrsRepository(db),
  };
}

export const db = new AppDatabase();
export const repos = createRepositories(db);

export * from './types';
export type * from './repositories/types';
