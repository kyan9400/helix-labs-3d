/*
 * Static view of the hero molecule: the real atoms of PDB 1BNA, projected with the 3D hero's stacking, scale and lean
 * (drawn by scripts/make-dna-poster.mjs into public/structures/1bna-poster.svg, ~6 KB gzip). Shown while the 3D warms
 * up, and as the designed fallback when WebGL is unavailable or the context is lost. A plain <img>, so it never
 * blocks the HTML or the headline (the LCP).
 */

const SRC = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/structures/1bna-poster.svg`;

export default function HelixPoster({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG drawing; next/image adds nothing here
    <img className={className} src={SRC} width={400} height={600} alt="" decoding="async" fetchPriority="low" />
  );
}
