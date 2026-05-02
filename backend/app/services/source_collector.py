from tavily import TavilyClient
from app.config import get_settings
import re

settings = get_settings()


def _make_client() -> TavilyClient:
    return TavilyClient(api_key=settings.tavily_api_key)


def _chunk_text(text: str, max_chars: int = 400) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks, current = [], ""
    for sentence in sentences:
        if len(current) + len(sentence) > max_chars and current:
            chunks.append(current.strip())
            current = sentence
        else:
            current += " " + sentence
    if current.strip():
        chunks.append(current.strip())
    return chunks or [text[:max_chars]]


def collect_sources(queries: list[str], max_per_query: int = 3) -> list[dict]:
    """Run Tavily searches and return chunked source dicts."""
    client = _make_client()
    seen_urls = set()
    sources = []

    for query in queries:
        try:
            results = client.search(
                query=query,
                search_depth="basic",
                max_results=max_per_query,
                include_raw_content=True,
            )
            for r in results.get("results", []):
                url = r.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                raw = r.get("raw_content") or r.get("content") or ""
                chunks = _chunk_text(raw)
                for chunk in chunks[:2]:  # max 2 chunks per article
                    sources.append({
                        "title": r.get("title", ""),
                        "url": url,
                        "excerpt": chunk,
                    })
        except Exception:
            continue

    return sources
