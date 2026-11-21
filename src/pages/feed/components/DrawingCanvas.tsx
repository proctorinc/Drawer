import { faDownload } from '@fortawesome/free-solid-svg-icons';
import type { CSSProperties, FC, HTMLAttributes, ReactNode } from 'react';
import Button from '@/components/Button';
import Canvas from '@/drawing/Canvas';
import { useDrawing } from '@/drawing/DrawingContext';
import { Toolbar } from '@/drawing/Toolbar';
import { cn } from '@/utils';
import { PinIcon } from '@/components/icons';

type Props = {
  colors?: Array<string>;
  variant?: 'round' | 'square';
  /** Gets the drawing, and the canvas it came from so callers can animate it */
  onSubmit?: (png: Blob, canvas: HTMLCanvasElement | null) => void;
  submitLabel?: ReactNode;
  downloadEnabled?: boolean;
  canvasProps?: HTMLAttributes<HTMLCanvasElement>;
  backgroundColor?: string;
  /** Shrink the canvas to fit the height this component is given */
  fit?: boolean;
  /** A note tucked right under the canvas, e.g. who's judging today */
  belowCanvas?: ReactNode;
  /** How tall that note is (a CSS length), so a fitted canvas leaves room for it */
  belowCanvasHeight?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onSubmit'>;

const DrawingCanvas: FC<Props> = ({
  colors,
  variant = 'square',
  onSubmit,
  submitLabel = (
    <>
      pin it to the wall
      <PinIcon size={22} />
    </>
  ),
  downloadEnabled = false,
  canvasProps,
  backgroundColor,
  fit = false,
  belowCanvas,
  belowCanvasHeight = '1.5rem',
  ...props
}) => {
  const { canvasRef, hasInk, getPng } = useDrawing();
  const { className: divClassName, ...divProps } = props;

  async function handleSubmitCanvas() {
    const blob = await getPng(backgroundColor);
    onSubmit?.(blob, canvasRef.current);
  }

  async function handleDownloadCanvas() {
    const png = await getPng(backgroundColor);
    // For other browsers:
    // Create a link pointing to the ObjectURL containing the blob.
    const data = window.URL.createObjectURL(png);

    const link = document.createElement('a');
    link.href = data;
    link.download = `drawing-${new Date().toISOString().split('T')[0]}.png`;

    // this is necessary as link.click() does not work on the latest firefox
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );

    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      window.URL.revokeObjectURL(data);
      link.remove();
    }, 100);
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-5 items-center w-full max-w-md',
        divClassName,
      )}
      {...divProps}
    >
      {/* A size container lets the canvas cap itself at the space left over */}
      <div
        className={cn(
          'flex justify-center w-full',
          fit && 'flex-1 min-h-0 items-center [container-type:size]',
        )}
      >
        {/* Not pinned yet: the button pins it. Square to the screen so strokes land where the finger is */}
        <div
          className="relative flex flex-col animate-drop"
          style={{ '--below-canvas': belowCanvasHeight } as CSSProperties}
        >
          <div
            className={cn(
              'overflow-hidden bg-white border-2 border-ink shadow-pencil',
              variant === 'round'
                ? 'rounded-full'
                : 'rounded-[6px_14px_8px_12px/12px_6px_14px_8px]',
            )}
          >
            <Canvas
              style={{ backgroundColor: backgroundColor }}
              className={cn(
                fit &&
                  'max-w-[min(calc(100cqw-4px),var(--canvas-w))] max-h-[min(calc(100cqh-4px),var(--canvas-h))]',
                // Leave room for the note (its height + mt-2.5) under the canvas
                fit &&
                  belowCanvas &&
                  'max-h-[min(calc(100cqh-4px-var(--below-canvas)-0.625rem),var(--canvas-h))]',
              )}
              {...canvasProps}
            />
          </div>
          {belowCanvas && (
            <div className="flex items-center justify-center h-(--below-canvas) mt-2.5 text-sm text-pencil">
              {belowCanvas}
            </div>
          )}
        </div>
      </div>
      {colors && <Toolbar colors={colors} />}
      <div className="flex gap-2 w-full">
        <Button
          className="flex-1"
          onClick={handleSubmitCanvas}
          disabled={!hasInk}
        >
          {submitLabel}
        </Button>
        {downloadEnabled && (
          <Button
            variant="base"
            onClick={handleDownloadCanvas}
            disabled={!hasInk}
            icon={faDownload}
            aria-label="Download"
          />
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;
