const PRESET_PAIRS = [
  { pro: "Economist", con: "Social Activist" },
  { pro: "Tech Optimist", con: "Privacy Advocate" },
  { pro: "Climate Scientist", con: "Energy Industry Expert" },
  { pro: "Free Market Libertarian", con: "Progressive Policy Maker" },
  { pro: "Military Strategist", con: "Peace Diplomat" },
];

export default function PersonaPicker({ proPersona, conPersona, onChange }) {
  const handlePreset = (pair) => {
    onChange({ pro: pair.pro, con: pair.con });
  };

  const handleClear = () => onChange({ pro: "", con: "" });

  const hasPersonas = proPersona || conPersona;

  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl">
      <p className="text-slate-500 text-sm text-center">
        🎭 Optional: choose debate personas
      </p>

      {/* Preset pairs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {PRESET_PAIRS.map((pair) => (
          <button
            key={pair.pro}
            onClick={() => handlePreset(pair)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors
              ${proPersona === pair.pro
                ? "bg-amber-700 border-amber-500 text-white"
                : "bg-slate-800 border-slate-600 text-slate-300 hover:border-amber-500"
              }`}
          >
            {pair.pro} vs {pair.con}
          </button>
        ))}
      </div>

      {/* Custom inputs */}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={proPersona}
          onChange={(e) => onChange({ pro: e.target.value, con: conPersona })}
          placeholder="PRO persona (optional)"
          className="bg-slate-800 border border-sky-700/40 rounded-lg px-3 py-2 text-sm
            text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
        />
        <input
          value={conPersona}
          onChange={(e) => onChange({ pro: proPersona, con: e.target.value })}
          placeholder="CON persona (optional)"
          className="bg-slate-800 border border-rose-700/40 rounded-lg px-3 py-2 text-sm
            text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
        />
      </div>

      {hasPersonas && (
        <button
          onClick={handleClear}
          className="text-xs text-slate-600 hover:text-slate-400 text-center transition-colors"
        >
          × Clear personas
        </button>
      )}
    </div>
  );
}
