import { readFile } from "node:fs/promises";
import {
  isParentMessage,
  isMessageWithinLimit,
  MAX_MESSAGE_BYTES,
  messageByteLength,
  type RunnerMessage,
} from "@manifester/plugin/runner-contract";
import { createDataClient } from "./data-client.ts";
import { lockDownRuntime } from "./sandbox.ts";

const runtimeProcess = process;
const modulePath = runtimeProcess.argv[2];

function ipcSender(): NonNullable<NodeJS.Process["send"]> {
  const value = runtimeProcess.send?.bind(runtimeProcess);
  if (!value) throw new Error("The generated application channel is missing.");
  return value;
}

const sender = ipcSender();

if (!modulePath) throw new Error("The generated application module is missing.");

const moduleSource = await readFile(modulePath, "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`;

function send(message: RunnerMessage): Promise<void> {
  if (!runtimeProcess.connected || !isMessageWithinLimit(message)) {
    return Promise.reject(new Error("The generated application message is invalid."));
  }
  return new Promise((resolve, reject) => {
    sender(message, (error) => error ? reject(error) : resolve());
  });
}

const data = createDataClient(send);

async function run(request: unknown): Promise<void> {
  try {
    const generated: unknown = await import(moduleUrl);
    if (!generated || typeof generated !== "object" || !("handle" in generated) || typeof generated.handle !== "function") {
      throw new Error("The generated application handler is missing.");
    }
    const message = { type: "result", result: await generated.handle(request, data.api) } as const;
    const bytes = messageByteLength(message);
    if (bytes === null) throw new Error("The generated application result is invalid.");
    await send(bytes <= MAX_MESSAGE_BYTES ? message : { type: "error", code: "too-large" });
  } catch {
    await send({ type: "error", code: "failed" }).catch(() => undefined);
  }
}

let started = false;
runtimeProcess.on("message", (message: unknown) => {
  if (!isParentMessage(message)) return;
  if (message.type === "response") {
    data.resolve(message);
    return;
  }
  if (started) return;
  started = true;
  void run(message.request);
});
runtimeProcess.once("disconnect", data.close);

lockDownRuntime();
