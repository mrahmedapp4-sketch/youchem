# YouChem Platform

## Overview

YouChem is a React/Vite and Express learning platform for chemistry students. It includes Google student sign-in, a teacher dashboard, lessons, quizzes, homework, student files, and a JSON file-backed data store.

## Running locally on Replit

- Install dependencies with `pnpm install`.
- Start the app with `pnpm run dev`.
- The app serves the Replit preview on port 5000.
- `SESSION_SECRET` is required by the server for signing authentication tokens.

## Recent product behavior

- Teachers can use **درجات الامتحان** in the dashboard to search for a student by name, email, or phone number, record a confirmed exam score out of 60, and publish it.
- Students see an automatic result notice after entering the platform when a teacher has published a confirmed grade. The percentage is calculated by the server.