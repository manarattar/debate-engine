import asyncio
import json
from typing import AsyncGenerator

from app.schemas import Argument, DebateResult, Side
from app.services.debate_agent import (extract_winner,
                                       generate_argument_streaming,
                                       generate_search_queries,
                                       score_arguments)
from app.services.debate_indexer import index_sources, retrieve
from app.services.source_collector import collect_sources

KEEPALIVE = ": keepalive\n\n"


def _sse(event_type: str, data) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


async def _exec(loop, fn, *args):
    return await loop.run_in_executor(None, fn, *args)


async def _stream_argument(
    topic: str,
    side: Side,
    round_name: str,
    chunks: list[dict],
    opponent_arguments: list[str] = None,
    persona: str = None,
) -> AsyncGenerator[str, None]:
    """Stream an argument, yielding SSE chunks token by token."""
    side_str = side.value
    yield _sse("argument_start", {"side": side_str, "round_name": round_name})

    argument = None
    async for kind, data in generate_argument_streaming(
        topic, side, round_name, chunks, opponent_arguments, persona
    ):
        if kind == "token":
            yield _sse(
                "token", {"side": side_str, "round_name": round_name, "delta": data}
            )
        else:
            argument = data

    if argument:
        yield _sse(
            "argument",
            {
                "side": side_str,
                "round_name": round_name,
                "content": argument.content,
                "citations": [c.model_dump() for c in argument.citations],
            },
        )


async def run_debate(
    debate_id: str,
    topic: str,
    capture: dict = None,
    pro_persona: str = None,
    con_persona: str = None,
) -> AsyncGenerator[str, None]:
    loop = asyncio.get_event_loop()
    pro_args: list[Argument] = []
    con_args: list[Argument] = []
    pro_sources = []
    con_sources = []

    try:
        # Step 1 — generate search queries
        yield _sse(
            "status",
            {"message": "Generating search strategy...", "step": 1, "total": 6},
        )
        queries = await _exec(loop, generate_search_queries, topic)
        pro_queries = queries.get("pro_queries", [f"arguments for {topic}"])
        con_queries = queries.get("con_queries", [f"arguments against {topic}"])

        # Step 2 — collect sources
        yield _sse(
            "status", {"message": "Searching for pro sources...", "step": 2, "total": 6}
        )
        pro_sources = await _exec(loop, collect_sources, pro_queries)
        yield _sse(
            "status", {"message": "Searching for con sources...", "step": 2, "total": 6}
        )
        con_sources = await _exec(loop, collect_sources, con_queries)

        await _exec(loop, index_sources, debate_id, "pro", pro_sources)
        await _exec(loop, index_sources, debate_id, "con", con_sources)

        yield _sse(
            "sources_ready",
            {"pro_count": len(pro_sources), "con_count": len(con_sources)},
        )
        if pro_persona or con_persona:
            yield _sse("personas", {"pro": pro_persona, "con": con_persona})

        # Step 3 — opening statements (streamed)
        yield _sse(
            "status",
            {"message": "PRO side: opening statement...", "step": 3, "total": 6},
        )
        pro_chunks = await _exec(loop, retrieve, debate_id, "pro", topic, 3)
        pro_opening = None
        async for chunk in _stream_argument(
            topic, Side.pro, "opening", pro_chunks, persona=pro_persona
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    pro_opening = Argument(
                        side=Side.pro,
                        round_name="opening",
                        content=msg["data"]["content"],
                        citations=[],
                    )
                    pro_args.append(pro_opening)
            except Exception:
                pass

        yield _sse(
            "status",
            {"message": "CON side: opening statement...", "step": 3, "total": 6},
        )
        con_chunks = await _exec(loop, retrieve, debate_id, "con", topic, 3)
        con_opening = None
        async for chunk in _stream_argument(
            topic, Side.con, "opening", con_chunks, persona=con_persona
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    con_opening = Argument(
                        side=Side.con,
                        round_name="opening",
                        content=msg["data"]["content"],
                        citations=[],
                    )
                    con_args.append(con_opening)
            except Exception:
                pass

        # Step 4 — rebuttals (streamed)
        yield _sse(
            "status", {"message": "PRO side: rebuttal...", "step": 4, "total": 6}
        )
        pro_rebuttal_chunks = await _exec(
            loop,
            retrieve,
            debate_id,
            "pro",
            con_opening.content if con_opening else topic,
            3,
        )
        async for chunk in _stream_argument(
            topic,
            Side.pro,
            "rebuttal",
            pro_rebuttal_chunks,
            [con_opening.content] if con_opening else None,
            persona=pro_persona,
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    pro_args.append(
                        Argument(
                            side=Side.pro,
                            round_name="rebuttal",
                            content=msg["data"]["content"],
                            citations=[],
                        )
                    )
            except Exception:
                pass

        yield _sse(
            "status", {"message": "CON side: rebuttal...", "step": 4, "total": 6}
        )
        con_rebuttal_chunks = await _exec(
            loop,
            retrieve,
            debate_id,
            "con",
            pro_opening.content if pro_opening else topic,
            3,
        )
        async for chunk in _stream_argument(
            topic,
            Side.con,
            "rebuttal",
            con_rebuttal_chunks,
            [pro_opening.content] if pro_opening else None,
            persona=con_persona,
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    con_args.append(
                        Argument(
                            side=Side.con,
                            round_name="rebuttal",
                            content=msg["data"]["content"],
                            citations=[],
                        )
                    )
            except Exception:
                pass

        # Step 5 — cross-examination (streamed)
        yield _sse(
            "status",
            {"message": "Cross-examination: PRO questions...", "step": 5, "total": 7},
        )
        pro_questions_content = ""
        async for chunk in _stream_argument(
            topic,
            Side.pro,
            "cross_pro_questions",
            [],
            [a.content for a in con_args],
            persona=pro_persona,
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    pro_questions_content = msg["data"]["content"]
                    pro_args.append(
                        Argument(
                            side=Side.pro,
                            round_name="cross_pro_questions",
                            content=pro_questions_content,
                            citations=[],
                        )
                    )
            except Exception:
                pass

        yield _sse(
            "status",
            {"message": "Cross-examination: CON answers...", "step": 5, "total": 7},
        )
        async for chunk in _stream_argument(
            topic,
            Side.con,
            "cross_con_answers",
            [],
            [pro_questions_content] if pro_questions_content else None,
            persona=con_persona,
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    con_args.append(
                        Argument(
                            side=Side.con,
                            round_name="cross_con_answers",
                            content=msg["data"]["content"],
                            citations=[],
                        )
                    )
            except Exception:
                pass

        yield _sse(
            "status",
            {"message": "Cross-examination: CON questions...", "step": 5, "total": 7},
        )
        con_questions_content = ""
        async for chunk in _stream_argument(
            topic,
            Side.con,
            "cross_con_questions",
            [],
            [a.content for a in pro_args],
            persona=con_persona,
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    con_questions_content = msg["data"]["content"]
                    con_args.append(
                        Argument(
                            side=Side.con,
                            round_name="cross_con_questions",
                            content=con_questions_content,
                            citations=[],
                        )
                    )
            except Exception:
                pass

        yield _sse(
            "status",
            {"message": "Cross-examination: PRO answers...", "step": 5, "total": 7},
        )
        async for chunk in _stream_argument(
            topic,
            Side.pro,
            "cross_pro_answers",
            [],
            [con_questions_content] if con_questions_content else None,
            persona=pro_persona,
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    pro_args.append(
                        Argument(
                            side=Side.pro,
                            round_name="cross_pro_answers",
                            content=msg["data"]["content"],
                            citations=[],
                        )
                    )
            except Exception:
                pass

        # Step 6 — closing statements (streamed)
        yield _sse(
            "status",
            {"message": "PRO side: closing statement...", "step": 6, "total": 7},
        )
        con_debate_so_far = [a.content for a in con_args]
        async for chunk in _stream_argument(
            topic, Side.pro, "closing", [], con_debate_so_far, persona=pro_persona
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    pro_args.append(
                        Argument(
                            side=Side.pro,
                            round_name="closing",
                            content=msg["data"]["content"],
                            citations=[],
                        )
                    )
            except Exception:
                pass

        yield _sse(
            "status",
            {"message": "CON side: closing statement...", "step": 6, "total": 7},
        )
        pro_debate_so_far = [a.content for a in pro_args]
        async for chunk in _stream_argument(
            topic, Side.con, "closing", [], pro_debate_so_far, persona=con_persona
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    con_args.append(
                        Argument(
                            side=Side.con,
                            round_name="closing",
                            content=msg["data"]["content"],
                            citations=[],
                        )
                    )
            except Exception:
                pass

        # Step 7 — judge verdict (streamed)
        yield _sse(
            "status", {"message": "Judge is deliberating...", "step": 7, "total": 7}
        )
        pro_full = "\n\n".join(a.content for a in pro_args)
        con_full = "\n\n".join(a.content for a in con_args)
        judge_chunks = await _exec(loop, retrieve, debate_id, "pro", topic, 2)
        judge_chunks += await _exec(loop, retrieve, debate_id, "con", topic, 2)

        verdict_content = ""
        async for chunk in _stream_argument(
            topic, Side.judge, "verdict", judge_chunks, [pro_full, con_full]
        ):
            yield chunk
            try:
                msg = json.loads(chunk.replace("data: ", "").strip())
                if msg.get("type") == "argument":
                    verdict_content = msg["data"]["content"]
            except Exception:
                pass

        winner = extract_winner(verdict_content)
        yield _sse("winner", {"winner": winner})

        # Score each main-round argument (non-blocking, single LLM call)
        scores = await _exec(loop, score_arguments, topic, pro_args, con_args)
        if scores:
            yield _sse("scores", scores)

        result = DebateResult(
            debate_id=debate_id,
            topic=topic,
            pro_arguments=pro_args,
            con_arguments=con_args,
            verdict=Argument(
                side=Side.judge,
                round_name="verdict",
                content=verdict_content,
                citations=[],
            ),
            pro_sources=[
                {
                    "index": i + 1,
                    "title": s["title"],
                    "url": s["url"],
                    "excerpt": s["excerpt"][:200],
                }
                for i, s in enumerate(pro_sources[:8])
            ],
            con_sources=[
                {
                    "index": i + 1,
                    "title": s["title"],
                    "url": s["url"],
                    "excerpt": s["excerpt"][:200],
                }
                for i, s in enumerate(con_sources[:8])
            ],
            winner=winner,
        )

        if capture is not None:
            capture["result"] = result.model_dump()

        yield _sse("complete", {"debate_id": debate_id, "winner": winner})

    except Exception as e:
        yield _sse("error", {"message": str(e)})
        raise
