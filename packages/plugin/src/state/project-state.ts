import { access, lstat, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod/v4";
import type { DiscoveryResult, ManifesterState, ProjectCatalog } from "../contracts.ts";
import { discoveryResultSchema } from "../discovery/schema.ts";
import { readJson, writeJson } from "./files.ts";

const stateSchema = z.object({
  version: z.literal(4),
  sourceFingerprint: z.string().min(1),
  builderThreadId: z.string().min(1),
  generatedAt: z.string().min(1),
}).strict();

function generatedRoot(project: string): string {
  return join(resolve(project), ".manifester");
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

export class SourceChangedError extends Error {
  constructor() {
    super("The project files changed after this application was created. Rebuild or reset it before continuing so local edits are not lost.");
  }
}

class CorruptStateError extends Error {
  constructor() {
    super("The saved Manifester application cannot be read. Its local data was kept. Reset it only if you want to remove those local changes.");
  }
}

export async function prepareProjectStore(project: string): Promise<string> {
  const root = generatedRoot(project);
  const statePath = join(root, "state.json");
  if (await exists(root)) {
    if ((await lstat(root)).isSymbolicLink()) {
      throw new Error("The saved Manifester folder must be inside the project.");
    }
    const hasState = await exists(statePath);
    const raw = hasState ? await readJson(statePath).catch(() => undefined) : null;
    if (hasState && !stateSchema.safeParse(raw).success) throw new CorruptStateError();
    if (!hasState && await exists(join(root, "data.sqlite"))) {
      throw new CorruptStateError();
    }
  }
  await mkdir(join(root, "jobs"), { recursive: true });
  await mkdir(join(root, "apps"), { recursive: true });
  return root;
}

export async function loadState(project: string): Promise<ManifesterState | null> {
  const path = join(generatedRoot(project), "state.json");
  if (!(await exists(path))) return null;
  const parsed = stateSchema.safeParse(await readJson(path).catch(() => null));
  if (!parsed.success) throw new CorruptStateError();
  return parsed.data as ManifesterState;
}

export function assertSourceUnchanged(state: ManifesterState, catalog: ProjectCatalog): void {
  if (state.sourceFingerprint !== catalog.fingerprint) throw new SourceChangedError();
}

export async function saveState(project: string, state: ManifesterState): Promise<void> {
  await writeJson(join(generatedRoot(project), "state.json"), stateSchema.parse(state));
}

export async function saveCatalog(project: string, catalog: ProjectCatalog): Promise<void> {
  await writeJson(join(generatedRoot(project), "catalog.json"), catalog);
}

export async function saveDiscovery(project: string, discovery: DiscoveryResult): Promise<void> {
  await writeJson(join(generatedRoot(project), "discovery.json"), discovery);
}

export async function loadDiscovery(project: string, catalog: ProjectCatalog): Promise<DiscoveryResult> {
  const result = discoveryResultSchema(catalog, true).safeParse(
    await readJson(join(generatedRoot(project), "discovery.json")).catch(() => null),
  );
  if (!result.success) throw new CorruptStateError();
  return result.data as DiscoveryResult;
}

export async function resetProjectStore(project: string): Promise<boolean> {
  const root = generatedRoot(project);
  if (!(await exists(root))) return false;
  await rm(root, { force: true, recursive: true });
  return true;
}

export function appRoot(project: string): string {
  return join(generatedRoot(project), "app");
}

export function jobsRoot(project: string): string {
  return join(generatedRoot(project), "jobs");
}
