import json

from fastapi.testclient import TestClient

from app.database import Debate
from app.main import app

client = TestClient(app)

BROWSER_UA = {"user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130"}
LINKEDIN_UA = {"user-agent": "LinkedInBot/1.0 (compatible; Mozilla/5.0)"}


def _add(db, debate_id, topic, winner="pro"):
    db.add(
        Debate(
            id=debate_id,
            topic=topic,
            status="complete",
            result_json=json.dumps({"topic": topic, "winner": winner}),
        )
    )
    db.commit()


def test_share_page_has_topic_and_per_debate_image(db_session):
    _add(db_session, "shr001", "Should cities ban cars?")
    res = client.get("/api/share?id=shr001", headers=LINKEDIN_UA)
    assert res.status_code == 200
    assert "<title>Should cities ban cars? | Munazara</title>" in res.text
    assert "/api/share/shr001/image.png?v=pro" in res.text
    assert 'og:url" content="https://munazara.manarattar.com/api/share?id=shr001"' in res.text


def test_crawlers_are_not_redirected_but_browsers_are(db_session):
    _add(db_session, "shr002", "Is tea better than coffee?")
    assert "http-equiv=\"refresh\"" not in client.get("/api/share?id=shr002", headers=LINKEDIN_UA).text
    browser = client.get("/api/share?id=shr002", headers=BROWSER_UA).text
    assert "url=https://munazara.manarattar.com/?debate=shr002" in browser


def test_topic_is_html_escaped(db_session):
    _add(db_session, "shr003", 'Is <script>alert(1)</script> "fine"?')
    res = client.get("/api/share?id=shr003", headers=LINKEDIN_UA)
    assert "<script>alert" not in res.text
    assert "&lt;script&gt;" in res.text


def test_unknown_debate_falls_back_to_generic_card():
    res = client.get("/api/share?id=nope", headers=LINKEDIN_UA)
    assert res.status_code == 200
    assert "https://munazara.manarattar.com/og-image.png" in res.text


def test_share_image_is_png(db_session):
    _add(db_session, "shr004", "Should homework be abolished?", winner="tie")
    res = client.get("/api/share/shr004/image.png")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_share_image_404_for_unknown_debate():
    assert client.get("/api/share/nope/image.png").status_code == 404


def test_head_requests_are_allowed(db_session):
    # LinkedIn probes links with HEAD before fetching them
    _add(db_session, "shr005", "Should exams be open book?")
    assert client.head("/api/share?id=shr005", headers=LINKEDIN_UA).status_code == 200
    assert client.head("/api/share/shr005/image.png").status_code == 200
