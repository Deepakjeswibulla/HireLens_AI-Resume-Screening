"""Analytics computed from stored analyses - never from hardcoded values."""

from __future__ import annotations

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Candidate, CandidateAnalysis, Screening

EXPERIENCE_BUCKETS = [
    (0, 1, "< 1 year"),
    (1, 2, "1-2 years"),
    (2, 4, "2-4 years"),
    (4, 6, "4-6 years"),
    (6, 10, "6-10 years"),
    (10, 100, "10+ years"),
]


def screening_analytics(db: Session, screening: Screening) -> dict:
    rows = db.execute(
        select(Candidate, CandidateAnalysis)
        .join(CandidateAnalysis, CandidateAnalysis.candidate_id == Candidate.id)
        .where(Candidate.screening_id == screening.id)
    ).all()

    total_candidates = db.execute(
        select(Candidate).where(Candidate.screening_id == screening.id)
    ).scalars().all()

    if not rows:
        return {
            "has_data": False,
            "candidate_count": len(total_candidates),
            "analyzed_count": 0,
            "message": "No analysed candidates yet for this screening.",
        }

    scores = [float(a.overall_score or 0) for _, a in rows]
    requirements = screening.requirements or {}
    required_skills = requirements.get("required_skills") or []
    preferred_skills = requirements.get("preferred_skills") or []

    # score distribution
    buckets = [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50), (50, 60), (60, 70), (70, 80), (80, 90), (90, 101)]
    distribution = []
    for low, high in buckets:
        count = sum(1 for s in scores if low <= s < high)
        label = f"{low}-{high - 1}" if high < 101 else "90-100"
        distribution.append({"range": label, "count": count})

    # required skill coverage
    coverage: Counter[str] = Counter()
    matched_freq: Counter[str] = Counter()
    missing_freq: Counter[str] = Counter()
    for _candidate, analysis in rows:
        details = analysis.details or {}
        matches = details.get("matched_skills") or []
        for match in matches:
            if match.get("requirement") == "required":
                coverage[match["skill"]] += 1
                matched_freq[match["skill"]] += 1
            elif match.get("requirement") == "preferred":
                matched_freq[match["skill"]] += 1
        for skill in (details.get("missing_skills") or {}).get("required", []):
            missing_freq[skill] += 1

    required_coverage = [
        {
            "skill": skill,
            "matched": coverage.get(skill, 0),
            "total": len(rows),
            "percent": round(coverage.get(skill, 0) / len(rows) * 100, 1),
        }
        for skill in required_skills
    ]
    required_coverage.sort(key=lambda item: item["percent"])

    # experience distribution
    experience_values = []
    meeting_experience = 0
    required_years = requirements.get("minimum_experience")
    for _candidate, analysis in rows:
        experience = ((analysis.details or {}).get("components") or {}).get("experience") or {}
        relevant = experience.get("relevant_years")
        if relevant is not None:
            experience_values.append(float(relevant))
            if required_years and float(relevant) >= float(required_years):
                meeting_experience += 1

    experience_distribution = []
    for low, high, label in EXPERIENCE_BUCKETS:
        count = sum(1 for v in experience_values if low <= v < high)
        experience_distribution.append({"range": label, "count": count})

    strong = sum(1 for s in scores if s >= 85)
    top_rows = sorted(rows, key=lambda row: -(row[1].overall_score or 0))[:5]
    top_candidates = [
        {
            "name": candidate.name or "Unnamed candidate",
            "overall": round(float(analysis.overall_score or 0), 1),
            "skills": analysis.skill_score,
            "semantic": analysis.semantic_score,
            "experience": analysis.experience_score,
            "education": analysis.education_score,
        }
        for candidate, analysis in top_rows
    ]

    status_counts = Counter(c.status for c in total_candidates)
    label_counts = Counter(a.match_label for _c, a in rows)

    return {
        "has_data": True,
        "candidate_count": len(total_candidates),
        "analyzed_count": len(rows),
        "failed_count": len([c for c in total_candidates if c.parse_status == "failed"]),
        "average_score": round(sum(scores) / len(scores), 1),
        "highest_score": round(max(scores), 1),
        "lowest_score": round(min(scores), 1),
        "strong_matches": strong,
        "strong_match_percent": round(strong / len(rows) * 100, 1),
        "label_distribution": [{"label": k, "count": v} for k, v in label_counts.most_common()],
        "status_distribution": [{"status": k, "count": v} for k, v in status_counts.items()],
        "score_distribution": distribution,
        "required_skill_coverage": required_coverage,
        "preferred_skill_count": len(preferred_skills),
        "most_common_gaps": [{"skill": k, "count": v} for k, v in missing_freq.most_common(8)],
        "most_matched_skills": [{"skill": k, "count": v} for k, v in matched_freq.most_common(8)],
        "experience_distribution": experience_distribution,
        "minimum_experience": required_years,
        "meeting_experience": meeting_experience,
        "meeting_experience_percent": (
            round(meeting_experience / len(experience_values) * 100, 1) if experience_values else None
        ),
        "top_candidates": top_candidates,
    }


def global_analytics(db: Session) -> dict:
    screenings = db.execute(select(Screening).order_by(Screening.created_at.desc())).scalars().all()
    candidates = db.execute(select(Candidate)).scalars().all()
    analyses = db.execute(select(CandidateAnalysis)).scalars().all()

    scores = [float(a.overall_score or 0) for a in analyses]
    return {
        "screenings": len(screenings),
        "candidates": len(candidates),
        "analyzed": len(analyses),
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
        "strong_matches": sum(1 for s in scores if s >= 85),
        "shortlisted": sum(1 for c in candidates if c.status == "shortlisted"),
    }
