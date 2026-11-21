"""Document parsing tests: PDF, DOCX, invalid and corrupt input."""

from __future__ import annotations

import pytest

from app.services.document_parser import (
    DocumentParseError,
    extract_text,
    sanitize_filename,
    validate_file,
)


def test_pdf_text_extraction(sample_pdf):
    result = extract_text(sample_pdf, "aarav_kapoor.pdf")
    assert result["method"] == "pymupdf"
    assert "Aarav Kapoor" in result["text"]
    assert "FastAPI" in result["text"]
    assert result["pages"] == 1
    assert result["ocr_suspected"] is False


def test_docx_text_extraction_includes_tables(sample_docx):
    result = extract_text(sample_docx, "ishita_banerjee.docx")
    assert result["method"] == "python-docx"
    assert "Ishita Banerjee" in result["text"]
    assert "AWS Certified Data Analytics" in result["text"]  # from the table
    assert "Bengaluru" in result["text"]


def test_plain_text_extraction(tmp_path):
    path = tmp_path / "resume.txt"
    path.write_text("Ravi Kumar\nravi@example.com\nSkills\nPython, SQL\n", encoding="utf-8")
    result = extract_text(path, "resume.txt")
    assert "Ravi Kumar" in result["text"]


def test_unsupported_extension_rejected():
    with pytest.raises(DocumentParseError) as exc:
        validate_file("photo.png", 1024)
    assert exc.value.code == "unsupported_type"


def test_empty_file_rejected():
    with pytest.raises(DocumentParseError) as exc:
        validate_file("resume.pdf", 0)
    assert exc.value.code == "empty_file"


def test_oversized_file_rejected():
    with pytest.raises(DocumentParseError) as exc:
        validate_file("resume.pdf", 50 * 1024 * 1024)
    assert exc.value.code == "too_large"


def test_corrupt_pdf_raises_friendly_error(corrupt_pdf):
    with pytest.raises(DocumentParseError) as exc:
        extract_text(corrupt_pdf, "broken.pdf")
    assert "could not" in exc.value.message.lower()
    assert exc.value.code in {"corrupt_pdf", "empty_document"}


def test_empty_pdf_reports_no_text(tmp_path):
    import pymupdf

    path = tmp_path / "blank.pdf"
    doc = pymupdf.open()
    doc.new_page()
    doc.save(path)
    doc.close()
    with pytest.raises(DocumentParseError) as exc:
        extract_text(path, "blank.pdf")
    assert exc.value.code == "empty_document"


def test_sanitize_filename_strips_paths_and_symbols():
    assert sanitize_filename("../../etc/pass wd;rm -rf.pdf") == "pass wd_rm -rf.pdf"
    assert sanitize_filename("résumé.docx").endswith(".docx")
    assert "/" not in sanitize_filename("a/b/c.pdf")
