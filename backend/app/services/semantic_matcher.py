"""Semantic similarity between job requirements and candidate evidence.

Primary backend: a Sentence Transformers model (all-MiniLM-L6-v2 by default),
loaded lazily in a background thread so the API starts instantly.

Fallback backend: TF-IDF (word + character n-grams) reduced with TruncatedSVD,
used only when the model cannot be loaded (no network on first run, torch not
installed, or HIRELENS_DISABLE_MODEL=1). The fallback is always *reported* to
the client, so a keyword-ish similarity is never presented as model output.

Cosine similarity is calibrated, not multiplied by 100: MiniLM puts unrelated
pairs near 0.05-0.15 and genuine paraphrases near 0.55-0.70, so the raw value
is mapped through a documented window (see SEMANTIC_CALIBRATION).
"""

from __future__ import annotations

import hashlib
import threading
from collections import OrderedDict

import numpy as np

from app.core.config import (
    SEMANTIC_CALIBRATION,
    SEMANTIC_CALIBRATION_FALLBACK,
    SEMANTIC_EVIDENCE_THRESHOLD,
    SEMANTIC_EVIDENCE_THRESHOLD_FALLBACK,
    settings,
)
from app.core.logging_config import get_logger

logger = get_logger(__name__)

_CACHE_LIMIT = 4096


class _VectorCache:
    def __init__(self, limit: int = _CACHE_LIMIT):
        self._data: OrderedDict[str, np.ndarray] = OrderedDict()
        self._limit = limit
        self._lock = threading.Lock()

    def get(self, key: str) -> np.ndarray | None:
        with self._lock:
            value = self._data.get(key)
            if value is not None:
                self._data.move_to_end(key)
            return value

    def put(self, key: str, value: np.ndarray) -> None:
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self._limit:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


def _key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()


class SemanticMatcher:
    """Lazy, thread-safe semantic similarity service (process-wide singleton)."""

    def __init__(self) -> None:
        self._model = None
        self._model_error: str | None = None
        self._state = "idle"  # idle | loading | ready | fallback | disabled
        self._lock = threading.Lock()
        self._cache = _VectorCache()
        self._cache_fallback = _VectorCache()

    # -- lifecycle ---------------------------------------------------------
    @property
    def state(self) -> str:
        return self._state

    def status(self) -> dict:
        return {
            "state": self._state,
            "model": settings.semantic_model,
            "method": "sentence-transformers" if self._state == "ready" else (
                "tfidf-svd" if self._state in ("fallback", "disabled") else "unavailable"
            ),
            "error": self._model_error,
            "calibration": SEMANTIC_CALIBRATION,
            "calibration_fallback": SEMANTIC_CALIBRATION_FALLBACK,
            "evidence_threshold": SEMANTIC_EVIDENCE_THRESHOLD,
            "evidence_threshold_fallback": SEMANTIC_EVIDENCE_THRESHOLD_FALLBACK,
        }

    def warmup(self) -> None:
        """Blocking load - call from a background thread at startup."""
        self._ensure_model()

    def _ensure_model(self) -> bool:
        if self._state in ("ready", "fallback", "disabled"):
            return self._state == "ready"
        with self._lock:
            if self._state in ("ready", "fallback", "disabled"):
                return self._state == "ready"
            if settings.disable_semantic_model:
                self._state = "disabled"
                logger.warning("Semantic model disabled by configuration; using TF-IDF/SVD fallback.")
                return False
            self._state = "loading"
            try:
                from sentence_transformers import SentenceTransformer

                logger.info("Loading embedding model %s", settings.semantic_model)
                self._model = SentenceTransformer(settings.semantic_model)
                self._model.max_seq_length = 256
                self._state = "ready"
                logger.info("Embedding model ready")
                return True
            except Exception as exc:  # pragma: no cover - depends on environment
                self._model_error = f"{type(exc).__name__}: {exc}"[:300]
                self._state = "fallback"
                logger.warning("Embedding model unavailable (%s); using TF-IDF/SVD fallback.", self._model_error)
                return False

    # -- embedding ---------------------------------------------------------
    def _encode(self, texts: list[str]) -> np.ndarray:
        out: list[np.ndarray] = []
        missing: list[tuple[int, str]] = []
        for i, text in enumerate(texts):
            cached = self._cache.get(_key(text))
            if cached is None:
                missing.append((i, text))
                out.append(np.zeros(384, dtype=np.float32))
            else:
                out.append(cached)
        if missing:
            vectors = self._model.encode(
                [t for _, t in missing],
                normalize_embeddings=True,
                convert_to_numpy=True,
                batch_size=32,
                show_progress_bar=False,
            )
            for (index, text), vector in zip(missing, vectors):
                vector = np.asarray(vector, dtype=np.float32)
                self._cache.put(_key(text), vector)
                out[index] = vector
        return np.vstack(out) if out else np.zeros((0, 384), dtype=np.float32)

    def _tfidf_matrix(self, texts: list[str]) -> np.ndarray:
        """Deterministic fallback: TF-IDF -> SVD -> L2 normalised vectors.

        The SVD basis depends on the corpus, so these vectors are intentionally
        not cached across calls: vectors from two different corpora live in
        different spaces and must never be compared.
        """
        from sklearn.decomposition import TruncatedSVD
        from sklearn.feature_extraction.text import TfidfVectorizer

        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2), sublinear_tf=True, min_df=1, stop_words="english"
        )
        matrix = vectorizer.fit_transform(texts)
        n_components = min(64, max(2, min(matrix.shape) - 1))
        reduced = TruncatedSVD(n_components=n_components, random_state=42).fit_transform(matrix)
        norms = np.linalg.norm(reduced, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        reduced = reduced / norms
        return np.asarray(reduced, dtype=np.float32)

    def similarity_matrix(self, left: list[str], right: list[str]) -> tuple[np.ndarray, str]:
        """Return ``(matrix, method)`` of cosine similarities between two lists."""
        left = [t or "" for t in left]
        right = [t or "" for t in right]
        if not left or not right:
            return np.zeros((len(left), len(right)), dtype=np.float32), self._method_name()

        if self._ensure_model():
            a = self._encode(left)
            b = self._encode(right)
            return np.clip(a @ b.T, -1.0, 1.0), "sentence-transformers"

        combined = left + right
        vectors = self._tfidf_matrix(combined)
        a = vectors[: len(left)]
        b = vectors[len(left):]
        return np.clip(a @ b.T, -1.0, 1.0), "tfidf-svd"

    def _method_name(self) -> str:
        return "sentence-transformers" if self._state == "ready" else "tfidf-svd"

    def similarity(self, left: str, right: str) -> tuple[float, str]:
        matrix, method = self.similarity_matrix([left], [right])
        return float(matrix[0, 0]), method

    # -- calibration -------------------------------------------------------
    @staticmethod
    def window_for(method: str | None = None) -> dict[str, float]:
        return (
            SEMANTIC_CALIBRATION_FALLBACK
            if method == "tfidf-svd"
            else SEMANTIC_CALIBRATION
        )

    @classmethod
    def calibrate(cls, cosine: float, method: str | None = None) -> float:
        """Map a cosine similarity onto 0-100 using the window for that backend."""
        window = cls.window_for(method)
        low, high = window["low"], window["high"]
        if cosine <= low:
            return 0.0
        if cosine >= high:
            return 100.0
        return round(((cosine - low) / (high - low)) * 100, 2)

    @staticmethod
    def is_evidence(cosine: float, method: str | None = None) -> bool:
        threshold = (
            SEMANTIC_EVIDENCE_THRESHOLD_FALLBACK if method == "tfidf-svd" else SEMANTIC_EVIDENCE_THRESHOLD
        )
        return cosine >= threshold


semantic_matcher = SemanticMatcher()


def start_warmup() -> threading.Thread:
    thread = threading.Thread(target=semantic_matcher.warmup, name="semantic-warmup", daemon=True)
    thread.start()
    return thread
