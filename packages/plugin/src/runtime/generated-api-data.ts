import type { LocalDataApi } from "../data/types.ts";
import type { DataCallMessage } from "./generated-api-protocol.ts";

export function executeDataCall(data: LocalDataApi, message: DataCallMessage): unknown {
  switch (message.method) {
    case "list": return data.list(...message.args);
    case "get": return data.get(...message.args);
    case "aggregate": return data.aggregate(...message.args);
    case "create": return data.create(...message.args);
    case "update": return data.update(...message.args);
    case "delete": return data.delete(...message.args);
  }
}
