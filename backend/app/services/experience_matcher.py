"""Experience matching.

Total experience comes from merged employment date ranges (see
``resume_parser.merge_months``). *Relevant* experience is the portion of each
role's duration that overlaps the job: each role gets a relevance factor from
the better of (a) the share of required skills its text demonstrates and
(b) the calibrated semantic similarity between the role text and the JD, and
its months are multiplied by that factor.

This is deliberately conservative: a role with no overlap at all contributes
nothing, so "10 years of unrelated work" cannot beat "3 years of exactly the
right work".
"""

from __future__ import annotations

from app.services.semantic_matcher import SemanticMatcher
from app.services.skill_extractor import detect_skills
from app.services.skill_taxonomy import canonical_name


def _jd_core_text(requirements: dict) -> str:
    parts = [requirements.get("job_title") or ""]
    parts += requirements.get("required_skills") or []
    parts += (requirements.get("responsibilities") or [])[:8]
    parts += requirements.get("domain_requirements") or []
    return " ".join(p for p in parts if p).strip()[:1500]


def match_experience(
    requirements: dict,
    profile: dict,
    semantic: SemanticMatcher | None = None,
) -> dict:
    required_years = requirements.get("minimum_experience")
    required_skills = [canonical_name(s) or s for s in (requirements.get("required_skills") or [])]
    entries = profile.get("experience_entries") or []
    total_months = int(profile.get("total_experience_months") or 0)

    jd_text = _jd_core_text(requirements)
    roles: list[dict] = []
    relevant_months = 0.0

    for entry in entries:
        months = int(entry.get("months") or 0)
        text = " ".join(
            filter(None, [entry.get("title"), entry.get("company"), entry.get("description")])
        ).strip()

        # structured overlap: which required skills does this role's text show?
        detected = set(detect_skills(text))
        overlap = [s for s in required_skills if s in detected]
        skill_factor = (len(overlap) / len(required_skills)) if required_skills else 0.0

        semantic_cos = 0.0
        semantic_factor = 0.0
        if semantic is not None and text and jd_text:
            semantic_cos, method = semantic.similarity(text[:1200], jd_text)
            semantic_factor = SemanticMatcher.calibrate(semantic_cos, method) / 100.0 if semantic_cos else 0.0

        # Semantic-only relevance is discounted: role descriptions are short and
        # embedding similarity between unrelated engineering roles is non-trivial.
        # Explicit skill overlap is the stronger signal and is used undiscounted.
        factor = max(skill_factor, 0.6 * semantic_factor)
        if not text:
            factor = 0.0
        factor = max(0.0, min(1.0, round(factor, 3)))
        if factor >= 0.6:
            relevance = "high"
        elif factor >= 0.3:
            relevance = "partial"
        elif factor > 0:
            relevance = "low"
        else:
            relevance = "none"

        relevant_months += months * factor
        roles.append(
            {
                "title": entry.get("title"),
                "company": entry.get("company"),
                "start": entry.get("start"),
                "end": entry.get("end"),
                "months": months,
                "dates_confident": entry.get("dates_confident", False),
                "relevance": relevance,
                "relevance_factor": factor,
                "matched_required_skills": overlap,
                "semantic_similarity": round(semantic_cos, 3) if semantic_cos else None,
                "description": (entry.get("description") or "")[:600],
            }
        )

    relevant_years = round(relevant_months / 12, 1) if total_months else 0.0
    # Never claim more relevant experience than total experience.
    if total_months:
        relevant_years = min(relevant_years, round(total_months / 12, 1))

    available = True
    score: float | None = None
    note: str | None = None

    if required_years is None:
        available = False
        note = "The job description does not state a minimum experience, so this component is not scored."
    elif total_months == 0 and entries:
        available = False
        note = "Employment dates could not be parsed, so experience is unknown rather than zero."
    elif total_months == 0 and not entries:
        score = 0.0
        note = "No work experience was found in this resume."
    else:
        ratio = relevant_months / 12 / max(float(required_years), 0.1)
        score = round(min(ratio, 1.0) * 100, 1)
        if score >= 100:
            note = f"Meets the {required_years:g}-year requirement with relevant experience."
        else:
            note = (
                f"{relevant_years:g} relevant years against a {required_years:g}-year requirement "
                f"({score:.0f}% of the requirement)."
            )

    return {
        "available": available,
        "score": score,
        "required_years": required_years,
        "total_years": round(total_months / 12, 1) if total_months else None,
        "relevant_years": relevant_years if total_months else None,
        "roles": roles,
        "note": note,
    }
