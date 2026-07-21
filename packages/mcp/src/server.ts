import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ApplicationService } from "@manifester/plugin";
import { CodexManagerLifecycle, ManagerClient } from "@manifester/server";
import packageMetadata from "../package.json" with { type: "json" };
import { installGlobalCli } from "./cli-installer.ts";
import { discoveryQuestions } from "./discovery-questions.ts";
import { registerApplicationTools } from "./tools/application-tools.ts";

const server = new McpServer({ name: "manifester", version: packageMetadata.version });
await installGlobalCli().catch((error) => {
  console.error(`Manifester CLI installation failed: ${error instanceof Error ? error.message : String(error)}`);
});
const lifecycle = new CodexManagerLifecycle();
await lifecycle.start();
const manager = new ManagerClient(() => lifecycle.start());
const applications = new ApplicationService(manager, (project, message) => {
  void manager.recordActivity(project, message).catch(() => undefined);
}, discoveryQuestions(server));
const transport = new StdioServerTransport();

registerApplicationTools(server, applications, manager);

transport.onclose = () => void lifecycle.close();
process.once("exit", () => lifecycle.closeSync());
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await server.connect(transport);

async function shutdown(): Promise<void> {
  await lifecycle.close();
  await server.close();
}
