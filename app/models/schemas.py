from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class Role(StrEnum):
    USER = "user"
    ADMIN = "admin"
    STAFF = "staff"
    JUDGE = "judge"
    COMPETITOR = "competitor"


class UserStatus(StrEnum):
    INACTIVE = "inactive"
    ACTIVE = "active"


class Modality(StrEnum):
    STATIC = "static"
    DYNAMIC = "dynamic"


class ExpressRegisterRequest(BaseModel):
    alias: str = Field(..., min_length=2, max_length=40)


class ExpressRegisterResponse(BaseModel):
    user_id: UUID
    alias: str
    role: Role
    status: UserStatus
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    qr_payload: str


class StaffLoginRequest(BaseModel):
    access_code: str = Field(..., min_length=6, max_length=80)
    alias: str = Field(default="Staff", min_length=2, max_length=40)
    role: Role = Role.STAFF


class TokenResponse(BaseModel):
    user_id: UUID
    alias: str
    role: Role
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class CheckRequest(BaseModel):
    user_id: UUID
    reason: str | None = Field(default=None, max_length=120)


class AttendanceResponse(BaseModel):
    user_id: UUID
    alias: str
    status: UserStatus
    checked_at: datetime
    active_users: int


class HypeRequest(BaseModel):
    event_id: str = Field(..., min_length=1, max_length=64)
    clicks: int = Field(default=1, ge=1, le=25)


class HypeResponse(BaseModel):
    event_id: str
    user_id: UUID
    total_hype: int


class TriviaAnswerRequest(BaseModel):
    trivia_id: str
    answer_id: str


class JudgeScoreInput(BaseModel):
    coordination: float = Field(..., ge=0, le=10)
    strength: float = Field(..., ge=0, le=10)
    endurance: float = Field(..., ge=0, le=10)
    flexibility: float = Field(..., ge=0, le=10)


class FinalScoreInput(BaseModel):
    modality: Modality
    judge_scores: list[JudgeScoreInput] = Field(..., min_length=1)
    public_score: float = Field(..., ge=0, le=10)


class FinalScoreResponse(BaseModel):
    modality: Modality
    judges_component: float
    public_component: float
    final_score: float
