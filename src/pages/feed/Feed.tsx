import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import { PastPages, TodayWall } from './components/DayPages';
import { SuggestionCards } from './components/SuggestionCards';
import DrawingCanvas from './components/DrawingCanvas';
import { PromptCredit, PromptTitle } from './components/PromptTitle';
import type { DailyPrompt } from '@/api/Api';
import { JudgeIntroReplayButton } from '@/ai/JudgeIntro';
import Layout from '@/components/Layout';
import { cn } from '@/utils';
import LoadingScreen from '@/components/LoadingScreen';
import { useDrawing } from '@/drawing/DrawingContext';
import { ClockIcon, SendIcon, TrophyIcon } from '@/components/icons';
import { useSubmitPromptSuggestion } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { ChristmasIntroOnce } from '@/events/christmas/ChristmasIntro';
import { TreeIcon } from '@/events/christmas/Decorations';
import ComingSoonCard from '@/events/ComingSoonCard';
import OrnamentTally from '@/events/christmas/OrnamentTally';
import Snowfall from '@/events/christmas/Snowfall';
import { useChristmas } from '@/events/useChristmas';
import { PushPin } from '@/components/PushPin';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import {
  JUDGE_STRIP_HEIGHT,
  TodaysJudgeChip,
  useTodaysJudge,
} from '@/ai/TodaysJudge';

/** When tomorrow's prompt drops; fixed-width digits so it never jiggles */
const NextPromptCountdown = () => (
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

const PromptHeading = ({ dailyPrompt }: { dailyPrompt: DailyPrompt }) => (
  <section className="flex flex-col gap-1 min-w-0">
    <span className="flex items-center gap-1 text-sm text-pencil">
      <ClockIcon size={13} />
      <CountDownTimer format="short" /> left
    </span>
    <PromptTitle prompt={dailyPrompt.prompt} colors={dailyPrompt.colors} />
    <div className="flex items-center justify-between gap-3 mt-2 min-w-0">
      {dailyPrompt.createdBy ? (
        <PromptCredit user={dailyPrompt.createdBy} />
      ) : (
        <span />
      )}
      <JudgeIntroReplayButton />
    </div>
  </section>
);

/** Your own corners of the app; everyone else's drawings wait until you've drawn */
const DeskLinks = () => {
  const user = useUser();

  return (
    <nav aria-label="Main" className="flex flex-none items-center gap-2">
      <Link
        to="/draw/trophies"
        aria-label="Trophies"
        className="press flex items-center justify-center size-10 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm hover:-rotate-6"
      >
        <TrophyIcon size={22} />
      </Link>
      <UserProfileIcon user={user} size="sm" />
    </nav>
  );
};

/** A drawing on its way to the wall, from where its canvas sat */
export type Pinning = { imageUrl: string; from: DOMRect };

type DrawingDeskProps = {
  dailyPrompt: DailyPrompt;
  error: string | null;
  onSubmit: (png: Blob, canvas: HTMLCanvasElement | null) => void;
  /** Set while the drawing is being pinned: the tools fade while it animates */
  pinning: Pinning | null;
};

/** Nothing but the prompt and the canvas, sized to fit any screen */
const DrawingDesk = ({
  dailyPrompt,
  error,
  onSubmit,
  pinning,
}: DrawingDeskProps) => {
  const christmas = useChristmas();
  const { data: judge } = useTodaysJudge();

  return (
    <div className="paper flex justify-center h-dvh overflow-hidden">
      {christmas && <Snowfall />}
      <main
        className={cn(
          'relative flex flex-col gap-4 w-full max-w-md px-5 pt-[max(14px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] animate-rise transition-opacity duration-300',
          // The polaroid takes over from the canvas, so everything here fades
          pinning && 'opacity-0 pointer-events-none',
        )}
      >
        <header className="flex items-start justify-between gap-3">
          <PromptHeading dailyPrompt={dailyPrompt} />
          <DeskLinks />
        </header>
        {christmas?.countdownDays && <OrnamentTally event={christmas} />}
        <DrawingCanvas
          fit
          className="flex-1 min-h-0"
          backgroundColor={
            dailyPrompt.colors.length === 4 ? dailyPrompt.colors[3] : undefined
          }
          onSubmit={onSubmit}
          belowCanvas={judge && <TodaysJudgeChip />}
          belowCanvasHeight={
            judge?.criteria.length ? JUDGE_STRIP_HEIGHT : undefined
          }
          colors={dailyPrompt.colors.slice(0, 3)}
          submitLabel={
            christmas ? (
              <>
                hang it on the tree
                <TreeIcon />
              </>
            ) : undefined
          }
        />
        {error && <p className="text-center text-coral">{error}</p>}
      </main>
      <ChristmasIntroOnce />
    </div>
  );
};

const SuggestPrompt = () => {
  const promptSuggestionMutation = useSubmitPromptSuggestion();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <form
      className="relative flex flex-col gap-2 w-full px-4 pt-5 pb-4 bg-[#fff6c9] rotate-1 shadow-[1px_2px_6px_rgba(43,42,51,0.15)]"
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
  useEffect(() => {
    if (!isFinished) return;
    if (pinning) URL.revokeObjectURL(pinning.imageUrl);
    setPinning(null);
    setIsUploaded(false);
    setIsPinned(false);
    clearCanvas();
    window.scrollTo({ top: 0 });
  }, [isFinished, pinning, clearCanvas]);

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
      <NextPromptCountdown />
      <ComingSoonCard />
      <TodayWall />
      <SuggestionCards />
      <SuggestPrompt />
      <PastPages />
    </Layout>
  );
};

export default Feed;
