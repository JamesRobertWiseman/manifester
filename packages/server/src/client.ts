import type { ApplicationSnapshot, RemoveResult, RuntimeManager } from "@manifester/plugin";
import { MANAGER_ADDRESS } from "./contracts.ts";
import { startManagerProcess } from "./lifecycle.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const CHANGE_TIMEOUT_MS = 4 * 60 * 1_000;

export class ManagerClient implements RuntimeManager {
  readonly #ensureManager: () => Promise<unknown>;
  readonly #codexThreadId: string | undefined;
  #activity = Promise.resolve();

  constructor(
    ensureManager: () => Promise<unknown> = () => startManagerProcess(),
    codexThreadId = process.env["CODEX_THREAD_ID"],
  ) {
    this.#ensureManager = ensureManager;
    this.#codexThreadId = codexThreadId?.trim() || undefined;
  }

  async registerGeneration(project: string, port: number): Promise<void> {
    await this.#post("/api/projects/generation", this.#context({ project, port }));
  }

  async start(project: string, port = 0): Promise<ApplicationSnapshot> {
    return this.#withBrowser(await this.#snapshot("/api/projects/start", this.#context({ project, port })));
  }

  stop(project: string): Promise<ApplicationSnapshot> {
    return this.#snapshot("/api/projects/stop", { project });
  }

  async restart(project: string, port = 0): Promise<ApplicationSnapshot> {
    return this.#withBrowser(await this.#snapshot("/api/projects/restart", this.#context({ project, port })));
  }

  async change(project: string, instruction: string): Promise<ApplicationSnapshot> {
    return this.#withBrowser(await this.#snapshot(
      "/api/projects/change",
      this.#context({ project, instruction }),
      CHANGE_TIMEOUT_MS,
    ));
  }

  status(project: string): Promise<ApplicationSnapshot> {
    return this.#snapshot("/api/projects/status", { project });
  }

  async forget(project: string): Promise<RemoveResult> {
    const result = await this.#post("/api/projects/forget", { project });
    if (!result || typeof result !== "object" || !("removed" in result) || typeof result.removed !== "boolean") {
      throw new Error("The Manifester manager returned an invalid response.");
    }
    return { removed: result.removed };
  }

  recordActivity(project: string, message: string): Promise<void> {
    const next = this.#activity.catch(() => undefined).then(async () => {
      await this.#post("/api/projects/activity", { project, message });
    });
    this.#activity = next.catch(() => undefined);
    return next;
  }

  async dashboard(): Promise<{ status: "running"; address: string; openInBrowser: string }> {
    await this.#ensureManager();
    return { status: "running", address: MANAGER_ADDRESS, openInBrowser: MANAGER_ADDRESS };
  }

  async #post(path: string, body: Record<string, unknown>, timeout = REQUEST_TIMEOUT_MS): Promise<unknown> {
    await this.#ensureManager();
    const response = await fetch(`${MANAGER_ADDRESS}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const message = result && typeof result === "object" && "message" in result && typeof result.message === "string"
        ? result.message
        : "The Manifester manager could not complete this action.";
      throw new Error(message);
    }
    return result;
  }

  #context(body: Record<string, unknown>): Record<string, unknown> {
    return { ...body, ...(this.#codexThreadId ? { codexThreadId: this.#codexThreadId } : {}) };
  }

  async #snapshot(path: string, body: Record<string, unknown>, timeout?: number): Promise<ApplicationSnapshot> {
    const result = await this.#post(path, body, timeout);
    if (!isApplicationSnapshot(result)) throw new Error("The Manifester manager returned an invalid response.");
    return result;
  }

  #withBrowser(result: ApplicationSnapshot): ApplicationSnapshot {
    return result.address ? { ...result, openInBrowser: result.address } : result;
  }
}

const applicationStatuses = new Set<ApplicationSnapshot["status"]>([
  "running",
  "ready",
  "generating",
  "blocked",
  "not_created",
  "failed",
]);

function isApplicationSnapshot(value: unknown): value is ApplicationSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ApplicationSnapshot>;
  return typeof snapshot.status === "string"
    && applicationStatuses.has(snapshot.status)
    && typeof snapshot.running === "boolean";
}
