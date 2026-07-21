import type { ApplicationStatus } from "@manifester/plugin";

interface ActionMetadata {
  label: string;
  danger?: boolean;
}

interface MutationMetadata extends ActionMetadata {
  result: string;
  confirmation?(name: string): string;
}

export const actionMetadata = {
  open: { label: "Open" },
  inspect: { label: "Inspect" },
  publish: { label: "Publish to Sites" },
  start: { label: "Start", result: "started" },
  stop: { label: "Stop", danger: true, result: "stopped" },
  restart: { label: "Restart", result: "restarted" },
  remove: {
    label: "Remove from manager",
    result: "removed from manager",
    confirmation: (name: string) => `Remove ${name} from the manager? Its generated app and SQLite data will be kept.`,
  },
  delete: {
    label: "Delete app and data",
    danger: true,
    result: "deleted",
    confirmation: (name: string) => `Permanently delete ${name}, including its generated app and all SQLite edits? This cannot be undone.`,
  },
} as const satisfies Record<string, ActionMetadata | MutationMetadata>;

export type ApplicationAction = keyof typeof actionMetadata;
export type MutationAction = {
  [Action in ApplicationAction]: typeof actionMetadata[Action] extends MutationMetadata ? Action : never;
}[ApplicationAction];

const lifecycleActions = {
  running: ["open", "restart", "stop"],
  ready: ["start"],
  generating: ["open"],
  failed: ["open"],
  blocked: [],
  not_created: [],
} as const satisfies Record<ApplicationStatus, readonly ApplicationAction[]>;

export const rowActions = (status: ApplicationStatus): ApplicationAction[] => [...lifecycleActions[status], "inspect"];
export const inspectorActions = (status: ApplicationStatus): readonly ApplicationAction[] => lifecycleActions[status];
export const publicationActions = ["publish"] as const satisfies readonly ApplicationAction[];
export const managementActions = ["remove", "delete"] as const satisfies readonly ApplicationAction[];

export const publicationMessages = {
  ready: "Publishing creates a fixed site. New views will no longer be generated on demand, so make sure the whole app works first. Only the prepared Sites build is uploaded; Manifester's private working files stay local.",
  incomplete: "Finish generating the application before publishing.",
  unresolved: "Open every generated feature before publishing.",
  instruction: "A new Codex task is ready. Send the prefilled request to publish with ChatGPT Sites.",
} as const;
