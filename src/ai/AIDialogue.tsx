import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { CommentLines, spokenText } from './CommentLines';
import { CriterionChip, ScoreSticker, judgeFace } from './AIReviewComment';
import { GoldTrim, goldFrameClass, isMasterpiece } from './Masterpiece';
import { speakerTurns } from './speakers';
import type { FC, ReactNode } from 'react';
import type { AIReview, ActivityFeedResponse } from '@/api/Api';
import { apiClient } from '@/api/apiClient';
import { queryKeys, usePromptSubmission } from '@/api/Api';
import { cn } from '@/utils';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import { speak, syllablesOf, voiceFor } from '@/sound/voices';

/** "A goalie" → "goalie", so it reads "your goalie" */
export const withoutArticle = (prompt: string) =>
  prompt.toLowerCase().replace(/^(a|an|the)\s+/, '');

/** How long each letter takes to "say", and the breath after punctuation */
const LETTER_MS = 32;
const COMMA_MS = 140;
const STOP_MS = 320;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where the sentence around letter `at` starts and ends, and how it ends */
const sentenceAround = (text: string, at: number) => {
  let start = at;
  while (start > 0 && !/[.!?…]/.test(text[start - 1])) start--;
  let end = at;
  while (end < text.length - 1 && !/[.!?…]/.test(text[end])) end++;
  const ending = text[end] === '?' ? '?' : text[end] === '!' ? '!' : '.';
  return { progress: (at - start) / Math.max(1, end - start), ending } as const;
};

/**
 * Types `text` out a letter at a time, pausing at punctuation like someone
 * talking. `finish` jumps to the end. A new `text` starts typing afresh.
 * Given a `speaker` name, the letters mumble along in that speaker's own
 * voice, at that speaker's own pace.
 */
export const useTypewriter = (text: string, speaker?: string) => {
  const voice = useMemo(() => (speaker ? voiceFor(speaker) : null), [speaker]);
  const pace = voice?.pace ?? 1;
  const startAt = (line: string) => (prefersReducedMotion() ? line.length : 0);
  const [count, setCount] = useState(() => startAt(text));
  const [typing, setTyping] = useState(text);
  if (typing !== text) {
    setTyping(text);
    setCount(startAt(text));
  }

  // Each syllable says itself as its first letter appears, held about as
  // long as its letters take to type
  const syllables = useMemo(() => syllablesOf(text), [text]);
  useEffect(() => {
    if (!voice || count === 0 || count > text.length) return;
    const syllable = syllables.get(count - 1);
    if (!syllable) return;
    speak(voice, {
      ...syllable,
      seconds: (syllable.letters * LETTER_MS * pace) / 1000,
      ...sentenceAround(text, count - 1),
    });
  }, [count, text, voice, syllables, pace]);

  useEffect(() => {
    if (count >= text.length) return;
    const last = text[count - 1] ?? '';
    const delay = /[.!?…]/.test(last)
      ? STOP_MS
      : /[,;:]/.test(last)
        ? COMMA_MS
        : LETTER_MS;
    const timer = setTimeout(() => setCount((n) => n + 1), delay * pace);
    return () => clearTimeout(timer);
  }, [count, text, pace]);

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
  const turns = useMemo(() => speakerTurns(review.comment), [review.comment]);
  const { shown, done, talking, finish } = useTypewriter(
    spokenText(turns),
    judge.name,
  );
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
            <span className="invisible [grid-area:1/1]">
              <CommentLines turns={turns} />
            </span>
            <span className="[grid-area:1/1]">
              <CommentLines
                turns={turns}
                typed={shown.length}
                after={
                  !done && (
                    <span className="inline-block w-2 ml-0.5 animate-pulse">
                      ▍
                    </span>
                  )
                }
              />
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
                <ScoreSticker
                  score={review.score}
                  mine
                  face={judgeFace(review.judge)}
                  className="animate-pop"
                />
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
  /**
   * Wait for the judge to finish this just-drawn doodle, then have it speak.
   * Its turn on the stage is held from now, so whatever's queued after it
   * (say, the XP it earned) waits until it's had its say.
   */
  watchReview: (submissionId: string) => void;
  /** Have a finished review speak, as soon as the stage is free */
  showReview: (review: AIReview, doodle?: DialogueDoodle) => void;
};

const AIDialogueContext = createContext<DialogueContext>({
  watchReview: () => {},
  showReview: () => {},
});

export const useAIDialogue = () => useContext(AIDialogueContext);

/** Reviews handed to the stage, by submission id, for ReviewStage to say */
export const stagedReviews = new Map<
  string,
  { review: AIReview; doodle?: DialogueDoodle }
>();

/**
 * How long a just-drawn doodle's review holds the stage. The server gives the
 * judge 90 seconds before failing it; this leaves room for the poll after.
 */
export const REVIEW_WAIT_MS = 100_000;

/** The stage item id for a doodle's review, so the same one never queues twice */
export const reviewStageId = (submissionId: string) => `review:${submissionId}`;

/** Polls a just-drawn doodle until its judge is done, then hands the review over */
const ReviewWatcher: FC<{
  submissionId: string;
  onDone: (
    submissionId: string,
    review: AIReview | null,
    doodle?: DialogueDoodle,
  ) => void;
}> = ({ submissionId, onDone }) => {
  const { data } = usePromptSubmission(submissionId);

  useEffect(() => {
    if (!data) return;
    const review = data.aiReview;
    if (review?.status === 'pending') return; // Still squinting; it polls
    // Done, or never coming (judging off, or it failed and was hidden)
    onDone(submissionId, review?.status === 'done' ? review : null, {
      prompt: data.prompt,
      imageUrl: data.imageUrl,
    });
  }, [data, onDone, submissionId]);

  return null;
};

/** A watched review's held turn on the stage */
type HeldTurn = {
  resolve: () => void;
  reject: () => void;
  /** The stage gave up waiting, so when it does come it queues afresh */
  gaveUp: boolean;
};

/**
 * Lets an AI judge pop up and say its review the moment it's written, and lets
 * the activity bell replay one. Each goes through the animation queue's stage,
 * so a judge never talks over another celebration.
 */
export const AIDialogueProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const { enqueue } = useAnimationQueue();
  const [watching, setWatching] = useState<Array<string>>([]);

  const [{ context, onWatchedDone }] = useState(() => {
    const held = new Map<string, HeldTurn>();

    // Heard it: hand it to the stage, and its bell row reads as read here now,
    // and on your other devices too
    const stage = (review: AIReview, doodle?: DialogueDoodle) => {
      markShown(review.submissionId);
      stagedReviews.set(review.submissionId, { review, doodle });
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
    };

    const dialogue: DialogueContext = {
      watchReview: (submissionId) => {
        if (held.has(submissionId)) return;
        let resolve!: () => void;
        let reject!: () => void;
        const ready = new Promise<void>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        const turn: HeldTurn = { resolve, reject, gaveUp: false };
        held.set(submissionId, turn);
        setWatching((ids) => [...ids, submissionId]);
        enqueue({
          id: reviewStageId(submissionId),
          kind: 'review',
          payload: { submissionId },
          ready,
          // Hold everything behind it (the XP it earned) for as long as the
          // judge may take, rather than the stage's usual patience
          readyTimeoutMs: REVIEW_WAIT_MS,
        }).then((outcome) => {
          // Skipped while still watching means the stage timed out on it
          if (outcome !== 'played' && held.get(submissionId) === turn) {
            turn.gaveUp = true;
          }
        });
      },
      showReview: (review, doodle) => {
        // Its turn is already held (the bell heard it before the watcher did):
        // speak in that turn rather than marking it heard, which would have
        // the watcher cancel the turn and let the XP behind it play instead
        const turn = held.get(review.submissionId);
        if (turn && !turn.gaveUp) {
          held.delete(review.submissionId);
          setWatching((ids) => ids.filter((id) => id !== review.submissionId));
          stage(review, doodle);
          turn.resolve();
          return;
        }
        stage(review, doodle);
        enqueue({
          id: reviewStageId(review.submissionId),
          kind: 'review',
          payload: { submissionId: review.submissionId },
        });
      },
    };

    const watchedDone = (
      submissionId: string,
      review: AIReview | null,
      doodle?: DialogueDoodle,
    ) => {
      const turn = held.get(submissionId);
      held.delete(submissionId);
      setWatching((ids) => ids.filter((id) => id !== submissionId));
      // Never coming (judging off, or it failed): its turn is skipped
      if (!review) return turn?.reject();
      // The bell and the feed pick up the new comment straight away
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed });
      queryClient.invalidateQueries({ queryKey: queryKeys.daily });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      if (wasReviewShown(review.submissionId)) return turn?.reject();
      if (!turn || turn.gaveUp) return dialogue.showReview(review, doodle);
      stage(review, doodle);
      turn.resolve();
    };

    return { context: dialogue, onWatchedDone: watchedDone };
  });

  return (
    <AIDialogueContext.Provider value={context}>
      {children}
      {watching.map((submissionId) => (
        <ReviewWatcher
          key={submissionId}
          submissionId={submissionId}
          onDone={onWatchedDone}
        />
      ))}
    </AIDialogueContext.Provider>
  );
};
