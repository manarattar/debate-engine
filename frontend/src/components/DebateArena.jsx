import ArgumentCard from "./ArgumentCard";
import JudgeVerdict from "./JudgeVerdict";
import StatusBar from "./StatusBar";

const MAIN_ROUNDS = ["opening", "rebuttal", "closing"];
const CROSS_PAIRS = [
  { q: "cross_pro_questions", a: "cross_con_answers", qSide: "pro", aSide: "con", label: "PRO questions → CON answers" },
  { q: "cross_con_questions", a: "cross_pro_answers", qSide: "con", aSide: "pro", label: "CON questions → PRO answers" },
];

function CrossExamSection({ pair, events, streaming }) {
  const q = events.find((e) => e.round_name === pair.q);
  const a = events.find((e) => e.round_name === pair.a);
  const qStreaming = streaming?.round_name === pair.q;
  const aStreaming = streaming?.round_name === pair.a;

  if (!q && !a && !qStreaming && !aStreaming) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-amber-800/30" />
        <span className="text-xs text-amber-400 uppercase tracking-widest font-medium px-2">
          ⚡ {pair.label}
        </span>
        <div className="h-px flex-1 bg-amber-800/30" />
      </div>
      {(q || qStreaming) && (
        <ArgumentCard
          side={pair.qSide}
          round_name={pair.q}
          content={q ? q.content : streaming.content}
          citations={q ? q.citations : []}
          streaming={qStreaming}
        />
      )}
      {(a || aStreaming) && (
        <ArgumentCard
          side={pair.aSide}
          round_name={pair.a}
          content={a ? a.content : streaming.content}
          citations={a ? a.citations : []}
          streaming={aStreaming}
        />
      )}
    </div>
  );
}

function RoundColumns({ round, proArgs, conArgs, streaming, scores, debateId, reactions }) {
  const pro = proArgs.find((a) => a.round_name === round);
  const con = conArgs.find((a) => a.round_name === round);
  const proStreaming = streaming?.side === "pro" && streaming?.round_name === round;
  const conStreaming = streaming?.side === "con" && streaming?.round_name === round;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div>
        {pro ? (
          <ArgumentCard {...pro} score={scores[`pro_${round}`]} debateId={debateId} reactions={reactions} />
        ) : proStreaming ? (
          <ArgumentCard side="pro" round_name={round} content={streaming.content} citations={[]} streaming={true} />
        ) : (
          <div className="border border-sky-900/20 rounded-xl p-5 h-16 flex items-center justify-center">
            <span className="text-sky-900 text-xs">waiting...</span>
          </div>
        )}
      </div>
      <div>
        {con ? (
          <ArgumentCard {...con} score={scores[`con_${round}`]} debateId={debateId} reactions={reactions} />
        ) : conStreaming ? (
          <ArgumentCard side="con" round_name={round} content={streaming.content} citations={[]} streaming={true} />
        ) : (
          <div className="border border-rose-900/20 rounded-xl p-5 h-16 flex items-center justify-center">
            <span className="text-rose-900 text-xs">waiting...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DebateArena({ topic, events, streaming, status, verdict, winner, scores = {}, reactions = {}, debateId, isLive, proPersona, conPersona }) {
  const proArgs = events.filter((e) => e.side === "pro");
  const conArgs = events.filter((e) => e.side === "con");

  const activeRounds = new Set([
    ...events.map((e) => e.round_name),
    ...(streaming ? [streaming.round_name] : []),
  ]);
  const roundsToShow = MAIN_ROUNDS.filter((r) => activeRounds.has(r));

  const hasCrossExam = CROSS_PAIRS.some(
    (p) => activeRounds.has(p.q) || activeRounds.has(p.a)
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-16">
      {/* Topic banner */}
      <div className="text-center mb-8 pt-6">
        <p className="text-slate-600 text-xs uppercase tracking-widest mb-2">Debate Topic</p>
        <h2 className="text-white text-xl font-semibold max-w-2xl mx-auto leading-snug">
          "{topic}"
        </h2>
        <div className="mt-3 flex justify-center gap-2 items-center">
          <div className="h-px w-12 bg-slate-700" />
          <span className="text-slate-700 text-xs font-mono">⚖</span>
          <div className="h-px w-12 bg-slate-700" />
        </div>
      </div>

      {/* Status bar */}
      {isLive && status && (
        <StatusBar message={status.message} currentStep={status.step || 1} totalSteps={status.total || 7} />
      )}

      {/* Source count badges */}
      {status?.pro_count !== undefined && (
        <div className="flex justify-center gap-4 mb-6">
          <span className="text-xs font-mono text-sky-400/70">
            ✓ {status.pro_count} PRO sources
          </span>
          <span className="text-xs text-slate-700">·</span>
          <span className="text-xs font-mono text-rose-400/70">
            ✗ {status.con_count} CON sources
          </span>
        </div>
      )}

      {/* Column headers */}
      {roundsToShow.length > 0 && (
        <div className="hidden md:grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <span className="text-sky-400 font-bold text-xs uppercase tracking-widest">PRO</span>
            {proPersona && (
              <span className="ml-2 text-xs text-sky-500/70 font-mono">
                ({proPersona})
              </span>
            )}
          </div>
          <div className="text-center">
            <span className="text-rose-400 font-bold text-xs uppercase tracking-widest">CON</span>
            {conPersona && (
              <span className="ml-2 text-xs text-rose-500/70 font-mono">
                ({conPersona})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Debate rounds */}
      <div className="flex flex-col gap-6">
        {roundsToShow.filter((r) => r !== "closing").map((round) => (
          <RoundColumns key={round} round={round} proArgs={proArgs} conArgs={conArgs} streaming={streaming} scores={scores} debateId={debateId} reactions={reactions} />
        ))}

        {/* Cross-examination section — full width */}
        {hasCrossExam && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-700" />
              <span className="text-xs text-slate-400 uppercase tracking-widest font-bold px-2">
                ⚡ Cross-Examination
              </span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>
            {CROSS_PAIRS.map((pair) => (
              <CrossExamSection key={pair.q} pair={pair} events={events} streaming={streaming} />
            ))}
          </div>
        )}

        {/* Closing rounds */}
        {roundsToShow.includes("closing") && (
          <RoundColumns round="closing" proArgs={proArgs} conArgs={conArgs} streaming={streaming} scores={scores} debateId={debateId} reactions={reactions} />
        )}
      </div>

      {/* Judge verdict */}
      {(verdict || streaming?.side === "judge") && (
        <div className="mt-8">
          {streaming?.side === "judge" ? (
            <JudgeVerdict verdict={{ content: streaming.content, citations: [] }} winner={null} streaming={true} />
          ) : (
            <JudgeVerdict verdict={verdict} winner={winner} streaming={false} />
          )}
        </div>
      )}
    </div>
  );
}
