import { useEffect, useState } from "react";

const WINNER_STYLES = {
  pro: { label: "THE MOTION IS UPHELD", color: "text-sky-400", border: "border-sky-500/30", bg: "" },
  con: { label: "THE MOTION FAILS", color: "text-rose-400", border: "border-rose-500/30", bg: "" },
  tie: { label: "THE MATTER IS UNRESOLVED", color: "text-amber-400", border: "border-amber-500/30", bg: "" },
};

export default function JudgeVerdict({ verdict, winner, streaming = false }) {
  const [showSources, setShowSources] = useState(false);
  const [revealed, setRevealed] = useState(streaming);

  // Animate the winner banner in once streaming stops
  useEffect(() => {
    if (!streaming && winner) {
      const t = setTimeout(() => setRevealed(true), 120);
      return () => clearTimeout(t);
    }
  }, [streaming, winner]);

  const style = WINNER_STYLES[winner] || WINNER_STYLES.tie;

  return (
    <div className={`border-t-2 border-b ${style.border} border-x-0 py-6 argument-judge transition-all duration-500`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-lg">⚖</span>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-mono">Ruling of the Tribunal</p>
            {/* Winner banner — slides in after streaming ends */}
            <div
              className={`transition-all duration-700 ease-out overflow-hidden ${
                revealed && !streaming ? "max-h-10 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"
              }`}
              style={{ transform: revealed && !streaming ? "translateY(0)" : "translateY(-8px)" }}
            >
              <span className={`text-xl font-bold ${style.color}`}>{style.label}</span>
            </div>
            {streaming && (
              <span className="text-sm text-slate-500 animate-pulse">Deliberating...</span>
            )}
          </div>
        </div>
        {verdict.citations?.length > 0 && (
          <button
            onClick={() => setShowSources(!showSources)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {verdict.citations.length} ref{verdict.citations.length !== 1 ? "s" : ""}{" "}
            {showSources ? "▲" : "▼"}
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
