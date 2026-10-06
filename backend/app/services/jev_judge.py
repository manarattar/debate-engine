"""Typed debate decisions from Jev. Network failures leave the rubric available."""

import time
from concurrent.futures import ThreadPoolExecutor

import httpx

from app.config import get_settings
from app.services.scorecard import CRITERIA, compute_scorecard_from_probabilities
from app.services.debate_agent import build_transcript

JEV_URL = "https://api.typesafe.ai/v1/systemone"
INSTRUCTIONS = {
    "evidence": "Which side backed its claims with more specific, relevant evidence and sources?",
    "responsiveness": "Which side answered the opponent's actual points more directly (rebuttals, cross-examination answers)?",
    "logic": "Which side's reasoning was more internally consistent and free of fallacies?",
    "persuasion": "Which side communicated its case more clearly and convincingly?",
}


def jev_available() -> bool:
    return bool(get_settings().typesafe_api_key.strip())


def _questions(swapped):
    sides = ("CON", "PRO") if swapped else ("PRO", "CON")
    return {key: {"type": "choice", "instructions": INSTRUCTIONS[key],
                  "criteria": {sides[0]: f"{sides[0]} was stronger on this",
                               sides[1]: f"{sides[1]} was stronger on this",
                               "EVEN": "Neither side was clearly stronger"}}
            for key, _, _ in CRITERIA}


def _request(client, settings, topic, transcript, swapped):
    response = client.post(JEV_URL,
                           headers={"Authorization": f"Bearer {settings.typesafe_api_key}"},
                           json={"state": {"topic": topic, "debate": transcript},
                                 "questions": _questions(swapped), "model": settings.jev_model})
    response.raise_for_status()
    data = response.json()
    result = {}
    for key, _, _ in CRITERIA:
        answer = data.get("answers", {}).get(key)
        if not isinstance(answer, dict):
            continue
        try:
            probabilities = answer["probabilities"]
            result[key] = {"PRO": probabilities["CON" if swapped else "PRO"],
                           "CON": probabilities["PRO" if swapped else "CON"],
                           "EVEN": probabilities["EVEN"], "confidence": answer["confidence"]}
        except (KeyError, TypeError):
            continue
    return result, data.get("model", settings.jev_model)


def judge_jev(topic, pro_args, con_args):
    """Run both positions in parallel and return a Jev scorecard or None."""
    if not jev_available():
        return None
    settings = get_settings()
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=30.0) as client, ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(_request, client, settings, topic,
                                   build_transcript(pro_args, con_args, swap=swapped), swapped)
                       for swapped in (False, True)]
            runs = []
            for future in futures:
                try:
                    runs.append(future.result())
                except Exception:
                    runs.append(None)
        available = [run for run in runs if run and run[0]]
        if not available:
            return None
        merged = {}
        for key, _, _ in CRITERIA:
            values = [run[0][key] for run in available if key in run[0]]
            if values:
                merged[key] = {field: sum(float(v[field]) for v in values) / len(values)
                               for field in ("PRO", "CON", "EVEN", "confidence")}
        if not merged:
            return None
        disagreed = False
        if len(available) == 2:
            cards = [compute_scorecard_from_probabilities(run[0], {}) for run in available]
            disagreed = all(cards) and cards[0]["winner"] != cards[1]["winner"]
        meta = {"model": available[0][1], "latency_ms": round((time.perf_counter() - started) * 1000),
                "disagreed": disagreed, "single_run": len(available) == 1}
        return compute_scorecard_from_probabilities(merged, meta)
    except Exception:
        return None
