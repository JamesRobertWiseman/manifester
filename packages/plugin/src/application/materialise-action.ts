import { materialiseApplicationAction } from "../builder/builder.ts";
import type { ActionMaterialiseRequest } from "../contracts.ts";
import { loadAppRegistry } from "../runtime/registry.ts";
import { appRoot, loadDiscovery, saveState } from "../state/project-state.ts";
import type { ReportActivity } from "./activity.ts";
import { assertCatalogCurrent, loadCurrentProject } from "./project.ts";

export async function materialiseAction(
  project: string,
  request: ActionMaterialiseRequest,
  report: ReportActivity,
): Promise<string> {
  const { catalog, state } = await loadCurrentProject(project);
  const current = await loadAppRegistry(appRoot(project));
  const action = current.actions.find(({ id }) => id === request.actionId);
  if (!action) throw new Error("This option is no longer available.");
  if (action.targetPath) return action.targetPath;
  report(project, `View request: ${action.label} from ${request.path}`);
  report(project, `Designing view for: ${action.intent}`);
  const discovery = await loadDiscovery(project, catalog);
  const built = await materialiseApplicationAction({
    project,
    catalog,
    discovery,
    threadId: state.builderThreadId,
    action,
    path: request.path,
    context: request.context,
    onActivity: (message) => report(project, message),
  });
  await assertCatalogCurrent(project, catalog);
  const updated = built.registry.actions.find(({ id }) => id === action.id);
  if (!updated?.targetPath) throw new Error("This view could not be generated.");
  const route = built.registry.routes.find(({ path }) => path === updated.targetPath);
  report(project, `Design result: ${route?.title ?? action.label} at ${updated.targetPath}`);
  report(project, `Review passed: ${updated.targetPath} is visible and structurally valid`);
  await saveState(project, {
    ...state,
    builderThreadId: built.threadId,
    generatedAt: new Date().toISOString(),
  });
  report(project, `View ready: ${action.label}`);
  return updated.targetPath;
}
