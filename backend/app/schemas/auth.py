import uuid
from typing import Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str
    organisation_name: str
    role: Optional[str] = "analyst"


class UserLogin(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr
    password: str


class Token(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    refresh_token: str


class TokenPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sub: str
    org_id: str
    role: str
    exp: int
    type: str


class UserResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    email: str
    display_name: str
    role: str
    organisation_id: str
    is_active: bool


class AuthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
