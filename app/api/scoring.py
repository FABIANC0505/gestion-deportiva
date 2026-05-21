from fastapi import APIRouter, Depends

from app.core.security import require_roles
from app.models.schemas import FinalScoreInput, FinalScoreResponse, Role
from app.services.formulas import calculate_final_score

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.post("/calculate", response_model=FinalScoreResponse)
async def calculate_score(
    payload: FinalScoreInput,
    _: dict = Depends(require_roles(Role.ADMIN, Role.STAFF, Role.JUDGE, Role.COMPETITOR)),
) -> FinalScoreResponse:
    return calculate_final_score(payload)
