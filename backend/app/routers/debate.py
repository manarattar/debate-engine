import json
import time
import uuid
from collections import defaultdict

from app.database import ArgumentReaction, Debate, Vote, get_db
from app.dependencies.auth import get_current_user
from app.schemas import DebateRequest
from app.services.debate_orchestrator import run_debate
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

router = APIRouter()

# Simple in-memory rate limit: 3 debates per user per hour
_RATE_LIMIT = 3
_RATE_WINDOW = 3600
_user_timestamps: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(user_id: str) -> None:
    now = time.time()
    window_start = now - _RATE_WINDOW
    timestamps = [t for t in _user_timestamps[user_id] if t > window_start]
    _user_timestamps[user_id] = timestamps
    if len(timestamps) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: {_RATE_LIMIT} debates per hour. Try again later.",
        )
    _user_timestamps[user_id].append(now)


@router.post("/debate")
async def start_debate(
    request: DebateRequest,
    db: Session = Depends(get_db),
    _user_id: str = Depends(get_current_user),
):
    _check_rate_limit(_user_id)
    debate_id = request.debate_id or str(uuid.uuid4())[:8]
    db_debate = Debate(id=debate_id, topic=request.topic, status="processing")
    db.add(db_debate)
    db.commit()

    capture: dict = {}

    async def stream():
        saved = False
        async for chunk in run_debate(
            debate_id,
            request.topic,
            capture,
            pro_persona=request.pro_persona,
            con_persona=request.con_persona,
        ):
            if not saved and "result" in capture:
                db.query(Debate).filter(Debate.id == debate_id).update(
                    {
                        "status": "complete",
                        "result_json": json.dumps(capture["result"]),
                    }
                )
                db.commit()
                saved = True
            yield chunk

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/debate/{debate_id}")
def get_debate(debate_id: str, db: Session = Depends(get_db)):
    debate = db.query(Debate).filter(Debate.id == debate_id).first()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != "complete" or not debate.result_json:
        return {"debate_id": debate_id, "status": debate.status}

    new_view_count = (debate.view_count or 0) + 1
    db.query(Debate).filter(Debate.id == debate_id).update(
        {"view_count": new_view_count}
    )
    db.commit()

    result = json.loads(debate.result_json)
    result["view_count"] = new_view_count
    return result


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    debates = (
        db.query(Debate)
        .filter(Debate.status == "complete")
        .order_by(Debate.created_at.desc())
        .limit(50)
        .all()
    )
    results = []
    for d in debates:
        winner = "unknown"
        if d.result_json:
            try:
                winner = json.loads(d.result_json).get("winner", "unknown")
            except Exception:
                pass
        results.append(
            {
                "debate_id": d.id,
                "topic": d.topic,
                "winner": winner,
                "view_count": d.view_count or 0,
                "created_at": d.created_at.isoformat() if d.created_at else "",
            }
        )
    return results


@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    """Top 10 debates by engagement: votes + reactions + views."""
    vote_counts = (
        db.query(Vote.debate_id, func.count(Vote.id).label("votes"))
        .group_by(Vote.debate_id)
        .subquery()
    )
    reaction_counts = (
        db.query(
            ArgumentReaction.debate_id,
            func.count(ArgumentReaction.id).label("reactions"),
        )
        .group_by(ArgumentReaction.debate_id)
        .subquery()
    )

    debates = db.query(Debate).filter(Debate.status == "complete").limit(100).all()

    # Build a lookup for vote + reaction counts
    vote_map = {r.debate_id: r.votes for r in db.query(vote_counts).all()}
    reaction_map = {r.debate_id: r.reactions for r in db.query(reaction_counts).all()}

    entries = []
    for d in debates:
        winner = "unknown"
        if d.result_json:
            try:
                winner = json.loads(d.result_json).get("winner", "unknown")
            except Exception:
                pass
        votes = vote_map.get(d.id, 0)
        reactions = reaction_map.get(d.id, 0)
        views = d.view_count or 0
        score = votes * 3 + reactions * 2 + views
        entries.append(
            {
                "debate_id": d.id,
                "topic": d.topic,
                "winner": winner,
                "votes": votes,
                "reactions": reactions,
                "views": views,
                "score": score,
                "created_at": d.created_at.isoformat() if d.created_at else "",
            }
        )

    entries.sort(key=lambda x: x["score"], reverse=True)
    return entries[:10]
