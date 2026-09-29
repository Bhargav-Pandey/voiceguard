"""Attendance processing, calculations, and absentee detection."""

from datetime import date

from sqlalchemy import case as sa_case
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from models import Attendance, Lecture, Student, Subject
from utils.helpers import normalize_roll_number

PRESENT = "Present"
ABSENT = "Absent"


def get_or_create_lecture(
    db: Session, subject_id: int, lecture_date: date, lecture_number: int, start_time, end_time
) -> tuple[Lecture, bool]:
    """Fetch the lecture for subject+date+number, creating it when new.

    Returns (lecture, created). Raises ValueError when the same lecture slot
    exists with different times.
    """
    lecture = (
        db.query(Lecture)
        .filter(
            Lecture.subject_id == subject_id,
            Lecture.date == lecture_date,
            Lecture.lecture_number == lecture_number,
        )
        .first()
    )
    if lecture is not None:
        if lecture.start_time != start_time or lecture.end_time != end_time:
            raise ValueError(
                f"Lecture {lecture_number} on {lecture_date} already exists with different times "
                f"({lecture.start_time}-{lecture.end_time})"
            )
        return lecture, False

    lecture = Lecture(
        subject_id=subject_id,
        date=lecture_date,
        lecture_number=lecture_number,
        start_time=start_time,
        end_time=end_time,
    )
    db.add(lecture)
    db.flush()
    return lecture, True


def import_attendance(
    db: Session,
    *,
    lecture: Lecture,
    rows: list[dict],
    marked_by: str | None = None,
) -> dict:
    """Persist validated attendance rows for a lecture.

    Rows missing from the file are NOT stored (partial roster allowed).
    Duplicate student+lecture rows in DB are updated instead of crashing.

    Returns an import result summary.
    """
    rolls = [r["roll_number"] for r in rows]
    students = (
        db.query(Student)
        .filter(Student.roll_number.in_(rolls), Student.is_active.is_(True))
        .all()
    )
    student_by_roll = {s.roll_number: s for s in students}

    result = {
        "stored": 0,
        "updated": 0,
        "invalid_students": [],
        "present": 0,
        "absent": 0,
    }

    for row in rows:
        student = student_by_roll.get(row["roll_number"])
        if student is None:
            result["invalid_students"].append(
                {"row": row["row"], "roll_number": row["roll_number"], "student_name": row["student_name"]}
            )
            continue

        existing = (
            db.query(Attendance)
            .filter(Attendance.student_id == student.id, Attendance.lecture_id == lecture.id)
            .first()
        )
        if existing:
            existing.status = row["status"]
            existing.marked_by = marked_by
            result["updated"] += 1
        else:
            db.add(
                Attendance(
                    student_id=student.id,
                    lecture_id=lecture.id,
                    date=lecture.date,
                    status=row["status"],
                    marked_by=marked_by,
                )
            )
            result["stored"] += 1

        if row["status"] == PRESENT:
            result["present"] += 1
        else:
            result["absent"] += 1

    db.commit()
    return result


def get_absentees_for_lecture(db: Session, lecture_id: int) -> list[dict]:
    """Absent students for a lecture with parent info for notifications."""
    records = (
        db.query(Attendance)
        .join(Attendance.student)
        .filter(Attendance.lecture_id == lecture_id, Attendance.status == ABSENT)
        .all()
    )
    return [
        {
            "student_id": a.student.id,
            "roll_number": a.student.roll_number,
            "student_name": a.student.name,
            "parent_name": a.student.parent_name,
            "parent_mobile": a.student.parent_mobile,
            "parent_email": a.student.parent_email,
        }
        for a in records
    ]


def calculate_student_overall(db: Session) -> list[dict]:
    """Per-student overall attendance: total/present/absent/percentage."""
    rows = (
        db.query(
            Student.id,
            Student.roll_number,
            Student.name,
            Student.branch,
            Student.semester,
            Student.division,
            sa_func.count(Attendance.id).label("total"),
            sa_func.sum(sa_case((Attendance.status == PRESENT, 1), else_=0)).label("present"),
        )
        .join(Attendance, Attendance.student_id == Student.id)
        .filter(Student.is_active.is_(True))
        .group_by(Student.id)
        .order_by(Student.roll_number)
        .all()
    )
    stats = []
    for r in rows:
        total = int(r.total or 0)
        present = int(r.present or 0)
        pct = (present / total * 100) if total else 0.0
        stats.append(
            {
                "student_id": r.id,
                "roll_number": r.roll_number,
                "name": r.name,
                "branch": r.branch,
                "semester": r.semester,
                "division": r.division,
                "total": total,
                "present": present,
                "absent": total - present,
                "percentage": round(pct, 2),
            }
        )
    return stats


def calculate_subject_wise(db: Session, student_id: int | None = None) -> list[dict]:
    """Per student per subject attendance totals."""
    query = (
        db.query(
            Student.roll_number,
            Student.name,
            Subject.code.label("subject_code"),
            Subject.name.label("subject_name"),
            sa_func.count(Attendance.id).label("total"),
            sa_func.sum(sa_case((Attendance.status == PRESENT, 1), else_=0)).label("present"),
        )
        .join(Attendance, Attendance.student_id == Student.id)
        .join(Lecture, Attendance.lecture_id == Lecture.id)
        .join(Subject, Lecture.subject_id == Subject.id)
        .filter(Student.is_active.is_(True))
        .group_by(Student.id, Subject.id)
        .order_by(Student.roll_number, Subject.code)
    )
    if student_id:
        query = query.filter(Student.id == student_id)

    stats = []
    for r in query.all():
        total = int(r.total or 0)
        present = int(r.present or 0)
        pct = (present / total * 100) if total else 0.0
        stats.append(
            {
                "roll_number": r.roll_number,
                "student_name": r.name,
                "subject_code": r.subject_code,
                "subject_name": r.subject_name,
                "total": total,
                "present": present,
                "absent": total - present,
                "percentage": round(pct, 2),
            }
        )
    return stats


def calculate_average_attendance(db: Session) -> float:
    """Average attendance percentage across all students (0 when no data)."""
    overall = calculate_student_overall(db)
    if not overall:
        return 0.0
    return round(sum(s["percentage"] for s in overall) / len(overall), 2)


def get_student_history(db: Session, student_id: int) -> dict:
    """Full attendance history for one student, plus computed totals."""
    records = (
        db.query(Attendance)
        .join(Attendance.lecture)
        .join(Lecture.subject)
        .filter(Attendance.student_id == student_id)
        .order_by(Attendance.date.desc(), Lecture.lecture_number.desc())
        .all()
    )
    history = [
        {
            "date": str(a.date),
            "lecture_number": a.lecture.lecture_number,
            "start_time": str(a.lecture.start_time),
            "end_time": str(a.lecture.end_time),
            "subject_code": a.lecture.subject.code,
            "subject_name": a.lecture.subject.name,
            "status": a.status,
        }
        for a in records
    ]
    total = len(history)
    present = sum(1 for h in history if h["status"] == PRESENT)
    return {
        "records": history,
        "total": total,
        "present": present,
        "absent": total - present,
        "percentage": round((present / total * 100) if total else 0.0, 2),
    }
