import { beforeEach, describe, expect, it } from 'vitest';
import { AppDatabase, SCHEMA_VERSION } from './db';
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

describe('practice data', () => {
  it('logs attempts and lists them by drill and time', async () => {
    const base = { profileId: 'p1', itemKey: 'note:7@s3', correct: true, ms: 1200, input: 'tap' as const };
    await repos.attempts.add({ ...base, drillId: 'find', at: 300 });
    await repos.attempts.add({ ...base, drillId: 'name', at: 100 });
    await repos.attempts.add({ ...base, drillId: 'find', at: 200 });
    await repos.attempts.add({ ...base, profileId: 'p2', drillId: 'find', at: 250 });
    expect((await repos.attempts.list('p1')).map((a) => a.at)).toEqual([100, 200, 300]);
    expect((await repos.attempts.list('p1', { drillId: 'find' })).map((a) => a.at)).toEqual([200, 300]);
    expect((await repos.attempts.list('p1', { since: 150 })).map((a) => a.at)).toEqual([200, 300]);
  });

  it('stores spaced-repetition cards per profile', async () => {
    const card = { profileId: 'p1', itemKey: 'a', stability: 1, difficulty: 5, reps: 1, lapses: 0, lastReview: 0, due: 10 };
    await repos.srs.put(card);
    await repos.srs.put({ ...card, profileId: 'p2' });
    const got = await repos.srs.getMany('p1', ['a', 'b']);
    expect([...got.keys()]).toEqual(['a']);
    expect((await repos.srs.list('p1')).length).toBe(1);
  });

  it('includes practice data in backups', async () => {
    await repos.attempts.add({ profileId: 'p', drillId: 'd', itemKey: 'k', correct: false, ms: 1, at: 1, input: 'mic' });
    const file = await repos.backup.exportAll();
    expect(file.tables.attempts?.length).toBe(1);
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('licks and recordings', () => {
  it('saves licks per profile and backs them up, but keeps recordings local', async () => {
    const p = await repos.profiles.create({ name: 'p' });
    await repos.licks.save({ id: 'l1', profileId: p.id, name: 'My lick', scale: 'minorPentatonic', notes: [{ st: 0, dur: 2 }], tags: [], createdAt: 1 });
    await repos.licks.save({ id: 'l2', profileId: 'someone-else', name: 'x', scale: 'major', notes: [], tags: [], createdAt: 2 });
    expect((await repos.licks.list(p.id)).map((l) => l.name)).toEqual(['My lick']);

    await repos.recordings.add({ id: 'r1', profileId: p.id, at: 1, title: 'first', mime: 'audio/webm', blob: new Blob(['a']), seconds: 3 });
    await repos.recordings.add({ id: 'r2', profileId: p.id, at: 2, title: 'second', mime: 'audio/webm', blob: new Blob(['b']), seconds: 4 });
    expect((await repos.recordings.list(p.id)).map((r) => r.title)).toEqual(['second', 'first']);

    const file = await repos.backup.exportAll();
    expect(file.tables.licks).toHaveLength(2);
    expect(file.tables.recordings).toBeUndefined();

    // Importing a backup leaves this device's recordings alone.
    await repos.backup.importAll(JSON.parse(JSON.stringify(file)));
    expect(await repos.recordings.list(p.id)).toHaveLength(2);
    await repos.recordings.remove('r1');
    await repos.licks.remove('l1');
    expect(await repos.recordings.list(p.id)).toHaveLength(1);
    expect(await repos.licks.list(p.id)).toHaveLength(0);
  });
});
