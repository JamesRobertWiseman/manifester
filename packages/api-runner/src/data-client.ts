import {
  type DataArguments,
  type DataMethod,
  type DataResponseMessage,
  type RunnerMessage,
} from "@manifester/plugin/runner-contract";

interface PendingCall {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

export function createDataClient(send: (message: RunnerMessage) => Promise<void>) {
  const pending = new Map<number, PendingCall>();
  let sequence = 0;

  function nextId(): number {
    if (sequence === Number.MAX_SAFE_INTEGER) throw new Error("The generated application made too many data requests.");
    return ++sequence;
  }

  function call<Method extends DataMethod>(method: Method, args: DataArguments[Method]): Promise<unknown> {
    const id = nextId();
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      void send({ type: "call", id, method, args }).catch((error: unknown) => {
        pending.delete(id);
        reject(error instanceof Error ? error : new Error("The local data request failed."));
      });
    });
  }

  const api = {
    list: (...args: DataArguments["list"]) => call("list", args),
    get: (...args: DataArguments["get"]) => call("get", args),
    aggregate: (...args: DataArguments["aggregate"]) => call("aggregate", args),
    create: (...args: DataArguments["create"]) => call("create", args),
    update: (...args: DataArguments["update"]) => call("update", args),
    delete: (...args: DataArguments["delete"]) => call("delete", args),
  };
  Object.values(api).forEach(Object.freeze);

  return {
    api: Object.freeze(api),
    resolve(message: DataResponseMessage): void {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.ok) request.resolve(message.value);
      else request.reject(new Error("The local data request failed."));
    },
    close(): void {
      for (const { reject } of pending.values()) reject(new Error("The local data channel closed."));
      pending.clear();
    },
  };
}
