"""Meta endpoints: dashboard overview, configuration, demo mode, health."""

from __future__ import annotations

import threading

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.serializers import screening_summary
from app.core.config import (
    MATCH_CREDIT,
    MATCH_LABELS,
    REQUIREMENT_WEIGHTS,
    SCORE_VERSION,
    SCORE_WEIGHTS,
    SEMANTIC_CALIBRATION,
    settings,
)
from app.core.logging_config import get_logger
from app.database.db import get_db
from app.demo.seed import DEMO_COMPANY, DEMO_JOB_DESCRIPTION, DEMO_JOB_TITLE, demo_resumes
from app.models.entities import Candidate, CandidateAnalysis, ParseStatus, Screening, ScreeningStatus
from app.schemas.schemas import DemoLoadResponse, ScoreConfigOut
from app.services.analytics_service import global_analytics
from app.services.document_parser import save_upload
from app.services.jd_analyzer import analyze_jd
from app.services.pipeline import run_analysis
from app.services.progress import progress_tracker
from app.services.semantic_matcher import semantic_matcher

logger = get_logger(__name__)
router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "version": settings.version}


@router.get("/meta/config", response_model=ScoreConfigOut)
def get_config() -> ScoreConfigOut:
    return ScoreConfigOut(
        weights=SCORE_WEIGHTS,
        score_version=SCORE_VERSION,
        labels=[
            {"label": label, "min": low, "max": min(high, 100)}
            for low, high, label in MATCH_LABELS
        ],
        semantic={
            **semantic_matcher.status(),
            "calibration": SEMANTIC_CALIBRATION,
            "requirement_weights": REQUIREMENT_WEIGHTS,
            "match_credit": MATCH_CREDIT,
            "max_upload_mb": settings.max_upload_mb,
            "max_resumes": settings.max_resumes_per_screening,
            "accepted_types": list(settings.allowed_extensions),
        },
    )


@router.get("/meta/semantic-status")
def semantic_status() -> dict:
    return semantic_matcher.status()


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    totals = global_analytics(db)
    screenings = db.execute(
        select(Screening).order_by(Screening.created_at.desc()).limit(6)
    ).scalars().all()

    top_rows = db.execute(
        select(Candidate, CandidateAnalysis, Screening)
        .join(CandidateAnalysis, CandidateAnalysis.candidate_id == Candidate.id)
        .join(Screening, Screening.id == Candidate.screening_id)
        .order_by(CandidateAnalysis.overall_score.desc())
        .limit(6)
    ).all()

    active_jobs = db.execute(
        select(Screening).where(Screening.status.in_([ScreeningStatus.DRAFT.value, ScreeningStatus.UPLOADING.value, ScreeningStatus.ANALYZING.value]))
    ).scalars().all()

    return {
        "metrics": {
            "active_jobs": len(active_jobs),
            "total_screenings": totals["screenings"],
            "total_candidates": totals["candidates"],
            "analyzed_candidates": totals["analyzed"],
            "average_score": totals["average_score"],
            "strong_matches": totals["strong_matches"],
            "shortlisted": totals["shortlisted"],
        },
        "recent_screenings": [screening_summary(db, s) for s in screenings],
        "top_candidates": [
            {
                "id": candidate.id,
                "screening_id": candidate.screening_id,
                "name": candidate.name or "Unnamed candidate",
                "job_title": screening.job_title,
                "overall_score": round(float(analysis.overall_score or 0), 1),
                "match_label": analysis.match_label,
                "status": candidate.status,
                "is_demo": bool(screening.is_demo),
            }
            for candidate, analysis, screening in top_rows
        ],
        "has_data": totals["screenings"] > 0,
        "semantic": semantic_matcher.status(),
    }


@router.post("/demo/load", response_model=DemoLoadResponse, status_code=status.HTTP_201_CREATED)
def load_demo(db: Session = Depends(get_db)) -> DemoLoadResponse:
    """Create a clearly-labelled synthetic screening and run the real pipeline on it."""
    analysis_result = analyze_jd(DEMO_JOB_DESCRIPTION, DEMO_JOB_TITLE)
    screening = Screening(
        job_title=f"{DEMO_JOB_TITLE} (demo)",
        company=DEMO_COMPANY,
        job_description=DEMO_JOB_DESCRIPTION,
        requirements=analysis_result["requirements"],
        status=ScreeningStatus.UPLOADING.value,
        is_demo=True,
    )
    db.add(screening)
    db.commit()
    db.refresh(screening)

    for filename, text in demo_resumes():
        content = text.encode("utf-8")
        try:
            path, digest = save_upload(content, filename, settings.upload_dir / f"demo-{screening.id}")
        except OSError as exc:  # pragma: no cover
            logger.error("Could not store demo resume: %s", exc)
            raise HTTPException(status_code=500, detail="Demo data could not be written to disk.") from exc
        db.add(
            Candidate(
                screening_id=screening.id,
                resume_filename=filename,
                stored_path=str(path),
                file_hash=digest,
                resume_text="",
                parsed_profile={},
                parse_status=ParseStatus.PENDING.value,
            )
        )
    db.commit()

    thread = threading.Thread(target=run_analysis, args=(screening.id,), name=f"demo-{screening.id}", daemon=True)
    thread.start()

    return DemoLoadResponse(
        screening_id=screening.id,
        job_title=screening.job_title,
        candidates=len(demo_resumes()),
        message="Demo screening created with synthetic candidates. Analysis started.",
    )
