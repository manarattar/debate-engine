import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, Debate, FactCheck
from app.schemas import FactCheckReport
from app.services.fact_checker import run_fact_check

router = APIRouter()


@router.post("/factcheck/{debate_id}", response_model=FactCheckReport)
def create_fact_check(debate_id: str, db: Session = Depends(get_db)):
    # Return cached result if available
    cached = db.query(FactCheck).filter(FactCheck.debate_id == debate_id).first()
    if cached:
        return FactCheckReport.model_validate(json.loads(cached.result_json))

    debate = db.query(Debate).filter(Debate.id == debate_id).first()
    if not debate:
        raise HTTPException(404, "Debate not found")
    if not debate.result_json:
        raise HTTPException(400, "Debate result not available yet")

    result = json.loads(debate.result_json)
    topic = result.get("topic", "")
    pro_content = "\n\n".join(a["content"] for a in result.get("pro_arguments", []))
    con_content = "\n\n".join(a["content"] for a in result.get("con_arguments", []))

    report = run_fact_check(debate_id, topic, pro_content, con_content)

    db.add(FactCheck(debate_id=debate_id, result_json=report.model_dump_json()))
    db.commit()

    return report


@router.get("/factcheck/{debate_id}", response_model=FactCheckReport)
def get_fact_check(debate_id: str, db: Session = Depends(get_db)):
    cached = db.query(FactCheck).filter(FactCheck.debate_id == debate_id).first()
    if not cached:
        raise HTTPException(404, "Fact check not found — run POST first")
    return FactCheckReport.model_validate(json.loads(cached.result_json))
