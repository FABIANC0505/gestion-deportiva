from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.core.store import store
from app.models.schemas import Role

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self) -> None:
        self.dashboard_connections: set[WebSocket] = set()
        self.public_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, role: Role) -> None:
        await websocket.accept()
        if role in {Role.ADMIN, Role.STAFF, Role.JUDGE}:
            self.dashboard_connections.add(websocket)
            await websocket.send_json(
                {
                    "type": "snapshot",
                    "active_users": store.active_user_count(),
                    "hype": dict(store.hype_by_event),
                }
            )
        else:
            self.public_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.dashboard_connections.discard(websocket)
        self.public_connections.discard(websocket)

    async def broadcast_dashboard(self, message: dict) -> None:
        stale: list[WebSocket] = []
        for connection in self.dashboard_connections:
            try:
                await connection.send_json(message)
            except RuntimeError:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)

    async def broadcast_public(self, message: dict) -> None:
        stale: list[WebSocket] = []
        for connection in self.public_connections:
            try:
                await connection.send_json(message)
            except RuntimeError:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = decode_token(token)
        role = Role(payload["role"])
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, role)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
