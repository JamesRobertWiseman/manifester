import { defineConfig } from "vite";
import { nodeBuild } from "../../vite.node.ts";

export default defineConfig(nodeBuild({
  root: import.meta.dirname,
  entry: "src/cli.ts",
  outDir: "../../dist/cli",
  fileName: "cli.mjs",
}));
