import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import { PastPages, TodayWall } from './components/DayPages';
import { FriendsToday } from './components/FriendsToday';
import DrawingCanvas from './components/DrawingCanvas';
import { PromptTitle } from './components/PromptTitle';
import type { DailyPrompt } from '@/api/Api';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { useDrawing } from '@/drawing/DrawingContext';
import { ClockIcon, SendIcon, TrophyIcon } from '@/components/icons';
import { useSubmitPromptSuggestion } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { TreeIcon } from '@/events/christmas/Decorations';
import OrnamentTally from '@/events/christmas/OrnamentTally';
import Snowfall from '@/events/christmas/Snowfall';
import { useChristmas } from '@/events/useChristmas';

const NextPageCountdown = () => (
  <span className="flex items-center gap-1.5">
    <ClockIcon size={14} />
    new page in <CountDownTimer />
  </span>
);

const PromptHeading = ({ dailyPrompt }: { dailyPrompt: DailyPrompt }) => (
  <section className="flex flex-col gap-1 min-w-0">
    <span className="flex flex-wrap items-center gap-x-2 text-sm text-pencil">
      <span className="flex items-center gap-1">
        <ClockIcon size={13} />
        <CountDownTimer format="short" /> left
      </span>
      {dailyPrompt.createdBy && (
        <span>prompt by {dailyPrompt.createdBy.username}</span>
      )}
    </span>
    <PromptTitle prompt={dailyPrompt.prompt} colors={dailyPrompt.colors} />
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

type DrawingDeskProps = {
  dailyPrompt: DailyPrompt;
  error: string | null;
  onSubmit: (png: Blob) => void;
};

/** Nothing but the prompt and the canvas, sized to fit any screen */
const DrawingDesk = ({ dailyPrompt, error, onSubmit }: DrawingDeskProps) => {
  const christmas = useChristmas();

  return (
    <div className="paper flex justify-center h-dvh overflow-hidden">
      {christmas && <Snowfall />}
      <main className="relative flex flex-col gap-4 w-full max-w-md px-5 pt-[max(14px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] animate-rise">
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
          colors={dailyPrompt.colors.slice(0, 3)}
          festive={!!christmas}
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
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-1/2 -ml-8 w-16 h-5 bg-blush/90 -rotate-2"
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
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(png: Blob) {
    submitPrompt(png, {
      onSuccess: () => {
        setError(null);
        clearCanvas();
        // Land at the top so the new polaroid drops in view
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: () => {
        setError('Failed to submit drawing');
      },
    });
  }

  if (isLoading) return <LoadingScreen />;

  if (dailyPrompt && !dailyPrompt.isCompleted) {
    return (
      <DrawingDesk
        dailyPrompt={dailyPrompt}
        error={error}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <Layout aside={<NextPageCountdown />}>
      {dailyPrompt && <FriendsToday />}
      <TodayWall />
      <SuggestPrompt />
      <PastPages />
    </Layout>
  );
};

export default Feed;
