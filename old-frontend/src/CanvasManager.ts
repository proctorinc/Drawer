import { IShape } from "./shapes/IShape";

// src/CanvasManager.ts
export class CanvasManager {
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found.`);
        }
        this.canvas = canvas;
        this.canvas.width = 900;
        this.canvas.height = 900;

        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D rendering context.');
        }
        this.ctx = context;

        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    resizeCanvas(): void {
        // Make canvas fill parent or window, adjust as needed
        console.log(window.innerWidth)
        console.log(window.innerHeight - this.canvas.offsetTop)
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - this.canvas.offsetTop; // Account for toolbar
        this.redraw(); // Redraw content after resize if needed
    }

    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    redraw(shapes?: IShape[]): void { // Optional: pass shapes to draw
         this.clear();
         if (shapes) {
             shapes.forEach(shape => shape.draw(this.ctx));
         }
     }

    getElement(): HTMLCanvasElement {
        return this.canvas;
    }

    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    downloadCanvas(): void {
        const link = document.createElement('a');
        link.href = this.canvas.toDataURL();
        link.download = 'canvas.png';
        link.click();
    }
}