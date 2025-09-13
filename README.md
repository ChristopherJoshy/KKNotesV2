# KKNotes V2 (Update of KKNotes)

A modern, fast notes and videos platform built with React (Vite) and an Express server, backed by Firebase Auth + Realtime Database + Storage. Includes an enhanced Admin Panel for content management, statistics, and user/admin roles.

Made by Christopher Joshy

## Features
- Browse by semester and subject (s1–s8)
- Global search with filters (semester, subject, type, sort)
- Notes and videos stored under nested RTDB paths; counters for downloads/views
- Admin panel: upload via URL, inline edit/move items, delete, statistics, manage admins/users
- Auth with Google; admin role detection with live updates

## Tech Stack
- Frontend: React 18, Vite, shadcn/Radix UI, Tailwind, React Query, Wouter
- Backend: Express + Vite dev middleware, TypeScript
- Data: Firebase Auth, Realtime Database, Storage

## Monorepo layout
- client/ — Vite app (entry: `client/index.html`, src in `client/src`)
- server/ — Express server (`server/index.ts`) serving API and client in prod
- shared/ — Shared TypeScript types (`shared/schema.ts`)

## Getting started
1) Install dependencies

```bash
npm install
```

2) Set environment variables (create `.env` in the repo root or supply via shell)

Required for client (Vite):
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_DATABASE_URL
- VITE_FIREBASE_MEASUREMENT_ID (optional)

3) Run in development (Express API + Vite dev server)

```bash
npm run dev
```

4) Build and start in production

```bash
npm run build
npm start
```

The server listens on PORT (defaults to 5000). In production, the client is built into `dist/public` and served by Express.

## Notes for admins
- Admin Portal is accessible from the avatar dropdown when logged in as an admin
- You can manage admins (add/remove; head admin protected), promote users, and edit/move content

## Contributing
- PRs welcome. Keep changes small and type-safe. Add tests where reasonable.

## License
MIT
