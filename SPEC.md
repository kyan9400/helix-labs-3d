# Helix Labs — site spec

Concept project — fictional brand. Built for the Alhassan Alfarran creative-dev portfolio.

## 1. Concept

Helix Labs is a (fictional) genomic-medicine clinic: whole-genome sequencing, cell therapy, precision diagnostics and a
longevity programme, all interpreted by a clinician you actually meet. The site should feel like a **specimen sheet from
a very good lab** — warm bone paper, hairline rules, mono "sample tags", a confident serif — with one living object in
it: a DNA double helix that unwinds and re-forms into each service as you scroll.

Distinct from the other studio sites: light, editorial, clinical-warm (not the usual dark neon 3D look). Colour comes
almost entirely from the four nucleotide bases.

## 2. Audience

- Adults 30–65 researching genetic testing or a second opinion after a diagnosis; often referred by a GP or oncologist.
- They want reassurance (who reads my results? who owns my data?), price clarity and an easy way to book.
- Secondary: studio clients evaluating real-time 3D craft — the helix must be the memorable moment.

## 3. Sections (in order)

1. **Header** — logo mark + "Helix Labs", anchor nav (Services, Process, Lab, Team, FAQ), "Book a visit" button.
2. **Hero** (`#top`) — h1, sub, two CTAs, three proof stats, motion toggle. Helix on the right (desktop) / below text (mobile).
3. **Services** (`#services`) — four full-height chapters; the fixed 3D scene morphs per chapter:
   helix → replication fork → cell → plasmid ring → helix again.
4. **Process** (`#process`) — four numbered steps from first consult to written plan.
5. **The lab** (`#lab`) — four numbers + a data-privacy promise + three standards.
6. **Clinicians** (`#team`) — three people, code-made monogram portraits.
7. **Book** (`#book`) — appointment request form UI (client-side only, validated, confirmation state). Dark ink section.
8. **FAQ** (`#faq`) — five native `<details>` questions.
9. **Footer** — address, hours, contact, credit line, "© 2026 Alhassan Alfarran", "Concept project — fictional brand."
10. **404** — "Sequence not found" with a broken-helix SVG.

## 4. Signature 3D moment — "The unwinding"

**Technique.** One `<Canvas>` fixed behind the hero and services. 64 base pairs are drawn as **2 continuous backbone
tubes** (one `BufferGeometry` per strand, rebuilt in place: centripetal Catmull-Rom, parallel-transport frames, analytic
normals, rounded caps, a closure span that seals the plasmid ring), **phosphate beads** ×128, **open half-rungs** ×128 and
their **rounded tips** ×128 (instanced). Every pair has a target position in five *forms*, computed procedurally on the
CPU into reused `Float32Array`s:

| f | form | what it says |
|---|---|---|
| 0 | double helix, 0.75π groove offset, slow spin | hero — "your code" |
| 1 | replication fork: untwisted ladder that splits into a Y; the split point slides down as you scroll (live zipper) and a brushed-metal polymerase ring clamps on at it, lighting the bases it reads | Genome sequencing — reading |
| 2 | cell: pairs on a Fibonacci sphere, strand A = membrane, strand B = nucleus; fresnel membrane + nucleus shells | Cell therapy |
| 3 | plasmid: a closed ring with the two strands twisted around it; the backbone tubes close seamlessly | Precision diagnostics |
| 4 | wider, tighter helix — re-zipped | Longevity programme — renewal |

Scroll position is mapped to a continuous `f ∈ [0,4]` (piecewise-linear between chapter centres, native scroll, no
smoothing library). Between forms each pair blends with a per-index stagger, so the change travels *along* the strand
(it visibly unwinds rather than cross-fading). A held plateau (smoothstep 0.18→0.82) keeps each form still while you
read. A "read head" pulse travels along the strand as an emissive glow on the bases (`aGlow` instance attribute). Around
it, a **cell particle field**: `THREE.Points` with a custom shader that draws each particle as a soft cell (membrane ring
+ nucleus) and drifts in the vertex shader (no CPU work).

**The read (signature moment).** From the hero into Sequencing the camera does a **dolly zoom** (z 12 → 8.7 while fov
35° → 47°, `z·tan(fov/2)` constant, so the molecule keeps its size and the cell field stretches), the fork unzips live
with scroll, and the polymerase ring sweeps light along the bases. **Intro:** once the canvas is revealed, the pairs fly
in from the cell field and assemble while the studio lights come up (environment intensity 0.15 → 1.0 over 1.8 s; the slide fades in first).
**Drag to rotate** with inertia on the desktop hero.

**Look (darkfield redesign).** The molecule now sits in a **darkfield specimen slide**: one shader quad behind it
(a pill for the strand forms, a disc for the cell, an oval for the plasmid, sized per form) of deep tinted glass with a
soft centre light, drifting out-of-focus cells (procedural bokeh, 22 / 14 / 8 by tier), a dashed reticle, a scale bar, a
lit rim and a soft ink shadow on the paper. The slide changes tint per chapter (teal helix, cyan sequencing with a
bright scan line at the polymerase ring, indigo cell, plum plasmid, green renewal), so each chapter reads differently.
On phones the hero visual moves above the copy and the helix lies diagonally across a wide slide, then rises upright for
the services. Materials: backbones are dark glass (clearcoat, iridescent film on high) with a fresnel rim in the strand's
light colour and packets of light running along each strand in opposite directions (antiparallel); bases are glossy
candy glass with a constant inner glow, much brighter when the read head passes; beads are small iridescent pearls;
one additive halo per base pair blooms with the read light. Lighting: PMREM studio environment (code-made, as before) +
a key light + two coloured rim lights from behind (mint and warm coral); ACES Filmic, exposure 1.08.

**Draw calls:** 2 tubes + beads + rungs + tips + halos + ring ×2 + shells ×2 + slide + particles = **12 on high and
medium**, **10 on low** (no shells), and the ring (2) is skipped outside the Sequencing chapter, so usually 10 / 8.

**Render on demand.** `frameloop="demand"`. A loop runs only while something animates: the morph is settling, or
autonomous motion is allowed (full motion, tab visible, scene on screen). Past the services section the canvas fades and
stops rendering completely.

**Quality tiers** (decided before the Canvas is created, from a throwaway WebGL probe):

| tier | who | pairs | particles | DPR cap | tube steps / radial | extras |
|---|---|---|---|---|---|---|
| high | discrete GPU, non-touch | 64 | 1400 | 2 | 6 / 14 | MSAA, physical materials, iridescent lacquer, anisotropic ring, cell shells, 24-seg beads |
| medium | Intel/AMD iGPU, Mali/Adreno/PowerVR, touch | 52 | 700 | 1.5 | 4 / 10 | MSAA, standard materials, cell shells, 16-seg |
| low | ≤2 cores, ≤2 GB, Save-Data | 36 | 260 | 1 | 3 / 6 | no MSAA, 10-seg, no shells, no read-head pulse |

Software renderers (SwiftShader, llvmpipe, softpipe, Microsoft Basic Render, Mesa offscreen, or a context that fails
`failIfMajorPerformanceCaveat`) get no 3D at all: the poster stays and the 3D chunk is never downloaded.
`?quality=low|medium|high` overrides (and forces the 3D on). A small local adaptive-DPR loop (`AdaptiveDpr.tsx`, 1 s
windows) drops DPR by 0.25 below 45 fps (floor 0.75), raises it above 58 fps, and locks at 0.75 after 3 flip-flops.

**Reduced motion.** Full motion by default on a first visit (even with the OS reduce-motion setting on); a "Reduce
motion" / "Turn on full motion" toggle (hero + footer) stores the choice in `localStorage` (`helix-motion`) and later
visits respect it; `?motion=full|reduced` overrides. Reduced = no spin, no particle drift,
no read-head pulse, and forms **cut** at the chapter midpoint instead of sweeping. Scroll-linked content still works.

**No WebGL / context lost.** A designed inline SVG poster of the helix (code-made) is always in the hero; the canvas
fades in over it only after `gl.compileAsync` warm-up. If WebGL is missing, the renderer is software-only or the context is lost, the poster stays and
the page is fully usable.

**Loading.** The 3D chunk is imported after `load` + `requestIdleCallback` (2.5 s timeout), never during hydration, so
HTML/LCP are never blocked. Particle buffers, the environment map and shader compilation run as separate short tasks. A mono "Sequencing…" status
tag shows until the scene is warm.

## 5. Design system

**Palette** (all text pairs ≥ 4.5:1 on their backgrounds):

| token | hex | use |
|---|---|---|
| paper | `#F4F1EA` | page background |
| paper-2 | `#EAE4D8` | panels, bands |
| ink | `#10201F` | text, dark section bg |
| ink-2 | `#3A4B48` | secondary text (8.4:1 on paper) |
| rule | `#C9C1B1` | hairlines (decor) |
| teal (G) | `#0F6E68` | primary action, links (5.7:1 on paper) |
| coral (A) | `#D9472F` | decor; text variant `#AE3520` |
| amber (T) | `#E9A23B` | decor, focus ring on dark |
| indigo (C) | `#3446B8` | decor, data accents |
| mint | `#9ED9C9` | text accent on ink |

**Fonts** (Google Fonts, SIL OFL, self-hosted via `next/font`): *Instrument Serif* (display, 400 + italic),
*Manrope* (body/UI, variable), *JetBrains Mono* (sample tags, numbers, labels, variable).

**Type scale:** fluid — display `clamp(2.6rem, 7vw, 6rem)`, h2 `clamp(2rem, 4.6vw, 3.75rem)`, h3 `1.5rem`, body `1.0625rem/1.6`,
tag `0.75rem` mono uppercase +0.08em.

**Spacing scale (4-pt):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 px → `--space-1 … --space-10`.
Radius: 2px (tags), 14px (cards), 999px (pills). Hairline 1px `rule`. Max content width 1200px, 16px gutter at 320px.

**Rules:** no `backdrop-filter` anywhere; panels over the canvas are solid `paper` at 94% opacity. Only transform/opacity
are animated. Focus ring: 3px teal (amber on ink), offset 3px. Tap targets ≥ 44px.

## 6. Final copy

**Hero** — tag: `HX—00 · Genomic medicine clinic` · h1: "Read the code you were *born with.*" · sub: "Whole-genome
sequencing, cell therapy and precision diagnostics under one roof — interpreted by a clinician who sits down with you,
not a PDF in your inbox." · CTAs: "Book a consultation", "Explore services" · stats: "30× whole-genome depth",
"11 days median turnaround", "1 clinician, start to finish".

**Services** — tag `HX—01 · Services`, h2 "Four services, one strand.", lead "Scroll, and the helix unwinds into each one."
1. *Genome Sequencing* — "All 3.1 billion base pairs, read at 30× depth." Body: "We sequence your whole genome — not a
   sample of it — and our geneticists translate it into what matters for you today: medicines, risks and family planning."
   Points: "Pharmacogenomics for 140+ common medicines" · "Carrier screening for 300+ inherited conditions" · "Your raw
   data to keep: FASTQ, BAM and VCF files". Price "from €890".
2. *Cell Therapy* — "Your own cells, prepared to do more." Body: "For patients whose oncologist is considering
   cell-based treatment, we handle collection, cryo-banking and trial matching, and stay in step with your care team."
   Points: "Autologous cell banking at −196 °C" · "Clinical-trial matching across 40 partner centres" · "One coordinator
   between you and your oncology team". Price "by referral".
3. *Precision Diagnostics* — "Small signals, read in context." Body: "Liquid biopsy and targeted panels pick up changes
   long before a scan can, and a specialist walks you through every result in person." Points: "Circulating tumour DNA
   monitoring" · "Hereditary cancer panels, including BRCA1/2 and Lynch syndrome" · "45-minute results consultation".
   Price "from €420".
4. *Longevity Programme* — "A yearly baseline that learns your biology." Body: "Each year we compare your epigenetic age,
   bloods and lifestyle data with last year's, and adjust one plan that you and your clinician own together." Points:
   "Epigenetic age assay" · "Quarterly bloods with trend lines" · "Plan reviewed every three months". Price "€1,650 / year".

**Process** — tag `HX—02 · Process`, h2 "How a visit works." Steps: 01 "Consult" — "A 45-minute conversation about your
history and what you want to know. No test is ordered until you're sure." · 02 "Sample" — "A saliva kit at home or a
10 ml blood draw in clinic. It takes four minutes." · 03 "Sequence & review" — "Our lab reads the sample; two
independent geneticists review every reportable finding." · 04 "Plan" — "You get a written plan in plain language and a
follow-up call — and you can ask questions for a full year."

**The lab** — tag `HX—03 · The lab`, h2 "A lab you can ask questions." Numbers: "48,000+ genomes read" · "99.9% variant
call accuracy" · "11 days median turnaround" · "0 records ever sold". Promise: "Your genome is never sold, pooled or
used for research without a separate consent you can withdraw at any time. You can ask us to delete it — and we send
you the confirmation." Standards: "Accredited clinical laboratory" · "Data stored in-region, encrypted at rest" ·
"Double-reviewed reports".

**Clinicians** — tag `HX—04 · Clinicians`, h2 "The people who read your results." Dr Inès Varga — Clinical geneticist,
lead — "Fifteen years in hereditary cancer genetics; believes every result deserves a conversation." · Dr Tomás Okafor —
Haematology & cell therapy — "Coordinates cell collection and trial referrals with hospitals across the region." ·
Mira Hollis, MSc — Genetic counsellor — "Helps families decide what to test, what to share and when."

**Book** — tag `HX—05 · Appointments`, h2 "Book a consultation." Lead: "Tell us a little about what you're looking for.
A coordinator replies within one working day to confirm a time." Fields: Full name · Email · Phone (optional) · Service
· Preferred date · Time of day (Morning 8–11 / Midday 11–14 / Afternoon 14–18) · Anything we should know? (optional) ·
consent "I agree to Helix Labs contacting me about this request." Button "Request appointment". Success: "Request
received." + reference `HX-` + 4 chars + "This is a concept site, so nothing was sent — but that's exactly how it would
feel." Side panel: address "14 Meridian Row, Port Calder", hours "Mon–Fri 08:00–18:00 · Sat 09:00–13:00".

**FAQ** — h2 "Questions, answered." 1. "Do I need a referral?" — "No. You can book directly; if you have a referral
letter, bring it and we'll coordinate with your doctor." 2. "Who can see my genetic data?" — "You, the clinicians
on your case and the lab team that processes it. Nobody else, unless you give written consent." 3. "Will results
affect my insurance?" — "We never share results with insurers. Rules differ by country, so your counsellor will explain
what applies to you before you test." 4. "How long until I get results?" — "Median 11 days for sequencing and 7 for
diagnostic panels. We call you when they're ready — results are never just emailed." 5. "Can I get my raw data?" —
"Yes. Genome sequencing includes your FASTQ, BAM and VCF files, downloadable for 12 months."

**Footer** — "Helix Labs — genomic medicine, explained in person." · address · hours · "Design & build: Alhassan Alfarran"
(portfolio link) · "© 2026 Alhassan Alfarran" · "Concept project — fictional brand." · motion toggle.

**404** — "Sequence not found." / "This page has a deletion we can't repair. The rest of the genome is fine." / "Back to Helix Labs".

## 7. Assets & licenses

| asset | source | license |
|---|---|---|
| DNA helix, forms, particles | procedural code (`src/components/three/`) | own work |
| Hero poster, favicon, OG image, avatars, 404 art | SVG / `next/og` drawn in code | own work |
| Instrument Serif, Manrope, JetBrains Mono | Google Fonts via `next/font` | SIL OFL 1.1 |
| Environment lighting | studio scene in code (`studioEnv.ts`), baked with PMREM | own work |

Zero downloaded images, models, HDRIs or audio.

## 8. Performance budget

- First-load JS for `/` < 250 KB gzip (target < 160 KB) excluding the lazy 3D chunk; 3D chunk loaded after idle.
- About 12 draw calls on high, 10 on low (see §4); no shadow maps, no post-processing.
- No per-frame allocations, no React state per frame; morph math in preallocated typed arrays.
- LCP = hero h1 / lead (server-rendered text, no JS reveal, fonts `display: swap`); CLS ≈ 0 (canvas is fixed, poster sized).
- Lighthouse mobile targets: Performance ≥ 85, Accessibility/Best Practices/SEO ≥ 95.
