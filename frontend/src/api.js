import axios from "axios";

const api = axios.create({ baseURL: "/api" });

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
