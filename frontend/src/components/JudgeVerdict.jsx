import { useEffect, useState, useCallback } from "react";
import Icon from "./Icon";

const WINNER_STYLES = {
  pro: { label: "PRO WINS", color: "text-sky-400", border: "border-sky-500/30", bg: "" },
  con: { label: "CON WINS", color: "text-rose-400", border: "border-rose-500/30", bg: "" },
  tie: { label: "TIE", color: "text-amber-400", border: "border-amber-500/30", bg: "" },
};

export default function JudgeVerdict({ verdict, winner, scorecard = null, streaming = false }) {
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
    <div data-tour="verdict" className={`border-t-2 border-b ${style.border} border-x-0 py-6 argument-judge transition-all duration-500`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-slate-500"><Icon name="scale" size={18} /></span>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-mono">Judge's Verdict</p>
            {/* Winner banner — slides in after streaming ends */}
            <div
              className={`transition-all duration-700 ease-out overflow-hidden ${
                revealed && !streaming ? "max-h-10 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"
              }`}
              style={{ transform: revealed && !streaming ? "translateY(0)" : "translateY(-8px)" }}
            >
              <span className={`text-xl font-bold ${style.color}`}>{winner === "tie" && scorecard?.confidence === "too_close" ? "TOO CLOSE TO CALL" : style.label}</span>
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

      {scorecard && !streaming && (
        <div className="mb-5 rounded-lg border border-slate-700 bg-slate-900/60 p-3 sm:p-4 text-slate-200">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide">Scorecard</h3>
            <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-200">
              {{ decisive: "Decisive", clear: "Clear", narrow: "Narrow", too_close: "Too close to call" }[scorecard.confidence]}
            </span>
          </div>
          <div className="space-y-3">
            {scorecard.criteria.map((item) => (
              <div key={item.key} role="group" aria-label={item.probabilities ? `${item.label}: PRO ${Math.round(item.probabilities.PRO * 100)}%, EVEN ${Math.round(item.probabilities.EVEN * 100)}%, CON ${Math.round(item.probabilities.CON * 100)}%` : `${item.label}: PRO ${item.pro}, CON ${item.con}`}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="min-w-0 break-words">{item.label}{item.probabilities && item.confidence < 0.20 && <span className="ml-2 text-amber-300" title="Low confidence">low confidence</span>}</span>
                  {!item.probabilities && <span className="shrink-0 font-mono"><span className="text-sky-300">{item.pro}</span> / <span className="text-rose-300">{item.con}</span></span>}
                </div>
                {item.probabilities ? <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-700" aria-hidden="true">
                  <div className="bg-sky-400" style={{ width: `${item.probabilities.PRO * 100}%` }} />
                  <div className="bg-slate-400" style={{ width: `${item.probabilities.EVEN * 100}%` }} />
                  <div className="bg-rose-400" style={{ width: `${item.probabilities.CON * 100}%` }} />
                </div> : <div className="grid grid-cols-2 gap-1" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-slate-700"><div className="h-full rounded-full bg-sky-400" style={{ width: `${item.pro * 10}%` }} /></div>
                  <div className="h-1.5 rounded-full bg-slate-700"><div className="h-full rounded-full bg-rose-400" style={{ width: `${item.con * 10}%` }} /></div>
                </div>}
                {item.probabilities && <div className="mt-1 flex justify-between font-mono text-xs" aria-hidden="true"><span className="text-sky-300">PRO {Math.round(item.probabilities.PRO * 100)}%</span><span className="text-slate-400">EVEN {Math.round(item.probabilities.EVEN * 100)}%</span><span className="text-rose-300">CON {Math.round(item.probabilities.CON * 100)}%</span></div>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 pt-3 text-xs font-semibold">
            <span>Totals: <span className="text-sky-300">PRO {scorecard.pro_total.toFixed(1)}</span> / <span className="text-rose-300">CON {scorecard.con_total.toFixed(1)}</span></span>
            <span>Margin {scorecard.margin.toFixed(1)}</span>
          </div>
          {scorecard.method === "jev" && <p className="mt-3 text-xs text-slate-400">Scored by Jev, a decision model: each criterion is a probability, not a generated opinion.</p>}
        </div>
      )}

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

      {!streaming && <VerdictFeedback winner={winner} />}
    </div>
  );
}

function VerdictFeedback({ winner }) {
  const [rating, setRating] = useState(null);

  const submit = useCallback((value) => {
    setRating(value);
    const log = JSON.parse(localStorage.getItem("debate_feedback") || "[]");
    log.push({ winner, rating: value, timestamp: new Date().toISOString() });
    localStorage.setItem("debate_feedback", JSON.stringify(log));
  }, [winner]);

  return (
    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-3">
      <span className="text-xs text-slate-500">Was this verdict fair?</span>
      {rating === null ? (
        <>
          <button onClick={() => submit("up")} className="text-slate-500 hover:text-emerald-400 hover:scale-110 transition" title="Yes" aria-label="Fair"><Icon name="thumbsUp" size={17} /></button>
          <button onClick={() => submit("down")} className="text-slate-500 hover:text-rose-400 hover:scale-110 transition" title="No" aria-label="Not fair"><Icon name="thumbsDown" size={17} /></button>
        </>
      ) : (
        <span className="text-xs text-amber-400 font-medium">
          {rating === "up" ? "Thanks!" : "Thanks — noted."}
        </span>
      )}
    </div>
  );
}
