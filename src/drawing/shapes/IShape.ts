export interface SerializedShape {
    type: string;
    [key: string]: any;
}

export interface IShape {
    type: string;
    draw(ctx: CanvasRenderingContext2D): void;
    serialize(): SerializedShape;
}