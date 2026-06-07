import sentry_sdk
from app.config import get_settings
from app.database import create_tables
from app.routers import (debate, export_pdf, factcheck, graph, human_debate,
                         reaction, vote)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_settings = get_settings()

if _settings.sentry_dsn:
    sentry_sdk.init(dsn=_settings.sentry_dsn, traces_sample_rate=0.1)

app = FastAPI(title="Munazara API")

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
app.include_router(export_pdf.router, prefix="/api")
app.include_router(graph.router, prefix="/api")


@app.on_event("startup")
def startup():
    create_tables()


@app.get("/api/health")
def health():
    return {"status": "ok"}
