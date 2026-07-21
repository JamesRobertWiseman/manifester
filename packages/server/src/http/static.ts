import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { resolve } from "node:path";

export async function registerDashboard(server: FastifyInstance): Promise<void> {
  await server.register(fastifyStatic, {
    root: resolve(import.meta.dirname, "../dashboard"),
    index: false,
    preCompressed: true,
    redirect: false,
    wildcard: false,
  });
  server.setNotFoundHandler((request, reply) => {
    const missingApi = request.url === "/api" || request.url.startsWith("/api?") || request.url.startsWith("/api/");
    if (missingApi || request.url.startsWith("/assets/")) {
      return reply.code(404).send({
        message: missingApi ? "This Dashboard endpoint does not exist." : "This Dashboard asset does not exist.",
      });
    }
    return reply.type("text/html; charset=utf-8").sendFile("index.html");
  });
}
