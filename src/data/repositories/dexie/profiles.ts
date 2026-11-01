import type { AppDatabase } from '../../db';
import { DEFAULT_SETTINGS, withDefaults, type Profile } from '../../types';
import type { ProfileRepository } from '../types';

const ACTIVE = 'activeProfileId';

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class DexieProfileRepository implements ProfileRepository {
  constructor(private readonly db: AppDatabase) {}

  list() {
    return this.db.profiles.orderBy('updatedAt').reverse().toArray();
  }

  async get(id: string) {
    const p = await this.db.profiles.get(id);
    return p ? { ...p, settings: withDefaults(p.settings) } : undefined;
  }

  async create(input: Parameters<ProfileRepository['create']>[0]) {
    const now = Date.now();
    const profile: Profile = {
      id: newId(),
      name: input.name.trim() || 'Me',
      createdAt: now,
      updatedAt: now,
      onboarded: false,
      settings: { ...DEFAULT_SETTINGS, ...input.settings },
      background: { knows: [], goals: [], styles: [], ...input.background },
    };
    await this.db.profiles.add(profile);
    return profile;
  }

  async update(id: string, patch: Parameters<ProfileRepository['update']>[1]) {
    const current = await this.get(id);
    if (!current) throw new Error(`No profile ${id}`);
    const next: Profile = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: Date.now() };
    await this.db.profiles.put(next);
    return next;
  }

  async updateSettings(id: string, patch: Parameters<ProfileRepository['updateSettings']>[1]) {
    const current = await this.get(id);
    if (!current) throw new Error(`No profile ${id}`);
    return this.update(id, { settings: { ...current.settings, ...patch } });
  }

  async remove(id: string) {
    await this.db.transaction('rw', this.db.profiles, this.db.meta, async () => {
      await this.db.profiles.delete(id);
      const active = await this.db.meta.get(ACTIVE);
      if (active?.value === id) await this.db.meta.delete(ACTIVE);
    });
  }

  async getActiveId() {
    const row = await this.db.meta.get(ACTIVE);
    return typeof row?.value === 'string' ? row.value : undefined;
  }

  async setActiveId(id: string) {
    await this.db.meta.put({ key: ACTIVE, value: id });
  }
}
