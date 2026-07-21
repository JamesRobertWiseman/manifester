import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import type { ApplicationService } from "@manifester/plugin";
import type { ManagerClient } from "@manifester/server";
import { toolResult } from "../tool-result.ts";

const projectInput = { project: z.string().trim().min(1) };
const portInput = z.number().int().min(0).max(65_535).default(0);

export function registerApplicationTools(server: McpServer, applications: ApplicationService, manager: ManagerClient): void {
  server.registerTool(
    "open_manifester_manager",
    {
      description: "Open the standalone Manifester dashboard for monitoring, starting, stopping, restarting, inspecting, and opening local applications outside Codex.",
      inputSchema: {},
    },
    async () => toolResult(await manager.dashboard()),
  );

  server.registerTool(
    "open_manifester_application",
    {
      description: "Discover this project, build or reopen its local application, start it, and immediately open the returned application and manager addresses in separate Codex in-app browser tabs.",
      inputSchema: {
        ...projectInput,
        port: portInput,
      },
    },
    async ({ project, port }) => {
      const application = await applications.open(project, port);
      return toolResult({ ...application, manager: await manager.dashboard() });
    },
  );

  server.registerTool(
    "change_manifester_application",
    {
      description: "Add or change a feature in an existing local application.",
      inputSchema: {
        ...projectInput,
        instruction: z.string().trim().min(1).max(4_000),
      },
    },
    async ({ project, instruction }) => toolResult(await manager.change(project, instruction)),
  );

  server.registerTool(
    "get_manifester_status",
    {
      description: "Inspect the manager-owned application server and report its status, address, port, current generation stage, or anything needing attention.",
      inputSchema: projectInput,
    },
    async ({ project }) => toolResult(await applications.status(project)),
  );

  server.registerTool(
    "restart_manifester_application",
    {
      description: "Restart the manager-owned application server, keep its generated files and data, and immediately open the returned openInBrowser address in Codex's in-app browser.",
      inputSchema: { ...projectInput, port: portInput },
    },
    async ({ project, port }) => toolResult(await applications.restart(project, port)),
  );

  server.registerTool(
    "close_manifester_application",
    {
      description: "Stop the local application while keeping its generated files and local data.",
      inputSchema: projectInput,
    },
    async ({ project }) => toolResult(await applications.close(project)),
  );

  server.registerTool(
    "reset_manifester_application",
    {
      description: "Remove only this project's generated Manifester application and local data.",
      inputSchema: projectInput,
    },
    async ({ project }) => toolResult(await applications.reset(project)),
  );
}
