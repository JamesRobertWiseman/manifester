import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ElicitRequestFormParams, PrimitiveSchemaDefinition } from "@modelcontextprotocol/sdk/types.js";
import type { AskDiscoveryQuestions, DiscoveryAnswer } from "@manifester/plugin";

export function discoveryQuestions(server: McpServer): AskDiscoveryQuestions {
  return (applicationName, questions) => askDiscoveryQuestions(server, applicationName, questions);
}

async function askDiscoveryQuestions(
  server: McpServer,
  applicationName: string,
  questions: Parameters<AskDiscoveryQuestions>[1],
): Promise<DiscoveryAnswer[] | null> {
  if (!server.server.getClientCapabilities()?.elicitation?.form) {
    throw new Error("This version of Codex cannot show the short answer form Manifester needs.");
  }

  const properties: Record<string, PrimitiveSchemaDefinition> = {};
  const required: string[] = [];
  questions.slice(0, 3).forEach((question, index) => {
    const key = `answer_${index + 1}`;
    const ownKey = `own_answer_${index + 1}`;
    const recommended = question.options.find(({ id }) => id === question.recommendation);
    properties[key] = {
      type: "string",
      title: question.question,
      description: `${question.reason}\n\nRecommended: ${recommended?.label ?? "the selected choice"}.\n\n${question.options.map(({ label, result }) => `${label}: ${result}`).join("\n")}`,
      oneOf: question.options.map(({ id, label }) => ({ const: id, title: label })),
      default: question.recommendation,
    };
    properties[ownKey] = {
      type: "string",
      title: "Your own answer (optional)",
      description: "Use this only when the choices do not fit.",
    };
    required.push(key);
  });

  const request: ElicitRequestFormParams = {
    mode: "form",
    message: `Help shape ${applicationName}. The recommended answers are already selected.`,
    requestedSchema: { type: "object", properties, required },
  };
  const result = await server.server.elicitInput(request, { timeout: 30 * 60 * 1_000 });
  if (result.action !== "accept" || !result.content) return null;

  return questions.slice(0, 3).map((question, index) => {
    const own = result.content?.[`own_answer_${index + 1}`];
    const selected = result.content?.[`answer_${index + 1}`];
    return {
      questionId: question.id,
      answer: typeof own === "string" && own.trim() ? own.trim() : String(selected),
    };
  });
}
