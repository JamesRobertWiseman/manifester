import type { AppRegistry } from "../contracts.ts";

export type ApplicationStatus = "running" | "ready" | "generating" | "blocked" | "not_created" | "failed";

export interface RuntimeDetails {
  running: boolean;
  address?: string;
  port?: number;
  alreadyRunning?: boolean;
}

export interface ApplicationSnapshot {
  status: ApplicationStatus;
  running: boolean;
  application?: AppRegistry["application"];
  address?: string;
  port?: number;
  stage?: string;
  message?: string;
  runtime?: RuntimeDetails;
  openInBrowser?: string;
}

export interface CloseResult {
  closed: boolean;
}

export interface RemoveResult {
  removed: boolean;
}
