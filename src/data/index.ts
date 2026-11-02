import { AppDatabase } from './db';
import { DexieBackupRepository } from './repositories/dexie/backup';
import { DexieProfileRepository } from './repositories/dexie/profiles';
import { DexieAttemptRepository, DexieSrsRepository } from './repositories/dexie/practice';
import { DexieLickRepository, DexieRecordingRepository } from './repositories/dexie/library';
import type {
  AttemptRepository,
  BackupRepository,
  LickRepository,
  ProfileRepository,
  RecordingRepository,
  SrsRepository,
} from './repositories/types';

export interface Repositories {
  profiles: ProfileRepository;
  backup: BackupRepository;
  attempts: AttemptRepository;
  srs: SrsRepository;
  licks: LickRepository;
  recordings: RecordingRepository;
}

export function createRepositories(db: AppDatabase): Repositories {
  return {
    profiles: new DexieProfileRepository(db),
    backup: new DexieBackupRepository(db),
    attempts: new DexieAttemptRepository(db),
    srs: new DexieSrsRepository(db),
    licks: new DexieLickRepository(db),
    recordings: new DexieRecordingRepository(db),
  };
}

export const db = new AppDatabase();
export const repos = createRepositories(db);

export * from './types';
export type * from './repositories/types';
