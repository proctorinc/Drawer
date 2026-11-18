import React, { forwardRef } from 'react';
import { useDrawing } from './DrawingContext'; // Adjust the path as needed
import { createCursorImage } from './utils';
import { Config } from '@/config/Config';
import { cn } from '@/utils';

const Canvas = forwardRef<
  HTMLCanvasElement,
  React.HTMLProps<HTMLCanvasElement>
>((props, ref) => {
  const { selectedColor } = useDrawing();
  const { className, style, ...otherProps } = props;
  const cursorImage = createCursorImage(selectedColor);
  const cursorStyle = {
    cursor: `url(${cursorImage}), 8 8 auto`,
    touchAction: 'none',
  };

  return (
    <canvas
      id="drawingCanvas"
      ref={ref}
      className={cn('max-w-full', className)}
      width={Config.CANVAS_WIDTH}
      height={Config.CANVAS_HEIGHT}
      style={{ ...cursorStyle, ...style }}
      {...otherProps}
    />
  );
});

export default Canvas;
