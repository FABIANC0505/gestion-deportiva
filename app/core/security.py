from datetime import UTC, datetime, timedelta
from uuid import UUID
import bcrypt

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.store import store
from app.models.schemas import Role, UserStatus


SECRET_KEY = settings.jwt_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 30

bearer_scheme = HTTPBearer(auto_error=True)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not hashed or not password:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: UUID, role: Role) -> str:
    expires_at = datetime.now(UTC) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "exp": expires_at,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
        ) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    payload = decode_token(credentials.credentials)
    user = store.get_user(UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


def require_roles(*roles: Role):
    allowed = set(roles)

    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="Permisos insuficientes")
        return user

    return dependency


def require_active_public_user(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != Role.USER:
        raise HTTPException(status_code=403, detail="Solo usuarios publicos")
    if user["status"] != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Usuario fuera del recinto")
    return user
