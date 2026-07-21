import type {
  MaterialiseRequest,
  MaterialiseResult,
} from "../contracts.ts";
import { inspectProject } from "../data/catalog.ts";
import type { RuntimeManager } from "./runtime-manager.ts";
import type { AskDiscoveryQuestions } from "./questions.ts";
import { createBuildProgressRuntime, type BuildProgress } from "../runtime/progress.ts";
import { loadAppRegistry } from "../runtime/registry.ts";
import { fillRoute } from "../runtime/routes.ts";
import {
  appRoot,
  assertSourceUnchanged,
  loadState,
  prepareProjectStore,
  resetProjectStore,
  SourceChangedError,
} from "../state/project-state.ts";
import type { ReportActivity } from "./activity.ts";
import { changeApplication } from "./change-application.ts";
import { createApplication } from "./create-application.ts";
import { materialiseAction } from "./materialise-action.ts";
import { materialiseRoute } from "./materialise-route.ts";
import { ProjectJobs } from "./project-jobs.ts";
import { loadCurrentProject, resolveProject } from "./project.ts";
import type { ApplicationSnapshot, CloseResult, RemoveResult } from "./results.ts";
import { RuntimePool } from "./runtime-pool.ts";

export class ApplicationService {
  readonly #progress = new Map<string, BuildProgress>();
  readonly #jobs = new ProjectJobs();
  readonly #runtime = new RuntimePool((project, request) => this.#materialise(project, request));

  readonly #manager: RuntimeManager | undefined;
  readonly #onActivity: ((project: string, message: string) => void) | undefined;
  readonly #askQuestions: AskDiscoveryQuestions | undefined;

  constructor(
    manager?: RuntimeManager,
    onActivity?: (project: string, message: string) => void,
    askQuestions?: AskDiscoveryQuestions,
  ) {
    this.#manager = manager;
    this.#onActivity = onActivity;
    this.#askQuestions = askQuestions;
  }

  async open(projectInput: string, port = 0): Promise<ApplicationSnapshot> {
    const project = await resolveProject(projectInput);
    const activeProgress = this.#progress.get(project);
    if (activeProgress && this.#jobs.has(project)) return this.#progressResult(activeProgress);
    return this.#jobs.run(project, async () => {
      await prepareProjectStore(project);
      const previousProgress = this.#progress.get(project);
      const selectedPort = port || previousProgress?.port || 0;
      if (previousProgress) {
        await previousProgress.server.close();
        this.#progress.delete(project);
      }
      const existing = await loadState(project);
      if (existing) {
        if (this.#manager) return this.#manager.start(project, selectedPort);
        const catalog = await inspectProject(project);
        assertSourceUnchanged(existing, catalog);
        const runtime = await this.#runtime.start(project, catalog, selectedPort);
        const registry = await loadAppRegistry(appRoot(project));
        return {
          status: "running" as const,
          running: true as const,
          application: registry.application,
          runtime,
          openInBrowser: runtime.address,
        };
      }
      const askQuestions = this.#askQuestions;
      if (!askQuestions) throw new Error("Create this application in Codex before starting it.");
      const progress = await createBuildProgressRuntime(selectedPort);
      try {
        await this.#manager?.registerGeneration(project, progress.port);
      } catch (error) {
        await progress.server.close();
        throw error;
      }
      this.#progress.set(project, progress);
      const creation = this.#create(project, progress, askQuestions);
      this.#jobs.track(project, creation);
      void creation.catch(() => undefined);
      return this.#progressResult(progress);
    });
  }

  async #create(project: string, progress: BuildProgress, askQuestions: AskDiscoveryQuestions): Promise<void> {
    try {
      const catalog = await createApplication({ project, progress, askQuestions, report: this.#notify });
      if (!catalog) return;
      await progress.server.close();
      if (this.#manager) await this.#manager.start(project, progress.port);
      else await this.#runtime.start(project, catalog, progress.port);
      if (this.#progress.get(project) === progress) this.#progress.delete(project);
      this.#notify(project, "Application ready");
    } catch (error) {
      if (this.#progress.get(project) === progress) {
        if (progress.server.server.listening) {
          progress.fail("This application could not be created.");
        } else {
          const failed = await createBuildProgressRuntime(progress.port).catch(() => null);
          if (failed) {
            failed.fail("This application could not be created.");
            this.#progress.set(project, failed);
          } else this.#progress.delete(project);
        }
      }
      this.#notify(project, `Application creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("Manifester application creation failed:", error);
      throw error;
    }
  }

  async change(projectInput: string, instruction: string): Promise<ApplicationSnapshot> {
    const project = await resolveProject(projectInput);
    return this.#jobs.run(project, async () => {
      const { catalog, registry } = await changeApplication(project, instruction, this.#notify);
      const runtime = await this.#runtime.start(project, catalog, 0);
      return {
        status: "running" as const,
        running: true as const,
        application: registry.application,
        runtime,
        openInBrowser: runtime.address,
      };
    }).catch((error) => {
      this.#notify(project, `Application update failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw error;
    });
  }

  async status(projectInput: string, verifySource = true): Promise<ApplicationSnapshot> {
    const project = await resolveProject(projectInput);
    const progress = this.#progress.get(project);
    if (this.#jobs.has(project)) {
      return {
        status: "generating" as const,
        running: true,
        ...(progress ? {
          address: progress.address,
          port: progress.port,
          stage: progress.snapshot().message,
        } : {}),
      };
    }
    if (progress?.snapshot().status === "failed") {
      return {
        status: "failed" as const,
        running: false,
        address: progress.address,
        message: progress.snapshot().message,
      };
    }
    if (this.#manager) return this.#manager.status(project);
    await prepareProjectStore(project);
    const state = await loadState(project);
    if (!state) return { status: "not_created" as const, running: false };
    if (verifySource) {
      try {
        const catalog = await inspectProject(project);
        assertSourceUnchanged(state, catalog);
      } catch (error) {
        if (error instanceof SourceChangedError) {
          await this.#closeNow(project);
          return { status: "blocked" as const, running: false, message: error.message };
        }
        throw error;
      }
    }
    const runtime = this.#runtime.details(project);
    const isRunning = Boolean(runtime);
    const registry = await loadAppRegistry(appRoot(project));
    return {
      status: isRunning ? "running" as const : "ready" as const,
      running: isRunning,
      application: registry.application,
      ...(runtime ? { address: runtime.address, port: runtime.port } : {}),
    };
  }

  async close(projectInput: string): Promise<ApplicationSnapshot | CloseResult> {
    const project = await resolveProject(projectInput);
    if (this.#manager) return this.#manager.stop(project);
    return this.#jobs.run(project, () => this.#closeNow(project));
  }

  async restart(projectInput: string, port = 0): Promise<ApplicationSnapshot> {
    const project = await resolveProject(projectInput);
    if (this.#manager) return this.#manager.restart(project, port);
    return this.#jobs.run(project, async () => {
      const selectedPort = port || this.#runtime.port(project);
      await this.#closeNow(project);
      const { catalog } = await loadCurrentProject(project);
      const runtime = await this.#runtime.start(project, catalog, selectedPort);
      const registry = await loadAppRegistry(appRoot(project));
      return {
        status: "running" as const,
        running: true as const,
        application: registry.application,
        runtime,
        openInBrowser: runtime.address,
      };
    });
  }

  async #closeNow(project: string): Promise<CloseResult> {
    const progress = this.#progress.get(project);
    const runtime = await this.#runtime.close(project);
    if (progress) await progress.server.close();
    this.#progress.delete(project);
    return { closed: Boolean(progress) || runtime.closed };
  }

  async reset(projectInput: string): Promise<RemoveResult> {
    const project = await resolveProject(projectInput);
    return this.#jobs.run(project, async () => {
      if (this.#manager) await this.#manager.forget(project);
      else await this.#closeNow(project);
      return { removed: await resetProjectStore(project) };
    });
  }

  async #materialise(project: string, request: MaterialiseRequest): Promise<MaterialiseResult> {
    try {
      const featureId = request.kind === "action" ? `action:${request.actionId}` : `route:${request.path}`;
      const path = await this.#jobs.feature(
        project,
        featureId,
        () => request.kind === "action"
          ? materialiseAction(project, request, this.#notify)
          : materialiseRoute(project, request, this.#notify),
      );
      return { path: request.kind === "action" ? fillRoute(path, request.context) : path };
    } catch (error) {
      this.#notify(project, `View generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw error;
    }
  }

  readonly #notify: ReportActivity = (project, message) => {
    try {
      this.#onActivity?.(project, message);
    } catch {
    }
  };

  #progressResult(progress: BuildProgress) {
    return {
      status: "generating" as const,
      running: true as const,
      runtime: { running: true, address: progress.address, port: progress.port },
      stage: progress.snapshot().message,
      openInBrowser: progress.address,
    };
  }
}
