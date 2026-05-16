import io
import json
import textwrap
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

from app.database import Debate, get_db

router = APIRouter()

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

ROUND_ORDER = [
    "opening",
    "cross_pro_questions",
    "cross_con_answers",
    "cross_con_questions",
    "cross_pro_answers",
    "rebuttal",
    "closing",
    "verdict",
]

ROUND_LABELS = {
    "opening": "Opening Statement",
    "rebuttal": "Rebuttal",
    "cross_pro_questions": "Cross-Exam: PRO Questions",
    "cross_con_answers": "Cross-Exam: CON Answers",
    "cross_con_questions": "Cross-Exam: CON Questions",
    "cross_pro_answers": "Cross-Exam: PRO Answers",
    "closing": "Closing Statement",
    "verdict": "Judge's Verdict",
}


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontSize=18,
            textColor=colors.HexColor("#e2e8f0"),
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#94a3b8"),
            spaceAfter=16,
        ),
        "section": ParagraphStyle(
            "section",
            parent=base["Heading2"],
            fontSize=11,
            textColor=colors.HexColor("#a78bfa"),
            spaceBefore=14,
            spaceAfter=4,
        ),
        "pro": ParagraphStyle(
            "pro",
            parent=base["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#d1fae5"),
            leading=14,
            leftIndent=10,
        ),
        "con": ParagraphStyle(
            "con",
            parent=base["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#fee2e2"),
            leading=14,
            leftIndent=10,
        ),
        "judge": ParagraphStyle(
            "judge",
            parent=base["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#e2e8f0"),
            leading=14,
            leftIndent=10,
        ),
        "label": ParagraphStyle(
            "label",
            parent=base["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=2,
        ),
        "winner": ParagraphStyle(
            "winner",
            parent=base["Normal"],
            fontSize=13,
            textColor=colors.HexColor("#fbbf24"),
            spaceBefore=10,
            spaceAfter=4,
        ),
    }


def _wrap(text: str, width: int = 90) -> str:
    lines = []
    for paragraph in text.split("\n"):
        if len(paragraph) <= width:
            lines.append(paragraph)
        else:
            lines.extend(textwrap.wrap(paragraph, width))
    return "\n".join(lines)


def _build_pdf(debate_id: str, result: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )
    styles = _styles()
    story = []

    topic = result.get("topic", "Debate")
    winner = result.get("winner", "").upper()
    created = datetime.now().strftime("%Y-%m-%d")

    story.append(Paragraph(f"Debate: {topic}", styles["title"]))
    story.append(
        Paragraph(f"ID: {debate_id}  •  Exported: {created}", styles["subtitle"])
    )
    story.append(
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#334155"))
    )
    story.append(Spacer(1, 0.3 * cm))

    if winner:
        winner_text = {
            "PRO": "Winner: PRO",
            "CON": "Winner: CON",
            "TIE": "Result: TIE",
        }.get(winner, f"Winner: {winner}")
        story.append(Paragraph(f"🏆 {winner_text}", styles["winner"]))
        story.append(Spacer(1, 0.2 * cm))

    # Collect all args indexed by round_name + side
    args_by_key: dict[str, dict] = {}
    for a in result.get("pro_arguments", []):
        args_by_key[f"pro_{a['round_name']}"] = a
    for a in result.get("con_arguments", []):
        args_by_key[f"con_{a['round_name']}"] = a
    verdict = result.get("verdict")

    for round_name in ROUND_ORDER:
        pro_key = f"pro_{round_name}"
        con_key = f"con_{round_name}"
        has_pro = pro_key in args_by_key
        has_con = con_key in args_by_key
        is_verdict = round_name == "verdict" and verdict

        if not (has_pro or has_con or is_verdict):
            continue

        label = ROUND_LABELS.get(round_name, round_name.replace("_", " ").title())
        story.append(Paragraph(label, styles["section"]))
        story.append(
            HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#1e293b"))
        )

        if is_verdict:
            story.append(Spacer(1, 0.15 * cm))
            story.append(Paragraph("[JUDGE]", styles["label"]))
            for line in _wrap(verdict["content"]).split("\n"):
                story.append(Paragraph(line or "&nbsp;", styles["judge"]))
        else:
            if has_pro:
                story.append(Spacer(1, 0.1 * cm))
                story.append(Paragraph("[PRO]", styles["label"]))
                for line in _wrap(args_by_key[pro_key]["content"]).split("\n"):
                    story.append(Paragraph(line or "&nbsp;", styles["pro"]))
            if has_con:
                story.append(Spacer(1, 0.1 * cm))
                story.append(Paragraph("[CON]", styles["label"]))
                for line in _wrap(args_by_key[con_key]["content"]).split("\n"):
                    story.append(Paragraph(line or "&nbsp;", styles["con"]))

        story.append(Spacer(1, 0.2 * cm))

    doc.build(story)
    return buf.getvalue()


@router.get("/debate/{debate_id}/pdf")
def export_debate_pdf(debate_id: str, db=Depends(get_db)):
    row = db.query(Debate).filter_by(id=debate_id).first()

    if not row or not row.result_json:
        raise HTTPException(
            status_code=404, detail="Debate not found or still processing"
        )

    result = json.loads(row.result_json)
    pdf_bytes = _build_pdf(debate_id, result)

    safe_topic = "".join(
        c if c.isalnum() or c in "-_ " else "" for c in result.get("topic", "debate")
    )[:40]
    filename = f"debate-{safe_topic.strip().replace(' ', '-')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
