import type { AppAction, AppRegistry, DiscoveryResult, ProjectCatalog } from "../contracts.ts";
import { inspectProject } from "../data/catalog.ts";
import { loadAppRegistry } from "../runtime/registry.ts";
import { validateGeneratedApp } from "../runtime/validate.ts";
import { SourceChangedError } from "../state/project-state.ts";
import { BuilderThread } from "./codex-thread.ts";
import {
  changePrompt,
  changeReviewPrompt,
  initialBuildPrompt,
  initialReviewPrompt,
  materialisePrompt,
  materialiseReviewPrompt,
  materialiseRoutePrompt,
  materialiseRouteReviewPrompt,
} from "./instructions.ts";
import {
  assertInitialRegistry,
  assertMaterialisedRegistry,
  assertMaterialisedRouteRegistry,
} from "./registry-rules.ts";
import { assertRouteSourcesUnchanged, readRouteSources } from "./route-sources.ts";
import { createStagingApp, discardStagingApp, publishStagingApp } from "./staging.ts";

interface StagingBuildOptions {
  project: string;
  catalog: ProjectCatalog;
  prompt(): string;
  validateRegistry?(registry: AppRegistry, previous?: AppRegistry): void;
  copyLive?: boolean;
  preserveExistingRoutes?: boolean;
  reviewPrompt?(validationIssue?: string): string;
  reviewLabel?: string;
  onActivity?(message: string): void;
}

interface BuildResult {
  registry: AppRegistry;
  threadId: string;
}

async function buildInStaging(options: StagingBuildOptions): Promise<BuildResult> {
  const staging = await createStagingApp(options.project, options.copyLive);
  const previousRegistry = await loadAppRegistry(staging).catch(() => undefined);
  const previousSources = options.preserveExistingRoutes && previousRegistry
    ? await readRouteSources(staging, previousRegistry)
    : undefined;
  const thread = new BuilderThread(staging);
  try {
    await thread.run(options.prompt());
    const validate = async () => {
      const registry = await validateGeneratedApp(
        staging,
        new Set(options.catalog.resources.map(({ id }) => id)),
        new Map(options.catalog.resources.map((resource) => [
          resource.id,
          new Set(resource.fields.map(({ id }) => id)),
        ])),
      );
      options.validateRegistry?.(registry, previousRegistry);
      if (previousRegistry && previousSources) {
        await assertRouteSourcesUnchanged(staging, previousRegistry, previousSources);
      }
      return registry;
    };
    if (options.reviewPrompt) {
      let validationIssue: string | undefined;
      try {
        await validate();
      } catch (error) {
        validationIssue = error instanceof Error ? error.message : String(error);
        options.onActivity?.(`Review found a problem: ${validationIssue}`);
      }
      if (validationIssue) {
        options.onActivity?.("Repairing generated application");
        await thread.run(options.reviewPrompt(validationIssue));
        await validate();
      } else {
        options.onActivity?.(options.reviewLabel ?? "Reviewing generated view");
        await thread.run(options.reviewPrompt());
      }
    }
    const registry = await validate();
    const threadId = thread.id();
    if ((await inspectProject(options.project)).fingerprint !== options.catalog.fingerprint) {
      throw new SourceChangedError();
    }
    await publishStagingApp(options.project, staging);
    return { registry, threadId };
  } catch (error) {
    await discardStagingApp(staging);
    throw error;
  }
}

export function buildInitialApplication(options: {
  project: string;
  catalog: ProjectCatalog;
  discovery: DiscoveryResult;
  onActivity?: (message: string) => void;
}): Promise<BuildResult> {
  return buildInStaging({
    project: options.project,
    catalog: options.catalog,
    prompt: () => initialBuildPrompt(options.catalog, options.discovery),
    copyLive: false,
    reviewPrompt: initialReviewPrompt,
    reviewLabel: "Reviewing generated application",
    ...(options.onActivity ? { onActivity: options.onActivity } : {}),
    validateRegistry: assertInitialRegistry,
  });
}

export function materialiseApplicationAction(options: {
  project: string;
  catalog: ProjectCatalog;
  discovery: DiscoveryResult;
  action: AppAction;
  path: string;
  context: Record<string, string | number | boolean | null>;
  onActivity?: (message: string) => void;
}): Promise<BuildResult> {
  return buildInStaging({
    project: options.project,
    catalog: options.catalog,
    prompt: () => materialisePrompt(options),
    preserveExistingRoutes: true,
    reviewPrompt: (validationIssue) => materialiseReviewPrompt({
      action: options.action,
      path: options.path,
      ...(validationIssue ? { validationIssue } : {}),
    }),
    reviewLabel: `Reviewing view requested from ${options.path}`,
    ...(options.onActivity ? { onActivity: options.onActivity } : {}),
    validateRegistry: (registry, previous) => assertMaterialisedRegistry(registry, previous, options.action),
  });
}

export function materialiseApplicationRoute(options: {
  project: string;
  catalog: ProjectCatalog;
  discovery: DiscoveryResult;
  path: string;
  onActivity?: (message: string) => void;
}): Promise<BuildResult> {
  return buildInStaging({
    project: options.project,
    catalog: options.catalog,
    prompt: () => materialiseRoutePrompt(options),
    reviewPrompt: (validationIssue) => materialiseRouteReviewPrompt({
      path: options.path,
      ...(validationIssue ? { validationIssue } : {}),
    }),
    reviewLabel: `Reviewing view requested at ${options.path}`,
    ...(options.onActivity ? { onActivity: options.onActivity } : {}),
    validateRegistry: (registry, previous) => assertMaterialisedRouteRegistry(registry, previous, options.path),
  });
}

export function changeGeneratedApplication(options: {
  project: string;
  catalog: ProjectCatalog;
  discovery: DiscoveryResult;
  instruction: string;
  onActivity?: (message: string) => void;
}): Promise<BuildResult> {
  return buildInStaging({
    project: options.project,
    catalog: options.catalog,
    prompt: () => changePrompt(options),
    reviewPrompt: (validationIssue) => changeReviewPrompt({
      instruction: options.instruction,
      ...(validationIssue ? { validationIssue } : {}),
    }),
    reviewLabel: "Reviewing application update",
    ...(options.onActivity ? { onActivity: options.onActivity } : {}),
  });
}
