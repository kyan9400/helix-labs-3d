"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { afterLoadIdle } from "@/lib/defer";
import { detectTier, type Tier } from "@/lib/quality";
import { FORM_COUNT, scrollState } from "@/lib/scroll-state";
import type { SceneProps } from "./three/Scene";

// The whole 3D scene (three.js + R3F) is a separate chunk, imported only after window 'load' + idle,
// and only when the GPU probe finds real hardware (or ?quality= forces it). Never during hydration.
type Loaded = { tier: Tier; Scene: ComponentType<SceneProps> };

export default function Stage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Scroll -> continuous form index f (piecewise linear between the chapter centres).
  // The same rAF update also drives the progress bar and the chapter dots (no second scroll listener).
  useEffect(() => {
    let anchors: number[] = [];
    let frame = 0;
    let maxScroll = 1;
    let progress: HTMLElement | null = null;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const centre = window.scrollY + vh / 2;
      let f = 0;
      if (anchors.length === FORM_COUNT) {
        if (centre >= anchors[FORM_COUNT - 1]) f = FORM_COUNT - 1;
        else {
          for (let k = 0; k < FORM_COUNT - 1; k++) {
            if (centre < anchors[k + 1]) {
              f = k + Math.max(0, (centre - anchors[k]) / Math.max(1, anchors[k + 1] - anchors[k]));
              break;
            }
          }
        }
        const past = centre - anchors[FORM_COUNT - 1] - vh * 0.3;
        scrollState.opacity = 1 - Math.min(1, Math.max(0, past / (vh * 0.45)));
      }
      scrollState.f = f;
      const el = wrap.current;
      if (el) {
        el.style.setProperty("--stage-fade", scrollState.opacity.toFixed(3));
        el.style.visibility = scrollState.opacity <= 0 ? "hidden" : "visible";
      }
      if (progress) progress.style.transform = `scaleX(${Math.min(1, window.scrollY / maxScroll)})`;
      scrollState.onChange?.();
      scrollState.subscribers.forEach((cb) => cb());
    };

    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-form-anchor]"));
      els.sort((a, b) => Number(a.dataset.formAnchor) - Number(b.dataset.formAnchor));
      const vh = window.innerHeight;
      anchors = els.map((el, i) => {
        if (i === 0) return vh / 2; // the hero form holds while the page is at the top
        const r = el.getBoundingClientRect();
        return r.top + window.scrollY + r.height / 2;
      });
      maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
      progress = document.querySelector<HTMLElement>(".progress");
      const visual = document.querySelector<HTMLElement>(".hero__visual");
      if (visual) {
        const r = visual.getBoundingClientRect();
        scrollState.heroY = r.top + window.scrollY + r.height / 2;
      }
      update();
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Once the page has loaded and gone idle: start the deferred effects, then decide the quality tier
  // (and whether WebGL exists)
  useEffect(() => {
    let alive = true;
    let stopFx: (() => void) | null = null;
    const cancel = afterLoadIdle(() => {
      // chapter dots + pointer effects (magnetic buttons, cursor ring): never on the first-load path
      import("./fx")
        .then((m) => {
          if (alive) stopFx = m.startDeferredFx();
        })
        .catch(() => undefined);
      const t = detectTier();
      if (!t) {
        document.documentElement.dataset.stage = "fallback"; // no WebGL or a software renderer: keep the poster
        return;
      }
      import("./three/Scene")
        .then((m) => {
          if (alive) setLoaded({ tier: t, Scene: m.default });
        })
        .catch(() => {
          document.documentElement.dataset.stage = "fallback";
        });
    });
    return () => {
      alive = false;
      cancel();
      stopFx?.();
    };
  }, []);

  const onReady = useCallback(() => {
    document.documentElement.dataset.stage = "ready";
  }, []);

  const onLost = useCallback(() => {
    document.documentElement.dataset.stage = "fallback";
    setLoaded(null);
  }, []);

  return (
    <div ref={wrap} className="stage" aria-hidden="true">
      {loaded ? <loaded.Scene tier={loaded.tier} onReady={onReady} onLost={onLost} /> : null}
    </div>
  );
}
