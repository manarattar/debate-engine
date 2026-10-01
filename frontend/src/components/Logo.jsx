export default function Logo({ className = "h-7" }) {
  return (
    <svg viewBox="0 0 300 64" className={className} role="img" aria-label="Munazara" fill="none">
      <polygon
        points="32,6 36.6,20.9 50.4,13.6 43.1,27.4 58,32 43.1,36.6 50.4,50.4 36.6,43.1 32,58 27.4,43.1 13.6,50.4 20.9,36.6 6,32 20.9,27.4 13.6,13.6 27.4,20.9"
        fill="var(--b-500)"
      />
      <polygon points="36.6,20.9 43.1,27.4 43.1,36.6 36.6,43.1 27.4,43.1 20.9,36.6 20.9,27.4 27.4,20.9" fill="var(--a-500)" opacity="0.85" />
      <circle cx="32" cy="32" r="6" fill="var(--sheet)" />
      <text x="74" y="43" fontFamily="'Readex Pro', system-ui, sans-serif" fontSize="30" fontWeight="600" fill="var(--ink)">Munazara</text>
    </svg>
  );
}
