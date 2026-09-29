"""Student and subject management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from extensions import get_db
from models import Student, Subject
from services import attendance_service
from utils.helpers import require_any_role
from utils.validators import is_valid_mobile

router = APIRouter(tags=["students"])


class StudentIn(BaseModel):
    roll_number: str
    name: str
    branch: str
    semester: int
    division: str
    parent_name: str
    parent_mobile: str
    parent_email: str | None = None


def _serialize_student(s: Student) -> dict:
    return {
        "id": s.id,
        "roll_number": s.roll_number,
        "name": s.name,
        "branch": s.branch,
        "semester": s.semester,
        "division": s.division,
        "parent_name": s.parent_name,
        "parent_mobile": s.parent_mobile,
        "parent_email": s.parent_email,
        "is_active": s.is_active,
    }


@router.get("/students")
def list_students(
    search: str | None = None,
    semester: int | None = None,
    division: str | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Student)
    if not include_inactive:
        query = query.filter(Student.is_active.is_(True))
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(Student.name.ilike(like), Student.roll_number.ilike(like)))
    if semester:
        query = query.filter(Student.semester == semester)
    if division:
        query = query.filter(Student.division == division)
    students = query.order_by(Student.roll_number).all()
    return {"items": [_serialize_student(s) for s in students], "total": len(students)}


@router.post("/students", status_code=201)
def create_student(
    payload: StudentIn,
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    if not is_valid_mobile(payload.parent_mobile):
        raise HTTPException(422, "Invalid parent mobile number")
    if db.query(Student).filter(Student.roll_number == payload.roll_number.strip()).first():
        raise HTTPException(409, f"Roll number {payload.roll_number} already exists")
    student = Student(**payload.model_dump())
    student.roll_number = payload.roll_number.strip()
    db.add(student)
    db.commit()
    db.refresh(student)
    return _serialize_student(student)


@router.put("/students/{student_id}")
def update_student(
    student_id: int,
    payload: StudentIn,
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(404, "Student not found")
    if not is_valid_mobile(payload.parent_mobile):
        raise HTTPException(422, "Invalid parent mobile number")
    duplicate = (
        db.query(Student)
        .filter(Student.roll_number == payload.roll_number.strip(), Student.id != student_id)
        .first()
    )
    if duplicate:
        raise HTTPException(409, f"Roll number {payload.roll_number} already exists")

    for key, value in payload.model_dump().items():
        setattr(student, key, value)
    student.roll_number = payload.roll_number.strip()
    db.commit()
    db.refresh(student)
    return _serialize_student(student)


@router.delete("/students/{student_id}")
def deactivate_student(
    student_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    """Soft-delete: keep attendance history intact."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(404, "Student not found")
    student.is_active = False
    db.commit()
    return {"ok": True, "id": student_id, "is_active": False}


@router.get("/students/{student_id}/history")
def student_history(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(404, "Student not found")
    history = attendance_service.get_student_history(db, student_id)
    return {"student": _serialize_student(student), **history}


@router.get("/subjects")
def list_subjects(semester: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Subject)
    if semester:
        query = query.filter(Subject.semester == semester)
    subjects = query.order_by(Subject.code).all()
    return {
        "items": [
            {"id": s.id, "code": s.code, "name": s.name, "semester": s.semester, "division": s.division}
            for s in subjects
        ],
        "total": len(subjects),
    }


@router.post("/subjects", status_code=201)
def create_subject(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(require_any_role(("admin", "faculty"))),
):
    required = ("code", "name", "semester", "division")
    missing = [f for f in required if not str(payload.get(f) or "").strip()]
    if missing:
        raise HTTPException(422, f"Missing required fields: {', '.join(missing)}")
    if db.query(Subject).filter(Subject.code == str(payload["code"]).strip()).first():
        raise HTTPException(409, f"Subject code {payload['code']} already exists")
    subject = Subject(
        code=str(payload["code"]).strip(),
        name=str(payload["name"]).strip(),
        semester=int(payload["semester"]),
        division=str(payload["division"]).strip(),
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return {"id": subject.id, "code": subject.code, "name": subject.name}
