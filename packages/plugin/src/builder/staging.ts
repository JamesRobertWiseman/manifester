import { randomUUID } from "node:crypto";
import { access, cp, mkdir, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertPathInside } from "../path.ts";
import { appRoot, jobsRoot } from "../state/project-state.ts";

const builderRules = `# Internal application builder

- Work only in this directory.
- Do not use skills, plugins, MCP tools, memory, browsers, or subagents.
- Do not call Manifester or start a server.
- Write the requested application files immediately.
- Keep the source compact. The host validates it after you finish.
- Run only quick local syntax checks, then stop.
`;

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

export async function createStagingApp(project: string, copyLive = true): Promise<string> {
  const job = join(jobsRoot(project), randomUUID());
  const staging = join(job, "app");
  const live = appRoot(project);
  await mkdir(job, { recursive: true });
  if (copyLive && await exists(live)) {
    const versions = await realpath(join(dirname(live), "apps"));
    const source = await realpath(live);
    assertPathInside(versions, source, "The saved application points outside its own folder.");
    await cp(source, staging, { recursive: true });
  } else await mkdir(staging, { recursive: true });
  await writeFile(join(staging, "AGENTS.md"), builderRules, "utf8");
  return staging;
}

export async function publishStagingApp(project: string, staging: string): Promise<void> {
  const live = appRoot(project);
  const store = dirname(live);
  const versions = join(store, "apps");
  const versionName = randomUUID();
  const version = join(versions, versionName);
  const pointer = join(store, `.app-${randomUUID()}.tmp`);
  const previous = await readlink(live).catch(() => null);
  await mkdir(versions, { recursive: true });
  await rename(staging, version);
  try {
    await symlink(join("apps", versionName), pointer, "dir");
    await rename(pointer, live);
  } catch (error) {
    await Promise.allSettled([
      rm(pointer, { force: true }),
      rm(version, { force: true, recursive: true }),
    ]);
    throw error;
  }
  const previousPath = previous ? resolve(store, previous) : null;
  const cleanPrevious = previousPath?.startsWith(`${versions}/`) ? previousPath : null;
  await Promise.allSettled([
    rm(dirname(staging), { force: true, recursive: true }),
    ...(cleanPrevious ? [rm(cleanPrevious, { force: true, recursive: true })] : []),
  ]);
}

export async function discardStagingApp(staging: string): Promise<void> {
  await rm(dirname(staging), { force: true, recursive: true });
}
