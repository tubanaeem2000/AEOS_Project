from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    role = Column(String, nullable=False, default="employee")
    # "employee" (default) or "admin". Admins are promoted by updating this
    # column directly in the database - there is no self-service API to
    # become an admin, since that would be a security hole.
    phone = Column(String, nullable=True)
    department = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    # Small data-URL image (validated/size-capped at upload time) - the
    # simplest safe storage option given no file/object storage exists
    # elsewhere in this project. Reuses the existing users table/column
    # pattern rather than introducing new storage architecture.
    token_version = Column(Integer, nullable=False, default=0)
    # Bumped by POST /auth/logout-all-devices. Every access/refresh token
    # embeds the token_version it was issued under; get_current_user and
    # /auth/refresh reject any token whose version doesn't match the
    # user's current value, which is what makes "log out of all devices"
    # actually revoke previously-issued tokens under the existing
    # stateless-JWT design, without needing a server-side session table.
    created_at = Column(DateTime, default=datetime.utcnow)

class PasswordResetToken(Base):
    """
    Stores a HASH of each password-reset token, never the raw token.
    The raw token only ever exists in the email sent to the user and
    briefly in memory on the server while it's generated/hashed.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class HRQuery(Base):
    __tablename__ = "hr_queries"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)
class FinanceQuery(Base):
    __tablename__ = "finance_queries"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class SalesQuery(Base):
    __tablename__ = "sales_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True) 
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class ProcurementQuery(Base):
    __tablename__ = "procurement_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True) 
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class LegalQuery(Base):
    __tablename__ = "legal_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class CyberSecurityQuery(Base):
    __tablename__ = "cybersecurity_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class MarketingQuery(Base):
    __tablename__  = "marketing_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class AnalyticsQuery(Base):
    __tablename__  = "analytics_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

class ComplianceQuery(Base):
    __tablename__ = "compliance_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)


class CloudOpsQuery(Base):
    __tablename__ = "cloudops_queries"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

  
class WorkflowRun(Base):
    """
    A single orchestrated business task (e.g. "approve invoice INV-2291").
    Represents the whole DAG run. Persisted after every step so that if the
    orchestrator process restarts, an in-progress workflow is not lost - it
    can be inspected/resumed from the last completed step instead of
    starting over.
    """
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    status = Column(String, nullable=False, default="running")
    # running | awaiting_approval | completed | rejected | failed
    risk_level = Column(String, nullable=False, default="low")   # low | high
    risk_reason = Column(String, nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkflowStep(Base):
    """
    One node in the DAG for a WorkflowRun - one agent's part of the task,
    in execution order. Each row is written as soon as its status changes,
    which is what gives the orchestrator durable/resumable state.
    """
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, nullable=False, index=True)
    step_index = Column(Integer, nullable=False)
    agent_slug = Column(String, nullable=False)
    agent_name = Column(String, nullable=False)
    input_text = Column(String, nullable=False)
    output_text = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")
    # pending | running | completed | failed | awaiting_approval | rejected
    info_history = Column(String, nullable=True)
    # Accumulates every round of "agent asked / user answered" for this
    # step when it pauses for needs_info more than once - without this,
    # each new answer overwrites the last and the agent forgets earlier
    # answers across multiple back-and-forth rounds.
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class UploadedDocument(Base):
    """
    Metadata for a file uploaded into the RAG knowledge base. The actual
    extracted text is appended into the existing rag/documents/knowledge.txt
    (the same file the existing RAG pipeline already reads) - this table
    only tracks who uploaded what and when, so the source filename can be
    shown when RAG uses content that came from an upload.
    """
    __tablename__ = "uploaded_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSettings(Base):
    """
    Per-user notification preferences, shown/edited on the Settings page.
    One row per user, created on first access with the same defaults the
    existing Settings UI already used (all on, except 2FA which has no
    real implementation - see auth_routes.py).
    """
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    email_notifications = Column(Boolean, nullable=False, default=True)
    agent_alerts = Column(Boolean, nullable=False, default=True)
    approval_alerts = Column(Boolean, nullable=False, default=True)
    security_alerts = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
