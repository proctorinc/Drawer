import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate } from '@fortawesome/free-solid-svg-icons';
import { useRerunAIReview } from '../api';
import type { FC } from 'react';
import { formatScore } from '@/ai/score';
import { cn } from '@/utils';
import { useConfirm } from '@/components/Confirm';

type Props = {
  submissionId: string;
  /** The judge to ask; leave it out for whoever judges a doodle drawn now */
  personalityId?: string;
  /** Named in the confirmation, e.g. "Sir Doodleton" */
  judgeName?: string;
  /** Whose doodle it is, for the confirmation */
  artist?: string;
  /** Show "re-run" next to the icon */
  showLabel?: boolean;
  className?: string;
};

/**
 * Has a judge look at a doodle again and replaces the review its artist sees
 * (the bell shows it as new, and the judge's dialogue plays for them once more).
 * The earlier run stays in the AI log; this one is logged as an admin re-run.
 */
export const RerunAIButton: FC<Props> = ({
  submissionId,
  personalityId,
  judgeName,
  artist,
  showLabel = false,
  className,
}) => {
  const rerun = useRerunAIReview();
  const confirm = useConfirm();

  async function run() {
    const who = judgeName ?? "today's judge";
    const whose = artist ? `${artist}'s` : 'this';
    const ok = await confirm({
      title: `have ${who} judge ${whose} doodle again?`,
      message:
        'the new review replaces the one the player sees; the old run stays in the AI log.',
      confirmLabel: 're-run',
    });
    if (!ok) return;
    rerun.mutate({ submissionId, personalityId });
  }

  return (
    <span
      className={cn('inline-flex flex-col items-start gap-0.5', className)}
      // Inside clickable rows: don't open the row too
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={rerun.isPending}
        title="judge it again and replace the review the player sees"
        aria-label={showLabel ? undefined : 're-run'}
        className="inline-flex items-center gap-1.5 text-pencil hover:text-ink disabled:opacity-40 cursor-pointer whitespace-nowrap"
        onClick={run}
      >
        <FontAwesomeIcon
          icon={faRotate}
          className={cn(rerun.isPending && 'animate-spin')}
        />
        {showLabel && (rerun.isPending ? 'judging…' : 're-run')}
      </button>
      {rerun.isSuccess && (
        <span className="text-xs text-pencil whitespace-nowrap">
          replaced: {formatScore(rerun.data.score)}/10
        </span>
      )}
      {rerun.error && (
        <span className="text-xs text-coral">{rerun.error.message}</span>
      )}
    </span>
  );
};
