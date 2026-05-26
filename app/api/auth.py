from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.security import create_access_token, require_roles
from app.core.store import store
from app.models.schemas import (
    AdminRegisterRoleRequest,
    ExpressRegisterRequest,
    ExpressRegisterResponse,
    Role,
    RoleRegisterRequest,
    StaffLoginRequest,
    TokenResponse,
    UserResponse,
    UserStatus,
    UserUpdateRequest,
)

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
    expected_code = settings.staff_access_code
    if payload.access_code != expected_code:
        raise HTTPException(status_code=401, detail="Codigo de staff invalido")

    # Find user by alias
    user = store.get_user_by_alias(payload.alias)
    if not user:
        # Bootstrap first admin: if there are no admins in the DB, and they are trying to login/register as Admin
        if payload.role == Role.ADMIN and store.count_admins() == 0:
            user_id = uuid4()
            user_data = {
                "id": user_id,
                "alias": payload.alias.strip(),
                "role": Role.ADMIN,
                "status": UserStatus.ACTIVE,
                "created_at": datetime.now(UTC),
                "last_check_in_at": None,
                "last_check_out_at": None,
            }
            user = store.create_user(user_data)
            return TokenResponse(
                user_id=user_id,
                alias=user["alias"],
                role=user["role"],
                access_token=create_access_token(user_id=user_id, role=user["role"]),
            )

        raise HTTPException(status_code=401, detail="Usuario no registrado por el Administrador")

    # If found, check if they are operational
    if user["role"] not in {Role.ADMIN, Role.STAFF, Role.JUDGE, Role.COMPETITOR}:
        raise HTTPException(status_code=403, detail="Rol no operativo")

    return TokenResponse(
        user_id=user["id"],
        alias=user["alias"],
        role=user["role"],
        access_token=create_access_token(user_id=user["id"], role=user["role"]),
    )


@router.post("/register-role", response_model=TokenResponse, status_code=201)
async def register_role(
    payload: AdminRegisterRoleRequest,
    _: dict = Depends(require_roles(Role.ADMIN)),
) -> TokenResponse:
    # Administrative creation of staff, judges, competitors, or other admins
    if payload.role not in {Role.ADMIN, Role.STAFF, Role.JUDGE, Role.COMPETITOR}:
        raise HTTPException(status_code=400, detail="Rol operativo invalido")

    # Check if user already exists
    existing = store.get_user_by_alias(payload.alias)
    if existing:
        raise HTTPException(status_code=400, detail="El alias ya esta registrado")

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


# --- ADMIN CRUD ENDPOINTS ---

@router.get("/users", response_model=list[UserResponse])
async def list_users(_: dict = Depends(require_roles(Role.ADMIN))) -> list[UserResponse]:
    return [UserResponse(**u) for u in store.list_users()]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_details(user_id: UUID, _: dict = Depends(require_roles(Role.ADMIN))) -> UserResponse:
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserResponse(**user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user_details(
    user_id: UUID,
    payload: UserUpdateRequest,
    _: dict = Depends(require_roles(Role.ADMIN)),
) -> UserResponse:
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    values = {}
    if payload.alias is not None:
        alias_clean = payload.alias.strip()
        if alias_clean != user["alias"]:
            existing = store.get_user_by_alias(alias_clean)
            if existing:
                raise HTTPException(status_code=400, detail="El alias ya esta registrado")
            values["alias"] = alias_clean

    if payload.role is not None:
        values["role"] = payload.role

    if payload.status is not None:
        values["status"] = payload.status

    if values:
        user = store.update_user(user_id, values)

    return UserResponse(**user)


@router.delete("/users/{user_id}")
async def delete_user(user_id: UUID, _: dict = Depends(require_roles(Role.ADMIN))) -> dict:
    success = store.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"ok": True}


@router.get("/admin/stats")
async def get_admin_stats(_: dict = Depends(require_roles(Role.ADMIN))) -> dict:
    return {
        "active_users_in_recinto": store.active_user_count(),
        "total_hype_clicks": store.global_hype_count,
        "active_poll": store.active_poll,
        "poll_votes_count": len(store.poll_votes),
        "favorite_votes_count": len(store.favorite_votes),
    }

