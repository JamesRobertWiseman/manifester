import type { AppRoute } from "../contracts.ts";
import type { DataRecord, LocalDataApi } from "../data/types.ts";
import { fillRoute, resolveRoute } from "./routes.ts";

const privateRecordParameters = new Set(["item_id", "record_id"]);

export interface ResolvedApplicationRoute {
  route: AppRoute;
  params: Record<string, string>;
  path: string;
}

function containsValue(value: unknown, expected: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsValue(item, expected));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsValue(item, expected));
  }
  return value !== null && value !== undefined && String(value) === expected;
}

function matchingRecord(data: LocalDataApi, resourceIds: string[], value: string): DataRecord | null {
  const direct = resourceIds.flatMap((resourceId) => data.get(resourceId, value) ?? []);
  if (direct.length === 1) return direct[0] ?? null;
  if (direct.length > 1) return null;

  const matches: DataRecord[] = [];
  for (const resourceId of resourceIds) {
    const result = data.list(resourceId, { search: value, limit: 500 });
    if (result.total > result.records.length) return null;
    matches.push(...result.records.filter(({ values }) => containsValue(values, value)));
  }
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function resolveApplicationRoute(
  routes: AppRoute[],
  path: string,
  data: LocalDataApi,
): ResolvedApplicationRoute | null {
  const resolved = resolveRoute(routes, path);
  if (!resolved) return null;
  const params = { ...resolved.params };
  for (const [name, value] of Object.entries(params)) {
    if (!privateRecordParameters.has(name)) continue;
    const record = matchingRecord(data, resolved.route.resourceIds, value);
    if (record) params[name] = record.id;
  }
  return { ...resolved, params, path: fillRoute(resolved.route.path, params) };
}
