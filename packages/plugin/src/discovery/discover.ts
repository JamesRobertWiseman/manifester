import type { Thread } from "@openai/codex-sdk";
import { createCodexClient } from "../codex-client.ts";
import type { DiscoveryResult, ProjectCatalog } from "../contracts.ts";
import { discoveryAnswerInput, discoveryInput, discoveryInstructions } from "./prompt.ts";
import { codexOutputSchema, discoveryResultSchema } from "./schema.ts";

const DISCOVERY_TIMEOUT_MS = 3 * 60 * 1_000;

function threadOptions(project: string) {
  return {
    workingDirectory: project,
    skipGitRepoCheck: true,
    sandboxMode: "read-only" as const,
    approvalPolicy: "never" as const,
    networkAccessEnabled: false,
    webSearchMode: "disabled" as const,
    modelReasoningEffort: "high" as const,
    model: process.env["MANIFESTER_DISCOVERY_MODEL"] ?? "gpt-5.6-terra",
  };
}

export class DiscoverySession {
  readonly #catalog: ProjectCatalog;
  readonly #thread: Thread;

  constructor(catalog: ProjectCatalog) {
    this.#catalog = catalog;
    this.#thread = createCodexClient().startThread(threadOptions(catalog.project));
  }

  async run(): Promise<DiscoveryResult> {
    return this.#turn([
      { type: "text" as const, text: discoveryInstructions },
      { type: "text" as const, text: discoveryInput(this.#catalog) },
    ], false);
  }

  async answer(answers: Array<{ questionId: string; answer: string }>): Promise<DiscoveryResult> {
    return this.#turn(discoveryAnswerInput(answers), true);
  }

  async #turn(input: Parameters<Thread["run"]>[0], final: boolean): Promise<DiscoveryResult> {
    const schema = discoveryResultSchema(this.#catalog, final);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
    let result: Awaited<ReturnType<Thread["run"]>>;
    try {
      result = await this.#thread.run(input, {
        outputSchema: codexOutputSchema(schema),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Project discovery took too long.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.finalResponse);
    } catch {
      throw new Error("Project discovery returned an unreadable result.");
    }
    const validated = schema.safeParse(parsed);
    if (!validated.success) throw new Error("Project discovery returned an incomplete result.");
    return validated.data as DiscoveryResult;
  }
}
