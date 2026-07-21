import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod/v4";
import type { AppRegistry } from "../contracts.ts";

const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const relativeFolder = z.string().regex(/^routes\/[A-Za-z0-9_-]+$/);
const routePath = z.string().regex(/^\/(?:[A-Za-z0-9._~-]+|:[A-Za-z][A-Za-z0-9_]*)(?:\/(?:[A-Za-z0-9._~-]+|:[A-Za-z][A-Za-z0-9_]*))*\/?$|^\/$/);

const appRegistrySchema = z.object({
  version: z.literal(1),
  application: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(300),
  }).strict(),
  homeRouteId: identifier,
  routes: z.array(z.object({
    id: identifier,
    path: routePath,
    title: z.string().trim().min(1).max(120),
    folder: relativeFolder,
    resourceIds: z.array(z.string().min(1)).max(8),
  }).strict()).min(1).max(40),
  actions: z.array(z.object({
    id: identifier,
    label: z.string().trim().min(1).max(100),
    intent: z.string().trim().min(1).max(500),
    sourceRouteId: identifier,
    resourceIds: z.array(z.string().min(1)).max(8),
    context: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/)).max(8),
    targetPath: routePath.optional(),
  }).strict()).max(80),
}).strict().superRefine((registry, context) => {
  const routeIds = new Set(registry.routes.map(({ id }) => id));
  if (!routeIds.has(registry.homeRouteId)) {
    context.addIssue({ code: "custom", message: "The home route does not exist.", path: ["homeRouteId"] });
  }
  if (registry.routes.find(({ id }) => id === registry.homeRouteId)?.path !== "/") {
    context.addIssue({ code: "custom", message: "The home view must use the root path.", path: ["homeRouteId"] });
  }
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(registry.routes.map(({ id }) => id))) {
    context.addIssue({ code: "custom", message: "Route IDs must be unique.", path: ["routes"] });
  }
  if (!unique(registry.routes.map(({ path }) => path))) {
    context.addIssue({ code: "custom", message: "Route paths must be unique.", path: ["routes"] });
  }
  const routeShapes = registry.routes.map(({ path }) => {
    const normalized = path.length > 1 ? path.replace(/\/$/, "") : path;
    return normalized.replace(/:[A-Za-z][A-Za-z0-9_]*/g, ":value");
  });
  if (!unique(routeShapes)) {
    context.addIssue({ code: "custom", message: "Two views cannot use the same path shape.", path: ["routes"] });
  }
  if (!unique(registry.routes.map(({ folder }) => folder))) {
    context.addIssue({ code: "custom", message: "Route folders must be unique.", path: ["routes"] });
  }
  registry.routes.forEach((route, index) => {
    if (!unique(route.resourceIds)) {
      context.addIssue({ code: "custom", message: "A view cannot list the same data twice.", path: ["routes", index, "resourceIds"] });
    }
  });
  if (!unique(registry.actions.map(({ id }) => id))) {
    context.addIssue({ code: "custom", message: "Action IDs must be unique.", path: ["actions"] });
  }
  registry.actions.forEach((action, index) => {
    if (!unique(action.resourceIds) || !unique(action.context)) {
      context.addIssue({ code: "custom", message: "An action cannot list the same value twice.", path: ["actions", index] });
    }
    if (!routeIds.has(action.sourceRouteId)) {
      context.addIssue({ code: "custom", message: "The action's starting view does not exist.", path: ["actions", index, "sourceRouteId"] });
    }
    if (action.targetPath) {
      if (!registry.routes.some(({ path }) => path === action.targetPath)) {
        context.addIssue({ code: "custom", message: "The action's target view does not exist.", path: ["actions", index, "targetPath"] });
      }
      const parameters = [...action.targetPath.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => match[1]);
      if (action.context.length > 0 && parameters.length === 0) {
        context.addIssue({ code: "custom", message: "A reusable action must keep a value in its target path.", path: ["actions", index, "targetPath"] });
      }
      if (parameters.some((name) => name && !action.context.includes(name))) {
        context.addIssue({ code: "custom", message: "The action is missing a value required by its target view.", path: ["actions", index, "context"] });
      }
    }
  });
});

export async function loadAppRegistry(appRoot: string): Promise<AppRegistry> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(join(appRoot, "app.json"), "utf8"));
  } catch {
    throw new Error("The generated application is missing a readable app.json file.");
  }
  const registry = appRegistrySchema.safeParse(parsed);
  if (!registry.success) {
    const details = registry.error.issues
      .slice(0, 5)
      .map(({ message, path }) => `${path.join(".")}: ${message}`)
      .join(" ");
    throw new Error(`The generated application setup is not valid. ${details}`);
  }
  return registry.data as AppRegistry;
}
