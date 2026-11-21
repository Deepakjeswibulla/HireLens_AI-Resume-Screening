"""Semantic relevance scoring.

Requirement side: the job's responsibilities, plus one short sentence per
required and preferred skill, plus domain and education asks. Candidate side:
the professional summary, each role (title + company + description) and each
project.

For every requirement passage we take the *best* matching candidate passage
(a requirement can be satisfied by any one part of the resume) and average
those best similarities. Averaging over requirements - rather than comparing
whole documents - stops a long resume from drifting away from a short JD.
"""

from __future__ import annotations

from app.services.semantic_matcher import SemanticMatcher


def _requirement_passages(requirements: dict, job_title: str | None) -> list[dict]:
    passages: list[dict] = []
    if job_title:
        passages.append({"label": f"Role: {job_title}", "text": f"Working as a {job_title}."})
    for skill in (requirements.get("required_skills") or [])[:12]:
        passages.append({"label": f"Required: {skill}", "text": f"Hands-on experience with {skill}."})
    for skill in (requirements.get("preferred_skills") or [])[:6]:
        passages.append({"label": f"Preferred: {skill}", "text": f"Familiarity with {skill}."})
    for item in (requirements.get("responsibilities") or [])[:10]:
        passages.append({"label": "Responsibility", "text": item})
    for domain in (requirements.get("domain_requirements") or [])[:3]:
        passages.append({"label": f"Domain: {domain}", "text": f"Experience building products for {domain}."})
    for edu in (requirements.get("education_requirements") or [])[:2]:
        passages.append({"label": f"Education: {edu}", "text": edu})
    return passages


def _candidate_passages(profile: dict) -> list[dict]:
    passages: list[dict] = []
    if profile.get("summary"):
        passages.append({"label": "Summary", "text": profile["summary"][:900]})
    for entry in (profile.get("experience_entries") or [])[:10]:
        text = " ".join(
            filter(None, [entry.get("title"), entry.get("company"), entry.get("description")])
        ).strip()
        if text:
            passages.append({"label": f"Experience: {entry.get('title') or 'role'}", "text": text[:900]})
    for project in (profile.get("projects") or [])[:6]:
        text = f"{project.get('name') or ''} {project.get('description') or ''}".strip()
        if text:
            passages.append({"label": f"Project: {project.get('name') or 'project'}", "text": text[:700]})
    if not passages and profile.get("skills"):
        passages.append({"label": "Skills", "text": ", ".join(profile["skills"][:40])})
    return passages


def score_semantic(
    requirements: dict,
    profile: dict,
    job_title: str | None,
    semantic: SemanticMatcher,
) -> dict:
    req_passages = _requirement_passages(requirements, job_title)
    cand_passages = _candidate_passages(profile)

    if not req_passages or not cand_passages:
        return {
            "available": False,
            "score": None,
            "method": semantic.status().get("method"),
            "mean_similarity": None,
            "top_passages": [],
            "note": "Not enough job or resume text to run semantic comparison.",
        }

    matrix, method = semantic.similarity_matrix(
        [p["text"] for p in req_passages], [p["text"] for p in cand_passages]
    )

    best_per_requirement: list[dict] = []
    for i, req in enumerate(req_passages):
        row = matrix[i]
        best_index = int(row.argmax())
        best_cos = float(row[best_index])
        best_per_requirement.append(
            {
                "requirement": req["label"],
                "requirement_text": req["text"][:300],
                "best_passage": cand_passages[best_index]["text"][:300],
                "best_passage_label": cand_passages[best_index]["label"],
                "similarity": round(best_cos, 4),
                "calibrated": SemanticMatcher.calibrate(best_cos, method),
            }
        )

    mean_cos = sum(item["similarity"] for item in best_per_requirement) / len(best_per_requirement)
    score = round(SemanticMatcher.calibrate(mean_cos, method), 1)
    top = sorted(best_per_requirement, key=lambda item: -item["similarity"])[:5]

    return {
        "available": True,
        "score": score,
        "method": method,
        "mean_similarity": round(mean_cos, 4),
        "passages_compared": len(req_passages),
        "top_passages": top,
        "all_passages": best_per_requirement,
        "note": (
            "Mean of the best-matching resume passage for each job requirement, "
            f"calibrated from cosine similarity ({method} window "
            f"{SemanticMatcher.window_for(method)['low']}-{SemanticMatcher.window_for(method)['high']}) onto 0-100."
        ),
    }
