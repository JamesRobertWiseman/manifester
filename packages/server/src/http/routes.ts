import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { MANAGER_ADDRESS, MANAGER_SERVICE } from "../contracts.ts";
import type { ManagerService } from "../manager-service.ts";
import {
  activityQuerySchema,
  activityRequestSchema,
  applicationParamsSchema,
  changeRequestSchema,
  generationRequestSchema,
  projectRequestSchema,
} from "./schemas.ts";

interface RouteOptions {
  codexOwned: boolean;
  manager: ManagerService;
  shutdown(): Promise<void>;
}

export function registerRoutes(server: FastifyInstance, options: RouteOptions): void {
  const routes = server.withTypeProvider<ZodTypeProvider>();

  routes.get("/api/health", () => ({
    service: MANAGER_SERVICE,
    status: "running",
    address: MANAGER_ADDRESS,
    ownership: options.codexOwned ? "codex" : "standalone",
  }));
  routes.get("/api/applications", () => options.manager.list());
  routes.get("/api/applications/:id", { schema: { params: applicationParamsSchema } }, ({ params }) => options.manager.byId(params.id));
  routes.get("/api/activity", { schema: { querystring: activityQuerySchema } }, ({ query }) => options.manager.activity(query.projectId));

  routes.post("/api/projects/start", { schema: { body: projectRequestSchema } }, ({ body }) => options.manager.start(body.project, body.port, body.codexThreadId));
  routes.post("/api/projects/stop", { schema: { body: projectRequestSchema } }, ({ body }) => options.manager.stop(body.project));
  routes.post("/api/projects/restart", { schema: { body: projectRequestSchema } }, ({ body }) => options.manager.restart(body.project, body.port, body.codexThreadId));
  routes.post("/api/projects/change", { schema: { body: changeRequestSchema } }, ({ body }) => options.manager.change(body.project, body.instruction, body.codexThreadId));
  routes.post("/api/projects/status", { schema: { body: projectRequestSchema } }, ({ body }) => options.manager.status(body.project));
  routes.post("/api/projects/forget", { schema: { body: projectRequestSchema } }, ({ body }) => options.manager.forget(body.project));
  routes.post("/api/projects/activity", { schema: { body: activityRequestSchema } }, ({ body }) => options.manager.recordActivity(body.project, body.message));
  routes.post("/api/projects/generation", { schema: { body: generationRequestSchema } }, ({ body }) => options.manager.registerGeneration(body.project, body.port, body.codexThreadId));

  routes.post("/api/applications/:id/start", { schema: { params: applicationParamsSchema } }, ({ params }) => options.manager.startById(params.id));
  routes.post("/api/applications/:id/stop", { schema: { params: applicationParamsSchema } }, ({ params }) => options.manager.stopById(params.id));
  routes.post("/api/applications/:id/restart", { schema: { params: applicationParamsSchema } }, ({ params }) => options.manager.restartById(params.id));
  routes.post("/api/applications/:id/remove", { schema: { params: applicationParamsSchema } }, ({ params }) => options.manager.removeById(params.id));
  routes.post("/api/applications/:id/delete", { schema: { params: applicationParamsSchema } }, ({ params }) => options.manager.deleteById(params.id));
  routes.post("/api/manager/shutdown", (_request, reply) => {
    setImmediate(() => void options.shutdown());
    return reply.send({ status: "stopping" });
  });
}
