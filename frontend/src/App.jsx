import { useEffect, useState } from "react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/clerk-react";
import TopicInput from "./components/TopicInput";
import DebateArena from "./components/DebateArena";
import HumanDebatePage from "./components/HumanDebatePage";
import HistoryPanel from "./components/HistoryPanel";
import FactCheckPanel from "./components/FactCheckPanel";
import VotePanel from "./components/VotePanel";
import DebateKnowledgeGraph from "./components/DebateKnowledgeGraph";
import DebateDrawer from "./components/DebateDrawer";
import { getDebate, getReactions } from "./api";
import "./index.css";

function generateDebateId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

async function* streamDebateFetch(topic, debateId, proPersona, conPersona, token) {
  const base = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${base}/api/debate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      topic,
      debate_id: debateId,
      pro_persona: proPersona || null,
      con_persona: conPersona || null,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    yield { type: "error", data: { message: detail.detail || `Server error ${res.status}` } };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (raw) {
          try { yield JSON.parse(raw); } catch {}
        }
      }
    }
  }
}

export default function App() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [debateMode, setDebateMode] = useState("ai"); // "ai" | "human"
  const [phase, setPhase] = useState("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawerDebateId, setDrawerDebateId] = useState(null);
  const [topic, setTopic] = useState("");
  const [debateId, setDebateId] = useState(null);
  const [pendingVoteTopic, setPendingVoteTopic] = useState(null);
  const [proPersona, setProPersona] = useState(null);
  const [conPersona, setConPersona] = useState(null);
  const [events, setEvents] = useState([]);       // completed arguments
  const [streaming, setStreaming] = useState(null); // {side, round_name, content} — in-progress
  const [status, setStatus] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [winner, setWinner] = useState(null);
  const [scores, setScores] = useState({});        // {pro_opening: 8, con_opening: 6, ...}
  const [reactions, setReactions] = useState({});  // {pro_opening: {likes, dislikes}, ...}
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Wake the Render backend on mount (free tier spins down after inactivity)
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/health`).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("debate");
    if (sharedId) {
      getDebate(sharedId).then((data) => {
        if (!data || data.status === "processing") return;
        setTopic(data.topic);
        setDebateId(sharedId);
        const allArgs = [
          ...(data.pro_arguments || []),
          ...(data.con_arguments || []),
        ].sort((a, b) => {
          const order = { opening: 0, rebuttal: 1, closing: 2 };
          return (order[a.round_name] ?? 9) - (order[b.round_name] ?? 9);
        });
        setEvents(allArgs);
        setVerdict(data.verdict || null);
        setWinner(data.winner || null);
        setPhase("complete");
      }).catch(() => {});
    }
  }, []);

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?debate=${debateId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = (newTopic, pro = null, con = null) => {
    if (!isSignedIn) return; // TopicInput shows sign-in button instead
    setTopic(newTopic);
    if (debateMode === "human") {
      setPhase("human");
      return;
    }
    setEvents([]);
    setStreaming(null);
    setStatus(null);
    setVerdict(null);
    setWinner(null);
    setScores({});
    setReactions({});
    setError(null);
    setDebateId(generateDebateId());
    setProPersona(pro);
    setConPersona(con);
    setPendingVoteTopic(newTopic);
    setPhase("prevote");
  };

  const handleStartDebate = async (topicToDebate) => {
    setPhase("debating");
    try {
      const token = await getToken();
      for await (const msg of streamDebateFetch(topicToDebate, debateId, proPersona, conPersona, token)) {
        if (msg.type === "status") {
          setStatus(msg.data);
        } else if (msg.type === "sources_ready") {
          setStatus((prev) => ({ ...prev, ...msg.data }));
        } else if (msg.type === "argument_start") {
          setStreaming({ side: msg.data.side, round_name: msg.data.round_name, content: "" });
        } else if (msg.type === "token") {
          setStreaming((prev) =>
            prev ? { ...prev, content: prev.content + msg.data.delta } : prev
          );
        } else if (msg.type === "argument") {
          setStreaming(null);
          if (msg.data.side === "judge") {
            setVerdict(msg.data);
          } else {
            setEvents((prev) => [...prev, msg.data]);
          }
        } else if (msg.type === "winner") {
          setWinner(msg.data.winner);
        } else if (msg.type === "scores") {
          setScores(msg.data);
        } else if (msg.type === "complete") {
          setPhase("complete");
          if (window._refreshDebateHistory) window._refreshDebateHistory();
          getReactions(debateId).then((r) => setReactions(r.reactions || {})).catch(() => {});
        } else if (msg.type === "error") {
          setError(msg.data?.message || "Something went wrong");
          setPhase("error");
        }
      }
    } catch (err) {
      setError(err.message || "Connection failed");
      setPhase("error");
    }
  };

  const handleHistorySelect = async (item) => {
    try {
      const data = await getDebate(item.debate_id);
      if (data.status === "processing") return;
      setTopic(data.topic);
      setDebateId(item.debate_id);
      const allArgs = [
        ...(data.pro_arguments || []),
        ...(data.con_arguments || []),
      ].sort((a, b) => {
        const order = { opening: 0, rebuttal: 1, closing: 2 };
        return (order[a.round_name] ?? 9) - (order[b.round_name] ?? 9);
      });
      setEvents(allArgs);
      setVerdict(data.verdict || null);
      setWinner(data.winner || null);
      setStreaming(null);
      setStatus(null);
      setPhase("complete");
    } catch {}
  };

  const handleRematch = () => {
    const savedTopic = topic;
    const savedPro = proPersona;
    const savedCon = conPersona;
    setEvents([]);
    setStreaming(null);
    setStatus(null);
    setVerdict(null);
    setWinner(null);
    setScores({});
    setReactions({});
    setError(null);
    setDebateId(generateDebateId());
    setPendingVoteTopic(savedTopic);
    setTopic(savedTopic);
    setProPersona(savedPro);
    setConPersona(savedCon);
    setPhase("prevote");
  };

  const handleDrawerViewFull = (data) => {
    setDrawerDebateId(null);
    const allArgs = [
      ...(data.pro_arguments || []),
      ...(data.con_arguments || []),
    ].sort((a, b) => {
      const order = { opening: 0, rebuttal: 1, closing: 2 };
      return (order[a.round_name] ?? 9) - (order[b.round_name] ?? 9);
    });
    setTopic(data.topic);
    setDebateId(data.debate_id);
    setEvents(allArgs);
    setVerdict(data.verdict || null);
    setWinner(data.winner || null);
    setStreaming(null);
    setStatus(null);
    setPhase("complete");
  };

  const handleReset = () => {
    setPhase("idle");
    setDebateMode("ai");
    setTopic("");
    setDebateId(null);
    setPendingVoteTopic(null);
    setProPersona(null);
    setConPersona(null);
    setEvents([]);
    setStreaming(null);
    setStatus(null);
    setVerdict(null);
    setWinner(null);
    setScores({});
    setReactions({});
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <HistoryPanel
        onSelect={handleHistorySelect}
        currentTopic={topic}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <div className="flex-1 flex flex-col">
        {/* Top bar — hamburger (mobile) + auth */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHistoryOpen(true)}
              className="md:hidden text-slate-400 hover:text-white text-xl leading-none"
            >
              ☰
            </button>
            <span className="text-slate-500 text-sm font-medium md:hidden">Munazara</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {isSignedIn ? (
              <>
                <span className="text-slate-500 text-xs hidden md:block">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <SignInButton mode="modal">
                <button className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors font-medium">
                  Sign in
                </button>
              </SignInButton>
            )}
          </div>
        </div>
        {phase === "idle" && (
          <div className="flex flex-col items-center">
            {/* Mode toggle */}
            <div className="flex gap-1 bg-slate-800 p-1 rounded-xl mt-8 mx-6">
              <button
                onClick={() => setDebateMode("ai")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors
                  ${debateMode === "ai" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                ⚔️ Watch AI Debate
              </button>
              <button
                onClick={() => setDebateMode("human")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors
                  ${debateMode === "human" ? "bg-violet-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                🧑 Debate the AI
              </button>
            </div>
            <TopicInput
              onSubmit={handleSubmit}
              isLoading={false}
              submitLabel={debateMode === "human" ? "🧑 Choose My Side →" : undefined}
            />
            <DebateKnowledgeGraph onDebateSelect={(id) => setDrawerDebateId(id)} />
          </div>
        )}

        {phase === "prevote" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 py-16">
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-1">Debate topic</p>
              <h2 className="text-white text-xl font-semibold max-w-xl">"{pendingVoteTopic}"</h2>
            </div>
            <div className="w-full max-w-sm">
              <VotePanel debateId={debateId} phase="before" topic={pendingVoteTopic} />
            </div>
            <button
              onClick={() => handleStartDebate(pendingVoteTopic)}
              className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
            >
              ⚔️ Start Debate
            </button>
            <button onClick={handleReset} className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
              ← Back
            </button>
          </div>
        )}

        {phase === "debating" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-800 shrink-0">
              <span className="text-slate-400 text-sm">Debate in progress...</span>
              <button onClick={handleReset} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                ✕ Cancel
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <DebateArena
                topic={topic}
                events={events}
                streaming={streaming}
                status={status}
                verdict={verdict}
                winner={winner}
                scores={scores}
                reactions={reactions}
                debateId={debateId}
                isLive={true}
                proPersona={proPersona}
                conPersona={conPersona}
              />
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-800 shrink-0">
              <span className="text-slate-400 text-sm">Debate complete</span>
              <div className="flex items-center gap-2">
                {debateId && (
                  <button
                    onClick={handleRematch}
                    className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                    title="Run the same topic and personas again"
                  >
                    ⚔️ Rematch
                  </button>
                )}
                {debateId && (
                  <a
                    href={`${import.meta.env.VITE_API_URL || ""}/api/debate/${debateId}/pdf`}
                    download
                    className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                  >
                    ⬇ PDF
                  </a>
                )}
                {debateId && (
                  <button
                    onClick={handleShare}
                    className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                  >
                    {copied ? "✓ Copied!" : "🔗 Share"}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="text-sm px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                >
                  + New Debate
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <DebateArena
                topic={topic}
                events={events}
                streaming={null}
                status={null}
                verdict={verdict}
                winner={winner}
                scores={scores}
                reactions={reactions}
                debateId={debateId}
                isLive={false}
                proPersona={proPersona}
                conPersona={conPersona}
              />
              {debateId && (
                <div className="w-full max-w-5xl mx-auto px-4 pb-4">
                  <VotePanel debateId={debateId} phase="after" topic={topic} />
                </div>
              )}
              {debateId && <FactCheckPanel debateId={debateId} />}
            </div>
          </div>
        )}

        {phase === "human" && (
          <div className="flex flex-col flex-1">
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-800">
              <span className="text-slate-400 text-sm">Human vs AI</span>
              <button onClick={handleReset} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                ✕ Exit
              </button>
            </div>
            <HumanDebatePage topic={topic} onReset={handleReset} />
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
            <div className="text-red-400 text-4xl">⚠</div>
            <p className="text-red-300 text-lg">{error}</p>
            <button onClick={handleReset} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              Try Again
            </button>
          </div>
        )}
      </div>

      <DebateDrawer
        debateId={drawerDebateId}
        onClose={() => setDrawerDebateId(null)}
        onViewFull={handleDrawerViewFull}
      />
    </div>
  );
}
