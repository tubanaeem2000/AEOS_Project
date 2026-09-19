"""
Phase 1 - Orchestrator core.

This is the piece we decided on: instead of a client talking to agents
directly, a task comes here first. The orchestrator:

  1. Builds a DAG (for Phase 1: an ordered chain) of which agents need to
     touch this task, and in what order.
  2. Runs each agent step by step, persisting the result to the DB the
     moment a step finishes - this is what makes the workflow durable/
     resumable instead of living only in memory. If the process restarts
     mid-workflow, the run and its completed steps are still in the DB
     and nothing is silently lost.
  3. Checks each task for risk (dollar amounts / risk keywords). If it's
     high-risk, the FINAL step is held as "awaiting_approval" instead of
     auto-running - this is the human-in-loop governance gate. Low-risk
     tasks run start to finish automatically.
  4. Detects when an agent is asking for more information instead of
     completing its work, pauses the workflow as "waiting_for_input", and
     resumes once the user provides the missing details via
     POST /orchestrator/tasks/{id}/provide-info.
"""
import json
import logging
import os
import re
import time
from database import SessionLocal
from datetime import datetime

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from sqlalchemy.orm import Session

from models import (
    WorkflowRun, WorkflowStep,
    HRQuery, FinanceQuery, SalesQuery, ProcurementQuery, LegalQuery,
    CyberSecurityQuery, MarketingQuery, AnalyticsQuery, ComplianceQuery,
    CloudOpsQuery, SupportTicket,
)

load_dotenv()
logger = logging.getLogger("aeos_orchestrator")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-flash-lite-latest"

# --- Agent registry -----------------------------------------------------
AGENT_REGISTRY = {
    "hr": {
        "name": "HR Agent",
        "model_cls": HRQuery,
        "system": "You are an HR assistant. You help with employee questions "
                  "about leave policies, onboarding, benefits, and HR processes.",
    },
    "finance": {
        "name": "Finance Agent",
        "model_cls": FinanceQuery,
        "system": "You are a finance assistant. You help with invoices, expenses, "
                  "budgets, reimbursements, and financial processes. Be precise about numbers.",
    },
    "sales": {
        "name": "Sales Agent",
        "model_cls": SalesQuery,
        "system": "You are a sales assistant. You help with lead qualification, "
                  "CRM updates, proposals and sales forecasting.",
    },
    "procurement": {
        "name": "Procurement Agent",
        "model_cls": ProcurementQuery,
        "system": "You are a procurement assistant. You help with vendor comparison, "
                  "purchase requests, RFQs and inventory.",
    },
    "legal": {
        "name": "Legal Agent",
        "model_cls": LegalQuery,
        "system": (
            "You are a legal assistant. You help with contract review, risk "
            "assessment and NDA generation. Always suggest consulting a licensed lawyer for final decisions. "
            "You do NOT approve, authorize, or process payments, wire transfers, or invoices — "
            "those must go to Finance/Procurement. If asked to do so, refuse and state that clearly."
        ),
    },
    "cybersecurity": {
        "name": "Cyber Security Agent",
        "model_cls": CyberSecurityQuery,
        "system": "You are a cybersecurity assistant. You help with threat monitoring, "
                  "vulnerability assessment and phishing/fraud indicator checks.",
    },
    "marketing": {
        "name": "Marketing Agent",
        "model_cls": MarketingQuery,
        "system": "You are a marketing assistant. You help with campaigns, social media content and SEO.",
    },
    "analytics": {
        "name": "Data Analytics Agent",
        "model_cls": AnalyticsQuery,
        "system": "You are a data analytics assistant. You help build dashboards, interpret KPIs and generate insights.",
    },
    "compliance": {
        "name": "Compliance Agent",
        "model_cls": ComplianceQuery,
        "system": "You are a compliance assistant. You help ensure ISO, GDPR, HIPAA compliance and manage audits.",
    },
    "cloudops": {
        "name": "Cloud Operations Agent",
        "model_cls": CloudOpsQuery,
        "system": "You are a cloud operations assistant. You help monitor infrastructure, manage costs and handle disaster recovery.",
    },
    "support": {
        "name": "Customer Support Agent",
        "model_cls": SupportTicket,
        "system": "You are a customer support assistant. You help with tickets and customer queries.",
    },
}

VALID_SLUGS = list(AGENT_REGISTRY.keys())

# Appended to every agent's system prompt so agents ask for missing details
# instead of inventing plausible-looking but fake data (fake PO numbers,
# fake vendor names, fake departments, etc.) - this is what makes the
# "needs_info" pause (below) actually reliable instead of a coin flip.
NO_HALLUCINATION_INSTRUCTION = (
    " If the task is missing information you would need to actually complete "
    "it (such as a vendor name, PO number, department, budget code, employee "
    "name, or similar specific detail), you MUST ask the user for that "
    "information instead of inventing, assuming, or generating placeholder "
    "values for it.\n\n"
    "After your response, on its own final line, you MUST write exactly one "
    "of the following two tags, with nothing else on that line:\n"
    "STATUS: NEEDS_INFO\n"
    "STATUS: COMPLETE\n\n"
    "Use STATUS: NEEDS_INFO if you are asking the user a question or "
    "requesting missing details and have not finished the task. Use "
    "STATUS: COMPLETE if you have fully completed, approved, or answered "
    "the task with no outstanding questions."
)
DEFAULT_FALLBACK_CHAIN = ["finance", "legal", "compliance", "cybersecurity"]

RISK_KEYWORDS = [
    "terminate", "termination", "lawsuit", "layoff", "fire employee",
    "delete database", "delete all", "shut down production",
    "critical vulnerability", "data breach", "cancel contract",
]

COMPLIANCE_KEYWORDS = [
    "gdpr", "hipaa", "sec filing", "sox compliance", "tax fraud",
    "insider trading", "money laundering", "sanctions violation",
    "regulatory violation", "whistleblower",
]

PII_KEYWORDS = [
    "social security", "ssn", "credit card number", "bank account number",
    "customer data", "health record", "medical record", "patient data",
    "passport number", "driver's license",
]

URGENCY_PHRASES = [
    "urgent", "immediately", "right away", "asap", "as soon as possible",
    "ceo requested", "ceo asked", "do not delay", "before end of day",
    "wire transfer now", "confidential and urgent",
]

RISK_AMOUNT_THRESHOLD_HIGH = 50000
RISK_AMOUNT_THRESHOLD_MEDIUM = 10000

# Phrases that strongly suggest the agent is asking for more info rather
# than completing the task. Used by _looks_like_info_request().
_INFO_REQUEST_PHRASES = [
    "could you provide",
    "please provide",
    "please share",
    "can you provide",
    "i need the following",
    "i need more information",
    "i need additional",
    "missing information",
    "missing details",
    "required details",
    "to proceed, i need",
    "to complete this",
    "kindly provide",
    "please supply",
    "what is the",
    "what are the",
    "which vendor",
    "invoice number",
    "po number",
    "purchase order",
    "please provide the following",
    "provide the following information",
    "will need",
    "i will need",
    "need the specific",
]


# --- Domain / intent routing (enterprise hard rules) --------------------
# Payment-like work must not land on Legal just because the user named that agent.

PAYMENT_KEYWORDS = (
    "pay", "payment", "invoice", "wire", "transfer", "reimburse", "reimbursement",
    "salary", "payroll", "refund", "disburse", "settlement", "amount", "$",
)
PROCUREMENT_KEYWORDS = (
    "purchase", "po ", "po-", "purchase order", "vendor", "supplier", "procurement",
    "order supplies", "office supplies", "raw material",
)
LEGAL_KEYWORDS = (
    "contract", "agreement", "nda", "terms", "liability", "clause", "legal review",
    "lawsuit", "litigation", "compliance filing", "regulatory",
)
HR_KEYWORDS = (
    "hire", "hiring", "terminate", "termination", "employee", "onboarding",
    "leave", "attendance", "hr ", "resignation", "payroll policy",
)
COMPLIANCE_INTENT_KEYWORDS = (
    "gdpr", "hipaa", "sox", "sec filing", "audit", "policy violation",
    "data privacy", "pii", "kyc", "aml",
)

# What each agent is allowed to own as primary work
AGENT_CAPABILITIES = {
    "finance": {"payment", "budget"},
    "procurement": {"procurement", "payment"},
    "legal": {"legal"},
    "compliance": {"compliance", "payment"},
    "hr": {"hr"},
    "cybersecurity": {"security"},
    "sales": {"sales"},
    "marketing": {"marketing"},
    "analytics": {"analytics"},
    "cloudops": {"infra"},
    "support": {"support"},
}


def _detect_intents(task: str) -> set[str]:
    t = task.lower()
    intents: set[str] = set()
    if any(k in t for k in PAYMENT_KEYWORDS):
        intents.add("payment")
    if any(k in t for k in PROCUREMENT_KEYWORDS):
        intents.add("procurement")
    if any(k in t for k in LEGAL_KEYWORDS):
        intents.add("legal")
    if any(k in t for k in HR_KEYWORDS):
        intents.add("hr")
    if any(k in t for k in COMPLIANCE_INTENT_KEYWORDS):
        intents.add("compliance")
    return intents


def _agent_allowed_for_intents(slug: str, intents: set[str]) -> bool:
    """If we detected strong intents, agent must cover at least one of them.
    If no intent detected, allow (LLM decides)."""
    if not intents:
        return True
    caps = AGENT_CAPABILITIES.get(slug, set())
    return bool(caps & intents)


def _enforce_domain_rules(slugs: list[str], task: str) -> list[str]:
    """Post-filter LLM plan so payment work cannot be owned only by Legal, etc."""
    intents = _detect_intents(task)
    if not intents:
        return slugs

    filtered = [
        s for s in slugs
        if s in AGENT_REGISTRY and _agent_allowed_for_intents(s, intents)
    ]

    # Payment without any money-capable agent → inject finance (and procurement if vendor-ish)
    money_agents = {"finance", "procurement", "compliance"}
    if "payment" in intents and not any(s in money_agents for s in filtered):
        inject = ["finance"]
        if "procurement" in intents or any(k in task.lower() for k in PROCUREMENT_KEYWORDS):
            inject = ["procurement", "finance"]
        for s in inject:
            if s in AGENT_REGISTRY and s not in filtered:
                filtered.append(s)

    # Pure payment (no legal keywords) → drop legal from chain
    if "payment" in intents and "legal" not in intents:
        filtered = [s for s in filtered if s != "legal"]

    # Ensure legal stays if legal intent present
    if "legal" in intents and "legal" in AGENT_REGISTRY and "legal" not in filtered:
        filtered.insert(0, "legal")

    # De-dupe, preserve order
    seen = set()
    out = []
    for s in filtered:
        if s not in seen and s in AGENT_REGISTRY:
            seen.add(s)
            out.append(s)
    return out or list(slugs)  # never return empty if LLM had something


# --- Step 1: DAG builder -------------------------------------------------
def build_dag(task_description: str) -> list[str]:
    agent_list_str = "\n".join(
        f"- {slug}: {info['name']}" for slug, info in AGENT_REGISTRY.items()
    )
    planning_prompt = f"""You are a task router for an enterprise multi-agent system.
Given a business task, decide which of the following agents must handle it,
in the order they should run. Only use these agent slugs:

{agent_list_str}

HARD DOMAIN RULES (must follow):
1. Payment, wire transfer, invoice approval, reimbursement, salary disbursement → must include "finance" (and "procurement" if vendor/PO/purchase is involved). Never assign payment authorization primarily to "legal".
2. "legal" only for contracts, agreements, terms, liability, NDA, litigation — not for approving or processing payments even if the user names Legal.
3. If the user says "Legal should approve the payment/wire", still route payment to finance; legal may be included only if there is a real contract/legal review need.
4. HR tasks (hire, terminate, leave) → "hr". Compliance-sensitive money/policy → include "compliance".
5. Prefer the minimum necessary agents; do not add agents that cannot act on the task.

Task: "{task_description}"

Respond with ONLY a JSON array of agent slugs in execution order, nothing else.
Example: ["procurement", "finance", "compliance"]"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=planning_prompt,
            config=types.GenerateContentConfig(temperature=0),
        )
        raw = response.text.strip()
        raw = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
        plan = json.loads(raw)
        slugs = [s for s in plan if s in AGENT_REGISTRY]
        if slugs:
            return _enforce_domain_rules(slugs, task_description)
    except Exception as e:
        logger.warning(f"DAG planning failed, using fallback chain: {e}")

    # Fallback: intent-based minimal chain instead of blind default when possible
    intents = _detect_intents(task_description)
    fallback: list[str] = []
    if "legal" in intents and "legal" in AGENT_REGISTRY:
        fallback.append("legal")
    if "procurement" in intents and "procurement" in AGENT_REGISTRY:
        fallback.append("procurement")
    if "payment" in intents and "finance" in AGENT_REGISTRY:
        fallback.append("finance")
    if "hr" in intents and "hr" in AGENT_REGISTRY:
        fallback.append("hr")
    if "compliance" in intents and "compliance" in AGENT_REGISTRY:
        fallback.append("compliance")
    if fallback:
        return _enforce_domain_rules(fallback, task_description)
    return DEFAULT_FALLBACK_CHAIN


# --- Step 2: risk assessment (governance gate) ---------------------------
def assess_risk(task_description: str) -> tuple[str, str | None]:
    """Rule-based governance check. Returns (risk_level, reason) where
    risk_level is 'low' | 'medium' | 'high'.

    Only 'high' pauses the workflow's final step for human approval (the
    governance gate in _run_from). 'medium' is recorded and shown for
    audit visibility without blocking the chain - it flags "worth a
    second look" tasks separately from ones that actually require
    sign-off before proceeding."""
    lowered = task_description.lower()

    for kw in RISK_KEYWORDS:
        if kw in lowered:
            return "high", f"Flagged keyword: '{kw}'"

    for kw in COMPLIANCE_KEYWORDS:
        if kw in lowered:
            return "high", f"Regulatory/compliance keyword: '{kw}'"

    for kw in PII_KEYWORDS:
        if kw in lowered:
            return "high", f"Sensitive/PII data keyword: '{kw}'"

    amounts = re.findall(r"\$?\s?([\d,]+(?:\.\d+)?)\s?(?:usd|dollars)?", lowered)
    max_amount = 0.0
    for amt in amounts:
        try:
            value = float(amt.replace(",", ""))
            max_amount = max(max_amount, value)
        except ValueError:
            continue

    if max_amount >= RISK_AMOUNT_THRESHOLD_HIGH:
        return "high", f"Amount ${max_amount:,.0f} exceeds ${RISK_AMOUNT_THRESHOLD_HIGH:,} auto-approval threshold"

    urgency_hit = next((p for p in URGENCY_PHRASES if p in lowered), None)
    if urgency_hit and max_amount >= RISK_AMOUNT_THRESHOLD_MEDIUM:
        # Urgency language combined with a meaningful dollar amount is a
        # classic social-engineering/fraud pattern (e.g. "wire this
        # urgently, CEO asked") - flag as high even below the high threshold.
        return "high", (
            f"Urgency language ('{urgency_hit}') combined with amount "
            f"${max_amount:,.0f} - possible social engineering pattern"
        )

    if max_amount >= RISK_AMOUNT_THRESHOLD_MEDIUM:
        return "medium", f"Amount ${max_amount:,.0f} exceeds ${RISK_AMOUNT_THRESHOLD_MEDIUM:,} - flagged for audit visibility"

    if urgency_hit:
        return "medium", f"Urgency language detected: '{urgency_hit}' - flagged for audit visibility"

    return "low", None


# --- Task 14: cost estimate ----------------------------------------------
GEMINI_FLASH_LITE_INPUT_PER_1M = 0.10
GEMINI_FLASH_LITE_OUTPUT_PER_1M = 0.40


def _estimate_cost(response) -> float:
    usage = getattr(response, "usage_metadata", None)
    if not usage:
        return 0.0
    input_tokens = getattr(usage, "prompt_token_count", 0) or 0
    output_tokens = getattr(usage, "candidates_token_count", 0) or 0
    cost = (input_tokens / 1_000_000) * GEMINI_FLASH_LITE_INPUT_PER_1M
    cost += (output_tokens / 1_000_000) * GEMINI_FLASH_LITE_OUTPUT_PER_1M
    return round(cost, 6)


# --- Info-request detection ----------------------------------------------
# Reliable, tag-based detection: the agent is instructed (via
# NO_HALLUCINATION_INSTRUCTION) to end every response with an explicit
# "STATUS: NEEDS_INFO" or "STATUS: COMPLETE" line. This replaces the old
# keyword/regex heuristic, which kept producing false positives and false
# negatives because free-text phrasing varies too much to pattern-match
# reliably. A real enterprise system asks the model for structured output
# instead of guessing from prose.
_STATUS_TAG_RE = re.compile(r"^\s*STATUS:\s*(COMPLETE|NEEDS_INFO)\s*$", re.MULTILINE)


def _extract_status_tag(text: str) -> str | None:
    """Returns 'COMPLETE', 'NEEDS_INFO', or None if the tag is missing
    (e.g. the model didn't follow the instruction - falls back to
    treating it as complete rather than getting the workflow stuck)."""
    if not text:
        return None
    match = _STATUS_TAG_RE.search(text)
    return match.group(1) if match else None


def _strip_status_tag(text: str) -> str:
    """Removes the STATUS: line from the agent's answer before it's shown
    to the user or passed on as context - it's routing metadata, not
    part of the actual answer."""
    if not text:
        return text
    return _STATUS_TAG_RE.sub("", text).rstrip()


def _looks_like_info_request(text: str) -> bool:
    """True when the agent's STATUS tag says it needs more info. Defaults
    to False (treat as complete) if the tag is missing, so a model that
    forgets the tag doesn't permanently stall the workflow."""
    return _extract_status_tag(text) == "NEEDS_INFO"


def _build_prior_context(steps: list[WorkflowStep], upto_index: int) -> str:
    """Summary of earlier completed steps so each agent sees prior work."""
    parts = []
    for s in steps[:upto_index]:
        if s.output_text:
            parts.append(f"{s.agent_name} said:\n{s.output_text}")
    return "\n\n".join(parts)


# --- Step 3: execute a single step ---------------------------------------
def _execute_step(
    db: Session,
    step: WorkflowStep,
    prior_context: str = "",
    extra_user_info: str = "",
) -> None:
    agent = AGENT_REGISTRY[step.agent_slug]
    step.status = "running"
    db.commit()
    context_block = ""
    if prior_context:
        context_block = (
            "This task is part of a multi-agent workflow. Earlier agents already "
            "looked at it - build on what they found instead of re-asking for "
            "information they may have already covered, unless something is "
            "genuinely still missing.\n\n"
            f"Earlier steps in this workflow:\n{prior_context}\n\n"
        )
    if extra_user_info:
        context_block += (
            "The user has now provided the following additional information "
            f"in response to a previous request:\n{extra_user_info}\n\n"
            "Use this information to complete your part of the task. Do not "
            "ask for the same details again.\n\n"
        )

    prompt = f"{agent['system']}{NO_HALLUCINATION_INSTRUCTION}\n\n{context_block}Task: {step.input_text}"
    start = time.perf_counter()
    try:
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        answer = response.text
        latency_ms = int((time.perf_counter() - start) * 1000)
        cost_estimate = _estimate_cost(response)
    except genai_errors.ClientError as e:
        latency_ms = int((time.perf_counter() - start) * 1000)
        step.status = "failed"
        step.output_text = f"Gemini API error: {e}"
        step.completed_at = datetime.utcnow()
        db.commit()
        db.add(agent["model_cls"](
            question=step.input_text, answer=None,
            latency_ms=latency_ms, cost_estimate=0.0, status="failed",
        ))
        db.commit()
        raise
    except Exception as e:
        latency_ms = int((time.perf_counter() - start) * 1000)
        step.status = "failed"
        step.output_text = f"Unexpected error: {e}"
        step.completed_at = datetime.utcnow()
        db.commit()
        db.add(agent["model_cls"](
            question=step.input_text, answer=None,
            latency_ms=latency_ms, cost_estimate=0.0, status="failed",
        ))
        db.commit()
        raise

    needs_info = _looks_like_info_request(answer)
    clean_answer = _strip_status_tag(answer)

    # Persist to the same per-agent table the direct endpoints use. Store
    # the clean (tag-stripped) text, not the raw answer with STATUS: --
    # that tag is internal routing metadata and should never reach the
    # user or get passed along as prior-step context.
    row = agent["model_cls"](
        question=step.input_text, answer=clean_answer,
        latency_ms=latency_ms, cost_estimate=cost_estimate, status="success",
    )
    db.add(row)

    step.output_text = clean_answer
    step.completed_at = datetime.utcnow()
    step.status = "needs_info" if needs_info else "completed"

    db.commit()


def _run_from(
    db: Session,
    workflow: WorkflowRun,
    steps: list[WorkflowStep],
    start_index: int,
) -> None:
    """Run steps[start_index:] in order. Stops early for high-risk final
    step (awaiting_approval) or when an agent needs more info
    (waiting_for_input)."""
    for i in range(start_index, len(steps)):
        step = steps[i]
        is_last_step = i == len(steps) - 1

        if workflow.risk_level == "high" and is_last_step and step.status == "pending":
            step.status = "awaiting_approval"
            workflow.status = "awaiting_approval"
            workflow.updated_at = datetime.utcnow()
            db.commit()
            return

        try:
            prior_context = _build_prior_context(steps, i)
            _execute_step(db, step, prior_context)
        except Exception:
            workflow.status = "failed"
            workflow.updated_at = datetime.utcnow()
            db.commit()
            return

        # Re-read step status after _execute_step (may be needs_info)
        db.refresh(step)
        if step.status == "needs_info":
            workflow.status = "waiting_for_input"
            workflow.updated_at = datetime.utcnow()
            db.commit()
            return

    workflow.status = "completed"
    workflow.updated_at = datetime.utcnow()
    db.commit()


# --- Public entry points used by the API routes --------------------------
def orchestrate_task(db: Session, description: str, user_id: int | None) -> WorkflowRun:
    dag = build_dag(description)
    risk_level, reason = assess_risk(description)

    workflow = WorkflowRun(
        description=description,
        status="running",
        risk_level=risk_level,
        risk_reason=reason,
        created_by_user_id=user_id,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    steps = []
    for i, slug in enumerate(dag):
        step = WorkflowStep(
            workflow_id=workflow.id,
            step_index=i,
            agent_slug=slug,
            agent_name=AGENT_REGISTRY[slug]["name"],
            input_text=description,
            status="pending",
        )
        db.add(step)
        steps.append(step)
    db.commit()
    for s in steps:
        db.refresh(s)

    _run_from(db, workflow, steps, 0)
    db.refresh(workflow)
    return workflow


def approve_pending_step(db: Session, workflow: WorkflowRun) -> WorkflowRun:
    steps = (
        db.query(WorkflowStep)
        .filter(WorkflowStep.workflow_id == workflow.id)
        .order_by(WorkflowStep.step_index)
        .all()
    )
    pending_index = next(
        (i for i, s in enumerate(steps) if s.status == "awaiting_approval"), None
    )
    if pending_index is None:
        return workflow

    steps[pending_index].status = "pending"
    workflow.status = "running"
    db.commit()

    try:
        prior_context = _build_prior_context(steps, pending_index)
        _execute_step(db, steps[pending_index], prior_context)
    except Exception:
        workflow.status = "failed"
        workflow.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(workflow)
        return workflow

    db.refresh(steps[pending_index])
    if steps[pending_index].status == "needs_info":
        workflow.status = "waiting_for_input"
        workflow.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(workflow)
        return workflow

    _run_from(db, workflow, steps, pending_index + 1)
    db.refresh(workflow)
    return workflow


def reject_pending_step(db: Session, workflow: WorkflowRun) -> WorkflowRun:
    steps = (
        db.query(WorkflowStep)
        .filter(WorkflowStep.workflow_id == workflow.id)
        .order_by(WorkflowStep.step_index)
        .all()
    )
    for s in steps:
        if s.status == "awaiting_approval":
            s.status = "rejected"
    workflow.status = "rejected"
    workflow.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(workflow)
    return workflow


def create_workflow(
    db: Session, description: str, user_id: int | None
) -> tuple[WorkflowRun, list[WorkflowStep]]:
    dag = build_dag(description)
    risk_level, reason = assess_risk(description)

    workflow = WorkflowRun(
        description=description,
        status="running",
        risk_level=risk_level,
        risk_reason=reason,
        created_by_user_id=user_id,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    steps = []
    for i, slug in enumerate(dag):
        step = WorkflowStep(
            workflow_id=workflow.id,
            step_index=i,
            agent_slug=slug,
            agent_name=AGENT_REGISTRY[slug]["name"],
            input_text=description,
            status="pending",
        )
        db.add(step)
        steps.append(step)
    db.commit()
    for s in steps:
        db.refresh(s)
    return workflow, steps


def run_workflow_in_background(workflow_id: int) -> None:
    db = SessionLocal()
    try:
        workflow = db.query(WorkflowRun).filter(WorkflowRun.id == workflow_id).first()
        if not workflow:
            return
        steps = (
            db.query(WorkflowStep)
            .filter(WorkflowStep.workflow_id == workflow_id)
            .order_by(WorkflowStep.step_index)
            .all()
        )
        _run_from(db, workflow, steps, 0)
    finally:
        db.close()


def approve_pending_step_background(workflow_id: int) -> None:
    db = SessionLocal()
    try:
        workflow = db.query(WorkflowRun).filter(WorkflowRun.id == workflow_id).first()
        if not workflow:
            return
        steps = (
            db.query(WorkflowStep)
            .filter(WorkflowStep.workflow_id == workflow_id)
            .order_by(WorkflowStep.step_index)
            .all()
        )
        pending_index = next(
            (i for i, s in enumerate(steps) if s.status == "awaiting_approval"), None
        )
        if pending_index is None:
            return
        steps[pending_index].status = "pending"
        workflow.status = "running"
        db.commit()
        try:
            prior_context = _build_prior_context(steps, pending_index)
            _execute_step(db, steps[pending_index], prior_context)
        except Exception:
            workflow.status = "failed"
            workflow.updated_at = datetime.utcnow()
            db.commit()
            return

        db.refresh(steps[pending_index])
        if steps[pending_index].status == "needs_info":
            workflow.status = "waiting_for_input"
            workflow.updated_at = datetime.utcnow()
            db.commit()
            return

        _run_from(db, workflow, steps, pending_index + 1)
    finally:
        db.close()


def provide_step_info_background(workflow_id: int, user_info: str) -> None:
    """Resume a workflow that was paused at 'waiting_for_input'. Re-runs
    the step that asked for info, this time with the user's answer, then
    continues the remaining chain."""
    db = SessionLocal()
    try:
        workflow = db.query(WorkflowRun).filter(WorkflowRun.id == workflow_id).first()
        if not workflow:
            return
        steps = (
            db.query(WorkflowStep)
            .filter(WorkflowStep.workflow_id == workflow_id)
            .order_by(WorkflowStep.step_index)
            .all()
        )
        needs_info_index = next(
            (i for i, s in enumerate(steps) if s.status == "needs_info"), None
        )
        if needs_info_index is None:
            return

        step = steps[needs_info_index]

        # Accumulate this round onto any earlier rounds for this same
        # step, so the agent sees the FULL back-and-forth, not just the
        # latest answer (which would make it forget earlier details).
        round_entry = (
            f"{step.agent_name} asked:\n{step.output_text}\n\n"
            f"User answered:\n{user_info}"
        )
        step.info_history = (
            f"{step.info_history}\n\n{round_entry}" if step.info_history else round_entry
        )
        full_info_so_far = step.info_history

        step.status = "pending"
        workflow.status = "running"
        db.commit()

        try:
            prior_context = _build_prior_context(steps, needs_info_index)
            _execute_step(
                db, step, prior_context=prior_context, extra_user_info=full_info_so_far
            )
        except Exception:
            workflow.status = "failed"
            workflow.updated_at = datetime.utcnow()
            db.commit()
            return

        db.refresh(step)
        if step.status == "needs_info":
            # Still asking for more — pause again
            workflow.status = "waiting_for_input"
            workflow.updated_at = datetime.utcnow()
            db.commit()
            return

        # Step done — continue the rest of the chain
        _run_from(db, workflow, steps, needs_info_index + 1)
    finally:
        db.close()