import { defineConfig } from "vite";
import { nodeBuild } from "../../vite.node.ts";

export default defineConfig(({ mode }) => nodeBuild({
  root: import.meta.dirname,
  entry: mode === "runner-contract"
    ? "src/runtime/generated-api-contract.ts"
    : mode === "local-address" ? "src/runtime/local-address.ts" : "src/index.ts",
  outDir: "dist",
  fileName: mode === "runner-contract" ? "runner-contract.mjs" : mode === "local-address" ? "local-address.mjs" : "index.mjs",
  emptyOutDir: mode === "library",
}));
