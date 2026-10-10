/*
  Scheduling helpers for the lazy 3D.
  - afterLoadIdle: runs a callback once the page has finished loading AND the main thread is idle,
    so the 3D chunk never competes with hydration or the first paint.
  - yieldToMain: hands the main thread back between heavy steps (shorter tasks, responsive page).
*/

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Calls `cb` after window 'load' + requestIdleCallback (timeout ~2.5 s). Returns a cancel function. */
export function afterLoadIdle(cb: () => void, timeout = 2500): () => void {
  const w = window as IdleWindow;
  let cancelled = false;
  let idleId: number | undefined;
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (cancelled) return;
    const run = () => {
      if (!cancelled) cb();
    };
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(run, { timeout });
    else timerId = setTimeout(run, 1200);
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
    if (timerId !== undefined) clearTimeout(timerId);
  };
}

type SchedulerGlobal = { scheduler?: { yield?: () => Promise<void> } };

/** Yields to the browser so pending input and paint can run before the next heavy step. */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as SchedulerGlobal).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
