import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { MANAGER_ADDRESS, MANAGER_SERVICE } from "./contracts.ts";

const managerRoot = join(homedir(), ".manifester");
const ownersRoot = join(managerRoot, "codex-owners");

interface ManagerHealth {
  service: string;
  status: "running";
  address: string;
  ownership: "codex" | "standalone";
}

function isManagerHealth(value: unknown): value is ManagerHealth {
  if (!value || typeof value !== "object") return false;
  const health = value as Partial<ManagerHealth>;
  return health.service === MANAGER_SERVICE
    && health.status === "running"
    && health.address === MANAGER_ADDRESS
    && (health.ownership === "codex" || health.ownership === "standalone");
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

export async function liveCodexOwners(): Promise<number[]> {
  await mkdir(ownersRoot, { recursive: true });
  const entries = await readdir(ownersRoot, { withFileTypes: true });
  const owners: number[] = [];
  await Promise.all(entries.map(async (entry) => {
    const match = entry.isFile() ? /^(\d+)\.json$/.exec(entry.name) : null;
    if (!match) return;
    const pid = Number(match.at(1));
    if (processIsRunning(pid)) owners.push(pid);
    else await rm(join(ownersRoot, entry.name), { force: true });
  }));
  return owners;
}

export async function managerHealth(): Promise<ManagerHealth | null> {
  try {
    const response = await fetch(`${MANAGER_ADDRESS}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(750),
    });
    const health: unknown = await response.json();
    return response.ok && isManagerHealth(health) ? health : null;
  } catch {
    return null;
  }
}

async function waitForManager(running: boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (Boolean(await managerHealth()) === running) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The Manifester manager could not be ${running ? "started" : "stopped"}.`);
}

export async function stopManagerProcess(codexOwnedOnly = false): Promise<boolean> {
  const health = await managerHealth();
  if (!health || (codexOwnedOnly && health.ownership !== "codex")) return false;
  await fetch(`${MANAGER_ADDRESS}/api/manager/shutdown`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined);
  await waitForManager(false);
  return true;
}

export async function startManagerProcess(codexOwned = false): Promise<ManagerHealth> {
  const health = await managerHealth();
  if (health && (!codexOwned || health.ownership === "codex")) return health;
  if (health) await stopManagerProcess();

  mkdirSync(managerRoot, { recursive: true });
  const log = openSync(join(managerRoot, "manager.log"), "a", 0o600);
  const child = spawn(process.execPath, [
    resolve(import.meta.dirname, "../server/server.mjs"),
    ...(codexOwned ? ["--codex-owned"] : []),
  ], {
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  closeSync(log);
  await waitForManager(true);
  const started = await managerHealth();
  if (!started) throw new Error("The Manifester manager could not be started.");
  return started;
}

export class CodexManagerLifecycle {
  readonly #ownerFile = join(ownersRoot, `${process.pid}.json`);
  #registered = false;

  async start(): Promise<void> {
    if (!this.#registered) {
      mkdirSync(ownersRoot, { recursive: true });
      writeFileSync(this.#ownerFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { mode: 0o600 });
      this.#registered = true;
    }
    await startManagerProcess(true);
  }

  async close(): Promise<void> {
    if (!this.#registered) return;
    this.closeSync();
    if ((await liveCodexOwners()).length === 0) await stopManagerProcess(true);
  }

  closeSync(): void {
    if (!this.#registered) return;
    rmSync(this.#ownerFile, { force: true });
    this.#registered = false;
  }
}
