import re

from app.config import get_settings
from tavily import TavilyClient

settings = get_settings()


def _make_client() -> TavilyClient:
    return TavilyClient(api_key=settings.tavily_api_key)


def _chunk_text(text: str, max_chars: int = 300) -> list[str]:
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


def collect_sources(queries: list[str], max_per_query: int = 2) -> list[dict]:
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
                sources.append(
                    {
                        "title": r.get("title", ""),
                        "url": url,
                        "excerpt": chunks[0],  # 1 chunk per article max
                    }
                )
        except Exception:
            continue

    return sources
