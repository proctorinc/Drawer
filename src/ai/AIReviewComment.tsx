import { useState } from 'react';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { AIJudgeDrawer } from './AIJudgeDrawer';
import { AI_SCORE_MAX, formatScore } from './score';
import type { FC } from 'react';
import type { AICriterionScore, AIJudge, AIReview } from '@/api/Api';
import { cn, timeAgo } from '@/utils';

/** The overall score, as a little sticker slapped on the comment. Your own
 * doodle's score wears your profile color; everyone else's stays butter.
 * A judge that scores backwards (the Grinch) gets his face on it, so his
 * upside-down score reads as his, not a usual one. */
export const ScoreSticker: FC<{
  score: number;
  mine?: boolean;
  /** The Grinch's face, for his scores (see judgeFace) */
  face?: string;
  className?: string;
}> = ({ score, mine = false, face, className }) => (
  <span
    className={cn(
      'inline-flex items-baseline gap-0.5 px-2 py-0.5 -rotate-6 rounded-sketch-alt border-2 border-ink font-accent font-bold leading-none whitespace-nowrap',
      mine ? 'bg-me text-me-ink' : 'bg-butter text-ink',
      className,
    )}
    aria-label={`${face ? "the Grinch's approval" : 'scored'} ${formatScore(score)} out of ${AI_SCORE_MAX}`}
  >
    {face && (
      <img
        src={face}
        alt=""
        className="self-center size-5 mr-0.5 -my-1 flex-none rounded-full border-[1.5px] border-ink bg-white"
      />
    )}
    <span className="text-xl">{formatScore(score)}</span>
    <span className={cn('text-xs', mine ? 'text-me-ink' : 'text-pencil')}>
      /{AI_SCORE_MAX}
    </span>
  </span>
);

/** The face for a judge's score sticker: only a judge that scores backwards gets one */
export const judgeFace = (judge: AIJudge) =>
  judge.scoresBackwards ? judge.avatarUrl : undefined;

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
      {formatScore(criterion.score)}
      <span className="font-normal text-pencil">/{AI_SCORE_MAX}</span>
    </b>
  </span>
);

type Props = { review: AIReview; mine?: boolean; className?: string };

/**
 * The judge's comment, laid out like a friend's but signed with its name,
 * and carrying its score. Its face (or name) opens a drawer
 * about the judge.
 */
export const AIReviewComment: FC<Props> = ({
  review,
  mine = false,
  className,
}) => {
  const { judge } = review;
  const [aboutOpen, setAboutOpen] = useState(false);

  const face = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`About ${judge.name}, the judge`}
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
          {review.score !== null && (
            <ScoreSticker
              score={review.score}
              mine={mine}
              face={judgeFace(review.judge)}
            />
          )}
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
