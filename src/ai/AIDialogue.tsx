import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { CriterionChip, ScoreSticker } from './AIReviewComment';
import { GoldTrim, goldFrameClass, isMasterpiece } from './Masterpiece';
import type { FC, ReactNode } from 'react';
import type { AIReview, ActivityFeedResponse } from '@/api/Api';
import { apiClient } from '@/api/apiClient';
import { queryKeys, usePromptSubmission } from '@/api/Api';
import { cn } from '@/utils';

/** "A goalie" → "goalie", so it reads "your goalie" */
const withoutArticle = (prompt: string) =>
  prompt.toLowerCase().replace(/^(a|an|the)\s+/, '');

/** How long each letter takes to "say", and the breath after punctuation */
const LETTER_MS = 32;
const COMMA_MS = 140;
const STOP_MS = 320;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Types `text` out a letter at a time, pausing at punctuation like someone
 * talking. `finish` jumps to the end.
 */
const useTypewriter = (text: string) => {
  const [count, setCount] = useState(() =>
    prefersReducedMotion() ? text.length : 0,
  );

  useEffect(() => {
    if (count >= text.length) return;
    const last = text[count - 1] ?? '';
    const delay = /[.!?…]/.test(last)
      ? STOP_MS
      : /[,;:]/.test(last)
        ? COMMA_MS
        : LETTER_MS;
    const timer = setTimeout(() => setCount((n) => n + 1), delay);
    return () => clearTimeout(timer);
  }, [count, text]);

  const shown = text.slice(0, count);
  return {
    shown,
    done: count >= text.length,
    // Mouth stops between sentences, so the pauses read as breaths
    talking: count < text.length && !/[.,!?;:…]$/.test(shown),
    finish: () => setCount(text.length),
  };
};

/** The doodle being talked about */
export type DialogueDoodle = { prompt: string; imageUrl: string };

type DialogueProps = {
  review: AIReview;
  /** Blown up above the bubble, so you can see what they're on about */
  doodle?: DialogueDoodle;
  onClose: () => void;
};

/**
 * An AI judge saying its review out loud, RPG style: its face bobs along while
 * the words type out in a speech bubble, under your doodle blown up big. Tap to
 * skip ahead, tap again to close.
 */
export const AIDialogue: FC<DialogueProps> = ({ review, doodle, onClose }) => {
  const prompt = doodle?.prompt;
  const { judge } = review;
  const { shown, done, talking, finish } = useTypewriter(review.comment);
  const advance = () => (done ? onClose() : finish());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/70 cursor-pointer animate-in fade-in duration-200"
      onClick={advance}
    >
      {/* Your doodle, big, up top. On a short screen the bubble covers its bottom */}
      {doodle && (
        <div className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] flex justify-center pointer-events-none">
          {/* Tapping it takes you to the doodle's page */}
          <Link
            to="/draw/submission/$submissionId"
            params={{ submissionId: review.submissionId }}
            aria-label="See your doodle"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className={cn(
              'relative p-2 pb-6 -rotate-2 pointer-events-auto transition-[rotate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 hover:scale-[1.02] animate-in zoom-in-75 fade-in duration-500',
              isMasterpiece({ aiReview: review })
                ? goldFrameClass
                : 'bg-white border-2 border-ink',
            )}
          >
            {isMasterpiece({ aiReview: review }) && (
              <GoldTrim size="lg" label />
            )}
            <img
              src={doodle.imageUrl}
              alt={`Your doodle of ${withoutArticle(doodle.prompt)}`}
              className="block size-[min(80vw,24rem,62dvh)] object-contain bg-[#fff8ec] border-[1.5px] border-ink"
            />
          </Link>
        </div>
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${judge.name} judged your doodle`}
        className="relative z-10 w-full max-w-md px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-10 fade-in duration-300"
      >
        {/* The speaker: a face that moves while it talks, and a name plate */}
        <div className="flex items-end gap-3 pl-2">
          <span
            className={cn(
              'inline-flex origin-bottom',
              talking && 'animate-talk',
            )}
          >
            <AIJudgeAvatar judge={judge} size="xl" />
          </span>
          <div className="flex flex-col gap-0.5 mb-2 px-3 py-1.5 min-w-0 bg-white border-2 border-ink rounded-sketch-alt -rotate-1">
            <span className="flex items-center gap-1.5">
              <b className="font-accent font-bold text-2xl leading-none">
                {judge.name}
              </b>
            </span>
            {prompt && (
              <span className="text-sm text-pencil truncate">
                on your <i>{withoutArticle(prompt)}</i>
              </span>
            )}
          </div>
        </div>

        {/* The speech bubble, with a tail up to the speaker */}
        <div className="relative mt-3 bg-white border-2 border-ink rounded-sketch px-4 pt-4 pb-3">
          <span
            aria-hidden="true"
            className="absolute -top-[9px] left-10 size-4 rotate-45 bg-white border-l-2 border-t-2 border-ink"
          />
          <p className="sr-only" aria-live="polite">
            {done ? review.comment : ''}
          </p>
          {/* The full line sits invisibly underneath, so the bubble doesn't grow as it types */}
          <div aria-hidden="true" className="grid text-xl leading-snug">
            <span className="invisible [grid-area:1/1]">{review.comment}</span>
            <span className="[grid-area:1/1]">
              {shown}
              {!done && (
                <span className="inline-block w-2 ml-0.5 animate-pulse">▍</span>
              )}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3 mt-3 min-h-10">
            {done ? (
              <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                {review.criteria.map((criterion) => (
                  <CriterionChip key={criterion.id} criterion={criterion} />
                ))}
              </div>
            ) : (
              <span className="text-sm text-pencil">tap to skip</span>
            )}
            <div className="flex flex-col items-end gap-2 flex-none">
              {done && review.score !== null && (
                <ScoreSticker score={review.score} className="animate-pop" />
              )}
              {done && (
                <span
                  aria-hidden="true"
                  className="text-pencil text-sm leading-none animate-bounce"
                >
                  ▼
                </span>
              )}
            </div>
          </div>
        </div>

        {done && doodle && (
          <Link
            to="/draw/submission/$submissionId"
            params={{ submissionId: review.submissionId }}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="block mt-2 text-center text-white underline underline-offset-2 animate-in fade-in duration-300"
          >
            see your doodle
          </Link>
        )}
      </div>
    </div>
  );
};

// Each review speaks once on its own; after that it's in the bell and on the doodle
const SHOWN_KEY = 'ai-dialogue-shown';

const readShown = (): Array<string> => {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** Whether this doodle's review has already been said out loud on this device */
export const wasReviewShown = (submissionId: string) =>
  readShown().includes(submissionId);

const markShown = (submissionId: string) => {
  try {
    const shown = [
      submissionId,
      ...readShown().filter((id) => id !== submissionId),
    ];
    localStorage.setItem(SHOWN_KEY, JSON.stringify(shown.slice(0, 50)));
  } catch {
    // Private mode or blocked storage: it may speak again, which is fine
  }
};

type DialogueContext = {
  /** Wait for the judge to finish this just-drawn doodle, then have it speak */
  watchReview: (submissionId: string) => void;
  /** Have a finished review speak now */
  showReview: (review: AIReview, doodle?: DialogueDoodle) => void;
};

const AIDialogueContext = createContext<DialogueContext>({
  watchReview: () => {},
  showReview: () => {},
});

export const useAIDialogue = () => useContext(AIDialogueContext);

/** Polls a just-drawn doodle until its judge is done, then hands the review over */
const ReviewWatcher: FC<{
  submissionId: string;
  onDone: (review: AIReview | null, doodle?: DialogueDoodle) => void;
}> = ({ submissionId, onDone }) => {
  const { data } = usePromptSubmission(submissionId);

  useEffect(() => {
    if (!data) return;
    const review = data.aiReview;
    if (review?.status === 'pending') return; // Still squinting; it polls
    // Done, or never coming (judging off, or it failed and was hidden)
    onDone(review?.status === 'done' ? review : null, {
      prompt: data.prompt,
      imageUrl: data.imageUrl,
    });
  }, [data, onDone]);

  return null;
};

/**
 * Lets an AI judge pop up and say its review the moment it's written, and lets
 * the activity bell replay one.
 */
export const AIDialogueProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [watching, setWatching] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<{
    review: AIReview;
    doodle?: DialogueDoodle;
  } | null>(null);

  const [context] = useState<DialogueContext>(() => ({
    watchReview: (submissionId) => setWatching(submissionId),
    showReview: (review, doodle) => {
      markShown(review.submissionId);
      setDialogue({ review, doodle });
      // Heard it: its bell row reads as read here now, and on your other devices too
      queryClient.setQueryData<ActivityFeedResponse>(
        queryKeys.activityFeed,
        (feed) =>
          feed && {
            ...feed,
            activities: feed.activities.map((activity) =>
              activity.aiReview?.submissionId === review.submissionId
                ? { ...activity, isRead: true }
                : activity,
            ),
          },
      );
      apiClient.markAIReviewHeard(review.submissionId).catch(() => {
        // This device still remembers it; worst case another device plays it once
      });
    },
  }));

  const [onWatchedDone] = useState(
    () => (review: AIReview | null, doodle?: DialogueDoodle) => {
      setWatching(null);
      if (!review) return;
      // The bell and the feed pick up the new comment straight away
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed });
      queryClient.invalidateQueries({ queryKey: queryKeys.daily });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      if (wasReviewShown(review.submissionId)) return;
      context.showReview(review, doodle);
    },
  );

  return (
    <AIDialogueContext.Provider value={context}>
      {children}
      {watching && (
        <ReviewWatcher
          key={watching}
          submissionId={watching}
          onDone={onWatchedDone}
        />
      )}
      {dialogue && (
        <AIDialogue
          key={dialogue.review.submissionId}
          review={dialogue.review}
          doodle={dialogue.doodle}
          onClose={() => setDialogue(null)}
        />
      )}
    </AIDialogueContext.Provider>
  );
};
