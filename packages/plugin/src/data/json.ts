type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export function toJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value !== "object") return null;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]));
}

export function toJsonObject(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]));
}
