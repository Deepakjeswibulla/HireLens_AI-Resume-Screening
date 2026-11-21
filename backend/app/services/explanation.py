"""Deterministic, evidence-grounded explanations.

Every sentence is assembled from numbers and text that were actually extracted
from the resume and the job description. Nothing is generated freely, so the
explanation can never invent an achievement.
"""

from __future__ import annotations


def _list(items: list[str], limit: int = 5) -> str:
    items = [i for i in items if i]
    if not items:
        return ""
    shown = items[:limit]
    extra = len(items) - len(shown)
    text = ", ".join(shown)
    return f"{text} and {extra} more" if extra > 0 else text


def build_explanation(analysis: dict, requirements: dict, profile: dict) -> dict:
    skills = analysis["components"]["skills"]
    semantic = analysis["components"]["semantic"]
    experience = analysis["components"]["experience"]
    education = analysis["components"]["education"]

    required_total = skills["coverage"]["required"]["total"]
    required_matched = skills["coverage"]["required"]["matched"]
    preferred_total = skills["coverage"]["preferred"]["total"]
    preferred_matched = skills["coverage"]["preferred"]["matched"]

    strengths: list[str] = []
    gaps: list[str] = []
    notes: list[str] = []

    evidenced = [m["skill"] for m in skills["matches"] if m["requirement"] == "required" and m["match_type"] in ("exact", "alias")]
    if evidenced:
        strengths.append(f"Required skills found: {_list(evidenced)}.")
    elif required_total:
        gaps.append("None of the required skills were found in the resume text.")

    if skills["missing_required"]:
        gaps.append(f"Missing required skills: {_list(skills['missing_required'])}.")
    if skills["related_only"]:
        notes.append(
            f"Related but not equivalent skills cover {_list(skills['related_only'])} - "
            "partial credit only, no exact match claimed."
        )
    if skills["semantic_only"]:
        notes.append(
            f"Semantically close evidence (no explicit mention) for {_list(skills['semantic_only'])}."
        )

    if experience.get("available"):
        if experience.get("total_years") is not None:
            relevant = float(experience.get("relevant_years") or 0)
            required = experience.get("required_years")
            line = (
                f"{relevant:g} years of relevant experience out of "
                f"{experience['total_years']:g} total, against a "
                f"{required:g}-year requirement."
            )
            if required is not None and relevant < float(required):
                gaps.append(line)
            else:
                strengths.append(line)
        elif experience.get("required_years") is not None:
            gaps.append(experience.get("note") or "Experience could not be established.")
    elif experience.get("note"):
        notes.append(experience["note"])

    if education.get("available"):
        if education.get("score", 0) >= 100:
            strengths.append(f"Education requirement met: {_list(education.get('required', []), 2)}.")
        else:
            gaps.append(education.get("note") or "Education does not fully match the requirement.")
    elif education.get("required"):
        notes.append(education["note"])

    if semantic.get("available"):
        best = (semantic.get("top_passages") or [{}])[0]
        if best.get("requirement"):
            strengths.append(
                f"Strongest semantic overlap: '{best['requirement']}' vs "
                f"'{best.get('best_passage_label', 'resume')}' (cosine {best['similarity']:.2f})."
            )
        notes.append(
            f"Semantic similarity averaged {semantic['mean_similarity']:.2f} across "
            f"{semantic.get('passages_compared', 0)} requirement passages "
            f"({semantic.get('method')} backend)."
        )

    if analysis["unavailable_components"]:
        notes.append(
            "Not scored (information unavailable): "
            + ", ".join(analysis["unavailable_components"])
            + f". Remaining weights were renormalised; data completeness {analysis['data_completeness']:.0f}%."
        )

    summary_parts = [
        f"Scored {analysis['overall_score']:.1f}/100 ({analysis['match_label']})",
        f"skills {analysis['skill_score'] if analysis['skill_score'] is not None else 'n/a'}",
        f"semantic {analysis['semantic_score'] if analysis['semantic_score'] is not None else 'n/a'}",
        f"experience {analysis['experience_score'] if analysis['experience_score'] is not None else 'n/a'}",
        f"education {analysis['education_score'] if analysis['education_score'] is not None else 'n/a'}",
    ]
    coverage_line = (
        f"Required skill coverage {required_matched}/{required_total}"
        + (f", preferred {preferred_matched}/{preferred_total}" if preferred_total else "")
    )

    headline = (
        f"{profile.get('name') or 'This candidate'} matches "
        f"{required_matched} of {required_total} required skills"
        + (f" and {preferred_matched} of {preferred_total} preferred skills" if preferred_total else "")
        + "."
    )

    return {
        "headline": headline,
        "summary": "; ".join(summary_parts) + ".",
        "coverage_line": coverage_line + ".",
        "strengths": strengths,
        "gaps": gaps,
        "notes": notes,
        "disclaimer": (
            "Scores are decision support only. They describe evidence found in the resume text "
            "and must not be used as an automatic hiring decision."
        ),
    }
