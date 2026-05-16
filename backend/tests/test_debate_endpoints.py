"""Tests for debate GET, history, and leaderboard endpoints."""
import json

from fastapi.testclient import TestClient

from app.database import ArgumentReaction, Debate, Vote
from app.main import app

client = TestClient(app)

RESULT = {
    "topic": "AI ethics",
    "winner": "pro",
    "pro_arguments": [],
    "con_arguments": [],
    "verdict": {"content": "PRO wins.\nWINNER: PRO", "citations": []},
}


class TestViewCount:
    def test_view_count_increments_on_fetch(self, db_session):
        db_session.add(
            Debate(
                id="v001", topic="AI", status="complete", result_json=json.dumps(RESULT)
            )
        )
        db_session.commit()

        client.get("/api/debate/v001")
        client.get("/api/debate/v001")
        res = client.get("/api/debate/v001")
        assert res.json()["view_count"] == 3

    def test_view_count_in_history(self, db_session):
        db_session.add(
            Debate(
                id="v002",
                topic="AI ethics",
                status="complete",
                result_json=json.dumps(RESULT),
            )
        )
        db_session.commit()
        client.get("/api/debate/v002")

        history = client.get("/api/history").json()
        entry = next((h for h in history if h["debate_id"] == "v002"), None)
        assert entry is not None
        assert entry["view_count"] == 1

    def test_processing_debate_does_not_count_view(self, db_session):
        db_session.add(Debate(id="v003", topic="AI", status="processing"))
        db_session.commit()
        res = client.get("/api/debate/v003")
        assert res.json()["status"] == "processing"

        row = db_session.query(Debate).filter_by(id="v003").first()
        assert (row.view_count or 0) == 0


class TestLeaderboard:
    def _seed(self, db_session, debate_id, topic, votes=0, reactions=0, views=0):
        db_session.add(
            Debate(
                id=debate_id,
                topic=topic,
                status="complete",
                result_json=json.dumps({**RESULT, "topic": topic}),
                view_count=views,
            )
        )
        for i in range(votes):
            db_session.add(
                Vote(
                    debate_id=debate_id,
                    phase="before",
                    side="pro",
                    session_id=f"s{i}_{debate_id}",
                )
            )
        for i in range(reactions):
            db_session.add(
                ArgumentReaction(
                    debate_id=debate_id,
                    side="pro",
                    round_name="opening",
                    reaction="like",
                    session_id=f"r{i}_{debate_id}",
                )
            )
        db_session.commit()

    def test_leaderboard_returns_list(self, db_session):
        self._seed(db_session, "lb001", "Topic A")
        res = client.get("/api/leaderboard")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_leaderboard_sorted_by_score(self, db_session):
        self._seed(db_session, "lb002", "Low engagement", votes=1)
        self._seed(
            db_session, "lb003", "High engagement", votes=5, reactions=3, views=10
        )
        entries = client.get("/api/leaderboard").json()
        ids = [e["debate_id"] for e in entries]
        assert ids.index("lb003") < ids.index("lb002")

    def test_leaderboard_capped_at_10(self, db_session):
        for i in range(12):
            self._seed(db_session, f"lb1{i:02d}", f"Topic {i}", views=i)
        entries = client.get("/api/leaderboard").json()
        assert len(entries) <= 10

    def test_leaderboard_includes_engagement_fields(self, db_session):
        self._seed(db_session, "lb020", "AI safety", votes=2, reactions=1, views=5)
        entries = client.get("/api/leaderboard").json()
        entry = next(e for e in entries if e["debate_id"] == "lb020")
        assert entry["votes"] == 2
        assert entry["reactions"] == 1
        assert entry["views"] == 5

    def test_empty_leaderboard_returns_empty_list(self):
        res = client.get("/api/leaderboard")
        assert res.status_code == 200
        assert res.json() == []
