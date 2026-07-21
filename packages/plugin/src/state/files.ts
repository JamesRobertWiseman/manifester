import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

export async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, value, "utf8");
  await rename(temporary, path);
}

export function writeJson(path: string, value: unknown): Promise<void> {
  return writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}
