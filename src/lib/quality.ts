/*
 * GPU quality tiers, decided BEFORE the Canvas is created.
 * A throwaway WebGL2 context tells us whether 3D works at all and which GPU this is.
 * ?quality=low|medium|high overrides everything.
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

/** Returns the tier to use, or null when WebGL is not available at all. */
export function detectTier(): Tier | null {
  const canvas = document.createElement("canvas");
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    gl =
      canvas.getContext("webgl2", { powerPreference: "high-performance" }) ||
      canvas.getContext("webgl", { powerPreference: "high-performance" });
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const gpu = gpuName(gl);
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  const forced = new URLSearchParams(window.location.search).get("quality");
  if (isTier(forced)) return forced;

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const saveData = Boolean(nav.connection?.saveData);
  const touch = window.matchMedia("(pointer: coarse)").matches;

  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(gpu)) return "low";
  if (saveData || cores <= 2 || memory <= 2) return "low";

  let tier: Tier = "high";
  if (touch || cores <= 4 || memory <= 4) tier = "medium";
  if (/intel|uhd|iris|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i.test(gpu)) {
    tier = "medium";
  }
  return tier;
}
