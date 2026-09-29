"""Consistent API error payloads and FastAPI exception handlers."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ValidationErrorDetail:
    """A single validation problem from Excel processing."""

    def __init__(self, row_number: int, message: str) -> None:
        self.row_number = row_number
        self.message = message

    def to_dict(self) -> dict:
        return {"row": self.row_number, "error": self.message}


def error_response(status_code: int, message: str, details: list | None = None) -> JSONResponse:
    body: dict = {"detail": message}
    if details:
        body["details"] = details
    return JSONResponse(status_code=status_code, content=body)


def register_error_handlers(app: FastAPI) -> None:
    """Attach JSON error handlers so the frontend always receives JSON errors."""

    @app.exception_handler(ValueError)
    async def value_error_handler(_: Request, exc: ValueError):
        return error_response(400, str(exc))

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception):
        return error_response(500, "Internal server error")
