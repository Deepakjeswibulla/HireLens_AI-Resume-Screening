"""Skill ontology and detection tests."""

from __future__ import annotations

from app.services.skill_extractor import detect_skills, normalise_skill_list
from app.services.skill_taxonomy import canonical_name, related_skills


def test_alias_normalisation():
    assert canonical_name("JS") == "JavaScript"
    assert canonical_name("ts") == "TypeScript"
    assert canonical_name("postgres") == "PostgreSQL"
    assert canonical_name("RESTful API") == "REST API"
    assert canonical_name("NLP") == "Natural Language Processing"
    assert canonical_name("torch") == "PyTorch"
    assert canonical_name("k8s") == "Kubernetes"


def test_java_is_not_javascript():
    hits = detect_skills("I write Java services, and some JavaScript for the frontend.")
    assert "Java" in hits
    assert "JavaScript" in hits

    only_js = detect_skills("I write JavaScript and TypeScript daily.")
    assert "JavaScript" in only_js
    assert "Java" not in only_js


def test_react_native_does_not_count_as_react():
    hits = detect_skills("Built mobile apps with React Native.")
    assert "React Native" in hits
    assert "React" not in hits


def test_related_skills_are_partial_not_equal():
    assert "Deep Learning" in related_skills("Machine Learning")
    assert "Angular" not in related_skills("React")
    assert "MongoDB" not in related_skills("SQL")


def test_detection_handles_symbols():
    hits = detect_skills("Proficient in C++, C# and .NET.")
    assert {"C++", "C#", ".NET"} <= set(hits)


def test_normalise_skill_list_dedupes_and_maps():
    result = normalise_skill_list(["python", "Python ", "fast api", "Unknown Thing"])
    assert "Python" in result
    assert "FastAPI" in result
    assert "Unknown Thing" in result
    assert len(result) == 3


def test_empty_text_returns_no_hits():
    assert detect_skills("") == {}
    assert detect_skills("   ") == {}
