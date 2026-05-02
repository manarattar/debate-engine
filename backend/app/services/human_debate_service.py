import asyncio
import json
from app.schemas import Side
from app.services.debate_agent import (
    generate_argument_streaming,
    generate_search_queries,
    extract_winner,
)
from app.services.source_collector import collect_sources
from app.services.debate_indexer import index_sources, retrieve


def _sse(event_type: str, data) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


def gather_sources_background(session_id: str, topic: str, db):
    """Sync background task: search + index sources for both sides."""
    from app.database import HumanDebate
    try:
        queries = generate_search_queries(topic)
        pro_queries = queries.get("pro_queries", [f"arguments for {topic}"])
        con_queries = queries.get("con_queries", [f"arguments against {topic}"])

        pro_sources = collect_sources(pro_queries)
        con_sources = collect_sources(con_queries)

        index_sources(session_id, "pro", pro_sources)
        index_sources(session_id, "con", con_sources)

        row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
        if row:
            row.status = "sources_ready"
            db.commit()
    except Exception as e:
        row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
        if row:
            row.status = "failed"
            row.error_message = str(e)
            db.commit()


async def stream_ai_opening(session_id: str, topic: str, ai_side: Side, db):
    """Async generator: streams AI's opening argument SSE events."""
    from app.database import HumanDebate
    loop = asyncio.get_event_loop()
    ai_str = ai_side.value
    try:
        chunks = await loop.run_in_executor(None, retrieve, session_id, ai_str, topic, 3)

        yield _sse("argument_start", {"side": ai_str, "round_name": "opening"})

        full_content = ""
        async for kind, data in generate_argument_streaming(topic, ai_side, "opening", chunks):
            if kind == "token":
                yield _sse("token", {"side": ai_str, "round_name": "opening", "delta": data})
            else:
                full_content = data.content

        yield _sse("argument", {
            "side": ai_str,
            "round_name": "opening",
            "content": full_content,
            "citations": [],
        })

        row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
        if row:
            row.ai_opening = full_content
            row.status = "ai_opening_done"
            db.commit()

        yield _sse("opening_done", {"session_id": session_id})

    except Exception as e:
        yield _sse("error", {"message": str(e)})


async def stream_ai_rebuttal_and_verdict(
    session_id: str,
    topic: str,
    ai_side: Side,
    human_opening: str,
    ai_opening: str,
    human_rebuttal: str,
    db,
):
    """Async generator: streams AI rebuttal then judge verdict."""
    from app.database import HumanDebate
    loop = asyncio.get_event_loop()
    ai_str = ai_side.value
    human_side = Side.pro if ai_side == Side.con else Side.con

    try:
        # ── AI rebuttal ───────────────────────────────────────────────────
        chunks = await loop.run_in_executor(None, retrieve, session_id, ai_str, human_rebuttal, 3)

        yield _sse("argument_start", {"side": ai_str, "round_name": "rebuttal"})

        ai_rebuttal_content = ""
        async for kind, data in generate_argument_streaming(
            topic, ai_side, "rebuttal", chunks, [human_opening, human_rebuttal]
        ):
            if kind == "token":
                yield _sse("token", {"side": ai_str, "round_name": "rebuttal", "delta": data})
            else:
                ai_rebuttal_content = data.content

        yield _sse("argument", {
            "side": ai_str,
            "round_name": "rebuttal",
            "content": ai_rebuttal_content,
            "citations": [],
        })

        row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
        if row:
            row.ai_rebuttal = ai_rebuttal_content
            db.commit()

        # ── Judge verdict ─────────────────────────────────────────────────
        yield _sse("status", {"message": "Judge is deliberating...", "step": 5, "total": 5})

        judge_chunks = await loop.run_in_executor(None, retrieve, session_id, "pro", topic, 2)
        judge_chunks += await loop.run_in_executor(None, retrieve, session_id, "con", topic, 2)

        if human_side == Side.pro:
            pro_full = f"{human_opening}\n\n{human_rebuttal}"
            con_full = f"{ai_opening}\n\n{ai_rebuttal_content}"
        else:
            pro_full = f"{ai_opening}\n\n{ai_rebuttal_content}"
            con_full = f"{human_opening}\n\n{human_rebuttal}"

        yield _sse("argument_start", {"side": "judge", "round_name": "verdict"})

        verdict_content = ""
        async for kind, data in generate_argument_streaming(
            topic, Side.judge, "verdict", judge_chunks, [pro_full, con_full]
        ):
            if kind == "token":
                yield _sse("token", {"side": "judge", "round_name": "verdict", "delta": data})
            else:
                verdict_content = data.content

        yield _sse("argument", {
            "side": "judge",
            "round_name": "verdict",
            "content": verdict_content,
            "citations": [],
        })

        winner = extract_winner(verdict_content)
        yield _sse("winner", {"winner": winner})

        row = db.query(HumanDebate).filter(HumanDebate.id == session_id).first()
        if row:
            row.verdict_content = verdict_content
            row.winner = winner
            row.status = "complete"
            db.commit()

        yield _sse("complete", {"session_id": session_id, "winner": winner})

    except Exception as e:
        yield _sse("error", {"message": str(e)})
