"""Notification log endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from extensions import get_db
from models import NotificationLog, Student
from services import notification_service
from utils.helpers import require_any_role

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    search: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    subject_code: str | None = None,
    start: str | None = Query(None, alias="start_date"),
    end: str | None = Query(None, alias="end_date"),
    limit: int = Query(500, le=2000),
    db: Session = Depends(get_db),
):
    query = db.query(NotificationLog).join(Student, NotificationLog.student_id == Student.id)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.name.ilike(like),
                Student.roll_number.ilike(like),
                NotificationLog.parent_name.ilike(like),
                NotificationLog.parent_mobile.ilike(like),
            )
        )
    if status_filter:
        query = query.filter(NotificationLog.status == status_filter.strip())
    if subject_code:
        query = query.filter(NotificationLog.subject_code == subject_code.strip())
    if start:
        try:
            from utils.request_validators import parse_date

            query = query.filter(NotificationLog.date >= parse_date(start).isoformat())
        except ValueError:
            raise HTTPException(422, "Invalid start_date")
    if end:
        try:
            from utils.request_validators import parse_date

            query = query.filter(NotificationLog.date <= parse_date(end).isoformat())
        except ValueError:
            raise HTTPException(422, "Invalid end_date")

    logs = query.order_by(NotificationLog.created_at.desc()).limit(limit).all()

    from models import Lecture

    lecture_ids = {log.lecture_id for log in logs}
    lectures = (
        db.query(Lecture).filter(Lecture.id.in_(lecture_ids)).all() if lecture_ids else []
    )
    lecture_by_id = {l.id: l for l in lectures}

    items = [
        {
            "id": log.id,
            "student_id": log.student_id,
            "student_name": _student_name(db, log.student_id),
            "parent_name": log.parent_name,
            "parent_mobile": log.parent_mobile,
            "subject_code": log.subject_code,
            "subject_name": log.subject_name,
            "date": log.date,
            "lecture_number": log.lecture_number,
            "channel": log.channel,
            "status": log.status,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "failure_reason": log.failure_reason,
            "message": log.message,
        }
        for log in logs
    ]
    return {"items": items, "total": len(items)}


def _student_name(db: Session, student_id: int) -> str:
    student = db.query(Student).filter(Student.id == student_id).first()
    return student.name if student else ""


@router.post("/generate")
def generate_for_lecture(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    """Generate + send notifications for every absentee of one lecture."""
    lecture_id = payload.get("lecture_id")
    if not lecture_id:
        raise HTTPException(422, "lecture_id is required")
    try:
        return notification_service.generate_notifications_for_lecture(db, int(lecture_id))
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.get("/stats")
def notification_stats(db: Session = Depends(get_db)):
    """Aggregate notification counts by status (all time)."""
    from sqlalchemy import func as sa_func

    rows = (
        db.query(NotificationLog.status, sa_func.count(NotificationLog.id))
        .group_by(NotificationLog.status)
        .all()
    )
    counts = {status: int(count) for status, count in rows}
    return {
        "total": sum(counts.values()),
        "pending": counts.get("Pending", 0),
        "simulated_sent": counts.get("Simulated Sent", 0),
        "sent": counts.get("Sent", 0),
        "failed": counts.get("Failed", 0),
    }


@router.get("/{notification_id}")
def get_notification(notification_id: int, db: Session = Depends(get_db)):
    log = db.query(NotificationLog).filter(NotificationLog.id == notification_id).first()
    if log is None:
        raise HTTPException(404, "Notification not found")
    return {
        "id": log.id,
        "student_id": log.student_id,
        "parent_name": log.parent_name,
        "parent_mobile": log.parent_mobile,
        "subject_code": log.subject_code,
        "subject_name": log.subject_name,
        "date": log.date,
        "lecture_number": log.lecture_number,
        "channel": log.channel,
        "message": log.message,
        "status": log.status,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "sent_at": log.sent_at.isoformat() if log.sent_at else None,
        "failure_reason": log.failure_reason,
    }


@router.post("/{notification_id}/resend")
def resend(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    try:
        log = notification_service.resend_notification(db, notification_id)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    return {
        "id": log.id,
        "status": log.status,
        "sent_at": log.sent_at.isoformat() if log.sent_at else None,
        "failure_reason": log.failure_reason,
    }
