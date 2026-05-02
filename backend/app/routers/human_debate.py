import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db, HumanDebate
from app.schemas import (
    HumanDebateStartRequest, HumanDebateStartResponse,
    HumanDebateStatusResponse, HumanArgumentRequest, Side,
)
from app.services.human_debate_service import (
    gather_sources_background,
    stream_ai_opening,
    stream_ai_rebuttal_and_verdict,
)

router = APIRouter()

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


@router.post("/human-debate/start", response_model=HumanDebateStartResponse)
def start_human_debate(
    request: HumanDebateStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if request.human_side not in ("pro", "con"):
        raise HTTPException(400, "human_side must be 'pro' or 'con'")

    session_id = str(uuid.uuid4())[:8]
    row = HumanDebate(
        id=session_id,
        topic=request.topic,
        human_side=request.human_side,
        status="gathering_sources",
    )
    db.add(row)
    db.commit()

    new_db = next(get_db())
    background_tasks.add_task(gather_sources_background, session_id, request.topic, new_db)

    return HumanDebateStartResponse(session_id=session_id, status="gathering_sources")


@router.get("/human-debate/{session_id}/status", response_model=HumanDebateStatusResponse)
def get_human_debate_status(session_id: str, db: Session = Depends(get_db)):
    row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
    if not row:
        raise HTTPException(404, "Session not found")
    return HumanDebateStatusResponse(
        session_id=row.id,
        status=row.status,
        error_message=row.error_message,
    )


@router.post("/human-debate/{session_id}/opening")
async def submit_opening(
    session_id: str,
    request: HumanArgumentRequest,
    db: Session = Depends(get_db),
):
    row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
    if not row:
        raise HTTPException(404, "Session not found")
    if row.status != "sources_ready":
        raise HTTPException(400, f"Sources not ready yet (status: {row.status})")

    row.human_opening = request.content
    row.status = "generating_ai_opening"
    db.commit()

    ai_side = Side.con if row.human_side == "pro" else Side.pro
    topic = row.topic

    async def stream():
        async for chunk in stream_ai_opening(session_id, topic, ai_side, db):
            yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/human-debate/{session_id}/rebuttal")
async def submit_rebuttal(
    session_id: str,
    request: HumanArgumentRequest,
    db: Session = Depends(get_db),
):
    row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
    if not row:
        raise HTTPException(404, "Session not found")
    if row.status != "ai_opening_done":
        raise HTTPException(400, f"Cannot submit rebuttal yet (status: {row.status})")

    row.human_rebuttal = request.content
    row.status = "generating_ai_rebuttal"
    db.commit()

    ai_side = Side.con if row.human_side == "pro" else Side.pro
    topic = row.topic
    human_opening = row.human_opening
    ai_opening = row.ai_opening

    async def stream():
        async for chunk in stream_ai_rebuttal_and_verdict(
            session_id, topic, ai_side,
            human_opening, ai_opening, request.content, db,
        ):
            yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
