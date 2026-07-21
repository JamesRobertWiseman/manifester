import type { AggregateOptions, ListOptions } from "../data/types.ts";

export const DATA_METHODS = ["list", "get", "aggregate", "create", "update", "delete"] as const;
export const MAX_MESSAGE_BYTES = 1_048_576;

export type DataMethod = typeof DATA_METHODS[number];

export interface GeneratedRequest {
  method: string;
  path: string;
  query: unknown;
  params: Record<string, string>;
  body: unknown;
}

export interface DataArguments {
  list: [resourceId: string, options?: ListOptions];
  get: [resourceId: string, recordId: string];
  aggregate: [resourceId: string, options: AggregateOptions];
  create: [resourceId: string, values: Record<string, unknown>];
  update: [resourceId: string, recordId: string, values: Record<string, unknown>];
  delete: [resourceId: string, recordId: string];
}

export interface DataCallEnvelope {
  type: "call";
  id: number;
  method: DataMethod;
  args: unknown[];
}

export type DataCallMessage = {
  [Method in DataMethod]: {
    type: "call";
    id: number;
    method: Method;
    args: DataArguments[Method];
  };
}[DataMethod];

export type DataResponseMessage =
  | { type: "response"; id: number; ok: true; value: unknown }
  | { type: "response"; id: number; ok: false };

export type ParentMessage = { type: "start"; request: GeneratedRequest } | DataResponseMessage;
export type RunnerMessage =
  | DataCallEnvelope
  | { type: "result"; result: unknown }
  | { type: "error"; code: "failed" | "too-large" };

export function messageByteLength(value: unknown): number | null {
  try {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? null : Buffer.byteLength(encoded);
  } catch {
    return null;
  }
}

export const isMessageWithinLimit = (value: unknown): boolean => {
  const bytes = messageByteLength(value);
  return bytes !== null && bytes <= MAX_MESSAGE_BYTES;
};
