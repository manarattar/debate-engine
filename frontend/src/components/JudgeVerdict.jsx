import { useState } from "react";

const WINNER_STYLES = {
  pro: { label: "PRO WINS", color: "text-emerald-400", border: "border-emerald-500/40", glow: "shadow-emerald-900/50" },
  con: { label: "CON WINS", color: "text-red-400", border: "border-red-500/40", glow: "shadow-red-900/50" },
  tie: { label: "TIE", color: "text-yellow-400", border: "border-yellow-500/40", glow: "shadow-yellow-900/50" },
};

export default function JudgeVerdict({ verdict, winner, streaming = false }) {
  const [showSources, setShowSources] = useState(false);
  const style = WINNER_STYLES[winner] || WINNER_STYLES.tie;

  return (
    <div className={`border-2 ${style.border} bg-slate-900 rounded-2xl p-6 shadow-lg ${style.glow}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚖️</span>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest">Judge's Verdict</p>
            <span className={`text-xl font-bold ${style.color}`}>{style.label}</span>
          </div>
        </div>
        {verdict.citations?.length > 0 && (
          <button
            onClick={() => setShowSources(!showSources)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {verdict.citations.length} ref{verdict.citations.length !== 1 ? "s" : ""} {showSources ? "▲" : "▼"}
          </button>
        )}
      </div>

      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
        {verdict.content}
        {streaming && <span className="animate-pulse text-yellow-400">▌</span>}
      </p>

      {showSources && verdict.citations?.length > 0 && (
        <div className="mt-4 border border-slate-700 rounded-lg p-3 flex flex-col gap-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">References</p>
          {verdict.citations.map((c, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-slate-500 font-mono shrink-0">[{c.index}]</span>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline truncate"
              >
                {c.title || c.url}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
