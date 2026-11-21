"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import SCORE_VERSION, SCORE_WEIGHTS

RequirementKind = Literal["required", "preferred"]


class JobRequirements(BaseModel):
    """Structured representation of a job description, editable by recruiters."""

    model_config = ConfigDict(extra="allow")

    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    minimum_experience: float | None = None
    education_requirements: list[str] = Field(default_factory=list)
    domain_requirements: list[str] = Field(default_factory=list)
    raw_text: str = ""

    @field_validator("required_skills", "preferred_skills", "education_requirements", "domain_requirements")
    @classmethod
    def _clean_lists(cls, value: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in value:
            text = (item or "").strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(text[:120])
        return out

    @field_validator("responsibilities")
    @classmethod
    def _clean_responsibilities(cls, value: list[str]) -> list[str]:
        out = [v.strip()[:400] for v in value if v and v.strip()]
        return out[:15]

    @field_validator("minimum_experience")
    @classmethod
    def _bounds(cls, value: float | None) -> float | None:
        if value is None:
            return None
        return max(0.0, min(float(value), 50.0))


class AnalyzeJdRequest(BaseModel):
    job_description: str = Field(min_length=20, max_length=60_000)
    job_title: str | None = Field(default=None, max_length=200)


class AnalyzeJdResponse(BaseModel):
    requirements: JobRequirements
    job_title_guess: str | None = None
    detected_skills: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ScreeningCreateRequest(BaseModel):
    job_title: str = Field(min_length=2, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    job_description: str = Field(min_length=20, max_length=60_000)
    requirements: JobRequirements


class ScreeningSummary(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int
    job_title: str
    company: str | None = None
    status: str
    is_demo: bool = False
    created_at: datetime
    updated_at: datetime | None = None
    analyzed_at: datetime | None = None
    candidate_count: int = 0
    analyzed_count: int = 0
    failed_count: int = 0
    average_score: float | None = None
    top_score: float | None = None
    strong_matches: int = 0
    required_skill_count: int = 0


class ScreeningDetail(ScreeningSummary):
    job_description: str = ""
    requirements: JobRequirements
    score_version: str | None = None


class CandidateStatusUpdate(BaseModel):
    status: Literal["new", "shortlisted", "reviewing", "interview", "rejected"]


class CandidateListItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int
    screening_id: int
    name: str | None
    email: str | None = None
    resume_filename: str | None = None
    parse_status: str
    parse_error: str | None = None
    status: str
    overall_score: float | None = None
    match_label: str | None = None
    rank: int | None = None
    skill_score: float | None = None
    semantic_score: float | None = None
    experience_score: float | None = None
    education_score: float | None = None
    total_experience_years: float | None = None
    relevant_experience_years: float | None = None
    matched_skill_count: int = 0
    required_matched: list[str] = Field(default_factory=list)
    required_missing: list[str] = Field(default_factory=list)
    data_completeness: float = 100.0


class CandidateDetail(CandidateListItem):
    parsed_profile: dict[str, Any] = Field(default_factory=dict)
    analysis: dict[str, Any] | None = None
    resume_text: str = ""
    file_available: bool = False


class UploadResult(BaseModel):
    accepted: list[dict[str, Any]] = Field(default_factory=list)
    rejected: list[dict[str, Any]] = Field(default_factory=list)
    duplicates: list[dict[str, Any]] = Field(default_factory=list)


class AnalyzeStartResponse(BaseModel):
    screening_id: int
    status: str
    total_candidates: int
    message: str


class ProgressStage(BaseModel):
    key: str
    label: str
    status: Literal["pending", "running", "done", "skipped", "failed"] = "pending"
    detail: str | None = None


class ProgressResponse(BaseModel):
    screening_id: int
    state: Literal["idle", "running", "completed", "failed"]
    current_stage: str | None = None
    percent: float = 0.0
    total_files: int = 0
    processed_files: int = 0
    succeeded_files: int = 0
    failed_files: int = 0
    stages: list[ProgressStage] = Field(default_factory=list)
    errors: list[dict[str, Any]] = Field(default_factory=list)
    message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ScoreConfigOut(BaseModel):
    weights: dict[str, float] = SCORE_WEIGHTS
    score_version: str = SCORE_VERSION
    labels: list[dict[str, Any]] = Field(default_factory=list)
    semantic: dict[str, Any] = Field(default_factory=dict)


class DemoLoadResponse(BaseModel):
    screening_id: int
    job_title: str
    candidates: int
    message: str
