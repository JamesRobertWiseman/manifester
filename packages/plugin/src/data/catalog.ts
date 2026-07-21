import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type { DataField, DataResource, ProjectCatalog, ProjectFile } from "../contracts.ts";
import { isPathInside } from "../path.ts";
import { fieldId, resourceId } from "./ids.ts";
import { contentFingerprint, inventoryProject } from "./inventory.ts";
import type { JsonValue } from "./json.ts";
import { loadDataset } from "./loaders.ts";
import type { ProjectRows, RawResource } from "./types.ts";

function absoluteSource(project: string, sourcePath: string): string {
  const absolute = resolve(project, sourcePath);
  if (!isPathInside(project, absolute)) {
    throw new Error(`Data file is outside the project: ${sourcePath}`);
  }
  return absolute;
}

function isDate(value: unknown): boolean {
  if (value instanceof Date) return true;
  if (typeof value !== "string") return false;
  return (/^\d{4}-\d{1,2}-\d{1,2}(?:[T ]|$)/.test(value)
    || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:[T ]|$)/.test(value))
    && !Number.isNaN(Date.parse(value));
}

function isNumberString(value: string): boolean {
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return false;
  const unsigned = value.trim().replace(/^[+-]/, "");
  return !/^0\d/.test(unsigned);
}

function fieldType(values: unknown[]): DataField["type"] {
  const populated = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (populated.length === 0) return "unknown";
  if (populated.every(isDate)) return "date";
  if (populated.every((value) => typeof value === "number" || (typeof value === "string" && isNumberString(value)))) {
    return "number";
  }
  if (populated.every((value) => typeof value === "boolean" || (typeof value === "string" && /^(true|false)$/i.test(value)))) {
    return "boolean";
  }
  const types = new Set(populated.map((value) => typeof value === "object" ? "object" : typeof value));
  if (types.size !== 1) return "unknown";
  const [type] = types;
  return type === "string" || type === "number" || type === "boolean" || type === "object" ? type : "unknown";
}

function valueForType(value: JsonValue, type: DataField["type"]): JsonValue {
  if (type === "number" && typeof value === "string") return Number(value);
  if (type === "boolean" && typeof value === "string") return value.toLowerCase() === "true";
  return value;
}

function uniqueSamples(values: unknown[]): unknown[] {
  const samples = new Map<string, unknown>();
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const key = JSON.stringify(value);
    if (!samples.has(key)) samples.set(key, value);
    if (samples.size === 8) break;
  }
  return [...samples.values()];
}

function profileResource(raw: RawResource): DataResource {
  const id = resourceId(raw.sourcePath, raw.tableName);
  const fields = raw.fieldNames.map((name): DataField => {
    const values = raw.rows.map((row) => row[name] ?? null);
    const type = fieldType(values);
    return {
      id: fieldId(id, name),
      name,
      type,
      samples: uniqueSamples(values.map((value) => valueForType(value, type))),
    };
  });
  return {
    id,
    name: raw.name,
    sourcePath: raw.sourcePath,
    tableName: raw.tableName,
    rowCount: raw.rows.length,
    fields,
  };
}

async function checkedContents(project: string, file: ProjectFile): Promise<Buffer> {
  const contents = await readFile(absoluteSource(project, file.path));
  const checksum = createHash("sha256").update(contents).digest("hex");
  if (checksum !== file.checksum) throw new Error(`The source file changed during discovery: ${file.path}`);
  return contents;
}

async function loadRawResources(project: string, catalog: ProjectCatalog): Promise<RawResource[]> {
  const root = await realpath(project);
  if (root !== resolve(catalog.project)) throw new Error("The catalog belongs to a different project.");
  const resources: RawResource[] = [];

  for (const file of catalog.files.filter((candidate) => candidate.kind === "dataset")) {
    resources.push(...await loadDataset(file.path, await checkedContents(root, file)));
  }
  return resources;
}

export async function inspectProject(project: string): Promise<ProjectCatalog> {
  const inventory = await inventoryProject(project);
  const files = inventory.files.map((file) => ({ ...file }));
  const resources: DataResource[] = [];

  for (const file of files.filter((candidate) => candidate.kind === "dataset")) {
    try {
      const contents = await checkedContents(inventory.project, file);
      resources.push(...(await loadDataset(file.path, contents)).map(profileResource));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("The source file changed during discovery:")) throw error;
      file.kind = "unsupported";
      file.note = "This data file could not be read.";
    }
  }

  return {
    project: inventory.project,
    fingerprint: contentFingerprint(files),
    files,
    resources,
  };
}

export async function loadProjectRows(project: string, catalog: ProjectCatalog): Promise<ProjectRows> {
  const root = await realpath(project);
  if (root !== resolve(catalog.project)) throw new Error("The catalog belongs to a different project.");
  const rawResources = await loadRawResources(root, catalog);
  const rawBySource = new Map(rawResources.map((raw) => [`${raw.sourcePath}\0${raw.tableName}`, raw]));

  return Object.fromEntries(catalog.resources.map((resource) => {
    const raw = rawBySource.get(`${resource.sourcePath}\0${resource.tableName}`);
    if (!raw) throw new Error(`The source table is unavailable: ${resource.name}`);
    const rows = raw.rows.map((row) => Object.fromEntries(resource.fields.map((field) => [
      field.id,
      valueForType(row[field.name] ?? null, field.type),
    ])));
    return [resource.id, rows];
  }));
}
