import type { Thread, ThreadOptions } from "@openai/codex-sdk";
import { createCodexClient } from "../codex-client.ts";

const BUILD_TIMEOUT_MS = 3 * 60 * 1_000;
const RETRY_DELAYS_MS = [1_000, 3_000];

function options(workingDirectory: string): ThreadOptions {
  return {
    workingDirectory,
    skipGitRepoCheck: true,
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
    model: process.env["MANIFESTER_BUILD_MODEL"] ?? "gpt-5.6-terra",
    modelReasoningEffort: "medium",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAborted(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted && (
    error === signal.reason
    || error instanceof Error && (
      error.name === "AbortError"
      || "code" in error && error.code === "ABORT_ERR"
      || /Codex Exec exited with signal SIG(?:TERM|KILL)/i.test(error.message)
    )
  );
}

function isTransient(error: unknown): boolean {
  return error instanceof Error && (
    /stream disconnected before completion/i.test(error.message)
    || /error sending request for url/i.test(error.message)
    || /connection (?:closed|refused|reset)/i.test(error.message)
    || /failed to lookup address information/i.test(error.message)
    || /\b(?:502|503|504)\b/.test(error.message)
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class BuilderThread {
  readonly #client = createCodexClient();
  readonly #options: ThreadOptions;
  readonly #report: ((message: string) => void) | undefined;
  #thread: Thread;

  constructor(workingDirectory: string, report?: (message: string) => void) {
    this.#options = options(workingDirectory);
    this.#report = report;
    this.#thread = this.#client.startThread(this.#options);
  }

  async run(prompt: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await this.#thread.run(prompt, { signal: controller.signal });
          if (attempt) this.#report?.("Codex connection restored");
          return;
        } catch (error) {
          console.error("Manifester Codex build attempt failed:", {
            attempt: attempt + 1,
            elapsedMs: Date.now() - startedAt,
            error: errorMessage(error),
            model: this.#options.model,
            threadId: this.#thread.id,
          });
          if (isAborted(error, controller.signal)) return;
          const delay = RETRY_DELAYS_MS[attempt];
          if (delay === undefined || !isTransient(error)) throw error;
          this.#report?.(`Codex connection dropped; retrying (${attempt + 1} of ${RETRY_DELAYS_MS.length})`);
          await wait(delay);
          this.#thread = this.#client.startThread(this.#options);
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  id(): string {
    if (!this.#thread.id) throw new Error("The application builder did not start correctly.");
    return this.#thread.id;
  }
}
