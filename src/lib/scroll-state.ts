/*
 * Shared scroll state between the page (DOM) and the lazily loaded 3D scene.
 * Plain mutable object: written by the scroll listener, read inside useFrame. No React state per frame.
 *   f       continuous form index: 0 hero helix, 1 fork, 2 cell, 3 plasmid, 4 helix again
 *   opacity canvas opacity (fades out after the services section)
 *   heroY   document Y (px) of the hero visual's centre, so the portrait layout can sit the helix on it
 */

export const FORM_COUNT = 5;

export const scrollState = {
  f: 0,
  opacity: 1,
  heroY: 0,
  onChange: null as null | (() => void),
};
