import type { Path } from './shapes/Path';

/**
 * Less ink than this (in canvas units, which are 370 across) and the doodle
 * likely isn't finished: about two and a half lines straight across the page.
 */
export const BARELY_DRAWN = 1000;

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

/** Why a doodle looks unfinished, if it does: too little ink, or a pencil never picked up */
export type Unfinished = 'barely-drawn' | 'unused-pencil';

export function whyUnfinished(
  paths: Array<Path>,
  pencilColors: Array<string>,
): Unfinished | null {
  if (inkLength(paths) < BARELY_DRAWN) return 'barely-drawn';
  const used = new Set(
    paths.filter((path) => !path.isEraser).map((path) => path.color),
  );
  if (pencilColors.some((color) => !used.has(color))) return 'unused-pencil';
  return null;
}
