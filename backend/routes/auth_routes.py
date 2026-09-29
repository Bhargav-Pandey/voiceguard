"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from extensions import get_db
from models import User
from utils.helpers import create_access_token, get_current_user
from utils.security import verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: str
    role: str


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token = create_access_token(user.username, user.role)
    return TokenResponse(
        access_token=token,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
    )


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"username": user.username, "full_name": user.full_name, "role": user.role}
