"""Candidate ranking within a screening."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Candidate, CandidateAnalysis


def rank_candidates(db: Session, screening_id: int) -> list[tuple[int, int]]:
    """Assign rank 1..n and return ``[(candidate_id, rank)]``.

    Ties are broken by relevant experience (from the stored analysis detail)
    and then by candidate id, so ranking is deterministic and reproducible.
    """
    rows = db.execute(
        select(CandidateAnalysis, Candidate)
        .join(Candidate, Candidate.id == CandidateAnalysis.candidate_id)
        .where(Candidate.screening_id == screening_id)
    ).all()

    def sort_key(row) -> tuple:
        analysis, candidate = row
        details = analysis.details or {}
        experience = (details.get("components") or {}).get("experience") or {}
        relevant = experience.get("relevant_years") or 0
        return (-float(analysis.overall_score or 0), -float(relevant or 0), candidate.id)

    ordered = sorted(rows, key=sort_key)
    result: list[tuple[int, int]] = []
    for position, (analysis, candidate) in enumerate(ordered, start=1):
        analysis.rank = position
        result.append((candidate.id, position))
    db.flush()
    return result
