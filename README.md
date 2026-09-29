# Attendance Alert System

A college attendance management and parent notification system.

- **Backend:** Python + FastAPI + SQLAlchemy (SQLite by default)
- **Frontend:** Plain HTML/CSS/JavaScript (no frameworks)
- **Excel:** pandas + openpyxl for import and report generation
- **Notifications:** Demo mode (messages are generated and logged, not really sent)

## Workflow

```
Faculty → Select Subject/Date/Lecture → Upload Excel → Validate → Preview
        → Confirm Import → Store Attendance → Detect Absentees
        → Generate Parent Notifications → Log Status → Excel Reports
```

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Open http://localhost:8000 and sign in:

| Username | Password   | Role    |
|----------|------------|---------|
| admin    | admin123   | admin   |
| faculty  | faculty123 | faculty |

Optional demo data (8 students, 3 subjects, a sample Excel with intentional
data issues):

```bash
python sample_data/seed_demo_data.py
```

## Excel format

Upload `.xlsx`, `.xls`, or `.csv` with exactly these columns (case-insensitive):

| Roll No | Student Name | Attendance |
|---------|--------------|------------|
| 101     | Rahul Sharma | Present    |
| 102     | Aman Patil   | Absent     |
| 103     | Neha Joshi   | P          |
| 104     | Sara Khan    | A          |

Accepted attendance values: `Present`, `Absent`, `P`, `A` (case-insensitive).
Parent info is **not** part of the upload — it comes from the student database.
A sample file with deliberate errors is generated at
`sample_data/sample_attendance.xlsx` by the seed script.

## Pages

| Page | Path | Purpose |
|------|------|---------|
| Login | `/index.html` | Sign in |
| Dashboard | `/dashboard.html` | Live stats + today's lectures (filters: date/subject/sem/division) |
| Upload | `/upload.html` | Validate → preview → confirm workflow |
| Attendance | `/attendance.html` | Search/filter records, open student history |
| Absentees | `/absentees.html` | Absent students per date, send/resend notifications |
| Notifications | `/notifications.html` | Notification log, view full message |
| Students | `/students.html` | Manage students + parent contacts |
| Reports | `/reports.html` | Download the four Excel reports |

## API overview

All endpoints are under `/api`. Interactive docs: http://localhost:8000/docs

- `POST /api/auth/login` — OAuth2 form login, returns JWT
- `GET/POST/PUT/DELETE /api/students[...]` — student CRUD (soft delete)
- `GET/POST /api/subjects` — subject list/create
- `POST /api/attendance/upload` — validate Excel, returns preview (no writes)
- `POST /api/attendance/confirm` — store attendance + generate notifications
- `GET /api/attendance` — records with search/filters
- `GET /api/attendance/lectures?date=` — lectures for a day with counts
- `GET /api/attendance/absentees?date=` — absentees + notification status
- `GET /api/attendance/stats?date=&semester=&division=` — dashboard numbers
- `GET/POST /api/notifications[...]` — log list, detail, `/{id}/resend`, `/generate`
- `GET /api/reports/{daily,overall,subject-wise,notifications}` — Excel downloads
- `GET /api/health` — health check

## Configuration

Copy `.env.example` to `.env` (backend loads it via python-dotenv):

- `DATABASE_URL` — SQLite default; point at PostgreSQL/MySQL in production
- `SECRET_KEY` — **change this** in any real deployment
- `NOTIFICATION_MODE` — `demo` (default) or `live`
- `COLLEGE_NAME` — used in the message template
- `MAX_UPLOAD_MB` — upload size cap

## Going live with notifications

Demo mode is the default so no provider credentials are needed. To connect a
real WhatsApp/SMS provider, implement `backend/services/notification_service.py::_send_via_provider()`
and set `NOTIFICATION_MODE=live`. The message template (`DEFAULT_TEMPLATE`) is
configurable in the same file.

## Project structure

```
backend/
  models/     SQLAlchemy models (User, Student, Subject, Lecture, Attendance, NotificationLog)
  routes/     API endpoints (auth, students, attendance, notifications, admin, health)
  services/   Business logic (attendance, excel, notification)
  utils/      Validation, auth helpers, errors, logging
  app.py      FastAPI app + static frontend serving
database/
  schema.sql  Reference DDL (tables are auto-created at startup)
frontend/
  css/ js/    Shared styles and scripts
  *.html      Pages
sample_data/  Demo seeder + sample Excel
```
