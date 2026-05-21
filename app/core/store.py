from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass
class InMemoryStore:
    users: dict[UUID, dict] = field(default_factory=dict)
    attendance: list[dict] = field(default_factory=list)
    hype_by_event: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    hype_by_user: dict[tuple[str, UUID], int] = field(default_factory=lambda: defaultdict(int))
    active_trivias: dict[str, dict] = field(default_factory=dict)
    trivia_answers: list[dict] = field(default_factory=list)
    votes: list[dict] = field(default_factory=list)

    def active_user_count(self) -> int:
        return sum(1 for user in self.users.values() if user["status"] == "active")

    def mark_attendance(self, user_id: UUID, action: str, at: datetime, by: UUID | None, reason: str | None) -> None:
        self.attendance.append(
            {
                "user_id": user_id,
                "action": action,
                "timestamp": at,
                "scanned_by": by,
                "reason": reason,
            }
        )


store = InMemoryStore()
