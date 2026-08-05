import { useEffect, useState } from "react";
import { getHistory, getLeaderboard } from "../api";
import Icon from "./Icon";

const WINNER_BADGE = {
  pro: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  con: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  tie: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  unknown: "bg-slate-700 text-slate-400 border-slate-600",
};

const WINNER_ICON = { pro: "⬆", con: "⬇", tie: "⟺", unknown: "?" };

function ViewBadge({ count }) {
  if (!count) return null;
  return (
    <span className="text-xs text-slate-600 tabular-nums inline-flex items-center gap-1">
      <Icon name="eye" size={12} /> {count}
    </span>
  );
}

export default function HistoryPanel({ onSelect, currentTopic, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState("history"); // "history" | "top"
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const data = await getHistory();
      setHistory(data);
    } catch {}
  };

  const loadLeaderboard = async () => {
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch {}
  };

  useEffect(() => {
    load();
    window._refreshDebateHistory = load;
    return () => {
      delete window._refreshDebateHistory;
    };
  }, []);

  useEffect(() => {
    if (tab === "top") loadLeaderboard();
  }, [tab]);

  const filtered = history.filter((d) =>
    d.topic.toLowerCase().includes(search.toLowerCase())
  );

  const historyItems = (
    <div className="flex flex-col gap-0">
      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-800">
        <input
          type="text"
          placeholder="Search topics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800/60 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none placeholder-slate-600 border border-slate-700 focus:border-slate-500 transition-colors"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-slate-600 text-xs text-center p-6">
            {search ? "No matches" : "No debates yet"}
          </p>
        ) : (
          filtered.map((d) => (
            <button
              key={d.debate_id}
              onClick={() => {
                onSelect(d);
                onClose?.();
              }}
              className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
                currentTopic === d.topic ? "bg-slate-800/60" : ""
              }`}
            >
              <p className="text-slate-300 text-xs line-clamp-2 mb-1">{d.topic}</p>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${WINNER_BADGE[d.winner] || WINNER_BADGE.unknown}`}
                >
                  {WINNER_ICON[d.winner] || "?"} {d.winner?.toUpperCase() || "?"}
                </span>
                <ViewBadge count={d.view_count} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const leaderboardItems = (
    <div className="flex-1 overflow-y-auto">
      {leaderboard.length === 0 ? (
        <p className="text-slate-600 text-xs text-center p-6">No data yet</p>
      ) : (
        leaderboard.map((d, i) => (
          <button
            key={d.debate_id}
            onClick={() => {
              onSelect(d);
              onClose?.();
            }}
            className="w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-start gap-2">
              <span className="text-slate-500 text-xs font-mono w-5 shrink-0">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-300 text-xs line-clamp-2 mb-1">{d.topic}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full border ${WINNER_BADGE[d.winner] || WINNER_BADGE.unknown}`}
                  >
                    {d.winner?.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-600 inline-flex items-center gap-1"><Icon name="eye" size={12} /> {d.views}</span>
                  <span className="text-xs text-slate-600 inline-flex items-center gap-1"><Icon name="vote" size={12} /> {d.votes}</span>
                  <span className="text-xs text-slate-600 inline-flex items-center gap-1"><Icon name="thumbsUp" size={12} /> {d.reactions}</span>
                </div>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  const header = (
    <div className="shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Debates</h3>
        <button
          onClick={onClose}
          className="md:hidden text-slate-500 hover:text-slate-300 text-lg leading-none"
        >
          ✕
        </button>
      </div>
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            tab === "history"
              ? "text-amber-400 border-b-2 border-amber-500"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Recent
        </button>
        <button
          onClick={() => setTab("top")}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            tab === "top"
              ? "text-amber-400 border-b-2 border-amber-500"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Icon name="trophy" size={13} />Top</span>
        </button>
      </div>
    </div>
  );

  const body = tab === "history" ? historyItems : leaderboardItems;

  const hasContent = history.length > 0 || leaderboard.length > 0;

  return (
    <>
      {/* Desktop sidebar */}
      {hasContent && (
        <div className="hidden md:flex w-64 shrink-0 border-r border-slate-800 flex-col">
          {header}
          {body}
        </div>
      )}

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-72 bg-[#0a0a0f] border-r border-slate-800 flex flex-col">
            {header}
            {body}
          </div>
          <div className="flex-1 bg-black/60" onClick={onClose} />
        </div>
      )}
    </>
  );
}
