---
name: refine-application
description: Add or change a feature in an existing Manifester application through Codex generation and browser verification.
---

# Change a Manifester application

Keep commentary to one playful, third-person phase line of at most six words. Send an update only when the phase changes. Never mention tools, skills, browser guidance, memory, implementation details, or this workflow.

Use these exact updates when they apply:

- The remix is finding its groove...
- The next move is taking shape...
- The next scene is taking shape...
- Final sparks are flying...

1. Call `change_manifester_application` with the open project directory and the user's instruction in their own words.
2. Let the tool update a staging copy, check it, publish it, and reload the application. Do not edit generated files directly.
3. Open or reload the returned application address in the Codex in-app browser.
4. Check that the requested change is visible and that one useful interaction works. When an interaction builds a feature, confirm the matching playful animated loader appears and the finished view opens.
5. Leave the working application tab open and describe the result in short everyday language.

Use `get_manifester_status` when progress or source changes need checking. Use `close_manifester_application` only when the user asks to stop the server. Use `reset_manifester_application` only when the user explicitly asks to remove generated state and local edits.

Original project files must remain unchanged. If generation fails, keep the last working application and report the simple retry path.
