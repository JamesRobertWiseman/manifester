import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import type { ProjectFile } from "../contracts.ts";
import { DATASET_EXTENSIONS } from "./loaders.ts";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const EXCLUDED_DIRECTORIES = new Set([
  ".cache",
  ".aws",
  ".git",
  ".gnupg",
  ".manifester",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".pnpm-store",
  ".secrets",
  ".svelte-kit",
  ".ssh",
  ".turbo",
  ".venv",
  ".vite",
  ".yarn",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "secrets",
  "target",
  "vendor",
  "venv",
]);
const SECRET_FILES = new Set([
  ".env",
  ".envrc",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "credentials.json",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "service-account.json",
]);
const GENERATED_FILES = new Set([".ds_store", "thumbs.db"]);
const SECRET_EXTENSIONS = new Set([".key", ".p12", ".pem", ".pfx"]);

interface InventoryResult {
  project: string;
  files: ProjectFile[];
}

function projectPath(path: string): string {
  return path.split(sep).join("/");
}

function isSecret(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_FILES.has(lower)
    || lower.startsWith(".env.")
    || SECRET_EXTENSIONS.has(extname(lower))
    || /(^|[._-])(secret|secrets|credential|credentials|token|tokens|api[._-]?key|private[._-]?key|auth)([._-]|$)/.test(lower);
}

async function checksumFile(path: string): Promise<string> {
  const checksum = createHash("sha256");
  for await (const chunk of createReadStream(path)) checksum.update(chunk);
  return checksum.digest("hex");
}

function isText(contents: Buffer): boolean {
  if (contents.includes(0)) return false;
  const decoded = contents.toString("utf8");
  const replacements = decoded.match(/\uFFFD/g)?.length ?? 0;
  return replacements <= Math.max(1, decoded.length / 100);
}

function classify(path: string, contents: Buffer): Pick<ProjectFile, "kind" | "note"> {
  if (DATASET_EXTENSIONS.has(extname(path).toLowerCase())) return { kind: "dataset" };
  if (isText(contents)) return { kind: "context" };
  return { kind: "unsupported", note: "This file format is not supported." };
}

async function walk(root: string, directory = root): Promise<ProjectFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: ProjectFile[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) files.push(...await walk(root, absolute));
      continue;
    }
    if (!entry.isFile() || GENERATED_FILES.has(entry.name.toLowerCase()) || isSecret(entry.name)) continue;
    const details = await stat(absolute);
    const path = projectPath(relative(root, absolute));
    if (details.size > MAX_FILE_SIZE) {
      files.push({
        path,
        size: details.size,
        checksum: await checksumFile(absolute),
        kind: "unsupported",
        note: "This file is larger than 5 MB and was skipped.",
      });
      continue;
    }
    const contents = await readFile(absolute);
    files.push({
      path,
      size: details.size,
      checksum: createHash("sha256").update(contents).digest("hex"),
      ...classify(path, contents),
    });
  }

  return files;
}

export async function inventoryProject(project: string): Promise<InventoryResult> {
  const root = await realpath(project);
  const details = await stat(root);
  if (!details.isDirectory()) throw new Error("The project path must be a directory.");
  return { project: root, files: await walk(root) };
}

export function contentFingerprint(files: ProjectFile[]): string {
  const fingerprint = createHash("sha256");
  files
    .toSorted((left, right) => left.path.localeCompare(right.path))
    .forEach((file) => fingerprint.update(file.path).update("\0").update(file.checksum).update("\0"));
  return fingerprint.digest("hex");
}
