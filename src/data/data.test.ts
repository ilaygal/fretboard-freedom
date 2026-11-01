import { beforeEach, describe, expect, it } from 'vitest';
import { AppDatabase } from './db';
import { createRepositories, type Repositories } from './index';

let db: AppDatabase;
let repos: Repositories;
let n = 0;

beforeEach(() => {
  db = new AppDatabase(`test-${n++}`);
  repos = createRepositories(db);
});

describe('profiles', () => {
  it('creates a profile with default settings and remembers the active one', async () => {
    const p = await repos.profiles.create({ name: '  ' });
    expect(p.name).toBe('Me');
    expect(p.settings.tuningId).toBe('standard');
    expect(p.settings.theoryLevel).toBe('simple');
    await repos.profiles.setActiveId(p.id);
    expect(await repos.profiles.getActiveId()).toBe(p.id);
  });

  it('updates settings without losing other settings', async () => {
    const p = await repos.profiles.create({ name: 'Dana' });
    await repos.profiles.updateSettings(p.id, { leftHanded: true });
    const after = await repos.profiles.updateSettings(p.id, { tuningId: 'dropD' });
    expect(after.settings.leftHanded).toBe(true);
    expect(after.settings.tuningId).toBe('dropD');
    expect(after.createdAt).toBe(p.createdAt);
  });

  it('fills in settings added in later versions', async () => {
    const p = await repos.profiles.create({ name: 'Old' });
    await db.profiles.put({ ...p, settings: { leftHanded: true } as never });
    const loaded = await repos.profiles.get(p.id);
    expect(loaded!.settings.leftHanded).toBe(true);
    expect(loaded!.settings.fretCount).toBe(22);
  });

  it('clears the active profile when it is removed', async () => {
    const p = await repos.profiles.create({ name: 'Temp' });
    await repos.profiles.setActiveId(p.id);
    await repos.profiles.remove(p.id);
    expect(await repos.profiles.getActiveId()).toBeUndefined();
  });
});

describe('backup', () => {
  it('round-trips all data through JSON', async () => {
    const p = await repos.profiles.create({ name: 'Ilay-like', settings: { leftHanded: true } });
    await repos.profiles.setActiveId(p.id);
    const file = JSON.parse(JSON.stringify(await repos.backup.exportAll()));

    const other = createRepositories(new AppDatabase(`test-${n++}`));
    await other.profiles.create({ name: 'will be replaced' });
    await other.backup.importAll(file);
    const list = await other.profiles.list();
    expect(list.map((x) => x.name)).toEqual(['Ilay-like']);
    expect(list[0]!.settings.leftHanded).toBe(true);
    expect(await other.profiles.getActiveId()).toBe(p.id);
  });

  it('rejects files that are not backups, without touching data', async () => {
    await repos.profiles.create({ name: 'Keep me' });
    await expect(repos.backup.importAll({ hello: 1 })).rejects.toThrow(/not a Fretboard Freedom backup/);
    await expect(repos.backup.importAll({ app: 'fretboard-freedom', schemaVersion: 999, tables: {} })).rejects.toThrow(/newer version/);
    expect((await repos.profiles.list()).length).toBe(1);
  });
});
