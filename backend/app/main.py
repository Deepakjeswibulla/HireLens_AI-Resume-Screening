"""HireLens API entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import routes_candidates, routes_jobs, routes_meta
from app.core.config import settings
from app.core.logging_config import configure_logging, get_logger
from app.database.db import init_db
from app.services.semantic_matcher import start_warmup

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    init_db()
    logger.info("HireLens API starting (v%s)", settings.version)
    # Load the embedding model in the background so the API answers immediately.
    start_warmup()
    yield
    logger.info("HireLens API shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Explainable AI resume screening: deterministic requirement extraction, "
        "hybrid skill + semantic matching, and transparent 0-100 scoring."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_jobs.router, prefix=settings.api_prefix)
app.include_router(routes_candidates.router, prefix=settings.api_prefix)
app.include_router(routes_meta.router, prefix=settings.api_prefix)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request could not be completed."
    return JSONResponse(status_code=exc.status_code, content={"detail": detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {
            "field": ".".join(str(part) for part in error.get("loc", [])[1:]) or "body",
            "message": error.get("msg", "Invalid value"),
        }
        for error in exc.errors()[:6]
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "Some fields need attention.", "errors": errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    # Log the trace, never return it.
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on the server. Please try again."},
    )


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "service": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "api": settings.api_prefix,
    }
