import { materialiseApplicationRoute } from "../builder/builder.ts";
import type { RouteMaterialiseRequest } from "../contracts.ts";
import { loadAppRegistry } from "../runtime/registry.ts";
import { resolveRoute } from "../runtime/routes.ts";
import { appRoot, loadDiscovery, saveState } from "../state/project-state.ts";
import type { ReportActivity } from "./activity.ts";
import { assertCatalogCurrent, loadCurrentProject } from "./project.ts";

export async function materialiseRoute(
  project: string,
  request: RouteMaterialiseRequest,
  report: ReportActivity,
): Promise<string> {
  const { catalog, state } = await loadCurrentProject(project);
  if (resolveRoute((await loadAppRegistry(appRoot(project))).routes, request.path)) return request.path;
  report(project, `View request: ${request.path}`);
  report(project, `Designing view from address: ${request.path}`);
  const discovery = await loadDiscovery(project, catalog);
  const built = await materialiseApplicationRoute({
    project,
    catalog,
    discovery,
    path: request.path,
    onActivity: (message) => report(project, message),
  });
  await assertCatalogCurrent(project, catalog);
  const route = resolveRoute(built.registry.routes, request.path)?.route;
  if (!route) throw new Error("This view could not be generated.");
  report(project, `Design result: ${route.title} at ${request.path}`);
  report(project, `Review passed: ${request.path} is visible and linked from the application`);
  await saveState(project, {
    ...state,
    builderThreadId: built.threadId,
    generatedAt: new Date().toISOString(),
  });
  report(project, `View ready: ${route.title}`);
  return request.path;
}
