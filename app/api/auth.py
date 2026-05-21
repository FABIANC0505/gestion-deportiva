from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends

from app.core.security import create_access_token, require_roles
from app.core.store import store
from app.models.schemas import ExpressRegisterRequest, ExpressRegisterResponse, Role, UserStatus

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


@router.post("/dev-token/{role}", include_in_schema=False)
async def create_dev_token(role: Role, _: dict = Depends(require_roles(Role.ADMIN))):
    user_id = uuid4()
    store.users[user_id] = {
        "id": user_id,
        "alias": f"dev-{role.value}",
        "role": role,
        "status": UserStatus.ACTIVE,
        "created_at": datetime.now(UTC),
        "last_check_in_at": None,
        "last_check_out_at": None,
    }
    return {"access_token": create_access_token(user_id, role), "token_type": "bearer"}
