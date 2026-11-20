import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.organisation import Organisation
from app.models.user import User
from app.schemas.auth import AuthResponse, Token, TokenRefresh, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")

    # Find or create organisation
    slug = req.organisation_name.lower().replace(" ", "-").replace("/", "-")
    org = db.query(Organisation).filter(Organisation.slug == slug).first()
    if not org:
        org = Organisation(name=req.organisation_name, slug=slug)
        db.add(org)
        db.commit()
        db.refresh(org)

    user = User(
        organisation_id=org.id,
        email=req.email,
        password_hash=get_password_hash(req.password),
        display_name=req.display_name,
        role=req.role or "analyst",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    claims = {"org_id": str(org.id), "role": user.role}
    access_token = create_access_token(subject=str(user.id), claims=claims)
    refresh_token = create_refresh_token(subject=str(user.id), claims=claims)

    user_resp = UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        organisation_id=str(user.organisation_id),
        is_active=user.is_active,
    )
    return AuthResponse(
        user=user_resp,
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=AuthResponse)
def login(req: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled.")

    claims = {"org_id": str(user.organisation_id), "role": user.role}
    access_token = create_access_token(subject=str(user.id), claims=claims)
    refresh_token = create_refresh_token(subject=str(user.id), claims=claims)

    user_resp = UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        organisation_id=str(user.organisation_id),
        is_active=user.is_active,
    )
    return AuthResponse(
        user=user_resp,
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=Token)
def refresh_token(req: TokenRefresh, db: Session = Depends(get_db)):
    try:
        payload = decode_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type.")
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

        claims = {"org_id": str(user.organisation_id), "role": user.role}
        new_access = create_access_token(subject=str(user.id), claims=claims)
        new_refresh = create_refresh_token(subject=str(user.id), claims=claims)
        return Token(access_token=new_access, refresh_token=new_refresh)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token refresh failed: {str(e)}")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        display_name=current_user.display_name,
        role=current_user.role,
        organisation_id=str(current_user.organisation_id),
        is_active=current_user.is_active,
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(current_user: User = Depends(get_current_user)):
    return {"status": "logged_out", "message": "Session invalidated."}
