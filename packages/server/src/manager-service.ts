import { ApplicationService, appRoot, loadAppRegistry, loadState, resolveProject } from "@manifester/plugin";
import type { ApplicationSnapshot } from "@manifester/plugin";
import type { ManagedApplication, ManagedProject, ManagerActivity } from "./contracts.ts";
import { ManagerActivityStore } from "./activity-store.ts";
import { ManagerConflictError, ManagerNotFoundError, ManagerRequestError } from "./errors.ts";
import { ManagerRegistry, projectId } from "./registry.ts";

async function canonicalProject(project: string): Promise<string> {
  return resolveProject(project).catch((error: unknown) => {
    if (error instanceof Error && error.message === "The project path must be a folder.") {
      throw new ManagerRequestError(error.message);
    }
    throw new ManagerNotFoundError(error instanceof Error ? error.message : "The project folder could not be found.");
  });
}

function runtimePort(result: ApplicationSnapshot, fallback: number): number {
  return result.runtime?.port ?? result.port ?? fallback;
}

interface GenerationProgress {
  status: "generating" | "failed";
  message: string;
}

function isGenerationProgress(value: unknown): value is GenerationProgress {
  if (!value || typeof value !== "object") return false;
  const progress = value as Partial<GenerationProgress>;
  return (progress.status === "generating" || progress.status === "failed")
    && typeof progress.message === "string";
}

function codexTaskUrl(threadId: string): string {
  return `codex://threads/${encodeURIComponent(threadId)}`;
}

function publicationTaskUrl(project: string): string {
  const url = new URL("codex://new");
  url.searchParams.set("path", project);
  url.searchParams.set(
    "prompt",
    "Use the manifester:publish-application skill to publish the fully generated application in this project to ChatGPT Sites. Publish only the Sites project built under .manifester/site, never the full .manifester directory.",
  );
  return url.toString();
}

export class ManagerService {
  readonly #applications: ApplicationService;
  readonly #registry = new ManagerRegistry();
  readonly #activity = new ManagerActivityStore();
  readonly #generationReservations = new Set<string>();

  constructor() {
    this.#applications = new ApplicationService(undefined, (project, message) => {
      this.#record(projectId(project), message);
    });
  }

  async restore(): Promise<void> {
    for (const project of await this.#registry.list()) {
      if (project.desiredStatus !== "running") continue;
      try {
        const result: ApplicationSnapshot = await this.#applications.open(project.project, project.port);
        await this.#registry.upsert(project.project, {
          status: "running",
          port: runtimePort(result, project.port),
          startedAt: new Date().toISOString(),
          generationPort: null,
        });
        this.#record(project.id, "Server restored");
      } catch (error) {
        this.#record(project.id, error instanceof Error ? error.message : "Server could not be restored");
      }
    }
  }

  async list(): Promise<ManagedApplication[]> {
    const projects = (await this.#registry.list()).toSorted((left, right) => left.registeredAt.localeCompare(right.registeredAt));
    return Promise.all(projects.map((project) => this.#snapshot(project, false)));
  }

  activity(projectId?: string): Promise<ManagerActivity[]> {
    return this.#activity.list(projectId);
  }

  async recordActivity(projectInput: string, message: string): Promise<{ recorded: true }> {
    const project = await canonicalProject(projectInput);
    await this.#activity.record(projectId(project), message);
    return { recorded: true };
  }

  async registerGeneration(projectInput: string, port: number, codexThreadId?: string): Promise<{ registered: true }> {
    const project = await canonicalProject(projectInput);
    if (this.#generationReservations.has(project)) throw new ManagerConflictError("This application is already being created.");
    this.#generationReservations.add(project);
    try {
      const existing = await this.#registry.find(project);
      if (existing?.generationPort && (await this.#generationSnapshot(existing.generationPort)).status === "generating") {
        throw new ManagerConflictError("This application is already being created.");
      }
      await this.#registry.upsert(project, {
        status: "stopped",
        port,
        ...(codexThreadId ? { codexThreadId } : {}),
        startedAt: null,
        generationPort: port,
      });
      return { registered: true };
    } finally {
      this.#generationReservations.delete(project);
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all((await this.#registry.list()).map(({ project }) => this.#applications.close(project)));
  }

  async start(projectInput: string, port = 0, codexThreadId?: string): Promise<ManagedApplication> {
    const project = await canonicalProject(projectInput);
    const result: ApplicationSnapshot = await this.#applications.open(project, port);
    return this.#registerRunning(project, result, port, codexThreadId);
  }

  async change(projectInput: string, instruction: string, codexThreadId?: string): Promise<ManagedApplication> {
    const project = await canonicalProject(projectInput);
    const result: ApplicationSnapshot = await this.#applications.change(project, instruction);
    return this.#registerRunning(project, result, 0, codexThreadId);
  }

  async #registerRunning(
    project: string,
    result: ApplicationSnapshot,
    fallbackPort: number,
    codexThreadId?: string,
  ): Promise<ManagedApplication> {
    const existing = await this.#registry.find(project);
    const entry = await this.#registry.upsert(project, {
      status: "running",
      port: runtimePort(result, fallbackPort),
      ...(codexThreadId ? { codexThreadId } : {}),
      startedAt: result.runtime?.alreadyRunning ? existing?.startedAt ?? new Date().toISOString() : new Date().toISOString(),
      generationPort: null,
    });
    this.#record(entry.id, "Server started");
    return this.#snapshot(entry, false);
  }

  async stop(projectInput: string): Promise<ManagedApplication> {
    const project = await canonicalProject(projectInput);
    const existing = await this.#registry.find(project);
    await this.#applications.close(project);
    const entry = await this.#registry.upsert(project, {
      status: "stopped",
      port: existing?.port ?? 0,
      startedAt: null,
    });
    this.#record(entry.id, "Server stopped");
    return this.#snapshot(entry, false);
  }

  async restart(projectInput: string, port = 0, codexThreadId?: string): Promise<ManagedApplication> {
    const project = await canonicalProject(projectInput);
    const existing = await this.#registry.find(project);
    const result: ApplicationSnapshot = await this.#applications.restart(project, port || existing?.port || 0);
    const entry = await this.#registry.upsert(project, {
      status: "running",
      port: runtimePort(result, port || existing?.port || 0),
      ...(codexThreadId ? { codexThreadId } : {}),
      startedAt: new Date().toISOString(),
      generationPort: null,
    });
    this.#record(entry.id, "Server restarted");
    return this.#snapshot(entry, false);
  }

  async status(projectInput: string): Promise<ManagedApplication> {
    const project = await canonicalProject(projectInput);
    const existing = await this.#registry.find(project);
    if (existing) return this.#snapshot(existing, true);
    const snapshot: ApplicationSnapshot = await this.#applications.status(project, true);
    const entry: ManagedProject = {
      id: projectId(project),
      project,
      desiredStatus: "stopped",
      port: snapshot.port ?? 0,
      registeredAt: new Date().toISOString(),
    };
    return this.#withDetails(entry, this.#format(entry, snapshot));
  }

  async forget(projectInput: string): Promise<{ removed: boolean }> {
    const project = await canonicalProject(projectInput);
    await this.#applications.close(project);
    const removed = await this.#registry.remove(project);
    if (removed) this.#record(projectId(project), "Application removed from manager");
    return { removed };
  }

  async removeById(id: string): Promise<{ removed: boolean; dataKept: true }> {
    const project = await this.#requireIdle(id);
    await this.#applications.close(project.project);
    const removed = await this.#registry.remove(project.project);
    this.#record(id, "Application removed from manager; local app and data kept");
    return { removed, dataKept: true };
  }

  async deleteById(id: string): Promise<{ deleted: boolean }> {
    const project = await this.#requireIdle(id);
    const { removed } = await this.#applications.reset(project.project);
    await this.#registry.remove(project.project);
    await this.#activity.clear(id);
    return { deleted: removed };
  }

  async byId(id: string): Promise<ManagedApplication> {
    return this.#snapshot(await this.#require(id), false);
  }

  async startById(id: string): Promise<ManagedApplication> {
    const project = await this.#require(id);
    return this.start(project.project, project.port);
  }

  async stopById(id: string): Promise<ManagedApplication> {
    return this.stop((await this.#require(id)).project);
  }

  async restartById(id: string): Promise<ManagedApplication> {
    const project = await this.#require(id);
    return this.restart(project.project, project.port);
  }

  async #require(id: string): Promise<ManagedProject> {
    const project = await this.#registry.get(id);
    if (!project) throw new ManagerNotFoundError("This application is not registered with Manifester.");
    return project;
  }

  async #requireIdle(id: string): Promise<ManagedProject> {
    const project = await this.#require(id);
    if ((await this.#snapshot(project, false)).status === "generating") {
      throw new ManagerConflictError("Wait for application creation to finish before removing or deleting it.");
    }
    return project;
  }

  async #snapshot(project: ManagedProject, verifySource: boolean): Promise<ManagedApplication> {
    try {
      const snapshot = project.generationPort
        ? await this.#generationSnapshot(project.generationPort)
        : await this.#applications.status(project.project, verifySource);
      return this.#withDetails(project, this.#format(project, snapshot));
    } catch (error) {
      return this.#withDetails(project, this.#format(project, {
        status: "failed",
        running: false,
        message: error instanceof Error ? error.message : "Status could not be checked.",
      }));
    }
  }

  async #generationSnapshot(port: number): Promise<ApplicationSnapshot> {
    const address = `http://127.0.0.1:${port}`;
    try {
      const response = await fetch(`${address}/__manifester/progress`, {
        cache: "no-store",
        signal: AbortSignal.timeout(750),
      });
      const progress: unknown = await response.json();
      if (!response.ok || !isGenerationProgress(progress)) throw new Error();
      return progress.status === "generating"
        ? { status: "generating", running: true, address, port, stage: progress.message }
        : { status: "failed", running: false, address, port, message: progress.message };
    } catch {
      return {
        status: "failed",
        running: false,
        address,
        port,
        message: "Application generation stopped before completion.",
      };
    }
  }

  async #withDetails(project: ManagedProject, application: ManagedApplication): Promise<ManagedApplication> {
    const state = await loadState(project.project).catch(() => null);
    const threadId = state?.builderThreadId ?? project.codexThreadId;
    const codexTask = threadId ? { codexTaskUrl: codexTaskUrl(threadId) } : {};
    if (!state) return { ...application, ...codexTask };
    const registry = await loadAppRegistry(appRoot(project.project)).catch(() => null);
    const unresolvedActions = registry?.actions.filter(({ targetPath }) => !targetPath).map(({ label }) => label) ?? [];
    return {
      ...application,
      ...codexTask,
      publication: {
        ready: Boolean(registry) && unresolvedActions.length === 0,
        taskUrl: publicationTaskUrl(project.project),
        unresolvedActions,
      },
    };
  }

  #format(project: ManagedProject, snapshot: ApplicationSnapshot): ManagedApplication {
    const { running } = snapshot;
    const startedAt = running ? project.startedAt : undefined;
    return {
      ...project,
      ...(startedAt ? { startedAt, uptimeMs: Math.max(0, Date.now() - Date.parse(startedAt)) } : {}),
      status: snapshot.status,
      running,
      ...(snapshot.application ? { application: snapshot.application } : {}),
      ...(snapshot.address ? { address: snapshot.address } : {}),
      ...(snapshot.port ? { port: snapshot.port } : {}),
      ...(snapshot.stage ? { stage: snapshot.stage } : {}),
      ...(snapshot.message ? { message: snapshot.message } : {}),
    };
  }

  #record(projectId: string | undefined, message: string): void {
    void this.#activity.record(projectId, message).catch(() => undefined);
  }
}
