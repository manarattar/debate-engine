import os

from app.config import get_settings
from app.database import create_tables
from app.routers import debate, factcheck, human_debate, reaction, vote
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Debate Engine API")

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=_settings.cors_origins_list != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(debate.router, prefix="/api")
app.include_router(human_debate.router, prefix="/api")
app.include_router(factcheck.router, prefix="/api")
app.include_router(vote.router, prefix="/api")
app.include_router(reaction.router, prefix="/api")


@app.on_event("startup")
def startup():
    os.makedirs("./data", exist_ok=True)
    create_tables()


@app.get("/api/health")
def health():
    return {"status": "ok"}
