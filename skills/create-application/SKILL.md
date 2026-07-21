---
name: create-application
description: Discover a project and open a useful local application through automatic Codex design, generation, and browser verification.
---

# Create a Manifester application

## User updates

Keep commentary to one plain status line of at most six words. Send an update only when the phase changes. Never mention tools, skills, browser guidance, memory, implementation details, or this workflow. The linked progress update below is the only exception.

Use these exact updates when they apply:

- Assessing your project
- Discovering data structure and relationships
- Deciding on the optimal structure
- Designing your user interface
- Starting your application
- Checking everything works

1. Call `open_manifester_application` with the open project directory. Include a port only when the user requests one.
2. The tool returns `openInBrowser` and `manager.openInBrowser` immediately. Open both addresses in separate Codex in-app browser tabs without announcing the browser step or waiting for generation to finish.
3. When the application status is `generating`, send exactly: `Your application is being created. [View progress in Manifester](http://127.0.0.1:4316).`
4. Leave both tabs open. The application tab changes as Manifester inspects the files, understands the project, designs the application, and starts it. It reloads itself when the application is ready. Do not call the open tool again while generation is active.
5. If discovery confidence is below 65 percent, let the tool ask up to three short questions through Codex's native question form. Do not repeat the questions in chat or ask for separate build approval.
6. Wait for the progress page to become the finished application. Use `get_manifester_status` only when the page reports a failure or does not change for several minutes.
7. If creation fails, stop waiting, do not call the open tool again, and tell the user that the manager contains the failure details.
8. Check that the home page renders and that one useful interaction on that page works. Do not choose an unresolved Manifester action during initial creation. Deeper pages and routes must remain unbuilt until the user chooses them in normal use.
9. Leave the working application and manager tabs open and tell the user what was created in no more than two short sentences using everyday language.
10. End with: `Manage your apps at http://127.0.0.1:4316, or use mnf dash start|stop|restart|status|open from any terminal.`

Original project files must remain unchanged. All generated files and local edits belong under `.manifester`.
