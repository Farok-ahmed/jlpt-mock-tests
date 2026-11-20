"""SQLite locally and serverless PostgreSQL on Vercel."""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


DEFAULT_DATABASE = (
    Path("/tmp/nihongo-n5.sqlite3")
    if os.getenv("VERCEL") == "1"
    else Path(__file__).resolve().parent / "jlpt.sqlite3"
)
DATABASE_PATH = Path(os.getenv("JLPT_DATABASE_PATH", DEFAULT_DATABASE))
DATABASE_URL = os.getenv("DATABASE_URL_POOLED") or os.getenv("DATABASE_URL", "")
USING_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))


class DuplicateUserError(Exception):
    """Raised when an email address already exists."""


def _sql(query: str) -> str:
    return query.replace("?", "%s") if USING_POSTGRES else query


@contextmanager
def connection() -> Iterator[Any]:
    if USING_POSTGRES:
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10) as database:
            yield database
            database.commit()
        return

    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    database = sqlite3.connect(DATABASE_PATH, timeout=10)
    database.row_factory = sqlite3.Row
    database.execute("PRAGMA foreign_keys = ON")
    try:
        yield database
        database.commit()
    finally:
        database.close()


SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        test_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS attempts_user_date
    ON attempts(user_id, submitted_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS progress (
        user_id TEXT NOT NULL,
        test_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, test_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
)


def initialize() -> None:
    with connection() as database:
        for statement in SCHEMA:
            database.execute(statement)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with connection() as database:
        row = database.execute(
            _sql("SELECT * FROM users WHERE lower(email) = lower(?)"),
            (email,),
        ).fetchone()
    return dict(row) if row else None


def get_user(user_id: str) -> dict[str, Any] | None:
    with connection() as database:
        row = database.execute(_sql("SELECT * FROM users WHERE id = ?"), (user_id,)).fetchone()
    return dict(row) if row else None


def create_user(user: dict[str, Any]) -> None:
    try:
        with connection() as database:
            database.execute(
                _sql("INSERT INTO users(id, name, email, password_hash, created_at) VALUES(?, ?, ?, ?, ?)"),
                (user["id"], user["name"], user["email"], user["password_hash"], user["created_at"]),
            )
    except Exception as error:
        is_sqlite_duplicate = isinstance(error, sqlite3.IntegrityError)
        is_postgres_duplicate = getattr(error, "sqlstate", "") == "23505"
        if is_sqlite_duplicate or is_postgres_duplicate:
            raise DuplicateUserError from error
        raise


def list_attempts(user_id: str) -> list[dict[str, Any]]:
    with connection() as database:
        rows = database.execute(
            _sql("SELECT payload FROM attempts WHERE user_id = ? ORDER BY submitted_at DESC"),
            (user_id,),
        ).fetchall()
    return [json.loads(row["payload"]) for row in rows]


def save_attempt(user_id: str, attempt: dict[str, Any]) -> None:
    payload = dict(attempt)
    payload["userId"] = user_id
    with connection() as database:
        database.execute(
            _sql(
                """
                INSERT INTO attempts(id, user_id, test_id, payload, submitted_at)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload = excluded.payload,
                    submitted_at = excluded.submitted_at
                WHERE attempts.user_id = excluded.user_id
                """
            ),
            (
                payload["id"],
                user_id,
                payload["testId"],
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                payload["submittedAt"],
            ),
        )


def get_progress(user_id: str, test_id: str) -> dict[str, Any] | None:
    with connection() as database:
        row = database.execute(
            _sql("SELECT payload FROM progress WHERE user_id = ? AND test_id = ?"),
            (user_id, test_id),
        ).fetchone()
    return json.loads(row["payload"]) if row else None


def save_progress(user_id: str, test_id: str, state: dict[str, Any], updated_at: str) -> None:
    payload = dict(state)
    payload["userId"] = user_id
    payload["testId"] = test_id
    with connection() as database:
        database.execute(
            _sql(
                """
                INSERT INTO progress(user_id, test_id, payload, updated_at)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(user_id, test_id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                """
            ),
            (
                user_id,
                test_id,
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                updated_at,
            ),
        )


def delete_progress(user_id: str, test_id: str) -> None:
    with connection() as database:
        database.execute(
            _sql("DELETE FROM progress WHERE user_id = ? AND test_id = ?"),
            (user_id, test_id),
        )
