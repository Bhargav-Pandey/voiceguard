"""FastAPI application entrypoint."""

import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Ensure `backend/` is importable regardless of the working directory the
# managed server (or any launcher) uses to start this file.
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import COLLEGE_NAME  # noqa: E402

from utils.errors import register_error_handlers  # noqa: E402
from utils.logging_config import configure_logging  # noqa: E402

logger = logging.getLogger("attendance")

configure_logging()

app = FastAPI(
    title="Attendance Alert System",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

register_error_handlers(app)

# Simple top-level health endpoint for the managed preview proxy.
# (/api/health is provided by routes/health_routes.py.)
@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": "attendance-alert-system",
        "college": COLLEGE_NAME,
    }

# Create tables and seed the default users on startup.
from extensions import SessionLocal, engine  # noqa: E402
from models import Base, User  # noqa: E402
from utils.security import hash_password  # noqa: E402

Base.metadata.create_all(bind=engine)


def seed_users() -> None:
    """Create default admin/faculty accounts if the users table is empty."""
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add_all(
                [
                    User(
                        username="admin",
                        password_hash=hash_password("admin123"),
                        full_name="System Administrator",
                        role="admin",
                    ),
                    User(
                        username="faculty",
                        password_hash=hash_password("faculty123"),
                        full_name="Demo Faculty",
                        role="faculty",
                    ),
                ]
            )
            db.commit()
            logger.info("Seeded default users (admin/admin123, faculty/faculty123)")
    finally:
        db.close()


seed_users()

# API routers under /api
import routes  # noqa: E402  (registers all routers on app)

for router in routes.all_routers:
    app.include_router(router, prefix="/api")

# Root route serves the login page explicitly.
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(FRONTEND_DIR / "index.html")


# Static frontend assets (css/js) plus the other pages, without a catch-all
# that would swallow API 404s.
app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")


@app.get("/{page_name}", include_in_schema=False)
def serve_page(page_name: str):
    """Serve frontend/*.html pages (/dashboard.html or /dashboard)."""
    name = page_name if page_name.endswith(".html") else f"{page_name}.html"
    candidate = (FRONTEND_DIR / name).resolve()
    if candidate.parent != FRONTEND_DIR or not candidate.is_file():
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return FileResponse(candidate)
