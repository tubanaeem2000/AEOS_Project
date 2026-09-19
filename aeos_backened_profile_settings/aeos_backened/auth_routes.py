"""
Phase 1 — Authentication routes.

Mounted under /auth in main.py:
  POST /auth/signup
  POST /auth/login
  POST /auth/refresh
  GET  /auth/me   (protected — demonstrates route protection)
  PATCH /auth/me
  POST /auth/change-password
  POST /auth/avatar
  POST /auth/logout-all-devices

This file is additive: it does not import from or modify any Phase 0
agent endpoint logic in main.py.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from datetime import datetime
import logging
import os

from database import SessionLocal
from models import User, PasswordResetToken
from schemas import (
    SignupRequest, LoginRequest, RefreshRequest,
    TokenResponse, AccessTokenResponse, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse,
    ProfileUpdateRequest, ChangePasswordRequest, AvatarUpdateRequest,
)
from auth_utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, TokenError,
    generate_reset_token, hash_reset_token,
)
from email_utils import (
    send_password_reset_email, build_reset_url,
    EmailConfigError, EmailSendError,
)

logger = logging.getLogger("aeos_backend.auth")

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()

# A data-URL avatar is stored directly in the users.avatar_url column
# (see models.py) rather than adding file/object storage. Capped well
# under typical DB row/column limits and generous enough for a small
# profile photo.
MAX_AVATAR_DATA_URL_LENGTH = 700_000


def normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that protects a route: requires a valid,
    non-expired ACCESS token in the Authorization: Bearer header, issued
    under the user's current token_version (see "Log out of all devices"
    below - this is what makes that revocation actually take effect).
    Use this on any route that should require login.
    """
    token = credentials.credentials
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    if payload.get("tv", 0) != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session has been logged out. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(request.email)
    existing = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        name=request.name,
        email=normalized_email,
        password_hash=hash_password(request.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    db.refresh(user)

    access_token = create_access_token(user.id, token_version=user.token_version)
    refresh_token = create_refresh_token(user.id, token_version=user.token_version)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(request.email)
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()

    # Deliberately generic error message for both "no such user" and
    # "wrong password" so we don't leak which emails are registered.
    invalid_creds = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )

    if not user:
        raise invalid_creds
    if not verify_password(request.password, user.password_hash):
        raise invalid_creds
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(user.id, token_version=user.token_version)
    refresh_token = create_refresh_token(user.id, token_version=user.token_version)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(request: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(request.refresh_token, expected_type="refresh")
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists or is inactive",
        )
    if payload.get("tv", 0) != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session has been logged out. Please log in again.",
        )

    new_access_token = create_access_token(user.id, token_version=user.token_version)
    return AccessTokenResponse(access_token=new_access_token)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Protected route demo: requires a valid access token."""
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
def update_current_user(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates the authenticated user's own profile fields. Only fields
    actually present in the request are changed; anything omitted is left
    as-is. Changing email is allowed (it's an editable field in the
    existing Profile UI) but must stay unique, same as at signup.
    """
    if request.email is not None:
        normalized_email = normalize_email(request.email)
        if normalized_email != normalize_email(current_user.email):
            existing = db.query(User).filter(func.lower(User.email) == normalized_email).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )
            current_user.email = normalized_email

    if request.name is not None:
        current_user.name = request.name
    if request.phone is not None:
        current_user.phone = request.phone
    if request.department is not None:
        current_user.department = request.department

    db.commit()
    db.refresh(current_user)

    logger.info("Profile updated for user_id=%s", current_user.id)

    return UserOut.model_validate(current_user)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Changes the authenticated user's password. Requires the current
    password (so a stolen/left-open session alone can't take over the
    account) and hashes the new one with the project's existing bcrypt
    setup - never stores plaintext.
    """
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = hash_password(request.new_password)
    db.commit()

    logger.info("Password changed for user_id=%s", current_user.id)

    return MessageResponse(message="Your password has been changed successfully.")


@router.post("/avatar", response_model=UserOut)
def update_avatar(
    request: AvatarUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sets the authenticated user's profile photo. Stored directly as a
    data URL in the users table (see models.py) - the smallest safe
    option given no file/object storage exists elsewhere in this project.
    Size-capped to keep the database row reasonable.
    """
    data_url = request.avatar_data_url

    if not data_url.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be an image file.",
        )
    if len(data_url) > MAX_AVATAR_DATA_URL_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image is too large. Please use a smaller photo (under ~500KB).",
        )

    current_user.avatar_url = data_url
    db.commit()
    db.refresh(current_user)

    logger.info("Avatar updated for user_id=%s", current_user.id)

    return UserOut.model_validate(current_user)


@router.delete("/avatar", response_model=UserOut)
def remove_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Removes the authenticated user's profile photo (reverts to initials)."""
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/logout-all-devices", response_model=MessageResponse)
def logout_all_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revokes every access and refresh token issued to this user so far,
    on every device - by bumping token_version, which get_current_user
    and /auth/refresh both check against the token's embedded "tv" claim.
    This includes the token used to make this very request: the caller
    will need to log in again afterward, which is the expected/correct
    behavior for "log out of all devices."
    """
    current_user.token_version += 1
    db.commit()

    logger.info("All sessions revoked for user_id=%s", current_user.id)

    return MessageResponse(message="You have been logged out of all devices.")


_GENERIC_FORGOT_PASSWORD_MESSAGE = (
    "If an account with that email exists, a password reset link has been sent."
)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Starts a password reset.

    Security note: whether or not the email is registered, we return the
    same generic message and HTTP 200 - this prevents using this endpoint
    to discover which emails have accounts (the same reasoning as /auth/login
    returning a generic "Invalid email or password").

    However, if the email *is* registered and we genuinely fail to send the
    email (missing SMTP config, SMTP server rejects it, network failure,
    etc.), we do NOT swallow that into a fake success - we raise a real
    error so the failure is visible and actionable, both to the caller and
    in server logs.
    """
    normalized_email = normalize_email(request.email)
    normalized_email = normalize_email(request.email)
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()

    if not user:
        logger.info("Password reset requested for an email with no account.")
        return MessageResponse(message=_GENERIC_FORGOT_PASSWORD_MESSAGE)

    # Invalidate any previous unused reset tokens for this user, so only
    # the most recently requested link can ever be used.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,  # noqa: E712
    ).update({"used": True})

    raw_token, token_hash, expires_at = generate_reset_token()
    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(reset_record)
    db.commit()

    reset_url = build_reset_url(raw_token)

    try:
        send_password_reset_email(user.email, reset_url)
    except EmailConfigError as e:
        if os.getenv("ALLOW_DEV_RESET_LINK", "false").lower() == "true":
            logger.warning(
                "SMTP is not configured; returning a development reset link for user_id=%s",
                user.id,
            )
            return MessageResponse(message=f"Development reset link: {reset_url}")
        logger.error("Password reset email not sent (config error) for user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Email service is not configured correctly: {str(e)}",
        )
    except EmailSendError as e:
        logger.error("Password reset email failed to send for user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send the password reset email: {str(e)}",
        )

    return MessageResponse(message=_GENERIC_FORGOT_PASSWORD_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Completes a password reset using the raw token from the emailed link.
    Rejects missing, expired, or already-used tokens with the same generic
    error, so a caller can't distinguish those cases from each other.
    """
    invalid_token_error = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This password reset link is invalid or has expired. Please request a new one.",
    )

    token_hash = hash_reset_token(request.token)
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash
    ).first()

    if not record:
        raise invalid_token_error
    if record.used:
        raise invalid_token_error
    if record.expires_at < datetime.utcnow():
        raise invalid_token_error

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise invalid_token_error

    user.password_hash = hash_password(request.new_password)
    record.used = True
    db.commit()

    logger.info("Password successfully reset for user_id=%s", user.id)

    return MessageResponse(
        message="Your password has been reset successfully. You can now log in with your new password."
    )


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    RBAC gate: builds on get_current_user (same token check as every other
    protected route) and additionally requires role == "admin".
    Use this instead of get_current_user on routes that should be
    admin-only. Does not introduce a second authentication mechanism.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires an admin account.",
        )
    return current_user
