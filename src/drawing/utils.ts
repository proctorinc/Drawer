import { Config } from '@/config/Config';

const cursors = new Map<string, string>();

/**
 * A brush-sized dot in the color in hand, with an ink ring so it shows up on
 * any background. The eraser (null) is a hollow ring.
 */
export const createCursor = (color: string | null) => {
  const key = color ?? 'eraser';
  const cached = cursors.get(key);
  if (cached) return cached;

  const size = Config.CURSOR_SIZE + 4;
  const center = size / 2;
  const fill = color ?? '#ffffff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${center}" cy="${center}" r="${Config.CURSOR_SIZE / 2}" fill="${fill}" stroke="#2b2a33" stroke-width="1.5"${color ? '' : ' stroke-dasharray="3 2"'}/></svg>`;
  const cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
  cursors.set(key, cursor);
  return cursor;
};
