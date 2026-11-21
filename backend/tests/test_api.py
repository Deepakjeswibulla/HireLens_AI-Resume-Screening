"""API tests: full screening lifecycle through the HTTP layer."""

from __future__ import annotations

import csv
import io
import time

JOB_DESCRIPTION = """Senior Backend Engineer

Responsibilities
- Build REST APIs with Python and FastAPI
- Own PostgreSQL performance

Requirements
- 3+ years of backend experience with Python
- Strong FastAPI and PostgreSQL knowledge
- Bachelor's degree in Computer Science

Preferred qualifications
- Docker
- AWS
"""


def _create_screening(client, title="Senior Backend Engineer"):
    payload = {
        "job_title": title,
        "company": "Northwind Labs",
        "job_description": JOB_DESCRIPTION,
        "requirements": {
            "required_skills": ["Python", "FastAPI", "PostgreSQL"],
            "preferred_skills": ["Docker", "AWS"],
            "responsibilities": ["Build REST APIs with Python and FastAPI"],
            "minimum_experience": 3,
            "education_requirements": ["Bachelor's degree in Computer Science"],
            "domain_requirements": [],
            "raw_text": JOB_DESCRIPTION,
        },
    }
    response = client.post("/api/jobs", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _upload(client, screening_id, files):
    response = client.post(
        f"/api/jobs/{screening_id}/resumes",
        files=[("files", (name, content, mime)) for name, content, mime in files],
    )
    assert response.status_code == 200, response.text
    return response.json()


def _wait_for_analysis(client, screening_id, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        progress = client.get(f"/api/jobs/{screening_id}/progress").json()
        if progress["state"] in {"completed", "failed"}:
            return progress
        time.sleep(0.2)
    raise AssertionError("analysis did not finish in time")


def test_analyze_jd_endpoint(client):
    response = client.post("/api/jobs/analyze-jd", json={"job_description": JOB_DESCRIPTION})
    assert response.status_code == 200
    data = response.json()
    assert "Python" in data["requirements"]["required_skills"]
    assert data["requirements"]["minimum_experience"] == 3
    assert data["requirements"]["education_requirements"]


def test_analyze_jd_rejects_short_input(client):
    response = client.post("/api/jobs/analyze-jd", json={"job_description": "too short"})
    assert response.status_code == 422


def test_full_screening_flow(client, sample_pdf, sample_docx):
    screening = _create_screening(client)
    screening_id = screening["id"]
    assert screening["status"] == "draft"

    uploaded = _upload(
        client,
        screening_id,
        [
            (sample_pdf.name, sample_pdf.read_bytes(), "application/pdf"),
            (sample_docx.name, sample_docx.read_bytes(), "application/octet-stream"),
        ],
    )
    assert len(uploaded["accepted"]) == 2

    # duplicate detection
    again = _upload(client, screening_id, [(sample_pdf.name, sample_pdf.read_bytes(), "application/pdf")])
    assert len(again["duplicates"]) == 1
    assert again["accepted"] == []

    # rejected file type
    bad = _upload(client, screening_id, [("notes.png", b"not a resume", "image/png")])
    assert bad["rejected"] and bad["rejected"][0]["code"] == "unsupported_type"

    start = client.post(f"/api/jobs/{screening_id}/analyze")
    assert start.status_code == 202
    progress = _wait_for_analysis(client, screening_id)
    assert progress["state"] == "completed", progress
    assert progress["succeeded_files"] == 2

    candidates = client.get(f"/api/jobs/{screening_id}/candidates").json()
    assert len(candidates) == 2
    assert all(c["overall_score"] is not None for c in candidates)
    assert candidates[0]["rank"] == 1
    assert candidates[0]["overall_score"] >= candidates[1]["overall_score"]

    detail = client.get(f"/api/candidates/{candidates[0]['id']}").json()
    assert detail["analysis"]["explanation"]["headline"]
    assert detail["resume_text"]

    # status change persists
    patched = client.patch(
        f"/api/candidates/{candidates[0]['id']}/status", json={"status": "shortlisted"}
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "shortlisted"
    assert client.patch(
        f"/api/candidates/{candidates[0]['id']}/status", json={"status": "hired"}
    ).status_code == 422

    # csv export
    export = client.get(f"/api/jobs/{screening_id}/export")
    assert export.status_code == 200
    assert "text/csv" in export.headers["content-type"]
    rows = list(csv.reader(io.StringIO(export.text)))
    assert rows[0][0] == "Rank"
    assert len(rows) == 3
    assert rows[1][13] == "shortlisted"

    # analytics
    analytics = client.get(f"/api/jobs/{screening_id}/analytics").json()
    assert analytics["has_data"] is True
    assert analytics["analyzed_count"] == 2
    assert analytics["score_distribution"]

    # comparison
    ids = [c["id"] for c in candidates]
    comparison = client.post("/api/candidates/compare", params={"ids": ids})
    assert comparison.status_code == 200
    assert len(comparison.json()["candidates"]) == 2


def test_progress_endpoint_before_analysis(client):
    screening_id = _create_screening(client)["id"]
    progress = client.get(f"/api/jobs/{screening_id}/progress").json()
    assert progress["state"] == "idle"
    assert len(progress["stages"]) == 9


def test_analyze_requires_resumes(client):
    screening_id = _create_screening(client)["id"]
    response = client.post(f"/api/jobs/{screening_id}/analyze")
    assert response.status_code == 400


def test_missing_screening_returns_404(client):
    assert client.get("/api/jobs/9999").status_code == 404
    assert client.get("/api/candidates/9999").status_code == 404


def test_overview_and_config(client):
    overview = client.get("/api/overview").json()
    assert "metrics" in overview
    config = client.get("/api/meta/config").json()
    assert config["weights"]["skills"] == 0.4
    assert config["labels"]


def test_failed_file_does_not_break_batch(client, sample_pdf, corrupt_pdf):
    screening_id = _create_screening(client)["id"]
    _upload(
        client,
        screening_id,
        [
            (sample_pdf.name, sample_pdf.read_bytes(), "application/pdf"),
            (corrupt_pdf.name, corrupt_pdf.read_bytes(), "application/pdf"),
        ],
    )
    client.post(f"/api/jobs/{screening_id}/analyze")
    progress = _wait_for_analysis(client, screening_id)
    assert progress["state"] == "completed"
    assert progress["failed_files"] == 1
    assert progress["succeeded_files"] == 1

    candidates = client.get(f"/api/jobs/{screening_id}/candidates").json()
    failed = [c for c in candidates if c["parse_status"] == "failed"]
    assert len(failed) == 1
    assert failed[0]["parse_error"]


def test_delete_screening(client, sample_pdf):
    screening_id = _create_screening(client)["id"]
    _upload(client, screening_id, [(sample_pdf.name, sample_pdf.read_bytes(), "application/pdf")])
    assert client.delete(f"/api/jobs/{screening_id}").status_code == 204
    assert client.get(f"/api/jobs/{screening_id}").status_code == 404
    assert client.get("/api/jobs").json() == []


def test_demo_mode_creates_synthetic_screening(client):
    response = client.post("/api/demo/load")
    assert response.status_code == 201
    body = response.json()
    assert body["candidates"] == 12
    screening = client.get(f"/api/jobs/{body['screening_id']}").json()
    assert screening["is_demo"] is True
    progress = _wait_for_analysis(client, body["screening_id"], timeout=120)
    assert progress["state"] == "completed"
    candidates = client.get(f"/api/jobs/{body['screening_id']}/candidates").json()
    assert len(candidates) == 12
    assert all(c["overall_score"] is not None for c in candidates)
