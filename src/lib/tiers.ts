/*
 * What each quality tier draws. Imported only by the lazily loaded 3D chunk (keeps it off the first-load path);
 * the tier itself is picked in lib/quality.ts before that chunk is downloaded.
 */

import type { Tier } from "./quality";

export interface TierSettings {
  pairs: number;
  particles: number;
  dprCap: number;
  antialias: boolean;
  physical: boolean;
  segments: number;
  pulse: boolean;
  /** backbone curve samples per pair span */
  tubeSteps: number;
  /** radial segments of the backbone tube and the rungs */
  tubeRadial: number;
  /** fresnel membrane + nucleus shells in the cell form */
  shell: boolean;
  /** thin-film lacquer sheen on the backbone */
  iridescence: boolean;
}

export const TIERS: Record<Tier, TierSettings> = {
  high: {
    pairs: 64,
    particles: 1400,
    dprCap: 2,
    antialias: true,
    physical: true,
    segments: 24,
    pulse: true,
    tubeSteps: 6,
    tubeRadial: 14,
    shell: true,
    iridescence: true,
  },
  medium: {
    pairs: 52,
    particles: 700,
    dprCap: 1.5,
    antialias: true,
    physical: false,
    segments: 16,
    pulse: true,
    tubeSteps: 4,
    tubeRadial: 10,
    shell: true,
    iridescence: false,
  },
  low: {
    pairs: 36,
    particles: 260,
    dprCap: 1,
    antialias: false,
    physical: false,
    segments: 10,
    pulse: false,
    tubeSteps: 3,
    tubeRadial: 6,
    shell: false,
    iridescence: false,
  },
};
