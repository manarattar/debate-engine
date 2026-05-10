import { useState, useEffect } from "react";
import { getHistory } from "../api";

const WINNER_BADGE = {
  pro: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  con: "bg-red-500/20 text-red-400 border-red-500/30",
  tie: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  unknown: "bg-slate-700 text-slate-400 border-slate-600",
};

export default function HistoryPanel({ onSelect, currentTopic, isOpen, onClose }) {
  const [history, setHistory] = useState([]);

  const load = async () => {
    try {
      const data = await getHistory();
      setHistory(data);
    } catch {}
  };

  useEffect(() => {
    load();
    window._refreshDebateHistory = load;
    return () => { delete window._refreshDebateHistory; };
  }, []);

  const items = (
    <div className="flex-1 overflow-y-auto">
      {history.length === 0 ? (
        <p className="text-slate-600 text-xs text-center p-6">No debates yet</p>
      ) : (
        history.map((d) => (
          <button
            key={d.debate_id}
            onClick={() => { onSelect(d); onClose?.(); }}
            className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
              currentTopic === d.topic ? "bg-slate-800/60" : ""
            }`}
          >
            <p className="text-slate-300 text-xs line-clamp-2 mb-1">{d.topic}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${WINNER_BADGE[d.winner] || WINNER_BADGE.unknown}`}>
              {d.winner?.toUpperCase() || "?"}
            </span>
          </button>
        ))
      )}
    </div>
  );

  const header = (
    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
      <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Past Debates</h3>
      <button
        onClick={onClose}
        className="md:hidden text-slate-500 hover:text-slate-300 text-lg leading-none"
      >
        ✕
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on md+, hidden on mobile */}
      {history.length > 0 && (
        <div className="hidden md:flex w-64 shrink-0 border-r border-slate-800 flex-col">
          {header}
          {items}
        </div>
      )}

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-64 bg-[#0a0a0f] border-r border-slate-800 flex flex-col">
            {header}
            {items}
          </div>
          <div className="flex-1 bg-black/60" onClick={onClose} />
        </div>
      )}
    </>
  );
}
