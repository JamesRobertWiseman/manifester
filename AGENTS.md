# Repository Rules

- Treat this repository as a PNPM workspace monorepo.
- Keep production source in the appropriate package under `packages/`.
- Use Vite as the production builder for every package and generated runtime artifact.
- Keep distributable artifacts under the root `dist/` directory, grouped by runtime.
- Keep only simple repository helpers as standalone files under `scripts/`.
- Remove code, files, dependencies, and compatibility paths as soon as a change makes them redundant.
- Never leave dead code in the repository.
- Keep code consice and readable.
- Use separation of concerns and single responsibility principles in code design.
- Organize code into modules and packages based on functionality and purpose.
