import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.database import Debate
from app.main import app
from app.schemas import Argument, DebateResult, Side
from app.services import debate_orchestrator, jev_judge
from app.services.scorecard import CRITERIA, compute_scorecard_from_probabilities


def probabilities(pro, con, even=0, confidence=0.5):
    return {key: {"PRO": pro, "CON": con, "EVEN": even, "confidence": confidence}
            for key, _, _ in CRITERIA}


@pytest.mark.parametrize("pro,con,even,band,winner", [
    (0.5, 0.5, 0, "too_close", "tie"),
    (0.54, 0.46, 0, "too_close", "tie"),
    (0.58, 0.42, 0, "narrow", "pro"),
    (0.65, 0.35, 0, "clear", "pro"),
    (0.9, 0.1, 0, "decisive", "pro"),
    (0.1, 0.9, 0, "decisive", "con"),
])
def test_bands(pro, con, even, band, winner):
    card = compute_scorecard_from_probabilities(probabilities(pro, con, even), {"model": "jev-latest", "latency_ms": 2})
    assert card["confidence"] == band and card["winner"] == winner
    assert card["pro_total"] + card["con_total"] == 10
    assert card["margin"] == pytest.approx(abs(card["pro_total"] - card["con_total"]))


def test_even_low_confidence_and_missing():
    card = compute_scorecard_from_probabilities({"evidence": {"PRO": 0.2, "CON": 0.2, "EVEN": 0.6, "confidence": 0.03}}, {})
    assert card["criteria"][0]["leader"] == "even"
    assert card["criteria"][0]["pro"] == card["criteria"][0]["con"] == 5
    assert card["criteria"][0]["weight"] == 1
    assert compute_scorecard_from_probabilities({}, {}) is None
    assert compute_scorecard_from_probabilities(probabilities(0.9, 0.1, confidence=0.03), {})["confidence"] == "narrow"


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self.data


class FakeClient:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def post(self, url, headers, json):
        self.calls.append(json)
        swapped = "PRO: con case" in json["state"]["debate"]
        response = self.responses[swapped]
        if isinstance(response, Exception):
            raise response
        return FakeResponse(response)


def response(pro, con, even=0.1):
    return {"model": "jev-latest", "answers": {
        key: {"probabilities": {"PRO": pro, "CON": con, "EVEN": even}, "confidence": 0.6}
        for key, _, _ in CRITERIA}}


def run_fake(monkeypatch, normal, swapped):
    client = FakeClient({False: normal, True: swapped})
    monkeypatch.setattr(jev_judge, "get_settings", lambda: Settings(_env_file=None, typesafe_api_key="fake"))
    monkeypatch.setattr(jev_judge.httpx, "Client", lambda **kwargs: client)
    pro = [Argument(side=Side.pro, round_name="opening", content="pro case")]
    con = [Argument(side=Side.con, round_name="opening", content="con case")]
    return jev_judge.judge_jev("topic", pro, con), client


def test_swap_and_disagreement(monkeypatch):
    card, client = run_fake(monkeypatch, response(0.8, 0.1), response(0.1, 0.8))
    assert card["winner"] == "pro" and card["criteria"][0]["probabilities"]["PRO"] == 0.8
    assert len(client.calls) == 2
    assert next(c for c in client.calls if "PRO: con case" in c["state"]["debate"])["questions"]["evidence"]["criteria"] == {
        "CON": "CON was stronger on this", "PRO": "PRO was stronger on this", "EVEN": "Neither side was clearly stronger"}
    card, _ = run_fake(monkeypatch, response(1, 0, 0), response(0.51, 0.49, 0))
    assert card["confidence"] == "narrow"


def test_failures(monkeypatch):
    card, _ = run_fake(monkeypatch, response(0.9, 0), RuntimeError("failed"))
    assert card["winner"] == "pro" and card["confidence"] == "narrow"
    card, _ = run_fake(monkeypatch, RuntimeError("failed"), RuntimeError("failed"))
    assert card is None


def test_no_key_never_constructs_client(monkeypatch):
    monkeypatch.setattr(jev_judge, "get_settings", lambda: Settings(_env_file=None, typesafe_api_key=""))
    monkeypatch.setattr(jev_judge.httpx, "Client", lambda **kwargs: pytest.fail("httpx touched"))
    assert jev_judge.judge_jev("topic", [], []) is None


def test_orchestrator_fallback(monkeypatch):
    rubric = {"method": "llm-rubric", "winner": "pro"}
    monkeypatch.setattr(debate_orchestrator, "jev_available", lambda: False)
    monkeypatch.setattr(debate_orchestrator, "judge_jev", lambda *args: pytest.fail("Jev called"))
    monkeypatch.setattr(debate_orchestrator, "judge_scorecard", lambda *args: rubric)
    assert debate_orchestrator._judge_with_fallback("topic", [], []) == rubric
    monkeypatch.setattr(debate_orchestrator, "jev_available", lambda: True)
    monkeypatch.setattr(debate_orchestrator, "judge_jev", lambda *args: None)
    assert debate_orchestrator._judge_with_fallback("topic", [], []) == rubric


def test_saved_jev_round_trip(db_session):
    card = compute_scorecard_from_probabilities(probabilities(0.8, 0.1, 0.1), {"model": "jev-latest", "latency_ms": 7})
    verdict = Argument(side=Side.judge, round_name="verdict", content="WINNER: PRO")
    result = DebateResult(debate_id="jev-saved", topic="Topic", pro_arguments=[], con_arguments=[],
                          verdict=verdict, pro_sources=[], con_sources=[], winner="pro", scorecard=card)
    db_session.add(Debate(id="jev-saved", topic="Topic", status="complete", result_json=result.model_dump_json()))
    db_session.commit()
    saved = TestClient(app).get("/api/debate/jev-saved")
    assert saved.status_code == 200
    assert saved.json()["scorecard"] == card
