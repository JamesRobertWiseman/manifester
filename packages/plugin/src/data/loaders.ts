import { basename, extname } from "node:path";
import { parse } from "csv-parse/sync";
import readExcelFile from "read-excel-file/node";
import { toJsonObject, toJsonValue, type JsonObject } from "./json.ts";
import type { RawResource } from "./types.ts";

export const DATASET_EXTENSIONS = new Set([".csv", ".json", ".xlsx", ".xlsm"]);

function uniqueNames(values: unknown[], count = values.length): string[] {
  const occurrences = new Map<string, number>();

  return Array.from({ length: count }, (_, index) => {
    const candidate = String(values[index] ?? "").trim() || `Column ${index + 1}`;
    const occurrence = (occurrences.get(candidate) ?? 0) + 1;
    occurrences.set(candidate, occurrence);
    return occurrence === 1 ? candidate : `${candidate} (${occurrence})`;
  });
}

function objectRow(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return toJsonObject(value as Record<string, unknown>);
  }
  return { value: toJsonValue(value) };
}

function fieldNames(rows: JsonObject[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

function csvResource(sourcePath: string, contents: Buffer): RawResource {
  const parsed = parse(contents, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];
  const width = Math.max(0, ...parsed.map((row) => row.length));
  const fields = uniqueNames(parsed[0] ?? [], width);
  const rows = parsed.slice(1).map((row) => Object.fromEntries(
    fields.map((field, index) => [field, row[index] ?? null]),
  ) as JsonObject);
  const name = basename(sourcePath, extname(sourcePath));
  return { sourcePath, kind: "dataset", name, tableName: name, fieldNames: fields, rows };
}

function jsonResources(sourcePath: string, contents: Buffer): RawResource[] {
  const parsed = JSON.parse(contents.toString("utf8")) as unknown;
  const fallbackName = basename(sourcePath, extname(sourcePath));
  const resource = (name: string, values: unknown[]): RawResource => {
    const rows = values.map(objectRow);
    return { sourcePath, kind: "dataset", name, tableName: name, fieldNames: fieldNames(rows), rows };
  };

  if (Array.isArray(parsed)) return [resource(fallbackName, parsed)];
  if (parsed === null || typeof parsed !== "object") return [resource(fallbackName, [parsed])];

  const entries = Object.entries(parsed);
  const tables = entries
    .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
    .map(([name, values]) => resource(name, values));
  const root = toJsonObject(Object.fromEntries(entries.filter(([, value]) => !Array.isArray(value))));
  if (Object.keys(root).length > 0) tables.unshift(resource(fallbackName, [root]));
  return tables.length > 0 ? tables : [resource(fallbackName, [parsed])];
}

async function spreadsheetResources(sourcePath: string, contents: Buffer): Promise<RawResource[]> {
  return (await readExcelFile(contents)).map(({ sheet, data }) => {
    const width = Math.max(0, ...data.map((row) => row.length));
    const fields = uniqueNames(data[0] ?? [], width);
    const rows = data.slice(1).flatMap((row) => {
      const values = fields.map((_, index) => toJsonValue(row[index]));
      return values.some((value) => value !== null && value !== "")
        ? [Object.fromEntries(fields.map((field, index) => [field, values[index] ?? null])) as JsonObject]
        : [];
    });
    return {
      sourcePath,
      kind: "dataset" as const,
      name: sheet,
      tableName: sheet,
      fieldNames: fields,
      rows,
    };
  });
}

export async function loadDataset(sourcePath: string, contents: Buffer): Promise<RawResource[]> {
  const extension = extname(sourcePath).toLowerCase();
  if (extension === ".csv") return [csvResource(sourcePath, contents)];
  if (extension === ".json") return jsonResources(sourcePath, contents);
  if (extension === ".xlsx" || extension === ".xlsm") return spreadsheetResources(sourcePath, contents);
  throw new Error(`Unsupported data file: ${sourcePath}`);
}
