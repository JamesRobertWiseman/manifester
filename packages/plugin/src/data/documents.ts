import { basename, extname } from "node:path";
import type { JsonObject } from "./json.ts";
import type { RawResource } from "./types.ts";

export const DOCUMENT_EXTENSIONS = new Set([".docx", ".md", ".markdown", ".pdf", ".txt"]);

const MAX_CHUNK_LENGTH = 4_000;

function chunks(text: string): string[] {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  const result: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + MAX_CHUNK_LENGTH, normalized.length);
    if (end < normalized.length) {
      const lineBreak = normalized.lastIndexOf("\n", end);
      if (lineBreak > start + MAX_CHUNK_LENGTH / 2) end = lineBreak + 1;
    }
    result.push(normalized.slice(start, end).trim());
    start = end;
  }

  return result;
}

function resource(sourcePath: string, fieldNames: string[], rows: JsonObject[]): RawResource {
  const name = basename(sourcePath, extname(sourcePath));
  return { sourcePath, kind: "document", name, tableName: name, fieldNames, rows };
}

async function pdfResource(sourcePath: string, contents: Buffer): Promise<RawResource> {
  const { getDocument } = await import("unpdf/pdfjs");
  const pdf = await getDocument({
    data: new Uint8Array(contents),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const text = await Promise.all(Array.from({ length: pdf.numPages }, async (_, page) => {
    const content = await (await pdf.getPage(page + 1)).getTextContent();
    return content.items.flatMap((item) => "str" in item ? [`${item.str}${item.hasEOL ? "\n" : ""}`] : []).join("");
  }));
  const rows = text.flatMap((pageText, page) => {
    const parts = chunks(pageText);
    return (parts.length > 0 ? parts : [""]).map((content, part) => ({
      page: page + 1,
      part: part + 1,
      content,
    }));
  });
  return resource(sourcePath, ["page", "part", "content"], rows);
}

async function docxResource(sourcePath: string, contents: Buffer): Promise<RawResource> {
  const { default: mammoth } = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: contents });
  return textResource(sourcePath, value);
}

function textResource(sourcePath: string, text: string): RawResource {
  const rows = chunks(text).map((content, part) => ({ part: part + 1, content }));
  return resource(sourcePath, ["part", "content"], rows);
}

export async function loadDocument(sourcePath: string, contents: Buffer): Promise<RawResource[]> {
  const extension = extname(sourcePath).toLowerCase();
  const document = extension === ".pdf"
    ? await pdfResource(sourcePath, contents)
    : extension === ".docx"
      ? await docxResource(sourcePath, contents)
      : textResource(sourcePath, contents.toString("utf8"));
  if (!document.rows.some(({ content }) => typeof content === "string" && content.trim())) {
    throw new Error(`No readable text was found in: ${sourcePath}`);
  }
  return [document];
}
