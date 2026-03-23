import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, BigInteger,
    DateTime, JSON, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    picture = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False)
    preferred_language = Column(String(5), default="fr")
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class OrgMember(Base):
    __tablename__ = "org_members"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="member")
    joined_at = Column(DateTime(timezone=True), default=now_utc)
    __table_args__ = (UniqueConstraint("org_id", "user_id"),)


class Role(Base):
    __tablename__ = "roles"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    permissions = Column(JSON, default=list)
    color = Column(String(20), default="#6B7280")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    __table_args__ = (UniqueConstraint("org_id", "code"),)


class Project(Base):
    __tablename__ = "projects"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="active")
    phases = Column(JSON, default=list)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    __table_args__ = (UniqueConstraint("org_id", "code"),)


class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_code = Column(String(50), default="member")
    joined_at = Column(DateTime(timezone=True), default=now_utc)
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)


class DocumentType(Base):
    __tablename__ = "document_types"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#2E60CC")
    icon = Column(String(50), default="FileText")
    required_fields = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    __table_args__ = (UniqueConstraint("project_id", "code"),)


class DocIdRule(Base):
    __tablename__ = "doc_id_rules"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False)
    pattern = Column(String(255), nullable=False, default="{org}_{proj}_{phase}_{type}_{seq:05d}")
    components = Column(JSON, default=list)
    separator = Column(String(5), default="_")
    seq_digits = Column(Integer, default=5)
    current_seq = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class WorkflowState(Base):
    __tablename__ = "workflow_states"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    color = Column(String(20), default="#6B7280")
    is_initial = Column(Boolean, default=False)
    is_final = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now_utc)


class WorkflowTransition(Base):
    __tablename__ = "workflow_transitions"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    from_state_id = Column(String(36), ForeignKey("workflow_states.id", ondelete="CASCADE"), nullable=True)
    to_state_id = Column(String(36), ForeignKey("workflow_states.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    required_roles = Column(JSON, default=list)
    requires_signature = Column(Boolean, default=False)
    requires_comment = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)


class Document(Base):
    __tablename__ = "documents"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type_id = Column(String(36), ForeignKey("document_types.id"), nullable=True)
    title = Column(String(500), nullable=False)
    doc_id = Column(String(200), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    phase = Column(String(100), nullable=True)
    file_path = Column(String(1000), nullable=True)
    file_name = Column(String(500), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    current_state_id = Column(String(36), ForeignKey("workflow_states.id"), nullable=True)
    version = Column(Integer, default=1)
    revision = Column(String(20), default="A")
    tags = Column(JSON, default=list)
    custom_fields = Column(JSON, default=dict)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class DocumentHistory(Base):
    __tablename__ = "document_history"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    from_state_id = Column(String(36), ForeignKey("workflow_states.id"), nullable=True)
    to_state_id = Column(String(36), ForeignKey("workflow_states.id"), nullable=True)
    performed_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    comment = Column(Text, nullable=True)
    action = Column(String(100), default="transition")
    performed_at = Column(DateTime(timezone=True), default=now_utc)


class Signature(Base):
    __tablename__ = "signatures"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    title = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    entity = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False)
    signed_at = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String(50), nullable=False)
    signature_data = Column(Text, nullable=True)
    signature_type = Column(String(20), default="drawn")
    created_at = Column(DateTime(timezone=True), default=now_utc)


class StorageConfig(Base):
    __tablename__ = "storage_configs"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    storage_type = Column(String(20), default="local")
    local_path = Column(String(500), default="./uploads")
    remote_url = Column(String(500), nullable=True)
    credentials = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class KPIConfig(Base):
    __tablename__ = "kpi_configs"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    kpi_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    visualization = Column(String(20), default="card")
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    filters = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=now_utc)
