import { buildInitialApplication } from "../builder/builder.ts";
import type { ProjectCatalog } from "../contracts.ts";
import { inspectProject } from "../data/catalog.ts";
import { prepareDocumentContext } from "../discovery/document-context.ts";
import { DiscoverySession } from "../discovery/discover.ts";
import type { BuildProgress } from "../runtime/progress.ts";
import { saveCatalog, saveDiscovery, saveState } from "../state/project-state.ts";
import type { ReportActivity } from "./activity.ts";
import { assertCatalogCurrent } from "./project.ts";
import type { AskDiscoveryQuestions } from "./questions.ts";

interface CreateApplicationOptions {
  project: string;
  progress: BuildProgress;
  askQuestions: AskDiscoveryQuestions;
  report: ReportActivity;
}

export async function createApplication(options: CreateApplicationOptions): Promise<ProjectCatalog | null> {
  const { project, progress, askQuestions, report } = options;
  const update = (message: string) => {
    progress.update(message);
    report(project, message);
  };
  update("Project signals are coming in...");
  const catalog = await inspectProject(project);
  const documentPaths = await prepareDocumentContext(project, catalog);
  report(project, `Assessing codebase: ${catalog.files.length} project ${catalog.files.length === 1 ? "file" : "files"}`);
  report(project, `Content assessment: ${catalog.resources.map(({ name, rowCount, fields }) => `${name} (${rowCount} entries, ${fields.length} fields)`).join("; ")}`);
  if (documentPaths.length > 0) {
    report(project, `Document extraction: ${documentPaths.length} ${documentPaths.length === 1 ? "document" : "documents"} ready`);
  }
  update("Data constellations are taking shape...");
  const discoverySession = new DiscoverySession(catalog, documentPaths);
  let discovery = await discoverySession.run();
  report(project, `Assessment result: ${discovery.domain}; ${discovery.purpose}`);
  report(project, `User and job: ${discovery.primaryUser}; ${discovery.job}`);
  if (discovery.intentConfidence < 0.65) {
    if (discovery.questions.length === 0) {
      throw new Error("Project discovery needs one short question before it can continue.");
    }
    update("A few mysteries remain...");
    const answers = await askQuestions(discovery.application.name, discovery.questions);
    if (!answers) {
      progress.fail("Application creation was cancelled.");
      report(project, "Application creation cancelled");
      return null;
    }
    update("Answers are clicking into place...");
    discovery = await discoverySession.answer(answers);
  }
  update("The blueprint is finding its groove...");
  report(project, `Application plan: ${discovery.application.name}; ${discovery.application.promise}`);
  report(project, `Initial journey: ${discovery.application.initialJourney.join(" -> ")}`);
  await assertCatalogCurrent(project, catalog);
  await Promise.all([saveCatalog(project, catalog), saveDiscovery(project, discovery)]);
  update("The interface is getting dressed...");
  report(project, "Designing entry point: /");
  const built = await buildInitialApplication({
    project,
    catalog,
    discovery,
    onActivity: (message) => report(project, message),
  });
  const home = built.registry.routes.find(({ id }) => id === built.registry.homeRouteId);
  report(project, `Entry point ready: ${home?.title ?? "Home"} at /`);
  report(project, `Deferred actions: ${built.registry.actions.map(({ label }) => label).join(", ") || "none"}`);
  await assertCatalogCurrent(project, catalog);
  await saveState(project, {
    version: 4,
    sourceFingerprint: catalog.fingerprint,
    builderThreadId: built.threadId,
    generatedAt: new Date().toISOString(),
  });
  update("The application is taking the stage...");
  return catalog;
}
