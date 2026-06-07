const STEPS = [
  { key: 1, label: "Strategy" },
  { key: 2, label: "Sources" },
  { key: 3, label: "Openings" },
  { key: 4, label: "Rebuttals" },
  { key: 5, label: "Verdict" },
];

export default function StatusBar({ message, currentStep, totalSteps }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="animate-spin text-amber-400 text-lg">⟳</span>
        <span className="text-slate-300 text-sm">{message}</span>
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
