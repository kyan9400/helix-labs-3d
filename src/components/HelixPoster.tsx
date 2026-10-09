/*
 * Static helix drawn in SVG (code-made). Shown while the 3D warms up, and as the
 * designed fallback when WebGL is unavailable or the context is lost.
 */

const COLORS = ["#D9472F", "#E9A23B", "#1E9C8F", "#3F51C9"];
const COMP = [1, 0, 3, 2];
const PAIRS = 30;

function build() {
  const pairs = [];
  let seed = 7;
  for (let i = 0; i < PAIRS; i++) {
    seed = (seed * 48271) % 2147483647;
    const base = seed % 4;
    const t = i / (PAIRS - 1);
    const a = t * Math.PI * 2 * 2.6;
    const y = 40 + t * 520;
    const ax = 200 + Math.cos(a) * 92;
    const bx = 200 + Math.cos(a + Math.PI * 0.75) * 92;
    const az = Math.sin(a);
    const bz = Math.sin(a + Math.PI * 0.75);
    pairs.push({ y, ax, bx, az, bz, base });
  }
  return pairs;
}

const PAIRS_DATA = build();
const r1 = (n: number) => Math.round(n * 10) / 10;
const strandA = PAIRS_DATA.map((p, i) => `${i ? "L" : "M"}${r1(p.ax)} ${r1(p.y)}`).join(" ");
const strandB = PAIRS_DATA.map((p, i) => `${i ? "L" : "M"}${r1(p.bx)} ${r1(p.y)}`).join(" ");

export default function HelixPoster({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 600" role="presentation" aria-hidden="true" focusable="false">
      <g transform="rotate(-17 200 300)">
        {PAIRS_DATA.map((p, i) => {
          const mid = (p.ax + p.bx) / 2;
          return (
            <g key={i} opacity={r1(0.7 + 0.3 * Math.max(p.az, p.bz))}>
              <line x1={r1(p.ax)} y1={r1(p.y)} x2={r1(mid - 3)} y2={r1(p.y)} stroke={COLORS[p.base]} strokeWidth="7" strokeLinecap="round" />
              <line x1={r1(mid + 3)} y1={r1(p.y)} x2={r1(p.bx)} y2={r1(p.y)} stroke={COLORS[COMP[p.base]]} strokeWidth="7" strokeLinecap="round" />
            </g>
          );
        })}
        <path d={strandA} fill="none" stroke="#2F6E68" strokeWidth="4" strokeLinejoin="round" />
        <path d={strandB} fill="none" stroke="#36437A" strokeWidth="4" strokeLinejoin="round" />
        {PAIRS_DATA.map((p, i) => (
          <g key={`n${i}`}>
            <circle cx={r1(p.ax)} cy={r1(p.y)} r={r1(9 + p.az * 2.5)} fill="#134E4A" />
            <circle cx={r1(p.bx)} cy={r1(p.y)} r={r1(9 + p.bz * 2.5)} fill="#1D2748" />
          </g>
        ))}
      </g>
    </svg>
  );
}
