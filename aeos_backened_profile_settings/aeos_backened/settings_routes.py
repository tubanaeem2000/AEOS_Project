"""
New, isolated file: adds endpoints for the authenticated user's
notification preferences (the toggles on the existing Settings page).

Reuses, without modifying:
- get_current_user / get_db from auth_routes.py (same auth as every
  other protected route - no new auth mechanism)
- the existing UserSettings model (models.py)

Theme is NOT handled here - it's already fully persisted client-side via
lib/theme.tsx (localStorage), which already survives refresh, so nothing
needed to change there.
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth_routes import get_current_user, get_db
from models import User, UserSettings
from schemas import UserSettingsOut, UserSettingsUpdateRequest

logger = logging.getLogger("aeos_backend.settings")

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(db: Session, user: User) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if settings is None:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=UserSettingsOut)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the authenticated user's notification preferences, creating a
    default row (matching the existing UI's original defaults - all on)
    on first access.
    """
    return UserSettingsOut.model_validate(_get_or_create_settings(db, current_user))


@router.patch("", response_model=UserSettingsOut)
def update_settings(
    request: UserSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates only the preference fields included in the request."""
    settings = _get_or_create_settings(db, current_user)

    for field in ("email_notifications", "agent_alerts", "approval_alerts", "security_alerts"):
        value = getattr(request, field)
        if value is not None:
            setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    logger.info("Settings updated for user_id=%s", current_user.id)

    return UserSettingsOut.model_validate(settings)
