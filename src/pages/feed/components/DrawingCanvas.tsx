import { faDownload } from '@fortawesome/free-solid-svg-icons';
import type { FC, HTMLAttributes, ReactNode } from 'react';
import Button from '@/components/Button';
import Canvas from '@/drawing/Canvas';
import { useDrawing } from '@/drawing/DrawingContext';
import { Toolbar } from '@/drawing/Toolbar';
import { cn, tapeColor } from '@/utils';
import { PinIcon } from '@/components/icons';
import { candyCaneTape } from '@/events/christmas/Decorations';

type Props = {
  colors?: Array<string>;
  variant?: 'round' | 'square';
  onSubmit?: (png: Blob) => void;
  submitLabel?: ReactNode;
  downloadEnabled?: boolean;
  canvasProps?: HTMLAttributes<HTMLCanvasElement>;
  backgroundColor?: string;
  /** Shrink the canvas to fit the height this component is given */
  fit?: boolean;
  /** Christmas event: candy-cane tape instead of colored tape */
  festive?: boolean;
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
  festive = false,
  ...props
}) => {
  const { hasInk, getPng } = useDrawing();
  const { className: divClassName, ...divProps } = props;
  const tapes = colors?.length ? colors : ['#ff6b57', '#3a7bd5'];
  const tapeStyle = (i: number) =>
    festive
      ? {
          background: candyCaneTape(
            i === 0 ? 'var(--color-xmas-red)' : 'var(--color-xmas-green)',
          ),
        }
      : { backgroundColor: tapeColor(tapes[i] ?? tapes[0]) };

  async function handleSubmitCanvas() {
    const blob = await getPng(backgroundColor);
    onSubmit?.(blob);
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
        {/* The canvas itself stays square to the screen so strokes land where the finger is */}
        <div className="relative animate-drop">
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
              )}
              {...canvasProps}
            />
          </div>
          {variant === 'square' && (
            <>
              <span
                aria-hidden="true"
                className="absolute -top-2.5 -left-3.5 w-[84px] h-[26px] -rotate-[32deg] animate-in fade-in zoom-in-150 duration-300 delay-500 fill-mode-both"
                style={tapeStyle(0)}
              />
              <span
                aria-hidden="true"
                className="absolute -bottom-2 -right-3.5 w-[84px] h-[26px] -rotate-[28deg] animate-in fade-in zoom-in-150 duration-300 delay-700 fill-mode-both"
                style={tapeStyle(1)}
              />
            </>
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
