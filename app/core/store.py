from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from app.core.config import settings
from app.core.supabase import create_supabase_client
from app.models.schemas import Role, UserStatus


def _serialize(value):
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (Role, UserStatus)):
        return value.value
    return value


def _serialize_row(row: dict) -> dict:
    return {key: _serialize(value) for key, value in row.items()}


def _normalize_user(row: dict) -> dict:
    normalized = dict(row)
    normalized["id"] = UUID(str(normalized["id"]))
    normalized["role"] = Role(normalized["role"])
    normalized["status"] = UserStatus(normalized["status"])
    normalized["username"] = normalized.get("username")
    normalized["password_hash"] = normalized.get("password_hash")
    if "weight" in normalized and normalized["weight"] is not None:
        normalized["weight"] = float(normalized["weight"])
    else:
        normalized["weight"] = None
    normalized["category"] = normalized.get("category")
    return normalized


@dataclass
class InMemoryStore:
    users: dict[UUID, dict] = field(default_factory=dict)
    attendance: list[dict] = field(default_factory=list)
    hype_by_event: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    hype_by_user: dict[tuple[str, UUID], int] = field(default_factory=lambda: defaultdict(int))
    active_trivias: dict[str, dict] = field(default_factory=dict)
    trivia_answers: list[dict] = field(default_factory=list)
    votes: list[dict] = field(default_factory=list)
    competitor_scores: dict[UUID, dict] = field(default_factory=dict)
    active_competitor: dict | None = None
    favorite_votes: dict[UUID, UUID] = field(default_factory=dict)
    prize_votes: dict[UUID, str] = field(default_factory=dict)
    active_poll: dict | None = None
    poll_votes: list[dict] = field(default_factory=list)
    global_hype_count: int = 0
    supabase: object | None = field(default_factory=create_supabase_client)

    @property
    def persistent(self) -> bool:
        return self.supabase is not None

    def create_user(self, user: dict) -> dict:
        if self.supabase:
            created = self.supabase.insert(settings.supabase_users_table, _serialize_row(user))
            return _normalize_user(created)

        self.users[user["id"]] = user
        return user

    def get_user(self, user_id: UUID) -> dict | None:
        if self.supabase:
            rows = self.supabase.select(settings.supabase_users_table, {"id": f"eq.{user_id}"}, select="*")
            return _normalize_user(rows[0]) if rows else None

        return self.users.get(user_id)

    def get_user_by_alias(self, alias: str) -> dict | None:
        if self.supabase:
            rows = self.supabase.select(settings.supabase_users_table, {"alias": f"eq.{alias}"}, select="*")
            return _normalize_user(rows[0]) if rows else None
        return next((u for u in self.users.values() if u["alias"].lower() == alias.strip().lower()), None)

    def get_user_by_username(self, username: str) -> dict | None:
        if self.supabase:
            rows = self.supabase.select(settings.supabase_users_table, {"username": f"eq.{username}"}, select="*")
            return _normalize_user(rows[0]) if rows else None
        return next((u for u in self.users.values() if u.get("username") and u["username"].lower() == username.strip().lower()), None)

    def list_users(self) -> list[dict]:
        if self.supabase:
            rows = self.supabase.select(settings.supabase_users_table, select="*")
            return [_normalize_user(r) for r in rows]
        return list(self.users.values())

    def delete_user(self, user_id: UUID) -> bool:
        if self.supabase:
            try:
                self.supabase.delete(settings.supabase_users_table, {"id": f"eq.{user_id}"})
                return True
            except Exception:
                return False
        if user_id in self.users:
            del self.users[user_id]
            return True
        return False

    def count_admins(self) -> int:
        if self.supabase:
            rows = self.supabase.select(
                settings.supabase_users_table,
                {"role": f"eq.{Role.ADMIN.value}"},
                select="id",
            )
            return len(rows)
        return sum(1 for user in self.users.values() if user["role"] == Role.ADMIN)

    def update_user(self, user_id: UUID, values: dict) -> dict | None:
        if self.supabase:
            updated = self.supabase.update(
                settings.supabase_users_table,
                {"id": f"eq.{user_id}"},
                _serialize_row(values),
            )
            return _normalize_user(updated)

        user = self.users.get(user_id)
        if not user:
            return None
        user.update(values)
        return user

    def active_user_count(self) -> int:
        if self.supabase:
            rows = self.supabase.select(
                settings.supabase_users_table,
                {"role": f"eq.{Role.USER.value}", "status": f"eq.{UserStatus.ACTIVE.value}"},
                select="id",
            )
            return len(rows)

        return sum(
            1 for user in self.users.values()
            if user["status"] == UserStatus.ACTIVE and user["role"] == Role.USER
        )

    def mark_attendance(self, user_id: UUID, action: str, at: datetime, by: UUID | None, reason: str | None) -> None:
        record = {
            "user_id": user_id,
            "action": action,
            "timestamp": at,
            "scanned_by": by,
            "reason": reason,
        }
        if self.supabase:
            self.supabase.insert(settings.supabase_attendance_table, _serialize_row(record))
            return

        self.attendance.append(
            record
        )


store = InMemoryStore()
