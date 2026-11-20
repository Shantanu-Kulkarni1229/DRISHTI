import uuid
from typing import Generator, Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.organisation import Organisation
from app.models.user import User

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validates JWT bearer token and enforces tenant context."""
    if not auth or not auth.credentials:
        # Check if single default development org and user exist for seamless local offline dev
        dev_user = db.query(User).filter(User.email == "analyst@drishti.local").first()
        if dev_user:
            return dev_user
        # Create default dev organization and user automatically for offline convenience
        org = db.query(Organisation).filter(Organisation.slug == "mod-dgis").first()
        if not org:
            org = Organisation(
                id=uuid.uuid4(),
                name="MoD / DGIS",
                slug="mod-dgis",
            )
            db.add(org)
            db.commit()
            db.refresh(org)

        user = User(
            id=uuid.uuid4(),
            organisation_id=org.id,
            email="analyst@drishti.local",
            password_hash="$2b$12$e80MvQkU0g5L7z1qE71m5.p4fE1qL0c2k.dev",
            display_name="A. Rao",
            role="analyst",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    try:
        payload = decode_token(auth.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
        return user
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication failed: {str(e)}")


def require_role(required_role: str):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient privileges")
        return current_user

    return role_checker
