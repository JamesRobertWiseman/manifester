import { defineConfig } from "vite";
import { nodeBuild } from "../../vite.node.ts";

export default defineConfig(nodeBuild({
  root: import.meta.dirname,
  entry: "src/server.ts",
  outDir: "../../dist/mcp",
  fileName: "server.mjs",
}));
