from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth_routes import get_current_user, get_db
from models import User, WorkflowRun, WorkflowStep
from orchestrator import AGENT_REGISTRY

router = APIRouter(prefix="/stats", tags=["stats"])


class AgentStatsOut(BaseModel):
    slug: str
    name: str
    status: str
    tasks_today: int
    tasks_total: int
    avg_latency_ms: int | None
    cost_today: float
    error_rate: float


class ActivityItemOut(BaseModel):
    agent_slug: str
    agent_name: str
    question: str
    status: str
    created_at: datetime


class DashboardOut(BaseModel):
    active_agents: int
    total_agents: int
    tasks_today: int
    pending_approvals: int
    risk_score: str
    high_risk_workflows_today: int
    tasks_by_agent: list[dict]
    tasks_last_14_days: list[dict]
    recent_activity: list[ActivityItemOut]


def _today_start() -> datetime:
    now = datetime.utcnow()
    return datetime(now.year, now.month, now.day)


def _agent_table_stats(db: Session, slug: str) -> dict:
    model_cls = AGENT_REGISTRY[slug]["model_cls"]
    today = _today_start()

    total = db.query(func.count(model_cls.id)).scalar() or 0

    today_rows = db.query(
        func.count(model_cls.id),
        func.avg(model_cls.latency_ms),
        func.sum(model_cls.cost_estimate),
    ).filter(model_cls.created_at >= today).first()
    tasks_today, avg_latency, cost_today = today_rows

    failed_today = db.query(func.count(model_cls.id)).filter(
        model_cls.created_at >= today, model_cls.status == "failed",
    ).scalar() or 0

    tasks_today = tasks_today or 0
    error_rate = round((failed_today / tasks_today) * 100, 1) if tasks_today else 0.0

    return {
        "tasks_total": total,
        "tasks_today": tasks_today,
        "avg_latency_ms": int(avg_latency) if avg_latency else None,
        "cost_today": round(cost_today or 0.0, 4),
        "error_rate": error_rate,
    }


@router.get("/agents", response_model=list[AgentStatsOut])
def get_agent_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = []
    for slug, info in AGENT_REGISTRY.items():
        stats = _agent_table_stats(db, slug)
        agent_status = "review" if stats["error_rate"] > 5.0 else "online"
        results.append(AgentStatsOut(slug=slug, name=info["name"], status=agent_status, **stats))
    return results


@router.get("/agents/{slug}/activity", response_model=list[ActivityItemOut])
def get_agent_activity(slug: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if slug not in AGENT_REGISTRY:
        return []
    model_cls = AGENT_REGISTRY[slug]["model_cls"]
    rows = db.query(model_cls).order_by(model_cls.created_at.desc()).limit(5).all()
    return [ActivityItemOut(agent_slug=slug, agent_name=AGENT_REGISTRY[slug]["name"],
                             question=r.question, status=r.status, created_at=r.created_at)
            for r in rows]


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = _today_start()
    per_agent = {slug: _agent_table_stats(db, slug) for slug in AGENT_REGISTRY}
    tasks_today_total = sum(s["tasks_today"] for s in per_agent.values())
    active_agents = sum(1 for s in per_agent.values() if s["error_rate"] <= 5.0)

    pending_approvals = db.query(func.count(WorkflowRun.id)).filter(
        WorkflowRun.status == "awaiting_approval").scalar() or 0

    high_risk_today = db.query(func.count(WorkflowRun.id)).filter(
        WorkflowRun.created_at >= today, WorkflowRun.risk_level == "high").scalar() or 0
    total_today_workflows = db.query(func.count(WorkflowRun.id)).filter(
        WorkflowRun.created_at >= today).scalar() or 0

    if total_today_workflows == 0:
        risk_score = "Low"
    else:
        ratio = high_risk_today / total_today_workflows
        risk_score = "High" if ratio > 0.3 else "Medium" if ratio > 0.1 else "Low"

    tasks_by_agent = [{"agent": AGENT_REGISTRY[slug]["name"].replace(" Agent", ""), "tasks": s["tasks_today"]}
                       for slug, s in per_agent.items()]

    tasks_last_14_days = []
    for i in range(13, -1, -1):
        day_start = today - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_total = 0
        for slug, info in AGENT_REGISTRY.items():
            model_cls = info["model_cls"]
            day_total += db.query(func.count(model_cls.id)).filter(
                model_cls.created_at >= day_start, model_cls.created_at < day_end).scalar() or 0
        tasks_last_14_days.append({"date": day_start.strftime("%b %d"), "tasks": day_total})

    all_recent = []
    for slug, info in AGENT_REGISTRY.items():
        model_cls = info["model_cls"]
        rows = db.query(model_cls).order_by(model_cls.created_at.desc()).limit(8).all()
        for r in rows:
            all_recent.append(ActivityItemOut(agent_slug=slug, agent_name=info["name"],
                                               question=r.question, status=r.status, created_at=r.created_at))
    all_recent.sort(key=lambda a: a.created_at, reverse=True)

    return DashboardOut(
        active_agents=active_agents, total_agents=len(AGENT_REGISTRY),
        tasks_today=tasks_today_total, pending_approvals=pending_approvals,
        risk_score=risk_score, high_risk_workflows_today=high_risk_today,
        tasks_by_agent=tasks_by_agent, tasks_last_14_days=tasks_last_14_days,
        recent_activity=all_recent[:8],
    )