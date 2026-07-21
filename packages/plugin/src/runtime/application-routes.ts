import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod/v4";
import type { MaterialiseRequest, MaterialiseResult } from "../contracts.ts";
import type { LocalDataApi } from "../data/types.ts";
import { bridgeCss, bridgeJavaScript } from "./bridge.ts";
import { injectPage, routeGenerationPage } from "./page.ts";
import { loadAppRegistry } from "./registry.ts";
import { requestedRoutePath } from "./route-request.ts";
import { resolveApplicationRoute } from "./route-resolution.ts";
import { fillRoute, resolveRoute } from "./routes.ts";

const contextSchema = z.record(z.string(), z.union([
  z.string().max(500),
  z.number(),
  z.boolean(),
  z.null(),
])).refine((context) => Object.keys(context).length <= 8);

interface RouteOptions {
  appRoot: string;
  data: LocalDataApi;
  materialise(request: MaterialiseRequest): Promise<MaterialiseResult>;
}

export function registerApplicationRoutes(server: FastifyInstance, options: RouteOptions): void {
  const { appRoot } = options;
  server.get("/__manifester/bridge.js", (_request, reply) =>
    reply.type("text/javascript; charset=utf-8").header("cache-control", "no-store").send(bridgeJavaScript));
  server.get("/__manifester/bridge.css", (_request, reply) =>
    reply.type("text/css; charset=utf-8").header("cache-control", "no-store").send(bridgeCss));
  server.get<{ Params: { routeId: string; file: string } }>("/__manifester/assets/:routeId/:file", async (request, reply) => {
    const { routeId, file } = request.params;
    if (file !== "page.css" && file !== "page.js") return reply.code(404).send("Not found");
    const route = (await loadAppRegistry(appRoot)).routes.find(({ id }) => id === routeId);
    if (!route) return reply.code(404).send("Not found");
    return reply
      .type(file.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8")
      .header("cache-control", "no-store")
      .send(await readFile(join(appRoot, route.folder, file), "utf8"));
  });
  server.post<{ Params: { actionId: string }; Body: unknown }>("/__manifester/actions/:actionId", async (request, reply) => {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      return reply.code(400).send({ message: "This view is missing information it needs." });
    }
    const input = request.body as Record<string, unknown>;
    const path = typeof input["path"] === "string" ? input["path"] : "/";
    const parsedContext = contextSchema.safeParse(input["context"] ?? {});
    if (!parsedContext.success) return reply.code(400).send({ message: "This view received information it cannot use." });
    const context = parsedContext.data;
    const active = await loadAppRegistry(appRoot);
    const action = active.actions.find(({ id }) => id === request.params.actionId);
    if (!action) return reply.code(404).send({ message: "This option is no longer available." });
    const source = resolveRoute(active.routes, path);
    if (!source || source.route.id !== action.sourceRouteId) {
      return reply.code(400).send({ message: "This option is not available from the current view." });
    }
    if (Object.keys(context).some((key) => !action.context.includes(key))) {
      return reply.code(400).send({ message: "This view received information it does not use." });
    }
    if (action.context.some((key) => !Object.hasOwn(context, key))) {
      return reply.code(400).send({ message: "This view is missing information it needs." });
    }
    if (action.targetPath) return { path: fillRoute(action.targetPath, context) };
    return options.materialise({ kind: "action", actionId: action.id, path, context });
  });
  server.post<{ Body: unknown }>("/__manifester/routes", async (request, reply) => {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      return reply.code(400).send({ message: "This address cannot be used." });
    }
    const input = request.body as Record<string, unknown>;
    const path = typeof input["path"] === "string" ? requestedRoutePath(input["path"]) : null;
    if (!path || path === "/") return reply.code(400).send({ message: "This address cannot be used." });
    const active = await loadAppRegistry(appRoot);
    const resolved = resolveApplicationRoute(active.routes, path, options.data);
    if (resolved) return { path: resolved.path };
    return options.materialise({ kind: "route", path });
  });
  server.get("/*", async (request, reply) => {
    const active = await loadAppRegistry(appRoot);
    const path = requestedRoutePath(request.url);
    if (!path) return reply.code(404).type("text/plain; charset=utf-8").send("This address cannot be used.");
    const resolved = resolveApplicationRoute(active.routes, path, options.data);
    if (!resolved) {
      if (!request.headers.accept?.includes("text/html")) {
        return reply.code(404).type("text/plain; charset=utf-8").send("This view is not available.");
      }
      return reply.type("text/html; charset=utf-8").header("cache-control", "no-store").send(routeGenerationPage(path));
    }
    if (resolved.path !== path) {
      return reply.code(302).header("location", resolved.path).send();
    }
    const html = await readFile(join(appRoot, resolved.route.folder, "page.html"), "utf8");
    const routeActions = active.actions.filter(({ sourceRouteId }) => sourceRouteId === resolved.route.id);
    const actions = Object.fromEntries(routeActions.flatMap(({ id, targetPath }) => targetPath ? [[id, targetPath]] : []));
    const contexts = Object.fromEntries(routeActions.map(({ id, context }) => [id, context]));
    return reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(injectPage(html, resolved.route.id, resolved.params, actions, contexts));
  });
}
