import { useState, useEffect } from "react";
import { getHistory } from "../api";

const WINNER_BADGE = {
  pro: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  con: "bg-red-500/20 text-red-400 border-red-500/30",
  tie: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  unknown: "bg-slate-700 text-slate-400 border-slate-600",
};

export default function HistoryPanel({ onSelect, currentTopic }) {
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

  if (history.length === 0) return null;

  return (
    <div className="w-64 shrink-0 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Past Debates</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {history.map((d) => (
          <button
            key={d.debate_id}
            onClick={() => onSelect(d)}
            className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
              currentTopic === d.topic ? "bg-slate-800/60" : ""
            }`}
          >
            <p className="text-slate-300 text-xs line-clamp-2 mb-1">{d.topic}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${WINNER_BADGE[d.winner] || WINNER_BADGE.unknown}`}>
              {d.winner?.toUpperCase() || "?"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
