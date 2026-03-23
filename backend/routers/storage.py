from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import StorageConfig, User
from auth_utils import get_current_user

router = APIRouter()


class StorageConfigCreate(BaseModel):
    org_id: str
    name: str
    storage_type: str = "local"
    local_path: Optional[str] = "./uploads"
    remote_url: Optional[str] = None
    credentials: Optional[dict] = {}


class StorageConfigUpdate(BaseModel):
    name: Optional[str] = None
    storage_type: Optional[str] = None
    local_path: Optional[str] = None
    remote_url: Optional[str] = None
    credentials: Optional[dict] = None
    is_active: Optional[bool] = None


@router.get("/storage")
async def list_storage_configs(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(StorageConfig).where(StorageConfig.org_id == org_id))
    return [_sc_dict(s) for s in result.scalars().all()]


@router.post("/storage", status_code=201)
async def create_storage_config(data: StorageConfigCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    sc = StorageConfig(**data.model_dump())
    db.add(sc)
    await db.commit()
    await db.refresh(sc)
    return _sc_dict(sc)


@router.put("/storage/{sc_id}")
async def update_storage_config(sc_id: str, data: StorageConfigUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(StorageConfig).where(StorageConfig.id == sc_id))
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(404, "Storage config not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(sc, k, v)
    await db.commit()
    await db.refresh(sc)
    return _sc_dict(sc)


@router.delete("/storage/{sc_id}", status_code=204)
async def delete_storage_config(sc_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(StorageConfig).where(StorageConfig.id == sc_id))
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(404, "Storage config not found")
    await db.delete(sc)
    await db.commit()


def _sc_dict(s: StorageConfig) -> dict:
    return {
        "id": s.id,
        "org_id": s.org_id,
        "name": s.name,
        "storage_type": s.storage_type,
        "local_path": s.local_path,
        "remote_url": s.remote_url,
        "credentials": s.credentials or {},
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
