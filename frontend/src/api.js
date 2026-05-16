import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: `${BASE}/api` });

export function streamDebate(topic, { onEvent, onComplete, onError }) {
  const es = new EventSource(`/api/debate/stream?topic=${encodeURIComponent(topic)}`);

  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "complete") {
        onComplete(msg.data);
        es.close();
      } else if (msg.type === "error") {
        onError(msg.data?.message || "Unknown error");
        es.close();
      } else {
        onEvent(msg);
      }
    } catch (err) {
      onError("Failed to parse server event");
      es.close();
    }
  };

  es.onerror = () => {
    onError("Connection lost");
    es.close();
  };

  return () => es.close();
}

export async function startDebate(topic) {
  const res = await api.post("/debate", { topic });
  return res.data;
}

export async function getHistory() {
  const res = await api.get("/history");
  return res.data;
}

export async function getDebate(debateId) {
  const res = await api.get(`/debate/${debateId}`);
  return res.data;
}

// ── Human vs AI debate ────────────────────────────────────────────────────

export async function startHumanDebate(topic, humanSide) {
  const res = await api.post("/human-debate/start", { topic, human_side: humanSide });
  return res.data;
}

export async function getHumanDebateStatus(sessionId) {
  const res = await api.get(`/human-debate/${sessionId}/status`);
  return res.data;
}

async function* _ssePost(path, body) {
  const base = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${base}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
        if (raw) { try { yield JSON.parse(raw); } catch {} }
      }
    }
  }
}

export function streamHumanOpening(sessionId, content) {
  return _ssePost(`/human-debate/${sessionId}/opening`, { content });
}

export function streamHumanRebuttal(sessionId, content) {
  return _ssePost(`/human-debate/${sessionId}/rebuttal`, { content });
}

// ── Voting ────────────────────────────────────────────────────────────────

export async function submitVote(debateId, phase, side, sessionId) {
  const res = await api.post("/vote", {
    debate_id: debateId,
    phase,
    side,
    session_id: sessionId,
  });
  return res.data;
}

export async function getVotes(debateId) {
  const res = await api.get(`/vote/${debateId}`);
  return res.data;
}

// ── Reactions ─────────────────────────────────────────────────────────────

export async function submitReaction(debateId, side, roundName, reaction, sessionId) {
  const res = await api.post("/reaction", {
    debate_id: debateId,
    side,
    round_name: roundName,
    reaction,
    session_id: sessionId,
  });
  return res.data;
}

export async function getReactions(debateId) {
  const res = await api.get(`/reaction/${debateId}`);
  return res.data;
}

// ── Fact check ────────────────────────────────────────────────────────────

export async function runFactCheck(debateId) {
  const res = await api.post(`/factcheck/${debateId}`);
  return res.data;
}
