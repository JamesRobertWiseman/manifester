import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toolResult(value: object): CallToolResult {
  const structuredContent = Object.fromEntries(Object.entries(value));
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}
