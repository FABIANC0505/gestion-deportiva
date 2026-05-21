from datetime import UTC, datetime
from os import getenv
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.core.security import create_access_token
from app.core.store import store
from app.models.schemas import ExpressRegisterRequest, ExpressRegisterResponse, Role, StaffLoginRequest, TokenResponse, UserStatus

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register-express", response_model=ExpressRegisterResponse, status_code=201)
async def register_express(payload: ExpressRegisterRequest) -> ExpressRegisterResponse:
    user_id = uuid4()
    user = {
        "id": user_id,
        "alias": payload.alias.strip(),
        "role": Role.USER,
        "status": UserStatus.INACTIVE,
        "created_at": datetime.now(UTC),
        "last_check_in_at": None,
        "last_check_out_at": None,
    }
    store.users[user_id] = user

    token = create_access_token(user_id=user_id, role=Role.USER)
    return ExpressRegisterResponse(
        user_id=user_id,
        alias=user["alias"],
        role=user["role"],
        status=user["status"],
        access_token=token,
        qr_payload=str(user_id),
    )


@router.post("/staff-login", response_model=TokenResponse)
async def staff_login(payload: StaffLoginRequest) -> TokenResponse:
    expected_code = getenv("WORKCALIST_STAFF_ACCESS_CODE", "STAFF-LOCAL-2026")
    if payload.access_code != expected_code:
        raise HTTPException(status_code=401, detail="Codigo de staff invalido")
    if payload.role not in {Role.ADMIN, Role.STAFF}:
        raise HTTPException(status_code=400, detail="Rol staff invalido")

    user_id = uuid4()
    user = {
        "id": user_id,
        "alias": payload.alias.strip(),
        "role": payload.role,
        "status": UserStatus.ACTIVE,
        "created_at": datetime.now(UTC),
        "last_check_in_at": None,
        "last_check_out_at": None,
    }
    store.users[user_id] = user

    return TokenResponse(
        user_id=user_id,
        alias=user["alias"],
        role=user["role"],
        access_token=create_access_token(user_id=user_id, role=user["role"]),
    )
