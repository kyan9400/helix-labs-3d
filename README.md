# Helix Labs — genomic medicine clinic (concept)

A one-page site for a fictional biotech clinic, built around one real-time 3D moment: a DNA double helix that
**unwinds into each service as you scroll** — helix → replication fork → cell → plasmid ring → helix again — floating
in a field of shader-drawn cells. Light, editorial "specimen sheet" design; fully usable without WebGL.

Live: <!-- LIVE_URL -->

> Concept project — fictional brand. Part of the Alhassan Alfarran creative-development portfolio.

## Tech stack

- **Next.js 16.3.6** (App Router, `src/` dir, TypeScript strict, Turbopack build)
- **React 19.3.0**
- **three 0.186.1** + **@react-three/fiber 9.8.1** + **@react-three/drei 10.7.9** (only `PerformanceMonitor`)
- **Tailwind CSS 4.3.3** (`@import "tailwindcss"` + `@theme` tokens) with hand-written component CSS
- ESLint 9 flat config with `eslint-config-next/core-web-vitals`

All versions are pinned exactly (`npm install --save-exact`). GSAP and Lenis from the shared stack are intentionally
**not installed**: the scroll mapping is a few lines over native scroll, which keeps the first-load JS small and
avoids a second smoothing layer. Post-processing is not used.

## The signature 3D technique

- **Instanced molecule.** 64 base pairs = 128 nucleotide spheres, 128 half-rungs and 126 backbone links drawn by
  **three `InstancedMesh`es** (3 draw calls). Unit cylinders are oriented between points with a reused quaternion.
- **Five procedural forms** (`src/components/three/forms.ts`): double helix with a 0.75π groove offset, a replication
  fork (untwisted ladder that splits into a Y with unzipped rungs), a cell (pairs wound on a spherical spiral — strand
  A = membrane, strand B = nucleus), a twisted plasmid ring, and a wider re-zipped helix.
- **Scroll → form index.** The viewport centre is mapped piecewise-linearly between the chapter centres to a
  continuous `f ∈ [0, 4]`. Each pair blends with a per-index stagger, so the change travels along the strand like an
  unwinding; a smoothstep plateau holds each form while you read. A "read head" pulse runs along the strand.
- **Cell particle field.** `THREE.Points` + custom shader: every particle is a soft cell (membrane ring, body,
  off-centre nucleus); drift happens in the vertex shader from one time uniform.
- **Lighting** from `RoomEnvironment` through PMREM (generated in code — no HDRI download) plus two lights;
  clearcoat physical material on the high tier.

### Performance

- `frameloop="demand"`; the loop only runs while the morph is settling or autonomous motion is allowed (full motion,
  tab visible, scene on screen). After the services section the canvas fades out and stops rendering.
- Quality tier picked **before** the Canvas exists from a throwaway WebGL probe (GPU name, cores, memory, touch,
  Save-Data): high / medium / low change pair count, particle count, DPR cap (2 / 1.5 / 1), MSAA and materials.
  `?quality=low|medium|high` overrides. drei `PerformanceMonitor` lowers/raises the DPR at runtime.
- The 3D chunk is requested only after `load` + idle; shaders are warmed with `gl.compileAsync` before the canvas
  fades in over a code-made SVG poster. No per-frame allocations, no React state per frame.
- No `backdrop-filter` anywhere; panels over the canvas are solid.
- First-load JS for `/`: **~179 KB gzip** across all script tags (≈140 KB without the legacy `nomodule` polyfills);
  the lazy 3D chunk is ~241 KB gzip on top.

### Motion & fallback

- `prefers-reduced-motion` is respected by default; a **"Turn on full motion"** toggle (hero + footer) stores the
  choice in `localStorage`, and `?motion=full|reduced` overrides. Reduced motion = no spin, drift, pulse or parallax,
  and forms cut at chapter midpoints instead of sweeping.
- No WebGL or a lost context → the designed SVG helix poster stays and the page is fully usable.

## Project layout

```
src/
  app/            layout (fonts, metadata, motion init), page, 404, icon.svg, opengraph-image, robots, sitemap
  components/     Stage (tier probe + scroll mapping + lazy Scene), AppointmentForm, MotionToggle, posters, portraits
  components/three/  Scene, Helix, HelixSim (blend + instance matrices), forms, CellField
  lib/            motion preference, quality tiers, shared scroll state
SPEC.md           design + content spec
```

## Run it

```bash
npm install
npm run dev      # local development
npm run build    # production build
npm run lint
```

On low-memory Windows machines: `NODE_OPTIONS=--max-old-space-size=3072 npm run build`.

## Credits

Fonts: Instrument Serif, Manrope, JetBrains Mono (SIL OFL, via `next/font`). Libraries: see `CREDITS.md`.
All 3D, imagery and icons are made in code for this project.

© 2026 Alhassan Alfarran. All rights reserved — see `LICENSE`.
