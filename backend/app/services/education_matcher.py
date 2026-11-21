"""Education / qualification matching.

Scored only when the job description actually asks for a qualification, and
only when the resume yielded education data. Missing information is reported as
unknown and excluded from the weighted average rather than scored as zero.
"""

from __future__ import annotations

import re

from app.services.resume_parser import LEVEL_NAMES

REQUIRED_LEVELS: list[tuple[int, tuple[str, ...]]] = [
    (4, ("doctorate", "phd", "ph.d")),
    (3, ("master", "mba", "msc", "m.sc", "m.tech", "postgraduate")),
    (2, ("bachelor", "b.tech", "bsc", "b.sc", "b.e", "bca", "undergraduate", "degree")),
    (1, ("diploma", "certificate")),
]

STOPWORDS = {
    "in", "of", "or", "and", "the", "a", "an", "equivalent", "related", "field",
    "discipline", "degree", "science", "sciences", "engineering", "any",
}


def _required_level(requirements: list[str]) -> int:
    text = " ".join(requirements).lower()
    for level, keywords in REQUIRED_LEVELS:
        if any(k in text for k in keywords):
            return level
    return 0


def _field_tokens(requirements: list[str]) -> set[str]:
    text = " ".join(requirements).lower()
    match = re.search(r"(?:degree|bachelor'?s?|master'?s?|diploma)\s+(?:in|of)\s+([a-z &,]{3,45})", text)
    if not match:
        return set()
    words = re.split(r"[\s,&]+", match.group(1))
    return {w for w in words if len(w) > 2 and w not in STOPWORDS}


def match_education(requirements: dict, profile: dict) -> dict:
    required = [r for r in (requirements.get("education_requirements") or []) if r.strip()]
    candidate = profile.get("education") or []

    if not required:
        return {
            "available": False,
            "score": None,
            "required": [],
            "candidate": candidate,
            "note": "The job description sets no education requirement, so this component is not scored.",
            "level_required": 0,
            "level_candidate": profile.get("highest_education_level") or 0,
        }

    if not candidate:
        return {
            "available": False,
            "score": None,
            "required": required,
            "candidate": [],
            "note": "No education details could be extracted from this resume; treated as unknown, not as a mismatch.",
            "level_required": _required_level(required),
            "level_candidate": 0,
        }

    required_level = _required_level(required)
    candidate_level = max((e.get("level") or 0 for e in candidate), default=0)
    field_tokens = _field_tokens(required)

    field_match = True
    if field_tokens:
        candidate_fields = " ".join(
            filter(None, [(e.get("field") or "") + " " + (e.get("degree") or "") for e in candidate])
        ).lower()
        field_match = any(token in candidate_fields for token in field_tokens)

    if required_level and candidate_level < required_level:
        gap = required_level - candidate_level
        score = 55.0 if gap == 1 else 30.0
        note = (
            f"Requires {LEVEL_NAMES.get(required_level, 'a higher degree')}; the resume shows "
            f"{LEVEL_NAMES.get(candidate_level, 'no recognised degree')}."
        )
    elif field_tokens and not field_match:
        score = 75.0
        note = (
            f"Degree level is met ({LEVEL_NAMES.get(candidate_level, 'unknown')}) but the field does not "
            f"match the requested background ({', '.join(sorted(field_tokens))})."
        )
    else:
        score = 100.0
        note = f"Meets the stated education requirement ({LEVEL_NAMES.get(required_level or candidate_level, 'unknown')})."

    return {
        "available": True,
        "score": round(score, 1),
        "required": required,
        "candidate": candidate,
        "note": note,
        "level_required": required_level,
        "level_candidate": candidate_level,
        "field_match": field_match if field_tokens else None,
    }
