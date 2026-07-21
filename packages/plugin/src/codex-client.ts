import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { Codex } from "@openai/codex-sdk";

const appCodexPaths = [
  "/Applications/ChatGPT.app/Contents/Resources/codex",
  "/Applications/Codex.app/Contents/Resources/codex",
];

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function appCodexPath(): string | undefined {
  if (process.platform !== "darwin") return undefined;
  const pathCandidates = (process.env["PATH"] ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((directory) => join(directory, "codex"));
  return [...pathCandidates, ...appCodexPaths]
    .find((path) => path.includes(".app/Contents/Resources/") && isExecutable(path));
}

export function createCodexClient(): Codex {
  const codexPathOverride = process.env["MANIFESTER_CODEX_PATH"] ?? appCodexPath() ?? "codex";
  return new Codex({
    codexPathOverride,
    config: {
      features: {
        apps: false,
        browser_use_external: false,
        browser_use_full_cdp_access: false,
        browser_use: false,
        computer_use: false,
        in_app_browser: false,
        memories: false,
        multi_agent: false,
        plugins: false,
        remote_plugin: false,
        skill_mcp_dependency_install: false,
        skill_search: false,
      },
    },
  });
}
