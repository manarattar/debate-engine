import { useState } from "react";

const EXAMPLES = [
  "AI will replace software engineers",
  "Remote work is better than office work",
  "Social media does more harm than good",
  "Universal Basic Income should be implemented",
  "Nuclear energy is the best solution to climate change",
];

export default function TopicInput({ onSubmit, isLoading, submitLabel }) {
  const [topic, setTopic] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (topic.trim() && !isLoading) onSubmit(topic.trim());
  };

  return (
    <div className="flex flex-col items-center gap-8 py-16 px-6">
      <div className="text-center">
        <div className="text-5xl mb-4">⚖️</div>
        <h1 className="text-4xl font-bold text-white mb-2">Debate Engine</h1>
        <p className="text-slate-400 text-lg">
          AI argues both sides of any topic — with real sources
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col gap-3">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Enter a debate topic..."
          disabled={isLoading}
          rows={3}
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-5 py-4 text-white placeholder-slate-500 text-lg resize-none focus:outline-none focus:border-violet-500 disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={!topic.trim() || isLoading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <><span className="animate-spin">⟳</span> Running debate...</>
          ) : (
            submitLabel || "⚔️ Start Debate"
          )}
        </button>
      </form>

      <div className="w-full max-w-2xl">
        <p className="text-slate-500 text-sm mb-3 text-center">Try an example:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setTopic(ex)}
              disabled={isLoading}
              className="text-sm px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-300 transition-colors disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
