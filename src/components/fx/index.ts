import { bindChapterDots } from "@/lib/chapter-dots";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";
import { attachCursor } from "./cursor";
import { attachMagnetic } from "./magnetic";

/*
 * Deferred effects, loaded after window load + idle so they cost nothing on first load:
 * - chapter dots (bound to Stage's scroll updates)
 * - magnetic buttons + cursor ring, each only with full motion and its pointer media query (re-synced on MOTION_EVENT)
 */

export function startDeferredFx(): () => void {
  const unbindDots = bindChapterDots();
  const fine = window.matchMedia("(pointer: fine)");
  const hover = window.matchMedia("(pointer: fine) and (hover: hover)");
  let magnetic: (() => void) | null = null;
  let cursor: (() => void) | null = null;

  const sync = () => {
    const full = !isReducedMotion();
    if (full && fine.matches) magnetic ??= attachMagnetic();
    else if (magnetic) {
      magnetic();
      magnetic = null;
    }
    if (full && hover.matches) cursor ??= attachCursor();
    else if (cursor) {
      cursor();
      cursor = null;
    }
  };

  sync();
  const unsub = subscribeMotion(sync);
  fine.addEventListener("change", sync);
  hover.addEventListener("change", sync);
  return () => {
    unbindDots();
    unsub();
    fine.removeEventListener("change", sync);
    hover.removeEventListener("change", sync);
    magnetic?.();
    cursor?.();
  };
}
