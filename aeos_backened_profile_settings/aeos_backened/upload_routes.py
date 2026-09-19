"""
New, isolated file: adds one endpoint (POST /rag/upload) that lets an
authenticated user add a document to the EXISTING RAG knowledge base.

Reuses, without modifying:
- get_current_user / get_db from auth_routes.py (same auth as every other
  protected route - no new auth mechanism)
- rag/documents/knowledge.txt (the same file the existing pipeline reads)
- the existing chunk_documents.py / create_embeddings.py /
  create_vector_store.py scripts, invoked unmodified via rag/reindex.py

Does not touch retriever.py at all - once the index is rebuilt, existing
retrieval automatically has access to the new content, because it always
reads directly from the same index files on every search() call.
"""
import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from auth_routes import get_current_user, get_db
from models import User, UploadedDocument
from rag.file_extract import extract_text, UnsupportedFileTypeError, FileExtractionError, SUPPORTED_EXTENSIONS
from rag.reindex import rebuild_index, ReindexError

logger = logging.getLogger("aeos_backend.upload")

router = APIRouter(prefix="/rag", tags=["rag-upload"])

KNOWLEDGE_PATH = Path(__file__).parent / "rag" / "documents" / "knowledge.txt"

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB, generous for text-based docs

# Same slugs already used by orchestrator.AGENT_REGISTRY / the 11 agent
# endpoints in main.py - reused here, not reinvented, so an uploaded
# document can be tagged to the same agent identity the rest of the
# system already uses.
KNOWN_AGENT_SLUGS = {
    "hr", "finance", "sales", "procurement", "legal", "cybersecurity",
    "marketing", "analytics", "compliance", "cloudops", "support",
}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    agent: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Adds an uploaded file's text content to the existing RAG knowledge
    base and rebuilds the existing index so it's immediately searchable.

    If `agent` is given (one of the existing agent slugs, e.g. "hr"), the
    uploaded content is tagged to that agent, so retrieve_relevant_context()
    only surfaces it to that specific agent - keeping the 11 agents'
    uploaded knowledge separate, as intended. If `agent` is omitted, the
    content is available to every agent (same as before this change).
    """
    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File is too large. Maximum size is {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    agent_slug = agent.strip().lower() if agent and agent.strip().lower() in KNOWN_AGENT_SLUGS else None

    try:
        extracted_text = extract_text(file.filename, file_bytes)
    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileExtractionError as e:
        logger.error("Failed to extract text from upload '%s': %s", file.filename, e)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text was found in this file.",
        )

    # Append to the SAME knowledge.txt the existing pipeline already reads.
    #
    # The existing chunk_documents.py splits the file into "sections" on
    # blank lines, then groups sections into chunks. A multi-paragraph
    # upload therefore becomes multiple sections - so the source tag is
    # written onto EVERY paragraph of the upload (not just the first),
    # otherwise only the first paragraph would carry attribution and any
    # later paragraph could get silently re-labeled by whatever unrelated
    # section it ends up chunked next to.
    #
    # The tag also records the target agent (when given) in a small
    # machine-parseable suffix that rag_service.py's existing chunk-label
    # helper already knows how to read; the display label shown to users
    # is still just "Uploaded Document: <filename>".
    tag_suffix = f" [agent:{agent_slug}]" if agent_slug else ""
    section_header = f"Uploaded Document: {file.filename}{tag_suffix}"

    paragraphs = [p.strip() for p in extracted_text.strip().split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [extracted_text.strip()]
    tagged_blocks = [f"{section_header}\n{p}" for p in paragraphs]
    new_section = "\n\n" + "\n\n".join(tagged_blocks)

    try:
        with open(KNOWLEDGE_PATH, "a", encoding="utf-8") as f:
            f.write(new_section)
    except OSError as e:
        logger.error("Failed to write uploaded content to knowledge base: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save the uploaded content.")

    # rebuild_index() runs the existing indexing scripts via subprocess,
    # which blocks for real wall-clock time. Running it directly here
    # (in this async endpoint) would block FastAPI's whole event loop for
    # that entire duration, stalling every other in-flight request on the
    # server - including a totally unrelated agent's chat request - which
    # is what produced the intermittent "Sorry, I couldn't reach the
    # server" errors. asyncio.to_thread() moves the blocking work onto a
    # separate thread so the event loop stays free to serve other
    # requests while re-indexing runs. This does not change what
    # rebuild_index() does or how indexing works - only how it's called.
    try:
        await asyncio.to_thread(rebuild_index)
    except ReindexError as e:
        logger.error("Failed to rebuild RAG index after upload of '%s': %s", file.filename, e)
        raise HTTPException(
            status_code=500,
            detail=f"The file was saved but the search index could not be rebuilt: {str(e)}. "
                    "The document may not be searchable yet.",
        )

    record = UploadedDocument(filename=file.filename, uploaded_by_user_id=current_user.id)
    db.add(record)
    db.commit()

    logger.info(
        "Document '%s' (agent=%s) uploaded by user_id=%s and added to the RAG knowledge base.",
        file.filename, agent_slug or "all", current_user.id,
    )

    scope_text = f"the {agent_slug.upper()} agent" if agent_slug else "all agents"
    return {
        "message": f"'{file.filename}' was added to the knowledge base and is now searchable by {scope_text}.",
        "filename": file.filename,
        "agent": agent_slug,
    }


@router.get("/uploads")
def list_uploads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists previously uploaded documents (filename + who/when)."""
    docs = db.query(UploadedDocument).order_by(UploadedDocument.created_at.desc()).all()
    return [
        {"id": d.id, "filename": d.filename, "uploaded_at": d.created_at}
        for d in docs
    ]

