"""FastAPI application entrypoint."""

import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from config import BASE_DIR
from extensions import SessionLocal, engine
from utils.errors import register_error_handlers
from utils.logging_config import configure_logging

logger = logging.getLogger("attendance")

configure_logging()

app = FastAPI(title="Attendance Alert System", version="1.0.0")

register_error_handlers(app)

# Create tables and seed the default users on startup.
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

import routes  # noqa: E402  (registers all routers on app)

for router in routes.all_routers:
    app.include_router(router, prefix="/api")

FRONTEND_DIR = BASE_DIR.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
