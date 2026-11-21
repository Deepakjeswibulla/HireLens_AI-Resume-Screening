"""Skill detection and normalisation over free text.

Detection is span-aware: aliases are matched longest-first and consumed, so
"React Native" never also registers as "React" and "JavaScript" never
registers as "Java".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.skill_taxonomy import SORTED_ALIASES, canonical_name


@dataclass
class SkillHit:
    canonical: str
    matched_text: str
    count: int = 1
    match_type: str = "alias"  # "exact" when the canonical name itself appears
    spans: list[tuple[int, int]] = field(default_factory=list)


def _alias_pattern(alias: str) -> re.Pattern[str]:
    escaped = re.escape(alias)
    # \b does not work around symbols such as C++ or C#, so use explicit guards.
    return re.compile(rf"(?<![A-Za-z0-9+#.]){escaped}(?![A-Za-z0-9+#])", re.IGNORECASE)


_PATTERN_CACHE: dict[str, re.Pattern[str]] = {}


def detect_skills(text: str) -> dict[str, SkillHit]:
    """Return ``{canonical: SkillHit}`` for every skill found in ``text``."""
    if not text or not text.strip():
        return {}

    # Work on a lowercased copy of the same length so spans stay valid.
    haystack = text.lower()
    consumed = bytearray(len(haystack))
    hits: dict[str, SkillHit] = {}

    for alias, canonical in SORTED_ALIASES:
        if len(alias) < 2:
            continue
        pattern = _PATTERN_CACHE.get(alias)
        if pattern is None:
            pattern = _alias_pattern(alias)
            _PATTERN_CACHE[alias] = pattern

        for match in pattern.finditer(haystack):
            start, end = match.span()
            if any(consumed[start:end]):
                continue
            for i in range(start, end):
                consumed[i] = 1
            existing = hits.get(canonical)
            if existing is None:
                hits[canonical] = SkillHit(
                    canonical=canonical,
                    matched_text=text[start:end],
                    count=1,
                    match_type="exact" if text[start:end].strip().lower() == canonical.lower() else "alias",
                    spans=[(start, end)],
                )
            else:
                existing.count += 1
                existing.spans.append((start, end))
    return hits


def skill_names(text: str) -> list[str]:
    return sorted(detect_skills(text))


def normalise_skill_list(items: list[str]) -> list[str]:
    """Map a recruiter-edited skill list onto canonical names where possible."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in items:
        name = (raw or "").strip()
        if not name:
            continue
        canonical = canonical_name(name)
        if canonical is None:
            found = detect_skills(name)
            canonical = next(iter(found), None) if len(found) == 1 else None
        label = canonical or name
        if label.lower() in seen:
            continue
        seen.add(label.lower())
        out.append(label)
    return out
