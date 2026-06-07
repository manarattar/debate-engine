import { useState } from "react";
import { useAuth, SignInButton } from "@clerk/clerk-react";
import PersonaPicker from "./PersonaPicker";

const TOPIC_CATEGORIES = [
  {
    label: "🤖 Technology",
    topics: [
      "AI will replace software engineers",
      "Social media does more harm than good",
      "Cryptocurrency is the future of money",
    ],
  },
  {
    label: "🌍 Society",
    topics: [
      "Universal Basic Income should be implemented",
      "Remote work is better than office work",
      "Smartphones have made us less intelligent",
    ],
  },
  {
    label: "⚡ Energy & Climate",
    topics: [
      "Nuclear energy is the best solution to climate change",
      "Electric vehicles will save the planet",
      "Carbon taxes are the most effective climate policy",
    ],
  },
  {
    label: "🏛 Policy",
    topics: [
      "The death penalty should be abolished worldwide",
      "Open borders would benefit the global economy",
      "Affirmative action does more harm than good",
    ],
  },
];

export default function TopicInput({ onSubmit, isLoading, submitLabel }) {
  const { isSignedIn } = useAuth();
  const [topic, setTopic] = useState("");
  const [personas, setPersonas] = useState({ pro: "", con: "" });
  const [showPersonas, setShowPersonas] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (topic.trim() && !isLoading) {
      onSubmit(topic.trim(), personas.pro.trim() || null, personas.con.trim() || null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 py-16 px-6">
      <div className="text-center">
        <img src="/logo.svg" alt="Munazara" className="h-20 mx-auto mb-4" />
        <p className="text-white text-lg font-medium">
          Where every idea faces its strongest opposition.
        </p>
        <p className="text-slate-400 text-sm mt-1">
          AI argues both sides with real sources.
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
          className="w-full bg-slate-900 border-l-4 border-l-amber-500/40 border border-slate-700 rounded-sm px-5 py-4 text-white
            placeholder-slate-600 text-base resize-none focus:outline-none focus:border-amber-500
            disabled:opacity-50 transition-colors"
        />
        {isSignedIn ? (
          <button
            type="submit"
            disabled={!topic.trim() || isLoading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800
              disabled:text-slate-600 text-white font-semibold py-4 rounded-sm text-base
              uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><span className="animate-spin">⟳</span> Running debate...</>
            ) : (
              submitLabel || "⚖ Start Debate"
            )}
          </button>
        ) : (
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-4 rounded-sm text-base uppercase tracking-widest transition-colors"
            >
              Sign in to start a debate
            </button>
          </SignInButton>
        )}
      </form>

      {/* Persona toggle */}
      <button
        onClick={() => setShowPersonas((v) => !v)}
        className="text-sm text-slate-500 hover:text-amber-400 transition-colors"
      >
        🎭 {showPersonas ? "Hide personas" : "Add debate personas (optional)"}
      </button>

      {showPersonas && (
        <PersonaPicker
          proPersona={personas.pro}
          conPersona={personas.con}
          onChange={setPersonas}
        />
      )}

      {/* Topic categories */}
      <div className="w-full max-w-2xl flex flex-col gap-4">
        {TOPIC_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <p className="text-slate-500 text-xs mb-2 uppercase tracking-wide">{cat.label}</p>
            <div className="flex flex-wrap gap-2">
              {cat.topics.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border
                    border-slate-700 rounded-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
