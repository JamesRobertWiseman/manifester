import { resolve } from "node:path";
import type { UserConfig } from "vite";

interface NodeBuildOptions {
  root: string;
  entry: string;
  outDir: string;
  fileName: string;
  emptyOutDir?: boolean;
}

export function nodeBuild(options: NodeBuildOptions): UserConfig {
  return {
    root: options.root,
    publicDir: false,
    build: {
      ssr: resolve(options.root, options.entry),
      target: "node24",
      outDir: resolve(options.root, options.outDir),
      emptyOutDir: options.emptyOutDir ?? true,
      copyPublicDir: false,
      minify: "oxc",
      rolldownOptions: {
        platform: "node",
        treeshake: true,
        output: {
          format: "es",
          entryFileNames: options.fileName,
          codeSplitting: false,
          comments: false,
          polyfillRequire: true,
        },
      },
    },
    ssr: {
      target: "node",
      noExternal: true,
    },
  };
}
