import json
import re
from html import escape
from urllib.parse import quote

from app.database import Debate, get_db
from app.services.og_image import render_debate_card
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

router = APIRouter()

SITE_URL = "https://munazara.manarattar.com"
DEFAULT_IMAGE = f"{SITE_URL}/og-image.png"

# Link-preview crawlers read the tags on this page; redirecting them would make
# them scrape the SPA shell and show the generic card instead.
_CRAWLER_RE = re.compile(
    r"linkedinbot|whatsapp|facebookexternalhit|facebot|twitterbot|slackbot|"
    r"telegrambot|discordbot|skypeuripreview|embedly|pinterest|redditbot",
    re.IGNORECASE,
)


def _load(db: Session, debate_id: str) -> tuple[str, str | None]:
    """Return (topic, winner) for a debate, or ("", None) if unknown."""
    debate = db.query(Debate).filter(Debate.id == debate_id).first()
    if not debate:
        return "", None
    if debate.result_json:
        result = json.loads(debate.result_json)
        return result.get("topic") or debate.topic or "", result.get("winner")
    return debate.topic or "", None


@router.get("/share/{debate_id}/image.png")
def share_image(debate_id: str, db: Session = Depends(get_db)):
    topic, winner = _load(db, debate_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Debate not found")
    return Response(
        render_debate_card(topic, winner),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/share", response_class=HTMLResponse)
def share_debate(request: Request, id: str = "", db: Session = Depends(get_db)):
    """Serve OG/Twitter preview tags for a debate, then redirect to the SPA."""
    topic, winner = _load(db, id) if id else ("", None)

    title = (
        f"{topic} | Munazara"
        if topic
        else "Munazara — AI Debate, Both Sides, Real Sources"
    )
    if topic and winner in ("pro", "con"):
        description = (
            f"Two AI agents argued both sides with real sources — "
            f"the judge ruled for {winner.upper()}. See the full debate on Munazara."
        )
    elif topic:
        description = (
            "Two AI agents argue both sides with real sources, cross-examination, "
            "and a judge's verdict. See the full debate on Munazara."
        )
    else:
        description = (
            "Watch two AI debaters argue any topic with sources, "
            "cross-examination, and a judge verdict."
        )

    safe_id = quote(id, safe="")
    debate_url = f"{SITE_URL}/?debate={safe_id}" if topic else SITE_URL
    share_url = f"{SITE_URL}/api/share?id={safe_id}" if topic else SITE_URL
    # winner in the query string busts preview caches once a verdict lands
    image = (
        f"{SITE_URL}/api/share/{safe_id}/image.png?v={winner or 'open'}"
        if topic
        else DEFAULT_IMAGE
    )
    t, d, u, s, i = (
        escape(x) for x in (title, description, debate_url, share_url, image)
    )
    alt = escape(f"Munazara AI debate: {topic}" if topic else "Munazara AI debate")

    redirect = ""
    if not _CRAWLER_RE.search(request.headers.get("user-agent", "")):
        js_url = json.dumps(debate_url).replace("</", "<\\/")
        redirect = (
            f'  <meta http-equiv="refresh" content="0; url={u}" />\n'
            f"  <script>window.location.replace({js_url});</script>\n"
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{t}</title>
  <meta name="description" content="{d}" />
  <link rel="canonical" href="{u}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Munazara" />
  <meta property="og:title" content="{t}" />
  <meta property="og:description" content="{d}" />
  <meta property="og:url" content="{s}" />
  <meta property="og:image" content="{i}" />
  <meta property="og:image:secure_url" content="{i}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{alt}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{t}" />
  <meta name="twitter:description" content="{d}" />
  <meta name="twitter:image" content="{i}" />
{redirect}</head>
<body>
  <p style="font-family:sans-serif;color:#888;padding:2rem">
    <a href="{u}">Open the debate on Munazara</a>
  </p>
</body>
</html>"""
    return HTMLResponse(html, headers={"Cache-Control": "public, max-age=300"})
