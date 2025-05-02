import React, { forwardRef } from 'react';
import { useDrawing } from './DrawingContext'; // Adjust the path as needed
import { createCursorImage } from './utils';
import { Config } from '@/config/Config';

const Canvas = forwardRef<HTMLCanvasElement, React.HTMLProps<HTMLCanvasElement>>((props, ref) => {
    const { selectedColor } = useDrawing();
    const cursorImage = createCursorImage(selectedColor);
    const cursorStyle = {
        cursor: `url(${cursorImage}), 8 8 auto`,
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md w-fit">
            <canvas
                id="drawingCanvas"
                ref={ref}
                className="rounded-2xl"
                width={Config.CANVAS_WIDTH}
                height={Config.CANVAS_HEIGHT}
                style={{ ...cursorStyle }}
                {...props}
            />
        </div>
    );
});

export default Canvas;
