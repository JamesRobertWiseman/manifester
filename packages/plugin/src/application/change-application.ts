import { changeGeneratedApplication } from "../builder/builder.ts";
import { loadDiscovery, saveState } from "../state/project-state.ts";
import type { ReportActivity } from "./activity.ts";
import { assertCatalogCurrent, loadCurrentProject } from "./project.ts";

export async function changeApplication(
  project: string,
  instruction: string,
  report: ReportActivity,
) {
  report(project, "Application update started");
  const { catalog, state } = await loadCurrentProject(project);
  const discovery = await loadDiscovery(project, catalog);
  report(project, "Designing application update");
  const built = await changeGeneratedApplication({
    project,
    catalog,
    discovery,
    instruction,
    onActivity: (message) => report(project, message),
  });
  await assertCatalogCurrent(project, catalog);
  await saveState(project, {
    ...state,
    builderThreadId: built.threadId,
    generatedAt: new Date().toISOString(),
  });
  report(project, "Application update published");
  return { catalog, registry: built.registry };
}
