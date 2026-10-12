/*
 * Desktop cursor follower: a 28 px hairline ring that trails the pointer (lerp 0.2) and swells over interactive
 * elements. Decoration only: the native cursor stays visible, aria-hidden, pointer-events none.
 * The rAF stops once the ring has settled. Returns a detach function that also removes the ring.
 */

const TARGETS = "a, button, summary, label";

export function attachCursor(): () => void {
  const el = document.createElement("div");
  el.className = "cursor";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<span class="cursor__ring"></span>';
  document.body.appendChild(el);

  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  let frame = 0;
  let seen = false;

  const tick = () => {
    x += (tx - x) * 0.2;
    y += (ty - y) * 0.2;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.1 ? requestAnimationFrame(tick) : 0;
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX;
    ty = e.clientY;
    if (!seen) {
      seen = true;
      x = tx;
      y = ty;
      el.dataset.on = "";
    }
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const over = (e: PointerEvent) => {
    if (e.target instanceof Element && e.target.closest(TARGETS)) el.dataset.hot = "";
    else delete el.dataset.hot;
  };
  const out = (e: PointerEvent) => {
    if (e.relatedTarget) return;
    seen = false; // the pointer left the window
    delete el.dataset.on;
  };

  window.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerover", over, { passive: true });
  document.addEventListener("pointerout", out, { passive: true });
  return () => {
    window.removeEventListener("pointermove", move);
    document.removeEventListener("pointerover", over);
    document.removeEventListener("pointerout", out);
    if (frame) cancelAnimationFrame(frame);
    el.remove();
  };
}
