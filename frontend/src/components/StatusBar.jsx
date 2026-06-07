const STEPS = [
  { key: 1, label: "I. Strategy" },
  { key: 2, label: "II. Evidence" },
  { key: 3, label: "III. Arguments" },
  { key: 4, label: "IV. Rebuttal" },
  { key: 5, label: "V. Ruling" },
];

export default function StatusBar({ message, currentStep, totalSteps }) {
  return (
    <div className="border-l-4 border-amber-500/40 bg-slate-900/60 pl-4 pr-4 py-3 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-amber-400 text-xs uppercase tracking-widest font-mono">Proceedings</span>
        <span className="text-slate-400 text-sm">— {message}</span>
      </div>
      <div className="flex items-center gap-1">
        {STEPS.map((step) => (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                step.key < currentStep
                  ? "bg-amber-500"
                  : step.key === currentStep
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-700"
              }`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {STEPS.map((step) => (
          <span
            key={step.key}
            className={`text-xs ${
              step.key <= currentStep ? "text-amber-400" : "text-slate-600"
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
