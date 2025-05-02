import { Point } from '../utils/Point'; // Adjust path if needed

// Define a common structure for serialized shape data
export interface SerializedShape {
    type: string; // 'line', 'path', 'rectangle', etc.
    // Add other common properties if any, or leave specific ones to inheriting interfaces
    [key: string]: any; // Allow additional properties specific to each shape type
}

export interface IShape {
    type: string; // Add type identifier to the interface
    draw(ctx: CanvasRenderingContext2D): void;
    serialize(): SerializedShape; // Method to get serializable data
}