"""Render 1200x630 link-preview cards (LinkedIn, WhatsApp, X) for a debate."""

import io
import math
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
PAD = 80
FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

BG_TOP = (10, 10, 15)
BG_BOTTOM = (26, 16, 40)
VIOLET = (167, 139, 250)
VIOLET_DEEP = (124, 58, 237)
WHITE = (248, 250, 252)
MUTED = (148, 163, 184)
PRO = (16, 185, 129)
CON = (239, 68, 68)
GOLD = (251, 191, 36)


def _font(weight: int, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"ReadexPro-{weight}.ttf"), size)


def _background() -> Image.Image:
    mask = Image.linear_gradient("L").resize((W, H))
    img = Image.composite(
        Image.new("RGB", (W, H), BG_BOTTOM), Image.new("RGB", (W, H), BG_TOP), mask
    )
    # Soft PRO / CON glows on either side, violet glow behind the logo
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((-260, 330, 380, 800), fill=(8, 70, 52))
    g.ellipse((820, 330, 1460, 800), fill=(90, 22, 22))
    g.ellipse((-120, -200, 420, 260), fill=(52, 24, 100))
    return ImageChops.add(img, glow.filter(ImageFilter.GaussianBlur(120)))


def _star(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float) -> None:
    """The Munazara 8-pointed star logo mark."""
    outer, inner = r, r * 0.46
    pts = []
    for i in range(16):
        rad = outer if i % 2 == 0 else inner
        a = math.pi / 2 - i * math.pi / 8
        pts.append((cx + rad * math.cos(a), cy - rad * math.sin(a)))
    draw.polygon(pts, fill=VIOLET)
    draw.ellipse((cx - r * 0.2, cy - r * 0.2, cx + r * 0.2, cy + r * 0.2), fill=BG_TOP)


def _wrap(draw, text: str, font, max_w: int) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def _fit_topic(draw, topic: str, max_w: int, max_h: int):
    """Largest font size at which the topic fits; ellipsize as a last resort."""
    for size in range(72, 39, -4):
        font = _font(700, size)
        lines = _wrap(draw, topic, font, max_w)
        if len(lines) * size * 1.18 <= max_h:
            return font, lines, size
    font, size = _font(700, 40), 40
    lines = _wrap(draw, topic, font, max_w)
    max_lines = int(max_h // (size * 1.18))
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and draw.textlength(lines[-1] + "…", font=font) > max_w:
            lines[-1] = (
                lines[-1].rsplit(" ", 1)[0] if " " in lines[-1] else lines[-1][:-1]
            )
        lines[-1] += "…"
    return font, lines, size


def _pill(draw, x: int, y: int, label: str, color, font) -> int:
    """Draw a rounded tag; return its right edge."""
    w = int(draw.textlength(label, font=font)) + 44
    draw.rounded_rectangle((x, y, x + w, y + 48), radius=24, outline=color, width=3)
    draw.text((x + w / 2, y + 24), label, font=font, fill=color, anchor="mm")
    return x + w


@lru_cache(maxsize=256)
def render_debate_card(topic: str, winner: str | None) -> bytes:
    img = _background()
    draw = ImageDraw.Draw(img)

    # Brand row
    _star(draw, PAD + 22, PAD + 22, 24)
    draw.text(
        (PAD + 60, PAD + 22), "MUNAZARA", font=_font(700, 30), fill=WHITE, anchor="lm"
    )
    draw.text(
        (W - PAD, PAD + 22), "AI DEBATE", font=_font(600, 22), fill=VIOLET, anchor="rm"
    )

    # Topic, with an accent bar on the left
    top, bottom = 175, 470
    font, lines, size = _fit_topic(draw, topic, W - 2 * PAD - 30, bottom - top)
    line_h = size * 1.18
    block_h = len(lines) * line_h
    y = top + (bottom - top - block_h) / 2
    draw.rounded_rectangle(
        (PAD, y + 6, PAD + 7, y + block_h - 6), radius=4, fill=VIOLET_DEEP
    )
    for i, line in enumerate(lines):
        draw.text((PAD + 30, y + i * line_h), line, font=font, fill=WHITE)

    # Footer: PRO vs CON, verdict, domain
    fy = H - PAD - 48
    tag = _font(600, 22)
    x = _pill(draw, PAD, fy, "PRO", PRO, tag)
    draw.text((x + 24, fy + 24), "vs", font=_font(400, 24), fill=MUTED, anchor="lm")
    x = _pill(draw, x + 60, fy, "CON", CON, tag)
    w = (winner or "").lower()
    if w in ("pro", "con", "tie"):
        verdict = "Verdict: tie" if w == "tie" else f"Verdict: {w.upper()} wins"
        draw.text(
            (x + 32, fy + 24), verdict, font=_font(600, 24), fill=GOLD, anchor="lm"
        )
    draw.text(
        (W - PAD, fy + 24),
        "munazara.manarattar.com",
        font=_font(400, 22),
        fill=MUTED,
        anchor="rm",
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
