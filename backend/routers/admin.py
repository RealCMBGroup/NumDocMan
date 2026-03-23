from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional

from database import get_db
from models import User, OrgMember, Organization
from auth_utils import get_current_user, hash_password

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: Optional[str] = None
    is_superadmin: Optional[bool] = False
    preferred_language: Optional[str] = "fr"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    is_superadmin: Optional[bool] = None
    preferred_language: Optional[str] = None
    password: Optional[str] = None


@router.get("/users")
async def list_users(
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_superadmin:
        if org_id:
            result = await db.execute(
                select(User).join(OrgMember, OrgMember.user_id == User.id).where(OrgMember.org_id == org_id)
            )
        else:
            result = await db.execute(select(User))
    else:
        # Only list users in same orgs
        user_orgs = await db.execute(select(OrgMember.org_id).where(OrgMember.user_id == current_user.id))
        org_ids = [r[0] for r in user_orgs.all()]
        result = await db.execute(
            select(User).join(OrgMember, OrgMember.user_id == User.id).where(OrgMember.org_id.in_(org_ids)).distinct()
        )
    users = result.scalars().all()
    return [_user_dict(u) for u in users]


@router.post("/users", status_code=201)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(403, "Superadmin required")

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(
        email=data.email,
        name=data.name,
        password_hash=hash_password(data.password) if data.password else None,
        is_superadmin=data.is_superadmin,
        preferred_language=data.preferred_language,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _user_dict(user)


@router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin and current_user.id != user_id:
        raise HTTPException(403, "Not allowed")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    update_data = data.model_dump(exclude_none=True)
    if "password" in update_data:
        user.password_hash = hash_password(update_data.pop("password"))
    for k, v in update_data.items():
        setattr(user, k, v)

    await db.commit()
    await db.refresh(user)
    return _user_dict(user)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(403, "Superadmin required")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    await db.delete(user)
    await db.commit()


@router.post("/users/{user_id}/org-member")
async def add_to_org(
    user_id: str,
    org_id: str,
    role: str = "member",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superadmin:
        raise HTTPException(403, "Superadmin required")
    member = OrgMember(org_id=org_id, user_id=user_id, role=role)
    db.add(member)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(400, "Already a member")
    return {"message": "Added to organization"}


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "picture": u.picture,
        "is_active": u.is_active,
        "is_superadmin": u.is_superadmin,
        "preferred_language": u.preferred_language,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }
