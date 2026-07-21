import type { ApplicationSnapshot, RemoveResult } from "./results.ts";

export interface RuntimeManager {
  registerGeneration(project: string, port: number): Promise<void>;
  start(project: string, port?: number): Promise<ApplicationSnapshot>;
  stop(project: string): Promise<ApplicationSnapshot>;
  restart(project: string, port?: number): Promise<ApplicationSnapshot>;
  status(project: string): Promise<ApplicationSnapshot>;
  forget(project: string): Promise<RemoveResult>;
}
