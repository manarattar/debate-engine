"""Pure rubric aggregation for the debate judge."""

import math

CRITERIA = [
    ("evidence", "Evidence & sources", 0.30),
    ("responsiveness", "Answering the opponent", 0.25),
    ("logic", "Logic & consistency", 0.25),
    ("persuasion", "Clarity & persuasion", 0.20),
]


def _score(value):
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
        return max(1, min(10, number))
    except (TypeError, ValueError, OverflowError):
        return None


def clean_scores(raw_scores):
    if not isinstance(raw_scores, dict):
        return {}
    cleaned = {}
    for key, _, _ in CRITERIA:
        pair = raw_scores.get(key)
        if isinstance(pair, dict):
            pro, con = _score(pair.get("pro")), _score(pair.get("con"))
            if pro is not None and con is not None:
                cleaned[key] = {"pro": pro, "con": con}
    return cleaned


def compute_scorecard(raw_scores):
    scores = clean_scores(raw_scores)
    weight_sum = sum(weight for key, _, weight in CRITERIA if key in scores)
    if not weight_sum:
        return None
    criteria = []
    for key, label, weight in CRITERIA:
        if key not in scores:
            continue
        pro, con = scores[key]["pro"], scores[key]["con"]
        criteria.append({"key": key, "label": label,
                         "weight": round(weight / weight_sum, 4),
                         "pro": pro, "con": con,
                         "leader": "pro" if pro > con else "con" if con > pro else "even"})
    pro_total = round(sum(item["pro"] * item["weight"] for item in criteria), 1)
    con_total = round(sum(item["con"] * item["weight"] for item in criteria), 1)
    margin = round(abs(pro_total - con_total), 1)
    confidence = ("decisive" if margin >= 2.5 else "clear" if margin >= 1.5
                  else "narrow" if margin >= 0.5 else "too_close")
    winner = "tie" if margin < 0.5 else "pro" if pro_total > con_total else "con"
    return {"criteria": criteria, "pro_total": pro_total, "con_total": con_total,
            "margin": margin, "winner": winner, "confidence": confidence,
            "method": "llm-rubric"}


def compute_scorecard_from_probabilities(per_criterion, meta):
    if not isinstance(per_criterion, dict):
        return None
    valid = {}
    for key, _, weight in CRITERIA:
        item = per_criterion.get(key)
        if not isinstance(item, dict):
            continue
        try:
            probabilities = {side: float(item[side]) for side in ("PRO", "CON", "EVEN")}
            confidence = float(item["confidence"])
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        if (not all(math.isfinite(p) and p >= 0 for p in probabilities.values())
                or not math.isfinite(confidence) or sum(probabilities.values()) <= 0):
            continue
        total = sum(probabilities.values())
        probabilities = {side: p / total for side, p in probabilities.items()}
        valid[key] = (probabilities, max(0, min(1, confidence)), weight)
    if not valid:
        return None
    weight_sum = sum(value[2] for value in valid.values())
    criteria = []
    for key, label, _ in CRITERIA:
        if key not in valid:
            continue
        p, confidence, weight = valid[key]
        leader = ("even" if p["EVEN"] >= max(p["PRO"], p["CON"]) or abs(p["PRO"] - p["CON"]) < 0.10
                  else "pro" if p["PRO"] > p["CON"] else "con")
        criteria.append({"key": key, "label": label, "weight": round(weight / weight_sum, 4),
                         "pro": round(10 * (p["PRO"] + 0.5 * p["EVEN"]), 1),
                         "con": round(10 * (p["CON"] + 0.5 * p["EVEN"]), 1),
                         "leader": leader, "probabilities": p, "confidence": confidence})
    pro_total = round(sum(item["pro"] * item["weight"] for item in criteria), 1)
    con_total = round(sum(item["con"] * item["weight"] for item in criteria), 1)
    margin = round(abs(pro_total - con_total), 1)
    band = "too_close" if margin < 1 else "narrow" if margin < 2 else "clear" if margin < 4 else "decisive"
    meta = meta or {}
    if (sum(item["confidence"] for item in criteria) / len(criteria) < 0.20
            or meta.get("disagreed") or meta.get("single_run")) and band in ("clear", "decisive"):
        band = "narrow"
    return {"criteria": criteria, "pro_total": pro_total, "con_total": con_total,
            "margin": margin, "winner": "tie" if margin < 1 else "pro" if pro_total > con_total else "con",
            "confidence": band, "method": "jev", "model": meta.get("model"),
            "latency_ms": meta.get("latency_ms")}


def merge_swapped(a, b):
    """Combine original and already un-swapped rubric scores."""
    left, right = clean_scores(a), clean_scores(b)
    if not left and not right:
        return None
    if not left:
        return compute_scorecard(right)
    if not right:
        return compute_scorecard(left)
    merged = {}
    for key in left.keys() | right.keys():
        if key in left and key in right:
            merged[key] = {side: (left[key][side] + right[key][side]) / 2
                           for side in ("pro", "con")}
        else:
            merged[key] = left.get(key, right.get(key))
    result = compute_scorecard(merged)
    first, second = compute_scorecard(left), compute_scorecard(right)
    if first["winner"] != second["winner"] and result["confidence"] in ("clear", "decisive"):
        result["confidence"] = "narrow"
    return result
