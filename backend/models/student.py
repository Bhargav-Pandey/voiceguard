"""Student and parent information."""

from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("roll_number", name="uq_students_roll_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    roll_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    branch: Mapped[str] = mapped_column(String(64), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    division: Mapped[str] = mapped_column(String(8), nullable=False)
    parent_name: Mapped[str] = mapped_column(String(120), nullable=False)
    parent_mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    parent_email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
