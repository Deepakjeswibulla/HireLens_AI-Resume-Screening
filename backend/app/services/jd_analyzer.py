"""Job description -> structured requirements.

Deterministic and rule based: section-aware line classification, skill
dictionary matching, cue-word detection for required vs preferred, and a small
set of regexes for experience and education. No LLM is involved, so the same
JD always produces the same requirements.
"""

from __future__ import annotations

import re

from app.services.document_parser import normalize_text
from app.services.skill_extractor import detect_skills, normalise_skill_list

REQUIRED_CUES = (
    "must have", "must-have", "must be", "required", "requirement", "mandatory",
    "minimum", "at least", "essential", "proficiency in", "strong experience",
)
PREFERRED_CUES = (
    "preferred", "nice to have", "nice-to-have", "good to have", "bonus",
    "plus", "desirable", "advantage", "ideally", "familiarity with",
)

RESPONSIBILITY_HEADINGS = (
    "responsibilities", "what you'll do", "what you will do", "the role",
    "key responsibilities", "duties", "your role", "day to day", "you will",
)
REQUIREMENT_HEADINGS = (
    "requirements", "required qualifications", "qualifications", "must have",
    "what we're looking for", "what we are looking for", "skills required",
    "who you are", "you have", "essential skills",
)
PREFERRED_HEADINGS = (
    "preferred qualifications", "nice to have", "bonus points", "good to have",
    "desirable", "preferred skills", "plus points",
)
IGNORED_HEADINGS = (
    "about us", "about the company", "benefits", "perks", "compensation",
    "equal opportunity", "how to apply", "our culture", "what we offer",
)

DOMAIN_KEYWORDS = {
    "Fintech": ("fintech", "payments", "banking", "lending", "trading"),
    "Healthcare": ("healthcare", "health tech", "clinical", "medical", "ehr"),
    "E-commerce": ("e-commerce", "ecommerce", "marketplace", "retail", "d2c"),
    "Edtech": ("edtech", "education technology", "learning platform"),
    "SaaS": ("saas", "b2b software", "platform as a service"),
    "Logistics": ("logistics", "supply chain", "fleet", "delivery network"),
    "Insurance": ("insurance", "underwriting", "claims"),
    "Gaming": ("gaming", "game studio", "esports"),
    "Adtech": ("adtech", "advertising technology", "programmatic"),
    "Cybersecurity": ("cybersecurity", "cyber security", "infosec", "threat detection"),
    "AI/ML products": ("ai products", "machine learning platform", "ai-native", "generative ai"),
}

EXPERIENCE_PATTERNS = (
    re.compile(r"(?:at least|minimum(?: of)?|min\.?|over)\s*(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)", re.I),
    re.compile(r"(\d{1,2}(?:\.\d)?)\s*\+\s*(?:years?|yrs?)", re.I),
    re.compile(r"(\d{1,2}(?:\.\d)?)\s*(?:-|to)\s*\d{1,2}\s*(?:years?|yrs?)", re.I),
    re.compile(r"(\d{1,2}(?:\.\d)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|industry)", re.I),
)


def _classify_heading(line: str) -> str | None:
    stripped = line.strip().strip(":").strip()
    if not stripped or len(stripped) > 70:
        return None
    low = re.sub(r"\s+", " ", stripped.lower())
    if not re.match(r"^[a-z0-9 &/'()\-]+$", low):
        return None
    if any(low.startswith(h) for h in IGNORED_HEADINGS):
        return "ignored"
    if any(low.startswith(h) for h in PREFERRED_HEADINGS):
        return "preferred"
    if any(low.startswith(h) for h in RESPONSIBILITY_HEADINGS):
        return "responsibilities"
    if any(low.startswith(h) for h in REQUIREMENT_HEADINGS):
        return "required"
    return None


def _has_cue(line: str, cues: tuple[str, ...]) -> bool:
    low = line.lower()
    return any(cue in low for cue in cues)


def extract_min_experience(text: str) -> float | None:
    """Return the stated minimum years of experience, if the JD states one.

    Patterns are ordered from most explicit ("at least 3 years") to least, and
    the first family that matches wins, so a later phrase cannot override a
    clearly stated minimum.
    """
    for pattern in EXPERIENCE_PATTERNS:
        for match in pattern.finditer(text):
            try:
                value = float(match.group(1))
            except (TypeError, ValueError):
                continue
            if 0 < value <= 30:
                return value
    return None


def extract_education(text: str) -> list[str]:
    out: list[str] = []
    low = text.lower()
    degree_map = [
        ("Doctorate", ("phd", "ph.d", "doctorate")),
        ("Master's degree", ("master", "m.tech", "mba", "msc", "m.sc", "postgraduate")),
        ("Bachelor's degree", ("bachelor", "b.tech", "btech", "bsc", "b.sc", "b.e.", "bca", "undergraduate", "degree in")),
        ("Diploma", ("diploma",)),
    ]
    for label, keys in degree_map:
        if any(k in low for k in keys):
            field_match = re.search(
                r"(?:degree|bachelor'?s?|master'?s?|b\.?tech|m\.?tech|phd)\s+(?:in|of)\s+([A-Za-z&,\s]{3,45})",
                text,
                re.IGNORECASE,
            )
            field_name = None
            if field_match:
                field_name = re.split(r"[,.\n]| or | and ", field_match.group(1))[0].strip()[:50]
            out.append(f"{label} in {field_name}" if field_name else label)
            break
    if re.search(r"\b(certification|certified)\b", low) and not any("certif" in o.lower() for o in out):
        cert = re.search(r"(?:certified|certification in)\s+([A-Za-z0-9 +#./-]{3,45})", text, re.IGNORECASE)
        if cert:
            out.append(f"Certification in {cert.group(1).strip()}")
    return out


def extract_domains(text: str) -> list[str]:
    low = text.lower()
    return [domain for domain, keys in DOMAIN_KEYWORDS.items() if any(k in low for k in keys)]


def guess_title(text: str, hint: str | None = None) -> str | None:
    if hint and hint.strip():
        return hint.strip()[:200]
    labelled = re.search(r"(?:job title|role|position)\s*[:\-]\s*(.{3,80})", text, re.IGNORECASE)
    if labelled:
        return labelled.group(1).strip().split("\n")[0][:120]
    hiring = re.search(r"(?:hiring|looking for|seeking)\s+(?:an?\s+|our\s+)?([A-Z][A-Za-z/ ]{2,60})", text)
    if hiring:
        return hiring.group(1).strip()[:120]
    for line in text.split("\n")[:4]:
        stripped = line.strip()
        if 2 < len(stripped) <= 70 and not stripped.endswith(".") and "@" not in stripped:
            return stripped
    return None


def analyze_jd(raw_text: str, title_hint: str | None = None) -> dict:
    """Return ``{"requirements": {...}, "job_title_guess", "detected_skills", "warnings"}``."""
    text = normalize_text(raw_text)
    warnings: list[str] = []

    required: list[str] = []
    preferred: list[str] = []
    responsibilities: list[str] = []
    context = "neutral"

    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        heading = _classify_heading(line)
        if heading:
            context = heading
            continue
        if context == "ignored":
            continue

        cleaned = re.sub(r"^[\-\u2022\*\d.)\s]+", "", line).strip()
        if len(cleaned) < 3:
            continue

        line_kind = context
        # Section context wins: a "familiarity with" phrase inside the
        # Requirements section does not turn a required skill into a preferred one.
        if context == "preferred":
            line_kind = "preferred"
        elif context in ("required", "responsibilities"):
            line_kind = "required"
        elif _has_cue(line, PREFERRED_CUES):
            line_kind = "preferred"
        elif _has_cue(line, REQUIRED_CUES):
            line_kind = "required"

        found = detect_skills(line)
        for skill in found:
            if line_kind == "preferred":
                if skill not in required:
                    preferred.append(skill)
            elif line_kind in ("required", "neutral"):
                required.append(skill)

        if context == "responsibilities" and len(cleaned) > 12:
            responsibilities.append(cleaned[:300])

    # A skill in both lists is a required skill.
    preferred = [s for s in preferred if s not in required]

    if not required and not preferred:
        warnings.append(
            "No recognised skills were found in this job description. Add requirements manually."
        )
    if not required and preferred:
        warnings.append("Only preferred skills were detected - check whether some should be required.")

    responsibilities = list(dict.fromkeys(responsibilities))[:12]
    if not responsibilities:
        # fall back to the longest non-skill bullets so semantic matching has material
        candidates = [
            re.sub(r"^[\-\u2022\*\d.)\s]+", "", ln).strip()
            for ln in text.split("\n")
            if len(ln.strip()) > 40
        ]
        responsibilities = list(dict.fromkeys(candidates))[:6]

    minimum_experience = extract_min_experience(text)
    if minimum_experience is None:
        warnings.append("No explicit minimum experience was found; the experience component will be neutral.")

    requirements = {
        "required_skills": normalise_skill_list(list(dict.fromkeys(required))),
        "preferred_skills": normalise_skill_list(preferred),
        "responsibilities": responsibilities,
        "minimum_experience": minimum_experience,
        "education_requirements": extract_education(text),
        "domain_requirements": extract_domains(text),
        "raw_text": text,
    }

    detected = [
        {"skill": skill, "in_required": skill in requirements["required_skills"]}
        for skill in requirements["required_skills"] + requirements["preferred_skills"]
    ]
    return {
        "requirements": requirements,
        "job_title_guess": guess_title(text, title_hint),
        "detected_skills": detected,
        "warnings": warnings,
    }
