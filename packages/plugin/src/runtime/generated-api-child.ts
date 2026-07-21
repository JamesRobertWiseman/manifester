import { fork, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { isMessageWithinLimit, type ParentMessage } from "./generated-api-protocol.ts";

export async function findGeneratedApiRunner(): Promise<string> {
  const candidate = resolve(import.meta.dirname, "../runner/api-runner.mjs");
  if (await access(candidate).then(() => true, () => false)) return candidate;
  throw new Error("The generated application runner is missing.");
}

export function startGeneratedApiRunner(runner: string, modulePath: string): ChildProcess {
  return fork(runner, [modulePath], {
    env: {},
    execArgv: [
      "--permission",
      "--disable-proto=throw",
      "--no-warnings",
      `--allow-fs-read=${runner}`,
      `--allow-fs-read=${modulePath}`,
    ],
    execPath: process.execPath,
    serialization: "json",
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
}

export function sendParentMessage(child: ChildProcess, message: ParentMessage): Promise<void> {
  if (!child.connected || !isMessageWithinLimit(message)) {
    return Promise.reject(new Error("The generated application message is invalid."));
  }
  return new Promise((resolve, reject) => {
    child.send(message, (error) => error ? reject(error) : resolve());
  });
}
