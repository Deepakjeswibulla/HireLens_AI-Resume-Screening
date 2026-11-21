"""Test configuration.

Environment is configured *before* the app is imported so that every module
sees a throwaway database and upload directory, and so the embedding model is
not downloaded during tests (the fallback is reported honestly instead).
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

TEST_ROOT = Path(tempfile.mkdtemp(prefix="hirelens-tests-"))
os.environ.setdefault("HIRELENS_DATABASE_URL", f"sqlite:///{TEST_ROOT / 'test.db'}")
os.environ.setdefault("HIRELENS_UPLOAD_DIR", str(TEST_ROOT / "uploads"))
os.environ.setdefault("HIRELENS_DISABLE_MODEL", "1")

import pytest  # noqa: E402

from app.database.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    shutil.rmtree(TEST_ROOT, ignore_errors=True)


@pytest.fixture()
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    from app.database.db import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def sample_pdf(tmp_path) -> Path:
    import pymupdf

    text = (
        "Aarav Kapoor\n"
        "aarav.kapoor@example.com | +91 98765 43210\n\n"
        "Professional Summary\n"
        "Backend engineer with 5 years of Python experience building REST APIs.\n\n"
        "Skills\n"
        "Python, FastAPI, PostgreSQL, Docker, AWS, Redis\n\n"
        "Professional Experience\n"
        "Senior Backend Engineer | Nimbus Systems\n"
        "Jan 2021 - Present\n"
        "Built FastAPI services on PostgreSQL and deployed them with Docker on AWS.\n\n"
        "Backend Engineer | Bluepeak\n"
        "Jun 2019 - Dec 2020\n"
        "Developed REST APIs in Python and Flask.\n\n"
        "Education\n"
        "B.Tech in Computer Science, Delhi Technological University, 2019\n"
    )
    path = tmp_path / "aarav_kapoor.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 50, 550, 780), text, fontsize=10)
    doc.save(path)
    doc.close()
    return path


@pytest.fixture()
def sample_docx(tmp_path) -> Path:
    import docx

    document = docx.Document()
    for line in [
        "Ishita Banerjee",
        "ishita.banerjee@example.com",
        "Summary",
        "Data engineer with 4 years building Python data pipelines.",
        "Skills",
        "Python, SQL, ETL, Apache Spark, AWS",
        "Experience",
        "Data Engineer | Lumen Data",
        "Mar 2020 - Present",
        "Built ETL pipelines with Python and Apache Spark on AWS.",
        "Education",
        "B.E. in Information Science, BMS College of Engineering, 2020",
    ]:
        document.add_paragraph(line)
    table = document.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Certification"
    table.cell(0, 1).text = "AWS Certified Data Analytics"
    table.cell(1, 0).text = "Location"
    table.cell(1, 1).text = "Bengaluru"
    path = tmp_path / "ishita_banerjee.docx"
    document.save(path)
    return path


@pytest.fixture()
def corrupt_pdf(tmp_path) -> Path:
    path = tmp_path / "broken.pdf"
    path.write_bytes(b"%PDF-1.4 this is not a real pdf body")
    return path
