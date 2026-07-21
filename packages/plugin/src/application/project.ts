import { realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ProjectCatalog } from "../contracts.ts";
import { inspectProject } from "../data/catalog.ts";
import {
  assertSourceUnchanged,
  loadState,
  prepareProjectStore,
  SourceChangedError,
} from "../state/project-state.ts";

export async function resolveProject(projectInput: string): Promise<string> {
  const project = await realpath(resolve(projectInput)).catch(() => {
    throw new Error("The project folder could not be found.");
  });
  if (!(await stat(project)).isDirectory()) throw new Error("The project path must be a folder.");
  return project;
}

export async function loadCurrentProject(project: string) {
  await prepareProjectStore(project);
  const state = await loadState(project);
  if (!state) throw new Error("Create the application before changing it.");
  const catalog = await inspectProject(project);
  assertSourceUnchanged(state, catalog);
  return { catalog, state };
}

export async function assertCatalogCurrent(project: string, expected: ProjectCatalog): Promise<void> {
  if ((await inspectProject(project)).fingerprint !== expected.fingerprint) throw new SourceChangedError();
}
