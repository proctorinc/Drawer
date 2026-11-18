import { useState } from 'react';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import { SubmissionFeedList } from './components/SubmissionFeedList';
import DrawingCanvas from './components/DrawingCanvas';
import type { CSSProperties } from 'react';
import type { DailyPrompt } from '@/api/Api';
import Layout from '@/components/Layout';
import Disclaimer, { DisclaimerItem } from '@/components/Disclaimer';
import { useDrawing } from '@/drawing/DrawingContext';
import Chip from '@/components/Chip';
import { ClockIcon, SendIcon } from '@/components/icons';
import { useSubmitPromptSuggestion } from '@/api/Api';
import { tapeColor } from '@/utils';

const NextPageCountdown = () => (
  <span className="flex items-center gap-1.5">
    <ClockIcon size={14} />
    new page in <CountDownTimer />
  </span>
);

const PromptHeading = ({ dailyPrompt }: { dailyPrompt: DailyPrompt }) => (
  <section className="flex flex-col gap-1.5 w-full stagger">
    <span className="text-lg text-pencil">today, draw…</span>
    <h1 className="font-accent font-bold text-[38px] leading-[0.95] text-balance">
      <span
        className="highlight"
        style={
          {
            '--hl': tapeColor(dailyPrompt.colors[2] ?? '#ffd45a'),
          } as CSSProperties
        }
      >
        {dailyPrompt.prompt.toLowerCase()}
      </span>
    </h1>
    <div className="flex flex-wrap gap-2 pt-1">
      <Chip>
        <ClockIcon size={14} />
        <span>
          <CountDownTimer format="short" /> left
        </span>
      </Chip>
      {dailyPrompt.createdBy && (
        <Chip className="bg-sky">
          prompt by {dailyPrompt.createdBy.username}
        </Chip>
      )}
    </div>
  </section>
);

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
          .then(() => setSent(true))
          .catch((err) => setError(err.message));
        setPrompt('');
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
          disabled={prompt.length === 0}
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

  const isDrawing = !!dailyPrompt && !dailyPrompt.isCompleted;

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

  return (
    <Layout aside={isDrawing ? undefined : <NextPageCountdown />}>
      {isDrawing && <PromptHeading dailyPrompt={dailyPrompt} />}
      <DrawingCanvas
        isLoading={isLoading}
        backgroundColor={
          dailyPrompt?.colors.length === 4 ? dailyPrompt.colors[3] : undefined
        }
        onSubmit={(png) => handleSubmit(png)}
        colors={dailyPrompt?.colors ? dailyPrompt.colors.slice(0, 3) : []}
        hidden={!isDrawing}
      />
      {error && <p className="text-center text-coral">{error}</p>}
      {isDrawing && (
        <Disclaimer title="Rules, you say?">
          <DisclaimerItem>
            Just kidding - no rules, but here's a tip
          </DisclaimerItem>
          <DisclaimerItem>
            Don't write text, just draw and let people guess!
          </DisclaimerItem>
        </Disclaimer>
      )}
      {!isDrawing && !isLoading && (
        <SubmissionFeedList afterToday={<SuggestPrompt />} />
      )}
    </Layout>
  );
};

export default Feed;
