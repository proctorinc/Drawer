import { useDrawing } from './DrawingContext';
import { createCursor } from './utils';
import type { CSSProperties, FC, HTMLAttributes } from 'react';
import { Config } from '@/config/Config';
import { cn } from '@/utils';

/** The drawing surface. Shown no larger than its drawing size, smaller to fit */
const Canvas: FC<HTMLAttributes<HTMLCanvasElement>> = ({
  className,
  style,
  ...props
}) => {
  const { selectedColor, selectedSize, canvasBindings } = useDrawing();

  return (
    <canvas
      id="drawingCanvas"
      {...canvasBindings}
      // The pixel buffer is denser than the canvas is shown, so cap its size
      // here; width and height stay auto so it keeps its shape as it shrinks
      className={cn(
        'block max-w-[min(100%,var(--canvas-w))] max-h-[var(--canvas-h)]',
        className,
      )}
      style={
        {
          '--canvas-w': `${Config.CANVAS_WIDTH}px`,
          '--canvas-h': `${Config.CANVAS_HEIGHT}px`,
          cursor: createCursor(selectedColor, selectedSize),
          touchAction: 'none',
          ...style,
        } as CSSProperties
      }
      {...props}
    />
  );
};

export default Canvas;
