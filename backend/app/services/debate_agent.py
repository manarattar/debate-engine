from openai import OpenAI
from app.config import get_settings
from app.schemas import Argument, Citation, Side
import re
import json

settings = get_settings()


def _make_client() -> OpenAI:
    return OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )


def _build_source_context(chunks: list[dict], start_index: int = 1) -> tuple[str, list[Citation]]:
    """Format retrieved chunks as numbered context and return citations."""
    context_lines = []
    citations = []
    for i, chunk in enumerate(chunks):
        n = start_index + i
        context_lines.append(f"[{n}] {chunk['title']}\n{chunk['excerpt']}")
        citations.append(Citation(
            index=n,
            title=chunk["title"],
            url=chunk["url"],
            excerpt=chunk["excerpt"][:200],
        ))
    return "\n\n".join(context_lines), citations


def _call_llm(system: str, user: str) -> str:
    client = _make_client()
    response = client.chat.completions.create(
        model=settings.model_name,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.7,
        max_tokens=600,
    )
    return response.choices[0].message.content.strip()


PRO_SYSTEM = """You are a skilled debate advocate arguing FOR this position: "{topic}"
Make the strongest possible case for the PRO side using the provided sources.
Be persuasive, logical, and concise (3-4 paragraphs).
Cite sources inline using [N] notation. Only use citations from the provided sources."""

CON_SYSTEM = """You are a skilled debate advocate arguing AGAINST this position: "{topic}"
Make the strongest possible case for the CON side using the provided sources.
Be persuasive, logical, and concise (3-4 paragraphs).
Cite sources inline using [N] notation. Only use citations from the provided sources."""

JUDGE_SYSTEM = """You are an impartial judge evaluating a structured debate on: "{topic}"
Analyze all arguments from both sides fairly. Identify the strongest and weakest points.
Structure your verdict as:
1. What the PRO side argued well
2. What the CON side argued well
3. Key weaknesses on each side
4. Your verdict: which side made a more compelling overall case, and why (or declare a tie)
End with a clear WINNER: PRO / CON / TIE line."""


def generate_argument(
    topic: str,
    side: Side,
    round_name: str,
    chunks: list[dict],
    opponent_arguments: list[str] = None,
) -> Argument:
    context, citations = _build_source_context(chunks)

    if side == Side.pro:
        system = PRO_SYSTEM.format(topic=topic)
    elif side == Side.con:
        system = CON_SYSTEM.format(topic=topic)
    else:
        system = JUDGE_SYSTEM.format(topic=topic)

    if round_name == "rebuttal" and opponent_arguments:
        opponent_text = "\n\n".join(opponent_arguments)
        user_prompt = f"""Sources supporting your position:
{context}

Your opponent argued:
{opponent_text}

Now write your rebuttal. Directly address your opponent's key points, then reinforce your own position with evidence from the sources."""
    elif round_name == "verdict":
        pro_text = opponent_arguments[0] if opponent_arguments else ""
        con_text = opponent_arguments[1] if len(opponent_arguments) > 1 else ""
        user_prompt = f"""PRO side argued:
{pro_text}

CON side argued:
{con_text}

Supporting sources:
{context}

Deliver your impartial verdict."""
    else:
        user_prompt = f"""Sources:
{context}

Write your {round_name} argument on the topic: {topic}"""

    content = _call_llm(system, user_prompt)
    return Argument(side=side, round_name=round_name, content=content, citations=citations)


def generate_search_queries(topic: str) -> dict:
    """Ask LLM to generate targeted search queries for both sides."""
    client = _make_client()
    response = client.chat.completions.create(
        model=settings.model_name,
        messages=[{
            "role": "user",
            "content": f"""Generate search queries to find strong arguments for a debate on: "{topic}"

Return ONLY valid JSON with this structure:
{{
  "pro_queries": ["query1", "query2", "query3"],
  "con_queries": ["query1", "query2", "query3"]
}}

Make queries specific and likely to find strong evidence-backed arguments."""
        }],
        temperature=0.3,
        max_tokens=300,
    )
    text = response.choices[0].message.content.strip()
    # strip markdown fences
    text = re.sub(r"```(?:json)?", "", text).strip().strip("`")
    try:
        return json.loads(text)
    except Exception:
        return {
            "pro_queries": [f"arguments for {topic}", f"benefits of {topic}", f"evidence supporting {topic}"],
            "con_queries": [f"arguments against {topic}", f"problems with {topic}", f"evidence against {topic}"],
        }


def extract_winner(verdict_content: str) -> str:
    text = verdict_content.upper()
    if "WINNER: PRO" in text or "WINNER: THE PRO" in text:
        return "pro"
    if "WINNER: CON" in text or "WINNER: THE CON" in text:
        return "con"
    if "WINNER: TIE" in text:
        return "tie"
    if text.count("PRO") > text.count("CON"):
        return "pro"
    if text.count("CON") > text.count("PRO"):
        return "con"
    return "tie"
