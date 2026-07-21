import { lstat, mkdir, readlink, rename, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";

function globalBinDirectory(): string {
  const path = new Set((process.env["PATH"] ?? "").split(delimiter).filter(Boolean).map((entry) => resolve(entry)));
  const pnpmHome = process.env["PNPM_HOME"] ? resolve(process.env["PNPM_HOME"]) : undefined;
  const candidates = [
    ...(pnpmHome ? [join(pnpmHome, "bin"), pnpmHome] : []),
    ...(process.env["XDG_BIN_HOME"] ? [resolve(process.env["XDG_BIN_HOME"])] : []),
    join(homedir(), ".local", "bin"),
  ];
  const directory = candidates.find((candidate) => path.has(resolve(candidate)));
  if (!directory) throw new Error("Add PNPM_HOME or ~/.local/bin to PATH before using the mnf command.");
  return directory;
}

async function canReplace(path: string, target: string): Promise<boolean> {
  const details = await lstat(path).catch(() => null);
  if (!details) return true;
  if (details.isSymbolicLink()) {
    const current = await readlink(path).catch(() => "");
    const currentTarget = resolve(path, "..", current);
    return currentTarget === target || !await lstat(currentTarget).catch(() => null);
  }
  return false;
}

export async function installGlobalCli(
  cliPath = resolve(import.meta.dirname, "../cli/cli.mjs"),
): Promise<string> {
  const target = resolve(cliPath);
  const directory = globalBinDirectory();
  const command = join(directory, process.platform === "win32" ? "mnf.cmd" : "mnf");
  await mkdir(directory, { recursive: true });
  if (!await canReplace(command, target)) {
    throw new Error(`Another command already exists at ${command}.`);
  }
  const temporary = join(directory, `.mnf-${process.pid}.tmp`);
  await rm(temporary, { force: true });
  await symlink(target, temporary, process.platform === "win32" ? "file" : undefined);
  await rename(temporary, command);
  return command;
}
