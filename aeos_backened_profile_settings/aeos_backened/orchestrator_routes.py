"""
Phase 1 - Orchestrator routes.

Mounted under /orchestrator in main.py:
  POST /orchestrator/tasks              submit a new task -> builds DAG, runs it
  GET  /orchestrator/tasks              list recent workflow runs
  GET  /orchestrator/tasks/{id}         get one workflow run + its steps
  POST /orchestrator/tasks/{id}/approve      approve a step held for human-in-loop review
  POST /orchestrator/tasks/{id}/reject       reject a step held for human-in-loop review
  POST /orchestrator/tasks/{id}/provide-info answer a question an agent asked mid-workflow

All routes require a logged-in user (reuses the same auth dependency as
the rest of Phase 1) - this is the RBAC layer discussed for both the
orchestrated path and any direct agent access.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_routes import get_current_user, get_db, require_admin
from models import User, WorkflowRun, WorkflowStep
import orchestrator as orch

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])


class TaskRequest(BaseModel):
    description: str


class ProvideInfoRequest(BaseModel):
    info: str


class StepOut(BaseModel):
    id: int
    step_index: int
    agent_slug: str
    agent_name: str
    input_text: str
    output_text: str | None
    status: str

    class Config:
        from_attributes = True


class WorkflowOut(BaseModel):
    id: int
    description: str
    status: str
    risk_level: str
    risk_reason: str | None
    created_by_user_id: int | None
    steps: list[StepOut]

    class Config:
        from_attributes = True


def _to_workflow_out(db: Session, wf: WorkflowRun) -> WorkflowOut:
    steps = (
        db.query(WorkflowStep)
        .filter(WorkflowStep.workflow_id == wf.id)
        .order_by(WorkflowStep.step_index)
        .all()
    )
    return WorkflowOut(
        id=wf.id,
        description=wf.description,
        status=wf.status,
        risk_level=wf.risk_level,
        risk_reason=wf.risk_reason,
        created_by_user_id=wf.created_by_user_id,
        steps=[StepOut.model_validate(s) for s in steps],
    )


def _get_workflow_or_404(db: Session, workflow_id: int) -> WorkflowRun:
    wf = db.query(WorkflowRun).filter(WorkflowRun.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return wf


@router.post("/tasks", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
def submit_task(
    request: TaskRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="Task description cannot be empty")
    workflow, _ = orch.create_workflow(db, request.description.strip(), current_user.id)
    background_tasks.add_task(orch.run_workflow_in_background, workflow.id)
    return _to_workflow_out(db, workflow)


@router.get("/tasks", response_model=list[WorkflowOut])
def list_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    runs = db.query(WorkflowRun).order_by(WorkflowRun.id.desc()).limit(30).all()
    return [_to_workflow_out(db, wf) for wf in runs]


@router.get("/tasks/{workflow_id}", response_model=WorkflowOut)
def get_task(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wf = _get_workflow_or_404(db, workflow_id)
    return _to_workflow_out(db, wf)


@router.post("/tasks/{workflow_id}/approve", response_model=WorkflowOut)
def approve_task(
    workflow_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    wf = _get_workflow_or_404(db, workflow_id)
    if wf.status != "awaiting_approval":
        raise HTTPException(status_code=400, detail="This workflow has no step awaiting approval")
    # Segregation of duties: the person who submitted a task cannot also
    # be the one who approves it, even if they're an admin - a real
    # enterprise governance control against self-approval / conflict of
    # interest. A different admin must review it.
    if wf.created_by_user_id == current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You submitted this task and cannot approve it yourself - a different admin must review it (segregation of duties).",
        )
    wf.status = "running"
    db.commit()
    background_tasks.add_task(orch.approve_pending_step_background, workflow_id)
    return _to_workflow_out(db, wf)

@router.post("/tasks/{workflow_id}/reject", response_model=WorkflowOut)
def reject_task(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    wf = _get_workflow_or_404(db, workflow_id)
    if wf.status != "awaiting_approval":
        raise HTTPException(status_code=400, detail="This workflow has no step awaiting approval")
    wf = orch.reject_pending_step(db, wf)
    return _to_workflow_out(db, wf)


@router.post("/tasks/{workflow_id}/provide-info", response_model=WorkflowOut)
def provide_info(
    workflow_id: int,
    request: ProvideInfoRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wf = _get_workflow_or_404(db, workflow_id)
    if wf.status != "waiting_for_input":
        raise HTTPException(status_code=400, detail="This workflow is not waiting for more information")
    if not request.info.strip():
        raise HTTPException(status_code=400, detail="Info cannot be empty")
    wf.status = "running"
    db.commit()
    background_tasks.add_task(orch.provide_step_info_background, workflow_id, request.info.strip())
    return _to_workflow_out(db, wf)