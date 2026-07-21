import postcss from "postcss";

const externalAddress = /(?:https?:)?\/\//i;

export function assertCss(source: string): void {
  let root: postcss.Root;
  try {
    root = postcss.parse(source);
  } catch {
    throw new Error("Generated styling is not valid CSS.");
  }
  let external = false;
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === "import" && externalAddress.test(rule.params)) external = true;
  });
  root.walkDecls(({ value }) => {
    if (/url\s*\(/i.test(value) && externalAddress.test(value)) external = true;
  });
  if (external) throw new Error("Generated views cannot load files from the internet.");
}
