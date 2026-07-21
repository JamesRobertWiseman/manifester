import { DatabaseSync } from "node:sqlite";

interface DatabaseMigration {
  version: number;
  up(database: DatabaseSync): void;
}

const migrations: DatabaseMigration[] = [
  {
    version: 1,
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS resources (
          resource_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source_path TEXT NOT NULL,
          table_name TEXT NOT NULL,
          fields_json TEXT NOT NULL CHECK(json_valid(fields_json))
        ) STRICT;
        CREATE TABLE IF NOT EXISTS records (
          resource_id TEXT NOT NULL REFERENCES resources(resource_id),
          record_id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          data_json TEXT NOT NULL CHECK(json_valid(data_json)),
          origin TEXT NOT NULL CHECK(origin IN ('source', 'local')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(resource_id, record_id)
        ) STRICT;
        CREATE INDEX IF NOT EXISTS records_by_resource ON records(resource_id, sort_order);
        CREATE TABLE IF NOT EXISTS change_log (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          change_id TEXT NOT NULL UNIQUE,
          resource_id TEXT NOT NULL,
          record_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
          before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),
          after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json)),
          occurred_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        ) STRICT;
        CREATE TRIGGER IF NOT EXISTS change_log_no_update
        BEFORE UPDATE ON change_log BEGIN SELECT RAISE(ABORT, 'change_log is append-only'); END;
        CREATE TRIGGER IF NOT EXISTS change_log_no_delete
        BEFORE DELETE ON change_log BEGIN SELECT RAISE(ABORT, 'change_log is append-only'); END;
      `);
    },
  },
  {
    version: 2,
    up(database) {
      database.exec(`
        CREATE INDEX IF NOT EXISTS change_log_by_record
        ON change_log(resource_id, record_id, sequence);
      `);
    },
  },
];

const DATABASE_SCHEMA_VERSION = migrations.at(-1)?.version ?? 0;

export function migrateDatabase(database: DatabaseSync): void {
  const row = database.prepare("PRAGMA user_version").get() as { user_version: number };
  if (row.user_version > DATABASE_SCHEMA_VERSION) {
    throw new Error("This application data was created by a newer version of Manifester.");
  }

  for (const migration of migrations.filter(({ version }) => version > row.user_version)) {
    database.exec("BEGIN IMMEDIATE");
    try {
      migration.up(database);
      database.prepare(`PRAGMA user_version = ${migration.version}`).run();
      database.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
