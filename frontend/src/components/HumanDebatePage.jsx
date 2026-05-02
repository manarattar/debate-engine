import { useState, useCallback } from "react";
import ArgumentCard from "./ArgumentCard";
import JudgeVerdict from "./JudgeVerdict";
import StatusBar from "./StatusBar";
import { startHumanDebate, getHumanDebateStatus, streamHumanOpening, streamHumanRebuttal } from "../api";

// ── Argument text input ────────────────────────────────────────────────────

function ArgumentInput({ label, placeholder, onSubmit, disabled }) {
  const [text, setText] = useState("");
  const MAX = 1200;

  return (
    <div className="border border-violet-900/40 bg-slate-800/60 rounded-xl p-5 flex flex-col gap-3">
      <p className="text-violet-300 text-xs font-bold uppercase tracking-widest">{label}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
        className="w-full bg-slate-900 text-slate-200 text-sm rounded-lg p-3 resize-none border border-slate-700
          focus:outline-none focus:border-violet-500 placeholder-slate-600 disabled:opacity-50"
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-600">{text.length} / {MAX}</span>
        <button
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={disabled || !text.trim()}
          className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700
            disabled:text-slate-500 text-white text-sm rounded-lg transition-colors font-medium"
        >
          Submit →
        </button>
      </div>
    </div>
  );
}

// ── Waiting placeholder ────────────────────────────────────────────────────

function WaitingCard({ side }) {
  const color = side === "pro" ? "border-emerald-900/20" : "border-red-900/20";
  const text = side === "pro" ? "text-emerald-900" : "text-red-900";
  return (
    <div className={`border ${color} rounded-xl p-5 h-32 flex items-center justify-center`}>
      <span className={`text-xs ${text}`}>waiting...</span>
    </div>
  );
}

// ── Side picker ────────────────────────────────────────────────────────────

function SidePicker({ topic, onPick }) {
  return (
    <div className="flex flex-col items-center gap-8 py-12 px-6">
      <div className="text-center">
        <p className="text-slate-500 text-sm mb-2">You're debating</p>
        <h2 className="text-white text-xl font-semibold max-w-xl">"{topic}"</h2>
      </div>

      <p className="text-slate-400">Choose your side:</p>

      <div className="flex gap-4 w-full max-w-xl">
        <button
          onClick={() => onPick("pro")}
          className="flex-1 flex flex-col items-center gap-3 border-2 border-emerald-500/30 bg-emerald-950/20
            hover:border-emerald-400/60 hover:bg-emerald-950/40 rounded-2xl p-8 transition-all group"
        >
          <span className="text-4xl group-hover:scale-110 transition-transform">⬆</span>
          <span className="text-emerald-400 font-bold text-xl">PRO</span>
          <span className="text-slate-400 text-sm text-center">Argue FOR the topic</span>
        </button>

        <button
          onClick={() => onPick("con")}
          className="flex-1 flex flex-col items-center gap-3 border-2 border-red-500/30 bg-red-950/20
            hover:border-red-400/60 hover:bg-red-950/40 rounded-2xl p-8 transition-all group"
        >
          <span className="text-4xl group-hover:scale-110 transition-transform">⬇</span>
          <span className="text-red-400 font-bold text-xl">CON</span>
          <span className="text-slate-400 text-sm text-center">Argue AGAINST the topic</span>
        </button>
      </div>
    </div>
  );
}

// ── Column header ──────────────────────────────────────────────────────────

function ColHeader({ side, isHuman }) {
  const isPro = side === "pro";
  return (
    <div className="text-center mb-3">
      <span className={`font-bold text-sm uppercase tracking-widest ${isPro ? "text-emerald-400" : "text-red-400"}`}>
        {isPro ? "⬆ PRO" : "CON ⬇"}
      </span>
      {isHuman && (
        <span className="ml-2 text-xs px-2 py-0.5 bg-violet-900/40 border border-violet-500/30 text-violet-300 rounded-full">
          YOU
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function HumanDebatePage({ topic, onReset }) {
  const [phase, setPhase] = useState("picking_side");
  // picking_side | gathering | your_opening | ai_opening
  // | your_rebuttal | finishing | complete | error

  const [humanSide, setHumanSide] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  // Argument content
  const [humanOpeningText, setHumanOpeningText] = useState("");
  const [humanRebuttalText, setHumanRebuttalText] = useState("");
  const [aiOpeningCard, setAiOpeningCard] = useState(null);
  const [aiRebuttalCard, setAiRebuttalCard] = useState(null);
  const [judgeVerdict, setJudgeVerdict] = useState(null);
  const [winner, setWinner] = useState(null);

  // Live streaming state
  const [streaming, setStreaming] = useState(null); // { side, round_name, content }

  const [errorMsg, setErrorMsg] = useState("");

  // ── Pick side + gather sources ────────────────────────────────────────

  const handlePickSide = async (side) => {
    setHumanSide(side);
    setPhase("gathering");
    try {
      const { session_id } = await startHumanDebate(topic, side);
      setSessionId(session_id);
      pollStatus(session_id);
    } catch (e) {
      setErrorMsg(e.message || "Failed to start debate");
      setPhase("error");
    }
  };

  const pollStatus = useCallback(async (sid) => {
    try {
      const { status, error_message } = await getHumanDebateStatus(sid);
      if (status === "sources_ready") {
        setPhase("your_opening");
      } else if (status === "failed") {
        setErrorMsg(error_message || "Failed to gather sources");
        setPhase("error");
      } else {
        setTimeout(() => pollStatus(sid), 2000);
      }
    } catch {
      setErrorMsg("Lost connection");
      setPhase("error");
    }
  }, []);

  // ── Consume SSE stream helper ─────────────────────────────────────────

  const consumeStream = async (generator) => {
    for await (const msg of generator) {
      if (msg.type === "argument_start") {
        setStreaming({ side: msg.data.side, round_name: msg.data.round_name, content: "" });
      } else if (msg.type === "token") {
        setStreaming((prev) => prev ? { ...prev, content: prev.content + msg.data.delta } : prev);
      } else if (msg.type === "argument") {
        setStreaming(null);
        if (msg.data.side === "judge") {
          setJudgeVerdict(msg.data);
        } else {
          // AI argument completed
          if (msg.data.round_name === "opening") setAiOpeningCard(msg.data);
          else if (msg.data.round_name === "rebuttal") setAiRebuttalCard(msg.data);
        }
      } else if (msg.type === "opening_done") {
        setPhase("your_rebuttal");
      } else if (msg.type === "status") {
        setStatusMsg(msg.data);
      } else if (msg.type === "winner") {
        setWinner(msg.data.winner);
      } else if (msg.type === "complete") {
        setPhase("complete");
        setStatusMsg(null);
      } else if (msg.type === "error") {
        setErrorMsg(msg.data?.message || "Something went wrong");
        setPhase("error");
      }
    }
  };

  // ── Submit opening ────────────────────────────────────────────────────

  const handleSubmitOpening = async (content) => {
    setHumanOpeningText(content);
    setPhase("ai_opening");
    try {
      await consumeStream(streamHumanOpening(sessionId, content));
    } catch (e) {
      setErrorMsg(e.message || "Error generating AI response");
      setPhase("error");
    }
  };

  // ── Submit rebuttal ───────────────────────────────────────────────────

  const handleSubmitRebuttal = async (content) => {
    setHumanRebuttalText(content);
    setPhase("finishing");
    try {
      await consumeStream(streamHumanRebuttal(sessionId, content));
    } catch (e) {
      setErrorMsg(e.message || "Error generating AI response");
      setPhase("error");
    }
  };

  // ── Derived layout values ─────────────────────────────────────────────

  const aiSide = humanSide === "pro" ? "con" : "pro";

  // Determine what to show in each column per round
  const rounds = [];
  const hasOpening = humanOpeningText || aiOpeningCard || (streaming?.round_name === "opening");
  const hasRebuttal = humanRebuttalText || aiRebuttalCard || (streaming?.round_name === "rebuttal");
  if (hasOpening) rounds.push("opening");
  if (hasRebuttal) rounds.push("rebuttal");

  // ── Render ────────────────────────────────────────────────────────────

  if (phase === "picking_side") {
    return <SidePicker topic={topic} onPick={handlePickSide} />;
  }

  if (phase === "gathering") {
    return (
      <div className="flex flex-col items-center justify-center mt-24 gap-6">
        <div className="w-12 h-12 border-4 border-violet-700 border-t-violet-400 rounded-full animate-spin" />
        <p className="text-slate-400">Researching both sides of the debate...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center mt-24 gap-4">
        <div className="text-red-400 text-4xl">⚠</div>
        <p className="text-red-300">{errorMsg}</p>
        <button onClick={onReset} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-16">
      {/* Topic banner */}
      <div className="text-center mb-8 pt-6">
        <div className="inline-block bg-slate-800 border border-slate-600 rounded-2xl px-6 py-3">
          <p className="text-slate-400 text-sm mb-1">You are debating as <span className={humanSide === "pro" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{humanSide?.toUpperCase()}</span></p>
          <h2 className="text-white text-xl font-semibold">"{topic}"</h2>
        </div>
      </div>

      {/* Status bar */}
      {statusMsg && (
        <StatusBar message={statusMsg.message} currentStep={statusMsg.step || 5} totalSteps={statusMsg.total || 5} />
      )}

      {/* Column headers */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ColHeader side="pro" isHuman={humanSide === "pro"} />
        <ColHeader side="con" isHuman={humanSide === "con"} />
      </div>

      <div className="flex flex-col gap-6">
        {rounds.map((round) => {
          const humanCardText = round === "opening" ? humanOpeningText : humanRebuttalText;
          const aiCard = round === "opening" ? aiOpeningCard : aiRebuttalCard;
          const aiIsStreaming = streaming?.side === aiSide && streaming?.round_name === round;

          const humanCol = (
            <div>
              {humanCardText ? (
                <ArgumentCard side={humanSide} round_name={round} content={humanCardText} citations={[]} />
              ) : round === "opening" && phase === "your_opening" ? (
                <ArgumentInput
                  label="Your Opening Statement"
                  placeholder={`Make your case ${humanSide === "pro" ? "FOR" : "AGAINST"} the topic. Be persuasive and specific.`}
                  onSubmit={handleSubmitOpening}
                  disabled={false}
                />
              ) : round === "rebuttal" && phase === "your_rebuttal" ? (
                <ArgumentInput
                  label="Your Rebuttal"
                  placeholder="Counter the AI's argument. Address its key points directly."
                  onSubmit={handleSubmitRebuttal}
                  disabled={false}
                />
              ) : (
                <WaitingCard side={humanSide} />
              )}
            </div>
          );

          const aiCol = (
            <div>
              {aiCard ? (
                <ArgumentCard side={aiSide} round_name={round} content={aiCard.content} citations={[]} />
              ) : aiIsStreaming ? (
                <ArgumentCard side={aiSide} round_name={round} content={streaming.content} citations={[]} streaming={true} />
              ) : (
                <WaitingCard side={aiSide} />
              )}
            </div>
          );

          return (
            <div key={round} className="grid grid-cols-2 gap-4 items-start">
              {humanSide === "pro" ? <>{humanCol}{aiCol}</> : <>{aiCol}{humanCol}</>}
            </div>
          );
        })}

        {/* Opening input shown before any rounds appear */}
        {rounds.length === 0 && phase === "your_opening" && (
          <div className="grid grid-cols-2 gap-4 items-start">
            {humanSide === "pro" ? (
              <>
                <ArgumentInput
                  label="Your Opening Statement"
                  placeholder="Make your case FOR the topic. Be persuasive and specific."
                  onSubmit={handleSubmitOpening}
                  disabled={false}
                />
                <WaitingCard side="con" />
              </>
            ) : (
              <>
                <WaitingCard side="pro" />
                <ArgumentInput
                  label="Your Opening Statement"
                  placeholder="Make your case AGAINST the topic. Be persuasive and specific."
                  onSubmit={handleSubmitOpening}
                  disabled={false}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Judge verdict */}
      {(judgeVerdict || streaming?.side === "judge") && (
        <div className="mt-8">
          {streaming?.side === "judge" ? (
            <JudgeVerdict
              verdict={{ content: streaming.content, citations: [] }}
              winner={null}
              streaming={true}
            />
          ) : (
            <JudgeVerdict verdict={judgeVerdict} winner={winner} streaming={false} />
          )}
        </div>
      )}
    </div>
  );
}
