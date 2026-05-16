from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator


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
    debate_id: Optional[str] = None
    pro_persona: Optional[str] = None
    con_persona: Optional[str] = None

    @field_validator("topic")
    @classmethod
    def topic_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Topic cannot be empty")
        if len(v) > 300:
            raise ValueError("Topic must be 300 characters or fewer")
        return v


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

    @field_validator("content")
    @classmethod
    def content_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Argument cannot be empty")
        if len(v) > 1200:
            raise ValueError("Argument must be 1200 characters or fewer")
        return v


class VoteRequest(BaseModel):
    debate_id: str
    phase: str  # "before" | "after"
    side: str  # "pro" | "con"
    session_id: str

    @field_validator("phase")
    @classmethod
    def phase_must_be_valid(cls, v: str) -> str:
        if v not in ("before", "after"):
            raise ValueError("phase must be 'before' or 'after'")
        return v

    @field_validator("side")
    @classmethod
    def side_must_be_valid(cls, v: str) -> str:
        if v not in ("pro", "con"):
            raise ValueError("side must be 'pro' or 'con'")
        return v


class VoteTally(BaseModel):
    pro: int
    con: int
    total: int


class VoteResult(BaseModel):
    debate_id: str
    before: VoteTally
    after: VoteTally


class ReactionRequest(BaseModel):
    debate_id: str
    side: str  # "pro" | "con"
    round_name: str
    reaction: str  # "like" | "dislike"
    session_id: str

    @field_validator("reaction")
    @classmethod
    def reaction_must_be_valid(cls, v: str) -> str:
        if v not in ("like", "dislike"):
            raise ValueError("reaction must be 'like' or 'dislike'")
        return v

    @field_validator("side")
    @classmethod
    def side_must_be_valid(cls, v: str) -> str:
        if v not in ("pro", "con"):
            raise ValueError("side must be 'pro' or 'con'")
        return v


class ArgumentReactionTally(BaseModel):
    likes: int
    dislikes: int


class ReactionResult(BaseModel):
    debate_id: str
    reactions: dict[str, ArgumentReactionTally]  # key: "{side}_{round_name}"


class FactCheckClaim(BaseModel):
    claim: str
    side: str  # "pro" | "con"
    verdict: str  # "verified" | "contested" | "misleading" | "unverifiable"
    confidence: str  # "High" | "Medium" | "Low"
    evidence: str
    sources: list[str]


class FactCheckReport(BaseModel):
    debate_id: str
    topic: str
    claims: list[FactCheckClaim]
    checked_at: str
