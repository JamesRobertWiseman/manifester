import type { ManagedApplication } from "../contracts.ts";

export const EMPTY = "—";

export function projectName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

export function compactProject(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, "~");
}

export function applicationName(application: ManagedApplication): string {
  return application.application?.name || projectName(application.project);
}

export function duration(milliseconds?: number): string {
  if (!Number.isFinite(milliseconds) || (milliseconds ?? -1) < 0) return EMPTY;
  const seconds = Math.floor((milliseconds ?? 0) / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(remainder).padStart(2, "0")}s`
    : `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

export function time(value?: string): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : date.toLocaleString();
}

export function activityTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
}

export function displayStatus(application: ManagedApplication): string {
  if (application.status === "ready" || application.status === "not_created") return "Stopped";
  return application.status.charAt(0).toUpperCase() + application.status.slice(1).replace("_", " ");
}

export function statusClass(application: ManagedApplication): string {
  return application.status === "ready" || application.status === "not_created" ? "stopped" : application.status;
}
