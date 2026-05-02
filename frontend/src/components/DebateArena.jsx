import ArgumentCard from "./ArgumentCard";
import JudgeVerdict from "./JudgeVerdict";
import StatusBar from "./StatusBar";

const ROUNDS = ["opening", "rebuttal"];

export default function DebateArena({ topic, events, status, verdict, winner, isLive }) {
  const proArgs = events.filter((e) => e.side === "pro");
  const conArgs = events.filter((e) => e.side === "con");

  const roundsToShow = ROUNDS.filter((r) =>
    [...proArgs, ...conArgs].some((a) => a.round_name === r)
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-16">
      {/* Topic banner */}
      <div className="text-center mb-8">
        <div className="inline-block bg-slate-800 border border-slate-600 rounded-2xl px-6 py-3">
          <p className="text-slate-400 text-sm mb-1">Debating</p>
          <h2 className="text-white text-xl font-semibold">"{topic}"</h2>
        </div>
      </div>

      {/* Status bar */}
      {isLive && status && (
        <StatusBar
          message={status.message}
          currentStep={status.step || 1}
          totalSteps={status.total || 5}
        />
      )}

      {/* Source count badges */}
      {status?.pro_count !== undefined && (
        <div className="flex justify-center gap-4 mb-6">
          <span className="text-xs px-3 py-1 bg-emerald-900/30 border border-emerald-700/30 text-emerald-400 rounded-full">
            ✓ {status.pro_count} PRO source chunks indexed
          </span>
          <span className="text-xs px-3 py-1 bg-red-900/30 border border-red-700/30 text-red-400 rounded-full">
            ✗ {status.con_count} CON source chunks indexed
          </span>
        </div>
      )}

      {/* Column headers */}
      {roundsToShow.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <span className="text-emerald-400 font-bold text-sm uppercase tracking-widest">⬆ PRO</span>
          </div>
          <div className="text-center">
            <span className="text-red-400 font-bold text-sm uppercase tracking-widest">CON ⬇</span>
          </div>
        </div>
      )}

      {/* Debate rounds */}
      <div className="flex flex-col gap-6">
        {roundsToShow.map((round) => {
          const pro = proArgs.find((a) => a.round_name === round);
          const con = conArgs.find((a) => a.round_name === round);
          return (
            <div key={round} className="grid grid-cols-2 gap-4 items-start">
              <div>
                {pro ? (
                  <ArgumentCard {...pro} />
                ) : (
                  <div className="border border-emerald-900/30 rounded-xl p-5 h-20 flex items-center justify-center">
                    <span className="animate-pulse text-emerald-700 text-sm">Writing...</span>
                  </div>
                )}
              </div>
              <div>
                {con ? (
                  <ArgumentCard {...con} />
                ) : (
                  <div className="border border-red-900/30 rounded-xl p-5 h-20 flex items-center justify-center">
                    <span className="animate-pulse text-red-700 text-sm">Writing...</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Judge verdict */}
      {verdict && (
        <div className="mt-8">
          <JudgeVerdict verdict={verdict} winner={winner} />
        </div>
      )}
    </div>
  );
}
