"""Validation helpers for HTTP request payloads."""

from datetime import date, datetime, time

DATE_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y")
TIME_FORMATS = ("%H:%M", "%H:%M:%S")


def parse_date(value: str) -> date:
    """Parse a date from common formats, raising ValueError when invalid."""
    value = (value or "").strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date: {value!r}. Expected YYYY-MM-DD.")


def parse_time(value: str) -> time:
    """Parse a time from HH:MM or HH:MM:SS, raising ValueError when invalid."""
    value = (value or "").strip()
    for fmt in TIME_FORMATS:
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"Invalid time: {value!r}. Expected HH:MM.")


def require_fields(payload: dict, fields: tuple[str, ...]) -> None:
    """Raise ValueError when any required field is missing or blank."""
    missing = [f for f in fields if not str(payload.get(f) or "").strip()]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
