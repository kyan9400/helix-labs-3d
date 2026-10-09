"use client";

import { useSyncExternalStore } from "react";
import { getMotion, setMotion, subscribeMotion, type MotionMode } from "@/lib/motion";

const serverSnapshot = (): MotionMode | null => null;

export default function MotionToggle({ className = "" }: { className?: string }) {
  const mode = useSyncExternalStore<MotionMode | null>(subscribeMotion, getMotion, serverSnapshot);
  const reduced = mode === "reduced";
  return (
    <button
      type="button"
      className={`motion-toggle ${className}`}
      aria-pressed={mode === null ? undefined : !reduced}
      onClick={() => setMotion(reduced ? "full" : "reduced")}
    >
      <span className="motion-toggle__dot" aria-hidden="true" />
      {mode === null ? "Motion settings" : reduced ? "Turn on full motion" : "Reduce motion"}
    </button>
  );
}
