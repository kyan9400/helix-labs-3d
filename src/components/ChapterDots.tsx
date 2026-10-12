/*
 * Chapter dots for the four services: real links, server-rendered (no hydration cost).
 * Bound after load + idle (components/fx) to Stage's scroll update through scrollState.subscribers.
 */

const CHAPTERS = [
  { id: "sequencing", label: "Genome Sequencing" },
  { id: "cell-therapy", label: "Cell Therapy" },
  { id: "diagnostics", label: "Precision Diagnostics" },
  { id: "longevity", label: "Longevity Programme" },
];

export default function ChapterDots() {
  return (
    <nav className="chapter-dots" aria-label="Service chapters">
      <ol>
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <a href={`#${c.id}`}>
              <span className="chapter-dots__label">
                {String(i + 1).padStart(2, "0")}
                <span className="sr-only"> {c.label}</span>
              </span>
              <span className="chapter-dots__dot" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
