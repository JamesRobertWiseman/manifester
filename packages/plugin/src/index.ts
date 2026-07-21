export { ApplicationService } from "./application/application-service.ts";
export { resolveProject } from "./application/project.ts";
export type { AskDiscoveryQuestions, DiscoveryAnswer } from "./application/questions.ts";
export type {
  ApplicationSnapshot,
  ApplicationStatus,
  RemoveResult,
} from "./application/results.ts";
export type { RuntimeManager } from "./application/runtime-manager.ts";
export { loadAppRegistry } from "./runtime/registry.ts";
export { readJson, writeJson } from "./state/files.ts";
export { appRoot, loadState } from "./state/project-state.ts";
