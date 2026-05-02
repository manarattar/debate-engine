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


def _sse(event_type: str, data) -> str:
    payload = data if isinstance(data, str) else json.dumps(data)
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


async def run_debate(debate_id: str, topic: str) -> AsyncGenerator[str, None]:
    loop = asyncio.get_event_loop()

    try:
        # Step 1 — generate search queries
        yield _sse("status", {"message": "Generating search strategy...", "step": 1, "total": 5})
        queries = await loop.run_in_executor(None, generate_search_queries, topic)
        pro_queries = queries.get("pro_queries", [f"arguments for {topic}"])
        con_queries = queries.get("con_queries", [f"arguments against {topic}"])

        # Step 2 — collect and index sources
        yield _sse("status", {"message": "Searching for pro sources...", "step": 2, "total": 5})
        pro_sources = await loop.run_in_executor(None, collect_sources, pro_queries)

        yield _sse("status", {"message": "Searching for con sources...", "step": 2, "total": 5})
        con_sources = await loop.run_in_executor(None, collect_sources, con_queries)

        await loop.run_in_executor(None, index_sources, debate_id, "pro", pro_sources)
        await loop.run_in_executor(None, index_sources, debate_id, "con", con_sources)

        yield _sse("sources_ready", {
            "pro_count": len(pro_sources),
            "con_count": len(con_sources),
        })

        pro_args: list[Argument] = []
        con_args: list[Argument] = []

        # Step 3 — opening statements
        yield _sse("status", {"message": "PRO side: opening statement...", "step": 3, "total": 5})
        pro_chunks = await loop.run_in_executor(None, retrieve, debate_id, "pro", topic, 4)
        pro_opening = await loop.run_in_executor(
            None, generate_argument, topic, Side.pro, "opening", pro_chunks, None
        )
        pro_args.append(pro_opening)
        yield _sse("argument", {
            "side": "pro",
            "round_name": "opening",
            "content": pro_opening.content,
            "citations": [c.model_dump() for c in pro_opening.citations],
        })

        yield _sse("status", {"message": "CON side: opening statement...", "step": 3, "total": 5})
        con_chunks = await loop.run_in_executor(None, retrieve, debate_id, "con", topic, 4)
        con_opening = await loop.run_in_executor(
            None, generate_argument, topic, Side.con, "opening", con_chunks, None
        )
        con_args.append(con_opening)
        yield _sse("argument", {
            "side": "con",
            "round_name": "opening",
            "content": con_opening.content,
            "citations": [c.model_dump() for c in con_opening.citations],
        })

        # Step 4 — rebuttals
        yield _sse("status", {"message": "PRO side: rebuttal...", "step": 4, "total": 5})
        pro_rebuttal_chunks = await loop.run_in_executor(None, retrieve, debate_id, "pro", con_opening.content, 4)
        pro_rebuttal = await loop.run_in_executor(
            None, generate_argument, topic, Side.pro, "rebuttal",
            pro_rebuttal_chunks, [con_opening.content]
        )
        pro_args.append(pro_rebuttal)
        yield _sse("argument", {
            "side": "pro",
            "round_name": "rebuttal",
            "content": pro_rebuttal.content,
            "citations": [c.model_dump() for c in pro_rebuttal.citations],
        })

        yield _sse("status", {"message": "CON side: rebuttal...", "step": 4, "total": 5})
        con_rebuttal_chunks = await loop.run_in_executor(None, retrieve, debate_id, "con", pro_opening.content, 4)
        con_rebuttal = await loop.run_in_executor(
            None, generate_argument, topic, Side.con, "rebuttal",
            con_rebuttal_chunks, [pro_opening.content]
        )
        con_args.append(con_rebuttal)
        yield _sse("argument", {
            "side": "con",
            "round_name": "rebuttal",
            "content": con_rebuttal.content,
            "citations": [c.model_dump() for c in con_rebuttal.citations],
        })

        # Step 5 — judge verdict
        yield _sse("status", {"message": "Judge is deliberating...", "step": 5, "total": 5})
        pro_full = "\n\n".join(a.content for a in pro_args)
        con_full = "\n\n".join(a.content for a in con_args)
        judge_chunks_pro = await loop.run_in_executor(None, retrieve, debate_id, "pro", topic, 2)
        judge_chunks_con = await loop.run_in_executor(None, retrieve, debate_id, "con", topic, 2)
        judge_chunks = judge_chunks_pro + judge_chunks_con
        verdict = await loop.run_in_executor(
            None, generate_argument, topic, Side.judge, "verdict",
            judge_chunks, [pro_full, con_full]
        )
        winner = extract_winner(verdict.content)

        yield _sse("verdict", {
            "content": verdict.content,
            "citations": [c.model_dump() for c in verdict.citations],
            "winner": winner,
        })

        # Serialize full result for DB
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
