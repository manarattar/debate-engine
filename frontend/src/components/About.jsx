import { Link } from "react-router-dom";
import Icon from "./Icon";

const STACK = [
  { layer: "Language Model", items: ["gpt-4o-mini", "Streaming inference", "Prompt engineering", "Structured output parsing"] },
  { layer: "Retrieval & Search", items: ["Tavily real-time web search", "ChromaDB vector store", "Cosine similarity retrieval", "RAG pipeline"] },
  { layer: "Backend", items: ["FastAPI", "PostgreSQL", "Server-Sent Events (SSE)", "JWT auth (Clerk)"] },
  { layer: "Frontend", items: ["React 19", "Tailwind CSS v4", "Vite", "Force-directed graph (D3)"] },
];

const FEATURES = [
  {
    icon: "swords",
    title: "Multi-Agent Debate",
    desc: "Three specialized AI agents — PRO advocate, CON advocate, and impartial Judge — each with persistent memory and a dedicated evidence pipeline. The PRO and CON agents never share context; the Judge reads both sides only at verdict time.",
  },
  {
    icon: "user",
    title: "Human vs AI",
    desc: "Pick a side and write your own arguments. The AI responds to your points round by round.",
  },
  {
    icon: "book",
    title: "RAG-Sourced Evidence",
    desc: "Every argument is backed by real web sources retrieved and ranked in real time via Tavily.",
  },
  {
    icon: "scale",
    title: "AI Judge",
    desc: "A dedicated Judge agent — operating with no prior context from either side — evaluates all arguments and retrieved evidence after the final round, then delivers a structured verdict with round-by-round scores.",
  },
  {
    icon: "search",
    title: "Fact Checking",
    desc: "Post-debate fact-check panel verifies key claims from both sides against live sources.",
  },
  {
    icon: "vote",
    title: "Vote & React",
    desc: "Vote before and after each debate to track how arguments shifted your opinion. React to individual rounds.",
  },
  {
    icon: "globe",
    title: "Knowledge Graph",
    desc: "Every debate is mapped into an interactive force graph — explore topics and domains across all debates.",
  },
  {
    icon: "trophy",
    title: "Leaderboard",
    desc: "Most-viewed and most-voted debates surface to the top. History panel lets you revisit past debates.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-[#0a0a0f]/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Munazara" className="h-6" />
          </Link>
          <Link
            to="/"
            className="text-sm px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium"
          >
            Open App
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-24">

        {/* Hero */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Multi-Agent · RAG · gpt-4o-mini · Built by Manar Attar
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            What is{" "}
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              Munazara?
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Munazara (مناظرة) is Arabic for <em>debate</em>. It's an AI-powered debate platform that
            argues both sides of any topic with real sources, delivers a judge's verdict, and
            lets you challenge the AI yourself.
          </p>
        </div>

        {/* Features grid */}
        <section className="mb-20">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-8 text-center">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex gap-4"
              >
                <span className="shrink-0 mt-0.5 text-slate-400"><Icon name={f.icon} size={24} /></span>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mb-20">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-8 text-center">How It Works</h2>
          <div className="flex flex-col gap-0">
            {[
              { step: "01", title: "Enter a topic", desc: "Type any debate topic — political, philosophical, scientific, or everyday." },
              { step: "02", title: "Search strategy", desc: "The LLM generates targeted search queries for both the PRO and CON sides independently." },
              { step: "03", title: "Evidence indexed", desc: "Tavily fetches real-time web results for each side. Content is chunked and indexed in ChromaDB as two separate vector stores." },
              { step: "04", title: "4-round debate", desc: "Opening statements → Rebuttals → Cross-examination (questions + answers from both sides) → Closing statements. Each agent maintains persistent memory of its own prior arguments — rebuttals and closing statements are coherent continuations, not isolated responses. Arguments are streamed live token by token." },
              { step: "05", title: "Judge deliberates", desc: "After all rounds, the LLM reads every argument alongside retrieved evidence and delivers a scored verdict with citations." },
              { step: "06", title: "You decide", desc: "Vote, react to individual rounds, fact-check claims against live sources, and explore the debate in the knowledge graph." },
            ].map((s, i, arr) => (
              <div key={s.step} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-mono font-bold shrink-0">
                    {s.step}
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-slate-800 my-1" />}
                </div>
                <div className="pb-8">
                  <p className="text-sm font-semibold text-white mb-1">{s.title}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section className="mb-20">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-8 text-center">Tech Stack</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STACK.map((s) => (
              <div key={s.layer} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">{s.layer}</p>
                <div className="flex flex-wrap gap-2">
                  {s.items.map((item) => (
                    <span key={item} className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Built by */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Built by</p>
          <p className="text-xl font-bold text-white mb-2">Manar Attar</p>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            AI Researcher & Developer · Master's in Language & AI · VU Amsterdam.
            Building intelligent systems — agentic pipelines, RAG applications, and fine-tuned NLP models.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://manarattar.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              Portfolio
            </a>
            <a
              href="https://github.com/manarattar/debate-engine"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/manar-attar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
