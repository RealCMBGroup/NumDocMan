from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from database import get_db
from models import (
    Document, Project, DocumentType, WorkflowState,
    DocumentHistory, Signature, OrgMember, ProjectMember,
    Organization, KPIConfig, User
)
from auth_utils import get_current_user

router = APIRouter()


@router.get("/overview")
async def kpi_overview(
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get accessible projects
    if current_user.is_superadmin:
        if org_id:
            proj_result = await db.execute(select(Project).where(Project.org_id == org_id))
        else:
            proj_result = await db.execute(select(Project))
    else:
        proj_result = await db.execute(
            select(Project).join(ProjectMember, ProjectMember.project_id == Project.id).where(ProjectMember.user_id == current_user.id)
        )
        if org_id:
            proj_result = await db.execute(
                select(Project).join(ProjectMember, ProjectMember.project_id == Project.id)
                .where(ProjectMember.user_id == current_user.id, Project.org_id == org_id)
            )
    projects = proj_result.scalars().all()
    proj_ids = [p.id for p in projects]

    # Total documents
    doc_result = await db.execute(select(func.count(Document.id)).where(Document.project_id.in_(proj_ids)))
    total_docs = doc_result.scalar() or 0

    # Total projects
    total_projects = len(proj_ids)

    # Documents by state
    state_result = await db.execute(
        select(WorkflowState.name, WorkflowState.code, WorkflowState.color, func.count(Document.id))
        .join(Document, Document.current_state_id == WorkflowState.id)
        .where(Document.project_id.in_(proj_ids))
        .group_by(WorkflowState.name, WorkflowState.code, WorkflowState.color)
    )
    docs_by_state = [{"name": r[0], "code": r[1], "color": r[2], "count": r[3]} for r in state_result.all()]

    # Documents by type
    type_result = await db.execute(
        select(DocumentType.name, DocumentType.code, DocumentType.color, func.count(Document.id))
        .join(Document, Document.doc_type_id == DocumentType.id)
        .where(Document.project_id.in_(proj_ids))
        .group_by(DocumentType.name, DocumentType.code, DocumentType.color)
    )
    docs_by_type = [{"name": r[0], "code": r[1], "color": r[2], "count": r[3]} for r in type_result.all()]

    # Signatures count
    sig_result = await db.execute(
        select(func.count(Signature.id)).where(Signature.document_id.in_(
            select(Document.id).where(Document.project_id.in_(proj_ids))
        ))
    )
    total_signatures = sig_result.scalar() or 0

    # Recent activity (last 10 history entries)
    hist_result = await db.execute(
        select(DocumentHistory, User, Document)
        .join(User, User.id == DocumentHistory.performed_by)
        .join(Document, Document.id == DocumentHistory.document_id)
        .where(DocumentHistory.document_id.in_(
            select(Document.id).where(Document.project_id.in_(proj_ids))
        ))
        .order_by(DocumentHistory.performed_at.desc())
        .limit(10)
    )
    recent_activity = []
    for h, u, d in hist_result.all():
        recent_activity.append({
            "action": h.action,
            "comment": h.comment,
            "document_id": d.id,
            "document_title": d.title,
            "document_doc_id": d.doc_id,
            "performed_by": {"name": u.name, "email": u.email},
            "performed_at": h.performed_at.isoformat() if h.performed_at else None,
        })

    # Projects by status
    status_counts = {}
    for p in projects:
        status_counts[p.status] = status_counts.get(p.status, 0) + 1

    return {
        "total_documents": total_docs,
        "total_projects": total_projects,
        "total_signatures": total_signatures,
        "docs_by_state": docs_by_state,
        "docs_by_type": docs_by_type,
        "projects_by_status": [{"status": k, "count": v} for k, v in status_counts.items()],
        "recent_activity": recent_activity,
    }


@router.get("/by-project")
async def kpi_by_project(
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_superadmin:
        q = select(Project)
        if org_id:
            q = q.where(Project.org_id == org_id)
    else:
        q = select(Project).join(ProjectMember, ProjectMember.project_id == Project.id).where(ProjectMember.user_id == current_user.id)
        if org_id:
            q = q.where(Project.org_id == org_id)

    proj_result = await db.execute(q)
    projects = proj_result.scalars().all()

    out = []
    for p in projects:
        doc_count_r = await db.execute(select(func.count(Document.id)).where(Document.project_id == p.id))
        doc_count = doc_count_r.scalar() or 0

        sig_count_r = await db.execute(
            select(func.count(Signature.id)).where(
                Signature.document_id.in_(select(Document.id).where(Document.project_id == p.id))
            )
        )
        sig_count = sig_count_r.scalar() or 0

        out.append({
            "project_id": p.id,
            "name": p.name,
            "code": p.code,
            "status": p.status,
            "doc_count": doc_count,
            "sig_count": sig_count,
        })
    return out


@router.get("/configs")
async def list_kpi_configs(
    org_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(KPIConfig).where(KPIConfig.org_id == org_id, KPIConfig.is_active == True).order_by(KPIConfig.order))
    return [{"id": k.id, "name": k.name, "kpi_type": k.kpi_type, "description": k.description, "visualization": k.visualization, "order": k.order} for k in result.scalars().all()]
