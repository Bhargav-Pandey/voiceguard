"""Decorators for cross-cutting concerns (logging, timing)."""

import functools
import logging
import time

logger = logging.getLogger("attendance")


def log_call(func):
    """Log entry/exit and duration of a function call."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        except Exception:
            logger.exception("%s failed", func.__name__)
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info("%s completed in %.1fms", func.__name__, duration_ms)

    return wrapper
