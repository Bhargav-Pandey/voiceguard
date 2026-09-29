"""Application configuration loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./attendance.db")

# Notification settings. DEMO_MODE avoids any real provider dependency.
NOTIFICATION_MODE = os.getenv("NOTIFICATION_MODE", "demo")  # demo | live
COLLEGE_NAME = os.getenv("COLLEGE_NAME", "Example College of Engineering")

# Upload limits
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "5"))
