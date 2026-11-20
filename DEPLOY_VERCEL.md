# Deploy Nihongo N5 to Vercel

This project uses one Vercel FastAPI function for the API and Vercel's CDN for the HTML, CSS, JavaScript, data, and audio mounted by FastAPI. Local development uses SQLite. Production uses **Prisma Postgres from the Vercel Marketplace**—not Neon.

## 1. Push the project to GitHub

Do not commit `.env`, `venv/`, or `backend/*.sqlite3`; they are already ignored.

## 2. Import the repository into Vercel

Create a new Vercel project from the GitHub repository. Vercel reads `pyproject.toml`, detects FastAPI, and uses `backend.main:app` as the entrypoint.

## 3. Add Prisma Postgres

In the Vercel project dashboard:

1. Open **Storage** or **Marketplace**.
2. Choose **Prisma Postgres**.
3. Create and connect a free database to this project.
4. Confirm that Vercel added `DATABASE_URL`.
5. For production traffic, create a pooled Prisma connection string and add it as `DATABASE_URL_POOLED` when available.

## 4. Add the signing secret

Under **Project Settings → Environment Variables**, add:

```text
JLPT_SECRET_KEY=<a-long-random-value>
```

Generate one locally with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Apply database and secret variables to Production, Preview, and Development as needed. Never expose them with a public frontend prefix.

## 5. Deploy

Deploy from the Vercel dashboard, or authenticate the CLI and run:

```bash
npx vercel login
npx vercel
npx vercel --prod
```

After deployment:

```text
https://YOUR-PROJECT.vercel.app
https://YOUR-PROJECT.vercel.app/docs
https://YOUR-PROJECT.vercel.app/api/health
```

The first request creates the required database tables automatically. The frontend continues to save quiz state locally first, then synchronizes it to Prisma Postgres.
