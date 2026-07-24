---
name: Workspace pnpm shadowing
description: A locally installed pnpm can shadow the Replit-provided pnpm and require a newer Node runtime.
---

The project should use Replit's system pnpm when the workspace runs Node 20. A package-manager install can create `node_modules/.bin/pnpm` or a project dependency that takes precedence and may require Node 22+, causing even ordinary `pnpm run` commands to fail before the app starts.

**Why:** The imported project already has a compatible pnpm in the Replit environment; adding another copy creates an avoidable runtime mismatch.

**How to apply:** If pnpm suddenly reports an unsupported Node version after dependency setup, inspect `type -a pnpm` and remove only the accidental local pnpm shim/dependency rather than changing the project's Node version.