"""End-to-end smoke test for the complete workflow.

Run from backend/:  python smoke_test.py
Uses a throwaway SQLite DB (attendance.db is reset at each run of this file's
setup) and exercises: auth, students, subjects, Excel validation, import,
absentee detection, notifications, resend, stats, history, reports.
"""

import io

from fastapi.testclient import TestClient

import app as app_module
from extensions import SessionLocal, engine
from models import Base

Base.metadata.create_all(bind=engine)
client = TestClient(app_module.app)

PASS = []
FAIL = []


def check(name, condition, extra=""):
    (PASS if condition else FAIL).append(name)
    print(("PASS" if condition else "FAIL") + f" - {name} {extra}")


# --- Health ---
r = client.get("/api/health")
check("health", r.status_code == 200 and r.json()["status"] == "ok", r.text[:80])

# --- Login: bad then good ---
r = client.post("/api/auth/login", data={"username": "admin", "password": "wrong"})
check("login rejects bad password", r.status_code == 401)
r = client.post("/api/auth/login", data={"username": "faculty", "password": "faculty123"})
check("login ok", r.status_code == 200, "")
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# --- Auth required for students creation ---
r = client.post(
    "/api/students",
    json={"roll_number": "X1", "name": "No Auth", "branch": "IT", "semester": 1,
          "division": "A", "parent_name": "P", "parent_mobile": "9876500000"},
)
check("create student requires auth", r.status_code in (401, 403))

# --- Students CRUD ---
student_payload = {
    "roll_number": "101", "name": "Rahul Sharma", "branch": "Computer", "semester": 3,
    "division": "A", "parent_name": "Suresh Sharma", "parent_mobile": "9876500001",
}
r = client.post("/api/students", json=student_payload, headers=H)
check("create student 101", r.status_code == 201, r.text[:120])
r = client.post("/api/students", json=student_payload, headers=H)
check("duplicate roll rejected", r.status_code == 409)
r = client.post(
    "/api/students",
    json={**student_payload, "roll_number": "102", "name": "Aman Patil", "parent_mobile": "bad"},
    headers=H,
)
check("invalid mobile rejected", r.status_code == 422)
client.post(
    "/api/students",
    json={**student_payload, "roll_number": "102", "name": "Aman Patil", "parent_name": "Vivek Patil", "parent_mobile": "9876500002"},
    headers=H,
)
r = client.get("/api/students")
check("list students", r.status_code == 200 and r.json()["total"] == 2)

# --- Subjects ---
r = client.post("/api/subjects", json={"code": "CS301", "name": "DBMS", "semester": 3, "division": "A"}, headers=H)
check("create subject", r.status_code == 201)
r = client.post("/api/subjects", json={"code": "CS301", "name": "DBMS", "semester": 3, "division": "A"}, headers=H)
check("duplicate subject rejected", r.status_code == 409)
r = client.get("/api/subjects")
check("list subjects", r.json()["total"] == 1)
subject_id = r.json()["items"][0]["id"]

# --- Excel upload: mixed validity file ---
rows = [
    ("Roll No", "Student Name", "Attendance"),
    ("101", "Rahul Sharma", "Present"),
    ("102", "Aman Patil", "absent"),
    ("101", "Rahul Sharma", "P"),        # duplicate in file
    ("999", "Ghost Student", "Present"), # unknown roll (will pass validation, fail at import)
    ("103", "No Status", "Maybe"),       # invalid status
    ("", "Missing Roll", "Present"),     # missing roll
]
import pandas as pd

buf = io.BytesIO()
pd.DataFrame(rows[1:], columns=list(rows[0])).to_excel(buf, index=False, engine="openpyxl")
buf.seek(0)

r = client.post(
    "/api/attendance/upload",
    files={"file": ("attendance.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    data={"subject_id": str(subject_id), "date": "2026-09-29", "lecture_number": "1",
          "start_time": "09:00", "end_time": "10:00"},
    headers=H,
)
check("upload validation 200", r.status_code == 200, r.text[:150])
preview = r.json()
check("preview summary correct",
      preview["summary"] == {"total_rows": 6, "valid_rows": 3, "error_rows": 3,
                             "present": 2, "absent": 1},
      str(preview["summary"]))
check("unknown student flagged", any(u["roll_number"] == "999" for u in preview["invalid_students"]))
check("invalid status error listed", any("Maybe" in e["error"] for e in preview["errors"]))

# --- Bad column file ---
buf2 = io.BytesIO()
pd.DataFrame({"Roll": ["101"], "Name": ["Rahul"], "Status": ["Present"]}).to_excel(buf2, index=False)
buf2.seek(0)
r = client.post(
    "/api/attendance/upload",
    files={"file": ("bad.xlsx", buf2, "application/octet-stream")},
    data={"subject_id": str(subject_id), "date": "2026-09-29", "lecture_number": "1",
          "start_time": "09:00", "end_time": "10:00"},
    headers=H,
)
check("missing columns rejected", r.status_code == 422)

# --- Confirm import ---
confirm_payload = {
    "subject_id": subject_id,
    "date": "2026-09-29",
    "lecture_number": 1,
    "start_time": "09:00",
    "end_time": "10:00",
    "rows": [r_ for r_ in preview["valid_rows"]],  # includes 999 (unknown)
}
r = client.post("/api/attendance/confirm", json=confirm_payload, headers=H)
check("confirm import 200", r.status_code == 200, r.text[:200])
result = r.json()
check("stored 2 (unknown skipped)", result["stored"] == 2 and result["present"] == 1 and result["absent"] == 1, str(result))
check("notification generated for 1 absentee", result["notifications"]["generated"] == 1
      and result["notifications"]["simulated_sent"] == 1)
check("notification marked Simulated Sent", result["notifications"]["messages"][0]["status"] == "Simulated Sent")

# --- Duplicate prevention: re-confirm same data ---
r = client.post("/api/attendance/confirm", json=confirm_payload, headers=H)
result2 = r.json()
check("re-import updates not duplicates", result2["updated"] == 2 and result2["stored"] == 0)
check("no duplicate notifications", result2["notifications"]["generated"] == 0
      and result2["notifications"]["skipped_existing"] == 1)

# --- Records listing ---
r = client.get("/api/attendance")
check("records list", r.status_code == 200 and r.json()["total"] == 2)
r = client.get("/api/attendance?status=absent")
check("filter status=absent", r.json()["total"] == 1)
r = client.get("/api/attendance?search=rahul")
check("search by name", r.json()["total"] == 1)

# --- Lectures + stats ---
r = client.get("/api/attendance/lectures?date=2026-09-29&with_counts=1")
check("lectures listed", r.json()["total"] == 1 and r.json()["items"][0]["absent_count"] == 1)
r = client.get("/api/attendance/stats?date=2026-09-29")
stats = r.json()
check("stats computed", stats["lectures_today"] == 1 and stats["present_today"] == 1
      and stats["absent_today"] == 1 and stats["notifications_generated"] == 1
      and stats["notifications_sent"] == 1 and stats["total_students"] == 2, str(stats))
check("average attendance 50%", stats["average_attendance"] == 50.0, str(stats["average_attendance"]))

# --- Absentees ---
r = client.get("/api/attendance/absentees?date=2026-09-29")
items = r.json()["items"]
check("absentees listed", len(items) == 1 and items[0]["roll_number"] == "102")
check("absentee has notification status", items[0]["notification_status"] == "Simulated Sent")

# --- Notifications endpoints ---
r = client.get("/api/notifications")
check("notifications listed", r.json()["total"] == 1)
notif = r.json()["items"][0]
check("message contains student name", "Aman Patil" in notif["message"])
check("message contains subject", "CS301" in notif["message"])
r = client.get(f"/api/notifications/{notif['id']}")
check("notification detail", r.status_code == 200)
r = client.post(f"/api/notifications/{notif['id']}/resend", headers=H)
check("resend blocked for delivered", r.status_code == 409)
r = client.get("/api/notifications/stats")
check("notif stats", r.json()["simulated_sent"] == 1)

# --- Second lecture for same subject/date, new attendance -> resend path ---
r = client.post("/api/attendance/confirm", json={**confirm_payload, "lecture_number": 2,
                                                 "start_time": "10:00", "end_time": "11:00"}, headers=H)
check("second lecture import", r.status_code == 200 and r.json()["notifications"]["generated"] == 1)
r = client.get("/api/notifications?status=Simulated Sent")
check("two notifications now", r.json()["total"] == 2)
pending_id = None
# Make one Pending by direct DB manipulation for resend test
from extensions import SessionLocal
from models import NotificationLog

db = SessionLocal()
log = db.query(NotificationLog).order_by(NotificationLog.id.desc()).first()
log.status = "Pending"
db.commit()
pending_id = log.id
db.close()
r = client.post(f"/api/notifications/{pending_id}/resend", headers=H)
check("resend pending works", r.status_code == 200 and r.json()["status"] == "Simulated Sent")

# --- Student history ---
r = client.get("/api/students")
sid = [s for s in r.json()["items"] if s["roll_number"] == "101"][0]["id"]
r = client.get(f"/api/students/{sid}/history")
h = r.json()
check("history totals", h["total"] == 2 and h["present"] == 2 and h["percentage"] == 100.0, str({k: h[k] for k in ('total', 'present', 'percentage')}))

# --- Reports ---
r = client.get("/api/reports/daily?date=2026-09-29")
check("daily report xlsx", r.status_code == 200 and r.headers["content-type"].startswith(
    "application/vnd.openxmlformats"))
r = client.get("/api/reports/overall")
check("overall report xlsx", r.status_code == 200)
r = client.get("/api/reports/subject-wise")
check("subject report xlsx", r.status_code == 200)
r = client.get("/api/reports/notifications")
check("notifications report xlsx", r.status_code == 200)
# Verify the daily report actually opens with pandas
r2 = client.get("/api/reports/daily?date=2026-09-29")
df = pd.read_excel(io.BytesIO(r2.content))
check("daily report readable", len(df) == 4 and "Roll No" in df.columns, f"rows={len(df)}")

# --- Student deactivation (soft delete) ---
r = client.delete(f"/api/students/{sid}", headers=H)
check("deactivate student", r.status_code == 200)
r = client.get("/api/students")
check("inactive hidden from default list", all(s["roll_number"] != "101" for s in r.json()["items"]))

print()
print(f"==== {len(PASS)} passed, {len(FAIL)} failed ====")
if FAIL:
    print("Failed:", FAIL)
    raise SystemExit(1)
