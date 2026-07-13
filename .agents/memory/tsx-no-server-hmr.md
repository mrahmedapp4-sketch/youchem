---
name: tsx dev server has no hot-reload
description: Projects that run `tsx server.ts` (no --watch) for their dev workflow do not reload on server-side code changes; only Vite's frontend HMR fires.
---

When a project's dev script is exactly `tsx server.ts` (check `package.json` `"dev"` script), editing `server.ts` or any file it imports (e.g. a `src/db/*` data layer) has no effect until the workflow is restarted. The Vite client log showing "page reload" / "hmr update" after such an edit is misleading — that's the frontend dev server reacting to the file watcher, not the backend process picking up the change.

**Why:** `tsx` without `--watch` runs once and exits when the process is killed; it does not restart itself on file changes. This caused new Express routes to 404 in testing even though the code looked correct — the running process was still the pre-edit version.

**How to apply:** After any edit to server-side files in such a project, restart the workflow (e.g. via `WorkflowsRestart`) before testing the change with curl or a screenshot. If this keeps causing friction, consider proposing `tsx watch server.ts` as a follow-up (only if the user agrees — some AI Studio exports intentionally disable watching to avoid flicker during agent edits, see `DISABLE_HMR` in `vite.config.ts`).
