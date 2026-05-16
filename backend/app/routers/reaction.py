from collections import defaultdict

from app.database import ArgumentReaction, get_db
from app.schemas import ArgumentReactionTally, ReactionRequest, ReactionResult
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter()


@router.post("/reaction", status_code=200)
def submit_reaction(req: ReactionRequest, db: Session = Depends(get_db)):
    existing = (
        db.query(ArgumentReaction)
        .filter_by(
            debate_id=req.debate_id,
            side=req.side,
            round_name=req.round_name,
            session_id=req.session_id,
        )
        .first()
    )
    if existing:
        if existing.reaction == req.reaction:
            # Toggle off — delete the reaction
            db.delete(existing)
            db.commit()
            return {"status": "removed"}
        else:
            # Switch reaction
            existing.reaction = req.reaction
            db.commit()
            return {"status": "updated"}

    db.add(
        ArgumentReaction(
            debate_id=req.debate_id,
            side=req.side,
            round_name=req.round_name,
            reaction=req.reaction,
            session_id=req.session_id,
        )
    )
    db.commit()
    return {"status": "ok"}


@router.get("/reaction/{debate_id}", response_model=ReactionResult)
def get_reactions(debate_id: str, db: Session = Depends(get_db)):
    rows = db.query(ArgumentReaction).filter_by(debate_id=debate_id).all()
    tallies: dict[str, dict[str, int]] = defaultdict(
        lambda: {"likes": 0, "dislikes": 0}
    )
    for row in rows:
        key = f"{row.side}_{row.round_name}"
        if row.reaction == "like":
            tallies[key]["likes"] += 1
        else:
            tallies[key]["dislikes"] += 1
    return ReactionResult(
        debate_id=debate_id,
        reactions={k: ArgumentReactionTally(**v) for k, v in tallies.items()},
    )
