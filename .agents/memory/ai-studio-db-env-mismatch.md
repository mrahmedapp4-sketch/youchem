---
name: AI Studio import DB env mismatch
description: Projects exported from Google AI Studio with Drizzle+Postgres often reference SQL_HOST/SQL_USER/SQL_PASSWORD/SQL_DB_NAME env vars that are never set, instead of DATABASE_URL.
---

When setting up an imported AI Studio project that uses Drizzle ORM with `pg`, check `src/db/index.ts` (or equivalent) for a `Pool` config referencing `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`. These are leftover from AI Studio's own Cloud SQL scaffold and are never set in Replit — the pool silently fails to connect, or the app falls back to mock empty data.

**Why:** The project's own `drizzle.config.ts` at the repo root usually already correctly uses `DATABASE_URL` (Replit's runtime-managed env var), while a duplicate/stale `drizzle.config.ts` and the actual runtime `Pool` in `src/db/index.ts` still use the old `SQL_*` vars. It's an inconsistency baked into the export, not something the user asked for.

**How to apply:** Point the `Pool` constructor at `connectionString: process.env.DATABASE_URL` instead of individual `SQL_*` fields. Also check any "is DB configured" guard (e.g. `if (!process.env.SQL_HOST) { use mock data }`) and switch it to check `DATABASE_URL` too, or the app will keep silently serving empty mock data even after the fix.
