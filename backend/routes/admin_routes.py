"""Admin endpoints (admin role required)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from extensions import get_db
from models import User
from utils.helpers import require_role
from utils.security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


class UserIn(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "faculty"


@router.get("/users")
def list_users(db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    users = db.query(User).order_by(User.username).all()
    return {
        "items": [
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": len(users),
    }


@router.post("/users", status_code=201)
def create_user(payload: UserIn, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    if payload.role not in ("admin", "faculty"):
        raise HTTPException(422, "role must be 'admin' or 'faculty'")
    if db.query(User).filter(User.username == payload.username.strip()).first():
        raise HTTPException(409, "Username already exists")
    new_user = User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=payload.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {
        "id": new_user.id,
        "username": new_user.username,
        "full_name": new_user.full_name,
        "role": new_user.role,
    }
