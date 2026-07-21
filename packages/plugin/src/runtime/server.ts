import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import Fastify from "fastify";
import type { MaterialiseRequest, MaterialiseResult } from "../contracts.ts";
import type { LocalDataApi } from "../data/types.ts";
import { assertPathInside } from "../path.ts";
import { registerApplicationRoutes } from "./application-routes.ts";
import { registerGeneratedApiRoutes } from "./generated-api-route.ts";
import { LOCAL_HOST, MANAGER_ADDRESS, localAddress } from "./local-address.ts";
import { validateGeneratedApp } from "./validate.ts";

interface RuntimeOptions {
  project: string;
  appRoot: string;
  data: LocalDataApi;
  materialise(request: MaterialiseRequest): Promise<MaterialiseResult>;
  port: number;
  allowedResourceIds: Iterable<string>;
  fieldsByResource: ReadonlyMap<string, ReadonlySet<string>>;
}

export async function createGeneratedRuntime(options: RuntimeOptions) {
  const appRoot = resolve(options.appRoot);
  const versionsRoot = await realpath(resolve(options.project, ".manifester/apps"));
  assertPathInside(
    versionsRoot,
    await realpath(appRoot),
    "The saved application points outside its own folder.",
  );
  await validateGeneratedApp(
    appRoot,
    new Set(options.allowedResourceIds),
    options.fieldsByResource,
  );
  const server = Fastify({ logger: false, bodyLimit: 1_048_576 });
  server.addHook("onSend", async (_request, reply) => {
    reply.header("content-security-policy", `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; navigate-to 'self' ${MANAGER_ADDRESS}`);
    reply.header("x-content-type-options", "nosniff");
  });
  server.setErrorHandler((_error, _request, reply) =>
    reply.code(500).send({ message: "This option could not be opened." }));
  registerGeneratedApiRoutes(server, appRoot, options.data);
  registerApplicationRoutes(server, { appRoot, data: options.data, materialise: options.materialise });
  await server.listen({ host: LOCAL_HOST, port: options.port });
  const address = server.server.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error("The local application did not start correctly.");
  }
  return {
    server,
    address: localAddress(address.port),
    port: address.port,
  };
}
