import json
import re
from datetime import datetime, timezone
from tavily import TavilyClient
from openai import OpenAI
from app.config import get_settings
from app.schemas import FactCheckClaim, FactCheckReport

settings = get_settings()

_EXTRACT_SYSTEM = """You are a fact-checking analyst. Extract specific, verifiable factual claims from debate arguments.
Focus only on concrete assertions — statistics, causal claims, historical facts — not opinions or predictions.
Return ONLY valid JSON."""

_VERIFY_SYSTEM = """You are an impartial fact-checker. Assess whether a claim is supported by provided web sources.
Verdicts: "verified" (clearly supported), "contested" (sources disagree), "misleading" (contradicts sources), "unverifiable" (no relevant sources).
Return ONLY valid JSON."""


def _llm_client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)


def _tavily_client() -> TavilyClient:
    return TavilyClient(api_key=settings.tavily_api_key)


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.MULTILINE).strip()
    text = re.sub(r"```$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)


def _extract_claims(topic: str, pro_content: str, con_content: str) -> list[dict]:
    prompt = f"""Debate topic: "{topic}"

PRO side arguments:
{pro_content[:1500]}

CON side arguments:
{con_content[:1500]}

Extract exactly 4 specific, verifiable factual claims from these arguments (mix of pro and con).
Return ONLY valid JSON:
{{"claims": [{{"claim": "...", "side": "pro"}}, ...]}}"""

    client = _llm_client()
    resp = client.chat.completions.create(
        model=settings.model_name,
        messages=[
            {"role": "system", "content": _EXTRACT_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=400,
    )
    try:
        data = _parse_json(resp.choices[0].message.content)
        return data.get("claims", [])[:4]
    except Exception:
        return []


def _search_claim(claim: str) -> tuple[str, list[str]]:
    try:
        client = _tavily_client()
        results = client.search(
            query=claim,
            search_depth="basic",
            max_results=3,
        )
        snippets = []
        urls = []
        for r in results.get("results", []):
            content = r.get("content") or r.get("raw_content") or ""
            snippets.append(f"[{r.get('title', '')}] {content[:300]}")
            urls.append(r.get("url", ""))
        return "\n\n".join(snippets), [u for u in urls if u]
    except Exception:
        return "", []


def _assess_claim(claim: str, side: str, search_text: str) -> dict:
    if not search_text.strip():
        return {"verdict": "unverifiable", "confidence": "Low", "evidence": "No relevant sources found."}

    prompt = f"""Claim: "{claim}"
Made by: {side} side

Web sources:
{search_text}

Assess the claim. Return ONLY valid JSON:
{{"verdict": "verified|contested|misleading|unverifiable", "confidence": "High|Medium|Low", "evidence": "one sentence"}}"""

    client = _llm_client()
    resp = client.chat.completions.create(
        model=settings.model_name,
        messages=[
            {"role": "system", "content": _VERIFY_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=150,
    )
    try:
        return _parse_json(resp.choices[0].message.content)
    except Exception:
        return {"verdict": "unverifiable", "confidence": "Low", "evidence": "Could not assess claim."}


def run_fact_check(debate_id: str, topic: str, pro_content: str, con_content: str) -> FactCheckReport:
    raw_claims = _extract_claims(topic, pro_content, con_content)

    results: list[FactCheckClaim] = []
    for c in raw_claims:
        claim_text = c.get("claim", "")
        side = c.get("side", "pro")
        if not claim_text:
            continue
        search_text, sources = _search_claim(claim_text)
        assessment = _assess_claim(claim_text, side, search_text)
        results.append(FactCheckClaim(
            claim=claim_text,
            side=side,
            verdict=assessment.get("verdict", "unverifiable"),
            confidence=assessment.get("confidence", "Low"),
            evidence=assessment.get("evidence", ""),
            sources=sources[:2],
        ))

    return FactCheckReport(
        debate_id=debate_id,
        topic=topic,
        claims=results,
        checked_at=datetime.now(timezone.utc).isoformat(),
    )
