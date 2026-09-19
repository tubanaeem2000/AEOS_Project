"""
Re-runs the EXISTING, UNMODIFIED indexing pipeline scripts
(chunk_documents.py -> create_embeddings.py -> create_vector_store.py)
after new content is appended to rag/documents/knowledge.txt.

This deliberately does not reimplement chunking/embedding/indexing logic -
it just invokes the three scripts exactly as a person would run them from
the command line, in the same order, using the same interpreter. This
guarantees the upload feature reuses the real existing RAG pipeline rather
than a second, parallel implementation.
"""
import subprocess
import sys
from pathlib import Path

RAG_DIR = Path(__file__).parent


class ReindexError(Exception):
    pass


def rebuild_index() -> None:
    """
    Runs the three existing pipeline scripts in order. Raises ReindexError
    with the failing script's output if any step fails, so a failed
    upload never silently leaves a half-rebuilt/inconsistent index.
    """
    for script in ("chunk_documents.py", "create_embeddings.py", "create_vector_store.py"):
        result = subprocess.run(
            [sys.executable, str(RAG_DIR / script)],
            cwd=str(RAG_DIR),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            raise ReindexError(
                f"{script} failed (exit code {result.returncode}): {result.stderr.strip()[:500]}"
            )
