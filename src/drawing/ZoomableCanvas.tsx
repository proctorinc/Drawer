import { useImperativeHandle } from 'react';
import Canvas from './Canvas';
import { usePinchZoom } from './usePinchZoom';
import type {
  CSSProperties,
  FC,
  HTMLAttributes,
  ReactNode,
  Ref,
  RefObject,
} from 'react';
import type { Edges, PinchZoomHandle } from './usePinchZoom';
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
  /** Laid over the drawing, zooming and panning with it; never part of the saved image */
  overlay?: ReactNode;
  className?: string;
};

// Ink dashes on white, so the line shows up on any color drawn under it
const dashes = (angle: number) =>
  `repeating-linear-gradient(${angle}deg, var(--color-ink) 0 6px, white 6px 10px)`;

const SIDES: Record<
  keyof Edges,
  {
    place: string;
    /** How far along the side it runs, on the square frame and the round one */
    length: { square: string; round: string };
    hidden: string;
    background: string;
  }
> = {
  top: {
    place: 'top-[5px] h-0.5',
    length: { square: 'inset-x-3', round: 'inset-x-[30%]' },
    hidden: '-translate-y-1',
    background: dashes(90),
  },
  bottom: {
    place: 'bottom-[5px] h-0.5',
    length: { square: 'inset-x-3', round: 'inset-x-[30%]' },
    hidden: 'translate-y-1',
    background: dashes(90),
  },
  left: {
    place: 'left-[5px] w-0.5',
    length: { square: 'inset-y-3', round: 'inset-y-[30%]' },
    hidden: '-translate-x-1',
    background: dashes(180),
  },
  right: {
    place: 'right-[5px] w-0.5',
    length: { square: 'inset-y-3', round: 'inset-y-[30%]' },
    hidden: 'translate-x-1',
    background: dashes(180),
  },
};

/**
 * Zoomed in on a blank canvas, the frame looks the same wherever you are, so
 * a line marks each side where the canvas really ends. It fades in, nudging
 * in from just past the edge as if it bumped into it.
 */
const EdgeLines: FC<{ edges: Edges; round: boolean }> = ({ edges, round }) =>
  (Object.keys(SIDES) as Array<keyof Edges>).map((side) => {
    const { place, length, hidden, background } = SIDES[side];
    return (
      <span
        key={side}
        aria-hidden="true"
        className={cn(
          'absolute pointer-events-none transition-[opacity,translate] duration-300 ease-[var(--ease-spring)]',
          place,
          round ? length.round : length.square,
          edges[side] ? 'opacity-100' : cn('opacity-0', hidden),
        )}
        style={{ background }}
      />
    );
  });

/** The canvas in its sketchy frame: one finger draws, two pinch to zoom and pan */
const ZoomableCanvas: FC<Props> = ({
  variant = 'square',
  backgroundColor,
  size,
  canvasClassName,
  canvasProps,
  zoomRef,
  pinchAreaRef,
  overlay,
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
        {/* The frame zooms its first child, so the overlay goes in it with the canvas */}
        <div className="relative">
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
          {overlay}
        </div>
      </div>
      <EdgeLines edges={edges} round={variant === 'round'} />
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
