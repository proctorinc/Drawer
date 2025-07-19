import type { Point } from './Point';

// Define the specific serialized format for Path
export interface SerializedPath {
  type: 'path';
  points: Array<Point>;
  color: string;
  lineWidth: number;
}

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

  addPoint(point: Point): Path {
    this.points.push(point);
    return this;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.points.length < 2) {
      if (this.points.length === 1) {
        if (this.isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = this.color;
        }
        ctx.beginPath();
        ctx.arc(
          this.points[0].x,
          this.points[0].y,
          this.lineWidth / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }
    ctx.beginPath();

    if (this.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.color;
    }
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(this.points[0].x, this.points[0].y);

    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Returns a plain object representation of the Path for serialization.
   */
  serialize(): SerializedPath {
    return {
      type: this.type,
      points: [...this.points], // Return a copy of points
      color: this.color,
      lineWidth: this.lineWidth,
    };
  }

  /**
   * Static method to create a Path instance from serialized data.
   * Useful for deserialization.
   */
  static deserialize(data: SerializedPath): Path {
    // Basic validation could be added here
    return new Path(data.points, data.color, data.lineWidth, false);
  }
}
