import type { ApplicationStatus } from "@manifester/plugin";
import { LOCAL_HOST, MANAGER_ADDRESS, MANAGER_PORT } from "@manifester/plugin/local-address";

export const MANAGER_HOST = LOCAL_HOST;
export { MANAGER_ADDRESS, MANAGER_PORT };
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
