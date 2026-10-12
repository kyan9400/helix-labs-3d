import { scrollState } from "./scroll-state";

/**
 * Binds the server-rendered chapter dots to the scroll state: visible while 0.5 <= f <= 4.4 (and the stage is
 * still on screen), aria-current on the active chapter. The DOM is touched only when something changes.
 */
export function bindChapterDots(): () => void {
  const el = document.querySelector<HTMLElement>(".chapter-dots");
  if (!el) return () => undefined;
  const links = Array.from(el.querySelectorAll<HTMLAnchorElement>("a"));
  let active = -1;
  let shown: boolean | null = null;

  const sync = () => {
    const f = scrollState.f;
    const show = f >= 0.5 && f <= 4.4 && scrollState.opacity > 0.5;
    if (show !== shown) {
      shown = show;
      if (show) el.dataset.visible = "";
      else delete el.dataset.visible;
    }
    const next = Math.min(3, Math.max(0, Math.round(f) - 1));
    if (next === active) return;
    active = next;
    links.forEach((a, i) => {
      if (i === next) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };

  sync();
  scrollState.subscribers.add(sync);
  return () => {
    scrollState.subscribers.delete(sync);
  };
}
