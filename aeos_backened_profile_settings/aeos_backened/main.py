from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import engine, SessionLocal
from models import (
    SupportTicket, HRQuery, FinanceQuery, SalesQuery, ProcurementQuery,
    LegalQuery, CyberSecurityQuery, MarketingQuery, AnalyticsQuery,
    ComplianceQuery, CloudOpsQuery, User
)
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from google import genai
from google.genai import errors as genai_errors
import os
import time
import logging
from dotenv import load_dotenv

from auth_routes import router as auth_router, get_current_user
from orchestrator_routes import router as orchestrator_router
from stats_routes import router as stats_router
from upload_routes import router as upload_router
from settings_routes import router as settings_router
from rag.retriever import search
from rag.rag_service import retrieve_relevant_context, build_grounded_prompt
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aeos_backend")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY is not set. Agent endpoints will fail until it is configured in .env")
if not DATABASE_URL:
    logger.warning("DATABASE_URL is not set. Database operations will fail until it is configured in .env")

client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="AEOS Backend", version="0.1.0")

# NOTE: allow_origins=["*"] is fine for local development only.
# This will be tightened when the frontend origin is finalized / auth is added.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phase 1: authentication routes (signup/login/refresh/me), mounted under /auth.
# Does not affect any existing agent route below.
app.include_router(auth_router)

# Phase 1: orchestrator routes (task submission, DAG execution, human-in-loop
# approval), mounted under /orchestrator. Reuses the agent logic/tables below
# but does not modify any existing agent endpoint - both access paths
# (direct agent endpoints below, and /orchestrator/tasks) keep working.
app.include_router(orchestrator_router)
app.include_router(stats_router)
app.include_router(upload_router)
app.include_router(settings_router)


@app.get("/")
def read_root():
    return {"message": "AEOS backend is working perfectly!"}


@app.get("/test-db")
def test_db():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "Database connected successfully!"}
    except Exception as e:
        return {"status": "Error", "detail": str(e)}


class QuestionRequest(BaseModel):
    question: str


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


def _save_agent_call(model_cls, question: str, answer: str | None, latency_ms: int,
                      cost_estimate: float, status: str) -> None:
    """Persist one agent call - success or failed - so /stats can compute
    real avg latency, real cost, and a real error rate per agent."""
    db = SessionLocal()
    try:
        row = model_cls(
            question=question,
            answer=answer,
            latency_ms=latency_ms,
            cost_estimate=cost_estimate,
            status=status,
        )
        db.add(row)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error while saving {model_cls.__tablename__}: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to save response to database: {str(e)}",
        )
    finally:
        db.close()


def run_agent(model_cls, question: str, prompt: str | None = None, use_rag: bool = False, agent_slug: str | None = None):
    """
    Shared execution path for every agent endpoint:
    1. (Phase 4, opt-in via use_rag) Retrieve relevant knowledge-base
       context and fold it into the prompt, clearly separated from
       instructions so retrieved text can't be treated as commands.
       `agent_slug` (e.g. "hr") is passed through so uploaded documents
       tagged to a different agent are excluded from this agent's results.
    2. Call Gemini with the given prompt (or raw question if no prompt),
       timing the call.
    3. Save {question, answer, latency_ms, cost_estimate, status} to the
       given model's table - on success AND on failure.
    4. Return a clean JSON response, or a clean JSON error instead of
       crashing with an unhandled exception / raw 500.

    This does not change any endpoint's request/response shape - it only
    adds an optional "sources" field, populated only when RAG was
    actually used and found something.
    """
    base_prompt = prompt if prompt is not None else question
    sources: list[str] = []

    if use_rag:
        rag_result = retrieve_relevant_context(question, agent_type=agent_slug)
        sources = rag_result.get("sources", [])
        contents = build_grounded_prompt(base_prompt, rag_result)
    else:
        contents = base_prompt

    start = time.perf_counter()
    try:
        response = client.models.generate_content(
            model="gemini-flash-lite-latest",
            contents=contents,
        )
        answer = response.text
        latency_ms = int((time.perf_counter() - start) * 1000)
        cost_estimate = _estimate_cost(response)
    except genai_errors.ClientError as e:
        latency_ms = int((time.perf_counter() - start) * 1000)
        logger.error(f"Gemini ClientError: {e}")
        _save_agent_call(model_cls, question, None, latency_ms, 0.0, "failed")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API request failed: {str(e)}",
        )
    except Exception as e:
        latency_ms = int((time.perf_counter() - start) * 1000)
        logger.error(f"Unexpected Gemini error: {e}")
        _save_agent_call(model_cls, question, None, latency_ms, 0.0, "failed")
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected error calling Gemini API: {str(e)}",
        )

    _save_agent_call(model_cls, question, answer, latency_ms, cost_estimate, "success")

    result = {"question": question, "answer": answer}
    if sources:
        result["sources"] = sources
    return result


@app.post("/support-agent")
def support_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    return run_agent(SupportTicket, request.question, use_rag=True, agent_slug="support")


@app.post("/hr-agent")
def hr_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    # HR agent ko specific instructions do (system prompt)
    hr_prompt = f"""You are an HR assistant for a company. You help with 
    employee questions about leave policies, onboarding, benefits, and HR processes. 
    Be professional and helpful.

    Employee question: {request.question}"""
    return run_agent(HRQuery, request.question, hr_prompt, use_rag=True, agent_slug="hr")


@app.post("/finance-agent")
def finance_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    finance_prompt = f"""You are a finance assistant for a company. You help with 
    questions about invoices, expenses, budgets, reimbursements, and financial processes. 
    Be professional, accurate, and clear about numbers.

    Employee question: {request.question}"""
    return run_agent(FinanceQuery, request.question, finance_prompt, use_rag=True, agent_slug="finance")


@app.post("/sales-agent")
def sales_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a sales assistant. You help with lead qualification, 
    CRM updates, proposals and sales forecasting. Be persuasive but professional.

    Question: {request.question}"""
    return run_agent(SalesQuery, request.question, prompt, use_rag=True, agent_slug="sales")


@app.post("/procurement-agent")
def procurement_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a procurement assistant. You help with vendor comparison, 
    purchase requests, RFQs and inventory. Be detail-oriented and cost-conscious.

    Question: {request.question}"""
    return run_agent(ProcurementQuery, request.question, prompt, use_rag=True, agent_slug="procurement")


@app.post("/legal-agent")
def legal_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a legal assistant. You help with contract review, 
    risk assessment and NDA generation. Be precise and always suggest consulting 
    a licensed lawyer for final decisions.

    Question: {request.question}"""
    return run_agent(LegalQuery, request.question, prompt, use_rag=True, agent_slug="legal")


@app.post("/cybersecurity-agent")
def cybersecurity_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a cybersecurity assistant. You help with threat monitoring, 
    vulnerability assessment and phishing detection. Be alert and security-focused.

    Question: {request.question}"""
    return run_agent(CyberSecurityQuery, request.question, prompt, use_rag=True, agent_slug="cybersecurity")


@app.post("/marketing-agent")
def marketing_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a marketing assistant. You help with campaigns, 
    social media content and SEO. Be creative and engaging.

    Question: {request.question}"""
    return run_agent(MarketingQuery, request.question, prompt, use_rag=True, agent_slug="marketing")


@app.post("/analytics-agent")
def analytics_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a data analytics assistant. You help build dashboards, 
    interpret KPIs and generate insights. Be data-driven and clear.

    Question: {request.question}"""
    return run_agent(AnalyticsQuery, request.question, prompt, use_rag=True, agent_slug="analytics")


@app.post("/compliance-agent")
def compliance_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a compliance assistant. You help ensure ISO, GDPR, HIPAA 
    compliance and manage audits. Be thorough and regulation-focused.

    Question: {request.question}"""
    return run_agent(ComplianceQuery, request.question, prompt, use_rag=True, agent_slug="compliance")


@app.post("/cloudops-agent")
def cloudops_agent(request: QuestionRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""You are a cloud operations assistant. You help monitor infrastructure, 
    manage costs and handle disaster recovery. Be technical and precise.

    Question: {request.question}"""
    return run_agent(CloudOpsQuery, request.question, prompt, use_rag=True, agent_slug="cloudops")
