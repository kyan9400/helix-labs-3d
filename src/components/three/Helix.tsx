"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Molecule } from "./Molecule";
import type { TierSettings } from "@/lib/tiers";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";

/** Mounts the molecule and drives it from the render loop (the loop only runs while something moves). */
export default function Helix({ settings }: { settings: TierSettings }) {
  const [molecule] = useState(() => new Molecule(settings, isReducedMotion()));
  const reduced = useRef(true);

  useEffect(() => {
    reduced.current = isReducedMotion();
    return subscribeMotion(() => {
      reduced.current = isReducedMotion();
    });
  }, []);

  useEffect(() => () => molecule.dispose(), [molecule]);

  useFrame((state, delta) => {
    if (molecule.frame(state, delta, reduced.current)) state.invalidate();
  });

  return <primitive object={molecule.root} />;
}
