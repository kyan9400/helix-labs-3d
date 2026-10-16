/*
 * Motion preference.
 * The site starts in full motion on a first visit (even when the OS asks for reduced motion: many Windows users
 * switch animations off for speed rather than comfort). The "Reduce motion" toggle switches it off; that choice is
 * kept in localStorage and respected on later visits. ?motion=full|reduced in the URL wins (handy for testing).
 * An inline script in the layout sets <html data-motion> before first paint (see MOTION_INIT_SCRIPT).
 */

export type MotionMode = "full" | "reduced";

export const MOTION_KEY = "helix-motion";
export const MOTION_EVENT = "helix:motion";

export const MOTION_INIT_SCRIPT = `(function(){try{var d=document.documentElement;d.classList.add("js");var u=new URLSearchParams(location.search).get("motion");var s=null;try{s=localStorage.getItem("${MOTION_KEY}")}catch(e){}var c=(u==="full"||u==="reduced")?u:s;d.setAttribute("data-motion",c==="reduced"?"reduced":"full");}catch(e){}})();`;

export function getMotion(): MotionMode {
  if (typeof document === "undefined") return "full";
  return document.documentElement.dataset.motion === "reduced" ? "reduced" : "full";
}

export function isReducedMotion(): boolean {
  return getMotion() === "reduced";
}

export function setMotion(mode: MotionMode): void {
  document.documentElement.dataset.motion = mode;
  let saved = false;
  try {
    localStorage.setItem(MOTION_KEY, mode);
    saved = true;
  } catch {
    saved = false;
  }
  // When storage works the URL override would beat the saved choice next time, so drop it.
  // When storage is blocked, carry the choice in the URL instead.
  try {
    const url = new URL(window.location.href);
    if (saved) url.searchParams.delete("motion");
    else url.searchParams.set("motion", mode);
    history.replaceState(history.state, "", url);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(MOTION_EVENT));
}

export function subscribeMotion(callback: () => void): () => void {
  window.addEventListener(MOTION_EVENT, callback);
  return () => window.removeEventListener(MOTION_EVENT, callback);
}
