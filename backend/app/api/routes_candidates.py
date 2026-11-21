"""Candidate endpoints: profile, status, resume text/file, comparison."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.serializers import candidate_detail
from app.database.db import get_db
from app.models.entities import Candidate, CandidateStatus
from app.schemas.schemas import CandidateDetail, CandidateStatusUpdate

router = APIRouter(tags=["candidates"])

VALID_STATUSES = {s.value for s in CandidateStatus}


def _get_candidate(db: Session, candidate_id: int) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return candidate


@router.get("/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)) -> dict:
    return candidate_detail(_get_candidate(db, candidate_id))


@router.patch("/candidates/{candidate_id}/status", response_model=CandidateDetail)
def update_status(
    candidate_id: int, payload: CandidateStatusUpdate, db: Session = Depends(get_db)
) -> dict:
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Unknown candidate status.")
    candidate = _get_candidate(db, candidate_id)
    candidate.status = payload.status
    db.commit()
    db.refresh(candidate)
    return candidate_detail(candidate)


@router.get("/candidates/{candidate_id}/resume-text")
def get_resume_text(candidate_id: int, db: Session = Depends(get_db)) -> dict:
    candidate = _get_candidate(db, candidate_id)
    if not candidate.resume_text:
        raise HTTPException(status_code=404, detail="No extracted text is stored for this candidate.")
    return {"candidate_id": candidate.id, "filename": candidate.resume_filename, "text": candidate.resume_text}


@router.get("/candidates/{candidate_id}/resume")
def download_resume(candidate_id: int, db: Session = Depends(get_db)) -> FileResponse:
    candidate = _get_candidate(db, candidate_id)
    if not candidate.stored_path:
        raise HTTPException(status_code=404, detail="The original file is not available.")
    path = Path(candidate.stored_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="The original file is no longer on disk.")
    media_type = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
        ".md": "text/markdown",
    }.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(
        path,
        media_type=media_type,
        filename=candidate.resume_filename or path.name,
        headers={"Content-Disposition": f'inline; filename="{candidate.resume_filename or path.name}"'},
    )


@router.post("/candidates/compare")
def compare_candidates(
    ids: list[int] = Query(..., description="2-4 candidate ids"),
    db: Session = Depends(get_db),
) -> dict:
    unique_ids = list(dict.fromkeys(ids))
    if not 2 <= len(unique_ids) <= 4:
        raise HTTPException(status_code=400, detail="Select between 2 and 4 candidates to compare.")

    candidates = db.execute(select(Candidate).where(Candidate.id.in_(unique_ids))).scalars().all()
    if len(candidates) != len(unique_ids):
        raise HTTPException(status_code=404, detail="One or more candidates were not found.")
    if len({c.screening_id for c in candidates}) != 1:
        raise HTTPException(status_code=400, detail="Candidates must belong to the same screening.")

    entries = []
    for candidate in candidates:
        detail = candidate_detail(candidate)
        details = detail.get("analysis") or {}
        components = details.get("components") or {}
        entries.append(
            {
                "id": candidate.id,
                "name": candidate.name or "Unnamed candidate",
                "email": candidate.email,
                "resume_filename": candidate.resume_filename,
                "status": candidate.status,
                "overall_score": detail["overall_score"],
                "match_label": detail["match_label"],
                "rank": detail["rank"],
                "skill_score": detail["skill_score"],
                "semantic_score": detail["semantic_score"],
                "experience_score": detail["experience_score"],
                "education_score": detail["education_score"],
                "relevant_experience_years": detail["relevant_experience_years"],
                "total_experience_years": detail["total_experience_years"],
                "coverage": details.get("coverage"),
                "missing_required": detail["required_missing"],
                "matched_required": detail["required_matched"],
                "related_only": details.get("related_only") or [],
                "projects": (detail.get("parsed_profile") or {}).get("projects") or [],
                "experience_roles": (components.get("experience") or {}).get("roles") or [],
                "education": (detail.get("parsed_profile") or {}).get("education") or [],
                "data_completeness": detail["data_completeness"],
                "headline": ((details.get("explanation") or {}).get("headline")) or "",
            }
        )

    entries.sort(key=lambda e: -(e["overall_score"] or 0))
    return {"candidates": entries}
