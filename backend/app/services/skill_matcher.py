"""Structured skill matching.

Five outcomes per requirement, in order of strength:

1. exact    - the canonical skill is present in the resume
2. alias    - an alias of the canonical skill is present ("JS" for JavaScript)
3. related  - a *related but different* skill is present (Java for Kotlin);
              partial credit only, and labelled as such in the UI
4. semantic - no structured evidence, but the resume text is semantically
              close to the requirement (embedding similarity above threshold)
5. none     - no evidence

Evidence zone matters: a skill demonstrated in work experience or a project
scores slightly higher than the same skill merely listed in a skills block, so
keyword stuffing does not inflate the score.
"""

from __future__ import annotations

from app.core.config import MATCH_CREDIT, REQUIREMENT_WEIGHTS
from app.services.semantic_matcher import SemanticMatcher
from app.services.skill_taxonomy import canonical_name, related_skills

EVIDENCE_ZONES = {"experience", "projects"}


def _credit_key(match_type: str, evidenced: bool) -> str:
    if match_type in ("exact", "alias"):
        return f"{match_type}_{'evidenced' if evidenced else 'listed'}"
    if match_type == "related":
        return f"related_{'evidenced' if evidenced else 'listed'}"
    return match_type


def _evidence_text(profile: dict, zones: list[str]) -> str:
    parts: list[str] = []
    if "experience" in zones or "other" in zones:
        for entry in profile.get("experience_entries", []):
            parts.append(" ".join(filter(None, [entry.get("title"), entry.get("company"), entry.get("description")])))
    if "projects" in zones:
        for project in profile.get("projects", []):
            parts.append(f"{project.get('name')} {project.get('description')}")
    if "summary" in zones:
        parts.append(profile.get("summary") or "")
    return " ".join(parts)[:1500]


def match_skills(
    requirements: dict,
    profile: dict,
    semantic: SemanticMatcher | None = None,
) -> dict:
    required = list(dict.fromkeys(requirements.get("required_skills") or []))
    preferred = list(dict.fromkeys(requirements.get("preferred_skills") or []))
    preferred = [s for s in preferred if s not in required]

    candidate_skills = set(profile.get("skills") or [])
    evidence_map: dict[str, list[str]] = profile.get("skill_evidence") or {}
    has_candidate_text = bool((profile.get("summary") or "") or profile.get("experience_entries"))

    matches: list[dict] = []
    missing_required: list[str] = []
    missing_preferred: list[str] = []
    uncertain: list[str] = []

    total_weight = 0.0
    earned = 0.0
    per_requirement: list[dict] = []

    for kind in ("required", "preferred"):
        skills = required if kind == "required" else preferred
        weight = REQUIREMENT_WEIGHTS[kind]
        for raw in skills:
            canonical = canonical_name(raw) or raw
            weight_total = weight
            total_weight += weight_total

            zones = evidence_map.get(canonical, [])
            evidenced = bool(EVIDENCE_ZONES & set(zones))
            match_type = "none"
            credit = 0.0
            related_via: list[str] = []
            similarity: float | None = None

            if canonical in candidate_skills or zones:
                match_type = "exact" if raw.strip().lower() == canonical.lower() else "alias"
                credit = MATCH_CREDIT[_credit_key(match_type, evidenced)]
            else:
                related_found = [r for r in related_skills(canonical) if r in candidate_skills]
                if related_found:
                    match_type = "related"
                    related_via = sorted(related_found)
                    related_evidenced = any(
                        EVIDENCE_ZONES & set(evidence_map.get(r, [])) for r in related_found
                    )
                    credit = MATCH_CREDIT[_credit_key("related", related_evidenced)]
                elif semantic is not None and has_candidate_text:
                    evidence_blob = _evidence_text(profile, ["experience", "projects", "summary"])
                    if evidence_blob.strip():
                        cos, method = semantic.similarity(
                            f"Hands-on experience with {canonical}", evidence_blob[:1200]
                        )
                        similarity = round(cos, 4)
                        if SemanticMatcher.is_evidence(cos, method):
                            match_type = "semantic"
                            credit = MATCH_CREDIT["semantic"]

            earned += weight_total * credit
            entry = {
                "skill": raw,
                "canonical": canonical,
                "requirement": kind,
                "match_type": match_type,
                "credit": round(credit, 3),
                "weight": weight_total,
                "evidence_zones": zones,
                "related_via": related_via,
                "similarity": similarity,
            }
            per_requirement.append(entry)
            if match_type != "none":
                matches.append(entry)
            else:
                (missing_required if kind == "required" else missing_preferred).append(raw)
                # If the parser found almost nothing, absence is uncertainty, not proof.
                if not candidate_skills and not has_candidate_text:
                    uncertain.append(raw)

    skill_score = round((earned / total_weight) * 100, 1) if total_weight else None

    matched_required = [m["skill"] for m in matches if m["requirement"] == "required"]
    matched_preferred = [m["skill"] for m in matches if m["requirement"] == "preferred"]

    return {
        "score": skill_score,
        "matches": sorted(matches, key=lambda m: (-m["weight"], -m["credit"], m["skill"])),
        "per_requirement": per_requirement,
        "missing_required": missing_required,
        "missing_preferred": missing_preferred,
        "uncertain": sorted(set(uncertain)),
        "coverage": {
            "required": {
                "matched": len(matched_required),
                "total": len(required),
                "matched_skills": matched_required,
            },
            "preferred": {
                "matched": len(matched_preferred),
                "total": len(preferred),
                "matched_skills": matched_preferred,
            },
        },
        "related_only": [m["skill"] for m in matches if m["match_type"] == "related"],
        "semantic_only": [m["skill"] for m in matches if m["match_type"] == "semantic"],
    }
