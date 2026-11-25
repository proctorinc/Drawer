import { useImperativeHandle } from 'react';
import Canvas from './Canvas';
import { usePinchZoom } from './usePinchZoom';
import type { CSSProperties, FC, HTMLAttributes, Ref, RefObject } from 'react';
import type { PinchZoomHandle } from './usePinchZoom';
import { ZoomOutIcon } from '@/components/icons';
import { cn } from '@/utils';

type Props = {
  variant?: 'round' | 'square';
  backgroundColor?: string;
  /** Shown at exactly this many CSS px a side; otherwise sized by `canvasClassName` */
  size?: number;
  canvasClassName?: string;
  canvasProps?: HTMLAttributes<HTMLCanvasElement>;
  /** Lets the page undo the zoom, e.g. before measuring the canvas for an animation */
  zoomRef?: Ref<PinchZoomHandle>;
  /** Where a pinch zooms the canvas from (the whole page, say); the frame if not given */
  pinchAreaRef?: RefObject<HTMLElement | null>;
  className?: string;
};

/** The canvas in its sketchy frame: one finger draws, two pinch to zoom and pan */
const ZoomableCanvas: FC<Props> = ({
  variant = 'square',
  backgroundColor,
  size,
  canvasClassName,
  canvasProps,
  zoomRef,
  pinchAreaRef,
  className,
}) => {
  const { frameRef, zoomed, edges, reset } = usePinchZoom(pinchAreaRef);
  const rounded =
    variant === 'round'
      ? 'rounded-full'
      : 'rounded-[6px_14px_8px_12px/12px_6px_14px_8px]';
  useImperativeHandle(zoomRef, () => ({ reset }), [reset]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={frameRef}
        className={cn(
          'overflow-hidden bg-white border-2 border-ink shadow-pencil touch-none',
          rounded,
        )}
      >
        <Canvas
          style={
            {
              backgroundColor,
              ...(size !== undefined && {
                width: size,
                height: size,
                maxWidth: 'none',
                maxHeight: 'none',
              }),
            } as CSSProperties
          }
          className={canvasClassName}
          {...canvasProps}
        />
      </div>
      {/* Zoomed in on a blank canvas, the frame looks the same wherever you
          are, so a dashed line marks each side where the canvas really ends */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-[5px] pointer-events-none border-2 border-dashed border-transparent transition-colors duration-200',
          rounded,
          edges.top && 'border-t-ink/40',
          edges.right && 'border-r-ink/40',
          edges.bottom && 'border-b-ink/40',
          edges.left && 'border-l-ink/40',
        )}
      />
      {zoomed && (
        <button
          type="button"
          aria-label="Zoom back out"
          onClick={() => reset(true)}
          className="press absolute top-2 right-2 flex items-center justify-center size-10 bg-white border-2 border-ink rounded-full shadow-pencil-sm cursor-pointer animate-in zoom-in-50 fade-in duration-200"
        >
          <ZoomOutIcon size={20} />
        </button>
      )}
    </div>
  );
};

export default ZoomableCanvas;
