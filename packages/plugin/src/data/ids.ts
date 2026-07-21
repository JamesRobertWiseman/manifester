import { createHash } from "node:crypto";

function hash(...parts: string[]): string {
  const digest = createHash("sha256");
  parts.forEach((part) => digest.update(part).update("\0"));
  return digest.digest("hex").slice(0, 24);
}

export function resourceId(sourcePath: string, tableName: string): string {
  return `resource_${hash(sourcePath, tableName)}`;
}

export function fieldId(resource: string, fieldName: string): string {
  return `field_${hash(resource, fieldName)}`;
}

export function sourceRecordId(resource: string, index: number, values: Record<string, unknown>): string {
  return `record_${hash(resource, String(index), JSON.stringify(values))}`;
}
