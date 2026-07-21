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

async function run(thread: Thread, prompt: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS);
  try {
    await thread.run(prompt, { signal: controller.signal });
  } catch (error) {
    const aborted = controller.signal.aborted && (
      error === controller.signal.reason
      || error instanceof Error && (
        error.name === "AbortError"
        || "code" in error && error.code === "ABORT_ERR"
        || /Codex Exec exited with signal SIG(?:TERM|KILL)/i.test(error.message)
      )
    );
    if (aborted) return;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class BuilderThread {
  readonly #thread: Thread;

  constructor(workingDirectory: string) {
    this.#thread = createCodexClient().startThread(options(workingDirectory));
  }

  run(prompt: string): Promise<void> {
    return run(this.#thread, prompt);
  }

  id(): string {
    if (!this.#thread.id) throw new Error("The application builder did not start correctly.");
    return this.#thread.id;
  }
}
