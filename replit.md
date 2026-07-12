# YouChem Platform

An Arabic-language education platform ("منصة يوتشيم") for secondary-school chemistry lessons, imported from Google AI Studio. Students pick their grade, unlock lessons with teacher-issued access codes, watch YouTube/Vimeo videos, and pass quizzes to progress. Teachers manage lessons, quizzes, students, and access codes from a dashboard.

## Stack
- **Frontend:** React 19 + React Router 7, Vite 6, Tailwind CSS 4
- **Backend:** Express (server.ts), served together with Vite in one process
- **Database:** PostgreSQL via Drizzle ORM (Replit's built-in database) — schema in `src/db/schema.ts`
- **Auth:** JWT cookies for teacher/student sessions (`server.ts`)
- **Other integrations referenced but not yet wired up:** Google Gemini (`@google/genai`), Firebase, Vimeo TUS uploads — no server code currently calls these, they're leftover from the AI Studio scaffold

## Running the app
- Workflow **"Start application"** runs `npm run dev` (tsx server.ts), serving on port 5000.
- Drizzle schema is pushed to the dev database with `npx drizzle-kit push --force` (already applied); rerun after schema changes in `src/db/schema.ts`.
- Default teacher login password used by `server.ts` is a hardcoded value (`port5`) — should be replaced with a real credential/secret before going live.

## Notes from import setup (July 2026)
- Fixed a bug where `src/db/index.ts` connected using unset `SQL_HOST`/`SQL_USER`/`SQL_PASSWORD`/`SQL_DB_NAME` vars; it now uses Replit's `DATABASE_URL`.
- Changed the server port from a hardcoded 3000 to 5000 (via `process.env.PORT` fallback) to match Replit's webview requirement.
- `JWT_SECRET` secret has not been set yet — the app currently falls back to an insecure default string baked into `server.ts`. Set it as a Replit secret before relying on auth in any real deployment.
- `GEMINI_API_KEY` and `VIMEO_ACCESS_TOKEN` are not required to run the app today (no server code calls those APIs yet), but the frontend references a `/api/vimeo/init` endpoint that doesn't exist in `server.ts` — Vimeo uploads are not functional.

## User preferences
- Communicate in Arabic when the user writes in Arabic.
