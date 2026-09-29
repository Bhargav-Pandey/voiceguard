"""Parent notification generation, sending (demo/live), and logging.

DEMO MODE (default): renders the real message, stores it with status
"Simulated Sent", and never touches an external provider. A live provider can
be plugged into _send_via_provider() later without changing callers.
"""

from datetime import date, datetime

from sqlalchemy.orm import Session

from config import COLLEGE_NAME, NOTIFICATION_MODE
from models import Lecture, NotificationLog, Student, Subject

DEFAULT_TEMPLATE = (
    "Dear Parent/Guardian,\n\n"
    "This is to inform you that your ward {student_name} (Roll No: {roll_number}) "
    "was marked absent for the {subject} lecture on {date}, "
    "Lecture {lecture_number}, from {start_time} to {end_time}.\n\n"
    "Regards,\n{college_name}"
)

STATUSES = ("Pending", "Simulated Sent", "Sent", "Failed")


def render_message(
    *,
    student: Student,
    subject: Subject,
    lecture: Lecture,
    template: str = DEFAULT_TEMPLATE,
) -> str:
    """Render the parent notification message from the configured template."""
    return template.format(
        student_name=student.name,
        roll_number=student.roll_number,
        subject=f"{subject.code} - {subject.name}",
        date=lecture.date.isoformat(),
        lecture_number=lecture.lecture_number,
        start_time=lecture.start_time.strftime("%H:%M"),
        end_time=lecture.end_time.strftime("%H:%M"),
        college_name=COLLEGE_NAME,
    )


def _send_via_provider(parent_mobile: str, message: str) -> tuple[str, str | None]:
    """Send through a real provider. Returns (status, failure_reason).

    Not implemented yet: this app runs in demo mode by default. To go live,
    integrate a WhatsApp/SMS API here and return ("Sent", None) on success or
    ("Failed", reason) on failure.
    """
    if NOTIFICATION_MODE == "live":
        return "Failed", "Live provider not configured"
    return "Simulated Sent", None


def generate_notifications_for_lecture(db: Session, lecture_id: int) -> dict:
    """Create + "send" notifications for every absentee of a lecture.

    Idempotent: students who already have a notification for this lecture are
    skipped (prevents duplicates), so calling this repeatedly is safe.
    """
    from services.attendance_service import get_absentees_for_lecture

    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if lecture is None:
        raise ValueError("Lecture not found")

    subject = db.query(Subject).filter(Subject.id == lecture.subject_id).first()
    absentees = get_absentees_for_lecture(db, lecture_id)

    existing = {
        log.student_id
        for log in db.query(NotificationLog).filter(NotificationLog.lecture_id == lecture_id).all()
    }

    result = {"generated": 0, "simulated_sent": 0, "failed": 0, "skipped_existing": 0, "messages": []}

    for absentee in absentees:
        if absentee["student_id"] in existing:
            result["skipped_existing"] += 1
            continue

        student = db.query(Student).filter(Student.id == absentee["student_id"]).first()
        message = render_message(student=student, subject=subject, lecture=lecture)

        status, failure = _send_via_provider(absentee["parent_mobile"], message)

        log = NotificationLog(
            student_id=absentee["student_id"],
            lecture_id=lecture_id,
            parent_name=absentee["parent_name"],
            parent_mobile=absentee["parent_mobile"],
            subject_code=subject.code,
            subject_name=subject.name,
            date=lecture.date.isoformat(),
            lecture_number=lecture.lecture_number,
            channel="whatsapp",
            message=message,
            status=status,
            failure_reason=failure,
            sent_at=datetime.utcnow() if status in ("Simulated Sent", "Sent") else None,
        )
        db.add(log)
        db.flush()

        result["generated"] += 1
        if status in ("Simulated Sent", "Sent"):
            result["simulated_sent"] += 1
        else:
            result["failed"] += 1
        result["messages"].append(
            {
                "id": log.id,
                "student_name": absentee["student_name"],
                "roll_number": absentee["roll_number"],
                "parent_name": absentee["parent_name"],
                "parent_mobile": absentee["parent_mobile"],
                "status": status,
                "message": message,
            }
        )

    db.commit()
    return result


def resend_notification(db: Session, notification_id: int) -> NotificationLog:
    """Re-attempt delivery for a Pending/Failed notification.

    Returns the updated log. Raises ValueError for Simulated Sent/Sent logs so
    the UI can tell the user it was already delivered.
    """
    log = db.query(NotificationLog).filter(NotificationLog.id == notification_id).first()
    if log is None:
        raise ValueError("Notification not found")
    if log.status in ("Simulated Sent", "Sent"):
        raise ValueError(f"Notification was already delivered ({log.status})")

    status, failure = _send_via_provider(log.parent_mobile, log.message)
    log.status = status
    log.failure_reason = failure
    log.sent_at = datetime.utcnow() if status in ("Simulated Sent", "Sent") else None
    db.commit()
    return log
