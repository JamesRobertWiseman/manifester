import type { AppRoute } from "../contracts.ts";

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function matchRoute(template: string, path: string): Record<string, string> | null {
  const expected = template.split("/").filter(Boolean);
  const actual = path.split("/").filter(Boolean);
  if (expected.length !== actual.length) return null;
  const parameters: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const raw = actual[index];
    if (raw === undefined) return null;
    const value = decode(raw);
    if (value === null) return null;
    if (segment.startsWith(":")) parameters[segment.slice(1)] = value;
    else if (segment !== value) return null;
  }
  return parameters;
}

export function resolveRoute(routes: AppRoute[], path: string): { route: AppRoute; params: Record<string, string> } | null {
  const ordered = routes.toSorted((left, right) => {
    const leftParameters = left.path.split("/").filter((part) => part.startsWith(":")).length;
    const rightParameters = right.path.split("/").filter((part) => part.startsWith(":")).length;
    return leftParameters - rightParameters;
  });
  for (const route of ordered) {
    const params = matchRoute(route.path, path);
    if (params) return { route, params };
  }
  return null;
}

export function fillRoute(template: string, context: Record<string, unknown>): string {
  return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    if (!Object.hasOwn(context, name)) throw new Error("This view is missing information it needs to open.");
    const value = context[name];
    if (value === undefined || value === null || value === "") {
      throw new Error("This view is missing information it needs to open.");
    }
    return encodeURIComponent(String(value));
  });
}
