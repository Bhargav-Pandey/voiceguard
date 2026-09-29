"""Small helpers shared across services and routes."""

from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from extensions import get_db
from models import User
from utils.security import hash_password, verify_password  # noqa: F401  (re-exported)

bearer_scheme = HTTPBearer(auto_error=False)

STATUS_PRESENT = "Present"
STATUS_ABSENT = "Absent"

# Values accepted in the Attendance column of the uploaded Excel file.
ATTENDANCE_ALIASES = {
    "present": STATUS_PRESENT,
    "p": STATUS_PRESENT,
    "1": STATUS_PRESENT,
    "yes": STATUS_PRESENT,
    "y": STATUS_PRESENT,
    "true": STATUS_PRESENT,
    "absent": STATUS_ABSENT,
    "a": "Absent",
    "0": STATUS_ABSENT,
    "no": STATUS_ABSENT,
    "n": STATUS_ABSENT,
    "false": STATUS_ABSENT,
}


def normalize_attendance(value: Any) -> str | None:
    """Return 'Present'/'Absent' for recognized values, else None."""
    if value is None:
        return None
    key = str(value).strip().lower()
    return ATTENDANCE_ALIASES.get(key)


def normalize_roll_number(value: Any) -> str:
    """Trim and normalize a roll number to a comparable string.

    pandas reads numeric roll numbers as floats (101 -> 101.0), so integral
    floats are converted back to plain integers.
    """
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    # Also handle the string form of an integral float, e.g. "101.0".
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def create_access_token(subject: str, role: str) -> str:
    from datetime import datetime, timedelta, timezone

    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the JWT bearer token to a User, or raise 401."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.username == payload["sub"]).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(role: str) -> Callable[..., User]:
    """Dependency factory enforcing a role on top of authentication."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return dependency


def require_any_role(roles: tuple[str, ...]) -> Callable[..., User]:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return dependency
