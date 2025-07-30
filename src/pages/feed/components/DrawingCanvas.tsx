import { type FC, type HTMLAttributes } from 'react';
import { faCircleCheck, faDownload } from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/Button';
import Canvas from '@/drawing/Canvas';
import { useDrawing } from '@/drawing/DrawingContext';
import { Toolbar } from '@/drawing/Toolbar';
import { cn } from '@/utils';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import { Card } from '@/components/Card';

type Props = {
  colors?: Array<string>;
  variant?: 'round' | 'square';
  onSubmit?: (png: Blob) => void;
  downloadEnabled?: boolean;
  canvasProps?: HTMLAttributes<HTMLCanvasElement>;
  hidden?: boolean;
  backgroundColor?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'onSubmit'>;

const DrawingCanvas: FC<Props> = ({
  colors,
  variant = 'square',
  onSubmit,
  downloadEnabled = false,
  canvasProps,
  hidden,
  backgroundColor,
  ...props
}) => {
  const { isLoading } = useMyProfilePage();
  const { canvasRef, canUndo, getPng } = useDrawing();
  const { className: divClassName, ...divProps } = props;

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
    // if (!canvasRef.current) return;

    // const canvas = canvasRef.current;
    // const link = document.createElement('a');
    // link.download = `drawing-${new Date().toISOString().split('T')[0]}.png`;
    // link.href = canvas.toDataURL('image/png');
    // link.click();
  }

  if (hidden) {
    return <></>;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 items-center w-full max-w-md',
        isLoading ? 'invisible' : 'visible',
        divClassName,
      )}
      {...divProps}
    >
      <Card className={cn(variant === 'round' && 'rounded-full')}>
        <Canvas
          ref={canvasRef}
          style={{ backgroundColor: backgroundColor }}
          {...canvasProps}
        />
      </Card>
      <div className="flex flex-col items-center w-full gap-4">
        {colors && <Toolbar colors={colors} />}
        <div className="flex gap-2">
          <Button
            className="w-fit"
            onClick={handleSubmitCanvas}
            disabled={!canUndo}
            icon={faCircleCheck}
          >
            Submit
          </Button>
          {downloadEnabled && (
            <Button
              className="w-fit"
              onClick={handleDownloadCanvas}
              disabled={!canUndo}
              icon={faDownload}
            >
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrawingCanvas;
