from app.schemas import Side
from app.services.debate_agent import (MAX_CONTEXT_CHARS, _build_prompts,
                                       _build_source_context, extract_winner)

# ── extract_winner ─────────────────────────────────────────────────────────


class TestExtractWinner:
    def test_pro_at_end(self):
        assert extract_winner("Both sides argued well.\nWINNER: PRO") == "pro"

    def test_con_at_end(self):
        assert extract_winner("CON made stronger points.\nWINNER: CON") == "con"

    def test_tie_at_end(self):
        assert extract_winner("Both sides were equal.\nWINNER: TIE") == "tie"

    def test_lowercase_input_normalized(self):
        # Function uppercases internally, so lowercase input must still match
        assert extract_winner("winner: pro") == "pro"

    def test_winner_with_spaces_around_colon(self):
        assert extract_winner("WINNER : CON") == "con"

    def test_winner_in_middle_of_long_text(self):
        # Not at the tail but the full-text scan should catch it
        long_prefix = "A " * 200  # pushes winner line out of the 100-char tail
        text = long_prefix + "WINNER: PRO\n" + "Extra content after."
        assert extract_winner(text) == "pro"

    def test_no_winner_line_falls_back_to_tie(self):
        assert extract_winner("The debate was interesting and informative.") == "tie"

    def test_empty_string_falls_back_to_tie(self):
        assert extract_winner("") == "tie"

    def test_fallback_phrase_pro_wins(self):
        assert extract_winner("Clearly PRO WINS this debate.") == "pro"

    def test_fallback_phrase_con_wins(self):
        assert extract_winner("CON WINS on all major points.") == "con"

    def test_fallback_phrase_this_is_a_tie(self):
        assert extract_winner("I must declare: THIS IS A TIE.") == "tie"

    def test_trailing_whitespace_ignored(self):
        assert extract_winner("  WINNER: CON   ") == "con"

    def test_winner_line_with_extra_trailing_text(self):
        # WINNER: PRO followed by more text — \b word boundary should still match
        assert extract_winner("WINNER: PRO\nThank you for debating.") == "pro"


# ── _build_source_context ─────────────────────────────────────────────────


def _make_chunk(
    title="Test Title", excerpt="Some excerpt text.", url="https://example.com"
):
    return {"title": title, "excerpt": excerpt, "url": url}


class TestBuildSourceContext:
    def test_empty_chunks_returns_empty(self):
        text, citations = _build_source_context([])
        assert text == ""
        assert citations == []

    def test_single_chunk_included(self):
        chunk = _make_chunk(
            title="Article A", excerpt="Excerpt A.", url="https://a.com"
        )
        text, citations = _build_source_context([chunk])

        assert "[1] Article A" in text
        assert "Excerpt A." in text
        assert len(citations) == 1
        assert citations[0].index == 1
        assert citations[0].title == "Article A"
        assert citations[0].url == "https://a.com"

    def test_citation_index_starts_at_one_by_default(self):
        chunk = _make_chunk()
        _, citations = _build_source_context([chunk])
        assert citations[0].index == 1

    def test_custom_start_index(self):
        chunk = _make_chunk()
        _, citations = _build_source_context([chunk], start_index=5)
        assert citations[0].index == 5

    def test_multiple_chunks_under_cap_all_included(self):
        # Each chunk is tiny — all should fit under MAX_CONTEXT_CHARS
        chunks = [_make_chunk(title=f"T{i}", excerpt=f"E{i}") for i in range(5)]
        text, citations = _build_source_context(chunks)
        assert len(citations) == 5
        for i in range(5):
            assert f"T{i}" in text

    def test_chunks_exceeding_cap_are_truncated(self):
        # Make each chunk ~300 chars so 5 chunks exceed MAX_CONTEXT_CHARS (1200)
        long_excerpt = "x" * 280
        chunks = [
            _make_chunk(title=f"Title{i}", excerpt=long_excerpt) for i in range(5)
        ]
        text, citations = _build_source_context(chunks)

        assert len(citations) < 5, "Should have stopped before including all 5 chunks"
        total_len = sum(
            len(f"[{i+1}] Title{i}\n{long_excerpt}") for i in range(len(citations))
        )
        assert total_len <= MAX_CONTEXT_CHARS

    def test_citation_excerpt_truncated_to_150_chars(self):
        long_excerpt = "y" * 300
        chunk = _make_chunk(excerpt=long_excerpt)
        _, citations = _build_source_context([chunk])
        assert len(citations[0].excerpt) <= 150

    def test_context_text_chunks_joined_by_double_newline(self):
        chunks = [_make_chunk(title="A"), _make_chunk(title="B")]
        text, _ = _build_source_context(chunks)
        assert "\n\n" in text

    def test_sequential_citation_indices(self):
        chunks = [_make_chunk(title=f"T{i}") for i in range(3)]
        _, citations = _build_source_context(chunks, start_index=2)
        assert [c.index for c in citations] == [2, 3, 4]


# ── _build_prompts (closing round) ───────────────────────────────────────────


class TestBuildPromptsClosing:
    def test_pro_closing_uses_pro_closing_system(self):
        system, _ = _build_prompts(
            "AI ethics", Side.pro, "closing", "", ["Con argued X."]
        )
        assert "closing statement FOR" in system
        assert "AI ethics" in system

    def test_con_closing_uses_con_closing_system(self):
        system, _ = _build_prompts(
            "AI ethics", Side.con, "closing", "", ["Pro argued X."]
        )
        assert "closing statement AGAINST" in system
        assert "AI ethics" in system

    def test_closing_prompt_includes_opponent_arguments(self):
        _, user_prompt = _build_prompts(
            "Nuclear energy", Side.pro, "closing", "", ["Con argued it is dangerous."]
        )
        assert "Con argued it is dangerous." in user_prompt

    def test_closing_prompt_without_opponent_falls_back(self):
        _, user_prompt = _build_prompts("Nuclear energy", Side.pro, "closing", "", None)
        assert isinstance(user_prompt, str)
        assert len(user_prompt) > 0

    def test_closing_does_not_use_generic_opening_system(self):
        system, _ = _build_prompts("AI ethics", Side.pro, "closing", "", [])
        assert "arguing FOR" not in system

    def test_opening_round_still_uses_pro_system(self):
        system, _ = _build_prompts("AI ethics", Side.pro, "opening", "context", None)
        assert "arguing FOR" in system

    def test_rebuttal_round_still_uses_pro_system(self):
        system, _ = _build_prompts(
            "AI ethics", Side.pro, "rebuttal", "ctx", ["opp arg"]
        )
        assert "arguing FOR" in system
