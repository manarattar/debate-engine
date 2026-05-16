from app.database import Vote, get_db
from app.schemas import VoteRequest, VoteResult, VoteTally
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter()


@router.post("/vote")
def submit_vote(request: VoteRequest, db: Session = Depends(get_db)):
    existing = (
        db.query(Vote)
        .filter(
            Vote.debate_id == request.debate_id,
            Vote.phase == request.phase,
            Vote.session_id == request.session_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already voted in this phase")

    db.add(
        Vote(
            debate_id=request.debate_id,
            phase=request.phase,
            side=request.side,
            session_id=request.session_id,
        )
    )
    db.commit()
    return {"status": "ok"}


@router.get("/vote/{debate_id}", response_model=VoteResult)
def get_votes(debate_id: str, db: Session = Depends(get_db)):
    def _tally(phase: str) -> VoteTally:
        rows = (
            db.query(Vote)
            .filter(Vote.debate_id == debate_id, Vote.phase == phase)
            .all()
        )
        pro = sum(1 for r in rows if r.side == "pro")
        con = sum(1 for r in rows if r.side == "con")
        return VoteTally(pro=pro, con=con, total=pro + con)

    return VoteResult(
        debate_id=debate_id,
        before=_tally("before"),
        after=_tally("after"),
    )
