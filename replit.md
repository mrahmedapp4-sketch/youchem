# YouChem Platform

An Arabic-language education platform ("منصة يوتشيم") for secondary-school chemistry lessons, imported from Google AI Studio. Students pick their grade, unlock lessons with teacher-issued access codes, watch YouTube/Vimeo videos, and pass quizzes to progress. Teachers manage lessons, quizzes, students, and access codes from a dashboard.

## Stack
- **Frontend:** React 19 + React Router 7, Vite 6, Tailwind CSS 4
- **Backend:** Express (server.ts), served together with Vite in one process
- **Database:** a single JSON file at `data/db.json` (not committed to git — contains student PII), read/written through `src/db/jsonStore.ts`. Holds `users`, `lessons`, `quizzes`, `codes`, `studentLessonAccess`. No Postgres/Drizzle anymore — that layer was fully removed.
- **Auth:**
  - Teachers: password login → JWT cookie (`server.ts`).
  - Students: Google sign-in. Frontend uses the Firebase client SDK (`src/lib/firebase.ts`, config in `firebase-applet-config.json` — public client config, not secret) to run `signInWithPopup`, then sends the Google ID token to `POST /api/student/google-login`, which verifies it server-side with `google-auth-library`'s `OAuth2Client.verifyIdToken` (audience = the Firebase project's OAuth web client ID) and issues a JWT cookie. First-time students are prompted to complete their profile (phone, school, grade) via `POST /api/student/complete-profile`.
- **Other integrations referenced but not yet wired up:** Google Gemini (`@google/genai`), Vimeo TUS uploads — no server code currently calls these, they're leftover from the AI Studio scaffold

## Running the app
- Workflow **"Start application"** runs `npm run dev` (tsx server.ts), serving on port 5000.
- Default teacher login password used by `server.ts` is a hardcoded value (`port5`) — should be replaced with a real credential/secret before going live.
- `data/db.json` is created automatically on first run if missing; back it up before making risky changes since it's the only copy of lesson/quiz/student data.

## Notes from import setup (July 13, 2026)
- `TEACHER_PASSWORD` secret is now set (server.ts throws on boot without it). `JWT_SECRET` still falls back to `SESSION_SECRET` if unset.
- App verified running and reachable (login screen renders, Google sign-in button present).
- **tsx does not hot-reload server-side code.** `npm run dev` runs `tsx server.ts` with no `--watch`; editing `server.ts` or files it imports (e.g. `src/db/jsonStore.ts`) requires restarting the "Start application" workflow to take effect. Only frontend files get Vite HMR.
- Added a quiz-results feature: `/api/student/submit-quiz` now returns a per-question `results` array (student answer, correct answer, right/wrong), shown to the student immediately after submitting in `src/pages/LessonView.tsx`.
- Added a homework feature (bubble-sheet PDF homework): teachers upload a PDF + set question count + per-question answer key (A/B/C/D) from a new "الواجبات" dashboard tab (`src/pages/dashboard/Homework.tsx`, `/youchem/homework`). Students see the section on their lesson page, download the PDF, pick an answer per question number, and get instant score + right/wrong feedback (`/api/student/homework/:lessonId`, `/api/student/submit-homework`). PDFs are stored on disk under `data/uploads/homeworks/` (uses `multer`) and served at `/uploads/homeworks/*`. One homework per lesson; deleting a lesson also deletes its homework file/record.

## Notes from import setup (July 2026)
- Fixed a bug where `src/db/index.ts` connected using unset `SQL_HOST`/`SQL_USER`/`SQL_PASSWORD`/`SQL_DB_NAME` vars; it now uses Replit's `DATABASE_URL`. (This file no longer exists — superseded by the JSON migration below.)
- Changed the server port from a hardcoded 3000 to 5000 (via `process.env.PORT` fallback) to match Replit's webview requirement.
- `JWT_SECRET` secret has not been set yet — the app currently falls back to an insecure default string baked into `server.ts`. Set it as a Replit secret before relying on auth in any real deployment.
- `GEMINI_API_KEY` and `VIMEO_ACCESS_TOKEN` are not required to run the app today (no server code calls those APIs yet), but the frontend references a `/api/vimeo/init` endpoint that doesn't exist in `server.ts` — Vimeo uploads are not functional.
- Migrated all data storage from PostgreSQL/Drizzle to a JSON file (`data/db.json`) and removed `drizzle-orm`, `drizzle-kit`, `pg` entirely — the app has no database dependency now. The Replit Postgres database itself was left untouched (not deleted), just unused.
- Replaced the old scratch-card/name-entry student flow (`StudentLogin.tsx`, dead code, never routed) with real Google sign-in. The AI Studio export had already baked a working Firebase Web App config into `firebase-applet-config.json`, including the Google OAuth web client ID, so no new secrets were needed for this.

## User preferences
- Communicate in Arabic when the user writes in Arabic.
