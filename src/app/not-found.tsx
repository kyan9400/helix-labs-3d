import type { Metadata } from "next";
import Link from "next/link";
import LogoMark from "@/components/Logo";

export const metadata: Metadata = {
  title: "Sequence not found",
  description: "This page doesn't exist. Head back to Helix Labs.",
  robots: { index: false },
};

const COLORS = ["#D9472F", "#E9A23B", "#1E9C8F", "#3F51C9"];

function BrokenHelix() {
  const rows = [];
  for (let i = 0; i < 16; i++) {
    if (i === 7 || i === 8) continue; // the deletion
    const t = i / 15;
    const a = t * Math.PI * 2 * 1.6;
    const y = 14 + i * 22;
    const ax = Math.round(100 + Math.cos(a) * 58);
    const bx = Math.round(100 + Math.cos(a + Math.PI * 0.75) * 58);
    const shift = i > 8 ? 26 : 0;
    rows.push(
      <g key={i} transform={`translate(${shift} 0)`}>
        <line x1={ax} y1={y} x2={bx} y2={y} stroke={COLORS[i % 4]} strokeWidth="6" strokeLinecap="round" />
        <circle cx={ax} cy={y} r="7" fill="#134E4A" />
        <circle cx={bx} cy={y} r="7" fill="#1D2748" />
      </g>,
    );
  }
  return (
    <svg className="nf__art" viewBox="0 0 230 360" aria-hidden="true" focusable="false">
      {rows}
      <text x="160" y="186" fontFamily="var(--font-mono), monospace" fontSize="13" fill="#AE3520">
        del(404)
      </text>
    </svg>
  );
}

export default function NotFound() {
  return (
    <main id="main" className="nf">
      <div className="wrap nf__grid">
        <div>
          <Link href="/" className="brand" aria-label="Helix Labs home">
            <LogoMark />
            <span className="brand__name">Helix Labs</span>
          </Link>
          <p className="tag nf__tag">Error 404 · Variant of unknown significance</p>
          <h1 className="display">
            Sequence <em>not found.</em>
          </h1>
          <p className="lead nf__lead">This page has a deletion we can&rsquo;t repair. The rest of the genome is fine.</p>
          <Link href="/" className="btn btn--primary nf__btn">
            Back to Helix Labs
          </Link>
          <p className="nf__foot">© 2026 Alhassan Alfarran · Concept project — fictional brand.</p>
        </div>
        <BrokenHelix />
      </div>
    </main>
  );
}
