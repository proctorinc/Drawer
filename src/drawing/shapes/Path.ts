import type { Point } from "./Point";

// Define the specific serialized format for Path
export interface SerializedPath {
    type: 'path';
    points: Point[];
    color: string;
    lineWidth: number;
}

export class Path {
    readonly type = 'path';
    public points: Point[];
    public color: string;
    public lineWidth: number;

    constructor(points: Point[], color: string, lineWidth: number) {
        this.points = [...points];
        this.color = color;
        this.lineWidth = lineWidth;
    }

    addPoint(point: Point): Path {
        this.points.push(point);
        return this;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.points.length < 2) {
             if (this.points.length === 1) {
                 ctx.fillStyle = this.color;
                 ctx.beginPath();
                 ctx.arc(this.points[0].x, this.points[0].y, this.lineWidth / 2, 0, Math.PI * 2);
                 ctx.fill();
             }
             return;
         }
         ctx.beginPath();

         ctx.strokeStyle = this.color;
         ctx.lineWidth = this.lineWidth;
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';

         ctx.moveTo(this.points[0].x, this.points[0].y);

         for (let i = 1; i < this.points.length; i++) {
             ctx.lineTo(this.points[i].x, this.points[i].y);
         }
         ctx.stroke();
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
        return new Path(data.points, data.color, data.lineWidth);
    }
}