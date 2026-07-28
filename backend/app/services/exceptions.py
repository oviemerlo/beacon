"""
Domain exceptions raised by the service layer. Services never import
FastAPI's HTTPException — that would couple business logic to the web
framework, and services should be testable/reusable without one (a future
CLI script or background job that calls the same service functions
shouldn't need a fake HTTP request to do it).

Routes catch these via the handlers registered in app/api/error_handlers.py
and translate them to the right status code in one place, rather than each
route hand-rolling its own try/except HTTPException block.
"""


class ServiceError(Exception):
    """Base class — catch this if you want to handle any domain error generically."""


class NotFoundError(ServiceError):
    pass


class ForbiddenError(ServiceError):
    pass


class ValidationError(ServiceError):
    pass


class ConflictError(ServiceError):
    pass


class UnauthorizedError(ServiceError):
    pass
