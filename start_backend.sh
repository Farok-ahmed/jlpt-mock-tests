#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -x "venv/bin/uvicorn" ]]; then
  echo "Installing backend dependencies..."
  venv/bin/pip install -r requirements.txt
fi

if [[ ! -f ".env" ]]; then
  SECRET="$(venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
  printf 'JLPT_SECRET_KEY=%s\n' "$SECRET" > .env
fi

exec venv/bin/uvicorn backend.main:app \
  --reload \
  --env-file .env \
  --host 127.0.0.1 \
  --port 8000
