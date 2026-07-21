import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DataField, ProjectCatalog } from "../contracts.ts";
import { migrateDatabase } from "./database-migrations.ts";
import { sourceRecordId } from "./ids.ts";
import { toJsonObject, type JsonObject, type JsonValue } from "./json.ts";
import { loadProjectRows } from "./catalog.ts";
import type {
  AggregateOptions,
  AggregateResult,
  DataRecord,
  ListOptions,
  ListResult,
  LocalDataApi,
} from "./types.ts";

interface MetadataRow { value: string }
interface ResourceRow { fields_json: string }
interface RecordRow { record_id: string; data_json: string }

function recordFromRow(row: RecordRow): DataRecord {
  const values: unknown = JSON.parse(row.data_json);
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("The local data record is not valid.");
  return { id: row.record_id, values: toJsonObject(values as Record<string, unknown>) };
}

function bounded(value: number | undefined, fallback: number): number {
  return Math.max(0, Math.min(500, Math.trunc(value ?? fallback)));
}

function aggregateValue(operation: AggregateOptions["operation"], values: JsonValue[]): number | null {
  if (operation === "count") return values.length;
  const numbers = values.flatMap((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return [value];
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return [Number(value)];
    return [];
  });
  if (operation === "sum") return numbers.reduce((total, value) => total + value, 0);
  if (numbers.length === 0) return null;
  if (operation === "average") return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  return operation === "minimum" ? Math.min(...numbers) : Math.max(...numbers);
}

function groupKey(value: JsonValue): string {
  return JSON.stringify([typeof value, value]);
}

export class LocalDataStore {
  readonly #database: DatabaseSync;
  readonly #project: string;
  #closed = false;

  constructor(project: string) {
    this.#project = resolve(project);
    const file = resolve(this.#project, ".manifester/data.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    this.#database = new DatabaseSync(file, { timeout: 5_000 });
    this.#database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    migrateDatabase(this.#database);
  }

  async initialize(catalog: ProjectCatalog): Promise<void> {
    const storedFingerprint = this.#metadata("source_fingerprint");
    if (storedFingerprint === catalog.fingerprint) return;
    if (storedFingerprint) {
      throw new Error("The source files changed. Rebuild or reset the Manifester application before continuing.");
    }

    const rows = await loadProjectRows(this.#project, catalog);
    const now = new Date().toISOString();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare("DELETE FROM records").run();
      this.#database.prepare("DELETE FROM resources").run();
      const insertResource = this.#database.prepare(`
        INSERT INTO resources(resource_id, name, source_path, table_name, fields_json)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertRecord = this.#database.prepare(`
        INSERT INTO records(resource_id, record_id, sort_order, data_json, origin, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'source', ?, ?)
      `);

      for (const resource of catalog.resources) {
        insertResource.run(resource.id, resource.name, resource.sourcePath, resource.tableName, JSON.stringify(resource.fields));
        (rows[resource.id] ?? []).forEach((values, index) => {
          const data = toJsonObject(values);
          insertRecord.run(resource.id, sourceRecordId(resource.id, index, data), index, JSON.stringify(data), now, now);
        });
      }

      this.#setMetadata("source_fingerprint", catalog.fingerprint);
      this.#setMetadata("initialized_at", now);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  list(resourceId: string, options: ListOptions = {}): ListResult {
    this.#fields(resourceId);
    const limit = bounded(options.limit, 100);
    const offset = bounded(options.offset, 0);
    const search = options.search?.trim();
    const escaped = search?.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    const where = search ? "resource_id = ? AND data_json LIKE ? ESCAPE '\\'" : "resource_id = ?";
    const values = search ? [resourceId, `%${escaped}%`] : [resourceId];
    const rows = this.#database.prepare(`
      SELECT record_id, data_json FROM records
      WHERE ${where} ORDER BY sort_order LIMIT ? OFFSET ?
    `).all(...values, limit, offset) as unknown as RecordRow[];
    const count = this.#database.prepare(`SELECT COUNT(*) AS total FROM records WHERE ${where}`)
      .get(...values) as { total: number };
    return { records: rows.map(recordFromRow), total: count.total, limit, offset };
  }

  get(resourceId: string, recordId: string): DataRecord | null {
    this.#fields(resourceId);
    const row = this.#database.prepare(`
      SELECT record_id, data_json FROM records WHERE resource_id = ? AND record_id = ?
    `).get(resourceId, recordId) as RecordRow | undefined;
    return row ? recordFromRow(row) : null;
  }

  aggregate(resourceId: string, options: AggregateOptions): AggregateResult {
    const fields = this.#fields(resourceId);
    if (options.operation !== "count" && !options.fieldId) throw new Error(`${options.operation} requires a field ID.`);
    if (options.fieldId) this.#assertField(fields, options.fieldId);
    if (options.groupByFieldId) this.#assertField(fields, options.groupByFieldId);
    const rows = this.#database.prepare("SELECT record_id, data_json FROM records WHERE resource_id = ? ORDER BY sort_order")
      .all(resourceId) as unknown as RecordRow[];
    const groups = new Map<string, { key: JsonValue; values: JsonValue[] }>();

    for (const record of rows.map(recordFromRow)) {
      const key = options.groupByFieldId ? record.values[options.groupByFieldId] ?? null : null;
      const encoded = groupKey(key);
      const group = groups.get(encoded) ?? { key, values: [] };
      group.values.push(options.fieldId ? record.values[options.fieldId] ?? null : record.id);
      groups.set(encoded, group);
    }
    if (groups.size === 0 && !options.groupByFieldId) groups.set(groupKey(null), { key: null, values: [] });

    return {
      operation: options.operation,
      fieldId: options.fieldId ?? null,
      groupByFieldId: options.groupByFieldId ?? null,
      groups: [...groups.values()].map((group) => ({
        key: group.key,
        value: aggregateValue(options.operation, group.values),
      })),
    };
  }

  create(resourceId: string, values: Record<string, unknown>): DataRecord {
    const data = this.#validatedValues(resourceId, values);
    const record: DataRecord = { id: randomUUID(), values: data };
    const now = new Date().toISOString();
    this.#transaction(() => {
      const next = this.#database.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM records WHERE resource_id = ?")
        .get(resourceId) as { value: number };
      this.#database.prepare(`
        INSERT INTO records(resource_id, record_id, sort_order, data_json, origin, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'local', ?, ?)
      `).run(resourceId, record.id, next.value, JSON.stringify(data), now, now);
      this.#log(resourceId, record.id, "create", null, data, now);
    });
    return record;
  }

  update(resourceId: string, recordId: string, values: Record<string, unknown>): DataRecord {
    const current = this.get(resourceId, recordId);
    if (!current) throw new Error("The record does not exist.");
    const changes = this.#validatedValues(resourceId, values);
    const next: DataRecord = { id: recordId, values: { ...current.values, ...changes } };
    const now = new Date().toISOString();
    this.#transaction(() => {
      this.#database.prepare(`
        UPDATE records SET data_json = ?, updated_at = ? WHERE resource_id = ? AND record_id = ?
      `).run(JSON.stringify(next.values), now, resourceId, recordId);
      this.#log(resourceId, recordId, "update", current.values, next.values, now);
    });
    return next;
  }

  delete(resourceId: string, recordId: string): boolean {
    const current = this.get(resourceId, recordId);
    if (!current) return false;
    const now = new Date().toISOString();
    this.#transaction(() => {
      this.#database.prepare("DELETE FROM records WHERE resource_id = ? AND record_id = ?").run(resourceId, recordId);
      this.#log(resourceId, recordId, "delete", current.values, null, now);
    });
    return true;
  }

  api(): LocalDataApi {
    return {
      list: (resourceId, options) => this.list(resourceId, options),
      get: (resourceId, recordId) => this.get(resourceId, recordId),
      aggregate: (resourceId, options) => this.aggregate(resourceId, options),
      create: (resourceId, values) => this.create(resourceId, values),
      update: (resourceId, recordId, values) => this.update(resourceId, recordId, values),
      delete: (resourceId, recordId) => this.delete(resourceId, recordId),
    };
  }

  close(): void {
    if (this.#closed) return;
    this.#database.close();
    this.#closed = true;
  }

  #metadata(key: string): string | null {
    const row = this.#database.prepare("SELECT value FROM metadata WHERE key = ?").get(key) as MetadataRow | undefined;
    return row?.value ?? null;
  }

  #setMetadata(key: string, value: string): void {
    this.#database.prepare("INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)").run(key, value);
  }

  #fields(resourceId: string): DataField[] {
    const row = this.#database.prepare("SELECT fields_json FROM resources WHERE resource_id = ?")
      .get(resourceId) as ResourceRow | undefined;
    if (!row) throw new Error(`Unknown data resource: ${resourceId}`);
    return JSON.parse(row.fields_json) as DataField[];
  }

  #assertField(fields: DataField[], id: string): void {
    if (!fields.some((field) => field.id === id)) throw new Error(`Unknown field ID: ${id}`);
  }

  #validatedValues(resourceId: string, values: Record<string, unknown>): JsonObject {
    const fields = this.#fields(resourceId);
    Object.keys(values).forEach((id) => this.#assertField(fields, id));
    return toJsonObject(values);
  }

  #log(
    resourceId: string,
    recordId: string,
    operation: "create" | "update" | "delete",
    before: JsonObject | null,
    after: JsonObject | null,
    occurredAt: string,
  ): void {
    this.#database.prepare(`
      INSERT INTO change_log(change_id, resource_id, record_id, operation, before_json, after_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      resourceId,
      recordId,
      operation,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      occurredAt,
    );
  }

  #transaction(action: () => void): void {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      action();
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }
}
