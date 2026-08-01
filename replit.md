# YouChem Platform

A chemistry education platform (React + Express) for Mr. Ahmed's students. Supports student Google sign-in, profile completion, lessons, quizzes, homework, and PDF report generation.

## Stack
- **Frontend**: React 19, React Router v7, Tailwind CSS v4, Vite
- **Backend**: Express (TypeScript, tsx), served via Vite dev middleware in development
- **Auth**: Firebase Google OAuth (students) + JWT sessions; bcrypt for teacher login
- **Database**: JSON file store (`src/db/jsonStore.ts`) — no external DB required
- **PDF generation**: Puppeteer-core with Chromium on NixOS (path resolved automatically at startup)

## Running the app
```
pnpm install   # first time only
pnpm run dev   # starts Express + Vite dev server
```

The workflow **Start application** runs `pnpm run dev`.

## Firebase config
Stored in `firebase-applet-config.json` (public, non-secret Firebase web config).

## User preferences
- Uses **pnpm** for package management.
