import type { AppAction, DiscoveryResult, ProjectCatalog } from "../contracts.ts";

const generatedAppContract = `
# Manifester generated application contract

Build a complete local vanilla web application. Use only HTML, CSS, browser
JavaScript, and optional server JavaScript. There is no frontend build step.
Work only with files in the current generated-app directory and the supplied
brief. Never inspect parent folders, environment files, credentials, or secrets.

## Files

- app.json contains version, application, homeRouteId, routes, and actions.
- Each route folder contains page.html, page.css, and page.js.
- A route may also contain api.mjs.
- page.html is a complete HTML document. The runtime injects the route CSS,
  route JavaScript, and the small Manifester action bridge.

## app.json

Use this shape exactly:

{
  "version": 1,
  "application": { "name": "...", "description": "..." },
  "homeRouteId": "home",
  "routes": [
    {
      "id": "home",
      "path": "/",
      "title": "...",
      "folder": "routes/home",
      "resourceIds": ["exact-resource-id"]
    }
  ],
  "actions": [
    {
      "id": "view-item",
      "label": "View details",
      "intent": "Help the user understand one item",
      "sourceRouteId": "home",
      "resourceIds": ["exact-resource-id"],
      "context": ["item_id"]
    }
  ]
}

An unresolved action has no targetPath. A built action has a targetPath. Use
path parameters only for the action's context values. Every action id is unique.

## Browser actions

Any element that should build or open a deferred feature must include
data-manifester-action="action-id". Put its values in a JSON object in
data-manifester-context. Example:

<button data-manifester-action="view-item"
  data-manifester-context='{"item_id":"A-100"}'>View details</button>

Keep each action attribute in page.html, including inside a template when rows
are added by page.js. Do not invent action IDs or add action attributes only in
JavaScript. Every action in app.json must appear in its source view.

## Route API

Browser code calls /api/app/<route-id>/<optional-path>. If api.mjs exists it
must export this function and must not import anything:

export async function handle(request, data) { return { status: 200, body: {} }; }

request contains method, path, query, params, and body. For a parameterized
page, call /api/app/<route-id> followed by location.pathname so params contains
the current route values. The supplied data API is:

- data.list(resourceId, { search?, offset?, limit? })
- data.get(resourceId, key)
- data.aggregate(resourceId, { operation, fieldId?, groupByFieldId? })
- data.create(resourceId, values)
- data.update(resourceId, key, values)
- data.delete(resourceId, key)

Every data call is asynchronous inside api.mjs. Always use await, or return a
data promise from a helper that the handle function awaits.

Return values use these exact shapes:

- list returns { records: [{ id, values }], total, limit, offset }
- get returns { id, values } or null
- aggregate returns { operation, fieldId, groupByFieldId, groups: [{ key, value }] }
- create and update return { id, values }
- delete returns true or false

id is Manifester's private row key. Values are inside values and use exact field
IDs. Never present the private row key as though it came from the source data.

Use only exact resource and field IDs from the supplied catalog. Local changes
never alter source files. Do not access files, processes, commands, or networks.
Save application data only through the supplied data API. Never use browser
storage for records, plans, assignments, or any other domain change. If the UI
says a change was saved, it must call data.create, data.update, or data.delete.

## Experience rules

- Make this application visually and structurally specific to its real domain.
- Build the natural application category indicated by the complete data shape.
  Keep every supplied resource and its records accessible from the home
  experience. A useful exception or insight may be prominent, but one record or
  value must not become the entire application.
- Do not default to a generic dashboard, admin template, or file viewer.
- Use no external packages, fonts, images, CDNs, or network calls.
- Put all JavaScript in page.js and all styling in page.css. Do not use inline
  scripts, inline styles, event-handler attributes, frames, or embedded objects.
- Make it responsive, keyboard-friendly, and clear without instructions.
- Use short everyday words. Never show technical builder or data-model terms.
- Write files directly. Do not use skills, plugins, MCP tools, memory, browsers,
  subagents, or start a server.
- Do not create your own generation loader. Manifester supplies the standard
  "Generating view..." message.
`.trim();

const reviewRequirements = `
Inspect every file created or changed by the generation. Review HTML, CSS,
browser JavaScript, server JavaScript, app.json, and their behavior together.
Compare every changed existing view with its established visual language. New
controls must reuse or deliberately extend its typography, spacing, colors,
borders, sizing, states, and responsive behavior. Never leave interactive
elements using unstyled browser defaults.

Trace the requested journey with representative supplied data. Every control
must perform the job its label promises. An edit view must expose every relevant
mutable value with an enabled, correctly typed control, preserve intentionally
locked source values, validate input, persist through the data API, and show
clear success and error states. Links must use safe application addresses, not
javascript URLs. Check loading, empty, success, and failure states, selector and
API consistency, keyboard use, and narrow layouts. Fix every issue you find and
finish only when the whole changed journey is coherent.
`.trim();

export function initialBuildPrompt(catalog: ProjectCatalog, discovery: DiscoveryResult): string {
  return `
You are the senior UX, system design, and implementation specialist for one
internal application build. Work directly in the current directory and create
every required file now. Do not only describe the work.

Create exactly one dataset-wide home route and no more than three of the most
useful deferred actions. Fully build the first screen and keep deeper features
unresolved for first use. For operational records, start with the natural
manager, tracker, planner, or catalog and make real local-data changes through
the supplied API. For analytical or reference data, preserve the corresponding
analysis or exploration job. Make it useful immediately and visually distinct
from applications for unrelated domains. Write the files before doing any
optional checks. Do not use a browser, start a server, or invoke another tool or
workflow to build the application. The host performs final validation.

${generatedAppContract}

DISCOVERY
${JSON.stringify(discovery)}

DATA CATALOG
${JSON.stringify(catalog.resources)}
`.trim();
}

export function initialReviewPrompt(validationIssue?: string): string {
  return `
Review and fix the initial generated application. Work directly in the current
generated application and finish the implementation, not an explanation.

${reviewRequirements}

HOST REVIEW
${validationIssue ?? "The structural checks passed. Find visual, data, navigation, and behavior problems they cannot identify."}

${generatedAppContract}
`.trim();
}

export function materialisePrompt(options: {
  action: AppAction;
  context: Record<string, string | number | boolean | null>;
  path: string;
  catalog: ProjectCatalog;
  discovery: DiscoveryResult;
}): string {
  return `
Build the requested feature in the current generated application now. Inspect
the existing source, add the smallest coherent set of route files and server
behavior, and update app.json. Do not only explain the change.

Preserve the action's id, source, resources, and context exactly. If the action
has context values, make the target route reusable with matching path
parameters. If it has no context values, use a literal route with no parameters.
Set this action's targetPath to that exact route path after the feature is
complete. Preserve the application's existing visual language while making the
new view fit its specific job.

CURRENT PATH
${options.path}

ACTION
${JSON.stringify(options.action)}

EXAMPLE CONTEXT
${JSON.stringify(options.context)}

DISCOVERY
${JSON.stringify(options.discovery)}

DATA CATALOG
${JSON.stringify(options.catalog.resources.filter(({ id }) => options.action.resourceIds.includes(id)))}

Use only the action's listed resources for this feature. Existing views may
keep using the resources they already declare.

${generatedAppContract}
`.trim();
}

export function materialiseReviewPrompt(options: {
  action: AppAction;
  path: string;
  validationIssue?: string;
}): string {
  return `
Review the just-created view for this action and fix every problem you find.
Work directly in the current generated application. Inspect app.json and the
new route's HTML, CSS, browser JavaScript, and optional API. Do not add another
route or action and do not change existing views.

Make sure the page has useful visible content after it loads, every initially
hidden application shell is explicitly revealed on success, every selector
used by JavaScript exists, empty and error states are visible, API addresses
match the route, and the supplied example can complete its initial data load.
Preserve the action's id, source, resources, and context exactly. Its targetPath
must exactly match the new route path. Use path parameters only for the action's
listed context values.
${reviewRequirements}

SOURCE PATH
${options.path}

ACTION
${JSON.stringify(options.action)}

HOST REVIEW
${options.validationIssue ?? "The structural checks passed. Look for rendering and behavior mistakes they cannot identify."}

${generatedAppContract}
`.trim();
}

export function materialiseRoutePrompt(options: {
  path: string;
  catalog: ProjectCatalog;
  discovery: DiscoveryResult;
}): string {
  return `
Build the view requested by this application address now. Inspect the existing
application, infer the user's intent from the complete address, application,
discovery, and data, then implement the smallest coherent feature. Do not only
explain the change.

Add a route that matches the requested address. Use a reusable parameterized
route when an address segment identifies a record or user-entered value. Treat
address values as visible business values, not Manifester's private row keys.
Use the data API to find the matching record safely.

Add a resolved action from every existing view that is materially affected by
the new capability. Update those views so the action is visible and useful. For
an item-level capability, add the control to each relevant item using its real
business value. Preserve every existing route and action entry exactly, retain
all existing behavior, and keep the application's visual language coherent.

REQUESTED ADDRESS
${options.path}

DISCOVERY
${JSON.stringify(options.discovery)}

DATA CATALOG
${JSON.stringify(options.catalog.resources)}

${generatedAppContract}
`.trim();
}

export function materialiseRouteReviewPrompt(options: {
  path: string;
  validationIssue?: string;
}): string {
  return `
Review and fix the feature created for this application address. Work directly
in the current generated application and finish the implementation, not an
explanation.

The requested address must render useful visible content and complete its first
data load. Preserve every previous route and action entry exactly. Keep the new
view linked through a resolved action on each affected existing view, with the
right context for every item. Inspect each affected existing view after adding
the control. Do not treat a visible business identifier as Manifester's private
row key, and reuse an equivalent existing route instead of duplicating it.

${reviewRequirements}

REQUESTED ADDRESS
${options.path}

HOST REVIEW
${options.validationIssue ?? "The structural checks passed. Look for rendering, data, navigation, and behavior mistakes they cannot identify."}

${generatedAppContract}
`.trim();
}

export function changePrompt(options: {
  instruction: string;
  catalog: ProjectCatalog;
  discovery: DiscoveryResult;
}): string {
  return `
Change the current generated application to satisfy the user's request. Inspect
the existing source and implement the feature completely. Keep the design
coherent, keep every existing useful feature working, update app.json, and do
not only describe the work.

USER REQUEST
${options.instruction}

DISCOVERY
${JSON.stringify(options.discovery)}

DATA CATALOG
${JSON.stringify(options.catalog.resources)}

${generatedAppContract}
`.trim();
}

export function changeReviewPrompt(options: {
  instruction: string;
  validationIssue?: string;
}): string {
  return `
Review and fix the generated application change. Work directly in the current
generated application and finish the implementation, not an explanation.

USER REQUEST
${options.instruction}

${reviewRequirements}

HOST REVIEW
${options.validationIssue ?? "The structural checks passed. Find visual, data, navigation, and behavior problems they cannot identify."}

${generatedAppContract}
`.trim();
}
