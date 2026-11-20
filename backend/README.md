# Python backend

The frontend still saves quiz state to `localStorage` immediately. Locally, authentication, attempts, and progress synchronize to SQLite. On Vercel, `DATABASE_URL_POOLED` or `DATABASE_URL` switches the same data layer to Prisma Postgres automatically.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export JLPT_SECRET_KEY="replace-with-a-long-random-secret"
uvicorn backend.main:app --reload
```

Open `http://127.0.0.1:8000`. API documentation is available at `http://127.0.0.1:8000/docs`.

For later development sessions, the convenience script installs missing dependencies, creates a local secret when needed, and starts the server:

```bash
./start_backend.sh
```

The database defaults to `backend/jlpt.sqlite3`. Set `JLPT_DATABASE_PATH` to use another location. For production, use a strong secret, HTTPS, restricted CORS origins, PostgreSQL, backups, and rate limiting.

See `DEPLOY_VERCEL.md` for the Vercel + Prisma Postgres deployment flow.
