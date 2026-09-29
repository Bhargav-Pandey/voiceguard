"""Seed demo students, subjects, and a sample attendance Excel file.

Run:  python sample_data/seed_demo_data.py
Requires the backend package to be importable (run from backend/ or with
PYTHONPATH=backend). Creates sample_data/sample_attendance.xlsx with a couple
of deliberate data issues to exercise validation.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from extensions import SessionLocal, engine  # noqa: E402
from models import Base, Student, Subject  # noqa: E402
from utils.security import hash_password  # noqa: E402
from models import User  # noqa: E402


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add_all(
                [
                    User(username="admin", password_hash=hash_password("admin123"), full_name="System Administrator", role="admin"),
                    User(username="faculty", password_hash=hash_password("faculty123"), full_name="Demo Faculty", role="faculty"),
                ]
            )

        if db.query(Student).count() == 0:
            students = [
                ("101", "Rahul Sharma", "Computer", 3, "A", "Suresh Sharma", "9876500001", "suresh@example.com"),
                ("102", "Aman Patil", "Computer", 3, "A", "Vivek Patil", "9876500002", None),
                ("103", "Neha Joshi", "Computer", 3, "A", "Prakash Joshi", "9876500003", None),
                ("104", "Sara Khan", "Computer", 3, "A", "Imran Khan", "9876500004", None),
                ("105", "Vikram Rao", "Computer", 3, "A", "Mohan Rao", "9876500005", None),
                ("106", "Priya Nair", "Computer", 3, "A", "Anand Nair", "9876500006", None),
                ("107", "Karan Mehta", "Computer", 3, "B", "Rakesh Mehta", "9876500007", None),
                ("108", "Isha Deo", "Computer", 3, "B", "Sumit Deo", "9876500008", None),
            ]
            db.add_all(
                Student(
                    roll_number=rn, name=n, branch=b, semester=sem, division=dv,
                    parent_name=pn, parent_mobile=pm, parent_email=pe,
                )
                for rn, n, b, sem, dv, pn, pm, pe in students
            )

        if db.query(Subject).count() == 0:
            db.add_all(
                [
                    Subject(code="CS301", name="Database Management Systems", semester=3, division="A"),
                    Subject(code="CS302", name="Operating Systems", semester=3, division="A"),
                    Subject(code="CS303", name="Data Structures", semester=3, division="B"),
                ]
            )

        db.commit()

        # Sample attendance Excel with deliberate issues: invalid status and
        # an unknown roll number, so validation/preview can be demonstrated.
        try:
            import pandas as pd

            df = pd.DataFrame(
                {
                    "Roll No": ["101", "102", "103", "104", "105", "106", "107", "108", "999"],
                    "Student Name": [
                        "Rahul Sharma", "Aman Patil", "Neha Joshi", "Sara Khan",
                        "Vikram Rao", "Priya Nair", "Karan Mehta", "Isha Deo", "Ghost Student",
                    ],
                    "Attendance": ["Present", "Absent", "P", "A", "Present", "present", "ABSENT", "Present", "Absent"],
                }
            )
            out = os.path.join(os.path.dirname(__file__), "sample_attendance.xlsx")
            df.to_excel(out, index=False)
            print(f"Wrote {out}")
        except Exception as exc:  # openpyxl missing etc.
            print(f"Skipped sample Excel generation: {exc}")

        print("Demo data seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
