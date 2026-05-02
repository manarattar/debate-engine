import { useState } from "react";
import TopicInput from "./components/TopicInput";
import DebateArena from "./components/DebateArena";
import HistoryPanel from "./components/HistoryPanel";
import { getDebate } from "./api";
import "./index.css";

async function* streamDebateFetch(topic) {
  const base = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${base}/api/debate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
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
  const [phase, setPhase] = useState("idle");
  const [topic, setTopic] = useState("");
  const [events, setEvents] = useState([]);       // completed arguments
  const [streaming, setStreaming] = useState(null); // {side, round_name, content} — in-progress
  const [status, setStatus] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (newTopic) => {
    setTopic(newTopic);
    setEvents([]);
    setStreaming(null);
    setStatus(null);
    setVerdict(null);
    setWinner(null);
    setError(null);
    setPhase("debating");

    try {
      for await (const msg of streamDebateFetch(newTopic)) {
        if (msg.type === "status") {
          setStatus(msg.data);
        } else if (msg.type === "sources_ready") {
          setStatus((prev) => ({ ...prev, ...msg.data }));
        } else if (msg.type === "argument_start") {
          // Start a new streaming card
          setStreaming({ side: msg.data.side, round_name: msg.data.round_name, content: "" });
        } else if (msg.type === "token") {
          // Append token to the streaming card
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
        } else if (msg.type === "complete") {
          setPhase("complete");
          if (window._refreshDebateHistory) window._refreshDebateHistory();
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

  const handleReset = () => {
    setPhase("idle");
    setTopic("");
    setEvents([]);
    setStreaming(null);
    setStatus(null);
    setVerdict(null);
    setWinner(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <HistoryPanel onSelect={handleHistorySelect} currentTopic={topic} />

      <div className="flex-1 flex flex-col">
        {phase === "idle" && <TopicInput onSubmit={handleSubmit} isLoading={false} />}

        {phase === "debating" && (
          <div className="flex flex-col flex-1">
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-800">
              <span className="text-slate-400 text-sm">Debate in progress...</span>
              <button onClick={handleReset} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                ✕ Cancel
              </button>
            </div>
            <DebateArena
              topic={topic}
              events={events}
              streaming={streaming}
              status={status}
              verdict={verdict}
              winner={winner}
              isLive={true}
            />
          </div>
        )}

        {phase === "complete" && (
          <div className="flex flex-col flex-1">
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-800">
              <span className="text-slate-400 text-sm">Debate complete</span>
              <button
                onClick={handleReset}
                className="text-sm px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
              >
                + New Debate
              </button>
            </div>
            <DebateArena
              topic={topic}
              events={events}
              streaming={null}
              status={null}
              verdict={verdict}
              winner={winner}
              isLive={false}
            />
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
    </div>
  );
}
