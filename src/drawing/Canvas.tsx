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
  const { className, ...otherProps } = props;
  const cursorImage = createCursorImage(selectedColor);
  const cursorStyle = {
    cursor: `url(${cursorImage}), 8 8 auto`,
  };

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border-2 border-border w-fit',
        className,
      )}
    >
      <canvas
        id="drawingCanvas"
        ref={ref}
        className="rounded-2xl"
        width={Config.CANVAS_WIDTH}
        height={Config.CANVAS_HEIGHT}
        style={{ ...cursorStyle }}
        {...otherProps}
      />
    </div>
  );
});

export default Canvas;
