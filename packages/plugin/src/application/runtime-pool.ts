import type { MaterialiseRequest, MaterialiseResult, ProjectCatalog } from "../contracts.ts";
import { LocalDataStore } from "../data/local-data-store.ts";
import { createGeneratedRuntime } from "../runtime/server.ts";
import { appRoot } from "../state/project-state.ts";
import type { CloseResult, RuntimeDetails } from "./results.ts";

interface RunningApplication {
  server: Awaited<ReturnType<typeof createGeneratedRuntime>>["server"];
  data: LocalDataStore;
  address: string;
  port: number;
}

type Materialise = (project: string, request: MaterialiseRequest) => Promise<MaterialiseResult>;

export class RuntimePool {
  readonly #applications = new Map<string, RunningApplication>();
  readonly #materialise: Materialise;

  constructor(materialise: Materialise) {
    this.#materialise = materialise;
  }

  details(project: string): RuntimeDetails | null {
    const runtime = this.#applications.get(project);
    return runtime?.server.server.listening
      ? { running: true, address: runtime.address, port: runtime.port }
      : null;
  }

  port(project: string): number {
    return this.#applications.get(project)?.port ?? 0;
  }

  async start(project: string, catalog: ProjectCatalog, port: number): Promise<RuntimeDetails & { running: true; address: string; port: number }> {
    const existing = this.#applications.get(project);
    if (existing) {
      return { running: true, address: existing.address, port: existing.port, alreadyRunning: true };
    }
    const data = new LocalDataStore(project);
    try {
      await data.initialize(catalog);
      const runtime = await createGeneratedRuntime({
        project,
        appRoot: appRoot(project),
        data: data.api(),
        materialise: (request) => this.#materialise(project, request),
        port,
        allowedResourceIds: catalog.resources.map(({ id }) => id),
        fieldsByResource: new Map(catalog.resources.map((resource) => [
          resource.id,
          new Set(resource.fields.map(({ id }) => id)),
        ])),
      });
      this.#applications.set(project, { ...runtime, data });
      return { running: true, address: runtime.address, port: runtime.port, alreadyRunning: false };
    } catch (error) {
      data.close();
      throw error;
    }
  }

  async close(project: string): Promise<CloseResult> {
    const runtime = this.#applications.get(project);
    if (!runtime) return { closed: false };
    await runtime.server.close();
    runtime.data.close();
    this.#applications.delete(project);
    return { closed: true };
  }
}
