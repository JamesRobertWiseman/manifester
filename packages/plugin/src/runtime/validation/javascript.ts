import { parse, type Node, type Program } from "acorn";
import { full } from "acorn-walk";

const browserGlobals = new Set(["localStorage", "sessionStorage", "indexedDB"]);
const serverGlobals = new Set([
  "require",
  "process",
  "global",
  "globalThis",
  "eval",
  "Function",
  "constructor",
  "__proto__",
  "WebAssembly",
  "fetch",
  "WebSocket",
  "EventSource",
  "XMLHttpRequest",
  "navigator",
  "child_process",
  "worker_threads",
  "fs",
  "net",
  "http",
  "https",
]);

function parseJavaScript(source: string, sourceType: "script" | "module", message: string): Program {
  try {
    return parse(source, { ecmaVersion: "latest", sourceType });
  } catch (error) {
    throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function nodeRecord(node: Node): Record<string, unknown> {
  return node as unknown as Record<string, unknown>;
}

function identifier(node: Node): string | undefined {
  const value = nodeRecord(node)["name"];
  return node.type === "Identifier" && typeof value === "string" ? value : undefined;
}

function stringValue(node: Node): string | undefined {
  const record = nodeRecord(node);
  if (node.type === "Literal" && typeof record["value"] === "string") return record["value"];
  if (node.type !== "TemplateElement") return undefined;
  const value = record["value"];
  if (!value || typeof value !== "object") return undefined;
  const raw = (value as Record<string, unknown>)["raw"];
  return typeof raw === "string" ? raw : undefined;
}

function inspect(program: Program, forbidden: ReadonlySet<string>): { forbidden: boolean; external: boolean; imported: boolean } {
  let blocked = false;
  let external = false;
  let imported = false;
  full(program, (node) => {
    const name = identifier(node);
    if (name && forbidden.has(name)) blocked = true;
    const value = stringValue(node);
    if (value && /https?:\/\//i.test(value)) external = true;
    if (node.type === "ImportExpression" || node.type === "ImportDeclaration") imported = true;
  });
  return { forbidden: blocked, external, imported };
}

export function assertBrowserJavaScript(source: string): void {
  const program = parseJavaScript(source, "script", "Generated browser code is not valid JavaScript");
  const result = inspect(program, browserGlobals);
  if (result.imported || result.external) {
    throw new Error("Generated browser code cannot import files or use external addresses.");
  }
  if (result.forbidden) {
    throw new Error("Generated browser code must save application data through the local data service.");
  }
}

function isHandleExport(node: Node): boolean {
  if (node.type !== "ExportNamedDeclaration") return false;
  const declaration = nodeRecord(node)["declaration"];
  if (!declaration || typeof declaration !== "object") return false;
  const functionNode = declaration as Node;
  if (functionNode.type !== "FunctionDeclaration") return false;
  const id = nodeRecord(functionNode)["id"];
  return Boolean(id && typeof id === "object" && identifier(id as Node) === "handle");
}

export function assertServerJavaScript(source: string): void {
  const program = parseJavaScript(source, "module", "Generated server code is not valid JavaScript");
  const exports = program.body.filter(({ type }) => type.startsWith("Export"));
  const result = inspect(program, serverGlobals);
  if (result.forbidden || result.imported || exports.length !== 1 || !isHandleExport(exports[0] as Node)) {
    throw new Error("Generated server code tried to use something outside the local data service.");
  }
}
