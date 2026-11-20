from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class DrishtiBaseException(Exception):
    """Base exception for all Drishti application errors."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class EntityNotFoundError(DrishtiBaseException):
    """Raised when a requested resource is not found."""


class TenantAccessViolationError(DrishtiBaseException):
    """Raised when an actor attempts cross-tenant access."""


class IngestionError(DrishtiBaseException):
    """Raised during raster validation, tiling or metadata extraction failures."""


class ModelNotAvailableError(DrishtiBaseException):
    """Raised when required offline model weights are missing or not configured."""


class AuthenticationError(DrishtiBaseException):
    """Raised for invalid or expired credentials/tokens."""


class PermissionDeniedError(DrishtiBaseException):
    """Raised when actor role lacks permission for the action."""


def to_http_exception(exc: DrishtiBaseException) -> HTTPException:
    """Maps domain exceptions to standard FastAPI HTTPExceptions."""
    if isinstance(exc, EntityNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    elif isinstance(exc, (TenantAccessViolationError, PermissionDeniedError)):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message)
    elif isinstance(exc, AuthenticationError):
        return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message)
    elif isinstance(exc, ModelNotAvailableError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "model_unavailable", "message": exc.message, "details": exc.details},
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)
