"""Resume text -> structured candidate profile.

Design notes
------------
* Nothing is invented. Every field is either extracted from the text or left
  as ``None`` / empty, and ``warnings`` records what could not be determined.
* Experience is derived only from explicit employment date ranges. Overlapping
  ranges are merged so the same months are never counted twice, and years are
  never inferred from a graduation date.
* ``relevant`` experience needs the job description, so it is computed later in
  :mod:`app.services.experience_matcher`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from app.services.document_parser import normalize_text
from app.services.skill_extractor import detect_skills

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

SECTION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "summary": ("professional summary", "career summary", "summary", "profile", "objective", "about me", "about"),
    "experience": (
        "professional experience", "work experience", "employment history", "work history",
        "career history", "experience", "employment",
    ),
    "education": ("education and training", "education & training", "education", "academic background", "academics", "qualifications"),
    "skills": ("technical skills", "core competencies", "core skills", "skills & tools", "skills and tools", "skills", "technologies", "skill set"),
    "projects": ("selected projects", "key projects", "personal projects", "project experience", "projects"),
    "certifications": ("certifications", "certificates", "licenses", "courses & certifications", "training"),
    "awards": ("awards", "achievements", "honors", "honours"),
    "languages": ("languages",),
}

EDUCATION_LEVELS: list[tuple[int, tuple[str, ...]]] = [
    (4, ("phd", "ph.d", "doctorate", "doctoral")),
    (3, ("master", "m.tech", "mtech", "msc", "m.sc", "mba", "mca", "m.s.", "m.e.", "post graduate", "postgraduate")),
    (2, ("bachelor", "b.tech", "btech", "bsc", "b.sc", "bca", "b.e.", "b.a.", "b.a", "b.com", "bcom", "undergraduate", "b.s.")),
    (1, ("diploma", "associate degree", "bootcamp", "higher secondary", "high school", "12th", "polytechnic")),
]
LEVEL_NAMES = {0: "Unknown", 1: "Diploma / Certificate", 2: "Bachelor's degree", 3: "Master's degree", 4: "Doctorate"}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:(?:\+\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?)?\d{3}[\s\-]?\d{3,4}[\s\-]?\d{0,4})")
LINK_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)/[A-Za-z0-9_\-./%]+", re.I)

PRESENT_WORDS = r"present|current|now|ongoing|till date|to date|today"


def _token(prefix: str) -> str:
    return (
        rf"(?:(?P<{prefix}m>jan[a-z]*|feb[a-z]*|mar[a-z]*|apr[a-z]*|may|jun[a-z]*|jul[a-z]*|aug[a-z]*|sep[a-z]*|oct[a-z]*|nov[a-z]*|dec[a-z]*)\.?\s*,?\s*)?"
        rf"(?:(?P<{prefix}d>\d{{1,2}})\s*[/\-]\s*)?"
        rf"(?P<{prefix}y>(?:19|20)\d{{2}})"
    )


DATE_RANGE_RE = re.compile(
    rf"(?P<start>{_token('a')})\s*(?:-|to|until|through)\s*(?:(?P<end>{_token('b')})|(?P<open>{PRESENT_WORDS}))",
    re.IGNORECASE,
)

DEGREE_RE = re.compile(
    r"\b(ph\.?d\.?|doctorate|m\.?tech|m\.?s\.?c?|m\.?b\.?a|m\.?c\.?a|master(?:'s)?(?:\s+of\s+[a-z ]+)?|"
    r"b\.?tech|b\.?e\.?|b\.?s\.?c?|b\.?c\.?a|b\.?com|bachelor(?:'s)?(?:\s+of\s+[a-z ]+)?|diploma)\b",
    re.IGNORECASE,
)


@dataclass
class DateRange:
    start_year: int
    start_month: int | None
    end_year: int | None
    end_month: int | None
    is_current: bool
    raw: str

    @property
    def months(self) -> int:
        end_y = self.end_year or date.today().year
        end_m = self.end_month or (date.today().month if self.is_current else None)
        if self.start_month and end_m:
            span = (end_y * 12 + end_m) - (self.start_year * 12 + self.start_month) + 1
        else:
            span = (end_y - self.start_year) * 12
            if span == 0:
                span = 12
        return max(1, min(span, 12 * 60))


def _parse_token(match: re.Match[str], prefix: str) -> tuple[int, int | None] | None:
    year = match.group(f"{prefix}y")
    if not year:
        return None
    month_name = match.group(f"{prefix}m")
    day = match.group(f"{prefix}d")
    month: int | None = None
    if month_name:
        month = MONTHS.get(month_name[:3].lower())
    elif day and day.isdigit() and 1 <= int(day) <= 12:
        month = int(day)
    return int(year), month


def find_date_ranges(text: str) -> list[DateRange]:
    ranges: list[DateRange] = []
    for match in DATE_RANGE_RE.finditer(text):
        start = _parse_token(match, "a")
        if not start:
            continue
        is_current = bool(match.group("open"))
        end = _parse_token(match, "b") if not is_current else (date.today().year, date.today().month)
        ranges.append(
            DateRange(
                start_year=start[0],
                start_month=start[1],
                end_year=end[0] if end else None,
                end_month=end[1] if end else None,
                is_current=is_current,
                raw=match.group(0).strip(),
            )
        )
    return ranges


def merge_months(ranges: list[DateRange]) -> int:
    """Union of month intervals, so overlapping roles are not double counted."""
    intervals: list[tuple[int, int]] = []
    for r in ranges:
        start = r.start_year * 12 + (r.start_month or 1)
        end_year = r.end_year or date.today().year
        end_month = r.end_month or (date.today().month if r.is_current else 12)
        end = end_year * 12 + end_month
        if end < start:
            start, end = end, start
        intervals.append((start, end))
    if not intervals:
        return 0
    intervals.sort()
    total = 0
    cur_start, cur_end = intervals[0]
    for start, end in intervals[1:]:
        if start <= cur_end + 1:
            cur_end = max(cur_end, end)
        else:
            total += cur_end - cur_start + 1
            cur_start, cur_end = start, end
    total += cur_end - cur_start + 1
    return max(0, total)


def split_sections(text: str) -> tuple[dict[str, str], str]:
    """Split a resume into named sections using heading heuristics."""
    lines = [line.rstrip() for line in text.split("\n")]
    sections: dict[str, list[str]] = {}
    current = "preamble"
    sections[current] = []

    def heading_of(line: str) -> str | None:
        stripped = line.strip().strip(":").strip()
        if not stripped or len(stripped) > 55 or stripped.endswith("."):
            return None
        if not re.match(r"^[A-Za-z&/ ]+$", stripped):
            return None
        low = re.sub(r"\s+", " ", stripped.lower())
        for key, keywords in SECTION_KEYWORDS.items():
            if low in keywords:
                return key
        for key, keywords in SECTION_KEYWORDS.items():
            if any(low.startswith(kw + " ") or low == kw for kw in keywords):
                return key
        return None

    for line in lines:
        key = heading_of(line)
        if key:
            current = key
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)

    return {k: "\n".join(v).strip() for k, v in sections.items()}, "\n".join(sections.get("preamble", []))


def _clean_name(value: str) -> str | None:
    value = re.sub(r"\s+", " ", value).strip(" -|,")
    if not value or len(value) > 60:
        return None
    if EMAIL_RE.search(value) or any(ch.isdigit() for ch in value):
        return None
    words = value.split()
    if not 1 < len(words) <= 5:
        return None
    if not all(re.fullmatch(r"[A-Za-z.'\-]+", w) for w in words):
        return None
    if value.lower().startswith(("resume", "curriculum", "cv")):
        return None
    return value.title() if value.isupper() or value.islower() else value


def extract_name(preamble: str) -> str | None:
    for line in preamble.split("\n")[:8]:
        labelled = re.match(r"^(?:name|full name)\s*[:\-]\s*(.+)$", line.strip(), re.IGNORECASE)
        if labelled:
            candidate = _clean_name(labelled.group(1))
            if candidate:
                return candidate
    for line in preamble.split("\n")[:6]:
        candidate = _clean_name(line)
        if candidate:
            return candidate
    return None


def _split_title_company(header: str) -> tuple[str | None, str | None]:
    cleaned = re.sub(r"^[\-\u2022\*\s]+", "", header).strip()
    for sep in (" | ", " at ", " @ ", " - ", ", "):
        if sep in cleaned:
            left, right = cleaned.split(sep, 1)
            return left.strip() or None, right.strip() or None
    return cleaned or None, None


def parse_experience(section: str) -> list[dict]:
    if not section.strip():
        return []

    lines = [ln.strip() for ln in section.split("\n")]
    date_rows = [(i, find_date_ranges(ln)) for i, ln in enumerate(lines)]
    entries: list[dict] = []
    date_indices = [i for i, ranges in date_rows if ranges]

    if not date_indices:
        # No dates at all: fall back to blank-line separated blocks, dates unknown.
        blocks = re.split(r"\n\s*\n", section)
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            first_line = block.split("\n")[0]
            title, company = _split_title_company(first_line)
            entries.append(
                {
                    "title": title,
                    "company": company,
                    "start": None,
                    "end": None,
                    "months": 0,
                    "description": block,
                    "dates_confident": False,
                }
            )
        return entries

    for pos, idx in enumerate(date_indices):
        rng = date_rows[idx][1][0]
        header = ""
        if idx - 1 >= 0 and not date_rows[idx - 1][1] and lines[idx - 1]:
            header = lines[idx - 1]
        title, company = _split_title_company(header) if header else (None, None)

        desc_end = date_indices[pos + 1] - 1 if pos + 1 < len(date_indices) else len(lines)
        desc_lines = []
        for j in range(idx + 1, max(idx + 1, desc_end)):
            line = lines[j]
            if not line:
                continue
            if j == desc_end - 1 and desc_lines and not re.match(r"^[\-\u2022\*\d]", line) and len(line) < 80 and not line.endswith("."):
                break  # this is the header of the next role
            desc_lines.append(line)

        entries.append(
            {
                "title": title,
                "company": company,
                "start": f"{rng.start_year}-{rng.start_month or 1:02d}",
                "end": "present" if rng.is_current else (
                    f"{rng.end_year}-{rng.end_month or 1:02d}" if rng.end_year else None
                ),
                "start_label": rng.raw,
                "months": rng.months,
                "description": " ".join(desc_lines)[:1200],
                "dates_confident": True,
                "_range": rng,
            }
        )
    return entries


def parse_education(section: str) -> list[dict]:
    if not section.strip():
        return []
    entries: list[dict] = []
    blocks = [b.strip() for b in re.split(r"\n\s*\n", section) if b.strip()]
    if len(blocks) <= 1:
        blocks = [ln.strip() for ln in section.split("\n") if ln.strip()]

    for block in blocks:
        degree_match = DEGREE_RE.search(block)
        if not degree_match:
            continue
        degree_text = block[:200]
        low = block.lower()
        level = 0
        for lvl, keywords in EDUCATION_LEVELS:
            if any(kw in low for kw in keywords):
                level = lvl
                break
        field_match = re.search(r"\b(?:in|of)\s+([A-Za-z&,\s]{3,45})", degree_text, re.IGNORECASE)
        field_name = None
        if field_match:
            field_name = re.split(r"[,|\n]| at | from ", field_match.group(1))[0].strip(" ,.")[:60]
        year_match = re.search(r"(19|20)\d{2}", block)
        institution = None
        for line in block.split("\n"):
            if re.search(r"university|college|institute|school|academy|polytechnic", line, re.IGNORECASE):
                institution = re.sub(r"\s+", " ", line).strip()[:120]
                break
        entries.append(
            {
                "degree": re.sub(r"\s+", " ", degree_match.group(0)).strip()[:80],
                "level": level,
                "level_name": LEVEL_NAMES.get(level, "Unknown"),
                "field": field_name,
                "institution": institution,
                "year": int(year_match.group(0)) if year_match else None,
            }
        )
    # keep the highest level first
    entries.sort(key=lambda e: (-e["level"], -(e["year"] or 0)))
    return entries[:5]


def parse_projects(section: str) -> list[dict]:
    if not section.strip():
        return []
    blocks = [b.strip() for b in re.split(r"\n\s*\n", section) if b.strip()]
    if len(blocks) <= 1:
        lines = [ln.strip() for ln in section.split("\n") if ln.strip()]
        blocks, current = [], []
        for line in lines:
            starts_bullet = bool(re.match(r"^[\-\u2022\*\d]", line))
            if current and not starts_bullet and len(line) < 90 and not current[-1].endswith((".", ":")):
                blocks.append("\n".join(current))
                current = [line]
            else:
                current.append(line)
        if current:
            blocks.append("\n".join(current))

    projects = []
    for block in blocks:
        lines = [ln for ln in block.split("\n") if ln.strip()]
        if not lines:
            continue
        name = re.sub(r"^[\-\u2022\*\d.\s]+", "", lines[0]).strip()
        description = " ".join(lines[1:]) or name
        projects.append({"name": name[:120], "description": description[:800]})
    return projects[:6]


def _bullets(section: str, limit: int = 8) -> list[str]:
    items = []
    for line in section.split("\n"):
        text = re.sub(r"^[\-\u2022\*\d.\s]+", "", line).strip()
        if len(text) > 3:
            items.append(text[:200])
    return items[:limit]


def parse_resume(text: str, filename: str | None = None) -> dict:
    """Return a structured candidate profile plus parser warnings."""
    text = normalize_text(text)
    sections, preamble = split_sections(text)
    warnings: list[str] = []

    email_match = EMAIL_RE.search(text[:2500])
    phone_match = PHONE_RE.search(text[:2500])
    links = sorted({m.group(0) for m in LINK_RE.finditer(text)})[:4]

    name = extract_name(preamble) or extract_name(text[:400])
    if not name:
        warnings.append("Candidate name could not be extracted from the document.")

    # Skill detection per zone so we can tell "listed" from "evidenced".
    zone_text = {
        "skills": sections.get("skills", ""),
        "experience": sections.get("experience", ""),
        "projects": sections.get("projects", ""),
        "summary": sections.get("summary", ""),
        "education": sections.get("education", ""),
        "certifications": sections.get("certifications", ""),
    }
    zone_hits = {zone: detect_skills(value) for zone, value in zone_text.items()}
    all_hits = detect_skills(text)

    evidence: dict[str, list[str]] = {}
    for skill in all_hits:
        zones = [zone for zone, hits in zone_hits.items() if skill in hits]
        if not zones:
            zones = ["other"]
        evidence[skill] = zones

    experience_entries = parse_experience(sections.get("experience", ""))
    if not sections.get("experience"):
        warnings.append("No work-experience section was detected.")
    dated = [e for e in experience_entries if e.get("dates_confident")]
    if experience_entries and not dated:
        warnings.append("Employment dates could not be parsed; total experience is unknown.")

    total_months = merge_months([e["_range"] for e in dated]) if dated else 0
    for entry in experience_entries:
        entry.pop("_range", None)

    education = parse_education(sections.get("education", ""))
    if not education:
        warnings.append("No education details were detected.")

    summary = sections.get("summary", "").strip()
    if not summary:
        summary = " ".join(preamble.split("\n")[1:])[:600].strip()

    profile = {
        "name": name,
        "email": email_match.group(0) if email_match else None,
        "phone": phone_match.group(0).strip() if phone_match and len(phone_match.group(0).strip()) >= 8 else None,
        "links": links,
        "summary": summary[:1200],
        "skills": sorted(all_hits),
        "skill_evidence": evidence,
        "experience_entries": experience_entries,
        "total_experience_months": total_months,
        "total_experience_years": round(total_months / 12, 1) if total_months else None,
        "education": education,
        "highest_education_level": max((e["level"] for e in education), default=0),
        "projects": parse_projects(sections.get("projects", "")),
        "certifications": _bullets(sections.get("certifications", ""), 8),
        "awards": _bullets(sections.get("awards", ""), 5),
        "resume_filename": filename,
        "sections_found": sorted(k for k, v in sections.items() if v),
        "warnings": warnings,
        "char_count": len(re.sub(r"\s", "", text)),
    }
    return profile
