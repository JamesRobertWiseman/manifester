import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJson, writeJson } from "@manifester/plugin";
import type { DesiredStatus, ManagedProject } from "./contracts.ts";

interface RegistryFile {
  version: 1;
  projects: ManagedProject[];
}

interface UpdateProjectOptions {
  status: DesiredStatus;
  port: number;
  codexThreadId?: string | null;
  startedAt?: string | null;
  generationPort?: number | null;
}

const registryPath = join(homedir(), ".manifester", "manager.json");

function validProject(value: unknown): value is ManagedProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<ManagedProject>;
  return typeof project.id === "string"
    && typeof project.project === "string"
    && (project.codexThreadId === undefined || typeof project.codexThreadId === "string" && project.codexThreadId.length > 0)
    && (project.desiredStatus === "running" || project.desiredStatus === "stopped")
    && typeof project.port === "number"
    && (project.generationPort === undefined || Number.isInteger(project.generationPort) && project.generationPort > 0)
    && typeof project.registeredAt === "string"
    && (project.startedAt === undefined || typeof project.startedAt === "string");
}

export function projectId(project: string): string {
  return createHash("sha256").update(project).digest("hex").slice(0, 16);
}

export class ManagerRegistry {
  #pending = Promise.resolve();

  async list(): Promise<ManagedProject[]> {
    await this.#pending;
    return this.#read();
  }

  async #read(): Promise<ManagedProject[]> {
    const raw = await readJson(registryPath).catch(() => null);
    if (!raw || typeof raw !== "object") return [];
    const registry = raw as Partial<RegistryFile>;
    return registry.version === 1 && Array.isArray(registry.projects)
      ? registry.projects.filter(validProject)
      : [];
  }

  async get(id: string): Promise<ManagedProject | undefined> {
    return (await this.list()).find((project) => project.id === id);
  }

  async find(project: string): Promise<ManagedProject | undefined> {
    return (await this.list()).find((entry) => entry.project === project);
  }

  async upsert(project: string, options: UpdateProjectOptions): Promise<ManagedProject> {
    return this.#enqueue(async () => {
      const projects = await this.#read();
      const existing = projects.find((entry) => entry.project === project);
      const codexThreadId = options.codexThreadId === undefined
        ? existing?.codexThreadId
        : options.codexThreadId ?? undefined;
      const startedAt = options.startedAt === undefined ? existing?.startedAt : options.startedAt ?? undefined;
      const generationPort = options.generationPort === undefined
        ? existing?.generationPort
        : options.generationPort ?? undefined;
      const next: ManagedProject = {
        id: existing?.id ?? projectId(project),
        project,
        ...(codexThreadId ? { codexThreadId } : {}),
        desiredStatus: options.status,
        port: options.port,
        registeredAt: existing?.registeredAt ?? new Date().toISOString(),
        ...(startedAt ? { startedAt } : {}),
        ...(generationPort ? { generationPort } : {}),
      };
      await this.#save(existing
        ? projects.map((entry) => entry.project === project ? next : entry)
        : [...projects, next]);
      return next;
    });
  }

  async remove(project: string): Promise<boolean> {
    return this.#enqueue(async () => {
      const projects = await this.#read();
      const next = projects.filter((entry) => entry.project !== project);
      if (next.length === projects.length) return false;
      await this.#save(next);
      return true;
    });
  }

  async #save(projects: ManagedProject[]): Promise<void> {
    await writeJson(registryPath, { version: 1, projects } satisfies RegistryFile);
  }

  #enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = this.#pending.then(action);
    this.#pending = result.then(() => undefined, () => undefined);
    return result;
  }
}
