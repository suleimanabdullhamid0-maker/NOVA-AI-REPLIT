from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg
import httpx
from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DATABASE_URL = os.environ.get("DATABASE_URL")
ADMIN_EMAIL = "suleimanabdullhamid0@gmail.com"
FREE_LIMIT = 25
PREMIUM_LIMIT = 1000
app = FastAPI(title="NOVA AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthInput(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str | None = None


class ConversationInput(BaseModel):
    title: str | None = None


class MessageInput(BaseModel):
    content: str = Field(min_length=1)
    mode: str = "chat"


class ResearchInput(BaseModel):
    query: str = Field(min_length=2)


class ImageInput(BaseModel):
    prompt: str = Field(min_length=2)


async def db() -> asyncpg.Connection:
    if not DATABASE_URL:
        raise HTTPException(503, "Database configuration required")
    return await asyncpg.connect(DATABASE_URL)


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
    return f"{salt.hex()}:{key.hex()}"


def password_matches(password: str, encoded: str) -> bool:
    try:
        salt_hex, key_hex = encoded.split(":", 1)
        expected = bytes.fromhex(key_hex)
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=16384, r=8, p=1, dklen=64)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def public_user(row: asyncpg.Record) -> dict[str, Any]:
    return {k: row[k] for k in ("id", "email", "name", "role", "plan", "usage", "usage_limit") if k in row}


async def ensure_admin(conn: asyncpg.Connection) -> None:
    password = os.environ.get("ADMIN_PASSWORD")
    if not password:
        return
    await conn.execute(
        """INSERT INTO nova_users (email, password_hash, role, plan, usage_limit)
           VALUES ($1, $2, 'ADMIN', 'PREMIUM', $3)
           ON CONFLICT (email) DO UPDATE SET role='ADMIN', plan='PREMIUM', usage_limit=$3""",
        ADMIN_EMAIL,
        password_hash(password),
        PREMIUM_LIMIT,
    )


async def current_user(session_id: str | None) -> asyncpg.Record:
    if not session_id:
        raise HTTPException(401, "Authentication required")
    conn = await db()
    try:
        row = await conn.fetchrow(
            """SELECT u.id, u.email, u.name, u.role, u.plan, u.usage, u.usage_limit
               FROM nova_sessions s JOIN nova_users u ON u.id=s.user_id
               WHERE s.id=$1 AND s.expires_at > now() AND u.active=true""",
            session_id,
        )
    finally:
        await conn.close()
    if not row:
        raise HTTPException(401, "Authentication required")
    return row


def set_session(response: Response, session_id: str) -> None:
    response.set_cookie("nova_session", session_id, max_age=60 * 60 * 24 * 30, httponly=True, samesite="lax", secure=os.environ.get("NODE_ENV") == "production")


@app.get("/api/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/me")
async def me(nova_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    return public_user(await current_user(nova_session))


@app.post("/api/auth/signup", status_code=201)
async def signup(payload: AuthInput, response: Response) -> dict[str, Any]:
    email = payload.email.strip().lower()
    conn = await db()
    try:
        exists = await conn.fetchval("SELECT id FROM nova_users WHERE email=$1", email)
        if exists:
            raise HTTPException(409, "An account with this email already exists")
        row = await conn.fetchrow(
            """INSERT INTO nova_users (email, name, password_hash, usage_limit)
               VALUES ($1, $2, $3, $4)
               RETURNING id, email, name, role, plan, usage, usage_limit""",
            email, payload.name[:80] if payload.name else None, password_hash(payload.password), FREE_LIMIT,
        )
        sid = secrets.token_urlsafe(32)
        await conn.execute("INSERT INTO nova_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", sid, row["id"], datetime.now(timezone.utc) + timedelta(days=30))
    finally:
        await conn.close()
    set_session(response, sid)
    return public_user(row)


@app.post("/api/auth/login")
async def login(payload: AuthInput, response: Response) -> dict[str, Any]:
    conn = await db()
    try:
        await ensure_admin(conn)
        row = await conn.fetchrow("SELECT id, email, name, password_hash, role, plan, usage, usage_limit, active FROM nova_users WHERE email=$1", payload.email.strip().lower())
        if not row or not row["active"] or not password_matches(payload.password, row["password_hash"]):
            raise HTTPException(401, "Invalid email or password")
        sid = secrets.token_urlsafe(32)
        await conn.execute("INSERT INTO nova_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", sid, row["id"], datetime.now(timezone.utc) + timedelta(days=30))
    finally:
        await conn.close()
    set_session(response, sid)
    return public_user(row)


@app.post("/api/auth/logout", status_code=204)
async def logout(response: Response, nova_session: str | None = Cookie(default=None)) -> None:
    if nova_session:
        conn = await db()
        try:
            await conn.execute("DELETE FROM nova_sessions WHERE id=$1", nova_session)
        finally:
            await conn.close()
    response.delete_cookie("nova_session")


@app.get("/api/conversations")
async def conversations(nova_session: str | None = Cookie(default=None)) -> list[dict[str, Any]]:
    user = await current_user(nova_session)
    conn = await db()
    try:
        rows = await conn.fetch(
            """SELECT c.id, c.title, c.updated_at, count(m.id)::int AS message_count
               FROM nova_conversations c LEFT JOIN nova_messages m ON m.conversation_id=c.id
               WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.updated_at DESC""", user["id"],
        )
    finally:
        await conn.close()
    return [{"id": str(r["id"]), "title": r["title"], "updatedAt": r["updated_at"].isoformat(), "messageCount": r["message_count"]} for r in rows]


@app.post("/api/conversations", status_code=201)
async def create_conversation(payload: ConversationInput, nova_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    user = await current_user(nova_session)
    conn = await db()
    try:
        row = await conn.fetchrow("INSERT INTO nova_conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, updated_at", user["id"], (payload.title or "New conversation")[:120])
    finally:
        await conn.close()
    return {"id": str(row["id"]), "title": row["title"], "updatedAt": row["updated_at"].isoformat(), "messageCount": 0}


@app.get("/api/conversations/{conversation_id}/messages")
async def list_messages(conversation_id: str, nova_session: str | None = Cookie(default=None)) -> list[dict[str, Any]]:
    user = await current_user(nova_session)
    conn = await db()
    try:
        rows = await conn.fetch(
            """SELECT m.id, m.role, m.content, m.created_at, m.citations
               FROM nova_messages m JOIN nova_conversations c ON c.id=m.conversation_id
               WHERE m.conversation_id=$1 AND c.user_id=$2 ORDER BY m.created_at""", conversation_id, user["id"],
        )
    finally:
        await conn.close()
    return [{"id": str(r["id"]), "role": r["role"], "content": r["content"], "createdAt": r["created_at"].isoformat(), "citations": json.loads(r["citations"]) if r["citations"] else []} for r in rows]


async def ai_reply(history: list[dict[str, str]]) -> str:
    key = os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
    if not key:
        return "AI responses are not configured yet. Add an OpenAI or OpenRouter connection to enable NOVA."
    base = "https://api.openai.com/v1" if os.environ.get("OPENAI_API_KEY") else "https://openrouter.ai/api/v1"
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    async with httpx.AsyncClient(timeout=45) as client:
        result = await client.post(f"{base}/chat/completions", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json={"model": model, "messages": history, "temperature": 0.4})
        if result.status_code >= 400:
            return "The AI provider returned an error. Check the configured model and provider permissions."
        data = result.json()
        return data["choices"][0]["message"]["content"]


@app.post("/api/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, payload: MessageInput, nova_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    user = await current_user(nova_session)
    conn = await db()
    try:
        owned = await conn.fetchval("SELECT id FROM nova_conversations WHERE id=$1 AND user_id=$2", conversation_id, user["id"])
        if not owned:
            raise HTTPException(404, "Conversation not found")
        if user["usage"] >= user["usage_limit"]:
            raise HTTPException(402, "Usage limit reached")
        history = await conn.fetch("SELECT role, content FROM nova_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20", conversation_id)
        answer = await ai_reply([{"role": "system", "content": "You are NOVA, a precise and helpful AI assistant."}] + [{"role": r["role"], "content": r["content"]} for r in reversed(history)] + [{"role": "user", "content": payload.content}])
        await conn.execute("INSERT INTO nova_messages (conversation_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)", conversation_id, payload.content, answer)
        row = await conn.fetchrow("SELECT id, role, content, created_at FROM nova_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1", conversation_id)
        await conn.execute("UPDATE nova_users SET usage=usage+1 WHERE id=$1", user["id"])
        await conn.execute("UPDATE nova_conversations SET title=CASE WHEN title='New conversation' THEN left($2,48) ELSE title END, updated_at=now() WHERE id=$1", conversation_id, payload.content)
    finally:
        await conn.close()
    return {"id": str(row["id"]), "role": row["role"], "content": row["content"], "createdAt": row["created_at"].isoformat(), "citations": []}


@app.post("/api/assistant/research")
async def research(payload: ResearchInput, nova_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    await current_user(nova_session)
    return {"status": "configuration_required", "answer": "Web research requires a configured search provider. No source-less answer was generated.", "sources": []}


@app.post("/api/assistant/generate-image")
async def generate_image(payload: ImageInput, nova_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    await current_user(nova_session)
    return {"status": "configuration_required", "message": "Image generation requires a configured image provider.", "url": None}


@app.post("/api/billing/checkout")
async def checkout(nova_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    await current_user(nova_session)
    return {"status": "configuration_required", "message": "Premium checkout requires a configured payment provider.", "url": None}


@app.get("/api/admin/overview")
async def admin_overview(nova_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    user = await current_user(nova_session)
    if user["role"] != "ADMIN":
        raise HTTPException(403, "Admin access required")
    conn = await db()
    try:
        users = await conn.fetchval("SELECT count(*) FROM nova_users")
        premium = await conn.fetchval("SELECT count(*) FROM nova_users WHERE plan='PREMIUM'")
        today = await conn.fetchval("SELECT count(*) FROM nova_messages WHERE created_at >= current_date")
    finally:
        await conn.close()
    return {"users": users, "premiumUsers": premium, "messagesToday": today, "providerStatus": {"ai": bool(os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY")), "research": bool(os.environ.get("TAVILY_API_KEY")), "images": bool(os.environ.get("IMAGE_API_KEY")), "payments": bool(os.environ.get("STRIPE_SECRET_KEY"))}}


@app.get("/api/admin/users")
async def admin_users(nova_session: str | None = Cookie(default=None)) -> list[dict[str, Any]]:
    user = await current_user(nova_session)
    if user["role"] != "ADMIN":
        raise HTTPException(403, "Admin access required")
    conn = await db()
    try:
        rows = await conn.fetch("SELECT id, email, name, role, plan, usage, usage_limit FROM nova_users ORDER BY created_at DESC")
    finally:
        await conn.close()
    return [public_user(row) for row in rows]