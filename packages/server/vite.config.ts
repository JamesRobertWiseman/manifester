import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";
import { nodeBuild } from "../../vite.node.ts";

export default defineConfig(({ mode }) => {
  if (mode === "dashboard") {
    return {
      root: resolve(import.meta.dirname, "src/dashboard"),
      publicDir: false,
      plugins: [react(), compression({ threshold: 1_024 })],
      build: {
        target: "es2022",
        outDir: resolve(import.meta.dirname, "../../dist/dashboard"),
        emptyOutDir: true,
        minify: "oxc",
        cssMinify: "lightningcss",
        rolldownOptions: {
          output: {
            comments: false,
          },
        },
      },
    };
  }

  return nodeBuild({
    root: import.meta.dirname,
    entry: mode === "server" ? "src/server.ts" : "src/index.ts",
    outDir: mode === "server" ? "../../dist/server" : "dist",
    fileName: mode === "server" ? "server.mjs" : "index.mjs",
  });
});
