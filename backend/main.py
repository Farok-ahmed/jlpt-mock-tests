"""FastAPI server for Nihongo N5 authentication and cloud progress sync."""

from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import database
from .security import create_access_token, decode_access_token, hash_password, verify_password


ROOT = Path(__file__).resolve().parent.parent
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
bearer = HTTPBearer(auto_error=False)


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class LoginInput(BaseModel):
    email: str
    password: str


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "createdAt": user["created_at"],
    }


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    payload = decode_access_token(credentials.credentials)
    user = database.get_user(str(payload.get("sub"))) if payload else None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")
    return user


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.initialize()
    yield


app = FastAPI(
    title="Nihongo N5 API",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(values: RegisterInput) -> dict[str, Any]:
    email = values.email.strip().lower()
    name = values.name.strip()
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Enter at least 2 characters for your name.")
    if database.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    now = datetime.now(timezone.utc).isoformat()
    user = {
        "id": f"user-{uuid.uuid4()}",
        "name": name,
        "email": email,
        "password_hash": hash_password(values.password),
        "created_at": now,
    }
    try:
        database.create_user(user)
    except database.DuplicateUserError as error:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    return {"user": public_user(user), "token": create_access_token(user["id"])}


@app.post("/api/auth/login")
def login(values: LoginInput) -> dict[str, Any]:
    user = database.get_user_by_email(values.email.strip().lower())
    if not user:
        raise HTTPException(status_code=404, detail="No account was found for this email.")
    if not verify_password(values.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    return {"user": public_user(user), "token": create_access_token(user["id"])}


@app.get("/api/auth/me")
def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {"user": public_user(user)}


@app.get("/api/attempts")
def attempts(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {"attempts": database.list_attempts(user["id"])}


@app.post("/api/attempts", status_code=status.HTTP_201_CREATED)
def create_attempt(
    attempt: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, bool]:
    required = ("id", "testId", "submittedAt", "answers")
    if any(key not in attempt for key in required):
        raise HTTPException(status_code=422, detail="Attempt payload is incomplete.")
    database.save_attempt(user["id"], attempt)
    return {"saved": True}


@app.get("/api/progress/{test_id}")
def progress(test_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {"state": database.get_progress(user["id"], test_id)}


@app.put("/api/progress/{test_id}")
def update_progress(
    test_id: str,
    state: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, bool]:
    updated_at = datetime.now(timezone.utc).isoformat()
    database.save_progress(user["id"], test_id, state, updated_at)
    return {"saved": True}


@app.delete("/api/progress/{test_id}")
def remove_progress(test_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, bool]:
    database.delete_progress(user["id"], test_id)
    return {"deleted": True}


app.mount("/css", StaticFiles(directory=ROOT / "css"), name="css")
app.mount("/js", StaticFiles(directory=ROOT / "js"), name="js")
app.mount("/data", StaticFiles(directory=ROOT / "data"), name="data")
app.mount("/audio", StaticFiles(directory=ROOT / "audio"), name="audio")


@app.get("/", include_in_schema=False)
def frontend() -> FileResponse:
    return FileResponse(ROOT / "index.html")
