"""Run synthetic Jev position checks. Diagnostic; always exits successfully."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas import Argument, Side
from app.services.jev_judge import jev_available, judge_jev


def argument(side, text):
    return Argument(side=side, round_name="opening", content=text)


def main():
    if not jev_available():
        print("TYPESAFE_API_KEY is not configured")
        return
    cases = {
        "PRO favoured": ("PRO cites a randomized study of 10,000 participants, names its source, explains the causal mechanism, and directly answers the objections with data.",
                         "CON makes an unsupported assertion and does not answer the evidence."),
        "CON favoured": ("PRO makes an unsupported assertion and does not answer the evidence.",
                         "CON cites a randomized study of 10,000 participants, names its source, explains the causal mechanism, and directly answers the objections with data."),
        "Balanced": ("PRO gives a sourced, coherent case and answers one objection.",
                     "CON gives an equally sourced, coherent case and answers one objection."),
    }
    print(f"{'case':<16} {'winner':<8} {'margin':<8} {'confidence':<14} mirror flips")
    for name, (pro_text, con_text) in cases.items():
        original = judge_jev("Which side argued more effectively?", [argument(Side.pro, pro_text)], [argument(Side.con, con_text)])
        mirror = judge_jev("Which side argued more effectively?", [argument(Side.pro, con_text)], [argument(Side.con, pro_text)])
        flips = bool(original and mirror and (original["winner"] == mirror["winner"] == "tie"
                                          or {original["winner"], mirror["winner"]} == {"pro", "con"}))
        for label, card in ((name, original), (name + " mirror", mirror)):
            print(f"{label:<16} {card['winner'] if card else 'error':<8} {card['margin'] if card else '-':<8} {card['confidence'] if card else '-':<14} {flips}")


if __name__ == "__main__":
    main()
