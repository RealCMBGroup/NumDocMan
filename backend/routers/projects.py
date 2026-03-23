from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from database import get_db
from models import (
    Organization, OrgMember, Project, ProjectMember,
    DocumentType, WorkflowState, WorkflowTransition, DocIdRule, Role, User
)
from auth_utils import get_current_user

router = APIRouter()


# ─── Pydantic models ───────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None


class ProjectCreate(BaseModel):
    org_id: str
    name: str
    code: str
    description: Optional[str] = None
    phases: Optional[List[str]] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    phases: Optional[List[str]] = None


class DocTypeCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    color: Optional[str] = "#2E60CC"
    icon: Optional[str] = "FileText"
    required_fields: Optional[List[str]] = []


class WorkflowStateCreate(BaseModel):
    name: str
    code: str
    color: Optional[str] = "#6B7280"
    is_initial: Optional[bool] = False
    is_final: Optional[bool] = False
    order: Optional[int] = 0


class WorkflowTransitionCreate(BaseModel):
    from_state_id: Optional[str] = None
    to_state_id: str
    name: str
    required_roles: Optional[List[str]] = []
    requires_signature: Optional[bool] = False
    requires_comment: Optional[bool] = False


class DocIdRuleCreate(BaseModel):
    pattern: str
    separator: Optional[str] = "_"
    seq_digits: Optional[int] = 5
    components: Optional[List[dict]] = []


class RoleCreate(BaseModel):
    name: str
    code: str
    permissions: Optional[List[str]] = []
    color: Optional[str] = "#6B7280"
    description: Optional[str] = None


class MemberAdd(BaseModel):
    user_id: str
    role_code: Optional[str] = "member"


# ─── Organizations ─────────────────────────────────────────────────────────────

@router.get("/organizations")
async def list_orgs(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_superadmin:
        result = await db.execute(select(Organization))
    else:
        result = await db.execute(
            select(Organization).join(OrgMember, OrgMember.org_id == Organization.id)
            .where(OrgMember.user_id == current_user.id)
        )
    orgs = result.scalars().all()
    return [_org_dict(o) for o in orgs]


@router.post("/organizations", status_code=201)
async def create_org(data: OrgCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Organization).where(Organization.code == data.code))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Organization code already exists")

    org = Organization(**data.model_dump(), created_by=current_user.id)
    db.add(org)
    await db.flush()

    member = OrgMember(org_id=org.id, user_id=current_user.id, role="admin")
    db.add(member)
    await db.commit()
    await db.refresh(org)
    return _org_dict(org)


@router.get("/organizations/{org_id}")
async def get_org(org_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = await _get_org_or_404(org_id, db)
    await _check_org_member(org_id, current_user.id, db, current_user)
    return _org_dict(org)


@router.put("/organizations/{org_id}")
async def update_org(org_id: str, data: OrgUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = await _get_org_or_404(org_id, db)
    await _check_org_admin(org_id, current_user.id, db, current_user)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(org, k, v)
    await db.commit()
    await db.refresh(org)
    return _org_dict(org)


@router.get("/organizations/{org_id}/members")
async def list_org_members(org_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_org_member(org_id, current_user.id, db, current_user)
    result = await db.execute(
        select(OrgMember, User).join(User, User.id == OrgMember.user_id).where(OrgMember.org_id == org_id)
    )
    rows = result.all()
    return [{"id": m.id, "user_id": m.user_id, "role": m.role, "user": {"name": u.name, "email": u.email, "picture": u.picture}} for m, u in rows]


# ─── Roles ─────────────────────────────────────────────────────────────────────

@router.get("/organizations/{org_id}/roles")
async def list_roles(org_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_org_member(org_id, current_user.id, db, current_user)
    result = await db.execute(select(Role).where(Role.org_id == org_id))
    return [_role_dict(r) for r in result.scalars().all()]


@router.post("/organizations/{org_id}/roles", status_code=201)
async def create_role(org_id: str, data: RoleCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_org_admin(org_id, current_user.id, db, current_user)
    role = Role(**data.model_dump(), org_id=org_id)
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return _role_dict(role)


@router.put("/organizations/{org_id}/roles/{role_id}")
async def update_role(org_id: str, role_id: str, data: RoleCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_org_admin(org_id, current_user.id, db, current_user)
    result = await db.execute(select(Role).where(Role.id == role_id, Role.org_id == org_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(role, k, v)
    await db.commit()
    await db.refresh(role)
    return _role_dict(role)


@router.delete("/organizations/{org_id}/roles/{role_id}", status_code=204)
async def delete_role(org_id: str, role_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_org_admin(org_id, current_user.id, db, current_user)
    result = await db.execute(select(Role).where(Role.id == role_id, Role.org_id == org_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Role not found")
    await db.delete(role)
    await db.commit()


# ─── Projects ──────────────────────────────────────────────────────────────────

@router.get("/projects")
async def list_projects(
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.is_superadmin:
        q = select(Project)
        if org_id:
            q = q.where(Project.org_id == org_id)
    else:
        q = (
            select(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(ProjectMember.user_id == current_user.id)
        )
        if org_id:
            q = q.where(Project.org_id == org_id)
    result = await db.execute(q)
    projects = result.scalars().all()

    out = []
    for p in projects:
        d = _project_dict(p)
        # count documents
        from models import Document
        dc = await db.execute(select(Document).where(Document.project_id == p.id))
        d["doc_count"] = len(dc.scalars().all())
        out.append(d)
    return out


@router.post("/projects", status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_org_member(data.org_id, current_user.id, db, current_user)

    result = await db.execute(select(Project).where(Project.org_id == data.org_id, Project.code == data.code))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Project code already exists in this organization")

    project = Project(**data.model_dump(), created_by=current_user.id)
    db.add(project)
    await db.flush()

    member = ProjectMember(project_id=project.id, user_id=current_user.id, role_code="admin")
    db.add(member)

    # Default workflow states
    states_data = [
        {"name": "Brouillon", "code": "DRAFT", "color": "#6B7280", "is_initial": True, "order": 0},
        {"name": "En révision", "code": "REVIEW", "color": "#F59E0B", "order": 1},
        {"name": "Approuvé", "code": "APPROVED", "color": "#10B981", "order": 2},
        {"name": "Publié", "code": "PUBLISHED", "color": "#2E60CC", "order": 3},
        {"name": "Archivé", "code": "ARCHIVED", "color": "#374151", "is_final": True, "order": 4},
    ]
    states = {}
    for sd in states_data:
        s = WorkflowState(**sd, project_id=project.id)
        db.add(s)
        await db.flush()
        states[sd["code"]] = s

    # Default transitions
    transitions = [
        ("DRAFT", "REVIEW", "Soumettre pour révision"),
        ("REVIEW", "DRAFT", "Retourner en brouillon"),
        ("REVIEW", "APPROVED", "Approuver"),
        ("APPROVED", "PUBLISHED", "Publier"),
        ("PUBLISHED", "ARCHIVED", "Archiver"),
    ]
    for from_code, to_code, name in transitions:
        t = WorkflowTransition(
            project_id=project.id,
            from_state_id=states[from_code].id,
            to_state_id=states[to_code].id,
            name=name,
        )
        db.add(t)

    # Default ID rule
    rule = DocIdRule(
        project_id=project.id,
        pattern="{org}_{proj}_{phase}_{type}_{seq:05d}",
    )
    db.add(rule)

    await db.commit()
    await db.refresh(project)
    return _project_dict(project)


@router.get("/projects/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = await _get_project_or_404(project_id, db)
    await _check_project_member(project_id, current_user.id, db, current_user)
    d = _project_dict(project)

    # Enrich with org info
    org_result = await db.execute(select(Organization).where(Organization.id == project.org_id))
    org = org_result.scalar_one_or_none()
    if org:
        d["org"] = _org_dict(org)

    return d


@router.put("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = await _get_project_or_404(project_id, db)
    await _check_project_member(project_id, current_user.id, db, current_user)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(project, k, v)
    await db.commit()
    await db.refresh(project)
    return _project_dict(project)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = await _get_project_or_404(project_id, db)
    await _check_project_member(project_id, current_user.id, db, current_user)
    await db.delete(project)
    await db.commit()


@router.get("/projects/{project_id}/members")
async def list_project_members(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(
        select(ProjectMember, User).join(User, User.id == ProjectMember.user_id).where(ProjectMember.project_id == project_id)
    )
    rows = result.all()
    return [{"id": m.id, "user_id": m.user_id, "role_code": m.role_code, "user": {"name": u.name, "email": u.email, "picture": u.picture}} for m, u in rows]


@router.post("/projects/{project_id}/members", status_code=201)
async def add_project_member(project_id: str, data: MemberAdd, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    member = ProjectMember(project_id=project_id, user_id=data.user_id, role_code=data.role_code)
    db.add(member)
    await db.commit()
    return {"message": "Member added"}


# ─── Document Types ────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/document-types")
async def list_doc_types(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(DocumentType).where(DocumentType.project_id == project_id))
    return [_doctype_dict(dt) for dt in result.scalars().all()]


@router.post("/projects/{project_id}/document-types", status_code=201)
async def create_doc_type(project_id: str, data: DocTypeCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    dt = DocumentType(**data.model_dump(), project_id=project_id)
    db.add(dt)
    await db.commit()
    await db.refresh(dt)
    return _doctype_dict(dt)


@router.put("/projects/{project_id}/document-types/{dt_id}")
async def update_doc_type(project_id: str, dt_id: str, data: DocTypeCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(DocumentType).where(DocumentType.id == dt_id, DocumentType.project_id == project_id))
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(404, "Document type not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(dt, k, v)
    await db.commit()
    await db.refresh(dt)
    return _doctype_dict(dt)


@router.delete("/projects/{project_id}/document-types/{dt_id}", status_code=204)
async def delete_doc_type(project_id: str, dt_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(DocumentType).where(DocumentType.id == dt_id, DocumentType.project_id == project_id))
    dt = result.scalar_one_or_none()
    if not dt:
        raise HTTPException(404, "Document type not found")
    await db.delete(dt)
    await db.commit()


# ─── Workflow States ───────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/workflow-states")
async def list_workflow_states(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(WorkflowState).where(WorkflowState.project_id == project_id).order_by(WorkflowState.order))
    return [_state_dict(s) for s in result.scalars().all()]


@router.post("/projects/{project_id}/workflow-states", status_code=201)
async def create_workflow_state(project_id: str, data: WorkflowStateCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    s = WorkflowState(**data.model_dump(), project_id=project_id)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _state_dict(s)


@router.put("/projects/{project_id}/workflow-states/{state_id}")
async def update_workflow_state(project_id: str, state_id: str, data: WorkflowStateCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(WorkflowState).where(WorkflowState.id == state_id, WorkflowState.project_id == project_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "State not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return _state_dict(s)


@router.delete("/projects/{project_id}/workflow-states/{state_id}", status_code=204)
async def delete_workflow_state(project_id: str, state_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(WorkflowState).where(WorkflowState.id == state_id, WorkflowState.project_id == project_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "State not found")
    await db.delete(s)
    await db.commit()


# ─── Workflow Transitions ──────────────────────────────────────────────────────

@router.get("/projects/{project_id}/workflow-transitions")
async def list_workflow_transitions(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(WorkflowTransition).where(WorkflowTransition.project_id == project_id))
    return [_transition_dict(t) for t in result.scalars().all()]


@router.post("/projects/{project_id}/workflow-transitions", status_code=201)
async def create_workflow_transition(project_id: str, data: WorkflowTransitionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    t = WorkflowTransition(**data.model_dump(), project_id=project_id)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _transition_dict(t)


@router.put("/projects/{project_id}/workflow-transitions/{trans_id}")
async def update_workflow_transition(project_id: str, trans_id: str, data: WorkflowTransitionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(WorkflowTransition).where(WorkflowTransition.id == trans_id, WorkflowTransition.project_id == project_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Transition not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    await db.commit()
    await db.refresh(t)
    return _transition_dict(t)


@router.delete("/projects/{project_id}/workflow-transitions/{trans_id}", status_code=204)
async def delete_workflow_transition(project_id: str, trans_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(WorkflowTransition).where(WorkflowTransition.id == trans_id, WorkflowTransition.project_id == project_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Transition not found")
    await db.delete(t)
    await db.commit()


# ─── Doc ID Rule ───────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/id-rule")
async def get_id_rule(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(DocIdRule).where(DocIdRule.project_id == project_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "No ID rule defined")
    return _rule_dict(rule)


@router.post("/projects/{project_id}/id-rule")
async def upsert_id_rule(project_id: str, data: DocIdRuleCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _check_project_member(project_id, current_user.id, db, current_user)
    result = await db.execute(select(DocIdRule).where(DocIdRule.project_id == project_id))
    rule = result.scalar_one_or_none()
    if rule:
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(rule, k, v)
    else:
        rule = DocIdRule(**data.model_dump(), project_id=project_id)
        db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _rule_dict(rule)


# ─── Helpers ───────────────────────────────────────────────────────────────────

async def _get_org_or_404(org_id: str, db: AsyncSession):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


async def _get_project_or_404(project_id: str, db: AsyncSession):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


async def _check_org_member(org_id: str, user_id: str, db: AsyncSession, user=None):
    if user and user.is_superadmin:
        return
    result = await db.execute(select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(403, "Not a member of this organization")


async def _check_org_admin(org_id: str, user_id: str, db: AsyncSession, user=None):
    if user and user.is_superadmin:
        return
    result = await db.execute(select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user_id))
    member = result.scalar_one_or_none()
    if not member or member.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin access required")


async def _check_project_member(project_id: str, user_id: str, db: AsyncSession, user=None):
    if user and user.is_superadmin:
        return
    result = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(403, "Not a member of this project")


def _org_dict(o: Organization) -> dict:
    return {"id": o.id, "name": o.name, "code": o.code, "description": o.description, "logo_url": o.logo_url, "created_at": o.created_at.isoformat() if o.created_at else None}


def _project_dict(p: Project) -> dict:
    return {"id": p.id, "org_id": p.org_id, "name": p.name, "code": p.code, "description": p.description, "status": p.status, "phases": p.phases or [], "created_by": p.created_by, "created_at": p.created_at.isoformat() if p.created_at else None, "updated_at": p.updated_at.isoformat() if p.updated_at else None}


def _doctype_dict(dt: DocumentType) -> dict:
    return {"id": dt.id, "project_id": dt.project_id, "name": dt.name, "code": dt.code, "description": dt.description, "color": dt.color, "icon": dt.icon, "required_fields": dt.required_fields or []}


def _state_dict(s: WorkflowState) -> dict:
    return {"id": s.id, "project_id": s.project_id, "name": s.name, "code": s.code, "color": s.color, "is_initial": s.is_initial, "is_final": s.is_final, "order": s.order}


def _transition_dict(t: WorkflowTransition) -> dict:
    return {"id": t.id, "project_id": t.project_id, "from_state_id": t.from_state_id, "to_state_id": t.to_state_id, "name": t.name, "required_roles": t.required_roles or [], "requires_signature": t.requires_signature, "requires_comment": t.requires_comment}


def _rule_dict(r: DocIdRule) -> dict:
    return {"id": r.id, "project_id": r.project_id, "pattern": r.pattern, "separator": r.separator, "seq_digits": r.seq_digits, "current_seq": r.current_seq, "components": r.components or []}


def _role_dict(r: Role) -> dict:
    return {"id": r.id, "org_id": r.org_id, "name": r.name, "code": r.code, "permissions": r.permissions or [], "color": r.color, "description": r.description}
