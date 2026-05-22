from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.security import create_access_token
from app.core.store import store
from app.models.schemas import ExpressRegisterRequest, ExpressRegisterResponse, Role, RoleRegisterRequest, StaffLoginRequest, TokenResponse, UserStatus

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
    user = store.create_user(user)

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
    return _register_privileged_role(payload)


@router.post("/register-role", response_model=TokenResponse, status_code=201)
async def register_role(payload: RoleRegisterRequest) -> TokenResponse:
    return _register_privileged_role(payload)


def _register_privileged_role(payload: RoleRegisterRequest) -> TokenResponse:
    expected_code = settings.staff_access_code
    if payload.access_code != expected_code:
        raise HTTPException(status_code=401, detail="Codigo de staff invalido")
    if payload.role not in {Role.ADMIN, Role.STAFF, Role.JUDGE, Role.COMPETITOR}:
        raise HTTPException(status_code=400, detail="Rol operativo invalido")

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
    user = store.create_user(user)

    return TokenResponse(
        user_id=user_id,
        alias=user["alias"],
        role=user["role"],
        access_token=create_access_token(user_id=user_id, role=user["role"]),
    )
