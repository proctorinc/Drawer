import { faCircleCheck, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import Button from '@/components/Button';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import Canvas from '@/drawing/Canvas';
import { useDrawing } from '@/drawing/DrawingContext';
import { Toolbar } from '@/drawing/Toolbar';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { cn } from '@/utils';
import Banner from '@/components/Banner';

const PromptCanvas = () => {
  const { userProfile } = useProfile();
  const { dailyPrompt, submitPrompt } = useDailyPrompt();
  const { canvasRef, canUndo, clearCanvas, getCanvasData } = useDrawing();
  const [error, setError] = useState('');

  const isLoading = !userProfile || !dailyPrompt;

  function handleSubmitCanvas() {
    const canvasData = getCanvasData();
    submitPrompt(canvasData, clearCanvas).catch(() =>
      setError('Failed to submit drawing'),
    );
  }

  if (dailyPrompt?.isCompleted === true) {
    return <></>;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 items-center w-full max-w-md',
        isLoading ? 'invisible' : 'visible',
      )}
    >
      <Canvas ref={canvasRef} />
      <div className="flex flex-col items-center w-full gap-4">
        <Banner icon={faInfoCircle}>
          Use today's colors to draw the prompt
        </Banner>
        <Toolbar />
        {error && <p className="text-center text-red-500">{error}</p>}
        <Button
          className="w-fit"
          onClick={handleSubmitCanvas}
          disabled={!canUndo}
          icon={faCircleCheck}
        >
          Submit
        </Button>
      </div>
    </div>
  );
};

export default PromptCanvas;
