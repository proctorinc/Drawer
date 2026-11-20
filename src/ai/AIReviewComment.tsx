import { useState } from 'react';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { AIJudgeDrawer } from './AIJudgeDrawer';
import { AI_SCORE_MAX, formatScore } from './score';
import type { FC } from 'react';
import type { AICriterionScore, AIReview } from '@/api/Api';
import { cn, timeAgo } from '@/utils';

/** The overall score, as a little sticker slapped on the comment */
export const ScoreSticker: FC<{ score: number; className?: string }> = ({
  score,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-baseline gap-0.5 px-2 py-0.5 -rotate-6 rounded-sketch-alt border-2 border-ink bg-butter font-accent font-bold leading-none whitespace-nowrap',
      className,
    )}
    aria-label={`scored ${formatScore(score)} out of ${AI_SCORE_MAX}`}
  >
    <span className="text-xl">{formatScore(score)}</span>
    <span className="text-xs text-pencil">/{AI_SCORE_MAX}</span>
  </span>
);

/** One criterion's artwork, name and score */
export const CriterionChip: FC<{ criterion: AICriterionScore }> = ({
  criterion,
}) => (
  <span
    className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border-[1.5px] border-ink bg-white text-sm leading-tight"
    title={criterion.description}
  >
    {criterion.imageUrl ? (
      <img src={criterion.imageUrl} alt="" className="size-5 object-contain" />
    ) : (
      <span className="size-2 ml-1 rounded-full bg-ink" aria-hidden="true" />
    )}
    <span>{criterion.name}</span>
    <b>
      {criterion.score}
      <span className="font-normal text-pencil">/{AI_SCORE_MAX}</span>
    </b>
  </span>
);

type Props = { review: AIReview; className?: string };

/**
 * The AI judge's comment, laid out like a friend's but signed with its name
 * (its avatar's "AI" tag says what it is), and carrying its score. Its face (or name) opens a drawer
 * about the judge.
 */
export const AIReviewComment: FC<Props> = ({ review, className }) => {
  const { judge } = review;
  const [aboutOpen, setAboutOpen] = useState(false);

  const face = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`About ${judge.name}, the AI judge`}
      onClick={() => setAboutOpen(true)}
      className="flex-none mt-0.5 cursor-pointer transition-[scale,rotate] duration-300 ease-[var(--ease-spring)] hover:scale-110 hover:-rotate-6"
    >
      <AIJudgeAvatar judge={judge} />
    </button>
  );
  const drawer = (
    <AIJudgeDrawer
      judge={judge}
      criteria={review.criteria}
      score={review.status === 'done' ? review.score : null}
      open={aboutOpen}
      onClose={() => setAboutOpen(false)}
    />
  );

  if (review.status === 'pending') {
    return (
      <div
        className={cn('flex gap-4 items-center font-semibold', className)}
        aria-live="polite"
      >
        {face}
        <span className="text-secondary italic">
          {judge.name} is squinting at this doodle
          <span className="inline-block animate-pulse">…</span>
        </span>
        {drawer}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex justify-between items-start gap-2 font-semibold">
        <div className="flex gap-4 items-start min-w-0">
          {face}
          <div className="flex flex-col min-w-0">
            <span className="flex flex-wrap items-center gap-x-1.5 text-sm leading-tight">
              <button
                type="button"
                className="font-bold cursor-pointer hover:underline"
                onClick={() => setAboutOpen(true)}
              >
                {judge.name}
              </button>
            </span>
            <p>{review.comment}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end flex-none">
          <span className="text-xs text-secondary whitespace-nowrap">
            {timeAgo(review.createdAt)}
          </span>
          {review.score !== null && <ScoreSticker score={review.score} />}
        </div>
      </div>
      {review.criteria.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-13">
          {review.criteria.map((criterion) => (
            <CriterionChip key={criterion.id} criterion={criterion} />
          ))}
        </div>
      )}
      {drawer}
    </div>
  );
};
