import { useState } from "react";

const SIDE_STYLES = {
  pro: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/20",
    badge: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    label: "PRO",
    icon: "✓",
    citationBg: "bg-emerald-900/30 border-emerald-700/30",
  },
  con: {
    border: "border-red-500/30",
    bg: "bg-red-950/20",
    badge: "bg-red-500/20 text-red-400 border border-red-500/30",
    label: "CON",
    icon: "✗",
    citationBg: "bg-red-900/30 border-red-700/30",
  },
};

const ROUND_LABELS = {
  opening: "Opening Statement",
  rebuttal: "Rebuttal",
  closing: "Closing Statement",
  verdict: "Judge's Verdict",
};

export default function ArgumentCard({ side, round_name, content, citations = [], streaming = false }) {
  const [showCitations, setShowCitations] = useState(false);
  const styles = SIDE_STYLES[side] || SIDE_STYLES.pro;

  return (
    <div className={`border ${styles.border} ${styles.bg} rounded-xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
            {styles.icon} {styles.label}
          </span>
          <span className="text-slate-400 text-sm">{ROUND_LABELS[round_name] || round_name}</span>
        </div>
        {citations.length > 0 && (
          <button
            onClick={() => setShowCitations(!showCitations)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {citations.length} source{citations.length !== 1 ? "s" : ""} {showCitations ? "▲" : "▼"}
          </button>
        )}
      </div>

      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
        {content}
        {streaming && <span className="animate-pulse text-violet-400">▌</span>}
      </p>

      {showCitations && citations.length > 0 && (
        <div className={`border ${styles.citationBg} rounded-lg p-3 flex flex-col gap-2`}>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Sources</p>
          {citations.map((c, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-slate-500 font-mono shrink-0">[{c.index}]</span>
              <div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline block truncate max-w-xs"
                >
                  {c.title || c.url}
                </a>
                <p className="text-slate-500 mt-0.5 line-clamp-2">{c.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
