import json
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import settings


class SupabaseRestError(RuntimeError):
    pass


class SupabaseRestClient:
    def __init__(self) -> None:
        if not settings.supabase_enabled:
            raise SupabaseRestError("Supabase no esta configurado")

        self.base_url = settings.supabase_url.rstrip("/")
        self.headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    def select(self, table: str, filters: dict[str, str] | None = None, select: str = "*") -> list[dict]:
        params = {"select": select}
        if filters:
            params.update(filters)
        return self._request("GET", table, query=params)

    def insert(self, table: str, payload: dict) -> dict:
        rows = self._request("POST", table, payload=payload, extra_headers={"Prefer": "return=representation"})
        return rows[0] if rows else payload

    def update(self, table: str, filters: dict[str, str], payload: dict) -> dict:
        rows = self._request(
            "PATCH",
            table,
            query=filters,
            payload=payload,
            extra_headers={"Prefer": "return=representation"},
        )
        return rows[0] if rows else payload

    def delete(self, table: str, filters: dict[str, str]) -> list[dict]:
        return self._request("DELETE", table, query=filters)


    def _request(
        self,
        method: str,
        table: str,
        query: dict[str, str] | None = None,
        payload: dict | None = None,
        extra_headers: dict[str, str] | None = None,
    ):
        url = f"{self.base_url}/rest/v1/{table}"
        if query:
            url = f"{url}?{urlencode(query)}"

        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(url, data=data, method=method, headers={**self.headers, **(extra_headers or {})})

        try:
            with urlopen(request, timeout=10) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8")
            raise SupabaseRestError(f"Supabase {method} {table} fallo: {exc.code} {detail}") from exc

        return json.loads(body) if body else []


def create_supabase_client() -> SupabaseRestClient | None:
    if not settings.supabase_enabled:
        return None
    return SupabaseRestClient()
