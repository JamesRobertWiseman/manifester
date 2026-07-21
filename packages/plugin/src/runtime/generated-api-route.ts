import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod/v4";
import type { LocalDataApi } from "../data/types.ts";
import { scopedDataApi } from "./data-scope.ts";
import { runGeneratedApi } from "./generated-api.ts";
import { loadAppRegistry } from "./registry.ts";
import { resolveRoute } from "./routes.ts";

interface ApiParams {
  routeId: string;
  "*"?: string;
}

const responseSchema = z.object({
  status: z.number().int().min(100).max(599).optional(),
  body: z.unknown().optional(),
});

async function generatedApi(
  appRoot: string,
  data: LocalDataApi,
  request: FastifyRequest<{ Params: ApiParams }>,
  reply: FastifyReply,
): Promise<unknown> {
  const registry = await loadAppRegistry(appRoot);
  const route = registry.routes.find(({ id }) => id === request.params.routeId);
  if (!route) return reply.code(404).send({ message: "This view is not available." });
  const modulePath = join(appRoot, route.folder, "api.mjs");
  if (!(await stat(modulePath).catch(() => null))?.isFile()) {
    return reply.code(404).send({ message: "This option is not available." });
  }
  const apiPath = request.params["*"] ? `/${request.params["*"]}` : "/";
  const result = responseSchema.safeParse(await runGeneratedApi({
    modulePath,
    request: {
      method: request.method,
      path: apiPath,
      query: request.query,
      params: resolveRoute([route], apiPath)?.params ?? {},
      body: request.body,
    },
    data: scopedDataApi(data, route.resourceIds),
  }));
  if (!result.success) {
    return reply.code(500).send({
      message: "This option returned unusable information. Ask Codex to repair this application.",
    });
  }
  return reply.code(result.data.status ?? 200).send(result.data.body ?? null);
}

export function registerGeneratedApiRoutes(server: FastifyInstance, appRoot: string, data: LocalDataApi): void {
  const handler = (request: FastifyRequest<{ Params: ApiParams }>, reply: FastifyReply) =>
    generatedApi(appRoot, data, request, reply);
  server.all<{ Params: ApiParams }>("/api/app/:routeId", handler);
  server.all<{ Params: ApiParams }>("/api/app/:routeId/*", handler);
}
