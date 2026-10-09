import hashlib
import logging
import os
import secrets
import smtplib
import ssl
import requests
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, select
from pydantic import BaseModel, EmailStr, Field, field_validator

from database import get_db
from models import PasswordResetToken, User
from auth_utils import hash_password, verify_password, create_token, get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


def normalize_email(email: str) -> str:
    return email.strip().lower()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    preferred_language: str = "fr"

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return normalize_email(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return normalize_email(v)


class PasswordResetRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return normalize_email(v)


class PasswordResetConfirmRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class GoogleCallbackRequest(BaseModel):
    session_id: str


def _password_reset_config() -> tuple[str, int, str, str | None, str | None, str]:
    host = os.environ.get("SMTP_HOST")
    sender = os.environ.get("SMTP_FROM")
    frontend_url = os.environ.get("FRONTEND_URL")
    if not host or not sender or not frontend_url:
        raise HTTPException(status_code=503, detail="Password reset email is not configured")

    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    if bool(username) != bool(password):
        raise HTTPException(status_code=503, detail="Password reset email is not configured")

    try:
        port = int(os.environ.get("SMTP_PORT", "587"))
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Password reset email is not configured") from exc
    return host, port, sender, username, password, frontend_url.rstrip("/")


def _send_password_reset_email(
    recipient: str,
    reset_url: str,
    config: tuple[str, int, str, str | None, str | None, str],
) -> None:
    host, port, sender, username, password, _ = config
    message = EmailMessage()
    message["Subject"] = "Réinitialisation de votre mot de passe NumDocMan"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        "Une demande de réinitialisation du mot de passe de votre compte NumDocMan a été effectuée.\n\n"
        f"Pour choisir un nouveau mot de passe, ouvrez ce lien (valide 30 minutes) :\n{reset_url}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."
    )

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=10, context=ssl.create_default_context()) as smtp:
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Failed to send password reset email")
        raise HTTPException(status_code=503, detail="Unable to send password reset email")


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(func.lower(User.email) == data.email))
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
    result = await db.execute(select(User).where(func.lower(User.email) == data.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_token(user.id, user.email)
    return {"token": token, "user": _user_dict(user)}


@router.post("/password-reset/request")
async def request_password_reset(data: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    config = _password_reset_config()
    result = await db.execute(select(User).where(func.lower(User.email) == data.email))
    user = result.scalar_one_or_none()
    if not user:
        return {"message": "If the account exists, password reset instructions have been sent"}

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db.add(reset_token)
    await db.commit()

    reset_url = f"{config[5]}/reset-password?token={raw_token}"
    try:
        _send_password_reset_email(user.email, reset_url, config)
    except HTTPException:
        await db.delete(reset_token)
        await db.commit()
        raise

    return {"message": "If the account exists, password reset instructions have been sent"}


@router.post("/password-reset/confirm")
async def confirm_password_reset(data: PasswordResetConfirmRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(data.token.encode("utf-8")).hexdigest()
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    reset_token = result.scalar_one_or_none()
    expires_at = reset_token.expires_at if reset_token else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not reset_token or expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token")

    result = await db.execute(select(User).where(User.id == reset_token.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token")

    user.password_hash = hash_password(data.password)
    await db.delete(reset_token)
    await db.commit()
    return {"message": "Password updated successfully"}


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

    email = normalize_email(oauth_data.get("email") or "")
    if not email:
        raise HTTPException(status_code=400, detail="No email from OAuth")

    result = await db.execute(select(User).where(func.lower(User.email) == email))
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
