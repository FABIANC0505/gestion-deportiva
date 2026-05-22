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

        return sum(1 for user in self.users.values() if user["status"] == UserStatus.ACTIVE)

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
