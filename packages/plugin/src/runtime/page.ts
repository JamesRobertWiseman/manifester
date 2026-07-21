export function injectPage(
  html: string,
  routeId: string,
  params: Record<string, string>,
  actions: Record<string, string>,
  contexts: Record<string, string[]>,
): string {
  const state = encodeState({ routeId, params, actions, contexts });
  const head = `<meta name="manifester-route" content="${state}"><link rel="stylesheet" href="/__manifester/assets/${encodeURIComponent(routeId)}/page.css"><link rel="stylesheet" href="/__manifester/bridge.css">`;
  const scripts = `<script src="/__manifester/bridge.js" defer></script><script src="/__manifester/assets/${encodeURIComponent(routeId)}/page.js" defer></script>`;
  const withHead = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${head}</head>`) : `${head}${html}`;
  return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${scripts}</body>`) : `${withHead}${scripts}`;
}

export function routeGenerationPage(path: string): string {
  const state = encodeState({ requestedPath: path });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="manifester-route" content="${state}">
    <title>The next scene is taking shape</title>
    <link rel="stylesheet" href="/__manifester/bridge.css">
  </head>
  <body>
    <main id="manifester-generation" role="status" aria-live="polite" aria-label="The next scene is taking shape...">
      The next scene is taking shape<span class="manifester-loading-dots" aria-hidden="true"><span class="manifester-loading-dot">.</span><span class="manifester-loading-dot">.</span><span class="manifester-loading-dot">.</span></span>
    </main>
    <script src="/__manifester/bridge.js" defer></script>
  </body>
</html>`;
}

function encodeState(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
