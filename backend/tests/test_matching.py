"""Matching engine tests: skills, experience, education, scoring, ranking."""

from __future__ import annotations

from app.core.config import SCORE_WEIGHTS
from app.services.education_matcher import match_education
from app.services.experience_matcher import match_experience
from app.services.resume_parser import parse_resume
from app.services.scoring_engine import analyse_candidate
from app.services.semantic_matcher import SemanticMatcher, semantic_matcher
from app.services.skill_matcher import match_skills

REQUIREMENTS = {
    "required_skills": ["Python", "FastAPI", "PostgreSQL"],
    "preferred_skills": ["Docker", "AWS"],
    "responsibilities": ["Build REST APIs", "Own database performance"],
    "minimum_experience": 3,
    "education_requirements": ["Bachelor's degree in Computer Science"],
    "domain_requirements": [],
}

STRONG = """Anita Rao
anita.rao@example.com

Summary
Backend engineer with 6 years of Python and FastAPI experience.

Skills
Python, FastAPI, PostgreSQL, Docker, AWS

Experience
Senior Backend Engineer | Orbis
Jan 2020 - Present
Built FastAPI services backed by PostgreSQL and deployed with Docker on AWS.

Education
B.Tech in Computer Science, NIT Surathkal, 2014
"""

RELATED_ONLY = """Bala Kumar
bala.kumar@example.com

Skills
Java, Spring Boot, MySQL

Experience
Engineer | Vertex
Jan 2019 - Present
Built Java microservices and SQL reports.

Education
B.Tech in Computer Science, Anna University, 2018
"""


def _profile(text: str) -> dict:
    return parse_resume(text, "test.txt")


def test_exact_and_preferred_skill_matching():
    result = match_skills(REQUIREMENTS, _profile(STRONG), semantic_matcher)
    assert result["coverage"]["required"]["matched"] == 3
    assert result["coverage"]["preferred"]["matched"] == 2
    assert result["score"] >= 80
    assert not result["missing_required"]


def test_related_skill_gets_partial_credit_only():
    result = match_skills(REQUIREMENTS, _profile(RELATED_ONLY), semantic_matcher)
    related = [m for m in result["matches"] if m["match_type"] == "related"]
    assert related, "MySQL/SQL and Java should register as related evidence"
    for match in related:
        assert match["credit"] <= 0.5
    assert "Python" in result["missing_required"]


def test_evidenced_skill_beats_listed_skill():
    listed_only = _profile("X Y\nSkills\nPython\n")
    evidenced = _profile(
        "X Y\nSkills\nPython\nExperience\nEngineer | A\nJan 2020 - Present\nBuilt Python services.\n"
    )
    req = {"required_skills": ["Python"], "preferred_skills": []}
    listed = match_skills(req, listed_only, semantic_matcher)
    evid = match_skills(req, evidenced, semantic_matcher)
    assert evid["score"] > listed["score"]


def test_experience_ratio_scoring():
    result = match_experience(REQUIREMENTS, _profile(STRONG), semantic_matcher)
    assert result["available"] is True
    assert 0 <= result["score"] <= 100
    assert result["relevant_years"] is not None
    assert result["total_years"] >= result["relevant_years"]


def test_experience_unavailable_when_jd_has_no_requirement():
    requirements = dict(REQUIREMENTS, minimum_experience=None)
    result = match_experience(requirements, _profile(STRONG), semantic_matcher)
    assert result["available"] is False
    assert result["score"] is None


def test_experience_unknown_when_dates_unparsed():
    profile = _profile("X Y\nExperience\nEngineer | A\nBuilt Python services.\n")
    result = match_experience(REQUIREMENTS, profile, semantic_matcher)
    assert result["available"] is False
    assert result["score"] is None


def test_education_missing_requirement_is_not_scored():
    requirements = dict(REQUIREMENTS, education_requirements=[])
    result = match_education(requirements, _profile(STRONG))
    assert result["available"] is False
    assert result["score"] is None


def test_education_unknown_is_not_zero():
    profile = _profile("X Y\nSkills\nPython\n")
    result = match_education(REQUIREMENTS, profile)
    assert result["available"] is False
    assert result["score"] is None
    assert "unknown" in result["note"].lower()


def test_education_level_gap_scores_lower():
    lower = _profile("X Y\nEducation\nDiploma in Computer Science, Some Polytechnic, 2018\n")
    higher = _profile(STRONG)
    assert match_education(REQUIREMENTS, higher)["score"] > match_education(REQUIREMENTS, lower)["score"]


def test_weights_are_renormalised_when_a_component_is_missing():
    requirements = dict(REQUIREMENTS, education_requirements=[], minimum_experience=None)
    analysis = analyse_candidate(requirements, _profile(STRONG), "Backend Engineer", semantic_matcher)
    assert set(analysis["unavailable_components"]) == {"education", "experience"}
    assert abs(sum(analysis["effective_weights"].values()) - 1.0) < 0.01
    assert abs(analysis["data_completeness"] - (SCORE_WEIGHTS["skills"] + SCORE_WEIGHTS["semantic"]) * 100) < 0.5


def test_final_score_is_bounded_and_consistent():
    analysis = analyse_candidate(REQUIREMENTS, _profile(STRONG), "Backend Engineer", semantic_matcher)
    assert 0 <= analysis["overall_score"] <= 100
    manual = (
        SCORE_WEIGHTS["skills"] * analysis["skill_score"]
        + SCORE_WEIGHTS["semantic"] * analysis["semantic_score"]
        + SCORE_WEIGHTS["experience"] * analysis["experience_score"]
        + SCORE_WEIGHTS["education"] * analysis["education_score"]
    )
    assert abs(manual - analysis["overall_score"]) < 0.6


def test_analysis_is_reproducible():
    first = analyse_candidate(REQUIREMENTS, _profile(STRONG), "Backend Engineer", semantic_matcher)
    second = analyse_candidate(REQUIREMENTS, _profile(STRONG), "Backend Engineer", semantic_matcher)
    assert first["overall_score"] == second["overall_score"]
    assert first["skill_score"] == second["skill_score"]


def test_explanation_is_grounded():
    analysis = analyse_candidate(REQUIREMENTS, _profile(STRONG), "Backend Engineer", semantic_matcher)
    explanation = analysis["explanation"]
    assert "Python" in " ".join(explanation["strengths"]) + explanation["headline"]
    assert explanation["disclaimer"]


def test_semantic_calibration_is_monotonic():
    values = [SemanticMatcher.calibrate(x / 100) for x in range(0, 101, 5)]
    assert values == sorted(values)
    assert SemanticMatcher.calibrate(0.0) == 0.0
    assert SemanticMatcher.calibrate(1.0) == 100.0


def test_semantic_fallback_is_reported_honestly():
    status = semantic_matcher.status()
    assert status["method"] in {"sentence-transformers", "tfidf-svd", "unavailable"}
    if status["state"] == "disabled":
        assert status["method"] == "tfidf-svd"
