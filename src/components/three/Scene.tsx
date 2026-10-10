"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import Helix from "./Helix";
import CellField, { buildCellGeometry } from "./CellField";
import { yieldToMain } from "@/lib/defer";
import { TIERS, type Tier } from "@/lib/quality";
import { scrollState } from "@/lib/scroll-state";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";

export interface SceneProps {
  tier: Tier;
  onReady: () => void;
  onLost: () => void;
}

/** Image-based lighting generated in code (no HDRI download). Returns a cleanup. */
function applyRoomEnvironment(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();
  return () => {
    scene.environment = null;
    env.dispose();
  };
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 8]} intensity={1.7} />
      <directionalLight position={[-6, -3, -4]} intensity={0.9} color="#9ED9C9" />
    </>
  );
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
 * Warm-up in short tasks: yield, build the environment map, yield, compile every shader, then reveal.
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
      disposeEnv = applyRoomEnvironment(gl, scene);
      await yieldToMain();
      if (!alive) return;
      await gl.compileAsync(scene, camera).catch(() => undefined);
      if (!alive) return;
      invalidate();
      requestAnimationFrame(() => requestAnimationFrame(() => alive && onReady()));
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
  // With reduced motion every frame is on demand (scroll-driven); the gaps between them would read as a slow GPU
  // to PerformanceMonitor, so it only samples while the loop runs continuously.
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
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onLost();
        });
      }}
    >
      {!reduced && !fellBack && (
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(0.75, Math.round((d - 0.25) * 100) / 100))}
          onIncline={() => setDpr((d) => Math.min(cap, Math.round((d + 0.25) * 100) / 100))}
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
      <Warmup onReady={onReady} />
    </Canvas>
  );
}
