from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import attendance, auth, interaction, scoring, websocket
from app.core.store import store


app = FastAPI(
    title="WorkCalist API",
    description="Backend para eventos descentralizados de calistenia con acceso express por QR.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(attendance.router)
app.include_router(interaction.router)
app.include_router(scoring.router)
app.include_router(websocket.router)


@app.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "database": "supabase" if store.persistent else "memory",
    }
