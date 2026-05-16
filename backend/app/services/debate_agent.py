import asyncio
import json
import re
import threading

from app.config import get_settings
from app.schemas import Argument, Citation, Side
from openai import OpenAI

settings = get_settings()


def _make_client() -> OpenAI:
    return OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )


MAX_CONTEXT_CHARS = 1200


def _build_source_context(
    chunks: list[dict], start_index: int = 1
) -> tuple[str, list[Citation]]:
    context_lines = []
    citations = []
    total = 0
    for i, chunk in enumerate(chunks):
        line = f"[{start_index + i}] {chunk['title']}\n{chunk['excerpt']}"
        if total + len(line) > MAX_CONTEXT_CHARS:
            break
        total += len(line)
        context_lines.append(line)
        citations.append(
            Citation(
                index=start_index + i,
                title=chunk["title"],
                url=chunk["url"],
                excerpt=chunk["excerpt"][:150],
            )
        )
    return "\n\n".join(context_lines), citations


def _build_prompts(
    topic: str,
    side: Side,
    round_name: str,
    context: str,
    opponent_arguments: list[str] = None,
    persona: str = None,
):
    if round_name == "closing":
        if side == Side.pro:
            system = PRO_CLOSING_SYSTEM.format(topic=topic)
        else:
            system = CON_CLOSING_SYSTEM.format(topic=topic)
    elif side == Side.pro:
        system = PRO_SYSTEM.format(topic=topic)
    elif side == Side.con:
        system = CON_SYSTEM.format(topic=topic)
    else:
        system = JUDGE_SYSTEM.format(topic=topic)

    if persona and side != Side.judge:
        system = f"You are debating as: {persona}.\n\n" + system

    if round_name == "closing" and opponent_arguments:
        opponent_text = "\n\n".join(a[:350] for a in opponent_arguments)
        user_prompt = f"""The full debate so far — your opponent argued:
{opponent_text}

Deliver your closing statement. Summarize your strongest points and make your final appeal."""
    elif round_name == "rebuttal" and opponent_arguments:
        opponent_text = "\n\n".join(a[:400] for a in opponent_arguments)
        user_prompt = f"""Sources supporting your position:
{context}

Your opponent argued:
{opponent_text}

Write your rebuttal in 2 paragraphs. Address the key opponent points using your sources."""
    elif round_name == "verdict":
        pro_text = (opponent_arguments[0] if opponent_arguments else "")[:400]
        con_text = (opponent_arguments[1] if len(opponent_arguments) > 1 else "")[:400]
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

    return system, user_prompt


PRO_SYSTEM = """You are a skilled debate advocate arguing FOR this position: "{topic}"
Make the strongest possible case for the PRO side using the provided sources.
Be persuasive, logical, and concise (2-3 paragraphs max).
Cite sources inline using [N] notation. Only use citations from the provided sources."""

CON_SYSTEM = """You are a skilled debate advocate arguing AGAINST this position: "{topic}"
Make the strongest possible case for the CON side using the provided sources.
Be persuasive, logical, and concise (2-3 paragraphs max).
Cite sources inline using [N] notation. Only use citations from the provided sources."""

PRO_CLOSING_SYSTEM = (
    'You are a skilled debate advocate giving your closing statement FOR: "{topic}"\n'
    "Summarize your strongest points, expose opponent weaknesses, make a final appeal.\n"
    "Do NOT introduce new claims. Reinforce what was established. (2 paragraphs max)."
)

CON_CLOSING_SYSTEM = (
    'You are a skilled debate advocate giving your closing statement AGAINST: "{topic}"\n'
    "Summarize your strongest points, expose opponent weaknesses, make a final appeal.\n"
    "Do NOT introduce new claims. Reinforce what was established. (2 paragraphs max)."
)

JUDGE_SYSTEM = """You are an impartial judge evaluating a structured debate on: "{topic}"
Analyze all arguments from both sides fairly. Identify the strongest and weakest points.
Structure your verdict as:
1. What the PRO side argued well
2. What the CON side argued well
3. Key weaknesses on each side
4. Your final verdict: which side made a more compelling overall case, and why

You MUST end your verdict with exactly one of these three lines (the last line of your response):
WINNER: PRO
WINNER: CON
WINNER: TIE"""


async def generate_argument_streaming(
    topic: str,
    side: Side,
    round_name: str,
    chunks: list[dict],
    opponent_arguments: list[str] = None,
    persona: str = None,
):
    """Async generator: yields ("token", delta) then ("complete", Argument)."""
    context, citations = _build_source_context(chunks)
    system, user_prompt = _build_prompts(
        topic, side, round_name, context, opponent_arguments, persona
    )

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    token_limit = 900 if round_name == "verdict" else 350

    def _stream():
        try:
            client = _make_client()
            response = client.chat.completions.create(
                model=settings.model_name,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=token_limit,
                stream=True,
            )
            for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    asyncio.run_coroutine_threadsafe(queue.put(("token", delta)), loop)
            asyncio.run_coroutine_threadsafe(queue.put(("done", None)), loop)
        except Exception as e:
            asyncio.run_coroutine_threadsafe(queue.put(("error", str(e))), loop)

    thread = threading.Thread(target=_stream, daemon=True)
    thread.start()

    full_content = ""
    while True:
        kind, data = await queue.get()
        if kind == "token":
            full_content += data
            yield "token", data
            await asyncio.sleep(0.02)
        elif kind == "done":
            argument = Argument(
                side=side,
                round_name=round_name,
                content=full_content,
                citations=citations,
            )
            yield "complete", argument
            break
        elif kind == "error":
            raise RuntimeError(data)


def generate_search_queries(topic: str) -> dict:
    """Return LLM-generated {"pro_queries": [...], "con_queries": [...]} for a debate topic."""
    client = _make_client()
    response = client.chat.completions.create(
        model=settings.model_name,
        messages=[
            {
                "role": "user",
                "content": f"""Generate search queries to find strong arguments for a debate on: "{topic}"

Return ONLY valid JSON with this structure:
{{
  "pro_queries": ["query1", "query2", "query3"],
  "con_queries": ["query1", "query2", "query3"]
}}

Make queries specific and likely to find strong evidence-backed arguments.""",
            }
        ],
        temperature=0.3,
        max_tokens=300,
    )
    text = response.choices[0].message.content.strip()
    text = re.sub(r"```(?:json)?", "", text).strip().strip("`")
    try:
        return json.loads(text)
    except Exception:
        return {
            "pro_queries": [
                f"arguments for {topic}",
                f"benefits of {topic}",
                f"evidence supporting {topic}",
            ],
            "con_queries": [
                f"arguments against {topic}",
                f"problems with {topic}",
                f"evidence against {topic}",
            ],
        }


def extract_winner(verdict_content: str) -> str:
    """Parse judge verdict text; returns 'pro', 'con', or 'tie' (fallback)."""
    text = verdict_content.upper().strip()

    # Check the last 100 characters first — winner line is always at the end
    tail = text[-100:]
    for fragment in [tail, text]:
        if re.search(r"WINNER\s*:\s*PRO\b", fragment):
            return "pro"
        if re.search(r"WINNER\s*:\s*CON\b", fragment):
            return "con"
        if re.search(r"WINNER\s*:\s*TIE\b", fragment):
            return "tie"

    # Fallback: look for conclusive phrases
    if re.search(r"\b(PRO WINS|PRO SIDE WINS|PRO MADE THE STRONGER|SIDE PRO)\b", text):
        return "pro"
    if re.search(r"\b(CON WINS|CON SIDE WINS|CON MADE THE STRONGER|SIDE CON)\b", text):
        return "con"
    if re.search(
        r"\b(THIS IS A TIE|DECLARE A TIE|RESULT IS A TIE|CALL THIS A TIE)\b", text
    ):
        return "tie"

    return "tie"
