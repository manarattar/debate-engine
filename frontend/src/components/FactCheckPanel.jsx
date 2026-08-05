import { useState } from "react";
import { runFactCheck } from "../api";
import Icon from "./Icon";

const VERDICT_CONFIG = {
  verified:     { label: "Verified",      color: "text-sky-400",     bg: "bg-sky-900/40 border-sky-700",        icon: "✓" },
  contested:    { label: "Contested",     color: "text-yellow-400",  bg: "bg-yellow-900/40 border-yellow-700",  icon: "~" },
  misleading:   { label: "Misleading",    color: "text-red-400",     bg: "bg-red-900/40 border-red-700",        icon: "✗" },
  unverifiable: { label: "Unverifiable",  color: "text-slate-400",   bg: "bg-slate-800/60 border-slate-700",    icon: "?" },
};

const CONFIDENCE_COLOR = {
  High:   "text-sky-400",
  Medium: "text-yellow-400",
  Low:    "text-slate-400",
};

export default function FactCheckPanel({ debateId }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleRun() {
    setState("loading");
    setErrorMsg("");
    try {
      const data = await runFactCheck(debateId);
      setReport(data);
      setState("done");
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || e.message || "Failed to run fact check");
      setState("error");
    }
  }

  return (
    <div className="mx-4 mb-6 rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <Icon name="search" size={17} />
          <h3 className="text-sm font-semibold text-slate-200">Fact Check</h3>
          {state === "done" && report && (
            <span className="text-xs text-slate-500">{report.claims.length} claims verified</span>
          )}
        </div>
        {state === "idle" && (
          <button
            onClick={handleRun}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
          >
            Run Fact Check
          </button>
        )}
        {state === "error" && (
          <button
            onClick={handleRun}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            Retry
          </button>
        )}
      </div>

      {/* Idle */}
      {state === "idle" && (
        <div className="px-5 py-4 text-sm text-slate-500">
          Verify key claims from this debate against live web sources.
        </div>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div className="px-5 py-6 flex flex-col items-center gap-3 text-slate-400">
          <LoadingSpinner />
          <p className="text-sm">Extracting claims and searching sources…</p>
          <p className="text-xs text-slate-600">This takes about 15–20 seconds</p>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="px-5 py-4 text-sm text-red-400">{errorMsg}</div>
      )}

      {/* Results */}
      {state === "done" && report && (
        <div className="divide-y divide-slate-800">
          {report.claims.map((claim, i) => {
            const cfg = VERDICT_CONFIG[claim.verdict] ?? VERDICT_CONFIG.unverifiable;
            return (
              <div key={i} className="px-5 py-4 space-y-2">
                {/* Claim + badges */}
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className={`text-xs ${CONFIDENCE_COLOR[claim.confidence] ?? "text-slate-400"}`}>
                        {claim.confidence} confidence
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                        claim.side === "pro"
                          ? "bg-blue-900/50 text-blue-300 border border-blue-800"
                          : "bg-rose-900/50 text-rose-300 border border-rose-800"
                      }`}>
                        {claim.side.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 leading-snug">{claim.claim}</p>
                  </div>
                </div>

                {/* Evidence */}
                <p className="text-xs text-slate-400 pl-9 leading-relaxed">{claim.evidence}</p>

                {/* Sources */}
                {claim.sources.length > 0 && (
                  <div className="pl-9 flex flex-wrap gap-2">
                    {claim.sources.map((url, j) => (
                      <a
                        key={j}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 truncate max-w-xs"
                      >
                        {(() => { try { return new URL(url).hostname; } catch { return url; } })()}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-amber-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
