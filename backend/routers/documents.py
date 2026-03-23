import os
import aiofiles
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel

from database import get_db
from models import (
    Document, DocumentHistory, Signature, DocumentType,
    WorkflowState, WorkflowTransition, Project, Organization,
    DocIdRule, User, StorageConfig
)
from auth_utils import get_current_user

router = APIRouter()

BACKEND_DIR = Path(__file__).parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


class DocumentCreate(BaseModel):
    project_id: str
    doc_type_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    phase: Optional[str] = None
    tags: Optional[List[str]] = []
    custom_fields: Optional[dict] = {}


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    phase: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[dict] = None
    revision: Optional[str] = None


class TransitionRequest(BaseModel):
    to_state_id: str
    comment: Optional[str] = None


class SignatureCreate(BaseModel):
    title: Optional[str] = None
    name: str
    company: str
    entity: Optional[str] = None
    email: str
    signed_at: str
    timezone: str
    signature_data: Optional[str] = None
    signature_type: Optional[str] = "drawn"


# ─── Documents CRUD ────────────────────────────────────────────────────────────

@router.get("/documents")
async def list_documents(
    project_id: Optional[str] = Query(None),
    doc_type_id: Optional[str] = Query(None),
    state_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from models import ProjectMember
    q = select(Document)
    if not current_user.is_superadmin:
        q = q.join(ProjectMember, ProjectMember.project_id == Document.project_id).where(ProjectMember.user_id == current_user.id)
    if project_id:
        q = q.where(Document.project_id == project_id)
    if doc_type_id:
        q = q.where(Document.doc_type_id == doc_type_id)
    if state_id:
        q = q.where(Document.current_state_id == state_id)
    if search:
        q = q.where(Document.title.ilike(f"%{search}%"))

    # Count total
    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    # Paginate
    q = q.order_by(Document.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    docs = result.scalars().all()

    import math
    out = []
    for d in docs:
        doc_dict = await _enrich_doc(d, db)
        out.append(doc_dict)

    return {
        "items": out,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/documents", status_code=201)
async def create_document(data: DocumentCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from models import ProjectMember
    result = await db.execute(select(ProjectMember).where(ProjectMember.project_id == data.project_id, ProjectMember.user_id == current_user.id))
    if not result.scalar_one_or_none() and not current_user.is_superadmin:
        raise HTTPException(403, "Not a member of this project")

    # Generate doc_id
    doc_id = await _generate_doc_id(data.project_id, data.doc_type_id, data.phase, db)

    # Get initial workflow state
    init_state = await db.execute(select(WorkflowState).where(WorkflowState.project_id == data.project_id, WorkflowState.is_initial == True))
    initial = init_state.scalar_one_or_none()

    doc = Document(
        **data.model_dump(),
        doc_id=doc_id,
        current_state_id=initial.id if initial else None,
        created_by=current_user.id,
    )
    db.add(doc)
    await db.flush()

    # Record history
    history = DocumentHistory(
        document_id=doc.id,
        to_state_id=initial.id if initial else None,
        performed_by=current_user.id,
        action="create",
        comment="Document created",
    )
    db.add(history)
    await db.commit()
    await db.refresh(doc)
    return await _enrich_doc(doc, db)


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id, db)
    return await _enrich_doc(doc, db)


@router.put("/documents/{doc_id}")
async def update_document(doc_id: str, data: DocumentUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(doc, k, v)
    await db.commit()
    await db.refresh(doc)
    return await _enrich_doc(doc, db)


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id, db)
    if doc.file_path:
        fp = Path(doc.file_path)
        if fp.exists():
            fp.unlink(missing_ok=True)
    await db.delete(doc)
    await db.commit()


# ─── File Upload/Download ──────────────────────────────────────────────────────

@router.post("/documents/{doc_id}/upload")
async def upload_file(
    doc_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await _get_doc_or_404(doc_id, db)

    # Determine storage path
    project_result = await db.execute(select(Project).where(Project.id == doc.project_id))
    project = project_result.scalar_one_or_none()
    org_result = await db.execute(select(Organization).where(Organization.id == project.org_id))
    org = org_result.scalar_one_or_none()

    # Check for custom storage config
    sc_result = await db.execute(select(StorageConfig).where(StorageConfig.org_id == project.org_id, StorageConfig.is_active == True))
    storage = sc_result.scalar_one_or_none()

    if storage and storage.storage_type == "local":
        base_path = Path(storage.local_path)
    else:
        base_path = UPLOADS_DIR / (org.code if org else "default") / (project.code if project else "default")

    base_path.mkdir(parents=True, exist_ok=True)

    # Save file
    safe_name = f"{doc.doc_id}_{file.filename}".replace(" ", "_")
    file_path = base_path / safe_name

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    doc.file_path = str(file_path)
    doc.file_name = file.filename
    doc.file_size = len(content)
    doc.mime_type = file.content_type
    doc.version += 1

    history = DocumentHistory(
        document_id=doc.id,
        performed_by=current_user.id,
        action="upload",
        comment=f"File uploaded: {file.filename}",
    )
    db.add(history)
    await db.commit()
    await db.refresh(doc)
    return {"message": "File uploaded", "file_name": file.filename, "file_size": len(content)}


@router.get("/documents/{doc_id}/download")
async def download_file(doc_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id, db)
    if not doc.file_path:
        raise HTTPException(404, "No file attached")
    fp = Path(doc.file_path)
    if not fp.exists():
        raise HTTPException(404, "File not found on disk")
    return FileResponse(str(fp), filename=doc.file_name or fp.name, media_type=doc.mime_type or "application/octet-stream")


# ─── Workflow Transitions ──────────────────────────────────────────────────────

@router.post("/documents/{doc_id}/transition")
async def transition_document(doc_id: str, data: TransitionRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id, db)

    # Verify transition is allowed
    trans_result = await db.execute(
        select(WorkflowTransition).where(
            WorkflowTransition.project_id == doc.project_id,
            WorkflowTransition.to_state_id == data.to_state_id,
            (WorkflowTransition.from_state_id == doc.current_state_id) |
            (WorkflowTransition.from_state_id == None)
        )
    )
    transition = trans_result.scalar_one_or_none()
    if not transition:
        raise HTTPException(400, "Transition not allowed")

    if transition.requires_comment and not data.comment:
        raise HTTPException(400, "Comment required for this transition")

    old_state_id = doc.current_state_id
    doc.current_state_id = data.to_state_id

    history = DocumentHistory(
        document_id=doc.id,
        from_state_id=old_state_id,
        to_state_id=data.to_state_id,
        performed_by=current_user.id,
        action="transition",
        comment=data.comment,
    )
    db.add(history)
    await db.commit()
    await db.refresh(doc)
    return await _enrich_doc(doc, db)


@router.get("/documents/{doc_id}/history")
async def get_document_history(doc_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id, db)
    result = await db.execute(
        select(DocumentHistory, User)
        .join(User, User.id == DocumentHistory.performed_by)
        .where(DocumentHistory.document_id == doc_id)
        .order_by(DocumentHistory.performed_at.desc())
    )
    rows = result.all()
    out = []
    for h, u in rows:
        from_state = None
        to_state = None
        if h.from_state_id:
            fs = await db.execute(select(WorkflowState).where(WorkflowState.id == h.from_state_id))
            s = fs.scalar_one_or_none()
            if s:
                from_state = {"name": s.name, "code": s.code, "color": s.color}
        if h.to_state_id:
            ts = await db.execute(select(WorkflowState).where(WorkflowState.id == h.to_state_id))
            s = ts.scalar_one_or_none()
            if s:
                to_state = {"name": s.name, "code": s.code, "color": s.color}
        out.append({
            "id": h.id,
            "action": h.action,
            "comment": h.comment,
            "from_state": from_state,
            "to_state": to_state,
            "performed_by": {"id": u.id, "name": u.name, "email": u.email},
            "performed_at": h.performed_at.isoformat() if h.performed_at else None,
        })
    return out


# ─── Signatures ────────────────────────────────────────────────────────────────

@router.post("/documents/{doc_id}/signatures", status_code=201)
async def add_signature(doc_id: str, data: SignatureCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await _get_doc_or_404(doc_id, db)

    signed_dt = datetime.fromisoformat(data.signed_at.replace("Z", "+00:00"))

    sig = Signature(
        document_id=doc_id,
        user_id=current_user.id,
        title=data.title,
        name=data.name,
        company=data.company,
        entity=data.entity,
        email=data.email,
        signed_at=signed_dt,
        timezone=data.timezone,
        signature_data=data.signature_data,
        signature_type=data.signature_type,
    )
    db.add(sig)

    history = DocumentHistory(
        document_id=doc_id,
        performed_by=current_user.id,
        action="sign",
        comment=f"Signed by {data.name} ({data.company})",
    )
    db.add(history)
    await db.commit()
    await db.refresh(sig)
    return _sig_dict(sig)


@router.get("/documents/{doc_id}/signatures")
async def list_signatures(doc_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Signature).where(Signature.document_id == doc_id).order_by(Signature.created_at.desc()))
    return [_sig_dict(s) for s in result.scalars().all()]


# ─── Helpers ───────────────────────────────────────────────────────────────────

async def _get_doc_or_404(doc_id: str, db: AsyncSession) -> Document:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


async def _enrich_doc(doc: Document, db: AsyncSession) -> dict:
    d = _doc_dict(doc)
    if doc.current_state_id:
        sr = await db.execute(select(WorkflowState).where(WorkflowState.id == doc.current_state_id))
        s = sr.scalar_one_or_none()
        if s:
            d["current_state"] = {"id": s.id, "name": s.name, "code": s.code, "color": s.color, "is_final": s.is_final}
    if doc.doc_type_id:
        dtr = await db.execute(select(DocumentType).where(DocumentType.id == doc.doc_type_id))
        dt = dtr.scalar_one_or_none()
        if dt:
            d["doc_type"] = {"id": dt.id, "name": dt.name, "code": dt.code, "color": dt.color}
    cr = await db.execute(select(User).where(User.id == doc.created_by))
    creator = cr.scalar_one_or_none()
    if creator:
        d["creator"] = {"id": creator.id, "name": creator.name, "email": creator.email}
    return d


async def _generate_doc_id(project_id: str, doc_type_id: Optional[str], phase: Optional[str], db: AsyncSession) -> str:
    # Get rule
    rule_result = await db.execute(select(DocIdRule).where(DocIdRule.project_id == project_id))
    rule = rule_result.scalar_one_or_none()

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()

    org_result = await db.execute(select(Organization).where(Organization.id == project.org_id))
    org = org_result.scalar_one_or_none()

    doc_type_code = "DOC"
    if doc_type_id:
        dt_result = await db.execute(select(DocumentType).where(DocumentType.id == doc_type_id))
        dt = dt_result.scalar_one_or_none()
        if dt:
            doc_type_code = dt.code

    # Increment sequence
    if rule:
        rule.current_seq += 1
        seq = rule.current_seq
        digits = rule.seq_digits or 5
        sep = rule.separator or "_"

        org_code = org.code if org else "ORG"
        proj_code = project.code if project else "PROJ"
        phase_code = (phase or "NA").upper()
        seq_str = str(seq).zfill(digits)

        doc_id = sep.join([org_code, proj_code, phase_code, doc_type_code, seq_str])
    else:
        import uuid
        doc_id = str(uuid.uuid4())[:8].upper()

    return doc_id


def _doc_dict(doc: Document) -> dict:
    return {
        "id": doc.id,
        "project_id": doc.project_id,
        "doc_type_id": doc.doc_type_id,
        "title": doc.title,
        "doc_id": doc.doc_id,
        "description": doc.description,
        "phase": doc.phase,
        "file_path": doc.file_path,
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "current_state_id": doc.current_state_id,
        "version": doc.version,
        "revision": doc.revision,
        "tags": doc.tags or [],
        "custom_fields": doc.custom_fields or {},
        "created_by": doc.created_by,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        "has_file": bool(doc.file_path),
    }


def _sig_dict(sig: Signature) -> dict:
    return {
        "id": sig.id,
        "document_id": sig.document_id,
        "user_id": sig.user_id,
        "title": sig.title,
        "name": sig.name,
        "company": sig.company,
        "entity": sig.entity,
        "email": sig.email,
        "signed_at": sig.signed_at.isoformat() if sig.signed_at else None,
        "timezone": sig.timezone,
        "signature_data": sig.signature_data,
        "signature_type": sig.signature_type,
        "created_at": sig.created_at.isoformat() if sig.created_at else None,
    }
