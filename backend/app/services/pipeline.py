"""Analysis pipeline: extract -> parse -> match -> score -> rank.

Runs inside a worker thread with its own database session. One bad resume never
aborts the batch: the failure is recorded on the candidate and in the progress
report, and the remaining files are processed.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from app.core.config import SCORE_VERSION
from app.core.logging_config import get_logger
from app.database.db import SessionLocal
from app.models.entities import (
    Candidate,
    CandidateAnalysis,
    ParseStatus,
    Screening,
    ScreeningStatus,
    utcnow,
)
from app.services.document_parser import DocumentParseError, extract_text
from app.services.jd_analyzer import analyze_jd
from app.services.progress import progress_tracker
from app.services.ranking_service import rank_candidates
from app.services.resume_parser import parse_resume
from app.services.scoring_engine import analyse_candidate
from app.services.semantic_matcher import semantic_matcher
from app.services.skill_extractor import normalise_skill_list

logger = get_logger(__name__)


def _save_analysis(db, candidate: Candidate, analysis: dict) -> None:
    existing = candidate.analysis
    if existing is None:
        existing = CandidateAnalysis(candidate_id=candidate.id)
        db.add(existing)
    existing.overall_score = analysis["overall_score"]
    existing.skill_score = analysis["skill_score"]
    existing.semantic_score = analysis["semantic_score"]
    existing.experience_score = analysis["experience_score"]
    existing.education_score = analysis["education_score"]
    existing.match_label = analysis["match_label"]
    existing.data_completeness = analysis["data_completeness"]
    existing.details = analysis
    candidate.analysis = existing


def run_analysis(screening_id: int) -> None:
    """Entry point executed in a background thread."""
    db = SessionLocal()
    try:
        screening = db.get(Screening, screening_id)
        if screening is None:
            progress_tracker.fail(screening_id, "Screening not found.")
            return

        candidates = db.execute(
            select(Candidate).where(Candidate.screening_id == screening_id).order_by(Candidate.id)
        ).scalars().all()

        screening.status = ScreeningStatus.ANALYZING.value
        db.commit()

        progress_tracker.start(screening_id, len(candidates))

        # ---- stage 1: validate -------------------------------------------------
        progress_tracker.set_stage(screening_id, "validating", f"Validating {len(candidates)} file(s)")
        valid: list[Candidate] = []
        failed = 0
        for candidate in candidates:
            path = Path(candidate.stored_path) if candidate.stored_path else None
            if candidate.parse_status == ParseStatus.FAILED.value and candidate.parse_error:
                failed += 1
                progress_tracker.add_error(screening_id, candidate.resume_filename or "file", candidate.parse_error)
                continue
            if path is None or not path.exists():
                candidate.parse_status = ParseStatus.FAILED.value
                candidate.parse_error = "The stored file is missing from the upload directory."
                failed += 1
                progress_tracker.add_error(screening_id, candidate.resume_filename or "file", candidate.parse_error)
                continue
            valid.append(candidate)
        db.commit()
        progress_tracker.update_counts(screening_id, processed=len(candidates), succeeded=len(valid), failed=failed)

        # ---- stage 2: extract text --------------------------------------------
        progress_tracker.set_stage(screening_id, "extracting", f"Extracting text from {len(valid)} file(s)")
        extracted: list[Candidate] = []
        for index, candidate in enumerate(valid, start=1):
            try:
                result = extract_text(Path(candidate.stored_path), candidate.resume_filename)
                candidate.resume_text = result["text"]
                candidate.parsed_profile = {
                    "extraction": {
                        "method": result["method"],
                        "pages": result.get("pages"),
                        "char_count": result.get("char_count"),
                        "ocr_suspected": result.get("ocr_suspected"),
                        "warnings": result.get("warnings", []),
                    }
                }
                extracted.append(candidate)
            except DocumentParseError as exc:
                candidate.parse_status = ParseStatus.FAILED.value
                candidate.parse_error = exc.message
                failed += 1
                progress_tracker.add_error(screening_id, candidate.resume_filename or "file", exc.message)
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("Unexpected extraction failure for candidate %s", candidate.id)
                candidate.parse_status = ParseStatus.FAILED.value
                candidate.parse_error = "The file could not be processed. It may be corrupted."
                failed += 1
                progress_tracker.add_error(screening_id, candidate.resume_filename or "file", str(exc)[:200])
            progress_tracker.set_stage(
                screening_id, "extracting",
                f"Extracted {index}/{len(valid)} file(s)",
                percent=11 + (index / max(len(valid), 1)) * 11,
            )
        db.commit()

        # ---- stage 3: parse profiles ------------------------------------------
        progress_tracker.set_stage(screening_id, "parsing", f"Parsing {len(extracted)} profile(s)")
        parsed: list[Candidate] = []
        for index, candidate in enumerate(extracted, start=1):
            try:
                profile = parse_resume(candidate.resume_text, candidate.resume_filename)
                profile["extraction"] = (candidate.parsed_profile or {}).get("extraction", {})
                candidate.parsed_profile = profile
                candidate.name = profile.get("name") or candidate.name or "Unnamed candidate"
                candidate.email = profile.get("email") or candidate.email
                candidate.phone = profile.get("phone")
                candidate.parse_status = ParseStatus.PARSED.value
                candidate.parse_error = None
                parsed.append(candidate)
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("Profile parsing failed for candidate %s", candidate.id)
                candidate.parse_status = ParseStatus.FAILED.value
                candidate.parse_error = "The resume text could not be parsed into a profile."
                failed += 1
                progress_tracker.add_error(screening_id, candidate.resume_filename or "file", str(exc)[:200])
            progress_tracker.set_stage(
                screening_id, "parsing",
                f"Parsed {index}/{len(extracted)} profile(s)",
                percent=22 + (index / max(len(extracted), 1)) * 11,
            )
        db.commit()
        progress_tracker.update_counts(screening_id, processed=len(candidates), succeeded=len(parsed), failed=failed)

        # ---- stage 4: requirements --------------------------------------------
        progress_tracker.set_stage(screening_id, "requirements", "Normalising job requirements")
        requirements = dict(screening.requirements or {})
        if not requirements.get("required_skills") and not requirements.get("preferred_skills"):
            # Nothing was saved (e.g. demo/legacy row): re-derive from the raw JD.
            requirements = analyze_jd(screening.job_description or "", screening.job_title)["requirements"]
        requirements["required_skills"] = normalise_skill_list(requirements.get("required_skills") or [])
        requirements["preferred_skills"] = normalise_skill_list(requirements.get("preferred_skills") or [])
        requirements.setdefault("responsibilities", [])
        requirements.setdefault("education_requirements", [])
        requirements.setdefault("domain_requirements", [])
        requirements.setdefault("minimum_experience", None)
        screening.requirements = requirements
        db.commit()

        if not parsed:
            screening.status = ScreeningStatus.FAILED.value
            db.commit()
            progress_tracker.fail(screening_id, "No resumes could be parsed, so nothing was scored.")
            return

        profiles = {c.id: (c.parsed_profile or {}) for c in parsed}

        # ---- stage 5: skills --------------------------------------------------
        from app.services.skill_matcher import match_skills

        progress_tracker.set_stage(screening_id, "skills", "Matching skills against requirements")
        skill_results: dict[int, dict] = {}
        for index, candidate in enumerate(parsed, start=1):
            skill_results[candidate.id] = match_skills(requirements, profiles[candidate.id], semantic_matcher)
            progress_tracker.set_stage(
                screening_id, "skills", f"Matched skills for {index}/{len(parsed)}",
                percent=34 + (index / len(parsed)) * 11,
            )

        # ---- stage 6: semantic ------------------------------------------------
        progress_tracker.set_stage(
            screening_id, "semantic",
            f"Encoding resumes with {semantic_matcher.status().get('method')}",
        )
        from app.services.semantic_relevance import score_semantic

        semantic_results: dict[int, dict] = {}
        for index, candidate in enumerate(parsed, start=1):
            semantic_results[candidate.id] = score_semantic(
                requirements, profiles[candidate.id], screening.job_title, semantic_matcher
            )
            progress_tracker.set_stage(
                screening_id, "semantic", f"Scored {index}/{len(parsed)} resumes",
                percent=45 + (index / len(parsed)) * 22,
            )

        # ---- stage 7: experience ---------------------------------------------
        from app.services.experience_matcher import match_experience

        progress_tracker.set_stage(screening_id, "experience", "Evaluating relevant experience")
        experience_results: dict[int, dict] = {}
        for index, candidate in enumerate(parsed, start=1):
            experience_results[candidate.id] = match_experience(
                requirements, profiles[candidate.id], semantic_matcher
            )
            progress_tracker.set_stage(
                screening_id, "experience", f"Evaluated {index}/{len(parsed)}",
                percent=67 + (index / len(parsed)) * 11,
            )

        # ---- stage 8: scores --------------------------------------------------
        progress_tracker.set_stage(screening_id, "scoring", "Combining component scores")
        for index, candidate in enumerate(parsed, start=1):
            analysis = analyse_candidate(
                requirements,
                profiles[candidate.id],
                screening.job_title,
                semantic_matcher,
                precomputed={
                    "skills": skill_results[candidate.id],
                    "semantic": semantic_results[candidate.id],
                    "experience": experience_results[candidate.id],
                },
            )
            _save_analysis(db, candidate, analysis)
            progress_tracker.set_stage(
                screening_id, "scoring", f"Scored {index}/{len(parsed)} candidates",
                percent=78 + (index / len(parsed)) * 15,
            )
        db.commit()

        # ---- stage 9: ranking -------------------------------------------------
        progress_tracker.set_stage(screening_id, "ranking", "Ranking candidates by score")
        rank_candidates(db, screening_id)
        screening.status = ScreeningStatus.COMPLETED.value
        screening.analyzed_at = utcnow()
        screening.score_version = SCORE_VERSION
        db.commit()

        progress_tracker.complete(
            screening_id,
            f"Analysed {len(parsed)} of {len(candidates)} candidates"
            + (f", {failed} failed" if failed else "")
            + ".",
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Analysis failed for screening %s", screening_id)
        db.rollback()
        try:
            screening = db.get(Screening, screening_id)
            if screening:
                screening.status = ScreeningStatus.FAILED.value
                db.commit()
        except Exception:
            pass
        progress_tracker.fail(screening_id, "Analysis failed unexpectedly. Check the server log.")
    finally:
        db.close()
