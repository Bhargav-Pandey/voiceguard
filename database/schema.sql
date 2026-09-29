-- SQLite schema (mirrors the SQLAlchemy models; used for documentation/review).
--
-- Note: app startup creates tables via Base.metadata.create_all(). This file is
-- the reference DDL for the same schema and can be loaded manually if preferred.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'faculty',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    division TEXT NOT NULL,
    parent_name TEXT NOT NULL,
    parent_mobile TEXT NOT NULL,
    parent_email TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    semester INTEGER NOT NULL,
    division TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lectures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    date DATE NOT NULL,
    lecture_number INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE (subject_id, date, lecture_number)
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    lecture_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
    marked_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, lecture_id)
);

CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    lecture_id INTEGER NOT NULL,
    parent_name TEXT NOT NULL,
    parent_mobile TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    date TEXT NOT NULL,
    lecture_number INTEGER NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_students_roll_number ON students (roll_number);
CREATE INDEX IF NOT EXISTS ix_subjects_code ON subjects (code);
CREATE INDEX IF NOT EXISTS ix_subjects_semester ON subjects (semester);
CREATE INDEX IF NOT EXISTS ix_lectures_date ON lectures (date);
CREATE INDEX IF NOT EXISTS ix_attendance_date ON attendance (date);
CREATE INDEX IF NOT EXISTS ix_notification_student_id ON notification_log (student_id);
CREATE INDEX IF NOT EXISTS ix_notification_lecture_id ON notification_log (lecture_id);
