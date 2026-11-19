import type { Point } from './Point';

export interface SerializedPath {
  type: 'path';
  points: Array<Point>;
  color: string;
  lineWidth: number;
  isEraser: boolean;
}

/** One stroke: a color (or the eraser) dragged through some points */
export class Path {
  readonly type = 'path';
  public points: Array<Point>;
  public color: string;
  public lineWidth: number;
  public isEraser: boolean;

  constructor(
    points: Array<Point>,
    color: string,
    lineWidth: number,
    isEraser: boolean = false,
  ) {
    this.points = [...points];
    this.color = color;
    this.lineWidth = lineWidth;
    this.isEraser = isEraser;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;
    const [first, ...rest] = this.points;

    // The eraser punches through to whatever sits behind the canvas
    ctx.globalCompositeOperation = this.isEraser
      ? 'destination-out'
      : 'source-over';
    const color = this.isEraser ? '#000' : this.color;

    if (rest.length === 0) {
      // A tap leaves a dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(first.x, first.y, this.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = this.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      // Curve through the midpoints between samples, so fast strokes come
      // out smooth rather than as a string of straight segments
      for (let i = 0; i < rest.length - 1; i++) {
        const point = rest[i];
        const next = rest[i + 1];
        ctx.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) / 2,
          (point.y + next.y) / 2,
        );
      }
      const last = rest[rest.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  serialize(): SerializedPath {
    return {
      type: this.type,
      points: [...this.points],
      color: this.color,
      lineWidth: this.lineWidth,
      isEraser: this.isEraser,
    };
  }

  static deserialize(data: SerializedPath): Path {
    return new Path(data.points, data.color, data.lineWidth, data.isEraser);
  }
}
