import type { AggregateOptions, ListOptions } from "../data/types.ts";
import {
  DATA_METHODS,
  type DataCallEnvelope,
  type DataCallMessage,
  type GeneratedRequest,
  type ParentMessage,
  type RunnerMessage,
} from "./generated-api-protocol.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isListOptions(value: unknown): value is ListOptions {
  if (!isRecord(value)) return false;
  const { limit, offset, search } = value;
  return (limit === undefined || typeof limit === "number")
    && (offset === undefined || typeof offset === "number")
    && (search === undefined || typeof search === "string");
}

function isAggregateOptions(value: unknown): value is AggregateOptions {
  if (!isRecord(value)) return false;
  const { operation, fieldId, groupByFieldId } = value;
  return typeof operation === "string"
    && ["count", "sum", "average", "minimum", "maximum"].includes(operation)
    && (fieldId === undefined || typeof fieldId === "string")
    && (groupByFieldId === undefined || typeof groupByFieldId === "string");
}

function isGeneratedRequest(value: unknown): value is GeneratedRequest {
  if (!isRecord(value) || typeof value["method"] !== "string" || typeof value["path"] !== "string") return false;
  return isRecord(value["params"]) && Object.values(value["params"]).every((param) => typeof param === "string");
}

export function isDataCallEnvelope(value: unknown): value is DataCallEnvelope {
  return isRecord(value)
    && value["type"] === "call"
    && isSafeId(value["id"])
    && DATA_METHODS.some((method) => method === value["method"])
    && Array.isArray(value["args"]);
}

export function isDataCallMessage(message: DataCallEnvelope): message is DataCallMessage {
  const { args } = message;
  switch (message.method) {
    case "list":
      return (args.length === 1 || args.length === 2)
        && typeof args[0] === "string"
        && (args.length === 1 || isListOptions(args[1]));
    case "get":
    case "delete":
      return args.length === 2 && args.every((argument) => typeof argument === "string");
    case "aggregate":
      return args.length === 2 && typeof args[0] === "string" && isAggregateOptions(args[1]);
    case "create":
      return args.length === 2 && typeof args[0] === "string" && isRecord(args[1]);
    case "update":
      return args.length === 3
        && typeof args[0] === "string"
        && typeof args[1] === "string"
        && isRecord(args[2]);
  }
}

export function isParentMessage(value: unknown): value is ParentMessage {
  if (!isRecord(value)) return false;
  if (value["type"] === "start") return isGeneratedRequest(value["request"]);
  if (value["type"] !== "response" || !isSafeId(value["id"]) || typeof value["ok"] !== "boolean") return false;
  return value["ok"] === false || Object.hasOwn(value, "value");
}

export function isRunnerMessage(value: unknown): value is RunnerMessage {
  if (isDataCallEnvelope(value)) return true;
  if (!isRecord(value)) return false;
  if (value["type"] === "result") return true;
  return value["type"] === "error" && (value["code"] === "failed" || value["code"] === "too-large");
}
