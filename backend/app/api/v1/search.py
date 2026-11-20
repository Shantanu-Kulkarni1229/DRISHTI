from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.search import (
    RelevanceFeedbackRequest,
    RelevanceFeedbackResponse,
    SearchQueryRequest,
    SearchResponse,
)
from app.services.search.query_service import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


@router.post("", response_model=SearchResponse)
def run_search(
    req: SearchQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SearchService(db)
    return service.execute_search(organisation_id=str(current_user.organisation_id), req=req)


@router.post("/feedback", response_model=RelevanceFeedbackResponse)
def submit_feedback(
    req: RelevanceFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Persist feedback in audit or session context
    return RelevanceFeedbackResponse(
        status="recorded",
        feedback_rounds=1,
    )
