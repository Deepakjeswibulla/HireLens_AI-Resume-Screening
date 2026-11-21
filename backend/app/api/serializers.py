"""Serialisation helpers shared by the API routes."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import Candidate, CandidateAnalysis, Screening


def screening_metrics(db: Session, screening: Screening) -> dict:
    total = db.execute(
        select(func.count(Candidate.id)).where(Candidate.screening_id == screening.id)
    ).scalar_one()
    analyzed = db.execute(
        select(func.count(CandidateAnalysis.id))
        .join(Candidate, Candidate.id == CandidateAnalysis.candidate_id)
        .where(Candidate.screening_id == screening.id)
    ).scalar_one()
    failed = db.execute(
        select(func.count(Candidate.id)).where(
            Candidate.screening_id == screening.id, Candidate.parse_status == "failed"
        )
    ).scalar_one()
    avg_score = db.execute(
        select(func.avg(CandidateAnalysis.overall_score))
        .join(Candidate, Candidate.id == CandidateAnalysis.candidate_id)
        .where(Candidate.screening_id == screening.id)
    ).scalar()
    top_score = db.execute(
        select(func.max(CandidateAnalysis.overall_score))
        .join(Candidate, Candidate.id == CandidateAnalysis.candidate_id)
        .where(Candidate.screening_id == screening.id)
    ).scalar()
    strong = db.execute(
        select(func.count(CandidateAnalysis.id))
        .join(Candidate, Candidate.id == CandidateAnalysis.candidate_id)
        .where(Candidate.screening_id == screening.id, CandidateAnalysis.overall_score >= 85)
    ).scalar_one()

    return {
        "candidate_count": int(total or 0),
        "analyzed_count": int(analyzed or 0),
        "failed_count": int(failed or 0),
        "average_score": round(float(avg_score), 1) if avg_score is not None else None,
        "top_score": round(float(top_score), 1) if top_score is not None else None,
        "strong_matches": int(strong or 0),
    }


def screening_summary(db: Session, screening: Screening) -> dict:
    metrics = screening_metrics(db, screening)
    requirements = screening.requirements or {}
    return {
        "id": screening.id,
        "job_title": screening.job_title,
        "company": screening.company,
        "status": screening.status,
        "is_demo": bool(screening.is_demo),
        "created_at": screening.created_at,
        "updated_at": screening.updated_at,
        "analyzed_at": screening.analyzed_at,
        "required_skill_count": len(requirements.get("required_skills") or []),
        **metrics,
    }


def screening_detail(db: Session, screening: Screening) -> dict:
    data = screening_summary(db, screening)
    data.update(
        {
            "job_description": screening.job_description,
            "requirements": screening.requirements or {},
            "score_version": screening.score_version,
        }
    )
    return data


def candidate_item(candidate: Candidate) -> dict:
    analysis = candidate.analysis
    details = (analysis.details or {}) if analysis else {}
    experience = ((details.get("components") or {}).get("experience") or {})
    matched = details.get("matched_skills") or []
    required_matched = [
        m["skill"] for m in matched if m.get("requirement") == "required"
    ]
    required_missing = (details.get("missing_skills") or {}).get("required", [])
    return {
        "id": candidate.id,
        "screening_id": candidate.screening_id,
        "name": candidate.name,
        "email": candidate.email,
        "resume_filename": candidate.resume_filename,
        "parse_status": candidate.parse_status,
        "parse_error": candidate.parse_error,
        "status": candidate.status,
        "overall_score": analysis.overall_score if analysis else None,
        "match_label": analysis.match_label if analysis else None,
        "rank": analysis.rank if analysis else None,
        "skill_score": analysis.skill_score if analysis else None,
        "semantic_score": analysis.semantic_score if analysis else None,
        "experience_score": analysis.experience_score if analysis else None,
        "education_score": analysis.education_score if analysis else None,
        "total_experience_years": (candidate.parsed_profile or {}).get("total_experience_years"),
        "relevant_experience_years": experience.get("relevant_years"),
        "matched_skill_count": len(required_matched),
        "required_matched": required_matched,
        "required_missing": required_missing,
        "data_completeness": analysis.data_completeness if analysis else 100.0,
    }


def candidate_detail(candidate: Candidate) -> dict:
    data = candidate_item(candidate)
    profile = candidate.parsed_profile or {}
    data.update(
        {
            "parsed_profile": profile,
            "analysis": candidate.analysis.details if candidate.analysis else None,
            "resume_text": candidate.resume_text,
            "file_available": bool(candidate.stored_path),
        }
    )
    return data
