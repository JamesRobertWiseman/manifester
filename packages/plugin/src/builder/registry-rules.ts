import type { AppAction, AppRegistry } from "../contracts.ts";
import { resolveRoute } from "../runtime/routes.ts";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const sameValues = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value) => right.includes(value));
const stableAction = ({ targetPath: _targetPath, ...action }: AppAction) => action;

export function assertInitialRegistry(registry: AppRegistry): void {
  const home = registry.routes.find(({ id }) => id === registry.homeRouteId);
  if (registry.routes.length !== 1 || home?.path !== "/") {
    throw new Error("The initial application must contain only its home view.");
  }
  if (registry.actions.some(({ sourceRouteId, targetPath }) =>
    sourceRouteId !== registry.homeRouteId || targetPath !== undefined)) {
    throw new Error("Initial actions must stay deferred until the user chooses them.");
  }
}

export function assertMaterialisedRegistry(registry: AppRegistry, previous: AppRegistry | undefined, action: AppAction): void {
  if (!previous) throw new Error("The current application could not be read.");
  const updated = registry.actions.find(({ id }) => id === action.id);
  if (!updated?.targetPath) throw new Error("This view could not be generated.");
  if (updated.sourceRouteId !== action.sourceRouteId
    || !sameValues(updated.resourceIds, action.resourceIds)
    || !sameValues(updated.context, action.context)) {
    throw new Error("The generated view changed information it was not allowed to change.");
  }
  const previousAction = previous.actions.find(({ id }) => id === action.id);
  const existingRoutes = new Set(previous.routes.map(({ id }) => id));
  const existingActions = new Set(previous.actions.map(({ id }) => id));
  const retainedRoutes = registry.routes.filter(({ id }) => existingRoutes.has(id));
  const retainedActions = registry.actions.filter(({ id }) => existingActions.has(id));
  const allowedResources = new Set(action.resourceIds);
  const addedEntries = [
    ...registry.routes.filter(({ id }) => !existingRoutes.has(id)),
    ...registry.actions.filter(({ id }) => !existingActions.has(id)),
  ];
  if (!previousAction
    || !same(stableAction(updated), stableAction(previousAction))
    || !same(registry.application, previous.application)
    || registry.homeRouteId !== previous.homeRouteId
    || !same(retainedRoutes, previous.routes)
    || !same(
      retainedActions.filter(({ id }) => id !== action.id),
      previous.actions.filter(({ id }) => id !== action.id),
    )
    || addedEntries.some(({ resourceIds }) => resourceIds.some((id) => !allowedResources.has(id)))) {
    throw new Error("The generated view changed existing parts of the application.");
  }
  const target = registry.routes.find(({ path }) => path === updated.targetPath);
  if (!target || target.resourceIds.some((id) => !action.resourceIds.includes(id))) {
    throw new Error("The generated view tried to use data that was not allowed for this action.");
  }
}

export function assertMaterialisedRouteRegistry(
  registry: AppRegistry,
  previous: AppRegistry | undefined,
  path: string,
): void {
  if (!previous) throw new Error("The current application could not be read.");
  const target = resolveRoute(registry.routes, path)?.route;
  const previousRouteIds = new Set(previous.routes.map(({ id }) => id));
  const previousActionIds = new Set(previous.actions.map(({ id }) => id));
  const retainedRoutes = registry.routes.filter(({ id }) => previousRouteIds.has(id));
  const retainedActions = registry.actions.filter(({ id }) => previousActionIds.has(id));
  const addedActions = registry.actions.filter(({ id }) => !previousActionIds.has(id));
  if (!target || previousRouteIds.has(target.id)) throw new Error("This address did not create a new view.");
  if (!same(registry.application, previous.application)
    || registry.homeRouteId !== previous.homeRouteId
    || !same(retainedRoutes, previous.routes)
    || !same(retainedActions, previous.actions)) {
    throw new Error("The generated view changed existing application setup.");
  }
  if (!addedActions.some(({ sourceRouteId, targetPath }) =>
    previousRouteIds.has(sourceRouteId) && targetPath === target.path)) {
    throw new Error("The generated view is not available from the existing application.");
  }
}
