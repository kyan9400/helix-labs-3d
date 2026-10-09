/* Code-made clinician portrait: monogram on a dotted helix pattern (no photos). */

const PALETTES = [
  { bg: "#0F6E68", fg: "#F4F1EA", dot: "#9ED9C9" },
  { bg: "#3446B8", fg: "#F4F1EA", dot: "#E9A23B" },
  { bg: "#AE3520", fg: "#F4F1EA", dot: "#F4C9A8" },
];

export default function Portrait({ initials, variant }: { initials: string; variant: number }) {
  const p = PALETTES[variant % PALETTES.length];
  const dots = [];
  for (let i = 0; i < 14; i++) {
    const y = 8 + i * 7.4;
    const a = i * 0.62 + variant;
    dots.push(
      <g key={i}>
        <circle cx={60 + Math.round(Math.cos(a) * 34)} cy={y} r="2.6" fill={p.dot} opacity="0.75" />
        <circle cx={60 + Math.round(Math.cos(a + 2.4) * 34)} cy={y} r="2.6" fill={p.dot} opacity="0.4" />
      </g>,
    );
  }
  return (
    <svg className="portrait" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <rect width="120" height="120" rx="14" fill={p.bg} />
      {dots}
      <text
        x="60"
        y="74"
        textAnchor="middle"
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="42"
        fill={p.fg}
      >
        {initials}
      </text>
    </svg>
  );
}
