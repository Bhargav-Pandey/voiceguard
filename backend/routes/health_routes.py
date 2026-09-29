"""Health check endpoints."""

from fastapi import APIRouter

from extensions import engine
from sqlalchemy import text

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as exc:  # pragma: no cover - defensive
        return {"status": "degraded", "database": str(exc)}
