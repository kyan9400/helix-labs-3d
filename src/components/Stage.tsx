"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { detectTier, type Tier } from "@/lib/quality";
import { FORM_COUNT, scrollState } from "@/lib/scroll-state";

// The whole 3D scene (three.js + R3F) is a separate chunk, requested after the page is idle.
const Scene = dynamic(() => import("./three/Scene"), { ssr: false });

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export default function Stage() {
  const [tier, setTier] = useState<Tier | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Scroll -> continuous form index f (piecewise linear between the chapter centres)
  useEffect(() => {
    let anchors: number[] = [];
    let frame = 0;

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
      scrollState.onChange?.();
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

  // Decide the quality tier (and whether WebGL exists) only once the page has loaded and gone idle
  useEffect(() => {
    const w = window as IdleWindow;
    let idleId = 0;
    let timer = 0;
    const start = () => {
      const t = detectTier();
      if (t) setTier(t);
      else document.documentElement.dataset.stage = "fallback";
    };
    const schedule = () => {
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(start, { timeout: 2500 });
      else timer = window.setTimeout(start, 500);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const onReady = useCallback(() => {
    document.documentElement.dataset.stage = "ready";
  }, []);

  const onLost = useCallback(() => {
    document.documentElement.dataset.stage = "fallback";
    setTier(null);
  }, []);

  return (
    <div ref={wrap} className="stage" aria-hidden="true">
      {tier ? <Scene tier={tier} onReady={onReady} onLost={onLost} /> : null}
    </div>
  );
}
