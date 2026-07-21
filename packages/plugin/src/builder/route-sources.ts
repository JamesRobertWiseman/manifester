import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppRegistry } from "../contracts.ts";

export async function readRouteSources(root: string, registry: AppRegistry): Promise<Map<string, string | null>> {
  const sources = new Map<string, string | null>();
  for (const route of registry.routes) {
    for (const file of ["page.html", "page.css", "page.js", "api.mjs"]) {
      const source = await readFile(join(root, route.folder, file), "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      sources.set(`${route.id}\0${file}`, source);
    }
  }
  return sources;
}

export async function assertRouteSourcesUnchanged(
  root: string,
  registry: AppRegistry,
  expected: ReadonlyMap<string, string | null>,
): Promise<void> {
  const current = await readRouteSources(root, registry);
  if (current.size !== expected.size || [...expected].some(([file, source]) => current.get(file) !== source)) {
    throw new Error("The generated view changed an existing part of the application.");
  }
}
