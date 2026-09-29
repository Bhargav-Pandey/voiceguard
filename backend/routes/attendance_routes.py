"""Attendance upload, records, stats, absentees, and report endpoints."""

import io
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func as sa_func, or_
from sqlalchemy.orm import Session

from extensions import get_db
from models import Attendance, Lecture, NotificationLog, Student, Subject
from services import attendance_service, excel_service, notification_service
from utils.helpers import require_any_role
from utils.request_validators import parse_date, parse_time

router = APIRouter(tags=["attendance"])


# ---------------------------------------------------------------------------
# Upload workflow: validate -> preview -> confirm
# ---------------------------------------------------------------------------


@router.post("/attendance/upload")
async def upload_attendance(
    file: UploadFile = File(...),
    subject_id: int = Form(...),
    lecture_date: str = Form(..., alias="date"),
    lecture_number: int = Form(...),
    start_time: str = Form(...),
    end_time: str = Form(...),
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    """Validate the Excel file and return a preview (does not store anything)."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if subject is None:
        raise HTTPException(404, "Subject not found")

    content = await file.read()
    try:
        df = excel_service.read_attendance_dataframe(content)
        valid_rows, errors, summary = excel_service.validate_attendance_df(df)
    except excel_service.ExcelValidationError as exc:
        raise HTTPException(422, str(exc))

    # Which rolls are unknown to the database?
    rolls = [r["roll_number"] for r in valid_rows]
    known = (
        db.query(Student.roll_number)
        .filter(Student.roll_number.in_(rolls), Student.is_active.is_(True))
        .all()
        if rolls
        else []
    )
    known_rolls = {r for (r,) in known}
    invalid_students = [
        {"row": r["row"], "roll_number": r["roll_number"], "student_name": r["student_name"]}
        for r in valid_rows
        if r["roll_number"] not in known_rolls
    ]

    try:
        parsed_date = parse_date(lecture_date)
        st = parse_time(start_time)
        et = parse_time(end_time)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    if et <= st:
        raise HTTPException(422, "End time must be after start time")

    return {
        "subject": {"id": subject.id, "code": subject.code, "name": subject.name},
        "lecture": {
            "date": parsed_date.isoformat(),
            "lecture_number": lecture_number,
            "start_time": start_time,
            "end_time": end_time,
        },
        "summary": summary,
        "errors": errors,
        "invalid_students": invalid_students,
        "valid_rows": valid_rows,
    }


@router.post("/attendance/confirm")
def confirm_attendance(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    """Store attendance for valid rows, then generate notifications for absentees.

    Expected payload: {subject_id, date, lecture_number, start_time, end_time,
                       rows: [{row, roll_number, student_name, status}]}
    """
    required = ("subject_id", "date", "lecture_number", "start_time", "end_time", "rows")
    missing = [f for f in required if f not in payload]
    if missing:
        raise HTTPException(422, f"Missing required fields: {', '.join(missing)}")

    subject = db.query(Subject).filter(Subject.id == payload["subject_id"]).first()
    if subject is None:
        raise HTTPException(404, "Subject not found")

    try:
        lecture_date = parse_date(str(payload["date"]))
        start_t = parse_time(str(payload["start_time"]))
        end_t = parse_time(str(payload["end_time"]))
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    rows = payload.get("rows") or []
    if not rows:
        raise HTTPException(422, "No rows to import")

    try:
        lecture, created = attendance_service.get_or_create_lecture(
            db, payload["subject_id"], lecture_date, int(payload["lecture_number"]), start_t, end_t
        )
        result = attendance_service.import_attendance(
            db, lecture=lecture, rows=rows, marked_by=user.username
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc))

    notifications = notification_service.generate_notifications_for_lecture(db, lecture.id)

    return {
        "lecture_id": lecture.id,
        "lecture_created": created,
        "stored": result["stored"],
        "updated": result["updated"],
        "invalid_students": result["invalid_students"],
        "present": result["present"],
        "absent": result["absent"],
        "notifications": notifications,
    }


# ---------------------------------------------------------------------------
# Lectures listing (dashboard table)
# ---------------------------------------------------------------------------


@router.get("/attendance/lectures")
def list_lectures(
    date_str: str | None = Query(None, alias="date"),
    subject_id: int | None = None,
    with_counts: bool = False,
    db: Session = Depends(get_db),
):
    try:
        day = parse_date(date_str) if date_str else datetime.now().date()
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    query = db.query(Lecture).filter(Lecture.date == day)
    if subject_id:
        query = query.filter(Lecture.subject_id == subject_id)
    lectures = query.order_by(Lecture.lecture_number).all()

    items = []
    for lecture in lectures:
        subject = db.query(Subject).filter(Subject.id == lecture.subject_id).first()
        present_count = absent_count = None
        if with_counts:
            counts = (
                db.query(Attendance.status, sa_func.count(Attendance.id))
                .filter(Attendance.lecture_id == lecture.id)
                .group_by(Attendance.status)
                .all()
            )
            count_map = {status: int(count) for status, count in counts}
            present_count = count_map.get("Present", 0)
            absent_count = count_map.get("Absent", 0)
        items.append(
            {
                "id": lecture.id,
                "subject_id": lecture.subject_id,
                "subject_code": subject.code if subject else "",
                "subject_name": subject.name if subject else "",
                "date": str(lecture.date),
                "lecture_number": lecture.lecture_number,
                "start_time": str(lecture.start_time),
                "end_time": str(lecture.end_time),
                "present_count": present_count,
                "absent_count": absent_count,
            }
        )
    return {"date": day.isoformat(), "items": items, "total": len(items)}


# ---------------------------------------------------------------------------
# Records listing with filters
# ---------------------------------------------------------------------------


@router.get("/attendance")
def list_attendance(
    search: str | None = None,
    subject_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    start: str | None = Query(None, alias="start_date"),
    end: str | None = Query(None, alias="end_date"),
    limit: int = Query(500, le=2000),
    db: Session = Depends(get_db),
):
    try:
        start_d = parse_date(start) if start else None
        end_d = parse_date(end) if end else None
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    query = (
        db.query(Attendance)
        .join(Attendance.student)
        .join(Attendance.lecture)
        .join(Lecture.subject)
    )
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(Student.name.ilike(like), Student.roll_number.ilike(like)))
    if subject_id:
        query = query.filter(Lecture.subject_id == subject_id)
    if status_filter:
        normalized = status_filter.strip().capitalize()
        if normalized not in ("Present", "Absent"):
            raise HTTPException(422, "status must be Present or Absent")
        query = query.filter(Attendance.status == normalized)
    if start_d:
        query = query.filter(Attendance.date >= start_d)
    if end_d:
        query = query.filter(Attendance.date <= end_d)

    records = query.order_by(Attendance.date.desc(), Lecture.lecture_number.desc()).limit(limit).all()
    return {
        "items": [
            {
                "id": a.id,
                "roll_number": a.student.roll_number,
                "student_name": a.student.name,
                "subject_code": a.lecture.subject.code,
                "subject_name": a.lecture.subject.name,
                "date": str(a.date),
                "lecture_number": a.lecture.lecture_number,
                "start_time": str(a.lecture.start_time),
                "end_time": str(a.lecture.end_time),
                "status": a.status,
            }
            for a in records
        ],
        "total": len(records),
    }


# ---------------------------------------------------------------------------
# Dashboard statistics (all computed from the database)
# ---------------------------------------------------------------------------


@router.get("/attendance/stats")
def attendance_stats(
    date_str: str | None = Query(None, alias="date"),
    subject_id: int | None = None,
    semester: int | None = None,
    division: str | None = None,
    db: Session = Depends(get_db),
):
    """Dashboard numbers: today's lectures, present/absent, notifications, average."""
    try:
        day = parse_date(date_str) if date_str else datetime.now().date()
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    day_start = datetime.combine(day, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    lectures_q = db.query(Lecture).filter(Lecture.date == day)
    attendance_q = db.query(Attendance).filter(Attendance.date == day)
    if subject_id:
        lectures_q = lectures_q.join(Lecture.subject).filter(Lecture.subject_id == subject_id)
        attendance_q = attendance_q.join(Attendance.lecture).filter(Lecture.subject_id == subject_id)
    if semester or division:
        attendance_q = attendance_q.join(Attendance.student).filter(
            *( [Student.semester == semester] if semester else [] ),
            *( [Student.division == division] if division else [] ),
        )

    lectures = lectures_q.all()
    attendance_rows = attendance_q.all()
    present_today = sum(1 for a in attendance_rows if a.status == "Present")
    absent_today = sum(1 for a in attendance_rows if a.status == "Absent")

    total_students = (
        db.query(sa_func.count(Student.id))
        .filter(
            Student.is_active.is_(True),
            *([Student.semester == semester] if semester else []),
            *([Student.division == division] if division else []),
        )
        .scalar()
        or 0
    )

    notif_q = db.query(NotificationLog).filter(
        NotificationLog.created_at >= day_start,
        NotificationLog.created_at < day_end,
    )
    notifications_generated = notif_q.count()
    notifications_sent = notif_q.filter(NotificationLog.status.in_(("Sent", "Simulated Sent"))).count()
    notifications_failed = notif_q.filter(NotificationLog.status == "Failed").count()

    average = attendance_service.calculate_average_attendance(db)

    return {
        "date": day.isoformat(),
        "total_students": total_students,
        "lectures_today": len(lectures),
        "present_today": present_today,
        "absent_today": absent_today,
        "notifications_generated": notifications_generated,
        "notifications_sent": notifications_sent,
        "notifications_failed": notifications_failed,
        "average_attendance": average,
    }


# ---------------------------------------------------------------------------
# Absentees for a lecture
# ---------------------------------------------------------------------------


@router.get("/attendance/absentees")
def absentees(
    date_str: str | None = Query(None, alias="date"),
    subject_id: int | None = None,
    db: Session = Depends(get_db),
):
    try:
        day = parse_date(date_str) if date_str else datetime.now().date()
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    lectures_q = db.query(Lecture).filter(Lecture.date == day)
    if subject_id:
        lectures_q = lectures_q.filter(Lecture.subject_id == subject_id)
    lectures = lectures_q.all()

    items = []
    for lecture in lectures:
        subject = db.query(Subject).filter(Subject.id == lecture.subject_id).first()
        absent_records = (
            db.query(Attendance)
            .join(Attendance.student)
            .filter(Attendance.lecture_id == lecture.id, Attendance.status == "Absent")
            .all()
        )
        # Latest notification per student for this lecture, if any.
        logs = (
            db.query(NotificationLog)
            .filter(NotificationLog.lecture_id == lecture.id)
            .all()
        )
        notif_by_student = {}
        for log in logs:
            notif_by_student[log.student_id] = log

        for record in absent_records:
            log = notif_by_student.get(record.student.id)
            items.append(
                {
                    "attendance_id": record.id,
                    "student_id": record.student.id,
                    "roll_number": record.student.roll_number,
                    "student_name": record.student.name,
                    "subject_code": subject.code if subject else "",
                    "subject_name": subject.name if subject else "",
                    "date": str(lecture.date),
                    "lecture_number": lecture.lecture_number,
                    "parent_name": record.student.parent_name,
                    "parent_mobile": record.student.parent_mobile,
                    "notification_status": log.status if log else "Not Sent",
                    "notification_id": log.id if log else None,
                }
            )

    items.sort(key=lambda x: (x["subject_code"], x["roll_number"]))
    return {"date": day.isoformat(), "items": items, "total": len(items)}


# ---------------------------------------------------------------------------
# Reports (Excel downloads via excel_service)
# ---------------------------------------------------------------------------


@router.get("/reports/daily")
def report_daily(
    date_str: str = Query(..., alias="date"),
    db: Session = Depends(get_db),
):
    try:
        day = parse_date(date_str)
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    records = (
        db.query(Attendance)
        .join(Attendance.student)
        .join(Attendance.lecture)
        .join(Lecture.subject)
        .filter(Attendance.date == day)
        .order_by(Lecture.subject_id, Lecture.lecture_number, Student.roll_number)
        .all()
    )
    data = [
        {
            "roll_number": a.student.roll_number,
            "student_name": a.student.name,
            "subject_code": a.lecture.subject.code,
            "subject_name": a.lecture.subject.name,
            "date": a.date,
            "lecture_number": a.lecture.lecture_number,
            "status": a.status,
        }
        for a in records
    ]
    content = excel_service.build_daily_report(data)
    filename = f"daily_attendance_{day.isoformat()}.xlsx"
    return _xlsx_response(content, filename)


@router.get("/reports/overall")
def report_overall(db: Session = Depends(get_db)):
    stats = attendance_service.calculate_student_overall(db)
    content = excel_service.build_overall_report(stats)
    return _xlsx_response(content, "overall_attendance.xlsx")


@router.get("/reports/subject-wise")
def report_subject_wise(db: Session = Depends(get_db)):
    stats = attendance_service.calculate_subject_wise(db)
    content = excel_service.build_subject_report(stats)
    return _xlsx_response(content, "subject_wise_attendance.xlsx")


@router.get("/reports/notifications")
def report_notifications(db: Session = Depends(get_db)):
    logs = db.query(NotificationLog).order_by(NotificationLog.created_at.desc()).all()
    student_ids = {log.student_id for log in logs}
    students = (
        db.query(Student).filter(Student.id.in_(student_ids)).all() if student_ids else []
    )
    students_by_id = {s.id: s for s in students}
    data = [
        {
            "roll_number": students_by_id[log.student_id].roll_number if log.student_id in students_by_id else "",
            "student_name": students_by_id[log.student_id].name if log.student_id in students_by_id else "",
            "parent_name": log.parent_name,
            "parent_mobile": log.parent_mobile,
            "subject_code": log.subject_code,
            "subject_name": log.subject_name,
            "date": log.date,
            "lecture_number": log.lecture_number,
            "channel": log.channel,
            "status": log.status,
            "created_at": log.created_at,
            "sent_at": log.sent_at,
            "failure_reason": log.failure_reason,
        }
        for log in logs
    ]
    content = excel_service.build_notification_report(data)
    return _xlsx_response(content, "parent_notifications.xlsx")


def _xlsx_response(content: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
