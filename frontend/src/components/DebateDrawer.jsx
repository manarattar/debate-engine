import { useEffect, useState } from "react";
import { getDebate } from "../api";
import Icon from "./Icon";

const WINNER_STYLES = {
  pro: ["Pro wins", "bg-sky-950 text-sky-400 border-sky-800"],
  con: ["Con wins", "bg-rose-950 text-rose-400 border-rose-800"],
  tie: ["Tie", "bg-slate-800 text-slate-400 border-slate-700"],
};

function WinnerBadge({ winner }) {
  if (!winner) return null;
  const [label, cls] = WINNER_STYLES[winner] ?? WINNER_STYLES.tie;
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border self-start ${cls}`}>
      {label}
    </span>
  );
}

export default function DebateDrawer({ debateId, onClose, onViewFull }) {
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debateId) {
      setDebate(null);
      return;
    }
    setLoading(true);
    getDebate(debateId)
      .then(setDebate)
      .catch(() => setDebate(null))
      .finally(() => setLoading(false));
  }, [debateId]);

  const isOpen = !!debateId;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300
          ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[480px] z-50
          bg-[#0d0d17] border-l border-slate-800 flex flex-col
          transition-transform duration-300
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <span className="text-slate-400 text-sm font-medium">Past Debate</span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {loading && (
            <div className="text-slate-500 text-sm animate-pulse">Loading debate…</div>
          )}

          {!loading && !debate && debateId && (
            <div className="text-slate-600 text-sm">Could not load debate.</div>
          )}

          {!loading && debate && (
            <>
              <h2 className="text-white text-xl font-semibold leading-snug">
                "{debate.topic}"
              </h2>

              <WinnerBadge winner={debate.winner} />

              {debate.verdict?.content && (
                <div>
                  <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">
                    Judge's Verdict
                  </p>
                  <p className="text-slate-300 text-sm leading-relaxed line-clamp-8">
                    {debate.verdict.content}
                  </p>
                </div>
              )}

              <p className="text-slate-600 text-xs inline-flex items-center gap-1">
                <Icon name="eye" size={12} /> {debate.view_count ?? 0} views
              </p>
            </>
          )}
        </div>

        {/* Footer CTA */}
        {!loading && debate && (
          <div className="px-6 py-4 border-t border-slate-800 shrink-0">
            <button
              onClick={() => onViewFull(debate)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-colors"
            >
              View Full Debate →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
