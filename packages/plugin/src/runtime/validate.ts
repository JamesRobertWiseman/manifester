import { lstat, readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AppRegistry } from "../contracts.ts";
import { loadAppRegistry } from "./registry.ts";
import { assertCss } from "./validation/css.ts";
import { assertKnownDataIds } from "./validation/data.ts";
import { assertPathInside, requiredFile } from "./validation/files.ts";
import { analyzeHtml, assertVisibleMain } from "./validation/html.ts";
import { assertBrowserJavaScript, assertServerJavaScript } from "./validation/javascript.ts";

function assertDataAccess(registry: AppRegistry, allowedResourceIds: ReadonlySet<string>): void {
  const home = registry.routes.find(({ id }) => id === registry.homeRouteId);
  const homeResourceIds = new Set([
    ...(home?.resourceIds ?? []),
    ...registry.actions
      .filter(({ sourceRouteId }) => sourceRouteId === registry.homeRouteId)
      .flatMap(({ resourceIds }) => resourceIds),
  ]);
  if ([...allowedResourceIds].some((id) => !homeResourceIds.has(id))) {
    throw new Error("The generated home view must provide access to all available data.");
  }
  registry.routes.forEach((route, index) => {
    if (route.resourceIds.some((id) => !allowedResourceIds.has(id))) {
      throw new Error(`Generated view ${index + 1} uses data that is not available.`);
    }
  });
  registry.actions.forEach((action, index) => {
    if (action.resourceIds.some((id) => !allowedResourceIds.has(id))) {
      throw new Error(`Generated action ${index + 1} uses data that is not available.`);
    }
  });
}

function assertActions(registry: AppRegistry, routeId: string, actionIds: string[], count: number, title: string): void {
  const referenced = new Set(actionIds);
  const expected = registry.actions.filter(({ sourceRouteId }) => sourceRouteId === routeId).map(({ id }) => id);
  if (actionIds.length !== count
    || actionIds.some((id) => !registry.actions.some((action) => action.id === id && action.sourceRouteId === routeId))
    || expected.some((id) => !referenced.has(id))) {
    throw new Error(`The generated view ${title} refers to an action that is not available there.`);
  }
}

export async function validateGeneratedApp(
  appRoot: string,
  allowedResourceIds: ReadonlySet<string>,
  fieldsByResource: ReadonlyMap<string, ReadonlySet<string>>,
): Promise<AppRegistry> {
  const root = await realpath(resolve(appRoot));
  await requiredFile(join(root, "app.json"));
  const registry = await loadAppRegistry(root);
  assertDataAccess(registry, allowedResourceIds);
  for (const route of registry.routes) {
    const folder = resolve(root, route.folder);
    assertPathInside(root, folder);
    const details = await lstat(folder).catch(() => null);
    if (!details?.isDirectory() || details.isSymbolicLink()) {
      throw new Error(`The generated view ${route.title} is missing its folder.`);
    }
    assertPathInside(root, await realpath(folder));
    const [html, css, script] = await Promise.all([
      requiredFile(join(folder, "page.html")),
      requiredFile(join(folder, "page.css")),
      requiredFile(join(folder, "page.js")),
    ]);
    const analysis = analyzeHtml(html, route.title);
    assertActions(registry, route.id, analysis.actionIds, analysis.actionAttributeCount, route.title);
    assertCss(css);
    assertBrowserJavaScript(script);
    assertVisibleMain(analysis.hiddenMainId, script, route.title);
    const apiPath = join(folder, "api.mjs");
    const apiDetails = await lstat(apiPath).catch(() => null);
    if (apiDetails?.isSymbolicLink()) throw new Error("Generated server code cannot be a linked file.");
    const api = apiDetails?.isFile() ? await readFile(apiPath, "utf8") : null;
    if (api !== null) assertServerJavaScript(api);
    const sources = [html, css, script, api ?? ""];
    if (sources.some((source) => /manifester-generation|manifester-route|__manifester\/bridge/i.test(source))) {
      throw new Error("Generated code cannot change Manifester's loading message.");
    }
    const routeResourceIds = new Set(route.resourceIds);
    const routeFieldIds = new Set(route.resourceIds.flatMap((resourceId) => [...(fieldsByResource.get(resourceId) ?? [])]));
    sources.forEach((source) => assertKnownDataIds(source, routeResourceIds, routeFieldIds));
  }
  return registry;
}
