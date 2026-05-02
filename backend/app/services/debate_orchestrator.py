import asyncio
import json
from typing import AsyncGenerator
from app.services.source_collector import collect_sources
from app.services.debate_indexer import index_sources, retrieve
from app.services.debate_agent import (
    generate_argument,
    generate_search_queries,
    extract_winner,
)
from app.schemas import Side, DebateResult, Argument

KEEPALIVE = ": keepalive\n\n"  # SSE comment — ignored by browsers, keeps connection alive


def _sse(event_type: str, data) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


async def _await_with_pings(coro):
    """Await a coroutine, yielding keepalive pings every 5s while waiting."""
    task = asyncio.ensure_future(coro)
    while not task.done():
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=5)
        except asyncio.TimeoutError:
            yield KEEPALIVE
    yield await task


async def _exec(loop, fn, *args):
    """Run blocking fn in thread executor, returning result."""
    return await loop.run_in_executor(None, fn, *args)


async def run_debate(debate_id: str, topic: str) -> AsyncGenerator[str, None]:
    loop = asyncio.get_event_loop()

    try:
        # Step 1 — generate search queries
        yield _sse("status", {"message": "Generating search strategy...", "step": 1, "total": 5})
        async for chunk in _await_with_pings(_exec(loop, generate_search_queries, topic)):
            if isinstance(chunk, str):
                yield chunk  # keepalive
            else:
                queries = chunk
        pro_queries = queries.get("pro_queries", [f"arguments for {topic}"])
        con_queries = queries.get("con_queries", [f"arguments against {topic}"])

        # Step 2 — collect sources
        yield _sse("status", {"message": "Searching for pro sources...", "step": 2, "total": 5})
        async for chunk in _await_with_pings(_exec(loop, collect_sources, pro_queries)):
            if isinstance(chunk, str):
                yield chunk
            else:
                pro_sources = chunk

        yield _sse("status", {"message": "Searching for con sources...", "step": 2, "total": 5})
        async for chunk in _await_with_pings(_exec(loop, collect_sources, con_queries)):
            if isinstance(chunk, str):
                yield chunk
            else:
                con_sources = chunk

        await _exec(loop, index_sources, debate_id, "pro", pro_sources)
        await _exec(loop, index_sources, debate_id, "con", con_sources)

        yield _sse("sources_ready", {
            "pro_count": len(pro_sources),
            "con_count": len(con_sources),
        })

        pro_args: list[Argument] = []
        con_args: list[Argument] = []

        # Step 3 — opening statements
        yield _sse("status", {"message": "PRO side: opening statement...", "step": 3, "total": 5})
        pro_chunks = await _exec(loop, retrieve, debate_id, "pro", topic, 4)
        async for chunk in _await_with_pings(_exec(loop, generate_argument, topic, Side.pro, "opening", pro_chunks, None)):
            if isinstance(chunk, str):
                yield chunk
            else:
                pro_opening = chunk
        pro_args.append(pro_opening)
        yield _sse("argument", {
            "side": "pro", "round_name": "opening",
            "content": pro_opening.content,
            "citations": [c.model_dump() for c in pro_opening.citations],
        })

        yield _sse("status", {"message": "CON side: opening statement...", "step": 3, "total": 5})
        con_chunks = await _exec(loop, retrieve, debate_id, "con", topic, 4)
        async for chunk in _await_with_pings(_exec(loop, generate_argument, topic, Side.con, "opening", con_chunks, None)):
            if isinstance(chunk, str):
                yield chunk
            else:
                con_opening = chunk
        con_args.append(con_opening)
        yield _sse("argument", {
            "side": "con", "round_name": "opening",
            "content": con_opening.content,
            "citations": [c.model_dump() for c in con_opening.citations],
        })

        # Step 4 — rebuttals
        yield _sse("status", {"message": "PRO side: rebuttal...", "step": 4, "total": 5})
        pro_rebuttal_chunks = await _exec(loop, retrieve, debate_id, "pro", con_opening.content, 4)
        async for chunk in _await_with_pings(_exec(loop, generate_argument, topic, Side.pro, "rebuttal", pro_rebuttal_chunks, [con_opening.content])):
            if isinstance(chunk, str):
                yield chunk
            else:
                pro_rebuttal = chunk
        pro_args.append(pro_rebuttal)
        yield _sse("argument", {
            "side": "pro", "round_name": "rebuttal",
            "content": pro_rebuttal.content,
            "citations": [c.model_dump() for c in pro_rebuttal.citations],
        })

        yield _sse("status", {"message": "CON side: rebuttal...", "step": 4, "total": 5})
        con_rebuttal_chunks = await _exec(loop, retrieve, debate_id, "con", pro_opening.content, 4)
        async for chunk in _await_with_pings(_exec(loop, generate_argument, topic, Side.con, "rebuttal", con_rebuttal_chunks, [pro_opening.content])):
            if isinstance(chunk, str):
                yield chunk
            else:
                con_rebuttal = chunk
        con_args.append(con_rebuttal)
        yield _sse("argument", {
            "side": "con", "round_name": "rebuttal",
            "content": con_rebuttal.content,
            "citations": [c.model_dump() for c in con_rebuttal.citations],
        })

        # Step 5 — judge verdict
        yield _sse("status", {"message": "Judge is deliberating...", "step": 5, "total": 5})
        pro_full = "\n\n".join(a.content for a in pro_args)
        con_full = "\n\n".join(a.content for a in con_args)
        judge_chunks = await _exec(loop, retrieve, debate_id, "pro", topic, 2)
        judge_chunks += await _exec(loop, retrieve, debate_id, "con", topic, 2)
        async for chunk in _await_with_pings(_exec(loop, generate_argument, topic, Side.judge, "verdict", judge_chunks, [pro_full, con_full])):
            if isinstance(chunk, str):
                yield chunk
            else:
                verdict = chunk
        winner = extract_winner(verdict.content)

        yield _sse("verdict", {
            "content": verdict.content,
            "citations": [c.model_dump() for c in verdict.citations],
            "winner": winner,
        })

        result = DebateResult(
            debate_id=debate_id,
            topic=topic,
            pro_arguments=pro_args,
            con_arguments=con_args,
            verdict=verdict,
            pro_sources=[
                {"index": i + 1, "title": s["title"], "url": s["url"], "excerpt": s["excerpt"][:200]}
                for i, s in enumerate(pro_sources[:8])
            ],
            con_sources=[
                {"index": i + 1, "title": s["title"], "url": s["url"], "excerpt": s["excerpt"][:200]}
                for i, s in enumerate(con_sources[:8])
            ],
            winner=winner,
        )

        yield _sse("complete", {
            "debate_id": debate_id,
            "winner": winner,
            "result": result.model_dump(),
        })

    except Exception as e:
        yield _sse("error", {"message": str(e)})
        raise
