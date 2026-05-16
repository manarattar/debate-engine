from app.database import ArgumentReaction, Base, get_db
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

PAYLOAD = {
    "debate_id": "abc123",
    "side": "pro",
    "round_name": "opening",
    "reaction": "like",
    "session_id": "sess1",
}


def _clear():
    db = TestingSessionLocal()
    db.query(ArgumentReaction).delete()
    db.commit()
    db.close()


class TestSubmitReaction:
    def setup_method(self):
        _clear()

    def test_like_returns_ok(self):
        res = client.post("/api/reaction", json=PAYLOAD)
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_toggle_off_same_reaction_removes_it(self):
        client.post("/api/reaction", json=PAYLOAD)
        res = client.post("/api/reaction", json=PAYLOAD)
        assert res.json()["status"] == "removed"

    def test_switch_reaction_updates_it(self):
        client.post("/api/reaction", json=PAYLOAD)
        switched = {**PAYLOAD, "reaction": "dislike"}
        res = client.post("/api/reaction", json=switched)
        assert res.json()["status"] == "updated"

    def test_invalid_reaction_rejected(self):
        bad = {**PAYLOAD, "reaction": "meh"}
        res = client.post("/api/reaction", json=bad)
        assert res.status_code == 422

    def test_invalid_side_rejected(self):
        bad = {**PAYLOAD, "side": "judge"}
        res = client.post("/api/reaction", json=bad)
        assert res.status_code == 422

    def test_different_sessions_can_react_independently(self):
        client.post("/api/reaction", json=PAYLOAD)
        other = {**PAYLOAD, "session_id": "sess2"}
        res = client.post("/api/reaction", json=other)
        assert res.json()["status"] == "ok"


class TestGetReactions:
    def setup_method(self):
        _clear()

    def test_empty_debate_returns_empty_reactions(self):
        res = client.get("/api/reaction/no_such_debate")
        assert res.status_code == 200
        assert res.json()["reactions"] == {}

    def test_like_counted(self):
        client.post("/api/reaction", json=PAYLOAD)
        res = client.get(f"/api/reaction/{PAYLOAD['debate_id']}")
        tallies = res.json()["reactions"]
        assert tallies["pro_opening"]["likes"] == 1
        assert tallies["pro_opening"]["dislikes"] == 0

    def test_multiple_likes_counted(self):
        client.post("/api/reaction", json=PAYLOAD)
        client.post("/api/reaction", json={**PAYLOAD, "session_id": "sess2"})
        res = client.get(f"/api/reaction/{PAYLOAD['debate_id']}")
        assert res.json()["reactions"]["pro_opening"]["likes"] == 2

    def test_reactions_isolated_by_debate_id(self):
        client.post("/api/reaction", json=PAYLOAD)
        res = client.get("/api/reaction/other_debate")
        assert res.json()["reactions"] == {}
