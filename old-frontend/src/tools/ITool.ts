// src/tools/ITool.ts
import { AppState } from '../AppState';

export interface ITool {
    name: string; // e.g., 'pencil', 'line'
    onMouseDown(event: MouseEvent | TouchEvent, state: AppState, ctx: CanvasRenderingContext2D): void;
    onMouseMove(event: MouseEvent | TouchEvent, state: AppState, ctx: CanvasRenderingContext2D): void;
    onMouseUp(event: MouseEvent | TouchEvent, state: AppState, ctx: CanvasRenderingContext2D): void;
    drawPreview?(ctx: CanvasRenderingContext2D, state: AppState): void; // Optional: for tools like line/rect previews
}
