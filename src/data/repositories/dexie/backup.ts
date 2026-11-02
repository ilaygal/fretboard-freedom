import { LOCAL_ONLY_TABLES, SCHEMA_VERSION, type AppDatabase } from '../../db';
import type { BackupFile, BackupRepository } from '../types';

export class DexieBackupRepository implements BackupRepository {
  constructor(private readonly db: AppDatabase) {}

  async exportAll(): Promise<BackupFile> {
    const tables: Record<string, unknown[]> = {};
    for (const table of this.backedUp()) tables[table.name] = await table.toArray();
    return { app: 'fretboard-freedom', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
  }

  private backedUp() {
    return this.db.tables.filter((t) => !LOCAL_ONLY_TABLES.includes(t.name));
  }

  /** Replaces all local data with the backup. Throws without changing anything if the file is not valid. */
  async importAll(file: unknown): Promise<void> {
    const backup = validate(file);
    const tables = this.backedUp();
    await this.db.transaction('rw', tables, async () => {
      for (const table of tables) {
        await table.clear();
        const rows = backup.tables[table.name];
        if (rows?.length) await table.bulkPut(rows);
      }
    });
  }
}

function validate(file: unknown): BackupFile {
  if (typeof file !== 'object' || file === null) throw new Error('This is not a Fretboard Freedom backup file.');
  const f = file as Partial<BackupFile>;
  if (f.app !== 'fretboard-freedom') throw new Error('This is not a Fretboard Freedom backup file.');
  if (typeof f.schemaVersion !== 'number' || f.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup comes from a newer version of the app. Update the app first.');
  }
  if (typeof f.tables !== 'object' || f.tables === null) throw new Error('The backup file is damaged.');
  for (const rows of Object.values(f.tables)) {
    if (!Array.isArray(rows)) throw new Error('The backup file is damaged.');
  }
  return f as BackupFile;
}
