import { defineConfig } from "vite";
import { nodeBuild } from "../../vite.node.ts";

export default defineConfig(nodeBuild({
  root: import.meta.dirname,
  entry: "src/api-runner.ts",
  outDir: "../../dist/runner",
  fileName: "api-runner.mjs",
}));
