import pytest
from app.database import Base, get_db
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ── in-memory test DB ─────────────────────────────────────────────────────────
# StaticPool ensures all connections share the same in-memory DB instance.

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── helpers ───────────────────────────────────────────────────────────────────


def _vote(client, debate_id="d001", phase="before", side="pro", session_id="sess-1"):
    return client.post(
        "/api/vote",
        json={
            "debate_id": debate_id,
            "phase": phase,
            "side": side,
            "session_id": session_id,
        },
    )


# ── submit_vote ───────────────────────────────────────────────────────────────


class TestSubmitVote:
    def test_vote_returns_ok(self, client):
        res = _vote(client)
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_duplicate_vote_same_phase_returns_409(self, client):
        _vote(client)
        res = _vote(client)
        assert res.status_code == 409

    def test_same_session_can_vote_in_both_phases(self, client):
        _vote(client, phase="before")
        res = _vote(client, phase="after")
        assert res.status_code == 200

    def test_different_sessions_can_vote_same_phase(self, client):
        _vote(client, session_id="sess-1")
        res = _vote(client, session_id="sess-2")
        assert res.status_code == 200

    def test_invalid_phase_rejected(self, client):
        res = _vote(client, phase="during")
        assert res.status_code == 422

    def test_invalid_side_rejected(self, client):
        res = _vote(client, side="neutral")
        assert res.status_code == 422


# ── get_votes ─────────────────────────────────────────────────────────────────


class TestGetVotes:
    def test_empty_debate_returns_zero_tallies(self, client):
        res = client.get("/api/vote/no-debate")
        assert res.status_code == 200
        data = res.json()
        assert data["before"] == {"pro": 0, "con": 0, "total": 0}
        assert data["after"] == {"pro": 0, "con": 0, "total": 0}

    def test_before_vote_counted_correctly(self, client):
        _vote(client, phase="before", side="pro", session_id="s1")
        _vote(client, phase="before", side="con", session_id="s2")
        res = client.get("/api/vote/d001")
        data = res.json()
        assert data["before"]["pro"] == 1
        assert data["before"]["con"] == 1
        assert data["before"]["total"] == 2

    def test_after_vote_counted_separately(self, client):
        _vote(client, phase="before", side="pro", session_id="s1")
        _vote(client, phase="after", side="con", session_id="s1")
        res = client.get("/api/vote/d001")
        data = res.json()
        assert data["before"]["pro"] == 1
        assert data["after"]["con"] == 1

    def test_votes_isolated_by_debate_id(self, client):
        _vote(client, debate_id="debate-A", session_id="s1")
        _vote(client, debate_id="debate-B", session_id="s2")
        res = client.get("/api/vote/debate-A")
        assert res.json()["before"]["total"] == 1
        res = client.get("/api/vote/debate-B")
        assert res.json()["before"]["total"] == 1
