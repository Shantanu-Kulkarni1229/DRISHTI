from fastapi import APIRouter

from app.api.v1 import (
    audit,
    auth,
    candidates,
    changes,
    clusters,
    evaluation,
    exports,
    health,
    ingestion,
    models,
    search,
    tiles,
)

api_router = APIRouter()

# Mount health routes at top level of API
api_router.include_router(health.router)

# Mount functional routes
api_router.include_router(auth.router)
api_router.include_router(search.router)
api_router.include_router(tiles.router)
api_router.include_router(changes.router)
api_router.include_router(candidates.router)
api_router.include_router(clusters.router)
api_router.include_router(ingestion.router)
api_router.include_router(audit.router)
api_router.include_router(models.router)
api_router.include_router(exports.router)
api_router.include_router(evaluation.router)
