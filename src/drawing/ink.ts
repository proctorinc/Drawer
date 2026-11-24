import type { Path } from './shapes/Path';

/**
 * Less ink than this (in canvas units, which are 370 across) is a stray tap
 * or a short scratch, not a doodle: about one short line across a third of
 * the page. Anyone who has really drawn something is well past it.
 */
export const BARELY_DRAWN = 120;

/** How much line the pencils have laid down; a tap counts as its dot's width */
export function inkLength(paths: Array<Path>): number {
  let length = 0;
  for (const path of paths) {
    if (path.isEraser) continue;
    if (path.points.length === 1) length += path.lineWidth;
    for (let i = 1; i < path.points.length; i++) {
      const from = path.points[i - 1];
      const to = path.points[i];
      length += Math.hypot(to.x - from.x, to.y - from.y);
    }
  }
  return length;
}
