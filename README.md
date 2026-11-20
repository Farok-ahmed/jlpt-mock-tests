# Nihongo N5 Mock Tests

A mobile-first JLPT N5 practice platform with timed mock tests, audio listening, multi-speaker dialogue clips, shadowing and voice recording, detailed results, weak-point analytics, achievements, and offline-first cloud synchronization.

## Stack

- Plain HTML, CSS, and vanilla JavaScript
- FastAPI backend
- SQLite for local development
- Prisma Postgres for Vercel production

## Local frontend only

Open `index.html`. Authentication and progress use localStorage when the backend is unavailable.

## Local full stack

```bash
./start_backend.sh
```

Then open:

- App: http://127.0.0.1:8000
- API docs: http://127.0.0.1:8000/docs

## Vercel

See [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md). The Vercel Marketplace Prisma Postgres integration provides production persistence without Neon.
