"""Job / screening endpoints: create, upload resumes, analyse, read results."""

from __future__ import annotations

import csv
import io
import threading
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.serializers import candidate_detail, candidate_item, screening_detail, screening_summary
from app.core.config import settings
from app.core.logging_config import get_logger
from app.database.db import get_db
from app.models.entities import (
    Candidate,
    ParseStatus,
    Screening,
    ScreeningStatus,
)
from app.schemas.schemas import (
    AnalyzeJdRequest,
    AnalyzeJdResponse,
    AnalyzeStartResponse,
    CandidateDetail,
    CandidateListItem,
    JobRequirements,
    ProgressResponse,
    ScreeningCreateRequest,
    ScreeningDetail,
    ScreeningSummary,
    UploadResult,
)
from app.services.analytics_service import screening_analytics
from app.services.document_parser import (
    DocumentParseError,
    content_hash,
    extract_text,
    extension_of,
    save_upload,
    validate_file,
)
from app.services.jd_analyzer import analyze_jd
from app.services.pipeline import run_analysis
from app.services.progress import ANALYSIS_STAGES, progress_tracker
from app.services.skill_extractor import normalise_skill_list

logger = get_logger(__name__)
router = APIRouter(tags=["jobs"])


def _get_screening(db: Session, screening_id: int) -> Screening:
    screening = db.get(Screening, screening_id)
    if screening is None:
        raise HTTPException(status_code=404, detail="Screening not found.")
    return screening


@router.post("/jobs/analyze-jd", response_model=AnalyzeJdResponse)
def analyze_job_description(payload: AnalyzeJdRequest) -> AnalyzeJdResponse:
    result = analyze_jd(payload.job_description, payload.job_title)
    return AnalyzeJdResponse(
        requirements=JobRequirements(**result["requirements"]),
        job_title_guess=result["job_title_guess"],
        detected_skills=result["detected_skills"],
        warnings=result["warnings"],
    )


@router.post("/jobs/extract-jd-text")
async def extract_jd_text(file: UploadFile = File(...)) -> dict:
    """Extract text from an uploaded job-description file (PDF, DOCX, TXT)."""
    filename = file.filename or "job-description"
    try:
        content = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="The upload could not be read.")
    try:
        validate_file(filename, len(content))
    except DocumentParseError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    temp_dir = settings.upload_dir / "_jd"
    try:
        path, _ = save_upload(content, filename, temp_dir)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="The file could not be stored.") from exc

    try:
        result = extract_text(path, filename)
    except DocumentParseError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    finally:
        path.unlink(missing_ok=True)

    return {
        "filename": filename,
        "text": result["text"],
        "char_count": result.get("char_count"),
        "warnings": result.get("warnings", []),
    }


@router.post("/jobs", response_model=ScreeningDetail, status_code=status.HTTP_201_CREATED)
def create_screening(payload: ScreeningCreateRequest, db: Session = Depends(get_db)) -> dict:
    requirements = payload.requirements.model_dump()
    requirements["required_skills"] = normalise_skill_list(requirements.get("required_skills") or [])
    requirements["preferred_skills"] = normalise_skill_list(requirements.get("preferred_skills") or [])
    requirements["raw_text"] = payload.job_description

    screening = Screening(
        job_title=payload.job_title.strip(),
        company=(payload.company or "").strip() or None,
        job_description=payload.job_description,
        requirements=requirements,
        status=ScreeningStatus.DRAFT.value,
        is_demo=False,
    )
    db.add(screening)
    db.commit()
    db.refresh(screening)
    # A reused id must never inherit progress state from a deleted screening.
    progress_tracker.clear(screening.id)
    return screening_detail(db, screening)


@router.get("/jobs", response_model=list[ScreeningSummary])
def list_screenings(
    include_demo: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = select(Screening).order_by(Screening.created_at.desc())
    if not include_demo:
        query = query.where(Screening.is_demo == 0)
    screenings = db.execute(query).scalars().all()
    return [screening_summary(db, s) for s in screenings]


@router.get("/jobs/{screening_id}", response_model=ScreeningDetail)
def get_screening(screening_id: int, db: Session = Depends(get_db)) -> dict:
    return screening_detail(db, _get_screening(db, screening_id))


@router.patch("/jobs/{screening_id}", response_model=ScreeningDetail)
def update_screening(
    screening_id: int, payload: ScreeningCreateRequest, db: Session = Depends(get_db)
) -> dict:
    """Edit a screening's job details and requirements before analysis."""
    screening = _get_screening(db, screening_id)
    if progress_tracker.is_running(screening_id):
        raise HTTPException(status_code=409, detail="This screening is being analysed right now.")

    requirements = payload.requirements.model_dump()
    requirements["required_skills"] = normalise_skill_list(requirements.get("required_skills") or [])
    requirements["preferred_skills"] = normalise_skill_list(requirements.get("preferred_skills") or [])
    requirements["raw_text"] = payload.job_description

    screening.job_title = payload.job_title.strip()
    screening.company = (payload.company or "").strip() or None
    screening.job_description = payload.job_description
    screening.requirements = requirements
    db.commit()
    db.refresh(screening)
    return screening_detail(db, screening)


@router.delete("/jobs/{screening_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_screening(screening_id: int, db: Session = Depends(get_db)) -> Response:
    screening = _get_screening(db, screening_id)
    for candidate in screening.candidates:
        if candidate.stored_path:
            try:
                Path(candidate.stored_path).unlink(missing_ok=True)
            except OSError:  # pragma: no cover
                logger.warning("Could not remove file %s", candidate.stored_path)
    db.delete(screening)
    db.commit()
    progress_tracker.clear(screening_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/jobs/{screening_id}/resumes", response_model=UploadResult)
async def upload_resumes(
    screening_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> UploadResult:
    screening = _get_screening(db, screening_id)
    if screening.status == ScreeningStatus.ANALYZING.value:
        raise HTTPException(status_code=409, detail="This screening is being analysed right now.")

    existing = db.execute(
        select(Candidate.file_hash).where(Candidate.screening_id == screening_id)
    ).scalars().all()
    seen_hashes = {h for h in existing if h}

    accepted: list[dict] = []
    rejected: list[dict] = []
    duplicates: list[dict] = []

    for upload in files:
        filename = upload.filename or "resume"
        try:
            content = await upload.read()
        except Exception:
            rejected.append({"filename": filename, "reason": "The upload could not be read."})
            continue

        try:
            validate_file(filename, len(content))
        except DocumentParseError as exc:
            rejected.append({"filename": filename, "reason": exc.message, "code": exc.code})
            continue

        digest = content_hash(content)
        if digest in seen_hashes:
            duplicates.append({"filename": filename, "reason": "This file is already in this screening."})
            continue

        if len(accepted) + len(seen_hashes) >= settings.max_resumes_per_screening:
            rejected.append(
                {
                    "filename": filename,
                    "reason": f"A screening can hold at most {settings.max_resumes_per_screening} resumes.",
                }
            )
            continue

        try:
            path, _ = save_upload(content, filename, settings.upload_dir / str(screening_id))
        except OSError:
            rejected.append({"filename": filename, "reason": "The file could not be stored."})
            continue

        candidate = Candidate(
            screening_id=screening_id,
            resume_filename=filename[:200],
            stored_path=str(path),
            file_hash=digest,
            resume_text="",
            parsed_profile={},
            parse_status=ParseStatus.PENDING.value,
        )
        db.add(candidate)
        seen_hashes.add(digest)
        accepted.append({"filename": filename, "size": len(content), "type": extension_of(filename)})

    if accepted and screening.status == ScreeningStatus.DRAFT.value:
        screening.status = ScreeningStatus.UPLOADING.value
    db.commit()

    return UploadResult(accepted=accepted, rejected=rejected, duplicates=duplicates)


@router.post("/jobs/{screening_id}/analyze", response_model=AnalyzeStartResponse, status_code=202)
def start_analysis(screening_id: int, db: Session = Depends(get_db)) -> AnalyzeStartResponse:
    screening = _get_screening(db, screening_id)
    if progress_tracker.is_running(screening_id):
        raise HTTPException(status_code=409, detail="Analysis is already running for this screening.")

    candidates = db.execute(
        select(Candidate).where(Candidate.screening_id == screening_id)
    ).scalars().all()
    if not candidates:
        raise HTTPException(status_code=400, detail="Upload at least one resume before analysing.")

    screening.status = ScreeningStatus.ANALYZING.value
    db.commit()

    thread = threading.Thread(target=run_analysis, args=(screening_id,), name=f"analysis-{screening_id}", daemon=True)
    thread.start()

    return AnalyzeStartResponse(
        screening_id=screening_id,
        status=ScreeningStatus.ANALYZING.value,
        total_candidates=len(candidates),
        message="Analysis started. Poll the progress endpoint for stage-by-stage status.",
    )


@router.get("/jobs/{screening_id}/progress", response_model=ProgressResponse)
def get_progress(screening_id: int, db: Session = Depends(get_db)) -> dict:
    screening = _get_screening(db, screening_id)
    entry = progress_tracker.get(screening_id)
    if entry:
        return entry

    if screening.status == ScreeningStatus.COMPLETED.value:
        return {
            "screening_id": screening_id,
            "state": "completed",
            "percent": 100.0,
            "current_stage": None,
            "stages": [{"key": k, "label": l, "status": "done"} for k, l in ANALYSIS_STAGES],
            "message": "Analysis complete.",
        }
    if screening.status == ScreeningStatus.FAILED.value:
        return {
            "screening_id": screening_id,
            "state": "failed",
            "percent": 0.0,
            "stages": [{"key": k, "label": l, "status": "pending"} for k, l in ANALYSIS_STAGES],
            "message": "The last analysis run failed.",
        }
    return {
        "screening_id": screening_id,
        "state": "idle",
        "percent": 0.0,
        "stages": [{"key": k, "label": l, "status": "pending"} for k, l in ANALYSIS_STAGES],
        "message": "Analysis has not been run yet.",
    }


@router.get("/jobs/{screening_id}/candidates", response_model=list[CandidateListItem])
def list_candidates(screening_id: int, db: Session = Depends(get_db)) -> list[dict]:
    _get_screening(db, screening_id)
    candidates = db.execute(
        select(Candidate).where(Candidate.screening_id == screening_id).order_by(Candidate.id)
    ).scalars().all()
    items = [candidate_item(c) for c in candidates]
    items.sort(key=lambda item: (item["rank"] is None, item["rank"] or 10**6, item["id"]))
    return items


@router.get("/jobs/{screening_id}/analytics")
def get_analytics(screening_id: int, db: Session = Depends(get_db)) -> dict:
    screening = _get_screening(db, screening_id)
    data = screening_analytics(db, screening)
    data["job_title"] = screening.job_title
    data["company"] = screening.company
    return data


@router.get("/jobs/{screening_id}/export")
def export_csv(screening_id: int, db: Session = Depends(get_db)) -> Response:
    screening = _get_screening(db, screening_id)
    candidates = db.execute(
        select(Candidate).where(Candidate.screening_id == screening_id)
    ).scalars().all()

    items = [candidate_item(c) for c in candidates]
    items.sort(key=lambda item: (item["rank"] is None, item["rank"] or 10**6, item["id"]))

    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(
        [
            "Rank", "Candidate", "Email", "Overall Score", "Skills Score", "Semantic Score",
            "Experience Score", "Education Score", "Relevant Experience (years)",
            "Total Experience (years)", "Matched Skills", "Missing Required Skills",
            "Match Label", "Recruiter Status", "Data Completeness (%)", "Resume File",
        ]
    )
    for item in items:
        details = {}
        candidate = next((c for c in candidates if c.id == item["id"]), None)
        if candidate and candidate.analysis:
            details = candidate.analysis.details or {}
        matched = ", ".join(
            m["skill"] for m in (details.get("matched_skills") or []) if m.get("requirement") == "required"
        )
        missing = ", ".join(item["required_missing"] or [])
        writer.writerow(
            [
                item["rank"] or "",
                item["name"] or "",
                item["email"] or "",
                "" if item["overall_score"] is None else f"{item['overall_score']:.1f}",
                "" if item["skill_score"] is None else f"{item['skill_score']:.1f}",
                "" if item["semantic_score"] is None else f"{item['semantic_score']:.1f}",
                "" if item["experience_score"] is None else f"{item['experience_score']:.1f}",
                "" if item["education_score"] is None else f"{item['education_score']:.1f}",
                "" if item["relevant_experience_years"] is None else item["relevant_experience_years"],
                "" if item["total_experience_years"] is None else item["total_experience_years"],
                matched,
                missing,
                item["match_label"] or "",
                item["status"],
                f"{item['data_completeness']:.0f}",
                item["resume_filename"] or "",
            ]
        )

    safe_title = "".join(ch if ch.isalnum() else "-" for ch in screening.job_title).strip("-")[:50] or "screening"
    filename = f"hirelens-{safe_title}-{screening_id}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
