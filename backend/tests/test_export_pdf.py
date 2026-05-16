import json

from fastapi.testclient import TestClient

from app.database import Debate
from app.main import app
from app.routers.export_pdf import _build_pdf

client = TestClient(app)

SAMPLE_RESULT = {
    "topic": "AI is beneficial",
    "winner": "pro",
    "pro_arguments": [
        {"round_name": "opening", "content": "AI helps humanity.", "citations": []},
        {
            "round_name": "rebuttal",
            "content": "The risks are manageable.",
            "citations": [],
        },
        {
            "round_name": "closing",
            "content": "In conclusion, AI is good.",
            "citations": [],
        },
    ],
    "con_arguments": [
        {"round_name": "opening", "content": "AI poses risks.", "citations": []},
        {
            "round_name": "rebuttal",
            "content": "Benefits are overstated.",
            "citations": [],
        },
        {"round_name": "closing", "content": "We should be cautious.", "citations": []},
    ],
    "verdict": {"content": "PRO wins.\nWINNER: PRO", "citations": []},
}


class TestBuildPdf:
    def test_returns_bytes(self):
        result = _build_pdf("test123", SAMPLE_RESULT)
        assert isinstance(result, bytes)

    def test_output_is_pdf_magic_bytes(self):
        result = _build_pdf("test123", SAMPLE_RESULT)
        assert result[:4] == b"%PDF"

    def test_pdf_non_empty(self):
        result = _build_pdf("test123", SAMPLE_RESULT)
        assert len(result) > 1000

    def test_empty_result_does_not_crash(self):
        result = _build_pdf(
            "empty",
            {
                "topic": "Test",
                "winner": "",
                "pro_arguments": [],
                "con_arguments": [],
                "verdict": None,
            },
        )
        assert result[:4] == b"%PDF"

    def test_missing_verdict_does_not_crash(self):
        result = _build_pdf("partial", {**SAMPLE_RESULT, "verdict": None})
        assert result[:4] == b"%PDF"


class TestExportEndpoint:
    def test_404_for_unknown_debate(self):
        res = client.get("/api/debate/notexist/pdf")
        assert res.status_code == 404

    def test_returns_pdf_for_complete_debate(self, db_session):
        db_session.add(
            Debate(
                id="pdf001",
                topic="AI test",
                status="complete",
                result_json=json.dumps(SAMPLE_RESULT),
            )
        )
        db_session.commit()

        res = client.get("/api/debate/pdf001/pdf")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content[:4] == b"%PDF"

    def test_404_when_result_json_is_null(self, db_session):
        db_session.add(
            Debate(id="pdf002", topic="AI test", status="processing", result_json=None)
        )
        db_session.commit()

        res = client.get("/api/debate/pdf002/pdf")
        assert res.status_code == 404
