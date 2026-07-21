import type { Thread, ThreadOptions } from "@openai/codex-sdk";
import { createCodexClient } from "../codex-client.ts";

const BUILD_TIMEOUT_MS = 3 * 60 * 1_000;

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

function missingThread(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thread|session/i.test(message) && /missing|not found|unknown|resume/i.test(message);
}

async function run(thread: Thread, prompt: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS);
  try {
    await thread.run(prompt, { signal: controller.signal });
    return true;
  } catch (error) {
    const aborted = controller.signal.aborted && (
      error === controller.signal.reason
      || error instanceof Error && (
        error.name === "AbortError"
        || "code" in error && error.code === "ABORT_ERR"
        || /Codex Exec exited with signal SIG(?:TERM|KILL)/i.test(error.message)
      )
    );
    if (aborted) return false;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class BuilderThread {
  #thread: Thread;
  readonly #workingDirectory: string;

  constructor(workingDirectory: string, threadId?: string) {
    this.#workingDirectory = workingDirectory;
    const client = createCodexClient();
    this.#thread = threadId
      ? client.resumeThread(threadId, options(workingDirectory))
      : client.startThread(options(workingDirectory));
  }

  async run(prompt: string, retryMissing = true): Promise<boolean> {
    try {
      return await run(this.#thread, prompt);
    } catch (error) {
      if (!retryMissing || !missingThread(error)) throw error;
      this.#thread = createCodexClient().startThread(options(this.#workingDirectory));
      return run(this.#thread, prompt);
    }
  }

  id(): string {
    if (!this.#thread.id) throw new Error("The application builder did not start correctly.");
    return this.#thread.id;
  }
}
