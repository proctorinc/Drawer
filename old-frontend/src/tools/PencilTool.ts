import { AppState, ToolType } from '../AppState';
import { getEventPoint } from '../utils/Point';
import { Path } from '../shapes/Path';
import { ITool } from './ITool';

export class PencilTool implements ITool {
    readonly name = ToolType.PENCIL;
    private currentPath: Path | null = null;

    onMouseDown(event: MouseEvent | TouchEvent, state: AppState, ctx: CanvasRenderingContext2D): void {
        state.isDrawing = true;
        console.log(event)
        const startPoint = getEventPoint(event, ctx.canvas);
        this.currentPath = new Path(
            [startPoint],
            state.settings.selectedColor ? state.settings.selectedColor : '#ffffff',
            state.settings.lineWidth
        );
        this.currentPath.addPoint(startPoint);
    }

    onMouseMove(event: MouseEvent | TouchEvent, state: AppState, ctx: CanvasRenderingContext2D): void {
        if (!state.isDrawing || !this.currentPath) return;

        const point = getEventPoint(event, ctx.canvas);
        this.currentPath.addPoint(point);

        // Draw path incrementally for immediate feedback
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Simple clear, could optimize
        state.shapes.forEach(shape => shape.draw(ctx)); // Redraw existing shapes
        this.currentPath.draw(ctx); // Draw current path
    }

    onMouseUp(event: MouseEvent | TouchEvent, state: AppState, ctx: CanvasRenderingContext2D): void {
        if (!state.isDrawing || !this.currentPath) return;

        state.isDrawing = false;
        if (this.currentPath.points.length > 1) { // Only add if it's more than a dot
             state.addShape(this.currentPath);
        }
        this.currentPath = null;
         // Final redraw is usually handled by the main controller after state update
    }
}