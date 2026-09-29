"""Logging configuration."""

import logging


def configure_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    # Quiet down noisy third-party loggers a bit.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
