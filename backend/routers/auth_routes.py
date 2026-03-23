import os
import requests
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from database import get_db
from models import User
from auth_utils import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    preferred_language: str = "fr"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleCallbackRequest(BaseModel):
    session_id: str


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        preferred_language=data.preferred_language,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(user.id, user.email)
    return {"token": token, "user": _user_dict(user)}


@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_token(user.id, user.email)
    return {"token": token, "user": _user_dict(user)}


@router.post("/google/callback")
async def google_callback(data: GoogleCallbackRequest, db: AsyncSession = Depends(get_db)):
    try:
        resp = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": data.session_id},
            timeout=10,
        )
        resp.raise_for_status()
        oauth_data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")

    email = oauth_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email from OAuth")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=oauth_data.get("name", email.split("@")[0]),
            picture=oauth_data.get("picture"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if oauth_data.get("picture") and not user.picture:
            user.picture = oauth_data.get("picture")
        if oauth_data.get("name") and not user.name:
            user.name = oauth_data.get("name")
        await db.commit()
        await db.refresh(user)

    token = create_token(user.id, user.email)
    return {"token": token, "user": _user_dict(user)}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)


@router.post("/logout")
async def logout():
    return {"message": "Logged out"}


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "is_superadmin": user.is_superadmin,
        "preferred_language": user.preferred_language,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
