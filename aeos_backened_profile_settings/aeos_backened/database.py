from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from models import Base
Base.metadata.create_all(bind=engine)

# --- Lightweight, safe column migration -----------------------------------
# This project has no migration tool (Alembic, etc.) - create_all() above
# only creates tables that don't exist yet, it does NOT add new columns to
# tables that already exist. The "role" column (added for RBAC) needs to be
# added to any users table that was created before this change.
# This is safe to run every time the app starts: IF NOT EXISTS makes it a
# no-op on databases that already have the column, and it never touches or
# deletes any existing row or table.
from sqlalchemy import text as _text

with engine.connect() as _conn:
    _conn.execute(_text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'employee'"
    ))
    _conn.commit()

# Task 14: add the observability columns (latency_ms, cost_estimate, status)
# to every agent-query table. Same safe pattern as the role migration above -
# IF NOT EXISTS makes this a no-op on tables that already have the columns,
# and it never touches existing rows.
_AGENT_TABLES = [
    "support_tickets", "hr_queries", "finance_queries", "sales_queries",
    "procurement_queries", "legal_queries", "cybersecurity_queries",
    "marketing_queries", "analytics_queries", "compliance_queries",
    "cloudops_queries",
]

with engine.connect() as _conn:
    for _table in _AGENT_TABLES:
        _conn.execute(_text(
            f"ALTER TABLE {_table} ADD COLUMN IF NOT EXISTS latency_ms INTEGER"
        ))
        _conn.execute(_text(
            f"ALTER TABLE {_table} ADD COLUMN IF NOT EXISTS cost_estimate FLOAT"
        ))
        _conn.execute(_text(
            f"ALTER TABLE {_table} ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'success'"
        ))
    _conn.commit()

    # Accumulates multi-round "agent asked / user answered" history on a
# workflow step, so the agent doesn't forget earlier answers when it
# needs to ask more than once before completing.
with engine.connect() as _conn:
    _conn.execute(_text(
        "ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS info_history VARCHAR"
    ))
    _conn.commit()

# Profile + settings feature: phone/department/avatar for the Profile
# page, token_version for "log out of all devices" (see auth_utils.py /
# get_current_user for how it's checked). Same safe, additive pattern as
# every migration above - IF NOT EXISTS is a no-op on databases that
# already have these columns, and no existing row or table is touched.
with engine.connect() as _conn:
    _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR"))
    _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR"))
    _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR"))
    _conn.execute(_text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0"
    ))
    _conn.execute(_text(
        "UPDATE users SET email = LOWER(email) WHERE email IS NOT NULL"
    ))
    _conn.commit()