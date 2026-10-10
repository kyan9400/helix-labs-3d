/*
 * GPU quality tiers, decided BEFORE the Canvas is created (and before the 3D chunk is downloaded).
 * A tiny throwaway WebGL context tells us whether 3D works at all and which GPU this is
 * (WEBGL_debug_renderer_info), then it is released with WEBGL_lose_context. No three.js needed.
 * Software renderers (SwiftShader, llvmpipe, softpipe, Microsoft Basic Render, Mesa offscreen, or a context that
 * only exists with a "major performance caveat") get no 3D at all: the designed poster stays.
 * ?quality=low|medium|high overrides everything and forces the 3D on (as long as WebGL exists).
 */

export type Tier = "low" | "medium" | "high";

export interface TierSettings {
  pairs: number;
  particles: number;
  dprCap: number;
  antialias: boolean;
  physical: boolean;
  segments: number;
  pulse: boolean;
}

export const TIERS: Record<Tier, TierSettings> = {
  high: { pairs: 64, particles: 1400, dprCap: 2, antialias: true, physical: true, segments: 24, pulse: true },
  medium: { pairs: 52, particles: 700, dprCap: 1.5, antialias: true, physical: false, segments: 16, pulse: true },
  low: { pairs: 36, particles: 260, dprCap: 1, antialias: false, physical: false, segments: 10, pulse: false },
};

function isTier(value: string | null): value is Tier {
  return value === "low" || value === "medium" || value === "high";
}

function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const name = String(gl.getParameter(gl.RENDERER) || "");
  if (!/^webkit/i.test(name)) return name;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || name) : name;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;

function probe(caveat: boolean): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const attrs: WebGLContextAttributes = {
    failIfMajorPerformanceCaveat: caveat,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  };
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const gpu = gpuName(gl);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return gpu;
}

/** Cheap GPU probe: `software` is true for CPU rasterisers, `gpu` is null when WebGL is missing. */
export function probeGpu(): { gpu: string | null; software: boolean } {
  const fast = probe(true);
  if (fast !== null) return { gpu: fast, software: SOFTWARE.test(fast) };
  const slow = probe(false); // only a slow (caveat) context, or none at all
  return { gpu: slow, software: slow !== null };
}

/** Returns the tier to use, or null when the page should keep the poster (no WebGL, or a software renderer). */
export function detectTier(): Tier | null {
  const { gpu, software } = probeGpu();
  if (gpu === null) return null;

  const forced = new URLSearchParams(window.location.search).get("quality");
  if (isTier(forced)) return forced;
  if (software) return null;

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const saveData = Boolean(nav.connection?.saveData);
  const touch = window.matchMedia("(pointer: coarse)").matches;

  if (saveData || cores <= 2 || memory <= 2) return "low";

  let tier: Tier = "high";
  if (touch || cores <= 4 || memory <= 4) tier = "medium";
  if (/intel|uhd|iris|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i.test(gpu)) {
    tier = "medium";
  }
  return tier;
}
