from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from app.api.websocket import manager
from app.core.security import require_roles
from app.core.store import store
from app.models.schemas import AttendanceResponse, CheckRequest, Role, UserStatus

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.post("/check-in", response_model=AttendanceResponse)
async def check_in(
    payload: CheckRequest,
    staff_user: dict = Depends(require_roles(Role.ADMIN, Role.STAFF)),
) -> AttendanceResponse:
    user = store.get_user(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user["role"] != Role.USER:
        raise HTTPException(status_code=400, detail="Solo el publico usa check-in fisico")

    checked_at = datetime.now(UTC)
    user = store.update_user(
        payload.user_id,
        {
            "status": UserStatus.ACTIVE,
            "last_check_in_at": checked_at,
        },
    )
    store.mark_attendance(payload.user_id, "check-in", checked_at, staff_user["id"], payload.reason)

    active_users = store.active_user_count()
    await manager.broadcast_dashboard(
        {
            "type": "attendance",
            "action": "check-in",
            "user_id": str(payload.user_id),
            "alias": user["alias"],
            "active_users": active_users,
            "timestamp": checked_at.isoformat(),
        }
    )
    return AttendanceResponse(
        user_id=payload.user_id,
        alias=user["alias"],
        status=user["status"],
        checked_at=checked_at,
        active_users=active_users,
    )


@router.post("/check-out", response_model=AttendanceResponse)
async def check_out(
    payload: CheckRequest,
    staff_user: dict = Depends(require_roles(Role.ADMIN, Role.STAFF)),
) -> AttendanceResponse:
    user = store.get_user(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user["role"] != Role.USER:
        raise HTTPException(status_code=400, detail="Solo el publico usa check-out fisico")

    checked_at = datetime.now(UTC)
    user = store.update_user(
        payload.user_id,
        {
            "status": UserStatus.INACTIVE,
            "last_check_out_at": checked_at,
        },
    )
    store.mark_attendance(payload.user_id, "check-out", checked_at, staff_user["id"], payload.reason)

    active_users = store.active_user_count()
    await manager.broadcast_dashboard(
        {
            "type": "attendance",
            "action": "check-out",
            "user_id": str(payload.user_id),
            "alias": user["alias"],
            "active_users": active_users,
            "timestamp": checked_at.isoformat(),
        }
    )
    return AttendanceResponse(
        user_id=payload.user_id,
        alias=user["alias"],
        status=user["status"],
        checked_at=checked_at,
        active_users=active_users,
    )
