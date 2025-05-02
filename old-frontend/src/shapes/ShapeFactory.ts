// src/shapes/ShapeFactory.ts
import { IShape, SerializedShape } from './IShape';
import { Path, SerializedPath } from './Path';
// Import other shapes and their serialized types...

export function createShapeFromData(data: SerializedShape): IShape | null {
    switch (data.type) {
        case 'path':
            // Type assertion is often needed here after checking the 'type' property
            return Path.deserialize(data as SerializedPath);
        // case 'line':
        //      return Line.deserialize(data as SerializedLine);
        // case 'rectangle':
        //     return Rectangle.deserialize(data as SerializedRectangle);
        // Add cases for other shape types...
        default:
            console.error('Unknown shape type during deserialization:', data.type);
            return null; // Or throw an error
    }
}