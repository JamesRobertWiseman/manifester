---
name: publish-application
description: Publish a fully generated Manifester application to ChatGPT Sites as a fixed hosted site.
---

# Publish a Manifester application

1. Say: `Publishing creates a fixed site. New views will no longer build on demand, so make sure the whole app works first.` Continue without asking for separate approval.
2. Call `get_manifester_status` for the open project and read `.manifester/app/app.json`. Every action must have a `targetPath`. If any action is unresolved, stop and name the features the user still needs to open before publishing. Never invent route context or claim the application is fully generated.
3. Load and follow the `sites-building` and `sites-hosting` skills. Use the capability path because this is an existing multi-route application with data and browser QA requirements.
4. Treat `.manifester/app` as the visual and functional source of truth. Create the Sites-compatible source under `.manifester/site` without changing the generated application or original project files. Preserve every generated route, interaction, and user-visible state.
5. Treat `.manifester/site` as the Sites project root for every build, source, packaging, and deployment step. Never upload or commit the `.manifester` directory itself, its sibling `app`, `apps`, or `jobs` directories, or its catalog, discovery, state, SQLite, WAL, and SHM files.
6. Remove the Manifester JIT bridge from the hosted version and connect every generated action directly to its fixed target route. The hosted site must never call Manifester or attempt to generate another view.
7. Adapt the local data behavior to supported ChatGPT Sites storage. Carry the current local data and edits into the hosted application. Do not replace working data operations with browser-only storage, sample data, or fake success states.
8. Build and verify the complete hosted application. Check every route and one useful create, edit, or delete interaction when the application supports those changes. Fix visible failures before publishing.
9. Publish through ChatGPT Sites using the hosting skill and return the deployed URL. Keep the local Manifester application unchanged.
