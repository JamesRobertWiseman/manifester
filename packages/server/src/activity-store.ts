import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJson, writeJson } from "@manifester/plugin";
import type { ManagerActivity } from "./contracts.ts";

interface ActivityFile {
  version: 1;
  entries: ManagerActivity[];
}

const activityPath = join(homedir(), ".manifester", "activity.json");

function validActivity(value: unknown): value is ManagerActivity {
  if (!value || typeof value !== "object") return false;
  const activity = value as Partial<ManagerActivity>;
  return typeof activity.id === "string"
    && typeof activity.occurredAt === "string"
    && typeof activity.message === "string"
    && (activity.projectId === undefined || typeof activity.projectId === "string");
}

export class ManagerActivityStore {
  #pending = Promise.resolve();

  async list(projectId?: string): Promise<ManagerActivity[]> {
    await this.#pending;
    return (await this.#read()).filter((entry) => !projectId || entry.projectId === projectId).slice(0, 200);
  }

  record(projectId: string | undefined, message: string): Promise<void> {
    return this.#enqueue(async () => {
      const entry: ManagerActivity = {
        id: randomUUID(),
        ...(projectId ? { projectId } : {}),
        occurredAt: new Date().toISOString(),
        message,
      };
      await writeJson(activityPath, { version: 1, entries: [entry, ...await this.#read()].slice(0, 500) });
    });
  }

  clear(projectId: string): Promise<void> {
    return this.#enqueue(async () => {
      await writeJson(activityPath, {
        version: 1,
        entries: (await this.#read()).filter((entry) => entry.projectId !== projectId),
      });
    });
  }

  async #read(): Promise<ManagerActivity[]> {
    const raw = await readJson(activityPath).catch(() => null);
    if (!raw || typeof raw !== "object") return [];
    const activity = raw as Partial<ActivityFile>;
    return activity.version === 1 && Array.isArray(activity.entries)
      ? activity.entries.filter(validActivity)
      : [];
  }

  #enqueue(action: () => Promise<void>): Promise<void> {
    const next = this.#pending.catch(() => undefined).then(action);
    this.#pending = next.catch(() => undefined);
    return next;
  }
}
