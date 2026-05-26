from datetime import UTC, datetime
from statistics import mean
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.websocket import manager
from app.core.security import require_roles
from app.core.store import store
from app.models.schemas import FinalScoreInput, FinalScoreResponse, Role
from app.services.formulas import calculate_final_score

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.post("/calculate", response_model=FinalScoreResponse)
async def calculate_score(
    payload: FinalScoreInput,
    _: dict = Depends(require_roles(Role.ADMIN, Role.STAFF, Role.JUDGE)),
) -> FinalScoreResponse:
    # Calculate components
    result = calculate_final_score(payload)

    # Determine which competitor we are scoring
    target_id = payload.competitor_id
    if not target_id and store.active_competitor:
        target_id_str = store.active_competitor.get("id")
        if target_id_str:
            target_id = UUID(target_id_str)

    if not target_id:
        raise HTTPException(status_code=400, detail="No se especifico el competidor")

    # Get competitor user details
    competitor_user = store.get_user(target_id)
    target_name = competitor_user["alias"] if competitor_user else "Atleta en escena"

    # Compute averages for radar chart
    coordination_avg = mean(s.coordination for s in payload.judge_scores)
    strength_avg = mean(s.strength for s in payload.judge_scores)
    endurance_avg = mean(s.endurance for s in payload.judge_scores)
    flexibility_avg = mean(s.flexibility for s in payload.judge_scores)

    scores_array = [
        round(coordination_avg, 2),
        round(strength_avg, 2),
        round(endurance_avg, 2),
        round(flexibility_avg, 2)
    ]

    # Save to store
    store.competitor_scores[target_id] = {
        "scores": scores_array,
        "total": result.final_score
    }

    # Generate updated competition state payload
    competitor_users = [u for u in store.list_users() if u["role"] == Role.COMPETITOR]
    competitors_payload = []
    for comp in competitor_users:
        scores_record = store.competitor_scores.get(comp["id"], {"scores": [0.0, 0.0, 0.0, 0.0], "total": 0.0})
        competitors_payload.append({
            "id": str(comp["id"]),
            "name": comp["alias"],
            "scores": scores_record["scores"],
            "total": scores_record["total"]
        })

    # Sort competitors by total descending
    competitors_payload.sort(key=lambda x: x["total"], reverse=True)

    # Broadcast updated competition state
    started_at = int(datetime.now(UTC).timestamp() * 1000)
    if store.active_competitor:
        started_at = store.active_competitor.get("started_at", started_at)

    msg = {
        "type": "competition-state",
        "payload": {
            "eventId": "main-stage",
            "athlete": {
                "id": str(target_id),
                "name": target_name
            },
            "modality": payload.modality,
            "startedAt": started_at,
            "trivia": list(store.active_trivias.values())[0] if store.active_trivias else None,
            "competitors": competitors_payload
        }
    }
    await manager.broadcast_dashboard(msg)
    await manager.broadcast_public(msg)

    return result
