import { BASE_COLORS, BASE_LETTERS, buildSequence } from "@/lib/sequence";

/*
 * A thin column of base letters beside the hero molecule, read from the same sequence as the 3D strand
 * (index 0 at the bottom, like the helix). Decoration only: SVG text, aria-hidden.
 */

const COUNT = 32;
const STEP = 18;
const SEQ = Array.from(buildSequence(COUNT));

export default function SequenceRuler({ className = "" }: { className?: string }) {
  const h = COUNT * STEP;
  return (
    <svg className={`seq-ruler ${className}`.trim()} viewBox={`0 0 30 ${h}`} aria-hidden="true" focusable="false">
      <line x1="29.5" y1="0" x2="29.5" y2={h} className="seq-ruler__rule" />
      {SEQ.map((b, i) => {
        const y = h - i * STEP - STEP / 2;
        return (
          <g key={i}>
            <text x="12" y={y} dy="0.35em" textAnchor="middle" fill={BASE_COLORS[b]}>
              {BASE_LETTERS[b]}
            </text>
            <line x1={i % 8 === 0 ? 22 : 25} y1={y} x2="29.5" y2={y} className="seq-ruler__tick" />
          </g>
        );
      })}
    </svg>
  );
}
