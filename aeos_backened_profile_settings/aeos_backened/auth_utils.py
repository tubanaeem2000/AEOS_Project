"""
Phase 1 — Authentication utilities.

Handles:
- Password hashing/verification (bcrypt via passlib)
- JWT access + refresh token creation and verification (PyJWT)

Nothing in this file touches the existing agent endpoints, models, or
database session logic from Phase 0.
"""
import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext

# --- Config (from environment, with safe local-dev defaults) ---
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- Password hashing ---
def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


# --- JWT tokens ---
def _create_token(subject: str, expires_delta: timedelta, token_type: str, token_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "tv": token_version,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_access_token(user_id: int, token_version: int = 0) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
        token_version=token_version,
    )


def create_refresh_token(user_id: int, token_version: int = 0) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
        token_version=token_version,
    )


class TokenError(Exception):
    """Raised when a token is invalid, expired, or the wrong type."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def decode_token(token: str, expected_type: Optional[str] = None) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise TokenError("Token has expired")
    except jwt.InvalidTokenError:
        raise TokenError("Invalid token")

    if expected_type and payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token")

    return payload


# --- Password reset tokens ---
#
# The raw token is a high-entropy random string sent to the user by email.
# Only its SHA-256 hash is ever stored in the database, so a database leak
# alone cannot be used to reset anyone's password (same principle as never
# storing plaintext passwords).
def generate_reset_token() -> tuple[str, str, datetime]:
    """Returns (raw_token, token_hash, expires_at)."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_reset_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    return raw_token, token_hash, expires_at


def hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
