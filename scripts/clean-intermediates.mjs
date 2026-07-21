import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
await Promise.all([
  "packages/plugin/dist",
  "packages/server/dist",
].map((path) => rm(resolve(repository, path), { force: true, recursive: true })));
