import { useQuery } from '@tanstack/react-query';
import type { FC, ReactNode } from 'react';
import type { AIJudge, AIReview } from '@/api/Api';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import { fetchAPI } from '@/api/apiClient';
import { InfoIcon } from '@/components/icons';
import { cn } from '@/utils';

/** How you could draw your doodle better, as its judge sees it */
export interface ReviewTips {
  /** How well it showed the prompt */
  prompt: 'nailed' | 'complete' | 'partial' | 'missed';
  /** The parts of the prompt the judge found missing; "" for none */
  promptMissing: string;
  tips: {
    /** For what that judge scores */
    judge: Array<string>;
    /** For drawing well and showing the prompt */
    general: Array<string>;
  };
}

/** Your doodle's tips; null when it has none (judged before tips were kept) */
export function useReviewTips(submissionId: string) {
  return useQuery({
    queryKey: ['ai', 'review', submissionId, 'tips'],
    queryFn: async (): Promise<ReviewTips | null> => {
      const response = await fetchAPI(
        'GET',
        `/ai/reviews/${encodeURIComponent(submissionId)}/tips`,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to load the tips');
      return response.json();
    },
    staleTime: Infinity,
    retry: false,
  });
}

const missedPrompt = (tips: ReviewTips) =>
  tips.prompt === 'partial' || tips.prompt === 'missed';

/** Scores under this open the tips on their own, the first time you hear the review */
export const LOW_SCORE = 4;

const offeredKey = (submissionId: string) =>
  `review-tips-offered:${submissionId}`;

/**
 * Whether the tips should open on their own after you hear this review: a
 * low score (from a judge that scores the usual way round), the first time.
 * Remembers that it asked, so replaying the review doesn't bring them back.
 */
export function shouldOfferTips(review: AIReview): boolean {
  if (review.judge.scoresBackwards) return false;
  if (review.score === null || review.score >= LOW_SCORE) return false;
  try {
    if (localStorage.getItem(offeredKey(review.submissionId))) return false;
    localStorage.setItem(offeredKey(review.submissionId), '1');
  } catch {
    // No storage: offer it anyway, at worst it comes up once per replay
  }
  return true;
}

/**
 * "How to improve my drawing", under the judge's comment on your own doodle.
 * Tapping it opens the judge's tips. Shows nothing when there are none.
 */
export const ReviewTipsButton: FC<{
  submissionId: string;
  judge: AIJudge;
}> = ({ submissionId, judge }) => {
  const { data: tips } = useReviewTips(submissionId);
  const { enqueue } = useAnimationQueue();
  if (!tips) return null;
  const missed = missedPrompt(tips);

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() =>
        void enqueue({
          id: `review-tips-${submissionId}`,
          kind: 'reviewTips',
          payload: { submissionId, judge },
        })
      }
      className="self-start flex items-center gap-1.5 text-sm text-left text-pencil cursor-pointer transition-colors hover:text-ink"
    >
      <InfoIcon size={16} className={cn('flex-none', missed && 'text-coral')} />
      <span>
        <span className="font-semibold text-ink">
          How to improve my drawing
        </span>
        {missed && ' · you missed part of the prompt'}
      </span>
    </button>
  );
};

/** What the judge made of how well you showed the prompt */
const PromptNote: FC<{ tips: ReviewTips }> = ({ tips }) => {
  if (missedPrompt(tips)) {
    return (
      <p className="px-3 py-2 border-2 border-ink rounded-sketch-alt bg-coral/20 leading-snug">
        <b>You missed part of the prompt</b>
        {tips.promptMissing && <>: {tips.promptMissing}</>}
      </p>
    );
  }
  return (
    <p className="text-secondary leading-snug">
      {tips.prompt === 'nailed'
        ? 'You nailed the prompt.'
        : 'You showed every part of the prompt.'}
    </p>
  );
};

const TipSection: FC<{
  title: string;
  tips: Array<string>;
  children?: ReactNode;
}> = ({ title, tips, children }) => (
  <section className="flex flex-col gap-2">
    <h3 className="font-accent font-bold text-2xl leading-none">{title}</h3>
    {children}
    {tips.length > 0 && (
      <ul className="flex flex-col gap-1.5 pl-5 list-disc leading-snug">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    )}
  </section>
);

/** The tips, in two groups: for this judge, and for drawing in general */
export const ReviewTipsList: FC<{ tips: ReviewTips; judge: AIJudge }> = ({
  tips,
  judge,
}) => (
  <>
    {tips.tips.judge.length > 0 && (
      <TipSection title={`for ${judge.name}`} tips={tips.tips.judge} />
    )}
    <TipSection title="drawing & the prompt" tips={tips.tips.general}>
      <PromptNote tips={tips} />
    </TipSection>
  </>
);
