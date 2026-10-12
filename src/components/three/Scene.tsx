"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import AdaptiveDpr from "./AdaptiveDpr";
import Helix from "./Helix";
import CellField, { buildCellGeometry } from "./CellField";
import { applyStudioEnvironment } from "./studioEnv";
import { yieldToMain } from "@/lib/defer";
import type { Tier } from "@/lib/quality";
import { TIERS } from "@/lib/tiers";
import { scrollState } from "@/lib/scroll-state";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";

export interface SceneProps {
  tier: Tier;
  onReady: () => void;
  onLost: () => void;
}

/** One key light for definition; the rest of the look comes from the baked studio environment. */
function Lighting() {
  return <directionalLight position={[4, 6, 8]} intensity={1.2} />;
}

/**
 * Drag to rotate (desktop hero only; CSS enables pointer events on the hero visual at >=900px with a fine pointer,
 * once the 3D is live). Writes a velocity; the molecule adds it to its spin and lets it decay (inertia).
 * Lives in the 3D chunk, so it costs nothing on first load.
 */
function DragSpin() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".hero__visual");
    if (!el) return;
    let id = -1;
    let lastX = 0;
    let lastT = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      id = e.pointerId;
      lastX = e.clientX;
      lastT = e.timeStamp;
      el.setPointerCapture?.(id);
      el.dataset.dragging = "";
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dt = Math.max(8, e.timeStamp - lastT) / 1000;
      const v = ((e.clientX - lastX) * 0.008) / dt;
      scrollState.dragV = Math.max(-10, Math.min(10, scrollState.dragV * 0.4 + v * 0.6));
      lastX = e.clientX;
      lastT = e.timeStamp;
      scrollState.onChange?.();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      delete el.dataset.dragging;
    };
    el.addEventListener("pointerdown", down, { passive: true });
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerup", up, { passive: true });
    el.addEventListener("pointercancel", up, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return null;
}

/** Wakes the demand loop when scroll, motion preference or tab visibility change. */
function Driver() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const wake = () => invalidate();
    scrollState.onChange = wake;
    const unsub = subscribeMotion(wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      if (scrollState.onChange === wake) scrollState.onChange = null;
      unsub();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [invalidate]);
  return null;
}

/**
 * Warm-up in short tasks: yield, bake the studio environment, yield, compile every shader, then reveal.
 * The environment is applied before compiling so the programs are built once, with it.
 */
function Warmup({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let alive = true;
    let disposeEnv: (() => void) | null = null;
    (async () => {
      await yieldToMain();
      if (!alive) return;
      // starts dim; the molecule raises it during the intro ("lights on")
      disposeEnv = applyStudioEnvironment(gl, scene, isReducedMotion() ? 0.9 : 0.15);
      await yieldToMain();
      if (!alive) return;
      // compile hidden parts too (ring, shells), so they don't hitch when they first appear
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      await gl.compileAsync(scene, camera).catch(() => undefined);
      hidden.forEach((o) => {
        o.visible = false;
      });
      if (!alive) return;
      invalidate();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!alive) return;
          onReady();
          invalidate(); // first frame after reveal starts the intro
        }),
      );
    })();
    return () => {
      alive = false;
      disposeEnv?.();
    };
  }, [gl, scene, camera, invalidate, onReady]);
  return null;
}

export default function Scene({ tier, onReady, onLost }: SceneProps) {
  const settings = TIERS[tier];
  const [cap] = useState(() => Math.min(window.devicePixelRatio || 1, settings.dprCap));
  const [dpr, setDpr] = useState(cap);
  const [fellBack, setFellBack] = useState(false);
  // With reduced motion every frame is on demand (scroll-driven); the gaps between them would read as a slow GPU,
  // so the adaptive DPR only samples while the loop runs continuously.
  const reduced = useSyncExternalStore(subscribeMotion, isReducedMotion, () => true);
  const [cells, setCells] = useState<THREE.BufferGeometry | null>(null);

  // build the particle buffers in their own task, before the Canvas mounts
  useEffect(() => {
    let alive = true;
    let built: THREE.BufferGeometry | null = null;
    yieldToMain().then(() => {
      if (!alive) return;
      built = buildCellGeometry(settings.particles);
      return yieldToMain().then(() => {
        if (alive && built) setCells(built);
      });
    });
    return () => {
      alive = false;
      built?.dispose();
    };
  }, [settings.particles]);

  if (!cells) return null;

  return (
    <Canvas
      className="stage__canvas"
      frameloop="demand"
      dpr={dpr}
      camera={{ fov: 35, position: [0, 0, 12], near: 0.1, far: 60 }}
      gl={{ antialias: settings.antialias, alpha: true, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMappingExposure = 1.08; // ACES Filmic (R3F default)
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onLost();
        });
      }}
    >
      {!reduced && !fellBack && (
        <AdaptiveDpr
          cap={cap}
          dpr={dpr}
          onChange={setDpr}
          onFallback={() => {
            setFellBack(true);
            setDpr(0.75);
          }}
        />
      )}
      <Lighting />
      <CellField geometry={cells} />
      <Helix settings={settings} />
      <Driver />
      <DragSpin />
      <Warmup onReady={onReady} />
    </Canvas>
  );
}
