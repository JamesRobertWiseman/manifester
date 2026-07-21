import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { ProjectCatalog, ProjectFile } from "../contracts.ts";
import { loadDocument } from "../data/documents.ts";
import { isPathInside } from "../path.ts";
import { writeText } from "../state/files.ts";

function sourcePath(project: string, file: ProjectFile): string {
  const path = resolve(project, file.path);
  if (!isPathInside(project, path)) throw new Error(`Document is outside the project: ${file.path}`);
  return path;
}

async function contents(project: string, file: ProjectFile): Promise<Buffer> {
  const value = await readFile(sourcePath(project, file));
  if (createHash("sha256").update(value).digest("hex") !== file.checksum) {
    throw new Error(`The source file changed during discovery: ${file.path}`);
  }
  return value;
}

function extractedText(source: string, rows: Awaited<ReturnType<typeof loadDocument>>[number]["rows"]): string {
  const blocks = rows.map(({ page, part, content }) => {
    const location = typeof page === "number" ? `Page ${page}, part ${part}` : `Part ${part}`;
    return `## ${location}\n\n${String(content)}`;
  });
  return `# Extracted content from ${source}\n\n${blocks.join("\n\n")}\n`;
}

export async function prepareDocumentContext(project: string, catalog: ProjectCatalog): Promise<string[]> {
  const root = await realpath(project);
  if (root !== resolve(catalog.project)) throw new Error("The catalog belongs to a different project.");
  const paths: string[] = [];

  for (const file of catalog.files.filter(({ kind }) => kind === "document")) {
    const [document] = await loadDocument(file.path, await contents(root, file));
    if (!document) throw new Error(`The extracted document is unavailable: ${file.path}`);
    const resource = catalog.resources.find(({ sourcePath }) => sourcePath === file.path);
    if (!resource) throw new Error(`The extracted document is unavailable: ${file.path}`);
    const path = join(root, ".manifester", "document-context", `${resource.id}.md`);
    await writeText(path, extractedText(file.path, document.rows));
    paths.push(relative(root, path));
  }

  return paths;
}
