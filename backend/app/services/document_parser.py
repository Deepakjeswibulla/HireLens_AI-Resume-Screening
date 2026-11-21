"""Document parsing: validation, safe storage and text extraction.

Every failure raises :class:`DocumentParseError` carrying a message that is
safe to show a recruiter - no stack traces, no filesystem paths.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
MIN_USEFUL_CHARS = 120


class DocumentParseError(Exception):
    """A parsing problem that should be reported to the user verbatim."""

    def __init__(self, message: str, code: str = "parse_error"):
        super().__init__(message)
        self.message = message
        self.code = code


def extension_of(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def validate_file(filename: str, size_bytes: int) -> None:
    """Raise DocumentParseError when a file must not be accepted."""
    ext = extension_of(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise DocumentParseError(
            f"Unsupported file type '{ext or 'unknown'}'. Upload a PDF, DOCX or TXT file.",
            code="unsupported_type",
        )
    if size_bytes == 0:
        raise DocumentParseError("The file is empty.", code="empty_file")
    limit = settings.max_upload_mb * 1024 * 1024
    if size_bytes > limit:
        raise DocumentParseError(
            f"File is larger than the {settings.max_upload_mb} MB limit.", code="too_large"
        )


def sanitize_filename(filename: str) -> str:
    """Strip directories and unsafe characters from an uploaded filename."""
    base = Path(filename or "resume").name
    base = base.replace("\\", "_")
    stem = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(base).stem).strip(" ._-") or "resume"
    ext = extension_of(base) or ".bin"
    return f"{stem[:80]}{ext}"


def save_upload(content: bytes, filename: str, destination: Path) -> tuple[Path, str]:
    """Write bytes to a controlled directory under a hashed, safe name."""
    digest = hashlib.sha256(content).hexdigest()
    safe = sanitize_filename(filename)
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f"{digest[:12]}_{safe}"
    if not target.exists():
        target.write_bytes(content)
    return target, digest


def content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _extract_pdf(path: Path) -> tuple[str, dict]:
    import pymupdf  # local import keeps startup light

    try:
        doc = pymupdf.open(path)
    except Exception as exc:  # pragma: no cover - depends on file corruption
        raise DocumentParseError(
            "This PDF could not be opened. It may be corrupted or password protected.",
            code="corrupt_pdf",
        ) from exc

    try:
        if doc.needs_pass:
            raise DocumentParseError(
                "This PDF is password protected. Remove the password and upload it again.",
                code="encrypted_pdf",
            )
        pages = doc.page_count
        chunks: list[str] = []
        for page in doc:
            try:
                chunks.append(page.get_text("text") or "")
            except Exception:  # pragma: no cover
                chunks.append("")
        text = "\n".join(chunks)
    finally:
        doc.close()

    chars = len(re.sub(r"\s", "", text))
    warnings: list[str] = []
    ocr_suspected = pages > 0 and chars < MIN_USEFUL_CHARS
    if ocr_suspected:
        warnings.append(
            "Almost no text could be extracted from this PDF. It looks like a scanned "
            "image, which this build does not OCR - the candidate cannot be scored from it."
        )
    return text, {"pages": pages, "char_count": chars, "ocr_suspected": ocr_suspected, "warnings": warnings}


def _iter_docx_blocks(document):
    from docx.oxml.ns import qn
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield Table(child, document)


def _extract_docx(path: Path) -> tuple[str, dict]:
    import docx

    try:
        document = docx.Document(str(path))
    except Exception as exc:
        raise DocumentParseError(
            "This DOCX file could not be read. It may be corrupted or not a real Word document.",
            code="corrupt_docx",
        ) from exc

    parts: list[str] = []
    for block in _iter_docx_blocks(document):
        if hasattr(block, "rows"):
            for row in block.rows:
                cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
                if cells:
                    parts.append(" | ".join(cells))
        else:
            text = block.text.strip()
            if text:
                parts.append(text)

    text = "\n".join(parts)
    chars = len(re.sub(r"\s", "", text))
    warnings: list[str] = []
    if chars < MIN_USEFUL_CHARS:
        warnings.append("Very little text was found in this DOCX file; the profile may be incomplete.")
    return text, {"pages": None, "char_count": chars, "ocr_suspected": False, "warnings": warnings}


def _extract_text_file(path: Path) -> tuple[str, dict]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        raise DocumentParseError("This text file could not be read.", code="corrupt_text") from exc
    chars = len(re.sub(r"\s", "", text))
    return text, {"pages": None, "char_count": chars, "ocr_suspected": False, "warnings": []}


def extract_text(path: Path, filename: str | None = None) -> dict:
    """Extract plain text from a supported document.

    Returns ``{"text", "method", "pages", "char_count", "ocr_suspected", "warnings"}``.
    """
    ext = extension_of(filename or path.name)
    if ext == ".pdf":
        text, meta = _extract_pdf(path)
        method = "pymupdf"
    elif ext == ".docx":
        text, meta = _extract_docx(path)
        method = "python-docx"
    elif ext in {".txt", ".md"}:
        text, meta = _extract_text_file(path)
        method = "plaintext"
    else:
        raise DocumentParseError(
            f"Unsupported file type '{ext or 'unknown'}'.", code="unsupported_type"
        )

    text = normalize_text(text)
    if not text.strip():
        raise DocumentParseError(
            "No text could be extracted from this file.", code="empty_document"
        )
    return {"text": text, "method": method, **meta}


def normalize_text(text: str) -> str:
    """Normalise whitespace and unify dash/quote characters."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u2019", "'")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
