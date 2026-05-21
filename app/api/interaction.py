from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from app.api.websocket import manager
from app.core.security import require_active_public_user
from app.core.store import store
from app.models.schemas import HypeRequest, HypeResponse, TriviaAnswerRequest

router = APIRouter(prefix="/api/interaction", tags=["interaction"])


@router.get("/trivias/active")
async def list_active_trivias(user: dict = Depends(require_active_public_user)):
    return {
        "user_id": user["id"],
        "trivias": list(store.active_trivias.values()),
    }


@router.post("/trivias/answer")
async def answer_trivia(
    payload: TriviaAnswerRequest,
    user: dict = Depends(require_active_public_user),
):
    trivia = store.active_trivias.get(payload.trivia_id)
    if not trivia:
        raise HTTPException(status_code=404, detail="Trivia no activa")

    record = {
        "trivia_id": payload.trivia_id,
        "answer_id": payload.answer_id,
        "user_id": user["id"],
        "answered_at": datetime.now(UTC),
    }
    store.trivia_answers.append(record)
    await manager.broadcast_dashboard(
        {
            "type": "trivia-answer",
            "trivia_id": payload.trivia_id,
            "answer_id": payload.answer_id,
            "user_id": str(user["id"]),
        }
    )
    return {"ok": True}


@router.post("/hype", response_model=HypeResponse)
async def click_hype(
    payload: HypeRequest,
    user: dict = Depends(require_active_public_user),
) -> HypeResponse:
    store.hype_by_event[payload.event_id] += payload.clicks
    store.hype_by_user[(payload.event_id, user["id"])] += payload.clicks
    total = store.hype_by_event[payload.event_id]

    await manager.broadcast_dashboard(
        {
            "type": "hype",
            "event_id": payload.event_id,
            "user_id": str(user["id"]),
            "clicks": payload.clicks,
            "total_hype": total,
            "active_users": store.active_user_count(),
        }
    )
    return HypeResponse(event_id=payload.event_id, user_id=user["id"], total_hype=total)
