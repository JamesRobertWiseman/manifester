# Manifester

> One prompt turns project data into a local app that grows as you use it.

Manifester is a Codex plugin that turns the files and data in a project into a useful local application. It uses the signed-in Codex session, needs no OpenAI API key, and leaves the original project files alone.

I built Manifester around a simple idea: give AI your data, context, and intent, and it should build the application you need. No screens or features have to be planned upfront. 


Manifester is intended to server as a proof of concept for the ultimate abstraction in software development, where the user provides the data and intent, and AI builds the application as you need it.


## What it does

- Understands the data and context in a project.
- Builds a tailored starting application instead of using a fixed dashboard template.
- Adds deeper features when you first use them or visit a new safe URL.
- Reuses an existing matching route instead of generating the same feature again.
- Saves application changes locally without changing the source data.
- Shows generation, failures, activity, and running applications in the React Manifester Dashboard.
- Prepares completed applications for publishing to ChatGPT Sites.

## Quick start

### Requirements

- Node.js 24 or later
- Latest ChatGPT Codex app or CLI installed and signed in

### Install


In your terminal run:
```sh
codex plugin marketplace add https://github.com/JamesRobertWiseman/manifester.git
```

Then add the Manifester plugin:

```sh
codex plugin add manifester@manifester
```

Restart Codex or open a new Codex task so the plugin is loaded.

### Usage

1. Open a project folder that contains any common data file type: CSV, JSON, XLSX, or XLSM. 

> [!IMPORTANT]
> Manifester ignores generated folders, secrets, source-control internals, and unsupported large files.

2. Ask:
> Create the most useful application for the data in this project.

3. Watch the Manifester Dashboard at `http://localhost:4316`. The application appears there as soon as generation starts and opens automatically when ready.
4. Explore the generated application. The first use builds and reviews the feature. Later uses open it immediately.
5. Try visiting a new safe URL. If no matching route exists, Codex generates the smallest useful addition, reviews it, and publishes it if valid.

Generation uses your Codex session and can take a few minutes. Progress and failures stay visible in the Dashboard.

> [!INFO]
> ChatGPT-5.6-Sol with "High" reason effort is recommended for the best balance between performance and quality.

## Manually Refine an Application

Open the original project folder in Codex and describe the change in everyday language. For example:

> Add a calendar view for upcoming work.

Manifester updates a staging copy, checks and reviews the change, publishes it, and reloads the running application. If the change fails, the last working version stays available and the failure is shown in the Dashboard.

Keep refining the application the same way as your needs change. Do not edit files under `.manifester/app` directly because they are generated and may be replaced.

## Sample Projects

| Project | Data | What it demonstrates |
| --- | --- | --- |
| `examples/task-management` | `tasks.csv` | Generation, first-use features, editing, and restart persistence |

## How it works

1. Manifester finds the useful files in the project and ignores generated folders, secrets, source-control internals, and unsupported large files.
2. GPT-5.6 uses a read-only, network-disabled Codex task to understand the data, its relationships, the likely user, and the most useful workflow.
3. If the intent is unclear, Codex asks up to three short questions. Otherwise it continues automatically.
4. A separate workspace-limited Codex task builds the starting application in staging.
5. Manifester checks the generated HTML, CSS, JavaScript, data access, and routes before publishing the application locally.
6. Later actions and new safe URLs first look for a matching route. If none exists, Codex builds the smallest useful addition, repairs structural issues, runs a separate quality review, and publishes only the valid result.

Generated applications live under `.manifester/app`. Their local data is stored in `.manifester/data.sqlite`.

## How I used Codex and GPT-5.6

GPT-5.6 is part of the product, not just a development tool. It:

- Interprets unfamiliar project data.
- Chooses an application shape that fits the real workflow.
- Generates the starting experience.
- Builds and reviews new features from demonstrated user intent.

Codex provides the signed-in runtime, isolated tasks, native questions, plugin skills, MCP tools, and continuity between changes. No separate API account or key is needed.

I also used Codex throughout development to refactor the project into a focused PNPM monorepo, separate the plugin runtimes, diagnose lifecycle failures, tighten generated-application boundaries, exercise the Dashboard and applications in a real browser, and repeat packaging and installation checks.

The most important product decision was not to generate every possible screen upfront. Manifester starts with something useful, learns from what the user actually tries to do, and grows the application from there.

## Local data and safety

- CSV, JSON, XLSX, and XLSM tables are copied into local SQLite.
- Original project files stay read-only.
- Create, edit, and delete operations affect only the local copy.
- Local changes survive application and Dashboard restarts.
- Discovery and generation run without network access.
- New output is reviewed and validated before it replaces the working application.
- A changed source file blocks stale local data instead of silently continuing.
- Failed generation leaves the last working application available.

## Dashboard

Codex starts the Manifester Dashboard automatically at `http://localhost:4316`. It shows applications while they are being created, keeps failed attempts visible, records activity, and provides start, stop, restart, remove, delete, and publishing controls.

Removing an application from the Dashboard keeps its generated files and local data. Permanent deletion removes the project's complete `.manifester` folder only after confirmation.

## CLI

The plugin also installs the optional `mnf` cli tool:

```sh
mnf dash status ## Shows the Dashboard's current status
mnf dash start ## Starts the dashboard if it is not running
mnf dash stop ## Stops the dashboard if it is running
mnf dash restart ## Restarts the dashboard
mnf dash open
```



## Publish to ChatGPT Sites

When every deferred feature has been opened and reviewed, ask Codex:

> Publish this app to ChatGPT Sites.

The hosted result is a fixed site and does not generate new views on demand. Only the prepared `.manifester/site` project is published. The SQLite database and Manifester's internal working files stay local.

## Development

Development requires Node.js 24 or later and PNPM 11.13.0.

Install dependencies, check the source, and build every runtime:

```sh
pnpm clean:install
```

After making changes, run:

```sh
pnpm verify
```

All production source lives under `packages/`:

| Package | Purpose |
| --- | --- |
| `plugin` | Shared application, discovery, data, generation, and runtime logic |
| `mcp` | Codex MCP server |
| `server` | Dashboard API and React interface |
| `cli` | `mnf` command |
| `api-runner` | Isolated generated-route API runner |

Vite builds and minifies every distributable under the root `dist/` directory. Root `scripts/` contains only small repository helpers. Generated files should not be edited directly.
