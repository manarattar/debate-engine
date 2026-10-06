import json
from types import SimpleNamespace
from fastapi.testclient import TestClient

from app.database import Debate
from app.main import app
from app.schemas import Argument, DebateResult, Side
from app.services import debate_agent
from app.services.scorecard import compute_scorecard, merge_swapped


def raw(pro=8, con=6):
    return {key: {"pro": pro, "con": con} for key, _, _ in debate_agent.CRITERIA}


def test_weighted_totals_and_bands():
    scores = raw()
    scores["evidence"] = {"pro": 10, "con": 1}
    card = compute_scorecard(scores)
    assert card["pro_total"] == 8.6
    assert card["con_total"] == 4.5
    assert card["winner"] == "pro" and card["confidence"] == "decisive"
    assert compute_scorecard(raw(8, 6))["confidence"] == "clear"
    assert compute_scorecard(raw(7, 6))["confidence"] == "narrow"
    assert compute_scorecard(raw(7, 7))["confidence"] == "too_close"


def test_missing_clamping_and_empty():
    card = compute_scorecard({"evidence": {"pro": 99, "con": -3}, "unknown": {"pro": 1, "con": 1}})
    assert card["pro_total"] == 10 and card["con_total"] == 1
    assert card["criteria"][0]["weight"] == 1
    assert compute_scorecard({}) is None


def test_swap_merge_and_fallback():
    assert merge_swapped(raw(7, 5), raw(8, 6))["pro_total"] == 7.5
    assert merge_swapped(raw(10, 1), raw(1, 10))["confidence"] == "too_close"
    assert merge_swapped(None, raw())["winner"] == "pro"
    assert merge_swapped(None, None) is None


def test_transcript_round_order_and_caps():
    def arg(side, name, content):
        return Argument(side=side, round_name=name, content=content)
    pro = [arg(Side.pro, "opening", "pro open"), arg(Side.pro, "closing", "pro close")]
    con = [arg(Side.con, "opening", "con open"), arg(Side.con, "closing", "con close")]
    text = debate_agent.build_transcript(pro, con)
    assert text.index("pro open") < text.index("con open") < text.index("pro close") < text.index("con close")
    long = [arg(Side.pro, name, "x" * 2000) for name in ("opening", "rebuttal", "closing")]
    assert len(debate_agent.build_transcript(long, long)) <= 7000


def test_score_rubric_json_fence_and_garbage(monkeypatch):
    content = {"value": json.dumps(raw())}
    def create(**kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content["value"]))])
    monkeypatch.setattr(debate_agent, "_make_client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    assert debate_agent.score_rubric("topic", "transcript") == raw()
    content["value"] = "```json\n" + json.dumps(raw()) + "\n```"
    assert debate_agent.score_rubric("topic", "transcript") == raw()
    content["value"] = "garbage"
    assert debate_agent.score_rubric("topic", "transcript") is None


def test_judge_swap_check(monkeypatch):
    monkeypatch.setattr(debate_agent, "score_rubric", lambda topic, transcript: raw(8, 6) if transcript.startswith("PRO") else raw(6, 8))
    assert debate_agent.judge_scorecard("topic", "PRO: original")["winner"] == "pro"


def test_saved_debate_round_trip_and_old_defaults(db_session):
    verdict = Argument(side=Side.judge, round_name="verdict", content="WINNER: PRO")
    card = compute_scorecard(raw())
    result = DebateResult(debate_id="new", topic="Topic", pro_arguments=[], con_arguments=[],
                          verdict=verdict, pro_sources=[], con_sources=[], winner="pro",
                          scores={"pro_opening": 8}, scorecard=card)
    db_session.add(Debate(id="new", topic="Topic", status="complete", result_json=result.model_dump_json()))
    old = result.model_dump()
    old.pop("scores")
    old.pop("scorecard")
    db_session.add(Debate(id="old", topic="Topic", status="complete", result_json=json.dumps(old)))
    db_session.commit()
    client = TestClient(app)
    fresh = client.get("/api/debate/new")
    legacy = client.get("/api/debate/old")
    assert fresh.status_code == legacy.status_code == 200
    assert fresh.json()["scores"] == {"pro_opening": 8}
    assert fresh.json()["scorecard"] == card
    assert legacy.json()["scores"] == {} and legacy.json()["scorecard"] is None
