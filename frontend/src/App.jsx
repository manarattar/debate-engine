import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, SignInButton, UserButton } from "@clerk/clerk-react";
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
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import ThemeToggle from "./components/ThemeToggle";
import Onboarding, { hasSeenTour } from "./components/Onboarding";

const LANDING_KEY = "munazara.onboarded.v1";
const DEBATE_KEY = "munazara.debate-tour.v1";

const LANDING_STEPS = [
  { target: "mode", title: "Pick how to debate", body: "Watch two AI debaters argue a topic, or write your own opening and debate the AI." },
  { target: "topic", title: "Give it a topic", body: "Type any claim, or tap one of the examples below. You need to sign in before a debate can start." },
  { target: "personas", title: "Optional personas", body: "Give each side a character, such as an economist against an activist." },
  { target: null, title: "Both sides, live", body: "Once started, PRO and CON argue side by side with sources, then cross-examine each other. Nothing runs until you press Start." },
  { target: null, title: "Checks and a verdict", body: "After the final round a judge picks a winner, you can vote, and a fact-check can test the claims that were made." },
  { target: "graph", title: "The knowledge graph", body: "Every finished debate joins this map of topics. Click a dot to open that debate." },
];

const DEBATE_STEPS = [
  { target: "arena", title: "The two podiums", body: "PRO speaks on the left in indigo, CON on the right in ochre. Each card shows its round and sources." },
  { target: "verdict", title: "The judge's ruling", body: "The judge scores both sides and names a winner with its reasons." },
  { target: "vote", title: "Your vote", body: "Say who convinced you. Votes feed the leaderboard." },
  { target: "factcheck", title: "Fact-check", body: "Run an independent check on the claims made. It uses a separate model call, so it only runs when you press it." },
  { target: null, title: "Back to the map", body: "Press New Debate to return home, where this debate now appears in the knowledge graph." },
];

function MenuButton({ onHistory, onTour }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const item = "block w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 px-3 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
      >
        Menu
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          <button role="menuitem" className={`${item} md:hidden`} onClick={() => { setOpen(false); onHistory(); }}>Debates</button>
          <Link role="menuitem" to="/about" className={item} onClick={() => setOpen(false)}>About</Link>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onTour(); }}>How it works</button>
        </div>
      )}
    </div>
  );
}

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
  const [scorecard, setScorecard] = useState(null);
  const [reactions, setReactions] = useState({});  // {pro_opening: {likes, dislikes}, ...}
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tour, setTour] = useState(() => (hasSeenTour(LANDING_KEY) ? null : "landing"));

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
        setScores(data.scores || {});
        setScorecard(data.scorecard || null);
        setPhase("complete");
      }).catch(() => {});
    }
  }, []);

  const handleShare = () => {
    const url = `${window.location.origin}/api/share?id=${debateId}`;
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
    setScorecard(null);
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
        } else if (msg.type === "scorecard") {
          setScorecard(msg.data);
        } else if (msg.type === "complete") {
          setPhase("complete");
          if (!hasSeenTour(DEBATE_KEY)) setTimeout(() => setTour("debate"), 600);
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
      setScores(data.scores || {});
      setScorecard(data.scorecard || null);
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
    setScorecard(null);
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
    setScores(data.scores || {});
    setScorecard(data.scorecard || null);
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
    setScorecard(null);
    setReactions({});
    setError(null);
  };

  return (
    <div className="min-h-screen bg-page flex">
      <HistoryPanel
        onSelect={handleHistorySelect}
        currentTopic={topic}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
          <Logo className="h-5 sm:h-7 shrink min-w-0" />
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
            <MenuButton onHistory={() => setHistoryOpen(true)} onTour={() => setTour(phase === "complete" ? "debate" : "landing")} />
            <ThemeToggle />
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <SignInButton mode="modal">
                <button className="h-9 px-3 text-sm bg-amber-600 hover:bg-amber-500 text-onaccent rounded-md transition-colors font-medium">
                  Sign in
                </button>
              </SignInButton>
            )}
          </div>
        </div>
        {phase === "idle" && (
          <>
            <div className="flex flex-col items-center">
              {/* Mode cards */}
              <div data-tour="mode" className="flex gap-3 mt-8 w-full max-w-lg px-4">
                <button
                  onClick={() => setDebateMode("ai")}
                  className={`flex-1 flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all
                    ${debateMode === "ai"
                      ? "bg-slate-700 border-slate-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
                >
                  <Icon name="scale" size={22} />
                  <span className="text-sm font-semibold uppercase tracking-wide">Watch AI Debate</span>
                  <span className="text-xs opacity-70">Two AI agents argue both sides with live sources</span>
                </button>
                <button
                  onClick={() => setDebateMode("human")}
                  className={`flex-1 flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all
                    ${debateMode === "human"
                      ? "bg-amber-900/60 border-amber-600 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-amber-700 hover:text-slate-200"}`}
                >
                  <Icon name="user" size={22} />
                  <span className="text-sm font-semibold uppercase tracking-wide">Debate the AI</span>
                  <span className="text-xs opacity-70">Write your opening, the AI fires back — see if you can win</span>
                </button>
              </div>
              <TopicInput
                onSubmit={handleSubmit}
                isLoading={false}
                submitLabel={debateMode === "human" ? "Choose My Side →" : undefined}
              />
            </div>
            <DebateKnowledgeGraph onDebateSelect={(id) => setDrawerDebateId(id)} />
          </>
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
              className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-onaccent font-semibold rounded-xl transition-colors"
            >
              <span className="inline-flex items-center gap-2"><Icon name="swords" size={17} />Start Debate</span>
            </button>
            <button onClick={handleReset} className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
              ← Back
            </button>
          </div>
        )}

        {phase === "debating" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-800 shrink-0">
              <span className="text-slate-500 text-xs uppercase tracking-widest font-mono">Debate in progress</span>
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
                scorecard={scorecard}
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
              <span className="text-slate-500 text-xs uppercase tracking-widest font-mono">Debate complete</span>
              <div className="flex items-center gap-2">
                {debateId && (
                  <button
                    onClick={handleRematch}
                    className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                    title="Run the same topic and personas again"
                  >
                    <span className="inline-flex items-center gap-1.5"><Icon name="swords" size={15} />Rematch</span>
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
                    {copied ? <span className="inline-flex items-center gap-1.5">✓ Copied!</span> : <span className="inline-flex items-center gap-1.5"><Icon name="link" size={14} />Share</span>}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="text-sm px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-onaccent rounded-sm uppercase tracking-wide transition-colors"
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
                scorecard={scorecard}
                reactions={reactions}
                debateId={debateId}
                isLive={false}
                proPersona={proPersona}
                conPersona={conPersona}
              />
              {debateId && (
                <div data-tour="vote" className="w-full max-w-5xl mx-auto px-4 pb-4">
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

      {tour && (
        <Onboarding
          steps={tour === "debate" ? DEBATE_STEPS : LANDING_STEPS}
          storageKey={tour === "debate" ? DEBATE_KEY : LANDING_KEY}
          finishLabel="Got it"
          onClose={() => setTour(null)}
        />
      )}

      <DebateDrawer
        debateId={drawerDebateId}
        onClose={() => setDrawerDebateId(null)}
        onViewFull={handleDrawerViewFull}
      />
    </div>
  );
}
