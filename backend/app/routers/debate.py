from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db, Debate
from app.schemas import DebateRequest, DebateResult
from app.services.debate_orchestrator import run_debate
import uuid
import json

router = APIRouter()


@router.post("/debate")
async def start_debate(request: DebateRequest, db: Session = Depends(get_db)):
    debate_id = str(uuid.uuid4())[:8]
    db_debate = Debate(id=debate_id, topic=request.topic, status="processing")
    db.add(db_debate)
    db.commit()

    async def stream():
        result_data = None
        async for chunk in run_debate(debate_id, request.topic):
            yield chunk
            # capture last complete event for DB save
            try:
                parsed = json.loads(chunk.replace("data: ", "").strip())
                if parsed.get("type") == "complete":
                    result_data = parsed["data"].get("result")
            except Exception:
                pass

        # Save result to DB
        db_debate.status = "complete"
        if result_data:
            db_debate.result_json = json.dumps(result_data)
        db.commit()

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/debate/{debate_id}")
def get_debate(debate_id: str, db: Session = Depends(get_db)):
    debate = db.query(Debate).filter(Debate.id == debate_id).first()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != "complete" or not debate.result_json:
        return {"debate_id": debate_id, "status": debate.status}
    return json.loads(debate.result_json)


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    debates = db.query(Debate).filter(Debate.status == "complete").order_by(Debate.created_at.desc()).limit(20).all()
    results = []
    for d in debates:
        winner = "unknown"
        if d.result_json:
            try:
                winner = json.loads(d.result_json).get("winner", "unknown")
            except Exception:
                pass
        results.append({
            "debate_id": d.id,
            "topic": d.topic,
            "winner": winner,
            "created_at": d.created_at.isoformat() if d.created_at else "",
        })
    return results
