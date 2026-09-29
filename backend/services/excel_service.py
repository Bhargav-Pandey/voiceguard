"""Excel parsing/validation for attendance uploads, plus report generation.

Uses pandas + openpyxl. Import-side helpers return a preview dict for the
upload workflow; report helpers write styled workbooks to a BytesIO buffer.
"""

import io

import pandas as pd

REQUIRED_COLUMNS = {"roll_no": "Roll No", "student_name": "Student Name", "attendance": "Attendance"}


class ExcelValidationError(Exception):
    """Raised when an uploaded workbook cannot be processed at all."""


def _find_column(df: pd.DataFrame, wanted: str) -> str | None:
    """Case-insensitive column lookup."""
    for col in df.columns:
        if str(col).strip().lower() == wanted.lower():
            return col
    return None


def read_attendance_dataframe(content: bytes) -> pd.DataFrame:
    """Read .xlsx/.xls/.csv bytes into a DataFrame, raising ExcelValidationError."""
    name_lower = ""
    try:
        return pd.read_excel(io.BytesIO(content), engine="openpyxl")
    except ExcelValidationError:
        raise
    except Exception as excel_error:
        # Not a valid xlsx: try CSV as a convenience fallback.
        try:
            return pd.read_csv(io.BytesIO(content))
        except Exception as csv_error:
            raise ExcelValidationError(
                f"Could not read file as Excel or CSV. Excel error: {excel_error}; "
                f"CSV error: {csv_error}"
            ) from csv_error


def validate_attendance_df(df: pd.DataFrame) -> tuple[list[dict], list[dict], dict]:
    """Validate rows and build the preview payload.

    Returns (valid_rows, errors, summary) where each valid row is
    {row, roll_number, student_name, status} and errors are
    {row, error} dicts.
    """
    roll_col = _find_column(df, REQUIRED_COLUMNS["roll_no"])
    name_col = _find_column(df, REQUIRED_COLUMNS["student_name"])
    att_col = _find_column(df, REQUIRED_COLUMNS["attendance"])

    missing = [
        label
        for key, label in REQUIRED_COLUMNS.items()
        if _find_column(df, label) is None
    ]
    if missing:
        raise ExcelValidationError(f"Missing required columns: {', '.join(missing)}")

    from utils.helpers import normalize_attendance, normalize_roll_number

    valid_rows: list[dict] = []
    errors: list[dict] = []
    seen_rolls: set[str] = set()

    for idx, row in df.iterrows():
        row_number = int(idx) + 2  # Excel row number (header is row 1)
        raw_roll = row[roll_col]
        raw_name = row[name_col]
        raw_status = row[att_col]

        roll = normalize_roll_number(raw_roll)
        name = str(raw_name).strip() if pd.notna(raw_name) else ""

        if not roll or roll.lower() in {"nan", "none"}:
            errors.append({"row": row_number, "error": "Missing Roll No"})
            continue
        if not name:
            errors.append({"row": row_number, "error": f"Missing Student Name for roll {roll}"})
            continue

        status = normalize_attendance(raw_status)
        if status is None:
            errors.append(
                {
                    "row": row_number,
                    "error": f"Invalid attendance value {raw_status!r} for roll {roll} "
                    "(use Present/Absent/P/A)",
                }
            )
            continue

        if roll in seen_rolls:
            errors.append({"row": row_number, "error": f"Duplicate roll number {roll} in file"})
            continue

        seen_rolls.add(roll)
        valid_rows.append(
            {
                "row": row_number,
                "roll_number": roll,
                "student_name": name,
                "status": status,
            }
        )

    summary = {
        "total_rows": int(len(df)),
        "valid_rows": len(valid_rows),
        "error_rows": len(errors),
        "present": sum(1 for r in valid_rows if r["status"] == "Present"),
        "absent": sum(1 for r in valid_rows if r["status"] == "Absent"),
    }
    return valid_rows, errors, summary


def _style_header(ws) -> None:
    from openpyxl.styles import Alignment, Font, PatternFill

    fill = PatternFill("solid", fgColor="1F4E79")
    font = Font(color="FFFFFF", bold=True)
    for cell in ws[1]:
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center")
    ws.freeze_panes = "A2"


def _write_sheet(ws, headers: list[str], rows: list[list]) -> None:
    ws.append(headers)
    for row in rows:
        ws.append(row)
    _style_header(ws)
    # Reasonable column widths.
    for col_idx, header in enumerate(headers, start=1):
        max_len = max([len(str(header))] + [len(str(r[col_idx - 1])) for r in rows]) if rows else len(header)
        ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = min(max_len + 3, 50)


def build_daily_report(records: list[dict]) -> bytes:
    """Daily attendance report: one row per attendance record of the day."""
    wb = __import__("openpyxl").Workbook()
    ws = wb.active
    ws.title = "Daily Attendance"
    headers = ["Roll No", "Student", "Subject Code", "Subject", "Date", "Lecture", "Status"]
    rows = [
        [
            r.get("roll_number"),
            r.get("student_name"),
            r.get("subject_code"),
            r.get("subject_name"),
            str(r.get("date")),
            r.get("lecture_number"),
            r.get("status"),
        ]
        for r in records
    ]
    _write_sheet(ws, headers, rows)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_overall_report(student_stats: list[dict]) -> bytes:
    """Overall attendance report: one row per student with percentages."""
    wb = __import__("openpyxl").Workbook()
    ws = wb.active
    ws.title = "Overall Attendance"
    headers = [
        "Roll No",
        "Student",
        "Branch",
        "Semester",
        "Division",
        "Total Lectures",
        "Present",
        "Absent",
        "Attendance %",
    ]
    rows = [
        [
            s.get("roll_number"),
            s.get("name"),
            s.get("branch"),
            s.get("semester"),
            s.get("division"),
            s.get("total"),
            s.get("present"),
            s.get("absent"),
            round(s.get("percentage") or 0, 2),
        ]
        for s in student_stats
    ]
    _write_sheet(ws, headers, rows)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_subject_report(subject_stats: list[dict]) -> bytes:
    """Subject-wise attendance report: one row per student per subject."""
    wb = __import__("openpyxl").Workbook()
    ws = wb.active
    ws.title = "Subject-wise Attendance"
    headers = ["Roll No", "Student", "Subject Code", "Subject", "Lectures", "Present", "Attendance %"]
    rows = [
        [
            s.get("roll_number"),
            s.get("student_name"),
            s.get("subject_code"),
            s.get("subject_name"),
            s.get("total"),
            s.get("present"),
            round(s.get("percentage") or 0, 2),
        ]
        for s in subject_stats
    ]
    _write_sheet(ws, headers, rows)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_notification_report(logs: list[dict]) -> bytes:
    """Parent notification report."""
    wb = __import__("openpyxl").Workbook()
    ws = wb.active
    ws.title = "Notifications"
    headers = [
        "Roll No",
        "Student",
        "Parent",
        "Parent Mobile",
        "Subject",
        "Date",
        "Lecture",
        "Channel",
        "Status",
        "Created At",
        "Sent At",
        "Failure Reason",
    ]
    rows = [
        [
            l.get("roll_number"),
            l.get("student_name"),
            l.get("parent_name"),
            l.get("parent_mobile"),
            f"{l.get('subject_code')} - {l.get('subject_name')}",
            l.get("date"),
            l.get("lecture_number"),
            l.get("channel"),
            l.get("status"),
            str(l.get("created_at") or ""),
            str(l.get("sent_at") or ""),
            l.get("failure_reason") or "",
        ]
        for l in logs
    ]
    _write_sheet(ws, headers, rows)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
