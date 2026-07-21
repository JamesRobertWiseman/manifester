import type { ApplicationStatus } from "@manifester/plugin";

export const MANAGER_HOST = "127.0.0.1";
export const MANAGER_PORT = 4_316;
export const MANAGER_ADDRESS = `http://${MANAGER_HOST}:${MANAGER_PORT}`;
export const MANAGER_SERVICE = "manifester-manager";

export type DesiredStatus = "running" | "stopped";

export interface ManagedProject {
  id: string;
  project: string;
  codexThreadId?: string;
  desiredStatus: DesiredStatus;
  port: number;
  generationPort?: number;
  registeredAt: string;
  startedAt?: string;
}

export interface ManagerActivity {
  id: string;
  projectId?: string;
  occurredAt: string;
  message: string;
}

export interface ManagedApplication extends ManagedProject {
  application?: { name: string; description: string };
  codexTaskUrl?: string;
  status: ApplicationStatus;
  running: boolean;
  address?: string;
  stage?: string;
  message?: string;
  uptimeMs?: number;
  publication?: {
    ready: boolean;
    taskUrl: string;
    unresolvedActions: string[];
  };
}
