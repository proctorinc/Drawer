import { faCircleCheck, faDownload } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import Button from '@/components/Button';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import Canvas from '@/drawing/Canvas';
import { useDrawing } from '@/drawing/DrawingContext';
import { Toolbar } from '@/drawing/Toolbar';
import { cn } from '@/utils';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import ConfirmSubmitModal from '@/drawing/components/ConfirmSubmitModal';

const PromptCanvas = () => {
  const { profile } = useMyProfilePage();
  const { dailyPrompt, submitPrompt } = useDailyPrompt();
  const { canvasRef, canUndo, clearCanvas, getCanvasData } = useDrawing();
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const downloadEnabled = false;

  const isLoading = !profile || !dailyPrompt;

  function handleConfirmSubmit() {
    setIsOpen(true);
  }

  function handleSubmitCanvas() {
    const canvasData = getCanvasData();
    submitPrompt(canvasData, clearCanvas).catch(() =>
      setError('Failed to submit drawing'),
    );
  }

  function handleDownloadCanvas() {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `drawing-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (dailyPrompt?.isCompleted === true) {
    return <></>;
  }

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-4 items-center w-full max-w-md',
          isLoading ? 'invisible' : 'visible',
        )}
      >
        <Canvas ref={canvasRef} />
        <div className="flex flex-col items-center w-full gap-4">
          <Toolbar />
          {error && <p className="text-center text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button
              className="w-fit"
              onClick={handleConfirmSubmit}
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

      <ConfirmSubmitModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmitCanvas}
      />
    </>
  );
};

export default PromptCanvas;
