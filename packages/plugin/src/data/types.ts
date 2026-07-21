import type { JsonObject, JsonValue } from "./json.ts";

export interface RawResource {
  sourcePath: string;
  name: string;
  tableName: string;
  fieldNames: string[];
  rows: JsonObject[];
}

export type ProjectRows = Record<string, JsonObject[]>;

export interface DataRecord {
  id: string;
  values: JsonObject;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ListResult {
  records: DataRecord[];
  total: number;
  limit: number;
  offset: number;
}

type AggregateOperation = "count" | "sum" | "average" | "minimum" | "maximum";

export interface AggregateOptions {
  operation: AggregateOperation;
  fieldId?: string;
  groupByFieldId?: string;
}

export interface AggregateResult {
  operation: AggregateOperation;
  fieldId: string | null;
  groupByFieldId: string | null;
  groups: Array<{ key: JsonValue; value: number | null }>;
}

export interface LocalDataApi {
  list(resourceId: string, options?: ListOptions): ListResult;
  get(resourceId: string, recordId: string): DataRecord | null;
  aggregate(resourceId: string, options: AggregateOptions): AggregateResult;
  create(resourceId: string, values: Record<string, unknown>): DataRecord;
  update(resourceId: string, recordId: string, values: Record<string, unknown>): DataRecord;
  delete(resourceId: string, recordId: string): boolean;
}
