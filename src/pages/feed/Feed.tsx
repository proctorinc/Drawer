import { useEffect, useState } from 'react';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import { PastPages, TodayWall } from './components/DayPages';
import { SuggestionCards } from './components/SuggestionCards';
import DrawingDesk from './components/DrawingDesk';
import type { Pinning } from './components/DrawingDesk';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { useDrawing } from '@/drawing/DrawingContext';
import { ClockIcon, SendIcon } from '@/components/icons';
import { useSubmitPromptSuggestion } from '@/api/Api';
import EventPreviewRow from '@/events/EventPreviewRow';
import { PushPin } from '@/components/PushPin';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import { UnfinishedDoodleButton } from '@/daily/UnfinishedDoodleButton';
import { RedoButton } from '@/daily/RedoButton';
import { clearStickerDraft } from '@/daily/drafts';

/** When tomorrow's prompt drops; fixed-width digits so it never jiggles */
const NextPromptCountdown = ({ compact = false }: { compact?: boolean }) =>
  compact ? (
    // A quarter of the row beside an event preview: too narrow for 08:12:44,
    // so hours, minutes and seconds stack, scaled to the card's width (the
    // row makes this column a size container)
    <section
      aria-label="Next prompt"
      className="flex flex-col items-center justify-center gap-1 w-full px-1.5 py-2 bg-white border-2 border-ink rounded-sketch text-center"
    >
      <span className="flex items-center gap-1 text-xs leading-tight text-pencil">
        <ClockIcon size={12} />
        next
      </span>
      <CountDownTimer
        format="stack"
        className="font-accent font-bold text-[clamp(18px,28cqw,26px)] leading-[1.05]"
      />
    </section>
  ) : (
    <section
      aria-label="Next prompt"
      className="flex flex-col items-center gap-1 self-center px-6 pt-2.5 pb-3 bg-white border-2 border-ink rounded-sketch"
    >
      <span className="flex items-center gap-1.5 text-sm text-pencil">
        <ClockIcon size={14} />
        next prompt in
      </span>
      <CountDownTimer
        monospace
        className="font-accent font-bold text-[32px] leading-none"
      />
    </section>
  );

const SuggestPrompt = () => {
  const promptSuggestionMutation = useSubmitPromptSuggestion();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <form
      className="relative flex flex-col gap-2 w-full px-4 pt-5 pb-4 bg-[#fff6c9] rotate-1 border-2 border-ink"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        promptSuggestionMutation
          .mutateAsync(prompt)
          .then(() => {
            setSent(true);
            setPrompt('');
          })
          .catch((err) => setError(err.message));
      }}
    >
      <PushPin
        color={'#ff6b57'}
        lean={-14}
        className="absolute z-10 -top-[23px] left-1/2 -ml-4"
      />
      <label
        htmlFor="prompt-suggestion"
        className="font-accent font-bold text-xl leading-tight"
      >
        {sent ? 'got it, thanks!' : 'got an idea for a prompt?'}
      </label>
      <div className="flex gap-2">
        <input
          id="prompt-suggestion"
          type="text"
          placeholder="a cat doing taxes…"
          className="w-full h-11 px-3 bg-white border-2 border-ink rounded-sketch-alt text-lg placeholder:text-pencil/70 focus:outline-none focus:-rotate-1 transition-[rotate] duration-300"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSent(false);
          }}
          required
        />
        <button
          type="submit"
          aria-label="Send suggestion"
          disabled={prompt.length === 0 || promptSuggestionMutation.isPending}
          className="press flex flex-none items-center justify-center size-11 bg-ink text-paper border-2 border-ink rounded-sketch shadow-pencil-sm cursor-pointer disabled:cursor-default disabled:bg-transparent disabled:text-pencil disabled:border-dashed disabled:border-line disabled:shadow-none"
        >
          <SendIcon size={20} />
        </button>
      </div>
      {error && <p className="text-coral">{error}</p>}
      <p className="text-sm text-pencil">get credit if it gets picked!</p>
    </form>
  );
};

const Feed = () => {
  const { dailyPrompt, submitPrompt, isLoading } = useDailyPrompt();
  const { clearCanvas } = useDrawing();
  const { enqueue, dismiss } = useAnimationQueue();
  const [error, setError] = useState<string | null>(null);
  // The pinning animation and the upload run side by side; the wall shows
  // once both are done
  const [pinning, setPinning] = useState<Pinning | null>(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  function handleSubmit(png: Blob, canvas: HTMLCanvasElement | null) {
    setError(null);
    setIsUploaded(false);
    setIsPinned(false);
    let pinId: string | null = null;
    if (canvas) {
      const imageUrl = URL.createObjectURL(png);
      const from = canvas.getBoundingClientRect();
      pinId = `pin:${imageUrl}`;
      setPinning({ imageUrl, from });
      // The ceremony plays on the animation stage, so nothing talks over it.
      // Nothing else is usually queued at submit, so it starts straight away
      enqueue({
        id: pinId,
        kind: 'pin',
        payload: {
          imageUrl,
          from: {
            x: from.left,
            y: from.top,
            width: from.width,
            height: from.height,
          },
        },
      }).then((outcome) => {
        if (outcome !== 'dismissed') setIsPinned(true);
      });
    }
    submitPrompt(png, {
      // The prompt on the desk: if it rolled over mid-pin, this still files
      // the drawing under the prompt it was drawn for
      day: dailyPrompt?.day,
      onSuccess: () => setIsUploaded(true),
      onError: () => {
        if (pinId) dismiss(pinId);
        setPinning(null);
        setError('Failed to submit drawing');
      },
    });
  }

  // Both finished: tidy up and show the wall, where the new polaroid drops in
  const isFinished = isUploaded && (isPinned || !pinning);
  const day = dailyPrompt?.day;
  useEffect(() => {
    if (!isFinished) return;
    if (pinning) URL.revokeObjectURL(pinning.imageUrl);
    setPinning(null);
    setIsUploaded(false);
    setIsPinned(false);
    clearCanvas();
    if (day) clearStickerDraft(day);
    window.scrollTo({ top: 0 });
  }, [isFinished, pinning, clearCanvas, day]);

  if (isLoading) return <LoadingScreen />;

  if (dailyPrompt && (pinning || !dailyPrompt.isCompleted)) {
    return (
      <DrawingDesk
        dailyPrompt={dailyPrompt}
        error={error}
        onSubmit={handleSubmit}
        pinning={pinning}
      />
    );
  }

  return (
    <Layout>
      <UnfinishedDoodleButton className="self-center" />
      <RedoButton className="self-center" />
      <EventPreviewRow
        aside={(compact) => <NextPromptCountdown compact={compact} />}
      />
      <TodayWall />
      <SuggestionCards />
      <SuggestPrompt />
      <PastPages />
    </Layout>
  );
};

export default Feed;
