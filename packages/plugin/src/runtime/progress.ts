import Fastify from "fastify";

type BuildProgressStatus = "generating" | "failed";

const progressHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Building your application</title>
    <link rel="stylesheet" href="/__manifester/progress.css">
  </head>
  <body>
    <main>
      <p id="build-status" role="status" aria-live="polite">Assessing your project</p>
    </main>
    <script src="/__manifester/progress.js" defer></script>
  </body>
</html>`;

const progressCss = `
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
main { padding: 2rem; text-align: center; }
p { margin: 0; font-size: 1rem; line-height: 1.5; }
`.trim();

const progressJavaScript = `
const message = document.querySelector("#build-status");

async function refresh() {
  try {
    const response = await fetch("/__manifester/progress", { cache: "no-store" });
    if (!response.ok) {
      location.reload();
      return;
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      location.assign("/");
      return;
    }
    const progress = await response.json();
    if (message.textContent !== progress.message) message.textContent = progress.message;
    if (progress.status === "failed") return;
  } catch {}
  setTimeout(refresh, 750);
}

setTimeout(refresh, 250);
`.trim();

export async function createBuildProgressRuntime(port: number) {
  let status: BuildProgressStatus = "generating";
  let message = "Assessing your project";
  const server = Fastify({ logger: false });
  server.addHook("onSend", async (_request, reply) => {
    reply.header("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "no-store");
  });
  server.get("/__manifester/progress", async () => ({ status, message }));
  server.get("/__manifester/progress.css", async (_request, reply) =>
    reply.type("text/css; charset=utf-8").send(progressCss));
  server.get("/__manifester/progress.js", async (_request, reply) =>
    reply.type("text/javascript; charset=utf-8").send(progressJavaScript));
  server.get("/*", async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(progressHtml));
  await server.listen({ host: "127.0.0.1", port });
  const address = server.server.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error("The build screen could not be opened.");
  }
  return {
    server,
    address: `http://127.0.0.1:${address.port}`,
    port: address.port,
    snapshot: () => ({ status, message }),
    update(next: string) {
      status = "generating";
      message = next;
    },
    fail(next = "This application could not be created.") {
      status = "failed";
      message = next;
    },
  };
}

export type BuildProgress = Awaited<ReturnType<typeof createBuildProgressRuntime>>;
