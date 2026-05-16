from unittest.mock import MagicMock, patch

from app.schemas import Argument, Side
from app.services.debate_agent import score_arguments


def _make_arg(
    side: str, round_name: str, content: str = "Some argument text."
) -> Argument:
    return Argument(
        side=Side(side), round_name=round_name, content=content, citations=[]
    )


def _mock_response(json_text: str):
    choice = MagicMock()
    choice.message.content = json_text
    resp = MagicMock()
    resp.choices = [choice]
    return resp


class TestScoreArguments:
    def test_returns_empty_dict_when_no_args(self):
        result = score_arguments("AI ethics", [], [])
        assert result == {}

    def test_skips_cross_exam_rounds(self):
        pro = [_make_arg("pro", "cross_pro_questions")]
        con = [_make_arg("con", "cross_con_answers")]
        result = score_arguments("AI ethics", pro, con)
        assert result == {}

    @patch("app.services.debate_agent._make_client")
    def test_scores_clamped_between_1_and_10(self, mock_client):
        mock_client.return_value.chat.completions.create.return_value = _mock_response(
            '{"pro_opening": 15, "con_opening": -3}'
        )
        pro = [_make_arg("pro", "opening")]
        con = [_make_arg("con", "opening")]
        result = score_arguments("AI ethics", pro, con)
        assert result["pro_opening"] == 10
        assert result["con_opening"] == 1

    @patch("app.services.debate_agent._make_client")
    def test_parses_valid_scores(self, mock_client):
        mock_client.return_value.chat.completions.create.return_value = _mock_response(
            '{"pro_opening": 8, "con_opening": 6, "pro_rebuttal": 7, "con_rebuttal": 5}'
        )
        pro = [_make_arg("pro", "opening"), _make_arg("pro", "rebuttal")]
        con = [_make_arg("con", "opening"), _make_arg("con", "rebuttal")]
        result = score_arguments("AI ethics", pro, con)
        assert result == {
            "pro_opening": 8,
            "con_opening": 6,
            "pro_rebuttal": 7,
            "con_rebuttal": 5,
        }

    @patch("app.services.debate_agent._make_client")
    def test_returns_empty_dict_on_invalid_json(self, mock_client):
        mock_client.return_value.chat.completions.create.return_value = _mock_response(
            "Sorry, I cannot score these arguments."
        )
        pro = [_make_arg("pro", "opening")]
        con = [_make_arg("con", "opening")]
        result = score_arguments("AI ethics", pro, con)
        assert result == {}

    @patch("app.services.debate_agent._make_client")
    def test_strips_markdown_fences_from_response(self, mock_client):
        mock_client.return_value.chat.completions.create.return_value = _mock_response(
            '```json\n{"pro_opening": 9}\n```'
        )
        pro = [_make_arg("pro", "opening")]
        result = score_arguments("AI ethics", pro, [])
        assert result == {"pro_opening": 9}

    @patch("app.services.debate_agent._make_client")
    def test_ignores_non_numeric_values(self, mock_client):
        mock_client.return_value.chat.completions.create.return_value = _mock_response(
            '{"pro_opening": 7, "con_opening": "N/A"}'
        )
        pro = [_make_arg("pro", "opening")]
        con = [_make_arg("con", "opening")]
        result = score_arguments("AI ethics", pro, con)
        assert "pro_opening" in result
        assert "con_opening" not in result
