import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
await rm(resolve(repository, "dist"), { force: true, recursive: true });
