import type { ManagedApplication, ManagerActivity } from "../contracts.ts";
import type { MutationAction } from "./actions.ts";

function errorMessage(value: unknown): string {
  return value && typeof value === "object" && "message" in value && typeof value.message === "string"
    ? value.message
    : "This action could not be completed.";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessage(result));
  return result as T;
}

export async function loadDashboard(): Promise<{
  applications: ManagedApplication[];
  activity: ManagerActivity[];
}> {
  const [applications, activity] = await Promise.all([
    request<ManagedApplication[]>("/api/applications"),
    request<ManagerActivity[]>("/api/activity"),
  ]);
  return { applications, activity };
}

export function mutateApplication(id: string, action: MutationAction): Promise<unknown> {
  return request(`/api/applications/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "This action could not be completed.";
}
