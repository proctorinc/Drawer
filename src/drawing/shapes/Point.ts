import { Config } from '@/config/Config';

export type Point = {
  x: number;
  y: number;
};

/**
 * Where a pointer is on the canvas, in drawing units (0 to CANVAS_WIDTH),
 * however large the canvas is shown or however dense its pixels are
 */
export function getEventPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * Config.CANVAS_WIDTH) / rect.width,
    y: ((event.clientY - rect.top) * Config.CANVAS_HEIGHT) / rect.height,
  };
}
