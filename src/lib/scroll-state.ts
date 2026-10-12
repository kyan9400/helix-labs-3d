/*
 * Shared scroll state between the page (DOM) and the lazily loaded 3D scene.
 * Plain mutable object: written by the scroll listener, read inside useFrame. No React state per frame.
 *   f       continuous form index: 0 hero helix, 1 fork, 2 cell, 3 plasmid, 4 helix again
 *   opacity canvas opacity (fades out after the services section)
 *   heroY   document Y (px) of the hero visual's centre, so the portrait layout can sit the helix on it
 *   heroH   height (px) of the hero visual box (the phone hero lays the helix along its diagonal)
 *   dragV   drag-to-rotate velocity (rad/s), written by the hero pointer listener, decayed by the helix
 *   onChange     wakes the canvas (one slot, owned by the 3D scene)
 *   subscribers  DOM widgets (chapter dots) that react to f; called from the same rAF update
 */

export const FORM_COUNT = 5;

export const scrollState = {
  f: 0,
  opacity: 1,
  heroY: 0,
  heroH: 0,
  dragV: 0,
  onChange: null as null | (() => void),
  subscribers: new Set<() => void>(),
};

