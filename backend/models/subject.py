"""Subjects offered by the department."""

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("code", name="uq_subjects_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    division: Mapped[str] = mapped_column(String(8), nullable=False)
