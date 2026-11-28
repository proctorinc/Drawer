import { useState } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import DrawingDesk from './components/DrawingDesk';
import type { FC } from 'react';
import type { DailyPrompt } from '@/api/Api';
import LoadingScreen from '@/components/LoadingScreen';
import { ClockIcon } from '@/components/icons';
import { CountDownTimer } from '@/daily/CountdownTimer';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { clearDraft, draftKey } from '@/daily/drafts';
import { useUnfinishedDoodle } from '@/daily/useUnfinishedDoodle';
import { DrawingProvider } from '@/drawing/DrawingContext';

const LateDesk: FC<{ prompt: DailyPrompt; onDone: () => void }> = ({
  prompt,
  onDone,
}) => {
  const { submitPrompt } = useDailyPrompt();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(png: Blob) {
    setError(null);
    submitPrompt(png, {
      day: prompt.day,
      onSuccess: (submission) => {
        // Pinned: the draft has nothing left to wait for
        clearDraft(prompt.day);
        onDone();
        navigate({
          to: '/draw/submission/$submissionId',
          params: { submissionId: submission.id },
          replace: true,
        });
      },
      onError: () => setError('Failed to submit drawing'),
    });
  }

  return (
    <DrawingDesk
      dailyPrompt={prompt}
      error={error}
      onSubmit={handleSubmit}
      pinning={null}
      past={{
        title: "yesterday's prompt",
        // It can be pinned until today's prompt rolls over too
        detail: (
          <>
            <ClockIcon size={13} />
            <CountDownTimer format="short" /> left to finish
          </>
        ),
        backTo: { to: '/draw' },
      }}
    />
  );
};

/**
 * Yesterday's doodle, picked up where the rollover left it, on the device it
 * was started on. Anyone with nothing to finish goes back to today.
 */
const FinishDoodlePage = () => {
  const { isLoading } = useDailyPrompt();
  const unfinished = useUnfinishedDoodle();
  // Once it's pinned the draft is gone; don't bounce to today on the way out
  const [done, setDone] = useState(false);

  if (isLoading) return <LoadingScreen />;
  if (done) return null;
  if (!unfinished) return <Navigate to="/draw" replace />;

  const key = draftKey(unfinished.day);
  return (
    <DrawingProvider key={key} localStorageKey={key}>
      <LateDesk prompt={unfinished} onDone={() => setDone(true)} />
    </DrawingProvider>
  );
};

export default FinishDoodlePage;
