"""In-memory analysis progress tracking.

A local prototype does not need Celery/Redis. Analysis runs in a worker thread
and publishes real stage transitions here; the client polls
``GET /api/jobs/{id}/progress``. The numbers reported are the numbers the worker
actually processed - nothing is simulated.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone

ANALYSIS_STAGES: list[tuple[str, str]] = [
    ("validating", "Validating files"),
    ("extracting", "Extracting resume text"),
    ("parsing", "Parsing candidate profiles"),
    ("requirements", "Analysing job requirements"),
    ("skills", "Matching skills"),
    ("semantic", "Calculating semantic similarity"),
    ("experience", "Evaluating experience"),
    ("scoring", "Generating scores"),
    ("ranking", "Ranking candidates"),
]


class ProgressTracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[int, dict] = {}

    def start(self, screening_id: int, total_files: int) -> None:
        with self._lock:
            self._state[screening_id] = {
                "screening_id": screening_id,
                "state": "running",
                "current_stage": ANALYSIS_STAGES[0][0],
                "percent": 0.0,
                "total_files": total_files,
                "processed_files": 0,
                "succeeded_files": 0,
                "failed_files": 0,
                "stages": [
                    {"key": key, "label": label, "status": "pending", "detail": None}
                    for key, label in ANALYSIS_STAGES
                ],
                "errors": [],
                "message": "Analysis started.",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "finished_at": None,
            }

    def _entry(self, screening_id: int) -> dict | None:
        return self._state.get(screening_id)

    def set_stage(self, screening_id: int, key: str, detail: str | None = None, percent: float | None = None) -> None:
        with self._lock:
            entry = self._entry(screening_id)
            if not entry:
                return
            keys = [s["key"] for s in entry["stages"]]
            if key not in keys:
                return
            index = keys.index(key)
            for i, stage in enumerate(entry["stages"]):
                if i < index and stage["status"] != "failed":
                    stage["status"] = "done"
                elif i == index:
                    stage["status"] = "running"
                    if detail is not None:
                        stage["detail"] = detail
            entry["current_stage"] = key
            if percent is not None:
                entry["percent"] = max(entry["percent"], round(min(percent, 99.5), 1))
            else:
                entry["percent"] = max(entry["percent"], round(index / len(keys) * 100, 1))
            if detail:
                entry["message"] = detail

    def update_counts(self, screening_id: int, *, processed: int | None = None, succeeded: int | None = None, failed: int | None = None) -> None:
        with self._lock:
            entry = self._entry(screening_id)
            if not entry:
                return
            if processed is not None:
                entry["processed_files"] = processed
            if succeeded is not None:
                entry["succeeded_files"] = succeeded
            if failed is not None:
                entry["failed_files"] = failed

    def add_error(self, screening_id: int, filename: str, message: str) -> None:
        with self._lock:
            entry = self._entry(screening_id)
            if not entry:
                return
            entry["errors"].append({"file": filename, "message": message})
            entry["failed_files"] = len(entry["errors"])

    def complete(self, screening_id: int, message: str = "Analysis complete.") -> None:
        with self._lock:
            entry = self._entry(screening_id)
            if not entry:
                return
            for stage in entry["stages"]:
                if stage["status"] != "failed":
                    stage["status"] = "done"
            entry.update(
                {
                    "state": "completed",
                    "percent": 100.0,
                    "current_stage": None,
                    "message": message,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                }
            )

    def fail(self, screening_id: int, message: str) -> None:
        with self._lock:
            entry = self._entry(screening_id)
            if not entry:
                return
            entry.update(
                {
                    "state": "failed",
                    "message": message,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            if entry["current_stage"]:
                for stage in entry["stages"]:
                    if stage["key"] == entry["current_stage"]:
                        stage["status"] = "failed"

    def get(self, screening_id: int) -> dict | None:
        with self._lock:
            entry = self._entry(screening_id)
            return dict(entry) if entry else None

    def is_running(self, screening_id: int) -> bool:
        entry = self.get(screening_id)
        return bool(entry and entry["state"] == "running")

    def clear(self, screening_id: int) -> None:
        with self._lock:
            self._state.pop(screening_id, None)


progress_tracker = ProgressTracker()
