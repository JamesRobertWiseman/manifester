import { lstat, readFile } from "node:fs/promises";
import { assertPathInside as assertInside } from "../../path.ts";

export async function requiredFile(path: string): Promise<string> {
  const details = await lstat(path).catch(() => null);
  if (!details?.isFile() || details.isSymbolicLink()) {
    throw new Error(`The generated application is missing ${path.split("/").at(-1)}.`);
  }
  const contents = await readFile(path, "utf8").catch(() => "");
  if (!contents.trim()) throw new Error(`The generated application is missing ${path.split("/").at(-1)}.`);
  return contents;
}

export function assertPathInside(root: string, path: string): void {
  assertInside(root, path, "A generated application file points outside its own folder.");
}
