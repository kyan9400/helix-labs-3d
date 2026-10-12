/*
 * Magnetic primary buttons: on a fine pointer with full motion, each .btn--primary leans up to 6 px toward the
 * pointer and its .btn__label 3 px further, then springs back on leave (the CSS transform transition is the spring).
 * One rAF per move, no React. Returns a detach function.
 */

const PULL = 6;
const LABEL = 3;

export function attachMagnetic(): () => void {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>(".btn--primary"));
  const offs = buttons.map((btn) => {
    const label = btn.querySelector<HTMLElement>(".btn__label");
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      btn.style.transform = `translate3d(${x * PULL}px, ${y * PULL}px, 0)`;
      if (label) label.style.transform = `translate3d(${x * LABEL}px, ${y * LABEL}px, 0)`;
    };
    const move = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      btn.style.transform = "";
      if (label) label.style.transform = "";
    };
    btn.addEventListener("pointermove", move, { passive: true });
    btn.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      btn.removeEventListener("pointermove", move);
      btn.removeEventListener("pointerleave", leave);
      leave();
    };
  });
  return () => offs.forEach((off) => off());
}
