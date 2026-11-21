"""ORM models.

Three tables carry the product: a Screening (job + extracted requirements),
the Candidates uploaded against it, and the Analysis produced for each
candidate. Analysis is a separate table so that a candidate can exist without
a score (uploaded but not yet analysed, or failed parsing).
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ScreeningStatus(str, enum.Enum):
    DRAFT = "draft"
    UPLOADING = "uploading"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class CandidateStatus(str, enum.Enum):
    NEW = "new"
    SHORTLISTED = "shortlisted"
    REVIEWING = "reviewing"
    INTERVIEW = "interview"
    REJECTED = "rejected"


class ParseStatus(str, enum.Enum):
    PENDING = "pending"
    PARSED = "parsed"
    FAILED = "failed"


class Screening(Base):
    __tablename__ = "screenings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_title: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str | None] = mapped_column(String(200))
    job_description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    requirements: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=ScreeningStatus.DRAFT.value)
    is_demo: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    score_version: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    candidates: Mapped[list["Candidate"]] = relationship(
        back_populates="screening", cascade="all, delete-orphan", order_by="Candidate.id"
    )

    __table_args__ = (Index("ix_screenings_created_at", "created_at"),)


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    screening_id: Mapped[int] = mapped_column(
        ForeignKey("screenings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(60))
    resume_filename: Mapped[str | None] = mapped_column(String(260))
    stored_path: Mapped[str | None] = mapped_column(String(500))
    file_hash: Mapped[str | None] = mapped_column(String(64))
    resume_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    parsed_profile: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    parse_status: Mapped[str] = mapped_column(String(20), nullable=False, default=ParseStatus.PENDING.value)
    parse_error: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CandidateStatus.NEW.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    screening: Mapped[Screening] = relationship(back_populates="candidates")
    analysis: Mapped["CandidateAnalysis | None"] = relationship(
        back_populates="candidate", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        Index("ix_candidates_screening_status", "screening_id", "status"),
        Index("ix_candidates_screening_hash", "screening_id", "file_hash"),
    )


class CandidateAnalysis(Base):
    __tablename__ = "candidate_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    skill_score: Mapped[float | None] = mapped_column(Float)
    semantic_score: Mapped[float | None] = mapped_column(Float)
    experience_score: Mapped[float | None] = mapped_column(Float)
    education_score: Mapped[float | None] = mapped_column(Float)
    match_label: Mapped[str] = mapped_column(String(30), nullable=False, default="Low Match")
    rank: Mapped[int | None] = mapped_column(Integer)
    data_completeness: Mapped[float] = mapped_column(Float, default=100.0)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    candidate: Mapped[Candidate] = relationship(back_populates="analysis")

    __table_args__ = (Index("ix_analyses_score", "overall_score"),)
