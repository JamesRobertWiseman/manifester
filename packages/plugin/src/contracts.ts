type FileKind = "dataset" | "context" | "unsupported";

export interface ProjectFile {
  path: string;
  size: number;
  checksum: string;
  kind: FileKind;
  note?: string;
}

export interface DataField {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "date" | "object" | "unknown";
  samples: unknown[];
}

export interface DataResource {
  id: string;
  name: string;
  sourcePath: string;
  tableName: string;
  rowCount: number;
  fields: DataField[];
}

export interface ProjectCatalog {
  project: string;
  fingerprint: string;
  files: ProjectFile[];
  resources: DataResource[];
}

export interface DiscoveryQuestion {
  id: string;
  question: string;
  reason: string;
  recommendation: string;
  options: Array<{ id: string; label: string; result: string }>;
}

export interface DiscoveryResult {
  domain: string;
  purpose: string;
  primaryUser: string;
  job: string;
  relationships: Array<{ description: string; resourceIds: string[] }>;
  application: {
    name: string;
    promise: string;
    concept: string;
    initialJourney: string[];
    likelyActions: Array<{ label: string; intent: string; resourceIds: string[] }>;
  };
  assumptions: string[];
  limitations: string[];
  intentConfidence: number;
  questions: DiscoveryQuestion[];
}

export interface AppRoute {
  id: string;
  path: string;
  title: string;
  folder: string;
  resourceIds: string[];
}

export interface AppAction {
  id: string;
  label: string;
  intent: string;
  sourceRouteId: string;
  resourceIds: string[];
  context: string[];
  targetPath?: string;
}

export interface AppRegistry {
  version: 1;
  application: { name: string; description: string };
  homeRouteId: string;
  routes: AppRoute[];
  actions: AppAction[];
}

export interface ManifesterState {
  version: 4;
  sourceFingerprint: string;
  builderThreadId: string;
  generatedAt: string;
}

export interface ActionMaterialiseRequest {
  kind: "action";
  actionId: string;
  path: string;
  context: Record<string, string | number | boolean | null>;
}

export interface RouteMaterialiseRequest {
  kind: "route";
  path: string;
}

export type MaterialiseRequest = ActionMaterialiseRequest | RouteMaterialiseRequest;

export interface MaterialiseResult {
  path: string;
}
