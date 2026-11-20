from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.adapters.embeddings.dinov2_adapter import DINOv2Adapter
from app.adapters.embeddings.remoteclip_adapter import RemoteCLIPAdapter
from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
def get_health():
    settings = get_settings()
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "offline_mode": settings.OFFLINE_MODE,
    }


@router.get("/health/ready", status_code=status.HTTP_200_OK)
def get_readiness(db: Session = Depends(get_db)):
    settings = get_settings()
    db_status = "connected"
    postgis_status = "unavailable"
    pgvector_status = "unavailable"

    try:
        if db.bind and db.bind.dialect.name == "postgresql":
            # Check PostGIS
            res_gis = db.execute(text("SELECT PostGIS_Version();")).scalar()
            if res_gis:
                postgis_status = "available"
            # Check pgvector
            res_vec = db.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector';")).scalar()
            if res_vec:
                pgvector_status = "available"
        else:
            db_status = f"connected ({db.bind.dialect.name if db.bind else 'unknown'})"
            postgis_status = "mock_mode"
            pgvector_status = "mock_mode"
    except Exception as e:
        db_status = f"error: {str(e)}"

    clip = RemoteCLIPAdapter()
    dino = DINOv2Adapter()

    return {
        "status": "ready" if "error" not in db_status else "degraded",
        "database": db_status,
        "postgis": postgis_status,
        "pgvector": pgvector_status,
        "storage": {
            "backend": settings.STORAGE_BACKEND,
            "data_root_exists": settings.DATA_ROOT.exists(),
        },
        "models": {
            "remoteclip": "available" if clip.is_available() else "not_configured",
            "dinov2": "available" if dino.is_available() else "not_configured",
            "change_detection": "available" if settings.CHANGE_MODEL_PATH.exists() else "not_configured",
        },
    }
