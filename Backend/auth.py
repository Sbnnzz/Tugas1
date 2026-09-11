"""Staff accounts, password hashing and login sessions.

Stored in SQLite at Backend/data/simrs.db (gitignored). Passwords are never stored:
only a per-user random salt and a PBKDF2-SHA256 hash. Sessions are random tokens kept
server-side and handed to the browser as an HttpOnly cookie.
"""
import contextlib
import datetime
import hashlib
import hmac
import os
import secrets
import sqlite3
import time

from fastapi import HTTPException, Request

import config

ROLES = {
    "admin": "Admin",
    "radiografer": "Radiografer",
    "radiolog": "Radiolog",
    "dokter_bedah": "Dokter Bedah",
}

# Demo accounts created on first start when the database has no users yet.
# Sandbox/course use only - change these passwords for anything beyond a demo.
DEMO_USERS = [
    ("admin", "admin123", "admin", "Administrator SIMRS"),
    ("radiografer", "radiografer123", "radiografer", "Rina Kartika, A.Md.Rad"),
    ("radiolog", "radiolog123", "radiolog", "dr. Rahmat Adiputra, Sp.Rad"),
    ("bedah", "bedah123", "dokter_bedah", "dr. Bima Santoso, Sp.B"),
]

SESSION_COOKIE = "simrs_session"
SESSION_TTL = 12 * 3600  # seconds
_PBKDF2_ITERATIONS = 200_000


@contextlib.contextmanager
def _db():
    os.makedirs(config.DATA_DIR, exist_ok=True)
    con = sqlite3.connect(config.DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db():
    """Create the tables if needed and seed the demo accounts into an empty database."""
    with _db() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                username      TEXT PRIMARY KEY,
                full_name     TEXT NOT NULL,
                role          TEXT NOT NULL,
                salt          TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created       TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token    TEXT PRIMARY KEY,
                username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                expires  REAL NOT NULL
            );
            """
        )
        empty = con.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    if empty:
        for username, password, role, full_name in DEMO_USERS:
            create_user(username, password, role, full_name)


def hash_password(password, salt=None):
    """Return (salt_hex, hash_hex). A new random salt is generated when none is given."""
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return salt, digest.hex()


def create_user(username, password, role, full_name):
    if role not in ROLES:
        raise ValueError(f"unknown role '{role}', expected one of: {', '.join(ROLES)}")
    salt, digest = hash_password(password)
    now = datetime.datetime.now().isoformat(timespec="seconds")
    with _db() as con:
        con.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)", (username, full_name, role, salt, digest, now))


def set_password(username, password):
    salt, digest = hash_password(password)
    with _db() as con:
        changed = con.execute("UPDATE users SET salt = ?, password_hash = ? WHERE username = ?",
                              (salt, digest, username)).rowcount
        con.execute("DELETE FROM sessions WHERE username = ?", (username,))
    return changed == 1


def list_users():
    with _db() as con:
        return [dict(r) for r in con.execute("SELECT username, full_name, role, created FROM users ORDER BY username")]


def _public(row):
    return {"username": row["username"], "full_name": row["full_name"],
            "role": row["role"], "role_label": ROLES.get(row["role"], row["role"])}


def authenticate(username, password):
    """Return the public user dict when the password matches, otherwise None."""
    with _db() as con:
        row = con.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if row is None:
        hash_password(password)  # spend the same time as a real check
        return None
    _, digest = hash_password(password, row["salt"])
    return _public(row) if hmac.compare_digest(digest, row["password_hash"]) else None


def create_session(username):
    token = secrets.token_urlsafe(32)
    with _db() as con:
        con.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
        con.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token, username, time.time() + SESSION_TTL))
    return token


def end_session(token):
    if token:
        with _db() as con:
            con.execute("DELETE FROM sessions WHERE token = ?", (token,))


def session_user(token):
    if not token:
        return None
    with _db() as con:
        row = con.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.username = s.username "
            "WHERE s.token = ? AND s.expires > ?", (token, time.time())).fetchone()
    return _public(row) if row else None


def request_token(request: Request):
    """The session of this request: the tab's own token (Authorization: Bearer ...) if the page
    sent one, otherwise the browser's cookie. Lets each browser tab stay logged in as its own user."""
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return request.cookies.get(SESSION_COOKIE, "")


def current_user(request: Request):
    """FastAPI dependency: the logged-in user, or 401."""
    user = session_user(request_token(request))
    if user is None:
        raise HTTPException(status_code=401, detail="Belum login atau sesi habis")
    return user


def require_roles(*roles):
    """FastAPI dependency factory: the logged-in user if their role is allowed, otherwise 401/403."""
    def dependency(request: Request):
        user = current_user(request)
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Akses ditolak untuk peran {user['role_label']}")
        return user
    return dependency
