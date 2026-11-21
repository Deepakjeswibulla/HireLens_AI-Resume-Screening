"""Resume parsing tests: name, contact, experience (incl. overlap), education."""

from __future__ import annotations

from app.services.resume_parser import find_date_ranges, merge_months, parse_resume

RESUME = """Rohit Deshmukh
rohit.deshmukh@example.com | +91 99887 76655

Summary
Backend developer with strong Python and PostgreSQL experience.

Skills
Python, FastAPI, PostgreSQL, Docker, AWS

Experience
Senior Backend Engineer | Cedar Labs
Feb 2021 - Present
Built FastAPI services and PostgreSQL schemas. Deployed with Docker on AWS.

Backend Developer | Pine Systems
Mar 2019 - Jan 2021
Maintained Python and Flask APIs.

Education
B.Tech in Computer Science, VIT Vellore, 2019
"""


def test_name_email_extraction():
    profile = parse_resume(RESUME, "rohit.txt")
    assert profile["name"] == "Rohit Deshmukh"
    assert profile["email"] == "rohit.deshmukh@example.com"
    assert profile["phone"].startswith("+91")


def test_skills_and_sections():
    profile = parse_resume(RESUME, "rohit.txt")
    assert "Python" in profile["skills"]
    assert "FastAPI" in profile["skills"]
    assert "experience" in profile["sections_found"]


def test_experience_entries_have_dates():
    profile = parse_resume(RESUME, "rohit.txt")
    entries = profile["experience_entries"]
    assert len(entries) == 2
    assert entries[0]["company"] == "Cedar Labs"
    assert entries[0]["start"].startswith("2021")
    assert entries[0]["dates_confident"] is True
    assert profile["total_experience_years"] > 3


def test_overlapping_dates_are_not_double_counted():
    text = """A B
Experience
Engineer | One
Jan 2020 - Dec 2021
Work.
Engineer | Two
Jun 2021 - Dec 2022
Work.
"""
    profile = parse_resume(text, "x.txt")
    # Jan 2020 -> Dec 2022 is 36 months, not 24 + 19
    assert 34 <= profile["total_experience_months"] <= 36


def test_merge_months_direct():
    ranges = find_date_ranges("Jan 2020 - Dec 2020 and Jun 2020 - Mar 2021")
    assert merge_months(ranges) == 15  # Jan 2020 .. Mar 2021


def test_education_parsing():
    profile = parse_resume(RESUME, "rohit.txt")
    assert profile["education"]
    assert profile["highest_education_level"] == 2
    assert "Computer Science" in (profile["education"][0]["field"] or "")


def test_missing_information_is_unknown_not_fabricated():
    profile = parse_resume("Some text with no structure at all.", "blank.txt")
    assert profile["email"] is None
    assert profile["experience_entries"] == []
    assert profile["total_experience_years"] is None
    assert profile["warnings"]


def test_experience_without_dates_is_flagged():
    text = """Jane Doe
Experience
Engineer | Nowhere Inc
Built things with Python.
"""
    profile = parse_resume(text, "jane.txt")
    assert profile["experience_entries"]
    assert profile["total_experience_years"] is None
    assert any("dates" in w.lower() for w in profile["warnings"])
