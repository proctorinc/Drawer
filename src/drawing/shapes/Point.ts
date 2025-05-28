export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export function getEventPoint(
  event: MouseEvent | TouchEvent,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;

  if ('touches' in event) {
    // Touch event
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    // Mouse event
    clientX = event.clientX;
    clientY = event.clientY;
  }

  // Adjust for canvas position and scale (if canvas CSS size is different from element size)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  return new Point(x, y);
}
