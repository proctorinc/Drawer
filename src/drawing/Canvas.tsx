import React, { forwardRef } from 'react';
import { useDrawing } from './DrawingContext'; // Adjust the path as needed
import { createCursorImage } from './utils';
import { Config } from '@/config/Config';

const Canvas = forwardRef<
  HTMLCanvasElement,
  React.HTMLProps<HTMLCanvasElement>
>((props, ref) => {
  const { selectedColor } = useDrawing();
  const { className, ...otherProps } = props;
  const cursorImage = createCursorImage(selectedColor);
  const cursorStyle = {
    cursor: `url(${cursorImage}), 8 8 auto`,
    touchAction: 'none',
  };

  return (
    <canvas
      id="drawingCanvas"
      ref={ref}
      className="max-w-full"
      width={Config.CANVAS_WIDTH}
      height={Config.CANVAS_HEIGHT}
      style={{ ...cursorStyle }}
      {...otherProps}
    />
  );
});

export default Canvas;
