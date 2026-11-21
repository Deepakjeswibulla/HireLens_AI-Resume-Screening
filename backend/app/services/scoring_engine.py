"""Score engine: combines the four components into a final 0-100 score.

Missing-information policy
--------------------------
Each component reports ``available``. Unavailable components (e.g. the JD states
no education requirement, or employment dates could not be parsed) are dropped
and the remaining weights are renormalised, so the candidate is never punished
for information the parser could not find. ``data_completeness`` reports the
share of the configured weight that was actually scored, and the UI shows it.
"""

from __future__ import annotations

from app.core.config import SCORE_VERSION, SCORE_WEIGHTS, label_for_score
from app.services.education_matcher import match_education
from app.services.experience_matcher import match_experience
from app.services.explanation import build_explanation
from app.services.semantic_matcher import SemanticMatcher
from app.services.semantic_relevance import score_semantic
from app.services.skill_matcher import match_skills


def _round(value: float | None) -> float | None:
    return None if value is None else round(float(value), 1)


def analyse_candidate(
    requirements: dict,
    profile: dict,
    job_title: str | None,
    semantic: SemanticMatcher,
    precomputed: dict | None = None,
) -> dict:
    """Run all matchers for one candidate and return the stored analysis payload.

    ``precomputed`` lets the pipeline hand in component results it already
    calculated, so no embedding work is repeated.
    """
    precomputed = precomputed or {}
    skills = precomputed.get("skills") or match_skills(requirements, profile, semantic)
    relevance = precomputed.get("semantic") or score_semantic(
        requirements, profile, job_title, semantic
    )
    experience = precomputed.get("experience") or match_experience(requirements, profile, semantic)
    education = precomputed.get("education") or match_education(requirements, profile)

    components = {
        "skills": {"score": skills["score"], "available": skills["score"] is not None},
        "semantic": {"score": relevance["score"], "available": bool(relevance.get("available"))},
        "experience": {"score": experience["score"], "available": bool(experience.get("available"))},
        "education": {"score": education["score"], "available": bool(education.get("available"))},
    }

    available_weight = sum(
        SCORE_WEIGHTS[name] for name, comp in components.items() if comp["available"]
    )
    unavailable = [name for name, comp in components.items() if not comp["available"]]

    if available_weight <= 0:
        overall = 0.0
        effective: dict[str, float] = {}
    else:
        effective = {
            name: round(SCORE_WEIGHTS[name] / available_weight, 4)
            for name, comp in components.items()
            if comp["available"]
        }
        overall = sum(
            effective[name] * float(comp["score"] or 0.0) for name, comp in components.items()
            if comp["available"]
        )
        overall = round(min(max(overall, 0.0), 100.0), 1)

    data_completeness = round((available_weight / sum(SCORE_WEIGHTS.values())) * 100, 1)
    label = label_for_score(overall)

    analysis = {
        "overall_score": overall,
        "match_label": label,
        "skill_score": _round(skills["score"]),
        "semantic_score": _round(relevance["score"]),
        "experience_score": _round(experience["score"]),
        "education_score": _round(education["score"]),
        "weights": SCORE_WEIGHTS,
        "effective_weights": effective,
        "unavailable_components": unavailable,
        "data_completeness": data_completeness,
        "score_version": SCORE_VERSION,
        "components": {
            "skills": skills,
            "semantic": relevance,
            "experience": experience,
            "education": education,
        },
        "matched_skills": skills["matches"],
        "missing_skills": {
            "required": skills["missing_required"],
            "preferred": skills["missing_preferred"],
            "uncertain": skills["uncertain"],
        },
        "coverage": skills["coverage"],
        "related_only": skills["related_only"],
        "semantic_only": skills["semantic_only"],
    }
    analysis["explanation"] = build_explanation(analysis, requirements, profile)
    return analysis
