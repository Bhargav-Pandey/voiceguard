"""Domain-level validation helpers."""

import re

MOBILE_RE = re.compile(r"^\+?[0-9]{10,15}$")


def is_valid_mobile(value: str) -> bool:
    return bool(MOBILE_RE.match((value or "").strip()))


def is_valid_semester(value: int) -> bool:
    return 1 <= int(value) <= 10


def is_valid_lecture_number(value: int) -> bool:
    return 1 <= int(value) <= 12
