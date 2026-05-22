from dataclasses import dataclass
from os import getenv

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    jwt_secret: str = getenv("WORKCALIST_JWT_SECRET", "change-me-with-a-real-secret-from-env")
    staff_access_code: str = getenv("WORKCALIST_STAFF_ACCESS_CODE", "STAFF-LOCAL-2026")
    supabase_url: str | None = getenv("SUPABASE_URL")
    supabase_service_role_key: str | None = getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase_users_table: str = getenv("SUPABASE_USERS_TABLE", "app_users")
    supabase_attendance_table: str = getenv("SUPABASE_ATTENDANCE_TABLE", "attendance_logs")

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


settings = Settings()
