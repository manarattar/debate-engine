from pydantic import BaseModel
from typing import Optional
from enum import Enum


class Side(str, Enum):
    pro = "pro"
    con = "con"
    judge = "judge"


class Citation(BaseModel):
    index: int
    title: str
    url: str
    excerpt: str


class Argument(BaseModel):
    side: Side
    round_name: str  # opening / rebuttal / closing / verdict
    content: str
    citations: list[Citation] = []


class DebateRequest(BaseModel):
    topic: str


class DebateResult(BaseModel):
    debate_id: str
    topic: str
    pro_arguments: list[Argument]
    con_arguments: list[Argument]
    verdict: Argument
    pro_sources: list[Citation]
    con_sources: list[Citation]
    winner: str  # "pro" / "con" / "tie"


class DebateSummary(BaseModel):
    debate_id: str
    topic: str
    winner: str
    created_at: str


class SSEEvent(BaseModel):
    type: str
    data: dict | str


class HumanDebateStartRequest(BaseModel):
    topic: str
    human_side: str  # "pro" | "con"


class HumanDebateStartResponse(BaseModel):
    session_id: str
    status: str


class HumanDebateStatusResponse(BaseModel):
    session_id: str
    status: str
    error_message: Optional[str] = None


class HumanArgumentRequest(BaseModel):
    content: str
