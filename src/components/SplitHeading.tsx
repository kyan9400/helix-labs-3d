/*
 * Section heading whose words slide up out of a clip when the parent [data-reveal] gets .is-in.
 * The text stays real text (no aria-label tricks); the italic <em> run is kept. Below-fold h2s only, never the hero h1.
 */

interface SplitHeadingProps {
  id: string;
  lead: string;
  em: string;
  className?: string;
}

function words(text: string, offset: number) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (
      <span key={i} className="w" style={{ "--i": offset + i } as React.CSSProperties}>
        <span>{w}</span>
      </span>
    ));
}

/** Joins word spans with real spaces so the heading wraps and reads normally. */
function spaced(nodes: React.ReactNode[]) {
  return nodes.flatMap((n, i) => (i ? [" ", n] : [n]));
}

export default function SplitHeading({ id, lead, em, className = "h2" }: SplitHeadingProps) {
  const leadWords = words(lead, 0);
  return (
    <h2 id={id} className={`${className} split`}>
      {spaced(leadWords)} <em>{spaced(words(em, leadWords.length))}</em>
    </h2>
  );
}
