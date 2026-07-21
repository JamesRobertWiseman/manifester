import type { AggregateOptions, ListOptions, LocalDataApi } from "../data/types.ts";

export function scopedDataApi(data: LocalDataApi, resourceIds: string[]): LocalDataApi {
  const allowed = new Set(resourceIds);
  const requireResource = (resourceId: string) => {
    if (!allowed.has(resourceId)) throw new Error("This view cannot use that data.");
  };
  return Object.freeze({
    list: (resourceId: string, options?: ListOptions) => { requireResource(resourceId); return data.list(resourceId, options); },
    get: (resourceId: string, recordId: string) => { requireResource(resourceId); return data.get(resourceId, recordId); },
    aggregate: (resourceId: string, options: AggregateOptions) => { requireResource(resourceId); return data.aggregate(resourceId, options); },
    create: (resourceId: string, values: Record<string, unknown>) => { requireResource(resourceId); return data.create(resourceId, values); },
    update: (resourceId: string, recordId: string, values: Record<string, unknown>) => { requireResource(resourceId); return data.update(resourceId, recordId, values); },
    delete: (resourceId: string, recordId: string) => { requireResource(resourceId); return data.delete(resourceId, recordId); },
  });
}
