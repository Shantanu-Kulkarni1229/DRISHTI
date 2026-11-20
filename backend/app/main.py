from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_settings
from app.core.exceptions import DrishtiBaseException, to_http_exception
from app.core.logging import get_logger, setup_logging
from app.db.init_extensions import init_extensions

settings = get_settings()
setup_logging(level=settings.LOG_LEVEL, log_format=settings.LOG_FORMAT)
logger = get_logger("drishti.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    current_settings = get_settings()
    logger.info("Starting %s in %s mode (Offline: %s)", current_settings.APP_NAME, current_settings.APP_ENV, current_settings.OFFLINE_MODE)
    current_settings.ensure_directories()
    yield
    # Shutdown
    logger.info("Shutting down %s", current_settings.APP_NAME)


app = FastAPI(
    title="DRISHTI Geospatial Intelligence API",
    description="Offline-first AI-powered satellite imagery search, change analysis, and evidence management.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Domain Exception Handler
@app.exception_handler(DrishtiBaseException)
async def drishti_exception_handler(request: Request, exc: DrishtiBaseException):
    http_exc = to_http_exception(exc)
    return JSONResponse(
        status_code=http_exc.status_code,
        content={"detail": http_exc.detail},
    )


# Mount functional API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "api": settings.API_V1_PREFIX,
    }
