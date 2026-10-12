"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/*
 * Tiny adaptive-DPR loop (replaces drei's PerformanceMonitor, so drei stays out of the 3D chunk).
 * Averages fps over 1 s windows: below 45 steps DPR down by 0.25 (floor 0.75), above 58 for two windows steps it up
 * (to `cap`). After 3 flip-flops it gives up and locks DPR at 0.75. Plain numbers in refs: nothing allocated per frame.
 * Mount it only while the loop runs continuously; long gaps between demand frames are ignored anyway.
 */

const FLOOR = 0.75;
const STEP = 0.25;

interface AdaptiveDprProps {
  cap: number;
  dpr: number;
  onChange: (dpr: number) => void;
  onFallback: () => void;
}

export default function AdaptiveDpr({ cap, dpr, onChange, onFallback }: AdaptiveDprProps) {
  const s = useRef({ time: 0, frames: 0, good: 0, last: 0, flips: 0, done: false });

  useFrame((_, delta) => {
    const st = s.current;
    if (st.done) return;
    // a pause (demand loop idle, tab hidden) is not a slow frame: start a fresh window
    if (delta > 0.25) {
      st.time = 0;
      st.frames = 0;
      return;
    }
    st.time += delta;
    st.frames++;
    if (st.time < 1) return;

    const fps = st.frames / st.time;
    st.time = 0;
    st.frames = 0;
    const d = dpr; // useFrame always runs the latest closure
    let dir = 0;
    if (fps < 45) {
      st.good = 0;
      if (d > FLOOR) dir = -1;
    } else if (fps > 58) {
      st.good++;
      if (st.good >= 2 && d < cap) dir = 1;
    } else st.good = 0;
    if (!dir) return;

    st.good = 0;
    if (st.last && dir !== st.last) st.flips++;
    st.last = dir;
    if (st.flips >= 3) {
      st.done = true;
      onFallback();
      return;
    }
    const next = Math.round(Math.min(cap, Math.max(FLOOR, d + dir * STEP)) * 100) / 100;
    if (next !== d) onChange(next);
  });

  return null;
}
