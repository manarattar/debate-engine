"""
Simple in-memory chunk store with keyword scoring.
No vector DB or ML model needed — works well for 20-30 chunks per debate.
"""

_store: dict[str, list[dict]] = {}


def index_sources(debate_id: str, side: str, sources: list[dict]):
    _store[f"{debate_id}_{side}"] = sources


def retrieve(debate_id: str, side: str, query: str, n: int = 4) -> list[dict]:
    chunks = _store.get(f"{debate_id}_{side}", [])
    if not chunks:
        return []
    query_words = set(query.lower().split())
    def score(chunk):
        text = (chunk.get("excerpt", "") + " " + chunk.get("title", "")).lower()
        return sum(1 for w in query_words if w in text)
    return sorted(chunks, key=score, reverse=True)[:n]


def delete_debate_collections(debate_id: str):
    for side in ("pro", "con"):
        _store.pop(f"{debate_id}_{side}", None)
