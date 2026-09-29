"""A lecture: one scheduled class of a subject on a date."""

from datetime import date, time

from sqlalchemy import Date, ForeignKey, Integer, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Lecture(Base):
    __tablename__ = "lectures"
    __table_args__ = (
        UniqueConstraint(
            "subject_id", "date", "lecture_number", name="uq_lectures_subject_date_number"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    lecture_number: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    subject = relationship("Subject", lazy="joined")
