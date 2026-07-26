# YouChem Platform

An Arabic-language education platform ("منصة يوتشيم") for secondary-school chemistry lessons, imported from Google AI Studio. Students pick their grade, unlock lessons with teacher-issued access codes, watch YouTube/Vimeo videos, and pass quizzes to progress. Teachers manage lessons, quizzes, students, and access codes from a dashboard.

## Stack
- **Frontend:** React 19 + React Router 7, Vite 6, Tailwind CSS 4
- **Backend:** Express (server.ts), served together with Vite in one process
- **Database:** a single JSON file at `data/db.json` (not committed to git — contains student PII), read/written through `src/db/jsonStore.ts`. Holds `users`, `lessons`, `quizzes`, `codes`, `studentLessonAccess`. No Postgres/Drizzle anymore — that layer was fully removed.
- **Auth:**
  - Teachers: password login → JWT cookie (`server.ts`).
  - Students: Google sign-in. Frontend uses the Firebase client SDK (`src/lib/firebase.ts`, config in `firebase-applet-config.json` — public client config, not secret) to run `signInWithPopup`, then sends the Google ID token to `POST /api/student/google-login`, which verifies it server-side with `google-auth-library`'s `OAuth2Client.verifyIdToken` (audience = the Firebase project's OAuth web client ID) and issues a JWT cookie. Students with any missing or invalid profile field are prompted to complete it via `POST /api/student/complete-profile` every time they reopen the app. Names must be longer than 8 characters, both phone numbers must be exactly 11 digits beginning with `01`, and grade is required.
  - **Registration validation:** the server requires a name with at least 8 letters, two phone numbers with exactly 11 digits beginning with `01`, a school, and a grade. The form warns that invalid data closes the account and blocks the device. Arabic-Indic phone digits are normalized before saving.
  - **Incomplete profiles:** any student whose saved profile is missing or invalid is sent back to the profile-completion page on every visit and is denied access to student content until the submitted data passes server validation and is saved to that student's record.
  - **Blocking:** teachers block both the student account and its registered browser/device identifier. A blocked account is rejected immediately, and blocked device identifiers remain rejected even if the account is deleted. Browser storage can be cleared or a different browser/device can be used, so device blocking is an additional layer rather than a cryptographic hardware ban.
  - **Other integrations referenced but not yet wired up:** Google Gemini (`@google/genai`), Vimeo TUS uploads — no server code currently calls these, they're leftover from the AI Studio scaffold

## Running the app
- Workflow **"Start application"** runs `pnpm run dev` (tsx server.ts), serving on port 5000. Deployment build/run also use `pnpm` (`pnpm run build` / `pnpm run start`).
- Default teacher login password used by `server.ts` is a hardcoded value (`port5`) — should be replaced with a real credential/secret before going live.
- `data/db.json` is created automatically on first run if missing; back it up before making risky changes since it's the only copy of lesson/quiz/student data.

## Changes (July 22, 2026)
- **Lesson-specific codes enforced:** Codes with a `lessonId` can now only unlock that exact lesson. `/api/student/validate-code` and `/api/student/exam/unlock` both reject codes used on the wrong lesson. The Codes dashboard UI now requires selecting a lesson before generating (dropdown changed to "مطلوب").
- **Grades pages removed:** "درجات الواجبات" and "درجات الامتحانات" dashboard tabs removed. The files `HomeworkGrades.tsx` and `QuizGrades.tsx` are deleted; the server API endpoints remain but are unused.
- **File storage in production:** `server.ts` and `jsonStore.ts` now default to `/app/data` when `NODE_ENV=production` and no other path env var is set (was `./data`). Dev still uses `./data`. Set `DATA_DIR` env var to override on any platform.
- **Viewing-time heartbeat:** `LessonView.tsx` sends `POST /api/student/lesson-heartbeat` every 60 seconds while a student with access is on a lesson page. Each call increments `viewingMinutes` on the `DbStudentLessonAccess` record server-side.
- **Student Files tab:** New dashboard tab "ملفات الطلاب" (`/youchem/student-files`, `src/pages/dashboard/StudentFiles.tsx`). Teacher can search/filter students, expand any student to see: profile info, minutes spent per lesson, quiz scores, homework scores. Each student has a download button that fetches a UTF-8 CSV file (BOM-prefixed, Excel-compatible with Arabic) containing all their activity data.

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

## Notes from re-import setup (July 13, 2026, later same day)
- Project was re-imported into a fresh environment (empty `node_modules`, no secrets carried over). Ran `pnpm install`, asked the user for `TEACHER_PASSWORD` again (secrets don't survive environment recreation), and restarted the workflow. App verified running: login screen renders correctly with the Google sign-in button.
- The two 401s seen in the browser console on first load are expected — they're auth-check calls (e.g. session/profile check) firing before the user signs in.

## Notes on Google sign-in setup (July 13, 2026)
- The original `firebase-applet-config.json` pointed at an AI-Studio-provisioned Firebase project (`iconic-academy-n07pf`) on the locked "Starter Tier" — nobody has edit access to it (Authentication → Settings shows "ask a project owner for the necessary permission", no Add-domain button), so the Replit dev domain could never be authorized and Google sign-in always failed with a generic error.
- Fixed by pointing the app at a new Firebase project the user actually owns (`youchem-platform`): replaced `firebase-applet-config.json` with its config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, oAuthClientId), enabled the Google sign-in provider there, and added the Replit dev domain to that project's Authorized domains.
- `oAuthClientId` in `firebase-applet-config.json` is the Google **Web client ID** (`...apps.googleusercontent.com`) found under Firebase Authentication → Sign-in method → Google → Web SDK configuration — it's the audience `server.ts` uses to verify Google ID tokens via `google-auth-library`. It must match whichever Firebase project's Google provider issued the token.
- If the Replit dev domain ever changes (e.g. new Repl, or after publishing), the new domain must be added again under Authentication → Settings → Authorized domains in the `youchem-platform` Firebase project, or Google sign-in will fail the same way.

## User preferences
- Communicate in Arabic when the user writes in Arabic.

## Notes on profile draft saving (July 26, 2026)
- Student profile fields are saved automatically while the completion form is being filled. The browser keeps a local draft and the server stores incomplete values through `POST /api/student/profile-draft`, so closing a tab no longer discards entered data.
- The form also sends a final `keepalive` request when the document becomes hidden or the tab is closed, then removes the local draft after the profile is completed successfully.
