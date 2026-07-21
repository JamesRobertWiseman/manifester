import { isAbsolute, relative, sep } from "node:path";

export function isPathInside(root: string, path: string): boolean {
  const candidate = relative(root, path);
  return !isAbsolute(candidate) && candidate !== ".." && !candidate.startsWith(`..${sep}`);
}

export function assertPathInside(root: string, path: string, message: string): void {
  if (!isPathInside(root, path)) throw new Error(message);
}
