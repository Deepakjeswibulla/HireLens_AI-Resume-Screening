"""Application configuration and scoring configuration.

Every tunable value lives here so that behaviour can be changed in one place
instead of being scattered across services or (worse) the frontend.
"""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/


def _env_path(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    return Path(raw).expanduser().resolve() if raw else default


class Settings:
    """Runtime settings, all overridable through environment variables."""

    app_name: str = "HireLens API"
    version: str = "1.0.0"
    api_prefix: str = "/api"

    database_url: str = os.getenv(
        "HIRELENS_DATABASE_URL", f"sqlite:///{BASE_DIR / 'hirelens.db'}"
    )
    upload_dir: Path = _env_path("HIRELENS_UPLOAD_DIR", BASE_DIR / "data" / "uploads")
    max_upload_mb: int = int(os.getenv("HIRELENS_MAX_UPLOAD_MB", "10"))
    max_resumes_per_screening: int = int(os.getenv("HIRELENS_MAX_RESUMES", "60"))
    allowed_extensions: tuple[str, ...] = (".pdf", ".docx", ".txt", ".md")

    semantic_model: str = os.getenv(
        "HIRELENS_SEMANTIC_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )
    # Set HIRELENS_DISABLE_MODEL=1 to force the deterministic TF-IDF/SVD backend.
    disable_semantic_model: bool = os.getenv("HIRELENS_DISABLE_MODEL", "0") == "1"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

    log_level: str = os.getenv("HIRELENS_LOG_LEVEL", "INFO")


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Scoring configuration
# ---------------------------------------------------------------------------

# Component weights for the final score. Must sum to 1.0.
SCORE_WEIGHTS: dict[str, float] = {
    "skills": 0.40,
    "semantic": 0.30,
    "experience": 0.20,
    "education": 0.10,
}

# Weight given to a required skill versus a preferred skill when aggregating
# skill coverage.
REQUIREMENT_WEIGHTS: dict[str, float] = {
    "required": 2.0,
    "preferred": 1.0,
}

# Credit awarded per match type. A skill that is only *listed* in a skills
# section is worth slightly less than the same skill backed by work experience
# or a project, so a padded skills list cannot inflate the score.
MATCH_CREDIT: dict[str, float] = {
    "exact_evidenced": 1.00,
    "exact_listed": 0.90,
    "alias_evidenced": 0.95,
    "alias_listed": 0.85,
    "related_evidenced": 0.45,
    "related_listed": 0.40,
    "semantic": 0.25,
    "none": 0.0,
}

# Calibration window for cosine similarity -> 0-100.
# all-MiniLM-L6-v2 produces cosine values in a compressed band: unrelated
# sentence pairs sit around 0.05-0.15, related pairs around 0.35-0.55 and
# near-paraphrases around 0.65+. Mapping that window linearly (instead of
# multiplying cosine by 100) is what keeps the semantic component honest.
SEMANTIC_CALIBRATION: dict[str, float] = {"low": 0.15, "high": 0.58}

# The TF-IDF/SVD fallback lives in a different cosine space (reduced TF-IDF
# vectors rarely exceed ~0.3), so it needs its own window and threshold. Using
# the transformer window on fallback vectors would report 0 for everyone.
SEMANTIC_CALIBRATION_FALLBACK: dict[str, float] = {"low": 0.04, "high": 0.22}

# A requirement is considered "semantically present" in a resume only above
# this cosine threshold. MiniLM puts loosely-related engineering text at
# 0.25-0.35, which is noise for a skill claim, so the bar is deliberately above
# that band: below it we report no evidence rather than a weak hit.
SEMANTIC_EVIDENCE_THRESHOLD: float = 0.38
SEMANTIC_EVIDENCE_THRESHOLD_FALLBACK: float = 0.18

# Match labels (inclusive lower bound, exclusive upper bound).
MATCH_LABELS: list[tuple[float, float, str]] = [
    (85.0, 101.0, "Strong Match"),
    (70.0, 85.0, "Good Match"),
    (50.0, 70.0, "Partial Match"),
    (0.0, 50.0, "Low Match"),
]

SCORE_VERSION = "1.0.0"


def label_for_score(score: float) -> str:
    for low, high, label in MATCH_LABELS:
        if low <= score < high:
            return label
    return "Low Match"
