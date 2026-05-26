from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.websocket import manager
from app.core.security import get_current_user, require_active_public_user, require_roles
from app.core.store import store
from app.models.schemas import (
    CompetitionStateInput,
    FavoriteVoteRequest,
    HypeRequest,
    HypeResponse,
    LaunchPollRequest,
    LaunchTriviaInput,
    PollVoteRequest,
    PrizeVoteRequest,
    Role,
    TriviaAnswerRequest,
)

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

    store.global_hype_count += payload.clicks

    await manager.broadcast_dashboard(
        {
            "type": "hype",
            "event_id": payload.event_id,
            "user_id": str(user["id"]),
            "clicks": payload.clicks,
            "total_hype": total,
            "global_hype": store.global_hype_count,
            "active_users": store.active_user_count(),
        }
    )
    await manager.broadcast_public(
        {
            "type": "hype",
            "event_id": payload.event_id,
            "user_id": str(user["id"]),
            "clicks": payload.clicks,
            "total_hype": total,
            "global_hype": store.global_hype_count,
            "active_users": store.active_user_count(),
        }
    )
    return HypeResponse(event_id=payload.event_id, user_id=user["id"], total_hype=total)


# --- EVENT FLOW & TRIVIA CONTROL ENDPOINTS ---

@router.post("/competition/state")
async def set_competition_state(
    payload: CompetitionStateInput,
    _: dict = Depends(require_roles(Role.ADMIN, Role.STAFF)),
):
    store.active_competitor = {
        "id": str(payload.competitor_id) if payload.competitor_id else None,
        "name": payload.competitor_name,
        "modality": payload.modality,
        "started_at": int(datetime.now(UTC).timestamp() * 1000)
    }

    # Query all users with competitor role to generate dynamic leaderboard
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

    competitors_payload.sort(key=lambda x: x["total"], reverse=True)

    msg = {
        "type": "competition-state",
        "payload": {
            "eventId": "main-stage",
            "athlete": {
                "id": store.active_competitor["id"],
                "name": store.active_competitor["name"] or "Atleta en escena"
            },
            "modality": store.active_competitor["modality"],
            "startedAt": store.active_competitor["started_at"],
            "trivia": list(store.active_trivias.values())[0] if store.active_trivias else None,
            "poll": store.active_poll,
            "competitors": competitors_payload
        }
    }
    await manager.broadcast_dashboard(msg)
    await manager.broadcast_public(msg)
    return {"ok": True, "state": store.active_competitor}


@router.post("/trivias/launch")
async def launch_trivia(
    payload: LaunchTriviaInput,
    _: dict = Depends(require_roles(Role.ADMIN, Role.STAFF)),
):
    options_list = [{"id": opt.id, "label": opt.label} for opt in payload.options]
    trivia_data = {
        "id": payload.trivia_id,
        "question": payload.question,
        "options": options_list
    }
    store.active_trivias.clear()
    store.active_trivias[payload.trivia_id] = trivia_data

    msg = {
        "type": "trivia-launched",
        "trivia": trivia_data
    }
    await manager.broadcast_public(msg)
    await manager.broadcast_dashboard(msg)
    return {"ok": True}


@router.post("/trivias/close")
async def close_trivia(
    trivia_id: str,
    _: dict = Depends(require_roles(Role.ADMIN, Role.STAFF)),
):
    if trivia_id in store.active_trivias:
        del store.active_trivias[trivia_id]

    msg = {
        "type": "trivia-launched",
        "trivia": None
    }
    await manager.broadcast_public(msg)
    await manager.broadcast_dashboard(msg)
    return {"ok": True}


# --- FAVORITE VOTING ENDPOINTS ---

@router.post("/favorite")
async def vote_favorite(
    payload: FavoriteVoteRequest,
    user: dict = Depends(get_current_user),
):
    comp = store.get_user(payload.competitor_id)
    if not comp or comp["role"] != Role.COMPETITOR:
        raise HTTPException(status_code=400, detail="Competidor invalido")

    if user["id"] in store.favorite_votes:
        raise HTTPException(status_code=400, detail="Ya has votado por tu favorito")

    store.favorite_votes[user["id"]] = payload.competitor_id
    results = get_favorite_results_helper()

    msg = {"type": "favorites-update", "results": results}
    await manager.broadcast_dashboard(msg)
    await manager.broadcast_public(msg)
    return {"ok": True}


@router.get("/favorite/results")
async def get_favorite_results():
    return get_favorite_results_helper()


def get_favorite_results_helper():
    competitors = [u for u in store.list_users() if u["role"] == Role.COMPETITOR]
    tally = {comp["id"]: 0 for comp in competitors}
    for comp_id in store.favorite_votes.values():
        if comp_id in tally:
            tally[comp_id] += 1

    total_votes = len(store.favorite_votes)
    results = []
    for comp in competitors:
        count = tally[comp["id"]]
        pct = round((count / total_votes) * 100, 1) if total_votes > 0 else 0.0
        results.append({
            "id": str(comp["id"]),
            "name": comp["alias"],
            "votes": count,
            "percentage": pct
        })
    results.sort(key=lambda x: x["votes"], reverse=True)
    return results


# --- PRIZE INTERACTIVE VOTING (FOR COMPETITORS) ---

@router.post("/prize-vote")
async def vote_prize(
    payload: PrizeVoteRequest,
    user: dict = Depends(require_roles(Role.COMPETITOR)),
):
    if user["id"] in store.prize_votes:
        raise HTTPException(status_code=400, detail="Ya elegiste tu opcion de premio")

    store.prize_votes[user["id"]] = payload.option_id
    return {"ok": True}


@router.get("/prize-vote/results")
async def get_prize_results(_: dict = Depends(require_roles(Role.ADMIN, Role.STAFF, Role.COMPETITOR))):
    options = ["A", "B", "C"]
    tally = {opt: 0 for opt in options}
    for opt_id in store.prize_votes.values():
        if opt_id in tally:
            tally[opt_id] += 1
    total = len(store.prize_votes)
    return {
        "total_votes": total,
        "tally": tally,
        "percentages": {
            opt: round((count / total) * 100, 1) if total > 0 else 0.0
            for opt, count in tally.items()
        }
    }


# --- STAFF CUSTOM POLLS/SURVEYS ENDPOINTS ---

@router.post("/polls/launch")
async def launch_poll(
    payload: LaunchPollRequest,
    _: dict = Depends(require_roles(Role.ADMIN, Role.STAFF)),
):
    poll_data = {
        "question": payload.question,
        "options": [{"id": opt.id, "label": opt.label} for opt in payload.options]
    }
    store.active_poll = poll_data
    store.poll_votes.clear()

    msg = {
        "type": "poll-launched",
        "poll": poll_data
    }
    await manager.broadcast_public(msg)
    await manager.broadcast_dashboard(msg)
    return {"ok": True}


@router.post("/polls/vote")
async def vote_poll(
    payload: PollVoteRequest,
    user: dict = Depends(require_active_public_user),
):
    if not store.active_poll:
        raise HTTPException(status_code=400, detail="No hay ninguna encuesta activa")

    for v in store.poll_votes:
        if v["user_id"] == user["id"]:
            raise HTTPException(status_code=400, detail="Ya has votado en esta encuesta")

    record = {
        "user_id": user["id"],
        "option_id": payload.option_id
    }
    store.poll_votes.append(record)

    tally = {}
    for opt in store.active_poll["options"]:
        tally[opt["id"]] = sum(1 for v in store.poll_votes if v["option_id"] == opt["id"])

    msg = {
        "type": "poll-vote-update",
        "tally": tally,
        "total": len(store.poll_votes)
    }
    await manager.broadcast_dashboard(msg)
    await manager.broadcast_public(msg)
    return {"ok": True}


@router.post("/polls/close")
async def close_poll(
    _: dict = Depends(require_roles(Role.ADMIN, Role.STAFF)),
):
    store.active_poll = None
    msg = {
        "type": "poll-launched",
        "poll": None
    }
    await manager.broadcast_public(msg)
    await manager.broadcast_dashboard(msg)
    return {"ok": True}
