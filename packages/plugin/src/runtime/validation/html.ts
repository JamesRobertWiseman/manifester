import { parse, type DefaultTreeAdapterMap } from "parse5";

type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlElement = DefaultTreeAdapterMap["element"];

const forbiddenTags = new Set(["script", "style", "iframe", "frame", "object", "embed", "base"]);
const externalAddress = /^(?:https?:)?\/\//i;

function isElement(node: HtmlNode): node is HtmlElement {
  return "tagName" in node;
}

function elements(node: HtmlNode): HtmlElement[] {
  const childNodes = "content" in node
    ? node.content.childNodes
    : "childNodes" in node ? node.childNodes : [];
  const children = childNodes.flatMap(elements);
  return isElement(node) ? [node, ...children] : children;
}

function attribute(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

interface HtmlAnalysis {
  actionIds: string[];
  actionAttributeCount: number;
  hiddenMainId?: string;
}

export function analyzeHtml(source: string, title: string): HtmlAnalysis {
  const document = parse(source, { sourceCodeLocationInfo: true });
  const nodes = elements(document);
  const complete = ["html", "body"].every((tag) =>
    nodes.some((node) => node.tagName === tag && node.sourceCodeLocation));
  if (!complete) throw new Error(`The generated view ${title} must be a complete HTML page.`);
  if (nodes.some(({ tagName }) => forbiddenTags.has(tagName))) {
    throw new Error("Generated HTML must keep behavior in page.js and styling in page.css.");
  }
  for (const element of nodes) {
    if (element.attrs.some(({ name }) => name === "style" || name.startsWith("on"))) {
      throw new Error("Generated HTML must keep behavior in page.js and styling in page.css.");
    }
    if (element.attrs.some(({ name, value }) => (name === "src" || name === "href") && externalAddress.test(value.trim()))) {
      throw new Error("Generated views cannot load files from the internet.");
    }
  }
  const actionIds = nodes.flatMap((element) => {
    const id = attribute(element, "data-manifester-action");
    return id === undefined ? [] : [id];
  });
  const main = nodes.find(({ tagName }) => tagName === "main");
  const hiddenMainId = main && attribute(main, "hidden") !== undefined ? attribute(main, "id") : undefined;
  return {
    actionIds,
    actionAttributeCount: source.match(/\bdata-manifester-action\b/gi)?.length ?? 0,
    ...(hiddenMainId ? { hiddenMainId } : {}),
  };
}

export function assertVisibleMain(hiddenMainId: string | undefined, script: string, title: string): void {
  if (!hiddenMainId) return;
  const escaped = hiddenMainId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selector = new RegExp(
    `(?:getElementById\\(["']${escaped}["']\\)|querySelector\\(["']#${escaped}["']\\)|\\$\\(["']#${escaped}["']\\))(?:\\.hidden\\s*=\\s*false|\\.removeAttribute\\(["']hidden["']\\))`,
  );
  if (!selector.test(script)) throw new Error(`The generated view ${title} never reveals its main content.`);
}
