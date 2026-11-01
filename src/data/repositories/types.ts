import type { Background, Profile, Settings } from '../types';

/**
 * Data access goes through these interfaces only. Today they are backed by IndexedDB (Dexie);
 * a synced backend (e.g. Supabase) can implement the same interfaces later.
 */
export interface ProfileRepository {
  list(): Promise<Profile[]>;
  get(id: string): Promise<Profile | undefined>;
  create(input: { name: string; settings?: Partial<Settings>; background?: Partial<Background> }): Promise<Profile>;
  update(id: string, patch: Partial<Omit<Profile, 'id' | 'createdAt'>>): Promise<Profile>;
  updateSettings(id: string, patch: Partial<Settings>): Promise<Profile>;
  remove(id: string): Promise<void>;
  getActiveId(): Promise<string | undefined>;
  setActiveId(id: string): Promise<void>;
}

export interface BackupRepository {
  exportAll(): Promise<BackupFile>;
  importAll(file: unknown): Promise<void>;
}

export interface BackupFile {
  app: 'fretboard-freedom';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}
