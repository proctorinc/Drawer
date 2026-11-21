import type { CSSProperties, FC } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { formatScore } from '@/ai/score';
import { doodleXP } from '@/ai/xp';
import { cn } from '@/utils';

type Props = {
  submission: UserPromptSubmission;
  /** Drop in after the polaroid above it lands */
  delay?: number;
  className?: string;
};

/** What your own doodle earned, with the judge's bonus spelled out */
export const XPNote: FC<Props> = ({ submission, delay = 0, className }) => {
  const review = submission.aiReview;
  const earned = doodleXP(review?.status === 'done' ? review.score : null);
  const { judge } = earned;

  let detail: string;
  if (review?.status === 'pending') detail = 'judge still scoring';
  else if (judge)
    detail = `+${judge.xp} for ${review!.judge.name}'s ${formatScore(judge.score)} (×${formatScore(judge.boost)} bonus)`;
  else if (review?.score != null) detail = 'no bonus under a 5';
  else detail = '';

  return (
    <p
      className={cn(
        'm-0 px-1 text-center text-xs leading-tight text-pencil animate-drop',
        className,
      )}
      style={
        {
          animationDelay: `${delay + 150}ms`,
          '--tilt-from': '0deg',
        } as CSSProperties
      }
    >
      <span className="font-bold text-ink">+{earned.total} XP</span>
      <span className="block">+{earned.drawing} for drawing</span>
      {detail && <span className="block">{detail}</span>}
    </p>
  );
};
