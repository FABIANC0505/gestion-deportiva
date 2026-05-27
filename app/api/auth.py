from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.core.security import create_access_token, require_roles, hash_password, verify_password
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
        "username": None,
        "password_hash": None,
        "weight": None,
        "category": None,
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
    # Find user by username
    user = store.get_user_by_username(payload.username)
    if not user:
        # Bootstrap first admin: if there are no admins in the DB, and they are trying to login as admin
        if payload.username == "admin" and store.count_admins() == 0:
            user_id = uuid4()
            user_data = {
                "id": user_id,
                "alias": "MasterAdmin",
                "role": Role.ADMIN,
                "status": UserStatus.ACTIVE,
                "created_at": datetime.now(UTC),
                "last_check_in_at": None,
                "last_check_out_at": None,
                "username": "admin",
                "password_hash": hash_password(payload.password),
                "weight": None,
                "category": None,
            }
            user = store.create_user(user_data)
            return TokenResponse(
                user_id=user_id,
                alias=user["alias"],
                role=user["role"],
                access_token=create_access_token(user_id=user_id, role=user["role"]),
                username=user["username"],
                weight=user["weight"],
                category=user["category"],
            )

        raise HTTPException(status_code=401, detail="Credenciales incorrectas o usuario no registrado")

    # If found, check password
    if not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if user["role"] not in {Role.ADMIN, Role.STAFF, Role.JUDGE, Role.COMPETITOR}:
        raise HTTPException(status_code=403, detail="Rol no operativo")

    return TokenResponse(
        user_id=user["id"],
        alias=user["alias"],
        role=user["role"],
        access_token=create_access_token(user_id=user["id"], role=user["role"]),
        username=user.get("username"),
        weight=user.get("weight"),
        category=user.get("category"),
    )


@router.post("/register-role", response_model=TokenResponse, status_code=201)
async def register_role(
    payload: AdminRegisterRoleRequest,
    _: dict = Depends(require_roles(Role.ADMIN)),
) -> TokenResponse:
    # Administrative creation of staff, judges, competitors, or other admins
    if payload.role not in {Role.ADMIN, Role.STAFF, Role.JUDGE, Role.COMPETITOR}:
        raise HTTPException(status_code=400, detail="Rol operativo invalido")

    # Check if user already exists by alias or username
    existing_alias = store.get_user_by_alias(payload.alias)
    if existing_alias:
        raise HTTPException(status_code=400, detail="El alias ya esta registrado")

    existing_username = store.get_user_by_username(payload.username)
    if existing_username:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya esta registrado")

    user_id = uuid4()
    user = {
        "id": user_id,
        "alias": payload.alias.strip(),
        "role": payload.role,
        "status": UserStatus.ACTIVE,
        "created_at": datetime.now(UTC),
        "last_check_in_at": None,
        "last_check_out_at": None,
        "username": payload.username.strip(),
        "password_hash": hash_password(payload.password),
        "weight": payload.weight,
        "category": payload.category,
    }
    user = store.create_user(user)

    return TokenResponse(
        user_id=user_id,
        alias=user["alias"],
        role=user["role"],
        access_token=create_access_token(user_id=user_id, role=user["role"]),
        username=user["username"],
        weight=user["weight"],
        category=user["category"],
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

    if payload.username is not None:
        username_clean = payload.username.strip()
        if username_clean != user.get("username"):
            existing = store.get_user_by_username(username_clean)
            if existing:
                raise HTTPException(status_code=400, detail="El nombre de usuario ya esta registrado")
            values["username"] = username_clean

    if payload.password is not None:
        password_clean = payload.password.strip()
        if password_clean:
            values["password_hash"] = hash_password(password_clean)

    if payload.weight is not None:
        values["weight"] = payload.weight

    if payload.category is not None:
        values["category"] = payload.category

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

