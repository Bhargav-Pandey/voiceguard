"""Router registration for the application."""

from .admin_routes import router as admin_router
from .attendance_routes import router as attendance_router
from .auth_routes import router as auth_router
from .health_routes import router as health_router
from .notification_routes import router as notification_router
from .student_routes import router as student_router

all_routers = [
    auth_router,
    admin_router,
    student_router,
    attendance_router,
    notification_router,
    health_router,
]
