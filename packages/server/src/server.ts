import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { MANAGER_ADDRESS, MANAGER_HOST, MANAGER_PORT } from "./contracts.ts";
import { registerErrorHandler } from "./http/errors.ts";
import { registerRoutes } from "./http/routes.ts";
import { registerDashboard } from "./http/static.ts";
import { liveCodexOwners } from "./lifecycle.ts";
import { ManagerService } from "./manager-service.ts";

const manager = new ManagerService();
const server = Fastify({ logger: false, bodyLimit: 65_536 });
const codexOwned = process.argv.includes("--codex-owned");
let ownershipTimer: NodeJS.Timeout | undefined;
let closing: Promise<void> | undefined;

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);
server.addHook("onRequest", async (request, reply) => {
  if (request.method === "POST" && request.headers.origin && request.headers.origin !== MANAGER_ADDRESS) {
    await reply.code(403).send({ message: "This request did not come from the Manifester Dashboard." });
  }
});
server.addHook("onSend", async (_request, reply) => {
  reply.header("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  reply.header("x-content-type-options", "nosniff");
  reply.header("cache-control", "no-store");
});
server.addHook("onClose", async () => {
  if (ownershipTimer) clearInterval(ownershipTimer);
  await manager.shutdown();
});

registerErrorHandler(server);
registerRoutes(server, { codexOwned, manager, shutdown });
await registerDashboard(server);
await server.listen({ host: MANAGER_HOST, port: MANAGER_PORT });
console.log(`Manifester Dashboard running at ${MANAGER_ADDRESS}`);
void manager.restore();

if (codexOwned) {
  ownershipTimer = setInterval(() => {
    void liveCodexOwners().then(async (owners) => {
      if (owners.length === 0) await shutdown();
    });
  }, 1_000);
}

async function shutdown(): Promise<void> {
  closing ??= server.close().then(() => undefined);
  await closing;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
