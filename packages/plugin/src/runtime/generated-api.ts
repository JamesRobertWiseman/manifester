import type { ChildProcess } from "node:child_process";
import type { LocalDataApi } from "../data/types.ts";
import {
  findGeneratedApiRunner,
  sendParentMessage,
  startGeneratedApiRunner,
} from "./generated-api-child.ts";
import { executeDataCall } from "./generated-api-data.ts";
import { isDataCallMessage, isRunnerMessage } from "./generated-api-protocol-guards.ts";
import { type DataCallEnvelope, type GeneratedRequest, isMessageWithinLimit } from "./generated-api-protocol.ts";

const API_TIMEOUT_MS = 10_000;
const failedResponse = (id: number) => ({ type: "response", id, ok: false } as const);

async function answerDataCall(child: ChildProcess, data: LocalDataApi, message: DataCallEnvelope): Promise<void> {
  if (!isDataCallMessage(message)) {
    await sendParentMessage(child, failedResponse(message.id));
    return;
  }
  try {
    const response = { type: "response", id: message.id, ok: true, value: executeDataCall(data, message) } as const;
    await sendParentMessage(child, isMessageWithinLimit(response) ? response : failedResponse(message.id));
  } catch {
    await sendParentMessage(child, failedResponse(message.id));
  }
}

export async function runGeneratedApi(options: {
  modulePath: string;
  request: GeneratedRequest;
  data: LocalDataApi;
}): Promise<unknown> {
  const runner = await findGeneratedApiRunner();
  return new Promise((resolveResult, rejectResult) => {
    let child: ChildProcess;
    try {
      child = startGeneratedApiRunner(runner, options.modulePath);
    } catch {
      rejectResult(new Error("This option could not be opened."));
      return;
    }

    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeAllListeners();
      child.kill();
      action();
    };
    const fail = () => finish(() => rejectResult(new Error("This option could not be opened.")));
    const timeout = setTimeout(() => {
      finish(() => rejectResult(new Error("This option took too long to open.")));
    }, API_TIMEOUT_MS);

    child.on("message", (message: unknown) => {
      if (!isMessageWithinLimit(message)) {
        finish(() => rejectResult(new Error("This option returned too much information.")));
        return;
      }
      if (!isRunnerMessage(message)) return;
      if (message.type === "call") {
        void answerDataCall(child, options.data, message).catch(fail);
        return;
      }
      if (message.type === "result") finish(() => resolveResult(message.result));
      else if (message.code === "too-large") {
        finish(() => rejectResult(new Error("This option returned too much information.")));
      } else fail();
    });

    child.once("error", fail);
    child.once("exit", fail);
    void sendParentMessage(child, { type: "start", request: options.request }).catch(fail);
  });
}
