import { useState } from 'react';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { CommentLines } from './CommentLines';
import { AIJudgeDrawer } from './AIJudgeDrawer';
import { ReviewTipsButton } from './ReviewTips';
import { AI_SCORE_MAX, formatScore } from './score';
import { speakerTurns } from './speakers';
import type { FC } from 'react';
import type { AICriterionScore, AIJudge, AIReview } from '@/api/Api';
import { SpeechBox } from '@/components/SpeechBox';
import { cn } from '@/utils';

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
 * The judge's comment, in a speech box like a friend's, carrying its
 * criteria and score. Its face opens a drawer about the judge.
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
      className="block cursor-pointer transition-[scale,rotate] duration-300 ease-[var(--ease-spring)] hover:scale-110 hover:-rotate-6"
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
      <SpeechBox portrait={face} name={judge.name} className={className}>
        <p className="text-secondary italic leading-snug" aria-live="polite">
          {judge.name} is squinting at this doodle
          <span className="inline-block animate-pulse">…</span>
        </p>
        {drawer}
      </SpeechBox>
    );
  }

  return (
    <SpeechBox portrait={face} name={judge.name} className={className}>
      {/* Slapped on the box's top corner, above the words */}
      {review.score !== null && (
        <ScoreSticker
          score={review.score}
          mine={mine}
          face={judgeFace(review.judge)}
          className="absolute z-10 -top-6 -right-3 rotate-6"
        />
      )}
      <p className="font-semibold leading-snug break-words">
        <CommentLines turns={speakerTurns(review.comment)} />
      </p>
      {review.criteria.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {review.criteria.map((criterion) => (
            <CriterionChip key={criterion.id} criterion={criterion} />
          ))}
        </div>
      )}
      {mine && (
        <ReviewTipsButton submissionId={review.submissionId} judge={judge} />
      )}
      {drawer}
    </SpeechBox>
  );
};
